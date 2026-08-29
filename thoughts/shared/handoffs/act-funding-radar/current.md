---
date: 2026-08-29T00:00:00Z
session_name: act-funding-radar
branch: main
status: active
---

# Work Stream: act-funding-radar

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-29T00:00:00Z
**Goal:** ACT reliably sees relevant funding for ALL its projects, not just Goods. Done when a funding notification has reached a human and one `saved_grants` stage move or `opportunity_decision` follows it.
**Branch:** main (clean; nothing committed this session — the two new files below are UNTRACKED)
**Test:** `cd apps/web && npx tsc --noEmit && npx vitest run`

### Now
[->] Nothing in flight. Awaiting Ben's four decisions (see Open Questions) before any code.

### This Session
- [x] Reviewed the Notion board `Funders & Opportunities` (data source `ecfa025b-3275-42a4-8923-6cddf800adce`). Found: ~65 of 100 rows point at Goods, 15 Active rows past due, `Grant` checkbox on 16 rows vs `Instrument='Grant'` on 70, and ZERO rows for JusticeHub / Empathy Ledger / The Farm / SMART / CAMPFIRE / Mounty Yarns / Custodian / ConFit / DadLab / June's Patch / Civic Scope / MMEIC.
- [x] **Added 22 new rows to that Notion board** (100 -> 122), each with application link, context, eligibility, next action and an explicit verification status in `Source note`. Deliberate choices recorded in Decisions below.
- [x] Ran a 48-agent ultracode workflow (run `wf_385288f4-fb2`, 6.48M tokens). 109 money sources proposed, 10 survived adversarial refutation.
- [x] Wrote findings to `thoughts/shared/findings/act-funding-radar-2026-08-29.md` (synthesis + completeness critic, verbatim).
- [x] Published the plan as an artifact: https://claude.ai/code/artifact/fb3b27ad-d1d6-4e90-93d2-9ee699be2377

### Next
- [ ] **Day 1a:** Set `RESEND_API_KEY` in Vercel (run `/config-truth` first — check the deployed VALUE, not just presence). This is the whole reason no digest has ever sent.
- [ ] **Day 1b:** Widen `composeDeskDigest` (`apps/web/src/lib/services/act-desk-digest.ts:48`) to read `act_grant_recommendations_current` across in-scope project codes as a SECOND source alongside `getGoodsGrantsTriage`. ~1 day. Without this the digest is Goods-only.
- [ ] **Day 1c (2 strings):** add `ACT-PI` and `ACT-MY` to `ACT_PROJECT_CODES` at `apps/web/src/app/home/page.tsx:435`. Surfaces 322 already-computed recommendations currently on no surface.
- [ ] **Day 1d (calendar, not code):** FRRR Strengthening Rural Communities Small & Vital Round 30 for Mounty Yarns. **Closes 2026-09-17.** Highest-scoring recommendation the system has ever produced, never shown to a person.
- [ ] **Day 2:** INSERT the 12 orphan projects into `act_grant_recommendation_projects`. Verified codes that already exist in `projects`: ACT-OO, ACT-MM, ACT-MN, ACT-SM, ACT-JP, ACT-BB, ACT-BG, ACT-CE, ACT-CM, ACT-CT, ACT-DG, ACT-DL. Ben supplies theme keywords. Picked up on next nightly refresh, no deploy.
- [ ] **Day 3:** read-only Notion board mirror into `notion_board_rows` + "Overdue and stale" section. Does not touch spec #162.
- [ ] **Day 4:** `v_act_real_grantmakers` view (ACNC screen + `ben_other_charities`) and the relationship lane.
- [ ] **Day 5:** reclassify the 6,626 award rows to `historical_award`; archive the 4 dead Notion syncs (Tier 3, needs Ben's verb).
- [ ] **Board hygiene, still outstanding, none touched:** FRRR SRC row budgeted at $50k when the leverage tier looks restricted to Carwarp VIC; NIAA RJED row dated 4 Sep when Round 3 closed 7 April; 15 past-due Active rows; 54 grants with `Grant` checkbox unticked.
- [ ] Land `thoughts/` files on a branch (SAFE lane per Landing Policy — branch, push, PR, auto-merge on green). NOT yet done.

### Decisions
- **Closing the Gap Rd 3 logged with `Grant` checkbox OFF.** ACCHOs are the only eligible applicants; ACT is ineligible. It is on the board as a Buyer / pre-purchase row because the $180M funds staff housing that then needs fitting out. Rationale: a buyer list is more valuable to Goods than a grant we cannot enter.
- **National Justice Reinvestment has no Due date, deliberately.** It is not a round. A fake date would have added a 16th past-due row.
- **Mazda ($400k) and Flora & Frank Leith ($290k) have EMPTY Amount fields.** Those CivicGraph figures look like total pools, not grant caps, and a wrong Amount feeds the board's `Weighted value` formula. Figures recorded in `Amount signal` with the warning.
- **Two CivicGraph records deliberately NOT added:** "Youth Justice Intervention Grants $150k" (no URL, no description, `ghl_sync` placeholder) and "Indigenous Cultural Preservation Grant / Philanthropy Australia" (its description is the ILA Program, already on the board under Office for the Arts).
- **Use $916M / 724 funders, never $3.84bn.** The big screen counts 2,008 charities that fund only HUMAN beneficiaries (scholarships, hardship, intra-group remittance) which ACT cannot enter. Top 10 of the 724 are 40.7% of the $916M; 589 give under $1M/yr.
- **Royalty trusts are a PARTNERSHIP lane, not an application lane.** Yajilarra, Nyiyaparli, Gumala, PKKP, Noongar Boodja, Groote Eylandt, Centrecorp all have `ben_other_charities = false`. Only ALFA (NT) $14.1M and Karrkad-Kanjdji $1.45M are `true`, both Arnhem Land, both directly approachable for Maningrida and neither on the board.
- **Do NOT delete `scripts/lib/goods-relevance.mjs`** until `goods-grants-triage.ts` is rewired. The digest ranks on `goods_relevance_score`; deleting the scorer freezes the ranking column. (The synthesis had it on the delete list; the critic caught the contradiction.)
- **Freshness must be measured on the INGEST timestamp, never the matview.** `alma_funding_opportunities.max(created_at)` was frozen 8 days while the nightly MV refresh reported green.
- **Reject as ranking inputs:** `foundations.total_giving_annual` (9,183 of 10,190 non-null values are exactly 25000/100000/500000 — every existing funder ranking sorts on a placeholder); `state_tenders` as a tender feed (`closing_date` null on all 199,719 rows); `political_donations` -> foundation crosswalk (`donation_to` holds political parties).

### Open Questions
- **UNCONFIRMED / BLOCKING: Is Mounty Yarns Mount Isa or Mount Druitt?** `act_grant_recommendation_projects` for ACT-MY has `home_states='QLD'` and `theme_keywords` = `mount isa, north queensland, regional partnership, transport`, notes say "especially around Mount Isa". If it is Mount Druitt NSW the whole keyword list is wrong, not one field. Blocks trusting 54 recommendations.
- **UNCONFIRMED: reopen issue #162, or leave the board hand-keyed?** `docs/specs/grants-notion-handoff-spec.md` (2026-08-06) rules nothing lands in Notion automatically, to avoid "a graveyard of stubs". Everything in Next above respects it. Machine-written board rows would reverse a live decision.
- **UNCONFIRMED: start Supply Nation certification for Goods on Country?** In `social_enterprises` it is `source_primary='self-registered'`, `verification_tier='identified'`. Not certified. Certification unlocks the $7.43bn IPP lane. Highest-leverage non-build action in the whole review.
- **UNCONFIRMED: should `act-auto-pass-stale-pipeline()` keep running?** It auto-passes unread recommendations and `tr_passed` then suppresses that funder for that project at 2+ passes. 62 suppressions already exist. A radar feeding it progressively blinds itself.
- **UNCONFIRMED (agent-reported, not re-run by me):** every DB figure in the findings doc carries its own [V]/[V-prior] tag from the agent that made it. I did not personally re-run them. Re-verify before quoting externally.

### Workflow State
pattern: multi-phase fan-out with adversarial verification (Workflow tool)
phase: 6
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "where more $ and philanthropy identification can be, and better ways to always have up to date opportunities notified to us"
- resource_allocation: aggressive (ultracode, 48 agents, 6.48M tokens)

#### Unknowns
- mounty_yarns_location: UNKNOWN (Mount Isa vs Mount Druitt)
- issue_162_reopen: UNKNOWN
- supply_nation_certification: UNKNOWN
- auto_pass_should_stand: UNKNOWN

#### Last Failure
2 of 48 agents died to API connection errors: `design:relevance-engine` and `judge:notion-native:does-it-actually-reach-ben`. The relevance-engine design was therefore never judged. Resume with `Workflow({scriptPath: '<session>/workflows/scripts/act-money-radar-wf_385288f4-fb2.js', resumeFromRunId: 'wf_385288f4-fb2'})` if that fourth design is wanted.

---

## Context

### The single most important finding

**Not one funding notification has ever reached a human, by any channel, in this project's
history.** Five lanes, all verified by agents this session:

| Lane | State |
|---|---|
| `grant_notification_outbox` | 771 rows, 0 sent, `max(attempt_count)=0` |
| `deliver-grant-notifications` | the only queue drainer. 0 rows in `agent_runs`. Never executed once. Not scheduled anywhere |
| `digest_log` | 0 rows. `/api/cron/desk-digest` 500s since it shipped 2026-08-06 |
| `funding_weekly_cycles` | 4 rows, all `delivery_status:'in_app'` (hardcoded literal). Route has no send step |
| `procurement_alerts` | 53,223 rows, all unread. `procurement_notification_channels` = 0 |

Plus two crons in neither `vercel.json` nor pg_cron, found only in `agent_runs`:
`vercel-cron:system/alerts/deliver` failed 11 of 11 consecutive daily runs 18-28 Aug; and
`vercel-cron:contained/daily-digest` succeeds daily with `items_found=0` (a confident zero,
which CLAUDE.md names as the tell).

**Green means nothing here.** `send-grant-alert-digests` reported success 17 times having sent
zero digests. And the one script with an unbroken green record,
`act-global-infrastructure/scripts/post-brief-to-notion.mjs`, checks `response.ok` on NO fetch
(lines 51-75, 77-94), so it prints success and exits 0 on a 401. Copy its shape, add the error
handling it lacks.

### The sharpest constraint

**ACT's four ABNs return zero rows across `grantconnect_awards`, `austender_contracts` and
`justice_funding`.** There is no public track record for a funder's due diligence to find. That
is why 8 of the 10 orphaned projects route through a partner who does have one (subcontract
invoiced by ACT Pty), not through an application.

### Full detail

`thoughts/shared/findings/act-funding-radar-2026-08-29.md` — synthesis + completeness critic
verbatim. **Where they conflict the critic wins**; it verified, the synthesis had not.

Artifact (formatted, shareable): https://claude.ai/code/artifact/fb3b27ad-d1d6-4e90-93d2-9ee699be2377

Raw per-agent returns, if the findings doc is ever insufficient:
`~/.claude/projects/-Users-benknight-Code-grantscope/74044c90-bfef-4258-a3d6-04c663a30c40/subagents/workflows/wf_385288f4-fb2/journal.jsonl`
(session-scoped — will not survive indefinitely; the findings doc is the durable copy).
