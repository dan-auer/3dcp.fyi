// search-core.js's lexical index, run for real on the vendored Orama: a name
// typed in the search box finds that person's works, but only as written (or
// the start of a name) - the typo tolerance stays with the text, so a topic
// word one letter off a name ("king": Kong) does not pull that person in.
import test from "node:test";
import assert from "node:assert/strict";
import * as orama from "../../src/vendor/orama-3.1.18.mjs";
import { createLexicalIndex } from "../../src/javascript/search-core.js";

// Docs as semantic-search.js builds them: authors "Family, Given", NUL between two.
const DOCS = [
  { id: "cc", title: "Contour crafting", abstract: "A concrete wall printed by extrusion.", toc: "", authors: "Khoshnevis, Behrokh\u0000Zhu, Binrong" },
  { id: "kp", title: "Timber roofs", abstract: "Trusses and rafters.", toc: "", authors: "Kong, Ing" },
  { id: "pm", title: "Pumping", abstract: "Mortar pumped through a hose and a nozzle.", toc: "", authors: "Bos, Freek" },
];

async function index() {
  const lexical = createLexicalIndex(orama);
  await lexical.build(DOCS);
  return lexical;
}
// The ids each term's pass finds, in term order.
async function found(lexical, terms) {
  const res = await lexical.query(terms, [], 1, 100);
  return res.passes.map((pass) => pass.map(([id]) => id).sort());
}

test("a typed name finds the works of that author, in either order", async () => {
  const lexical = await index();
  assert.deepEqual(await found(lexical, ["khoshnevis"]), [["cc"]]);
  assert.deepEqual(await found(lexical, ["binrong", "zhu"]), [["cc"], ["cc"]]);
  assert.deepEqual(await found(lexical, ["khosh"]), [["cc"]]);   // the start of a name
});

test("names take no typo; the text still does", async () => {
  const lexical = await index();
  assert.deepEqual(await found(lexical, ["khosnevis"]), [[]]);   // one letter off a name
  assert.deepEqual(await found(lexical, ["king"]), [[]]);        // not Kong
  assert.deepEqual(await found(lexical, ["concrte"]), [["cc"]]); // one letter off a word
});

test("a word of four letters or fewer takes no typo, only its own start", async () => {
  const lexical = await index();
  assert.deepEqual(await found(lexical, ["sand"]), [[]]);        // not "and" (pm)
  assert.deepEqual(await found(lexical, ["hos"]), [["pm"]]);     // the start of "hose"
  assert.deepEqual(await found(lexical, ["nozle"]), [["pm"]]);   // five letters: one typo
});

test("a quoted name matches as the table writes it, and never across two authors", async () => {
  const lexical = await index();
  const required = async (phrase) => (await lexical.query([], [phrase], 1, 100)).required;
  assert.deepEqual(await required("bos freek"), ["pm"]);
  assert.deepEqual(await required("khoshnevis"), ["cc"]);
  assert.deepEqual(await required("behrokh zhu"), []);   // the end of one name, the start of the next
});
