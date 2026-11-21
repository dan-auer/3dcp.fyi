/* matrix-common.js - what the two citation matrices share: the author
 * matrix (author-panel.js) and the full adjacency matrix (adjacency-matrix.js).
 * Rows cite columns in both, read through the same hover bar and moved
 * through with the same pin-and-arrows keys. */
(function () {
  "use strict";

  // A record's authors as "; "-joined HTML, each person once. markOf(id) gives
  // a marked name's class ("" for plain bold), or null for an unmarked name;
  // short keeps the first, the last and the marked names and elides each run
  // between them with one "\u2026".
  function authorsHtml(authors, nameOf, markOf, short) {
    var esc = window.OATheme.escapeHtml, seen = new Set(), list = [];
    (Array.isArray(authors) ? authors : []).forEach(function (a) {
      var id = window.OAArticleStore.authorIdOf(a);
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      list.push({ a: a, id: id, mark: markOf(id) });
    });
    var last = list.length - 1, out = [], gap = false;
    list.forEach(function (x, i) {
      if (short && i && i !== last && x.mark == null) { if (!gap) out.push("\u2026"); gap = true; return; }
      gap = false;
      var name = esc(nameOf(x.a, x.id));
      out.push(x.mark == null ? name : "<b" + (x.mark ? ' class="' + x.mark + '"' : "") + ">" + name + "</b>");
    });
    return out.join("; ");
  }

  // Where an arrow key moves a pin at row r, column c (-1 on a header) in a
  // rows x cols grid. Left/right walk the row's citations, up/down the
  // column's; on a header the pin steps one place along it. nextInRow(r, from,
  // d) and nextInCol(c, from, d) give the next citation past from in
  // direction d, or -1. -> { r, c }, or null when there is none.
  function stepPin(key, r, c, rows, cols, nextInRow, nextInCol) {
    var d = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1, n;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (r < 0) return { r: r, c: Math.min(cols - 1, Math.max(0, c + d)) };
      n = nextInRow(r, c < 0 ? (d > 0 ? -1 : cols) : c, d);
      return n >= 0 ? { r: r, c: n } : null;
    }
    if (c < 0) return { r: Math.min(rows - 1, Math.max(0, r + d)), c: c };
    n = nextInCol(c, r < 0 ? (d > 0 ? -1 : rows) : r, d);
    return n >= 0 ? { r: n, c: c } : null;
  }

  window.OAMatrix = Object.freeze({ authorsHtml: authorsHtml, stepPin: stepPin });
})();
