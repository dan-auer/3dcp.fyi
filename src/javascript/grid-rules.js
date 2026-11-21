/* grid-rules.js - the article table's rule compiler: the Filters panel's rows,
 * or one condition, become a test on a grid row. compileFromRows writes the
 * rows out as a query (rule-language.js), parses it and compiles the tree;
 * compileRule takes one condition (the Topic Trends series use it too) and
 * compileDateRule one date condition (the date cells' marks). A condition
 * with nothing to test compiles to null and its group drops it; a malformed
 * one throws, and the caller keeps the last filter that worked.
 *
 * The rows carry the indexes articles-grid.js prepareRuntimeIndexes builds:
 * _keywordSet / _keywordsSearchLc, _authorExactSet / _authorSearchLc,
 * _titleLc, _venueLc, refIds. ABSTRACT, TOC and IS_FAVORITE read their
 * sources live (OASemanticSearch, TOC_DATA, OAFavorites); a CONTAINS on the
 * abstract or contents adds its needle to window.OARuleHighlights.
 *
 * create(deps) -> { compileFromRows, compileRule, compileDateRule }
 *   deps.language       rule-language.js (OARuleLanguage)
 *   deps.parseQuery     query string -> rule tree (the rule editor's parser)
 *   deps.articles       the grid's rows
 *   deps.articleStore   OAArticleStore.get(): categories, citation graph
 *   deps.normalizeText  the grid's text folding for comparisons
 *   deps.foldText       OATypeset.fold
 *   deps.authorSlug     author label (normalized) -> slug, or undefined
 * No DOM. Unit-tested: tests/unit/grid-rules.test.mjs. Split out of
 * articles-grid.js buildGrid, unchanged.
 */
(function () {
  "use strict";

  function create(deps) {
    const ruleLanguage = deps.language;
    const { isValidYYYYMM, rowsToString } = ruleLanguage;
    const FIELDS = ruleLanguage.FIELDS;
    const RELATION_FIELDS = ruleLanguage.RELATION_FIELDS;
    const parseQuery = deps.parseQuery, articles = deps.articles, articleStore = deps.articleStore;
    const normalizeText = deps.normalizeText, foldText = deps.foldText, authorSlug = deps.authorSlug;

    // The flat rows become a query string, the query string is parsed
    // into a nested tree (handling AND/OR precedence and parens), and the
    // tree is compiled to a predicate.  Single source of truth: the
    // string is the same thing that goes into the URL.
    function compileFromRows(rows) {
      const queryString = rowsToString(rows);
      if (queryString === "") {
        return function () { return true; };
      }
      const tree = parseQuery(queryString);
      // null = nothing left to test (every condition switched off) -> match all.
      return compileRuleNode(tree) || function () { return true; };
    }

    // Returns null for a node that contributes nothing - a SKIPped (switched
    // off) condition, a NOT around one, or a group whose members are all off -
    // so the enclosing group simply drops it. A constant would be wrong: true
    // swallows an OR group, false an AND group.
    function compileRuleNode(node) {
      return ruleLanguage.compile(node, function (rule, negated) {
        const highlights = window.OARuleHighlights;
        if (negated) window.OARuleHighlights = null;
        try { return compileRule(rule); }
        finally { window.OARuleHighlights = highlights; }
      });
    }

    function compileRule(rule) {
      const value = String(rule.value || "").trim();

      if (value === "") {
        return null;                        // nothing to test; the group drops it
      }

      if (rule.field === FIELDS.KEYWORD) {
        return compileKeywordRule(value, rule.operator);
      }

      if (rule.field === FIELDS.AUTHOR) {
        return compileAuthorRule(value, rule.operator);
      }

      if (rule.field === FIELDS.CITES_AUTHOR || rule.field === FIELDS.CITED_BY_AUTHOR) {
        return compileAuthorGraphRule(rule.field, value, rule.operator);
      }

      if (rule.field === FIELDS.VENUE) {
        return compileTextRule("_venueLc", value, rule.operator);
      }

      if (rule.field === FIELDS.TITLE) {
        return compileTextRule("_titleLc", value, rule.operator);
      }

      if (rule.field === FIELDS.ID) {
        // Exact key; a hand-typed key is forgiven its case. Only IS / IS_NOT are
        // defined for ID - a CONTAINS off a hand-edited URL must not pass as IS.
        if (rule.operator !== "is" && rule.operator !== "is not") {
          throw new Error("ID supports IS and IS_NOT only");
        }
        const key = value, keyLc = value.toLowerCase();
        const hit = function (a) { return a.id === key || String(a.id).toLowerCase() === keyLc; };
        if (rule.operator === "is not") return function (a) { return !hit(a); };
        return hit;
      }

      if (rule.field === FIELDS.ABSTRACT) {
        return compileLookupTextRule(abstractTextLc, value, rule.operator);
      }

      if (rule.field === FIELDS.TOC) {
        return compileLookupTextRule(tocTextLc, value, rule.operator);
      }

      if (rule.field === FIELDS.CATEGORY) {
        // Abbreviations (the CATEGORY_DEFS keys), case-insensitive. IS / IS NOT
        // cover the whole branch under the named node (see articleStore.categoryDescendants);
        // BEGINS WITH takes a taxonomy-number prefix ("04", "04.12") - or an
        // abbreviation prefix - and matches any assignment whose number (or
        // abbreviation) starts with it.
        const cv = String(value).trim().toUpperCase();
        const keys = function (a) {
          return articleStore.categoryCodes(a).map(function (k) { return String(k).toUpperCase(); });
        };
        if (rule.operator === "is" || rule.operator === "is not") {
          const branch = articleStore.categoryDescendants(cv);
          const inBranch = function (a) {
            const ks = keys(a);
            for (let i = 0; i < ks.length; i++) if (branch.has(ks[i])) return true;
            return false;
          };
          return rule.operator === "is" ? inBranch : function (a) { return !inBranch(a); };
        }
        if (rule.operator === "begins with") {
          const defs = window.CATEGORY_DEFS || {};
          return function (a) {
            return keys(a).some(function (k) {
              const d = defs[k];
              return k.indexOf(cv) === 0 || (d && String(d.num || "").indexOf(cv) === 0);
            });
          };
        }
        throw new Error("Unknown category operator: " + rule.operator);
      }

      if (rule.field === FIELDS.DATE) {
        return compileDateRule(value, rule.operator, rule.value2);
      }

      if (RELATION_FIELDS.has(rule.field)) {
        return compileRelationRule(rule.field, value);
      }

      if (rule.field === FIELDS.TYPE) {
        const want = normalizeText(value);
        const negated = rule.operator === "is not";
        return function (article) {
          const hit = normalizeText(article.type || "") === want;
          return negated ? !hit : hit;
        };
      }

      if (rule.field === FIELDS.OPEN_ACCESS) {
        const expected = value === "true";

        return function (article) {
          return article.openAccess === expected;
        };
      }

      if (rule.field === FIELDS.IS_FAVORITE) {
        const expected = value === "true";

        return function (article) {
          const fav = window.OAFavorites
            ? window.OAFavorites.has(article.id)
            : false;
          return fav === expected;
        };
      }

      throw new Error("Unsupported rule field: " + rule.field);
    }

    function compileKeywordRule(value, operator) {
      const normalizedValue = normalizeText(value);

      if (operator === "is") {
        return function (article) {
          return article._keywordSet.has(normalizedValue);
        };
      }

      if (operator === "is not") {
        return function (article) {
          return !article._keywordSet.has(normalizedValue);
        };
      }

      if (operator === "contains") {
        return function (article) {
          return article._keywordsSearchLc.includes(normalizedValue);
        };
      }

      if (operator === "does not contain") {
        return function (article) {
          return !article._keywordsSearchLc.includes(normalizedValue);
        };
      }

      throw new Error("Unknown keyword operator: " + operator);
    }

    // CITES_AUTHOR b / CITED_BY_AUTHOR b: the citation graph walked by person.
    // b's own papers are the rows whose exact author set holds the slug (same
    // test as AUTHOR IS); a row matches CITES_AUTHOR when one of its in-corpus
    // references is among them, CITED_BY_AUTHOR when one of b's papers
    // references it. Edges come from either side of the row pair, as in
    // compileRelationRule. A paper co-authored by b that cites another of b's
    // papers counts too - that is how the author panel tallies it. Walks the
    // grid's own rows (`articles`): they carry the indexed _authorExactSet and
    // the refIds edges (the only edge list the export ships).
    // An author value written as its label ("Bos, Freek", as the rule row and
    // the suggestions show it) resolves to the author's id; any other text is
    // matched in its comma-less form ("bos freek"), the form the rows index
    // names in.
    function authorRuleKey(value) {
      const raw = normalizeText(value), bare = raw.replace(/,\s*/g, " ");
      const slug = authorSlug(raw) || authorSlug(bare);
      return { exact: slug ? normalizeText(slug) : bare, text: bare };
    }
    function compileAuthorGraphRule(field, value, operator) {
      const slug = authorRuleKey(value).exact;
      const rows = articles;
      const own = new Set();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i]._authorExactSet && rows[i]._authorExactSet.has(slug)) own.add(String(rows[i].id));
      }
      // Row ids that reference one of b's papers, and ids referenced by one.
      const citing = new Set(), cited = new Set();
      if (own.size) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i], id = String(row.id);
          const refs = Array.isArray(row.refIds) ? row.refIds : [];
          for (let j = 0; j < refs.length; j++) {
            const ref = String(refs[j]);
            if (ref === id) continue;
            if (own.has(ref)) citing.add(id);       // row cites b
            if (own.has(id)) cited.add(ref);       // b cites ref
          }
        }
      }
      const hits = field === FIELDS.CITES_AUTHOR ? citing : cited;
      const negate = operator === "is not";
      return function (article) {
        const hit = hits.has(String(article.id));
        return negate ? !hit : hit;
      };
    }

    function compileAuthorRule(value, operator) {
      const key = authorRuleKey(value);
      const normalizedValue = operator === "is" || operator === "is not" ? key.exact : key.text;

      if (operator === "is") {
        return function (article) {
          return article._authorExactSet.has(normalizedValue);
        };
      }

      if (operator === "is not") {
        return function (article) {
          return !article._authorExactSet.has(normalizedValue);
        };
      }

      if (operator === "contains") {
        return function (article) {
          return article._authorSearchLc.includes(normalizedValue);
        };
      }

      if (operator === "does not contain") {
        return function (article) {
          return !article._authorSearchLc.includes(normalizedValue);
        };
      }

      throw new Error("Unknown author operator: " + operator);
    }

    function compileTextRule(fieldName, value, operator) {
      const normalizedValue = normalizeText(value);

      if (operator === "is") {
        return function (article) {
          return article[fieldName] === normalizedValue;
        };
      }

      if (operator === "is not") {
        return function (article) {
          return article[fieldName] !== normalizedValue;
        };
      }

      if (operator === "contains") {
        return function (article) {
          return String(article[fieldName] || "").includes(normalizedValue);
        };
      }

      if (operator === "does not contain") {
        return function (article) {
          return !String(article[fieldName] || "").includes(normalizedValue);
        };
      }

      throw new Error("Unknown text operator: " + operator);
    }

    // Abstract / TOC rule text. Abstracts live in the search manifest
    // (semantic-search.js exposes them); TOCs in data/toc_data.js. Lowercased
    // text is cached on the row - abstracts only once the module is ready, so
    // rules built before the manifest loads start matching after it arrives
    // (the oa-search-ready handler refreshes the DataView).
    function abstractTextLc(article) {
      if (article._absLc != null) return article._absLc;
      var ss = window.OASemanticSearch;
      var lc = "";
      if (ss && ss.getAbstractTextFor) lc = foldText(String(ss.getAbstractTextFor(article.id) || "")).toLowerCase();
      if (ss && ss.isReady && ss.isReady()) article._absLc = lc;
      return lc;
    }
    function tocTextLc(article) {
      if (article._tocLc != null) return article._tocLc;
      if (!window.TOC_DATA) return "";          // store still in flight - don't memoize ""
      var t = window.TOC_DATA[article.id];
      var s = "";
      if (t) for (var i = 0; i < t.length; i += 1) s += " " + String((t[i] && t[i][1]) || "");
      article._tocLc = foldText(s).toLowerCase();
      return article._tocLc;
    }
    function compileLookupTextRule(accessor, value, operator) {
      const needle = foldText(String(value)).trim().toLowerCase();
      if (operator === "contains") {
        if (window.OARuleHighlights) window.OARuleHighlights.push(needle);
        return function (article) { return accessor(article).indexOf(needle) !== -1; };
      }
      if (operator === "does not contain") {
        return function (article) { return accessor(article).indexOf(needle) === -1; };
      }
      throw new Error("Unknown text operator: " + operator);
    }

    // YYYY-MM is the only legal stored format.

    // Rows store YYYY-MM-DD; rules are written at month resolution, so every
    // comparison runs on the row's YYYY-MM prefix.
    function articleMonth(article) {
      return typeof article.date === "string" ? article.date.slice(0, 7) : null;
    }

    function compileDateRule(expected, operator, value2) {
      const trimmed = String(expected || "").trim();

      if (trimmed === "") {
        return function () { return true; };
      }

      if (operator === "between") {
        const end = String(value2 || "").trim();
        // A missing endpoint means the range is still being entered - treat it
        // as no filter yet rather than erroring (the masked inputs only commit
        // complete values, so this is the in-progress state, not bad data).
        if (end === "") {
          return function () { return true; };
        }
        if (!isValidYYYYMM(trimmed) || !isValidYYYYMM(end)) {
          throw new Error(
            "DATE BETWEEN expects YYYY-MM on both sides; got '" +
            trimmed + "' and '" + end + "'"
          );
        }
        const lo = trimmed <= end ? trimmed : end;     // tolerate swapped bounds
        const hi = trimmed <= end ? end     : trimmed;
        return function (article) {
          const m = articleMonth(article);
          return m != null && m >= lo && m <= hi;
        };
      }

      if (!isValidYYYYMM(trimmed)) {
        throw new Error(
          "DATE expects YYYY-MM; got '" + trimmed +
          "' (use BETWEEN for ranges)"
        );
      }

      if (operator === "=") {
        return function (article) { return articleMonth(article) === trimmed; };
      }
      if (operator === "!=") {
        return function (article) { return articleMonth(article) !== trimmed; };
      }
      if (operator === ">=") {
        return function (article) {
          const m = articleMonth(article);
          return m != null && m >= trimmed;
        };
      }
      if (operator === "<=") {
        return function (article) {
          const m = articleMonth(article);
          return m != null && m <= trimmed;
        };
      }

      throw new Error("Unknown date operator: " + operator);
    }

    // REFERENCES_OF / CITATIONS_OF / SIMILAR_TO <article id>: one article's
    // neighbours in the citation graph - the articles it references, the
    // articles citing it, and related articles that are neither. Citation
    // neighbours come from the store's in-corpus graph (built once from refIds);
    // similar ones from the row's relatedIds. An
    // empty neighbourhood - or an id with no row - matches nothing: the rule
    // is explicit, so the list shows the pinned anchor over an empty result
    // rather than silently widening to the whole corpus.
    function compileRelationRule(field, id) {
      const NONE = function () { return false; };
      const me = articleStore.getById(id);
      const ids = function (kind) {
        if (!me) return null;
        const out = new Set();
        if (kind === "similar") {
          (me.relatedIds || []).forEach(function (x) { out.add(String(x)); });
        } else {
          (kind === "references" ? articleStore.referencesOf(id) : articleStore.citationsOf(id))
            .forEach(function (x) { out.add(String(x)); });
        }
        out.delete(String(id));
        return out.size ? out : null;
      };
      if (field === FIELDS.REFERENCES_OF) {
        const refs = ids("references");
        return refs ? function (a) { return refs.has(a.id); } : NONE;
      }
      if (field === FIELDS.CITATIONS_OF) {
        const cites = ids("citations");
        return cites ? function (a) { return cites.has(a.id); } : NONE;
      }
      const sim = ids("similar");
      if (!sim) return NONE;
      const refs = ids("references") || new Set();
      const cites = ids("citations") || new Set();
      return function (a) {
        return a.id !== id && sim.has(a.id) && !refs.has(a.id) && !cites.has(a.id);
      };
    }

    return Object.freeze({ compileFromRows: compileFromRows, compileRule: compileRule, compileDateRule: compileDateRule });
  }

  window.OAGridRules = Object.freeze({ create: create });
})();
