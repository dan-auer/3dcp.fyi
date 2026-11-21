/* search-core.js - the CPU-heavy parts of search, shared by the main-thread
 * module (semantic-search.js) and the worker (search-worker.js).
 *
 * Nothing here touches the DOM or window, so the same code runs in either
 * context: the worker is the normal path (the Orama index build and every
 * query pass stay off the main thread); the module imports it directly as the
 * in-thread fallback when module workers are unavailable.
 */

// Runs async operations one at a time in call order, each once the previous
// one has settled. Each caller makes its own queue.
export function createSerial() {
  let work = Promise.resolve();
  return function serial(operation) {
    const next = work.catch(() => {}).then(operation);
    work = next;
    return next;
  };
}

// Exact-phrase spelling: lowercase, every non-alphanumeric run one space, so
// "yield-stress," and 'Yield Stress' both read "yield stress". Expects folded
// text (OATypeset.fold): the worker has no window, so the main thread folds
// the docs and the query phrases (semantic-search.js) before they get here.
export function normPhrase(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Orama's English tokenizer keeps "-", "'" and "_" inside a word, so
// "3D-printed" was indexed as the single token "3d-printed" and a search for
// "printed" never reached it (queries are split on every non-alphanumeric run,
// tokenizeSearchTerms in semantic-search.js). The parts are indexed instead.
// The phrase scan reads this same text and treats these characters as spaces
// anyway (normPhrase), so phrase matching is unchanged.
const JOINERS = /[-_'\u2010\u2011\u2019]+/g;
export function splitJoined(text) {
  return String(text || "").replace(JOINERS, " ");
}

// Words this short match as written, or as the start of a word, never with a
// typo: one edit turned "sand" into "and", "wall" into "all" and "lime" into
// "time", and each listed most of the corpus. The highlight follows the same
// rule (semantic-search.js); author names take no typo at any length (query).
export const SHORT_WORD_MAX = 4;

// Orama full-text index over {id, title, abstract, toc, authors} docs plus the
// quoted-phrase scan. `orama` is the imported @orama/orama module.
//   build(docs, onBatch?)  (re)creates the index; onBatch(done, total) is awaited
//                          every 256 inserts (the in-thread fallback yields there).
//   query(terms, phrases, tolerance, limit)
//     -> { passes: [[id, score], ...][]  one array per term, in term order
//          required: [id, ...] | null    docs containing EVERY quoted phrase }
export function createLexicalIndex(orama) {
  let db = null;
  let docs = [];

  async function build(source, onBatch) {
    const nextDocs = [];
    const documentsStore = orama.components.documentsStore.createDocumentsStore();
    const next = await orama.create({
      schema: { title: "string", abstract: "string", toc: "string", authors: "string" },
      // Queries rank by relevance; no text column is ever sorted.
      sort: { enabled: false },
      components: { documentsStore: {
        ...documentsStore,
        store(storage, id, internalId, document) {
          // Orama indexes the original input, but its result store only needs
          // the id. Share one compact phrase document with the phrase scan.
          // Keep its raw fields only until the first quoted query, then
          // replace them with normalized text instead of caching a second copy.
          const compact = { id: document.id, text: [String(document.title || ""), document.abstract, String(document.toc || ""), String(document.authors || "")] };
          const inserted = documentsStore.store(storage, id, internalId, compact);
          if (inserted) nextDocs.push(compact);
          return inserted;
        },
      } },
    });
    for (let i = 0; i < source.length; i += 1) {
      const doc = source[i];
      await orama.insert(next, { id: doc.id, title: splitJoined(doc.title), abstract: splitJoined(doc.abstract), toc: splitJoined(doc.toc), authors: splitJoined(doc.authors) });
      if (onBatch && (i & 255) === 255) await onBatch(i + 1, source.length);
    }
    // Publish both views together only after every insert succeeds. Backend
    // serialization keeps queries behind a requested build.
    db = next;
    docs = nextDocs;
    return docs.length;
  }

  function normOf(document) {
    if (typeof document.text !== "string") {
      // Normalize each unit separately: the delimiter must survive so a phrase
      // cannot span the title, the abstract and the TOC, two adjacent TOC
      // section titles, or two authors. (Title + subtitle are one unit: a
      // pasted full title matches.)
      const units = [document.text[0], document.text[1]].concat(document.text[2].split("\u0000"), document.text[3].split("\u0000"));
      document.text = " " + units.map(normPhrase).join(" \u0000 ") + " ";
    }
    return document.text;
  }

  // Ids of docs whose text contains EVERY quoted phrase (adjacent words, in
  // order); the space padding enforces whole-word boundaries.
  function phraseIds(phrases) {
    const needles = phrases.map((p) => " " + p + " ");
    const req = [];
    for (const d of docs) {
      const txt = normOf(d);
      let all = true;
      for (const n of needles) {
        if (txt.indexOf(n) === -1) { all = false; break; }
      }
      if (all) req.push(d.id);
    }
    return req;
  }

  async function query(terms, phrases, tolerance, limit) {
    if (!db) return { passes: [], required: null };
    const passes = await Promise.all(terms.map(async (term) => {
      const [text, names] = await Promise.all([
        orama.search(db, {
          term,
          properties: ["title", "abstract", "toc"],
          // A term in the title says more about the paper than one in its abstract.
          boost: { title: 2 },
          limit,
          tolerance: term.length > SHORT_WORD_MAX ? tolerance : 0,
        }),
        // Names without the typo tolerance: many are a letter away from a
        // word ("king": Kong, Jing, Ming; "strong": Surong) and would top a
        // topic search. As written, or the start of a name, still matches.
        orama.search(db, { term, properties: ["authors"], limit, tolerance: 0 }),
      ]);
      // One pass per term, as before: a work's two scores add up.
      const sum = new Map();
      for (const r of [text, names]) {
        for (const h of r.hits) sum.set(h.document.id, (sum.get(h.document.id) || 0) + (Number(h.score) || 0));
      }
      return Array.from(sum);
    }));
    return {
      // Compact [id, score] pairs: the stored documents (the whole abstract text)
      // never cross the worker boundary.
      passes,
      required: phrases && phrases.length ? phraseIds(phrases) : null,
    };
  }

  return { build, query };
}

/* --------------------------- float16 decode --------------------------- */

function halfToFloat(half) {
  const sign = (half & 0x8000) ? -1 : 1;
  const exponent = (half >> 10) & 0x1f;
  const fraction = half & 0x03ff;
  if (exponent === 0) {
    if (fraction === 0) return sign * 0;
    return sign * 2 ** -14 * (fraction / 1024);
  }
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

// 65536-entry float16 -> float32 lookup table, built lazily on the first
// decode (pages that hit the IndexedDB cache never pay for it). Replaces the
// per-element branch/exponent math above with one indexed read - the matrices
// are millions of elements on a cache miss (abstracts + sentence vectors).
let F16_TABLE = null;
function f16Table() {
  if (!F16_TABLE) {
    F16_TABLE = new Float32Array(65536);
    for (let i = 0; i < 65536; i += 1) F16_TABLE[i] = halfToFloat(i);
  }
  return F16_TABLE;
}

// Production exports contain byte-identical binary float16 files. Source
// checkouts still use base64 text. Both paths share the little-endian decoder;
// binary avoids text decoding and the base64/binary-string copies altogether.
export async function loadFloat16Matrix(url, vectorCount, dimensions) {
  const elements = vectorCount * dimensions;
  if (!Number.isSafeInteger(vectorCount) || vectorCount < 0 ||
      !Number.isSafeInteger(dimensions) || dimensions <= 0 ||
      !Number.isSafeInteger(elements * 2)) throw new Error("Invalid vector shape");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load " + url);
  let bytes;
  if (/\.f16\.bin(?:[?#]|$)/i.test(String(url))) {
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    const base64 = (await response.text()).replace(/\s+/g, "");
    if (typeof Uint8Array.fromBase64 === "function") {
      bytes = Uint8Array.fromBase64(base64);   // native decode - skips the binary-string copy
    } else {
      const binary = atob(base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    }
  }
  const expected = elements * 2;
  if (bytes.length !== expected) {
    throw new Error("Vector size mismatch: got " + bytes.length + " bytes, expected " + expected);
  }
  const table = f16Table();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const matrix = new Float32Array(elements);
  for (let i = 0; i < matrix.length; i += 1) {
    matrix[i] = table[view.getUint16(i * 2, true)];
  }
  return matrix;
}
