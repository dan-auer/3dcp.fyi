---
hide:
    - navigation
    - tags
title: Koussay Daadouch, Janis Reinold, Günther Meschke
description:
tags:
 - concrete
 - layer
 - numeric
 - print
 - scale
 - simulation
 - structure

---

# Numerical Simulation of 3D Concrete Printing:<br/>:aca-blank: From the Layer- to the Structural-Scale ([2024-09](date/2024/09))
<a href="https://doi.org/10.24355/dbbs.084-202408151447-0" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.24355/dbbs.084-202408151447-0</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/daadouch_koussay"><b>Daadouch</b> Koussay</a>
,     <a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>
,     <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="https://orcid.org/0000-0003-2277-1327" title="ORCID: 0000-0003-2277-1327" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}

:aca-blank:{ .lg .middle}
    [`#concrete`](keyword/concrete)
    [`#layer`](keyword/layer)
    [`#numeric`](keyword/numeric)
    [`#print`](keyword/print)
    [`#scale`](keyword/scale)
    [`#simulation`](keyword/simulation)
    [`#structure`](keyword/structure)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Numerical%20Simulation%20of%203D%20Concrete%20Printing" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=None&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:None" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.24355/dbbs.084-202408151447-0" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.24355/dbbs.084-202408151447-0" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.24355/dbbs.084-202408151447-0" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.24355/dbbs.084-202408151447-0" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.24355/dbbs.084-202408151447-0&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.24355/dbbs.084-202408151447-0" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.24355/dbbs.084-202408151447-0&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W6907511256" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.24355/dbbs.084-202408151447-0" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.24355/dbbs.084-202408151447-0?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    In 3D printing of concrete, controlling deformation presents a significant technological hurdle, demanding precise solutions for a reliable construction process. To optimize this process in alignment with the concrete mix's unique attributes, it is imperative to realize model-based high-quality predictions of deformations and stresses. In this study, we introduce a thermodynamically consistent finite strain constitutive model tailored for fresh and early-age 3D-printable concrete. This model is employed to simulate the 3D concrete printing process, offering insights into layer shapes, deformations, forces on substrate layers, and predictions of potential structural collapse during layer-by-layer assembly. In comparison to other models, which rely either on fluid or solid mechanics, the innovative aspect of this method lies in its unified fluid and solid mechanics constitutive formulation tailored for freshly printed concrete, enabling seamless simulations through the various processing stages: extrusion, deposition, and layer-by-layer build-up [1]. This model leverages a finite strain formulation that employs a multiplicative split of the deformation gradient into elastic, aging, and viscoplastic components, coupled with a hyper-elastic potential that adapts material properties dynamically to accommodate structural build-up or aging. The required material properties are: viscoplastic parameters (viscosity, yield stress), elasticity parameters (Young's modulus, Poisson ratio) and aging parameters (increase of Young's modulus and yield stress in time), which are taken from the literature [1]. The stress-update scheme of the model resembles that of small strain plasticity, facilitating seamless integration into existing material routines, marking an advantage of this model. Implemented within the Particle Finite Element Method (PFEM), serving as the simulation framework, our constitutive model enables the modelling of evolving free surfaces during the extrusion process. The viscoplastic sub-model was validated via comparison with experimental results of a single printed layer. The aging model was verified using analytical solutions. We generate deformation plots, resulting from computational analyses of several printed layers offering a means to regulate deformations in the 3D concrete printing process. We demonstrate, based on the findings of extensive numerical investigation, the influence of the printing processes parameters (printing velocity, printing nozzle diameter and distance to the printing surface, and printing flow rate) on the final shape of the printed layers and their stress state during extrusion and deposition. The effect of the rheological properties is delegated to future works.

The proposed framework is capable of producing high quality detailed simulations of the extrusion and deposition process on the layer-scale for few layers, however, it is not suitable for the use on a larger scale, since it is computational demanding. To model the printing process of a complete structure, usually an element activation scheme is used, where a finite element discretization of the structure to-be-printed is predefined. Initially, all elements of this discretization are deactivated, then, elements are sequentially activated to simulate the printing process. Although this scheme is widely used, it does not take into account the effects of the printing process on the shape of the layers and their stress state.
To this end, we propose a multi-level simulation framework that upscales the results of the layer-scale simulations to model the printing of the structure on the structural-scale taking into account the printing process effects. The structure tobe-printed is analysed and broken into its unique parts. Then, the extrusion and deposition process of multiple successive layers is simulated with our layer-scale simulation framework (Fig. 1 left). This results in a prediction of the final shape and stress state of the unique parts of the structure, taking into consideration the effects of the printing process (Fig. 1 middle). These results are later used to generate the discretization of the entire structure, which is used in an element activation modelling scheme to simulate the printing process on the structural scale (Fig. 1 right). The results of our numerical investigation demonstrate the importance of considering the printing process effects when estimating the buildability; Assuming ideal shape of the printed layers overestimates the buildability of the structure.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/daadouch_koussay"><b>Daadouch</b> Koussay</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../rein_daad_mesc.2024.NSoTDCPBoaUFaSMF/">Numerical Simulation of Three Dimensional Concrete Printing Based on a Unified Fluid and Solid Mechanics Formulation</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
    </ol>
</div>
