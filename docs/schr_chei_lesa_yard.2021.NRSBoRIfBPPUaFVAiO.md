---
hide:
    - navigation
    - tags
title: Robin Schryver, Khadija Cheikh, Karel Lesage, Mert Yardimci, Geert Schutter
description:
tags:
 - approach
 - base
 - bingham
 - finite
 - numeric
 - paste
 - pump
 - reliability
 - rheology
 - volume

---

#[:aca-openaccess:{ .xgreen }](https://www.mdpi.com/1996-1944/14/17/5011/pdf?version=1630973094) Numerical Reliability Study Based on Rheological Input for Bingham-Paste-Pumping Using a Finite Volume Approach in OpenFOAM ([2021-09](date/2021/09))
<a href="https://doi.org/10.3390/ma14175011" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.3390/ma14175011</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/schryver_robin"><b>de Schryver</b> Robin</a> <a href="https://orcid.org/0000-0003-3941-4385" title="ORCID: 0000-0003-3941-4385" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/cheikh_khadija"><b>el Cheikh</b> Khadija</a> <a href="https://orcid.org/0000-0003-3841-3196" title="ORCID: 0000-0003-3841-3196" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/lesage_karel"><b>Lesage</b> Karel</a> <a href="https://orcid.org/0000-0003-3891-7036" title="ORCID: 0000-0003-3891-7036" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/yardimci_yucel_mert"><b>Yardimci</b> Mert</a> <a href="https://orcid.org/0000-0003-0713-0361" title="ORCID: 0000-0003-0713-0361" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/schutter_geert"><b>de Schutter</b> Geert</a> <a href="https://orcid.org/0000-0001-5603-2616" title="ORCID: 0000-0001-5603-2616" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Materials, Vol. 14, Iss. 17, No. (None,)

:aca-blank:{ .lg .middle}
    [`#approach`](keyword/approach)
    [`#base`](keyword/base)
    [`#bingham`](keyword/bingham)
    [`#finite`](keyword/finite)
    [`#numeric`](keyword/numeric)
    [`#paste`](keyword/paste)
    [`#pump`](keyword/pump)
    [`#reliability`](keyword/reliability)
    [`#rheology`](keyword/rheology)
    [`#volume`](keyword/volume)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Numerical%20Reliability%20Study%20Based%20on%20Rheological%20Input%20for%20Bingham-Paste-Pumping%20Using%20a%20Finite%20Volume%20Approach%20in%20OpenFOAM" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-85114286660&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:000694346700001" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.3390/ma14175011" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.3390/ma14175011" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.3390/ma14175011" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.3390/ma14175011" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.3390/ma14175011&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.3390/ma14175011" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.3390/ma14175011&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W3196683383" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.3390/ma14175011" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.3390/ma14175011?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    Rheological quantification is important in many industries, the concrete industry in particular, e.g., pumping, form filling, etc. Instead of performing expensive and time-consuming experiments, numerical simulations are a powerful means in view of rheological assessment. However, due to the unclear numerical reliability and the uncertainty of rheological input data, it is important for the construction industry to assess the numerical outcome. To reduce the numerical domain of cementitious suspensions, we assessed the numerical finite volume simulations of Bingham paste pumping flows in OpenFOAM. We analysed the numerical reliability, first, irrespective of its rheological input by comparison with the literature and theory, and second, dependent on a certain rheological quantification by comparison with pumping experiments. Irrespective of the rheological input, the numerical results were significantly accurate. Dependent on the rheological input, a numerical mismatch, however, existed. Errors below 1% can be expected for proposed numerical rules of thumb: a bi-viscous regularisation, with pressure numbers higher than 5/4. To improve bias due to uncertain rheology, a rheological configuration close to the engineer's aimed application should be used. However, important phenomena should not be overlooked. Further assessment for lubrication flows, in, e.g., concrete pumping, is still necessary to address concerns of reliability and stability.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/haustein_a_martin"><b>Haustein</b> Martin</a>, <a href="../../../author/kluwe_niklas_moritz"><b>Kluwe</b> Moritz</a>, <a href="../../../author/schwarze_rudiger"><b>Schwarze</b> Rüdiger</a> <a href="../../../date/2020/03">(2020-03)</a><br><a href="../../../haus_kluw_schw.2020.EIotPoaMCTP/">Experimental Investigation of the Pumping of a Model-Concrete Through Pipes</a></li>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/kasten_knut"><b>Kasten</b> Knut</a> <a href="../../../date/2013/12">(2013-12)</a><br><a href="../../../mech_nere_kast.2014.TPoCUSPR/">Testing Pumpability of Concrete Using Sliding-Pipe Rheometer</a></li>
      <li><a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a>, <a href="../../../author/pierre_alexandre"><b>Pierre</b> Alexandre</a>, <a href="../../../author/nerella_naidu_venkatesh"><b>Nerella</b> Venkatesh</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2021/07">(2021-07)</a><br><a href="../../../perr_pier_nere_wolf.2021.FAMtNS/">From Analytical Methods to Numerical Simulations:<br/>A Process Engineering Toolbox for 3D Concrete Printing</a></li>
      <li><a href="../../../author/roussel_nicolas"><b>Roussel</b> Nicolas</a>, <a href="../../../author/spangenberg_jon"><b>Spangenberg</b> Jon</a>, <a href="../../../author/wallevik_elvar_jon"><b>Wallevik</b> Jon</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> <a href="../../../date/2020/06">(2020-06)</a><br><a href="../../../rous_span_wall_wolf.2020.NSoCP/">Numerical Simulations of Concrete Processing:<br/>From Standard Formative Casting to Additive Manufacturing</a></li>
      <li><a href="../../../author/schutter_geert"><b>Schutter</b> Geert</a>, <a href="../../../author/feys_dimitri"><b>Feys</b> Dimitri</a> <a href="../../../date/2016/11">(2016-11)</a><br><a href="../../../schu_feys.2016.PoFC/">Pumping of Fresh Concrete:<br/>Insights and Challenges</a></li>
      <li><a href="../../../author/schutter_geert"><b>Schutter</b> Geert</a>, <a href="../../../author/lesage_karel"><b>Lesage</b> Karel</a> <a href="../../../date/2018/09">(2018-09)</a><br><a href="../../../schu_lesa.2018.ACoPoC/">Active Control of Properties of Concrete:<br/>A (P)Review</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/perrot_arnaud"><b>Perrot</b> Arnaud</a>, <a href="../../../author/jacquet_yohan"><b>Jacquet</b> Yohan</a> <a href="../../../date/2025/01">(2025-01)</a><br><a href="../../../perr_jacq.2025.3CPbEaFD/">3D Concrete Printing by Extrusion and Filament-Deposition</a></li>
    </ol>
</div>
