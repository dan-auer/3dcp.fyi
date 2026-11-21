/* ext-records.js - the site-wide external-record provider catalogue + its two
 * renderers. window.OAExtRecords:
 *
 *   buildGroups(row)  -> [{label, items:[{short,name,href|unavailable}]}]
 *       `row` is a grid row (doi / eid / wos / date on the row itself): every
 *       link is derived from those - Google Scholar from title, first author
 *       and year; Scopus from eid; WoS and Inciteful from wos; the rest from
 *       the DOI. A provider without its identifier is n/a.
 *   renderStrip(art)  -> compact one-row strip for the abstract drop-downs:
 *       same groups + tile vocabulary, but available providers only - a strip
 *       inside a list row is for acting, not for inventorying gaps.
 *
 * All links open in a new tab (external records leave the site).
 * Loaded before articles-grid.js (index.html). */
(function () {
  "use strict";

  var esc = window.OATheme.escapeHtml;

  /* The fixed catalogue: group, short code and display name live here in code.
     A present URL = available, a missing/empty one = n/a. */
  var REGISTRY = [
    { label: "Discovery", items: [
      // The DOI resolver leads: the grid's DOI column was folded into this strip,
      // so this tile is now the row's one publisher link.
      { key: "doi",             short: "DOI", name: "Publisher (doi.org)" },
      { key: "googlescholar",   short: "GS",  name: "Google Scholar" },
      { key: "scopus",          short: "Sc",  name: "Scopus" },
      { key: "webofscience",    short: "WoS", name: "Web of Science" },
      { key: "semanticscholar", short: "S2",  name: "Semantic Scholar" },
      { key: "scite",           short: "St",  name: "scite.ai" },
      { key: "connectedpapers", short: "Cn",  name: "Connected Papers" },
      { key: "litmaps",         short: "Lm",  name: "Litmaps" },
      { key: "researchgate",    short: "RG",  name: "ResearchGate" },
      { key: "inciteful",       short: "In",  name: "Inciteful" },
      { key: "openaire",        short: "OAi", name: "OpenAire" },
    ] },
    { label: "Metadata", items: [
      { key: "crossref",      short: "Cr", name: "CrossRef" },
      { key: "openalex",      short: "OA", name: "OpenAlex" },
      { key: "opencitations", short: "OC", name: "OpenCitations" },
      { key: "crossmark",     short: "\u2713", name: "Crossmark" },
      { key: "unpaywall",     short: "U",  name: "Unpaywall" },
      { key: "core",          short: "Co", name: "CORE" },
    ] },
    { label: "Metrics", items: [
      { key: "plumx",     short: "pX", name: "plu.mx" },
      { key: "altmetric", short: "Am", name: "Altmetric" },
      { key: "bip",       short: "B!", name: "BIP!" },
    ] },
  ];

  // A grid row's identifiers -> render-ready provider groups.
  // A Scopus EID or a Web of Science accession number only in its own shape:
  // the export also writes "None" (806 EIDs, 1,864 WoS numbers) and "EID not
  // found for the given DOI", which made links to records that do not exist.
  var EID_RE = /^2-s2\.0-\d+$/, WOS_RE = /^\d+$/;
  function buildGroups(a) {
    var md = { doi: a.doi, eid: EID_RE.test(a.eid) ? a.eid : "", wos: WOS_RE.test(a.wos) ? a.wos : "", date: a.date };
    // Google Scholar: title + first author's surname + a +/-2yr window.
    var firstAuthor = Array.isArray(a.authors) ? a.authors[0] : null;
    var faId = typeof firstAuthor === "string" ? firstAuthor : (firstAuthor && (firstAuthor.id || firstAuthor.slug));
    var faProf = faId ? ((window.AUTHORS_DATA || {})[faId] || {}) : {};
    var faLast = faProf.lastName != null ? faProf.lastName : (firstAuthor && firstAuthor.lastName);
    var year = (md.date && /\d{4}/.test(md.date)) ? parseInt(String(md.date).match(/\d{4}/)[0], 10) : null;
    var scholar = "";
    if (a.title) {
      var p = ["as_q=" + encodeURIComponent(a.title), "as_occt=title"];
      if (faLast) p.push("as_sauthors=" + encodeURIComponent(faLast));
      if (year) { p.push("as_ylo=" + (year - 2)); p.push("as_yhi=" + (year + 2)); }
      p.push("hl=en");
      scholar = "https://scholar.google.com/scholar?" + p.join("&");
    }
    var derived = {
      googlescholar: scholar,
      scopus: md.eid
        ? "https://www.scopus.com/record/display.url?eid=" + encodeURIComponent(md.eid) + "&origin=resultslist"
        : "",
      webofscience: md.wos
        ? "https://www.webofscience.com/wos/woscc/full-record/WOS:" + encodeURIComponent(md.wos)
        : "",
      inciteful: md.wos
        ? "https://inciteful.xyz/p/" + encodeURIComponent(md.wos)
        : "",
    };
    // DOI-derived providers. DOIs contain '/', so use the raw DOI in path
    // segments and a URL-encoded copy in query-string values.
    if (md.doi) {
      var doi = md.doi;
      var doiQ = encodeURIComponent(md.doi);
      derived.doi = "https://doi.org/" + doi;
      derived.plumx = "https://plu.mx/plum/a/?doi=" + doiQ;
      derived.crossref = "https://api.crossref.org/works/" + doi;
      derived.openalex = "https://api.openalex.org/works/doi:" + doi;
      derived.semanticscholar = "https://api.semanticscholar.org/graph/v1/paper/" + doi;
      derived.scite = "https://scite.ai/reports/" + doi;
      derived.connectedpapers = "https://www.connectedpapers.com/api/redirect/doi/" + doi;
      derived.litmaps = "https://app.litmaps.com/?doi=" + doiQ;
      derived.crossmark = "https://crossmark.crossref.org/dialog/?doi=" + doiQ + "&domain=pdf";
      derived.opencitations = "https://opencitations.net/meta/api/v1/metadata/doi:" + doi;
      derived.researchgate = "https://www.researchgate.net/search.Search.html?query=" + doiQ + "&type=publication&type=publication";
      derived.altmetric = "https://www.altmetric.com/details/doi/" + doi;
      derived.unpaywall = "https://api.unpaywall.org/v2/" + doi + "?email=info@3dcp.fyi";
      derived.openaire = "https://explore.openaire.eu/search/publication?pid=" + doiQ;
      derived.bip = "https://bip.imsi.athenarc.gr/details?id=" + doiQ;
      derived.core = "https://api.core.ac.uk/v3/search/works/?q=doi:%22" + doiQ + "%22&limit=1";
    }
    return REGISTRY.map(function (g) {
      return {
        label: g.label,
        items: g.items.map(function (it) {
          var href = derived[it.key];
          return href
            ? { short: it.short, name: it.name, href: href }
            : { short: it.short, name: it.name, unavailable: true };
        }),
      };
    });
  }

  // Citation-graph tiles for the abstract-drop strip: each adds a REFERENCES_OF /
  // CITATIONS_OF / SIMILAR_TO rule for this article to the article list. Rendered as
  // links to the filtered list so they work from any page's drops; the main
  // grid intercepts the click (.oa-graph-link) and adds the rule in place.
  // Glyphs are Tabler outline icons; the references arrow is step-out turned
  // 180deg (out of the dot = out of this article), citations is step-into.
  var GRAPH_ACTIONS = [
    { rule: "REFERENCES_OF", name: "References of this article", flip: true, count: "references", noun: "reference",
      paths: '<path d="M12 3l0 12"></path><path d="M16 7l-4 -4"></path><path d="M8 7l4 -4"></path><path d="M11 20a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path>' },
    { rule: "CITATIONS_OF", name: "Citations of this article (articles citing it)", count: "citations", noun: "citation",
      paths: '<path d="M12 3l0 12"></path><path d="M16 11l-4 4"></path><path d="M8 11l4 4"></path><path d="M11 20a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path>' },
    { rule: "SIMILAR_TO", name: "Similar articles (neither cited nor referenced)", count: "similar", noun: "similar article",
      paths: '<path d="M16 16v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h2v-2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2"></path>' }
  ];
  function renderGraphGroup(art) {
    var id = art.id;
    if (!id) return "";
    var rel = window.OA_REL_ROOT || "";
    // In-corpus neighbourhood sizes (null for an unknown id) - the number each
    // tile's filter would list, shown in its tooltip.
    var counts = window.OAArticleStore.get().neighbourCounts(id);
    return '<span class="abs-ext-group abs-ext-graph"><span class="abs-ext-lab">Graph</span><span class="abs-ext-tiles">' +
      GRAPH_ACTIONS.map(function (g) {
        var href = rel + "index.html?q=" + encodeURIComponent(g.rule + ' "' + id + '"');
        var n = counts ? counts[g.count] : null;
        var tally = n == null ? "" : window.OATheme.fmtNum(n) + " " + g.noun + (n === 1 ? "" : "s");
        var label = tally ? g.name + " \u00b7 " + tally : g.name;
        // Hover swaps the glyph for the count (.oa-index-n); an empty
        // neighbourhood is a dead tile: no href (so not a link, not focusable),
        // aria-disabled, and the grid's click handler ignores it.
        var dead = n === 0;
        var shown = n == null ? "" : (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace(/\.0$/, "") + "k" : String(n));
        return '<a ' + (dead ? 'aria-disabled="true" ' : 'href="' + esc(href) + '" ') +
          'class="oa-index oa-index-ic oa-graph-link' + (dead ? " is-disabled" : "") + (shown ? " has-count" : "") + '" data-graph-rule="' + g.rule + '" data-graph-id="' + esc(id) + '" title="' + esc(label) +
          (dead ? "" : '&#10;Click: replaces the current filters&#10;Shift+click: combine with them') + '" aria-label="' + esc(label) + (dead ? "" : ' (filters the article list)') + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (g.flip ? ' class="ic-flip"' : "") + ">" + g.paths + "</svg>" +
          (shown ? '<span class="oa-index-n" aria-hidden="true">' + shown + "</span>" : "") + "</a>";
      }).join("") +
      "</span></span>";
  }

  // Drop-strip view (grid abstract drop-downs): one wrapping row, available
  // providers only, empty groups skipped, plus the citation-graph filter tiles.
  // "" when nothing is available. Each group's tiles sit in their own
  // .abs-ext-tiles span (display: contents on desktop, so the row lays out as
  // before) so the phone layout can wrap a long group's tiles in a column
  // beside the label instead of under it.
  function renderStrip(art) {
    var parts = buildGroups(art).map(function (g) {
      var items = g.items.filter(function (it) { return !it.unavailable; });
      if (!items.length) return "";
      return '<span class="abs-ext-group"><span class="abs-ext-lab">' + esc(g.label) + '</span><span class="abs-ext-tiles">' +
        items.map(function (it) {
          // The name starts with the code on the tile ("Sc, Scopus"), so a
          // voice command naming what is seen reaches the link (WCAG 2.5.3).
          return '<a href="' + esc(it.href) + '" class="oa-index" target="_blank" rel="noopener" title="' + esc(it.name) + '" aria-label="' + esc(it.short) + ", " + esc(it.name) + ' (opens in new tab)">' +
            '<span class="oa-index-short">' + esc(it.short) + "</span></a>";
        }).join("") +
        "</span></span>";
    }).filter(Boolean);
    var graph = renderGraphGroup(art);
    // Publication type, after the provider groups (Metrics) and before the pinned
    // Graph cluster. Named as the TYPE rule names it, so the drop, the rule
    // builder and the author summary use the same words. Not an external
    // record, so it sits outside the strip's role=group.
    var typeLabel = "";
    if (art.type) {
      var opts = window.OARuleLanguage.schema.type.options;
      var t = String(art.type).toLowerCase();
      var hit = opts.filter(function (o) { return o.value.toLowerCase() === t; })[0];
      if (hit) typeLabel = hit.label;
    }
    var type = typeLabel
      ? '<span class="abs-ext-group abs-ext-type"><span class="abs-ext-lab">Type</span><span class="abs-ext-tiles"><span class="abs-ext-type-v">' + esc(typeLabel) + "</span></span></span>"
      : "";
    /* Right-hand end of the strip's first line: the citation-graph tiles, then
       the report action hard against the right edge (see .abs-ext-right).
       Either half may be absent. */
    var right = "";
    if (art.id) {
      // The HEADER report button is gone (reports are per record now), so this
      // deliberately carries no .oa-report-btn: that class was its fixed 34x34
      // geometry. report-error.js binds on [data-report-id]. It is about the
      // RECORD, not an external record, so it sits outside the strip's
      // role=group (see below) - a screen reader must not announce it as an
      // "External records" control.
      right += '<button type="button" class="abs-ext-report" data-report-id="' + esc(art.id) + '"' +
        (art.title ? ' data-report-label="' + esc(art.title) + '"' : "") +
        ' title="Report an error in this record" aria-label="Report an error in this record">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M12 9v4"></path><path d="M12 16v.01"></path></svg>' +
        "</button>";
    }
    if (!parts.length && !type && !graph && !right) return "";
    /* The provider tiles are the labelled group; the pinned right-hand cluster
       (graph tiles + report) is a sibling so its controls keep their own names. */
    return '<div class="abs-ext">' +
      (parts.length ? '<span class="abs-ext-groups" role="group" aria-label="External records">' + parts.join("") + "</span>" : "") +
      type +
      ((graph || right) ? '<span class="abs-ext-right">' + graph + right + "</span>" : "") +
      "</div>";
  }

  window.OAExtRecords = { REGISTRY: REGISTRY, buildGroups: buildGroups, renderStrip: renderStrip };
})();
