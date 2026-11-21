/* replacement_data.js - words shown typeset: chemical formulas, ions, unit
 * powers (CO2 -> CO₂, m3 -> m³, Ca2+ -> Ca²⁺). Hand-edited; read by
 * src/javascript/oa-typeset.js, which also lets search find either spelling.
 *
 * window.REPLACEMENT_DATA: [{ list, before?, after?, unless? }, ...]
 *   list    entries. "_" subscripts the digits after it, "^" superscripts the
 *           digits and +/- signs after it; the word matched is the entry
 *           without "_" and "^", in any spelling ("CO2", "CO₂" and a mistyped
 *           "CO²" all show as CO₂). Case-sensitive: "Co" is cobalt.
 *           "word=display" spells the match out where it differs from the
 *           display: typos ("Bacl2=BaCl_2") and formulas split by a space in
 *           the source ("CO 2", from PDF extraction). There "~" is an
 *           invisible word joiner taking the removed space's place.
 *           The display must have exactly as many characters as the word
 *           (an entry that does not is skipped with a console warning).
 *   before  regex lookbehind replacing the default (?<![A-Za-z]) - words match
 *           whole, but a leading number is fine ("2H2O", "95m2")
 *   after   regex lookahead replacing the default (?![A-Za-z0-9])
 *   unless  regex source; the group is skipped for any text it matches
 *
 * Built from two scans of every title, subtitle, abstract sentence and TOC
 * entry, plus the keywords (Oct 2026); counts are occurrences in the data.
 *
 * Found by the scans but deliberately NOT typeset (labels, codes, names):
 *   S1 S2 C1 C2 B1 P1 W1 V3 U1 K30 ... specimen / mix / case labels
 *   C30 C35 C40, C109 C1437 C1609     strength classes, ASTM standards
 *   HSF2 SF3 NKC0 O70F30 S0F60 CS12   mix designations
 *   M3C2 C2M C2C                      point-cloud comparison algorithms
 *   Ti6Al4V                           alloy grade (mass %, not a formula)
 *   SANS-3001-CO3-3, DeepLabV3+       standard number, model name
 *   L2 W2 t2, Y- B+ OPC- P-           variables, suspended hyphens
 *   x100 x1000, "10-20%"              magnifications and ranges, not powers
 *   "100 mm 3DPC", "29 m 3D printed"  a number that starts the next word
 *   1 x 10^7 (once)                   the caret form would change the length
 */
window.REPLACEMENT_DATA = [
  { // Formulas. CO2 668, SiO2 72, TiO2 47, CaCO3 47, Ca(OH)2 30, Na2SiO3 21,
    // H2O 20 (incl. hydrates), Al2O3 19, Na2O 17, CaCl2 13, CaSO4 10 ...
    list: [
      "CO_2", "SiO_2", "TiO_2", "CaCO_3", "Ca(OH)_2", "Al_2O_3", "Na_2SiO_3", "Na_2O",
      "CaCl_2", "H_2O", "CaSO_4", "K_2HPO_4", "Ca(NO_3)_2", "H_2SO_4", "MgSO_4", "Fe_3O_4",
      "Fe_2O_3", "Bi_2O_3", "Gd_2O_3", "K_2SO_4", "Na_2S_2O_3", "Li_2O", "SiO_4", "AlO_4",
      "Ca_4Al_6SO_16", "Ca_2SiO_4", "C_2H_4", "Li_2CO_3", "Na_2SO_4", "Na_2CO_3", "K_2SiO_3",
      "KMnO_4", "MgCl_2", "Mg(OH)_2", "H_2O_2", "WS_2", "Ca_4Al_2Fe_2O_10", "Na_2B_4O_7",
      "NaC_6H_11O_7", "Zn(NO_3)_2", "Li_2SiO_3", "AlPO_4", "C_17H_35", "CH_3", "CH_4", "SO_2",
      "NH_4Cl", "K_3Na(SO_4)_2", "P_2O_5", "MgSiO_3", "N_2O", "K_2CO_3", "NaSiO_3", "NCaCO_3",
      "N_2", "Al_2(SO_4)_3", "NO_3"
    ]
  },
  { // Cement chemistry notation: C3S 14, C3A 12, C2S 5, AH3 3.
    list: ["C_3S", "C_2S", "C_3A", "AH_3"]
  },
  { // CO2 inside compound units and labels: CO2e 8, CO2eq 7, kgCO2eq 3, ECO2e 2;
    // co2 is the lowercase keyword (#co2, 35 papers).
    list: ["CO_2e", "CO_2eq", "kgCO_2", "kgCO_2eq", "gCO_2", "ECO_2e", "co_2"]
  },
  { // Ions: Ca2+ 6, SO42- 4, Cl- 3, K+ 2, Al3+ 1.
    list: ["Ca^2+", "Al^3+", "K^+", "Cl^-", "SO_4^2-"]
  },
  { // NMR nuclei: 29Si 5, 27Al 1 - mass number in front.
    list: ["^29Si", "^27Al"]
  },
  { // 1H 8 - only as the NMR nucleus ("1H NMR", "1H LF NMR").
    list: ["^1H"],
    after: "(?=\\s(?:LF\\s)?NMR)"
  },
  { // Particle-size percentiles: D50 3, D10 1, D90 1.
    list: ["D_10", "D_50", "D_90"]
  },
  { // Areas and volumes: m3 180, m2 104, cm3 19, mm2 19, mm3 10, cm2 5, m2K 16, ft2 2.
    list: ["m^2", "m^3", "cm^2", "cm^3", "mm^2", "mm^3", "m^2K", "ft^2"]
  },
  { // Reciprocal units: s-1 20, K-1 6, m-1 5, cm-3 4, mg-1 3, min-1 2, kg-1 2 ...
    // Only after a number, a space, a product dot, a slash or "(": "10 s-1",
    // "W·m-1·K-1", "2.42 mW mg-1" - never inside a word or a label.
    list: ["s^-1", "min^-1", "m^-1", "m^-2", "K^-1", "kg^-1", "mg^-1", "cm^-3", "dm^-3"],
    before: "(?<=[0-9\\s\\u00B7\\u22C5/(])"
  },
  { // Scientific notation: "6.99×10-12" -> 6.99×10⁻¹² (22). Only after × or x.
    list: [
      "10^-1", "10^-2", "10^-3", "10^-4", "10^-5", "10^-6", "10^-7", "10^-8", "10^-9", "10^-10",
      "10^-11", "10^-12", "10^-13", "10^-14", "10^-15", "10^-16", "10^-17", "10^-18", "10^-19"
    ],
    before: "(?<=[\\u00D7x]\\s?)",
    after: "(?![0-9])"
  },
  { // Limestone calcined clay cement LC3 ~230 (and mixes named after it), and
    // its clay-limestone blend LC2 56.
    list: ["LC^3", "LC^2", "FRFLC^3", "3DPLC^3"]
  },
  { // Coefficient of determination, R2 ~90 - but not where R1 / R3 make it a
    // label in a series ("R1.6 & R2" rebars, "Case-R3").
    list: ["R^2"],
    unless: "(?<![A-Za-z0-9])R[13](?![0-9])"
  },
  { // Split by a space in the source: CO 2 13 ("Low CO 2 Printable Concrete"),
    // C 3 S 2, KH2 PO4 1.
    list: ["CO 2=CO_2~", "C 3 S=C_3S~~", "KH2 PO4=KH_2PO_4~"]
  },
  { // Split areas, after a number only: "1.5 m 2 and", "1 m 2 of wall" (2).
    list: ["m 2=m^2~"],
    before: "(?<=[0-9]\\s)"
  },
  { // Split R2 before its value: "R 2 ≈ 0.99" (1).
    list: ["R 2=R^2~"],
    after: "(?=\\s?[=\\u2248<>\\u2264\\u2265])"
  },
  { // Typos in the source: Bacl₂ 1.
    list: ["Bacl2=BaCl_2"]
  },
  { // Typo in the source: "2h₂o" 1 (hydrate) - after a number only.
    list: ["h2o=H_2O"],
    before: "(?<=[0-9])"
  },
  { // Degree sign: "20 ºC" 2 (ordinal º instead of °).
    list: ["\u00BAC=\u00B0C"]
  },
  { // Degree sign: "1.12 oC·h" 1 - after a number only.
    list: ["oC=\u00B0C"],
    before: "(?<=[0-9]\\s?)"
  },
  { // Empty parentheses, a symbol the source lost: "yield stress ()," 15.
    // Hidden together with the space in front of them, after a non-space only.
    list: [" ()=~~~"],
    before: "(?<=\\S)"
  }
];
