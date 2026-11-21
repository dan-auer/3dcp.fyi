/* data-worker.js - fetches the data scripts (the dataset, section titles,
   graph metrics, the search manifest - see data-load.js) and parses them off
   the main thread. The files stay exactly what they are (window.X = <JSON>; behind a
   header comment) so the plain <script> path keeps working everywhere else;
   here the assignment is sliced off and the literal goes through JSON.parse,
   which is both faster than evaluating it as JavaScript and happens in this
   worker rather than on the page. The result crosses back by structured clone.

   Message in : { reqId, url, global }        global: "ARTICLES_DATA" etc.
   Message out: { reqId, loaded, total }      while the file arrives (see read)
                { reqId, value } | { reqId, error }   once, at the end */
self.onmessage = async function (event) {
  var m = event.data;
  try {
    var r = await fetch(m.url);
    if (!r.ok) throw new Error("HTTP " + r.status + " for " + m.url);
    var text = await read(r, m.reqId);
    var at = text.lastIndexOf("window." + m.global);
    if (at < 0) throw new Error("no window." + m.global + " assignment in " + m.url);
    var start = text.indexOf("=", at) + 1;
    while (start < text.length && /\s/.test(text[start])) start++;
    var open = text[start];
    if (open !== "{" && open !== "[") throw new Error("unexpected literal in " + m.url);
    var end = text.lastIndexOf(open === "{" ? "}" : "]");
    self.postMessage({ reqId: m.reqId, value: JSON.parse(text.slice(start, end + 1)) });
  } catch (error) {
    self.postMessage({ reqId: m.reqId, error: String(error.message || error) });
  }
};

// The body as text, reporting { reqId, loaded, total } for the table's loading
// bar: once when the headers are in, every 64 KB, and at the end. loaded counts
// the bytes after any compression is undone, so total is the Content-Length
// only for a file sent uncompressed (serve.py); 0 means unknown (GitHub Pages
// compresses - data-load.js then takes the size from data/summary.json).
async function read(r, reqId) {
  if (!r.body || !r.body.getReader) return r.text();
  var total = r.headers.get("Content-Encoding") ? 0 : Number(r.headers.get("Content-Length")) || 0;
  var reader = r.body.getReader(), chunks = [], loaded = 0, told = 0;
  self.postMessage({ reqId: reqId, loaded: 0, total: total });
  for (;;) {
    var step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    loaded += step.value.length;
    if (loaded - told >= 65536) {
      told = loaded;
      self.postMessage({ reqId: reqId, loaded: loaded, total: total });
    }
  }
  self.postMessage({ reqId: reqId, loaded: loaded, total: total });
  return new Blob(chunks).text();
}
