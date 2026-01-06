---
hide:
    - navigation
    - tags
    - footer
title: Mechtcherine Viktor, Gram Annika, Krenzer Knut, Schwabe Jörg-Henry, Bellmann Claudia, Shyshko Sergiy
description:
tags:
 - concrete
 - discrete
 - element
 - flow
 - fresh
 - method
 - simulation

---

#Simulation of Fresh Concrete Flow Using Discrete Element Method (DEM) ([2014-03](date/2014/03))
:aca-closedaccess:{ .xred .lg .middle} <a href="https://doi.org/10.1007/978-94-017-8884-7_3" title="DOI" target="_blank">:aca-doi:{ .lg .middle }</a> <a href="https://doi.org/10.1007/978-94-017-8884-7_3" target="_blank">10.1007/978-94-017-8884-7_3</a>

<span class="author"><a href="https://orcid.org/0000-0002-4685-7064" title="ORCID: 0000-0002-4685-7064" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b>&nbsp;Viktor</a></span>, <a href="../../../author/gram_annika"><b>Gram</b>&nbsp;Annika</a></span>, <a href="../../../author/krenzer_knut"><b>Krenzer</b>&nbsp;Knut</a></span>, <a href="../../../author/schwabe_jorg-henry"><b>Schwabe</b>&nbsp;Jörg-Henry</a></span>, <a href="../../../author/bellmann_claudia"><b>Bellmann</b>&nbsp;Claudia</a></span>, <a href="../../../author/shyshko_sergiy"><b>Shyshko</b>&nbsp;Sergiy</a></span><br>
Contribution - Simulation of Fresh Concrete Flow, pp. 65-98

<a href="../../keyword/concrete"><button class="btn">#concrete</button></a> <a href="../../keyword/discrete"><button class="btn">#discrete</button></a> <a href="../../keyword/element"><button class="btn">#element</button></a> <a href="../../keyword/flow"><button class="btn">#flow</button></a> <a href="../../keyword/fresh"><button class="btn">#fresh</button></a> <a href="../../keyword/method"><button class="btn">#method</button></a> <a href="../../keyword/simulation"><button class="btn">#simulation</button></a> 

<a href="https://scholar.google.com/scholar_lookup?title=Simulation%20of%20Fresh%20Concrete%20Flow%20Using%20Discrete%20Element%20Method%20%28DEM%29" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-84907933281&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:000342576000004" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1007/978-94-017-8884-7_3" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1007/978-94-017-8884-7_3" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1007/978-94-017-8884-7_3" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1007/978-94-017-8884-7_3" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1007/978-94-017-8884-7_3&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1007/978-94-017-8884-7_3" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1007/978-94-017-8884-7_3&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W1227720195" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1007/978-94-017-8884-7_3" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1007/978-94-017-8884-7_3?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>
???+ quote "Abstract" 
    The behaviour of fresh concrete during its mixing, transport, placement, and compaction can ultimately have significant effects on its mechanical performance, durability, surface appearance, and on its other properties after hardening. In concrete construction many problems result from the improper filling of formwork, insufficient de-airing, concrete segregation, etc. The importance of these issues has increased year after year since formwork is becoming continually more complex. Steel reinforcement has become denser, and the range workability has been considerably broadened by the use of self-compacting concrete (SCC) and other novel concrete materials. Consequently, on the one hand, modern material design must match particular demands resulting from the geometrical and technological conditions to which the material is subjected. On the other hand, the concrete working techniques and, in some cases, the geometry of structures can be optimised in considering the usage of particular concretes with their special rheological properties. So, in order to build concrete structures efficiently and with high quality, the consistency of the fresh concrete should comply with the requirements posed by the structure's geometry and by the methods of transport, placing, and compaction. Computer simulation of fresh concrete behaviour and the working processes could provide a powerful tool in optimising concrete construction and developing new concrete technologies [1]. As a complement to laboratory experimentation, discrete numerical simulation applied to granular materials provides insight into the meso-structure on the same scale as the grains and improves our understanding of the origin of macroscopic material behaviour. A description of various discrete simulation methods used in the mechanics literature can be found in [2]. This chapter focuses on the application of Discrete Element Method (DEM) in simulating the flow of fresh concrete. In particular a so-called particle model approach, which is a variation of the DEM, is considered. This approach uses simple basic elements – spheres and walls, which makes the computation relatively simple and fast. The great advantage of DEM is that it provides an opportunity to display discreetly the movement of the concrete mixture as a whole, and of its individual components. The concrete mixture is formed by a large number of particles connected among each other and to the model walls in accordance with laws of the defined contact behaviour. Thus, concrete technology's relevant processes and phenomena, such as mixing, compaction, de-airing, sedimentation, fibre distribution, orientation, etc. could be analyzed and taken into account in solving various problems. Based on work by Chu et al. [3] and Chu and Machida [17], a 3D DEM using a 3D particle flow code program, PCD3D, was applied in a preliminary study by Noor and Uomoto [4] to simulate the flow of SCC during various standard tests: the Slump Flow, L-box and V-funnel procedures. As opposed to an approach whose basis is a continuum, DEM was selected and was observed by the authors to reproduce the behaviour of fresh concrete in a qualitatively correct manner. As a compromise between modelling aggregate movement and limiting computation time, the material was divided into mortar and coarse aggregates larger than 7.5 mm. The method, proposed by Noor and Uomoto, was also adopted by Petersson and Hakami [5] and Petersson [6] in simulating SCC flow during L-box and slump flow testing, and J-ring and L-box testing, respectively. They found 3D- and, depending on the type of problem, 2D-simulations to be appropriate. More recently it was shown by Mechtcherine and Shyshko [7-9] that this numerical technique allows the simulation of the behaviour of fresh concrete with varied consistencies during transport, placement, and compaction. Processes such as casting, compaction of ordinary concrete, wet spraying and extrusion have been simulated as well. In the case of fibre-reinforced materials the effects of concrete consistency and the working process on the orientation of fibres have been of particular interest. The correlation between mix design and rheology was also investigated through the effect of adding large aggregates or fibre. Furthermore, first attempts towards modelling air inclusions and de-airing were carried out.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ example "1 References"
    <ol class = "bordered-list">
      <li><a href="../../../author/takashima_hiroyuki"><b>Takashima</b> Hiroyuki</a>, <a href="../../../author/miyagai_kiyotaka"><b>Miyagai</b> Kiyotaka</a>, <a href="../../../author/hashida_toshiyuki"><b>Hashida</b> Toshiyuki</a>, <a href="../../../author/li_c_victor"><b>Li</b> Victor</a> <a href="../../../date/2002/09">(2002-09)</a><br><a href="../../../taka_miya_hash_li.2003.ADAftMPoPDFRCCbEM/">A Design Approach for the Mechanical Properties of Polypropylene-Discontinuous-Fiber-Reinforced Cementitious Composites by Extrusion-Molding</a></li>
    </ol>
???+ bug "0 Citations"
    <ol  class = "bordered-list" reversed>
    </ol>
</div>

<div class="grid cards" markdown>

???+ warning "BibTeX"

    ```bibtex
    @inproceedings{mech_gram_kren_schw.2014.SoFCFUDEMD,
      author            = "Viktor Mechtcherine and Annika Gram and Knut Krenzer and Jörg-Henry Schwabe and Claudia Bellmann and Sergiy Shyshko",
      title             = "Simulation of Fresh Concrete Flow Using Discrete Element Method (DEM)",
      doi               = "10.1007/978-94-017-8884-7_3",
      year              = "2014",
      volume            = "15",
      pages             = "65--98",
      booktitle         = "Simulation of Fresh Concrete Flow",
      editor            = "Nicolas Roussel and Annika Gram",
    }


    ```

???+ failure "Formatted Citation"

    === "IEEE"

    <span id="iee">V. Mechtcherine, A. Gram, K. Krenzer, J.-H. Schwabe, C. Bellmann and S. Shyshko, “Simulation of Fresh Concrete Flow Using Discrete Element Method (DEM)”, in <i>Simulation of Fresh Concrete Flow</i>,  2014, vol. 15, pp. 65–98. doi: 10.1007/978-94-017-8884-7_3.</span><button class="md-code__button" data-clipboard-target="#ieee" data-md-type="copy" title="Copy IEEE Citation to Clipboard"></button>

    === "CMOS"

    <span id="cmos">Mechtcherine, Viktor, Annika Gram, Knut Krenzer, Jörg-Henry Schwabe, Claudia Bellmann, and Sergiy Shyshko. “Simulation of Fresh Concrete Flow Using Discrete Element Method (DEM)”. In <i>Simulation of Fresh Concrete Flow</i>, edited by Nicolas Roussel and Annika Gram, 15:65–98, 2014. https://doi.org/10.1007/978-94-017-8884-7_3.</span><button class="md-code__button" data-clipboard-target="#cmos" data-md-type="copy" title="Copy CMOS Citation to Clipboard"></button>

</div>
