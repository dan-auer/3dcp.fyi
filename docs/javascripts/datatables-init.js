document.addEventListener("DOMContentLoaded", () => {
  // If you have multiple tables, scope this selector as needed.
  const el = document.querySelector("#authorlist");
  if (!el) return;

  new DataTable(el, {
  "autoWidth": false,     
   "language":{
        "searchBuilder": 
        {
          "add": '+',
          "button": 'Filter',
          "condition": 'Comparator',
          "clearAll": 'Reset',
          "delete": 'Delete',
          "deleteTitle": 'Delete Title',
          "data": 'Column',
          "left": '←',
          "leftTitle": 'Left Title',
          "logicAnd": 'AND',
          "logicOr": 'OR',
          "right": '→',
          "rightTitle": 'Right Title',
          "title":
          {
            0:  '',
            _:  'Filters (%d)'
          },
          "value": 'Option',
          "valueJoiner": 'et'
        }
   },
   "layout":{
      "topStart":{
         "buttons":[
            {
               "extend":"searchBuilder",
               "config":{
                  "depthLimit":3
               }
            },
            {
               "extend":"colvis",
               "text":"Show Columns"
            },
            {
               "extend":"csv",
               "text":"CSV",
               "className":"btn-space",
               "exportOptions":{
                  "orthogonal":null,
                  "columns":[
                     0,
                     1
                  ]
               }
            }
         ]
      },
      "topEnd":"paging",
   },
   "lengthMenu":[
      10,
      25,
      50,
      -1
   ],
   "pageLength":50,
   "select":true,
   "colReorder":true,
   "order" : [[4, 'desc'], [0, 'asc']],
   "columnDefs":[
    { targets: 0, width: "20%" },    // authors
    { targets: 1, width: "30%" },    // title
    { targets: 2, width: "10%" },    // venue
    { targets: 3, width: "20%" },    // kw
    { targets: 4, width: "5%" },    // date
    { targets: 5, width: "15%" },    // doi
      {
         "targets":[3,5],
         "visible":false,
         "searchable":true
      },

{
  targets: [0, 3], // author & keyword column
  render: function (data, type) {
    const N = 2; // show first N entries
    const html = (data ?? "").toString();

    // --- tokenize HTML into comma-delimited "items" without breaking tags ---
    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    const htmlTokens = [];
    let buf = "";

    const flush = () => {
      const t = buf.trim();
      if (t) htmlTokens.push(t);
      buf = "";
    };

    for (const node of Array.from(wrap.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        // split text nodes on commas, but keep markup around them intact
        const pieces = node.nodeValue.split(",");
        for (let i = 0; i < pieces.length; i++) {
          if (i > 0) flush();      // comma boundary => end current token
          buf += pieces[i];
        }
      } else {
        buf += node.outerHTML;     // keep element HTML intact
      }
    }
    flush();

    // plain-text per token (for SB / sorting / searching)
    const textTokens = htmlTokens
      .map(h => {
        const d = document.createElement("div");
        d.innerHTML = h;
        return (d.textContent || "").trim();
      })
      .filter(Boolean);

    // --- SearchBuilder orthogonal channel as ARRAY ---
    if (type === "sb") return textTokens;

    // --- Display: show first N items, keep HTML intact ---
    if (type === "display" || type === "_") {
      const shown = htmlTokens.slice(0, N).join(", ");
      const rest = htmlTokens.length - N;

      const fullText = textTokens.join(", ");
      const escAttr = (s) => String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

      const abbreviated = rest > 0 ? `${shown}, … (+${rest})` : shown;

      return `<span title="${escAttr(fullText)}">${abbreviated}</span>`;
    }

    // --- Core DataTables expects strings for these channels ---
    if (type === "filter" || type === "search" || type === "sort" || type === "type") {
      return textTokens.join(", ");
    }

    // fallback
    return textTokens.join(", ");
  },

  searchBuilder: { orthogonal: "sb" },
  searchBuilderType: "array",
}
   ],
   "columnControl":[
      "order"
   ],
   "ordering":{
      "indicators":false,
      "handler":false
   }
});
});
