---
hide:
    - navigation
    - tags
title: Janis Reinold, Günther Meschke
description:
tags:
 - age
 - algorithm
 - base
 - evolutionary
 - material
 - split
 - stiffness
 - a
 - on

---

#:aca-closedaccess:{ .xred '} Algorithm for Aging Materials with Evolving Stiffness Based on a Multiplicative Split ([2022-06](date/2022/06))
<a href="https://doi.org/10.1016/j.cma.2022.115080" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1016/j.cma.2022.115080</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>
,     <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="https://orcid.org/0000-0003-2277-1327" title="ORCID: 0000-0003-2277-1327" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Computer Methods in Applied Mechanics and Engineering, Vol. 397, No. (None,)

:aca-blank:{ .lg .middle}
    [`#age`](keyword/age)
    [`#algorithm`](keyword/algorithm)
    [`#base`](keyword/base)
    [`#evolutionary`](keyword/evolutionary)
    [`#material`](keyword/material)
    [`#split`](keyword/split)
    [`#stiffness`](keyword/stiffness)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Algorithm%20for%20Aging%20Materials%20with%20Evolving%20Stiffness%20Based%20on%20a%20Multiplicative%20Split" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85131405398&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:000808582200002" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1016/j.cma.2022.115080" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1016/j.cma.2022.115080" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1016/j.cma.2022.115080" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1016/j.cma.2022.115080" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1016/j.cma.2022.115080&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1016/j.cma.2022.115080" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1016/j.cma.2022.115080&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4281723672" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1016/j.cma.2022.115080" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1016/j.cma.2022.115080?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    During curing or hydration processes, materials such as polymers or fresh concrete undergo microstructural changes, which manifest themselves on the macroscopic scale as evolving material properties like strength or stiffness. Considering the increasing importance of additive manufacturing techniques using this type of “aging” materials, which typically undergo large deformations during the extrusion and deposition processes, a consistent finite strain model is required that takes evolving material properties and the proper characterization of the large deformation kinematics into account. In the proposed formulation, the problem of evolving stiffness is solved, in contrast to hypoelastic rate formulations typically used for this type of problems, by means of a multiplicative split of the deformation gradient into elastic and non-recoverable aging parts and the adoption of a hyperelastic potential. The existence of a hyperelastic potential is an advantage as it easily allows accounting for thermodynamic consistency. By introducing an internal aging parameter, a hyperelastic model based on principal logarithmic strains is adopted, to derive a novel and consistent evolution law for the aging part of the deformation gradient. The incremental and temporal discretization of the proposed constitutive model leads to a stress update scheme, which is reduced to a single multiplication of the principal logarithmic strains by a certain factor. As only minor adaptions are necessary, the proposed model is very attractive for implementations in already existing numerical models. In a benchmark study, the main aspects of the formulation are discussed, and the applicability of the proposed model is demonstrated by a computational analysis of a 3D printed concrete wall.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/esposito_laura"><b>Esposito</b> Laura</a>, <a href="../../../author/casagrande_lorenzo"><b>Casagrande</b> Lorenzo</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a>, <a href="../../../author/asprone_domenico"><b>Asprone</b> Domenico</a> et al. <a href="../../../date/2021/10">(2021-10)</a><br><a href="../../../espo_casa_menn_aspr.2021.EACBo3PM/">Early-Age Creep Behavior of 3D Printable Mortars:<br/>Experimental Characterisation and Analytical Modelling</a></li>
      <li><a href="../../../author/nedjar_boumediene"><b>Nedjar</b> Boumediene</a> <a href="../../../date/2021/07">(2021-07)</a><br><a href="../../../nedj.2021.OaGNLIFftMo3CP/">On a Geometrically Non-Linear Incremental Formulation for the Modeling of 3D Concrete Printing</a></li>
      <li><a href="../../../author/nedjar_boumediene"><b>Nedjar</b> Boumediene</a> <a href="../../../date/2021/09">(2021-09)</a><br><a href="../../../nedj.2022.IVaFSftMo3CP/">Incremental Viscoelasticity at Finite Strains for the Modelling of 3D Concrete Printing</a></li>
      <li>None</li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a>, <a href="../../../author/spangenberg_jon"><b>Spangenberg</b> Jon</a>, <a href="../../../author/wallevik_elvar_jon"><b>Wallevik</b> Jon</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> <a href="../../../date/2020/06">(2020-06)</a><br><a href="../../../rous_span_wall_wolf.2020.NSoCP/">Numerical Simulations of Concrete Processing:<br/>From Standard Formative Casting to Additive Manufacturing</a></li>
      <li><a href="../../../author/suiker_s-j_akke"><b>Suiker</b> Akke</a> <a href="../../../date/2018/01">(2018-01)</a><br><a href="../../../suik.2018.MPoWSi3PP/">Mechanical Performance of Wall Structures in 3D Printing Processes:<br/>Theory, Design Tools and Experiments</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> <a href="../../../date/2018/02">(2018-02)</a><br><a href="../../../wolf_bos_sale.2018.EAMBo3PC/">Early-Age Mechanical Behaviour of 3D Printed Concrete:<br/>Numerical Modelling and Experimental Testing</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/suiker_s-j_akke"><b>Suiker</b> Akke</a> <a href="../../../date/2019/06">(2019-06)</a><br><a href="../../../wolf_suik.2019.SFdEB3PP/">Structural Failure during Extrusion-Based 3D Printing Processes</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/reinold_michel_janis"><b>Reinold</b> Janis</a>, <a href="../../../author/daadouch_koussay"><b>Daadouch</b> Koussay</a>, <a href="../../../author/meschke_gunther"><b>Meschke</b> Günther</a> <a href="../../../date/2023/11">(2023-11)</a><br><a href="../../../rein_daad_mesc.2024.NSoTDCPBoaUFaSMF/">Numerical Simulation of Three Dimensional Concrete Printing Based on a Unified Fluid and Solid Mechanics Formulation</a></li>
    </ol>
</div>
