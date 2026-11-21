/* topic-panel.js - Topic Trends in the page's right margin, beside the table.
 * While the filter has keyword / category rules, the panel charts them over
 * time with the filter's own AND / OR logic: one series per AND-combination
 * of its OR branches (the host - articles-grid.js topicSeries - works them
 * out and hands over one predicate per series). All series share one graph:
 * a cumulative plot (a line each) over a per-month bar plot (overlapping
 * bars, the tallest behind), each series in the colour of its category - the
 * category it names, else the one its articles carry most. Drawn in the
 * papers' graph-metrics look (the .oa-inf-* rules of influence.js); a drag
 * across a plot filters the list to that interval. d3 loads on the first show.
 *
 * OATopicPanel.create(host, { range(from, to) })
 *   -> { show({ groups: [{ key, label, categories, test(article) }], more, articles }),
 *        setRange({ from, to } | null), destroy() }
 */
(function () {
  "use strict";

  // Fallback colours once the categories' own are taken.
  var PALETTE = ["#0e5aa7", "#c2410c", "#15803d", "#7e22ce", "#b45309", "#0f766e"];
  // The graph-metrics geometry (influence.js): header band, plot, gap, axis.
  var L = { band: 22, row: 64, gap: 28, bottom: 24, pad: 2 };
  var uid = 0;
  // "Graphs start" setting (articles-grid.js): "field" starts the graph in
  // 1997-02; otherwise at the series' first value.
  var FIELD_START = Date.UTC(1997, 1, 1);
  var loading = null;
  function load() {
    if (loading) return loading;
    var A = window.OAAssets;
    loading = (window.d3 ? Promise.resolve() : A.loadScript(A.url("src/vendor/d3.v7.min.js"))).then(function () {
      if (!window.d3) throw new Error("Topic trends did not load");
    });
    loading.catch(function () { loading = null; });   // a failed load stays retryable
    return loading;
  }

  // The store's month index (article-store monthOf): null without a month.
  function monthOf(date) { return window.OAArticleStore.monthOf(date); }
  function ym(i) { return window.OAArticleStore.monthLabel(i); }
  var esc = window.OATheme.escapeHtml, fmt = window.OATheme.fmtNum;

  function create(host, actions) {
    host.innerHTML =
      '<section class="ap-sec">' +
        '<h2 class="ap-h">Topic Trends<span class="ap-h-aside" data-tp="month" title="Month of the values shown"></span></h2>' +
        '<p class="ap-msg" data-tp="msg" hidden></p>' +
        '<ul class="tp-legend" data-tp="legend"></ul>' +
        '<div class="ap-inf-slot" data-tp="plot"><svg class="oa-inf-svg" role="img"></svg></div>' +
        '<p class="ap-sub ap-note" data-tp="more" hidden></p>' +
      "</section>";
    function el(k) { return host.querySelector('[data-tp="' + k + '"]'); }
    var plot = el("plot"), svgEl = plot.querySelector("svg"), monthEl = el("month");
    // The full category name sits under each series as its own button: one
    // ellipsized line by default, the whole title when pressed.
    el("legend").addEventListener("click", function (e) {
      var b = e.target.closest(".tp-full");
      if (b) b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") === "true" ? "false" : "true");
    });
    var id = "oa-tp-" + (++uid);
    var data = null, shownKey = "", token = 0, destroyed = false;
    var hoverIndex = null, drag = null, range = null, dateRange = null, drawnW = 0;
    var hoverers = [], bands = [];
    // Month index and category codes of every distinct article, kept per
    // article array; counted series by key.
    var basis = null, counted = new Map();

    function message(text) {
      var m = el("msg");
      m.textContent = text;
      m.hidden = !text;
    }

    function prepare(articles, axis, store) {
      if (basis && basis.articles === articles && basis.length === articles.length && basis.first === axis.first) return basis;
      var seen = new Set(), list = [], months = [], codes = [];
      for (var i = 0; i < articles.length; i++) {
        var a = articles[i];
        if (!a || (a.id != null && seen.has(a.id))) continue;   // category grouping repeats rows
        if (a.id != null) seen.add(a.id);
        var m = monthOf(a.date);
        if (m == null) continue;
        list.push(a);
        months.push(m - axis.first);
        codes.push(store.categoryCodes(a));
      }
      counted.clear();
      basis = { articles: articles, length: articles.length, first: axis.first, list: list, months: months, codes: codes };
      return basis;
    }
    function count(group, b, n) {
      var hit = counted.get(group.key);
      if (hit && hit.n === n) return hit;
      var monthly = new Array(n).fill(0), tally = new Map();
      for (var i = 0; i < b.list.length; i++) {
        var mi = b.months[i];
        if (mi < 0 || mi >= n || !group.test(b.list[i])) continue;
        monthly[mi] += 1;
        b.codes[i].forEach(function (c) { tally.set(c, (tally.get(c) || 0) + 1); });
      }
      var cum = new Array(n), total = 0;
      for (var k = 0; k < n; k++) { total += monthly[k]; cum[k] = total; }
      hit = { n: n, monthly: monthly, cum: cum, tally: tally, total: total };
      counted.set(group.key, hit);
      return hit;
    }
    // A series takes the colour of the category it names, else of the one its
    // articles carry most - the next one down when that colour is too close
    // to one already in use (same hue family: siblings under one chapter share
    // shades of its colour), and a palette colour once the categories run out.
    // Hue of a colour AS DRAWN: category hexes are often pale tints that
    // catColor turns into strong shades, so they are compared after it.
    function hueOf(hex) {
      var drawn = String(window.OATheme.catColor(hex) || hex || "");
      var hsl = /hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%/i.exec(drawn);
      if (hsl) return { h: +hsl[1] % 360, grey: +hsl[2] < 15 };
      var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(drawn);
      if (!m) return null;
      var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      var l = (max + min) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (s < 0.15) return { h: 0, grey: true };
      var h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return { h: (h * 60 + 360) % 360, grey: false };
    }
    function tooClose(hex, used) {
      var a = hueOf(hex);
      return used.some(function (u) {
        var b = hueOf(u);
        if (!a || !b) return hex === u;
        if (a.grey || b.grey) return a.grey === b.grey;
        var dh = Math.abs(a.h - b.h);
        return Math.min(dh, 360 - dh) < 40;
      });
    }
    function colour(series) {
      var defs = window.CATEGORY_DEFS || {}, used = [];
      series.forEach(function (s) {
        var ranked = Array.from(s.c.tally.entries()).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) { return e[0]; });
        var cands = (s.g.categories || []).concat(ranked);
        for (var k = 0; k < cands.length; k++) {
          var d = defs[cands[k]], hex = d && d.color ? String(d.color).toLowerCase() : "";
          if (hex && !tooClose(hex, used)) { used.push(hex); s.hex = hex; s.code = cands[k]; s.codeTitle = d.title || ""; return; }
        }
        var spare = PALETTE.filter(function (p) { return !tooClose(p, used); })[0] || PALETTE.filter(function (p) { return used.indexOf(p) < 0; })[0];
        if (spare) used.push(spare);
        s.fallback = spare || null;
      });
    }
    function colourOf(s, t) { return s.hex ? window.OATheme.catColor(s.hex) : (s.fallback || t.accent); }

    function show(spec) {
      var groups = (spec && spec.groups) || [];
      var key = groups.map(function (g) { return g.key; }).join("\u0002") + "|" + (spec.articles ? spec.articles.length : 0);
      if (key === shownKey) { if (data) requestAnimationFrame(fit); return; }
      shownKey = key;
      var my = ++token;
      if (!window.d3) message("Loading topic trends\u2026");
      load().then(function () {
        if (my === token && host.isConnected) build(spec);
      }, function () {
        if (my !== token) return;
        shownKey = "";
        message("Topic trends could not be loaded.");
      });
    }

    function build(spec) {
      var store = window.OAArticleStore.get(), axis = store.monthAxis();
      var n = axis.last - axis.first + 1;
      data = null;
      if (!n || !spec.articles) { message("No dates to chart."); draw(); return; }
      message("");
      var b = prepare(spec.articles, axis, store);
      var series = spec.groups.map(function (g) { return { g: g, c: count(g, b, n) }; });
      colour(series);
      var dates = [], months = [];
      for (var i = 0; i < n; i++) {
        dates.push(new Date(Date.UTC(Math.floor((axis.first + i) / 12), (axis.first + i) % 12, 1)));
        months.push(ym(axis.first + i));
      }
      data = {
        n: n, dates: dates, months: months, series: series,
        maxCum: Math.max(1, d3max(series, function (s) { return s.c.total; })),
        maxMon: Math.max(1, d3max(series, function (s) { return Math.max.apply(null, s.c.monthly); })),
        // The first month any series has an article: where "first value" starts.
        firstHit: series.reduce(function (m, s) {
          var i = s.c.monthly.findIndex(function (v) { return v > 0; });
          return i >= 0 && (m < 0 || i < m) ? i : m;
        }, -1)
      };
      svgEl.setAttribute("aria-label", "Articles over time for " + series.map(function (s) { return s.g.label; }).join(", ") + ": cumulative and per month");
      if (dateRange) applyRange(dateRange);
      hoverIndex = null;
      var more = el("more");
      more.hidden = !spec.more;
      more.textContent = spec.more ? spec.more + " more combination" + (spec.more === 1 ? "" : "s") + " of the filter not shown" : "";
      draw();
    }
    function d3max(list, f) { var m = 0; list.forEach(function (x) { m = Math.max(m, f(x)); }); return m; }

    function legend(t) {
      el("legend").innerHTML = data ? data.series.map(function (s, i) {
        var ts = window.OATypeset.text;
        var tip = ts(s.g.label) + (s.code ? " \u00b7 colour of " + s.code + (s.codeTitle ? " " + ts(s.codeTitle) : "") : "");
        return '<li title="' + esc(tip) + '"><span class="tp-sw" style="background:' + esc(colourOf(s, t)) + '"></span>' +
          '<span class="tp-name">' + esc(ts(s.g.label)) + '</span><span class="tp-val" data-tp-val="' + i + '"></span>' +
          fullNames(s, ts) + "</li>";
      }).join("") : "";
    }
    // Every category the series combines, by full name (code-led once there
    // are several); a series naming none (a keyword) shows its colour's.
    function fullNames(s, ts) {
      var defs = window.CATEGORY_DEFS || {};
      var codes = (s.g.categories || []).filter(function (c, i, all) { return defs[c] && defs[c].title && all.indexOf(c) === i; });
      if (!codes.length && s.codeTitle) codes = [s.code];
      if (!codes.length) return "";
      var many = codes.length > 1;
      var items = codes.map(function (c) {
        return '<span class="tp-full-i">' + (many ? '<span class="tp-full-c">' + esc(c) + "</span> " : "") + esc(ts(defs[c] ? defs[c].title : s.codeTitle)) + "</span>";
      }).join("");
      return '<button type="button" class="tp-full" aria-expanded="false" title="Full name' + (many ? "s of " + esc(codes.join(", ")) + " \u00b7 click to show them all" : " of " + esc(codes[0]) + " \u00b7 click to show all of it") + '">' + items + "</button>";
    }
    function readout(i) {
      if (!data) return;
      var at = i == null ? data.n - 1 : i;
      host.querySelectorAll("[data-tp-val]").forEach(function (v) {
        var s = data.series[+v.getAttribute("data-tp-val")];
        if (s) v.innerHTML = "<b>" + esc(fmt(s.c.cum[at])) + "</b> +" + esc(fmt(s.c.monthly[at]));
      });
      monthEl.textContent = drag ? data.months[Math.min(drag.a, drag.b)] + "\u2013" + data.months[Math.max(drag.a, drag.b)] : data.months[at];
    }
    function paintHover(i) { hoverIndex = i; hoverers.forEach(function (h) { h(i); }); readout(i); }
    function paintBands() {
      var r = drag ? { lo: Math.min(drag.a, drag.b), hi: Math.max(drag.a, drag.b) } : range;
      bands.forEach(function (b) { b(r); });
    }
    function applyRange(r) {
      if (!data || !r) { range = null; return; }
      var lo = 0, hi = data.n - 1;
      if (r.from) { lo = data.months.findIndex(function (m) { return m >= r.from; }); if (lo < 0) lo = data.n; }
      if (r.to) { hi = -1; for (var i = data.n - 1; i >= 0; i--) if (data.months[i] <= r.to) { hi = i; break; } }
      range = lo <= hi ? { lo: lo, hi: hi } : null;
    }
    function setRange(r) {
      dateRange = r && (r.from || r.to) ? r : null;
      applyRange(dateRange);
      paintBands();
    }

    function draw() {
      var d3 = window.d3;
      hoverers = []; bands = [];
      if (!d3 || !data) { if (d3) d3.select(svgEl).selectAll("*").remove(); el("legend").innerHTML = ""; plot.style.height = "0px"; return; }
      var t = window.OATheme.tokens();
      legend(t);
      var W = Math.round(plot.getBoundingClientRect().width);
      drawnW = W;
      var H = 2 * (L.band + L.row) + L.gap + L.bottom;
      plot.style.height = H + "px";
      if (!W) { readout(null); return; }
      var fs = parseFloat(getComputedStyle(svgEl).getPropertyValue("--fs-body")) || 14;
      svgEl.style.setProperty("--oa-inf-fs", fs + "px");
      svgEl.style.setProperty("--oa-inf-fs-sm", (parseFloat(getComputedStyle(svgEl).getPropertyValue("--fs-meta")) || 12) + "px");
      var svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      svg.attr("viewBox", [0, 0, W, H]).attr("width", "100%").attr("height", H).style("font-family", t.mono);
      var defs = svg.append("defs");
      var first = data.dates[0];
      if (window.OATheme.graphStartsAtField()) { if (FIELD_START > +first) first = new Date(FIELD_START); }
      else if (data.firstHit > 0) first = data.dates[data.firstHit];
      var x = d3.scaleUtc().domain([first, d3.utcMonth.offset(data.dates[data.n - 1], 2)]).range([0, W]);
      var step = Math.max(1, x(d3.utcMonth.offset(data.dates[0], 1)) - x(data.dates[0]));
      var bisect = d3.bisector(function (d) { return d; }).center;
      var colours = data.series.map(function (s) { return colourOf(s, t); });
      var rows = [
        { sym: "\\(N(t)\\)", name: "Cumulative", max: data.maxCum, line: true,
          desc: "Cumulative articles (N): articles in the database published up to each month." },
        { sym: "\\(n(t)\\)", name: "Per Month", max: data.maxMon, line: false,
          desc: "Articles per month (n): articles in the database published in each month." }
      ];
      rows.forEach(function (r, ri) {
        var g = svg.append("g").attr("class", "oa-inf-row").attr("transform", "translate(0," + (ri * (L.band + L.row + L.gap) + L.band) + ")");
        var lab = g.append("foreignObject").attr("x", 0).attr("y", -L.band).attr("width", W).attr("height", L.band).attr("overflow", "visible")
          .append("xhtml:div").attr("class", "oa-inf-label is-top").style("color", t.ink2);
        var head = lab.append("xhtml:span").attr("class", "oa-inf-lhead").attr("title", r.desc);
        head.append("xhtml:span").attr("class", "oa-inf-lsym").style("color", t.ink).html(window.OATheme.mathHtml ? window.OATheme.mathHtml(r.sym) : r.sym);
        head.append("xhtml:span").attr("class", "oa-inf-lname").text(r.name);
        var y = d3.scaleLinear().domain([0, r.max]).range([L.row - L.pad, L.pad]);
        g.append("line").attr("class", "oa-inf-baseline").attr("x1", 0).attr("x2", W).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", t.muted);
        g.append("line").attr("class", "oa-inf-midline").attr("x1", 0).attr("x2", W).attr("y1", y(r.max / 2)).attr("y2", y(r.max / 2)).attr("stroke", t.line);
        g.append("line").attr("class", "oa-inf-limitline").attr("x1", 0).attr("x2", W).attr("y1", y(r.max)).attr("y2", y(r.max)).attr("stroke", t.muted);
        var clip = id + "-clip-" + ri;
        defs.append("clipPath").attr("id", clip).append("rect").attr("x", -L.pad).attr("y", -L.pad).attr("width", W + 2 * L.pad).attr("height", L.row + 2 * L.pad);
        var body = g.append("g").attr("clip-path", "url(#" + clip + ")");
        var band = body.append("rect").attr("class", "oa-inf-band").attr("y", 0).attr("height", L.row).attr("fill", t.accent).attr("fill-opacity", 0.16).attr("display", "none");
        bands.push(function (rg) {
          if (!rg) { band.attr("display", "none"); return; }
          var x0 = x(data.dates[rg.lo]) - step / 2, x1 = x(data.dates[rg.hi]) + step / 2;
          band.attr("display", null).attr("x", x0).attr("width", Math.max(1, x1 - x0));
        });
        var X = function (v, i) { return x(data.dates[i]); };
        if (r.line) {
          data.series.forEach(function (s, k) {
            // The paper graphs' area gradient (influence.js), in the series colour.
            var gid = id + "-area-" + k;
            var grad = defs.append("linearGradient").attr("id", gid).attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
            grad.append("stop").attr("offset", "0%").attr("stop-color", colours[k]).attr("stop-opacity", 0.26);
            grad.append("stop").attr("offset", "100%").attr("stop-color", colours[k]).attr("stop-opacity", 0.03);
            body.append("path").datum(s.c.cum).attr("class", "oa-inf-area").attr("fill", "url(#" + gid + ")")
              .attr("d", d3.area().x(X).y0(y(0)).y1(function (v) { return y(v); }));
            body.append("path").datum(s.c.cum).attr("class", "oa-inf-line").attr("fill", "none").attr("stroke", colours[k]).attr("stroke-width", 1.4)
              .attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("d", d3.line().x(X).y(function (v) { return y(v); }));
          });
        } else {
          // Overlapping bars, tallest behind: every series shows at its own height.
          var bw = Math.max(1, step * 0.7), bars = [];
          for (var i = 0; i < data.n; i++) {
            var col = [];
            data.series.forEach(function (s, k) { if (s.c.monthly[i] > 0) col.push({ i: i, v: s.c.monthly[i], k: k }); });
            col.sort(function (a, b) { return b.v - a.v; });
            bars.push.apply(bars, col);
          }
          body.append("g").attr("class", "oa-inf-bars").selectAll("rect").data(bars).join("rect")
            .attr("x", function (d) { return x(data.dates[d.i]) - bw / 2; }).attr("width", bw)
            .attr("y", function (d) { return y(d.v); }).attr("height", function (d) { return Math.max(0, y(0) - y(d.v)); })
            .attr("fill", function (d) { return colours[d.k]; });
        }
        var line = body.append("line").attr("class", "oa-inf-hoverline").attr("y1", 0).attr("y2", L.row).attr("stroke", t.ink).attr("opacity", 0);
        var dots = r.line ? data.series.map(function (s, k) {
          return body.append("circle").attr("class", "oa-inf-hoverdot").attr("r", 2.8).attr("fill", colours[k]).attr("opacity", 0);
        }) : [];
        hoverers.push(function (i) {
          if (i == null) { line.attr("opacity", 0); dots.forEach(function (d) { d.attr("opacity", 0); }); return; }
          var hx = x(data.dates[i]);
          line.attr("x1", hx).attr("x2", hx).attr("opacity", 1);
          dots.forEach(function (d, k) { d.attr("cx", hx).attr("cy", y(data.series[k].c.cum[i])).attr("opacity", 1); });
        });
        var at = function (event, node) {
          var i = bisect(data.dates, x.invert(d3.pointer(event, node)[0]));
          return Math.max(0, Math.min(data.n - 1, i));
        };
        var cap = g.append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", L.row)
          .attr("fill", "transparent").style("cursor", "crosshair").style("touch-action", "pan-y");
        cap.append("title").text(r.desc + "\nDrag: list only that interval");
        cap.on("mousemove", function (event) { paintHover(at(event, this)); })
          .on("mouseleave", function () { if (!drag) paintHover(null); })
          .on("pointerdown", function (event) {
            if (event.button !== 0) return;
            event.preventDefault();
            var i = at(event, this);
            drag = { a: i, b: i };
            try { this.setPointerCapture(event.pointerId); } catch (e) { /* no capture: the drag ends at the edge */ }
            paintBands();
            paintHover(i);
          })
          .on("pointermove", function (event) {
            if (!drag) return;
            var i = at(event, this);
            if (i === drag.b) return;
            drag.b = i;
            paintBands();
            paintHover(i);
          })
          .on("pointerup", function () {
            if (!drag) return;
            var lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
            drag = null;
            // A plain click picks nothing: only a drag over two months or more.
            if (hi > lo) {
              range = { lo: lo, hi: hi };
              if (actions.range) actions.range(data.months[lo], data.months[hi]);
            }
            paintBands();
            paintHover(hoverIndex);
          })
          .on("pointercancel", function () { if (drag) { drag = null; paintBands(); paintHover(null); } });
      });
      // One time axis under both plots: whole years (months for a short span),
      // each label once, ~64px apart; edge labels anchored inside the plot.
      var spanYears = (x.domain()[1] - x.domain()[0]) / (365.25 * 24 * 3600 * 1000);
      var byMonth = spanYears <= 3;
      var ticks = Math.max(2, Math.min(6, Math.floor(W / 64)));
      var span = byMonth ? d3.utcMonth.count(x.domain()[0], x.domain()[1]) : d3.utcYear.count(d3.utcYear.floor(x.domain()[0]), x.domain()[1]);
      var every = Math.max(1, Math.ceil(span / ticks));
      var axisG = svg.append("g").attr("class", "oa-inf-axis").attr("transform", "translate(0," + (2 * (L.band + L.row) + L.gap) + ")")
        .call(d3.axisBottom(x).ticks(byMonth ? d3.utcMonth.every(every) : d3.utcYear.every(every)).tickSizeOuter(0)
          .tickFormat(d3.utcFormat(byMonth ? "%Y-%m" : "%Y")));
      axisG.selectAll("text").attr("fill", t.muted);
      axisG.selectAll("path, line").attr("stroke", t.line);
      axisG.selectAll(".tick").each(function (d) {
        var tx = x(d), anchor = tx < 30 ? "start" : (tx > W - 30 ? "end" : null);
        if (anchor) d3.select(this).select("text").attr("text-anchor", anchor);
      });
      paintBands();
      paintHover(hoverIndex);
    }
    // Redraw when the width changed - or when the last draw found no width
    // (the panel was hidden) and the plot is still empty.
    function fit() {
      if (destroyed || !data) return;
      var W = Math.round(plot.getBoundingClientRect().width);
      if (W && (Math.abs(W - drawnW) >= 2 || !svgEl.firstChild)) draw();
    }

    var resizeTimer = 0;
    var resizer = new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 60); });
    resizer.observe(plot); resizer.observe(svgEl);
    // The panel is display:none below 1180px; widening the window shows it.
    function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 120); }
    window.addEventListener("resize", onResize);
    // Palette / accent / scheme changes recolour in place (category colours
    // are re-derived for the scheme).
    var themeWatch = window.OATheme.onChange(function () { if (data) draw(); });
    function onGraphStart() { if (data) draw(); }
    window.addEventListener("oa-graph-start", onGraphStart);

    function destroy() {
      destroyed = true;
      token++;
      clearTimeout(resizeTimer);
      resizer.disconnect();
      if (themeWatch) themeWatch.disconnect();
      window.removeEventListener("oa-graph-start", onGraphStart);
      window.removeEventListener("resize", onResize);
      host.innerHTML = "";
      shownKey = "";
      data = null;
    }
    return { show: show, setRange: setRange, destroy: destroy };
  }

  window.OATopicPanel = Object.freeze({ create: create });
})();
