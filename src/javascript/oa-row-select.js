/* oa-row-select.js - Excel-style row marking for the SlickGrid tables.
 *
 * Plain click keeps its existing page behaviour and only re-anchors (it never
 * changes the selection); Shift+click selects the whole range from the anchor
 * (with no anchor yet, just the clicked row); pressing the mouse on a row and
 * DRAGGING across rows selects everything passed over. No modifier-click
 * shortcuts. Selection is a Set of article ids, painted via the abstract
 * overlay's rowClass hook ("oa-row-sel" on the logical head row).
 *
 * window.OARowSelect.attach(cfg) -> controller
 *   cfg.host        grid container element (listeners bind here)
 *   cfg.absRows     abstract-rows controller (its itemFromEvent)
 *   cfg.orderedRows () => [{ key, id }, ...] one entry per DISPLAYED row, in
 *                   order, memoized (a new array = a new order); key tells
 *                   duplicate rows of one article apart (category grouping
 *                   shows a paper once per category)
 *   cfg.repaint     () => void - invalidate+render the grid (bulk changes)
 *   cfg.repaintIds  (ids) => void - targeted repaint for small diffs
 *   cfg.onChange    (count) => void - badge sync
 * controller: { has(id), count(), ids(), clear(), retain(keep), rowClass(item),
 *               destroy(), handleClick(event) -> bool (true = consumed, skip row toggle) }
 * ponytail: one caller (articles-grid.js), whose lifecycle scope destroys the
 * controller before any re-attach - no per-host registry.
 */
(function () {
  "use strict";

  var EXCLUDE = "a, button, input, select, textarea, .filter-affordance, .oa-link, .abs-detail, .slick-header";
  // Shift+click is ALWAYS the range gesture, even over a chip, a title link or
  // an icon button: the row is the target, not the thing under the pointer.
  // Only places with no row identity (the header, an open abstract card) and
  // real text fields are exempt. Without this, a shift+click on a title fell
  // through to the browser, which painted a native text-selection streak down
  // the rows (and could open the link in a new window).
  var EXCLUDE_SHIFT = "input, select, textarea, .abs-detail, .slick-header";

  function unselectText() { var s = window.getSelection(); if (s) s.removeAllRanges(); }

  function attach(cfg) {
    var destroyed = false, repaintTimer = 0;
    var set = new Set();
    var anchor = null;        // { key, id } of the row a Shift range starts from
    var drag = null;          // { startKey, startId, range } while the button is down
    var dragging = false;     // true once the pointer crossed to another row
    var suppressClick = false;
    var lastMoveKey = null;
    var pendingIds = new Set();
    var pendingBulk = false;
    var orderRows = null;     // the orderedRows() array orderIndex was built from
    var orderIndex = null;    // row key -> display position

    function itemFrom(e) { return cfg.absRows.itemFromEvent(e); }
    // Which displayed row this is - not which article: a category clone and the
    // paper's other appearances are different rows of the same id.
    function keyOf(item) { return item._rowKey || item.id; }
    function changedIds(ids) {
      if (!ids.length) return;
      if (!pendingBulk) {
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          // A second toggle before the paint cancels the first one.
          if (pendingIds.has(id)) pendingIds.delete(id);
          else pendingIds.add(id);
          if (pendingIds.size > 40) {
            pendingBulk = true;
            pendingIds.clear();
            break;
          }
        }
      }
      if (repaintTimer) return;
      // Coalesce both painting and badge/action updates. The selected Set is
      // synchronous, so consumers still read the current state during a drag.
      // A macrotask also runs when animation frames are suspended in a tab.
      repaintTimer = setTimeout(function () {
        repaintTimer = 0;
        var ids = Array.from(pendingIds), bulk = pendingBulk;
        pendingIds.clear();
        pendingBulk = false;
        cfg.onChange(set.size);
        if (bulk) cfg.repaint();
        else if (ids.length) cfg.repaintIds(ids);
      }, 0);
    }
    function changed(prev) {
      // Full differences are reserved for one-shot replacement operations.
      // Drag moves already know their changed IDs.
      var diff = [];
      prev.forEach(function (id) { if (!set.has(id)) diff.push(id); });
      set.forEach(function (id) { if (!prev.has(id)) diff.push(id); });
      changedIds(diff);
    }
    function clear() {
      if (!set.size) return;
      var prev = set;
      set = new Set();
      anchor = null;
      changed(prev);
    }
    // Keep only the ids keep(id) accepts. The host prunes to the current result
    // set, so a filter or search never leaves hidden rows marked.
    function retain(keep) {
      if (!set.size) return;
      var prev = set, next = new Set();
      set.forEach(function (id) { if (keep(id)) next.add(id); });
      if (next.size === prev.size) return;
      set = next;
      if (anchor && !keep(anchor.id)) anchor = null;
      changed(prev);
    }
    // Reindex only after a filter/sort/group/fold change. Ranges run over
    // displayed rows; they become article ids only once collected.
    function ordered() {
      var rows = cfg.orderedRows();
      if (rows !== orderRows) {
        orderRows = rows;
        orderIndex = new Map();
        for (var i = 0; i < rows.length; i++) orderIndex.set(rows[i].key, i);
      }
      return rows;
    }
    function rangeBounds(aKey, bKey) {
      var ia = orderIndex.get(aKey), ib = orderIndex.get(bKey);
      if (ia === undefined || ib === undefined) return null;
      return { lo: Math.min(ia, ib), hi: Math.max(ia, ib) };
    }
    // counts: how many rows of each id lie inside the range, so a drag that
    // moves one appearance of a paper out keeps it while another is still in.
    function selectRange(aKey, bKey, bId) {
      var rows = ordered(), bounds = rangeBounds(aKey, bKey);
      var next = new Set(), counts = new Map();
      if (!bounds) next.add(bId);
      else for (var i = bounds.lo; i <= bounds.hi; i++) {
        var id = rows[i].id;
        counts.set(id, (counts.get(id) || 0) + 1);
        next.add(id);
      }
      var prev = set;
      set = next;
      changed(prev);
      return bounds ? { rows: rows, lo: bounds.lo, hi: bounds.hi, counts: counts } : null;
    }
    function dragRange(key, id) {
      var rows = ordered(), bounds = rangeBounds(drag.startKey, key);
      var previous = drag.range;
      // First move (or changed source order) establishes the base once.
      if (!bounds || !previous || previous.rows !== rows) {
        drag.range = selectRange(drag.startKey, key, id);
        return;
      }
      var diff = [], counts = previous.counts;
      function remove(lo, hi) {
        for (var i = lo; i <= hi; i++) {
          var value = rows[i].id, n = (counts.get(value) || 0) - 1;
          if (n > 0) { counts.set(value, n); continue; }
          counts.delete(value);
          if (set.delete(value)) diff.push(value);
        }
      }
      function add(lo, hi) {
        for (var i = lo; i <= hi; i++) {
          var value = rows[i].id;
          counts.set(value, (counts.get(value) || 0) + 1);
          if (!set.has(value)) { set.add(value); diff.push(value); }
        }
      }
      // Symmetric difference of the old/new intervals. Crossing the anchor,
      // shrinking, and jumping over rows each touch only the changed tails.
      remove(previous.lo, Math.min(previous.hi, bounds.lo - 1));
      remove(Math.max(previous.lo, bounds.hi + 1), previous.hi);
      add(bounds.lo, Math.min(bounds.hi, previous.lo - 1));
      add(Math.max(bounds.lo, previous.hi + 1), bounds.hi);
      previous.lo = bounds.lo;
      previous.hi = bounds.hi;
      changedIds(diff);
    }

    /* ---- drag-select (move/up listen only while the button is down) ---- */
    function onMove(e) {
      var item = itemFrom(e);
      if (!item) return;
      var key = keyOf(item);
      if (key === lastMoveKey) return;
      lastMoveKey = key;
      if (!dragging) {
        dragging = suppressClick = true;
        cfg.host.classList.add("is-rowdrag");
        unselectText();
      }
      dragRange(key, item.id);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      if (dragging) {
        cfg.host.classList.remove("is-rowdrag");
        anchor = { key: drag.startKey, id: drag.startId };
        // A drag that ends OUTSIDE the grid fires no click on it, so the flag
        // would otherwise swallow the next real row click. The click for this
        // gesture (if any) has already dispatched by the time this macrotask runs.
        setTimeout(function () { suppressClick = false; }, 0);
      }
      drag = null;
      dragging = false;
      lastMoveKey = null;
    }
    function onDown(e) {
      // Shift is a CLICK gesture (handled in handleClick), but the browser's own
      // shift+mousedown extends a native text selection from the last caret
      // position across every row in between - accent-on-white streaks through
      // the titles and authors that outlive the range selection. Cancel that
      // default here; the range select still happens on the click.
      if (e.shiftKey) {
        if (e.target.closest(EXCLUDE_SHIFT) || !itemFrom(e)) return;
        e.preventDefault();
        unselectText();
        return;
      }
      if (e.button !== 0 || e.target.closest(EXCLUDE)) return;
      var item = itemFrom(e);
      if (!item) return;
      drag = { startKey: keyOf(item), startId: item.id };
      dragging = false;   // a mouseup lost outside the window left it set
      lastMoveKey = drag.startKey;
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    }
    cfg.host.addEventListener("mousedown", onDown);

    /* ---- click gestures (called from the page's grid click delegate) ---- */
    function handleClick(e) {
      if (destroyed) return false;
      if (suppressClick) { suppressClick = false; return true; }   // tail of a drag
      if (e.target.closest(e.shiftKey ? EXCLUDE_SHIFT : EXCLUDE)) return false;
      var item = itemFrom(e);
      if (!item) return false;
      var key = keyOf(item);
      if (e.shiftKey) {
        e.preventDefault();
        // An anchor row that is no longer displayed (filtered out, folded
        // away) has no position: the range is then just the clicked row.
        selectRange(anchor ? anchor.key : key, key, item.id);
        return true;
      }
      // Plain click is the READING gesture (it opens the abstract): it only
      // re-anchors a later Shift range and never changes the selection.
      // Selecting here made Export / Open all quietly act on the one row
      // opened for reading instead of the filtered list.
      anchor = { key: key, id: item.id };
      return false;
    }

    function destroy() {
      destroyed = true;
      cfg.host.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      cfg.host.classList.remove("is-rowdrag");
      clearTimeout(repaintTimer);
      set.clear();
    }
    return {
      destroy: destroy,
      has: function (id) { return set.has(id); },
      count: function () { return set.size; },
      ids: function () { return Array.from(set); },
      clear: clear,
      retain: retain,
      rowClass: function (item) { return item && set.has(item.id) ? "oa-row-sel" : ""; },
      handleClick: handleClick
    };
  }

  window.OARowSelect = { attach: attach };
})();
