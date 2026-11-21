// author-indices.js: the author panel's citation indices, checked on one
// hand-worked record (k = 10, 8, 5, 4, 3).
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../../src/javascript/author-indices.js");
const compute = globalThis.OAIndicesChart.compute;
const rec = (ks, a = 1) => ks.map((k) => ({ k, a }));

test("indices of a known record, shared authorship, and no works", () => {
  assert.deepEqual(compute({ records: rec([10, 8, 5, 4, 3]), yearsActive: 2 }),
    { h: 4, i10: 1, g: 5, e: Math.sqrt(11), o: Math.sqrt(40), m: 2, hm: 4 });
  assert.equal(compute({ records: rec([10, 8, 5, 4, 3], 2), yearsActive: 1 }).hm, 2.5);
  assert.deepEqual(compute({ records: [], yearsActive: 1 }), { h: 0, i10: 0, g: 0, e: 0, o: 0, m: 0, hm: 0 });
});
