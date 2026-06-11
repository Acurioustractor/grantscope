---
date: 2026-06-10T11:15:00+10:00
session_name: goods-command-center
branch: main
status: active
---

# Work Stream: goods-command-center

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-11 (PHASE 2 POSITION DONE: 8 stage restages (Minderoo/AMP/RedDust/Mala'la/TFN→dormant, SEFA→contacted, AINT→researching, EARC identified→contacted) + ALIVE type→supporter + next_action/due on ALL 35 live rows + warmth recomputed (does NOT auto-recompute — re-ran goods_compute_warmth manually; PRF 47→44). 172 'identified' confirmed evidence-free (demand-list/MMR/prospects) — feed Phase 4. Report: thoughts/shared/analysis/2026-06-11-goods-phase2-position.md + applied SQL alongside. PHASE 3 ASKS DONE: 9 ask_amount_aud + 27 ask_purpose; framing.ask_framing MERGED (synced jsonb never overwritten); Centrecorp $106K moved repeat→130-bed row (de-dupe); SEFA $300K deliberately NOT logged; match arithmetic ≈$490-560K clears $400K. Report: 2026-06-11-goods-phase3-asks.md. PHASE 4 FRONTIER DONE: 14 new rows (6 director-linked w/ named bridges: George Alexander via Potter directors, Jalara via Alberto, Wunan via Ian Trust/PRF, Sir David Martin via Peter Evans/PRF, SCF via Georgie Byron, Bryan Education via Michael Taylor; 6 known-active: Defy/Taboo-Eloise/SMART/PICC/Zinus/GW Space; 2 cold: Indigenous Capital, Suncorp) + PA/Kinghorn updates + warmth computed. Registry now 261 rows. NOTE: dedupe_key AND warmth_display are GENERATED columns — never insert/update. Report: 2026-06-11-goods-phase4-frontier.md. ⚡Ian Potter EOI due 18 JUN. ALL 4 PHASES DONE — relationship engine complete. NEXT: Ben sign off brief amounts (TFFF/Bryan/BMD) + work the dated action list)
**Goal:** Goods on Country engagement engine: win 3+ signed matched-capital LOIs by 31 Aug 2026 for QBE Stage 2 ($150–400K grant, gated on ≥$400K legally-binding match). The command center now tells the truth; the work is now off-platform (emails, meetings, LOIs).
**Branch:** **`main` at `dba0394`, everything merged + pushed.** PR #68 (5 slices: buyers/LOI tracker/pitch/instruments/advisory) + PR #69 (496 lock, PFI parked, SEDI added). UNCOMMITTED: `thoughts/shared/briefs/2026-06-10-goods-ask-sizing.md` (ride next PR).
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run tests/unit  (350 pass)

### Now
[->] **BEN: work the dated action list in `2026-06-11-goods-phase2-position.md`** — 12 Jun TFFF dates · 13 Jun Homeland call · 16 Jun ⚡QBE cost model to Matt + Centrecorp board email · 18 Jun ⚡Ian Potter EOI DUE + Snow LOI ask + founder confirms (AINT/AHL/Centrebuild/Hewitt). Then say "run phase 3" (asks) when ready. QBE cost-model send still THE gate.

### This Session (2026-06-11, phase 1)
- [x] PHASE 1 HARVEST COMPLETE: 3 parallel agents (Notion 75 notes / Gmail 22 funders / Gmail 13 buyers) → reconcile in main context (reconcile agent died 2× on socket errors; ALIVE was its surviving test row). 35/35 live rows enriched: merged dossier notes + source_refs.harvest_refs (jsonb, merged into existing GHL pointer object) + evidence-true last_touch_at (26 corrected; biggest: PRF→2025-11-14, Mala'la→2025-09-18, Red Dust→2025-10-01, both Centrecorp→2026-02-13)
- [x] Artifacts written (UNCOMMITTED, ride next PR): `2026-06-11-goods-phase1-{report,dossiers,gmail-funders,gmail-buyers,notion-harvest}.md` + ledger edits
- [x] Batch SQL preserved at /tmp/phase1-reconcile.sql; verified 35 harvested + 32 with harvest_refs (3 without = AINT/AHL/Centrebuild, zero-evidence — correct)
- [x] Dev server started (`npx next dev --turbopack -p 3003`, background task blgr0dlxf); all 12 goods surfaces warmed 200; engagement/campaign/buyers/pitch/insight opened in browser ×2

### This Session (2026-06-10, full day)
- [x] Engagement review (pages + GHL pipelines + Gmail sweep) -> `thoughts/shared/analysis/2026-06-10-goods-engagement-review.md` (gap analysis, per-contact next steps, QBE rhetoric pack §5)
- [x] QBE send package built + render-verified: xlsx (9 tabs, formula-live incl. amortising-vs-interest-only) + 8 CSVs + standalone HTML explorer + README + email draft. KEY FINDING: $500K 5-yr amortising (~$122K/yr) exceeds base brokerage income ($96K/yr) — interest-only coverage 2.7x; disclosed everywhere. Derives from Goods Asset Register v2 cost-model-scenarios.json v6 via build-package.py
- [x] PR #68 merged (`f023364`): /goods/buyers + procurement track on Money; Campaign LOI hero ("0 of 3+ · days to 31 Aug") + parked stage; /goods/pitch claim-chipped canonical proposition + Proof Pack unit-economics; CapitalInstrument + dgrRoutingWarnings amber strip; Advisory Circle ("Advisers, not a board", QBE Area 07)
- [x] Advisory migration APPLIED (advisory contact_type + expertise/last_contacted_at/engagement_ask)
- [x] Founder data (Ben in-session): asks set (Centrecorp $106,150 / Rotary $82,500-as-recovery); **17/17 tranches allocated** (Snow x7 -> Tennant Creek 68%/Utopia 32% estimate; Centrecorp x2 -> Utopia; VFFF + John Villiers -> Palm Island; Red Dust + QIC -> Central Aust; Julalikari/OCS -> Tennant Creek; Mala'la -> Maningrida)
- [x] PR #69 merged (`dba0394`): **496 RECONCILED + locked** (= 363 Basket + 133 Stretch, excludes 21 Weave; 2,660 kg = 133×20 kg exactly; 520 retired, needsReconciliation=false); PFI = QLD Partnering for Impact, EOI NOT submitted -> parked; SEDI added (VERIFY chip)
- [x] SEDI verified open: IIA additional $2.6M round since 8 May 2026, up to $120K, capability SERVICES not capital (NOT QBE match); First Nations round opening soon
- [x] Ask-sizing brief: TFFF $100K (site/Palm Is framing) · Bryan $150K/2yr (youth pathways, ask AT 6-7 Jul visit) · Potter $50-100K (circular economy, menu not number) · BMD $25-50K (whole finishable thing) · PRF NO ask (re-engage toward FY27 partnership). Snow+Centrecorp+Bryan+TFFF clears $400K match

### Next (Ben, off-platform — see ask-sizing brief §This week)
- [ ] Send cost-model package to Matt Allen (cc Jay, Mal, Nic) — THE gate
- [ ] Email Randle Walker: 130-bed proposal on Centrecorp 26 Jun board agenda? board pack needs?
- [ ] Snow LOI conversion ask (email Sally Grimsley-Ballard/Georgie Byron — NOT Carolyn Ludovici)
- [ ] Katie Norman June dates (+ reply Richard Brooking re Witta) -> $100K ask at meeting
- [ ] Bryan 6-7 Jul visit agenda with $150K/2yr ask built in
- [ ] 18 Jun check-in: get QBE's "legally binding co-funding" wording + SEDI eligibility from Jay
- [ ] When an LOI lands: tell Claude -> flip writtenEvidence/commitment in goods-campaign-data.ts

### Next (Claude, on your word)
- [x] GHL hygiene batch DONE 2026-06-11: Centrecorp 130-bed opp moved to Buyer Pipeline "Proposed" ($106,150 now in revenue view); ALIVE renamed + moved to Supporter Journey "Cultivating", $60K phantom zeroed; channel:phone tags on WHSAC/NLC/NPY/Hewitt contacts; goods-rfq:washing-machines tag on Julalikari. TWO MANUAL LEFTOVERS for Ben in GHL UI: (1) create the Julalikari washer-RFQ opportunity in Buyer Pipeline (MCP has no create-opportunity tool) — Delaicee Power inbound, Nic quoted 7 Jun; (2) flip Snow opp primary contact from Carolyn Ludovici to Sally Grimsley-Ballard (Sally/Georgie/Maree contacts already exist with correct emails — MCP can't change an opp's contact)
- [x] Ask-sizing brief committed `1a79059` on main (LOCAL, not pushed)
- [x] ACNC cross-check DONE (acnc_ais, FY23): TFFF $7.3M grants/yr; Bryan $2.3M; Potter $46.2M; BMD $5.6M (corpus $37M->$190M since 2021, giving scaling up); PRF $183.7M. All asks well inside capacity; verified table now in the brief; UNCONFIRMED resolved
- [x] Advisory Circle SEEDED 2026-06-11: 11 advisers from Goods Asset Register wiki `advisory-group.md` inserted into org_contacts (contact_type='advisory', ACT-GD project) with emails from Ben's list — Bloomfield, Marchesi, Grimsley-Ballard, Davies (Defy), Meiklejohn (Orange Sky), Tutt (DeadlyScience), Long (SMART Recovery), Clear, Fitzgerald, Pittman (Zinus), Fisher. 12th adviser: Audrey Deemal (CYP, spelling confirmed by Ben) — her Butterfly governance row ALREADY EXISTED ("Director (co-owner)", alongside Kristy + Sonia), so she now correctly holds both rows. walkingoncountry@gmail.com EXCLUDED on Ben's word (individual unidentified; compendium lists "Walking on Country" as Community Voice adviser — revisit if Ben learns who it is). last_contacted_at/engagement_ask NULL for founder fill; appointed_at NULL for ALL 3 Butterfly directors — fill when 26 Jun handover papers land
- [ ] Remaining asks for TFFF/Potter/Bryan/BMD after Ben agrees numbers per the brief
- [ ] Goods Asset Register repo (ANOTHER SESSION ACTIVE, dirty tree): qbe_pitch_inputs block still carries superseded v5 ask ($112-222K) — fix there, flagged in package README
- [ ] Earlier leftovers: orbit-ring ladder visual; deepen GHL<->entity links; read-gate /goods/* in prod

### RELATIONSHIP ENGINE (approved by Ben 2026-06-11 — PHASE 1 DONE 2026-06-11)
**Phase 1 ✅ (this session):** 3 harvest agents (Notion 75 notes / Gmail funders 22 / Gmail buyers 13) + reconcile via psql. All 35 live rows now carry merged dossier notes + harvest_refs (jsonb, merged into existing GHL pointer) + evidence-true last_touch_at (26 dates corrected; PRF moved back to 2025-11-14 — was 7 months stale). Reconcile agent died twice on socket errors (test row ALIVE survived); finished in main context. Outputs: `2026-06-11-goods-phase1-{report,dossiers,gmail-funders,gmail-buyers,notion-harvest}.md` (UNCOMMITTED). Read report.md first: ⚡Ian Potter EOI due 18 Jun; 15 truth corrections; 11 restage candidates; ~$1.8M buyer signal has zero written substrate (Centrebuild/Hewitt/AHL/AINT/NLC/NPY = phone-only).
Goal: every Goods relationship has full interaction history + position + $ ask + next move; then generate a cold/director-linked outreach frontier with target dates.
**Registry truth (2026-06-11):** goods_relationships has 247 rows (123 funder, 116 buyer, 8 other). Fields all exist (stage/warmth/last_touch/ask_amount_aud/ask_purpose/framing/next_action/next_action_due/warm_intro_path/source_refs) but data hollow: 70% stuck at 'identified', only 2 rows have asks, 0 funder next_actions, 10 intro paths. Live set = 35 (in_conversation 7 + proposal 14 + committed 2 + repeat 12).
**Sources, all siloed:** Gmail (richest; engagement review 2026-06-10 §4 mined it manually); Notion AI meeting notes (50+ since March, NONE linked to relationships, many untitled "Meeting ‣" needing content-read to identify counterparty — query via mcp__notion__notion-query-meeting-notes, filter created_time date_is_on_or_after {type:exact,value:{type:date,start_date:...}}); GHL (truthful post-hygiene); Goods Asset Register wiki (partner prose).
**PHASE 1 — harvest (parallel agents, ≤3 at once):** (a) Notion agent: fetch untitled meeting notes content, identify counterparty + 2-line summary + date; (b) Gmail agent(s): per relationship-cluster thread sweep → interaction summary + true last touch; (c) reconcile agent: merge into goods_relationships notes/source_refs/last_touch_at via psql (schema-check first; psql -f discipline). Output: dossier per live relationship + registry update + phase-1 report in thoughts/shared/analysis/.
**PHASE 2 — position:** re-stage the 173 'identified' from evidence; next_action + due for all live rows.
**PHASE 3 — asks:** extend ask-sizing method (fundable units + verified ACNC capacity) to whole live set; fill ask_amount_aud/ask_purpose/framing.
**PHASE 4 — frontier:** director-linked (mv_board_interlocks × foundations × v_acnc_grant_makers) + cold (grant-makers filtered Indigenous health/circular economy/remote housing, DGR via Butterfly) → new registry rows with ask + target date keyed to calendar (18 Jun Jay; 26 Jun Centrecorp board + Butterfly handover; 6-7 Jul Bryan; 31 Aug QBE match) + approach note.
Key IDs: ORG 8b6160a1-7eea-4bd2-8404-71c196381de0 · ACT-GD project 01359765-a88c-4ac2-8e4d-c40beb01c299.

### Decisions
- 496 is the ONLY external bed figure (Ben 2026-06-10): 496 = 363 Basket + 133 Stretch; 2,660 kg = 133 Stretch × 20 kg; 520 retired
- PFI (QLD Partnering for Impact) EOI never submitted — parked, replaced by SEDI as social-impact candidate
- Ask sizing: anchor to fundable units (site $125K / bed run / falling subsidy), never round numbers; QBE match = urgency; one LOI wording from Jay before papering
- PRF gets no dollar ask — patient FY27 partnership track, out of match campaign
- Tranche allocation confidence labels: 'stated' (founder fact) vs 'estimate' (Snow 68/32 split — refine against deployment records)
- Evidence-backed vs pipeline separation structural; code NEVER flips writtenEvidence — founder only

### Open Questions
- RESOLVED 2026-06-11 (phase 2): warmth_computed does NOT auto-recompute — re-ran goods_compute_warmth() manually for all positioned rows (PRF 47→44; warmth_display is a GENERATED column, never set it directly)
- UNCONFIRMED: Ian Potter EOI 18 Jun details (3-4 pages + budget, employment-outcomes) come from a Notion AI transcript summary — reported, not verified; confirm with Alberto's follow-up email if any
- UNCONFIRMED: QBE match rules + $400K cap in writing (never quote)
- UNCONFIRMED: SEDI = the program Ben meant? eligibility entity (ACT Pty vs Butterfly)? — ask Jay 18 Jun
- RESOLVED 2026-06-11: foundation giving capacities verified against acnc_ais FY23 — table in the brief (note: AIS lags ~2 yrs, FY24/25 not filed)
- UNCONFIRMED: dgrRoutingWarnings shows QBE intentionally (grant via ACT Pty, not DGR) — Ben may want matched_grant excluded from the amber strip

### Workflow State
pattern: sequential-slices-with-gates
phase: complete
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "engagement engine + QBE send package + founder data truth — DONE; baton passed to off-platform LOI work"
- resource_allocation: aggressive (5 kraken slices + 3 research agents, all green)

#### Unknowns
- (see Open Questions)

#### Last Failure
(none — both PRs merged green; only the shared Supabase pooler flaked repeatedly)

---

## Context
This work stream began (earlier session) as the Goods Command Center Phase 1 (Engagement & Warmth Map). This session merged that to main and then built the relationship-intelligence layer Ben articulated: the warm-intro engine (board graph as the spine), the foundation target list, and — next — funder insight. The connective insight: CivicGraph already holds the tissue (39.7K board-interlock people, 336K person→entity edges, 11K foundations, 634 GHL contact↔graph links) and it was barely tapped. Everything here is connect/deepen, on the right side of `/wedge` (Goods dogfooding, not registry widening). Full plan: `thoughts/shared/plans/goods-command-center-2026-06-09.md`.
