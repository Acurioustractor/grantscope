# WA ACCO Transition evidence extract request

**Status:** Draft for relationship review before sending  
**Purpose:** Request a machine-readable, governed evidence extract capable of supporting phase one of the WA ACCO Transition Pipeline.  
**Proposed recipients:** Procurement Intelligence and Reporting, Department of Treasury and Finance (`pir@dtf.wa.gov.au`); relevant DCSP policy team; CASWA as the appropriate sector governance partner.

## Proposed opening

We are developing a public-source evidence prototype aligned with the WA ACCO Transition Pipeline's first-phase commitment to map current human-service contracts and identify possible transition opportunities. We have ingested the public Tenders WA award fields and the annual Data WA contract CSVs, and we can clearly see their limits. One example makes the gap concrete: the public forward-procurement display lists four Kimberley human-service procurements for 2026-27, and none of the four can be matched to a current contract in 17,055 public award records. Two are new services, so there is nothing to match. The other two are running now: MercyCare operates Boab House, and the Kimberley Empowered Youth Network was contracted to Kimberley Aboriginal Medical Service for 2022-23 to 2023-24 according to a Mental Health Commission progress report. Neither agreement appears in any public award record, and the Expenditure Review does not flag the Youth Network as delivered by an Aboriginal organisation, although KAMS is community-controlled. Before extending the work, we would like to ask whether a machine-readable extract or an authorised report view could be made available under governance agreed with CASWA.

The request is for evidence infrastructure, not an assessment of ACCO readiness. We would not publish organisation-level readiness, infer community authority or contact suppliers from the extract without an agreed process.

## Requested contract fields

- stable Tenders WA contract identifier and human-facing reference;
- parent, buying and lead-delivery agency;
- contract and service title, description and service taxonomy;
- DCSP Policy flag and service-agreement type;
- Aboriginal Procurement Policy and Aboriginal Participation Requirement flags;
- prime contractor legal name, trading name, ABN and supplier identifiers;
- panel, consortium and subcontractor structure where recorded;
- award, commencement, initial expiry and final expiry dates;
- extension options, variations and current contract status;
- original value, varied value and expenditure-to-date where releasable;
- delivery regions, locations and service catchments;
- procurement method and exemption basis where releasable;
- UNSPSC and internal community-services classifications;
- replacement or predecessor contract reference;
- responsible agency contact or team;
- source refresh date and known data-quality limitations.

## Requested forward-procurement fields

The public SFPP dashboard currently displays 2,574 planned procurements from 73 agencies and includes the following useful fields. We request the underlying CSV/XLSX extract or an authorised export covering:

- FP reference number;
- parent, buying and lead-delivery agency;
- title and procurement type;
- UNSPSC code and title;
- contract delivery point;
- estimated release financial year and quarter;
- estimated full term;
- estimated total value band;
- agency contact; and
- existing contract number where the procurement is a replacement.

We have verified a bounded Kimberley slice in the public display: five rows labelled Community Services across three agencies, refreshed on 21 September 2026. Four describe youth, mental-health, alcohol and other drug, or place-based community services planned for 2026-27. One airstrip resurfacing row appears under the same procurement type despite a civil-works UNSPSC. We searched all 17,055 public WA award records, agency project pages and provider websites for each of the four human-service rows. Broome Step Up Step Down is a new service: the Mental Health Commission ran a registration of interest for Aboriginal community-controlled providers that closed on 21 November 2025. The Kimberley Youth Alcohol and Other Drug Service is also new, with the procurement approach still being settled with the Aboriginal reference group. For those two, the empty award record is correct. Boab House is run by MercyCare, by its own account, and the Kimberley Empowered Youth Network was contracted to KAMS for 2022-23 to 2023-24. For those two the service exists and the agreement, including any extension past 2023-24, does not appear in the award feeds. We would also value correction of the Expenditure Review provider flags where an ACCO delivers a program. The existing contract number field would settle both. We would also value confirmation of the airstrip classification.

## Requested coverage

- all current and future-dated DCSP/community-services contracts, regardless of original award year;
- historical awards needed to trace predecessor and replacement contracts;
- planned community-services procurements in the SFPP;
- contract variations and extensions;
- grants or service agreements that deliver human services but are not represented as procurement contracts; and
- a data dictionary explaining policy flags and omissions.

## Governance and handling questions

1. Which fields may be public, partner-shared or restricted?
2. Which organisation should approve the ACCO cohort and service taxonomy?
3. How should suppliers correct identity, service and contract information?
4. Can CASWA or the AACWA-AHCWA-CASWA Alliance govern readiness definitions and access?
5. Is there an existing phase-one data specification or commissioned contract inventory we should align with instead of duplicating?

## Evidence already held

- 17,055 WA contract records across the live portal capture and three official annual CSVs;
- 52 source-published DCSP-applicable awards in the six-month portal archive;
- 83 awards with source-published Aboriginal Participation Requirements;
- 283 bounded human-service candidate/review records;
- 54 Kimberley candidate/review records;
- 473 Aboriginal Expenditure Review program rows;
- a review-first supplier-resolution and provenance model with no automated outreach;
- five source-preserved Kimberley forward procurements, including four human-service review signals and one source-classification anomaly; and
- a search of all public award records showing none of those four has a visible incumbent contract.

The preferred next step is a short data and governance conversation, followed by one bounded extract and a private validation pass with CASWA and participating organisations.
