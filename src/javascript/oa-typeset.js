/* oa-typeset.js - shows the words listed in src/replacement_data.js typeset
 * (CO2 -> CO₂, m3 -> m³), while search accepts either spelling.
 *
 *   OATypeset.text("CO2 at 2400 kg/m3")  -> "CO₂ at 2400 kg/m³"
 *   OATypeset.fold("CO₂ at 2400 kg/m³")  -> "CO2 at 2400 kg/m3"
 *
 * text() is for what readers see (titles, abstracts, TOC entries, keyword and
 * category labels). fold() is for what search compares: apply it to BOTH the
 * indexed text and the query. Neither changes the length of a string (one
 * UTF-16 unit for one), so an offset found in any spelling is valid in the
 * others - a highlight computed on folded text lands on the typeset characters.
 * A word split by a space in the source ("CO 2") folds to its joined form with
 * the space moved behind it ("CO2 "), so searching CO2 finds it too.
 * Exports (BibTeX, copied references) keep the dataset's own spelling.
 *
 * Load src/replacement_data.js first. Without it (or on an engine without
 * regex lookbehind) text() returns its input unchanged; fold() always works.
 */
(function () {
  "use strict";

  var SUB = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
  var SUP = "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079";
  var JOIN = "\u2060";   // word joiner: invisible, keeps the length
  var GROUPS = Array.isArray(window.REPLACEMENT_DATA) ? window.REPLACEMENT_DATA : [];

  // Search spelling: every sub/superscript digit and sign, and the true minus
  // sign, as ASCII. Same length in, same length out.
  var FOLD = Object.create(null);
  for (var i = 0; i < 10; i++) { FOLD[SUB.charAt(i)] = String(i); FOLD[SUP.charAt(i)] = String(i); }
  FOLD["\u207A"] = FOLD["\u208A"] = "+";
  FOLD["\u207B"] = FOLD["\u208B"] = FOLD["\u2212"] = "-";
  var FOLD_CHARS = "[\\u00B2\\u00B3\\u00B9\\u2070\\u2074-\\u207B\\u2080-\\u208B\\u2212]";
  var FOLD_RE = new RegExp(FOLD_CHARS, "g"), HAS_FOLD = new RegExp(FOLD_CHARS);
  function foldChars(s) {
    s = s == null ? "" : String(s);
    return HAS_FOLD.test(s) ? s.replace(FOLD_RE, function (c) { return FOLD[c]; }) : s;
  }

  // "SO_4^2-" -> "SO₄²⁻", "CO_2~" -> "CO₂" + word joiner.
  function display(entry) {
    var to = "", mode = "";
    for (var k = 0; k < entry.length; k++) {
      var c = entry.charAt(k);
      if (c === "_" || c === "^") { mode = c; continue; }
      var digit = c >= "0" && c <= "9";
      if (mode === "_" && digit) { to += SUB.charAt(+c); continue; }
      if (mode === "^" && (digit || c === "+" || c === "-")) {
        to += c === "+" ? "\u207A" : c === "-" ? "\u207B" : SUP.charAt(+c);
        continue;
      }
      mode = "";
      to += c === "~" ? JOIN : c;
    }
    return to;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function warn(msg) { console.warn("replacement_data.js: " + msg); }

  var BY_KEY = Object.create(null), alts = [], spaced = [];
  GROUPS.forEach(function (g) {
    if (!g || !Array.isArray(g.list)) return;
    var unless = null;
    if (g.unless) { try { unless = new RegExp(g.unless); } catch (e) { warn("bad unless " + g.unless); } }
    g.list.forEach(function (entry) {
      entry = String(entry);
      var eq = entry.indexOf("=");
      var key = eq > 0 ? entry.slice(0, eq) : entry.replace(/[_^]/g, "");
      var to = display(eq > 0 ? entry.slice(eq + 1) : entry);
      if (!key || to.length !== key.length) { warn("skipped " + entry + " (length differs)"); return; }
      // A split word folds to its joined form, the space moved behind it.
      var compact = key.indexOf(" ") >= 0 ? key.replace(/ /g, "") + key.replace(/[^ ]/g, "") : null;
      BY_KEY[key] = { to: to, compact: compact, unless: unless };
      var src = (g.before || "(?<![A-Za-z])") + escRe(key) + (g.after || "(?![A-Za-z0-9])");
      alts.push({ n: key.length, src: src });
      if (compact) spaced.push({ n: key.length, src: src });
    });
  });
  // Longest first, so "H2O2" wins over "H2O" and "kgCO2eq" over "kgCO2".
  function build(list) {
    list.sort(function (a, b) { return b.n - a.n; });
    try { return list.length ? new RegExp(list.map(function (a) { return a.src; }).join("|"), "g") : null; }
    catch (e) { return null; }   // engine without lookbehind: text shows as stored
  }
  var RE = build(alts), SPACED_RE = build(spaced);

  function fold(s) {
    var f = foldChars(s);
    if (!SPACED_RE || f.indexOf(" ") < 0) return f;
    SPACED_RE.lastIndex = 0;
    // SPACED_RE holds only keys that have a compact form.
    return f.replace(SPACED_RE, function (m) { return BY_KEY[m].compact; });
  }

  // One pass over the folded string; the output keeps every original character
  // outside a match (an "n₀" elsewhere stays as written).
  function text(s) {
    s = s == null ? "" : String(s);
    if (!s || !RE) return s;
    var f = foldChars(s), out = "", last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(f)) !== null) {
      var r = BY_KEY[m[0]];   // RE is built from BY_KEY's keys, so every match has one
      if (r.unless && r.unless.test(f)) continue;
      out += s.slice(last, m.index) + r.to;
      last = m.index + m[0].length;
    }
    return last ? out + s.slice(last) : s;
  }

  window.OATypeset = { text: text, fold: fold };
})();
