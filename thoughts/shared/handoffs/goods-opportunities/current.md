---
date: 2026-08-04T19:30:00+10:00
session_name: goods-opportunities
branch: feat/funding-ops-and-ask
status: active
---

# Work Stream: goods-opportunities

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-06T00:30:00+10:00
**Goal:** Fold DONE (#121–#124) + ask machinery DONE (/make-the-ask, Balnaves + auDA grounded drafts, #125–#132) + Ben's live UX review DONE (#133–#137). Next session: Ben's decisions, then submissions.
**Branch:** main (everything merged; work in small PR-per-change loops)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run; E2E: kill dev server on 3013 first, then npx playwright test (24/24, no fixmes)

### Now
[->] BEN'S DECISION QUEUE (everything else is done or waiting on these):
1. Balnaves 15% answer — Butterfly 2026 income ~$124K (ACNC API) so cap ≈ $18.7K vs $175–253K ask; the EOI explanation clause carries it. Draft: thoughts/shared/drafts/balnaves-eoi-2026-08-05.md + Notion "Ask — Balnaves"
2. auDA open-or-pass by 31 Aug — funded work must be CC-licensed, no proprietary rights to ACT Pty (Guidelines s7/s10); 15×$50K confirmed; GivingData portal open now
3. KKT intro send/edit — drafted (thoughts/shared/drafts/kkt-intro-2026-08-05.md), Maningrida line bracketed pending real count
4. Nic's hackathon video for Jay — ~2 weeks overdue (Catalysing Impact); cohort check-in 3 Sept
5. Watch Brian M Davis — grants committee took the Butterfly work this week (Anita's thread)

### Session 2026-08-05 late (asks + perf + Ben's live UX review, PRs #125–#137)
- [x] **/make-the-ask skill** + Notion "Ask template — Goods funding" + filled Balnaves + auDA instances under Goods Sales Hub (extends the July "Goods Investment Ask Template + Workflow" page, adds claims-and-grounding table) (#125, #126)
- [x] Balnaves EOI grounded draft (15% risk quantified via ACNC API; Maningrida count UNVERIFIED — goods_deployment_batches is EMPTY vs proof_line's "24 assets"); auDA draft blocked on open-source framing call (#131, #132)
- [x] QBE "Stage 2" was a PHANTOM (Gmail sweep): ACT is in Catalysing Impact cohort; Local Grants EOI closed 16 Mar, none submitted. Real item = hackathon video
- [x] **Perf**: funder-intelligence unstable_cache never stored (3.3MB > 2MB cap) → in-process TTL memo; trigram threshold 0.3→0.5 on contact resolution (13.2s→3.1s). Warm 17.4s→~2s, cold ~17s→~10s. Debug timers behind DEBUG_FUNDER_INTEL_SIZE (#128–#130)
- [x] **Quiet Ledger everywhere**: .ws.act-desk CSS vars re-pointed at ql tokens + Curiosity/funder-desk hex sweep — soft-green retired (#127; Bauhaus stays public + Goods tabs)
- [x] **Ben's review cuts** (his taste, encoded): Curiosity = one heading + "pursue or pass" contract line, Pursue/Pass primary verb pair (maps to act/close API) (#133) · desk filters labelled + plain words (Money owed to us / Committed work / Grant rounds) (#134) · Funding retired from rail (#135) · rail cut to the spine: One Desk / Orgs / Curiosity + projects + Atlas only (Art/Money/Sources/Research off-rail, URLs legacy) (#136) · desk kind-lenses moved INTO the rail under One Desk, header keeps only project filter (#137)
- Known gaps accepted: mobile can't switch desk lenses (rail hidden); Goods 14-tab sub-tree + "Test the whole ACT system" floater un-reviewed; orgs-list E2E occasionally flaky under cold compile (30s timeouts added)

### Session 2026-08-05 evening (Org record surface + one-system fold, PRs #121–#124)
- [x] PR #121: **Org record** /org/act/orgs/[org] (Quiet Ledger): six typed Relationships (funds/buys/distributes/auspices/collaborates/opens mapped from goods_relationships in lib/services/act-org-record.ts), Asks in the five stages (GoodsStage→stage mapping table there too), next moves + follow-ups + brief actions, People, Xero money history, conversations timeline, GHL door + freshness badges (stale >24h). Composes the Listen loaders (act-relationship-ledger / act-funder-intelligence / act-relationship-brief) — no rebuilt queries. Unknown org slugs render an honest empty record, not 404.
- [x] PR #122: desk workHrefs → Org records for org rows (money chases, in-GHL funders, buyers). Decision-due funders keep the scan (decision surface); Grant Rounds keep triage (a round is not an Org).
- [x] PR #123: **Listen folded** → /org/act/orgs list (search, relationship chips + warmth, cards/table/compact density). Rail: Orgs replaces Listen; ?view=relationships stays reachable as legacy.
- [x] PR #124: **Action retired** from the rail (One Desk owns committed work, kind=commitment); ?view=pipeline legacy. Curiosity kept (matter-review desk earns its depth).
- Org identity note: [org] slug = normaliseRelationshipIdentity hyphenated (actOrgSlug/actOrgHref in act-org-record.ts); spans ledger keys, goods_relationships display names, and dossier names.

### Session 2026-08-05 (UX consolidation — all merged to main, PRs #104–#115)
- [x] PR #106 + stacked #104 merged (30 commits incl. 4 rescued uncommitted-workspace commits); main E2E repaired (fixture guard in getOrgProfileBySlug — see memory vercel-oom-and-e2e-fixture-contract)
- [x] GHL handoff G1–G7 shipped: deep links everywhere (lib/ghl-links.ts), dossier buyers section + push button rewired, grants triage push→GHL Grants pipeline (mirrors seeder, idempotent via grant_opportunities.ghl_opportunity_id)
- [x] Balnaves data bug fixed: was seeded on empathy-ledger project row; moved to goods (Ben ran the UPDATE) — now visible on Funder Scan
- [x] Workspace coherence rounds: real hub fronts /org/act/goods (field-map only under E2E fixtures/?fieldmap=1); 1760px containers; GoodsViewToggle (cards/table/compact, URL-param); "Money in" nav group; rail owns ALL Goods nav (GoodsRailTree in act-workspace-shell, header pills mobile-only)
- [x] **One Desk** (/org/act/desk): Ben's chosen model from /prototype (B split-desk + A do-this-now + C horizon groups). One ranked pool (lib/services/act-one-desk.ts): funders + grants + buyers + money (overdue invoices) + commitments (pipeline cards, ALL projects). Project + kind are filter chips. Done/Waiting/Tomorrow persists via daily-actions store (shared with old Today). Rail work-mode 01.
- [x] Vercel OOM fixed for real: next.config cpus:2 + webpackMemoryOptimizations + 4GB heap in vercel.json

### Session 2026-08-05 afternoon (domain model + desk contract, PRs #116–#119)
- [x] Quiet Ledger theme: ql-* tokens in globals.css (mirror pencil-new.pen component library), One Desk re-skinned, fonts via next/font; brand decision recorded in act-brand-alignment-map (Bauhaus stays public-facing)
- [x] Domain model grilled + merged: CONTEXT.md (Ask/Grant Round/Signal; Org + 6 relationship types incl. opens; Target; 5 stages; desk contract; GHL-owns-the-Ask) + docs/adr/0001
- [x] Desk contract enforced: asks + decisions-due only (fit>=85 / deadline<=30d thresholds), decide rings, Target header ($0 committed of $367–620K)
- [x] One Desk IS today: bare /org/act redirects to /desk, Today left the rail; legacy views behind ?view=/?full=1; 22/22 E2E

### NEXT BUILD BLOCK — none. Org record surface SHIPPED (see evening session above)
The session after this one works Balnaves, not more building.

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
- [x] QBE "Stage 2" RESOLVED 2026-08-05 (Gmail sweep): there is no pending QBE application stage — ACT is already IN the QBE-funded Catalysing Impact cohort (participation grant paid, advisory live with Matt Allen/Malcolm Aikman, hackathon under way). The 2026 QBE Local Grants EOI window closed 16 Mar; no EOI from ACT in the mailbox. Real QBE-adjacent actions instead: **hackathon video owed to Jay (promised 22 July, now ~2 weeks overdue)**; cohort check-in 3 Sept 2pm AEST. Remove the phantom deadline from the applications workspace.
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
- RESOLVED: QBE Stage 2 was a phantom — see Next section (Catalysing Impact is the real QBE relationship; hackathon video is the overdue item)
- LIVE + TIME-SENSITIVE (found in Gmail 2026-08-05): **Brian M Davis Charitable Foundation** — Anita Hopkins takes the Butterfly/ACT work to their Grants Committee "early August" (this week); Nic's thread, DGR objects reviewed and confirmed. Expect an update imminently; nothing to chase yet.
- auDA framing decision now includes the openness question: funded work must be CC-licensed + no proprietary rights to ACT Pty (Guidelines s7/s10) — open-source the register layer or pass
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
