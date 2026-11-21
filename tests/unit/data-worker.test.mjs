// data-worker.js slices the JSON literal out of a `window.X = ...;` data file.
// A header comment naming the global, or a bracket inside a string, must not
// cut it short; a file without the assignment reports instead of hanging.
import test from "node:test";
import assert from "node:assert/strict";

const posted = [];
globalThis.self = { postMessage: (m) => posted.push(m) };
const files = {
  "ok.js": '/* sets window.X from the exporter */\nwindow.X = [1, {"a": "]"}];\n',
  "none.js": "/* nothing here */",
};
globalThis.fetch = async (url) => (files[url] ? { ok: true, text: async () => files[url] } : { ok: false, status: 404 });
await import("../../src/javascript/data-worker.js");

test("parses the literal, reports a missing assignment and a failed fetch", async () => {
  for (const [reqId, url] of [[1, "ok.js"], [2, "none.js"], [3, "gone.js"]]) await self.onmessage({ data: { reqId, url, global: "X" } });
  assert.deepEqual(posted[0], { reqId: 1, value: [1, { a: "]" }] });
  assert.match(posted[1].error, /no window\.X assignment/);
  assert.match(posted[2].error, /HTTP 404/);
});
