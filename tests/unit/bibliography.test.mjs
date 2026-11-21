// bibliography.js writes every BibTeX the site exports. Run for real in a vm:
// letters, dashes, quotes and symbols come out as LaTeX (classic BibTeX sorts
// and abbreviates byte by byte), the TeX specials stay escaped, and what has
// no portable spelling stays UTF-8.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { AUTHORS_DATA: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../../src/javascript/bibliography.js", import.meta.url), "utf8"), ctx);
const B = ctx.OABibliography;
const bib = (fields) => B.formatBibtex(Object.assign({ id: "x.2024.T", type: "JournalArticle", date: "2024-03", title: "T", venue: "V", authors: [] }, fields));

test("accented and special letters in names become LaTeX commands", () => {
  const out = bib({ authors: [{ firstName: "İlker", lastName: "Çağlar" }, { firstName: "José", lastName: "García" },
    { firstName: "Jörg", lastName: "Šimůnek" }, { firstName: "Łukasz", lastName: "Weiß" }] });
  for (const s of ["{\\c{C}}a{\\u{g}}lar, {\\.I}lker", "Garc{\\'{\\i}}a, Jos{\\'e}", "{\\v{S}}im{\\r{u}}nek, J{\\\"o}rg", "Wei{\\ss}, {\\L}ukasz"]) {
    assert.ok(out.includes(s), s);
  }
  assert.doesNotMatch(out, /[^\x00-\x7f]/);
});

test("dashes, quotes, symbols, Greek letters and scripts become text commands or inline math", () => {
  const title = bib({ title: "Rob’s “test” – a 3D‐printed α-phase at 25 °C: 10⁻⁶ m³, CO₂ ± 5 μm, μ², x ≥ −5 · y" }).split("\n").find((l) => l.includes("title"));
  for (const s of ["Rob's ``test'' -- a 3D-printed $\\alpha$-phase at 25 $^{\\circ}$C", "10$^{-6}$ m$^{3}$", "CO$_{2}$ $\\pm$ 5 $\\mu$m", "$\\mu^{2}$", "x $\\geq$ $-$5 $\\cdot$ y"]) {
    assert.ok(title.includes(s), s + " in " + title);
  }
});

test("the TeX specials stay escaped, plain ASCII stays as it is, and what LaTeX cannot spell stays UTF-8", () => {
  const title = bib({ title: "50% & $_{}~^\\ of a Тест in Timișoara" }).split("\n").find((l) => l.includes("title"));
  assert.ok(title.includes("50\\% \\& \\$\\_\\{\\}\\textasciitilde{}\\textasciicircum{}\\textbackslash{} of a Тест in Timișoara"), title);
  assert.match(bib({ title: "Plain (ASCII) title, v2" }), /title\s+= \{\{Plain \(ASCII\) title, v2\}\}/);
});
