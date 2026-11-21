/* Small explicit owner for one mounted UI. No global API monkey-patching.
   Listeners ride one AbortController: destroy() aborts it and the browser drops
   them all. It also ignores a duplicate add and handles `once` / handleEvent. */
(function () {
  "use strict";
  function create() {
    var destroyed = false, controller = new AbortController();
    var cleanups = new Set(), timers = new Set(), frames = new Set();

    function add(cleanup) {
      if (typeof cleanup !== "function") return function () {};
      var pending = true;
      function dispose() {
        if (!pending) return;
        pending = false;
        cleanups.delete(dispose);
        cleanup();
      }
      if (destroyed) dispose(); else cleanups.add(dispose);
      return dispose;
    }
    function guard(callback) {
      return function () { if (!destroyed) return callback.apply(this, arguments); };
    }
    // -> remover for this one listener. After destroy() the aborted signal
    // makes the add a no-op.
    function listen(target, type, callback, options) {
      if (!target) return function () {};
      var opts = options && typeof options === "object" ? Object.assign({}, options) : { capture: !!options };
      opts.signal = controller.signal;
      target.addEventListener(type, callback, opts);
      return function () { target.removeEventListener(type, callback, opts); };
    }
    function subscribe(event, callback) {
      if (destroyed || !event) return function () {};
      var bound = guard(callback);
      event.subscribe(bound);
      return add(function () { event.unsubscribe(bound); });
    }
    function clearTimeout(id) { timers.delete(id); window.clearTimeout(id); }
    function cancelAnimationFrame(id) { frames.delete(id); window.cancelAnimationFrame(id); }
    function timeout(callback, delay) {
      if (destroyed) return 0;
      var args = Array.prototype.slice.call(arguments, 2);
      var id = window.setTimeout(function () { timers.delete(id); callback.apply(window, args); }, delay);
      timers.add(id);
      return id;
    }
    function frame(callback) {
      if (destroyed) return 0;
      var id = window.requestAnimationFrame(function (time) { frames.delete(id); callback(time); });
      frames.add(id);
      return id;
    }
    function observe(observer) {
      add(function () { observer.disconnect(); });
      return observer;
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      timers.forEach(function (id) { window.clearTimeout(id); });
      frames.forEach(function (id) { window.cancelAnimationFrame(id); });
      timers.clear(); frames.clear();
      Array.from(cleanups).reverse().forEach(function (cleanup) {
        try { cleanup(); } catch (error) { console.error("[lifecycle] teardown", error); }
      });
      cleanups.clear();
    }
    return { add: add, guard: guard, listen: listen, subscribe: subscribe,
      timeout: timeout, clearTimeout: clearTimeout,
      frame: frame, cancelAnimationFrame: cancelAnimationFrame,
      observe: observe, destroy: destroy };
  }
  window.OALifecycle = { create: create };
})();
