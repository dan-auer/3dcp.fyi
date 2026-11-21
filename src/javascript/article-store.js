/* article-store.js - immutable bibliographic metadata and dataset-derived indexes.
 * Requires bibliography.js (window.OABibliography). JSON exports remain
 * caller-owned and unfrozen. Replacing ARTICLES_DATA, CATEGORY_DEFS or
 * AUTHORS_DATA rebuilds the snapshot; createView() supplies mutable rows for
 * DataView and search text attachment (and maps back to the same snapshot).
 * ponytail: rebuilds on a changed object only - add a revision key if anything
 * ever edits those exports in place.
 *
 * Construction is a sequence of bounded steps. get() runs whatever is left
 * synchronously (the API every caller already has); prepare() runs the same
 * steps in ~8 ms slices between tasks, so the first table can be set up
 * without one long main-thread block. Indexes only secondary views need - the
 * in-corpus citation graph (author panel), the category counts and the
 * facet-menu sources - are built on first use, not at construction.
 */
(function (global) {
  "use strict";

  var EMPTY_ROWS = Object.freeze([]), EMPTY_DEFS = Object.freeze({});
  var sources = new WeakMap();   // createView() rows -> the source they copy
  var owns = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  var codeOf = function (value) { return String(value || "").replace(/^\s*\u2022\s*/, "").trim().toUpperCase(); };
  var monthOf = function (value) {
    var match = /^(\d{4})-(\d{1,2})(?:$|-)/.exec(String(value || ""));
    return match && +match[2] >= 1 && +match[2] <= 12 ? +match[1] * 12 + +match[2] - 1 : null;
  };
  // Author entries are slug strings or { id | slug, ... } objects.
  var authorIdOf = function (author) {
    var id = typeof author === "string" ? author : author && (author.id || author.slug);
    return id ? String(id) : "";
  };
  var monthLabel = function (month) {
    return String(Math.floor(month / 12)).padStart(4, "0") + "-" + String(month % 12 + 1).padStart(2, "0");
  };
  // monthOf, but a year-only date ("2024") counts as its January; null without a year.
  var monthOfOrYear = function (value) {
    var month = monthOf(value);
    if (month != null) return month;
    var year = /^(\d{4})(?:$|-)/.exec(String(value || ""));
    return year ? +year[1] * 12 : null;
  };
  // This month (local time) as a month index.
  var currentMonth = function () { var now = new Date(); return now.getFullYear() * 12 + now.getMonth(); };
  // Missing exported metrics must stay distinct from a measured zero.
  function metricNumber(value) {
    if (typeof value === "string" ? !value.trim() : typeof value !== "number") return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  // Deep-frozen copy. `seen` is shared across a whole build: it guards cycles
  // and shared references, and one WeakMap is far cheaper than one per record.
  function snapshot(value, seen) {
    if (!value || typeof value !== "object") return value;
    var cached = seen.get(value);
    if (cached) return cached;
    var result, i;
    if (Array.isArray(value)) {
      result = new Array(value.length);
      seen.set(value, result);
      for (i = 0; i < value.length; i++) result[i] = snapshot(value[i], seen);
    } else {
      result = Object.create(null);
      seen.set(value, result);
      var keys = Object.keys(value);
      for (i = 0; i < keys.length; i++) result[keys[i]] = snapshot(value[keys[i]], seen);
    }
    return Object.freeze(result);
  }
  // Freezing a Map/Set does not freeze its entries. Expose read operations only.
  function readSet(set) {
    var result = { size: set.size, has: function (key) { return set.has(key); },
      values: function () { return set.values(); }, keys: function () { return set.keys(); },
      entries: function () { return set.entries(); },
      forEach: function (visit, self) { set.forEach(function (value) { visit.call(self, value, value, result); }); } };
    result[Symbol.iterator] = result.values;
    return Object.freeze(result);
  }
  function readMap(map) {
    var result = { size: map.size, has: function (key) { return map.has(key); },
      get: function (key) { return map.get(key); }, keys: function () { return map.keys(); },
      values: function () { return map.values(); }, entries: function () { return map.entries(); },
      forEach: function (visit, self) { map.forEach(function (value, key) { visit.call(self, value, key, result); }); } };
    result[Symbol.iterator] = result.entries;
    return Object.freeze(result);
  }
  function increment(map, key) { map.set(key, (map.get(key) || 0) + 1); }
  function authorLabel(author) {
    var name = global.OABibliography.resolveAuthorName(author);
    var id = authorIdOf(author);
    // "Family, Given" - the form the table's Authors column shows.
    var label = [name.family, name.given].filter(Boolean).join(", ") || String(id);
    var suffix = /_(jr|sr|iv|iii|ii)(?:_\d+)?$/i.exec(id);
    if (suffix) label += ", " + ({ jr: "Jr.", sr: "Sr.", ii: "II", iii: "III", iv: "IV" })[suffix[1].toLowerCase()];
    return label;
  }
  function labelKey(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  // Records per step. Measured at ~20 us (snapshot) and ~15 us (indexing) per
  // record, so a step stays well under a 16 ms frame budget.
  var SNAPSHOT_CHUNK = 400, INDEX_CHUNK = 600, LABEL_CHUNK = 1500;

  // A build is a list of steps over shared closure state. finish() runs the
  // rest synchronously; step() runs one unit (for the sliced scheduler).
  function createBuild(source, definitions, authorDefinitions) {
    var normalizer = global.OABibliography && global.OABibliography.normalizeDoi;
    if (typeof normalizer !== "function") throw new Error("Article store requires OABibliography.normalizeDoi");
    var normalizeDoi = function (doi) { return String(normalizer(doi) || "").toLowerCase(); };

    /* ---- step 1: snapshot records + definitions (sliced) ---- */
    var rawRows = source.filter(function (row) { return row && typeof row === "object"; });
    var snapped = new Array(rawRows.length), seen = new WeakMap();
    var records = null;
    function snapshotRange(from, to) {
      for (var i = from; i < to && i < rawRows.length; i++) {
        snapped[i] = snapshot(uniqueAuthors(global.OABibliography.normalizeRecord(rawRows[i])), seen);
      }
    }
    // A few records list the same person twice (same id, same name - a data
    // error); every view reads the list with the repeats dropped.
    function uniqueAuthors(row) {
      var list = row.authors;
      if (!Array.isArray(list) || list.length < 2) return row;
      var ids = new Set(), kept = list.filter(function (a) {
        var id = authorIdOf(a);
        if (!id) return true;
        if (ids.has(id)) return false;
        ids.add(id);
        return true;
      });
      return kept.length === list.length ? row : Object.assign({}, row, { authors: kept });
    }
    var defs = Object.create(null);
    function snapshotDefinitions() {
      records = Object.freeze(snapped);
      Object.keys(definitions).forEach(function (key) { defs[codeOf(key)] = snapshot(definitions[key], seen); });
      Object.freeze(defs);
    }

    /* ---- step 2: category taxonomy ---- */
    var categoryChains = new Map(), branches = new Map(), categoryRows = new WeakMap();
    var rowOrigins = new WeakMap();
    function categoryAncestors(value) {
      var code = codeOf(value);
      if (categoryChains.has(code)) return categoryChains.get(code);
      var chain = [], visited = new Set(), current = code;
      while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        var parent = defs[current] && codeOf(defs[current].parent);
        current = parent && defs[parent] ? parent : "";
      }
      var result = Object.freeze(chain);
      categoryChains.set(code, result);
      return result;
    }
    function categoryStep() {
      Object.keys(defs).forEach(function (code) {
        categoryAncestors(code).forEach(function (ancestor) {
          if (!branches.has(ancestor)) branches.set(ancestor, new Set());
          branches.get(ancestor).add(code);
        });
      });
      branches.forEach(function (set, key) { branches.set(key, readSet(set)); });
    }
    function categoryDescendants(value) {
      var code = codeOf(value);
      if (!branches.has(code)) branches.set(code, readSet(new Set(code ? [code] : [])));
      return branches.get(code);
    }
    function categoryCodes(article) {
      if (!article || typeof article !== "object") return EMPTY_ROWS;
      var row = rowOrigins.get(article) || article;
      if (!categoryRows.has(row)) categoryRows.set(row, Object.freeze(Array.from(new Set(
        (Array.isArray(row.categories) ? row.categories : []).map(codeOf).filter(Boolean)))));
      return categoryRows.get(row);
    }

    /* ---- step 3: record pass (sliced): ids, months, authors, keywords, venues ---- */
    var byId = new Map(), byDoi = new Map(), authorWorks = new Map(), authors = new Map();
    var keywordCounts = new Map(), venueCounts = new Map(), months = new Map();
    var publicationMonths = new Map(), authorFirstMonth = new Map();
    var minMonth = Infinity, maxMonth = -Infinity, minYear = Infinity, maxYear = -Infinity, crossReferences = 0, referencesComplete = true;
    function indexRecord(article) {
      if (article.id != null && !byId.has(String(article.id))) byId.set(String(article.id), article);
      var doi = normalizeDoi(article.doi);
      if (doi && !byDoi.has(doi)) byDoi.set(doi, article);
      var month = monthOf(article.date);
      var year = /^(\d{4})/.exec(String(article.date || ""));
      if (year) { minYear = Math.min(minYear, +year[1]); maxYear = Math.max(maxYear, +year[1]); }
      if (month != null) {
        minMonth = Math.min(minMonth, month);
        maxMonth = Math.max(maxMonth, month);
        increment(months, monthLabel(month));
        increment(publicationMonths, month);
      }
      var referenceCount = metricNumber(article.references);
      if (referenceCount == null || referenceCount < 0) referencesComplete = false;
      else crossReferences += referenceCount;
      var seenAuthors = new Set();
      (Array.isArray(article.authors) ? article.authors : []).forEach(function (author) {
        var id = typeof author === "string" && owns(authorDefinitions, author)
          ? author : author && (author.id || author.slug);
        if (!id) return;
        id = String(id);
        if (seenAuthors.has(id)) return;
        seenAuthors.add(id);
        if (!authors.has(id)) { authors.set(id, author); authorWorks.set(id, []); }
        authorWorks.get(id).push(article);
        if (month != null && (!authorFirstMonth.has(id) || month < authorFirstMonth.get(id))) authorFirstMonth.set(id, month);
      });
      new Set(Array.isArray(article.keywords) ? article.keywords : []).forEach(function (value) {
        var keyword = String(value || "");
        if (keyword) increment(keywordCounts, keyword);
      });
      if (article.venue) increment(venueCounts, String(article.venue));
    }
    function indexRange(from, to) {
      for (var i = from; i < to && i < records.length; i++) indexRecord(records[i]);
    }

    /* ---- lazy: in-corpus citation graph (author panel only) ---- */
    // Built from a.refIds (a cites b); citedByOf is its inverse. Only ids that
    // resolve to a row in this store count.
    var citesOf = new Map(), citedByOf = new Map(), edgeCount = 0, graphBuilt = false;
    function addEdge(from, to) {
      if (from === to || !byId.has(from) || !byId.has(to)) return;
      if (!citesOf.has(from)) citesOf.set(from, new Set());
      if (citesOf.get(from).has(to)) return;
      citesOf.get(from).add(to);
      if (!citedByOf.has(to)) citedByOf.set(to, new Set());
      citedByOf.get(to).add(from);
      edgeCount++;
    }
    function ensureGraph() {
      if (graphBuilt) return;
      graphBuilt = true;
      records.forEach(function (article) {
        var id = String(article.id);
        (Array.isArray(article.refIds) ? article.refIds : []).forEach(function (ref) { addEdge(id, String(ref)); });
      });
    }

    // In-corpus neighbourhood sizes for one article - what a REFERENCES_OF /
    // CITATIONS_OF / SIMILAR_TO rule on it lists (similar = related rows that
    // are neither cited nor referenced, as compileRelationRule filters them).
    // null for an unknown id. Powers the graph tiles' hover counts.
    var neighbourCache = new Map();
    function neighbourCounts(id) {
      ensureGraph();
      id = String(id);
      if (neighbourCache.has(id)) return neighbourCache.get(id);
      var me = byId.get(id), result = null;
      if (me) {
        var refs = citesOf.get(id) || new Set(), cites = citedByOf.get(id) || new Set(), similar = new Set();
        (Array.isArray(me.relatedIds) ? me.relatedIds : []).forEach(function (x) {
          x = String(x);
          if (x !== id && byId.has(x) && !refs.has(x) && !cites.has(x)) similar.add(x);
        });
        result = Object.freeze({ references: refs.size, citations: cites.size, similar: similar.size });
      }
      neighbourCache.set(id, result);
      return result;
    }

    /* ---- lazy: category counts (facet menus) ---- */
    var categoryCounts = new Map(), topicsBuilt = false;
    function ensureTopics() {
      if (topicsBuilt) return;
      topicsBuilt = true;
      records.forEach(function (article) {
        var all = new Set();   // the article's categories and every ancestor, once each
        categoryCodes(article).forEach(function (code) { categoryAncestors(code).forEach(function (c) { all.add(c); }); });
        all.forEach(function (code) { increment(categoryCounts, code); });
      });
    }

    // People lists for the author panel: "cites most" / "cited by" from the
    // authors of the rows this author's works reference / are referenced by.
    // [{ id, count, papers, theirs, prefix, lastName, firstName }] sorted by
    // count, then name; the author themself is skipped.
    // count = citation INSTANCES (one per own-paper -> their-paper edge);
    // papers = the DISTINCT own papers behind them, which is what a
    // CITES_AUTHOR / CITED_BY_AUTHOR filter lists; theirs = the DISTINCT
    // papers of the listed person on the other end.
    // excludeOverlap drops a link when either paper has both people on it -
    // the listed person on the counted paper, or this author on theirs
    // (Engel citing Engel through a paper co-written with Hendricks) - so the
    // tally is citations between separate author teams. Only the first half is
    // a rule (AUTHOR IS NOT them), which the count links carry; the second is
    // not expressible, so such a link can list a few more papers than counted.
    function tallyPeople(self, works, neighbours, excludeOverlap) {
      var counts = new Map(), ownWorks = new Map(), theirWorks = new Map();
      works.forEach(function (work) {
        var ownId = String(work.id), ownAuthors = null;
        if (excludeOverlap) {
          ownAuthors = new Set();
          (Array.isArray(work.authors) ? work.authors : []).forEach(function (author) {
            var authorId = authorIdOf(author);
            if (authorId) ownAuthors.add(authorId);
          });
        }
        // Edges only join rows of this store, so every target resolves.
        (neighbours(work) || []).forEach(function (targetId) {
          var target = byId.get(targetId), people = Array.isArray(target.authors) ? target.authors : [];
          if (ownAuthors && people.some(function (a) { return authorIdOf(a) === self; })) return;
          var seenIds = new Set();
          people.forEach(function (author) {
            var id = authorIdOf(author);
            if (!id || id === self || seenIds.has(id) || (ownAuthors && ownAuthors.has(id))) return;
            seenIds.add(id);
            increment(counts, id);
            if (!ownWorks.has(id)) { ownWorks.set(id, new Set()); theirWorks.set(id, new Set()); }
            ownWorks.get(id).add(ownId);
            theirWorks.get(id).add(String(target.id));
          });
        });
      });
      // Labels are resolved ONCE per candidate before sorting: the comparator
      // runs O(n log n) times and resolving both labels inside it dominated the
      // first profile render for well-connected authors.
      var decorated = Array.from(counts, function (entry) {
        var id = entry[0], author = authors.get(id), person = author && typeof author === "object" ? author : {};
        return { label: author ? authorLabel(author) : id, row: Object.freeze({ id: id, count: entry[1],
          papers: ownWorks.get(id).size, theirs: theirWorks.get(id).size,
          prefix: person.prefix || "", lastName: person.lastName || "", firstName: person.firstName || "" }) };
      });
      decorated.sort(function (a, b) { return b.row.count - a.row.count || a.label.localeCompare(b.label); });
      return Object.freeze(decorated.map(function (d) { return d.row; }));
    }

    /* ---- step 4: author labels + facets (sliced: ~10k authors) ---- */
    var authorEntries = null, facets = null, authorList = null, sameNames = null, authorNameKeys = null;
    function labelsStart() {
      authorList = Array.from(authors);
      authorEntries = new Array(authorList.length);
      authorNameKeys = new Array(authorList.length);
      sameNames = new Map();
    }
    function labelRange(from, to) {
      for (var i = from; i < to && i < authorList.length; i++) {
        var id = authorList[i][0], label = authorLabel(authorList[i][1]), key = labelKey(label);
        authorNameKeys[i] = key;
        increment(sameNames, key);
        authorEntries[i] = { id: id, label: label, count: authorWorks.get(id).length };
      }
    }
    function labelsFinish() {
      // Slug -> plain "Lastname, Firstname" for display (filter text, rule
      // inputs); only the pick list keeps the " · slug" that tells namesakes apart.
      var slugLabels = authorEntries.map(function (entry) { return Object.freeze({ id: entry.id, label: entry.label, count: entry.count }); });
      authorEntries.forEach(function (entry, index) {
        if (sameNames.get(authorNameKeys[index]) > 1) entry.label += " \u00b7 " + entry.id;
        Object.freeze(entry);
      });
      // These construction-only name tables must not stay in the store closure.
      authorList = authorNameKeys = sameNames = null;
      // Exact IDs remain values. Colliding names never hide a second person.
      facets = Object.freeze({ authors: Object.freeze(authorEntries), authorSlugLabels: Object.freeze(slugLabels),
        keywords: Object.freeze(Array.from(keywordCounts.keys())), venues: Object.freeze(Array.from(venueCounts.keys())) });
    }
    // Facet-menu sources: built on the first menu open, not at construction.
    var facetSourcesCache = null;
    function facetSources() {
      if (facetSourcesCache) return facetSourcesCache;
      ensureTopics();
      var toCounted = function (map) { return Object.freeze(Array.from(map, function (entry) {
        return Object.freeze({ label: entry[0], value: entry[0], count: entry[1] });
      })); };
      facetSourcesCache = Object.freeze({
        authors: Object.freeze(authorEntries.map(function (entry) { return Object.freeze({
          label: entry.label, value: entry.id, count: entry.count }); })),
        keywords: toCounted(keywordCounts), venues: toCounted(venueCounts), months: readMap(months),
        categories: Object.freeze(Object.keys(defs).map(function (code) {
          var def = defs[code] || {};
          return Object.freeze({ label: def.title || code, sub: ((def.num || "") + " \u00b7 " + code).trim(),
            value: code, count: categoryCounts.get(code) || 0 });
        })),
        // Title rows also carry the byline the menu prints under the title -
        // surnames with an initial, at most four, all five rather than four
        // and a "+1" that takes about the fifth name's room - and the month,
        // so two same-titled papers (preprint / journal) tell apart at a glance.
        titles: Object.freeze(records.map(function (article) {
          var people = Array.isArray(article.authors) ? article.authors : [];
          var shown = people.length === 5 ? 5 : 4;
          var names = people.slice(0, shown).map(function (a) {
            var surname = [a && a.prefix, a && a.lastName].filter(Boolean).join(" ");
            var initial = a && a.firstName ? String(a.firstName).trim().charAt(0) : "";
            return (surname + (initial ? ", " + initial + "." : "")).trim();
          }).filter(Boolean);
          if (people.length > shown) names.push("+" + (people.length - shown));
          return Object.freeze({ label: article.title, sub: article.id, value: article.id,
            date: String(article.date || "").slice(0, 7), authors: names.join("; ") });
        }))
      });
      return facetSourcesCache;
    }

    /* ---- step 5: summary, axis, store object ---- */
    var store = null;
    function finalize() {
      var areas = 0, categories = 0, subcategories = 0;
      Object.keys(defs).forEach(function (code) { var lvl = defs[code] && defs[code].level; if (lvl === 1) areas++; else if (lvl === 2) categories++; else if (lvl === 3) subcategories++; });
      var summary = records.length ? Object.freeze({ articles: records.length, authors: authors.size, keywords: keywordCounts.size,
        areas: areas || null, categories: categories || null, subcategories: subcategories || null,
        crossReferences: referencesComplete ? crossReferences : null, yearFrom: isFinite(minYear) ? minYear : null,
        yearTo: isFinite(maxYear) ? maxYear : null, updated: isFinite(maxMonth) ? monthLabel(maxMonth) : null }) : null;
      var axis = Object.freeze({ first: isFinite(minMonth) ? minMonth : 1997 * 12 + 1,
        last: isFinite(maxMonth) ? maxMonth : 1997 * 12 + 1,
        length: isFinite(minMonth) ? maxMonth - minMonth + 1 : 1 });
      var cumulative = null;
      var authorSummaries = new Map();
      function cumulativeSeries() {
        if (cumulative || !isFinite(minMonth)) return cumulative;
        var authorMonths = new Map();
        authorFirstMonth.forEach(function (month) { increment(authorMonths, month); });
        var publications = [], authorCounts = [], totalP = 0, totalA = 0;
        for (var month = minMonth; month <= maxMonth; month++) {
          totalP += publicationMonths.get(month) || 0;
          totalA += authorMonths.get(month) || 0;
          publications.push(totalP);
          authorCounts.push(totalA);
        }
        cumulative = Object.freeze({ start: monthLabel(minMonth), publications: Object.freeze(publications), authors: Object.freeze(authorCounts) });
        return cumulative;
      }
      function resolve(ids) {
        return (Array.isArray(ids) ? ids : []).map(function (id) { return byId.get(String(id)); }).filter(Boolean);
      }
      // Author revisits share one immutable aggregate for this store.
      // Explicit profile article lists retain their order, duplicates and subset
      // semantics; missing lists use the existing per-author membership index.
      function authorSummary(id) {
        id = String(id);
        if (authorSummaries.has(id)) return authorSummaries.get(id);
        ensureGraph();
        var profile = owns(authorDefinitions, id) ? authorDefinitions[id] : null;
        var works = profile && Array.isArray(profile.articles) ? resolve(profile.articles) : authorWorks.get(id) || EMPTY_ROWS;
        // Span at month resolution; citations = the counts on record (known ones).
        var first = null, last = null, citations = 0;
        works.forEach(function (work) {
          var ym = work.date ? String(work.date).slice(0, 7) : "";
          if (ym) { if (first == null || ym < first) first = ym; if (last == null || ym > last) last = ym; }
          var k = metricNumber(work.citations);
          if (k > 0) citations += k;
        });
        var cites = function (work) { return citesOf.get(String(work.id)); };
        var citedBy = function (work) { return citedByOf.get(String(work.id)); };
        var result = Object.freeze({ span: Object.freeze({ first: first, last: last }), citations: citations,
          works: Object.freeze(works),
          citesMost: tallyPeople(id, works, cites), citedBy: tallyPeople(id, works, citedBy),
          // Same two tallies with shared-authorship pairs removed; the author
          // panel's "exclude shared authors" switch reads these.
          citesMostSolo: tallyPeople(id, works, cites, true), citedBySolo: tallyPeople(id, works, citedBy, true) });
        authorSummaries.set(id, result);
        return result;
      }
      function createView() {
        var view = records.map(function (row) { var copy = Object.assign({}, row); rowOrigins.set(copy, row); return copy; });
        sources.set(view, source);
        return view;
      }
      store = Object.freeze({ metricNumber: metricNumber, records: records, definitions: defs,
        getById: function (id) { return byId.get(String(id)) || null; },
        findByDoi: function (doi) { return byDoi.get(normalizeDoi(doi)) || null; },
        resolve: resolve,
        hasCitationGraph: function () { ensureGraph(); return edgeCount > 0; }, neighbourCounts: neighbourCounts,
        // In-corpus neighbours as read-only Sets: what an article cites / what cites it.
        referencesOf: function (id) { ensureGraph(); return readSet(citesOf.get(String(id)) || new Set()); },
        citationsOf: function (id) { ensureGraph(); return readSet(citedByOf.get(String(id)) || new Set()); },
        facets: function () { return facets; }, facetSources: facetSources,
        categoryDescendants: categoryDescendants, categoryCodes: categoryCodes,
        summary: function () { return summary; }, cumulativeSeries: cumulativeSeries,
        monthAxis: function () { return axis; }, authorSummary: authorSummary, createView: createView });
    }

    /* ---- the step list ---- */
    var steps = [];
    for (var s = 0; s < rawRows.length; s += SNAPSHOT_CHUNK) steps.push(snapshotRange.bind(null, s, s + SNAPSHOT_CHUNK));
    steps.push(snapshotDefinitions, categoryStep);
    for (var r = 0; r < rawRows.length; r += INDEX_CHUNK) steps.push(indexRange.bind(null, r, r + INDEX_CHUNK));
    // The author count is only known after the record pass; label in slices of
    // LABEL_CHUNK from a self-extending step until the list is exhausted.
    var labelledTo = 0, at = 0;
    function labelStep() {
      labelRange(labelledTo, labelledTo + LABEL_CHUNK);
      labelledTo += LABEL_CHUNK;
      if (labelledTo < authorList.length) steps.splice(at, 0, labelStep);
    }
    steps.push(labelsStart, labelStep, labelsFinish, finalize);
    function step() { steps[at++](); }
    return {
      get store() { return store; },
      step: step,
      finish: function () { while (!store) step(); return store; }
    };
  }

  // Run a build in slices of about 8 ms between tasks. setTimeout(0)
  // (not rAF) so input/paint can interleave; a synchronous get() meanwhile
  // just finishes the same build. A HIDDEN document (background tab, the page
  // opened via middle-click) has no paint or input to yield to, and browsers
  // throttle its timer chains to one tick a second - later one a minute - so
  // ~20 slices would take the whole hidden period: run the rest in one go.
  function runSliced(build) {
    return new Promise(function (resolve, reject) {
      (function tick() {
        try {
          var deadline = performance.now() + 8;
          while (!build.store && (document.hidden || performance.now() < deadline)) build.step();
        } catch (error) { reject(error); return; }
        if (build.store) resolve(build.store);
        else setTimeout(tick, 0);
      })();
    });
  }

  // The one build for the current exports (one dataset per page).
  var current = null;
  function entry() {
    var input = global.ARTICLES_DATA, defs = global.CATEGORY_DEFS;
    var source = Array.isArray(input) ? (sources.get(input) || input) : EMPTY_ROWS;
    var definitions = defs && typeof defs === "object" ? defs : EMPTY_DEFS;
    var authorDefinitions = global.AUTHORS_DATA || EMPTY_DEFS;
    if (!current || current.source !== source || current.definitions !== definitions || current.authorDefinitions !== authorDefinitions) {
      current = { source: source, definitions: definitions, authorDefinitions: authorDefinitions,
        build: createBuild(source, definitions, authorDefinitions), promise: null };
    }
    return current;
  }
  // Synchronous: the finished store, completing any in-progress sliced build.
  function get() { return entry().build.finish(); }
  // Asynchronous: the same store, built in bounded slices. Callers that can
  // wait (the table's dependency loading) use this; get() stays valid throughout.
  function prepare() {
    var e = entry();
    return e.promise || (e.promise = runSliced(e.build));
  }
  // The date and author-id readings every view shares - month arithmetic lives
  // here only: monthOf / monthOfOrYear (date -> month index), monthLabel (index
  // -> "YYYY-MM"), currentMonth (today's index).
  global.OAArticleStore = Object.freeze({ get: get, prepare: prepare, metricNumber: metricNumber, monthOf: monthOf,
    monthOfOrYear: monthOfOrYear, monthLabel: monthLabel, currentMonth: currentMonth, authorIdOf: authorIdOf });
})(window);
