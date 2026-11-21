// ESLint for a no-build site: only rules that catch real bugs, nothing about
// style. no-undef matters most - after a refactor it names the helper that
// moved away (search-core.js once called a normPhrase only semantic-search.js
// had, and quoted-phrase search failed in the worker). Project modules talk
// through window.OA*, so the only bare globals are the vendored libraries.
// Run from the root (npm run lint: eslint -c tests/eslint.config.mjs .): the
// paths below are relative to the root, where ESLint runs, not to this file.
import globals from "globals";

const rules = {
  "no-undef": "error",
  "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-dupe-args": "error",
  "no-dupe-else-if": "error",
  "no-unreachable": "error",
  "no-const-assign": "error",
  "no-func-assign": "error",
  "no-self-assign": "error",
  "no-unsafe-finally": "error",
};

export default [
  { ignores: ["src/vendor/**", "data/**", "src/category_data.js", "src/replacement_data.js", "uploads/**", "node_modules/**", "test-results/**", "playwright-report/**"] },
  {
    files: ["src/javascript/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      // d3, topojson, Slick: src/vendor scripts. module: the UMD export guard.
      globals: { ...globals.browser, d3: "readonly", topojson: "readonly", Slick: "readonly", module: "readonly" },
    },
    rules,
  },
  { files: ["src/javascript/semantic-search.js", "src/javascript/search-core.js", "src/javascript/search-worker.js"], languageOptions: { sourceType: "module" } },
  { files: ["src/javascript/search-worker.js"], languageOptions: { globals: globals.worker } },
  { files: ["sw.js"], languageOptions: { ecmaVersion: 2024, sourceType: "script", globals: { ...globals.worker, ...globals.serviceworker } }, rules },
  // Node scripts; tests also hold browser code (page.evaluate callbacks).
  { files: ["**/*.mjs"], languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node, ...globals.browser } }, rules },
];
