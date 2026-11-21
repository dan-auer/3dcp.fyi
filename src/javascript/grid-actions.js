/* grid-actions.js - what a click, Enter or Space in the article table does: a
 * keyword, category, author, venue or date chip toggles its filter; a row's
 * buttons copy the citation, download BibTeX, open the PDF or the abstract;
 * "+N" opens the keyword / author popover. Also applyRulePicks, the picks the
 * author panel sends. attach(ctx) wires it; ctx.rowSel is read live (the row
 * selection is attached after this, in the same synchronous init).
 */
(function () {
  "use strict";

  function attach(ctx) {
    const { FIELD_ALIASES, absRows, applyDateCellFilter, batchRepaint, copyCitation, dataView, dateModeFromKey, dateModeFromMouse, downloadBibtex, dropAuthorForPin, flushKeywordClamp, grid, lookupArticle, markNavigation, matchingIds, normalizeText, openPdf, renderers, ruleEditor, ruleTree, scope, searchController, toggleAbstract, toggleFieldRule } = ctx;
    // Rule picks from the author panel (author-panel.js): a name or a count
    // there filters the list the way a chip in the table does. `replace` swaps
    // the whole rule set for the picks (the panel's plain click); otherwise
    // each is toggled onto the current rules, `ensure` ones only added when
    // missing (the author's own AUTHOR IS rule).
    const RULE_PICK_FIELDS = ["keyword", "category", "author", "venue", "citesAuthor", "citedByAuthor"];
    function applyRulePicks(picks, replace) {
      const clean = (Array.isArray(picks) ? picks : []).filter(function (p) {
        return p && RULE_PICK_FIELDS.indexOf(p.field) >= 0 && typeof p.value === "string" && p.value;
      }).map(function (p) {
        return { field: p.field, operator: p.operator === "is not" ? "is not" : "is", value: p.value, ensure: !!p.ensure };
      });
      if (!clean.length) return;
      if (replace) {
        markNavigation();   // a history entry, as a click in the table makes
        ruleEditor.replaceRules(clean.map(function (p) { return { field: p.field, operator: p.operator, value: p.value }; }));
        return;
      }
      clean.forEach(function (p) {
        if (p.ensure && ruleEditor.facetIsActive({ field: p.field, operator: p.operator, value: p.value })) return;
        toggleFieldRule(p.field, p.operator, p.value);
      });
    }

    scope.listen(document.getElementById("myGrid"), "click", function (event) {
      // "Favorite all in view" header star - favorite every visible row, or
      // clear them if all are already saved. Checked before the per-row toggle.
      const favAllBtn = event.target.closest(".oa-fav-all");
      if (favAllBtn) {
        event.preventDefault();
        event.stopPropagation();
        const ids = matchingIds();
        // One click in a header row users also click to sort can grab - or
        // silently drop - thousands of saves; confirm past a threshold so a
        // misclick can't rewrite the reading list. Unfiltered, "all in view"
        // is the entire corpus.
        const removing = window.OAFavorites.hasAll(ids);
        const apply = function () {
          if (removing) window.OAFavorites.removeMany(ids);
          else window.OAFavorites.addMany(ids);
        };
        if (ids.length > 100) {
          window.OADialog.confirmDialog({
            title: (removing ? "Remove all " : "Favorite all ") + window.OATheme.fmtNum(ids.length) + " matching articles" + (removing ? " from favorites?" : "?"),
            confirmLabel: removing ? "Remove all" : "Favorite all",
            danger: removing
          }).then(scope.guard(function (ok) { if (ok) apply(); }));
        } else {
          apply();
        }
        return;
      }

      // Star toggle - favorite / unfavorite this article. Handled before the
      // filter-link logic and bailed out early so it never selects the row or
      // opens the article.
      const favBtn = event.target.closest(".oa-fav-toggle");
      if (favBtn) {
        event.preventDefault();
        event.stopPropagation();
        const favId = favBtn.getAttribute("data-fav-id");
        // Excel semantics: starring a row that is part of the current
        // multi-selection applies to the WHOLE selection - add all, or
        // remove all when every one is already saved. The store's onChange
        // repaints every star on the page.
        if (ctx.rowSel.count() > 1 && ctx.rowSel.has(favId)) {
          const ids = ctx.rowSel.ids();
          if (window.OAFavorites.hasAll(ids)) window.OAFavorites.removeMany(ids);
          else window.OAFavorites.addMany(ids);
        } else {
          window.OAFavorites.toggle(favId);
          window.OAFavorites.syncButton(favBtn);
        }
        return;
      }

      // BibTeX button: before the link logic so it never selects the row.
      const bibBtn = event.target.closest(".oa-bib-btn");
      if (bibBtn) {
        event.preventDefault();
        event.stopPropagation();
        downloadBibtex(bibBtn.getAttribute("data-bib-id"));
        return;
      }

      // Leftmost chevron: add/remove this row's abstract in the reading panel.
      // Handled here (before the link logic) so it never selects the row or
      // navigates to the article.
      const absBtn = event.target.closest(".abstract-toggle");
      if (absBtn) {
        event.preventDefault();
        event.stopPropagation();
        toggleAbstract(absBtn.getAttribute("data-abs-id"));
        return;
      }

      // Group header rows toggle on a click ANYWHERE in the row, not only on
      // the ~14px chevron (WCAG 2.5.8 - every other icon action already got a
      // >=24px hit area). The chevron itself stays with the SlickGrid provider,
      // whose handler stops propagation before this delegate sees it; the
      // closest() guard is belt-and-braces. A live text selection bails so
      // copying a venue name out of a header doesn't collapse it.
      const groupRowEl = event.target.closest(".slick-row.slick-group");
      if (groupRowEl) {
        if (event.target.closest(".slick-group-toggle")) return;
        if (String(window.getSelection())) return;
        const gCell = grid.getCellFromEvent(event);
        const gItem = gCell ? grid.getDataItem(gCell.row) : null;
        if (gItem && gItem.__group && gItem.groupingKey != null) {
          event.preventDefault();
          if (gItem.collapsed) dataView.expandGroup(gItem.groupingKey);
          else dataView.collapseGroup(gItem.groupingKey);
        }
        return;
      }

      const citeBtn = event.target.closest(".oa-cite-btn");
      if (citeBtn) {
        event.preventDefault();
        event.stopPropagation();
        copyCitation(citeBtn.getAttribute("data-cite-id"));
        return;
      }

      const pdfBtn = event.target.closest(".oa-pdf-btn");
      if (pdfBtn) {
        event.preventDefault();
        event.stopPropagation();
        openPdf(pdfBtn.getAttribute("data-pdf-id"));
        return;
      }

      // "+N" markers (keywords, categories, authors): open what the cell had
      // no room for (before .keyword-link, whose class the keyword marker shares).
      const moreBtn = event.target.closest(".keyword-more, .cat-more, .author-etal");
      if (moreBtn) {
        event.preventDefault();
        event.stopPropagation();
        openKeywordPopover(moreBtn);
        return;
      }

      const keywordLink = event.target.closest(".keyword-link");
      const catChip = event.target.closest(".oa-cat-chip");
      const authorLink = event.target.closest(".author-link");
      const venueLink = event.target.closest(".venue-link");
      const dateLink = event.target.closest(".date-link");
      const oaLink = event.target.closest(".oa-link");
      const titleLink = event.target.closest(".title-link");
      // Citation-graph tiles in the abstract drop's records strip: links to the
      // filtered list on other pages, an in-place rule here.
      const graphLink = event.target.closest(".oa-graph-link");

      // Ctrl / Cmd + click on a real link is the browser's own "open in a new
      // tab" - let it through (the href is the same view the plain click builds
      // here) instead of filtering in place.
      const hrefLink = titleLink || authorLink || keywordLink || graphLink;
      if (hrefLink && (event.ctrlKey || event.metaKey) && hrefLink.hasAttribute("href")) return;

      if (!keywordLink && !catChip && !authorLink && !venueLink && !dateLink && !oaLink && !titleLink && !graphLink) {
        // No chip / link clicked: Shift clicks (and the tail click of a
        // drag-select) mark rows Excel-style; a plain click falls through to
        // the row's abstract toggle (and re-anchors the selection).
        if (ctx.rowSel.handleClick(event)) return;
        absRows.handleBody(event);
        return;
      }
      // Only the primary button filters. Shift is a modifier for the graph
      // tiles (see below), so it is let through there.
      if (event.button !== 0 || (event.shiftKey && !graphLink)) {
        // Shift+click on a chip or a title is still the row-range gesture - the
        // chip's own action is a PLAIN-click affordance.
        if (event.shiftKey && !graphLink) ctx.rowSel.handleClick(event);
        return;
      }
      event.preventDefault();

      if (keywordLink) {
        toggleFieldRule("keyword", "is", keywordLink.dataset.keyword);
      } else if (catChip) {
        toggleFieldRule("category", "is", catChip.dataset.category);
      } else if (authorLink) {
        toggleFieldRule("author", "is", authorLink.dataset.author);
      } else if (venueLink) {
        toggleFieldRule("venue", "is", venueLink.dataset.venue);
      } else if (dateLink) {
        applyDateCellFilter(dateLink.dataset.date, dateModeFromMouse(event));
      } else if (oaLink) {
        toggleFieldRule("openAccess", "is", oaLink.dataset.oa);
      } else if (titleLink) {
        // Focus mode: pin the list to this article (ID IS <key>) - the crumb
        // shows its short link (3dcp.fyi/<key>) and its abstract opens, with
        // the graph metrics below it. A second click on the same title lifts
        // the pin. From the anchor strip the title asks a
        // NEW question (this article, not its neighbourhood), so it replaces
        // the graph rule - ANDed to it, the anchor itself could never match.
        const tid = titleLink.dataset.id;
        batchRepaint(function () {
          if (titleLink.closest(".oa-anchor-row")) { ruleTree.rows = []; absRows.clear(); }
          const wasPinned = ruleTree.rows.some(function (r) {
            return !r.disabled && r.field === "id" && r.operator === "is" && normalizeText(r.value) === normalizeText(tid);
          });
          if (!wasPinned) dropAuthorForPin(tid);
          // The pin opens its abstract itself (syncAuthorPanel).
          toggleFieldRule("id", "is", tid);
        });
        flushKeywordClamp();
      } else if (graphLink) {
        // An empty neighbourhood renders as an inert tile (aria-disabled, no
        // href): swallow the click so it neither filters nor selects the row.
        if (graphLink.getAttribute("aria-disabled") === "true") { event.stopPropagation(); return; }
        // The graph tiles ask a NEW question about one article ("what does it
        // cite?"), so they REPLACE the rule set - the same list the tile's own
        // link (index.html?q=REFERENCES_OF "id") would open. Adding the rule on
        // top of an AUTHOR IS / DATE rule mostly ANDed to an empty table.
        // The search ends with the rules, box and all: the text left in the
        // box ran it again inside the new rule, and the tile's count did not
        // match the list. Shift-click keeps the rules and the search, and
        // combines.
        const fieldKey = FIELD_ALIASES[String(graphLink.dataset.graphRule || "").toLowerCase()];
        if (fieldKey) {
          if (!event.shiftKey) {
            ruleTree.rows = [];
            searchController.clearBox();
          }
          // A new question about the graph is a new list: the abstract that was
          // open (the one the tile sits in) must not carry over into it.
          absRows.clear();
          toggleFieldRule(fieldKey, "is", graphLink.dataset.graphId, true);
        }
      }
    });

    // Keyboard parity for the non-anchor filter affordances. Keyword / author
    // chips are real <a> elements, so Enter already fires a click the delegate
    // above turns into a filter; venue / date / OA / category are spans, so
    // wire Enter + Space here to trigger the same toggle (they all carry
    // role="button" + tabindex="0", so they're focusable and announce as
    // buttons). Capture phase: grid-keys.js keeps Enter away from SlickGrid's
    // canvas handler (which cancels it) by stopping it on its way down.
    scope.listen(document.getElementById("myGrid"), "keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const el = event.target.closest(".venue-link, .date-link, .oa-link, .oa-cat-chip, .keyword-more, .cat-more, .author-etal");
      if (!el) {
        return;                         // anchors (keyword/author) use native click
      }
      event.preventDefault();           // Space must not scroll the grid canvas
      if (el.matches(".keyword-more, .cat-more, .author-etal")) {
        openKeywordPopover(el);
      } else if (el.classList.contains("venue-link")) {
        toggleFieldRule("venue", "is", el.dataset.venue);
      } else if (el.classList.contains("date-link")) {
        applyDateCellFilter(el.dataset.date, dateModeFromKey(event));
      } else if (el.classList.contains("oa-link")) {
        toggleFieldRule("openAccess", "is", el.dataset.oa);
      } else if (el.classList.contains("oa-cat-chip")) {
        toggleFieldRule("category", "is", el.dataset.category);
      }
    }, true);

    /* "+N" popover: what a cell had no room for, as the same live controls -
       hidden keywords and categories (click filters, right-click joins with
       OR) and the whole ordered author list (click filters, right-click shows
       the author's metrics; ORCID marks open the registry). The markers'
       tooltips were the only way in, which touch and keyboard do not have. */
    const kwPop = document.createElement("div");
    kwPop.className = "kw-pop";
    kwPop.setAttribute("role", "dialog");
    kwPop.setAttribute("aria-label", "More keywords");
    kwPop.hidden = true;
    (document.querySelector(".articles-app") || document.body).appendChild(kwPop);
    scope.add(function () { kwPop.remove(); });
    let kwPopFrom = null, kwPopRelease = null;
    function closeKeywordPopover(refocus) {
      if (kwPop.hidden) return;
      kwPop.hidden = true;
      kwPop.innerHTML = "";
      if (kwPopRelease) { kwPopRelease(); kwPopRelease = null; }
      const from = kwPopFrom;
      kwPopFrom = null;
      if (refocus && from && from.isConnected) from.focus({ preventScroll: true });
    }
    function hiddenIn(cell, selector, attr) {
      return cell ? Array.prototype.filter.call(cell.querySelectorAll(selector), function (c) {
        return c.style.display === "none";
      }).map(function (c) { return c.getAttribute(attr) || ""; }).filter(Boolean) : [];
    }
    function morePopoverContent(more) {
      if (more.classList.contains("author-etal")) {
        const item = lookupArticle(more.getAttribute("data-id") || "");
        const authors = (item && item.authors) || [];
        if (!authors.length) return null;
        return { label: "All " + authors.length + " authors", html: '<ol class="kw-pop-authors">' +
          authors.map(function (a) { return "<li>" + renderers.authorLinkHtml(a, false) + "</li>"; }).join("") + "</ol>" };
      }
      if (more.classList.contains("cat-more")) {
        const cats = hiddenIn(more.closest(".category-cell"), ".oa-cat-chip", "data-category");
        if (!cats.length) return null;
        return { label: "More categories", html: '<div class="category-cell">' +
          cats.map(function (abbr) { return renderers.categoryChipHtml(abbr, false); }).join("") + "</div>" };
      }
      const kws = hiddenIn(more.closest(".keyword-cell"), ".keyword-link:not(.keyword-more)", "data-keyword");
      return kws.length ? { label: "More keywords", html: kws.map(renderers.keywordLinkHtml).join("") } : null;
    }
    function openKeywordPopover(more) {
      if (!kwPop.hidden && kwPopFrom === more) { closeKeywordPopover(true); return; }
      const content = morePopoverContent(more);
      if (!content) return;
      kwPop.innerHTML = content.html;
      kwPop.setAttribute("aria-label", content.label);
      kwPop.hidden = false;
      kwPopRelease = window.OATheme.popover("more", function () { closeKeywordPopover(false); });
      kwPopFrom = more;
      const r = more.getBoundingClientRect(), pw = kwPop.offsetWidth, ph = kwPop.offsetHeight;
      const top = (window.innerHeight - r.bottom - 8 >= ph || r.top < ph + 8) ? r.bottom + 4 : r.top - ph - 4;
      kwPop.style.top = Math.round(Math.max(8, Math.min(top, window.innerHeight - ph - 8))) + "px";
      kwPop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - pw - 8))) + "px";
      const first = kwPop.querySelector(".keyword-link, .oa-cat-chip, .author-link");
      if (first) first.focus({ preventScroll: true });
    }
    function popoverPick(k) {
      closeKeywordPopover(false);
      if (k.classList.contains("author-link")) toggleFieldRule("author", "is", k.dataset.author);
      else if (k.classList.contains("oa-cat-chip")) toggleFieldRule("category", "is", k.dataset.category);
      else toggleFieldRule("keyword", "is", k.dataset.keyword);
    }
    scope.listen(kwPop, "click", function (event) {
      const k = event.target.closest(".keyword-link, .oa-cat-chip, .author-link");
      if (!k || event.button !== 0) return;   // ORCID marks: the browser's own link
      if ((event.ctrlKey || event.metaKey) && k.hasAttribute("href")) return;   // browser: new tab
      event.preventDefault();
      popoverPick(k);
    });
    scope.listen(kwPop, "contextmenu", function (event) {
      const k = event.target.closest(".keyword-link, .oa-cat-chip, .author-link");
      if (!k) return;
      event.preventDefault();
      closeKeywordPopover(false);
      markNavigation();   // a history entry, as the left button's pick makes
      if (k.classList.contains("author-link")) ruleEditor.pinAuthor(k.dataset.author);
      else if (k.classList.contains("oa-cat-chip")) ruleEditor.toggleTopicOr("category", k.dataset.category);
      else ruleEditor.toggleTopicOr("keyword", k.dataset.keyword);
    });
    scope.listen(kwPop, "keydown", function (event) {
      if (event.key === "Escape") { event.stopPropagation(); closeKeywordPopover(true); return; }
      // Category chips are spans: Enter / Space filters, as in the cell.
      const chip = event.target.closest(".oa-cat-chip");
      if (chip && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        popoverPick(chip);
      }
    });
    scope.listen(document, "mousedown", function (event) {
      if (kwPop.hidden || kwPop.contains(event.target) || (kwPopFrom && kwPopFrom.contains(event.target))) return;
      closeKeywordPopover(false);
    }, true);
    scope.listen(window, "resize", function () { closeKeywordPopover(false); });
    scope.subscribe(grid.onScroll, function () { closeKeywordPopover(false); });
    return { applyRulePicks: applyRulePicks };
  }

  window.OAGridActions = Object.freeze({ attach: attach });
})();
