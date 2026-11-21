/* add-paper.js - guided "Suggest a paper" flow for the landing page.
 *
 * Replaces the plain mailto on the "add a paper" button with a small modal
 * wizard that pre-screens a suggestion before it ever reaches the maintainer:
 *
 *   1. Ask for a DOI (or, via the "no DOI" checkbox, a URL).
 *      - DOI is normalised and checked against window.ARTICLES_DATA:
 *          already indexed -> show it, link straight to its page.
 *          not found       -> continue.
 *      - URL mode skips the duplicate check and continues.
 *   2. Ask for the title and the date (YYYY-MM). Both scope checks run together
 *      and any failures are shown in a single panel cleared by one "send anyway":
 *      - title should contain at least one indexed keyword. Skipped entirely if
 *        the keyword vocabulary failed to load, so we never reject everything.
 *      - date should be MORE than MIN_AGE_MONTHS months in the past.
 *   3. Checks pass (or are overridden) -> open a pre-filled mailto: to the
 *      maintainer; overridden suggestions are flagged for manual review.
 *
 * Dependencies (all optional/guarded): window.ARTICLES_DATA,
 * window.OATheme.escapeHtml, window.OA_REL_ROOT. The component is self-contained:
 * it injects its own .oa-ap-* styles (through OADialog.overlayFrame), binds via event delegation,
 * and lazy-loads the data files it needs the first time it's opened.
 *
 * No-JS / no-data fallback: the anchor keeps its original mailto href, so if
 * this script never runs (or the data never loads) the button still works.
 */
(function () {
  "use strict";

  // The canonical contact target lives on the "add a paper" button (the same
  // anchor that is the no-JS fallback). contact() reads the recipient + subject
  // off that href so they aren't re-declared here and can't drift; these are
  // only used if the button is missing or its href can't be parsed.
  var DEFAULT_MAINTAINER = "message@3dcp.fyi";
  var DEFAULT_SUBJECT = "[3dcp.fyi] Paper contribution";
  // A suggestion is only accepted once the paper is older than this many months.
  var MIN_AGE_MONTHS = 3;

  var _contact = null;
  function contact() {
    if (_contact) return _contact;
    _contact = window.OATheme.mailtoFromButton("a.oa-add-btn", { email: DEFAULT_MAINTAINER, subject: DEFAULT_SUBJECT });
    return _contact;
  }

  var REL = (typeof window.OA_REL_ROOT === "string") ? window.OA_REL_ROOT : "";

  /* ---------- data helpers ------------------------------------------- */

  // Vocabulary and DOI lookups share the immutable dataset index.
  // Topic (#) keywords only, without the sigil: a title never contains
  // "#concrete", and the generic $ terms ($use, $model) would pass any title.
  function keywordList() {
    var out = new Set();
    window.OAArticleStore.get().facets().keywords.forEach(function (keyword) {
      var s = String(keyword).trim();
      if (s.charAt(0) !== "#") return;
      s = s.replace(/^#\s*/, "").trim().toLowerCase();
      if (s) out.add(s);
    });
    return Array.from(out);
  }
  function normalizeDoi(raw) { return window.OABibliography.normalizeDoi(raw).toLowerCase(); }
  function findByDoi(doi) { return window.OAArticleStore.get().findByDoi(doi); }

  // The list pinned to this article (ID IS "<key>"); the per-article pages
  // were retired.
  function articleUrl(a) {
    return REL + 'index.html?q=' + encodeURIComponent('ID IS "' + a.id + '"');
  }

  // Which indexed keywords appear in the title? Matches at a word start and
  // allows an inflectional suffix, so "print" also hits "printing/prints",
  // "material" hits "materials", "cement" hits "cementitious", etc. - a strict
  // \bkw\b match would wrongly reject obviously in-scope plurals/gerunds.
  // The compiled regexes are memoised (rebuilt only if the vocabulary changes,
  // e.g. after the article table lazy-loads).
  var _kwRes = null, _kwSrc = null;
  function keywordRegexes() {
    var src = window.OAArticleStore.get();
    if (_kwRes && _kwSrc === src) return _kwRes;   // stable across mutable grid views, refreshed on dataset revision
    _kwSrc = src;
    _kwRes = keywordList().map(function (kw) {
      return { kw: kw, re: new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z]*", "i") };
    });
    return _kwRes;
  }

  function matchedKeywords(title) {
    var lc = String(title || "").toLowerCase();
    var hits = [];
    keywordRegexes().forEach(function (k) {
      if (k.re.test(lc)) hits.push(k.kw);
    });
    return hits;
  }

  // Months the paper date sits in the past (positive = past, negative = future).
  // Returns null if the input is not a valid YYYY-MM string.
  function monthsInPast(ym) {
    var m = /^(\d{4})-(\d{1,2})$/.exec(String(ym || "").trim());
    if (!m) return null;
    var py = +m[1], pm = +m[2];
    if (pm < 1 || pm > 12) return null;
    return window.OAArticleStore.currentMonth() - (py * 12 + (pm - 1));
  }

  /* ---------- mailto ------------------------------------------------- */

  function buildMailto(title, ym) {
    var noDoi = !!state.url;
    var idLine = noDoi
      ? "- URL: " + state.url + "\n"
      : "- DOI: " + normalizeDoi(state.doi) + (state.unverified ? " (not checked against the database)" : "") + "\n";
    var intro = noDoi
      ? "I'd like to suggest a paper for the 3dcp.fyi database. It has no DOI, so here is a link:\n\n"
      : "I'd like to suggest a paper for the 3dcp.fyi database. I checked it against the database first:\n\n";
    var body =
      "Hi Daniel,\n\n" +
      intro +
      idLine +
      "- Title: " + title + "\n" +
      "- Date (YYYY-MM): " + ym + "\n\n" +
      "Thanks!\n";
    var c = contact();
    return "mailto:" + c.email +
      "?subject=" + encodeURIComponent(c.subject) +
      "&body=" + encodeURIComponent(body);
  }

  /* ---------- self-contained styles --------------------------------- */
  // Injected once so the component is a true drop-in: a page only needs the
  // <script>, not a copy of the CSS. All values use the site's CSS variables.
  var AP_CSS = [
    ".oa-ap-check{display:flex;align-items:center;gap:8px;margin:-4px 0 16px;font-family:var(--sans);font-size:var(--fs-meta);color:var(--ink-2);cursor:pointer;user-select:none}",
    ".oa-ap-check input{width:15px;height:15px;margin:0;accent-color:var(--accent);cursor:pointer}",
    ".oa-ap-label{display:block;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;letter-spacing:normal;color:var(--muted);margin-bottom:6px}",
    ".oa-ap-labelrow{display:flex;align-items:center;gap:6px;margin-bottom:6px}",
    ".oa-ap-labelrow .oa-ap-label{margin-bottom:0}",
    ".oa-ap-info{position:relative;display:inline-flex;align-items:center;justify-content:center;color:var(--muted);cursor:help;border-radius:50%;outline:none;transition:color .12s}",
    ".oa-ap-info:hover,.oa-ap-info:focus-visible{color:var(--accent-text)}",
    ".oa-ap-info:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-ring-offset)}",
    ".oa-ap-info::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);width:max-content;max-width:220px;padding:7px 10px;font-family:var(--sans);font-size:var(--fs-meta);font-weight:400;line-height:1.4;letter-spacing:normal;text-transform:none;white-space:normal;color:var(--paper);background:var(--ink);border-radius:var(--radius-control,3px);box-shadow:var(--shadow-pop);opacity:0;visibility:hidden;transition:opacity .12s,visibility .12s;z-index:5;pointer-events:none}",
    ".oa-ap-info::before{content:'';position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:var(--ink);opacity:0;visibility:hidden;transition:opacity .12s,visibility .12s;z-index:5;pointer-events:none}",
    ".oa-ap-info:hover::after,.oa-ap-info:focus-visible::after,.oa-ap-info:hover::before,.oa-ap-info:focus-visible::before{opacity:1;visibility:visible}",
    ".oa-ap-input-short{max-width:160px}",
    ".oa-ap-hint{display:block;font-family:var(--sans);font-size:var(--fs-meta);line-height:1.45;color:var(--muted);margin-top:6px;text-wrap:pretty}",
    ".oa-ap-msg{margin:-4px 0 12px}",
    ".oa-ap-msg-warn{color:var(--danger)}",
    ".oa-ap-btn{transition:all .12s}",
    ".oa-ap-result{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}",
    ".oa-ap-result-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:var(--radius-control,3px)}",
    ".oa-ap-result-found .oa-ap-result-icon{color:var(--success);background:color-mix(in srgb,var(--success) 12%,transparent)}",
    ".oa-ap-result-decline .oa-ap-result-icon{color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)}",
    ".oa-ap-result-title{font-family:var(--sans);font-size:var(--fs-lead);font-weight:600;color:var(--ink);margin:1px 0 4px}",
    ".oa-ap-result-sub{font-family:var(--sans);font-size:var(--fs-meta);line-height:1.5;color:var(--ink-2);margin:0;text-wrap:pretty}",
    ".oa-ap-decline-list{margin:6px 0 0;padding-left:18px;font-family:var(--sans);font-size:var(--fs-meta);line-height:1.5;color:var(--ink-2)}",
    ".oa-ap-decline-list li{margin-bottom:5px;text-wrap:pretty}",
    ".oa-ap-decline-list li:last-child{margin-bottom:0}",
    ".oa-ap-note{font-family:var(--sans);font-size:var(--fs-meta);line-height:1.5;color:var(--ink-2);padding:10px 12px;border-radius:var(--radius-control,3px);margin-bottom:16px;text-wrap:pretty}",
    ".oa-ap-note-ok{background:color-mix(in srgb,var(--success) 9%,transparent);border:1px solid color-mix(in srgb,var(--success) 22%,transparent)}",
    ".oa-ap-note strong{color:var(--ink)}",
    ".oa-ap-card{display:flex;flex-direction:column;gap:5px;text-decoration:none;padding:12px 14px;border:1px solid var(--line-strong);border-radius:var(--radius-control,3px);margin-bottom:16px;transition:border-color .12s,background .12s}",
    ".oa-ap-card:hover{border-color:var(--accent);background:var(--accent-soft)}",
    ".oa-ap-card-title{font-family:var(--serif);font-size:var(--fs-body);font-weight:600;line-height:1.35;color:var(--ink)}",
    ".oa-ap-card-meta{font-family:var(--sans);font-size:var(--fs-meta);color:var(--muted);line-height:1.4}",
    ".oa-ap-summary{border:1px solid var(--line);border-radius:var(--radius-control,3px);overflow:hidden;margin-bottom:16px}",
    ".oa-ap-srow{display:flex;gap:12px;padding:9px 12px;border-bottom:1px solid var(--line)}",
    ".oa-ap-srow:last-child{border-bottom:none}",
    ".oa-ap-skey{flex:0 0 56px;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;letter-spacing:normal;color:var(--muted);padding-top:1px}",
    ".oa-ap-sval{flex:1 1 auto;font-family:var(--sans);font-size:var(--fs-body);color:var(--ink);word-break:break-word}",
    ".oa-ap-sval-muted{color:var(--muted);font-style:italic}",
    ".oa-ap-chips{display:flex;flex-wrap:wrap;gap:5px}",
    ".oa-ap-chip{font-family:var(--mono);font-size:var(--fs-meta);color:var(--accent-text);background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);border-radius:var(--radius-control,3px);padding:1px 8px}",
    "@media (max-width:480px){.oa-ap-actions-split{flex-direction:column-reverse}.oa-ap-actions-split .oa-ap-btn{width:100%}}"
  ].join("\n");

  /* ---------- on-demand data loading -------------------------------- */
  // Both the duplicate check and the keyword gate read ARTICLES_DATA. On the
  // table page it is already on its way (data-load.js, window.OADataLoad): wait
  // for that one rather than starting a second 10 MB download. Sub-pages don't
  // ship the big table, so there it is fetched on first use.
  function loadScript(src) {
    return window.OAAssets.loadScript(src).then(function () { return true; }, function () { return false; });
  }

  // Resolves true once the article table is present. Success short-circuits via
  // the window global; a failed load is NOT cached, so a later attempt can retry.
  var dataReady = null;
  function ensureData() {
    if (window.ARTICLES_DATA) return Promise.resolve(true);
    if (dataReady) return dataReady;
    var pageLoad = window.OADataLoad;
    if (pageLoad && window.OADataLoadStart) window.OADataLoadStart();
    dataReady = (pageLoad
      ? Promise.resolve(pageLoad).then(function () { return true; }, function () { return loadScript(window.OAAssets.url("data/tabular_data.js")); })
      : window.OAData
        ? window.OAData.load("data/tabular_data.js", "ARTICLES_DATA").then(function () { return true; }, function () { return false; })
        : loadScript(window.OAAssets.url("data/tabular_data.js"))
    ).then(function () {
      var ok = !!window.ARTICLES_DATA;
      if (!ok) dataReady = null;   // allow a retry next time
      return ok;
    });
    return dataReady;
  }

  /* ---------- DOM scaffold ------------------------------------------- */

  // OATheme is a hard dependency on every page that runs this flow.
  var esc = window.OATheme.escapeHtml;

  var overlay, dialogBody, state = {};

  function buildOverlay() {
    if (overlay) return;
    var frame = window.OADialog.overlayFrame({ prefix: "oa-ap", css: AP_CSS, title: "Suggest a paper", onClose: close });
    overlay = frame.overlay; dialogBody = frame.body;
  }

  function open() {
    buildOverlay();
    ensureData();
    state = {};
    if (!overlay.open) overlay.showModal();
    renderDoiStep();
  }

  function close() {
    if (overlay) overlay.close();
  }

  function setBody(html) {
    dialogBody.innerHTML = html;
  }

  function focusFirst() {
    var el = dialogBody.querySelector("input, button, a");
    if (el) el.focus();
  }

  /* ---------- step 1: DOI ------------------------------------------- */

  function renderDoiStep(prefill, noDoi) {
    var lead = noDoi
      ? "No DOI? Paste a link to the paper instead. We can't auto-check for duplicates, but we'll still take a look."
      : "Every suggestion starts with a DOI so we can check it isn't already indexed.";
    setBody(
      '<p class="oa-ap-lead">' + lead + "</p>" +
      '<label class="oa-ap-field">' +
        '<span class="oa-ap-label">' + (noDoi ? "Paper URL" : "DOI") + "</span>" +
        '<input class="oa-ap-input" id="oa-ap-doi" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="' + (noDoi ? "example.com/paper" : "10.1016/j.example.2025.01.001") + '" ' +
          'value="' + esc(prefill || "") + '" />' +
      "</label>" +
      '<label class="oa-ap-check">' +
        '<input type="checkbox" id="oa-ap-nodoi"' + (noDoi ? " checked" : "") + " />" +
        "<span>This paper has no DOI. Provide a URL instead</span>" +
      "</label>" +
      '<div class="oa-ap-msg" id="oa-ap-msg" aria-live="polite"></div>' +
      '<div class="oa-ap-actions">' +
        '<button class="oa-ap-btn" type="button" id="oa-ap-check">' +
          (noDoi ? "Continue" : "Check the database") + "</button>" +
      "</div>"
    );
    var input = dialogBody.querySelector("#oa-ap-doi");
    var btn = dialogBody.querySelector("#oa-ap-check");
    var toggle = dialogBody.querySelector("#oa-ap-nodoi");
    function go() { noDoi ? checkUrl(input.value) : checkDoi(input.value); }
    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    // Switching mode re-renders the field, carrying the typed value across.
    toggle.addEventListener("change", function () { renderDoiStep(input.value, toggle.checked); });
    input.focus();
  }

  function checkUrl(value) {
    var msg = dialogBody.querySelector("#oa-ap-msg");
    var url = String(value || "").trim();
    if (!url) {
      msg.className = "oa-ap-msg oa-ap-msg-warn";
      msg.textContent = "Please enter a link to the paper.";
      return;
    }
    // A scheme isn't required - add https:// if it's missing.
    if (!/^https?:\/\//i.test(url)) url = "https://" + url.replace(/^\/+/, "");
    if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) {
      msg.className = "oa-ap-msg oa-ap-msg-warn";
      msg.textContent = "Please enter a valid link, e.g. example.com/paper";
      return;
    }
    state.url = url;
    state.doi = "";
    state.unverified = false;
    renderDetailsStep();
  }

  function checkDoi(value) {
    var msg = dialogBody.querySelector("#oa-ap-msg");
    var norm = normalizeDoi(value);
    if (!norm || !/^10\.\S+\/\S+/.test(norm)) {
      msg.className = "oa-ap-msg oa-ap-msg-warn";
      msg.textContent = "That doesn't look like a DOI. It should start with “10.” - e.g. 10.1016/j.example.2025.01.001";
      return;
    }
    state.doi = norm;
    state.url = "";
    msg.className = "oa-ap-msg";
    msg.textContent = "Checking\u2026";
    ensureData().then(function () {
      // If the dataset couldn't be loaded we can't verify duplicates - flag it
      // so the user (and the email) reflect that, rather than silently passing.
      state.unverified = !window.ARTICLES_DATA;
      var hit = state.unverified ? null : findByDoi(norm);
      if (hit) renderAlreadyIn(hit);
      else renderDetailsStep();
    });
  }

  /* ---------- result: already in the database ----------------------- */

  function renderAlreadyIn(a) {
    var authors = (a.authors || []).map(function (au) {
      return [[au.prefix, au.lastName].filter(Boolean).join(" "), au.firstName].filter(Boolean).join(", ");
    }).filter(Boolean);
    var byline = authors.length
      ? (authors.length > 3 ? authors.slice(0, 3).join("; ") + " et al." : authors.join("; "))
      : "";
    setBody(
      '<div class="oa-ap-result oa-ap-result-found">' +
        '<div class="oa-ap-result-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"></path></svg>' +
        "</div>" +
        '<div class="oa-ap-result-text">' +
          '<h3 class="oa-ap-result-title">Already in 3dcp.fyi</h3>' +
          '<p class="oa-ap-result-sub">This DOI is already indexed - no need to suggest it.</p>' +
        "</div>" +
      "</div>" +
      '<a class="oa-ap-card" href="' + esc(articleUrl(a)) + '">' +
        '<span class="oa-ap-card-title">' + esc(a.title ? (window.OATypeset ? window.OATypeset.text(a.title) : a.title) : "Untitled") + "</span>" +
        '<span class="oa-ap-card-meta">' +
          (byline ? esc(byline) + " · " : "") +
          (a.venue ? esc(a.venue) + " · " : "") +
          esc(a.date ? String(a.date).slice(0, 7) : "") +
        "</span>" +
      "</a>" +
      '<div class="oa-ap-actions">' +
        '<button class="oa-ap-btn oa-ap-btn-ghost" type="button" id="oa-ap-back">Check another DOI</button>' +
      "</div>"
    );
    dialogBody.querySelector("#oa-ap-back").addEventListener("click", function () { renderDoiStep(); });
    focusFirst();
  }

  /* ---------- step 2: title + date ---------------------------------- */

  function renderDetailsStep() {
    var note = state.unverified
      ? "<strong>Couldn't reach the database.</strong> We can't auto-check for duplicates right now - send it anyway and we'll verify on our end."
      : "<strong>Not indexed yet.</strong> A couple of quick checks before you send it over.";
    setBody(
      '<div class="oa-ap-note oa-ap-note-ok">' + note + "</div>" +
      '<label class="oa-ap-field">' +
        '<input class="oa-ap-input" id="oa-ap-title-in" type="text" autocomplete="off" aria-label="Paper title" ' +
          'placeholder="Title" value="' + esc(state.title || "") + '" />' +
      "</label>" +
      '<label class="oa-ap-field">' +
        '<span class="oa-ap-labelrow">' +
          '<span class="oa-ap-label">Date published</span>' +
          '<span class="oa-ap-info" tabindex="0" role="img" ' +
            'aria-label="Format YYYY-MM. Must be more than ' + MIN_AGE_MONTHS + ' months in the past." ' +
            'data-tip="Format YYYY-MM. Must be more than ' + MIN_AGE_MONTHS + ' months in the past.">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"></path><path d="M12 9h.01"></path><path d="M11 12h1v4h1"></path></svg>' +
          "</span>" +
        "</span>" +
        '<input class="oa-ap-input oa-ap-input-short" id="oa-ap-date-in" type="text" inputmode="numeric" autocomplete="off" ' +
          'placeholder="YYYY-MM" value="' + esc(state.ym || "") + '" />' +
      "</label>" +
      '<div class="oa-ap-msg" id="oa-ap-msg" aria-live="polite"></div>' +
      '<div class="oa-ap-actions oa-ap-actions-split">' +
        '<button class="oa-ap-btn oa-ap-btn-ghost" type="button" id="oa-ap-back">Back</button>' +
        '<button class="oa-ap-btn" type="button" id="oa-ap-submit">Validate &amp; Compose Mail</button>' +
      "</div>"
    );
    var titleIn = dialogBody.querySelector("#oa-ap-title-in");
    var dateIn = dialogBody.querySelector("#oa-ap-date-in");
    // The draft is state, not a by-product of validation: keep it on every
    // keystroke so Back -> Continue restores what was typed, validated or not.
    titleIn.addEventListener("input", function () { state.title = titleIn.value; });
    dateIn.addEventListener("input", function () { state.ym = dateIn.value; });
    dialogBody.querySelector("#oa-ap-back").addEventListener("click", function () {
      state.title = titleIn.value;
      state.ym = dateIn.value;
      renderDoiStep(state.url || state.doi, !!state.url);
    });
    dialogBody.querySelector("#oa-ap-submit").addEventListener("click", function () {
      ensureData().then(function () { validateDetails(titleIn.value, dateIn.value); });
    });
    // Shared YYYY-MM digit mask (same behaviour as the Articles-page rule
    // builder's Date fields; single implementation in oa-theme.js).
    window.OATheme.monthMask(dateIn);
    dateIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); ensureData().then(function () { validateDetails(titleIn.value, dateIn.value); }); }
    });
    titleIn.focus();
  }

  function validateDetails(title, ym, opts) {
    opts = opts || {};
    state.title = title;
    state.ym = ym;
    var msg = dialogBody.querySelector("#oa-ap-msg");
    title = String(title || "").trim();
    ym = String(ym || "").trim();

    // --- malformed input: fix-it-here errors, shown inline (not a decline). ---
    if (!title) {
      msg.className = "oa-ap-msg oa-ap-msg-warn";
      msg.textContent = "Please enter the paper title.";
      return;
    }
    var age = monthsInPast(ym);
    if (age === null) {
      msg.className = "oa-ap-msg oa-ap-msg-warn";
      msg.textContent = "Please enter the date as YYYY-MM (e.g. 2025-04).";
      return;
    }

    // --- scope checks: collected together so the user never sees two declines
    //     in a row, and cleared in one go by a single "send anyway". ---
    var hits = matchedKeywords(title);
    var haveVocab = keywordRegexes().length > 0;
    var issues = [];
    // Only gate on keywords when a vocabulary actually loaded - if the table
    // failed to load, skip the gate rather than rejecting every title (#1).
    if (haveVocab && !hits.length) {
      issues.push({
        type: "keyword",
        text: "The title doesn\u2019t mention any of the database\u2019s indexed keywords, so it looks out of scope for 3D concrete printing."
      });
    }
    if (age <= MIN_AGE_MONTHS) {
      var when = age < 0 ? "is dated in the future" :
                 age === 0 ? "is dated this month" :
                 "is only " + age + " month" + (age === 1 ? "" : "s") + " old";
      issues.push({
        type: "fresh",
        text: "This paper " + when + ". The database is updated regularly, so anything more recent than " +
              MIN_AGE_MONTHS + " months is very likely picked up automatically without a suggestion."
      });
    }

    if (issues.length && !opts.force) {
      renderDecline(
        issues,
        function () { renderDetailsStep(); },
        { label: "Send anyway", onContinue: function () { validateDetails(title, ym, { force: true }); } }
      );
      return;
    }

    renderPass(hits, issues.map(function (i) { return i.type; }));
  }

  /* ---------- decline ---------------------------------------------- */

  // issues: array of { type, text }. One issue -> a tailored heading; several ->
  // a combined checklist. A single "send anyway" (cont) clears them all at once,
  // so a paper with two problems never produces two sequential declines (#2).
  function renderDecline(issues, onBack, cont) {
    var single = issues.length === 1;
    var heading = !single ? "A Couple of Things to Check"
      : issues[0].type === "fresh" ? "Likely Already on Its Way"
      : "No Indexed Topic in the Title";
    var detail = single
      ? '<p class="oa-ap-result-sub">' + esc(issues[0].text) + " If you think it belongs here, you can send it anyway.</p>"
      : '<ul class="oa-ap-decline-list">' +
          issues.map(function (it) { return "<li>" + esc(it.text) + "</li>"; }).join("") +
        "</ul>" +
        '<p class="oa-ap-result-sub">If you think it still belongs here, you can send it anyway.</p>';
    var split = cont ? " oa-ap-actions-split" : "";
    setBody(
      '<div class="oa-ap-result oa-ap-result-decline">' +
        '<div class="oa-ap-result-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"></path></svg>' +
        "</div>" +
        '<div class="oa-ap-result-text">' +
          '<h3 class="oa-ap-result-title">' + esc(heading) + "</h3>" +
          detail +
        "</div>" +
      "</div>" +
      '<div class="oa-ap-actions' + split + '">' +
        '<button class="oa-ap-btn oa-ap-btn-ghost" type="button" id="oa-ap-back">Edit details</button>' +
        (cont ? '<button class="oa-ap-btn" type="button" id="oa-ap-continue">' + esc(cont.label) + "</button>" : "") +
      "</div>"
    );
    dialogBody.querySelector("#oa-ap-back").addEventListener("click", onBack);
    if (cont) dialogBody.querySelector("#oa-ap-continue").addEventListener("click", cont.onContinue);
    focusFirst();
  }

  /* ---------- pass: compose email ----------------------------------- */

  function renderPass(hits, overrides) {
    overrides = overrides || [];
    var manual = overrides.length > 0;
    var href = buildMailto(String(state.title).trim(), String(state.ym).trim());
    var idKey = state.url ? "URL" : "DOI";
    var idVal = state.url ? state.url : state.doi;
    var hasHits = hits && hits.length;
    var topicsVal = hasHits
      ? '<span class="oa-ap-chips">' + hits.slice(0, 6).map(function (k) {
          return '<span class="oa-ap-chip">' + esc(k) + "</span>";
        }).join("") + "</span>"
      : '<span class="oa-ap-sval-muted">none matched, flagged for manual review</span>';
    var titleTxt = (hasHits && !manual) ? "Looks Like a Fit" : "Ready to Send";
    var subText;
    if (manual) {
      var why = [];
      if (overrides.indexOf("keyword") >= 0) why.push("no indexed topic matched");
      if (overrides.indexOf("fresh") >= 0) why.push("it\u2019s more recent than we\u2019d usually take");
      subText = "You chose to send this anyway (" + why.join(", ") + "). We\u2019ve drafted the email and the maintainer will review it.";
    } else if (hasHits) {
      subText = "All checks passed. We\u2019ve drafted an email with the details, just send it.";
    } else {
      subText = "The date checks out. We couldn\u2019t match the title against indexed topics, so the maintainer will confirm the fit.";
    }
    setBody(
      '<div class="oa-ap-result oa-ap-result-found">' +
        '<div class="oa-ap-result-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"></path></svg>' +
        "</div>" +
        '<div class="oa-ap-result-text">' +
          '<h3 class="oa-ap-result-title">' + titleTxt + "</h3>" +
          '<p class="oa-ap-result-sub">' + subText + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="oa-ap-summary">' +
        '<div class="oa-ap-srow"><span class="oa-ap-skey">' + idKey + '</span><span class="oa-ap-sval">' + esc(idVal) + "</span></div>" +
        '<div class="oa-ap-srow"><span class="oa-ap-skey">Title</span><span class="oa-ap-sval">' + esc(String(state.title).trim()) + "</span></div>" +
        '<div class="oa-ap-srow"><span class="oa-ap-skey">Date</span><span class="oa-ap-sval">' + esc(String(state.ym).trim()) + "</span></div>" +
        '<div class="oa-ap-srow"><span class="oa-ap-skey">Keywords</span><span class="oa-ap-sval">' + topicsVal + "</span></div>" +
      "</div>" +
      '<div class="oa-ap-actions oa-ap-actions-split">' +
        '<button class="oa-ap-btn oa-ap-btn-ghost" type="button" id="oa-ap-back">Back</button>' +
        '<button class="oa-ap-btn oa-ap-btn-ghost" type="button" id="oa-ap-copy" title="Copy the suggestion text to paste into any mail or message">Copy text</button>' +
        '<a class="oa-ap-btn" id="oa-ap-send" href="' + esc(href) + '">Send Mail</a>' +
      "</div>"
    );
    dialogBody.querySelector("#oa-ap-back").addEventListener("click", function () { renderDetailsStep(); });
    dialogBody.querySelector("#oa-ap-send").addEventListener("click", function () {
      setTimeout(close, 400);
    });
    // No mail client (most lab PCs, many phones): the same text the mailto
    // carries, decoded from the link so the two can never drift.
    dialogBody.querySelector("#oa-ap-copy").addEventListener("click", function () {
      var m = /^mailto:([^?]*)\?(.*)$/.exec(href) || [];
      var q = new URLSearchParams(m[2] || "");
      var text = "To: " + decodeURIComponent(m[1] || "") + "\nSubject: " + (q.get("subject") || "") + "\n\n" + (q.get("body") || "");
      window.OABrowserActions.copyText(text).then(function (ok) {
        window.OATheme.copyToast(ok ? "Suggestion copied - paste it into any mail or message" : "Copy failed", ok);
      });
    });
    dialogBody.querySelector("#oa-ap-send").focus();
  }

  /* ---------- wire up the button ------------------------------------ */

  // Event delegation on the document so the wizard works for the static header
  // AND for a header injected after load - regardless of
  // whether the button exists yet when this script runs.
  function init() {
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".oa-add-btn") : null;
      if (!btn) return;
      e.preventDefault();
      open();
    });
  }

  init();

  window.OAAddPaper = { open: open, close: close };
})();
