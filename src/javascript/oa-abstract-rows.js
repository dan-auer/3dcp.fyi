/* oa-abstract-rows.js
 * Shared inline-abstract "drop-down" for the SlickGrid tables on 3dcp.fyi.
 *
 * Used by the main Articles table (articles-grid.js), whose source is a
 * Slick DataView with search / filter / grouping.
 *
 * SlickGrid reads every row through getLength / getItem / getItemMetadata on
 * its data source, regardless of whether that source is a DataView or a plain
 * array. This module installs an overlay over those three methods that splices
 * synthetic "detail" rows in beneath any expanded row: because a SlickGrid row
 * has a CONSTANT height, the drop is reserved by k fixed-height detail rows (1
 * head that the abstract text overflows across + k-1 spacers). The underlying
 * items are never touched, so sort / filter / group / favorites keep working
 * and each drop follows its parent row.
 *
 * window.OAAbstractRows.create(config) -> a per-grid controller. See create().
 * Depends only on window.OATheme (escapeHtml), which every grid page loads
 * before this file.
 */
(function () {
  "use strict";

  var esc = window.OATheme.escapeHtml;

  // Right-pointing chevron; CSS rotates it 90deg when its row is open.
  var CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"></path></svg>';

  /* ---------------- abstract text (shared) ---------------- */

  // Per-item abstract fetch state (in-flight / already-attempted). Kept in a
  // Every live controller on the page, so module-level helpers can reach them.
  var liveControllers = [];
  var sourceOwners = new WeakMap();
  // How the reader has folded each TOC, per article id: Map<sectionNum, bool>.
  // Kept here rather than in the DOM because the drop's markup is regenerated
  // whenever the grid re-renders the row - a fold recorded only as aria-expanded
  // would be lost on the very re-render that folding triggers.
  var tocFoldByArticle = new Map();
  // The drop's TOC opens fully expanded - the reader folds what they don't
  // want (and that choice sticks). 0 = never default-fold.
  var DROP_TOC_COLLAPSE_BELOW = 0;

  // The dataset's own abstract (a string, or an array of sentences like the
  // single-article page uses) as one trimmed string; "" when there is none.
  function abstractText(item) {
    if (item && item.abstract != null && String(item.abstract).trim() !== "") {
      var raw = Array.isArray(item.abstract)
        ? item.abstract.join(" ")
        : String(item.abstract);
      return raw.trim();
    }
    return "";
  }

  // Inner HTML of a drop: just the abstract text (title/authors/venue/date are
  // already in the row).
  // Escape text and wrap case-insensitive literal hits of the rule-builder's
  // "contains" needles (window.OARuleHighlights) in the same mark style the
  // search highlight uses. Falls back to plain esc() when no needles.
  // Shown typeset (CO2 -> CO₂, oa-typeset.js); needles match either spelling.
  // Both mappings keep the length, so offsets found on the folded copy mark
  // the right characters of the typeset text.
  var typeset = window.OATypeset.text, fold = window.OATypeset.fold;
  function escMark(text) {
    var t = typeset(String(text == null ? "" : text));
    var needles = window.OARuleHighlights;
    if (!needles || !needles.length) return esc(t);
    var lc = fold(t.toLowerCase()), marks = [];
    for (var n = 0; n < needles.length; n += 1) {
      var nd = fold(String(needles[n] || "").toLowerCase());
      if (!nd) continue;
      var from = 0, at;
      while ((at = lc.indexOf(nd, from)) !== -1) { marks.push([at, at + nd.length]); from = at + nd.length; }
    }
    if (!marks.length) return esc(t);
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    for (var i = 0; i < marks.length; i += 1) {
      var m = marks[i], last = merged[merged.length - 1];
      if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
      else merged.push([m[0], m[1]]);
    }
    var out = "", cur = 0;
    for (var k = 0; k < merged.length; k += 1) {
      out += esc(t.slice(cur, merged[k][0])) +
        '<mark class="oa-hl-lexical">' + esc(t.slice(merged[k][0], merged[k][1])) + "</mark>";
      cur = merged[k][1];
    }
    return out + esc(t.slice(cur));
  }

  // Compact table-of-contents (right third of the drop) from the central
  // store data/toc_data.js: window.TOC_DATA[id] = [[path[], title, page], ...].
  // Compact table-of-contents (right side of the drop) from the central store
  // data/toc_data.js: window.TOC_DATA[id] = [[path[], title, page], ...].
  // Rendered by the shared toc.js renderer, in the same markup as the article
  // page's rail card, so one stylesheet (.oa-ptoc) covers both.
  function tocHtml(item) {
    var rows = item && item.id && window.TOC_DATA ? window.TOC_DATA[item.id] : null;
    if (!rows || !rows.length || !window.tocHtml) return "";
    var ss = window.OASemanticSearch;
    // Two highlight sources feed the TOC: the active search query (lexical hits,
    // null when no query is running) and the rule-builder's "contains" needles -
    // a TOC CONTAINS "..." rule marks its needle in the TOC titles exactly as it
    // already does in the abstract text. Search hits win when both are live.
    var needles = window.OARuleHighlights;
    var hasNeedles = !!(needles && needles.length);
    var highlight = ((ss && ss.highlightText) || hasNeedles)
      ? function (t) {
          var marked = (ss && ss.highlightText) ? ss.highlightText(t) : null;
          if (marked) return marked;
          return hasNeedles ? escMark(t) : null;
        }
      : null;
    var list = window.tocHtml(rows, {
      highlight: highlight,
      foldState: tocFoldByArticle.get(item.id),
      collapseBelowLevel: DROP_TOC_COLLAPSE_BELOW
    });
    if (!list) return "";
    return '<nav class="abs-toc oa-ptoc"><div class="abs-sec-headrow"><div class="abs-sec-head">Table of Contents</div>' +
      tocToolsHtml() + "</div>" + list + "</nav>";
  }

  // Bulk fold controls beside the TOC label. Markup only; the delegated click
  // handler at the bottom of this file owns the behaviour (the drop's markup is
  // regenerated on every grid render, so nothing may be bound per node).
  // Glyphs: the Tabler plus / minus the toolbar's group toggle uses. "All" is
  // the heavy stroke, "one level" the light one.
  var TOC_PLUS = '<path d="M12 5l0 14"></path><path d="M5 12l14 0"></path>';
  var TOC_MINUS = '<path d="M5 12l14 0"></path>';
  var TOC_TOOLS = [
    ["open-all", TOC_PLUS, "Expand all sections", "is-all"],
    ["open-next", TOC_PLUS, "Expand one more level", ""],
    ["close-next", TOC_MINUS, "Collapse the deepest open level", ""],
    ["close-all", TOC_MINUS, "Collapse all sections", "is-all"]
  ];
  function tocToolsHtml() {
    return '<div class="abs-toc-tools" role="group" aria-label="Fold or unfold sections">' +
      TOC_TOOLS.map(function (t) {
        return '<button type="button" class="abs-toc-tool' + (t[3] ? " " + t[3] : "") + '" data-toc-fold="' + t[0] + '" title="' + t[2] +
          '" aria-label="' + t[2] + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="' + (t[3] ? "2.75" : "2") +
          '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t[1] + "</svg></button>";
      }).join("") + "</div>";
  }

  // Read the rendered TOC (the markup is the truth for what is folded right
  // now - it already merges the reader's choices with the default fold), pick
  // the sections the action touches, and fold them. "Next" steps one depth
  // tier at a time: expand opens the shallowest tier that still has a fold,
  // collapse closes the deepest tier that still has anything open.
  function tocFoldAction(dropEl, action) {
    var nav = dropEl && dropEl.querySelector(".abs-toc");
    if (!nav) return;
    var entries = Array.prototype.map.call(nav.querySelectorAll(".entry.has-children"), function (el) {
      var toggle = el.querySelector(".toggle"), num = el.querySelector(".num");
      var level = (/level-(\d+)/.exec(el.className) || [0, 1])[1];
      return { el: el, toggle: toggle, num: num ? num.textContent : "", level: Number(level),
        open: !!toggle && toggle.getAttribute("aria-expanded") === "true" };
    }).filter(function (e) { return e.toggle && e.num; });
    if (!entries.length) return;
    var collapse = action === "close-all" || action === "close-next";
    var picked = entries.filter(function (e) { return e.open === collapse; });
    if (!picked.length) return;
    if (action === "open-next" || action === "close-next") {
      var tier = picked.reduce(function (n, e) { return collapse ? Math.max(n, e.level) : Math.min(n, e.level); }, picked[0].level);
      picked = picked.filter(function (e) { return e.level === tier; });
    }
    var id = dropEl.getAttribute("data-abs-drop");
    var state = id && tocFoldByArticle.get(id);
    if (id && !state) { state = new Map(); tocFoldByArticle.set(id, state); }
    picked.forEach(function (e) {
      e.toggle.setAttribute("aria-expanded", String(!collapse));
      var ol = e.el.parentElement && e.el.parentElement.querySelector(":scope > ol");
      if (ol) ol.hidden = collapse;
      if (state) state.set(String(e.num), collapse);
    });
    if (!id) return;
    liveControllers.forEach(function (c) {
      if (c.invalidateDrop) c.invalidateDrop(id);
      if (c.reconcile) { try { c.reconcile(); } catch (err) { /* ignore */ } }
    });
  }
  document.addEventListener("click", function (event) {
    var btn = event.target.closest(".abs-drop .abs-toc-tool[data-toc-fold]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    tocFoldAction(btn.closest(".abs-drop"), btn.getAttribute("data-toc-fold"));
  });

  // Compact external-records strip (Discovery / Metadata / Metrics tile groups;
  // shared catalogue + renderer in ext-records.js) shown above abstract + TOC.
  function extStrip(item) {
    var xr = window.OAExtRecords;
    if (!xr || !xr.renderStrip) return "";
    try { return xr.renderStrip(item) || ""; } catch (e) { return ""; }
  }

  // "Abstract" label, optionally paired with the read-aloud button and any
  // extra head content the host supplies (the search score badges). The button
  // is markup only - oa-tts.js owns the click (delegated) and stamps the
  // playing state after every render, so a memoised drop string stays valid.
  var speechLoad = null;
  // Length of the abstract as "N words · M sentences": sentences come from
  // the dataset's sentence array when it ships as one (a string abstract is
  // split on terminal punctuation), words from whitespace runs of the text.
  function absStatsHtml(item, text) {
    var sents = (item && Array.isArray(item.abstract)) ? item.abstract.filter(function (s) { return s != null && String(s).trim(); }).length : 0;
    if (!sents) sents = (String(text || "").match(/[.!?]+(?=\s|$)/g) || []).length || 1;
    var words = (String(text || "").trim().match(/\S+/g) || []).length;
    if (!words) return "";
    var fmt = window.OATheme.fmtNum;
    return '<span class="abs-sec-stats" title="Abstract length">' + fmt(words) + " word" + (words === 1 ? "" : "s") +
      " \u00b7 " + fmt(sents) + " sentence" + (sents === 1 ? "" : "s") + "</span>";
  }
  function secHeadHtml(id, readAloud, headExtra, stats) {
    if (readAloud && !window.OATTS && window.speechSynthesis && window.OAFeatures && !speechLoad) {
      speechLoad = window.OAFeatures.load("tts").then(function () {
        window.dispatchEvent(new CustomEvent("oa-tts-ready"));
      }).catch(function () { speechLoad = null; });
    }
    var btn = (readAloud && window.OATTS) ? window.OATTS.btnHtml(id) : "";
    var extra = "";
    if (typeof headExtra === "function") { try { extra = headExtra(id) || ""; } catch (e) { extra = ""; } }
    stats = stats || "";
    if (!btn && !extra && !stats) return '<div class="abs-sec-head">Abstract</div>';
    return '<div class="abs-sec-headrow"><div class="abs-sec-head">Abstract</div>' + btn + extra + stats + "</div>";
  }

  // Full drop markup: an optional host summary (metadata the responsive column
  // pass hid - see config.renderSummary), the records strip, the abstract body
  // and, when present, the TOC beside it.
  function dropShell(item, tocStr, bodyHtml, summary) {
    var strip = extStrip(item);
    var lead = (summary || "") + strip;
    if (tocStr) {
      return '<div class="abs-drop-inner abs-has-toc">' + lead +
        '<div class="abs-drop-main">' + bodyHtml + "</div>" + tocStr + "</div>";
    }
    return '<div class="abs-drop-inner">' + lead + bodyHtml + "</div>";
  }

  function dropInnerHtml(item, tocStr, readAloud, headExtra, summary, after) {
    var text = abstractText(item);
    var SEC_HEAD = secHeadHtml(item && item.id, readAloud, headExtra, text ? absStatsHtml(item, text) : "");
    var body;
    if (text) {
      // Real abstracts ship as a sentence array; they render as ONE flowing
      // justified paragraph (the .abs-sentence spans stay inline - they exist
      // only as hooks for semantic-search highlighting). A string abstract is
      // a single block.
      var sents = (item && Array.isArray(item.abstract)) ? item.abstract : null;
      if (sents && sents.length > 1) {
        var parts = sents.map(function (s) {
          return '<span class="abs-sentence">' + escMark(String(s == null ? "" : s)) + "</span>";
        });
        body = '<p class="abstract-card-text">' + parts.join(" ") + "</p>";
      } else {
        body = '<p class="abstract-card-text">' + escMark(text) + "</p>";
      }
      body = SEC_HEAD + body;
    } else {
      body = '<p class="abstract-card-empty">Abstract not available</p>';
    }
    return dropShell(item, tocStr, body + (after || ""), summary);
  }

  // Disclosure-chevron button for a row's expand cell.
  function chevronHtml(id, open) {
    return '<button type="button" class="abstract-toggle' + (open ? " is-open" : "") + '" ' +
      'data-abs-id="' + esc(id) + '" ' +
      'aria-expanded="' + (open ? "true" : "false") + '" ' +
      'aria-label="' + (open ? "Hide abstract" : "Show abstract") + '" ' +
      'title="' + (open ? "Hide abstract" : "Show abstract") + '">' +
      CHEVRON_SVG + "</button>";
  }

  /* ---------------- per-grid controller ---------------- */

  // create(config) installs the overlay and returns a controller.
  //
  // config:
  //   dataSource     REQUIRED. The object SlickGrid reads rows from; the three
  //                  overlay methods are installed onto it. For the main grid
  //                  this is the DataView itself; for a subset grid it's a
  //                  small {} passed to `new Slick.Grid(host, dataSource, ...)`.
  //   base           REQUIRED. The UNwrapped row accessors the overlay reads
  //                  real rows through: {getLength, getItem, getItemById,
  //                  getItemMetadata?}. (For the main grid, capture the
  //                  DataView's originals BEFORE calling create.)
  //   rowHeight      REQUIRED. px per grid row (drop height is a multiple).
  //   detailColId    REQUIRED. Column id the colspan:"*" detail cell attaches
  //                  to (use the leftmost column's id).
  //   grid           SlickGrid instance.
  //   maxDetailRows  height cap in rows (default 16; longer abstracts scroll).
  //   autoHeight     bool - grid uses autoHeight; resizeCanvas on row-count
  //                  change so the container grows/shrinks with the drop.
  //   mountNode      element the hidden measurement probe is appended to.
  //   getContentWidth  () => px fallback width when the canvas isn't measurable.
  //   isExpandable   (item) => bool override (default: any real data row).
  //   renderSummary  (item) => html placed at the top of the drop - the host's
  //                  stacked summary of metadata its columns cannot show at
  //                  the current width ("" for none).
  //   summarySig     () => string identifying the summary's inputs (e.g. the
  //                  hidden-column set), so the memoised drop HTML is rebuilt
  //                  when they change.
  //   renderAfter    (item) => html placed below the abstract, in its column
  //                  (the graph metrics section; "" for none).
  //   afterSig       () => string identifying renderAfter's inputs, like
  //                  summarySig.
  //   onChange       (openCount) => void after the open set changes.
  function create(config) {
    var previous = sourceOwners.get(config.dataSource);
    if (previous) {
      // A replacement on the same DataView must not use its bound overlay accessors.
      config = Object.assign({}, config, { base: previous.base });
      previous.controller.destroy();
    }
    var destroyed = false, boundGrid = null, reconcileFrame = 0;
    var source = config.dataSource;
    var sourceKeys = ["getLength", "getItem", "getItemMetadata"];
    var sourceDescriptors = sourceKeys.map(function (key) { return Object.getOwnPropertyDescriptor(source, key); });
    var ownedStyles = new Map();
    function setHostStyle(host, key, value) {
      var style = host.style;
      if (!ownedStyles.has(key)) ownedStyles.set(key, {
        value: style.getPropertyValue ? style.getPropertyValue(key) : "",
        priority: style.getPropertyPriority ? style.getPropertyPriority(key) : ""
      });
      var next = value == null ? "" : String(value);
      ownedStyles.get(key).current = next;
      // Do not dirty layout when repeated render/fit passes publish the same
      // geometry. Read actual ownership so an external style edit still wins
      // at destroy and is correctly refreshed at the next live update.
      if (style.getPropertyValue && style.getPropertyValue(key) === next) return;
      if (value == null) style.removeProperty(key); else style.setProperty(key, value);
    }
    var openAbstracts = new Map();   // id -> item (insertion = open order)
    var rowCount = new Map();        // id -> k (grid rows the drop reserves)
    var contentPx = new Map();       // id -> measured content height (px)
    // Geometry revision. It advances whenever an input to a card's height
    // changes (content/viewport width, column layout, paragraph/sentence
    // layout). measuredRev records the revision each card's height was taken
    // at; a card measured at an older revision is STALE. Stale offscreen cards
    // keep their last height as the estimate and are corrected from the live
    // DOM (reconcile) when they scroll into view - the eager re-measure is
    // bounded to the rendered range plus a buffer, never the browsing history.
    var geomRev = 1;
    var measuredRev = new Map();     // id -> geomRev the height was measured at
    function storeMeasure(id, h, k) {
      contentPx.set(id, h);
      rowCount.set(id, k == null ? rowsForPx(h) : k);
      measuredRev.set(id, geomRev);
    }
    // One compact span per logical row. Fine-row descriptors exist only for
    // rows the viewport requests, rather than four objects per article.
    var sourceRows = new Uint32Array(0);
    var dataHeads = new Uint8Array(0);  // keyboard eligibility per logical position
    var headSpans = new Uint32Array(0);
    var totalSpans = new Uint32Array(0);
    var spanTree = new Float64Array(1);
    var logicalCount = 0, displayLength = 0, sourceLength = -1, treeStep = 1;
    var positionsById = new Map();
    var indexedDrops = new Map();
    var descriptorCache = new Map();
    var DESCRIPTOR_CACHE_LIMIT = 2048;

    var base = config.base;
    var grid = config.grid || null;
    var rowHeight = config.rowHeight;
    var detailColId = config.detailColId;
    var maxDetailRows = config.maxDetailRows || 16;
    // Constant gap (px) kept between an open abstract's bottom (where its accent
    // line ends) and the next row. The card is GROWN to leave exactly this gap
    // rather than hugging its text and leaving the variable 0..rowHeight slack
    // that whole-row reservation produces - so every abstract, short or long,
    // ends the same distance above the next entry. rowsForPx() reserves the rows
    // for content + this gap; headFormatter() then sizes the card to reserved -
    // gap. Keep it a touch smaller than a logical row for a tidy rhythm.
    var DROP_GAP = 14;
    // Each logical (data / group) row is rendered as `dataSpan` stacked FINE
    // rows: a HEAD row that carries the real content (its cells forced to the
    // full logical height --oa-data-h, overflowing DOWN over the spacers) plus
    // dataSpan-1 empty SPACER rows. This shrinks the grid's row-reservation
    // quantum from a whole data row to a single fine row, so an expanded
    // abstract's whole-row reservation hugs its content within ~one fine row
    // (a small, uniform gap) instead of up to a full data row of empty space.
    var dataSpan = Math.max(1, config.dataSpan || 1);
    // Group HEADER / totals rows aren't split into a full data row's worth of
    // fine rows (they carry no abstract) but shouldn't collapse to a single
    // thin fine row either - they get their own modest span so a grouped table
    // reads with clear, evenly-sized section headers. Defaults to 2 fine rows.
    var groupSpan = dataSpan > 1 ? 2 : 1;
    // Data rows fit their content: a head's span comes from the host's estimate
    // (config.rowSpan) until the rendered row has been measured (fitRows), then
    // from that measurement. dataSpan is the ceiling. spanFloor is the lowest
    // span measured at the current column layout - the height of the cells
    // every row has (the icon stacks) - and lifts the text-only estimates.
    var fitSpans = dataSpan > 1 && typeof config.rowSpan === "function";
    var minSpan = Math.max(1, Math.min(dataSpan, 2));
    var measuredSpan = new Map();
    // Measurements per column layout (layout key -> { spans, floor, fresh }),
    // so a layout the table returns to - the wide Authors column switched on
    // and off with a pin - keeps its rows' heights instead of re-measuring
    // every row as it scrolls back into view.
    var spanCache = new Map();
    // config.tallId() names the one head allowed past the dataSpan ceiling -
    // the host's pinned article, listing all its authors - up to
    // config.tallMax fine rows. Read once per rebuild / fit pass, so the many
    // rows that are not it pay one comparison. Its span is kept apart
    // (tallSpan): measured once per layout, and the normal measurement of the
    // same row survives for when the pin goes.
    var tallMax = Math.max(dataSpan, config.tallMax | 0);
    var tallId = null, tallSpan = new Map();
    function syncTallId() { tallId = config.tallId ? config.tallId() : null; }
    // The tallest head allowed past the ceiling, as last measured (one at a
    // time: the host's pinned article). maxOpenRowSpan counts it, so the grid's
    // render buffer keeps the head - and its overflowing cells - while any of
    // it is in view.
    var tallHead = 0;
    // The stylesheet sizes heads up to the ceiling (oa-span-1..4); a taller
    // one gets its rule here, once per span (insertRule: no re-parse of the
    // rules already there).
    var tallSpanRules = new Set(), tallSpanSheet = null;
    function ensureSpanRule(span) {
      if (span <= dataSpan || tallSpanRules.has(span) || typeof document === "undefined") return;
      tallSpanRules.add(span);
      if (!tallSpanSheet) {
        var el = document.createElement("style");
        el.id = "oa-tall-spans";
        document.head.appendChild(el);
        tallSpanSheet = el.sheet;
      }
      try {
        tallSpanSheet.insertRule(".slick-row.oa-row-head.oa-span-" + span + "{--oa-data-h:calc(" + span + " * var(--oa-fine-h, 24px))}", tallSpanSheet.cssRules.length);
      } catch (e) { /* no CSSOM: the head keeps the ceiling's height */ }
    }
    // Spans measured before the webfonts arrived wrapped the fallback face's
    // lines: drop them all and re-measure the rendered rows.
    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded" && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (destroyed) return;
        measuredSpan.clear();
        spanCache.clear();
        tallSpan.clear();
        floorFresh = true;
        tallHead = 0;
        fitRows();
      });
    }
    var spanLayoutKey = null;
    var spanFloor = minSpan;
    var floorFresh = true;
    var fitPass = 0;
    if (config.mountNode && config.mountNode.style) {
      setHostStyle(config.mountNode, "--oa-data-h", (dataSpan * rowHeight) + "px");
      setHostStyle(config.mountNode, "--oa-group-h", (groupSpan * rowHeight) + "px");
      setHostStyle(config.mountNode, "--oa-fine-h", rowHeight + "px");
    }
    // Load the soft-hyphenation engine now, not on the first open: the first
    // drop otherwise painted unhyphenated, re-wrapped when the script landed and
    // re-reserved its rows - a visible flash. With the engine resident, both the
    // probe and the live cell are hyphenated synchronously and agree.
    window.OATheme.warmHyphenation();
    // Same for the read-aloud module: secHeadHtml lazy-loads it on the first
    // open and re-renders the drop once it lands to slot the Listen button in -
    // a second paint of the whole card, seen as a flash. Loaded now, the first
    // head row already carries the button. (The lazy path stays as a fallback
    // for an open that beats the download.)
    if (config.readAloud && !window.OATTS && window.speechSynthesis && window.OAFeatures && !speechLoad) {
      speechLoad = window.OAFeatures.load("tts").then(function () {
        window.dispatchEvent(new CustomEvent("oa-tts-ready"));   // settings panel wires its Reader controls on this
      }).catch(function () { speechLoad = null; });
    }

    function isExpandable(item) {
      return !!(item && item.id && !item.__group &&
                !item.__groupTotals && !item.__nonDataRow && !item.__absDetail);
    }

    // A "full-span" row is a real DATA row: it is split into `dataSpan` fine
    // rows and gets the head-overflow treatment (so an abstract's reservation
    // quantum is one fine row). GROUP HEADERS and group-totals rows are not -
    // they render as a single compact row, so grouping doesn't force-inflate
    // each header to a full data-row height with empty spacers beneath it.
    function isFullSpanRow(item) {
      return !!(item && !item.__group && !item.__groupTotals && !item.__nonDataRow);
    }
    // A group header / group-totals row (rendered by GroupItemMetadataProvider).
    function isGroupRow(item) {
      return !!(item && (item.__group || item.__groupTotals));
    }

    // Fenwick sums map a display row to its logical source in O(log n).
    // Disclosure changes update only affected spans, including every category
    // clone of an article. Sorting/filtering/grouping still calls rebuild().
    function spanStart(index) {
      var sum = 0;
      for (var i = index; i > 0; i -= i & -i) sum += spanTree[i];
      return sum;
    }
    function spanAt(row) {
      if (!Number.isInteger(row) || row < 0 || row >= displayLength) return -1;
      var index = 0, sum = 0;
      for (var step = treeStep; step; step = Math.floor(step / 2)) {
        var next = index + step;
        if (next <= logicalCount && sum + spanTree[next] <= row) {
          index = next;
          sum += spanTree[next];
        }
      }
      return index;
    }
    // Adjacent visible DATA head in display-row coordinates. The start can be
    // any fine row in the current logical band; its own band is excluded.
    // Positions, rather than article IDs, keep repeated category clones distinct.
    // Grouping/filtering supply only visible source rows at rebuild time. Moving
    // across them reads compact flags, not source records or rendered DOM nodes.
    // `includeGroups` also stops on group header rows (keyboard navigation
    // treats a group's disclosure as a stop of its own).
    function adjacentDataRow(displayRow, direction, includeGroups) {
      if (direction !== -1 && direction !== 1) return null;
      var logicalIndex = spanAt(displayRow);
      if (logicalIndex < 0) return null;
      for (logicalIndex += direction; logicalIndex >= 0 && logicalIndex < logicalCount; logicalIndex += direction) {
        if (dataHeads[logicalIndex]) return spanStart(logicalIndex);
        if (includeGroups && isGroupRow(base.getItem(sourceRows[logicalIndex]))) return spanStart(logicalIndex);
      }
      return null;
    }

    function descriptorAt(row) {
      var cached = descriptorCache.get(row);
      if (cached) return cached;
      var index = spanAt(row);
      if (index < 0) return undefined;
      var sub = row - spanStart(index), source = sourceRows[index];
      var entry;
      if (sub < headSpans[index]) entry = { t: sub === 0 ? 0 : 4, r: source };
      else {
        var item = base.getItem(source), p = sub - headSpans[index];
        entry = { t: p === 0 ? 1 : 2, id: item.id, p: p };
      }
      // Bounded even after visiting the entire dataset. Clear only the oldest
      // descriptor so repeatedly rendered viewport rows retain their objects.
      if (descriptorCache.size >= DESCRIPTOR_CACHE_LIMIT) {
        descriptorCache.delete(descriptorCache.keys().next().value);
      }
      descriptorCache.set(row, entry);
      return entry;
    }
    function setDropSpan(id, rows) {
      var positions = positionsById.get(id);
      if (positions === undefined) return;
      function update(index) {
        var total = headSpans[index] + rows;
        var delta = total - totalSpans[index];
        if (!delta) return;
        totalSpans[index] = total;
        displayLength += delta;
        for (var i = index + 1; i <= logicalCount; i += i & -i) spanTree[i] += delta;
      }
      if (Array.isArray(positions)) positions.forEach(update);
      else update(positions);
    }
    function updateDropSpans() {
      // Iteration is over the open set, never the article dataset. Keep the
      // previous reservation after close long enough to remove its span.
      indexedDrops.forEach(function (rows, id) {
        if (!openAbstracts.has(id)) { setDropSpan(id, 0); indexedDrops.delete(id); }
      });
      openAbstracts.forEach(function (item, id) {
        var rows = Math.max(1, rowCount.get(id) || 1);
        if (indexedDrops.get(id) !== rows) {
          setDropSpan(id, rows);
          indexedDrops.set(id, rows);
        }
      });
      descriptorCache.clear();
      rowStopsCache = null;
    }
    function headSpanFor(item) {
      if (!fitSpans || item.id == null) return dataSpan;
      if (tallId !== null && item.id === tallId) {
        // Its own measurement, else the host's estimate for a row listing
        // every author - so it first paints near its height, not at the
        // ceiling with the list cut off.
        var tall = tallSpan.get(item.id);
        if (tall) return tall;
        return Math.max(spanFloor, Math.min(tallMax, (config.rowSpan(item, true) | 0) || dataSpan));
      }
      var measured = measuredSpan.get(item.id);
      if (measured) return measured;
      var estimate = config.rowSpan(item) | 0;
      return Math.max(spanFloor, Math.min(dataSpan, estimate || dataSpan));
    }
    // A new column layout re-wraps every text cell: measurements taken at the
    // old one no longer hold. Returns true when they were dropped.
    function syncSpanKey() {
      if (!fitSpans) return false;
      var key = config.layoutKey ? String(config.layoutKey()) : "";
      if (key === spanLayoutKey) return false;
      if (spanLayoutKey !== null) {
        spanCache.delete(spanLayoutKey);
        spanCache.set(spanLayoutKey, { spans: measuredSpan, floor: spanFloor, fresh: floorFresh });
        while (spanCache.size > 4) spanCache.delete(spanCache.keys().next().value);
      }
      spanLayoutKey = key;
      var hit = spanCache.get(key);
      if (hit) {
        spanCache.delete(key);
        measuredSpan = hit.spans;
        spanFloor = hit.floor;
        floorFresh = hit.fresh;
      } else {
        measuredSpan = new Map();
        floorFresh = true;
      }
      tallSpan.clear();
      tallHead = 0;
      return true;
    }
    function setHeadSpan(id, span) {
      var positions = positionsById.get(id);
      if (positions === undefined) return;
      function update(index) {
        var delta = span - headSpans[index];
        if (!delta) return;
        headSpans[index] = span;
        totalSpans[index] += delta;
        displayLength += delta;
        for (var i = index + 1; i <= logicalCount; i += i & -i) spanTree[i] += delta;
      }
      if (Array.isArray(positions)) positions.forEach(update);
      else update(positions);
    }
    function headSpanOf(id) {
      var positions = positionsById.get(id);
      if (positions === undefined) return -1;
      return headSpans[Array.isArray(positions) ? positions[0] : positions];
    }
    function rebuild() {
      if (destroyed) return;
      syncSpanKey();
      syncTallId();
      var n = base.getLength();
      // Reuse capacity during refreshes. These numeric buffers replace the
      // prior array of freshly allocated fine-row objects.
      if (sourceRows.length < n) {
        sourceRows = new Uint32Array(n);
        dataHeads = new Uint8Array(n);
        headSpans = new Uint32Array(n);
        totalSpans = new Uint32Array(n);
        spanTree = new Float64Array(n + 1);
      }
      sourceLength = n;
      logicalCount = 0;
      displayLength = 0;
      positionsById.clear();
      indexedDrops.clear();
      descriptorCache.clear();
      rowStopsCache = null;
      for (var r = 0; r < n; r++) {
        var item = base.getItem(r);
        if (config.skipRow && config.skipRow(item)) continue;
        var index = logicalCount++;
        var span = isFullSpanRow(item) ? headSpanFor(item) : isGroupRow(item) ? groupSpan : 1;
        var drop = 0;
        sourceRows[index] = r;
        dataHeads[index] = isFullSpanRow(item) && !item.__absDetail && !item.__rowSpacer && item.id != null ? 1 : 0;
        headSpans[index] = span;
        if (isExpandable(item)) {
          var previous = positionsById.get(item.id);
          if (previous === undefined) positionsById.set(item.id, index);
          else if (Array.isArray(previous)) previous.push(index);
          else positionsById.set(item.id, [previous, index]);
          if (openAbstracts.has(item.id)) {
            drop = Math.max(1, rowCount.get(item.id) || 1);
            indexedDrops.set(item.id, drop);
          }
        }
        totalSpans[index] = span + drop;
        displayLength += span + drop;
      }
      spanTree.fill(0, 0, logicalCount + 1);
      // Linear construction, rather than n logarithmic tree updates.
      for (var i = 1; i <= logicalCount; i++) {
        spanTree[i] += totalSpans[i - 1];
        var parent = i + (i & -i);
        if (parent <= logicalCount) spanTree[parent] += spanTree[i];
      }
      treeStep = 1;
      while (treeStep * 2 <= logicalCount) treeStep *= 2;
    }

    // Body HTML for a drop. If the host supplies renderBody and it returns
    // non-null (e.g. search highlighting), use it; otherwise the shared plain
    // renderer. Used by BOTH the live formatter and the offscreen measurer so
    // the reserved height matches what actually renders.
    function dropInner(item) {
      var toc = tocHtml(item);
      var summary = "";
      if (config.renderSummary) { try { summary = config.renderSummary(item) || ""; } catch (e) { summary = ""; } }
      var after = "";
      if (config.renderAfter) { try { after = config.renderAfter(item) || ""; } catch (e) { after = ""; } }
      if (config.renderBody) {
        var custom = null;
        try { custom = config.renderBody(item); } catch (e) { custom = null; }
        if (custom) {
          var txt = abstractText(item);
          custom = secHeadHtml(item && item.id, config.readAloud, config.renderHeadExtra, txt ? absStatsHtml(item, txt) : "") + custom;
          return dropShell(item, toc, custom + after, summary);
        }
      }
      return dropInnerHtml(item, toc, config.readAloud, config.renderHeadExtra, summary, after);
    }

    // Rendered-HTML memo for open drops. Building a card's HTML is the most
    // expensive single thing in a render pass (escape + highlight the whole
    // abstract, plus a per-entry TOC walk with its own highlight pass), and
    // SlickGrid rebuilds the head row's cell EVERY time that row re-enters the
    // rendered range - i.e. repeatedly while scrolling with drops open, which is
    // what made scrolling feel heavy. The string depends only on the item's
    // content and the active highlight state - never on scroll position or width
    // (wrapping is CSS) - so memoize it per id and invalidate narrowly:
    // contains-needle changes via the signature, search/open-set changes in
    // setOpen/clear, a late-loading abstract by deleting that one entry. The
    // host's summary inputs (hidden columns) join the signature too.
    var dropHtmlCache = new Map();
    function highlightSig() {
      var n = window.OARuleHighlights;
      var s = (n && n.length) ? n.join("\u0001") : "";
      if (config.summarySig) { try { s += "\u0002" + (config.summarySig() || ""); } catch (e) { /* ignore */ } }
      if (config.afterSig) { try { s += "\u0003" + (config.afterSig() || ""); } catch (e) { /* ignore */ } }
      return s;
    }
    function dropInnerCached(item) {
      var id = item && item.id;
      if (!id) return dropInner(item);
      var sig = highlightSig();
      var hit = dropHtmlCache.get(id);
      if (hit && hit.sig === sig) return hit.html;
      var html = dropInner(item);
      // Same card, new inputs (a highlight, the metrics section coming or
      // going): its height may have moved, so the next render re-reads it from
      // the live DOM (reconcile) instead of trusting the old measurement.
      if (hit && hit.html !== html) measuredRev.delete(id);
      dropHtmlCache.set(id, { sig: sig, html: html });
      return html;
    }

    function headFormatter(row, cell, value, columnDef, item) {
      var article = base.getItemById(item.absFor);
      if (!article) return "";
      var reserved = Math.max(1, rowCount.get(item.absFor) || 1) * rowHeight;
      var content = contentPx.get(item.absFor) || reserved;
      // Grow the card so its bottom - and the accent line drawn on it - sits a
      // CONSTANT DROP_GAP above the next row, instead of hugging the text and
      // leaving a gap that varies 0..rowHeight with the abstract's length (which
      // read as inconsistent). rowCount already reserved
      // ceil((content+DROP_GAP)/rowHeight) rows, so reserved-DROP_GAP >= content
      // in the normal case: the text sits at the fixed top padding and any
      // sub-row remainder is transparent space below it, framed by the accent
      // line. A past-cap abstract (content > reserved-DROP_GAP) scrolls inside
      // the card (overflow:auto); its gap is still exactly DROP_GAP.
      var cardH = Math.max(rowHeight - DROP_GAP, reserved - DROP_GAP);
      // Guard: never render shorter than the measured content unless we're at
      // the row cap (then overflow:auto scrolls it).
      if (content <= reserved - DROP_GAP) cardH = reserved - DROP_GAP;
      return '<div class="abs-drop" data-abs-drop="' + esc(item.absFor) +
        '" style="height:' + Math.round(cardH) + 'px">' +
        dropInnerCached(article) + "</div>";
    }
    function spacerFormatter() { return ""; }

    /* --- scroll anchoring --- */
    // Reservation changes (late-loading abstracts growing, reconcile's fit
    // corrections, FIFO closes) update display spans and change the canvas
    // height. Without compensation the content shifts under a constant
    // scrollTop - the user sees the table "jump back" while scrolling with
    // open drops. capture/restore pin the fine row at the top of the viewport
    // to its stable identity (source row, or drop id + fine-row offset) across
    // a render.
    function viewportNode() {
      if (!grid) return null;
      try { if (grid.getViewportNode) { var v = grid.getViewportNode(); if (v) return v; } } catch (e) {}
      var c = (grid.getContainerNode && grid.getContainerNode()) || config.mountNode;
      return (c && c.querySelector) ? c.querySelector(".slick-viewport") : null;
    }
    function captureAnchor() {
      var vp = viewportNode();
      if (!vp || !displayLength || vp.scrollTop <= 0) return null;
      var idx = Math.min(Math.floor(vp.scrollTop / rowHeight), displayLength - 1);
      var logical = spanAt(idx), sub = idx - spanStart(logical);
      var rem = Math.max(0, Math.min(vp.scrollTop - idx * rowHeight, rowHeight - 1));
      if (sub >= headSpans[logical]) {
        var item = base.getItem(sourceRows[logical]);
        return { vp: vp, drop: item.id, p: sub - headSpans[logical], rem: rem, len: sourceLength };
      }
      return { vp: vp, r: sourceRows[logical], sub: sub, rem: rem, len: sourceLength };
    }
    function restoreAnchor(a) {
      if (!a || base.getLength() !== a.len) return;
      var logical = -1, sub = 0;
      if (a.drop != null) {
        var positions = positionsById.get(a.drop);
        if (positions !== undefined) logical = Array.isArray(positions) ? positions[0] : positions;
        if (logical >= 0 && totalSpans[logical] > headSpans[logical]) {
          sub = headSpans[logical] + Math.min(a.p, totalSpans[logical] - headSpans[logical] - 1);
        }
      } else {
        // Source rows stay ascending even when redundant group rows are skipped.
        var lo = 0, hi = logicalCount - 1;
        while (lo <= hi) {
          var mid = Math.floor((lo + hi) / 2), source = sourceRows[mid];
          if (source === a.r) { logical = mid; break; }
          if (source < a.r) lo = mid + 1;
          else hi = mid - 1;
        }
        if (logical >= 0) sub = Math.min(a.sub, headSpans[logical] - 1);
      }
      if (logical < 0) return;
      var target = (spanStart(logical) + sub) * rowHeight + a.rem;
      var maxSt = Math.max(0, a.vp.scrollHeight - a.vp.clientHeight);
      target = Math.max(0, Math.min(target, maxSt));
      if (Math.abs(a.vp.scrollTop - target) > 0.5) a.vp.scrollTop = target;
    }
    // Reading anchor across a DATA change under the reader (a re-rank of the
    // query already on screen): the first article at or below the viewport top
    // and its pixel offset. Unlike captureAnchor it survives a changed row
    // count - the article is found again by id wherever the new order puts it.
    // restore returns false when that article is no longer in the list.
    function captureReadingAnchor() {
      var vp = viewportNode();
      if (!vp || !displayLength || vp.scrollTop <= 0) return null;
      var idx = Math.min(Math.floor(vp.scrollTop / rowHeight), displayLength - 1);
      for (var logical = spanAt(idx); logical >= 0 && logical < logicalCount; logical++) {
        if (!dataHeads[logical]) continue;
        var item = base.getItem(sourceRows[logical]);
        if (item && item.id != null) return { id: item.id, offset: spanStart(logical) * rowHeight - vp.scrollTop };
      }
      return null;
    }
    function restoreReadingAnchor(a) {
      var vp = viewportNode();
      if (!a || !vp) return false;
      var positions = positionsById.get(a.id);
      if (positions === undefined) return false;
      var logical = Array.isArray(positions) ? positions[0] : positions;
      var target = spanStart(logical) * rowHeight - a.offset;
      var maxSt = Math.max(0, vp.scrollHeight - vp.clientHeight);
      vp.scrollTop = Math.max(0, Math.min(target, maxSt));
      return true;
    }

    // Shared spacer metadata - identical for every spacer row, so build it once
    // instead of allocating a new object per getItemMetadata call (which the
    // grid makes for every rendered row on every scroll tick).
    var _spacerMeta = null;
    function getSpacerMeta() {
      if (!_spacerMeta) {
        var scols = {};
        scols[detailColId] = { colspan: "*", formatter: spacerFormatter };
        _spacerMeta = { focusable: false, selectable: false, cssClasses: "oa-row-spacer", columns: scols };
      }
      return _spacerMeta;
    }

    // The three render hooks, installed onto dataSource. Wrapping these (and
    // nothing else) injects the detail rows at render time only.
    function overlayGetLength() { return displayLength; }
    function overlayGetItem(i) {
      var e = descriptorAt(i);
      if (!e) return undefined;
      if (e.t === 0) return base.getItem(e.r);
      // Synthetic rows are stateless - memoize each on its cached descriptor
      // so scrolling does not allocate a fresh object
      // per spacer/detail row on every render pass.
      if (e.it) return e.it;
      if (e.t === 4) {
        return (e.it = { id: "__span::" + e.r + "::" + i, __rowSpacer: true, __nonDataRow: true });
      }
      return (e.it = {
        id: "__abs::" + e.id + "::" + e.p,
        __absDetail: true,
        __nonDataRow: true,
        absFor: e.id
      });
    }
    function overlayGetItemMetadata(row) {
      var e = descriptorAt(row);
      if (!e) return null;
      if (e.t === 0) {
        var it = base.getItem(e.r);
        // Memo per display row: the grid asks for metadata on every rendered row
        // on every scroll tick, and this clone + class concat was allocating
        // through each pass. Only two inputs can change without a rebuild (which
        // discards these descriptors): whether the row is open, and the host's
        // row class (selection) - so key the memo on exactly those.
        var openNow = !!(it && it.id && openAbstracts.has(it.id));
        var rcNow = (config.rowClass && isFullSpanRow(it)) ? (config.rowClass(it) || "") : "";
        var hs = dataSpan;
        if (fitSpans && isFullSpanRow(it)) { var li = spanAt(row); if (li >= 0) hs = headSpans[li]; }
        var mdKey = (openNow ? "1|" : "0|") + rcNow + "|" + hs;
        if (e.md && e.mdKey === mdKey) return e.md;
        var md = base.getItemMetadata ? base.getItemMetadata(e.r) : null;
        md = Object.assign({}, md);
        var cls = (md.cssClasses ? md.cssClasses + " " : "");
        // Head row: cells forced to the full logical height, overflowing over
        // the spacer rows below. Real DATA rows use --oa-data-h (oa-row-head);
        // group headers use the shorter --oa-group-h (oa-group-head) so a
        // grouped table has evenly-sized section headers, not a thin single
        // fine row nor a full data-row-tall band with empty space under it.
        if (dataSpan > 1 && isFullSpanRow(it)) {
          if (hs > dataSpan) ensureSpanRule(hs);
          cls += "oa-row-head " + (hs !== dataSpan ? "oa-span-" + hs + " " : "");
        }
        else if (groupSpan > 1 && isGroupRow(it)) cls += "oa-group-head ";
        // Tag the expanded row so the accent line carries up through it (CSS
        // .abs-parent-open::before), visually tying the row to its drop.
        if (openNow) cls += "abs-parent-open ";
        // Optional host hook (row selection): extra class for this head row.
        if (rcNow) cls += rcNow + " ";
        md.cssClasses = cls.trim() || null;
        e.md = md; e.mdKey = mdKey;
        return md;
      }
      if (e.t === 4) {
        // Empty fine spacer beneath a head row - reserves vertical space only.
        return getSpacerMeta();
      }
      var cols = {};
      cols[detailColId] = {
        colspan: "*",
        formatter: e.t === 1 ? headFormatter : spacerFormatter
      };
      return {
        focusable: false,
        selectable: false,
        cssClasses: "abs-detail " + (e.t === 1 ? "abs-detail-head" : "abs-detail-spacer"),
        columns: cols
      };
    }

    config.dataSource.getLength = overlayGetLength;
    config.dataSource.getItem = overlayGetItem;
    config.dataSource.getItemMetadata = overlayGetItemMetadata;

    /* --- height measurement --- */
    // The drop spans all columns, so its natural height is measured at the
    // full canvas width in a hidden probe, then rounded up to whole rows.
    var measurer = null;
    function getMeasurer() {
      if (!measurer) {
        measurer = document.createElement("div");
        measurer.className = "abs-drop abs-drop-measure";
        measurer.setAttribute("aria-hidden", "true");
        (config.mountNode || document.body).appendChild(measurer);
      }
      return measurer;
    }
    function contentWidth() {
      var w = 0;
      try {
        var c = grid && grid.getCanvasNode && grid.getCanvasNode();
        if (c) w = c.clientWidth;
      } catch (e) { /* ignore */ }
      return Math.max(320, w || 900);
    }
    // Width of the grid's VISIBLE viewport (the drop spans the full, wider
    // canvas, but its text must wrap into the part the user can actually see).
    function gridViewportWidth(fallbackWidth) {
      var vp = (config.mountNode && config.mountNode.querySelector)
             ? config.mountNode.querySelector(".slick-viewport") : null;
      if (!vp) { try { vp = grid && grid.getViewportNode && grid.getViewportNode(); } catch (e) { /* ignore */ } }
      var width = vp && vp.clientWidth;
      return width || fallbackWidth || contentWidth();
    }
    // Publish that width as --oa-abs-vw on the host so the drop text (CSS) can
    // cap its measure to it - refreshed on every measure/render so it tracks
    // column + window resizes.
    function syncViewportVar(viewportWidth) {
      var host = config.mountNode;
      if (host && host.style) {
        setHostStyle(host, "--oa-abs-vw", Math.max(240, Math.round(viewportWidth || gridViewportWidth())) + "px");
        // Left edge (canvas px) of the column the TOC should align with
        // (config.tocAlignColId, e.g. the Keywords column) -> --oa-kw-left.
        if (config.tocAlignColId && grid && grid.getColumns) {
          var cols = grid.getColumns(), left = 0, found = false;
          for (var ci = 0; ci < cols.length; ci += 1) {
            if (cols[ci].id === config.tocAlignColId) { found = !cols[ci].hidden; break; }
            if (cols[ci].hidden) continue;   // responsive drop: no canvas space
            left += cols[ci].width || 0;
          }
          if (found) setHostStyle(host, "--oa-kw-left", left + "px");
          else setHostStyle(host, "--oa-kw-left");
        }
        // Right edge (canvas px) of the column the records strip's Graph tiles
        // should end at (config.stripAlignColId, e.g. Citations) -> --oa-strip-right.
        // Measured off the live cell when one is rendered, so the cell's own
        // right padding is respected and the tiles land on the bar's edge.
        if (config.stripAlignColId && grid && grid.getColumns) {
          var cols2 = grid.getColumns(), acc = 0, rightEdge = null;
          for (var cj = 0; cj < cols2.length; cj += 1) {
            if (cols2[cj].hidden) continue;
            acc += cols2[cj].width || 0;
            if (cols2[cj].id === config.stripAlignColId) { rightEdge = acc; break; }
          }
          if (rightEdge != null) {
            var cellEl = host.querySelector && host.querySelector(".slick-row .slick-cell.l" + cols2.indexOf(cols2[cj]));
            var pad = 0;
            if (cellEl) { var ccs = window.getComputedStyle(cellEl); pad = (parseFloat(ccs.paddingRight) || 0) + (parseFloat(ccs.borderRightWidth) || 0); }
            setHostStyle(host, "--oa-strip-right", Math.round(rightEdge - pad) + "px");
          } else setHostStyle(host, "--oa-strip-right");
        }
      }
    }

    // Natural outer height (px) of a drop at the live content width, measured in
    // the hidden probe; rowsForPx turns a height into the whole rows it needs.
    // Hyphenate a probe exactly as the live drop will be (afterDropRender), so
    // the measured height is the rendered height and reconcile has nothing to
    // correct - the correction pass was a second render, seen as a flash.
    function hyphenateProbe(host) {
      if (!window.OATheme || !window.OATheme.softHyphenate) return;
      var paras = host.querySelectorAll(".abstract-card-text");
      for (var i = 0; i < paras.length; i += 1) window.OATheme.softHyphenate(paras[i]);
    }
    function measurePx(item) {
      var width = contentWidth();
      syncViewportVar(gridViewportWidth(width));
      var m = getMeasurer();
      m.style.width = width + "px";
      m.style.setProperty("--oa-measure-w", width + "px");
      m.style.height = "auto";
      m.innerHTML = dropInnerCached(item);
      hyphenateProbe(m);
      // Ceil: reconcile stores ceiled heights - matching here avoids a phantom
      // "changed" pass (fractional probe px vs ceiled live px) per open drop.
      return Math.ceil(m.getBoundingClientRect().height);
    }
    // Same measurement for MANY items in ONE layout pass: every probe is
    // appended first, then every height is read. measurePx per item forces a
    // synchronous layout per drop (innerHTML, then getBoundingClientRect), which
    // is what made auto-opening a search's hits cost ~15 ms x N; batching costs
    // one layout for the lot. Probes are siblings inside a hidden batch host so
    // the .abs-drop padding is counted exactly once per drop, as in measurePx.
    var batchHost = null;
    function measureManyPx(items, width, viewportWidth) {
      var w = width || contentWidth();
      syncViewportVar(viewportWidth || gridViewportWidth(w));
      if (!batchHost) {
        batchHost = document.createElement("div");
        batchHost.className = "abs-drop-measure-batch";
        batchHost.setAttribute("aria-hidden", "true");
        (config.mountNode || document.body).appendChild(batchHost);
      }
      var html = "";
      for (var i = 0; i < items.length; i += 1) {
        html += '<div class="abs-drop abs-drop-measure abs-drop-measure-item" style="width:' + w + 'px;--oa-measure-w:' + w + 'px;height:auto">' +
          dropInnerCached(items[i]) + "</div>";
      }
      batchHost.innerHTML = html;
      hyphenateProbe(batchHost);
      var kids = batchHost.children;
      var out = new Array(items.length);
      for (i = 0; i < kids.length; i += 1) out[i] = Math.ceil(kids[i].getBoundingClientRect().height);
      batchHost.innerHTML = "";
      return out;
    }
    function rowsForPx(h) {
      // Reserve rows for the content PLUS the constant DROP_GAP, so the card can
      // be grown to reserved-DROP_GAP (>= content) and every abstract ends the
      // same distance above the next row.
      return Math.max(1, Math.min(maxDetailRows, Math.ceil((h + DROP_GAP) / rowHeight)));
    }
    var lastWidth = 0, lastViewportWidth = 0, lastLayoutKey = "";
    // Open cards within the rendered range plus a buffer of fine rows on either
    // side - the set worth measuring eagerly. null when there is no grid to ask.
    var MEASURE_BUFFER_ROWS = 24;
    function renderedOpenIds() {
      if (!grid || !grid.getRenderedRange) return null;   // no grid to ask: unrestricted
      if (!displayLength) return new Set();                // a valid, empty view: nothing to measure
      var range = grid.getRenderedRange();
      if (!range) return null;
      var top = Math.max(0, range.top - MEASURE_BUFFER_ROWS);
      var bottom = Math.min(displayLength - 1, range.bottom + MEASURE_BUFFER_ROWS);
      var from = spanAt(top), to = spanAt(bottom);
      if (from < 0) from = 0;
      if (to < 0) to = logicalCount - 1;
      var out = new Set();
      for (var i = from; i <= to && i < logicalCount; i += 1) {
        if (!dataHeads[i]) continue;
        var item = base.getItem(sourceRows[i]);
        if (item && item.id != null && openAbstracts.has(item.id)) out.add(item.id);
      }
      return out;
    }
    // Re-measure open drops after a geometry change: a WIDTH change (height
    // alone can't change how many rows a drop needs), a different `layoutKey`
    // (column widths/order the drop's inner layout depends on - supplied by the
    // host), or `force` for a layout switch (paragraph vs one sentence per
    // line) at the same width. Bounded: only cards in or near the rendered
    // range are measured now; every other open card is left stale and
    // corrected by reconcile() when it comes on screen. Returns true if any
    // measured drop's row-count changed.
    function remeasure(force, layoutKey) {
      if (destroyed) return false;
      if (!openAbstracts.size) return false;
      var w = contentWidth(), vw = gridViewportWidth(w);
      var key = layoutKey == null ? lastLayoutKey : String(layoutKey);
      if (w === lastWidth && vw === lastViewportWidth && key === lastLayoutKey && !force) return false;
      lastWidth = w;
      lastViewportWidth = vw;
      lastLayoutKey = key;
      geomRev += 1;
      var near = renderedOpenIds();
      var changed = false;
      var ids = [], items = [];
      openAbstracts.forEach(function (item, id) {
        if (near && !near.has(id)) return;   // offscreen: stale until it scrolls into view
        ids.push(id);
        items.push(base.getItemById(id) || item);
      });
      if (!ids.length) return false;
      var heights = measureManyPx(items, w, vw);
      for (var i = 0; i < ids.length; i += 1) {
        var h = heights[i];
        var k = rowsForPx(h);
        if (k !== rowCount.get(ids[i])) changed = true;   // px-only drift needs no re-render
        storeMeasure(ids[i], h, k);
      }
      return changed;
    }

    // Post-render fit check. Once a drop is in the live DOM it sits at the real
    // cell width, in the real font, wrapped exactly as the user sees it - so
    // its scrollHeight is the TRUE height it needs, far more reliable than the
    // offscreen probe (whose wrapping can diverge and leave k too small -> text
    // clipped - or too big -> empty box). If the rows we reserved (k) don't
    // match what the content actually needs, correct k and re-render. Converges
    // in one or two passes and is capped so it can never loop. This is what
    // makes the fit reliable instead of "sometimes right".
    var reconcilePass = 0;
    var reconcileScheduled = false;
    // One next-frame reconcile at a time, whoever asks (render, afterDropRender).
    function scheduleReconcile() {
      if (reconcileScheduled) return;
      reconcileScheduled = true;
      reconcileFrame = requestAnimationFrame(function () {
        reconcileFrame = 0;
        if (destroyed) return;
        reconcileScheduled = false; reconcile();
      });
    }
    function reconcile() {
      if (destroyed) return;
      if (!grid || !openAbstracts.size) { reconcilePass = 0; return; }
      syncViewportVar();
      var changed = false;
      // Walk the drops that are actually in the DOM (one query), not the whole
      // open set: the open set grows with the browsing history, the DOM does not.
      var root = (grid.getCanvasNode && grid.getCanvasNode()) || config.mountNode || document;
      var drops = (root && root.querySelectorAll) ? root.querySelectorAll(".abs-drop[data-abs-drop]") : [];
      for (var d = 0; d < drops.length; d += 1) {
        var el = drops[d];
        var id = el.getAttribute("data-abs-drop");
        if (!openAbstracts.has(id)) continue;
        // TRUE content height: the inner block + the card's own padding/border,
        // read independently of the (possibly grown-to-fill) card height. This
        // corrects the reservation up (never clip) AND down (never over-reserve).
        var inner = el.querySelector(".abs-drop-inner");
        var borders = el.offsetHeight - el.clientHeight; // top/bottom border (+ any h-scrollbar)
        var content;
        if (inner) {
          var cs = window.getComputedStyle(el);
          var padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
          content = inner.getBoundingClientRect().height + padV + borders;
        } else {
          content = el.scrollHeight + borders;
        }
        content = Math.ceil(content);
        var k = rowsForPx(content);
        // Re-render ONLY when the number of reserved rows actually changes. The
        // measured px is stored either way (it feeds the card's own height), but
        // a sub-row difference changes nothing on screen - treating it as a
        // change cost a full grid re-render on almost every abstract toggle.
        if (k !== rowCount.get(id)) changed = true;
        storeMeasure(id, content, k);   // also marks the card current for this geometry
      }
      if (changed && reconcilePass < 3) { reconcilePass++; render(true, true); }
      else { reconcilePass = 0; }
    }

    // Justified drop text needs hyphenation to avoid rivers. Native `hyphens:
    // auto` does the work where the browser has dictionaries; where it doesn't,
    // OATheme.softHyphenate inserts soft hyphens. SlickGrid rebuilds cell DOM on
    // every render pass, so this re-runs per freshly created paragraph (the
    // probe and the pattern engine are both cached, so it is a no-op walk).
    function hyphenateDrops() {
      if (!window.OATheme || !window.OATheme.softHyphenate) return;
      var paras = (config.mountNode || document).querySelectorAll(
        ".abs-drop .abstract-card-text:not([data-oa-hyphenated])");
      for (var i = 0; i < paras.length; i += 1) window.OATheme.softHyphenate(paras[i]);
    }

    // SlickGrid rebuilds a drop's cell DOM on every render pass, so anything
    // applied to the live DOM (soft hyphens, the reader's playing state and its
    // read-along word spans) has to be re-applied after each one.
    function afterDropRender() {
      if (destroyed) return;
      hyphenateDrops();
      if (window.OATTS && config.readAloud) window.OATTS.sync(config.mountNode || document);
      // A card measured at an older geometry revision has just been rendered
      // with an estimated height: read its true height next frame. This is the
      // deferred half of the bounded remeasure above.
      if (openAbstracts.size && hasStaleRendered()) scheduleReconcile();
    }
    function hasStaleRendered() {
      var root = grid && grid.getCanvasNode && grid.getCanvasNode();
      if (!root || !root.querySelectorAll) return false;
      var drops = root.querySelectorAll(".abs-drop[data-abs-drop]");
      for (var i = 0; i < drops.length; i += 1) {
        var id = drops[i].getAttribute("data-abs-drop");
        if (openAbstracts.has(id) && measuredRev.get(id) !== geomRev) return true;
      }
      return false;
    }

    function bindGrid(g) {
      if (destroyed || g === boundGrid) return;
      if (boundGrid && boundGrid.onRendered) boundGrid.onRendered.unsubscribe(afterDropRender);
      grid = boundGrid = g;
      if (g && g.onRendered) g.onRendered.subscribe(afterDropRender);
    }
    bindGrid(grid);

    function render(anchored, localChange) {
      if (destroyed) return;
      if (grid) syncViewportVar();
      // Anchor only BACKGROUND renders (late abstract loads, reconcile fit
      // fixes). User-initiated renders (toggle/setOpen/clear) must not touch
      // scroll - restoring there caused an "auto-scroll" on every click.
      var anchor = (grid && anchored) ? captureAnchor() : null;
      if (localChange && sourceLength === base.getLength()) updateDropSpans();
      else rebuild();
      if (grid) {
        // autoHeight needs the canvas re-sized to the new row count before the
        // render; otherwise invalidate() alone is the whole refresh contract
        // (updateRowCount + invalidateAllRows + render).
        grid.invalidate();
        restoreAnchor(anchor);
      }
      if (config.onChange) config.onChange(openAbstracts.size);
      if (!grid || !grid.onRendered) afterDropRender();
      // Verify the reservation against the real, laid-out drop on the next frame.
      if (grid && openAbstracts.size) scheduleReconcile();
    }

    function toggle(id) {
      if (destroyed) return;
      if (openAbstracts.has(id)) {
        if (window.OATTS) window.OATTS.stopIf(id);
        openAbstracts.delete(id);
        rowCount.delete(id);
        contentPx.delete(id);
        measuredRev.delete(id);
        dropHtmlCache.delete(id);
      } else {
        var item = base.getItemById(id);
        if (!item) return;
        openAbstracts.set(id, item);
        storeMeasure(id, measurePx(item));
      }
      render(false, true);
    }

    // Close every drop and forget their measurements (and stop the speech).
    function resetOpen() {
      if (window.OATTS) window.OATTS.stop();
      openAbstracts.clear();
      rowCount.clear();
      contentPx.clear();
      measuredRev.clear();
      dropHtmlCache.clear();
    }

    // Open the given ids that can open and are not open yet, measured in one
    // layout pass for every drop instead of one per drop (see measureManyPx).
    // Returns how many it opened.
    function openMeasured(ids) {
      var items = [], keep = [];
      (ids || []).forEach(function (id) {
        if (openAbstracts.has(id)) return;
        var item = base.getItemById(id);
        if (!item || !isExpandable(item)) return;
        openAbstracts.set(id, item);
        items.push(item);
        keep.push(id);
      });
      var heights = items.length ? measureManyPx(items) : [];
      for (var i = 0; i < keep.length; i += 1) storeMeasure(keep[i], heights[i]);
      return keep.length;
    }

    function clear() {
      if (destroyed) return;
      if (!openAbstracts.size) return;
      resetOpen();
      render(false, true);
    }

    // Open EXACTLY the given ids (closing anything else) in a single render.
    // Used by the article grid to auto-expand every search result.
    function setOpen(ids) {
      if (destroyed) return;
      resetOpen();   // search-driven: query (and its highlighting) changed
      openMeasured(ids);
      render(false, true);
    }

    // Open MORE drops without touching the ones already open (search hits
    // scrolled into view). Measured in one batch like setOpen; the render is
    // anchored so the rows the reader is looking at stay put while rows above
    // or below them grow. Returns how many were actually added.
    function openMany(ids) {
      if (destroyed) return 0;
      var added = openMeasured(ids);
      if (added) render(true, true);
      return added;
    }

    // Measure the data rows the grid has rendered and give each the span its
    // content needs. oa-row-measure lifts the forced row height so each cell
    // reports its natural height - one write, one read, one write, so a single
    // synchronous layout that is never painted. Rows already measured at this
    // column layout are skipped, so a scroll only reads the rows it brought in.
    // Changes re-render anchored: the row at the viewport top stays put.
    // The tall head (fitRows) waits for the webfonts: a batch arriving re-fits.
    function fontsLoading() { return typeof document !== "undefined" && !!document.fonts && document.fonts.status === "loading"; }
    if (typeof document !== "undefined" && document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", function () {
        if (destroyed || tallId === null) return;
        if (fitRows() && config.onChange) config.onChange(openAbstracts.size);
      });
    }
    function fitRows() {
      if (destroyed || !fitSpans || !grid) return false;
      syncSpanKey();
      syncTallId();
      var canvas = grid.getCanvasNode && grid.getCanvasNode();
      if (!canvas || !canvas.querySelectorAll) return false;
      var rows = canvas.querySelectorAll(".slick-row.oa-row-head");
      var todo = [];
      for (var i = 0; i < rows.length; i += 1) {
        var handle = rows[i].querySelector("[data-abs-id]");
        var id = handle && handle.getAttribute("data-abs-id");
        if (id != null && id === tallId) {
          // Its long list wraps differently in the fallback face: it keeps its
          // estimate until the webfonts are in (loadingdone, below). After
          // that it is re-measured on every pass - one row, and its list can
          // still re-wrap after a measurement (a late column fit, a font).
          if (!fontsLoading()) todo.push({ row: rows[i], id: id, h: 0 });
          continue;
        }
        if (id != null && !measuredSpan.has(id)) todo.push({ row: rows[i], id: id, h: 0 });
      }
      if (!todo.length) { fitPass = 0; return false; }
      for (i = 0; i < todo.length; i += 1) todo[i].row.classList.add("oa-row-measure");
      for (i = 0; i < todo.length; i += 1) {
        var cells = todo[i].row.children;
        for (var c = 0; c < cells.length; c += 1) todo[i].h = Math.max(todo[i].h, cells[c].offsetHeight);
      }
      for (i = 0; i < todo.length; i += 1) todo[i].row.classList.remove("oa-row-measure");
      var measured = [], batchMin = Infinity;
      for (i = 0; i < todo.length; i += 1) {
        if (!todo[i].h) continue;   // not laid out (background tab): measure later
        var tall = todo[i].id === tallId;
        var span = Math.max(minSpan, Math.min(tall ? tallMax : dataSpan, Math.ceil(todo[i].h / rowHeight)));
        (tall ? tallSpan : measuredSpan).set(todo[i].id, span);
        if (tall) tallHead = span;
        // Only heads within the ceiling set the floor: a tall one says nothing
        // about the icon stacks every row has.
        else if (span < batchMin) batchMin = span;
        measured.push(todo[i].id);
      }
      var floorChanged = false;
      if (batchMin !== Infinity) {
        var floor = floorFresh ? batchMin : Math.min(spanFloor, batchMin);
        floorFresh = false;
        if (floor !== spanFloor) { spanFloor = floor; floorChanged = true; }
      }
      var spanOf = function (key) { return (key === tallId ? tallSpan : measuredSpan).get(key); };
      var differs = floorChanged || measured.some(function (key) { return headSpanOf(key) !== spanOf(key); });
      if (!differs) { fitPass = 0; return false; }
      // Each pass can only bring in rows the previous one made room for; the
      // cap is a guard, not a limit the viewport ever reaches.
      if (++fitPass > 6) { fitPass = 0; return false; }
      var anchor = captureAnchor();
      // A new floor re-estimates every unmeasured row, so rebuild them all.
      if (floorChanged) rebuild();
      else {
        measured.forEach(function (key) { setHeadSpan(key, spanOf(key)); });
        descriptorCache.clear();
        rowStopsCache = null;
      }
      grid.invalidate();
      restoreAnchor(anchor);
      return true;
    }
    function headSpanAt(displayRow) {
      var logical = spanAt(displayRow);
      return logical < 0 ? dataSpan : headSpans[logical];
    }

    // Tallest currently-open drop, in reserved (fine) rows. The grid uses this
    // to size its render buffer so a tall card's head row isn't pruned (and the
    // card blanked) while the card is still partly in view during scroll.
    function maxOpenRowSpan() {
      var max = tallHead;
      rowCount.forEach(function (k) { if (k > max) max = k; });
      return max;
    }

    // Ascending canvas offsets (px) of every place scrolling should be able to
    // come to rest: the top of each logical row. An open drop is deliberately
    // NOT a stop of its own - a row and its abstract/TOC card are one atomic
    // block, so scrolling either shows the row with its card beneath it or has
    // passed both; a card is never left stranded at the top of the viewport
    // without the row it belongs to. (A card taller than the viewport is the one
    // exception: the wheel / page keys walk through it in whole rows, because it
    // cannot be read any other way.) Cached until the next rebuild - the list is
    // one entry per logical row, too big to rebuild per wheel event.
    var rowStopsCache = null;
    function rowStops() {
      if (rowStopsCache) return rowStopsCache;
      var stops = [];
      var offset = 0;
      for (var i = 0; i < logicalCount; i += 1) {
        stops.push(offset * rowHeight);
        offset += totalSpans[i];
      }
      return (rowStopsCache = stops);
    }

    // Logical item under a mouse event, or null when the event isn't on a
    // selectable data row (group rows, abstract drops, empty space). Shared by
    // handleBody and the row-selection controller (oa-row-select.js).
    function itemFromEvent(event) {
      if (destroyed) return null;
      if (!grid) return null;
      var cell = grid.getCellFromEvent(event);
      if (!cell) return null;
      var e = descriptorAt(cell.row);
      var item = (e && e.r != null) ? base.getItem(e.r) : grid.getDataItem(cell.row);
      return isExpandable(item) ? item : null;
    }
    // Plain left-click on a row's body (not a link / control / the drop
    // itself) toggles that row's abstract - the whole row is a target.
    function handleBody(event) {
      if (destroyed) return false;
      if (!grid) return false;
      if (event.button !== 0 || event.shiftKey || event.altKey) return false;
      if (event.target.closest("a, button, input, select, textarea, .filter-affordance, .oa-link, .abs-detail")) {
        return false;
      }
      // Don't collapse a row just because the user finished selecting text.
      if (window.getSelection && String(window.getSelection())) return false;
      var item = itemFromEvent(event);
      if (item) { userToggle(item.id); return true; }
      return false;
    }
    // User-initiated disclosure changes that originate INSIDE this module (row
    // body, Escape) go through the host when it records intent
    // (config.onUserToggle / onUserClear), so they are the same state
    // transition as the chevron and toolbar paths. The host calls back into
    // toggle() / clear() itself.
    function userToggle(id) {
      if (typeof config.onUserToggle === "function") config.onUserToggle(id, openAbstracts.has(id));
      else toggle(id);
    }

    // Collapse-all on Escape (unless focus is in a form field).
    function escape(event) {
      if (destroyed) return;
      if (!openAbstracts.size) return;
      var tag = (event.target && event.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (typeof config.onUserClear === "function") config.onUserClear();
      else clear();
    }

    // Formatter for the leftmost expand column.
    function chevronFormatter(row, cell, value, columnDef, item) {
      if (!item || item.__group || item.__groupTotals || !item.id) return "";
      return chevronHtml(item.id, openAbstracts.has(item.id));
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (reconcileFrame) cancelAnimationFrame(reconcileFrame);
      reconcileFrame = 0; reconcileScheduled = false;
      if (boundGrid && boundGrid.onRendered) boundGrid.onRendered.unsubscribe(afterDropRender);
      boundGrid = grid = null;
      if (window.OATTS && window.OATTS.stopIf) openAbstracts.forEach(function (_, id) { window.OATTS.stopIf(id); });
      [measurer, batchHost].forEach(function (node) { if (node && node.parentNode) node.parentNode.removeChild(node); });
      measurer = batchHost = null;
      if (config.mountNode && config.mountNode.style) {
        var style = config.mountNode.style;
        ownedStyles.forEach(function (previous, key) {
          if (style.getPropertyValue && style.getPropertyValue(key) !== previous.current) return;
          if (previous.value) style.setProperty(key, previous.value, previous.priority);
          else style.removeProperty(key);
        });
      }
      ownedStyles.clear();
      var overlays = [overlayGetLength, overlayGetItem, overlayGetItemMetadata];
      sourceKeys.forEach(function (key, index) {
        if (source[key] !== overlays[index]) return;
        if (sourceDescriptors[index]) Object.defineProperty(source, key, sourceDescriptors[index]);
        else delete source[key];
      });
      openAbstracts.clear(); rowCount.clear(); contentPx.clear(); measuredRev.clear(); dropHtmlCache.clear();
      positionsById.clear(); indexedDrops.clear(); descriptorCache.clear(); measuredSpan.clear();
      sourceRows = headSpans = totalSpans = new Uint32Array(0);
      dataHeads = new Uint8Array(0);
      spanTree = new Float64Array(1);
      logicalCount = displayLength = 0; rowStopsCache = null;
      var index = liveControllers.indexOf(controller);
      if (index !== -1) liveControllers.splice(index, 1);
      var owner = sourceOwners.get(source);
      if (owner && owner.controller === controller) sourceOwners.delete(source);
    }
    var controller = {
      destroy: destroy,
      rebuild: rebuild,
      render: render,
      toggle: toggle,
      clear: clear,
      setOpen: setOpen,
      openMany: openMany,
      maxOpenRowSpan: maxOpenRowSpan,
      fitRows: fitRows,
      resetRowSpans: syncSpanKey,
      headSpanAt: headSpanAt,
      remeasure: remeasure,
      reconcile: reconcile,
      captureReadingAnchor: captureReadingAnchor,
      restoreReadingAnchor: restoreReadingAnchor,
      rowStops: rowStops,
      adjacentDataRow: adjacentDataRow,
      handleBody: handleBody,
      itemFromEvent: itemFromEvent,
      escape: escape,
      chevronFormatter: chevronFormatter,
      // Drop the memoized drop HTML for one article so the next render rebuilds
      // it (used when the reader folds a TOC section).
      invalidateDrop: function (id) { dropHtmlCache.delete(id); measuredRev.delete(id); },
      count: function () { return openAbstracts.size; },
      isOpen: function (id) { return openAbstracts.has(id); },
      openIds: function () { return Array.from(openAbstracts.keys()); }
    };
    liveControllers.push(controller);
    sourceOwners.set(source, { controller: controller, base: base });
    return controller;
  }

  window.OAAbstractRows = {
    create: create,
    // A TOC section was folded / unfolded inside a drop. Record it against the
    // article (so the regenerated markup keeps the fold), drop the memoized
    // HTML, and let every controller re-fit its row reservation to the new
    // height. Called by toc.js's delegated toggle handler.
    tocToggled: function (dropEl, num, collapsed) {
      var id = dropEl && dropEl.getAttribute("data-abs-drop");
      if (!id) return;
      var state = tocFoldByArticle.get(id);
      if (!state) { state = new Map(); tocFoldByArticle.set(id, state); }
      state.set(String(num), !!collapsed);
      liveControllers.forEach(function (c) {
        c.invalidateDrop(id);
        try { c.reconcile(); } catch (e) { /* one controller must not break the others */ }
      });
    }
  };
})();
