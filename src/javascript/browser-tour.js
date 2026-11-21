/* browser-tour.js - a guided first look at the article browser.

   Shown once: table-gate.js loads this module after the reader's FIRST
   "Browse Articles" and starts it when the table has rows; finishing it
   (or Skip, or Esc) is remembered in localStorage ("oa-tour-done"), and the
   Settings panel's "Show the tour" button replays it on request. Nothing in
   the table depends on it: the module is lazy, and a failed load leaves the
   browser exactly as it was.

   Two tours from one welcome card: the quick one (the controls and one row)
   and the full one (every stop below; `tour` marks a stop only one of them
   takes). The welcome card is the chooser and is not counted as a stop.

   What it does: a sequence of stops, each a spotlight on one control group
   (the search field, the Filters button, a row, ...) with a short card
   beside it. The rest of the page is blurred and dimmed by four
   backdrop-filter panels tiled around the spotlight (one masked element
   would be neater, but masks over backdrop-filter still differ between
   engines) and made inert, so the card is the one thing pointer and keyboard
   reach: Tab cycles its buttons, the arrow keys step, Esc leaves.

   The middle of the tour drives the table itself, the way a reader would,
   on one demo article: the site's own paper (DEMO_ID, 3dcp.fyi itself) -
   or, should it ever leave the data, pickDemo() chooses one from the
   article store (a cited paper with in-corpus references, one of them by
   its own authors, and - where the metrics panel shows - institutions on
   record, so every stop has something real to show). bringRow() scrolls
   the list to it,
   then the tour opens its abstract (the abstract, contents, records and
   graph stops point into that drop), clicks the title to focus the list on
   it (the Centralities and Affiliations stops), follows its references tile
   (the article in focus, pinned, then its references in the list), pages
   the list to a row sharing one of its authors (the author-overlap stop),
   clicks one of its authors' names (all their works, the rule the click
   wrote, the short link in the page head, the summary under the list; with
   the panel, their metrics over time and who cites whom), opens the
   citation matrix behind one name, stars the article and lists the
   favorites (sharing and BibTeX export), and finally clears the filters,
   takes its star back and closes what it opened. Each stop names a
   `scene` - none, row, open, pin, graph, shared, author, matrix, fav -
   and ensure() moves the table there from whatever scene the previous stop
   left, in either direction, before the card updates. These stops are
   "lazy": their targets exist only once the scene is set, so they are
   probed when reached and dropped when the paper lacks the part (no
   contents, no affiliations, say). The scenes from the title on replace the
   reader's filters, so they run only when the table was clean when the tour
   began; the panel stops also need the metrics panel on screen. The tour's
   clicks add no history entries and mark no author visited (articles-grid.js
   asks OATour.isOpen()). Esc or Skip mid-scene still tidies up.

   Stops whose controls are not on screen - the metrics toggle under 1180px,
   the list actions under 900px - are left out, and so are the demo article's
   missing parts as far as the data tells (`probe`: no contents, no shared
   author), so the count the welcome card quotes is the count the reader
   gets. A part slow to paint is waited for rather than dropped. Targets are resolved afresh on every
   layout pass (resize, scroll, step change, a grid re-render): SlickGrid
   rebuilds its row DOM, so an element held from the previous pass may
   already be gone. */
(function () {
  "use strict";
  if (window.OATour) return;
  var DONE_KEY = "oa-tour-done";
  // The demo: the 3dcp.fyi paper, and its author the author stops show.
  var DEMO_ID = "auer_bos_fisc.2024.3f", DEMO_AUTHOR = "bos_freek";
  var PAD = 6, GAP = 14, EDGE = 12, DOCK_W = 600;

  var CSS = [
    ".oa-tour{position:fixed;inset:0;z-index:var(--layer-modal,300);font-family:var(--sans);animation:oa-tour-in .2s ease-out}",
    "@keyframes oa-tour-in{from{opacity:0}to{opacity:1}}",
    ".oa-tour-shade{position:absolute;background:color-mix(in srgb,var(--bg) 62%,transparent);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);transition:top .22s,left .22s,width .22s,height .22s;transition-timing-function:cubic-bezier(.2,.7,.2,1)}",
    ".oa-tour-ring{position:absolute;border:2px solid var(--accent);border-radius:var(--radius-control,3px);box-shadow:0 0 0 4px var(--accent-soft);pointer-events:none;transition:top .22s,left .22s,width .22s,height .22s;transition-timing-function:cubic-bezier(.2,.7,.2,1)}",
    ".oa-tour-ring[hidden]{display:none}",
    ".oa-tour-card{position:absolute;width:360px;max-width:calc(100vw - 24px);padding:16px 18px 14px;background:var(--paper);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius-control,3px);box-shadow:var(--shadow-float);transition:top .22s,left .22s;transition-timing-function:cubic-bezier(.2,.7,.2,1)}",
    /* The caret is a rotated square whose two visible sides point at the
       target; negative z-index paints it over the card's border but under
       its text, so the border reads as opening into the arrow. */
    ".oa-tour-caret{position:absolute;z-index:-1;width:12px;height:12px;background:var(--paper);border:1px solid transparent;transform:rotate(45deg)}",
    ".oa-tour-card[data-side=''] .oa-tour-caret{display:none}",
    ".oa-tour-card[data-side='below'] .oa-tour-caret{top:-7px;border-left-color:var(--line-strong);border-top-color:var(--line-strong)}",
    ".oa-tour-card[data-side='above'] .oa-tour-caret{bottom:-7px;border-right-color:var(--line-strong);border-bottom-color:var(--line-strong)}",
    ".oa-tour-card[data-side='right'] .oa-tour-caret{left:-7px;border-left-color:var(--line-strong);border-bottom-color:var(--line-strong)}",
    ".oa-tour-card[data-side='left'] .oa-tour-caret{right:-7px;border-top-color:var(--line-strong);border-right-color:var(--line-strong)}",
    ".oa-tour-count{display:block;margin:0 0 6px;font-family:var(--mono);font-size:var(--fs-meta);color:var(--ink-2);font-variant-numeric:tabular-nums}",
    ".oa-tour-title{margin:0 0 6px;font-family:var(--sans);font-size:var(--fs-lead);font-weight:600;line-height:1.3;color:var(--ink);letter-spacing:normal}",
    ".oa-tour-body{margin:0 0 14px;font-size:var(--fs-body);line-height:1.5;color:var(--ink-2);text-wrap:pretty;overflow-wrap:break-word}",
    ".oa-tour-body sub{line-height:0}",
    ".oa-tour-body p{margin:0 0 8px}",
    ".oa-tour-body ul+p{margin:8px 0 0}",
    ".oa-tour-body ul{margin:0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:4px}",
    ".oa-tour-body li{padding-left:2px}",
    ".oa-tour-body li::marker{color:var(--accent)}",
    ".oa-tour-body b{color:var(--ink);font-weight:600}",
    ".oa-tour-body kbd{display:inline-block;font-family:var(--mono-code);font-size:var(--fs-meta);line-height:1.5;color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,var(--paper));border:1px solid var(--line-strong);border-radius:var(--radius-control,3px);padding:0 5px;white-space:nowrap}",
    ".oa-tour-actions{display:flex;align-items:center;gap:8px}",
    ".oa-tour-btn{display:inline-flex;align-items:center;justify-content:center;height:var(--control-size,34px);padding:0 14px;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;border-radius:var(--radius-control,3px);cursor:pointer;white-space:nowrap;transition:box-shadow .12s,border-color .12s,color .12s,background .12s,opacity .12s}",
    ".oa-tour-next{color:var(--on-accent);background:var(--accent);border:1px solid var(--accent)}",
    ".oa-tour-next:hover{box-shadow:inset 0 0 0 1px currentColor}",
    /* While a stop sets its scene (opens the abstract, pins the article):
       the click is taken, the table is moving, the card follows in a moment. */
    ".oa-tour-next[aria-busy='true']{cursor:progress;opacity:.7;box-shadow:none}",
    ".oa-tour-back{color:var(--ink-2);background:transparent;border:1px solid var(--line-strong);font-weight:400}",
    ".oa-tour-back:hover{border-color:var(--accent);color:var(--accent-text)}",
    ".oa-tour-count[hidden]{display:none}",
    ".oa-tour-alt{color:var(--ink);background:transparent;border:1px solid var(--line-strong)}",
    ".oa-tour-alt:hover{border-color:var(--accent);color:var(--accent-text)}",
    /* The header stop's legend: each button's own glyph, then its name. */
    ".oa-tour-keys{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 10px;align-items:center;margin:0}",
    ".oa-tour-keys dt{display:flex}",
    ".oa-tour-keys dd{margin:0;font-size:var(--fs-meta);line-height:1.4}",
    ".oa-tour-ic{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 4px;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:var(--radius-control,3px);color:var(--ink);font-size:var(--fs-meta)}",
    ".oa-tour-ic svg{display:block;width:15px;height:15px}",
    /* The records stop's legend: tile code, then its name, two pairs a line. */
    ".oa-tour-codes{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:2px 8px;margin:8px 0 0;font-size:var(--fs-meta);line-height:1.45}",
    ".oa-tour-codes dt{font-family:var(--mono);font-weight:600;color:var(--ink)}",
    ".oa-tour-codes dd{margin:0;min-width:0}",
    ".oa-tour-skip{margin-right:auto;height:var(--control-size,34px);padding:0 2px;border:0;background:transparent;font-family:var(--sans);font-size:var(--fs-meta);color:var(--ink-2);cursor:pointer;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;text-decoration-color:color-mix(in srgb,var(--ink-2) 45%,transparent)}",
    ".oa-tour-skip:hover{color:var(--accent-text);text-decoration-color:currentColor}",
    ".oa-tour-actions [hidden]{display:none}",
    ".oa-tour-btn:focus-visible,.oa-tour-skip:focus-visible{outline:var(--focus-ring,2px solid currentColor);outline-offset:var(--focus-ring-offset,2px)}",
    "@media (any-pointer:coarse){.oa-tour-btn,.oa-tour-skip{min-height:44px}}",
    ".oa-tour-text{transition:opacity .15s}",
    /* Never taller than the window (a phone held sideways is 340px): the
       text scrolls and the buttons stay on screen. */
    ".oa-tour-card{display:flex;flex-direction:column;max-height:calc(100% - " + 2 * EDGE + "px)}",
    ".oa-tour-text{min-height:0;overflow-y:auto;overscroll-behavior:contain}",
    ".oa-tour-actions{flex:none}",
    /* Between stops: the text waits, dimmed, for its example (cover()). */
    ".oa-tour-card.is-pending .oa-tour-text{opacity:.35}",
    "@media (prefers-reduced-motion:reduce){.oa-tour,.oa-tour-shade,.oa-tour-ring,.oa-tour-card,.oa-tour-text{animation:none;transition:none}}"
  ].join("\n");

  /* The stops. `at`: selectors (or functions returning elements) whose
     on-screen boxes join into one spotlight (`all`: every match, not the
     first); `row: true` resolves them inside the demo row (none: the row
     itself); `drop: true` inside the abstract drop the tour opened; neither:
     the card sits centred over the whole blurred page. `scene` is the table
     state the stop needs (see ensure()); `ready` holds the probe until the
     part has loaded; `when` gates a stop on the context at start. `body` (and
     `title`) may be a function of the context so a stop can describe exactly
     what this window shows. Each body is a lead line plus a short list - one feature
     per bullet, no semicolons. */
  function p(text) { return "<p>" + text + "</p>"; }
  function ul(items) {
    return "<ul>" + items.filter(Boolean).map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  }
  var esc = window.OATheme.escapeHtml;
  // "a, b and c".
  function andList(items) {
    var a = items.filter(Boolean);
    return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  var num = window.OATheme.fmtNum;
  function nOf(n, one, many) { return num(n) + " " + (n === 1 ? one : many); }
  var PANEL = "#authorPanel:not([hidden]) ";
  // The Centralities: in the panel beside the table, or under the abstract
  // where the window has no room for the panel.
  var METRICS_AT = [PANEL + '[data-part="article"]:not([hidden]) .abs-inf', "#myGrid .abs-drop[data-abs-drop] .abs-inf"];
  var AFFIL_AT = PANEL + '[data-part="affil"]:not([hidden]) .ap-paff';
  var PEOPLE_AT = PANEL + '[data-part="author"]:not([hidden]) [data-ap="people"]:not([hidden])';
  var SERIES_AT = PANEL + '[data-part="author"]:not([hidden]) [data-ap="series"]:not([hidden])';
  var FOOTER_AT = "#authorFooter:not([hidden])";
  var MATRIX_AT = ".articles-app .ap-matrix[open]";
  // Per graph rule: the tile's name, what the list then holds, the title of
  // the stop on that list.
  var RULE_WORDS = {
    REFERENCES_OF: ["references", "the articles this one cites", "Its references"],
    CITATIONS_OF: ["citations", "the articles citing this one", "Its citations"],
    SIMILAR_TO: ["similar", "the articles similar to this one", "Similar articles"]
  };
  function clean(c) { return c.clean; }
  function panelled(c) { return c.clean && c.panel; }
  function authorPanelled(c) { return panelled(c) && !!window.OAAuthorPanel; }
  // The first author stop's lead: what the tour clicked.
  function clickedAuthor(c) {
    return (c.author ? "The name " + c.author : "An author's name") + " was clicked for you: the list now holds their works";
  }
  // What a scene change is doing, shown in the count line when it takes a
  // moment (the metric data's first download, a jump down the list).
  // The header's controls, each with its own glyph and what it does - read
  // from the buttons on screen, so the legend matches this window.
  var HEADER_KEYS = [
    ["#collapseAbstracts", "Hide abstracts", "closes every open abstract at once"],
    ["#panelToggle", "Metrics panel", "shows or hides the centralities, affiliations, author metrics and topic trends beside the table"],
    ["#searchSettings", "Settings", "typo tolerance, theme, abstract layout, reference style and the reading voice"],
    [".fav-filter-btn", "Favorites", "only your starred articles, with their count"],
    ["#favMenuBtn", "Favorites menu", "a share link for them, or removing them all"],
    ["#exportResults", "BibTeX", "the listed articles as one .bib file"],
    [".open-all-btn", "Open all", "each listed article in a new tab"],
    [".open-menu-btn", "Open all via", "DOI, publisher or Scholar, your pick"],
    [".oa-add-btn", "Suggest a paper", "an email to the curators, ready to fill in"],
    [".oa-kiosk-btn", "Kiosk mode", "the listed abstracts read aloud, full screen, one after another"],
    [".oa-scheme-btn", "Theme", "mint, dark and light in turn. Its tooltip names the next one"],
    [".oa-top-more-btn", "All actions", "every action up here, by name"]
  ];
  function headerKeys() {
    var rows = HEADER_KEYS.map(function (k) {
      var el = document.querySelector(".oa-top " + k[0]);
      if (!el || !visible(el)) return "";
      var svg = el.querySelector("svg");
      // A labelled button (Favorites) has no glyph to show: its name is enough.
      return "<dt>" + (svg ? '<span class="oa-tour-ic" aria-hidden="true">' + svg.outerHTML + "</span>" : "") + "</dt>" +
        "<dd><b>" + k[1] + "</b>: " + k[2] + "</dd>";
    }).join("");
    return rows ? '<dl class="oa-tour-keys">' + rows + "</dl>" : "";
  }
  // The record tiles' codes with their names, as this article has them.
  function tileCodes(drop) {
    if (!drop) return "";
    var out = [], seen = {};
    Array.prototype.forEach.call(drop.querySelectorAll(".abs-ext-groups a.oa-index"), function (a) {
      var code = String(a.textContent || "").trim(), name = a.getAttribute("title") || "";
      if (!code || !name || seen[code]) return;
      seen[code] = 1;
      out.push("<dt>" + esc(code) + "</dt><dd>" + esc(name) + "</dd>");
    });
    return out.length ? '<dl class="oa-tour-codes">' + out.join("") + "</dl>" : "";
  }
  // Probes for the stops whose part depends on the demo article, run when the
  // tours are counted: false only when the data says the part is missing
  // (data not in yet: the stop is probed on arrival, as before).
  function demoArticle() {
    try { var S = window.OAArticleStore, store = S && S.get ? S.get() : null; return store && demo.id ? store.getById(demo.id) : null; }
    catch (e) { return null; }
  }
  function hasToc() { var t = window.TOC_DATA; return !t || !demo.id || !!(t[demo.id] && t[demo.id].length); }
  function hasShared() {
    var S = window.OAArticleStore, store = null, art = demoArticle();
    try { store = S && S.get ? S.get() : null; } catch (e) { return true; }
    var n = store && store.neighbourCounts ? store.neighbourCounts(demo.id) : null;
    // The graph scene follows the references when there are any; another
    // tile is probed on arrival.
    if (!art || !n || !n.references || !store.referencesOf || !S.authorIdOf) return true;
    var key = function (a) { return String(S.authorIdOf(a) || "").toLowerCase(); };
    var mine = new Set((art.authors || []).map(key).filter(Boolean)), shared = false;
    store.referencesOf(demo.id).forEach(function (rid) {
      var r = !shared && store.getById(rid);
      if (r) (r.authors || []).forEach(function (a) { if (mine.has(key(a))) shared = true; });
    });
    return shared;
  }
  var SCENE_LABELS = { none: "back to the full list", row: "finding the article", open: "opening the abstract",
    pin: "focusing on the article", graph: "following the citation graph", shared: "looking for a shared author",
    author: "showing the author", matrix: "opening the matrix", fav: "starring the article" };
  var STEPS = [
    // The chooser: show() gives it the Quick and Full buttons.
    { id: "welcome", title: "A look around",
      body: function (c) {
        var plus = andList(["every button up here by name",
          c.hasFull("abstract") ? "what a row opens" : "",
          c.hasFull("context") ? "what a right-click does" : "",
          c.hasFull("refs") ? "the citation graph" : "",
          c.hasFull("auworks") ? "an author's works" + (c.hasFull("aumetrics") ? " and metrics" : "") : "",
          c.hasFull("favs") ? "your favorites" : ""]);
        return p("Two tours through the article browser:") +
          ul(["<b>Quick</b>, " + nOf(c.quick, "stop", "stops") + ": " +
              andList(["search", "filters", "a row", "your list", "the settings", c.hasQuick("kiosk") ? "kiosk mode" : ""]),
            "<b>Full</b>, " + nOf(c.full, "stop", "stops") + ": the same, plus " + plus +
              (c.clean && c.hasFull("abstract") ? ". It opens an article on the way and tidies up after itself" : "")]) +
          p("<kbd>\u2192</kbd> starts the quick one, <kbd>Esc</kbd> leaves. Settings replays them any time.");
      } },
    { id: "search", at: [".oa-tsearch"], title: "Search",
      body: p("One field for titles, abstracts, authors, keywords and venues.") +
        ul(["Press <kbd>/</kbd> anywhere to jump here",
          "<b>\u201cQuotes\u201d</b> match an exact phrase",
          "Results follow as you type. The number counts them",
          "The glyph beside it switches semantic search on. One model download, then results by meaning rather than by word"]) },
    { id: "filters", at: [".filter-split"], title: "Filters",
      body: p("Rules for anything the database records, in any combination.") +
        ul(["Author, keyword, category, venue, year, citations, access",
          "<b>Filters</b> opens the rule builder: one row per condition",
          "The count on the button shows how many rules apply",
          "<b>\u00d7</b> clears rules and search at once"]) },
    { id: "group", tour: "long", at: [".toolbar-group-grouping"], title: "Group by",
      body: p("Fold the list into sections.") +
        ul(["By date, venue, access or category",
          "<b>\u03a3</b> folds or unfolds every group at once",
          "<b>\u00d7</b> removes the grouping"]) },
    { id: "row", row: true, scene: "row", align: "top", title: "Every row opens",
      body: function (c) {
        // The keyword marks' only other explanation is a hover tooltip
        // (grid-renderers.js): said here while the row shows keywords. The
        // two glyph buttons under the star likewise, while they show.
        var row = demoRow(), kw = row && row.querySelector(".keyword-link");
        var cite = row && row.querySelector(".oa-cite-btn");
        return ul(["The chevron opens the abstract in place" + (c.clean ? ". The next stops open one for you" : ""),
          "The title focuses the list on that one article and shows its centralities",
          "Names, venues and dates are filters too. Click one to narrow the list to it",
          kw && visible(kw) ? "In the keywords, <b>#</b> marks a topical one, <b>$</b> a derived one" : "",
          cite && visible(cite) ? "Under the star: copy the reference in the style set in <b>Settings</b>, or download its BibTeX" : "",
          c.mode === "quick" ? "Right-click an author or a title for their metrics" : ""]);
      } },
    // What the right button does in a row (articles-grid.js authorContextMenu).
    { id: "context", tour: "long", row: true, scene: "row", at: [".title-link", ".author-link"], title: "Right-click for more",
      body: function (c) {
        return p("The right mouse button has its own action on most of a row:") +
          ul(["A <b>title</b>: the list focuses on the article and opens its abstract with the graph metrics",
            "An <b>author</b>: the list holds their works" + (c.panel ? ", their metrics beside it" : ""),
            "A <b>keyword</b> or <b>category</b>: added to the filter with OR",
            "A <b>date</b>: that whole year",
            "<kbd>Ctrl</kbd>+right-click: the browser's own menu"]);
      } },
    { id: "abstract", tour: "long", scene: "open", drop: true, title: "The abstract",
      // The text and the head row right above it ("Abstract", the read-aloud
      // button, the length) - not the drop's first head, which can be the
      // metadata summary on a narrow window.
      at: [function (drop) {
        var t = drop.querySelector(".abstract-card-text");
        if (!t) return null;
        var h = t.previousElementSibling;
        return (h && /\babs-sec-head/.test(h.className)) ? [h, t] : [t];
      }],
      body: function (c) {
        return ul(["The full text, with its length in words and sentences",
          c.vis(".abs-drop .oa-tts-btn") ? "The speaker button reads it aloud. Voice and speed live in Settings" : "",
          "While a search runs, its hits are marked in the text",
          "Settings switches between one paragraph and one sentence per line"]);
      } },
    { id: "toc", tour: "long", probe: hasToc, scene: "open", drop: true, at: [".abs-toc > *"], all: true, title: "Table of contents",
      body: ul(["The paper's own section headings, where we have them",
        "Click a heading to fold or unfold what sits beneath it",
        "The <b>+</b> and <b>\u2212</b> buttons fold or unfold every level at once",
        "Filters can search these headings too"]) },
    { id: "records", tour: "long", scene: "open", drop: true, at: [".abs-ext-groups"], title: "Discovery, metadata, metrics",
      body: function (c) {
        var codes = tileCodes(c.drop);
        return ul(["<b>Discovery</b> opens the paper at the publisher, on Google Scholar, Scopus, Web of Science and more",
          "<b>Metadata</b> leads to its CrossRef, OpenAlex and OpenCitations records",
          "<b>Metrics</b> links its PlumX, Altmetric and BIP! scores",
          "Only the records this paper has are shown. Every tile opens in a new tab" + (codes ? ". The codes:" : "")]) + codes;
      } },
    { id: "graph", tour: "long", scene: "open", drop: true, at: [".abs-ext-graph"], title: "Citation graph",
      body: function (c) {
        return ul(["The first tile lists the articles this one cites, the second the articles citing it",
          "The third lists similar articles that neither cite nor are cited by it",
          "Hover a tile for the count. Click it and the list becomes that neighbourhood",
          "Shift+click combines it with your current filters",
          c.drop && c.drop.querySelector(".abs-ext-graph .oa-graph-link.is-disabled") ? "A grey tile has nothing to list for this article" : ""]);
      } },
    { id: "central", tour: "long", scene: "pin", align: "top", when: function (c) { return c.clean && !c.panelOff; }, at: METRICS_AT, title: "Centralities",
      body: function (c) {
        var plots = c.vis(".abs-inf-cols") || c.vis(".ap-inf-cols");
        return ul(["The title was clicked for you: the list is focused on this one article",
          plots ? "Its standing in the 3DCP citation network over time: citations, PageRank, HITS, betweenness and more"
            : "Once other papers cite an article, its standing in the 3DCP citation network shows here over time: citations, PageRank, HITS, betweenness and more",
          plots ? "Hover a plot for one month's values. The toggle switches to a log scale" : "",
          "A second click on the title lifts the focus"]);
      } },
    // Probed only once the map has drawn: a paper without institutions on
    // record has nothing to show here, and the stop is dropped.
    { id: "affil", tour: "long", scene: "pin", when: function (c) { return panelled(c) && !!window.OAPaperAffiliations; }, ready: affilSettled, title: "Affiliations",
      // The heading, the tools, the map and the institutions - not the
      // section's box, which stretches to the Centralities' height beside it.
      at: [function () { var s = document.querySelector(AFFIL_AT); return s && s.querySelector(".oa-map svg") ? s.children : null; }],
      body: ul(["Where the authors are based: one numbered marker per institution, numbered as in the paper's header",
        "The countries they are in are shaded. Hover a marker for its authors",
        "Click an institution under the map to zoom to it",
        "The buttons above the map fit the paper again or show the whole world"]) },
    { id: "anchor", tour: "long", scene: "graph", when: clean, at: ["#myGrid .oa-anchor-row"], title: "The article in focus",
      body: function (c) {
        var w = RULE_WORDS[c.rule] || RULE_WORDS.REFERENCES_OF;
        return ul(["The <b>" + w[0] + "</b> tile was clicked for you",
          "The article itself stays pinned up here, above " + w[1] + ", while the list scrolls. It is not counted as a match",
          "<b>\u00d7</b> next to Filters brings the full list back"]);
      } },
    // The list the tile left, under the pinned article: its first rows.
    { id: "refs", tour: "long", scene: "graph", when: clean, at: [listRows],
      title: function (c) { return (RULE_WORDS[c.rule] || RULE_WORDS.REFERENCES_OF)[2]; },
      body: function (c) {
        var g = graphLead(c.rule);
        return (g.text ? p(g.text) : "") +
          ul([(g.n === 1 ? "It opens" : "Each opens") + " like any other row. Its tiles walk the graph a step further",
            g.n === 1 ? "" : "Sort by <b>Citations</b> to bring the most cited up"]);
      } },
    { id: "shared", tour: "long", probe: hasShared, scene: "shared", when: clean, at: ["#myGrid .slick-viewport .oa-shared-au"], all: true, title: "Author overlap",
      body: ul(["This glyph marks the articles that share an author with the article in focus",
        "Hover it for the names",
        "Self-citations and close collaborators stand out at a glance"]) },
    // The author scenes: the name's click fills the list with their works and
    // opens the rule builder on the rule it wrote. The summary under the list
    // needs no panel; the panel stops wait for its chart code (preloaded by
    // warm()).
    { id: "auworks", tour: "long", scene: "author", when: clean, at: [listRows], title: "All their works",
      body: function (c) {
        var rc = document.querySelector("#resultCount .rc-live"), n = rc ? String(rc.textContent || "").trim() : "";
        var who = c.author ? "The name " + c.author : "An author's name";
        return p((c.sceneStart ? who + " was clicked for you: the list now holds all their works" : "The list holds all their works") +
          (n ? ", <b>" + esc(n) + "</b>" : "") + ", newest first.") +
          ul(["Each citation bar now reads all citations, then without their self-citations, then without shared authors",
            "Sort by <b>Citations</b> for their most cited first",
            "Click a co-author's name to narrow the list to the works they share"]);
      } },
    { id: "rules", tour: "long", scene: "author", when: clean, at: ["#ruleBuilderBody:not([hidden])"], title: "Rule builder",
      body: function (c) {
        var ex = document.getElementById("ruleExpression"), q = ex ? String(ex.textContent || "").trim() : "";
        return p((c.sceneStart ? clickedAuthor(c) + ". " : "") + "The click wrote " + (q ? "the rule <b>" + esc(q) + "</b>" : "a rule") +
          ", and every pick in the table writes one like it:") +
          ul(["The line on top reads the whole filter as text. <b>No Rule Filter</b> there means none applies",
            "One row per condition: field, operator, value. Values are suggested as you type",
            "<b>\uFF0B</b> adds a condition. AND, OR, NOT and brackets combine them",
            "The eye switches one off without deleting it, <b>\u00d7</b> deletes it, <b>\u22ee</b> drags it to reorder",
            "The address bar carries the whole filter, so a link shares it",
            "<b>Filters</b> folds the builder away. The rule stays applied"]);
      } },
    // The page head's echo of a short link (articles-grid.js syncCrumb): the
    // author's, as the list holds one AUTHOR IS rule.
    { id: "crumb", tour: "long", scene: "author", when: clean, title: "Short links",
      at: [function () { var t = document.querySelector(".oa-crumb [data-crumb-tail]"); return t ? [t.closest(".oa-crumb")] : null; }],
      body: function () {
        var k = crumb();
        return p("The page head names the view: <b>3dcp.fyi/" + esc(k) + "</b> opens exactly this list.") +
          ul(["Click the short part to copy the full link",
            "Short links exist for an author, an article by its BibTeX key, its <b>/references</b>, <b>/citations</b> and <b>/similar</b>, a <b>keyword/\u2026</b> and a <b>category/\u2026</b>",
            "Every other filter travels in the address too, as a longer link",
            "<b>3dcp.fyi</b> starts over with the full list. Shift+click it for the start page"]);
      } },
    { id: "footer", tour: "long", scene: "author", when: clean, at: [FOOTER_AT], title: "Author summary",
      body: function (c) {
        var f = FOOTER_AT + " .af-row-values ";
        var most = andList([c.vis(f + ".af-cell-authors .af-list") ? "co-authors" : "",
          c.vis(f + ".af-cell-category .af-list") ? "categories" : "", c.vis(f + ".af-cell-keywords .af-list") ? "keywords" : ""]);
        return p((c.sceneStart ? clickedAuthor(c) + ". " : "") + "The row under the list sums them up:") +
          ul([c.vis(f + ".af-span") ? "<b>Activity</b>: first and latest contribution, how long active, how long since" : "",
            c.vis(f + ".af-xtab") ? "<b>Statistics</b>: works by authorship position and type. The corner button shows shares" : "",
            most ? "Their most frequent " + most : "",
            c.vis(f + ".af-total") ? "<b>Citations</b>: their total. Each bar in the rows adds a count without self-citations" : "",
            c.vis(FOOTER_AT + " .af-fold") ? "The caret folds it to its head row" : "",
            "Every date, count and name in it narrows the list further"]);
      } },
    { id: "aumetrics", tour: "long", scene: "author", align: "top", when: authorPanelled, ready: authorSettled, at: [SERIES_AT], title: "Author metrics",
      body: function (c) {
        // The plots' own names (the panel leaves out a series that never
        // leaves zero), subscripts kept.
        var names = Array.prototype.map.call(document.querySelectorAll(SERIES_AT + " .oa-inf-lname"), function (e) {
          return e.innerHTML.replace(/<(\/?)sub\b[^>]*>/gi, "<$1sub>");
        });
        return p((c.sceneStart ? clickedAuthor(c) + ". " : "") + "Beside the list, their record over time, counted within this database:") +
          ul(["Month by month: " + (names.length ? andList(names) : "publications, citations and the indices built on them"),
            "Lines: solid for all citations, dashed without self-citations, dotted without shared authors",
            "Hover a plot for one month's values. Drag across one to narrow the list to that interval",
            "Counts only: a low number says nothing about the quality of the work"]);
      } },
    { id: "author", tour: "long", scene: "author", align: "top", when: authorPanelled, ready: authorSettled, at: [PEOPLE_AT], title: "Who cites whom",
      body: function (c) {
        return (c.sceneStart ? p(clickedAuthor(c) + ".") : "") +
          ul(["<b>Most Cited By</b> ranks the authors whose works cite theirs most, <b>Cites Most</b> the authors they cite most",
            "Per name: the citing works, the cited works, then the citations, all and without shared authors",
            "The first two numbers list those works, the citations open the matrix behind them",
            "A name switches the panel to that author"]);
      } },
    { id: "matrix", tour: "long", scene: "matrix", when: function (c) { return panelled(c) && !!window.OAAuthorPanel; }, at: [MATRIX_AT], title: "Citation matrix",
      body: ul(["One name's citations were clicked for you: every citation between the two authors, work by work",
        "Rows are the citing works, columns the cited ones, both oldest first",
        "A filled square is a citation. Struck through, it runs through a work both of them wrote",
        "Point at a cell to compare both works above the grid. Click to pin it, then the arrow keys step from citation to citation",
        "<b>\u00d7</b> closes it"]) },
    // The reading list, on the demo: its star's click, then Favorites'.
    { id: "favs", tour: "long", scene: "fav", when: clean, at: [listRows], title: "Your favorites",
      body: function (c) {
        var t = esc(demoTitle()), n = window.OAFavorites.count();
        return p((c.starred ? "The star of <b>" + t + "</b> was clicked for you, then" : "<b>" + t + "</b> carries your star already, so only") +
          " <b>Favorites</b>: the list now holds just the starred articles" + (n > 1 ? ", " + num(n) + " of them" : "") + ".") +
          ul(["Stars stay in this browser. No account, nothing sent anywhere",
            c.vis("#myGrid .slick-header [data-fav-all]") ? "The star in the column head stars every article in view at once" : "",
            "<b>Favorites</b> again brings the full list back"]);
      } },
    { id: "favexport", tour: "long", scene: "fav", when: clean, at: [".oa-toprow .fav-split", ".oa-toprow #exportResults", ".oa-toprow .open-split"], title: "Share and export",
      body: function (c) {
        return ul(["<b>Favorites</b> counts your stars and switches the list to them",
          c.vis("#favMenuBtn") ? "The arrow beside it copies a share link. Opened anywhere, it adds the same articles to that reader's favorites" : "",
          "<b>BibTeX</b> downloads exactly the articles listed, now your favorites, as one .bib file",
          "<b>Open all</b> opens each in a new tab, via DOI, publisher or Scholar, your pick",
          c.vis(".oa-toprow .oa-top-more-btn") ? "On a narrow window the <b>\u22ef</b> menu lists every action with its name" : ""]);
      } },
    { id: "sort", tour: "long", at: ["#myGrid .slick-header"], title: "Sort and columns",
      body: function (c) {
        return ul([c.clean ? "Back to the full list" : "",
          "Click a column head to sort, again to reverse",
          "Right-click any head to choose which columns show"]);
      } },
    // The same controls, as they stand, where the tour leaves the list alone.
    { id: "list", when: function (c) { return c.mode === "quick" || !c.clean; }, at: [".oa-toprow .fav-split", ".oa-toprow #exportResults", ".oa-toprow .open-split"], title: "Your list",
      body: function (c) {
        return ul(["<b>Favorites</b> shows only your starred articles and shares them as a link",
          "<b>BibTeX</b> downloads every matching article as one .bib file",
          "<b>Open all</b> opens them in new tabs, via DOI, publisher or Scholar, your pick",
          c.vis(".oa-toprow .oa-top-more-btn") ? "On a narrow window the <b>\u22ef</b> menu lists every action with its name" : ""]);
      } },
    { id: "view", tour: "quick", at: ["#collapseAbstracts", "#panelToggle", "#searchSettings"], title: "View and settings",
      body: function (c) {
        return ul([c.vis("#collapseAbstracts") ? "<b>Hide abstracts</b> closes every open abstract at once" : "",
          c.vis("#panelToggle") ? "The <b>metrics panel</b> button shows or hides the centralities, affiliations, author metrics and topic trends beside the table" : "",
          "<b>Settings</b> holds typo tolerance, theme, abstract layout, reference style and the reading voice"]);
      } },
    // Every header control by name - most are glyphs only.
    { id: "header", tour: "long", at: [".oa-toprow"], title: "The buttons up here",
      body: function () { return p("Each one, by its glyph:") + headerKeys(); } },
    // Pointed at, not started: full screen and the voice would take over the
    // tour (kiosk.js).
    { id: "kiosk", at: [".oa-toprow .oa-kiosk-btn"], title: "Kiosk mode",
      body: ul(["Reads the abstracts aloud, full screen, one article after another in shuffled order",
        "It plays the rows you marked (drag across them, or Shift+click), otherwise the whole filtered list",
        "<kbd>→</kbd> skips, <kbd>←</kbd> goes back, <kbd>Space</kbd> pauses, <kbd>M</kbd> mutes, <kbd>Esc</kbd> ends",
        "Add <b>?kiosk</b> to a link, or <b>&amp;kiosk</b> after a filter, and it starts by itself on that list: a booth screen comes back on its own after a restart"]) },
    { id: "site", at: [".oa-toprow .oa-add-btn", ".oa-toprow .oa-scheme-btn"], title: "Missing something?", next: "Start browsing",
      body: function (c) {
        return p("The database is curated by hand.") +
          ul(["Suggest a paper we lack with <b>+</b>",
            "Found an error in a record? The <b>!</b> button in its abstract strip reports it",
            c.mode === "quick" ? "The theme button beside it switches between mint, dark and light" : ""]) +
          p("That's the tour.");
      } }
  ];

  var root = null, shades = [], ring = null, card = null, caret = null;
  var countEl = null, titleEl = null, bodyEl = null, skipBtn = null, backBtn = null, nextBtn = null, fullBtn = null;
  var plans = { quick: [], long: [] }, starting = false;
  var atScene = "none", pendTimer = 0, refreshTimer = 0, shownAt = 0, shownBody = "";
  var steps = [], index = 0, raf = 0, observer = null, inerted = [], returnTo = null;
  var busy = false, ctx0 = null, lastMut = 0, lastReveal = 0, warmed = false;
  // What the tour did to the table, so it can undo exactly that: the article
  // whose drop it opened (and whether it, not the reader, opened it), whether
  // the filters are its, which graph tile it followed, the author it clicked,
  // whether the matrix is its and whether it starred the article.
  function fresh() {
    return { picked: false, id: null, idx: null, order: null, opened: false, filtered: false, rule: "", author: "", matrix: false, starred: false };
  }
  var demo = fresh();

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"); }
  // The part of el's box its clipping ancestors (the grid's viewport, the
  // panel, a drop with a height cap, the matrix's scroll area) and the window
  // leave showing, or null when it is under 2px. An ancestor clips only what
  // it contains: a positioned box skips the ancestors between it and its
  // containing block, and a fixed one all of them.
  function shown(el) {
    var r = el.getBoundingClientRect(), l = r.left, t = r.top, rr = r.right, b = r.bottom, skip = null;
    for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (n !== el && (!skip || n === skip)) {
        skip = null;
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
          var q = n.getBoundingClientRect();
          l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
        }
      }
      if (cs.position === "fixed") break;
      if (cs.position === "absolute" && !skip) skip = n.offsetParent;
    }
    l = Math.max(l, 0); t = Math.max(t, 0); rr = Math.min(rr, innerWidth); b = Math.min(b, innerHeight);
    return rr - l >= 2 && b - t >= 2 ? { l: l, t: t, r: rr, b: b } : null;
  }
  // On screen: rendered, and not clipped away - the grid clips its rows, and
  // a control scrolled or pushed out of the window is nothing to point at.
  function visible(el) {
    if (!present(el)) return false;
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    return !!shown(el);
  }
  function vis(sel) { return visible(document.querySelector(sel)); }
  // The topmost data row inside the grid's viewport (group heads and totals
  // carry no chevron). Looked up per pass: SlickGrid recreates row nodes.
  function dataRow() {
    var rows = document.querySelectorAll("#myGrid .slick-viewport .slick-row");
    var vp = document.querySelector("#myGrid .slick-viewport");
    var minTop = vp ? vp.getBoundingClientRect().top - 1 : -1;
    var best = null, bestTop = Infinity;
    for (var i = 0; i < rows.length; i += 1) {
      if (!rows[i].querySelector(".abstract-toggle")) continue;
      var top = rows[i].getBoundingClientRect().top;
      if (top >= minTop && top < bestTop) { bestTop = top; best = rows[i]; }
    }
    return best && visible(best) ? best : null;
  }
  function dropOf(id) { return id ? document.querySelector('#myGrid .abs-drop[data-abs-drop="' + cssEsc(id) + '"]') : null; }
  function chevronOf(id) { return id ? document.querySelector('#myGrid .abstract-toggle[data-abs-id="' + cssEsc(id) + '"]') : null; }
  // The row the tour works on: the one it chose (while it is rendered - the
  // viewport may have scrolled it off), else the topmost row.
  function demoRowStrict() {
    var btn = chevronOf(demo.id);
    return btn ? btn.closest(".slick-viewport .slick-row") : null;
  }
  function demoRow() { return demoRowStrict() || dataRow(); }
  function sharedGlyph() { return document.querySelector("#myGrid .slick-viewport .oa-shared-au"); }
  // A scrollTop write on the grid, and the grid told at once: SlickGrid
  // renders the rows for a position on the viewport's scroll event, which
  // waits for the next frame - in a tab gone to the background, until the
  // reader comes back. The native event that follows finds nothing to do.
  function scrollGrid(vp, top) {
    vp.scrollTop = top;
    vp.dispatchEvent(new Event("scroll"));
  }
  // The demo row, rendered: SlickGrid builds only the rows in and around its
  // viewport, so when the article sits further down the list the viewport
  // jumps to where its row should be. The canvas holds the whole list, so its
  // height over the list's length is the mean row pitch for the first jump;
  // the rows drawn around a landing give the local pitch and how far off it
  // was for the next. Each jump waits only until the grid has drawn the new
  // position. `order` mirrors the list's sort (pickDemo); if the two disagree
  // after all, a short scan around the last guess. Falls back to the top row,
  // which every stop can work with.
  function bringRow() {
    var row = demoRowStrict();
    if (row || !demo.id || demo.idx == null) return Promise.resolve(row || dataRow());
    var vp = document.querySelector("#myGrid .slick-viewport");
    if (!vp) return Promise.resolve(dataRow());
    var size = demo.order ? demo.order.size : 0;
    var pitch = size ? vp.scrollHeight / size : 108, guess = demo.idx * pitch, tries = 0;
    // The drawn row nearest the viewport's top - its list index and offset -
    // and the pitch between the first and last drawn rows.
    function nearest() {
      var top = vp.getBoundingClientRect().top, best = null, lo = null, hi = null;
      document.querySelectorAll("#myGrid .slick-viewport .slick-row .abstract-toggle[data-abs-id]").forEach(function (b) {
        var i = demo.order ? demo.order.get(b.getAttribute("data-abs-id")) : undefined;
        if (i == null) return;
        var y = b.closest(".slick-row").getBoundingClientRect().top - top;
        if (!best || Math.abs(y) < Math.abs(best.y)) best = { i: i, y: y };
        if (!lo || i < lo.i) lo = { i: i, y: y };
        if (!hi || i > hi.i) hi = { i: i, y: y };
      });
      if (best && hi.i > lo.i && hi.y > lo.y) best.pitch = (hi.y - lo.y) / (hi.i - lo.i);
      return best;
    }
    // Drawn for the new position: the demo row, or rows across the viewport.
    function landed() {
      var r = demoRowStrict();
      if (r) return { row: r };
      var ref = nearest();
      return ref && Math.abs(ref.y) < Math.max(200, vp.clientHeight) ? { ref: ref } : null;
    }
    function fallback() {
      return page(vp, Math.max(0, guess - 30 * pitch), guess + 30 * pitch, Math.max(96, vp.clientHeight), demoRowStrict).then(function (r) {
        if (r) return r;
        scrollGrid(vp, 0);
        return waitFor(dataRow, 500);
      });
    }
    return new Promise(function (res) {
      (function jump() {
        if (!root) return res(null);
        scrollGrid(vp, guess);
        waitFor(landed, 400).then(function (l) {
          if (!root) return res(null);
          if (l && l.row) return res(l.row);
          var ref = l && l.ref;
          tries += 1;
          if (!ref || tries > 5 || Math.abs(demo.idx - ref.i) <= 2) return fallback().then(res);
          if (ref.pitch) pitch = ref.pitch;
          guess = Math.max(0, vp.scrollTop + ref.y + (demo.idx - ref.i) * pitch);
          jump();
        });
      })();
    });
  }
  // Rows drawn across the viewport's top edge: the grid has caught up with a
  // scroll.
  function drawnAt(vp) {
    var t = vp.getBoundingClientRect().top, rows = vp.querySelectorAll(".slick-row");
    for (var i = 0; i < rows.length; i += 1) {
      var r = rows[i].getBoundingClientRect();
      if (r.top <= t + 1 && r.bottom > t) return true;
    }
    return false;
  }
  // Scroll `vp` from `pos` down to `limit` in steps until test() finds
  // something drawn. Each step waits for the grid to draw it, then looks
  // once more a moment later. Resolves with the find, or null past the limit.
  function page(vp, pos, limit, step, test) {
    return new Promise(function (res) {
      (function next() {
        if (!root) return res(null);
        scrollGrid(vp, pos);
        waitFor(function () { return test() || (drawnAt(vp) ? "drawn" : null); }, 300).then(function (r) {
          return r === "drawn" ? waitFor(test, 40) : r;
        }).then(function (r) {
          if (r) return res(r);
          pos += step;
          if (pos > limit) return res(null);
          next();
        });
      })();
    });
  }
  // Choose the article for the demo, by the list's own order (newest first):
  // cited (so it has centralities to show), with in-corpus references (the
  // graph stops) and among them a paper by one of its own authors (the
  // author-overlap stop) - and, where the panel shows, with institutions on
  // record (the Affiliations stop; few papers have them yet, so those are
  // looked at wherever they sit in the list, the rest among the first 1500).
  // The best match wins, ties to the newer article; failing all, the top
  // row. All through the article store.
  function pickDemo() {
    var top = dataRow(), topBtn = top && top.querySelector(".abstract-toggle");
    var fallback = { id: topBtn ? topBtn.getAttribute("data-abs-id") : null, idx: 0 };
    // The reader's own filters or sort stay: the list is not the store's
    // newest-first order, and the demo is the row on top - a pick from the
    // store could sit anywhere, or nowhere, in it.
    if (!ctx0.clean || !newestFirst()) return fallback;
    var S = window.OAArticleStore, store = null;
    try { store = S && S.get ? S.get() : null; } catch (e) { store = null; }
    if (!store || !store.neighbourCounts || !store.referencesOf || !Array.isArray(window.ARTICLES_DATA)) return fallback;
    // Newest first, as the list sorts (articles-grid.js compareByField): by
    // date through the same collator, ties by the grid's source position
    // (`_idx`, set on the articles), ascending, then reversed. One day can
    // hold a whole proceedings volume, so the tie order matters. The whole
    // order is kept for bringRow's distance estimate.
    var col = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    var all = window.ARTICLES_DATA.slice().sort(function (a, b) {
      return col.compare(a.date == null ? "" : String(a.date), b.date == null ? "" : String(b.date)) || ((a._idx || 0) - (b._idx || 0));
    }).reverse();
    demo.order = new Map(all.map(function (a, i) { return [String(a.id), i]; }));
    if (demo.order.has(DEMO_ID) && store.getById(DEMO_ID)) return { id: DEMO_ID, idx: demo.order.get(DEMO_ID) };
    var A = window.OAPaperAffiliations;
    var mapped = ctx0 && ctx0.panel && A && typeof A.hasAffiliations === "function"
      ? function (art) { try { return A.hasAffiliations(art); } catch (e) { return false; } } : null;
    var keys = function (art) {
      var set = new Set();
      ((art && art.authors) || []).forEach(function (a) {
        var k = S.authorIdOf ? S.authorIdOf(a) : (typeof a === "string" ? a : a && (a.id || a.slug));
        if (k) set.add(String(k).toLowerCase());
      });
      return set;
    };
    var best = null, bestScore = 0, max = mapped ? 11 : 8;
    for (var i = 0; i < all.length; i += 1) {
      var aff = mapped ? mapped(all[i]) : false;
      if (i >= 1500 && !aff) continue;
      var id = all[i].id, n = id != null ? store.neighbourCounts(id) : null;
      if (!n || n.references + n.citations + n.similar === 0) continue;
      var score = 1 + (n.references ? 2 : 0) + (n.citations ? 1 : 0) + (aff ? 3 : 0);
      if (n.references && score + 4 > bestScore) {
        var mine = keys(store.getById(id)), shared = false;
        if (mine.size) store.referencesOf(id).forEach(function (rid) {
          if (shared) return;
          keys(store.getById(rid)).forEach(function (k) { if (mine.has(k)) shared = true; });
        });
        if (shared) score += 4;
      }
      if (score > bestScore) { bestScore = score; best = { id: id, idx: i }; }
      if (score >= max) break;
    }
    return best || fallback;
  }
  // Once, at the first stop that drives the table: by then the panel's map
  // data, asked for at start, has had time to arrive.
  function pick() {
    if (demo.picked) return;
    demo.picked = true;
    var chosen = pickDemo();
    demo.id = chosen.id;
    demo.idx = chosen.idx;
    warmAuthors();
  }
  // The demo row's author whose panel has most to show: the first with
  // in-corpus citations either way (Most Cited By, Cites Most), else the
  // first. Names folded into "+N" are not links in the row and not candidates.
  function pickAuthor(row) {
    var links = Array.prototype.filter.call(row.querySelectorAll(".author-link[data-author]"), present);
    if (!links.length) return null;
    var own = links.filter(function (l) { return l.getAttribute("data-author") === DEMO_AUTHOR; })[0];
    if (own) return own;
    var S = window.OAArticleStore, store = null, known = window.AUTHORS_DATA || {};
    try { store = S && S.get ? S.get() : null; } catch (e) { store = null; }
    for (var i = 0; i < links.length; i += 1) {
      var slug = links[i].getAttribute("data-author"), d = null;
      if (!known[slug]) continue;
      try { d = store && store.authorSummary ? store.authorSummary(slug) : null; } catch (e) { d = null; }
      if (d && ((d.citedBy || []).length || (d.citesMost || []).length)) return links[i];
    }
    return links[0];
  }
  // "Surname, First" with the surname bold, as the panel writes names.
  function authorHtml(slug, link) {
    var a = (window.AUTHORS_DATA || {})[slug];
    var last = a ? [a.prefix, a.lastName].filter(Boolean).join(" ") : "";
    if (last) return "<b>" + esc(last) + "</b>" + (a.firstName ? ", " + esc(a.firstName) : "");
    return "<b>" + esc(String((link && link.textContent) || slug).trim()) + "</b>";
  }
  // Scroll targets into their scroll containers' view - the grid viewport, a
  // drop taller than its row cap, the panel - and the window. Per container,
  // the joint box of the targets inside it, innermost container first.
  // Direct scrollTop writes, the same thing the wheel does, so the grid's own
  // scroll handling runs. Nothing above a fixed layer (the matrix) moves it.
  function bounds(list) {
    var t = Infinity, b = -Infinity;
    list.forEach(function (el) { var r = el.getBoundingClientRect(); t = Math.min(t, r.top); b = Math.max(b, r.bottom); });
    return { top: t, bottom: b };
  }
  function scroller(node) {
    var cs = getComputedStyle(node);
    return /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1;
  }
  function fixedLayer(el) {
    for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") return true;
    }
    return false;
  }
  function reveal(els, align) {
    if (!els.length) return;
    var M = 16, done = [];
    els.forEach(function (el) {
      for (var node = el; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (node !== el && done.indexOf(node) < 0 && scroller(node)) {
          done.push(node);
          var inside = els.filter(function (e) { return node.contains(e); });
          var b = bounds(inside), pr = node.getBoundingClientRect(), d = 0;
          if (align === "top" || b.top < pr.top + M) d = b.top - (pr.top + M);
          else if (b.bottom > pr.bottom - M) d = Math.min(b.top - (pr.top + M), b.bottom - (pr.bottom - M));
          if (d) {
            node.scrollTop += d;
            if (node.classList.contains("slick-viewport")) scrollGrid(node, node.scrollTop);
          }
        }
        if (getComputedStyle(node).position === "fixed") break;
      }
    });
    var flow = els.filter(function (el) { return !fixedLayer(el); });
    if (!flow.length) return;
    var all = bounds(flow), d2 = 0;
    if (all.top < M) d2 = all.top - M;
    else if (all.bottom > innerHeight - M) d2 = Math.min(all.top - M, all.bottom - (innerHeight - M));
    if (d2) scrollBy(0, d2);
  }
  function metricsEl() { return document.querySelector(METRICS_AT.join(", ")); }
  function anchorRow() { return document.querySelector("#myGrid .oa-anchor-row"); }
  function peopleEl() { return document.querySelector(PEOPLE_AT); }
  function seriesEl() { return document.querySelector(SERIES_AT); }
  function footerEl() { var f = document.querySelector(FOOTER_AT); return f && f.childElementCount ? f : null; }
  // The author scene is set: their summary under the list, or their part of
  // the panel beside it.
  function authorShown() { return footerEl() || peopleEl() || seriesEl(); }
  // The panel's author part has settled: plots drawn or lists shown, or a
  // message other than its loading line. No part on screen: nothing to wait for.
  function authorSettled() {
    var part = document.querySelector(PANEL + '[data-part="author"]:not([hidden])');
    if (!part || part.querySelector('[data-ap="series"]:not([hidden]) svg, [data-ap="people"]:not([hidden])')) return true;
    var m = part.querySelector('[data-ap="msg"]:not([hidden])');
    return m && !/^Loading/i.test(m.textContent) ? true : null;
  }
  // The list's first two rows on screen, under the article a graph tile
  // pinned (that one sits in the grid's top panel, outside the viewport).
  function listRows() {
    var vp = document.querySelector("#myGrid .slick-viewport");
    if (!vp) return null;
    var top = vp.getBoundingClientRect().top - 1;
    return Array.prototype.filter.call(vp.querySelectorAll(".slick-row"), function (r) {
      return !!r.querySelector(".abstract-toggle") && present(r) && r.getBoundingClientRect().top >= top;
    }).sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; }).slice(0, 2);
  }
  // The short link the page head shows for the list (articles-grid.js
  // syncCrumb), or "".
  function crumb() {
    var el = document.querySelector(".oa-crumb [data-crumb-tail]");
    return el && present(el) ? String(el.textContent || "").trim() : "";
  }
  function demoTitle() { var d = demoRecord(); return d && d.art.title ? String(d.art.title) : "this article"; }
  function demoRecord() {
    var S = window.OAArticleStore, store = null;
    try { store = S && S.get ? S.get() : null; } catch (e) { store = null; }
    var art = store && demo.id && store.getById ? store.getById(demo.id) : null;
    return art ? { store: store, art: art } : null;
  }
  // What a graph tile listed, in numbers: the demo's neighbours in the
  // database (n), beside the count on record for references and citations.
  function graphLead(rule) {
    var d = demoRecord(), nb = d && d.store.neighbourCounts ? d.store.neighbourCounts(demo.id) : null;
    var key = rule === "CITATIONS_OF" ? "citations" : rule === "SIMILAR_TO" ? "similar" : "references";
    var n = nb ? nb[key] : 0, m = d && key !== "similar" ? d.store.metricNumber(d.art[key]) : null, one = n === 1, t;
    if (!n) return { n: 0, text: "" };
    if (key === "similar") t = (one ? "one article" : num(n) + " articles") + " similar to it that neither " + (one ? "cites" : "cite") + " it nor " + (one ? "is" : "are") + " cited by it";
    else if (key === "citations") t = "the " + (one ? "one article" : num(n) + " articles") + " in the database citing it" + (m > n ? ", of " + nOf(m, "citation", "citations") + " on record" : "");
    else if (m > n) t = "the " + (one ? "one" : num(n)) + " of its " + num(m) + " references that " + (one ? "is" : "are") + " in the database";
    else if (m === n) t = one ? "its one reference, which is in the database too" : "all " + num(n) + " of its references, every one in the database";
    else t = "its " + (one ? "one reference" : num(n) + " references") + " in the database";
    return { n: n, text: "Now listed: " + t + "." };
  }
  function matrixDlg() { return document.querySelector(MATRIX_AT); }
  // The list sorted newest first - the default, and the order pickDemo()
  // mirrors. The sorted head carries aria-sort, its id ends in the column's.
  function newestFirst() {
    var h = document.querySelector("#myGrid .slick-header-column[aria-sort]");
    return !h || (/date$/i.test(h.id) && h.getAttribute("aria-sort") === "descending");
  }
  // Code and data the later stops need, fetched while the reader reads the
  // early ones, once they have started (not on the welcome card alone): the
  // Centralities' metric data (~13 MB, drop-metrics.js) and the author
  // panel's chart code, each when its stop is on the way.
  function warm() {
    if (warmed) return;
    warmed = true;
    var planned = function (id) { return steps.some(function (s) { return s.id === id; }); };
    [[window.OADropMetrics, ["central"]], [window.OAAuthorPanel, ["aumetrics", "author"]]].forEach(function (w) {
      if (w[0] && typeof w[0].preload === "function" && w[1].some(planned)) {
        try { w[0].preload(); } catch (e) { /* the stop waits for it instead */ }
      }
    });
  }
  // The demo's authors' summaries (Most Cited By, Cites Most: ~0.1 s each the
  // first time), worked out in an idle moment after the pick, in order until
  // one has citations either way - the one pickAuthor() will take.
  function warmAuthors() {
    if (!demo.id || !steps.some(function (s) { return s.scene === "author"; })) return;
    var S = window.OAArticleStore, store = null;
    try { store = S && S.get ? S.get() : null; } catch (e) { store = null; }
    var art = store && store.getById ? store.getById(demo.id) : null;
    if (!art || !store.authorSummary || !S.authorIdOf) return;
    var later = window.requestIdleCallback || function (fn) { return setTimeout(fn, 400); };
    later(function () {
      var list = (art.authors || []).slice().sort(function (a, b) { return (S.authorIdOf(b) === DEMO_AUTHOR) - (S.authorIdOf(a) === DEMO_AUTHOR); });
      list.some(function (a) {
        if (!root) return true;
        try { var d = store.authorSummary(S.authorIdOf(a)); return !!d && ((d.citedBy || []).length || (d.citesMost || []).length); } catch (e) { return true; }
      });
    });
  }
  // The Affiliations section has settled: drawn, or showing a message other
  // than its loading line (no affiliations on record, the map failed). No
  // section at all: nothing to wait for.
  function affilSettled() {
    var s = document.querySelector(AFFIL_AT);
    if (!s || s.querySelector(".oa-map svg")) return true;
    var m = s.querySelector(".ap-msg");
    return m && !/^Loading/i.test(m.textContent) ? true : null;
  }
  // Nothing narrows or folds the list: no rule, no query, no grouping. Only
  // then may the tour replace the filters for its pin and graph scenes.
  function tableClean() {
    var r = document.getElementById("resetFilters"), s = document.getElementById("semanticSearch"), g = document.getElementById("groupBySelect");
    return !!r && r.disabled && !(s && s.value) && !(g && g.value);
  }
  // `loose`: present in the DOM and laid out, on screen or not - what
  // reveal() scrolls to. Never a node of the drops' off-screen measuring
  // copies (oa-abstract-rows.js renders those inside the grid too).
  function present(el) {
    if (!el || !el.isConnected || el.hidden || (el.closest && (el.closest("[hidden]") || el.closest(".abs-drop-measure")))) return false;
    var r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }
  function resolve(step, loose) {
    var base = document, out = [];
    var ok = loose ? present : visible;
    if (step.row) {
      base = demoRow();
      if (!base || !ok(base)) return out;
      if (!step.at) return [base];
    } else if (step.drop) {
      base = dropOf(demo.id);
      if (!base) return out;
    }
    (step.at || []).forEach(function (sel) {
      var els = typeof sel === "function" ? (sel(base) || []) : step.all ? base.querySelectorAll(sel) : [base.querySelector(sel)];
      Array.prototype.forEach.call(els, function (el) { if (ok(el)) out.push(el); });
    });
    return out;
  }
  // The spotlight: the targets' joint box as their clipping ancestors leave
  // it showing (rows beyond the grid's edge are rendered but cut off, and the
  // ring must not run over them), padded, clamped to the window.
  function union(els) {
    var b = null;
    els.forEach(function (el) {
      var s = shown(el);
      if (!s) return;
      b = b ? { l: Math.min(b.l, s.l), t: Math.min(b.t, s.t), r: Math.max(b.r, s.r), b: Math.max(b.b, s.b) } : s;
    });
    if (!b) return null;
    var x = Math.max(0, Math.round(b.l - PAD)), y = Math.max(0, Math.round(b.t - PAD));
    var r = Math.min(innerWidth, Math.round(b.r + PAD)), bt = Math.min(innerHeight, Math.round(b.b + PAD));
    return { x: x, y: y, w: Math.max(0, r - x), h: Math.max(0, bt - y) };
  }
  function box(el, x, y, w, h) {
    el.style.left = Math.round(x) + "px"; el.style.top = Math.round(y) + "px";
    el.style.width = Math.max(0, Math.round(w)) + "px"; el.style.height = Math.max(0, Math.round(h)) + "px";
  }

  /* ---- Scenes: the table state a stop needs -------------------------------
     Every transition goes through the table's own controls (the chevron, the
     title link, a graph tile, an author's name, a count in the panel, the
     Filters x), so the tour shows exactly what a click does and the grid
     stays the one owner of its state. Each returns a promise that settles
     when the target markup exists (or a short wait ran out - the stop is
     then dropped). All of them check `root`: Esc may have ended the tour
     while a wait was pending, and a click landing after that would change
     the reader's table behind their back. */
  function waitFor(test, ms) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function tick() {
        var v = null;
        try { v = test(); } catch (e) { v = null; }
        if (v) return res(v);
        if (!root || Date.now() - t0 > ms) return res(null);
        setTimeout(tick, 20);
      })();
    });
  }
  // Settles when the table has stopped changing for `ms` (a pin or a graph
  // rule repaints in several passes, and a later pass may reset the scroll a
  // reveal just set), or after `max` regardless.
  function quiet(ms, max) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function tick() {
        if (!root || Date.now() - lastMut >= ms || Date.now() - t0 >= max) return res();
        setTimeout(tick, 20);
      })();
    });
  }
  // Bring a stop's targets on screen: wait for the table to settle, scroll to
  // them, then confirm they are visible (a scroll re-renders the grid's rows,
  // so the nodes just found may be replaced). Two attempts.
  function settle(step, tries) {
    if (!(step.at || step.row)) return Promise.resolve(true);
    return quiet(120, 1500).then(function () {
      if (!root) return null;
      var found = resolve(step, true);
      if (!found.length) return null;
      lastReveal = Date.now();
      reveal(found, step.align);
      return waitFor(function () { return resolve(step).length ? true : null; }, 600);
    }).then(function (ok) {
      if (ok || !root || tries <= 1) return ok;
      return settle(step, tries - 1);
    });
  }
  function resetFilters() {
    var b = document.getElementById("resetFilters");
    demo.filtered = false;
    demo.rule = "";
    if (!b || b.disabled) return Promise.resolve(true);
    b.click();
    // The button greys at once, the list refills in later passes - and the
    // scenes after this one look their row up in the full list.
    return waitFor(function () { return b.disabled; }, 3000).then(function () { return quiet(150, 2000); }).then(function () { return true; });
  }
  function openDrop() {
    if (!root) return Promise.resolve(null);
    return bringRow().then(function (row) {
      if (!root) return null;
      var btn = row && row.querySelector(".abstract-toggle");
      var id = btn && btn.getAttribute("data-abs-id");
      if (!id) return null;
      if (demo.id !== id) { demo.id = id; demo.idx = null; demo.opened = false; }
      // Open already (the reader's doing, or ours): leave it as found.
      if (btn.getAttribute("aria-expanded") === "true") return dropOf(id);
      reveal([row], "top");
      btn.click();
      demo.opened = true;
      return waitFor(function () { return dropOf(id); }, 3000);
    });
  }
  function closeDrop() {
    if (!demo.opened) return Promise.resolve(true);
    demo.opened = false;
    var btn = chevronOf(demo.id);
    if (btn && btn.getAttribute("aria-expanded") === "true") btn.click();
    return Promise.resolve(true);
  }
  // The matrix the tour opened, shut. The panel does not close it when its
  // author goes, so every other scene (and the end) does it here.
  function closeMatrix() {
    if (!demo.matrix) return;
    demo.matrix = false;
    var d = matrixDlg();
    if (d && typeof d.close === "function") d.close();
  }
  function toNone() {
    closeMatrix();
    unFav();
    // The drop first: the filter reset brings the full list back, where the
    // demo row sits off screen with its chevron not drawn - its abstract
    // stayed open after an Esc at the pin's stops.
    return closeDrop().then(function () { return demo.filtered ? resetFilters() : true; }).then(function () {
      // Back where the tour found the list: the scenes scrolled it to their
      // targets (reveal). The top on a first entry, wherever the reader was
      // on a replay (start() notes it).
      var vp = document.querySelector("#myGrid .slick-viewport"), top = ctx0 ? ctx0.top : 0;
      if (vp && Math.abs(vp.scrollTop - top) > 1) scrollGrid(vp, top);
      return true;
    });
  }
  // The demo row in view, nothing open: what "Every row opens" points at.
  function toRow() { return (demo.filtered ? resetFilters() : Promise.resolve()).then(closeDrop).then(bringRow); }
  function toOpen() { return (demo.filtered ? resetFilters() : Promise.resolve()).then(openDrop); }
  // ID IS <this article>: the title's click. The pin opens the abstract on
  // its own when it is closed, so the drop is opened first - this way the
  // tour, not the pin, owns it and closes it at the end.
  function toPin() {
    if (metricsEl()) return Promise.resolve(true);
    return toOpen().then(function () {
      if (!root) return null;
      return bringRow();
    }).then(function (row) {
      if (!root || !row) return null;
      var t = row.querySelector(".title-link[data-id]");
      if (!t) return null;
      t.click();
      demo.filtered = true;
      // The section shows at once with a loading line, the plots follow when
      // the metric data (several MB, first time) has arrived: give them a
      // moment, so the spotlight lands on charts rather than on a sliver.
      return waitFor(metricsEl, 2500).then(function (el) {
        if (!el) return null;
        return waitFor(function () { var m = metricsEl(); return m && m.querySelector(".abs-inf-cols, .ap-inf-cols") ? m : null; }, 4000).then(function (m) { return m || el; });
      });
    });
  }
  // REFERENCES_OF / CITATIONS_OF / SIMILAR_TO <this article>: a graph tile's
  // click, which replaces the rule set (the pin included) and closes every
  // drop. The first tile with a non-empty neighbourhood is taken.
  function toGraph() {
    if (anchorRow()) return Promise.resolve(true);
    var ready = dropOf(demo.id) ? Promise.resolve() : toOpen();
    return ready.then(function () {
      if (!root) return null;
      var drop = dropOf(demo.id), tile = null, rule = "";
      ["REFERENCES_OF", "CITATIONS_OF", "SIMILAR_TO"].some(function (r) {
        var t = drop && drop.querySelector('.oa-graph-link[data-graph-rule="' + r + '"]');
        if (t && t.getAttribute("aria-disabled") !== "true") { tile = t; rule = r; return true; }
        return false;
      });
      if (!tile) return null;
      tile.click();
      demo.filtered = true;
      demo.rule = rule;
      demo.opened = false;
      return waitFor(anchorRow, 2500);
    });
  }
  // The graph list, scrolled to a row carrying the author-overlap glyph: the
  // list holds the demo article's references (34, say) but only the rows in
  // the viewport are rendered, so it is paged until one is found. None in
  // the whole list: back to the top, and the stop is dropped.
  function toShared() {
    return toGraph().then(function (ok) {
      if (!ok || !root) return ok;
      if (sharedGlyph()) return true;
      var vp = document.querySelector("#myGrid .slick-viewport");
      if (!vp) return null;
      var rc = document.querySelector("#resultCount .rc-live");
      var rows = parseInt(String((rc && rc.textContent) || "").replace(/[\s\u202f\u00a0]+/g, ""), 10) || 60;
      return page(vp, 0, Math.min(rows, 300) * 120, Math.max(96, vp.clientHeight * 0.8), sharedGlyph).then(function (g) {
        if (!g) scrollGrid(vp, 0);
        return g;
      });
    });
  }
  // AUTHOR IS <one of the demo's authors>: their name's click in the full
  // list, as "Names ... are filters too" says. The summary under the list
  // shows at once; the panel's part follows once its chart code has loaded,
  // and the panel stops wait for it (authorSettled).
  function toAuthor() {
    if (authorShown()) return Promise.resolve(true);
    return toRow().then(function (row) {
      if (!root || !row) return null;
      var a = pickAuthor(row);
      if (!a) return null;
      demo.author = authorHtml(a.getAttribute("data-author"), a);
      a.click();
      demo.filtered = true;
      return waitFor(authorShown, 6000);
    });
  }
  // The citation matrix behind a name in the panel's lists: the first whose
  // citations run both ways - some through a shared author, some not - so
  // both kinds of cell show; else the top name in Most Cited By.
  function matrixButton(list) {
    var btns = Array.prototype.slice.call(list.querySelectorAll('[data-ap="citedBy"] button.ap-n-matrix'))
      .concat(Array.prototype.slice.call(list.querySelectorAll('[data-ap="citesMost"] button.ap-n-matrix')));
    var num = function (b, sel) { var e = b.querySelector(sel); return e ? parseInt(e.textContent.replace(/\D+/g, ""), 10) : NaN; };
    for (var i = 0; i < btns.length; i += 1) {
      var all = num(btns[i], ".ap-n-total"), solo = num(btns[i], ".ap-n-solo");
      if (solo > 0 && solo < all) return btns[i];
    }
    return btns[0] || null;
  }
  function toMatrix() {
    if (matrixDlg()) return Promise.resolve(true);
    return toAuthor().then(function (ok) {
      return ok && root ? waitFor(peopleEl, 6000) : null;
    }).then(function (list) {
      if (!list || !root) return null;
      var btn = matrixButton(list);
      if (!btn) return null;
      btn.click();
      demo.matrix = true;
      return waitFor(matrixDlg, 2500);
    });
  }
  // The demo starred and the list down to the favorites: its star's click in
  // the full list, then the Favorites button's (an IS_FAVORITE rule, cleared
  // with the others). A star the reader had set stays theirs.
  function favOn() { var f = document.getElementById("favFilter"); return f && f.getAttribute("aria-pressed") === "true" ? f : null; }
  function toFav() {
    if (favOn() && window.OAFavorites.has(demo.id)) return Promise.resolve(true);
    return toRow().then(function (row) {
      var f = document.getElementById("favFilter"), star = row && row.querySelector(".oa-fav-toggle[data-fav-id]");
      if (!root || !f || !star) return null;
      if (star.getAttribute("aria-pressed") !== "true") { star.click(); demo.starred = true; }
      f.click();
      demo.filtered = true;
      return waitFor(favOn, 2000);
    });
  }
  function unFav() {
    if (!demo.starred) return;
    demo.starred = false;
    if (window.OAFavorites && demo.id) window.OAFavorites.remove(demo.id);
  }
  function ensure(scene) {
    if (scene !== "matrix") closeMatrix();
    if (scene !== "fav") unFav();
    if (scene === "fav") return toFav();
    if (scene === "matrix") return toMatrix();
    if (scene === "author") return toAuthor();
    if (scene === "shared") return toShared();
    if (scene === "graph") return toGraph();
    if (scene === "pin") return toPin();
    if (scene === "open") return toOpen();
    if (scene === "row") return toRow();
    return toNone();
  }

  function ensureStyles() {
    if (document.getElementById("oa-tour-styles")) return;
    var s = document.createElement("style");
    s.id = "oa-tour-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function build() {
    root = document.createElement("div");
    root.className = "oa-tour";
    root.innerHTML =
      '<div class="oa-tour-shade"></div><div class="oa-tour-shade"></div><div class="oa-tour-shade"></div><div class="oa-tour-shade"></div>' +
      '<div class="oa-tour-ring" hidden></div>' +
      '<div class="oa-tour-card" role="dialog" aria-modal="true" aria-labelledby="oaTourTitle" aria-describedby="oaTourBody" data-side="">' +
        '<span class="oa-tour-caret" aria-hidden="true"></span>' +
        '<div class="oa-tour-text" aria-live="polite">' +
          '<span class="oa-tour-count"></span>' +
          '<h2 class="oa-tour-title" id="oaTourTitle"></h2>' +
          '<div class="oa-tour-body" id="oaTourBody"></div>' +
        "</div>" +
        '<div class="oa-tour-actions">' +
          '<button type="button" class="oa-tour-skip">Skip the tour</button>' +
          '<button type="button" class="oa-tour-btn oa-tour-back" hidden>Back</button>' +
          '<button type="button" class="oa-tour-btn oa-tour-alt oa-tour-full" hidden>Full tour</button>' +
          '<button type="button" class="oa-tour-btn oa-tour-next">Next</button>' +
        "</div>" +
      "</div>";
    shades = Array.prototype.slice.call(root.querySelectorAll(".oa-tour-shade"));
    ring = root.querySelector(".oa-tour-ring");
    card = root.querySelector(".oa-tour-card");
    caret = root.querySelector(".oa-tour-caret");
    countEl = root.querySelector(".oa-tour-count");
    titleEl = root.querySelector(".oa-tour-title");
    bodyEl = root.querySelector(".oa-tour-body");
    skipBtn = root.querySelector(".oa-tour-skip");
    backBtn = root.querySelector(".oa-tour-back");
    nextBtn = root.querySelector(".oa-tour-next");
    skipBtn.addEventListener("click", finish);
    backBtn.addEventListener("click", function () { go(index - 1); });
    fullBtn = root.querySelector(".oa-tour-full");
    nextBtn.addEventListener("click", function () { if (index === 0) choose("quick"); else go(index + 1); });
    fullBtn.addEventListener("click", function () { choose("long"); });
  }
  // Everything beside the tour goes inert (pointer, focus, assistive tech) at
  // every level up to <body>, so Tab cannot leave the card either; the four
  // panels already cover it visually. Scripted clicks still land, so the
  // scenes above work through it.
  function setInert(on) {
    if (on) {
      for (var keep = root; keep.parentNode && keep !== document.body; keep = keep.parentNode) {
        Array.prototype.forEach.call(keep.parentNode.children, function (el) {
          if (el === keep || el.hasAttribute("inert")) return;
          el.setAttribute("inert", "");
          inerted.push(el);
        });
      }
    } else {
      inerted.forEach(function (el) { el.removeAttribute("inert"); });
      inerted = [];
    }
  }

  function layout() {
    // Mid-transition the targets come and go: hold the last frame until the
    // scene has settled and show() lays out for the new stop.
    if (!root || busy) return;
    var step = steps[index];
    var els = (step.at || step.row) ? resolve(step) : [];
    var hole = els.length ? union(els) : null;
    // A later repaint moved the targets away or down to a sliver (the metrics
    // section growing once its charts load, a pin resetting the viewport):
    // bring them back, but not in a fight with the grid - at most every 400ms.
    if (step.scene && Date.now() - lastReveal > 400 && (!hole || (hole.h < 48 && bounds(els).bottom - bounds(els).top >= 96))) {
      var loose = resolve(step, true);
      if (loose.length) {
        lastReveal = Date.now();
        reveal(loose, step.align);
        els = resolve(step);
        hole = els.length ? union(els) : null;
      }
    }
    var W = innerWidth, H = innerHeight;
    if (hole) {
      box(shades[0], 0, 0, W, hole.y);
      box(shades[1], 0, hole.y, hole.x, hole.h);
      box(shades[2], hole.x + hole.w, hole.y, W - hole.x - hole.w, hole.h);
      box(shades[3], 0, hole.y + hole.h, W, H - hole.y - hole.h);
      ring.hidden = false;
      box(ring, hole.x, hole.y, hole.w, hole.h);
    } else {
      box(shades[0], 0, 0, W, H);
      box(shades[1], 0, H, W, 0); box(shades[2], 0, H, W, 0); box(shades[3], 0, H, W, 0);
      ring.hidden = true;
    }
    place(hole, W, H);
  }
  // The card: below the spotlight when it fits, else above, else beside it;
  // where none of them clears it (a short window, the matrix filling it),
  // whichever of the four covers the least of it, kept inside the window.
  // Centred over the page when there is no spotlight; a sheet along the
  // bottom edge on phone-width windows.
  function place(hole, W, H) {
    card.style.width = W <= DOCK_W ? (W - 2 * EDGE) + "px" : "";
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var x, y, side = "";
    if (W <= DOCK_W) { x = EDGE; y = Math.max(EDGE, H - ch - EDGE); }
    else if (!hole) { x = (W - cw) / 2; y = (H - ch) / 2; }
    else {
      var cx = hole.x + hole.w / 2, cy = hole.y + hole.h / 2;
      var xMax = Math.max(EDGE, W - cw - EDGE), yMax = Math.max(EDGE, H - ch - EDGE);
      var hx = clamp(cx - cw / 2, EDGE, xMax), vy = clamp(cy - ch / 2, EDGE, yMax);
      var opts = [
        { side: "below", x: hx, y: hole.y + hole.h + GAP },
        { side: "above", x: hx, y: hole.y - GAP - ch },
        { side: "right", x: hole.x + hole.w + GAP, y: vy },
        { side: "left", x: hole.x - GAP - cw, y: vy }
      ];
      var pick0 = null, least = Infinity;
      for (var i = 0; i < opts.length; i += 1) {
        var o = opts[i];
        if (o.x >= EDGE && o.y >= EDGE && o.x <= xMax && o.y <= yMax) { pick0 = o; least = 0; break; }
        o.x = clamp(o.x, EDGE, xMax);
        o.y = clamp(o.y, EDGE, yMax);
        var ov = Math.max(0, Math.min(o.x + cw, hole.x + hole.w) - Math.max(o.x, hole.x)) *
          Math.max(0, Math.min(o.y + ch, hole.y + hole.h) - Math.max(o.y, hole.y));
        if (ov < least) { least = ov; pick0 = o; }
      }
      x = pick0.x; y = pick0.y;
      // Over the spotlight there is nothing for the caret to point at.
      side = least > 0 ? "" : pick0.side;
      if (side === "below" || side === "above") { caret.style.top = ""; caret.style.left = Math.round(clamp(cx - x - 6, 14, cw - 26)) + "px"; }
      else if (side) { caret.style.left = ""; caret.style.top = Math.round(clamp(cy - y - 6, 14, ch - 26)) + "px"; }
    }
    card.style.left = Math.round(x) + "px";
    card.style.top = Math.round(y) + "px";
    card.dataset.side = side;
  }
  function schedule() {
    if (raf || !root) return;
    raf = requestAnimationFrame(function () { raf = 0; layout(); });
  }

  // What a stop's title and body read: the tour's state and the table's.
  function context(n) {
    var step = steps[n], prev = steps[n - 1];
    var has = function (list) { return function (id) { return list.some(function (s) { return s.id === id; }); }; };
    // sceneStart: the first stop of its scene, which says what was clicked.
    return { count: steps.length - 1, vis: vis, clean: ctx0.clean, panel: ctx0.panel, mode: ctx0.mode, rule: demo.rule,
      drop: dropOf(demo.id), author: demo.author, starred: demo.starred, sceneStart: !prev || prev.scene !== step.scene,
      quick: plans.quick.length - 1, full: plans.long.length - 1, has: has(steps), hasQuick: has(plans.quick), hasFull: has(plans.long) };
  }
  function show(n) {
    index = n;
    var step = steps[n], last = n === steps.length - 1, choosing = n === 0, ctx = context(n);
    clearTimeout(pendTimer);
    card.classList.remove("is-pending");
    // The welcome card is the chooser, not a stop: the count starts after it.
    countEl.hidden = choosing;
    countEl.textContent = choosing ? "" : n + " / " + (steps.length - 1);
    titleEl.textContent = typeof step.title === "function" ? step.title(ctx) : step.title;
    shownBody = typeof step.body === "function" ? step.body(ctx) : step.body;
    bodyEl.innerHTML = shownBody;
    shownAt = Date.now();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshBody, 200);
    nextBtn.textContent = choosing ? "Quick tour" : step.next || (last ? "Finish" : "Next");
    fullBtn.hidden = !choosing;
    skipBtn.textContent = choosing ? "Not now" : "Skip the tour";
    backBtn.hidden = n === 0;
    skipBtn.hidden = last && !choosing;
    var a = document.activeElement;
    if (!card.contains(a) || a.hidden) nextBtn.focus({ preventScroll: true });
    layout();
  }
  // A card reads the table (a count, the rule a click wrote, the tiles this
  // article has), and parts can land after it does - a count, a chart. Once
  // the table has been quiet a moment, the card is read again and replaced
  // if it changed, so the text describes the example as it now stands.
  function refreshBody() {
    if (!root || busy || Date.now() - shownAt > 6000) return;
    var step = steps[index];
    if (typeof step.body !== "function" && typeof step.title !== "function") return;
    if (Date.now() - lastMut < 150) { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshBody, 160); return; }
    var ctx = context(index);
    var title = typeof step.title === "function" ? step.title(ctx) : step.title;
    var html = typeof step.body === "function" ? step.body(ctx) : step.body;
    if (html === shownBody && title === titleEl.textContent) return;
    titleEl.textContent = title;
    shownBody = html;
    bodyEl.innerHTML = html;
    layout();
  }
  // Between two stops the table moves on to the next scene: the old card must
  // not stand over the new example. The spotlight closes and the text dims
  // until text and target are ready together (show()).
  function cover() {
    if (!root || !busy) return;
    card.classList.add("is-pending");
    var W = innerWidth, H = innerHeight;
    box(shades[0], 0, 0, W, H);
    box(shades[1], 0, H, W, 0); box(shades[2], 0, H, W, 0); box(shades[3], 0, H, W, 0);
    ring.hidden = true;
  }
  // Step to stop n: set its scene first, then probe its targets. A lazy stop
  // with nothing to point at in this table (the paper has no contents, no
  // reference shares an author) is removed and the step continues in the
  // same direction, so the reader never lands on an empty spotlight.
  function go(n) {
    if (!root || busy || n < 0) return;
    if (n >= steps.length) { finish(); return; }
    var step = steps[n], forward = n >= index;
    busy = true;
    nextBtn.setAttribute("aria-busy", "true");
    // A scene change puts the next example on screen at once: cover it until
    // its card is ready. Within one scene the table only scrolls - covered
    // only if that takes a while, so quick steps do not flicker.
    clearTimeout(pendTimer);
    if ((step.scene || "none") !== atScene) cover();
    else pendTimer = setTimeout(cover, 450);
    if (n > 0) warm();
    if (step.scene) pick();
    // A scene that takes a moment says what it is doing, in the count line.
    var label = SCENE_LABELS[step.scene || "none"];
    var slow = setTimeout(function () {
      if (root && busy && n > 0) { countEl.hidden = false; countEl.textContent = n + " / " + (steps.length - 1) + " \u00b7 " + label + "\u2026"; }
    }, 300);
    ensure(step.scene || "none").then(function () {
      atScene = step.scene || "none";
      return step.ready ? waitFor(step.ready, 5000) : null;
    }).then(function () {
      return settle(step, 2);
    }).then(function () {
      // Counted up front from the data, so a part still painting (a drop's
      // text, a chart) gets a moment longer rather than being dropped.
      return (step.at || step.row) && !resolve(step).length ? waitFor(function () { return resolve(step).length > 0; }, 2500) : null;
    }).then(function () {
      clearTimeout(slow);
      busy = false;
      if (!root) return;
      nextBtn.removeAttribute("aria-busy");
      if ((step.at || step.row) && !resolve(step).length) {
        steps.splice(n, 1);
        if (n < index) index -= 1;
        if (forward) go(n);
        else if (n > 0) go(n - 1);
        else show(index);
        return;
      }
      show(n);
    });
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); if (index === 0) choose("quick"); else go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); if (index > 0) go(index - 1); }
  }

  function start() {
    if (root || starting) return;
    ensureStyles();
    window.OATheme.closePopovers();
    demo = fresh();
    warmed = false;
    atScene = "none";
    // The panel stops need the panel on screen: switched on, and a window
    // wide enough to hold it (below 1180px the toggle hides with it).
    var toggle = document.getElementById("panelToggle");
    var off = !!toggle && toggle.getAttribute("aria-pressed") === "false";
    var vp = document.querySelector("#myGrid .slick-viewport");
    ctx0 = { clean: tableClean(), panelOff: off, panel: !!toggle && !off && getComputedStyle(toggle).display !== "none", mode: "quick", top: vp ? vp.scrollTop : 0 };
    // The Affiliations stop wants a demo article with a map: the map's data,
    // the stand-in sample with it, is asked for now and read by pickDemo()
    // at the first stop that drives the table.
    var A = window.OAPaperAffiliations;
    if (ctx0.clean && ctx0.panel && A && typeof A.preload === "function") {
      try { A.preload(); } catch (e) { /* the stop just drops */ }
    }
    // Both tours are counted before the welcome card quotes them. The full
    // tour's contents stop reads the section titles: they get a moment to
    // land (any later, the stop is probed on arrival instead).
    starting = true;
    var toc = window.TOC_DATA ? null : window.OATocLoad;
    Promise.race([Promise.resolve(toc).catch(function () {}), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
      starting = false;
      // The reader began typing or filtering meanwhile: not now.
      if (root || (ctx0.clean && !tableClean())) return;
      steps = plan("long");   // pick() warms what the full tour's author stops read
      if (steps.some(function (s) { return !!s.scene; })) pick();
      plans = { quick: plan("quick"), long: plan("long") };
      steps = plans.quick;
      open();
    });
  }
  // One tour's stops, as this window and this table can show them.
  function plan(mode) {
    var c = { clean: ctx0.clean, panelOff: ctx0.panelOff, panel: ctx0.panel, mode: mode };
    return STEPS.filter(function (s) {
      if (s.tour && s.tour !== mode) return false;
      if (s.when && !s.when(c)) return false;
      if (s.probe && !s.probe()) return false;
      // Scene stops are probed when reached: their targets do not exist yet.
      if (s.scene) return !!dataRow();
      return !(s.at || s.row) || resolve(s).length > 0;
    });
  }
  // The welcome card's pick. Back to the welcome card offers it again.
  function choose(mode) {
    if (!root || busy) return;
    ctx0.mode = mode;
    steps = plans[mode];
    warmed = false;   // warm() preloads what this tour's stops read
    fullBtn.hidden = true;
    go(1);
  }
  function open() {
    returnTo = document.activeElement;
    build();
    (document.querySelector(".oa-root") || document.body).appendChild(root);
    setInert(true);
    document.addEventListener("keydown", onKey, true);
    // Any scroll moves the targets: the grid's, the panel's, the page's on a
    // short window (the wheel over the shades still scrolls it).
    document.addEventListener("scroll", schedule, true);
    addEventListener("resize", schedule);
    // The spotlight follows the grid's re-renders and the metrics panel
    // coming, going and growing (its charts load after the section shows).
    var app = document.getElementById("articles-app") || document.getElementById("myGrid");
    if (app) {
      observer = new MutationObserver(function () {
        lastMut = Date.now();
        schedule();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshBody, 200);
      });
      observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style", "open"] });
    }
    index = 0;
    go(0);
  }
  function finish() {
    if (!root) return;
    window.OAPrefs.set(DONE_KEY, "1");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("scroll", schedule, true);
    removeEventListener("resize", schedule);
    if (observer) { observer.disconnect(); observer = null; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimeout(pendTimer);
    clearTimeout(refreshTimer);
    setInert(false);
    var r = root;
    root = null;
    busy = false;
    r.remove();
    // Whatever scene the tour left the table in: matrix shut, filters back,
    // drop closed.
    try { toNone().catch(function () { /* the table keeps what it has */ }); } catch (e) { /* the table keeps what it has */ }
    // Focus goes back where the tour found it (the search field, after Browse).
    if (returnTo && returnTo.isConnected && typeof returnTo.focus === "function") {
      try { returnTo.focus({ preventScroll: true }); } catch (e) { /* not focusable any more */ }
    }
    returnTo = null;
    window.dispatchEvent(new CustomEvent("oa-tour-done"));
  }

  window.OATour = Object.freeze({
    start: start,
    finish: finish,
    isOpen: function () { return !!root; }
  });
})();
