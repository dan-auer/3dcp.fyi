/* Landing statistics describe this loaded dataset - from data/summary.json
 * (window.OA_SUMMARY, table-gate.js) when the deploy wrote one, else from the
 * article store. Publication month, exporter provenance, and web-build
 * provenance are distinct. Replacing an export needs a page reload; no
 * background refresh or polling is implied. */
(function () {
  "use strict";

  var metricNumber = window.OAArticleStore.metricNumber;

  function renderLanding() {
    var D = (window.OA_SUMMARY && window.OA_SUMMARY.summary) || window.OAArticleStore.get().summary() || {};
    var BIG = new Set(["articles", "authors", "keywords", "areas", "categories", "subcategories", "crossReferences"]);
    var fmt = window.OATheme.fmtNum;
    document.querySelectorAll("[data-stat]").forEach(function (el) {
      var key = el.getAttribute("data-stat"), value = metricNumber(D[key]);
      el.textContent = value == null ? "Unavailable" : BIG.has(key) ? fmt(value) : String(value);
    });

    // `updated` is a retained template/stat alias for latest publication month.
    // It has never been an exporter timestamp. Source templates label it openly.
    var latest = D.latestPublicationMonth || D.updated;
    var publicationMonth = typeof latest === "string" && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(latest) ? latest : "Unavailable";
    document.querySelectorAll('[data-l="updated"]').forEach(function (el) {
      el.textContent = publicationMonth;
      el.setAttribute("aria-label", "Latest publication: " + publicationMonth);
    });

    var bibPre = document.querySelector('[data-l="bibtex"]');
    var copyBtn = document.querySelector('[data-l="bibtexCopy"]');
    if (bibPre && copyBtn) copyBtn.setAttribute("data-copy", bibPre.textContent);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderLanding);
  else renderLanding();
})();
