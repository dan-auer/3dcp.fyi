/* grid-sort.js - how the article table sorts: one comparator for the header
 * click and the ?SORT_BY= link, so the two cannot diverge, and the SORT_BY
 * names read both ways. No DOM: articles-grid.js wires it to SlickGrid.
 * Unit-tested: tests/unit/grid-sort.test.mjs.
 */
(function () {
  "use strict";

  // compareByField(field, ascending) for one grid. opts: metricNumber and
  // authorDisplayName, the grid's readings of a record.
  function comparator(opts) {
    const metricNumber = opts.metricNumber, authorDisplayName = opts.authorDisplayName;
    // Sort-key memo: the comparator runs O(n log n) times per sort, so
    // normalising an author/array field (map -> join) INSIDE it re-allocated
    // the same string on every comparison. Cache the normalised key per
    // (row, field) in a WeakMap sidecar - no mutation of the shared record -
    // and reuse it across every comparison and re-sort. Sorted fields are
    // immutable content (title/venue/authors/year), so the cache never staled.
    var sortKeyCache = new WeakMap();
    function sortKey(row, field) {
      var perRow = sortKeyCache.get(row);
      if (!perRow) { perRow = Object.create(null); sortKeyCache.set(row, perRow); }
      if (field in perRow) return perRow[field];
      var v = row[field];
      if (field === "citations") {
        v = metricNumber(v);
        if (v != null && v < 0) v = null;
      }
      if (Array.isArray(v)) {
        v = v.map(function (entry) {
          if (entry && (entry.firstName !== undefined || entry.lastName !== undefined)) {
            return authorDisplayName(entry);
          }
          return (entry && entry.name) || entry;
        }).join("; ");
      }
      perRow[field] = v;
      return v;
    }

    // Numbers (Citations) compare numerically; everything else (Title / Authors /
    // Venue / DOI) compares through one shared Intl.Collator so ordering is
    // case-insensitive, accent-aware and natural-number-aware - matching the
    // localeCompare used for the filter datalists. A raw `x > y` here sorted by
    // UTF-16 code unit, which put every capitalized value ahead of every
    // lowercase one ("Zinc" before "aggregate"), pushed accented titles to the
    // end, and ordered digit-initial titles as text ("10" before "3").
    var sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    function compareByField(field, ascending) {
      return function (a, b) {
        var x = sortKey(a, field);
        var y = sortKey(b, field);

        // Slick reverses descending results. Compensate only missing
        // citation placement, so unknown counts stay last both ways.
        if (field === "citations" && (x == null) !== (y == null)) {
          return (x == null ? 1 : -1) * (ascending === false ? -1 : 1);
        }
        var c;
        if (typeof x === "number" && typeof y === "number") {
          c = x - y;
        } else {
          c = sortCollator.compare(x == null ? "" : String(x), y == null ? "" : String(y));
        }

        // Stable, deterministic tie-break on source position so equal keys
        // never reshuffle between sorts.
        if (c === 0) {
          const position = (a._idx || 0) - (b._idx || 0);
          return field === "citations" && ascending === false ? -position : position;
        }
        return c;
      };
    }
    return compareByField;
  }

  // ?sort_by=LATEST -> date desc, etc. Names are matched
  // case-insensitively after trimming; "-" and "_" are interchangeable
  // so DATE-DESC, DATE_DESC, date_desc and date-desc all work.
  const SORT_COLUMN_BY_NAME = {
    "date": "date", "title": "title", "authors": "authors", "venue": "venue",
    "oa": "openAccess", "openaccess": "openAccess",
    "citations": "citations"
  };
  // Named shorthands that don't follow "<column>_<asc|desc>". Includes the
  // canonical names SORT_BY_CANONICAL emits into the live URL, so a shared or
  // reloaded ?SORT_BY= round-trips back to the same sort.
  const SORT_ALIASES = {
    "latest": "date_desc", "newest": "date_desc", "new": "date_desc",
    "oldest": "date_asc", "old": "date_asc",
    "oa_yes": "oa_desc", "oa_no": "oa_asc",
    "cited_most": "citations_desc", "cited_least": "citations_asc"
  };
  // Columns whose natural first reading is "most / newest first".
  const SORT_DESC_FIRST = new Set(["date", "citations", "openAccess"]);

  // "<column>[_asc|_desc]" after alias expansion; direction defaults per column.
  function parseSortBy(sortBy) {
    let key = String(sortBy || "").trim().toLowerCase().replace(/-/g, "_");
    if (SORT_ALIASES[key]) key = SORT_ALIASES[key];
    const parts = /^(.*?)(?:_(asc|desc))?$/.exec(key);
    const columnId = SORT_COLUMN_BY_NAME[parts[1]];
    if (!columnId) return null;
    return {
      columnId: columnId,
      ascending: parts[2] ? parts[2] === "asc" : !SORT_DESC_FIRST.has(columnId)
    };
  }

  // Inverse map: pick a canonical (uppercase) name for the current sort
  // state. Used by the live URL sync so a header click round-trips
  // through ?sort_by.
  const SORT_BY_CANONICAL = {
    "date-desc":       "NEW",
    "date-asc":        "OLD",
    "title-asc":       "TITLE",
    "title-desc":      "TITLE_DESC",
    "authors-asc":     "AUTHORS",
    "authors-desc":    "AUTHORS_DESC",
    "venue-asc":       "VENUE",
    "venue-desc":      "VENUE_DESC",
    "openAccess-desc": "OA_YES",
    "openAccess-asc":  "OA_NO",
    "citations-desc":  "CITED_MOST",
    "citations-asc":   "CITED_LEAST"
  };

  // The canonical SORT_BY name for a column and direction, or null.
  function canonicalSortBy(columnId, ascending) {
    return SORT_BY_CANONICAL[columnId + "-" + (ascending ? "asc" : "desc")] || null;
  }

  window.OAGridSort = Object.freeze({ comparator: comparator, parseSortBy: parseSortBy, canonicalSortBy: canonicalSortBy });
})();
