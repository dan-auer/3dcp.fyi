/* Shared retryable asset loading. Navigation paths stay separate from the
   content-versioned asset root supplied by the production build. */
(function () {
  "use strict";
  var pending = new Map();
  function url(path) {
    return new URL(path, new URL(window.OA_ASSET_ROOT || window.OA_REL_ROOT || "", document.baseURI)).href;
  }
  function load(kind, path) {
    var href = new URL(path, document.baseURI).href, key = kind + ":" + href;
    if (pending.has(key)) return pending.get(key);
    // A stylesheet the page already links (index.html adds the table's own
    // sheets on the return path) is not loaded twice: adopt the existing link.
    var present = kind === "css" && Array.prototype.find.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return l.href === href; });
    if (present) {
      var ready = present.sheet ? Promise.resolve(href) : new Promise(function (resolve) {
        var done = function () { resolve(href); };
        present.addEventListener("load", done);
        present.addEventListener("error", done);
      });
      pending.set(key, ready);
      return ready;
    }
    var promise = new Promise(function (resolve, reject) {
      var node = document.createElement(kind === "css" ? "link" : "script");
      if (kind === "css") { node.rel = "stylesheet"; node.href = href; }
      else { node.src = href; node.async = false; }   // async = false: injected scripts run in call order
      node.onload = function () { resolve(href); };
      node.onerror = function () { node.remove(); reject(new Error("Failed to load " + href)); };
      document.head.appendChild(node);
    }).catch(function (error) { pending.delete(key); throw error; });   // a failed load stays retryable
    pending.set(key, promise);
    return promise;
  }
  function loadScript(path) { return load("js", path); }
  window.OAAssets = Object.freeze({
    url: url,
    loadCss: function (path) { return load("css", path); },
    loadScript: loadScript,
    loadScripts: function (paths) { return Promise.all(paths.map(loadScript)); }
  });
})();
