/* oa-tts.js - shared "read the abstract" engine (Web Speech API).

   One reader for the whole site: the article table's abstract drops and any
   future surface share a single player, a single voice list and a single set
   of prefs.

   Why a singleton: window.speechSynthesis IS global - one utterance queue per
   tab. Two independent readers would talk over each other, so this module
   keeps exactly one active target and stops the previous one when a new play
   starts.

   Prefs live in localStorage under "oa-tts-prefs" (voice, rate, highlight) -
   the same key the article page's own Listen popover uses, so a visitor sets
   their voice once and every surface honours it.

   Buttons are wired by DELEGATION on document. SlickGrid rebuilds a drop's
   cell DOM on every render pass, so a per-button listener would be lost on the
   first scroll; a delegated one keeps working, and sync() re-stamps the
   playing state (and re-attaches the read-along highlight) onto whatever
   button markup the grid just rebuilt. */
(function () {
  "use strict";

  var KEY = "oa-tts-prefs";
  var RATE_MIN = 0.5, RATE_MAX = 3, RATE_STEP = 0.25;
  // Nominal pace of a speech engine at rate 1x. Engines differ (roughly
  // 150-180 wpm), so a readout built from this is an estimate, not a measurement.
  var WPM_BASE = 160;
  var synth = window.speechSynthesis;
  var supported = !!(synth && typeof window.SpeechSynthesisUtterance !== "undefined");

  function clampRate(r) {
    r = Number(r);
    if (!isFinite(r)) r = 1;
    r = Math.round(r / RATE_STEP) * RATE_STEP;
    return Math.min(RATE_MAX, Math.max(RATE_MIN, r));
  }
  // Not snapped to the menu's steps: a reading can have a rate of its own (read()).
  function wpm(rate) {
    rate = Number(rate);
    return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, isFinite(rate) ? rate : 1)) * WPM_BASE);
  }

  var prefs = (function () {
    var p = { voiceURI: "", rate: 1, highlight: true };
    var raw = window.OAPrefs.getJSON(KEY, {});
    if (typeof raw.voiceURI === "string") p.voiceURI = raw.voiceURI;
    if (raw.rate != null) p.rate = clampRate(raw.rate);
    if (typeof raw.highlight === "boolean") p.highlight = raw.highlight;
    return p;
  })();
  function save() { window.OAPrefs.setJSON(KEY, prefs); }

  /* ---------------- voices ---------------- */
  // getVoices() is async in most browsers: it returns [] until the engine has
  // enumerated, then fires voiceschanged. Subscribers get called on every
  // refresh so a <select> built too early still fills in.
  var voices = [];
  var voiceSubs = [];
  function refreshVoices() {
    if (!supported) return;
    var lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    voices = synth.getVoices().slice().sort(function (a, b) {
      var al = a.lang.toLowerCase().indexOf(lang) === 0 ? 0 : 1;
      var bl = b.lang.toLowerCase().indexOf(lang) === 0 ? 0 : 1;
      return al - bl || a.name.localeCompare(b.name);
    });
    // A saved voice can be missing from the list - another browser or OS
    // profile, or a list still coming in (Edge adds its online voices in a
    // second round). speak() then falls back to the system default for that
    // utterance; the choice itself stays saved, for when the voice is back.
    voiceSubs.forEach(function (fn) { try { fn(voices); } catch (e) {} });
  }
  if (supported) {
    refreshVoices();
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refreshVoices);
    else synth.onvoiceschanged = refreshVoices;
  }

  /* ---------------- word map ---------------- */
  // Spoken form of one written word. A parenthesised all-caps run - "(FDM)",
  // "(3DCP)," - is the abbreviation an author just spelt out in full, so it is
  // dropped from the utterance: the engine would otherwise spell it letter by
  // letter right after the phrase. Its punctuation stays - "(FDM)." still ends
  // the sentence - and wrapWords() hangs it on the word before. Only the
  // bracketed form is exempt; the same abbreviation used bare later in the
  // text is still read (it is the word). At least one letter is required, so
  // "(2021)" or "(1)" are still spoken, and so are a Roman numeral - "(II)" -
  // and anything with a slash - a grade, "(C30/37)", or a pair, "(PVA/PP)".
  var ABBR_RE = /^[(\[]\s*(?=[^)\]]*[A-Z])([A-Z0-9][A-Z0-9&\/.\-\u2013]+)\s*[)\]]([.,;:]*)$/;
  var ROMAN_RE = /^[IVXLCDM]+$/;
  var PUNCT_RE = /^[.,;:]+$/;   // all that is left of a dropped abbreviation
  function spoken(word) {
    // Typeset CO₂ / m³ are spoken as CO2 / m3 - engines read the sub- and
    // superscript digits inconsistently or skip them. Same length either way.
    var w = String(word || "").replace(/\u00AD/g, "");
    if (window.OATypeset) w = window.OATypeset.fold(w);
    var m = ABBR_RE.exec(w);
    if (!m || ROMAN_RE.test(m[1]) || m[1].indexOf("/") >= 0) return w;
    return m[2];
  }

  // Wrap every word in a span so the spoken one can be highlighted, walking the
  // existing text nodes so the drop's own structure (.abs-sentence spans,
  // <mark> search hits) survives instead of being flattened.
  //
  // A text-node edge is not a word boundary: a search hit can cut a word into
  // "rein" + <mark>force</mark> + "ment". Fragments with no whitespace between
  // them inside one sentence / block are ONE spoken word: the first fragment
  // carries its offset, the others (tails) are highlighted with it.
  var UNIT_SEL = ".abs-sentence, p, li, div, dd, dt, td, th, blockquote, h1, h2, h3, h4, h5, h6";
  function unitOf(node) {
    var p = node.parentNode;
    return p && p.closest ? p.closest(UNIT_SEL) : null;
  }
  function wrapWords(el) {
    var frags = [];
    var nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = walker.nextNode())) nodes.push(n);
    var flush = false, prevUnit = null;   // the text so far ends mid-word, in prevUnit
    nodes.forEach(function (tn) {
      var s = tn.nodeValue;
      if (!s) return;
      var re = /\S+/g, m, last = 0, unit = unitOf(tn);
      var frag = document.createDocumentFragment();
      while ((m = re.exec(s)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        var sp = document.createElement("span");
        sp.className = "oa-tts-w";
        sp.textContent = m[0];
        frag.appendChild(sp);
        frags.push({ span: sp, raw: m[0], joined: m.index === 0 && flush && unit === prevUnit && frags.length > 0 });
        last = m.index + m[0].length;
      }
      flush = last > 0 && last === s.length;
      prevUnit = unit;
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
    // The utterance string is assembled FROM the words, with soft hyphens
    // stripped, so the char offsets handed to onboundary match the text the
    // engine is actually speaking. (The DOM carries \u00AD wherever
    // OATheme.softHyphenate ran, and the drops are hyphenated.) A word the
    // engine will not speak (see spoken) still gets its span - it just adds
    // nothing to the string, so its offset equals the next word's and the
    // boundary search lands on the word actually being said. What is left of
    // a dropped abbreviation, its punctuation, joins the word before it.
    var spans = [], tails = [], offsets = [], text = "";
    for (var i = 0; i < frags.length;) {
      var head = frags[i], raw = head.raw, parts = [];
      for (i++; i < frags.length && frags[i].joined; i++) { parts.push(frags[i].span); raw += frags[i].raw; }
      var say = spoken(raw);
      if (say && text && !PUNCT_RE.test(say)) text += " ";
      offsets.push(text.length);
      text += say;
      spans.push(head.span);
      tails.push(parts);
    }
    return { spans: spans, tails: tails, offsets: offsets, text: text };
  }
  // Memoised per element, so replaying doesn't nest spans inside spans. The
  // cache dies with the node, which is what we want when the grid rebuilds it.
  function wordsFor(el) {
    var w = el.__ttsWords;
    if (w && w.spans.length && el.contains(w.spans[0])) return w;
    el.__ttsWords = wrapWords(el);
    return el.__ttsWords;
  }
  function plainText(el) {
    return (el.textContent || "").replace(/\u00AD/g, "").split(/\s+/).map(spoken).filter(Boolean)
      .reduce(function (s, w) { return s && !PUNCT_RE.test(w) ? s + " " + w : s + w; }, "").trim();
  }

  /* ---------------- player ---------------- */
  var cur = null;   // { id, el, text, offsets, chunks, chunk, at, utter, paused, spans, tails, word, done, rate, own }

  function paintWord(i) {
    if (!cur || !cur.spans) return;
    if (cur.word >= 0) markWord(cur.word, false);
    cur.word = i;
    if (i >= 0) markWord(i, true);
  }
  function markWord(i, on) {
    var head = cur.spans[i];
    if (head) head.classList.toggle("oa-tts-word", on);
    var tail = cur.tails && cur.tails[i];
    if (tail) for (var k = 0; k < tail.length; k++) tail[k].classList.toggle("oa-tts-word", on);
  }

  function wordAtChar(offsets, charIndex) {
    var lo = 0, hi = offsets.length - 1, res = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (offsets[mid] <= charIndex) { res = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return res;
  }

  function paintButtons() {
    var id = cur ? cur.id : null;
    var btns = document.querySelectorAll(".oa-tts-btn");
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      var on = id != null && b.getAttribute("data-tts-id") === id;
      b.classList.toggle("is-playing", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var name = on ? "Stop reading" : BTN_LABEL;
      b.setAttribute("aria-label", name);
      b.title = name;
    }
  }

  /* Reading follows the drop: once the row it belongs to scrolls out of view
     there is nothing to read along with, so the voice stops rather than
     carrying on off-screen. An IntersectionObserver is the right instrument -
     its intersection rect is clipped by every ancestor, so it reports the row
     leaving the grid's OWN scroll viewport, not just the window. (Row removal
     is caught separately in sync(): SlickGrid prunes rows past its render
     buffer, and an observer never fires for a detached node.) */
  var io = null, watched = null, sawVisible = false;
  function unwatch() {
    if (io) { io.disconnect(); io = null; }
    watched = null;
    sawVisible = false;
  }
  // Watch the DROP, not the paragraph: a long abstract's text can start below
  // the fold while its row is plainly in view, and watching the paragraph would
  // read that as "gone" and cut the voice off the moment it started.
  function rowFor(el) { return el.closest(".abs-drop") || el; }
  function watchVisibility(el) {
    var row = rowFor(el);
    if (row === watched) return;
    unwatch();
    watched = row;
    sawVisible = false;
    io = new window.IntersectionObserver(function (entries) {
      if (!cur) return;
      for (var i = 0; i < entries.length; i += 1) {
        var e = entries[i];
        if (e.target !== watched) continue;
        // Stop only on a real transition OUT of view. observe() delivers an
        // initial entry immediately, and a frame that momentarily measures zero
        // intersection (mid-layout, or a host that doesn't composite the frame
        // at all) would otherwise kill playback the instant it started.
        if (e.isIntersecting) sawVisible = true;
        else if (sawVisible) { stop(); return; }
      }
    }, { threshold: 0 });
    io.observe(row);
  }

  // The id of a reading started by read() below: no drop button carries it.
  var FREE_ID = "(free reading)";

  /* One utterance per sentence, and none much over ten seconds. Chrome's
     online voices stop a single utterance after about fifteen seconds and
     never report the end, and an abstract runs for minutes. A sentence ends at
     a word ending in . ! or ? before one that starts with a capital or a digit
     (as bibliography.js splits abstracts, so "e.g. the" stays whole), unless
     that word is a stop-ended abbreviation or an initial - "et al. (2019)",
     "Fig. 3", "J. Smith" go on in one breath; a longer run breaks at its last
     comma, semicolon or colon inside the limit, else at the limit. A chunk is
     a word range of the reading's text, so each utterance's boundary events
     map back onto the words on screen. */
  var END_RE = /[.!?]["'”’)\]]*$/, START_RE = /^["'“‘(\[]?[A-Z0-9]/, CLAUSE_RE = /[,;:]["'”’)\]]*$/;
  var NOT_END_RE = /^(?:(?:[A-Z]\.)+|(?:al|approx|ca|cf|Ch|Eqs?|Figs?|incl|No|pp|Refs?|resp|Sec|Sect|Tab|vs|Vol)\.)$/i;
  function chunksOf(text, offsets, rate) {
    var n = offsets.length, max = Math.max(8, Math.floor(wpm(rate) / 6));   // words in ~10 s
    var word = function (i) { return i < n ? text.slice(offsets[i], i + 1 < n ? offsets[i + 1] : text.length).trim() : ""; };
    var out = [], from = 0, clause = -1;
    function cut(to) {   // words from..to-1; a run of unspoken words makes no chunk
      var start = offsets[from], end = to < n ? offsets[to] : text.length;
      if (text.slice(start, end).trim()) out.push({ start: start, end: end });
      from = to;
      clause = -1;
    }
    for (var i = 0; i < n; i++) {
      var w = word(i);
      if (i === n - 1 || (END_RE.test(w) && !NOT_END_RE.test(w) && START_RE.test(word(i + 1)))) { cut(i + 1); continue; }
      if (CLAUSE_RE.test(w)) clause = i;
      if (i - from + 1 >= max) cut((clause >= from ? clause : i) + 1);
    }
    return out;
  }

  function cancelSpeech() { if (supported) synth.cancel(); }
  // ended === true only from the last chunk's onend: the voice reached the
  // last word. A free reading's done() hears every other way out as false - an
  // error (with the engine's error code, e.g. "not-allowed" before the page
  // has had a click), a new play, a stop() from anywhere else.
  function stop(ended, error) {
    var done = cur && cur.done;
    unwatch();
    // The cancel's own end / error events are not the reading's (some engines
    // fire them at once, inside cancel(), which would end it a second time).
    if (cur) { cur.utter = null; clearTimeout(cur.watch); }
    cancelSpeech();
    if (cur) paintWord(-1);
    cur = null;
    paintButtons();
    if (done) done(ended === true, error);
    // A drop's reading has no caller to tell: the reader hears the voice stop,
    // so the page says why. A cancel or an interruption is a stop, not a failure.
    else if (error && error !== "canceled" && error !== "interrupted" && window.OATheme && window.OATheme.copyToast) {
      window.OATheme.copyToast("Read aloud failed (" + error + ")", false, 3200);
    }
  }
  function stopIf(id) { if (cur && cur.id === String(id)) stop(); }

  // rate: the reading's own speed (read()), else the prefs' one.
  function play(id, el, done, rate) {
    if (!supported || !el) { if (done) done(false); return; }
    var own = isFinite(rate) && rate > 0 ? Math.min(RATE_MAX, Math.max(RATE_MIN, rate)) : null;
    stop();    // clear the old target's highlight and utterance before switching
    var text, spans = null, tails = null, offsets;
    if (prefs.highlight) {
      var w = wordsFor(el);
      text = w.text; spans = w.spans; tails = w.tails; offsets = w.offsets;
    } else {
      text = plainText(el);
      offsets = [];   // the chunks need the word starts either way
      text.replace(/\S+/g, function (m, at) { offsets.push(at); return m; });
    }
    if (!text) { if (done) done(false); return; }
    var r = own || prefs.rate;
    cur = { id: String(id), el: el, spans: spans, tails: tails, offsets: offsets, word: -1, done: done || null,
      text: text, chunks: chunksOf(text, offsets, r), chunk: 0, at: 0, paused: false, utter: null, rate: r, own: own };
    paintButtons();
    // A free reading has no grid row that could scroll out of view.
    if (id !== FREE_ID) watchVisibility(el);
    speak(0, cur.chunks[0].start);
  }

  // Speak chunk k from character `from` (its start, or the word a pause held
  // on); its end starts the next chunk, the last one's ends the reading.
  function speak(k, from) {
    var c = cur.chunks[k];
    var u = new window.SpeechSynthesisUtterance(cur.text.slice(from, c.end));
    var chosen = prefs.voiceURI && voices.filter(function (v) { return v.voiceURI === prefs.voiceURI; })[0];
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    else { u.lang = document.documentElement.lang || "en"; }
    u.rate = cur.rate;
    u.onboundary = function (e) {
      if (!cur || cur.utter !== u) return;
      if (e.name && e.name !== "word") return;
      if (typeof e.charIndex !== "number") return;
      cur.at = from + e.charIndex;
      if (prefs.highlight && cur.spans) paintWord(wordAtChar(cur.offsets, cur.at));
    };
    // On to the next chunk, or the end of the reading.
    function next() {
      if (k + 1 < cur.chunks.length) speak(k + 1, cur.chunks[k + 1].start);
      else stop(true);
    }
    u.onend = function () { if (cur && cur.utter === u) next(); };
    u.onerror = function (e) { if (cur && cur.utter === u) stop(false, e && e.error); };
    cur.chunk = k;
    cur.at = from;
    cur.utter = u;
    // A voice that goes quiet without a word (Chrome's online voices cut an
    // utterance after about 15 s and never report it) would hold the reading
    // for ever: after twice the chunk's time and 3 s more it counts as spoken.
    clearTimeout(cur.watch);
    cur.watch = setTimeout(function () {
      if (!cur || cur.utter !== u) return;
      cur.utter = null;   // the cancel's end / error events are not the reading's
      cancelSpeech();
      next();
    }, (u.text.match(/\S+/g) || []).length / wpm(cur.rate) * 120000 + 3000);
    // The chunk's first word at once: a voice that sends no boundary events
    // still marks where the reading is, a sentence at a time.
    if (prefs.highlight && cur.spans) paintWord(wordAtChar(cur.offsets, from));
    synth.speak(u);
  }

  // Hold the reading where it is (the highlight stays) and go on from the
  // same word later. The engines' own pause() is not to be trusted (Chrome's
  // online voices drop it), so pause() cancels the utterance and resume()
  // speaks the rest of its chunk again, from the word it had reached.
  function pause() {
    if (!cur || cur.paused) return;
    cur.paused = true;
    cur.utter = null;   // the cancel's end / error events are not the reading's
    clearTimeout(cur.watch);
    cancelSpeech();
  }
  function resume() {
    if (!cur || !cur.paused) return;
    cur.paused = false;
    var k = cur.chunk;
    speak(k, Math.max(cur.chunks[k].start, cur.offsets[wordAtChar(cur.offsets, cur.at)]));
  }
  // How much of the current reading has been spoken, 0..1 by characters (per
  // word where the voice sends boundary events, else per chunk); null when
  // nothing is being read.
  function progress() { return cur ? Math.min(1, cur.at / cur.text.length) : null; }

  // Read an element no drop button stands for - the kiosk's full-screen
  // abstract (kiosk.js) - with the same voice and read-along highlight, and
  // the same speed unless rate gives this reading one of its own (the kiosk
  // does). done(ended, error) runs once when the reading stops (at once, if
  // there is nothing to read); ended is true only when the voice reached the
  // end. The caller owns the reading: grid render passes (sync) and the
  // scroll-out watch leave it alone.
  function read(el, done, rate) { play(FREE_ID, el, done, rate); }

  // Re-speak in place after a voice/speed change, so a live change is audible
  // immediately rather than at the next play. A reading with a speed of its
  // own keeps it. A paused one is left alone (re-speaking would read it from
  // the top, aloud): resume() goes on in the new voice, and the next reading
  // takes the new speed.
  function restart() {
    if (!cur || cur.paused) return;
    var id = cur.id, el = cur.el, done = cur.done, own = cur.own;
    if (!el || !document.contains(el)) { stop(); return; }
    cur.done = null;   // re-speaking is not the end of a free reading
    stop();
    play(id, el, done, own);
  }

  /* ---------------- buttons ---------------- */
  var PLAY_SVG = '<svg class="oa-listen-ic-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8l-13 -8"></path></svg>';
  var STOP_SVG = '<svg class="oa-listen-ic-stop" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"></path></svg>';

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // Icon only: the accessible name lives on aria-label (and the tooltip), so
  // there is no visible label to swap - paintButtons() flips both, plus the
  // play/stop glyph, via the .is-playing class.
  //
  // Markup only - state is stamped by sync()/paintButtons(), so a memoised
  // drop string stays valid whatever is playing when it is re-inserted.
  var BTN_LABEL = "Read the abstract";
  function btnHtml(id) {
    if (!supported) return "";
    return '<button type="button" class="oa-listen-btn oa-listen-sm oa-tts-btn"' +
      ' data-tts-id="' + escAttr(id) + '"' +
      ' aria-pressed="false" aria-label="' + BTN_LABEL + '" title="' + BTN_LABEL + '">' +
      '<span class="oa-listen-ic" aria-hidden="true">' + PLAY_SVG + STOP_SVG + "</span></button>";
  }

  function targetFor(btn) {
    var scope = btn.closest(".abs-drop-inner") || btn.closest(".abs-drop") || document;
    return scope.querySelector(".abstract-card-text");
  }

  // Called after a render pass: re-stamp playing state, and re-attach the
  // read-along highlight to the freshly built spans if the playing drop was
  // rebuilt underneath us (speech itself is unaffected - the utterance holds a
  // plain string, not the DOM).
  function sync(root) {
    paintButtons();
    if (!cur || cur.id === FREE_ID) return;   // a free reading has no button to follow
    // Deliberately queried against the whole document, not the calling grid: a
    // page can host several grids (an article page has three), and each one's
    // render pass calls sync(). Scoping this to the caller would make grid A's
    // repaint stop a reading in grid B.
    var sel = '.oa-tts-btn[data-tts-id="' + String(cur.id).replace(/"/g, '\\"') + '"]';
    var btn = document.querySelector(sel);
    // The row this was reading is gone from the DOM entirely (scrolled past the
    // grid's render buffer, or its drop closed by a filter/search) - stop.
    if (!btn) { stop(); return; }
    var el = targetFor(btn);
    if (!el) { stop(); return; }
    // Same drop, rebuilt underneath us: re-point the observer and, if the
    // read-along highlight is on, re-attach it where it left off.
    if (el !== cur.el) {
      cur.el = el;
      watchVisibility(el);
    }
    if (!prefs.highlight) return;
    if (cur.spans && cur.spans.length && document.contains(cur.spans[0])) return;
    var w = wordsFor(el);
    var at = cur.word;
    cur.spans = w.spans; cur.tails = w.tails; cur.offsets = w.offsets; cur.word = -1;
    if (at >= 0) paintWord(at);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".oa-tts-btn") : null;
    if (!btn) return;
    // The drop lives inside a grid row that has its own click handling (open /
    // row-select); reading aloud must not also toggle the row.
    e.preventDefault();
    e.stopPropagation();
    var id = btn.getAttribute("data-tts-id") || "";
    if (cur && cur.id === id) { stop(); return; }
    play(id, targetFor(btn));
  });

  window.addEventListener("beforeunload", cancelSpeech);
  window.addEventListener("pagehide", cancelSpeech);

  window.OATTS = {
    supported: supported,
    RATE_MIN: RATE_MIN, RATE_MAX: RATE_MAX, RATE_STEP: RATE_STEP,
    wpm: wpm,
    btnHtml: btnHtml,
    sync: sync,
    read: read,
    pause: pause,
    resume: resume,
    progress: progress,
    stop: stop,
    stopIf: stopIf,
    onVoices: function (fn) {
      voiceSubs.push(fn); fn(voices);
      return function () { var at = voiceSubs.indexOf(fn); if (at !== -1) voiceSubs.splice(at, 1); };
    },
    getPrefs: function () { return { voiceURI: prefs.voiceURI, rate: prefs.rate, highlight: prefs.highlight }; },
    setVoice: function (uri) { prefs.voiceURI = typeof uri === "string" ? uri : ""; save(); restart(); },
    setRate: function (r) { prefs.rate = clampRate(r); save(); restart(); },
    resetPrefs: function () { prefs.voiceURI = ""; prefs.rate = 1; prefs.highlight = true; save(); restart(); },
    setHighlight: function (on) {
      prefs.highlight = !!on;
      save();
      if (!prefs.highlight && cur) paintWord(-1);
      else if (cur) restart();
    }
  };
})();
