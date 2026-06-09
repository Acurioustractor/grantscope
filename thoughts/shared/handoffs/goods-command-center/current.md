---
date: 2026-06-09T15:10:00+10:00
session_name: goods-command-center
branch: feat/goods-warm-intros
status: active
---

# Work Stream: goods-command-center

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-09T16:10:00+10:00
**Goal:** One-stop "Goods on Country" command center + relationship-intelligence layer in CivicGraph (`/org/act/goods/*`). The vision (Ben, this session): link Goods' GHL contacts ↔ foundations ↔ board members ↔ funder insight ↔ QBE/next-opportunity ↔ commercial-scale artifacts — *connect what we already hold, don't widen*. Plan: `thoughts/shared/plans/goods-command-center-2026-06-09.md`. Memory: `project_goods_command_center.md`.
**Branch:** Currently on **`feat/goods-warm-intros`** (PR **#66 OPEN**, now 3 commits: `0471cc2` warm-intro engine · `27692dc` foundation targets · funder-insight slice). `main` is at **`d4fa233`** (PR **#65 MERGED** — Phase 1 + auth-guard + scheduled GHL + Phase 2 Money). Live migrations: `…060000` engagement, `…070000` dedup, `…090000` warm-intros view, `…100000` foundation-targets view, **`…110000` funder-insight (`ghl_signal` column + GIN, APPLIED)**. tsc 0, **235 tests**. (Untracked leftovers `data/grant-eligibility-cache.jsonl`, `data/state-tenders/` — leave them.)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[x] **Slice 3 of 3 — FUNDER INSIGHT — SHIPPED.** All three Goods Command Center slices now done. The design fork (structured tags vs LLM) was **resolved by the data, not a guess**: probed GHL conversations for warm funders (Snow, FRRR) — every "conversation" is an activity stub (`Opportunity created`, `No-show`), **zero message-thread prose**. The LLM-over-GHL-threads path had no fuel; real correspondence lives in Gmail. Ben chose **GHL structured signals only (ships today)**. Built: temperature decoded off `goods-hot/warm/steady/cooling/cold/inquiry` tags + engagement ring + subscribed briefs (= "cares about") + pipeline stage + **owed-report** (`goods-impact-report-needed`/`goods-report-*`) → deterministic attention ranking + rule-based next move. Live + verified at `/org/act/goods/insight` (HTTP 200, real varied signal).

### This Session (2026-06-09) — shipped a LOT
- [x] **PR #65 MERGED to main** (`d4fa233`, merge commit) — Phase 1 warmth map + the 4 below, gates green (tsc 0, 221 tests, E2E pass).
- [x] **Auth-guard** (`dafe926`): `requireWriteAccess()` in engagement `actions.ts` — prod requires `isAdminEmail` super-admin; `shouldUseFastLocalOrg()` (NODE_ENV!=='production') bypasses for dev. Gates `updateRelationship` + `addProductionPartner`.
- [x] **Scheduled GHL sync** (`778b5f4`): `sync-goods-ghl.mjs` gained `--apply` (psql self-apply + `agent_runs` logging). Registered `sync-goods-ghl` in agent-registry; `agent_schedules` row seeded **12h, enabled, priority 3**. **Live --apply RAN this session** (Ben authorized): 137 rows, `agent_runs` success — proves the cadence works.
- [x] **Phase 2 — Money** (`0261203`): `/org/act/goods/money` + `goods-money.ts` — Received (Xero ACT-GD ledger, was unused) + In-play (22 open asks) + Available (`alma_funding_opportunities` matched on Goods focus_areas, 499) + **"Scrape more"** → `/api/mission-control/tasks {agent_id:'sync-austender-open-tenders'}` (admin-guarded). Page admin-gated in prod w/ fast-local bypass.
- [x] **Warm-intro engine** (`0471cc2`, PR #66): view `v_goods_warm_intros` (`…090000`) joins goods_relationships → mv_person_entity_network → mv_board_interlocks; **collision gate board_count 2..15** (kills "JOHN SMITH on 27 boards"); `bridges_to_goods` cross-link. Service `goods-warm-intros.ts` + page `/org/act/goods/intros`. 71 orgs, 364 connectors, 28 portfolio bridges.
- [x] **Foundation target list** (`27692dc`, PR #66): view `v_goods_foundation_targets` (`…100000`) — ranks 11K foundations by theme-fit + warm board-bridge + DGR + giving, excludes already-engaged. 2,088 fit, 58 warm bridges, 129 DGR. Service + page `/org/act/goods/foundations`. **Shared `GoodsSubNav`** (`_components/goods-sub-nav.tsx`) across all 4 pages.
- [x] **Asset Register CRM sync — EVALUATED + SKIPPED** (Ben's call): no creds in `.env`, it's mainly asset-tracking; capital covered by GHL + curated seed + override. Don't re-propose.
- [x] **Funder Insight (Slice 3) SHIPPED** — migration `…110000` (`goods_relationships.ghl_signal jsonb` + GIN, applied); `sync-goods-ghl.mjs` extended to capture `opp.contact.tags` (verified complete vs contacts endpoint) + opp status + resolved pipeline-stage name into `ghl_signal` (137 rows applied); pure decoder `goods-funder-insight-shared.ts` (temperature / interests / engagement / attention / next-move, taxonomy grounded in real aggregated tags) + fetch `goods-funder-insight.ts`; page `/org/act/goods/insight` + sub-nav tab; 14 decoder tests. 128 funders, 49 with GHL signal.

### Next on resume
- [ ] **"Track" button** on `/foundations` — one-click drop a target into the warmth registry (server action, reuse `requireWriteAccess` + addProductionPartner pattern). Closes target→pipeline loop.
- [ ] **Artifacts showcase slice** (philanthropy impact + commercial scale-for-loans) — the 3rd vision item beyond funder insight.
- [ ] **Merge PR #66** (Tier 3, Ben's verb) once tested. NOTE: `gh pr edit --title` fails on this repo (classic-Projects GraphQL deprecation) — title still says "warm-intro engine"; rename in GitHub UI if wanted. A comment documents the foundation-targets slice.
- [ ] **Broader read-gating** of `/org/[slug]/goods/*` in prod — only the Money page is gated; engagement/intros/foundations are open.
- [ ] **Fuzzy NEAR-name dups** still possible (name-key catches EXACT only).

### Decisions
- **Federated brain** (CivicGraph private intelligence; Asset Register = public face); **hybrid warmth** (computed + override) — from Phase 1.
- **Asset Register CRM sync SKIPPED** — capital covered by GHL + curated seed + override; revisit only if curated rows go stale, and prefer asset-truth *link-out* over CRM import.
- **Board collision gate = board_count 2..15** for both warm-intro + foundation-target views — generic names false-interlock across dozens of boards (data-quality gate BEFORE scoring, per `feedback_data_quality_before_scoring`).
- **Build slices one-at-a-time, commit each.** Warm-intro + foundation-targets + funder-insight all on PR #66 (shared spine + sub-nav).
- **Funder insight = GHL structured signals only (no LLM, no Gmail).** Fork resolved by DATA: GHL holds no funder message threads (activity stubs only), so the LLM-over-threads path had no fuel. The "why" is decoded deterministically from tags (temperature/ring/briefs/campaign-stage) + opp stage + owed-report tags. Gmail-thread synthesis is a possible FUTURE slice (richer, but new integration + LLM + funder-email privacy weight) — Ben deferred it; don't auto-scope it.

### Open Questions
- RESOLVED: GHL conversation volume/shape — verified thin (activity stubs, no prose); real correspondence is in Gmail.
- RESOLVED: structured tags vs LLM — Ben chose structured GHL signals only for this slice.
- OPEN (future): is the Gmail-synthesis fast-follow worth the integration + privacy lift? Revisit once the structured view has been used live.

### Workflow State
pattern: incremental-slices
phase: 3
total_phases: 3
status: all-slices-shipped
retries: 0
max_retries: 3

#### Resolved
- goal: "relationship-intelligence layer for Goods — connect what we hold, don't widen"
- resource_allocation: balanced
- funder_insight_synthesis: RESOLVED — structured GHL signals only (LLM-over-threads had no fuel; Gmail synthesis deferred)

#### Unknowns
- gmail_synthesis_fastfollow: UNKNOWN (worth the integration + privacy lift? revisit after live use)

#### Last Failure
(none — all gates green: tsc 0, 235 tests)

---

## Context
This work stream began (earlier session) as the Goods Command Center Phase 1 (Engagement & Warmth Map). This session merged that to main and then built the relationship-intelligence layer Ben articulated: the warm-intro engine (board graph as the spine), the foundation target list, and — next — funder insight. The connective insight: CivicGraph already holds the tissue (39.7K board-interlock people, 336K person→entity edges, 11K foundations, 634 GHL contact↔graph links) and it was barely tapped. Everything here is connect/deepen, on the right side of `/wedge` (Goods dogfooding, not registry widening). Full plan: `thoughts/shared/plans/goods-command-center-2026-06-09.md`.
