/* =============================================================================
   Influence charts - small-multiple charts of one article's citation-network
   measures over time (centralities, citation counts, disruption), drawn into
   the table's abstract drop by drop-metrics.js - and, with options.metrics,
   an author's indices over time in the author panel (author-panel.js) and
   the entry screen's cumulative totals (cumulative-charts.js).
   window.OAInfluence.create({ date, influence }, { columns, scale, onMonth })
   builds the chart and draws it into one SVG per column. Each metric is a
   header line (symbol left, value right) over its plot. Colours resolve from
   the page's design tokens (--accent, --ink, --muted, --line, --mono) on every
   render, so palette / accent changes repaint in place.
   ========================================================================== */
(function () {
  "use strict";
  if (typeof d3 === "undefined") return;

  // ---------------------------------------------------------------------------
  // Configuration (color-independent; colors are resolved per render from CSS)
  // ---------------------------------------------------------------------------
  const config = {
    fallbackStartMonth: "1997-02",   // condensed records without a usable date
    yMin: 0,
    yMax: 100,
    logMin: 1,
    linearReferenceValue: 50,
    logReferenceValue: 10,
    xPaddingMonthsAfterData: 2,
    strokePadding: 2
  };

  // Laid out 1 viewBox unit = 1 CSS px: each SVG is re-cut to its live width,
  // so the type reads at the page's body size. Each row is a header band (the
  // metric's symbol and value) set close to its own plot and well clear of the
  // plot above.
  const layout = {
    top: 0,
    bottom: 24,
    labelBand: 22,
    rowHeight: 56,
    rowGap: 28,
    minPlot: 150
  };

  const curve = d3.curveLinear;

  const parseMonth = d3.utcParse("%Y-%m");
  const formatMonth = d3.utcFormat("%Y-%m");
  const formatValue = d3.format(".1f");
  // Counts follow the site's thousands convention: a narrow no-break space.
  const formatCount = d3.format(",.0f");
  const groupedCount = (v) => formatCount(v).replace(/,/g, "\u202F");
  const bisectDate = d3.bisector((d) => d.date).center;

  // ---------------------------------------------------------------------------
  // A record is { "<metric>": [v0, v1, ...], ... } - one array per series,
  // indexed by month from the paper's publication month (`date`) - normalized
  // to { labels, monthly } with the month keys rebuilt from that start.
  // ---------------------------------------------------------------------------
  function startMonth(date) {
    return (typeof date === "string" && /^\d{4}-\d{2}/.test(date)) ? date.slice(0, 7) : config.fallbackStartMonth;
  }

  function addMonths(ym, n) {
    return window.OAArticleStore.monthLabel(window.OAArticleStore.monthOf(ym) + n);
  }

  function normalizeInfluence(inf, date) {
    if (!inf || typeof inf !== "object") return null;
    // local_clustering is retired: dropped from the chart, but tolerated in the
    // data files (metric_data.js still carries it) so it grows no "No Data" row.
    // Every other key present becomes a row, in author order. Presence of the
    // key is the only test: a key whose value is empty or not an array of
    // numbers (e.g. "", [], null) keeps its row and renders as "No Data"; a key
    // that is absent from the data file is not shown at all.
    const labels = Object.keys(inf).filter((k) => k !== "local_clustering");
    if (!labels.length) return null;
    const n = labels.reduce((max, k) => Math.max(max, Array.isArray(inf[k]) ? inf[k].length : 0), 0);
    const start = startMonth(date);
    const monthly = {};
    for (let i = 0; i < n; i++) {
      monthly[addMonths(start, i)] = labels.map((l) => {
        const arr = inf[l];
        return Array.isArray(arr) && i < arr.length ? arr[i] : null;
      });
    }
    return { labels: labels, monthly: monthly };
  }

  // Metric definitions, keyed by the plain metric name used as the key in the
  // influence record (cumulative_citations, pagerank, ...). Each entry carries
  // the display label as inline TeX (`label`, math-rendered into the header at
  // draw time), the plain name shown beside it (`name`, CMOS headline-style
  // capitalization) and the hover description (`desc`). Keeping the math rendering
  // here - beside the tooltip - lets the data file name metrics plainly and
  // stay free of markup; this map owns how each one is drawn and described.
  const METRIC_DEFS = {
    cumulative_citations: { name: "Cumulative Citations", scale: "count", unit: "", label: "\\(k^{+}(t)\\)", desc: "Cumulative citations (k\u207A): running total of papers citing this work up to each month - a raw count, shown on its own scale." },
    citation_velocity:    { name: "Citation Velocity", scale: "count", unit: "", mark: "bar", label: "\\(c^{+}(t)\\)", desc: "Citation velocity (c\u207A): new citations received each month - a raw count, shown on its own scale." },
    pagerank:             { name: "PageRank", label: "\\(pr(t)\\)",           desc: "PageRank: standing weighted by the standing of the works that cite it." },
    authority:            { name: "Authority (HITS)", label: "\\(a(t)\\)",            desc: "Authority (HITS): high when many strong hubs cite this work." },
    hub:                  { name: "Hub (HITS)", label: "\\(h(t)\\)",            desc: "Hub (HITS): high when this work cites many strong authorities." },
    betweenness:          { name: "Betweenness Centrality", label: "\\(C_{B}(t)\\)",        desc: "Betweenness centrality: how often this work lies on the shortest path between two others in the citation network." },
    harmonic:             { name: "Harmonic Centrality", label: "\\(C_{H}(t)\\)",        desc: "Harmonic centrality: sum of reciprocal distances to all other works, robust to disconnected components." },
    closeness:            { name: "Closeness Centrality", label: "\\(C_{c}(t)\\)",        desc: "Closeness centrality: how close this work is, on average, to all other works it can reach in the citation network." },
    katz:                 { name: "Katz Centrality", label: "\\(C_{K}(t)\\)",        desc: "Katz centrality: influence weighted by every citing path, with longer paths attenuated - like PageRank but counting all reachable citations." },
    stress:               { name: "Stress Centrality", label: "\\(C_{\\sigma}(t)\\)",  desc: "Stress centrality: the number of shortest paths in the network that pass through this work." },
    proximity_prestige:   { name: "Proximity Prestige", label: "\\(P_{p}(t)\\)",        desc: "Proximity prestige: how close this work is, on average, to the works that can reach it." },
    disruption_index:     { name: "Disruption Index", scale: "signed", unit: "", label: "\\(CD(t)\\)", desc: "Disruption index (CD): whether this work eclipses the works it cites (disruptive) or builds on them (consolidating)." }
  };

  // The remaining metrics retain the shared pre-normalized percentage policy.
  const percentPolicy = { scale: "percent", unit: "%" };
  function metricPolicy(item, defs) {
    const metric = (defs || METRIC_DEFS)[item.key];
    return metric && metric.scale ? metric : percentPolicy;
  }

  // { "YYYY-MM": [v1..vN], ... } -> [{ month, values }]
  function monthlyFromBlock(block) {
    if (!block) return null;
    const rows = Object.keys(block).map((month) => ({
      month,
      values: (block[month] || []).map((v) => window.OAArticleStore.metricNumber(v))
    }));
    return rows.length ? rows : null;
  }

  function normalizeSeries(rawSeries) {
    return rawSeries.map((series, index) => {
      const values = series.values.map((d) => ({
        date: d.date,
        month: d.month,
        value: window.OAArticleStore.metricNumber(d.value)
      }));
      const validValues = values.filter((d) => Number.isFinite(d.value));
      return {
        name: series.name ?? `Series ${index + 1}`,
        key: series.key ?? null,
        label: series.label ?? series.name,
        description: series.description || "",
        displayName: series.displayName || "",
        displayNameHtml: series.displayNameHtml || "",
        values,
        validValues,
        latestDatum: validValues.length ? validValues[validValues.length - 1] : null
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Scale helpers
  // ---------------------------------------------------------------------------
  function createYScale(scaleMode, h) {
    const p = config.strokePadding, H = h || layout.rowHeight;
    if (scaleMode === "log") {
      return d3.scaleLog().domain([config.logMin, config.yMax]).range([H - p, p]);
    }
    return d3.scaleLinear().domain([config.yMin, config.yMax]).range([H - p, p]);
  }
  function getScaleFloor(m) { return m === "log" ? config.logMin : config.yMin; }
  function getReferenceValue(m) { return m === "log" ? config.logReferenceValue : config.linearReferenceValue; }
  function clampValue(v, m) { return Math.max(getScaleFloor(m), Math.min(config.yMax, v)); }
  function formatScaleNote(m) {
    return m === "log"
      ? `log scale: ${config.logMin}-${config.yMax}%, values ≤ ${config.logMin}% clamped`
      : `linear scale: ${config.yMin}-${config.yMax}%`;
  }

  // "Graphs start" setting (articles-grid.js): "field" puts every chart on the
  // field's timeline from 1997-02; otherwise each starts at its first value.
  const FIELD_START = "1997-02";
  // Every live chart, repainted together on palette / accent / theme changes
  // and on a change of the graph start.
  const live = new Set();
  window.addEventListener("oa-graph-start", function () { live.forEach(function (chart) { chart.render(); }); });
  let themeWatched = false;
  function watchTheme() {
    if (themeWatched) return;
    themeWatched = true;
    window.OATheme.onChange(function () { live.forEach(function (chart) { chart.render(); }); });
  }
  let uid = 0;

  // ---------------------------------------------------------------------------
  // create(article, options) -> chart, or null when the record has no series.
  //   article  { date: "YYYY-MM[-DD]", influence: record }
  //   options  columns  how many columns the rows are split over (default 1)
  //            scale    "linear" | "log"
  //            onMonth  (month) => void: the month the values show - the last
  //                     data month, or the hovered one (shown once, outside)
  // chart: columnCount, lastMonth, columnHeight(c) - fixed px height of
  //        column c, node(c) - its <svg>, render(), fit() - redraw columns whose
  //        width changed, setScale(mode), destroy().
  // ---------------------------------------------------------------------------
  function create(article, options) {
    const opts = options || {};
    // options.layout overrides the row geometry (the entry screen's taller plots).
    const L = opts.layout ? Object.assign({}, layout, opts.layout) : layout;
    const norm = normalizeInfluence(article && article.influence, article && article.date);
    const monthly = norm ? monthlyFromBlock(norm.monthly) : null;
    if (!monthly) return null;

    // Metric keys in authored order, as named in the data file. An unknown key
    // is used as its own label - escaped: a label is markup (mathHtml).
    const keys = norm.labels;
    // options.metrics adds definitions of the same shape (the author panel's
    // indices); they win over the built-in ones.
    const DEFS = opts.metrics ? Object.assign({}, METRIC_DEFS, opts.metrics) : METRIC_DEFS;
    const labels = keys.map((k) => (DEFS[k] && DEFS[k].label) || window.OATheme.escapeHtml(k));
    // A metric's definition describes it; an unknown key describes itself.
    const descriptions = keys.map((k) => (DEFS[k] && DEFS[k].desc) || k);
    const names = keys.map((k, i) => (DEFS[k] && DEFS[k].name) || String(descriptions[i]).split(":")[0] || k);
    // Optional markup twin of a name (e.g. a subscript), set by trusted defs only.
    const namesHtml = keys.map((k) => (DEFS[k] && DEFS[k].nameHtml) || "");

    // Centrality values arrive pre-normalized (0-100) and are plotted as-is;
    // count and signed metrics select their own scales by metric identity.
    const sorted = monthly.filter((r) => r && r.month).sort((a, b) => a.month.localeCompare(b.month));
    if (!sorted.length) return null;
    const valuesByMonth = new Map(sorted.map((r) => [r.month, r.values]));
    const lastMonthText = sorted[sorted.length - 1].month;
    const lastMonth = parseMonth(lastMonthText);
    // The article's own months: publication to the last data month (plus padding).
    const xMinDate = parseMonth(sorted[0].month);
    const xDomainEnd = d3.utcMonth.offset(lastMonth, config.xPaddingMonthsAfterData);
    const months = d3.utcMonth.range(xMinDate, d3.utcMonth.offset(lastMonth, 1));
    const series = normalizeSeries(labels.map((label, i) => ({
      name: `Object ${i + 1}`,
      key: keys[i],
      label,
      description: descriptions[i],
      displayName: names[i],
      displayNameHtml: namesHtml[i],
      values: months.map((date) => {
        const month = formatMonth(date);
        const row = valuesByMonth.get(month);
        return { date, month, value: row ? row[i] : null };
      })
    })));
    if (!series.length) return null;
    // options.overlays { key: [{ values, dash, cap }] }: more lines on a row's
    // plot (the author panel's citation exclusions), month-aligned with its
    // own values and drawn under its line.
    series.forEach((s) => {
      const ov = opts.overlays && opts.overlays[s.key];
      s.overlays = Array.isArray(ov) ? ov.map((o) => ({ dash: o.dash || null, cap: o.cap || "butt",
        values: s.values.map((d, i) => ({ date: d.date, value: window.OAArticleStore.metricNumber(Array.isArray(o.values) ? o.values[i] : null) })) })) : [];
    });

    // Rows split top-to-bottom over the columns, in authored order.
    const wanted = Math.max(1, Math.min(series.length, (opts.columns | 0) || 1));
    const perColumn = Math.ceil(series.length / wanted);
    const columns = [];
    for (let s = 0; s < series.length; s += perColumn) columns.push(series.slice(s, s + perColumn));

    const prefix = "oa-inf-" + (++uid);
    const svgs = [];
    const drawn = [];      // width each column was last drawn at (0 = not drawn)
    const hoverers = [];   // per column: the rows' crosshair setters
    let scaleMode = opts.scale === "log" ? "log" : "linear";
    let destroyed = false;
    // options.onRange: a drag across a plot picks an interval of months. drag is
    // the one in progress, range the one shown (setRange) - month indices.
    let drag = null, range = null;
    const bandSetters = [];   // per column: the rows' interval shading

    function columnHeight(c) {
      const n = columns[c] ? columns[c].length : 0;
      return L.top + n * (L.labelBand + L.rowHeight) + Math.max(0, n - 1) * L.rowGap + L.bottom;
    }

    // Re-cut a column (and redraw it) whenever its container changes width.
    let resizeTimer = 0;
    const resizer = new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 60); });

    function node(c) {
      if (!svgs[c]) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        el.setAttribute("class", "oa-inf-svg");
        el.setAttribute("role", "img");
        el.setAttribute("width", "100%");
        el.setAttribute("height", String(columnHeight(c)));
        svgs[c] = el;
        resizer.observe(el);
      }
      return svgs[c];
    }

    function shownWidth(c) {
      const el = svgs[c];
      return el && el.isConnected ? Math.round(el.getBoundingClientRect().width) : 0;
    }
    function render() {
      if (destroyed) return;
      for (let c = 0; c < columns.length; c++) {
        const w = shownWidth(c);
        if (w) drawColumn(c, w); else drawn[c] = 0;
      }
      alignNames();
    }
    function fit() {
      if (destroyed) return;
      for (let c = 0; c < columns.length; c++) {
        const w = shownWidth(c);
        if (w && Math.abs(w - (drawn[c] || 0)) >= 2) drawColumn(c, w);
      }
      alignNames();
    }
    // Every plain name starts on one vertical line, in every column: each
    // symbol is padded to the width of the widest one.
    function alignNames() {
      const syms = [];
      svgs.forEach(function (el) { if (el && el.isConnected) syms.push.apply(syms, el.querySelectorAll(".oa-inf-lsym")); });
      if (!syms.length) return;
      syms.forEach(function (el) { el.style.minWidth = ""; });
      const w = Math.ceil(syms.reduce(function (m, el) { return Math.max(m, el.offsetWidth || el.getBoundingClientRect().width); }, 0));
      if (w) syms.forEach(function (el) { el.style.minWidth = w + "px"; });
    }
    function setScale(mode) {
      mode = mode === "log" ? "log" : "linear";
      if (mode === scaleMode) return;
      scaleMode = mode;
      render();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      live.delete(chart);
      clearTimeout(resizeTimer);
      resizer.disconnect();
      svgs.forEach(function (el) { if (el) el.remove(); });
    }

    // A hover on ANY row drives every row, in every column, at the same month
    // (shared x-axis) - the cross-chart sync the landing cards use.
    function announce(month) { if (typeof opts.onMonth === "function") opts.onMonth(month); }
    function hoverAll(index) {
      hoverers.forEach((col) => { if (col) col.forEach((h) => h.set(index)); });
      const datum = series[0].values[index];
      announce(drag ? rangeText(drag.start, drag.cur) : (datum ? datum.month : lastMonthText));
    }
    function rangeText(a, b) {
      const v = series[0].values;
      return v[Math.min(a, b)].month + "\u2013" + v[Math.max(a, b)].month;
    }
    function paintBands() {
      const r = drag ? { lo: Math.min(drag.start, drag.cur), hi: Math.max(drag.start, drag.cur) } : range;
      bandSetters.forEach((col) => { if (col) col.forEach((set) => set(r ? r.lo : null, r ? r.hi : null)); });
    }
    // Shade the months from..to ("YYYY-MM"; null = open end) on every plot -
    // the host's live date filter. Months outside the data clamp to its ends.
    function setRange(from, to) {
      const v = series[0].values, n = v.length;
      if (!from && !to) range = null;
      else {
        let lo = 0, hi = n - 1;
        if (from) { lo = v.findIndex((d) => d.month >= from); if (lo < 0) lo = n; }
        if (to) { hi = -1; for (let i = n - 1; i >= 0; i--) if (v[i].month <= to) { hi = i; break; } }
        range = lo <= hi ? { lo: lo, hi: hi } : null;
      }
      paintBands();
    }
    function clearAll() {
      hoverers.forEach((col) => { if (col) col.forEach((h) => h.clear()); });
      announce(lastMonthText);
    }

    function drawColumn(c, shown) {
      const svgEl = svgs[c];
      const rowsData = columns[c];
      const plotWidth = Math.max(L.minPlot, shown);
      const height = columnHeight(c);
      const innerHeight = height - L.top - L.bottom;
      const fieldMin = parseMonth(FIELD_START);
      const xStart = window.OATheme.graphStartsAtField() && fieldMin < xMinDate ? fieldMin : xMinDate;
      const x = d3.scaleUtc().domain([xStart, xDomainEnd]).range([0, plotWidth]);
      drawn[c] = shown;

      // The type is the page's body size (--fs-body): the chart's labels read
      // at exactly the size of the text around them.
      const fs = parseFloat(getComputedStyle(svgEl).getPropertyValue("--fs-body")) || 14;
      svgEl.style.setProperty("--oa-inf-fs", fs + "px");
      svgEl.style.setProperty("--oa-inf-fs-sm", (parseFloat(getComputedStyle(svgEl).getPropertyValue("--fs-meta")) || 12) + "px");

      const t = window.OATheme.tokens();
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

      svg
        .attr("viewBox", [0, 0, plotWidth, height])
        .attr("width", "100%")
        .attr("height", height)
        .style("font-family", t.mono);

      // NO <svg><title>: a title anywhere in the ancestry becomes the native
      // tooltip for every descendant, so an SVG-level one re-created the tooltip
      // over the sparklines that the capture rect just gave up. The accessible
      // name comes from role="img" + aria-label (which takes precedence over
      // <title> anyway), so nothing is lost - the measure count is folded in below.
      svg.attr("aria-label",
        "Small-multiple area charts of " + rowsData.length + " " +
        (opts.subject || "citation-network centrality measures") + " over time");

      const defs = svg.append("defs");
      const idBase = prefix + "-" + c;
      const gradientId = idBase + "-area";
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
      gradient.append("stop").attr("offset", "0%").attr("stop-color", t.accent).attr("stop-opacity", 0.26);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", t.accent).attr("stop-opacity", 0.03);

      const root = svg.append("g").attr("transform", `translate(0,${L.top})`);
      const rowPitch = L.labelBand + L.rowHeight + L.rowGap;
      const y = createYScale(scaleMode, L.rowHeight);
      const scaleFloor = getScaleFloor(scaleMode);
      const referenceValue = getReferenceValue(scaleMode);
      const yClamped = (v) => y(clampValue(v, scaleMode));

      const rows = root
        .selectAll(".oa-inf-row")
        .data(rowsData)
        .join("g")
        .attr("class", "oa-inf-row")
        .attr("transform", (d, i) => `translate(0,${i * rowPitch + L.labelBand})`);

      const rowHoverers = [];
      hoverers[c] = rowHoverers;
      const rowBands = [];
      bandSetters[c] = rowBands;
      const monthStep = Math.max(1, x(d3.utcMonth.offset(xMinDate, 1)) - x(xMinDate));
      rows.each(function (seriesItem, rowIndex) {
        const row = d3.select(this);
        const clipId = `${idBase}-clip-${rowIndex}`;

        // Raw counts (k+, c+) use their own maxima wherever they appear.
        const policy = metricPolicy(seriesItem, DEFS);
        const isRaw = policy.scale === "count";
        // The disruption index (CD) is a signed score bounded to [-1, +1], not a
        // percentage. Pin it to a fixed -1..+1 scale (0 = neutral midline).
        const isDisruption = policy.scale === "signed";
        let ry = y, ryFloor = scaleFloor, ryRef = referenceValue, ryMax = config.yMax, ryClamped = yClamped;
        const unit = policy.unit;
        const fmt = policy.decimals != null ? d3.format("." + policy.decimals + "f")
          : isRaw ? groupedCount : (isDisruption ? d3.format("+.2f") : formatValue);
        // A running count that only steps up (publications) holds its value
        // until the next change.
        const rowCurve = policy.curve === "step" ? d3.curveStepAfter : curve;
        if (isRaw) {
          const vals = seriesItem.validValues.map((d) => d.value);
          seriesItem.overlays.forEach((o) => o.values.forEach((d) => { if (Number.isFinite(d.value)) vals.push(d.value); }));
          const top = vals.length && Math.max.apply(null, vals) > 0 ? Math.max.apply(null, vals) : 1;
          const p = config.strokePadding;
          ry = d3.scaleLinear().domain([0, top]).range([L.rowHeight - p, p]);
          ryFloor = 0;
          ryRef = top / 2;
          ryMax = top;
          ryClamped = (v) => ry(Math.max(0, Math.min(top, v)));
        } else if (isDisruption) {
          const p = config.strokePadding;
          ry = d3.scaleLinear().domain([-1, 1]).range([L.rowHeight - p, p]);
          ryFloor = 0;   // area fills from the 0 midline
          ryRef = 0;     // neutral midline
          ryMax = 1;     // limit line at +1
          ryClamped = (v) => ry(Math.max(-1, Math.min(1, v)));
        }

        defs.append("clipPath").attr("id", clipId).append("rect")
          .attr("x", -config.strokePadding).attr("y", -config.strokePadding)
          .attr("width", plotWidth + 2 * config.strokePadding)
          .attr("height", L.rowHeight + 2 * config.strokePadding);

        // Header line over the plot: the metric's symbol and plain name at the
        // left - the full definition is their TOOLTIP (cursor: help) - and its
        // value at the right.
        const symHtml = window.OATheme.mathHtml(seriesItem.label);
        const descFull = String(seriesItem.description || "");
        const nameText = descFull.split(":")[0] || seriesItem.key || seriesItem.name;
        const tip = descFull || nameText || seriesItem.name;
        const labelDiv = row.append("foreignObject")
          .attr("x", 0).attr("y", -L.labelBand)
          .attr("width", plotWidth).attr("height", L.labelBand)
          .attr("overflow", "visible")   // sub- and superscripts reach past the line box
          .append("xhtml:div")
          .attr("class", "oa-inf-label is-top")
          .style("color", t.ink2);
        const head = labelDiv.append("xhtml:span").attr("class", "oa-inf-lhead").attr("title", tip);
        head.append("xhtml:span").attr("class", "oa-inf-lsym").style("color", t.ink).html(symHtml);
        if (seriesItem.displayNameHtml) head.append("xhtml:span").attr("class", "oa-inf-lname").html(seriesItem.displayNameHtml);
        else if (seriesItem.displayName) head.append("xhtml:span").attr("class", "oa-inf-lname").text(seriesItem.displayName);
        const readout = labelDiv.append("xhtml:span").attr("class", "oa-inf-lval");

        if (seriesItem.validValues.length === 0) { readout.text("No Data"); return; }
        const latestDatum = seriesItem.latestDatum;
        const latestIndex = seriesItem.values.indexOf(latestDatum);
        // The values alone - their month is shown once, via onMonth. Overlay
        // values follow the row's own, slash-separated, in the key's order.
        // Trend into the shown month from the month before (the last one with
        // a value): up, down, or flat when both read the same at this precision.
        function trendArrow(datum, index) {
          let prev = null;
          for (let i = index - 1; i >= 0 && prev === null; i--) {
            const d = seriesItem.values[i];
            if (d && Number.isFinite(d.value)) prev = d.value;
          }
          if (prev === null || !Number.isFinite(datum.value)) return;
          const now = fmt(datum.value), before = fmt(prev);
          const dir = now === before ? 0 : datum.value > prev ? 1 : -1;
          readout.append("xhtml:span").attr("class", "oa-inf-ltrend")
            .attr("title", `${dir > 0 ? "Up" : dir < 0 ? "Down" : "Unchanged"} from ${before}${unit} the month before`)
            .text(dir > 0 ? "\u2197" : dir < 0 ? "\u2198" : "\u2192");
        }
        function showValues(datum, index) {
          readout.text("");
          readout.append("xhtml:span").text(`${fmt(datum.value)}${unit}`);
          trendArrow(datum, index);
          seriesItem.overlays.forEach((o) => {
            const od = o.values[index];
            readout.append("xhtml:span").attr("class", "oa-inf-lval-alt")
              .text(od && Number.isFinite(od.value) ? `${fmt(od.value)}${unit}` : "\u2013");
          });
        }
        function showLatest() { showValues(latestDatum, latestIndex); }
        showLatest();

        // Every row is framed by two solid rules the eye can read values against:
        // the FLOOR (0, or the row's own zero for the raw counts) and the CEILING
        // (100%, the row's own max for raw counts, +1 for the disruption index).
        // The reference line between them stays faint and dashed so it never
        // competes with the pair.
        const yFloor = ry(ryFloor), yTop = ry(ryMax), yRef = ry(ryRef);
        row.append("line").attr("class", "oa-inf-baseline")
          .attr("x1", 0).attr("x2", plotWidth)
          .attr("y1", yFloor).attr("y2", yFloor)
          .attr("stroke", t.muted);
        if (Math.abs(yRef - yFloor) > 1 && Math.abs(yRef - yTop) > 1) {
          row.append("line").attr("class", "oa-inf-midline")
            .attr("x1", 0).attr("x2", plotWidth)
            .attr("y1", yRef).attr("y2", yRef)
            .attr("stroke", t.line);
        }
        row.append("line").attr("class", "oa-inf-limitline")
          .attr("x1", 0).attr("x2", plotWidth)
          .attr("y1", yTop).attr("y2", yTop)
          .attr("stroke", t.muted);

        const clipped = row.append("g").attr("clip-path", `url(#${clipId})`);
        if (policy.mark === "bar") {
          // A per-month count (c+) reads as bars: one per month, centred on it,
          // rising from the floor. Empty months draw nothing.
          const step = Math.max(1, x(d3.utcMonth.offset(xMinDate, 1)) - x(xMinDate));
          const bw = Math.max(1, step * 0.7);
          const base = ry(ryFloor);
          clipped.append("g").attr("class", "oa-inf-bars").attr("fill", t.accent).attr("fill-opacity", 0.85)
            .selectAll("rect").data(seriesItem.validValues.filter((d) => d.value > ryFloor)).join("rect")
            .attr("x", (d) => x(d.date) - bw / 2).attr("width", bw)
            .attr("y", (d) => ryClamped(d.value)).attr("height", (d) => Math.max(0, base - ryClamped(d.value)));
        } else {
          const area = d3.area().defined((d) => Number.isFinite(d.value))
            .x((d) => x(d.date)).y0(ry(ryFloor)).y1((d) => ryClamped(d.value)).curve(rowCurve);
          const line = d3.line().defined((d) => Number.isFinite(d.value))
            .x((d) => x(d.date)).y((d) => ryClamped(d.value)).curve(rowCurve);
          clipped.append("path").datum(seriesItem.values).attr("class", "oa-inf-area")
            .attr("fill", `url(#${gradientId})`).attr("d", area);
          seriesItem.overlays.forEach((o) => {
            clipped.append("path").datum(o.values).attr("class", "oa-inf-overlay")
              .attr("fill", "none").attr("stroke", t.accent).attr("stroke-width", 1.3).attr("stroke-dasharray", o.dash)
              .attr("stroke-linecap", o.cap).attr("stroke-linejoin", "round").attr("d", line);
          });
          clipped.append("path").datum(seriesItem.values).attr("class", "oa-inf-line")
            .attr("fill", "none").attr("stroke", t.accent).attr("stroke-width", 1.3)
            .attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("d", line);
          clipped.append("circle").attr("class", "oa-inf-dot")
            .attr("fill", t.accent).attr("cx", x(latestDatum.date)).attr("cy", ryClamped(latestDatum.value)).attr("r", 2);
        }

        // The picked interval, under the area and line.
        const band = clipped.insert("rect", ":first-child").attr("class", "oa-inf-band")
          .attr("y", 0).attr("height", L.rowHeight).attr("fill", t.accent).attr("fill-opacity", 0.16).attr("display", "none");
        rowBands.push(function (lo, hi) {
          const d0 = lo == null ? null : seriesItem.values[lo], d1 = hi == null ? null : seriesItem.values[hi];
          if (!d0 || !d1) { band.attr("display", "none"); return; }
          const x0 = x(d0.date) - monthStep / 2, x1 = x(d1.date) + monthStep / 2;
          band.attr("display", null).attr("x", x0).attr("width", Math.max(1, x1 - x0));
        });

        const hoverLine = clipped.append("line").attr("class", "oa-inf-hoverline")
          .attr("y1", 0).attr("y2", L.rowHeight).attr("stroke", t.ink).attr("opacity", 0);
        const hoverDot = clipped.append("circle").attr("class", "oa-inf-hoverdot")
          .attr("fill", t.accent).attr("r", 2.8).attr("opacity", 0);
        // Overlay lines get a ring where they part from the row's own value.
        const overDots = seriesItem.overlays.map(() => clipped.append("circle").attr("class", "oa-inf-overdot")
          .attr("fill", "none").attr("stroke", t.accent).attr("stroke-width", 1).attr("r", 2.4).attr("opacity", 0));

        // Programmatic hover for this row, reused by the mouse handler AND by the
        // cross-row sync so all rows line up at the hovered month.
        function setHoverAt(index) {
          const datum = seriesItem.values[index];
          if (!datum || !Number.isFinite(datum.value)) {
            hoverLine.attr("opacity", 0); hoverDot.attr("opacity", 0);
            overDots.forEach((d) => d.attr("opacity", 0));
            readout.text("No Data"); return;
          }
          const hx = x(datum.date), hy = ryClamped(datum.value);
          hoverLine.attr("x1", hx).attr("x2", hx).attr("opacity", 1);
          hoverDot.attr("cx", hx).attr("cy", hy).attr("opacity", 1);
          seriesItem.overlays.forEach((o, k) => {
            const od = o.values[index];
            const on = od && Number.isFinite(od.value) && od.value !== datum.value;
            overDots[k].attr("cx", hx).attr("cy", on ? ryClamped(od.value) : hy).attr("opacity", on ? 1 : 0);
          });
          showValues(datum, index);
        }
        function clearHover() {
          hoverLine.attr("opacity", 0); hoverDot.attr("opacity", 0);
          overDots.forEach((d) => d.attr("opacity", 0));
          showLatest();
        }
        rowHoverers.push({ set: setHoverAt, clear: clearHover });

        const captureRect = row.append("rect")
          .attr("x", 0).attr("y", 0)
          .attr("width", plotWidth).attr("height", L.rowHeight)
          .attr("fill", "transparent").style("cursor", "crosshair");
        // The plot carries the metric's definition as a native tooltip too: the
        // graph is the bigger hover target, and the crosshair readout keeps
        // updating underneath it.
        captureRect.append("title").text(opts.onRange ? tip + "\nDrag: list only that interval" : tip);
        captureRect
          .on("mousemove", function (event) {
            const [mx] = d3.pointer(event, this);
            hoverAll(bisectDate(seriesItem.values, x.invert(mx)));
          })
          .on("mouseleave", clearAll);
        if (opts.onRange) {
          const at = function (event, el) {
            const i = bisectDate(seriesItem.values, x.invert(d3.pointer(event, el)[0]));
            return Math.max(0, Math.min(seriesItem.values.length - 1, i));
          };
          // Horizontal drags pick the interval; vertical ones still scroll.
          captureRect.style("touch-action", "pan-y")
            .on("pointerdown", function (event) {
              if (event.button !== 0) return;
              event.preventDefault();
              const i = at(event, this);
              drag = { start: i, cur: i };
              try { this.setPointerCapture(event.pointerId); } catch (e) { /* no capture: the drag ends at the edge */ }
              paintBands();
            })
            .on("pointermove", function (event) {
              if (!drag) return;
              const i = at(event, this);
              if (i === drag.cur) return;
              drag.cur = i;
              paintBands();
              hoverAll(i);
            })
            .on("pointerup", function () {
              if (!drag) return;
              const lo = Math.min(drag.start, drag.cur), hi = Math.max(drag.start, drag.cur);
              drag = null;
              // A plain click picks nothing: only a drag over two months or more.
              if (hi > lo) {
                range = { lo: lo, hi: hi };
                opts.onRange(seriesItem.values[lo].month, seriesItem.values[hi].month);
              }
              paintBands();
            })
            .on("pointercancel", function () { if (drag) { drag = null; paintBands(); } });
        }
      });

      const spanYears = (xDomainEnd - xStart) / (365.25 * 24 * 3600 * 1000);
      const byMonth = spanYears <= 3;
      const tickFmt = byMonth ? d3.utcFormat("%Y-%m") : d3.utcFormat("%Y");
      // Whole months (or years) only, each label once, at least ~64 px apart:
      // d3's own interval choice drops to weeks on a span of a few months and
      // printed the same month label several times over.
      const tickCount = Math.max(2, Math.min(6, Math.floor(plotWidth / 64)));
      const span = byMonth
        ? d3.utcMonth.count(xStart, xDomainEnd)
        : d3.utcYear.count(d3.utcYear.floor(xStart), xDomainEnd);
      const every = Math.max(1, Math.ceil(span / tickCount));
      const xAxis = d3.axisBottom(x)
        .ticks(byMonth ? d3.utcMonth.every(every) : d3.utcYear.every(every))
        .tickSizeOuter(0).tickFormat(tickFmt);
      const axisG = root.append("g").attr("class", "oa-inf-axis")
        .attr("transform", `translate(0,${innerHeight})`).call(xAxis);
      axisG.selectAll("text").attr("fill", t.muted);
      axisG.selectAll("path, line").attr("stroke", t.line);
      // No gutter takes a centred edge date's overhang: anchor a date near
      // either end of the plot to that end, inside the chart.
      axisG.selectAll(".tick").each(function (d) {
        const tx = x(d);
        const anchor = tx < 30 ? "start" : (tx > plotWidth - 30 ? "end" : null);
        if (anchor) d3.select(this).select("text").attr("text-anchor", anchor);
      });
      paintBands();
    }

    const chart = {
      columnCount: columns.length,
      lastMonth: lastMonthText,
      columnHeight: columnHeight,
      node: node,
      render: render,
      fit: fit,
      setScale: setScale,
      setRange: setRange,
      destroy: destroy
    };
    live.add(chart);
    watchTheme();
    // Math glyph widths change once the fonts arrive.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!destroyed) alignNames(); });
    return chart;
  }

  window.OAInfluence = Object.freeze({ create: create, scaleNote: formatScaleNote });
})();
