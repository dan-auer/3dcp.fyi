---
hide:
    - navigation
    - tags
    - footer
title: An Dong, Zhu Zhi, Rahman Mahfuzur, Zhang Y., Yang Richard
description:
tags:
 - behavior
 - concrete
 - element
 - failure
 - finite
 - flow
 - information
 - particle
 - print
 - process
 - simulation
 - smooth
 - structure

---

#Process-Informed Smooth Particle Hydrodynamics-Finite Element (SPH-FE) Simulation of 3D Concrete Printing&nbsp;([2026-01](date/2026/01))
<div class="h1-like">From Flow Behaviour to Structural Failure</div>
 <a href="https://doi.org/10.1016/j.jobe.2026.115447" title="DOI" target="_blank">:aca-doi:{ .lg .middle }</a> <a href="https://doi.org/10.1016/j.jobe.2026.115447" target="_blank">10.1016/j.jobe.2026.115447</a>

<span class="author"><a href="https://orcid.org/0009-0003-9939-8441" title="ORCID: 0009-0003-9939-8441" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/an_dong"><b>An</b>&nbsp;Dong</a></span>, <a href="../../../author/zhu_zhi"><b>Zhu</b>&nbsp;Zhi</a></span>, <a href="../../../author/rahman_mahfuzur"><b>Rahman</b>&nbsp;Mahfuzur</a></span>, <a href="../../../author/zhang_x_y"><b>Zhang</b>&nbsp;Y.</a></span>, <span class="author"><a href="https://orcid.org/0000-0001-5598-958X" title="ORCID: 0000-0001-5598-958X" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/yang_chunhui_richard"><b>Yang</b>&nbsp;Richard</a></span><br>
Journal Article - Journal of Building Engineering, No. 115447

<a href="../../keyword/behavior"><button class="btn">#behavior</button></a> <a href="../../keyword/concrete"><button class="btn">#concrete</button></a> <a href="../../keyword/element"><button class="btn">#element</button></a> <a href="../../keyword/failure"><button class="btn">#failure</button></a> <a href="../../keyword/finite"><button class="btn">#finite</button></a> <a href="../../keyword/flow"><button class="btn">#flow</button></a> <a href="../../keyword/information"><button class="btn">#information</button></a> <a href="../../keyword/particle"><button class="btn">#particle</button></a> <a href="../../keyword/print"><button class="btn">#print</button></a> <a href="../../keyword/process"><button class="btn">#process</button></a> <a href="../../keyword/simulation"><button class="btn">#simulation</button></a> <a href="../../keyword/smooth"><button class="btn">#smooth</button></a> <a href="../../keyword/structure"><button class="btn">#structure</button></a> 

<a href="https://scholar.google.com/scholar?as_q=process-informed+smooth+particle+hydrodynamics-finite+element+%28sph-fe%29+simulation+of+3d+concrete+printing&as_occt=title&as_sauthors=an&as_ylo=2024&as_yhi=2028&hl=en" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-105028616569&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.jobe.2026.115447" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.jobe.2026.115447" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.jobe.2026.115447" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.jobe.2026.115447" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.jobe.2026.115447&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.jobe.2026.115447" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.jobe.2026.115447&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/None" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.jobe.2026.115447" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.jobe.2026.115447?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>
???+ quote "Abstract" 
    In three-dimensional concrete printing (3DCP), accurately simulating structural failure while maintaining geometric fidelity remains challenging due to complex interactions among material flow, layer build-up, and early-age mechanical response. This study develops three novel numerical models to address these challenges. Among them, a coupled Smooth Particle Hydrodynamics-Finite Element (SPH-FE) model is developed to fully integrate fluid flow, solid mechanics, and fluid–structure interaction (FSI), with a custom Python-based script converting SPH-derived geometries into FE inputs. Two additional novel FE models, a simplified model based on idealised assumptions and a geometry-refined sophisticated model, are developed to provide complementary strategies with varying levels of fidelity and efficiency. An experimental-numerical framework is established by integrating the three models with material and printing tests. Rheological, uniaxial compression, and direct shear tests are conducted to characterise the time-dependent behaviour of fresh mortar. Wall structures and five-layer specimens are printed to observe failure and extract realistic layer geometries. Results show that the SPH-FE model enables realistic simulation of layer shape, extrusion forces, and nozzle height evolution, thereby improving accuracy in capturing geometric evolution and failure. The sophisticated FE model improves accuracy over the simplified model but lacks process coupling. These findings highlight the value of process-informed modelling for improving geometric control, enhancing failure prediction, and advancing automation in building engineering through 3DCP.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ example "29 References"
    <ol class = "bordered-list">
      <li><a href="../../../author/abbaoui_khalid"><b>Abbaoui</b> Khalid</a>, <a href="../../../author/korachi_issam"><b>Korachi</b> Issam</a>, <a href="../../../author/jai_mostapha"><b>Jai</b> Mostapha</a>, <a href="../../../author/seta_berin"><b>Šeta</b> Berin</a> et al. <a href="../../../date/2024/04">(2024-04)</a><br><a href="../../../abba_kora_jai_seta.2024.3CPUCFD/">3D Concrete Printing Using Computational Fluid Dynamics:<br/>Modeling of Material-Extrusion with Slip-Boundaries</a></li>
      <li><a href="../../../author/an_dong"><b>An</b> Dong</a>, <a href="../../../author/rahman_mahfuzur"><b>Rahman</b> Mahfuzur</a>, <a href="../../../author/zhang_x_y"><b>Zhang</b> Y.</a>, <a href="../../../author/yang_richard_chunhui"><b>Yang</b> Chunhui</a> <a href="../../../date/2025/05">(2025-05)</a><br><a href="../../../an_rahm_zhan_yang.2025.EoK3CPPPoLS/">Effects of Key 3D Concrete Printing Process Parameters on Layer Shape:<br/>Experimental Study and Smooth Particle Hydrodynamics Modelling</a></li>
      <li><a href="../../../author/an_dong"><b>An</b> Dong</a>, <a href="../../../author/zhang_x_yixia"><b>Zhang</b> Yixia</a>, <a href="../../../author/yang_richard_chunhui"><b>Yang</b> Chunhui</a> <a href="../../../date/2024/05">(2024-05)</a><br><a href="../../../an_zhan_yang.2024.ICAi3CPfMDaPCtSBaPA/">Incorporating Coarse Aggregates into 3D Concrete Printing from Mixture Design and Process-Control to Structural Behavior and Practical Applications:<br/>A Review</a></li>
      <li><a href="../../../author/an_dong"><b>An</b> Dong</a>, <a href="../../../author/zhang_x_yixia"><b>Zhang</b> Yixia</a>, <a href="../../../author/yang_richard_chunhui"><b>Yang</b> Chunhui</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../an_zhan_yang.2024.NMo3CP/">Numerical Modelling of 3D Concrete Printing:<br/>Material-Models, Boundary-Conditions and Failure-Identification</a></li>
      <li><a href="../../../author/chen_yuning"><b>Chen</b> Yuning</a>, <a href="../../../author/jia_lutao"><b>Jia</b> Lutao</a>, <a href="../../../author/liu_chao"><b>Liu</b> Chao</a>, <a href="../../../author/zhang_zedi"><b>Zhang</b> Zedi</a> et al. <a href="../../../date/2022/01">(2022-01)</a><br><a href="../../../chen_jia_liu_zhan.2022.MAEo3PAAMwDGFC/">Mechanical Anisotropy Evolution of 3D Printed Alkali-Activated Materials with Different GGBFS-FA Combinations</a></li>
      <li><a href="../../../author/comminal_raphael"><b>Comminal</b> Raphaël</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a>, <a href="../../../author/andersen_juul_thomas"><b>Andersen</b> Thomas</a>, <a href="../../../author/stang_henrik"><b>Stang</b> Henrik</a> et al. <a href="../../../date/2020/10">(2020-10)</a><br><a href="../../../comm_silv_ande_stan.2020.Mo3CPBoCFD/">Modelling of 3D Concrete Printing Based on Computational Fluid Dynamics</a></li>
      <li><a href="../../../author/dobrzanski_james"><b>Dobrzanski</b> James</a>, <a href="../../../author/xu_jerry_jie"><b>Xu</b> Jie</a>, <a href="../../../author/bartek_rasti"><b>Bartek</b> Rasti</a>, <a href="../../../author/becker_daniel"><b>Becker</b> Daniel</a> et al. <a href="../../../date/2025/04">(2025-04)</a><br><a href="../../../dobr_xu_bart_beck.2025.FDCtDM/">From Digital Crafting to Digital Manufacturing:<br/>Automated Production Using Hybrid 3D Concrete Printing</a></li>
      <li><a href="../../../author/jayathilakage_i_roshan"><b>Jayathilakage</b> Roshan</a>, <a href="../../../author/rajeev_pathmanathan"><b>Rajeev</b> Pathmanathan</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2020/01">(2020-01)</a><br><a href="../../../jaya_raje_sanj.2020.YSCtAtBo3CP/">Yield-Stress-Criteria to Assess the Buildability of 3D Concrete Printing</a></li>
      <li><a href="../../../author/kruger_pienaar_jacques"><b>Kruger</b> Jacques</a>, <a href="../../../author/zeranka_stephan"><b>Zeranka</b> Stephan</a>, <a href="../../../author/zijl_pieter-adriaan-greeff_gideon"><b>Zijl</b> Gideon</a> <a href="../../../date/2019/07">(2019-07)</a><br><a href="../../../krug_zera_zijl.2019.3CP/">3D Concrete Printing:<br/>A Lower-Bound Analytical Model for Buildability-Performance-Quantification</a></li>
      <li><a href="../../../author/liu_zhixin"><b>Liu</b> Zhixin</a>, <a href="../../../author/li_mingyang"><b>Li</b> Mingyang</a>, <a href="../../../author/weng_yiwei"><b>Weng</b> Yiwei</a>, <a href="../../../author/qian_ye"><b>Qian</b> Ye</a> et al. <a href="../../../date/2020/03">(2020-03)</a><br><a href="../../../liu_li_weng_qian.2020.MaPOfFDi3CMPUSVM/">Modelling- and Parameter-Optimization for Filament-Deformation in 3D Cementitious Material-Printing Using Support-Vector-Machine</a></li>
      <li><a href="../../../author/liu_xuanting"><b>Liu</b> Xuanting</a>, <a href="../../../author/sun_bohua"><b>Sun</b> Bohua</a> <a href="../../../date/2021/11">(2021-11)</a><br><a href="../../../liu_sun.2021.TIoIotSSi3CPP/">The Influence of Interface on the Structural Stability in 3D Concrete Printing Processes</a></li>
      <li><a href="../../../author/liu_chao"><b>Liu</b> Chao</a>, <a href="../../../author/zhang_yamei"><b>Zhang</b> Yamei</a>, <a href="../../../author/banthia_nemkumar"><b>Banthia</b> Nemkumar</a> <a href="../../../date/2023/05">(2023-05)</a><br><a href="../../../liu_zhan_bant.2023.UPFaIIoMPaSDo3PFCMwHMaSF/">Unveiling Pore Formation and Its Influence on Micromechanical Property and Stress-Distribution of 3D Printed Foam-Concrete Modified with Hydroxypropyl-Methylcellulose and Silica-Fume</a></li>
      <li><a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a>, <a href="../../../author/rosa_sarkis_pedro"><b>Rosa</b> Pedro</a>, <a href="../../../author/demont_leo"><b>Demont</b> Léo</a> <a href="../../../date/2025/03">(2025-03)</a><br><a href="../../../mesn_rosa_demo.2025.TOi3PCS/">Thickness Optimisation in 3D Printed Concrete Structures</a></li>
      <li><a href="../../../author/nguyen_vuong"><b>Nguyen</b> Vuong</a>, <a href="../../../author/li_shuai"><b>Li</b> Shuai</a>, <a href="../../../author/liu_junli"><b>Liu</b> Junli</a>, <a href="../../../author/nguyen_kien"><b>Nguyen</b> Kien</a> et al. <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../nguy_li_liu_nguy.2022.Mo3CPP/">Modelling of 3D Concrete Printing Process:<br/>A Perspective on Material and Structural Simulations</a></li>
      <li><a href="../../../author/ooms_ticho"><b>Ooms</b> Ticho</a>, <a href="../../../author/vantyghem_gieljan"><b>Vantyghem</b> Gieljan</a>, <a href="../../../author/coile_ruben"><b>Coile</b> Ruben</a>, <a href="../../../author/corte_wouter"><b>Corte</b> Wouter</a> <a href="../../../date/2020/12">(2020-12)</a><br><a href="../../../ooms_vant_coil_cort.2021.APMSftNSo3CPwCG/">A Parametric Modelling-Strategy for the Numerical Simulation of 3D Concrete Printing with Complex Geometries</a></li>
      <li><a href="../../../author/pierre_maxime"><b>Pierre</b> Maxime</a>, <a href="../../../author/ghabezloo_siavash"><b>Ghabezloo</b> Siavash</a>, <a href="../../../author/dangla_patrick"><b>Dangla</b> Patrick</a>, <a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../pier_ghab_dang_mesn.2025.MMo3CP/">Multiphysics Modelling of 3D Concrete Printing:<br/>From Material Model to Process Simulation and Optimisation</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/daadouch_koussay"><b>Daadouch</b> Koussay</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../rein_daad_mesc.2024.NSoTDCPBoaUFaSMF/">Numerical Simulation of Three Dimensional Concrete Printing Based on a Unified Fluid and Solid Mechanics Formulation</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2022/02">(2022-02)</a><br><a href="../../../rein_nere_mech_mesc.2022.EPSaLSPD3CPUtPFEM/">Extrusion-Process-Simulation and Layer-Shape-Prediction During 3D Concrete Printing Using the Particle-Finite-Element-Method</a></li>
      <li><a href="../../../author/rizzieri_giacomo"><b>Rizzieri</b> Giacomo</a>, <a href="../../../author/meni_simone"><b>Meni</b> Simone</a>, <a href="../../../author/cremonesi_massimiliano"><b>Cremonesi</b> Massimiliano</a>, <a href="../../../author/ferrara_liberato"><b>Ferrara</b> Liberato</a> <a href="../../../date/2025/07">(2025-07)</a><br><a href="../../../rizz_meni_crem_ferr.2025.APFEMfItIoMaPPi3CP/">A Particle Finite Element Method for Investigating the Influence of Material and Process Parameters in 3D Concrete Printing</a></li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2018/05">(2018-05)</a><br><a href="../../../rous.2018.RRfPC/">Rheological Requirements for Printable Concretes</a></li>
      <li><a href="../../../author/suiker_s-j_akke"><b>Suiker</b> Akke</a> <a href="../../../date/2018/01">(2018-01)</a><br><a href="../../../suik.2018.MPoWSi3PP/">Mechanical Performance of Wall Structures in 3D Printing Processes:<br/>Theory, Design Tools and Experiments</a></li>
      <li><a href="../../../author/vantyghem_gieljan"><b>Vantyghem</b> Gieljan</a>, <a href="../../../author/ooms_ticho"><b>Ooms</b> Ticho</a>, <a href="../../../author/corte_wouter"><b>Corte</b> Wouter</a> <a href="../../../date/2020/11">(2020-11)</a><br><a href="../../../vant_ooms_cort.2021.V/">VoxelPrint:<br/>A Grasshopper Plug-In for Voxel-Based Numerical Simulation of Concrete Printing</a></li>
      <li><a href="../../../author/wei_ying"><b>Wei</b> Ying</a>, <a href="../../../author/han_song"><b>Han</b> Song</a>, <a href="../../../author/yu_shiwei"><b>Yu</b> Shiwei</a>, <a href="../../../author/chen_ziwei"><b>Chen</b> Ziwei</a> et al. <a href="../../../date/2024/05">(2024-05)</a><br><a href="../../../wei_han_yu_chen.2024.PIo3CPfStMLS/">Parameter Impact on 3D Concrete Printing from Single to Multi-Layer Stacking</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> <a href="../../../date/2018/02">(2018-02)</a><br><a href="../../../wolf_bos_sale.2018.EAMBo3PC/">Early-Age Mechanical Behaviour of 3D Printed Concrete:<br/>Numerical Modelling and Experimental Testing</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> <a href="../../../date/2019/06">(2019-06)</a><br><a href="../../../wolf_bos_sale.2019.TCToEACfNAo3CP/">Triaxial Compression Testing on Early-Age Concrete for Numerical Analysis of 3D Concrete Printing</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/suiker_s-j_akke"><b>Suiker</b> Akke</a> <a href="../../../date/2019/06">(2019-06)</a><br><a href="../../../wolf_suik.2019.SFDEB3PP/">Structural Failure During Extrusion-Based 3D Printing Processes</a></li>
      <li><a href="../../../author/yu_hao"><b>Yu</b> Hao</a>, <a href="../../../author/zhang_weiwei"><b>Zhang</b> Weiwei</a>, <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a>, <a href="../../../author/sun_weikang"><b>Sun</b> Weikang</a> et al. <a href="../../../date/2024/01">(2024-01)</a><br><a href="../../../yu_zhan_yin_sun.2024.MEPaLDi3CPvSPH/">Modeling Extrusion-Process and Layer-Deformation in 3D Concrete Printing via Smoothed Particle-Hydrodynamics</a></li>
      <li><a href="../../../author/zhu_jinggao"><b>Zhu</b> Jinggao</a>, <a href="../../../author/cervera_miguel"><b>Cervera</b> Miguel</a>, <a href="../../../author/ren_xiaodan"><b>Ren</b> Xiaodan</a> <a href="../../../date/2024/06">(2024-06)</a><br><a href="../../../zhu_cerv_ren.2024.BoC3PCGUP/">Buildability of Complex 3D Printed Concrete Geometries Using Peridynamics</a></li>
      <li><a href="../../../author/zuo_zibo"><b>Zuo</b> Zibo</a>, <a href="../../../author/zhang_yamei"><b>Zhang</b> Yamei</a>, <a href="../../../author/li_jin"><b>Li</b> Jin</a>, <a href="../../../author/huang_yulin"><b>Huang</b> Yulin</a> et al. <a href="../../../date/2025/03">(2025-03)</a><br><a href="../../../zuo_zhan_li_huan.2025.SWfDDaOS3PoLCS/">Systematic Workflow for Digital Design and On-Site 3D Printing of Large Concrete Structures:<br/>A Case Study of a Full-Size Two-Story Building</a></li>
    </ol>
???+ bug "0 Citations"
    <ol  class = "bordered-list" reversed>
    </ol>
</div>

<div class="grid cards" markdown>

???+ warning "BibTeX"

    ```bibtex
    @article{an_zhu_rahm_zhan.2026.PISPHFESFSo3CP,
      author            = "Dong An and Zhi Zhu and Mahfuzur Rahman and Y. X. Zhang and Richard Chunhui Yang",
      title             = "Process-Informed Smooth Particle Hydrodynamics-Finite Element (SPH-FE) Simulation of 3D Concrete Printing: From Flow Behaviour to Structural Failure",
      doi               = "10.1016/j.jobe.2026.115447",
      year              = "2026",
      journal           = "Journal of Building Engineering",
      pages             = "115447",
    }


    ```

???+ failure "Formatted Citation"

    === "IEEE"

    <span id="iee">D. An, Z. Zhu, M. Rahman, Y. X. Zhang and R. C. Yang, “Process-Informed Smooth Particle Hydrodynamics-Finite Element (SPH-FE) Simulation of 3D Concrete Printing: From Flow Behaviour to Structural Failure”, <i>Journal of Building Engineering</i>, p. 115447, 2026, doi: 10.1016/j.jobe.2026.115447.</span><button class="md-code__button" data-clipboard-target="#ieee" data-md-type="copy" title="Copy IEEE Citation to Clipboard"></button>

    === "CMOS"

    <span id="cmos">An, Dong, Zhi Zhu, Mahfuzur Rahman, Y. X. Zhang, and Richard Chunhui Yang. “Process-Informed Smooth Particle Hydrodynamics-Finite Element (SPH-FE) Simulation of 3D Concrete Printing: From Flow Behaviour to Structural Failure”. <i>Journal of Building Engineering</i>, 2026, 115447. https://doi.org/10.1016/j.jobe.2026.115447.</span><button class="md-code__button" data-clipboard-target="#cmos" data-md-type="copy" title="Copy CMOS Citation to Clipboard"></button>

</div>
