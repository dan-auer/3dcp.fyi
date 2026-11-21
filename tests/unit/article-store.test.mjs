// article-store.js is a classic script that installs window.OAArticleStore.
// Run it in a bare vm context with a stand-in window and test the pure
// helpers it exposes. No DOM, no dataset: these are the readings every view
// shares, so a regression here shows up in every column at once.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../src/javascript/article-store.js", import.meta.url), "utf8");
const win = { performance: { now: () => 0 }, setTimeout, console };
win.window = win;
vm.runInNewContext(src, win, { filename: "article-store.js" });
const S = win.OAArticleStore;

test("installs a frozen API", () => {
  assert.ok(S && Object.isFrozen(S));
  for (const k of ["get", "prepare", "metricNumber", "monthOf", "authorIdOf"]) assert.equal(typeof S[k], "function", k);
});

test("monthOf reads YYYY-MM (and YYYY-M-DD) into a month index", () => {
  assert.equal(S.monthOf("2024-03"), 2024 * 12 + 2);
  assert.equal(S.monthOf("1997-2-05"), 1997 * 12 + 1);
  assert.equal(S.monthOf("2024-13"), null);
  assert.equal(S.monthOf("2024-00"), null);
  assert.equal(S.monthOf("2024"), null);
  assert.equal(S.monthOf(""), null);
  assert.equal(S.monthOf(null), null);
});

test("monthOfOrYear, monthLabel, currentMonth: the shared month arithmetic", () => {
  assert.equal(S.monthOfOrYear("2024-03"), 2024 * 12 + 2);
  assert.equal(S.monthOfOrYear("2024"), 2024 * 12, "a year-only date is its January");
  assert.equal(S.monthOfOrYear(""), null);
  assert.equal(S.monthLabel(2024 * 12 + 2), "2024-03");
  assert.equal(S.monthLabel(S.monthOf("1997-12") + 1), "1998-01");
  const now = new Date();
  assert.equal(S.currentMonth(), now.getFullYear() * 12 + now.getMonth());
});

test("metricNumber keeps a missing metric distinct from zero", () => {
  assert.equal(S.metricNumber(0), 0);
  assert.equal(S.metricNumber("12"), 12);
  assert.equal(S.metricNumber(" 3.5 "), 3.5);
  assert.equal(S.metricNumber(null), null);
  assert.equal(S.metricNumber(undefined), null);
  assert.equal(S.metricNumber(""), null);
  assert.equal(S.metricNumber("   "), null);
  assert.equal(S.metricNumber(true), null);
  assert.equal(S.metricNumber(NaN), null);
  assert.equal(S.metricNumber("abc"), null);
});

test("authorIdOf accepts slugs and { id | slug } records", () => {
  assert.equal(S.authorIdOf("si_wen"), "si_wen");
  assert.equal(S.authorIdOf({ id: "a_b" }), "a_b");
  assert.equal(S.authorIdOf({ slug: "c_d" }), "c_d");
  assert.equal(S.authorIdOf({ id: "", slug: "e_f" }), "e_f");
  assert.equal(S.authorIdOf(null), "");
  assert.equal(S.authorIdOf({}), "");
});

test("get() with no dataset yields an empty, well-formed store", () => {
  // OABibliography is required to build; a stub is enough for an empty source.
  win.OABibliography = {
    normalizeDoi: (d) => String(d || ""),
    normalizeRecord: (r) => r,
    resolveAuthorName: () => ({ family: "", given: "" }),
  };
  win.ARTICLES_DATA = [];
  const store = S.get();
  assert.ok(store);
  assert.equal(typeof store.summary, "function");
  assert.equal(typeof store.facets, "function");
});

test("a three-paper store: totals, citation tallies, category counts, views", () => {
  win.CATEGORY_DEFS = { A: { level: 1 }, A1: { level: 2, parent: "A" } };
  win.AUTHORS_DATA = {};
  win.ARTICLES_DATA = [
    { id: "p1", date: "2020-01", authors: [{ id: "x" }, { id: "y" }], categories: ["A1"], citations: 5, references: 0, keywords: ["k"] },
    { id: "p2", date: "2020-03", authors: [{ id: "z" }], refIds: ["p1"], categories: ["A"], citations: "2", references: 1 },
    { id: "p3", date: "2021-01", authors: [{ id: "x" }, { id: "z" }], refIds: ["p1", "p2"], citations: null, references: 2 },
  ];
  const store = S.get();
  const s = store.summary();
  assert.deepEqual([s.articles, s.authors, s.keywords, s.areas, s.categories, s.crossReferences, s.yearFrom, s.updated],
    [3, 3, 1, 1, 1, 3, 2020, "2021-01"]);
  const c = store.cumulativeSeries();
  assert.deepEqual([c.start, c.publications.length, c.publications[2], c.publications[12], c.authors[12]], ["2020-01", 13, 2, 3, 3]);
  const x = store.authorSummary("x");
  assert.deepEqual([x.span.first, x.span.last, x.citations, x.works.length], ["2020-01", "2021-01", 5, 2]);
  // Array.from, not .map: the store's arrays belong to the vm context, and
  // deepStrictEqual compares prototypes, so a context array never equals a
  // literal from this realm. Array.from builds the outer array here.
  const rows = (list) => Array.from(list, (r) => [r.id, r.count, r.papers, r.theirs]);
  assert.deepEqual(rows(x.citedBy), [["z", 2, 1, 2]], "p2 and p3 cite p1; x on p3 is self");
  assert.deepEqual(rows(x.citedBySolo), [["z", 1, 1, 1]], "p3 shares x, so it drops out");
  assert.deepEqual(rows(x.citesMost), [["y", 1, 1, 1], ["z", 1, 1, 1]]);
  const cats = Object.fromEntries(store.facetSources().categories.map((r) => [r.value, r.count]));
  assert.deepEqual(cats, { A: 2, A1: 1 });
  win.ARTICLES_DATA = store.createView();
  assert.equal(S.get(), store, "a view maps back to the same store");
  assert.deepEqual([...store.categoryCodes(win.ARTICLES_DATA[0])], ["A1"]);
});

test("a title's byline names up to four authors, or all five rather than four and a +1", () => {
  win.CATEGORY_DEFS = {};
  win.AUTHORS_DATA = {};
  const people = (n) => Array.from({ length: n }, (_, i) => ({ id: "a" + i, lastName: "Name" + i, firstName: "First" }));
  win.ARTICLES_DATA = [4, 5, 6].map((n) => ({ id: "p" + n, title: "T" + n, date: "2020-01", authors: people(n) }));
  const byline = Object.fromEntries(Array.from(S.get().facetSources().titles, (r) => [r.value, r.authors]));
  assert.equal(byline.p4, "Name0, F.; Name1, F.; Name2, F.; Name3, F.");
  assert.equal(byline.p5, "Name0, F.; Name1, F.; Name2, F.; Name3, F.; Name4, F.");   // "...; +1" before
  assert.equal(byline.p6, "Name0, F.; Name1, F.; Name2, F.; Name3, F.; +2");
});
