/* header-actions.js - the site header's action row, once the article browser
   has moved its buttons there (articles-grid.js moveLeadButtons /
   setupFavorites / wireSearchSettings), and the settings panel's tabs.

   Why a separate file: eight unlabeled icon squares carried the whole feature
   set, in an order that followed the code rather than the reader. This module
   owns the reader-facing arrangement and nothing else:

   - Groups by intent, with thin separators:
       View        hide abstracts · metrics panel · settings
       List        favorites · BibTeX · open all
       Contribute  suggest a paper
       Site        day/night · legal
   - Labels: at >= 1200px the List and View buttons show their word next to
     the glyph (articles.css); below that the glyphs stay and a "More" button
     at the row's end opens a menu of every header action WITH its label -
     the path touch devices need, since they never see a title tooltip.
     Items proxy the real buttons (click, disabled, pressed state), so no
     action logic is duplicated here.
   - Settings tabs: Search / Appearance / Reader (grid-shell.js markup); the
     last tab is remembered.

   Idempotent: it re-runs whenever the header row's children change, so it
   does not care whether it loaded before or after the grid mounted. */
(function () {
  "use strict";
  var TAB_KEY = "oa-settings-tab";

  function toprow() { return document.querySelector(".oa-root > .oa-top .oa-toprow"); }

  /* ---- Arrangement ------------------------------------------------------ */
  function sep() {
    var s = document.createElement("span");
    s.className = "oa-top-sep";
    s.setAttribute("aria-hidden", "true");
    return s;
  }
  var SEP = {};   // marker in the desired-order list
  function arrange() {
    var row = toprow();
    if (!row) return;
    var heads = row.querySelectorAll(".oa-tb-head");
    var lead = heads[0] || null, list = heads[1] || null;
    var settings = row.querySelector(".oa-settings-btn");
    var openAll = row.querySelector("#openAll");
    // Open all travels as its split (action + route menu), like Favorites.
    openAll = openAll && (openAll.closest(".open-split") || openAll);
    var add = row.querySelector(".oa-add-btn");
    var scheme = row.querySelector(".oa-scheme-btn");
    var mounted = !!(lead && list);
    more(row, mounted);
    // "Open all" acts on the list like favorites and BibTeX do: move it over
    // (inside a wrapper, so the row observer does not see it; the wrapper is
    // removed with the grid either way).
    if (mounted && openAll && openAll.parentElement !== list) list.appendChild(openAll);
    // Desired order: View | List | Contribute | Site … More. Anything this
    // module does not know about keeps its relative place among the rest.
    var desired = [];
    var placed = new Set();
    if (mounted) {
      desired.push(lead); placed.add(lead);
      if (settings) { desired.push(settings); placed.add(settings); }
      desired.push(SEP, list); placed.add(list);
      if (add) { desired.push(SEP, add); placed.add(add); }
      if (add && scheme) desired.push(SEP);
    }
    Array.prototype.forEach.call(row.children, function (c) {
      if (placed.has(c) || c === moreWrap || c.classList.contains("oa-top-sep")) return;
      desired.push(c);
    });
    if (moreWrap) desired.push(moreWrap);
    // Already in place? Then touch nothing - the childList observer that
    // calls arrange() would otherwise see our own change and call it again.
    var current = Array.prototype.map.call(row.children, function (c) { return c.classList.contains("oa-top-sep") ? SEP : c; });
    var same = current.length === desired.length && current.every(function (c, i) { return c === desired[i]; });
    if (same) return;
    row.querySelectorAll(".oa-top-sep").forEach(function (s) { s.remove(); });
    desired.forEach(function (d) { row.appendChild(d === SEP ? sep() : d); });
  }

  /* ---- "More" menu ------------------------------------------------------ */
  var moreWrap = null, moreBtn = null, moreMenu = null, release = null;
  function labelOf(btn) {
    var l = btn.querySelector(".tb-label");
    var t = (l && l.textContent.trim()) || btn.getAttribute("aria-label") || btn.getAttribute("title") || "";
    return t.split("\n")[0].trim();
  }
  function actions(row) {
    var out = [];
    row.querySelectorAll("button, a").forEach(function (el) {
      if (el === moreBtn || el.closest(".oa-top-more") || el.hidden) return;
      if (el.classList.contains("fav-menu-btn") || el.classList.contains("open-menu-btn") || el.closest(".fav-menu")) return;
      var label = labelOf(el);
      if (!label) return;
      out.push({ el: el, label: label });
    });
    return out;
  }
  function closeMore() {
    if (!moreMenu || moreMenu.hidden) return;
    moreMenu.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
    if (release) { release(); release = null; }
  }
  function openMore(row) {
    var items = actions(row);
    moreMenu.innerHTML = "";
    items.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.className = "oa-top-more-item";
      b.disabled = !!a.el.disabled;
      var pressed = a.el.getAttribute("aria-pressed");
      if (pressed != null) b.setAttribute("aria-checked", pressed), b.setAttribute("role", "menuitemcheckbox");
      var icon = a.el.querySelector("svg");
      // The scheme button ships one glyph per destination: take the one on show.
      if (a.el.classList.contains("oa-scheme-btn")) {
        icon = Array.prototype.find.call(a.el.querySelectorAll("svg"), function (s) { return getComputedStyle(s).display !== "none"; }) || icon;
      }
      if (icon) {
        var ic = icon.cloneNode(true);
        ic.removeAttribute("class");
        ic.setAttribute("width", "16"); ic.setAttribute("height", "16");
        b.appendChild(ic);
      }
      var t = document.createElement("span");
      t.textContent = a.label;
      b.appendChild(t);
      b.addEventListener("click", function () {
        closeMore();
        a.el.click();
      });
      moreMenu.appendChild(b);
    });
    moreMenu.hidden = false;
    moreBtn.setAttribute("aria-expanded", "true");
    release = window.OATheme.popover("header-more", closeMore);
    var first = moreMenu.querySelector("button:not([disabled])");
    if (first) first.focus();
  }
  function more(row, mounted) {
    if (!moreWrap) {
      moreWrap = document.createElement("div");
      moreWrap.className = "oa-top-more";
      moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "oa-top-more-btn";
      moreBtn.setAttribute("aria-haspopup", "menu");
      moreBtn.setAttribute("aria-expanded", "false");
      moreBtn.setAttribute("aria-label", "All actions");
      moreBtn.title = "All actions";
      moreBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>';
      moreMenu = document.createElement("div");
      moreMenu.className = "oa-top-more-menu";
      moreMenu.setAttribute("role", "menu");
      moreMenu.setAttribute("aria-label", "All actions");
      moreMenu.hidden = true;
      moreWrap.appendChild(moreBtn); moreWrap.appendChild(moreMenu);
      moreBtn.addEventListener("click", function () { if (moreMenu.hidden) openMore(row); else closeMore(); });
      moreMenu.addEventListener("keydown", function (ev) {
        var items = Array.prototype.filter.call(moreMenu.querySelectorAll("button"), function (b) { return !b.disabled; });
        var i = items.indexOf(document.activeElement);
        if (ev.key === "ArrowDown") { ev.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
        // stopPropagation: the grid's own Escape would also clear the row
        // selection or collapse every open abstract.
        else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); closeMore(); moreBtn.focus(); }
      });
      document.addEventListener("pointerdown", function (ev) { if (!moreMenu.hidden && !moreWrap.contains(ev.target)) closeMore(); }, true);
    }
    // Only while the browser is up: the entry screen's header has three
    // self-explanatory controls and no table actions to list.
    moreWrap.hidden = !mounted;
    if (moreWrap.parentElement !== row) row.appendChild(moreWrap);
  }

  /* ---- Settings tabs ---------------------------------------------------- */
  // The footer's reset acts on the open tab only (articles-grid.js) and says so.
  var RESET_LABELS = { search: "Reset search", look: "Reset appearance", read: "Reset reader" };
  function selectTab(panel, id, focus) {
    var tabs = panel.querySelectorAll(".ss-tab");
    if (!Array.prototype.some.call(tabs, function (t) { return t.dataset.tab === id; })) id = tabs[0] && tabs[0].dataset.tab;
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panel.querySelectorAll(".ss-pane").forEach(function (p) { p.hidden = p.dataset.tab !== id; });
    var reset = panel.querySelector("#ssReset");
    if (reset && RESET_LABELS[id]) reset.textContent = RESET_LABELS[id];
    window.OAPrefs.set(TAB_KEY, id);
  }
  function wireTabs() {
    var panel = document.getElementById("searchSettingsPanel");
    if (!panel || panel.dataset.tabsWired || !panel.querySelector(".ss-tabs")) return;
    panel.dataset.tabsWired = "1";
    selectTab(panel, window.OAPrefs.get(TAB_KEY) || "search", false);
    panel.addEventListener("click", function (ev) {
      var t = ev.target.closest(".ss-tab");
      if (t) selectTab(panel, t.dataset.tab, false);
    });
    panel.addEventListener("keydown", function (ev) {
      var t = ev.target.closest(".ss-tab");
      if (!t) return;
      var tabs = Array.prototype.slice.call(panel.querySelectorAll(".ss-tab"));
      var i = tabs.indexOf(t);
      if (ev.key === "ArrowRight") { ev.preventDefault(); selectTab(panel, tabs[(i + 1) % tabs.length].dataset.tab, true); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); selectTab(panel, tabs[(i - 1 + tabs.length) % tabs.length].dataset.tab, true); }
      else if (ev.key === "Home") { ev.preventDefault(); selectTab(panel, tabs[0].dataset.tab, true); }
      else if (ev.key === "End") { ev.preventDefault(); selectTab(panel, tabs[tabs.length - 1].dataset.tab, true); }
    });
  }

  /* ---- Run now and whenever the header or the app host changes --------- */
  function run() { arrange(); wireTabs(); }
  function start() {
    run();
    var row = toprow();
    if (row) {
      // arrange() is a no-op once the row is in order, so its own mutations
      // end the cycle after one extra callback. Should that invariant ever
      // break, the burst guard disconnects instead of freezing the page.
      var burst = 0, burstTimer = 0;
      var observer = new MutationObserver(function () {
        burst += 1;
        if (!burstTimer) burstTimer = setTimeout(function () { burst = 0; burstTimer = 0; }, 250);
        if (burst > 20) { observer.disconnect(); console.warn("[header-actions] rearrangement feedback loop - observer disconnected"); return; }
        run();
      });
      observer.observe(row, { childList: true });
    }
    var app = document.getElementById("articles-app");
    if (app) {
      new MutationObserver(function () { wireTabs(); }).observe(app, { childList: true });
    }
  }
  // Loaded deferred (index.html): the DOM is parsed.
  start();
})();
