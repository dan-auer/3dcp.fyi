/* affiliation-map.js - the affiliations map on map-affiliations.html.
 *
 * One dot per city in window.OA_AFFILIATIONS - institutions in the same city
 * share it - its area proportional to their papers; each country shaded in four
 * accent steps by the
 * papers of the institutions in it (log-spaced, so one large country does not
 * wash out the rest). Hover names the nearest dot - found through a Delaunay
 * index, so it still works where dots crowd - or else the shaded country under
 * the pointer. Countries without affiliations stay plain and silent.
 *
 * Data: window.OA_AFFILIATIONS (in the page) gives { ror, papers } per
 * institution; name, city, country and lat / lon come from
 * data/affiliation_data.js by ROR ID.
 *
 * Zoom (to 32x): the mouse wheel, pinch, drag to pan, and a click on a shaded
 * country or a dot fits that country - click it again, or the globe button by
 * the heading, for the whole world. Wheeling out at full view (or in at 32x)
 * scrolls the page instead. The land scales;
 * dots keep their size and spread apart, so dense regions (Europe) open up.
 *
 * Drawn at the column's real width, redrawn on resize; colours are classes on
 * the shared palette tokens, so the day/night toggle needs no redraw.
 * Requires d3 and topojson-client (src/vendor) and the outlines in
 * src/world_countries.js, where Crimea is already part of Ukraine. All served
 * by the site: the map makes no outside requests.
 */
(function () {
  "use strict";

  // px: top margin, largest and smallest dot radius, hover reach beyond a dot.
  // K_MAX: deepest zoom - deep enough to part neighbours like Ghent, Delft and
  // Eindhoven; the 110m outlines are coarse there but still place the dots.
  var PAD = 4, R_MAX = 7, R_MIN = 2, REACH = 6, K_MAX = 32;
  var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var el = document.getElementById("oa-map");
  if (!el) return;
  // Each record's name and place from data/affiliation_data.js, by its ROR ID
  // (with or without https://ror.org/); fields on the record itself win.
  var PLACES = window.AFFILIATIONS_DATA || {};
  var data = (window.OA_AFFILIATIONS || []).map(function (a) {
    if (!a || !a.ror) return a;
    var id = String(a.ror).trim().replace(/^(https?:\/\/)?ror\.org\//i, "").toLowerCase();
    if (!PLACES[id]) { console.warn("map-affiliations.html: ROR " + a.ror + " is not in data/affiliation_data.js; left off the map."); return null; }
    return Object.assign({}, PLACES[id], a);
  }).filter(function (a) {
    return a && isFinite(a.lat) && isFinite(a.lon) && a.papers > 0;
  });
  var tip = document.createElement("div");
  tip.className = "oa-map-tip";
  tip.hidden = true;
  var btn = {};
  document.querySelectorAll("[data-zoom]").forEach(function (b) { btn[b.dataset.zoom] = b; });
  var feats, land, byCountry, places, ctl = null;

  function fail(err) {
    if (err) console.error(err);
    el.dataset.state = "error";
    el.innerHTML = '<p class="oa-map-msg">The map could not be loaded.</p>';
  }
  if (!window.d3 || !window.topojson) { fail(); return; }

  // Other spellings of the outlines' country names: src/world_countries.js.
  function norm(s) { s = String(s || "").trim().toLowerCase(); return window.OA_WORLD_ALIAS[s] || s; }
  var esc = window.OATheme.escapeHtml, fmt = window.OATheme.fmtNum;
  function count(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }

  function showTip(title, meta, x, y, rows) {
    tip.innerHTML = "<b>" + esc(title) + "</b><span>" + esc(meta) + "</span>" + (rows ? "<ul>" + rows.map(function (m) {
      return "<li><span>" + esc(m.name) + "</span><span>" + fmt(+m.papers) + "</span></li>";
    }).join("") + "</ul>" : "");
    tip.hidden = false;
    var half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(el.clientWidth - half, x)) + "px";
    tip.style.top = y + "px";
  }

  // The width the current drawing was made for: the resize check compares
  // against it, not against a read taken after the svg went in (which can
  // already include the scrollbar the taller page brought).
  var lastW = 0;
  function render() {
    var w = el.clientWidth;
    if (!w) return;
    lastW = w;
    var proj = d3.geoNaturalEarth1().fitWidth(w, land);
    var t = proj.translate();
    proj.translate([t[0], t[1] + PAD]);
    var path = d3.geoPath(proj);
    var h = Math.ceil(path.bounds(land)[1][1] + PAD);

    var old = el.querySelector(":scope > svg");
    if (old) old.remove();
    tip.hidden = true;
    var svg = d3.create("svg").attr("width", w).attr("height", h).attr("viewBox", [0, 0, w, h]).attr("aria-hidden", "true");
    el.insertBefore(svg.node(), el.firstChild);

    // Land and the hover outline scale with the zoom (strokes stay hairline:
    // non-scaling-stroke in the CSS); dots and the ring are placed in screen px.
    var world = svg.append("g");
    world.append("g").selectAll("path").data(feats).join("path")
      .attr("class", function (d) { return d.step ? "oa-map-land is-step-" + d.step : "oa-map-land"; })
      .attr("d", path);
    var outline = world.append("path").attr("class", "oa-map-outline");

    var r = d3.scaleSqrt().domain([0, d3.max(places, function (pl) { return pl.papers; }) || 1]).range([0, R_MAX]);
    var dots = places.map(function (pl) {
      var p = proj([pl.lon, pl.lat]);
      return { p: pl, x: p[0], y: p[1], r: Math.max(R_MIN, r(pl.papers)) };
    });
    var dot = svg.append("g").selectAll("circle")
      .data(dots.slice().sort(function (p, q) { return q.r - p.r; }))   // small dots on top
      .join("circle")
      .attr("class", "oa-map-dot")
      .attr("r", function (d) { return d.r; });
    var ring = svg.append("circle").attr("class", "oa-map-ring").attr("r", 0);
    var near = dots.length ? d3.Delaunay.from(dots, function (d) { return d.x; }, function (d) { return d.y; }) : null;

    // touched: what the last tap landed on. A touch has no hover: the tap's
    // tip was cleared as the zoom gesture started on touchstart, and the
    // zoom to its country then moved the dot - so after every zoom the tip
    // is shown again, where the tapped dot or country now is.
    var tr = d3.zoomIdentity, focus = null, moving = false, touched = null;
    function place() {
      world.attr("transform", tr);
      dot.attr("cx", function (d) { return tr.applyX(d.x); }).attr("cy", function (d) { return tr.applyY(d.y); });
    }
    place();

    function clear() { outline.attr("d", null); ring.attr("r", 0); tip.hidden = true; }
    // What the pointer is on: the nearest dot within reach, else a shaded country.
    function hit(e) {
      var p = d3.pointer(e, svg.node()), q = tr.invert(p);
      var d = near ? dots[near.find(q[0], q[1])] : null;
      if (d && Math.hypot(tr.applyX(d.x) - p[0], tr.applyY(d.y) - p[1]) <= d.r + REACH) return { dot: d };
      var f = e.target.__data__;
      return f && f.step ? { country: f, at: p } : null;
    }
    function point(e) {
      if (moving) return;
      var o = hit(e);
      if (e.pointerType === "touch") touched = o;
      tipFor(o);
    }
    function tipFor(o) {
      if (o && o.dot) {
        var d = o.dot, x = tr.applyX(d.x), y = tr.applyY(d.y), pl = d.p, one = pl.members[0];
        outline.attr("d", null);
        ring.attr("cx", x).attr("cy", y).attr("r", d.r + 3);
        if (pl.members.length === 1) showTip(one.name, (one.city ? one.city + " · " : "") + count(+one.papers, "paper", "papers"), x, y - d.r - 3);
        else showTip(pl.city, count(pl.members.length, "institution", "institutions") + " · " + count(pl.papers, "paper", "papers"), x, y - d.r - 3, pl.members);
      } else if (o) {
        var c = byCountry.get(o.country);
        ring.attr("r", 0);
        outline.attr("d", path(o.country));
        showTip(o.country.properties.name, count(c.papers, "paper", "papers") + " · " + count(c.n, "institution", "institutions"), o.at[0], o.at[1]);
      } else clear();
    }
    // The tapped item's tip again, after a zoom: a dot where it now is, a
    // country over its centre (the tapped point has moved with the map).
    function retouch() {
      if (!touched) return;
      if (touched.country) touched.at = tr.apply(path.centroid(touched.country));
      tipFor(touched);
    }

    var zoom = d3.zoom()
      .scaleExtent([1, K_MAX])
      .extent([[0, 0], [w, h]])
      .translateExtent([[0, 0], [w, h]])
      // Plain wheel zooms (a trackpad pinch arrives as Ctrl + wheel). The page
      // scrolls on past the map once the zoom hits either end of its range.
      .filter(function (e) {
        if (e.type !== "wheel") return !e.button;
        var k = d3.zoomTransform(svg.node()).k;
        return !(e.deltaY > 0 && k <= 1.001) && !(e.deltaY < 0 && k >= K_MAX - 0.001);
      })
      .wheelDelta(function (e) {
        var v = -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.0035) * (e.ctrlKey ? 10 : 1);
        return Math.max(-0.5, Math.min(0.5, v));   // one mouse notch: ~1.3x, not 4x
      })
      .on("start", function () { moving = true; clear(); })
      // A finger that pans or pinches has moved on from the tapped item.
      .on("zoom", function (e) { tr = e.transform; place(); if (e.sourceEvent && e.sourceEvent.type === "touchmove") touched = null; })
      .on("end", function () { moving = false; sync(); retouch(); });
    svg.call(zoom).on("dblclick.zoom", null);

    function go(to) { svg.transition().duration(REDUCED ? 0 : 650).call(zoom.transform, to); }
    function fit(f) {
      var b = path.bounds(f);
      var k = Math.min(K_MAX, 0.8 / Math.max((b[1][0] - b[0][0]) / w, (b[1][1] - b[0][1]) / h));
      return d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-(b[0][0] + b[1][0]) / 2, -(b[0][1] + b[1][1]) / 2);
    }
    svg.on("pointermove pointerdown", point)
      .on("pointerleave", function (e) { if (e.pointerType !== "touch") clear(); })
      .on("click", function (e) {
        var o = hit(e);
        if (!o) return;
        var f = o.dot ? o.dot.p.country : o.country;
        var key = f || o.dot;
        if (focus === key) { focus = null; go(d3.zoomIdentity); return; }
        focus = key;
        // A dot with no country polygon (Singapore): zoom in around the dot itself.
        go(f ? fit(f) : d3.zoomIdentity.translate(w / 2, h / 2).scale(6).translate(-o.dot.x, -o.dot.y));
      });

    function sync() {
      if (tr.k <= 1.001) focus = null;
      el.dataset.zoomed = tr.k > 1.001 ? "true" : "false";
      if (btn.reset) btn.reset.disabled = tr.k <= 1.001;
    }
    sync();
    ctl = { reset: function () { focus = null; go(d3.zoomIdentity); } };
  }

  if (btn.reset) btn.reset.addEventListener("click", function () { if (ctl) ctl.reset(); });

  Promise.resolve(window.OA_WORLD).then(function (topo) {
    if (!topo) throw new Error("src/world_countries.js did not load");
    feats = topojson.feature(topo, topo.objects.countries).features
      .filter(function (f) { return f.id !== "010"; });   // Antarctica: all margin at world scale
    land = { type: "FeatureCollection", features: feats };
    var byName = new Map(feats.map(function (f) { return [norm(f.properties.name), f]; }));

    // Country of each institution: its country name; only a record without one
    // takes the polygon under its dot. A named country with no outline
    // (Singapore) stays unshaded - the coarse 110m Malaysia covers Singapore.
    byCountry = new Map();
    var countries = new Set();
    data.forEach(function (a) {
      var f = a.country ? byName.get(norm(a.country)) : feats.find(function (g) { return d3.geoContains(g, [+a.lon, +a.lat]); });
      a._country = f || null;
      countries.add(f ? f.properties.name : norm(a.country || a.name));
      if (!f) {
        console.warn("map-affiliations.html: " + (a.country || "the country") + " (" + a.name + ") is not on the map - too small at this scale; its dot still shows.");
        return;
      }
      var c = byCountry.get(f) || { papers: 0, n: 0 };
      c.papers += +a.papers;
      c.n += 1;
      byCountry.set(f, c);
    });

    // One dot per city: institutions a few km apart would sit on top of each
    // other at any zoom. Placed at the paper-weighted centre of its members,
    // sized by their total; the hover card lists them, largest first.
    var byPlace = new Map();
    data.forEach(function (a) {
      var k = (a.city ? norm(a.city) : "@" + a.name) + "|" + (a._country ? a._country.properties.name : norm(a.country));
      var pl = byPlace.get(k);
      if (!pl) byPlace.set(k, pl = { city: a.city || a.name, country: a._country, members: [], papers: 0, lat: 0, lon: 0 });
      pl.members.push(a);
      pl.papers += +a.papers;
    });
    places = Array.from(byPlace.values(), function (pl) {
      pl.members.sort(function (p, q) { return q.papers - p.papers; });
      pl.lat = d3.sum(pl.members, function (a) { return a.lat * a.papers; }) / pl.papers;
      pl.lon = d3.sum(pl.members, function (a) { return a.lon * a.papers; }) / pl.papers;
      return pl;
    });

    // Four log-spaced steps between the smallest and largest country total.
    var totals = Array.from(byCountry.values(), function (c) { return c.papers; });
    var lo = d3.min(totals) || 0, hi = d3.max(totals) || 0;
    var step = d3.scaleQuantize().domain([Math.log(lo || 1), Math.log(hi || 1)]).range([1, 2, 3, 4]);
    feats.forEach(function (f) {
      var c = byCountry.get(f);
      f.step = !c ? 0 : lo === hi ? 4 : step(Math.log(c.papers));
    });

    var set = function (sel, html) { var n = document.querySelector(sel); if (n) n.innerHTML = html; };
    set('[data-map-count="institutions"]', "<b>" + fmt(data.length) + "</b> " + (data.length === 1 ? "institution" : "institutions"));
    set('[data-map-count="countries"]', "<b>" + fmt(countries.size) + "</b> " + (countries.size === 1 ? "country" : "countries"));
    set("[data-map-lo]", fmt(lo));
    set("[data-map-hi]", fmt(hi));
    ["oa-map-key", "oa-map-legend"].forEach(function (id) { var n = document.getElementById(id); if (n) n.hidden = !data.length; });
    el.setAttribute("aria-label", "World map of " + count(data.length, "affiliation", "affiliations") + ": " +
      data.map(function (a) { return a.name + " (" + count(+a.papers, "paper", "papers") + ")"; }).join(", ") + ".");

    el.dataset.state = "ready";
    el.appendChild(tip);
    render();
    // Debounced, as in influence.js: render() swaps the svg, which resizes the
    // observed figure - redrawing inside the same delivery trips a loop error.
    var rt = 0;
    new ResizeObserver(function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (el.clientWidth !== lastW) render(); }, 60);
    }).observe(el);
  }).catch(fail);
})();
