// author-footer.js aggregate() is the counting behind the summary row under
// the table: the activity span, citations, an author's works by position and
// type, and the top co-authors, journals, categories and keywords. Plain
// records in, plain counts out, so it is checked here without a grid.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../../src/javascript/author-footer.js");
const F = globalThis.OAAuthorFooter;
// --- tests
const helpers = {
  normalize: (s) => String(s || "").trim().toLowerCase(),
  authorIdOf: (au) => (typeof au === "string" ? au : (au && au.id) || ""),
  metricNumber: (v) => (typeof v === "number" && Number.isFinite(v) ? v : null),
  categoryCodes: (a) => a.categories || [],
};
const run = (arts, opts) => F.aggregate(arts, Object.assign({}, helpers, opts));
const entries = (map) => Object.fromEntries(map);
const WORKS = [
  { id: "w1", date: "2019-04", type: "JournalArticle", citations: 10, authors: ["ann", "bob"], venue: "Cem. Concr. Res.", keywords: ["rheology", "#print"], categories: ["MAT"] },
  { id: "w2", date: "2021-11", type: "Contribution", citations: null, authors: ["bob"], keywords: ["$rheology"], categories: ["MAT", "PRC"] },
  { id: "w3", date: "2020-01", type: "JournalArticle", citations: 5, authors: ["cy", "bob", "ann"], venue: "cem. concr. res. ", keywords: [], categories: [] },
  { id: "w4", date: "2018-02", type: "journalArticle", citations: 0, authors: ["bob", "dee"], venue: "Autom. Constr.", keywords: ["rheology"], categories: ["PRC"] },
];

test("activity and citations: a missing count is not a zero", () => {
  const r = run(WORKS, {});
  assert.equal(r.first, "2018-02");
  assert.equal(r.last, "2021-11");
  assert.equal(r.cites, 15);
  assert.equal(r.missingCites, 1);
});

test("an author's works split by position and record type", () => {
  const r = run(WORKS, { slug: "bob" });
  // [first of several, last of several, sole, neither] x [journal, contribution]
  assert.deepEqual(r.posTypeIds, [[["w4"], []], [["w1"], []], [[], ["w2"]], [["w3"], []]]);
  assert.deepEqual(r.posCites, [0, 10, 0, 5]);
  assert.deepEqual(r.posMiss, [0, 0, 1, 0]);
  assert.deepEqual(entries(r.coCount), { ann: 2, cy: 1, dee: 1 });
});

test("without an author, every author counts and no position is taken", () => {
  const r = run(WORKS, {});
  assert.deepEqual(entries(r.coCount), { ann: 2, bob: 4, cy: 1, dee: 1 });
  assert.deepEqual(r.posTypeIds, [[[], []], [[], []], [[], []], [[], []]]);
});

test("a topic counts its journals: journal articles only, one spelling each", () => {
  const r = run(WORKS, { topic: true });
  assert.deepEqual(entries(r.venCount), { "cem. concr. res.": 2, "autom. constr.": 1 });
  assert.equal(r.venName.get("cem. concr. res."), "Cem. Concr. Res.");
  assert.equal(run(WORKS, {}).venCount.size, 0);
});

test("a keyword footer leaves its keyword out, whatever the sigil", () => {
  assert.deepEqual(entries(run(WORKS, { kwSelf: "rheology" }).kwCount), { "#print": 1 });
  assert.deepEqual(entries(run(WORKS, {}).kwCount), { rheology: 2, "#print": 1, "$rheology": 1 });
});

test("co-categories count at the category's level, once per work, not itself", () => {
  const catDefs = {
    MAT: { level: 1, parent: null }, PRC: { level: 1, parent: null },
    "MAT.CEM": { level: 2, parent: "MAT" }, "PRC.EXT": { level: 2, parent: "PRC" },
  };
  const arts = [
    { id: "a", categories: ["MAT.CEM", "PRC.EXT", "PRC"] },
    { id: "b", categories: ["MAT", "PRC.EXT"] },
    { id: "c", categories: ["MAT.CEM"] },
  ];
  assert.deepEqual(entries(run(arts, { catCode: "MAT", catDefs }).catCount), { PRC: 2 });
  assert.deepEqual(entries(run(arts, {}).catCount), { "MAT.CEM": 2, "PRC.EXT": 2, PRC: 1, MAT: 1 });
});
