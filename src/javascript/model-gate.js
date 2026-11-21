/* model-gate.js - consent dialog for the in-browser semantic-search model.
 *
 * The embedding model is a large, one-time download from the Hugging Face CDN
 * (huggingface.co) that transformers.js caches in the browser's Cache Storage.
 * We never fetch it implicitly: the toolbar's download button opens this dialog
 * so the user can acknowledge (a) that a model is downloaded from huggingface.co
 * and (b) that it is stored in their browser until they clear it. Only then does
 * the download begin, with a live progress bar. When the model is already
 * installed the dialog switches to an "installed" view that offers removal.
 *
 * Self-contained, same visual language as report-error.js / add-paper.js.
 * Exposes window.OAModelGate.open({ mode, modelId, onConfirm, onRemove }).
 */
(function () {
  "use strict";

  var esc = window.OATheme.escapeHtml;

  var SOURCE_HOST = "huggingface.co";
  var APPROX_SIZE = "~110 MB";

  var IC_DL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + window.OATheme.MODEL_ICON_PATHS + '</svg>';
  var IC_OK = IC_DL;
  var IC_ERR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17v.01"></path><path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z"></path></svg>';

  var MG_CSS = [
    ".oa-mg-dialog{max-width:480px;border-radius:var(--radius-control);box-shadow:var(--shadow-float)}",
    ".oa-mg-head{padding:12px 14px}",
    ".oa-mg-head-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-control);color:var(--accent-text);background:color-mix(in srgb,var(--accent) 12%,transparent)}",
    ".oa-mg-head-ic.is-ok{color:var(--success);background:color-mix(in srgb,var(--success) 13%,transparent)}",
    ".oa-mg-head-ic.is-err{color:var(--danger);background:color-mix(in srgb,var(--danger) 13%,transparent)}",
    ".oa-mg-title{font-size:var(--fs-meta);font-weight:600}",
    ".oa-mg-close{width:28px;height:28px;padding:0;border:0;border-radius:var(--radius-control);color:var(--ink-2);font-family:var(--sans);font-size:var(--fs-lead);line-height:1}",
    ".oa-mg-close:hover{color:var(--accent-text);box-shadow:inset 0 0 0 1px var(--accent)}",
    ".oa-mg-close:active{background:var(--accent-soft)}",
    ".oa-mg-body{padding:14px}",
    ".oa-mg-lead{font-size:var(--fs-meta);margin:0 0 14px}",
    ".oa-mg-card{display:flex;flex-direction:column;gap:7px;padding:12px 14px;border:1px solid var(--line-strong);border-radius:var(--radius-control);margin-bottom:16px;background:var(--bg)}",
    ".oa-mg-row{display:flex;gap:10px;align-items:baseline;justify-content:space-between}",
    ".oa-mg-k{flex:0 0 auto;font-family:var(--mono);font-size:var(--fs-meta);color:var(--ink-2)}",
    ".oa-mg-v{flex:1 1 auto;min-width:0;text-align:right;font-family:var(--mono);font-size:var(--fs-meta);color:var(--ink);word-break:break-all}",
    ".oa-mg-acks{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:9px}",
    ".oa-mg-acks li{position:relative;padding-left:24px;font-family:var(--sans);font-size:var(--fs-meta);line-height:1.45;color:var(--ink-2);text-wrap:pretty}",
    ".oa-mg-acks li svg{position:absolute;left:0;top:1px;width:16px;height:16px;color:var(--accent-text)}",
    ".oa-mg-ackbox{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-control);margin-bottom:16px;cursor:pointer}",
    ".oa-mg-ackbox input{flex:0 0 auto;margin:2px 0 0;width:16px;height:16px;accent-color:var(--accent);cursor:pointer}",
    ".oa-mg-ackbox span{font-family:var(--sans);font-size:var(--fs-meta);line-height:1.45;color:var(--ink);text-wrap:pretty}",
    ".oa-mg-prog-wrap{margin:2px 0 16px}",
    ".oa-mg-prog-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}",
    ".oa-mg-prog-label{font-family:var(--mono);font-size:var(--fs-meta);color:var(--ink-2)}",
    ".oa-mg-prog-pct{font-family:var(--mono);font-size:var(--fs-meta);color:var(--ink)}",
    ".oa-mg-prog{height:4px;border-radius:var(--radius-control,3px);background:color-mix(in srgb,var(--accent) 16%,transparent);overflow:hidden}",
    ".oa-mg-prog-fill{display:block;height:100%;width:0;border-radius:var(--radius-control,3px);background:var(--accent);transition:width .3s ease}",
    ".oa-mg-prog.is-indeterminate .oa-mg-prog-fill{width:38% !important;animation:oa-mg-indet 1.15s ease-in-out infinite}",
    "@keyframes oa-mg-indet{0%{margin-left:-40%}100%{margin-left:100%}}",
    ".oa-mg-actions{justify-content:space-between}",
    ".oa-mg-btn{height:var(--control-size);font-family:var(--sans);font-size:var(--fs-meta);color:var(--on-accent);background:var(--accent);border:1px solid var(--accent);border-radius:var(--radius-control);padding:0 14px;transition:background .12s,border-color .12s,color .12s,opacity .12s}",
    ".oa-mg-btn:hover{box-shadow:inset 0 0 0 1px currentColor}",
    ".oa-mg-btn[disabled]{opacity:.45;cursor:not-allowed;filter:none}",
    ".oa-mg-btn-ghost,[data-scheme=dark] .oa-mg-btn-ghost{color:var(--ink-2);background:transparent;border-color:var(--line-strong)}",
    ".oa-mg-btn-ghost:hover,[data-scheme=dark] .oa-mg-btn-ghost:hover{background:transparent;border-color:var(--accent);color:var(--accent-text);filter:none}",
    ".oa-mg-btn.oa-mg-btn-ghost,.oa-mg-btn.oa-mg-btn-danger{font-weight:400}",
    ".oa-mg-btn.oa-mg-btn-ghost:active,[data-scheme=dark] .oa-mg-btn.oa-mg-btn-ghost:active{background:var(--accent-soft)}",
    ".oa-mg-btn-danger,[data-scheme=dark] .oa-mg-btn-danger{color:var(--danger);background:transparent;border-color:color-mix(in srgb,var(--danger) 45%,var(--line-strong))}",
    ".oa-mg-btn-danger:hover,[data-scheme=dark] .oa-mg-btn-danger:hover{background:transparent;border-color:var(--danger);color:var(--danger);filter:none}",
    ".oa-mg-btn.oa-mg-btn-danger:active,[data-scheme=dark] .oa-mg-btn.oa-mg-btn-danger:active{background:color-mix(in srgb,var(--danger) 10%,transparent)}",
    "@media (max-width:480px){.oa-mg-actions{flex-direction:column-reverse}.oa-mg-btn{width:100%}}"
  ].join("\n");

  var overlay, headIc, titleEl, body;
  var statusHandler = null, opts = null;

  function buildOverlay() {
    if (overlay) return;
    var frame = window.OADialog.overlayFrame({ prefix: "oa-mg", css: MG_CSS, icon: "", onClose: close });
    overlay = frame.overlay; headIc = frame.icon; titleEl = frame.title; body = frame.body;
  }

  function setHead(kind, title) {
    headIc.classList.remove("is-ok", "is-err");
    if (kind === "ok") { headIc.classList.add("is-ok"); headIc.innerHTML = IC_OK; }
    else if (kind === "err") { headIc.classList.add("is-err"); headIc.innerHTML = IC_ERR; }
    else headIc.innerHTML = IC_DL;
    titleEl.textContent = title;
  }

  function modelCard(modelId, extra) {
    return '<div class="oa-mg-card">' +
      '<div class="oa-mg-row"><span class="oa-mg-k">Model</span><span class="oa-mg-v">' + esc(modelId) + "</span></div>" +
      '<div class="oa-mg-row"><span class="oa-mg-k">Source</span><span class="oa-mg-v">' + SOURCE_HOST + "</span></div>" +
      '<div class="oa-mg-row"><span class="oa-mg-k">Stored in</span><span class="oa-mg-v">' + (extra || "your browser") + "</span></div>" +
    "</div>";
  }

  /* ---------------------------- consent view --------------------------- */

  function renderConsent() {
    var modelId = opts.modelId || "the embedding model";
    setHead("dl", "Download Semantic Model");
    body.innerHTML =
      '<p class="oa-mg-lead">Meaning-based search runs entirely on your device. To enable it, a language model is downloaded once and kept in your browser. Nothing you type is ever sent to a server.</p>' +
      modelCard(modelId, "your browser (" + APPROX_SIZE + ")") +
      '<ul class="oa-mg-acks">' +
        "<li>" + IC_DL + "The model (" + APPROX_SIZE + ") is downloaded from <strong>" + SOURCE_HOST + "</strong>.</li>" +
        "<li>" + IC_OK + "It is <strong>stored in this browser</strong> and reused offline on later visits, until you clear site data or remove it here.</li>" +
      "</ul>" +
      '<label class="oa-mg-ackbox"><input type="checkbox" id="oa-mg-ack"/><span>I understand a model will be downloaded from ' + SOURCE_HOST + " and stored in my browser.</span></label>" +
      '<div class="oa-mg-actions">' +
        '<button class="oa-mg-btn oa-mg-btn-ghost" type="button" id="oa-mg-cancel">Cancel</button>' +
        '<button class="oa-mg-btn" type="button" id="oa-mg-go" disabled>Download model</button>' +
      "</div>";
    var ack = body.querySelector("#oa-mg-ack");
    var go = body.querySelector("#oa-mg-go");
    ack.addEventListener("change", function () { go.disabled = !ack.checked; });
    body.querySelector("#oa-mg-cancel").addEventListener("click", close);
    go.addEventListener("click", function () {
      if (!ack.checked) return;
      confirmDownload();
    });
    setTimeout(function () { ack.focus(); }, 0);
  }

  // Hand the request to the host and enter the downloading view only when it
  // was ACCEPTED. onConfirm may return false (nothing could start - e.g. the
  // search module is not loaded), a promise resolving to false or rejecting
  // (search initialization failed), or nothing (legacy hosts). A progress bar
  // that never moves is replaced by a recoverable error in every failure case.
  function confirmDownload() {
    var accepted;
    try { accepted = typeof opts.onConfirm === "function" ? opts.onConfirm() : false; }
    catch (e) { accepted = false; }
    if (accepted === false) {
      renderError("Semantic search could not be started because the search module is not available. Try again.");
      return;
    }
    renderDownloading();
    var stillDownloadingView = function () { return statusHandler && body && body.querySelector("#oa-mg-prog"); };
    Promise.resolve(accepted).then(function (ok) {
      if (ok === false && stillDownloadingView()) renderError("The model could not be prepared. Check your connection and try again. Keyword search is unaffected.");
    }, function (err) {
      if (stillDownloadingView()) renderError(err && err.message ? err.message : undefined);
    });
  }

  /* -------------------------- downloading view ------------------------- */

  function renderDownloading(initialPct) {
    var modelId = opts.modelId || "the embedding model";
    setHead("dl", "Downloading Model\u2026");
    var pct = typeof initialPct === "number" ? initialPct : 0;
    body.innerHTML =
      '<p class="oa-mg-lead">Fetching the model from ' + SOURCE_HOST + " and caching it in your browser. You can keep using keyword search in the meantime; this only needs to happen once.</p>" +
      modelCard(modelId) +
      '<div class="oa-mg-prog-wrap">' +
        '<div class="oa-mg-prog-top"><span class="oa-mg-prog-label">Progress</span><span class="oa-mg-prog-pct" id="oa-mg-pct">' + Math.round(pct) + "%</span></div>" +
        '<div class="oa-mg-prog' + (pct > 0 ? "" : " is-indeterminate") + '" id="oa-mg-prog"><span class="oa-mg-prog-fill" id="oa-mg-fill" style="width:' + Math.max(0, pct) + '%"></span></div>' +
      "</div>" +
      '<div class="oa-mg-actions" style="justify-content:flex-end">' +
        '<button class="oa-mg-btn oa-mg-btn-ghost" type="button" id="oa-mg-hide">Continue in background</button>' +
      "</div>";
    body.querySelector("#oa-mg-hide").addEventListener("click", close);
    attachStatus();
  }

  function updateProgress(pct) {
    var prog = body.querySelector("#oa-mg-prog");
    var fill = body.querySelector("#oa-mg-fill");
    var out = body.querySelector("#oa-mg-pct");
    if (!prog || !fill) return;
    if (pct > 0) { prog.classList.remove("is-indeterminate"); fill.style.width = Math.min(100, pct) + "%"; }
    if (out) out.textContent = Math.round(Math.min(100, Math.max(0, pct))) + "%";
  }

  /* --------------------------- installed view -------------------------- */

  function renderInstalled() {
    var modelId = opts.modelId || "the embedding model";
    setHead("ok", "Model Installed");
    body.innerHTML =
      '<p class="oa-mg-lead">Semantic search is active. The model is stored in this browser and loads instantly (and offline) on future visits. Remove it any time to reclaim the space. Keyword search keeps working without it.</p>' +
      modelCard(modelId) +
      '<div class="oa-mg-actions">' +
        '<button class="oa-mg-btn oa-mg-btn-danger" type="button" id="oa-mg-remove">Remove from browser</button>' +
        '<button class="oa-mg-btn oa-mg-btn-ghost" type="button" id="oa-mg-done">Done</button>' +
      "</div>";
    body.querySelector("#oa-mg-done").addEventListener("click", close);
    body.querySelector("#oa-mg-remove").addEventListener("click", function () {
      if (typeof opts.onRemove === "function") { try { opts.onRemove(); } catch (e) { /* ignore */ } }
      close();
    });
  }

  /* ----------------------------- error view ---------------------------- */

  function renderError(message) {
    var modelId = opts.modelId || "the embedding model";
    setHead("err", "Download Failed");
    body.innerHTML =
      '<p class="oa-mg-lead">' + esc(message || "The model could not be downloaded. Check your connection and try again. Keyword search is unaffected.") + "</p>" +
      modelCard(modelId) +
      '<div class="oa-mg-actions">' +
        '<button class="oa-mg-btn oa-mg-btn-ghost" type="button" id="oa-mg-cancel">Close</button>' +
        '<button class="oa-mg-btn" type="button" id="oa-mg-retry">Try again</button>' +
      "</div>";
    body.querySelector("#oa-mg-cancel").addEventListener("click", close);
    body.querySelector("#oa-mg-retry").addEventListener("click", confirmDownload);
  }

  /* --------------------- live model-status listener -------------------- */

  function attachStatus() {
    if (statusHandler) return;
    statusHandler = function (e) {
      var d = e.detail || {};
      if (d.state === "downloading") updateProgress(typeof d.progress === "number" ? d.progress : 0);
      else if (d.state === "ready") renderInstalled();
      else if (d.state === "error") renderError(d.message);
    };
    window.addEventListener("oa-model-status", statusHandler);
  }
  function detachStatus() {
    if (statusHandler) { window.removeEventListener("oa-model-status", statusHandler); statusHandler = null; }
  }

  function open(options) {
    opts = options || {};
    buildOverlay();
    if (!overlay.open) overlay.showModal();

    var mode = opts.mode || "consent";
    // If the model is already mid-download when opened, resume the progress view.
    var cur = (window.OASemanticSearch && window.OASemanticSearch.getModelState) ? window.OASemanticSearch.getModelState() : null;
    if (mode === "installed" || (cur && cur.state === "ready")) renderInstalled();
    else if (cur && cur.state === "downloading") renderDownloading(cur.progress || 0);
    else renderConsent();
  }

  function close() {
    if (!overlay) return;
    detachStatus();
    overlay.close();
  }

  window.OAModelGate = { open: open, close: close };
})();
