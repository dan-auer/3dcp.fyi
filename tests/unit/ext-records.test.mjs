// ext-records.js builds the external-record links of a row (the drop's strip,
// the article pages' rail, Open all via). Run for real in a vm: an id the
// export wrote as a placeholder ("None", "EID not found ...") is no id - no
// Scopus, Web of Science or Inciteful link to a record that does not exist.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../src/javascript/ext-records.js", import.meta.url), "utf8");
const window = {
  OATheme: { escapeHtml: (s) => String(s) },
  OAArticleStore: { get: () => ({ neighbourCounts: () => null }) },   // the graph tiles' counts
};
vm.runInNewContext(src, { window, encodeURIComponent });
const { buildGroups } = window.OAExtRecords;

// Provider name -> its href, or null when the row has nothing to build it from.
function links(row) {
  const out = {};
  for (const g of buildGroups(row)) for (const it of g.items) out[it.name] = it.unavailable ? null : it.href;
  return out;
}

test("a real Scopus EID and Web of Science number make their links", () => {
  const l = links({ title: "T", doi: "10.1/x", eid: "2-s2.0-85123456789", wos: "000799138600004", date: "2025-06" });
  assert.match(l.Scopus, /eid=2-s2\.0-85123456789/);
  assert.match(l["Web of Science"], /WOS:000799138600004$/);
  assert.match(l.Inciteful, /000799138600004$/);
});

test("placeholders the export writes for a missing id make no link", () => {
  for (const missing of ["None", "EID not found for the given DOI", "", null, undefined]) {
    const l = links({ title: "T", doi: "10.1/x", eid: missing, wos: missing, date: "2025-06" });
    assert.equal(l.Scopus, null, "eid " + missing);
    assert.equal(l["Web of Science"], null, "wos " + missing);
    assert.equal(l.Inciteful, null, "wos " + missing);
    assert.ok(l["Google Scholar"]);   // the rest of the row still links
  }
});

test("each record tile's name starts with the code it shows", () => {
  const html = window.OAExtRecords.renderStrip({ id: "k", title: "T", doi: "10.1/x", eid: "2-s2.0-1", wos: "1", date: "2025-06" });
  const tiles = [...html.matchAll(/<a [^>]*class="oa-index"[^>]*aria-label="([^"]*)"[^>]*>\s*<span class="oa-index-short">([^<]*)<\/span>/g)];
  assert.ok(tiles.length > 10);
  for (const [, label, code] of tiles) assert.ok(label.startsWith(code + ", "), label + " / " + code);
});

test("a graph tile's count reads in the site's number format", () => {
  const store = window.OAArticleStore.get;
  window.OATheme.fmtNum = (n) => Number(n).toLocaleString("en-US").replace(/,/g, " ");   // oa-theme.js
  window.OAArticleStore.get = () => ({ neighbourCounts: () => ({ references: 1234, citations: 1, similar: 0 }) });
  try {
    const html = window.OAExtRecords.renderStrip({ id: "k", title: "T", doi: "10.1/x", date: "2025-06" });
    assert.match(html, /References of this article · 1 234 references/);   // "1,234" before
    assert.match(html, /Citations of this article \(articles citing it\) · 1 citation[&"]/);
  } finally {
    window.OAArticleStore.get = store;
  }
});
