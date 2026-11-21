/* author-panel.js - author metrics in the page's right margin.
 * While an AUTHOR IS filter names one author (rule-editor authorFilterSlug),
 * the panel beside the table shows that author's Metrics over Time
 * and the Most Cited By / Cites Most lists. The host (articles-grid.js syncAuthorPanel) decides when; this
 * module owns the content. Metrics over Time are drawn by the papers' graph
 * metrics engine (influence.js), so both read alike. Chart code - d3,
 * influence.js, author-indices.js - loads on the first show.
 *
 * OAAuthorPanel.create(host, { apply(picks, replace), range(from, to) })
 *   -> { show(slug), setRange({ from, to } | null), destroy() }
 * range receives the interval a drag across the plots picked ("YYYY-MM").
 * apply receives rule picks [{ field, operator, value, ensure? }]: replace
 * swaps the rule set for them (a plain click), otherwise each is toggled onto
 * the current rules (right-click).
 */
(function () {
  "use strict";

  // The indices over time, in influence.js's metric-definition shape: each on
  // its own linear scale from zero (count), names in CMOS headline style.
  var METRICS = {
    publications:  { scale: "count", unit: "", curve: "step", label: "\\(P_{a}(t)\\)", name: "Publications", desc: "Publications (P): this author's works in the database by each month." },
    citations:     { scale: "count", unit: "", label: "\\(C_{a}(t)\\)", name: "Citations", desc: "Citations (C): the citations this author's works had received from works in the database by each month." },
    mean_citations:{ scale: "count", unit: "", decimals: 2, label: "\\(\\bar{c}_{a}(t)\\)", name: "Mean Citations", desc: "Mean citations (c\u0304): citations per work by each month." },
    h_index:       { scale: "count", unit: "", label: "\\(h(t)\\)", name: "h-Index", desc: "h-index: the largest h such that h of the works have at least h citations each." },
    hm_index:      { scale: "count", unit: "", decimals: 2, label: "\\(h_m(t)\\)", name: "hm-Index", nameHtml: "h<sub>m</sub>-Index", desc: "hm-index: the h-index with each work counted fractionally, divided by its number of authors." },
    i10_index:     { scale: "count", unit: "", label: "\\(i_{10}(t)\\)", name: "i10-Index", nameHtml: "i<sub>10</sub>-Index", desc: "i10-index: the works with at least 10 citations." },
    g_index:       { scale: "count", unit: "", label: "\\(g(t)\\)", name: "g-Index", desc: "g-index: the largest g such that the g most-cited works have at least g\u00B2 citations together." },
    e_index:       { scale: "count", unit: "", decimals: 2, label: "\\(e(t)\\)", name: "e-Index", desc: "e-index: the square root of the h-core's citations beyond the h\u00B2 the h-index counts." },
    o_index:       { scale: "count", unit: "", decimals: 2, label: "\\(o(t)\\)", name: "o-Index", desc: "o-index: the geometric mean of the h-index and the most-cited work's citations." },
    m_index:       { scale: "count", unit: "", decimals: 2, label: "\\(m(t)\\)", name: "m-Index", desc: "m-index: the h-index divided by the years active." }
  };
  var NOTE = "quantitative impact only - counts, citations and indices; a low number says nothing about the quality, rigor or significance of the work";
  var loading = null;

  function load() {
    if (loading) return loading;
    var A = window.OAAssets;
    loading = (window.d3 ? Promise.resolve() : A.loadScript(A.url("src/vendor/d3.v7.min.js"))).then(function () {
      var next = [];
      if (!window.OAInfluence) next.push(A.url("src/javascript/influence.js"));
      if (!window.OAIndicesChart) next.push(A.url("src/javascript/author-indices.js"));
      return A.loadScripts(next);
    }).then(function () {
      if (!window.OAInfluence || !window.OAIndicesChart) throw new Error("Author metrics did not load");
    });
    loading.catch(function () { loading = null; });   // a failed load stays retryable
    return loading;
  }

  var esc = window.OATheme.escapeHtml, fmt = window.OATheme.fmtNum;
  function nOf(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }
  function listUrl(q) {
    var rel = typeof window.OA_REL_ROOT === "string" ? window.OA_REL_ROOT : "";
    return rel + "index.html?q=" + encodeURIComponent(q);
  }
  function surnameOf(p) { return [p && p.prefix, p && p.lastName].filter(Boolean).join(" "); }
  // People carry their name fields from the article rows; the author records,
  // then the bare slug ("mechtcherine_viktor") are the fallbacks.
  function nameHtml(p, slug) {
    if (p && p.name) return esc(p.name);
    if (p && p.lastName) return "<b>" + esc(surnameOf(p)) + "</b>" + (p.firstName ? ", " + esc(p.firstName) : "");
    var known = (window.AUTHORS_DATA || {})[slug];
    if (known) return "<b>" + esc(surnameOf(known)) + "</b>" + (known.firstName ? ", " + esc(known.firstName) : "");
    var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
    var parts = String(slug || "").split("_").filter(Boolean);
    if (!parts.length) return esc(slug);
    return "<b>" + esc(cap(parts[0])) + "</b>" + (parts.length > 1 ? ", " + esc(parts.slice(1).map(cap).join(" ")) : "");
  }
  function plainName(p, slug) {
    if (p && p.name) return p.name;
    if (p && p.lastName) return surnameOf(p) + (p.firstName ? ", " + p.firstName : "");
    return String(slug || "").replace(/[_-]+/g, " ");
  }
  // Month index of a date (the store's monthOf); null without a month.
  function monthIndex(s) { return window.OAArticleStore.monthOf(s); }

  function create(host, actions) {
    host.innerHTML =
      '<section class="ap-sec" data-ap="series" hidden>' +
        '<h2 class="ap-h">Metrics over Time<span class="ap-h-aside" data-ap="month" title="Month of the values shown"></span></h2>' +
        '<p class="ap-sub" data-ap="seriesSub"></p>' +
        '<div class="ap-inf-key">' +
          '<span><svg width="20" height="6" aria-hidden="true"><line x1="0" y1="3" x2="20" y2="3"></line></svg>all citations</span>' +
          '<span title="Leaves out citations from works this author also wrote"><svg width="20" height="6" aria-hidden="true"><line x1="0" y1="3" x2="20" y2="3" stroke-dasharray="4 3"></line></svg>without self-citations</span>' +
          '<span title="Leaves out citations from works sharing any author with the cited work"><svg width="20" height="6" aria-hidden="true"><line x1="1" y1="3" x2="20" y2="3" stroke-dasharray="0.1 3" stroke-linecap="round"></line></svg>without shared authors</span>' +
        "</div>" +
        '<div class="ap-inf-cols" data-ap="charts"></div>' +
      "</section>" +
      '<section class="ap-sec" data-ap="people" hidden>' +
        '<div class="ap-people">' +
          '<div><h2 class="ap-h">Most Cited By</h2><p class="ap-sub" data-ap="citedByKey"></p><ul class="ap-list" data-ap="citedBy"></ul></div>' +
          '<div><h2 class="ap-h">Cites Most</h2><p class="ap-sub" data-ap="citesMostKey"></p><ul class="ap-list" data-ap="citesMost"></ul></div>' +
        "</div>" +
      "</section>" +
      '<p class="ap-msg" data-ap="msg" hidden></p>';

    function el(k) { return host.querySelector('[data-ap="' + k + '"]'); }
    var slug = "", shown = "", token = 0, chart = null, people = null, mine = "";
    var dateRange = null;   // the list's date filter, shaded on the plots

    // { from, to } ("YYYY-MM", either may be null) or null.
    function setRange(r) {
      dateRange = r && (r.from || r.to) ? r : null;
      if (chart) chart.setRange(dateRange && dateRange.from, dateRange && dateRange.to);
    }

    function message(text) {
      ["series", "people"].forEach(function (k) { el(k).hidden = true; });
      var m = el("msg");
      m.textContent = text;
      m.hidden = !text;
    }

    function show(next) {
      next = String(next || "").trim();
      if (!next) return;
      if (next === shown) {
        // Same author: only re-fit the chart (the panel may have been hidden
        // through a resize).
        if (chart) requestAnimationFrame(function () { if (chart) chart.fit(); });
        return;
      }
      slug = next;
      var my = ++token;
      if (!window.OAInfluence || !window.OAIndicesChart) message("Loading author metrics\u2026");
      load().then(function () {
        if (my === token && host.isConnected) render();
      }, function () {
        if (my === token) message("Author metrics could not be loaded.");
      });
    }

    function render() {
      var A = (window.AUTHORS_DATA || {})[slug];
      var store = window.OAArticleStore.get();
      shown = slug;
      if (dlg && dlg.open) dlg.close();
      if (chart) { chart.destroy(); chart = null; }
      if (!A || !store) { message("No metrics for this author."); return; }
      message("");
      mine = [surnameOf(A), A.firstName].filter(Boolean).join(", ") || "this author";
      var derived = store.authorSummary(slug);
      var span = derived.span || {};
      var firstMonth = monthIndex(span.first);

      // Metrics over Time, month by month from the first contribution to the
      // store's last month: P(t) the papers out by then, C(t) the in-corpus
      // citations they had by then (the citing rows' dates), and every index
      // recomputed from that month's record (author-indices.js).
      // A row that never leaves zero stays out.
      var record = {}, overlays = {}, lastMonth = store.monthAxis().last;
      if (firstMonth != null && lastMonth >= firstMonth) {
        // Each work's citing months three ways: every citation; without
        // self-citations (citing works this author also wrote); without shared
        // authors (citing works sharing any author with the cited one).
        var asc = function (a, b) { return a - b; };
        var works = derived.works.map(function (w) {
          var own = new Set((Array.isArray(w.authors) ? w.authors : []).map(authorIdOf));
          var all = [], noSelf = [], noShared = [];
          store.citationsOf(w.id).forEach(function (id) {
            var p = store.getById(id), mo = p ? monthIndex(p.date) : null;
            if (mo == null) return;
            var ids = (Array.isArray(p.authors) ? p.authors : []).map(authorIdOf);
            all.push(mo);
            if (ids.indexOf(slug) < 0) noSelf.push(mo);
            if (!ids.some(function (a) { return a && own.has(a); })) noShared.push(mo);
          });
          return { month: monthIndex(w.date), all: all.sort(asc), noSelf: noSelf.sort(asc), noShared: noShared.sort(asc),
            a: Array.isArray(w.authors) ? w.authors.length : 0, t: w.title || "" };
        });
        // Keys in display order, every metric recomputed month by month from
        // the citations one rule keeps.
        var seriesOf = function (rule) {
          var s = { publications: [], citations: [], meanK: [], hIndex: [], i10Index: [], gIndex: [], eIndex: [], oIndex: [], mIndex: [], hmIndex: [] };
          // Months only move forward: each work's count resumes where the
          // previous month left it.
          var at = works.map(function () { return 0; });
          for (var m = firstMonth; m <= lastMonth; m++) {
            var recs = [];
            works.forEach(function (w, i) {
              if (w.month == null || w.month > m) return;
              var cites = w[rule];
              while (at[i] < cites.length && cites[at[i]] <= m) at[i]++;
              recs.push({ k: at[i], a: w.a, t: w.t });
            });
            recs.sort(function (a, b) { return b.k - a.k; });
            var v = window.OAIndicesChart.compute({ records: recs, yearsActive: (m - firstMonth + 1) / 12 });
            var cTot = recs.reduce(function (sum, r) { return sum + r.k; }, 0);
            s.publications.push(recs.length);
            s.citations.push(cTot);
            s.meanK.push(recs.length ? cTot / recs.length : 0);
            s.hIndex.push(v.h); s.i10Index.push(v.i10); s.gIndex.push(v.g);
            s.eIndex.push(v.e); s.oIndex.push(v.o); s.mIndex.push(v.m); s.hmIndex.push(v.hm);
          }
          return [["publications", s.publications], ["citations", s.citations], ["mean_citations", s.meanK],
            ["h_index", s.hIndex], ["hm_index", s.hmIndex], ["i10_index", s.i10Index], ["g_index", s.gIndex],
            ["e_index", s.eIndex], ["o_index", s.oIndex], ["m_index", s.mIndex]];
        };
        var order = seriesOf("all"), orderNoSelf = seriesOf("noSelf"), orderNoShared = seriesOf("noShared");
        // A series that never leaves zero stays out. Every citation-based plot
        // also draws the two exclusions: dashed and dotted.
        order.forEach(function (o, i) {
          if (!o[1].some(function (x) { return x; })) return;
          record[o[0]] = o[1];
          if (o[0] !== "publications") overlays[o[0]] = [{ values: orderNoSelf[i][1], dash: "4 3" }, { values: orderNoShared[i][1], dash: "0.1 3", cap: "round" }];
        });
        var allC = order[1][1], lastC = allC[allC.length - 1] || 0;
        var globalC = derived.citations;
        el("seriesSub").textContent = "per month \u00b7 citations counted from the citing works' publication dates" +
          (globalC !== lastC ? " \u00b7 only citations from works in this database (" + fmt(lastC) + " of the " + fmt(globalC) + " recorded), so end points sit lower" : "") +
          " \u00b7 each metric on its own scale \u00b7 drag across a plot to list only that interval \u00b7 " + NOTE;
      }
      var charts = el("charts");
      charts.innerHTML = "";
      if (Object.keys(record).length) {
        // Two columns, as under a paper's abstract; one month readout in the
        // section head (the last data month, or the hovered one).
        var start = window.OAArticleStore.monthLabel(firstMonth);
        var monthEl = el("month");
        chart = window.OAInfluence.create({ date: start, influence: record }, {
          columns: 2, metrics: METRICS, subject: "author indices", overlays: overlays,
          onMonth: function (month) { monthEl.textContent = month; },
          // A drag across the plots filters the list to that interval.
          onRange: function (from, to) { if (actions.range) actions.range(from, to); }
        });
        if (chart && dateRange) chart.setRange(dateRange.from, dateRange.to);
      }
      el("series").hidden = !chart;
      if (chart) {
        el("month").textContent = chart.lastMonth;
        for (var c = 0; c < chart.columnCount; c += 1) {
          var slot = document.createElement("div");
          slot.className = "ap-inf-slot";
          slot.style.height = chart.columnHeight(c) + "px";
          slot.appendChild(chart.node(c));
          charts.appendChild(slot);
        }
        requestAnimationFrame(function () { if (chart) chart.render(); });
      }

      // Most Cited By / Cites Most, from the in-corpus citation graph (the rows'
      // refIds). Without that graph both lists stay out instead of reading "none".
      people = { derived: derived, graph: store.hasCitationGraph() };
      renderPeople();
      var scroller = host.closest(".author-panel");
      if (scroller) scroller.scrollTop = 0;
    }

    // Citations shown twice: all, and without shared authors.
    function renderPeople() {
      if (!people) return;
      var d = people.derived, citedBy = d.citedBy, citesMost = d.citesMost;
      var byId = function (rows) { var mp = new Map(); (rows || []).forEach(function (p) { mp.set(String(p.id || p.slug || ""), p.count || 0); }); return mp; };
      list(el("citedBy"), citedBy, "citedByAuthor", byId(d.citedBy), d.citedBySolo ? byId(d.citedBySolo) : null);
      list(el("citesMost"), citesMost, "citesAuthor", byId(d.citesMost), d.citesMostSolo ? byId(d.citesMostSolo) : null);
      el("people").hidden = !(people.graph && ((d.citedBy || []).length || (d.citesMost || []).length));
    }

    // Three numbers per person: this author's papers that cite (or are cited
    // by) the listed person - the filter lists exactly these -, the listed
    // person's papers on the other end, then the citation links between them
    // (opens the matrix). The key above each list names them in that order.
    function list(ul, rows, relation, allOf, soloOf) {
      var cites = relation === "citesAuthor";
      var field = cites ? "cites_author" : "cited_by_author";
      var key = el(cites ? "citesMostKey" : "citedByKey");
      // Most Cited By leads with their citing works, Cites Most with this author's citing works.
      key.textContent = (cites ? "citing works by " + mine + " / their cited works / citations"
        : "their citing works / cited works by " + mine + " / citations") + (soloOf ? " / without shared authors" : "");
      key.hidden = !(rows || []).length;
      ul.innerHTML = (rows || []).slice(0, 10).map(function (p) {
        var s = (p && (p.id || p.slug)) || "";
        var plain = plainName(p, s);
        var nOwn = p.count || 0, nPapers = p.papers == null ? nOwn : p.papers, nTheirs = p.theirs == null ? nPapers : p.theirs;
        var nCount = allOf && allOf.has(String(s)) ? allOf.get(String(s)) : nOwn;
        var nSolo = soloOf ? soloOf.get(String(s)) || 0 : null;
        var count = fmt(nCount), papers = fmt(nPapers);
        var times = nCount === 1 ? "once" : count + " times";
        // Most Cited By: their papers cite this author's works; Cites Most:
        // this author's papers cite theirs.
        var tip = esc(cites
          ? mine + " cites " + nOf(nTheirs, "work", "works") + " of " + plain + " in " + nOf(nPapers, "work", "works") + ", " + times
          : plain + " cites " + nOf(nPapers, "work", "works") + " of " + mine + " in " + nOf(nTheirs, "work", "works") + ", " + times) +
          (nSolo != null ? ", " + fmt(nSolo) + " without shared authors" : "");
        var mid = '<span class="ap-n-mid" title="' + tip + '">' + fmt(nTheirs) + "</span>";
        var solo = nSolo == null ? "" : '<span class="ap-n-solo" title="' + tip + '">' + fmt(nSolo) + "</span>";
        if (!s) return '<li><span class="ap-name">' + nameHtml(p, s) + '</span><span class="ap-n">' +
          (cites ? "<span>" + papers + "</span>" + mid : "<span>" + fmt(nTheirs) + '</span><span class="ap-n-mid" title="' + tip + '">' + papers + "</span>") +
          '<span class="ap-n-total">' + count + "</span>" + solo + "</span></li>";
        var q = 'author = "' + slug + '" AND ' + field + ' = "' + s + '"';
        // Second number: the listed person's works on the other end, as a filter too.
        var back = cites ? "citedByAuthor" : "citesAuthor", qBack = 'author = "' + s + '" AND ' + (cites ? "cited_by_author" : "cites_author") + ' = "' + slug + '"';
        var theirsA = '<a class="ap-n-link" href="' + esc(listUrl(qBack)) + '" data-relation="' + back + '" data-slug="' + esc(slug) + '" data-author="' + esc(s) +
          '" title="' + tip + '&#10;Click: list only these (+ ' + esc(plain) + ')&#10;Right-click: add to the current filters">' + fmt(nTheirs) + "</a>";
        var total = '<button type="button" class="ap-n-matrix' + (nSolo == null ? "" : " is-pair") + '" data-relation="' + relation +
          '" data-slug="' + esc(s) + '" title="' + tip + '&#10;Click: show the citation matrix"><span class="ap-n-total"><span class="ap-n-u">' + count + "</span></span>" +
          (nSolo == null ? "" : '<span class="ap-n-solo">' + fmt(nSolo) + "</span>") + "</button>";
        var mineA = '<a class="ap-n-link" href="' + esc(listUrl(q)) + '" data-relation="' + relation + '" data-slug="' + esc(s) +
          '" title="' + tip + '&#10;Click: list only these (+ author)&#10;Right-click: add to the current filters">' + papers + "</a>";
        var pair = cites ? mineA + '<span class="ap-n-mid">' + theirsA + "</span>" : theirsA + '<span class="ap-n-mid">' + mineA + "</span>";
        return '<li><a class="ap-name" href="' + esc(listUrl('AUTHOR IS "' + s + '"')) + '" data-ap-author="' + esc(s) +
          '" title="' + esc(plain) + '&#10;Click: show this author instead">' + nameHtml(p, s) + "</a>" +
          '<span class="ap-n">' + pair + total + "</span></li>";
      }).join("") || '<li class="ap-none">none</li>';
    }

    // Citation matrix behind a row's citation counts: rows cite columns.
    // Most Cited By - the listed person's papers (rows) citing this author's
    // works (columns); Cites Most - this author's works citing theirs. The
    // same edges and shared-author rule as the tally (article-store
    // tallyPeople), so the totals match the panel.
    var dlg = null, mx = null, scrim = null;
    function authorIdOf(a) { return window.OAArticleStore.authorIdOf(a); }
    function hasAuthor(row, id) { return (Array.isArray(row && row.authors) ? row.authors : []).some(function (a) { return authorIdOf(a) === id; }); }
    // Author list, the citing author accented and the cited author bold. Short
    // form when two lines do not hold it: first, those two, last, gaps as "…".
    function authorsHtml(p, citer, cited, short) {
      return window.OAMatrix.authorsHtml(p.authors, function (a, id) { return plainName(typeof a === "string" ? null : a, id); },
        function (id) { return id && id === citer ? "apm-both" : id && id === cited ? "" : null; }, short);
    }
    // One side of the readout: the slug, the title, then the authors.
    function paperCard(p, citer, cited) {
      var authors = authorsHtml(p, citer, cited, false);
      return '<div class="apm-ro-id">' + esc(p.id) + "</div>" +
        '<div class="apm-ro-t">' + esc(p.title || "") + "</div>" +
        '<div class="apm-ro-au">' + authors + "</div>";
    }
    function matrixOf(relation, other) {
      var store = window.OAArticleStore.get();
      if (!store || !people) return null;
      var citedBy = relation === "citedByAuthor";
      var rows = new Map(), cols = new Map(), edges = new Set(), shared = new Set();
      // Links through a paper both of them wrote - on either end - stay on the
      // grid, marked as shared rather than dropped.
      (people.derived.works || []).forEach(function (w) {
        var own = String(w.id), both = hasAuthor(w, other);
        (citedBy ? store.citationsOf(own) : store.referencesOf(own)).forEach(function (id) {
          var p = store.getById(id);
          if (!p || !hasAuthor(p, other)) return;
          var r = citedBy ? p : w, c = citedBy ? w : p, key = String(r.id) + "\n" + String(c.id);
          rows.set(String(r.id), r);
          cols.set(String(c.id), c);
          edges.add(key);
          if (both || hasAuthor(p, slug)) shared.add(key);
        });
      });
      var date = function (p) { return String((p && p.date) || ""); };
      var order = function (dir) { return function (a, b) { return dir * date(a).localeCompare(date(b)) || String(a.title || "").localeCompare(String(b.title || "")); }; };
      // Both chronological, oldest first: rows top to bottom, columns left to
      // right; the shaded "published later" corner sits top right.
      return { R: Array.from(rows.values()).sort(order(1)), C: Array.from(cols.values()).sort(order(1)), edges: edges, shared: shared, citedBy: citedBy };
    }
    function openMatrix(relation, other) {
      var m = matrixOf(relation, other);
      if (!m || !m.edges.size) return;
      var R = m.R, C = m.C, colAt = new Map();
      C.forEach(function (c, j) { colAt.set(String(c.id), j); });
      // Per row and column: every citation (A) and those without a shared author (S).
      var rowA = R.map(function () { return 0; }), rowS = R.map(function () { return 0; });
      var colA = C.map(function () { return 0; }), colS = C.map(function () { return 0; });
      var state = R.map(function (r, i) {
        var rid = String(r.id), rm = monthIndex(r.date);
        return C.map(function (c, j) {
          var cid = String(c.id), cm = monthIndex(c.date), key = rid + "\n" + cid;
          if (m.edges.has(key)) {
            rowA[i]++; colA[j]++;
            if (m.shared.has(key)) return "void";
            rowS[i]++; colS[j]++; return "cited";
          }
          if (rid === cid) return "same";
          return rm != null && cm != null && cm > rm ? "later" : "";
        });
      });
      // Shared-author links are always marked; rows and columns with nothing
      // else are muted, not removed.
      var sum = function (a) { return a.reduce(function (s, k) { return s + k; }, 0); };
      var n = sum(rowS);
      var mutedR = rowS.map(function (k) { return !k; }), mutedC = colS.map(function (k) { return !k; });
      var me = nameHtml(null, slug), them = nameHtml(null, other);
      var rowsBy = m.citedBy ? them : me, colsBy = m.citedBy ? me : them;
      var nE = m.edges.size;
      var times = nE === 1 ? " once, " + (n ? "without" : "with") + " shared authors." : " " + fmt(nE) + " times, " + fmt(n) + " of them without shared authors.";
      var head = '<div class="apm-head"><div>' +
        '<h2 class="apm-title" id="apmTitle">' + (m.citedBy ? them : me) + ' <span class="apm-verb">cites</span> ' + (m.citedBy ? me : them) + "</h2>" +
        '<p class="apm-sub">' + fmt(R.length) + (R.length === 1 ? " work" : " works") + " by " + rowsBy +
          (R.length === 1 ? " cites " : " cite ") + fmt(C.length) + (C.length === 1 ? " work" : " works") + " by " + colsBy + times + "</p>" +
        '<div class="apm-legend"><span><i class="apm-sw is-cited"></i>cites</span><span><i class="apm-sw is-same"></i>same work</span><span><i class="apm-sw is-later"></i>published later</span><span><i class="apm-sw is-void"></i>shared author</span></div>' +
        '</div><button type="button" class="apm-close" aria-label="Close" title="Close (Esc)">\u00d7</button></div>';
      var table = '<table class="apm-table"><colgroup><col>' + C.map(function (c, j) { return '<col data-c="' + j + '">'; }).join("") + "<col><col></colgroup>" +
        '<thead><tr class="apm-axr"><th class="apm-p1"></th><th colspan="' + C.length + '" scope="colgroup"><span class="apm-ax apm-ax-x">' + colsBy + "</span></th>" + '<th class="apm-rs apm-rs1"></th><th class="apm-rs apm-rs2"></th></tr>' +
        // Slugs scroll away; the number row below stays pinned.
        '<tr class="apm-tr"><th class="apm-p1"></th>' + C.map(function (c, j) {
          return '<th class="apm-ch' + (mutedC[j] ? " is-muted" : "") + '" data-c="' + j + '"><span class="apm-cl"><span class="apm-t">' + esc(c.id) + "</span></span></th>";
        }).join("") + '<th class="apm-rs apm-rs1"></th><th class="apm-rs apm-rs2"></th></tr>' +
        '<tr><th class="apm-corner" scope="col">Citing Author \u2193 \u00b7 Cited Author \u2192</th>' +
        C.map(function (c, j) {
          return '<th class="apm-ch' + (mutedC[j] ? " is-muted" : "") + '" scope="col" data-c="' + j + '">' + (j + 1) + "</th>";
        }).join("") +
        // Two sums per row too: every citation, and those left once shared authors are excluded.
        '<th class="apm-rs apm-rs1" scope="col" title="All citations">\u03a3</th><th class="apm-rs apm-rs2" scope="col" title="Shared authors excluded">\u03a3 excl.</th></tr></thead><tbody>' +
        R.map(function (r, i) {
          var also = colAt.has(String(r.id)) ? colAt.get(String(r.id)) + 1 : 0;
          return "<tr" + (mutedR[i] ? ' class="is-muted"' : "") + '><th class="apm-rh" scope="row" data-r="' + i + '"><span class="apm-rl"><span class="apm-t">' + esc(r.id) + "</span>" +
            (also ? '<span class="apm-tag" title="Also column ' + also + '">' + also + "</span>" : "") +
            '<span class="apm-n">' + (i + 1) + "</span></span></th>" +
            state[i].map(function (s, j) { return '<td data-r="' + i + '" data-c="' + j + '"' + (s ? ' class="is-' + s + '"' : "") + "></td>"; }).join("") +
            '<td class="apm-rs apm-rs1" data-r="' + i + '">' + fmt(rowA[i]) + '</td><td class="apm-rs apm-rs2' + (rowS[i] ? "" : " is-muted") + '" data-r="' + i + '">' + fmt(rowS[i]) + "</td></tr>";
        }).join("") +
        // Two sums per column: every citation, and those left once shared authors are excluded.
        '</tbody><tfoot><tr><th class="apm-rh" scope="row">Citations received</th>' +
        colA.map(function (k, j) { return '<td class="apm-cs' + (mutedC[j] ? " is-muted" : "") + '" data-c="' + j + '">' + fmt(k) + "</td>"; }).join("") +
        '<td class="apm-rs apm-rs1 apm-total">' + fmt(m.edges.size) + '</td><td class="apm-rs apm-rs2"></td></tr>' +
        '<tr><th class="apm-rh" scope="row">Shared authors excluded</th>' +
        colS.map(function (k, j) { return '<td class="apm-cs' + (k ? "" : " is-muted") + '" data-c="' + j + '">' + fmt(k) + "</td>"; }).join("") +
        '<td class="apm-rs apm-rs1"></td><td class="apm-rs apm-rs2 apm-total">' + fmt(sum(colS)) + "</td></tr></tfoot></table>";
      if (!dlg) {
        window.addEventListener("resize", onResize);
        dlg = document.createElement("dialog");
        dlg.className = "ap-matrix";
        dlg.setAttribute("aria-labelledby", "apmTitle");
        // A click on the backdrop lands on the dialog itself. A click on a cell
        // (or a row's or column's label or sum) pins the readout to it.
        dlg.addEventListener("click", function (e) {
          if (e.target === dlg || (e.target.closest && e.target.closest(".apm-close"))) { dlg.close(); return; }
          var t = cellOf(e.target);
          if (!t || !mx) return;
          if (mx.pin && mx.pin.r === t.r && mx.pin.c === t.c) setPin(null, t); else setPin(t);
        });
        dlg.addEventListener("mouseover", function (e) {
          if (!mx || mx.pin) return;
          var t = cellOf(e.target);
          showCell(t ? t.r : -1, t ? t.c : -1);
        });
        dlg.addEventListener("mouseleave", function () { if (mx && !mx.pin) showCell(-1, -1); });
        // Pinned: the arrow keys step to the previous / next citation along the
        // row (left, right) or column (up, down); Esc lets go first, then closes.
        dlg.addEventListener("keydown", function (e) {
          if (!mx || !mx.pin || e.altKey || e.ctrlKey || e.metaKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          stepPin(e.key);
        });
        // An overlay, not a modal dialog: the page stays reachable (element
        // pickers, the comment tool); a scrim behind it takes outside clicks.
        scrim = document.createElement("div");
        scrim.className = "apm-scrim";
        scrim.hidden = true;
        scrim.addEventListener("click", function () { dlg.close(); });
        dlg.addEventListener("close", function () {
          scrim.hidden = true;
          document.removeEventListener("keydown", onEscape, true);
        });
        var app = host.closest(".articles-app") || host;
        app.appendChild(scrim);
        app.appendChild(dlg);
      }
      dlg.innerHTML = head + '<div class="apm-readout" aria-live="polite"><div class="apm-ro-a"></div><div class="apm-ro-v"></div><div class="apm-ro-b"></div></div>' +
        '<div class="apm-body" tabindex="0"><div class="apm-plot"><div class="apm-axs"><div></div><div class="apm-ax apm-ax-y">' + rowsBy + "</div></div>" + table + "</div></div>";
      mx = { relation: relation, other: other, citer: m.citedBy ? other : slug, cited: m.citedBy ? slug : other, R: R, C: C, state: state,
        rowA: rowA, rowS: rowS, colA: colA, colS: colS, pin: null, r: -2, c: -2,
        a: dlg.querySelector(".apm-ro-a"), v: dlg.querySelector(".apm-ro-v"), b: dlg.querySelector(".apm-ro-b"), body: dlg.querySelector(".apm-table tbody") };
      showCell(-1, -1);
      if (!dlg.open) {
        scrim.hidden = false;
        dlg.show();
        document.addEventListener("keydown", onEscape, true);
      }
      fitCells();
      // The row author sits beside the rows, however tall the title header.
      var ax = dlg.querySelector(".apm-ax-y"), tb = dlg.querySelector(".apm-table tbody");
      // A spacer, not a margin, offsets it: sticky can then still pull it into view.
      if (ax && tb) ax.previousElementSibling.style.height = Math.max(0, tb.getBoundingClientRect().top - ax.parentNode.getBoundingClientRect().top + (tb.offsetHeight - ax.offsetHeight) / 2) + "px";
      // Row labels fit their slugs, so the column author is held clear of them
      // (and of the row author's strip) here.
      var corner = dlg.querySelector(".apm-corner"), axx = dlg.querySelector(".apm-ax-x"), strip = dlg.querySelector(".apm-axs");
      if (corner && axx) axx.style.left = corner.offsetWidth + (strip ? strip.offsetWidth : 0) + 8 + "px";
    }
    function cellOf(node) {
      var t = node && node.closest ? node.closest("[data-r], [data-c]") : null;
      if (!t || !dlg || !dlg.contains(t)) return null;
      return { r: t.hasAttribute("data-r") ? +t.getAttribute("data-r") : -1, c: t.hasAttribute("data-c") ? +t.getAttribute("data-c") : -1 };
    }
    function cellEl(r, c) {
      return r >= 0 && c >= 0 ? dlg.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]')
        : r >= 0 ? dlg.querySelector('th.apm-rh[data-r="' + r + '"]') : dlg.querySelector('th.apm-ch[scope="col"][data-c="' + c + '"]');
    }
    // Pin a cell (or a row's / column's label or sum), or let go (p null) and
    // show `at` - the cell under the pointer - instead.
    function setPin(p, at) {
      mx.pin = p;
      dlg.querySelectorAll("td.is-pin").forEach(function (x) { x.classList.remove("is-pin"); });
      var td = p && p.r >= 0 && p.c >= 0 && cellEl(p.r, p.c);
      if (td) td.classList.add("is-pin");
      var t = p || at || { r: -1, c: -1 };
      mx.r = -2;
      showCell(t.r, t.c);
    }
    // The next citation from (r, c) along a column (dr) or a row (dc), or -1.
    function nextCited(r, c, dr, dc) {
      for (r += dr, c += dc; r >= 0 && r < mx.R.length && c >= 0 && c < mx.C.length; r += dr, c += dc) {
        var s = mx.state[r][c];
        if (s === "cited" || s === "void") return dr ? r : c;
      }
      return -1;
    }
    // A pinned cell moves along its row or column; a pinned label or sum
    // enters its row or column, or moves on to the neighbouring one.
    function stepPin(key) {
      var p = window.OAMatrix.stepPin(key, mx.pin.r, mx.pin.c, mx.R.length, mx.C.length,
        function (r, from, d) { return nextCited(r, from, 0, d); },
        function (c, from, d) { return nextCited(from, c, d, 0); });
      if (!p) return;
      setPin(p);
      reveal(p.r, p.c);
    }
    // Whole cells only. Scrolling snaps to cell edges (CSS; each cell's scroll
    // margin clears the pinned number row and labels), and the scrolling header,
    // the pinned footer and the pinned sums are padded so the cells between them
    // come to a whole number: a would-be partial cell at the far edge lies under
    // that blank. Measured from layout rects throughout - fractional at
    // non-integer zoom - never the rounded offset sizes, so the edges meet.
    function fitCells() {
      var body = dlg.querySelector(".apm-body"), t = dlg.querySelector(".apm-table");
      if (!body || !t || !t.tHead || !t.tFoot || t.tFoot.rows.length < 2) return;
      ["--apm-sy", "--apm-ry", "--apm-rx"].forEach(function (k) { dlg.style.setProperty(k, "0px"); });
      var box = function (el) { return el ? el.getBoundingClientRect() : null; };
      var at = function (r, c) { return box(dlg.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]')); };
      // Remainder of v over the pitch p, sub-half-pixel residues taken as none.
      var rest = function (v, p) { var r = v % p; return r < 0.5 || r > p - 0.5 ? 0 : r; };
      var a = at(0, 0), ax = at(0, 1), ay = at(1, 0);
      if (!a) return;
      var px = ax ? ax.left - a.left : a.width, py = ay ? ay.top - a.top : a.height;
      var numRow = t.tHead.rows[t.tHead.rows.length - 1], num = box(numRow), foot = t.tFoot.rows;
      var b = box(body), corner = box(t.querySelector(".apm-corner"));
      dlg.style.setProperty("--apm-foot2", box(foot[1]).height + "px");
      dlg.style.setProperty("--apm-mt", num.height + "px");
      dlg.style.setProperty("--apm-ml", corner.right - b.left + "px");
      if (body.scrollHeight > body.clientHeight + 1) {
        var sr = rest(num.top - box(t).top, py);
        dlg.style.setProperty("--apm-sy", (sr ? py - sr : 0) + "px");
        dlg.style.setProperty("--apm-ry", rest(box(foot[0].cells[0]).top - b.top - num.height, py) + "px");
      }
      var rs1 = box(numRow.querySelector(".apm-rs1"));
      if (rs1 && body.scrollWidth > body.clientWidth + 1) dlg.style.setProperty("--apm-rx", rest(rs1.left - corner.right, px) + "px");
    }
    function onResize() { if (dlg && dlg.open && mx) fitCells(); }
    // Esc lets go of a pinned cell first, then closes.
    function onEscape(e) {
      if (e.key !== "Escape" || !dlg || !dlg.open) return;
      e.preventDefault();
      e.stopPropagation();
      if (mx && mx.pin) setPin(null); else dlg.close();
    }
    // Scroll just enough to bring the pinned cell out from under the pinned
    // labels, sums and header.
    function reveal(r, c) {
      var body = dlg.querySelector(".apm-body"), el = cellEl(r, c);
      if (!body || !el) return;
      var edge = function (sel, k, fb) { var x = dlg.querySelector(sel); return x ? x.getBoundingClientRect()[k] : fb; };
      var b = body.getBoundingClientRect(), x = el.getBoundingClientRect();
      var L = edge(".apm-corner", "right", b.left), T = edge(".apm-corner", "bottom", b.top);
      var Rt = edge('thead th.apm-rs1[scope="col"]', "left", b.right), B = edge(".apm-table tfoot th", "top", b.bottom);
      if (c >= 0) body.scrollLeft += x.left < L ? x.left - L : x.right > Rt ? x.right - Rt : 0;
      if (r >= 0) body.scrollTop += x.top < T ? x.top - T : x.bottom > B ? x.bottom - B : 0;
    }
    // Readout above the matrix: the citing (row) paper left, the cited (column)
    // paper right, the citing author accented and the cited author bold on
    // both. The row and column in focus are tinted (the column through its <col>).
    function showCell(r, c) {
      if (!mx || !mx.a || (mx.r === r && mx.c === c)) return;
      mx.r = r; mx.c = c;
      dlg.querySelectorAll(".is-hover").forEach(function (x) { x.classList.remove("is-hover"); });
      if (c >= 0) dlg.querySelectorAll('col[data-c="' + c + '"], th[data-c="' + c + '"], td.apm-cs[data-c="' + c + '"]').forEach(function (x) { x.classList.add("is-hover"); });
      if (r >= 0 && mx.body && mx.body.rows[r]) mx.body.rows[r].classList.add("is-hover");
      var row = mx.R[r], col = mx.C[c], s = row && col ? mx.state[r][c] : null;
      var verb = { cited: "cites \u2192", "void": "cites \u2192", same: "same work", later: "predates" };
      // A label or sum alone: all its citations, and those without shared authors.
      var tally = function (lead, all, solo, what) {
        return '<div class="apm-ro-hint">' + lead + " <b>" + fmt(all) + "</b> of these " + what + (solo !== all ? " \u00b7 " + fmt(solo) + " without shared authors" : "") + "</div>";
      };
      mx.a.innerHTML = row ? paperCard(row, mx.citer, mx.cited) : col ? tally("Cited by", mx.colA[c], mx.colS[c], "works") : '<div class="apm-ro-hint">Rows cite columns.</div>';
      mx.v.innerHTML = (s == null ? "" : "<b>" + (verb[s] || "does not cite") + "</b>" + (s === "void" ? "<span>shared author</span>" : "")) +
        (mx.pin ? '<span class="apm-pin">pinned \u00b7 arrows \u00b7 Esc</span>' : "");
      mx.b.innerHTML = col ? paperCard(col, mx.citer, mx.cited) : row ? tally("Cites", mx.rowA[r], mx.rowS[r], "works") : '<div class="apm-ro-hint">Point at a cell to compare both works; click to pin it.</div>';
      [[mx.a, row], [mx.b, col]].forEach(function (x) {
        var au = x[1] && x[0].querySelector(".apm-ro-au");
        if (au && au.scrollHeight > au.clientHeight + 1) au.innerHTML = authorsHtml(x[1], mx.citer, mx.cited, true);
      });
    }

    function relationPicks(a) {
      var s = a.getAttribute("data-slug");
      return [
        { field: "author", operator: "is", value: a.getAttribute("data-author") || slug, ensure: true },
        { field: a.getAttribute("data-relation"), operator: "is", value: s }
      ];
    }
    function onClick(e) {
      var mb = e.target.closest && e.target.closest("button.ap-n-matrix");
      if (mb) { openMatrix(mb.getAttribute("data-relation"), mb.getAttribute("data-slug")); return; }
      var a = e.target.closest && e.target.closest("a[data-ap-author], a.ap-n-link");
      if (!a || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (a.hasAttribute("data-ap-author")) actions.apply([{ field: "author", operator: "is", value: a.getAttribute("data-ap-author") }], true);
      else actions.apply(relationPicks(a), true);
    }
    function onContextMenu(e) {
      var a = e.target.closest && e.target.closest("a.ap-n-link");
      if (!a) return;
      e.preventDefault();
      actions.apply(relationPicks(a), false);
    }
    host.addEventListener("click", onClick);
    host.addEventListener("contextmenu", onContextMenu);

    function destroy() {
      token++;
      if (chart) { chart.destroy(); chart = null; }
      host.removeEventListener("click", onClick);
      host.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", onResize);
      if (dlg && dlg.open) dlg.close();
      if (dlg) dlg.remove();
      if (scrim) scrim.remove();
      dlg = null; mx = null; scrim = null;
      host.innerHTML = "";
      shown = "";
    }
    return { show: show, setRange: setRange, destroy: destroy };
  }

  // preload(): the chart code, fetched ahead of the first author - the guided
  // tour asks before its author stop, so the panel does not wait for it.
  window.OAAuthorPanel = Object.freeze({ create: create, preload: function () { return load().catch(function () { /* retried on show */ }); } });
})();
