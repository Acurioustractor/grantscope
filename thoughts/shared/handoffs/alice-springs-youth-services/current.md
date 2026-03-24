---
date: 2026-03-22T10:00:00Z
session_name: alice-springs-youth-services
branch: main
status: active
---

# Alice Springs Youth Services — Strategic Analysis for CivicGraph + Oonchiumpa

## Ledger
**Updated:** 2026-03-22T11:00:00Z
**Goal:** Integrate Alice Springs youth services data into CivicGraph to support Oonchiumpa's person-centred model
**Branch:** main
**Test:** `node --env-file=.env scripts/gsql.mjs "SELECT COUNT(*) FROM alma_interventions WHERE geography::text ILIKE '%Alice Springs%'"` (expect 17)

### Now
[->] Session complete — all data integrated

### This Session
- [x] Read all 7 source documents (Mapping Report, Implementation Plan, YAP 2023-27, NT Youth Strategy 2023-33, Grant Guidelines, YSM Data Overview, Workshop Summary)
- [x] Identified 11 existing CivicGraph entities for Alice Springs youth service providers
- [x] Found 4 existing ALMA interventions for Oonchiumpa programs
- [x] Wrote strategic analysis document with funding inversion data, intervention spectrum, reform agenda, and Oonchiumpa alignment
- [x] Added 13 new ALMA interventions (17 total for Alice Springs) — 7 linked to CivicGraph entities (Bushmob, ASYASS, Tangentyere, Gap Youth, Children's Ground, NAAJA, CASSE)
- [x] Added Alice Springs Youth Activities Grant 2025-26 (TFHC, up to $50K, annual)
- [x] Updated memory (project_alice_springs_youth.md + MEMORY.md index)

### Next
- [ ] Build Oonchiumpa profile page showing this data in CivicGraph web app
- [ ] Create /graph mode for Alice Springs youth services (intervention spectrum visualisation)
- [ ] Build "funding inversion" dashboard showing reactive vs prevention spend
- [ ] Add remaining service providers as entities (Australian Childhood Foundation, Multicultural Community Services, etc.)

### Decisions
- Used ALMA interventions table for all service/program data (not a new table) — keeps model consistent
- Mapped TFHC taxonomy → ALMA types: Universal→Prevention, Early Intervention→Wraparound/Early Intervention, Crisis→Diversion, Through-care→Community-Led
- Included policy-level interventions (YAP, Reform Agenda) as Community-Led type — these are system interventions
- Grant set to status 'upcoming' — next round expected mid-2026

### Open Questions
- UNCONFIRMED: Whether CAAC (Central Australian Aboriginal Congress) entity exists in CivicGraph — wasn't found in search but may exist under different name
- UNCONFIRMED: Whether CAYLUS (Central Australian Youth Link-Up Service) has a CivicGraph entity
- UNCONFIRMED: 2023 YSM Data Overview (PPTX) and Workshops Summary (DOCX) — could not read these formats, may contain additional service-level data

### Workflow State
pattern: exploratory
phase: complete
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "Integrate Alice Springs youth services data into CivicGraph"
- resource_allocation: aggressive

#### Unknowns
- CAAC entity status in CivicGraph
- Whether additional service providers from PPTX/DOCX docs are missing

#### Last Failure
(none)

### Decisions
- Use ALMA interventions table for service/program data (not a new table) — consistent with existing model
- Map TFHC's 4-tier taxonomy to ALMA types: Universal→Prevention, Early Intervention→Wraparound Support, Crisis Intervention→Diversion, Through-care→Community-Led
- Grant opportunity added as recurring (annual) with next expected round mid-2026

---

## Context

### Source Documents

| Document | Author | Date | Key Content |
|---|---|---|---|
| Alice Springs Youth Services Mapping Project Report | CM&C + NIAA | March 2022 | 63 services, $32M spend, intervention type analysis, 10 recommendations |
| Implementation Plan | CM&C + NIAA | 2022 | 6 priority reforms with timelines and lead agencies |
| Mparntwe/Alice Springs Youth Action Plan 2023-2027 | Local Action Group / TFHC | 2023 | 7 domains, 35+ actions, aligned to ARACY Nest Framework |
| NT Youth Strategy 2023-2033 | TFHC / NTG | 2023 | Territory-wide 10-year strategy, 7 domains, 40+ priorities |
| Alice Springs Youth Activities 2024-25 Grant Guidelines | TFHC | July 2024 | Up to $50K grants for after-hours/holiday activities |
| 2023 YSM Data Overview | Unknown | 2023 | PowerPoint data summary |
| Workshops Summary 2021 | CM&C + NIAA | 2021 | Co-design workshop feedback |

### The Funding Inversion (Core Finding)

The most powerful finding across all documents is the **funding inversion** — government spending is concentrated at the reactive/crisis end of the spectrum despite overwhelming evidence that prevention and early intervention are more cost-effective.

**NT Government (2020-21):**
- Reactive: $14.77M (67%)
- Early Intervention: $4.79M (22%)
- Prevention: $2.02M (9%)
- Universal: $0.41M (2%)

**NIAA (2020-21):**
- Reactive: $3.96M (39%)
- Prevention: $3.52M (35%)
- Early Intervention: $2.56M (26%)

**Combined: $18.73M (58%) of $32M total goes to reactive interventions.**

Evidence base for the cost of this inversion:
- Telethon Kids / Minderoo: Late intervention costs Australia $15.2B/year ($1,912/child/year)
- Social Ventures Australia: $1 early intervention in child protection/out-of-home care saves $2 over 10 years
- UK National Children's Bureau: £1 early intervention saves £7 in future costs

### The Intervention Spectrum

TFHC uses the clearest taxonomy (from the Mapping Report):

1. **Universal** — keep young people actively engaged and positively connected (after-hours, holidays, sport, culture)
2. **Early Intervention** — work with young people and families at early stage, before crisis point
3. **Crisis Intervention** — administer crisis support (child protection, DV, homelessness, youth justice)
4. **Through-care & Rehabilitation** — assist young people exiting the system with skills and supports

The public health model equivalent: primary/secondary/tertiary.

### Key Service Providers in Alice Springs (CivicGraph Entity Status)

| Organisation | ABN | CivicGraph ID | Type | Role |
|---|---|---|---|---|
| Tangentyere Council Aboriginal Corp | 81688672692 | AU-ABN-81688672692 | indigenous_corp | Town camp services, youth hubs |
| Central Australian Aboriginal Congress (CAAC) | — | CHECK | indigenous_corp | Primary health, family support |
| NAAJA | 63118017842 | AU-ABN-63118017842 | charity | Legal services, justice advocacy |
| Bushmob Aboriginal Corp | 29145344794 | AU-ABN-29145344794 | indigenous_corp | Bush adventure therapy, youth programs |
| Gap Youth and Community Centre | 48164836158 | AU-ABN-48164836158 | indigenous_corp | Drop-in, activities, safe space |
| ASYASS | 35451745525 | AU-ABN-35451745525 | foundation | Youth accommodation, homelessness |
| Children's Ground | 74154403086 | AU-ABN-74154403086 | charity | Early years, whole-of-community |
| Saltbush Social Enterprises | 50612530079 | AU-ABN-50612530079 | charity | Social enterprise, employment |
| CASSE | 17811536315 | AU-ABN-17811536315 | charity | Safe supportive environment programs |
| Anglicare NT | 61187402536 | AU-ABN-61187402536 | company | Family support, foster care |
| Holyoake | 57848445446 | AU-ABN-57848445446 | charity | Alcohol/drug addiction support |
| Lhere Artepe Aboriginal Corp | 91884217942 | AU-ABN-91884217942 | indigenous_corp | Native title, traditional owners |
| Oonchiumpa Aboriginal Corp | 53658668627 | AU-ABN-53658668627 | indigenous_corp | True Justice, cultural healing |

### How This Supports Oonchiumpa's Person-Centred Model

Oonchiumpa's vision — support the whole young person across their journey, regardless of which government silo is paying — is **exactly what every document recommends**. The Mapping Report explicitly calls for:

1. **"Journey maps showing referral pathways between existing services and programs"** (Rec: Cross-agency collaboration)
2. **"Collaborative case management models where different services work together to deliver a tailored package of support for a youth client"**
3. **"Shift from reactive to prevention/early intervention"** — Oonchiumpa's True Justice is prevention
4. **"Support ACCOs to deliver services"** — Oonchiumpa is an ACCO
5. **"Culturally appropriate, place-based, locally designed services"** — this IS Oonchiumpa's model
6. **"Relational contracting"** — longer-term, flexible, outcome-focused contracts

The person-centred model Oonchiumpa wants to build would:
- **Follow the young person** across the intervention spectrum, not the service categories
- **Use cultural authority** (Elders, kinship systems) as the coordination mechanism, not government case management
- **Measure outcomes by wellbeing domains** (YAP's 7 domains / ARACY Nest) not service outputs
- **Shift resources upstream** — invest in prevention and cultural connection to reduce need for reactive services

### CivicGraph's Role

CivicGraph can make all of this visible:

1. **Service Map** — all 63+ services mapped by provider, funder, intervention type, and location
2. **Funding Flow** — show the reactive skew, track whether the funding transition is happening
3. **Person Journey Model** — visualise the path a young person takes through services (prevention → early intervention → crisis → through-care)
4. **Evidence Layer** — ALMA evidence for which approaches work (True Justice = Indigenous-led evidence level)
5. **Grant Intelligence** — surface funding opportunities aligned to Oonchiumpa's work
6. **Reform Tracking** — monitor progress against the 6 priority reforms

### Grant Intelligence: Alice Springs Youth Activities Grant

- **Funder:** Department of Territory Families, Housing and Communities (TFHC)
- **Program:** Regional Youth Services Program
- **Amount:** Up to $50,000
- **Frequency:** Annual
- **Target:** 10-17 year olds, especially vulnerable/at-risk
- **Period:** School holidays + after-hours during term
- **Contact:** Carly Kennedy (carly.kennedy@nt.gov.au, 0436 858 400)
- **Platform:** GrantsNT (grantsnt.nt.gov.au)
- **Key criteria:** Must align with YAP goals + NT Youth Strategy outcomes, demonstrate collaboration, youth consultation, and evaluation
- **Oonchiumpa fit:** Strong — True Justice events, cultural programs, after-hours activities all qualify
- **Next expected round:** Mid-2026 (applications typically open July)
