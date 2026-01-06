---
hide:
    - navigation
    - tags
    - footer
title: Gomzyakov Albert, Taubert Markus, Sokolov Dmitrii, Reuter Uwe, Mechtcherine Viktor
description:
tags:
 - base
 - concrete
 - geometry
 - prediction
 - rheology
 - setup
 - slump
 - test

---

#Setup for ML-Based Prediction of Concrete Rheology from 3D Slump-Test-Geometry ([2024-09](date/2024/09))
:aca-closedaccess:{ .xred .lg .middle} <a href="https://doi.org/10.1007/978-3-031-70031-6_21" title="DOI" target="_blank">:aca-doi:{ .lg .middle }</a> <a href="https://doi.org/10.1007/978-3-031-70031-6_21" target="_blank">10.1007/978-3-031-70031-6_21</a>

<a href="../../../author/gomzyakov_albert"><b>Gomzyakov</b>&nbsp;Albert</a></span>, <span class="author"><a href="https://orcid.org/0000-0002-3999-5186" title="ORCID: 0000-0002-3999-5186" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/taubert_markus"><b>Taubert</b>&nbsp;Markus</a></span>, <span class="author"><a href="https://orcid.org/0009-0004-2811-9625" title="ORCID: 0009-0004-2811-9625" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/sokolov_dmitrii"><b>Sokolov</b>&nbsp;Dmitrii</a></span>, <a href="../../../author/reuter_uwe"><b>Reuter</b>&nbsp;Uwe</a></span>, <span class="author"><a href="https://orcid.org/0000-0002-4685-7064" title="ORCID: 0000-0002-4685-7064" target="_blank">:aca-orcid:{ .lg .middle }</a>&nbsp;<a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b>&nbsp;Viktor</a></span><br>
Contribution - Proceedings of the 4th RILEM International Conference on Concrete and Digital Fabrication, pp. 174-181

<a href="../../keyword/base"><button class="btn">#base</button></a> <a href="../../keyword/concrete"><button class="btn">#concrete</button></a> <a href="../../keyword/geometry"><button class="btn">#geometry</button></a> <a href="../../keyword/prediction"><button class="btn">#prediction</button></a> <a href="../../keyword/rheology"><button class="btn">#rheology</button></a> <a href="../../keyword/setup"><button class="btn">#setup</button></a> <a href="../../keyword/slump"><button class="btn">#slump</button></a> <a href="../../keyword/test"><button class="btn">#test</button></a> 

<a href="https://scholar.google.com/scholar_lookup?title=Setup%20for%20ML-Based%20Prediction%20of%20Concrete%20Rheology%20from%203D%20Slump-Test-Geometry" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85203058867&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001333034600021" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1007/978-3-031-70031-6_21" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1007/978-3-031-70031-6_21" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1007/978-3-031-70031-6_21" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1007/978-3-031-70031-6_21" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1007/978-3-031-70031-6_21&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1007/978-3-031-70031-6_21" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1007/978-3-031-70031-6_21&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4402088878" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1007/978-3-031-70031-6_21" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1007/978-3-031-70031-6_21?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>
???+ quote "Abstract" 
    In the evolving landscape of construction technology, accurately determining the rheological parameters for fresh concrete has become increasingly important, driven by technical advancements and economic considerations. The traditional correlation of standard test methods, such as the slump test and flow table tests, with rheological parameters is a subject of ongoing interest. Established estimations based on slump values and spread diameters are now recognized as having limitations in precision. This has led to a growing interest in non-invasive optical measurement methods, which, along with the widespread availability of standard equipment, could potentially replace costly and complex laboratory tools like rotational rheometers, often absent at construction sites. This paper presents a novel semi-automated approach for efficient collecting and preparing a dataset for machine learning (ML), specifically artificial neural network (ANN) training. This methodology aims to predict key rheological parameters of fresh concrete from its overall 3D slump geometry. The method involves conducting standard slump tests and measuring rheological parameters using a rotational rheometer across a comprehensive set of mixtures. These tests are paired with capturing the 3D geometry of the slumps. Each slump is also subjected to dynamic action on a standard flow table, followed by 3D scanning. Automation is achieved through 3D photogrammetric reconstruction using a gantry printer-mounted camera, which continuously captures images around the slump. A scripted process then transforms coordinates and slices 3D models to derive an array of height and diameter pairs, representing the slump's geometry before and after dynamic action. Automating geometric data collection and processing boosts robustness and overcomes manual acquisition challenges, enhancing scalability and reproducibility of the method. The slump geometries are prepared to be further used as training data, with yield stress and viscosity serving as the training targets.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ example "1 References"
    <ol class = "bordered-list">
      <li><a href="../../../author/schutter_geert"><b>Schutter</b> Geert</a>, <a href="../../../author/lesage_karel"><b>Lesage</b> Karel</a>, <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a> et al. <a href="../../../date/2018/08">(2018-08)</a><br><a href="../../../schu_lesa_mech_nere.2018.Vo3PwC/">Vision of 3D Printing with Concrete:<br/>Technical, Economic and Environmental Potentials</a></li>
    </ol>
???+ bug "0 Citations"
    <ol  class = "bordered-list" reversed>
    </ol>
</div>

<div class="grid cards" markdown>

???+ warning "BibTeX"

    ```bibtex
    @inproceedings{gomz_taub_soko_reut.2024.SfMBPoCRf3STG,
      author            = "Albert Gomzyakov and Markus Taubert and Dmitrii Sokolov and Uwe Reuter and Viktor Mechtcherine",
      title             = "Setup for ML-Based Prediction of Concrete Rheology from 3D Slump-Test-Geometry",
      doi               = "10.1007/978-3-031-70031-6_21",
      year              = "2024",
      volume            = "53",
      pages             = "174--181",
      booktitle         = "Proceedings of the 4th RILEM International Conference on Concrete and Digital Fabrication",
      editor            = "Dirk Lowke and Niklas Freund and David Böhler and Friedrich Herding",
    }


    ```

???+ failure "Formatted Citation"

    === "IEEE"

    <span id="iee">A. Gomzyakov, M. Taubert, D. Sokolov, U. Reuter and V. Mechtcherine, “Setup for ML-Based Prediction of Concrete Rheology from 3D Slump-Test-Geometry”, in <i>Proceedings of the 4th RILEM International Conference on Concrete and Digital Fabrication</i>,  2024, vol. 53, pp. 174–181. doi: 10.1007/978-3-031-70031-6_21.</span><button class="md-code__button" data-clipboard-target="#ieee" data-md-type="copy" title="Copy IEEE Citation to Clipboard"></button>

    === "CMOS"

    <span id="cmos">Gomzyakov, Albert, Markus Taubert, Dmitrii Sokolov, Uwe Reuter, and Viktor Mechtcherine. “Setup for ML-Based Prediction of Concrete Rheology from 3D Slump-Test-Geometry”. In <i>Proceedings of the 4th RILEM International Conference on Concrete and Digital Fabrication</i>, edited by Dirk Lowke, Niklas Freund, David Böhler, and Friedrich Herding, 53:174–81, 2024. https://doi.org/10.1007/978-3-031-70031-6_21.</span><button class="md-code__button" data-clipboard-target="#cmos" data-md-type="copy" title="Copy CMOS Citation to Clipboard"></button>

</div>
