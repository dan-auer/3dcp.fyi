/* author-footer.js - the summary row under the article table (#authorFooter).
 *
 * It shows while the filter is one plain rule and nothing else: AUTHOR IS a
 * real slug (the state an author short link lands in), VENUE IS, CATEGORY IS a
 * known category, or KEYWORD IS. Column by column it sums up the works on
 * screen: activity on the caret and Date tracks; under Article the works
 * (for an author, a table by position and type); the top co-authors (or
 * authors) under Authors; a topic's top journals under Venue; categories and
 * keywords (co-categories / co-keywords for a topic) under theirs; the
 * citation total under Citations. Blocks whose column is not showing stack
 * under Article. Every value is the filter affordance the cells use, and the
 * cells sit on the live column tracks, so they line up with the table.
 *
 * create(ctx) takes the grid's helpers and returns { host, sync }; the grid
 * calls sync(filteredItems) after each refresh and on a column change.
 * aggregate() is the counting, free of the DOM, so it is unit-tested
 * (tests/unit/author-footer.test.mjs).
 */
(function () {
  "use strict";

  // The counts behind the footer, in one pass over the filter's works (one
  // record per id). opts: slug - the author whose co-authors are counted (null:
  // every author counts); topic - count journals (category / keyword footers);
  // catCode + catDefs - co-categories at that category's level; kwSelf - the
  // keyword left out of co-keywords; normalize, authorIdOf, metricNumber,
  // categoryCodes - the grid's own readings of a record.
  function aggregate(arts, opts) {
    const slug = opts.slug ?? null, kwSelf = opts.kwSelf ?? null;
    const catCode = opts.catCode || "", catDefs = opts.catDefs || {};
    const normalizeText = opts.normalize, authorIdOf = opts.authorIdOf, metricNumber = opts.metricNumber, categoryCodes = opts.categoryCodes;
    let first = "", last = "", cites = 0, missingCites = 0;
    // Author position per work, mutually exclusive, summing to the works count:
    // [first of several, last of several, sole author, neither (co-author)],
    // with the citations those works drew (posMiss: works lacking a count)
    // and their ids by record type: [journal article, contribution].
    const posCites = [0, 0, 0, 0], posMiss = [0, 0, 0, 0], posTypeIds = [[[], []], [[], []], [[], []], [[], []]];
    const coCount = new Map(), coAuthor = new Map(), catCount = new Map(), kwCount = new Map();
    // A topic's journals (journal articles only), keyed like the VENUE rule
    // matches; a keyword's co-keywords leave out the keyword itself. A
    // category's co-categories are counted at its own level, each over its
    // whole branch as its chip filters - the count is what the click keeps.
    const venCount = new Map(), venName = new Map();
    const catLevel = catCode ? catDefs[catCode].level : 0;
    const atLevel = function (c) {
      for (let k = String(c).toUpperCase(), n = 0; k && catDefs[k] && n < 8; k = catDefs[k].parent, n++) if (catDefs[k].level === catLevel) return k;
      return null;
    };
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i];
      const d = String(a.date || "");
      if (d) { if (!first || d < first) first = d; if (!last || d > last) last = d; }
      // Record type: "JournalArticle" vs "Contribution" (conference paper or
      // book chapter) - the same split bibliography.js uses for @article vs
      // @inproceedings / @incollection.
      const t = /^journal/i.test(String(a.type || "")) ? 0 : 1;
      const citationCount = metricNumber(a.citations);
      if (citationCount == null || citationCount < 0) missingCites++;
      else cites += citationCount;
      const aus = a.authors || [];
      let pos = -1;
      aus.forEach(function (au, j) {
        const sid = authorIdOf(au);
        if (!sid) return;
        if (slug !== null && normalizeText(sid) === slug) { if (pos < 0) pos = j; return; }
        coCount.set(sid, (coCount.get(sid) || 0) + 1);
        if (!coAuthor.has(sid)) coAuthor.set(sid, au);
      });
      if (pos >= 0) {
        const p = aus.length === 1 ? 2 : pos === 0 ? 0 : pos === aus.length - 1 ? 1 : 3;
        posTypeIds[p][t].push(a.id);
        if (citationCount == null || citationCount < 0) posMiss[p]++;
        else posCites[p] += citationCount;
      }
      if (catCode) {
        const co = new Set();
        categoryCodes(a).forEach(function (c) { const k = atLevel(c); if (k && k !== catCode) co.add(k); });
        co.forEach(function (k) { catCount.set(k, (catCount.get(k) || 0) + 1); });
      } else categoryCodes(a).forEach(function (c) { catCount.set(c, (catCount.get(c) || 0) + 1); });
      if (opts.topic && t === 0 && a.venue) {
        const vk = normalizeText(a.venue);
        venCount.set(vk, (venCount.get(vk) || 0) + 1);
        if (!venName.has(vk)) venName.set(vk, String(a.venue));
      }
      // Sigil-insensitive like the KEYWORD IS matcher: "rheology" also drops "#rheology" / "$rheology".
      (a.keywords || []).forEach(function (k) {
        if (kwSelf !== null) { const nk = normalizeText(k); if (nk === kwSelf || nk.replace(/^[#$]/, "") === kwSelf) return; }
        kwCount.set(k, (kwCount.get(k) || 0) + 1);
      });
    }
    return { first: first, last: last, cites: cites, missingCites: missingCites, posCites: posCites, posMiss: posMiss,
      posTypeIds: posTypeIds, coCount: coCount, coAuthor: coAuthor, catCount: catCount, kwCount: kwCount,
      venCount: venCount, venName: venName };
  }

  function create(ctx) {
    const { FIELDS, applyDateCellFilter, articleStore, authorIdOf, authorLinkHtml, authorSlugToLabel, columnLayoutKey, conditionToString, countFormat, dataView, dateModeFromKey, escapeHtml, grid, layout, normalizeText, renderers, ruleEditor, ruleLanguage, ruleTree, scope, searchController, toggleFieldRule, wireDateAuxButtons } = ctx;
    // A footer shows only for one plain "<field> is <value>" rule and nothing
    // else: any other live rule (a second rule, an OR, a negation, brackets)
    // hides it.
    function solePlainRule() {
      const live = ruleTree.rows.filter(function (r) { return !r.disabled && conditionToString(r) !== ""; });
      const r = live.length === 1 ? live[0] : null;
      return r && r.operator === "is" && !ruleLanguage.rowIsNegated(r) && !(r.openParens | 0) && !(r.closeParens | 0) &&
        String(r.value || "").trim() ? r : null;
    }
    const footerHost = document.getElementById("authorFooter");
    let _footerKey = "";
    // The stats table reads in counts or in shares of all the author's works;
    // the choice is remembered.
    const STATS_REL_KEY = "oa-stats-relative";
    let statsRelative = window.OAPrefs.get(STATS_REL_KEY) === "1";
    const STATS_PCT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M16 17a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M6 7a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M6 18l12 -12"></path></svg>';
    function setStatsRelative(on) {
      statsRelative = !!on;
      window.OAPrefs.set(STATS_REL_KEY, statsRelative ? "1" : "0");
      const tab = footerHost.querySelector(".af-xtab");
      if (!tab) return;
      tab.classList.toggle("is-rel", statsRelative);
      tab.querySelector(".af-x-mode").setAttribute("aria-pressed", String(statsRelative));
    }
    // Every footer (author, venue, topic) folds to its label band with the
    // caret in the caret track. It opens unfolded each time it appears -
    // folded on a phone, where open it left the table two articles of room
    // (not during the guided tour, whose summary stop reads it); a fold or an
    // unfold lasts until the filter changes.
    let footerFolded = false;
    const FOLD_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"></path></svg>';
    function setFooterFolded(on) {
      footerFolded = !!on;
      footerHost.classList.toggle("is-folded", footerFolded);
      footerHost.querySelector(".af-fold").setAttribute("aria-expanded", String(!footerFolded));
      layout.requestResize();
    }
    function syncAuthorFooter(filteredItems) {
      const host = footerHost;
      const sole = solePlainRule(), sv = sole ? String(sole.value).trim() : "";
      const catDefs = window.CATEGORY_DEFS || {};
      // Only a real slug names ONE author: a typed surname ("bos") matches every
      // author with that name, who would be listed as their own co-author.
      const authorRule = sole && sole.field === FIELDS.AUTHOR && authorSlugToLabel.has(sv) ? sole : null;
      const categoryRule = sole && sole.field === FIELDS.CATEGORY && catDefs[sv.toUpperCase()] ? sole : null;
      const keywordRule = sole && sole.field === FIELDS.KEYWORD ? sole : null;
      const topicRule = categoryRule || keywordRule;
      const rule = authorRule || topicRule || (sole && sole.field === FIELDS.VENUE ? sole : null);
      const items = filteredItems || dataView.getFilteredItems();
      if (!rule || searchController.query || !items.length) {
        if (!host.hidden) { host.hidden = true; host.innerHTML = ""; _footerKey = ""; layout.requestResize(); }
        return;
      }
      // The author whose co-authors are counted; none for a venue (every
      // author counts).
      const slug = authorRule ? normalizeText(rule.value) : null;
      // One article per id (category grouping holds a row per assignment).
      const seen = new Set(), arts = items.filter(function (a) { return !seen.has(a.id) && seen.add(a.id); });
      const key = rule.field + "|" + normalizeText(rule.value) + "|" + arts.length + "|" + (arts[0] && arts[0].id) + "|" + ruleEditor.queryForUrl();
      const cols = grid.getColumns();
      const widthKey = columnLayoutKey();
      if (key === _footerKey && host.dataset.widths === widthKey && !host.hidden && host.childElementCount) return;
      // A new filter, or the footer shown again: unfolded, or folded on a phone.
      if (key !== _footerKey) footerFolded = !!(window.matchMedia && window.matchMedia("(max-width: 560px)").matches) && !(window.OATour && window.OATour.isOpen());
      _footerKey = key;
      host.dataset.widths = widthKey;

      const { first, last, cites, missingCites, posCites, posMiss, posTypeIds, coCount, coAuthor, catCount, kwCount, venCount, venName } = aggregate(arts, {
        slug: slug, topic: !!topicRule, catCode: categoryRule ? sv.toUpperCase() : "", catDefs: catDefs,
        kwSelf: keywordRule ? normalizeText(keywordRule.value) : null,
        normalize: normalizeText, authorIdOf: authorIdOf, metricNumber: articleStore.metricNumber, categoryCodes: articleStore.categoryCodes
      });
      const top = function (map, n) {
        return Array.from(map.entries()).sort(function (x, y) { return y[1] - x[1] || String(x[0]).localeCompare(String(y[0])); }).slice(0, n);
      };
      const nChip = function (n) { return '<span class="af-n">' + countFormat.format(n) + "</span>"; };
      const cell = {};   // column id -> [label, value HTML]
      // Activity: first / latest month (both filter affordances, as the date
      // cells), the span between them, and how long since the latest - each a
      // Tabler glyph + value, the wording in the tooltip and for screen readers.
      const monthIndex = window.OAArticleStore.monthOfOrYear;
      // Years and months on separate lines (HTML: parts escaped, joined by <br>).
      const spanText = function (months, zero) {
        if (months <= 0) return escapeHtml(zero);
        const y = Math.floor(months / 12), m = months % 12, parts = [];
        if (y) parts.push(y + (y === 1 ? " year" : " years"));
        if (m) parts.push(m + (m === 1 ? " month" : " months"));
        return parts.join("<br>");
      };
      const AF_ICON = {
        first: '<path d="M9 4h-4v16h4"></path><path d="M18 16h-.01"></path><path d="M14 16h-.01"></path><path d="M10 16h-.01"></path>',
        last: '<path d="M14 4h4v16h-4"></path><path d="M5 16h.01"></path><path d="M9 16h.01"></path><path d="M13 16h.01"></path>',
        span: '<path d="M7 4h-4v16h4"></path><path d="M17 4h4v16h-4"></path><path d="M8 16h.01"></path><path d="M12 16h.01"></path><path d="M16 16h.01"></path>',
        since: '<path d="M13 21h-7a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6.5"></path><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M4 11h16"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path>'
      };
      const afIcon = function (key) {
        return '<svg class="af-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + AF_ICON[key] + "</svg>";
      };
      const afMonthLink = function (ym, label) {
        return '<span class="date-link filter-affordance" role="button" tabindex="0" data-date="' + escapeHtml(ym) + '" title="' + label + '&#10;Click: filter by ' + escapeHtml(ym) + '&#10;Middle-click: filter since ' + escapeHtml(ym) + '&#10;Right-click: filter by ' + escapeHtml(ym.slice(0, 4)) + '">' + escapeHtml(ym) + "</span>";
      };
      const afRow = function (key, label, valueHtml) {
        return '<span class="af-span-row" role="group" aria-label="' + label + '" title="' + label + '">' + afIcon(key) + valueHtml + "</span>";
      };
      // The Activity block is keyed on the 30px caret track and overflows into
      // the fixed tracks after it (Date by default, else the empty star / access
      // cells). On phones grid-layout sheds all three and Article follows the
      // caret directly: no room, so the block is left out rather than printed
      // over "Statistics of N Works".
      const activityRoom = cols.length > 1 && (cols[1].id === "date" || cols[1].id === "favorite" || cols[1].id === "openAccess");
      if (first && activityRoom) {
        const activeFor = spanText(monthIndex(last) - monthIndex(first), "< 1 month");
        const lastActive = spanText(window.OAArticleStore.currentMonth() - monthIndex(last), "this month");
        const firstLabel = authorRule ? "First contribution" : "First work", lastLabel = authorRule ? "Latest contribution" : "Latest work";
        cell.expand = ["Activity", '<span class="af-span">' +
          afRow("first", firstLabel, afMonthLink(first.slice(0, 7), firstLabel)) +
          afRow("last", lastLabel, afMonthLink(last.slice(0, 7), lastLabel)) +
          afRow("span", "Active for", '<span class="af-span-v">' + activeFor + "</span>") +
          afRow("since", "Last active", '<span class="af-span-v">' + lastActive + "</span>") +
          "</span>"];
      }
      // Works by author position (rows) x record type (columns), with row and
      // column totals. Headers are the filter affordances: a position filters
      // to its works by BibTeX key, a type by record type; so are the non-zero
      // counts (a cell: its position AND type; a total: its row / column).
      // A position's citations live in its row tooltip.
      if (authorRule) {
        const xLink = function (cls, data, tip, text) {
          return '<span class="' + cls + ' filter-affordance" role="button" tabindex="0" ' + data + ' title="' + tip + '">' + text + "</span>";
        };
        const worksTip = function (n) { return "Click: filter to " + (n === 1 ? "this work" : "these " + countFormat.format(n) + " works") + " by BibTeX key"; };
        const xCell = function (n, tot, link) {
          const cls = (tot ? "af-x-tot" : "") + (n ? "" : (tot ? " " : "") + "af-x0");
          // Both readings ride in every cell; the table's .is-rel shows one.
          const pct = !n ? "0%" : (100 * n / arts.length < 1 ? "<1%" : Math.round(100 * n / arts.length) + "%");
          const v = '<span class="af-x-v"><span class="af-x-abs">' + countFormat.format(n) + '</span><span class="af-x-rel">' + escapeHtml(pct) + "</span></span>";
          return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + (n && link ? link(v) : v) + "</td>";
        };
        // [position, row label (under the "Authorship" line), full name, description]
        const POS_ROWS = [[0, "First", "First author", "First of several authors"], [2, "Single", "Single author", "Sole author"],
          [3, "Co", "Co-author", "Neither first nor last author"], [1, "Last", "Last author", "Last of several authors"]];
        const TYPE_COLS = [["JournalArticle", "Journal Articles", "Journal Article"], ["Contribution", "Contributions", "Contribution"]];
        const colSum = [0, 0];
        let xBody = '<tr class="af-x-group"><th scope="rowgroup" colspan="4">Authorship</th></tr>';
        POS_ROWS.forEach(function (r) {
          const i = r[0], ids = posTypeIds[i], n = ids[0].length + ids[1].length, c = posCites[i], miss = posMiss[i];
          let tip = r[2] + ": " + r[3].charAt(0).toLowerCase() + r[3].slice(1), head = r[1];
          if (n) {
            tip += "&#10;" + (miss ? "\u2265\u2009" : "") + countFormat.format(c) + (c === 1 ? " citation" : " citations");
            if (miss) tip += ": " + countFormat.format(miss) + (miss === 1 ? " work has" : " works have") + " no citation count and " + (miss === 1 ? "is" : "are") + " not included";
            tip += "&#10;" + worksTip(n);
            head = '<span class="af-pos-link filter-affordance" role="button" tabindex="0" data-pos="' + i + '">' + head + "</span>";
          }
          colSum[0] += ids[0].length; colSum[1] += ids[1].length;
          const typeCell = function (t) {
            return xCell(ids[t].length, false, function (v) {
              return xLink("af-pos-link", 'data-pos="' + i + '" data-t="' + t + '"', r[2] + ", " + TYPE_COLS[t][1] + "&#10;" + worksTip(ids[t].length), v);
            });
          };
          xBody += '<tr><th scope="row" title="' + tip + '">' + head + "</th>" + typeCell(0) + typeCell(1) +
            xCell(n, true, function (v) { return xLink("af-pos-link", 'data-pos="' + i + '"', tip, v); }) + "</tr>";
        });
        const typeTotal = function (t) {
          return xCell(colSum[t], false, function (v) {
            return xLink("af-type-link", 'data-type="' + TYPE_COLS[t][0] + '"', "Click: filter by " + TYPE_COLS[t][2], v);
          });
        };
        const xHead = TYPE_COLS.map(function (d, t) {
          return '<th scope="col">' + (colSum[t] ? '<span class="af-type-link filter-affordance" role="button" tabindex="0" data-type="' + d[0] + '" title="Click: filter by ' + d[2] + '">' + d[1] + "</span>" : d[1]) + "</th>";
        }).join("");
        cell.title = ["Statistics of " + countFormat.format(arts.length) + (arts.length === 1 ? " Work" : " Works"),
          '<table class="af-xtab' + (statsRelative ? " is-rel" : "") + '" aria-label="Works by author position and type">' +
            '<thead><tr><td class="af-x-corner"><button type="button" class="af-x-mode" aria-pressed="' + statsRelative + '"' +
              ' aria-label="Show shares of all works" title="Show shares of all works (%)">' + STATS_PCT_ICON + "</button></td>" + xHead + '<th scope="col" class="af-x-tot">Total</th></tr></thead>' +
            "<tbody>" + xBody + "</tbody>" +
            '<tfoot><tr><th scope="row">Total</th>' + typeTotal(0) + typeTotal(1) + xCell(colSum[0] + colSum[1], true) + "</tr></tfoot>" +
          "</table>"];
      } else {
        // A venue or a category has no authorship table: its works and authors
        // head the row.
        cell.title = [countFormat.format(arts.length) + (arts.length === 1 ? " Work" : " Works") +
          " by " + countFormat.format(coCount.size) + (coCount.size === 1 ? " Author" : " Authors"), ""];
      }
      const co = top(coCount, 5);
      cell.authors = co.length
        ? [authorRule ? "Co-Authors" : "Authors", '<span class="af-list">' + co.map(function (e) {
            return '<span class="af-item">' + authorLinkHtml(coAuthor.get(e[0]), false) + nChip(e[1]) + "</span>";
          }).join("") + "</span>"]
        : null;
      const vens = topicRule ? top(venCount, 3) : [];
      cell.venue = vens.length
        ? ["Journals", '<span class="af-list">' + vens.map(function (e) {
            return '<span class="af-item">' + renderers.venueLinkHtml(venName.get(e[0]), false) + nChip(e[1]) + "</span>";
          }).join("") + "</span>"]
        : null;
      const cats = keywordRule ? [] : top(catCount, 5).filter(function (e) { return !!catDefs[e[0]]; });
      cell.category = cats.length
        ? [categoryRule ? "Co-Categories" : "Categories", '<span class="af-list category-cell">' + cats.map(function (e) {
            return '<span class="af-item">' + renderers.categoryChipHtml(e[0]) + nChip(e[1]) + "</span>";
          }).join("") + "</span>"]
        : null;
      const kws = categoryRule ? [] : top(kwCount, 5);
      cell.keywords = kws.length
        ? [keywordRule ? "Co-Keywords" : "Keywords", '<span class="af-list">' + kws.map(function (e) {
            return '<span class="af-item">' + renderers.keywordLinkHtml(String(e[0])) + nChip(e[1]) + "</span>";
          }).join("") + "</span>"]
        : null;
      // One paper without a count used to blank the whole total; show the sum
      // of the known counts as a lower bound instead.
      const counted = arts.length - missingCites;
      const citationTitle = !missingCites
        ? countFormat.format(cites) + " citations across " + countFormat.format(arts.length) + " articles"
        : !counted
          ? "Citation counts unavailable for all " + countFormat.format(arts.length) + " articles"
          : "At least " + countFormat.format(cites) + " citations: " + countFormat.format(missingCites) + " of " + countFormat.format(arts.length) + " articles have no citation count and are not included";
      cell.citations = ["Citations", '<span class="af-total" title="' + citationTitle + '">' +
        (!counted ? "Unavailable" : (missingCites ? "\u2265\u2009" : "") + countFormat.format(cites)) + "</span>"];

      // Lay the cells on the live columns: a label row (set like the column
      // header) and a value row beneath it. Cells without content stay empty so
      // the track structure (and the alignment) never changes.
      let tracks = "", labels = "", values = "";
      // A topic or venue footer heads the Article track with one line and
      // leaves its value row empty: the blocks whose own column is not showing
      // (shed by the width or switched off) stack there instead of vanishing.
      if (!authorRule) {
        const shown = new Set(cols.map(function (c) { return c.id; }));
        cell.title[1] += ["category", "keywords", "citations"].map(function (id) {
          return shown.has(id) || !cell[id] ? "" : '<div class="af-sub af-sub-' + id + '"><span class="af-sublabel">' + cell[id][0] + "</span>" + cell[id][1] + "</div>";
        }).join("");
      }
      for (let i = 0; i < cols.length; i++) {
        tracks += (cols[i].width | 0) + "px ";
        // The Activity block is keyed on the 30px caret column so it starts at
        // the table's left edge; it spans the Date track too when that is the
        // next column (the default order), otherwise it overflows into the
        // empty star / access tracks (see activityRoom above).
        const spans = cols[i].id === "expand" && cell.expand && cols[i + 1] && cols[i + 1].id === "date";
        if (spans) tracks += (cols[i + 1].width | 0) + "px ";
        const p = cell[cols[i].id] || ["", ""];
        const cls = 'class="af-cell af-cell-' + escapeHtml(cols[i].id) + (spans ? ' af-cell-span2" style="grid-column: span 2"' : '"');
        const fold = i === 0 ? '<button type="button" class="af-fold" aria-controls="afValues" aria-expanded="' + !footerFolded + '" aria-label="Summary" title="Fold or show the summary">' + FOLD_SVG + "</button>" : "";
        labels += '<div ' + cls + '>' + fold + (p[0] ? '<span class="af-label">' + p[0] + "</span>" : "") + "</div>";
        values += '<div ' + cls + '>' + p[1] + "</div>";
        if (spans) i++;
      }
      host.style.setProperty("--af-tracks", tracks.trim());
      // Position lists for the position labels' click (wireAuthorFooter).
      host.oaPos = authorRule ? { author: rule.value, cells: posTypeIds } : null;
      host.innerHTML = '<div class="af-row af-row-labels">' + labels + '</div><div class="af-row af-row-values" id="afValues">' + values + "</div>";
      host.classList.toggle("is-folded", footerFolded);
      const wasHidden = host.hidden;
      host.hidden = false;
      fitStatsTable(host);
      if (wasHidden) layout.requestResize();
    }
    // The stats table keeps its labels on one line while it fits beside the
    // co-author list; in a narrower Article column every label wraps at once
    // (.is-compact), so the rows stay alike instead of running into the list.
    function fitStatsTable(host) {
      const tab = !host.hidden && host.querySelector(".af-xtab");
      const cell = tab && tab.closest(".af-cell");
      if (!cell) return;
      tab.classList.remove("is-compact");
      const cs = getComputedStyle(cell);
      const room = cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (tab.getBoundingClientRect().width > room + 0.5) tab.classList.add("is-compact");
    }
    (function wireAuthorFooter() {
      const host = footerHost;
      scope.observe(new window.ResizeObserver(scope.guard(function () { fitStatsTable(host); }))).observe(host);
      function act(el, dateMode) {
        if (el.classList.contains("keyword-link")) toggleFieldRule("keyword", "is", el.dataset.keyword);
        else if (el.classList.contains("oa-cat-chip")) toggleFieldRule("category", "is", el.dataset.category);
        else if (el.classList.contains("author-link")) toggleFieldRule("author", "is", el.dataset.author);
        else if (el.classList.contains("venue-link")) toggleFieldRule("venue", "is", el.dataset.venue);
        else if (el.classList.contains("date-link")) applyDateCellFilter(el.dataset.date, dateMode);
        else if (el.classList.contains("af-type-link")) toggleFieldRule("type", "is", el.dataset.type);
        else if (el.classList.contains("af-pos-link")) applyPositionFilter(Number(el.dataset.pos), el.dataset.t);
      }
      // Author position has no rule field of its own, so a position label spells
      // its works out: AUTHOR IS <author> AND (ID IS <key> OR ID IS <key> ...).
      // t ("0" journal / "1" contribution): just that cell of the cross-table.
      function applyPositionFilter(i, t) {
        const pos = host.oaPos, cells = pos && pos.cells[i], ids = cells && (t == null ? cells[0].concat(cells[1]) : cells[Number(t)]);
        if (!ids || !ids.length) return;
        const cond = function (field, value) { return ruleLanguage.conditionToString({ field: field, operator: "is", value: value }); };
        ruleEditor.loadQuery(cond("author", pos.author) + " AND (" + ids.map(function (id) { return cond("id", id); }).join(" OR ") + ")");
        ruleEditor.change();
        // The spelled-out ID list is long; keep the panel shut (Filters shows it).
        ruleEditor.setOpen(false);
      }
      scope.listen(host, "click", function (event) {
        if (event.target.closest(".af-fold")) { event.preventDefault(); setFooterFolded(!footerFolded); return; }
        if (event.target.closest(".af-x-mode")) { event.preventDefault(); setStatsRelative(!statsRelative); return; }
        const el = event.target.closest(".keyword-link, .oa-cat-chip, .author-link, .venue-link, .date-link, .af-type-link, .af-pos-link");
        if (!el) return;
        if (event.button !== 0 || event.shiftKey) return;
        if ((event.ctrlKey || event.metaKey) && el.hasAttribute("href")) return;   // browser: new tab
        event.preventDefault();
        act(el, "month");
      });
      scope.listen(host, "keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const el = event.target.closest(".oa-cat-chip, .venue-link, .date-link, .af-type-link, .af-pos-link");
        if (!el) return;
        event.preventDefault();
        act(el, dateModeFromKey(event));
      });
      wireDateAuxButtons(host);
    })();
    return { host: footerHost, sync: syncAuthorFooter };
  }

  window.OAAuthorFooter = Object.freeze({ aggregate: aggregate, create: create });
})();
