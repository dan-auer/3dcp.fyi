/* grid-keys.js - keyboard reach for the article table: one Tab stop per row
 * (roving tabindex), arrow keys between rows and cells, Enter / Space on group
 * headers, Enter on a row's links and buttons, and focus that stays on the
 * control when its row is rebuilt. attach(ctx) wires it to the grid; nothing
 * to call afterwards.
 */
(function () {
  "use strict";

  function attach(ctx) {
    const { grid, dataView, absRows, scope } = ctx;
    /* Roving tabindex ---------------------------------------------------
     * One Tab stop per logical row - its title. Inside a row, \u2190/\u2192 walk the
     * other controls (chevron, star, authors, venue, date, access, chips, DOI,
     * reference, PDF); \u2191/\u2193 jump to the neighbouring row's title. Every other
     * control is tabindex=-1, (re)applied after each render because SlickGrid
     * rebuilds row nodes on scroll. Without this a row was 10-15 Tab stops and
     * the grid could not be crossed on a keyboard. */
    const ROW_FOCUSABLE = 'a[href], button, [role="button"], [tabindex]:not(.slick-cell)';   // SlickGrid gives every cell tabindex=-1
    function rowFocusables(row) {
      const all = row.querySelectorAll(ROW_FOCUSABLE);
      const out = [];
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.disabled) continue;
        if (el.closest(".abs-drop")) continue;
        if (el.offsetParent === null && el.getClientRects().length === 0) continue;   // clamped away
        out.push(el);
      }
      return out;
    }
    function rowStopEl(row) { return row.querySelector(".title-link") || rowFocusables(row)[0] || null; }
    // SlickGrid makes its two focus sinks, its panes, viewports and canvases
    // Tab stops that show no focus: five invisible stops on the way into the
    // table and one after it. tabindex -1 takes them out of the Tab order;
    // a click or a script can still focus them.
    (function dropContainerStops() {
      const box = grid.getContainerNode();
      const stops = Array.prototype.filter.call(box.children, function (el) { return el.getAttribute("tabindex") === "0"; })
        .concat(Array.prototype.slice.call(box.querySelectorAll(".slick-viewport, .grid-canvas")));
      for (let i = 0; i < stops.length; i++) stops[i].setAttribute("tabindex", "-1");
    })();
    // Group header whose disclosure should regain focus after the rebuild its
    // toggle caused (SlickGrid recreates the row DOM, so the button is new).
    let pendingGroupFocus = null;
    function groupToggleAt(row) {
      const cell = grid.getCellNode(row, 0);
      return cell ? cell.querySelector(".slick-group-toggle") : null;
    }
    // Tab follows the page order, and SlickGrid adds each row it draws at the
    // end of the canvas: after a scroll up, the rows drawn above sat after the
    // others, and Shift+Tab jumped out of the table. Each such row is put back
    // in screen order. Only rows drawn just now are moved (the ones already in
    // order stay, so an open abstract keeps its scroll position), and never
    // the row holding focus: moving it would drop the focus.
    function keepRowOrder(canvas) {
      const kids = Array.prototype.filter.call(canvas.children, function (el) { return el.hasAttribute("data-row"); });
      const placed = [];
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i], n = Number(el.getAttribute("data-row"));
        const last = placed[placed.length - 1];
        if (!last || n > Number(last.getAttribute("data-row")) || el.contains(document.activeElement)) { placed.push(el); continue; }
        let at = 0;
        while (Number(placed[at].getAttribute("data-row")) < n) at++;
        canvas.insertBefore(el, placed[at]);
        placed.splice(at, 0, el);
      }
    }
    function applyRovingTabindex() {
      const canvas = grid.getCanvasNode();
      keepRowOrder(canvas);
      const rows = canvas.querySelectorAll(".slick-row.oa-row-head");
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.__roving) continue;
        row.__roving = true;
        const stop = rowStopEl(row);
        const els = row.querySelectorAll(ROW_FOCUSABLE);
        for (let k = 0; k < els.length; k++) {
          if (els[k].closest(".abs-drop")) continue;
          els[k].setAttribute("tabindex", els[k] === stop ? "0" : "-1");
        }
      }
      // The provider renders each group's disclosure as an unfocusable span
      // (aria-expanded already set). Make it a keyboard stop: one per group
      // row, matching the one stop per data row.
      const groups = canvas.querySelectorAll(".slick-row.slick-group");
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        if (g.__roving) continue;
        g.__roving = true;
        const tg = g.querySelector(".slick-group-toggle");
        if (!tg) continue;
        tg.setAttribute("tabindex", "0");
        tg.setAttribute("role", "button");
        // The label (.oa-catgrp-t, plus the chip's abbreviation under category
        // grouping) and the count (.oa-catgrp-n) are separate elements with no
        // separator in textContent: read each by its own hook and join with a
        // middle dot - "Group 2024 \u00b7 312 entries".
        const titleEl = g.querySelector(".slick-group-title") || g;
        const clean = (el) => (el ? (el.textContent || "") : "").replace(/\s+/g, " ").trim();
        const chip = clean(titleEl.querySelector(".oa-catgrp-chip"));
        const label = clean(titleEl.querySelector(".oa-catgrp-t"));
        const count = clean(titleEl.querySelector(".oa-catgrp-n"));
        const parts = (label || count) ? [[chip, label].filter(Boolean).join(" "), count].filter(Boolean) : [clean(titleEl)];
        tg.setAttribute("aria-label", "Group " + parts.join(" \u00b7 ") + ": expand or collapse");
      }
      if (pendingGroupFocus != null) {
        const key = pendingGroupFocus;
        pendingGroupFocus = null;
        const range = grid.getRenderedRange();
        for (let r = Math.max(0, range.top); r <= range.bottom; r++) {
          const it = grid.getDataItem(r);
          if (it && it.__group && it.groupingKey === key) {
            const tg = groupToggleAt(r);
            if (tg) tg.focus({ preventScroll: true });
            break;
          }
        }
      }
      refocusAfterActivation();
    }
    scope.subscribe(grid.onRendered, applyRovingTabindex);

    /* Enter, and focus after a keyboard activation ----------------------
     * SlickGrid's canvas key handler takes a plain Enter for cell editing and
     * cancels it even with editing off, so Enter on a title, author, keyword,
     * chevron, star or abstract link did nothing. Keep Enter from reaching it:
     * links and buttons then activate natively, and the spans that act as
     * buttons (venue, date, access, category, "+N") take Enter in
     * grid-actions.js, which listens in the capture phase for that reason.
     * An activation usually re-renders the row (an abstract opens, a star
     * fills, the list narrows) and SlickGrid replaces the row's nodes, which
     * dropped focus on <body>: the next Tab started over at the top of the
     * page. The control is remembered by its article (or its open abstract),
     * its column, and its kind and data (the same keyword chip, the same
     * author), and focused again once the grid has rendered. If its column
     * went away, the row's title takes focus; if the article is no longer on
     * screen, the first row's title. */
    const REFOCUS_MS = 2000;
    let pendingRefocus = null;
    // "A.keyword-link|data-keyword=#cement": the same control in a rebuilt row.
    function controlKey(el) {
      let key = el.tagName + "." + (el.classList[0] || "");
      for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        if (a.name.indexOf("data-") === 0) key += "|" + a.name + "=" + a.value;
      }
      return key;
    }
    function nthLike(box, key) {
      return Array.prototype.filter.call(box.querySelectorAll(ROW_FOCUSABLE), function (el) { return controlKey(el) === key; });
    }
    // fallback: when the article is no longer on screen, the first row's title
    // takes focus (an activation can narrow the list); without it, nothing does.
    function rememberActivation(el, event, fallback) {
      const drop = el.closest("[data-abs-drop]");
      const box = drop || el.closest(".slick-cell");
      const at = drop ? null : grid.getCellFromEvent(event);
      const item = at ? grid.getDataItem(at.row) : null;
      if (!box || (!drop && (!item || item.__group || item.id == null))) return;
      const key = controlKey(el);
      pendingRefocus = {
        drop: drop ? drop.getAttribute("data-abs-drop") : null,
        id: item ? item.id : null,
        column: at ? grid.getColumns()[at.cell].id : null,
        key: key,
        nth: nthLike(box, key).indexOf(el),
        el: el,
        fallback: fallback !== false,
        until: Date.now() + REFOCUS_MS
      };
    }
    function activationTarget(p) {
      const canvas = grid.getCanvasNode();
      if (p.drop != null) {
        const drop = canvas.querySelector('[data-abs-drop="' + CSS.escape(p.drop) + '"]');
        const same = drop ? nthLike(drop, p.key)[p.nth] : null;
        if (same) return same;
      } else {
        const range = grid.getRenderedRange();
        const ci = grid.getColumnIndex(p.column);
        for (let r = Math.max(0, range.top); r <= range.bottom; r++) {
          const it = grid.getDataItem(r);
          const first = it && it.id === p.id ? grid.getCellNode(r, 0) : null;
          const row = first && first.parentNode;
          if (!row || !row.classList.contains("oa-row-head")) continue;
          const cellNode = ci == null ? null : grid.getCellNode(r, ci);
          return (cellNode && nthLike(cellNode, p.key)[p.nth]) || rowStopEl(row);
        }
      }
      if (!p.fallback) return null;
      const view = grid.getViewport();
      for (let r = Math.max(0, view.top); r <= view.bottom; r++) {
        const node = grid.getCellNode(r, 0);
        const row = node && node.parentNode;
        if (row && row.classList.contains("oa-row-head")) return rowStopEl(row);
      }
      return null;
    }
    // Followed for every render within REFOCUS_MS: one activation can rebuild
    // the row more than once (an opened abstract is re-measured a frame later).
    function refocusAfterActivation() {
      const p = pendingRefocus;
      if (!p) return;
      if (Date.now() > p.until) { pendingRefocus = null; return; }
      const active = document.activeElement;
      if (active && active !== document.body) {
        // Focus moved on (a dialog, the next Tab): stop following the control.
        if (active !== p.el) pendingRefocus = null;
        return;
      }
      const el = activationTarget(p);
      if (el) { p.el = el; el.focus({ preventScroll: true }); }
    }
    function handleActivationKey(event) {
      const enter = event.key === "Enter";
      if (!enter && event.key !== " ") return;
      const t = event.target;
      if (!t.closest || !t.closest(".grid-canvas")) return;
      if (!t.matches(ROW_FOCUSABLE) || t.matches(".slick-group-toggle, input, textarea, select")) return;
      // SlickGrid cancels Enter unless Ctrl, Alt or Shift is held.
      if (enter && !event.ctrlKey && !event.altKey && !event.shiftKey) event.stopPropagation();
      // Space on a link scrolls, as anywhere else, and a modified Enter on a
      // link is the browser's new-tab or new-window gesture: the row stays.
      const modified = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
      if (t.matches("a") && (!enter || modified)) return;
      rememberActivation(t, event);
    }
    scope.listen(document.getElementById("myGrid"), "keydown", handleActivationKey, true);
    // Tab or an arrow key moves focus to the next row; the rows it scrolls in
    // are measured, and when one is taller or shorter than estimated, every
    // row is rebuilt (oa-abstract-rows.js, fitRows) - the one holding focus
    // too, which dropped focus on <body> every 8 to 44 rows. So a control that
    // takes keyboard focus in the table is followed the same way, but only
    // within its own article: if that scrolled away, focus is not moved
    // elsewhere. A click's focus is left as it was (no :focus-visible).
    function followFocus(event) {
      const t = event.target;
      if (pendingRefocus && pendingRefocus.el === t) return;   // the refocus itself
      if (!t.closest || !t.closest(".grid-canvas") || !t.matches(ROW_FOCUSABLE)) return;
      let keyboard = true;
      try { keyboard = t.matches(":focus-visible"); } catch (e) { /* older engine: follow it */ }
      if (keyboard) rememberActivation(t, event, false);
    }
    scope.listen(document.getElementById("myGrid"), "focusin", followFocus);
    // Enter / Space on a group's disclosure opens or closes THAT group and
    // keeps focus on it across the rebuild.
    function handleGroupKey(event) {
      if (!event.target.classList.contains("slick-group-toggle")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const cell = grid.getCellFromEvent(event);
      const item = cell ? grid.getDataItem(cell.row) : null;
      if (!item || !item.__group || item.groupingKey == null) return;
      event.preventDefault();
      event.stopPropagation();
      pendingGroupFocus = item.groupingKey;
      if (item.collapsed) dataView.expandGroup(item.groupingKey);
      else dataView.collapseGroup(item.groupingKey);
    }
    scope.listen(document.getElementById("myGrid"), "keydown", handleGroupKey, true);
    function handleRowNavigation(event) {
      const k = event.key;
      if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "ArrowUp" && k !== "ArrowDown") return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const t = event.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const row = t.closest(".slick-row.oa-row-head") || t.closest(".slick-row.slick-group");
      if (!row) return;
      if (k === "ArrowLeft" || k === "ArrowRight") {
        const els = rowFocusables(row);
        const at = els.indexOf(t);
        if (at < 0) return;
        const next = els[at + (k === "ArrowRight" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        next.focus({ preventScroll: true });
        return;
      }
      // Consume row arrows even at the first/last logical data row: neither
      // SlickGrid's cell navigation nor the page scroller should take over.
      event.preventDefault();
      event.stopPropagation();
      const current = grid.getCellFromEvent(event);
      if (!current) return;
      // Group headers are stops of their own on the way up / down.
      const targetRow = absRows.adjacentDataRow(current.row, k === "ArrowDown" ? 1 : -1, true);
      if (targetRow === null) return;
      // Make the whole data band visible. Its title can overflow several fine
      // rows, and requesting only its first fine row can clip the title at the
      // viewport's bottom edge. Finish at the head for very short viewports.
      grid.scrollRowIntoView(targetRow + absRows.headSpanAt(targetRow) - 1, false);
      grid.scrollRowIntoView(targetRow, false);
      grid.render();
      const targetItem = grid.getDataItem(targetRow);
      if (targetItem && targetItem.__group) {
        const tg = groupToggleAt(targetRow);
        if (tg) tg.focus({ preventScroll: true });
        return;
      }
      const titleColumn = grid.getColumnIndex("title");
      const cell = titleColumn == null ? null : grid.getCellNode(targetRow, titleColumn);
      const stop = cell && cell.querySelector(".title-link");
      if (stop) stop.focus({ preventScroll: true });
    }
    // Capture before SlickGrid's canvas key handler; the title links and other
    // controls remain native keyboard targets for every unhandled key.
    scope.listen(document.getElementById("myGrid"), "keydown", handleRowNavigation, true);
  }

  window.OAGridKeys = Object.freeze({ attach: attach });
})();
