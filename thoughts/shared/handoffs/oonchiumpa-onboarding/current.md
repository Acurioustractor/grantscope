---
date: 2026-03-19T05:00:00Z
session_name: oonchiumpa-onboarding
branch: main
status: active
---

# Work Stream: oonchiumpa-onboarding

## Ledger
**Updated:** 2026-03-19T05:00:00Z
**Goal:** Onboard Oonchiumpa as CivicGraph entity + prepare $1M Community Impact & Innovation Grant application (due 30 Apr 2026)
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] Eligibility confirmation — Oonchiumpa is Pty Ltd, grant requires NFP. User needs to call Aboriginal Investment NT (08) 7906 1741 or 1800 943 039 to confirm.

### This Session
- [x] Entity enrichment: updated `AU-ABN-53658668627` — name, description, tags, sector, community-controlled, website
- [x] Merged ALMA duplicate ("Oochiumpa Youth Services" QLD → correct entity)
- [x] ALMA intervention re-linked to correct entity
- [x] Relationships created: Snow Foundation ($100K grant), A Curious Tractor (partners_with), NIAA (grant)
- [x] Contact links: Kristy Bloomfield + Tanya Turner → entity via contact_entity_links (GHL IDs)
- [x] Person records enriched: indigenous_affiliation=true, engagement=critical, YJ score=9
- [x] 7 grant opportunities added to DB (Innovation $1M, Business Start-Up $100K, NIAA Youth, Snow $100K, Real Funding $200K, RJED, Business Growth $150K)
- [x] Funding strategy matrix created: `thoughts/shared/handoffs/oonchiumpa-funding-strategy.md`
- [x] Full Innovation NT funding landscape researched (Business Innovation $30K, DKAccelerator, ABDP, etc.)
- [x] Grant guidelines PDF analysed (18 pages) — full assessment criteria mapped
- [x] Application framework created: `thoughts/shared/handoffs/oonchiumpa-ciig-application.md`
- [x] Budget drafted: $1M over 3 years (goods enterprise + creative enterprise + At Napa retreat)
- [x] Assessment criteria strategy mapped (5 criteria, weighted 25/25/20/15/15)
- [x] Supporting documents checklist created
- [x] Migration files: `scripts/migrations/enrich-oonchiumpa.sql`, `scripts/migrations/add-oonchiumpa-grants.sql`

### Next
- [ ] **BLOCKER: Confirm eligibility** — Pty Ltd vs NFP requirement. Call (08) 7906 1741
- [ ] If NFP needed: identify auspice org or register ORIC corporation
- [ ] Get formal quotes (containers, equipment, vehicle, construction) — need by 10 April
- [ ] Letters of support (Elders, community, judges, ACT Foundation)
- [ ] Financial statements (2 years) from accountant
- [ ] Land use agreement for At Napa station
- [ ] Resumes (Kristy, Tanya, Ben)
- [ ] Evidence of community involvement (meeting notes, photos)
- [ ] Draft application on SmartyGrants portal
- [ ] Revenue projections model (goods sales + retreat bookings)
- [ ] Whiteboard workshop with Kristy & Tanya (during April visit)

### Decisions
- **Entity structure**: ABN 53658668627 (Pty Ltd, active since Apr 2022) — may need auspice for community grant
- **Grant amount**: $1M (maximum) over 3 years (finish by Aug 2029)
- **Project concept**: "On Country, On Purpose" — 3 pillars: goods production (beds/washing machines), creative enterprise (screen printing), At Napa on-country retreat
- **Innovation angle**: Circular economy enterprise + on-country healing model — first in Central Aus
- **Leveraged funding**: Snow $100K (submitted), NIAA (active), family $70K, ACT in-kind
- **Budget split**: ~52% equipment/infrastructure, ~44% staffing/programs, ~4% admin+contingency
- **Conflict of interest**: ACT Foundation is partner/supplier — must declare, frame as pro-bono

### Open Questions
- **BLOCKER**: Can Pty Ltd apply for Community Impact grant? Or need NFP/auspice?
- Is there an existing ORIC corporation for Oonchiumpa/Bloomfield family?
- Njuka (Tanya's entity) — what's the ABN/structure? Also eligible for Business Start-Up $100K separately?
- Land use agreement for At Napa — who holds title? Need CLC involvement?
- What financial statements exist for Oonchiumpa (2 years required)?

### Workflow State
pattern: feature-build
phase: 2
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Onboard Oonchiumpa + prepare $1M grant application"
- resource_allocation: aggressive

#### Unknowns
- NFP eligibility: BLOCKER — call Aboriginal Investment NT
- ORIC registration status: UNKNOWN
- Land title for At Napa: UNKNOWN
- Njuka entity structure: UNKNOWN

#### Last Failure
(none)

---

## Context

### Oonchiumpa Overview
- **Full name**: Oonchiumpa Consultancy & Services Pty Ltd
- **ABN**: 53 658 668 627 (active since 08 Apr 2022, GST registered from 01 Oct 2023)
- **Entity type in CivicGraph**: `indigenous_corp` (updated from `company`)
- **GS ID**: `AU-ABN-53658668627`
- **UUID**: `16cadc21-083d-4d5e-8b9f-7dc6dca33b38`
- **Location**: Alice Springs (Mparntwe), NT 0870 — Remote Australia, Alice Springs LGA
- **Leaders**: Kristy Bloomfield, Tanya Turner
- **Website**: https://oonchiumpa.com.au
- **Oonchiumpa platform repo**: `/Users/benknight/Code/Oochiumpa/`

### Key Relationships
- **Snow Foundation** (ABN 49411415493): $100K committed for Year 1 operational (submitted to CEO Georgiana). No infrastructure — operational only. Trust-based philanthropy.
- **A Curious Tractor Foundation CLG** (ABN 88671625498): Partner — goods supply chain, logistics, market access. Ben Knight & Nick Marchese.
- **NIAA**: Current salary funding (Kristy, Tanya, Kylie). Office lease funded until August 2026.

### Contact Details in CivicGraph
- Kristy Bloomfield: GHL ID `0kEs9BJmkmi7ZUc5haEX`, person_id `e5dca7e0-ac41-4397-a8d6-46d42c7e3d07`, email kristy.bloomfield@oonchiumpa.com.au
- Tanya Turner: GHL ID `lQ4ROlknfvUmlVbCJhVu`, person_id `15105683-b9af-4ead-aed5-c2c43241a698`, email tanya.turner@oonchiumpa.com.au
- Note: duplicate "Kirsty Bloomfield" record exists (person_id `ae5a6d1f-...`) from gmail_5000_discovery — should merge

### Grant Application Key Files
- **Guidelines PDF**: `/Users/benknight/Downloads/Aboriginal+Investment+NT+-+Community+Impact+Grants+Guidelines-Round2-WEB.pdf`
- **Application framework**: `thoughts/shared/handoffs/oonchiumpa-ciig-application.md`
- **Funding strategy**: `thoughts/shared/handoffs/oonchiumpa-funding-strategy.md`
- **Portal**: https://aboriginalinvestment.smartygrants.com.au/CIIGR2_2026

### Assessment Criteria (weighted)
1. Project Impact or Innovation — 25%
2. Community Led — 25%
3. Value for Money — 20%
4. Capability and Capacity — 15%
5. Equity — 15%

### Meeting Transcript Context
Full meeting transcript was provided covering: Snow Foundation funding update, funding strategy discussion, current projects (At Napa, Oonchiumpa House, goods), Innovation Grant strategy, enterprise/revenue generation, judges visit April 17, Justice Hub concept, capacity concerns, office lease expiring August.

### Migration Files
- `scripts/migrations/enrich-oonchiumpa.sql` — entity update, duplicate merge, relationships, contact links, person enrichment
- `scripts/migrations/add-oonchiumpa-grants.sql` — 7 grant opportunities
