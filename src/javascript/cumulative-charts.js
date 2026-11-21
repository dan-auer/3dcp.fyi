/* cumulative-charts.js - the entry screen's two cumulative charts: publications
 * and authors in the database, month by month.
 *
 * Drawn by the papers' graph metrics engine (influence.js), so they read like
 * the plots under an abstract: one chart in two columns, a header line per plot
 * (symbol + name, value), and the month the values show once in the section
 * head; a hover on either plot drives both. Opportunistic: a no-op unless
 * #oa-gate-charts-cols is on the page.
 *
 * Loaded by table-gate.js on a first visit, after the DOM is parsed and once
 * the figures (data/summary.json -> window.OA_SUMMARY, or the dataset itself
 * through window.OAArticleStore), d3 and influence.js (window.OAInfluence)
 * are in. The series are computed from the dataset - at deploy for the
 * summary file - nothing hand-maintained to go stale.
 */
(function () {
  "use strict";

  // influence.js metric definitions: running totals on their own linear scale.
  var METRICS = {
    publications: { scale: "count", unit: "", label: "\\(P(t)\\)", name: "Cumulative Publications", desc: "Cumulative publications (P): the papers in the database published up to each month." },
    authors: { scale: "count", unit: "", label: "\\(A(t)\\)", name: "Cumulative Authors", desc: "Cumulative authors (A): the distinct authors in the database with a paper up to each month." }
  };

  var cols = document.getElementById("oa-gate-charts-cols");
  var month = document.getElementById("oa-gate-month");
  if (!cols || !month || !window.OAInfluence) return;
  var s = (window.OA_SUMMARY && window.OA_SUMMARY.cumulative) || window.OAArticleStore.get().cumulativeSeries();
  if (!s) return;
  // rowHeight 80 gives 126px columns - mirrored by .oa-gate-charts-cols' min-height in index.html.
  var chart = window.OAInfluence.create(
    { date: s.start, influence: { publications: s.publications, authors: s.authors } },
    { columns: 2, metrics: METRICS, subject: "database totals", layout: { rowHeight: 80 },
      onMonth: function (m) { month.textContent = m; } });
  if (!chart) return;
  month.textContent = chart.lastMonth;
  for (var c = 0; c < chart.columnCount; c += 1) {
    var slot = document.createElement("div");
    slot.className = "oa-gate-chart";
    slot.style.height = chart.columnHeight(c) + "px";
    slot.appendChild(chart.node(c));
    cols.appendChild(slot);
  }
  // Each plot draws once its column has a width: on the next frame, or when
  // the engine's resize observer sees the column laid out (a cold load).
  requestAnimationFrame(chart.render);
  // Entering the table removes the gate. Free the chart with it: influence.js
  // otherwise holds the detached gate (and a resize observer) for the session
  // and repaints it on every theme change.
  var enter = document.getElementById("tableGateEnter");
  if (enter) enter.addEventListener("click", chart.destroy);
})();
