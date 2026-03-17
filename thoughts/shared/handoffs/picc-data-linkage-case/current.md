---
date: 2026-03-17T15:30:00Z
session_name: picc-data-linkage-case
branch: main
status: active
---

# Work Stream: picc-data-linkage-case

## Ledger
**Updated:** 2026-03-18T02:30:00Z
**Goal:** PICC comprehensive dashboard — unified programs view linking funding, ALMA, contracts, grants with filters and funding status.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] Unified Programs table built and working — continuing to enrich data linkage and add more views

### Done (Cumulative)
- [x] Case document: `output/picc-station-precinct-case.md` (10 sections, data-backed)
- [x] DSS submission draft: `output/picc-dss-submission-draft.md`
- [x] Tim Fairfax Foundation approach brief: `output/picc-tim-fairfax-brief.md`
- [x] 7 PICC programs added to ALMA database
- [x] Power map visualization in youth justice report page
- [x] DB linkage: donation ABN phases 1-2, 20 youth justice records linked
- [x] Comprehensive dashboard document: `output/picc-comprehensive-dashboard.md`
- [x] **PICC web dashboard: `/reports/picc`** — fully working
- [x] **Leadership from Palm Island Repository** — 9 board members in `org_leadership` table (was 5)
  - Added: Luella Bligh (Chair), Rhonda Phillips, Raymond W. Palmer Snr, Matthew Lindsay
  - Source: `/Users/benknight/Code/Palm Island Reposistory/docs/PICC - details code.md`
- [x] **JCU contracts linked** — 2 JCU contracts ($107K) now have PICC ABN, total contracts now $235K/6
- [x] **JCU added as partner** in org_contacts
- [x] **QLD DJAG added as funder** in org_contacts ($128K youth justice contracts)
- [x] **Sticky section nav** — 14 sections with jump links, stays pinned on scroll
- [x] **Governance section now data-driven** from `org_leadership` table
- [x] **Org names linked to entity pages** — CEO roles + partners link to `/entity/[gsId]`
- [x] **Matched Grant Opportunities** — new section from `grant_opportunities` DB (15 upcoming)
- [x] **Funding table with filters** — client component, system filter (9 categories), period filter (All/2021+/Pre-2021), system badges
- [x] **Bar chart fixed** — taller (h-64), hover labels, rounded tops, no max-w constraint
- [x] **Unified Programs table** (`programs-table.tsx`) — single view linking:
  - 12 programs (11 BAU + Station Precinct)
  - Status column: Secured (8), Applied (2), Self-funded (2)
  - Gov Funding column linked from justice_funding
  - ALMA column (7/12 linked)
  - Contracts column from AusTender
  - Pipeline column from grant applications
  - Expandable detail rows with all 4 data sources
  - System + Status filters
- [x] **3 new service functions**: getPiccLeadership, getPiccMatchedGrants, getPiccFundingFlow
- [x] **Type check passes clean**

### Key Files Modified This Session
- `apps/web/src/app/reports/picc/page.tsx` — main dashboard page
- `apps/web/src/app/reports/picc/funding-table.tsx` — NEW client component for funding filters
- `apps/web/src/app/reports/picc/programs-table.tsx` — NEW unified programs client component
- `apps/web/src/lib/services/report-service.ts` — 3 new query functions
- `scripts/update-picc-leadership.sql` — leadership migration (already run)

### Next
- [ ] Continue enriching unified programs: add employment data, outcomes, stories per program
- [ ] Add PICC programs to ALMA evidence table (alma_evidence) for richer evidence linking
- [ ] Make grant pipeline data-driven (query org_pipeline table instead of hardcoded)
- [ ] Add funding gap analysis — show which programs lack diversified funding
- [ ] Foundation matching — query foundations table for PICC-relevant funders
- [ ] NAIDOC grants application (deadline 22 March, $5K)
- [ ] Ian Potter Environment application (deadline 26 March, $100K+)
- [ ] Ecosystem Services NQ (deadline 30 March, $192K)
- [ ] Environmental Research (deadline 30 March, $350K)

### Decisions
- Unified Programs table replaces separate BAU Programs table — single source of truth
- Funding status categories: secured, applied, upcoming, prospect, gap, self-funded
- Client components for interactive filtering (funding-table.tsx, programs-table.tsx)
- Entity links use `/entity/[gsId]` pattern (e.g., `/entity/AU-ABN-42513562148` for SNAICC)
- ORG_LINKS lookup map in page.tsx for name→entity page mapping
- JCU contracts buyer_name doesn't have ABN — linked via name match and manual ABN update
- QLD DJAG contracts likely Youth Justice professional services (mapped in CONTRACT_BUYER_MAP)

### Open Questions
- UNCONFIRMED: REAL Innovation Fund outcome (EOI submitted 2 March 2026)
- UNCONFIRMED: Whether PICC has existing relationship with Tim Fairfax Family Foundation
- UNCONFIRMED: Station Precinct site activation status
- UNCONFIRMED: Whether all FUNDING_MAP matches in programs-table.tsx are correct

### Workflow State
pattern: research-and-build
phase: 3
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "PICC unified dashboard with data linkage across all CivicGraph sources"
- resource_allocation: balanced

#### Unknowns
- REAL_Innovation_Fund_outcome: UNKNOWN
- Station_Precinct_activation_timeline: UNKNOWN

#### Last Failure
(none)

---

## Context

### PICC Key Facts
- **ABN**: 14640793728 | **Entity ID**: 18fc2705-463c-4b27-8dbd-0ca79c640582
- **Org Profile ID**: a1b2c3d4-0000-4000-8000-01cc0f11e001 | **Slug**: picc
- **Revenue**: $29M | **Staff**: 208 (194 Aboriginal/TSI, 94%) | **Funding tracked**: $38.7M across 68 grants
- **Contracts**: $235K across 6 (4 DJAG + 2 JCU)
- **CEO**: Rachel Atkinson (Yorta Yorta) — SNAICC Board, QLD First Children Board Co-Chair, Family Matters QLD Co-Chair
- **Board**: 9 members (Luella Bligh Chair, Allan Palm Island TO Director, Rhonda Phillips, Harriet Hulthen, Cassie Lang, Raymond Palmer Snr, Matthew Lindsay, Narelle Gleeson-Henaway)
- **Station Precinct**: 30-year lease Townsville, 4 streams (manufacturing, hospitality, construction, exchange)
- **NIAA anchor**: $4.8M NIAA 1.3 Safety & Wellbeing (2024-25)
- **ALMA**: 7 interventions linked to entity
- **14 contacts** in org_contacts (4 funders, 4 partners, 2 advocacy, 2 community, 2 governance)

### Architecture
- Dashboard: `apps/web/src/app/reports/picc/page.tsx` (server component)
- Client components: `funding-table.tsx` (filterable funding), `programs-table.tsx` (unified view)
- Service layer: `lib/services/report-service.ts` (9 PICC-specific functions)
- Data: justice_funding, austender_contracts, alma_interventions, org_leadership, org_contacts, org_pipeline, grant_opportunities

### External Repos
- `/Users/benknight/Code/Palm Island Reposistory/` — leadership data source, community stories
- `/Users/benknight/Code/PICC Station Site Plan/` — site photos, maps
- `/Users/benknight/Code/Oochiumpa/` — Empathy Ledger platform

### Entity Links Map (ORG_LINKS in page.tsx)
- SNAICC → AU-ABN-42513562148
- A Curious Tractor → AU-ABN-88671625498
- Oonchiumpa → AU-ABN-53658668627
- Brodie Germaine → AU-ABN-57591914579
- Tranby College → AU-ABN-82479284570
- Movember Foundation → AU-ABN-48894537905
- James Cook University → AU-ABN-46253211955
- PICC → AU-ABN-14640793728
