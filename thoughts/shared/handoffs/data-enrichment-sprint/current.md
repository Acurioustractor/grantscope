---
date: 2026-03-15T13:10:00Z
session_name: data-enrichment-sprint
branch: main
status: active
---

# Work Stream: data-enrichment-sprint

## Ledger
**Updated:** 2026-03-15T13:10:00Z
**Goal:** Productize the 1M+ relationship graph — ship decision surfaces, not more linkage.
**Branch:** main
**Test:** `node --env-file=.env scripts/gsql.mjs "SELECT dataset, COUNT(*) FROM gs_relationships GROUP BY dataset ORDER BY count DESC"`

### Now
[->] Fix entity dossier for 1M+ scale, then build the 3 killer views

### This Session
- [x] Government entity resolver: **1,427 new govt bodies** → 106 → 1,533 government_body entities
- [x] Re-ran relationship extraction for contracts: **+69,959 new relationships** in 18 min
- [x] **"No buyer" contracts dropped from 120K (16%) → 160 (0.02%)**
- [x] Total entities: **145,028** | Total relationships: **1,055,346**
- [x] Reviewed Karpathy/jobs project for data linkage patterns
- [x] **STRATEGIC DECISION: Stop mining, start selling the gold** (see Decisions below)

### Next (Priority Order)
1. **Fix entity dossier for scale** — Supabase caps at 1000 rows; Defence has 348K relationships. Need aggregation queries, not full row fetch.
2. **Entity Dossier upgrade** — the "holy shit" screen. Contracts won, grants received, donations made, board overlaps, related entities, concentration/risk flags, timeline.
3. **Network Map** — money flows, people connections, shared directors, govt funding + procurement + donations in one view.
4. **Market/Funding Scanner** — "who are the biggest recipients in X region?", "who wins both grants and contracts?", "which orgs are connected to Y agency?"
5. **High-confidence supplier ABN resolution** (20% linkage time) — contracts are commercially legible
6. **High-confidence donor matching** (threshold + repeat donors only, not long-tail fuzzy)

### Decisions
- **70/20/10 split**: 70% product surfaces, 20% high-yield linkage, 10% experimental R&D
- **Graph is the moat, UI/workflow is the product, selective linkage is the growth engine**
- **Linkage must pass revenue/coverage/compounding test** — if it fails all 3, park it
- **Deprioritized**: long-tail fuzzy donor resolution, deep justice program mapping, universal completeness
- **Three killer views** to build: Entity Dossier (upgrade), Network Map (new), Market/Funding Scanner (new)
- Government entity resolver: entity_type='government_body', gs_id='AU-GOV-{md5(name)}', confidence='reported'
- Migration: `supabase/migrations/20260315_govt_entity_resolver.sql`

### Key Stats (CURRENT)
| Metric | Value |
|--------|-------|
| gs_entities | **145,028** |
| gs_relationships | **1,055,346** |
| government_body entities | **1,533** |
| Contract relationships | **904,087** |
| Donation relationships | **104,052** |
| Justice relationships | **34,857** |
| Buyer coverage (contracts) | **99.98%** (was 84%) |
| Supplier coverage (contracts) | ~87% (97K unresolved) |
| Donation coverage | ~33% (157K donors without ABN) |
| Top entity: Dept of Defence | **348K relationships** |

### Open Questions
- How to handle entities with 348K+ relationships in dossier? Aggregation views? Pre-computed summaries?
- Existing dossier page is 1,800+ lines — refactor into components or extend in-place?
- Network map: D3.js force graph? Or simpler approach?
- Market scanner: full-text search? Pre-computed leaderboards? AI-powered natural language?

### Existing Entity Dossier Page
- Path: `apps/web/src/app/entities/[gsId]/page.tsx` (~1,800 lines)
- API: `apps/web/src/app/api/entities/[gsId]/route.ts`
- Already has: header/badges, stats grid, contract/donation sections, connected entities sidebar, foundation programs, charity info, place context, SEIFA, NDIS supply, JusticeHub cross-link, Governed Proof, procurement workspace
- **Critical bug**: relationship queries have no limit → Supabase caps at 1000 rows → massive truncation for large entities
- Connected entity names fetched in batches of 100 — works fine

### Workflow State
pattern: product-sprint
phase: 1
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "Productize the 1M+ relationship graph into decision interfaces"
- resource_allocation: aggressive (70% product, 20% linkage, 10% R&D)
- government_entity_resolver: DONE (1,427 new entities, 69,959 new relationships)
- strategic_direction: "Stop mining, start selling the gold"

#### Unknowns
- Dossier page scale handling: UNKNOWN (need aggregation approach)
- Network map technology choice: UNKNOWN
- Market scanner UX: UNKNOWN

#### Last Failure
(none)

---

## Context

### Strategic Decision (Founder Directive — 2026-03-15)

**"The graph is the moat, but the decision interface is where the money is."**

The bottleneck is proof of value, not graph completeness. We have enough data to answer commercially valuable questions:
- Who wins contracts and grants in this region/sector?
- Who is overexposed to one funding stream?
- Who is politically connected?
- Who sits across multiple funded entities?
- Where is government money clustering vs outcomes?

Every linkage task must pass: Revenue test, Coverage test, or Compounding test. If it fails all three, park it.

### Data Linkage Sprint Results (Previous Sessions)
- ABR bulk XML import: 18.5M records
- ASIC already loaded: 2.17M companies
- Entity Resolution Engine: 143,601 entities
- Relationship Extraction Engine v4: cursor pagination + psql batch INSERT
- Performance: entity resolution 10hrs→3.7min, relationship extraction untestable→19min

### Learnings
1. Supabase client caps at 1000 rows — need server-side aggregation for large entities
2. Government department names are NOT in ABR — must create entities from buyer_name directly
3. md5(buyer_name) works well as deterministic gs_id for government entities
4. Relationship extraction with 145K entity cache takes ~18 min for 754K contracts
5. The existing dossier page is already comprehensive — upgrade, don't rebuild
