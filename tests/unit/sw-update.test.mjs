// sw.js's background update (revalidate) run for real, in a vm with a fake
// Cache Storage and fetch: a sweep that cannot download every file must leave
// the cache as it was - never a new page with an old script - and tell no
// page to reload; the next complete sweep takes the whole deploy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");

class FakeResponse {
  constructor(body, init = {}) {
    const headers = init.headers || {};
    this.body = String(body);
    this.ok = init.ok !== false;
    this.status = this.ok ? 200 : 500;
    this.headers = { get: (k) => headers[k.toLowerCase()] || null };
  }
  async text() { return this.body; }
  clone() { return this; }
}

// One worker over a site that serves deploy.v; paths in `failing` cannot be fetched.
function worker(deploy, failing) {
  const store = new Map(), posted = [];
  const ctx = {
    self: {
      location: "https://example.test/",
      addEventListener() {},
      clients: { matchAll: async () => [{ postMessage: (m) => posted.push(m) }], claim: async () => {} }
    },
    caches: { open: async () => ({ match: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); } }), keys: async () => [] },
    URL, Response: FakeResponse, Date, JSON, Promise, Set, Number, String,
    fetch: async (url) => {
      const path = String(url).replace("https://example.test/", "");
      if (path === "version.json") return new FakeResponse(JSON.stringify({ commit: deploy.v }));
      if (failing.has(path)) throw new Error("offline");
      return new FakeResponse(path + "@" + deploy.v, { headers: { etag: path + "-" + deploy.v } });
    }
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\n;globalThis.__sw = { precache, revalidate, SHELL, keyFor, STAMP };", ctx);
  const sw = ctx.__sw;
  // Which deploys the cached shell files come from.
  const deploys = async () => {
    const seen = new Set();
    for (const p of sw.SHELL) {
      const r = store.get(sw.keyFor(p));
      seen.add(r ? (await r.text()).split("@")[1] : "missing");
    }
    return [...seen].sort();
  };
  return { sw, store, posted, deploys };
}

test("an update with one failed download keeps the whole old shell; the next check takes the new one", async () => {
  const deploy = { v: "v1" }, failing = new Set();
  const w = worker(deploy, failing);
  await w.sw.precache();
  assert.deepEqual(await w.deploys(), ["v1"]);

  deploy.v = "v2";
  failing.add("src/javascript/articles-grid.js");
  await w.sw.revalidate();
  assert.deepEqual(await w.deploys(), ["v1"]);   // not v1 and v2 mixed
  assert.deepEqual(w.posted, []);               // and no page told to reload

  failing.clear();
  w.store.delete(w.sw.STAMP);                   // the next check, ten minutes on
  await w.sw.revalidate();
  assert.deepEqual(await w.deploys(), ["v2"]);
  assert.equal(w.posted.length, 1);
  assert.equal(w.posted[0].type, "oa-shell-updated");
});
