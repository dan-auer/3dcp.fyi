// qr-code.js draws the kiosk's QR code itself, so its structure is checked
// here: the smallest version that fits, finders, timing, the dark module, and
// two matching, valid format copies at level M. (Readability was checked once
// against an independent decoder; this guards the layout against regressions.)
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../../src/javascript/qr-code.js");
const qr = window.OAQRCode;

const formatOf = (m) => {
  const n = m.length, at = (x, y) => (m[y][x] ? 1 : 0);
  const one = [...[0, 1, 2, 3, 4, 5].map((j) => at(8, j)), at(8, 7), at(8, 8), at(7, 8), ...[9, 10, 11, 12, 13, 14].map((j) => at(14 - j, 8))];
  const two = [...[0, 1, 2, 3, 4, 5, 6, 7].map((j) => at(n - 1 - j, 8)), ...[8, 9, 10, 11, 12, 13, 14].map((j) => at(8, n - 15 + j))];
  const word = (bits) => bits.reduce((v, b, i) => v | (b << i), 0) ^ 0x5412;
  return [word(one), word(two)];
};
const bch = (data) => {
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (data << 10) | rem;
};

test("the smallest version that fits, up to version 6 (106 bytes)", () => {
  assert.equal(qr("https://3dcp.fyi/rich.2017.3PBC").length, 29);     // 31 bytes: version 3
  assert.equal(qr("https://3dcp.fyi/" + "k".repeat(53)).length, 37);  // 70 bytes: version 5
  assert.equal(qr("x".repeat(106)).length, 41);                       // version 6, full
  assert.equal(qr("x".repeat(107)), null);
});

test("a minimum version draws every link that fits it at one size", () => {
  assert.equal(qr("https://3dcp.fyi/rich.2017.3PBC", 5).length, 37);     // version 3 on its own
  assert.equal(qr("https://3dcp.fyi/" + "k".repeat(53), 5).length, 37);  // version 5 anyway
  assert.equal(qr("x".repeat(90), 5).length, 41);                        // too long for 5: 6
  assert.equal(qr("x".repeat(107), 5), null);
});

test("finders, timing, dark module and format information are in place", () => {
  for (const [text, version] of [["https://3dcp.fyi/a.2020.B"], ["https://3dcp.fyi/si_khan_mcna.2025.ACRoRDaPPi3CP"], ["https://3dcp.fyi/a.2020.B", 5]]) {
    const m = qr(text, version), n = m.length;
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          assert.equal(m[cy + dy][cx + dx], d !== 2, `finder at ${cx},${cy}`);
        }
      }
    }
    for (let i = 8; i < n - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0, "horizontal timing");
      assert.equal(m[i][6], i % 2 === 0, "vertical timing");
    }
    assert.equal(m[n - 8][8], true, "dark module");
    const [one, two] = formatOf(m);
    assert.equal(one, two, "both format copies agree");
    assert.equal(one >>> 13, 0, "level M");
    assert.equal(bch(one >>> 10), one, "a valid BCH code word");
  }
});
