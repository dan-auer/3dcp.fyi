/* author-indices.js - an author's citation indices from a citation record:
   h, i10, g, e, o, m, hm. The author panel's Metrics over Time
   (author-panel.js) recompute them month by month.
   window.OAIndicesChart.compute({ records, yearsActive }) - records are
   { k: citations, a: authors }, sorted by descending k; yearsActive > 0.
   ponytail: k is always a counted integer (author-panel.js builds it), so no
   unknown-count guard - add one if a caller ever passes raw recorded counts.
   ========================================================================== */
(function () {
  "use strict";

  // h-index: with works sorted by descending citation count, it is the largest
  // rank h such that the h-th work still has at least h citations (k_(h) >= h).
  function hIndex(recs) {
    let h = 0;
    while (h < recs.length && recs[h].k > h) h++;
    return h;
  }

  // g-index: the largest g such that the top g works share at least g² citations
  // cumulatively (Σ k_(1..g) >= g²). With k non-increasing and r² growing, the
  // cumulative lead is unimodal, so the first failure ends it.
  function gIndex(recs) {
    let sum = 0, g = 0;
    for (let i = 0; i < recs.length; i++) {
      sum += recs[i].k;
      if (sum >= (i + 1) * (i + 1)) g = i + 1;
      else break;
    }
    return g;
  }

  // e-index: the "excess" citations of the h-core beyond what the h-index counts.
  // e² = Σ over the top-h works of (k - h); each of them has k >= h, so e² >= 0.
  function eIndex(recs, h) {
    let sum = 0;
    for (let i = 0; i < h; i++) sum += recs[i].k;
    return Math.sqrt(sum - h * h);
  }

  // hm-index (Schreiber 2008): a multiple-authorship correction to h that uses
  // FRACTIONAL ranks. Each work is weighted by 1/a (a = authors), so instead of
  // the integer rank r we accumulate an effective rank r_eff(j) = Σ_{i≤j} 1/a_i.
  // hm is the largest effective rank for which the work still has at least that
  // many citations (k_j ≥ r_eff(j)).
  function hmIndex(recs) {
    let reff = 0, hm = 0;
    for (let i = 0; i < recs.length; i++) {
      reff += 1 / (recs[i].a > 0 ? recs[i].a : 1);
      if (recs[i].k >= reff) hm = reff;
      else break;
    }
    return hm;
  }

  function compute(data) {
    const recs = data.records, h = hIndex(recs);
    return {
      h: h,
      i10: recs.filter((d) => d.k >= 10).length,   // works with at least 10 citations
      g: gIndex(recs),
      e: eIndex(recs, h),
      // o-index (Dorogovtsev & Mendes 2015): √(h · c_max); the first work is the most cited.
      o: h ? Math.sqrt(h * recs[0].k) : 0,
      m: h / data.yearsActive,                     // m-quotient: h per year active
      hm: hmIndex(recs)
    };
  }

  window.OAIndicesChart = { compute: compute };
})();
