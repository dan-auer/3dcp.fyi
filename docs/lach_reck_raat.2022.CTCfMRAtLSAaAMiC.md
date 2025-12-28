---
hide:
    - navigation
    - tags
title: Lukas Lachmayer, Tobias Recker, Annika Raatz
description:
tags:
 - additive
 - application
 - assembly
 - construction
 - contour
 - control
 - large
 - manufacturing
 - mobile
 - robot
 - scale

---

#[:aca-openaccess:{ .xgreen }](https://doi.org/10.1016/j.procir.2022.02.163) Contour-Tracking-Control for Mobile Robots Applicable to Large-Scale Assembly and Additive Manufacturing in Construction ([2022-03](date/2022/03))
<a href="https://doi.org/10.1016/j.procir.2022.02.163" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1016/j.procir.2022.02.163</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a> <a href="https://orcid.org/0000-0001-8070-8989" title="ORCID: 0000-0001-8070-8989" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/recker_tobias"><b>Recker</b> Tobias</a> <a href="https://orcid.org/0000-0003-1632-0538" title="ORCID: 0000-0003-1632-0538" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/raatz_annika"><b>Raatz</b> Annika</a> <a href="https://orcid.org/0000-0002-1697-1907" title="ORCID: 0000-0002-1697-1907" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Procedia CIRP, Vol. 106, pp. 108-113

:aca-blank:{ .lg .middle}
    [`#additive`](keyword/additive)
    [`#application`](keyword/application)
    [`#assembly`](keyword/assembly)
    [`#construction`](keyword/construction)
    [`#contour`](keyword/contour)
    [`#control`](keyword/control)
    [`#large`](keyword/large)
    [`#manufacturing`](keyword/manufacturing)
    [`#mobile`](keyword/mobile)
    [`#robot`](keyword/robot)
    [`#scale`](keyword/scale)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Contour-Tracking-Control%20for%20Mobile%20Robots%20Applicable%20to%20Large-Scale%20Assembly%20and%20Additive%20Manufacturing%20in%20Construction" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85127468945&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001490148000018" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.procir.2022.02.163" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.procir.2022.02.163" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.procir.2022.02.163" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.procir.2022.02.163" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.procir.2022.02.163&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.procir.2022.02.163" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.procir.2022.02.163&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4226427346" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.procir.2022.02.163" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.procir.2022.02.163?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    In the construction industry, as well as during the assembly of large-scale components, the required workspaces usually cannot be served by a stationary robot. Instead, mobile robots are used to increase the accessible space. Here, the problem arises that the accuracy of such systems is not sufficient to meet the tolerance requirements of the components to be produced. Furthermore, there is an additional difficulty in the trajectory planning process since the exact dimensions of the pre-manufactured parts are unknown. Hence, existing static planning methods cannot be exerted on every application. Recent approaches present dynamic planning algorithms based on specific component characteristics. For example, the latest methods follow the contour by a force-controlled motion or detect features with a camera. However, in several applications such as welding or additive manufacturing in construction, no contact force is generated that could be controlled. Vision-based approaches are generally restricted by varying materials and lighting conditions, often found in large-scale construction. For these reasons, we propose a more robust approach without measuring contact forces, which, for example, applies to large-scale additive manufacturing. We based our algorithm on a high-precision 2D line laser, capable of detecting different feature contours regardless of material or lightning. The laser is mounted to the robot’s end-effector and provides a depth profile of the component’s surface. From this depth data, we determine the target contour and control the manipulator to follow it. Simultaneously we vary the robot’s speed to adjust the feed rate depending on the contour’s shape, maintaining a constant material application rate. As a proof of concept, we apply the algorithm to the additive manufacturing of two-layer linear structures made from spray PU foam. When making these structures, each layer must be positioned precisely on the previous layer to obtain a straight wall and prevent elastic buckling or plastic collapse. Initial experiments show improved layer alignment within 10 % of the layer width, as well as better layer height consistency and process reliability.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/helm_volker"><b>Helm</b> Volker</a>, <a href="../../../author/jenny_selen_ercan"><b>Jenny</b> Ercan</a>, <a href="../../../author/gramazio_fabio"><b>Gramazio</b> Fabio</a>, <a href="../../../author/kohler_daniel_matthias"><b>Kohler</b> Matthias</a> <a href="../../../date/2012/10">(2012-10)</a><br><a href="../../../helm_jenn_gram_kohl.2012.MRFoCS/">Mobile Robotic Fabrication on Construction Sites:<br/>DimRob</a></li>
      <li><a href="../../../author/soto_garcia_borja"><b>Soto</b> Borja</a>, <a href="../../../author/agusti-juan_isolda"><b>Agustí-Juan</b> Isolda</a>, <a href="../../../author/hunhevicz_juri_jens"><b>Hunhevicz</b> Jens</a>, <a href="../../../author/joss_samuel"><b>Joss</b> Samuel</a> et al. <a href="../../../date/2018/05">(2018-05)</a><br><a href="../../../soto_agus_hunh_joss.2018.PoDFiC/">Productivity of Digital Fabrication in Construction:<br/>Cost and Time-Analysis of a Robotically Built Wall</a></li>
      <li><a href="../../../author/subrin_kevin"><b>Subrin</b> Kévin</a>, <a href="../../../author/bressac_thomas"><b>Bressac</b> Thomas</a>, <a href="../../../author/garnier_sebastien"><b>Garnier</b> Sébastien</a>, <a href="../../../author/ambiehl_alexandre"><b>Ambiehl</b> Alexandre</a> et al. <a href="../../../date/2018/09">(2018-09)</a><br><a href="../../../subr_bres_garn_ambi.2018.IotMRLDfHHCb3P/">Improvement of the Mobile Robot Location Dedicated for Habitable House Construction by 3D Printing</a></li>
      <li><a href="../../../author/tiryaki_efe_mehmet"><b>Tiryaki</b> Mehmet</a>, <a href="../../../author/zhang_xu"><b>Zhang</b> Xu</a>, <a href="../../../author/pham_quang-cuong"><b>Pham</b> Quang-Cuong</a> <a href="../../../date/2019/11">(2019-11)</a><br><a href="../../../tiry_zhan_pham.2019.PWM/">Printing-While-Moving:<br/>A New Paradigm for Large-Scale Robotic 3D Printing</a></li>
      <li><a href="../../../author/zhang_xu"><b>Zhang</b> Xu</a>, <a href="../../../author/li_mingyang"><b>Li</b> Mingyang</a>, <a href="../../../author/lim_hui_jian"><b>Lim</b> Jian</a>, <a href="../../../author/weng_yiwei"><b>Weng</b> Yiwei</a> et al. <a href="../../../date/2018/08">(2018-08)</a><br><a href="../../../zhan_li_lim_weng.2018.LS3PbaToMR/">Large-Scale 3D Printing by a Team of Mobile Robots</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/banijamali_kasra"><b>Banijamali</b> Kasra</a>, <a href="../../../author/martin_michael"><b>Martin</b> Michael</a>, <a href="../../../author/mascarenas_david"><b>Mascarenas</b> David</a>, <a href="../../../author/kazemian_ali"><b>Kazemian</b> Ali</a> <a href="../../../date/2025/11">(2025-11)</a><br><a href="../../../bani_mart_masc_kaze.2026.AIiR3P/">Automated Inspection in Robotic 3D Printing:<br/>In-Process Geometrical Measurements Using Structured Light Machine Vision</a></li>
      <li><a href="../../../author/martin_michael"><b>Martin</b> Michael</a>, <a href="../../../author/banijamali_kasra"><b>Banijamali</b> Kasra</a>, <a href="../../../author/gilbert_hunter"><b>Gilbert</b> Hunter</a>, <a href="../../../author/mascarenas_david"><b>Mascarenas</b> David</a> et al. <a href="../../../date/2024/09">(2024-09)</a><br><a href="../../../mart_bani_gilb_masc.2024.LBRTGIfLSAM/">LiDAR-Based Real-Time Geometrical Inspection for Large-Scale Additive Manufacturing</a></li>
      <li><a href="../../../author/dorfler_kathrin"><b>Dörfler</b> Kathrin</a>, <a href="../../../author/dielemans_gido"><b>Dielemans</b> Gido</a>, <a href="../../../author/leutenegger_stefan"><b>Leutenegger</b> Stefan</a>, <a href="../../../author/jenny_selen_ercan"><b>Jenny</b> Ercan</a> et al. <a href="../../../date/2024/09">(2024-09)</a><br><a href="../../../dorf_diel_leut_jenn.2024.ACiEC/">Advancing Construction in Existing Contexts:<br/>Prospects and Barriers of 3D Printing with Mobile Robots for Building Maintenance and Repair</a></li>
      <li><a href="../../../author/peralta-abadi_patricia"><b>Peralta Abadi</b> Patricia</a>, <a href="../../../author/ahmad_e_muhammad"><b>Ahmad</b> Muhammad</a>, <a href="../../../author/smarsly_kay"><b>Smarsly</b> Kay</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../pera_ahma_smar.2023.PIMfAMoCS/">Printing-Information-Modeling for Additive Manufacturing of Concrete Structures</a></li>
      <li><a href="../../../author/jenny_selen_ercan"><b>Jenny</b> Ercan</a>, <a href="../../../author/pietrasik_l_lukasz"><b>Pietrasik</b> Lukasz</a>, <a href="../../../author/sounigo_eliott"><b>Sounigo</b> Eliott</a>, <a href="../../../author/tsai_ping-hsun"><b>Tsai</b> Ping-Hsun</a> et al. <a href="../../../date/2022/11">(2022-11)</a><br><a href="../../../jenn_piet_soun_tsai.2023.CMTLOSP/">Continuous Mobile Thin-Layer On-Site Printing</a></li>
      <li><a href="../../../author/kloft_harald"><b>Kloft</b> Harald</a>, <a href="../../../author/dorfler_kathrin"><b>Dörfler</b> Kathrin</a>, <a href="../../../author/bahrens_meike"><b>Bährens</b> Meike</a>, <a href="../../../author/dielemans_gido"><b>Dielemans</b> Gido</a> et al. <a href="../../../date/2022/09">(2022-09)</a><br><a href="../../../klof_dorf_bahr_diel.2022.TRIotST2A/">The Research Infrastructure of the SFB TRR 277 AMC:<br/>Additive Manufacturing in Construction</a></li>
      <li><a href="../../../author/lachmayer_lukas"><b>Lachmayer</b> Lukas</a>, <a href="../../../author/recker_tobias"><b>Recker</b> Tobias</a>, <a href="../../../author/dielemans_gido"><b>Dielemans</b> Gido</a>, <a href="../../../author/dorfler_kathrin"><b>Dörfler</b> Kathrin</a> et al. <a href="../../../date/2022/05">(2022-05)</a><br><a href="../../../lach_reck_diel_dorf.2022.ASaLoaMRfMSAMiC/">Autonomous Sensing and Localization of a Mobile Robot for Multi-Step Additive Manufacturing in Construction</a></li>
    </ol>
</div>
