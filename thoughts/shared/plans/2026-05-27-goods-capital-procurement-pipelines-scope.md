---
title: Goods capital + procurement pipelines — SCOPE (item #3)
status: scoped — Ben chose PHASE 3 (open-tender feed) as the build-session starting point (2026-05-27)
date: 2026-05-27
repo: grantscope
related:
  - grantscope thoughts/shared/handoffs/goods-capital-procurement-scoping-2026-05-27.md (architecture map, file:line cites)
  - grantscope thoughts/shared/plans/2026-05-27-goods-scoring-noise-fix.md (DONE — discovery_method hook)
  - grantscope thoughts/shared/plans/2026-05-27-goods-ingest-source-vector-programs.md (DONE — 10 seed rows)
  - act-infra thoughts/shared/handoffs/goods-grants-sweep-2026-05-27.md (§4 — the four money-types)
---

# Goods capital + procurement pipelines — scope

## The problem (sweep §4)
Goods needs four money-types; GrantScope's grant scorer only finds the weakest well (competitive grants). The two structural blind spots:
- **CAPITAL** — loans-with-grant-features: IBA Start-Up Finance (30% grant), NAIF, Many Rivers, ILSC, ABA. *Buys the beds/washers/plant.*
- **PROCUREMENT** — the demand side: open tenders + the $4B NT remote-housing program + Supply Nation. *A purchase order beats a grant and repeats.*

## What ALREADY exists (don't rebuild — verified, see architecture map)
- **The 10 seed rows** (capital + procurement programs) live in `grant_opportunities` with `discovery_method ∈ {indigenous-finance, procurement}`; the scorer gives them a +25 boost (`goods-relevance.mjs:74-77`). Foundation laid.
- **Live demand-side data:** `sync-austender-contracts.mjs` pulls the AusTender OCDS API (no-auth) into `austender_contracts` (~672K rows). `hydrate-goods-procurement.mjs` already hydrates buyer spend onto `goods_procurement_entities` using a Goods keyword list (furniture/bed/mattress/appliance/washing…).
- **Buyer model + matcher:** `goods_procurement_entities` (buyers, AGIL census + curated anchors) + `goods_procurement_signals` + `goods-procurement-matcher.mjs` (matches signals→buyers→grants→foundations).
- **GHL pipeline stages already provisioned:** `GHL_GOODS_CAPITAL_STAGE_ID`, `GHL_GOODS_BUYER_STAGE_ID`, `GHL_GOODS_PARTNER_STAGE_ID` (`apps/web/.env.local`). The GHL Goods Buyer Pipeline was built in prior sessions — **a Capital stage already exists and is unused.**
- **Crawler infra:** standalone `.mjs` upsert ingestors (pattern at `import-gov-grants.mjs`) or TS `SourcePlugin`s; fetch+cheerio, Firecrawl fallback (`FIRECRAWL_API_KEY`), LLM extraction (minimax/anthropic), ABN lookup, `agent-registry.mjs` scheduling.

## The actual gaps (verified absent)
1. **No freshness for the ~6 capital programs** — they exist only as static manual-seed rows; amounts/dates go stale. No crawler.
2. **No open-tender feed** — the AusTender sync tracks *awarded contracts*, not open opportunities (ATM/RFT). "What can Goods bid on right now?" is unanswered.
3. **NT $4B remote-housing program: zero ingestion** (the single biggest demand whale).
4. **No UI segmentation by `discovery_method`** — capital/procurement rows surface only via `aligned_projects='goods'` + score; no capital/procurement filter chip or workbench section.
5. **GHL Capital stage unused** — no flow pushing high-fit capital opportunities into it (the Buyer stage flow exists as the prior-session pattern to mirror).

## Cross-cutting design decisions (resolve before building)
- **D1 — Where do these opportunities live?** Keep them as `grant_opportunities` rows distinguished by `discovery_method` (reuses scorer + `/grants` + workbench + GHL sync), vs. new tables. **Lean: keep in `grant_opportunities`** — the hook is already there; a separate table fragments the matcher/UI.
- **D2 — GrantScope = discovery, GHL = action.** These pipelines should *feed* GHL stages (capital→Capital, procurement→Buyer), mirroring the buyer-pipeline pattern. Procurement pipeline is the **opportunity feed upstream of** the existing GHL Buyer Pipeline — NOT a duplicate of it.
- **D3 — Capital: crawl vs curate?** Only ~6 stable program pages, manual-guard-protected. A change-detection "watch" (re-fetch monthly, diff, flag for review) likely beats 6 fragile auto-overwrite scrapers. Or a quarterly manual seeder refresh.

## Proposed phasing (lowest-effort/highest-ROI first)

### Phase 1 — Surface what exists (S, no new ingestion)
- Add a `discovery_method` filter chip to `/grants` (capital / procurement / grant) — small frontend change on the existing `PROJECT_PRESETS` mechanism (`grants/page.tsx:81-131`).
- Add capital + procurement sections to the goods workbench (`goods-signals-workbench.ts` already joins `grant_opportunities`; select `discovery_method` and segment).
- **Repeat-buyer intelligence:** query `austender_contracts` (data already there) for buyers who've purchased beds/whitegoods/furniture → rank as warmest procurement targets. Surfaces the 672K-row asset we already pay to sync.

### Phase 2 — Capital freshness + GHL Capital flow (M)
- Per D3: a `watch-goods-capital-programs.mjs` change-detector for the ~6 Indigenous-finance program pages (fetch+cheerio/Firecrawl) → flag amount/status/deadline changes for review (respects manual-guard), don't auto-overwrite curated rows.
- Push high-fit (`discovery_method='indigenous-finance'`, score≥threshold) rows → GHL Goods pipeline **Capital stage** (`GHL_GOODS_CAPITAL_STAGE_ID`), mirroring the buyer-pipeline sync.

### Phase 3 — Open-tender (procurement) feed (M)
- New `sync-austender-open-tenders.mjs` — same OCDS API (no-auth), but the *tender/planning* releases, filtered to Goods UNSPSC/keywords (furniture/beds/whitegoods/appliances). Upsert as `grant_opportunities` rows, `discovery_method='procurement'`, `status='open'`.
- Matcher + GHL Buyer stage flow picks them up.

### Phase 4 — NT $4B remote-housing tracker (M–L)
- Dedicated source for NT DHLGCD remote-housing program + contract vehicles (likely Firecrawl — JS-heavy). Track as procurement opportunities / a tracked program entity. The whale; highest effort, highest ceiling.

## Decisions
1. **Phase priority — DECIDED: start with PHASE 3 (open-tender feed).** Ben's call, 2026-05-27: the "purchase order > grant" value is the priority. Phase 1 surfacing + Phase 2/4 deferred.
2. **D3 capital: watch/flag vs auto-crawl vs quarterly-manual** — open, only relevant when Phase 2 is built.
3. **GHL flow now or later** — for Phase 3: decide whether open-tender opportunities flow to the GHL Buyer stage this round, or land in `grant_opportunities` first and wire GHL after.

## Phase 3 build-session kickoff notes (start here next session)
Goal: a `sync-austender-open-tenders.mjs` that ingests OPEN AusTender ATMs (Approach To Market), filtered to Goods product, as `grant_opportunities` rows (`discovery_method='procurement'`, `status='open'`).
First three things to verify before coding:
1. **Does the AusTender OCDS API expose open-tender / ATM (planning/tender) releases**, not just the `contractPublished`/`contractLastModified` releases the existing `sync-austender-contracts.mjs` uses? Check `https://api.tenders.gov.au/ocds` release types. If OCDS only carries awarded contracts, fall back to the AusTender ATM RSS/HTML or CKAN dataset.
2. **UNSPSC / category codes for Goods product** — beds/mattresses (UNSPSC 56101500s), whitegoods/appliances (52141500s), furniture (56101700s). Confirm against what ATM records carry; reuse the keyword list already in `hydrate-goods-procurement.mjs`.
3. **Target shape** — reuse the `grant_opportunities` upsert pattern (D1); set `source='austender-open-tenders'`, `discovery_method='procurement'`; do NOT mark manual (let the scorer's +25 procurement boost score them). Register in `agent-registry.mjs`.
Fallback if open-ATM ingestion proves infeasible: pivot to Phase 1 repeat-buyer intelligence (mine the existing 672K `austender_contracts` for buyers who already purchase beds/whitegoods) — data already present, no new source.

## Out of scope
Re-scoring tuning (done), the GHL Buyer Pipeline itself (built prior sessions), Supply Nation live scraping (currently CSV-fed; separate question).
