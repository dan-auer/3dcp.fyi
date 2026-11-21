/* kiosk.js - kiosk mode: full screen, the site reads abstracts aloud, one work
   after another in shuffled order, until stopped - a screen that runs on its
   own at a booth or in a lab.

   Start and stop: the loop button beside day/night in the site header starts
   it; the same button, top right on the kiosk screen, ends it, and so do Esc
   and anything else that leaves full screen. Where the browser refuses full
   screen (a host frame without allow="fullscreen", iPhone Safari) the kiosk
   layer still covers the window, and Esc still ends it.

   From a link: index.html?kiosk - with any ?q= filter - starts it by itself
   once the table is up, so a booth PC comes back on its own after a restart.
   Browsers allow a voice and full screen only after a click or a key press:
   until then the kiosk runs silently and says so, and the first click or key
   brings both. Chrome started as
     chrome --kiosk --autoplay-policy=no-user-gesture-required "<link>"
   is full screen already and speaks without one.

   Works: the table's current selection, as BibTeX and "Open all" take it
   (articles-grid.js, OAArticlesGrid.targetIds) - the marked rows if any,
   otherwise everything the table matches - less the works without an
   abstract. Taken when kiosk mode starts. The order is shuffled, and no work
   comes back before every other one has been read.

   Keys and buttons: Right or Page Down skips, Left or Page Up goes back
   through the works already shown (a move starts the reading over), Space
   pauses, M mutes (a silent slideshow at reading pace, for the rest of the
   visit), Esc ends. The star adds the work on screen to the favorites, or
   removes it. Pointer and buttons hide after IDLE_MS without input (not while
   paused) and come back on any movement, touch or key.

   On screen: the header's breadcrumb, its tail the work's own short link
   (3dcp.fyi/<key>, as the header shows it for a pinned article); n / total of
   the round; a hairline across the top for how much has been read; the title
   and subtitle, with a QR code of the short link beside them, top right
   (qr-code.js, loaded with kiosk mode); below them three columns: the
   abstract, the table of contents (toc.js, as the table's drop-downs show it,
   page numbers and all) and what the table row shows - Date, Authors, Venue,
   Category (full names), Keywords, Access, Citations. On a portrait screen
   the contents and the list sit side by side under the abstract. One type
   size for every work, set by the screen; a long abstract scrolls in its
   column, following the spoken word; a long table of contents moves up with
   the reading (scrollToc()); a list too long for its room is shortened to
   fit, "+N more" (fit()). Every work starts in the same place.
   Styles: the buttons in article.css, the screen in articles.css.

   The voice is the site's one reader (oa-tts.js, OATTS.read), so the voice
   and read-along highlight chosen in Settings > Reader apply here too. The
   speed is the kiosk's own (RATE): a little faster than people talk.
   It speaks a sentence at a time, which keeps Chrome's online voices from
   cutting out mid-abstract.

   Safeguards for running unattended:
   - Stall guard. A reading that runs well past its expected length (its word
     count at the chosen speed) is cut, and the next work comes up. A voice
     that fails outright (none installed, offline) keeps each work on screen
     for about its reading time instead of flicking through the selection.
   - Screen Wake Lock while it runs, so the display does not dim or sleep.
     Refused quietly where the browser, the host frame or battery saver says no.

   Loaded with the page, not on first use like add-paper.js: the full-screen
   request has to run inside the click itself, before anything is awaited. */
(function () {
  "use strict";
  // No speech synthesis, nothing to read with: no button.
  if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") return;

  var PAUSE_BEFORE = 1000;   // ms from a work appearing to its first word
  var PAUSE_AFTER = 3000;    // ms from the last word to the next work
  var IDLE_MS = 3000;        // pointer and buttons hide after this long without input
  // The voice's speed: 1.125x, about 180 words a minute by oa-tts.js's
  // reckoning (160 at 1x); people talk at about 150.
  var RATE = 1.125;
  var QR_JS = "src/javascript/qr-code.js";
  // Every short link drawn at one size: version 5, 37 x 37 modules, holds a
  // link of up to 84 bytes (a key of 67 characters; the longest has 53).
  var QR_VERSION = 5;
  var TOC_WAIT = 15000;      // ms the start waits for the tables of contents (optional)
  var LOAD_WAIT = 90000;     // ms after which a load still under way counts as failed
  var RELOAD_AFTER = 60000;  // ms after a failed load before a kiosk link loads the page again
  var FROM_LINK = /[?&]kiosk(?:[=&]|$)/i.test(location.search);

  function icon(paths) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
  }
  // Tabler: loop, arrow-left / -right, player-pause / -play, volume / volume-3.
  var LOOP_SVG = icon('<path d="M15 7c-1.267 -1.268 -3.066 -2 -5 -2a7 7 0 1 0 0 14c1.934 0 3.75 -.75 5 -2l7 -7"></path><path d="M17 10h5v5"></path>');
  var PREV_SVG = icon('<path d="M5 12l14 0"></path><path d="M5 12l6 6"></path><path d="M5 12l6 -6"></path>');
  var NEXT_SVG = icon('<path d="M5 12l14 0"></path><path d="M13 18l6 -6"></path><path d="M13 6l6 6"></path>');
  var PAUSE_SVG = icon('<path d="M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path><path d="M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"></path>');
  var PLAY_SVG = icon('<path d="M7 4v16l13 -8l-13 -8"></path>');
  var SPEAKER = '<path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"></path>';
  var SOUND_SVG = icon(SPEAKER + '<path d="M15 8a5 5 0 0 1 0 8"></path><path d="M17.7 5a9 9 0 0 1 0 14"></path>');
  var MUTED_SVG = icon(SPEAKER + '<path d="M16 10l4 4m0 -4l-4 4"></path>');
  // The header's breadcrumb: its mark and "3dcp.fyi"; the tail is set per work.
  var CRUMB_HTML = '<svg class="oa-mark oa-mark-top" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><path d="M9 9H63V27H24V45H63V63H9" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>3dcp.fyi';

  var headBtn = null, overlay = null, stage = null, crumbTail = null, countEl = null, barEl = null, hintEl = null;
  var prevBtn = null, nextBtn = null, pauseBtn = null, muteBtn = null, favBtn = null, closeBtn = null;
  var running = false, session = 0, wentFull = false, wantGesture = false;
  var paused = false, muted = false;
  var phase = "";            // the work on screen: "before" | "speak" | "silent" | "after"
  var textEl = null, expected = 0;   // its abstract, and how long reading it should take (ms)
  var guard = 0, readSeq = 0, wake = null, idleTimer = 0, barTimer = 0, loadTimer = 0;
  var underneath = [];       // the page's parts made inert while the kiosk covers them
  var works = null;          // Promise of every work with an abstract; dropped on failure, so a later start retries
  var qrLoad = null;         // the QR encoder's load, once per page
  var pool = null;           // this run's works: the selection taken at start
  var order = [], at = 0;    // the current shuffled round over the pool
  var shown = [], pos = -1;  // the works shown this run, and which one is on screen
  var fitLists = [];         // the item rows of the list on screen, for fit()

  function noop() {}
  function quiet(p) { if (p && p.catch) p.catch(noop); }   // promise-returning DOM calls, old engines return undefined
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function iconButton(svg, label, onClick) {
    var b = el("button", "oa-kiosk-btn");
    b.type = "button";
    b.innerHTML = svg;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.addEventListener("click", onClick);
    return b;
  }
  // Header and kiosk screen carry the same toggle: "Kiosk mode", pressed
  // while it runs.
  function kioskButton(title, pressed) {
    var b = iconButton(LOOP_SVG, "Kiosk mode", toggle);
    b.title = title;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    return b;
  }

  /* ---- The works --------------------------------------------------------
     Every abstract that has a table row, joined by id: the row's fields from
     data/tabular_data.js, the sentences from data/abstract_data.js, the
     contents from data/toc_data.js. All three are downloads the table has
     already made or started, so this is usually
     instant. */
  function loadWorks() {
    if (!works) {
      works = Promise.all([
        window.OATTS || window.OAFeatures.load("tts"),
        window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA"),
        window.OADataLoad,
        // The tables of contents (data-load.js, after the dataset). Optional:
        // a failed or slow download holds nothing up - after TOC_WAIT the
        // works go without, and the column fills in when they land
        // ("oa-toc-ready" below).
        window.OATocLoad && Promise.race([window.OATocLoad.catch(noop), new Promise(function (done) { setTimeout(done, TOC_WAIT); })])
      ]).then(function (got) {
        if (typeof got[0].read !== "function" || typeof got[0].pause !== "function") throw new Error("oa-tts.js is older than kiosk.js");
        var rows = new Map();
        (window.ARTICLES_DATA || []).forEach(function (row) { if (row && row.id) rows.set(row.id, row); });
        var list = [];
        ((got[1] && got[1].records) || []).forEach(function (rec) {
          var row = rec && rows.get(rec.id);
          var sentences = rec && Array.isArray(rec.sentences) ? rec.sentences.filter(Boolean) : [];
          if (row && sentences.length) list.push({ row: row, sentences: sentences });
        });
        return list;
      });
      works.catch(function () { works = null; });
    }
    return works;
  }

  // The selected ids that have an abstract; every work while the table is not
  // up yet (nothing filtered there either).
  function selectionOf(list, ids) {
    if (!ids) return list;
    var byId = new Map(list.map(function (w) { return [w.row.id, w]; }));
    return ids.map(function (id) { return byId.get(id); }).filter(Boolean);
  }

  // Fisher-Yates over a copy of the pool, a new round whenever one is used up.
  // A round never opens on the work the previous one ended with.
  function nextWork() {
    if (at >= order.length) {
      var last = order[order.length - 1];
      order = pool.slice();
      for (var i = order.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
      if (order.length > 1 && order[0] === last) { order[0] = order[order.length - 1]; order[order.length - 1] = last; }
      at = 0;
    }
    return order[at++];
  }

  /* ---- One work on screen ------------------------------------------------ */
  function show(work) {
    var row = work.row, T = window.OATheme, esc = T.escapeHtml, typeset = window.OATypeset.text;
    var store = window.OAArticleStore.get();
    crumbTail.innerHTML = '<span class="oa-sep" aria-hidden="true">/</span><span class="oa-muted">' + esc(row.id) + "</span>";
    favBtn.setAttribute("data-fav-id", row.id);
    favBtn.hidden = false;
    window.OAFavorites.syncButton(favBtn);
    var box = el("article", "oa-kiosk-work");
    var head = el("header", "oa-kiosk-head");
    var heading = el("div", "oa-kiosk-heading");
    heading.appendChild(el("h2", "oa-kiosk-title", typeset(row.title || "")));
    if (row.subtitle) heading.appendChild(el("p", "oa-kiosk-sub", typeset(row.subtitle)));
    var qr = el("figure", "oa-kiosk-qr");
    head.appendChild(heading);
    head.appendChild(qr);
    box.appendChild(head);
    var body = el("div", "oa-kiosk-body");
    var text = el("p", "oa-kiosk-text", typeset(work.sentences.join(" ")));
    var side = el("aside", "oa-kiosk-side");
    var list = el("dl", "oa-kiosk-meta");
    var lists = [];
    // One labeled row; html is markup over escaped text, and empty means the
    // work has nothing there (no venue, no keywords): no row at all.
    function field(label, html) {
      if (!html) return null;
      var pair = el("div");
      var value = el("dd");
      value.innerHTML = html;
      pair.appendChild(el("dt", "", label));
      pair.appendChild(value);
      list.appendChild(pair);
      return value;
    }
    // A row of items (markup each, sep between them) that fit() may shorten.
    function items(label, all, sep) {
      var dd = field(label, all.join(sep));
      if (dd) lists.push({ dd: dd, all: all, sep: sep, shown: all.length });
    }
    // In the row's column order. The date at the row's grain, the month.
    field("Date", esc(String(row.date || "").slice(0, 7)));
    items("Authors", (row.authors || []).map(function (a) {
      var n = window.OABibliography.resolveAuthorName(a);
      return esc([n.given, n.family].filter(Boolean).join(" "));
    }).filter(Boolean), ", ");
    field("Venue", row.venue ? T.ordinalHtml(esc(typeset(row.venue))) : "");
    items("Category", store.categoryCodes(row).map(function (code) {
      var def = store.definitions[code];
      return def ? '<span class="oa-kiosk-chip oa-kiosk-cat" style="' + esc(T.catVars(def.color)) + '">' +
        esc(typeset(def.title || code)) + "</span>" : "";
    }).filter(Boolean), "");
    items("Keywords", (row.keywords || []).map(function (k) {
      return '<span class="oa-kiosk-chip oa-kiosk-kw' + (String(k).charAt(0) === "$" ? "" : " kw-topical") + '">' +
        esc(typeset(k)) + "</span>";
    }), "");
    field("Access", '<span class="oa-kiosk-access"><svg class="' + (row.openAccess ? "oa-icon-open" : "oa-icon-closed") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      T.oaIconPaths(!!row.openAccess) + "</svg>" + (row.openAccess ? "Open access" : "Closed access") + "</span>");
    field("Citations", citations(row, store));
    side.appendChild(list);
    body.appendChild(text);
    body.appendChild(tocOf(row));
    body.appendChild(side);
    box.appendChild(body);
    stage.replaceChildren(box);
    paintQr(qr, row);
    fitLists = lists;
    fit();
    T.softHyphenate(text);   // only where the browser cannot hyphenate itself
    return text;
  }

  // The work's table of contents as the table's drop-downs show it (toc.js:
  // numbers, titles, leader dots, pages), in a view that scrollToc() moves it
  // through. Not a control here: the stylesheet hides the fold chevrons.
  function tocOf(row) {
    var nav = el("nav", "oa-kiosk-toc");
    nav.setAttribute("aria-label", "Table of contents");
    var view = el("div", "oa-kiosk-toc-view");
    var rows = window.TOC_DATA && window.TOC_DATA[row.id];
    var html = rows && window.tocHtml ? window.tocHtml(rows) : "";
    if (html) view.innerHTML = '<div class="oa-ptoc">' + html + "</div>";
    else view.appendChild(el("p", "oa-kiosk-none", "No table of contents"));
    nav.appendChild(view);
    return nav;
  }

  // The list in its room, at the type size and in the place every work gets:
  // while it is taller than the room, the tallest of its item rows (authors,
  // categories, keywords; the first of equals) drops its last item, counted
  // as "+N more", until it fits. Again whenever the room changes: resize
  // (full screen comes in after the first work), a font loaded. On a portrait
  // screen the list sits under the abstract and takes the room it needs, so
  // nothing is dropped there. Should one item a row still not fit, the list
  // is cut at the foot of its box.
  function fit() {
    var list = stage && stage.querySelector(".oa-kiosk-meta");
    if (!list) return;
    // Layout rounds to fractions of a pixel; within a 20th of the list's em
    // counts as level, so every screen of one shape decides alike.
    var slack = parseFloat(getComputedStyle(list).fontSize) / 20;
    fitLists.forEach(function (f) { f.shown = f.all.length; paintItems(f); });
    while (overflow(list) > slack) {
      var top = null, topH = 0;
      fitLists.forEach(function (f) {
        var h = f.dd.getBoundingClientRect().height;
        if (f.shown > 1 && (!top || h > topH + slack)) { top = f; topH = h; }
      });
      if (!top) return;
      top.shown -= 1;
      paintItems(top);
    }
  }
  // How far the list's last row reaches past its box, in px - in fractions,
  // unlike scrollHeight. The rows are display: contents: their cells are the
  // boxes.
  function overflow(list) {
    var cells = list.lastElementChild ? list.lastElementChild.children : [], bottom = -Infinity;
    for (var i = 0; i < cells.length; i += 1) bottom = Math.max(bottom, cells[i].getBoundingClientRect().bottom);
    return bottom - list.getBoundingClientRect().bottom;
  }
  function paintItems(f) {
    var cut = f.all.length - f.shown;
    f.dd.innerHTML = f.all.slice(0, f.shown).join(f.sep) + (cut ? f.sep +
      '<span class="oa-kiosk-more">+' + window.OATheme.fmtNum(cut) + " more</span>" : "");
  }

  // The row's citation count and the second figure its bar shows: without
  // the citing works that share an author with this one, counted as
  // grid-renderers.js does over the in-database citation network
  // (hasCitationGraph() builds that on first use).
  function citations(row, store) {
    var n = store.metricNumber(row.citations);
    if (n === null || n < 0) return "n/a";
    var out = window.OATheme.fmtNum(n);
    if (store.hasCitationGraph()) {
      var ids = function (r) { return (Array.isArray(r.authors) ? r.authors : []).map(window.OAArticleStore.authorIdOf); };
      var own = new Set(ids(row)), shared = 0;
      store.citationsOf(row.id).forEach(function (cid) {
        var p = store.getById(cid);
        if (p && ids(p).some(function (a) { return a && own.has(a); })) shared += 1;
      });
      out += " · " + window.OATheme.fmtNum(Math.max(0, n - shared)) + " without shared authors";
    }
    return out;
  }

  // The work's short link as a QR code in the accent, straight on the page's
  // ground (one SVG path, currentColor). The viewBox is the modules alone, so
  // the code lines up with the title's top and the work's right edge; the
  // space around it (the gap to the title, the screen's margins, the gap to
  // the columns) is wider than the four-module quiet zone the standard asks
  // for. In the dark themes the accent is the lighter colour, which makes
  // the code inverted (light on dark): many phone cameras read that, but not
  // every scanner app does. One version for every link (QR_VERSION), so the
  // modules are the same size whatever the link's length. Its box keeps its
  // place, empty, until the encoder has loaded.
  function paintQr(fig, row) {
    var url = "";
    try { url = window.OABibliography.siteUrl(encodeURIComponent(row.id)); } catch (e) { /* no short link */ }
    var m = fig && url && typeof window.OAQRCode === "function" ? window.OAQRCode(url, QR_VERSION) : null;
    if (!m) return;
    var n = m.length, d = "";
    for (var r = 0; r < n; r += 1) {
      for (var c = 0; c < n; c += 1) if (m[r][c]) d += "M" + c + " " + r + "h1v1h-1z";
    }
    fig.innerHTML = '<svg viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" role="img" aria-label="QR code: ' +
      window.OATheme.escapeHtml(url) + '"><path fill="currentColor" d="' + d + '"></path></svg>';
  }
  function loadQr() {
    if (qrLoad) return;
    qrLoad = window.OAAssets.loadScript(window.OAAssets.url(QR_JS)).then(function () {
      // Drawn into the work already on screen, if that one beat the encoder.
      var fig = stage && stage.querySelector(".oa-kiosk-qr");
      if (running && fig && pos >= 0) paintQr(fig, shown[pos].row);
    }, function () { qrLoad = null; });   // retried at the next start
  }

  // A long abstract scrolls in its column: once the spoken word nears the
  // bottom edge (or has left the box), bring it up to a third of the way down.
  // With no word marked (sound off, highlighting off, no voice) scrollText()
  // moves it with the reading instead.
  function follow() {
    var box = stage.querySelector(".oa-kiosk-text"), word = box && box.querySelector(".oa-tts-word");
    if (!word || box.scrollHeight <= box.clientHeight) return;
    var b = box.getBoundingClientRect(), w = word.getBoundingClientRect();
    if (w.top >= b.top && w.bottom <= b.bottom - b.height / 5) return;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: box.scrollTop + (w.top - b.top) - b.height / 3, behavior: calm ? "auto" : "smooth" });
  }

  /* ---- The phase timer ----------------------------------------------------
     One at a time: the pause before or after a reading, or a silent reading.
     A pause holds it, and the end of the pause picks it up again. */
  var tFn = null, tId = 0, tDue = 0, tLeft = 0;
  function wait(ms, fn) {
    clearTimeout(tId);
    tFn = fn; tLeft = ms; tId = 0;
    if (!paused) { tDue = Date.now() + ms; tId = setTimeout(fire, ms); }
  }
  function fire() { var fn = tFn; tFn = null; tId = 0; if (fn) fn(); }
  function holdWait() { if (tId) { clearTimeout(tId); tId = 0; tLeft = Math.max(0, tDue - Date.now()); } }
  function resumeWait() { if (tFn && !tId) { tDue = Date.now() + tLeft; tId = setTimeout(fire, tLeft); } }
  function clearWait() { clearTimeout(tId); tId = 0; tFn = null; }
  function waitLeft() { return tId ? Math.max(0, tDue - Date.now()) : (tFn ? tLeft : 0); }

  /* ---- The loop ---------------------------------------------------------- */
  // Skip (+1) and undo (-1): back through the works already shown, forward
  // again, then on to new ones from the shuffled round.
  function go(step) {
    if (!running || !pool || pos + step < 0) return;
    pos += step;
    if (pos === shown.length) shown.push(nextWork());
    present(shown[pos]);
  }

  function present(work) {
    readSeq += 1;   // whatever was being read is over: its done() must not move on
    clearWait();
    clearTimeout(guard);
    window.OATTS.stop();
    if (paused) { paused = false; paintControls(); }   // a move plays again
    textEl = show(work);
    // How long the reading should take, by oa-tts.js's own words per minute.
    expected = (textEl.textContent.match(/\S+/g) || []).length / window.OATTS.wpm(RATE) * 60000;
    phase = "before";
    prevBtn.disabled = pos <= 0;
    // A disabled button loses the focus to the page: keep it in the kiosk.
    if (prevBtn.disabled && document.activeElement === prevBtn) overlay.focus({ preventScroll: true });
    countEl.textContent = window.OATheme.fmtNum(pos % pool.length + 1) + " / " + window.OATheme.fmtNum(pool.length);
    paintBar();
    wait(PAUSE_BEFORE, startReading);
  }

  // The reading of the work on screen: aloud, or - muted, or with no voice to
  // be had - a silent stretch of about its reading time.
  function startReading() {
    if (!running) return;
    var seq = ++readSeq, t0 = Date.now();
    if (muted) { phase = "silent"; wait(expected, afterReading); return; }
    phase = "speak";
    armGuard(expected);
    window.OATTS.read(textEl, function (ended, error) {
      if (!running || seq !== readSeq) return;
      clearTimeout(guard);
      if (ended) { afterReading(); return; }
      // Held back until the page has had a click (a kiosk link): say so; the
      // first click or key reads this work again, aloud (gesture()).
      if (error === "not-allowed") { hintEl.hidden = false; wantGesture = true; }
      phase = "silent";
      wait(Math.max(0, expected - (Date.now() - t0)), afterReading);
    }, RATE);
  }
  function afterReading() { phase = "after"; wait(PAUSE_AFTER, function () { go(1); }); }
  // Stall guard: well past the expected length the reading is cut; its done()
  // above then lets the work run out its silent time and moves on.
  function armGuard(ms) {
    var seq = readSeq;
    clearTimeout(guard);
    guard = setTimeout(function () { if (seq === readSeq && !paused) window.OATTS.stop(); }, ms * 1.5 + 10000);
  }

  function togglePause() {
    if (!running || !pool) return;
    paused = !paused;
    if (paused) {
      holdWait();
      clearTimeout(guard);
      if (phase === "speak") window.OATTS.pause();
    } else {
      resumeWait();
      if (phase === "speak") {
        window.OATTS.resume();
        armGuard(expected * (1 - (window.OATTS.progress() || 0)));
      }
    }
    paintControls();
  }

  function toggleMute() {
    if (!running) return;
    muted = !muted;
    paintControls();
    if (!pool) return;
    if (muted && phase === "speak") {
      // On in silence for what the voice had left.
      var left = expected * (1 - (window.OATTS.progress() || 0));
      readSeq += 1;
      clearTimeout(guard);
      window.OATTS.stop();
      phase = "silent";
      wait(left, afterReading);
    } else if (!muted && phase === "silent") {
      // This work again, aloud from the top - still held, if it was paused.
      var held = paused;
      present(shown[pos]);
      if (held) togglePause();
    }
  }

  function paintControls() {
    var p = paused ? "Resume (Space)" : "Pause (Space)";
    pauseBtn.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
    pauseBtn.setAttribute("aria-label", p);
    pauseBtn.title = p;
    muteBtn.innerHTML = muted ? MUTED_SVG : SOUND_SVG;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    overlay.classList.toggle("is-paused", paused);
    noteActivity();
  }

  // The hairline across the top: how much of the work on screen has been read.
  function paintBar() {
    var share = phase === "after" ? 1
      : phase === "speak" ? window.OATTS.progress() || 0
        : phase === "silent" ? 1 - waitLeft() / (expected || 1) : 0;
    share = Math.max(0, Math.min(1, share));
    barEl.style.transform = "scaleX(" + share + ")";
    scrollToc(share);
    scrollText(share);
  }

  // A long abstract with no word marked (sound off, highlighting off in
  // Settings > Reader, no voice) moves with the reading as the contents do,
  // so its end is shown too; with a marked word, follow() leads.
  function scrollText(share) {
    var box = stage && stage.querySelector(".oa-kiosk-text");
    if (!box || box.querySelector(".oa-tts-word")) return;
    var over = box.scrollHeight - box.clientHeight;
    if (over > 1) box.scrollTop = share * over;
  }

  // A table of contents taller than its column moves up with the reading, by
  // the same share as the hairline, so it has shown every entry when the
  // reading ends (and with the sound off, by the end of the silent stretch).
  // The fades mark the edges it runs on past. In % of its own height, so a
  // resize keeps its place. Within a 20th of its em it fits (layout rounding,
  // as in fit()), so it moves and fades alike on every screen of one shape.
  function scrollToc(share) {
    var view = stage && stage.querySelector(".oa-kiosk-toc-view"), list = view && view.firstElementChild;
    if (!list) return;
    var h = list.getBoundingClientRect().height, over = h - view.getBoundingClientRect().height;
    if (over <= parseFloat(getComputedStyle(list).fontSize) / 20) over = 0;
    list.style.transform = over ? "translateY(" + (-share * over / h * 100) + "%)" : "";
    view.classList.toggle("is-above", over > 0 && share > 0);
    view.classList.toggle("is-below", over > 0 && share < 1);
  }

  // Pointer and buttons go after IDLE_MS without input and come back with the
  // next movement, touch or key; while paused they stay.
  function noteActivity() {
    if (!running) return;
    overlay.classList.remove("is-idle");
    clearTimeout(idleTimer);
    if (!paused) idleTimer = setTimeout(function () { overlay.classList.add("is-idle"); }, IDLE_MS);
  }

  // A kiosk link starts without a click, so the browser may hold back the
  // voice and full screen; the first tap, click or key (any but Esc) brings
  // both. On "click", not "pointerdown": a touch counts as a gesture only
  // once the finger lifts.
  function gesture() {
    if (!running || !wantGesture) return;
    wantGesture = false;
    if (document.fullscreenElement !== overlay && overlay.requestFullscreen) quiet(overlay.requestFullscreen());
    if (!hintEl.hidden) {
      hintEl.hidden = true;
      if (pool && pos >= 0) present(shown[pos]);
    }
  }

  /* ---- Screen Wake Lock ---------------------------------------------------- */
  function keepAwake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      if (running) { releaseAwake(); wake = lock; } else quiet(lock.release());
    }, noop);
  }
  function releaseAwake() {
    if (wake) quiet(wake.release());
    wake = null;
  }

  /* ---- Start / stop -------------------------------------------------------- */
  function build() {
    if (overlay) return;
    overlay = el("div", "oa-kiosk");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Kiosk mode");
    overlay.tabIndex = -1;   // takes the focus itself, so Enter presses no button
    var bar = el("div", "oa-kiosk-bar");
    barEl = el("span");
    bar.appendChild(barEl);
    var top = el("div", "oa-kiosk-top");
    var crumb = el("span", "oa-crumb");
    crumb.innerHTML = CRUMB_HTML;
    crumbTail = el("span");
    crumb.appendChild(crumbTail);
    countEl = el("span", "oa-kiosk-count");
    var btns = el("div", "oa-kiosk-btns");
    prevBtn = iconButton(PREV_SVG, "Previous work (← or Page Up)", function () { go(-1); });
    nextBtn = iconButton(NEXT_SVG, "Next work (→ or Page Down)", function () { go(1); });
    pauseBtn = iconButton(PAUSE_SVG, "Pause (Space)", togglePause);
    pauseBtn.classList.add("oa-kiosk-pause");
    muteBtn = iconButton(SOUND_SVG, "Mute (M)", toggleMute);
    // The star toggle, painted by favorites.js (syncButton) for the work on screen.
    favBtn = el("button", "oa-kiosk-btn");
    favBtn.type = "button";
    favBtn.addEventListener("click", function () {
      var id = favBtn.getAttribute("data-fav-id");
      if (!id) return;
      window.OAFavorites.toggle(id);
      window.OAFavorites.syncButton(favBtn);
    });
    closeBtn = kioskButton("Stop kiosk mode (Esc)", true);
    [prevBtn, nextBtn, pauseBtn, muteBtn, favBtn, closeBtn].forEach(function (b) { btns.appendChild(b); });
    top.appendChild(crumb);
    top.appendChild(countEl);
    top.appendChild(btns);
    stage = el("div", "oa-kiosk-stage");
    hintEl = el("p", "oa-kiosk-hint", "Tap, click or press a key to turn the voice on");
    hintEl.hidden = true;
    overlay.appendChild(bar);
    overlay.appendChild(top);
    overlay.appendChild(stage);
    overlay.appendChild(hintEl);
    ["pointermove", "pointerdown", "wheel"].forEach(function (type) { overlay.addEventListener(type, noteActivity, { passive: true }); });
    // The reader marks the spoken word by class (oa-tts.js): follow it.
    new MutationObserver(follow).observe(stage, { subtree: true, attributes: true, attributeFilter: ["class"] });
    // Saved or removed elsewhere (another tab): repaint the star.
    window.OAFavorites.onChange(function () { if (favBtn.hasAttribute("data-fav-id")) window.OAFavorites.syncButton(favBtn); });
  }
  function message(text) { stage.replaceChildren(el("p", "oa-kiosk-msg", text)); }

  function start(fromLink) {
    // Inside .oa-root, which carries the theme's colour and type tokens.
    var host = document.querySelector(".oa-root");
    if (running || !host) return;
    running = true;
    wentFull = false;
    wantGesture = !!fromLink;
    paused = false;
    phase = "";
    pool = null; order = []; at = 0; shown = []; pos = -1;
    var mine = ++session;
    // The selection as the table holds it now, before the kiosk covers it.
    var grid = window.OAArticlesGrid;
    var ids = grid && grid.targetIds ? grid.targetIds().slice() : null;
    window.OATheme.closePopovers();
    build();
    message("Loading abstracts…");
    crumbTail.textContent = "";
    countEl.textContent = "";
    hintEl.hidden = true;
    favBtn.hidden = true;
    favBtn.removeAttribute("data-fav-id");
    prevBtn.disabled = nextBtn.disabled = pauseBtn.disabled = true;
    host.appendChild(overlay);
    // The page under the kiosk takes no focus and no clicks while it runs.
    underneath = Array.prototype.filter.call(host.children, function (n) { return n !== overlay && !n.inert; });
    underneath.forEach(function (n) { n.inert = true; });
    paintControls();
    paintBar();
    headBtn.setAttribute("aria-pressed", "true");
    // Still inside the click: browsers grant full screen only to a user
    // gesture (from a link this is refused, and gesture() asks again).
    if (overlay.requestFullscreen) quiet(overlay.requestFullscreen());
    overlay.focus({ preventScroll: true });
    keepAwake();
    loadQr();
    barTimer = setInterval(paintBar, 250);
    load(mine, ids, fromLink);
  }

  // The works for this run. A load that fails, or is still under way after
  // LOAD_WAIT, says so; started from a kiosk link - a booth, with nobody to
  // close it - the page loads again after RELOAD_AFTER, which retries
  // everything. Works that arrive late still play.
  function load(mine, ids, fromLink) {
    function failed() {
      if (!running || mine !== session) return;
      clearTimeout(loadTimer);
      if (!fromLink) { message("The abstracts could not be loaded. Close kiosk mode and try again."); return; }
      message("The abstracts could not be loaded. Trying again in a minute…");
      loadTimer = setTimeout(function () { if (running && mine === session) location.reload(); }, RELOAD_AFTER);
    }
    loadTimer = setTimeout(failed, LOAD_WAIT);
    loadWorks().then(function (list) {
      if (!running || mine !== session) return;
      clearTimeout(loadTimer);
      var picked = selectionOf(list, ids);
      if (!picked.length) { message("No work in the current selection has an abstract to read."); return; }
      pool = picked;
      nextBtn.disabled = pauseBtn.disabled = false;
      go(1);
    }, failed);
  }

  function stop() {
    if (!running) return;
    running = false;   // first: the reading's done() below must not start the next work
    readSeq += 1;
    clearWait();
    clearTimeout(guard);
    clearTimeout(idleTimer);
    clearTimeout(loadTimer);
    clearInterval(barTimer);
    phase = "";
    if (window.OATTS) window.OATTS.stop();
    releaseAwake();
    if (document.fullscreenElement === overlay) quiet(document.exitFullscreen());
    overlay.classList.remove("is-idle");
    overlay.remove();
    stage.replaceChildren();
    underneath.forEach(function (n) { n.inert = false; });
    underneath = [];
    headBtn.setAttribute("aria-pressed", "false");
    headBtn.focus({ preventScroll: true });
  }

  function toggle() { if (running) stop(); else start(false); }

  // Leaving full screen any way at all (Esc, F11, the browser's own control)
  // ends kiosk mode, but only once it really was full screen: a refused
  // request changes nothing (no fullscreenchange), and the layer carries on
  // in the window.
  document.addEventListener("fullscreenchange", function () {
    if (!running) return;
    if (document.fullscreenElement === overlay) wentFull = true;
    else if (wentFull) stop();
  });
  // The keys, captured on window: none reaches the page underneath while the
  // kiosk runs (the table's Escape hides abstracts, its "/" would focus the
  // hidden search); with a modifier the kiosk's keys stay the browser's
  // (Alt+Left is Back). Esc only works here in the window: in full screen the
  // browser keeps it for itself, and leaving full screen ends the kiosk anyway.
  var KEYS = { Escape: "stop", ArrowRight: "next", PageDown: "next", ArrowLeft: "back", PageUp: "back", " ": "pause", m: "mute", M: "mute" };
  window.addEventListener("keydown", function (e) {
    if (!running) return;
    noteActivity();
    e.stopPropagation();
    var act = !(e.altKey || e.ctrlKey || e.metaKey) && KEYS[e.key];
    // On a kiosk link the first key but Esc brings the voice and full screen
    // (gesture()); while the voice was held back, that is all it does - Enter
    // presses no button, Space pauses nothing.
    if (wantGesture && act !== "stop") {
      var held = !hintEl.hidden;
      gesture();
      if (held) { e.preventDefault(); return; }
    }
    if (!act) return;
    e.preventDefault();
    if (e.repeat && act !== "next" && act !== "back") return;
    if (act === "stop") { stop(); return; }
    if (act === "next") go(1);
    else if (act === "back") go(-1);
    else if (act === "pause") togglePause();
    else toggleMute();
  }, true);
  // Space would also press the focused button, on its keyup.
  window.addEventListener("keyup", function (e) {
    if (running && e.key === " " && !(e.altKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener("click", gesture, true);
  // Tables of contents that landed after the start: the work on screen gets
  // its own (the works after it read them from TOC_DATA anyway).
  window.addEventListener("oa-toc-ready", function () {
    var nav = running && pos >= 0 && stage && stage.querySelector(".oa-kiosk-toc");
    if (nav) nav.replaceWith(tocOf(shown[pos].row));
  });
  // The browser drops a wake lock whenever the page is hidden: take it again.
  document.addEventListener("visibilitychange", function () {
    if (running && document.visibilityState === "visible") keepAwake();
  });
  // The list's room changes with the screen (full screen comes in after the
  // first work) and the type with the fonts: fit the list again. Resize
  // comes at most once a frame.
  window.addEventListener("resize", function () { if (running) fit(); });
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener("loadingdone", function () { if (running) fit(); });
  }

  /* ---- The header button ---------------------------------------------------
     Inserted before day/night. header-actions.js leaves a button it does not
     know where it stands, so it sits in the Site group beside day/night and
     appears, with its label, in the narrow-screen "More" menu. */
  var row = document.querySelector(".oa-root > .oa-top .oa-toprow");
  if (!row) return;
  headBtn = kioskButton("Kiosk mode: read the abstracts aloud, full screen", false);
  row.insertBefore(headBtn, row.querySelector(":scope > .oa-scheme-btn"));

  // index.html?kiosk: start once the table is up and a search from the link
  // (?search=) has been applied, so ?q= and ?search= decide the selection -
  // polled, as table-gate.js waits for rows, for at most a minute. If the
  // table never comes up, the start finds no data either and says so (and
  // load() tries again).
  if (FROM_LINK) {
    (function whenTable(t0) {
      var grid = window.OAArticlesGrid;
      var ready = grid && grid.targetIds && !(grid.searchPending && grid.searchPending());
      if (ready || Date.now() - t0 > 60000) start(true);
      else setTimeout(function () { whenTable(t0); }, 250);
    })(Date.now());
  }
})();
