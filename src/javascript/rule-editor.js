/* rule-editor.js
 * Owns the rule draft, applied snapshot, recovery UI, row controls and facet edits.
 * OARuleLanguage remains the only parser, schema, serializer and Boolean compiler.
 * The host supplies data lookups and effects; this module does not access SlickGrid,
 * search state, URL history or article selection. Classic script.
 */
globalThis.OARuleEditor = (function () {
  "use strict";

  function create(dependencies) {
    const window = dependencies.window;
    const document = dependencies.document;
    const ruleLanguage = dependencies.language;
    const theme = dependencies.theme;
    const facets = dependencies.facets;
    const FIELDS = ruleLanguage.FIELDS;
    const ruleFieldDefinitions = ruleLanguage.schema;
    const RELATION_FIELDS = ruleLanguage.RELATION_FIELDS;
    const ruleTree = { rows: [] };
    let nextRuleNodeId = 1;
    let ruleUpdateTimer = null;
    let destroyed = false;
    function normalizeText(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
    const escapeHtml = theme.escapeHtml;
    const { isValidYYYYMM, rowsToString, conditionToString } = ruleLanguage;
    function parseRuleQuery(input) { return ruleLanguage.parse(input, { makeId: makeRuleNodeId }); }
    function treeToRows(tree) { return ruleLanguage.treeToRows(tree, { makeId: makeRuleNodeId }); }
    function makeRuleNodeId() {
      const id = "rule-node-" + nextRuleNodeId;
      nextRuleNodeId += 1;
      return id;
    }

    /* An `ID IS "<key>"` rule pins the result set to one named article - the
       state a short link or a title pick lands in. Nothing ANDed after it can
       narrow anything: it either keeps that one row or drops it to zero. So the
       + buttons go dead while such a rule is live. A NOT'd ID rule is the
       opposite case (one article excluded from a set), and still wants more
       conditions, so it doesn't count. */
    function idRulePinned() { return pinnedArticleId() !== null; }
    // The article a lone, positive ID IS rule pins the list to; null otherwise.
    function pinnedArticleId() {
      const live = ruleTree.rows.filter(function (r) { return !r.disabled && String(r.value || "").trim() !== ""; });
      if (live.length !== 1) return null;
      const r = live[0];
      return r.field === FIELDS.ID && r.operator === "is" && !ruleLanguage.rowIsNegated(r) ? String(r.value).trim() : null;
    }

    // Applied to the live buttons rather than baked in at build time: a value
    // edit commits without re-rendering (to keep the caret), so typing a key in
    // and clearing it back out both have to move the + state.
    function syncAddButtons() {
      const pinned = idRulePinned();
      const container = document.getElementById("ruleBuilderContainer");
      if (!container) return;
      const label = pinned
        ? "One article is pinned by ID - a further condition can only drop it, never narrow it"
        : "Add a condition below";
      container.querySelectorAll(".rule-add").forEach(function (btn) {
        if (btn.disabled !== pinned) btn.disabled = pinned;
        if (btn.title !== label) {
          btn.title = label;
          btn.setAttribute("aria-label", label);
        }
      });
    }

    function makeRule() {
      return {
        id: makeRuleNodeId(),
        connector: "AND",          // this row's join; ignored on the first row
        negated: false,
        openParens: 0,
        openNegations: [],
        field: "keyword",
        operator: "is",
        value: "",
        closeParens: 0
      };
    }


    // The database spans 1997-02 (earliest indexed paper) to the current
    // month: the date slider's range. The current month is read live so the
    // upper bound never goes stale.
    const DATE_MIN_YM = "1997-02";
    function currentYM() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }
    // The store's month arithmetic; NaN (not null) for an unreadable month, as
    // the slider maths here expects.
    function ymToIndex(ym) {
      const m = window.OAArticleStore.monthOf(ym);
      return m == null ? NaN : m;
    }
    function indexToYm(i) {
      return window.OAArticleStore.monthLabel(i);
    }

    let lastRuleParseError = null;
    let invalidUrlQuery = null;

    /* The rule rows as they were when they last COMPILED. The editor's rows are
       a draft: mid-edit they can be unbalanced, and a failed compile leaves the
       previous predicate narrowing the table. The shareable URL and the crumb's
       short link are built from this snapshot instead of the draft, so a copied
       link reproduces what the reader is actually looking at rather than an
       expression that was never applied. null = nothing compiled yet (init). */
    let appliedRuleRows = null;
    function cloneRuleRows(rows) {
      return ruleLanguage.cloneRows(rows || []);
    }
    // What the URL and short link describe: the applied snapshot, falling back
    // to the draft before the first compile.
    function urlRuleRows() {
      return appliedRuleRows || ruleTree.rows;
    }

    function scheduleRuleUpdate() {
      if (destroyed) return;
      if (ruleUpdateTimer !== null) {
        window.clearTimeout(ruleUpdateTimer);
      }

      ruleUpdateTimer = window.setTimeout(function () {
        ruleUpdateTimer = null;
        if (!destroyed) dependencies.onApply();
      }, 120);
    }

    function updateAfterRuleChange(shouldRerender = true) {
      if (destroyed) return;
      invalidUrlQuery = null;
      lastRuleParseError = null;
      if (ruleUpdateTimer !== null) { window.clearTimeout(ruleUpdateTimer); ruleUpdateTimer = null; }
      if (shouldRerender) {
        renderRuleBuilder();
        dependencies.onApply();
        dependencies.onResize();
        return;
      }

      // Value edits skip the re-render to keep the caret, so the + state has to
      // be re-synced by hand - typing or clearing a key both flip it.
      syncAddButtons();
      scheduleRuleUpdate();
    }
    // Facet menus mounted on rule-row value inputs (see buildRuleRow), released
    // whenever the rows are rebuilt.
    var ruleFacetMenus = [];
    // Structural edits rebuild every control, which would throw keyboard focus
    // out of the builder (the focused select/button is the one being removed).
    // Focus is identified as (row id, control role) before the rebuild and put
    // back on the equivalent control afterwards; an edit may also request a
    // specific target first (a new row's field, the row after a deletion).
    var pendingFocus = null;
    const RULE_CONTROL_ROLES = ["rule-move", "rule-connector", "rule-paren-open", "rule-field", "rule-operator", "rule-value", "rule-paren-close", "rule-toggle", "rule-delete", "rule-add"];
    function cssValue(value) { return String(value).replace(/["\\]/g, "\\$&"); }
    function focusIdentity(el) {
      const container = document.getElementById("ruleBuilderContainer");
      if (!el || !container || !container.contains(el)) return null;
      const cell = el.closest(".rule-cell") || el;
      const rowEl = el.closest(".rule-row");
      let role = null;
      for (const r of RULE_CONTROL_ROLES) { if (cell.classList.contains(r)) { role = r; break; } }
      if (!role && el.closest(".rule-value")) role = "rule-value";
      const rows = Array.from(container.querySelectorAll(".rule-row"));
      return { rowId: rowEl ? rowEl.dataset.rowId : null, index: rowEl ? rows.indexOf(rowEl) : -1, role: role };
    }
    function focusTargetIn(rowEl, role) {
      if (!rowEl) return null;
      const order = RULE_CONTROL_ROLES;
      // Same role first; when it no longer exists on this row (an operator that
      // became a static label) fall through to the next control in row order.
      let start = role ? order.indexOf(role) : 0;
      if (start < 0) start = 0;
      for (let i = start; i < order.length; i++) {
        const cell = rowEl.querySelector("." + order[i]);
        if (!cell) continue;
        const target = cell.matches("button, input, select, [tabindex]") ? cell : cell.querySelector("select, input, button, [tabindex]");
        if (target && !target.disabled) return target;
      }
      return rowEl.querySelector("select, input, button");
    }
    function restoreFocus(request) {
      if (!request) return;
      const container = document.getElementById("ruleBuilderContainer");
      if (!container) return;
      const rows = Array.from(container.querySelectorAll(".rule-row"));
      if (!rows.length) return;
      let rowEl = request.rowId ? container.querySelector('.rule-row[data-row-id="' + cssValue(request.rowId) + '"]') : null;
      // The row is gone (deleted): the row now at its index, else the last one.
      if (!rowEl && request.index != null && request.index >= 0) rowEl = rows[Math.min(request.index, rows.length - 1)];
      if (!rowEl) return;
      const target = focusTargetIn(rowEl, request.role);
      if (target) target.focus({ preventScroll: true });
    }
    // The author boxes' width: the longest author name in the set, measured once
    // in the box's own font (again once web fonts have loaded) and kept on the
    // container as --rule-author-w. Only the longest names by length are
    // measured - the widest rendering is among them.
    const AFF_GLYPH = '<svg class="rule-aff-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 21l18 0"></path><path d="M3 10l18 0"></path><path d="M5 6l7 -3l7 3"></path><path d="M4 10l0 11"></path><path d="M20 10l0 11"></path><path d="M8 14l0 3"></path><path d="M12 14l0 3"></path><path d="M16 14l0 3"></path></svg>';
    let authorBoxWidth = 0, authorFontsHooked = false;
    function syncAuthorWidth(container) {
      const input = container && container.querySelector(".rule-value-author input");
      if (!input) return;
      if (!authorBoxWidth) {
        const labels = Array.from(dependencies.authorLabels(), String);
        if (!labels.length) return;
        const longest = labels.reduce(function (n, l) { return Math.max(n, l.length); }, 0);
        const cs = getComputedStyle(input);
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(" ");
        let max = 0;
        labels.forEach(function (l) { if (l.length >= longest * 0.8) max = Math.max(max, ctx.measureText(l).width); });
        authorBoxWidth = Math.ceil(max + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
          parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 2);
        if (!authorFontsHooked && document.fonts && document.fonts.status !== "loaded") {
          authorFontsHooked = true;
          document.fonts.ready.then(function () {
            if (destroyed) return;
            authorBoxWidth = 0;
            syncAuthorWidth(document.getElementById("ruleBuilderContainer"));
          });
        }
      }
      container.style.setProperty("--rule-author-w", authorBoxWidth + "px");
    }

    // Rows keep their own AND / OR joins and bracket counts, so a query with
    // groups loads (and round-trips through the URL) exactly as written.
    function renderRuleBuilder() {
      if (destroyed) return;
      const container = document.getElementById("ruleBuilderContainer");
      const focusRequest = pendingFocus || focusIdentity(document.activeElement);
      pendingFocus = null;
      // Rows are rebuilt from scratch: release the facet menus mounted on the
      // old rows first (each owns a document listener), or they would pile up
      // with every structural edit.
      ruleFacetMenus.forEach(function (m) { if (m && m.destroy) m.destroy(); });
      ruleFacetMenus = [];
      container.innerHTML = "";
      const list = document.createElement("div");
      list.className = "rule-list";
      // The list scrolls in a bounded box (CSS .is-tall: a max-height from the
      // viewport) so the toolbar can never grow past the fixed viewport and
      // starve the grid - on a phone even three wrapped rows can. The class is
      // on whenever there is more than one row; the CSS decides if it clips.
      container.classList.toggle("is-tall", ruleTree.rows.length > 1);
      ruleTree.rows.forEach(function (row, k) { list.appendChild(buildRuleRow(row, k)); });
      container.appendChild(list);
      syncAuthorWidth(container);
      // Every render path lands here, boot-from-URL included, so the + state is
      // decided once here rather than per call site.
      syncAddButtons();
      restoreFocus(focusRequest);
    }

    // Drop every condition. Confirms only when there's enough state to make an
    // accidental loss costly, and pushes a history entry first so Back still
    // rewinds (updateUrlBar uses replaceState, which would otherwise overwrite
    // the pre-clear URL). Shared by the toolbar's x and the empty state.
    function clearAllRules() {
      const n = ruleTree.rows.length;
      const doClear = function () {
        if (destroyed) return false;
        // No pushState here: nothing listens to popstate, so a history entry
        // only made Back change the URL while the table stayed cleared.
        ruleTree.rows = [];
        updateAfterRuleChange();
        return true;
      };
      if (n > 2) {
        return window.OADialog.confirmDialog({
          title: "Clear all " + n + " conditions?",
          confirmLabel: "Clear all",
          danger: true
        }).then(function (ok) { return ok ? doClear() : false; });
      }
      return Promise.resolve(doClear());
    }

    // Replace the whole rule set with the given field/operator/value triples in
    // one step, no confirm - the author panel's exclusive pick (author + one
    // relation) is a deliberate replacement, not a wipe.
    function replaceRules(picks) {
      ruleTree.rows = [];
      (picks || []).forEach(function (p) {
        const rule = makeRule();
        rule.field = p.field;
        rule.operator = p.operator || "is";
        rule.value = p.value;
        ruleTree.rows.push(rule);
      });
      updateAfterRuleChange();
      revealAfterPick();
    }

    // Join cell: AND / OR joins this row to the one above; NOT negates just
    // this condition. The first row joins nothing.
    function makeJoinSelect(name, k, negated, onPick) {
      const cw = makeSelectCell("rule-connector", name);
      const options = k === 0
        ? [["", ""], ["NOT", "NOT"]]
        : [["AND", "AND"], ["AND NOT", "NOT"], ["OR", "OR"], ["OR NOT", "OR NOT"]];
      options.forEach(function (o) {
        const option = document.createElement("option");
        option.value = o[0];
        option.textContent = o[1];
        cw.select.appendChild(option);
      });
      const logic = rowLogicAt(k);
      cw.select.value = k === 0 ? (negated ? "NOT" : "") : logic + (negated ? " NOT" : "");
      cw.select.addEventListener("change", function () {
        const v = cw.select.value;
        onPick(k === 0 ? null : v.indexOf("OR") === 0 ? "OR" : "AND", /NOT$/.test(v));
      });
      return cw.wrap;
    }

    function rowLogicAt(k) {
      const row = ruleTree.rows[k];
      return row && row.connector === "OR" ? "OR" : "AND";
    }

    // Bracket cell: how many groups open before this condition ("(") or close
    // after it (")"). Unbalanced brackets are flagged in the expression bar and
    // the last valid filter stays applied until they balance.
    const MAX_PARENS = 3;
    function makeParenSelect(kind, row, rowName) {
      const open = kind === "open";
      const glyph = open ? "(" : ")";
      const count = Math.max(0, (open ? row.openParens : row.closeParens) | 0);
      const cw = makeSelectCell("rule-paren " + (open ? "rule-paren-open" : "rule-paren-close"),
        rowName + (open ? " opening brackets" : " closing brackets"));
      for (let n = 0; n <= Math.max(MAX_PARENS, count); n++) {
        const option = document.createElement("option");
        option.value = String(n);
        option.textContent = n ? glyph.repeat(n) : "";
        cw.select.appendChild(option);
      }
      cw.select.value = String(count);
      cw.wrap.dataset.glyph = glyph;
      cw.wrap.classList.toggle("is-empty", count === 0);
      cw.select.title = open ? "Open a group before this condition" : "Close a group after this condition";
      cw.select.addEventListener("change", function () {
        const n = Math.max(0, parseInt(cw.select.value, 10) || 0);
        if (open) {
          const negs = (row.openNegations || []).slice(0, n);
          while (negs.length < n) negs.push(false);
          row.openParens = n;
          row.openNegations = negs;
        } else {
          row.closeParens = n;
        }
        pendingFocus = { rowId: row.id, index: -1, role: open ? "rule-paren-open" : "rule-paren-close" };
        updateAfterRuleChange();
      });
      return cw.wrap;
    }

    function buildRuleRow(row, k) {
      const rowEl = document.createElement("div");
      rowEl.className = "rule-row" + (row.disabled ? " rule-row-off" : "");
      rowEl.dataset.rowId = row.id;
      attachRowDragHandlers(rowEl);
      appendRowCells(rowEl, row, k);
      return rowEl;
    }

    /* ---------------------------------------------------------------- */
    /* Drag-and-drop. Initiated from the row's "move" handle (the grip), */
    /* the only draggable=true child; the drag image is the whole row.   */
    /* ---------------------------------------------------------------- */

    function attachRowDragHandlers(rowEl) {
      rowEl.addEventListener("dragover", function (event) {
        // Allow drop. The "drag-over-top" / "drag-over-bottom" class
        // tells the user where the row will land.
        if (!isReorderDrag(event)) {
          return;
        }
        event.preventDefault();
        const rect = rowEl.getBoundingClientRect();
        const isAbove = (event.clientY - rect.top) < rect.height / 2;
        rowEl.classList.toggle("drag-over-top",    isAbove);
        rowEl.classList.toggle("drag-over-bottom", !isAbove);
      });

      rowEl.addEventListener("dragleave", function () {
        rowEl.classList.remove("drag-over-top", "drag-over-bottom");
      });

      rowEl.addEventListener("drop", function (event) {
        if (!isReorderDrag(event)) {
          return;
        }
        event.preventDefault();

        const sourceId = event.dataTransfer.getData("application/x-rule-row");
        rowEl.classList.remove("drag-over-top", "drag-over-bottom");
        if (!sourceId) {
          return;
        }

        const rows = ruleTree.rows;
        const from = rows.findIndex(function (r) { return r.id === sourceId; });
        const target = rows.find(function (r) { return r.id === rowEl.dataset.rowId; });
        if (from < 0 || !target || rows[from] === target) {
          return;
        }
        const rect = rowEl.getBoundingClientRect();
        const isAbove = (event.clientY - rect.top) < rect.height / 2;
        const moved = rows.splice(from, 1)[0];
        rows.splice(rows.indexOf(target) + (isAbove ? 0 : 1), 0, moved);
        updateAfterRuleChange();
      });
    }

    function isReorderDrag(event) {
      // Only handle drags we started; lets the browser still handle
      // file drops or text drag-selection on inputs.
      const types = event.dataTransfer && event.dataTransfer.types;
      if (!types) {
        return false;
      }
      return Array.prototype.indexOf.call(types, "application/x-rule-row") >= 0;
    }

    // Wrap a <select> in a <span> that owns the row-cell grid slot and
    // paints the chevron via a ::after pseudo-element. The earlier
    // background-image SVG approach was fragile -- any more-specific
    // `background:` shorthand rule could clobber it. Using a text-content
    // chevron on a wrapper element sidesteps appearance/background battles
    // entirely.
    function makeSelectCell(extraClass, accessibleName) {
      const wrap = document.createElement("span");
      wrap.className =
        "rule-cell rule-select-wrap" + (extraClass ? " " + extraClass : "");
      const select = document.createElement("select");
      select.className = "rule-select-inner";
      // Every select in a rule row carries its own name. Without one, a screen
      // reader announced three anonymous combo boxes per condition and the
      // reader had to infer field/operator/value from position.
      if (accessibleName) {
        select.setAttribute("aria-label", accessibleName);
        if (!select.title) select.title = accessibleName;
      }
      wrap.appendChild(select);
      return { wrap: wrap, select: select };
    }

    // Eye / eye-off glyphs for the row's on/off toggle (Tabler outline icons).
    const RULE_ICON_EYE =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>' +
      '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path></svg>';
    const RULE_ICON_EYE_OFF =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"></path>' +
      '<path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"></path>' +
      '<path d="M3 3l18 18"></path></svg>';

    // Append the cells for one row directly to its grid.
    // Cells, in order: move, join, (, field, op, value, ), count, eye, x, +.
    function appendRowCells(grid, row, k) {
      // Names for this row's controls: "Condition 2 field" etc, so each select
      // identifies both what it sets and which condition it belongs to.
      const rowName = "Condition " + (ruleTree.rows.indexOf(row) + 1);
      // 0) Drag handle. The handle is the only draggable=true element
      // in the row; dragstart sets the drag image to the row so the
      // preview shows the whole row being moved, not just the grip.
      const move = document.createElement("span");
      move.className = "rule-cell rule-move";
      move.setAttribute("draggable", "true");
      // U+22EE (vertical ellipsis), not the braille grip U+2807: the braille
      // glyph puts its ink in the left half of its advance width, so it looks
      // off-centre inside the outlined box however the box is centred.
      move.textContent = "\u22ee";              // 3-dot vertical grip
      move.title = "Drag to reorder \u00b7 or focus and press \u2191 / \u2193";
      // Keyboard (and touch, via a focused handle) alternative to drag: Arrow
      // Up / Down move the condition one place; focus follows the row.
      move.setAttribute("tabindex", "0");
      move.setAttribute("role", "button");
      move.setAttribute("aria-label", rowName + ": move \u00b7 press up or down arrow to reorder");
      move.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const rows = ruleTree.rows, at = rows.indexOf(row);
        const to = at + (event.key === "ArrowUp" ? -1 : 1);
        if (at < 0 || to < 0 || to >= rows.length) return;
        rows.splice(at, 1);
        rows.splice(to, 0, row);
        pendingFocus = { rowId: row.id, index: -1, role: "rule-move" };
        updateAfterRuleChange();
      });

      move.addEventListener("dragstart", function (event) {
        event.dataTransfer.setData("application/x-rule-row", row.id);
        event.dataTransfer.effectAllowed = "move";
        // Use the parent row as the drag image (not just the small grip).
        if (event.dataTransfer.setDragImage) {
          const rect = grid.getBoundingClientRect();
          event.dataTransfer.setDragImage(
            grid,
            event.clientX - rect.left,
            event.clientY - rect.top
          );
        }
        grid.classList.add("rule-row-dragging");
      });
      move.addEventListener("dragend", function () {
        grid.classList.remove("rule-row-dragging");
        // Defensive: clear any indicators left on other rows if the drop
        // happened outside any drop target (e.g. released over page chrome).
        const container = document.getElementById("ruleBuilderContainer");
        if (container) {
          for (const r of container.querySelectorAll(".rule-row")) {
            r.classList.remove("drag-over-top", "drag-over-bottom");
          }
        }
      });

      grid.appendChild(move);

      // 1) Join and condition negation (see makeJoinSelect).
      grid.appendChild(makeJoinSelect(rowName + " join and condition negation", k, !!row.negated, function (logic, negated) {
        row.negated = negated;
        if (logic) row.connector = logic;
        pendingFocus = { rowId: row.id, index: -1, role: "rule-connector" };
        updateAfterRuleChange();
      }));

      // 1b) Opening brackets.
      grid.appendChild(makeParenSelect("open", row, rowName));

      // 2) Field select.
      const fw = makeSelectCell("rule-field", rowName + " field");
      const fieldSelect = fw.select;
      for (const field of Object.keys(ruleFieldDefinitions)) {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = ruleFieldDefinitions[field].label.toUpperCase();
        fieldSelect.appendChild(option);
      }
      fieldSelect.value = row.field;
      fieldSelect.addEventListener("change", function () {
        row.field = fieldSelect.value;
        row.operator = ruleFieldDefinitions[row.field].operators[0];
        row.value = "";
        delete row.value2;                  // only meaningful for DATE BETWEEN
        updateAfterRuleChange();
      });
      grid.appendChild(fw.wrap);

      // 3) Operator: a dropdown, or a static label for fields that support only
      //    one operator (the boolean OPEN_ACCESS / IS_FAVORITE fields) - a
      //    single-option dropdown gives the user nothing to choose.
      const operatorChoices = ruleFieldDefinitions[row.field].operators;
      if (operatorChoices.length <= 1) {
        if (!row.operator) row.operator = operatorChoices[0];
        const opStatic = document.createElement("span");
        opStatic.className = "rule-cell rule-operator rule-operator-static";
        opStatic.textContent =
          ruleFieldDefinitions[row.field].operatorLabel ||
          DROPDOWN_OPERATOR_LABELS[operatorChoices[0]] ||
          operatorChoices[0].toUpperCase();
        grid.appendChild(opStatic);
      } else {
        const ow = makeSelectCell("rule-operator", rowName + " condition");
        const operatorSelect = ow.select;
        for (const operator of operatorChoices) {
          const option = document.createElement("option");
          option.value = operator;
          option.textContent =
            DROPDOWN_OPERATOR_LABELS[operator] || operator.toUpperCase();
          operatorSelect.appendChild(option);
        }
        operatorSelect.value = row.operator;
        operatorSelect.addEventListener("change", function () {
          row.operator = operatorSelect.value;
          // Seed value2 when entering BETWEEN, drop it when leaving so the
          // serialized expression doesn't carry orphan state.
          if (row.operator === "between" && row.field === FIELDS.DATE) {
            // The slider seeds an empty range across the whole coverage.
            row.value = "";
            row.value2 = "";
          } else if (row.operator === "between" && !row.value2) {
            row.value2 = row.value;
          }
          if (row.operator !== "between") {
            delete row.value2;
          }
          updateAfterRuleChange();
        });
        grid.appendChild(ow.wrap);
      }

      // 4) Value input (autocomplete / text / number / boolean).
      const valueInput = makeRuleValueInput(row);
      valueInput.classList.add("rule-cell");
      grid.appendChild(valueInput);

      // 4b) Closing brackets.
      grid.appendChild(makeParenSelect("close", row, rowName));

      // 5) On/off toggle. Takes the condition out of the filter without
      // deleting it: the row stays (dimmed) and the URL keeps it as SKIP, so
      // it can be switched back on later - or shared in its parked state.
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "rule-cell rule-toggle";
      toggle.innerHTML = row.disabled ? RULE_ICON_EYE_OFF : RULE_ICON_EYE;
      toggle.setAttribute("aria-pressed", row.disabled ? "true" : "false");
      toggle.title = row.disabled
        ? "Condition is off \u00b7 click to switch it back on"
        : "Switch this condition off (keeps it for later)";
      toggle.setAttribute("aria-label", toggle.title);
      toggle.addEventListener("click", function () {
        if (row.disabled) delete row.disabled; else row.disabled = true;
        updateAfterRuleChange();
      });
      grid.appendChild(toggle);

      // 7) Delete button.
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "rule-cell rule-delete";
      deleteButton.textContent = "\u00D7";
      deleteButton.setAttribute("aria-label", "Delete row");
      deleteButton.title = "Delete row";
      deleteButton.addEventListener("click", function () {
        const at = ruleTree.rows.findIndex(r => r.id === row.id);
        if (at >= 0) removeRowAt(at);
        // Focus lands on the delete button of the row that takes this place
        // (or the last row), so repeated deletions stay on the keyboard.
        pendingFocus = { rowId: null, index: at, role: "rule-delete" };
        updateAfterRuleChange();
        // Deleting the last row leaves nothing to edit: close the builder
        // instead of parking the reader on an empty "No Rule Filter" panel
        // (the toggle re-opens it with a fresh blank condition).
        if (ruleTree.rows.length === 0) {
          setRuleBuilderOpen(false);
          const toggle = document.getElementById("ruleBuilderToggle");
          if (toggle) toggle.focus({ preventScroll: true });
        }
      });
      grid.appendChild(deleteButton);

      // 8) Add. Inserts a fresh condition directly BELOW this row, in its
      // group, so a query is built where the reader is looking.
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "rule-cell rule-add";
      addButton.textContent = "\uFF0B";           // fullwidth plus, matches the x's weight
      addButton.setAttribute("aria-label", "Add a condition below");
      addButton.title = "Add a condition below";
      addButton.addEventListener("click", function () {
        const at = ruleTree.rows.indexOf(row);
        const fresh = makeRule();
        ruleTree.rows.splice(at < 0 ? ruleTree.rows.length : at + 1, 0, fresh);
        pendingFocus = { rowId: fresh.id, index: -1, role: "rule-field" };
        updateAfterRuleChange();
      });
      grid.appendChild(addButton);
    }

    function makeRuleValueInput(rule) {
      const definition = ruleFieldDefinitions[rule.field];

      // Date: a month slider over the database's coverage (DATE_MIN_YM .. the
      // current month). BETWEEN gets two handles. The accent fill marks the
      // months the rule keeps: right of the handle for >=, left of it for <=,
      // between the handles for BETWEEN, everything but the handle for !=, and
      // the handle alone for =. The readouts show the picked month(s).
      if (rule.field === FIELDS.DATE) return makeMonthSlider(rule);

      function makeMonthSlider(rule) {
        const minIdx = ymToIndex(DATE_MIN_YM);
        const maxIdx = ymToIndex(currentYM());
        const span = Math.max(1, maxIdx - minIdx);
        const between = rule.operator === "between";
        function clampIdx(i) { return Math.max(minIdx, Math.min(maxIdx, i)); }
        function parse(v, fallback) { return isValidYYYYMM(String(v || "")) ? clampIdx(ymToIndex(v)) : fallback; }
        // Empty values get a starting point that keeps everything: >= at the
        // first month, <= at the latest, BETWEEN across the lot - committed, so
        // the expression shows the rule. = and != have no such point (= is the
        // Date field's default operator, and any month would narrow the table),
        // so they stay unset - rule inactive - until the handle is moved.
        const seedLo = rule.operator === ">=" || between ? minIdx : maxIdx;
        const vals = [parse(rule.value, seedLo)];
        if (between) vals.push(parse(rule.value2, maxIdx));
        if (between && vals[0] > vals[1]) vals.reverse();
        const seeded = !isValidYYYYMM(String(rule.value || "")) || (between && !isValidYYYYMM(String(rule.value2 || "")));
        let unset = seeded && (rule.operator === "=" || rule.operator === "!=");

        const wrap = document.createElement("span");
        wrap.className = "rule-cell rule-value rule-month-slider";
        wrap.setAttribute("data-op", rule.operator);
        const readLo = document.createElement("span");
        readLo.className = "rule-ms-read";
        const readSep = document.createElement("span");
        readSep.className = "rule-ms-read-sep";
        readSep.textContent = "\u2013";
        const readBox = document.createElement("span");
        readBox.className = "rule-ms-readout";
        readBox.setAttribute("aria-hidden", "true");
        readBox.appendChild(readLo);
        const track = document.createElement("span");
        track.className = "rule-ms-track";
        const fills = [document.createElement("span"), document.createElement("span")];
        fills.forEach(function (f) { f.className = "rule-ms-fill"; track.appendChild(f); });
        const labels = between ? ["Start month", "End month"] : ["Month"];
        const thumbs = vals.map(function (_, k) {
          const t = document.createElement("span");
          t.className = "rule-ms-thumb";
          t.tabIndex = 0;
          t.setAttribute("role", "slider");
          t.setAttribute("aria-label", labels[k]);
          t.setAttribute("aria-valuemin", String(minIdx));
          t.setAttribute("aria-valuemax", String(maxIdx));
          track.appendChild(t);
          return t;
        });
        wrap.appendChild(readBox);
        wrap.appendChild(track);
        let readHi = null;
        if (between) {
          readHi = document.createElement("span");
          readHi.className = "rule-ms-read";
          readBox.appendChild(readSep);
          readBox.appendChild(readHi);
        }

        function pct(i) { return ((i - minIdx) / span) * 100; }
        function paint() {
          thumbs.forEach(function (t, k) {
            t.style.left = pct(vals[k]) + "%";
            t.setAttribute("aria-valuenow", String(vals[k]));
            t.setAttribute("aria-valuetext", indexToYm(vals[k]));
          });
          const a = pct(vals[0]), b = between ? pct(vals[1]) : a;
          let ranges;
          if (between) ranges = [[a, b]];
          else if (rule.operator === ">=") ranges = [[a, 100]];
          else if (rule.operator === "<=") ranges = [[0, a]];
          else if (rule.operator === "!=") ranges = [[0, a], [a, 100]];
          else ranges = [];
          fills.forEach(function (f, k) {
            const r = ranges[k];
            f.hidden = !r;
            if (r) { f.style.left = r[0] + "%"; f.style.width = Math.max(0, r[1] - r[0]) + "%"; }
          });
          wrap.classList.toggle("is-unset", unset);
          if (unset) fills.forEach(function (f) { f.hidden = true; });
          readLo.textContent = unset ? "any month" : indexToYm(vals[0]);
          if (readHi) readHi.textContent = indexToYm(vals[1]);
        }
        // The table re-filters once per settled value: on release for a drag
        // (the handle and readout follow the pointer live), and after a short
        // pause for keys, so holding an arrow does not filter per repeat.
        let pending = 0;
        function commit(now) {
          rule.value = indexToYm(vals[0]);
          if (between) rule.value2 = indexToYm(vals[1]);
          if (pending) { clearTimeout(pending); pending = 0; }
          if (now) { updateAfterRuleChange(false); return; }
          pending = setTimeout(function () { pending = 0; if (!destroyed) updateAfterRuleChange(false); }, 250);
        }
        function setVal(k, i) {
          i = clampIdx(i);
          if (between) i = k === 0 ? Math.min(i, vals[1]) : Math.max(i, vals[0]);
          if (i === vals[k] && !unset) return;
          unset = false;
          vals[k] = i;
          paint();
          if (dragK < 0) commit(false);   // dragging: endDrag commits once
        }
        function idxAt(clientX) {
          const r = track.getBoundingClientRect();
          const f = r.width ? (clientX - r.left) / r.width : 0;
          return clampIdx(Math.round(minIdx + Math.max(0, Math.min(1, f)) * span));
        }
        let dragK = -1;
        track.addEventListener("pointerdown", function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          const i = idxAt(e.clientX);
          // Nearest handle takes the press; on a tie the one the drag heads to.
          dragK = between && Math.abs(i - vals[1]) < Math.abs(i - vals[0]) ? 1 : (between && i > vals[1] ? 1 : 0);
          track.setPointerCapture(e.pointerId);
          thumbs[dragK].focus({ preventScroll: true });
          wrap.classList.add("is-dragging");
          setVal(dragK, i);
        });
        track.addEventListener("pointermove", function (e) {
          if (dragK < 0) return;
          const i = idxAt(e.clientX);
          // Both handles on one month: the drag direction picks which moves,
          // so neither can pin the other in place.
          if (between && vals[0] === vals[1] && i !== vals[0]) dragK = i > vals[0] ? 1 : 0;
          setVal(dragK, i);
        });
        function endDrag() { if (dragK < 0) return; dragK = -1; wrap.classList.remove("is-dragging"); commit(true); }
        track.addEventListener("pointerup", endDrag);
        track.addEventListener("pointercancel", endDrag);
        thumbs.forEach(function (t, k) {
          t.addEventListener("keydown", function (e) {
            let kk = k;
            if (between && vals[0] === vals[1]) {
              // Same for keys: pushing the start up moves the end, and back.
              // Per event only; focus follows the handle that moves.
              const up = e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "End";
              const down = e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === "Home";
              if (kk === 0 && up) kk = 1; else if (kk === 1 && down) kk = 0;
            }
            const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -12, PageUp: 12 }[e.key];
            if (step) setVal(kk, vals[kk] + step);
            else if (e.key === "Home") setVal(kk, minIdx);
            else if (e.key === "End") setVal(kk, maxIdx);
            else return;
            e.preventDefault();
            if (kk !== k) thumbs[kk].focus({ preventScroll: true });
          });
        });
        paint();
        if (seeded && !unset) setTimeout(function () { if (!destroyed) commit(true); }, 0);
        return wrap;
      }

      if (definition.inputType === "autocomplete") {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "rule-cell rule-value";
        // For author, the stored rule.value is the slug; show the proper
        // display name in the input. The slug↔label maps are bidirectional
        // so the conversion round-trips. For other autocomplete fields
        // (keyword, venue) the stored value IS what the user typed.
        const isAuthor = ruleLanguage.AUTHOR_FIELDS.has(rule.field);
        const isCategory = rule.field === FIELDS.CATEGORY;
        input.value = isAuthor
          ? (dependencies.authorLabel(rule.value) || rule.value)
          : rule.value;
        input.placeholder = definition.placeholder || (definition.label + "...");
        input.setAttribute("aria-label", definition.label + " value");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        // Two people can share a display name; only the slug tells them apart.
        // While the text still reads as the held author's name, keep that
        // author rather than resolving the name afresh (which would match both).
        let heldSlug = isAuthor && dependencies.authorLabel(rule.value) ? rule.value : "";
        const authorValue = function (text) {
          if (heldSlug && normalizeText(text) === normalizeText(dependencies.authorLabel(heldSlug) || "")) return heldSlug;
          const slug = dependencies.authorSlug(normalizeText(text));
          if (slug) heldSlug = slug;
          return slug || text;
        };

        // Author boxes carry the author's affiliation after the name (the box is
        // as wide as the longest name: syncAuthorWidth). The wrapper is the row's
        // value cell; nothing shows while the text names no known author.
        let wrap = null, aff = null;
        const paintAff = function () {
          if (!aff) return;
          const typed = normalizeText(input.value);
          const slug = (typed && dependencies.authorSlug(typed)) || (dependencies.authorLabel(rule.value) ? rule.value : "");
          const text = slug ? dependencies.authorAffiliation(slug) : null;
          aff.hidden = text == null;
          aff.title = text ? "Affiliation: " + text : "";
          aff.innerHTML = text == null ? "" : '<span class="rule-aff-box" aria-hidden="true">' + AFF_GLYPH + "</span>" +
            '<span class="rule-aff-t' + (text ? "" : " rule-aff-none") + '">' + escapeHtml(text || "No affiliation recorded") + "</span>";
        };
        if (isAuthor) {
          wrap = document.createElement("span");
          wrap.className = "rule-cell rule-value rule-value-author";
          input.className = "rule-cell";
          aff = document.createElement("span");
          aff.className = "rule-aff";
          wrap.appendChild(input);
          wrap.appendChild(aff);
          input.addEventListener("input", paintAff);
          input.addEventListener("change", paintAff);
          paintAff();
        }

        // Suggestions come from the same facet menu the search box uses (counts,
        // diacritic folding, keyboard, styled in both schemes), scoped to this
        // one field - the native <datalist> it replaces could do none of that.
        // Mounted on first focus: rule rows are rebuilt on every structural
        // change, so nothing is built for rows nobody touches.
        const FACET_KEY = { keyword: "keywords", author: "authors", citesAuthor: "authors", citedByAuthor: "authors", venue: "venues", category: "categories",
          id: "titles", references: "titles", citedBy: "titles", similarTo: "titles" };
        const facetKey = FACET_KEY[rule.field];
        // Article fields (ID and the three graph rules) store a BibTeX key, but
        // nobody remembers keys: the menu searches TITLES (key on the sub line)
        // and a pick writes the key into the box. A typed key still works.
        const isArticle = facetKey === "titles";
        if (facets && facetKey) {
          let scoped = null;
          const mount = function () {
            if (scoped) return scoped;
            const rowEl = input.closest(".rule-row") || input.parentElement;
            scoped = facets.init({
              input: input,
              anchor: rowEl,
              alignTo: input,
              mode: "value",
              fields: [facetKey],
              minChars: function () { return isArticle ? 2 : 1; },
              sources: dependencies.facetSources,
              apply: function (r) {
                if (isAuthor) {
                  input.value = r.label || r.value;
                  rule.value = r.value;                  // the slug
                  paintAff();
                } else if (isCategory) {
                  input.value = String(r.value).toUpperCase();
                  rule.value = input.value;
                } else {
                  input.value = r.value;
                  rule.value = r.value;
                }
                updateAfterRuleChange(false);
              }
            });
            ruleFacetMenus = ruleFacetMenus || [];
            ruleFacetMenus.push(scoped);
            return scoped;
          };
          input.addEventListener("focus", function () {
            const m = mount();
            // Open on focus with the biggest values of this field - the row is
            // a form the reader is filling in, so the list IS the prompt. (No
            // "biggest" titles exist: the article menu waits for typing.)
            if (m && m.open && !isArticle) m.open();
          });
        } else {
          input.setAttribute("list", definition.datalistId);
        }

        function commit() {
          if (isAuthor) {
            // On commit (blur / picker selection), convert the label to
            // a slug if we recognize it. During keystrokes we only
            // store the raw text so the URL doesn't churn through
            // garbage values like "Mol", "Moll", "Molla" while typing.
            rule.value = authorValue(input.value);
          } else if (isCategory) {
            // Canonical form is the upper-case abbreviation - keep the visible
            // input in step with it so box, expression bar and chips agree.
            rule.value = input.value.trim().toUpperCase();
            if (input.value !== rule.value) input.value = rule.value;
          } else {
            rule.value = input.value;
          }
          updateAfterRuleChange(false);
        }

        input.addEventListener("input", function () {
          if (isAuthor) {
            // Text that names an author stores (and puts in the URL) its slug
            // at once; a partial name stays raw text until it does.
            rule.value = authorValue(input.value);
            updateAfterRuleChange(false);
          } else {
            commit();
          }
        });
        input.addEventListener("change", commit);
        input.addEventListener("blur", commit);

        return wrap || input;
      }

      if (definition.inputType === "enum") {
        const ew = makeSelectCell("rule-value", definition.label + " value");
        const select = ew.select;
        const opts = definition.options || [];
        opts.forEach(function (opt) {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });
        // Empty new rows use the first choice. Unknown imported values stay
        // visible and invalid instead of silently becoming another filter.
        const match = opts.filter(function (o) {
          return o.value.toLowerCase() === String(rule.value || "").trim().toLowerCase();
        })[0];
        if (match) rule.value = match.value;
        else if (!rule.value) rule.value = (opts[0] || {}).value || "";
        else {
          const invalid = document.createElement("option");
          invalid.value = rule.value;
          invalid.textContent = "Invalid: " + rule.value;
          select.appendChild(invalid);
          select.setAttribute("aria-invalid", "true");
        }
        select.value = rule.value;
        select.addEventListener("change", function () {
          rule.value = select.value;
          updateAfterRuleChange();
        });
        return ew.wrap;
      }

      if (definition.inputType === "boolean") {
        const bw = makeSelectCell("rule-value", definition.label + " value");
        const select = bw.select;

        for (const value of ["true", "false"]) {
          const option = document.createElement("option");
          option.value = value;                   // stored value stays lowercase
          option.textContent = value.toUpperCase();
          select.appendChild(option);
        }

        if (rule.value === "") {
          rule.value = "true";
        }

        select.value = rule.value;

        select.addEventListener("change", function () {
          rule.value = select.value;
          updateAfterRuleChange();
        });

        return bw.wrap;
      }

      const input = document.createElement("input");
      input.type = definition.inputType;
      input.className = "rule-cell rule-value";
      input.value = rule.value;
      input.setAttribute("aria-label", definition.label + " value");
      if (definition.placeholder) input.placeholder = definition.placeholder;

      input.addEventListener("input", function () {
        rule.value = input.value;
        updateAfterRuleChange(false);
      });

      input.addEventListener("change", function () {
        rule.value = input.value;
        updateAfterRuleChange(false);
      });

      return input;
    }

    // Display labels for the rule expression. The internal operator key
    // (the LHS of these maps) goes back to the canonical keyword the
    // parser accepts, so the rule expression matches the URL byte for byte.
    const OPERATOR_SYMBOLS = ruleLanguage.OPERATOR_SYMBOLS;

    // The operator <select> reads the same labels, except that DATE's "="/"!="
    // show as IS/IS_NOT (easier to read than EQ/NEQ) even though the expression
    // bar and the URL still serialize EQ/NEQ.
    const DROPDOWN_OPERATOR_LABELS = Object.assign(
      {}, OPERATOR_SYMBOLS, { "=": "IS", "!=": "IS_NOT" }
    );
    // Field key -> the uppercase syntax token. One table for the expression bar
    // and the serialized query, so the two can never drift apart.
    const FIELD_TOKEN = ruleLanguage.FIELD_TOKEN;
    const BOOL_RULE_FIELDS = ruleLanguage.BOOLEAN_FIELDS;
    // Fields whose value round-trips through quotes in both media.
    const QUOTED_RULE_FIELDS = new Set([FIELDS.KEYWORD, FIELDS.AUTHOR, FIELDS.CITES_AUTHOR, FIELDS.CITED_BY_AUTHOR, FIELDS.VENUE, FIELDS.TITLE]);

    // Tooltip titles read like the table's: CO2 -> CO₂ (oa-typeset.js).
    function typesetTitle(s) { return window.OATypeset.text(s); }

    // Wrap a symbol in a span so the CSS can color it like a link.
    // Unmapped operators (the numeric =, !=, >=, <=) are shown as-is.
    function operatorHtml(operator) {
      const symbol = OPERATOR_SYMBOLS[operator] || operator;
      return '<span class="rule-op">' + escapeHtml(symbol) + "</span>";
    }

    function logicHtml(logic) {
      return '<span class="rule-op">' + escapeHtml(logic) + "</span>";
    }

    function expressionForRow(row) {
      if (String(row.value || "").trim() === "") {
        return "";
      }

      const field = row.field;
      const head = "<strong>" +
        escapeHtml(FIELD_TOKEN[field] || field.toUpperCase()) + "</strong> ";
      let value = String(row.value);

      if (field === FIELDS.DATE) {
        if (row.operator === "between") {
          const end = String(row.value2 || "").trim();
          if (end === "") return "";   // incomplete range -> not shown yet
          return head + operatorHtml("between") +
            " " + escapeHtml(value) +
            " " + logicHtml("AND") +
            " " + escapeHtml(end);
        }
        return head + operatorHtml(row.operator) + " " + escapeHtml(value);
      }
      if (BOOL_RULE_FIELDS.has(field)) {
        return head + operatorHtml("is") + " " + escapeHtml(value.toUpperCase());
      }
      if (RELATION_FIELDS.has(field)) {
        // Unary; the key stays the visible handle, the title rides in the tooltip.
        const art = dependencies.lookupArticle(value.trim());
        return head + '<span title="' + escapeHtml(art && art.title ? typesetTitle(art.title) : "") + '">' +
          escapeHtml(quoteValue(value.trim())) + "</span>";
      }

      const op = operatorHtml(row.operator);
      // The author rule stores a slug; show the display name it resolves to.
      if (ruleLanguage.AUTHOR_FIELDS.has(field)) {
        value = dependencies.authorLabel(value) || value;
        return head + op + " " + escapeHtml(quoteValue(value));
      }
      if (field === FIELDS.ID) {
        // The key stays legible as the handle it is; the title rides in the tooltip.
        const art = dependencies.lookupArticle(value.trim());
        return head + op + ' <span title="' + escapeHtml(art && art.title ? typesetTitle(art.title) : "") + '">' +
          escapeHtml(quoteValue(value)) + "</span>";
      }
      if (field === FIELDS.VENUE) {
        // Same typographic ordinals ("2nd" etc.) as the venue column/chips.
        return head + op + " " +
          (theme.ordinalHtml || function (s) { return s; })(escapeHtml(quoteValue(value)));
      }
      if (QUOTED_RULE_FIELDS.has(field)) {
        return head + op + " " + escapeHtml(quoteValue(value));
      }
      return head + op + " " + escapeHtml(value);
    }

    // Always wrap a value in double quotes, escaping backslashes and embedded
    // quotes, so the serialized expression round-trips through the tokenizer no
    // matter what the value holds - parentheses, operator symbols (= ~ < >),
    // reserved words (AND / OR / NOT / BETWEEN), apostrophes or quotes. The
    // space-only quoteIfNeeded left all of those bare and unparseable, which
    // silently disabled the filter and produced a shared URL that wouldn't load.
    function quoteValue(value) {
      return ruleLanguage.quoteValue(value);
    }

    // HTML version of the rule expression: bold field names, colored
    // operator/logic spans.  Skips rows with empty values so a half-filled
    // row never produces an orphan connector or unbalanced paren.
    // Per-paren validity check. For each "(" we record whether it is
    // closed somewhere later; for each ")" we record whether it closes
    // an earlier "(". Used to colour unmatched parens red in both the
    // builder rows and the result view.
    function computeParenBalance(rows) {
      const state = rows.map(r => ({
        openValid: new Array(Math.max(0, r.openParens | 0)).fill(false),
        closeValid: new Array(Math.max(0, r.closeParens | 0)).fill(false)
      }));
      const stack = [];        // unmatched opens: { rowIdx, parenIdx }

      for (let r = 0; r < rows.length; r++) {
        const open = Math.max(0, rows[r].openParens | 0);
        const close = Math.max(0, rows[r].closeParens | 0);

        for (let i = 0; i < open; i++) {
          stack.push({ rowIdx: r, parenIdx: i });
        }
        for (let i = 0; i < close; i++) {
          if (stack.length > 0) {
            const m = stack.pop();
            state[m.rowIdx].openValid[m.parenIdx] = true;
            state[r].closeValid[i] = true;
          }
          // else: this ")" is orphan; closeValid stays false
        }
      }

      return { rowState: state };
    }

    // Which parts of the expression a switched-off row takes with it, so the
    // bar strikes exactly what the compiler drops. The condition always; the
    // AND/OR joining it only when its group really loses that connector (AND
    // binds tighter than OR, so in `A OR [B] AND C` the AND after B goes, not
    // the OR before it); a NOT when its whole operand is off; a paren pair when
    // everything inside it is off. Connector/NOT flags come from the parse
    // tree, so they are exact for any nesting; parens are paired positionally.
    function computeOffState(visibleRows) {
      const n = visibleRows.length;
      const off = {
        cond:  visibleRows.map(r => !!r.disabled),
        conn:  new Array(n).fill(false),
        not:   new Array(n).fill(false),
        open:  visibleRows.map(r => new Array(Math.max(0, r.openParens  | 0)).fill(false)),
        close: visibleRows.map(r => new Array(Math.max(0, r.closeParens | 0)).fill(false))
      };
      if (!off.cond.some(Boolean)) {
        return off;
      }

      const stack = [];
      for (let r = 0; r < n; r++) {
        for (let i = 0; i < off.open[r].length; i++) stack.push({ r: r, i: i });
        for (let i = 0; i < off.close[r].length; i++) {
          const m = stack.pop();
          if (!m) continue;                  // orphan ")" - shown red already
          let allOff = true;
          for (let k = m.r; k <= r && allOff; k++) allOff = off.cond[k];
          if (allOff) { off.open[m.r][m.i] = true; off.close[r][i] = true; }
        }
      }

      let tree;
      try {
        tree = parseRuleQuery(rowsToString(visibleRows));
      } catch (err) {
        return off;                          // unparseable: strike conditions only
      }
      // Leaves come out of the parser in text order - one per visible row.
      let leaf = 0;
      function walk(node) {                  // -> { first: row of first leaf, alive }
        if (node.type === "rule") {
          const i = leaf++;
          return { first: i, alive: !off.cond[i] };
        }
        if (node.type === "not") {
          const r = walk(node.child);
          if (!r.alive) off.not[r.first] = true;
          return r;
        }
        const kids = node.children.map(walk);
        let seenAlive = false;
        for (let k = 0; k < kids.length; k++) {
          // The connector before child k goes when k itself is off, or when
          // nothing before k survived (k becomes the group's first operand).
          if (k > 0 && (!kids[k].alive || !seenAlive)) off.conn[kids[k].first] = true;
          if (kids[k].alive) seenAlive = true;
        }
        return { first: kids[0].first, alive: seenAlive };
      }
      walk(tree);
      return off;
    }

    // The empty state's "Turn off X": park the condition (eye off), not delete it.
    function turnOffRow(rowId) {
      const row = ruleTree.rows.find(function (r) { return r.id === rowId; });
      if (!row) return;
      row.disabled = true;
      updateAfterRuleChange();
      setRuleBuilderOpen(true);
    }

    function rowsToHtml(rows) {
      // Same packing as the query string, so the bar's brackets match it.
      const visible = ruleLanguage.packRows(rows, r => expressionForRow(r) !== "")
        .map((r, idx) => ({ row: r, expr: expressionForRow(r), idx: idx }));

      if (visible.length === 0) {
        return "";
      }

      // Balance is computed across the visible rows -- those are the
      // parens that actually appear in the result view.
      const balance = computeParenBalance(visible.map(v => v.row));
      const off = computeOffState(visible.map(v => v.row));

      function parenSpan(char, valid) {
        if (valid) {
          return char;
        }
        return '<span class="rule-paren-error">' + char + "</span>";
      }

      // Tokens carry an off flag; struck runs are merged into one <s> so the
      // line-through runs unbroken across the spaces between them. A space
      // (off: null) is struck only when both its neighbours are.
      const parts = [];
      const push = function (html, isOff) { parts.push({ h: html, off: !!isOff }); };
      const gap  = function () { parts.push({ h: " ", off: null }); };
      for (let i = 0; i < visible.length; i++) {
        const { row, expr } = visible[i];
        const connector = row.connector || "AND";
        if (i === 0) {
          if (connector === "NOT") {
            push(logicHtml("NOT"), off.not[0]); gap();
          }
        } else if (connector === "NOT") {
          gap(); push(logicHtml("AND"), off.conn[i]); gap(); push(logicHtml("NOT"), off.not[i]); gap();
        } else {
          gap(); push(logicHtml(connector), off.conn[i]); gap();
        }
        const opens = Math.max(0, row.openParens | 0);
        const closes = Math.max(0, row.closeParens | 0);
        for (let k = 0; k < opens; k++) {
          if (row.openNegations && row.openNegations[k]) { push(logicHtml("NOT"), off.open[i][k]); gap(); }
          push(parenSpan("(", balance.rowState[i].openValid[k]), off.open[i][k]);
        }
        if (row.negated) { push(logicHtml("NOT"), off.cond[i]); gap(); }
        push(expr, off.cond[i]);
        for (let k = 0; k < closes; k++) {
          push(parenSpan(")", balance.rowState[i].closeValid[k]), off.close[i][k]);
        }
      }
      for (let p = 0; p < parts.length; p++) {
        if (parts[p].off === null) {
          parts[p].off = p > 0 && p < parts.length - 1 &&
            parts[p - 1].off === true && parts[p + 1].off === true;
        }
      }
      let s = "";
      let struck = false;
      for (const p of parts) {
        if (p.off !== struck) {
          s += p.off ? '<s class="rule-off">' : "</s>";
          struck = p.off;
        }
        s += p.h;
      }
      if (struck) s += "</s>";
      return s;
    }

    function updateRuleExpression() {
      const html = rowsToHtml(ruleTree.rows);
      let body = html === "" ? "No Rule Filter" : html;
      if (lastRuleParseError) {
        // A URL that could not be loaded leaves the table unfiltered; an invalid
        // draft leaves the LAST VALID filter applied - say which.
        const kept = lastRuleParseError.indexOf("could not be loaded") === -1;
        body += ' <span class="rule-parse-error" title="' +
          escapeHtml(lastRuleParseError) + '">' +
          "\u26a0 " + (kept ? "not applied: " : "filter inactive: ") + escapeHtml(lastRuleParseError) +
          (kept ? " \u00b7 the last valid filter is still in effect" : "") +
          "</span>";
        // One click back to the expression that IS applied - otherwise the only
        // way out of a tangled draft is to unpick it by hand.
        if (kept && appliedRuleRows) {
          body += ' <button type="button" class="rule-revert-draft" ' +
            'title="Discard the invalid draft and restore the applied filter">Revert draft</button>';
        }
      }
      if (invalidUrlQuery !== null) {
        body += ' <label>Shared query <input id="ruleQueryRecovery" type="text" aria-label="Correct the invalid shared query" value="' +
          escapeHtml(invalidUrlQuery) + '"></label> <button type="button" class="rule-retry-query">Apply corrected query</button>';
      }
      document.getElementById("ruleExpression").innerHTML = body;
    }
    // Clicks in the expression line: retry a query the URL could not load, or
    // revert a rejected draft.
    function onExpressionClick(e) {
      if (e.target.closest(".rule-retry-query")) {
        e.preventDefault();
        const input = document.getElementById("ruleQueryRecovery");
        invalidUrlQuery = input ? input.value : invalidUrlQuery;
        try {
          ruleTree.rows = invalidUrlQuery.trim() ? treeToRows(parseRuleQuery(invalidUrlQuery)).rows : [];
          invalidUrlQuery = null;
          updateAfterRuleChange();
        } catch (error) {
          lastRuleParseError = "the ?q= in this URL could not be loaded: " + error.message;
          updateRuleExpression();
        }
        return;
      }
      if (e.target.closest(".rule-revert-draft")) {
        e.preventDefault();
        e.stopPropagation();
        if (appliedRuleRows) {
          ruleTree.rows = cloneRuleRows(appliedRuleRows);
          updateAfterRuleChange();
        }
        return;
      }
     }
    // Rule Builder visibility is driven by a plain button (no <details>).
    var ruleBuilderToggle = document.getElementById("ruleBuilderToggle");
    var ruleBuilderBody = document.getElementById("ruleBuilderBody");

    function setRuleBuilderOpen(open) {
      if (!ruleBuilderToggle || !ruleBuilderBody) {
        return;
      }
      ruleBuilderBody.hidden = !open;
      ruleBuilderToggle.setAttribute("aria-expanded", open ? "true" : "false");
      syncRuleCountBadge();                 // refresh the toggle's rule-count badge
      dependencies.onResize();                 // toolbar height changed
    }
    // A pick (a chip, a name, a span on a plot, a suggestion) shows the rule
    // it wrote - except on a phone, where the open builder left the table one
    // article of room: there the lit Filters button says a filter is on, and
    // the builder stays as it was. The guided tour shows it everywhere (its
    // Rule builder stop points at it).
    function revealAfterPick() {
      const phone = window.matchMedia && window.matchMedia("(max-width: 560px)").matches;
      if (!phone || (window.OATour && window.OATour.isOpen())) setRuleBuilderOpen(true);
    }

    /* The Rule Builder toggle shows the number of active conditions. */
    function syncRuleCountBadge() {
      const live = ruleTree.rows.filter(function (r) { return !r.disabled && conditionToString(r) !== ""; });
      if (ruleBuilderToggle) {
        const badge = ruleBuilderToggle.querySelector(".rb-count");
        if (badge) badge.textContent = live.length ? String(live.length) : "";
        ruleBuilderToggle.classList.toggle("has-rules", live.length > 0);
        ruleBuilderToggle.title = live.length
          ? "Show / hide the Rule Builder \u00b7 " + live.length + " active condition" + (live.length === 1 ? "" : "s")
          : "Show / hide the Rule Builder";
      }
    }

    function onToggleClick() {
        var open = ruleBuilderBody.hidden;
        // Opening an empty builder starts with one blank condition, so the
        // reader lands on something to fill in rather than a bare "Add" button.
        if (open && !ruleTree.rows.length) {
          ruleTree.rows.push(makeRule());
          updateAfterRuleChange();
        }
        setRuleBuilderOpen(open);   // hidden -> open, shown -> close
    }

    // Clicking a keyword, author, venue, date or the OA icon in the grid
    // toggles a "<field> <operator> <value>" rule on the root group instead
    // of navigating: first click adds the filter, clicking the same value
    // again removes it.
    // Remove one row without breaking the bracket structure. Brackets that open
    // AND close on the row enclosed only it and go with it; any other opening
    // bracket moves to the next row, any other closing one to the previous row.
    // Dropping them unbalanced the expression: the compile failed, and the
    // last valid filter (often the very one being relaxed) stayed applied.
    function removeRowAt(index) {
      const rows = ruleTree.rows, row = rows[index];
      if (!row) return;
      const open = row.openParens | 0, close = row.closeParens | 0;
      const both = Math.min(open, close), opens = open - both, closes = close - both;
      // The outer opens are the first entries; a legacy NOT connector negated
      // the whole bracket run, i.e. the outermost of them.
      const negs = [];
      for (let i = 0; i < opens; i++) negs.push(!!(row.openNegations && row.openNegations[i]) || (i === 0 && row.connector === "NOT"));
      rows.splice(index, 1);
      const next = rows[index], prev = rows[index - 1];
      if (opens && next) {
        next.openParens = (next.openParens | 0) + opens;
        next.openNegations = negs.concat(next.openNegations || []);
      }
      if (closes && prev) prev.closeParens = (prev.closeParens | 0) + closes;
    }
    function removeRowsWhere(test) {
      for (let i = ruleTree.rows.length - 1; i >= 0; i--) if (test(ruleTree.rows[i])) removeRowAt(i);
    }
    // Rows in a plain top-level AND chain: live, un-negated, outside any
    // bracket, in a rule set with no OR at the top level - a bracket is one
    // atom of the chain, whatever ORs it holds (X AND (A OR B)). Only these are
    // safe to drop automatically - removing one from an OR branch or a bracket
    // would change the meaning of a hand-built expression.
    function plainAndRows() {
      const rows = ruleTree.rows, out = new Set();
      let depth = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], open = row.openParens | 0, close = row.closeParens | 0;
        // A row's join applies at the depth it starts at (before its brackets).
        if (i > 0 && !depth && row.connector === "OR") return new Set();
        if (!depth && !open && !close && !row.disabled && !ruleLanguage.rowIsNegated(row)) out.add(row);
        depth = Math.max(0, depth + open - close);
      }
      return out;
    }
    // An OR at the top level: a condition ANDed onto the end could no longer
    // narrow the whole list.
    function topLevelOr() {
      let depth = 0;
      return ruleTree.rows.some(function (row, i) {
        const hit = i > 0 && !depth && row.connector === "OR";
        depth = Math.max(0, depth + (row.openParens | 0) - (row.closeParens | 0));
        return hit;
      });
    }
    // The article a live ID IS rule in the plain top-level AND chain names: the
    // list can show that article or nothing. Looser than pinnedArticleId() -
    // other conditions may sit beside it (a title clicked in a filtered list).
    // The table's abstract drop shows this article's graph metrics.
    function idFilterArticleId() {
      const plain = plainAndRows();
      const row = ruleTree.rows.find(function (r) {
        return plain.has(r) && r.field === FIELDS.ID && r.operator === "is" && String(r.value || "").trim() !== "";
      });
      return row ? String(row.value).trim() : null;
    }
    // Make `ID IS <id>` that filter (never toggling it off). It joins a plain
    // AND chain; beside an OR or a bracket it could not narrow the list, so it
    // replaces the rule set.
    function pinArticle(id, openBuilder) {
      const key = String(id || "").trim();
      if (!key) return;
      const current = idFilterArticleId();
      if (current !== null && normalizeText(current) === normalizeText(key)) return;
      const tangled = ruleTree.rows.some(function (row, i) {
        return (i > 0 && row.connector === "OR") || (row.openParens | 0) || (row.closeParens | 0);
      });
      removeRowsWhere(function (row) { return tangled || row.field === FIELDS.ID; });
      const rule = makeRule();
      rule.field = FIELDS.ID;
      rule.operator = "is";
      rule.value = key;
      pushRuleReusingBlank(rule);
      updateAfterRuleChange();
      // An ID IS pin puts the builder away: the drop and the panel carry the
      // article (articles-grid.js syncAuthorPanel closes it on every new one).
      setRuleBuilderOpen(false);
    }
    // The author the live AUTHOR IS rules in the plain top-level AND chain
    // name, when they name exactly one (null for none or several). The author
    // panel beside the table shows this author's metrics.
    function authorFilterSlug() {
      const plain = plainAndRows();
      let slug = null;
      for (const row of ruleTree.rows) {
        if (!plain.has(row) || row.field !== FIELDS.AUTHOR || row.operator !== "is") continue;
        const v = String(row.value || "").trim();
        if (!v) continue;
        if (slug !== null && slug !== v) return null;
        slug = v;
      }
      return slug;
    }
    // Make `AUTHOR IS <slug>` the list's one author (never toggling it off):
    // it replaces any other plain AUTHOR IS rule and an ID IS pin; beside a
    // top-level OR (where it could not narrow the list) it replaces the rule set.
    function pinAuthor(slug) {
      const key = String(slug || "").trim();
      if (!key || authorFilterSlug() === key) return;
      const tangled = topLevelOr();
      const plain = plainAndRows();
      removeRowsWhere(function (row) {
        return tangled || (plain.has(row) && row.field === FIELDS.AUTHOR && row.operator === "is");
      });
      dropIdPin();
      const rule = makeRule();
      rule.field = FIELDS.AUTHOR;
      rule.operator = "is";
      rule.value = key;
      pushRuleReusingBlank(rule);
      updateAfterRuleChange();
      revealAfterPick();
    }
    // An `ID IS` pin names one article, so any other pick ANDed onto it could
    // only keep that row or empty the list. The pick therefore REPLACES the
    // pin - also when other rules sit beside it (a title clicked in a filtered
    // list), where the pin used to survive and swallow every later pick.
    function dropIdPin() {
      const lone = idRulePinned(), plain = plainAndRows();
      removeRowsWhere(function (row) {
        const pin = row.field === FIELDS.ID && row.operator === "is" && !ruleLanguage.rowIsNegated(row);
        return pin && (lone || plain.has(row));
      });
    }
    // A paper has ONE date and ONE venue, so a second plain pick of either
    // ANDed onto the first could only repeat the list or empty it (a month,
    // then "that year", changed nothing). The new pick replaces the old one.
    const SINGLE_VALUED_FIELDS = new Set(["date", "venue"]);
    function dropPlainRows(field) {
      const plain = plainAndRows();
      removeRowsWhere(function (row) { return row.field === field && plain.has(row); });
    }
    // Date cell, one gesture per grain: a plain click (LMB) filters the exact
    // MONTH; the middle button (MMB) filters everything SINCE that month
    // (DATE >= YYYY-MM); the right button (RMB) filters the whole YEAR. `mode`
    // is "month" | "since" | "year". Each toggles: picking the same span again
    // removes it. `monthOnly` (true) is the legacy Alt-click spelling of "month".
    function applyDateCellFilter(ym, mode, openBuilder) {
      const v = String(ym || "").trim();
      if (!/^\d{4}-\d{2}$/.test(v)) return;
      if (mode === true) mode = "month";
      if (mode === "year") {
        const y = v.slice(0, 4);
        applyFacetRule({ field: "date", operator: "between", value: y + "-01", value2: y + "-12", kind: "date", label: y }, openBuilder);
        return;
      }
      toggleFieldRule("date", mode === "since" ? ">=" : "=", v, openBuilder);
    }

    // Make `DATE BETWEEN from AND to` the list's one plain date rule - the
    // interval dragged across the author panel's plots. Never toggles off.
    function setDateRange(from, to, openBuilder) {
      const a = String(from || "").trim(), b = String(to || "").trim();
      if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) return;
      dropIdPin();
      dropPlainRows("date");
      const rule = makeRule();
      rule.field = "date";
      rule.operator = "between";
      rule.value = a <= b ? a : b;
      rule.value2 = a <= b ? b : a;
      pushRuleReusingBlank(rule);
      updateAfterRuleChange();
      if (openBuilder !== false) revealAfterPick();
    }
    // The interval the one live plain date rule keeps: { from, to } ("YYYY-MM",
    // null for an open end), or null. The author panel shades it.
    function dateFilterRange() {
      const plain = plainAndRows();
      const rows = ruleTree.rows.filter(function (row) {
        return plain.has(row) && row.field === "date" && row.operator !== "!=" && String(row.value || "").trim() !== "";
      });
      if (rows.length !== 1) return null;
      const row = rows[0], v = String(row.value).trim();
      if (row.operator === "between") return row.value2 ? { from: v, to: String(row.value2).trim() } : null;
      if (row.operator === ">=") return { from: v, to: null };
      if (row.operator === "<=") return { from: null, to: v };
      return { from: v, to: v };
    }

    // Right-click on a keyword / category chip: the pick joins the filter's
    // topic rules with OR - another Topic Trends series - instead of
    // narrowing with AND; picking it again takes it out. Other conditions keep
    // narrowing: in a plain AND chain they go first and the topic rules follow
    // in one bracket the pick joins (X AND (A OR pick)); a hand-built
    // expression that ends in such a bracket gets the pick inside it, any
    // other one has it ORed onto the end.
    const TOPIC_FIELDS = new Set(["keyword", "category"]);
    function toggleTopicOr(field, value, openBuilder) {
      const v = String(value || "").trim();
      if (!v || !TOPIC_FIELDS.has(field)) return;
      const rows = ruleTree.rows, norm = normalizeText(v);
      const at = rows.findIndex(function (row) { return row.field === field && row.operator === "is" && normalizeText(row.value) === norm; });
      if (at >= 0) {
        if (rows[at].disabled) delete rows[at].disabled; else removeRowAt(at);
      } else {
        dropIdPin();
        const rule = makeRule();
        rule.field = field;
        rule.operator = "is";
        rule.value = v;
        const live = ruleTree.rows.filter(function (row) { return ruleLanguage.conditionToString(row) !== ""; });
        const topics = live.filter(function (row) { return TOPIC_FIELDS.has(row.field); });
        const plain = !ruleTree.rows.some(function (row, i) {
          return (i > 0 && row.connector === "OR") || (row.openParens | 0) || (row.closeParens | 0) || ruleLanguage.rowIsNegated(row);
        });
        const last = ruleTree.rows[ruleTree.rows.length - 1];
        if (!topics.length) {
          pushRuleReusingBlank(rule);
        } else if (plain && topics.length === live.length) {
          pushRuleReusingBlank(rule, "OR");
          rule.connector = "OR";   // also when it filled a blank row
        } else if (plain) {
          const rest = ruleTree.rows.filter(function (row) { return topics.indexOf(row) < 0; });
          topics.forEach(function (row, i) { row.connector = "AND"; row.openParens = i === 0 ? 1 : 0; row.closeParens = 0; });
          rule.connector = "OR";
          rule.closeParens = 1;
          ruleTree.rows = rest.concat(topics, [rule]);
        } else if (last && (last.closeParens | 0) > 0 && TOPIC_FIELDS.has(last.field)) {
          last.closeParens -= 1;
          rule.connector = "OR";
          rule.closeParens = 1;
          ruleTree.rows.push(rule);
        } else {
          pushRuleReusingBlank(rule, "OR");
          rule.connector = "OR";
        }
      }
      updateAfterRuleChange();
      if (openBuilder !== false) revealAfterPick();
    }

    function toggleFieldRule(field, operator, value, openBuilder) {
      if (openBuilder === undefined) openBuilder = true;
      if (!value) {
        return;
      }
      const normalized = normalizeText(value);
      const existingIndex = ruleTree.rows.findIndex(function (row) {
        return row.field === field &&
          row.operator === operator &&
          normalizeText(row.value) === normalized;
      });
      let removed = false;
      if (existingIndex >= 0) {
        if (ruleTree.rows[existingIndex].disabled) {
          // present but switched off (eye toggle) -> switch it back on
          delete ruleTree.rows[existingIndex].disabled;
        } else {
          // identical rule already present -> toggle it off
          removeRowAt(existingIndex);
          unwrapWholeExpression();
          removed = true;
        }
      } else {
        // A pinned ID names one article, so an added condition can only drop
        // it: the pick replaces the pin instead. (An ID pick replaces it below.)
        if (field !== "id") dropIdPin();
        if (SINGLE_VALUED_FIELDS.has(field) && operator !== "is not" && operator !== "!=") dropPlainRows(field);
        // openAccess is a yes/no field: keep only one openAccess rule active,
        // so clicking an open icon then a closed icon switches the filter. ID
        // names one article, so a second ID rule can only empty the list -
        // the new pick replaces the old one.
        if (field === "openAccess" || field === "isFavorite" || field === "id") {
          removeRowsWhere(function (row) { return row.field === field; });
        }
        const rule = makeRule();
        rule.field = field;             // keyword | author | venue | date | openAccess
        rule.operator = operator;       // "is" or "="
        rule.value = value;
        pushRuleReusingBlank(rule);
      }
      updateAfterRuleChange();
      // Reveal the current rule set - except for an ID IS pin, which puts it
      // away in the same task, so it never paints open (see pinArticle).
      if (field === FIELDS.ID && operator === "is") { if (!removed) setRuleBuilderOpen(false); }
      else if (openBuilder) revealAfterPick();
    }

    // A blank row (opened builder, or a pressed +) is a placeholder for exactly
    // the condition a chip / facet pick supplies: fill it instead of appending
    // a second row under it. Only value-less rows count - a half-typed DATE
    // BETWEEN or a parked (eye-toggled) row is left alone.
    function pushRuleReusingBlank(rule, join) {
      const blankAt = ruleTree.rows.findIndex(function (row) {
        return !row.disabled && String(row.value || "").trim() === "" && !row.value2 &&
          !BOOL_RULE_FIELDS.has(row.field);
      });
      // A NOT pick negates the condition.
      if (rule.connector === "NOT") rule.negated = !rule.negated;
      if (blankAt >= 0) {
        // Fill the blank in place: it keeps its join and brackets.
        const blank = ruleTree.rows[blankAt];
        rule.id = blank.id;
        rule.negated = !!rule.negated !== !!blank.negated;
        rule.connector = blank.connector === "OR" ? "OR" : "AND";
        rule.openParens = blank.openParens | 0;
        rule.openNegations = (blank.openNegations || []).slice();
        rule.closeParens = blank.closeParens | 0;
        ruleTree.rows[blankAt] = rule;
      } else if (join === "OR") {
        rule.connector = "OR";
        ruleTree.rows.push(rule);
      } else {
        // A pick from the table narrows the list: AND it onto the WHOLE current
        // expression. AND binds tighter than OR, so beside a top-level OR the
        // expression is bracketed first ("A OR B AND X" would only narrow B).
        if (topLevelOr()) wrapWholeExpression();
        rule.connector = "AND";
        ruleTree.rows.push(rule);
      }
    }
    // Bracket the whole current expression in a new outermost, un-negated group.
    function wrapWholeExpression() {
      const rows = ruleTree.rows;
      if (!rows.length) return;
      const first = rows[0], last = rows[rows.length - 1];
      // A legacy NOT in the connector slot negates the row's outermost bracket
      // (or its condition): spell it out first so it stays there and does not
      // move to the new outer group.
      if (first.connector === "NOT") {
        first.connector = "AND";
        if (first.openParens | 0) {
          first.openNegations = (first.openNegations || []).slice();
          first.openNegations[0] = !first.openNegations[0];
        } else first.negated = !first.negated;
      }
      first.openParens = (first.openParens | 0) + 1;
      first.openNegations = [false].concat(first.openNegations || []);
      last.closeParens = (last.closeParens | 0) + 1;
    }
    // Undo that bracket once the pick that needed it is toggled off: a bracket
    // opening on the first row and closing on the last changes nothing.
    function unwrapWholeExpression() {
      const rows = ruleTree.rows;
      if (!rows.length) return;
      const first = rows[0], last = rows[rows.length - 1];
      if (!(first.openParens | 0) || !(last.closeParens | 0) || first.connector === "NOT") return;
      if (first.openNegations && first.openNegations[0]) return;
      let depth = 0;
      for (let i = 0; i < rows.length; i++) {
        depth += (rows[i].openParens | 0) - (rows[i].closeParens | 0);
        if (depth < 0 || (depth === 0 && i < rows.length - 1)) return;   // closes early
      }
      if (depth !== 0) return;
      first.openParens -= 1;
      first.openNegations = (first.openNegations || []).slice(1);
      last.closeParens -= 1;
    }

    // Apply a rule picked from the search box's facet menu. Same toggle
    // semantics as clicking a chip in the grid; the extra case is DATE BETWEEN
    // (a bare year picked from the menu), which carries a second bound and so
    // can't go through toggleFieldRule's single-value dedupe.
    // Operators that have a genuine inverse in the rule language. Everything
    // else (>=, <=, BETWEEN) is negated with the row's NOT connector, which
    // the expression compiler turns into a real negation - a BETWEEN cannot be
    // inverted by swapping the operator, and silently applying the inclusive
    // range instead would do the opposite of what Alt promises.
    const FACET_INVERSE = { "is": "is not", "=": "!=" };

    function applyFacetRule(r, openBuilder) {
      if (!r || !r.value) return;
      let operator = r.operator;
      let connector = "AND";
      if (r.negate) {
        if (FACET_INVERSE[operator]) operator = FACET_INVERSE[operator];
        else connector = "NOT";
      }
      const v2raw = r.value2 || null;
      // A whole-year pick for the current year ends at THIS month, not December:
      // the database cannot hold later months and the builder would flag the
      // future bound as out of range.
      const v2 = (r.field === "date" && v2raw && v2raw > currentYM()) ? currentYM() : v2raw;
      const target = normalizeText(r.value);
      const sameValue = function (row) {
        return row.field === r.field && normalizeText(row.value) === target &&
          (row.value2 || null) === v2;
      };
      const dup = ruleTree.rows.findIndex(function (row) {
        return sameValue(row) && row.operator === operator &&
          (connector === "NOT" ? ruleLanguage.rowIsNegated(row) : !ruleLanguage.rowIsNegated(row)) &&
          (row.connector === "NOT" ? "AND" : row.connector || "AND") === (connector === "NOT" ? "AND" : connector);
      });
      if (dup >= 0) {
        if (ruleTree.rows[dup].disabled) {
          delete ruleTree.rows[dup].disabled;      // parked by the eye toggle -> back on
        } else {
          removeRowAt(dup);                        // picked again -> remove it
          unwrapWholeExpression();
        }
      } else {
        if (r.field !== "id") dropIdPin();     // a lone ID pin gives way to the pick
        // A pick sets the polarity for that value: drop the opposite reading of
        // the same facet rather than stacking a contradiction (IS plus IS NOT
        // on one value filters everything away).
        removeRowsWhere(sameValue);
        if (!r.negate && SINGLE_VALUED_FIELDS.has(r.field)) dropPlainRows(r.field);
        // Single-valued facets: yes/no fields, and ID (one article) - a second
        // ID rule would AND two keys and empty the list, so it replaces.
        if (r.field === "openAccess" || r.field === "isFavorite" || r.field === "id") {
          removeRowsWhere(function (row) { return row.field === r.field; });
        }
        const rule = makeRule();
        rule.field = r.field;
        rule.operator = operator;
        rule.value = r.value;
        if (v2) rule.value2 = v2;
        rule.connector = connector;
        pushRuleReusingBlank(rule);
      }
      updateAfterRuleChange();
      // Reveal the current rule set - except for an ID IS pin, which puts it
      // away in the same task (see pinArticle).
      if (r.field === "id" && operator === "is") { if (dup < 0 && connector !== "NOT") setRuleBuilderOpen(false); }
      else if (openBuilder !== false) revealAfterPick();
      // A title pick means "show me this paper": open its abstract along with
      // pinning the list to it, so the pick lands on something to read.
      if (r.field === "id" && operator === "is" && connector !== "NOT" && dup < 0) {
        dependencies.onPinArticle(r.value);
      }
    }

    // Is this facet row's rule already in the rule set? Drives the menu's
    // "already filtering by this" check mark, so a second pick reads as a
    // deliberate removal rather than a mystery.
    function facetRuleIsActive(r) {
      if (!r || !r.value) return false;
      const target = normalizeText(r.value);
      // Same clamp applyFacetRule applies on the way in (a whole-year pick for
      // the current year ends at this month), so the ✓ matches what was stored.
      const v2 = (r.field === "date" && r.value2 && r.value2 > currentYM()) ? currentYM() : (r.value2 || null);
      return ruleTree.rows.some(function (row) {
        return !row.disabled && row.field === r.field && row.operator === r.operator &&
          normalizeText(row.value) === target &&
          (row.value2 || null) === v2 &&
          !ruleLanguage.rowIsNegated(row);
      });
    }

    function removeLastLiveRule() {
      if (ruleTree.rows.length === 0) {
        return;
      }
      // Drop the last LIVE condition (the one the overlay named), not a trailing
      // blank row that contributes nothing.
      let at = ruleTree.rows.length - 1;
      for (let i = ruleTree.rows.length - 1; i >= 0; i--) {
        if (!ruleTree.rows[i].disabled && conditionToString(ruleTree.rows[i]) !== "") { at = i; break; }
      }
      removeRowAt(at);
      // Same rule as the row's own x: an emptied builder closes rather than
      // parking the reader on a bare "No Rule Filter" panel.
      setRuleBuilderOpen(ruleTree.rows.length > 0);
      updateAfterRuleChange();
    }
    function balanceParens(query) {
      let openUnclosed = 0, closeUnmatched = 0, quote = null;
      for (let i = 0; i < query.length; i++) {
        const c = query[i];
        if (quote) {
          if (c === "\\") { i++; continue; }
          if (c === quote) quote = null;
          continue;
        }
        if (c === '"' || c === "'") { quote = c; continue; }
        else if (c === "(") openUnclosed++;
        else if (c === ")") { if (openUnclosed > 0) openUnclosed--; else closeUnmatched++; }
      }
      if (!openUnclosed && !closeUnmatched) return query;
      return "(".repeat(closeUnmatched) + query + ")".repeat(openUnclosed);
    }

    // URL ingestion recovers unmatched brackets, but keeps every other malformed
    // shared query verbatim until the user corrects or replaces it.
    // An author named by its label in a shared query ("Bos, Freek") becomes its
    // id, as a pick in the row would make it - the panel and footer key on ids.
    function canonicalAuthors(rows) {
      rows.forEach(function (row) {
        if (!ruleLanguage.AUTHOR_FIELDS.has(row.field) || dependencies.authorLabel(row.value)) return;
        const slug = dependencies.authorSlug(row.value);
        if (slug) row.value = slug;
      });
      return rows;
    }
    function loadQuery(query) {
      invalidUrlQuery = null;
      lastRuleParseError = null;
      if (!query || !query.trim()) { ruleTree.rows = []; return true; }
      try {
        ruleTree.rows = canonicalAuthors(treeToRows(parseRuleQuery(query)).rows);
        return true;
      } catch (error) {
        const balanced = balanceParens(query);
        if (balanced !== query) {
          try { ruleTree.rows = canonicalAuthors(treeToRows(parseRuleQuery(balanced)).rows); return true; }
          catch (balancedError) { error = balancedError; }
        }
        invalidUrlQuery = query;
        lastRuleParseError = "the ?q= in this URL could not be loaded: " + (error.message || String(error));
        return false;
      }
    }

    const expressionElement = document.getElementById("ruleExpression");
    if (expressionElement) expressionElement.addEventListener("click", onExpressionClick);
    if (ruleBuilderToggle && ruleBuilderBody) ruleBuilderToggle.addEventListener("click", onToggleClick);
    // In-panel hide: collapses the panel (rules stay applied) and hands focus
    // back to the Filters toggle, since the pressed button disappears with it.
    const ruleBuilderHide = document.getElementById("ruleBuilderHide");
    function onHideClick() {
      setRuleBuilderOpen(false);
      if (ruleBuilderToggle) ruleBuilderToggle.focus({ preventScroll: true });
    }
    if (ruleBuilderHide) ruleBuilderHide.addEventListener("click", onHideClick);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (ruleUpdateTimer !== null) window.clearTimeout(ruleUpdateTimer);
      ruleUpdateTimer = null;
      ruleFacetMenus.forEach(function (menu) { if (menu && menu.destroy) menu.destroy(); });
      ruleFacetMenus = [];
      if (expressionElement) expressionElement.removeEventListener("click", onExpressionClick);
      if (ruleBuilderToggle) ruleBuilderToggle.removeEventListener("click", onToggleClick);
      if (ruleBuilderHide) ruleBuilderHide.removeEventListener("click", onHideClick);
    }

    // state.rows is a transitional adapter for controller consumers. UI edits,
    // row identities, debounce, applied snapshots and recovery remain owned here.
    return Object.freeze({
      state: ruleTree,
      parseQuery: parseRuleQuery,
      change: updateAfterRuleChange,
      render: renderRuleBuilder,
      renderExpression: updateRuleExpression,
      setOpen: setRuleBuilderOpen,
      syncCount: syncRuleCountBadge,
      clear: clearAllRules,
      replaceRules: replaceRules,
      removeLast: removeLastLiveRule,
      turnOff: turnOffRow,
      toggleField: toggleFieldRule,
      toggleTopicOr: toggleTopicOr,
      applyDate: applyDateCellFilter,
      setDateRange: setDateRange,
      dateFilterRange: dateFilterRange,
      applyFacet: applyFacetRule,
      facetIsActive: facetRuleIsActive,
      pinnedArticleId: pinnedArticleId,
      idFilterArticleId: idFilterArticleId,
      pinArticle: pinArticle,
      authorFilterSlug: authorFilterSlug,
      pinAuthor: pinAuthor,
      loadQuery: loadQuery,
      hasInvalidQuery: function () { return invalidUrlQuery !== null; },
      queryForUrl: function () { return invalidUrlQuery || rowsToString(urlRuleRows()); },
      appliedRows: urlRuleRows,
      beginApply: function () { if (invalidUrlQuery === null) lastRuleParseError = null; },
      acceptAppliedRows: function () { appliedRuleRows = cloneRuleRows(ruleTree.rows); },
      rejectDraft: function (error) { lastRuleParseError = error.message || String(error); },
      destroy: destroy
    });
  }
  return Object.freeze({ create: create });
})();
