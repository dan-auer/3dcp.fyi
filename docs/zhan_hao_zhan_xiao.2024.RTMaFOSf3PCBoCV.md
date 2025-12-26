---
hide:
    - navigation
    - tags
title: Hanghua Zhang, Lucen Hao, Shipeng Zhang, Jianzhuang Xiao, Chi Poon
description:
tags:
 - base
 - computer
 - concrete
 - feedback
 - monitoring
 - operation
 - print
 - real
 - system
 - time
 - vision
 - on

---

# Real-Time Monitoring and Feedback Operation System for 3D Printed Concrete Based on Computer-Vision ([2024-09](date/2024/09))
<a href="https://doi.org/10.24355/dbbs.084-202408150633-0" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.24355/dbbs.084-202408150633-0</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/zhang_hanghua"><b>Zhang</b> Hanghua</a> <a href="https://orcid.org/0000-0001-7224-4555" title="ORCID: 0000-0001-7224-4555" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/hao_lucen"><b>Hao</b> Lucen</a>
,     <a href="../../../author/zhang_shipeng"><b>Zhang</b> Shipeng</a>
,     <a href="../../../author/xiao_jianzhuang"><b>Xiao</b> Jianzhuang</a> <a href="https://orcid.org/0000-0003-1287-1199" title="ORCID: 0000-0003-1287-1199" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/poon_sun_chi"><b>Poon</b> Chi</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#base`](keyword/base)
    [`#computer`](keyword/computer)
    [`#concrete`](keyword/concrete)
    [`#feedback`](keyword/feedback)
    [`#monitoring`](keyword/monitoring)
    [`#operation`](keyword/operation)
    [`#print`](keyword/print)
    [`#real`](keyword/real)
    [`#system`](keyword/system)
    [`#time`](keyword/time)
    [`#vision`](keyword/vision)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Real-Time%20Monitoring%20and%20Feedback%20Operation%20System%20for%203D%20Printed%20Concrete%20Based%20on%20Computer-Vision" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=None&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.24355/dbbs.084-202408150633-0" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.24355/dbbs.084-202408150633-0" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.24355/dbbs.084-202408150633-0" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.24355/dbbs.084-202408150633-0" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.24355/dbbs.084-202408150633-0&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.24355/dbbs.084-202408150633-0" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.24355/dbbs.084-202408150633-0&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W6888930005" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.24355/dbbs.084-202408150633-0" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.24355/dbbs.084-202408150633-0?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    While 3D-printed concrete (3DPC) has been widely studied and successfully applied in various real-world engineering projects globally, challenges persist in the practical application of 3DPC, with the most significant one being quality monitoring and control [1, 2]. Concrete is batch mixed but continuously extruded in 3D printing process, resulting in instabilities in material status. Therefore, secondary near-nozzle mixing process was proposed [3]. Pre-mixed fresh concrete with a high flowability was secondarily mixed with rheological modifier in the near-nozzle mixer to form printable concrete [1]. The addition rate of admixture during secondary mixing should be matched with the time-dependent concrete fluidity. Consequently, inline monitoring was suggested for printed filament [2] while there is still a lack of research on the feedback system for quality control to realize real-time adjustment operations for 3DPC with the secondary mixing process. This study implements secondary mixing with an accelerator as the chosen strategy for 3DPC, and an intelligent real-time adjustment system based on computer vision is developed for quality control of 3DPC. Visual geometry group (VGG) network [4] was employed to classify the images of printed filament, and a feedback operation system based on this classification results was built to regulate the extrusion rate and material fluidity.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/tittelboom_kim"><b>Tittelboom</b> Kim</a>, <a href="../../../author/kazemian_ali"><b>Kazemian</b> Ali</a>, <a href="../../../author/kreiger_l_eric"><b>Kreiger</b> Eric</a> et al. <a href="../../../date/2022/04">(2022-04)</a><br><a href="../../../mech_titt_kaze_krei.2022.ARfQCoHaHPC/">A Roadmap for Quality-Control of Hardening and Hardened Printed Concrete</a></li>
      <li><a href="../../../author/muthukrishnan_shravan"><b>Muthukrishnan</b> Shravan</a>, <a href="../../../author/ramakrishnan_sayanthan"><b>Ramakrishnan</b> Sayanthan</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2021/06">(2021-06)</a><br><a href="../../../muth_rama_sanj.2021.TfIBi3CP/">Technologies for Improving Buildability in 3D Concrete Printing</a></li>
      <li><a href="../../../author/zhang_nan"><b>Zhang</b> Nan</a>, <a href="../../../author/xia_ming"><b>Xia</b> Ming</a>, <a href="../../../author/sanjayan_gnananandan_jay"><b>Sanjayan</b> Jay</a> <a href="../../../date/2021/10">(2021-10)</a><br><a href="../../../zhan_xia_sanj.2022.SDNNMf3CP/">Short-Duration Near-Nozzle Mixing for 3D Concrete Printing</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
