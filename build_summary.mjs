// build_summary.mjs - writes data/summary.json: the entry screen's numbers and
// its two cumulative charts (~5 KB), so a first visit does not download and
// parse the 3 MB dataset just to fill one sentence and two plots. Also the size
// of the two files the table waits for ("bytes"): GitHub Pages sends them
// compressed, which hides it, and the table's loading bar needs it for its
// percent (data-load.js OADataProgress).
//
// The figures come from the site's own article-store.js run over the same data
// files (in a vm context, as the unit tests run it), so they cannot drift from
// what the table shows. Run by the deploy job in .github/workflows/docs.yml;
// locally: node build_summary.mjs. Not committed (.gitignore): without the
// file the entry screen falls back to the dataset, as before.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const context = { performance: { now: () => 0 }, setTimeout, console };
context.window = context;
vm.createContext(context);
for (const file of ["src/category_data.js", "data/tabular_data.js", "data/author_data.js",
  "src/javascript/bibliography.js", "src/javascript/article-store.js"]) {
  vm.runInContext(read(file), context, { filename: file });
}
const store = context.OAArticleStore.get();
const summary = store.summary();
if (!summary) throw new Error("the dataset is empty - no summary written");
const bytes = Object.fromEntries(["data/tabular_data.js", "data/author_data.js"]
  .map((file) => [file, statSync(new URL(file, import.meta.url)).size]));
const out = JSON.stringify({ summary, cumulative: store.cumulativeSeries(), bytes });
writeFileSync(new URL("data/summary.json", import.meta.url), out + "\n");
console.log("wrote data/summary.json (" + out.length + " bytes, " + summary.articles + " articles)");
