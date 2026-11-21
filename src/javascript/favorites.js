/* favorites.js - client-side "favorite articles" store for 3dcp.fyi.
 *
 * A reading list lives entirely in the browser via localStorage - no cookies,
 * no account, no network. The store is an ordered list of article ids (slugs).
 * The article grid, its toolbar and the selection badge read and mutate the
 * SAME store through window.OAFavorites, and a change in one place repaints
 * the others. A shared list arrives as index.html?favs=a,b,c#favorites; on
 * load the reader adds it or just has it shown (importFromUrl).
 *
 * Persistence is best-effort (OAPrefs): private-mode / disabled storage
 * degrades to an in-memory list for the session instead of throwing.
 */
(function () {
  "use strict";

  var KEY = "oa-favs";

  // Ordered list of ids; a Set mirrors it for O(1) membership tests.
  var order = [];
  var set = new Set();
  var listeners = [];
  // Bumped on every mutation. Lets pollers (the "all saved" header star, which
  // is re-synced on every grid render pass) cache a verdict and recompute it
  // only when the saved set actually moved.
  var rev = 0;

  function load() {
    var arr = window.OAPrefs.getJSON(KEY, []);
    order = Array.isArray(arr) ? Array.from(new Set(arr.map(String))) : [];
    set = new Set(order);
  }

  function persist() { window.OAPrefs.setJSON(KEY, order); }

  function emit() {
    rev++;
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* a bad listener shouldn't break others */ }
    });
  }

  function has(id) { return set.has(String(id)); }

  function add(id) {
    id = String(id);
    if (set.has(id)) return false;
    set.add(id);
    order.push(id);
    persist();
    emit();
    return true;
  }

  function remove(id) {
    id = String(id);
    if (!set.has(id)) return false;
    set.delete(id);
    order.splice(order.indexOf(id), 1);
    persist();
    emit();
    return true;
  }

  function toggle(id) {
    if (remove(id)) return false;
    add(id);
    return true;
  }

  // Batch add/remove - a single persist + emit for the whole set, so toggling a
  // whole grid ("favorite all") fires one repaint instead of N.
  function addMany(ids) {
    var changed = false;
    ids.forEach(function (id) {
      id = String(id);
      if (!set.has(id)) { set.add(id); order.push(id); changed = true; }
    });
    if (changed) { persist(); emit(); }
    return changed;
  }

  function removeMany(ids) {
    var changed = false;
    ids.forEach(function (id) { if (set.delete(String(id))) changed = true; });
    if (changed) {
      order = order.filter(function (id) { return set.has(id); });
      persist();
      emit();
    }
    return changed;
  }

  // True when `ids` is non-empty and every id is already favorited.
  function hasAll(ids) {
    return ids.length > 0 && ids.every(has);
  }

  function count() { return order.length; }

  // -> unsubscribe fn. Fires on local and cross-tab edits.
  function onChange(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  // ---- Shared markup helpers so every grid renders an identical control ----

  // A 24×24 star. `filled` swaps the outline for a solid fill (the CSS colors
  // it via currentColor / the .is-fav state).
  function iconHtml(filled) {
    if (filled) {
      return '<svg class="oa-star-ic" viewBox="0 0 24 24" width="16" height="16" ' +
        'fill="currentColor" stroke="none" aria-hidden="true">' +
        '<path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"/></svg>';
    }
    return '<svg class="oa-star-ic" viewBox="0 0 24 24" width="16" height="16" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/></svg>';
  }

  // Star toggle <button> for a grid cell; opts.extraClass scopes a grid's styling.
  function buttonHtml(id, opts) {
    var fav = has(id);
    var cls = "oa-fav-toggle" + (fav ? " is-fav" : "") + (opts && opts.extraClass ? " " + opts.extraClass : "");
    var label = fav ? "Remove from favorites" : "Add to favorites";
    return '<button type="button" class="' + cls + '" data-fav-id="' +
      String(id).replace(/"/g, "&quot;") + '" aria-pressed="' + (fav ? "true" : "false") +
      '" title="' + label + '" aria-label="' + label + '">' + iconHtml(fav) + "</button>";
  }

  // "Favorite all" header control - a star button shown in the favorites
  // column header. headerButtonHtml() is the column's `name`; syncHeaderButton()
  // mirrors whether every visible row is already saved (filled = all saved, a
  // click would clear them; outline = a click favorites them all).
  function headerButtonHtml(opts) {
    var cls = "oa-fav-toggle oa-fav-all" + (opts && opts.extraClass ? " " + opts.extraClass : "");
    var label = "Favorite all in view";
    return '<button type="button" class="' + cls + '" data-fav-all="1" ' +
      'aria-pressed="false" title="' + label + '" aria-label="' + label + '">' +
      iconHtml(false) + "</button>";
  }

  // `all`: the verdict the article grid has already decided (and memoized) on
  // its render pass; anything but true paints the outline.
  function syncHeaderButton(btn, all) {
    if (!btn) return;
    all = all === true;
    // Polled on every grid render pass - skip the DOM writes when unchanged.
    // (A freshly-rendered header node has no __favAll, so it always paints.)
    if (btn.__favAll === all) return;
    btn.__favAll = all;
    btn.classList.toggle("is-fav", all);
    btn.setAttribute("aria-pressed", all ? "true" : "false");
    var label = all ? "Remove all in view from favorites" : "Favorite all in view";
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
    btn.innerHTML = iconHtml(all);
  }

  // Reflect the toggle's visual + a11y state in place (snappier than a full
  // grid repaint); grids still invalidate the row so sorts/filters stay honest.
  // Runs for EVERY star in the DOM on every store change (syncAllButtons), so
  // skip the attribute/innerHTML writes when the state is already painted - a
  // freshly-rendered node has no __fav and always paints once.
  function syncButton(btn) {
    if (!btn) return;
    var fav = has(btn.getAttribute("data-fav-id"));
    if (btn.__fav === fav) return;
    btn.__fav = fav;
    btn.classList.toggle("is-fav", fav);
    btn.setAttribute("aria-pressed", fav ? "true" : "false");
    var label = fav ? "Remove from favorites" : "Add to favorites";
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
    btn.innerHTML = iconHtml(fav);
  }

  // Every [data-fav-count] shows the live count, and carries .has-favs while
  // there is something saved (the toolbar's star filter shows it only then).
  function refreshBadges() {
    var n = count();
    document.querySelectorAll("[data-fav-count]").forEach(function (el) {
      el.textContent = n >= 1000 ? "1k+" : String(n);
      el.classList.toggle("has-favs", n > 0);
    });
  }

  // Keep every star toggle in the DOM in sync with the store, so repeat
  // appearances of one article never show stale stars.
  function refreshAll() {
    refreshBadges();
    document.querySelectorAll(".oa-fav-toggle[data-fav-id]").forEach(syncButton);
  }

  // Clear all favorites, but confirm first (matches the grid toolbar's Clear).
  // Async since the confirm is the shared dialog; resolves the user's answer.
  function clearWithConfirm() {
    var n = count();
    if (!n) return Promise.resolve(false);
    return window.OADialog.confirmDialog({
      title: "Remove all " + n + " favorite" + (n === 1 ? "" : "s") + "?",
      message: "This clears your saved list in this browser.",
      confirmLabel: "Remove all",
      danger: true
    }).then(function (ok) {
      if (ok) { order = []; set = new Set(); persist(); emit(); }
      return ok;
    });
  }

  /* ----------------------- Share a reading list ----------------------- *
   * The whole list lives in the URL - no backend. The link points at the
   * article list (the site root) and carries the ids as `?favs=`, ending in
   * `#favorites` (the saved-only view). Opening it asks whether to add the
   * ids to the reader's list or just show them (importFromUrl, once on load), and strips the
   * param so a refresh does not ask again. Slugs are URL-safe, so ids are encoded one by one
   * and joined with LITERAL commas - %2C tripled the length, and long lists
   * already brush against server URL limits (~8 KB request line).
   * ------------------------------------------------------------------- */
  function shareUrl() {
    return window.OABibliography.siteUrl("index.html?favs=" + order.map(encodeURIComponent).join(",") + "#favorites");
  }

  // Build the link + copy it to the clipboard. Returns false (with a nudge)
  // when there's nothing to share.
  function copyShareLink() {
    if (!count()) {
      toast("No favorites yet - star the articles you want, then share.", false);
      return false;
    }
    var url = shareUrl();
    function copyIt() {
      window.OABrowserActions.copyText(url).then(function (ok) {
        toast(ok ? "Share link copied to clipboard" : "Couldn't copy - here's the link:\n" + url, ok);
      });
    }
    // Hundreds of ids make a URL long enough to trip server request-line
    // limits; past that the .bib download is the honest carrier.
    if (count() > 100) {
      window.OADialog.confirmDialog({
        title: "Share " + count() + " favorites as one link?",
        message: "Links this long can fail to open. For big lists, turn on the star filter and use Export (.bib) instead.",
        confirmLabel: "Copy link anyway"
      }).then(function (ok) { if (ok) copyIt(); });
      return true;
    }
    copyIt();
    return true;
  }

  // Ids from ?favs= - or from #favs=, the form older shared links used.
  function sharedIdsFromUrl() {
    var m = window.location.hash.match(/favs=([^&]*)/i) || window.location.search.match(/[?&]favs=([^&]*)/i);
    var raw = m ? m[1] : "";
    try { raw = decodeURIComponent(raw); } catch (e) {}
    var ids = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    return ids.length ? ids : null;
  }

  // Run once on load: clean the URL so a refresh is idempotent, then ask
  // whether to add the shared ids the list lacks; announces what was added.
  // Ids are validated against the corpus when it's loaded - typo'd or stale ids
  // would otherwise become permanent phantoms (the badge counts them, the grid
  // can't show them, the .bib export silently skips them). Without the corpus
  // they import as-is.
  function importFromUrl() {
    var ids = sharedIdsFromUrl();
    if (!ids) return;
    var skipped = 0;
    var all = window.ARTICLES_DATA;
    if (Array.isArray(all) && all.length) {
      var store = window.OAArticleStore.get();
      // An id typed or pasted in another case still names its paper: keep the
      // paper's own id (the list and the .bib export match ids exactly).
      var lower = null;
      var canonical = function (id) {
        var hit = store.getById(id);
        if (hit) return hit.id;
        if (!lower) { lower = new Map(); all.forEach(function (a) { if (a && a.id) lower.set(String(a.id).toLowerCase(), a.id); }); }
        return lower.get(String(id).toLowerCase()) || null;
      };
      var keep = ids.map(canonical).filter(Boolean);
      skipped = ids.length - keep.length;
      ids = keep;
    }
    // Strip the favs payload from the URL without reloading - from the hash
    // too, where #favorites beside it stays (it opens the saved-only view).
    // At once, whatever the answer below: a refresh does not ask again.
    try {
      var clean = window.location.pathname + window.location.search.replace(/([?&])favs=[^&]*&?/i, "$1").replace(/[?&]$/, "");
      var hash = window.location.hash.replace(/([#&])favs=[^&]*&?/i, "$1").replace(/[#&]$/, "");
      window.history.replaceState(null, "", clean + hash);
    } catch (e) {}
    var note = skipped ? " (" + skipped + " unknown id" + (skipped === 1 ? "" : "s") + " skipped)" : "";
    if (skipped && !ids.length) { toast("Couldn't add the shared list - its ids don't match any paper here", false); return; }
    var fresh = ids.filter(function (id, i) { return !has(id) && ids.indexOf(id) === i; });
    if (!fresh.length) { toast("These shared papers are already in your favorites" + note); return; }
    // Asked first, every time: the reader's own list has no undo, so the
    // shared papers join it only on a yes. Esc and "Just show them" leave it
    // and list the shared papers instead.
    var mine = count(), papers = fresh.length + " shared paper" + (fresh.length === 1 ? "" : "s");
    window.OADialog.confirmDialog({
      title: "Add " + papers + " to your favorites?",
      message: (mine ? "They join the " + mine + " favorite" + (mine === 1 ? "" : "s") + " already saved in this browser."
        : "They are saved in this browser, like the papers you star.") + (skipped ? "\n" + skipped + " unknown id" + (skipped === 1 ? " is" : "s are") + " skipped." : ""),
      cancelLabel: "Just show them",
      confirmLabel: "Add to favorites"
    }).then(function (ok) {
      if (!ok) { showShared(ids, note); return; }
      addMany(fresh);
      toast("Added " + papers + " to your favorites" + note);
    });
  }

  // "Just show them": the table lists every shared paper and nothing is saved.
  // The list is ID rules in ?q=, the table's own URL state, which it reads
  // again on a popstate (articles-grid.js applyStateFromUrl) or when it is
  // built. #favorites goes: it would keep only the papers already saved.
  function showShared(ids, note) {
    ids = ids.filter(function (id, i) { return ids.indexOf(id) === i; });
    try {
      var params = new URLSearchParams(window.location.search);
      params.set("q", ids.map(function (id) { return 'ID IS "' + id + '"'; }).join(" OR "));
      window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) { return; }   // sandboxed history: the normal table stays
    toast("Showing the " + ids.length + " shared paper" + (ids.length === 1 ? "" : "s") + " - your favorites are unchanged" + note);
  }

  // The shared confirmation pill (OATheme.copyToast), held 3.2 s so multi-line
  // messages (the fallback share URL) stay readable; ok=false is the error style.
  function toast(msg, ok) { window.OATheme.copyToast(msg, ok !== false, 3200); }

  // Cross-tab sync: another tab wrote the key -> reload + notify locally.
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    load();
    emit();
  });

  // Hydrate before the first paint of any star or badge. Loaded deferred, so the
  // DOM is parsed. The shared-list import validates ids against the corpus, which
  // data-load.js delivers asynchronously (a failed load imports as-is).
  load();
  onChange(refreshAll);
  refreshAll();
  Promise.resolve(window.OADataLoad).then(importFromUrl, importFromUrl);

  window.OAFavorites = {
    has: has,
    remove: remove,
    toggle: toggle,
    addMany: addMany,
    removeMany: removeMany,
    hasAll: hasAll,
    rev: function () { return rev; },
    count: count,
    onChange: onChange,
    iconHtml: iconHtml,
    buttonHtml: buttonHtml,
    headerButtonHtml: headerButtonHtml,
    syncHeaderButton: syncHeaderButton,
    syncButton: syncButton,
    refreshBadges: refreshBadges,
    // The articles toolbar's Share / Remove all buttons.
    copyShareLink: copyShareLink,
    clearWithConfirm: clearWithConfirm
  };
})();
