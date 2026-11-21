/* data-load.js - downloads the data files and parses them off the main thread
   (data-worker.js), so a multi-MB literal is never evaluated as a <script> on
   the page. Runs parser-blocking in <head>, right after oa-boot.js
   (OA_REL_ROOT) and entry-state.js (OAEntry) and BEFORE the stylesheets: a
   parser-blocking script after a stylesheet waits for it, which held the
   "early" download back behind the CSS.

   window.OAData.load(path, global) - Promise of the parsed value, also set on
   window[global]. One request per path; a failed load is forgotten, so a later
   call retries. Fallbacks, in order: worker -> fetch + JSON.parse on the page
   -> a plain <script> tag (also the only path on file://, where fetch is
   blocked).

   window.OADataLoad - Promise that resolves once the page's dataset is set:
   ARTICLES_DATA and AUTHORS_DATA by default (published together: the article
   store keys its snapshot on the AUTHORS_DATA object, so a late author file
   would mean a second full build), or what the script tag's data-files names
   ("GLOBAL:path,..."). Rejects with the first failure; the grid (awaiting it)
   turns that into its error + retry.
   On the table path it starts at once. On the entry screen (OAEntry.showGate)
   the pitch needs only data/summary.json, so the dataset starts on the first
   sign of "Browse" (pointer over it, focus, touch) or once the page has loaded
   and gone idle, whichever comes first; OADataLoadStart() starts it early.

   window.OADataProgress() - the dataset's download so far, for the table's
   loading bar (articles-grid.js): { loaded, total } in bytes, total null while
   a file's size is unknown. "oa-data-progress" on window says it moved.

   window.OATocLoad - the section titles (data/toc_data.js -> TOC_DATA), an
   optional resource requested after the dataset so they never compete with
   the first table. Fires "oa-toc-ready" on window when they land. */
(function () {
  "use strict";
  var root = window.OA_REL_ROOT || "";
  var script = document.currentScript;
  function url(path) { return new URL(root + path, document.baseURI).href; }

  // The literal after the LAST "window.<global> =", as data-worker.js reads it:
  // a file without the assignment fails here instead of parsing whatever
  // follows the first "=".
  function parse(text, global, path) {
    var at = text.lastIndexOf("window." + global);
    if (at < 0) throw new Error("no window." + global + " assignment in " + path);
    var start = text.indexOf("=", at) + 1;
    while (start < text.length && /\s/.test(text[start])) start++;
    var open = text[start];
    if (open !== "{" && open !== "[") throw new Error("unexpected literal in " + path);
    return JSON.parse(text.slice(start, text.lastIndexOf(open === "{" ? "}" : "]") + 1));
  }

  // Bytes received per path, as the worker reports them: { loaded, total },
  // total 0 while the response does not say (it came compressed).
  var progress = new Map();
  function report(path, loaded, total) {
    progress.set(path, { loaded: loaded, total: total });
    window.dispatchEvent(new CustomEvent("oa-data-progress"));
  }

  // One worker while requests are pending; it is let go when the last settles.
  var worker = null, pending = new Map(), seq = 0;
  function viaWorker(path, global) {
    if (typeof Worker !== "function") return Promise.reject(new Error("no Worker"));
    if (!worker) {
      var w;
      try { w = new Worker(url("src/javascript/data-worker.js")); }
      catch (e) { return Promise.reject(e); }
      worker = w;
      w.onmessage = function (ev) {
        var m = ev.data, p = pending.get(m.reqId);
        if (!p) return;
        if ("loaded" in m) { report(p.path, m.loaded, m.total); return; }
        pending.delete(m.reqId);
        if (m.error) p.reject(new Error(m.error)); else p.resolve(m.value);
        if (!pending.size && worker === w) { worker = null; w.terminate(); }
      };
      w.onerror = function (ev) {
        if (worker === w) worker = null;
        w.terminate();
        var error = new Error(ev.message || "data worker failed");
        pending.forEach(function (p) { p.reject(error); });
        pending.clear();
      };
    }
    var target = worker;
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending.set(id, { resolve: resolve, reject: reject, path: path });
      target.postMessage({ reqId: id, url: url(path), global: global });
    });
  }

  function viaFetch(path, global) {
    return fetch(url(path)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + path);
      return r.text();
    }).then(function (text) { return parse(text, global, path); });
  }

  function viaScript(path, global) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url(path);
      s.async = false;
      s.onload = function () { resolve(window[global]); };
      s.onerror = function () { reject(new Error("Failed to load " + path)); };
      document.head.appendChild(s);
    });
  }

  // A network failure is worth one more try the old way before giving up: the
  // script path shares the HTTP cache, so a partial download retries only what
  // is missing.
  function fetchValue(path, global) {
    if (location.protocol === "file:") return viaScript(path, global);
    return viaWorker(path, global)
      .catch(function () { return viaFetch(path, global); })
      .catch(function (error) { return viaScript(path, global).catch(function () { throw error; }); });
  }

  var requests = new Map();
  function value(path, global) {
    if (!requests.has(path)) {
      var p = fetchValue(path, global);
      requests.set(path, p);
      p.catch(function () { if (requests.get(path) === p) { requests.delete(path); progress.delete(path); } });
    }
    return requests.get(path);
  }
  function load(path, global) {
    if (window[global]) return Promise.resolve(window[global]);
    return value(path, global).then(function (v) {
      if (!window[global]) window[global] = v;
      return window[global];
    });
  }
  window.OAData = Object.freeze({ load: load });

  /* ---- the page's dataset ---- */
  var spec = script && script.getAttribute("data-files");
  var FILES = spec
    ? spec.split(",").map(function (s) { var i = s.indexOf(":"); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; })
    : [["ARTICLES_DATA", "data/tabular_data.js"], ["AUTHORS_DATA", "data/author_data.js"]];

  // A file's size is its Content-Length when it came uncompressed (serve.py),
  // else what the deploy wrote into data/summary.json (build_summary.mjs:
  // GitHub Pages compresses the files, which hides their real size). A file not
  // being fetched here (not started yet, or failed and retried another way)
  // has no size: the bar then moves without a percent.
  window.OADataProgress = function () {
    var sizes = (window.OA_SUMMARY && window.OA_SUMMARY.bytes) || {};
    var loaded = 0, total = 0;
    FILES.forEach(function (f) {
      var p = progress.get(f[1]) || { loaded: 0, total: 0 }, size = p.total || sizes[f[1]];
      loaded += p.loaded;
      total = total !== null && requests.has(f[1]) && size ? total + size : null;
    });
    return { loaded: loaded, total: total };
  };

  var release, started = false;
  var gate = new Promise(function (resolve) { release = resolve; });
  var INTENT = ["pointerover", "focusin", "touchstart", "click"];
  function onIntent(ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#tableGateEnter")) begin();
  }
  function begin() {
    if (started) return;
    started = true;
    INTENT.forEach(function (type) { document.removeEventListener(type, onIntent, true); });
    release();
  }
  window.OADataLoadStart = begin;

  window.OADataLoad = gate.then(function () {
    return Promise.all(FILES.map(function (f) { return value(f[1], f[0]); }));
  }).then(function (values) {
    FILES.forEach(function (f, i) { window[f[0]] = values[i]; });
  });
  // Consumers that can wait (the grid) await this; nobody should see an
  // unhandled rejection.
  window.OADataLoad.catch(function () {});

  if (!(window.OAEntry && window.OAEntry.showGate)) begin();
  else {
    INTENT.forEach(function (type) { document.addEventListener(type, onIntent, { capture: true, passive: true }); });
    addEventListener("load", function () {
      if (typeof requestIdleCallback === "function") requestIdleCallback(begin, { timeout: 4000 });
      else setTimeout(begin, 1500);
    });
  }

  /* ---- section titles: optional, after the dataset ---- */
  if (!spec) {
    window.OATocLoad = window.OADataLoad.catch(function () {}).then(function () {
      return load("data/toc_data.js", "TOC_DATA");
    }).then(function (toc) {
      window.dispatchEvent(new CustomEvent("oa-toc-ready"));
      return toc;
    });
    window.OATocLoad.catch(function () {});
  }
})();
