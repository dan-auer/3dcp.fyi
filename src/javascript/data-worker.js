/* data-worker.js - fetches the data scripts (the dataset, section titles,
   graph metrics, the search manifest - see data-load.js) and parses them off
   the main thread. The files stay exactly what they are (window.X = <JSON>; behind a
   header comment) so the plain <script> path keeps working everywhere else;
   here the assignment is sliced off and the literal goes through JSON.parse,
   which is both faster than evaluating it as JavaScript and happens in this
   worker rather than on the page. The result crosses back by structured clone.

   Message in : { reqId, url, global }        global: "ARTICLES_DATA" etc.
   Message out: { reqId, value } | { reqId, error } */
self.onmessage = async function (event) {
  var m = event.data;
  try {
    var r = await fetch(m.url);
    if (!r.ok) throw new Error("HTTP " + r.status + " for " + m.url);
    var text = await r.text();
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
