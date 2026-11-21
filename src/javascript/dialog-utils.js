/* Shared modal dialogs, on the native <dialog>. showModal() puts the dialog in
   the top layer, makes the rest of the page inert, keeps Tab inside and
   close() hands focus back to the opener - the browser does the bookkeeping. */
(function () {
  "use strict";
  // ponytail: native focus return only; a nested dialog whose opener is gone sends focus to <body>.

  // Shared visual roles are installed on first dialog use. The component
  // sheets keep their own geometry, density, variants and responsive actions.
  // Grouped aliases preserve the existing classes and selector specificity.
  // The <dialog> itself is the full-window scrim (UA box reset, flex only when
  // open); the card sits inside it.
  var SCRIMS = ".oa-mg-overlay,.oa-ap-overlay,.oa-er-overlay,.oa-confirm-backdrop";
  function ensureStyles() {
    if (document.getElementById("oa-dialog-styles")) return;
    var style = document.createElement("style");
    style.id = "oa-dialog-styles";
    style.textContent = [
      ":is(" + SCRIMS + "){position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;border:0;color:inherit;justify-content:center;background:color-mix(in srgb,var(--ink) 42%,transparent);backdrop-filter:blur(3px);overflow-y:auto}",
      ":is(" + SCRIMS + ")[open]{display:flex}",
      ":is(" + SCRIMS + ")::backdrop{background:none}",
      "body:has(dialog:modal){overflow:hidden}",
      ".oa-mg-overlay,.oa-ap-overlay,.oa-er-overlay{align-items:flex-start;padding:8vh 20px 20px}",
      ".oa-mg-dialog,.oa-ap-dialog,.oa-er-dialog{width:100%;background:var(--paper);border:1px solid var(--line-strong);overflow:hidden;animation:oa-dialog-pop .16s ease-out}",
      ".oa-mg-head,.oa-ap-head,.oa-er-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line)}",
      ".oa-mg-title,.oa-ap-title,.oa-er-title{font-family:var(--sans);letter-spacing:normal;color:var(--ink);margin:0}",
      ".oa-mg-close,.oa-ap-close,.oa-er-close{display:inline-flex;align-items:center;justify-content:center;background:transparent;cursor:pointer;transition:background .12s,color .12s,border-color .12s,box-shadow .12s}",
      ".oa-mg-lead,.oa-ap-lead,.oa-er-lead{font-family:var(--sans);line-height:1.5;color:var(--ink-2);text-wrap:pretty}",
      ".oa-mg-actions,.oa-ap-actions,.oa-er-actions{display:flex;gap:10px;margin-top:4px}",
      ".oa-mg-btn,.oa-ap-btn,.oa-er-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:600;cursor:pointer}",
      ".oa-ap-dialog,.oa-er-dialog{max-width:460px;border-radius:var(--radius-control,3px);box-shadow:var(--shadow-pop)}",
      ".oa-ap-head,.oa-er-head{padding:16px 18px}",
      ".oa-ap-title,.oa-er-title{font-size:var(--fs-lead);font-weight:600}",
      ".oa-ap-close,.oa-er-close{width:28px;height:28px;padding:0;border:0;border-radius:var(--radius-control,3px);color:var(--ink-2);font-family:var(--sans);font-size:var(--fs-lead);line-height:1}",
      ".oa-ap-body,.oa-er-body{padding:18px}",
      ".oa-ap-lead,.oa-er-lead{font-size:var(--fs-body);margin:0 0 16px}",
      ".oa-ap-actions,.oa-er-actions{justify-content:flex-end}",
      ".oa-ap-btn,.oa-er-btn{font-family:var(--sans);font-size:var(--fs-meta);text-decoration:none;color:var(--on-accent);background:var(--accent);border:1px solid var(--accent);border-radius:var(--radius-control,3px);height:var(--control-size,34px);box-sizing:border-box;padding:0 14px}",
      ".oa-ap-close:hover,.oa-er-close:hover{color:var(--accent-text);box-shadow:inset 0 0 0 1px var(--accent)}",
      ".oa-ap-close:active,.oa-er-close:active{background:var(--accent-soft)}",
      ".oa-ap-field,.oa-er-field{display:block;margin-bottom:16px}",
      ".oa-ap-input,.oa-er-input{width:100%;box-sizing:border-box;font-family:var(--sans);font-size:var(--fs-body);color:var(--ink);background:color-mix(in srgb,var(--ink) 4%,var(--paper));border:1px solid var(--line);border-radius:var(--radius-control,3px);padding:9px 11px;outline:none;transition:border-color .12s,background .12s,box-shadow .12s}",
      ".oa-ap-input::placeholder,.oa-er-input::placeholder{color:var(--muted)}",
      ".oa-ap-input:focus-visible,.oa-er-input:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-ring-offset)}",
      ".oa-ap-input:focus,.oa-er-input:focus{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));background:var(--paper);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}",
      ".oa-ap-msg,.oa-er-msg{font-family:var(--sans);font-size:var(--fs-meta);line-height:1.45;min-height:0}",
      ".oa-ap-msg:empty,.oa-er-msg:empty{margin:0}",
      ".oa-ap-actions-split,.oa-er-actions-split{justify-content:space-between}",
      ".oa-ap-btn:hover,.oa-er-btn:hover{box-shadow:inset 0 0 0 1px currentColor}",
      ".oa-ap-btn-ghost,.oa-er-btn-ghost{color:var(--ink-2);background:transparent;border-color:var(--line-strong)}",
      ".oa-ap-btn.oa-ap-btn-ghost,.oa-er-btn.oa-er-btn-ghost{font-weight:400}",
      ".oa-ap-btn:focus-visible,.oa-er-btn:focus-visible,.oa-mg-btn:focus-visible,.oa-ap-close:focus-visible,.oa-er-close:focus-visible,.oa-mg-close:focus-visible{outline:var(--focus-ring,2px solid currentColor);outline-offset:var(--focus-ring-offset,2px)}",
      ".oa-ap-btn-ghost:hover,.oa-er-btn-ghost:hover{background:transparent;border-color:var(--accent);color:var(--accent-text);box-shadow:none}",
      ".oa-ap-btn-ghost:active,.oa-er-btn-ghost:active{background:var(--accent-soft)}",
      ".oa-mg-head-l,.oa-er-head-l{display:flex;align-items:center;gap:10px;min-width:0}",
      "@keyframes oa-dialog-pop{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}",
      "@media (max-width:480px){.oa-mg-overlay,.oa-ap-overlay,.oa-er-overlay{padding:4vh 12px 12px}}",
      "@media (any-pointer:coarse){.oa-mg-close,.oa-ap-close,.oa-er-close,.oa-mg-btn,.oa-ap-btn,.oa-er-btn{min-width:44px;min-height:44px}.oa-ap-check,.oa-mg-ackbox{min-height:44px}.oa-ap-info{min-width:44px;min-height:44px}}",
      ".oa-confirm-backdrop{align-items:center;padding:20px}",
      ".oa-confirm{background:var(--paper);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius-control);box-shadow:var(--shadow-float);max-width:min(92vw,420px);padding:14px 14px 14px;font-family:var(--sans);}",
      ".oa-confirm h2{margin:0 0 8px;font-family:var(--sans);font-size:var(--fs-meta);font-weight:600;color:var(--ink);}",
      ".oa-confirm p{margin:0 0 16px;font-size:var(--fs-meta);color:var(--ink-2);white-space:pre-line;text-wrap:pretty;}",
      ".oa-confirm-row{display:flex;gap:10px;justify-content:flex-end;}",
      ".oa-confirm-row button{font:inherit;font-family:var(--mono);font-size:var(--fs-meta);font-weight:600;height:var(--control-size);padding:0 14px;border-radius:var(--radius-control);cursor:pointer;border:1px solid var(--line-strong);background:transparent;transition:border-color .12s,color .12s,background .12s;color:var(--ink);white-space:nowrap;flex-shrink:0;}",
      ".oa-confirm-row button:hover{border-color:var(--accent);color:var(--accent-text);}",
      ".oa-confirm-row .oa-confirm-ok{background:var(--accent);border-color:var(--accent);color:var(--on-accent);}",
      ".oa-confirm-row .oa-confirm-ok:hover{box-shadow:inset 0 0 0 1px currentColor;color:var(--on-accent);}",
      ".oa-confirm-row .oa-confirm-ok.is-danger{background:var(--danger);border-color:var(--danger);color:var(--on-danger);}",
      ".oa-confirm-row button:focus-visible{outline:var(--focus-ring, 2px solid currentColor);outline-offset:var(--focus-ring-offset, 2px);}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // Esc closes through the owner's handler, on the dialog itself so a page-level
  // Escape (the open abstract, the grid selection) never acts behind the modal.
  // "cancel" covers the other close requests (Android back).
  function onDismiss(dialog, handler) {
    dialog.addEventListener("mousedown", function (e) { if (e.target === dialog) handler(); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
    dialog.addEventListener("cancel", function (e) { e.preventDefault(); handler(); });
  }

  // Shared confirm: safe default (Cancel takes focus), unique accessible names.
  var _confirmSequence = 0;
  function confirmDialog(opts) {
    opts = opts || {};
    ensureStyles();
    return new Promise(function (resolve) {
      var back = document.createElement("dialog");
      back.className = "oa-confirm-backdrop";
      back.setAttribute("role", "alertdialog");
      var box = document.createElement("div");
      box.className = "oa-confirm";
      var sequence = ++_confirmSequence;
      var h = document.createElement("h2");
      h.id = "oaConfirmTitle-" + sequence;
      h.textContent = opts.title || "Are you sure?";
      var p = document.createElement("p");
      p.id = "oaConfirmMsg-" + sequence;
      p.textContent = opts.message || "";
      back.setAttribute("aria-labelledby", h.id);
      if (opts.message) back.setAttribute("aria-describedby", p.id);
      var row = document.createElement("div");
      row.className = "oa-confirm-row";
      var no = document.createElement("button");
      no.type = "button";
      no.autofocus = true;
      no.textContent = opts.cancelLabel || "Cancel";
      var yes = document.createElement("button");
      yes.type = "button";
      yes.className = "oa-confirm-ok" + (opts.danger ? " is-danger" : "");
      yes.textContent = opts.confirmLabel || "OK";
      row.appendChild(no); row.appendChild(yes);
      box.appendChild(h); if (opts.message) box.appendChild(p); box.appendChild(row);
      back.appendChild(box);
      var closed = false;
      function close(val) {
        if (closed) return;
        closed = true;
        back.close();
        back.remove();
        resolve(val);
      }
      onDismiss(back, function () { close(false); });
      no.addEventListener("click", function () { close(false); });
      yes.addEventListener("click", function () { close(true); });
      // The themed root supplies the exact same palette as existing dialogs.
      (document.querySelector(".oa-root") || document.body).appendChild(back);
      back.showModal();
    });
  }

  // The frame the overlay dialogs share (add-paper, report-error, model-gate):
  // <dialog> scrim > card > head (optional icon, title, close) + body, classed
  // by o.prefix ("oa-ap" -> .oa-ap-overlay, ...). o.css is the dialog's own
  // sheet, added once. The dialog mounts in the themed root so palette
  // variables resolve; o.onClose runs on a scrim press, the close button and
  // Esc. The owner opens it with showModal(). -> { overlay, body, title, icon }
  function overlayFrame(o) {
    var p = o.prefix;
    ensureStyles();
    if (o.css && !document.getElementById(p + "-styles")) {
      var sheet = document.createElement("style");
      sheet.id = p + "-styles";
      sheet.textContent = o.css;
      document.head.appendChild(sheet);
    }
    var title = '<h2 class="' + p + '-title" id="' + p + '-title">' + (o.title || "") + "</h2>";
    var overlay = document.createElement("dialog");
    overlay.className = p + "-overlay";
    overlay.setAttribute("aria-labelledby", p + "-title");
    overlay.innerHTML =
      '<div class="' + p + '-dialog">' +
        '<div class="' + p + '-head">' +
          (o.icon == null ? title : '<div class="' + p + '-head-l"><span class="' + p + '-head-ic" aria-hidden="true">' + o.icon + "</span>" + title + "</div>") +
          '<button class="' + p + '-close" type="button" aria-label="Close">\u00d7</button>' +
        "</div>" +
        '<div class="' + p + '-body" id="' + p + '-body"></div>' +
      "</div>";
    (document.querySelector(".oa-root") || document.body).appendChild(overlay);
    onDismiss(overlay, o.onClose);
    overlay.querySelector("." + p + "-close").addEventListener("click", o.onClose);
    return { overlay: overlay, body: overlay.querySelector("#" + p + "-body"),
      title: overlay.querySelector("." + p + "-title"), icon: overlay.querySelector("." + p + "-head-ic") };
  }

  window.OADialog = Object.freeze({ confirmDialog: confirmDialog, overlayFrame: overlayFrame });
})();
