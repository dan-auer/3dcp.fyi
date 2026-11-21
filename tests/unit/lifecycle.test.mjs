// oa-lifecycle.js owns a mounted UI's listeners and timers. destroy() must drop
// every one of them: a survivor fires into torn-down UI.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../../src/javascript/oa-lifecycle.js");
const create = globalThis.OALifecycle.create;
// --- tests
test("listen: one registration per callback, none after destroy", () => {
  const scope = create(), target = new EventTarget();
  let n = 0;
  const hit = () => n++;
  scope.listen(target, "x", hit);
  scope.listen(target, "x", hit);
  target.dispatchEvent(new Event("x"));
  assert.equal(n, 1);
  scope.destroy();
  target.dispatchEvent(new Event("x"));
  scope.listen(target, "x", hit);
  target.dispatchEvent(new Event("x"));
  assert.equal(n, 1);
});

test("listen returns a remover for that listener alone", () => {
  const scope = create(), target = new EventTarget();
  let a = 0, b = 0;
  const offA = scope.listen(target, "x", () => a++);
  scope.listen(target, "x", () => b++);
  offA();
  target.dispatchEvent(new Event("x"));
  assert.deepEqual([a, b], [0, 1]);
});

test("destroy clears pending timeouts", async () => {
  const scope = create();
  let fired = false;
  scope.timeout(() => { fired = true; }, 5);
  scope.destroy();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(fired, false);
});
