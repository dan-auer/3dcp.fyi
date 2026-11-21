/* =============================================================================
   oa-theme.js - shared theme utilities for every 3dcp.fyi page.

   One place that knows how the design system is wired to the live DOM:
     • tokens()          - resolve the CSS custom properties on .oa-root into a
                           plain object (palette / accent / font / dark-mode /
                           influence colours) for the D3 charts.
     • onChange(cb)      - run cb whenever the active palette/accent/dark flips,
                           so charts can recolour in place. Replaces the
                           hand-rolled MutationObserver each chart used to carry.
     • syncBackground()  - mirror the active palette's --bg onto <body>/<html>
                           so dark mode is full-bleed. Run once at load (body
                           keeps article.css's light fallback until then) and on
                           every scheme change.

   Load after OAAssets and OABrowserActions, before consumer charts and chrome.
   ========================================================================== */
(function () {
  "use strict";

  // Damp the browser context menu on inert chrome only. Links, images, form
  // fields, editable content and any active text selection keep the NATIVE
  // menu - open-in-new-tab / copy-link / copy are how a research database is
  // actually used - and Ctrl+right-click stays as the everywhere escape hatch.
  document.addEventListener("contextmenu", function (e) {
    if (e.ctrlKey) return;
    var t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, a[href], img")) return;
    if (t && t.isContentEditable) return;
    try { var sel = window.getSelection(); if (sel && !sel.isCollapsed && String(sel)) return; } catch (err) {}
    e.preventDefault();
  });

  var THEME_ATTRS = ["data-palette", "data-accent", "data-dark", "data-theme"];

  function root() {
    return document.querySelector(".oa-root") || document.documentElement;
  }

  function tokens() {
    var cs = getComputedStyle(root());
    var read = function (n, f) { return cs.getPropertyValue(n).trim() || f; };
    return {
      accent:     read("--accent", "#1d4ed8"),
      ink:        read("--ink", "#0a0a0a"),
      ink2:       read("--ink-2", "#525252"),
      muted:      read("--muted", "#6e6e6e"),
      line:       read("--line", "#e7e7e7"),
      mono:       read("--mono", "ui-monospace, monospace")
    };
  }

  // Run `cb` whenever palette / accent / dark / theme changes on .oa-root.
  // Returns the MutationObserver (disconnect() stops it), or null without a root.
  function onChange(cb) {
    var el = document.querySelector(".oa-root");
    if (!el) return null;
    var obs = new MutationObserver(cb);
    obs.observe(el, { attributes: true, attributeFilter: THEME_ATTRS });
    return obs;
  }

  // Theme swaps repaint every CSS variable at once; elements with their own
  // `transition` (keyword chips, buttons) would each lerp through in-between
  // colours - a visible flash. Watching the same attrs, add .oa-noanim for the
  // swap frame (the observer fires before paint) and drop it two frames later,
  // so hover transitions come back untouched. Self-installs once per page.
  (function suppressThemeSwapTransitions() {
    var timer = null;
    function arm() {
      var el = document.querySelector(".oa-root");
      if (!el) return;
      var obs = new MutationObserver(function () {
        el.classList.add("oa-noanim");
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { el.classList.remove("oa-noanim"); }, 120);
      });
      obs.observe(el, { attributes: true, attributeFilter: THEME_ATTRS });
      if (!document.getElementById("oa-noanim-style")) {
        var st = document.createElement("style");
        st.id = "oa-noanim-style";
        st.textContent = ".oa-root.oa-noanim,.oa-root.oa-noanim *,.oa-root.oa-noanim *::before,.oa-root.oa-noanim *::after{transition:none !important}";
        document.head.appendChild(st);
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
    else arm();
  })();

  // Keep the page background in sync with the active palette (full-bleed dark).
  // Also mirrors the colour onto <meta name="theme-color"> so mobile browser
  // chrome (the URL bar / status area) matches the page instead of flashing
  // white in dark mode.
  function syncBackground(el) {
    el = el || document.querySelector(".oa-root");
    if (!el) return;
    try {
      var bg = getComputedStyle(el).getPropertyValue("--bg").trim();
      if (bg) {
        document.body.style.background = bg;
        document.documentElement.style.background = bg;
        // Native UI (scrollbars, form controls, select popups) follows the scheme.
        document.documentElement.style.colorScheme = getScheme();
        setThemeColor(bg);
      }
    } catch (e) {}
  }

  // Create-or-update the single <meta name="theme-color"> element.
  function setThemeColor(color) {
    if (!color) return;
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute("content", color);
  }

  /* -------------------------------------------------------------------------
     Day / night scheme. ONE piece of state: html[data-scheme] = dark | light,
     resolved before first paint in oa-boot.js and persisted in localStorage.
     Every scheme-dependent CSS rule keys off that attribute, so flipping it
     repaints the whole site in one frame - no per-element class work.

     data-dark on each .oa-root is kept as a MIRROR: it is what the D3 charts
     watch (onChange below) to recolour themselves, and writing it is what makes
     a toggle recolour the charts without a reload.
  ---------------------------------------------------------------------------- */
  var SCHEME_KEY = window.OA_SCHEME_KEY, SCHEME_BG = window.OA_SCHEME_BG;   // both set by oa-boot.js

  function getScheme() {
    return document.documentElement.getAttribute("data-scheme") === "light" ? "light" : "dark";
  }

  // Three themes on that one switch: html[data-theme] = dark | light | mint.
  // Mint is a night theme re-tinted green, so it keeps data-scheme="dark" and
  // every night rule; only the tokens keyed on [data-theme="mint"] differ.
  // The header button steps through them in THEMES order.
  var THEMES = ["dark", "light", "mint"];
  function getTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (THEMES.indexOf(t) >= 0) return t;
    return getScheme() === "light" ? "light" : "mint";
  }
  function nextTheme(theme) {
    return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  }

  function setScheme(theme) {
    if (THEMES.indexOf(theme) < 0) theme = "mint";
    var scheme = theme === "light" ? "light" : "dark";
    var de = document.documentElement;
    de.setAttribute("data-scheme", scheme);
    de.setAttribute("data-theme", theme);
    de.style.colorScheme = scheme;
    de.style.background = SCHEME_BG[theme];
    window.OA_SCHEME = scheme;
    window.OA_THEME = theme;
    window.OAPrefs.set(SCHEME_KEY, theme);
    // Mirror onto every root (charts watch it), then let the palette repaint the
    // page background from its own --bg. data-theme is mirrored too: dark <->
    // mint leaves data-dark as it was, and the charts must still recolour.
    var roots = document.querySelectorAll(".oa-root");
    for (var i = 0; i < roots.length; i++) {
      roots[i].dataset.dark = scheme === "light" ? "false" : "true";
      roots[i].dataset.theme = theme;
    }
    syncBackground();
    syncThemeControls(theme);
    return theme;
  }

  function toggleScheme() {
    return setScheme(nextTheme(getTheme()));
  }

  // A scheme flip has to reach every OTHER document of this origin that is on
  // screen at the same time: the in-page popup panels (the publisher PDF
  // window is an iframe), and pages torn off into real windows. The `storage`
  // event is exactly that channel - it fires in every same-origin document
  // except the one that wrote - so no host/child wiring is needed and it works
  // in both directions (a toggle inside a popup repaints the table behind it).
  // getTheme() already matching is the loop guard: re-applying writes the same
  // value, which fires nothing further.
  window.addEventListener("storage", function (e) {
    if (!e || e.key !== SCHEME_KEY) return;
    var next = THEMES.indexOf(e.newValue) >= 0 ? e.newValue : "mint";
    if (next === getTheme()) return;
    setScheme(next);
  });

  // The label names the destination, not the current state: while dark, the
  // button offers sunrise ("switch to light"), while light the leaf (mint),
  // while mint sunset (dark). Three states, so no aria-pressed: the label says it.
  function schemeLabel(theme) {
    return "Switch to " + nextTheme(theme) + " mode";
  }
  function applySchemeButton(btn, theme) {
    var label = schemeLabel(theme || getTheme());
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
    btn.removeAttribute("aria-pressed");
  }
  // The header button(s) and the Theme radios in Settings > Appearance.
  function syncThemeControls(theme) {
    theme = theme || getTheme();
    var btns = document.querySelectorAll("[data-oa-scheme-toggle]");
    for (var b = 0; b < btns.length; b++) applySchemeButton(btns[b], theme);
    var picks = document.querySelectorAll("[data-oa-theme]");
    for (var p = 0; p < picks.length; p++) {
      picks[p].setAttribute("aria-checked", picks[p].getAttribute("data-oa-theme") === theme ? "true" : "false");
    }
  }

  var IC_SUNRISE =
    '<path d="M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0" />' +
    '<path d="M3 21l18 0" /><path d="M12 9v-6l3 3m-6 0l3 -3" />';
  var IC_SUNSET =
    '<path d="M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0" />' +
    '<path d="M3 21l18 0" /><path d="M12 3v6l3 -3m-6 0l3 3" />';
  // Tabler "leaf": the way to the mint theme.
  var IC_LEAF =
    '<path d="M5 21c.5 -4.5 2.5 -8 7 -10" />' +
    '<path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0" />';

  function schemeButtonHtml() {
    var svg = function (cls, paths) {
      return '<svg class="' + cls + '" viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true">' + paths + "</svg>";
    };
    var label = schemeLabel(getTheme());
    return '<button class="oa-scheme-btn" type="button" data-oa-scheme-toggle ' +
      'title="' + label + '" aria-label="' + label + '">' +
      svg("oa-scheme-sunrise", IC_SUNRISE) + svg("oa-scheme-leaf", IC_LEAF) + svg("oa-scheme-sunset", IC_SUNSET) +
      "</button>";
  }

  // Delegated, so it works for chrome injected after load without any
  // per-page wiring.
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    var btn = e.target.closest("[data-oa-scheme-toggle]");
    if (btn) { e.preventDefault(); toggleScheme(); return; }
    var pick = e.target.closest("[data-oa-theme]");
    if (!pick) return;
    e.preventDefault();
    if (pick.getAttribute("data-oa-theme") !== getTheme()) setScheme(pick.getAttribute("data-oa-theme"));
  });
  // Sync the button labels and the Theme radios once the chrome exists.
  function initSchemeButtons() {
    syncThemeControls();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSchemeButtons);
  } else {
    initSchemeButtons();
  }

  // ---------------------------------------------------------------------------
  // Inline-math renderer. The whole site only ever uses a tiny TeX subset for
  // chart/label notation - a letter with sub/super-scripts, an overbar, the odd
  // Greek symbol or operator (\cdot, \in, \max, \mathcal{…}). That does NOT need
  // a 2 MB math engine, so we render it to plain HTML (<sub>/<sup>/overline span)
  // in a few lines. Upright sans to match the UI (the old path forced \mathsf).
  //
  //   mathHtml(s) - convert an HTML string, transforming each \( … \) / $ … $
  //                 span in place and leaving the surrounding markup (<br>,
  //                 <span style>, …) untouched. This is the single entry point.
  // ---------------------------------------------------------------------------
  var MATH_SYMBOLS = {
    // lower-case Greek
    alpha: "\u03b1", beta: "\u03b2", gamma: "\u03b3", delta: "\u03b4",
    epsilon: "\u03b5", varepsilon: "\u03b5", zeta: "\u03b6", eta: "\u03b7",
    theta: "\u03b8", vartheta: "\u03d1", iota: "\u03b9", kappa: "\u03ba",
    lambda: "\u03bb", mu: "\u03bc", nu: "\u03bd", xi: "\u03be",
    pi: "\u03c0", rho: "\u03c1", sigma: "\u03c3", tau: "\u03c4",
    upsilon: "\u03c5", phi: "\u03c6", varphi: "\u03c6", chi: "\u03c7",
    psi: "\u03c8", omega: "\u03c9",
    // upper-case Greek
    Gamma: "\u0393", Delta: "\u0394", Theta: "\u0398", Lambda: "\u039b",
    Xi: "\u039e", Pi: "\u03a0", Sigma: "\u03a3", Phi: "\u03a6",
    Psi: "\u03a8", Omega: "\u03a9",
    // relations / operators / misc
    cdot: "\u00b7", times: "\u00d7", div: "\u00f7", pm: "\u00b1", mp: "\u2213",
    in: "\u2208", notin: "\u2209", leq: "\u2264", le: "\u2264",
    geq: "\u2265", ge: "\u2265", neq: "\u2260", ne: "\u2260",
    approx: "\u2248", equiv: "\u2261", sim: "\u223c", propto: "\u221d",
    infty: "\u221e", partial: "\u2202", nabla: "\u2207", sum: "\u2211",
    prod: "\u220f", int: "\u222b", cup: "\u222a", cap: "\u2229",
    subset: "\u2282", supset: "\u2283", rightarrow: "\u2192", to: "\u2192",
    leftarrow: "\u2190", cdots: "\u22ef", ldots: "\u2026", dots: "\u2026",
    circ: "\u2218", bullet: "\u2022", prime: "\u2032", ast: "\u2217"
  };
  // Upright-roman named operators (rendered as their literal name).
  var MATH_OPS = { max: 1, min: 1, log: 1, ln: 1, exp: 1, sin: 1, cos: 1,
    tan: 1, lim: 1, sup: 1, inf: 1, det: 1, gcd: 1, arg: 1, deg: 1 };
  // Commands with no glyph that we simply drop (spacing commands → thin space).
  var MATH_IGNORE = { left: 1, right: 1, displaystyle: 1, textstyle: 1,
    limits: 1, nolimits: 1, "!": 1, ",": 1, ";": 1, ":": 1, " ": 1 };
  // \mathcal{…} script capitals (fallback to the bare letter).
  var MATH_CAL = { A: "\ud835\udc9c", B: "\u212c", C: "\ud835\udc9e",
    D: "\ud835\udc9f", E: "\u2130", F: "\u2131", G: "\ud835\udca2",
    H: "\u210b", I: "\u2110", J: "\ud835\udca5", K: "\ud835\udca6",
    L: "\u2112", M: "\u2133", N: "\ud835\udca9", O: "\ud835\udcaa",
    P: "\ud835\udcab", Q: "\ud835\udcac", R: "\u211b", S: "\ud835\udcae",
    T: "\ud835\udcaf", U: "\ud835\udcb0", V: "\ud835\udcb1", W: "\ud835\udcb2",
    X: "\ud835\udcb3", Y: "\ud835\udcb4", Z: "\ud835\udcb5" };

  function escMathChar(c) {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "'") return "\u2032";        // a bare prime → ′
    return c;
  }

  // Convert one TeX-subset expression (no \( … \) delimiters) into HTML.
  function texToHtml(src) {
    src = String(src == null ? "" : src);
    var i = 0;
    function parseGroup() {           // src[i] === "{"
      i++;
      var out = parseSeq("}");
      if (src[i] === "}") i++;
      return out;
    }
    function takeArg() {              // a {group} or a single following atom
      while (src[i] === " ") i++;
      return src[i] === "{" ? parseGroup() : parseAtom();
    }
    function renderCommand() {
      i++;                            // skip backslash
      var cmd = "";
      if (/[a-zA-Z]/.test(src[i])) {
        while (i < src.length && /[a-zA-Z]/.test(src[i])) cmd += src[i++];
      } else {
        cmd = src[i++] || "";
      }
      if (cmd === "bar" || cmd === "overline")
        return '<span class="oa-math-ovl">' + takeArg() + "</span>";
      if (cmd === "hat") return '<span class="oa-math-hat">' + takeArg() + "</span>";
      if (cmd === "sqrt") return "\u221a<span class=\"oa-math-ovl\">" + takeArg() + "</span>";
      if (cmd === "mathcal") {
        var g = takeArg();
        return MATH_CAL[g] || g;
      }
      if (cmd === "mathsf" || cmd === "mathrm" || cmd === "text" ||
          cmd === "operatorname" || cmd === "mathbb") return takeArg();
      if (cmd === "mathbf") return "<b>" + takeArg() + "</b>";
      if (MATH_IGNORE[cmd]) return (cmd === "," || cmd === ";" || cmd === ":" || cmd === " ") ? "\u2009" : "";
      if (MATH_OPS[cmd]) return cmd;
      if (MATH_SYMBOLS[cmd] != null) return MATH_SYMBOLS[cmd];
      return escapeHtml(cmd);         // unknown → show the name
    }
    function parseAtom() {
      var c = src[i];
      if (c === "{") return parseGroup();
      if (c === "\\") return renderCommand();
      i++;
      return escMathChar(c);
    }
    function parseSeq(stop) {
      var html = "";
      while (i < src.length && src[i] !== stop) {
        var c = src[i];
        if (c === "^" || c === "_") {
          i++;
          var tag = c === "^" ? "sup" : "sub";
          html += "<" + tag + ">" + takeArg() + "</" + tag + ">";
        } else if (c === " ") {
          i++;
          if (html && html.slice(-1) !== "\u2009") html += "\u2009";
        } else {
          html += parseAtom();
        }
      }
      return html;
    }
    return parseSeq(null);
  }

  function mathHtml(html) {
    return String(html == null ? "" : html).replace(
      /\\\(([\s\S]*?)\\\)|\$([^$]*)\$/g,
      function (_, a, b) { return texToHtml(a != null ? a : b); }
    );
  }
  // Escape the five HTML-significant characters. Single source of truth for
  // every consumer (the SlickGrid formatters, cite-format.js, the search
  // modules). Runtime-only callers, so OATheme is always loaded by call time.
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Typographic ordinals: wrap the suffix of "1st", "22nd", "133rd", "nth"
  // in <sup class="ord-sup"> for proper superscript rendering (conference
  // venue names, mostly). Takes ALREADY-ESCAPED text (entities only, no tags)
  // and returns HTML - so call it on escapeHtml output, never on raw text and
  // never inside attribute values.
  var ORDINAL_RE = /\b(\d+|[Nn])(st|nd|rd|th)\b/g;
  function ordinalHtml(escaped) {
    return String(escaped == null ? "" : escaped).replace(ORDINAL_RE, function (m, num, suf) {
      // A bare "n" only counts for "nth"/"Nth" - never "1nd"-style mispairs
      // for letters; digits take whichever suffix the source wrote.
      if ((num === "n" || num === "N") && suf !== "th") return m;
      return num + '<sup class="ord-sup">' + suf + "</sup>";
    });
  }

  // ---------------------------------------------------------------------------
  // Category colour -> dark-ground colour. src/category_data.js encodes taxonomy
  // DEPTH as lightness: top-level categories are saturated (#D32F2F), leaves are
  // near-white (#FEF7EB at 96% lightness). That reads on paper but not on a black
  // UI - mixing a near-white into near-black gives flat grey, so every deep
  // category came out the same colourless smudge.
  //
  // The hue and saturation are perfectly good (HSL saturation is scale-invariant,
  // so even #FEF7EB carries ~90% sat at hue 33). Only the lightness is wrong for a
  // dark ground. So keep H and S and remap L from the source range [27,96] into
  // [80,32] - INVERTED, so a lighter (deeper) source becomes darker while every
  // tier stays fully saturated. Depth still reads, as brightness.
  //
  // The mapping is SQUARED rather than linear because the source tiers bunch up at
  // the pale end: two siblings in one branch can sit at 96% and 88% lightness, and
  // a linear map compressed that 8-point gap to 3 - a pair of near-identical
  // chips. Squaring spreads the crowded pale end (that same pair lands ~11 points
  // apart) while leaving the saturated top level bright.
  // ---------------------------------------------------------------------------
  var CAT_L_SRC_MIN = 27, CAT_L_SRC_MAX = 96;   // observed range in category_data
  // Output band, chosen to hold on BOTH grounds now that the site has a light
  // scheme again: the top end stops at 68% (not 80%) so a chip dot still reads
  // against light concrete, and the bottom stays at 32% so it still reads
  // against dark concrete. One band means the cached chip markup in the grid
  // stays valid across a scheme flip.
  var CAT_L_OUT_MAX = 68, CAT_L_OUT_MIN = 32;
  function catColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return String(hex || "");           // not a plain hex - pass through
    var n = parseInt(m[1], 16);
    var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    var lp = l * 100;
    var span = CAT_L_SRC_MAX - CAT_L_SRC_MIN;
    var pos = Math.min(1, Math.max(0, (lp - CAT_L_SRC_MIN) / span));
    pos = pos * pos;                            // spread the crowded pale end
    var out = CAT_L_OUT_MAX - pos * (CAT_L_OUT_MAX - CAT_L_OUT_MIN);
    // Floor the saturation so a desaturated grey source still shows as a colour.
    var sp = Math.max(55, Math.round(s * 100));
    return "hsl(" + Math.round(h) + " " + sp + "% " + Math.round(out) + "%)";
  }
  // Ink that reads on a chip filled with catColor(hex): white on dark/saturated
  // hues (deep reds, blues), near-black on light ones. Decided from the WCAG
  // relative luminance of the remapped colour, not the source.
  function catInk(hex) {
    var m = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(catColor(hex));
    if (!m) return "#111";
    var h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function ch(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var Y = 0.2126 * lin(ch(h + 1 / 3)) + 0.7152 * lin(ch(h)) + 0.0722 * lin(ch(h - 1 / 3));
    return Y > 0.30 ? "#111" : "#fff";
  }
  // Inline style carrying both custom properties for a category chip.
  function catVars(hex) { return "--cat-c:" + catColor(hex) + ";--cat-ink:" + catInk(hex); }

  // Local-time stamp (YYYY-MM-DD_HH-MM) for export filenames, so repeated
  // downloads don't overwrite each other and sort chronologically in a folder.
  // Used by the filtered-results .bib exporter (articles-grid.js).
  function fileTimestamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "_" + p(d.getHours()) + "-" + p(d.getMinutes());
  }
  // Filename-safe form of the rule builder query: every character a
  // filesystem rejects (\ / : * ? " < > |, controls) and every whitespace run
  // becomes one "-"; quotes drop so AUTHOR IS "Bos" reads AUTHOR-IS-Bos.
  // Capped so a long rule chain can't blow past name limits.
  function fileSafe(text, max) {
    var s = String(text == null ? "" : text);
    s = s.replace(/[\\/:*?"<>|\u0000-\u001f\s-]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, max || 120).replace(/-+$/g, "");
  }

  // ---------------------------------------------------------------------------
  // Shared "copied" confirmation toast. One bottom-centre pill, self-styled on
  // first use so it works on every page type (article / author / keyword) no
  // matter which stylesheet is loaded. Every copy affordance - citation, page
  // URL, DOI - plus the favorites notices funnel through here so the
  // confirmation is identical everywhere. `ms` overrides the 1.6s auto-hide.
  var _copyToastEl = null, _copyToastT = null, _copyToastStyled = false;
  function copyToast(message, ok, ms) {
    if (ok === undefined) ok = true;
    if (!_copyToastStyled) {
      var st = document.createElement("style");
      st.textContent =
        ".oa-copy-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,8px);z-index:var(--layer-toast,320);" +
        "max-width:min(92vw,420px);white-space:pre-line;text-align:center;" +
        "padding:9px 14px;font-family:var(--sans);font-size:var(--fs-meta);font-weight:400;" +
        "color:var(--ink);background:var(--paper);border:1px solid var(--line-strong);border-radius:var(--radius-control);box-shadow:var(--shadow-float);" +
        "opacity:0;pointer-events:none;transition:opacity .12s ease,transform .12s ease;}" +
        ".oa-copy-toast.is-shown{opacity:1;transform:translate(-50%,0);}" +
        ".oa-copy-toast.is-error{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 55%,var(--line-strong));}";
      document.head.appendChild(st);
      _copyToastStyled = true;
    }
    if (!_copyToastEl) {
      _copyToastEl = document.createElement("div");
      _copyToastEl.className = "oa-copy-toast";
      _copyToastEl.setAttribute("role", "status");
      _copyToastEl.setAttribute("aria-live", "polite");
    }
    // Inside the open modal <dialog> if any (the top layer paints over every
    // z-index), else .oa-root: the palette variables (--paper / --ink /
    // --line-strong, per scheme) live there, so a body-level mount rendered the
    // light fallbacks in dark mode.
    var host = Array.prototype.slice.call(document.querySelectorAll("dialog:modal")).pop() ||
      document.querySelector(".oa-root") || document.body;
    if (_copyToastEl.parentNode !== host) host.appendChild(_copyToastEl);
    _copyToastEl.textContent = (ok ? "\u2713 " : "") + message;
    _copyToastEl.classList.toggle("is-error", !ok);
    _copyToastEl.classList.add("is-shown");
    clearTimeout(_copyToastT);
    _copyToastT = setTimeout(function () { _copyToastEl.classList.remove("is-shown"); }, ms || 1600);
  }

  // Generic copy buttons: any element with [data-copy] copies its value, with an
  // optional per-button noun (data-copy-label="BibTeX" -> "BibTeX copied") and the
  // shared copyToast confirmation, so every copy affordance behaves identically.
  //
  // Lives here, not with the grid, because the citation card also appears on
  // pages that have no grid at all (the Articles entry screen). ONE
  // delegated document listener, not a per-node bind at init: the BibTeX button's
  // data-copy is filled in by landing.js AFTER load, and grids rebuild their
  // markup, so binding at init would miss buttons or double-bind them.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy]");
    if (!btn) return;
    var label = btn.getAttribute("data-copy-label");
    var okMsg = label ? label + " copied" : "Copied";
    var text = btn.getAttribute("data-copy") || "";
    // The citation card's payload is filled in by landing.js, which loads after
    // the optional chart modules. Until then - or if those never load - read the
    // text straight off the adjacent code block rather than "copying" an empty
    // string and reporting success.
    if (!text) {
      var wrap = btn.closest(".oa-code-wrap");
      var pre = wrap && wrap.querySelector("pre, [data-l=\"bibtex\"]");
      text = pre ? pre.textContent : "";
    }
    if (!text.trim()) { copyToast("Nothing to copy yet", false); return; }
    window.OABrowserActions.copyText(text).then(function (ok) {
      copyToast(ok === false ? "Copy failed" : okMsg, ok !== false);
    });
  });

  // ---------------------------------------------------------------------------
  // SlickGrid sortable-column header affordance (neutral up/down chevrons),
  // built by articles-grid.js so the markup never drifts.
  // CSS layers the active-sort indicator on top of this neutral icon.
  // ---------------------------------------------------------------------------
  var SORT_ICON_SVG =
    '<svg class="col-sort-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path class="col-sort-up" d="M3 9l4 -4l4 4m-4 -4v14" />' +
    '<path class="col-sort-down" d="M21 15l-4 4l-4 -4m4 4v-14" />' +
    "</svg>";
  function sortIconHtml(label) {
    return '<span class="col-head">' + label + SORT_ICON_SVG + "</span>";
  }

  // ---------------------------------------------------------------------------
  // Read the recipient + subject off a mailto: button (the no-JS fallback) so
  // the modal dialogs (add-paper.js, report-error.js) don't re-declare them and
  // can't drift from the markup. `selector` is the button's base CSS selector;
  // `defaults` supplies the email/subject used if the button or its href is gone.
  // ---------------------------------------------------------------------------
  function mailtoFromButton(selector, defaults) {
    var c = { email: (defaults && defaults.email) || "", subject: (defaults && defaults.subject) || "" };
    var btn = document.querySelector(selector + "[href^='mailto:'], " + selector + "[href^='MAILTO:']");
    var m = btn && /^mailto:([^?]*)(?:\?(.*))?$/i.exec(btn.getAttribute("href") || "");
    if (m) {
      if (m[1]) { try { c.email = decodeURIComponent(m[1].trim()); } catch (e) { c.email = m[1].trim(); } }
      var sm = m[2] && /(?:^|&)subject=([^&]*)/i.exec(m[2]);
      if (sm) { try { c.subject = decodeURIComponent(sm[1].replace(/\+/g, " ")); } catch (e2) {} }
    }
    return c;
  }

  // ---------------------------------------------------------------------------
  // YYYY-MM typed-input mask, shared by the Articles-page rule builder and the
  // "Suggest a paper" wizard (previously two drifting copies). Formats digits
  // into YYYY-MM as you type: inserts the "-", pads a single-digit month
  // (2-9 -> 0X), keeps a lone "1" open so 10/11/12 still complete, drops an
  // out-of-range month, and leaves backspacing untouched. Optional onValue(out)
  // fires after each edit with the masked value; callers gate on completeness.
  // ---------------------------------------------------------------------------
  function monthMask(el, onValue) {
    var tensPending = false;
    el.addEventListener("input", function (e) {
      var raw = el.value;
      var deleting = !!(e && /^delete/.test(e.inputType || ""));
      var allD = raw.replace(/\D/g, "");
      var year = allD.slice(0, 4);
      var md = allD.slice(4);
      var month = "";
      if (year.length === 4) {
        if (deleting) {
          // On backspace/delete don't re-pad or expand - keep what's left.
          md = md.slice(0, 2);
          if (md.length === 2 && !(+md >= 1 && +md <= 12)) md = md.slice(0, 1);
          month = md;
          tensPending = false;
        } else if (tensPending && md.length === 3 && md.slice(0, 2) === "01") {
          // "1" was auto-padded to "01"; the next digit may extend to 10-12.
          var cand = "1" + md[2];
          month = (cand === "10" || cand === "11" || cand === "12") ? cand : "01";
          tensPending = false;
        } else {
          md = md.slice(0, 2);
          if (md.length === 1) {
            if (+md >= 2) { month = "0" + md; tensPending = false; }       // 2-9 -> 0X
            else if (md === "1") { month = "01"; tensPending = true; }     // 1 -> 01 (may become 10-12)
            else { month = "0"; tensPending = false; }                     // 0 -> await 01-09
          } else if (md.length === 2) {
            var mm = +md;
            month = (mm >= 1 && mm <= 12) ? md : "";                       // drop out-of-range
            tensPending = false;
          } else {
            tensPending = false;
          }
        }
      } else {
        tensPending = false;
      }
      var out = year;
      if (year.length === 4 && (month.length > 0 || /^\d{4}\D/.test(raw))) {
        out += "-" + month;
      }
      el.value = out;
      if (onValue) onValue(out);
    });
  }

  // ---------------------------------------------------------------------------
  // Shared SVG icons. The ORCID glyph and the open/closed access lock paths were
  // copied verbatim across the SlickGrid formatters; kept here so every surface draws the identical glyph. Callers
  // own the lock's wrapper (size / class); oaIconPaths() returns just the inner
  // <path>s for whichever wrapper they need.
  // ---------------------------------------------------------------------------
  // ORCID: a fingerprint (Tabler "fingerprint"), drawn in currentColor so the
  // button around it (articles.css .author-orcid) sets its colour.
  var ORCID_SVG =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3"/>' +
      '<path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6"/>' +
      '<path d="M12 11v2a14 14 0 0 0 2.5 8"/>' +
      '<path d="M8 15a18 18 0 0 0 1.8 6"/>' +
      '<path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95"/>' +
    "</svg>";
  // Affiliation / ROR: a building (Tabler "building-bank"), same drawing rules.
  var AFF_SVG =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M3 21l18 0"/><path d="M3 10l18 0"/><path d="M5 6l7 -3l7 3"/><path d="M4 10l0 11"/>' +
      '<path d="M20 10l0 11"/><path d="M8 14l0 3"/><path d="M12 14l0 3"/><path d="M16 14l0 3"/>' +
    "</svg>";
  var OA_OPEN_PATHS =
    '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/>' +
    '<path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>' +
    '<path d="M8 11v-5a4 4 0 0 1 8 0"/>';
  var OA_CLOSED_PATHS =
    '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/>' +
    '<path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/>' +
    '<path d="M8 11v-4a4 4 0 1 1 8 0v4"/>';
  function oaIconPaths(open) { return open ? OA_OPEN_PATHS : OA_CLOSED_PATHS; }

  // Download / "save to disk" glyph (down arrow into a tray). Was copied verbatim
  // into the favorites menu and the articles-grid Export button; kept here so every
  // download affordance draws the identical glyph. Callers own the wrapper
  // (size / class); DOWNLOAD_PATHS is just the inner <path>s, like oaIconPaths.
  var DOWNLOAD_PATHS =
    '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/>' +
    '<path d="M7 11l5 5l5 -5"/>' +
    '<path d="M12 4l0 12"/>';
  // Semantic-model glyph (Tabler "focus + plus"): the toolbar's download button
  // and the consent dialog's header draw the same paths at their own sizes.
  var MODEL_ICON_PATHS =
    '<path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path>' +
    '<path d="M12 16v-7"></path><path d="M9 9h6"></path>';

  /* ---------------------------------------------------------------------------
     Shared top-bar toolbar - ONE source for the header button row. The static
     landing / article-list / legal pages ship an empty `.oa-toprow[data-oa-toprow]` auto-filled
     from it below, so the toolbar can no longer drift per page. `rel` = path to
     site root; `section` ("article"|"keyword"|"") marks the current nav item.
  --------------------------------------------------------------------------- */
  var OA_ADD_MAILTO = "mailto:message@3dcp.fyi?subject=%5B3dcp.fyi%5D%20Paper%20contribution" +
    "&body=Hi%20Daniel%2C%0A%0AI%27d%20like%20to%20suggest%20a%20paper%20for%20the%203dcp.fyi%20database.%0A%0A" +
    "%E2%80%94%20Title%3A%20%0A%E2%80%94%20Authors%3A%20%0A%E2%80%94%20Year%2FMonth%3A%20%0A" +
    "%E2%80%94%20Journal%20%2F%20Conference%3A%20%0A%E2%80%94%20DOI%3A%20%0A" +
    "%E2%80%94%20Keywords%20%28optional%29%3A%20%0A%E2%80%94%20Notes%20%28optional%29%3A%20%0A%0AThanks%21%0A";
  // No header "report an error" button any more: reports are per record, from
  // the button in each row's abstract drop (ext-records.js), which names the
  // paper it is about. report-error.js supplies the recipient itself.
  function navToolbar(rel, section) {
    return "" +
          schemeButtonHtml() +
          '<a class="oa-add-btn" title="Suggest a paper for the database" aria-label="Suggest a paper for the database" href="' + OA_ADD_MAILTO + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"></path><path d="M9 12h6"></path><path d="M12 9v6"></path></svg><span class="tb-label" aria-hidden="true">Suggest a paper</span></a>' +
          // The legal notice is linked from the landing page's foot (index.html).
          // No favorites affordance here: the articles toolbar owns the saved
          // list (star, Export .bib, Copy share link, Remove all), so a header
          // star + dropdown was a second place for the same four actions.
      "";
  }

  function fmtNum(n) {
    return Number(n).toLocaleString("en-US").replace(/,/g, "\u202F");
  }
  /* ---------- Soft-hyphen fallback for justified text ---------- */
  // Justified copy (the article abstract, the grid abstract drops) relies on
  // `hyphens: auto`, but some browser installs - notably Chrome on Windows
  // without its hyphenation-dictionary component - silently never hyphenate,
  // leaving rivers of white space. Probe once for real hyphenation; only where
  // it is missing, lazy-load the vendored Hypher engine and insert soft hyphens
  // (U+00AD) into the element's text nodes. Purely progressive: any failure
  // leaves the text unhyphenated.
  var hyphenNative = null;      // null = not probed yet
  var hyphenEngine = null;      // Promise<Hypher|null>
  var hyphenReady = null;       // the resolved Hypher instance, once loaded

  function nativeHyphenationWorks() {
    if (hyphenNative !== null) return hyphenNative;
    // A long word in a narrow box wraps onto more lines only when the browser
    // can actually hyphenate.
    var mk = function (hy) {
      var d = document.createElement("div");
      d.lang = "en";
      d.style.cssText = "position:absolute;visibility:hidden;width:60px;font:16px serif;hyphens:" + hy;
      d.textContent = "extraordinary representation";
      document.body.appendChild(d);
      return d;
    };
    var a = mk("none"), b = mk("auto");
    hyphenNative = b.getBoundingClientRect().height > a.getBoundingClientRect().height;
    a.remove(); b.remove();
    return hyphenNative;
  }

  function hypher() {
    if (hyphenEngine) return hyphenEngine;
    var root = window.OAAssets.url("src/vendor/hypher/");
    hyphenEngine = window.OAAssets.loadScripts([root + "hypher.js", root + "en-us.js"]).then(function () {
      if (!window.Hypher || !window.HYPHENATION_EN_US) return null;
      var pat = window.HYPHENATION_EN_US;
      pat.leftmin = 3; pat.rightmin = 3;   // match CSS hyphenate-limit-chars: 6 3 3
      hyphenReady = new window.Hypher(pat);
      return hyphenReady;
    }).catch(function () { return null; });
    return hyphenEngine;
  }
  // Start loading the engine ahead of the first use. The first abstract used to
  // paint unhyphenated, then re-wrap when the script landed - a visible flash.
  function warmHyphenation() {
    if (!nativeHyphenationWorks()) hypher();
  }

  function applyHyphens(root, h) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      if (!/[A-Za-z]{6}/.test(tn.nodeValue)) return;   // nothing hyphenatable
      tn.nodeValue = h.hyphenateText(tn.nodeValue, 6);
    });
  }

  // Insert soft hyphens into `root`'s text nodes when the browser can't
  // hyphenate on its own. Idempotent per element (marked with a data flag).
  // Synchronous once the engine is resident, so a measurement probe and the
  // live cell wrap identically; only the very first call may resolve later.
  function softHyphenate(root) {
    if (!root || root.dataset.oaHyphenated === "1") return;
    if (nativeHyphenationWorks()) return;
    root.dataset.oaHyphenated = "1";
    if (hyphenReady) { applyHyphens(root, hyphenReady); return; }
    hypher().then(function (h) { if (h) applyHyphens(root, h); });
  }

  /* ---- One transient surface at a time ---------------------------------
     Popovers (settings panel, facet menu, favorites menu, the "more" popover)
     each own their open/close logic, and used to stack: settings over the
     search suggestions over a toast. OATheme.popover(name, close) registers a
     surface as it opens and closes whatever else is open; the surface calls
     the returned release() when it closes on its own. The rule builder is a
     docked panel, not a popover - it stays. */
  var _popoverOpen = null;
  function popover(name, close) {
    if (_popoverOpen && _popoverOpen.name !== name) {
      var prev = _popoverOpen;
      _popoverOpen = null;
      try { prev.close(); } catch (e) { /* a surface that is already gone */ }
    }
    var entry = { name: name, close: close };
    _popoverOpen = entry;
    return function release() { if (_popoverOpen === entry) _popoverOpen = null; };
  }
  function closePopovers() {
    if (!_popoverOpen) return;
    var prev = _popoverOpen;
    _popoverOpen = null;
    try { prev.close(); } catch (e) { /* ignore */ }
  }

  /* ---- Shared icon geometry -----------------------------------------------
     One definition per glyph, for every consumer that draws it: the articles
     toolbar's group-by buttons and the facet menu's parameter icons used to
     carry their own copies of the same Tabler paths, which is exactly the kind
     of duplication that drifts. Paths only - each caller keeps its own <svg>
     wrapper, size and stroke. */
  var ICON_PATHS = {
    author:
      '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />' +
      '<path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />',
    keyword:
      '<path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
      '<path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" />',
    category:
      '<path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" />' +
      '<path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" />',
    venue:
      '<path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11" />' +
      '<path d="M8 8l4 0" /><path d="M8 12l4 0" /><path d="M8 16l4 0" />',
    date:
      '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" />' +
      '<path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" />' +
      '<path d="M11 15h1" /><path d="M12 15v3" />',
    title:
      '<path d="M14 3v4a1 1 0 0 0 1 1h4" />' +
      '<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />' +
      '<path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" />',
    check: '<path d="M5 12l5 5l10 -10" />'
  };

  // Charts start at the field's first work rather than the data's (Settings):
  // html[data-graph-start], set by the settings menu, else the saved choice.
  function graphStartsAtField() {
    return (document.documentElement.getAttribute("data-graph-start") || window.OAPrefs.get("oa-graph-start")) === "field";
  }
  window.OATheme = { popover: popover, closePopovers: closePopovers, graphStartsAtField: graphStartsAtField, catVars: catVars, catColor: catColor, softHyphenate: softHyphenate, warmHyphenation: warmHyphenation, tokens: tokens, fmtNum: fmtNum, onChange: onChange, syncBackground: syncBackground, sortIconHtml: sortIconHtml, mailtoFromButton: mailtoFromButton, ORCID_SVG: ORCID_SVG, AFF_SVG: AFF_SVG, oaIconPaths: oaIconPaths, DOWNLOAD_PATHS: DOWNLOAD_PATHS, MODEL_ICON_PATHS: MODEL_ICON_PATHS, ICON_PATHS: ICON_PATHS, monthMask: monthMask, mathHtml: mathHtml, escapeHtml: escapeHtml, ordinalHtml: ordinalHtml, copyToast: copyToast, fileTimestamp: fileTimestamp, fileSafe: fileSafe };

  // Fill any static-page toolbar placeholder from the single toolbar source.
  try {
    var _oaRel = window.OA_REL_ROOT != null ? window.OA_REL_ROOT : "";
    var _bars = document.querySelectorAll(".oa-toprow[data-oa-toprow]");
    for (var _i = 0; _i < _bars.length; _i++) {
      _bars[_i].innerHTML = navToolbar(_oaRel, _bars[_i].getAttribute("data-section") || "");
    }
  } catch (_e) { /* no-op */ }
  // oa-boot.js painted <html> pre-paint; <body> follows the palette from here.
  syncBackground();
})();
