/* paper-affiliation-map.js - Affiliations in the table's right-margin panel
 * (articles-grid.js syncAuthorPanel): while an ID IS filter names one
 * article, its institutions on a world map, under the Centralities.
 *
 * The paper's institutions are numbered in order of first appearance - its
 * authors in order, each author's institutions in theirs - as a paper's header
 * numbers them, and drawn as numbered markers; the countries they are in are
 * shaded. The view fits those countries. Markers keep their size while the land
 * zooms; where they would overlap they spread apart, a hairline back to the
 * true place. Over the map: the fit / whole-world buttons and the counts;
 * under it, the institutions. Hovering a marker or an institution dims the
 * others, a marker's card names its authors, and an institution's name zooms
 * to it. Nothing else moves the map: no wheel, drag or pinch - only the
 * two buttons and the institutions' names.
 *
 * Data: each author's ror on the article record - one or two ROR IDs, primary
 * first. data/tabular_data.js carries none yet, so
 * data/paper_affiliations_sample.js stands in for six papers. Where each
 * institution is: data/affiliation_data.js. Code and data - d3,
 * topojson-client, the country outlines - load with the first such article.
 */
(function () {
  "use strict";

  // px: top margin; half a marker's width (an 18 x 16 tile) and the gap kept
  // between markers. K_MAX: deepest zoom; K_INST: the least zoom an
  // institution's name zooms to.
  var PAD = 4, MR = 9, GAP = 2, K_MAX = 32, K_INST = 12;
  var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  // Fit the paper again; the whole world.
  var ZOOM_BTNS =
    '<button class="oa-map-zbtn" type="button" data-zoom="fit" title="Fit the paper&#39;s institutions" aria-label="Fit the paper&#39;s institutions" disabled>' + SVG +
      '<path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path><circle cx="12" cy="12" r="3"></circle></svg></button>' +
    '<button class="oa-map-zbtn" type="button" data-zoom="world" title="Show the whole world" aria-label="Show the whole world" disabled>' + SVG +
      '<path d="M20 8h-2a2 2 0 0 0 -2 2a2 2 0 1 1 -4 0v-1a2 2 0 0 0 -2 -2h-1a2 2 0 0 1 -2 -2v-.5"></path><path d="M3 12h3a2 2 0 0 1 2 2v.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 1 1.5 1.5v3.25"></path><path d="M15 20.5v-3.5a2 2 0 0 1 2 -2h3.5"></path><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path></svg></button>';

  var state = "idle";       // idle -> loading -> ready | failed
  var listeners = [];
  var feats, land, byName;  // the country outlines, once loaded

  // Other spellings of the outlines' country names: src/world_countries.js.
  function norm(s) { s = String(s || "").trim().toLowerCase(); return window.OA_WORLD_ALIAS[s] || s; }
  var esc = window.OATheme.escapeHtml, fmt = window.OATheme.fmtNum;
  function count(n, one, many) { return fmt(n) + " " + (n === 1 ? one : many); }
  function surname(a) { return [a.prefix, a.lastName].filter(Boolean).join(" ") || a.id; }
  // Surname bold, as in the author panel's lists.
  function nameHtml(p) { return "<b>" + esc(p.last) + "</b>" + (p.first ? ", " + esc(p.first) : ""); }
  function where(a) { return a.city && a.city !== a.country ? a.city + ", " + a.country : a.city || a.country || ""; }

  function load() {
    if (state !== "idle") return;
    state = "loading";
    var A = window.OAAssets;
    (window.d3 ? Promise.resolve() : A.loadScript(A.url("src/vendor/d3.v7.min.js"))).then(function () {
      var next = [];
      if (!window.topojson) next.push(A.url("src/vendor/topojson-client-3.1.0.min.js"));
      if (!window.OA_WORLD) next.push(A.url("src/world_countries.js"));
      if (!window.AFFILIATIONS_DATA) next.push(A.url("data/affiliation_data.js"));
      if (!window.OA_PAPER_AFFILIATIONS_SAMPLE) next.push(A.url("data/paper_affiliations_sample.js"));
      return A.loadScripts(next);
    }).then(function () {
      return window.OA_WORLD;
    }).then(function (topo) {
      if (!topo || !window.topojson) throw new Error("paper-affiliation-map.js: the country outlines did not load");
      feats = topojson.feature(topo, topo.objects.countries).features
        .filter(function (f) { return f.id !== "010"; });   // Antarctica: all margin at world scale
      land = { type: "FeatureCollection", features: feats };
      byName = new Map(feats.map(function (f) { return [norm(f.properties.name), f]; }));
      state = "ready";
    }).catch(function (err) {
      console.error(err);
      state = "failed";
    }).then(function () {
      listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    });
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  // An author's ROR IDs on this paper: their own on the record, else the sample's.
  function rorsOf(item, a) {
    var own = a.ror;
    if (own && own.length) return Array.isArray(own) ? own : String(own).split(/[\s,;]+/);
    var s = window.OA_PAPER_AFFILIATIONS_SAMPLE && window.OA_PAPER_AFFILIATIONS_SAMPLE[item.id];
    return (s && s[a.id]) || [];
  }

  // The paper's institutions, numbered by first appearance; each author's one
  // or two; the countries they are in, with their authors (once each).
  function model(item) {
    var places = window.AFFILIATIONS_DATA || {};
    var insts = [], byRor = new Map();
    var authors = (item.authors || []).map(function (a) {
      if (!a || typeof a !== "object") a = { id: String(a || ""), lastName: String(a || "") };
      var p = { id: a.id, last: surname(a), first: a.firstName || "", insts: [] };
      rorsOf(item, a).forEach(function (r) {
        var id = String(r || "").trim().replace(/^(https?:\/\/)?ror\.org\//i, "").toLowerCase();
        if (!id) return;
        var inst = byRor.get(id);
        if (!inst) {
          var at = places[id];
          if (!at || !isFinite(at.lat) || !isFinite(at.lon)) { console.warn("paper-affiliation-map.js: ROR " + r + " (" + a.id + ") is not in data/affiliation_data.js; left off the map."); return; }
          byRor.set(id, inst = Object.assign({ ror: id, n: insts.length + 1, authors: [] }, at));
          insts.push(inst);
        }
        if (p.insts.indexOf(inst) < 0) { p.insts.push(inst); inst.authors.push(p); }
      });
      return p;
    });
    var countries = new Map(), names = new Set();
    insts.forEach(function (inst) {
      var f = inst.country ? byName.get(norm(inst.country)) : feats.find(function (g) { return d3.geoContains(g, [+inst.lon, +inst.lat]); });
      inst._country = f || null;
      names.add(f ? f.properties.name : norm(inst.country || inst.name));
      if (!f) return;   // Singapore: no outline at this scale; its marker still shows
      var c = countries.get(f);
      if (!c) countries.set(f, c = { insts: [], who: new Set() });
      c.insts.push(inst);
      inst.authors.forEach(function (p) { c.who.add(p); });
    });
    return { authors: authors, insts: insts, countries: countries, nCountries: names.size };
  }

  // panel(host) -> { show(item), destroy() }: the section in the right margin.
  function panel(host) {
    var item = null, shownId = "", off = null;
    // The drawing on show: its model and controls, figure, card, list, buttons.
    var cur = null, view = null, el = null, tip = null, list = null, btn = {}, lit;
    var lastW = 0, lastH = 0, rt = 0, ro = null;

    function section(body) {
      return '<section class="ap-sec ap-paff" aria-label="Affiliations"><h2 class="ap-h">Affiliations</h2>' + body + "</section>";
    }
    function reset() {
      if (ro) { ro.disconnect(); ro = null; }
      clearTimeout(rt);
      cur = view = el = tip = list = null;
      btn = {};
      lit = undefined;
      lastW = lastH = 0;
    }
    function msg(text, id) {
      reset();
      shownId = id || "";
      host.innerHTML = section('<p class="ap-msg">' + esc(text) + "</p>");
    }

    function showTip(title, meta, x, y, rows) {
      tip.innerHTML = "<b>" + esc(title) + "</b><span>" + esc(meta) + "</span>" + (rows && rows.length ? "<ul>" + rows.join("") + "</ul>" : "");
      tip.hidden = false;
      var half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(el.clientWidth - half, x)) + "px";
      tip.style.top = y + "px";
    }
    // Dim every marker and list entry but inst's - or none, for null.
    function light(inst) {
      if (inst === lit || !el) return;
      lit = inst;
      el.querySelectorAll(".oa-pm").forEach(function (g) { g.classList.toggle("is-dim", !!inst && g.__data__.inst !== inst); });
      list.querySelectorAll("[data-i]").forEach(function (li) { li.classList.toggle("is-dim", !!inst && cur.insts[+li.dataset.i] !== inst); });
    }

    // Drawn at the figure's size (see affiliation-map.js): at least the whole
    // world at its width, taller where the panel's column leaves room - the
    // figure grows into it (articles.css) and the world sits centred in it.
    // The closures keep their own drawing, so a transition outliving it
    // touches nothing new.
    function build() {
      var fig = el, tp = tip, bt = btn, mdl = cur, w = fig.clientWidth;
      if (!w) return;
      lastW = w;
      var natH = Math.ceil(d3.geoPath(d3.geoNaturalEarth1().fitWidth(w, land)).bounds(land)[1][1] + 2 * PAD);
      fig.style.minHeight = natH + "px";
      var h = Math.max(natH, Math.floor(fig.clientHeight));
      lastH = h;
      var proj = d3.geoNaturalEarth1().fitExtent([[0, PAD], [w, h - PAD]], land);
      var path = d3.geoPath(proj);

      var old = fig.querySelector(":scope > svg");
      if (old) old.remove();
      tp.hidden = true;
      var svg = d3.create("svg").attr("width", w).attr("height", h).attr("viewBox", [0, 0, w, h]).attr("aria-hidden", "true");
      fig.insertBefore(svg.node(), fig.firstChild);

      // Land and the hover outline are re-projected at every zoom step rather
      // than scaled by a transform on their group: Firefox paints a group
      // whose transform keeps changing into a cached bitmap and stretches it,
      // so the map went blurry while wheel-zooming. zproj is the projection
      // with the zoom folded in. Markers, their leads and true-place dots are
      // placed in screen px. The paper's countries shaded, one marker per
      // institution.
      var zproj = d3.geoNaturalEarth1().scale(proj.scale()).translate(proj.translate()).clipExtent([[-2, -2], [w + 2, h + 2]]);
      var zpath = d3.geoPath(zproj);
      var world = svg.append("g");
      var lands = world.append("g").selectAll("path").data(feats).join("path")
        .attr("class", function (f) { return mdl.countries.has(f) ? "oa-map-land is-on" : "oa-map-land"; });
      var outline = world.append("path").attr("class", "oa-map-outline");
      var m = mdl.insts.map(function (inst) { var p = proj([inst.lon, inst.lat]); return { inst: inst, x: p[0], y: p[1] }; });
      var leads = svg.append("g").selectAll("line").data(m).join("line").attr("class", "oa-pm-lead");
      var anchors = svg.append("g").selectAll("circle").data(m).join("circle").attr("class", "oa-pm-at");
      var marks = svg.append("g").selectAll("g").data(m).join("g").attr("class", "oa-pm");
      marks.append("rect").attr("x", -MR).attr("y", -8).attr("width", 2 * MR).attr("height", 16).attr("rx", 3);
      marks.append("text").attr("dy", "0.35em").text(function (d) { return d.inst.n; });
      var tr = d3.zoomIdentity, moving = false, snapX = 0, snapY = 0;

      // Markers at their places, pushed apart pairwise until none overlap (a
      // paper has a handful), then kept inside the map.
      function spread() {
        var min = 2 * MR + GAP;
        m.forEach(function (d) { d.ax = tr.applyX(d.x) + snapX; d.ay = tr.applyY(d.y) + snapY; d.sx = d.ax; d.sy = d.ay; });
        for (var it = 0; it < 40; it++) {
          var moved = false;
          for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) {
            var a = m[i], b = m[j], dx = b.sx - a.sx, dy = b.sy - a.sy, dist = Math.hypot(dx, dy);
            if (dist >= min - 0.01) continue;
            if (dist < 0.01) { dx = 1; dy = 0; dist = 1; }   // one city: side by side
            var push = (min - dist) / 2;
            a.sx -= dx / dist * push; a.sy -= dy / dist * push;
            b.sx += dx / dist * push; b.sy += dy / dist * push;
            moved = true;
          }
          if (!moved) break;
        }
        m.forEach(function (d) {
          d.sx = Math.max(MR + 1, Math.min(w - MR - 1, d.sx));
          d.sy = Math.max(MR + 1, Math.min(h - MR - 1, d.sy));
          d.off = Math.hypot(d.sx - d.ax, d.sy - d.ay) > MR;   // true place outside the marker
        });
      }
      function place() {
        // The zoom's translate is snapped to whole pixels: a pan then moves
        // every vertex by whole pixels, so the borders' antialiasing stays put
        // instead of shifting from one subpixel phase to the next. Markers
        // take the same snap and stay on their places.
        var s0 = proj.scale(), t0 = proj.translate();
        var tx = t0[0] * tr.k + tr.x, ty = t0[1] * tr.k + tr.y;
        snapX = Math.round(tx) - tx;
        snapY = Math.round(ty) - ty;
        zproj.scale(s0 * tr.k).translate([tx + snapX, ty + snapY]);
        lands.attr("d", zpath);
        spread();
        leads.attr("x1", function (d) { return d.ax; }).attr("y1", function (d) { return d.ay; })
          .attr("x2", function (d) { return d.sx; }).attr("y2", function (d) { return d.sy; })
          .attr("visibility", function (d) { return d.off ? null : "hidden"; });
        anchors.attr("cx", function (d) { return d.ax; }).attr("cy", function (d) { return d.ay; })
          .attr("r", function (d) { return d.off ? 2 : 0; });
        marks.attr("transform", function (d) { return "translate(" + d.sx + "," + d.sy + ")"; });
      }

      function clear() { outline.attr("d", null); tp.hidden = true; }
      function point(e) {
        if (moving) return;
        var g = e.target.closest ? e.target.closest(".oa-pm") : null, f = e.target.__data__;
        if (g) {
          var d = g.__data__;
          outline.attr("d", null);
          showTip(d.inst.name, where(d.inst) + " \u00b7 " + count(d.inst.authors.length, "author", "authors"), d.sx, d.sy - MR - 2,
            d.inst.authors.map(function (p) { return "<li><span>" + nameHtml(p) + "</span></li>"; }));
          light(d.inst);
        } else if (f && f.type === "Feature" && mdl.countries.has(f)) {
          var c = mdl.countries.get(f), at = d3.pointer(e, svg.node());
          outline.attr("d", zpath(f));
          showTip(f.properties.name, count(c.who.size, "author", "authors") + " \u00b7 " + count(c.insts.length, "institution", "institutions"), at[0], at[1]);
          light(null);
        } else { clear(); light(null); }
      }

      // Moved only from code - the fit / whole-world buttons and the
      // institutions' names. The zoom's listeners are never bound to the SVG,
      // so no wheel, drag or pinch reaches it and the panel scrolls over it.
      var zoom = d3.zoom()
        .extent([[0, 0], [w, h]])
        .on("start", function () { moving = true; clear(); })
        .on("zoom", function (e) { tr = e.transform; place(); })
        .on("end", function () { moving = false; sync(); });
      svg.on("pointermove pointerdown", point)
        .on("pointerleave", function (e) { if (e.pointerType !== "touch") { clear(); light(null); } });

      function go(to, now) {
        if (now) svg.call(zoom.transform, to);
        else svg.transition().duration(REDUCED ? 0 : 650).call(zoom.transform, to);
      }
      // The paper's countries fill the view, with any institution outside them
      // (Singapore); a lone point gets some land around it.
      function fitT() {
        var fs = Array.from(mdl.countries.keys()).concat(mdl.insts.filter(function (i) { return !i._country; }).map(function (i) {
          return { type: "Feature", geometry: { type: "Point", coordinates: [+i.lon, +i.lat] } };
        }));
        if (!fs.length) return d3.zoomIdentity;
        var b = path.bounds({ type: "FeatureCollection", features: fs });
        var k = Math.max(1, Math.min(K_MAX, 0.8 / Math.max(Math.max(b[1][0] - b[0][0], 20) / w, Math.max(b[1][1] - b[0][1], 20) / h)));
        return d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-(b[0][0] + b[1][0]) / 2, -(b[0][1] + b[1][1]) / 2);
      }
      function same(a, b) { return Math.abs(a.k - b.k) < 0.01 * b.k && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1; }
      function sync() {
        fig.dataset.zoomed = tr.k > 1.001 ? "true" : "false";
        if (bt.world) bt.world.disabled = tr.k <= 1.001;
        if (bt.fit) bt.fit.disabled = same(tr, fitT());
      }

      view = {
        world: function () { go(d3.zoomIdentity); },
        fit: function () { go(fitT()); },
        // Centre one institution, zoomed in at least to K_INST.
        inst: function (inst) {
          var d = m.find(function (o) { return o.inst === inst; });
          if (d) go(d3.zoomIdentity.translate(w / 2, h / 2).scale(Math.min(K_MAX, Math.max(K_INST, tr.k))).translate(-d.x, -d.y));
        }
      };
      place();
      go(fitT(), true);
      sync();
    }

    function render(next, m) {
      reset();
      shownId = next.id;
      cur = m;
      var part = function (n, one, many) { return "<span><b>" + fmt(n) + "</b> " + (n === 1 ? one : many) + "</span>"; };
      host.innerHTML = section(
        '<div class="ap-inf-tools">' + ZOOM_BTNS + '<span class="ap-paff-key">' +
          part(m.authors.length, "author", "authors") + part(m.insts.length, "institution", "institutions") + part(m.nCountries, "country", "countries") + "</span></div>" +
        '<figure class="oa-map" aria-label="' + esc("World map of the paper's affiliations: " +
          m.insts.map(function (i) { return i.n + ", " + i.name + ", " + where(i); }).join("; ") + ".") + '"></figure>' +
        '<ol class="ap-paff-list">' + m.insts.map(function (inst, i) {
          return '<li data-i="' + i + '"><button class="oa-pa-inst" type="button" title="Zoom to it on the map"><i class="oa-pa-badge">' + inst.n + "</i>" +
            "<span><b>" + esc(inst.name) + "</b><span>" + esc(where(inst) + " \u00b7 " + count(inst.authors.length, "author", "authors")) + "</span></span></button></li>";
        }).join("") + "</ol>");
      el = host.querySelector(".oa-map");
      list = host.querySelector(".ap-paff-list");
      host.querySelectorAll("[data-zoom]").forEach(function (b) { btn[b.getAttribute("data-zoom")] = b; });
      tip = document.createElement("div");
      tip.className = "oa-map-tip";
      tip.hidden = true;
      el.appendChild(tip);
      build();
      light(null);
      // Redrawn when the figure's width or height changes; debounced, as in
      // affiliation-map.js.
      if (window.ResizeObserver) {
        var fig = el;
        ro = new ResizeObserver(function () {
          clearTimeout(rt);
          rt = setTimeout(function () { if (el === fig && (fig.clientWidth !== lastW || Math.max(parseFloat(fig.style.minHeight) || 0, Math.floor(fig.clientHeight)) !== lastH)) { build(); lit = undefined; light(null); } }, 60);
        });
        ro.observe(fig);
      }
    }

    function show(next) {
      if (!next || !next.id) return;
      item = next;
      load();
      if (state === "loading") {
        if (!off) off = onChange(function () { off(); off = null; if (item) show(item); });
        return msg("Loading the map\u2026");
      }
      if (state === "failed") return msg("The map could not be loaded.");
      if (next.id === shownId) return;
      var m = model(next);
      if (!m.insts.length) return msg("No affiliations on record for this paper.", next.id);
      render(next, m);
    }

    // Delegated: the section is rebuilt for each paper.
    function onClick(e) {
      if (!view || !e.target.closest) return;
      var z = e.target.closest("[data-zoom]");
      if (z) { if (z.getAttribute("data-zoom") === "world") view.world(); else view.fit(); return; }
      var li = e.target.closest(".oa-pa-inst") && e.target.closest("[data-i]");
      if (li) view.inst(cur.insts[+li.dataset.i]);
    }
    function onOver(e) {
      if (!list || !list.contains(e.target)) return;
      var li = e.target.closest("[data-i]");
      light(li ? cur.insts[+li.dataset.i] : null);
    }
    function onOut(e) {
      if (list && list.contains(e.target) && !list.contains(e.relatedTarget)) light(null);
    }
    host.addEventListener("click", onClick);
    host.addEventListener("pointerover", onOver);
    host.addEventListener("focusin", onOver);
    host.addEventListener("pointerout", onOut);
    host.addEventListener("focusout", onOut);

    return {
      show: show,
      destroy: function () {
        if (off) { off(); off = null; }
        reset();
        item = null;
        shownId = "";
        host.innerHTML = "";
        host.removeEventListener("click", onClick);
        host.removeEventListener("pointerover", onOver);
        host.removeEventListener("focusin", onOver);
        host.removeEventListener("pointerout", onOut);
        host.removeEventListener("focusout", onOut);
      }
    };
  }

  // Whether an article has institutions on record - for the guided tour
  // (browser-tour.js), which wants a demo article with a map to show. Reads
  // the stand-in sample too, so the tour calls preload() early.
  function hasAffiliations(item) {
    return !!(item && item.id) && (item.authors || []).some(function (a) {
      return !!a && typeof a === "object" && rorsOf(item, a).length > 0;
    });
  }

  window.OAPaperAffiliations = Object.freeze({ panel: panel, preload: load, hasAffiliations: hasAffiliations });
})();
