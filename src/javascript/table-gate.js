/* Entry screen -> table. The gate is an overlay, so "showing the table" is just
   removing it; nothing needs re-measuring. Keeps #articles-app out of the tab
   order and the accessibility tree until then (inert + aria-hidden). The site
   header is hidden while gated too: the entry screen carries its own title,
   credit and CTA, so a breadcrumb + toolbar above it is chrome for a page the
   reader hasn't entered yet.
   The gate is for a FIRST VISIT only: once entered it is remembered in
   localStorage, so every later visit - this session or next month - opens
   straight on the table. Deep links (a shared ?q= filter, a ?favs= reading list
   ending in #favorites) skip it too: a pitch screen must never stand between a
   shared link and the thing that was shared. Shift + left click on the mark asks
   for it back (oa-boot.js sets oa-gate-request), and that ask outranks both.
   Loaded deferred after the search loader. OAEntry decides whether to show
   the gate before optional chart modules are requested.
   The first entry BY HAND also starts the guided tour (browser-tour.js), once
   the table has rows; the tour remembers itself in localStorage
   ("oa-tour-done"). A gate asked back by Shift + click on the mark replays it
   regardless (OAEntry.asked), as does the Settings panel's "Show the tour"
   button (grid-shell.js). All paths load the module through OATourStart
   below, so it is fetched once and never on a plain return visit. */
(function () {
  function loadTour() {
    if (window.OATour) return Promise.resolve();
    return window.OAAssets.loadScript(window.OAAssets.url("src/javascript/browser-tour.js"));
  }
  function startTour() {
    return loadTour().then(function () { if (window.OATour) window.OATour.start(); }).catch(function () { /* the table works without the tour */ });
  }
  window.OATourStart = startTour;
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("#ssTour") : null;
    if (!b) return;
    window.OATheme.closePopovers();
    startTour();
  });
})();
(function () {
  var gate = document.getElementById('tableGate');
  var btn = document.getElementById('tableGateEnter');
  var app = document.getElementById('articles-app');
  var bar = document.querySelector('.oa-root > .oa-top');
  if (!gate || !btn || !app) return;
  var skip = document.querySelector('.oa-skip');
  // The gate was asked back (Shift + click on the mark, or the 404 page):
  // whoever asks for the entry screen again gets the tour with it, seen or not.
  var replay = window.OAEntry.asked;
  function enter(auto) {
    window.OAGateEntered = true;
    gate.remove();
    window.OALoadSearch().catch(function () {});   // start the search engine now, not before
    if (bar) bar.hidden = false;
    // The header mark has been hidden with the bar until now, so its load-time
    // draw was never seen - run it as the table appears instead.
    var hm = bar && bar.querySelector('.oa-mark');
    if (hm) { hm.classList.add('is-drawing'); setTimeout(function () { hm.classList.remove('is-drawing'); }, 5200); }
    app.removeAttribute('inert');
    app.removeAttribute('aria-hidden');
    if (skip) skip.href = '#articles-app';
    window.OAPrefs.set("oa-gate-seen", "1");
    if (!auto) {
      // Hand focus to the search field so the keyboard path continues where the
      // click left off, rather than resetting to the top of the document.
      var search = app.querySelector('input[type="search"], .search-input, input[name="q"]');
      if (search) search.focus({ preventScroll: true });
      if (replay || window.OAPrefs.get("oa-tour-done") !== "1") whenRows(function () {
        // A reader already typing is not interrupted; the tour waits for a
        // later visit (it is not marked seen) or the Settings button.
        setTimeout(function () { if (!(search && search.value)) window.OATourStart(); }, 600);
      });
    }
  }
  // The grid signals its build (data-grid-ready="1"); the rows follow in the
  // same pass. Polled, not observed: one cheap check every 120ms for at most
  // 15s - a data error shows its own retry and the tour simply stays away.
  function whenRows(cb) {
    var t0 = Date.now();
    (function tick() {
      if (app.dataset.gridReady === "1" && app.querySelector("#myGrid .slick-row .abstract-toggle")) return cb();
      if (Date.now() - t0 < 15000) setTimeout(tick, 120);
    })();
  }
  if (!window.OAEntry.showGate) { enter(true); return; }
  // The reader already pressed Browse while the data scripts were still
  // loading (index.html's inline handler recorded it): honour it now.
  if (window.OAGateEnterRequested) { enter(false); return; }
  // Only the entry screen needs D3 and the headline charts. Check the host
  // between stages so entering immediately does not load unused chart code.
  // The numbers and the charts read data/summary.json (~5 KB, written at
  // deploy by build_summary.mjs from the same article-store code); a checkout
  // without it falls back to the dataset itself (a failed load leaves the pitch
  // without charts; the entry action still works).
  var assets = window.OAAssets;
  var dataReady = fetch(assets.url("data/summary.json")).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (s) {
    if (!s || !s.summary) throw new Error("no summary");
    window.OA_SUMMARY = s;
  }).catch(function () {
    if (window.OADataLoadStart) window.OADataLoadStart();
    return Promise.resolve(window.OADataLoad);
  });
  // The statistics sentence and the publication month need no chart code:
  // fill them the moment the figures land, not after D3 and the chart code
  // have also been fetched.
  dataReady.then(function () {
    if (!gate.isConnected) return;
    return assets.loadScript(assets.url("src/javascript/landing.js"));
  }).catch(function () { /* The pitch keeps its placeholders. */ });
  dataReady.then(function () {
    if (!gate.isConnected) return;
    return assets.loadScript(assets.url("src/vendor/d3.v7.min.js"));
  }).then(function () {
    if (!gate.isConnected) return;
    return assets.loadScript(assets.url("src/javascript/influence.js")).then(function () {
      if (!gate.isConnected) return;
      return assets.loadScript(assets.url("src/javascript/cumulative-charts.js"));
    });
  }).catch(function () { /* The entry action remains usable without charts. */ });
  if (bar) bar.hidden = true;
  app.setAttribute('inert', '');
  app.setAttribute('aria-hidden', 'true');
  // While gated, "skip to main content" must land on the gate - #articles-app is inert.
  if (skip) skip.href = '#tableGate';
  btn.focus({ preventScroll: true });
  btn.addEventListener('click', function () { enter(false); });
})();
// Safety net: if the gate never ran (its elements missing on some page variant)
// nothing would ever ask for the search module.
setTimeout(function () { if (!document.getElementById('tableGate')) window.OALoadSearch().catch(function () {}); }, 1500);
