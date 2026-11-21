/* Browser downloads, clipboard and the publisher-PDF popup window. */
(function () {
  "use strict";
  // Trigger a client-side download of `text` as `filename`. Shared by the .bib
  // and citation exporters (favorites.js). Silently no-ops if the
  // browser blocks the synthetic click.
  function downloadBlob(filename, text, mime) {
    var url, a;
    try {
      var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      url = URL.createObjectURL(blob);
      // Single mechanism: a synthetic <a download> click, which saves the blob
      // straight to disk with the right filename in every modern browser.
      //
      // The previous version ALSO called window.open(url, "_blank", "noopener")
      // when it detected an iframe - but window.open() returns null WHENEVER
      // "noopener" is in the features string (per the HTML spec), so the
      // `if (!w) viaAnchor()` fallback fired every time IN ADDITION to opening
      // the tab. That produced two downloads: the blob tab (UUID filename) plus
      // the anchor (correct filename). We rely on the anchor alone.
      a = document.createElement("a");
      a.href = url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
    } finally {
      if (a && a.parentNode) a.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // Clipboard. One navigator.clipboard path + the legacy execCommand("copy")
  // textarea fallback, shared by every copy affordance. Keep the fallback:
  // embedded hosts (a design tool's sandboxed iframe) block the Clipboard API.
  //   copyText(text)        -> Promise<boolean>
  //   copyRich(plain, html) -> Promise<boolean> (HTML flavour for Word/Docs/mail)
  // ---------------------------------------------------------------------------
  function _fallbackCopy(text) {
    var ta, previous = document.activeElement;
    try {
      ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      return !!document.execCommand("copy");
    } catch (e) { return false; }
    finally {
      if (ta && ta.parentNode) ta.remove();
      if (previous && previous.isConnected && previous.focus) {
        try { previous.focus({ preventScroll: true }); } catch (e) { /* detached control */ }
      }
    }
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return Promise.resolve(navigator.clipboard.writeText(text)).then(
          function () { return true; },
          function () { return _fallbackCopy(text); }
        );
      }
    } catch (e) { /* Some restricted hosts throw synchronously. */ }
    return Promise.resolve(_fallbackCopy(text));
  }
  function copyRich(plain, html) {
    if (!html) return copyText(plain);
    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      try {
        var item = new window.ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" })
        });
        return navigator.clipboard.write([item]).then(
          function () { return true; },
          function () { return copyText(plain); }
        );
      } catch (e) { /* fall through to plain */ }
    }
    return copyText(plain);
  }

  /* ---------- Popup windows, with an in-page fallback ------------------ *
   * The publisher PDF opens as a chrome-less OS window. Inside an EMBEDDED host -
   * a design tool's sandboxed iframe, a kiosk frame - window.open() is
   * refused outright, so every one of those buttons did nothing at all.
   * openWindow() then renders the same target as a draggable in-page panel
   * and hands back a WINDOW-LIKE FACADE, so callers keep a single code
   * path: .closed / .focus() / .close() / .postMessage() /
   * .location.replace() / .document.write() all behave as on a real window.
   * Set window.OA_INPAGE_POPUPS = true/false to force either mode.
   * ------------------------------------------------------------------- */
  var _popupStyled = false, _popups = {}, _popupStackEl = null, _popupOrder = [];
  // One stacking context contains all window focus ranks. Keeping dense ranks
  // also avoids an ever-growing counter during long research sessions.
  function popupStack() {
    if (!_popupStackEl || !_popupStackEl.isConnected) {
      _popupStackEl = document.createElement("div");
      _popupStackEl.className = "oa-popup-stack";
      (document.querySelector(".oa-root") || document.body).appendChild(_popupStackEl);
    }
    return _popupStackEl;
  }
  function rankPopups(front) {
    _popupOrder = _popupOrder.filter(function (el) { return el.isConnected && el !== front; });
    if (front && front.isConnected) _popupOrder.push(front);
    _popupOrder.forEach(function (el, index) { el.style.zIndex = index + 1; });
  }
  // A window positioned on a wide viewport can lose its title bar (and Close)
  // when the viewport is narrowed later: keep every live window inside the
  // viewport on resize, shrinking it first, then moving it.
  var _popupResizeBound = false;
  function clampPopup(el) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var r = el.getBoundingClientRect();
    // Same floors as creation and drag-resize (300 x 180, or the viewport when
    // that is smaller), so a re-clamp can never shrink a window below them.
    var minW = Math.min(300, vw - 16), minH = Math.min(180, vh - 16);
    var w = Math.max(minW, Math.min(r.width, vw - 16)), h = Math.max(minH, Math.min(r.height, vh - 16));
    var x = Math.min(Math.max(0, r.left), Math.max(0, vw - w));
    var y = Math.min(Math.max(0, r.top), Math.max(0, vh - h));
    if (w !== r.width) el.style.width = Math.round(w) + "px";
    if (h !== r.height) el.style.height = Math.round(h) + "px";
    if (x !== r.left) el.style.left = Math.round(x) + "px";
    if (y !== r.top) el.style.top = Math.round(y) + "px";
  }
  function watchPopupViewport() {
    if (_popupResizeBound) return;
    _popupResizeBound = true;
    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        Object.keys(_popups).forEach(function (k) { if (_popups[k].el.isConnected) clampPopup(_popups[k].el); });
      }, 80);
    });
  }
  function popupsEmbedded() {
    if (window.OA_INPAGE_POPUPS === true) return true;
    if (window.OA_INPAGE_POPUPS === false) return false;
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function popupStyles() {
    if (_popupStyled) return;
    _popupStyled = true;
    var st = document.createElement("style");
    st.textContent =
      ".oa-popup-stack{position:fixed;inset:0;z-index:var(--layer-window,200);pointer-events:none;}" +
      ".oa-popup:focus{outline:none;}" +
      ".oa-popup{position:fixed;z-index:1;pointer-events:auto;display:flex;flex-direction:column;background:var(--paper,#0c0e12);color:var(--ink,#e6e8ec);border:1px solid var(--line-strong,#333a45);border-radius:var(--radius-control,3px);box-shadow:0 18px 44px rgba(0,0,0,.45);overflow:hidden;min-width:300px;min-height:180px;}" +
      ".oa-popup-bar{display:flex;align-items:center;gap:8px;height:32px;padding:0 6px 0 10px;border-bottom:1px solid var(--line,#1b2027);background:var(--bg,#000);cursor:grab;user-select:none;touch-action:none;flex:0 0 auto;}" +
      ".oa-popup.is-dragging .oa-popup-bar{cursor:grabbing;}" +
      ".oa-popup-title{flex:1 1 auto;min-width:0;font-family:var(--mono,Arial,sans-serif);font-size:var(--fs-meta,12px);font-weight:600;color:var(--ink-2,#a3a8b3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".oa-popup-act{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 auto;padding:0;border:0;border-radius:var(--radius-control,3px);background:transparent;color:var(--ink-2,#a3a8b3);cursor:pointer;}" +
      ".oa-popup-act:hover{color:var(--accent-text);box-shadow:inset 0 0 0 1px var(--accent);}" +
      ".oa-popup-act:active{background:var(--accent-soft);}" +
      ".oa-popup-act:focus-visible{outline:var(--focus-ring, 2px solid currentColor);outline-offset:1px;}" +
      ".oa-popup-act svg{display:block;width:14px;height:14px;}" +
      ".oa-popup-body{position:relative;flex:1 1 auto;min-height:0;background:var(--paper,#0c0e12);}" +
      ".oa-popup-body iframe{display:block;width:100%;height:100%;border:0;background:var(--paper,#0c0e12);}" +
      ".oa-popup-note{position:absolute;inset:0;display:grid;place-items:center;padding:20px;text-align:center;font-family:var(--sans,Arial,sans-serif);font-size:var(--fs-meta,12px);color:var(--ink-2,#a3a8b3);text-wrap:pretty;pointer-events:none;}" +
      /* display:grid above beats the UA [hidden] rule, so without this the
         (empty) note stayed laid over the whole frame and ate every hover and
         click inside an in-page popup window. */
      ".oa-popup-note[hidden]{display:none;}" +
      ".oa-popup-foot{flex:0 0 auto;padding:5px 10px;border-top:1px solid var(--line,#1b2027);font-family:var(--mono,Arial,sans-serif);font-size:var(--fs-meta,12px);color:var(--muted,#868c98);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".oa-popup-foot a{color:var(--accent-text);text-decoration:none;}" +
      ".oa-popup-foot a:hover{text-decoration:underline;}" +
      "@media (any-pointer:coarse){.oa-popup-bar{height:48px}.oa-popup-act{width:44px;height:44px}.oa-popup-foot a{display:inline-flex;align-items:center;min-height:44px}}" +
      ".oa-popup-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;touch-action:none;z-index:2;}" +
      ".oa-popup-grip::after{content:'';position:absolute;right:3px;bottom:3px;width:7px;height:7px;border-right:2px solid var(--line-strong,#333a45);border-bottom:2px solid var(--line-strong,#333a45);}";
    document.head.appendChild(st);
  }
  var POPUP_EXT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"></path><path d="M11 13l9 -9"></path><path d="M15 4h5v5"></path></svg>';
  var POPUP_X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6l-12 12"></path></svg>';
  function popupGeo() {
    var all = window.OAPrefs.getJSON("oa-popup-geo", {});
    return all && typeof all === "object" ? all : {};
  }
  function savePopupGeo(name, g) {
    var all = popupGeo();
    all[name] = g;
    window.OAPrefs.setJSON("oa-popup-geo", all);
  }
  // Drag / resize on one pointer, clamped so a panel can never be parked
  // outside the viewport (there is no OS window manager to rescue it).
  function popupDrag(el, handle, mode, name) {
    var active = null, frame = null, latest = null;
    function paint() {
      frame = null;
      if (!active || !latest) return;
      var r = active.rect, dx = latest.x - active.x, dy = latest.y - active.y;
      if (mode === "move") {
        el.style.left = Math.min(Math.max(0, r.left + dx), Math.max(0, window.innerWidth - r.width)) + "px";
        el.style.top = Math.min(Math.max(0, r.top + dy), Math.max(0, window.innerHeight - 34)) + "px";
      } else {
        el.style.width = Math.max(Math.min(300, window.innerWidth - 24), Math.min(r.width + dx, window.innerWidth - r.left - 8)) + "px";
        el.style.height = Math.max(Math.min(180, window.innerHeight - 24), Math.min(r.height + dy, window.innerHeight - r.top - 8)) + "px";
      }
    }
    function finish(save) {
      if (!active) return;
      var pointerId = active.id;
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      if (save) paint();
      active = null; latest = null;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      handle.removeEventListener("lostpointercapture", cancel);
      try { handle.releasePointerCapture(pointerId); } catch (e) { /* capture already lost */ }
      el.classList.remove("is-dragging", "is-resizing");
      if (save && el.isConnected) {
        var b = el.getBoundingClientRect();
        savePopupGeo(name, { x: b.left, y: b.top, w: b.width, h: b.height });
      }
    }
    function move(e) {
      if (!active || e.pointerId !== active.id) return;
      latest = { x: e.clientX, y: e.clientY };
      if (frame === null) frame = requestAnimationFrame(paint);
    }
    function up(e) { if (active && e.pointerId === active.id) { move(e); finish(true); } }
    function cancel(e) { if (active && e.pointerId === active.id) finish(false); }
    function down(e) {
      if (active || e.button !== 0 || e.target.closest(".oa-popup-act")) return;
      e.preventDefault();
      active = { id: e.pointerId, rect: el.getBoundingClientRect(), x: e.clientX, y: e.clientY };
      el.classList.add(mode === "move" ? "is-dragging" : "is-resizing");
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", cancel);
      handle.addEventListener("lostpointercapture", cancel);
      try { handle.setPointerCapture(e.pointerId); } catch (error) { finish(false); }
    }
    handle.addEventListener("pointerdown", down);
    return function () { finish(false); handle.removeEventListener("pointerdown", down); };
  }
  function popupPanel(url, name, w0, h0, opts) {
    popupStyles();
    var live = _popups[name];
    if (live && live.el.isConnected) {
      if (opts.title) live.titleEl.textContent = opts.title;
      if (url) live.face.location.replace(url);
      live.face.focus();
      return live.face;
    }
    // The control that opened the window gets focus back when it closes.
    var opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    watchPopupViewport();
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(w0 || 1040, vw - 24), h = Math.min(h0 || 760, vh - 24);
    var saved = popupGeo()[name] || null;
    if (saved) { w = Math.min(Math.max(300, saved.w || w), vw - 24); h = Math.min(Math.max(180, saved.h || h), vh - 24); }
    var el = document.createElement("div");
    el.className = "oa-popup";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", opts.title || "Window");
    el.tabIndex = -1;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = Math.round(saved ? Math.min(Math.max(0, saved.x), vw - w) : (vw - w) / 2) + "px";
    el.style.top = Math.round(saved ? Math.min(Math.max(0, saved.y), vh - h) : (vh - h) / 2) + "px";
    var bar = document.createElement("div");
    bar.className = "oa-popup-bar";
    var titleEl = document.createElement("span");
    titleEl.className = "oa-popup-title";
    titleEl.textContent = opts.title || "Window";
    var pop = document.createElement("a");
    pop.className = "oa-popup-act";
    pop.target = "_blank";
    pop.rel = "noopener";
    pop.href = url || "#";
    pop.title = "Open in a new tab";
    pop.setAttribute("aria-label", "Open in a new tab");
    pop.innerHTML = POPUP_EXT_SVG;
    var shut = document.createElement("button");
    shut.type = "button";
    shut.className = "oa-popup-act";
    shut.title = "Close";
    shut.setAttribute("aria-label", "Close this window");
    shut.innerHTML = POPUP_X_SVG;
    bar.appendChild(titleEl); bar.appendChild(pop); bar.appendChild(shut);
    var body = document.createElement("div");
    body.className = "oa-popup-body";
    var frame = document.createElement("iframe");
    frame.title = opts.title || "Window";
    if (url) frame.src = url;
    var note = document.createElement("div");
    note.className = "oa-popup-note";
    note.textContent = url ? "" : "Loading\u2026";
    note.hidden = !!url;
    body.appendChild(frame); body.appendChild(note);
    var grip = document.createElement("div");
    grip.className = "oa-popup-grip";
    var foot = document.createElement("div");
    foot.className = "oa-popup-foot";
    foot.hidden = true;
    el.appendChild(bar); el.appendChild(body); el.appendChild(foot); el.appendChild(grip);
    // Mounted inside .oa-root so the scheme's palette variables apply (see copyToast).
    popupStack().appendChild(el);
    rankPopups(el);
    var disposeMove = popupDrag(el, bar, "move", name);
    var disposeResize = popupDrag(el, grip, "resize", name);
    var closed = false;
    var face = {
      get closed() { return closed; },
      // Raise the window AND move keyboard focus into it (a nonmodal window:
      // no focus trap, the page behind stays usable).
      focus: function () {
        if (closed) return;
        rankPopups(el);
        if (!el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
      },
      close: function () {
        if (closed) return;
        closed = true;
        var hadFocus = el.contains(document.activeElement);
        disposeMove(); disposeResize();
        el.remove();
        rankPopups();
        if (!_popupOrder.length && _popupStackEl) { _popupStackEl.remove(); _popupStackEl = null; }
        delete _popups[name];
        // Return focus to the opener when it is still there; otherwise to the
        // next window up, so focus never falls back to <body>.
        if (hadFocus || document.activeElement === document.body) {
          var next = _popupOrder.length ? _popupOrder[_popupOrder.length - 1] : null;
          var target = (opener && opener.isConnected && !opener.closest(".oa-popup")) ? opener : next;
          if (target) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }
        }
      },
      postMessage: function (msg, origin) {
        if (closed) return;
        try { frame.contentWindow.postMessage(msg, origin || "*"); } catch (e) { /* not loaded yet */ }
      },
      location: {
        replace: function (u) {
          if (closed) return;
          note.hidden = true;
          pop.href = u;
          frame.src = u;
          // A foreign host (a publisher PDF) may refuse to be framed, and the
          // refusal is invisible from here - so always offer the way out.
          var foreign = false;
          try { var target = new URL(u, document.baseURI); foreign = /^https?:$/.test(target.protocol) && target.origin !== location.origin; } catch (e) { /* invalid target */ }
          foot.hidden = !foreign;
          if (foreign) {
            foot.innerHTML = "";
            foot.appendChild(document.createTextNode("Blank? the publisher blocks embedding \u00b7 "));
            var out = document.createElement("a");
            out.href = u; out.target = "_blank"; out.rel = "noopener";
            out.textContent = "open in a new tab";
            foot.appendChild(out);
          }
        },
        assign: function (u) { this.replace(u); },
        set href(u) { face.location.replace(u); },
        get href() { return frame.src; }
      },
      // The PDF popup writes a "waiting on Unpaywall" page into the blank
      // window; here that copy becomes the panel's own status line.
      document: {
        open: function () { /* no document to open */ },
        write: function (html) {
          if (closed) return;
          note.hidden = false;
          note.textContent = String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        },
        close: function () { /* nothing to flush */ }
      }
    };
    if (url) face.location.replace(url);
    shut.addEventListener("click", face.close);
    el.addEventListener("pointerdown", function () { if (!closed) rankPopups(el); }, true);
    // Escape inside the window (its own chrome, not the framed page) closes it.
    el.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); face.close(); } });
    _popups[name] = { el: el, titleEl: titleEl, face: face };
    face.focus();
    return face;
  }
  // Real OS window where the browser allows one, in-page panel otherwise.
  // opts: { title } - the panel's title bar (ignored by a real window).
  function openWindow(url, name, w0, h0, opts) {
    opts = opts || {};
    if (!popupsEmbedded()) {
      var aw = (window.screen && window.screen.availWidth) || window.innerWidth;
      var ah = (window.screen && window.screen.availHeight) || window.innerHeight;
      var w = Math.min(w0 || 1040, aw - 80), h = Math.min(h0 || 760, ah - 80);
      var win = null;
      try { win = window.open(url, name, "popup=yes,width=" + w + ",height=" + h +
        ",left=" + Math.max(0, (aw - w) / 2) + ",top=" + Math.max(0, (ah - h) / 2) + ",resizable=yes,scrollbars=yes"); } catch (e) { /* restricted host: use panel */ }
      if (win) {
        // The window shows another site's page (a publisher's PDF): it must
        // not get a handle on this tab, which it could send to any address.
        // Severed now, while it is still this site's blank page; this page can
        // still point it at the PDF. ("noopener" in the features would make
        // window.open return null, and a blocked popup could not be told apart.)
        try { win.opener = null; } catch (e) { /* already cross-origin: nothing to sever */ }
        try { win.focus(); } catch (e) { /* ignore */ }
        return win;
      }
      // Blocked: fall through to the in-page panel rather than doing nothing.
    }
    return popupPanel(url, name, w0, h0, opts);
  }

  window.OABrowserActions = Object.freeze({ downloadBlob: downloadBlob, copyText: copyText, copyRich: copyRich, openWindow: openWindow });
})();
