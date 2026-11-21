/* grid-renderers.js - grid columns and reusable article presentation.
 * Classic script; load before buildGrid, after bibliography/theme/store.
 * create({theme, bibliography, articleStore, rel, countFormat, state}) owns a
 * table lifetime's memoized presentation. state exposes live service getters
 * (favorites, canCite, hasAuthorFilter, visitedGen) and behavior adapters
 * (authorIsActive, authorIsVisited, sharedAuthorNames, chevronFormatter). It
 * must not snapshot services or filter state that can change after grid
 * construction.
 * The controller owns rules, model/search state, events and DOM measurement.
 */
(function (root) {
  "use strict";
  function create(options) {
    const theme = options.theme, bibliography = options.bibliography;
    const articleStore = options.articleStore, articles = articleStore.records;
    const REL = options.rel, countFormat = options.countFormat, state = options.state;
    const escapeHtml = theme.escapeHtml;
    // CO2 -> CO₂, m3 -> m³ (oa-typeset.js) for text a reader sees; data-* and
    // hrefs keep the dataset's spelling.
    const typeset = window.OATypeset.text;

    /* Every filter affordance in the table advertises itself the same way:
       "Click: <what a plain click does>", then the RMB clause on its own line. A
       chip gets the SAME tip wherever it renders (a cell, the author footer),
       because it behaves the same in both. No modifier-click or middle-button
       shortcuts of our own: the two buttons carry the actions, and on the real
       links the browser's new-tab gestures (Ctrl / Cmd + click, middle-click)
       still work. */
    // Author lines the cell holds: five on a 22px pitch, four on a touch screen,
    // whose 24px pitch (articles.css) fills the same 120px row with four.
    const AUTHOR_LINES = window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches ? 4 : 5;
    // Width an author line loses to the cell padding and the two mark slots
    // (the marks sit 2px further apart on a touch screen, articles.css), and
    // the width of a name's average character. With one line fewer, a touch
    // screen counts characters wider (measured over 180 rows: 6.8px cut the
    // last name of 21 cells, 7.2px of 16, as many as five lines did before).
    const NAME_INSET = AUTHOR_LINES === 4 ? 44 : 40;
    const CHAR_PX = AUTHOR_LINES === 4 ? 7.2 : 6.8;
    // Phones (560px and narrower, as in rule-editor.js and author-footer.js):
    // the Authors column is ~130px and the two mark slots left a name ~80px,
    // so most names took two lines and a cell showed one name and "+N". There
    // the cells drop the marks and shorten given names to initials ("Zhu, B.");
    // the "+N" list and the pinned article's full list keep both. The inset is
    // then the cell's own padding.
    const PHONE_MQ = window.matchMedia ? window.matchMedia("(max-width: 560px)") : null;
    const COMPACT_INSET = 8;
    function compactAuthors() { return !!(PHONE_MQ && PHONE_MQ.matches); }
    const CHIP_TIP = {
      keyword:  "Click: filter by this keyword\nRight-click: add with OR (another Topic Trends series)",
      category: "\nClick: filter by this category\nRight-click: add with OR (another Topic Trends series)",
      venue:    "Click: filter by this venue",
      access:   "\nClick: filter by this access status"
    };

    const SUMMARY_ORDER = ["authors", "venue", "date", "category", "keywords", "citations", "openAccess", "favorite"];
    const SUMMARY_LABELS = { authors: "Authors", venue: "Venue", date: "Date", category: "Category", keywords: "Keywords", citations: "Citations", openAccess: "Access", favorite: "Favorite" };
    // Cache name adapters per author object. The author store is resolved once
    // per table lifetime, shared by display, matching, and bibliography helpers.
    const resolvedAuthorNames = new WeakMap();
    function resolvedAuthorName(author) {
      if (!author || typeof author !== "object") return bibliography.resolveAuthorName(author);
      let name = resolvedAuthorNames.get(author);
      if (!name) {
        name = bibliography.resolveAuthorName(author);
        resolvedAuthorNames.set(author, name);
      }
      return name;
    }
    function authorSurname(author) { return resolvedAuthorName(author).family; }
    function authorDisplayName(author) {
      const name = resolvedAuthorName(author);
      return [name.family, name.given].filter(Boolean).join(", ");
    }
    function authorAlternateDisplayName(author) {
      const name = resolvedAuthorName(author);
      return [name.given, name.family].filter(Boolean).join(" ");
    }
    // "Jean-Pierre Ali" -> "J.-P. A." (the rule cite-format.js uses).
    function givenInitials(given) {
      return String(given || "").trim().split(/\s+/).map(function (part) {
        return part.split("-").map(function (s) { return s ? s.charAt(0).toUpperCase() + "." : ""; }).join("-");
      }).join(" ");
    }
    // The phone cells' name: initials after a surname; a name without one stays whole.
    function authorShortName(author) {
      const name = resolvedAuthorName(author);
      return [name.family, name.family ? givenInitials(name.given) : name.given].filter(Boolean).join(", ");
    }

    function formatAuthorNameWithBoldLastName(author, compact) {
      const surname = authorSurname(author);
      const givenName = compact && surname !== "" ? givenInitials(resolvedAuthorName(author).given) : resolvedAuthorName(author).given;

      let html = "";

      if (surname !== "") {
        html += "<strong>" + escapeHtml(surname) + "</strong>";
      }

      if (givenName !== "") {
        html += (html === "" ? "" : ", ") + escapeHtml(givenName);
      }

      return html;
    }

    // ORCID lives on the author record (data/author_data.js, keyed by the same
    // id as authors[].id), never on the paper. Rendered as its own small link
    // in front of the name so the name click still filters, and the glyph
    // opens the registry entry.
    function authorOrcidHtml(author) {
      const store = root.AUTHORS_DATA;
      const id = author && (author.id || author.slug);
      const rec = store && id && Object.prototype.hasOwnProperty.call(store, id) ? store[id] : null;
      const orcid = rec && typeof rec.orcid === "string" ? rec.orcid.trim() : "";
      if (!orcid || !root.OATheme || !root.OATheme.ORCID_SVG) {
        // No ORCID: an empty glyph slot keeps the name column aligned.
        return '<span class="author-orcid author-orcid--none" aria-hidden="true"></span>';
      }
      return (
        '<a class="author-orcid" href="https://orcid.org/' + escapeHtml(orcid) + '" ' +
        'target="_blank" rel="noopener" title="ORCID ' + escapeHtml(orcid) + '" ' +
        'aria-label="ORCID ' + escapeHtml(orcid) + '">' + root.OATheme.ORCID_SVG + "</a>"
      );
    }

    // Affiliation and ROR live on the author record too (affiliation: the name;
    // ror: one or more ROR IDs, with or without https://ror.org/). A building
    // glyph beside the ORCID one: a link to the first ROR record, or just the
    // name as a tooltip when there is no ROR. An author with neither keeps the
    // slot empty, so every list's names start in the same column.
    function authorRecord(author) {
      const store = root.AUTHORS_DATA;
      const id = author && (author.id || author.slug);
      return store && id && Object.prototype.hasOwnProperty.call(store, id) ? store[id] : null;
    }
    function authorAffiliation(author) {
      const rec = authorRecord(author);
      const name = rec && typeof rec.affiliation === "string" ? rec.affiliation.trim() : "";
      const rors = rec && typeof rec.ror === "string"
        ? rec.ror.split(/[\s,;]+/).map(function (s) { return s.replace(/^(https?:\/\/)?ror\.org\//i, ""); }).filter(Boolean)
        : [];
      return name || rors.length ? { name: name, rors: rors } : null;
    }
    function hasAffiliation(author) { return !!authorAffiliation(author); }
    function authorAffHtml(author) {
      const aff = root.OATheme && root.OATheme.AFF_SVG ? authorAffiliation(author) : null;
      if (!aff) return '<span class="author-aff author-aff--none" aria-hidden="true"></span>';
      const label = "Affiliation: " + (aff.name || "ROR " + aff.rors.join(", "));
      const tip = escapeHtml(aff.name || "Affiliation") + (aff.rors.length ? "&#10;ROR " + escapeHtml(aff.rors.join(", ")) : "");
      if (!aff.rors.length) return '<span class="author-aff" role="img" title="' + tip + '" aria-label="' + escapeHtml(label) + '">' + root.OATheme.AFF_SVG + "</span>";
      return '<a class="author-aff" href="https://ror.org/' + escapeHtml(aff.rors[0]) + '" target="_blank" rel="noopener" title="' + tip + '" ' +
        'aria-label="' + escapeHtml(label) + '">' + root.OATheme.AFF_SVG + "</a>";
    }

    // compact: a phone's author cell - no marks, initials (authorsFormatter).
    function authorLinkHtml(author, matched, compact) {
      // The href is the author's own list (a real, copyable address); a plain
      // left-click is intercepted to toggle a Rule Builder filter matched on
      // the author's slug (slugs are indexed in _authorExactSet), the right
      // button makes them the list's one author - which shows their metrics
      // beside the table. The title spells out the per-button behaviour.
      // .is-visited: the author's metrics were shown before (see articles-grid.js
      // markAuthorVisited); the CSS greys it unless the link is also a match.
      const visited = !!(state.authorIsVisited && state.authorIsVisited(author));
      return (
        '<span class="author-row">' +
        (compact ? "" : authorOrcidHtml(author) + authorAffHtml(author)) +
        '<a class="html-link author-link filter-affordance' + (matched ? " is-author-match" : "") + (visited ? " is-visited" : "") + '" ' +
        'href="' + escapeHtml(authorUrl(author)) + '" ' +
        'title="Click: filter by this author&#10;Right-click: this author, with metrics" ' +
        'data-author="' + escapeHtml((author.id || author.slug) || "") + '">' +
        formatAuthorNameWithBoldLastName(author, compact) +
        "</a></span>"
      );
    }

    // The per-article pages are gone: an article's own view IS the list
    // pinned to it (ID IS "<key>" - the state the crumb's short link names),
    // so that is what the title links to.
    function articleUrl(article) {
      return REL + 'index.html?q=' + encodeURIComponent('ID IS "' + article.id + '"');
    }

    // An author's own view IS the list filtered to them (AUTHOR IS "<slug>"),
    // with their metrics beside the table, so that is what the name links to.
    function authorUrl(author) {
      return REL + 'index.html?q=' + encodeURIComponent('AUTHOR IS "' + (author.id || author.slug || "") + '"');
    }

    function keywordUrl(keyword) {
      // Keyword subpages were removed; a keyword now IS a filter on this list.
      return REL + "index.html?q=" + encodeURIComponent('keyword = "' + keyword + '"');
    }

    function doiUrl(doi) {
      return "https://doi.org/" + doi;
    }

    // Leftmost disclosure chevron. Delegates to the shared abstract overlay so
    // the markup / open-state styling match every grid on the site. While a
    // REFERENCES_OF / CITATIONS_OF / SIMILAR_TO rule anchors the list, a row
    // sharing an author with the anchor article stacks the users glyph under
    // the chevron (names in the tooltip), as the article page's ref / cite
    // grids do.
    function expandFormatter(row, cell, value, columnDef, item) {
      const chevron = state.chevronFormatter(row, cell, value, columnDef, item);
      if (!chevron) return chevron;
      const names = state.sharedAuthorNames(item);
      if (!names.length) return chevron;
      const label = (names.length === 1 ? "Shared author: " : "Shared authors: ") + names.join("; ");
      return chevron + '<span class="oa-shared-au" role="img" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + USERS_SVG + "</span>";
    }

    // TeX glyph for the per-row BibTeX download (Tabler "tex").
    const TEX_SVG =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M9 8v-1h-6v1"></path><path d="M6 15v-8"></path><path d="M21 15l-5 -8"></path><path d="M16 15l5 -8"></path><path d="M14 11h-4v8h4"></path><path d="M10 15h3"></path></svg>';

    // Users glyph (two heads) for the shared-authorship indicator - same glyph as
    // the article page's reference / citation grids.
    const USERS_SVG =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path></svg>';

    function favoriteFormatter(row, cell, value, columnDef, item) {
      if (!item || item.__group || item.__groupTotals || !item.id) {
        return "";
      }
      if (!state.favorites) return "";
      // Star, then the two buttons that take the citation away: copy the
      // formatted reference, download BibTeX. The access column keeps the
      // lock and the PDF.
      return '<div class="fav-stack">' +
        state.favorites.buttonHtml(item.id, { extraClass: "fav-grid" }) +
        (state.canCite
          ? '<button type="button" class="oa-cite-btn" data-cite-id="' + escapeHtml(item.id) + '"' +
              ' aria-label="Copy the formatted reference" title="Copy the formatted reference">' + CITE_SVG + "</button>" +
            '<button type="button" class="oa-cite-btn oa-bib-btn" data-bib-id="' + escapeHtml(item.id) + '"' +
              ' title="Download BibTeX (.bib)" aria-label="Download the BibTeX entry for this article">' + TEX_SVG + "</button>"
          : "") +
        "</div>";
    }

    // Category chips (central store src/category_data.js), keyed by
    // abbreviation; `full` prints the title instead. Tooltip: title + click hints.
    function categoryChipHtml(abbr, full) {
      const def = articleStore.definitions[abbr];
      if (!def) return "";
      return '<span class="oa-cat-chip' + (full ? ' oa-cat-chip-full' : '') + ' filter-affordance" role="button" tabindex="0" style="' +
        escapeHtml(theme.catVars(def.color)) + '" data-category="' + escapeHtml(abbr) +
        // The name starts with what the chip shows (its code, or its title on a
        // full chip): a voice command naming the code reaches it (WCAG 2.5.3).
        '" aria-label="' + escapeHtml(full ? (def.title || abbr) : abbr + ", " + (def.title || abbr)) + ': filter by this category' +
        '" title="' + escapeHtml(typeset(def.title || "")) + CHIP_TIP.category + '">' +
        escapeHtml(full ? typeset(def.title || abbr) : abbr) + "</span>";
    }
    function categoryCellHtml(item, full) {
      const chips = articleStore.categoryCodes(item).map(function (abbr) { return categoryChipHtml(abbr, full); }).join("");
      return chips ? '<div class="category-cell">' + chips + "</div>" : "";
    }
    function categoriesFormatter(row, cell, value, columnDef, item) {
      if (!item || item.__group || item.__groupTotals) return "";
      const memo = memoHost(item);
      if (memo._catHtml == null) memo._catHtml = categoryCellHtml(item, false);
      return memo._catHtml;
    }

    // Presentation owns its caches. All category views of a source article
    // share one entry, while a new renderer instance cannot inherit stale HTML.
    const cellMemos = new WeakMap();
    function memoHost(item) {
      const source = (item && item.__src) || item;
      let memo = cellMemos.get(source);
      if (!memo) { memo = {}; cellMemos.set(source, memo); }
      return memo;
    }

    // Cell-HTML memos (_titleHtml etc.): SlickGrid re-runs every formatter for
    // each row entering the viewport on every scroll pass, but these cells are
    // static per article - so build each once, lazily, and reuse the string.
    function titleFormatter(row, cell, value, columnDef, item) {
      const memo = memoHost(item);
      if (memo._titleHtml == null) {
        // Plain click focuses the list on this article (ID IS <key>: short link
        // in the crumb, abstract open); the href is that same pinned state (a
        // real, copyable address). The right button does the same without ever
        // lifting the pin - the pinned abstract carries the graph metrics.
        // title and subtitle are two separate row entries. Both sit INSIDE the
        // link: the line-clamp lives on the <a> (see articles.css), so a sibling
        // span would escape it and push the cell past the fixed row height.
        // With a subtitle, the title is wrapped and carries a copy of itself in
        // data-t: the source of the rule under its last line (articles.css).
        const t = escapeHtml(typeset(value));
        memo._titleHtml =
          '<div class="title-cell"><a class="html-link title-link" href="' + escapeHtml(articleUrl(item)) +
          '" data-id="' + escapeHtml(item.id) + '" title="Click: focus on this article&#10;Right-click: graph metrics">' +
          (item.subtitle
            ? '<span class="title-main" data-t="' + t + '">' + t + '</span><span class="title-sub">' + escapeHtml(typeset(item.subtitle)) + "</span>"
            : t) +
          "</a></div>";
      }
      return memo._titleHtml;
    }

    function authorsFormatter(row, cell, value, columnDef, item) {
      const memo = memoHost(item);
      // One author per line, so how many fit is a question of LINES: the cell
      // clamps at AUTHOR_LINES, a long name wraps onto a second one (~6.8px per
      // character at the 14px body size in Inter), and the "et al." marker needs a
      // line of its own when anyone is cut. Always show at least two names. An
      // estimate: articles-grid.js clampAuthorCells measures the drawn cell and
      // gives the "+N" more names (down to one) where it still runs over.
      const colW = (columnDef && columnDef.width) || 180;
      // The article an ID IS filter names lists every author: its row grows to
      // fit (oa-abstract-rows.js config.maxSpan, up to 96 fine rows), so the
      // budget is 95 lines - one kept for "+N" should even that cut anyone.
      const showAll = !!(state.showAllAuthors && state.showAllAuthors(item.id));
      const compact = !showAll && compactAuthors();
      const nameOf = compact ? authorShortName : authorDisplayName;
      // The two 18px glyph slots (+ gaps; the affiliation one always kept) take
      // 24px more from every name than the old single 13px ORCID column did.
      const charsPerLine = Math.max(8, Math.floor((colW - (compact ? COMPACT_INSET : NAME_INSET)) / CHAR_PX));
      const maxLines = showAll ? 95 : AUTHOR_LINES;
      const maxVisibleAuthors = showAll ? Infinity : AUTHOR_LINES;
      // No author filter active (the common case): the cell is static, so
      // build it once per row and reuse it on every scroll re-render. With a
      // filter active the cache is bypassed (order + highlight vary), and it
      // still holds the pristine rendering for when the filter clears. The memo
      // is width-keyed: a responsive column change re-budgets the run - and
      // keyed on visitedGen, so showing an author's metrics re-stamps .is-visited.
      const noFilter = !state.hasAuthorFilter && !showAll;
      const gen = state.visitedGen || 0;
      if (noFilter && memo._authorsHtml != null && memo._authorsHtmlW === colW && memo._authorsHtmlGen === gen && memo._authorsHtmlC === compact) return memo._authorsHtml;

      const fullAuthorText = item._authorTitle != null
        ? item._authorTitle
        : item.authors.map(author => authorDisplayName(author)).join("; ");

      // How many names fit the budget, in the article's own order.
      const fitCount = function (authors) {
        const cost = authors.map(function (a) {
          return Math.max(1, Math.ceil((String(nameOf(a) || "").length + 1) / charsPerLine));
        });
        const total = cost.reduce(function (s, c) { return s + c; }, 0);
        if (authors.length <= maxVisibleAuthors && total <= maxLines) return authors.length;
        let used = 0;
        let n = 0;
        for (let i = 0; i < authors.length && n < maxVisibleAuthors; i++) {
          if (n >= 2 && used + cost[i] > maxLines - 1) break;   // keep a line for "et al."
          used += cost[i];
          n += 1;
        }
        return Math.max(1, n);
      };

      let visibleAuthorLinks;
      let hiddenAuthors;
      if (noFilter) {
        const shown = fitCount(item.authors);
        visibleAuthorLinks = item.authors
          .slice(0, shown)
          .map(author => authorLinkHtml(author, false, compact));
        hiddenAuthors = item.authors.slice(shown);
      } else {
        // Filter active: the article's own order is kept (author position is
        // information). A matched author the budget would cut still shows: the
        // head gives up room for it, and a muted "…" marks the skipped run.
        const matched = item.authors.map(function (author) { return state.authorIsActive(author); });
        const shown = fitCount(item.authors);
        const late = [];
        for (let i = shown; i < item.authors.length; i++) if (matched[i]) late.push(i);
        const head = late.length ? Math.max(1, shown - late.length - 1) : shown;
        const pick = [];
        for (let i = 0; i < head; i++) pick.push(i);
        late.forEach(function (i) { if (i >= head) pick.push(i); });
        const picked = new Set(pick);
        visibleAuthorLinks = [];
        pick.forEach(function (i, k) {
          if (k && i !== pick[k - 1] + 1) visibleAuthorLinks.push('<span class="author-row author-row--gap" aria-hidden="true">' + (compact ? "" : '<span class="author-orcid author-orcid--none"></span><span class="author-aff author-aff--none"></span>') + '<span class="author-gap">\u2026</span></span>');
          visibleAuthorLinks.push(authorLinkHtml(item.authors[i], matched[i], compact));
        });
        hiddenAuthors = item.authors.filter(function (a, i) { return !picked.has(i); });
      }

      let html = visibleAuthorLinks.join("");
      if (hiddenAuthors.length) html += authorMoreHtml(item, hiddenAuthors.length, compact);

      // data-id: the measured clamp (articles-grid.js clampAuthorCells) adds a
      // "+N" of its own to a cell that has none, compact like the cell.
      const out =
        '<div class="author-cell' + (showAll ? " author-cell--all" : "") + (compact ? " author-cell--compact" : "") + '" data-id="' + escapeHtml(item.id) + '" title="' + escapeHtml(fullAuthorText) + '">' +
        html +
        "</div>";
      if (noFilter) {
        memo._authorsHtml = out;
        memo._authorsHtmlW = colW;
        memo._authorsHtmlGen = gen;
        memo._authorsHtmlC = compact;
      }
      return out;
    }

    // "+N" for the n authors a cell does not show, matching the keyword cell's
    // marker - the formatter's own cut, or the measured clamp's (articles-grid.js
    // clampAuthorCells). It is a control: tap / Enter opens the whole ordered
    // author list with working links (articles-grid.js, .kw-pop). The tooltip
    // keeps listing them, one numbered author per line, for a mouse hover.
    // compact: no mark slots in front, as in a phone's cell.
    function authorMoreHtml(item, n, compact) {
      const total = item.authors.length;
      const names = item.authors.map(function (a, i) { return (i + 1) + " - " + authorDisplayName(a); }).join("\n");
      return '<span class="author-row author-row--etal">' + (compact ? "" : '<span class="author-orcid author-orcid--none" aria-hidden="true"></span><span class="author-aff author-aff--none" aria-hidden="true"></span>') + '<span class="author-etal" role="button" tabindex="-1" aria-haspopup="dialog" data-id="' + escapeHtml(item.id) + '" title="' + escapeHtml(names) +
        '" aria-label="Show all ' + total + ' authors (' + n + ' more)">+' + n + "</span></span>";
    }

    // Lines the author cell takes at column width colW - the formatter's own
    // budget (AUTHOR_LINES, a line kept for "+N" when anyone is cut; `all`: the
    // pinned article's full list, up to 95). The grid's row-height estimate
    // reads it before the row is rendered.
    function authorLineCount(item, colW, all) {
      const authors = item && Array.isArray(item.authors) ? item.authors : [];
      if (!authors.length) return 0;
      const compact = !all && compactAuthors(), nameOf = compact ? authorShortName : authorDisplayName;
      const perLine = Math.max(8, Math.floor(((colW || 180) - (compact ? COMPACT_INSET : NAME_INSET)) / CHAR_PX));
      const cost = authors.map(function (a) {
        return Math.max(1, Math.ceil((String(nameOf(a) || "").length + 1) / perLine));
      });
      const total = cost.reduce(function (s, c) { return s + c; }, 0);
      if (all) return total > 95 ? 96 : total;
      if (authors.length <= AUTHOR_LINES && total <= AUTHOR_LINES) return total;
      let used = 0, n = 0;
      for (let i = 0; i < authors.length && n < AUTHOR_LINES; i++) {
        if (n >= 2 && used + cost[i] > AUTHOR_LINES - 1) break;
        used += cost[i];
        n += 1;
      }
      return Math.min(AUTHOR_LINES, used + 1);
    }

    function venueFormatter(row, cell, value, columnDef, item) {
      const memo = item ? memoHost(item) : null;
      // Pristine rendering is cached per row; while a venue filter is live the
      // cell carries the match class (accent, like a matched author), so the
      // cache is bypassed and left intact for when the filter clears.
      const matched = !!(state.hasVenueFilter && state.venueIsActive && state.venueIsActive(value));
      if (item && !state.hasVenueFilter && memo._venueHtml != null) return memo._venueHtml;

      const venue = value || "";
      const html = venue === ""
        ? '<div class="venue-cell"></div>'
        : '<div class="venue-cell">' + venueLinkHtml(venue, matched) + "</div>";
      if (item && !state.hasVenueFilter) memo._venueHtml = html;
      return html;
    }

    // A venue as the filter affordance the cell and the table footer share.
    function venueLinkHtml(venue, matched) {
      return '<span class="venue-link filter-affordance' + (matched ? " is-venue-match" : "") + '" role="button" tabindex="0" ' +
        'aria-label="Filter by this venue: ' + escapeHtml(venue) + '" title="' + CHIP_TIP.venue + '" data-venue="' + escapeHtml(venue) + '">' +
        (theme.ordinalHtml || function (s) { return s; })(escapeHtml(venue)) + "</span>";
    }

    function dateFormatter(row, cell, value, columnDef, item) {
      if (!item || item.__group || item.__groupTotals) {
        return "";
      }
      const memo = memoHost(item);
      // Pristine rendering is cached per row; while a date rule is live the cell
      // carries the match class (accent, like a matched venue), so the cache is
      // bypassed and left intact for when the rule clears.
      const matched = !!(state.hasDateFilter && state.dateIsActive && state.dateIsActive(item));
      if (!state.hasDateFilter && memo._dateHtml != null) return memo._dateHtml;

      // Rows carry the full YYYY-MM-DD (which the column sorts on); the cell
      // shows the month, e.g. "2018-03" - the grain it filters at (the rule
      // language's).
      const dateText = String(value || "");
      const dateMonth = dateText.slice(0, 7);

      // One mouse button per grain, via the rule builder's DATE field: a plain
      // click filters the month, the wheel button everything since it, the
      // right button the year. Keyboard: Enter = month, Shift+Enter = since,
      // Alt+Enter = year (see the grid's keydown delegate).
      const html = !item.date
        ? escapeHtml(dateText)
        : ('<span class="date-link filter-affordance' + (matched ? " is-date-match" : "") + '" ' +
          'role="button" tabindex="0" ' +
          'aria-label="Filter by ' + escapeHtml(dateMonth) + ' (Shift: since then, Alt: the year)" ' +
          'title="Click: filter by ' + escapeHtml(dateMonth) + '&#10;Middle-click: filter since ' + escapeHtml(dateMonth) + '&#10;Right-click: filter by ' + escapeHtml(dateMonth.slice(0, 4)) + '" ' +
          'data-date="' + escapeHtml(dateMonth) + '">' +
          escapeHtml(dateMonth) +
          "</span>");
      if (!state.hasDateFilter) memo._dateHtml = html;
      return html;
    }

    // Keywords carry their sigil (# topical, $ derived) in data, routes and display.
    function keywordLinkHtml(keyword) {
      const derived = keyword.charAt(0) === "$";
      const kwClass = derived ? " kw-derived" : " kw-topical";
      // The sigil is otherwise unexplained anywhere in the UI.
      const sigilTip = derived ? "$ = derived keyword\n" : "# = topical keyword\n";
      return '<a class="keyword-link filter-affordance' + kwClass + '" ' +
        'href="' + escapeHtml(keywordUrl(keyword)) + '" ' +
        'title="' + sigilTip + CHIP_TIP.keyword + '" ' +
        'data-keyword="' + escapeHtml(keyword) + '">' + escapeHtml(typeset(keyword)) + "</a>";
    }
    function keywordsFormatter(row, cell, value, columnDef, item) {
      // Matching/reordering is a live DOM pass; this cache stores pristine HTML.
      const memo = memoHost(item);
      if (memo._kwHtml == null) memo._kwHtml = '<div class="keyword-cell">' + item.keywords.map(keywordLinkHtml).join(" ") + "</div>";
      return memo._kwHtml;
    }

    // Citation bar: the count sits ON a bar whose length is the count normalized
    // against the single most-cited article in the database, so the column reads
    // as a distribution at a glance (the top paper fills the cell, everything
    // else is a fraction of it) while the number stays exact. Computed once.
    let _maxCitations = null;
    function maxCitations() {
      if (_maxCitations === null) {
        let m = 0;
        for (const a of articles) {
          const c = articleStore.metricNumber(a.citations);
          if (c > m) m = c;
        }
        _maxCitations = m || 1;
      }
      return _maxCitations;
    }

    // In-corpus citing works of an article that share an author with it (any
    // author: cached per article), and those by one selected author - who must
    // be on the article for them to be self-citations. Outside citations carry
    // no authors here, so both are taken off the recorded count.
    function authorIdsOf(row) {
      return (Array.isArray(row && row.authors) ? row.authors : []).map(function (a) { return window.OAArticleStore.authorIdOf(a); });
    }
    // The citation network feeds the split; the store builds it on first use.
    // The first paint does not wait for it: cells show the count alone until
    // it is built in idle time, then the column repaints (state.repaintCitations).
    let _graph = null, _graphQueued = false;
    function hasGraph() {
      if (_graph !== null) return _graph;
      if (!_graphQueued && articleStore.hasCitationGraph) {
        _graphQueued = true;
        const idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 300); };
        idle(function () {
          _graph = !!articleStore.hasCitationGraph();
          if (_graph && state.repaintCitations) state.repaintCitations();
        }, { timeout: 3000 });
      }
      return false;
    }
    function citingSplit(item, memo, self) {
      const id = ((item && item.__src) || item).id;
      if (memo._citShared == null) {
        const own = new Set(authorIdsOf(item));
        let shared = 0;
        articleStore.citationsOf(id).forEach(function (cid) {
          const p = articleStore.getById(cid);
          if (p && authorIdsOf(p).some(function (a) { return a && own.has(a); })) shared++;
        });
        memo._citShared = shared;
      }
      let bySelf = 0;
      if (self && authorIdsOf(item).indexOf(self) >= 0) {
        articleStore.citationsOf(id).forEach(function (cid) {
          const p = articleStore.getById(cid);
          if (p && authorIdsOf(p).indexOf(self) >= 0) bySelf++;
        });
      }
      return { shared: memo._citShared, self: bySelf };
    }

    function citationsFormatter(row, cell, value, columnDef, item) {
      if (!item || item.__group || item.__groupTotals) {
        return "";
      }
      const n = articleStore.metricNumber(value);
      if (n === null || n < 0) return '<span class="oa-muted" title="Citation count unavailable">n/a</span>';
      const memo = memoHost(item);
      // The author panel's author (AUTHOR IS one author), or "".
      const self = (hasGraph() && state.citationAuthor) || "";
      // toLocaleString spins up a fresh formatter per call - memoize the cell
      // (per selected author and network state: the split depends on both).
      const memoKey = (_graph ? "g:" : "-:") + self;
      if (memo._citHtml == null || memo._citHtmlFor !== memoKey) {
        // Citation counts are heavy-tailed (median 3, max ~1 100): a linear share
        // of the maximum left 87% of the bars under 3% of the width. Log scale
        // keeps the ordering and makes the middle of the distribution visible;
        // a 3% floor so a cited-once paper still shows a sliver.
        const pct = n > 0 ? Math.max(3, Math.round((Math.log1p(n) / Math.log1p(maxCitations())) * 100)) : 0;
        // In the bar: all, without self-citations (with an author selected),
        // without shared authors.
        const split = hasGraph() ? citingSplit(item, memo, self) : null;
        const noSelf = split ? Math.max(0, n - split.self) : n, noShared = split ? Math.max(0, n - split.shared) : n;
        const alt = split ? (self ? [noSelf, noShared] : [noShared]) : [];
        const tip = countFormat.format(n) + " citations" +
          (split && self ? " \u00b7 " + countFormat.format(noSelf) + " without self-citations of " + (state.citationAuthorLabel ? state.citationAuthorLabel(self) : self) : "") +
          (split ? " \u00b7 " + countFormat.format(noShared) + " without shared authors (checked for citing works in this database only)" : "") +
          " \u00b7 bar is log-scaled; most cited in the database: " + countFormat.format(maxCitations());
        memo._citHtmlFor = memoKey;
        memo._citHtml =
          '<div class="citations-cell" title="' + escapeHtml(tip) + '">' +
            '<span class="cit-bar">' +
              (pct ? '<span class="cit-bar-fill" style="width:' + pct + '%"></span>' : "") +
              '<span class="cit-bar-n">' + countFormat.format(n) +
                alt.map(function (v) { return '<span class="cit-alt">' + countFormat.format(v) + "</span>"; }).join("") + "</span>" +
            "</span>" +
          "</div>";
      }
      return memo._citHtml;
    }

    // The OA cell has exactly two renderings (open / closed): build both once,
    // the formatter is a plain lookup.
    function oaCellHtml(value) {
      const cssClass = value ? "oa-icon-open" : "oa-icon-closed";
      const title = value ? "Open Access" : "Closed Access";
      // Tabler lock icons (open shackle vs closed), shared via oa-theme.js.
      const inner = theme.oaIconPaths(value);
      return (
        '<div class="oa-cell oa-link" role="button" tabindex="0" data-oa="' + (value ? "true" : "false") + '" ' +
          'aria-label="Filter by this access status: ' + title + '" title="' + title + CHIP_TIP.access + '">' +
          '<svg class="oa-icon ' + cssClass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            inner +
          "</svg>" +
        "</div>"
      );
    }
    const OA_CELL_OPEN = oaCellHtml(true);
    const OA_CELL_CLOSED = oaCellHtml(false);

    // Tabler "blockquote": the copy-reference button in the star column.
    const CITE_SVG =
      '<svg class="oa-cite-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 15h15"></path><path d="M21 19h-15"></path>' +
        '<path d="M15 11h6"></path><path d="M21 7h-6"></path>' +
        '<path d="M9 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2"></path>' +
        '<path d="M3 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2"></path>' +
      "</svg>";

    // Tabler "file-type-pdf". 3dcp.fyi hosts no PDFs - the button opens the
    // freely available copy: Unpaywall's location for the DOI first, the
    // record's stored pdfUrl as the fallback (or the only route without a DOI).
    // Rendered only on OPEN-access rows: the row's openAccess flag is
    // Unpaywall's own is_oa, so a closed row has no free copy to open.
    const PDF_SVG =
      '<svg class="oa-pdf-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M14 3v4a1 1 0 0 0 1 1h4"></path>' +
        '<path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4"></path>' +
        '<path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6"></path>' +
        '<path d="M17 18h2"></path><path d="M20 15h-3v6"></path>' +
        '<path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1"></path>' +
      "</svg>";

    // Memoised per row like _citHtml: SlickGrid re-runs formatters on every
    // render pass, and this string depends only on the id + access flag. The
    // PDF sits BELOW the lock as a sibling, not a child: .oa-cell is itself a
    // role="button" that filters by access.
    function openAccessFormatter(row, cell, value, columnDef, item) {
      if (!item || !item.id) {
        return value ? OA_CELL_OPEN : OA_CELL_CLOSED;
      }
      const memo = memoHost(item);
      if (!memo._oaCellHtml) {
        const storedPdf = /^https?:\/\//i.test(String(item.pdfUrl || "").trim());
        const viaDoi = item.doi || /^https?:\/\/(?:dx\.)?doi\.org\//i.test(String(item.pdfUrl || "").trim());
        const pdfTip = viaDoi
          ? "Open the free PDF (found via Unpaywall - 3dcp.fyi hosts no PDFs)"
          : "Open the free PDF (publisher link - 3dcp.fyi hosts no PDFs)";
        memo._oaCellHtml = '<div class="oa-cell-stack">' + (value ? OA_CELL_OPEN : OA_CELL_CLOSED) +
          (value && (item.doi || storedPdf)
            ? '<button type="button" class="oa-pdf-btn" data-pdf-id="' + escapeHtml(item.id) + '"' +
                ' aria-label="Open the free PDF"' +
                ' title="' + pdfTip + '">' +
                PDF_SVG +
              "</button>"
            : "") +
        "</div>";
      }
      return memo._oaCellHtml;
    }

    // The administrative half of the summary, collapsed behind "Article
    // Details": a reader opening an article on a phone had to scroll past it to
    // reach the abstract. Category and keywords stay in the open block - they
    // say what the paper is ABOUT, which is what a reader scans for.
    const SUMMARY_SECONDARY = new Set(["citations"]);
    function hiddenColumnsSummary(item, hiddenIds, detailsOpen) {
      if (!item || !item.id) return "";
      const ids = hiddenIds;
      if (!ids.length) return "";
      let primary = "", secondary = "";
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        let v = "";
        // One author per line: each row is a line of its own, so a "; " between
        // them stood alone on a line.
        if (id === "authors") v = (item.authors || []).map(function (a) { return authorLinkHtml(a, state.authorIsActive(a)); }).join("");
        else if (id === "venue") v = item.venue ? venueFormatter(0, 0, item.venue, null, item) : "";
        else if (id === "date") v = item.date ? dateFormatter(0, 0, item.date, null, item) : "";
        else if (id === "category") v = categoryCellHtml(item, true);   // full titles: the summary has room, and touch has no hover
        else if (id === "keywords") v = (item.keywords && item.keywords.length) ? keywordsFormatter(0, 0, item.keywords, null, item) : "";
        else if (id === "citations") v = item.citations != null ? escapeHtml(countFormat.format(item.citations)) : "";
        else if (id === "openAccess") v = openAccessFormatter(0, 0, item.openAccess, null, item);
        else if (id === "favorite") v = favoriteFormatter(0, 0, null, null, item);
        if (!v) continue;
        const row = '<div class="abs-meta-row abs-meta-' + id + '"><span class="abs-meta-k">' +
          SUMMARY_LABELS[id] + '</span><span class="abs-meta-v">' + v + "</span></div>";
        if (SUMMARY_SECONDARY.has(id)) secondary += row; else primary += row;
      }
      let out = primary ? '<div class="abs-meta">' + primary + "</div>" : "";
      if (secondary) {
        out += '<details class="abs-meta-details" data-id="' + escapeHtml(item.id) + '"' +
          (detailsOpen ? " open" : "") +
          '><summary>Article Details</summary><div class="abs-meta abs-meta-extra">' +
          secondary + "</div></details>";
      }
      return out;
    }
    // Neutral up/down "sortable" affordance (built in oa-theme.js). SlickGrid layers its own active-sort indicator on top when
    // the column is the current sort.
    function withSortIcon(label) {
      return theme.sortIconHtml(label);
    }

    // The article an ID IS filter names lists all its authors and can run
    // taller than the viewport. Its other cells put their content in a sticky
    // box (articles.css .oa-stick), so date, title, venue, chips, icons and
    // citations stay readable at the top while the author list scrolls by.
    function stickyWrap(format) {
      return function (row, cell, value, columnDef, item) {
        const html = format(row, cell, value, columnDef, item);
        if (!html || typeof html !== "string" || !item || !item.id || !state.showAllAuthors || !state.showAllAuthors(item.id)) return html;
        return '<div class="oa-stick">' + html + "</div>";
      };
    }

    function createColumns() {
      const cols = [
      {
        id: "expand",
        name: "",
        field: "_expand",
        width: 30,
        minWidth: 30,
        maxWidth: 30,
        sortable: false,
        resizable: false,
        cssClass: "cell-expand",
        headerCssClass: "cell-center cell-expand-header",
        formatter: expandFormatter
      },
      {
        id: "date",
        name: withSortIcon("Date"),
        field: "date",
        // YYYY-MM-DD in Inter's tabular figures at 14px runs ~84px plus the
        // cell padding; 96 (the Arial width) clipped the last digit.
        width: 104,
        minWidth: 104,
        maxWidth: 104,
        sortable: true,
        resizable: false,
        cssClass: "cell-date",
        formatter: dateFormatter
      },
      {
        id: "title",
        name: withSortIcon("Article"),
        field: "title",
        width: 582,
        minWidth: 180,
        sortable: true,
        formatter: titleFormatter
      },
      {
        id: "authors",
        name: withSortIcon("Authors"),
        field: "authors",
        width: 300,
        minWidth: 130,
        sortable: true,
        toolTip: "Sort by first author",
        formatter: authorsFormatter
      },
      {
        id: "venue",
        name: withSortIcon("Venue"),
        field: "venue",
        width: 230,
        minWidth: 110,
        sortable: true,
        formatter: venueFormatter
      },
      {
        id: "category",
        name: "Category",
        field: "id",
        // Two mono 5-letter chips (~57px each at the 12px meta size) + gap + cell
        // padding, plus slack.
        width: 140,
        minWidth: 140,
        sortable: false,
        formatter: categoriesFormatter
      },
      {
        id: "keywords",
        name: "Keywords",
        field: "keywords",
        width: 470,
        minWidth: 150,
        sortable: false,
        formatter: keywordsFormatter
      },
      // Star and access sit after Keywords, ahead of Citations: the reading columns
      // (Date, Article, Authors) lead the row; the per-row actions gather at
      // its end beside the citation bar.
      {
        id: "favorite",
        name: state.favorites ? state.favorites.headerButtonHtml({ extraClass: "fav-grid" }) : "",
        field: "_favorite",
        width: 30,
        minWidth: 30,
        maxWidth: 30,
        sortable: false,
        resizable: false,
        cssClass: "cell-fav",
        headerCssClass: "cell-center cell-fav-header",
        formatter: favoriteFormatter
      },
      {
        id: "openAccess",
        // No label: the column carries three affordances now (filter by access,
        // copy the reference, open the PDF), so "OA" named only the first of
        // them. The sort arrows stay - the column still sorts by access - and
        // the accessible name comes from toolTip.
        name: withSortIcon(""),
        toolTip: "Access, reference, BibTeX and PDF - sorts by access",
        field: "openAccess",
        width: 34,
        minWidth: 34,
        maxWidth: 34,
        sortable: true,
        resizable: false,
        cssClass: "cell-center",
        headerCssClass: "cell-center",
        formatter: openAccessFormatter
      },
      // The DOI column is gone: the DOI link now leads the Discovery group of
      // the abstract's external-records strip (ext-records.js).
      {
        id: "citations",
        name: withSortIcon("Citations"),
        toolTip: "Recorded citations / without self-citations (when the list shows one author) / without shared authors",
        field: "citations",
        // Wide enough for a bar holding up to three counts.
        width: 164,
        minWidth: 130,
        maxWidth: 190,
        sortable: true,
        resizable: false,
        cssClass: "cell-citations",
        headerCssClass: "header-citations",
        formatter: citationsFormatter
      }
      ];
      cols.forEach(function (c) { if (c.id !== "authors" && c.formatter) c.formatter = stickyWrap(c.formatter); });
      return cols;
    }

    return Object.freeze({ createColumns: createColumns,
      summaryOrder: Object.freeze(SUMMARY_ORDER), hiddenColumnsSummary: hiddenColumnsSummary,
      authorDisplayName: authorDisplayName, authorAlternateDisplayName: authorAlternateDisplayName,
      authorLinkHtml: authorLinkHtml, authorMoreHtml: authorMoreHtml, hasAffiliation: hasAffiliation, authorLineCount: authorLineCount, linePitch: AUTHOR_LINES === 4 ? 24 : 22, categoryChipHtml: categoryChipHtml,
      keywordLinkHtml: keywordLinkHtml, venueLinkHtml: venueLinkHtml, doiUrl: doiUrl });
  }
  root.OAGridRenderers = Object.freeze({ create: create });
})(typeof window === "undefined" ? globalThis : window);
