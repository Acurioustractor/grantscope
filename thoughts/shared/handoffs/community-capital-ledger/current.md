---
date: 2026-03-08T12:00:00Z
session_name: community-capital-ledger
branch: main
status: active
---

# Work Stream: community-capital-ledger

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-08T12:00:00Z
**Goal:** Build entity dossiers + community funding gap packs as revenue products for GrantScope. Part of the larger Australian Community Capital Ledger vision.
**Branch:** main
**Test:** `cd /Users/benknight/Code/grantscope/apps/web && npx tsc --noEmit`

### Now
[->] Commit Sprint A+B+C code, then begin next phase — expanding data coverage and the vision toward full Community Capital Ledger

### This Session
- [x] **Sprint A: Entity Dossier Enhancement** — justice funding section, place context card, premium gating
  - Modified `entities/[gsId]/page.tsx` — queries `justice_funding` by ABN/name, year-by-year breakdown, sector cards
  - Place context sidebar: postcode, locality, remoteness, SEIFA decile, entity count, links to /places
  - Premium gating: checks `org_profiles.stripe_customer_id`, free=top 3 donations/5 contracts/blurred justice, premium=full
  - Created `api/entities/[gsId]/place/route.ts` and `api/billing/check-access/route.ts`
- [x] **Sprint B: Community Funding Gap Packs** — place pages, gap API, materialized views
  - Created `places/page.tsx` (search + featured regions) and `places/[postcode]/page.tsx` (full place dossier)
  - Created `api/places/[postcode]/route.ts` and `api/places/gaps/route.ts` (gap scoring with RPC + fallback)
  - Migration: `20260308_entity_geo_enrichment.sql` — added `is_community_controlled`, `seifa_irsd_decile`, `remoteness`, `sa2_code` to `gs_entities`
  - Migration: `20260308_place_funding_views.sql` — `mv_funding_by_postcode` materialized view + `get_funding_gaps()` RPC
  - Created `scripts/classify-community-controlled.mjs` (dry-run + --apply modes)
- [x] **Sprint C: Benchmark Extension** — 2 new benchmark task families
  - `scripts/benchmark/tasks/foundation-description/` — template-based description generator
  - `scripts/benchmark/tasks/recipient-entity-match/` — cross-platform name matcher (justice→entity graph)
- [x] **Migrations applied to production Supabase**
  - 7,801 community-controlled orgs classified (ORIC corps + name-matched charities)
  - 59,177 entities enriched with SEIFA decile
  - 34,268 entities enriched with remoteness
  - 2,925 postcodes in materialized view
  - `get_funding_gaps()` RPC working — Karumba (4891) gap=100, Mungindi=72, Evelyn=58.9
- [x] **All verified on localhost:3000** — entity dossier 200, places 200, gaps API 200, billing check 200

### Previous Sessions (Carried Forward)
- [x] Benchmark harness built (F1 75% → 77.3%, 3 auto-commits)
- [x] Entity graph: 80K entities, 50K+ relationships across ACNC, ATO, AEC, AusTender, ORIC
- [x] 14,119 grants embedded, 9,874 foundations, 359,678 ACNC records
- [x] Stripe billing infrastructure (5 tiers, checkout, webhook, portal)
- [x] 51,728 justice funding records (JusticeHub, same Supabase)

### Next
- [ ] **Commit all Sprint A+B+C code** to GrantScope repo
- [ ] **Data gap: postcode_geo missing QLD postcodes** — table starts at 2107, missing 0xxx-2106 (NT, QLD, parts of NSW). Need to import full ABS postcode dataset to get remoteness for all postcodes.
- [ ] **Expand entity universe** — ABR/ABN Lookup integration (free API) for Layer A business spine. Currently only have entities from ACNC, ORIC, AusTender, AEC, ASX.
- [ ] **ASIC selective enrichment** — company extracts for high-value entities (directors, related entities, subsidiaries). $10-$23/extract, prioritize by relationship density.
- [ ] **Supply Nation / social enterprise layer** — no single open register. Need Social Traders Finder scrape + RISE dataset + self-declared classification.
- [ ] **LGA mapping** — add LGA to entities and place pages. Required for "funding per LGA" analysis.
- [ ] **Community layer (Empathy Ledger integration)** — the "ledger of meaning" alongside the "ledger of money". Community stories, priorities, lived experience linked to places and funding flows.
- [ ] **Open contribution layer (Phase 2 of vision)** — let users add source finds, match corrections, local context, community stories
- [ ] **Benchmark: run recipient-entity-match** — `node scripts/benchmark/evaluate.mjs --task recipient-entity-match` to get F1 baseline
- [ ] **Foundation description enrichment at scale** — use benchmark task to drive quality, then batch-generate descriptions for 3,304 foundations with websites

### Decisions
- **Same Supabase** — GrantScope + JusticeHub + EmpathyLedger all on `tednluwflfhxyucgwigh`
- **Premium gating** — stripe_customer_id presence = premium (no tier column on org_profiles)
- **Community-controlled classification** — ORIC entity_type + name pattern matching (Aboriginal, Torres Strait, Indigenous, First Nations, Koori, Murri, etc.)
- **Gap score formula** — external_share * disadvantage_factor * remoteness_factor * 100
- **Materialized view** — `mv_funding_by_postcode` with UNIQUE on (postcode, state) — some postcodes cross state boundaries
- **postcode_geo column names** — `sa2_code` not `sa2_code_2021`, `remoteness_2021` (not just `remoteness`)
- **Supabase MCP** — connected to ACT project (`uaxhjzqrdotoahjnxmbj`), NOT GrantScope. Use Management API with `$SUPABASE_ACCESS_TOKEN` env var for GrantScope DDL.
- **Vision architecture** — 7 core objects (Entity, Person, Transaction, Program, Place, Document, Story) + 4 truth layers (raw, resolved, relationship, community)

### Open Questions
- UNCONFIRMED: `postcode_geo` data completeness — why missing QLD? May need re-import from ABS source
- UNCONFIRMED: ABR/ABN Lookup API access — need to check if free tier has rate limits suitable for 80K+ entity enrichment
- UNCONFIRMED: ASIC extract costs at scale — is there a bulk/research pricing arrangement?
- UNCONFIRMED: Supply Nation API — is the directory programmatically accessible or scrape-only?
- UNCONFIRMED: 360Giving standard applicability to Australian context — differences in entity identifiers, geography schemes

### Workflow State
pattern: incremental-deployment
phase: 1
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Build Australian Community Capital Ledger — entity dossiers + community funding gap packs as first products"
- resource_allocation: balanced
- sprint_a: COMPLETE (entity dossier enhancement)
- sprint_b: COMPLETE (community funding gap packs)
- sprint_c: COMPLETE (benchmark extension)
- migrations_applied: true
- dev_verified: true

#### Unknowns
- postcode_geo_completeness: UNKNOWN (missing QLD/NT)
- abr_api_rate_limits: UNKNOWN
- asic_bulk_pricing: UNKNOWN
- supply_nation_api: UNKNOWN
- community_layer_integration: UNKNOWN (Empathy Ledger connection TBD)

#### Last Failure
(none)

### Checkpoints
**Agent:** (manual — user-driven)
**Task:** Community Capital Ledger — Sprint A+B+C
**Started:** 2026-03-08T06:00:00Z
**Last Updated:** 2026-03-08T12:00:00Z

#### Phase Status
- Phase 1 (Entity Dossiers + Gap Packs): ✓ VALIDATED — code + migrations + verification all complete
- Phase 2 (Data Coverage Expansion): ○ PENDING — ABR, ASIC, Supply Nation, full postcode_geo
- Phase 3 (Open Contribution Layer): ○ PENDING — user corrections, community stories, local context
- Phase 4 (Benchmarked Intelligence): ○ PENDING — open tasks, competitions, decentralised compute
- Phase 5 (Community Governance): ○ PENDING — cooperative governance, community treasury

#### Validation State
```json
{
  "test_count": 6,
  "tests_passing": 6,
  "files_modified": [
    "apps/web/src/app/entities/[gsId]/page.tsx",
    "apps/web/src/app/api/entities/[gsId]/place/route.ts",
    "apps/web/src/app/api/billing/check-access/route.ts",
    "apps/web/src/app/places/page.tsx",
    "apps/web/src/app/places/[postcode]/page.tsx",
    "apps/web/src/app/api/places/[postcode]/route.ts",
    "apps/web/src/app/api/places/gaps/route.ts",
    "supabase/migrations/20260308_entity_geo_enrichment.sql",
    "supabase/migrations/20260308_place_funding_views.sql",
    "scripts/classify-community-controlled.mjs",
    "scripts/benchmark/tasks/foundation-description/resolve.mjs",
    "scripts/benchmark/tasks/foundation-description/program.md",
    "scripts/benchmark/tasks/recipient-entity-match/resolve.mjs",
    "scripts/benchmark/tasks/recipient-entity-match/program.md"
  ],
  "last_test_command": "cd /Users/benknight/Code/grantscope/apps/web && npx tsc --noEmit",
  "last_test_exit_code": 0
}
```

#### Resume Context
- Current focus: All code implemented + migrations applied + verified on dev. Ready to commit.
- Next action: Commit to GrantScope repo, then begin Phase 2 (data coverage expansion)
- Blockers: None — all sprints complete and verified

---

## Context

### The Vision: Australian Community Capital Ledger

Build the most comprehensive searchable map of Australian organisations, money, ownership, grants, contracts, place, and community-defined impact — then use that visibility to help communities negotiate for a fairer share of power and capital.

**An always-on Australian ledger of money, power, place, and community voice.**

### Architecture (7 Core Objects)
1. **Entity** — businesses, charities, Indigenous corps, social enterprises, government bodies
2. **Person** — directors, responsible people, key personnel
3. **Transaction** — grants, contracts, donations, procurements, sponsorships
4. **Program** — grant programs, procurement categories, service types
5. **Place** — nation → state → region → LGA → postcode → suburb → electorate
6. **Document** — PDFs, reports, statements, evidence
7. **Story** — community voice, lived experience, priorities, outcomes

### 4 Truth Layers
1. **Raw record** — exactly what the source published
2. **Resolved entity** — best canonical representation (gs_entities)
3. **Relationship** — donated to, contracted by, funded by, directs, operates in
4. **Community** — local voice, priorities, lived experience, community-defined outcomes

### Data Sources (Current + Planned)
| Source | Status | Entities |
|--------|--------|----------|
| ACNC Charity Register | ✓ Live | Charities, governance, finances |
| ORIC Register | ✓ Live | Indigenous corporations |
| AusTender | ✓ Live | Government contracts |
| AEC Donations | ✓ Live | Political donations |
| ATO Tax | ✓ Live | Company tax data |
| ASX | ✓ Live | Listed companies |
| Justice Funding (QGIP) | ✓ Live | 51K justice funding records |
| SEIFA 2021 | ✓ Live | Disadvantage indices |
| Postcode Geo | Partial | Missing QLD/NT postcodes |
| ABR/ABN Lookup | Planned | National entity universe |
| ASIC Extracts | Planned | Corporate structure, directors |
| Supply Nation | Planned | Verified Indigenous businesses |
| Social Traders | Planned | Social enterprises |

### Revenue Model
- **Free public layer** — search, place pages, entity pages, core evidence, community stories
- **Paid professional layer** — advanced alerts, API, bulk exports, due diligence packs, benchmarking
- **5 tiers** — Community (free), Professional ($79), Organisation ($249), Funder ($499), Enterprise ($1999)
- **Cross-subsidy** — institutions pay, communities get free access

### Phased Rollout
1. ✓ **Phase 1: Central auditable core** — entity graph, search, place pages, org dossiers (THIS SESSION)
2. Phase 2: Open contribution layer — source finds, match corrections, local context
3. Phase 3: Benchmarked intelligence competitions — open tasks for matching, extraction, classification
4. Phase 4: Decentralised compute/incentive layer — Bittensor for extraction, matching, anomaly detection
5. Phase 5: Cooperative/community governance — community orgs, Indigenous corps, researchers, journalists

### First Killer Chain (QLD Justice)
QLD justice funding → all recipients → all orgs → all places → all linked charities/businesses/ORIC corps → all community stories → all visible gaps

Then expand: housing, youth, family violence, community services, Indigenous procurement, philanthropy, local government.
