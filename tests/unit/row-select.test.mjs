// oa-row-select.js: drag and Shift ranges run over DISPLAYED rows, so a paper
// shown twice (category grouping) stays marked while any of its rows is in range.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.getSelection = () => null;
const docL = {};
globalThis.document = { addEventListener: (t, f) => { docL[t] = f; }, removeEventListener: (t) => { delete docL[t]; } };
await import("../../src/javascript/oa-row-select.js");

test("drag keeps a duplicated paper while one of its rows is in range; shift extends from the anchor", async () => {
  const items = { a1: { id: "a", _rowKey: "a1" }, b: { id: "b" }, a2: { id: "a", _rowKey: "a2" }, c: { id: "c" } };
  const rows = Object.keys(items).map((key) => ({ key, id: items[key].id }));
  const hostL = {}, counts = [];
  const sel = window.OARowSelect.attach({
    host: { addEventListener: (t, f) => { hostL[t] = f; }, removeEventListener() {}, classList: { add() {}, remove() {} } },
    absRows: { itemFromEvent: (e) => e.item },
    orderedRows: () => rows,
    repaint() {}, repaintIds() {}, onChange: (n) => counts.push(n)
  });
  const ev = (key, extra) => ({ item: items[key], target: { closest: () => null }, button: 0, shiftKey: false, preventDefault() {}, ...extra });
  const ids = () => sel.ids().sort().join("");

  hostL.mousedown(ev("a1"));
  docL.mousemove(ev("b")); assert.equal(ids(), "ab");
  docL.mousemove(ev("c")); assert.equal(ids(), "abc");
  docL.mousemove(ev("b")); assert.equal(ids(), "ab", "a1 still in range keeps a");
  docL.mousemove(ev("a1")); assert.equal(ids(), "a");
  docL.mouseup();
  assert.equal(sel.handleClick(ev("a1")), true, "the drag's own click is swallowed");
  assert.equal(sel.handleClick(ev("c", { shiftKey: true })), true);
  assert.equal(ids(), "abc");
  sel.retain((id) => id !== "b"); assert.equal(ids(), "ac");
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(counts, [2], "updates coalesce into one onChange");
  sel.clear(); assert.equal(sel.count(), 0);
  sel.destroy(); assert.equal(sel.handleClick(ev("b", { shiftKey: true })), false);
});
