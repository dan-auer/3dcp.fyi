/* grid-settings.js - the article browser's Settings panel (its Search,
 * Appearance and Reader tabs: grid-shell.js markup, header-actions.js tabs and
 * reset label) and the semantic model button beside the search field. Host UI
 * for state other modules own: the search settings live in OASemanticSearch,
 * the reader's in OATTS, the rest in OAPrefs, applied as root attributes the
 * stylesheets read. Everything it adds is released through ctx.scope.
 *
 * attach(ctx), from articles-grid.js buildGrid:
 *   ctx.scope             the table lifetime (oa-lifecycle.js)
 *   ctx.grid, ctx.absRows the abstract layout re-measures open drops
 *   ctx.searchController  a changed setting re-runs the search
 *   ctx.escapeHtml        OATheme.escapeHtml
 *   ctx.citeStyle         the reference style in force; ctx.citeStyleKey its pref
 * Split out of buildGrid, unchanged.
 */
(function () {
  "use strict";

  function attach(ctx) {
    const { scope, grid, absRows, searchController, escapeHtml, citeStyle } = ctx;
    const CITE_STYLE_KEY = ctx.citeStyleKey;

    // Model-download control embedded at the right of the search bar. The heavy
    // embedding model downloads only on explicit user consent (never implicitly
    // by searching); the button mirrors the module's model lifecycle - red = not
    // downloaded, animated bar = downloading, green = ready & operational.
    (function wireModelDownload() {
      var btn = document.getElementById("modelDownloadBtn");
      var prog = document.getElementById("modelDownloadProgress");
      if (!btn) return;
      var iconWrap = btn.querySelector(".oa-tsearch-model-ic");
      var fill = prog ? prog.querySelector(".oa-tsearch-progress-fill") : null;
      // The state in words beside the tinted icon ("Semantic off / 42% / on").
      var labelEl = btn.querySelector(".oa-tsearch-model-t");
      function setModelLabel(text, name) {
        if (labelEl) labelEl.textContent = text;
        btn.setAttribute("aria-label", name);
      }

      var IC_DL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + window.OATheme.MODEL_ICON_PATHS + '</svg>';
      var MODEL_ID = "Snowflake/snowflake-arctic-embed-m-v1.5";

      function stateOf() {
        return btn.classList.contains("is-ready") ? "ready"
             : btn.classList.contains("is-downloading") ? "downloading"
             : btn.classList.contains("is-error") ? "error" : "absent";
      }
      function apply(detail) {
        var st = (detail && detail.state) || "absent";
        var pc = (detail && typeof detail.progress === "number") ? detail.progress : 0;
        if (detail && detail.modelId) MODEL_ID = detail.modelId;
        btn.classList.remove("is-absent", "is-downloading", "is-ready", "is-error");
        // The semantic ranking sliders do nothing without the model AND the
        // abstract vectors - show them only once both are resident.
        var semGroup = document.getElementById("ssSemanticGroup");
        var sapi0 = window.OASemanticSearch;
        if (semGroup) semGroup.hidden = !(st === "ready" && sapi0 && sapi0.hasVectors && sapi0.hasVectors());
        if (st === "ready") {
          btn.classList.add("is-ready");
          iconWrap.innerHTML = IC_DL;
          btn.title = "Semantic model ready\nStored in your browser";
          setModelLabel("Semantic on", "Semantic on: model ready, stored in your browser");
          if (prog) prog.hidden = true;
        } else if (st === "downloading") {
          btn.classList.add("is-downloading");
          iconWrap.innerHTML = IC_DL;
          btn.title = "Downloading model\u2026 " + Math.round(pc) + "%";
          setModelLabel("Semantic " + Math.round(pc) + "%", "Semantic " + Math.round(pc) + "%: downloading the model");
          if (prog) { prog.hidden = false; if (fill) fill.style.width = Math.max(4, pc) + "%"; }
        } else {
          btn.classList.add(st === "error" ? "is-error" : "is-absent");
          iconWrap.innerHTML = IC_DL;
          btn.title = st === "error" ? "Model download failed\nClick to retry" : "Download semantic search model";
          setModelLabel(st === "error" ? "Semantic retry" : "Semantic off",
            st === "error" ? "Semantic retry: the model download failed" : "Semantic off: download the semantic search model");
          if (prog) prog.hidden = true;
        }
      }
      if (iconWrap) iconWrap.innerHTML = IC_DL;   // one icon for every state; CSS tints it
      apply({ state: "absent", progress: 0 });

      // Seed from the module if it's already up, then listen on window so the
      // load order between this script and the (deferred) module doesn't matter.
      if (window.OASemanticSearch && window.OASemanticSearch.getModelState) apply(window.OASemanticSearch.getModelState());
      scope.listen(window, "oa-model-status", function (e) { apply(e.detail || {}); });
      scope.listen(window, "oa-search-ready", function () {
        var api = window.OASemanticSearch;
        if (api) apply(api.getModelState());
      });

      scope.listen(btn, "click", function () {
        if (!window.OAModelGate && window.OAFeatures) {
          if (btn.getAttribute("aria-busy") === "true") return;
          btn.setAttribute("aria-busy", "true");
          window.OAFeatures.load("model").then(scope.guard(function () { btn.click(); }))
            .catch(scope.guard(window.OAFeatures.failed)).finally(scope.guard(function () { btn.removeAttribute("aria-busy"); }));
          return;
        }
        var st = stateOf();
        // The search API is resolved when the dialog CONFIRMS, not when it
        // opened, and start() reports whether a download actually began: false
        // when there is no module to ask, otherwise downloadModel()'s promise
        // (false once initialization failed). The dialog shows an error for both.
        function start() {
          var sapi = window.OASemanticSearch;
          if (!(sapi && sapi.downloadModel)) return false;
          apply({ state: "downloading", progress: 0 });
          // downloadModel() resolves false without a model-status event when
          // search initialization itself rejects: re-read the lifecycle state so
          // the toolbar does not stay painted as downloading.
          return sapi.downloadModel().then(scope.guard(function (ok) {
            if (!ok && sapi.getModelState) apply(sapi.getModelState());
            return ok;
          }));
        }
        function remove() {
          var sapi = window.OASemanticSearch;
          if (sapi && sapi.deleteModel) sapi.deleteModel().then(scope.guard(function (ok) {
            if (!ok) window.OATheme.copyToast("Model stopped, but stored files could not be removed. Try again.", false);
          }));
        }
        if (st === "downloading") {
          if (window.OAModelGate) window.OAModelGate.open({ mode: "consent", modelId: MODEL_ID, onConfirm: scope.guard(start), onRemove: scope.guard(remove) });
          return;
        }
        if (st === "ready") {
          if (window.OAModelGate) window.OAModelGate.open({ mode: "installed", modelId: MODEL_ID, onConfirm: scope.guard(start), onRemove: scope.guard(remove) });
          return;
        }
        if (window.OAModelGate) {
          window.OAModelGate.open({ mode: "consent", modelId: MODEL_ID, onConfirm: scope.guard(start), onRemove: scope.guard(remove) });
        } else {
          window.OADialog.confirmDialog({
            title: "Download the semantic search model?",
            message: MODEL_ID + " is fetched from huggingface.co and stored in your browser until you clear it.",
            confirmLabel: "Download"
          }).then(scope.guard(function (ok) { if (ok) start(); }));
        }
      });
    })();

    // Search settings popover: sliders for scoring, result cap and typo
    // tolerance. Values live in window.OASemanticSearch (persisted); changing
    // one re-runs the current query (cheap - the module caches the embedding
    // and lexical hits per query, so a ranking-only change re-ranks instantly).
    (function wireSearchSettings() {
      var btn = document.getElementById("searchSettings");
      var panel = document.getElementById("searchSettingsPanel");
      if (!btn || !panel) return;
      scope.add(closePanel);
      var wWeight = document.getElementById("ssWeight");
      var wMin = document.getElementById("ssMin");
      var wTol = document.getElementById("ssTol");
      var oWeight = document.getElementById("ssWeightOut");
      var oMin = document.getElementById("ssMinOut");
      var oTol = document.getElementById("ssTolOut");
      var resetBtn = document.getElementById("ssReset");
      // The reset button acts on the open tab only (its label says which,
      // header-actions.js); each tab's part below asks this first.
      function resetTab() {
        var t = panel.querySelector('.ss-tab[aria-selected="true"]');
        return (t && t.dataset.tab) || "search";
      }
      // Category chip style: "dot" (neutral chip, coloured dot) or "fill"
      // (chip filled with the category colour, black dot). Persisted; applied
      // as a root attribute so plain CSS does the swap on every chip at once.
      var CHIP_KEY = "oa-cat-chip-style";
      var chipBtns = { dot: document.getElementById("ssChipDot"), fill: document.getElementById("ssChipFill") };
      function applyChipStyle(v) {
        v = v === "fill" ? "fill" : "dot";
        document.documentElement.setAttribute("data-cat-chips", v);
        Object.keys(chipBtns).forEach(function (k) { if (chipBtns[k]) chipBtns[k].setAttribute("aria-checked", k === v ? "true" : "false"); });
      }
      applyChipStyle(window.OAPrefs.get(CHIP_KEY));
      Object.keys(chipBtns).forEach(function (k) {
        if (!chipBtns[k]) return;
        scope.listen(chipBtns[k], "click", function () {
          applyChipStyle(k);
          window.OAPrefs.set(CHIP_KEY, k);
        });
      });
      // Graphs start: "field" (every graph from 1997-02, one timeline for all)
      // or "data" (each from its first value). Persisted as a root attribute;
      // the charts (influence.js, topic-panel.js) read it and redraw on the
      // oa-graph-start event.
      var GRAPH_KEY = "oa-graph-start";
      var graphBtns = { field: document.getElementById("ssGraphField"), data: document.getElementById("ssGraphData") };
      function applyGraphStart(v, announce) {
        v = v === "field" ? "field" : "data";
        document.documentElement.setAttribute("data-graph-start", v);
        Object.keys(graphBtns).forEach(function (k) { if (graphBtns[k]) graphBtns[k].setAttribute("aria-checked", k === v ? "true" : "false"); });
        if (announce) window.dispatchEvent(new CustomEvent("oa-graph-start", { detail: v }));
      }
      applyGraphStart(window.OAPrefs.get(GRAPH_KEY), true);
      Object.keys(graphBtns).forEach(function (k) {
        if (!graphBtns[k]) return;
        scope.listen(graphBtns[k], "click", function () {
          applyGraphStart(k, true);
          window.OAPrefs.set(GRAPH_KEY, k);
        });
      });
      // Abstract layout: "flow" (one justified paragraph) or "lines" (every
      // sentence starts a new line - the abstracts are stored as sentence
      // arrays, so the .abs-sentence spans already exist; CSS makes them blocks).
      // Persisted as a root attribute like the chip style. Open drops change
      // height with it, so they are re-measured and re-laid.
      var ABS_KEY = "oa-abs-layout";
      var absBtns = { flow: document.getElementById("ssAbsFlow"), lines: document.getElementById("ssAbsLines") };
      function applyAbsLayout(v, relayout) {
        v = v === "lines" ? "lines" : "flow";
        document.documentElement.setAttribute("data-abs-layout", v);
        Object.keys(absBtns).forEach(function (k) { if (absBtns[k]) absBtns[k].setAttribute("aria-checked", k === v ? "true" : "false"); });
        if (relayout && absRows.count()) {
          // Same path a width change takes: re-measure every open drop at the
          // new layout, re-reserve its rows, repaint. Reading position and the
          // open set are untouched.
          absRows.remeasure(true);
          absRows.rebuild();
          grid.invalidate();   // updateRowCount + invalidateAllRows + render
        }
      }
      applyAbsLayout(window.OAPrefs.get(ABS_KEY));
      Object.keys(absBtns).forEach(function (k) {
        if (!absBtns[k]) return;
        scope.listen(absBtns[k], "click", function () {
          applyAbsLayout(k, true);
          window.OAPrefs.set(ABS_KEY, k);
        });
      });
      // Reset on the Appearance tab: chips, graph start and abstract layout to
      // their defaults, the theme to mint (the site's default look, oa-boot.js;
      // its radio's own click handler, oa-theme.js, applies it), and the
      // colours the retired accent pickers stored cleared.
      if (resetBtn) scope.listen(resetBtn, "click", function () {
        if (resetTab() !== "look") return;
        [CHIP_KEY, GRAPH_KEY, ABS_KEY, "oa-theme-colors"].forEach(function (k) { window.OAPrefs.remove(k); });
        applyChipStyle("dot");
        applyGraphStart("data", true);
        applyAbsLayout("flow", true);
        var mint = panel.querySelector('[data-oa-theme="mint"]');
        if (mint) mint.click();
      });

      /* Reference style for the copy-reference button in the access column.
         The styles come from cite-format.js so this list can never drift from
         what the formatter actually supports. */
      (function wireCiteStyle() {
        var sel = document.getElementById("ssCiteStyle");
        if (!sel) return;
        var styles = window.CITE_STYLES || [];
        if (!styles.length) { sel.closest(".ss-group").hidden = true; return; }
        sel.innerHTML = styles.map(function (s) {
          return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + "</option>";
        }).join("");
        sel.value = citeStyle();
        scope.listen(sel, "change", function () {
          window.OAPrefs.set(CITE_STYLE_KEY, sel.value);
        });
        // Reset on the Reader tab: back to the default style (the list's first).
        if (resetBtn) scope.listen(resetBtn, "click", function () {
          if (resetTab() !== "read") return;
          window.OAPrefs.remove(CITE_STYLE_KEY);
          sel.value = citeStyle();
        });
      })();

      /* Read-aloud settings for the abstract drops. The player itself lives in
         oa-tts.js (one per tab); this panel is just its control surface, so a
         change takes effect immediately - including mid-read, which oa-tts.js
         handles by re-speaking from the top at the new voice/speed. Hidden
         entirely where the browser has no speech synthesis. */
      var readAloudWired = false;
      function wireReadAloud() {
        var T = window.OATTS;
        var group = document.getElementById("ssTtsGroup");
        if (readAloudWired || !group || !T || !T.supported) return;
        readAloudWired = true;
        group.hidden = false;
        var voiceSel = document.getElementById("ssTtsVoice");
        var rate = document.getElementById("ssTtsRate");
        var rateOut = document.getElementById("ssTtsRateOut");
        var hl = { on: document.getElementById("ssTtsHlOn"), off: document.getElementById("ssTtsHlOff") };
        var p = T.getPrefs();

        // getVoices() is async in most browsers, so repopulate on every change
        // rather than reading the (initially empty) list once.
        scope.add(T.onVoices(scope.guard(function (list) {
          var cur = T.getPrefs().voiceURI;
          voiceSel.innerHTML = '<option value="">System default</option>' +
            list.map(function (v) {
              return '<option value="' + escapeHtml(v.voiceURI) + '">' +
                escapeHtml(v.name + " (" + v.lang + ")") + "</option>";
            }).join("");
          voiceSel.value = cur || "";
        })));
        scope.listen(voiceSel, "change", function () { T.setVoice(voiceSel.value); });

        rate.min = String(T.RATE_MIN);
        rate.max = String(T.RATE_MAX);
        rate.step = String(T.RATE_STEP);
        rate.value = String(p.rate);
        // Shown in words/min (a nominal pace x the engine multiplier) rather
        // than the bare multiplier, which means nothing to a listener.
        function paintRate(r) {
          var n = T.wpm(r);
          rateOut.textContent = "\u2248 " + n + " words/min";
          rate.setAttribute("aria-valuetext", "about " + n + " words per minute");
        }
        paintRate(p.rate);
        scope.listen(rate, "input", function () { paintRate(rate.value); });
        // Commit on change, not input: setRate re-speaks, and doing that on
        // every slider tick would stutter the reading.
        scope.listen(rate, "change", function () { T.setRate(rate.value); });

        function paintHl(on) {
          if (hl.on) hl.on.setAttribute("aria-checked", on ? "true" : "false");
          if (hl.off) hl.off.setAttribute("aria-checked", on ? "false" : "true");
        }
        paintHl(p.highlight);
        if (hl.on) scope.listen(hl.on, "click", function () { T.setHighlight(true); paintHl(true); });
        if (hl.off) scope.listen(hl.off, "click", function () { T.setHighlight(false); paintHl(false); });
        // Reset on the Reader tab: voice, speed and highlight too.
        if (resetBtn) scope.listen(resetBtn, "click", function () {
          if (resetTab() !== "read") return;
          T.resetPrefs();
          var d = T.getPrefs();
          voiceSel.value = "";
          rate.value = String(d.rate);
          paintRate(d.rate);
          paintHl(d.highlight);
        });
      }
      wireReadAloud();
      scope.listen(window, "oa-tts-ready", wireReadAloud);

      var TOL_LABELS = ["off", "1 (loose)", "2 (loosest)"];

      function reflectOutputs() {
        var w = Number(wWeight.value);
        oWeight.textContent = Math.round(w * 100) + "% / " + Math.round((1 - w) * 100) + "%";
        oMin.textContent = Number(wMin.value).toFixed(2);
        oTol.textContent = TOL_LABELS[Math.round(Number(wTol.value))] || String(wTol.value);
      }

      function populate() {
        if (!window.OASemanticSearch || !window.OASemanticSearch.getSettings) return;
        var s = window.OASemanticSearch.getSettings();
        wWeight.value = s.semanticWeight;
        wMin.value = s.minSemantic;
        wTol.value = s.tolerance;
        reflectOutputs();
      }

      function commit() {
        if (!window.OASemanticSearch || !window.OASemanticSearch.setSettings) return;
        window.OASemanticSearch.setSettings({
          semanticWeight: Number(wWeight.value),
          minSemantic: Number(wMin.value),
          tolerance: Math.round(Number(wTol.value))
        });
        searchController.run();
      }

      function onOutside(e) {
        if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closePanel();
      }
      // What Tab can reach in `root`, in page order.
      function tabbables(root) {
        return Array.prototype.filter.call(root.querySelectorAll("a[href], button, input, select, textarea, [tabindex]"), function (el) {
          return el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0;
        });
      }
      // stopPropagation: the grid's own Escape would otherwise also clear the
      // row selection / collapse every open abstract.
      // Tab past the last control, or Shift+Tab before the first, leaves the
      // panel the way it was entered: it closes, and focus goes on from the
      // Settings button - forward to the control after it, back to the button.
      // (The panel sits by the toolbar, not by its button: left to the browser,
      // Tab walked on into the table under the open panel.)
      function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); closePanel(); btn.focus(); return; }
        if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || !panel.contains(document.activeElement)) return;
        var inside = tabbables(panel);
        if (document.activeElement !== (e.shiftKey ? inside[0] : inside[inside.length - 1])) return;
        e.preventDefault();
        var next = btn;
        if (!e.shiftKey) {
          var all = tabbables(document.body);
          next = all.slice(all.indexOf(btn) + 1).filter(function (el) { return !panel.contains(el); })[0] || btn;
        }
        closePanel();
        next.focus();
      }
      // Panel is position:fixed (top layer) so the grid canvas can't paint over
      // it and no ancestor overflow clips it; place it under the button, its
      // right edge aligned to the button's, clamped into the viewport.
      function positionPanel() {
        var r = btn.getBoundingClientRect();
        var pw = panel.offsetWidth || 290;
        var GAP = 8;
        var top = Math.round(r.bottom + GAP);
        // Cap the height to what is left below the button, so the panel scrolls
        // its own content instead of running off the bottom of a short viewport.
        // Below ~260px of headroom it flips above the button instead, where a
        // toolbar-height page has considerably more room.
        var below = window.innerHeight - top - GAP;
        var above = r.top - 2 * GAP;
        var flip = below < 260 && above > below;
        // Fed to the max-height declaration in articles.css as a custom
        // property - see the note there on why this isn't an inline max-height.
        panel.style.setProperty("--ss-maxh", Math.max(160, Math.round(flip ? above : below)) + "px");
        if (flip) {
          panel.style.top = "auto";
          panel.style.bottom = Math.round(window.innerHeight - r.top + GAP) + "px";
        } else {
          panel.style.bottom = "auto";
          panel.style.top = top + "px";
        }
        panel.style.left = Math.round(Math.min(Math.max(8, r.right - pw), window.innerWidth - pw - 8)) + "px";
      }
      function openPanel() {
        if (window.speechSynthesis && window.OAFeatures) {
          window.OAFeatures.load("tts").then(scope.guard(function () {
            wireReadAloud();
            if (!panel.hidden) positionPanel();
          })).catch(scope.guard(window.OAFeatures.failed));
        }
        populate();
        panel.hidden = false;
        releasePopover = window.OATheme.popover("settings", closePanel);
        positionPanel();
        // Measure again on the next frame: the first call runs against the
        // layout the panel had while hidden, and a scrollbar appearing (or a
        // late-populated section) shifts the button it is measured from.
        if (window.requestAnimationFrame) scope.frame(positionPanel);
        btn.setAttribute("aria-expanded", "true");
        // Focus follows the disclosure into the panel (first control), and
        // returns to the button on close - same convention as the dialogs.
        var firstControl = panel.querySelector("input, select, button, [tabindex]:not([tabindex='-1'])");
        if (firstControl) firstControl.focus({ preventScroll: true });
        scope.listen(document, "mousedown", onOutside, true);
        scope.listen(document, "keydown", onKey, true);
        scope.listen(window, "resize", positionPanel);
      }
      var releasePopover = null;
      function closePanel() {
        if (releasePopover) { releasePopover(); releasePopover = null; }
        var restore = panel.contains(document.activeElement);
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (restore) btn.focus({ preventScroll: true });
        document.removeEventListener("mousedown", onOutside, true);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("resize", positionPanel);
      }

      scope.listen(btn, "click", function () {
        if (panel.hidden) openPanel(); else closePanel();
      });
      var closeX = document.getElementById("ssClose");
      if (closeX) scope.listen(closeX, "click", function () { closePanel(); btn.focus(); });
      // The button lives in the site header, first in its row (the header is
      // this page's chrome; the panel it opens stays in the toolbar DOM, where
      // its .articles-app styles apply, and is position:fixed off the button's
      // rect, so the two need not be siblings). Hidden with the header while
      // the entry screen is up; index.html re-shows the header on entry.
      var toprow = document.querySelector(".oa-root > .oa-top .oa-toprow");
      if (toprow && btn.parentNode) {
        btn.classList.add("oa-settings-btn");
        toprow.insertBefore(btn, toprow.firstChild);
        scope.add(function () { btn.remove(); });
      }
      [wWeight, wMin, wTol].forEach(function (el) {
        scope.listen(el, "input", reflectOutputs);   // live labels while dragging
        scope.listen(el, "change", commit);          // apply on release
      });
      if (resetBtn) scope.listen(resetBtn, "click", function () {
        if (resetTab() !== "search") return;
        if (window.OASemanticSearch && window.OASemanticSearch.resetSettings) {
          window.OASemanticSearch.resetSettings();
        }
        populate();
        searchController.run();
      });
    })();

  }

  window.OAGridSettings = Object.freeze({ attach: attach });
})();
