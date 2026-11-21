/* Module worker owning the lexical index and float16 decode.
 * Builds are serialized. Queries await the latest requested build, so a late
 * TOC update cannot combine a new phrase list with an old Orama index.
 * Only semantic-search.js talks to it: "build" | "query" | "decode" in, the
 * reply (or { type: "error" }) out under the same reqId.
 */
import { createLexicalIndex, loadFloat16Matrix, createSerial } from "./search-core.js";

let index = null;
let indexPromise = null;
let buildReady = Promise.resolve();
let latestQuery = 0;   // reqId of the newest query; older ones still waiting are skipped

const serial = createSerial();

// The local copy first, then the CDN; a hung import gives way after 10 s.
async function loadOrama(urls) {
  let lastError;
  for (const url of urls) {
    let timer;
    try {
      return await Promise.race([
        import(url),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Search library import timed out")), 10000);
        }),
      ]);
    } catch (error) { lastError = error; }
    finally { clearTimeout(timer); }
  }
  throw lastError;
}

function getIndex(urls) {
  if (!indexPromise) {
    indexPromise = loadOrama(urls).then((orama) => (index = createLexicalIndex(orama)))
      .catch((error) => { indexPromise = null; throw error; });
  }
  return indexPromise;
}

self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.type === "build") {
      buildReady = serial(async () => (await getIndex(message.oramaUrls)).build(message.docs));
      await buildReady;
      self.postMessage({ type: "built", reqId: message.reqId });
    } else if (message.type === "query") {
      latestQuery = message.reqId;
      const requiredBuild = buildReady;
      const result = await serial(async () => {
        await requiredBuild;
        // Queries queue behind builds and each other. One superseded while it
        // waited (the reader kept typing) settles empty without running - the
        // caller discards stale results anyway, as the inference queue does.
        if (message.reqId !== latestQuery) return { passes: [], required: null };
        return index.query(message.terms, message.phrases, message.tolerance, message.limit);
      });
      self.postMessage({ type: "result", reqId: message.reqId, ...result });
    } else if (message.type === "decode") {
      const matrix = await loadFloat16Matrix(message.url, message.vectorCount, message.dim);
      self.postMessage({ type: "matrix", reqId: message.reqId, buffer: matrix.buffer }, [matrix.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: "error", reqId: message.reqId, message: String(error.message || error) });
  }
};
