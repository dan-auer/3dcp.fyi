/* adjacency-matrix.js - adjacency.html: every paper against every paper.
 * Rows cite columns; both axes hold the whole corpus in publication order,
 * oldest first, so the grey "published later" staircase sits top right and
 * the dashed diagonal is each paper against itself. One canvas: below about
 * 1.5 device pixels per paper the citations are binned into a density image,
 * above it each is its own cell. Citations take the accent (TUM blue by day,
 * amber by night); shared-author ones too, struck through once when large enough.
 * Wheel zooms around the pointer, drag pans, a click pins a cell so the
 * readout's links can be followed. Keys on the canvas: + - 0, arrows, Esc.
 * The corpus arrives through data-load.js (parsed off the main thread), so the
 * page paints before the 10 MB file has landed; the matrix builds once it has. */
(function (run) {
  Promise.resolve(window.OADataLoad).then(run, run);
})(function () {
  "use strict";
  var root = document.getElementById("adj");
  if (!root) return;
  var canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d");
  var roA = root.querySelector(".adj-ro-a"), roV = root.querySelector(".adj-ro-v"), roB = root.querySelector(".adj-ro-b");
  var keyEl = root.querySelector("[data-adj-key]"), resetBtn = root.querySelector("[data-adj-reset]");
  var MAXS = 28, GAP = 8, SUMW = 48, M = { left: 40, top: 20, right: GAP + SUMW + 4, bottom: GAP + SUMW + 4 }, NONE = { i: -1, j: -1 };

  var esc = window.OATheme.escapeHtml, fmt = window.OATheme.fmtNum;
  var idOf = window.OAArticleStore.authorIdOf;
  // "Lastname, Firstname" - the site's naming convention.
  function nameOf(a) {
    if (!a || typeof a !== "object") return String(a || "");
    if (a.name) return a.name;
    return [[a.prefix, a.lastName].filter(Boolean).join(" "), a.firstName].filter(Boolean).join(", ");
  }
  function yearOf(p) { var y = /^\d{4}/.exec(String(p.date || "")); return y ? y[0] : ""; }
  // The store's month index; a year-only date counts as its January, no date as -1.
  function monthOf(p) {
    var m = window.OAArticleStore.monthOfOrYear(p.date);
    return m == null ? -1 : m;
  }

  // Publication order, oldest first; undated papers last.
  var papers = (Array.isArray(window.ARTICLES_DATA) ? window.ARTICLES_DATA : []).slice().sort(function (a, b) {
    var da = String(a.date || ""), db = String(b.date || "");
    if (!da !== !db) return da ? -1 : 1;
    return da.localeCompare(db) || String(a.title || "").localeCompare(String(b.title || ""));
  });
  var N = papers.length, at = new Map(), mo = new Int32Array(N), authors = new Array(N), Nd = 0;
  papers.forEach(function (p, i) {
    at.set(String(p.id), i);
    mo[i] = monthOf(p);
    if (mo[i] >= 0) Nd = i + 1;
    authors[i] = new Set((Array.isArray(p.authors) ? p.authors : []).map(idOf).filter(Boolean));
  });
  function shares(i, j) {
    var hit = false;
    authors[i].forEach(function (id) { if (authors[j].has(id)) hit = true; });
    return hit;
  }

  // Edges from refIds (local citations only): row i cites column j.
  var er = [], ec = [], es = [], edgeAt = new Map(), nShared = 0;
  papers.forEach(function (p, i) {
    (Array.isArray(p.refIds) ? p.refIds : []).forEach(function (ref) {
      var j = at.get(String(ref));
      if (j == null || j === i || edgeAt.has(i * N + j)) return;
      var sh = shares(i, j) ? 1 : 0;
      er.push(i); ec.push(j); es.push(sh);
      edgeAt.set(i * N + j, sh);
      nShared += sh;
    });
  });
  var E = er.length, R = Int32Array.from(er), C = Int32Array.from(ec), S = Uint8Array.from(es);
  // Row sums = citations each paper makes here, column sums = citations it
  // receives; each with its shared-author part.
  var rowA = new Int32Array(N), rowS = new Int32Array(N), colA = new Int32Array(N), colS = new Int32Array(N), maxRow = 1, maxCol = 1;
  for (var k0 = 0; k0 < E; k0++) { rowA[R[k0]]++; colA[C[k0]]++; if (S[k0]) { rowS[R[k0]]++; colS[C[k0]]++; } }
  for (var n0 = 0; n0 < N; n0++) { maxRow = Math.max(maxRow, rowA[n0]); maxCol = Math.max(maxCol, colA[n0]); }
  // Each row's cited columns and each column's citing rows, in order - what
  // the arrow keys step through while a cell is pinned.
  var outOf = [], inTo = [], byNum = function (a, b) { return a - b; };
  for (n0 = 0; n0 < N; n0++) { outOf.push([]); inTo.push([]); }
  for (k0 = 0; k0 < E; k0++) { outOf[R[k0]].push(C[k0]); inTo[C[k0]].push(R[k0]); }
  outOf.forEach(function (l) { l.sort(byNum); });
  inTo.forEach(function (l) { l.sort(byNum); });

  // Month blocks (for the staircase) and year starts (grid and labels).
  var months = [], years = [], lastYear = "";
  for (var b0 = 0; b0 < Nd;) {
    var b1 = b0;
    while (b1 < Nd && mo[b1] === mo[b0]) b1++;
    months.push({ start: b0, end: b1 });
    b0 = b1;
  }
  papers.forEach(function (p, i) {
    var y = yearOf(p);
    if (y && y !== lastYear) { years.push({ start: i, year: y }); lastYear = y; }
  });
  function later(i, j) { return mo[i] >= 0 && mo[j] > mo[i]; }

  if (keyEl) {
    keyEl.innerHTML = "<span><b>" + fmt(N) + "</b> works</span><span><b>" + fmt(E) + "</b> citations</span>" +
      "<span><b>" + fmt(nShared) + "</b> between works sharing an author</span>" +
      (N > Nd ? "<span>" + fmt(N - Nd) + " undated, at the end</span>" : "");
  }

  /* ---------- colours, read from the page's tokens ---------- */
  var col = {}, rgb = {}, font = "sans-serif";
  var probe = document.createElement("i");
  probe.style.display = "none";
  root.appendChild(probe);
  var paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function rgbOf(c) {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = c;
    paint.fillRect(0, 0, 1, 1);
    var d = paint.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  function cssColor(v) { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function readColors() {
    ["paper", "ink", "ink-2", "accent"].forEach(function (k) { rgb[k] = rgbOf(cssColor("var(--" + k + ")")); });
    col = {
      paper: rgba(rgb.paper, 1), cites: rgba(rgb.accent, 1),
      later: rgba(rgb.ink, 0.07), grid: rgba(rgb.ink, 0.1), diag: rgba(rgb.ink, 0.4), cross: rgba(rgb.ink, 0.3),
      soft: rgba(rgb.accent, 0.16), sumLight: rgba(rgb.accent, 0.4), label: rgba(rgb["ink-2"], 1), outline: rgba(rgb.ink, 0.9)
    };
    col.key = col.paper + col.cites;
    font = getComputedStyle(root).fontFamily || "sans-serif";
  }

  /* ---------- view: css px per paper, paper index at the plot's top left ---------- */
  // The canvas is just the square plot, its label gutters and the two sum
  // strips, as large as the column's width and the window's height allow -
  // nothing beside it to catch the page's wheel scrolling.
  var view = { s: 1, ox: 0, oy: 0 }, fitS = 1, plot = 0, cssW = 0, cssH = 0, dpr = 1, laidOut = false;
  var figure = canvas.parentNode;
  function layout() {
    var head = document.querySelector(".oa-top");   // the readout sticks under it (adjacency.html)
    root.style.setProperty("--adj-top", (head ? head.offsetHeight : 0) + "px");
    dpr = window.devicePixelRatio || 1;
    var availW = figure.clientWidth, availH = Math.max(420, window.innerHeight - 330);
    var zoom = laidOut ? view.s / fitS : 1;
    plot = Math.max(60, Math.floor(Math.min(availW - M.left - M.right, availH - M.top - M.bottom)));
    cssW = plot + M.left + M.right; cssH = plot + M.top + M.bottom;
    canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    fitS = plot / Math.max(1, N);
    view.s = fitS * zoom;
    laidOut = true;
    layerKey = "";
    clamp();
    schedule();
  }
  function clamp() {
    view.s = Math.min(MAXS, Math.max(fitS, view.s));
    // Whole cells only: the view starts on a cell's edge, never inside one.
    var max = Math.max(0, N - Math.floor(plot / view.s + 1e-6));
    view.ox = Math.round(Math.min(max, Math.max(0, view.ox)));
    view.oy = Math.round(Math.min(max, Math.max(0, view.oy)));
    if (resetBtn) resetBtn.disabled = view.s <= fitS * 1.0001;
  }
  function zoomAt(mx, my, s) {
    var px = (mx - M.left) / view.s + view.ox, py = (my - M.top) / view.s + view.oy;
    view.s = Math.min(MAXS, Math.max(fitS, s));
    view.ox = px - (mx - M.left) / view.s;
    view.oy = py - (my - M.top) / view.s;
    clamp();
    schedule();
  }
  function pan(dx, dy) { view.ox += dx; view.oy += dy; clamp(); schedule(); }
  // Scroll just enough to keep a cell in view, a little clear of the edge.
  function reveal(i, j) {
    var span = Math.floor(plot / view.s + 1e-6), m = Math.min(2, Math.floor(span / 4));
    if (j >= 0) { if (j < view.ox + m) view.ox = j - m; else if (j > view.ox + span - 1 - m) view.ox = j - span + 1 + m; }
    if (i >= 0) { if (i < view.oy + m) view.oy = i - m; else if (i > view.oy + span - 1 - m) view.oy = i - span + 1 + m; }
    clamp();
    schedule();
  }
  function reset() { view.s = fitS; view.ox = view.oy = 0; clamp(); schedule(); }
  function sx(j) { return M.left + (j - view.ox) * view.s; }
  function sy(i) { return M.top + (i - view.oy) * view.s; }
  // The part of the plot that holds whole cells; the rest of the square stays empty.
  function shown() { return Math.min(plot, Math.floor(plot / view.s + 1e-6) * view.s); }
  function lastIndex(o) { return Math.min(N, o + Math.floor(plot / view.s + 1e-6)); }

  /* ---------- the citations layer, redrawn only when the view changes ---------- */
  var layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  var layerKey = "", img = null, cnt = null, touched = null, nTouched = 0;
  function drawLayer() {
    var D = Math.max(1, Math.round(plot * dpr)), s = view.s * dpr;
    var key = D + "|" + s + "|" + view.ox + "|" + view.oy + "|" + col.key;
    if (key === layerKey) return;
    layerKey = key;
    if (layer.width !== D) { layer.width = layer.height = D; img = null; }
    if (s < 1.5) density(D, s); else cells(D, s);
  }
  // Each device pixel holds several papers: count the citations per pixel,
  // denser = more opaque.
  function density(D, s) {
    if (!img) { img = lctx.createImageData(D, D); cnt = new Uint16Array(D * D * 2); touched = new Int32Array(Math.max(1, E)); nTouched = 0; }
    var d = img.data, k, p;
    for (k = 0; k < nTouched; k++) { p = touched[k]; cnt[p * 2] = cnt[p * 2 + 1] = 0; d[p * 4 + 3] = 0; }
    nTouched = 0;
    for (k = 0; k < E; k++) {
      var px = Math.floor((C[k] - view.ox) * s), py = Math.floor((R[k] - view.oy) * s);
      if (px < 0 || py < 0 || px >= D || py >= D) continue;
      p = py * D + px;
      if (!cnt[p * 2] && !cnt[p * 2 + 1]) touched[nTouched++] = p;
      cnt[p * 2 + S[k]]++;
    }
    for (k = 0; k < nTouched; k++) {
      p = touched[k];
      var t = cnt[p * 2] + cnt[p * 2 + 1], c = rgb.accent, q = p * 4;
      d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = t > 2 ? 255 : t > 1 ? 210 : 160;
    }
    lctx.putImageData(img, 0, 0);
  }
  // One cell per citation; shared-author ones struck once when large enough.
  function cells(D, s) {
    lctx.clearRect(0, 0, D, D);
    var inset = s >= 6 ? Math.max(1, Math.floor(s * 0.12)) : 0, w = s - 2 * inset;
    var i0 = view.oy - 1, i1 = view.oy + D / s, j0 = view.ox - 1, j1 = view.ox + D / s, k, x, y;
    lctx.beginPath();
    for (k = 0; k < E; k++) {
      if (R[k] < i0 || R[k] > i1 || C[k] < j0 || C[k] > j1) continue;
      lctx.rect((C[k] - view.ox) * s + inset, (R[k] - view.oy) * s + inset, w, w);
    }
    lctx.fillStyle = col.cites;
    lctx.fill();
    if (s < 6) return;
    lctx.beginPath();
    for (k = 0; k < E; k++) {
      if (!S[k] || R[k] < i0 || R[k] > i1 || C[k] < j0 || C[k] > j1) continue;
      x = (C[k] - view.ox) * s; y = (R[k] - view.oy) * s;
      lctx.moveTo(x + inset, y + inset);
      lctx.lineTo(x + s - inset, y + s - inset);
    }
    lctx.strokeStyle = col.paper;
    lctx.lineWidth = Math.max(1, s * 0.1);
    lctx.stroke();
  }

  /* ---------- frame ---------- */
  var raf = 0, cur = NONE, pin = null;
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }
  function axisLabels(o, start) {
    var out = [], gap = start === M.left ? 36 : 16, first = papers[Math.min(N - 1, Math.max(0, Math.floor(o)))];
    var fy = first ? yearOf(first) : "", last = -1e9;
    if (fy) { out.push({ p: start, y: fy }); last = start; }
    years.forEach(function (y) {
      var p = start + (y.start - o) * view.s;
      if (p <= start || p > start + plot - 8 || p - last < gap) return;
      out.push({ p: p, y: y.year });
      last = p;
    });
    return out;
  }
  // Sums beside the plot: the rows' to the right, the columns' below. One bar
  // per paper - per device pixel the largest, when several share one -
  // square-root scaled to the corpus maximum; the lighter end is the part
  // through shared authors, the hovered paper's bar is drawn in ink.
  var best = null;
  function sumBars(rows) {
    var o = rows ? view.oy : view.ox, A = rows ? rowA : colA, Sh = rows ? rowS : colS, max = rows ? maxRow : maxCol;
    var sd = view.s * dpr, D = Math.round(plot * dpr), L = SUMW * dpr;
    var base = Math.round(((rows ? M.left : M.top) + plot + GAP) * dpr), start = Math.round((rows ? M.top : M.left) * dpr);
    if (!best || best.length !== D) best = new Int32Array(D);
    best.fill(-1);
    var i0 = Math.max(0, Math.floor(o)), i1 = lastIndex(o), i, p;
    for (i = i0; i < i1; i++) {
      if (!A[i]) continue;
      p = Math.max(0, Math.floor((i - o) * sd));
      if (p < D && (best[p] < 0 || A[i] > A[best[p]])) best[p] = i;
    }
    var thick = sd >= 1 ? Math.max(1, Math.round(sd) - (sd >= 4 ? 1 : 0)) : 1;
    var bar = function (i, p, a0, a1) {
      var t = Math.min(thick, D - p);
      if (rows) ctx.rect(base + a0, start + p, a1 - a0, t); else ctx.rect(start + p, base + a0, t, a1 - a0);
    };
    var lens = function (i) { var len = Math.max(1, Math.round(Math.sqrt(A[i] / max) * L)); return [len, Math.round(len * (A[i] - Sh[i]) / A[i])]; };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (var pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (p = 0; p < D; p++) {
        if ((i = best[p]) < 0) continue;
        var l = lens(i);
        if (pass === 0 && l[1] > 0) bar(i, p, 0, l[1]);
        if (pass === 1 && l[0] > l[1]) bar(i, p, l[1], l[0]);
      }
      ctx.fillStyle = pass ? col.sumLight : col.cites;
      ctx.fill();
    }
    var h = rows ? cur.i : cur.j;
    p = Math.floor((h - o) * sd);
    if (h >= 0 && A[h] && p >= 0 && p < D) {
      ctx.beginPath(); bar(h, p, 0, lens(h)[0]);
      ctx.fillStyle = col.outline; ctx.fill();
    }
  }
  // Zoomed in far enough for text, each bar also carries its number, at the
  // strip's far end (the columns' turned to read upwards), haloed in paper.
  function sumNumbers(rows) {
    var o = rows ? view.oy : view.ox, A = rows ? rowA : colA, s = view.s, lo = rows ? M.top : M.left;
    var end = (rows ? M.left : M.top) + plot + GAP + SUMW;
    var i0 = Math.max(0, Math.floor(o)), i1 = lastIndex(o);
    ctx.save();
    ctx.font = "10px " + font;
    ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = col.paper; ctx.fillStyle = col.outline;
    ctx.textBaseline = "middle";
    for (var i = i0; i < i1; i++) {
      var c = lo + (i - o) * s + s / 2, t = fmt(A[i]);
      if (!A[i] || c < lo || c > lo + plot) continue;
      if (rows) { ctx.textAlign = "right"; ctx.strokeText(t, end, c); ctx.fillText(t, end, c); continue; }
      ctx.save();
      ctx.translate(c, end); ctx.rotate(-Math.PI / 2); ctx.textAlign = "left";
      ctx.strokeText(t, 0, 0); ctx.fillText(t, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  function draw() {
    raf = 0;
    if (!N || !plot) return;
    var s = view.s, pw = shown(), x0 = M.left, y0 = M.top, xe = x0 + plot, ye = y0 + plot;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, pw, pw); ctx.clip();
    ctx.fillStyle = col.paper; ctx.fillRect(x0, y0, pw, pw);
    // "Published later": right of each month's block, up to the undated tail.
    ctx.fillStyle = col.later;
    var xd = sx(Nd);
    months.forEach(function (m) {
      var Y = sy(m.start), Y2 = sy(m.end), X = sx(m.end);
      if (Y2 < y0 || Y > ye || X > xe) return;
      ctx.fillRect(X, Y, xd - X, Y2 - Y);
    });
    ctx.strokeStyle = col.grid; ctx.lineWidth = 1 / dpr; ctx.beginPath();
    years.forEach(function (y) {
      var X = sx(y.start), Y = sy(y.start);
      if (X > x0 && X < xe) { ctx.moveTo(X, y0); ctx.lineTo(X, ye); }
      if (Y > y0 && Y < ye) { ctx.moveTo(x0, Y); ctx.lineTo(xe, Y); }
    });
    ctx.stroke();
    // Hovered or pinned row and column (a sum strip names just one of them).
    var band = Math.max(s, 1 / dpr);
    ctx.fillStyle = s * dpr < 3 ? col.cross : col.soft;
    if (cur.i >= 0) ctx.fillRect(x0, sy(cur.i), plot, band);
    if (cur.j >= 0) ctx.fillRect(sx(cur.j), y0, band, plot);
    drawLayer();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer, x0, y0, plot, plot);
    ctx.strokeStyle = col.diag; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(N), sy(N)); ctx.stroke();
    ctx.setLineDash([]);
    if (cur.i >= 0 && cur.j >= 0 && s >= 4) {
      ctx.strokeStyle = col.outline; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx(cur.j) + 0.75, sy(cur.i) + 0.75, s - 1.5, s - 1.5);
    }
    ctx.restore();
    sumBars(true);
    sumBars(false);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s >= 12) { sumNumbers(true); sumNumbers(false); }
    ctx.fillStyle = col.label;
    ctx.font = "11px " + font;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    axisLabels(view.ox, x0).forEach(function (l) { ctx.fillText(l.y, l.p + 2, y0 - 6); });
    // Sum strips: "Σ" where they start, the corpus maximum at their far end.
    var rx = xe + GAP, by = ye + GAP;
    ctx.fillText("\u03a3", rx, y0 - 6);
    ctx.textAlign = "right";
    ctx.fillText(fmt(maxRow), rx + SUMW, y0 - 6);
    axisLabels(view.oy, y0).forEach(function (l) { ctx.fillText(l.y, x0 - 6, l.p + 11); });
    ctx.fillText("\u03a3", x0 - 6, by + 11);
    ctx.fillText(fmt(maxCol), x0 - 6, by + SUMW);
  }

  /* ---------- readout: citing paper | verb | cited paper ---------- */
  // Authors on both papers are highlighted; when two lines do not hold the
  // list it keeps the first, those, and the last, gaps as "...".
  function authorsHtml(p, mark, short) {
    return window.OAMatrix.authorsHtml(p.authors, nameOf, function (id) { return mark.has(id) ? "adj-both" : null; }, short);
  }
  function card(p, mark, sum) {
    var href = "index.html?q=" + encodeURIComponent('ID IS "' + p.id + '"');
    return '<div class="adj-ro-id"><a href="' + esc(href) + '">' + esc(p.id) + '</a><span class="adj-ro-sum">' + sum + "</span></div>" +
      '<div class="adj-ro-t">' + esc(p.title || "") + "</div>" +
      '<div class="adj-ro-au">' + authorsHtml(p, mark, false) + "</div>";
  }
  function sumText(verb, a, s) { return verb + " " + fmt(a) + (s ? " \u00b7 " + fmt(s) + " shared" : ""); }
  function renderReadout() {
    var i = cur.i, j = cur.j;
    if (i < 0 && j < 0) {
      roA.innerHTML = '<div class="adj-ro-hint">Rows cite columns.</div>';
      roV.innerHTML = "";
      roB.innerHTML = '<div class="adj-ro-hint">Point at a cell to compare both works; click to pin it.</div>';
      return;
    }
    var both = i >= 0 && j >= 0, mark = new Set(), e = both ? edgeAt.get(i * N + j) : undefined;
    if (both) authors[i].forEach(function (id) { if (authors[j].has(id)) mark.add(id); });
    roA.innerHTML = i >= 0 ? card(papers[i], mark, sumText("cites", rowA[i], rowS[i])) : '<div class="adj-ro-hint">Rows cite columns.</div>';
    roB.innerHTML = j >= 0 ? card(papers[j], mark, sumText("cited", colA[j], colS[j])) : '<div class="adj-ro-hint">Point at a cell to compare both works.</div>';
    roV.innerHTML = (both ? "<b>" + (e != null ? "cites \u2192" : i === j ? "same work" : later(i, j) ? "predates" : "does not cite") + "</b>" +
      (e ? "<span>shared author</span>" : "") : "") + (pin ? '<span class="adj-pin">pinned \u00b7 arrows \u00b7 Esc</span>' : "");
    [[roA, i >= 0 ? papers[i] : null], [roB, j >= 0 ? papers[j] : null]].forEach(function (x) {
      var au = x[1] && x[0].querySelector(".adj-ro-au");
      if (au && au.scrollHeight > au.clientHeight + 1) au.innerHTML = authorsHtml(x[1], mark, true);
    });
  }
  function setCell(c) {
    if (c.i === cur.i && c.j === cur.j) return;
    cur = c;
    renderReadout();
    schedule();
  }

  /* ---------- input ---------- */
  function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function inPlot(p) { return p.x >= M.left && p.y >= M.top && p.x < M.left + plot && p.y < M.top + plot; }
  function cellAt(p) {
    var j = Math.floor((p.x - M.left) / view.s + view.ox), i = Math.floor((p.y - M.top) / view.s + view.oy);
    var pw = shown(), inX = p.x >= M.left && p.x < M.left + pw, inY = p.y >= M.top && p.y < M.top + pw;
    var okI = i >= 0 && i < N, okJ = j >= 0 && j < N;
    if (inX && inY) return okI && okJ ? { i: i, j: j } : NONE;
    // The sum strips name a row (right) or a column (below).
    if (inY && okI && p.x >= M.left + plot + GAP && p.x < M.left + plot + GAP + SUMW) return { i: i, j: -1 };
    if (inX && okJ && p.y >= M.top + plot + GAP && p.y < M.top + plot + GAP + SUMW) return { i: -1, j: j };
    return NONE;
  }
  var drag = null;
  canvas.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ended or synthetic pointer */ }
    drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, moved: false };
  });
  canvas.addEventListener("pointermove", function (e) {
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add("is-dragging"); }
      if (drag.moved) { view.ox = drag.ox - dx / view.s; view.oy = drag.oy - dy / view.s; clamp(); schedule(); return; }
    }
    if (!pin) setCell(cellAt(local(e)));
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!drag) return;
    var moved = drag.moved;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (moved) return;
    var c = cellAt(local(e));
    if (pin) { pin = null; cur = NONE; setCell(c); }
    else if (c.i >= 0 || c.j >= 0) { pin = c; cur = NONE; setCell(c); }
  });
  canvas.addEventListener("pointercancel", function () { drag = null; canvas.classList.remove("is-dragging"); });
  canvas.addEventListener("pointerleave", function () { if (!pin && !drag) setCell(NONE); });
  canvas.addEventListener("wheel", function (e) {
    var p = local(e);
    if (!inPlot(p)) return;
    e.preventDefault();
    zoomAt(p.x, p.y, view.s * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  }, { passive: false });
  canvas.addEventListener("dblclick", function (e) { var p = local(e); if (inPlot(p)) zoomAt(p.x, p.y, view.s * 3); });
  // Pinned: left / right jump to the previous / next citation in the row, up /
  // down in the column. A pinned sum strip enters its row or column, or moves on.
  function nextIn(list, from, dir) {
    var k;
    if (dir > 0) { for (k = 0; k < list.length; k++) if (list[k] > from) return list[k]; }
    else { for (k = list.length - 1; k >= 0; k--) if (list[k] < from) return list[k]; }
    return -1;
  }
  function stepPin(key) {
    var p = window.OAMatrix.stepPin(key, pin.i, pin.j, N, N,
      function (i, from, d) { return nextIn(outOf[i], from, d); },
      function (j, from, d) { return nextIn(inTo[j], from, d); });
    if (!p) return;
    pin = { i: p.r, j: p.c };
    reveal(pin.i, pin.j);
    setCell(pin);
  }
  canvas.addEventListener("keydown", function (e) {
    var cx = M.left + plot / 2, cy = M.top + plot / 2, step = plot / view.s * 0.15;
    if (e.key === "+" || e.key === "=") zoomAt(cx, cy, view.s * 1.5);
    else if (e.key === "-" || e.key === "_") zoomAt(cx, cy, view.s / 1.5);
    else if (e.key === "0") reset();
    else if (pin && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) stepPin(e.key);
    else if (e.key === "ArrowLeft") pan(-step, 0);
    else if (e.key === "ArrowRight") pan(step, 0);
    else if (e.key === "ArrowUp") pan(0, -step);
    else if (e.key === "ArrowDown") pan(0, step);
    else if (e.key === "Escape" && pin) { pin = null; cur = { i: -2, j: -2 }; setCell(NONE); }
    else return;
    e.preventDefault();
  });
  if (resetBtn) resetBtn.addEventListener("click", reset);

  readColors();
  renderReadout();
  // Only a width change needs a new layout - the height the figure gets from
  // the canvas is our own; deferred out of the observer's delivery.
  var lastW = -1;
  new ResizeObserver(function () {
    if (figure.clientWidth === lastW) return;
    lastW = figure.clientWidth;
    requestAnimationFrame(layout);
  }).observe(figure);
  window.addEventListener("resize", layout);
  // Day / night switch: re-read the tokens.
  var recolor = function () { readColors(); layerKey = ""; schedule(); };
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true });
  var oaRoot = root.closest(".oa-root");
  if (oaRoot) new MutationObserver(recolor).observe(oaRoot, { attributes: true });
});
