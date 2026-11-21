/* grid-shell.js - the article browser's component shell: toolbar, search row,
   settings panel, grid container, empty state and autocomplete datalists.
   articles-grid.js injects window.OAGridShell.html() into #articles-app on
   mount and wires the ids below; header-actions.js moves the action buttons
   into the site header and wires the settings tabs. Template only - no state. */
(function () {
  "use strict";
  function html() {
    // Set pre-paint by oa-boot.js; oa-theme.js keeps the Theme radios in sync.
    const theme = window.OA_THEME || "mint";
    return `
    <h1 class="oa-sr-only">3dcp.fyi</h1>
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="toolbar-group">
          <button id="collapseAbstracts" type="button"
                  class="collapse-abs-btn" disabled
                  title="No open abstracts to hide"><svg class="collapse-abs-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11l5 -5l5 5"></path><path d="M7 17l5 -5l5 5"></path></svg><span class="tb-label">Hide abstracts</span></button>
          <button id="panelToggle" type="button" class="panel-toggle-btn"
                  aria-controls="authorPanel" aria-pressed="true" aria-label="Metrics panel"
                  title="Hide the metrics panel"><svg class="pt-hide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6"></path><path d="M12 8h2a1 1 0 0 1 1 1v2m0 4v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-10"></path><path d="M15 11v-6a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v12m-1 3h-4a1 1 0 0 1 -1 -1v-4"></path><path d="M4 20h14"></path><path d="M3 3l18 18"></path></svg><svg class="pt-show" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6"></path><path d="M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10"></path><path d="M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14"></path><path d="M4 20h14"></path></svg></button>
          <div class="columns-wrap">
            <div id="columnsPanel" class="columns-panel" role="dialog" aria-label="Columns" hidden></div>
          </div>
        </div>
        <div class="oa-tsearch-row">
          <!-- Group by leads the search row, left of the field. -->
          <div class="toolbar-group toolbar-group-grouping">
            <div class="group-split">
            <div class="tb-select">
              <button id="groupToggle" type="button" class="tb-select-k" disabled data-collapsed="true" aria-label="Group by" title="Group by"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 16v2a1 1 0 0 1 -1 1h-11l6 -7l-6 -7h11a1 1 0 0 1 1 1v2"></path></svg></button>
              <span class="tb-select-box"><select id="groupBySelect" aria-label="Group by">
                <option value="">Group by…</option>
                <option value="date">Date</option>
                <option value="venue">Venue</option>
                <option value="access">Access</option>
                <option value="category">Category</option>
              </select></span>
            </div>
            <button id="groupClear" type="button" disabled aria-label="Remove the grouping" title="Remove the grouping"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg></button>
            </div>
          </div>
          <div class="oa-tsearch">
            <span class="oa-tsearch-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path></svg></span>
            <input id="semanticSearch" type="search" class="oa-tsearch-input" autocomplete="off" spellcheck="false" placeholder="Search" aria-label="Search" title="Shortcut: press / to search&#10;&quot;quotes&quot; match an exact phrase"/>
            <button id="semanticSearchEnter" class="oa-tsearch-enter" type="button" hidden tabindex="-1" aria-label="Search" title="Search (Enter)"><kbd class="oa-tsearch-kbd">&#8629; Enter</kbd></button>
            <button id="semanticSearchClear" class="oa-tsearch-clear" type="button" hidden aria-label="Clear search">&times;</button>
            <span id="modelDownloadProgress" class="oa-tsearch-progress" hidden aria-hidden="true"><span class="oa-tsearch-progress-fill"></span></span>
            <span id="resultCount" class="result-count" role="status" aria-live="polite">0</span>
            <!-- Semantic-model state: a bare status glyph right of the match count
                 (red = off, click to download; green = on). -->
            <button id="modelDownloadBtn" class="oa-tsearch-model is-absent" type="button" aria-label="Download semantic search model" title="Semantic model not downloaded"><span class="oa-tsearch-model-ic" aria-hidden="true"></span><span class="oa-tsearch-model-t">Semantic off</span></button>
          </div>
          <!-- Filters sits at the search field's right end, icon only. -->
            <div class="filter-split">
            <button id="ruleBuilderToggle" type="button"
                    aria-expanded="false" aria-controls="ruleBuilderBody" aria-label="Filters"
                    title="Show / hide the Rule Builder"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227"></path></svg><span class="tb-label">Filters</span><span class="tb-count rb-count" aria-hidden="true"></span></button>
            <button id="resetFilters" type="button" class="filter-clear-btn" disabled
                    aria-label="Clear all filters and the search"
                    title="Clear all filters and the search"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg></button>
            </div>
        </div>
        <span id="rowSelCount" class="rowsel-count" hidden><span class="rowsel-label"><svg class="rowsel-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11"></path><path d="M8 8l4 0"></path><path d="M8 12l4 0"></path><path d="M8 16l4 0"></path></svg><span class="rowsel-count-t"></span></span><button id="rowSelFav" type="button" title="Favorite all selected" aria-label="Favorite all selected"></button><button id="rowSelClear" type="button" title="Clear selection (Esc)" aria-label="Clear selection">&times;</button></span>
        <span id="semanticSearchStatus" class="oa-tsearch-status" aria-live="polite"></span>
        <div class="toolbar-group toolbar-group-fav">
          <span class="toolbar-sep" aria-hidden="true"></span>
          <div class="fav-split">
          <button id="favFilter" type="button"
                  class="fav-filter-btn" aria-pressed="false"
                  aria-label="Show only favorites"
                  title="Show only favorites"><span class="fav-filter-ic" aria-hidden="true"></span><span class="tb-label fav-filter-t" aria-hidden="true">Favorites</span><span class="tb-count fav-filter-count" data-fav-count aria-hidden="true">0</span></button>
          <button id="favMenuBtn" type="button" class="fav-menu-btn" hidden
                  aria-haspopup="menu" aria-expanded="false" aria-controls="favMenu"
                  aria-label="Favorites actions" title="Share or remove your favorites"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"></path></svg></button>
          <div id="favMenu" class="fav-menu" role="menu" aria-label="Favorites" hidden>
          <button id="favShare" type="button" role="menuitem"
                  class="fav-menu-item" disabled><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 15l6 -6"></path><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"></path><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"></path></svg><span>Copy share link</span></button>
          <button id="favClear" type="button" role="menuitem"
                  class="fav-menu-item is-danger" disabled><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l16 0"></path><path d="M10 11l0 6"></path><path d="M14 11l0 6"></path><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path></svg><span>Remove all favorites&hellip;</span></button>
          </div>
          </div>
          <span class="toolbar-sep" aria-hidden="true"></span>
          <button id="exportResults" type="button"
                  class="export-results-btn" disabled
                  aria-label="Download matching articles as BibTeX"
                  title="Download matching articles as BibTeX (.bib)"><svg class="export-results-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.OATheme.DOWNLOAD_PATHS}</svg><span class="tb-label">BibTeX</span></button>
          <!-- "Open all" is a split button like Favorites: the action, then a
               menu half that picks where each article opens (DOI / publisher,
               Google Scholar, ...). articles-grid.js fills the menu from the
               external-records catalogue; the choice is a saved preference. -->
          <div class="open-split">
          <button id="openAll" type="button"
                  class="open-all-btn" disabled
                  aria-label="Open all matching articles in new tabs"
                  title="Open all matching articles in new tabs"><svg class="open-all-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"></path><path d="M11 13l9 -9"></path><path d="M15 4h5v5"></path></svg><span class="tb-label">Open all</span><span class="tb-count open-all-count" aria-hidden="true"></span></button>
          <button id="openMenuBtn" type="button" class="open-menu-btn"
                  aria-haspopup="menu" aria-expanded="false" aria-controls="openMenu"
                  aria-label="Open all via" title="Choose where Open all sends each article"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"></path></svg></button>
          <div id="openMenu" class="fav-menu open-menu" role="menu" aria-label="Open all via" hidden></div>
          </div>
          <div class="search-settings-wrap">
            <button id="searchSettings" type="button" class="search-settings-btn" aria-haspopup="true" aria-expanded="false" aria-label="Settings" title="Settings: search, appearance, reader"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path></svg></button>
            <div id="searchSettingsPanel" class="search-settings-panel" role="dialog" aria-label="Settings" hidden>
              <div class="ss-head"><span class="ss-title">Settings</span><button id="ssClose" type="button" class="ss-close" aria-label="Close settings">&times;</button></div>
              <!-- Three tabs (header-actions.js wires them): what the reader
                   searches with, how the table looks, how articles are read and
                   cited. -->
              <div class="ss-tabs" role="tablist" aria-label="Settings sections"><button type="button" role="tab" id="ssTab-search" class="ss-tab" data-tab="search" aria-selected="true" aria-controls="ssPane-search" tabindex="0">Search</button><button type="button" role="tab" id="ssTab-look" class="ss-tab" data-tab="look" aria-selected="false" aria-controls="ssPane-look" tabindex="-1">Appearance</button><button type="button" role="tab" id="ssTab-read" class="ss-tab" data-tab="read" aria-selected="false" aria-controls="ssPane-read" tabindex="-1">Reader</button></div>
              <div id="ssPane-search" class="ss-pane" role="tabpanel" aria-labelledby="ssTab-search" data-tab="search">
              <label class="ss-field">
                <span class="ss-label">Typo tolerance<span id="ssTolOut" class="ss-val"></span></span>
                <input id="ssTol" type="range" min="0" max="2" step="1"/>
              </label>
              <div id="ssSemanticGroup" class="ss-group" hidden>
                <div class="ss-grouphead">Semantic ranking</div>
                <label class="ss-field">
                  <span class="ss-label">Semantic ↔ lexical<span id="ssWeightOut" class="ss-val"></span></span>
                  <input id="ssWeight" type="range" min="0" max="1" step="0.05"/>
                </label>
                <label class="ss-field">
                  <span class="ss-label">Min. semantic cosine<span id="ssMinOut" class="ss-val"></span></span>
                  <input id="ssMin" type="range" min="0" max="0.8" step="0.05"/>
                </label>
              </div>
              </div>
              <div id="ssPane-look" class="ss-pane" role="tabpanel" aria-labelledby="ssTab-look" data-tab="look" hidden>
              <div class="ss-group">
                <div class="ss-grouphead">Appearance</div>
                <div class="ss-field ss-field-row">
                  <span class="ss-label">Theme</span>
                  <div class="ss-seg" role="radiogroup" aria-label="Theme">
                    <button type="button" role="radio" data-oa-theme="dark" aria-checked="${theme === "dark"}">Dark</button>
                    <button type="button" role="radio" data-oa-theme="light" aria-checked="${theme === "light"}">Light</button>
                    <button type="button" role="radio" data-oa-theme="mint" aria-checked="${theme === "mint"}">Mint</button>
                  </div>
                </div>
                <div class="ss-field ss-field-row">
                  <span class="ss-label">Abstract layout</span>
                  <div class="ss-seg" role="radiogroup" aria-label="Abstract layout">
                    <button id="ssAbsFlow" type="button" role="radio" aria-checked="true" title="One flowing paragraph">Paragraph</button>
                    <button id="ssAbsLines" type="button" role="radio" aria-checked="false" title="Each sentence on its own line">Sentences</button>
                  </div>
                </div>
                <div class="ss-field ss-field-row">
                  <span class="ss-label">Category chips</span>
                  <div class="ss-seg" role="radiogroup" aria-label="Category chip style">
                    <button id="ssChipDot" type="button" role="radio" aria-checked="true">Dot</button>
                    <button id="ssChipFill" type="button" role="radio" aria-checked="false">Filled</button>
                  </div>
                </div>
                <div class="ss-field ss-field-row">
                  <span class="ss-label">Graphs start</span>
                  <div class="ss-seg" role="radiogroup" aria-label="Where graphs start">
                    <button id="ssGraphField" type="button" role="radio" aria-checked="false" title="Every graph starts in 1997-02: one timeline for all">1997-02</button>
                    <button id="ssGraphData" type="button" role="radio" aria-checked="true" title="Each graph starts at its first value">First value</button>
                  </div>
                </div>
              </div>
              </div>
              <div id="ssPane-read" class="ss-pane" role="tabpanel" aria-labelledby="ssTab-read" data-tab="read" hidden>
              <div class="ss-group">
                <div class="ss-grouphead">Reference style</div>
                <label class="ss-field">
                  <div class="ss-selectwrap"><select id="ssCiteStyle" aria-label="Reference style"></select></div>
                </label>
              </div>
              <div id="ssTtsGroup" class="ss-group" hidden>
                <div class="ss-grouphead">Reader</div>
                <label class="ss-field">
                  <span class="ss-label">Voice</span>
                  <div class="ss-selectwrap"><select id="ssTtsVoice" aria-label="Reading voice"></select></div>
                </label>
                <label class="ss-field">
                  <span class="ss-label">Speed<span id="ssTtsRateOut" class="ss-val"></span></span>
                  <input id="ssTtsRate" type="range" aria-label="Reading speed"/>
                </label>
                <div class="ss-field ss-field-row">
                  <span class="ss-label">Highlight</span>
                  <div class="ss-seg" role="radiogroup" aria-label="Read-along highlight">
                    <button id="ssTtsHlOn" type="button" role="radio" aria-checked="true">On</button>
                    <button id="ssTtsHlOff" type="button" role="radio" aria-checked="false">Off</button>
                  </div>
                </div>
              </div>
              </div>
              <div class="ss-actions">
                <!-- Replays the first-visit tour (browser-tour.js; table-gate.js wires it). -->
                <button id="ssTour" type="button" class="ss-btn" title="Replay the guided tour of the browser">Show the tour</button>
                <button id="ssReset" type="button" class="ss-reset">Reset search</button>
              </div>
              <!-- The table's way to the legal notice, on every tab; German like the page it opens. -->
              <nav class="ss-legal" aria-label="Rechtliches" lang="de">
                <a href="rechtliches.html#impressum">Impressum</a>
                <span aria-hidden="true">·</span>
                <a href="rechtliches.html#datenschutz-details">Datenschutz</a>
                <span aria-hidden="true">·</span>
                <a href="rechtliches.html#lizenzen">Lizenzen</a>
              </nav>
            </div>
          </div>
        </div>
      </div>
      <div id="ruleBuilderBody" class="rule-builder-body" hidden>
        <div class="rule-expression-row">
          <div id="ruleExpression" class="rule-expression">No Rule Filter</div>
          <button id="ruleBuilderHide" type="button" class="rule-builder-hide"
                  aria-label="Hide the Rule Builder" title="Hide the Rule Builder &#10;The filter stays applied"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6"></path></svg></button>
        </div>
        <div id="ruleBuilderContainer"></div>
      </div>
    </div>
    <div class="grid-wrap">
      <div id="myGrid" class="slick-container slick-alpine-theme"></div>
      <div id="authorFooter" class="author-footer" hidden aria-label="Author summary"></div>
      <aside id="authorPanel" class="author-panel" hidden aria-label="Article metrics and affiliations, author metrics and topic trends"><div class="ap-part" data-part="article" hidden></div><div class="ap-part" data-part="affil" hidden></div><div class="ap-part" data-part="author" hidden></div><div class="ap-part" data-part="topics" hidden></div></aside>
      <div id="emptyState" class="empty-state" hidden>
        <div class="empty-state-inner">
          <p class="empty-state-headline">No articles match the current filters</p>
          <p class="empty-state-subline">Try removing or relaxing a condition:</p>
          <ul id="emptyStateSuggest" class="empty-state-suggest" hidden></ul>
          <div class="empty-state-actions">
            <button id="emptyStateAnyWord" type="button" hidden>Match any word</button>
            <button id="emptyStateClearAll" type="button">Clear all filters</button>
            <button id="emptyStateRemoveLast" type="button">Remove last filter</button>
          </div>
        </div>
      </div>
    </div>
    <datalist id="authorSuggestions"></datalist>
    <datalist id="keywordSuggestions"></datalist>
    <datalist id="venueSuggestions"></datalist>
    <datalist id="categorySuggestions"></datalist>
  `;
  }
  window.OAGridShell = Object.freeze({ html: html });
})();
