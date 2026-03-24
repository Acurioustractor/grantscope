---
date: 2026-03-22T07:00:00Z
session_name: oonchiumpa-notion-setup
branch: main
status: complete
---

# Work Stream: oonchiumpa-notion-setup

## Ledger
**Updated:** 2026-03-22T07:00:00Z
**Goal:** Restructure Oonchiumpa Notion workspace for action-oriented project management + enrich CivicGraph entity
**Branch:** main
**Test:** node --env-file=.env scripts/gsql.mjs "SELECT COUNT(*) FROM alma_interventions WHERE gs_entity_id = '16cadc21-083d-4d5e-8b9f-7dc6dca33b38'"

### Now
[->] Session complete — all work done

### This Session
- [x] Reviewed Oonchiumpa in CivicGraph (AU-ABN-53658668627, indigenous_corp, Alice Springs)
- [x] Explored /Users/benknight/Code/Oochiumpa codebase (React/Vite + Node/Express + Supabase yvnuayzslukamizrlhwb)
- [x] Extracted strategic insights from 2 raw conversation transcripts (funding, hiring, station, True Justice events)
- [x] Restructured Oonchiumpa Notion page from essay → action dashboard (funding pipeline, key dates, scope, reference)
- [x] Created 5 Roadmap Actions (True Justice, Hayley Hire, Goods/Station, Grants, Uni Marketing)
- [x] Created 10 concrete Actions with dates/owners (WhatsApp, Cowboys, Law Journal, quotes, station trip, etc.)
- [x] Created 5 Decisions in Decisions DB (Snow allocation, V&D house, Mindaroo, office location, youth housing)
- [x] Added 11 events to Planning Calendar DB linked to Oonchiumpa project
- [x] Added 8 reference pages to Knowledge Hub DB with Resource Types and Tags
- [x] Moved long strategy/vision content from main page to Overall Strategy sub-page ("Project Brief" section)
- [x] Enriched CivicGraph: 4 ALMA interventions, 2 person roles, 1 justice funding record

### Next
- [ ] Build Oonchiumpa profile page in CivicGraph web app (entity overview, funding map, network graph, foundation matches)
- [ ] Add procurement intelligence for goods business (NT buyers, contract values, renewal cycles)
- [ ] Delete duplicate Knowledge Hub entries if any remain (the ones with "-- Oonchiumpa" suffix names)
- [ ] Remove static Key Dates table from Oonchiumpa page (Planning Calendar replaces it)
- [ ] Link True Justice to ALMA evidence records (outcomes data from Oochiumpa platform)
- [ ] Consider syncing Notion → CivicGraph for ongoing updates

### Decisions
- Notion page restructured as dashboard (funding pipeline + calendar + actions + decisions + knowledge hub) — all long content moved to Overall Strategy sub-page
- Used existing Actions/Decisions/Planning Calendar/Knowledge Hub databases rather than creating new ones — filter by Project: Oonchiumpa
- "Please water" status used for decisions needing resolution (Snow allocation, V&D house, Mindaroo)
- ALMA evidence levels: True Justice = Indigenous-led, Youth Mentorship = Promising, Cultural Brokerage = Indigenous-led, Atnarpa = Untested
- Person roles ACN derived from ABN: 53658668627 → ACN 658668627

### Open Questions
- UNCONFIRMED: Whether old "Calendar" page (linked view of Actions) has been deleted
- UNCONFIRMED: Whether duplicate Knowledge Hub entries (the ones I created with "-- Oonchiumpa" suffix) were deleted by user
- UNCONFIRMED: Hayley hire — has the offer been made?

### Workflow State
pattern: exploratory
phase: complete
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "Restructure Oonchiumpa Notion workspace + enrich CivicGraph entity"
- resource_allocation: aggressive

#### Unknowns
- Goods business procurement targets in NT — queried but no direct bed/furniture contracts found in austender
- Mindaroo outcome — June board meeting, out of control

#### Last Failure
(none)

---

## Context

### Key IDs
- **Oonchiumpa entity UUID:** 16cadc21-083d-4d5e-8b9f-7dc6dca33b38
- **Oonchiumpa GS ID:** AU-ABN-53658668627
- **ABN:** 53658668627 | **ACN:** 658668627
- **Notion project page:** https://www.notion.so/1d4ebcf981cf80a28c12e5c56d78de10
- **Actions DB:** collection://84bfbf62-1f77-4d4f-9050-ee4b2ed7163d
- **Decisions DB:** collection://305ebcf9-81cf-8181-b223-000b871d2ca4
- **Planning Calendar DB:** collection://31eebcf9-81cf-80d2-9db0-000bdff22af3
- **Knowledge Hub DB:** collection://a94a4038-37f9-46de-afbb-041217d879c1
- **Projects DB:** collection://0786139b-85d6-4699-b2bc-5b2effd52457
- **Oochiumpa Supabase:** yvnuayzslukamizrlhwb (SEPARATE from CivicGraph)

### CivicGraph Enrichment (completed)
- 5 ALMA interventions (1 pre-existing + 4 new)
- 2 person_roles (Kristy Bloomfield, Tanya Turner — directors)
- 1 justice_funding ($117,150 NIAA ASR 2021-2025)
- 7 relationships (Snow $100K grant, NIAA grant, Federal Court contract $34.7K, A Kind Tractor partnership, Lands Advisory lobbying)

### Funding Landscape
| Funder | Amount | Status |
|--------|--------|--------|
| Snow Foundation | $100K | Confirmed, allocation pending |
| Flinders Uni | $52K | Confirmed, 6 months |
| NIAA | Ongoing | Application half-written |
| CIIG | $1M | Writing, due Apr 30 |
| Reels | TBD | Submitted |
| Mindaroo | ~$1M | Uncertain, June board |

### Key People
- **Kristy Bloomfield** — Director, Visionary Leader
- **Tanya Turner** — Director, Aboriginal Leader from Central Australia
- **Hayley** — potential hire (Congress anti-smoking coordinator), split Flinders+Snow role
- **Lorana** — marketing strategy for lawyers/judges/unis
- **Lucy** — Mindaroo Foundation justice portfolio
- **Ben Hewitt** — cattleman, Traditional Owner connection, cowboys cultural induction
- **Deacon** — trainee, grandmother Shirley Bourne connected to judges

### Key Dates
- Mar 28: Lock in Cowboys + Offer Hayley
- Apr 17: True Justice — Judges on Country
- Apr 21: True Justice — Cowboys/North American Farmers
- Apr 28: CIIG submit
- Jun 1: V&D house lease decision
- Jun 15: Mindaroo board meeting
- Jun 29: Ben overseas (6 weeks)

### Migration SQL
- `scripts/migrations/enrich-oonchiumpa.sql` — original (has constraint issues, don't rerun)
- `/tmp/oonchiumpa-fix3.sql` — the one that worked (ALMA + justice funding)
- Person roles inserted via direct psql command
