// oa-tts.js speaks a reading as several utterances, because Chrome's online
// voices cut a single long one off: each ends at a sentence (a long one at a
// comma or the word limit), together they say the whole text, pause() and
// resume() go on from the word reached, and done() comes once, after the last.
import test from "node:test";
import assert from "node:assert/strict";

const spoken = [];
globalThis.window = globalThis;
window.addEventListener = () => {};
window.OAPrefs = { getJSON: () => ({ highlight: false, rate: 1 }), setJSON() {} };
window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
window.speechSynthesis = { getVoices: () => [], addEventListener() {}, cancel() {}, speak(u) { spoken.push(u); } };
globalThis.document = { documentElement: { lang: "en" }, addEventListener() {}, querySelectorAll: () => [], contains: () => true };
await import("../../src/javascript/oa-tts.js");

// End each utterance in turn, as an engine would; an end starts the next one.
function finish() { for (let i = 0; i < spoken.length; i++) spoken[i].onend(); }
const said = () => spoken.map((u) => u.text).join("").replace(/\s+/g, " ").trim();

test("a reading is spoken sentence by sentence, and done() follows the last", () => {
  spoken.length = 0;
  const text = "Concrete is printed layer by layer. The e.g. clause stays whole. Results (2021) are shown.";
  let ended = null;
  window.OATTS.read({ textContent: text }, (e) => { ended = e; });
  assert.equal(ended, null);
  finish();
  assert.deepEqual(spoken.map((u) => u.text.trim()),
    ["Concrete is printed layer by layer.", "The e.g. clause stays whole.", "Results (2021) are shown."]);
  assert.equal(ended, true);
});

test("a sentence over the limit breaks at its last comma inside it, else at the limit", () => {
  spoken.length = 0;
  const words = Array.from({ length: 40 }, (_, i) => "w" + i);
  words[19] += ",";
  const text = words.join(" ") + ".";
  window.OATTS.read({ textContent: text }, () => {});
  finish();
  assert.deepEqual(spoken.map((u) => u.text.trim().split(" ").length), [20, 20]);
  assert.equal(said(), text);

  spoken.length = 0;
  const plain = Array.from({ length: 60 }, (_, i) => "w" + i).join(" ") + ".";
  window.OATTS.read({ textContent: plain }, () => {});
  finish();
  assert.ok(spoken.every((u) => u.text.trim().split(" ").length <= 26), "no utterance over the limit");
  assert.equal(said(), plain);
});

test("pause() holds the reading, resume() goes on from the word it had reached", () => {
  spoken.length = 0;
  const text = "One two three four. Five six.";
  let ended = null;
  window.OATTS.read({ textContent: text }, (e) => { ended = e; });
  spoken[0].onboundary({ name: "word", charIndex: 8 });   // "three"
  assert.equal(window.OATTS.progress(), 8 / text.length);
  window.OATTS.pause();
  spoken[0].onend();   // the cancel's own event: not the reading's
  assert.equal(spoken.length, 1);
  assert.equal(ended, null);
  window.OATTS.resume();
  assert.equal(spoken[1].text, "three four. ");
  finish();
  assert.equal(spoken[2].text, "Five six.");
  assert.equal(ended, true);
  assert.equal(window.OATTS.progress(), null);
});

test("an engine error ends the reading with its code", () => {
  spoken.length = 0;
  let args = null;
  window.OATTS.read({ textContent: "Hello there." }, (...a) => { args = a; });
  spoken[0].onerror({ error: "not-allowed" });
  assert.deepEqual(args, [false, "not-allowed"]);
});

test("a dropped abbreviation keeps its stop, so the sentence still ends there", () => {
  spoken.length = 0;
  window.OATTS.read({ textContent: "Printed by fused deposition modelling (FDM). The results show a gain." }, () => {});
  finish();
  assert.deepEqual(spoken.map((u) => u.text.trim()), ["Printed by fused deposition modelling.", "The results show a gain."]);
});

test("Roman numerals and slashed grades in brackets are read; et al., Fig. and initials end no sentence", () => {
  spoken.length = 0;
  window.OATTS.read({ textContent: "Phases (I) and (II) used class (C30/37). As J. Smith et al. (2019) showed in Fig. 3, it holds." }, () => {});
  finish();
  assert.deepEqual(spoken.map((u) => u.text.trim()),
    ["Phases (I) and (II) used class (C30/37).", "As J. Smith et al. (2019) showed in Fig. 3, it holds."]);
});

test("a reading can have a speed of its own: its utterances and its chunk limit (~10 s) follow it", () => {
  spoken.length = 0;
  const text = Array.from({ length: 60 }, (_, i) => "w" + i).join(" ") + ".";
  window.OATTS.read({ textContent: text }, () => {}, 1.125);
  finish();
  assert.ok(spoken.every((u) => u.rate === 1.125));
  assert.deepEqual(spoken.map((u) => u.text.trim().split(" ").length), [30, 30]);   // 180 words a minute
});

test("done() comes once, also where cancel() fires the cancelled utterance's events at once", () => {
  spoken.length = 0;
  let calls = 0;
  window.OATTS.read({ textContent: "One two three. Four five six." }, () => { calls++; });
  const cancel = window.speechSynthesis.cancel;
  window.speechSynthesis.cancel = () => { const u = spoken[spoken.length - 1]; if (u.onerror) u.onerror({ error: "canceled" }); };
  window.OATTS.stop();
  window.speechSynthesis.cancel = cancel;
  assert.equal(calls, 1);
});

test("an utterance that never ends counts as spoken after twice its time and 3 s, and the reading goes on", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  spoken.length = 0;
  let ended = null;
  window.OATTS.read({ textContent: "One two three. Four five six." }, (e) => { ended = e; });
  assert.equal(spoken.length, 1);
  t.mock.timers.tick(3 / 160 * 120000 + 2999);
  assert.equal(spoken.length, 1);
  t.mock.timers.tick(1);
  assert.equal(spoken.length, 2);
  spoken[1].onend();
  assert.equal(ended, true);
});

test("a speed change while paused does not read the work over from the top", () => {
  spoken.length = 0;
  window.OATTS.read({ textContent: "One two three. Four five six." }, () => {});
  window.OATTS.pause();
  window.OATTS.setRate(1.5);
  assert.equal(spoken.length, 1);
  window.OATTS.resume();
  assert.equal(spoken[1].text.trim(), "One two three.");
  window.OATTS.stop();
  window.OATTS.setRate(1);
});
