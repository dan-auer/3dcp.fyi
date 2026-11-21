/* Load keyword search only when the table is entered. Return one shared
 * readiness promise, and release a failed attempt so the UI can offer retry.
 * Capture this script's URL before document.currentScript becomes null.
 */
(function () {
  "use strict";
  var moduleUrl = new URL("semantic-search.js", document.currentScript.src).href;
  var pending = null;
  var attempt = 0;
  var ownerId = 0;

  function reportFailure(error, owner) {
    if (owner === ownerId) {
      pending = null;
      window.dispatchEvent(new CustomEvent("oa-search-load-error", { detail: error.message }));
    }
    throw error;
  }

  window.addEventListener("oa-search-load-error", function () { pending = null; });

  window.OALoadSearch = function () {
    if (pending) return pending;
    var owner = ++ownerId;
    var failedAttempt = function (error) { return reportFailure(error, owner); };
    var api = window.OASemanticSearch;
    if (api) {
      pending = Promise.resolve().then(function () { return api.retry(); }).catch(failedAttempt);
    } else {
      pending = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        var url = new URL(moduleUrl, document.baseURI);
        if (attempt) url.searchParams.set("oa_retry", String(attempt));
        script.type = "module";
        script.src = url.href;
        var timer = setTimeout(function () { failed(new Error("Search module timed out")); }, 30000);
        function failed(error) {
          clearTimeout(timer);
          script.remove();
          reject(error);
        }
        script.onload = function () {
          clearTimeout(timer);
          var loaded = window.OASemanticSearch;
          if (!loaded) { failed(new Error("Search module did not initialize")); return; }
          Promise.resolve(loaded.ready).then(resolve, reject);
        };
        script.onerror = function () {
          // A real module-load failure can be cached by the browser. A timeout
          // may still finish later, so reuse its URL to avoid duplicate module
          // evaluation and overlapping search owners on that retry.
          attempt += 1;
          failed(new Error("Search could not load. Try again."));
        };
        document.body.appendChild(script);
      }).catch(failedAttempt);
    }
    // Entry-gate callers can fire and forget. Interactive callers still receive
    // the rejected promise and can display their own retry control.
    pending.catch(function () {});
    return pending;
  };
})();
