// grid-sort.js orders the article table for a header click and a ?SORT_BY=
// link alike. Shared links carry SORT_BY names, so those must keep parsing,
// and the comparator must order text the way a reader expects.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../../src/javascript/grid-sort.js");
const S = globalThis.OAGridSort;
// --- tests
const metricNumber = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const cmp = S.comparator({ metricNumber, authorDisplayName: (a) => a.lastName + " " + a.firstName });
// SlickGrid's DataView sorts ascending, then reverses for a descending sort.
const order = (rows, field, asc) => { const out = rows.slice().sort(cmp(field, asc)); if (!asc) out.reverse(); return out; };
const rows = (key, values) => values.map((v, i) => ({ _idx: i, [key]: v }));

test("SORT_BY names: aliases, either separator, any case, default direction", () => {
  for (const n of ["LATEST", "newest", "NEW", "date-desc", "DATE_DESC", " date_desc "]) assert.deepEqual(S.parseSortBy(n), { columnId: "date", ascending: false }, n);
  assert.deepEqual(S.parseSortBy("title"), { columnId: "title", ascending: true });
  assert.deepEqual(S.parseSortBy("citations"), { columnId: "citations", ascending: false });
  assert.deepEqual(S.parseSortBy("oa_yes"), { columnId: "openAccess", ascending: false });
  assert.equal(S.parseSortBy("bogus"), null);
  assert.equal(S.parseSortBy(""), null);
});

test("every canonical name reads back to its own sort", () => {
  for (const columnId of ["date", "title", "authors", "venue", "openAccess", "citations"]) {
    for (const ascending of [true, false]) {
      const name = S.canonicalSortBy(columnId, ascending);
      assert.ok(name, columnId + " " + ascending);
      assert.deepEqual(S.parseSortBy(name), { columnId, ascending }, name);
    }
  }
  assert.equal(S.canonicalSortBy("doi", true), null);
});

test("text sorts as a reader reads: case, accents and numbers", () => {
  const titles = order(rows("title", ["Zinc", "aggregate", "10 layers", "3 layers", "Éclat"]), "title", true).map((r) => r.title);
  assert.deepEqual(titles, ["3 layers", "10 layers", "aggregate", "Éclat", "Zinc"]);
});

test("citations: numeric both ways, a missing count always last", () => {
  const r = rows("citations", [5, null, 12, "3", ""]);
  assert.deepEqual(order(r, "citations", true).map((x) => x.citations), ["3", 5, 12, null, ""]);
  assert.deepEqual(order(r, "citations", false).map((x) => x.citations), [12, 5, "3", null, ""]);
});

test("equal keys keep their source order", () => {
  assert.deepEqual(order(rows("venue", ["b", "a", "b", "a"]), "venue", true).map((x) => x._idx), [1, 3, 0, 2]);
  assert.deepEqual(order(rows("citations", [7, 7, 7]), "citations", false).map((x) => x._idx), [0, 1, 2]);
});

test("author lists sort by their display names", () => {
  const r = rows("authors", [[{ firstName: "Rob", lastName: "Wolfs" }], [{ firstName: "Ana", lastName: "Bos" }, { firstName: "X", lastName: "Y" }]]);
  assert.deepEqual(order(r, "authors", true).map((x) => x._idx), [1, 0]);
});
