// matrix-common.js: the short author list keeps first, marked and last names
// (each run between them one "…"), and arrow keys step a pin through the grid.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.OATheme = { escapeHtml: (s) => String(s).replace(/</g, "&lt;") };
globalThis.OAArticleStore = { authorIdOf: (a) => (a && a.id) || "" };
await import("../../src/javascript/matrix-common.js");
const M = globalThis.OAMatrix;

test("authorsHtml: each person once, marked names bold, runs elided when short", () => {
  const authors = ["a", "b", "c", "b", "d", "e"].map((id) => ({ id }));
  const name = (a, id) => id.toUpperCase(), mark = (id) => (id === "c" ? "" : id === "e" ? "x" : null);
  assert.equal(M.authorsHtml(authors, name, mark, false), 'A; B; <b>C</b>; D; <b class="x">E</b>');
  assert.equal(M.authorsHtml(authors, name, mark, true), 'A; \u2026; <b>C</b>; \u2026; <b class="x">E</b>');
});

test("stepPin: headers clamp, cells follow the citations, none left is null", () => {
  const next = (i, from, d) => (from + d >= 0 && from + d < 3 ? from + d : -1);
  assert.deepEqual(M.stepPin("ArrowRight", -1, 2, 3, 3, next, next), { r: -1, c: 2 });
  assert.deepEqual(M.stepPin("ArrowDown", 1, -1, 3, 3, next, next), { r: 2, c: -1 });
  assert.deepEqual(M.stepPin("ArrowRight", 0, -1, 3, 3, next, next), { r: 0, c: 0 });
  assert.deepEqual(M.stepPin("ArrowLeft", 0, -1, 3, 3, next, next), { r: 0, c: 2 });
  assert.equal(M.stepPin("ArrowUp", 0, 1, 3, 3, next, () => -1), null);
});
