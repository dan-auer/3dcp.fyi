---
hide:
    - navigation
    - tags
title: Hao Yu, Weiwei Zhang, Jia Liew, Binbin Yin, Kim Liew
description:
tags:
 - concrete
 - dynamic
 - extrusion
 - flow
 - material
 - print
 - simulation

---

#:aca-closedaccess:{ .xred '} Simulating Material Flow and Extrusion Dynamics in 3D Concrete Printing ([2025-11](date/2025/11))
<a href="https://doi.org/10.1016/j.cma.2025.118575" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1016/j.cma.2025.118575</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/yu_hao"><b>Yu</b> Hao</a> <a href="https://orcid.org/0000-0001-8353-8110" title="ORCID: 0000-0001-8353-8110" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/zhang_weiwei"><b>Zhang</b> Weiwei</a> <a href="https://orcid.org/0000-0003-2013-9715" title="ORCID: 0000-0003-2013-9715" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/liew_xiang_jia"><b>Liew</b> Jia</a> <a href="https://orcid.org/0000-0003-0659-7541" title="ORCID: 0000-0003-0659-7541" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a> <a href="https://orcid.org/0000-0001-9660-8907" title="ORCID: 0000-0001-9660-8907" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/liew_meow_kim"><b>Liew</b> Kim</a> <a href="https://orcid.org/0000-0001-7160-7676" title="ORCID: 0000-0001-7160-7676" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Computer Methods in Applied Mechanics and Engineering, Vol. 449, No. 118575

:aca-blank:{ .lg .middle}
    [`#concrete`](keyword/concrete)
    [`#dynamic`](keyword/dynamic)
    [`#extrusion`](keyword/extrusion)
    [`#flow`](keyword/flow)
    [`#material`](keyword/material)
    [`#print`](keyword/print)
    [`#simulation`](keyword/simulation)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Simulating%20Material%20Flow%20and%20Extrusion%20Dynamics%20in%203D%20Concrete%20Printing" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-105022442418&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001629494500001" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.cma.2025.118575" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.cma.2025.118575" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.cma.2025.118575" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.cma.2025.118575" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.cma.2025.118575&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.cma.2025.118575" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.cma.2025.118575&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W7106585853" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.cma.2025.118575" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.cma.2025.118575?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    We present an advanced 3D virtual printing framework for simulating material flow and extrusion dynamics in 3D concrete printing (3DCP), specifically addressing critical layer transition challenges. Central to the framework is a gradually-rising printing-start model, which dynamically adjusts deposition to eliminate sharp discontinuities between layers. Computationally, the framework couples δ-smoothed particle hydrodynamics (δ-SPH) with a regularized Bingham model to accurately capture deformation and pressure fields of extruded concrete. An alternating particle generation algorithm further enhances efficiency by enabling on-demand creation of fluid and wall particles, with parallelization supporting scalable simulations. Benchmark validations confirm the framework’s accuracy in modeling Bingham fluid behavior and its computational robustness. Results indicate that initial nozzle pressure strongly influences extrudability, with higher pressures producing greater layer deformation. The gradually rising deposition model aligns closely with theoretical predictions, expanding the transition zone and improving interlayer bonding. Beyond predictive failure analysis, this framework facilitates optimization of 3DCP parameters, paving the way for more reliable and scalable additive construction processes.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/carneau_paul"><b>Carneau</b> Paul</a>, <a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a>, <a href="../../../author/baverel_olivier"><b>Baverel</b> Olivier</a>, <a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2022/03">(2022-03)</a><br><a href="../../../carn_mesn_bave_rous.2022.LPiCEB3P/">Layer Pressing in Concrete Extrusion-Based 3D Printing:<br/>Experiments and Analysis</a></li>
      <li><a href="../../../author/chang_ze"><b>Chang</b> Ze</a>, <a href="../../../author/zhang_hongzhi"><b>Zhang</b> Hongzhi</a>, <a href="../../../author/liang_minfei"><b>Liang</b> Minfei</a>, <a href="../../../author/schlangen_erik"><b>Schlangen</b> Erik</a> et al. <a href="../../../date/2022/07">(2022-07)</a><br><a href="../../../chan_zhan_lian_schl.2022.NSoEBi3CPUtLMwGNL/">Numerical Simulation of Elastic Buckling in 3D Concrete Printing Using the Lattice-Model with Geometric Non-Linearity</a></li>
      <li><a href="../../../author/cheng_hanbin"><b>Cheng</b> Hanbin</a>, <a href="../../../author/radlinska_aleksandra"><b>Radlińska</b> Aleksandra</a>, <a href="../../../author/hilman_michael"><b>Hilman</b> Michael</a>, <a href="../../../author/liu_feihong"><b>Liu</b> Feihong</a> et al. <a href="../../../date/2024/05">(2024-05)</a><br><a href="../../../chen_radl_hilm_liu.2024.MCDv3PURKPM/">Modeling Concrete-Deposition via 3D Printing Using Reproducing Kernel-Particle-Method</a></li>
      <li><a href="../../../author/comminal_raphael"><b>Comminal</b> Raphaël</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a>, <a href="../../../author/andersen_juul_thomas"><b>Andersen</b> Thomas</a>, <a href="../../../author/stang_henrik"><b>Stang</b> Henrik</a> et al. <a href="../../../date/2020/10">(2020-10)</a><br><a href="../../../comm_silv_ande_stan.2020.Mo3CPBoCFD/">Modelling of 3D Concrete Printing Based on Computational Fluid Dynamics</a></li>
      <li><a href="../../../author/hlobil_michal"><b>Hlobil</b> Michal</a>, <a href="../../../author/michel_luca"><b>Michel</b> Luca</a>, <a href="../../../author/pundir_mohit"><b>Pundir</b> Mohit</a>, <a href="../../../author/kammer_s_david"><b>Kammer</b> David</a> <a href="../../../date/2025/03">(2025-03)</a><br><a href="../../../hlob_mich_pund_kamm.2025.ATHMtDtFDCJFi3PC/">A Thermo-Hygro Model to Determine the Factors Dictating Cold Joint Formation in 3D Printed Concrete</a></li>
      <li><a href="../../../author/jayathilakage_i_roshan"><b>Jayathilakage</b> Roshan</a>, <a href="../../../author/rajeev_pathmanathan"><b>Rajeev</b> Pathmanathan</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2020/01">(2020-01)</a><br><a href="../../../jaya_raje_sanj.2020.YSCtAtBo3CP/">Yield-Stress-Criteria to Assess the Buildability of 3D Concrete Printing</a></li>
      <li><a href="../../../author/mohammad_salam_abdul"><b>Mohammad</b> Abdul</a>, <a href="../../../author/biernacki_j_joseph"><b>Biernacki</b> Joseph</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../moha_bier.2022.2SCPoCBP/">2D Stationary Computational Printing of Cement-Based Pastes</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/daadouch_koussay"><b>Daadouch</b> Koussay</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../rein_daad_mesc.2024.NSoTDCPBoaUFaSMF/">Numerical Simulation of Three Dimensional Concrete Printing Based on a Unified Fluid and Solid Mechanics Formulation</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/gudzulic_vladislav"><b>Gudžulić</b> Vladislav</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/03">(2023-03)</a><br><a href="../../../rein_gudz_mesc.2023.CMoFOD3CP/">Computational Modeling of Fiber Orientation During 3D Concrete Printing</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2022/02">(2022-02)</a><br><a href="../../../rein_nere_mech_mesc.2022.EPSaLSPD3CPUtPFEM/">Extrusion-Process-Simulation and Layer-Shape-Prediction During 3D Concrete Printing Using the Particle-Finite-Element-Method</a></li>
      <li><a href="../../../author/rizzieri_giacomo"><b>Rizzieri</b> Giacomo</a>, <a href="../../../author/ferrara_liberato"><b>Ferrara</b> Liberato</a>, <a href="../../../author/cremonesi_massimiliano"><b>Cremonesi</b> Massimiliano</a> <a href="../../../date/2023/07">(2023-07)</a><br><a href="../../../rizz_ferr_crem.2023.NSotEaLDPi3CPwtPFEM/">Numerical Simulation of the Extrusion and Layer-Deposition-Processes in 3D Concrete Printing with the Particle-Finite-Element-Method</a></li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2018/05">(2018-05)</a><br><a href="../../../rous.2018.RRfPC/">Rheological Requirements for Printable Concretes</a></li>
      <li><a href="../../../author/yu_hao"><b>Yu</b> Hao</a>, <a href="../../../author/zhang_weiwei"><b>Zhang</b> Weiwei</a>, <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a>, <a href="../../../author/sun_weikang"><b>Sun</b> Weikang</a> et al. <a href="../../../date/2024/01">(2024-01)</a><br><a href="../../../yu_zhan_yin_sun.2024.MEPaLDi3CPvSPH/">Modeling Extrusion-Process and Layer-Deformation in 3D Concrete Printing via Smoothed Particle-Hydrodynamics</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
