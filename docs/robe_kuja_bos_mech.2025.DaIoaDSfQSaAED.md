---
hide:
    - navigation
    - tags
title: Annika Robens-Radermacher, Cezary Kujath, Freek Bos, Viktor Mechtcherine, Jörg Unger
description:
tags:
 - analysis
 - concrete
 - data
 - database
 - design
 - experiment
 - implementation
 - mechanics
 - print
 - property
 - system

---

#[:aca-openaccess:{ .xgreen }](https://link.springer.com/content/pdf/10.1617/s11527-025-02650-9.pdf) Design and Implementation of a Database System for Querying, Sharing, and Analyzing Experimental Data:<br/>:aca-blank: Mechanical Properties of 3D Printed Concrete ([2025-06](date/2025/06))
<a href="https://doi.org/10.1617/s11527-025-02650-9" title="DOI" target="_blank">:aca-doi:{ .lg .middle } 10.1617/s11527-025-02650-9</a>

-------------------------

:aca-blank:{ .lg .middle}
      <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a> <a href="https://orcid.org/0000-0001-9653-6085" title="ORCID: 0000-0001-9653-6085" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/kujath_cezary"><b>Kujath</b> Cezary</a>
,     <a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a> <a href="https://orcid.org/0000-0002-6666-2395" title="ORCID: 0000-0002-6666-2395" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a> <a href="https://orcid.org/0000-0002-4685-7064" title="ORCID: 0000-0002-4685-7064" target="_blank">:aca-orcid:{ .lg .middle }</a>
,     <a href="../../../author/unger_f_jorg"><b>Unger</b> Jörg</a> <a href="https://orcid.org/0000-0003-0035-0951" title="ORCID: 0000-0003-0035-0951" target="_blank">:aca-orcid:{ .lg .middle }</a>
  
:aca-blank:{ .lg .middle}
    Journal Article - Materials and Structures, Vol. 58, Iss. 5, No. (None,)

:aca-blank:{ .lg .middle}
    [`#analysis`](keyword/analysis)
    [`#concrete`](keyword/concrete)
    [`#data`](keyword/data)
    [`#database`](keyword/database)
    [`#design`](keyword/design)
    [`#experiment`](keyword/experiment)
    [`#implementation`](keyword/implementation)
    [`#mechanics`](keyword/mechanics)
    [`#print`](keyword/print)
    [`#property`](keyword/property)
    [`#system`](keyword/system)


-------------------------

<a href="https://scholar.google.com/scholar_lookup?title=Design%20and%20Implementation%20of%20a%20Database%20System%20for%20Querying%2C%20Sharing%2C%20and%20Analyzing%20Experimental%20Data" title="Search on Google Scholar" target="_blank">:aca-googlescholar:{ .lg .middle }</a>
<a href="https://www.scopus.com/record/display.url?eid=2-s2.0-105009303929&origin=resultslist" title="Search on Scopus" target="_blank">:aca-scopus:{ .lg .middle }</a>
<a href="https://www.webofscience.com/wos/woscc/full-record/WOS:001514429400005" title="Search on Web of Science" target="_blank">:aca-wos:{ .lg .middle }</a>
<a href="https://plu.mx/plum/a/?doi=10.1617/s11527-025-02650-9" title="Search on plu.mx" target="_blank">:aca-plumx:{ .lg .middle }</a>
<a href="https://api.crossref.org/works/10.1617/s11527-025-02650-9" title="Search on CrossRef" target="_blank">:aca-crossref:{ .lg .middle }</a>
<a href="https://api.openalex.org/works/doi:10.1617/s11527-025-02650-9" title="Search on OpenAlex" target="_blank">:aca-openalex:{ .lg .middle }</a>
<a href="https://api.semanticscholar.org/graph/v1/paper/10.1617/s11527-025-02650-9" title="Search on Semantic Scholar" target="_blank">:aca-semanticscholar:{ .lg .middle }</a>
<a href="https://crossmark.crossref.org/dialog/?doi=10.1617/s11527-025-02650-9&domain=pdf" title="Search on Crossmark" target="_blank">:aca-crossmark:{ .lg .middle }</a>
<a href="https://opencitations.net/meta/api/v1/metadata/doi:10.1617/s11527-025-02650-9" title="Search on OpenCitations" target="_blank">:aca-opencitations:{ .lg .middle }</a>
<a href="https://www.researchgate.net/search.Search.html?query=10.1617/s11527-025-02650-9&type=publication&type=publication" title="Search on Reserachgate (Login Required)" target="_blank">:aca-researchgate:{ .lg .middle }</a>
<a href="https://inciteful.xyz/p/W4411609688" title="Search on Inciteful" target="_blank">:aca-connectedpapers:{ .lg .middle }</a>
<a href="https://www.altmetric.com/details/doi/10.1617/s11527-025-02650-9" title="Search on Altmetric" target="_blank">:aca-altmetric:{ .lg .middle }</a>
<a href="https://api.unpaywall.org/v2/10.1617/s11527-025-02650-9?email=peter@enis.de" title="Search on Unpaywall" target="_blank">:aca-unpaywall:{ .lg .middle }</a>


-------------------------

???+ quote "Abstract" 
    Interlaboratory studies are essential for implementing standardized test methods for new innovative materials or technologies such as 3D concrete printing, certifying reference materials, and validating methods. They provide the basis for recommendations and design standards. Typically, the collected data are used only for one study and are published in paper form, without open access to the raw data files. However, preserving the collected data and analysis procedures in a shareable and reusable way leads to advantages for further usage. New data with the same structure can be added or the data can be analyzed by a new analysis procedure generating new knowledge. Additionally, resources are saved by avoiding the repetition of the same measurements. In line with the recent digitalization trend in material science and engineering, a database for the interlaboratory study on mechanical properties of 3D printed concrete conducted in RILEM Technical Committee 304-ADC is established. The challenges and experiences from defining the data structure, uploading the data, and using the database for evaluations are discussed. The openBIS software is used to create and fill the database, while an export method to an SQLite format is developed and discussed to generate a shareable and reusable database. With the exported database, querying the data is possible independently of a particular data management system. Additionally, examples of data processing with reusable workflows automating the analysis procedure are demonstrated.

##### :aca-blank:{ .lg .middle } { data-search-exclude }
<div class="grid cards" markdown>
???+ quote "References"
    <ol>
      <li><a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a>, <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../bos_menn_robe_wolf.2025.AaMR/">Approach and Main Results:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
      <li><a href="../../../author/gebhard_lukas"><b>Gebhard</b> Lukas</a>, <a href="../../../author/esposito_laura"><b>Esposito</b> Laura</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a>, <a href="../../../author/mata-falcon_jaime"><b>Mata-Falcón</b> Jaime</a> <a href="../../../date/2022/07">(2022-07)</a><br><a href="../../../gebh_espo_menn_mata.2022.ILSotIo3CPSUotBBoVR/">Inter-Laboratory Study on the Influence of 3D Concrete Printing Set-Ups on the Bond Behavior of Various Reinforcements</a></li>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/muthukrishnan_shravan"><b>Muthukrishnan</b> Shravan</a>, <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../mech_muth_robe_wolf.2025.CSaMoE/">Compressive Strength and Modulus of Elasticity:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/versteege_jelle"><b>Versteege</b> Jelle</a>, <a href="../../../author/santhanam_manu"><b>Santhanam</b> Manu</a>, <a href="../../../author/bhattacherjee_shantanu"><b>Bhattacherjee</b> Shantanu</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../wolf_vers_sant_bhat.2025.FaTS/">Flexural and Tensile Strength:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
    </ol>
???+ quote "Citations"
    <ol reversed>
      <li><a href="../../../author/deetman_arjen"><b>Deetman</b> Arjen</a>, <a href="../../../author/bos_h_derk"><b>Bos</b> Derk</a>, <a href="../../../author/lucas_simaria-de-oliveira_sandra"><b>Lucas</b> Sandra</a>, <a href="../../../author/salet_a-m_theo"><b>Salet</b> Theo</a> et al. <a href="../../../date/2025/12">(2025-12)</a><br><a href="../../../deet_bos_luca_sale.2025.ADFf3CP/">A Database Framework for 3D Concrete Printing</a></li>
      <li><a href="../../../author/giulivo_marco"><b>Giulivo</b> Marco</a>, <a href="../../../author/capozzi_vittorio"><b>Capozzi</b> Vittorio</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a> <a href="../../../date/2025/10">(2025-10)</a><br><a href="../../../giul_capo_menn.2025.EaAAotiPBo3PCWStCL/">Experimental and Analytical Assessment of the in-Plane Behaviour of 3D Printed Concrete Walls Subjected to Cyclic Loads</a></li>
      <li><a href="../../../author/bos_paul_freek"><b>Bos</b> Freek</a>, <a href="../../../author/menna_costantino"><b>Menna</b> Costantino</a>, <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../bos_menn_robe_wolf.2025.AaMR/">Approach and Main Results:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
      <li><a href="../../../author/mechtcherine_viktor"><b>Mechtcherine</b> Viktor</a>, <a href="../../../author/muthukrishnan_shravan"><b>Muthukrishnan</b> Shravan</a>, <a href="../../../author/robens-radermacher_annika"><b>Robens-Radermacher</b> Annika</a>, <a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../mech_muth_robe_wolf.2025.CSaMoE/">Compressive Strength and Modulus of Elasticity:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
      <li><a href="../../../author/wolfs_johannes-maria_robert"><b>Wolfs</b> Robert</a>, <a href="../../../author/versteege_jelle"><b>Versteege</b> Jelle</a>, <a href="../../../author/santhanam_manu"><b>Santhanam</b> Manu</a>, <a href="../../../author/bhattacherjee_shantanu"><b>Bhattacherjee</b> Shantanu</a> et al. <a href="../../../date/2025/06">(2025-06)</a><br><a href="../../../wolf_vers_sant_bhat.2025.FaTS/">Flexural and Tensile Strength:<br/>Mechanical Properties of 3D Printed Concrete</a></li>
    </ol>
</div>
