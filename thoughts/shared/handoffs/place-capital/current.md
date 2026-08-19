---
date: 2026-08-19T11:45:00Z
session_name: place-capital
branch: main
status: active
---

# Work Stream: place-capital

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-19T11:45:00Z
**Goal:** A buildable spec for what a community organisation uses to see, then capture, the
capital moving through its place. Map #303 is the vehicle; done when `/to-spec` can run.
**Branch:** `main`, clean. Everything below is landed AND applied.
Main is at `4f8b6bce`. Today, 17 PRs. Data integrity: #313 `6e619586` · #316 `cbaf6933` ·
#317 `56d209ac` · #318 `41d724dc` · #320 `1aaa1f63` · #321 `1b1c8503` · #323 `de89a756` ·
#326 `7168a7e4`. Docs: #319 `4a34d0d6` · #325 `f28f138e` · #328 `799ae79d` · #329 `85accab8`.
Reports: #330 `1441a194` · #331 `665183ee` · #332 `af7e68f0` · #333 `4f8b6bce` · #334 (open).
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

### This Session — sixth: the reports were publishing things nobody computed

Started as "verify the copy change is live". Ended five layers down. **Every step was found by
LOADING THE PUBLIC PAGE, not by reading code** — nothing here was visible from the repo.

- [x] **#330 `1441a194` — rank funders, not communities (CARE E1).** An Aboriginal
      community-controlled org opening its own profile saw a red **"Funding Desert — Severe,
      ranked #N"** banner about its home. The score is built ENTIRELY from absence (no money flow,
      participants with no provider), so attributing it to funders is the accurate reading, not a
      euphemism. Six surfaces; public report is now "Where the Money Doesn't Go".
- [x] **#331 `665183ee` — reports refuse instead of printing zeros.**
      `/reports/power-concentration` was publicly serving **"0 Australian entities scored across 7
      public datasets… $0B of $0B"** dated that day, against 188K real rows.
      **THE DISCRIMINATOR:** a query that ran and matched nothing returns `data: []`; a client that
      never ran returns `data: null`. **`|| []` erases exactly that** and is why "no answer" became
      "an answer of zero".
- [x] **#332 `af7e68f0` — stopped choosing a database by reading a stack trace.**
      `getServiceSupabase()` called `new Error().stack` and swapped in an empty client if it
      matched `/app/reports/`. Bundling-dependent, invisible at the call site, and it caught
      INDIRECT callers including `app/layout.tsx`. Replaced with a build-failing convention test.
- [x] **#333 `4f8b6bce` — stopped publishing invented scores about NAMED foundations. VERIFIED
      LIVE.** `/reports/philanthropy` listed **Paul Ramsay Foundation** ($210.0M, 240 grantees) and
      **Minderoo Foundation** ($268.0M, 180 grantees) under **"Largest Foundations With Zero
      Transparency"**, with invented transparency/evidence/need-alignment scores — under a full
      Methodology section describing how they were computed. Source: `buildSnapshotData()`,
      `foundation_id: 'snapshot-prf'`, `acnc_abn: ''`. The two funders named as approach targets in
      the Custodian Pathways conversation.
- [x] **#334 (open) — aggregates were ranked as grants.** `/reports/youth-justice` led its "top
      grant recipients" with **Department of Youth Justice and Victim Support, QLD: 67 grants,
      $11,397,825,690** — a department with **ZERO `measure_kind='grant'` rows**. Also fixed
      `getTopOrgs`, whose hand-rolled name-prefix blocklist let **Territory Families (NT) $2,273.2M
      and Community Services Directorate (ACT) $688.6M** through (96 rows, all aggregates) because
      their names don't start with "Department of".

### This Session — fifth: entity identity, and a real person's name on 45 contracts

- [x] **#326 MERGED `7168a7e4` — one validated `makeGsId`, because there were SEVEN.**
      `scripts/lib/gs-id.mjs` + 8 tests. Real ATO checksum; an invalid ABN now falls through
      instead of minting an entity. Killed the old `'AU-UNK-' + Date.now()` fallback (latent, never
      fired, but a guaranteed duplicate generator). Only `build-entity-graph` is wired;
      **six copies remain**: resolve-donor-entities, import-lobbying-register,
      import-modern-slavery, ingest-ndis-providers, backfill-qgip-abns, link-entities-mega.
- [x] **SENTINEL BLACK HOLES FOUND — the worst defect of the day.**
      `AU-ABN-0` = "112 Trenerry Crescent Pty Ltd" holds **53,109 edges**. Also
      `AU-ABN-Exempt-NonAustralianEntity` = "Michael John Hayter" (181),
      `AU-ABN-Notapplicable` = "ATLASSIAN" (109),
      `AU-ABN-Exempt-InsufficientTurnover` = "Karen Mary Knight" (45).
      Every record whose ABN field held a sentinel collapsed onto one id, which took the name of
      whichever record landed first. **~53,400 edges attributed to parties that had nothing to do
      with them, including two real named individuals.** They rank ~56,133rd in
      `mv_entity_power_index`, so no leaderboard is distorted; the harm is in per-entity lookups.
- [x] **The people are RECOVERABLE — dry run done, nothing written.** The sentinel destroyed the
      link, not the record: 100% of trapped edges carry `source_record_id` and join back to source.
      53,064 of 53,109 are `aec_donations` → `political_donations`. Resolution:
      **677 parties/32,295 edges → new AU-NAME · 71/14,035 → existing entity WITH ABN ·
      345/5,502 → valid source ABN · 9/1,232 → existing, no ABN.** Two thirds of edge volume
      returns to a real existing entity. `Australian Greens` converges from both variants.
- [x] **Ben's call: ABN is canonical for government bodies.** Correct, but it settles only
      **59 of 836** pairs. By PAIRS the dominant case is **ABN → ABN (718)**; by EDGES the
      government cases dominate (34,532 of 45,220). Both true, different questions.
- [x] **A blanket merge would be WRONG.** `ERNST and YOUNG` vs `ERNST & YOUNG` have different ABNs
      and are separate legal entities; same for PwC. The 836-pair list is EVIDENCE, not a merge
      instruction.

### This Session — fourth: the integrity thread, and $36bn

Started as "measure self-loops in the other datasets" (#315). Ended four corrections later at a
resolver defect. **Read the corrections, not just the conclusions — three of the four wrong answers
were confident and specific.**

- [x] **#315 CLOSED in substance.** `austender` has **595 self-loops worth $810.5M** and they are
      **FAITHFUL TO THE REGISTER, not a bug**: AusTender publishes internal Defence project codes
      (e.g. `AIR7000 P8 POSEIDON`) with **Defence's own ABN 68706814312** in the supplier field.
      **Exclude at read time, do NOT delete.** `justice_funding`, `person_roles`,
      `person_roles_crossmatch`, `acnc_register` are all **0, clean**.
      **This retrospectively justifies scoping #290's constraint to `foundation_grantees`** — a
      global self-loop ban would have refused legitimate rows.
- [x] **#322/#323 APPLIED — 71,166 duplicate rows, $36.03bn removed.** Largest correction in the
      project's history (cf. ROGS $37.8bn, foundation $304M). Per dataset: austender 35,326 rows /
      **$28.46bn** · aec_donations 29,347 / $2.32bn · grant_opportunities 5,761 / $3.86bn ·
      grantconnect_awards 552 / $1.38bn. `_backup_gs_rel_dupes_20260819` holds every deleted row.
      New partial index `gs_relationships_dataset_source_record_uniq (dataset, source_record_id)`.
- [x] **#324 OPENED — the actual cause, and it is bigger.** The duplicates were NOT re-inserts.
      `idx_gs_rel_dedup` already existed and already blocked those. The rows **differed**:
      45,220 in `source_entity_id`, 21,319 in `target_entity_id`, 5,483 in `relationship_type`.
      **`makeGsId()` mints `AU-ABN-<abn>` when a source row carries an ABN and `AU-GOV-<buyer_id>`
      when it does not, so ONE government body becomes TWO entities.** 1,891 AU-GOV entities,
      only **78 have an ABN**. Department of Defence is the visible case.
- [x] **Dedupe direction was verified, not assumed.** Kept-row-has-ABN vs deleted: **19,488 to 29**
      on the target side, **34,647 to 123** on the source side. Later runs resolved to WORSE
      entities. Keeping the earliest was right.
- [x] **CI + tooling:** #318 E2E hang (Azure apt mirror, not a lock), #320 ship-watch stale-check
      guard, #321 watcher timeout 30min → 10min. Pipelines now ~230s.

### This Session — third half: place data, CI, and the Custodian Ledger
- [x] **#301 SA3 defect measured, repaired, APPLIED.** The ticket said it was blocked on
      downloading the ABS SA3-to-LGA correspondence file. **It was never blocked.**
      `abs_poa_lga_ratio` was already loaded (3,968 rows / 2,641 postcodes) and is a BETTER
      instrument — postcode straight to LGA with a population ratio, no SA3 hop. Covers 435 of 451.
      **Check the warehouse before declaring a task blocked on an external file.**
- [x] **133 of 451 postcodes were wrong** (not 4, and not the "6 of 12" I sampled — 29%).
      87 dominant-but-wrong, 46 genuinely split AND disagreeing. **Every one of the 46 disagrees
      and not one agrees** — systematic, so those were unplaced not corrected.
      **9,101 entities re-placed, 5,741 unplaced, zero postcodes still disagree with ABS.**
      Nerang→Gold Coast, Dubbo South→Dubbo, Kirwan→Townsville, Chatswood East→Willoughby.
- [x] **Palm Island fixed and place-cut run.** 21 entities (14 community-controlled), and only
      **4 receive anything**. The Shire Council takes **96.7%** ($18.16M of $18.78M). Bwgcolman
      Arts, Community Justice Group, Community Store, Rodeo, Boxing, Coolgaree: all $0.
      Federal contracts to the WHOLE island: 10 contracts, **$0.67M**.
- [x] **Young Guns Container Crew (ABN 51116945807)** — QLD social enterprise, community-controlled:
      **$0 justice funding, one $63.36M Home Affairs contract** (2026-06-30→2031-06-29, ~$12.7M/yr).
      The whole custodian-economics thesis in one row. Caveat: one contract, opaque title.
- [x] **QLD youth justice measured:** $915.6M / 4,056 grants / 1,235 recipients.
      Community-controlled **10.5% of dollars (floor; ceiling 18.9%** — 311 grants / $76.7M never
      matched an entity). Detention 2024-25 alone: $298M recurrent + $483.8M capital.
- [x] **CI E2E hang diagnosed and fixed** (#318). Not the tests — the job never reached them.
- [x] **The Custodian Ledger published** (artifact, private):
      https://claude.ai/code/artifact/53ee6cf7-b780-47be-a4c4-d082e3d82c5a

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
- [ ] **`report-service.ts`: 22 money-summing functions, ONE filtered.** 32 functions touch
      `justice_funding`; only `getYouthJusticeGrants` (fixed today) references `measure_kind`.
      `justice-money.ts` exports `GRANT_FILTER_SQL` for exactly this and the file never imports it.
      **This is ~20 per-function JUDGEMENT calls, not a sweep** — `getRogsExpenditure`,
      `getBudgetTotals`, `getQgipExpenditureByYear` legitimately want aggregates; `getProgramRecipients`,
      `getAccoFundingGap`, `getCrossDomainOrgs`, `getFundingByLga` do not. Sweeping would replace
      one silent error with another.
- [ ] **The 61 report pages have nothing to read.** There is NO snapshot database —
      `getReportSnapshotSupabase()` is a stub returning `{data:null,error:null}` — and
      `CIVICGRAPH_LIVE_REPORTS` is not `true` in production. After #331 they fail honestly instead
      of inventing, but "honestly blank" is not a product. Turning the flag on switches 61 public
      pages to live queries at once; do it awake.
- [ ] **`/reports/youth-justice` snapshot needs dating and labelling.** Its recipient figures are
      REAL (Lifeline $30,136,777 matches the DB exactly) but are silently substituted per-section
      with no marker and no capture date.
- [ ] **The sentinel repair (#324).** Three things, not one: create ~677 entities, remap 53,109
      edges, repeat for `justice_funding` (40) and `lobbying_register_nsw` (5).
      **Needs a fresh session — write-heavy.** Two traps, both learned the hard way today:
      **resolve from the SOURCE row, never the surviving edge** (the surviving edge is what is
      wrong), and **no correlated `EXISTS` against `gs_entities`** — it times out; use a LEFT JOIN
      with the aggregation pushed up.
- [ ] **Name-normalise BEFORE minting the 677.** `HSU - Health Services Union` vs
      `Health Services Union` must not become two entities — that is the same duplication bug in a
      new costume.
- [ ] **Migrate the six remaining `makeGsId` copies** to `scripts/lib/gs-id.mjs`.
- [ ] **The 5,855 kept-wrong edges from #323**, of which Saxonvale's 2,959 are corrected as a side
      effect of the sentinel repair.
- [ ] **#324 — decide scope BEFORE starting.** It touches the core of the graph. A query for
      "everything Defence bought" currently hits one of two entities and silently misses the
      other's edges; `mv_entity_power_index` and `mv_revolving_door` split one org across two rows.
- [ ] **#315's remaining half:** build the austender self-loop exclusion predicate alongside
      `isRealRecipient()`/`themeMoney()` in `apps/web/src/lib/justice-money.ts`, and audit which
      surfaces need it.
- [ ] **Do NOT "make ingests upsert."** I proposed it and it is wrong — it would silently overwrite
      a good entity resolution with a worse one on every run. #324 is the real fix.
- [ ] **Every matview figure is stale until tonight's 17:00 UTC nightly** — the $36bn came out of
      the base table after the MVs were last built.
- [ ] **ship-watch merges on STALE checks.** #317 merged in 5s with Type Check and Unit still
      `pending`: `gh pr update-branch` made a new commit and a new run, and the watcher read the
      PREVIOUS run's green. #316 was fine only by luck of timing. **Fix: require the check run's
      commit SHA to match the PR head before treating green as green.** The landing policy leans
      on this watcher for every SAFE merge.
- [ ] **The registered-address problem** — Palm Island Community Company Ltd holds $8.7M (12th
      largest in the QLD table) and books to **Townsville**, because its registered postcode is
      4810. Fixing council codes does nothing for this. It is #304's intermediary question showing
      up on the exact community in the conversation, and it is a bigger distortion than Croydon was.
- [ ] **16 postcodes still have no ABS ratio row**, and 298 were already correct. #301 can close
      once the 16 are dispositioned.
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
- **I called a deploy broken THREE times today when it was merely building.** "Nothing ran on the
  night of 18-19 Aug" (the nightly had run), the funding-deserts headline (deploy started 17s
  earlier), and "merges are not reaching production" (the build was `state: BUILDING`). Each time I
  read a stale live surface and reached for a failure explanation instead of a timing one.
  **Check `list_deployments` before concluding a pipeline is broken.**
- **Vercel CANCELS an in-flight production build when a newer merge lands.** Three today
  (`85accab8`, `799ae79d`, `1d4145c0`). Harmless when changes are cumulative, but it means **some
  merged SHAs never built at all** — do not claim "version X was live" without checking.
- **Preview URLs are behind Vercel SSO.** The landing policy's SEEN gate assumes Ben can open a
  link; anyone else gets a login page. A preview handed to a third party is a dead end.
- **The 718 ABN→ABN pairs need a human call each, and must not be automated.** Three different
  things are mixed in there: sentinel black holes, whitespace variants of the SAME ABN (5
  entities, fixed forward by #326), and genuinely distinct legal entities (EY, PwC).
- **Where did blank become `0`?** Most trapped donors have an EMPTY `donor_abn` in
  `political_donations`, not `'0'`. Something coerced blank to zero on the way into the graph.
  Not found; #326 makes it harmless going forward but the coercion is still there.
- **FIVE wrong answers today, in one thread.** Added to the four already recorded: "the merge map
  is GOV→ABN" — it is 7% of pairs. **Every one came from reporting before checking the mechanism
  against its source.** The $31.2bn phantom was the closest call. A large alarming number is the
  moment to slow down, not speed up.
- **FOUR wrong answers in one thread today. The pattern is the lesson.** In order:
  (1) "the nightly refresh has stopped" — it had not;
  (2) "the E2E hang is a dpkg lock" — it was the Azure apt mirror, a network stall;
  (3) **"$31.2bn of duplication in aec_donations"** — phantom. Grouping on
  `(source,target,type,year,amount)` is NOT a duplicate test: the source genuinely holds 374
  distinct Brisbane City Council → ALP(Qld) receipts at $2,498, verified 374-for-374;
  (4) "there is no distinguishing key so this is unmeasurable" — `source_record_id` is a real
  column, **100% populated**, found by reading `properties` instead of `information_schema`.
  **Common fault: inferring schema and mechanism from data instead of reading the definition.**
  CLAUDE.md Rule #2 and the context-efficiency rule both say to check `information_schema` first.
- **Unverified: the 29 + 123 cases where the DISCARDED row held the ABN.** Small, recoverable from
  the backup, worth revisiting during #324's merge.
- **Unverified: was `grant_opportunities` duplication ever noticed?** 5,761 rows / $3.86bn came out
  and that dataset was not in any prior audit. Nothing was looking at it.
- **I was wrong twice today and both corrections were worth more than the original claim.**
  (1) "The nightly refresh has stopped" — it had not; see below. (2) "The E2E hang is a dpkg lock
  or an interactive prompt" — it is not. The log, once a timeout made it readable, is hundreds of
  `Ign: http://azure.archive.ubuntu.com` lines then five minutes of dead air. A network stall.
  `DEBIAN_FRONTEND` was never going to help. **The timeout did not fix the bug, it made the bug
  legible** — that is the reusable lesson.
- **Unverified: is `--with-deps` actually unnecessary?** #318 dropped it on the reasoning that
  ubuntu-latest ships Playwright's chromium libraries. One green run (232s) is not proof across
  runner-image changes. If chromium ever fails to launch with a missing-library error, that is why.
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
