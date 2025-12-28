---
hide:
    - navigation
    - tags
title: Hao Yu, Weiwei Zhang, Binbin Yin, Weikang Sun, Arslan Akbar, Yang Zhang, Kim Liew
description:
tags:
 - concrete
 - deformation
 - extrusion
 - layer
 - model
 - particle
 - print
 - process
 - smooth

---

#:aca-closedaccess:{ .xred '} Modeling Extrusion-Process and Layer-Deformation in 3D Concrete Printing via Smoothed Particle-Hydrodynamics ([2024-01](date/2024/01))
<a href="https://doi.org/10.1016/j.cma.2024.116761" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1016/j.cma.2024.116761</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/yu_hao"><b>Yu</b> Hao</a> <a href="https://orcid.org/0000-0001-8353-8110" title="ORCID: 0000-0001-8353-8110" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/zhang_weiwei"><b>Zhang</b> Weiwei</a> <a href="https://orcid.org/0000-0003-2013-9715" title="ORCID: 0000-0003-2013-9715" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a> <a href="https://orcid.org/0000-0001-9660-8907" title="ORCID: 0000-0001-9660-8907" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/sun_weikang"><b>Sun</b> Weikang</a> <a href="https://orcid.org/0000-0001-6092-9725" title="ORCID: 0000-0001-6092-9725" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/akbar_arslan"><b>Akbar</b> Arslan</a>
,     <a href="../../../author/zhang_yang"><b>Zhang</b> Yang</a>
,     <a href="../../../author/liew_meow_kim"><b>Liew</b> Kim</a> <a href="https://orcid.org/0000-0001-7160-7676" title="ORCID: 0000-0001-7160-7676" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Computer Methods in Applied Mechanics and Engineering, Vol. 420, No. 116761

:aca-blank:{ .lg .middle}
    [`#concrete`](keyword/concrete)
    [`#deformation`](keyword/deformation)
    [`#extrusion`](keyword/extrusion)
    [`#layer`](keyword/layer)
    [`#model`](keyword/model)
    [`#particle`](keyword/particle)
    [`#print`](keyword/print)
    [`#process`](keyword/process)
    [`#smooth`](keyword/smooth)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Modeling%20Extrusion-Process%20and%20Layer-Deformation%20in%203D%20Concrete%20Printing%20via%20Smoothed%20Particle-Hydrodynamics" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85182512252&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001299461100001" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.cma.2024.116761" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.cma.2024.116761" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.cma.2024.116761" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.cma.2024.116761" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.cma.2024.116761&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.cma.2024.116761" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.cma.2024.116761&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4390861526" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.cma.2024.116761" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.cma.2024.116761?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    We developed a computational framework to simulate the intricate processes of extrusion and layer deformation in 3D concrete printing (3DCP). A novel two-dimensional (2D) virtual printing scheme is proposed that enables direct prediction of cross-sectional shape, releasing simulations from the constraint of rectangular nozzles inherent in traditional 2D models. The proposed scheme accurately captures significant lateral deformation, previously ignored by conventional 2D models. It is noteworthy that, for the first time, the effect of time-dependent yield stress on layer deformation is considered by introducing the structuration rate. Further, to leverage advantages in avoiding mesh generation and additional interface tracking, a weakly compressible smoothed particle hydrodynamics (SPH) method incorporating the regularized Bingham model is equipped in the proposed framework. The simulated cross-sectional shapes exhibit excellent consistency with experimental results and outperform existing numerical results across various nozzle heights, printing velocities, and extrusion velocities. Our exploration of rheological parameters reveals that the final layer deformation is influenced by the yield stress, while its deformation rate is affected by the plastic viscosity. The proposed virtual printing framework emerges as a promising tool for enhancing predictability and efficiency in the printing process.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/buswell_a_richard"><b>Buswell</b> Richard</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a>, <a href="../../../author/jones_z_scott"><b>Jones</b> Scott</a>, <a href="../../../author/dirrenberger_justin"><b>Dirrenberger</b> Justin</a> <a href="../../../date/2018/06">(2018-06)</a><br><a href="../../../busw_silv_jone_dirr.2018.3PUCE/">3D Printing Using Concrete-Extrusion:<br/>A Roadmap for Research</a></li>
      <li><a href="../../../author/carneau_paul"><b>Carneau</b> Paul</a>, <a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a>, <a href="../../../author/baverel_olivier"><b>Baverel</b> Olivier</a>, <a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2022/03">(2022-03)</a><br><a href="../../../carn_mesn_bave_rous.2022.LPiCEB3P/">Layer Pressing in Concrete Extrusion-Based 3D Printing:<br/>Experiments and Analysis</a></li>
      <li><a href="../../../author/chang_ze"><b>Chang</b> Ze</a>, <a href="../../../author/zhang_hongzhi"><b>Zhang</b> Hongzhi</a>, <a href="../../../author/liang_minfei"><b>Liang</b> Minfei</a>, <a href="../../../author/schlangen_erik"><b>Schlangen</b> Erik</a> et al. <a href="../../../date/2022/07">(2022-07)</a><br><a href="../../../chan_zhan_lian_schl.2022.NSoEBi3CPUtLMwGNL/">Numerical Simulation of Elastic Buckling in 3D Concrete Printing Using the Lattice-Model with Geometric Non-Linearity</a></li>
      <li><a href="../../../author/chen_yu"><b>Chen</b> Yu</a>, <a href="../../../author/jansen_koen"><b>Jansen</b> Koen</a>, <a href="../../../author/zhang_hongzhi"><b>Zhang</b> Hongzhi</a>, <a href="../../../author/rodriguez_romero_claudia"><b>Rodríguez</b> Claudia</a> et al. <a href="../../../date/2020/07">(2020-07)</a><br><a href="../../../chen_jans_zhan_rodr.2020.EoPPoILBSo3PLCCBCM/">Effect of Printing-Parameters on Inter-Layer Bond Strength of 3D Printed Limestone-Calcined-Clay-Based Cementitious Materials:<br/>An Experimental and Numerical Study</a></li>
      <li><a href="../../../author/comminal_raphael"><b>Comminal</b> Raphaël</a>, <a href="../../../author/serdeczny_p_marcin"><b>Serdeczny</b> Marcin</a>, <a href="../../../author/pedersen_bue_david"><b>Pedersen</b> David</a>, <a href="../../../author/spangenberg_jon"><b>Spangenberg</b> Jon</a> <a href="../../../date/2019/06">(2019-06)</a><br><a href="../../../comm_serd_pede_span.2019.MPaNSoMDaCiEAM/">Motion-Planning and Numerical Simulation of Material-Deposition at Corners in Extrusion Additive Manufacturing</a></li>
      <li><a href="../../../author/comminal_raphael"><b>Comminal</b> Raphaël</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a>, <a href="../../../author/andersen_juul_thomas"><b>Andersen</b> Thomas</a>, <a href="../../../author/stang_henrik"><b>Stang</b> Henrik</a> et al. <a href="../../../date/2020/10">(2020-10)</a><br><a href="../../../comm_silv_ande_stan.2020.Mo3CPBoCFD/">Modelling of 3D Concrete Printing Based on Computational Fluid Dynamics</a></li>
      <li><a href="../../../author/ding_tao"><b>Ding</b> Tao</a>, <a href="../../../author/wang_ziyue"><b>Wang</b> Ziyue</a>, <a href="../../../author/liu_haoran"><b>Liu</b> Haoran</a>, <a href="../../../author/xiao_jianzhuang"><b>Xiao</b> Jianzhuang</a> <a href="../../../date/2023/03">(2023-03)</a><br><a href="../../../ding_wang_liu_xiao.2023.SoPOPoSBf3PC/">Simulation on Pull-Out Performance of Steel-Bar from 3D Printed Concrete</a></li>
      <li><a href="../../../author/han_nv"><b>Han</b> Nv</a>, <a href="../../../author/xiao_jianzhuang"><b>Xiao</b> Jianzhuang</a>, <a href="../../../author/zhang_lihai"><b>Zhang</b> Lihai</a>, <a href="../../../author/peng_yu"><b>Peng</b> Yu</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../han_xiao_zhan_peng.2022.AMSBNMfIHTMBo3PCaET/">A Micro-Scale-Based Numerical Model for Investigating Hygro-Thermo-Mechanical Behavior of 3D Printed Concrete at Elevated Temperatures</a></li>
      <li><a href="../../../author/jayathilakage_i_roshan"><b>Jayathilakage</b> Roshan</a>, <a href="../../../author/rajeev_pathmanathan"><b>Rajeev</b> Pathmanathan</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2020/01">(2020-01)</a><br><a href="../../../jaya_raje_sanj.2020.YSCtAtBo3CP/">Yield-Stress-Criteria to Assess the Buildability of 3D Concrete Printing</a></li>
      <li><a href="../../../author/jayathilakage_i_roshan"><b>Jayathilakage</b> Roshan</a>, <a href="../../../author/rajeev_pathmanathan"><b>Rajeev</b> Pathmanathan</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2021/05">(2021-05)</a><br><a href="../../../jaya_raje_sanj.2021.ERf3CP/">Extrusion Rheometer for 3D Concrete Printing</a></li>
      <li><a href="../../../author/krenzer_knut"><b>Krenzer</b> Knut</a>, <a href="../../../author/palzer_ulrich"><b>Palzer</b> Ulrich</a>, <a href="../../../author/muller_steffen"><b>Müller</b> Steffen</a>, <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../kren_palz_mull_mech.2022.So3CPUDEM/">Simulation of 3D Concrete Printing Using Discrete Element Method</a></li>
      <li><a href="../../../author/li_shuai"><b>Li</b> Shuai</a>, <a href="../../../author/nguyen-xuan_hung"><b>Nguyen-Xuan</b> Hung</a>, <a href="../../../author/tran_phuong_jonathan"><b>Tran</b> Jonathan</a> <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../li_nguy_tran.2023.DDaPSo3CPoNPS/">Digital Design and Parametric Study of 3D Concrete Printing on Non-Planar Surfaces</a></li>
      <li><a href="../../../author/liu_zhixin"><b>Liu</b> Zhixin</a>, <a href="../../../author/li_mingyang"><b>Li</b> Mingyang</a>, <a href="../../../author/weng_yiwei"><b>Weng</b> Yiwei</a>, <a href="../../../author/qian_ye"><b>Qian</b> Ye</a> et al. <a href="../../../date/2020/03">(2020-03)</a><br><a href="../../../liu_li_weng_qian.2020.MaPOfFDi3CMPUSVM/">Modelling- and Parameter-Optimization for Filament-Deformation in 3D Cementitious Material-Printing Using Support-Vector-Machine</a></li>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a>, <a href="../../../author/silva_ricardo-leal_wilson"><b>Silva</b> Wilson</a> et al. <a href="../../../date/2020/03">(2020-03)</a><br><a href="../../../mech_bos_perr_silv.2020.EBAMwCBM/">Extrusion-Based Additive Manufacturing with Cement-Based Materials:<br/>Production Steps, Processes, and Their Underlying Physics</a></li>
      <li><a href="../../../author/mohammad_salam_abdul"><b>Mohammad</b> Abdul</a>, <a href="../../../author/biernacki_j_joseph"><b>Biernacki</b> Joseph</a> <a href="../../../date/2022/06">(2022-06)</a><br><a href="../../../moha_bier.2022.2SCPoCBP/">2D Stationary Computational Printing of Cement-Based Pastes</a></li>
      <li><a href="../../../author/nguyen_vuong"><b>Nguyen</b> Vuong</a>, <a href="../../../author/li_shuai"><b>Li</b> Shuai</a>, <a href="../../../author/liu_junli"><b>Liu</b> Junli</a>, <a href="../../../author/nguyen_kien"><b>Nguyen</b> Kien</a> et al. <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../nguy_li_liu_nguy.2022.Mo3CPP/">Modelling of 3D Concrete Printing Process:<br/>A Perspective on Material and Structural Simulations</a></li>
      <li><a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a>, <a href="../../../author/pierre_alexandre"><b>Pierre</b> Alexandre</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2021/07">(2021-07)</a><br><a href="../../../perr_pier_nere_wolf.2021.FAMtNS/">From Analytical Methods to Numerical Simulations:<br/>A Process Engineering Toolbox for 3D Concrete Printing</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/gudzulic_vladislav"><b>Gudžulić</b> Vladislav</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/03">(2023-03)</a><br><a href="../../../rein_gudz_mesc.2023.CMoFOD3CP/">Computational Modeling of Fiber Orientation During 3D Concrete Printing</a></li>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2022/02">(2022-02)</a><br><a href="../../../rein_nere_mech_mesc.2022.EPSaLSPD3CPUtPFEM/">Extrusion-Process-Simulation and Layer-Shape-Prediction During 3D Concrete Printing Using the Particle-Finite-Element-Method</a></li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2018/05">(2018-05)</a><br><a href="../../../rous.2018.RRfPC/">Rheological Requirements for Printable Concretes</a></li>
      <li><a href="../../../author/suntharalingam_thadshajini"><b>Suntharalingam</b> Thadshajini</a>, <a href="../../../author/gatheeshgar_perampalam"><b>Gatheeshgar</b> Perampalam</a>, <a href="../../../author/upasiri_irindu"><b>Upasiri</b> Irindu</a>, <a href="../../../author/poologanathan_keerthan"><b>Poologanathan</b> Keerthan</a> et al. <a href="../../../date/2021/06">(2021-06)</a><br><a href="../../../sunt_gath_upas_pool.2021.FPoI3PCCWP/">Fire Performance of Innovative 3D Printed Concrete Composite Wall Panels:<br/>A Numerical Study</a></li>
      <li><a href="../../../author/tay_wei-daniel_yi"><b>Tay</b> Yi</a>, <a href="../../../author/li_mingyang"><b>Li</b> Mingyang</a>, <a href="../../../author/tan_jen_ming"><b>Tan</b> Ming</a> <a href="../../../date/2019/04">(2019-04)</a><br><a href="../../../tay_li_tan.2019.EoPPi3CP/">Effect of Printing Parameters in 3D Concrete Printing:<br/>Printing Region and Support Structures</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a>, <a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a> <a href="../../../date/2021/10">(2021-10)</a><br><a href="../../../wolf_sale_rous.2021.FGCiEBAMoC/">Filament-Geometry-Control in Extrusion-Based Additive Manufacturing of Concrete:<br/>The Good, the Bad and the Ugly</a></li>
      <li><a href="../../../author/xiao_jianzhuang"><b>Xiao</b> Jianzhuang</a>, <a href="../../../author/liu_haoran"><b>Liu</b> Haoran</a>, <a href="../../../author/ding_tao"><b>Ding</b> Tao</a> <a href="../../../date/2020/11">(2020-11)</a><br><a href="../../../xiao_liu_ding.2021.FEAotABo3PCuCaF/">Finite-Element-Analysis on the Anisotropic Behavior of 3D Printed Concrete under Compression and Flexure</a></li>
      <li><a href="../../../author/zhu_jinggao"><b>Zhu</b> Jinggao</a>, <a href="../../../author/ren_xiaodan"><b>Ren</b> Xiaodan</a>, <a href="../../../author/cervera_miguel"><b>Cervera</b> Miguel</a> <a href="../../../date/2023/07">(2023-07)</a><br><a href="../../../zhu_ren_cerv.2023.PBAo3PCIDPFaC/">Peridynamic Buildability-Analysis of 3D Printed Concrete Including Damage, Plastic Flow and Collapse</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/deetman_arjen"><b>Deetman</b> Arjen</a>, <a href="../../../author/bos_h_derk"><b>Bos</b> Derk</a>, <a href="../../../author/lucas_simaria-de-oliveira_sandra"><b>Lucas</b> Sandra</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> et al. <a href="../../../date/2025/12">(2025-12)</a><br><a href="../../../deet_bos_luca_sale.2025.ADFf3CP/">A Database Framework for 3D Concrete Printing</a></li>
      <li><a href="../../../author/yu_hao"><b>Yu</b> Hao</a>, <a href="../../../author/zhang_weiwei"><b>Zhang</b> Weiwei</a>, <a href="../../../author/liew_xiang_jia"><b>Liew</b> Jia</a>, <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a> et al. <a href="../../../date/2025/11">(2025-11)</a><br><a href="../../../yu_zhan_liew_yin.2026.SMFaEDi3CP/">Simulating Material Flow and Extrusion Dynamics in 3D Concrete Printing</a></li>
      <li><a href="../../../author/chen_baixi"><b>Chen</b> Baixi</a>, <a href="../../../author/yang_lei"><b>Yang</b> Lei</a>, <a href="../../../author/jiang_sheng"><b>Jiang</b> Sheng</a> <a href="../../../date/2025/09">(2025-09)</a><br><a href="../../../chen_yang_jian.2025.SAo3CPPwCaIbEDDM/">Stochastic Analysis of 3D Concrete Printing Process with Curvature and Inclination by Explainable Data-Driven Modelling</a></li>
      <li><a href="../../../author/rizzieri_giacomo"><b>Rizzieri</b> Giacomo</a>, <a href="../../../author/meni_simone"><b>Meni</b> Simone</a>, <a href="../../../author/cremonesi_massimiliano"><b>Cremonesi</b> Massimiliano</a>, <a href="../../../author/ferrara_liberato"><b>Ferrara</b> Liberato</a> <a href="../../../date/2025/07">(2025-07)</a><br><a href="../../../rizz_meni_crem_ferr.2025.APFEMfItIoMaPPi3CP/">A Particle Finite Element Method for Investigating the Influence of Material and Process Parameters in 3D Concrete Printing</a></li>
      <li><a href="../../../author/duan_yuhang"><b>Duan</b> Yuhang</a>, <a href="../../../author/wang_chuan"><b>Wang</b> Chuan</a>, <a href="../../../author/yin_binbin"><b>Yin</b> Binbin</a>, <a href="../../../author/liew_meow_kim"><b>Liew</b> Kim</a> <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../duan_wang_yin_liew.2025.MIFi3PCvP/">Modeling Interfacial Failure in 3D-Printed Concrete via Peridynamics</a></li>
      <li><a href="../../../author/chen_qinbin"><b>Chen</b> Qinbin</a>, <a href="../../../author/barbat_b_gabriel"><b>Barbat</b> Gabriel</a>, <a href="../../../author/cervera_miguel"><b>Cervera</b> Miguel</a> <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../chen_barb_cerv.2025.FEBAo3PCIFbEBaPF/">Finite Element Buildability Analysis of 3D Printed Concrete Including Failure by Elastic Buckling and Plastic Flow</a></li>
      <li><a href="../../../author/an_dong"><b>An</b> Dong</a>, <a href="../../../author/rahman_mahfuzur"><b>Rahman</b> Mahfuzur</a>, <a href="../../../author/zhang_x_y"><b>Zhang</b> Y.</a>, <a href="../../../author/yang_richard_chunhui"><b>Yang</b> Chunhui</a> <a href="../../../date/2025/05">(2025-05)</a><br><a href="../../../an_rahm_zhan_yang.2025.EoK3CPPPoLS/">Effects of Key 3D Concrete Printing Process Parameters on Layer Shape:<br/>Experimental Study and Smooth Particle Hydrodynamics Modelling</a></li>
      <li><a href="../../../author/sun_yubo"><b>Sun</b> Yubo</a>, <a href="../../../author/zhang_xinyue"><b>Zhang</b> Xinyue</a>, <a href="../../../author/zhou_jiangang"><b>Zhou</b> Jiangang</a>, <a href="../../../author/wang_yilin"><b>Wang</b> Yilin</a> et al. <a href="../../../date/2024/11">(2024-11)</a><br><a href="../../../sun_zhan_zhou_wang.2024.EAo3PCaaTPDF/">Extrudability-Analysis of 3D Printable Concrete as a Two-Phase Discrete Flow</a></li>
      <li><a href="../../../author/lim_gip_sean"><b>Lim</b> Sean</a>, <a href="../../../author/tan_jen_ming"><b>Tan</b> Ming</a> <a href="../../../date/2024/10">(2024-10)</a><br><a href="../../../lim_tan.2024.ARMfCAM/">A Rheological Model for Concrete Additive Manufacturing</a></li>
      <li><a href="../../../author/shivendra_thammannagowda_bandoorvaragerahalli"><b>Shivendra</b> Bandoorvaragerahalli</a>, <a href="../../../author/sharath-chandra_sathvik"><b>Sharath Chandra</b> Sathvik</a>, <a href="../../../author/singh_kumar_atul"><b>Singh</b> Atul</a>, <a href="../../../author/kumar_rakesh"><b>Kumar</b> Rakesh</a> et al. <a href="../../../date/2024/09">(2024-09)</a><br><a href="../../../shiv_shar_sing_kuma.2024.APTS/">A Path Towards SDGs:<br/>Investigation of the Challenges in Adopting 3D Concrete Printing in India</a></li>
    </ol>
</div>
