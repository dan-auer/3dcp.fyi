/* semantic-search.js - hybrid (semantic + lexical) search for the article table.
 *
 * ES module. Owns everything search-related and exposes a small API on
 * window.OASemanticSearch that the classic articles-grid.js drives:
 *
 *   window.OASemanticSearch = {
 *     MIN_QUERY_LENGTH,                 // 3
 *     ready,                            // Promise, resolves when assets loaded
 *     search(query, onPartial) -> Promise<result|null>
 *   }
 *
 * result = { query, order:[id...], rankById:Map(id->rank),
 *            semantic:bool, count, total }
 *
 * Pipeline (mirrors the reference web/search.js the user built):
 *   - lexical  : Orama full-text over title, abstract and TOC text (typo-
 *                tolerant from 5 letters) and the author names (as written),
 *                built and queried in a module Worker (search-worker.js /
 *                search-core.js) so the index build never blocks the page;
 *                falls back to in-thread batches where workers are unavailable
 *   - semantic : query embedded in-browser with the manifest's browser_model
 *                (transformers.js), cosine vs the precomputed float16 abstract
 *                vectors (dot product, both L2-normalized)
 *   - hybrid   : score = w*cosine + (1-w)*lexical; the weight w, the min
 *                cosine cutoff, the max shown results and the typo tolerance
 *                are user settings (see DEFAULT_SETTINGS / the settings panel)
 * It is progressive: lexical matches render immediately (onPartial); the
 * semantic re-rank lands once the model is warm. If the model/CDN is
 * unavailable, it degrades to keyword-only rather than failing.
 *
 * RECORD <-> ROW JOIN: each manifest record is matched to its table row by
 * `id` (see remapToTableRows). Only the abstract text comes from the manifest;
 * the row keeps its own metadata. Records with no matching row are still
 * indexed for search but have no row to display their abstract on.
 */

import { createLexicalIndex, loadFloat16Matrix, createSerial, normPhrase as normFolded, SHORT_WORD_MAX } from "./search-core.js";

// Search compares folded text (CO₂ -> CO2, m³ -> m3) on both sides; readers see
// it typeset (oa-typeset.js). Both keep the length, so offsets carry over.
const { fold, text: typeset } = window.OATypeset;
const escapeHtml = window.OATheme.escapeHtml;
const DATA = window.OAAssets.url("data/");
// The abstracts ship as a sibling data script (window.ABSTRACT_DATA = {...}),
// like toc_data.js - but 9 MB of text has no business blocking the parser, so
// it is requested on the first idle beat and parsed off the main thread
// (data-load.js, OAData.load).
const MANIFEST_URL = DATA + "abstract_data.js";
const ABSTRACT_VECTORS_URL = DATA + "abstract_vectors.f16.b64.txt";
// Not in the repository: the last export was cut short (2,083 of 48,467
// sentence vectors), so the file was removed and the best-sentence highlight
// stays off (ensureSentenceMatrix fails once, quietly) until the export
// pipeline ships a complete one.
const SENTENCE_VECTORS_URL = DATA + "sentence_vectors.f16.b64.txt";

const MIN_QUERY_LENGTH = 3;
const LEXICAL_LIMIT = 1000;           // Orama internal fetch cap (not the display cap)

// User-tunable scoring settings (persisted to localStorage; edited from the
// grid's search-settings panel). semanticWeight blends semantic vs lexical;
// minSemantic drops abstracts below that cosine (the RESULT SET itself is never
// capped - every matching abstract stays in the table, in rank order; the grid
// opens the abstracts of the hits as they scroll into view); tolerance is the
// typo tolerance for both lexical search and highlight.
const SETTINGS_KEY = "oa-search-settings";
const SETTINGS_VERSION = 6;           // bump to invalidate persisted settings after a default/schema change
const DEFAULT_SETTINGS = { semanticWeight: 0.85, minSemantic: 0.25, tolerance: 1 };
// All-words rule: a result must hold every content word of the query, unless
// its abstract is at least this close semantically (or minSemantic + 0.15 when
// the reader raised the cutoff) - a paper that says the same thing in other
// words still belongs. "Match any word" (opts.anyWord) lifts the rule.
const STRONG_SEMANTIC = 0.4;
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";
// Local-first transformers.js is supported but NOT shipped: src/vendor/transformers/
// is not in the repository. A copy of the pinned build there (transformers.min.js,
// with the ONNX runtime files it loads, ort-wasm-simd-threaded*.{mjs,wasm}, beside
// it) would load from the site's own origin; the 110 MB model stays on Hugging
// Face, behind the consent dialog. Without it the local import 404s in a few ms
// and the jsDelivr copy below is what actually loads.
const TRANSFORMERS_LOCAL_DIR = new URL("../vendor/transformers/", import.meta.url).href;
const TRANSFORMERS_LOCAL_URL = TRANSFORMERS_LOCAL_DIR + "transformers.min.js";
const TRANSFORMERS_URLS = [TRANSFORMERS_LOCAL_URL, TRANSFORMERS_URL];
// Local-first Orama: the vendored ESM copy (src/vendor/orama-3.1.18.mjs) keeps
// KEYWORD search working offline, on locked-down networks and during CDN
// outages; the pinned CDN build below is only the fallback. The transformers.js model
// is legitimately CDN + Hugging Face territory - no local copy of that.
const ORAMA_LOCAL_URL = new URL("../vendor/orama-3.1.18.mjs", import.meta.url).href;
const ORAMA_URL = "https://cdn.jsdelivr.net/npm/@orama/orama@3.1.18/+esm";

const state = {
  status: "loading",                  // "loading" | "ok" | "error"
  records: [],
  dim: 0,
  modelId: "Snowflake/snowflake-arctic-embed-m-v1.5",   // replaced by the manifest's browser_model
  abstractMeta: null,                 // lazy abstract-vector request metadata
  matrix: null,                       // Float32Array, abstractCount * dim
  idByIndex: [],                      // record index -> table row id (remap)
  queryToken: 0,
  lastStatus: "",
  modelState: "absent",               // "absent" | "downloading" | "ready" | "error"
  modelProgress: 0,                   // 0..100 overall model-download progress
  sentenceMatrix: null,               // Float32Array, sentenceCount * dim (or null)
  vectorsSettled: false,              // abstract-vector load has finished (matrix or null)
  sentenceMatrixPromise: null,        // in-flight/settled lazy load of the above
  sentenceMeta: null,                 // {count, cacheKey} for the lazy sentence load
  sentenceStart: [],                  // record index -> first global sentence row
  sentenceCount: 0,
  rowIdSet: new Set(),                // table row ids (records without a row can't display)
  recordIndexByRowId: new Map(),      // table row id -> manifest record index
  currentQuery: "",                   // active query for highlight (or "")
  currentEmbedding: null,             // active query embedding (or null)
  filterIds: null,                    // Set<rowId> to restrict ranking to, or null for corpus-wide
  scoreDetailById: new Map(),         // row id -> {cosine, lexical, score} for shown rows
  settings: null,                     // set just below from loadSettings()
  cache: { query: "", tolerance: null, lexical: null, embedding: null },
  anyWord: false,                     // "Match any word" for the current query
};

/* ------------------------------ settings ------------------------------ */

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(value, lo, hi) { return Math.min(Math.max(value, lo), hi); }

function sanitizeSettings(s) {
  s = s || {};
  return {
    semanticWeight: clamp(num(s.semanticWeight, DEFAULT_SETTINGS.semanticWeight), 0, 1),
    minSemantic: clamp(num(s.minSemantic, DEFAULT_SETTINGS.minSemantic), 0, 0.9),
    tolerance: Math.round(clamp(num(s.tolerance, DEFAULT_SETTINGS.tolerance), 0, 2)),
  };
}

function loadSettings() {
  let saved = window.OAPrefs.getJSON(SETTINGS_KEY, {}) || {};
  if (saved.__v !== SETTINGS_VERSION) saved = {};   // drop pre-bump settings so new defaults win
  const s = sanitizeSettings(Object.assign({}, DEFAULT_SETTINGS, saved));
  s.__v = SETTINGS_VERSION;
  return s;
}

function getSettings() { return Object.assign({}, state.settings); }

function setSettings(partial) {
  state.settings = sanitizeSettings(Object.assign({}, state.settings, partial || {}));
  state.settings.__v = SETTINGS_VERSION;
  window.OAPrefs.setJSON(SETTINGS_KEY, state.settings);
  return getSettings();
}

state.settings = loadSettings();

/* ------------------------------- status ------------------------------- */

function setStatus(message) {
  state.lastStatus = message || "";
  try {
    window.dispatchEvent(new CustomEvent("oa-search-status", { detail: state.lastStatus }));
  } catch (e) { /* ignore */ }
}

/* --------------------------- model lifecycle -------------------------- */
// The in-browser embedding model is a large, one-time download from the Hugging
// Face CDN (huggingface.co), cached by transformers.js in the browser's Cache
// Storage. We surface an explicit lifecycle - absent -> downloading -> ready -
// so the toolbar can gate the download behind a consent dialog, show a progress
// bar, and colour its icon (red = absent, green = ready). Searching NEVER starts
// a download; it uses the model only once it is resident.

const MODEL_READY_KEY = "oa-model-ready";

function setModelState(next, progress, message) {
  if (next != null) state.modelState = next;
  if (progress != null) state.modelProgress = progress;
  const detail = { state: state.modelState, progress: state.modelProgress, message: message || "", modelId: state.modelId };
  try { window.dispatchEvent(new CustomEvent("oa-model-status", { detail: detail })); } catch (e) { /* ignore */ }
}

function persistModelReady() { window.OAPrefs.set(MODEL_READY_KEY, state.modelId); }
function forgetModelReady() { window.OAPrefs.remove(MODEL_READY_KEY); }

// Best-effort probe of the transformers.js cache: is THIS model already stored
// in the browser? Lets a returning visitor resume "ready" without a re-download
// or a second consent, and stops a stale ready-flag from claiming a model the
// user has since cleared.
async function isModelCached() {
  try {
    if (!("caches" in window)) return false;
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    const id = String(state.modelId || "").toLowerCase();
    return keys.some((req) => req.url.toLowerCase().indexOf(id) !== -1);
  } catch (e) { return false; }
}

// Exactly one load owns a generation. Cache warming never enables downloads.
// Removing the model invalidates callbacks immediately, then waits for existing
// inference/load work before releasing its session and removing cached files.
let modelGeneration = 0;
let modelLoad = null;
let residentExtractor = null;
let modelCleanupP = Promise.resolve(true);
const disposedExtractors = new WeakSet();

function obsoleteModelError() {
  const error = new Error("Model operation superseded");
  error.code = "OA_MODEL_SUPERSEDED";
  return error;
}

async function disposeExtractor(extractor) {
  if (!extractor || disposedExtractors.has(extractor)) return;
  disposedExtractors.add(extractor);
  try { if (typeof extractor.dispose === "function") await extractor.dispose(); }
  catch (error) { console.warn("[semantic-search] model disposal failed:", error); }
}

async function removeCachedModel(modelId) {
  if (!("caches" in window)) return true;
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    // Include path boundaries so similarly named repositories are untouched.
    const id = "/" + String(modelId).toLowerCase() + "/";
    const entries = keys.filter((req) => new URL(req.url).pathname.toLowerCase().includes(id));
    const removed = await Promise.all(entries.map((req) => cache.delete(req)));
    return removed.every(Boolean);
  } catch (error) {
    console.warn("[semantic-search] model cache removal failed:", error);
    return false;
  }
}

async function cachedExtractor(transformers, options, generation) {
  // v4.0.1 pipeline() performs registry discovery without forwarding the
  // local-only option. Direct components avoid those probes and their memoized
  // missing-tokenizer results, which would otherwise affect a later download.
  const tokenizer = await transformers.AutoTokenizer.from_pretrained(state.modelId, options);
  if (generation !== modelGeneration) throw obsoleteModelError();
  const model = await transformers.AutoModel.from_pretrained(state.modelId, options);
  try {
    return new transformers.FeatureExtractionPipeline({ task: "feature-extraction", model, tokenizer });
  } catch (error) {
    await model.dispose();
    throw error;
  }
}

function loadModel(allowDownload, generation = modelGeneration) {
  if (generation !== modelGeneration) return Promise.reject(obsoleteModelError());
  if (residentExtractor) return Promise.resolve(residentExtractor);
  if (modelLoad) {
    modelLoad.allowDownload = modelLoad.allowDownload || allowDownload;
    return modelLoad.promise;
  }
  const owner = { generation, allowDownload, promise: null };
  modelLoad = owner;
  owner.promise = (async () => {
    await modelCleanupP;
    if (generation !== modelGeneration) throw obsoleteModelError();
    setModelState("downloading", 0, allowDownload ? "Downloading model\u2026" : "Preparing saved model\u2026");
    const transformers = await loadTransformers();
    if (generation !== modelGeneration) throw obsoleteModelError();
    const cachedOnly = !owner.allowDownload;
    const env = transformers.env;
    const previousLocal = env.allowLocalModels;
    const previousRemote = env.allowRemoteModels;
    // The exact v4.0.1 hub rejects local_files_only with allowLocalModels=false.
    // The sole load owner can scope these flags safely, including cache warm
    // failure, consented fallback, and generation invalidation during loading.
    env.allowLocalModels = cachedOnly;
    env.allowRemoteModels = !cachedOnly;
    const options = {
      dtype: "q8",
      local_files_only: cachedOnly,
      progress_callback: makeProgressAggregator(generation),
    };
    let extractor;
    try {
      try {
        extractor = cachedOnly
          ? await cachedExtractor(transformers, options, generation)
          : await transformers.pipeline("feature-extraction", state.modelId, options);
      } catch (error) {
        // A click during cache-only warming may authorize one download fallback.
        // It never starts a second pipeline in parallel with the warm operation.
        if (!cachedOnly || !owner.allowDownload || generation !== modelGeneration) throw error;
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        extractor = await transformers.pipeline("feature-extraction", state.modelId, {
          ...options, local_files_only: false,
        });
      }
    } finally {
      env.allowLocalModels = previousLocal;
      env.allowRemoteModels = previousRemote;
    }
    if (generation !== modelGeneration) {
      await disposeExtractor(extractor);
      throw obsoleteModelError();
    }
    residentExtractor = extractor;
    setModelState("ready", 100, "Model ready.");
    persistModelReady();
    // Semantic RANKING needs the abstract vectors: start them as soon as a model
    // is resident (explicit download and cached-model warming both land here).
    // The far larger sentence matrix only serves the per-sentence highlight and
    // stays deferred until the drop renderer first needs it.
    ensureAbstractMatrix();
    return extractor;
  })().catch((error) => {
    if (generation === modelGeneration) {
      forgetModelReady();
      setModelState(owner.allowDownload ? "error" : "absent", 0,
        owner.allowDownload ? "Model could not be prepared. Try again." : "");
    }
    throw error;
  }).finally(() => { if (modelLoad === owner) modelLoad = null; });
  return owner.promise;
}

// Only this user-facing entry point authorizes fetching missing model files.
async function downloadModel() {
  const generation = modelGeneration;
  try {
    await api.ready;
    await loadModel(true, generation);
    return generation === modelGeneration && !!residentExtractor;
  } catch (error) {
    if (generation === modelGeneration) console.warn("[semantic-search] model unavailable:", error);
    return false;
  }
}

async function warmModel(generation = modelGeneration) {
  try {
    const flag = window.OAPrefs.get(MODEL_READY_KEY);
    if (generation !== modelGeneration || flag !== state.modelId) return false;
    if (!(await isModelCached()) || generation !== modelGeneration) return false;
    await loadModel(false, generation);
    return generation === modelGeneration;
  } catch (error) { return false; }
}

function deleteModel() {
  modelGeneration += 1;
  state.queryToken += 1;
  releaseMatrices();
  deactivate();
  cancelQueuedInference();
  state.cache.embedding = null;
  const pendingLoad = modelLoad && modelLoad.promise;
  const extractor = residentExtractor;
  const modelId = state.modelId;
  const previousCleanup = modelCleanupP;
  const pendingInference = inferenceDrainP;
  modelLoad = null;
  residentExtractor = null;
  forgetModelReady();
  setModelState("absent", 0, "");
  modelCleanupP = (async () => {
    await previousCleanup;
    // The library does not expose cancellation for pipeline construction.
    // Waiting prevents late cache writes from resurrecting removed files.
    if (pendingLoad) await pendingLoad.catch(() => {});
    if (pendingInference) await pendingInference;
    await disposeExtractor(extractor);
    return removeCachedModel(modelId);
  })();
  return modelCleanupP;
}

/* --------------------------- lexical backend -------------------------- */
// The Orama index build (~1-2 s for 5.5k abstracts) and every query pass run
// in a module Worker (search-worker.js), so neither blocks scrolling or typing;
// the worker also decodes the float16 vectors on an IndexedDB miss. Where
// module workers are unavailable (or the worker fails to start) the same code
// (search-core.js) runs in-thread, yielding to the browser between insertion
// batches so the build is a series of bounded tasks rather than one long one.
const WORKER_URL = new URL("search-worker.js", import.meta.url).href;
const ORAMA_URLS = [ORAMA_LOCAL_URL, ORAMA_URL];

let transformersPromise = null;
function loadTransformers() {
  if (transformersPromise) return transformersPromise;
  transformersPromise = (async () => {
    let lastError;
    for (const url of TRANSFORMERS_URLS) {
      try {
        const t = await withTimeout(import(url), 20000, "Model library import timed out");
        // No pre-cached runtime. With the cache on (the default wherever Cache
        // Storage exists, so on every HTTPS page) the library imports its ONNX
        // runtime from a blob: URL, which the page's Content-Security-Policy
        // (index.html) does not allow: the model failed on 3dcp.fyi alone. Off,
        // the runtime loads from its own URL and the browser's HTTP cache keeps it.
        if (t.env) t.env.useWasmCache = false;
        if (url === TRANSFORMERS_LOCAL_URL) {
          // The vendored build must not reach for the CDN copy of its runtime:
          // point the ONNX wasm loader at the same folder, where
          // ort-wasm-simd-threaded*.{mjs,wasm} sit beside transformers.min.js.
          try { t.env.backends.onnx.wasm.wasmPaths = TRANSFORMERS_LOCAL_DIR; } catch (e) { /* older env shape: keep its default */ }
        }
        return t;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error("Model library unavailable");
  })().catch((error) => { transformersPromise = null; throw error; });
  return transformersPromise;
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

function createWorkerBackend() {
  if (typeof Worker !== "function") return null;
  let worker;
  try { worker = new Worker(WORKER_URL, { type: "module" }); } catch (error) { return null; }
  const pending = new Map();
  let seq = 0;
  let dead = null;
  const backend = {
    kind: "worker",
    retire(error) {
      if (dead) return;
      dead = error || new Error("Search worker retired");
      worker.terminate();
      pending.forEach((request) => {
        clearTimeout(request.timer);
        request.reject(dead);
      });
      pending.clear();
    },
    build: (docs) => call({ type: "build", oramaUrls: ORAMA_URLS, docs }).then(() => docs.length),
    query: (terms, phrases, tolerance, limit) => call({ type: "query", terms, phrases, tolerance, limit }),
    decode: (url, vectorCount, dim) => call({ type: "decode", url, vectorCount, dim }).then((m) => new Float32Array(m.buffer)),
  };
  function failed(error) {
    backend.retire(error);
    retireWorkerBackend(error, backend).catch(() => {});
  }
  worker.addEventListener("message", (event) => {
    const message = event.data || {};
    const request = pending.get(message.reqId);
    if (!request) return;
    pending.delete(message.reqId);
    clearTimeout(request.timer);
    if (message.type === "error") request.reject(new Error(message.message));
    else request.resolve(message);
  });
  worker.addEventListener("error", (event) => failed(new Error(event.message || "Search worker failed")));
  worker.addEventListener("messageerror", () => failed(new Error("Search worker response could not be read")));
  function call(message) {
    if (dead) return Promise.reject(dead);
    const reqId = ++seq;
    return new Promise((resolve, reject) => {
      const timeout = message.type === "query" ? 15000 : 45000;
      const timer = setTimeout(() => failed(new Error("Search worker " + message.type + " timed out")), timeout);
      pending.set(reqId, { resolve, reject, timer });
      try { worker.postMessage({ reqId, ...message }); }
      catch (error) { failed(error); }
    });
  }
  return backend;
}

// Import and initialization failures are retryable. One explicit retry gets a
// fresh module URL, because browsers can retain rejected module fetch promises.
let backendAttempt = 0;
function createInThreadBackend() {
  let indexP = null;
  const attempt = backendAttempt;
  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));
  const serial = createSerial();
  function getIndex() {
    if (!indexP) {
      indexP = (async () => {
        let lastError;
        for (const source of ORAMA_URLS) {
          const url = new URL(source);
          if (attempt) url.searchParams.set("oa_retry", String(attempt));
          try {
            const orama = await withTimeout(import(url.href), 10000, "Search library import timed out");
            return createLexicalIndex(orama);
          } catch (error) { lastError = error; }
        }
        throw lastError || new Error("Search library unavailable");
      })().catch((error) => { indexP = null; throw error; });
    }
    return indexP;
  }
  return {
    kind: "thread",
    build: (docs) => serial(async () => (await getIndex()).build(docs, yieldToBrowser)),
    query: (terms, phrases, tolerance, limit) => serial(async () => (await getIndex()).query(terms, phrases, tolerance, limit)),
    decode: (url, vectorCount, dim) => loadFloat16Matrix(url, vectorCount, dim),
  };
}

let lexical = null;
let backendReadyP = null; // The sole promise for initial build, rebuild, and recovery.
function ensureBackend() {
  if (!lexical) lexical = createWorkerBackend() || createInThreadBackend();
  return lexical;
}

function retireWorkerBackend(error, failedBackend = lexical) {
  if (!failedBackend || failedBackend.kind !== "worker" || lexical !== failedBackend) {
    return backendReadyP || Promise.resolve();
  }
  failedBackend.retire(error);
  console.warn("[semantic-search] rebuilding search in-thread:", error && error.message);
  const replacement = createInThreadBackend();
  lexical = replacement;
  // The manifest and TOC already own the source text. Reconstruct joined
  // documents only on failure instead of retaining a worker recovery copy.
  backendReadyP = replacement.build(lexicalDocs()).then(() => {
    state.cache = { query: "", tolerance: null, lexical: null, embedding: null };
  }).catch(searchFailed);
  // Error events have no caller. Keep the rejected readiness promise available
  // to queries and retry(), without generating an unhandled rejection.
  backendReadyP.catch(() => {});
  return backendReadyP;
}

async function readyBackend() {
  ensureBackend();
  for (;;) {
    const readiness = backendReadyP;
    if (readiness) await readiness;
    if (readiness === backendReadyP) return lexical;
  }
}

async function lexicalQuery(terms, phrases, tolerance, limit) {
  const backend = await readyBackend();
  try {
    return await backend.query(terms, phrases, tolerance, limit);
  } catch (error) {
    if (backend.kind !== "worker") throw error;
    await retireWorkerBackend(error, backend);
    return (await readyBackend()).query(terms, phrases, tolerance, limit);
  }
}

async function decodeMatrix(url, vectorCount, dim, isCurrent) {
  if (!isCurrent()) return null;
  const backend = ensureBackend();
  if (backend.kind === "worker") {
    try { return await backend.decode(url, vectorCount, dim); }
    catch (error) {
      // Removal may occur while the worker is decoding. Do not start a second
      // allocation in the fallback for an obsolete request.
      if (!isCurrent()) return null;
      // A decode error (404, size mismatch) would fail the same way in-thread;
      // only a dead worker (already replaced in `lexical`) warrants a retry here.
      if (lexical === backend) throw error;
    }
  }
  return loadFloat16Matrix(url, vectorCount, dim);
}

function lexicalBuild(docs) {
  const previous = backendReadyP;
  const build = Promise.resolve(previous).then(async () => {
    const backend = ensureBackend();
    try { return await backend.build(docs); }
    catch (error) {
      if (backend.kind !== "worker") throw error;
      await retireWorkerBackend(error, backend);
      return docs.length;
    }
  });
  backendReadyP = build;
  return build;
}

function dotRow(query, rowIndex) {
  const offset = rowIndex * state.dim;
  let dot = 0;
  for (let i = 0; i < state.dim; i += 1) dot += query[i] * state.matrix[offset + i];
  return dot;
}

/* ------------------------------ records ------------------------------- */

// NUL keeps each TOC title a separate phrase unit while remaining a word
// boundary for the lexical tokenizer (central store data/toc_data.js).
function tocLexText(id) {
  const t = id && window.TOC_DATA ? window.TOC_DATA[id] : null;
  if (!t) return "";
  const out = [];
  for (let i = 0; i < t.length; i += 1) out.push(String((t[i] && t[i][1]) || ""));
  return out.join("\u0000");
}

// Rule filters may request every abstract repeatedly. Memoize only text that
// a reader actually requests; index construction alone retains no main-thread
// abstract copy. Weak keys release old manifest records after retry/reload.
const abstractTextCache = new WeakMap();
function getAbstractText(record, remember = false) {
  const cacheable = record && typeof record === "object";
  const cached = cacheable && abstractTextCache.get(record);
  if (cached && cached.sentences === record.sentences && cached.abstract === record.abstract) return cached.text;
  const text = Array.isArray(record && record.sentences)
    ? record.sentences.map((s) => String(s || "")).filter(Boolean).join(" ")
    : String((record && record.abstract) || "");
  if (remember && cacheable) abstractTextCache.set(record, {
    sentences: record.sentences, abstract: record.abstract, text,
  });
  return text;
}

// Join each manifest record to its table row by `id`. Only the abstract text is
// taken from the manifest; the row keeps its own metadata. Records without a
// matching row are still indexed for search but have no row to display on.
function remapToTableRows() {
  const rows = window.ARTICLES_DATA || [];
  const rowById = new Map();
  for (let r = 0; r < rows.length; r += 1) {
    if (rows[r] && rows[r].id) rowById.set(rows[r].id, rows[r]);
  }
  state.idByIndex = new Array(state.records.length);
  state.recordIndexByRowId = new Map();
  state.rowIdSet = new Set(rowById.keys());   // ids that exist as table rows
  for (let i = 0; i < state.records.length; i += 1) {
    const rec = state.records[i];
    const id = rec ? rec.id : null;
    state.idByIndex[i] = id;
    if (!id) continue;
    state.recordIndexByRowId.set(id, i);
    const row = rowById.get(id);
    // Surface the manifest's real abstract on the row with the SAME id.
    if (row) row.abstract = rec.sentences || [];
  }
}
// articles-grid.js swaps window.ARTICLES_DATA for a fresh view (copies of the
// store's snapshot) when it builds the table. If the manifest landed first, the
// abstracts sit on rows nothing renders any more - join them to the new ones.
window.addEventListener("oa-articles-view", () => {
  if (state.records && state.records.length) remapToTableRows();
});

// The row's authors as the table writes them ("Bos, Freek"), NUL between two
// names: a typed name finds that person's works, and a quoted phrase cannot
// run from one author into the next.
function authorLexText(row) {
  const bib = window.OABibliography;
  if (!bib || !Array.isArray(row.authors)) return "";
  return row.authors.map((author) => {
    const name = bib.resolveAuthorName(author);
    return [name.family, name.given].filter(Boolean).join(", ");
  }).join("\u0000");
}

// One {id, title, abstract, toc, authors} document per table row, for the
// lexical index. Title and subtitle go in as one text, so a full title - as
// pasted from a publisher page, "Title: Subtitle" - is found in quotes too.
function lexicalDocs() {
  const titles = new Map();
  const authors = new Map();
  const rows = window.ARTICLES_DATA || [];
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    if (row && row.id) {
      titles.set(row.id, [row.title, row.subtitle].filter(Boolean).join(" "));
      authors.set(row.id, authorLexText(row));
    }
  }
  const docs = [];
  for (let i = 0; i < state.records.length; i += 1) {
    const id = state.idByIndex[i];
    if (!id) continue;
    docs.push({ id, title: fold(titles.get(id) || ""), abstract: fold(getAbstractText(state.records[i])), toc: fold(tocLexText(id)), authors: fold(authors.get(id) || "") });
  }
  return docs;
}

// data/toc_data.js arrives after the dataset (data-load.js, window.OATocLoad),
// so it can land after the manifest. The index must not be built from an empty
// TOC column: wait for it (bounded - a failed TOC load must not hold search
// hostage), and if it still arrives after indexing, rebuild the index and drop
// the query cache so the next search sees the section titles.
function tocReady() {
  if (window.TOC_DATA) return Promise.resolve(true);
  const load = window.OATocLoad;
  if (!load) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const fin = (ok) => { if (!done) { done = true; resolve(ok); } };
    load.then(() => fin(true), () => fin(false));
    // Bounded wait. 10 s held keyword search hostage to a 3.8 MB optional file
    // on slow first visits; 2.5 s covers the common case where the async TOC
    // is a beat behind the manifest, and a TOC landing later still triggers
    // exactly one worker-side re-index (reindexIfTocLate) - off the main
    // thread, so the only cost is that early queries miss section titles.
    setTimeout(() => fin(!!window.TOC_DATA), 2500);
  });
}
/* Registered BEFORE the wait/build sequence. Registering it after meant a TOC
   script that landed DURING the worker build was already present by the time
   the watcher looked, so it returned without rebuilding the index that had been
   built from an empty TOC column. Now the decision is made from what the build
   actually indexed (tocIndexed), not from what happens to be present later. */
let tocIndexed = false;       // did the built index include TOC titles?
let lexicalIndexBuilt = false;
let tocReindexP = null;
function watchLateToc() {
  const load = window.OATocLoad;
  if (!load || window.TOC_DATA) return;
  load.then(() => { reindexIfTocLate(); }, () => {});
}
function reindexIfTocLate() {
  if (tocIndexed || !window.TOC_DATA) return tocReindexP || Promise.resolve(false);
  if (!lexicalIndexBuilt) return Promise.resolve(false);   // the running build will pick it up
  if (tocReindexP) return tocReindexP;
  tocReindexP = (async () => {
    try {
      await lexicalBuild(lexicalDocs());
      tocIndexed = !!window.TOC_DATA;
      state.cache = { query: "", tolerance: null, lexical: null, embedding: null };
      window.dispatchEvent(new CustomEvent("oa-search-ready"));   // the grid re-runs a live query
      return true;
    } catch (e) {
      console.warn("[semantic-search] TOC re-index failed:", e);
      return false;
    } finally { tocReindexP = null; }
  })();
  return tocReindexP;
}

/* ---------------------------- asset loading --------------------------- */

/* Two independent readiness signals. `api.ready` = the lexical index is built
   and keyword search answers. `vectorsPromise` = the abstract-vector matrix has
   been attached (or failed, resolving null), which is what semantic ranking and
   the best-sentence highlight need. Kept separate so an optional multi-MiB
   request cannot delay keyword search. */
let vectorsPromise = null;
let vectorGeneration = 0;

function releaseMatrices() {
  vectorGeneration += 1;
  state.matrix = null;
  state.sentenceMatrix = null;
  state.vectorsSettled = false;
  vectorsPromise = null;
  state.sentenceMatrixPromise = null;
}

/* ---- IndexedDB cache for the decoded vector matrices --------------------
   The manifest and the base64 vector files are re-fetched on every listing-
   page load, and the float16 -> Float32 decode is the expensive part. We cache
   the DECODED Float32 matrices in IndexedDB keyed by the manifest's identity
   (schema version + build time + model + dim). A new manifest changes the key,
   and stale entries are pruned. Everything degrades gracefully to a plain
   fetch + decode if IndexedDB is unavailable (private mode, quota, etc.). */
const IDB_NAME = "oa-search-cache";
const IDB_STORE = "vectors";

// Cache storage is optional. Bound each operation and close its handle so a
// blocked database or aborted transaction cannot stall search indefinitely.
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("no indexedDB")); return; }
    let settled = false;
    const timer = setTimeout(() => fail(new Error("cache open timeout")), 2000);
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    let req;
    try { req = indexedDB.open(IDB_NAME, 1); }
    catch (error) { fail(error); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      if (settled) { db.close(); return; }
      settled = true;
      clearTimeout(timer);
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => fail(req.error);
    req.onblocked = () => fail(new Error("cache open blocked"));
  });
}

function idbAccess(mode, action, fallback) {
  return idbOpen().then((db) => new Promise((resolve) => {
    let done = false, tx, result = fallback;
    const timer = setTimeout(() => {
      try { if (tx) tx.abort(); } catch (e) { /* already complete */ }
      finish(fallback);
    }, 2000);
    function finish(value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      db.close();
      resolve(value);
    }
    try {
      tx = db.transaction(IDB_STORE, mode);
      tx.oncomplete = () => finish(result);
      tx.onerror = tx.onabort = () => finish(fallback);
      action(tx.objectStore(IDB_STORE), (value) => { result = value; });
    } catch (e) { finish(fallback); }
  })).catch(() => fallback);
}

function idbGet(key) {
  return idbAccess("readonly", (store, setResult) => {
    const req = store.get(key);
    req.onsuccess = () => setResult(req.result != null ? req.result : null);
  }, null);
}

function idbSet(key, value) {
  return idbAccess("readwrite", (store, setResult) => {
    store.put(value, key);
    setResult(true);
  }, false);
}

function idbPrune(keepPrefix) {
  return idbAccess("readwrite", (store, setResult) => {
    const req = store.getAllKeys();
    req.onsuccess = () => {
      (req.result || []).forEach((key) => {
        if (typeof key === "string" && !key.startsWith(keepPrefix + "|")) store.delete(key);
      });
      setResult(true);
    };
  }, false);
}

// Load a decoded Float32 matrix, preferring the IndexedDB cache. On a miss,
// fetch + decode the binary (production) or base64 (source) file. A removed
// model cannot publish a late load or start another decoded-cache write.
async function loadMatrixCached(url, vectorCount, dim, cacheKey, isCurrent) {
  if (!isCurrent()) return null;
  const wantBytes = vectorCount * dim * 4;
  try {
    const cached = await idbGet(cacheKey);
    if (!isCurrent()) return null;
    const buf = cached instanceof ArrayBuffer ? cached : (cached && cached.buffer) || null;
    if (buf && buf.byteLength === wantBytes) return new Float32Array(buf);
  } catch (e) { /* fall through to fetch */ }
  if (!isCurrent()) return null;
  const matrix = await decodeMatrix(url, vectorCount, dim, isCurrent);
  if (!isCurrent() || !matrix) return null;
  idbSet(cacheKey, matrix.buffer);   // fire-and-forget write
  return matrix;
}

// `window.ABSTRACT_DATA={...};` (optionally behind a header comment) -> the
// object literal. Plain JSON still parses, so an older build keeps working.
function parseDataScript(text) {
  // Anchor on the real assignment, past the header comment: the comment names
  // the global too and its shape example has braces of its own.
  const at = text.lastIndexOf("window.ABSTRACT_DATA=");
  const start = text.indexOf("{", at >= 0 ? at : 0), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Abstract data is not an object literal.");
  return JSON.parse(text.slice(start, end + 1));
}

async function loadAssets() {
  // Parsed off the main thread where data-load.js is on the page; a plain
  // fetch + parse otherwise.
  const manifest = window.OAData
    ? await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA")
    : await fetch(MANIFEST_URL).then((response) => {
      if (!response.ok) throw new Error("Could not load " + MANIFEST_URL);
      return response.text();
    }).then(parseDataScript);
  const metadata = manifest.metadata || {};

  state.records = manifest.records || [];
  state.dim = Number(metadata.dimensions);
  // The manifest names the model that PRODUCED the abstract vectors; queries
  // must be embedded by the SAME model or cosine ranking is quiet noise - and
  // the plausible model families are all 768-d, so the dimension guard below
  // cannot catch a mismatch. A window.EMBEDDING_MODEL_ID override that agrees
  // is harmless; one that disagrees is a stale pin from an older build: warn
  // loudly and trust the manifest.
  const overrideModel = window.EMBEDDING_MODEL_ID || null;
  const manifestModel = metadata.browser_model || null;
  if (overrideModel && manifestModel && overrideModel !== manifestModel) {
    console.warn("[semantic-search] EMBEDDING_MODEL_ID (" + overrideModel +
      ") does not match the manifest's browser_model (" + manifestModel +
      "); using the manifest's model - the vectors were built with it.");
  }
  state.modelId = manifestModel || overrideModel || state.modelId;
  // A manifest exported without the embedding step carries no vector dimension:
  // its abstracts still feed keyword search and the drop-downs, but there is
  // nothing to rank with, so semantic ranking reports unavailable instead of
  // the whole search failing to load.
  const hasVectors = Number.isInteger(state.dim) && state.dim > 0;
  if (!hasVectors) {
    state.dim = 0;
    console.info("[semantic-search] manifest has no embedding metadata; keyword search only.");
  }

  // Cache identity for the decoded vectors: any change to the manifest build,
  // model or dimension invalidates it. Prune entries from older manifests.
  const cacheBase = ["v1", metadata.schema_version, metadata.created_utc, state.modelId, state.dim,
    ...(manifest.vector_revision ? [manifest.vector_revision] : [])].join("|");
  idbPrune(cacheBase);   // maintenance must not gate the lexical index

  const abstractCount = Number(metadata.abstract_count || state.records.length);
  // Build-generated paths are relative to this manifest, so a nested page or
  // older immutable asset version never fetches another deployment's vectors.
  const vectorUrl = (kind, fallback) => manifest.vector_files?.[kind]
    ? new URL(manifest.vector_files[kind], new URL(MANIFEST_URL, document.baseURI)).href
    : fallback;
  state.abstractMeta = hasVectors ? { count: abstractCount, cacheKey: cacheBase + "|abstract",
    url: vectorUrl("abstract", ABSTRACT_VECTORS_URL) } : null;

  remapToTableRows();

  // Sentence-level vectors (concatenated in record order) power the "best
  // matching sentence" semantic highlight. Optional: a load failure only
  // disables that highlight, not search or the lexical highlight.
  const sentenceCountMeta = Number(metadata.sentence_count || 0);
  let sentenceAcc = 0;
  state.sentenceStart = new Array(state.records.length);
  for (let i = 0; i < state.records.length; i += 1) {
    state.sentenceStart[i] = sentenceAcc;
    sentenceAcc += ((state.records[i] && state.records[i].sentences) || []).length;
  }
  state.sentenceCount = sentenceAcc;
  state.sentenceMeta = hasVectors && sentenceCountMeta && sentenceAcc === sentenceCountMeta
    ? { count: sentenceAcc, cacheKey: cacheBase + "|sentence",
      url: vectorUrl("sentence", SENTENCE_VECTORS_URL) }
    : null;

  // Lexical index, off the main thread (see lexicalBuild). TOC titles are part
  // of the indexed text, so the async TOC script should have landed first - but
  // the wait is bounded, and the watcher is registered BEFORE it so a TOC that
  // arrives mid-build still triggers exactly one re-index.
  watchLateToc();
  await tocReady();
  const hadToc = !!window.TOC_DATA;
  await lexicalBuild(lexicalDocs());
  tocIndexed = hadToc;
  lexicalIndexBuilt = true;
  reindexIfTocLate();          // no-op unless the TOC landed during the build

  setStatus("");

}

// Keyword-only visitors never fetch or decode either vector matrix; an
// installed model, or a request for highlights, starts it.
function ensureAbstractMatrix() {
  if (state.matrix) return Promise.resolve(state.matrix);
  if (vectorsPromise) return vectorsPromise;
  state.vectorsSettled = false;
  const generation = vectorGeneration;
  const isCurrent = () => generation === vectorGeneration;
  const loading = api.ready.then(() => {
    if (!isCurrent()) return null;
    const meta = state.abstractMeta;
    return meta ? loadMatrixCached(meta.url, meta.count, state.dim, meta.cacheKey, isCurrent) : null;
  }).catch((error) => {
    if (isCurrent()) console.warn("[semantic-search] abstract vectors unavailable; keyword search only:", error);
    return null;
  }).then((matrix) => {
    if (!isCurrent()) return null;
    state.matrix = matrix;
    state.vectorsSettled = true;
    if (matrix) window.dispatchEvent(new CustomEvent("oa-search-ready"));
    return matrix;
  }).finally(() => {
    // A failed load is retryable; an old completion cannot clear a newer load.
    if (vectorsPromise === loading) vectorsPromise = null;
  });
  vectorsPromise = loading;
  return vectorsPromise;
}

// Lazy, memoised loader for the sentence-vector matrix (best-sentence highlight
// only). Never rejects: a failure just leaves the highlight off. Safe to call
// repeatedly - the first call owns the fetch, the rest await the same promise.
function ensureSentenceMatrix() {
  if (state.sentenceMatrix) return Promise.resolve(state.sentenceMatrix);
  if (state.sentenceMatrixPromise) return state.sentenceMatrixPromise;
  const generation = vectorGeneration;
  const isCurrent = () => generation === vectorGeneration;
  // The vectors may still be in flight - lexical readiness no longer waits for
  // them - and state.sentenceMeta is only known once they land. Await that
  // first rather than memoising a null that would disable the highlight for
  // the rest of the session.
  const loading = ensureAbstractMatrix().then((abstractMatrix) => {
    if (!isCurrent()) return null;
    const meta = state.sentenceMeta;
    if (!meta || !abstractMatrix) return null;
    return loadMatrixCached(meta.url, meta.count, state.dim, meta.cacheKey, isCurrent)
      .then((m) => {
        if (!isCurrent() || !m) return null;
        state.sentenceMatrix = m;
        window.dispatchEvent(new CustomEvent("oa-search-highlight-ready"));
        return m;
      });
  }).catch((e) => {
    if (!isCurrent()) return null;
    console.warn("[semantic-search] sentence vectors unavailable; semantic highlight off:", e);
    state.sentenceMatrix = null;
    // Remember the failure: without this every drop render re-fetched and
    // re-decoded the file. The highlight stays off until the page reloads.
    state.sentenceMeta = null;
    return null;
  }).finally(() => {
    if (state.sentenceMatrixPromise === loading) state.sentenceMatrixPromise = null;
  });
  state.sentenceMatrixPromise = loading;
  return state.sentenceMatrixPromise;
}

/* --------------------------- query embedding -------------------------- */

// Aggregate transformers.js per-file byte progress (onnx weights + tokenizer +
// config) into one 0..100 for the UI progress bar, so it advances smoothly
// across all the files rather than jumping per file.
function makeProgressAggregator(generation) {
  const files = new Map();
  return (p) => {
    if (!p || generation !== modelGeneration) return;
    if (p.status === "progress" && p.file) {
      files.set(p.file, { loaded: Number(p.loaded) || 0, total: Number(p.total) || 0 });
      let loaded = 0, total = 0;
      files.forEach((v) => { loaded += v.loaded; total += v.total; });
      const pct = total > 0
        ? Math.min(99, Math.floor((loaded / total) * 100))
        : (p.progress != null ? Math.min(99, Math.round(p.progress)) : 0);
      setModelState("downloading", pct);
    }
    // The final jump to 100% is set by downloadModel() once the pipeline resolves.
  };
}

// Keep one running inference and at most one waiting query. A superseded query
// resolves null before it reaches ONNX. Running inference cannot be canceled,
// but neither its output nor status can overwrite a newer query.
let inferenceDrainP = null;
let queuedInference = null;

function cancelQueuedInference() {
  if (!queuedInference) return;
  queuedInference.resolve(null);
  queuedInference = null;
}

function embedQuery(query, token = state.queryToken) {
  cancelQueuedInference();
  query = fold(query);   // the corpus mostly writes CO2, m3
  const result = new Promise((resolve, reject) => {
    queuedInference = { query, token, generation: modelGeneration, resolve, reject };
  });
  startInferenceDrain();
  return result;
}

function startInferenceDrain() {
  if (!inferenceDrainP) {
    inferenceDrainP = Promise.resolve().then(async () => {
      while (queuedInference) {
        const job = queuedInference;
        queuedInference = null;
        const current = () => job.token === state.queryToken && job.generation === modelGeneration;
        if (!current() || state.modelState !== "ready" || !residentExtractor) {
          job.resolve(null);
          continue;
        }
        try {
          const output = await residentExtractor(job.query, { pooling: "mean", normalize: true });
          try {
            if (!current()) { job.resolve(null); continue; }
            const embedding = new Float32Array(output.data);
            if (state.dim && embedding.length !== state.dim) {
              throw new Error("Query dim " + embedding.length + " != vector dim " + state.dim);
            }
            setStatus("");
            job.resolve(embedding);
          } finally { if (typeof output.dispose === "function") output.dispose(); }
        } catch (error) {
          if (current()) job.reject(error);
          else job.resolve(null);
        }
      }
    }).finally(() => {
      inferenceDrainP = null;
      if (queuedInference) startInferenceDrain();
    });
  }
}

/* ------------------------------ ranking ------------------------------- */

// Query tokens for the per-term lexical passes (≥2 chars so "3d" counts).
function tokenizeSearchTerms(query) {
  return fold(String(query || ""))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

// A query phrase in the index's exact-phrase spelling (search-core.js).
function normPhrase(s) {
  return normFolded(fold(String(s || "")));
}

// Split a raw query into quoted exact phrases and loose terms:
//   'crack "yield stress" printing' -> { phrases:["yield stress"],
//                                        terms:["crack","printing"] }
// A quoted single word is an exact-word constraint (no typo tolerance).
// Unbalanced quotes: the fragment after the last quote counts as loose terms.
function parseQuery(query) {
  const phrases = [];
  const src = String(query || "");
  let rest = "";
  let last = 0;
  const re = /"([^"]*)"/g;
  let m = re.exec(src);
  while (m !== null) {
    rest += " " + src.slice(last, m.index);
    const p = normPhrase(m[1]);
    if (p) phrases.push(p);
    last = re.lastIndex;
    m = re.exec(src);
  }
  rest += " " + src.slice(last);
  return { phrases: phrases.slice(0, 4), terms: tokenizeSearchTerms(rest) };
}

async function lexicalSearch(query) {
  const scores = new Map();
  const coverage = new Map();   // id -> how many DISTINCT query terms matched
  const union = new Set();
  let maxScore = 0;
  const parsed = parseQuery(query);
  // Phrase words still join the scoring passes (they order docs within the
  // phrase-constrained set); the phrase itself is a hard filter below.
  const terms = Array.from(new Set(
    parsed.terms.concat(tokenizeSearchTerms(parsed.phrases.join(" ")))
  )).slice(0, 12);
  // One Orama pass PER TERM, fetching up to the WHOLE corpus per pass: the
  // old fixed 1000 cap silently dropped docs for common terms ("concrete"
  // alone matches >1000 of 5.5k abstracts), which (a) made quoted-phrase
  // results incomplete - the phrase filter can only keep docs the passes
  // scored - and (b) blinded search inside a narrow grid filter to rows
  // ranked below the corpus-wide top 1000.
  // Scoring makes term COVERAGE a strict tier: a
  // document matching k distinct query terms ALWAYS outranks one matching
  // k-1, no matter how strong the fewer matches are (BM25 term frequency once
  // let a short abstract repeating "stress" out-badge the papers that
  // actually say "yield stress"). Within a tier, the summed per-term-
  // normalized strength orders the docs: score = coverage + sum/(termCount+1),
  // so tier k occupies [k, k+1) and tiers never overlap. Single-term queries
  // reduce to plain normalized BM25 (one tier, ranking unchanged).
  // The passes and the quoted-phrase scan run in the search worker (or the
  // in-thread fallback); only compact [id, score] pairs come back.
  const passLimit = Math.max(LEXICAL_LIMIT, state.records.length);
  const res = await lexicalQuery(terms, parsed.phrases, state.settings.tolerance, passLimit);
  const required = res.required ? new Set(res.required) : null;   // phrase constraint
  // Content terms for the all-words rule: filler ("and", "of", "the") is
  // skipped, unless the query is nothing but filler. Passes come back in term
  // order, so each pass knows its term.
  let content = terms.filter((term) => !HIGHLIGHT_FILLER.has(term));
  if (!content.length) content = terms;
  const contentSet = new Set(content);
  const contentCoverage = new Map();
  for (let p = 0; p < res.passes.length; p += 1) {
    const hits = res.passes[p];
    const isContent = contentSet.has(terms[p]);
    let termMax = 0;
    for (let i = 0; i < hits.length; i += 1) if (hits[i][1] > termMax) termMax = hits[i][1];
    if (termMax <= 0) continue;
    for (let i = 0; i < hits.length; i += 1) {
      const id = hits[i][0];
      if (required && !required.has(id)) continue;
      union.add(id);
      coverage.set(id, (coverage.get(id) || 0) + 1);
      if (isContent) contentCoverage.set(id, (contentCoverage.get(id) || 0) + 1);
      scores.set(id, (scores.get(id) || 0) + hits[i][1] / termMax);
    }
  }
  // VERBATIM COMPLETENESS BACKSTOP: every doc that satisfies the quoted
  // phrases is a result, full stop - seed any the scoring passes missed
  // (typo-tolerance tokenization edges, or a future corpus outgrowing the
  // pass limit) at the bottom of tier 1 rather than dropping it silently.
  if (required) {
    required.forEach((id) => {
      if (!scores.has(id)) { scores.set(id, 0); coverage.set(id, 1); union.add(id); }
    });
  }
  const allIds = new Set();
  contentCoverage.forEach((n, id) => { if (n >= content.length) allIds.add(id); });
  // A query of quoted phrases only: the phrase constraint is the whole rule.
  if (required && !parsed.terms.some((term) => !HIGHLIGHT_FILLER.has(term))) required.forEach((id) => allIds.add(id));
  const tierDiv = terms.length + 1;
  scores.forEach((sum, id) => {
    const tiered = (coverage.get(id) || 1) + sum / tierDiv;
    scores.set(id, tiered);
    if (tiered > maxScore) maxScore = tiered;
  });
  return { scores, maxScore, hitCount: union.size, coverage, termCount: terms.length, requiredIds: required,
    allIds, contentTermCount: content.length };
}

function rankHybrid(queryEmbedding, lexical) {
  const lexicalScores = lexical.scores;
  const maxLexical = lexical.maxScore;
  const semanticWeight = state.settings.semanticWeight;
  const lexicalWeight = 1 - semanticWeight;
  const minSemantic = state.settings.minSemantic;
  const filterIds = state.filterIds;   // active candidate set (or null)
  const required = lexical.requiredIds || null;   // quoted-phrase constraint
  const allIds = state.anyWord ? null : lexical.allIds;
  const strongSemantic = Math.max(STRONG_SEMANTIC, minSemantic + 0.15);
  const ranked = [];
  for (let i = 0; i < state.records.length; i += 1) {
    const id = state.idByIndex[i];
    if (!id) continue;
    // Quoted phrases are a hard constraint: semantic similarity alone must
    // not surface a doc that lacks the exact phrase.
    if (required && !required.has(id)) continue;
    // Apply the filter candidate set BEFORE scoring so we never spend a
    // 768-dim dot product on a vector we're about to discard. (buildResult
    // still filters as a backstop for the lexical-only path.)
    if (filterIds && !filterIds.has(id)) continue;
    const cosine = dotRow(queryEmbedding, i);
    if (allIds && !allIds.has(id) && cosine < strongSemantic) continue;
    const lexicalRaw = lexicalScores.get(id) || 0;
    // minSemantic prunes semantic-only noise, but must NOT discard exact keyword
    // hits: a row that matches lexically stays eligible even when its whole-
    // abstract cosine to a short/generic query is below the cutoff (e.g.
    // "framework" is present in 93 abstracts, yet none clear 0.25 cosine).
    if (cosine < minSemantic && lexicalRaw <= 0) continue;
    const lexicalNorm = maxLexical > 0 ? lexicalRaw / maxLexical : 0;
    let score = semanticWeight * cosine + lexicalWeight * lexicalNorm;
    // Full-coverage floor: an abstract containing EVERY term of a multi-word
    // query never ranks below its lexical strength. Without this the 85%-
    // semantic blend buried the one "lubrication layer" abstract beneath
    // broadly-similar printing papers that merely say "layer".
    if (lexical.termCount > 1 && (lexical.coverage.get(id) || 0) >= lexical.termCount) {
      score = Math.max(score, lexicalNorm);
    }
    ranked.push({ id, cosine, lexical: lexicalNorm, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function rankLexicalOnly(lexicalScores, maxLexical, allIds) {
  const ranked = [];
  lexicalScores.forEach((raw, id) => {
    if (allIds && !allIds.has(id)) return;
    const lexical = maxLexical > 0 ? raw / maxLexical : 0;
    ranked.push({ id, cosine: null, lexical, score: lexical });
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function buildResult(query, ranked, semantic, lexical, degraded) {
  // Restrict to the active filter (if any). Manifest records without a table
  // row are dropped too - the grid has nothing to show for them. A dedupe guard
  // keeps one entry per row id. EVERY eligible hit goes into `order` (the table
  // is never capped (the grid opens hits' abstracts as they scroll into view).
  const hasRows = state.rowIdSet && state.rowIdSet.size > 0;
  const order = [];
  const rankById = new Map();
  const detail = new Map();
  for (const r of ranked) {
    if (state.filterIds && !state.filterIds.has(r.id)) continue;
    if (hasRows && !state.rowIdSet.has(r.id)) continue;
    if (rankById.has(r.id)) continue;
    rankById.set(r.id, order.length);
    order.push(r.id);
    detail.set(r.id, { cosine: r.cosine, lexical: r.lexical, score: r.score });
  }
  state.scoreDetailById = detail;
  return {
    query,
    order,
    rankById,
    semantic,
    // Effective mode of THIS ranking and why it fell short of semantic, so the
    // grid can keep "keyword only" visible instead of losing it to the next
    // transient status line. `degraded` is null when keyword-only is the normal
    // state (no model resident) and a short reason otherwise.
    mode: semantic ? "semantic" : "keyword",
    // More than one content word and the all-words rule on: the grid can
    // offer "Match any word" when this comes back empty.
    relaxable: !state.anyWord && !!(lexical && lexical.contentTermCount > 1),
    anyWord: !!state.anyWord,
    degraded: semantic ? null : (degraded || null),
    count: order.length,
    total: order.length,
  };
}

/* --------------------------- highlighting ----------------------------- */

function tokenizeTextWithOffsets(text) {
  const tokens = [];
  // Tokenize the folded text: "CO₂" and a split "CO 2" are the token "co2".
  // Same length as the text, so the offsets hold for the shown text.
  const folded = fold(text);
  const pattern = /[\p{L}\p{N}]+/gu;
  let match = pattern.exec(folded);
  while (match !== null) {
    tokens.push({ normalized: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length });
    match = pattern.exec(folded);
  }
  return tokens;
}

function boundedLevenshtein(left, right, maxDistance) {
  if (left === right) return 0;
  if (maxDistance <= 0) return maxDistance + 1;
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
  const previous = new Array(right.length + 1);
  const current = new Array(right.length + 1);
  for (let c = 0; c <= right.length; c += 1) previous[c] = c;
  for (let r = 1; r <= left.length; r += 1) {
    current[0] = r;
    let rowMin = current[0];
    for (let c = 1; c <= right.length; c += 1) {
      const cost = left[r - 1] === right[c - 1] ? 0 : 1;
      current[c] = Math.min(current[c - 1] + 1, previous[c] + 1, previous[c - 1] + cost);
      rowMin = Math.min(rowMin, current[c]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    for (let c = 0; c <= right.length; c += 1) previous[c] = current[c];
  }
  return previous[right.length];
}

// The search's own rule (search-core.js): a short word is marked only as written.
function effectiveTolerance(term, tolerance) {
  if (tolerance <= 0 || term.length <= SHORT_WORD_MAX) return 0;
  if (term.length <= 5) return Math.min(tolerance, 1);
  return tolerance;
}

function tokenMatchesTerm(token, term, tolerance) {
  if (token === term) return true;
  // The lexical index (Orama, search-core.js) matches by PREFIX regardless of
  // typo tolerance - "print" finds "printing", "3d" finds "3dcp" - so a match's
  // highlight must explain the same words (the index accepts 2-char terms).
  // Typo tolerance then adds edit-distance matches.
  if (term.length >= 2 && token.length > term.length && token.startsWith(term)) return true;
  const d = effectiveTolerance(term, tolerance);
  if (d <= 0) return false;
  return boundedLevenshtein(token, term, d) <= d;
}

function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [sorted[0]];
  for (const iv of sorted.slice(1)) {
    const prev = merged[merged.length - 1];
    if (iv.start <= prev.end) prev.end = Math.max(prev.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged;
}

function sanitizeIntervals(intervals, textLength) {
  const out = [];
  for (const iv of intervals) {
    const start = Math.max(0, Math.min(iv.start, textLength));
    const end = Math.max(start, Math.min(iv.end, textLength));
    if (end > start) out.push({ start, end });
  }
  return mergeIntervals(out);
}

function lexicalHighlightIntervals(text, query, tolerance) {
  const parsed = parseQuery(query);
  const intervals = [];
  const tokens = tokenizeTextWithOffsets(text);
  // Quoted phrases: mark each full adjacent-token run (punctuation between
  // words is fine - matching runs over normalized tokens).
  for (const p of parsed.phrases) {
    const pw = p.split(" ");
    for (let i = 0; i + pw.length <= tokens.length; i += 1) {
      let ok = true;
      for (let j = 0; j < pw.length; j += 1) {
        if (tokens[i + j].normalized !== pw[j]) { ok = false; break; }
      }
      if (ok) intervals.push({ start: tokens[i].start, end: tokens[i + pw.length - 1].end });
    }
  }
  // Loose terms: token-by-token with typo tolerance. Words that came from a
  // QUOTED phrase are deliberately excluded here - marking them individually
  // made a verbatim search look exactly like a loose one ("fiber", "fibers" and
  // "reinforcement" all lit up for "fiber reinforcement"). A quoted run is
  // marked only as the whole phrase, above; a quoted single word only where it
  // matches exactly (no tolerance).
  const terms = parsed.terms.filter(function (t) { return !HIGHLIGHT_FILLER.has(t); });
  if (terms.length) {
    for (const token of tokens) {
      for (const term of terms) {
        if (tokenMatchesTerm(token.normalized, term, tolerance)) {
          intervals.push({ start: token.start, end: token.end });
          break;
        }
      }
    }
  }
  return bridgeIntervals(sanitizeIntervals(intervals, text.length), text);
}

// Filler words never get their own mark (they still count for ranking).
const HIGHLIGHT_FILLER = new Set((
  "a an and or nor but the of in on at to for by with from as is are was were be " +
  "been it its this that these those into onto than then via vs per not no so if"
).split(" "));

// Adjacent hits separated only by spaces/hyphens become one mark
// ("principal stress trajectories" is one highlight, not three).
function bridgeIntervals(intervals, text) {
  if (intervals.length <= 1) return intervals;
  const out = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i += 1) {
    const prev = out[out.length - 1], iv = intervals[i];
    if (/^[\s\-\u2010-\u2014]+$/.test(text.slice(prev.end, iv.start))) prev.end = iv.end;
    else out.push({ ...iv });
  }
  return out;
}

function renderTextWithIntervals(text, intervals) {
  const value = typeset(String(text || ""));
  const safe = sanitizeIntervals(intervals || [], value.length);
  if (safe.length === 0) return escapeHtml(value);
  const parts = [];
  let cursor = 0;
  for (const iv of safe) {
    if (iv.start > cursor) parts.push(escapeHtml(value.slice(cursor, iv.start)));
    parts.push('<mark class="oa-hl-lexical">' + escapeHtml(value.slice(iv.start, iv.end)) + "</mark>");
    cursor = iv.end;
  }
  if (cursor < value.length) parts.push(escapeHtml(value.slice(cursor)));
  return parts.join("");
}

function renderSentenceLexical(text, query) {
  return renderTextWithIntervals(text, lexicalHighlightIntervals(String(text || ""), query, state.settings.tolerance));
}

function dotSentenceRow(query, globalIndex) {
  const offset = globalIndex * state.dim;
  let dot = 0;
  for (let i = 0; i < state.dim; i += 1) dot += query[i] * state.sentenceMatrix[offset + i];
  return dot;
}

function bestSentence(recordIndex, embedding) {
  const start = state.sentenceStart[recordIndex];
  const record = state.records[recordIndex];
  const n = ((record && record.sentences) || []).length;
  if (!Number.isInteger(start) || n <= 0) return null;
  let best = -Infinity;
  let bestLocal = 0;
  for (let local = 0; local < n; local += 1) {
    const g = start + local;
    if (g < 0 || g >= state.sentenceCount) continue;
    const score = dotSentenceRow(embedding, g);
    if (score > best) { best = score; bestLocal = local; }
  }
  return Number.isFinite(best) ? { index: bestLocal, score: best } : null;
}

// Highlighted body HTML (<p>...</p>) for a row's abstract drop: one flowing
// paragraph (sentence spans stay inline as highlight hooks).
function flowingParagraph(parts) {
  return '<p class="abstract-card-text">' + parts.join(" ") + "</p>";
}

// currently-active query. Returns null when no search is active or the row has
// no manifest record, so the component falls back to plain rendering.
function buildAbstractBody(rowId) {
  const query = state.currentQuery;
  if (!query) return null;
  const recordIndex = state.recordIndexByRowId.get(rowId);
  if (recordIndex == null) return null;
  const record = state.records[recordIndex];
  const sentences = (record && record.sentences) || [];
  if (!sentences.length) return null;

  let bestIndex = -1;
  if (state.currentEmbedding && state.sentenceMatrix) {
    const best = bestSentence(recordIndex, state.currentEmbedding);
    if (best) bestIndex = best.index;
  } else if (state.currentEmbedding && state.sentenceMeta) {
    // Matrix not resident yet: kick off the lazy load so a later re-render can
    // apply the semantic highlight. This render falls back to lexical-only.
    ensureSentenceMatrix();
  }

  const parts = sentences.map((sentence, i) => {
    const inner = renderSentenceLexical(sentence, query);
    const body = i === bestIndex
      ? '<span class="oa-hl-semantic" title="Best matching sentence (semantic)">' + inner + "</span>"
      : inner;
    return '<span class="abs-sentence">' + body + "</span>";
  });
  return flowingParagraph(parts);
}

function pct(x) { return (x * 100).toFixed(1) + "%"; }

// Small badge row shown in the abstract's head row, beside the read-aloud
// button: the score breakdown for this row under the current query (abstract
// cosine, lexical %, and the blended relevance score, all as percentages).
function buildScoreMeta(rowId) {
  const d = state.scoreDetailById.get(rowId);
  if (!d) return "";
  const badges = [];
  if (d.cosine != null) {
    badges.push('<span class="abs-score-badge abs-score-badge-semantic" title="Abstract-level cosine similarity to the query">semantic ' + pct(d.cosine) + "</span>");
  }
  badges.push('<span class="abs-score-badge abs-score-badge-lexical" title="Lexical (keyword) match strength, relative to the top hit">lexical ' + Math.round(d.lexical * 100) + "%</span>");
  badges.push('<span class="abs-score-badge abs-score-badge-blend" title="Blended relevance score used for ranking">score ' + pct(d.score) + "</span>");
  return '<div class="abs-score-meta">' + badges.join("") + "</div>";
}

function activate(query, embedding) {
  state.currentQuery = query || "";
  state.currentEmbedding = embedding || null;
}

function deactivate() {
  state.currentQuery = "";
  state.currentEmbedding = null;
  // The per-row score breakdown belongs to the query that produced it: left
  // behind, the badges kept claiming a "lexical 43%" with an empty search box.
  state.scoreDetailById = new Map();
}

/* ------------------------------- search ------------------------------- */

async function search(query, onPartial, opts) {
  const q = String(query || "").trim();
  if (q && state.status === "ok") warmOnIntent();
  const token = (state.queryToken += 1);
  cancelQueuedInference();
  // Optional allow-list of row ids (the grid's active filter). Applied inside
  // buildResult so the ranking is taken *within* the filter, not from the whole
  // corpus then intersected. An empty Set is honoured (0 results);
  // null/absent means rank the whole corpus (the grid passes a Set or null).
  state.filterIds = (opts && opts.filterIds) || null;
  state.anyWord = !!(opts && opts.anyWord);

  await api.ready;                       // may reject -> caller catches
  if (token !== state.queryToken) return null;
  if (q.length < MIN_QUERY_LENGTH) { deactivate(); return buildResult(q, [], false, null); }

  const tolerance = state.settings.tolerance;
  const sameQuery = state.cache.query === q;

  // Lexical depends on query + tolerance; reuse it across pure ranking-setting
  // changes (weight / min cosine / max results) so those re-rank instantly.
  let lexical;
  if (sameQuery && state.cache.tolerance === tolerance && state.cache.lexical) {
    lexical = state.cache.lexical;
  } else {
    lexical = await lexicalSearch(q);
    if (token !== state.queryToken) return null;
  }

  const cachedEmbedding = sameQuery && state.modelState === "ready" && state.matrix
    ? state.cache.embedding : null;
  activate(q, cachedEmbedding);

  // Progressive keyword-first view - only when a semantic re-rank is actually
  // coming (model resident, vectors loaded) and no embedding is cached for this
  // exact query. Without the model the final result IS the lexical one, so the
  // partial would just make the grid do the whole apply twice.
  const willRerank = state.modelState === "ready" && !!state.matrix;
  if (onPartial && willRerank && lexical.hitCount > 0 && !cachedEmbedding) {
    try { onPartial(buildResult(q, rankLexicalOnly(lexical.scores, lexical.maxScore, state.anyWord ? null : lexical.allIds), false, lexical)); } catch (e) { /* ignore */ }
  }

  let embedding = cachedEmbedding;
  if (!embedding) {
    // The model is downloaded explicitly (toolbar button + consent), never
    // implicitly by searching. Until it is resident - or if the abstract
    // vectors failed to load - rank keyword-only.
    if (state.modelState !== "ready" || !state.matrix) {
      // "Unavailable" only once the vector load has actually settled without
      // one - while it is still in flight, keyword-only is the normal early
      // state and needs no warning.
      const noVectors = !state.matrix && state.vectorsSettled;
      if (noVectors) setStatus("Search index vectors unavailable - keyword search only.");
      state.cache = { query: q, tolerance, lexical, embedding: null };
      activate(q, null);
      return buildResult(q, rankLexicalOnly(lexical.scores, lexical.maxScore, state.anyWord ? null : lexical.allIds), false, lexical,
        noVectors ? "search index vectors unavailable" : null);
    }
    try {
      embedding = await embedQuery(q, token);
      if (!embedding) return null;
    } catch (err) {
      if (token !== state.queryToken) return null;
      setStatus("Semantic model unavailable - keyword search only.");
      state.cache = { query: q, tolerance, lexical, embedding: null };
      activate(q, null);
      return buildResult(q, rankLexicalOnly(lexical.scores, lexical.maxScore, state.anyWord ? null : lexical.allIds), false, lexical, "semantic model unavailable");
    }
    if (token !== state.queryToken) return null;
  }

  state.cache = { query: q, tolerance, lexical, embedding };
  activate(q, embedding);               // enable semantic (best-sentence) highlight
  return buildResult(q, rankHybrid(embedding, lexical), true, lexical);
}

/* -------------------------------- API --------------------------------- */

const api = {
  MIN_QUERY_LENGTH,
  ready: null,             // keyword search usable (lexical index built)
  isReady: () => state.status === "ok",
  retry: retrySearch,
  downloadModel,
  deleteModel,
  getModelState: () => ({ state: state.modelState, progress: state.modelProgress, modelId: state.modelId }),
  // True once the abstract vectors are resident - semantic ranking needs the
  // model AND these; the settings panel shows its semantic sliders only then.
  hasVectors: () => !!state.matrix,
  search,
  renderAbstractBody: (rowId) => buildAbstractBody(rowId),
  // The score badges for a row ("" when it is not part of the active result) -
  // the drop places them on the "Abstract" head row next to the play button.
  renderScoreMeta: (rowId) => buildScoreMeta(rowId),
  // Escaped HTML for arbitrary text (e.g. TOC titles) with the ACTIVE query's
  // lexical hits marked; null when no query is active (caller escapes itself).
  highlightText: (text) => (state.currentQuery ? renderSentenceLexical(String(text == null ? "" : text), state.currentQuery) : null),
  // Raw abstract text for a table row id ("" when unknown) - rule-builder filters.
  getAbstractTextFor(rowId) {
    const i = state.recordIndexByRowId.get(rowId);
    return i == null ? "" : getAbstractText(state.records[i], true);
  },
  clearActive: () => { state.queryToken += 1; cancelQueuedInference(); deactivate(); },
  getSettings,
  setSettings,
  resetSettings: () => setSettings(DEFAULT_SETTINGS),
};

window.OASemanticSearch = api;

// Kick the asset load off on the first IDLE beat rather than at module
// evaluation. The manifest is ~9 MB and its float16 -> Float32 decode plus the
// lexical index build are chunky main-thread work; running them the instant the
// page loads competed with the grid's first renders, so scrolling in the first
// couple of seconds could stutter. Idle (with a short timeout so it always
// starts promptly) keeps `api.ready` semantics identical for every caller - they
// already await it - while letting the table become interactive first.
function startAssets() {
  if (typeof requestIdleCallback === "function") {
    return new Promise(function (resolve) {
      requestIdleCallback(function () { resolve(loadAssets()); }, { timeout: 1200 });
    });
  }
  return new Promise(function (resolve) { setTimeout(function () { resolve(loadAssets()); }, 300); });
}

function searchReady() {
  state.status = "ok";
  window.dispatchEvent(new CustomEvent("oa-search-ready"));
  // A model the reader installed earlier starts when they show an intent to
  // search - focus in the search field, or a query (search()) - never on idle:
  // a session that does not search never pays for an ONNX session start.
  const isSearchField = (el) => !!(el && el.matches && el.matches('input[type="search"], .search-input, input[name="q"]'));
  if (isSearchField(document.activeElement)) { warmOnIntent(); return; }
  const onFocus = (event) => {
    if (!isSearchField(event.target)) return;
    document.removeEventListener("focusin", onFocus, true);
    warmOnIntent();
  };
  document.addEventListener("focusin", onFocus, true);
}
let warmAsked = false;
function warmOnIntent() {
  if (warmAsked) return;
  warmAsked = true;
  warmModel(modelGeneration);
}

function searchFailed(error) {
  state.status = "error";
  console.error("[semantic-search] failed to initialize:", error);
  setStatus("Keyword search unavailable. Try again.");
  window.dispatchEvent(new CustomEvent("oa-search-load-error", { detail: error.message }));
  throw error;
}

function retrySearch() {
  if (state.status !== "error") return api.ready;
  state.status = "loading";
  setStatus("Preparing keyword search\u2026");
  if (lexical && lexical.kind === "worker") lexical.retire(new Error("Retrying search"));
  backendAttempt += 1;
  lexical = createInThreadBackend();
  backendReadyP = null;
  lexicalIndexBuilt = false;
  tocIndexed = false;
  api.ready = loadAssets().then(searchReady).catch(searchFailed);
  api.ready.catch(() => {});
  return api.ready;
}

api.ready = startAssets().then(searchReady).catch(searchFailed);
// The grid may not have a query yet. Report startup failure through status and
// keep its rejected readiness available to callers without a console rejection.
api.ready.catch(() => {});
