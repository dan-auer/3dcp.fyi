/* rule-language.js
 * Pure query schema, parser, compiler and editor-row serialization.
 * No DOM, storage, dataset, or grid dependency. Loaded as a classic script so
 * the static HTTP(S) deployment keeps its existing ordered script loading.
 */
globalThis.OARuleLanguage = (function () {
  "use strict";
  const schema = {
    keyword: {
      token: "KEYWORD",
      label: "Keyword",
      operators: ["is", "is not", "contains", "does not contain"],
      inputType: "autocomplete",
      datalistId: "keywordSuggestions"
    },
    author: {
      token: "AUTHOR",
      label: "Author",
      operators: ["is", "is not", "contains", "does not contain"],
      inputType: "autocomplete",
      datalistId: "authorSuggestions"
    },
    venue: {
      token: "VENUE",
      label: "Venue",
      operators: ["is", "is not", "contains", "does not contain"],
      inputType: "autocomplete",
      datalistId: "venueSuggestions"
    },
    title: {
      token: "TITLE",
      label: "Title",
      operators: ["contains", "does not contain"],
      inputType: "text"
    },
    id: {
      token: "ID",
      label: "ID",
      operators: ["is", "is not"],
      inputType: "autocomplete",
      placeholder: "Title or BibTeX key\u2026"
    },
    abstract: {
      token: "ABSTRACT",
      label: "Abstract",
      operators: ["contains", "does not contain"],
      inputType: "text"
    },
    toc: {
      token: "TOC",
      label: "Table of Contents",
      operators: ["contains", "does not contain"],
      inputType: "text"
    },
    category: {
      token: "CATEGORY",
      label: "Category",
      operators: ["is", "is not", "begins with"],
      inputType: "autocomplete",
      datalistId: "categorySuggestions"
    },
    type: {
      token: "TYPE",
      label: "Type",
      operators: ["is", "is not"],
      inputType: "enum",
      // The dataset carries two publication types; the labels are what a
      // reader calls them (and what the author summary counts), the values
      // what the records store. A contribution is a conference paper or a
      // book chapter.
      options: [
        { value: "JournalArticle", label: "Journal Article" },
        { value: "Contribution",   label: "Contribution" }
      ]
    },
    date: {
      token: "DATE",
      label: "Date",
      operators: ["=", "!=", ">=", "<=", "between"],
      inputType: "month"
    },
    openAccess: {
      token: "OPEN_ACCESS",
      label: "Open Access",
      operators: ["is"],
      inputType: "boolean"
    },
    isFavorite: {
      token: "IS_FAVORITE",
      label: "Favorite",
      operators: ["is"],
      inputType: "boolean"
    },
    // The three graph rules take an article id and no operator; the static
    // operator cell reads ARTICLE so the row says "references of article x".
    // Named as noun phrases of the anchor article, so the predicate reading
    // ("the row is one of the references of x") says the same thing.
    references: {
      token: "REFERENCES_OF",
      label: "References of",
      operators: ["is"],
      operatorLabel: "ARTICLE",
      inputType: "autocomplete",
      placeholder: "Title or BibTeX key\u2026"
    },
    citedBy: {
      token: "CITATIONS_OF",
      label: "Citations of",
      operators: ["is"],
      operatorLabel: "ARTICLE",
      inputType: "autocomplete",
      placeholder: "Title or BibTeX key\u2026"
    },
    similarTo: {
      token: "SIMILAR_TO",
      label: "Similar to",
      operators: ["is"],
      operatorLabel: "ARTICLE",
      inputType: "autocomplete",
      placeholder: "Title or BibTeX key\u2026"
    },
    // Author-to-author citation analysis. CITES_AUTHOR b: rows that reference
    // at least one of b's papers; CITED_BY_AUTHOR b: rows that at least one of
    // b's papers references. Combined with AUTHOR IS a they answer "which of
    // a's papers cite b" - the author panel's cites-most / cited-by lists,
    // as a filter. The value is an author slug, as for AUTHOR.
    citesAuthor: {
      token: "CITES_AUTHOR",
      label: "Cites author",
      operators: ["is", "is not"],
      inputType: "autocomplete",
      datalistId: "authorSuggestions"
    },
    citedByAuthor: {
      token: "CITED_BY_AUTHOR",
      label: "Cited by author",
      operators: ["is", "is not"],
      inputType: "autocomplete",
      datalistId: "authorSuggestions"
    }
  };
  const OPERATOR_SYMBOLS = {
    "is":               "IS",
    "is not":           "IS_NOT",
    "contains":         "CONTAINS",
    "does not contain": "NOT_CONTAINS",
    "begins with":      "BEGINS_WITH",
    "=":                "EQ",
    "!=":               "NEQ",
    ">=":               "LATER_THAN",
    "<=":               "EARLIER_THAN",
    "between":          "BETWEEN"
  };
  const FIELDS = {}, FIELD_ALIASES = {}, FIELD_TOKEN = {};
  const DATE_FIELDS = new Set(), BOOLEAN_FIELDS = new Set(), RELATION_FIELDS = new Set(), AUTHOR_FIELDS = new Set();
  for (const key of Object.keys(schema)) {
    const definition = schema[key];
    FIELDS[definition.token] = key;
    FIELD_ALIASES[definition.token.toLowerCase()] = key;
    FIELD_TOKEN[key] = definition.token;
    if (definition.inputType === "month") DATE_FIELDS.add(key);
    if (definition.inputType === "boolean") BOOLEAN_FIELDS.add(key);
    if (definition.operatorLabel === "ARTICLE") RELATION_FIELDS.add(key);
    if (definition.datalistId === "authorSuggestions") AUTHOR_FIELDS.add(key);
    Object.freeze(definition.operators);
    if (definition.options) {
      definition.options.forEach(Object.freeze);
      Object.freeze(definition.options);
    }
    Object.freeze(definition);
  }
  Object.freeze(schema);
  Object.freeze(FIELDS);
  Object.freeze(FIELD_ALIASES);
  Object.freeze(FIELD_TOKEN);
  Object.freeze(OPERATOR_SYMBOLS);

  function validateRule(rule, options) {
    if (!rule || typeof rule !== "object") throw new TypeError("Expected a rule object");
    const definition = schema[rule.field];
    if (!definition) throw new Error("Unsupported rule field: " + rule.field);
    if (!definition.operators.includes(rule.operator)) {
      throw new Error(definition.token + " does not support " + rule.operator);
    }
    if (typeof rule.value !== "string") throw new TypeError(definition.token + " expects a string value");
    let value = rule.value.trim();
    const draft = options && options.allowIncomplete;
    if (!value) {
      if (draft) return Object.assign({}, rule, { value: "" });
      throw new Error(definition.token + " expects a nonempty value");
    }
    if (BOOLEAN_FIELDS.has(rule.field)) {
      if (!/^(true|false)$/i.test(value)) throw new Error(definition.token + " expects TRUE or FALSE");
      value = value.toLowerCase();
    } else if (definition.inputType === "enum") {
      const choice = definition.options.find(function (option) { return option.value.toLowerCase() === value.toLowerCase(); });
      if (!choice) throw new Error(definition.token + " expects " + definition.options.map(function (option) { return option.value; }).join(" or "));
      value = choice.value;
    } else if (DATE_FIELDS.has(rule.field)) {
      if (!isValidYYYYMM(value)) throw new Error("DATE expects YYYY-MM, got '" + value + "'");
      if (rule.operator === "between" && !(draft && !rule.value2)) {
        if (typeof rule.value2 !== "string" || !isValidYYYYMM(rule.value2)) {
          throw new Error("DATE BETWEEN expects YYYY-MM on both sides");
        }
      }
    } else if (rule.field === FIELDS.CATEGORY) value = value.toUpperCase();
    return Object.assign({}, rule, { value: value });
  }
  function isValidYYYYMM(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || "").trim());
  }

  const TEXT_OPERATORS = { "=": "is", "!=": "is not", "~": "contains", "!~": "does not contain", "^=": "begins with" };
  function mapUrlOperator(fieldKey, opSymbol) {
    if (BOOLEAN_FIELDS.has(fieldKey)) {
      if (opSymbol === "=") return "is";
      throw new Error(FIELD_TOKEN[fieldKey] + " only supports '='");
    }
    if (DATE_FIELDS.has(fieldKey)) {
      if (schema[fieldKey].operators.includes(opSymbol)) return opSymbol;   // date operators are their own symbols
      throw new Error("Unsupported date operator: " + opSymbol);
    }
    if (opSymbol === "^=" && fieldKey !== "category") throw new Error("BEGINS_WITH is only supported for CATEGORY");
    if (TEXT_OPERATORS[opSymbol]) return TEXT_OPERATORS[opSymbol];
    throw new Error("Unsupported text operator: " + opSymbol);
  }

  // Canonical operator keywords, read as the symbols they stand for.
  const OPERATOR_WORDS = { IS: "=", IS_NOT: "!=", EQ: "=", NEQ: "!=", CONTAINS: "~", NOT_CONTAINS: "!~",
    BEGINS_WITH: "^=", LATER_THAN: ">=", EARLIER_THAN: "<=", BETWEEN: "between" };

  function tokenizeRuleQuery(input) {
    if (typeof input !== "string") throw new TypeError("Query must be a string");
    const tokens = [];
    const n = input.length;
    let i = 0;

    function isWordChar(c) {
      // A "word" runs until whitespace, paren, or quote.
      return !/[\s()"'=~!<>^]/.test(c);
    }

    while (i < n) {
      const c = input[i];

      if (/\s/.test(c)) { i += 1; continue; }

      if (c === "(") { tokens.push({ type: "LPAREN" }); i += 1; continue; }
      if (c === ")") { tokens.push({ type: "RPAREN" }); i += 1; continue; }

      // Quoted string (single or double, with backslash escapes).
      if (c === '"' || c === "'") {
        const quote = c;
        let value = "";
        i += 1;
        while (i < n && input[i] !== quote) {
          if (input[i] === "\\" && i + 1 < n) {
            value += input[i + 1];
            i += 2;
          } else {
            value += input[i];
            i += 1;
          }
        }
        if (i >= n) {
          throw new Error("Unterminated quoted string");
        }
        i += 1;
        tokens.push({ type: "VALUE", value: value });
        continue;
      }

      // Operator symbols: =, !=, >=, <=, ~, !~. These let a URL use the
      // same compact form search.js emits (`venue = "X"`, `date >= 2024`)
      // in addition to the keyword forms (IS, CONTAINS, LATER_THAN…).
      // Must precede the bare-word branch, since these are "word" chars.
      if (c === "^" && input[i + 1] === "=") { tokens.push({ type: "OP", value: "^=" }); i += 2; continue; }
      if (c === "=") { tokens.push({ type: "OP", value: "=" }); i += 1; continue; }
      if (c === "~") { tokens.push({ type: "OP", value: "~" }); i += 1; continue; }
      // Only the two-character forms are accepted. A bare ">" used to fall
      // through to ">=", so `date > 2020-01` silently also matched January
      // 2020; the same for "<" and "!". Rejecting them surfaces the typo in
      // the expression bar instead of returning quietly wrong rows.
      if (c === "!") {
        if (input[i + 1] === "~") { tokens.push({ type: "OP", value: "!~" }); i += 2; continue; }
        if (input[i + 1] === "=") { tokens.push({ type: "OP", value: "!=" }); i += 2; continue; }
        throw new Error("Expected '!=' or '!~' at position " + i);
      }
      if (c === ">" || c === "<") {
        if (input[i + 1] !== "=") {
          throw new Error("Expected '" + c + "=' at position " + i +
            " (only >= and <= are supported)");
        }
        tokens.push({ type: "OP", value: c + "=" }); i += 2; continue;
      }

      // Bare word: field name, value, AND/OR/NOT, or operator keyword.
      if (isWordChar(c)) {
        let value = "";
        while (i < n && isWordChar(input[i])) {
          value += input[i];
          i += 1;
        }
        const upper = value.toUpperCase();
        // SKIP <condition>: the condition is present but switched off (the
        // rule builder's eye toggle). It keeps its place and parens in the
        // expression and contributes nothing to the filter.
        if (upper === "AND" || upper === "OR" || upper === "NOT" || upper === "SKIP") tokens.push({ type: upper });
        else if (OPERATOR_WORDS[upper]) tokens.push({ type: "OP", value: OPERATOR_WORDS[upper] });
        else tokens.push({ type: "WORD", value: value });
        continue;
      }

      throw new Error("Unexpected character '" + c + "' at position " + i);
    }

    return tokens;
  }

  function parseRuleQuery(input, options) {
    const tokens = tokenizeRuleQuery(input);
    let serial = 0;
    const makeRuleNodeId = options && options.makeId || function () { return "rule-node-" + (++serial); };
    let pos = 0;

    function peek()    { return pos < tokens.length ? tokens[pos] : null; }
    function consume() { return tokens[pos++]; }
    // Brackets, NOT and SKIP nest, each level a few frames of recursion here
    // and in the compiler: a ?q= nested thousands deep overflowed the stack
    // and the bar showed "Maximum call stack size exceeded". Past MAX_NESTING
    // it is a plain parse error; the builder's own queries nest a few levels.
    const MAX_NESTING = 32;
    let depth = 0;
    function nest() {
      if (++depth > MAX_NESTING) throw new Error("Nested more than " + MAX_NESTING + " levels deep");
    }

    // a <logic> b <logic> ... as one group; a single item stands alone.
    function parseJoined(logic, next) {
      const items = [next()];
      while (peek() && peek().type === logic) {
        consume();
        items.push(next());
      }
      return items.length === 1 ? items[0] : { id: makeRuleNodeId(), type: "group", logic: logic, children: items };
    }
    function parseOr() { return parseJoined("OR", parseAnd); }
    function parseAnd() { return parseJoined("AND", parseAtom); }

    function parseAtom() {
      const t = peek();
      if (!t) {
        throw new Error("Unexpected end of query");
      }
      if (t.type === "NOT") {
        consume();
        nest();
        const child = parseAtom();
        depth -= 1;
        return {
          id:    makeRuleNodeId(),
          type:  "not",
          child: child
        };
      }
      if (t.type === "SKIP") {
        // Parsed like any atom so it keeps its structural place; the flag
        // makes the compiler drop it and treeToRows restore it switched off.
        consume();
        nest();
        const node = parseAtom();
        depth -= 1;
        node.disabled = true;
        return node;
      }
      if (t.type === "LPAREN") {
        consume();
        nest();
        const node = parseOr();
        depth -= 1;
        const closing = consume();
        if (!closing || closing.type !== "RPAREN") {
          throw new Error("Expected ')'");
        }
        return node;
      }
      return parseSingleRule();
    }

    function parseSingleRule() {
      const fieldTok = consume();
      if (!fieldTok || fieldTok.type !== "WORD") {
        throw new Error("Expected field name");
      }
      const fieldKey = FIELD_ALIASES[fieldTok.value.toLowerCase()];
      if (!fieldKey) {
        throw new Error("Unknown field: " + fieldTok.value);
      }

      let opName;
      if (RELATION_FIELDS.has(fieldKey)) {
        // Unary: REFERENCES_OF "<article id>". A stray IS / = between the
        // two is tolerated so the binary spelling parses as well.
        if (peek() && peek().type === "OP") {
          if (consume().value !== "=") {
            throw new Error(fieldTok.value.toUpperCase() + " takes an article id, not an operator");
          }
        }
        opName = "is";
      } else {
        const opTok = consume();
        if (!opTok || opTok.type !== "OP") {
          throw new Error("Expected operator after '" + fieldTok.value + "'");
        }
        opName = mapUrlOperator(fieldKey, opTok.value);
      }

      // validateRule normalizes the value (trim, case) for every field.
      const rule = { id: makeRuleNodeId(), type: "rule", field: fieldKey, operator: opName,
        value: takeValue("Expected value after operator") };
      // BETWEEN consumes "<value> AND <value>" as one rule. The middle
      // AND is special-purpose here -- it isn't a connector between
      // rules -- so we hand-parse rather than letting parseAnd see it.
      if (opName === "between") {
        const andTok = consume();
        if (!andTok || andTok.type !== "AND") throw new Error("Expected AND after first BETWEEN value");
        rule.value2 = takeValue("Expected second value after BETWEEN ... AND");
      }
      return validateRule(rule);
    }
    function takeValue(message) {
      const tok = consume();
      if (!tok || (tok.type !== "VALUE" && tok.type !== "WORD")) throw new Error(message);
      return tok.value;
    }

    const result = parseOr();
    if (pos < tokens.length) {
      throw new Error("Unexpected trailing tokens after query");
    }

    // The rule builder's root is always an AND group, so wrap single
    // rules and top-level OR groups in one.
    if (result.type === "group" && result.logic === "AND") {
      return result;
    }
    return {
      id:       makeRuleNodeId(),
      type:     "group",
      logic:    "AND",
      children: [result]
    };
  }

  function quoteValue(value) {
    return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  // Compile Boolean structure once. The tree is parse()'s, so already valid.
  // A supplied leaf compiler owns access to article-specific indexes and
  // returns a predicate or null (unavailable). Disabled/unavailable nodes
  // contribute nothing, including under NOT/OR.
  function compile(tree, compileLeaf) {
    function walk(node, negated) {
      if (node.disabled) return null;
      if (node.type === "rule") return compileLeaf(node, negated);
      if (node.type === "not") {
        const inner = walk(node.child, !negated);
        return inner === null ? null : function (article) { return !inner(article); };
      }
      const children = node.children.map(function (child) { return walk(child, negated); }).filter(function (child) { return child !== null; });
      if (!children.length) return null;
      if (node.logic === "AND") return function (article) {
        for (const test of children) if (!test(article)) return false;
        return true;
      };
      return function (article) {
        for (const test of children) if (test(article)) return true;
        return false;
      };
    }
    return walk(tree, false);
  }

  function conditionToString(row) {
    const rule = validateRule(row, { allowIncomplete: true });
    if (!rule.value || (rule.operator === "between" && !rule.value2)) return "";
    const field = rule.field;
    const token = FIELD_TOKEN[field];
    const op = OPERATOR_SYMBOLS[rule.operator];
    const value = field === FIELDS.CATEGORY ? rule.value.toUpperCase()
      : field === FIELDS.ID || RELATION_FIELDS.has(field) ? rule.value : rule.value.toLowerCase();
    if (DATE_FIELDS.has(field)) {
      return token + " " + op + " " + value + (rule.operator === "between" ? " AND " + rule.value2.trim() : "");
    }
    if (BOOLEAN_FIELDS.has(field)) return token + " IS " + value.toUpperCase();
    if (RELATION_FIELDS.has(field)) return token + " " + quoteValue(value);
    return token + " " + op + " " + quoteValue(value);
  }

  // Copies of the rows that pass keep(row), with brackets re-derived from the
  // group tree: a dropped row's brackets move to its group's remaining rows,
  // and a group with none left vanishes - so a blank row that ends a group
  // (a fresh AND / OR branch, a + on its last row) never unbalances the query.
  function packRows(rows, keep) {
    const copies = cloneRows(rows || []);
    const kept = new Set(copies.filter(keep));
    const root = rowsToGroups(copies);
    (function prune(node) {
      node.children = node.children.filter(function (child) {
        if (child.type === "group") { prune(child); return true; }
        return kept.has(child);
      });
    })(root);
    return groupsToRows(root);
  }

  // packRows re-derives every join (AND / OR, a legacy NOT connector moved
  // onto its row) and bracket, so the rows it returns are already well-formed.
  function rowsToString(rows) {
    return packRows(rows, function (row) { return conditionToString(row) !== ""; }).map(function (row, index) {
      let out = index ? " " + row.connector + " " : "";
      row.openNegations.forEach(function (negated) { out += (negated ? "NOT " : "") + "("; });
      return out + (row.negated ? "NOT " : "") + (row.disabled ? "SKIP " : "") + conditionToString(row) + ")".repeat(row.closeParens);
    }).join("");
  }

  // Opening-bracket polarity is separate from leaf polarity. A single row
  // can begin NOT (NOT (NOT A OR B) AND C) without dropping any NOT scope.
  function treeToRows(tree, options) {
    let serial = 0;
    const makeId = options && options.makeId || function () { return "rule-node-" + (++serial); };
    function visit(node, connector, root, inheritedOff, inheritedNegation) {
      const off = !!inheritedOff || !!node.disabled;
      if (node.type === "not") return visit(node.child, connector, root, off, !inheritedNegation);
      if (node.type === "rule") {
        const rule = validateRule(node);
        const row = { id: makeId(), connector: connector || "AND", negated: !!inheritedNegation,
          openParens: 0, openNegations: [], closeParens: 0, field: rule.field,
          operator: rule.operator, value: rule.value };
        if (rule.value2 !== undefined) row.value2 = rule.value2;
        if (off) row.disabled = true;
        return [row];
      }
      if (node.children.length === 1) return visit(node.children[0], connector, root, off, inheritedNegation);
      const rows = [];
      node.children.forEach(function (child, index) {
        rows.push.apply(rows, visit(child, index ? node.logic : connector, false, off, false));
      });
      if (rows.length && (!root || inheritedNegation)) {
        rows[0].openParens += 1;
        rows[0].openNegations.unshift(!!inheritedNegation);
        rows[rows.length - 1].closeParens += 1;
      }
      return rows;
    }
    return { rows: visit(tree, "AND", true, false, false) };
  }

  function fromRows(rows, options) {
    const query = rowsToString(rows);
    return query ? parseRuleQuery(query, options) : null;
  }
  function cloneRows(rows) {
    return rows.map(function (row) {
      const copy = Object.assign({}, row);
      if (row.openNegations) copy.openNegations = row.openNegations.slice();
      return copy;
    });
  }
  function positiveRules(tree) {
    const rules = [];
    function visit(node, negated) {
      if (!node || node.disabled) return;
      if (node.type === "not") return visit(node.child, !negated);
      if (node.type === "group") return node.children.forEach(function (child) { visit(child, negated); });
      if (!negated) rules.push(node);
    }
    visit(tree, false);
    return rules;
  }
  function rowIsNegated(row) {
    return !!row.negated || row.connector === "NOT" || !!(row.openNegations && row.openNegations.some(Boolean));
  }
  // Editor grouping: the flat rows as a tree of groups whose leaves are the
  // row objects themselves - drafts included, which the query string drops.
  // A bracket pair is a group; a level that mixes AND and OR without brackets
  // becomes the subgroups the parser reads (AND binds tighter), so every group
  // has one logic. A group holding only a group is that group. Unmatched ")"
  // are ignored, unclosed "(" end with the rows, and a legacy NOT connector is
  // moved onto the row (or its first bracket) in place.
  // Group: { type: "group", logic: "AND" | "OR", negated, children }.
  function rowsToGroups(rows) {
    function level(negated) { return { negated: negated, items: [], joins: [] }; }
    function close(lv) {
      let items = lv.items, logic = lv.joins[0] || (lv.negated ? "OR" : "AND");
      if (lv.joins.indexOf("AND") >= 0 && lv.joins.indexOf("OR") >= 0) {
        const runs = [[items[0]]];
        for (let k = 1; k < items.length; k++) {
          if (lv.joins[k - 1] === "AND") runs[runs.length - 1].push(items[k]);
          else runs.push([items[k]]);
        }
        items = runs.map(function (run) {
          return run.length === 1 ? run[0] : { type: "group", logic: "AND", negated: false, children: run };
        });
        logic = "OR";
      }
      if (items.length === 1 && items[0].type === "group" && !(lv.negated && items[0].negated)) {
        if (lv.negated) items[0].negated = true;
        return items[0];
      }
      return { type: "group", logic: logic, negated: lv.negated, children: items };
    }
    const stack = [level(false)];
    rows.forEach(function (row, r) {
      if (row.connector === "NOT") {
        row.connector = "AND";
        if (row.openParens | 0) {
          row.openNegations = (row.openNegations || []).slice();
          row.openNegations[0] = !row.openNegations[0];
        } else row.negated = !row.negated;
      }
      if (r > 0) stack[stack.length - 1].joins.push(row.connector === "OR" ? "OR" : "AND");
      const opens = Math.max(0, row.openParens | 0);
      for (let k = 0; k < opens; k++) stack.push(level(!!(row.openNegations && row.openNegations[k])));
      stack[stack.length - 1].items.push(row);
      for (let k = Math.max(0, row.closeParens | 0); k > 0 && stack.length > 1; k--) {
        const done = close(stack.pop());
        stack[stack.length - 1].items.push(done);
      }
    });
    while (stack.length > 1) {
      const done = close(stack.pop());
      stack[stack.length - 1].items.push(done);
    }
    // A negated whole becomes a group inside a plain root, so its NOT sits in
    // a join cell like any other group's.
    const root = close(stack[0]);
    return root.negated ? { type: "group", logic: "AND", negated: false, children: [root] } : root;
  }
  // Back to rows: writes each leaf's join and brackets from the tree and
  // returns the leaves in order. Every group gets a bracket pair except the
  // root, which needs one only to carry its NOT; empty groups vanish.
  function groupsToRows(root) {
    const out = [];
    function filled(node) { return node.type !== "group" || node.children.some(filled); }
    function visit(node, join, opens, bracket) {
      if (node.type !== "group") {
        node.connector = join;
        node.openParens = opens.length;
        node.openNegations = opens;
        node.closeParens = 0;
        out.push(node);
        return;
      }
      const own = bracket ? opens.concat([!!node.negated]) : opens;
      node.children.filter(filled).forEach(function (child, k) {
        visit(child, k ? node.logic : join, k ? [] : own, true);
      });
      if (bracket) out[out.length - 1].closeParens += 1;
    }
    if (filled(root)) visit(root, "AND", [], !!root.negated);
    return out;
  }

  return Object.freeze({ schema: schema, FIELDS: FIELDS, FIELD_ALIASES: FIELD_ALIASES,
    FIELD_TOKEN: FIELD_TOKEN, BOOLEAN_FIELDS: BOOLEAN_FIELDS,
    RELATION_FIELDS: RELATION_FIELDS, AUTHOR_FIELDS: AUTHOR_FIELDS, OPERATOR_SYMBOLS: OPERATOR_SYMBOLS,
    parse: parseRuleQuery, compile: compile, fromRows: fromRows, rowsToString: rowsToString,
    conditionToString: conditionToString, treeToRows: treeToRows, quoteValue: quoteValue,
    isValidYYYYMM: isValidYYYYMM, cloneRows: cloneRows, positiveRules: positiveRules,
    rowIsNegated: rowIsNegated, packRows: packRows });
})();
