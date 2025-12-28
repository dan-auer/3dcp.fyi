---
hide:
    - navigation
    - tags
title: Xiaoqi Wang, Xing Liu, Yanling Xu, Jianfu Cao, Huiyi Zhang, Huajun Zhang
description:
tags:
 - adaption
 - algorithm
 - base
 - complexity
 - concrete
 - continuous
 - general
 - height
 - layer
 - learn
 - multi
 - objective
 - optimization
 - path
 - porosity
 - print
 - reinforcement
 - structure

---

#:aca-closedaccess:{ .xred '} A General Adaptive Layer Height Continuous Path Planning Algorithm for Concrete 3D Printing of Complex Porous Structures Based on Multi-Objective Optimization and Reinforcement Learning ([2025-08](date/2025/08))
<a href="https://doi.org/10.1016/j.istruc.2025.109926" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1016/j.istruc.2025.109926</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/wang_xiaoqi"><b>Wang</b> Xiaoqi</a>
,     <a href="../../../author/liu_xing"><b>Liu</b> Xing</a>
,     <a href="../../../author/xu_yanling"><b>Xu</b> Yanling</a>
,     <a href="../../../author/cao_jianfu"><b>Cao</b> Jianfu</a>
,     <a href="../../../author/zhang_huiyi"><b>Zhang</b> Huiyi</a>
,     <a href="../../../author/zhang_huajun"><b>Zhang</b> Huajun</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Structures, Vol. 80, No. 109926

:aca-blank:{ .lg .middle}
    [`#adaption`](keyword/adaption)
    [`#algorithm`](keyword/algorithm)
    [`#base`](keyword/base)
    [`#complexity`](keyword/complexity)
    [`#concrete`](keyword/concrete)
    [`#continuous`](keyword/continuous)
    [`#general`](keyword/general)
    [`#height`](keyword/height)
    [`#layer`](keyword/layer)
    [`#learn`](keyword/learn)
    [`#multi`](keyword/multi)
    [`#objective`](keyword/objective)
    [`#optimization`](keyword/optimization)
    [`#path`](keyword/path)
    [`#porosity`](keyword/porosity)
    [`#print`](keyword/print)
    [`#reinforcement`](keyword/reinforcement)
    [`#structure`](keyword/structure)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=A%20General%20Adaptive%20Layer%20Height%20Continuous%20Path%20Planning%20Algorithm%20for%20Concrete%203D%20Printing%20of%20Complex%20Porous%20Structures%20Based%20on%20Multi-Objective%20Optimization%20and%20Reinforcement%20Learning" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-105014533399&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001565293100008" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.istruc.2025.109926" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.istruc.2025.109926" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.istruc.2025.109926" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.istruc.2025.109926" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.istruc.2025.109926&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.istruc.2025.109926" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.istruc.2025.109926&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4413827649" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.istruc.2025.109926" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.istruc.2025.109926?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    For the concrete 3D printing of complex porous structures, the conventional approach of uniform layer-height slicing fails to balance both printing precision and efficiency simultaneously. Furthermore, traditional path-filling methods often encounter issues such as path overlap, interruptions, redundancy, and excessive number of bending angles, which can lead to interruptions and accumulation of extruded material. To address these challenges, this paper introduces a general adaptive layer height continuous path planning algorithm. Firstly, an adaptive slicing algorithm based on multi-objective optimization is used to coordinate the optimization of printing precision and efficiency. The optimal solution is obtained using an improved Non-dominated Sorting Genetic Algorithm (NSGA-II) and a fuzzy weighted membership sorting method, resulting in an adaptive layer height set that meets diverse printing requirements. Secondly, a general continuous and smooth path planning algorithm is proposed. The path points are obtained by filling rate, extrusion line width, and contour offset calculation. The mathematical model is established with the objectives of minimizing path length and bending angles. The continuous path is obtained by traversing the path points using reinforcement learning-based Attention Long Short-Term Memory (A-LSTM) hybrid model, and the path sharp angle is mitigated by the proposed endpoint translation path smoothing algorithm based on the Bezier curve. Finally, a multithreaded parallel greedy search algorithm is proposed to connect multiple layers of paths with minimized empty travel distance and computation time. Additionally, the self-developed simulation software is used for algorithm validation, simulation, and output files, and the feasibility and better performance of the proposed algorithm are validated through experiments. This research provides a novel approach to generating adaptive layer heights and continuous smooth paths for the concrete 3D printing of complex porous structures.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/bi_minghao"><b>Bi</b> Minghao</a>, <a href="../../../author/xia_lingwei"><b>Xia</b> Lingwei</a>, <a href="../../../author/tran_phuong_jonathan"><b>Tran</b> Jonathan</a>, <a href="../../../author/li_zhi"><b>Li</b> Zhi</a> et al. <a href="../../../date/2022/04">(2022-04)</a><br><a href="../../../bi_xia_tran_li.2022.CCZHTPfLFAM/">Continuous Contour-Zigzag Hybrid Tool-Path for Large-Format Additive Manufacturing</a></li>
      <li><a href="../../../author/coward_andy"><b>Coward</b> Andy</a>, <a href="../../../author/sorensen_harrild_jesper"><b>Sørensen</b> Jesper</a> <a href="../../../date/2023/12">(2023-12)</a><br><a href="../../../cowa_sre.2023.3PCBaOLCSE/">3D Printed Concrete Beams as Optimised Load Carrying Structural Elements:<br/>The Minimass Beam</a></li>
      <li><a href="../../../author/kristombu-baduge_shanaka"><b>Kristombu Baduge</b> Shanaka</a>, <a href="../../../author/navaratnam_satheeskumar"><b>Navaratnam</b> Satheeskumar</a>, <a href="../../../author/zidan_yousef"><b>Zidan</b> Yousef</a>, <a href="../../../author/mccormack_tom"><b>McCormack</b> Tom</a> et al. <a href="../../../date/2021/01">(2021-01)</a><br><a href="../../../kris_nava_zida_mcco.2021.IPoAMC/">Improving Performance of Additive Manufactured Concrete:<br/>A Review on Material Mix-Design, Processing, Inter-Layer Bonding, and Reinforcing-Methods</a></li>
      <li><a href="../../../author/sun_bochao"><b>Sun</b> Bochao</a>, <a href="../../../author/li_peichen"><b>Li</b> Peichen</a>, <a href="../../../author/wang_dianchao"><b>Wang</b> Dianchao</a>, <a href="../../../author/ye_jun"><b>Ye</b> Jun</a> et al. <a href="../../../date/2023/03">(2023-03)</a><br><a href="../../../sun_li_wang_ye.2023.EoMPaAo3PCaDT/">Evaluation of Mechanical Properties and Anisotropy of 3D Printed Concrete at Different Temperatures</a></li>
      <li><a href="../../../author/weng_yiwei"><b>Weng</b> Yiwei</a>, <a href="../../../author/mohamed_ahamed-noor_nisar"><b>Mohamed</b> Nisar</a>, <a href="../../../author/lee_jia-shen_brian"><b>Lee</b> Brian</a>, <a href="../../../author/gan_jia-hui_nicole"><b>Gan</b> Nicole</a> et al. <a href="../../../date/2021/02">(2021-02)</a><br><a href="../../../weng_moha_lee_gan.2021.EBIfLTPPiDCPwDDS/">Extracting BIM Information for Lattice Tool-Path-Planning in Digital Concrete Printing with Developed Dynamo Script:<br/>A Case Study</a></li>
      <li><a href="../../../author/yang_wenwei"><b>Yang</b> Wenwei</a>, <a href="../../../author/wang_li"><b>Wang</b> Li</a>, <a href="../../../author/ma_guowei"><b>Ma</b> Guowei</a>, <a href="../../../author/feng_peng"><b>Feng</b> Peng</a> <a href="../../../date/2023/06">(2023-06)</a><br><a href="../../../yang_wang_ma_feng.2023.AIMoTOaPDf3CP/">An Integrated Method of Topological-Optimization and Path-Design for 3D Concrete Printing</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
