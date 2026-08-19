---
date: 2026-08-19T08:05:00Z
session_name: place-capital
branch: fix/314-refresh-tiers
status: active
---

# Work Stream: place-capital

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-19T08:05:00Z
**Goal:** A buildable spec for what a community organisation uses to see, then capture, the
capital moving through its place. Map #303 is the vehicle; done when `/to-spec` can run.
**Branch:** `fix/314-refresh-tiers` (PR #316 open, CI running, watcher set to merge on green).
Main is at `6e619586` (PR #312 merged `83720ba6`, then PR #313 merged `6e619586`).
**Test:** `./scripts/precheck.sh` (tsc + 724 vitest). DB reads: `node --env-file=.env
scripts/gsql.mjs "..."` — always `cd /Users/benknight/Code/grantscope` first, cwd drifts.

### Now
[->] **#311 — talk to three place-based intermediaries.** HITL, Ben only. The single
assumption today produced that nobody has tested. It can invalidate #304 and everything
downstream, so it goes before #306/#307/#309. **Unchanged by the data-integrity detour below.**

[ ] **Tomorrow, one query:** did the five promoted matviews log a success in the 17:00 UTC
    nightly? Plan membership is not proof; the log is.
    `SELECT mv_name, max(finished_at) FROM mv_refresh_log WHERE status IN ('success',
    'success-fallback') AND mv_name IN ('act_grant_recommendations','mv_yj_report_acco_gap',
    'mv_yj_report_alma_type_counts','mv_yj_report_state_top_orgs',
    'mv_yj_report_unfunded_programs') GROUP BY 1;`

### This Session — data integrity (second half, after #312 landed)
- [x] **#290 CLOSED, applied.** 306 foundation self-loops deleted (**$98,694,338**), 157
      `gs_relationships` edges (**$34,636,088**). Backups `_backup_foundation_selfloops_20260819`
      and `_backup_gs_rel_foundation_selfloops_20260819`. Verified 0 remaining. PR #313 →
      `6e619586`. Guards live: `foundation_grantees_no_selfloop` (validated) and
      `gs_relationships_foundation_grantees_no_selfloop` (NOT VALID by design — 3.43M rows,
      validation scan exceeds the pooler timeout; enforced on write, which is the point).
- [x] **Producer identified and already dead.** `scripts/run-reviewability-backlog-batch.mjs`,
      deleted in the 2026-04-24 scope cut (last at `f187e12a`).
      `getGenericGrantOpportunityPipeline()` read a foundation's own `grant_opportunities` rows as
      grantee rows — an opportunity describes the funder, so the "grantee" came back as the funder.
      **Five LIVE writers can recreate the shape and none checked**, hence a constraint not five
      patches. Explicit skips added to the two bulk writers.
- [x] **#314 opened, then CORRECTED BY ME, then retitled.** PR #316 open.
- [x] **#315 opened** — self-loops in the other `gs_relationships` datasets are unmeasured.
- [x] **Five on_demand matviews promoted to nightly and APPLIED** (`UPDATE 5`, all five now in
      `mv_refresh_plan('nightly')`). Registry now nightly 61 / weekly 15 / on_demand 19 / retire 9.

### This Session
- [x] **ROGS double-count fixed and APPLIED** (#299 closed). 848 rows/$66.13bn → 368/$28.35bn.
      483 exact duplicates from the same PC table ingested twice on 2026-03-14. Per-lane series
      verified UNCHANGED (2024-25 detention $1,141M, conferencing $62M).
- [x] **Essay written** — `thoughts/shared/data-reflections/2026-08-19-what-the-capital-says.md`
      + provenance sidecar. Detention recurrent +93% in 9y; conferencing +5% (real-terms cut);
      capital $1,791M detention vs $20M conferencing.
- [x] **Place capture measured, view APPLIED.** `v_grant_place_capture` live: 85,898 awards,
      $33.75bn, 85.1% of awards / 59.6% of dollars captured in the delivery LGA.
- [x] **State cut:** 97.5% of awards, 96.8% of dollars stay in-state ($200.21bn).
      **The leak is entirely WITHIN states.**
- [x] **Delivery-location extraction scoped out with evidence.** Zero deliveryAddress/
      deliveryLocation across 100 live OCDS releases. Federal contracts do not record it.
- [x] **Spec #300** published (`ready-for-agent`), then corrected by comment.
- [x] **Map #303 charted.** #305, #308 (research) and #304 resolved. #311 split out.
- [x] **Memory updated** — new `solution_place_money_traps.md`; refined
      `project_remote_funding_intermediaries.md`.

### Next
- [ ] Confirm PR #316 merged; report SHA. Then the nightly-log check above.
- [ ] **#314 residue** — `health` is NULL on all 104 registry rows, no max-age anywhere, so
      staleness is still only findable by hand. Decide what a surface does when its matview is
      stale: serving it silently is current behaviour and is wrong. Disclose the as-of date.
- [ ] **Drop the 9 `retire`-tier matviews** — read by ZERO app code (one appears only in a doc
      comment in `clarity/nouns.ts`) yet still `enabled`. Destructive, needs its own ticket.
- [ ] **#315** — measure self-loops per `(dataset, relationship_type)`. The naive
      `GROUP BY dataset` over 3.43M rows times out; needs a partial index or a chunked scan.
- [ ] **#311** validate the intermediary payer (HITL, Ben).
- [ ] **#309** the first surface — now UNBLOCKED (304/305/308 all closed). Must fold in #304's
      `is_community_controlled` split constraint.
- [ ] **#306** how the four products compose. **#307** pilot place (see Open Questions).
- [ ] **#301** postcode_geo — needs the ABS SA3→LGA correspondence file, NOT a migration.
- [ ] Confirm PR #312 merged; report SHA.

### Decisions
- **Guard at the constraint, not at the writer.** #290 found five live scripts that could each
  recreate the bug. One dataset-scoped CHECK covers all five and anything written later; five
  patches would have drifted. `NOT VALID` is the right shape on a 3.43M-row table — enforcement on
  write is the whole point and a history scan will not finish inside the statement timeout.
- **`on_demand` is not a cadence, it is "nothing refreshes this".** A matview on that tier read by
  a live surface serves a number with no as-of date. Five were; they are now nightly. Check the
  tier before trusting any matview-derived figure.
- **The buyer wedge does not survive** a community-first product. 438 prospects, ZERO paying
  buyers after 10 weeks. `docs/strategy/buyer-wedge.md` marked PROVISIONAL, superseded on #303.
- **Infrastructure for everyone, a product for ONE named payer**, and the payer is a
  **place-based intermediary** (council, land council, regional body) buying to keep spend local.
- **Every capture figure carries an `is_community_controlled` split.** An intermediary's failure
  mode is "local" meaning the biggest business in town. Makes the substitution visible.
- **Segmentation is place-bounded + self-selecting, never scored.** #308 showed why: reserves
  invert (measured against expenses, so dormant orgs rank best).
- **Bankable = trading throughput, not balance sheet.** 5.1x revenue, 6x FTE, only 1.8x assets.
  **The bar is contract #1**; 11,431 of 12,479 community-controlled orgs have never won one.
- Out of scope, deliberately: governing a capital pool, the Goods/QBE raise, art as a product,
  contract delivery-location extraction.

### Open Questions
- **I raised a false alarm on #314 and corrected it — keep the lesson.** I inferred "the nightly
  refresh has stopped" from matview row counts moving UP after a manual refresh. The nightly had
  run fine (job 4, 18 Aug, 11m48s, all 56 nightly-tier MVs stamped). Two errors: the eight MVs I
  measured were weekly-/retire-tier and exactly as fresh as their tier says, and my query filtered
  `status='success'`, missing **264 `success-fallback` rows** — the non-concurrent retry path
  inside `refresh_civicgraph_mvs_run()`. **Always filter
  `status IN ('success','success-fallback')`.** And check the scheduler's own history before
  concluding a scheduler failed: the count moving the unexpected way was the signal my model was
  wrong, not the system.
- **Unverified: does the nightly actually refresh the five promoted MVs?** Plan membership is not
  proof. `act_grant_recommendations` is scheduled `use_concurrent=true` and my pre-flight refresh
  was non-concurrent, so that path is untested — it does have a unique index
  (`act_grant_recommendations_pk_idx`), and the proc falls back non-concurrently if it fails.
- **Unmeasured, NOT clean: self-loops in the rest of `gs_relationships`** (#315). The
  #290 constraint is dataset-scoped because the measuring query times out, not because other
  datasets were checked. Some relationship types may self-reference legitimately, so the verdict
  is per `(dataset, relationship_type)` — a blanket constraint could be wrong.
- **The #290 dollar delta per surface was never obtainable** and I did not fake one. The refresh
  that would have measured it also folded in unrelated tier-lag. Exact figure is the deletion
  itself: $98,694,338.
- **Palm Island Community Company already has an `org_profiles` row.** #307 is written as if no
  community has a relationship with this work. That premise is wrong and the ticket needs
  rewriting — the question is what we already owe someone already here. **Ben's call.**
- **UNCONFIRMED: does the intermediary payer exist?** Exactly the defect that killed the wedge.
  #311 is the test. Do not build until it reports.
- **UNCONFIRMED: extent of the postcode_geo SA3 defect.** Unknowable from inside the DB — only
  4 of 443 rows have a cross-checkable sibling. 4816→Croydon is the one proven case.
- The two research docs rode in on #312 because the second subagent branched off the first's
  branch, not main. Harmless, landed deliberately.

### Workflow State
pattern: wayfinder-map
phase: 2
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "what CivicGraph builds so a community can capture the capital moving through it"
- resource_allocation: balanced

#### Unknowns
- intermediary_payer_demand: UNKNOWN (#311)
- postcode_geo_sa3_extent: UNKNOWN (#301, needs external ABS source)

#### Last Failure
(none — PR #302 merged clean, both migrations applied and verified against prediction)

---

## Context

**Five numbers were wrong before they reached anything public today.** Each was caught by
checking a specific case, never by general care. This is the session's main lesson and it is
now in memory as `solution_place_money_traps.md`:

1. `delivery_postcode = 'Multiple'` (5,978 rows, $19.55bn) counted as off-site → cross-state read
   $17.79bn instead of $3.95bn, **wrong by 4.5x**.
2. `delivery_state` holds **318 distinct values** including comma-lists, `National`, `Overseas`.
3. `postcode_geo` is locality-grain — joining without dedupe inflated dollars ~5x.
4. `postcode_geo` 4816 = `Townsville - South` → LGA `Croydon`, ~900km away. Made Croydon QLD the
   worst-capturing LGA in Australia on Palm Island money.
5. Wangaratta's 8.3% capture = **Australian Rail Track Corporation, SA-registered, $940M,
   Inland Rail**. GOCs dominate any per-place ranking.

Plus: count-weighted and dollar-weighted versions of the same measure tell **opposite** stories.
Local capture falls monotonically by award count (86.8%→66.0% by remoteness) and has **no
gradient** by dollars (55.2% vs 68.1%). Show both or mislead.

**Also corrected:** the remote-intermediary framing is not supported at the top end. Largest
very-remote-delivered / city-received awards go to Santos, Lynas, Metso, Engie — corporate head
offices, not land councils. The *mechanism* is real and now quantified (registered-address
attribution moves 26.6%/35.6%/22.5% of Outer Regional/Remote/Very Remote dollars city-ward);
the *population* is mostly corporate.

**Key documents**
- `thoughts/shared/analysis/2026-08-19-grant-place-capture.md` — the measure + 4 corrections
- `thoughts/shared/analysis/2026-08-19-delivery-location-scoping.md` — why contracts are out
- `thoughts/shared/analysis/2026-08-19-what-is-showable.md` — per-lane geography (#305)
- `thoughts/shared/analysis/2026-08-19-what-bankable-means.md` — the two populations (#308)
- `thoughts/shared/data-reflections/2026-08-19-what-the-capital-says.md` — the essay
- Map #303; issues #300, #301, #306, #307, #309, #310, #311

**Before publishing the essay:** the Preston figures are unverified (CLES/Preston City Council
summaries agreeing with each other; the 4,500 jobs number needs the primary evaluation), and
"group conferencing is the lane with the evidence behind it" is asserted, not cited.
