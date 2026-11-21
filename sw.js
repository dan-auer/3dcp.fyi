/* sw.js - the site's service worker. Built for a site with no build step:
   nothing is hashed, so freshness is decided by content, not by filename.

   What it does
   - Precaches the shell (pages, styles, fonts, every script the site can
     load) into one cache on install. Missing files are skipped, never fatal:
     a file added to the site but not to SHELL simply bypasses the cache.
   - Serves the shell cache-first, including the page itself, so a return
     visit touches the network for nothing but data. Everything else - the
     data files, version.json, the model, Unpaywall - passes straight through
     (data delivery is decided elsewhere; version.json must stay live).
   - Revalidates the shell in the background at most every 10 minutes, and
     cheaply: version.json (stamped with the commit by the deploy job in
     .github/workflows/docs.yml, never cached here) is fetched first, and only
     when its content differs from the one the cache was filled against is the
     whole shell re-fetched (conditional requests, so an unchanged file is one
     small 304). The fingerprints (ETag / Last-Modified) are compared, and when
     any changed ALL new responses are written together, so the cache never
     holds half a deploy. Open pages get { type: "oa-shell-updated" } and show a
     quiet "reload for the newest version" notice (oa-boot.js). A version.json
     that is missing or carries no "commit" (a branch deploy, a fork, a hand
     edit) proves nothing, so the shell is swept instead - trusting it once
     froze every returning visitor on the cache they first got.

   What it deliberately does not do
   - skipWaiting(): a new sw.js waits for all tabs to close, so a page never
     changes workers mid-session.
   - Offline for anything but the shell: a short link (/<key>) still needs
     the network for the 404 router, and the data is not cached here.

   Registered by oa-boot.js on the production hosts only (3dcp.fyi,
   *.github.io), once the page's dataset has landed: forks, previews and
   serve.py see no worker and no caching. */

// v2: a fresh cache for everyone whose v1 shell stopped updating (see above).
const CACHE = "oa-shell-v2";
const CHECK_INTERVAL = 10 * 60 * 1000;
const ROOT = new URL("./", self.location).href;
const STAMP = ROOT + "__oa-shell-checked";
// The version.json text the shell was last swept against (synthetic entry).
const VERSION_SEEN = ROOT + "__oa-shell-version";
const VERSION_URL = ROOT + "version.json";

// Paths relative to the site root. "" is the page itself (index.html).
// Keep in sync with index.html and the lazy loaders - tests/unit/sw-shell
// fails the build when an entry points nowhere.
const SHELL = [
  "", "404.html", "rechtliches.html", "adjacency.html", "map-affiliations.html",
  "src/favicon.svg", "src/fonts/InterVariable.woff2", "src/fonts/InterVariable-Italic.woff2",
  "src/style/article.css", "src/style/search.css", "src/style/articles.css",
  "src/sponsors/dfg.svg", "src/sponsors/tum.svg",
  "src/vendor/slickgrid/slick.grid.css", "src/vendor/slickgrid/slick-alpine-theme.css",
  "src/vendor/slickgrid/slick.core.js", "src/vendor/slickgrid/slick.interactions.js", "src/vendor/slickgrid/slick.grid.js",
  "src/vendor/slickgrid/slick.groupitemmetadataprovider.js", "src/vendor/slickgrid/slick.dataview.js",
  "src/vendor/Sortable.min.js", "src/vendor/d3.v7.min.js", "src/vendor/orama-3.1.18.mjs", "src/vendor/topojson-client-3.1.0.min.js",
  "src/vendor/hypher/hypher.js", "src/vendor/hypher/en-us.js",
  "src/category_data.js", "src/replacement_data.js",
  "src/javascript/oa-boot.js", "src/javascript/entry-state.js", "src/javascript/data-load.js", "src/javascript/data-worker.js",
  "src/javascript/asset-loader.js", "src/javascript/oa-typeset.js", "src/javascript/dialog-utils.js", "src/javascript/bibliography.js",
  "src/javascript/article-store.js", "src/javascript/browser-actions.js", "src/javascript/oa-theme.js", "src/javascript/feature-loader.js",
  "src/javascript/favorites.js", "src/javascript/toc.js", "src/javascript/cite-format.js",
  "src/javascript/ext-records.js", "src/javascript/oa-row-select.js", "src/javascript/search-facets.js", "src/javascript/articles-grid.js",
  "src/javascript/grid-shell.js", "src/javascript/header-actions.js", "src/javascript/kiosk.js", "src/javascript/qr-code.js",
  "src/javascript/search-loader.js", "src/javascript/table-gate.js", "src/javascript/landing.js", "src/javascript/cumulative-charts.js", "src/javascript/browser-tour.js",
  "src/javascript/oa-lifecycle.js", "src/javascript/grid-renderers.js", "src/javascript/grid-layout.js", "src/javascript/grid-search.js",
  "src/javascript/rule-language.js", "src/javascript/rule-editor.js", "src/javascript/grid-rules.js", "src/javascript/grid-settings.js", "src/javascript/oa-abstract-rows.js", "src/javascript/drop-metrics.js", "src/javascript/paper-affiliation-map.js",
  "src/javascript/matrix-common.js", "src/javascript/author-panel.js", "src/javascript/topic-panel.js", "src/javascript/author-footer.js", "src/javascript/grid-sort.js", "src/javascript/grid-keys.js", "src/javascript/grid-actions.js", "src/javascript/influence.js",
  "src/javascript/author-indices.js", "src/javascript/semantic-search.js", "src/javascript/search-core.js", "src/javascript/search-worker.js",
  "src/javascript/add-paper.js", "src/javascript/report-error.js", "src/javascript/model-gate.js", "src/javascript/oa-tts.js",
  "src/javascript/adjacency-matrix.js", "src/javascript/affiliation-map.js"
];

const keyFor = (path) => ROOT + path;
const SHELL_KEYS = new Set(SHELL.map(keyFor));

// The page is one entry whatever the address said: "/", "/index.html",
// "/?q=…" all map to ROOT.
function cacheKey(url) {
  const u = new URL(url);
  u.search = ""; u.hash = "";
  if (u.href === ROOT + "index.html") return ROOT;
  return SHELL_KEYS.has(u.href) ? u.href : null;
}

function fingerprint(res) {
  return res.headers.get("etag") || res.headers.get("last-modified") || "";
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async (path) => {
    const key = keyFor(path);
    try {
      // no-cache: revalidate, so a new worker never fills its cache from
      // HTTP-cached copies of the deploy it replaces.
      const res = await fetch(key, { cache: "no-cache" });
      if (res.ok) await cache.put(key, res);
    } catch (e) { /* skipped: served from the network until the next check */ }
  }));
  // Remember which deploy this shell belongs to, so the first revalidation
  // is a single small request rather than a full sweep.
  const version = await fetchVersion();
  if (version !== null) await cache.put(VERSION_SEEN, new Response(version));
}

// The deploy marker as text; null when unreachable, absent, or not stamped by
// the deploy job (no "commit"): only a per-deploy stamp can vouch that nothing
// changed, so anything else sends revalidate() to the full sweep.
async function fetchVersion() {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text).commit ? text : null;
  } catch (e) { return null; }
}

async function revalidate() {
  const cache = await caches.open(CACHE);
  const stamp = await cache.match(STAMP);
  if (stamp && Date.now() - Number(await stamp.text()) < CHECK_INTERVAL) return;
  await cache.put(STAMP, new Response(String(Date.now())));
  // One request decides whether the ~90 below are needed at all.
  const version = await fetchVersion();
  const seen = await cache.match(VERSION_SEEN);
  const seenText = seen ? await seen.text() : null;
  if (version !== null && seenText !== null && version === seenText) return;
  const fresh = [];
  let changed = 0, failed = false;
  await Promise.all(SHELL.map(async (path) => {
    const key = keyFor(path);
    try {
      const old = await cache.match(key);
      const res = await fetch(key, { cache: "no-cache" });
      if (!res.ok) { failed = true; return; }
      const was = old ? fingerprint(old) : null, now = fingerprint(res);
      if (old && was === now) return;
      fresh.push([key, res]);
      if (old && was) changed += 1;
    } catch (e) { failed = true; /* offline or blocked: keep what we have */ }
  }));
  // One download failed: write nothing. The new files without the one that
  // failed would be half a deploy (a new page with an old script); the cache
  // keeps the whole old one, the marker does not advance, and the next check
  // sweeps again.
  if (failed) return;
  await Promise.all(fresh.map(([key, res]) => cache.put(key, res)));
  if (version !== null) await cache.put(VERSION_SEEN, new Response(version));
  if (changed) {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => c.postMessage({ type: "oa-shell-updated", changed }));
  }
}

self.addEventListener("install", (event) => { event.waitUntil(precache()); });

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("oa-shell-") && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "oa-check-update") event.waitUntil(revalidate());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const key = cacheKey(req.url);
  if (!key) return;                       // data, APIs, version.json, model: untouched
  if (req.mode === "navigate") event.waitUntil(revalidate());
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  })());
});
