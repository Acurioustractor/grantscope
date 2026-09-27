# WA ACCO transition: CivicGraph evidence map

**Date:** 2026-09-27  
**Status:** Working evidence map  
**Question:** What does CivicGraph already hold for Western Australia, what can support the ACCO Transition Pipeline and justice-reinvestment work, and what must be researched, ingested or governed before engagement?

**Companion evidence:** [WA ACCO Transition Pipeline primary-source inventory](./2026-09-27-wa-acco-transition-pipeline-primary-source-inventory.md) verifies the official program, expenditure, procurement, justice, Yamatji and governance sources behind this synthesis.

## Executive finding

CivicGraph already has enough Western Australian organisational, federal-contract, justice-funding, intervention and place data to produce a useful **discovery prototype**. It does not yet have the central evidence required for a defensible ACCO contract-transition map: ingested WA Government contract awards, contract ownership and expiry data, service-level commissioning detail, or ACCO-governed definitions of readiness and opportunity. The official Aboriginal Expenditure Review program-list XLSX is publicly available and is the best immediate ingest starting point.

The official WA Closing the Gap 2026-28 Implementation Plan confirms that the pipeline is narrower and more concrete than a general procurement map. Phase one will map **current human-service contracts**, assess **ACCO market readiness**, and produce a **transition blueprint**. More than $3.3 million of the $5.8 million allocation is reserved for the Strengthening Program from 2027. CASWA is funded to participate in the mapping, and the AACWA-AHCWA-CASWA Alliance will contribute to the second-phase design.

The legitimate offer is therefore not "we have mapped the pipeline". It is:

> We have a substantial public-data starting point and a transparent method for linking organisations, places, funding, contracts and evidence. We would like to test whether a WA contract-transition evidence map would be useful, under the definitions, governance and priorities set by CASWA, JRNA and participating ACCOs.

Jev is relevant only as a bounded triage pattern. It may help classify public documents against a partner-defined taxonomy. It must not decide organisational readiness, cultural authority, contact permission, contract suitability or funding priority.

## 1. What is already held

The figures below were queried from the live GrantScope database on 27 September 2026. They are inventory counts, not claims that every row is current, complete or safe to publish.

| Evidence layer | WA records currently held | What it can support now | Important limitation |
|---|---:|---|---|
| Entity graph | 30,115 entities | Organisation and place discovery; ABN joins; cross-system linking | Entity presence does not establish authority, capability or permission to contact |
| Community-controlled entities | 2,223 flagged | Initial ACCO/Indigenous organisation candidate universe | Flag combines different source pathways and needs a governed definition and verification pass |
| ORIC corporations | 1,187 | Statutory corporation identity, status and basic organisational context | Only 730 currently carry an ABN; ORIC registration is not itself an ACCO service-readiness assessment |
| ACNC charities | 6,059 registered in WA; 7,786 operating in WA | Charity status, beneficiaries, purposes and applicant-route evidence | Registered address and operating geography are different concepts |
| Social enterprises | 1,473 | Enterprise and procurement discovery | Verification strength varies by source |
| Federal contracts to WA community-controlled entities | 667 contracts, 142 entities, $128.79m | Revealed federal capability, buyer history and contract timing | This is not WA Government procurement and cannot answer the Transition Pipeline's first question |
| WA justice-funding table | 473 rows, $4.21bn gross | Source discovery and candidate program tracing | Gross total is not reportable: the table mixes program grants, aggregate expenditure, contracts and foundation narrative amounts |
| ALMA interventions with WA geography | 157 | Candidate intervention and delivery-organisation discovery | The slice mixes community-verified, verified, unverified and AI-generated records; geography also contains false cross-state matches |
| ALMA government programs | 55 | Government-program discovery | Requires source-level verification and relationship mapping |
| Goods communities | 344 | Place and logistics exploration | Most are generated background candidates, not demand, consent or a relationship |
| WA-focused grant opportunities | 1,360 matched by broad text/geography test | Source frontier and historical coverage | Only five had a current/future deadline under the broad query; geography and status require opportunity-level verification |
| WA state contracts in `state_tenders` | **0** | Nothing yet | This is the central missing dataset |

## 2. Organisational coverage and its limits

Of the 2,223 WA entities currently flagged as community controlled:

- 1,766 have an ABN;
- 2,216 have a postcode;
- 1,933 have an LGA;
- 1,879 have a sector;
- 968 have a description;
- 215 have a website;
- 875 appear in at least two source datasets; and
- none currently has `confidence = 'high'` in `gs_entities`.

The dominant source combinations are 814 entities from ACNC plus ORIC, 690 from the social-enterprise dataset, and 457 from ORIC alone. This is useful breadth, but it does not produce a partner-safe ACCO registry by itself. Before using the cohort publicly, the project needs:

1. a partner-approved definition of ACCO and related organisation types;
2. transparent source-level verification labels;
3. separation of statutory registration, Indigenous ownership/control, community control, service role and procurement readiness;
4. an organisation-controlled correction and withdrawal pathway; and
5. a rule that no inferred readiness score is published about an organisation.

## 3. Procurement evidence

### What exists

The federal-contract layer links 142 WA community-controlled entities to 667 AusTender records worth $128.79m. Fifty-nine contracts are active or future-dated, and 55 are currently scheduled to end within 24 months.

The largest federal buyer relationships by recorded value are:

| Buyer | Contracts | WA community-controlled suppliers | Recorded value |
|---|---:|---:|---:|
| Department of Defence | 33 | 19 | $47.83m |
| Services Australia | 335 | 45 | $18.39m |
| Department of the Prime Minister and Cabinet | 34 | 19 | $9.07m |
| Department of Social Services | 8 | 5 | $6.89m |
| Department of Health and Aged Care | 19 | 8 | $6.75m |
| Department of Employment and Workplace Relations | 4 | 4 | $5.19m |
| Department of Education | 2 | 2 | $5.03m |

This is useful evidence of revealed delivery capability. It is not evidence of the WA Government service contracts that the ACCO Transition Pipeline intends to map.

### What is missing

`state_tenders` currently contains records for Queensland, NSW and Victoria, but no WA records. Tenders WA is monitored in the source frontier, but monitoring a source is not contract ingestion. The platform therefore cannot yet answer:

- which WA agencies fund or contract which services;
- which contracts are held by ACCOs, other Aboriginal organisations or non-Indigenous providers;
- contract values, terms, expiry dates, extensions or procurement methods;
- subcontracting and consortium arrangements;
- which services are candidates for transition;
- whether regional delivery is concentrated in a small number of incumbents; or
- what proportion of relevant expenditure reaches ACCOs.

This is the highest-priority procurement ingest and reconciliation task. It should be designed around the official WA disclosure mechanisms identified in the companion primary-source research, then matched by ABN and stable contract identifier with explicit unmatched and ambiguous states. WA Procurement Rules generally require award details for contracts and standing offers worth $50,000 or more, but exemptions, subcontracts, grants, panel activity and late or missing entries mean Tenders WA cannot be treated as a complete expenditure ledger.

## 4. Justice and justice-reinvestment evidence

### What exists

The WA `justice_funding` slice contains 473 rows from eight source families:

| Source | Rows | Rows with ABN | Gross recorded value |
|---|---:|---:|---:|
| `austender-direct` | 198 | 197 | $52.34m |
| `foundation-notable-grants` | 160 | 15 | $951.93m |
| `niaa-senate-order-16` | 59 | 59 | $76.40m |
| `rogs-yj-expenditure` | 43 | 43 | $2.79bn |
| `prf-jr-portfolio-review-2025` | 5 | 4 | $7.08m |
| `wa-budget-2024` | 3 | 3 | $244.30m |
| `aihw-yj` | 3 | 3 | $86.60m |
| `dusseldorp-yir-2025` | 2 | 0 | $244,000 |

Only 35 WA community-controlled entities matched justice-funding rows by ABN in the simple entity-level check. That number describes current linkage, not the true funded cohort.

### Why the gross number is unsafe

The $4.21bn gross total combines fundamentally different units: aggregate state expenditure, named grants, federal contracts, portfolio records and narrative foundation commitments. Some foundation rows describe total or multi-year commitments rather than a WA justice payment to a named recipient. No aggregate should be published until each row is classified by evidence type, jurisdiction, time basis, recipient basis and whether it is additive.

### ALMA quality

The broad WA geography test returns 157 interventions:

- 50 `verified / Published`;
- 3 `community_verified / Published`;
- 66 unverified or pending-review rows;
- 29 AI-generated rows across published, approved and draft states; and
- 117 entity-linked rows overall.

Thirteen are typed as Justice Reinvestment, but only three are linked to a `gs_entities` record. The WA slice also contains obvious geography false positives, including Queensland and Victorian services carrying WA in their geography arrays. It is a research queue, not a publishable directory.

For work with JRNA, the next pass must begin from JRNA/community definitions of place, initiative, evidence, cultural authority and permitted use. CivicGraph can link public money and organisations; JusticeHub/ALMA can hold intervention evidence; neither should assign legitimacy to a community initiative without the relevant authority.

## 5. Goods on Country evidence

The Goods layer currently contains 344 WA place rows. It should not be presented as 344 opportunities or 344 communities expressing demand:

- 341 are `warm / none` background records with generated bed-demand values and no deployment;
- Kalgoorlie is the only WA row marked active, with 20 deployed assets;
- Kununurra is a background record with an exact signal;
- Five Mile is assigned to the Central Land Council despite being in the WA slice, which is an immediate geography/governance remediation item.

The correct role for Goods in this work is a separately governed demonstration of practical local economic participation, procurement, production and logistics where a community-controlled organisation invites it. Goods demand estimates, deployments, sales history and relationships must remain distinct from ACCO Transition Pipeline evidence.

## 6. The combined opportunity

The strongest combined model is not one large platform pitch. It is a governed evidence workflow with clear roles:

| Partner or system | Legitimate role |
|---|---|
| CASWA and participating ACCOs | Define the problem, organisation cohort, readiness concepts, access, publication rules and useful outputs |
| JRNA and justice-reinvestment communities | Define justice-reinvestment data, place, evidence, authority and consent constraints |
| CivicGraph | Link public expenditure, contracts, entities, buyers, programs and places with provenance and visible uncertainty |
| GrantScope | Identify and verify grants, procurement pathways and other capital routes against a partner-defined need |
| JusticeHub / ALMA | Hold intervention and evidence relationships, subject to community authority and permitted use |
| Goods on Country | Participate only as an invited delivery or enterprise pathway, with community proceeds and ownership kept separate |
| Jev or another classifier | Triage public material into a closed, partner-defined taxonomy, with abstention and human review |

## 7. Knowledge gaps, in priority order

### Gate 1: legitimacy and governance

- Has CASWA asked for external data or technical support?
- Who governs the Transition Pipeline data and resulting maps?
- Which organisations are included, and who decides?
- What may be public, shared within a cohort, or held only by an organisation?
- How can an organisation correct, withdraw or restrict its information?
- Is JRNA relevant as a national learning/governance partner, or would that connection be unhelpful to the WA-led work?

### Gate 2: WA contract and expenditure evidence

- Official WA contract disclosure source, fields, identifiers, pagination and historical coverage.
- Agency-level grants and service agreements not represented as procurement contracts.
- Aboriginal Expenditure Review method, categories and release schedule; its public program-list XLSX should be preserved and mapped first.
- Contract expiry, renewal, extension and incumbent supplier detail.
- Subcontracting and consortium structures.
- Reconciliation between published expenditure and disclosed contracts.

### Gate 3: organisation and service capability

- Partner-approved ACCO cohort and service taxonomy.
- Current service footprints and community-defined regions.
- Existing accreditations, workforce, infrastructure and delivery partnerships.
- Organisational aspirations, including services an ACCO does not want to take on.
- Readiness evidence supplied and controlled by each organisation.

### Gate 4: outcomes and justice evidence

- Which WA justice-reinvestment initiatives JRNA and communities recognise as current.
- Program-level funding and evaluation records.
- Administrative data access constraints and small-number rules.
- Community-defined outcomes beyond justice-system contact.
- Evidence-use permissions and collective consent.

### Gate 5: practical delivery pathways

- Which transition opportunities are grants, contracts, direct commissioning, consortiums or capability investments.
- Whether Goods has an invited role in any place or service pathway.
- Regional freight, manufacturing, maintenance and workforce evidence that is real rather than inferred.

## 8. A simple but powerful engagement

The first contact should be a permission-and-usefulness conversation, not a demonstration.

Suggested framing:

> We have been looking at the WA ACCO Transition Pipeline and the commitment to map existing government contracts and identify opportunities for ACCOs to expand services. CivicGraph already links public information about organisations, federal contracts, justice funding, programs and places, but we can also see the limits clearly: we do not yet hold WA Government contract data, and we would not define ACCO readiness or community priorities ourselves. We would value a short conversation about whether a transparent, community-governed evidence map could be useful to the work CASWA is leading. We can bring a small WA data inventory, its gaps and a proposed method, with no assumption that the platform or categories are right.

Bring three pages only:

1. **What is already visible:** organisation, federal-contract, justice, grant and place coverage, with limitations.
2. **What is missing:** WA contracts, service agreements, readiness evidence and governance decisions.
3. **One bounded pilot:** one region or service domain, partner-defined cohort, private workspace first, no automated outreach, and publication only by agreement.

The first useful output is not a readiness score. It is a jointly reviewed contract-and-evidence register with provenance, uncertainty, ownership and the next human action visible on every row.

## 9. Recommended next build sequence

1. Preserve and profile the official Aboriginal Expenditure Review program-list XLSX as the first WA source artifact.
2. Produce a WA source registry covering contracts, expenditure, grants, service directories, justice data and regional governance.
3. Test Tenders WA acquisition for pagination, award/variation distinctions, stable identifiers, historical coverage and completeness before designing a production ingest.
4. Remediate the WA ALMA geography and provenance slice before presenting it externally.
5. Remediate the WA Goods place rows, especially generated demand and land-council attribution.
6. Build a private pilot view only after a governance partner has shaped the fields and access rules.
7. Test any semantic classifier on public documents with a labelled set, abstention and human approval. Keep it outside private or community-governed data until the data boundary is explicitly approved.

## Evidence status

**Verified in this review:** database counts and coverage; absence of WA records in `state_tenders`; current source composition; federal-contract linkage; ALMA and Goods quality issues visible in current rows.

**Inferred:** the platform can support a useful discovery prototype after focused remediation; CASWA and JRNA are plausible governance conversations.

**Unknown:** whether CASWA or participating ACCOs want this support; access to row-level WA contract/expenditure data; the approved ACCO cohort; readiness definitions; JRNA's desired role; Goods relevance in any specific community.
