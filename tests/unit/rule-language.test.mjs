// rule-language.js is the pure query language behind the Filters panel and
// every short link: parse a query, compile it to a predicate, and write the
// editor's rows back out. A regression here changes which articles a saved link
// shows, so the spellings and round trips are pinned down.
import test from "node:test";
import assert from "node:assert/strict";

await import("../../src/javascript/rule-language.js");
const R = globalThis.OARuleLanguage;
// --- tests
const strip = (node) => JSON.parse(JSON.stringify(node, (k, v) => (k === "id" ? undefined : v)));
const one = (q) => strip(R.parse(q)).children[0];

test("a single rule parses into the AND root the editor expects", () => {
  assert.deepEqual(strip(R.parse('KEYWORD IS "rheology"')), {
    type: "group", logic: "AND",
    children: [{ type: "rule", field: "keyword", operator: "is", value: "rheology" }],
  });
});

test("symbols and keywords spell the same operators", () => {
  assert.deepEqual(one('AUTHOR = "wolfs_rob"'), one('AUTHOR IS "wolfs_rob"'));
  assert.equal(one('TITLE ~ "beam"').operator, "contains");
  assert.equal(one('TITLE !~ "beam"').operator, "does not contain");
  assert.equal(one('VENUE != "x"').operator, "is not");
  assert.deepEqual(one('CATEGORY ^= "mat"'), { type: "rule", field: "category", operator: "begins with", value: "MAT" });
  assert.equal(one("DATE >= 2020-01").operator, ">=");
  assert.deepEqual(one("DATE BETWEEN 2020-01 AND 2021-06"), { type: "rule", field: "date", operator: "between", value: "2020-01", value2: "2021-06" });
  assert.deepEqual(one("OPEN_ACCESS = TRUE"), { type: "rule", field: "openAccess", operator: "is", value: "true" });
  assert.deepEqual(one('TYPE IS "journalarticle"'), { type: "rule", field: "type", operator: "is", value: "JournalArticle" });
  assert.deepEqual(one('REFERENCES_OF "abc2020"'), { type: "rule", field: "references", operator: "is", value: "abc2020" });
});

test("typos fail loudly instead of matching the wrong rows", () => {
  assert.throws(() => R.parse("DATE > 2020-01"), /only >= and <=/);
  assert.throws(() => R.parse('FOO IS "x"'), /Unknown field/);
  assert.throws(() => R.parse('KEYWORD IS "open'), /Unterminated/);
  assert.throws(() => R.parse("KEYWORD IS"), /Expected value/);
  assert.throws(() => R.parse('TITLE IS "x"'), /does not support is/);
  assert.throws(() => R.parse("DATE = 2020-13"), /YYYY-MM/);
  assert.throws(() => R.parse('VENUE ^= "x"'), /only supported for CATEGORY/);
  assert.throws(() => R.parse('KEYWORD IS "a")'), /trailing/);
  assert.throws(() => R.parse('(KEYWORD IS "a"'), /Expected '\)'/);
  assert.throws(() => R.parse('TYPE IS "book"'), /expects JournalArticle or Contribution/);
});

test("AND binds tighter than OR; NOT and SKIP take one atom", () => {
  const or = strip(R.parse('KEYWORD IS "a" OR KEYWORD IS "b" AND KEYWORD IS "c"')).children[0];
  assert.equal(or.logic, "OR");
  assert.equal(or.children[0].value, "a");
  assert.equal(or.children[1].logic, "AND");
  assert.deepEqual(or.children[1].children.map((r) => r.value), ["b", "c"]);
  assert.equal(one('NOT KEYWORD IS "a"').type, "not");
  assert.equal(one('SKIP KEYWORD IS "a"').disabled, true);
});

test("compile: NOT inverts; skipped and unavailable rules count for nothing", () => {
  const leaf = (rule) => (rule.value === "gone" ? null : (a) => a.keywords.includes(rule.value));
  const arts = [{ keywords: ["a"] }, { keywords: ["a", "b"] }, { keywords: ["c"] }];
  const run = (q) => { const p = R.compile(R.parse(q), leaf); return p ? arts.filter(p).length : "all"; };
  assert.equal(run('KEYWORD IS "a"'), 2);
  assert.equal(run('KEYWORD IS "a" AND NOT KEYWORD IS "b"'), 1);
  assert.equal(run('KEYWORD IS "a" OR KEYWORD IS "c"'), 3);
  assert.equal(run('KEYWORD IS "a" AND SKIP KEYWORD IS "c"'), 2);
  assert.equal(run('SKIP KEYWORD IS "a"'), "all");
  assert.equal(run('KEYWORD IS "c" AND NOT KEYWORD IS "gone"'), 1);
});

test("conditionToString writes the canonical spelling", () => {
  const c = (field, operator, value, extra) => R.conditionToString(Object.assign({ field, operator, value }, extra));
  assert.equal(c("keyword", "is", "  Rheology "), 'KEYWORD IS "rheology"');
  assert.equal(c("id", "is", "Abc2020"), 'ID IS "Abc2020"');
  assert.equal(c("category", "is", "mat"), 'CATEGORY IS "MAT"');
  assert.equal(c("openAccess", "is", "TRUE"), "OPEN_ACCESS IS TRUE");
  assert.equal(c("date", "between", "2020-01", { value2: "2021-06" }), "DATE BETWEEN 2020-01 AND 2021-06");
  assert.equal(c("references", "is", "Key1"), 'REFERENCES_OF "Key1"');
  assert.equal(c("title", "contains", 'say "hi"\\'), 'TITLE CONTAINS "say \\"hi\\"\\\\"');
  assert.equal(c("keyword", "is", ""), "");
  assert.equal(c("date", "between", "2020-01"), "");
});

test("parse, rows, string: a saved query comes back as it was", () => {
  for (const q of [
    'KEYWORD IS "rheology"',
    'AUTHOR IS "wolfs_rob" AND DATE LATER_THAN 2020-01',
    'KEYWORD IS "a" OR KEYWORD IS "b"',
    'KEYWORD IS "a" AND (AUTHOR IS "b" OR AUTHOR IS "c")',
    'KEYWORD IS "a" AND NOT (AUTHOR IS "b" OR AUTHOR IS "c")',
    'NOT KEYWORD IS "a"',
    'KEYWORD IS "a" AND SKIP VENUE IS "x"',
    'DATE BETWEEN 2020-01 AND 2021-06 OR CATEGORY BEGINS_WITH "MAT"',
  ]) assert.equal(R.rowsToString(R.treeToRows(R.parse(q)).rows), q, q);
});

test("a blank row drops out without unbalancing its brackets", () => {
  const rows = [
    { field: "keyword", operator: "is", value: "a", connector: "AND" },
    { field: "author", operator: "is", value: "b", connector: "AND", openParens: 1 },
    { field: "author", operator: "is", value: "", connector: "OR", closeParens: 1 },
  ];
  assert.equal(R.rowsToString(rows), 'KEYWORD IS "a" AND (AUTHOR IS "b")');
  // Old rows with NOT in the connector slot: the NOT moves onto the row / its bracket.
  const legacy = [{ field: "keyword", operator: "is", value: "a" }, { field: "author", operator: "is", value: "b", connector: "NOT" }];
  assert.equal(R.rowsToString(legacy), 'KEYWORD IS "a" AND NOT AUTHOR IS "b"');
  legacy[1].openParens = 1; legacy[1].closeParens = 1;
  assert.equal(R.rowsToString(legacy), 'KEYWORD IS "a" AND NOT (AUTHOR IS "b")');
});

test("polarity: rowIsNegated and positiveRules", () => {
  assert.equal(R.rowIsNegated({ negated: true }), true);
  assert.equal(R.rowIsNegated({ connector: "NOT" }), true);
  assert.equal(R.rowIsNegated({ openNegations: [false, true] }), true);
  assert.equal(R.rowIsNegated({ connector: "AND", openNegations: [false] }), false);
  const pos = R.positiveRules(R.parse('KEYWORD IS "a" AND NOT KEYWORD IS "b" AND SKIP KEYWORD IS "c"'));
  assert.deepEqual(pos.map((r) => r.value), ["a"]);
});

test("a query nested past 32 levels is a parse error, not a stack overflow", () => {
  const wrap = (n) => "(".repeat(n) + 'TITLE ~ "x"' + ")".repeat(n);
  assert.equal(one(wrap(32)).field, "title");
  assert.equal(strip(R.parse("NOT ".repeat(32) + 'TITLE ~ "x"')).children[0].type, "not");
  for (const q of [wrap(33), wrap(5000), "NOT ".repeat(5000) + 'TITLE ~ "x"', "SKIP ".repeat(40) + 'TITLE ~ "x"']) {
    assert.throws(() => R.parse(q), (e) => e instanceof Error && !(e instanceof RangeError) && /Nested more than 32 levels deep/.test(e.message));
  }
});
