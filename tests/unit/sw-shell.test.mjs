// sw.js precaches a hand-maintained list (there is no build to generate one).
// Every entry must be a real file, and everything index.html and the lazy
// loaders reference must be in the list - otherwise the cache quietly serves
// a partial shell. Read, don't execute: the worker's globals do not exist here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
const list = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

test("every SHELL entry exists", () => {
  const missing = list.filter((p) => !existsSync(path.join(root, p === "" ? "index.html" : p)));
  assert.deepEqual(missing, []);
});

test("SHELL has no duplicates", () => {
  assert.equal(new Set(list).size, list.length);
});

test("everything index.html loads is in SHELL", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="((?:src|sw)\/[^"]+|sw\.js)"/g)].map((m) => m[1]);
  const quoted = [...html.matchAll(/"(src\/[a-z0-9_./-]+\.(?:js|css|mjs|svg|woff2))"/gi)].map((m) => m[1]);
  const wanted = new Set([...refs, ...quoted].filter((p) => !/^data\//.test(p)));
  const missing = [...wanted].filter((p) => !list.includes(p));
  assert.deepEqual(missing, []);
});

test("the lazy loaders' modules are in SHELL", () => {
  const grid = readFileSync(path.join(root, "src/javascript/articles-grid.js"), "utf8");
  const mods = [...grid.matchAll(/JS_DIR \+ "([a-z0-9-]+\.js)"/g)].map((m) => "src/javascript/" + m[1]);
  const features = readFileSync(path.join(root, "src/javascript/feature-loader.js"), "utf8");
  const feats = [...features.matchAll(/\["([a-z0-9-]+\.js)"/g)].map((m) => "src/javascript/" + m[1]);
  const missing = [...mods, ...feats].filter((p) => !list.includes(p));
  assert.deepEqual(missing, []);
});
