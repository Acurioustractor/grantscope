# Goods on Country — One-Stop Command Center

**Status:** Phase 1 (Engagement & Warmth Map) **SHIPPED 2026-06-09** — `goods_relationships` table + `goods_compute_warmth` fn applied, seed = 106 rows (80 funder, 26 buyer), service + page live at `/org/act/goods/engagement`, tsc clean. Phases 2–4 + override UI / production-partner source / warm-intro paths pending.
**Date:** 2026-06-09
**Owner:** Ben
**Strategy fit:** Goods-as-its-own-org dogfooding the platform (the archetype case in `project_supply_base_evidence_layer`). NOT a widening of the public SE registry — stays on the right side of `/wedge`.

---

## Decisions locked (2026-06-09)

1. **Home — CivicGraph federated brain.** Build the private intelligence cockpit here in grantscope under `/org/act/goods/*` (Goods is a project of the `act` org, per `fast-local-org.ts`). The Goods Asset Register / `goodsoncountry.com` stays the public asset + QBE face. The two are linked, not merged: CivicGraph pulls asset-truth counts and links out to `/admin/qbe-program`; it does not migrate the Asset Register app.
2. **First slice — Engagement & Warmth Map.** Who we're engaged with (funders, investors, financiers, production partners, buyers, advocates) + a single closeness score + a concrete next-best-action to get closer.
3. **Warmth model — Hybrid.** Computed baseline from signals, with per-relationship manual override.

---

## What already exists (do not rebuild)

**CivicGraph (this repo) — the brain**
- Goods workspace: `/org/[slug]/goods/communities`, `/community/[id]`, `/funnel`, `/wiki/goods-signals`, `/wiki/goods-operating-system`.
- Goods data layer: `goods_communities`, `goods_products`, `goods_supply_routes`, `goods_procurement_entities`, `goods_asset_lifecycle`, `goods_procurement_signals`, `goods_governance_readiness`, `goods_cost_allocation_decisions`.
- Opportunity engine: ~15 discovery/sync/import agents → `alma_funding_opportunities`; orchestrator; Mission Control dispatch. Match APIs: `/api/grants/match`, `scout-grants-for-profiles`, `se-grant-match`.
- CRM bridge: `lib/ghl.ts` with 3 Goods GHL pipelines (Buyer 12 stages · Supporter 10 · Demand 4); `contact_entity_links` joins GHL contacts to the 159K-entity graph.
- Graph intelligence reusable for warm-intro paths: `mv_board_interlocks`, `mv_person_entity_network`, `mv_person_influence`, `mv_revolving_door`.

**Goods Asset Register (`/Users/benknight/Code/Goods Asset Register`) — the public face**
- 389 assets (369 beds, 20 washers) across 8 communities, QR-tracked.
- QBE cockpit at `/admin/qbe-program`.
- Strategy docs: `GO_TO_MARKET_THOUSANDS_2026.md`, `Catalysing_Impact_Application_DRAFT.md`, `MARKET_INTELLIGENCE_2026.md`.

**Scattered warmth signals to unify (the core problem):** `saved_foundations.relationship_stage|star_rating|alignment_score`, `opportunity_decisions.decision|evidence_gaps|outcome`, `org_pipeline.status|pathway|ghl_opportunity_id`, GHL stages, `contact_entity_links.confidence_score`, and historical funding (`gs_relationships`, `justice_funding`, `austender_contracts`, foundation grants).

---

## The workflow (phases)

- **Phase 0 — Foundations decided** (this doc). ✅
- **Phase 1 — Engagement & Warmth Map.** Unified relationship registry + hybrid warmth + next-best-action + warm-intro paths. *(Detailed below — build first.)*
- **Phase 2 — Money: received + available.** A Goods received-funding ledger (what we've got before) + the live opportunity engine surfaced in-page (grants / foundations / repayable finance / impact investors matched to Goods) with a Goods-scoped "scrape more" button wired to Mission Control.
- **Phase 3 — Two faces.** Outward showcase (asset-truth + impact metrics + stories) and a supporter workshop surface (shareable, co-design the asks: more funds, more production partners, more beds sold).
- **Phase 4 — Loop it.** Fold warmth + next-actions into the weekly QBE cadence so it refreshes on a ritual.

---

## Phase 1 — Engagement & Warmth Map (detailed)

### Data model
New table `goods_relationships` (the unified registry + override home):

| column | type | note |
|---|---|---|
| id | uuid pk | |
| relationship_type | text | enum: `funder` · `impact_investor` · `repayable_finance` · `production_partner` · `buyer` · `supporter` · `advocate` |
| display_name | text | |
| entity_id | uuid null | fk gs_entities (for graph + history + intro paths) |
| ghl_contact_id | text null | the person |
| ghl_opportunity_id | text null | the live deal |
| stage | text | normalized ladder (below) |
| target_stage | text | for "what to get closer" |
| warmth_computed | int | 0–100, refreshed by function |
| warmth_override | int null | the hybrid manual knob |
| last_touch_at | timestamptz null | |
| next_action | text null | computed default, manually editable |
| next_action_due | date null | |
| total_received_aud | numeric | historical $ in, from graph/justice/contracts/foundations |
| source_refs | jsonb | back-links to saved_foundations / opportunity_decisions / org_pipeline rows it was seeded from |
| notes | text null | |
| created_at / updated_at | timestamptz | |

Display warmth = `COALESCE(warmth_override, warmth_computed)`.

**Seeding** (one-time + incremental): a `sync-goods-relationships` script/agent that upserts from `saved_foundations`, `opportunity_decisions`, `org_pipeline`/GHL opps, `goods_procurement_entities`, and historical funders. Dedupe by `entity_id` then fuzzy name. `source_refs` records provenance so the registry stays reconcilable.

### Warmth formula (computed baseline, 0–100)
- **Stage 40%** — normalized ladder: identified 10 · researching 25 · contacted 40 · in_conversation 60 · proposal/applied 75 · committed/funded 90 · repeat/champion 100. (Map each type's GHL stage onto this.)
- **Recency 20%** — decay on days since `last_touch_at`: <14d=100 · 30d=80 · 60d=55 · 90d=35 · 180d+=10.
- **History 20%** — prior giving/partnering: floor for "has prior", log-scaled on `total_received_aud`.
- **Alignment 15%** — thematic + geographic fit (reuse `saved_foundations.alignment_score`; derive for partners/buyers from sector/region match).
- **Advocacy 5%** — introduced others / relevant board seat / co-funds, from `mv_board_interlocks` + `mv_revolving_door`.

Bands: 0–24 Cold · 25–49 Cool · 50–69 Warm · 70–89 Hot · 90–100 Champion.

### Next-best-action ("what to do to get closer") — rule-driven
- No touch >60d & stage≥contacted → "Re-warm: send latest impact update."
- stage=identified → "Qualify fit + confirm program window."
- stage=researching & alignment high → "Make first contact" + **warm-intro path** if one exists.
- `opportunity_decisions.evidence_gaps` present → "Close evidence gap: <gap>."
- stage=in_conversation → "Move to ask: scope <beds/$> proposal."
- stage=applied, no outcome → "Follow up on submitted application (due <date>)."

**Warm-intro paths (the differentiator):** when `entity_id` is set, query `mv_board_interlocks` / `mv_person_entity_network` for a person who connects a known/warm relationship to this target, and surface "Warm path: X (on their board) also connects to Y you already know." This turns the 159K-entity graph into outreach leverage — data you already have that nobody else does.

### The page — `/org/act/goods/engagement`
Server Component, Bauhaus styling (match `goods/funnel/page.tsx`: `border-4 border-bauhaus-black`, `font-black uppercase tracking-widest`, zero radius).
- **Portfolio header:** count by type, warmth distribution bar, total historical $ received, total in active asks.
- **Filters:** relationship_type chips + warmth band.
- **Board/list** grouped by warmth band (Champion → Cold). Each card: name · type · warmth (with a computed-vs-override marker) · stage · last touch · next-best-action · historical $ · warm-intro hint.
- **Detail drawer:** full history, `source_refs`, GHL deep-link, and the **override controls** (warmth / stage / next_action) — the hybrid knob — writing back to `goods_relationships`.
- **Federation:** header links out to `goodsoncountry.com/admin/qbe-program`; pulls delivered-beds asset-truth as the "proof" stat.

### Build order for Phase 1
1. Migration: `goods_relationships` + a `goods_warmth_compute()` SQL function (verify constraints first per CLAUDE.md SQL discipline). Apply via `psql -f`.
2. Seed script `scripts/sync-goods-relationships.mjs` + register the agent.
3. Service `lib/services/goods-engagement.ts` (typed reads, warmth rollup, intro-path query, `safe()` error wrapping).
4. Page `/org/act/goods/engagement/page.tsx` + detail drawer + override server actions.
5. `cd apps/web && npx tsc --noEmit`, then verify live on `npx next dev --turbopack -p 3003`.

---

## Open items / risks
- **gsql `fetch failed` (2026-06-09):** DB endpoint unreachable from shell at plan time. Confirm connectivity before building (`node --env-file=.env scripts/gsql.mjs "SELECT 1"`); fall back to MCP/psql.
- **Seed volume unknown:** verify row counts in the 6 source tables at build time to size the seed.
- **GHL not connected in dev** (funnel page shows Ordered/Funded=0): live warmth needs GHL env; design must degrade gracefully (computed warmth still works without GHL).
- **Identity ledger:** confirm which ABNs/entities represent "Goods" for the historical-$-received rollup (ACT Pty 36697347676 · Butterfly 22155132684 · sole trader 21591780066).
