/* bibliography.js - pure record and bibliography adapters. No DOM work.
 * Load before oa-theme.js. All export surfaces use this same serializer.
 * Optional metadata remains supported even when a compact dataset omits it.
 */
(function (root) {
  "use strict";

  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalizeDoi(raw) {
    return text(raw).replace(/^doi:\s*/i, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/\s+/g, "");
  }

  // Only undefined means absent. Explicit null/empty values in the modern row
  // deliberately override old metadata. Unknown metadata survives the adapter.
  function normalizeRecord(record) {
    record = record || {};
    var meta = record.meta && typeof record.meta === "object" ? record.meta : {};
    var out = Object.assign({}, meta);
    Object.keys(record).forEach(function (key) {
      if (record[key] !== undefined) out[key] = record[key];
    });
    out.id = text(out.id || out.slug || out.bibtexKey);
    out.title = text(out.title);
    out.subtitle = text(out.subtitle);
    out.doi = normalizeDoi(out.doi);
    if (!Array.isArray(out.authors)) out.authors = out.authors ? [out.authors] : [];
    if (!Array.isArray(out.editors)) out.editors = out.editors ? [out.editors] : [];
    out.meta = Object.assign({}, meta);
    return out;
  }

  // Store-first resolution is shared by the grid and every export. Individual
  // fields fall back independently so a partial store profile loses no name.
  function resolveAuthorName(ref) {
    var store = root.AUTHORS_DATA || {};
    if (typeof ref === "string") {
      if (Object.prototype.hasOwnProperty.call(store, ref)) ref = { id: ref };
      else {
        var comma = ref.indexOf(",");
        return comma < 0 ? { family: text(ref), given: "" }
          : { family: text(ref.slice(0, comma)), given: text(ref.slice(comma + 1)) };
      }
    }
    ref = ref || {};
    var slug = ref.id || ref.slug || "";
    var profile = Object.prototype.hasOwnProperty.call(store, slug) ? store[slug] || {} : {};
    function field(key, alias) {
      if (profile[key] != null) return text(profile[key]);
      if (alias && profile[alias] != null) return text(profile[alias]);
      if (ref[key] != null) return text(ref[key]);
      return alias ? text(ref[alias]) : "";
    }
    var literal = field("literal", "organization");
    if (!literal && (profile.isOrganization || ref.isOrganization)) literal = field("name", "lastName");
    if (literal) return { family: literal, given: "", literal: literal };
    var prefix = field("prefix");
    var family = field("lastName", "family");
    var given = field("firstName", "given");
    if (!family && !given) family = field("name") || text(slug);
    return { family: [prefix, family].filter(Boolean).join(" "), given: given };
  }

  // Explicit bibliographic types take precedence over legacy export labels.
  // A bare Citavi Contribution is a collection contribution. It is a conference
  // paper only when the container metadata identifies proceedings. Do not infer
  // the type from missing volume or from the broad substring "paper".
  function entryType(record) {
    var raw = record.entryType || record.bibtexType || record.type || "";
    var t = text(raw).toLowerCase().replace(/[\s_-]/g, "");
    if (/^(article|journalarticle|journalpaper)$/.test(t)) return "article";
    if (/^(inproceedings|conferencepaper|conferencecontribution|conferencearticle|conference|proceedingspaper)$/.test(t)) return "inproceedings";
    if (/^(incollection|bookchapter|chapter|booksection|collectedworkcontribution)$/.test(t)) return "incollection";
    if (t === "inbook") return "inbook";
    if (/^(book|editedbook|monograph|collectedwork)$/.test(t)) return "book";
    if (t === "proceedings" || t === "conferenceproceedings") return "proceedings";
    if (/^(mastersthesis|masterthesis|bachelorthesis|bachelorsthesis|undergraduatethesis)$/.test(t)) return "mastersthesis";
    if (/^(phdthesis|doctoralthesis|doctoraldissertation|dissertation|thesis)$/.test(t)) return "phdthesis";
    if (/^(techreport|technicalreport|report|reportorgrayliterature|reportorgreyliterature)$/.test(t)) return "techreport";
    if (t === "manual" || t === "booklet" || t === "unpublished" || t === "misc") return t;
    if (t === "contribution") {
      var container = text(record.containerType || record.parentType).toLowerCase();
      if (record.chapter != null || /book|collection/.test(container)) return "incollection";
      if (/conference|proceeding/.test(container) || /\b(proceedings|conference|symposium|congress|workshop)\b/i.test(text(record.booktitle || record.venue))) return "inproceedings";
      return "incollection";
    }
    return "misc";
  }

  function year(record) {
    var match = text(record.year || record.date).match(/\b\d{4}\b/);
    return match ? match[0] : "";
  }
  function fullTitle(record) {
    return [text(record.title), text(record.subtitle)].filter(Boolean).join(": ");
  }
  function locator(record) {
    var pages = text(record.pages);
    // The dataset field is articleNo; articleNumber / article are older aliases.
    var article = text(record.articleNo) || text(record.articleNumber) || text(record.article);
    if (/[\u2010-\u2015-]/.test(pages)) return { kind: "range", value: pages.replace(/\s*[\u2010-\u2015-]+\s*/g, "-") };
    if (article) return { kind: "article", value: article };
    return { kind: pages ? "page" : "none", value: pages };
  }

  // Input is plain metadata, not trusted TeX. Escape literal braces instead of
  // deleting their content. DOI and URL use identifier handling, never this.
  //
  // The rest is written in ASCII wherever LaTeX has a spelling for it: classic
  // BibTeX sorts and abbreviates names byte by byte, so a UTF-8 letter could
  // sort or label wrongly (biber and current LaTeX read either). Accented
  // letters become accent commands ({\'e}, {\v{S}}); special letters, dashes,
  // quotes and a few signs their commands; other symbols, Greek letters and
  // super- and subscripts inline math (m$^{3}$, $\mu$m, $\geq$). A character
  // with no portable spelling (Cyrillic, a comma-below letter) stays UTF-8.
  var TEX_SPECIALS = { "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
  function texSpecials(s) {
    return s.replace(/[\\&%$#_{}~^]/g, function (ch) { return TEX_SPECIALS[ch] || "\\" + ch; });
  }
  // Combining mark (after NFD) -> accent command.
  var TEX_ACCENTS = { "̀": "`", "́": "'", "̂": "^", "̃": "~", "̄": "=", "̆": "u",
    "̇": ".", "̈": "\"", "̊": "r", "̋": "H", "̌": "v", "̣": "d", "̧": "c", "̨": "k" };
  // Text-mode spellings.
  var TEX_TEXT = {
    "ß": "{\\ss}", "ı": "{\\i}", "ł": "{\\l}", "Ł": "{\\L}", "ø": "{\\o}", "Ø": "{\\O}",
    "æ": "{\\ae}", "Æ": "{\\AE}", "œ": "{\\oe}", "Œ": "{\\OE}", "å": "{\\aa}", "Å": "{\\AA}",
    "‐": "-", "‑": "-", "‒": "--", "–": "--", "—": "---",
    "‘": "`", "’": "'", "“": "``", "”": "''", "…": "{\\ldots}",
    " ": "~", " ": "\\,", " ": "\\,", "­": "\\-", "​": "", "⁢": "",
    "•": "{\\textbullet}", "⁄": "/", "∶": ":",
    "©": "{\\textcopyright}", "®": "{\\textregistered}", "™": "{\\texttrademark}"
  };
  // Math-mode spellings; a run of them shares one $...$.
  var TEX_MATH = {
    "°": "^{\\circ}", "±": "\\pm", "×": "\\times", "÷": "\\div", "−": "-",
    "≈": "\\approx", "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "∼": "\\sim",
    "←": "\\leftarrow", "→": "\\rightarrow", "↔": "\\leftrightarrow", "∞": "\\infty",
    "∅": "\\emptyset", "∥": "\\parallel", "‖": "\\|", "⟂": "\\perp", "⊥": "\\perp",
    "·": "\\cdot", "⋅": "\\cdot", "∙": "\\cdot", "∘": "\\circ", "◦": "\\circ", "△": "\\triangle",
    "∂": "\\partial", "∇": "\\nabla", "∑": "\\sum", "√": "\\surd",
    "′": "'", "″": "''", "¼": "\\frac{1}{4}", "½": "\\frac{1}{2}", "¾": "\\frac{3}{4}",
    "µ": "\\mu", "ο": "o"
  };
  ("alpha beta gamma delta varepsilon zeta eta theta iota kappa lambda mu nu xi - pi rho varsigma sigma tau upsilon varphi chi psi omega")
    .split(" ").forEach(function (name, i) { if (name !== "-") TEX_MATH[String.fromCharCode(0x3b1 + i)] = "\\" + name; });
  var GREEK_CAPS = { "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma",
    "Υ": "Upsilon", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega", "ϕ": "phi", "ϵ": "epsilon", "ϑ": "vartheta" };
  Object.keys(GREEK_CAPS).forEach(function (ch) { TEX_MATH[ch] = "\\" + GREEK_CAPS[ch]; });
  // Super- and subscript characters; a run of one kind becomes one ^{...} / _{...}.
  var TEX_SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁺": "+", "⁻": "-", "ⁿ": "n", "ⁱ": "i" };
  var TEX_SUB = { "₊": "+", "₋": "-", "ᵢ": "i", "ₓ": "x" };
  for (var d = 0; d < 10; d++) {
    if (d > 3) TEX_SUP[String.fromCharCode(0x2070 + d)] = String(d);
    TEX_SUB[String.fromCharCode(0x2080 + d)] = String(d);
  }
  // An accented Latin letter as accent commands, else null: {\'e}, {\v{S}},
  // {\'{\i}} (the dotless i takes the accent), {\^{\d{e}}} for two marks.
  function texAccented(ch) {
    var parts = Array.from(ch.normalize("NFD"));
    if (parts.length < 2 || !/^[A-Za-z]$/.test(parts[0])) return null;
    var out = parts[0] === "i" ? "\\i" : parts[0] === "j" ? "\\j" : parts[0];
    for (var k = 1; k < parts.length; k++) {
      var a = TEX_ACCENTS[parts[k]];
      if (!a) return null;
      out = "\\" + a + (/[a-z]/i.test(a) || out.length > 1 ? "{" + out + "}" : out);
    }
    return "{" + out + "}";
  }
  function bibEscape(value) {
    var s = texSpecials(text(value));
    if (!/[^\x00-\x7f]/.test(s)) return s;
    var out = "", math = "", script = "", kind = "";
    function addMath(m) {
      if (/\\[a-z]+$/i.test(math) && /^[a-z]/i.test(m)) math += " ";   // \mu x, not \mux
      math += m;
    }
    function endScript() { if (script) { math += (kind === "sup" ? "^{" : "_{") + script + "}"; script = ""; kind = ""; } }
    function endMath() { endScript(); if (math) { out += "$" + math + "$"; math = ""; } }
    Array.from(s.normalize("NFC").replace(/℃/g, "°C")).forEach(function (ch) {
      var sup = TEX_SUP[ch], sub = TEX_SUB[ch];
      if (sup != null || sub != null) {
        var k = sup != null ? "sup" : "sub";
        if (kind && kind !== k) endScript();
        kind = k;
        script += sup != null ? sup : sub;
        return;
      }
      var m = TEX_MATH[ch], cp = ch.codePointAt(0);
      // Mathematical letters (italic A, bold x, ...): the plain letter, in math.
      if (m == null && cp >= 0x1d400 && cp <= 0x1d7ff) {
        var plain = ch.normalize("NFKC");
        m = /^[A-Za-z0-9]$/.test(plain) ? plain : TEX_MATH[plain];
      }
      if (m != null) { endScript(); addMath(m); return; }
      endMath();
      if (cp < 0x80) { out += ch; return; }
      if (TEX_TEXT[ch] != null) { out += TEX_TEXT[ch]; return; }
      var acc = texAccented(ch);
      if (acc) { out += acc; return; }
      // Full-width punctuation and letters: their ASCII twins.
      if (cp >= 0xff01 && cp <= 0xff5e) { out += texSpecials(ch.normalize("NFKC")); return; }
      out += ch;
    });
    endMath();
    return out;
  }
  // Greedy word wrap for long prose fields (abstract): continuation lines sit
  // under the value column, like the one-name-per-line author list.
  function wrapWords(str, width) {
    var lines = [], line = "";
    str.split(" ").forEach(function (word) {
      if (!word) return;
      if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; }
      else line = line ? line + " " + word : word;
    });
    if (line) lines.push(line);
    return lines;
  }
  function bibEntry(type, key, fields) {
    var width = fields.reduce(function (n, field) { return Math.max(n, field[0].length); }, 0);
    var body = fields.map(function (field) {
      var prefix = "  " + field[0].padEnd(width, " ") + " = ";
      var value = field[1];
      if (field[2] === "wrap") {
        var pad = " ".repeat(prefix.length + 1);
        return prefix + "{" + wrapWords(value, Math.max(40, 80 - pad.length)).join("\n" + pad) + "}";
      }
      // Each item wraps as its own run and starts on a fresh line (keywords,
      // then the category codes). Items after the first get "," so the whole
      // field stays one comma-separated list.
      if (field[2] === "wraplines") {
        var wpad = " ".repeat(prefix.length + 1), wwidth = Math.max(40, 80 - wpad.length);
        return prefix + "{" + value.map(function (item, i) {
          return wrapWords(i < value.length - 1 ? item + "," : item, wwidth).join("\n" + wpad);
        }).join("\n" + wpad) + "}";
      }
      // One line per item (the abstract's sentences), continuation lines under
      // the value column; no wrapping within a sentence so each line IS one.
      if (field[2] === "lines") {
        var indent = " ".repeat(prefix.length + 1);
        return prefix + "{" + value.join("\n" + indent) + "}";
      }
      if (Array.isArray(value)) {
        var names = value.filter(Boolean);
        if (names.length <= 1) return prefix + "{" + (names[0] || "") + "}";
        var namePad = " ".repeat(prefix.length + 1);
        var length = names.reduce(function (n, name) { return Math.max(n, name.length); }, 0);
        return prefix + "{\n" + names.map(function (name, i) {
          return namePad + (i < names.length - 1 ? name.padEnd(length, " ") + " and" : name);
        }).join("\n") + "\n" + namePad + "}";
      }
      return prefix + "{" + value + "}";
    }).join(",\n");
    return "@" + type + "{" + key + ",\n" + body + "\n}";
  }
  function personNames(people) {
    return people.map(function (person) {
      var name = resolveAuthorName(person);
      if (name.literal) return "{" + bibEscape(name.literal) + "}";
      return [name.family, name.given].filter(Boolean).map(bibEscape).join(", ");
    }).filter(Boolean);
  }
  function identifier(value) {
    // BibTeX braces delimit the field. Percent-encoding a literal brace keeps a
    // URL/DOI navigable without adding LaTeX escapes to the identifier.
    return text(value).replace(/[{}\r\n]/g, function (ch) { return encodeURIComponent(ch); });
  }
  function formatBibtex(input) {
    var record = normalizeRecord(input);
    var type = entryType(record);
    var fields = [];
    function add(key, value) { if (text(value)) fields.push([key, bibEscape(value)]); }
    function names(key, value) { var list = personNames(value); if (list.length) fields.push([key, list]); }
    names("author", record.authors);
    names("editor", record.editors);
    var title = fullTitle(record);
    if (title) fields.push(["title", "{" + bibEscape(title) + "}"]);
    if (type === "article") add("journal", record.journal || record.venue);
    else if (type === "inproceedings" || type === "incollection") add("booktitle", record.booktitle || record.venue);
    add("year", year(record));
    add("month", record.month);
    add("volume", record.volume);
    add("number", record.number != null ? record.number : record.issue);
    var pageLocator = locator(record);
    var pages = pageLocator.kind === "range" ? pageLocator.value.replace(/-/g, "--") : pageLocator.value;
    add("pages", pages);
    add("chapter", record.chapter);
    add("edition", record.edition);
    add("series", record.series);
    var thesis = type === "phdthesis" || type === "mastersthesis";
    var publisher = record.publisher;
    if (!publisher && (type === "book" || type === "proceedings")) publisher = record.venue;
    add("publisher", publisher);
    add("address", record.address || record.location);
    if (thesis) add("school", record.school || record.institution || record.university || record.venue);
    else add("institution", record.institution || (type === "techreport" ? record.venue : ""));
    add("organization", record.organization);
    var subtype = record.thesisType || record.reportType;
    if (!subtype && /bachelor|undergraduate/i.test(text(record.type))) subtype = "Bachelor's thesis";
    if (subtype) add("type", subtype);
    add("isbn", record.isbn);
    add("issn", record.issn);
    if (record.doi) fields.push(["doi", identifier(record.doi)]);
    // The site URL is the existing public export contract. Preserve explicit
    // source locations separately instead of throwing away their metadata.
    var key = record.id.replace(/[\s,{}\\#%]/g, "_") || "reference";
    var url = record.id ? siteUrl(encodeURIComponent(record.id)) : record.url;
    if (url) fields.push(["url", identifier(url)]);
    if (record.url && record.id && record.url !== url) fields.push(["howpublished", identifier(record.url)]);
    add("eprint", record.eprint);
    add("archiveprefix", record.archivePrefix || record.archiveprefix);
    add("primaryclass", record.primaryClass || record.primaryclass);
    // Keywords keep their sigil (# topical, $ derived),
    // and the article's categories follow them as •CODE - the same markers the
    // grid shows, so a .bib round-trips into the site's own filter vocabulary.
    // Sigils stay raw; only the term text is escaped.
    var keywords = Array.isArray(record.keywords) ? record.keywords : (record.keywords ? [record.keywords] : []);
    var tags = keywords.map(function (keyword) {
      var raw = text(keyword), sigil = raw.charAt(0);
      var term = raw.replace(/^[#$]\s*/, "");
      return term ? sigil + bibEscape(term) : "";
    });
    var categories = Array.isArray(record.categories) ? record.categories : (record.categories ? [record.categories] : []);
    categories.forEach(function (category) {
      var code = text(category).replace(/^\u2022\s*/, "").toUpperCase();
      if (code) tags.push("\u2022" + bibEscape(code));
    });
    tags = tags.filter(function (tag, i) { return tag && tags.indexOf(tag) === i; });
    // Keywords wrap as one run; the •CODE categories start on their own line so
    // the two vocabularies read apart. Both keep the comma separators.
    var terms = tags.filter(function (tag) { return tag.charAt(0) !== "\u2022"; });
    var codes = tags.filter(function (tag) { return tag.charAt(0) === "\u2022"; });
    if (tags.length) fields.push(["keywords", [terms.join(", "), codes.join(", ")].filter(Boolean), "wraplines"]);
    // Rows carry the abstract as the manifest's sentence array (semantic-search.js
    // remapToTableRows) or as one string; exported one sentence per line. A
    // string is split at sentence ends (. ! ? followed by a capital / digit /
    // opening quote or bracket) - abbreviations like "e.g. the" stay intact.
    var sentences = Array.isArray(record.abstract) ? record.abstract
      : text(record.abstract).replace(/([.!?]["'\u201d\u2019)\]]?)\s+(?=["'\u201c\u2018(\[]?[A-Z0-9])/g, "$1\u0000").split("\u0000");
    sentences = sentences.map(function (s) { return bibEscape(text(s).replace(/\s+/g, " ")); }).filter(Boolean);
    if (sentences.length) fields.push(["abstract", sentences, "lines"]);
    add("note", record.note);
    return bibEntry(type, key, fields);
  }
  // One canonical share root for exports, clipboard links and reports. Source
  // pages retain their public domain; the export boot supplies its own root.
  function siteUrl(path) {
    var base = root.OA_SITE_ROOT || "https://3dcp.fyi/";
    path = String(path || "");
    var route = path.split(/[?#]/)[0];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)|[\\\x00-\x20\x7f]/i.test(route)) throw new Error("Expected a relative site route");
    route.split("/").forEach(function (part) {
      var decoded;
      try { decoded = decodeURIComponent(part); } catch (_) { throw new Error("Malformed site route"); }
      if (decoded === "." || decoded === ".." || /[\/\\\x00-\x20\x7f]/.test(decoded)) throw new Error("Unsafe site route");
    });
    return base + path;
  }
  function formatBibtexLibrary(rows) {
    var entries = rows.filter(Boolean).map(function (row) { return formatBibtex(row); });
    return entries.length ? entries.join("\n\n") + "\n" : "";
  }

  root.OABibliography = Object.freeze({ normalizeRecord: normalizeRecord,
    normalizeDoi: normalizeDoi, resolveAuthorName: resolveAuthorName,
    entryType: entryType, year: year, fullTitle: fullTitle, locator: locator,
    siteUrl: siteUrl,
    formatBibtex: formatBibtex, formatBibtexLibrary: formatBibtexLibrary });
})(globalThis);
