// grid-rules.js turns the Filters panel's rows into the test every grid row
// goes through. Run for real in a vm with rule-language.js, on three indexed
// rows: which rows each kind of condition keeps. A regression here changes
// what a saved link or a short link lists.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (f) => readFileSync(new URL("../../src/javascript/" + f, import.meta.url), "utf8");
const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read("rule-language.js"), ctx);
vm.runInContext(read("grid-rules.js"), ctx);
const L = ctx.OARuleLanguage;

// The grid's folding (articles-grid.js normalizeText, OATypeset.fold left out)
// and the indexes prepareRuntimeIndexes puts on each row.
const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
function row(r) {
  const kw = r.keywords.map(norm), set = new Set(kw);
  kw.forEach((k) => set.add(k.replace(/^[#$]/, "")));
  const au = r.authors.flatMap((a) => [a, a.replace("_", " ")]);
  return Object.assign({ _titleLc: norm(r.title), _venueLc: norm(r.venue), _keywordSet: set, _keywordsSearchLc: kw.join(" | "),
    _authorExactSet: new Set(au), _authorSearchLc: au.join(" | ") }, r);
}
const rows = [
  row({ id: "a2020", title: "Printing beams", venue: "Cement and Concrete Research", keywords: ["#printing", "$beam"], authors: ["bos_freek"],
    date: "2020-05-01", type: "JournalArticle", openAccess: true, categories: ["MAT"], refIds: [], relatedIds: ["b2021", "c2022"] }),
  row({ id: "b2021", title: "Rheology of mortar", venue: "Materials", keywords: ["#rheology"], authors: ["wolfs_rob", "bos_freek"],
    date: "2021-02-10", type: "Contribution", openAccess: false, categories: ["MAT.R"], refIds: ["a2020"] }),
  row({ id: "c2022", title: "Robotic printing", venue: "Automation in Construction", keywords: ["#printing"], authors: ["lee_kim"],
    date: "2022-11-03", type: "JournalArticle", openAccess: false, categories: ["ROB"], refIds: ["b2021"] }),
];
const byId = new Map(rows.map((r) => [r.id, r]));
ctx.CATEGORY_DEFS = { MAT: { num: "04.00.00" }, "MAT.R": { num: "04.12.00" }, ROB: { num: "07.00.00" } };
const store = {
  categoryCodes: (a) => a.categories,
  categoryDescendants: (code) => new Set(code === "MAT" ? ["MAT", "MAT.R"] : [code]),
  getById: (id) => byId.get(id) || null,
  referencesOf: (id) => (byId.get(id) || { refIds: [] }).refIds,
  citationsOf: (id) => rows.filter((r) => r.refIds.includes(id)).map((r) => r.id),
};
const rules = ctx.OAGridRules.create({
  language: L, parseQuery: (q) => L.parse(q), articles: rows, articleStore: store, normalizeText: norm, foldText: (s) => s,
  authorSlug: (key) => ({ "bos, freek": "bos_freek" })[key],
});
// The ids a query keeps, through the panel's own path: rows -> query -> tree.
const keep = (q) => { const t = rules.compileFromRows(L.treeToRows(L.parse(q)).rows); return rows.filter((r) => t(r)).map((r) => r.id).join(" "); };

test("no rows, or every condition switched off, keeps every row", () => {
  assert.equal(rules.compileFromRows([])(rows[0]), true);
  assert.equal(keep('SKIP KEYWORD IS "printing" AND SKIP TITLE ~ "x"'), "a2020 b2021 c2022");
  assert.equal(rules.compileRule({ field: "keyword", operator: "is", value: " " }), null);
});

test("keywords: IS with or without the sigil, CONTAINS and its negations", () => {
  assert.equal(keep('KEYWORD IS "printing"'), "a2020 c2022");
  assert.equal(keep('KEYWORD IS "$beam"'), "a2020");
  assert.equal(keep('KEYWORD != "printing"'), "b2021");
  assert.equal(keep('KEYWORD CONTAINS "rheo"'), "b2021");
  assert.equal(keep('KEYWORD NOT_CONTAINS "rheo"'), "a2020 c2022");
});

test("authors: IS by slug or by the label the builder shows, CONTAINS by name", () => {
  assert.equal(keep('AUTHOR IS "bos_freek"'), "a2020 b2021");
  assert.equal(keep('AUTHOR IS "Bos, Freek"'), "a2020 b2021");
  assert.equal(keep('AUTHOR CONTAINS "wolfs"'), "b2021");
  assert.equal(keep('AUTHOR != "bos_freek"'), "c2022");
});

test("title, venue, ID, type, access and favorites", () => {
  assert.equal(keep('TITLE CONTAINS "print"'), "a2020 c2022");
  assert.equal(keep('VENUE IS "materials"'), "b2021");
  assert.equal(keep('ID IS "A2020"'), "a2020");
  assert.throws(() => rules.compileRule({ field: "id", operator: "contains", value: "a" }), /IS and IS_NOT only/);
  assert.equal(keep('TYPE IS "Contribution"'), "b2021");
  assert.equal(keep("OPEN_ACCESS = TRUE"), "a2020");
  ctx.OAFavorites = { has: (id) => id === "c2022" };
  assert.equal(keep("IS_FAVORITE = TRUE"), "c2022");
});

test("categories: IS takes the whole branch, BEGINS WITH a number or code prefix", () => {
  assert.equal(keep('CATEGORY IS "MAT"'), "a2020 b2021");
  assert.equal(keep('CATEGORY != "MAT"'), "c2022");
  assert.equal(keep('CATEGORY BEGINS_WITH "04.12"'), "b2021");
  assert.equal(keep('CATEGORY BEGINS_WITH "ro"'), "c2022");
});

test("dates compare months; BETWEEN takes its bounds either way round", () => {
  assert.equal(keep("DATE >= 2021-02"), "b2021 c2022");
  assert.equal(keep("DATE = 2020-05"), "a2020");
  assert.equal(keep("DATE BETWEEN 2022-12 AND 2021-01"), "b2021 c2022");
  assert.throws(() => rules.compileDateRule("2020-5", ">="), /DATE expects YYYY-MM/);
});

test("the citation graph: references, citations, similar, and by person", () => {
  assert.equal(keep('REFERENCES_OF "b2021"'), "a2020");
  assert.equal(keep('CITATIONS_OF "a2020"'), "b2021");
  assert.equal(keep('SIMILAR_TO "a2020"'), "c2022");               // b2021 cites it, so it is no "similar" one
  assert.equal(keep('REFERENCES_OF "nobody"'), "");                 // an unknown id lists nothing, not everything
  assert.equal(keep('CITES_AUTHOR IS "bos_freek"'), "b2021 c2022");
  assert.equal(keep('CITED_BY_AUTHOR IS "lee_kim"'), "b2021");
});

test("abstract and contents CONTAINS read their sources live and mark the abstract's needle", () => {
  ctx.OASemanticSearch = { getAbstractTextFor: (id) => (id === "a2020" ? "Slump flow tests" : ""), isReady: () => true };
  ctx.TOC_DATA = { b2021: [[1, "Methods"], [1, "Results"]] };
  ctx.OARuleHighlights = [];
  assert.equal(keep('ABSTRACT CONTAINS "slump"'), "a2020");
  assert.deepEqual([...ctx.OARuleHighlights], ["slump"]);
  assert.equal(keep('TOC CONTAINS "method"'), "b2021");
});

test("AND, OR, NOT and brackets combine as the language reads them", () => {
  assert.equal(keep('KEYWORD IS "printing" AND NOT AUTHOR IS "bos_freek"'), "c2022");
  assert.equal(keep('VENUE IS "materials" OR KEYWORD IS "beam" AND DATE >= 2021-01'), "b2021");
  assert.equal(keep('(VENUE IS "materials" OR KEYWORD IS "beam") AND DATE <= 2021-12'), "a2020 b2021");
});
