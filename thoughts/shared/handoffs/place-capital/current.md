---
date: 2026-08-19T07:05:00Z
session_name: place-capital
branch: map/304-who-pays
status: active
---

# Work Stream: place-capital

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-19T07:05:00Z
**Goal:** A buildable spec for what a community organisation uses to see, then capture, the
capital moving through its place. Map #303 is the vehicle; done when `/to-spec` can run.
**Branch:** `map/304-who-pays` (PR #312 open, CI running, watcher set to merge on green).
Main is at `9164f08d` (PR #302 merged).
**Test:** `./scripts/precheck.sh` (tsc + 724 vitest). DB reads: `node --env-file=.env
scripts/gsql.mjs "..."` — always `cd /Users/benknight/Code/grantscope` first, cwd drifts.

### Now
[->] **#311 — talk to three place-based intermediaries.** HITL, Ben only. The single
assumption today produced that nobody has tested. It can invalidate #304 and everything
downstream, so it goes before #306/#307/#309.

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
- [ ] **#311** validate the intermediary payer (HITL, Ben).
- [ ] **#309** the first surface — now UNBLOCKED (304/305/308 all closed). Must fold in #304's
      `is_community_controlled` split constraint.
- [ ] **#306** how the four products compose. **#307** pilot place (see Open Questions).
- [ ] **#301** postcode_geo — needs the ABS SA3→LGA correspondence file, NOT a migration.
- [ ] Confirm PR #312 merged; report SHA.

### Decisions
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
