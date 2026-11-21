/* report-error.js - small "Report an error" dialog.
 *
 * Opened by any [data-report-id] control - one per record, in the table's
 * abstract drops (ext-records.js):
 *
 *   - Origin: the paper the button belongs to (title + its 3dcp.fyi short
 *     link); a control without an id reports the current page instead.
 *   - Two fields: "What is wrong?" and "What is the correct value?".
 *   - "Send Mail" composes a pre-filled mailto: to the maintainer with the
 *     origin and both fields, so the report lands ready to send.
 *
 * The buttons are rendered by JavaScript, so there is no no-JS path to cover.
 *
 * Self-contained: injects its own .oa-er-* styles (same visual language as the
 * "suggest a paper" wizard) and binds via event delegation.
 */
(function () {
  "use strict";

  var DEFAULT_MAINTAINER = "message@3dcp.fyi";
  var DEFAULT_SUBJECT = "[3dcp.fyi] Error report";

  // Recipient + subject. The header mailto button these used to be read off is
  // gone, so the constants above are the single source.
  function contact() {
    return { email: DEFAULT_MAINTAINER, subject: DEFAULT_SUBJECT };
  }

  /* ---------- origin (what's being reported) ------------------------ */

  /* Two surfaces. A [data-report-id] button reports ONE paper: the article's
     own canonical page (3dcp.fyi/<id>) goes in the mail, so a report about a
     wrong year no longer arrives pointing at a filtered table URL the
     maintainer cannot resolve to a record. Anything else reports the page it
     was clicked on. */
  function currentOrigin(btn) {
    var id = btn && btn.getAttribute && btn.getAttribute("data-report-id");
    if (id) {
      return {
        kind: "paper",
        label: (btn.getAttribute("data-report-label") || id),
        url: window.OABibliography.siteUrl(encodeURIComponent(id))
      };
    }
    var t = (document.title || "").replace(/\s*[\u2022|\u00b7-]\s*3dcp\.fyi.*$/i, "").trim();
    return { kind: "page", label: t || location.pathname || "3dcp.fyi", url: location.href };
  }

  /* ---------- mailto ------------------------------------------------- */

  function mailBody(o, wrong, correct) {
    var body = "Hi Daniel,\n\nI'd like to report an error on 3dcp.fyi.\n\n";
    body += "- " + (o.kind === "paper" ? "Paper" : "Page") + ": " + o.label + "\n";
    body += "- URL: " + o.url + "\n";
    body += "- What is wrong: " + (wrong || "") + "\n";
    body += "- Correct value: " + (correct || "(not provided)") + "\n\n";
    body += "Thanks!\n";
    return body;
  }
  function buildMailto(o, wrong, correct) {
    var body = mailBody(o, wrong, correct);
    var c = contact();
    return "mailto:" + c.email +
      "?subject=" + encodeURIComponent(c.subject) +
      "&body=" + encodeURIComponent(body);
  }

  /* ---------- styles ------------------------------------------------- */

  var ER_CSS = [
    ".oa-er-head-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-control,3px);color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)}",
    ".oa-er-origin{display:flex;gap:11px;align-items:flex-start;padding:11px 13px;border:1px solid var(--line-strong);border-radius:var(--radius-control,3px);margin-bottom:18px;background:color-mix(in srgb,var(--ink) 3%,var(--paper))}",
    ".oa-er-origin-k{flex:0 0 auto;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;color:var(--ink-2);padding-top:2px}",
    ".oa-er-origin-v{flex:1 1 auto;min-width:0}",
    ".oa-er-origin-label{display:block;font-family:var(--serif);font-size:var(--fs-body);line-height:1.35;color:var(--ink);word-break:break-word}",
    ".oa-title-sans .oa-er-origin-label{font-family:var(--sans);font-weight:600;letter-spacing:normal}",
    ".oa-er-origin-sub{display:block;font-family:var(--mono);font-size:var(--fs-meta);color:var(--muted);margin-top:3px;word-break:break-all}",
    ".oa-er-label{display:block;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;color:var(--ink-2);margin-bottom:6px}",
    ".oa-er-req{color:var(--danger);font-weight:600}",
    ".oa-er-input{line-height:1.5;resize:vertical;min-height:62px}",
    ".oa-er-msg{margin:-6px 0 12px;color:var(--danger)}",
    ".oa-er-btn{transition:background .12s,border-color .12s,color .12s,box-shadow .12s}",
    "@media (max-width:480px){.oa-er-actions{flex-direction:column-reverse}.oa-er-actions-split{flex-direction:column-reverse}.oa-er-btn{width:100%}}"
  ].join("\n");

  /* ---------- scaffold ----------------------------------------------- */

  // OATheme is a hard dependency on every page that runs this flow.
  var esc = window.OATheme.escapeHtml;

  var overlay, dialogBody;

  function buildOverlay() {
    if (overlay) return;
    var frame = window.OADialog.overlayFrame({ prefix: "oa-er", css: ER_CSS, title: "Report an error",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M12 9v4"></path><path d="M12 16v.01"></path></svg>', onClose: close });
    overlay = frame.overlay; dialogBody = frame.body;
  }

  function renderForm(o) {
    o = o || currentOrigin(null);
    var sub = o.url;
    dialogBody.innerHTML =
      '<p class="oa-er-lead">Spotted something incorrect? Tell us what\u2019s wrong and, if you can, the right value. Send it as a pre-filled email - or copy the report and send it your own way if no mail app is set up here.</p>' +
      '<div class="oa-er-origin">' +
        '<span class="oa-er-origin-k">' + (o.kind === "paper" ? "Paper" : "Page") + "</span>" +
        '<span class="oa-er-origin-v">' +
          '<span class="oa-er-origin-label">' + esc(o.label) + "</span>" +
          (sub ? '<span class="oa-er-origin-sub">' + esc(sub) + "</span>" : "") +
        "</span>" +
      "</div>" +
      '<label class="oa-er-field">' +
        '<span class="oa-er-label">What is wrong? <span class="oa-er-req">*</span></span>' +
        '<textarea class="oa-er-input" id="oa-er-wrong" placeholder="e.g. the publication year is listed as 2025 but should be 2024" spellcheck="true"></textarea>' +
      "</label>" +
      '<label class="oa-er-field">' +
        '<span class="oa-er-label">What is the correct value?</span>' +
        '<textarea class="oa-er-input" id="oa-er-correct" placeholder="e.g. 2024-03 (optional, but it helps)" spellcheck="true"></textarea>' +
      "</label>" +
      '<div class="oa-er-msg" id="oa-er-msg" aria-live="polite"></div>' +
      '<div class="oa-er-actions oa-er-actions-split">' +
        '<button class="oa-er-btn oa-er-btn-ghost" type="button" id="oa-er-cancel">Cancel</button>' +
        '<button class="oa-er-btn oa-er-btn-ghost" type="button" id="oa-er-copy" title="Copy the report text to paste into any mail or message">Copy report</button>' +
        '<a class="oa-er-btn" id="oa-er-send" role="button" tabindex="0">Send Mail</a>' +
      "</div>";

    var wrong = dialogBody.querySelector("#oa-er-wrong");
    var correct = dialogBody.querySelector("#oa-er-correct");
    var msg = dialogBody.querySelector("#oa-er-msg");
    var send = dialogBody.querySelector("#oa-er-send");

    // Keep the anchor's href in sync with the typed values, exactly like the
    // "suggest a paper" Send Mail button (a real mailto link the browser opens).
    function refreshHref() {
      if (wrong.value.trim()) {
        send.setAttribute("href", buildMailto(o, wrong.value.trim(), correct.value.trim()));
      } else {
        send.removeAttribute("href");
      }
    }
    function trySend(e) {
      if (!wrong.value.trim()) {
        if (e) e.preventDefault();
        msg.textContent = "Please describe what is wrong.";
        wrong.focus();
        return;
      }
      // href is set; let the browser open the mail client, then tidy up.
      setTimeout(close, 400);
    }
    dialogBody.querySelector("#oa-er-cancel").addEventListener("click", close);
    // The same text the mail would carry, for readers without a mail client
    // (most lab PCs, many phones): subject line, blank line, body.
    dialogBody.querySelector("#oa-er-copy").addEventListener("click", function () {
      if (!wrong.value.trim()) {
        msg.textContent = "Please describe what is wrong.";
        wrong.focus();
        return;
      }
      var c = contact();
      var text = "To: " + c.email + "\nSubject: " + c.subject + "\n\n" + mailBody(o, wrong.value.trim(), correct.value.trim());
      window.OABrowserActions.copyText(text).then(function (ok) {
        window.OATheme.copyToast(ok ? "Report copied - paste it into any mail or message" : "Copy failed", ok);
      });
    });
    send.addEventListener("click", trySend);
    send.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (send.getAttribute("href")) send.click(); else trySend(e); }
    });
    wrong.addEventListener("input", function () { if (msg.textContent) msg.textContent = ""; refreshHref(); });
    correct.addEventListener("input", refreshHref);
    refreshHref();
    wrong.focus();
  }

  function open(o) {
    buildOverlay();
    if (!overlay.open) overlay.showModal();
    renderForm(o);
  }

  function close() {
    if (overlay) overlay.close();
  }

  /* ---------- bind --------------------------------------------------- */

  document.addEventListener("click", function (e) {
    // The per-record buttons in the table's abstract drops: <button data-report-id>.
    var btn = e.target.closest && e.target.closest("[data-report-id]");
    if (!btn) return;
    e.preventDefault();
    open(currentOrigin(btn));
  });
  window.OAReportError = { open: open, close: close, openFor: function (button) { open(currentOrigin(button)); } };
})();
