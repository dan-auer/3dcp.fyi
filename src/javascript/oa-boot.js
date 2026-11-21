/* oa-boot.js - pre-paint boot shared by every article page.

   Runs parser-blocking in <head> (after the favicon link, before the page
   paints), replacing what used to be an inline <script> copied into every
   article. Three jobs, all identical on every page:

     1. Scheme + no-flash background - resolve the stored day/night choice
        (localStorage "oa-scheme", default dark) and stamp it on <html> as
        data-scheme, together with the matching background, color-scheme and
        mobile theme-color, all before first paint. Every scheme-dependent CSS
        rule keys off html[data-scheme], so the page never flashes the wrong one.
     2. window.OA_REL_ROOT - path from this page to the site root, derived from
        the favicon link's ../ depth, so every internal link resolves both
        offline (file://) and at any deploy root.
     3. The animated favicon (below) - one draw-on cycle of the site mark per
        view, rendered to a canvas and pushed into the icon link. */
/* ---- Saved settings ------------------------------------------------------
   window.OAPrefs: localStorage for every later script. Private modes and
   blocked storage make its calls throw; here reads give null (getJSON: the
   fallback, also for a corrupt value) and writes do nothing. */
window.OAPrefs = (function () {
  function get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) { /* storage off */ } }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* storage off */ } }
  function getJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  return Object.freeze({ get: get, set: set, remove: remove, getJSON: getJSON,
    setJSON: function (key, value) { set(key, JSON.stringify(value)); } });
})();

window.OA_SCHEME_KEY = "oa-scheme";
// Grounds must match --bg of the "concrete" palette in article.css. The key
// holds one of three themes; "mint" is a night theme re-tinted green, so it
// stamps data-scheme="dark" (every night rule holds) plus data-theme="mint".
window.OA_SCHEME_BG = { dark: "#000000", light: "#ffffff", mint: "#071611" };
(function () {
  try {
    var t = window.OAPrefs.get(window.OA_SCHEME_KEY);
    // Mint is the site's default look, so an untouched visit gets it; only an
    // explicit toggle switches schemes (no OS query, nothing to surprise).
    if (t !== "light" && t !== "dark" && t !== "mint") t = "mint";
    var s = t === "light" ? "light" : "dark";
    window.OA_SCHEME = s;
    window.OA_THEME = t;
    var de = document.documentElement;
    de.setAttribute("data-scheme", s);
    de.setAttribute("data-theme", t);
    var bg = window.OA_SCHEME_BG[t];
    de.style.background = bg;
    // Native UI (scrollbars, form controls, datalist popups) follows the scheme.
    de.style.colorScheme = s;
    var m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    m.setAttribute("content", bg);
    document.head.appendChild(m);
    // Abstract layout (Settings > Appearance): set before first paint so the
    // grid's first drops render in the chosen form without a flash.
    var al = window.OAPrefs.get("oa-abs-layout");
    de.setAttribute("data-abs-layout", al === "lines" ? "lines" : "flow");
  } catch (e) {}
})();

/* ---- Input modality ------------------------------------------------------
   html[data-input="kb" | "pointer"]: which device moved focus last. Text inputs
   match :focus-visible even on a mouse click, so the rings that should show only
   for keyboard users (search box, entry CTA) key off this instead. Only Tab flips
   to "kb" - typing in a clicked field must not light its ring. */
(function () {
  try {
    var de = document.documentElement;
    de.setAttribute("data-input", "pointer");
    addEventListener("pointerdown", function () { de.setAttribute("data-input", "pointer"); }, true);
    addEventListener("keydown", function (e) { if (e.key === "Tab") de.setAttribute("data-input", "kb"); }, true);
  } catch (e) {}
})();

window.OA_REL_ROOT = typeof window.OA_REL_ROOT === "string" ? window.OA_REL_ROOT : (function () {
  try {
    var l = document.querySelector('link[rel="icon"]');
    var h = l ? l.getAttribute("href") : "";
    if (h.charAt(0) === "/") return "/";
    var m = h.match(/^((?:\.\.\/)*)/);
    return m ? m[1] : "";
  } catch (e) { return ""; }
})();

/* ---- Animated favicon ----------------------------------------------------
   src/favicon.svg carries a SMIL draw-on for browsers that animate SVG icons;
   Chrome rasterises a single frame, so the same mark is stroked frame by frame
   onto a canvas here and pushed into the icon link as a data URL.

   It plays ONCE - draw on, hold - then stops on the finished mark. A permanent
   loop meant re-encoding a PNG data URL every frame for the whole session; the
   payoff is one 5s stroke, so it is spent once and the mark then sits still.
   Frames are throttled and duplicate offsets skipped, so the encode runs a few
   dozen times rather than once per frame. Hidden tabs pause and resume.
   Runs after OA_REL_ROOT above, which reads this same link's href. */
(function () {
  try {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) return;
    // One 8s cycle, same shape as the SMIL in favicon.svg: 5s draw, 0.8s hold,
    // 1.6s retract, 0.6s empty.
    var SIZE = 64, LEN = 240, DRAW = 5000, FRAME = 70;
    var cv, ctx, path, running = false, raf = 0, done = false;
    var startTs = 0, elapsed = 0, lastPaint = -1, lastStep = -1;
    function draw(e) {
      // Quantized to whole dash-offset steps: consecutive frames that round to
      // the same stroke length would encode an identical PNG.
      var step = Math.round(e * LEN);
      if (step === lastStep) return;
      lastStep = step;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.scale(SIZE / 72, SIZE / 72);
      // Neutral gray, one value for both schemes: mid-gray keeps contrast on a
      // light tab strip and a dark one alike, so the icon needs no scheme swap.
      ctx.strokeStyle = "#8a8a8e";
      ctx.lineWidth = 16.9; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.setLineDash([LEN, LEN]);
      ctx.lineDashOffset = LEN * e;
      ctx.stroke(path);
      ctx.restore();
      link.type = "image/png";
      link.href = cv.toDataURL("image/png");
    }
    // Dash offset over the single play: +LEN is empty, 0 is the finished mark.
    function offsetAt(t) {
      var ease = function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
      if (t < DRAW) return LEN * (1 - ease(t / DRAW));
      return 0;
    }
    function loop(ts) {
      if (!running) return;
      if (startTs === 0) startTs = ts;
      var t = elapsed + (ts - startTs);
      if (lastPaint < 0 || ts - lastPaint >= FRAME || t >= DRAW) {
        lastPaint = ts;
        try { draw(offsetAt(t) / LEN); } catch (err) { running = false; done = true; return; }
      }
      if (t >= DRAW) {           // finished mark is on screen: stop encoding
        elapsed = DRAW; running = false; done = true; raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || done || document.hidden) return;
      if (!cv) {
        cv = document.createElement("canvas");
        cv.width = cv.height = SIZE;
        ctx = cv.getContext("2d");
        path = new Path2D("M9 9H63V27H24V45H63V63H9");
      }
      running = true;
      startTs = 0; lastPaint = -1;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      // Bank the progress so a resumed tab continues the stroke instead of
      // restarting it.
      if (running && startTs !== 0) elapsed = Math.min(DRAW, elapsed + (performance.now() - startTs));
      running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    }
    if (document.readyState === "complete") start();
    else addEventListener("load", start);
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  } catch (e) {}
})();

/* ---- Click the mark, it draws itself -------------------------------------
   Delegated so it covers every instance (header marks injected after load,
   the static ones on index/rechtliches, the big title mark). When the mark sits
   inside its home link the draw still starts, but navigation is NOT delayed for
   it: a decorative stroke is not worth holding up a click, and the destination
   page plays its own mark on arrival. */
document.addEventListener("click", function (ev) {
  try {
    var t = ev.target;
    if (!t || !t.closest) return;
    var mark = t.closest(".oa-mark");
    if (!mark) return;
    mark.classList.remove("is-drawing");
    void mark.getBoundingClientRect();  // restart the animation on a repeat click
    mark.classList.add("is-drawing");
    setTimeout(function () { mark.classList.remove("is-drawing"); }, 5200);
  } catch (e) {}
});

/* ---- Shift-click the mark to ask for the entry screen --------------------
   The entry screen shows on a FIRST visit only (table-gate.js remembers in
   localStorage), so an ordinary click on the mark goes where it says it goes:
   the table. Shift + left click is the deliberate way back to the pitch screen -
   it sets a one-shot request the gate honours on arrival.
   preventDefault is required: shift-click natively means "open in a new window",
   which would strand the request flag in a second tab. */
document.addEventListener("click", function (ev) {
  try {
    if (!ev.shiftKey || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    var hit = t.closest(".oa-mark, .oa-crumb-home");
    if (!hit) return;
    ev.preventDefault();
    sessionStorage.setItem("oa-gate-request", "1");
    var a = hit.closest('a[href]') || (hit.matches && hit.matches('a[href]') ? hit : null);
    var href = a ? a.getAttribute('href') : 'index.html';
    if (!href || href.charAt(0) === '#') href = 'index.html';
    // Always land on a bare front page: a ?q= filter carried along would take
    // priority over the gate on the other side.
    location.href = new URL(href, location.href).pathname;
  } catch (e) {}
}, true);

/* ---- Uncaught errors: remember, say so once, offer the details -----------
   Nothing leaves the browser (see rechtliches.html). The last 20 uncaught
   errors and promise rejections are kept on window.OAErrorLog, and resource
   load failures (a data script, a stylesheet) are logged without a toast -
   the loaders that own them show their own retry. The first script error
   after boot shows one quiet toast with "Copy details": URL, build
   (version.json), browser and the errors - what a useful bug report needs.
   Cross-origin "Script error." and ResizeObserver loop notices are noise. */
(function () {
  try {
    var log = [], MAX = 20, shown = false;
    window.OAErrorLog = log;
    function record(kind, message, source, stack, quiet) {
      message = String(message == null ? "" : message);
      if (!message || /^Script error\.?$/.test(message) || /ResizeObserver loop/.test(message)) return;
      log.push({ at: new Date().toISOString(), kind: kind, message: message.slice(0, 500),
        source: String(source || "").slice(0, 300), stack: String(stack || "").slice(0, 1500) });
      if (log.length > MAX) log.shift();
      if (quiet || shown) return;
      shown = true;
      if (document.body) show(); else addEventListener("DOMContentLoaded", show);
    }
    function build() {
      var root = window.OA_REL_ROOT || "";
      return fetch(root + "version.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function details() {
      return build().then(function (v) {
        var head = ["3dcp.fyi diagnostics", "URL: " + location.href,
          "Build: " + (v && v.version || "unknown") + (v && v.built ? " (" + v.built + ")" : ""),
          "Browser: " + navigator.userAgent, "Viewport: " + innerWidth + "x" + innerHeight,
          "Time: " + new Date().toISOString(), ""];
        var body = log.map(function (e) {
          return "[" + e.at + "] " + e.kind + ": " + e.message + (e.source ? "\n  at " + e.source : "") + (e.stack ? "\n" + e.stack : "");
        });
        return head.concat(body.length ? body : ["(no errors recorded)"]).join("\n");
      });
    }
    // Clipboard API first; the textarea path also when the API is there but
    // blocked (embedded hosts: a sandboxed iframe rejects writeText).
    function legacyCopy(text) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
    function copy(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
      } catch (e) { /* restricted hosts can throw synchronously */ }
      return Promise.resolve(legacyCopy(text));
    }
    function show() {
      notice({
        id: "oa-err-toast",
        text: "Something went wrong on this page. If it keeps happening, the details help us fix it.",
        action: "Copy details",
        onAction: function (btn) { details().then(copy).then(function (ok) { btn.textContent = ok ? "Copied" : "Copy failed"; }); }
      });
    }
    // One quiet notice: bottom-left, a sentence, one action, dismiss. Shared
    // with the service-worker update notice below (window.OANotice).
    function notice(opts) {
      if (document.getElementById(opts.id)) return;
      var box = document.createElement("div");
      box.id = opts.id;
      box.setAttribute("role", "status");
      box.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:10000;max-width:min(420px,calc(100vw - 32px));display:flex;align-items:center;gap:10px;padding:10px 12px;" +
        "font:13px/1.4 var(--sans,system-ui,sans-serif);color:var(--ink,#e6e8ec);background:var(--paper,#161a20);border:1px solid var(--line-strong,#3a3f47);border-radius:var(--radius-control,4px);box-shadow:0 6px 24px rgba(0,0,0,.25)";
      var txt = document.createElement("span");
      txt.style.cssText = "flex:1 1 auto;min-width:0";
      txt.textContent = opts.text;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opts.action;
      btn.style.cssText = "flex:0 0 auto;white-space:nowrap;font:inherit;font-weight:600;color:inherit;background:transparent;border:1px solid currentColor;border-radius:var(--radius-control,4px);padding:5px 9px;cursor:pointer";
      btn.addEventListener("click", function () { opts.onAction(btn, box); });
      var x = document.createElement("button");
      x.type = "button";
      x.setAttribute("aria-label", "Dismiss");
      x.textContent = "\u00d7";
      x.style.cssText = "flex:0 0 auto;font:18px/1 var(--sans,system-ui,sans-serif);color:inherit;background:transparent;border:0;padding:2px 4px;cursor:pointer;opacity:.7";
      x.addEventListener("click", function () { box.remove(); });
      box.appendChild(txt); box.appendChild(btn); box.appendChild(x);
      document.body.appendChild(box);
    }
    window.OANotice = function (opts) { if (document.body) notice(opts); else addEventListener("DOMContentLoaded", function () { notice(opts); }); };
    addEventListener("error", function (ev) {
      if (!ev) return;
      // Capture phase: a failed <script>/<link>/<img> arrives here as a plain
      // Event on the element (no message), not as an ErrorEvent on window.
      if (ev.target && ev.target !== window && !(typeof ErrorEvent === "function" && ev instanceof ErrorEvent)) {
        var t = ev.target, url = t && (t.src || t.href);
        if (url) record("resource", "Failed to load " + url, "", "", true);
        return;
      }
      record("error", ev.message, (ev.filename || "") + (ev.lineno ? ":" + ev.lineno + (ev.colno ? ":" + ev.colno : "") : ""), ev.error && ev.error.stack);
    }, true);
    addEventListener("unhandledrejection", function (ev) {
      var r = ev && ev.reason;
      record("unhandledrejection", r && r.message || r, "", r && r.stack);
    });
  } catch (e) {}
})();

/* ---- Service worker (sw.js): the shell from cache on return visits ------
   Production hosts only - the CNAME host and GitHub Pages' own - so forks,
   previews and serve.py never cache a file they are editing. Registered once
   the page has loaded AND its dataset (window.OADataLoad, where the page has
   one) has landed, then on an idle beat: installing precaches ~80 files, and
   on a first visit that download would otherwise share the connection with
   the data. When the worker finds a newer deploy during its background
   check, the page shows one quiet notice; the reader reloads when it suits
   them. */
(function () {
  try {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    if (!/(^|\.)3dcp\.fyi$|\.github\.io$/.test(location.hostname)) return;
    var root = window.OA_REL_ROOT || "";
    var register = function () {
      navigator.serviceWorker.register(root + "sw.js").catch(function () { /* no offline shell; the site works as before */ });
    };
    addEventListener("load", function () {
      Promise.resolve(window.OADataLoad).catch(function () {}).then(function () {
        if (typeof requestIdleCallback === "function") requestIdleCallback(register, { timeout: 10000 });
        else setTimeout(register, 2000);
      });
    });
    var told = false;
    navigator.serviceWorker.addEventListener("message", function (ev) {
      if (told || !ev.data || ev.data.type !== "oa-shell-updated" || !window.OANotice) return;
      told = true;
      window.OANotice({
        id: "oa-update-toast",
        text: "A newer version of 3dcp.fyi is ready.",
        action: "Reload",
        onAction: function () { location.reload(); }
      });
    });
  } catch (e) {}
})();
