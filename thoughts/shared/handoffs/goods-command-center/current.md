---
date: 2026-06-10T11:15:00+10:00
session_name: goods-command-center
branch: main
status: active
---

# Work Stream: goods-command-center

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-10T11:15+10:00 (funding/QBE session: review -> 5 slices -> PR #67 MERGED to main, branch deleted, tree clean)
**Goal:** One-stop "Goods on Country" command center in CivicGraph (`/org/act/goods/*`): philanthropy + impact-investing engine for founders/board, aligned to the QBE Catalysing Impact diagnostic. Connect what we hold (Xero/GHL/Notion/act-infra), don't widen. Memory: `project_goods_command_center.md` (fully updated this session).
**Branch:** **`main` at `3d617fc`, CLEAN, everything pushed.** PR #67 (squash `5792b80`) merged 11 commits: governance workstream (board roster, ladder, showcase, signals, timeline) + funding readiness (`ac68291`) + QBE campaign slices (`98c2bea`/`50b813e`/`baa5250`) + hygiene (`3d617fc` untracked the churning GHL seed + gitignored scrape caches). `feat/goods-governance` DELETED local+remote. CI was green (tsc/unit/E2E/Vercel).
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run  (358 pass + 1 skip; lockstep test needs env: set -a; source .env)

### Now
[->] **BUILD SESSION 2026-06-10 PM (branch `feat/goods-engagement-engine`, LOCAL, not pushed, 3 commits `5fca0b0`/`ff15f98`/`b1dafaa`):** ALL 5 review slices shipped — (4) instrument comparison: CapitalInstrument per source + "What this requires" card block + dgrRoutingWarnings() amber strip (grants route via Butterfly, never ACT Pty/AKT); (5) Advisory Circle on Governance ("Advisers, not a board", QBE Area 07) + getGoodsAdvisors() + migration `20260610030000_goods_advisory_circle.sql` WRITTEN NOT APPLIED (pooler saturated — psql -f when back). Gates: tsc clean, 350 unit tests green. Plus the first 3 — (1) Buyer Pipeline first-class: new /goods/buyers page + goods-buyer-pipeline.ts service, procurement track as separate line on Money (never mixed into grant/investment), Buyers tab in sub-nav; (2) Campaign LOI tracker: hero "N of 3+ signed LOIs · X days to 31 Aug", `parked` commitment stage (Minderoo parked per Lucy 14 May email), PFI needsVerification chip, Snow/SEFA/IBA nextMove from email sweep, NEW sources Centrecorp (26 Jun board) + Bryan Fdn (6-7 Jul visit); (3) /goods/pitch canonical rhetoric page (goods-pitch-content.ts, claim-chipped, from review §5) + unit-economics panel on Proof Pack. Gates: tsc clean, 348 unit tests pass (ladder test updated for parked), all 4 pages smoke-tested 200 (pooler slow ~90s, environmental). **QBE SEND PACKAGE built at act-global-infrastructure/thoughts/shared/analysis/exports/2026-06-10-qbe-cost-model-package/** (xlsx 9 tabs formula-live + 8 CSVs + standalone HTML explorer render-verified + README sanity findings + email draft + zip; derives from Goods Asset Register v2 cost-model-scenarios.json v6 via build-package.py). KEY FINDING: v6 debt coverage is interest-only; $500K 5-yr amortising (~$122K/yr) exceeds base brokerage income ($96K/yr) — disclosed everywhere. AWAITING BEN: send package to Matt Allen (Tier 3), push/PR this branch (Tier 2/3), GHL hygiene batch go-ahead (Tier 2: Centrecorp order→Buyer Pipeline, ALIVE reclass, Snow contact fix, Julalikari RFQ opp). NOT TOUCHED: Goods Asset Register repo (another session active, dirty tree) — its qbe_pitch_inputs block still carries superseded v5 ask, flagged in package README.
[->] **ENGAGEMENT REVIEW DONE (2026-06-10 PM):** full review + GHL pull + Gmail sweep + QBE rhetoric pack at `thoughts/shared/analysis/2026-06-10-goods-engagement-review.md`. #1 ACTION: SIH/QBE asked for the financial model 1 Jun (send to Matt Allen, Aikman QA) — NOT YET SENT, cohort check-in 18 Jun, Stage 2 due Sept. LOI count is 0 of 3+ (due 31 Aug); Snow nearest (grant WON 19 May — convert to LOI; email Sally Grimsley-Ballard/Georgie Byron, NOT Carolyn Ludovici), then Centrecorp 26 Jun board ($106,150/130 beds — last email 13 Feb!), then Bryan 6–7 Jul visit. Minderoo PAUSED by Lucy 14 May (park it). PFI has no email substrate (verify what it is). ALIVE $60K in Buyer Pipeline is the UniMelb research network, NOT a buyer (also resolves the mrff-uom-palmer open question). Buyer pipeline: $1.84M signal all ≤Qualified, WHSAC Groote $1.7M with zero email. Build backlog §6 of the doc: buyer-side first-class → LOI tracker → unit-economics/pitch page → instrument comparison → advisory surface → GHL hygiene (Tier 2).
[->] **Founder data-entry unlocks (only Ben can do):** (1) verify campaign commitment rungs in `goods-campaign-data.ts` (all TODO(ben-verify)); (2) reconcile 496 (QBE reviewer-verified deployed, 2026-06-01) vs 520 (assets-sync delivered, 2026-05-28) bed counts — `goods-canonical-numbers.ts` carries both + needsReconciliation flag; (3) allocate the 17 `goods_tranches` rows to deployments (allocation jsonb, all NULL) to unlock "Snow's $402,930 -> N beds in M communities"; (4) size open asks (`ask_amount_aud`) so the Money pipeline hero fills; (5) set `identifies_indigenous`/`appointed_at` on the 3 board members for the Indigenous-led % stat.

### This Session (2026-06-10)
- [x] Deep-dive review (2 scout agents) of all funding/governance surfaces -> 5-slice build plan, Ben approved all
- [x] **Funding readiness layer** (`ac68291`): ask_amount_aud/ask_purpose + funding-track splits (REL_TRACK/STAGE_PROBABILITY in goods-engagement-shared) + Funder Readiness panel on Governance (Butterfly DGR badge/ABN/links) + Xero-vs-registry reconciliation strip + error-honesty (fetchError) + warmth JS<->SQL lockstep test + foundations DGR-gate/TAM + sub-nav grouped (Pipeline vs Evidence) + add-form all 7 rel types
- [x] **Migrations APPLIED** (DB password was rotated by Ben to authorize — now in BOTH SUPABASE_PASSWORD and DATABASE_PASSWORD in .env; pooler lags a reset ~30s): `…010000_goods_funding_readiness` + `…020000_goods_tranches_framing`
- [x] **GHL "401" diagnosed as STALE Notion record** — both repos' keys 200 on contacts/opportunities/pipelines; goodsoncountry.com /api/admin 401 is its own login guard. Updated 4 Notion rows (Areas 03/06/10/12) via raw API (NOTION_TOKEN; Notion MCP was down), re-synced snapshot
- [x] **Match Campaign tab** (`98c2bea`): /goods/campaign — commitment register (target/in_conversation/eligible/signed, written-evidence gate), countdown to 31 Aug 2026, evidence-backed ($300K SEFA LOI) vs pipeline ($1.04M+) strictly split, NO match estimate while QBE rules unconfirmed. Stack: QBE/Snow R4/SEFA/PFI/IBA/Minderoo in goods-campaign-data.ts
- [x] **Evidence Readiness board** (`98c2bea`): /governance#evidence mirrors the 12-area QBE Diagnostic (Notion db cb3794d427914d72bf1036106d8116f5; 9 P0); scripts/sync-qbe-diagnostic.mjs (slug-free URLs — slugged Notion URLs trip the secret scanner); surfaces mapped as living evidence artifacts
- [x] **Claim labels + canonical numbers** (`50b813e`): verified/modelled/target/future ClaimChips per QBE taxonomy; goods-canonical-numbers.ts carries BOTH bed counts + reconciliation flag; Proof Pack leads with reviewer-safe set
- [x] **goods_tranches** (`baa5250`): 17 tranches from Xero paid ACT-GD invoices = $650,910.79 ties to QBE-verified figure TO THE CENT ($577,461.79 grant 11 rows linked / $73,449 procurement 5 buyer orgs unlinked); Proof Pack "Where the money went" + honest 0-of-17-allocated strip. NOTE: Snow INV-0321 $132K is PAID in Xero since 22 May (act-infra docs still say outstanding)
- [x] **Ask-framing sync** (`baa5250`): goods_relationships.framing jsonb <- act-infra wiki/narrative/funders.json (sync-goods-framing.mjs --apply, 25 rows: tone/claims_to_lead_with/claims_to_avoid/primary_contact); Insight cards "How to talk to them" (synced-not-generated)
- [x] **Shipped**: pushed, PR #67 raised, CI green, squash-merged `5792b80`, branch deleted, hygiene commit `3d617fc` pushed (untracked seed-goods-ghl.generated.sql — 12h scheduler churned it; gitignored data/state-tenders + grant-eligibility-cache)

### Next
- [ ] Founder data-entry items above (the Now block)
- [ ] Add the 5 unlinked buyer orgs (Julalikari, Mala'la, Our Community Shed, QIC, Red Dust) to the warmth registry so their tranches link; verify their funding_track guesses (marked TODO in migration)
- [ ] PFI has NO goods_relationships row — add one so the campaign card enriches
- [ ] Decode the $244,611 registry-vs-Xero delta per relationship (registry total_received_aud includes GHL monetaryValue estimates = pipeline-as-committed bug in dollar form); consider deriving total_received_aud from goods_tranches
- [ ] Earlier session leftovers: orbit-ring ladder visual; deepen GHL<->entity links (only 3 fully-fused timelines); read-gate /goods/* pages in prod (only Money gated)

### Decisions
- Evidence-backed vs pipeline separation is structural (QBE rule "pipeline is not committed capital") — never show a match estimate while rules unconfirmed
- Claim taxonomy adopted verbatim from QBE diagnostic: verified | modelled | target | future
- Tranche register derives from Xero idempotently (ON CONFLICT invoice_number); allocation to communities is curated, never inferred
- Framing is SYNCED from act-infra funders.json, never generated; labelled as such in UI
- Notion sync emits slug-free page URLs (secret-scanner false positive on slugged URLs)
- Repo convention: NO Claude co-author trailer on commits (PR body footer OK)

### Open Questions
- UNCONFIRMED: QBE match rules + $400K cap (Notion says do not quote until confirmed in writing)
- UNCONFIRMED: funding_track for QIC ($12K), Red Dust ($15,950) — guessed procurement
- UNCONFIRMED: framing match `mrff-uom-palmer` <-> "ALIVE" registry row (contains-match; agent says ledger name contains "ALIVE National Centre")

### Workflow State
pattern: sequential-slices-with-gates
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "philanthropy + impact-investing engine aligned to QBE diagnostic; one-stop relationship/$ dashboard"
- resource_allocation: aggressive (parallel kraken agents per slice)

#### Unknowns
- (see Open Questions)

#### Last Failure
(none — all gates green, merged)

---

## Context
This work stream began (earlier session) as the Goods Command Center Phase 1 (Engagement & Warmth Map). This session merged that to main and then built the relationship-intelligence layer Ben articulated: the warm-intro engine (board graph as the spine), the foundation target list, and — next — funder insight. The connective insight: CivicGraph already holds the tissue (39.7K board-interlock people, 336K person→entity edges, 11K foundations, 634 GHL contact↔graph links) and it was barely tapped. Everything here is connect/deepen, on the right side of `/wedge` (Goods dogfooding, not registry widening). Full plan: `thoughts/shared/plans/goods-command-center-2026-06-09.md`.
