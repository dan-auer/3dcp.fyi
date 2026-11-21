/* grid-search.js
 * The grid's search session: query/rank overlay, saved sort/abstracts, toolbar,
 * facet picks, readiness and viewport expansion. Ranking and model lifecycle
 * remain in OASemanticSearch. Services/effects are supplied by the grid host.
 * Classic script and CommonJS; importing the module mounts nothing.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OAGridSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(dependencies) {
    const window = dependencies.window;
    const elements = dependencies.elements;
    const input = elements.input;
    const clearButton = elements.clearButton;
    const enterButton = elements.enterButton;
    const status = elements.status;
    const grid = dependencies.grid;
    const dataView = dependencies.dataView;
    const abstracts = dependencies.abstracts;
    const rules = dependencies.rules;
    const effects = dependencies.effects;
    const getSearch = dependencies.getSearch;
    let minimumQueryLength = (getSearch() && getSearch().MIN_QUERY_LENGTH) || 3;
    let rankById = null;
    let query = "";
    // The query last committed: by a pause in typing (TYPE_PAUSE), Enter, a
    // facet pick or a shared link. Every search and re-run uses this, so the
    // embedding runs once per pause, not per keystroke.
    let submitted = "";
    // Default: a result holds every content word of the query (or is a strong
    // semantic match). The empty state offers "Match any word"; a new query
    // returns to all words.
    let anyWord = false;
    let lastRelaxable = false;
    function setAnyWord(value) {
      if (destroyed) return;
      anyWord = !!value;
      query = "";   // a different result set: reset as for a new query
      run();
    }
    let savedSort = null;
    let previousOpenAbstracts = null;
    let autoOpen = true;
    const manualClosedHits = new Set();
    let debounceTimer = null;
    // Typing searches once the reader pauses this long; Enter does at once.
    const TYPE_PAUSE = 400;
    let typeTimer = null;
    let hitsOpenTimer = null;
    let facetMenu = null;
    let destroyed = false;
    let searchGeneration = 0;
    let retryGeneration = 0;
    // The status line has one owner (this module) and two sticky facts besides
    // its transient progress text: an initialization failure keeps its Retry
    // button until a retry succeeds, and the effective mode of the current
    // results ("keyword only" when semantic ranking could not run) is shown
    // with the results rather than lost to the next progress message.
    let loadFailed = false;
    let retryInFlight = false;
    let modeNote = "";
    const disposers = [], listeners = new AbortController();

    function listen(target, type, handler) {
      if (target) target.addEventListener(type, handler, { signal: listeners.signal });
    }
    function subscribe(event, handler) {
      if (!event) return;
      event.subscribe(handler);
      disposers.push(function () { event.unsubscribe(handler); });
    }
    function hasQuery() {
      return submitted.length >= minimumQueryLength;
    }
    function setStatus(text) {
      if (!destroyed && status) status.textContent = text || "";
    }
    function setStatusHtml(html) {
      if (!destroyed && status) status.innerHTML = html;
    }
    // Clear (×) and the ↵ Enter key cap show whenever the box holds text.
    function syncBoxButtons() {
      const empty = !input || input.value.trim() === "";
      if (clearButton) clearButton.hidden = empty;
      if (enterButton) enterButton.hidden = empty;
    }
    function statusLink(className, text) {
      const button = window.document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = text;
      return button;
    }
    // One delegated handler also owns transient Retry / remove-filter buttons.
    // Replacing status content never leaves retained button listeners behind.
    listen(status, "click", function (event) {
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest(".oa-tsearch-drop")) {
        rules.removeLast();
        setStatus("");
      } else if (target.closest(".oa-tsearch-relevance")) {
        sortByRelevance();
      } else if (target.closest(".oa-tsearch-any") || target.closest(".oa-tsearch-all")) {
        setAnyWord(!!target.closest(".oa-tsearch-any"));
      } else {
        const retry = target.closest(".oa-tsearch-retry");
        if (!retry || retry.disabled) return;
        retry.disabled = true;
        retry.textContent = "Loading…";
        retryInFlight = true;
        const generation = ++retryGeneration;
        Promise.resolve().then(function () {
          if (!destroyed && generation === retryGeneration) return dependencies.loadSearch();
        }).then(function () {
          if (destroyed || generation !== retryGeneration) return;
          retryInFlight = false;
          loadFailed = false;
          setStatus("");
          if (hasQuery()) run();
        }).catch(function () {
          if (destroyed || generation !== retryGeneration) return;
          retryInFlight = false;
          showRetry(true);   // back to an enabled Retry, not a stuck "Loading…"
        });
      }
    });

    function relevanceComparer(a, b) {
      const ra = rankById.has(a.id) ? rankById.get(a.id) : Infinity;
      const rb = rankById.has(b.id) ? rankById.get(b.id) : Infinity;
      return ra - rb;
    }

    // A header sort applied during a search replaces relevance order, and no
    // column header stands for relevance - so the status line names the sort
    // and offers the way back (it used to need a different query).
    const SORT_NAMES = { date: "date", title: "title", authors: "first author", venue: "venue", citations: "citations", openAccess: "access" };
    function userSortColumn() {
      const cols = grid.getSortColumns ? grid.getSortColumns() : null;
      return rankById && cols && cols.length && cols[0].columnId ? cols[0].columnId : "";
    }
    function showResultStatus() {
      if (destroyed || !status) return;
      const id = userSortColumn();
      status.textContent = modeNote;
      if (anyWord) {
        status.append((modeNote ? " \u00b7 " : "") + "Matching any word \u00b7 ", statusLink("oa-tsearch-mode oa-tsearch-all", "Match all words"));
      }
      if (id) {
        status.append((modeNote || anyWord ? " \u00b7 " : "") + "Sorted by " + (SORT_NAMES[id] || id) + " \u00b7 ", statusLink("oa-tsearch-relevance", "Sort by relevance"));
      } else if (rankById && rankById.size) {
        // Relevance has no column header to mark, so the order is named here.
        status.append((modeNote || anyWord ? " \u00b7 " : "") + "Sorted by relevance");
      }
    }
    function sortByRelevance() {
      if (destroyed || !rankById) return;
      dataView.sort(relevanceComparer, true);
      grid.setSortColumn("", true);
      if (elements.viewport) elements.viewport.scrollTop = 0;
      showResultStatus();
      effects.queryChanged();
      if (input) input.focus({ preventScroll: true });
    }

    function openHitsInView() {
      if (destroyed || !rankById || !autoOpen) return;
      const range = grid.getRenderedRange ? grid.getRenderedRange() : null;
      if (!range) return;
      const ids = [];
      const top = Math.max(0, range.top);
      const bottom = range.bottom + 12;
      const count = grid.getDataLength ? grid.getDataLength() : 0;
      for (let row = top; row <= bottom && row < count; row++) {
        const item = grid.getDataItem(row);
        if (item && item.id && !item.__group && !item.__groupTotals &&
            rankById.has(item.id) && !manualClosedHits.has(item.id)) ids.push(item.id);
      }
      if (ids.length) abstracts.openMany(ids);
    }
    function scheduleOpenHits() {
      if (destroyed || !rankById || hitsOpenTimer !== null) return;
      hitsOpenTimer = window.setTimeout(function () {
        hitsOpenTimer = null;
        openHitsInView();
      }, 80);
    }

    function applyResult(result, generation) {
      if (destroyed || generation !== searchGeneration || !result || !input ||
          result.query !== submitted) return;
      const empty = !result.order || !result.order.length;
      // An updated ranking for the query already on screen (the semantic pass
      // after the keyword-first partial, the model becoming ready, a filter or
      // ranking-setting change) must not take the page away from someone
      // reading it: keep the article at the top of the viewport where it is,
      // and keep every open/closed choice. Only a NEW query gets the reset.
      const isUpdate = rankById !== null && query === result.query;
      const anchor = isUpdate ? abstracts.captureReadingAnchor() : null;
      if (rankById === null) {
        previousOpenAbstracts = abstracts.openIds();
        const columns = grid.getSortColumns();
        savedSort = columns && columns.length
          ? { columnId: columns[0].columnId, ascending: !!columns[0].sortAsc }
          : { columnId: "date", ascending: false };
      }
      // Open cards render with the ranking's highlighting and score badges, so
      // a kept card's memoized markup is stale once the ranking changes.
      if (isUpdate && abstracts.invalidateDrop && abstracts.openIds) {
        abstracts.openIds().forEach(function (id) { abstracts.invalidateDrop(id); });
      }
      // Zero hits still means an active overlay and a shareable search query.
      query = result.query;
      rankById = empty ? new Map() : result.rankById;
      lastRelaxable = empty && !!result.relaxable;
      modeNote = result.degraded ? "Keyword search only \u00b7 " + result.degraded : "";
      // A header sort applied DURING this search (rememberSort keeps it for the
      // exit) stays across an update of the same query - the reader chose it
      // over relevance order. A new query, or no user sort, ranks by relevance.
      const sortCols = isUpdate ? grid.getSortColumns() : null;
      const userSort = sortCols && sortCols.length && sortCols[0].columnId ? sortCols[0] : null;
      const userColumn = userSort ? dependencies.columns.find(function (c) { return c.id === userSort.columnId; }) : null;
      dataView.beginUpdate();
      dataView.refresh();
      if (userColumn) dataView.sort(dependencies.compareByField(userColumn.field, !!userSort.sortAsc), !!userSort.sortAsc);
      else dataView.sort(relevanceComparer, true);
      dataView.endUpdate();
      if (!userColumn) grid.setSortColumn("", true);
      effects.resultsChanged();
      if (!isUpdate) {
        abstracts.clear();
        autoOpen = true;
        manualClosedHits.clear();
      }
      if (empty) {
        // Both facts survive: no hits, and why the ranking was keyword-only.
        const none = modeNote ? "No keyword matches \u00b7 " + modeNote.replace(/^Keyword search only \u00b7 /, "") : "No matches";
        let html = none.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const plain = html;
        // Nothing holds every word: offer the looser any-word ranking.
        if (result.relaxable) html += ' \u00b7 <button type="button" class="oa-tsearch-mode oa-tsearch-any">Match any word</button>';
        if (rules.filterIds()) html += ' \u00b7 <button type="button" class="oa-tsearch-drop">remove the last filter</button>';
        if (html !== plain) setStatusHtml(html);
        else setStatus(none);
      } else {
        showResultStatus();
        if (!isUpdate) {
          if (elements.viewport && elements.viewport.scrollTop) elements.viewport.scrollTop = 0;
        } else if (anchor && !abstracts.restoreReadingAnchor(anchor) && elements.viewport) {
          elements.viewport.scrollTop = 0;   // the article being read left the results
        }
        if (isUpdate && abstracts.count() && abstracts.render) abstracts.render(true);
        openHitsInView();
      }
      effects.queryChanged();
    }

    function clear() {
      if (destroyed) return;
      searchGeneration++;
      // Cancel even the first query, before its overlay has arrived.
      const search = getSearch();
      if (search && search.clearActive) search.clearActive();
      if (rankById === null && query === "") return;
      rankById = null;
      query = "";
      modeNote = "";
      dataView.beginUpdate();
      dataView.refresh();
      const restore = savedSort || { columnId: "date", ascending: false };
      const column = dependencies.columns.find(function (c) { return c.id === restore.columnId; });
      if (column) {
        grid.setSortColumn(restore.columnId, restore.ascending);
        dataView.sort(dependencies.compareByField(column.field, restore.ascending), restore.ascending);
      }
      dataView.endUpdate();
      savedSort = null;
      effects.resultsChanged();
      effects.queryChanged();
      if (previousOpenAbstracts && previousOpenAbstracts.length) abstracts.setOpen(previousOpenAbstracts);
      else abstracts.clear();
      previousOpenAbstracts = null;
      // A lone ID IS rule pins the list to one article the reader asked to
      // see: its abstract stays open through this reset. (A title pick from
      // the menu opens it and then lands here, as the consumed query clears.)
      const pinned = rules.pinnedId ? rules.pinnedId() : null;
      if (pinned) abstracts.openMany([pinned]);
    }

    function clearBox() {
      if (destroyed) return;
      if (input) input.value = "";
      submitted = "";
      anyWord = false;
      syncBoxButtons();
      if (facetMenu) facetMenu.close();
      window.clearTimeout(debounceTimer);
      window.clearTimeout(typeTimer);
      debounceTimer = typeTimer = null;
      clear();
      setStatus("");
    }

    function schedule() {
      if (destroyed) return;
      // Invalidating on scheduling also rejects an old same-query result when
      // the eligible rule set changes during the debounce interval.
      searchGeneration++;
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function () { debounceTimer = null; run(); }, 150);
    }

    function run() {
      if (destroyed || !input) return;
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
      const generation = ++searchGeneration;
      const text = submitted;
      syncBoxButtons();
      if (text.length < minimumQueryLength) {
        clear();
        setStatus(text.length ? "Type at least " + minimumQueryLength + " characters…" : "");
        return;
      }
      const search = getSearch();
      if (!search) { if (loadFailed) showRetry(); else setStatus("Loading search\u2026"); return; }
      setStatus("Searching\u2026");
      const apply = function (result) { applyResult(result, generation); };
      function failed(error) {
        if (destroyed || generation !== searchGeneration || submitted !== text) return;
        // Initialization failed while this query waited on it: the recovery
        // action stays. Plain error text is for a failure of the query itself.
        if (loadFailed) { showRetry(); return; }
        setStatus("Search error: " + (error && error.message ? error.message : error));
      }
      try {
        Promise.resolve(search.search(text, apply, { filterIds: rules.filterIds(), anyWord: anyWord }))
          .then(function (result) { if (result) apply(result); }).catch(failed);
      } catch (error) { failed(error); }
    }

    // Commit the box's text as the query and search it now.
    function submit() {
      if (destroyed || !input) return;
      window.clearTimeout(typeTimer);
      typeTimer = null;
      submitted = input.value.trim();
      anyWord = false;
      run();
    }
    // Startup / shared link: query AND match mode in one search. submit() resets
    // the mode, and switching it after submitting would search twice.
    function restore(text, opts) {
      if (destroyed || !input) return;
      input.value = String(text || "").trim();
      submitted = input.value;
      anyWord = !!(opts && opts.anyWord);
      run();
    }

    function showRetry(reset) {
      loadFailed = true;
      // A retry in flight shows its own disabled "Loading…" button: leave it
      // alone unless the retry itself just failed (reset) - then re-render an
      // enabled button so the reader can try again.
      if (!reset && retryInFlight) return;
      setStatusHtml('Keyword search unavailable. <button type="button" class="oa-tsearch-retry">Retry search</button>');
    }
    function refreshOpenAbstracts() {
      if (destroyed || !abstracts.count()) return;
      abstracts.openIds().forEach(function (id) { abstracts.invalidateDrop(id); });
      abstracts.remeasure(true);
      abstracts.render(true);
    }

    // A pause in typing searches; Enter searches at once. Emptying the box
    // resets at once (nothing to embed), as the clear button does. An IME
    // composition searches once committed (compositionend), not on each
    // provisional character. The facet menu stays open meanwhile.
    function typed() {
      window.clearTimeout(typeTimer);
      typeTimer = window.setTimeout(function () {
        typeTimer = null;
        if (!destroyed && input && input.value.trim() !== submitted) submit();
      }, TYPE_PAUSE);
    }
    listen(input, "input", function (event) {
      const empty = input.value.trim() === "";
      syncBoxButtons();
      if (empty) {
        window.clearTimeout(typeTimer);
        typeTimer = null;
        if (submitted) {
          submitted = "";
          anyWord = false;
          window.clearTimeout(debounceTimer);
          debounceTimer = null;
          clear();
          setStatus("");
        }
        return;
      }
      if (!event.isComposing) typed();
    });
    listen(input, "compositionend", typed);
    if (input && dependencies.facets) {
      facetMenu = dependencies.facets.init({
        input: input, anchor: elements.anchor, sources: rules.facetSources,
        apply: rules.applyFacet, isActive: rules.facetIsActive,
        minChars: function () { return minimumQueryLength; },
        onApply: function (rule, info) {
          if (destroyed) return;
          const residual = (info && info.residual) || "";
          input.value = residual;
          submitted = residual.trim();
          anyWord = false;
          syncBoxButtons();
          window.clearTimeout(debounceTimer);
          window.clearTimeout(typeTimer);
          debounceTimer = typeTimer = null;
          if (residual.trim().length >= minimumQueryLength) run();
          else { clear(); setStatus(""); }
        }
      });
    }
    // Enter submits. Registered after the facet menu: a highlighted suggestion
    // consumes Enter (preventDefault) and is picked instead.
    listen(input, "keydown", function (event) {
      if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (facetMenu) facetMenu.close();
      submit();
    });
    listen(clearButton, "click", function () { clearBox(); if (input) input.focus(); });
    // The key cap is also a button: a pointer (or a touch keyboard without a
    // visible Enter) can submit with it.
    listen(enterButton, "click", function () {
      if (facetMenu) facetMenu.close();
      submit();
      if (input) input.focus({ preventScroll: true });
    });
    listen(window, "oa-search-status", function (event) {
      if (loadFailed) return;   // progress text never displaces the Retry action
      if (hasQuery()) setStatus(String(event.detail || ""));
    });
    listen(window, "oa-search-load-error", showRetry);
    const initialSearch = getSearch();
    if (initialSearch && initialSearch.ready) initialSearch.ready.catch(showRetry);
    listen(window, "oa-toc-ready", function () {
      refreshOpenAbstracts();
      effects.textReady();
    });
    listen(window, "oa-search-ready", function () {
      loadFailed = false;
      const search = getSearch();
      if (search && search.MIN_QUERY_LENGTH) minimumQueryLength = search.MIN_QUERY_LENGTH;
      refreshOpenAbstracts();
      effects.textReady();
      if (hasQuery()) run();
    });
    listen(window, "oa-tts-ready", refreshOpenAbstracts);
    listen(window, "oa-search-highlight-ready", refreshOpenAbstracts);
    let previousModelState = initialSearch ? initialSearch.getModelState().state : "absent";
    listen(window, "oa-model-status", function (event) {
      const next = event.detail && event.detail.state;
      if (next === previousModelState) return;
      previousModelState = next;
      if (next !== "ready" && next !== "absent") return;
      if (hasQuery()) run();
    });
    subscribe(grid.onScroll, scheduleOpenHits);
    subscribe(grid.onViewportChanged, scheduleOpenHits);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.abort();
      searchGeneration++;
      retryGeneration++;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(hitsOpenTimer);
      window.clearTimeout(typeTimer);
      debounceTimer = hitsOpenTimer = typeTimer = null;
      disposers.splice(0).forEach(function (dispose) { dispose(); });
      if (facetMenu) facetMenu.destroy();
      facetMenu = null;
      rankById = savedSort = previousOpenAbstracts = null;
      query = "";
      manualClosedHits.clear();
    }

    return {
      get query() { return query; },
      // A committed query (a link's ?search=, a typed one) whose results are
      // not in yet; false once they are, or when the search cannot load.
      get pending() { return !destroyed && !loadFailed && submitted.length >= minimumQueryLength && query !== submitted; },
      // "Match any word" in force for the current query (shared as match=any).
      get anyWord() { return anyWord && query !== ""; },
      // Zero hits under the all-words rule, with more than one content word:
      // the grid's empty state offers "Match any word".
      get relaxable() { return rankById !== null && rankById.size === 0 && lastRelaxable; },
      matchAnyWord: function () { setAnyWord(true); },
      matches: function (id) { return rankById === null || rankById.has(id); },
      run: run, schedule: schedule, restore: restore, clear: clear, clearBox: clearBox,
      filterChanged: function () { if (query || hasQuery()) schedule(); },
      sortChanged: function () { if (!destroyed && rankById !== null) showResultStatus(); },
      rememberSort: function (columnId, ascending) {
        if (!destroyed && rankById !== null) savedSort = { columnId: columnId, ascending: !!ascending };
      },
      abstractToggled: function (id, wasOpen) {
        if (!destroyed && rankById !== null) {
          if (wasOpen) manualClosedHits.add(id);
          else manualClosedHits.delete(id);
        }
      },
      abstractsCleared: function () { if (!destroyed && rankById !== null) autoOpen = false; },
      destroy: destroy
    };
  }
  return { create: create };
});
