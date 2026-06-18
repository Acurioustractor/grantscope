---
date: 2026-06-18T00:00:00+10:00
session_name: agent-health-resilience
branch: main
status: active
---

# Work Stream: entity-graph data health (was: agent-health-resilience)

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-19 (PM #2) — **PERSON DISAMBIGUATION SHIPPED end-to-end (leaderboard now disambiguated) — the "real fix" for the homonym megamerges (was the DATA-QUALITY GATE next-OP below).** Reframe found by reproduction: the ranking-head megamerges are **trustee-company NOMINEE BLOCKS, not homonyms** — one trustee firm's officers listed as responsible persons on hundreds of "The Trustee For X" charities (Mark Smith 714 boards = 689 one NSW/2034 block + 23 real people; Jodi Kennedy 745 = 740 VIC/3001 block + 5). `appointment_date` ~0% / `cessation_date` 0% → **temporal signal dead**; `person_entity_id` is name-keyed (= the megamerge, not an identity key). Approach: per-name co-director graph + union-find (block-officer ≥10-board glue + ≥2-shared-codirector corroboration; nominee = size≥20 + dominant officer + dominant STATE). **SHIPPED THIS SESSION:** (1) read-only gate `scripts/person-disambig-probe.mjs` + shared core `scripts/lib/person-cluster.mjs` → **PR #92 (open)**; (2) **APPLIED TO PROD (explicit auth):** `person_identities` table + 15,809 rows for the 79 names with board_count>50 → **549 identities, 65 nominee blocks** (`scripts/build-person-identities.mjs --apply`; dry-run default). **Nothing reads it yet → leaderboards UNCHANGED**; undo = `DROP TABLE person_identities`. (3) **APPLIED TO PROD (Ben said "apply", 2026-06-19 PM):** MV re-point migration `supabase/migrations/20260619130000_person_identity_mvs.sql` → `mv_person_identity_network` (328,939 rows) + `mv_person_identity_influence` (**237,815 identities, 65 nominee blocks**) ALONGSIDE untouched name-keyed originals; refresh wired into `refresh-views-v2.mjs` (network→influence; +HEAVY). (4) **APP RE-POINTED → MERGED (PR #94 → `fd994f6`):** `api/data/person` leaderboard mode now reads `mv_person_identity_influence WHERE NOT is_nominee_block` (board-count cap kept as backstop for un-split 11-50-board names; `influence_score AS max_influence_score`; dropped unused `data_sources`). Search/profile modes deliberately stay name-keyed (profile-by-name → multiple identities = picker-UI follow-up). Verified live: leaderboard top rows real people (Claire Rogers, Brendan Murphy…), board counts 4–9, NO megamerge; Mark's 689 block flagged+excluded, SA $3.45M + QLD $155k surface as distinct board_count=1 identities. tsc clean. **BOTH MERGED 2026-06-19** (#92 gate → `cfac736`, #94 → `fd994f6`). **NEXT (follow-ups):** profile disambiguation-picker UI → extend disambiguation below the 50-board threshold then DROP the `MAX_PLAUSIBLE_BOARDS` cap. Memory: [[project_person_disambiguation]]. — Prior session: people-leaderboard guard+re-rank #90/#91 (`9942c11`); read-only exec_sql restore #91; bridge rewrite #89. Graph ~605,900 entities · 2,370,061 edges.
**Goal:** Make the CivicGraph relationship graph correct, fast, and self-monitoring. Diagnose by REPRODUCTION (never assumption); every fix validated live before claiming done.
**Branch:** ALL MERGED to `main` (now **`fd994f6`**). PR **#92** (read-only gate) → `cfac736`; PR **#94** (migration + re-point; replaced #93, which GitHub auto-closed when `--delete-branch` on #92 removed its stacked base) → `fd994f6`. Branches deleted, local main synced & clean. person_identities table + identity-keyed MVs LIVE in prod; leaderboard reads them. CI green, tsc clean.
**Test:** `node --check scripts/build-entity-graph.mjs` · dry-run a phase (`--phase=X --dry-run`) · `node --env-file=.env scripts/check-graph-completeness.mjs` (the gate) · reproduce/validate live before claiming done.

### Now — DONE + MERGED this session (PR #89, squash `3b8568d`).
[x] **Converted both bridge agents' WRITE paths to set-based psql** — re-runnable, additive, recovered the dropped edges. Files changed (merged to `main`):
- **`scripts/lib/graph-edge-datasets.mjs`** — added `justice_funding` dataset entry (read-only `jf_prog_map` prelude + canonical edge SELECT) and two write-side exports: `JUSTICE_PROGRAM_ENSURE_SQL` (creates missing `program` entities) + `JUSTICE_BUILD_GUARD` (`NOT EXISTS` additive guard, write-only).
- **`scripts/build-entity-graph.mjs`** — new `--phase=justice` (program-ensure → guarded set-based edge insert). Included in `all`.
- **`scripts/bridge-justice-to-graph.mjs`** — rewritten as a thin set-based psql agent sharing the SoT. `--dry-run` counts; live = program-ensure + guarded `INSERT…ON CONFLICT DO NOTHING`. (Old REST `.upsert` couldn't match the COALESCE-expr index → 0 written: the [[feedback_postgrest_partial_index_upsert]] mode.)
- **`scripts/bridge-person-roles.mjs`** — rewritten set-based, 3 steps (person entities → edges → `person_roles` backfill), all `ON CONFLICT DO NOTHING` / idempotent UPDATE. `--apply` to write.
- **Why the justice guard:** the program-node layer is historically split (old `GS-PROG-<slug60>-<state>` + new `<slug80>-<md5x4>-<state>` + slug collisions); 55,811 of 56,630 existing edges sit on OLD-format nodes, so NO clean (name,state)→node map matches them all. The `NOT EXISTS (payment already edged)` guard makes the WRITE touch only un-edged payments → 0 new dups, fully re-runnable. The gate measures the FULL derivation (bare selectSql); only the write appends the guard. Person needs no guard (single gs_id format → gs_id join lands on the existing nodes; `ON CONFLICT` dedups the 5,086).
- **Results (live):** justice +81,493 (gate justice now **138,055 exp / 138,123 act / OK**); person +329,896 (dir 113,419 + member_of 221,563), 333,836 backfilled, 87 residual unlinked (empty-slug/unmatched-ABN). Total edges 2,370,061.
- **Gate coverage:** justice_funding now watched (was on the gap list). Person NOT gated (would need 2 entries dir+member_of — follow-up). grant_opportunities/foundations still STALE (pre-existing legacy; separate clean-rebuild).

### Follow-on this session (post-merge: MV refresh → leverage → polish)
- [x] **All 38 MVs refreshed** (`refresh-views-v2`, 38/38, 22.2 min) so the +411K edges propagated into the
  power/influence/interlock views (mv_board_interlocks, mv_person_influence, mv_revolving_door,
  mv_entity_power_index, mv_person_entity_network — now reflect the dense people layer).
- [x] **`/leverage` iter 9 (docs/leverage-map.md)** — the +330K person edges REVIVED the iter-2 person-facet
  dead lead. Added OP11–OP14 (all latent/green): OP11 "Connectors" screen surfacing mv_board_interlocks;
  OP13 supplier↔justice director bridges (5,509, best quadrant); OP12 shared supplier-directors (1,849);
  OP14 director-is-donor COI (1,222).
- [!] **KEY DATA-QUALITY FINDING — person homonym collisions.** Person entities are name-keyed
  (`GS-PERSON-<slug>`), so common names merge many people into one node: mv_board_interlocks head is poisoned
  (101 nodes >50 boards, e.g. "Mark Smith"=714; max board_seats 744). BUT **93.5% (37,164) sit at a plausible
  2–10 boards** — the long tail is real; only the ranking head is fake. Logged as the "DATA-QUALITY GATE" in
  the leverage map. Real fix = **person disambiguation** (ABN/co-occurrence) — a new high-value OP (a deepen).
- [x] **`/polish` collision guard — SHIPPED as PR #90** (`fix/people-leaderboard-homonym-guard`, commit
  `2b73ac7`; tsc clean, SQL-verified, NOT screen-verified). Capped the two ranked people leaderboards at
  `board_count/board_seats <= 10` (named const `MAX_PLAUSIBLE_BOARDS`) so megamerges stay off the default
  view: `apps/web/src/app/api/data/person/route.ts` (top-people query) +
  `apps/web/src/app/api/data/board-power/route.ts` (conditions). Search/profile modes left unchanged
  (intentional lookups). PR also carries the leverage-map iter-9 updates. Screen-verification deferred to
  the polish phase (NEXT #1).
- **Polish ranking note:** `max_influence_score` is board-count-dominated (everyone at cap ties ~214) — the
  leaderboard should really rank by cross-system MONEY/breadth, not seat count. Aesthetic-polish finding.

### NEXT (resume here):
1. [x] **Screen-verify the guard live** — DONE. gsql + live API + screenshot all confirm: default `/person`
   leaderboard shows board_count 9–10 only, NO Mark-Smith-714. (Required the PR #91 restore first — the page
   was 500ing.) Screenshot also confirmed NEXT #3's ranking problem (see below).
2. [x] **Merged PR #91 (exec_sql restore) then #90 (guard + re-rank)** — both squash-merged, branches
   deleted, main `9942c11`, restore confirmed preserved on main (5 markers, 0 old-blocked). DONE.
3. [x] **Ranking re-rank — DONE** (commit `3e236f4` on the #90 branch). The board-count tie (everyone at 214)
   is fixed: `/api/data/person` now orders by `financial_system_count DESC` (breadth) then total cross-system
   dollars (proc+justice+donations; total_contracts is a COUNT, excluded), exposes `total_money`; `/person`
   page swapped the constant "Influence" column for "Total $" + corrected the subtitle; `/power` Board Power
   Leaderboard sorts by `total_org_revenue` not capped `board_seats`. Verified data+API+screenshot — catherine
   taylor ($2.7B/3 systems) rose rank 9→4, seats now vary down the board. tsc clean.
3b. **Board-connectors guard NOT needed — VERIFIED** (gsql, 2026-06-19): `/api/power/accountability`
   board-connectors query is constrained to the top-100 power entities AND joins on `company_abn` (ABN-keyed,
   not name-keyed person nodes), so homonyms don't merge — actual max `board_count` = **2**. The earlier "still
   leaks megamerges" note was an unverified assumption; corrected. Only the two RANKED leaderboards were
   megamerge-prone, both guarded in #90. (Profile/search left uncapped by design — intentional lookups.)
3c. **Remaining NEXT-#3 nice-to-haves (not done, low pri):** (a) "ambiguous name — not disambiguated" flag on
   search/profile; (b) lowercase display names like "catherine taylor" (MV uses `min(person_name_display)`).
   Residual risk: money columns can still be homonym-inflated under 10 boards (real fix = NEXT #4 disambiguation).
4. [x] **New OP: person disambiguation — SHIPPED** (the real fix; split homonyms by trustee-nominee-block
   detection + co-director union-find). `person_identities` table + identity-keyed MVs live in prod; leaderboard
   re-pointed. **BOTH PRs MERGED to `main` 2026-06-19** (#92 gate → `cfac736`; #94 migration+re-point → `fd994f6`;
   #93 was auto-closed + superseded by #94). See Ledger block (3)/(4) above. Remaining tail:
   - **Profile disambiguation-picker UI** — `api/data/person` profile mode still name-keyed; one name now maps
     to multiple identities (e.g. Mark Smith → SA person / QLD person / nominee block). Needs a picker.
   - **Extend disambiguation below the 50-board threshold** (only >50-board names were split; the >10 tier =
     615 names), then **DROP `MAX_PLAUSIBLE_BOARDS`** from the leaderboard query (currently kept as a backstop).
5. **[BIG follow-up, tracked] Migrate 99 routes off string-SQL `exec_sql`** to typed Supabase reads / safe
   RPCs/views — the proper fix the `02213dd` block intended. PR #91 is the band-aid (read-only restore). This
   is the durable fix: removes the RLS-bypass + string-interpolation surface entirely. Large (99 files); scope
   per-section. The frontend inventory is `thoughts/shared/handoffs/frontend-data-audit/frontend-inventory.md`.
- **Git state:** ALL SHIPPED. #90 + #91 squash-merged to `main` (`9942c11`), both branches deleted, local
  main synced & clean. **Prod verified recovered** (5/5 data routes 200; guard + re-rank live). Only this
  ledger is uncommitted (working handoff; survives `/clear` — SessionStart reads the file).

### ▶ [COMPLETED 2026-06-19 PM #2] NEXT SESSION KICKOFF PROMPT (was: start NEXT #4 — person disambiguation)
<!-- Disambiguation is now SHIPPED (person_identities + identity MVs live, leaderboard re-pointed, PRs #92/#93).
     This prompt is kept for provenance only. Resume points are NEXT #4's remaining-tail bullets above. -->

> Resume the people/probity workstream on CivicGraph. The homonym GUARD + leaderboard re-rank shipped last
> session (PRs #90/#91 merged, main `9942c11`, prod verified). Now the REAL fix: **person disambiguation** —
> split name-collision megamerges into distinct real-person identities.
>
> **Problem:** person entities are name-keyed (`GS-PERSON-<slug>` / `mv_person_influence.person_name_normalised`),
> so common names merge many distinct people into one node ("Mark Smith" = 714 boards, "Jodi Kennedy" = 744).
> 93.5% (37,164) sit at a plausible 2–10 boards (real serial directors) — only the ranking head is fake. The
> guard (cap board_count ≤ 10 on ranked leaderboards) is a band-aid; money columns can still be homonym-inflated
> under 10 boards.
>
> **Data:** `person_roles` (ABN-keyed directorships: person_name, company_abn, appointment_date,
> cessation_date), `mv_person_entity_network` (person→entity + financial footprint), `mv_person_influence`
> (per-name aggregates), `gs_entities` (state/sector/postcode), `entity_identifiers` (any person ids).
>
> **Approach to evaluate (don't pre-commit):** cluster a name's connections into distinct people via
> co-occurrence — shared boards/entities, ABN/identifier linkage, tenure temporal overlap, geography,
> role/sector patterns. Likely a `scripts/` data-modeling job → stable person-identity key + confidence,
> materialised into new column(s)/table, then re-point the person MVs at it.
>
> **Guardrails:** additive/non-destructive (Ben's standing rule); verify by REPRODUCTION not assumption; build
> the verification gate BEFORE any scoring ([[feedback_data_quality_before_scoring]]); scope on ONE
> high-collision name first ("Mark Smith"), prove the split is correct, then generalise; don't break the shipped
> guard/leaderboards.
>
> **First step:** scope the data — distinct person_name count, board-count distribution, secondary-key coverage
> per role (ABN/dates/geography), and how separable "Mark Smith" is by co-occurrence. Report before designing.
>
> **Budget/stop/fallback (xhigh design task):** stop when you have a validated split approach proven on 1–2
> megamerge names + a written plan; do NOT run a repo-wide migration without Ben's go (separate ship). If no
> clean signal, return what IS vs ISN'T separable — don't force it.
>
> Context: this ledger; memory `[[project_build_entity_graph_setbased]]`, `[[solution_exec_sql_app_block]]`.
> Optional low-pri warm-ups: #3c (ambiguous-name flag, lowercase display names).

### Context for that task (verified this session)
- Only dedup index: `idx_gs_rel_dedup UNIQUE (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id,''::text))`. `gs_relationships_pkey` on `id`.
- justice agent program-entity creation DID work (2046 created); only the relationship write is broken.
- `bridge-justice-to-graph` runs LIVE by default (`--dry-run` to suppress); `bridge-person-roles` needs `--apply`.

**[history] Re-run surfaced a DEEPER write bug (the `.order()` fix is necessary-not-sufficient):** ran `bridge-justice-to-graph` live → **0 relationships created, 99,999 errors**, "no unique constraint matching ON CONFLICT". Root cause: PostgREST `.upsert({onConflict:'…,source_record_id'})` can't match the only dedup index `idx_gs_rel_dedup` which is on the EXPRESSION `COALESCE(source_record_id,'')` (the [[feedback_postgrest_partial_index_upsert]] failure mode). No data harmed (count still 56,630). `bridge-person-roles` has an analogous problem — plain `.insert()` (no onConflict) fails whole batches on existing-edge unique violations, so it can't cleanly re-run either (NOT run, deliberately). **Real fix = convert both write paths to set-based psql `INSERT…SELECT … ON CONFLICT (…COALESCE(source_record_id,'')…) DO NOTHING`** (the build-entity-graph pattern) — would recover ~20K justice + ~? person edges AND make both agents re-runnable. Natural to fold justice_funding into `graph-edge-datasets.mjs` + the gate at the same time. PR #88's `.order()` fixes still correct + mergeable (prerequisite for any recovery), just don't recover edges alone.

**Gate coverage gap (noted):** the completeness gate watches only the 4 build-entity-graph datasets (~1.44M of ~2.0M edges). The ~25 agent-built datasets (directorship 322K, shared_director 95K, justice grants 56K, the other grant/* + lobbies_for/member_of/affiliated_with) are NOT watched. Extending the gate to set-based-expressible ones (e.g. justice_funding) is a roadmap follow-up.

### Earlier today
[->] **PR #87 MERGED** (squash `a90dfa6`) — completeness gate live + scheduled. The gate's first run flagged grant_opportunities (+1,122) & foundations (+20) as STALE (over-built legacy rows) and donations/austender as sub-threshold over-built (+30K/+31K) → roadmap Phase 1 **clean-rebuild per dataset** is the natural next data op. Also: audit other relationship agents (#3) for the 1000-cap class; build the `/health` UI surface (roadmap Phase 2 #3 — gate already emits `--json`).

### Completeness gate (BUILT 2026-06-18, branch `feat/graph-completeness-gate`)
- **`scripts/lib/graph-edge-datasets.mjs`** — single source of truth for the 4 edge SELECTs; imported by BOTH `build-entity-graph` (inserts) and the check (counts) → expected can't drift from actual. Build's 4 phase fns are now thin wrappers; validated by per-phase `--dry-run` (SQL semantically identical, only key-col aliases added).
- **`scripts/check-graph-completeness.mjs`** — per dataset: EXPECTED (distinct edge-keys over the build SELECT) vs ACTUAL (`gs_relationships`). `expected>actual`→ALERT (under-built, exit 1); `actual>expected`→STALE (exit 0). Flags: `--threshold=` (default 0.05), `--json` (for /health).
- **migration `…_gs_graph_completeness_log.sql`** — trend table (the roadmap's "coverage trend") + `service_role` grant + nightly `agent_schedules` row. All idempotent. Registered in agent-registry (`check-graph-completeness`, deps `build-entity-graph`).
- **First live run** (±5%): donations 713,348/743,594 OK · austender 658,940/689,921 OK · grants 5,291/6,413 STALE · foundations 18/38 STALE · 0 ALERTs. Rows persisted.

### This Session (2026-06-18 late — PR #86)
- [x] **#86 OPEN (`41d8b6f`+`110c690`)** — paginate Phase 1d (gov bodies), 1e (suppliers), 1i (ASX). Unpaginated PostgREST reads → set-based `DISTINCT` via psql, parsed delimiter-safe through `row_to_json` + new `selectJsonRows` helper. **1e saw only ~1000 of 60,017 distinct supplier ABNs.** Also filtered 1e + the contracts join (kept in sync) to valid 11-digit ABNs (12 garbage values like `#N/A`/`Exempt-*` were collapsing 100s of suppliers into fake hubs `AU-ABN-#N/A` et al.).
- [x] **selectJsonRows SET-tag crash found+fixed (`110c690`)** — `runDml` prepends `SET statement_timeout=0;` so psql echoes a `SET` line; `JSON.parse('SET')` threw fatal on the first call. Filter to `{`-prefixed lines. Routed 1f through the same hardened helper → also kills #85's latent bug minting a junk "SET" political_party (deleted the orphan: `DELETE 1`).
- [x] **1i finding:** all 2,013 `asx_companies.abn` are NULL → 1i creates 0 entities regardless of pagination (separate upstream data gap; now logged explicitly).
- [x] **Backfill run live** — entities phase (18min) created the missing suppliers (austender entities 55,638→57,408; **supplier ABN coverage 59,958/60,017**). Contracts re-run set-based, clean: **+4,385 edges** (685,536→689,921). Impact modest because most supplier ABNs already had entities via ACNC/ATO/ORIC (same `AU-ABN-*` gs_id); only ~1,770 were austender-only.
- [x] **MV refresh** re-running live (`b6la5297f`).
- [!] **Transient flake during entities run:** 1000 row writes failed with `TypeError: terminated` (shared-pooler saturation, NOT a code bug — see memory). Landed mostly in the JusticeHub phase (ran last) + 59 suppliers. Idempotent → recovered on any future `--phase=entities` run. NOT blocking.

### Prior Session (2026-06-18 earlier)
- [x] **#83 MERGED (`38f9bd8`)** — set-based rewrite of all 4 relationship phases (donations/contracts/grants/links). One server-side `INSERT…SELECT … ON CONFLICT DO NOTHING` each via psql; in-memory `loadEntityIndex` removed entirely. ~40× faster end-to-end (donations 63s vs ~45min). Validated phase-by-phase diff-to-zero. Recovered **+578,799** index-dropped edges live (donations +159,659, contracts +418,876, grants +257, links +7).
- [x] **#84 MERGED** — `docs/strategy/data-health-roadmap.md` (5 phases; completeness gate = centerpiece).
- [x] **#85 MERGED** — Phase 1f party creation read was unpaginated → PostgREST 1000-cap → only 66 of 2,437 parties. Set-based `SELECT DISTINCT` fix. Live: parties **66→2,438**, donation edges **368,365→743,594** (re-ran donations after).
- [x] **MVs refreshed twice** — 38/38, 0 failed; final refresh (21.6 min) reflects the doubled donations + deduped contracts.
- [x] **#1 contract dedup DONE (data op, no PR)** — removed 702,189 legacy dual-key dupes + stale rows; **preserved 29,193** would-be-lost contracts (safe set only). Contracts **1,387,725→685,536**. No recurrence (current code keys on `ocid`).

### Next
- [x] ~~Fix Phase 1d/1e/1i unpaginated reads~~ → **PR #86**, backfilled live.
- [x] ~~Merge PR #86~~ → squash-merged `94a66a8`, CI green, branch deleted.
- [ ] **Build the completeness gate** (roadmap Phase 2): nightly expected-vs-actual edge count per dataset, alert on drift. Would have caught all of #82/#83/#85/#86/#1 the morning after. **← now the top durable item.**
- [ ] **#3 audit** other relationship agents (directorship 329K, shared_director 95K, grant 94K) for the same 1000-cap read class.
- [ ] **ASX ABN data gap** — populate `asx_companies.abn` (all 2,013 NULL) upstream so Phase 1i actually creates entities. Separate ingest fix.
- [ ] **Mop-up (low pri):** re-run `--phase=entities` once to recover the 1000 transient-failed rows + 59 missing suppliers (idempotent). Tonight's manual run or any future build clears it.

### Decisions
- **Additive-only writes** for the rewrite (Ben, 2026-06-17): recover dropped links, leave legacy rows; clean rebuild only as a deliberate separate step.
- **#1 contract cleanup = safe delete** (Ben, 2026-06-18): delete only proven dupes+stale, preserve the 29,193 net-loss rows.
- **Large DELETEs:** precompute doomed IDs into an indexed TEMP table set-based, then delete-by-pkey. Per-row `EXISTS` in a big DELETE = pathological (killed a 22-min runaway). Even safe, 702K×13-index deletes = ~21min IO on the throttled shared instance.

### Open Questions
- UNCONFIRMED: exact count the 29,193 shrinks to after Phase 1d/1e fix + contract re-run (expected to drop substantially, not necessarily to 0).
- UNCONFIRMED: whether the frontend actually surfaces the now-complete graph + refreshed MVs (no app audit done — likely the biggest user-visible win; roadmap Phase 4 / a `/leverage` pass).

### Workflow State
pattern: diagnose-fix-validate-ship
phase: 6
total_phases: 8
retries: 0
max_retries: 3

#### Resolved
- goal: "make the entity graph correct, fast, self-monitoring; fix donation/contract data at source"
- resource_allocation: balanced

#### Unknowns
- frontend_surfaces_the_data: UNKNOWN (no app audit)

#### Last Failure
(none — last destructive op, the contract dedup, completed clean: DELETE 702189, 29193 preserved)

---

## Context

### Key facts for resume
- **Supabase:** SELECT via `node --env-file=.env scripts/gsql.mjs "..."`; DML/heavy via direct psql (`PGPASSWORD=$DATABASE_PASSWORD psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f file.sql`). `exec_sql` RPC is SELECT-only. Shared pooler intermittently saturates.
- **Set-based phase helper:** `buildRelationshipsSetBased(label, cols, selectSql, prelude)` in `scripts/build-entity-graph.mjs` — shells to psql via `resolveBin`+`withRetry` (`scripts/lib/agent-resilience.mjs`); `ON CONFLICT (dedup index expr) DO NOTHING`. Prelude pre-materialises+indexes lookup tables (donor_map) so joins are index scans, not nested-loop-over-Materialize (~4B-op runaway otherwise).
- **The recurring bug class:** silent read truncation — unpaginated REST `.select()` (PostgREST 1000-row cap) OR `.range()` without stable `.order()`. Caused #82 (entity index), #85 (66 parties), and the 29,193 unresolved contracts (Phase 1d/1e). The completeness gate is the durable fix.
- **Memory:** `project_build_entity_graph_setbased` (full detail, corrected findings), `feedback_data_quality_before_scoring`.
- **Roadmap:** `docs/strategy/data-health-roadmap.md`.

### Prior sessions (history — see git/PRs/memory for detail)
- 2026-06-17: #80 (build-entity-graph resilience + JusticeHub N+1), #81 (Vercel 45-min deploy hang), #82 (`loadEntityIndex` `.order('id')` — found the ⅓ drop). #76–#79 (shared `agent-resilience.mjs`, withRetry on logStart/Complete/Failed, trust-remediation unify, null-run_id snapshot fix).
- 2026-06-16: #71–#75 (scraper-hang timeouts, enrich-se status accounting, YJ tracker pooler-retry, trust-remediation psql-PATH, Poll-Frontier 403 auto-disable).
- DEFERRED: Notion sync (#71) re-enable needs per-run cap (full run = 1,480-page dump); agent is `enabled=false`.
