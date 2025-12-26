---
hide:
    - navigation
    - tags
title: Maxime Pierre, Siavash Ghabezloo, Patrick Dangla, Romain Mesnil, Matthieu Vandamme, Jean-François Caron
description:
tags:
 - concrete
 - hardened
 - model
 - multiphysics
 - print
 - printability
 - property

---

#[:aca-openaccess:{ .xgreen }](https://doi.org/10.21012/fc12.1358) Multiphysics Modelling for 3D Concrete Printing:<br/>:aca-blank: From Printability to Hardened Properties ([2025-04](date/2025/04))
<a href="https://doi.org/10.21012/fc12.1358" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.21012/fc12.1358</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/pierre_maxime"><b>Pierre</b> Maxime</a> <a href="https://orcid.org/0000-0003-1654-7169" title="ORCID: 0000-0003-1654-7169" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/ghabezloo_siavash"><b>Ghabezloo</b> Siavash</a> <a href="https://orcid.org/0000-0003-2431-2116" title="ORCID: 0000-0003-2431-2116" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/dangla_patrick"><b>Dangla</b> Patrick</a> <a href="https://orcid.org/0000-0001-7311-8518" title="ORCID: 0000-0001-7311-8518" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/mesnil_romain"><b>Mesnil</b> Romain</a> <a href="https://orcid.org/0000-0001-5762-6037" title="ORCID: 0000-0001-5762-6037" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/vandamme_matthieu"><b>Vandamme</b> Matthieu</a> <a href="https://orcid.org/0000-0001-6201-5468" title="ORCID: 0000-0001-6201-5468" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/caron_jean-francois"><b>Caron</b> Jean-François</a> <a href="https://orcid.org/0000-0001-8625-6784" title="ORCID: 0000-0001-8625-6784" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#concrete`](keyword/concrete)
    [`#hardened`](keyword/hardened)
    [`#model`](keyword/model)
    [`#multiphysics`](keyword/multiphysics)
    [`#print`](keyword/print)
    [`#printability`](keyword/printability)
    [`#property`](keyword/property)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Multiphysics%20Modelling%20for%203D%20Concrete%20Printing" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=None&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.21012/fc12.1358" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.21012/fc12.1358" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.21012/fc12.1358" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.21012/fc12.1358" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.21012/fc12.1358&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.21012/fc12.1358" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.21012/fc12.1358&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4409431202" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.21012/fc12.1358" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.21012/fc12.1358?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    3D-printing with cement-based materials has gained attractiveness in recent years thanks to freedom of form allowing for mass customization, as well as reduced material consumption through shape optimization. However, reaching repeatable quality standards and predictable mechanical properties for print pieces remains a challenge which modelling could help solving. We thus propose a simulation framework for 3D-printing of cement-based materials with two main components. Firstly, we present a fully coupled thermo-hydro-mechanical constitutive model, extended from classical poromechanics to chemically solidifying media, wherein material properties evolve with the extent of hydration reactions, allowing to cover behaviours from the very-early age to the hardened state, along with some experimental procedures to determine model parameters. Secondly, a finite element-based modelling strategy is introduced, aimed at creating a digital twin of the printing process, namely the sequential deposition of the material throughout the print path. Such a framework allows the investigation of common issues in 3D-printing of cement-based materials along with their multi-physics origins, ranging from printing failures to longer-term durability concerns. Influence of process-related parameters -such as layer-pressing- and environmental conditions on printing stability and accuracy are displayed, along with indication as to their mitigation. Durability issues related to drying, be it at the interlayer or at the exterior surface of a print piece, are also presented in light of a detailed modelling of unsaturated behaviour from the constitutive model.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/ma_lei"><b>Ma</b> Lei</a>, <a href="../../../author/zhang_qing"><b>Zhang</b> Qing</a>, <a href="../../../author/jia_zijian"><b>Jia</b> Zijian</a>, <a href="../../../author/liu_chao"><b>Liu</b> Chao</a> et al. <a href="../../../date/2021/11">(2021-11)</a><br><a href="../../../ma_zhan_jia_liu.2022.EoDEoMPIRaPSo3PC/">Effect of Drying Environment on Mechanical Properties, Internal RH and Pore-Structure of 3D Printed Concrete</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
