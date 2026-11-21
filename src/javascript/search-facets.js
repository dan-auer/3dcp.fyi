/* ============================================================
 * search-facets.js - facet suggestions under the toolbar search box.
 *
 * The search box searches abstracts. But a lot of what people type into it
 * is not a research question at all - it is a name, a keyword, a journal, a
 * year, a category. Those are FILTERS, not queries, and the table already
 * has a rule engine for them. This module bridges the two: while you type,
 * it offers matching authors / keywords / categories / venues / dates, and
 * picking one applies the corresponding filter rule.
 *
 * Behaviours worth knowing:
 *   - Enter / click        apply the rule
 *   - Shift                apply and keep the menu open (stack filters)
 *   - Alt                  apply the NEGATED rule (IS NOT / !=)
 *   - empty box + focus    the biggest facets, as a browse entry point
 *   - words already spent on the pick are stripped from the query; anything
 *     left over stays in the box and is searched inside the new filter
 *
 * Owns no data and no rule state: the host passes a `sources()` provider,
 * `apply()`, `isActive()` and `onApply()`.
 * ============================================================ */
(function () {
  "use strict";

  // One icon per parameter type, from the shared registry in oa-theme.js - the
  // same definitions the articles toolbar draws, so the two cannot drift.
  var IC = window.OATheme.ICON_PATHS, IC_CHECK = IC.check;

  var GROUPS = [
    { key: "authors",    kind: "author",   head: "Authors",    field: "author",   operator: "is" },
    { key: "keywords",   kind: "keyword",  head: "Keywords",   field: "keyword",  operator: "is" },
    { key: "categories", kind: "category", head: "Categories", field: "category", operator: "is" },
    { key: "venues",     kind: "venue",    head: "Venues",     field: "venue",    operator: "is" },
    { key: "dates",      kind: "date",     head: "Dates",      field: "date",     operator: "=" },
    // One row per article; the pick is the article's BibTeX key (ID IS "..."),
    // so two papers sharing a title (preprint + journal version) stay apart -
    // the key is shown beside the title for exactly that reason.
    { key: "titles",     kind: "title",    head: "Titles",     field: "id",       operator: "is" }
  ];

  // Alt-pick inverts the rule. The host owns which operators have a real
  // inverse (IS NOT / !=) and which need a NOT connector instead, so the row
  // just reports that the modifier was held.

  var PER_GROUP = 4;
  var TITLES_PER_GROUP = 5;
  var TOTAL_CAP = 14;

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

  function icon(kind, cls) {
    return '<svg class="' + (cls || "sf-ic") + '" viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + (kind === "check" ? IC_CHECK : IC[kind]) + "</svg>";
  }

  var esc = window.OATheme.escapeHtml;

  // Diacritic-insensitive lowercase, so "Loven" finds "Lovén". A leading "#"
  // (keyword facets carry one) is dropped so typing "concrete" treats
  // "#concrete" as a prefix hit rather than a mid-string one.
  // Sub/superscript digits fold to ASCII (oa-typeset.js): "co2" finds "CO₂".
  var fold = window.OATypeset.fold;
  // What the reader sees: CO2 -> CO₂. Same length, so marks found by norm() fit.
  var typeset = window.OATypeset.text;
  function norm(s) {
    return fold(String(s == null ? "" : s)).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^#/, "");
  }

  // 0 = prefix of the whole string, 1 = starts a word, 2 = anywhere else,
  // -1 = no match. Lower sorts first.
  // Author labels read "Family, Given"; a query typed without the comma ("bos
  // freek") still matches - and is marked - against the comma-less form.
  function rank(haystack, needle) {
    var i = haystack.indexOf(needle);
    if (i < 0 && haystack.indexOf(", ") >= 0) { haystack = haystack.replace(/, /g, " "); i = haystack.indexOf(needle); }
    if (i < 0) return -1;
    if (i === 0) return 0;
    return /[\s\-·(\[/#:,&]/.test(haystack.charAt(i - 1)) ? 1 : 2;
  }

  function markHtml(text, needle) {
    var raw = typeset(String(text == null ? "" : text));
    var lead = raw.charAt(0) === "#" ? 1 : 0;
    var body = raw.slice(lead);
    var n = needle ? norm(raw) : "", len = needle ? needle.length : 0;
    var i = needle ? n.indexOf(needle) : -1;
    if (i < 0 && needle && n.indexOf(", ") >= 0) {
      // A hit in the comma-less form, mapped back onto the label.
      var map = [], alt = "";
      for (var k = 0; k < n.length; k++) { if (n.charAt(k) === "," && n.charAt(k + 1) === " ") continue; map.push(k); alt += n.charAt(k); }
      var j = alt.indexOf(needle);
      if (j >= 0) { i = map[j]; len = map[j + needle.length - 1] + 1 - i; }
    }
    if (i < 0) return esc(raw);
    return esc(raw.slice(0, lead)) + esc(body.slice(0, i)) +
      '<mark class="sf-mk">' + esc(body.slice(i, i + len)) + "</mark>" +
      esc(body.slice(i + len));
  }

  // Every occurrence of every query word, for title rows matched word-wise
  // (the words need not be adjacent, so a single-needle mark would miss).
  function markWords(text, words) {
    var raw = typeset(String(text == null ? "" : text));
    var hay = norm(raw);
    var spans = [];
    for (var w = 0; w < words.length; w++) {
      var from = 0, i;
      while (words[w] && (i = hay.indexOf(words[w], from)) >= 0) {
        spans.push([i, i + words[w].length]);
        from = i + words[w].length;
      }
    }
    if (!spans.length) return esc(raw);
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", pos = 0;
    for (var s = 0; s < spans.length; s++) {
      var a = Math.max(spans[s][0], pos), b = spans[s][1];
      if (b <= pos) continue;
      out += esc(raw.slice(pos, a)) + '<mark class="sf-mk">' + esc(raw.slice(a, b)) + "</mark>";
      pos = b;
    }
    return out + esc(raw.slice(pos));
  }

  // Marks for a facet label: the whole needle when it occurs, else each of its
  // words (a tail-word merge hit only contains the last word). The keyword
  // sigil is kept out of the word pass so indices line up with the raw text.
  function markLabel(text, needle) {
    var raw = String(text == null ? "" : text);
    if (!needle || norm(raw).indexOf(needle) >= 0 || needle.indexOf(" ") < 0) return markHtml(raw, needle);
    var words = needle.split(" ").filter(Boolean);
    if (raw.charAt(0) === "#") return esc("#") + markWords(raw.slice(1), words);
    return markWords(raw, words);
  }

  function monthLabel(ym) {
    var p = String(ym).split("-");
    return (MONTH_NAMES[Number(p[1]) - 1] || p[1]) + " " + p[0];
  }

  function monthName(word) {
    for (var i = 0; i < 12; i++) {
      if (MONTH_NAMES[i].toLowerCase().indexOf(word) === 0) return i + 1;
    }
    return 0;
  }

  function countIn(months, test) {
    var n = 0;
    months.forEach(function (c, ym) { if (test(ym)) n += c; });
    return n;
  }

  function dateRow(extra) {
    extra.kind = "date";
    extra.field = "date";
    extra.consumesQuery = true;      // the whole query WAS the date
    extra._r = 0;                    // a parsed date is an exact intent
    return extra;
  }

  /* Date rows are computed, not matched: a query is only a date if it parses
     as one. Understood forms:
       2019              whole year          BETWEEN 2019-01 .. 2019-12
       2019-07, july 2019  one month         = 2019-07
       2019-2023, 2019 to 2023, 2019..2023   BETWEEN 2019-01 .. 2023-12
       since 2020, from 2020, 2020-, >=2020  >= 2020-01
       before 2020, <2020                    <= 2019-12
       until 2020, through 2020              <= 2020-12  */
  function dateRows(query, months) {
    if (!months || !months.size) return [];
    var q = String(query).trim().toLowerCase().replace(/\s+/g, " ");
    var m, rows = [];
    var has = function (test) { return countIn(months, test); };
    var yearIn = function (y) { return function (ym) { return ym.indexOf(y + "-") === 0; }; };

    // ---- ranges between two years
    m = /^(\d{4})\s*(?:-|\u2013|\.\.|to|through|until|till|–)\s*(\d{4})$/.exec(q);
    if (m) {
      var a = m[1], b = m[2];
      if (Number(a) > Number(b)) { var t = a; a = b; b = t; }
      var nr = has(function (ym) { return ym >= a + "-01" && ym <= b + "-12"; });
      if (nr) {
        rows.push(dateRow({
          label: a + " - " + b, sub: "range", count: nr,
          operator: "between", value: a + "-01", value2: b + "-12"
        }));
      }
      return rows;
    }

    // ---- open-ended: since / before / until
    m = /^(since|from|after|>=?|>)\s*(\d{4})(?:-)?$/.exec(q) || /^(\d{4})\s*-$/.exec(q);
    if (m) {
      var fy = m.length === 3 ? m[2] : m[1];
      if (m.length === 3 && (m[1] === "after" || m[1] === ">")) fy = String(Number(fy) + 1).padStart(4, "0");
      var nf = has(function (ym) { return ym >= fy + "-01"; });
      if (nf) {
        rows.push(dateRow({
          label: fy + " and later", sub: "\u2265 " + fy + "-01", count: nf,
          operator: ">=", value: fy + "-01"
        }));
      }
      return rows;
    }
    m = /^(before|<)\s*(\d{4})$/.exec(q);
    if (m) {
      var by = String(Number(m[2]) - 1).padStart(4, "0");
      var nb = has(function (ym) { return ym <= by + "-12"; });
      if (nb) {
        rows.push(dateRow({
          label: "before " + m[2], sub: "\u2264 " + by + "-12", count: nb,
          operator: "<=", value: by + "-12"
        }));
      }
      return rows;
    }
    m = /^(until|till|up to|through|<=)\s*(\d{4})$/.exec(q);
    if (m) {
      var uy = m[2];
      var nu = has(function (ym) { return ym <= uy + "-12"; });
      if (nu) {
        rows.push(dateRow({
          label: uy + " and earlier", sub: "\u2264 " + uy + "-12", count: nu,
          operator: "<=", value: uy + "-12"
        }));
      }
      return rows;
    }

    // ---- a single year
    m = /^(\d{4})$/.exec(q);
    if (m) {
      var ny = has(yearIn(m[1]));
      if (ny) {
        rows.push(dateRow({
          label: m[1], sub: "whole year", count: ny,
          operator: "between", value: m[1] + "-01", value2: m[1] + "-12"
        }));
      }
      return rows;
    }

    // ---- a single month, numeric or named
    var ym = null;
    m = /^(\d{4})[-/.](\d{1,2})$/.exec(q);
    if (m) {
      ym = m[1] + "-" + String(m[2]).padStart(2, "0");
    } else {
      m = /^([a-z]{3,9})\s+(\d{4})$/.exec(q) || /^(\d{4})\s+([a-z]{3,9})$/.exec(q);
      if (m) {
        var word = /^\d/.test(m[1]) ? m[2] : m[1];
        var year = /^\d/.test(m[1]) ? m[1] : m[2];
        var mi = monthName(word);
        if (mi) ym = year + "-" + String(mi).padStart(2, "0");
      }
    }
    if (ym && months.has(ym)) {
      rows.push(dateRow({
        label: monthLabel(ym), sub: ym, count: months.get(ym),
        operator: "=", value: ym
      }));
    }
    return rows;
  }

  // ArticleStore supplies frozen snapshots. Keep normalized candidates outside
  // those records; mutable providers are supported without retaining stale text.
  var candidateCache = new WeakMap();
  var listCache = new WeakMap();
  var EMPTY_LIST = Object.freeze([]);
  var QUERY_CACHE_CAP = 24;
  var menuSequence = 0;

  function preparedList(entries) {
    var cached = listCache.get(entries);
    if (cached) return cached;
    var immutable = Object.isFrozen(entries) && entries.every(function (e) {
      return !e || Object.isFrozen(e);
    });
    var candidates = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || !e.label) continue;
      var candidate = immutable ? null : candidateCache.get(e);
      if (!candidate || candidate.label !== e.label || candidate.sub !== e.sub) {
        candidate = { entry: e, label: e.label, sub: e.sub,
          normalized: null, normalizedSub: null };
        if (!immutable) candidateCache.set(e, candidate);
      }
      candidates.push(candidate);
    }
    cached = { candidates: candidates, matches: immutable ? new Map() : null, top: null };
    if (immutable) listCache.set(entries, cached);
    return cached;
  }

  // Stable insertion into a list of at most 4/5/10 candidates. Equal ranks
  // remain in source order, exactly as the former stable full-array sort did.
  // mode: 0 = count only (browse), 1 = facet rank/count, 2 = title rank.
  function compareCandidate(candidate, r, other, mode) {
    var a = candidate.entry, b = other.candidate.entry;
    if (mode && r !== other.rank) return r - other.rank;
    if (mode !== 2) {
      var ca = a.count || 0, cb = b.count || 0;
      if (ca !== cb) return cb - ca;
      if (!mode) return 0;
    }
    if (a.label.length !== b.label.length) return a.label.length - b.label.length;
    return a.label.localeCompare(b.label);
  }

  function keepBest(best, candidate, r, cap, mode) {
    var i = best.length;
    if (i === cap && compareCandidate(candidate, r, best[i - 1], mode) >= 0) return;
    while (i > 0 && compareCandidate(candidate, r, best[i - 1], mode) < 0) i--;
    best.splice(i, 0, { candidate: candidate, rank: r });
    if (best.length > cap) best.pop();
  }

  function hitRow(candidate, group, r, words) {
    var e = candidate.entry;
    var row = { label: e.label, sub: e.sub, kind: group.kind,
      field: group.field, operator: group.operator,
      value: e.value != null ? e.value : e.label };
    if (e.date) row.date = e.date;
    if (e.authors) row.authors = e.authors;
    if (group.key !== "titles") row.count = e.count;
    if (r != null) row._r = r;
    if (words) row._words = words;
    return row;
  }

  function cachedHits(prepared, key) {
    if (!prepared.matches || !prepared.matches.has(key)) return null;
    var hits = prepared.matches.get(key);
    prepared.matches.delete(key);
    prepared.matches.set(key, hits);
    // The caller merges tail-word hits and trims groups in place.
    return hits.slice();
  }

  function saveHits(prepared, key, hits) {
    if (prepared.matches) {
      if (prepared.matches.size >= QUERY_CACHE_CAP) {
        prepared.matches.delete(prepared.matches.keys().next().value);
      }
      prepared.matches.set(key, hits.slice());
    }
    return hits;
  }

  function matchList(entries, needle, group) {
    var prepared = preparedList(entries);
    var key = group.key + "\u0000" + needle;
    var cached = cachedHits(prepared, key);
    if (cached) return cached;
    var best = [];
    for (var i = 0; i < prepared.candidates.length; i++) {
      var candidate = prepared.candidates[i];
      if (candidate.normalized == null) candidate.normalized = norm(candidate.label);
      var r = rank(candidate.normalized, needle);
      // Categories also match on their number and abbreviation ("3.2", "MAT").
      if (r < 0 && candidate.sub) {
        if (candidate.normalizedSub == null) candidate.normalizedSub = norm(candidate.sub);
        var rs = rank(candidate.normalizedSub, needle);
        if (rs >= 0) r = rs + 1;
      }
      if (r >= 0) keepBest(best, candidate, r, PER_GROUP, 1);
    }
    return saveHits(prepared, key, best.map(function (hit) {
      return hitRow(hit.candidate, group, hit.rank);
    }));
  }

  // Titles are matched word-wise: every typed word must occur, in any order.
  // Rank 0/1/2 = the whole query as a prefix / at a word start / inside a
  // word (same as rank()); 2 = every word at a word start; 3 = every word
  // somewhere. Shorter titles first within a rank - the closer fit.
  function matchTitles(entries, needle, group, cap) {
    var prepared = preparedList(entries);
    var key = group.key + "\u0000" + (cap || TITLES_PER_GROUP) + "\u0000" + needle;
    var cached = cachedHits(prepared, key);
    if (cached) return cached;
    var words = needle.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var best = [];
    for (var i = 0; i < prepared.candidates.length; i++) {
      var candidate = prepared.candidates[i];
      if (candidate.normalized == null) candidate.normalized = norm(candidate.label);
      var hay = candidate.normalized;
      var r = rank(hay, needle);
      // A pasted / half-remembered BibTeX key matches on the sub line too, so
      // the same box takes either the title or the key.
      if (r < 0 && candidate.sub) {
        if (candidate.normalizedSub == null) candidate.normalizedSub = norm(candidate.sub);
        var rs = rank(candidate.normalizedSub, needle);
        if (rs >= 0) r = rs + 1;
      }
      if (r < 0) {
        if (words.length < 2) continue;
        r = 2;
        for (var w = 0; w < words.length; w++) {
          var rw = rank(hay, words[w]);
          if (rw < 0) { r = -1; break; }
          if (rw === 2) r = 3;
        }
        if (r < 0) continue;
      }
      keepBest(best, candidate, r, cap || TITLES_PER_GROUP, 2);
    }
    return saveHits(prepared, key, best.map(function (hit) {
      return hitRow(hit.candidate, group, hit.rank, words);
    }));
  }

  // Biggest facets, shown when the box is empty and focused - the menu then
  // doubles as a browse entry point instead of staying invisible until typed at.
  // `only` (a Set of group keys) scopes the list to those groups - the rule
  // builder's value inputs use it to offer the biggest values of ONE field.
  function topRows(src, only) {
    var out = [];
    var take = function (key, n) {
      if (only && !only.has(key)) return;
      var group = GROUPS.filter(function (g) { return g.key === key; })[0];
      var prepared = preparedList(src[key] || EMPTY_LIST);
      if (!prepared.top) {
        prepared.top = [];
        for (var i = 0; i < prepared.candidates.length; i++) {
          keepBest(prepared.top, prepared.candidates[i], 0, 10, 0);
        }
      }
      var list = prepared.top.slice(0, n);
      if (!list.length) return;
      out.push({
        group: group,
        hits: list.map(function (hit) { return hitRow(hit.candidate, group); })
      });
    };
    var n = only ? 10 : 4;
    take("authors", n);
    take("keywords", n);
    take("categories", only ? n : 3);
    take("venues", only ? n : 3);
    var months = src.months;
    if (months && months.size && (!only || only.has("dates"))) {
      var latest = "";
      months.forEach(function (c, ym) { if (ym > latest) latest = ym; });
      var year = latest.slice(0, 4);
      out.push({
        group: GROUPS[4],
        hits: [
          dateRow({ label: monthLabel(latest), sub: "newest month", count: months.get(latest), operator: "=", value: latest }),
          dateRow({ label: year, sub: "whole year", count: countIn(months, function (ym) { return ym.indexOf(year + "-") === 0; }), operator: "between", value: year + "-01", value2: year + "-12" })
        ]
      });
    }
    return out;
  }

  function init(opts) {
    var facetDisposed = false;
    var facetBlurTimer = null;
    var facetListeners = new AbortController();
    function listen(target, type, handler) {
      target.addEventListener(type, handler, { signal: facetListeners.signal });
    }
    var input = opts.input;
    var anchor = opts.anchor;
    if (!input || !anchor) return null;
    // Scoped mode (rule-builder value inputs): only these groups, and a pick
    // hands the value to the host instead of applying a filter rule.
    var only = Array.isArray(opts.fields) && opts.fields.length ? new Set(opts.fields) : null;
    var valueMode = opts.mode === "value";
    var alignTo = opts.alignTo || null;

    var minChars = function () {
      var n = opts.minChars ? opts.minChars() : 3;
      return Math.max(1, Number(n) || 3);
    };

    var menu = document.createElement("div");
    menu.className = "sf-menu" + (valueMode ? " sf-menu-value" : "");
    // All instances (toolbar and rule values) need distinct menu/option IDs.
    menu.id = "searchFacetMenu-" + (++menuSequence);
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    anchor.appendChild(menu);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", menu.id);
    input.setAttribute("aria-autocomplete", "list");

    var lastQuery = "";
    var scrollerWatched = false;
    var releasePopover = null;

    function close() {
      if (menu.hidden) return;
      menu.hidden = true;
      if (releasePopover) { releasePopover(); releasePopover = null; }
      menu.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function options() { return menu.querySelectorAll(".sf-opt"); }
    function activeOption() { return menu.querySelector(".sf-opt.is-active"); }

    function setActive(i) {
      var opt = options();
      if (!opt.length) return;
      if (i < 0) i = opt.length - 1;
      if (i >= opt.length) i = 0;
      for (var k = 0; k < opt.length; k++) {
        var on = k === i;
        opt[k].classList.toggle("is-active", on);
        opt[k].setAttribute("aria-selected", on ? "true" : "false");
      }
      input.setAttribute("aria-activedescendant", opt[i].id);
      // Keep the active row in view without scrollIntoView (which can move the
      // whole page): nudge the menu's own scrollTop only.
      var el = opt[i], top = el.offsetTop, bottom = top + el.offsetHeight;
      if (top < menu.scrollTop) menu.scrollTop = top;
      else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
    }

    function activeIndex() {
      var opt = options();
      for (var k = 0; k < opt.length; k++) if (opt[k].classList.contains("is-active")) return k;
      return -1;
    }

    function optionHtml(row, needle, idx, isTop) {
      var on = opts.isActive ? !!opts.isActive(row) : false;
      var isTitle = row.kind === "title";
      // Title rows: title + month on the first line, the byline under it; the
      // BibTeX key (the sub, still matched when typed) rides in the tooltip.
      var tip = on ? "Already filtering by this - pick again to remove" : (isTitle ? row.sub : "");
      return '<div class="sf-opt' + (on ? " is-on" : "") + '" role="option" aria-selected="false" ' +
        'id="' + menu.id + '-opt-' + idx + '" ' +
        'data-field="' + esc(row.field) + '" data-op="' + esc(row.operator) + '" ' +
        'data-value="' + esc(row.value) + '" ' +
        (row.value2 ? 'data-value2="' + esc(row.value2) + '" ' : "") +
        (row.consumesQuery ? 'data-consumes="1" ' : "") +
        'data-kind="' + esc(row.kind) + '" data-label="' + esc(row.label) + '" ' +
        'data-sub="' + esc(row.sub || "") + '" ' +
        (tip ? 'title="' + esc(tip) + '"' : "") + ">" +
        '<span class="sf-val">' +
          (isTop || row.kind === "date" ? esc(typeset(row.label))
            : isTitle ? markWords(row.label, row._words || [needle])
            : markLabel(row.label, needle)) +
        "</span>" +
        (isTitle
          ? (row.date ? '<span class="sf-sub">' + esc(row.date) + "</span>" : "")
          : (row.sub ? '<span class="sf-sub">' + esc(row.sub) + "</span>" : "")) +
        (row.count ? '<span class="sf-cnt">' + row.count + "</span>" : "") +
        (on ? icon("check", "sf-on") : "") +
        (isTitle && row.authors ? '<span class="sf-au">' + esc(row.authors) + "</span>" : "") +
        "</div>";
    }

    function paint(sections, needle, isTop, footer) {
      var html = "";
      var idx = 0;
      for (var s = 0; s < sections.length; s++) {
        var sec = sections[s];
        html += '<div class="sf-group"><div class="sf-ghead">' +
          icon(sec.group.kind) + "<span>" + sec.group.head + "</span></div>";
        for (var h = 0; h < sec.hits.length; h++) {
          html += optionHtml(sec.hits[h], needle, idx++, isTop);
        }
        html += "</div>";
      }
      if (!idx) { close(); return false; }
      if (footer) html += '<div class="sf-foot">' + footer + "</div>";
      menu.innerHTML = html;
      menu.hidden = false;
      if (!releasePopover) releasePopover = window.OATheme.popover("facets:" + menu.id, close);
      // The menu is wider than the input when its content needs to be (CSS
      // width: max-content), so cap it against the viewport's right edge -
      // otherwise a narrow window pushes the list off-screen.
      var ref = alignTo || anchor;
      var left = ref.getBoundingClientRect().left;
      var scroller = alignTo ? anchor.closest(".is-tall") : null;
      if (alignTo && scroller) {
        // The condition list is scrolling in a bounded box (many rows): the
        // box would clip an absolutely positioned menu, so pin it to the
        // viewport at the input's edge instead. Scrolling the list closes it.
        var ar = alignTo.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.left = Math.round(ar.left) + "px";
        menu.style.top = Math.round(ar.bottom + 5) + "px";
        menu.style.minWidth = Math.round(ar.width) + "px";
        menu.style.maxHeight = Math.max(120, Math.floor(window.innerHeight - ar.bottom - 16)) + "px";
        left = ar.left;
        if (!scrollerWatched) { scrollerWatched = true; listen(scroller, "scroll", close); }
      } else if (alignTo) {
        // Scoped menus hang off a wider anchor (the rule row): line the list up
        // with the input itself.
        menu.style.position = "";
        menu.style.top = "";
        menu.style.maxHeight = "";
        menu.style.left = alignTo.offsetLeft + "px";
        menu.style.minWidth = alignTo.offsetWidth + "px";
      }
      menu.style.maxWidth = Math.max(240, Math.floor(window.innerWidth - left - 16)) + "px";
      // A value box near the right edge of a phone: the list (240px at the
      // least) ran up to 108px off the screen. Slide it left until it fits,
      // never past the left edge.
      if (alignTo) {
        var over = menu.getBoundingClientRect().right - (window.innerWidth - 8);
        if (over > 0) menu.style.left = (parseFloat(menu.style.left) - Math.min(over, Math.max(0, left - 8))) + "px";
      }
      input.setAttribute("aria-expanded", "true");
      return true;
    }

    var FOOT_TYPED = "\u2191\u2193 ENTER filters \u00b7 SHIFT+ENTER keeps this open \u00b7 ALT excludes";
    var FOOT_TOP = "Most-used filters \u00b7 type to search authors, keywords, categories, venues, dates, titles";
    var FOOT_VALUE = "\u2191\u2193 ENTER picks \u00b7 or keep typing a value";

    // Hits for `raw` across the (scoped) groups. `skip` drops groups that make
    // no sense for a partial query (titles / dates when matching a tail word).
    function buildSections(src, raw, skip) {
      var needle = norm(raw).trim();
      var sections = [];
      if (needle.length < minChars()) {
        if (only && !only.has("dates")) return null;
        var onlyDates = dateRows(raw, src.months);
        return onlyDates.length ? { needle: needle, sections: [{ group: GROUPS[4], hits: onlyDates }] } : null;
      }
      for (var g = 0; g < GROUPS.length; g++) {
        var group = GROUPS[g];
        if (only && !only.has(group.key)) continue;
        if (skip && skip.has(group.key)) continue;
        var hits = group.key === "dates"
          ? dateRows(raw, src.months)
          : group.key === "titles"
            ? matchTitles(src.titles || EMPTY_LIST, needle, group, only ? 10 : TITLES_PER_GROUP)
            : matchList(src[group.key] || EMPTY_LIST, needle, group);
        if (hits.length) {
          sections.push({ group: group, hits: hits, best: hits[0]._r != null ? hits[0]._r : 0, order: g });
        }
      }
      if (!sections.length) return null;
      return { needle: needle, sections: sections };
    }

    // Best match first: a group whose top hit is an exact prefix outranks one
    // that only matched mid-word, so the obvious answer leads. Then the total
    // cap.
    function finishSections(sections) {
      sections.sort(function (a, b) {
        if (a.best !== b.best) return a.best - b.best;
        return a.order - b.order;
      });
      var used = 0;
      for (var s = 0; s < sections.length; s++) {
        if (used >= TOTAL_CAP) { sections.length = s; break; }
        sections[s].hits = sections[s].hits.slice(0, TOTAL_CAP - used);
        used += sections[s].hits.length;
      }
      return sections;
    }

    var TAIL_SKIP = new Set(["titles", "dates"]);

    function render(query, keepIdx) {
      lastQuery = query;
      var src = opts.sources() || {};
      var sections, needle = "", isTop = false, footer = valueMode ? FOOT_VALUE : FOOT_TYPED;
      var raw = String(query || "").trim();
      if (!valueMode && raw.indexOf('"') >= 0) {
        // An explicit quoted phrase is an abstract search, not a filter.
        close();
        return;
      }
      if (!raw) {
        sections = topRows(src, only);
        isTop = true;
        if (!valueMode) footer = FOOT_TOP;
      } else {
        // The whole query first (it matches multi-word labels like "Cement and
        // Concrete Composites"); then, for a short query, the LAST WORD alone is
        // merged in underneath - so "shotcrete nozzle" offers both the titles
        // that contain the phrase and the Nozzle categories. Titles and dates
        // are whole-query only (a tail word inside a title is noise). A
        // sentence-length research question is left to the abstract search.
        var built = buildSections(src, raw);
        var words = raw.split(/\s+/);
        var tail = words[words.length - 1];
        var merged = built ? built.sections : [];
        if (words.length <= 3 && tail && tail !== raw && !valueMode) {
          var tailBuilt = buildSections(src, tail, TAIL_SKIP);
          if (tailBuilt) {
            for (var t = 0; t < tailBuilt.sections.length; t++) {
              var ts = tailBuilt.sections[t];
              var have = null;
              for (var m = 0; m < merged.length; m++) if (merged[m].group.key === ts.group.key) { have = merged[m]; break; }
              if (!have) {
                ts.best += 3;                   // whole-query groups lead
                merged.push(ts);
                continue;
              }
              var seen = {};
              for (var h = 0; h < have.hits.length; h++) seen[have.hits[h].field + "\u0001" + have.hits[h].value] = true;
              for (h = 0; h < ts.hits.length && have.hits.length < PER_GROUP + 2; h++) {
                var key = ts.hits[h].field + "\u0001" + ts.hits[h].value;
                if (!seen[key]) { seen[key] = true; have.hits.push(ts.hits[h]); }
              }
            }
          }
        }
        if (!merged.length) { close(); return; }
        sections = finishSections(merged);
        needle = built ? built.needle : norm(tail).trim();
      }
      var scroll = menu.scrollTop;
      if (!paint(sections, needle, isTop, footer)) return;
      if (keepIdx != null && keepIdx >= 0) {
        menu.scrollTop = scroll;
        setActive(Math.min(keepIdx, options().length - 1));
      } else {
        menu.scrollTop = 0;
        input.removeAttribute("aria-activedescendant");
      }
    }

    // What is left of the query once the pick has consumed the words it was
    // found by: "shotcrete nozzle wear" + category "Nozzle Geometry" leaves
    // "shotcrete wear" to search inside the new filter, while "mahdaoui" +
    // that author leaves nothing (so the box clears).
    function residualQuery(query, opt) {
      if (opt.dataset.consumes) return "";
      var q = String(query || "").trim();
      if (!q || q.indexOf('"') >= 0) return q;    // never mangle a quoted phrase
      // A title found by its full BibTeX key: the key WAS the query.
      if (opt.dataset.kind === "title" && norm(q) === norm(opt.dataset.value || "")) return "";
      var labelWords = norm((opt.dataset.label || "") + " " + (opt.dataset.sub || ""))
        .split(/[^a-z0-9]+/).filter(Boolean);
      function consumed(part) {
        for (var i = 0; i < labelWords.length; i++) {
          if (labelWords[i] === part) return true;
          if (part.length >= 3 && labelWords[i].indexOf(part) === 0) return true;
        }
        return false;
      }
      // Split each typed word at punctuation exactly as the label was split, so
      // "sael_titt_casp" or "3d-printed" compares part by part; a word is used
      // up only when every part of it is.
      var kept = q.split(/\s+/).filter(function (w) {
        var parts = norm(w).split(/[^a-z0-9]+/).filter(Boolean);
        return parts.length > 0 && !parts.every(consumed);
      });
      return kept.join(" ");
    }

    // The pick reads its rule off the option's own data attributes rather than
    // an index into the last render, so a re-render between paint and click
    // can't silently drop it.
    function choose(opt, mods) {
      if (!opt || !opt.dataset || !opt.dataset.value) return;
      mods = mods || {};
      var rule = {
        field: opt.dataset.field,
        operator: opt.dataset.op,
        value: opt.dataset.value,
        value2: opt.dataset.value2 || null,
        kind: opt.dataset.kind,
        label: opt.dataset.label || opt.dataset.value,
        negate: !!mods.negate
      };
      if (valueMode) {
        // Scoped value pick: the host writes the value into its row; no
        // residual query, no stacking.
        close();
        if (opts.apply) opts.apply(rule);
        return;
      }
      var residual = residualQuery(lastQuery, opt);
      var keep = !!mods.keep;
      var idx = keep ? activeIndex() : -1;
      if (!keep) close();
      if (opts.apply) opts.apply(rule);
      if (opts.onApply) opts.onApply(rule, { residual: residual, keepOpen: keep });
      if (keep) {
        // Stacking mode: repaint so the row shows its new applied state and
        // the counts/marks stay honest, and hold the caret where it was.
        render(input.value, idx);
        input.focus();
      }
    }

    listen(input, "input", function () { render(input.value); });
    // Deliberately NOT on focus: the box is focused programmatically (entering
    // the table, the "/" shortcut), and a menu that opens by itself on load is
    // noise. A click into the box, or ArrowDown, asks for it.
    listen(input, "click", function () { if (menu.hidden) render(input.value); });
    listen(input, "keydown", function (e) {
      if (menu.hidden) {
        if (e.key === "ArrowDown") { e.preventDefault(); render(input.value); setActive(0); }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(activeIndex() + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex() - 1);
      } else if (e.key === "Enter") {
        var opt = activeOption();
        if (opt) {
          e.preventDefault();
          e.stopPropagation();
          choose(opt, { negate: e.altKey, keep: e.shiftKey });
        }
      } else if (e.key === "Escape") {
        // Close the menu but keep the typed query - Escape a second time is
        // the browser's own "clear the search field".
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        close();
      }
    });
    // mousedown only guards focus (the input must not blur and tear the menu
    // down mid-gesture); the pick itself happens on click.
    listen(menu, "mousedown", function (e) {
      if (e.target.closest && e.target.closest(".sf-opt")) e.preventDefault();
    });
    listen(menu, "click", function (e) {
      var opt = e.target.closest ? e.target.closest(".sf-opt") : null;
      if (!opt) return;
      e.preventDefault();
      choose(opt, { negate: e.altKey, keep: e.shiftKey });
    });
    listen(menu, "mousemove", function (e) {
      var opt = e.target.closest ? e.target.closest(".sf-opt") : null;
      if (!opt || opt.classList.contains("is-active")) return;
      var all = options();
      for (var k = 0; k < all.length; k++) if (all[k] === opt) { setActive(k); return; }
    });
    // "Inside" = the input or the menu itself. The scoped (rule row) menu's
    // anchor is the whole row, whose other controls must still close it.
    function inside(el) {
      return valueMode ? (el === input || menu.contains(el)) : anchor.contains(el);
    }
    // Every listener belongs to this menu, including input listeners when
    // the host reuses its toolbar input across controller replacements.
    function onDocMouseDown(e) {
      if (!menu.hidden && !inside(e.target)) close();
    }
    listen(document, "mousedown", onDocMouseDown);
    listen(input, "blur", function () {
      if (facetBlurTimer != null) window.clearTimeout(facetBlurTimer);
      facetBlurTimer = window.setTimeout(function () {
        facetBlurTimer = null;
        if (!facetDisposed && document.activeElement !== input && !inside(document.activeElement)) close();
      }, 0);
    });

    return {
      close: close,
      open: function () { if (!facetDisposed && menu.hidden) render(input.value); },
      refresh: function () { if (!facetDisposed && !menu.hidden) render(input.value, activeIndex()); },
      destroy: function () {
        if (facetDisposed) return;
        facetDisposed = true;
        facetListeners.abort();
        if (facetBlurTimer != null) window.clearTimeout(facetBlurTimer);
        facetBlurTimer = null;
        close();
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      }
    };
  }

  window.OASearchFacets = { init: init };
})();
