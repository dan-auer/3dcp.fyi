/* toc.js - the table-of-contents renderer for the abstract drop-downs
 * (oa-abstract-rows.js). Its markup carries .oa-ptoc, styled in article.css.
 *
 * Input is the shape data/toc_data.js stores: [ [section, "Title", page?], ... ]
 * where `section` is a number array giving both the heading number and the
 * depth ([2] -> "2", [2,1] -> "2.1" nested one level); the page is optional.
 *
 * Exposes:
 *   window.tocHtml(rows, options?)     -> HTML string
 * options.highlight(title) -> HTML string | null, to mark search hits in titles.
 * options.foldState        -> Map of section number ("3", "3.1") -> true when
 *                             the reader folded it, false when they opened it.
 *                             The drops re-run their formatter on every grid
 *                             render, so the caller owns this map: the DOM's
 *                             own aria-expanded is thrown away on each rebuild.
 * options.collapseBelowLevel -> default-fold any section at or below this depth.
 */
(function () {
  "use strict";

  var esc = window.OATheme.escapeHtml;

  // Flat rows -> nested { num, title, page, children } nodes.
  function tocFromTuples(rows) {
    const root = [];
    const byDepth = [];
    rows.forEach(function (row) {
      const section = Array.isArray(row[0]) ? row[0] : [row[0]];
      const depth = Math.max(1, section.length);
      const node = {
        num: section.join("."),
        title: row[1] != null ? String(row[1]) : "",
        page: row.length > 2 ? row[2] : null,
        children: []
      };
      const parent = depth > 1 ? byDepth[depth - 1] : null;
      if (parent) parent.children.push(node);
      else root.push(node);
      byDepth[depth] = node;
      byDepth.length = depth + 1;
    });
    return root;
  }

  function entryHtml(o, options) {
    let cls = "entry level-" + o.level;
    if (o.hasChildren) cls += " has-children";
    if (o.page == null || o.page === "") cls += " no-page";

    const toggle = o.hasChildren
      ? '<button class="toggle" type="button" aria-expanded="' + (o.collapsed ? "false" : "true") +
        '" aria-label="Toggle ' + esc(o.title) + '"></button>'
      : "";

    // Search hits are marked in titles where the caller supplies a highlighter.
    let title = null;
    if (options.highlight) {
      try { title = options.highlight(o.title); } catch (e) { title = null; }
    }

    // .body groups title + leader + page into the list's one flexible grid
    // column (see article.css .oa-ptoc: the number sits in its level's own
    // column, so sub-entries line up under their parent's text).
    return '<div class="' + cls + '">' + toggle +
      '<span class="num">' + esc(o.num) + "</span>" +
      '<span class="body">' +
      '<span class="title">' + (title || esc(window.OATypeset.text(o.title))) + "</span>" +
      '<span class="dots"></span>' +
      '<span class="page">' + (o.page != null ? esc(o.page) : "") + "</span>" +
      "</span></div>";
  }

  // Each list tells the stylesheet its depth: --l is the grid column its
  // numbers occupy, --lb the column its text starts in.
  function olOpen(level, hidden) {
    return '<ol style="--l:' + level + ";--lb:" + (level + 1) + '"' + (hidden ? " hidden" : "") + ">";
  }

  function itemsHtml(items, level, options) {
    let h = "";
    items.forEach(function (item) {
      const hasChildren = item.children.length > 0;
      // The reader's explicit choice wins; otherwise the caller's default-depth fold.
      const chosen = options.foldState ? options.foldState.get(item.num) : undefined;
      const collapsed = chosen !== undefined ? chosen
        : hasChildren && !!options.collapseBelowLevel && level >= options.collapseBelowLevel;
      h += "<li>" + entryHtml({
        num: item.num,
        title: item.title,
        page: item.page,
        level: level,
        hasChildren: hasChildren,
        collapsed: collapsed
      }, options);
      if (hasChildren) h += olOpen(level + 1, collapsed) + itemsHtml(item.children, level + 1, options) + "</ol>";
      h += "</li>";
    });
    return h;
  }

  // HTML string for a TOC. Empty string for a missing / empty TOC (records store
  // "" when there is none) so callers can concatenate it unconditionally.
  function tocHtml(rows, options) {
    if (!Array.isArray(rows) || !rows.length) return "";
    return olOpen(1, false) + itemsHtml(tocFromTuples(rows), 1, options || {}) + "</ol>";
  }

  // One delegated listener per page handles every TOC - the drops rebuild their
  // markup on each grid render, so per-node listeners would be re-attached (or
  // leak) constantly.
  document.addEventListener("click", function (event) {
    const hit = event.target.closest(".oa-ptoc .toggle, .oa-ptoc .has-children .title");
    if (!hit) return;
    const entry = hit.closest(".entry");
    const toggle = entry && entry.querySelector(".toggle");
    const childOl = entry && entry.parentElement && entry.parentElement.querySelector(":scope > ol");
    if (!toggle || !childOl) return;
    const nextExpanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(nextExpanded));
    childOl.hidden = !nextExpanded;
    // The fold must persist OUTSIDE this markup: folding changes the drop's
    // height, the overlay re-measures and re-runs the cell formatter, which
    // regenerates this list. The overlay owns the fold state (options.foldState).
    const drop = hit.closest(".abs-drop");
    const numEl = entry.querySelector(".num");
    if (drop && numEl) window.OAAbstractRows.tocToggled(drop, numEl.textContent, !nextExpanded);
  });

  window.tocHtml = tocHtml;
})();
