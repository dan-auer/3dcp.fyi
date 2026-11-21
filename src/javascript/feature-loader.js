/* Optional UI code loads on first use. Failed loads remain retryable. */
(function () {
  "use strict";
  var features = {
    addPaper: ["add-paper.js", "OAAddPaper"],
    reportError: ["report-error.js", "OAReportError"],
    model: ["model-gate.js", "OAModelGate"],
    tts: ["oa-tts.js", "OATTS"]
  };
  function load(name) {
    var spec = features[name];   // callers name only the four above
    return window.OAAssets.loadScript(window.OAAssets.url("src/javascript/" + spec[0])).then(function () {
      var api = window[spec[1]];
      if (!api) throw new Error("Feature did not initialize: " + name);
      return api;
    });
  }
  function failed() {
    window.OATheme.copyToast("Could not load this feature. Please try again.", false);
  }
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest;
    if (!target) return;
    var add = event.target.closest(".oa-add-btn");
    var report = event.target.closest("[data-report-id]");
    var name = add ? "addPaper" : report ? "reportError" : null;
    if (!name || window[features[name][1]]) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var button = add || report;
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    load(name).then(function (api) {
      if (!button.isConnected) return;
      if (report) api.openFor(button); else api.open();
    }).catch(failed).finally(function () { button.removeAttribute("aria-busy"); });
  }, true);
  window.OAFeatures = Object.freeze({ load: load, failed: failed });
})();
