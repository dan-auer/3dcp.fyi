/* paper_affiliations_sample.js - window.OA_PAPER_AFFILIATIONS_SAMPLE: the
 * institutions of each author on six papers, for the Affiliations map in the
 * table's right-margin panel (src/javascript/paper-affiliation-map.js).
 *
 * { "<paper id>": { "<author id>": ["<ROR ID>", ...] } } - one or two ROR IDs
 * per author, primary first; ids as in data/tabular_data.js, places in
 * data/affiliation_data.js. Hand-picked for the design, not taken from the
 * papers. Once tabular_data.js carries ror per author, that wins and this file
 * can go.
 */
window.OA_PAPER_AFFILIATIONS_SAMPLE = {
  "nefs_over_sale_suik.2022.CoMPo3PSHCCWOPS": {
    "nefs_karsten": ["02c2kyt77"],
    "van_overmeir_anne": ["02e2c7k09"],
    "salet_theo": ["02c2kyt77"],
    "suiker_akke": ["02c2kyt77"],
    "savija_branko": ["02e2c7k09"],
    "schlangen_erik": ["02e2c7k09"],
    "bos_freek": ["02kkvpp62","02c2kyt77"]
  },
  "tao_titt_rahu_wang.2024.SMfSoDoDC": {
    "tao_yaxin": ["05a28rw58","00cv9y106"],
    "van_tittelboom_kim": ["00cv9y106"],
    "rahul_attupurathu": ["00cv9y106"],
    "wangler_timothy": ["05a28rw58"],
    "lloret-fritschi_ena": ["05a28rw58"],
    "flatt_robert": ["05a28rw58"],
    "de_schutter_geert": ["00cv9y106"]
  },
  "vasi_hack_klof_lowk.2022.DFiCC": {
    "vasilic_ksenija": ["010nsgg66"],
    "hack_norman": ["010nsgg66"],
    "kloft_harald": ["010nsgg66"],
    "lowke_dirk": ["010nsgg66"],
    "mechtcherine_viktor": ["042aqky30"],
    "nerella_venkatesh": ["042aqky30"],
    "wangler_timothy": ["05a28rw58"]
  },
  "ding_xiao_mech.2023.MaMPoILRiEB3PC": {
    "ding_tao": ["03rc6as71"],
    "xiao_jianzhuang": ["03rc6as71"],
    "mechtcherine_viktor": ["042aqky30"]
  },
  "weng_li_wong_tan.2021.SCaBADSfILBSEi3CP": {
    "weng_yiwei": ["0030zas98","02e7b5302"],
    "li_mingyang": ["02e7b5302"],
    "wong_teck": ["02e7b5302"],
    "tan_ming": ["02e7b5302"]
  },
  "auer_bos_fisc.2024.3f": {
    "auer_daniel": ["02kkvpp62"],
    "bos_freek": ["02kkvpp62"],
    "fischer_oliver": ["02kkvpp62"]
  }
};
