// cite-format.js turns a record into the copied reference, plain and HTML.
// Run for real in a vm (with bibliography.js): a star in a venue is the
// venue's own character, not the end of its italics.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (f) => readFileSync(new URL("../../src/javascript/" + f, import.meta.url), "utf8");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ctx = { OATheme: { escapeHtml } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read("bibliography.js"), ctx);
vm.runInContext(read("cite-format.js"), ctx);

// The one record with a star in its venue (a German gender star).
const record = {
  id: "plac_thor_altm_gerk.2025.PFoMAiAMP", type: "Contribution", date: "2025-07-22", pages: "238–253",
  title: "Preliminary Findings on Motion Analysis in Additive Manufacturing Processes",
  venue: "Tagungsband zum 34. BBB Assistent*innen-Tagung",
  authors: [{ firstName: "Gerrit", lastName: "Placzek" }, { firstName: "Jan", lastName: "Thormählen" }],
};

test("a star in the venue stays in the copied reference, the whole venue in italics", () => {
  for (const style of ctx.CITE_STYLES) {
    const r = ctx.formatCitationRich(record, style);
    assert.match(r.plain, /Assistent\*innen-Tagung/, style);
    assert.doesNotMatch(r.plain, /\u0001/, style);
    assert.match(r.html, /<i>Tagungsband zum 34\. BBB Assistent\*innen-Tagung<\/i>/, style);
  }
});

test("a DOI still becomes a link", () => {
  const r = ctx.formatCitationRich(Object.assign({}, record, { doi: "10.1000/xyz" }), "Chicago");
  assert.match(r.html, /<a href="https:\/\/doi\.org\/10\.1000\/xyz">https:\/\/doi\.org\/10\.1000\/xyz<\/a>/);
  assert.match(r.plain, /https:\/\/doi\.org\/10\.1000\/xyz/);
});
