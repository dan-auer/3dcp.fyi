/* grid-layout.js
 * One mounted grid's responsive columns, saved chooser and geometry lifecycle.
 * Data, search, sorting and grouping remain with their owners. Content effects
 * are explicit: clear measurements, refresh summaries, re-fit drops and footer.
 * Classic script; loading it mounts nothing.
 */
globalThis.OAGridLayout = (function () {
  "use strict";
  function create(dependencies) {
    const window = dependencies.window;
    const document = dependencies.document;
    const grid = dependencies.grid;
    const columns = dependencies.columns;
    const effects = dependencies.effects;
    const SUMMARY_ORDER = dependencies.summaryOrder;
    const escapeHtml = dependencies.escapeHtml;
    const scope = window.OALifecycle.create();
    dependencies.parentScope.add(scope.destroy);

    // Designed widths, captured BEFORE SlickGrid's forceFit starts mutating
    // column.width, so a column that drops out on a narrow viewport and comes
    // back on a wide one is restored to its intended proportion instead of the
    // squeezed width it left at.
    const DESIGN_WIDTHS = dependencies.designWidths;

    // Tiered drop policy is based on reader comfort before minimum widths.
    // TIER 1 drops to keep the READING columns (Article, Authors) at a
    // comfortable width, not at their floor. Access and Date go before
    // Authors does, as on phones (below): from 600 to 695px Authors went
    // first and the table showed Date and Article only. TIER 2 columns are
    // cheap and useful, so they only drop when even the floors no longer fit.
    const COLUMN_DROP_ORDER = ["keywords", "citations", "category", "venue", "openAccess", "date", "authors"];
    const COLUMN_DROP_ORDER_LAST = ["favorite", "openAccess", "date"];
    // Phones (< 560px) flip the policy: a row is recognised by Article +
    // Authors, so the fixed single-purpose columns (Access badge, Date) are shed
    // up front and their width goes to the reading columns, and Authors leaves
    // the comfort pass to drop only when even the floors no longer fit - after
    // the star. Date, access and the star stay one tap away in the drop's
    // hidden-column summary.
    const PHONE_MAX = 560;
    const PHONE_SHED = ["openAccess", "date"];
    const PHONE_DROP_ORDER = ["keywords", "citations", "category", "venue"];
    const PHONE_DROP_ORDER_LAST = ["favorite", "authors"];
    // Width each column wants before any other column is allowed to keep its
    // place: the fit is judged against these, with minWidth left as the
    // last-resort floor. Fixed-width columns want exactly their width.
    const COMFORT_WIDTHS = { title: 280, authors: 180, venue: 150, keywords: 190 };
    function comfortWidth(c) { return Math.max(COMFORT_WIDTHS[c.id] || 0, c.minWidth || 0) || c.width || 0; }
    function floorWidth(c) { return c.minWidth || c.width || 0; }
    // Restore reader choices before the first responsive pass.
    const HIDDEN_COLS_KEY = "oa-hidden-columns";
    var userHiddenCols = new Set();
    var savedHidden = window.OAPrefs.getJSON(HIDDEN_COLS_KEY, []);
    if (Array.isArray(savedHidden)) {
      // Ids that no longer name a column (the retired DOI column, a renamed id)
      // are dropped on read and the cleaned list written back, so a stale
      // choice cannot linger in storage or count toward the hidden badge.
      var known = new Set(columns.map(function (c) { return c.id; }));
      var stale = false;
      savedHidden.forEach(function (id) {
        id = String(id);
        if (id === "expand" || id === "title") return;
        if (known.has(id)) userHiddenCols.add(id); else stale = true;
      });
      if (stale) saveHiddenCols();
    }
    var responsiveDropped = new Set();

    // Align the open abstract's text box with the table columns. The left edge
    // is pinned to the right edge of the START column (the caret/expand column,
    // which is always first) so the abstract stays anchored to it no matter how
    // the other columns are reordered; the right edge tracks the Authors
    // column's right edge. Published as CSS vars (--oa-abs-left / --oa-abs-right,
    // consumed by #myGrid .abs-drop-inner) and recomputed on resize/reorder.
    function syncAbstractBounds() {
      var host = document.getElementById("myGrid");
      if (!host || !grid || !grid.getColumns) return;
      var cols = grid.getColumns();
      if (!cols.length) return;
      var left = cols[0].width || 0;            // right edge of the pinned start column
      // Hidden columns (responsive drops) occupy no canvas space and keep a
      // stale width, so they must not count toward either edge.
      var acc = 0, right = null, fallback = 0;
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].hidden) continue;
        acc += cols[i].width || 0;
        fallback = acc;
        if (cols[i].id === "authors") { right = acc; break; }   // right edge of authors col
        if (cols[i].id === "title") fallback = acc;             // narrow layouts: stop at Article
      }
      if (right === null) right = fallback;
      if (right <= left) return;
      host.style.setProperty("--oa-abs-left", Math.round(left) + "px");
      host.style.setProperty("--oa-abs-right", Math.round(right) + "px");
    }

    /* Responsive column set -------------------------------------------------
     * forceFitColumns can only squeeze columns down to their minWidth; below
     * the sum of those the grid grows a HORIZONTAL scrollbar, and this table
     * must never have one - a row is one entry to read, not a strip to pan.
     * So instead of scrolling, the lowest-value columns drop out (SlickGrid's
     * per-column `hidden` flag) until the remaining set fits the width, and
     * come back as the viewport widens. Caret and Article never drop.
     * The grid is handed a SUBSET of `columns` rather than SlickGrid's own
     * `hidden` flag: its column-position caches skip hidden columns, so a
     * "*"-colspan row (a group header, an abstract drop) whose span ends on a
     * hidden column renders no cell at all. */

    /* SlickGrid measures scrollbar thickness with a probe div appended to
     * <body> - outside .articles-app, so it never sees this app's own thin
     * scrollbar styling, and reads 0 where the platform draws overlay
     * scrollbars. It then sizes the columns to the FULL container width, and
     * the viewport stays permanently scrollable by exactly the width of its
     * own vertical scrollbar (an ~8px horizontal scrollbar under every row).
     * Re-measure on the LIVE viewport and hand the real number back. */
    var lastScrollbarW = -1;
    function calibrateScrollbar() {
      var vp = document.querySelector("#myGrid .slick-viewport");
      if (!vp || !grid.scrollbarDimensions) return false;
      var w = Math.round(vp.offsetWidth - vp.clientWidth);   // vertical scrollbar (always on)
      if (w <= 0 || w === lastScrollbarW) return false;
      lastScrollbarW = w;
      grid.scrollbarDimensions.width = w;
      grid.scrollbarDimensions.height = w;                   // scrollbars are square in thickness
      return true;
    }

    // Space the columns may occupy: the viewport's inner width, which is what
    // SlickGrid's own forceFit measures against (container minus the always-on
    // vertical scrollbar). 1px of slack absorbs sub-pixel rounding.
    function gridInnerWidth() {
      var vp = document.querySelector("#myGrid .slick-viewport");
      if (vp && vp.clientWidth) return vp.clientWidth - 1;
      var el = document.getElementById("myGrid");
      return el && el.clientWidth ? el.clientWidth - 11 : 0;
    }

    // Returns true when it already called grid.autosizeColumns(), so callers
    // don't pay for a second full column-width redistribution.
    function syncResponsiveColumns() {
      var recalibrated = calibrateScrollbar();
      var avail = gridInnerWidth();
      if (!avail || !grid.getColumns) return false;   // nothing measured, nothing autosized
      var byId = {}, comfort = 0, i, c;
      for (i = 0; i < columns.length; i++) {
        byId[columns[i].id] = columns[i];
        comfort += comfortWidth(columns[i]);
      }
      var drop = {};
      // Columns the reader switched off in the column chooser go first; the
      // responsive passes below only ever look at what is left.
      userHiddenCols.forEach(function (id) {
        c = byId[id];
        if (!c || drop[id]) return;
        drop[id] = true;
        comfort -= comfortWidth(c);
      });
      var phone = avail < PHONE_MAX;
      if (phone) PHONE_SHED.forEach(function (id) {
        c = byId[id];
        if (!c || drop[id]) return;
        drop[id] = true;
        comfort -= comfortWidth(c);
      });
      var order = phone ? PHONE_DROP_ORDER : COLUMN_DROP_ORDER;
      var orderLast = phone ? PHONE_DROP_ORDER_LAST : COLUMN_DROP_ORDER_LAST;
      // Pass 1: shed low-value columns until the rest fit COMFORTABLY.
      for (i = 0; i < order.length && comfort > avail; i++) {
        c = byId[order[i]];
        if (!c || drop[c.id]) continue;
        drop[c.id] = true;
        comfort -= comfortWidth(c);
      }
      // Pass 2: only if the survivors can't even fit at their floors.
      var floor = 0;
      for (i = 0; i < columns.length; i++) if (!drop[columns[i].id]) floor += floorWidth(columns[i]);
      for (i = 0; i < orderLast.length && floor > avail; i++) {
        c = byId[orderLast[i]];
        if (!c || drop[c.id]) continue;
        drop[c.id] = true;
        floor -= floorWidth(c);
      }
      var next = columns.filter(function (col) { return !drop[col.id]; });
      // What the width took away (as opposed to what the reader switched off).
      responsiveDropped = new Set(Object.keys(drop).filter(function (id) { return !userHiddenCols.has(id); }));
      var cur = grid.getColumns();
      var same = cur.length === next.length;
      if (same) for (i = 0; i < cur.length; i++) { if (cur[i].id !== next[i].id) { same = false; break; } }
      if (!same) {
        // forceFit redistributes from scratch on a changed set: start every
        // column from its designed width so the split is deterministic
        // instead of drifting off whatever the last squeeze left behind.
        for (i = 0; i < next.length; i++) {
          if (DESIGN_WIDTHS[next[i].id]) next[i].width = DESIGN_WIDTHS[next[i].id];
        }
        grid.setColumns(next);
      }
      if (!same || recalibrated) {
        grid.autosizeColumns();
        // The drops' hidden-column summary follows the column set (see
        // hiddenColumnsSummary): re-measure open drops against the regenerated
        // markup so their row reservation fits it. The host owns drop rows.
        if (!same) effects.summaryChanged();
        return true;
      }
      return false;
    }

    /* Hidden-column summary --------------------------------------------
     * Narrow layouts shed columns (authors, venue, date, access...) so the
     * title stays legible - but a reader who opens an article must not lose
     * that metadata, and the pinned article view is this same grid. The drop
     * therefore leads with a stacked summary of every column that is NOT on
     * screen (dropped by width or switched off in the chooser), built from the
     * same cell formatters so each value keeps its affordance: an author name
     * or a venue narrows the list exactly as it does in a cell. */
    function hiddenColumnIds() {
      const out = [];
      for (let i = 0; i < SUMMARY_ORDER.length; i++) {
        const id = SUMMARY_ORDER[i];
        if (responsiveDropped.has(id) || userHiddenCols.has(id)) out.push(id);
      }
      return out;
    }
    function hiddenColumnsSig() { return hiddenColumnIds().join(","); }
    /* Which article ids have their details block open. The drop's HTML is
       memoized and re-rendered from that cache, so an open <details> would
       close on the next render unless the state lives out here and is baked
       back into the markup. */
    const openMetaDetails = new Set();
    function hiddenColumnsSummary(item) {
      return dependencies.renderSummary(item, hiddenColumnIds(), !!item && openMetaDetails.has(item.id));
    }
    // The full keyword list belongs in the details block, so the clamp pass
    // leaves that copy alone (see clampKeywordCells' :not selector).
    scope.listen(document, "toggle", function (e) {
      const d = e.target;
      if (!d || !d.classList || !d.classList.contains("abs-meta-details")) return;
      // Measurement probes and repainted <details open> emit toggle too.
      // Only a changed state in the live grid needs another layout pass.
      if (!d.isConnected || !d.closest("#myGrid .grid-canvas")) return;
      const id = d.getAttribute("data-id");
      if (!id || openMetaDetails.has(id) === d.open) return;
      if (d.open) openMetaDetails.add(id); else openMetaDetails.delete(id);
      // The drop is painted across rows reserved from its measured height, and
      // its HTML is cached - so drop the cache, re-measure and re-paint.
      effects.summaryChanged(id);
    }, true);
    // Mirror a user reorder of the VISIBLE columns back into the master list,
    // leaving currently-dropped columns at their own index so they return to
    // roughly where they were.
    function syncMasterColumnOrder(visible) {
      var seen = {}, hidden = [], i;
      for (i = 0; i < visible.length; i++) seen[visible[i].id] = true;
      for (i = 0; i < columns.length; i++) if (!seen[columns[i].id]) hidden.push({ col: columns[i], at: i });
      var next = visible.slice();
      for (i = 0; i < hidden.length; i++) next.splice(Math.min(hidden[i].at, next.length), 0, hidden[i].col);
      columns.length = 0;
      Array.prototype.push.apply(columns, next);
    }

    /* Column chooser ----------------------------------------------------
     * Which columns the reader wants, persisted; the responsive pass then
     * drops from what is left. The button carries a badge with how many of the
     * wanted columns are not on screen (hidden by choice or by width), and the
     * panel says which is which. Right-clicking any column header opens it. */
    const COL_LABELS = {
      favorite: "Favorite \u00b7 graph metrics", date: "Date", openAccess: "Access \u00b7 reference \u00b7 BibTeX \u00b7 PDF",
      title: "Article", authors: "Authors", venue: "Venue", category: "Category",
      keywords: "Keywords", citations: "Citations"
    };
    const LOCKED_COLS = new Set(["expand", "title"]);
    function saveHiddenCols() {
      window.OAPrefs.setJSON(HIDDEN_COLS_KEY, Array.from(userHiddenCols));
    }
    function renderColumnsPanel() {
      const panel = document.getElementById("columnsPanel");
      if (!panel) return;
      let html = '<div class="cp-head"><span class="cp-title">Columns</span><button type="button" class="cp-close" aria-label="Close">&times;</button></div>';
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        if (LOCKED_COLS.has(c.id)) continue;
        const on = !userHiddenCols.has(c.id);
        const squeezed = on && responsiveDropped.has(c.id);
        html += '<label class="cp-row' + (squeezed ? " is-squeezed" : "") + '"><input type="checkbox" data-col="' + escapeHtml(c.id) + '"' + (on ? " checked" : "") + '/>' +
          '<span class="cp-name">' + escapeHtml(COL_LABELS[c.id] || c.id) + "</span>" +
          (squeezed ? '<span class="cp-note">no room at this width</span>' : "") + "</label>";
      }
      html += '<div class="cp-foot"><span class="cp-hint">Also: right-click any column header.</span><button type="button" class="cp-reset">Show all</button></div>';
      panel.innerHTML = html;
    }
    // The control that had focus when the chooser opened (Settings > Columns),
    // so closing can hand focus back to it.
    let columnsOpener = null;
    function setColumnsPanelOpen(open) {
      const panel = document.getElementById("columnsPanel");
      if (!panel) return;
      if (open) {
        const a = document.activeElement;
        if (panel.hidden) columnsOpener = a && a !== document.body && !panel.contains(a) ? a : null;
        renderColumnsPanel();
      }
      const hadFocus = !open && panel.contains(document.activeElement);
      panel.hidden = !open;
      if (!open && hadFocus) {
        const back = columnsOpener && columnsOpener.isConnected && columnsOpener.getClientRects().length ? columnsOpener : null;
        if (back) back.focus({ preventScroll: true });
        else {
          // Opened from a header right-click (or the opener is gone): land on
          // the header's first sortable column rather than on <body>.
          const header = document.querySelector("#myGrid .slick-header-column .oa-sort-btn, #myGrid .slick-header-column[tabindex], #myGrid .slick-header-column");
          if (header) { if (!header.matches("button") && !header.hasAttribute("tabindex")) header.setAttribute("tabindex", "-1"); header.focus({ preventScroll: true }); }
        }
      }
      if (!open) columnsOpener = null;
      if (open) {
        // No toolbar button any more: hang the panel under the grid header's
        // left edge, where the right-click that opened it happened - clamped to
        // the viewport on both axes, with the height that is actually left
        // below it (the panel scrolls internally past that).
        positionColumnsPanel(panel);
        const first = panel.querySelector("input");
        if (first) first.focus({ preventScroll: true });
      }
    }
    function positionColumnsPanel(panel) {
      const gridEl = document.getElementById("myGrid");
      const wrap = panel.parentElement;
      if (!gridEl || !wrap) return;
      const g = gridEl.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      let top = g.top + 34;
      // Height budget: the room under the header, or - when that is too little
      // (rule builder expanded on a short viewport) - the whole viewport with
      // the panel moved up so its bottom stays on screen. Never off the bottom.
      let room = vh - top - 12;
      if (room < 160) {
        room = Math.max(120, vh - 24);
        top = 12;
      }
      panel.style.setProperty("--cp-max-h", Math.round(room) + "px");
      panel.style.top = Math.round(top - w.top) + "px";
      panel.style.left = Math.round(g.left - w.left) + "px";
      // Measure after the cap applied, then pull the panel back inside on both axes.
      const r = panel.getBoundingClientRect();
      const overY = r.bottom - (vh - 8);
      if (overY > 0) panel.style.top = Math.round(Math.max(8 - w.top, top - w.top - overY)) + "px";
      const overX = r.right - (window.innerWidth - 8);
      if (overX > 0) panel.style.left = Math.round(Math.max(8 - w.left, g.left - w.left - overX)) + "px";
    }
    (function wireColumnsPanel() {
      const panel = document.getElementById("columnsPanel");
      if (!panel) return;
      scope.listen(window, "resize", function () { if (!panel.hidden) positionColumnsPanel(panel); });
      // After a show/hide: save, re-measure, re-fit the columns, redraw.
      function applyHiddenCols() {
        saveHiddenCols();
        effects.clearCellMeasurements();
        if (!syncResponsiveColumns()) grid.autosizeColumns();
        syncAbstractBounds();
        grid.invalidate();
        renderColumnsPanel();
      }
      scope.listen(panel, "change", function (e) {
        const cb = e.target.closest("input[data-col]");
        if (!cb || LOCKED_COLS.has(cb.dataset.col) || !columns.some(function (c) { return c.id === cb.dataset.col; })) return;
        if (cb.checked) userHiddenCols.delete(cb.dataset.col); else userHiddenCols.add(cb.dataset.col);
        applyHiddenCols();
        const again = panel.querySelector('input[data-col="' + window.CSS.escape(cb.dataset.col) + '"]');
        if (again) again.focus({ preventScroll: true });
      });
      scope.listen(panel, "click", function (e) {
        if (e.target.closest(".cp-close")) { setColumnsPanelOpen(false); return; }
        if (e.target.closest(".cp-reset")) {
          userHiddenCols.clear();
          applyHiddenCols();
        }
      });
      scope.listen(document, "mousedown", function (e) {
        if (!panel.hidden && !panel.contains(e.target)) setColumnsPanelOpen(false);
      });
      scope.listen(panel, "keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); setColumnsPanelOpen(false); }
      });
      // Right-click on any column header: the same chooser, where the reader
      // is already looking.
      if (grid.onHeaderContextMenu) {
        scope.subscribe(grid.onHeaderContextMenu, function (e) {
          e.preventDefault();
          setColumnsPanelOpen(true);
        });
      }
    })();

    // Coalesce bursts of resize requests into ONE animation frame, and split
    // cheap height handling from the expensive width-dependent work (column
    // autosize, keyword re-clamp, abstract remeasure). A ResizeObserver can
    // fire for dimensions our own resize just changed, so without the pending-
    // frame guard the handler re-entrantly reschedules itself; and a toolbar/
    // row-height change (width unchanged) shouldn't pay for column autosizing.
    var pendingResizeFrame = 0;
    var lastResizeWidth = -1;
    // Set by refitOnWidth(apply): the next pass that sees the grid's width
    // change runs apply() (the host's column change), starts every column from
    // its designed width and fits once - so the change lands together with the
    // width it was made for, in one painted fit. When the width never moves
    // (the change brought none), the pass runs after REFIT_WAIT anyway.
    var pendingRefit = null, refitTimer = 0, REFIT_WAIT = 400;
    function takeRefit() {
      var apply = pendingRefit;
      pendingRefit = null;
      if (refitTimer) { scope.clearTimeout(refitTimer); refitTimer = 0; }
      if (apply) apply();
      grid.getColumns().forEach(function (c) { if (DESIGN_WIDTHS[c.id]) c.width = DESIGN_WIDTHS[c.id]; });
    }
    // SlickGrid re-applies a header's width only when it MEASURES different -
    // and mid-transition a header measures its old width, so a header could
    // keep an earlier pass's width (or its design width) over the new cells.
    // Every width pass therefore writes each header's width from its column.
    function applyHeaderWidths() {
      var hs = document.querySelectorAll("#myGrid .slick-header-columns > .slick-header-column");
      var cols = grid.getColumns().filter(function (c) { return !c.hidden; });
      if (hs.length !== cols.length) return;
      var diff = grid.headerColumnWidthDiff || 0;
      for (var i = 0; i < hs.length; i++) {
        var px = Math.max(0, (cols[i].width || 0) - diff) + "px";
        if (hs[i].style.width !== px) hs[i].style.width = px;
      }
    }

    function resizeGrid() {
      var gridEl = document.getElementById("myGrid");
      var width = gridEl ? gridEl.clientWidth : -1;
      var widthChanged = width !== lastResizeWidth;
      lastResizeWidth = width;

      grid.resizeCanvas();                 // cheap; also covers height-only changes

      if (widthChanged) {
        var refitting = pendingRefit !== null;
        if (refitting) takeRefit();
        // Column widths can change here, which changes keyword wrapping - so drop
        // the clamp-decision cache; the invalidate + render below re-measures.
        effects.clearCellMeasurements();
        // syncResponsiveColumns autosizes itself when it changed the column set
        // or recalibrated the scrollbar; only redistribute again when it didn't.
        if (!syncResponsiveColumns()) grid.autosizeColumns();
        applyHeaderWidths();
        syncAbstractBounds();
        // The footer's tracks mirror the live column widths.
        effects.updateFooterTracks();
        // A width change can change how many rows each open abstract needs.
        effects.resizeAbstracts();
        // Only a width change alters cell content (wrapping, clamps, autosize),
        // so only then is the full row-DOM invalidate needed - invalidate()
        // already ends in a render. Height-only changes (rule builder toggling,
        // toolbar wrap) keep the row DOM and just re-render the new viewport.
        grid.invalidate();
      } else {
        grid.render();
      }
    }
    // Column drags (resize / reorder) change the tracks the footer sits on.
    if (grid.onColumnsResized) scope.subscribe(grid.onColumnsResized, function () { effects.updateFooterTracks(); });
    if (grid.onColumnsReordered) scope.subscribe(grid.onColumnsReordered, function () { effects.updateFooterTracks(); });

    // Coalesce resize requests into one pass. Both a frame callback AND a short
    // timeout are armed, because rAF is SUSPENDED while the tab / preview pane is
    // in the background: with the frame path alone, a request made while hidden
    // latched pendingResizeFrame forever and every later resize (filter, search,
    // grouping, column sync) was silently dropped for the rest of the session.
    // Whichever path fires first runs the resize and cancels the other.
    let pendingResizeTimer = 0;
    function requestGridResize() {
      if (pendingResizeFrame !== 0 || pendingResizeTimer !== 0) return;
      const run = function () {
        if (pendingResizeFrame !== 0) { scope.cancelAnimationFrame(pendingResizeFrame); pendingResizeFrame = 0; }
        if (pendingResizeTimer !== 0) { scope.clearTimeout(pendingResizeTimer); pendingResizeTimer = 0; }
        resizeGrid();
      };
      pendingResizeFrame = scope.frame(run);
      pendingResizeTimer = scope.timeout(run, 250);
    }

    /* Post-settle re-verify -------------------------------------------------
     * The grid mounts during page hydration, when its viewport may not have a
     * settled box yet: stylesheets can still be arriving and web fonts are not
     * ready. Measured in that state on a cold load, .slick-pane-top had an
     * inline height of 0, the viewport reported clientHeight 0, two rows were
     * rendered, the responsive column drop never applied (all 11 columns at
     * their design widths), and the canvas overflowed the viewport horizontally
     * - and it stayed that way, because nothing re-measures on its own: the
     * ResizeObserver had already fired for the box it has, and requestGridResize
     * only coalesces requests nobody makes again.
     *
     * So gate ONE corrective resize on the page actually having settled - window
     * load AND document.fonts.ready, then a post-layout frame - which is the
     * same whenSettled() pattern the grid uses to re-verify its own
     * header/body alignment. resizeGrid() is idempotent and skips the expensive
     * width-dependent half when the width hasn't changed, so on a warm load this
     * costs one resizeCanvas() and nothing else.
     * lastResizeWidth is forced stale first: the broken mount recorded the same
     * clientWidth it has now (the CONTAINER was fine; the viewport inside it was
     * not), so a plain call would take the width-unchanged fast path. */
    (function reverifyAfterSettle() {
      var ran = false;
      var loaded = document.readyState === "complete";
      var fontsDone = !(document.fonts && document.fonts.ready);
      function check() {
        if (!loaded || !fontsDone || ran) return;
        ran = true;
        var t = null;
        var completed = false;
        var go = function () {
          if (completed) return;
          completed = true;
          if (t !== null) { scope.clearTimeout(t); t = null; }
          lastResizeWidth = -1;      // force the full width-dependent pass
          resizeGrid();
        };
        scope.frame(function () { scope.frame(go); });
        t = scope.timeout(go, 300);
      }
      if (!loaded) scope.listen(window, "load", function () { loaded = true; check(); }, { once: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scope.guard(function () { fontsDone = true; check(); }));
      check();
    })();

    // The caret (expand) column is pinned first: nothing may sit left of it.
    // If a reorder drops another column before it, snap it back to index 0.
    if (grid.onColumnsReordered) {
      scope.subscribe(grid.onColumnsReordered, function () {
        var cols = grid.getColumns().slice();
        var i = -1;
        for (var k = 0; k < cols.length; k++) { if (cols[k].id === "expand") { i = k; break; } }
        if (i > 0) {
          var expandCol = cols.splice(i, 1)[0];
          cols.unshift(expandCol);
          grid.setColumns(cols);
        }
        syncMasterColumnOrder(cols);
        syncAbstractBounds();
        // A reorder moves the columns the drop's inner bounds follow: re-fit
        // the open drops (bounded to the ones in view; the rest are marked stale).
        if (effects.resizeAbstracts()) grid.invalidate();
        effects.reconcileAbstracts();
      });
    }

    scope.subscribe(grid.onColumnsResized, function () {
      // A manual column-drag resize changes wrapping widths, so the cached
      // clamp decisions no longer hold - drop them and let the next render
      // re-measure. Then re-fit the abstract bounds and any open drop.
      effects.clearCellMeasurements();
      syncAbstractBounds();
      if (effects.resizeAbstracts()) grid.invalidate();   // column-layout key changed -> geometry revision
      effects.reconcileAbstracts();   // re-fit open drops to the new width
    });

    // Re-fit the columns whenever the grid's box changes size for any reason
    // (window resize, zoom, font loading, layout settling after navigation),
    // not just on the window "resize" event.
    let lastGridWidth = 0;
    let lastGridHeight = 0;
    const gridResizeObserver = scope.observe(new window.ResizeObserver(scope.guard(function (entries) {
      const box = entries[0].contentRect;
      if (Math.abs(box.width - lastGridWidth) < 1 &&
          Math.abs(box.height - lastGridHeight) < 1) {
        return;
      }
      lastGridWidth = box.width;
      lastGridHeight = box.height;
      // A refit waiting for this width runs now, before the frame paints:
      // through the coalesced request it painted one frame of the new width
      // with the old columns.
      if (pendingRefit !== null) {
        if (pendingResizeFrame !== 0) { scope.cancelAnimationFrame(pendingResizeFrame); pendingResizeFrame = 0; }
        if (pendingResizeTimer !== 0) { scope.clearTimeout(pendingResizeTimer); pendingResizeTimer = 0; }
        resizeGrid();
        return;
      }
      requestGridResize();
    })));
    gridResizeObserver.observe(document.getElementById("myGrid"));

    // The first pass precedes row painting. Saved choices are already loaded.
    syncResponsiveColumns();
    scope.add(function () {
      openMetaDetails.clear();
      setColumnsPanelOpen(false);
    });
    return Object.freeze({
      requestResize: scope.guard(requestGridResize),
      // A column change that comes with a change of the grid's width: apply()
      // runs in the pass that first sees the new width (see pendingRefit).
      refitOnWidth: scope.guard(function (apply) {
        pendingRefit = apply;
        if (refitTimer) scope.clearTimeout(refitTimer);
        refitTimer = scope.timeout(function () {
          refitTimer = 0;
          if (pendingRefit === null) return;
          lastResizeWidth = -1;
          resizeGrid();
        }, REFIT_WAIT);
      }),
      renderSummary: scope.guard(hiddenColumnsSummary),
      summarySignature: scope.guard(hiddenColumnsSig)
    });
  }
  return Object.freeze({ create: create });
})();
