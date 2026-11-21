/* Decide once, before optional entry assets are requested. */
(function () {
  "use strict";
  // A kiosk link (?kiosk, kiosk.js) is one too: the kiosk opens over the
  // table, and closing it lands there.
  var deep = /[?&](q|favs|search|sort_by|group_by)=/i.test(location.search) ||
    /[?&]kiosk(?:[=&]|$)/i.test(location.search) ||
    location.hash.toLowerCase().indexOf("#favorites") === 0;
  var seen = window.OAPrefs.get("oa-gate-seen") === "1", asked = false;
  try {   // storage can be blocked; the gate then shows as on a first visit
    asked = sessionStorage.getItem("oa-gate-request") === "1";
    if (asked) sessionStorage.removeItem("oa-gate-request");
  } catch (e) {}
  var showGate = asked || (!deep && !seen);
  // The gate is static markup that only table-gate.js (the last deferred
  // script) removes, so it painted for the whole data load on every visit.
  // Mark the skip here, before first paint, so CSS never shows it.
  if (!showGate) document.documentElement.setAttribute("data-entry", "table");
  window.OAEntry = Object.freeze({ showGate: showGate, asked: asked });
})();
