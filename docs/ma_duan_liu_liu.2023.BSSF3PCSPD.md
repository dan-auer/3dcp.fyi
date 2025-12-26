---
hide:
    - navigation
    - tags
title: Zongfang Ma, Ming Duan, Chao Liu, Huawei Liu, Yiwen Wu, Weipeng Wan, Lin Song
description:
tags:
 - concrete
 - detection
 - porosity
 - print
 - segment
 - surface

---

#:aca-closedaccess:{ .xred '} Better Semantic Segmentation For 3D Printing Concrete Surface Pore Detection ([2023-07](date/2023/07))
<a href="https://doi.org/10.23919/ccc58697.2023.10239802" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.23919/ccc58697.2023.10239802</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/ma_zongfang"><b>Ma</b> Zongfang</a>
,     <a href="../../../author/duan_ming"><b>Duan</b> Ming</a>
,     <a href="../../../author/liu_chao"><b>Liu</b> Chao</a> <a href="https://orcid.org/0000-0002-8799-7100" title="ORCID: 0000-0002-8799-7100" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/liu_huawei"><b>Liu</b> Huawei</a> <a href="https://orcid.org/0000-0003-4433-5075" title="ORCID: 0000-0003-4433-5075" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/wu_yiwen"><b>Wu</b> Yiwen</a>
,     <a href="../../../author/wan_weipeng"><b>Wan</b> Weipeng</a>
,     <a href="../../../author/song_lin"><b>Song</b> Lin</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#concrete`](keyword/concrete)
    [`#detection`](keyword/detection)
    [`#porosity`](keyword/porosity)
    [`#print`](keyword/print)
    [`#segment`](keyword/segment)
    [`#surface`](keyword/surface)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Better%20Semantic%20Segmentation%20For%203D%20Printing%20Concrete%20Surface%20Pore%20Detection" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85175584016&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.23919/ccc58697.2023.10239802" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.23919/ccc58697.2023.10239802" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.23919/ccc58697.2023.10239802" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.23919/ccc58697.2023.10239802" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.23919/ccc58697.2023.10239802&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.23919/ccc58697.2023.10239802" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.23919/ccc58697.2023.10239802&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4386821774" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.23919/ccc58697.2023.10239802" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.23919/ccc58697.2023.10239802?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    As the most common defect of 3D printing concrete components, pores will seriously affect the mechanical properties of 3D printing concrete. In recent years, deep learning methods have been widely used in defect recognition tasks because of their high efficiency, accuracy, and autonomous learning of data features. The DeepLabv3+ segmentation model has achieved outstanding image segmentation results. This is due to its innovative Encoder-Decoder structure, which incorporates high-level semantic information and shallow target features. Additionally, it employs the deep separation convolution technique. However, in the process of coding module training, the spatial dimension of input data is gradually reduced, resulting in the loss of useful information, which brings certain limitations to the recognition of small targets with different scales. This paper presents a novel approach to identifying concrete pores using the deep learning method. Specifically, we propose a semantic segmentation method based on an improved version of DeepLabv3+. The proposed method incorporates a pore feature layer combination module and CBAM module to expand the receptive field and obtain more accurate pore feature maps. In order to evaluate the effectiveness of the improved algorithm, we utilize the pore images generated by the laboratory as the original dataset. Using the same dataset, we compared these images with current representative image segmentation models, such as Unet and DeepLab V3+. The results indicate that the recall rate of this algorithm is 2.55% higher than Unet and 2.15% higher than DeepLabv3+. The mean average intersection ratio reached 88.30%, and the average pixel accuracy reached 92.84%. The algorithm is more suitable for 3D printing concrete pore segmentation tasks and has practical engineering application significance.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/chen_yu"><b>Chen</b> Yu</a>, <a href="../../../author/veer_frederic"><b>Veer</b> Frederic</a>, <a href="../../../author/copuroglu_oguzhan"><b>Çopuroğlu</b> Oğuzhan</a>, <a href="../../../author/schlangen_erik"><b>Schlangen</b> Erik</a> <a href="../../../date/2018/09">(2018-09)</a><br><a href="../../../chen_veer_copu_schl.2019.FoULCCAiEB3CP/">Feasibility of Using Low CO2 Concrete Alternatives in Extrusion-Based 3D Concrete Printing</a></li>
      <li><a href="../../../author/kruger_pienaar_jacques"><b>Kruger</b> Jacques</a>, <a href="../../../author/plessis_anton"><b>Plessis</b> Anton</a>, <a href="../../../author/zijl_pieter-adriaan-greeff_gideon"><b>Zijl</b> Gideon</a> <a href="../../../date/2020/12">(2020-12)</a><br><a href="../../../krug_ples_zijl.2021.AIitPoEB3PC/">An Investigation into the Porosity of Extrusion-Based 3D Printed Concrete</a></li>
      <li><a href="../../../author/ma_guowei"><b>Ma</b> Guowei</a>, <a href="../../../author/li_zhijian"><b>Li</b> Zhijian</a>, <a href="../../../author/wang_li"><b>Wang</b> Li</a>, <a href="../../../author/wang_fang"><b>Wang</b> Fang</a> et al. <a href="../../../date/2019/01">(2019-01)</a><br><a href="../../../ma_li_wang_wang.2019.MAoAFRCfEB3P/">Mechanical Anisotropy of Aligned Fiber-Reinforced Composite for Extrusion-Based 3D Printing</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
