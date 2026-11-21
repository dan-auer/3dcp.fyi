// grid-renderers.js builds the table's cell markup. Run for real in a vm: a
// category colour that is no plain hex (OATheme.catColor passes those through)
// stays inside the chip's style attribute.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../src/javascript/grid-renderers.js", import.meta.url), "utf8");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ctx = { OATypeset: { text: (s) => s } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);

test("a category colour cannot leave the chip's style attribute", () => {
  const renderers = ctx.OAGridRenderers.create({
    theme: { escapeHtml, catVars: (color) => "--cat-c:" + color, oaIconPaths: () => "" },
    bibliography: {}, rel: "", countFormat: String, state: {},
    articleStore: { records: [], definitions: { X: { color: 'red" onmouseover="alert(1)', title: "T" } } },
  });
  const html = renderers.categoryChipHtml("X", false);
  assert.match(html, /style="--cat-c:red&quot; onmouseover=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /onmouseover="/);   // no attribute of its own
});
