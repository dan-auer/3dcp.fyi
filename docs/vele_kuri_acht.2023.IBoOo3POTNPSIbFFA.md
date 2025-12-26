---
hide:
    - navigation
    - tags
title: Jiří Vele, Lukáš Kurilla, Henri Achten
description:
tags:
 - analysis
 - buildability
 - flow
 - force
 - improvement
 - information
 - overhang
 - planar
 - print
 - slicing
 - non

---

#[:aca-openaccess:{ .xgreen }](http://papers.cumincad.org/data/works/att/ecaade2023_282.pdf) Improving Buildability of Overhangs of 3D Printed Objects Through Non-Planar Slicing Informed by Force-Flow-Analysis ([2023-09](date/2023/09))
<a href="https://doi.org/10.52842/conf.ecaade.2023.1.519" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.52842/conf.ecaade.2023.1.519</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/vele_jiri"><b>Vele</b> Jiří</a>
,     <a href="../../../author/kurilla_lukas"><b>Kurilla</b> Lukáš</a>
,     <a href="../../../author/achten_hubertus_henri"><b>Achten</b> Henri</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#analysis`](keyword/analysis)
    [`#buildability`](keyword/buildability)
    [`#flow`](keyword/flow)
    [`#force`](keyword/force)
    [`#improvement`](keyword/improvement)
    [`#information`](keyword/information)
    [`#overhang`](keyword/overhang)
    [`#planar`](keyword/planar)
    [`#print`](keyword/print)
    [`#slicing`](keyword/slicing)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Improving%20Buildability%20of%20Overhangs%20of%203D%20Printed%20Objects%20Through%20Non-Planar%20Slicing%20Informed%20by%20Force-Flow-Analysis" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85171888302&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.52842/conf.ecaade.2023.1.519" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.52842/conf.ecaade.2023.1.519" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.52842/conf.ecaade.2023.1.519" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.52842/conf.ecaade.2023.1.519" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.52842/conf.ecaade.2023.1.519&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.52842/conf.ecaade.2023.1.519" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.52842/conf.ecaade.2023.1.519&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4386814874" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.52842/conf.ecaade.2023.1.519" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.52842/conf.ecaade.2023.1.519?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    The traditional method of data preparation for 3D printing, known as planar slicing, involves slicing the 3D model into horizontal layers and printing them gradually. This is the simplest option with the main parameter being layer height. However, this method has several limitations, including poor surface finish with stair-stepping contours of layers at steep angles and a necessity to print additional support structure for overhangs. Nonplanar slicing is a newer method that involves slicing the 3D model into non-horizontal layers with varying layer heights. This technique is mostly explored in plastics, with observed improvements in buildability, surface finish and reduction of cracking alongside the layers. In construction scale, non-planar printing is used primarily for achieving unique surface finish, or for printing on an uneven base. Its potential for improving buildability is still yet to be properly tested. This paper examines how non-planar layers can be derived with a help of force flow lines and how it affects the buildability. While printing overhangs, shear force can ultimately break the interlayer bond and layers can start deforming and sliding on top of each other, resulting in buckling, or even collapse. By guiding these forces into the bulk of layers instead of interlayer bonds, printing capabilities can be improved. Goal of this paper is to present how buildability of overhangs can be improved using non-planar slicing. Non-planar layers are derived from force flow line simulations done in Karamba3D. For printing we use clay, as a fast and simple prototyping method with the aim to later utilise our findings into concrete printing.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/breseghello_luca"><b>Breseghello</b> Luca</a>, <a href="../../../author/naboni_roberto"><b>Naboni</b> Roberto</a> <a href="../../../date/2021/07">(2021-07)</a><br><a href="../../../bres_nabo.2022.ATP/">Adaptive Tool-Path:<br/>Enhanced Design and Process-Control for Robotic 3DCP</a></li>
      <li><a href="../../../author/carneau_paul"><b>Carneau</b> Paul</a>, <a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a>, <a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a>, <a href="../../../author/baverel_olivier"><b>Baverel</b> Olivier</a> <a href="../../../date/2020/04">(2020-04)</a><br><a href="../../../carn_mesn_rous_bave.2020.AMoC/">Additive Manufacturing of Cantilever:<br/>From Masonry to Concrete 3D Printing</a></li>
      <li><a href="../../../author/khajavi_haghighat_siavash"><b>Khajavi</b> Siavash</a>, <a href="../../../author/tetik_muge"><b>Tetik</b> Müge</a>, <a href="../../../author/mohite_ashish"><b>Mohite</b> Ashish</a>, <a href="../../../author/peltokorpi_antti"><b>Peltokorpi</b> Antti</a> et al. <a href="../../../date/2021/04">(2021-04)</a><br><a href="../../../khaj_teti_mohi_pelt.2021.AMitCI/">Additive Manufacturing in the Construction Industry:<br/>The Comparative Competitiveness of 3D Concrete Printing</a></li>
      <li>None</li>
      <li><a href="../../../author/li_shuai"><b>Li</b> Shuai</a>, <a href="../../../author/nguyen-xuan_hung"><b>Nguyen-Xuan</b> Hung</a>, <a href="../../../author/tran_phuong_jonathan"><b>Tran</b> Jonathan</a> <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../li_nguy_tran.2023.DDaPSo3CPoNPS/">Digital Design and Parametric Study of 3D Concrete Printing on Non-Planar Surfaces</a></li>
      <li><a href="../../../author/liu_xuanting"><b>Liu</b> Xuanting</a>, <a href="../../../author/sun_bohua"><b>Sun</b> Bohua</a> <a href="../../../date/2021/11">(2021-11)</a><br><a href="../../../liu_sun.2021.TIoIotSSi3CPP/">The Influence of Interface on the Structural Stability in 3D Concrete Printing Processes</a></li>
      <li><a href="../../../author/mohan_k_manu"><b>Mohan</b> Manu</a>, <a href="../../../author/rahul_vijayan_attupurathu"><b>Rahul</b> Attupurathu</a>, <a href="../../../author/schutter_geert"><b>Schutter</b> Geert</a>, <a href="../../../author/tittelboom_kim"><b>Tittelboom</b> Kim</a> <a href="../../../date/2020/10">(2020-10)</a><br><a href="../../../moha_rahu_schu_titt.2021.EBC3PfaMP/">Extrusion-Based Concrete 3D Printing from a Material Perspective:<br/>A State of the Art Review</a></li>
      <li><a href="../../../author/rahul_vijayan_attupurathu"><b>Rahul</b> Attupurathu</a>, <a href="../../../author/santhanam_manu"><b>Santhanam</b> Manu</a>, <a href="../../../author/meena_hitesh"><b>Meena</b> Hitesh</a>, <a href="../../../author/ghani_zimam"><b>Ghani</b> Zimam</a> <a href="../../../date/2019/08">(2019-08)</a><br><a href="../../../rahu_sant_meen_ghan.2019.MCo3PC/">Mechanical Characterization of 3D Printable Concrete</a></li>
      <li><a href="../../../author/vallurupalli_kavya"><b>Vallurupalli</b> Kavya</a>, <a href="../../../author/farzadnia_nima"><b>Farzadnia</b> Nima</a>, <a href="../../../author/khayat_h_kamal"><b>Khayat</b> Kamal</a> <a href="../../../date/2021/01">(2021-01)</a><br><a href="../../../vall_farz_khay.2021.EoFBaPIVoSSo3PE/">Effect of Flow Behavior and Process-Induced Variations on Shape Stability of 3D Printed Elements:<br/>A Review</a></li>
      <li><a href="../../../author/vele_jiri"><b>Vele</b> Jiří</a>, <a href="../../../author/prokop_simon"><b>Prokop</b> Simon</a>, <a href="../../../author/ciganik_ondrej"><b>Ciganik</b> Ondrej</a>, <a href="../../../author/kurilla_lukas"><b>Kurilla</b> Lukáš</a> et al. <a href="../../../date/2024/09">(2024-09)</a><br><a href="../../../vele_prok_ciga_kuri.2024.NP3PoCC/">Non-Planar 3D Printing of Clay Columns:<br/>A Method for Improving Stability and Performance</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/marco_giancarlo"><b>Marco</b> Giancarlo</a>, <a href="../../../author/asta_c_j"><b>Asta</b> J.</a> <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../marc_asta.2025.N/">Neobrutalism:<br/>The Digital and Cultural Micro-Landscape of 3D-Printed Concrete</a></li>
      <li><a href="../../../author/vele_jiri"><b>Vele</b> Jiří</a>, <a href="../../../author/prokop_simon"><b>Prokop</b> Simon</a>, <a href="../../../author/ciganik_ondrej"><b>Ciganik</b> Ondrej</a>, <a href="../../../author/kurilla_lukas"><b>Kurilla</b> Lukáš</a> et al. <a href="../../../date/2024/09">(2024-09)</a><br><a href="../../../vele_prok_ciga_kuri.2024.NP3PoCC/">Non-Planar 3D Printing of Clay Columns:<br/>A Method for Improving Stability and Performance</a></li>
      <li><a href="../../../author/dimitriou_savvas"><b>Dimitriou</b> Savvas</a>, <a href="../../../author/kontovourkis_odysseas"><b>Kontovourkis</b> Odysseas</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../dimi_kont.2024.FFB3PoSEIbtTAoCV/">Force-Flow Based 3D Printing of Structural Elements Inspired by the Traditional Architecture of Cross-Vaults</a></li>
    </ol>
</div>
