---
date: 2026-08-04T19:30:00+10:00
session_name: goods-opportunities
branch: feat/funding-ops-and-ask
status: active
---

# Work Stream: goods-opportunities

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-05T09:15:00+10:00
**Goal:** Work the current Goods opportunities via **One Desk** (/org/act/desk — the new one-system front door). The 2026-08-05 session became a major UX consolidation instead of ask-work; the asks are still the next session.
**Branch:** main (everything merged; work in small PR-per-change loops)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run; E2E: kill dev server on 3013 first, then npx playwright test (21/21, no fixmes)

### Now
[->] Work the live opportunities FROM ONE DESK: Balnaves EOI (in funder queue, fit 90), auDA (31 Aug), QBE Stage 2 deadline confirmation

### Session 2026-08-05 (UX consolidation — all merged to main, PRs #104–#115)
- [x] PR #106 + stacked #104 merged (30 commits incl. 4 rescued uncommitted-workspace commits); main E2E repaired (fixture guard in getOrgProfileBySlug — see memory vercel-oom-and-e2e-fixture-contract)
- [x] GHL handoff G1–G7 shipped: deep links everywhere (lib/ghl-links.ts), dossier buyers section + push button rewired, grants triage push→GHL Grants pipeline (mirrors seeder, idempotent via grant_opportunities.ghl_opportunity_id)
- [x] Balnaves data bug fixed: was seeded on empathy-ledger project row; moved to goods (Ben ran the UPDATE) — now visible on Funder Scan
- [x] Workspace coherence rounds: real hub fronts /org/act/goods (field-map only under E2E fixtures/?fieldmap=1); 1760px containers; GoodsViewToggle (cards/table/compact, URL-param); "Money in" nav group; rail owns ALL Goods nav (GoodsRailTree in act-workspace-shell, header pills mobile-only)
- [x] **One Desk** (/org/act/desk): Ben's chosen model from /prototype (B split-desk + A do-this-now + C horizon groups). One ranked pool (lib/services/act-one-desk.ts): funders + grants + buyers + money (overdue invoices) + commitments (pipeline cards, ALL projects). Project + kind are filter chips. Done/Waiting/Tomorrow persists via daily-actions store (shared with old Today). Rail work-mode 01.
- [x] Vercel OOM fixed for real: next.config cpus:2 + webpackMemoryOptimizations + 4GB heap in vercel.json

### Consolidation next (the retirement list)
- [ ] Retire/absorb duplicated screens: old Today queue panel on /org/act, org pipeline kanban (/org/act/pipeline) — One Desk supersedes both
- [ ] Desk gaps: decision obligations (returns/promises) + review matters not yet in pool; funders/buyers/grants pools are Goods-only (other projects only via commitments)
- [ ] Visual seam: soft-green header style vs Bauhaus tabs — one visual family pass if it still grates

### This Session
- [x] v_goods_central_channels + 4 channel prospects seeded (RASAC, Tangentyere, Tjuwanpa, Waltja)
- [x] Channels tab + hub loop band (demand → channels → capital)
- [x] UX patterns: rot tinting + no-next-step filter (buyers), gap bars (communities), deadline-first (applications)
- [x] Three-pipeline architecture decided: GHL = system of record, CivicGraph = discovery, Notion = production
- [x] GHL read-back columns + reconcile-foundations-ghl.mjs (scheduled daily, key rotated + working)
- [x] Funder Scan (/goods/foundations/scan) with GHL warmth + 2 mismatch views
- [x] Grants Triage (/goods/grants) — live rounds only, deadline-first, source freshness
- [x] Community dossier: population/households/language + need/delivered/gap bar
- [x] Pipeline corrections: Bryan added (in_conversation, QLD-edu caveat), ACF parked (GHL cooling), Balnaves seeded (approach_now, fit 90), KKT pushed to GHL (mail@kkt.org.au, contact UNnvbJGl5l9Jc4ZFfHjK), New Horizons parked (verified: NDIS provider, not funder)
- [x] GHL tag registry + audit script (cleanup deferred — see memory ghl-tag-cleanup)

### Next
- [ ] Balnaves EOI — open door: multi-year $150-250K/yr, First Nations health-hardware framing, via Butterfly DGR (balnavesfoundation.com/how-to-apply, EOI reviewed in 4 weeks)
- [ ] auDA 2026 Community Grant — deadline 31 Aug 2026, digital-inclusion framing needed
- [ ] Confirm QBE Stage 2 exact deadline (flagged unverified in applications workspace)
- [ ] Anyinginyi: chase Tony Miles on the 9 Feb washer quote (live thread, GHL next-action)
- [ ] KKT intro email (mail@kkt.org.au) — peer/co-funder framing, not cold ask
- [ ] Barkly beachhead: Julalikari (repeat, warmth 75) + Anyinginyi (in_conversation) same town
- [ ] Merge PR #106 before piling on more

### Decisions
- GHL is THE system of record for relationship state; never answer "are we in touch with X" from CivicGraph tables (Bryan false-negative proved it)
- Warmth = temperature tags only (goods-hot/warm/steady/cooling/cold); needs-followup is a marker, not warmth (NAACT false-positive proved it)
- Top-10 funder list verified: Snow/QBE/Minderoo/PRF top tier real; auto-matched tail needs verification before approach (2 of 4 spot-checks failed: Bryan=QLD-edu-only, New Horizons=NDIS provider)
- Distribution thesis: channel archetypes (health_service, housing_logistics, womens_council, community_store) beat place-accuracy work for beds/washers
- Grants are deadline-driven not stage-driven; NT IS covered by scrape-state-grants (audit claim wrong)

### Open Questions
- UNCONFIRMED: QBE Stage 2 exact deadline + acceptable commitment evidence
- UNCONFIRMED: whether Ben wants Balnaves EOI drafted this coming session (use /act-voice + /ground before any outreach copy)
- Ben decisions pending (tag cleanup session): status:quarantine 1,806 contacts keep-or-archive; Harvest cohabitation in GHL location

### Workflow State
pattern: sequential
phase: 2
total_phases: 2
retries: 0
max_retries: 3

#### Resolved
- goal: "one workspace for demand/channels/capital — BUILT; next: work the opportunities"
- resource_allocation: balanced

#### Unknowns
- qbe_stage2_deadline: UNKNOWN

#### Last Failure
(none)

---

## Context

Session 2026-08-04 built the Goods opportunity workspace end-to-end on PR #106
(9 commits, ce24320..4c2710c). Key surfaces: /org/act/goods (hub loop band),
/goods/channels, /goods/foundations/scan, /goods/grants, community dossiers.
Daily agent reconcile-foundations-ghl syncs GHL truth onto discovery rows.

Funder state (GHL-verified): Snow hot (multi-year LOI target), QBE warm
(catalytic), Minderoo steady (qbe-tier-1 match), PRF steady/VIP, SEFA nurture
(repayable, qbe-tier-1), ACF cooling→parked, Bryan warm but QLD-edu-only
(relationship touch, not Goods ask — Marie-Louise Cox mcox@thebryanfoundation.org.au
needs-followup), Balnaves approach_now (verified $5M/yr, open EOI), KKT pushed
(goods-cold, peer framing).

Grants: ~2,890 live rows of 25.8K corpus. Top verified: auDA (31 Aug),
SEDI First Nations SE grants (rolling, purpose-built fit), FRRR SRC (small,
near-certain), ILSC (needs Indigenous-corp applicant — via channel partner),
PRF First Nations round (pairs with funder conversation). Entity routing:
DGR-gated → Butterfly Movement Ltd; commercial → ACT Pty t/a Goods on Country;
ACCO-gated → partnership application with a channel org.

Channels: Barkly is the beachhead (Julalikari repeat 75 + Anyinginyi
in_conversation 42, same town; Anyinginyi has live washer quote — Tony Miles,
9 Feb, 4 units). Top untouched: Congress ($674M), NPY ($115M), Oonchiumpa
(existing partnership, in channel view, no Goods relationship row).

Memory files written: three-pipeline-architecture, ghl-tag-cleanup.
Handoff from prior place-model session:
thoughts/shared/handoffs/general/2026-08-04_14-30_central-australia-place-model.yaml
