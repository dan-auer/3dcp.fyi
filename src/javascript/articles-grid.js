/* articles-grid.js
 * SlickGrid-based article browser for the 3dcp.fyi "Articles" page.
 *
 * Loaded via a plain <script> tag on pages that carry an #articles-app
 * placeholder (the site root, index.html); it does nothing elsewhere. The component
 * shell (toolbar + grid + datalists) is injected into that placeholder, so the
 * page source stays a single line.
 *
 * SlickGrid CSS + JS are loaded lazily on first use; the article table
 * (window.ARTICLES_DATA) is fetched and parsed off-thread by data-load.js
 * (awaited via window.OADataLoad), and the
 * filter facets (authors / keywords / venues) are derived from it at runtime.
 */
(function () {
  "use strict";

  // Re-evaluating this entry script reuses the page owner and its global delegates.
  if (window.OAArticlesGrid) { window.OAArticlesGrid.init(); return; }

  // index.html's own title: the tab shows it whenever the view has no name (syncTitle).
  var PAGE_TITLE = document.title;

  /* ------------------------------------------------------------------ */
  /* Dependency configuration                                           */
  /* ------------------------------------------------------------------ */

  // Locally vendored libs. Page-derived root so it resolves at any depth + file://.
  var VENDOR = window.OAAssets.url("src/vendor/");

  var SLICK = VENDOR + "slickgrid/";

  // Inline-abstract module (oa-abstract-rows.js), lazy-loaded below.
  var JS_DIR = window.OAAssets.url("src/javascript/");

  var SLICK_CSS = [
    SLICK + "slick.grid.css",
    SLICK + "slick-alpine-theme.css"
  ];
  var STYLE_CSS = [
    window.OAAssets.url("src/style/search.css"),
    window.OAAssets.url("src/style/articles.css")
  ];

  // SortableJS powers SlickGrid's column reordering (enableColumnReorder),
  // so window.Sortable must exist before slick.grid.js builds the grid.
  // core + interactions must likewise load before slick.grid.js is evaluated.
  var SLICK_CORE = [
    VENDOR + "Sortable.min.js",
    SLICK + "slick.core.js",
    SLICK + "slick.interactions.js"
  ];

  // These all depend on slick.core.js (and slick.grid.js for the grid).
  var SLICK_REST = [
    SLICK + "slick.grid.js",
    SLICK + "slick.groupitemmetadataprovider.js",
    SLICK + "slick.dataview.js"
  ];

  /* ------------------------------------------------------------------ */
  /* Lazy asset loading (each URL is fetched at most once per session)   */
  /* ------------------------------------------------------------------ */

  var dependenciesPromise = null;

  function ensureDependencies() {
    if (dependenciesPromise) {
      return dependenciesPromise;
    }
    // The article table (window.ARTICLES_DATA) arrives through data-load.js,
    // so only SlickGrid itself is lazy-loaded here.
    dependenciesPromise = Promise.all([
      // The table's own stylesheets. index.html links them only on the
      // return path (html[data-entry="table"]); a first visit preloads them
      // and this turns the preload into a real stylesheet - already a sheet
      // on the page is a no-op for the loader.
      Promise.all(STYLE_CSS.map(window.OAAssets.loadCss)),
      Promise.all(SLICK_CSS.map(window.OAAssets.loadCss)),
      window.OAAssets.loadScripts(SLICK_CORE)
      .then(function () { return window.OAAssets.loadScripts(SLICK_REST); })
      .then(function () { return window.OAAssets.loadScripts([JS_DIR + "oa-lifecycle.js", JS_DIR + "grid-renderers.js", JS_DIR + "grid-layout.js", JS_DIR + "grid-search.js", JS_DIR + "rule-language.js", JS_DIR + "rule-editor.js", JS_DIR + "grid-rules.js", JS_DIR + "grid-settings.js", JS_DIR + "oa-abstract-rows.js", JS_DIR + "drop-metrics.js", JS_DIR + "paper-affiliation-map.js", JS_DIR + "matrix-common.js", JS_DIR + "author-panel.js", JS_DIR + "topic-panel.js", JS_DIR + "author-footer.js", JS_DIR + "grid-sort.js", JS_DIR + "grid-keys.js", JS_DIR + "grid-actions.js"]); })
    ])
      .catch(function (error) { dependenciesPromise = null; throw error; });
    return dependenciesPromise;
  }

  /* ------------------------------------------------------------------ */
  /* Window resize is bound once; it forwards to the current grid.       */
  /* (buildGrid sets activeResizeHandler each time it runs.)             */
  /* ------------------------------------------------------------------ */

  var activeResizeHandler = null;
  var activeMount = null, activeHost = null, mountGeneration = 0;
  var pageOverflow = null;

  function destroyMountedGrid() {
    var previous = activeMount;
    activeMount = null;
    activeResizeHandler = activeAbstractEscape = activePageKeyScroll = null;
    activeDatalistFocus = activeDatalistInput = null;
    if (previous) previous.destroy();
  }
  function destroyArticlesGrid() {
    mountGeneration += 1;
    destroyMountedGrid();
    if (activeHost) activeHost.dataset.gridReady = "";
    activeHost = null;
    if (pageOverflow) {
      if (document.documentElement.style.overflowY === "hidden") document.documentElement.style.overflowY = pageOverflow.html;
      if (document.body.style.overflowY === "hidden") document.body.style.overflowY = pageOverflow.body;
      pageOverflow = null;
    }
  }

  window.addEventListener("resize", function () {
    if (activeResizeHandler) {
      activeResizeHandler();
    }
  });

  // Same single-listener pattern for Escape-to-collapse-abstracts: buildGrid
  // may run more than once (instant navigation), so a per-build document
  // listener would stack up. One listener forwards to the current grid.
  var activeAbstractEscape = null;
  // PageUp / PageDown / Home / End / ArrowUp / ArrowDown scrolling for the
  // current grid, quantised to whole entries (assigned per build, same reason as
  // above).
  var activePageKeyScroll = null;
  // Lazy-datalist filler for the current grid, same single-listener pattern.
  var activeDatalistFocus = null;
  document.addEventListener("focusin", function (event) {
    if (activeDatalistFocus) activeDatalistFocus(event.target);
  }, true);
  // Same pattern for keystrokes: the rule rows are rebuilt constantly, so one
  // delegated listener re-filters the bound datalist instead of per-input ones.
  var activeDatalistInput = null;
  document.addEventListener("input", function (event) {
    if (activeDatalistInput) activeDatalistInput(event.target);
  }, true);

  // Capture phase: SlickGrid's own canvas handler also acts on these keys
  // (cell-by-cell navigation), so ours has to run first and stop it.
  document.addEventListener("keydown", function (event) {
    if (!activePageKeyScroll) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    var k = event.key;
    if (k !== "PageDown" && k !== "PageUp" && k !== "Home" && k !== "End" &&
        k !== "ArrowDown" && k !== "ArrowUp") return;
    // Leave the keys alone whenever something else owns them: text entry, and
    // any control or widget that navigates with arrows / Home / End itself
    // (toolbar tabs, autocomplete lists, menus, dialogs).
    var t = event.target;
    // Sliders (the rule builder's date slider) own every one of these keys.
    if (t && t.closest && t.closest('[role="slider"]')) return;
    // Row focus navigation owns vertical arrows, including boundaries and
    // role=button spans that are not covered by the native-control guard.
    // Group disclosures are stops of that navigation too, and the rule
    // builder's grip reorders conditions with the same keys.
    if ((k === "ArrowDown" || k === "ArrowUp") && t && t.closest &&
        t.closest("#myGrid .slick-row.oa-row-head, #myGrid .slick-row.slick-group, .rule-row")) return;
    if (t && (t.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY|OPTION)$/.test(t.tagName) ||
              (t.getAttribute && t.getAttribute("role") === "button") ||
              (t.closest && t.closest('[role="tablist"], [role="listbox"], [role="menu"], [role="dialog"], dialog')))) return;
    // Never scroll the table behind an open modal.
    if (document.querySelector("dialog:modal")) return;
    if (activePageKeyScroll(k)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && activeAbstractEscape) {
      activeAbstractEscape(event);
    }
    // "/" focuses the search box (the convention readers know from GitHub /
    // Gmail / MDN). Ignored while typing in any field or with modifiers held.
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      var t = event.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var box = document.getElementById("semanticSearch");
      if (box) { event.preventDefault(); box.focus(); box.select(); }
    }
  });

  /* ================================================================== */
  /* buildGrid: the original standalone preview script, unchanged except */
  /* that the page-level window "resize" listener was replaced by an     */
  /* assignment to activeResizeHandler (see end of function).            */
  /* ================================================================== */

  function buildGrid() {
    destroyMountedGrid();
    const scope = window.OALifecycle.create();
    activeMount = scope;

    // Relative path to the site root (from the page's pre-paint boot snippet) so
    // the grid's author/keyword/article links resolve offline (file://) and when
    // deployed (oa-boot.js always sets it).
    const REL = window.OA_REL_ROOT || "";

    const articleStore = window.OAArticleStore.get();
    const escapeHtml = window.OATheme.escapeHtml;
    const { fold: foldText, text: typesetText } = window.OATypeset;
    const authorIdOf = window.OAArticleStore.authorIdOf;
    const articles = window.ARTICLES_DATA || [];
    const articleFacets = articleStore.facets();

    /* ---------------------------------------------------------------- */
    /* Abstract reading panel (docked below the toolbar).               */
    /*                                                                  */
    /* The chevron in the leftmost column adds/removes a paper's        */
    /* abstract to a reading panel that is SEPARATE from the grid       */
    /* canvas, so row heights never change and SlickGrid's row          */
    /* virtualization stays smooth at 10k+ rows. Any number of drops    */
    /* may be open at once (no cap - rows are virtualized and abstracts */
    /* are fetched lazily). State is a Map keyed by id, in insertion    */
    /* (= open) order.                                                  */
    /* ---------------------------------------------------------------- */

    // Abstracts come inline from data/abstract_data.js (the per-record `sentences`
    // array), attached to each row by semantic-search.js (remapToTableRows -> the
    // `oa-search-ready` re-render below). The manifest is the single source of
    // truth, so this grid does NOT fetch per-article <id>.abstract.json.
    // Shared number formatter (result count, citation cells) - constructing
    // Intl.NumberFormat per call is surprisingly expensive.
    const countFormatRaw = new Intl.NumberFormat("en-US");
    // Narrow no-break space as thousands separator (12 345) - site convention.
    const countFormat = { format: function (n) { return countFormatRaw.format(n).replace(/,/g, "\u202F"); } };
    // One collator for facet sorting: raw String.localeCompare re-derives
    // collation data per call, which turns the ~15k-author sort into a
    // seconds-long init stall on slower machines.
    const facetCollator = new Intl.Collator();

    let activeRulePredicate = function () {
      return true;
    };

    // The pure language module owns the field schema used by parser and editor.
    const ruleLanguage = window.OARuleLanguage;
    const { rowsToString, conditionToString } = ruleLanguage;
    const FIELDS = ruleLanguage.FIELDS;
    const ruleFieldDefinitions = ruleLanguage.schema;
    const BOOL_RULE_FIELDS = ruleLanguage.BOOLEAN_FIELDS;
    const ruleEditor = window.OARuleEditor.create({
      window: window, document: document, language: ruleLanguage,
      theme: window.OATheme, facets: window.OASearchFacets,
      authorLabel: function (value) { return authorSlugToLabel.get(value); },
      // Any spelling of a label - case, accents, with or without the comma.
      authorSlug: function (value) {
        const v = normalizeText(value);
        return authorLabelToSlug.get(v) || authorLabelToSlug.get(v.replace(/,\s*/g, " "));
      },
      authorLabels: function () { return authorSlugToLabel.values(); },
      // null: not a known author; "" when the record has no affiliation yet.
      authorAffiliation: function (slug) {
        const a = (window.AUTHORS_DATA || {})[slug];
        return a ? String(a.affiliation || "").trim() : null;
      },
      lookupArticle: lookupArticle, facetSources: articleStore.facetSources,
      onApply: compileAndApplyRuleFilter, onResize: function () { layout.requestResize(); },
      onPinArticle: function (id) {
        const open = absRows.openIds();
        if (open.indexOf(id) < 0) toggleAbstract(id);
      }
    });
    scope.add(ruleEditor.destroy);
    const ruleTree = ruleEditor.state;

    // Presentation has a table lifetime; services and filter state remain live.
    // The one author the filter names, for the Citations cell's self-citations
    // (set once per filter change: updateActiveFilterMatchers).
    let citationAuthorSlug = "";
    const renderers = window.OAGridRenderers.create({
      theme: window.OATheme, bibliography: window.OABibliography,
      articleStore: articleStore, rel: REL, countFormat: countFormat,
      state: {
        get favorites() { return window.OAFavorites; },
        get canCite() { return typeof window.formatCitation === "function"; },
        get hasAuthorFilter() { return activeAuthorMatchers.length !== 0; },
        get hasVenueFilter() { return activeVenueMatchers.length !== 0; },
        get hasDateFilter() { return activeDateMatchers.length !== 0; },
        authorIsActive: authorIsActive,
        // The article an ID IS filter names lists all its authors.
        showAllAuthors: function (id) { return isMetricsArticle(id); },
        // Declared further down (var/function: hoisted); only read at render time.
        authorIsVisited: function (a) { return typeof authorIsVisited === "function" && visitedAuthorSet ? authorIsVisited(a) : false; },
        get visitedGen() { return visitedGen || 0; },
        venueIsActive: venueIsActive,
        dateIsActive: dateIsActive,
        sharedAuthorNames: sharedAuthorNames,
        // The author panel's author, for the citations cell's self-citations.
        get citationAuthor() { return citationAuthorSlug; },
        citationAuthorLabel: function (s) { return authorSlugToLabel.get(s) || s; },
        // The citation network arrived (built off the first paint): redraw the
        // Citations cells with their split.
        repaintCitations: function () { try { grid.invalidate(); } catch (e) { /* table not built yet */ } },
        chevronFormatter: function (row, cell, value, columnDef, item) {
          return absRows.chevronFormatter(row, cell, value, columnDef, item);
        }
      }
    });
    const columns = renderers.createColumns();

    // Wide windows give the table 125px more in every view (articles.css
    // --ap-grow) and Authors takes all of it: held at exactly 292px (min =
    // max), ~1.75x the ~167px it has in the 1304px table, so the other columns
    // keep their widths. Set before the grid exists, so its first fit is
    // already the wide one; syncWideAuthors follows the window from there.
    var wideAuthorsMQ = window.matchMedia("(min-width: 1838px)");
    var WIDE_AUTHORS_W = 292;
    var authorsCol = columns.find(function (c) { return c.id === "authors"; });
    var authorsDesign = authorsCol ? authorsCol.width : 0, authorsMin = authorsCol ? authorsCol.minWidth : 0, authorsMax = authorsCol ? authorsCol.maxWidth : undefined;
    function setAuthorsWidth(on, list) {
      var col = list.find(function (c) { return c.id === "authors"; });
      if (!col) return;
      col.minWidth = on ? WIDE_AUTHORS_W : authorsMin;
      col.maxWidth = on ? WIDE_AUTHORS_W : authorsMax;
      col.width = on ? WIDE_AUTHORS_W : authorsDesign;
    }
    var wideAuthors = wideAuthorsMQ.matches;
    if (wideAuthors) setAuthorsWidth(true, columns);

    // SlickGrid mutates widths during construction; retain the original design.
    const designWidths = Object.fromEntries(columns.map(function (c) { return [c.id, c.width]; }));

    var DATA_ROW_SPAN = 5;   // fine rows per logical row (5 x 24 = 120px) - fits 5 clamped text lines
    var TALL_ROW_MAX = 96;   // the pinned article's row, listing all its authors
    // Fine row height: a multiple of 4px, so every row edge - and so every wheel
    // stop - is a whole device pixel at 125 / 150 / 175 / 200% display scale.
    // At 23px (115px rows) every other stop fell on a half device pixel at 150%,
    // and the row under the header shifted by a pixel from one notch to the next.
    var FINE_ROW_H = 24;
    const options = {
      // No SlickGrid active cell: this is a browse grid whose cells hold real
      // links and buttons. With cell navigation on, SlickGrid claimed Tab and
      // the arrow keys for its (invisible) active-cell cursor; the roving
      // tabindex below owns row keyboard navigation instead.
      enableCellNavigation: false,
      // Allow text selection (SlickGrid otherwise preventDefaults selectstart on
      // the whole viewport, so abstracts couldn't be marked/copied). Row-drag
      // marking still suppresses selection via the .is-rowdrag class.
      enableTextSelectionOnCells: true,
      enableColumnReorder: true,
      forceFitColumns: true,
      explicitInitialization: false,
      alwaysShowVerticalScroll: true,
      // Fine base row height: each logical row spans dataSpan (5) of these, so
      // 5 x 24 = 120px data rows, but the abstract reservation quantum is 24px.
      rowHeight: FINE_ROW_H,
      // Top panel: the pinned anchor article of a live REFERENCES_OF /
      // CITATIONS_OF / SIMILAR_TO rule (syncAnchorStrip), one logical row tall,
      // shown only while such a rule is live. Sits under the header, above the
      // scrolling viewport, so the article in focus never scrolls away.
      showTopPanel: false,
      topPanelHeight: DATA_ROW_SPAN * FINE_ROW_H,
      // Keep head rows rendered while their content (data cells overflow
      // dataSpan-1=4 rows; an open abstract's card overflows more) is still in
      // the viewport during virtualized scroll. 8 covers data rows and typical
      // abstracts without blanking, while rendering far fewer fine rows per
      // scroll tick than a larger buffer would.
      minRowBuffer: 8
    };

    const groupItemMetadataProvider = new Slick.Data.GroupItemMetadataProvider({
      checkboxSelect: false
    });

    const dataView = new Slick.Data.DataView({
      groupItemMetadataProvider: groupItemMetadataProvider,
      inlineFilters: false
    });

    const grid = new Slick.Grid("#myGrid", dataView, columns, options);
    scope.add(function () { grid.destroy(true); });

    // Coalesced repaint: inside batchRepaint(fn) every grid.invalidate() - this
    // module's and the abstract rows' - folds into one, run when the outermost
    // batch ends. A pin repainted the whole table three times in one click
    // (the refresh, the row buffer, the opened abstract).
    var repaintDepth = 0, repaintPending = false, afterRepaint = [];
    const invalidateNow = grid.invalidate.bind(grid);
    grid.invalidate = function () { if (repaintDepth) repaintPending = true; else invalidateNow(); };
    function batchRepaint(fn) {
      repaintDepth++;
      try { return fn(); }
      finally {
        if (--repaintDepth === 0) {
          if (repaintPending) { repaintPending = false; invalidateNow(); }
          const queued = afterRepaint.splice(0);
          for (let i = 0; i < queued.length; i++) queued[i]();
        }
      }
    }
    // Work that must not run inside the current pass: at the end of the batch
    // when there is one (still before the click's paint), else next task.
    function afterThisPass(fn) {
      if (repaintDepth) afterRepaint.push(fn);
      else setTimeout(fn, 0);
    }

    grid.registerPlugin(groupItemMetadataProvider);

    // SlickGrid marks the sorted header with classes only; mirror the state as
    // aria-sort so assistive tech hears which column orders the list.
    const setSortColumnsRaw = grid.setSortColumns.bind(grid);
    // The sort the header showed before the latest change, for the onSort
    // handler's third click (SlickGrid's previousSortColumns holds the same
    // objects its click has already flipped).
    let sortBefore = null, sortNow = null;
    grid.setSortColumns = function (cols) {
      sortBefore = sortNow;
      setSortColumnsRaw(cols);
      const sorted = (grid.getSortColumns() || [])[0];
      sortNow = sorted && sorted.columnId ? { columnId: sorted.columnId, sortAsc: !!sorted.sortAsc } : null;
      document.querySelectorAll("#myGrid .slick-header-column[aria-sort]").forEach(function (h) { h.removeAttribute("aria-sort"); });
      const head = sorted && sorted.columnId ? document.getElementById(grid.getUID() + sorted.columnId) : null;
      if (head) head.setAttribute("aria-sort", sorted.sortAsc ? "ascending" : "descending");
    };

    // Keyboard sorting. SlickGrid's sortable headers are bare divs with a click
    // handler, so no key could reach them: the column name becomes the
    // header's button - a Tab stop whose Enter / Space clicks the header the
    // way a pointer does (same handler, same direction toggle). Non-sortable
    // headers stay plain.
    function makeSortHeaderOperable(node, column) {
      const name = node && node.querySelector(".slick-column-name");
      if (!name) return;
      if (column && column.sortable) {
        name.classList.add("oa-sort-btn");
        name.setAttribute("role", "button");
        name.setAttribute("tabindex", "0");
        // An icon-only header (Access) has no text to name the button.
        if (!(name.textContent || "").trim()) {
          name.setAttribute("aria-label", String(column.toolTip || node.getAttribute("title") || "").trim() || "Sort by " + column.id);
        }
      } else if (name.classList.contains("oa-sort-btn")) {
        name.classList.remove("oa-sort-btn");
        name.removeAttribute("role");
        name.removeAttribute("tabindex");
        name.removeAttribute("aria-label");
      }
    }
    scope.subscribe(grid.onHeaderCellRendered, function (e, args) { makeSortHeaderOperable(args && args.node, args && args.column); });
    grid.getColumns().forEach(function (c) { makeSortHeaderOperable(document.getElementById(grid.getUID() + c.id), c); });
    scope.listen(document.getElementById("myGrid"), "keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      const btn = event.target && event.target.closest ? event.target.closest(".oa-sort-btn") : null;
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const headerId = (btn.closest(".slick-header-column") || {}).id;
      btn.click();
      // Should the header be rebuilt by the sort, land on the same column.
      if (!btn.isConnected && headerId) {
        const again = document.getElementById(headerId);
        const b = again && again.querySelector(".oa-sort-btn");
        if (b) b.focus({ preventScroll: true });
      }
    });

    const layout = window.OAGridLayout.create({
      window: window, document: document, parentScope: scope,
      grid: grid, columns: columns, designWidths: designWidths,
      summaryOrder: renderers.summaryOrder, renderSummary: renderers.hiddenColumnsSummary,
      escapeHtml: escapeHtml,
      effects: {
        clearCellMeasurements: function () { kwClampCache.clear(); },
        updateFooterTracks: function () { authorFooter.sync(); syncAnchorStrip(); },
        summaryChanged: function (id) {
          if (!absRowsRef) return;
          if (id && absRowsRef.invalidateDrop) absRowsRef.invalidateDrop(id);
          if (absRowsRef.count()) { absRowsRef.remeasure(true); absRowsRef.render(true); }
        },
        resizeAbstracts: function () {
          // The column layout is part of the drop geometry (the card's inner
          // bounds follow specific columns): its key makes a pure redistribution
          // of widths, or a reorder, count as a geometry change even when the
          // total width did not move. Returns true when reservations changed
          // (the caller renders). Row heights follow the layout too: new widths
          // re-wrap every text cell, so the rows are re-estimated here and
          // re-measured after the render.
          var spans = absRows.resetRowSpans();
          if (!absRows.remeasure(false, columnLayoutKey()) && !spans) return false;
          absRows.rebuild();
          grid.updateRowCount();
          return true;
        },
        reconcileAbstracts: function () { if (absRows.reconcile) absRows.reconcile(); }
      }
    });
    function columnLayoutKey() {
      try {
        return grid.getColumns().map(function (c) { return c.id + ":" + (c.width | 0); }).join(",");
      } catch (e) { return ""; }
    }

    // First guess at a data row's height, in fine rows (FINE_ROW_H), from its text
    // cells alone. absRows measures each row once it renders (fitRows) and
    // replaces the guess; the guess only has to keep the scrollbar honest and
    // corrections rare. Per-character widths are the author cell's own ~6.8px
    // approximation at the 14px body size in Inter, which sets ~6% wider than
    // the Arial these were first tuned on (line height 1.26 -> 17.64px).
    var spanEstCols = {}, spanEstKey = null, spanEstimates = new Map();
    function rowSpanLayoutKey() {
      var key = columnLayoutKey();
      if (key !== spanEstKey) {
        spanEstKey = key;
        spanEstimates.clear();
        spanEstCols = {};
        try { grid.getColumns().forEach(function (c) { if (!c.hidden) spanEstCols[c.id] = c.width || 0; }); } catch (e) { /* no grid yet */ }
      }
      return key;
    }
    function estLines(length, width, charPx) {
      if (!length || !width) return 0;
      return Math.min(5, Math.ceil(length / Math.max(8, Math.floor((width - 16) / charPx))));
    }
    function chipRows(labels, width, charPx, padPx, maxRows) {
      if (!labels.length || !width) return 0;
      var line = Math.max(40, width - 16), rows = 1, used = 0;
      for (var i = 0; i < labels.length; i++) {
        var w = String(labels[i]).length * charPx + padPx;
        if (used && used + w > line) { rows++; used = 0; }
        used += w;
      }
      return Math.min(maxRows, rows);
    }
    function estimateRowSpan(item, all) {
      var src = item.__src || item;
      // all: the pinned article, listing every author (oa-abstract-rows.js
      // config.tallId) - estimated from all of them, past the ceiling, and not
      // cached (the same article has the normal estimate once unpinned).
      var hit = !all && spanEstimates.get(src.id);
      if (hit) return hit;
      var cols = spanEstCols, LINE = 17.64, px = 0;
      if (cols.title) px = Math.max(px, 13 + estLines(String(src.title || "").length + String(src.subtitle || "").length, cols.title, 7.2) * LINE);
      // Author lines and chip rows share one pitch (articles.css: 22px, 24px on
      // a touch screen), ~3px down.
      var PITCH = renderers.linePitch || 22;
      if (cols.authors && renderers.authorLineCount) px = Math.max(px, 3 + renderers.authorLineCount(src, cols.authors, !!all) * PITCH);
      if (cols.venue) px = Math.max(px, 13 + estLines(String(src.venue || "").length, cols.venue, 6.8) * LINE);
      if (cols.keywords && Array.isArray(src.keywords)) px = Math.max(px, 3 + chipRows(src.keywords, cols.keywords, 6.6, 20, all ? 40 : 3) * PITCH);
      if (cols.category) px = Math.max(px, 3 + chipRows(articleStore.categoryCodes(src), cols.category, 7.4, 22, 5) * PITCH);
      var span = Math.max(2, Math.min(all ? TALL_ROW_MAX : DATA_ROW_SPAN, Math.ceil(px / FINE_ROW_H)));
      if (!all) spanEstimates.set(src.id, span);
      return span;
    }

    /* ================================================================== */
    /* Inline abstract "drop-down" rows (SlickGrid RowDetail pattern).     */
    /*                                                                     */
    /* Clicking a row expands it IN PLACE: an abstract panel drops down    */
    /* directly beneath the row and the rows below shift down, like an     */
    /* accordion. Core SlickGrid positions every row by a CONSTANT         */
    /* rowHeight, so a genuinely taller row is impossible - the detail is  */
    /* instead built from k fixed-height "detail" rows (1 content + spacer  */
    /* rows that reserve the vertical space) injected as a DISPLAY-ONLY     */
    /* overlay. The grid - and its getFormatter - read row data through    */
    /* exactly getLength / getItem / getItemMetadata on the DataView, so    */
    /* wrapping those three splices the extra rows in at render time only.  */
    /* The DataView's items[] are never touched, so sort / filter / group / */
    /* favorites keep working unchanged and each drop automatically follows */
    /* its parent (vanishing when it is filtered/collapsed away, reappearing*/
    /* when it returns).                                                   */
    /* ================================================================== */
    // Inline abstract drop-downs, via the shared OAAbstractRows overlay. It
    // wraps the DataView's getLength/getItem/getItemMetadata (captured here
    // first) to splice detail rows in at render time only - the DataView's
    // items, and thus sort / filter / group / favorites, are never touched.
    const dvGetLength = dataView.getLength.bind(dataView);
    const dvGetItem = dataView.getItem.bind(dataView);
    const dvGetItemMetadata = dataView.getItemMetadata.bind(dataView);

    // Excel-style row marking (oa-row-select.js). Declared before the abstract
    // overlay so its rowClass hook can read it; attached further down once the
    // click delegates exist.
    var rowSel = null;
    // Hoisted handle on the abstract-rows controller for code that can run
    // before the `const` below is initialised (the responsive column pass fires
    // during grid construction).
    var absRowsRef = null;
    const absRows = window.OAAbstractRows.create({
      grid: grid,
      dataSource: dataView,
      base: {
        getLength: dvGetLength,
        getItem: dvGetItem,
        getItemMetadata: dvGetItemMetadata,
        getItemById: lookupArticle
      },
      rowHeight: options.rowHeight,
      dataSpan: DATA_ROW_SPAN,        // at most 5 stacked fine rows per data row
      rowSpan: estimateRowSpan,       // fewer when the content is shorter (measured after render)
      // The ID IS article may grow past the ceiling, to list all its authors.
      tallId: function () { const p = ruleEditor.idFilterArticleId(); const it = p !== null ? lookupArticle(p) : null; return it ? it.id : null; },
      tallMax: TALL_ROW_MAX,
      layoutKey: rowSpanLayoutKey,
      maxDetailRows: 96,              // fine rows -> a long abstract + TOC fit (~2200px)
      detailColId: columns[0].id,     // the leftmost ("expand") column
      tocAlignColId: "keywords",      // drop TOC column aligns with the Keywords column
      stripAlignColId: "citations",   // records strip's Graph tiles end on the Citations bar's right edge
      renderBody: function (item) {
        // While a search is active, render the abstract with semantic + lexical
        // highlighting; otherwise null -> the component's plain renderer.
        if (item && item.id && window.OASemanticSearch && window.OASemanticSearch.renderAbstractBody) {
          return window.OASemanticSearch.renderAbstractBody(item.id);
        }
        return null;
      },
      // Score badges for the active search, placed on the "Abstract" head row
      // beside the read-aloud button ("" when the row is not a search hit).
      renderHeadExtra: function (id) {
        var ss = window.OASemanticSearch;
        return (id && ss && ss.renderScoreMeta) ? ss.renderScoreMeta(id) : "";
      },
      // The layout owner supplies metadata hidden by width or saved choices.
      renderSummary: layout.renderSummary,
      summarySig: layout.summarySignature,
      // Graph metrics below the abstract (drop-metrics.js) - only in the drop of
      // the article an ID IS filter names, and only while the right-margin
      // panel can't hold them (toggled off, or no room below 1180px); otherwise
      // they sit in the panel. afterSig re-keys the memoised drop HTML when that
      // article, the metrics' load state, their scale or their place changes.
      renderAfter: function (item) {
        return (item && isMetricsArticle(item.id) && !metricsInPanel()) ? window.OADropMetrics.sectionHtml(item) : "";
      },
      afterSig: function () {
        return (ruleEditor.idFilterArticleId() || "") + "|" + window.OADropMetrics.sig() + (metricsInPanel() ? "|panel" : "");
      },
      mountNode: document.getElementById("myGrid"),
      readAloud: true,                // "Read the abstract" button in each drop
      skipRow: isNestedEchoGroup,
      rowClass: function (it) {
        const c = rowSel ? rowSel.rowClass(it) : "";
        // The pinned article's row: its cells keep their content in view while
        // its full author list scrolls by (articles.css .oa-row-allau).
        return it && it.id != null && isMetricsArticle(it.id) ? (c ? c + " " : "") + "oa-row-allau" : c;
      },
      // Row-body clicks and Escape originate inside the component; route them
      // through the same host functions as the chevron and the toolbar so a
      // manual close / collapse-all is recorded once, whatever control did it.
      onUserToggle: function (id) { toggleAbstract(id); },
      onUserClear: function () { clearAbstracts(); },
      onChange: function () { syncCollapseAbstractsButton(); syncRowBuffer(); }
    });
    absRowsRef = absRows;
    scope.add(absRows.destroy);
    // The metrics' code and data arrive after the first pinned drop asked for
    // them: re-render, so it swaps its loading line for the charts and re-fits.
    scope.add(window.OADropMetrics.onChange(function () { absRows.render(true, true); syncAuthorPanel(); }));

    // The article an ID IS filter names; its open abstract shows its graph metrics.
    function isMetricsArticle(id) {
      const pin = ruleEditor.idFilterArticleId();
      return pin !== null && id != null && normalizeText(pin) === normalizeText(id);
    }

    /* Citation and BibTeX accept the complete row. The canonical adapter
       handles optional flat fields and legacy metadata without dropping any. */
    const CITE_STYLE_KEY = "oa-cite-style";
    function citeStyle() {
      var styles = window.CITE_STYLES || ["Chicago"];
      var s = window.OAPrefs.get(CITE_STYLE_KEY);
      return styles.indexOf(s) >= 0 ? s : styles[0];
    }
    function copyCitation(id) {
      // lookupArticle, not dataView.getItemById: under category grouping the
      // DataView is keyed by _rowKey and cannot answer an article id.
      var item = lookupArticle(id);
      if (!item) return;
      var article = item;
      var style = citeStyle();
      var r = window.formatCitationRich(article, style);
      var done = window.OABrowserActions.copyRich(r.plain, r.html);
      Promise.resolve(done).then(scope.guard(function (ok) {
        window.OATheme.copyToast(ok === false ? "Copy failed" : style + " reference copied", ok !== false);
      }));
    }

    /* Open the freely available PDF. Unpaywall is asked first (its location
       is the freshest); the record's stored pdfUrl is the fallback when the
       lookup fails or finds nothing, and the only route for a row with no DOI.

       The popup is opened EMPTY and synchronously, before the fetch: a
       window.open() that happens after an await has lost the user-gesture
       context and browsers block it as an unsolicited popup. It is then
       pointed at the PDF, or closed again if there is no free copy. */
    // Unpaywall, once per DOI per session (sessionStorage; memory when storage
    // is blocked). A failed lookup is not cached, so a retry still asks.
    const unpaywallMemo = new Map();
    function unpaywallLookup(doi) {
      const key = "oa-upw:" + doi;
      let hit = unpaywallMemo.get(doi);
      if (!hit) { try { const s = sessionStorage.getItem(key); if (s) hit = JSON.parse(s); } catch (e) { /* storage off */ } }
      if (hit) return Promise.resolve(hit);
      return fetch("https://api.unpaywall.org/v2/" + doi + "?email=info@3dcp.fyi")
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
        .then(function (d) {
          const loc = d && d.best_oa_location;
          const slim = { best_oa_location: loc ? { url_for_pdf: loc.url_for_pdf || "", url: loc.url || "" } : null };
          unpaywallMemo.set(doi, slim);
          try { sessionStorage.setItem(key, JSON.stringify(slim)); } catch (e) { /* quota / storage off */ }
          return slim;
        });
    }
    function httpUrl(raw) {
      try {
        const u = new URL(String(raw || ""));
        return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
      } catch (e) { return ""; }
    }
    function openPdf(id) {
      var item = lookupArticle(id);
      if (!item) return;
      var stored = httpUrl(item.pdfUrl);
      // A stored doi.org link is the DOI again, not a PDF: it lands on the
      // publisher's page. It still gives Unpaywall a DOI to look up.
      var resolver = /^https?:\/\/(?:dx\.)?doi\.org\//i.test(stored);
      var doi = item.doi ? window.OABibliography.normalizeDoi(item.doi) : "";
      if (!doi && resolver) {
        try { doi = window.OABibliography.normalizeDoi(decodeURIComponent(new URL(stored).pathname.slice(1))); } catch (e) { doi = ""; }
      }
      if (!doi && !stored) return;
      if (!doi) { window.OABrowserActions.openWindow(stored, "oa-pdf-popup", 1100, 900, { title: "PDF" }); return; }
      var win = window.OABrowserActions.openWindow("", "oa-pdf-popup", 1100, 900, { title: "PDF" });
      // The popup is blank until Unpaywall answers - say what it is waiting on
      // instead of showing an empty window (the fetch can take a second).
      if (win) {
        try {
          var dark = document.documentElement.getAttribute("data-scheme") === "dark";
          var d = win.document;
          d.open();
          d.write('<!doctype html><title>Opening PDF\u2026</title><body style="margin:0;height:100vh;display:grid;place-items:center;font:14px Arial,sans-serif;background:' +
            (dark ? "#141618;color:#b6bac2" : "#fff;color:#555") + '">Looking up the free PDF via Unpaywall\u2026</body>');
          d.close();
        } catch (e) { /* cross-origin quirk: leave it blank */ }
      }
      function fail(msg) {
        // Unpaywall had nothing (or could not be reached): the stored link -
        // saying so when it is only the publisher's page.
        if (stored) {
          if (win) win.location.replace(stored);
          if (resolver) window.OATheme.copyToast(msg + " - opened the publisher\u2019s page", false, 3200);
          return;
        }
        if (win) { try { win.close(); } catch (e) { /* ignore */ } }
        window.OATheme.copyToast(msg, false);
      }
      // The DOI sits in the path, so it must NOT be percent-encoded (its "/"
      // is a real path separator as far as the API is concerned). Answers are
      // kept for the session: a second click on the same paper (or the same
      // DOI from another row) must not ask Unpaywall again.
      unpaywallLookup(doi)
        .then(function (d) {
          var loc = d && d.best_oa_location;
          var url = httpUrl(loc && (loc.url_for_pdf || loc.url));
          if (!url) { fail("No free PDF found for this DOI"); return; }
          if (win) win.location.replace(url);
        })
        .catch(function () { fail("Couldn't reach Unpaywall"); });
    }

    function toggleAbstract(id) {
      // Closing a hit BY HAND during a search is a decision: remember it so the
      // scroll-driven auto-open does not reopen the same abstract two rows
      // later (which made "collapse" look broken).
      var wasOpen = absRows.isOpen(id);
      absRows.toggle(id);
      searchController.abstractToggled(id, wasOpen);
    }
    function clearAbstracts() {
      // Same rule for "collapse all": while a search is active, stop the
      // automatic expansion until the reader changes the query.
      searchController.abstractsCleared();
      absRows.clear();
    }

    // Reflect how many abstracts are open on the toolbar's "Collapse
    // abstracts" button - inert (dimmed) when none are open.
    function syncCollapseAbstractsButton() {
      const btn = document.getElementById("collapseAbstracts");
      if (!btn) return;
      const n = absRows.count();
      btn.disabled = n === 0;
      btn.title = n > 0
        ? "Hide " + n + " open abstract" + (n === 1 ? "" : "s")
        : "No open abstracts to hide";
    }

    // A contextual toolbar button that leaves the row - or goes inert - on use
    // must not strand keyboard focus on <body>: hand it to the next sensible
    // control. (The Filters and Group-by x stay in place but disable.)
    function keepKeyboardFocus(from, to) {
      window.requestAnimationFrame(function () {
        if (!from || !(from.hidden || from.disabled) || !to || to.hidden || to.disabled) return;
        if (document.documentElement.getAttribute("data-input") !== "kb") return;
        const at = document.activeElement;
        if (!at || at === document.body || !at.isConnected || at.disabled || at.closest("[hidden]")) to.focus({ preventScroll: true });
      });
    }

    // Keep SlickGrid's row buffer at least as tall as the tallest open abstract.
    // Each open card is painted by its head row overflowing DOWN across the
    // reserved rows; SlickGrid prunes that head row once it passes the buffer
    // above the viewport, blanking the card while it's still partly visible.
    // Sizing the buffer to the tallest card keeps the head rendered until the
    // whole card has scrolled out. Reverts toward 8 as cards close.
    function syncRowBuffer() {
      if (!grid || !grid.getOptions || !grid.setOptions) return;
      var span = absRows.maxOpenRowSpan();
      var desired = Math.max(8, span + 3);
      if (grid.getOptions().minRowBuffer !== desired) {
        // Suppress setOptions' implicit re-render / column reset: minRowBuffer
        // is only read on the NEXT render pass. When the buffer GROWS, that next
        // pass has to happen now - a head row that just fell outside the old
        // buffer paints its drop, and the rows under it would otherwise show
        // the drop's empty spacers until the next scroll tick.
        var grew = desired > (grid.getOptions().minRowBuffer || 0);
        grid.setOptions({ minRowBuffer: desired }, true, true, true);
        if (grew) { try { grid.invalidate(); } catch (e) {} }
      }
    }

    // Escape clears the row selection first; a second Escape collapses every
    // open abstract. Forwarded from the single module-level keydown listener so
    // repeated buildGrid runs (instant navigation) don't stack duplicate
    // listeners.
    activeAbstractEscape = function (event) {
      var tag = (event.target && event.target.tagName) || "";
      if (rowSel && rowSel.count() && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        rowSel.clear();
        return;
      }
      absRows.escape(event);
    };

    // Clamp keyword chips to at most 3 wrapped rows. When a cell overflows, the
    // extra chips are hidden and a trailing "+N" marker is appended, whose
    // tooltip names the keywords it stands for.
    //
    // Performance: a given cell is measured once PER WIDTH (the width it was
    // measured at is recorded on the cell node). SlickGrid creates fresh cell
    // nodes when a row enters the viewport or when the grid is invalidated
    // (sort / filter / resize), so this naturally re-measures exactly when it is
    // needed - never on every scroll frame. Calls are coalesced into one pass per
    // frame, and reads are batched before writes to avoid layout thrashing.
    const KEYWORD_MAX_ROWS = 3;

    // Cache of clamp decisions, keyed by cell width + the cell's ordered keyword
    // slugs -> number of leading chips to keep visible (rest hidden + "+N").
    // SlickGrid recreates cell nodes as rows scroll into view, so without this
    // the forced-reflow measurement below would re-run for every keyword cell on
    // every scroll frame (the actual scroll-jank source). On a hit we re-apply
    // the stored decision with pure DOM writes and ZERO layout reads.
    const kwClampCache = new Map();

    // "+N" marker for the chips the clamp hides. The count tells the reader how
    // much is behind it; the tooltip spells out exactly which keywords those are,
    // so nothing is lost by the clamp.
    function keywordListOf(chips) {
      const out = [];
      for (let i = 0; i < chips.length; i++) {
        out.push(chips[i].getAttribute("data-keyword") || chips[i].textContent.trim());
      }
      return out;
    }

    function setKeywordMore(more, hiddenList) {
      const n = hiddenList.length || 1;
      more.textContent = "+" + n;
      more.setAttribute("aria-label", "Show " + n + " more keywords: " + hiddenList.join(", "));
      more.title = hiddenList.join(", ");
    }

    function appendKeywordMore(cell, hiddenList) {
      const more = document.createElement("span");
      more.className = "keyword-link keyword-more";
      // A real control now: it opens the hidden keywords (grid-actions.js popover).
      // tabindex -1: an arrow stop inside the row, not an extra Tab stop.
      more.setAttribute("role", "button");
      more.setAttribute("tabindex", "-1");
      setKeywordMore(more, hiddenList || []);
      cell.appendChild(more);
      return more;
    }

    // Prepare every cell before measuring any chip. Active terms retain their
    // existing stable front ordering, and cache hits use DOM writes only.
    function prepareKeywordClamp(cell, cellWidth) {
      if (activeKeywordMatchers.length) {
        const original = cell.querySelectorAll(".keyword-link");
        let anchor = null;
        for (let i = 0; i < original.length; i++) {
          const chip = original[i];
          if (keywordIsActive(chip.getAttribute("data-keyword") || "")) {
            chip.classList.add("is-kw-match");
            if (anchor === null) cell.insertBefore(chip, cell.firstChild);
            else anchor.insertAdjacentElement("afterend", chip);
            anchor = chip;
          }
        }
      }
      // The ID IS article's row shows every keyword, as it does every author.
      if (cell.closest(".oa-row-allau")) return null;
      const chips = Array.from(cell.querySelectorAll(".keyword-link"));
      if (!chips.length) return null;
      let sig = String(cellWidth) + "\u001e";
      for (let i = 0; i < chips.length; i++) sig += (chips[i].getAttribute("data-keyword") || "") + "\u001f";
      if (kwClampCache.has(sig)) {
        const showN = kwClampCache.get(sig);
        if (showN < chips.length) {
          for (let i = showN; i < chips.length; i++) chips[i].style.display = "none";
          appendKeywordMore(cell, keywordListOf(chips.slice(showN)));
        }
        return null;
      }
      return { cell: cell, chips: chips, sig: sig, showN: chips.length, more: null, lastAllowed: 0 };
    }

    /* Category grouping ------------------------------------------------------
     * The taxonomy in src/category_data.js is three deep: chapter (XX.00.00,
     * level 1) > category (XX.YY.00) > subcategory (XX.YY.ZZ), linked by
     * `parent`. "Group by category" mirrors that scheme as three nested
     * SlickGrid groups. An article carries SEVERAL assignments, so grouping
     * needs one row per (article, category) pair - the same article therefore
     * appears under every category it was assigned to (duplicates intended).
     * Assignments coarser than level 3 repeat their own node at the deeper
     * levels; that echo group holds the parent's DIRECT entries and is shown
     * with an empty label (see isEchoCategoryGroup), first inside its parent.
     * Articles with no assignment at all are not part of this view. */
    // Set while "group by category" is active. A plain var (not the `let
    // activeGrouping` further down) so it can be read from the very first
    // render pass without a temporal-dead-zone risk.
    var categoryGroupingOn = false;

    // A PADDED (echo) group: an assignment coarser than level 3 - XX.00.00 or
    // XX.YY.00 - repeats its own node at the deeper grouping levels. Such a
    // group holds its parent's DIRECT entries, so it gets an empty label
    // instead of restating the parent, and sorts first inside it.
    function isEchoCategoryGroup(group) {
      var def = (window.CATEGORY_DEFS || {})[group && group.value];
      return !!def && (def.level || 1) < (group.level || 0) + 1;
    }

    // How many trailing segments of a group's path repeat: 1 for the single
    // padding a category-level (XX.YY.00) assignment needs, 2 for the double
    // padding a chapter-level (XX.00.00) one needs.
    function echoDepth(group) {
      var parts = String((group && group.groupingKey) || "").split(":|:");
      var n = 0;
      for (var i = parts.length - 1; i > 0 && parts[i] === parts[i - 1]; i--) n++;
      return n;
    }

    // Only the FIRST padded group is shown (it is the fold holding the parent's
    // direct entries). A chapter-level assignment pads twice, and that second,
    // nested echo would just indent the same rows again - so it is dropped from
    // the display entirely (the overlay's skipRow veto).
    function isNestedEchoGroup(item) {
      return !!(categoryGroupingOn && item && item.__group && echoDepth(item) > 1);
    }

    function categoryPath(abbr) {
      var defs = window.CATEGORY_DEFS || {};
      var path = [], node = abbr, guard = 0;
      while (node && defs[node] && guard++ < 8) { path.unshift(node); node = defs[node].parent; }
      if (!path.length) path.push(abbr);
      // Pad by ECHOING the deepest node: the echo groups are then suppressed,
      // which puts coarse assignments directly under their own group.
      while (path.length < 3) path.push(path[path.length - 1]);
      return path.slice(0, 3);
    }

    // Shallow VIEW over the article via the prototype chain: the clone carries
    // only its own row key + group path; other data comes from the article.
    // The renderer keys its HTML cache by __src, so an article assigned to five
    // categories costs five tiny objects and shares one presentation cache.
    // Consumers keyed on the real
    // article id (favorites, abstracts, row selection, search) are unaffected;
    // anything that needs the pristine record reads __src.
    function categoryRowClone(item, abbr) {
      var path = categoryPath(abbr);
      var c = Object.create(item);
      c.__src = item;
      c._rowKey = item.id + "\u0001" + abbr;
      c._cat1 = path[0];
      c._cat2 = path[1];
      c._cat3 = path[2];
      return c;
    }

    var categoryRowCache = null;
    function categoryRows() {
      if (categoryRowCache) return categoryRowCache;
      var out = [];
      for (var i = 0; i < articles.length; i++) {
        var abbrs = articleStore.categoryCodes(articles[i]);
        // No assignment -> no place in the taxonomy: the article is simply not
        // part of this view (it stays visible in every other grouping).
        if (!abbrs.length) continue;
        for (var j = 0; j < abbrs.length; j++) out.push(categoryRowClone(articles[i], abbrs[j]));
      }
      categoryRowCache = out;
      return out;
    }

    // Article lookup by REAL article id. While category grouping is on, the
    // DataView is keyed by _rowKey and can't answer an article id, so fall
    // back to a map over the pristine article list.
    var articleByIdMap = null, articleByKeyMap = null;
    function lookupArticle(id) {
      var hit = dataView.getItemById(id);
      if (hit) return hit;
      if (!articleByIdMap) {
        articleByIdMap = new Map();
        for (var i = 0; i < articles.length; i++) articleByIdMap.set(articles[i].id, articles[i]);
      }
      hit = articleByIdMap.get(id);
      if (hit || id == null) return hit;
      // An ID typed or linked in another case or with stray spaces: the rule
      // matches it (normalizeText), so the lookup does too - else the row was
      // pinned (all authors) while the panel stayed away.
      if (!articleByKeyMap) {
        articleByKeyMap = new Map();
        for (var j = 0; j < articles.length; j++) articleByKeyMap.set(normalizeText(articles[j].id), articles[j]);
      }
      return articleByKeyMap.get(normalizeText(id));
    }

    // "Did you mean": the articles closest to an ID no article has - an old
    // link (the year moved from online-first to print, a title or author list
    // corrected since) or a typo. IDs are <authors>.<year>.<title initials>:
    // two parts alike weigh most, then the edit distance of the rest.
    var idIndex = null, idIndexOf = null, suggestCache = { key: null, list: [] };
    function splitArticleId(id) {
      const p = String(id).split(".");
      if (p.length !== 3) return null;
      const y = /^(\d{4})([a-z]?)$/.exec(p[1]);
      if (p[1] && !y) return null;
      return { a: p[0].toLowerCase(), y: y ? +y[1] : null, s: y ? y[2] : "", t: p[2].toLowerCase() };
    }
    // Edit distance, given up past cap (returns cap + 1).
    function editDistance(a, b, cap) {
      if (Math.abs(a.length - b.length) > cap) return cap + 1;
      let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
      for (let j = 0; j <= b.length; j++) prev[j] = j;
      for (let i = 1; i <= a.length; i++) {
        cur[0] = i;
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
          const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
          cur[j] = v;
          if (v < rowMin) rowMin = v;
        }
        if (rowMin > cap) return cap + 1;
        const t = prev; prev = cur; cur = t;
      }
      return Math.min(prev[b.length], cap + 1);
    }
    function yearDistance(w, c) {
      if (w.y === null || c.y === null) return w.y === c.y ? 0 : 1;
      const d = Math.abs(w.y - c.y);
      return d === 0 ? (w.s === c.s ? 0 : 0.5) : d === 1 ? 1 : 2 * d;
    }
    function suggestArticles(wanted) {
      const raw = String(wanted || "").trim(), key = raw.toLowerCase();
      if (idIndexOf !== articles) {
        idIndexOf = articles;
        idIndex = articles.map(function (a) { return { art: a, p: splitArticleId(a.id), l: String(a.id).toLowerCase() }; });
        suggestCache = { key: null, list: [] };
      }
      if (suggestCache.key === key) return suggestCache.list;
      const w = splitArticleId(raw), found = [];
      if (w) {
        const typoCap = Math.max(2, Math.round(0.15 * (w.a.length + w.t.length)));
        for (let i = 0; i < idIndex.length; i++) {
          const c = idIndex[i].p;
          if (!c) continue;
          const dy = yearDistance(w, c);
          if (dy > 6) continue;
          const da = editDistance(w.a, c.a, 8), dt = editDistance(w.t, c.t, 8);
          const score = da + dt + dy;
          const alike = (da === 0 && dt === 0) || (da === 0 && dy <= 1) ||
            (dt === 0 && dy <= 1 && da <= Math.max(2, w.a.length / 2));
          if (alike || score <= typoCap) found.push({ art: idIndex[i].art, score: score });
        }
      } else {
        // Not even key-shaped (a dot lost or doubled): the whole ID's distance.
        const wl = key.replace(/\s+/g, ""), cap = Math.max(2, Math.round(wl.length * 0.15));
        for (let i = 0; i < idIndex.length; i++) {
          const d = editDistance(wl, idIndex[i].l, cap);
          if (d <= cap) found.push({ art: idIndex[i].art, score: d });
        }
      }
      found.sort(function (x, y) { return x.score - y.score || (x.art.id < y.art.id ? -1 : 1); });
      const best = found.length ? found[0].score : 0;
      const list = found.filter(function (f) { return f.score <= best + 3; }).slice(0, 3).map(function (f) { return f.art; });
      suggestCache = { key: key, list: list };
      return list;
    }
    // "Mechtcherine, Muthukrishnan, Robertson et al. · 2025"
    function suggestMeta(art) {
      const au = (art.authors || []).map(function (a) { return ((a.prefix ? a.prefix + " " : "") + (a.lastName || "")).trim(); }).filter(Boolean);
      const names = au.slice(0, 3).join(", ") + (au.length > 3 ? " et al." : "");
      const year = String(art.date || "").slice(0, 4);
      return [names, year].filter(Boolean).join(" \u00b7 ");
    }
    // The list's address with that one rule's ID swapped: the suggestion is a
    // real link (new tab, copy) - a plain click swaps in place.
    function suggestionHref(row, id) {
      // The rows as they stand, that one value swapped (queryForUrl serialises
      // the applied snapshot, not these live rows).
      const q = ruleLanguage.rowsToString(ruleTree.rows.map(function (r) {
        return r.id === row.id ? Object.assign({}, r, { value: id }) : r;
      }));
      const rest = window.location.search.replace(/^\?/, "").split("&").filter(function (p) { return p && !/^q=/i.test(p); }).join("&");
      return window.location.pathname + "?q=" + encodeURIComponent(q) + (rest ? "&" + rest : "") + window.location.hash;
    }

    // Category chips: pull any chip matching the active CATEGORY rules to the
    // front and tag it, mirroring what prepareKeywordClamp does for keywords.
    // No clamp here - a category cell holds a handful of 5-letter chips, so
    // nothing ever needs hiding behind a "\u2026".
    function markOneCategoryCell(cell) {
      if (!activeCategoryMatchers.length) return;
      const chips = cell.querySelectorAll(".oa-cat-chip");
      let anchor = null;
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        if (!categoryIsActive(c.getAttribute("data-category") || "")) continue;
        c.classList.add("is-cat-match");
        if (anchor === null) cell.insertBefore(c, cell.firstChild);
        else anchor.insertAdjacentElement("afterend", c);
        anchor = c;
      }
    }

    // Same one-pass-per-cell-node guard as the keyword clamp: SlickGrid builds
    // fresh cell nodes on scroll-in and on invalidate (sort / filter / resize),
    // so the flag resets exactly when the work needs redoing.
    function markCategoryCells() {
      const cells = document.querySelectorAll("#myGrid .category-cell");
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.__catMarked) continue;
        markOneCategoryCell(cell);
        cell.__catMarked = true;
      }
    }

    // A head row is at most DATA_ROW_SPAN fine rows tall, so a paper with many
    // categories can need more height than its cell can ever have. The chips
    // that would be cut off are hidden behind a "+N" control that opens them
    // (.kw-pop), as in the keyword cell. Width-dependent like the keyword
    // clamp: a cell is re-measured from a clean slate when its width changes.
    const catClampCache = new Map();   // width + chip set -> chips shown
    function setCategoryMore(more, n) {
      const what = n + " more " + (n === 1 ? "category" : "categories");
      more.textContent = "+" + n;
      more.title = what;
      more.setAttribute("aria-label", "Show " + what);
    }
    function appendCategoryMore(cell, n) {
      const more = document.createElement("span");
      more.className = "cat-more";
      more.setAttribute("role", "button");
      more.setAttribute("tabindex", "-1");   // an arrow stop inside the row
      more.setAttribute("aria-haspopup", "dialog");
      setCategoryMore(more, n);
      cell.appendChild(more);
      return more;
    }
    function resetCategoryCell(cell) {
      const more = cell.querySelector(".cat-more");
      if (more) more.remove();
      const chips = cell.querySelectorAll(".oa-cat-chip");
      for (let i = 0; i < chips.length; i++) chips[i].style.display = "";
    }
    function clampCategoryCells() {
      const cells = document.querySelectorAll("#myGrid .slick-cell .category-cell");
      const cap = DATA_ROW_SPAN * ((grid.getOptions && grid.getOptions().rowHeight) || FINE_ROW_H);
      const tasks = [];
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.closest(".abs-meta, .abs-drop")) continue;   // the details list wraps freely
        const width = Math.round(cell.clientWidth);
        if (!width || cell.__catClampW === width) continue;
        tasks.push({ cell: cell, width: width });
      }
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t];
        if (task.cell.__catClampW != null) resetCategoryCell(task.cell);
        task.cell.__catClampW = task.width;
        task.chips = Array.from(task.cell.querySelectorAll(".oa-cat-chip"));
        let sig = task.width + "\u001e";
        for (let k = 0; k < task.chips.length; k++) sig += (task.chips[k].getAttribute("data-category") || "") + "\u001f";
        task.sig = sig;
        task.cached = catClampCache.has(sig);
        task.showN = task.cached ? catClampCache.get(sig) : task.chips.length;
      }
      // One read phase: the first chip whose box ends below the tallest the
      // row can be. Chips wrap in reading order, so every later one is too.
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t], host = task.cell.closest(".slick-cell");
        if (task.cached || !host || task.chips.length < 2) continue;
        task.limit = host.getBoundingClientRect().top + cap - 1;
        for (let k = 0; k < task.chips.length; k++) {
          if (task.chips[k].getBoundingClientRect().bottom > task.limit) { task.showN = k; break; }
        }
      }
      let active = [];
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t];
        if (task.showN >= task.chips.length) continue;
        for (let k = task.showN; k < task.chips.length; k++) task.chips[k].style.display = "none";
        task.more = appendCategoryMore(task.cell, task.chips.length - task.showN);
        if (!task.cached) active.push(task);
      }
      // The marker needs room too: give up one more chip until it fits.
      while (active.length) {
        const over = active.filter(function (task) { return task.showN > 0 && task.more.getBoundingClientRect().bottom > task.limit; });
        for (let t = 0; t < over.length; t++) {
          const task = over[t];
          task.chips[--task.showN].style.display = "none";
          setCategoryMore(task.more, task.chips.length - task.showN);
        }
        active = over;
      }
      for (let t = 0; t < tasks.length; t++) if (!tasks[t].cached) catClampCache.set(tasks[t].sig, tasks[t].showN);
    }

    // Author cells: the formatter (grid-renderers.js) picks how many names fit
    // from their length, and a name that wraps where the estimate expected one
    // line ran past the cell's last line, cut. Measured here like the keyword
    // clamp: while a cell's last row ends below its box, one more name goes to
    // the "+N" marker - a filter match last, so it stays in sight - and one
    // name always stays. Once per cell node and width; the decision is cached
    // by width + the names the formatter drew (and their phone form), so a row
    // scrolled back in is DOM writes only.
    const auClampCache = new Map();   // width + names drawn -> names the clamp hides
    function authorNameRows(cell) {
      return Array.prototype.filter.call(cell.children, function (r) {
        return !r.classList.contains("author-row--gap") && !r.classList.contains("author-row--etal");
      });
    }
    // The row the next cut takes: the last one shown that matches no filter,
    // else the last match; null when only one name is left.
    function nextAuthorCut(rows) {
      let shown = 0, plain = null, match = null;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display === "none") continue;
        shown++;
        if (rows[i].querySelector(".is-author-match")) match = rows[i];
        else plain = rows[i];
      }
      return shown > 1 ? (plain || match) : null;
    }
    // The cell's "+N": the formatter's count plus the clamp's, rebuilt from the
    // renderer's markup (none when both are 0).
    function setAuthorMore(task) {
      const old = task.cell.querySelector(".author-row--etal");
      if (old) old.remove();
      const n = task.base + task.cut;
      const item = n ? lookupArticle(task.cell.getAttribute("data-id") || "") : null;
      if (item) task.cell.insertAdjacentHTML("beforeend", renderers.authorMoreHtml(item, n, task.cell.classList.contains("author-cell--compact")));
    }
    function lastShownRow(cell) {
      for (let k = cell.children.length - 1; k >= 0; k--) {
        if (cell.children[k].style.display !== "none") return cell.children[k];
      }
      return null;
    }
    function clampAuthorCells() {
      const cells = document.querySelectorAll("#myGrid .slick-cell > .author-cell:not(.author-cell--all)");
      const tasks = [];
      // Every width first, before any write.
      for (let i = 0; i < cells.length; i++) {
        const width = Math.round(cells[i].clientWidth);
        if (width && cells[i].__auClampW !== width) tasks.push({ cell: cells[i], width: width });
      }
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t], cell = task.cell;
        task.rows = authorNameRows(cell);
        if (cell.__auClampW == null) {
          const more = cell.querySelector(".author-etal");
          cell.__auBase = more ? parseInt(more.textContent.replace(/\D+/g, ""), 10) || 0 : 0;
        }
        task.base = cell.__auBase;
        task.cut = 0;
        // A new width: back to what the formatter drew, then measured afresh.
        if (cell.__auClampW != null) {
          task.rows.forEach(function (r) { r.style.display = ""; });
          setAuthorMore(task);
        }
        cell.__auClampW = task.width;
        let sig = task.width + "\u001e" + task.base + (cell.classList.contains("author-cell--compact") ? "c" : "");
        for (let k = 0; k < task.rows.length; k++) {
          const a = task.rows[k].querySelector(".author-link");
          sig += "\u001f" + (a ? (a.getAttribute("data-author") || "") + (a.classList.contains("is-author-match") ? "*" : "") : "");
        }
        task.sig = sig;
        task.cached = auClampCache.has(sig);
        if (task.cached && auClampCache.get(sig)) {
          for (let k = auClampCache.get(sig); k > 0; k--) { const r = nextAuthorCut(task.rows); if (r) { r.style.display = "none"; task.cut++; } }
          setAuthorMore(task);
        }
      }
      let active = tasks.filter(function (task) { return !task.cached; });
      while (active.length) {
        // One read phase across all cells, then one write phase.
        const over = active.filter(function (task) {
          const last = lastShownRow(task.cell);
          return !!last && last.getBoundingClientRect().bottom > task.cell.getBoundingClientRect().bottom + 1 && !!nextAuthorCut(task.rows);
        });
        for (let t = 0; t < over.length; t++) {
          nextAuthorCut(over[t].rows).style.display = "none";
          over[t].cut++;
          setAuthorMore(over[t]);
        }
        active = over;
      }
      for (let t = 0; t < tasks.length; t++) if (!tasks[t].cached) auClampCache.set(tasks[t].sig, tasks[t].cut);
    }

    // NOTE: the category pass below does not UNDO its work (it leaves a moved
    // chip and its class); that is safe because SlickGrid destroys and rebuilds
    // row nodes on every filter/sort/scroll-recycle (measured: 0 of 88 row nodes
    // and 0 of 22 cell nodes survive a filter change).
    //
    // The keyword clamp DOES reset itself, because it is width-dependent: the
    // responsive column set can narrow the Keywords column after the first
    // measurement (a 3-row cell at 470px is a 6-row cell at 246px), and a
    // one-shot flag left those cells unclamped with no "+N" marker at all. Each
    // cell now records the width it was measured at and re-measures from a clean
    // slate whenever that changes.
    function resetKeywordCell(cell) {
      const more = cell.querySelector(".keyword-more");
      if (more) more.remove();
      const chips = cell.querySelectorAll(".keyword-link");
      for (let i = 0; i < chips.length; i++) {
        chips[i].style.display = "";
        chips[i].classList.remove("is-kw-match");
      }
    }

    function clampKeywordCells() {
      const cells = document.querySelectorAll("#myGrid .keyword-cell");
      const pending = [];
      // Read all cell widths before resets, reordering, or cache-hit writes.
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.closest(".abs-meta-extra")) continue;
        const width = Math.round(cell.clientWidth);
        if (width && cell.__kwClampedW !== width) pending.push({ cell: cell, width: width });
      }
      const tasks = [];
      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        if (entry.cell.__kwClampedW != null) resetKeywordCell(entry.cell);
        const task = prepareKeywordClamp(entry.cell, entry.width);
        if (task) tasks.push(task);
        entry.cell.__kwClampedW = entry.width;
      }
      // Read every cache miss in one layout phase.
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t], tops = task.chips.map(function (chip) { return chip.offsetTop; });
        const rows = Array.from(new Set(tops)).sort(function (a, b) { return a - b; });
        if (rows.length > KEYWORD_MAX_ROWS) {
          const cutoff = rows[KEYWORD_MAX_ROWS];
          task.lastAllowed = rows[KEYWORD_MAX_ROWS - 1];
          task.showN = tops.findIndex(function (top) { return top >= cutoff; });
        }
      }
      let active = [];
      // Write every first-pass clamp before reading any marker position.
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t];
        if (task.showN < task.chips.length) {
          for (let i = task.showN; i < task.chips.length; i++) task.chips[i].style.display = "none";
          task.more = appendKeywordMore(task.cell, keywordListOf(task.chips.slice(task.showN)));
          active.push(task);
        }
      }
      while (active.length) {
        const overflow = [];
        // One read phase across all cells, followed by one write phase.
        for (let t = 0; t < active.length; t++) {
          const task = active[t];
          if (task.showN > 0 && task.more.offsetTop > task.lastAllowed) overflow.push(task);
        }
        for (let t = 0; t < overflow.length; t++) {
          const task = overflow[t];
          task.chips[--task.showN].style.display = "none";
          // Update +N before measuring again. Crossing a digit boundary can
          // widen the marker and must be part of its fit check.
          setKeywordMore(task.more, keywordListOf(task.chips.slice(task.showN)));
        }
        active = overflow;
      }
      for (let t = 0; t < tasks.length; t++) kwClampCache.set(tasks[t].sig, tasks[t].showN);
    }

    let keywordClampScheduled = false;
    let keywordClampTimer = null;
    let keywordClampFrame = null;
    let keywordClampGeneration = 0;
    let keywordClampRun = null;
    function scheduleKeywordClamp() {
      if (keywordClampScheduled) return;
      keywordClampScheduled = true;
      const generation = ++keywordClampGeneration;
      const run = function () {
        // A delayed callback from an earlier batch cannot consume a new batch.
        if (!keywordClampScheduled || generation !== keywordClampGeneration) return;
        keywordClampScheduled = false;
        if (keywordClampTimer !== null) scope.clearTimeout(keywordClampTimer);
        if (keywordClampFrame !== null) scope.cancelAnimationFrame(keywordClampFrame);
        keywordClampTimer = null;
        keywordClampFrame = null;
        clampKeywordCells();
        markCategoryCells();
        clampCategoryCells();
        clampAuthorCells();
        // Last: row heights are read off the clamped cells. A changed span may
        // be the pinned article's tall head, which the render buffer must hold.
        if (absRows.fitRows()) syncRowBuffer();
      };
      keywordClampRun = run;
      keywordClampFrame = scope.frame(run);
      keywordClampTimer = scope.timeout(run, 250);
    }
    // A scheduled clamp + row fit, run now: after a click's repaint, the rows'
    // measured heights land before the first paint instead of a frame later
    // (the pinned row grew a line under its open abstract, which jumped).
    function flushKeywordClamp() { if (keywordClampScheduled && keywordClampRun) keywordClampRun(); }
    // Coming back to a backgrounded tab: re-measure, since anything rendered
    // while it was hidden may have been laid out at a different width.
    scope.listen(document, "visibilitychange", function () {
      if (!document.hidden) scheduleKeywordClamp();
    });
    // One onRendered subscriber for the whole grid: SlickGrid dispatches to
    // every subscriber on each render pass, and both of these run per pass.
    // favHeaderSyncReady gates the favorites half until setupFavorites() has
    // decided the feature is available.
    var favHeaderSyncReady = false;
    scope.subscribe(grid.onRendered, function () {
      scheduleKeywordClamp();
      if (favHeaderSyncReady) syncFavAllHeader();
      // Rebuilt drops get the live metrics charts back (drop-metrics.js).
      window.OADropMetrics.mount(grid.getContainerNode());
    });

    // Rules compare folded text, so CO2 and CO₂, m3 and m³ are one word
    // (oa-typeset.js); the table shows them typeset.
    function normalizeText(value) {
      return foldText(String(value || "")).trim().toLowerCase().replace(/\s+/g, " ");
    }

    const doiUrl = renderers.doiUrl;

    /* Where "Open all" sends each article: the DOI (publisher), or any
       provider in the external-records catalogue.

       The provider routes are NOT re-implemented here - they resolve through
       OAExtRecords.buildGroups(row), the same code that builds each drop's
       records strip and the article pages' rail. So the list stays in step with
       the catalogue automatically, and every route inherits its real deep-link
       derivation (Google Scholar's title + first-author + year-window query,
       for one, rather than a bare title search).

       Rows differ in what they carry, so a provider is resolvable per row: a
       DOI-derived one yields nothing for a row without a DOI, and eid/wos-based
       ones (Scopus, Web of Science, Inciteful) nothing for a row without a real
       id ("None" is none). Unresolvable rows are counted and reported rather
       than silently dropped. */
    const SITE_ROUTES = {
      doi: { label: "DOI (publisher)", url: function (a) { return a.doi ? doiUrl(a.doi) : null; } }
    };
    function extRegistry() {
      return window.OAExtRecords.REGISTRY;
    }
    function extProvider(key) {
      var found = null;
      extRegistry().forEach(function (g) {
        g.items.forEach(function (it) { if (it.key === key) found = it; });
      });
      return found;
    }
    function openRouteLabel(key) {
      if (SITE_ROUTES[key]) return SITE_ROUTES[key].label;
      var p = extProvider(key);
      return p ? p.name : SITE_ROUTES.doi.label;
    }
    function openRouteUrl(key, row) {
      if (SITE_ROUTES[key]) return SITE_ROUTES[key].url(row);
      var hit = null;
      window.OAExtRecords.buildGroups(row).forEach(function (g) {
        g.items.forEach(function (it) {
          if (it.name === openRouteLabel(key) && !it.unavailable) hit = it.href;
        });
      });
      return hit;
    }
    const OPEN_ROUTE_KEY = "oa-open-route";
    function openRoute() {
      var k = window.OAPrefs.get(OPEN_ROUTE_KEY);
      if (SITE_ROUTES[k] || extProvider(k)) return k;
      return "doi";   // "site" (the article page) was retired as a route
    }


    // Canonical names are resolved through bibliography and cached by presentation.
    const authorDisplayName = renderers.authorDisplayName;
    // One comparator for header clicks and ?SORT_BY= links (grid-sort.js).
    const compareByField = window.OAGridSort.comparator({ metricNumber: articleStore.metricNumber, authorDisplayName: authorDisplayName });
    const authorAlternateDisplayName = renderers.authorAlternateDisplayName;
    const authorLinkHtml = renderers.authorLinkHtml;

    // Abstracts reach the rows only once semantic-search.js has loaded the
    // manifest (row.abstract). Exports triggered before that wait for it -
    // bounded, so a failed manifest load still yields a (abstract-less) file.
    function whenAbstractsReady(fn) {
      var ss = window.OASemanticSearch;
      if (!ss || !ss.ready || (ss.isReady && ss.isReady())) return fn();
      var timeout = new Promise(function (resolve) { setTimeout(resolve, 5000); });
      Promise.race([ss.ready.catch(function () {}), timeout]).then(fn);
    }

    // One article's BibTeX entry as a .bib download (the article page's BibTeX
    // button, one click). Same formatter + filename rule as that page.
    function downloadBibtex(id) {
      var item = lookupArticle(id);
      if (!item) return;
      whenAbstractsReady(function () {
        var bib = window.OABibliography.formatBibtex(item);
        if (!bib) return;
        var fname = String(item.id).split("/").pop() + ".bib";
        // text/plain, not application/x-bibtex: an unregistered MIME type makes
        // some browsers escalate the blob to a "Save As" dialog. A known type +
        // the fixed <id>.bib name saves straight to the download folder.
        window.OABrowserActions.downloadBlob(fname, bib + "\n", "text/plain;charset=utf-8");
      });
    }

    // Graph metrics live in the abstract drop of the article an ID IS filter
    // names (drop-metrics.js). The metrics button under the star - and a
    // right-click on a title - make this article that filter and open its
    // abstract; unlike the title's plain click they never lift the pin. From
    // the anchor strip the graph rule goes first: the anchor is not part of its
    // own neighbourhood, so ANDed to it the pin would empty the list.
    function showMetrics(id, from) {
      if (!id) return;
      if (from && from.closest(".oa-anchor-row")) { ruleTree.rows = []; absRows.clear(); }
      dropAuthorForPin(id);
      ruleEditor.pinArticle(id);
      if (!absRows.isOpen(id)) toggleAbstract(id);
    }
    // Pinning one of the works of the author the list is filtered to makes that
    // AUTHOR IS rule redundant: it goes (and with it the author's panel).
    function dropAuthorForPin(id) {
      const slug = ruleEditor.authorFilterSlug();
      const art = slug !== null ? lookupArticle(id) : null;
      if (!art || !art._authorExactSet || !art._authorExactSet.has(normalizeText(slug))) return;
      ruleTree.rows = ruleTree.rows.filter(function (r) {
        return !(r.field === FIELDS.AUTHOR && r.operator === "is" && !r.disabled && !ruleLanguage.rowIsNegated(r) && String(r.value || "").trim() === slug);
      });
    }
    // "Already visited" for authors: the authors whose metrics the author panel
    // has shown (syncAuthorPanel). Every author link points at a filtered list,
    // so the browser's :visited cannot tell them apart; the slugs are kept here
    // instead. The author formatter stamps .is-visited on their links (an O(1)
    // Set lookup per name) and the memoised author cells are keyed on
    // visitedGen, so a new visit costs one repaint of the rendered rows.
    var VISITED_AUTHORS_KEY = "oa-visited-authors";
    var visitedAuthors = (function () {
      var v = window.OAPrefs.getJSON(VISITED_AUTHORS_KEY, []);
      return Array.isArray(v) ? v : [];
    })();
    var visitedAuthorSet = new Set(visitedAuthors);
    var visitedGen = 0;
    function authorIsVisited(author) {
      return visitedAuthorSet.has(authorIdOf(author));
    }
    function markAuthorVisited(slug) {
      var i = visitedAuthors.indexOf(slug);
      if (i >= 0) visitedAuthors.splice(i, 1);
      visitedAuthors.push(slug);
      if (visitedAuthors.length > 2000) visitedAuthors = visitedAuthors.slice(-2000);
      visitedAuthorSet = new Set(visitedAuthors);
      visitedGen += 1;
      window.OAPrefs.setJSON(VISITED_AUTHORS_KEY, visitedAuthors);
      if (grid) { try { grid.invalidate(); } catch (e) {} }
    }
    function prepareRuntimeIndexes(rows) {
      for (let i = 0; i < rows.length; i += 1) {
        const article = rows[i];
        article._idx = i;   // stable source position: final sort tie-breaker
        // Defensive shape guards: a record missing keywords/authors must not
        // abort indexing for the whole table.
        if (!Array.isArray(article.keywords)) article.keywords = [];
        if (!Array.isArray(article.authors)) article.authors = [];
        if (!article._titleLc) {
          // TITLE rules search the whole title, both entries of it.
          article._titleLc = normalizeText(
            article.subtitle ? article.title + " " + article.subtitle : article.title
          );
        }

        if (!article._venueLc) {
          article._venueLc = normalizeText(article.venue);
        }

        // The normalized keyword/author LISTS are build inputs only - the Set
        // and the joined haystack are what the predicates read. Keeping the
        // intermediate arrays on the row duplicated ~1.6 MB of strings across
        // the corpus, so they stay local and die with this iteration.
        if (!article._keywordSet) {
          const kwLc = article.keywords.map(keyword => normalizeText(keyword));
          article._keywordsSearchLc = kwLc.join(" | ");
          const kwSet = new Set(kwLc);
          // Sigil-insensitive exact matching: keywords are stored with their class
          // sigil (#topical / $derived), but hand-typed URLs and landing-page
          // topic links say `keyword = "concrete"` - accept the bare term too.
          for (const k of kwLc) {
            const bare = k.replace(/^[#$]/, "");
            if (bare !== k) kwSet.add(bare);
          }
          article._keywordSet = kwSet;
        }

        if (!article._authorExactSet) {
          const exactValues = new Set();
          const containsValues = [];

          for (const author of article.authors) {
            for (const value of authorMatchCandidates(author)) {
              exactValues.add(value);
              containsValues.push(value);
            }
          }

          article._authorExactSet = exactValues;
          article._authorSearchLc = containsValues.join(" | ");
        }
        // Hover-title text for the Authors cell, built once here instead of
        // per cell render (the formatter runs for every row on every scroll
        // pass, and this map+join was its main allocation).
        if (article._authorTitle == null) {
          article._authorTitle = article.authors.map(authorDisplayName).join("; ");
        }
      }
    }

    /* Autocomplete datalists.
     *
     * These lists are big - 1121 keywords, 701 categories, ~12 700 options across
     * all four. A native <datalist> given the whole list produces a popup with
     * far more rows than the browser shows at once (roughly 20), and the popup is
     * drawn by the OS: it cannot be styled, scripted, or scrolled
     * programmatically. So keep the full list in memory and render only the best
     * DATALIST_LIMIT matches for what has been typed, refreshed on each keystroke
     * - the popup then fits in the rows the browser actually shows, and stays
     * fast. Every one of the four lists goes through this path; category used to
     * write its own markup and was left uncapped at 701 as a result.
     *
     * The limit is deliberately under that ~20-row window, INCLUDING the empty
     * query a reader sees when they just open the field. A larger cap (25 was
     * tried) still overflows into a scrolling popup in exactly that state.
     *
     * Ranking puts prefix matches before interior ones, so the head of the list
     * is the most likely target - better than the plain alphabetical order the
     * browser would otherwise show. */
    const DATALIST_LIMIT = 12;
    const datalistSources = new Map();   // datalistId -> sorted full value list

    function renderDatalistOptions(datalistId, entries) {
      const datalist = document.getElementById(datalistId);
      if (!datalist) return;
      // One innerHTML parse instead of thousands of createElement/appendChild.
      let html = "";
      for (const entry of entries) {
        html += '<option value="' + escapeHtml(entry.value) + '"' +
          (entry.label ? ' label="' + escapeHtml(entry.label) + '"' : "") +
          "></option>";
      }
      datalist.innerHTML = html;
    }

    function datalistMatches(entries, query) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return entries.slice(0, DATALIST_LIMIT);
      const prefix = [], inner = [];
      for (const entry of entries) {
        const lc = entry.value.toLowerCase();
        let at = lc.indexOf(q);
        // Where an entry carries a label, the browser matches typing against the
        // label too (category: value "PROJE", label "01.00.00 · Project …"), so
        // filtering has to consider both or typing the title would hide the row.
        if (at < 0 && entry.label) {
          const at2 = entry.label.toLowerCase().indexOf(q);
          if (at2 < 0) continue;
          at = at2;
        } else if (at < 0) {
          continue;
        }
        // Keyword values carry a "#" sigil, so a typed prefix can never sit at
        // index 0; treat position 1 as a prefix too, otherwise every keyword
        // ranks as an interior match and the ordering does nothing.
        const isPrefix = at === 0 || (at === 1 && lc.charCodeAt(0) === 35);
        (isPrefix ? prefix : inner).push(entry);
        if (prefix.length >= DATALIST_LIMIT) break;
      }
      return prefix.concat(inner).slice(0, DATALIST_LIMIT);
    }

    // Register a list for filtering and render its opening slice. `entries` are
    // {value, label?} - plain strings are accepted and wrapped.
    function registerDatalist(datalistId, entries) {
      const all = entries.map(function (e) {
        return typeof e === "string" ? { value: e } : e;
      });
      datalistSources.set(datalistId, all);
      renderDatalistOptions(datalistId, datalistMatches(all, ""));
    }

    // Raw column values: dedupe, drop blanks, collate, then register.
    function populateDatalist(datalistId, values) {
      const seen = new Set();
      for (const v of values) {
        const t = String(v || "").trim();
        if (t) seen.add(t);
      }
      registerDatalist(datalistId, [...seen].sort(facetCollator.compare));
    }

    // Re-filter on each keystroke in an input bound to one of these lists.
    function refilterDatalistFor(el) {
      const id = el && el.getAttribute && el.getAttribute("list");
      if (!id) return;
      const all = datalistSources.get(id);
      if (!all) return;                  // not a filtered list (or not filled yet)
      renderDatalistOptions(id, datalistMatches(all, el.value));
    }

    // Category rules accept only the abbreviation (the CATEGORY_DEFS key), so
    // the datalist offers every abbreviation with "num · Title" as the
    // option label - the browser matches typing against both, but selecting
    // inserts the bare abbreviation. Goes through registerDatalist so the 701
    // categories are capped and filtered like every other list.
    function populateCategoryDatalist() {
      const defs = window.CATEGORY_DEFS || {};
      const abbrs = Object.keys(defs).sort(function (a, b) {
        return (defs[a].num || "").localeCompare(defs[b].num || "");
      });
      registerDatalist("categorySuggestions", abbrs.map(function (abbr) {
        const def = defs[abbr];
        return { value: abbr, label: (def.num || "") + " \u00b7 " + typesetText(def.title || "") };
      }));
    }

    // Author lookup tables built alongside the datalist. URL/storage
    // uses the slug (stable, lowercase); UI labels are the proper-case
    // display names from authorDisplayName().
    const authorSlugToLabel = new Map();
    const authorLabelToSlug = new Map();

    function populateAutocompleteDatalists() {
      const authorEntries = articleFacets.authors;

      authorSlugToLabel.clear();
      authorLabelToSlug.clear();
      // Every slug -> its display label, so an author chip (carrying the real
      // per-article slug) shows "Lastname, Firstname" in the rule builder even
      // when another person shares the same display name.
      (articleFacets.authorSlugLabels || authorEntries).forEach(function (e) {
        const sid = authorIdOf(e);
        if (sid && e.label) authorSlugToLabel.set(sid, e.label);
      });
      // Disambiguated label -> exact slug, so a name typed or picked in the
      // rule builder commits to a slug (the URL carries the id, not the name).
      const duplicates = [];
      for (const entry of authorEntries) {
        const eid = authorIdOf(entry);
        if (eid && entry.label) {
          const key = normalizeText(entry.label);
          const existing = authorLabelToSlug.get(key);
          if (existing && existing !== eid) {
            duplicates.push({ label: entry.label, slugs: [existing, eid] });
          }
          authorLabelToSlug.set(key, eid);
          // A name typed without the comma ("bos freek") resolves too.
          const bare = key.replace(/, /g, " ");
          if (bare !== key && !authorLabelToSlug.has(bare)) authorLabelToSlug.set(bare, eid);
        }
      }
      if (duplicates.length > 0) {
        console.warn(
          "[articles-grid] " + duplicates.length +
          " author label(s) collide with distinct slugs; the " +
          "label-typed filter will only resolve the last one. " +
          "Disambiguate the display label in the source data to fix.",
          duplicates
        );
      }

      // Keyword and venue facets are { label, count } objects (same shape as
      // the author facets), so map them to their label strings before they
      // reach the datalist - otherwise each <option> stringifies an object to
      // "[object Object]". A plain-string facet is passed through unchanged.
      const facetLabel = (entry) =>
        (entry && typeof entry === "object" && entry.label != null)
          ? entry.label
          : entry;

      const authorLabels = authorEntries.map(author => author.label);

      const keywords = (articleFacets.keywords || []).map(facetLabel);

      const venues = (articleFacets.venues || []).map(facetLabel);

      // The slug/label maps above are needed synchronously (a ?q= URL with an
      // author resolves through them at first render), but the datalist DOM is
      // not: together these four lists are ~12 700 <option> nodes - by far the
      // largest thing on the page, an order of magnitude more than the grid
      // itself - and a session that never opens the rule builder needs none of
      // them. So register a filler per list and run it on first focus of an
      // input bound to that list (see lazyDatalists below). Focus always
      // precedes the first keystroke, so the options are in place before the
      // browser has anything to match them against.
      lazyDatalists.set("authorSuggestions", function () { populateDatalist("authorSuggestions", authorLabels); });
      lazyDatalists.set("keywordSuggestions", function () { populateDatalist("keywordSuggestions", keywords); });
      lazyDatalists.set("venueSuggestions", function () { populateDatalist("venueSuggestions", venues); });
      lazyDatalists.set("categorySuggestions", populateCategoryDatalist);
    }

    // datalistId -> filler, consumed once on first focus of a bound input.
    const lazyDatalists = new Map();
    function fillDatalistFor(el) {
      const id = el && el.getAttribute && el.getAttribute("list");
      if (!id) return;
      const fill = lazyDatalists.get(id);
      if (!fill) return;
      lazyDatalists.delete(id);
      fill();
    }
    activeDatalistFocus = fillDatalistFor;
    activeDatalistInput = refilterDatalistFor;

    // Favorites are a first-class rule field (IS_FAVORITE = TRUE), so the rule
    // predicate alone decides row visibility - there's no separate flag.
    // Search owns its overlay and reading session; the rule predicate and its
    // eligible-id cache stay with the host that compiles and invalidates them.
    const searchController = window.OAGridSearch.create({
      window: window, grid: grid, dataView: dataView, abstracts: absRows,
      columns: columns, compareByField: compareByField,
      getSearch: function () { return window.OASemanticSearch; },
      loadSearch: function () { return window.OALoadSearch(); },
      facets: window.OASearchFacets,
      elements: {
        input: document.getElementById("semanticSearch"),
        clearButton: document.getElementById("semanticSearchClear"),
        enterButton: document.getElementById("semanticSearchEnter"),
        status: document.getElementById("semanticSearchStatus"),
        anchor: document.querySelector(".oa-tsearch"),
        viewport: document.querySelector("#myGrid .slick-viewport")
      },
      rules: {
        filterIds: currentFilterIds, facetSources: articleStore.facetSources,
        applyFacet: applyFacetRule, facetIsActive: ruleEditor.facetIsActive,
        removeLast: ruleEditor.removeLast,
        pinnedId: function () { return ruleEditor.pinnedArticleId(); }
      },
      effects: {
        resultsChanged: function () { updateResultCount(); layout.requestResize(); },
        queryChanged: updateUrlBar,
        textReady: function () {
          filterIdsCacheFor = null;
          dataView.refresh();
          updateResultCount();
        }
      }
    });
    scope.add(searchController.destroy);

    function dataViewFilter(item) {
      // The article a live REFERENCES_OF / CITATIONS_OF / SIMILAR_TO rule points
      // at is shown pinned in the grid's top panel (syncAnchorStrip), never in
      // the list itself - even where an OR branch would match it.
      if (isAnchorRow(item)) return false;
      return searchController.matches(item.id) && activeRulePredicate(item);
    }
    function isAnchorRow(item) {
      return sharedAnchorId !== null && !!item && !item.__group && !item.__groupTotals && item.id === sharedAnchorId;
    }

    // The set of row ids that pass the current rule filter (ignoring the search
    // overlay). Handed to the search module so its maxResults cap applies
    // *within* the filter - i.e. it ranks the filtered subset, not the whole
    // corpus then intersects. Returns null when nothing narrows the data, so
    // search runs corpus-wide (the original behaviour).
    // Memoized against the live predicate: the ids only change when the rule
    // filter recompiles, but the search controller asks for them on every keystroke.
    var filterIdsCache = null;
    var filterIdsCacheFor = null;
    var filterIdsCacheRev = -1;
    function currentFilterIds() {
      if (!ruleTree || !ruleTree.rows || ruleTree.rows.length === 0) return null;
      // IS_FAVORITE reads the favorites store live, so the predicate alone is
      // not the whole key - fold the store revision in.
      const favRev = window.OAFavorites.rev();
      if (filterIdsCacheFor === activeRulePredicate && filterIdsCacheRev === favRev) return filterIdsCache;
      var ids = new Set();
      for (var i = 0; i < articles.length; i++) {
        if (activeRulePredicate(articles[i])) ids.add(articles[i].id);
      }
      filterIdsCacheFor = activeRulePredicate;
      filterIdsCacheRev = favRev;
      // predicate accepts everything -> unfiltered
      filterIdsCache = ids.size === articles.length ? null : ids;
      return filterIdsCache;
    }

    // True when an `IS_FAVORITE = TRUE` rule is present in the tree - the
    // toolbar star's own state.
    function isFavRuleActive() {
      return ruleTree.rows.some(function (row) {
        return !row.disabled && row.field === FIELDS.IS_FAVORITE &&
          String(row.value).toLowerCase() === "true";
      });
    }
    // True when ANY live condition reads the favorites store - TRUE, FALSE or a
    // NOT-connected row - so a star toggle must re-run the filter.
    function ruleDependsOnFavorites() {
      return ruleTree.rows.some(function (row) {
        return !row.disabled && row.field === FIELDS.IS_FAVORITE &&
          row.value != null && String(row.value).trim() !== "";
      });
    }

    // Reflect the favorites-rule state on the toolbar's star toggle button.
    function syncFavFilterButton() {
      const favBtn = document.getElementById("favFilter");
      if (!favBtn) return;
      const on = isFavRuleActive();
      favBtn.setAttribute("aria-pressed", on ? "true" : "false");
      favBtn.classList.toggle("is-active", on);
    }

    // Keyword / author terms referenced by active positive rules (is /
    // contains). Used by the keyword-cell clamp and the authors formatter to
    // keep a matching entry visible (instead of hiding it in "…" / "et al.")
    // and to highlight it. Refreshed whenever the filter recompiles.
    let activeKeywordMatchers = [];
    let activeAuthorMatchers = [];
    let activeVenueMatchers = [];
    let activeDateMatchers = [];
    let activeCategoryMatchers = [];
    function updateActiveFilterMatchers() {
      const kw = [];
      const au = [];
      const ve = [];
      const dt = [];
      const cat = [];
      let rows = [];
      try { rows = ruleLanguage.positiveRules(ruleLanguage.fromRows(ruleTree.rows)); }
      catch (error) { /* Invalid drafts keep the previous applied matchers. */ }
      for (const r of rows) {
        if (r.disabled) continue;           // switched off: nothing to highlight
        // A NOT row EXCLUDES its value. Highlighting it would paint the very
        // chips the reader asked to be rid of as though they were filtered in
        // (and hoist them to the front of the chip order).
        if (ruleLanguage.rowIsNegated(r)) continue;
        // Category is handled first: its positive operators are "is" and
        // "begins with", not the "is"/"contains" pair the other fields use.
        if (r.field === FIELDS.CATEGORY) {
          if (r.operator === "is" || r.operator === "begins with") {
            const cv = String(r.value || "").trim().toUpperCase();
            if (cv) cat.push({ value: cv, prefix: r.operator === "begins with" });
          }
          continue;
        }
        // Date: the very predicate the rule filters with, so the cell is marked
        // exactly when the rule kept its row - every positive operator (=, >=,
        // <=, between). "!=" excludes, so it marks nothing.
        if (r.field === FIELDS.DATE) {
          if (r.operator !== "!=") {
            try { dt.push(compileDateRule(r.value, r.operator, r.value2)); }
            catch (error) { /* half-typed month: nothing to mark yet */ }
          }
          continue;
        }
        const positive = r.operator === "is" || r.operator === "contains";
        if (!positive) continue;
        const v = normalizeText(String(r.value || "").trim());
        if (!v) continue;
        const entry = { value: v, exact: r.operator === "is" };
        if (r.field === FIELDS.KEYWORD) kw.push(entry);
        else if (r.field === FIELDS.AUTHOR) au.push(entry);
        else if (r.field === FIELDS.VENUE) ve.push(entry);
      }
      activeKeywordMatchers = kw;
      activeAuthorMatchers = au;
      activeVenueMatchers = ve;
      activeDateMatchers = dt;
      activeCategoryMatchers = cat;
      try {
        const s = ruleEditor.authorFilterSlug();
        citationAuthorSlug = s !== null && authorSlugToLabel.has(s) ? s : "";
      } catch (e) { citationAuthorSlug = ""; }
      // Anchor article for the shared-authorship glyph (see sharedAuthorNames):
      // the article a live REFERENCES_OF / CITATIONS_OF / SIMILAR_TO rule points at. A
      // paper in that neighbourhood that shares an author with the anchor gets
      // the users icon under its chevron, as the article page's own ref / cite
      // grids do. ID IS is deliberately not an anchor: one pinned row flags
      // nothing.
      let anchor = null;
      for (const r of rows) {
        if (r.disabled || ruleLanguage.rowIsNegated(r)) continue;
        if (RELATION_FIELDS.has(r.field) && String(r.value || "").trim()) { anchor = String(r.value).trim(); break; }
      }
      if (anchor !== sharedAnchorId) {
        sharedAnchorId = anchor;
        sharedAnchorKeys = null;             // the expand cell is not memoised - the next render picks this up
      }
      // Matcher changes reorder + highlight chips, which changes both the clamp
      // signatures and rendered chip widths - drop stale clamp decisions.
      kwClampCache.clear();
    }
    // Shared authorship with the relation anchor. Keyed by slug (the table's
    // author records always carry id / slug), memoised per anchor.
    let sharedAnchorId = null, sharedAnchorKeys = null;
    function anchorAuthorKeys() {
      if (sharedAnchorKeys) return sharedAnchorKeys;
      if (!sharedAnchorId) return null;
      const art = lookupArticle(sharedAnchorId);
      if (!art) return null;
      const set = new Set();
      (art.authors || []).forEach(function (a) {
        const k = authorIdOf(a);
        if (k) set.add(String(k).toLowerCase());
      });
      sharedAnchorKeys = set;
      return set;
    }
    // Display names (surname first) of the authors `item` shares with the anchor;
    // empty when there is no anchor, or the row IS the anchor.
    function sharedAuthorNames(item) {
      const keys = anchorAuthorKeys();
      if (!keys || !keys.size || !item || item.id === sharedAnchorId) return [];
      const out = [];
      (item.authors || []).forEach(function (a) {
        const k = authorIdOf(a);
        if (!k || !keys.has(String(k).toLowerCase())) return;
        const name = authorDisplayName(a);
        if (name) out.push(name);
      });
      return out;
    }
    // Mirrors the CATEGORY predicate: "is" marks every chip in the named
    // branch (node + descendants); "begins with" marks by number / abbreviation
    // prefix.
    function categoryIsActive(abbr) {
      if (!activeCategoryMatchers.length) return false;
      const a = String(abbr).trim().toUpperCase();
      const defs = window.CATEGORY_DEFS || {};
      for (let i = 0; i < activeCategoryMatchers.length; i++) {
        const m = activeCategoryMatchers[i];
        if (m.prefix) {
          const d = defs[a];
          if (a.indexOf(m.value) === 0 || (d && String(d.num || "").indexOf(m.value) === 0)) return true;
        } else if (articleStore.categoryDescendants(m.value).has(a)) return true;
      }
      return false;
    }

    function keywordIsActive(keyword) {
      if (!activeKeywordMatchers.length) return false;
      const n = normalizeText(keyword);
      const bare = n.replace(/^[#$]/, "");
      for (let i = 0; i < activeKeywordMatchers.length; i++) {
        const m = activeKeywordMatchers[i];
        if (m.exact) {
          // Sigil-insensitive, mirroring compileKeywordRule's `is` (grid-rules.js).
          if (n === m.value || bare === m.value.replace(/^[#$]/, "")) return true;
        } else if (n.indexOf(m.value) !== -1) return true;
      }
      return false;
    }
    // Memoized per author object: authorIsActive runs for every author of every
    // rendered row on every scroll pass while an author filter is active, and
    // this allocated six normalized strings each time.
    const authorCandidateCache = new WeakMap();
    function authorMatchCandidates(author) {
      let out = authorCandidateCache.get(author);
      if (out) return out;
      const vals = [
        authorDisplayName(author),
        authorDisplayName(author).replace(", ", " "),
        authorAlternateDisplayName(author),
        author.firstName,
        author.lastName,
        author.prefix,
        authorIdOf(author)
      ];
      out = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i]) out.push(normalizeText(vals[i]));
      }
      authorCandidateCache.set(author, out);
      return out;
    }
    // Same test the VENUE predicate runs (grid-rules.js compileTextRule on _venueLc), so the
    // cell is coloured exactly when the rule kept its row.
    function venueIsActive(venue) {
      if (!activeVenueMatchers.length) return false;
      const v = normalizeText(String(venue || ""));
      if (!v) return false;
      for (let i = 0; i < activeVenueMatchers.length; i++) {
        const m = activeVenueMatchers[i];
        if (m.exact ? v === m.value : v.indexOf(m.value) !== -1) return true;
      }
      return false;
    }
    function dateIsActive(article) {
      if (!activeDateMatchers.length || !article) return false;
      for (let i = 0; i < activeDateMatchers.length; i++) {
        if (activeDateMatchers[i](article)) return true;
      }
      return false;
    }
    function authorIsActive(author) {
      if (!activeAuthorMatchers.length) return false;
      const cands = authorMatchCandidates(author);
      for (let i = 0; i < activeAuthorMatchers.length; i++) {
        const m = activeAuthorMatchers[i];
        for (let j = 0; j < cands.length; j++) {
          if (m.exact ? cands[j] === m.value : cands[j].indexOf(m.value) !== -1) return true;
        }
      }
      return false;
    }

    function compileAndApplyRuleFilter() { return batchRepaint(applyRuleFilterNow); }
    function applyRuleFilterNow() {
      ruleEditor.beginApply();
      // Snapshot what a failed compile must leave in place: the predicate AND
      // the highlight matchers/needles that describe it.
      const prevPredicate = activeRulePredicate;
      const prevMatchers = [activeKeywordMatchers, activeAuthorMatchers, activeCategoryMatchers, activeVenueMatchers, activeDateMatchers];
      const prevHighlights = window.OARuleHighlights || [];
      updateActiveFilterMatchers();
      window.OARuleHighlights = [];   // contains-needles for drop highlighting, repopulated by compile
      try {
        activeRulePredicate = compileFromRows(ruleTree.rows);
        ruleEditor.acceptAppliedRows();
      } catch (err) {
        // Bad expression - typically an unbalanced paren mid-edit. The draft is
        // NOT applied: the last valid filter keeps narrowing the table (turning
        // the filter off instead silently widened the list to the whole corpus
        // while the reader was still typing), and the expression bar says so.
        ruleEditor.rejectDraft(err);
        console.warn("[articles-grid] could not compile rule rows:", err.message);
        activeRulePredicate = prevPredicate;
        activeKeywordMatchers = prevMatchers[0];
        activeAuthorMatchers = prevMatchers[1];
        activeCategoryMatchers = prevMatchers[2];
        activeVenueMatchers = prevMatchers[3];
        activeDateMatchers = prevMatchers[4];
        window.OARuleHighlights = prevHighlights;
      }
      ruleEditor.renderExpression();
      ruleEditor.syncCount();
      refreshRepainted = false;
      resetScrollOnRefresh = true;   // a new rule set starts at the top of its list
      dataView.refresh();
      // dataView.refresh() fires onRowsOrCountChanged (the full invalidate +
      // render below) ONLY when the filtered row set actually changes. A rule
      // edit that leaves the rows identical - adding a third co-author to an
      // already-narrowed set, or removing that rule again - changes only the
      // highlight matchers, so the rendered cells kept their stale marks.
      // Repaint by hand in exactly that case (same calls the handler makes).
      if (!refreshRepainted && grid) {
        try { grid.invalidate(); } catch (e) {}
      }
      resetScrollOnRefresh = false;            // rows unchanged: nothing to reset
      if (absRows.count()) absRows.render();   // repaint open drops with rule marks
      updateResultCount();
      updateUrlBar();
      syncFavFilterButton();
      // If a search is active, the eligible set just changed - re-rank within
      // the new filter (debounced; reuses the cached embedding, so it's cheap).
      // Also re-run when the box holds a query that currently yields nothing:
      // relaxing a rule may bring its hits back.
      searchController.filterChanged();
    }

    // The rule compiler (grid-rules.js): rows or one condition -> a row test.
    const gridRules = window.OAGridRules.create({
      language: ruleLanguage, parseQuery: ruleEditor.parseQuery, articles: articles, articleStore: articleStore,
      normalizeText: normalizeText, foldText: foldText,
      authorSlug: function (key) { return authorLabelToSlug.get(key); }
    });
    const { compileFromRows, compileRule, compileDateRule } = gridRules;

    // Drop-one impact of each live condition: the rule-filtered article count
    // with that condition alone switched off (its eye), beside the count with
    // all on. Feeds the empty state's "Turn off X" (computed only when that
    // state shows). The search is left out - it ranks within the rule result.
    // Memoised on the expression, the favorites revision (IS_FAVORITE reads the
    // store live) and the pinned anchor (never counted, as in the list).
    let impactKey = null, impactResult = null;
    function ruleImpact() {
      const rows = ruleTree.rows;
      const favRev = window.OAFavorites.rev();
      const highlights = window.OARuleHighlights;
      try {
        const key = rowsToString(rows) + "\u0000" + favRev + "\u0000" + sharedAnchorId;
        if (key === impactKey) return impactResult;
        impactKey = key;
        impactResult = null;
        const live = rows.filter(function (r) { return !r.disabled && conditionToString(r) !== ""; });
        if (!live.length || live.length > 16) return null;
        window.OARuleHighlights = null;          // counting compiles add no drop marks
        const count = function (test) {
          let n = 0;
          for (let i = 0; i < articles.length; i++) if (!isAnchorRow(articles[i]) && test(articles[i])) n++;
          return n;
        };
        const without = {};
        live.forEach(function (row) {
          row.disabled = true;
          try { without[row.id] = count(compileFromRows(rows)); }
          finally { delete row.disabled; }
        });
        impactResult = { count: count(compileFromRows(rows)), without: without };
      } catch (err) {
        impactResult = null;                     // invalid draft: no counts
      } finally {
        window.OARuleHighlights = highlights;
      }
      return impactResult;
    }

    /* ---------------------------------------------------------------- */
    /* URL query parser: ?q=... -> rule tree                            */
    /* ---------------------------------------------------------------- */

    const FIELD_ALIASES = ruleLanguage.FIELD_ALIASES;
    const RELATION_FIELDS = ruleLanguage.RELATION_FIELDS;

    var _distinctMemo = null;
    function updateResultCount() {
      // The DataView has just re-run the filter (refresh precedes every call
      // to this), so read its result instead of evaluating the predicate over
      // every article a second time.
      const filteredItems = dataView.getFilteredItems();
      let filteredCount = filteredItems ? filteredItems.length : 0;
      // Category grouping holds one row per (article, category) pair, so count
      // distinct ARTICLES - the chip must stay comparable to the total. Keyed on
      // the filtered-array identity (a fresh array per refresh), so repeated
      // calls for the same result set pay the 25k scan once.
      if (filteredCount && activeGrouping === "category") {
        if (_distinctMemo && _distinctMemo.src === filteredItems) {
          filteredCount = _distinctMemo.distinct;
        } else {
          const seen = new Set();
          for (let i = 0; i < filteredItems.length; i++) seen.add(filteredItems[i].id);
          _distinctMemo = { src: filteredItems, distinct: seen.size };
          filteredCount = seen.size;
        }
      }

      const el = document.getElementById("resultCount");
      if (!el) return;
      // The count is a permanent chip beside the search box - it reads the same
      // whether or not a query is typed, so the filtered set is always legible
      // (it used to hide inside the placeholder, where typing erased it).
      el.hidden = false;
      // Accented while anything narrows the set (a rule filter or a search),
      // so the chip itself says "you are looking at a subset".
      // "Narrowed" means the set is actually smaller, or something is actively
      // narrowing it. A half-filled row (no value yet) and a parked SKIP row
      // both contribute nothing, so neither may accent the chip - the count
      // would read as a subset while the whole corpus is on screen.
      const liveRules = ruleTree.rows.some(function (r) { return !r.disabled && conditionToString(r) !== ""; });
      const narrowed = filteredCount !== articles.length || !!searchController.query || liveRules;
      el.classList.toggle("is-active", narrowed);
      // A status, not a control (the labelled Filters button opens the
      // conditions): "5 724", or "103 of 5 724" while narrowed. An invisible
      // sizer holding the widest form ("5 724 of 5 724") shares the grid cell,
      // so the count keeps one width and the search field never jumps when a
      // filter narrows the list. Screen readers hear only the live text.
      const totalText = countFormat.format(articles.length);
      el.innerHTML =
        '<span class="rc-live">' + (filteredCount === articles.length
          ? totalText
          : countFormat.format(filteredCount) + " of " + totalText) + "</span>" +
        '<span class="rc-sizer" aria-hidden="true">' + totalText + " of " + totalText + "</span>";
      // Say what actually narrows the list.
      const ofTotal = countFormat.format(filteredCount) + " of " + countFormat.format(articles.length) + " articles";
      el.title = liveRules
        ? ofTotal + " match the current filters (Filters shows them)"
        : searchController.query
          ? ofTotal + " match the search " + quotedQuery(searchController.query)
          : "All " + countFormat.format(articles.length) + " articles";
      syncResetButton();

      // A selection only means something while its rows are in the result set:
      // drop marked rows the new filter / search excludes, so Export and Open
      // all never act on articles that are no longer on screen.
      if (rowSel && rowSel.retain && rowSel.count()) {
        const keep = new Set();
        for (let i = 0; i < (filteredItems || []).length; i++) keep.add(filteredItems[i].id);
        rowSel.retain(function (id) { return keep.has(id); });
      }

      updateEmptyState(filteredCount);
      syncExportButton(filteredCount);
      syncOpenAllButton(filteredCount);
      authorFooter.sync(filteredItems);
      syncAuthorPanel();
      syncAnchorStrip();
    }

    // The Clear x beside Filters: always there (the split keeps one size),
    // live only while something (a condition, parked or live, or a search)
    // narrows the list.
    function syncResetButton() {
      const btn = document.getElementById("resetFilters");
      if (!btn) return;
      const active = !!(searchController.query || ruleTree.rows.some(function (r) { return conditionToString(r) !== ""; }));
      btn.disabled = !active;
      btn.hidden = false;
    }

    // Pin glyph (Tabler "pin") for the anchor strip's caret column.
    const PIN_SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-pin" aria-hidden="true">' +
      '<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>' +
      '<path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"></path><path d="M9 15l-4.5 4.5"></path><path d="M14.5 4l5.5 5.5"></path></svg>';

    // The article a live graph rule points at, pinned in the grid's top panel:
    // one row set on the grid's own column tracks (.l<i>/.r<i>) with the
    // columns' own formatters, inside #myGrid - so it reads and behaves exactly
    // like a list row (styles, star, metrics, chips, links all apply) but sits
    // under the header while the list scrolls. The caret column carries a pin
    // instead of the chevron: a drop cannot open up here. Rebuilt only when
    // the anchor or the column tracks change.
    let _anchorStripKey = "";
    function syncAnchorStrip() {
      const panel = grid.getTopPanel ? grid.getTopPanel() : null;
      if (!panel) return;
      const art = sharedAnchorId !== null ? lookupArticle(sharedAnchorId) : null;
      if (!art) {
        if (_anchorStripKey) { _anchorStripKey = ""; panel.innerHTML = ""; grid.setTopPanelVisibility(false, false); }
        return;
      }
      const cols = grid.getColumns();
      const canvas = grid.getCanvasNode ? grid.getCanvasNode() : null;
      const width = canvas ? canvas.offsetWidth : 0;
      const key = art.id + "|" + width + "|" + columnLayoutKey();
      if (key === _anchorStripKey && panel.childElementCount) return;
      _anchorStripKey = key;
      let cells = "";
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        let html;
        if (col.id === columns[0].id) {
          const tip = "Article in focus: the graph rule points at this article.&#10;Pinned here while the list scrolls; not counted as a match.";
          html = '<span class="oa-anchor-pin" role="img" title="' + tip + '" aria-label="Article in focus, pinned">' + PIN_SVG + "</span>";
        } else if (typeof col.formatter === "function") {
          html = col.formatter(0, i, art[col.field], col, art) || "";
        } else {
          html = escapeHtml(String(art[col.field] == null ? "" : art[col.field]));
        }
        cells += '<div class="slick-cell l' + i + " r" + i + (col.cssClass ? " " + col.cssClass : "") + '">' + html + "</div>";
      }
      panel.innerHTML = '<div class="slick-row ui-widget-content oa-anchor-row" style="top:0;width:' + width + 'px" data-anchor-id="' + escapeHtml(art.id) + '">' + cells + "</div>";
      if (!grid.getOptions().showTopPanel) grid.setTopPanelVisibility(true, false);
      scheduleKeywordClamp();   // the strip's keyword cell clamps like any row's (#myGrid scope)
    }

    // The summary row under the table (author-footer.js).
    const authorFooter = window.OAAuthorFooter.create({ FIELDS, applyDateCellFilter, articleStore, authorIdOf, authorLinkHtml, authorSlugToLabel, columnLayoutKey, conditionToString, countFormat, dataView, dateModeFromKey, escapeHtml, grid, layout, normalizeText, renderers, ruleEditor, ruleLanguage, ruleTree, scope, searchController, toggleFieldRule, wireDateAuxButtons });

    /* Right-margin panel -------------------------------------------------
     * Three parts beside the table: the article's Centralities
     * (drop-metrics.js panel) and, under them, its Affiliations
     * (paper-affiliation-map.js) while an ID IS filter names one article, the
     * author's metrics (author-panel.js) while an AUTHOR IS filter names one
     * known author, and Topic Trends
     * (topic-panel.js) while the filter has keyword / category rules and no
     * AUTHOR IS rule (its database-wide counts don't describe an author's list).
     * .has-author-panel narrows the table where the margin is too small for
     * them (articles.css). The header's metrics toggle (#panelToggle) puts
     * the panel away; the choice is remembered. */
    var authorPanel = null, authorPanelSlug = "", topicPanel = null, articlePanel = null, affilPanel = null;
    var PANEL_OFF_KEY = "oa-metrics-panel-off";
    var panelOff = window.OAPrefs.get(PANEL_OFF_KEY) === "1";
    // Below 1180px the panel has no room (articles.css) and the Centralities
    // go back under the abstract. Toggled off, they are off: the drop does not
    // take them back (syncAuthorPanel).
    var panelNarrowMQ = window.matchMedia("(max-width: 1179px)");
    // The window crossing 1838px: the table's width changes with --ap-grow, and
    // the Authors column goes with it in the pass that first sees that width
    // (layout.refitOnWidth) - one fit, painted once.
    function syncWideAuthors() {
      var on = wideAuthorsMQ.matches;
      if (on === wideAuthors) return;
      wideAuthors = on;
      layout.refitOnWidth(function () {
        setAuthorsWidth(on, columns);
        setAuthorsWidth(on, grid.getColumns());
        designWidths.authors = on ? WIDE_AUTHORS_W : authorsDesign;
      });
    }
    scope.listen(wideAuthorsMQ, "change", syncWideAuthors);
    var articleInPanel = false;
    // The article an ID IS rule last named. A new one - pinned, typed into the
    // builder or loaded from the URL - puts the Rule Builder away; re-opened,
    // it stays open until the next one.
    var lastPinnedId = null;
    // The abstract a pin opened itself (not one the reader had open already):
    // it closes again when that pin goes.
    var pinOpenedId = null;
    // The pinned article's row key, null while no row of it is in view (all
    // in collapsed groups). Under category grouping rows are keyed by
    // _rowKey, one per category: the first one's.
    function pinnedRowKey(id) {
      const grouped = !!(dataView.getGrouping && dataView.getGrouping().length);
      const keyed = !!(dataView.getIdPropertyName && dataView.getIdPropertyName() === "_rowKey");
      if (!grouped && !keyed) return id;
      for (let i = 0, n = dvGetLength(); i < n; i++) {
        const it = dvGetItem(i);
        if (it && !it.__group && !it.__groupTotals && it.id === id) return keyed ? it._rowKey : id;
      }
      return null;
    }
    // Only the pinned article's own groups open (all of them, every level), and
    // the ones that start folded fold again when the pin goes - so the list
    // comes back as it was, not with every group open. Returns whether the
    // list is grouped at all.
    var pinExpandedGroups = [], pinGroupedBy = "";
    function expandPinnedGroups(id) {
      const infos = dataView.getGrouping ? dataView.getGrouping() : [];
      if (!infos.length) return false;
      const delim = dataView.groupingDelimiter || ":|:";
      const items = dataView.getItems(), seen = new Set(), keys = [];
      // Which of them are folded now: only those fold again with the pin.
      const folded = new Set();
      (function walk(groups) {
        (groups || []).forEach(function (g) { if (g.collapsed) folded.add(g.groupingKey); walk(g.groups); });
      })(dataView.getGroups ? dataView.getGroups() : []);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || it.id !== id) continue;
        let key = "";
        for (let l = 0; l < infos.length; l++) {
          const g = infos[l].getter;
          // As the DataView builds it: string concatenation of the values.
          key = (l ? key + delim : "") + (typeof g === "function" ? g(it) : it[g]);
          if (seen.has(key)) continue;
          seen.add(key);
          keys.push(key);
          if (folded.has(key)) pinExpandedGroups.push(key);
        }
      }
      pinGroupedBy = activeGrouping;
      batchRepaint(function () { keys.forEach(function (k) { dataView.expandGroup(k); }); });
      return true;
    }
    function collapsePinnedGroups() {
      const keys = pinExpandedGroups.splice(0);
      if (!keys.length || pinGroupedBy !== activeGrouping) return;
      batchRepaint(function () { for (let i = keys.length - 1; i >= 0; i--) dataView.collapseGroup(keys[i]); });
    }
    function metricsInPanel() { return articleInPanel; }
    scope.listen(panelNarrowMQ, "change", function () { syncAuthorPanel(); });
    // The panel lives in the grid wrap but starts level with the toolbar, so
    // it also takes the margin beside the search row and the open filters.
    function liftAuthorPanel() {
      const host = document.getElementById("authorPanel");
      const bar = document.querySelector(".articles-app .toolbar");
      if (!host || host.hidden || !bar || !host.parentElement) return;
      const lift = host.parentElement.getBoundingClientRect().top - bar.getBoundingClientRect().top;
      host.style.setProperty("--ap-lift", Math.max(0, Math.round(lift)) + "px");
    }
    const toolbarEl = document.querySelector(".articles-app .toolbar");
    if (toolbarEl) scope.observe(new window.ResizeObserver(scope.guard(liftAuthorPanel))).observe(toolbarEl);
    function syncAuthorPanel() {
      const host = document.getElementById("authorPanel");
      const app = host && host.closest(".articles-app");
      if (!host || !app) return;
      const authorHost = host.querySelector('[data-part="author"]');
      const topicHost = host.querySelector('[data-part="topics"]');
      const articleHost = host.querySelector('[data-part="article"]');
      const affilHost = host.querySelector('[data-part="affil"]');
      const pinnedId = ruleEditor.idFilterArticleId();
      // Only an ID naming a real article: half-typed in the builder, it stays.
      const pinnedRaw = pinnedId !== null ? lookupArticle(pinnedId) : null;
      const pinnedItem = pinnedRaw ? (pinnedRaw.__src || pinnedRaw) : null;
      const pinned = pinnedItem ? pinnedItem.id : null;
      // In the list at all: ANDed with a rule that excludes it, the table is
      // empty and its Centralities have no place there.
      const pinnedShown = !!pinnedItem && dataViewFilter(pinnedItem);
      const metricsItem = pinnedShown ? pinnedItem : null;
      const pinChanged = pinned !== lastPinnedId;
      // Set first: expanding the groups below refreshes the list, which comes
      // back through here.
      lastPinnedId = pinned;
      if (pinChanged) {
        // In the same task as the rule change: deferred, the builder painted
        // open (with the new rule) for a frame before it went.
        if (pinned !== null) ruleEditor.setOpen(false);
        // The abstract the last pin opened closes with it, and a new pin opens
        // its own - pinned by a click, the builder, a link or Back alike.
        if (pinOpenedId !== null) {
          if (absRows.isOpen(pinOpenedId)) absRows.toggle(pinOpenedId);
          pinOpenedId = null;
        }
        collapsePinnedGroups();
      }
      if (pinned !== null && pinnedShown) {
        // Grouped, the article can sit in collapsed groups (category: one per
        // category it has) - also when the grouping comes after the pin: open
        // them, so the pinned row is in view.
        let key = pinnedRowKey(pinned);
        if (key === null && expandPinnedGroups(pinned)) key = pinnedRowKey(pinned);
        if (key !== null) {
          if (pinChanged) {
            if (!absRows.isOpen(key)) { absRows.toggle(key); pinOpenedId = key; }
          } else if (pinOpenedId !== null && pinOpenedId !== key) {
            // Category grouping on or off re-keys the rows: the pin's abstract
            // follows its row.
            if (absRows.isOpen(pinOpenedId)) absRows.toggle(pinOpenedId);
            if (!absRows.isOpen(key)) absRows.toggle(key);
            pinOpenedId = key;
          }
        }
      }
      const showArticle = !!(metricsItem && articleHost);
      const slug = window.OAAuthorPanel ? ruleEditor.authorFilterSlug() : null;
      const showAuthor = slug !== null && authorSlugToLabel.has(slug);
      const topics = window.OATopicPanel && !hasAuthorIsRule() ? topicSeries() : null;
      const showTopics = !!(topics && topics.groups.length);
      const show = (showArticle || showAuthor || showTopics) && !panelOff;
      const changed = host.hidden === show;
      host.hidden = !show;
      if (articleHost) articleHost.hidden = !showArticle;
      // The Affiliations map has no place in the drop: it shows only beside
      // the Centralities in the panel.
      const showAffil = showArticle && !!affilHost && !!window.OAPaperAffiliations;
      if (affilHost) affilHost.hidden = !showAffil;
      // The panel's split (articles.css .oa-panel-2col): a class on .oa-root,
      // set here with the parts it follows. The table's width does not change.
      const twoCol = show && showAffil && !panelNarrowMQ.matches;
      if (app.parentElement) app.parentElement.classList.toggle("oa-panel-2col", twoCol);
      authorHost.hidden = !showAuthor;
      topicHost.hidden = !showTopics;
      const inPanel = showArticle && !panelNarrowMQ.matches;
      if (inPanel !== articleInPanel) {
        articleInPanel = inPanel;
        // Off the filter pass: the drops re-render with or without the section
        // (at the end of a pin's batch, so the click paints the final drop).
        afterThisPass(scope.guard(function () { absRows.render(true, true); }));
      }
      app.classList.toggle("has-author-panel", show);
      if (changed) layout.requestResize();
      if (!show) return;
      liftAuthorPanel();
      const range = ruleEditor.dateFilterRange();
      const setRange = function (from, to) { markNavigation(); ruleEditor.setDateRange(from, to); };
      // Only while the panel really holds them: show() moves the live SVGs in
      // (out of the drop) and loads the chart data.
      if (articleInPanel) {
        if (!articlePanel) {
          articlePanel = window.OADropMetrics.panel(articleHost);
          scope.add(function () { if (articlePanel) articlePanel.destroy(); articlePanel = null; });
        }
        articlePanel.show(metricsItem);
        if (showAffil) {
          if (!affilPanel) {
            affilPanel = window.OAPaperAffiliations.panel(affilHost);
            scope.add(function () { if (affilPanel) affilPanel.destroy(); affilPanel = null; });
          }
          affilPanel.show(metricsItem);
        }
      }
      if (showAuthor) {
        if (!authorPanel) {
          authorPanel = window.OAAuthorPanel.create(authorHost, { apply: function (picks, replace) { gridActions.applyRulePicks(picks, replace); }, range: setRange });
          scope.add(function () { if (authorPanel) authorPanel.destroy(); authorPanel = null; });
        }
        authorPanel.show(slug);
        authorPanel.setRange(range);
        if (slug !== authorPanelSlug && !(window.OATour && window.OATour.isOpen())) {
          authorPanelSlug = slug;
          // Off the filter pass: the visit repaints the rendered author cells.
          // Not while the guided tour shows its demo author: that visit is the
          // tour's, not the reader's.
          setTimeout(scope.guard(function () { markAuthorVisited(slug); }), 0);
        }
      }
      if (showTopics) {
        if (!topicPanel) {
          topicPanel = window.OATopicPanel.create(topicHost, { range: setRange });
          scope.add(function () { if (topicPanel) topicPanel.destroy(); topicPanel = null; });
        }
        topicPanel.show(topics);
        topicPanel.setRange(range);
      }
    }
    // Always in the header: it sets whether the panel shows when a filter
    // gives it something to show.
    function syncPanelToggle() {
      const btn = document.getElementById("panelToggle");
      if (!btn) return;
      btn.setAttribute("aria-pressed", String(!panelOff));
      btn.title = panelOff ? "Show the metrics panel" : "Hide the metrics panel";
    }
    (function () {
      const btn = document.getElementById("panelToggle");
      if (!btn) return;
      syncPanelToggle();
      scope.listen(btn, "click", function () {
        panelOff = !panelOff;
        window.OAPrefs.set(PANEL_OFF_KEY, panelOff ? "1" : "0");
        syncPanelToggle();
        syncAuthorPanel();
      });
    })();

    // Topic Trends series: the keyword / category part of the filter in
    // disjunctive normal form - one series per AND-combination of its OR
    // branches, with NOT pushed down to the terms (De Morgan). Other
    // conditions neither narrow nor split a series (the date filter is the
    // shaded interval instead); a combination without a positive topic term
    // names no series.
    const TOPIC_SERIES_MAX = 6;
    const NEGATIVE_OPS = { "is not": true, "does not contain": true };
    // A switched-on AUTHOR IS rule anywhere in the filter (not "is not", not
    // under a NOT, not CITES_AUTHOR / CITED_BY_AUTHOR).
    function hasAuthorIsRule() {
      let tree = null;
      try { tree = ruleLanguage.fromRows(ruleTree.rows); } catch (e) { return false; }
      const live = function (n, neg) {
        if (!n || n.disabled) return false;
        if (n.type === "rule") return !neg && n.field === FIELDS.AUTHOR && n.operator === "is" && !!String(n.value || "").trim();
        if (n.type === "not") return live(n.child, !neg);
        return (n.children || []).some(function (c) { return live(c, neg); });
      };
      return live(tree, false);
    }
    function topicSeries() {
      let tree = null;
      try { tree = ruleLanguage.fromRows(ruleTree.rows); } catch (e) { return null; }
      if (!tree) return null;
      const isTopic = function (n) { return n.field === FIELDS.KEYWORD || n.field === FIELDS.CATEGORY; };
      // null: the node contributes nothing (switched off, empty). [[]]: true for
      // the topics (a non-topic condition). Otherwise a list of conjunctions.
      function dnf(node, neg) {
        if (!node || node.disabled) return null;
        if (node.type === "rule") {
          if (!String(node.value || "").trim()) return null;
          return isTopic(node) ? [[{ rule: node, neg: neg }]] : [[]];
        }
        if (node.type === "not") return dnf(node.child, !neg);
        const kids = (node.children || []).map(function (c) { return dnf(c, neg); }).filter(Boolean);
        if (!kids.length) return null;
        if ((node.logic === "AND") === neg) return [].concat.apply([], kids);   // OR (or a negated AND)
        return kids.reduce(function (acc, kid) {
          const out = [];
          acc.forEach(function (a) { kid.forEach(function (k) { if (out.length < 64) out.push(a.concat(k)); }); });
          return out;
        }, [[]]);
      }
      const negative = function (l) { return l.neg !== !!NEGATIVE_OPS[l.rule.operator]; };
      const label = function (l) {
        const r = l.rule, v = String(r.value).trim();
        const val = r.field === FIELDS.CATEGORY ? v.toUpperCase() : v;
        const body = /contain/.test(r.operator) ? "\u201C" + val + "\u201D" : r.operator === "begins with" ? val + "\u2026" : val;
        return (negative(l) ? "\u00AC" : "") + body;
      };
      const hl = window.OARuleHighlights;
      window.OARuleHighlights = null;   // these compiles must not add highlight needles
      try {
        const seen = new Set(), groups = [];
        let more = 0;
        (dnf(tree, false) || []).forEach(function (lits) {
          if (!lits.some(function (l) { return !negative(l); })) return;
          const parts = lits.map(label);
          const key = lits.map(function (l, i) { return l.rule.field + ":" + parts[i]; }).sort().join("\u0001");
          if (seen.has(key)) return;
          seen.add(key);
          if (groups.length >= TOPIC_SERIES_MAX) { more++; return; }
          const tests = lits.map(function (l) {
            const t = compileRule(l.rule);
            return t && l.neg ? function (a) { return !t(a); } : t;
          });
          if (tests.some(function (t) { return !t; })) return;
          // The categories the combination names: its colour comes from them first.
          const categories = lits.filter(function (l) { return l.rule.field === FIELDS.CATEGORY && l.rule.operator === "is" && !negative(l); })
            .map(function (l) { return String(l.rule.value).trim().toUpperCase(); });
          groups.push({ key: key, label: parts.join(" \u2227 "), categories: categories, test: function (a) {
            for (let i = 0; i < tests.length; i++) if (!tests[i](a)) return false;
            return true;
          } });
        });
        return { groups: groups, more: more, articles: articles };
      } finally {
        window.OARuleHighlights = hl;
      }
    }

    // "Open all" appears only when the filter narrows the set below this many
    // matches - opening dozens of browser tabs at once is only sane when few.
    const OPEN_ALL_MAX = 50;

    // Enable the "Export" button only when there are matches to download, and
    // surface the count in its tooltip. Driven from updateResultCount so it
    // tracks every filter change.
    function syncExportButton(count) {
      if (count == null) count = lastFilteredCount;
      const selected = rowSel && rowSel.count() > 0;
      if (selected) count = rowSel.count();
      const btn = document.getElementById("exportResults");
      if (!btn) return;
      const ok = count > 0;
      btn.disabled = !ok;
      btn.title = ok
        ? "Download " + countFormat.format(count) + (selected ? " selected article" : " matching article") + (count === 1 ? "" : "s") + " as BibTeX (.bib)"
        : "No matching articles to download";
    }

    // Reveal the "Open all" button once the TARGET set is small enough to
    // open as tabs: the marked rows when a selection exists (any corpus size),
    // otherwise the filtered matches once they drop below OPEN_ALL_MAX.
    let lastFilteredCount = 0;
    function syncOpenAllButton(count) {
      if (count != null) lastFilteredCount = count; else count = lastFilteredCount;
      const btn = document.getElementById("openAll");
      if (!btn) return;
      const selN = rowSel ? rowSel.count() : 0;
      const n = selN > 0 ? selN : count;
      const what = selN > 0 ? "selected" : "matching";
      const show = n > 0 && n < OPEN_ALL_MAX;
      // Always in the row; greyed out until the target set is small enough.
      btn.hidden = false;
      btn.disabled = !show;
      // The count rides beside the word like the Favorites and Filters counts.
      const cnt = btn.querySelector(".open-all-count");
      if (show) {
        if (cnt) cnt.textContent = String(n);
        btn.title = "Open all " + n + " " + what + " article" +
          (n === 1 ? "" : "s") + " in new tabs \u00b7 via " + openRouteLabel(openRoute());
      } else {
        if (cnt) cnt.textContent = "";
        btn.title = n === 0
          ? "Open all matching articles in new tabs - nothing to open"
          : "Open all matching articles in new tabs - narrow the list below " + OPEN_ALL_MAX + " first (" + countFormat.format(n) + " now)";
      }
    }

    // Short human label for one rule row - the filter pills and the empty-state
    // button use it: "Author: Bos Freek", "Keyword: not #concrete",
    // "Date: 2019-01 - 2023-12", "Open access", "Favorites".
    function ruleShortLabel(row) {
      const def = ruleFieldDefinitions[row.field] || { label: row.field };
      let v = String(row.value || "").trim();
      if (ruleLanguage.AUTHOR_FIELDS.has(row.field)) v = authorSlugToLabel.get(v) || v;
      if (row.field === FIELDS.CATEGORY) {
        const d = (window.CATEGORY_DEFS || {})[v.toUpperCase()];
        if (d && d.title) v = v.toUpperCase() + " \u00b7 " + typesetText(d.title);
      }
      if (row.field === FIELDS.TYPE) {
        const opt = (ruleFieldDefinitions.type.options || []).filter(function (o) {
          return o.value.toLowerCase() === v.toLowerCase();
        })[0];
        return "Type: " + (row.operator === "is not" ? "not " : "") + (opt ? opt.label : v);
      }
      if (BOOL_RULE_FIELDS.has(row.field)) {
        const yes = String(row.value).toLowerCase() !== "false";
        if (row.field === FIELDS.IS_FAVORITE) return yes ? "Favorites" : "Not favorites";
        return yes ? "Open access" : "Closed access";
      }
      if (row.field === FIELDS.DATE) {
        if (row.operator === "between") return "Date: " + v + " - " + String(row.value2 || "");
        const sym = { "=": "", "!=": "not ", ">=": "\u2265 ", "<=": "\u2264 " }[row.operator] || "";
        return "Date: " + sym + v;
      }
      const neg = row.operator === "is not" || row.operator === "does not contain";
      const contains = row.operator === "contains" || row.operator === "does not contain";
      const begins = row.operator === "begins with";
      return def.label + ": " + (neg ? "not " : "") + (contains ? "\u201C" + v + "\u201D" : begins ? v + "\u2026" : v);
    }

    // Show the "no matches" overlay only when (a) the dataset itself is
    // non-empty and (b) the active rules have filtered it down to zero.
    // The empty grid case (no articles loaded at all) is left alone so the
    // user still sees the bare grid frame.
    //
    // The "Remove last filter" button is disabled when there are no rows
    // to remove, which is uncommon (zero results with zero rules means an
    // empty dataset) but possible if every article is later filtered out
    // by upstream means.
    function updateEmptyState(filteredCount) {
      const overlay = document.getElementById("emptyState");
      if (!overlay) {
        return;
      }

      const shouldShow = articles.length > 0 && filteredCount === 0;
      overlay.hidden = !shouldShow;
      if (!shouldShow) {
        return;
      }

      const headline  = overlay.querySelector(".empty-state-headline");
      const subline   = overlay.querySelector(".empty-state-subline");
      const removeBtn = document.getElementById("emptyStateRemoveLast");
      const clearBtn  = document.getElementById("emptyStateClearAll");
      const anyBtn    = document.getElementById("emptyStateAnyWord");
      if (anyBtn) anyBtn.hidden = true;
      const suggestEl = document.getElementById("emptyStateSuggest");
      if (suggestEl) suggestEl.hidden = true;
      const liveRules = ruleTree.rows.filter(function (r) { return !r.disabled && conditionToString(r) !== ""; });

      // Special case: the favorites filter is on but nothing is saved yet. The
      // generic "relax a condition" copy is wrong here (there's no rule to
      // relax that would help) - guide the reader to build a list instead.
      const favEmpty = isFavRuleActive() && window.OAFavorites.count() === 0;

      if (favEmpty) {
        if (headline) headline.textContent = "No saved articles yet";
        if (subline) subline.textContent =
          "Star any article to build your reading list. It's saved in this browser, no account needed.";
        if (removeBtn) removeBtn.hidden = true;
        if (clearBtn) {
          clearBtn.hidden = false;
          clearBtn.disabled = false;
          clearBtn.textContent = "Browse all articles";
          clearBtn.dataset.mode = "favEmpty";
        }
        return;
      }

      // A live text query that matched nothing: name the query and offer to
      // clear it - and, when rules also narrow the set the search runs in, to
      // relax those instead.
      if (searchController.query) {
        if (headline) headline.textContent = "No matches for " + quotedQuery(searchController.query);
        const relaxable = !!searchController.relaxable;
        if (subline) subline.textContent = relaxable
          ? "No article contains every word. Match any of them instead, or try other words:"
          : liveRules.length
          ? "Try other words, or widen the set the search runs in:"
          : "Try other words, fewer of them, or check the spelling.";
        if (anyBtn) anyBtn.hidden = !relaxable;
        if (removeBtn) {
          delete removeBtn.dataset.mode;
          delete removeBtn.dataset.rowId;
          removeBtn.hidden = !liveRules.length;
          removeBtn.disabled = !liveRules.length;
          removeBtn.textContent = liveRules.length ? "Remove " + ruleShortLabel(liveRules[liveRules.length - 1]) : "";
        }
        if (clearBtn) {
          clearBtn.hidden = false;
          clearBtn.disabled = false;
          clearBtn.textContent = "Clear search";
          clearBtn.dataset.mode = "search";
        }
        return;
      }

      // Generic zero-result state: restore the default copy / buttons (the
      // nodes persist between renders, so undo any favorites-empty overrides).
      // Offer to switch off the condition whose absence brings back the most
      // articles (drop-one counts) - the one actually in the way - rather than
      // whichever was added last.
      const impact = liveRules.length ? ruleImpact() : null;
      let best = null;
      if (impact) liveRules.forEach(function (r) {
        const n = impact.without[r.id] || 0;
        if (n > 0 && (!best || n > best.n)) best = { row: r, n: n };
      });
      // An ID no article has (an old or mistyped link): say so, and offer the
      // closest articles.
      const unknownRow = liveRules.find(function (r) {
        const keyed = (r.field === FIELDS.ID && r.operator === "is") || ruleLanguage.RELATION_FIELDS.has(r.field);
        const v = String(r.value == null ? "" : r.value).trim();
        return keyed && v !== "" && !lookupArticle(v);
      });
      const suggested = unknownRow ? suggestArticles(unknownRow.value) : [];
      if (suggestEl && suggested.length) {
        const html = suggested.map(function (art) {
          const title = typesetText(art.title || art.id);
          return '<li><a class="empty-state-suggest-link" href="' + escapeHtml(suggestionHref(unknownRow, art.id)) +
            '" data-row-id="' + escapeHtml(String(unknownRow.id)) + '" data-id="' + escapeHtml(art.id) + '">' +
            '<span class="empty-state-suggest-title">' + escapeHtml(title) + '</span>' +
            '<span class="empty-state-suggest-meta">' + escapeHtml(suggestMeta(art)) + '</span></a></li>';
        }).join("");
        if (suggestEl.innerHTML !== html) suggestEl.innerHTML = html;
        suggestEl.hidden = false;
      }
      if (headline) headline.textContent = unknownRow ? "No article with this ID" : "No articles match";
      if (subline) {
        subline.textContent = unknownRow
          ? "\u201C" + String(unknownRow.value).trim() + "\u201D may be mistyped or out of date." + (suggested.length ? " Did you mean:" : "")
          : best ? "Switching off one condition brings articles back:"
          : liveRules.length > 1 ? "No single condition is to blame. Remove one, or clear them all:"
          : "Remove the condition, or clear everything:";
      }
      if (removeBtn) {
        removeBtn.hidden = false;
        if (best) {
          removeBtn.textContent = "Turn off " + ruleShortLabel(best.row) + " \u00b7 " +
            countFormat.format(best.n) + " article" + (best.n === 1 ? "" : "s");
          removeBtn.dataset.mode = "turnOff";
          removeBtn.dataset.rowId = best.row.id;
        } else {
          removeBtn.textContent = liveRules.length ? "Remove " + ruleShortLabel(liveRules[liveRules.length - 1]) : "Remove last filter";
          delete removeBtn.dataset.mode;
          delete removeBtn.dataset.rowId;
        }
        removeBtn.disabled = ruleTree.rows.length === 0;
      }
      if (clearBtn) {
        clearBtn.hidden = false;
        clearBtn.textContent = "Clear all filters";
        clearBtn.removeAttribute("data-mode");
        clearBtn.disabled = ruleTree.rows.length === 0;
      }
    }

    // Right-click on an author name anywhere in the table (cells, author
    // footer) makes that author the list's AUTHOR IS filter, which shows their
    // metrics beside the table (syncAuthorPanel). Right-click on a title shows
    // the article's graph metrics (see showMetrics).
    function authorContextMenu(event) {
      // Date chips: the right button filters by the chip's YEAR (LMB is the
      // month, MMB everything since it).
      const dl = event.target.closest(".date-link");
      if (dl && dl.dataset.date) {
        event.preventDefault();
        event.stopPropagation();
        applyDateCellFilter(dl.dataset.date, "year");
        return;
      }
      const t = event.target.closest(".title-link");
      if (t && t.dataset.id) {
        event.preventDefault();
        event.stopPropagation();
        markNavigation();
        showMetrics(t.dataset.id, t);
        return;
      }
      // Keyword / category chips: joined with OR - another Topic Trends series.
      const kw = event.target.closest(".keyword-link");
      if (kw && kw.dataset.keyword) {
        event.preventDefault();
        event.stopPropagation();
        markNavigation();
        ruleEditor.toggleTopicOr("keyword", kw.dataset.keyword);
        return;
      }
      const cat = event.target.closest(".oa-cat-chip");
      if (cat && cat.dataset.category) {
        event.preventDefault();
        event.stopPropagation();
        markNavigation();
        ruleEditor.toggleTopicOr("category", cat.dataset.category);
        return;
      }
      const a = event.target.closest(".author-link");
      if (!a || !a.dataset.author) return;
      event.preventDefault();
      event.stopPropagation();
      markNavigation();
      ruleEditor.pinAuthor(a.dataset.author);
    }
    scope.listen(document.getElementById("myGrid"), "contextmenu", authorContextMenu);
    scope.listen(authorFooter.host, "contextmenu", authorContextMenu);

    /* ---------------------------------------------------------------- */
    /* Plain-text rule expression: ASCII-only, word operators, uppercase */
    /* syntax tokens, lowercase content. Used both to build URL params   */
    /* and to feed the parser+compiler from the rule-builder rows.       */
    /* ---------------------------------------------------------------- */



    /* ---------------------------------------------------------------- */
    /* Live URL sync: pushes the current rule + sort into the address   */
    /* bar via history.replaceState so the page stays shareable without */
    /* adding entries to the browser history.                           */
    /* ---------------------------------------------------------------- */

    // urlSyncReady gates updates during buildGrid's own init pass; if
    // it fired then it would clobber sort_by between the rule-filter
    // step and applySortFromUrl, since those run sequentially.
    let urlSyncReady = false;

    // URL params are read case-insensitively (getParam), so writing must clear
    // every casing of a param it owns - URLSearchParams treats ?Q= and ?q= as
    // different keys, and a stale ?Q= would restore a cleared filter on reload.
    const URL_OWNED_PARAMS = ["q", "SORT_BY", "GROUP_BY", "search", "match"];
    function removeParameterAliases(params, names) {
      const owned = new Set(names.map(function (name) { return name.toLowerCase(); }));
      Array.from(params.keys()).forEach(function (key) {
        if (owned.has(key.toLowerCase())) params.delete(key);
      });
    }

    // The search said back to the reader, in curly quotes - unless it holds
    // quoted phrases of its own: those become the curly pair rather than being
    // wrapped in a second one (\u201C"yield stress"\u201D read as a typo).
    function quotedQuery(q) {
      q = String(q || "");
      return q.indexOf('"') < 0 ? "\u201C" + q + "\u201D" : q.replace(/"([^"]*)"/g, "\u201C$1\u201D");
    }

    function buildShareableUrl() {
      const url = new URL(window.location.href);
      removeParameterAliases(url.searchParams, URL_OWNED_PARAMS);

      const expression = ruleEditor.queryForUrl();
      if (expression !== "") url.searchParams.set("q", expression);

      const sortBy = inferSortByFromGrid();
      if (sortBy) url.searchParams.set("SORT_BY", sortBy);

      if (activeGrouping) url.searchParams.set("GROUP_BY", activeGrouping.toUpperCase());

      // The free-text query is part of what a reader shares - without it a
      // pasted link (or a reload) silently drops the search. Its match mode
      // goes with it: the same words under "any" are a different result set.
      if (searchController.query) {
        url.searchParams.set("search", searchController.query);
        if (searchController.anyWord) url.searchParams.set("match", "any");
      }

      return url.toString();
    }

    let urlSyncTimer = null;
    // Set by the cell / chip / popover filter actions (toggleFieldRule and
    // friends): to a reader, clicking an author or keyword is navigation, so
    // that URL change becomes a history entry Back can undo. Typed edits,
    // sorts and grouping keep replacing the current entry.
    let urlSyncPush = false;

    /* Breadcrumb echo of a short link. When the whole query is nothing but one
       AUTHOR IS / ID IS rule - which is exactly what 3dcp.fyi/<slug> and
       3dcp.fyi/<bibtex key> load - the crumb shows that short link back, so the
       address the user could have typed is visible even after the ?q= rewrite.
       Anything more complex than that single rule has no short form, so the
       crumb stays bare. */
    function shortLinkUrl(tail) {
      try { return window.OABibliography.siteUrl(tail.split("/").map(encodeURIComponent).join("/")); }
      catch (_) { return window.OABibliography.siteUrl("index.html"); }
    }
    // Sole graph rule -> 3dcp.fyi/<key>/references | /citations | /similar
    // (the 404.html router understands the same three tails).
    const GRAPH_TAIL = { references: "references", citedBy: "citations", similarTo: "similar" };
    // The shapes the 404.html router turns back into rules: a short link is
    // only offered when it would work.
    const SHORT_KEY_RE = /^[A-Za-z0-9_-]+\.(?:\d{4}[a-z]?)?\.[A-Za-z0-9_-]+$/;
    const SHORT_SLUG_RE = /^[a-z][a-z0-9'-]*(_[a-z0-9'-]+)+$/;
    // An ID as the article has it (typed in another case, or with spaces, the
    // rule still matches), or "" when no article has it.
    function shortKey(value) {
      const art = lookupArticle(String(value).trim());
      const id = art ? String((art.__src || art).id) : "";
      return SHORT_KEY_RE.test(id) ? id : "";
    }

    function shortLinkTail() {
      // URLs describe the last valid filter, not the editor's draft.
      const live = ruleEditor.appliedRows().filter(r => conditionToString(r) !== "");
      if (live.length !== 1) return "";
      const row = live[0];
      if (row.disabled) return "";
      if (ruleLanguage.rowIsNegated(row)) return "";
      if ((row.openParens | 0) || (row.closeParens | 0)) return "";
      if (row.operator !== "is") return "";
      if (RELATION_FIELDS.has(row.field)) { const k = shortKey(row.value); return k ? k + "/" + GRAPH_TAIL[row.field] : ""; }
      // Sole KEYWORD / CATEGORY IS -> 3dcp.fyi/keyword/<value> | /category/<abbr>.
      // A value holding a slash has no single-segment form, so no short link.
      if (row.field === FIELDS.KEYWORD || row.field === FIELDS.CATEGORY) {
        const v = String(row.value).trim();
        return /[\/\\"]/.test(v) ? "" : (row.field === FIELDS.KEYWORD ? "keyword/" : "category/") + v;
      }
      if (row.field === FIELDS.ID) return shortKey(row.value);
      if (row.field !== FIELDS.AUTHOR) return "";
      const slug = String(row.value).trim();
      return SHORT_SLUG_RE.test(slug) ? slug : "";
    }

    var crumbListeners = [], crumbSeparator = null, crumbTail = null;
    scope.add(function () {
      if (crumbSeparator) crumbSeparator.remove();
      if (crumbTail) crumbTail.remove();
      crumbSeparator = crumbTail = null;
      crumbListeners = [];
    });
    function syncCrumb() {
      const nav = document.querySelector(".oa-crumb");
      if (!nav) return;
      const tail = shortLinkTail();
      let sep = nav.querySelector("[data-crumb-sep]");
      let el = nav.querySelector("[data-crumb-tail]");
      if (!tail) {
        crumbListeners.forEach(function (dispose) { dispose(); });
        crumbListeners = [];
        if (sep) sep.remove();
        if (el) el.remove();
        crumbSeparator = crumbTail = null;
        return;
      }
      if (!sep) {
        sep = document.createElement("span");
        sep.className = "oa-sep";
        sep.setAttribute("aria-hidden", "true");
        sep.setAttribute("data-crumb-sep", "");
        sep.textContent = "/";
        nav.appendChild(sep);
        crumbSeparator = sep;
      }
      if (!el) {
        el = document.createElement("span");
        el.className = "oa-muted oa-slug-copy";
        el.setAttribute("data-crumb-tail", "");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        // Bound once, reading the tail at click time: the element survives
        // rule edits (only its text changes), so re-binding per change would
        // stack duplicate listeners.
        const copy = function () {
          const link = shortLinkUrl(el.textContent || "");
          window.OABrowserActions.copyText(link).then(scope.guard(function (ok) {
            window.OATheme.copyToast(ok ? "Link copied" : "Copy failed", ok);
          }));
        };
        crumbListeners.push(scope.listen(el, "click", copy));
        crumbListeners.push(scope.listen(el, "keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); }
        }));
        nav.appendChild(el);
        crumbTail = el;
      }
      if (el.textContent !== tail) {
        el.textContent = tail;
        const link = shortLinkUrl(tail);
        el.setAttribute("title", "Click to copy " + link);
        el.setAttribute("aria-label", "Copy link: " + link);
      }
    }

    /* The tab names what the table shows, so tabs and bookmarks of this one page
       can be told apart: one author ("Bos, Freek"), one article (its title), one
       keyword or category, a search ("“shotcrete”"), the favorites. Anything
       else - two rules, a rule and a search, another field - keeps the page's
       own title. */
    function viewName() {
      const live = ruleEditor.appliedRows().filter(r => conditionToString(r) !== "" && !r.disabled);
      const query = searchController.query;
      if (!live.length) return query ? "“" + query + "”" : "";
      if (live.length !== 1 || query) return "";
      const row = live[0];
      if (ruleLanguage.rowIsNegated(row) || (row.openParens | 0) || (row.closeParens | 0)) return "";
      if (row.field === FIELDS.IS_FAVORITE) return String(row.value).toLowerCase() !== "false" ? "Favorites" : "";
      if (row.operator !== "is") return "";
      const v = String(row.value).trim();
      if (row.field === FIELDS.AUTHOR) return authorSlugToLabel.get(v) || "";
      if (row.field === FIELDS.KEYWORD) return typesetText(v);
      if (row.field === FIELDS.CATEGORY) {
        const d = (window.CATEGORY_DEFS || {})[v.toUpperCase()];
        return d && d.title ? typesetText(d.title) : v;
      }
      if (row.field === FIELDS.ID) {
        const art = lookupArticle(v);
        return art ? typesetText(String((art.__src || art).title || v)) : "";
      }
      return "";
    }
    function syncTitle() {
      const name = viewName();
      const next = name ? name + " • 3dcp.fyi" : PAGE_TITLE;
      if (document.title !== next) document.title = next;
    }
    scope.add(function () { document.title = PAGE_TITLE; });

    function updateUrlBar() {
      syncCrumb();
      if (!urlSyncReady) {
        return;
      }
      syncTitle();
      // The guided tour's clicks (browser-tour.js) are not the reader's
      // navigation: they rewrite the entry they started on, so Back after the
      // tour does not walk through its demo article.
      if (window.OATour && window.OATour.isOpen()) urlSyncPush = false;
      // Debounce: a burst of changes (typing in a value input,
      // dragging the row-up button repeatedly) collapses to one
      // history.replaceState. 150 ms is below the threshold where
      // the user notices the URL bar lagging.
      if (urlSyncTimer !== null) {
        scope.clearTimeout(urlSyncTimer);
      }
      urlSyncTimer = scope.timeout(function () {
        urlSyncTimer = null;
        const next = buildShareableUrl();
        const push = urlSyncPush;
        urlSyncPush = false;
        if (next === window.location.href) {
          return;
        }
        // Sandboxed/embedded contexts (e.g. preview iframes) can throw a
        // SecurityError on replaceState; the filter still works, the URL
        // just can't be rewritten there.
        try {
          if (push) window.history.pushState(null, "", next);
          else window.history.replaceState(null, "", next);
        } catch (err) {
          console.warn("[articles-grid] URL sync skipped (sandboxed):", err.message);
        }
      }, 150);
    }

    // Keyboard: roving tabindex, arrow keys, group headers (grid-keys.js).
    window.OAGridKeys.attach({ grid, dataView, absRows, scope });

    /* Row-quantised wheel scrolling ------------------------------------------
     * A notch of a real mouse wheel moves exactly ONE entry - a row and its
     * open abstract/TOC card count as one block - so the table never comes to
     * rest showing half a row, nor a card without its row.
     * PageUp / PageDown / Home / End land on the same stops (see
     * activePageKeyScroll below). Deliberately limited to DISCRETE wheels:
     * trackpads and momentum scrolling send many small/fractional deltas, and
     * quantising those fights the user's finger, so they keep native pixel
     * scrolling. If the next stop is further than a viewport away (a very tall
     * open card), we page by ~90% of the viewport instead of leaping over
     * unread text. */
    (function attachRowSnapWheel() {
      var vp = grid.getViewportNode ? grid.getViewportNode() : null;
      if (!vp) return;
      // A rebuild (instant navigation) may hand back the SAME viewport node, so
      // the wheel listener is bound once per node while the page-key hook below
      // is always re-pointed at the current grid.
      var wheelBound = vp.dataset.snapWheel === "1";
      vp.dataset.snapWheel = "1";

      function isDiscreteWheel(e) {
        if (e.deltaMode !== 0) return true;             // line / page wheels
        return Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY);
      }
      var rowH = options.rowHeight;
      // Nearest stop <= st (floor onto the stop grid).
      function stopIndexAt(stops, st) {
        var lo = 0, hi = stops.length - 1, best = 0;
        while (lo <= hi) {
          var mid = (lo + hi) >> 1;
          if (stops[mid] <= st + 1) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return best;
      }
      // Round a raw offset onto the stop grid TOWARD THE START of travel: floor
      // going down, ceil going up. Rounding both directions down (floor) made
      // PageDown/PageUp asymmetric, so a down-then-up cycle drifted an entry.
      function snapToward(stops, raw, dir) {
        var i = stopIndexAt(stops, raw);
        if (dir < 0 && stops[i] < raw - 1 && i + 1 < stops.length) i += 1;
        return stops[i];
      }
      // One "page", quantised to whole fine rows so paging through a card
      // taller than the viewport still rests on the row grid.
      function pageStep() {
        return Math.max(1, Math.round(vp.clientHeight * 0.9 / rowH)) * rowH;
      }
      // Step `notches` stops from `st`. When the next stop is further than a
      // viewport away (the viewport is inside a card taller than itself) fall
      // back to `farStep` px from a row-aligned base, so travel is always on the
      // row grid and no unread text is skipped.
      function stepTarget(stops, st, dir, notches, farStep) {
        var i = stopIndexAt(stops, st);
        var aligned = Math.abs(stops[i] - st) <= 1;
        // An unaligned rest position spends the first notch landing on a stop.
        var target = dir > 0
          ? stops[Math.min(stops.length - 1, i + notches)]
          : stops[Math.max(0, i - (aligned ? notches : notches - 1))];
        if (Math.abs(target - st) > vp.clientHeight) {
          target = Math.round(st / rowH) * rowH + dir * farStep;
        }
        return target;
      }

      /* Speed governor (token bucket) -----------------------------------
       * A free-spinning wheel keeps firing accelerated notches for seconds
       * after the flick, and honouring every one of them sent the list past
       * hundreds of entries with nothing the user could do but grab the wheel.
       * Entries are therefore drawn from a bucket that refills at RATE per
       * second and holds at most BURST: a normal flick spends the burst and
       * feels immediate, a sustained spin settles at a readable, trackable
       * speed, and travel ends the instant the wheel does - no momentum of our
       * own to chase. Over-budget notches are swallowed (preventDefault), so
       * the native scroller cannot take the leap on our behalf. */
      var WHEEL_RATE = 26, WHEEL_BURST = 7;
      var wheelTokens = WHEEL_BURST, wheelLastT = 0, wheelLastDir = 0;
      function takeNotches(want, dir, now) {
        if (wheelLastT) wheelTokens = Math.min(WHEEL_BURST, wheelTokens + (now - wheelLastT) / 1000 * WHEEL_RATE);
        wheelLastT = now;
        // Braking / reversing must answer at once, whatever the spin spent.
        if (dir !== wheelLastDir) { wheelTokens = Math.max(wheelTokens, 2); wheelLastDir = dir; }
        var allowed = Math.min(want, Math.floor(wheelTokens));
        if (allowed < 1) return 0;
        wheelTokens -= allowed;
        return allowed;
      }

      // A nested scroll container under the pointer (an abstract card past the
      // row cap scrolls internally, overflow:auto) owns the wheel while it can
      // still move in that direction; the table snaps only when nothing nested
      // can consume the event.
      function nestedScrollConsumes(e, dir) {
        var node = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
        while (node && node !== vp) {
          if (node.scrollHeight > node.clientHeight + 1) {
            var oy = getComputedStyle(node).overflowY;
            if ((oy === "auto" || oy === "scroll") &&
                (dir > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0)) return true;
          }
          node = node.parentElement;
        }
        return false;
      }

      /* Whole author lines -----------------------------------------------
       * The article an ID IS filter names lists all its authors, a column that
       * can run past the viewport. While the viewport's top is in that list it
       * rests on the list's 22px line grid - LINE_INSET below the header, where
       * the sticky cells beside it sit - so no name is cut at the top: a wheel
       * notch moves whole lines, and any other scroll (scrollbar, touchpad,
       * keys) settles onto the nearest line when it stops. */
      var LINE_INSET = 6, LINES_PER_NOTCH = 3;
      function authorLines() {
        var cell = vp.querySelector(".author-cell--all");
        var first = cell && cell.querySelector(".author-row");
        if (!first) return null;
        var vr = vp.getBoundingClientRect(), st = vp.scrollTop;
        var pitch = parseFloat(getComputedStyle(cell).lineHeight) || 22;
        var top = first.getBoundingClientRect().top - vr.top + st - LINE_INSET;
        // The last line may come to the top, no further.
        var end = cell.getBoundingClientRect().bottom - vr.top + st - LINE_INSET - pitch + 1;
        return end > top ? { top: top, end: end, pitch: pitch } : null;
      }
      // The end of the scroll range on the line grid too. While the list still
      // fills the viewport's top at the bottom of the table, that top could
      // only stop part-way into a line: the viewport gets the few px of bottom
      // padding (border-box, so the visible area keeps its height) that let it
      // rest on the next whole line. Cleared once the pin has gone.
      var endPad = 0;
      function fitEndToLine(lines) {
        var pad = 0;
        if (lines) {
          var max = vp.scrollHeight - endPad - vp.clientHeight;
          // Only when the table scrolls at all: a table that fits gets no pad.
          if (max > 0.5 && max > lines.top && max < lines.end) {
            var stop = lines.top + Math.ceil((max - lines.top) / lines.pitch - 0.01) * lines.pitch;
            if (stop - max > 0.01) pad = Math.ceil(stop - max) + 1;
          }
        }
        if (pad === endPad) return;
        endPad = pad;
        vp.style.paddingBottom = pad ? pad + "px" : "";
      }
      // A target past the end of the range: the furthest whole line instead.
      function clampToLine(lines, t) {
        var max = Math.max(0, vp.scrollHeight - vp.clientHeight);
        if (t <= max) return t;
        var k = Math.floor((max - lines.top) / lines.pitch + 0.01);
        return k > 0 ? lines.top + k * lines.pitch : max;
      }
      // Onto the line grid: ahead in the travel direction, nearest at rest.
      // Above the first line is the row's own top.
      function snapLine(lines, raw, dir) {
        var k = (raw - lines.top) / lines.pitch;
        k = dir > 0 ? Math.ceil(k - 0.01) : dir < 0 ? Math.floor(k + 0.01) : Math.round(k);
        return k <= 0 ? (dir > 0 && raw > 0 ? Math.max(0, lines.top) : 0) : lines.top + k * lines.pitch;
      }
      var lineSettle = 0;
      // SlickGrid's own wheel handler moves the viewport before ours runs: the
      // line step starts from where the viewport stood when the notch came in,
      // read in the capture phase (it runs first on the same node).
      var wheelFrom = 0, wheelFromEvent = null;
      if (!wheelBound) scope.listen(vp, "wheel", function (e) { wheelFromEvent = e; wheelFrom = vp.scrollTop; }, { capture: true, passive: true });
      // Only a scroll the reader made settles: the app's own (row anchoring
      // after a re-measure, an abstract scrolled into view) is never nudged a
      // line after the fact, and a scrollbar drag settles once let go.
      var userScrollAt = -1e9, pointerDown = false;
      function settleOnLine() {
        lineSettle = 0;
        var lines = authorLines();
        fitEndToLine(lines);
        if (pointerDown || performance.now() - userScrollAt > 1500) return;
        var st = vp.scrollTop;
        if (!lines || st <= 0 || st >= lines.end) return;
        var target = Math.max(0, clampToLine(lines, snapLine(lines, st, 0)));
        if (Math.abs(target - st) >= 1) vp.scrollTop = target;
      }
      if (!wheelBound) {
        var markUser = function () { userScrollAt = performance.now(); };
        scope.listen(vp, "touchstart", markUser, { capture: true, passive: true });
        scope.listen(document, "keydown", markUser, { capture: true, passive: true });
        scope.listen(vp, "wheel", markUser, { capture: true, passive: true });
        scope.listen(vp, "pointerdown", function () { pointerDown = true; markUser(); }, { passive: true });
        scope.listen(window, "pointerup", function () {
          if (!pointerDown) return;
          pointerDown = false;
          markUser();
          if (lineSettle) clearTimeout(lineSettle);
          lineSettle = setTimeout(scope.guard(settleOnLine), 120);
        }, { passive: true });
        scope.listen(vp, "scroll", function () {
          if (lineSettle) clearTimeout(lineSettle);
          lineSettle = setTimeout(scope.guard(settleOnLine), 160);
        }, { passive: true });
        if ("onscrollend" in vp) scope.listen(vp, "scrollend", function () {
          if (lineSettle) clearTimeout(lineSettle);
          settleOnLine();
        });
      }

      if (!wheelBound) scope.listen(vp, "wheel", function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;             // zoom / h-scroll
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (!isDiscreteWheel(e)) return;
        // Inside the pinned article's full author list: whole lines per notch.
        var lines = authorLines();
        fitEndToLine(lines);
        var from = wheelFromEvent === e ? wheelFrom : vp.scrollTop;
        if (lines && from < lines.end) {
          var ldir = e.deltaY > 0 ? 1 : -1;
          if (nestedScrollConsumes(e, ldir)) return;
          var ln = e.deltaMode !== 0
            ? Math.max(1, Math.min(8, Math.round(Math.abs(e.deltaY) / 3)))
            : Math.max(1, Math.min(8, Math.round(Math.abs(e.deltaY) / 100)));
          ln = takeNotches(ln, ldir, e.timeStamp || Date.now());
          // Held (over the notch budget): SlickGrid's own handler may already
          // have moved the viewport off the line grid - put it back.
          if (!ln) { e.preventDefault(); if (Math.abs(vp.scrollTop - from) >= 0.5) vp.scrollTop = from; return; }
          // From the line at rest (or nearest), exactly N lines on; above the
          // first line is the row's own top. Past the list's last line the
          // abstract below scrolls as before.
          var k0 = Math.round((from - lines.top) / lines.pitch);
          var raw = lines.top + (k0 + ldir * ln * LINES_PER_NOTCH) * lines.pitch;
          var lt = raw < lines.top + 1 ? (ldir > 0 ? Math.max(0, lines.top) : 0) : raw;
          lt = Math.max(0, clampToLine(lines, lt));
          if (Math.abs(lt - vp.scrollTop) < 1) return;
          e.preventDefault();
          vp.scrollTop = lt;
          return;
        }
        var stops = absRows.rowStops();
        if (!stops || stops.length < 2) return;

        var st = vp.scrollTop, dir = e.deltaY > 0 ? 1 : -1;
        if (nestedScrollConsumes(e, dir)) return;
        // Wheel ACCELERATION sends fewer, bigger deltas when the user spins
        // fast (300-500px on Windows). Clamping to 3 notches made fast spins
        // travel a fraction of the finger's speed - felt as "scrolling lags".
        // Honour the delta up to 8 entries; the viewport-distance check in
        // stepTarget still bounds any single leap.
        var notches = e.deltaMode !== 0
          ? Math.max(1, Math.min(8, Math.round(Math.abs(e.deltaY) / 3)))
          : Math.max(1, Math.min(8, Math.round(Math.abs(e.deltaY) / 100)));
        notches = takeNotches(notches, dir, e.timeStamp || Date.now());
        if (!notches) { e.preventDefault(); if (Math.abs(vp.scrollTop - from) >= 0.5) vp.scrollTop = from; return; }   // over budget: hold
        var maxSt = Math.max(0, vp.scrollHeight - vp.clientHeight);
        // Inside a card taller than the viewport a notch still moves just ONE
        // entry height - a wheel notch always means "one entry", never a page.
        var target = stepTarget(stops, st, dir, notches, notches * DATA_ROW_SPAN * rowH);
        target = Math.max(0, Math.min(target, maxSt));
        if (Math.abs(target - st) < 1) return;                        // already at the end
        e.preventDefault();
        vp.scrollTop = target;
      }, { passive: false });

      // Keyboard scrolling on the same stops. Arrows move one entry; PageUp /
      // PageDown move ~90% of the viewport and then round back to the entry
      // boundary they came from, so the row at the top of the viewport is always
      // a whole one and paging is reversible. Returns true when the key was
      // consumed.
      activePageKeyScroll = function (key) {
        if (!vp.clientHeight) return false;
        var stops = absRows.rowStops();
        if (!stops || !stops.length) return false;
        var maxSt = Math.max(0, vp.scrollHeight - vp.clientHeight);
        var st = vp.scrollTop, target;
        // The pinned article's author list: arrows move one line, pages whole
        // lines, while the viewport's top is in the list (and back into it from
        // below) - the entry stops treated its tall row as one card and an
        // arrow could jump back to its top.
        var lines = /^(Arrow|Page)(Up|Down)$/.test(key) ? authorLines() : null;
        if (lines) {
          fitEndToLine(lines);
          maxSt = Math.max(0, vp.scrollHeight - vp.clientHeight);
          var kdir = /Down$/.test(key) ? 1 : -1;
          var nLines = key.indexOf("Page") === 0 ? Math.max(1, Math.floor(pageStep() / lines.pitch)) : 1;
          // From the nearest line (as the wheel), exactly N lines on: stepping
          // pixels from the row's top (just off the grid) skipped a line.
          var k0 = Math.round((st - lines.top) / lines.pitch);
          var t = lines.top + (k0 + kdir * nLines) * lines.pitch;
          if (t < lines.top + 1) t = kdir > 0 ? Math.max(0, lines.top) : 0;
          t = Math.max(0, clampToLine(lines, t));
          if (Math.abs(t - st) >= 1) vp.scrollTop = t;
          return true;
        }
        if (key === "Home") target = 0;
        else if (key === "End") target = maxSt;
        else if (key === "ArrowDown" || key === "ArrowUp") {
          // Inside an over-tall card an arrow crawls one row height (not a whole
          // page - that would be a jarring jump for an arrow key).
          target = stepTarget(stops, st, key === "ArrowDown" ? 1 : -1, 1, DATA_ROW_SPAN * rowH);
        } else {
          var dir = key === "PageDown" ? 1 : -1;
          var page = pageStep();
          target = snapToward(stops, st + dir * page, dir);
          // No progress means the next stop is more than a page away - i.e. the
          // viewport is inside a card taller than itself. Page through it in
          // whole rows (same as the wheel) instead of jumping to the far side.
          // A stop much more than a page away is the same case seen from below
          // (the pinned article's row and its abstract, one tall entry).
          if ((dir > 0 && target <= st + 1) || (dir < 0 && target >= st - 1) || Math.abs(target - st) > page + rowH) {
            target = Math.round(st / rowH) * rowH + dir * page;
          }
        }
        target = Math.max(0, Math.min(target, maxSt));
        if (Math.abs(target - st) < 1) return true;   // consumed: already at the edge
        vp.scrollTop = target;
        return true;
      };
    })();

    // ONE handler for the whole refresh. DataView.refresh() fires
    // onRowCountChanged and then onRowsChanged for the same pass, so subscribing
    // to both made every filter / search / sort / group change rebuild the
    // abstract overlay twice, invalidate the entire row DOM twice, and render
    // twice - which also doubled the onRendered work (keyword clamp pass +
    // favorites header sync). onRowsOrCountChanged is the DataView's own
    // single-notification event for exactly this, fired once per refresh.
    //
    // The full invalidate (rather than invalidateRows(args.rowsDiff)) is
    // deliberate: the abstract overlay splices display-only detail rows in, so
    // a DataView row index is not a grid row index and a targeted invalidate
    // would clear the wrong rows.
    var refreshRepainted = false;
    // Set by compileAndApplyRuleFilter: a rule change replaces the list, so the
    // viewport goes back to the top (search already does this) instead of
    // keeping a scrollTop that now points at the bottom of a much shorter list.
    var resetScrollOnRefresh = false;
    scope.subscribe(dataView.onRowsOrCountChanged, function (e, args) {
      refreshRepainted = true;
      if (resetScrollOnRefresh) {
        resetScrollOnRefresh = false;
        var svp = grid.getViewportNode ? grid.getViewportNode() : null;
        if (svp && svp.scrollTop) svp.scrollTop = 0;
      }
      // Category grouping: any refresh (a filter change, a collapse-all) can
      // surface a nested echo group in collapsed state - re-open it before
      // painting. No-op in every other mode, and on the nested refresh an
      // expansion itself triggers (hoisted declaration; defined below).
      expandHiddenEchoGroups();
      invalidateVisibleCache();
      absRows.rebuild();
      // One refresh contract: invalidate() = updateRowCount + invalidateAllRows
      // + render (see slick.grid.js), so nothing is repeated around it.
      grid.invalidate();
    });


    scope.subscribe(grid.onSort, function (event, args) {
      // A third click on a header goes back to the list's own order, newest
      // first: ascending, descending, then that. Phones hide the Date column,
      // so after a tap on Article or Authors this is the way back. Date itself
      // just toggles: its descending order is that order.
      const prev = sortBefore;
      if (prev && args.sortCol.id !== "date" && prev.columnId === args.sortCol.id && !prev.sortAsc && args.sortAsc) {
        applySortFromUrl("date-desc");
        searchController.rememberSort("date", false);
        searchController.sortChanged();
        updateUrlBar();
        return;
      }
      dataView.sort(compareByField(args.sortCol.field, args.sortAsc), args.sortAsc);
      // Keep the reader's header sort when they later clear this search.
      searchController.rememberSort(args.sortCol.id, args.sortAsc);
      searchController.sortChanged();   // offers "Sort by relevance" while searching
      updateUrlBar();
    });

    function applySortFromUrl(sortBy) {
      const preset = window.OAGridSort.parseSortBy(sortBy);
      // An unknown value (a typo, an old link) falls back to the default
      // order instead of leaving the list unsorted.
      const isDefault = String(sortBy || "").trim().toLowerCase() === "date-desc";
      if (!preset) {
        console.warn("[articles-grid] unknown sort_by value: " + sortBy);
        if (!isDefault) applySortFromUrl("date-desc");
        return;
      }

      const column = columns.find(function (c) {
        return c.id === preset.columnId;
      });
      if (!column) {
        if (!isDefault) applySortFromUrl("date-desc");
        return;
      }

      grid.setSortColumn(preset.columnId, preset.ascending);
      dataView.sort(compareByField(column.field, preset.ascending), preset.ascending);
    }

    function inferSortByFromGrid() {
      const sortCols = grid.getSortColumns();
      if (!sortCols || sortCols.length === 0) {
        return null;
      }
      const sortCol = sortCols[0];
      return window.OAGridSort.canonicalSortBy(sortCol.columnId, sortCol.sortAsc);
    }

    // Active grouping is tracked so we can surface it in the URL and
    // restore it on page load. Names match what URL param "group_by"
    // accepts; the special value "" means no grouping.
    let activeGrouping = "";

    // The Group-by select names the active grouping in words ("None" when
    // ungrouped); the Expand / Collapse all toggle beside it exists only while
    // a grouping is on. Every path (select, ?group_by= restore) funnels here.
    function updateGroupingControls() {
      const grouped = !!activeGrouping;
      const sel = document.getElementById("groupBySelect");
      if (sel) {
        sel.value = activeGrouping;
        const box = sel.closest(".tb-select");
        if (box) box.classList.toggle("is-active", grouped);
      }
      // Laid out like Filters: the leading glyph, then the clear x attached on
      // the right; both always in place, so the control never changes size.
      // With no grouping the glyph is the sum sign (inert, the label) and the
      // x is inert too; with one, the glyph becomes + / - (expand / collapse
      // all - every grouping renders collapsed, so it starts on +) and the x
      // removes the grouping.
      const clearBtn = document.getElementById("groupClear");
      if (clearBtn) clearBtn.disabled = !grouped;
      const toggleBtn = document.getElementById("groupToggle");
      if (toggleBtn) {
        toggleBtn.disabled = !grouped;
        if (grouped) setGroupToggleLabel(toggleBtn, true);
        else {
          toggleBtn.dataset.collapsed = "true";
          toggleBtn.setAttribute("aria-label", "Group by");
          toggleBtn.title = "Group by";
          toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 16v2a1 1 0 0 1 -1 1h-11l6 -7l-6 -7h11a1 1 0 0 1 1 1v2"></path></svg>';
        }
      }
    }
    // The toggle is the Group-by control's leading glyph while grouped, drawn
    // as what it does next: + expands every group, - collapses them; the words go to its
    // accessible name and tooltip.
    const GROUP_FOLD_PATHS = {
      expand: '<path d="M12 5l0 14"></path><path d="M5 12l14 0"></path>',
      collapse: '<path d="M5 12l14 0"></path>'
    };
    function setGroupToggleLabel(btn, collapsed) {
      btn.dataset.collapsed = collapsed ? "true" : "false";
      const label = collapsed ? "Expand all groups" : "Collapse all groups";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        GROUP_FOLD_PATHS[collapsed ? "expand" : "collapse"] + "</svg>";
    }

    // One counter treatment for every grouping: the count trails the label as a
    // muted micro chip (never a parenthetical), so date / venue / access and
    // category group headers all read the same. "entries", not "articles": under
    // category grouping an article assigned to several branches is counted once
    // per assignment, so a chapter's total exceeds its article count.
    function groupCountHtml(group) {
      return '<span class="oa-catgrp-n">' + countFormat.format(group.count) +
        (group.count === 1 ? " entry" : " entries") + "</span>";
    }

    function groupLabelHtml(label, group) {
      return '<span class="oa-catgrp"><span class="oa-catgrp-t">' + label + "</span>" +
        groupCountHtml(group) + "</span>";
    }

    // Date grouping nests year > month (labels: 2026, then 2026-08), newest
    // first - oldest first while the Date column sorts ascending, so the groups
    // follow the rows inside them - and a collapse-all leaves one row per year.
    function dateYear(item) {
      var d = String((item && item.date) || "");
      return d ? d.slice(0, 4) : "n/a";
    }
    function dateMonth(item) {
      var d = String((item && item.date) || "");
      return d ? d.slice(0, 7) : "n/a";
    }
    function dateLabel(value) {
      var v = String(value == null ? "" : value);
      if (!v || v === "n/a") return "Undated";
      return v.length > 4 ? v.slice(0, 4) + "-" + v.slice(5, 7) : v;
    }
    function dateGroupComparer(a, b) {
      var ka = String(a.value), kb = String(b.value);
      // Undated sinks to the bottom: the "n/a" placeholder compares above
      // every digit in UTF-16, so without this it topped the descending list.
      var ua = !ka || ka === "n/a", ub = !kb || kb === "n/a";
      if (ua || ub) return ua === ub ? 0 : (ua ? 1 : -1);
      const cols = grid.getSortColumns();
      const asc = !!(cols && cols.length && cols[0].columnId === "date" && cols[0].sortAsc);
      return ka === kb ? 0 : ((ka > kb) === asc ? 1 : -1);
    }

    // Shared tail for the three flat groupings, and for clearing (name "", no
    // grouping). beginUpdate/endUpdate matters when SWITCHING from category
    // grouping: setItems (back to flat) and setGrouping each run a full
    // re-filter + regroup over ~25k rows on their own - and the first pass
    // would regroup flat articles by the stale _cat1/_cat2/_cat3 fields. The
    // count/resize tail is what category grouping also does: leaving category
    // mode changes the row set, so the result count and grid height are stale
    // without it.
    function applyFlatGrouping(name, groupingInfo) {
      activeGrouping = name;
      dataView.beginUpdate();
      useFlatItems();
      dataView.setGrouping(groupingInfo);
      dataView.endUpdate();
      updateUrlBar();
      updateGroupingControls();
      updateResultCount();
      layout.requestResize();
    }

    function groupByDate() {
      // Years open, months folded: the grouping lands on the YYYY-MM level.
      // Venue and access start collapsed - one level, the headers alone answer
      // "which venues, how many". The toolbar toggle opens everything in a click.
      applyFlatGrouping("date", [
        {
          getter: dateYear,
          formatter: group => groupLabelHtml(escapeHtml(dateLabel(group.value)), group),
          comparer: dateGroupComparer,
          collapsed: false,
          aggregateCollapsed: false,
          lazyTotalsCalculation: true
        },
        {
          getter: dateMonth,
          formatter: group => groupLabelHtml(escapeHtml(dateLabel(group.value)), group),
          comparer: dateGroupComparer,
          collapsed: true,
          aggregateCollapsed: false,
          lazyTotalsCalculation: true
        }
      ]);
    }

    // Biggest venues first: alphabetical order put "15. Fachtagung" and
    // one-paper proceedings ahead of the journals most entries come from.
    // Equal counts: the venue with the newest entry first. No venue sinks.
    function venueNewest(group) {
      if (group._newest == null) {
        var max = "";
        for (var i = 0; i < group.rows.length; i++) {
          var d = String((group.rows[i] && group.rows[i].date) || "");
          if (d > max) max = d;
        }
        group._newest = max;
      }
      return group._newest;
    }
    function venueGroupComparer(a, b) {
      var ea = a.value == null || a.value === "", eb = b.value == null || b.value === "";
      if (ea !== eb) return ea ? 1 : -1;
      if (a.count !== b.count) return b.count - a.count;
      var na = venueNewest(a), nb = venueNewest(b);
      return na === nb ? 0 : (na < nb ? 1 : -1);
    }
    function groupByVenue() {
      applyFlatGrouping("venue", {
        getter: "venue",
        comparer: venueGroupComparer,
        formatter: group => groupLabelHtml((window.OATheme.ordinalHtml || function (s) { return s; })(escapeHtml(group.value)), group),
        collapsed: true,
        aggregateCollapsed: false,
        lazyTotalsCalculation: true
      });
    }

    function groupByAccess() {
      applyFlatGrouping("access", {
        getter: item => item.openAccess ? "Open Access" : "Closed Access",
        formatter: group => groupLabelHtml(escapeHtml(String(group.value)), group),
        collapsed: true,
        aggregateCollapsed: false,
        lazyTotalsCalculation: true
      });
    }

    /* Category grouping: three nested levels straight from the taxonomy
     * (chapter > category > subcategory). It is the one grouping that needs a
     * different row set - one row per (article, category) assignment - so the
     * DataView's items and id property are swapped in and out with it. */
    function useCategoryItems() {
      if (dataView.getIdPropertyName && dataView.getIdPropertyName() === "_rowKey") return;
      dataView.setItems(categoryRows(), "_rowKey");
      dataView.reSort();
    }

    function useFlatItems() {
      categoryGroupingOn = false;
      if (!dataView.getIdPropertyName || dataView.getIdPropertyName() === "id") return;
      dataView.setItems(articles, "id");
      dataView.reSort();
    }

    // Groups sort in taxonomy order (the JSON's `num`), not alphabetically by
    // abbreviation - which also puts a padded (echo) group's XX.YY.00 ahead of
    // the real XX.YY.01 subcategories. An unknown abbreviation sorts last.
    function catGroupSortKey(group) {
      var def = (window.CATEGORY_DEFS || {})[group.value];
      if (!def) return "\uffff" + String(group.value);
      return def.num || String(group.value);
    }
    function catGroupComparer(a, b) {
      var ka = catGroupSortKey(a), kb = catGroupSortKey(b);
      return ka === kb ? 0 : (ka > kb ? 1 : -1);
    }

    function catGroupFormatter(group) {
      var n = groupCountHtml(group);
      var def = (window.CATEGORY_DEFS || {})[group.value];
      if (!def) return groupLabelHtml('<span class="oa-catgrp-none">Unknown category</span>', group);
      // Echo group: the parent's own direct entries. Keeps the chip's outline
      // as a placeholder - transparent dot, five blank characters - so the fold
      // lines up with the real chips above it, and shows only the counter.
      if (isEchoCategoryGroup(group)) {
        return '<span class="oa-catgrp"><span class="oa-catgrp-chip" style="--cat-c:transparent">' +
          "\u00a0\u00a0\u00a0\u00a0\u00a0</span>" + groupCountHtml(group) + "</span>";
      }
      // The chip carries the colour dot + abbreviation, exactly as the Category
      // column does; the taxonomy number rides in the tooltip.
      return '<span class="oa-catgrp" title="' + escapeHtml(def.num || "") + " \u00b7 " + escapeHtml(typesetText(def.title || "")) + '">' +
        '<span class="oa-catgrp-chip" style="' + escapeHtml(window.OATheme.catVars(def.color)) + '">' +
        escapeHtml(String(group.value)) + "</span>" +
        '<span class="oa-catgrp-t">' + escapeHtml(def.title ? typesetText(def.title) : group.value) + "</span>" +
        n + "</span>";
    }

    function groupByCategory() {
      activeGrouping = "category";
      categoryGroupingOn = true;
      // One refresh for both halves of the switch: setItems and setGrouping each
      // trigger a full re-filter + regroup over ~25k rows on their own.
      dataView.beginUpdate();
      useCategoryItems();
      // Chapters open, categories and subcategories folded: the grouping lands
      // on the second level, where the taxonomy first becomes readable.
      dataView.setGrouping(["_cat1", "_cat2", "_cat3"].map(function (field, level) {
        return {
          getter: field,
          formatter: catGroupFormatter,
          comparer: catGroupComparer,
          collapsed: level > 0,
          aggregateCollapsed: false,
          lazyTotalsCalculation: true
        };
      }));
      dataView.endUpdate();
      // The padded groups whose header is not rendered must stay open, or their
      // rows would sit behind a header nobody can click.
      expandHiddenEchoGroups();
      updateUrlBar();
      updateGroupingControls();
      updateResultCount();
      layout.requestResize();
    }

    function clearGrouping() { applyFlatGrouping("", []); }

    function applyGroupingFromUrl(value) {
      const key = String(value || "").toLowerCase().trim();
      if (key === "date")     { groupByDate();   return; }
      if (key === "venue")    { groupByVenue();  return; }
      if (key === "access" ||
          key === "openaccess" ||
          key === "oa")       { groupByAccess(); return; }
      if (key === "category" ||
          key === "categories" ||
          key === "cat")      { groupByCategory(); return; }
      if (key === "" || key === "none") {
        clearGrouping();
        return;
      }
      console.warn("[articles-grid] unknown group_by value: " + value);
    }

    scope.listen(document.getElementById("exportResults"), "click", exportMatches);

    scope.listen(document.getElementById("openAll"), "click", openAllMatches);

    var collapseAbsBtn = document.getElementById("collapseAbstracts");
    if (collapseAbsBtn) {
      scope.listen(collapseAbsBtn, "click", function () {
        clearAbstracts();
        keepKeyboardFocus(collapseAbsBtn, document.getElementById("semanticSearch"));
      });
    }

    // Search session/UI orchestration is owned by OAGridSearch above.

    // The Settings panel and the semantic model button beside the search
    // field (grid-settings.js): host UI for OASemanticSearch, OATTS and the
    // appearance prefs.
    window.OAGridSettings.attach({ scope: scope, grid: grid, absRows: absRows, searchController: searchController,
      escapeHtml: escapeHtml, citeStyle: citeStyle, citeStyleKey: CITE_STYLE_KEY });

    /* Where "Open all" sends each article - the publisher via DOI, or an
       external service - is picked from the menu half of the Open all split
       button (the Favorites pattern), not from Settings: the choice sits on
       the action it changes. One radio list, grouped like the records strip
       (publisher, then the catalogue's groups) so the two can't drift. The
       list is rebuilt on every open: the catalogue may load late. */
    (function wireOpenRoute() {
      var menuBtn = document.getElementById("openMenuBtn");
      var menu = document.getElementById("openMenu");
      var split = menuBtn ? menuBtn.parentElement : null;
      if (!menuBtn || !menu || !split) return;
      var release = null;
      function build() {
        var cur = openRoute();
        var seen = {};
        var groups = [Object.keys(SITE_ROUTES).map(function (k) { seen[k] = true; return { key: k, name: SITE_ROUTES[k].label }; })];
        // The registry's first group repeats the publisher route: one row per key.
        extRegistry().forEach(function (g) {
          var items = g.items.filter(function (it) { if (seen[it.key]) return false; seen[it.key] = true; return true; });
          if (items.length) groups.push(items);
        });
        var html = '<div class="open-menu-head" role="presentation">Open all via</div>';
        groups.forEach(function (items, i) {
          if (i) html += '<div class="open-menu-sep" role="separator"></div>';
          html += items.map(function (it) {
            return '<button type="button" role="menuitemradio" class="fav-menu-item open-menu-item" data-route="' + escapeHtml(it.key) + '" aria-checked="' + (it.key === cur ? "true" : "false") + '"><span>' + escapeHtml(it.name) + "</span></button>";
          }).join("");
        });
        menu.innerHTML = html;
      }
      function setOpen(open, focusFirst) {
        var hadFocus = menu.contains(document.activeElement);
        if (open) build();
        menu.hidden = !open;
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) release = window.OATheme.popover("open-route", function () { setOpen(false); });
        else if (release) { release(); release = null; }
        if (open && focusFirst) {
          var first = menu.querySelector('[aria-checked="true"]') || menu.querySelector("button");
          if (first) first.focus({ preventScroll: true });
        } else if (!open && hadFocus) {
          menuBtn.focus({ preventScroll: true });
        }
      }
      // Keyboard / AT activation (detail 0) moves focus into the menu.
      scope.listen(menuBtn, "click", function (event) { setOpen(menu.hidden, event.detail === 0); });
      scope.listen(menu, "click", function (event) {
        var item = event.target.closest("button[data-route]");
        if (!item) return;
        window.OAPrefs.set(OPEN_ROUTE_KEY, item.getAttribute("data-route"));
        setOpen(false);
        syncOpenAllButton();   // the button's tooltip names the route
      });
      scope.listen(split, "keydown", function (event) {
        if (menu.hidden) return;
        if (event.key === "Escape") {
          event.stopPropagation();   // not also the grid's Escape (hide abstracts)
          setOpen(false);
          menuBtn.focus({ preventScroll: true });
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          var items = Array.prototype.slice.call(menu.querySelectorAll("button[data-route]"));
          if (!items.length) return;
          event.preventDefault();
          var at = items.indexOf(document.activeElement);
          var next = event.key === "ArrowDown" ? (at + 1) % items.length : (at <= 0 ? items.length - 1 : at - 1);
          items[next].focus({ preventScroll: true });
        }
      });
      scope.listen(document, "pointerdown", function (event) {
        if (!menu.hidden && !split.contains(event.target)) setOpen(false);
      });
      scope.listen(split, "focusout", function (event) {
        if (!menu.hidden && event.relatedTarget && !split.contains(event.relatedTarget)) setOpen(false);
      });
    })();
    /* ============================ /Search box ============================= */

    // The toolbar's x - the rule builder's old "Clear all fields" action, moved
    // next to the filter toggle so it is reachable without opening the panel.
    // It also closes the panel: an empty rule list has nothing to show, and the
    // toggle re-opens it when the reader wants to build a new query.
    // It clears the search too: a list narrowed by a query stayed narrowed
    // after "clear all", with the button promising otherwise.
    const resetFiltersBtn = document.getElementById("resetFilters");
    scope.listen(resetFiltersBtn, "click", function () {
      ruleEditor.clear().then(scope.guard(function (ok) {
        if (!ok) return;
        ruleEditor.setOpen(false);
        const box = document.getElementById("semanticSearch");
        if (searchController.query || (box && box.value)) searchController.clearBox();
        // Clear leaves the row once nothing narrows the list.
        keepKeyboardFocus(resetFiltersBtn, ruleBuilderToggle);
      }));
    });

    // The empty-state "Clear all filters" button does the same thing as
    // the toolbar's Reset button, just exposed at the spot the user is
    // already looking when they hit a 0-result state. Unlike Reset, we
    // open the rule builder so the user can see that the rule list is
    // now empty (and add a fresh rule from there).
    scope.listen(document.getElementById("emptyStateClearAll"), "click", function () {
      // A zero-hit SEARCH reads "Clear search" here: the rules stay, the query goes.
      if (this.dataset.mode === "search") {
        searchController.clearBox();
        return;
      }
      if (ruleTree.rows.length === 0) {
        return;
      }
      // In the favorites-empty state this button reads "Browse all articles":
      // clearing the (favorites) filter is right, but popping an empty rule
      // builder would be noise - so only open it for the generic clear.
      const favMode = this.dataset.mode === "favEmpty";
      ruleTree.rows = [];
      ruleEditor.setOpen(!favMode);
      ruleEditor.change(true);
    });

    // Pop the last condition row. Doing this one row at a time lets the
    // user back out of an over-constrained query without losing the rules
    // they want to keep. If the resulting expression becomes unbalanced
    // (a dropped row was carrying a paren), compileFromRows falls back to
    // "match all", which already hides this overlay.
    scope.listen(document.getElementById("emptyStateRemoveLast"), "click", function () {
      if (this.dataset.mode === "turnOff") ruleEditor.turnOff(this.dataset.rowId);
      else ruleEditor.removeLast();
    });
    scope.listen(document.getElementById("emptyStateAnyWord"), "click", function () { searchController.matchAnyWord(); });
    // "Did you mean": a plain click swaps the suggested ID into its rule (and
    // pins it); a modified click opens the link as links do.
    const suggestHost = document.getElementById("emptyStateSuggest");
    if (suggestHost) scope.listen(suggestHost, "click", function (e) {
      const a = e.target.closest ? e.target.closest("a[data-id]") : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const row = ruleTree.rows.find(function (r) { return String(r.id) === a.dataset.rowId; });
      if (!row) return;
      e.preventDefault();
      row.value = a.dataset.id;
      urlSyncPush = true;
      ruleEditor.change();
    });

    // No separate favorites download: the Export button (.bib) saves whatever
    // the table currently shows, so with the star filter on it IS the
    // favorites export.

    // Group-by select; "None" ungroups.
    const GROUP_APPLY = { date: groupByDate, venue: groupByVenue, access: groupByAccess, category: groupByCategory };
    const groupBySelect = document.getElementById("groupBySelect");
    const groupClearBtn = document.getElementById("groupClear");
    if (groupClearBtn) scope.listen(groupClearBtn, "click", function () {
      if (activeGrouping) clearGrouping();
      keepKeyboardFocus(groupClearBtn, document.getElementById("groupBySelect"));
    });
    if (groupBySelect) scope.listen(groupBySelect, "change", function () {
      const apply = GROUP_APPLY[groupBySelect.value];
      if (apply) apply(); else clearGrouping();
    });

    // One toggle, labelled with what it does next: data-collapsed="true" =>
    // groups are collapsed and it reads "Expand all"; otherwise "Collapse all".
    var groupToggle = document.getElementById("groupToggle");

    function setGroupCollapsed(collapsed) { setGroupToggleLabel(groupToggle, collapsed); }

    // The padded groups whose header is NOT rendered (the nested echoes) must
    // never sit collapsed: their rows would hide behind a header nobody can
    // click. Re-expand exactly those - but only the ones currently collapsed,
    // so the pass is idempotent and safe to run from the refresh handler (an
    // expansion triggers a nested refresh, whose own pass then finds nothing
    // left to expand and stops the recursion). The collapsed check also covers
    // echoes that were hidden by an active FILTER when grouping was applied:
    // they were invisible to the group-time pass, and without this they came
    // back collapsed - rows permanently trapped - once the filter cleared.
    function expandHiddenEchoGroups() {
      if (!categoryGroupingOn || !dataView.getGroups) return;
      var keys = [];
      (function walk(groups) {
        for (var i = 0; i < (groups || []).length; i++) {
          var g = groups[i];
          if (g.groupingKey && g.collapsed && echoDepth(g) > 1) keys.push(g.groupingKey);
          walk(g.groups);
        }
      })(dataView.getGroups());
      if (!keys.length) return;
      dataView.beginUpdate();
      for (var k = 0; k < keys.length; k++) dataView.expandGroup(keys[k]);
      dataView.endUpdate();
    }

    scope.listen(groupToggle, "click", function () {
      var collapsed = groupToggle.dataset.collapsed === "true";
      if (collapsed) {
        dataView.expandAllGroups();
        setGroupCollapsed(false);
      } else {
        dataView.collapseAllGroups();
        expandHiddenEchoGroups();
        setGroupCollapsed(true);
      }
    });

    var ruleBuilderToggle = document.getElementById("ruleBuilderToggle");
    // Picks made in the table (chips, dates, titles, the author footer, the
    // right-margin panel) no longer pop the rule builder open: on a short
    // screen three rules left one row of table. The funnel's count badge and
    // the accented result count say a filter is on; an explicit true opens it.
    // Filter actions (table cells, chips, popovers) open the builder so the new
    // rule is visible; only an explicit false (the favorites star) keeps it shut.
    // These are the reader's navigational clicks: each pushes a history entry
    // (urlSyncPush) - except the favorites toggle, which is a view switch.
    function applyDateCellFilter(ym, mode) { urlSyncPush = true; return ruleEditor.applyDate(ym, mode, true); }
    function toggleFieldRule(field, operator, value, openBuilder) {
      if (field !== "isFavorite") urlSyncPush = true;
      return ruleEditor.toggleField(field, operator, value, openBuilder !== false);
    }
    function applyFacetRule(rule) { urlSyncPush = true; return ruleEditor.applyFacet(rule); }
    // The same for the picks that reach the rules another way: the right button
    // (one more topic ORed in, an author or an article with its metrics), a name
    // in the author panel (its picks replace the rules) and a span dragged
    // across a panel's plot. Called just before the change.
    function markNavigation() { urlSyncPush = true; }

    // visibleRows() reads the UNWRAPPED DataView (dvGetLength/dvGetItem captured
    // before the abstract overlay wrapped getLength/getItem). The overlay splices
    // in head / spacer / detail display-rows - spacer rows carry a synthetic id
    // and would otherwise slip past the filter here. The unwrapped accessors
    // return only real source rows (articles + group/total rows). Memoized; the
    // cache is dropped whenever the DataView's rows change (filter / sort / group).
    let _visibleRows = null;
    function invalidateVisibleCache() { _visibleRows = null; }
    // One { key, id } per DISPLAYED article row, duplicates included: category
    // grouping shows a paper once per category, and a Shift / drag range must
    // run between the rows actually clicked, not the paper's first appearance.
    function visibleRows() {
      if (_visibleRows) return _visibleRows;
      const out = [];
      const n = dvGetLength();
      for (let i = 0; i < n; i++) {
        const item = dvGetItem(i);
        if (item && item.id && !item.__group && !item.__groupTotals && !item.__nonDataRow) {
          out.push({ key: item._rowKey || item.id, id: item.id });
        }
      }
      _visibleRows = out;
      return out;
    }
    // Filter membership is independent of which groups the reader expanded.
    // Selection uses visibleRows() to keep the displayed order.
    function matchingArticles() {
      const seen = new Set();
      return dataView.getFilteredItems().reduce(function (out, item) {
        const source = item && (item.__src || item);
        if (source && source.id && !seen.has(source.id)) {
          seen.add(source.id);
          out.push(source);
        }
        return out;
      }, []);
    }
    // Ids of every matching article, whether or not its group is expanded: the
    // header star's scope. It used to count only rows in expanded groups, so
    // with every group folded it did nothing, while Export / Open all took
    // every match. Memoized on the filtered array (replaced on each refresh).
    let _matchingIds = null, _matchingSrc = null;
    function matchingIds() {
      const src = dataView.getFilteredItems();
      if (!_matchingIds || _matchingSrc !== src) {
        _matchingSrc = src;
        _matchingIds = matchingArticles().map(function (a) { return a.id; });
      }
      return _matchingIds;
    }

    // Download the current matches as a BibTeX library, reusing the favorites
    // exporter (it takes any array of article records). The filename is
    // 3dcp_fyi_YYYY-MM-DD_HH-MM_<url>.bib: the stamp keeps repeated exports
    // apart and sorts them chronologically; <url> is the rule builder's query
    // (the shareable link's q= value) made filename-safe, so the file says
    // which filter produced it. Sort / grouping / free-text search are left
    // out; with no rule the query part is omitted.
    function exportMatches() {
      // The library comes from bibliography.js (exportIds); this guard once
      // asked for a favorites exporter that no longer exists, and the button
      // silently did nothing.
      if (!window.OABibliography || !window.OABibliography.formatBibtexLibrary) return;
      // Snapshot the ids now: a selection change while abstracts load must not
      // change an export already asked for. Resolve them only once abstracts
      // are on the rows, so selected and unselected exports carry the same data.
      const ids = openTargetIds().slice();
      if (!ids.length) return;
      // Nothing filtered means the whole corpus - a 5 700-entry file nobody
      // asked for by accident. Above a few hundred entries, say how many first.
      const EXPORT_CONFIRM_ABOVE = 500;
      const confirmLarge = ids.length > EXPORT_CONFIRM_ABOVE
        ? window.OADialog.confirmDialog({
            title: "Download " + window.OATheme.fmtNum(ids.length) + " articles as BibTeX?",
            message: "That is " + (ids.length === (window.ARTICLES_DATA || []).length ? "the whole database" : "everything matching the current filters") + ". Narrow the filters or select rows first if you want fewer.",
            confirmLabel: "Download"
          })
        : Promise.resolve(true);
      confirmLarge.then(function (ok) { if (ok) exportIds(ids); });
    }
    function exportIds(ids) {
      const safe = window.OATheme.fileSafe(ruleEditor.queryForUrl());
      const fname = "3dcp_fyi_" + window.OATheme.fileTimestamp() + (safe ? "_" + safe : "") + ".bib";
      whenAbstractsReady(function () {
        const rows = resolveForExport(ids);
        if (!rows.length) return;
        window.OABrowserActions.downloadBlob(
          fname,
          window.OABibliography.formatBibtexLibrary(rows),
          "application/x-bibtex;charset=utf-8"
        );
        // Same confirmation pill as every other action - a silent click that
        // only touches the browser's download shelf reads as "nothing happened".
        window.OATheme.copyToast(window.OATheme.fmtNum(rows.length) + (rows.length === 1 ? " article" : " articles") + " saved as .bib", true);
      });
    }

    // The rows the "Open all" pair acts on: the marked rows when a selection
    // exists, otherwise every currently-matching article.
    function openTargetIds() {
      if (rowSel && rowSel.count() > 0) return rowSel.ids();
      return matchingIds();
    }
    function openTargets() { return resolveForExport(openTargetIds()); }

    // One resolver for every bulk path: the live table record per id (the one
    // abstracts are joined onto), in order, each article once. The immutable
    // store snapshot never carries abstracts, so it is only the last resort.
    function resolveForExport(ids) {
      const byId = new Map();
      dataView.getItems().forEach(function (item) {
        if (!item || item.__group || item.__nonDataRow) return;
        const s = item.__src || item;
        if (s && s.id && !byId.has(s.id)) byId.set(s.id, s);
      });
      const seen = new Set(), out = [];
      ids.forEach(function (id) {
        if (!id || seen.has(id)) return;
        seen.add(id);
        let a = byId.get(id) || lookupArticle(id);
        if (!a) { const r = articleStore.resolve([id]); a = r && r[0]; }
        if (a) out.push(a.__src || a);
      });
      return out;
    }

    // Open every target in its own new tab. Only reachable while the target
    // set is below OPEN_ALL_MAX (the buttons hide otherwise); a confirm
    // guards the larger batches so a click can't flood the browser.
    // Browsers typically allow ONE window.open per click and silently swallow
    // the rest until the user allows pop-ups for the site - blocked calls
    // return null, so count them and SAY so instead of looking dead.
    function openTabs(urls, noun) {
      const n = urls.length;
      if (!n || n >= OPEN_ALL_MAX) return;
      const proceed = function () {
        let blocked = 0;
        urls.forEach(function (url) {
          // No "noopener" in the features string: per spec that makes
          // window.open return null even on SUCCESS, which counted every
          // opened tab as blocked ("blocked 25 of 25" while 25 tabs stood
          // open). Detect blockage from the real return value and sever the
          // opener by hand instead.
          const w = window.open(url, "_blank");
          if (w) { try { w.opener = null; } catch (e) { /* cross-origin: already severed */ } }
          else blocked += 1;
        });
        if (blocked > 0) {
          window.OATheme.copyToast("The browser blocked " + blocked + " of " + n +
            " tabs.\nAllow pop-ups for this site, then try again.", false, 4600);
        }
      };
      if (n > 12) {
        window.OADialog.confirmDialog({
          title: "Open " + n + " " + noun + " in " + n + " new tabs?",
          confirmLabel: "Open all"
        }).then(scope.guard(function (ok) { if (ok) proceed(); }));
        return;
      }
      proceed();
    }
    function openAllMatches() {
      const key = openRoute();
      const label = openRouteLabel(key);
      const rows = openTargets();
      const urls = [];
      let skipped = 0;
      rows.forEach(function (a) {
        const u = openRouteUrl(key, a);
        if (u) urls.push(u); else skipped += 1;
      });
      if (!urls.length) {
        window.OATheme.copyToast("No article in this set has a record on " + label, false);
        return;
      }
      if (skipped > 0) {
        window.OATheme.copyToast(skipped + " of " + rows.length + " have no " + label + " record and were skipped", false, 3600);
      }
      openTabs(urls, "articles");
    }

    // Sync the favorites-column header star to reflect whether every visible
    // row is saved. Re-queried live since the header HTML is reset on re-render.
    // Polled on every render pass, so the verdict is memoized against the
    // identity of the visible-id array (replaced whenever the filter / sort /
    // grouping changes) and the favorites revision. Without it, every scroll
    // frame ran a membership scan over every filtered row - ~25k under category
    // grouping - as soon as anything at all was saved.
    let _favAllMemo = null;
    function syncFavAllHeader() {
      const btn = document.querySelector("#myGrid .oa-fav-all");
      if (!btn) return;
      // With nothing saved, "all saved" is impossible - skip the id scan
      // entirely and paint the outline state.
      const empty = !window.OAFavorites.count();
      if (empty) { window.OAFavorites.syncHeaderButton(btn, null); return; }
      const ids = matchingIds();
      const rev = window.OAFavorites.rev();
      if (!_favAllMemo || _favAllMemo.ids !== ids || _favAllMemo.rev !== rev) {
        _favAllMemo = { ids: ids, rev: rev, all: window.OAFavorites.hasAll(ids) };
      }
      // syncHeaderButton short-circuits its DOM writes when the state is
      // unchanged; hand it the decided verdict so it never rescans.
      window.OAFavorites.syncHeaderButton(btn, _favAllMemo.all);
    }

    /* ---- Abstract reading panel: text + state helpers ---------------- */

    // SlickGrid rows are user-select:none, and Chrome will NOT clear an existing
    // text selection when you mousedown on a non-selectable element. So text
    // highlighted inside an open abstract stayed visibly selected after clicking
    // elsewhere in the grid. Restore the expected behaviour: on mousedown outside
    // the abstract that currently holds the selection, drop the selection.
    scope.listen(document.getElementById("myGrid"), "mousedown", function (event) {
      var sel = window.getSelection && window.getSelection();
      if (!sel || sel.isCollapsed || !String(sel)) return;
      var anchor = sel.anchorNode;
      var holder = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentNode);
      holder = holder && holder.closest && holder.closest(".abs-detail");
      if (!holder) return;                               // selection isn't in an abstract
      if (holder.contains(event.target)) return;         // clicking within it: leave alone
      sel.removeAllRanges();
    });

    // The author footer sits OUTSIDE #myGrid; its chips are the same filter
    // affordances the cells carry, so route its clicks (and Enter / Space)
    // through the same toggles. Only the primary button filters; Shift stays
    // the row-range gesture. No modifier-click or middle-button shortcuts.
    // Date chips carry one grain per mouse button: LMB = that month, MMB (the
    // wheel button, an auxclick) = everything since that month, RMB = the whole
    // year. The keyboard mirrors it on Enter / Space: plain = month, Shift =
    // since, Alt = year (only the keyboard reads Shift and Alt).
    function dateModeFromMouse(event) {
      return event.button === 2 ? "year" : event.button === 1 ? "since" : "month";
    }
    function dateModeFromKey(event) {
      return event.altKey ? "year" : event.shiftKey ? "since" : "month";
    }
    // Middle and right presses on a date chip, for both the grid and the author
    // footer: the wheel button's auxclick fires as an aux click, the right
    // button's action rides on contextmenu (its click never fires). Scoped to
    // the chips alone: on a title (a real <a href>) the browser's own middle
    // click opens the pinned view in a new tab, and nothing here may swallow it.
    function wireDateAuxButtons(host) {
      scope.listen(host, "auxclick", function (event) {
        if (event.button !== 1 || event.shiftKey || event.altKey) return;
        const el = event.target.closest(".date-link");
        if (!el) return;
        event.preventDefault();
        applyDateCellFilter(el.dataset.date, "since");
      });
      // The wheel button's mousedown would autoscroll (Windows) or paste (X11)
      // before the auxclick lands; swallow it on the chip only.
      scope.listen(host, "mousedown", function (event) {
        if (event.button === 1 && event.target.closest(".date-link")) event.preventDefault();
      });
      // Middle-click on a title / author / keyword anchor is left to the
      // browser: it opens the href (the same view) in a new tab.
    }

    wireDateAuxButtons(document.getElementById("myGrid"));

    // Clicks and keys on the table's chips and buttons (grid-actions.js).
    const gridActions = window.OAGridActions.attach({ FIELD_ALIASES, absRows, applyDateCellFilter, batchRepaint, copyCitation, dataView, dateModeFromKey, dateModeFromMouse, downloadBibtex, dropAuthorForPin, flushKeywordClamp, grid, lookupArticle, markNavigation, matchingIds, normalizeText, openPdf, renderers, ruleEditor, ruleTree, scope, searchController, toggleAbstract, toggleFieldRule, get rowSel() { return rowSel; } });

    // (Inline abstract drops render inside the grid; their × close button is
    // handled by the #myGrid click delegate above - no docked panel to wire.)

    // Resize is handled once at module scope; just register this grid.
    activeResizeHandler = layout.requestResize;

    // Excel-style row marking: drag across rows, Shift+click for a range.
    // Painted via the abstract overlay's rowClass hook; the toolbar badge
    // shows the live count with a clear affordance.
    var selBadge = document.getElementById("rowSelCount");
    var selBadgeT = selBadge ? selBadge.querySelector(".rowsel-count-t") : null;
    var selFav = document.getElementById("rowSelFav");
    // Star on the badge: favorite every marked row, or un-favorite them all
    // when every one is already saved (header-star semantics).
    var syncSelFavStar = function () {
      if (!selFav) return;
      var all = rowSel && rowSel.count() > 0 && window.OAFavorites.hasAll(rowSel.ids());
      selFav.classList.toggle("is-fav", all);
      selFav.innerHTML = window.OAFavorites.iconHtml(all);
      var label = all ? "Remove all selected from favorites" : "Favorite all selected";
      selFav.title = label;
      selFav.setAttribute("aria-label", label);
    };
    rowSel = window.OARowSelect.attach({
      host: document.getElementById("myGrid"),
      absRows: absRows,
      orderedRows: function () { return visibleRows(); },   // display order incl. duplicates, memoized
      repaint: function () { try { grid.invalidate(); } catch (e) {} },
      // Targeted repaint for small selection diffs: only rows in the rendered
      // range can need a class change NOW - offscreen rows pick up the right
      // classes when SlickGrid re-renders them on scroll.
      repaintIds: function (ids) {
        try {
          var r = grid.getRenderedRange ? grid.getRenderedRange() : null;
          if (!r) { grid.invalidate(); return; }
          var want = new Set(ids), dirty = [];
          for (var i = Math.max(0, r.top); i <= r.bottom; i++) {
            var it = grid.getDataItem(i);
            if (it && want.has(it.id)) dirty.push(i);
          }
          if (dirty.length) { grid.invalidateRows(dirty); grid.render(); }
        } catch (e) {}
      },
      onChange: function (n) {
        syncExportButton();
        syncOpenAllButton();   // selection drives the "Open all" pair's target set
        if (!selBadge) return;
        selBadge.hidden = n === 0;
        if (selBadgeT) selBadgeT.textContent = n + " selected";
        syncSelFavStar();
      }
    });
    scope.add(rowSel.destroy);
    var selClear = document.getElementById("rowSelClear");
    if (selClear) scope.listen(selClear, "click", function () { rowSel.clear(); });
    if (selFav) {
      scope.listen(selFav, "click", function () {
        var ids = rowSel.ids();
        if (!ids.length) return;
        if (window.OAFavorites.hasAll(ids)) window.OAFavorites.removeMany(ids);
        else window.OAFavorites.addMany(ids);
      });
      scope.add(window.OAFavorites.onChange(scope.guard(syncSelFavStar)));
      syncSelFavStar();
    }

    prepareRuntimeIndexes(articles);
    populateAutocompleteDatalists();

    // Apply URL query params before the rule builder renders, so the
    // initial paint already reflects ?q=... and ?sort_by=... .
    const urlParams = new URLSearchParams(window.location.search);
    // Read params case-insensitively so a shared / hand-edited URL loads
    // whatever the casing (the app emits lowercase `q` but uppercase SORT_BY /
    // GROUP_BY, so a retyped ?sort_by= or ?Q= would otherwise be ignored).
    function getParam(name) {
      if (urlParams.has(name)) return urlParams.get(name);
      const lower = name.toLowerCase();
      for (const [key, value] of urlParams) {
        if (key.toLowerCase() === lower) return value;
      }
      return null;
    }
    // A link encoded twice on its way (mail and chat link wrappers do it)
    // arrives as ID%20IS%20%22...%22: a rule never has %20 / %22 for a space
    // or a quote, so decode once more.
    function undoubleEncode(value) {
      if (value && !/[\s"']/.test(value) && /%(?:20|22|27)/i.test(value)) {
        try { return decodeURIComponent(value); } catch (e) { /* not encoded after all */ }
      }
      return value;
    }
    const urlQueryParam   = undoubleEncode(getParam("q"));
    const urlSortByParam  = getParam("SORT_BY");
    const urlGroupByParam = getParam("GROUP_BY");
    const urlSearchParam  = getParam("search");
    const urlMatchAny     = String(getParam("match") || "").trim().toLowerCase() === "any";
    // Restore a shared free-text query: the box is filled now, the search itself
    // runs once the module is ready (the controller waits on it; the oa-search-ready
    // handler re-runs a query typed before that). Query and match mode restore
    // together, so the first results already use the shared mode.
    if (urlSearchParam && urlSearchParam.trim() !== "") {
      const sbox = document.getElementById("semanticSearch");
      const sclear = document.getElementById("semanticSearchClear");
      if (sbox) {
        if (sclear) sclear.hidden = false;
        searchController.restore(urlSearchParam.trim(), { anyWord: urlMatchAny });
      }
    }

    ruleEditor.loadQuery(urlQueryParam);
    // A link pasted at the end of a sentence or in brackets carries the
    // punctuation after it (...%22. or ...%22)) and failed to load: drop up to
    // three trailing marks, the first version that parses wins.
    if (ruleEditor.hasInvalidQuery() && urlQueryParam) {
      let q = urlQueryParam;
      for (let n = 0; n < 3 && /[\s.,;:!?)\]}>\u2019\u201D]$/.test(q); n++) {
        q = q.slice(0, -1);
        ruleEditor.loadQuery(q);
        if (!ruleEditor.hasInvalidQuery()) break;
      }
      if (ruleEditor.hasInvalidQuery()) ruleEditor.loadQuery(urlQueryParam);   // the reader sees what came in
    }
    // Tracking tags a newsletter or social site appended mean nothing here,
    // and would ride along on every link copied from this page.
    try {
      const u = new URL(window.location.href);
      let dropped = false;
      Array.from(u.searchParams.keys()).forEach(function (k) {
        if (/^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igshid|_hs(enc|mi)|mkt_tok|yclid|twclid|li_fat_id)$/i.test(k)) { u.searchParams.delete(k); dropped = true; }
      });
      if (dropped) window.history.replaceState(window.history.state, "", u.toString());
    } catch (e) { /* sandboxed: harmless */ }

    ruleEditor.render();

    dataView.beginUpdate();
    dataView.setItems(articles);
    dataView.setFilter(dataViewFilter);
    compileAndApplyRuleFilter();
    dataView.endUpdate();

    if (ruleEditor.hasInvalidQuery()) ruleEditor.setOpen(true);

    // Default to Date-descending (newest first) when the URL doesn't
    // specify a sort, so the grid always opens sorted by date.
    if (urlSortByParam) {
      applySortFromUrl(urlSortByParam);
    } else {
      applySortFromUrl("date-desc");
    }

    if (urlGroupByParam) {
      applyGroupingFromUrl(urlGroupByParam);
    }

    // Sync Clear/Collapse/Expand visibility to the initial grouping state
    // (hidden unless a group_by came in from the URL).
    updateGroupingControls();

    updateResultCount();
    layout.requestResize();

    setupFavorites();
    moveLeadButtons();
    // Kiosk mode (kiosk.js) plays the set BibTeX and "Open all" act on, and
    // a kiosk link waits until a search it carries (?search=) has applied.
    window.OAArticlesGrid.targetIds = openTargetIds;
    window.OAArticlesGrid.searchPending = function () { return searchController.pending; };
    scope.add(function () { delete window.OAArticlesGrid.targetIds; delete window.OAArticlesGrid.searchPending; });

    // All initial state (rule tree, dataView items, sort) is in place;
    // future rule edits and header clicks may now push to history.
    urlSyncReady = true;
    syncCrumb();
    // A shared link that named an author by label now holds the slug
    // (loadQuery): write it back, so the address bar shows the slug too.
    updateUrlBar();

    /* ---- Back / Forward ------------------------------------------------
       Navigational clicks push history entries (urlSyncPush), so Back must
       restore what the previous URL described: rule, sort, grouping and the
       free-text query - the same sequence the initial load runs above. URL
       syncing is paused meanwhile, or the handlers would rewrite the entry
       being restored. */
    function applyStateFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const read = function (name) {
        if (params.has(name)) return params.get(name);
        const lower = name.toLowerCase();
        for (const [key, value] of params) {
          if (key.toLowerCase() === lower) return value;
        }
        return null;
      };
      urlSyncReady = false;
      urlSyncPush = false;
      try {
        ruleEditor.loadQuery(undoubleEncode(read("q")));
        ruleEditor.render();
        compileAndApplyRuleFilter();
        applySortFromUrl(read("SORT_BY") || "date-desc");
        applyGroupingFromUrl(read("GROUP_BY") || "");
        updateGroupingControls();
        const text = String(read("search") || "").trim();
        if (text) searchController.restore(text, { anyWord: String(read("match") || "").trim().toLowerCase() === "any" });
        else if (searchController.query) searchController.clearBox();
        updateResultCount();
      } finally {
        urlSyncReady = true;
        syncCrumb();
        syncTitle();
      }
    }
    scope.listen(window, "popstate", function () { applyStateFromUrl(); });

    /* ---- Favorites: filter toggle, live star repaint, deep-link ---- */
    // Hide abstracts, Open all and the metrics toggle are always in the site
    // header (greyed out when unusable) and lead it, left of settings - with
    // or without the favorites feature. Until this runs the shell keeps them
    // out of sight (articles.css, [data-grid-ready="loading"]).
    function moveLeadButtons() {
      const toprow = document.querySelector(".oa-root > .oa-top .oa-toprow");
      if (!toprow) return;
      const lead = document.createElement("div");
      lead.className = "oa-tb-head";
      ["collapseAbstracts", "openAll", "panelToggle"].forEach(function (id) {
        const b = document.getElementById(id);
        // Open all travels as its split (action + route menu), like Favorites.
        if (b) lead.appendChild(b.closest(".open-split") || b);
      });
      if (!lead.childElementCount) return;
      toprow.insertBefore(lead, toprow.querySelector(".oa-settings-btn") || toprow.firstChild);
      scope.add(function () { lead.remove(); });
    }
    function setupFavorites() {
      const favBtn = document.getElementById("favFilter");
      if (!favBtn || !window.OAFavorites) {
        if (favBtn) favBtn.hidden = true;
        return;
      }

      // The Favorites split button and the BibTeX download live in the site
      // header, right after the settings button (moved there by
      // wireSearchSettings above), like it: hidden with the header while the
      // entry screen is up. They share one layout-transparent wrapper
      // (.oa-tb-head), which the toolbar's button rules also match. Their
      // toolbar separators go too, or one would be left stranded.
      const favSplitEl = favBtn.closest(".fav-split");
      const favToprow = document.querySelector(".oa-root > .oa-top .oa-toprow");
      if (favSplitEl && favToprow) {
        [favSplitEl.previousElementSibling, favSplitEl.nextElementSibling].forEach(function (sep) {
          if (sep && sep.classList.contains("toolbar-sep")) sep.remove();
        });
        const head = document.createElement("div");
        head.className = "oa-tb-head";
        const settingsBtn = favToprow.querySelector(".oa-settings-btn");
        favToprow.insertBefore(head, settingsBtn ? settingsBtn.nextSibling : favToprow.firstChild);
        head.appendChild(favSplitEl);
        const exportBtn = document.getElementById("exportResults");
        if (exportBtn) head.appendChild(exportBtn);
        scope.add(function () { head.remove(); });
      }

      // The button is a shortcut that toggles an `IS_FAVORITE = TRUE` rule -
      // the same rule a ?q=IS_FAVORITE=TRUE URL or the rule builder produces.
      // Everything (grid filter, result count, CSV export, URL) then flows
      // through the single rule predicate. We don't force the rule builder
      // open for this lightweight toggle.
      scope.listen(favBtn, "click", function () {
        toggleFieldRule("isFavorite", "is", "true", false);
      });

      // The IS_FAVORITE predicate evaluates OAFavorites.has() live, so when a
      // star is toggled while ANY favorites-dependent view is active (TRUE, FALSE
      // or a NOT row) the affected row must appear/disappear. Re-run the filter
      // without recompiling; a live text search re-ranks within the new set.
      scope.add(window.OAFavorites.onChange(scope.guard(function () {
        if (ruleDependsOnFavorites()) {
          dataView.refresh();
          updateResultCount();
          layout.requestResize();
          if (searchController.query) searchController.schedule();
        }
        // Header "favorite all" star mirrors the visible set.
        syncFavAllHeader();
      })));

      // Re-sync the header star whenever the header (re)renders. Row-set
      // changes are already covered: the onRowsOrCountChanged handler ends in
      // grid.render(), and onRendered drives the sync (see gridRendered).
      scope.subscribe(grid.onHeaderCellRendered, syncFavAllHeader);
      favHeaderSyncReady = true;
      syncFavAllHeader();

      /* Share link + Remove all, beside the star that shows the saved view.
         They used to live in the header star's dropdown, a screen away from
         the list they act on; the other two items in that menu (Download .bib,
         See favorites) only repeated what this toolbar already does with the
         Export button and the star itself, so the dropdown is gone site-wide.
         Both stay inert while nothing is saved. */
      const favShareBtn = document.getElementById("favShare");
      const favClearBtn = document.getElementById("favClear");
      // They now sit in the menu half of the Favorites split button, named in
      // words (a bare link glyph and a trash can beside the star said neither
      // "share" nor "favorites").
      const favMenuBtn = document.getElementById("favMenuBtn");
      const favMenu = document.getElementById("favMenu");
      const favSplit = favMenuBtn ? favMenuBtn.parentElement : null;
      let favMenuRelease = null;
      function setFavMenuOpen(open, focusFirst) {
        if (!favMenu || !favMenuBtn) return;
        const hadFocus = favMenu.contains(document.activeElement);
        favMenu.hidden = !open;
        if (open) {
          // Right-aligned under its button, the menu ran 20-60px off the left
          // edge of a phone, where the button sits near the start of the
          // header: slide it back on screen.
          favMenu.style.right = "";
          const r = favMenu.getBoundingClientRect();
          const shift = Math.max(0, 8 - r.left) - Math.max(0, r.right - (window.innerWidth - 8));
          if (shift) favMenu.style.right = -shift + "px";
        }
        if (open) favMenuRelease = window.OATheme.popover("favorites", function () { setFavMenuOpen(false); });
        else if (favMenuRelease) { favMenuRelease(); favMenuRelease = null; }
        favMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && focusFirst) {
          const first = favMenu.querySelector('[role="menuitem"]:not(:disabled)');
          if (first) first.focus({ preventScroll: true });
        } else if (!open && hadFocus && !favMenuBtn.hidden) {
          favMenuBtn.focus({ preventScroll: true });
        }
      }
      if (favMenuBtn && favMenu && favSplit) {
        // Keyboard / AT activation (detail 0) moves focus into the menu.
        scope.listen(favMenuBtn, "click", function (event) { setFavMenuOpen(favMenu.hidden, event.detail === 0); });
        scope.listen(favSplit, "keydown", function (event) {
          if (favMenu.hidden) return;
          if (event.key === "Escape") {
            event.stopPropagation();   // not also the grid's Escape (hide abstracts)
            setFavMenuOpen(false);
            favMenuBtn.focus({ preventScroll: true });
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const items = Array.prototype.filter.call(favMenu.querySelectorAll('[role="menuitem"]'), function (b) { return !b.disabled; });
            if (!items.length) return;
            event.preventDefault();
            const at = items.indexOf(document.activeElement);
            const next = event.key === "ArrowDown" ? (at + 1) % items.length : (at <= 0 ? items.length - 1 : at - 1);
            items[next].focus({ preventScroll: true });
          }
        });
        scope.listen(document, "pointerdown", function (event) {
          if (!favMenu.hidden && !favSplit.contains(event.target)) setFavMenuOpen(false);
        });
        scope.listen(favSplit, "focusout", function (event) {
          if (!favMenu.hidden && event.relatedTarget && !favSplit.contains(event.relatedTarget)) setFavMenuOpen(false);
        });
      }
      if (favShareBtn) {
        scope.listen(favShareBtn, "click", function () { setFavMenuOpen(false); window.OAFavorites.copyShareLink(); });
      }
      if (favClearBtn) {
        scope.listen(favClearBtn, "click", function () {
          setFavMenuOpen(false);
          Promise.resolve(window.OAFavorites.clearWithConfirm()).then(scope.guard(function () { keepKeyboardFocus(favMenuBtn, favBtn); }));
        });
      }
      function syncFavActionButtons() {
        const empty = window.OAFavorites.count() === 0;
        if (favShareBtn) favShareBtn.disabled = empty;
        if (favClearBtn) favClearBtn.disabled = empty;
        // Nothing saved, nothing to share or remove: the menu half goes.
        if (favMenuBtn) {
          if (empty) setFavMenuOpen(false);
          favMenuBtn.hidden = empty;
        }
      }
      scope.add(window.OAFavorites.onChange(scope.guard(syncFavActionButtons)));
      syncFavActionButtons();

      // The toolbar shell is injected after favorites.js's initial badge
      // sweep, so refresh the count chip now that #favFilter exists.
      window.OAFavorites.refreshBadges();

      // Deep link: index.html#favorites (used by the header badge on
      // other pages) opens straight into the saved-only view. The hash is a
      // one-time instruction, not state: once it is a rule (kept in ?q=) it is
      // removed - also when the rule was already on - or turning Favorites off
      // would come back on the next reload.
      function applyHashFavorites() {
        if ((window.location.hash || "").toLowerCase() !== "#favorites") return;
        if (!isFavRuleActive()) toggleFieldRule("isFavorite", "is", "true", false);
        try {
          const u = new URL(window.location.href);
          u.hash = "";
          window.history.replaceState(window.history.state, "", u.toString());
        } catch (e) { /* sandboxed: the rule still applies */ }
      }
      applyHashFavorites();
      scope.listen(window, "hashchange", applyHashFavorites);

      // Reflect any rule already loaded from ?q= on first paint.
      syncFavFilterButton();
    }
  }
  /* ============================ end buildGrid ======================= */

  /* ------------------------------------------------------------------ */
  /* Page entry point                                                   */
  /* ------------------------------------------------------------------ */

  // While the table waits for its data: a bar centred where the rows will be,
  // with the download in percent (data-load.js OADataProgress; the bar slides
  // without a percent while the size is unknown), then full, "Building the
  // table…" (parsing included), until the rows appear. building() says the
  // data is in where no byte count did; remove() ends it.
  function showLoadState(host) {
    var wrap = host.querySelector(".grid-wrap");
    var el = document.createElement("div");
    el.className = "load-state";
    el.setAttribute("role", "progressbar");
    el.setAttribute("aria-label", "Loading the articles");
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", "100");
    el.innerHTML = '<div class="load-state-inner"><span class="load-state-bar"><span class="load-state-fill"></span></span>' +
      '<p class="load-state-text"></p></div>';
    var fill = el.querySelector(".load-state-fill"), text = el.querySelector(".load-state-text");
    function show(pct, line) {
      el.classList.toggle("is-indeterminate", pct === null);
      if (pct === null) el.removeAttribute("aria-valuenow"); else el.setAttribute("aria-valuenow", String(pct));
      fill.style.width = pct === null ? "" : pct + "%";
      el.setAttribute("aria-valuetext", line);
      text.textContent = line;
    }
    function update() {
      var p = window.OADataProgress ? window.OADataProgress() : { loaded: 0, total: null };
      if (!p.total) return show(null, "Downloading the articles…");
      if (p.loaded >= p.total) return show(100, "Building the table…");
      var pct = Math.floor(p.loaded / p.total * 100);
      show(pct, "Downloading the articles · " + pct + "%");
    }
    function stop() { window.removeEventListener("oa-data-progress", update); }
    update();
    if (wrap) wrap.appendChild(el);
    window.addEventListener("oa-data-progress", update);
    return {
      building: function () { stop(); show(100, "Building the table…"); },
      remove: function () { stop(); el.remove(); }
    };
  }

    /* The component shell lives in grid-shell.js (window.OAGridShell): toolbar,
       settings panel, grid container, datalists. Keep the element ids there in
       sync with what this script wires up. */
  function initArticlesGrid() {
    var host = document.getElementById("articles-app");
    if (!host) { destroyArticlesGrid(); return; }
    if (host === activeHost && host.dataset.gridReady) return;
    destroyArticlesGrid();
    activeHost = host;
    var generation = mountGeneration;
    host.dataset.gridReady = "loading";
    pageOverflow = { html: document.documentElement.style.overflowY, body: document.body.style.overflowY };
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflowY = "hidden";
    host.classList.add("articles-app");
    host.innerHTML = window.OAGridShell.html();
    var loadState = showLoadState(host);

    // The store builds in bounded slices while SlickGrid's scripts load, so the
    // first table needs no single long main-thread block (a synchronous
    // OAArticleStore.get() elsewhere simply finishes the same build).
    var storeReady = window.OAArticleStore.prepare();
    // The dataset is fetched and parsed off-thread by data-load.js (head);
    // await it here. Should that have failed the
    // store would quietly build an empty table - fail loudly instead: the
    // catch below shows the message and a retry that re-fetches the data.
    var dataReady = Promise.resolve(window.OADataLoad).then(function () {
      if (Array.isArray(window.ARTICLES_DATA)) return;
      throw new Error("the article data (window.ARTICLES_DATA) is missing");
    }, function (error) {
      throw new Error("the article data (data/tabular_data.js) could not be downloaded" +
        (error && error.message ? " - " + error.message : ""));
    });
    dataReady.then(loadState.building, function () {});
    return Promise.all([ensureDependencies(), storeReady, dataReady]).then(function () {
      loadState.remove();
      if (generation !== mountGeneration || host !== activeHost) return;
      if (!host.isConnected) { destroyArticlesGrid(); return; }
      const store = window.OAArticleStore.get();
      window.ARTICLES_DATA = store.createView();
      // The view is a fresh copy of the store's snapshot, so anything attached to
      // the previous rows (semantic-search.js's row.abstract) must be re-joined.
      window.dispatchEvent(new CustomEvent("oa-articles-view"));
      buildGrid();
      host.dataset.gridReady = "1";
    }).catch(function (error) {
      loadState.remove();
      if (generation !== mountGeneration || host !== activeHost) return;
      destroyArticlesGrid();
      console.error("[articles-grid]", error);
      var msg = (error && error.message) ? error.message : String(error);
      var target = host.querySelector("#myGrid") || host;
      target.innerHTML = '<p role="alert" style="padding:1rem;color:var(--danger);font-family:var(--sans)">' +
        "Articles table failed to load: " + msg.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</p>";
      var retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry loading articles";
      retry.style.whiteSpace = "nowrap";
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.textContent = "Retrying\u2026";
        reloadMissingData().then(initArticlesGrid, initArticlesGrid);
      }, { once: true });
      target.appendChild(retry);
    });
  }

  // Re-fetch whichever data scripts never produced their global (a failed or
  // interrupted download), then let the caller rebuild. Scripts that did load
  // are left alone.
  function reloadMissingData() {
    var A = window.OAAssets;
    var missing = [];
    if (!Array.isArray(window.ARTICLES_DATA)) missing.push("data/tabular_data.js");
    if (!window.AUTHORS_DATA) missing.push("data/author_data.js");
    if (!window.CATEGORY_DEFS) missing.push("src/category_data.js");
    var loaded = Promise.all(missing.map(function (p) { return A.loadScript(A.url(p)); }));
    // The grid awaits OADataLoad: point it at this attempt.
    window.OADataLoad = loaded.then(function () { return true; });
    window.OADataLoad.catch(function () {});
    return loaded;
  }

  window.OAArticlesGrid = { init: initArticlesGrid, destroy: destroyArticlesGrid };

  if (document.readyState !== "loading") {
    initArticlesGrid();
  } else {
    document.addEventListener("DOMContentLoaded", initArticlesGrid, { once: true });
  }
})();
