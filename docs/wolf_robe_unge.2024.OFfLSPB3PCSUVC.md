---
hide:
    - navigation
    - tags
title: Christoph Wolf, Annika Robens-Radermacher, Jörg Unger
description:
tags:
 - bed
 - concrete
 - constraint
 - framework
 - large
 - optimization
 - powder
 - print
 - scale
 - structure
 - variation
 - under

---

# Optimization Framework for Large-Scale Powder-Bed 3D Printed Concrete Structures Under Various Constraints ([2024-09](date/2024/09))
<a href="https://doi.org/10.24355/dbbs.084-202408200537-0" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.24355/dbbs.084-202408200537-0</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/wolf_christoph"><b>Wolf</b> Christoph</a> <a href="https://orcid.org/0000-0002-0832-8073" title="ORCID: 0000-0002-0832-8073" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a> <a href="https://orcid.org/0000-0001-9653-6085" title="ORCID: 0000-0001-9653-6085" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/unger_f_jorg"><b>Unger</b> Jörg</a> <a href="https://orcid.org/0000-0003-0035-0951" title="ORCID: 0000-0003-0035-0951" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#bed`](keyword/bed)
    [`#concrete`](keyword/concrete)
    [`#constraint`](keyword/constraint)
    [`#framework`](keyword/framework)
    [`#large`](keyword/large)
    [`#optimization`](keyword/optimization)
    [`#powder`](keyword/powder)
    [`#print`](keyword/print)
    [`#scale`](keyword/scale)
    [`#structure`](keyword/structure)
    [`#variation`](keyword/variation)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Optimization%20Framework%20for%20Large-Scale%20Powder-Bed%203D%20Printed%20Concrete%20Structures%20Under%20Various%20Constraints" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=None&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.24355/dbbs.084-202408200537-0" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.24355/dbbs.084-202408200537-0" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.24355/dbbs.084-202408200537-0" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.24355/dbbs.084-202408200537-0" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.24355/dbbs.084-202408200537-0&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.24355/dbbs.084-202408200537-0" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.24355/dbbs.084-202408200537-0&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W6907688513" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.24355/dbbs.084-202408200537-0" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.24355/dbbs.084-202408200537-0?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    The fusion of 3D printing with concrete has transformed large-scale construction, accelerating creative design possibilities. In recent years, multiple printing techniques have been developed and are still under investigation. The powder bed technique enables overhang constructions, thereby increasing design flexibility. To maximize the advantages of those printing techniques, a holistic approach is required taking topology optimization through finite element analysis into account. The challenge is to consider a range of constraints, from material to geometrical to manufacturing. The current research focuses on the development of this approach to large-scale 3D powder bed printed concrete structure optimization, navigating the intricacies of constraints, leveraging the advantages of selective cement activation (SCA) powder-based printers, and integrating essential information from material tests. A workflow starting from geometry input and ending with printing instructions is derived, minimizing user interaction, and offering fast and reliable results for different structures.
Starting from a geometric model of the global design (provided by industry standard STL files) with the defined load cases, the geometry is optimized with respect to reduce the mass and thus CO2 emissions. Thereby, the topology optimization includes various constraints: stress constraints (mitigating tension and limit compressive stress using Drucker-Prager based models), geometric constraints (preserving specific surfaces from removing material), and manufacturing constraints (controlling member size and avoiding trapped powder in inclusions without connection to the outside).
The process receives input from upstream material tests, offering insights into strength, stiffness, and possible anisotropy. This integration of material testing enhances the accuracy and reliability of the optimization, aligning the design with realworld behavior of 3D printed concrete. An important post-processing measure of the workflow is the segmentation of the optimized global structure into substructures, aligning with the size limitations of the 3D powder-bed printer. Since approximate material and stress distribution is known in advance, substructural boundaries can be avoided in highly stressed regions, for example.
As a result, the structural experiments conducted on the optimized structures showcase enhanced loading capabilities compared to traditionally designed counterparts. Through careful analysis and validation, it is demonstrated that the optimized structures exhibit improved strength-to-weight ratios and better performance under various loading conditions. These experiments not only validate the efficacy of the topology optimization process but also provide valuable insights into the structural behavior of 3D printed concrete components.
Furthermore, the simulation of the topology optimization process provides visual representations of the structural evolution, showcasing how the algorithm iteratively refines the design to meet the specified criteria. These simulations offer a deeper understanding of the optimization process and its impact on the final structure, facilitating better decision-making throughout the design phase.
In addition to structural experiments, the optimized structures are also subjected to fabrication trials, where the printing instructions generated by the developed workflow are implemented. Through these trials, the feasibility and practicality of fabricating the optimized designs using 3D powder bed printing technology are assessed. This integration of fabrication considerations into the optimization process ensures that the final designs are not only structurally efficient but also manufacturable using available technology. Finally, the developed optimization framework is demonstrated in the design of a multiperson shading element. A sample workflow is displayed in Fig. 1. Everything will be implemented in freely available software tools for maximum adaptability of underlying algorithms and for making it publicly available.
In conclusion, the research presented herein demonstrates the effectiveness of a holistic approach to topology optimization of 3D printed concrete structures. By integrating material testing, structural experiments, and fabrication considerations into the optimization process, it is possible to achieve designs that are not only structurally optimized but also practical to fabricate and exhibit superior performance characteristics. This research contributes to advancing the state-of-the-art in large-scale 3D printing of concrete structures and opens up new avenues for creative design exploration in the field of construction.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
