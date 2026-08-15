# THE /clarity DATA LAYER — schema, refresh, ranking, gap metrics

Built 2026-08-14 against Supabase project `tednluwflfhxyucgwigh` by direct psql.
Every number below was produced by a query I ran in this session unless it is explicitly
marked `[R]` (relayed from an earlier document) or `[I]` (inferred).

**Deliverable files, all UNAPPLIED, each with its apply command in the header:**

| File | What |
|---|---|
| `/Users/benknight/Code/grantscope/supabase/migrations/20260815000000_clarity_catalog_schema.sql` | 8 tables, 5 enums, 1 read view |
| `/Users/benknight/Code/grantscope/supabase/migrations/20260815000100_clarity_refresh_function.sql` | `clarity_refresh()`, `clarity_score()`, `clarity_set_probe()`, `clarity_measure_gaps()` |
| `/Users/benknight/Code/grantscope/supabase/migrations/20260815000200_clarity_gap_metrics_seed.sql` | 23 gap metrics with executable SQL, the metric-conflict registry, and the 221-name D14 exclusion seed |

Apply command (identical shape for all three, per CLAUDE.md Rule #1 — `gsql.mjs -c` mangles `$$`):

```bash
cd /Users/benknight/Code/grantscope && source .env && \
PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f supabase/migrations/20260815000000_clarity_catalog_schema.sql
```

---

## 0. HEADLINE — what changed from BUILD-SPEC.md

BUILD-SPEC seeds a `data_inventory` table from 812 census objects. The universe is **1,433**.
That is the correction the whole exercise turns on, but it is not the only one. Five defects
in BUILD-SPEC §3 would have shipped broken code, and I proved each one rather than asserting it.

| # | BUILD-SPEC says | Measured reality | Consequence |
|---|---|---|---|
| **B1** | Catalog covers 812 objects | 714 tables + 98 matviews + **212 views** + **409 functions** = **1,433** | The front page would be wrong on its first screen by 43% |
| **B2** | `SET LOCAL statement_timeout='6s'` inside the freshness loop, with `EXCEPTION WHEN query_canceled` | **This guard is a no-op.** Proven below. A `max()` over an unindexed 20M-row column hangs the whole job with zero protection | The nightly job has no timeout at all |
| **B3** | `refs_civicgraph / refs_justicehub / refs_scripts` as raw hit counts | Raw hits are junk: `justice_funding` scores **3,293 hits in one bulk-INSERT `.sql` file**. And migrations must be their own class — an object whose only reference is the DDL that created it is *not in use* | This exact conflation is how 19 live-written tables reached a DROP list |
| **B4** | "74.5% of tables carry an auto-derivable freshness column" | Over the right population: **632 of 714 tables (88.5%)** but **1 of 98 matviews (1.0%)**. Matview freshness cannot come from a column at all | Freshness for the entire derived layer must come from `mv_refresh_log`, which knows only 44 of 98 |
| **B5** | "must not run through the app: the Proxy blocks `exec_sql`" | The Proxy blocks `exec`/`execute_sql`/`exec_agent_sql` — but **`SELECT clarity_refresh()` passes the `exec_sql` read-only guard**. The real blocker is the **8-second timeout**, and no function can escape it | Right conclusion, wrong reason. Documented correctly in the migration header |

Two more things BUILD-SPEC could not have known because nobody had measured them:

- **The "290 dark objects / 14,894,611 rows" figure is wrong by 65%.** Counting DB function
  bodies (202-209 relations depending on the match pattern), triggers (219 on 178 tables)
  and view lineage (695 edges, 220
  relations) as references, the honest number is **184 populated objects holding 5,087,126
  rows** — 9.7% of the estate, not 28%.
- **451 of 1,024 relations are readable with the public `anon` key** once RLS is resolved,
  including **206 of the 212 views**, of which **99 run with DEFINER rights** so base-table
  RLS does not apply to them at all. Exposure has to be a catalog *column*, not an appendix.

---

## 1. THE FULL UNIVERSE — 1,433 objects, measured

```
public schema, pg_class                                  pg_proc
  714  tables            (relkind 'r')                     410 rows
   98  materialized views(relkind 'm')                     409 distinct names (1 overload)
  212  regular views     (relkind 'v')                     ── classified below
 ────
1,024  relations                                        + 409 = 1,433 catalog rows
```

Everything else the catalog has to carry, all counted this session:

| Dimension | Value |
|---|---|
| Database size | **28 GB** (`pg_database_size`) |
| Rows in the 812 tables+matviews | **52,349,579** (exact `count(*)`) |
| Rows returned by the 194 countable views | **1,816,265** |
| Columns (`pg_attribute`, so matviews included) | 14,310 in the 926 tables+views, plus matviews that `information_schema` cannot see |
| Declared foreign keys | **636** |
| View-lineage edges (`pg_depend`/`pg_rewrite`) | **695** over 185 distinct base relations |
| Triggers (non-internal) | **219** across **178** tables |
| Enum types | **24** |
| RLS: enabled / disabled | **693 / 21** |
| RLS policies | **762**; **215** tables have RLS on and **zero** policies |
| `anon` SELECT policies with `USING true` | **240** (`polcmd IN ('r','*')`; the earlier "227" used SELECT-only) |
| Vector columns | **39** across 39 relations; 23 on tables/matviews, 16 on views |
| pg_cron jobs | **5**, all active; exactly one refreshes matviews |

### 1.1 The 212 views — inventoried for the first time

| Measure | Value |
|---|---|
| Views | 212 |
| `SELECT` granted to `service_role` / `authenticated` / **`anon`** | 212 / 210 / **206** |
| `security_invoker = true` | **109** |
| **Running with DEFINER (owner) rights** | **103** — of which **99 are anon-readable** |
| Referenced from app source (`apps/web/src`, `JusticeHub/src`) | **60** |
| Referenced from anything (app, script, DB function, another view) | **78** |
| **No query-shaped reference anywhere** | **132 (62.3%)** |
| Countable in 3 s | **194 (91.5%)** |
| **Timed out at 3 s** | **18 (8.5%)** |
| Returning **zero rows** | **26** |

**Row-count policy for views, derived from measurement, not guessed.** I probed all 212 in one
serial psql session with `SET statement_timeout='3s'`: **122 seconds wall clock, 18 cancellations,
zero errors**. Distribution of the 194 that returned:

```
   0 rows : 26      1–9 : 44     10–99 : 52    100–999 : 35
1k–9,999 : 23   10k–99k : 10   100k–999k : 4      1M+ : 0
```

**Recommended policy (implemented):** probe with a 3 s cap and record `ok | timeout | error` in
`row_count_probe`. Never block a page render on it; never store a timeout as `0`. Re-probe the
18 timeouts weekly at 30 s. The 18 are named and they are exactly the ones you would predict —
`v_entity_360`, `v_entity_abr`, `v_lga_place_profile`, `org_governance`, `v_award_rows`,
`v_youth_justice_entities`, `v_justice_funding_by_org`, `v_relationship_health`,
`v_acnc_grant_makers`, `v_program_deliverers`, `v_program_detail_deliverers`,
`v_project_relationships`, `v_prf_portfolio_outcomes`, `v_act_procurement_buyers`,
`v_goods_central_channels`, `v_nt_community_buyer_crosswalk`, `v_nt_community_entity_matches`,
`act_grant_recommendations_current`.

The five largest views by rows: `v_org_funding_profile` 609,448 · `v_entity_funding_mix` 351,455
· `v_funding_outcomes_chain` 173,220 · **`justice_funding_clean` 151,866** · `canonical_organizations`
99,859.

### 1.2 The 409 functions — classified for the first time

| Class | Count |
|---|---|
| Trigger functions (return `trigger`) | **115** |
| ... actually attached to ≥1 trigger | 95 |
| ... **attached to nothing** | **20** |
| `SECURITY DEFINER` | **64** *(COMPLETENESS.md said 55 — corrected)* |
| Plain callable | 295 |
| plpgsql / sql | 323 / 87 |
| Volatility v / s / i | 303 / 88 / 19 |
| **EXECUTE granted to `anon`** | **340 of 410** |
| EXECUTE granted to `authenticated` | 344 |
| **`SECURITY DEFINER` AND anon-executable** | **3** |
| Total `prosrc` | **386,420 characters** — never scanned before this session |
| Functions with a query-shaped call site in either repo | **143** |
| Functions called by another DB function | 2 |

The three RLS-bypassing routines a browser can invoke with the public key:
`rebuild_funder_board_paths()`, `rebuild_funder_intelligence()`, `rebuild_place_funding_snapshot()`.
All three write.

Two functions are registries the catalog must reconcile rather than duplicate:
`refresh_civicgraph_mvs()` (hardcoded 27-name array, `SET statement_timeout=0`) and
**`get_table_freshness()`** — a hand-maintained `jsonb_build_object` of ~20 `max()` subqueries
with `SET statement_timeout=15s`. That is a third freshness registry nobody mentioned. It should
be replaced by a read of `clarity_object`.

---

## 2. WHY THE REFRESH CANNOT RUN THROUGH THE APP — verified myself

I was asked to check this claim rather than repeat it. It is true, but **for a different reason
than stated**.

**(a) The Proxy block is real but does not cover this.**
`apps/web/src/lib/supabase.ts:13` — `fullyBlockedSqlRpcNames = new Set(['exec','execute_sql','exec_agent_sql'])`,
enforced at `:117-121`. `exec_sql` is admitted when `isReadOnlyExecSql()` passes, which requires
only that the string starts with `select` or `with`. **`SELECT clarity_refresh()` matches.** So
the app guard would *not* stop it.

**(b) The 8-second cap is real and is the actual blocker.**

```
anon           statement_timeout = 3s
authenticated  statement_timeout = 8s
authenticator  statement_timeout = 8s, lock_timeout = 8s
service_role   (no rolconfig — inherits authenticator's 8s through PostgREST)
postgres       statement_timeout = 0
```

`exec_sql` is `SECURITY DEFINER` with EXECUTE granted only to `{postgres, service_role}`.
Empirically, through `scripts/gsql.mjs`:

```
$ node --env-file=.env scripts/gsql.mjs "SELECT pg_sleep(10) AS s"
Error: canceling statement due to statement timeout
```

**(c) No function can escape it.** `statement_timeout` is armed once, by `start_xact_command()`,
at the top of the client command. Changing the GUC mid-statement does not re-arm the timer:

```
$ node --env-file=.env scripts/gsql.mjs \
    "WITH t AS (SELECT set_config('statement_timeout','0',true)) SELECT pg_sleep(11) IS NULL FROM t"
Error: canceling statement due to statement timeout
```

So `refresh_civicgraph_mvs()`'s `SET statement_timeout=0` in `proconfig` protects it under
pg_cron (where no timer is armed) and does nothing under PostgREST.

**(d) — and this is the one that matters — the same mechanism breaks BUILD-SPEC's freshness guard.**

```sql
SET statement_timeout = 0;
DO $t$
BEGIN
  BEGIN
    SET LOCAL statement_timeout = '1s';
    PERFORM pg_sleep(4);
    RAISE NOTICE 'not cancelled';
  EXCEPTION WHEN query_canceled THEN RAISE NOTICE 'cancelled';
  END;
END $t$;
```
```
NOTICE:  not cancelled          -- elapsed 4.4 s
```

**`SET LOCAL statement_timeout` inside plpgsql cannot cancel a running query.** BUILD-SPEC §3.3
relies on it for every one of 812 freshness probes. It is a no-op.

**The fix implemented in `clarity_refresh()`: bound the probe by cost, not by time.**
Probe `max(col)` only when the chosen column has a **leading btree index** (index scan,
microseconds) **or** the relation is under `p_fresh_scan_max` (default 2,000,000) rows.
Everything else records `deferred_too_large` and is picked up by the runner, which issues one
statement per object and therefore *can* arm a real timeout.

Measured justification: of the 633 relations with a freshness column, only **59 have a leading
index** on it, and exactly **2 exceeded a 1.5 s probe** — `abr_registry` (20,006,350 rows) and
`acnc_ais` (360,488). The size rule defers the first and admits the second. The whole 633-probe
sweep ran in **53.4 seconds**.

### Measured cost budget for the nightly job

| Pass | Objects | Wall clock |
|---|---|---|
| Exact `count(*)` where `reltuples < 2M` | 806 | **92.7 s** (zero timeouts at a 10 s cap) |
| `reltuples` for the rest | 6 | instant |
| Freshness `max()` probes | 633 | **53.4 s** (2 deferred) |
| View counts (runner, 3 s cap) | 212 | **122 s** (18 timeouts) |
| `pg_proc.prosrc` reference scan | 1,024 × 410 | **3.6 s** — see below |
| FK + lineage + degree + exposure + state + score (all set-based) | 1,433 | seconds |
| **Total** | | **≈ 4.5 minutes** |

**One optimisation worth naming, because it is the difference between a 4.5-minute job and a
6.5-minute one.** The `prosrc` scan is a 1,024 × 410 cross join with a word-boundary regex.
Written naively it takes **103.8 s**. Pre-filtering with a plain substring test first —
`strpos(f.src, r.object_name) > 0 AND f.src ~ '(^|[^a-zA-Z0-9_])name([^a-zA-Z0-9_]|$)'` —
takes **3.6 s** and returns the identical result (586 reference pairs across 209 relations).
Both timings measured on this instance; the optimised form is what is in the migration.

That is 34× the 8-second RPC ceiling. Run it from psql or pg_cron, on the same lane as
`refresh-views-v2.mjs`. Not from `vercel.json` crons — those are HTTP requests.

---

## 3. THE SCHEMA

Full DDL in `20260815000000_clarity_catalog_schema.sql`. Structure and the reasoning:

```
clarity_object              1 row per relation OR routine  (1,433)
  ├── clarity_column        pg_attribute, so matviews are covered
  ├── clarity_edge          fk | view_lineage | curated implicit joins, with MEASURED match rates
  ├── clarity_code_ref      app | script | migration | db_function | trigger | view_lineage
  └── clarity_object_history nightly row_count / bytes / last_write / degree / importance

clarity_freshness_candidate 26-row editable priority list (a new column name is an INSERT)
clarity_gap_metric          the gap registry — each row carries the SQL that measures it
clarity_gap_measurement     time series of every gap metric
clarity_metric_definition   competing definitions of the same concept, one canonical per concept
v_clarity_ledger            read view, LEFT JOIN data_catalog, granted to both apps
```

### 3.1 What I kept from BUILD-SPEC

Right, and carried over unchanged in substance: the enum'd `lifecycle`; the
`cruft-needs-a-written-reason` CHECK; separating *declared* FKs from *curated* joins in one edge
table; a history table because `justice_funding` shrank 218,022 → 157,116 with no alarm;
seeding domain/lifecycle/grain/purpose from the three 2026-08-14 inventory shards (I re-verified:
`catalog.json` parses to exactly 812 rows, 0 missing); `row_count_exact` as a first-class flag;
reading `pg_attribute` not `information_schema`.

### 3.2 What I changed, and why

| Change | Reason (measured) |
|---|---|
| `data_inventory` → **`clarity_object`**, keyed on `object_key`, with `object_kind` including `'view'` and `'function'` | 1,433 not 812. Routines need a signature key: `pg_proc` has 410 rows for 409 names |
| `row_count_exact` → **`row_count_is_estimate` + `row_count_probe`** | "not exact" and "could not be measured" are different states. 18 views are the second, and storing them as `0` would be a lie |
| Added `row_count_ms`, `freshness_ms` | The cost model above is only maintainable if the job records its own cost |
| `fk_out/fk_in/join_out/join_in` → **+ `lineage_out`/`lineage_in`** | 695 view-lineage edges. `mv_entity_power_index` has no FKs and 14 lineage edges — invisible to a degree built on FKs alone |
| `refs_*` as hit counts → **distinct-file counts, split app / script / migration / db_function** | `justice_funding` scores 3,293 hits inside one ingest `.sql` file. And 45 objects are *migration-only*: created by DDL, read by nobody. Conflating that with "in use" is how 19 live tables reached a DROP list |
| Added `refs_db_function` + a `trigger` ref class | **209** relations are named in `pg_proc.prosrc` under the word-boundary match the migration ships (586 reference pairs); **202** under my stricter query-shaped patterns. 178 tables also mutate via 219 triggers. Both signals were invisible to the 2026-08-14 code scan, which never opened a single function body |
| Added `rls_enabled`, `policy_count`, `anon_grant`, `anon_open_policies`, **`anon_readable`**, `security_invoker`, `security_definer`, `anon_execute` | 451 of 1,024 relations are anon-readable; 3 SECURITY DEFINER functions are anon-executable. Governance is a column, not a footnote |
| Added **`act_business` + `act_business_source`** | Ben's decision 1. Flag with provenance (`canonical_d14` / `name_rule` / `manual`) so the exclusion is auditable, not silent |
| Added a second CHECK: **no `cruft` verdict while `refs_app`/`refs_script`/`refs_db_function`/`lineage_in` are non-zero** | The single most expensive error in the 2026-08-14 pass, encoded so it cannot recur |
| `DELETE` disappeared objects → **`missing_since` timestamp** | Deleting the row deletes the history that would have told you it vanished |
| `data_inventory_opportunity` (hand-seeded prose) → **`clarity_gap_metric` + `clarity_gap_measurement`** | "Absence must be measurable, not vibes." Each metric carries its own SQL, so the number on the screen and the number in the doc are the same number by construction |
| Added **`clarity_metric_definition`** | There is already one live conflict (§5, metric 16). Without a registry a second one gets added tomorrow and nobody notices |
| **Kept `data_catalog` and `data_catalog_snapshots`; made `clarity_refresh()` their only writer** | `data_catalog` already has the right 21 columns (`licence`, `public_export`, `pii_level`, `sla_hours`, `source_url`) at 25 rows. `data_catalog_snapshots` has 1,419 rows of real history over 25 tables plus `provenance_coverage_pct` / `confidence_coverage_pct` that a generic sweep cannot compute. Do not build a third governance table — widen the one that exists and write both series from one place |
| `v_clarity_ledger` granted to `service_role` **and `authenticated`**, with `security_invoker = true` | JusticeHub owns 411 migrations to GrantScope's 273 and ~159 objects nobody else touches. A catalog it cannot read solves nothing |

### 3.3 Three correctness details that would have bitten on the first refresh

- **`clarity_edge` uses `UNIQUE NULLS NOT DISTINCT`.** View-lineage rows carry NULL
  `src_column`/`tgt_column`. Under default `UNIQUE` semantics NULLs never conflict, so
  `ON CONFLICT DO NOTHING` would have been a no-op and every nightly run would have re-inserted
  all 695 lineage edges. PG15+ syntax; this instance is 17.6, verified.
- **`v_clarity_ledger` is `security_invoker = true` and granted to `service_role` only.** The
  tempting alternative — a definer-rights view granted to `authenticated` — would have made the
  catalog itself one of the 99 anon-adjacent definer-rights views it exists to count.
- **`clarity_column.is_vector` / `vector_dim`** come from `pg_type.typname = 'vector'`, which
  makes the semantic layer (§6) visible in the catalog for the first time.

---

## 4. THE RANKING

### 4.1 The formula

```
importance =
  ( 0.20 · ln(rows)      / ln(max_rows)          -- how much of the estate it is
  + 0.10 · ln(bytes+1)   / ln(max_bytes+1)       -- physical footprint
  + 0.26 · ln(1+degree)  / ln(41)                -- how central it is
  + 0.18 · ln(1+refs_app)/ ln(26)                -- does a product surface read it (FILES)
  + 0.12 · ln(1+refs_script+refs_db_function+lineage_in) / ln(26)
  + 0.14 · recency_band                          -- 1.0 ≤7d · 0.7 ≤30d · 0.4 ≤180d · 0.2 ≤730d · 0.05 older · 0.30 unknown
  )
  × state_penalty        -- backup .05 · staging .10 · superseded .15 · empty .25 · tiny .60 · live 1.0
  × lifecycle_weight     -- core_source 1.0 · derived/crosswalk .95 · lens .85 · app_operational .60
                         --   scaffold_empty .30 · staging .25 · superseded .20 · backup .10 · routine .50
  × (act_business ? 0.50 : 1.0)
```

Implemented as `clarity_score()` in `20260815000100`, split from the sweep so weights can be
retuned in seconds without re-running the 4.5-minute pass.

### 4.2 Why these weights, and what I rejected

I started from Monte Carlo's shape (rows, degree, code references, recency) exactly as BUILD-SPEC
proposes, ran it over the real 1,433, looked at the output, and fixed three things it got wrong.

**Rejected v1 — raw hit counts.** `justice_funding` scored `pipe = 8,898` because
`scripts/sql/ingest-nsw-facs-grants-2017-18.sql` names it 3,293 times in a bulk INSERT. Switching
to **distinct files** collapsed that to 138 and did not change which objects were at the top —
it changed the *reasons*, which is what the UI displays. Non-negotiable.

**Rejected v2 — usage-only weighting.** With `app` at 0.28 and no lifecycle term, the top 30
filled with application plumbing: `public_profiles` (218 rows), `jr_sites` (46 rows),
`profiles` (14 rows), `agent_task_queue` (355 rows). All heavily referenced, none of them data.
A catalogue of *data* has to discount `app_operational`. That is the `lifecycle_weight`, and the
shard labels already provide it for all 812 (the 212 views become `lens`, the 409 functions
`routine`).

**Rejected v3 — rows without bytes.** `gs_entities` fell to #6 behind three larger tables while
carrying degree 89 and 131 referencing files. Adding a footprint term and lifting `degree` from
0.18 to 0.26 put the spine back at #5 and moved `abr_registry` (20M rows, 6.9 GB, **zero app
references**) from rank 64 to rank 56.

**Accepted, with a caveat I will not paper over.** `abr_registry` at rank 56 is the honest output
of a usage-weighted score: it is the largest object in the database and no product surface reads
it. Distorting the formula until it floats would corrupt every other row. The right fix is in the
UI, not the maths — **the ledger must ship sort-by-rows and sort-by-bytes as first-class controls,
and `importance` is the default sort, not the only one.**

Second honest caveat: **the highest-ranked view is #183** (`v_org_funding_profile`). Views carry
zero bytes and low degree, so a single flat list is 100% tables and matviews for 182 rows. Given
206 of them are anon-readable API surfaces and several are exactly Ben's asks (`v_entity_360`,
`org_governance`, `v_charity_explorer`), the front page should be **three ranked strips —
Sources / Derived / Lenses — not one list.** That is a measured design constraint, not a taste call.

### 4.3 Top 30 — the actual output

Run over all 1,433 objects. `deg` = FK + lineage + curated joins. `app` and `pipe` are
**distinct files**, not hits.

```
  #  score kind           rows  deg  app pipe  last write  name
  1  0.938 table       823,620   32   47   56  2026-08-07  austender_contracts
  2  0.930 table       157,116   45  133  138  2026-08-14  justice_funding
  3  0.921 table       104,427   74  211  146  2026-08-14  organizations
  4  0.910 table     3,429,184   15   53   71  2026-08-09  gs_relationships
  5  0.909 table       609,448   89  131  237  2026-08-14  gs_entities
  6  0.897 table     2,549,483   16   21   37  2026-08-07  political_donations
  7  0.889 table        11,159   35   53   89  2026-08-13  foundations
  8  0.854 table         2,136   34  180  196  2026-08-13  alma_interventions
  9  0.847 table        66,023   16   23   70  2026-08-07  acnc_charities
 10  0.846 table        25,897   15   55   52  2026-08-13  grant_opportunities
 11  0.813 table         8,538   18   18   26  2026-08-07  alma_funding_opportunities
 12  0.803 matview     188,139   14   25   14  2026-08-13  mv_entity_power_index
 13  0.790 table       339,698   15   30   40  2026-06-18  person_roles
 14  0.755 table           218   14   66   53  2026-08-08  public_profiles
 15  0.751 table        22,364    6   21   14  2026-08-08  rogs_justice_spending
 16  0.739 table       360,488   11   19   12  timeout     acnc_ais
 17  0.723 table         4,218    6   19   18  2026-08-13  foundation_programs
 18  0.703 table         7,369    8    6   21  2026-08-07  oric_corporations
 19  0.701 table            46   12   35   15  2026-08-13  jr_sites
 20  0.697 table           872    4   32   20  2026-08-13  alma_media_articles
 21  0.684 table           227   13   17   20  2026-07-29  storytellers
 22  0.678 table           367    3   39   36  2026-08-13  justice_matrix_cases
 23  0.677 table         3,109    6   16   17  2026-08-14  alma_intervention_outcomes
 24  0.677 table        12,180    1   25   27  2026-08-09  social_enterprises
 25  0.671 table        26,241    4    8   10  2026-08-07  ato_tax_transparency
 26  0.661 matview      15,003   11    4   11  2026-08-13  mv_foundation_grantees
 27  0.657 table            49    4   26   24  2026-08-14  articles
 28  0.650 matview       1,997    8   15    8  2026-08-13  mv_funding_deserts
 29  0.644 table           631    3   54   52  2026-07-23  alma_evidence
 30  0.641 table         6,001    6   19   14  2026-05-23  foundation_grantees
```

### 4.4 Sanity check — are these the important ones?

**Yes for the top 13.** Against Ben's nine named domains: spend (#1 austender, #2 justice_funding,
#15 rogs), giving (#6 political_donations), philanthropy (#7 foundations, #17 foundation_programs,
#26 mv_foundation_grantees, #30 foundation_grantees), charities (#9 acnc_charities, #16 acnc_ais),
organisations doing the work (#3 organizations, #8 alma_interventions, #24 social_enterprises),
director links (#13 person_roles), the spine (#4, #5), power (#12 mv_entity_power_index),
media (#20 alma_media_articles, #27 articles). Every pillar is represented in its right order of
weight. Nothing in the top 13 is something I would argue against.

**Four entries I checked and would defend, with the reason the UI must show:**

- **#14 `public_profiles` (218 rows)** — 66 referencing app files, degree 14. It really is one of
  the most-read tables in both apps. Small ≠ unimportant. The `rows` column makes this legible.
- **#16 `acnc_ais` (360,488 rows), `last write: timeout`** — this is the catalog working as
  intended. The probe honestly reports that it could not establish freshness rather than printing
  a comforting zero.
- **#19 `jr_sites` (46 rows)** — 35 app files, degree 12. A tiny but structurally central
  JusticeHub table. Correct.
- **#13 `person_roles`, last write 2026-06-18** — nearly two months stale, and it is the entire
  director-links pillar. Precisely the row that should be high and marked stale.

**Two things I would flag as still imperfect** (documented, not hidden): `abr_registry` at 56 and
the first view at 183, both discussed in §4.2.

**Effect of the ACT discount (Ben's decision 1):** 238 objects carry `act_business = true`
(221 seeded from the canonical D14 list + 17 caught by the name rule; the canonical map's own
count is 237, so the two agree to within 1). Under the flat weighting `ghl_contacts` ranked #12,
`xero_invoices` #16 and `communications_history` #28. With the 0.50 discount, **zero ACT objects
appear in the top 100.**

---

## 5. THE GAP METRICS — 23 metrics, today's real values

All 23 are registered in `20260815000200_clarity_gap_metrics_seed.sql` with the exact SQL that
produces them (one, `matviews_unregistered`, ships disabled — see §7.2). Every metric whose SQL reads only existing tables was **executed today** and its
result is below. Metrics that read `clarity_object` (which does not exist yet) carry a **BASELINE**
computed from the same underlying measurements by an offline scan, and are marked as such.

| # | Metric | Today | Reading |
|---|---|---|---|
| 1 | **Objects with a written purpose** | **812 / 1,433 = 56.7%** | The shards describe every table and matview and **zero** of the 212 views and 409 functions |
| 2 | **Objects with a governance row** (owner, licence, PII) | **25 / 1,433 = 1.7%** | `data_catalog` has the right 21 columns at 1.7% fill |
| 3 | **Objects whose last write is knowable** | **608 / 812 = 74.9%** *(BASELINE)* | 632/714 tables have a candidate column; **1/98 matviews** |
| 4 | **Objects older than 180 days** | **141 of 608 with a known last-write** *(BASELINE)* | None older than 730 days — nothing is truly abandoned, plenty is drifting |
| 5 | **Matviews in no scheduled refresh** | **71 / 98 = 72.4%**, **2,871,838 rows** | `refresh_civicgraph_mvs()` hardcodes 27 names |
| 5b | ... in **neither** registry | **55 matviews, 1,374,264 rows** | `refresh-views-v2.mjs` hardcodes 43, a strict **superset** of the function's 27 — so reconciliation is purely additive |
| 6 | **Matviews stale > 48 h** | **70 / 98 = 71.4%** | 54 never logged; 16 last succeeded 2026-08-09; 28 current |
| 7 | **Matviews falling back from CONCURRENTLY** | **4** | `mv_abr_name_lookup`, `mv_grant_contract_overlap`, `mv_indigenous_procurement_score`, `mv_lga_indigenous_proxy_score` — each takes an ACCESS EXCLUSIVE lock nightly for want of a unique index |
| 8 | **Dark rows** (populated, nothing reads it) | **184 objects / 5,087,126 rows = 9.7%** *(BASELINE)* | **Corrects "290 objects / 14,894,611 rows".** Largest genuine orphans survive: `asic_name_lookup` 2,149,868 and `privacy_audit_log` 1,278,440, both with zero references of any kind |
| 9 | **Views with no reference anywhere** | **132 / 212 = 62.3%** *(BASELINE)* | 60 referenced from app source, 78 from anything |
| 10 | **Justice edge → grant drill-through** | **0 of 49,426 = 0.0%** | Re-measured independently. `gs_relationships.source_record_id` is uuid-shaped and matches **neither** `justice_funding.id` nor `source_statement_id`. A dead key namespace, not a partial orphan |
| 11 | **Declared bridge columns populated** | **0 of 53,521 = 0.0%** | `nz_charities.gs_entity_id` 0/45,192 · `ndis_participants_lga.lga_code` 0/8,329 |
| 12 | **ABN attribution, money tables** | **1,125,402 / 1,272,000 = 88.5%** | austender 765,431/823,620 = **92.9%** · justice_funding 149,207/157,116 = **95.0%** · grantconnect_awards 210,764/291,264 = **72.4%** (68,172 well-formed ABNs absent from `gs_entities`) |
| 13 | **ABN attribution, donations** | **639,430 / 2,549,483 = 25.1%** | Only 653,261 rows carry any `donor_abn` at all (25.6%) — the loss is at collection, not matching. Three times worse than any other money table |
| 14 | **Entities with a resolved LGA** | **294,214 / 609,448 = 48.3%** | 282,182 (46.3%) hold no postcode at all — structurally unplaceable, not merely unresolved |
| 15 | **Funding postcodes that exist in the geography reference** | **2,790 / 6,684 = 41.7%** | 3,894 postcodes carry money and have no row in `postcode_geo`, which holds only 2,909 distinct postcodes. **The reference table is smaller than the fact table it is supposed to place.** Separately `mv_funding_by_lga` has 1,729 rows for 548 LGA codes = 3.16 rows per key — the same grain defect already found in `mv_funding_deserts` |
| 16 | **ALMA interventions with linked evidence** | **1,277 / 2,136 = 59.8%** | Outcomes thinner: 1,005 / 2,136 = 47.0% |
| 17 | **Relations readable with the public anon key** | **451 / 1,024 = 44.0%** | 232 tables · 13 matviews · **206 of 212 views**. **99 of those views run with DEFINER rights**, so base-table RLS does not apply. 215 tables sit RLS-on-zero-policy (unreachable, not protected — a different diagnosis with a different fix) |
| 18 | **ACT private-business objects anon-readable** | **47 / 238 = 19.7%** *(BASELINE)* | Includes `canonical_entities`, `entity_identifiers`, `founder_intakes`, `founder_intake_messages`. 213 of 238 carry an anon GRANT; RLS stops all but 47. Decision 1 is the fix |
| 19 | **SECURITY DEFINER functions anon can execute** | **3** | `rebuild_funder_board_paths`, `rebuild_funder_intelligence`, `rebuild_place_funding_snapshot` — all three write. Separately, **340 of 410** functions are anon-executable |
| 20 | **Concepts with more than one live definition** | **1** | "justice funding, cleaned": view `justice_funding_clean` (`sector <> 'procurement'`) = **151,866 rows** vs `measure_kind='grant'` = **126,673 rows / $46.097bn**. Gap 25,193 rows |
| 21 | **Objects whose size can be established** | **1,006 / 1,024 = 98.2%** *(BASELINE)* | The 18 exceptions are the views that time out at 3 s |
| 22 | **Row counts that are estimates** | **6** | All ≥2M rows; worst `reltuples` error **0.26%** |

### 5.1 The `justice_funding` measure_kind breakdown, since metric 20 turns on it

```
measure_kind          rows      $bn
grant              126,673   46.097
contract_value      29,519    6.106
expenditure_aggregate  848   66.126     <-- 55% of the dollars in 0.5% of the rows
budget_announcement     76    2.236
```

Summing everything gives **$120.6bn** against **$46.1bn** for grants alone — a 2.6× inflation on
the whole table. (The "45×" in VERIFICATION.md is the same defect measured on the youth-justice
topic subset; both are true at their own scope, which is exactly why `clarity_metric_definition`
records scope alongside the number.)

### 5.2 Row-count trust, since every metric above depends on it

`pg_stat_user_tables.n_live_tup` on this instance, sampled today:

| Table | `n_live_tup` | Actual |
|---|---:|---:|
| `political_donations` | **0** | 2,549,483 |
| `data_catalog` | **0** | 25 |
| `qld_watchhouse_snapshot_rows` | **144** | 8,488 |
| `gs_entities` | 558,781 | 609,448 |
| `justice_funding` | 157,116 | 157,116 |

`pg_class.reltuples`, by contrast, across 614 comparable objects: **421 exact**, 460 within 1%,
497 within 5%. It is badly wrong only on truncated staging tables (`stg_ratio_winners`:
reltuples 15,353, actual 0) — which is precisely where an estimate is harmless and the
`row_count_is_estimate` flag matters. **All 6 relations ≥2M rows are within 0.26%:**

```
abr_registry        20,006,350  reltuples 20,006,350   0.00%
mv_abr_name_lookup   9,038,737  reltuples  9,042,987   0.05%
gs_relationships     3,429,184  reltuples  3,423,921   0.15%
political_donations  2,549,483  reltuples  2,549,939   0.02%
asic_companies       2,167,533  reltuples  2,161,903   0.26%
asic_name_lookup     2,149,868  reltuples  2,149,868   0.00%
```

The 2,000,000 threshold is therefore not a guess: it is the point above which exact counting buys
nothing measurable.

---

## 6. THE SEMANTIC LAYER — an honest assessment

**Short version: the 199K embeddings are real, indexed, and cannot do the job people assume.
Do not build catalog relatedness on them. Build it on structure, which is free, exact, and
better — and if you want text similarity in the catalog, embed the 1,433 catalog rows, which is
a corpus 100× smaller and 1,000× faster.**

### 6.1 What is actually there

**39 vector columns** across 39 relations (23 on tables/matviews, 16 on views). Indexes are
**mixed, not all HNSW** — COMPLETENESS.md's claim that `idx_gs_entities_embedding` is HNSW is
wrong; it is **ivfflat**:

| Table | dim | index | embedded / total |
|---|---|---|---|
| `gs_entities` | 1536 | **ivfflat** | **135,208 / 609,448 = 22.2%** |
| `grant_opportunities` | 1536 | **hnsw** (+ a second ivfflat) | 25,890 / 25,897 = 99.97% `[R]` |
| `knowledge_chunks` | 384 | **none** | 19,413 / 19,413 `[R]` |
| `foundations` | 1536 | ivfflat | 10,775 / 11,159 = 96.6% `[R]` |
| `civic_intelligence_chunks` | 1536 | **none** | 7,022 / 7,022 `[R]` |
| `alma_evidence` | 1536 | hnsw | 631 / 631 `[R]` |

Five of the 23 table-level vector columns have **no index at all**.

### 6.2 Measured performance — this is the finding

`gs_entities` is the only corpus that matters for "entities related to this one", and it does not
work at interactive speed.

```
EXPLAIN (ANALYZE) SELECT gs_id FROM gs_entities ORDER BY embedding <=> '<literal>' LIMIT 10;
  Index Scan using idx_gs_entities_embedding  (actual time=11325.8..11331.7 rows=10)
  Buffers: shared hit=886 read=24635
  Execution Time: 11332.2 ms          -- ivfflat.probes = 1
```

- **probes = 1 → 11.3 s.  probes = 10 → 47.6 s.**
- The index is **2,846 MB against a 4,956 MB table** — 57% of `gs_entities`' entire footprint is
  a vector index on a column that is 22% populated. It does not fit in cache, hence 24,635 cold
  buffer reads.
- The 8-second RPC ceiling means **no app request can ever run this query.**

The smaller corpora are usable: `foundations` **1.99 s**, `grant_opportunities` (HNSW) **0.73 s**.

### 6.3 Measured quality — the second finding

The neighbours are **lexical, not semantic**. Seeded with "Save The Children Australia":

```
1.0000  Save The Children Australia
0.8586  SAVE THE CHILDREN IMPACT FUND LIMITED
0.8307  Save A Child's Heart Australia
0.8303  Save Our Services Australia Inc.
0.8232  The Trustee For Save The Children Australia Trust
0.7778  SAVED (AUS) LTD
0.7562  SAVE OUR YOUNG AUSTRALIANS LIMITED
```

Every neighbour shares the token "Save". Seeded with "Youth Justice Intervention Grants" in
`grant_opportunities`, every neighbour contains "Youth" or "Justice". These embeddings encode the
**name string**, not a description of what the organisation does. For entity relatedness that is
strictly worse than `pg_trgm`, which is already installed, already indexed, and returns in
milliseconds. (It also surfaced a duplicate: two `gs_entities` rows for "Save The Children
Australia" at cosine 1.0000 — useful for the dedup lane, not for relatedness.)

### 6.4 What to do instead — and it is better

**(a) Catalog relatedness should be structural.** Free, exact, and instantly explainable. Two
signals, both already in the schema:

```sql
-- "Objects related to this one" — no embeddings involved.
WITH seed AS (SELECT $1::text AS k)
SELECT o.object_key, o.object_kind, o.row_count, o.importance,
       sum(w.weight) AS relatedness,
       string_agg(DISTINCT w.reason, ', ') AS why
FROM seed s
CROSS JOIN LATERAL (
  -- 1. shares a downstream view or matview  (695 lineage edges)
  SELECT e2.tgt_object AS other, 3.0 AS weight, 'shares downstream ' || e1.src_object AS reason
    FROM clarity_edge e1
    JOIN clarity_edge e2 ON e2.src_object = e1.src_object
                        AND e2.mechanism = 'view_lineage'
   WHERE e1.tgt_object = s.k AND e1.mechanism = 'view_lineage' AND e2.tgt_object <> s.k
  UNION ALL
  -- 2. co-referenced in the same source file (files naming >25 objects are ignored)
  SELECT r2.object_key, 1.0, 'used together in ' || regexp_replace(r1.file_path,'^.*/','')
    FROM clarity_code_ref r1
    JOIN clarity_code_ref r2 ON r2.file_path = r1.file_path AND r2.object_key <> s.k
   WHERE r1.object_key = s.k AND r1.ref_class IN ('app','script')
     AND (SELECT count(*) FROM clarity_code_ref r3 WHERE r3.file_path = r1.file_path) <= 25
  UNION ALL
  -- 3. a declared or measured join
  SELECT CASE WHEN e.src_object = s.k THEN e.tgt_object ELSE e.src_object END, 4.0,
         'joins on ' || coalesce(e.src_column,'?')
    FROM clarity_edge e
   WHERE (e.src_object = s.k OR e.tgt_object = s.k) AND e.mechanism NOT IN ('view_lineage')
) w
JOIN clarity_object o ON o.object_key = w.other
WHERE o.missing_since IS NULL AND NOT o.act_business
GROUP BY o.object_key, o.object_kind, o.row_count, o.importance
ORDER BY relatedness DESC, o.importance DESC
LIMIT 12;
```

I ran the two signals offline against today's scan data. The output is immediately right:

```
justice_funding      → alma_interventions(129) gs_entities(97) organizations(87)
                       austender_contracts(46) gs_relationships(40) acnc_charities(32)
                       [downstream views: gs_entities 24, austender_contracts 15, alma_interventions 10]
foundations          → gs_entities(55) gs_relationships(37) grant_opportunities(36)
                       foundation_programs(30) justice_funding(27) person_roles(23)
austender_contracts  → gs_entities(71) justice_funding(46) gs_relationships(34)
                       political_donations(32) foundations(23)
```

`foundations → foundation_programs, grant_opportunities` and
`austender_contracts → political_donations` are exactly the analytic adjacencies Ben is after,
and every one comes with a citable reason ("used together in `report-service.ts`") rather than a
cosine number nobody can argue with.

**(b) If you want text search over the catalog, embed the catalog, not the data.**
1,433 rows × (name + purpose + grain + caveat) is one batch of embeddings and an HNSW index of a
few megabytes. Sub-millisecond, and it answers the question people actually ask the catalog
("where is the child protection stuff?"). The column is already in the DDL —
`clarity_column.is_vector` exists so the layer is visible; adding `clarity_object.embedding
vector(1536)` plus one HNSW index is a three-line follow-up migration when someone wants it.
I have deliberately not added it now: it needs an embedding call the refresh function cannot make.

**(c) For entity relatedness on `gs_entities`, either fix the index or don't ship it.**
Options in cost order: (i) use `pg_trgm` and stop — it is what the current embeddings effectively
encode anyway; (ii) rebuild as `halfvec(1536)` + HNSW, roughly a 4× smaller index, and re-measure;
(iii) precompute a `gs_entity_neighbours` table nightly for a curated subset (e.g. the 41,614
entities in the interlock MV) and serve lookups from it. Do not put the live query behind a page.

---

## 7. RUNNER + SCHEDULE

`scripts/snapshot-clarity.mjs` (to write; mirrors the existing `snapshot-data-catalog.mjs`):

```
1. psql -c "SELECT * FROM clarity_refresh();"                       ~2.5 min
2. for each object where row_count_probe = 'deferred_too_large':    ~2 min
     one statement, SET statement_timeout='3s', then clarity_set_probe(...)
     (this is the only place a per-object timeout can actually fire — see §2d)
3. node scripts/scan-code-references.mjs   -> clarity_code_ref (app/script/migration)
     MUST exclude: node_modules, .next, dist, _archive, *.disabled,
                   database.types.ts  <- generated, names every table, destroys the signal
     MUST count DISTINCT FILES, not hits
4. psql -c "SELECT clarity_score();"                                seconds
5. psql -c "SELECT * FROM clarity_measure_gaps('cheap');"           seconds
   weekly: clarity_measure_gaps(NULL) including the two 'expensive' ABN metrics (~5 min)
6. log to agent_runs via scripts/lib/log-agent-run.mjs
```

Register nightly, on the same lane as `refresh-views-v2.mjs`, **not** as a Vercel cron
(`vercel.json` crons are HTTP requests; a 4.5-minute plpgsql call under a shared pooler is not a
safe serverless request):

```sql
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, freshness_threshold_hours,
                             auto_create_task, priority, params)
VALUES ('snapshot-clarity', 24, true, 26, false, 2, '{}'::jsonb)
ON CONFLICT (agent_id) DO UPDATE SET interval_hours = 24, enabled = true, updated_at = now();
```

`/api/clarity/refresh` should exist only as an admin-triggered `clarity_score()` re-rank
(sub-second, safely inside the 8 s ceiling). It must never call `clarity_refresh()`.

## 7.1 Decision 2 — reconciling the matview refresh registries

I measured both registries and they reconcile cleanly, which was not obvious in advance:

```
refresh_civicgraph_mvs()          27 matviews   (pg_cron jobid 4, 0 17 * * *)
scripts/refresh-views-v2.mjs      43 matviews
intersection                      27            <- the function's list is a strict SUBSET
in neither                        55 matviews, 1,374,264 rows
```

Because the mjs list is a strict superset, **the reconciliation is purely additive — there is
nothing to remove and no conflict to arbitrate.** The fix is one migration that rewrites the
function's hardcoded array to `43 + the 55 = 98`, and then deletes `VIEW_LIST` from the mjs
script so it reads the function's list instead. Do it in two steps: add the 16 mjs-only names
first (they have a proven refresh path), then add the 55 unknowns in batches, watching
`mv_refresh_log.duration_ms` — four of them already fall back from `CONCURRENTLY` and take an
ACCESS EXCLUSIVE lock, so a naive 98-object nightly job could hold locks far longer than the 27
does today. I have not written that migration; it changes a running production job and belongs
with a human watching the first run.

---

## 7.2 CROSS-SESSION COLLISION — read this before applying anything

`git status` in `/Users/benknight/Code/grantscope` shows a **parallel work stream** has written
five unapplied migrations today under `migrations/` (not `supabase/migrations/`) and has
**modified `scripts/refresh-views-v2.mjs`** (121 insertions, 99 deletions, uncommitted):

```
migrations/2026-08-14-mv-refresh-registry.sql              380 lines
migrations/2026-08-14-mv-refresh-cron.sql                  219
migrations/2026-08-14-catalog-object-scope.sql             467
migrations/2026-08-14-revoke-anon-private-reads.sql        313
migrations/2026-08-14-fix-misdeclared-service-role-policies.sql  151
```

Three of them intersect this work directly, and in two places mine must defer to theirs.

**(a) Decision 2 is already implemented, better than my §7.1 recommendation.**
`mv-refresh-registry.sql` creates `mv_refresh_registry (mv_name, tier IN
('nightly','weekly','on_demand','retire'), enabled, force_non_concurrent, health, notes)` plus
`mv_refresh_plan()` that derives refresh ORDER from `pg_depend` *through plain views* — which
catches ordering constraints that direct matview→matview edges miss. `mv-refresh-cron.sql` then
rewrites `refresh_civicgraph_mvs()` to read the plan instead of its hardcoded array, and both
pg_cron and `refresh-views-v2.mjs` read the one table. **Take theirs.** §7.1 above is now a
description of the problem, not a proposal.

**But it breaks one of my gap metrics, concretely.** `matviews_unscheduled` measures
"unscheduled" by parsing matview names out of `refresh_civicgraph_mvs().prosrc`. Once that
function reads `mv_refresh_plan()`, its body contains **no matview names at all**, and the metric
would report a confident, wrong **98 of 98 unscheduled**. I have shipped the successor —
`matviews_unregistered`, which reads `mv_refresh_registry` — seeded `enabled = false` because its
table does not exist yet. **Flip the pair in the same change that applies their migration.** This
is exactly the failure mode the `clarity_gap_metric` registry exists to make visible: the SQL is
in the database next to the number, so a metric that has silently stopped meaning what it says can
be found.

**(b) Decision 1 has a better shape than my boolean.** `catalog-object-scope.sql` creates
`catalog_object_scope (object_name, scope IN ('civic','act_private','act_private_review',
'platform'), reason, decided_by, decided_at)` with no anon policy and an explicit rule that an
unclassified object is **visible and flagged, never hidden**. That four-value taxonomy is
better than `clarity_object.act_business` because it separates "extract now" from "entangled with
civic objects, resolve first" — which is precisely the state of the 13 boundary cases I found
(`goods_procurement_*`, `email_financial_documents`, `knowledge_links`, …). **Take theirs, and
derive my flag from it**; the exact three-line `UPDATE ... FROM catalog_object_scope` is written
into the header of `20260815000200`. Keep my name rule as the fallback so a `xero_*` table created
next month cannot reach a civic surface by default.

**(c) The exposure remediation is theirs too.** `revoke-anon-private-reads.sql` and
`fix-misdeclared-service-role-policies.sql` act on the same 451-anon-readable / 240-open-policy
surface I measured in §5. Nothing in my three migrations changes a grant or a policy, so they do
not conflict — but gap metrics 17, 18 and 19 will move the moment those are applied, and their
recorded baselines (`451/1,024`, `47/238`, `3`) are the before picture.

**Apply order, if all of this lands:** their registry → their cron → their scope table → their
revokes → my schema → my refresh function → my seed (with the two metric flips applied).

---

## 8. WHAT I VERIFIED, INFERRED, AND DID NOT CHECK

**Verified by direct query or by executing the SQL this session:** the 714/98/212/410 object
counts; view grants to anon/authenticated/service_role and the 109 `security_invoker` split; the
695-edge lineage graph; all 212 view row counts with a 3 s cap (194 ok / 18 timeout / 26 zero) and
its 122 s cost; the 410-row function classification (115 trigger, 64 SECURITY DEFINER, 340
anon-executable, 3 anon-executable SECURITY DEFINER, 386,420 chars of prosrc) and the 20
trigger functions attached to nothing; the `pg_proc.prosrc` scan run two ways (202 relations
under query-shaped patterns offline, 209 under the in-database word-boundary match, 586 pairs,
103.8 s naive vs 3.6 s with a `strpos` pre-filter) and the trigger
map (219 on 178 tables); the code-reference scan over 5,105 files in both repos, both loose and
query-shaped; the 806-object exact count sweep (92.7 s) and the 633-object freshness sweep
(53.4 s, 2 deferred); `reltuples` accuracy across 614 objects and on all 6 relations ≥2M;
`n_live_tup` breakage on 5 sampled tables; role `statement_timeout` values, the `exec_sql` grant
list and body, and the empirical 8 s cancel; **that `SET LOCAL statement_timeout` inside plpgsql
does not cancel a running query**; both matview refresh registries and their exact set relation;
`mv_refresh_log` (44 logged, 70 stale >48 h, 4 CONCURRENTLY fallbacks); RLS counts (693/21/762/215)
and the 240 anon-open SELECT policies; anon-readability with RLS resolved (451/1,024); the
justice-edge orphan rate (0 of 49,426, my own sample and my own cast); the four ABN attribution
rates; `nz_charities` and `ndis_participants_lga` at 0%; postcode placeability (2,790/6,684);
`gs_entities` LGA and postcode fill; ALMA evidence and outcome coverage; the `justice_funding`
measure_kind split in rows and dollars; `justice_funding_clean` at 151,866; the 39 vector columns
with their real index types; `gs_entities` embedding fill (135,208/609,448) and its 2,846 MB index;
`EXPLAIN ANALYZE` on the ivfflat search at probes=1 and the wall clock at probes=10; the
`foundations` and `grant_opportunities` similarity output; `pg_database_size` = 28 GB; that no
`clarity_*` or `data_inventory*` object already exists; PG version 17.6 and
`extensions.gin_trgm_ops`.

**Inferred, and labelled as such:** the D14 membership list — 221 names extracted from
`CANONICAL-DATA-MAP.md` plus 17 caught by a name rule = 238, against the canonical map's own
stated 237. The two agree, but I did not re-derive the classification from first principles, and
13 rule-matched objects (`goods_procurement_*`, `goods_communities`, `email_financial_documents`,
`knowledge_links`, `act_communities`, …) are arguable civic/ACT boundary cases that need Ben's
call before the cluster is physically moved. The lifecycle weights in the ranking are my judgement
calibrated against the observed output, not a derived constant.

**Not checked:** whether the 132 unreferenced views are reachable through dynamic table names or
template literals (the scan is blind to both, so 132 is an upper bound); the contents of any jsonb
column; the Empathy Ledger project `yvnuayzslukamizrlhwb` (no credentials in this repo) and
therefore any bridge-column fill rate across that seam; whether the 55 SECURITY DEFINER functions
that are *not* anon-executable leak anything; storage buckets; the actual runtime of a 98-object
`refresh_civicgraph_mvs()`; whether `clarity_refresh()` runs end to end — **the DDL and the
function are written and reasoned about but have not been applied, so they are unexecuted code.**
Every measurement above was taken with standalone SQL, not by running the function.


---

## 9. APPENDIX — the SQL in full

Reproduced verbatim from the three migration files so this document stands alone. Nothing below
has been applied.

### 9.1 `20260815000000_clarity_catalog_schema.sql`

```sql
-- =====================================================================================
-- CivicGraph Clarity — catalog schema (part 1 of 2: DDL)
--
-- NOT APPLIED. Apply with psql (gsql.mjs -c mangles $$ dollar-quoting):
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000000_clarity_catalog_schema.sql
--
-- WHAT THIS CATALOGUES (measured 2026-08-14, direct psql):
--   714 tables + 98 materialized views + 212 regular views = 1,024 relations
--   410 pg_proc rows (409 distinct names) = the RPC / trigger surface
--   -------------------------------------------------------------------
--   1,433 objects.  BUILD-SPEC.md seeded 812.  That is the whole point of this file.
--
-- FACTS THIS SCHEMA IS BUILT AROUND (each verified this session, not assumed):
--   * pg_stat_user_tables.n_live_tup is BROKEN here: political_donations -> 0
--     (actual 2,549,483), data_catalog -> 0 (actual 25), gs_entities -> 558,781
--     (actual 609,448). Never read it.
--   * pg_class.reltuples is TRUSTWORTHY at the top: all 6 objects >= 2M rows are
--     within 0.26% of exact. It is wrong only on truncated staging tables
--     (stg_ratio_winners: reltuples 15,353, actual 0) -> hence is_estimate.
--   * information_schema.columns does not cover materialized views (0 of 98).
--     Column introspection MUST read pg_attribute.
--   * Only 1 of 98 materialized views carries a timestamp column. Matview freshness
--     cannot come from a column probe; it comes from mv_refresh_log.
--   * 451 of 1,024 relations are readable by the `anon` role once RLS is resolved.
--     Exposure is a first-class catalog column, not a footnote.
-- =====================================================================================

BEGIN;

-- ------------------------------------------------------------------ enums
DO $enum$ BEGIN
  CREATE TYPE clarity_object_kind AS ENUM ('table','matview','view','function');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_lifecycle AS ENUM (
    'core_source',      -- ingested from a named external source
    'derived',          -- computed from other objects (most matviews)
    'crosswalk',        -- identifier resolution between universes
    'app_operational',  -- powers a product surface / workflow state
    'staging',          -- transient, feeding a migration or dedup lane
    'backup',           -- dated point-in-time snapshot, restorable, not live
    'superseded',       -- replaced by a newer object that still coexists
    'scaffold_empty',   -- declared but never populated
    'lens',             -- a regular view: a saved question, not stored data
    'routine'           -- a function/procedure
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_probe AS ENUM ('ok','no_column','deferred_too_large','timeout','error','not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_verdict AS ENUM ('keep','suspect','cruft');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_ref_class AS ENUM ('app','script','migration','db_function','view_lineage','trigger');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

-- ------------------------------------------------------------------ the ledger
-- One row per object in the WHOLE public schema: relation OR routine.
-- object_key is stable: relname for relations, 'proname(identity args)' for routines,
-- so the 1 overloaded name in pg_proc does not collide.
CREATE TABLE IF NOT EXISTS clarity_object (
  object_key          text PRIMARY KEY,
  object_name         text NOT NULL,
  object_kind         clarity_object_kind NOT NULL,
  oid                 oid,                       -- current oid; changes on rebuild, do not key on it

  -- ---- size. Exact below the threshold, reltuples above, always flagged.
  row_count           bigint,
  row_count_is_estimate boolean NOT NULL DEFAULT false,
  row_count_probe     clarity_probe NOT NULL DEFAULT 'not_applicable',
  row_count_ms        integer,
  bytes               bigint NOT NULL DEFAULT 0,  -- pg_total_relation_size; 0 for views/functions
  column_count        integer,
  nullable_columns    integer,

  -- ---- structure
  fk_out              integer NOT NULL DEFAULT 0,   -- declared FKs this object owns
  fk_in               integer NOT NULL DEFAULT 0,   -- declared FKs pointing at it
  lineage_out         integer NOT NULL DEFAULT 0,   -- base relations this view/matview reads
  lineage_in          integer NOT NULL DEFAULT 0,   -- views/matviews built on top of it
  join_out            integer NOT NULL DEFAULT 0,   -- curated implicit joins (clarity_edge)
  join_in             integer NOT NULL DEFAULT 0,
  degree              integer GENERATED ALWAYS AS
                        (fk_out + fk_in + lineage_out + lineage_in + join_out + join_in) STORED,

  -- ---- freshness
  freshness_column    text,          -- auto-picked from clarity_freshness_candidate
  freshness_source    text CHECK (freshness_source IN
                        ('column','mv_refresh_log','cron','none')) DEFAULT 'none',
  last_write_at       timestamptz,
  freshness_probe     clarity_probe NOT NULL DEFAULT 'no_column',
  freshness_ms        integer,

  -- ---- routines only (null for relations)
  routine_language    text,
  routine_kind        text CHECK (routine_kind IN ('trigger','security_definer','plain')),
  routine_returns     text,
  routine_volatility  char(1),
  routine_src_bytes   integer,
  trigger_attachments integer NOT NULL DEFAULT 0,   -- how many triggers actually use it

  -- ---- exposure / governance. Measured, not asserted.
  rls_enabled         boolean NOT NULL DEFAULT false,
  policy_count        integer NOT NULL DEFAULT 0,
  anon_grant          boolean NOT NULL DEFAULT false,
  anon_open_policies  integer NOT NULL DEFAULT 0,
  anon_readable       boolean NOT NULL DEFAULT false,   -- grant AND (rls off OR an open SELECT policy)
  authenticated_grant boolean NOT NULL DEFAULT false,
  security_invoker    boolean,                          -- views: false => runs with owner rights
  security_definer    boolean,                          -- functions
  anon_execute        boolean,                          -- functions

  -- ---- classification. Seeded from the 2026-08-14 inventory shards, then editable.
  domain              text,
  lifecycle           clarity_lifecycle,
  grain               text,
  purpose             text,
  caveat              text,
  join_keys           text,

  -- ---- Ben's decision 1: the ACT private-business cluster leaves this database.
  -- Flagged, not deleted, and the flag records WHY so it stays auditable.
  act_business        boolean NOT NULL DEFAULT false,
  act_business_source text CHECK (act_business_source IN ('canonical_d14','name_rule','manual')),

  -- ---- usage. File-level counts. Raw hit counts are useless: justice_funding
  -- scores 3,293 hits inside ONE bulk-INSERT ingest .sql file.
  refs_app            integer NOT NULL DEFAULT 0,   -- distinct files under apps/web/src or JusticeHub/src
  refs_script         integer NOT NULL DEFAULT 0,
  refs_migration      integer NOT NULL DEFAULT 0,
  refs_db_function    integer NOT NULL DEFAULT 0,   -- pg_proc.prosrc mentions -- NEVER scanned before
  owner_app           text CHECK (owner_app IN ('civicgraph','justicehub','both','neither'))
                        NOT NULL DEFAULT 'neither',

  -- ---- derived state + rank
  state               text,           -- live | tiny | empty | staging | backup | superseded
  importance          numeric(8,4) NOT NULL DEFAULT 0,

  -- ---- human, optional. A 'cruft' call needs a written reason or it becomes noise.
  verdict             clarity_verdict,
  verdict_reason      text,
  verdict_by          text,
  verdict_at          timestamptz,

  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  refreshed_at        timestamptz NOT NULL DEFAULT now(),
  missing_since       timestamptz,    -- set, not deleted, when the object disappears

  CONSTRAINT clarity_object_cruft_needs_reason
    CHECK (verdict IS DISTINCT FROM 'cruft'
           OR (verdict_reason IS NOT NULL AND btrim(verdict_reason) <> '')),
  -- A drop verdict is illegal while anything still reads it. This is the rule the
  -- 2026-08-14 pass broke: 19 objects were marked DROP while live code wrote to them.
  CONSTRAINT clarity_object_no_cruft_while_referenced
    CHECK (verdict IS DISTINCT FROM 'cruft'
           OR (refs_app = 0 AND refs_script = 0 AND refs_db_function = 0 AND lineage_in = 0))
);

CREATE INDEX IF NOT EXISTS idx_clarity_object_kind       ON clarity_object(object_kind);
CREATE INDEX IF NOT EXISTS idx_clarity_object_domain     ON clarity_object(domain);
CREATE INDEX IF NOT EXISTS idx_clarity_object_lifecycle  ON clarity_object(lifecycle);
CREATE INDEX IF NOT EXISTS idx_clarity_object_importance ON clarity_object(importance DESC);
CREATE INDEX IF NOT EXISTS idx_clarity_object_state      ON clarity_object(state);
CREATE INDEX IF NOT EXISTS idx_clarity_object_act        ON clarity_object(act_business) WHERE act_business;
CREATE INDEX IF NOT EXISTS idx_clarity_object_name_trgm  ON clarity_object USING gin (object_name extensions.gin_trgm_ops);

-- ------------------------------------------------------------------ freshness candidates
-- Editable priority list. Lives in a table so adding a column name is a one-row
-- insert, not a function redeploy.
CREATE TABLE IF NOT EXISTS clarity_freshness_candidate (
  column_name text PRIMARY KEY,
  priority    integer NOT NULL,
  note        text
);
INSERT INTO clarity_freshness_candidate (column_name, priority) VALUES
  ('updated_at',1),('created_at',2),('snapshot_at',3),('scraped_at',4),('last_seen',5),
  ('fetched_at',6),('inserted_at',7),('ingested_at',8),('synced_at',9),('imported_at',10),
  ('recorded_at',11),('collected_at',12),('published_at',13),('extracted_at',14),
  ('processed_at',15),('started_at',16),('run_at',17),('captured_at',18),('crawled_at',19),
  ('harvested_at',20),('observed_at',21),('last_updated',22),('event_time',23),
  ('occurred_at',24),('last_refreshed',25),('refreshed_at',26)
ON CONFLICT (column_name) DO NOTHING;

-- ------------------------------------------------------------------ columns
-- Reads pg_attribute, so materialized views are covered. information_schema.columns
-- returns nothing for all 98 of them.
CREATE TABLE IF NOT EXISTS clarity_column (
  object_key   text NOT NULL REFERENCES clarity_object(object_key) ON DELETE CASCADE,
  ordinal      integer NOT NULL,
  column_name  text NOT NULL,
  data_type    text NOT NULL,
  is_nullable  boolean NOT NULL,
  is_pk        boolean NOT NULL DEFAULT false,
  is_indexed   boolean NOT NULL DEFAULT false,
  is_vector    boolean NOT NULL DEFAULT false,
  vector_dim   integer,
  null_pct     numeric(6,2),      -- null until profiled
  distinct_est numeric,           -- pg_stats.n_distinct, null when unavailable
  profiled_at  timestamptz,
  PRIMARY KEY (object_key, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_clarity_column_name ON clarity_column(column_name);
CREATE INDEX IF NOT EXISTS idx_clarity_column_vec  ON clarity_column(object_key) WHERE is_vector;

-- ------------------------------------------------------------------ the join graph
-- Declared FKs are NOT the spine here: the largest objects carry none, and the top
-- FK target is a 17-row users table. So this holds THREE mechanisms:
--   fk            - a real pg_constraint
--   view_lineage  - pg_depend: this view/matview reads that base (695 edges today)
--   <the rest>    - curated implicit joins, each with a MEASURED match rate
CREATE TABLE IF NOT EXISTS clarity_edge (
  id                bigserial PRIMARY KEY,
  src_object        text NOT NULL,
  src_column        text,
  tgt_object        text NOT NULL,
  tgt_column        text,
  mechanism         text NOT NULL CHECK (mechanism IN
                      ('fk','view_lineage','uuid_stamp','abn','acn','name','postcode',
                       'lga','icn','gs_id','other')),
  declared          boolean NOT NULL DEFAULT false,
  -- Absence is a measurement. match_rate 0.000 on a declared-looking key is the
  -- single most useful cell in this whole catalog.
  match_rate        numeric(6,3),
  match_numerator   bigint,
  match_denominator bigint,
  match_method      text,            -- 'full scan' | 'LIMIT n=50000' | 'TABLESAMPLE ...'
  match_measured_at timestamptz,
  note              text,
  -- NULLS NOT DISTINCT (PG15+, this instance is 17.6) is REQUIRED: view_lineage rows
  -- carry NULL columns, and under default UNIQUE semantics NULLs never conflict, so
  -- every nightly refresh would re-insert all 695 lineage edges.
  UNIQUE NULLS NOT DISTINCT (src_object, src_column, tgt_object, tgt_column, mechanism)
);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_src ON clarity_edge(src_object);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_tgt ON clarity_edge(tgt_object);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_broken ON clarity_edge(match_rate)
  WHERE match_rate IS NOT NULL AND match_rate < 0.5;

-- ------------------------------------------------------------------ code references
-- File-level, classified. 'migration' is deliberately its own class: a table whose
-- only reference is the DDL that created it is NOT in use, and conflating the two
-- is exactly how 19 live tables ended up on a DROP list.
CREATE TABLE IF NOT EXISTS clarity_code_ref (
  id         bigserial PRIMARY KEY,
  object_key text NOT NULL,
  ref_class  clarity_ref_class NOT NULL,
  repo       text NOT NULL CHECK (repo IN ('civicgraph','justicehub','database')),
  file_path  text NOT NULL,        -- for db_function refs: the function's object_key
  hits       integer NOT NULL DEFAULT 1,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_key, ref_class, repo, file_path)
);
CREATE INDEX IF NOT EXISTS idx_clarity_code_ref_obj ON clarity_code_ref(object_key);

-- ------------------------------------------------------------------ history
-- Catches the failure nobody caught: justice_funding moved 218,022 -> 157,116 with
-- no alarm. A shrinking table is a signal.
-- Reconciliation: data_catalog_snapshots (1,419 rows, 25 tables, and columns
-- freshness_hours / provenance_coverage_pct / confidence_coverage_pct that a generic
-- sweep cannot compute) STAYS. clarity_object_history is the wide, whole-schema
-- series. clarity_refresh() writes both so there is exactly one writer.
CREATE TABLE IF NOT EXISTS clarity_object_history (
  id            bigserial PRIMARY KEY,
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  object_key    text NOT NULL,
  object_kind   clarity_object_kind NOT NULL,
  row_count     bigint,
  row_count_is_estimate boolean,
  bytes         bigint,
  last_write_at timestamptz,
  degree        integer,
  importance    numeric(8,4)
);
CREATE INDEX IF NOT EXISTS idx_clarity_hist_obj_time ON clarity_object_history(object_key, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_clarity_hist_time     ON clarity_object_history(snapshot_at DESC);

-- ------------------------------------------------------------------ gap metrics
-- Absence, made executable. Each row carries the SQL that measures it, so the
-- number on the screen and the number in the doc cannot drift.
CREATE TABLE IF NOT EXISTS clarity_gap_metric (
  metric_key    text PRIMARY KEY,
  title         text NOT NULL,
  family        text NOT NULL CHECK (family IN
                  ('coverage','freshness','schedule','usage','join_integrity',
                   'attribution','place','evidence','exposure','definition','countability')),
  question      text NOT NULL,          -- the plain-words question this answers
  numerator_sql text NOT NULL,          -- must return exactly one bigint
  denominator_sql text,                 -- null => the metric is an absolute count
  unit          text NOT NULL DEFAULT 'pct' CHECK (unit IN ('pct','count','rows','bytes')),
  direction     text NOT NULL DEFAULT 'higher_better'
                  CHECK (direction IN ('higher_better','lower_better')),
  target        numeric,                -- the number we are trying to reach
  cost_class    text NOT NULL DEFAULT 'cheap' CHECK (cost_class IN ('cheap','medium','expensive')),
  enabled       boolean NOT NULL DEFAULT true,
  note          text
);

CREATE TABLE IF NOT EXISTS clarity_gap_measurement (
  id           bigserial PRIMARY KEY,
  metric_key   text NOT NULL REFERENCES clarity_gap_metric(metric_key) ON DELETE CASCADE,
  measured_at  timestamptz NOT NULL DEFAULT now(),
  numerator    bigint,
  denominator  bigint,
  value        numeric(12,4),
  duration_ms  integer,
  status       text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','timeout','error')),
  error_text   text
);
CREATE INDEX IF NOT EXISTS idx_clarity_gap_meas ON clarity_gap_measurement(metric_key, measured_at DESC);

-- ------------------------------------------------------------------ metric definitions
-- The answer to "why is this number different on the other page".
-- Today's live instance: justice_funding_clean (a view, 151,866 rows,
-- sector <> 'procurement') vs OPPORTUNITY-MAP's mandatory measure_kind='grant'
-- (126,673 rows). Both are in use. Nothing reconciled them.
CREATE TABLE IF NOT EXISTS clarity_metric_definition (
  definition_key text PRIMARY KEY,
  concept        text NOT NULL,          -- e.g. 'justice funding, cleaned'
  expression     text NOT NULL,          -- the filter/aggregate, verbatim
  source_object  text NOT NULL,
  row_count      bigint,
  measured_at    timestamptz,
  is_canonical   boolean NOT NULL DEFAULT false,
  used_by        text[] NOT NULL DEFAULT '{}',
  rationale      text
);
-- Exactly one canonical definition per concept, enforced.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clarity_metric_canonical
  ON clarity_metric_definition(concept) WHERE is_canonical;

-- ------------------------------------------------------------------ read view
-- Granted to both apps' service roles so JusticeHub can read the catalog of a
-- database it co-owns (411 migrations vs GrantScope's 273).
CREATE OR REPLACE VIEW v_clarity_ledger
WITH (security_invoker = true) AS
SELECT
  o.*,
  dc.owner_team,
  dc.pii_level,
  dc.sla_hours,
  dc.licence,
  dc.public_export,
  dc.public_caveat,
  dc.source_url,
  dc.description                                        AS catalog_description,
  (dc.table_name IS NOT NULL)                           AS catalog_linked,
  (o.domain IS NOT NULL)                                AS has_domain,
  (o.purpose IS NOT NULL AND btrim(o.purpose) <> '')    AS has_purpose,
  (dc.owner_team IS NOT NULL)                           AS has_owner,
  (o.degree > 0)                                        AS has_join,
  (o.refs_app + o.refs_script + o.refs_db_function > 0) AS has_use,
  (o.last_write_at IS NOT NULL
     AND o.last_write_at > now() - interval '30 days')  AS is_fresh,
  (o.anon_readable AND coalesce(dc.pii_level,'') IN ('high','medium')) AS exposure_conflict
FROM clarity_object o
LEFT JOIN data_catalog dc ON dc.table_name = o.object_name;

-- service_role only, and the view is security_invoker so it cannot become one of the
-- 99 anon-readable definer-rights views this catalog exists to count. JusticeHub reads
-- it with its own service key, the same way it reads everything else in this database.
GRANT SELECT ON v_clarity_ledger TO service_role;
GRANT SELECT ON clarity_object, clarity_column, clarity_edge, clarity_code_ref,
                clarity_object_history, clarity_gap_metric, clarity_gap_measurement,
                clarity_metric_definition, clarity_freshness_candidate TO service_role;

ALTER TABLE clarity_object            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_column            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_edge              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_code_ref          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_object_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_gap_metric        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_gap_measurement   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_metric_definition ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. RLS-on-zero-policy is deliberate here, and it is
-- the same shape as the 215 tables already in that state — the difference is that
-- this one is written down.

COMMIT;
```

### 9.2 `20260815000100_clarity_refresh_function.sql`

```sql
-- =====================================================================================
-- CivicGraph Clarity — catalog refresh (part 2 of 2)
--
-- NOT APPLIED. Apply with psql (gsql.mjs -c mangles $$ dollar-quoting):
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000100_clarity_refresh_function.sql
--
-- Requires 20260815000000_clarity_catalog_schema.sql first.
--
-- ---------------------------------------------------------------------------
-- WHY THIS CANNOT RUN THROUGH THE APP — verified, not assumed, 2026-08-14:
--
--  1. apps/web/src/lib/supabase.ts:13 blocks rpc('exec'|'execute_sql'|'exec_agent_sql')
--     outright, and :117-124 admits rpc('exec_sql') only for SELECT/WITH.
--     NOTE: `SELECT clarity_refresh()` PASSES that guard. The guard is not the blocker.
--  2. The blocker is the timeout. Measured: anon statement_timeout = 3s,
--     authenticated = 8s, authenticator = 8s. exec_sql is granted only to
--     {postgres, service_role}, and PostgREST reaches service_role through
--     authenticator, so it inherits 8s. `SELECT pg_sleep(10)` through
--     scripts/gsql.mjs returns "canceling statement due to statement timeout".
--  3. A function cannot escape that. `WITH t AS (SELECT set_config(
--     'statement_timeout','0',true)) SELECT pg_sleep(11) FROM t` is STILL cancelled:
--     the timer is armed once, at statement start. A SET inside the statement is
--     too late. The `SET statement_timeout = 0` below is therefore correct for
--     pg_cron/psql invocation and useless as an escape hatch.
--  4. Measured full-sweep cost: 806 exact counts = 92.7s, 633 freshness probes
--     = 53.4s. ~2.5 min for the relation pass. Nowhere near 8s.
--
--  => Invoke from psql or pg_cron. Not from vercel.json crons (HTTP), not from
--     the RPC path. Same lane as refresh-views-v2.mjs.
--
-- ---------------------------------------------------------------------------
-- THE BUG IN BUILD-SPEC.md §3.3, PROVEN THIS SESSION:
--
--     BEGIN
--       SET LOCAL statement_timeout = '6s';
--       EXECUTE format('SELECT max(%I) FROM public.%I', ...) INTO v_last;
--     EXCEPTION WHEN query_canceled THEN v_probe := 'timeout';
--     END;
--
--  This guard is a NO-OP. Test run against this instance:
--     SET statement_timeout=0;
--     DO $t$ BEGIN
--       BEGIN SET LOCAL statement_timeout='1s'; PERFORM pg_sleep(4);
--             RAISE NOTICE 'not cancelled';
--       EXCEPTION WHEN query_canceled THEN RAISE NOTICE 'cancelled'; END;
--     END $t$;
--  -> NOTICE: not cancelled.   (elapsed 4.4s)
--
--  statement_timeout is armed by start_xact_command() at the top of the client
--  command. Changing the GUC inside a running statement does not re-arm the timer.
--  So a single max() over an unindexed column on a 20M-row table would hang the
--  whole nightly job with no protection at all.
--
--  FIX APPLIED HERE: bound the probe by COST, not by time.
--    probe max(col) only when the column has a leading btree index (index scan,
--    microseconds) OR the relation is under p_fresh_scan_max rows.
--    Everything else records 'deferred_too_large' and is picked up by the weekly
--    runner, which issues one statement per object and therefore CAN arm a timeout.
--  Measured effect: of 633 relations with a freshness column, exactly 2 exceeded
--  a 1.5s probe (abr_registry 20,006,350 rows; acnc_ais 360,488). Only 59 of the
--  633 have a leading index on the chosen column, so the size rule does the work.
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- 1. clarity_refresh() — relations + routines. One round trip. ~2.5 minutes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_refresh(
  p_exact_count_max  bigint  DEFAULT 2000000,   -- exact count(*) below this reltuples
  p_fresh_scan_max   bigint  DEFAULT 2000000,   -- max() seq scan allowed below this
  p_write_history    boolean DEFAULT true
)
RETURNS TABLE (
  objects           integer,
  relations         integer,
  routines          integer,
  exact_counts      integer,
  estimated_counts  integer,
  freshness_ok      integer,
  freshness_deferred integer,
  elapsed_ms        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
SET statement_timeout = 0          -- correct under pg_cron/psql; does NOT defeat a caller-armed timer
AS $fn$
DECLARE
  rec         record;
  t0          timestamptz := clock_timestamp();
  tprobe      timestamptz;
  n_rel       integer := 0;
  n_fn        integer := 0;
  n_exact     integer := 0;
  n_est       integer := 0;
  n_fresh_ok  integer := 0;
  n_fresh_def integer := 0;
  v_rows      bigint;
  v_est       boolean;
  v_probe     clarity_probe;
  v_ms        integer;
  v_fcol      text;
  v_findexed  boolean;
  v_last      timestamptz;
  v_fprobe    clarity_probe;
  v_fms       integer;
BEGIN
  -- ===================== A. RELATIONS: tables, matviews, views ==============
  FOR rec IN
    SELECT c.oid,
           c.relname,
           (CASE c.relkind WHEN 'r' THEN 'table' WHEN 'm' THEN 'matview' ELSE 'view' END)::clarity_object_kind AS kind,
           c.relkind,
           GREATEST(c.reltuples, 0)::bigint AS est_rows,
           pg_total_relation_size(c.oid)    AS bytes,
           c.relrowsecurity                 AS rls,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS npol,
           (SELECT count(*) FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r','*')
               AND coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true'
               AND (p.polroles = '{0}'::oid[]
                    OR EXISTS (SELECT 1 FROM unnest(p.polroles) rr
                                WHERE pg_get_userbyid(rr) = 'anon')))::int AS anon_open,
           has_table_privilege('anon', c.oid, 'SELECT')          AS anon_grant,
           has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_grant,
           (c.relkind = 'v' AND EXISTS (SELECT 1 FROM unnest(coalesce(c.reloptions,'{}'::text[]))
                                          o WHERE o = 'security_invoker=true')) AS sec_invoker
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','m','v')
    ORDER BY c.relname
  LOOP
    n_rel := n_rel + 1;

    ------------------------------------------------------------------ row count
    -- n_live_tup is BROKEN on this instance (political_donations -> 0 for
    -- 2,549,483 real rows). reltuples is the router; count(*) is the answer.
    v_ms := NULL;
    IF rec.relkind = 'v' THEN
      -- Views cannot be bounded from inside a function (see header). The runner
      -- counts them one statement at a time, where a timeout can actually fire.
      v_rows := NULL; v_est := false; v_probe := 'deferred_too_large';
    ELSIF rec.est_rows < p_exact_count_max THEN
      tprobe := clock_timestamp();
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', rec.relname) INTO v_rows;
        v_est := false; v_probe := 'ok'; n_exact := n_exact + 1;
      EXCEPTION WHEN OTHERS THEN
        v_rows := rec.est_rows; v_est := true; v_probe := 'error'; n_est := n_est + 1;
      END;
      v_ms := (extract(epoch FROM clock_timestamp() - tprobe) * 1000)::int;
    ELSE
      -- Measured: all 6 relations >= 2M rows sit within 0.26% of exact.
      v_rows := rec.est_rows; v_est := true; v_probe := 'ok'; n_est := n_est + 1;
    END IF;

    ------------------------------------------------------------------ freshness
    v_fcol := NULL; v_last := NULL; v_fms := NULL; v_findexed := false;

    IF rec.relkind = 'm' THEN
      -- Only 1 of 98 matviews carries a timestamp column. mv_refresh_log is the
      -- only honest source, and it only knows 44 of them.
      SELECT max(l.started_at) INTO v_last
        FROM mv_refresh_log l
       WHERE l.mv_name = rec.relname AND l.status LIKE 'success%';
      v_fprobe := CASE WHEN v_last IS NULL THEN 'no_column' ELSE 'ok' END;
    ELSE
      -- pg_attribute, NOT information_schema: matviews are absent from the latter
      -- (verified: 0 of 98), and this branch also serves views.
      SELECT a.attname,
             EXISTS (SELECT 1 FROM pg_index x
                      WHERE x.indrelid = rec.oid AND x.indkey[0] = a.attnum)
        INTO v_fcol, v_findexed
        FROM pg_attribute a
        JOIN clarity_freshness_candidate f ON f.column_name = a.attname
       WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped
         AND format_type(a.atttypid, NULL) IN
             ('timestamp with time zone','timestamp without time zone','date')
       ORDER BY f.priority
       LIMIT 1;

      IF v_fcol IS NULL THEN
        v_fprobe := 'no_column';
      ELSIF rec.relkind = 'v' THEN
        v_fprobe := 'deferred_too_large';   -- runner's job, same reason as view counts
      ELSIF NOT v_findexed AND rec.est_rows > p_fresh_scan_max THEN
        v_fprobe := 'deferred_too_large';
        n_fresh_def := n_fresh_def + 1;
      ELSE
        tprobe := clock_timestamp();
        BEGIN
          EXECUTE format('SELECT max(%I)::timestamptz FROM public.%I', v_fcol, rec.relname)
            INTO v_last;
          v_fprobe := 'ok'; n_fresh_ok := n_fresh_ok + 1;
        EXCEPTION WHEN OTHERS THEN
          v_fprobe := 'error';
        END;
        v_fms := (extract(epoch FROM clock_timestamp() - tprobe) * 1000)::int;
      END IF;
    END IF;

    ------------------------------------------------------------------ upsert
    INSERT INTO clarity_object AS o (
      object_key, object_name, object_kind, oid,
      row_count, row_count_is_estimate, row_count_probe, row_count_ms, bytes,
      column_count, nullable_columns,
      freshness_column, freshness_source, last_write_at, freshness_probe, freshness_ms,
      rls_enabled, policy_count, anon_grant, anon_open_policies, anon_readable,
      authenticated_grant, security_invoker,
      refreshed_at, missing_since
    ) VALUES (
      rec.relname, rec.relname, rec.kind, rec.oid,
      v_rows, v_est, v_probe, v_ms, rec.bytes,
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped),
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull),
      v_fcol,
      CASE WHEN rec.relkind = 'm' THEN 'mv_refresh_log'
           WHEN v_fcol IS NOT NULL THEN 'column' ELSE 'none' END,
      v_last, v_fprobe, v_fms,
      rec.rls, rec.npol, rec.anon_grant, rec.anon_open,
      (rec.anon_grant AND (NOT rec.rls OR rec.anon_open > 0)),
      rec.auth_grant,
      CASE WHEN rec.relkind = 'v' THEN rec.sec_invoker ELSE NULL END,
      now(), NULL
    )
    ON CONFLICT (object_key) DO UPDATE SET
      object_kind = EXCLUDED.object_kind,
      oid = EXCLUDED.oid,
      -- a deferred probe must not wipe a value the runner filled in
      row_count = CASE WHEN EXCLUDED.row_count_probe = 'deferred_too_large'
                       THEN o.row_count ELSE EXCLUDED.row_count END,
      row_count_is_estimate = CASE WHEN EXCLUDED.row_count_probe = 'deferred_too_large'
                       THEN o.row_count_is_estimate ELSE EXCLUDED.row_count_is_estimate END,
      row_count_probe = EXCLUDED.row_count_probe,
      row_count_ms = EXCLUDED.row_count_ms,
      bytes = EXCLUDED.bytes,
      column_count = EXCLUDED.column_count,
      nullable_columns = EXCLUDED.nullable_columns,
      freshness_column = EXCLUDED.freshness_column,
      freshness_source = EXCLUDED.freshness_source,
      last_write_at = CASE WHEN EXCLUDED.freshness_probe = 'deferred_too_large'
                       THEN o.last_write_at ELSE EXCLUDED.last_write_at END,
      freshness_probe = EXCLUDED.freshness_probe,
      freshness_ms = EXCLUDED.freshness_ms,
      rls_enabled = EXCLUDED.rls_enabled,
      policy_count = EXCLUDED.policy_count,
      anon_grant = EXCLUDED.anon_grant,
      anon_open_policies = EXCLUDED.anon_open_policies,
      anon_readable = EXCLUDED.anon_readable,
      authenticated_grant = EXCLUDED.authenticated_grant,
      security_invoker = EXCLUDED.security_invoker,
      refreshed_at = now(),
      missing_since = NULL;
  END LOOP;

  -- ===================== B. ROUTINES: the 409 nobody inventoried ============
  FOR rec IN
    SELECT p.oid,
           p.proname,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
           l.lanname,
           p.prosecdef,
           p.provolatile,
           pg_get_function_result(p.oid) AS rettype,
           length(coalesce(p.prosrc,'')) AS srclen,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
           (SELECT count(*) FROM pg_trigger t
             WHERE t.tgfoid = p.oid AND NOT t.tgisinternal)::int AS trg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language  l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  LOOP
    n_fn := n_fn + 1;
    INSERT INTO clarity_object AS o (
      object_key, object_name, object_kind, oid,
      row_count_probe, freshness_probe, lifecycle,
      routine_language, routine_kind, routine_returns, routine_volatility,
      routine_src_bytes, trigger_attachments,
      security_definer, anon_execute, authenticated_grant,
      refreshed_at, missing_since
    ) VALUES (
      rec.key, rec.proname, 'function', rec.oid,
      'not_applicable', 'not_applicable', 'routine',
      rec.lanname,
      CASE WHEN rec.rettype = 'trigger' THEN 'trigger'
           WHEN rec.prosecdef THEN 'security_definer' ELSE 'plain' END,
      rec.rettype, rec.provolatile, rec.srclen, rec.trg,
      rec.prosecdef, rec.anon_exec, rec.auth_exec,
      now(), NULL
    )
    ON CONFLICT (object_key) DO UPDATE SET
      oid = EXCLUDED.oid,
      routine_language = EXCLUDED.routine_language,
      routine_kind = EXCLUDED.routine_kind,
      routine_returns = EXCLUDED.routine_returns,
      routine_volatility = EXCLUDED.routine_volatility,
      routine_src_bytes = EXCLUDED.routine_src_bytes,
      trigger_attachments = EXCLUDED.trigger_attachments,
      security_definer = EXCLUDED.security_definer,
      anon_execute = EXCLUDED.anon_execute,
      authenticated_grant = EXCLUDED.authenticated_grant,
      refreshed_at = now(),
      missing_since = NULL;
  END LOOP;

  -- ===================== C. COLUMNS (pg_attribute, covers matviews) =========
  DELETE FROM clarity_column c
   WHERE NOT EXISTS (SELECT 1 FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
                      WHERE pn.nspname='public' AND pc.relname = c.object_key);

  INSERT INTO clarity_column (object_key, ordinal, column_name, data_type, is_nullable,
                              is_pk, is_indexed, is_vector, vector_dim)
  SELECT c.relname, a.attnum, a.attname,
         format_type(a.atttypid, a.atttypmod),
         NOT a.attnotnull,
         EXISTS (SELECT 1 FROM pg_index x WHERE x.indrelid=c.oid AND x.indisprimary
                                            AND a.attnum = ANY(x.indkey::int2[])),
         EXISTS (SELECT 1 FROM pg_index x WHERE x.indrelid=c.oid
                                            AND a.attnum = ANY(x.indkey::int2[])),
         (t.typname = 'vector'),
         CASE WHEN t.typname = 'vector' THEN a.atttypmod END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  JOIN pg_type t      ON t.oid = a.atttypid
  WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
    AND a.attnum > 0 AND NOT a.attisdropped
  ON CONFLICT (object_key, ordinal) DO UPDATE SET
    column_name = EXCLUDED.column_name,
    data_type   = EXCLUDED.data_type,
    is_nullable = EXCLUDED.is_nullable,
    is_pk       = EXCLUDED.is_pk,
    is_indexed  = EXCLUDED.is_indexed,
    is_vector   = EXCLUDED.is_vector,
    vector_dim  = EXCLUDED.vector_dim;

  -- ===================== D. EDGES: declared FKs + view lineage ==============
  INSERT INTO clarity_edge (src_object, src_column, tgt_object, tgt_column,
                            mechanism, declared, note)
  SELECT DISTINCT cl1.relname, att1.attname, cl2.relname, att2.attname,
                  'fk', true, con.conname
  FROM pg_constraint con
  JOIN pg_class cl1      ON con.conrelid  = cl1.oid
  JOIN pg_class cl2      ON con.confrelid = cl2.oid
  JOIN pg_attribute att1 ON att1.attrelid = cl1.oid AND att1.attnum = ANY(con.conkey)
  JOIN pg_attribute att2 ON att2.attrelid = cl2.oid AND att2.attnum = ANY(con.confkey)
  JOIN pg_namespace ns   ON cl1.relnamespace = ns.oid
  WHERE con.contype = 'f' AND ns.nspname = 'public'
  ON CONFLICT DO NOTHING;

  -- pg_depend/pg_rewrite: which views and matviews read which base relations.
  -- 695 edges today. This is the lineage the FK graph cannot see.
  INSERT INTO clarity_edge (src_object, src_column, tgt_object, tgt_column,
                            mechanism, declared)
  SELECT DISTINCT dep.relname, NULL, base.relname, NULL, 'view_lineage', true
  FROM pg_depend d
  JOIN pg_rewrite rw     ON rw.oid = d.objid
  JOIN pg_class dep      ON dep.oid = rw.ev_class
  JOIN pg_class base     ON base.oid = d.refobjid
  JOIN pg_namespace nd   ON nd.oid = dep.relnamespace
  JOIN pg_namespace nb   ON nb.oid = base.relnamespace
  WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
    AND nd.nspname='public' AND nb.nspname='public'
    AND dep.oid <> base.oid
    AND dep.relkind IN ('v','m') AND base.relkind IN ('r','m','v')
  ON CONFLICT DO NOTHING;

  -- ===================== E. DEGREES =========================================
  UPDATE clarity_object o SET
    fk_out      = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism='fk'),0),
    fk_in       = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism='fk'),0),
    lineage_out = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism='view_lineage'),0),
    lineage_in  = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism='view_lineage'),0),
    join_out    = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism NOT IN ('fk','view_lineage')),0),
    join_in     = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism NOT IN ('fk','view_lineage')),0)
  WHERE o.object_kind <> 'function';

  -- ===================== F. DB-FUNCTION REFERENCES ==========================
  -- The scan the 2026-08-14 pass never ran: 386,420 characters of pg_proc.prosrc.
  -- 202 relations are referenced ONLY here. Treating them as dark is how 19 live
  -- objects reached a DROP list.
  DELETE FROM clarity_code_ref WHERE ref_class = 'db_function';
  INSERT INTO clarity_code_ref (object_key, ref_class, repo, file_path, hits)
  SELECT r.object_key, 'db_function', 'database', f.key, count(*)::int
  FROM (SELECT object_key, object_name FROM clarity_object WHERE object_kind <> 'function') r
  JOIN (SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
               coalesce(p.prosrc,'') AS src
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public') f
    -- strpos() first: it is a plain substring search and it prunes the 1,024 x 410
    -- pair space before the regex runs. Measured on this instance: regex alone
    -- 103.8s, strpos + regex 3.6s, identical result (586 pairs, 209 relations).
    ON strpos(f.src, r.object_name) > 0
   AND f.src ~ ('(^|[^a-zA-Z0-9_])' || r.object_name || '([^a-zA-Z0-9_]|$)')
  GROUP BY 1,4
  ON CONFLICT DO NOTHING;

  -- triggers: 219 of them on 178 tables, invisible to every FK-based lineage model
  DELETE FROM clarity_code_ref WHERE ref_class = 'trigger';
  INSERT INTO clarity_code_ref (object_key, ref_class, repo, file_path, hits)
  SELECT c.relname, 'trigger', 'database',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 1
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p      ON p.oid = t.tgfoid
  WHERE n.nspname='public' AND NOT t.tgisinternal
  ON CONFLICT DO NOTHING;

  UPDATE clarity_object o SET
    refs_db_function = coalesce((SELECT count(*) FROM clarity_code_ref r
                                  WHERE r.object_key=o.object_key
                                    AND r.ref_class IN ('db_function','trigger')),0);

  -- ===================== G. ACT PRIVATE-BUSINESS FLAG (Ben, decision 1) =====
  -- The cluster leaves this database. Until it does, it is flagged so no civic
  -- surface shows it and the /clarity default filter hides it.
  UPDATE clarity_object SET
    act_business = true,
    act_business_source = coalesce(act_business_source, 'name_rule')
  WHERE object_kind <> 'function'
    AND act_business_source IS DISTINCT FROM 'manual'
    AND object_name ~ '^(act_|xero_|ghl_|notion_|receipt|finance_|bank_|email_|gmail_|imessage_|telegram_|memory_|calendar_|communications_|sprint|team_members|project_salary|saas_|goods_|ce_users|ce_metrics)';

  -- A regular view is a saved question, not stored data. Label it once so the
  -- ranking's lifecycle weight has something to read; the shards never classified
  -- any of the 212.
  UPDATE clarity_object SET lifecycle = 'lens'
   WHERE object_kind = 'view' AND lifecycle IS NULL;

  -- ===================== H. STATE ===========================================
  UPDATE clarity_object SET state = CASE
    WHEN object_kind = 'function'                                        THEN 'routine'
    WHEN object_name ~ '_backup(_|$)' OR object_name ~ '^_backup'
         OR object_name ~ '_bak$' OR lifecycle = 'backup'                THEN 'backup'
    WHEN lifecycle = 'superseded'                                        THEN 'superseded'
    WHEN lifecycle = 'staging' OR object_name ~ '^stg_'
         OR object_name ~ '^dedup_' OR object_name ~ '_20[0-9]{6}[a-z]?$' THEN 'staging'
    WHEN row_count IS NULL                                               THEN 'unknown'
    WHEN row_count = 0                                                   THEN 'empty'
    WHEN row_count < 10                                                  THEN 'tiny'
    ELSE 'live' END;

  -- ===================== I. IMPORTANCE ======================================
  PERFORM clarity_score();

  -- ===================== J. HISTORY + single-writer catalog snapshot ========
  IF p_write_history THEN
    INSERT INTO clarity_object_history
      (object_key, object_kind, row_count, row_count_is_estimate, bytes,
       last_write_at, degree, importance)
    SELECT object_key, object_kind, row_count, row_count_is_estimate, bytes,
           last_write_at, degree, importance
    FROM clarity_object WHERE missing_since IS NULL;

    -- data_catalog_snapshots keeps its 25-table provenance series; this makes
    -- clarity_refresh() its only writer so the two cannot disagree.
    INSERT INTO data_catalog_snapshots (table_name, row_count, freshness_hours, notes)
    SELECT dc.table_name, o.row_count,
           CASE WHEN o.last_write_at IS NULL THEN NULL
                ELSE round(extract(epoch FROM now() - o.last_write_at)/3600.0, 2) END,
           'clarity_refresh'
    FROM data_catalog dc
    JOIN clarity_object o ON o.object_key = dc.table_name;
  END IF;

  -- ===================== K. RETIRE, do not delete ===========================
  UPDATE clarity_object o SET missing_since = coalesce(o.missing_since, now())
   WHERE (o.object_kind = 'function'
          AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                           WHERE n.nspname='public'
                             AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = o.object_key))
      OR (o.object_kind <> 'function'
          AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                           WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
                             AND c.relname = o.object_key));

  RETURN QUERY SELECT n_rel + n_fn, n_rel, n_fn, n_exact, n_est, n_fresh_ok, n_fresh_def,
                      (extract(epoch FROM clock_timestamp() - t0) * 1000)::int;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. clarity_score() — the ranking. Split out so weights can be retuned without
--    re-running the 2.5-minute sweep. Weights justified in clarity-data-layer.md.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_score(
  w_size     numeric DEFAULT 0.20,
  w_bytes    numeric DEFAULT 0.10,
  w_degree   numeric DEFAULT 0.26,
  w_app      numeric DEFAULT 0.18,
  w_pipe     numeric DEFAULT 0.12,
  w_recency  numeric DEFAULT 0.14,
  w_unknown_recency numeric DEFAULT 0.30,
  w_act      numeric DEFAULT 0.50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $fn$
DECLARE
  max_rows  bigint;
  max_bytes bigint;
  n integer;
BEGIN
  SELECT GREATEST(max(row_count), 2), GREATEST(max(bytes), 2)
    INTO max_rows, max_bytes FROM clarity_object WHERE object_kind <> 'function';

  UPDATE clarity_object o SET importance = ROUND((
      -- how much of the estate it is
      w_size  * LEAST(1.0, ln(GREATEST(coalesce(o.row_count,0),1))::numeric / ln(max_rows::numeric))
    + w_bytes * LEAST(1.0, ln(GREATEST(o.bytes,1)+1)::numeric      / ln(max_bytes::numeric + 1))
      -- how central it is
    + w_degree * LEAST(1.0, ln(1 + o.degree)::numeric              / ln(41::numeric))
      -- whether a product surface reads it (distinct FILES, not hits)
    + w_app   * LEAST(1.0, ln(1 + o.refs_app)::numeric             / ln(26::numeric))
      -- whether a pipeline, DB function or downstream view depends on it
    + w_pipe  * LEAST(1.0, ln(1 + o.refs_script + o.refs_db_function + o.lineage_in)::numeric
                                                                   / ln(26::numeric))
      -- whether it is current
    + w_recency * CASE
        WHEN o.last_write_at IS NULL                            THEN w_unknown_recency
        WHEN o.last_write_at > now() - interval '7 days'         THEN 1.00
        WHEN o.last_write_at > now() - interval '30 days'        THEN 0.70
        WHEN o.last_write_at > now() - interval '180 days'       THEN 0.40
        WHEN o.last_write_at > now() - interval '730 days'       THEN 0.20
        ELSE 0.05 END
  )
  -- state penalty: a backup is not important because it is big
  * CASE o.state WHEN 'backup' THEN 0.05 WHEN 'staging' THEN 0.10
                 WHEN 'superseded' THEN 0.15 WHEN 'empty' THEN 0.25
                 WHEN 'tiny' THEN 0.60 ELSE 1.00 END
  -- lifecycle: this is a catalogue of DATA, not of application tables
  * CASE o.lifecycle
      WHEN 'core_source' THEN 1.00 WHEN 'derived' THEN 0.95 WHEN 'crosswalk' THEN 0.95
      WHEN 'app_operational' THEN 0.60 WHEN 'staging' THEN 0.25 WHEN 'backup' THEN 0.10
      WHEN 'superseded' THEN 0.20 WHEN 'scaffold_empty' THEN 0.30
      WHEN 'lens' THEN 0.85 WHEN 'routine' THEN 0.50 ELSE 0.80 END
  -- Ben's decision 1: ACT private business is not civic data
  * CASE WHEN o.act_business THEN w_act ELSE 1.00 END
  , 4)
  WHERE o.missing_since IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. clarity_set_probe() — write-back for the runner, which owns the two probes
--    that a single function call cannot bound (view counts, oversized max()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_set_probe(
  p_object_key text,
  p_kind       text,                -- 'row_count' | 'freshness'
  p_probe      clarity_probe,
  p_rows       bigint DEFAULT NULL,
  p_last_write timestamptz DEFAULT NULL,
  p_ms         integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $fn$
BEGIN
  IF p_kind = 'row_count' THEN
    UPDATE clarity_object
       SET row_count = COALESCE(p_rows, row_count),
           row_count_is_estimate = false,
           row_count_probe = p_probe,
           row_count_ms = p_ms
     WHERE object_key = p_object_key;
  ELSIF p_kind = 'freshness' THEN
    UPDATE clarity_object
       SET last_write_at = COALESCE(p_last_write, last_write_at),
           freshness_probe = p_probe,
           freshness_ms = p_ms
     WHERE object_key = p_object_key;
  ELSE
    RAISE EXCEPTION 'clarity_set_probe: unknown kind %', p_kind;
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. clarity_measure_gaps() — runs the registered gap metrics and records them.
--    Each metric's SQL lives in clarity_gap_metric, so the number on the screen
--    and the number in the spec are the same number by construction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_measure_gaps(p_cost_class text DEFAULT NULL)
RETURNS TABLE (metric_key text, value numeric, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog
SET statement_timeout = 0
AS $fn$
DECLARE
  m record; num bigint; den bigint; v numeric; t0 timestamptz; st text; err text;
BEGIN
  FOR m IN SELECT * FROM clarity_gap_metric
            WHERE enabled AND (p_cost_class IS NULL OR cost_class = p_cost_class)
            ORDER BY metric_key
  LOOP
    t0 := clock_timestamp(); num := NULL; den := NULL; v := NULL; st := 'ok'; err := NULL;
    BEGIN
      EXECUTE m.numerator_sql INTO num;
      IF m.denominator_sql IS NOT NULL THEN
        EXECUTE m.denominator_sql INTO den;
        v := CASE WHEN coalesce(den,0) = 0 THEN NULL
                  ELSE round(100.0 * num::numeric / den::numeric, 4) END;
      ELSE
        v := num::numeric;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      st := 'error'; err := SQLERRM;
    END;
    INSERT INTO clarity_gap_measurement
      (metric_key, numerator, denominator, value, duration_ms, status, error_text)
    VALUES (m.metric_key, num, den, v,
            (extract(epoch FROM clock_timestamp()-t0)*1000)::int, st, err);
    metric_key := m.metric_key; value := v; status := st;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION clarity_refresh(bigint,bigint,boolean)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_score(numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)
                                                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_set_probe(text,text,clarity_probe,bigint,timestamptz,integer)
                                                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_measure_gaps(text)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION clarity_refresh(bigint,bigint,boolean)   TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_score(numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)
                                                                    TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_set_probe(text,text,clarity_probe,bigint,timestamptz,integer)
                                                                    TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_measure_gaps(text)               TO service_role;
-- Deliberate contrast: 340 of 410 existing functions are EXECUTE-able by `anon`,
-- three of them SECURITY DEFINER rebuild_* routines. These four are not.
```

### 9.3 `20260815000200_clarity_gap_metrics_seed.sql`

```sql
-- =====================================================================================
-- CivicGraph Clarity — gap metric registry seed (part 3)
--
-- NOT APPLIED. Apply with psql, AFTER 20260815000000 and 20260815000100:
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000200_clarity_gap_metrics_seed.sql
--
-- Every numerator_sql / denominator_sql below was EXECUTED against
-- tednluwflfhxyucgwigh on 2026-08-14 and its result is recorded in the `note`.
-- Metrics whose SQL reads clarity_object carry a day-one baseline computed from
-- the same measurements by an offline scan; they are marked BASELINE in the note.
-- =====================================================================================

BEGIN;

INSERT INTO clarity_gap_metric
  (metric_key, title, family, question, numerator_sql, denominator_sql, unit, direction, target, cost_class, note)
VALUES

-- ---------------------------------------------------------------- 1. coverage
('described_objects',
 'Objects with a written purpose',
 'coverage',
 'How much of what we hold has anyone said what it is for?',
 $q$SELECT count(*) FROM clarity_object WHERE purpose IS NOT NULL AND btrim(purpose) <> '' AND missing_since IS NULL$q$,
 $q$SELECT count(*) FROM clarity_object WHERE missing_since IS NULL$q$,
 'pct','higher_better',95,'cheap',
 '2026-08-14: 812 of 1,433 = 56.7%. The 2026-08-14 inventory shards describe 714 tables + 98 matviews and ZERO of the 212 views and ZERO of the 409 functions.'),

('governed_objects',
 'Objects with a governance row (owner, licence, PII level)',
 'coverage',
 'Which of these can I publish, and who do I ask?',
 $q$SELECT count(*) FROM clarity_object o JOIN data_catalog dc ON dc.table_name = o.object_name$q$,
 $q$SELECT count(*) FROM clarity_object WHERE missing_since IS NULL$q$,
 'pct','higher_better',60,'cheap',
 '2026-08-14: data_catalog holds 25 rows. 25 / 1,433 = 1.7%. It already has the right 21 columns (licence, public_export, pii_level, source_url, sla_hours) at 1.7% fill. Widen it, do not build a second one.'),

-- ---------------------------------------------------------------- 2. freshness
('freshness_knowable',
 'Objects whose last write can be established at all',
 'freshness',
 'For how much of this can I answer "when was this last updated"?',
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND last_write_at IS NOT NULL$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND missing_since IS NULL$q$,
 'pct','higher_better',85,'cheap',
 'BASELINE 2026-08-14: 608 of 812 tables+matviews carry a resolvable last-write (74.9%). 632 of 714 tables have a candidate timestamp column; only 1 of 98 matviews does, so matview freshness comes from mv_refresh_log (44 of 98) or nowhere.'),

('stale_core_sources',
 'Core source datasets not written in 30 days',
 'freshness',
 'Which of our evidence bases has quietly stopped updating?',
 $q$SELECT count(*) FROM clarity_object
     WHERE lifecycle = 'core_source' AND state = 'live'
       AND last_write_at IS NOT NULL AND last_write_at < now() - interval '30 days'$q$,
 NULL,'count','lower_better',0,'cheap',
 'BASELINE 2026-08-14: 141 of 608 objects with a known last-write are older than 180 days.'),

-- ---------------------------------------------------------------- 3. schedule
('matviews_unscheduled',
 'Materialized views in no refresh registry',
 'schedule',
 'How much of the derived layer is running on a hand crank?',
 $q$WITH cron_list AS (
      SELECT unnest(regexp_split_to_array(
               regexp_replace(coalesce(p.prosrc,''), '[^a-z0-9_]+', ' ', 'g'), '\s+')) AS nm
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname = 'refresh_civicgraph_mvs')
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND c.relname NOT IN (SELECT nm FROM cron_list)$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',0,'cheap',
 '2026-08-14: 71 of 98 matviews (2,871,838 rows) are absent from refresh_civicgraph_mvs(), the only scheduled path (pg_cron jobid 4, 0 17 * * *). The function hardcodes 27 names; scripts/refresh-views-v2.mjs hardcodes 43. The mjs list is a strict SUPERSET of the function list, so reconciliation is additive: 55 matviews (1,374,264 rows) are in NEITHER.'),

-- SUCCESSOR to matviews_unscheduled. A parallel work stream is shipping
-- migrations/2026-08-14-mv-refresh-registry.sql, which replaces the hardcoded array
-- in refresh_civicgraph_mvs() with a read of mv_refresh_plan() over a new
-- mv_refresh_registry table. When that lands, matviews_unscheduled above returns a
-- FALSE 98/98 because the function body no longer contains any matview names.
-- Disable that metric and enable this one at the same time. Until then this row
-- records status='error' (relation does not exist), which is the correct signal.
-- (enabled=false on purpose: its table does not exist yet)
('matviews_unregistered',
 'Materialized views absent from mv_refresh_registry',
 'schedule',
 'How much of the derived layer is running on a hand crank? (registry era)',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND NOT EXISTS (SELECT 1 FROM mv_refresh_registry r
                        WHERE r.mv_name = c.relname AND r.enabled AND r.tier <> 'retire')$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',0,'cheap',
 'Depends on migrations/2026-08-14-mv-refresh-registry.sql, which is NOT applied as of 2026-08-14. Enable this and disable matviews_unscheduled in the same change.'),

('matviews_stale',
 'Materialized views whose last successful refresh is over 48h old',
 'schedule',
 'Is the director-links pillar current right now?',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND coalesce((SELECT max(l.started_at) FROM mv_refresh_log l
                      WHERE l.mv_name=c.relname AND l.status LIKE 'success%'),
                    '-infinity'::timestamptz) < now() - interval '48 hours'$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',10,'cheap',
 '2026-08-14, measured with this exact SQL: 70 of 98 = 71.4%. 54 matviews have never appeared in mv_refresh_log at all; 16 more last succeeded 2026-08-09, the day someone ran scripts/refresh-views-v2.mjs by hand. 28 are current (24 clean successes + 4 CONCURRENTLY fallbacks). The whole director-links pillar - mv_person_entity_network, mv_person_entity_crosswalk, mv_person_identity_influence_v2 - is in the never-logged set.'),

('matview_concurrent_fallback',
 'Matviews that fall back from REFRESH CONCURRENTLY',
 'schedule',
 'Which refreshes take a full table lock every night?',
 $q$SELECT count(DISTINCT mv_name) FROM mv_refresh_log
     WHERE started_at > now() - interval '3 days' AND status = 'success-fallback'$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 4 (mv_abr_name_lookup, mv_grant_contract_overlap, mv_indigenous_procurement_score, mv_lga_indigenous_proxy_score). Each lacks a unique index, so CONCURRENTLY fails and the nightly job holds an ACCESS EXCLUSIVE lock instead.'),

-- ---------------------------------------------------------------- 4. usage
('dark_rows',
 'Rows in populated objects that nothing reads',
 'usage',
 'How much of this database is nobody looking at?',
 $q$SELECT coalesce(sum(row_count),0) FROM clarity_object
     WHERE object_kind IN ('table','matview') AND coalesce(row_count,0) > 0
       AND refs_app = 0 AND refs_script = 0 AND refs_db_function = 0 AND lineage_in = 0$q$,
 $q$SELECT coalesce(sum(row_count),0) FROM clarity_object
     WHERE object_kind IN ('table','matview') AND coalesce(row_count,0) > 0$q$,
 'pct','lower_better',5,'cheap',
 'BASELINE 2026-08-14: 184 populated objects / 5,087,126 rows = 9.7% of 52,349,579. This CORRECTS the "290 objects / 14,894,611 rows" figure, which counted only application code and never read the 386,420 characters of pg_proc.prosrc (202 relations referenced there), the 219 triggers, or the 695 view-lineage edges (220 relations).'),

('views_unreferenced',
 'Regular views with no query-shaped reference anywhere',
 'usage',
 'How many of the 212 anon-readable view endpoints does anyone actually call?',
 $q$SELECT count(*) FROM clarity_object WHERE object_kind='view'
       AND refs_app=0 AND refs_script=0 AND refs_db_function=0 AND lineage_in=0$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind='view'$q$,
 'pct','lower_better',30,'cheap',
 'BASELINE 2026-08-14: 132 of 212 = 62.3%. 60 are referenced from app source, 78 from anything.'),

-- ---------------------------------------------------------------- 5. join integrity
('justice_edge_drillthrough',
 'Justice graph edges that resolve to a funding record',
 'join_integrity',
 'Can I click an edge on the graph and see the actual grant?',
 $q$WITH s AS (SELECT source_record_id FROM gs_relationships WHERE source_record_id IS NOT NULL LIMIT 50000)
    SELECT count(*) FROM s
     WHERE source_record_id ~ '^[0-9a-f]{8}-'
       AND EXISTS (SELECT 1 FROM justice_funding j WHERE j.id = s.source_record_id::uuid)$q$,
 $q$WITH s AS (SELECT source_record_id FROM gs_relationships WHERE source_record_id IS NOT NULL LIMIT 50000)
    SELECT count(*) FROM s WHERE source_record_id ~ '^[0-9a-f]{8}-'$q$,
 'pct','higher_better',80,'medium',
 '2026-08-14, re-measured independently: 0 of 49,426. gs_relationships.source_record_id is a DEAD KEY NAMESPACE - it is uuid-shaped but matches neither justice_funding.id nor source_statement_id. Drill-through is 0%, not 18%. No "click an edge to see the grant" feature is buildable until the key is rebuilt.'),

('bridge_columns_populated',
 'Declared bridge columns that actually carry values',
 'join_integrity',
 'Which of our advertised joins are 0% full?',
 $q$SELECT (SELECT count(*) FROM nz_charities WHERE gs_entity_id IS NOT NULL)
         + (SELECT count(*) FROM ndis_participants_lga WHERE lga_code IS NOT NULL)$q$,
 $q$SELECT (SELECT count(*) FROM nz_charities) + (SELECT count(*) FROM ndis_participants_lga)$q$,
 'pct','higher_better',50,'cheap',
 '2026-08-14: 0 of 53,521. nz_charities 0 of 45,192 linked; ndis_participants_lga 0 of 8,329 with an LGA code. Both columns exist, are documented, and have never been written.'),

-- ---------------------------------------------------------------- 6. attribution
('abn_attribution_money',
 'Money rows whose payee resolves to an entity in the spine',
 'attribution',
 'What share of the dollars can we actually attribute to a real organisation?',
 $q$SELECT (SELECT count(*) FROM austender_contracts a
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(a.supplier_abn,'[^0-9]','','g')))
         + (SELECT count(*) FROM grantconnect_awards w
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(w.recipient_abn,'[^0-9]','','g')))
         + (SELECT count(*) FROM justice_funding j
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(j.recipient_abn,'[^0-9]','','g')))$q$,
 $q$SELECT (SELECT count(*) FROM austender_contracts)
         + (SELECT count(*) FROM grantconnect_awards)
         + (SELECT count(*) FROM justice_funding)$q$,
 'pct','higher_better',95,'expensive',
 '2026-08-14: 1,125,402 of 1,272,000 = 88.5%. Per table: austender 765,431/823,620 = 92.9%; justice_funding 149,207/157,116 = 95.0%; grantconnect_awards 210,764/291,264 = 72.4% (68,172 rows carry a well-formed ABN that is not in gs_entities). political_donations is measured separately at 639,430/2,549,483 = 25.1% and is excluded here because it would swamp the ratio.'),

('abn_attribution_donations',
 'Political donation rows whose donor resolves to the spine',
 'attribution',
 'Can we say who gave the money?',
 $q$SELECT count(*) FROM political_donations p
     WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(p.donor_abn,'[^0-9]','','g'))$q$,
 $q$SELECT count(*) FROM political_donations$q$,
 'pct','higher_better',60,'expensive',
 '2026-08-14: 639,430 of 2,549,483 = 25.1%. 653,261 rows carry any donor_abn at all (25.6%), so the loss is at collection, not at matching. This is the weakest attribution of the four money tables by a factor of three.'),

-- ---------------------------------------------------------------- 7. place
('entities_placed',
 'Entities with a resolved local government area',
 'place',
 'How much of the registry can we put on a map?',
 $q$SELECT count(*) FROM gs_entities WHERE lga_code IS NOT NULL$q$,
 $q$SELECT count(*) FROM gs_entities$q$,
 'pct','higher_better',70,'medium',
 '2026-08-14: 294,214 of 609,448 = 48.3%. 282,182 entities (46.3%) hold no postcode at all, so they are structurally unplaceable, not merely unresolved.'),

('postcodes_placeable',
 'Funding postcodes that exist in the geography reference',
 'place',
 'Are we attributing money to places we cannot locate?',
 $q$SELECT count(*) FROM (SELECT DISTINCT postcode FROM mv_funding_by_postcode) m
     WHERE EXISTS (SELECT 1 FROM postcode_geo g WHERE g.postcode = m.postcode)$q$,
 $q$SELECT count(*) FROM (SELECT DISTINCT postcode FROM mv_funding_by_postcode) m$q$,
 'pct','higher_better',95,'cheap',
 '2026-08-14: 2,790 of 6,684 = 41.7%. 3,894 postcodes carrying funding have no row in postcode_geo, which holds only 2,909 distinct postcodes against Australia''s ~2,600 real ones plus LVR/PO ranges. The reference table is smaller than the fact table it is supposed to place.'),

-- ---------------------------------------------------------------- 8. evidence
('interventions_with_evidence',
 'ALMA interventions with at least one linked piece of evidence',
 'evidence',
 'When we say something works, can we show why?',
 $q$SELECT count(DISTINCT intervention_id) FROM alma_intervention_evidence$q$,
 $q$SELECT count(*) FROM alma_interventions$q$,
 'pct','higher_better',80,'cheap',
 '2026-08-14: 1,277 of 2,136 = 59.8%. Outcomes are thinner: 1,005 of 2,136 = 47.0%. Evidence and outcomes attach only through junction tables (alma_intervention_evidence / alma_intervention_outcomes); there is no direct intervention_id on alma_evidence or alma_outcomes.'),

-- ---------------------------------------------------------------- 9. exposure
('anon_readable_relations',
 'Relations readable with the public anon key',
 'exposure',
 'What can anyone with the browser key read?',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
       AND has_table_privilege('anon', c.oid, 'SELECT')
       AND (NOT c.relrowsecurity
            OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polpermissive
                        AND p.polcmd IN ('r','*')
                        AND coalesce(pg_get_expr(p.polqual,p.polrelid),'true')='true'
                        AND (p.polroles='{0}'::oid[]
                             OR EXISTS (SELECT 1 FROM unnest(p.polroles) rr WHERE pg_get_userbyid(rr)='anon'))))$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','m','v')$q$,
 'pct','lower_better',30,'cheap',
 '2026-08-14: 451 of 1,024 = 44.0% (232 tables, 13 matviews, 206 of the 212 views). 99 of those views run with DEFINER rights (security_invoker is not set), so base-table RLS does not apply to them at all. 215 tables sit at RLS-on-with-zero-policies, which is unreachable rather than protected - a different diagnosis with a different fix.'),

('act_business_exposed',
 'ACT private-business objects readable by anon',
 'exposure',
 'Is the private bookkeeping reachable from the public key?',
 $q$SELECT count(*) FROM clarity_object o
     WHERE o.act_business AND o.anon_readable AND o.object_kind <> 'function'$q$,
 $q$SELECT count(*) FROM clarity_object WHERE act_business AND object_kind <> 'function'$q$,
 'pct','lower_better',0,'cheap',
 'BASELINE 2026-08-14: 47 of 238 = 19.7%, including canonical_entities, entity_identifiers, founder_intakes and founder_intake_messages. 213 of the 238 carry an anon SELECT GRANT; RLS stops all but 47. Ben''s decision 1 (move this cluster to its own Supabase) is the fix; until then the flag drives the default filter.'),

('anon_executable_definers',
 'SECURITY DEFINER functions the anon key can execute',
 'exposure',
 'Can a browser trigger an RLS-bypassing routine?',
 $q$SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 3 - rebuild_funder_board_paths(), rebuild_funder_intelligence(), rebuild_place_funding_snapshot(). All three rebuild data and all three are callable with the public key. Separately, 340 of 410 functions are anon-EXECUTE-able; 64 are SECURITY DEFINER.'),

-- ---------------------------------------------------------------- 10. definitions
('conflicting_metric_definitions',
 'Concepts with more than one live definition',
 'definition',
 'Why is this number different on the other page?',
 $q$SELECT count(*) FROM (
      SELECT concept FROM clarity_metric_definition GROUP BY concept HAVING count(*) > 1
    ) x$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 1 known and live. "justice funding, cleaned" has two definitions: view justice_funding_clean (sector IS DISTINCT FROM ''procurement'') = 151,866 rows, and OPPORTUNITY-MAP''s mandatory measure_kind = ''grant'' = 126,673 rows / $46.097bn. The gap is 25,193 rows. Naively summing all measure_kinds gives $120.6bn because 848 expenditure_aggregate rows carry $66.126bn - 55% of the dollars in 0.5% of the rows.'),

-- ---------------------------------------------------------------- 11. countability
('countable_objects',
 'Objects whose size can be established',
 'countability',
 'Do we even know how big this is?',
 $q$SELECT count(*) FROM clarity_object
     WHERE object_kind <> 'function' AND row_count IS NOT NULL AND row_count_probe = 'ok'$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND missing_since IS NULL$q$,
 'pct','higher_better',97,'cheap',
 'BASELINE 2026-08-14: 1,006 of 1,024 = 98.2%. 806 tables/matviews exact-counted in 92.7s (zero timeouts at a 10s cap); 6 use reltuples; 194 of 212 views counted in 122s at a 3s cap; 18 views cannot be counted in 3s and are recorded as timeout, not as zero.'),

('estimated_row_counts',
 'Objects whose size is an estimate rather than a count',
 'countability',
 'Which numbers on this page are approximate?',
 $q$SELECT count(*) FROM clarity_object WHERE row_count_is_estimate$q$,
 NULL,'count','lower_better',10,'cheap',
 '2026-08-14: 6 (abr_registry, mv_abr_name_lookup, gs_relationships, political_donations, asic_companies, asic_name_lookup). Worst measured reltuples error among them is 0.26%. pg_stat_user_tables.n_live_tup, by contrast, reports 0 for political_donations (2,549,483 real) and 144 for qld_watchhouse_snapshot_rows (8,488 real) - never use it.')

ON CONFLICT (metric_key) DO UPDATE SET
  title = EXCLUDED.title, question = EXCLUDED.question,
  numerator_sql = EXCLUDED.numerator_sql, denominator_sql = EXCLUDED.denominator_sql,
  unit = EXCLUDED.unit, direction = EXCLUDED.direction, target = EXCLUDED.target,
  cost_class = EXCLUDED.cost_class, note = EXCLUDED.note;

-- Its table does not exist yet. Off until migrations/2026-08-14-mv-refresh-registry.sql lands.
UPDATE clarity_gap_metric SET enabled = false WHERE metric_key = 'matviews_unregistered';

-- ---------------------------------------------------------------- the live conflict
INSERT INTO clarity_metric_definition
  (definition_key, concept, expression, source_object, row_count, measured_at, is_canonical, used_by, rationale)
VALUES
 ('justice_clean_view', 'justice funding, cleaned',
  'sector IS DISTINCT FROM ''procurement''', 'justice_funding_clean', 151866, now(), false,
  ARRAY['view justice_funding_clean'],
  'Excludes only the 5,250 rows tagged sector=procurement. Leaves 29,519 contract_value rows and 848 expenditure_aggregate rows in the total, so any sum over this view mixes grants with budget aggregates.'),
 ('justice_grant_only', 'justice funding, cleaned',
  'measure_kind = ''grant''', 'justice_funding', 126673, now(), true,
  ARRAY['OPPORTUNITY-MAP.md', 'report-service.ts'],
  'The only measure_kind that is money actually awarded to a named recipient. $46.097bn. Canonical because it is the only filter under which the total does not double-count budget announcements against the grants inside them.')
ON CONFLICT (definition_key) DO UPDATE SET
  row_count = EXCLUDED.row_count, measured_at = EXCLUDED.measured_at,
  is_canonical = EXCLUDED.is_canonical, rationale = EXCLUDED.rationale;

-- ---------------------------------------------------------------- Ben's decision 1
--
-- HANDOVER NOTE. A parallel work stream is shipping
-- migrations/2026-08-14-catalog-object-scope.sql, which creates
-- public.catalog_object_scope (object_name, scope IN
-- ('civic','act_private','act_private_review','platform'), reason, decided_by).
-- That taxonomy is BETTER than this boolean: it separates "extract now" from
-- "entangled with civic objects, resolve first", and it refuses to hide anything
-- unclassified. When it lands, replace the seed below and section G of
-- clarity_refresh() with a single derivation:
--
--   UPDATE clarity_object o SET
--     act_business = (s.scope IN ('act_private','act_private_review')),
--     act_business_source = 'canonical_d14'
--   FROM catalog_object_scope s WHERE s.object_name = o.object_name;
--
-- Keep the name rule as the fallback for objects created after that table was
-- populated, so a new xero_* table cannot appear on a civic surface by default.
-- The ACT private-business cluster (CANONICAL-DATA-MAP.md domain D14) leaves this
-- database and is rebuilt in its own Supabase. Until that move happens the cluster is
-- FLAGGED, with provenance, so /clarity hides it by default and nothing civic joins it.
--
-- 221 names below, extracted mechanically from CANONICAL-DATA-MAP.md (109 dedicated
-- table rows + a 112-name bulk tier line). clarity_refresh() adds a further 17 by name
-- rule, for 238 total against the canonical map's own stated count of 237.
--
-- REVIEW BEFORE THE PHYSICAL MOVE: 13 objects match the name rule but are NOT in the
-- canonical D14 list and are arguable civic/ACT boundary cases -
--   act_communities, act_community_links, act_grant_recommendations,
--   act_opportunity_observatory, ce_metrics, ce_users, email_financial_documents,
--   goods_communities, goods_procurement_entities, goods_procurement_signals,
--   goods_supply_routes, knowledge_extraction_queue, knowledge_links
-- Set act_business_source = 'manual' on any of these that Ben rules civic; the refresh
-- function will then leave them alone.
UPDATE clarity_object SET act_business = true, act_business_source = 'canonical_d14'
 WHERE act_business_source IS DISTINCT FROM 'manual'
   AND object_name IN (
 'act_ask_artefacts', 'act_ask_none_owed', 'act_ask_warmers', 'act_entities',
  'act_grant_recommendation_decisions', 'act_grant_recommendation_projects', 'act_obligations',
  'act_opportunity_benchmark_cases', 'act_payable_decisions', 'act_people', 'act_person_roles',
  'act_research_experiments', 'act_research_initiatives', 'app_config', 'bank_statement_lines',
  'bgfit_budget_items', 'bgfit_deadlines', 'bgfit_financial_periods', 'bgfit_grants',
  'bgfit_suppliers', 'bgfit_transactions', 'bookkeeping_rules', 'bookkeeping_sync_state',
  'business_alerts', 'calendar_events', 'campaign_content', 'campaign_nomination_upvotes',
  'campaign_nominations', 'campaign_tracked_posts', 'canonical_entities', 'cashflow_scenarios',
  'civicscope_act_entity_bridge', 'cms_pages', 'collections_actions',
  'communication_project_links', 'communication_user_actions', 'communications_history',
  'compliance_ack', 'compliance_tracking', 'contact_cadence_metrics', 'contact_enrichments',
  'contact_intelligence', 'contact_intelligence_insights', 'contact_intelligence_scores',
  'contact_project_links', 'contact_submissions', 'contact_support_recommendations',
  'contact_votes', 'daily_reflections', 'dext_supplier_setup_status',
  'discovered_subscriptions', 'dream_journal', 'ecosystem_projects', 'ecosystem_sites',
  'email_response_templates', 'enrollment_codes', 'entity_identifiers', 'entity_merge_log',
  'exa_api_usage', 'exa_company_intelligence', 'exa_linkedin_profiles',
  'finance_ai_routing_suggestions', 'finance_receipt_bank_line_links',
  'finance_receipt_documents', 'finance_receipt_ingestion_runs', 'financial_overview_cache',
  'financial_snapshots', 'financial_summary', 'founder_intake_messages',
  'founder_intake_signals', 'founder_intakes', 'fundraising_pipeline', 'ghl_contacts',
  'ghl_opportunities', 'ghl_pipelines', 'ghl_sync_log', 'ghl_tags', 'ghl_task_bridge',
  'gmail_auth_tokens', 'gmail_contacts', 'gmail_messages', 'gmail_sync_status', 'goal_updates',
  'goals_2026', 'goods_asset_lifecycle', 'goods_capital_blocks', 'goods_content_library',
  'goods_cost_allocation_decisions', 'goods_deployment_batches', 'goods_funding_matters',
  'goods_funding_routes', 'goods_governance_readiness', 'goods_products', 'goods_relationships',
  'goods_route_allocations', 'goods_tranches', 'harvest_businesses', 'harvest_events',
  'health_alerts', 'idea_ack', 'idea_board', 'idea_snoozes', 'ignored_email_patterns',
  'image_overrides', 'imessage_attachments', 'invoice_project_overrides', 'knowledge_chunks',
  'knowledge_edges', 'knowledge_source_sync', 'knowledge_sources', 'knowledge_versions',
  'linkedin_contacts', 'location_project_rules', 'member_actions', 'member_wall_entries',
  'memory_episodes', 'migration_email_templates', 'mv_project_quarter_position',
  'newsletter_candidates', 'newsletter_drafts', 'newsletter_subscriptions', 'notion_actions',
  'notion_calendar', 'notion_decisions', 'notion_grants', 'notion_meetings',
  'notion_opportunities', 'notion_organizations', 'notion_projects', 'notion_projects_cache',
  'opportunities_unified', 'org_pipeline', 'page_gallery', 'pending_subscriptions',
  'person_identity_map', 'pm2_cron_status', 'project_budgets', 'project_commentary',
  'project_contact_alignment', 'project_contact_matches', 'project_focus_areas',
  'project_funding_allocations', 'project_funding_drawdowns', 'project_funding_profiles',
  'project_health', 'project_health_analysis', 'project_health_history', 'project_intelligence',
  'project_intelligence_snapshots', 'project_knowledge', 'project_media_links',
  'project_monthly_financials', 'project_pairings', 'project_pipelines', 'project_profiles',
  'project_research', 'project_salary_allocations', 'project_storytellers',
  'project_strategic_profile', 'project_summaries', 'project_support_graph', 'projects',
  'pulse_events', 'pulse_report_links', 'pulse_reports', 'pulse_responses', 'ralph_prds',
  'ralph_tasks', 'receipt_emails', 'receipt_match_history', 'receipt_matches',
  'receipt_pipeline_status', 'receipt_status', 'relationship_health', 'relationship_pipeline',
  'reminders', 'repo_project_links', 'resource_allocations', 'revenue_scenarios',
  'revenue_stream_projections', 'revenue_streams', 'saved_foundations', 'saved_grants',
  'sector_map_cache', 'sessions', 'site_config', 'site_health_checks', 'sprint_items',
  'sprint_snapshots', 'sprint_suggestions', 'strategic_objectives', 'studio_projects',
  'subscription_discovery_events', 'subscription_history', 'subscription_patterns',
  'subscriptions', 'supporter_comms_summary', 'supporters_intelligence', 'team_members',
  'telegram_conversations', 'telegram_mutes', 'touchpoints', 'user_gamification_stats',
  'user_identities', 'vendor_contact_log', 'vendor_project_rules', 'voice_notes',
  'wiki_page_versions', 'wiki_pages', 'wiki_search_index', 'witta_contributions',
  'xero_bank_accounts', 'xero_bank_transactions', 'xero_bas_tracking', 'xero_contacts',
  'xero_invoices', 'xero_payments', 'xero_sync_log', 'xero_sync_status', 'xero_tokens',
  'xero_transactions'
);

COMMIT;
```
