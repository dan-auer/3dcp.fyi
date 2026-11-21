/* Citation presentation only. bibliography.js owns record/name/type/DOI
 * normalization and all BibTeX serialization. Stored title case is preserved:
 * automatic sentence casing cannot reliably recognize proper or technical names.
 */
(function () {
  "use strict";
  var bibliography = window.OABibliography;   // loaded before this (index.html order)

  function text(value) { return value == null ? "" : String(value).trim(); }
  function initials(given) {
    return text(given).split(/\s+/).map(function (part) {
      return part.split("-").map(function (segment) {
        return segment ? segment.charAt(0).toUpperCase() + "." : "";
      }).join("-");
    }).join(" ");
  }
  function authors(record) {
    return record.authors.map(function (author) { return bibliography.resolveAuthorName(author); });
  }
  function ieeeAuthors(list) {
    var names = list.map(function (author) {
      return [initials(author.given), author.family].filter(Boolean).join(" ");
    });
    if (names.length > 6) return names[0] + " et al.";
    if (names.length < 2) return names[0] || "";
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }
  function apaAuthors(list) {
    var names = list.map(function (author) {
      return author.family + (author.given ? ", " + initials(author.given) : "");
    });
    if (names.length < 2) return names[0] || "";
    if (names.length > 20) return names.slice(0, 19).join(", ") + ", … " + names[names.length - 1];
    return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
  }
  function chicagoAuthors(list) {
    var names = list.map(function (author, index) {
      return index === 0 ? author.family + (author.given ? ", " + author.given : "")
        : [author.given, author.family].filter(Boolean).join(" ");
    });
    if (names.length < 2) return names[0] || "";
    return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
  }
  function doiMd(doi, asUrl) {
    var clean = bibliography.normalizeDoi(doi);
    if (!clean) return "";
    var href = "https://doi.org/" + clean.replace(/[()<>\[\]]/g, function (ch) {
      return "%" + ch.charCodeAt(0).toString(16).toUpperCase();
    });
    return "[" + (asUrl ? "https://doi.org/" : "") + clean + "](" + href + ")";
  }
  // Italics are marked with U+0001, a character no record holds, not with
  // markdown's "*": a venue such as "Assistent*innen-Tagung" has a star of
  // its own, which ended the italics early and dropped out of the copy.
  var IT = "\u0001";
  function italic(value) { return text(value) ? IT + text(value) + IT : ""; }
  function join(parts, separator) { return parts.filter(function (part) { return text(part); }).join(separator || ", "); }
  function pages(locator) {
    if (!locator.value) return "";
    return (locator.kind === "range" ? "pp. " : locator.kind === "article" ? "Art. no. " : "p. ") + locator.value;
  }
  function isCollection(type) { return type === "inproceedings" || type === "incollection" || type === "inbook"; }
  function isThesis(type) { return type === "phdthesis" || type === "mastersthesis"; }
  function standaloneDetails(record, type) {
    var parts = [];
    if (record.edition) parts.push(text(record.edition) + " ed.");
    if (isThesis(type)) {
      parts.push(record.thesisType || (/bachelor|undergraduate/i.test(text(record.type)) ? "Bachelor's thesis" : type === "mastersthesis" ? "Master's thesis" : "Doctoral dissertation"));
      parts.push(record.school || record.institution || record.university || record.venue);
    } else if (type === "techreport") {
      parts.push(record.institution || record.venue || record.publisher);
      var number = record.number != null ? record.number : record.issue;
      if (number) parts.push((record.reportType || "Report") + " " + number);
    } else parts.push(record.publisher || record.organization || record.venue);
    parts.push(record.address || record.location);
    return join(parts);
  }

  function ieee(record) {
    var type = bibliography.entryType(record);
    var loc = bibliography.locator(record);
    var y = bibliography.year(record);
    var source = [];
    var title = bibliography.fullTitle(record);
    var author = ieeeAuthors(authors(record));
    if (type === "article") {
      source.push(italic(record.journal || record.venue));
      if (record.volume) source.push("vol. " + record.volume);
      if (record.issue || record.number) source.push("no. " + (record.issue || record.number));
      source.push(pages(loc), y);
    } else if (isCollection(type)) {
      var container = record.booktitle || record.venue;
      if (container) source.push("in " + italic(container));
      source.push(record.publisher, record.address || record.location, y, pages(loc));
    } else source.push(standaloneDetails(record, type), y);
    if (record.doi) source.push("doi: " + doiMd(record.doi));
    var tail = join(source);
    var prefix = author ? author + ", " : "";
    if (type !== "article" && !isCollection(type)) return prefix + italic(title) + (tail ? ", " + tail : "") + ".";
    return prefix + '"' + title + (tail ? '," ' + tail + "." : '."');
  }

  function cmos(record) {
    var type = bibliography.entryType(record);
    var loc = bibliography.locator(record);
    var y = bibliography.year(record);
    var author = chicagoAuthors(authors(record));
    var title = bibliography.fullTitle(record);
    var output = author ? author + ". " : "";
    if (type === "article") {
      output += '"' + title + '."';
      var source = italic(record.journal || record.venue);
      if (record.volume) source += (source ? " " : "") + record.volume;
      if (record.issue || record.number) source += (source ? ", " : "") + "no. " + (record.issue || record.number);
      if (y) source += (source ? " " : "") + "(" + y + ")";
      if (loc.value) source += (source ? ": " : "") + loc.value;
      if (source) output += " " + source + ".";
    } else if (isCollection(type)) {
      output += '"' + title + '."';
      var container = record.booktitle || record.venue;
      var parts = [container ? "In " + italic(container) : ""];
      if (record.editors.length) {
        var editors = record.editors.map(function (editor) {
          var name = bibliography.resolveAuthorName(editor);
          return [name.given, name.family].filter(Boolean).join(" ");
        });
        parts.push("edited by " + join(editors));
      }
      parts.push(loc.value, record.publisher, record.address || record.location, y);
      var details = join(parts);
      if (details) output += " " + details + ".";
    } else {
      output += italic(title) + ".";
      var standalone = join([standaloneDetails(record, type), y]);
      if (standalone) output += " " + standalone + ".";
    }
    if (record.doi) output += " " + doiMd(record.doi, true) + ".";
    return output;
  }

  function apa(record) {
    var type = bibliography.entryType(record);
    var loc = bibliography.locator(record);
    var author = apaAuthors(authors(record));
    var title = bibliography.fullTitle(record);
    var output = (author ? author + " " : "") + "(" + (bibliography.year(record) || "n.d.") + "). ";
    output += (type === "article" || isCollection(type) ? title : italic(title)) + ".";
    if (type === "article") {
      var source = italic(record.journal || record.venue);
      if (record.volume) {
        source += (source ? ", " : "") + italic(record.volume);
        if (record.issue || record.number) source += "(" + (record.issue || record.number) + ")";
      }
      if (loc.value) source += (source ? ", " : "") + (loc.kind === "article" ? "Article " : "") + loc.value;
      if (source) output += " " + source + ".";
    } else if (isCollection(type)) {
      var container = record.booktitle || record.venue;
      var parts = [container ? "In " + italic(container) : ""];
      if (loc.value) parts.push("(" + pages(loc) + ")");
      var publication = join(parts, " ");
      if (publication) output += " " + publication + ".";
      if (record.publisher) output += " " + record.publisher + ".";
    } else {
      var details = standaloneDetails(record, type);
      if (details) output += " " + details + ".";
    }
    if (record.doi) output += " " + doiMd(record.doi, true);
    return output;
  }

  var escapeHtml = window.OATheme.escapeHtml;
  var IT_RE = /\u0001([^\u0001]*)\u0001/g;
  function mdToPlain(md) {
    return String(md).replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(IT_RE, "$1");
  }
  function mdToHtml(md) {
    return escapeHtml(md).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(IT_RE, "<i>$1</i>");
  }
  // First entry is the default reference style (articles-grid.js citeStyle()
  // falls back to it) and leads the settings dropdown.
  window.CITE_STYLES = ["Chicago", "IEEE", "APA"];
  window.formatCitation = function (input, style) {
    var record = bibliography.normalizeRecord(input);
    switch (String(style || "").toUpperCase()) {
      case "IEEE": return ieee(record);
      case "CHICAGO": return cmos(record);
      case "APA": return apa(record);
      default: return "";
    }
  };
  window.formatCitationRich = function (record, style) {
    var markdown = window.formatCitation(record, style);
    return { plain: mdToPlain(markdown), html: mdToHtml(markdown) };
  };
})();
