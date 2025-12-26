---
hide:
    - navigation
    - tags
title: Lukas Lachmayer, Tobias Recker, Virama Ekanayaka, André Hürkamp, Annika Raatz
description:
tags:
 - additive
 - automation
 - base
 - concrete
 - framework
 - industry
 - large
 - manufacturing
 - model
 - multi
 - print
 - robot
 - scale
 - a
 - multi

---

#:aca-closedaccess:{ .xred '} Multi-Model-Based Additive Manufacturing:<br/>:aca-blank: A Framework for Automated Large-Scale 3D Concrete Printing with Industrial Robots ([2024-10](date/2024/10))
<a href="https://doi.org/10.1109/case59546.2024.10711326" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1109/case59546.2024.10711326</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a> <a href="https://orcid.org/0000-0001-8070-8989" title="ORCID: 0000-0001-8070-8989" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/recker_tobias"><b>Recker</b> Tobias</a> <a href="https://orcid.org/0000-0003-1632-0538" title="ORCID: 0000-0003-1632-0538" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/ekanayaka_virama"><b>Ekanayaka</b> Virama</a> <a href="https://orcid.org/0000-0003-3949-0310" title="ORCID: 0000-0003-3949-0310" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/hurkamp_andre"><b>Hürkamp</b> André</a> <a href="https://orcid.org/0000-0001-6809-7118" title="ORCID: 0000-0001-6809-7118" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a> <a href="https://orcid.org/0000-0002-1697-1907" title="ORCID: 0000-0002-1697-1907" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#additive`](keyword/additive)
    [`#automation`](keyword/automation)
    [`#base`](keyword/base)
    [`#concrete`](keyword/concrete)
    [`#framework`](keyword/framework)
    [`#industry`](keyword/industry)
    [`#large`](keyword/large)
    [`#manufacturing`](keyword/manufacturing)
    [`#model`](keyword/model)
    [`#multi`](keyword/multi)
    [`#print`](keyword/print)
    [`#robot`](keyword/robot)
    [`#scale`](keyword/scale)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Multi-Model-Based%20Additive%20Manufacturing" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85208256597&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001361783102033" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1109/case59546.2024.10711326" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1109/case59546.2024.10711326" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1109/case59546.2024.10711326" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1109/case59546.2024.10711326" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1109/case59546.2024.10711326&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1109/case59546.2024.10711326" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1109/case59546.2024.10711326&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4403675063" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1109/case59546.2024.10711326" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1109/case59546.2024.10711326?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    With the advent of concrete additive manufacturing in construction (AMC), three new challenges have arisen in planning, automatizing, and controlling 3D printing processes and systems. Firstly, most manufactured construction components are single-walled elements such as walls, hollow columns, or pillars. In contrast to common design rules for AM processes, these require explicit print path planning with a wall thickness equal to a single layer width. Secondly, the printing materials - fresh concrete, mortar, or earth - provide a protracted time-dependent compressive strength development. This behavior must be explicitly considered during print path design to prevent component collapse caused by excessive compression loads. Thirdly, there is a significant challenge emerging from the required component size. Printing on a building scale level requires large or even mobile on-site printing systems. Such systems generally do not provide an enclosed workspace to protect the printing process from environmental influences. Environmental influences however affect the material behavior while printing, leading to deviations between as-planned and as-built layer geometries.This publication presents a framework tackling the three challenges by incorporating path planning for components with single-layer wall thickness, considering time-dependent material behavior, and compensating for external influences. The framework extends state-of-the-art path planning and printing control approaches to enable automatized robotic additive manufacturing processes in construction. As part of the framework we specifically contribute a path planning algorithm for the 2.5D and 3D production of single-walled components, algorithmic coupling of path planning and FEM simulation to predict and ensure component stability, and an online control approach to compensation for environmental disturbances. The framework was tested by printing a column with a footprint of approximately 1.5 m 2 and a height of 2 m using Shotcrete 3D Printing (SC3DP).

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a>, <a href="../../../author/pradena_mauricio"><b>Pradena</b> Mauricio</a>, <a href="../../../author/kreiger_l_eric"><b>Kreiger</b> Eric</a> et al. <a href="../../../date/2022/03">(2022-03)</a><br><a href="../../../bos_menn_prad_krei.2022.TRoAMCSiP/">The Realities of Additively Manufactured Concrete Structures in Practice</a></li>
      <li><a href="../../../author/ekanayaka_virama"><b>Ekanayaka</b> Virama</a>, <a href="../../../author/hurkamp_andre"><b>Hürkamp</b> André</a> <a href="../../../date/2023/03">(2023-03)</a><br><a href="../../../ekan_hurk.2023.IoaSMfaNPBFESfAMPiC/">Implementation of a Surrogate-Model for a Novel Path‐Based Finite-Element-Simulation for Additive Manufacturing-Processes in Construction</a></li>
      <li><a href="../../../author/ekanayaka_virama"><b>Ekanayaka</b> Virama</a>, <a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a>, <a href="../../../author/hurkamp_andre"><b>Hürkamp</b> André</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../ekan_lach_raat_hurk.2022.AtOtILWTiAMwCUFM/">Approach to Optimize the Inter-Layer Waiting Time in Additive Manufacturing with Concrete Utilizing FEM Modeling</a></li>
      <li><a href="../../../author/ibrahim_serhat"><b>Ibrahim</b> Serhat</a>, <a href="../../../author/olbrich_alexander"><b>Olbrich</b> Alexander</a>, <a href="../../../author/lindemann_hendrik"><b>Lindemann</b> Hendrik</a>, <a href="../../../author/gerbers_roman"><b>Gerbers</b> Roman</a> et al. <a href="../../../date/2018/02">(2018-02)</a><br><a href="../../../ibra_olbr_lind_gerb.2018.AAMoCSwF/">Automated Additive Manufacturing of Concrete Structures without Formwork:<br/>Concept for Path-Planning</a></li>
      <li><a href="../../../author/kloft_harald"><b>Kloft</b> Harald</a>, <a href="../../../author/gehlen_christoph"><b>Gehlen</b> Christoph</a>, <a href="../../../author/dorfler_kathrin"><b>Dörfler</b> Kathrin</a>, <a href="../../../author/hack_peter_norman"><b>Hack</b> Norman</a> et al. <a href="../../../date/2021/01">(2021-01)</a><br><a href="../../../klof_gehl_dorf_hack.2021.T2/">TRR 277:<br/>Additive Manufacturing in Construction</a></li>
      <li><a href="../../../author/kloft_harald"><b>Kloft</b> Harald</a>, <a href="../../../author/gehlen_christoph"><b>Gehlen</b> Christoph</a>, <a href="../../../author/dorfler_kathrin"><b>Dörfler</b> Kathrin</a>, <a href="../../../author/hack_peter_norman"><b>Hack</b> Norman</a> et al. <a href="../../../date/2021/06">(2021-06)</a><br><a href="../../../klof_gehl_dorf_hack.2021.T2b/">TRR 277:<br/>Additive Manufacturing in Construction</a></li>
      <li><a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/bohler_david"><b>Böhler</b> David</a>, <a href="../../../author/freund_niklas"><b>Freund</b> Niklas</a>, <a href="../../../author/mai-nee-dressler_inka"><b>Mai (née Dressler)</b> Inka</a> et al. <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../lach_bohl_freu_mai.2023.MtIoMaPPoS3PS/">Modelling the Influence of Material and Process Parameters on Shotcrete 3D Printed Strands:<br/>Cross-Section Adjustment for Automatic Robotic Manufacturing</a></li>
      <li><a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/dorrie_robin"><b>Dörrie</b> Robin</a>, <a href="../../../author/kloft_harald"><b>Kloft</b> Harald</a>, <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../lach_dorr_klof_raat.2022.PCfAMoCC/">Process-Control for Additive Manufacturing of Concrete Components</a></li>
      <li><a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/ekanayaka_virama"><b>Ekanayaka</b> Virama</a>, <a href="../../../author/hurkamp_andre"><b>Hürkamp</b> André</a>, <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a> <a href="../../../date/2021/11">(2021-11)</a><br><a href="../../../lach_ekan_hurk_raat.2021.AtaOPPfAMiCUFM/">Approach to an Optimized Printing Path for Additive Manufacturing in Construction Utilizing FEM Modeling</a></li>
      <li><a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/muller_nico"><b>Müller</b> Nico</a>, <a href="../../../author/herlyn_thilo"><b>Herlyn</b> Thilo</a>, <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a> <a href="../../../date/2023/08">(2023-08)</a><br><a href="../../../lach_mull_herl_raat.2023.VFBPCfRAMPiC/">Volume Flow-Based Process-Control for Robotic Additive Manufacturing-Processes in Construction</a></li>
      <li><a href="../../../author/lowke_dirk"><b>Lowke</b> Dirk</a>, <a href="../../../author/mai-nee-dressler_inka"><b>Mai (née Dressler)</b> Inka</a>, <a href="../../../author/keita_emmanuel"><b>Keita</b> Emmanuel</a>, <a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a> et al. <a href="../../../date/2022/02">(2022-02)</a><br><a href="../../../lowk_mai_keit_perr.2022.MPIiPB3PatUP/">Material-Process Interactions in Particle-Bed 3D Printing and the Underlying Physics</a></li>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a> et al. <a href="../../../date/2020/03">(2020-03)</a><br><a href="../../../mech_bos_perr_silv.2020.EBAMwCBM/">Extrusion-Based Additive Manufacturing with Cement-Based Materials:<br/>Production Steps, Processes, and Their Underlying Physics</a></li>
      <li><a href="../../../author/paolini_alexander"><b>Paolini</b> Alexander</a>, <a href="../../../author/kollmannsberger_stefan"><b>Kollmannsberger</b> Stefan</a>, <a href="../../../author/rank_ernst"><b>Rank</b> Ernst</a> <a href="../../../date/2019/10">(2019-10)</a><br><a href="../../../paol_koll_rank.2019.AMiC/">Additive Manufacturing in Construction:<br/>A Review on Processes, Applications, and Digital Planning Methods</a></li>
      <li><a href="../../../author/pasco_jubert"><b>Pasco</b> Jubert</a>, <a href="../../../author/lei_zhen"><b>Lei</b> Zhen</a>, <a href="../../../author/aranas_clodualdo"><b>Aranas</b> Clodualdo</a> <a href="../../../date/2022/01">(2022-01)</a><br><a href="../../../pasc_lei_aran.2022.AMiOSC/">Additive Manufacturing in Off-Site Construction:<br/>Review and Future Directions</a></li>
      <li><a href="../../../author/rizzieri_giacomo"><b>Rizzieri</b> Giacomo</a>, <a href="../../../author/ferrara_liberato"><b>Ferrara</b> Liberato</a>, <a href="../../../author/cremonesi_massimiliano"><b>Cremonesi</b> Massimiliano</a> <a href="../../../date/2023/07">(2023-07)</a><br><a href="../../../rizz_ferr_crem.2023.NSotEaLDPi3CPwtPFEM/">Numerical Simulation of the Extrusion and Layer-Deposition-Processes in 3D Concrete Printing with the Particle-Finite-Element-Method</a></li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a>, <a href="../../../author/spangenberg_jon"><b>Spangenberg</b> Jon</a>, <a href="../../../author/wallevik_elvar_jon"><b>Wallevik</b> Jon</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> <a href="../../../date/2020/06">(2020-06)</a><br><a href="../../../rous_span_wall_wolf.2020.NSoCP/">Numerical Simulations of Concrete Processing:<br/>From Standard Formative Casting to Additive Manufacturing</a></li>
      <li><a href="../../../author/vantyghem_gieljan"><b>Vantyghem</b> Gieljan</a>, <a href="../../../author/ooms_ticho"><b>Ooms</b> Ticho</a>, <a href="../../../author/corte_wouter"><b>Corte</b> Wouter</a> <a href="../../../date/2020/11">(2020-11)</a><br><a href="../../../vant_ooms_cort.2021.V/">VoxelPrint:<br/>A Grasshopper Plug-In for Voxel-Based Numerical Simulation of Concrete Printing</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> <a href="../../../date/2018/02">(2018-02)</a><br><a href="../../../wolf_bos_sale.2018.EAMBo3PC/">Early-Age Mechanical Behaviour of 3D Printed Concrete:<br/>Numerical Modelling and Experimental Testing</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/ramirez-rodriguez_mariana_fatima"><b>Ramirez Rodriguez</b> Fatima</a>, <a href="../../../author/ahmad_rafiq"><b>Ahmad</b> Rafiq</a> <a href="../../../date/2025/09">(2025-09)</a><br><a href="../../../rami_ahma.2025.STAfAC/">Sustainable Technology Advances for Additive Construction:<br/>A State-of-the-Art Review</a></li>
      <li><a href="../../../author/dorrie_robin"><b>Dörrie</b> Robin</a>, <a href="../../../author/gantner_stefan"><b>Gantner</b> Stefan</a>, <a href="../../../author/amiri_salehi_fatemeh"><b>Amiri</b> Fatemeh</a>, <a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a> et al. <a href="../../../date/2025/04">(2025-04)</a><br><a href="../../../dorr_gant_amir_lach.2025.FDtR/">From Digital to Real:<br/>Optimised and Functionally Integrated Shotcrete 3D Printing Elements for Multi-Storey Structures</a></li>
    </ol>
</div>
