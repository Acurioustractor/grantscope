---
date: 2026-06-09T15:10:00+10:00
session_name: goods-command-center
branch: feat/goods-governance
status: active
---

# Work Stream: goods-command-center

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-10 (governance workstream session: 3 slices shipped — connection showcase, life-event cards, fused timeline)
**Goal:** One-stop "Goods on Country" command center + relationship-intelligence layer in CivicGraph (`/org/act/goods/*`). The vision (Ben): link Goods' GHL contacts ↔ foundations ↔ board members ↔ funder insight ↔ QBE/next-opportunity ↔ commercial-scale artifacts — *connect what we already hold, don't widen*. Plan: `thoughts/shared/plans/goods-governance-relationship-layer-2026-06-09.md`. Memory: `project_goods_command_center.md`.
**Branch:** **`feat/goods-governance` — 6 commits, LOCAL-ONLY, NO PR YET** (ahead of `main`/`origin` by 6). `main` is at `48f1b35` (PR #66, prior session). Commits: `63f039f` roster+wiki-sync · `8276f24` docs(plan+research) · `3c587b5` supporter ladder · `fd13dd9` connection showcase · `83466d7` life-event cards · `4ca68ed` fused timeline. **Migration applied this session: `…120000` view `v_goods_life_events`** (the others `…060000`-`…110000` already live from prior session). Goods sub-nav now 9 tabs (added **Signals** + **Timeline**). tsc 0, **305 tests** green. **TO SHIP (Ben's verb): `git push -u origin feat/goods-governance` (Tier 2) then `gh pr create` (Tier 3).** (Untracked leftovers `data/grant-eligibility-cache.jsonl`, `data/state-tenders/` — leave them.)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] **GOVERNANCE WORKSTREAM — in flight on `feat/goods-governance` (4 commits, LOCAL-ONLY, no PR yet).** Page: `/org/act/goods/governance`. Done: **(1) roster + idempotent wiki sync** (`63f039f` — `sync-goods-governance-roster.mjs`, seed SQL, `org_contacts` governance type) · **(2) governance section shell + sub-nav tab** (`63f039f`) · **(supporter belonging ladder live)** (`3c587b5` — 5 rungs from `goods_relationships` stage/tier: Curious 173 · Connected 60 · Member 2 · Active 12 · Steward 0) · **(4) connection showcase — SHIPPED** (`fd13dd9`). Slice 4 = "how Goods is connected": pure `goods-connection-shared.ts` (degree + best-door from the warm-intro board-interlock graph; honest — shared-board bridge = 2nd degree, plain connector = board-level door, no fabricated ties; **board co-owners = 1st degree by right, NEVER graph-matched**) + degree badge on board cards + "How Goods is connected" section (top 8 doors, bridges first, link-out to `/intros`). Live: **10 shared-board bridges, 61 board-level doors / 71 supporters**. Roster live = 3 Butterfly board (Kristy Bloomfield, Audrey Deemal, Sonia/transition), project-scoped clean. · **(5) life-event cards — SHIPPED** (`83466d7`). Slice 5 (life-event half) = "reasons to reach out" on a NEW **Signals** sub-nav tab (`/org/act/goods/signals`). Migration **`…120000`** view `v_goods_life_events` (per entity-linked supporter: latest ACNC filing `date_ais_received`+revenue+gov-share · latest AusTender contract dated · latest justice funding FY; LATERAL on indexed abn cols). Pure presenter `goods-life-events-shared.ts` ranks freshest reason per supporter + **honest copy** (2026 contract = "New government contract"; ACNC lags so "Latest ACNC return" never "just filed"; justice = coarse FY signal; every figure traces to a dated source; asOf injected for testable ranking). Fetch `goods-life-events.ts` (cap 80 = show all, no-silent-cap guard) + page. Live: **71 supporters / 69 ACNC · 27 contracts · 8 justice**, fresh 2026 wins lead (NACCHO $52.0M, Social Ventures $439K). tsc 0, **293 tests**, page HTTP 200 verified. · **(6) fused relationship timeline — SHIPPED** (`4ca68ed`). NEW **Timeline** sub-nav tab (`/org/act/goods/timeline`). Per supporter, fuse the dated record we OWN into one feed: GHL last_touch (real) + Xero invoices issued + public-record life-events. Pure assembler `goods-timeline-shared.ts` (reuses life-events formatters; **honesty: created_at is bulk-seed so NEVER "first touch", only last_touch_at; Xero "issued" never "paid" (no paid date in sync); justice FY-grained+flagged; Xero matched by normalised EXACT name — thin coverage over false positives**; ranks most-fused first; minEvents=2 = real multi-event histories). Fetch `goods-timeline.ts` (3 feeds) + page (source-coloured rail, fused badge, "not a complete log / email deferred" note). **DATA FINDING (surfaced not hidden):** GHL pipeline (146 touched) and entity-linked record set (71) barely overlap → only **3 supporters fully multi-system fused**, 28 have multi-event histories. *Actionable: linking more GHL contacts to graph entities would deepen the fusion.* tsc 0, **305 tests**, page HTTP 200 verified. Email/Gmail source still DEFERRED (privacy). **NEXT (Ben's pick):** slice 3 proper (orbit-ring visual re-skin of the ladder) · OR deepen GHL↔entity links to fatten the timeline fusion · OR **push branch + open PR to land slices 1-6** (Tier 3, needs Ben's "ship"/"merge"; branch is 6 commits LOCAL-ONLY). HARD CONSTRAINT holds: supporters laddered, First Nations communities NEVER. Plan: `thoughts/shared/plans/goods-governance-relationship-layer-2026-06-09.md`.

[x] **NEW WORKSTREAM — Goods Governance + Relationship-Intelligence Layer (original brief).** Plan: `thoughts/shared/plans/goods-governance-relationship-layer-2026-06-09.md`. Vision (Ben): fuse GHL+email+Supabase+LinkedIn into "who can help Goods and how" + showcase connections + a **governance section** (advisory + Goods on Country charity members + membership lifecycle). **Decisions:** roster lives in the WIKI (sync, don't retype) · lifecycle membership (model already canonical) · its OWN governance section. **Membership model already exists** = `act-belonging-model.md` 5-rung ladder (Curious→Connected→Member→Active→Steward, `tier:` tags). **Roster seed** = Butterfly Movement Indigenous board: **Kristy Bloomfield, Audrey Deemal, Sonia (transition dir)**, handover 26 Jun. **HARD CONSTRAINT:** supporters get laddered, First Nations communities NEVER do (co-owners by right, OCAP). **Research done** → `thoughts/shared/research/goods-relationship-intel-patterns-2026-06-09.md` (Orbit Model = the showcase spine; best-opener inline; degree badge; fused timeline; life-event cards). Data home = `org_contacts` (governance type, has role/linkedin_url/person_id). **Build in a FRESH context** — slice order + open questions in the plan.

[x] **Slice 3 of 3 — FUNDER INSIGHT — SHIPPED.** All three Goods Command Center slices now done. The design fork (structured tags vs LLM) was **resolved by the data, not a guess**: probed GHL conversations for warm funders (Snow, FRRR) — every "conversation" is an activity stub (`Opportunity created`, `No-show`), **zero message-thread prose**. The LLM-over-GHL-threads path had no fuel; real correspondence lives in Gmail. Ben chose **GHL structured signals only (ships today)**. Built: temperature decoded off `goods-hot/warm/steady/cooling/cold/inquiry` tags + engagement ring + subscribed briefs (= "cares about") + pipeline stage + **owed-report** (`goods-impact-report-needed`/`goods-report-*`) → deterministic attention ranking + rule-based next move. Live + verified at `/org/act/goods/insight` (HTTP 200, real varied signal).

### This Session (2026-06-09) — shipped a LOT
- [x] **PR #65 MERGED to main** (`d4fa233`, merge commit) — Phase 1 warmth map + the 4 below, gates green (tsc 0, 221 tests, E2E pass).
- [x] **Auth-guard** (`dafe926`): `requireWriteAccess()` in engagement `actions.ts` — prod requires `isAdminEmail` super-admin; `shouldUseFastLocalOrg()` (NODE_ENV!=='production') bypasses for dev. Gates `updateRelationship` + `addProductionPartner`.
- [x] **Scheduled GHL sync** (`778b5f4`): `sync-goods-ghl.mjs` gained `--apply` (psql self-apply + `agent_runs` logging). Registered `sync-goods-ghl` in agent-registry; `agent_schedules` row seeded **12h, enabled, priority 3**. **Live --apply RAN this session** (Ben authorized): 137 rows, `agent_runs` success — proves the cadence works.
- [x] **Phase 2 — Money** (`0261203`): `/org/act/goods/money` + `goods-money.ts` — Received (Xero ACT-GD ledger, was unused) + In-play (22 open asks) + Available (`alma_funding_opportunities` matched on Goods focus_areas, 499) + **"Scrape more"** → `/api/mission-control/tasks {agent_id:'sync-austender-open-tenders'}` (admin-guarded). Page admin-gated in prod w/ fast-local bypass.
- [x] **Warm-intro engine** (`0471cc2`, PR #66): view `v_goods_warm_intros` (`…090000`) joins goods_relationships → mv_person_entity_network → mv_board_interlocks; **collision gate board_count 2..15** (kills "JOHN SMITH on 27 boards"); `bridges_to_goods` cross-link. Service `goods-warm-intros.ts` + page `/org/act/goods/intros`. 71 orgs, 364 connectors, 28 portfolio bridges.
- [x] **Foundation target list** (`27692dc`, PR #66): view `v_goods_foundation_targets` (`…100000`) — ranks 11K foundations by theme-fit + warm board-bridge + DGR + giving, excludes already-engaged. 2,088 fit, 58 warm bridges, 129 DGR. Service + page `/org/act/goods/foundations`. **Shared `GoodsSubNav`** (`_components/goods-sub-nav.tsx`) across all 4 pages.
- [x] **Asset Register CRM sync — EVALUATED + SKIPPED** (Ben's call): no creds in `.env`, it's mainly asset-tracking; capital covered by GHL + curated seed + override. Don't re-propose.
- [x] **Funder Insight (Slice 3) SHIPPED** (`2ffd988`, pushed) — migration `…110000` (`goods_relationships.ghl_signal jsonb` + GIN, applied); `sync-goods-ghl.mjs` extended to capture `opp.contact.tags` (verified complete vs contacts endpoint) + opp status + resolved pipeline-stage name into `ghl_signal` (137 rows applied); pure decoder `goods-funder-insight-shared.ts` + fetch `goods-funder-insight.ts`; page `/org/act/goods/insight` + sub-nav tab; 14 decoder tests. 128 funders, 49 with GHL signal.
- [x] **Track button SHIPPED** (`5ed1062`, local-only) — `/foundations` rows get a one-click Track → inserts a net-new funder at `identified` with `entity_id = gs_entity_id` (so it leaves the targets view, lands on the Warmth Map). Extracted shared write guard `goods-write-guard.ts` (engagement actions now import it); `foundations/actions.ts` `trackFoundationTarget`; `track-button.tsx`. 60 buttons render live.
- [x] **Proof Pack SHIPPED** (`8f2ebb1`, local-only) — `/org/act/goods/proof` assembles the proof we hold into Impact (for philanthropy: 520 beds/41 washers delivered vs curated demand gap from `goods_communities` active+lead, top communities) + Commercial scale (for loans: $896K Xero-reconciled received, committed funders, buyers advancing). `goods-proof.ts` (pure `computeImpactGap`/`rollupCommercial`, unit-tested), link-outs to Asset Register + QBE cockpit. Verified vs DB (64 communities, 12,504 demand, 11,984 gap, $896K — all tie out). Sub-nav now 6 tabs.

### Next on resume
- [x] **PR #66 MERGED** (`48f1b35`) — all 5 Goods Command Center commits on main, CI green. (PR title still read "warm-intro engine" at merge — `gh pr edit --title` is broken on this repo; cosmetic only.)
- [ ] **Sync local** — `git checkout main && git pull`; the merged `feat/goods-warm-intros` branch can be deleted.
- [ ] **Broader read-gating** of `/org/[slug]/goods/*` in prod — only Money is gated; engagement/insight/intros/foundations/proof are open.
- [ ] **Fuzzy NEAR-name dups** still possible (name-key catches EXACT only). NOTE: `gh pr edit --title` fails on this repo (classic-Projects GraphQL deprecation) — title still says "warm-intro engine"; rename in GitHub UI if wanted. A comment documents the foundation-targets slice.
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
