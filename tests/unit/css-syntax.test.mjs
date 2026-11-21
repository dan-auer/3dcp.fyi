// The stylesheets are hand-edited and nothing builds them. A stray "}" or a
// declaration left behind without its selector makes the browser drop the next
// rule without a word - that is how the settings button once lost its size.
// Fail on either here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../src/style/", import.meta.url);
// --- tests
// [line, message] for each problem. Comments and strings are skipped. A block
// holds rules (top level, @media, @supports, ...) or declarations (a style
// rule, @font-face, ...); a ";" may only end a declaration or an at-statement.
function problems(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const RULE_LISTS = /^@(media|supports|layer|container|document|scope|starting-style|keyframes)\b/i;
  const out = [], stack = [];   // per open block: true when it holds rules
  let line = 1, prelude = "", quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") line++;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; prelude += c; continue; }
    if (c === "{") { stack.push(RULE_LISTS.test(prelude.trim())); prelude = ""; continue; }
    if (c === "}") { if (stack.length) stack.pop(); else out.push([line, "unmatched }"]); prelude = ""; continue; }
    if (c === ";") {
      const inRules = !stack.length || stack[stack.length - 1];
      if (inRules && !prelude.trim().startsWith("@")) out.push([line, "declaration outside a rule: " + prelude.trim().slice(0, 40)]);
      prelude = "";
      continue;
    }
    prelude += c;
  }
  if (stack.length) out.push([line, stack.length + " unclosed {"]);
  return out;
}

for (const name of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
  test(name + ": braces match and every declaration sits in a rule", () => {
    assert.deepEqual(problems(readFileSync(new URL(name, dir), "utf8")), []);
  });
}

test("the check catches a declaration left without its selector", () => {
  assert.deepEqual(problems("a{ color: red; }\n  width: 18px;\n}\n@media (x){ b{ color: blue; } }"),
    [[2, "declaration outside a rule: width: 18px"], [3, "unmatched }"]]);
});
