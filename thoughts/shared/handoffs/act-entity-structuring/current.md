---
date: 2026-03-20T16:00:00+10:00
session_name: act-entity-structuring
branch: main
status: active
---

# Work Stream: act-entity-structuring

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-20T16:00:00+10:00
**Goal:** Create comprehensive ACT entity structuring strategy, match foundations/grants, sync CivicGraph profile data, fix data integrity issues.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] All tasks complete — user invoked `/continuity_ledger` before `/clear`

### This Session
- [x] Created 01-entity-structuring-strategy.md (11-part doc: Pty Ltd, trusts, R&D Tax $170K/yr, Harvest, Farm, timeline to 2030)
- [x] Published entity strategy to Notion under "ACT business set up" parent
- [x] Queried CivicGraph DB for matching foundations (arts, tech, environment, social enterprise, Indigenous)
- [x] Created 02-foundation-grant-matches.md (15 foundations across 3 tiers, govt grants, approach strategy)
- [x] Published foundation matches to Notion
- [x] Fixed org_profiles ABN: was PICC's (14640793728) → corrected to AKT's (73669029341)
- [x] Set linked_gs_entity_id to AKT entity (0f4a9330-4147-4540-b710-a8fb110e2a13)
- [x] Deleted phantom entity "A Curious Tractor Foundation CLG" (fake ABN 88671625498)
- [x] Moved relationships from phantom → real AKT entity
- [x] Added subsidiary_of relationship: ACT Ventures → AKT
- [x] Linked 16 pipeline items to foundation entities via funder_entity_id
- [x] Added 10 new pipeline items (R&D Tax, Gambling Fund, Arts QLD, Smart Farms, Documentary Aust, Humanitix, Gandel, IBA, Burnett Mary, Social Traders)
- [x] Fixed PICC leadership bug — getOrgLeadership() was not filtering by project_id
- [x] Added ACT org-level leadership: Nic Marchesi OAM, Ben Knight, Jessica Adams
- [x] Type check passed

### Next
- [ ] Verify /org/act page shows correct leadership after cache expires (1hr revalidate)
- [ ] Consider adding org_contacts for ACT (partner orgs, funders)
- [ ] Consider adding projects to ACT profile (JusticeHub, Harvest, Farm, Goods, Empathy Ledger)

### Decisions
- ABN 73669029341 is AKT's correct ABN (verified against ACNC data)
- Phantom entity deleted rather than merged — had fake ABN, no real data
- Leadership filter: `project_id IS NULL` for org-level, `project_id = X` for project-scoped
- Pipeline funder links use ILIKE matching against gs_entities.canonical_name
- New pipeline items use idempotent INSERT...WHERE NOT EXISTS pattern

### Open Questions
- UNCONFIRMED: Whether /org/act page refreshed correctly after fixes (1hr cache)

### Workflow State
pattern: investigation-and-fix
phase: 4
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "ACT entity structuring strategy, foundation matches, CivicGraph data sync, leadership bug fix"
- resource_allocation: balanced

#### Unknowns
- (none remaining)

#### Last Failure
(none)

---

## Context

### Key Entity IDs
- **ACT org_profile_id:** `8b6160a1-7eea-4bd2-8404-71c196381de0`
- **AKT gs_entity (charity):** `0f4a9330-4147-4540-b710-a8fb110e2a13` — ABN 73669029341
- **ACT Ventures gs_entity:** `7ff9f2e8-f6b7-46a4-851b-6e25483790f7` — social_enterprise
- **Deleted phantom:** `16ce2876-f6e6-4592-ab88-38077193c335` — was "A Curious Tractor Foundation CLG"

### Migrations Run (all successful)
1. `scripts/migrations/fix-act-entities.sql` — entity cleanup, ABN fix, relationship migration
2. `scripts/migrations/link-act-pipeline-funders.sql` — funder entity links + new pipeline items
3. `scripts/migrations/add-act-leadership.sql` — Nic, Ben, Jessica as org-level leaders

### Code Change
**File:** `apps/web/src/lib/services/org-dashboard-service.ts` (~line 521)
**Fix:** `getOrgLeadership()` now filters `project_id IS NULL` when no projectId passed, preventing PICC's project-scoped leadership from appearing on ACT's main page.

### Notion Pages Created
- "ACT Entity Structuring & Funding Strategy" under "ACT business set up" parent
- "Foundation & Grant Matches for ACT" under same parent

### Foundation Tier Summary
- **Tier 1 (7):** Myer (10/10), Paul Ramsay (9/10), Ian Potter (8/10), ACF (8/10), Minderoo (7/10), Macquarie (7/10), Vincent Fairfax (7/10)
- **Tier 2 (8):** BHP, Rio Tinto, IBA, CBA, Gandel, Humanitix, Documentary Aust, Regional Arts
- **Tier 3 (7):** Burnett Mary, Community Resources, Reef & Rainforest, Woolworths, Lowy, Snow, Fortescue
- **Diversified funding target:** $670K/yr non-revenue (foundations $200K + govt $150K + R&D Tax $170K + procurement $100K + corporate $50K)
