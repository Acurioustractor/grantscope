# WA ACCO, justice and Goods data acquisition and engagement plan

**Research date:** 27 September 2026  
**Status:** Primary-source review. No outreach undertaken.  
**Scope:** WA procurement and expenditure acquisition, public Power BI and portal constraints, ACCO and justice-reinvestment governance, the Kununurra/East Kimberley service landscape, and Jeremy Donovan's verified public work.  
**Evidence labels:** **Verified** means stated by the source owner; **Inferred** means a reasonable synthesis not stated by the source; **Unknown** means no current first-party confirmation was located.

## Executive finding

WA has enough public primary-source material to build a useful pre-engagement evidence base, but not enough to claim a complete contract-transition map. The acquisition path should begin with direct official files and stable public pages, then add a carefully documented Tenders WA collector. Public Power BI reports are useful discovery and validation surfaces, not a dependable bulk-data interface.

Kununurra is a legitimate place to explore a governed pilot because a real community-controlled delivery network is already visible: Kununurra Waringarri Aboriginal Corporation (KWAC), MG Corporation and Wunan Foundation jointly developed the Coolamon Centre; the Kimberley Juvenile Justice Strategy (KJJS) funds place-based ACCO-led work; and KWAC has developed the Youth Circuit Breaker framework and associated cost-benefit work. This does not grant GrantScope, JusticeHub or Goods authority to define the problem, assess organisations, or initiate local activity.

Jeremy Donovan's verified institutional connection is through KWAC project work. KWAC says he participated in the Youth Circuit Breaker cost-benefit work, and his own site identifies cultural leadership, facilitation and consultancy work plus the Northern Australian Aboriginal Men's Alliance. An appropriate first route is therefore through KWAC's published organisational channel and the relevant project leadership, not an assumed personal relationship or scraped private contact.

## 1. Acquisition options

| Source | Latest verified date / pattern | Acquisition route | Access, licence and constraints | Recommended treatment |
|---|---|---|---|---|
| [Aboriginal Expenditure Review 2023-24](https://www.wa.gov.au/government/publications/western-australian-aboriginal-expenditure-review-2023-24) | Published 12 Dec 2025; page updated 14 Jan 2026. Covers 2021-22 to 2023-24, focused on 2022-23. The page says data collection for the third AER would commence soon. | **Direct XLSX bulk download**, plus report and community-guide PDFs. | Public, no account stated. The page does not state a file-specific licence. WA open-data policy preference is not proof that this attachment is CC BY. Preserve source URL, retrieval date and file hash; seek confirmation before redistribution beyond derived factual data. | Highest-priority ingest. Treat each row as a reported program-year record, not a contract or payment. Preserve Aboriginal-organisation involvement as the source reports it, without converting it into an ACCO award. |
| [Tenders WA](https://www.tenders.wa.gov.au/) | Live portal. Recently awarded contracts and tender results change continually. State-agency BI reports sourced from Tenders WA are refreshed daily. | **Portal search and result/detail pages.** Email notifications are available to registered users for new requests. No official public bulk API, feed or complete export was located. | Public searching is available. Business/person registration is needed for dashboard and additional tender-document functions. Automated-access terms, pagination limits and historical completeness are not published in the reviewed pages. | Build a conservative collector only after a manual field/pagination study and terms check. Snapshot result IDs and detail pages; separate tenders, awards, standing offers and variations. Log omissions and failed pages. Do not bypass authentication or anti-automation controls. |
| [Government Procurement BI reports](https://www.wa.gov.au/organisation/department-of-treasury-and-finance/government-procurement-business-intelligence-reports) | Owner page updated 18 Aug 2026. Public Who Buys What and How and SFPP reports are updated annually by financial year. Restricted Tenders WA reports are refreshed daily; CUA reports monthly or quarterly. | **Public Power BI viewer** for annual reports. Detailed reports require agency access. | Public viewing needs no GrantScope account. Microsoft states that Publish to Web does not support exporting visual data. Power BI REST export requires authenticated workspace/report permissions and, for some exports, capacity and dataset scopes. Public embed internals are not an authorised data API. | Use public reports to discover categories, totals and planned procurements and to validate collected records. Ask the report owner for a machine-readable extract or authorised access if row-level reuse is needed. Do not make undocumented Power BI query calls a production dependency. |
| [Who Buys What and How](https://www.wa.gov.au/government/publications/who-buys-what-and-how) | Page updated 10 Sep 2026; annual, financial-year report. | Public Power BI report only on the reviewed owner page. | Combines Tenders WA, CUA sales and other expenditure reports. It is not a transaction-complete contract ledger. | Capture report vintage, definitions and visible aggregates. Use as reconciliation evidence, not the canonical award feed. |
| [Strategic Forward Procurement Plan](https://www.wa.gov.au/government/publications/strategic-forward-procurement-plan-public-report) and [guideline](https://www.wa.gov.au/government/multi-step-guides/procurement-guidelines/procurement-planning-guidelines/strategic-forward-procurement-planning-state-agencies-guideline) | Annual planning over the next two financial years. Plans may be updated during the year. | Public Power BI report; agency submission template is not published for general download and may be requested by agencies. | Covers planned procurements of at least $250,000, including community services, goods, services and works. Plans can change; a small number of agencies are exempt; not every item becomes an open tender. | Record plans as `planned`, with report vintage and expected timing. Never merge them with awards. Use to identify future verification targets and potential contract expiries. |
| [Data WA](https://data.wa.gov.au/) | Live catalogue; publisher-specific update schedules. | Catalogue and dataset resources may provide direct files, services or APIs depending on the record. | WA Open Data Policy v2 encourages discoverability and open licensing such as CC BY, but each dataset's record and licence control reuse. No Tenders WA awards dataset was located in the reviewed catalogue/search. | Query the catalogue routinely for new procurement, justice, housing and place datasets. Ingest only from each resource's declared endpoint and licence. Store dataset metadata and update frequency with every source. |
| [WA procurement rules, section D](https://www.wa.gov.au/government/multi-step-guides/western-australian-procurement-rules/section-d-request-development-and-contract-formation) | Current rules page at research date. | Public HTML/PDF policy source, not a data feed. | Award details for contracts and standing offers valued at $50,000 or more are generally to be published within 30 days, subject to rules and exceptions. Disclosure obligations do not guarantee complete or correct portal data. | Encode as a completeness expectation and quality test, not as evidence that every qualifying contract is present. |
| [Aboriginal Procurement Policy performance reports](https://www.wa.gov.au/government/document-collections/aboriginal-procurement-policy-performance-reports) | Annual reports. | Public PDFs. | Aggregate performance, dependent on qualifying definitions and correct Tenders WA entry. Grants, lower-value activity, subcontracting and some panel expenditure can be absent. | Extract annual reported counts and values with definitions. Do not use aggregates to identify specific ACCOs or infer retained revenue. |
| [KJJS owner page](https://www.wa.gov.au/organisation/department-of-justice/kimberley-juvenile-justice-strategy) | Page updated 6 Aug 2026; service map current as at 1 Jul 2025; newsletters published through Jun 2026. Funding totals cover Jul 2019 to Jun 2030. | Public HTML, PDFs, service map, newsletters and evaluations. No API located. | Public documents. Program lists can change between the dated service map and current HTML. | Ingest as dated initiatives, providers, locations, activity types, funding announcements and evaluation evidence. Keep current and historical program states separate. |
| CASWA ACCO directory | Live member-maintained directory; CASWA says it has 60 members on its current About page. | Public directory pages plus member portal for member services. No public bulk API/export located. | CASWA, not GrantScope, controls membership and ACCO eligibility. Member portal is restricted. | Use public entries as high-trust identity evidence with retrieval dates. Never equate GrantScope's community-controlled flag with CASWA membership or eligibility. Seek CASWA governance before attempting a statewide ACCO register product. |
| ORIC and ACNC | Public registers with their own bulk/search facilities and update cycles. | Official register/bulk sources where offered. | Registration is legal/charity identity evidence, not proof of local authority, current service capacity, CASWA membership or ACCO status. | Use for identifiers, legal status and provenance only. Resolve organisations using ABN/ICN and source dates; preserve conflicts for review. |

### Acquisition facts, inferences and unknowns

**Verified**

- The AER XLSX is the cleanest immediate bulk source and reports agency programs, location, Closing the Gap alignment and Aboriginal-organisation involvement.
- Tenders WA exposes public tender and contract search pages and offers registered-user notifications, but no official public bulk API or feed was located.
- Finance's public procurement reports are annual. Restricted State-agency Tenders WA BI reports are refreshed daily.
- Microsoft's official Power BI documentation says public Publish to Web reports do not support exporting data from visuals. Authenticated REST exports require permissions unavailable to an ordinary public viewer.
- WA procurement planning covers procurements valued at $250,000 or more across two financial years. Published plans are not commitments to proceed.

**Inferred**

- A reproducible Tenders WA collector is technically plausible from public result/detail pages, but it should be considered a portal adapter, not an API integration.
- The most robust contract-transition dataset will require a blend of portal snapshots, public annual reports, AER program rows, agency commissioning material and direct clarification from Finance/CASWA.

**Unknown**

- Whether Finance will provide a public or partner machine-readable Tenders WA extract for the ACCO transition work.
- The public portal's permitted automated-request rate, complete historical depth, stable pagination contract and variation history.
- Whether the AER's third edition will include a new XLSX, provider identifiers, more recent expenditure years or a recurring release date.
- Whether the public SFPP and Who Buys What Power BI owners will supply CSV/XLSX extracts on request.

## 2. Proposed ingestion sequence

### Stage A: source register and direct files

1. Register each owner page, resource URL, reporting period, publication/update date, licence status, expected cadence and acquisition class.
2. Download and hash the AER XLSX and companion PDFs. Preserve the workbook unchanged as raw evidence.
3. Profile workbook sheets, columns, coded values, merged cells and amount units before mapping to database fields.
4. Ingest KJJS current HTML, dated service map, newsletters and evaluations as separate document editions.
5. Add CASWA public directory, ORIC and ACNC evidence as identity assertions, never as one automatically authoritative organisation label.

### Stage B: Tenders WA feasibility

1. Manually document public search filters, page boundaries, result identifiers, detail fields, DCSP views, standing offers, dates and variation links.
2. Test a small date-bounded public acquisition against known records, retaining raw HTML and HTTP status.
3. Measure duplicates, missing fields, pagination overlap, detail-page failure and whether old records remain discoverable.
4. Compare samples against Who Buys What, APP annual reporting and named KJJS/AER programs.
5. Before recurring automation, request clarification from Tenders WA/Finance on bulk access, reuse and acceptable request patterns.

### Stage C: governed analytical layer

Keep these record types distinct:

- `program_expenditure_report`
- `planned_procurement`
- `tender_opportunity`
- `contract_award`
- `contract_variation`
- `reported_expenditure`
- `grant_or_initiative`
- `organisation_identity_assertion`
- `community_authority_assertion`
- `evaluation_or_outcome_evidence`

Every row should carry owner, source URL, retrieved date, source publication date, reporting period, geography basis, evidence status and supersession link. Amounts must retain whether they are budgets, estimated contract values, actual expenditure, totals spanning years, or program-wide announcements.

### Stage D: bounded Jev evaluation

Jev should be tested only after deterministic ingestion and on already-public text. A legitimate first task is ranking a document or program into a community-defined review queue, for example `youth justice`, `housing`, `community enterprise`, `procurement`, or `manual review`.

Jev must not determine ACCO status, organisational readiness, community authority, eligibility, permission to contact, cultural sensitivity, funding priority or whether Goods belongs in a local pathway. Code should enforce source provenance, deterministic exclusions, confidence/abstention thresholds and mandatory human approval. No private justice, participant, CRM, community-held or culturally governed material should be sent to Jev without explicit authority and vendor data-governance review.

## 2A. Technical implementation plan

### One ingestion interface, four adapters

Use one deep ingestion module with a small interface:

```text
discover(source, cursor) -> SourceItem[] + nextCursor + coverage
fetch(item)              -> RawArtifact + retrieval metadata
parse(artifact)          -> CandidateRecord[] + diagnostics
validate(candidate)      -> ValidatedRecord | QuarantineRecord
persist(validated)       -> WriteResult
```

The implementation can then carry four adapters without making downstream code understand each source:

1. `aer-xlsx`: direct workbook and companion-document acquisition;
2. `tenders-wa-portal`: public result/detail-page acquisition, only after terms and pagination checks;
3. `kjjs-documents`: dated HTML/PDF/service-map and evaluation acquisition;
4. `data-wa-catalogue`: recurring discovery of declared files, services and interfaces.

Every adapter must support dry-run output, resumable cursors, raw-artifact preservation, source hashing, explicit partial/failure states and deterministic record identifiers. A successful empty result is valid only when the source itself proves there were no records in scope.

### Canonical storage

Do not put AER rows back into `justice_funding`. That table currently demonstrates why mixed evidence types become unsafe to total.

Recommended storage:

| Record family | Canonical location | Reason |
|---|---|---|
| AER program-year rows | New `wa_aboriginal_expenditure_programs` table | Preserves source categories, reporting year, agency, program, amount basis, geography and Aboriginal-organisation involvement without pretending the row is a contract or grant |
| Tenders WA opportunities, awards and variations | `state_tenders`, with an explicit `record_type` migration or companion event table | Existing state-procurement consumers already read this table; planned, open, awarded and varied states must remain distinguishable |
| Raw files/pages and retrieval evidence | Existing source-document/raw-content pattern, keyed to source and content hash | Makes every normalized row traceable to the exact artifact that produced it |
| KJJS initiatives and evaluations | Existing ALMA government-program/source-document structures after a field-level fit check | Keeps intervention evidence separate from money-flow evidence |
| Organisation resolution | `gs_entities` plus identifier/source assertions | ABN and ICN links should be evidence-backed; no automatic ACCO/readiness conclusion |
| Jev suggestions | New append-only `wa_document_classifications` review table | Model output remains a suggestion with model, rubric hash, source text hash and review status |
| Human decisions | New `wa_classification_verdicts` table | Creates the labelled set needed to measure and tune the classifier |

Before adding either new table, verify whether an existing generic source-record table already provides the required fields. Prefer extending a suitable canonical model to creating parallel truth.

### AER ingest acceptance criteria

- Raw XLSX and PDFs retained unchanged with SHA-256, source URL, retrieved time and publication/update dates.
- Every sheet and source row is counted; merged cells and footnotes are captured or quarantined visibly.
- Reporting year, amount unit, agency, program, location, involvement category and Closing the Gap fields preserve source wording.
- No row is classified as a contract, grant, ACCO payment or unique expenditure unless the workbook states that fact.
- A reconciliation report reproduces workbook row counts and source totals by year and agency.
- Re-running the same workbook is idempotent; a changed workbook creates a new edition rather than silently rewriting history.

### Tenders WA feasibility gate

Do not schedule a production collector until a bounded feasibility run establishes:

- stable result and detail identifiers;
- all public pagination paths and non-overlapping page boundaries;
- opportunity, award, standing-offer and variation distinctions;
- field availability for buyer, supplier, ABN, value, method, start, expiry and source dates;
- historical depth and discoverability of expired contracts;
- response behaviour, terms, rate expectations and account boundaries;
- raw-page retention and repeatable parsing; and
- comparison against at least 30 known contracts from official reports or named programs.

If public acquisition cannot meet these tests, stop at monitoring and request an authorised extract from WA Finance. Undocumented Power BI calls are not the fallback.

### WA Jev classifier

Start with one bounded Choice question over public text:

```text
Which review queue best describes this public record?

- youth_justice
- housing_or_homelessness
- community_enterprise_or_employment
- health_or_wellbeing
- procurement_or_contracting
- multi_domain
- unrelated
- manual_review
```

Keep these deterministic in code:

- dates and reporting periods;
- amount parsing and aggregation;
- buyer/supplier identity and ABN/ICN matching;
- geography and place joins;
- source and licence rules;
- record-type distinctions;
- cultural, privacy and contact restrictions; and
- every action following classification.

Evaluation sequence:

1. Hand-label 100 public records across AER, KJJS, Tenders WA and unrelated WA material.
2. Freeze rubric wording and hash it.
3. Run Jev without database writes.
4. Measure per-class precision/recall, abstention, confidence calibration and high-consequence false positives.
5. Review every disagreement and record a human verdict and reason.
6. Permit queue suggestions only after a threshold is agreed from the labelled set.
7. Keep `manual_review` available regardless of confidence.

The classifier may reduce reading effort. It does not create legitimacy or knowledge that is absent from the source.

### Delivery tranches

| Tranche | Concrete output | Exit condition |
|---|---|---|
| 1. Direct evidence | AER raw artifact, profiled schema, staged rows and reconciliation report | Workbook totals and row counts reconcile; unsafe interpretations documented |
| 2. Kimberley public pack | KJJS documents, named initiatives, organisation identities and current public funding/contract evidence | Every claim links to a source edition; no inferred demand or authority |
| 3. Procurement feasibility | Small Tenders WA snapshot, parser diagnostics and completeness report | Portal terms and technical coverage are acceptable, or an authorised-extract request is prepared |
| 4. Classification pilot | 100-row labelled set, Jev results and measurement report | Human-reviewed performance is adequate for triage only |
| 5. Governance review | Private schema and evidence-pack walkthrough with CASWA/KWAC-designated participants | Partners confirm usefulness, corrections, access and what must not proceed |
| 6. Governed pilot | One place and one service family, private first | Named owner, correction pathway, publication decision and next action for every row |

### Stop conditions before outreach

Do not claim the pack is ready merely because it contains many records. The pre-engagement threshold is:

- AER rows are reconciled and source-faithful;
- Kununurra/Kimberley organisation identities are verified from first-party or statutory sources;
- ALMA false geography and AI-generated records are excluded from the pack unless clearly labelled for review;
- Goods generated demand is excluded;
- Tenders WA evidence is labelled as partial until acquisition coverage is measured;
- Jeremy's role is described only from KWAC or his own current public material;
- the pack includes a prominent unknowns and corrections page; and
- no automated contact, readiness score or investment ranking has been created.

## 3. Kununurra and Kimberley institutional map

| Organisation / initiative | Verified current relevance | Appropriate relationship to the proposed work |
|---|---|---|
| [Kununurra Waringarri Aboriginal Corporation](https://kwac.com.au/) | Kununurra ACCO delivering children, youth, men's, disability and cultural programs. KWAC owns the Youth Circuit Breaker framework and is a KJJS provider. | Primary organisational route for discussing KWAC-owned youth evidence, Youth Circuit Breaker and Jeremy Donovan's project contribution. Ask what evidence is useful and what must remain with KWAC. |
| [Coolamon Centre](https://kwac.com.au/coolamon-centre-kununurra-youth-night-space/) | Opened in 2026 after more than 12 months of co-design. Developed by KWAC, MG Corporation and Wunan Foundation with KJJS/Department of Justice and local young people, families, leaders and services. | Strong example of a real local service ecosystem. Any evidence pilot should recognise the consortium and co-design history rather than selecting one outside-facing spokesperson as sole authority. |
| [Youth Circuit Breaker](https://kwac.com.au/youth-circuit-breaker-ycb/) | KWAC describes it as an Aboriginal-led, community-designed continuum spanning after-hours response, intensive On-Country development, integrated response and through-care. | Potential justice-reinvestment-aligned evidence case, but KWAC defines the framework. GrantScope could offer public spending, service and cost evidence only under invitation. |
| [MG Corporation](https://mgcorp.com.au/our-initiatives/) | Miriwoong and Gajerrong organisation. Runs youth night patrol, Home Stretch and other initiatives; took ACCO leadership of Kununurra Target 120. Partner in Coolamon Centre and KNX hostel. | Essential local authority and service-delivery participant for Kununurra youth, housing and transition evidence. Not interchangeable with KWAC or Wunan. |
| [Wunan Foundation](https://www.wunan.org.au/) | East Kimberley Indigenous organisation working across education, employment, housing, health and enterprise. Partner in Coolamon Centre and the 42-bed KNX Community Hostel; operates Kununurra Withdrawal Intervention Centre and commercial enterprises. | Relevant to housing, youth transitions, enterprise and asset/logistics questions. Goods should only be raised if Wunan or consortium partners identify a practical unmet need. |
| [Kimberley Juvenile Justice Strategy](https://www.wa.gov.au/organisation/department-of-justice/kimberley-juvenile-justice-strategy) | $81 million across six State Budgets from Jul 2019 to Jun 2030; most initiatives delivered by ACCOs. Lists KWAC, ALSWA, Jungarni Jutiya, Wyndham Youth Aboriginal Corporation and other providers. | Official program/funder route for contract, grant, service-map and evaluation evidence. KJJS can clarify public data and commissioning; it cannot substitute for local community authority. |
| Aboriginal Legal Service of WA | KJJS Youth Engagement Program operates in Kununurra and Halls Creek, supporting compliance with bail and court orders. | Relevant justice-service provider and potential source of system-level evidence boundaries. Do not seek client-level data. |
| Kununurra Community Legal Services | Independent Kimberley legal and social-work service with Kununurra and Broome offices; says 85% of clients are Aboriginal. | Relevant to civil/legal need, housing and systemic advocacy. It is community-based but should not automatically be labelled an ACCO without separate verification. |
| [KNX Community Hostel](https://www.wunan.org.au/our-strategic-pillars/housing/knx-community-hostel.aspx) | Wunan and MG Corporation partnership providing a 42-bed culturally respectful facility for Aboriginal youth pursuing education, training or employment, with stays up to two years. | Concrete housing and transition context for Goods. Evidence must distinguish existing infrastructure from unmet demand and from any invitation to supply assets. |
| Kimberley Aboriginal Law and Cultural Centre / Yiriman | KJJS lists Yiriman Men's Project in Fitzroy Crossing as culturally secure On-Country work. | Relevant regional peer learning, not evidence that a Kununurra model can be copied or that one organisation speaks for the whole Kimberley. |
| JRNA | National First Nations community-controlled representative body for justice-reinvestment communities. Its governance says it does not speak for communities that are not its own. | Governance and practice route if local organisations choose to frame work as justice reinvestment. JRNA should not be used to bypass KWAC, MG Corporation, Wunan or local cultural authority. |
| CASWA | WA peak body representing ACCOs and owner of its membership/directory process. | Statewide governance route for the ACCO transition data model, definitions and safeguards. A Kununurra pilot should be visible to CASWA without treating CASWA as the local project owner. |
| YMAC / MAOA | Authoritative for YMAC's Pilbara, Mid West, Murchison and Gascoyne representative areas and the Yamatji On-Country pathway. | Important parallel WA engagement route, but not the institutional route for Kununurra/East Kimberley. Keep the Yamatji and Kimberley pathways distinct. |

## 4. Jeremy Donovan verification

### Verified

- [Jeremy Donovan's own site](https://jeremydonovan.com/) identifies him as a Kuku-Yalanji and Gumbaynggirr man, keynote speaker, artist, musician, cultural consultant and facilitator. It says he began building the Northern Australian Aboriginal Men's Alliance in 2025 and founded several Indigenous businesses.
- [KWAC's projects page](https://kwac.com.au/projects/) names Jeremy Donovan in connection with the Youth Circuit Breaker cost-benefit analysis. The indexed KWAC text places him with KWAC Chair Healema Ward and other project participants.
- Jeremy's own public LinkedIn post says he facilitated the 2025 Stronger In Our Way men's forum for KWAC in Kununurra. This is person-authored evidence, but the institutional project should still be verified through KWAC when discussing collaboration.
- KWAC's current program navigation includes the Northern Australian Aboriginal Men's Alliance, Strong Men's Program, Youth Circuit Breaker, Learning on Dawang and Coolamon Centre.
- The public Empathy Ledger story records Jeremy discussing a Kununurra camp, his connection through his wife's East Kimberley Country, and his partnership with KWAC. This is relevant existing material owned within Ben's wider work, but it is not a substitute for fresh purpose-specific consent or organisational authority.

### Inferred

- Jeremy may be a valuable cultural facilitator and translator between the Youth Circuit Breaker work, men's leadership, community enterprise and a public-evidence proposition.
- His visible involvement makes a KWAC-mediated conversation more legitimate than a cold technology pitch, provided KWAC and Jeremy decide the work is useful.

### Unknown

- Jeremy's current formal title, employment or contractual authority within KWAC.
- Whether he is authorised to speak for Coolamon Centre partners, KJJS, Miriwoong/Gajerrong Traditional Owners, or any Kimberley organisation beyond a role explicitly given to him.
- Whether Jeremy, KWAC or the consortium wants GrantScope, JusticeHub or Goods involved.
- Whether existing recorded material may be reused for this new purpose. That requires checking its consent and governance record.

### Legitimate route to engage

1. Prepare a short evidence pack using only public sources, clearly naming omissions and avoiding organisation scoring.
2. Ask KWAC through its published organisational contact whether the Youth Circuit Breaker/Coolamon leadership would welcome a private evidence conversation.
3. Mention Jeremy only through his verified contribution: facilitation and participation in KWAC's Youth Circuit Breaker cost-benefit work. Do not imply he referred, endorsed or invited the approach.
4. If KWAC directs the conversation to Jeremy, ask him and KWAC who else must be present, especially MG Corporation, Wunan, local cultural authorities, young people/family representatives, KJJS or JRNA.
5. Keep a Goods discussion separate and optional. Ask whether housing, beds, workshop production, circular materials, logistics or paid local work match an identified priority. Do not arrive with a predetermined product solution.

Suggested opening:

> We have been assembling a public-source map of WA expenditure, procurement, youth justice, housing and community-controlled delivery. Kununurra stands out because KWAC, MG Corporation and Wunan have already built connected responses through Youth Circuit Breaker, the Coolamon Centre and related work. We can see useful evidence, but also major gaps and limits. Before developing anything further, would a private conversation be useful about the evidence your work needs, what should not be mapped, and whether GrantScope, JusticeHub or Goods could contribute under local direction?

## 5. Pre-engagement evidence pack

Build as much **public, attributable and corrigible** data as possible, not as much data as technically obtainable.

The first pack should contain:

- a dated map of KJJS-funded East Kimberley initiatives and published evaluations;
- AER program rows relevant to Justice, Communities, housing, youth, health and Kimberley delivery, with the AER's own involvement categories intact;
- publicly disclosed WA contract awards and forward procurements for the named agencies and service areas, with known coverage limits;
- verified organisation identities and distinct roles for KWAC, MG Corporation, Wunan, ALSWA and other providers;
- public funding announcements separated from actual expenditure and contracts;
- existing youth, housing, enterprise and Goods-adjacent infrastructure, explicitly avoiding invented demand;
- a correction channel so organisations can contest inclusion, labels and interpretations;
- a one-page list of unknowns that only local partners or government can answer.

Do not include readiness scores, league tables, participant data, inferred cultural authority, model-generated organisation assessments, personal contact enrichment, or claims that expenditure reached an ACCO unless the source identifies that relationship.

## 6. Recommended engagement order

1. **CASWA:** test statewide ACCO definitions, transition-pipeline relevance, directory boundaries and whether the proposed public-source schema is useful.
2. **KWAC:** seek permission for a private Kununurra evidence conversation around KWAC-owned work.
3. **MG Corporation and Wunan:** include them when the conversation concerns the Coolamon Centre, housing, youth transitions or consortium evidence.
4. **Jeremy Donovan:** engage through the KWAC/project route unless he independently initiates or explicitly invites direct discussion.
5. **KJJS / Department of Justice:** clarify public service, funding and evaluation data and potential machine-readable sources.
6. **JRNA:** involve when the local partners want a justice-reinvestment frame, governance support or national peer connection.
7. **Goods on Country:** introduce only as an optional practical capability under a locally identified need and separate authority, economics and consent.

## 7. Primary sources

### WA data and procurement

- [Western Australian Aboriginal Expenditure Review 2023-24](https://www.wa.gov.au/government/publications/western-australian-aboriginal-expenditure-review-2023-24)
- [Tenders WA](https://www.tenders.wa.gov.au/)
- [Government Procurement Business Intelligence Reports](https://www.wa.gov.au/organisation/department-of-treasury-and-finance/government-procurement-business-intelligence-reports)
- [Who Buys What and How](https://www.wa.gov.au/government/publications/who-buys-what-and-how)
- [Strategic Forward Procurement Planning guideline](https://www.wa.gov.au/government/multi-step-guides/procurement-guidelines/procurement-planning-guidelines/strategic-forward-procurement-planning-state-agencies-guideline)
- [WA Procurement Rules, section D](https://www.wa.gov.au/government/multi-step-guides/western-australian-procurement-rules/section-d-request-development-and-contract-formation)
- [Data WA](https://data.wa.gov.au/)
- [WA Open Data Policy v2](https://data.wa.gov.au/sites/default/files/Open%20Data%20Policy%20v2%202022.pdf)
- [Microsoft: Publish to web from Power BI](https://learn.microsoft.com/en-au/power-bi/collaborate-share/service-publish-to-web)
- [Microsoft: Power BI Export Report REST API](https://learn.microsoft.com/en-us/rest/api/power-bi/reports/export-report)

### Governance and sector

- [CASWA](https://www.caswa.org.au/)
- [CASWA membership and eligibility](https://www.caswa.org.au/membership)
- [YMAC: Yamatji On-Country and MAOA](https://www.ymac.org.au/events/yamatji-on-country/)
- [JRNA: About us](https://justicereinvestment.net.au/what-is-justice-reinvestment/about-us/)
- [JRNA governance structure](https://justicereinvestment.net.au/wp-content/uploads/2025/08/jrna-governance-structure-2.pdf)
- [JRNA contact](https://justicereinvestment.net.au/contact/)

### Kimberley and Kununurra

- [Kimberley Juvenile Justice Strategy](https://www.wa.gov.au/organisation/department-of-justice/kimberley-juvenile-justice-strategy)
- [KWAC](https://kwac.com.au/)
- [KWAC Youth Circuit Breaker](https://kwac.com.au/youth-circuit-breaker-ycb/)
- [KWAC Coolamon Centre](https://kwac.com.au/coolamon-centre-kununurra-youth-night-space/)
- [KWAC projects](https://kwac.com.au/projects/)
- [MG Corporation initiatives](https://mgcorp.com.au/our-initiatives/)
- [Wunan Foundation](https://www.wunan.org.au/)
- [Wunan and MG Corporation KNX Community Hostel](https://www.wunan.org.au/our-strategic-pillars/housing/knx-community-hostel.aspx)
- [Kununurra Community Legal Services](https://www.kcls.org.au/)
- [Jeremy Donovan's official site](https://jeremydonovan.com/)

## Evidence limits

- This review did not create accounts, submit portal forms, scrape Tenders WA, query undocumented Power BI endpoints, download and profile the AER workbook, or contact any organisation.
- Search indexes can expose stale snippets. Dates and roles were retained only where an owner page or person-authored source supported them.
- Public contact channels listed by organisations are not reproduced as a private contact database.
- The organisational map shows publicly visible roles and partnerships. It does not establish who holds cultural authority for a particular Country, family, story, dataset or project decision.
