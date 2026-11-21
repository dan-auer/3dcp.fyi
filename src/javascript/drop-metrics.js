/* drop-metrics.js - graph metrics in the table's abstract drop.
 * While an ID IS filter names an article, its citation-network small
 * multiples (influence.js) show in the page's right-margin panel (panel()),
 * like an author's metrics - or, where the panel has no room, below the
 * abstract in its open drop, in two columns. Toggling the panel off hides
 * them; they do not move to the drop.
 * The host decides where (articles-grid.js syncAuthorPanel and
 * oa-abstract-rows.js config.renderAfter); this
 * module owns the section. Chart code and data - d3, data/metric_data.js
 * (~13 MB), influence.js - load on the first such drop.
 *
 * SlickGrid rebuilds a drop's markup on every render, so the markup carries
 * fixed-height slots (the drop's row reservation is measured off them) and the
 * live SVGs, built once per article, are moved into the fresh slots after each
 * render (mount).
 */
(function () {
  "use strict";

  var state = "idle";          // idle -> loading -> ready | failed
  var scaleMode = "linear";
  var charts = new Map();      // article id -> OAInfluence chart, or null (no series)
  var listeners = [];
  var lastRoot = null;

  var esc = window.OATheme.escapeHtml;

  function load() {
    if (state !== "idle") return;
    state = "loading";
    var A = window.OAAssets;
    (window.d3 ? Promise.resolve() : A.loadScript(A.url("src/vendor/d3.v7.min.js"))).then(function () {
      // The 13 MB metrics file is parsed off the main thread where data-load.js
      // is on the page (window.OAData); evaluated as a script otherwise.
      return Promise.all([
        window.METRIC_DATA ? null : window.OAData ? window.OAData.load("data/metric_data.js", "METRIC_DATA") : A.loadScript(A.url("data/metric_data.js")),
        window.OAInfluence ? null : A.loadScript(A.url("src/javascript/influence.js"))
      ]);
    }).then(function () {
      state = window.OAInfluence && window.METRIC_DATA ? "ready" : "failed";
    }, function () {
      state = "failed";
    }).then(function () {
      listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    });
  }

  // One filtered article at a time: a new one retires the previous chart.
  function chartFor(item) {
    if (charts.has(item.id)) return charts.get(item.id);
    charts.forEach(function (chart) { if (chart) chart.destroy(); });
    charts.clear();
    var chart = window.OAInfluence.create(
      { date: item.date, influence: window.METRIC_DATA[item.id] },
      { columns: 2, scale: scaleMode, onMonth: function (month) { showMonth(item.id, month); } });
    charts.set(item.id, chart);
    return chart;
  }

  // The month every readout shows (the last one, or the hovered one), once in
  // the head row instead of under each value.
  function showMonth(id, month) {
    document.querySelectorAll(".abs-inf-month").forEach(function (el) {
      if (el.getAttribute("data-inf-id") === id) el.textContent = month;
    });
  }

  // One LIN/LOG toggle: the lit half is the scale in use, a click flips it.
  // Its tooltip carries the scale's note (range, clamping) and the action.
  function scaleTitle(mode) {
    var note = window.OAInfluence.scaleNote(mode);
    return note.charAt(0).toUpperCase() + note.slice(1) + " \u00b7 " + (mode === "log" ? "Switch to linear scale" : "Switch to log scale");
  }
  function scaleToggle() {
    var log = scaleMode === "log";
    return '<button type="button" class="abs-inf-scale" data-inf-scale-toggle aria-pressed="' + log +
      '" aria-label="Logarithmic scale" title="' + esc(scaleTitle(scaleMode)) + '">' +
      // The glyph shows the scale in use: a straight line (linear), a curve (log).
      '<svg class="sc-lin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M16 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7.5 16.5l9 -9"></path></svg>' +
      '<svg class="sc-log" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M17 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2"></path><path d="M3 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2"></path><path d="M17 5c-6.627 0 -12 5.373 -12 12"></path></svg>' +
      "</button>";
  }
  function section(tools, body) {
    return '<section class="abs-inf" aria-label="Graph metrics"><div class="abs-sec-headrow"><div class="abs-sec-head">Centralities</div>' +
      tools + "</div>" + body + "</section>";
  }
  function message(text) { return section("", '<p class="abs-inf-msg">' + text + "</p>"); }

  // The same section in the page's right margin (articles-grid.js
  // syncAuthorPanel), in the author panel's layout: the head carries the
  // month, the scale toggle and its note sit under it, then the plots. The
  // live SVGs move in here; mount() moves them back if the drop shows them.
  function panel(host) {
    var shownId = "";
    function msg(text) {
      shownId = "";
      host.innerHTML = '<section class="ap-sec abs-inf" aria-label="Graph metrics"><h2 class="ap-h">Centralities</h2><p class="ap-msg">' + esc(text) + "</p></section>";
    }
    function show(item) {
      if (!item || !item.id) return;
      load();
      if (state === "loading") return msg("Loading graph metrics\u2026");
      if (state === "failed") return msg("Graph metrics could not be loaded.");
      var chart = chartFor(item);
      if (!chart) return msg("No graph metrics for this article.");
      if (shownId !== item.id || !host.contains(chart.node(0))) {
        shownId = item.id;
        host.innerHTML = '<section class="ap-sec abs-inf" aria-label="Graph metrics">' +
          '<h2 class="ap-h"><span class="ap-h-lead">Centralities' + scaleToggle() + '</span><span class="ap-h-aside abs-inf-month" data-inf-id="' + esc(item.id) + '" title="Month of the values shown">' + esc(chart.lastMonth) + "</span></h2>" +
          '<div class="ap-inf-cols"></div></section>';
        var cols = host.querySelector(".ap-inf-cols");
        for (var c = 0; c < chart.columnCount; c += 1) {
          var slot = document.createElement("div");
          slot.className = "ap-inf-slot";
          slot.style.height = chart.columnHeight(c) + "px";
          slot.appendChild(chart.node(c));
          cols.appendChild(slot);
        }
      }
      requestAnimationFrame(function () { chart.fit(); });
    }
    return { show: show, destroy: function () { shownId = ""; host.innerHTML = ""; } };
  }

  // Drop markup for `item` - the article an ID IS filter names.
  function sectionHtml(item) {
    if (!item || !item.id) return "";
    load();
    if (state === "loading") return message("Loading graph metrics\u2026");
    if (state === "failed") return message("Graph metrics could not be loaded.");
    var chart = chartFor(item);
    if (!chart) return message("No graph metrics for this article.");
    var slots = "";
    for (var c = 0; c < chart.columnCount; c += 1) {
      slots += '<div class="abs-inf-slot" data-inf-id="' + esc(item.id) + '" data-inf-col="' + c +
        '" style="height:' + chart.columnHeight(c) + 'px"></div>';
    }
    return section(
      scaleToggle() +
      '<span class="abs-inf-month" data-inf-id="' + esc(item.id) + '" title="Month of the values shown">' + esc(chart.lastMonth) + "</span>" +
      '<span class="abs-inf-scalenote">' + esc(window.OAInfluence.scaleNote(scaleMode)) + "</span>",
      '<div class="abs-inf-cols">' + slots + "</div>");
  }

  // After a grid render: move each article's live SVGs into its fresh slots,
  // then draw them at the slots' width. A second drop of the same article
  // (category grouping lists it once per category) gets a static copy.
  // A panel on screen keeps them: right after the panel takes the charts, a
  // grid render can still pass the drop's previous markup, slots and all -
  // moving the SVGs in there lost them once that markup was replaced.
  function heldByPanel(svg) {
    var p = svg.parentNode;
    return !!(p && p.classList && p.classList.contains("ap-inf-slot") && p.isConnected && p.getClientRects().length);
  }
  function mount(root) {
    if (state !== "ready" || !root) return;
    lastRoot = root;
    var slots = root.querySelectorAll(".slick-viewport .abs-inf-slot[data-inf-id]");
    if (!slots.length) return;
    var seen = new Set(), copies = [];
    for (var i = 0; i < slots.length; i += 1) {
      var slot = slots[i], id = slot.getAttribute("data-inf-id");
      var chart = charts.get(id);
      if (!chart) continue;
      var col = +slot.getAttribute("data-inf-col") || 0, key = id + "\u0001" + col;
      if (seen.has(key)) { copies.push([slot, chart, col]); continue; }
      seen.add(key);
      var svg = chart.node(col);
      if (heldByPanel(svg)) continue;
      if (svg.parentNode !== slot) { slot.textContent = ""; slot.appendChild(svg); }
    }
    charts.forEach(function (chart) { if (chart) chart.fit(); });
    copies.forEach(function (c) {
      c[0].textContent = "";
      c[0].appendChild(c[1].node(c[2]).cloneNode(true));
    });
  }

  function setScale(mode) {
    mode = mode === "log" ? "log" : "linear";
    if (mode === scaleMode) return;
    scaleMode = mode;
    charts.forEach(function (chart) { if (chart) chart.setScale(mode); });
    var log = mode === "log";
    document.querySelectorAll(".abs-inf [data-inf-scale-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(log));
      b.title = scaleTitle(mode);
    });
    document.querySelectorAll(".abs-inf .abs-inf-scalenote").forEach(function (n) {
      n.textContent = window.OAInfluence.scaleNote(mode);
    });
    if (lastRoot) mount(lastRoot);   // refresh the static copies
  }
  // Delegated: the drop's markup is regenerated on every grid render.
  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest(".abs-inf [data-inf-scale-toggle]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    setScale(scaleMode === "log" ? "linear" : "log");
  });

  window.OADropMetrics = Object.freeze({
    sectionHtml: sectionHtml,
    mount: mount,
    // panel(host) -> { show(item), destroy() }: the section in the right margin.
    panel: panel,
    // The chart code and data (~13 MB), fetched ahead of the first such
    // article - the guided tour asks while the reader is still on its early
    // stops, so its Centralities stop does not wait for the download.
    preload: load,
    // Inputs of the section's markup beyond the article: the host keys its
    // memoised drop HTML on this.
    sig: function () { return state + ":" + scaleMode; },
    // fn() once the chart code and data have loaded (or failed to).
    onChange: function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }
  });
})();
