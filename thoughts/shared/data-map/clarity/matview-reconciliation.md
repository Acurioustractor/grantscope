# Matview refresh registry reconciliation

Verified 2026-08-14 by direct psql against Supabase project `tednluwflfhxyucgwigh`.
Every count below was re-measured; none is carried over from the earlier agent's estimate.

---

## 0. Corrections to the brief

The brief's numbers were close but not right. Re-measured:

| Brief said | Actual | Note |
|---|---|---|
| cron function holds "~27" names | **27** | correct |
| script holds "~46" names | **43** | |
| "the two registries disagree by ~19" | **16**, and asymmetrically | cron is a strict *subset* of the script — there are **zero** cron-only entries |
| "~71 of 98 matviews are on NO schedule" | **55** | 43 are on at least one list |
| two registries | **six** | see §1 |

---

## 1. The actual root cause: six registries, not two

| # | Registry | Names | Runs when |
|---|---|---|---|
| 1 | `refresh_civicgraph_mvs()` `refresh_order` array | 27 | pg_cron job 4, `0 17 * * *` |
| 2 | `scripts/refresh-views-v2.mjs` `VIEW_LIST` | 43 | manual |
| 3 | `scripts/refresh-views.mjs` (v1) | ~52 | dead script, still on disk |
| 4 | `scripts/sql/setup-pg-cron-mv-refresh.sql` | 23 | stale snapshot of #1 |
| 5 | `scripts/refresh-youth-justice-report-cache.mjs` | 15 (`mv_yj_report_*`) | `npm run report:youth-justice:cache` |
| 6 | `scripts/refresh-total-funding-mv.mjs` | 1 (`mv_entity_total_funding`) | manual |

Plus three more hardcoded arrays that also drifted: `needs_non_concurrent` (in the SQL function),
`NEEDS_NON_CONCURRENT` and `HEAVY` (in the Node script).

Re-syncing #1 and #2 would have rebuilt the drift within a month. The fix below removes the
concept of a hand-maintained list.

---

## 2. Three-way set difference (exact)

98 materialized views exist in `public`. All 98 are populated (`relispopulated = true`).

| Set | Count |
|---|---|
| in **both** cron and script | **27** |
| **cron only** | **0** |
| **script only** | **16** |
| on **neither** | **55** |
| listed but not actually a matview | 0 |

The 27 shared entries include four `v_`-prefixed objects (`v_grant_stats`, `v_grant_focus_areas`,
`v_grant_provider_summary`, and in the script also `v_austender_*`) — these *are* materialized
views despite the `v_` prefix. No phantom names in either list.

**The 16 script-only** (refreshed only when someone runs the script by hand):

```
mv_award_history_by_theme      mv_person_cross_system         v_austender_entity_summary
mv_award_winner_by_theme       mv_person_identity_influence   v_austender_stats
mv_charity_network             mv_person_identity_network     v_austender_top_oric
mv_charity_rankings            mv_person_influence
mv_disability_landscape        mv_person_network
mv_foundation_scores
mv_foundation_trends
mv_lga_place_profile
```

This is exactly the director-links layer Ben flagged. `mv_refresh_log` confirms it: the whole
`mv_person_*` family, `mv_charity_network`, `mv_charity_rankings`, `mv_disability_landscape`,
`mv_foundation_scores` and `mv_lga_place_profile` last ran **2026-08-09**, by hand, via
`refresh-views-v2`. The 27 cron entries last ran 2026-08-13 17:00.

**The 55 on neither list** include live app surfaces:
`mv_person_entity_network` (4 app files), `mv_person_entity_crosswalk`, `mv_board_power`
(`/api/data/board-power`), `mv_foundation_regranting` (`/foundation/[abn]` + 2 API routes),
`mv_funding_outcomes_summary` (`/api/outcomes/portfolio`), `mv_person_identity_influence_v2`
(`/api/power/holders`).

---

## 3. Dependency graph

Derived from `pg_depend` → `pg_rewrite` → `pg_class`, chased **transitively through plain views**
(a matview reading a view that reads a matview has a real ordering constraint; direct `m→m` edges
alone miss it).

- 26 direct `m→m` edges, plus 6 `m→v` and 15 `v→m` that form indirect chains
- **19 of 98 matviews read another matview**
- **max dependency depth 4**
- **no cycles**

```
mv_board_interlocks            <- mv_entity_power_index
mv_charity_rankings            <- mv_charity_network
mv_crossref_quality            <- mv_donor_contract_crossref
mv_disability_landscape        <- mv_entity_power_index, mv_funding_deserts
mv_donor_person_crosslink      <- mv_person_network
mv_evidence_backed_funding     <- mv_foundation_grantees
mv_foundation_need_alignment   <- mv_foundation_grantees, mv_funding_deserts
mv_foundation_readiness        <- mv_foundation_grantees, mv_foundation_scores
mv_foundation_regranting       <- mv_foundation_grantees
mv_foundation_scores           <- mv_evidence_backed_funding, mv_foundation_grantees,
                                  mv_foundation_need_alignment, mv_trustee_grantee_chain
mv_funding_deserts             <- mv_entity_power_index, mv_funding_by_lga
mv_lga_place_profile           <- mv_foundation_grantees
mv_person_cross_system         <- mv_individual_donors
mv_person_identity_influence   <- mv_person_identity_network
mv_person_identity_influence_v2<- mv_person_identity_network
mv_person_identity_network     <- mv_person_entity_network
mv_person_influence            <- mv_person_entity_network
mv_temporal_summary            <- mv_donation_contract_timing
mv_trustee_grantee_chain       <- mv_foundation_grantees, mv_person_entity_crosswalk
```

### Ordering violations in the current registries

**Cron function: 0 violations.** Its 27 entries are correctly ordered.

**Script `VIEW_LIST`: 6 violations**, all of the same kind — a matview is refreshed nightly from a
base that is on **no schedule at all**:

| Refreshed matview | Base it reads | Base status |
|---|---|---|
| `mv_person_influence` | `mv_person_entity_network` | unscheduled |
| `mv_person_identity_network` | `mv_person_entity_network` | unscheduled |
| `mv_person_cross_system` | `mv_individual_donors` | unscheduled |
| `mv_foundation_scores` | `mv_trustee_grantee_chain` | unscheduled |
| `mv_foundation_scores` | `mv_foundation_need_alignment` | unscheduled |
| `mv_foundation_scores` | `mv_evidence_backed_funding` | unscheduled |

Nothing is refreshed in the wrong *relative* order; the failure is that the roots were never in
the list. `mv_person_entity_network` is the root of the entire director-links layer.

---

## 4. Silent failures found

### 4a. `mv_funding_by_disadvantage` (1 row) and `mv_indigenous_funding_by_disadvantage` (0 rows)

**Root cause verified.** Both matviews filter
`WHERE a.ais_year = (SELECT max(ais_year) FROM acnc_ais)`.

```
acnc_ais year distribution:
  2025 |      1     <- one stray row
  2023 | 53,207     <- the real latest year
  2022 | 52,935
  2021 | 51,746
  ...
```

A **single stray 2025 row** among 360,488 poisons `max(ais_year)`, so both matviews aggregate over
that one row. `mv_funding_by_disadvantage` lands 1 decile row; the Aboriginal-benefit filter on
`mv_indigenous_funding_by_disadvantage` removes even that, giving 0. Both refresh "successfully"
in ~1s every night, and the app renders empty sections believing the data is fresh.

Fix is a data or definition change (delete the stray row, or pin the year to the most-populated
one) — out of scope for this task. Both are marked `health = 'broken_upstream'` in the registry so
the condition is visible rather than folklore.

### 4b. Every cron-written duration in `mv_refresh_log` is zero

The function uses `now()`, which in PL/pgSQL is `transaction_timestamp()` — **constant for the
entire function call**. Verified on the 2026-08-13 17:00 run: all 27 rows stamped
`17:00:00.10131+00`, `started_at = finished_at`, `duration_ms = 0`.

Every real duration in the table came from the Node script. The nightly job has produced **no
usable cost data since it was created**. Fixed with `clock_timestamp()`.

### 4c. Four matviews do the work twice, every night

`mv_abr_name_lookup`, `mv_grant_contract_overlap`, `mv_indigenous_procurement_score` and
`mv_lga_indigenous_proxy_score` have no unique index. The cron function attempts `CONCURRENTLY`,
fails, then refreshes non-concurrently — logged as `success-fallback` every night.
`mv_abr_name_lookup` is ~124s of that, paid twice.

The two implementations even *label* this differently: the SQL function logs `success-fallback`,
the Node script logs plain `success` with `used_concurrent = false`. Same event, two labels.

### 4d. The whole nightly run is one transaction

pg_cron executes `SELECT refresh_civicgraph_mvs()` as a single statement. Log rows only become
visible when the entire ~18-minute run commits, and a mid-run crash discards every log row
*including the failure that caused it*.

**What was already correct:** per-matview exception handling. One failure does not stop the rest,
and it is recorded. That behaviour is preserved in the rewrite.

---

## 5. Refresh cost (measured)

From `mv_refresh_log`, `success%` rows with `duration_ms > 0`, last 120 days. All 43 currently
scheduled matviews have real history.

| | median | p90 |
|---|---|---|
| current 43-view list, serial | **17.7 min** | 33.1 min |
| proposed nightly (50 views) | **15.6 min** measured | 29.4 min |
| proposed weekly (15 views) | 2.1 min measured | 3.7 min |

Top costs (median seconds): `mv_entity_power_index` **367** (35% of the whole window),
`mv_abr_name_lookup` **124**, `mv_gs_entity_stats` **108**, `mv_donor_contract_crossref` 44,
`mv_triple_proof_suppliers` 42, `mv_funding_by_postcode` 40. Everything else is under 35s.

It is not a 3-hour job. The proposal **adds 7 net matviews and still shrinks the window**, by
moving `mv_abr_name_lookup` (124s, and see below) out of nightly.

9 of the 50 proposed nightly views have never been measured. `EXPLAIN` (no ANALYZE) gives a weak
signal only — `mv_entity_power_index` estimates 4.1e18 yet runs in 367s, so cost is not a reliable
predictor here. Two objects had alarming estimates and were put in **weekly rather than nightly
specifically because they are unmeasured**:

- `mv_person_entity_crosswalk` — 39.8M, nested-loop left join
- `mv_board_power` — 20.2M, WindowAgg over ~25.8M estimated rows

Measure both before promoting either.

---

## 6. Tiered schedule (98 objects)

Evidence per object: read by app code (`apps/web/src` + `JusticeHub/src`), by a DB function body
(`pg_proc.prosrc`), by a DB view (`pg_get_viewdef`), or consumed by another matview that is itself
read. Per VERIFICATION.md's binding correction, **no object was judged on the code grep alone** —
6 of 17 apparently-dark matviews were rescued by the function/view check (a 35% false-positive
rate on code-only scanning, consistent with the 23% they measured).

| Tier | Count | Meaning |
|---|---|---|
| **nightly** | **50** | daily-cadence source data behind live app surfaces |
| **weekly** | **15** | slow-changing reference/scoring data, or cost not yet measured |
| **on_demand** | **24** | already has a named owner — do not add to nightly |
| **retire** | **9** | no reader of any kind; stop refreshing (not dropped) |

Verified: **0 tier-consistency violations** — no matview is scheduled fresher than something it
reads. Nightly plan depth 0..2, weekly 0..3, no cycles in either.

### Notable decisions

**`mv_abr_name_lookup` → weekly.** 1.3GB, 9.0M rows, 124s/night. It has **zero** readers: no app
file, no DB function, no DB view, no dependent matview. Only migrations and refresh scripts
mention it. It is an entity-resolution helper for ad-hoc SQL (`backfill-oric-abns.sql`) over
`abr_registry`, which changes monthly at most. Biggest single saving available.

**The foundation-scores chain → weekly, together.** `mv_person_entity_crosswalk` →
`mv_trustee_grantee_chain` → `mv_foundation_scores` → `mv_foundation_readiness`, plus
`mv_evidence_backed_funding` and `mv_foundation_need_alignment`. `mv_foundation_scores` is
currently nightly, so this looks like a downgrade — it is not. **Three of its four bases are on no
schedule today**, so its real freshness is already worse than weekly. Moving the whole chain to
weekly makes it *more* correct than it is now, on data (ACNC/foundation returns) that is
annual-cadence anyway.

**`mv_person_entity_network` → nightly.** The root of the director-links layer, read directly by 4
app files and feeding `mv_person_influence` and `mv_person_identity_network`. Currently on no
schedule at all. This is the single most important addition.

**`mv_person_identity_influence` and `_v2` both stay.** `_v2` is the A4 de-collide successor and
`/api/power/holders` reads only `_v2`, but `/person/[name]` and `/api/data/person` still read the
original. Neither is retirable without a code change. Both nightly; flagging the incomplete
migration rather than acting on it.

**`retire` (9)** — no reader in app code, DB functions, DB views, or other matviews:
`mv_api_usage_daily` (0 rows), `mv_board_contractor_links` (4), `mv_board_donor_links` (2),
`mv_foundation_landscape_access` (6), `mv_foundation_landscape_category` (16),
`mv_foundation_landscape_geo` (23), `mv_foundation_landscape_top_foundations` (10,129),
`mv_fy_donation_contracts` (50,685), `mv_youth_justice_entities` (5,469).

`retire` means **stop refreshing**, not drop. Unscheduling is reversible; dropping is not, and
VERIFICATION.md records 19 objects previously mis-marked for deletion. The data stays; only the
nightly cost goes.

**`on_demand` (24)** — these already have owners and must not be double-scheduled:
15 × `mv_yj_report_*` (`npm run report:youth-justice:cache`), 4 × `alma_*`
(`refresh_sentiment_analytics()`, `refresh_alma_dashboards()`), `mv_closing_the_gap_state_summary`
(its own pg_cron job 10), `mv_project_quarter_position` (`refresh_mv_project_quarter_position()`;
also D14/ACT, leaves this DB), `mv_entity_total_funding` (`refresh-total-funding-mv.mjs`),
`act_grant_recommendations` (ACT-scoped, 13 app refs — confirm owner), `mv_intervention_funding_chain`
(read via `v_chain_summary`, ALMA cadence).

---

## 7. The fix

Membership and cadence live in one table. **Order and concurrency are derived, never written down.**

```
mv_refresh_registry      table    mv_name, tier, enabled, force_non_concurrent, health, notes
v_mv_dependency_edges    view     m -> m edges from pg_depend, chased through plain views
mv_refresh_plan(tier)    function dependency-ordered plan; CONCURRENTLY derived from pg_index
v_mv_refresh_drift       view     THE GUARD: every catalog matview vs the registry vs last run
refresh_civicgraph_mvs_run(tier)  procedure, COMMITs per matview
refresh_civicgraph_mvs(tier)      function, backward-compatible wrapper
```

Adding a matview is one `INSERT`; it slots into the correct position by itself. Forgetting the
`INSERT` shows up as `drift = 'UNREGISTERED'` in `v_mv_refresh_drift` the next morning, and the
Node script prints it at the top of every run. That is what makes this a fix rather than a re-sync.

Resilience, all three fixed:
- per-matview subtransaction (kept from the old function)
- `clock_timestamp()` so durations are real
- `COMMIT` per matview in the procedure, so a mid-run crash keeps completed work *and* its log

### One trap worth naming

The new `refresh_civicgraph_mvs` takes a `p_tier` argument; the existing one is zero-argument
(confirmed: `pg_get_function_identity_arguments` returns empty). `CREATE OR REPLACE FUNCTION`
**cannot change a signature** — it would have created a second, overloaded function and left the
old hardcoded 27-name body in place. Postgres resolves a zero-argument call to the exact-arity
match, so pg_cron's `SELECT refresh_civicgraph_mvs()` would have kept running the old body and the
migration would have silently done nothing. The migration now issues
`DROP FUNCTION IF EXISTS refresh_civicgraph_mvs();` first.

### SQL verified before hand-off

I cannot apply migrations, so the plan SQL was **executed read-only** against the live catalog with
the registry inlined as a `VALUES` list. It returns 50 nightly rows, depth 0..2, correctly ordered:
`mv_charity_network` (seq 5) before `mv_charity_rankings` (41); `mv_person_entity_network` (26)
before `mv_person_influence` (47) and `mv_person_identity_network` (46); `mv_entity_power_index`
(8) before `mv_board_interlocks` (40) and `mv_funding_deserts` (43); `mv_individual_donors` (21)
before `mv_person_cross_system` (45). Weekly returns 15 rows, depth 0..3, with the foundation chain
correctly staged.

---

## 8. Artifacts written

| Path | What |
|---|---|
| `/Users/benknight/Code/grantscope/migrations/2026-08-14-mv-refresh-registry.sql` | Registry table, dependency-edge view, `mv_refresh_plan()`, drift view, log table, all 98 seed rows with a reason each. **Not applied.** |
| `/Users/benknight/Code/grantscope/migrations/2026-08-14-mv-refresh-cron.sql` | Rewritten `refresh_civicgraph_mvs()` + resilient `refresh_civicgraph_mvs_run()` procedure. `cron.schedule()` calls are commented out (Tier 3). **Not applied.** |
| `/Users/benknight/Code/grantscope/scripts/refresh-views-v2.mjs` | Patched: `VIEW_LIST`, `NEEDS_NON_CONCURRENT` and `HEAVY` deleted. Reads `mv_refresh_plan()`; timeouts derived from measured p90; `--tier` flag; prints drift warnings. Parses clean; fails loudly until the migration is applied. |

Apply commands are in each migration's header comment. Both migrations are read-then-apply safe;
the `cron.schedule()` block at the end of the second is deliberately left commented out because it
changes a live scheduled job.

### Suggested order

1. Apply `2026-08-14-mv-refresh-registry.sql`, then run the four post-apply verification queries in
   its footer (expect: 98 `ok`, 50 planned rows, 0 tier violations, planned = members).
2. `node --env-file=.env scripts/refresh-views-v2.mjs --dry-run` to see the plan the script will use.
3. Apply `2026-08-14-mv-refresh-cron.sql`.
4. Run `node --env-file=.env scripts/refresh-views-v2.mjs --tier weekly` once by hand — it contains
   the two unmeasured expensive objects (`mv_person_entity_crosswalk`, `mv_board_power`). This is
   how they get their first measurement.
5. Only then uncomment and run the `cron.schedule()` calls.
