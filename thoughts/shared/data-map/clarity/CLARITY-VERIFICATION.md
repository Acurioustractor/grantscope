# CLARITY-VERIFICATION — adversarial pass

Ran 2026-08-14 against Supabase project `tednluwflfhxyucgwigh` (PostgreSQL 17.6, pg_cron 1.6)
and against both working trees. **68 claims checked: 47 CONFIRMED, 16 REFUTED, 5 INDETERMINATE.**

Posture: refute first. Every REFUTED row below carries the query or file that refutes it.
Nothing here is relayed — if I did not run it, it is marked INDETERMINATE.

**Three blockers.** One would break the nightly matview job on its first run. One means the
security stopgap does not close the exposure it exists to close. One takes down a live
unauthenticated public API. All three are one-file fixes; none invalidates the direction.

---

## 0. Method and its limits

- Queries via direct `psql` (no 8s cap), serial, targeted. No unfiltered scans.
- Code tracing: walked 5,433 `.ts/.tsx/.mjs` files across both repos (excluding
  `node_modules`, `.next`, `.vercel`, `dist`, `_archive`, `database.types.ts`, tests),
  classifying each reader's Supabase client by the **module inventory grepped from each repo**
  rather than by an assumed list of module names. That is the one methodological difference
  from `act-extraction-plan.md`, and it is where finding B3 came from.
- **Nothing was applied.** No migration, no DDL, no write. `clarity_refresh()` still has never run.

---

## 1. CLARITY-SPEC.md — panels and claims

### 1.1 Panel data: does the query return data, and is the coverage honest?

Every `/clarity` panel reads `clarity_object` / `v_clarity_ledger` / `clarity_question*`, and
**none of those exist** (verified, `to_regclass` → NULL for `clarity_object`, `clarity_question`,
`mv_clarity_flow`, `catalog_object_scope`, `mv_refresh_registry`). So no panel query is runnable
as written. What *is* testable is the **number each panel promises to print**. That is what I
tested — 30 of them.

| # | Panel · claim | Verdict | Evidence |
|---|---|---|---|
| P1 | S1 estate strip: `714 TABLE · 98 MATVIEW · 212 VIEW` | **CONFIRMED** | `pg_class` relkind: m=98, r=714, v=212 |
| P2 | S1 estate strip: `409 ROUTINE`, `1,433 OBJECTS` | **REFUTED** | `pg_proc` in `public` = **410** (all `prokind='f'`). 1,024 relations + 410 = **1,434**. Every "1,433" in the spec is off by one |
| P3 | S1 estate strip: `28 GB` | **CONFIRMED** | `pg_database_size` = 28 GB |
| P4 | S1 estate strip: `238 ACT PRIVATE-BUSINESS OBJECTS EXCLUDED` | **REFUTED** | 238 reconciles with nothing. The scope migration seeds **252 `act_private` + 47 `act_private_review`**; the plan says 162 IN / 46 borderline / 29 OUT / 89 views; §4.2 says 326 seeded rows. Appears in two wireframes and nowhere else |
| P5 | S1 THE EVIDENCE GAP: `alma_interventions` 2,136 rows, `gs_entity_id` 70.27% stamped | **CONFIRMED exactly** | `count(*)=2136`, `100*count(gs_entity_id)/count(*)=70.27` |
| P6 | S1/S2 binding join `justice_funding.gs_entity_id → gs_entities.id` = **93.65%** | **REFUTED (drift)** | Now **93.64%**; nulls = **9,986**, not the 9,976 printed on S5/S6. Recompute, never hardcode |
| P7 | S5 `justice_funding.recipient_abn` 95.00% | **REFUTED (drift)** | **95.29%** |
| P8 | S5 `justice_funding` `measure_kind` split: grant 126,673/$46.097bn · contract_value 29,519 · expenditure_aggregate 848/$66.126bn · budget_announcement 76 | **CONFIRMED exactly** | all four counts and both dollar figures reproduce to 3 dp |
| P9 | S1 GIVES AND TAKES: 85.3% of donation dollars are `other receipt` | **CONFIRMED** | 85.31%, 1,838,739 rows; `donation received` is 10.49% |
| P10 | S1/§4.3 sentinel: 13 AusTender rows > $5bn = 29.4% of all value; max = Hays Specialist Recruitment → Dept of the Treasury, $123.00bn | **CONFIRMED exactly** | 13 rows, 29.42%, `$123.00bn`, supplier and buyer both match |
| P11 | S6 seam: `political_donations` — only 653,261 of 2,549,483 rows carry a `donor_abn` | **CONFIRMED exactly** | 653,261 / 2,549,483 |
| P12 | S6 seam: `grantconnect_awards.recipient_abn → gs_entities.abn` 72.40%, **losing 80,500** | **CONFIRMED** | 210,764 of 291,264 matched = 72.36%; losing = **80,500 exactly** |
| P13 | S6 seam: `gs_relationships.source_record_id → justice_funding.id` = **0 of 49,426** | **REFUTED — denominator 17× too small** | `source_record_id` is non-null on **2,667,380** rows; **857,798** of them are `dataset='justice_funding'`. 0 of 200 sampled resolve, so *dead* is right; *49,426* is not. See §4 finding B4 |
| P14 | §1.5 / §7: `source_record_id` is "a dead key namespace, uuid-shaped" | **REFUTED as a statement about the column** | It is polymorphic: uuids (`aec_donations`, `justice_funding`), composite strings (`arc-2001-…`, `frrr-2015-…`), pipe-delimited names (`lobbying_register_nsw`), **bare ABNs** (`foundations`), and embedded foreign keys (`foundation-grantee-backfill:…:grant_opportunities:<uuid>:…`). Drill-through may already be buildable for at least `foundation_grantees` |
| P15 | S6 seam: `nz_charities.gs_entity_id` 0 of 45,192 | **CONFIRMED exactly** | 45,192 rows, 0 stamped |
| P16 | S6 seam: `ndis_participants_lga.lga_code` 100% NULL, 8,329 rows | **CONFIRMED exactly** | 8,329 rows, 0 non-null |
| P17 | S6 seam: `mv_funding_by_lga` grain defect, 1,729 rows / 548 keys = 3.16 | **CONFIRMED** | 1,729 / 548 = 3.156 |
| P18 | S7 flow matrix cardinality: 11 entity types × 11 × 10 relationship types ≤ 1,210 | **CONFIRMED** | `count(DISTINCT entity_type)=11`, `count(DISTINCT relationship_type)=10` |
| P19 | S7: `gs_relationships` `amount` 77.43% / `year` 69.66% populated | **CONFIRMED exactly** | 3,429,184 rows; 77.43 / 69.66 |
| P20 | S7 sentinel: two `entity_type='program'` nodes hold 605,135 edges = 17.6% | **CONFIRMED for the two named** | 330,460 + 274,675 = 605,135; /3,429,184 = 17.65% |
| P21 | §4.3 sentinel predicate `entity_type='program' AND degree > 10,000` catches **2** entities | **REFUTED** | It catches **5**: +`Specialised Service and Support` 63,710, `Gambling Community Benefit fund` 21,084, `Specialised Services and Support` 11,166. Total 701,095 = **20.4%**. The card copy is wrong the moment it renders, and the sentinel flags a real funding program |
| P22 | S7: `Department of Defence` appears twice in `gs_entities` | **CONFIRMED** | `AU-GOV-0ec98ef9…` (no ABN) and `AU-GOV-0ec9911c…` (ABN 68706814312), both `government_body` |
| P23 | S2 exclusion: `mv_entity_total_funding.grants_total` is exactly 0 across 94,088 rows | **CONFIRMED exactly** | 94,088 rows, 0 non-zero, max 0 |
| P24 | S9 want #1: `abs_indigenous_population_by_lga` is EMPTY | **CONFIRMED** | table exists, 0 rows |
| P25 | S9 want #2: `mv_board_contractor_links` 4 · `mv_board_donor_links` 2 · `mv_board_interlocks` 39,757 | **CONFIRMED exactly** | 4 / 2 / 39,757 |
| P26 | S9 want #6: `crime_stats_lga` WA 0, TAS 0 | **CONFIRMED** | states present: NSW 51,480 · QLD 4,082 · VIC 1,873 · SA 617 · NT 60 · ACT 13. No WA, no TAS |
| P27 | S9 want #7: `sa2_code` on 14.4% of `gs_entities` | **CONFIRMED** | 87,810 / 609,448 = 14.41% |
| P28 | §3.10 refusal: `aihw_youth_justice_stats` 13 rows, `source_table='PDF_HEADLINE'`, NT missing entirely | **CONFIRMED** | 13 rows, one `source_table`, 8 states — ACT/NAT/NSW/QLD/SA/TAS/VIC/WA. No NT |
| P29 | S3 caveat: 34,223 entities hold a postcode and no LGA | **CONFIRMED** | 34,224 today (drift of 1) |
| P30 | §1.4 G13: 209,172 isolate entities (34.3%) | **INDETERMINATE** | not re-measured; a full degree scan over 609,448 entities was not worth the pooler. The `program`-only degree scan alone cost 21.6 s |
| P31 | S1 HOUSE card: "71 of 98 matviews in no refresh registry · 55 in NEITHER registry" | **CONFIRMED but two different measures presented as one** | 98−27(cron) = 71; 98−43(cron ∪ script) = 55. Both true, adjacent, unlabelled |
| P32 | S4 ledger: 14 backup tables | **CONFIRMED** | 14 |
| P33 | S4 ledger: `abr_registry` 6.9 GB · `justice_funding` 1.2 GB · `gs_relationships` 2.1 GB · `gs_entities` 4.9 GB | **REFUTED (3 of 4)** | measured: **6,586 MB (6.43 GB)** · **391 MB** · **3,261 MB (3.18 GB)** · 4,956 MB (4.84 GB ✓). `justice_funding` overstated **3×**, `gs_relationships` understated 1.5× |
| P34 | S4 ledger / gap metric 17: **451 of 1,024** relations readable with the anon key | **REFUTED** | **837** relations carry an `anon` SELECT grant; **579** are effectively readable (206 with RLS off + 373 with RLS on and a permissive anon/public SELECT\|ALL policy). 451 reproduces under neither definition |
| P35 | S4 ledger: 3 `SECURITY DEFINER` functions anon-executable | **CONFIRMED** | exactly 3 |
| P36 | S4 ledger: `person_roles` 57 days stale | **INDETERMINATE** | `max(created_at)` = 2026-03-26 = **141 days**. Which column the freshness probe would pick is unspecified, so 57 is neither confirmed nor refuted — but it is not derivable from `created_at` |
| P37 | S1 BIDDER FRAGILITY: 773 fragile of 5,898, median 0.9 months | **INDETERMINATE** | the defining query is not in the spec; not reproducible |
| P38 | S1 WATCHHOUSE CHILDREN reads `qld_watchhouse_*` | **CONFIRMED (ingredients exist)** | `qld_watchhouse_snapshots`, `qld_watchhouse_snapshot_rows` both present. The 2.7× / 14.2→38.8 figures were not re-derived |
| P39 | §4.1 carried migration: `data_catalog_snapshots` 1,419 rows / 25 tables / 2026-04-09 → 2026-08-13 | **CONFIRMED exactly** | all four values |
| P40 | §1 "`clarity_object` … do not exist; `data_catalog`, `data_catalog_snapshots`, `mv_refresh_log` do" | **CONFIRMED** | `to_regclass` |

### 1.2 Would any panel time out?

| Claim | Verdict | Evidence |
|---|---|---|
| "No screen query touches `gs_entities`, `gs_relationships`, `austender_contracts`, `abr_registry`, `political_donations`, `asic_companies`" | **CONFIRMED by inspection** | every S1–S9 query reads only `clarity_*` / `v_clarity_*` / `mv_clarity_flow`. Correct, and it is the single most important performance decision in the spec |
| "the live `GROUP BY` over 3.43M edges was ~40 s, 5× the ceiling — the flow matrix must be a matview" | **CONFIRMED directionally** | I did not run the full aggregate, but `count(DISTINCT relationship_type)` alone took **6.4 s** and `count(amount)/count(year)` took **8.7 s**. Both would have failed through `gsql.mjs`. The 8-second RPC ceiling is real and I hit it |
| S4 ledger: 1,433 rows × ~34 fields in one round trip | **PLAUSIBLE, untestable** | `v_clarity_ledger` does not exist. The row count is right; the payload estimate is `[I]` and stays `[I]` |
| `/api/clarity/rescore` = `SELECT clarity_score()`, "sub-second" | **UNVERIFIED** | `clarity_score()` has never been executed by anyone. Calling it sub-second is a guess about an unrun function |

### 1.3 Architecture compliance

| Claim | Verdict | Evidence |
|---|---|---|
| `getDirectServiceSupabase()` exists and differs from `getServiceSupabase()` | **CONFIRMED** | `apps/web/src/lib/supabase.ts:159` and `:167` |
| `requireAdminPage(pathname, fallback='/home')` at `admin-auth.ts:40` | **CONFIRMED** | exact signature at line 40 |
| `ops/layout.tsx` is "seven lines" | **REFUTED (trivial)** | 9 lines (7 non-blank). Pattern is exactly as described |
| `.ws` workspace theme at `globals.css:116` | **CONFIRMED** | `.ws {` at line 116 |
| Installed: recharts ^3.7.0, react-force-graph-2d/3d ^1.29.1, leaflet ^1.9.4, react-leaflet ^5.0.0 | **CONFIRMED** | `apps/web/package.json` |
| Absent: d3, d3-sankey, topojson-client, @tanstack/react-virtual, nuqs, maplibre-gl, deck.gl, cytoscape | **CONFIRMED — all eight absent** | "dependencies added: zero" holds |
| Mandatory rule 1: `dynamic(() => import('react-force-graph-2d'), {ssr:false})` must live INSIDE the `'use client'` file | **CONFIRMED, and matches both existing usages** | `app/graph/page.tsx` and `app/entity/[gsId]/network-graph.tsx` both open with `'use client'` then `import dynamic from 'next/dynamic'` |
| `exec_sql` read-only guard "admits any statement starting `select` or `with`" | **CONFIRMED** | `apps/web/src/lib/supabase.ts`: `if (!/^(select\|with)\b/i.test(stripped)) return false;` |
| `/api/data/schema-graph/route.ts`: 280 lines, `n_live_tup > 0` at line 109, `if (!domain) continue;` at line 151, zero consumers | **CONFIRMED on all four** | `wc -l` = 280; both lines verbatim at the stated numbers; grep across `apps/web/src` + `scripts` returns nothing |
| DDL traps: `null_pct` not `fill_rate`; `distinct_est`; no `fk_target`; `clarity_object_history.snapshot_at`; `clarity_object` has no `scope` column, only `act_business` + `act_business_source`; `clarity_object_no_cruft_while_referenced` exists | **CONFIRMED — all six** | read `20260815000000_clarity_catalog_schema.sql` directly |
| §4.3 PK fix (`join_key text NOT NULL DEFAULT ''` + plain PK) | **CONFIRMED as valid** | table constraints take a column list; the rewritten form is legal. The original `PRIMARY KEY (…, coalesce(join_key,''))` is not |

### 1.4 The honesty tests

| Test | Verdict | Evidence |
|---|---|---|
| Does any view exceed the ~150-node ceiling? | **PASS** | seam graph = 14 domains + top 126 = **140 nodes**, cap 150, refusal at 200. Flow matrix 11×11 per relationship type, ≤1,210 rows. Join matrix 196 cells. All bounded by construction |
| Does anything depend on `gs_relationships.source_record_id`? | **PASS on intent, FAIL on the number** | the spec correctly refuses to build the drill. But it prices the loss at 49,426 rows when the justice subset alone is **857,798** (finding B4) |
| Does any panel say "has no evidence" about an organisation? | **PASS** | the only two occurrences in 1,816 lines are the ban itself (§1.4 G13) and the `NOT:` line of the SAY-IT-THIS-WAY block. Every rendered string uses "no evidence record linked in ALMA" |
| Is the ACT exclusion actually applied? | **PARTIAL FAIL** | `act_business` is filtered in **exactly two** queries: the estate strip (§3.1 Query A) and the changes query (§3.8). **S6 seams, S7 cross, S9 wants and the board query do not filter it**, and `clarity_score()` only *penalises* ACT objects ×0.50 rather than excluding them. So `/clarity/seams` will rank `person_identity_map ↔ canonical_entities` and the `xero_*` FKs alongside civic seams, under a header that says 238 ACT objects are excluded |

---

## 2. The matview fix — `2026-08-14-mv-refresh-{registry,cron}.sql`

### 2.1 Is the dependency order correct?

**Yes.** I re-derived the edge set independently using the migration's own recursive definition:
**27 matview→matview edges across 19 dependent matviews** — which reproduces
`matview-reconciliation.md` §3 exactly (I counted 27 edges in its own listing, and it states
"19 of 98"). No cycles. Chasing through plain views is the right call and catches real edges that
direct `m→m` misses.

The `depth` CTE takes `MAX(dp.d)` per member — longest-path layering, which is the correct
topological ordering — and intra-tier filtering means a base in another tier cannot mis-order a
dependent. Tier consistency also holds: walking all 27 edges against the seeded tiers, **no
matview is scheduled fresher than a matview it reads**. The seed itself reproduces the doc's
table exactly: **nightly 50 · weekly 15 · on_demand 24 · retire 9 = 98**, one row per matview,
`ON CONFLICT (mv_name) DO UPDATE` so re-running is safe.

Two ordering defects, neither fatal:

| # | Defect | Verdict | Evidence |
|---|---|---|---|
| M-a | `use_concurrent` tests `i.indisunique` only | **REFUTED — incomplete** | `REFRESH … CONCURRENTLY` also requires the unique index to be **non-partial and expression-free**. `mv_foundation_landscape_geo` has a unique **expression** index today. Latent only because that matview is `tier='retire'`; any future one is a nightly CONCURRENTLY failure. Fix: `AND i.indpred IS NULL AND i.indexprs IS NULL` |
| M-b | The migration's own footer check `planned = enabled member count` is claimed to detect cycles | **REFUTED** | `ranked` does `members LEFT JOIN depth … COALESCE(MAX(dp.d),0)`, so **every member appears exactly once whether or not it is reachable**. A cycle silently collapses to depth 0 and the counts still match. The check detects orphan registry rows, nothing more |

### 2.2 Does it handle failure without aborting the run?

Per-matview subtransaction: **yes, preserved and correct.** The `COMMIT` is deliberately placed
in the loop body *outside* the `BEGIN…EXCEPTION` block, which is exactly right — PostgreSQL:
*"a block with exception handlers forms a subtransaction, which means that transactions cannot be
ended inside such a block."* The author reasoned this through and got it right. `COMMIT` inside a
`FOR … IN <read-only query>` loop is also legal on PG 11+ (the portal is auto-converted to
holdable). PG here is **17.6**, pg_cron **1.6**.

**But the procedure will not run at all.** See finding B1.

### 2.3 Would it break anything currently working?

| Claim | Verdict | Evidence |
|---|---|---|
| Existing `refresh_civicgraph_mvs` is zero-argument, so `CREATE OR REPLACE` would silently overload and leave the old 27-name body live — hence the explicit `DROP FUNCTION` | **CONFIRMED** | `pg_get_function_identity_arguments` returns empty for the live function (4,496 bytes of `prosrc`). The trap is real; the fix is correct |
| Every cron-written duration is 0 because `now()` is `transaction_timestamp()` | **CONFIRMED exactly** | last 30 days: `pg_cron` 785 rows, **785 with `duration_ms=0`**, only **31 distinct `started_at`** (= 31 runs). `refresh-views-v2` 249 rows, **0** zero-durations, 246 distinct starts |
| `mv_funding_by_disadvantage` = 1 row, `mv_indigenous_funding_by_disadvantage` = 0, caused by one stray `acnc_ais.ais_year = 2025` row | **CONFIRMED exactly** | 1 / 0 rows; `acnc_ais`: 2025 → **1 row**, 2023 → 53,207, 2022 → 52,935 |
| The four `v_`-prefixed registry entries really are matviews | **CONFIRMED** | `v_grant_stats`, `v_austender_stats`, `v_ato_largest_entities` all `relkind='m'`. No phantom names |
| All 98 matviews populated | **CONFIRMED** | 0 unpopulated, so `CONCURRENTLY` is legal wherever a suitable index exists |
| `scripts/refresh-views-v2.mjs` patched to read `mv_refresh_plan()` and print drift | **CONFIRMED** | `node --check` passes; `VIEW_LIST` / `NEEDS_NON_CONCURRENT` / hardcoded `HEAVY` gone; reads `mv_refresh_plan('<tier>')` and `v_mv_refresh_drift` |
| "4 matviews do the work twice" | **CONFIRMED for the current cron list; understated for the new one** | **43 of 98 matviews have no unique index at all**, and the new nightly tier promotes several of them (`mv_person_entity_network`, `mv_foundation_grantees`, `mv_funding_deserts` [17 app readers], `mv_funding_by_lga`, `mv_disability_landscape`, `mv_donation_contract_timing`, `mv_individual_donors`). Each gets a **non-concurrent** refresh = `ACCESS EXCLUSIVE` lock blocking every app read for its duration. Correct behaviour, but a new nightly stall the doc never prices |

### 2.4 Cross-document conflict

`mv_board_contractor_links` and `mv_board_donor_links` are seeded **`tier='retire'`** ("no reader
of any kind") — while CLARITY-SPEC's want list ranks **repairing them #2**, "UNLOCKS DIRECTORS AND
CONTRACTS + DIRECTORS AND DONORS, two flagship cross-sections". Apply the registry first and the
repaired matviews never refresh again.

---

## 3. The ACT extraction and the revoke migration

### 3.1 The revoke: policy-by-policy

**48 `DROP POLICY` statements. All 48 target policies exist with the exact stated name** — no
no-op drops, which is better precision than most migrations of this shape. For **46 of 48**,
**zero other anon/public SELECT policy survives**, so the drop genuinely closes the read.

**Code trace: 5,433 files, both repos.** For 46 of the 48 tables the only readers are service-role
clients or `scripts/*.mjs` — service role has `rolbypassrls = t` (verified), so those readers are
untouched. **The doc's core safety claim holds for 46 of 48.**

| Claim | Verdict | Evidence |
|---|---|---|
| Every drop is safe; "exactly two objects came back positive — `campaign_content` and `campaign_outreach` — and neither is in the revoke list" | **REFUTED** | `partner_contacts` and `partner_goals` also have an anon-key reader. See B3 |
| Dropping the anon read on `knowledge_chunks` closes the exposure | **REFUTED** | a second `{public}` SELECT policy survives and matches 19,367 of 19,413 rows. See B2 |
| `knowledge_sources` | **CONFIRMED (closed)** | `org_sources_select` survives but requires org membership, and **0 of 12** rows have `org_profile_id IS NULL` — so anon gets nothing |
| `discrimination_reports`: drop the read, keep the public submit | **CONFIRMED** | `public_read_discrimination_reports` (SELECT `{anon}`) dropped; `anon_insert_discrimination_reports` (INSERT `{anon}`) untouched |
| `xero_payments` "Public read" is `{anon,authenticated}` with the grant present | **CONFIRMED** | policy exists, anon grant present, only reader is `lib/services/org-verification-service.ts` (service role) |
| 13 `FOR ALL` policies granting role `public` with `USING (true)` | **CONFIRMED exactly 13** | `alert_events`, `campaign_content`, `campaign_outreach`, `funder_portfolio_entities`, `funder_portfolios`, `project_strategic_profile`, `review_curated_entries`, `review_media_links`, `review_projects`, `review_videos`, `review_year_settings`, `storytellers`, `strategic_objectives` |
| `storytellers`: dropping the broad ALL restores the consent model rather than inventing one | **CONFIRMED** | 3 policies; `Public read for consenting storytellers` — `USING (consent_given = true AND (privacy_preferences->>'public_display')::boolean = true)` — survives. 227 rows |
| Dropping "service role full access" policies does not break service-role writes | **CONFIRMED** | `service_role.rolbypassrls = t`, `postgres` too; `anon` and `authenticated` are `f`. This is the load-bearing assumption of the whole second migration and it holds |

### 3.2 The extraction IN list: is anything misclassified civic data?

| Check | Verdict | Evidence |
|---|---|---|
| FKs pointing **into** the 162 confirmed-IN tables from outside the list | **CONFIRMED, and better than stated** | only **2**: `knowledge_chunks → project_knowledge` and `project_funding_drawdowns → xero_invoices`. Both referencing tables are on the plan's own BORDERLINE list, not civic. The "16 civic tables hold an FK into ACT" figure is about the full 237-candidate set, not the IN list |
| Views outside the IN list that read IN-list tables | **CONFIRMED, no gap** | 60 view→table pairs; every view is either in `act_pure_views_list.txt` or on the §2.2 straddler table (`v_act_people`, `v_act_income_history`). No uncatalogued straddler |
| Every IN-list object is genuinely ACT business data | **REFUTED for 3 objects** | `goods_funding_routes`, `goods_route_allocations` and `goods_governance_readiness` are on the **IN (move)** list while §4 Phase 0 recommends *"Goods relationship/asset layer: **Stay.** It is a product surface on the civic graph, not books"* and names only `goods_tranches` + `goods_cost_allocation_decisions` (+ `goods_capital_blocks`) as Move. See B5 |
| `sector_map_cache` and `dedup_tranche1_20260809` correctly excluded as civic | **CONFIRMED** | both on `act_out_list.txt`; neither appears on `act_in_list.txt` |
| `act_research_experiments` / `act_research_initiatives` on the IN list and on the revoke HOLD list | **CONFIRMED consistent** | policy exists, no anon grant, already safe |

---

## 4. Ranked corrections — must be applied before building

### BLOCKERS

**B1 — `refresh_civicgraph_mvs_run()` cannot commit. The nightly job would refresh nothing.**
`migrations/2026-08-14-mv-refresh-cron.sql:59-63` declares the procedure with
`SET search_path TO …` and `SET statement_timeout TO '0'`, and its body calls `COMMIT` at line 111.
PostgreSQL 17 `CREATE PROCEDURE`, `configuration_parameter`: *"If a `SET` clause is attached to a
procedure, then that procedure cannot execute transaction control statements (for example, `COMMIT`
and `ROLLBACK`, depending on the language)."* The procedure **creates cleanly** (plpgsql does not
validate this at definition time) and then **raises on the first `COMMIT`** — after which the
aborted transaction discards the `mv_refresh_log` insert too. Net result once
`cron.schedule('… CALL refresh_civicgraph_mvs_run(''nightly'')')` is run: **zero matviews
refreshed, zero log rows, every night, visible only in the pg_cron log.** Exactly the failure the
brief says is worse than an unreconciled registry.
*Fix:* delete both `SET` clauses from the **PROCEDURE** and issue them as body statements instead
(`SET statement_timeout = '0'; SET search_path = public, extensions, pg_catalog;` — a plain `SET`
inside plpgsql is session-scoped and survives `COMMIT`; `SET LOCAL` would not). Leave the wrapper
**FUNCTION** exactly as it is — it has no `COMMIT`, so its `SET` clauses are legal.
*Sequencing note, and it is good news:* pg_cron job 4 today runs `SELECT refresh_civicgraph_mvs()`,
which resolves to the new zero-arg-compatible **function**. So applying both migrations and
**leaving cron alone** is safe and delivers the registry-driven list. Only the Tier-3
`cron.schedule(… CALL …)` step is dangerous, and only until B1 is fixed.

**B2 — The revoke does not close the exposure it exists to close.**
`knowledge_chunks` carries a second `{public}` SELECT policy, `org_chunks_select`, whose predicate
is `((org_profile_id IS NULL) OR (org_profile_id IN (SELECT … FROM org_profiles …)))`. Measured:
**19,367 of 19,413 rows have `org_profile_id IS NULL`.** Dropping "Anon read access on
knowledge_chunks" therefore changes nothing for anon — every ACT knowledge chunk, including the
verbatim personal iMessage content named as the headline reason for the stopgap, stays readable
with the public anon key. The plan's §0 sells this as the single strongest motive for the work.
*Fix:* add `DROP POLICY IF EXISTS "org_chunks_select" ON public.knowledge_chunks;` (with a
replacement that drops the `org_profile_id IS NULL` branch), and **re-run the surviving-policy
check across all 48 tables** before applying — I ran it once and it found this one; the migration
was written without it.

**B3 — The revoke takes down a live unauthenticated public endpoint.**
`JusticeHub/src/app/api/organizations/[id]/route.ts` is `export const dynamic = "force-dynamic"`,
has **no auth check of any kind**, is not covered by `src/middleware.ts` (matcher is
`/justice-matrix/*` only), builds its client from `@/lib/supabase/server-lite` — which is
`createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` — and reads
`partner_goals` and `partner_contacts`. Both tables have RLS **on**, an `anon` SELECT grant, and
**exactly one policy each**, which is the one being dropped. After the migration: RLS on, zero
policies, deny-all. The route's goals and contacts sections silently return empty.
The safety method missed it because its module list included `client-lite` but not **`server-lite`**.
*Mitigating:* no in-repo page fetches `GET /api/organizations/[id]` (the only in-repo callers hit
`/claim`), and the public org page `src/app/organizations/[slug]/page.tsx` uses
`createServiceClient()`, so it survives. Severity is a broken public API, not a blank page.
*Fix:* either switch that route to `createServiceClient()` first, or move `partner_contacts` and
`partner_goals` to the HOLD list. **And re-run the whole safety sweep with the corrected module
inventory** — the enumerated anon-key modules are `src/lib/supabase{.ts,/client.ts,/client-lite.ts,/server.ts,/server-lite.ts,/signal-engine.ts}`,
`src/lib/integrations/profile-linking.ts`, `src/lib/env.ts` (JH) and
`apps/web/src/lib/supabase-{browser,server,env}.ts` (GS).

### MUST-FIX BEFORE BUILDING

**B4 — The flagship seam number is 17× too small, and the "dead namespace" claim is over-broad.**
`gs_relationships.source_record_id` is non-null on **2,667,380** rows; **857,798** of those are
`dataset='justice_funding'`, not 49,426. 0 of 200 sampled justice values resolve into
`justice_funding.id`, so *dead for justice* is right — but the column is **polymorphic**, not
uuid-shaped: `foundations` stores bare ABNs, `foundation_grantees` stores
`foundation-grantee-backfill:<uuid>:grant_opportunities:<uuid>:na:general`, `arc_grants` /
`frrr_grants` / `creative_australia` / `hms_trust_grants` store composite `source-year-name` keys,
`lobbying_register_nsw` stores pipe-delimited names. Fix the seams row and the §7 refusal to say
*"0 of 857,798 justice edges"*, and re-test per dataset — record-level drill-through may already
be buildable for `foundation_grantees` and possibly `austender`, which would change a §1.5
rejection decision.

**B5 — `act_in_list.txt` moves three tables the plan's own recommendation says must stay, and one
of them backs the GrantScope home page.**
`goods_funding_routes`, `goods_route_allocations`, `goods_governance_readiness` are on the
confirmed-IN list. §4 Phase 0 says the Goods relationship/asset layer stays because it is a
CivicGraph product surface (14 tabs at `/org/act/goods/*`). Verified readers:
`goods_governance_readiness` ← **`apps/web/src/app/home/page.tsx`** and
`lib/goods-readiness-snapshot.ts`; `goods_funding_routes` and `goods_route_allocations` ←
`app/org/[slug]/goods/capital/actions.ts` and `lib/services/goods-capital-workspace.ts`.
Anyone who runs the §3 command `pg_dump -t $(cat act_in_list.txt)` moves them, and the home page
loses its readiness snapshot. Reconcile the machine-readable list with the human-readable
recommendation **before** Phase 3, or delete the file.

**B6 — The `category_node_hub` sentinel predicate does not match its own copy.**
`entity_type='program' AND degree > 10,000` returns **5** entities holding **701,095 edges =
20.4%**, not 2 / 605,135 / 17.6%. One of the five (`Gambling Community Benefit fund`, 21,084) is a
real funding program, not an AusTender category, so the sentinel as written would block questions
over legitimate data. Either raise the threshold to ~50,000 (which isolates the two true category
nodes at 330,460 and 274,675) or derive the card copy from the probe instead of hardcoding it.

**B7 — Gap metric 17 is wrong by 128–386 relations.** "451 of 1,024 readable with the anon key"
reproduces under no definition: **837** carry the grant, **579** are effectively readable. Since
this metric drives a HOUSE card with a target of ≤50, publishing 451 understates the exposure.
Re-measure and state the definition on the card.

**B8 — `mv_refresh_plan()`'s CONCURRENTLY test needs two more predicates.** Add
`AND i.indpred IS NULL AND i.indexprs IS NULL` (`mv_foundation_landscape_geo` already violates it).
And replace the footer's cycle check — `planned = members` cannot detect a cycle because the
`LEFT JOIN … COALESCE(MAX(d),0)` guarantees the counts match.

**B9 — Resolve the retire/repair conflict.** `mv_board_contractor_links` and `mv_board_donor_links`
are `tier='retire'` in the registry and want-list item #2 in the spec. Pick one: either seed them
`nightly, enabled=false` with a note, or drop them from the want list.

**B10 — Apply the ACT exclusion on the screens that do not have it.** `act_business` is filtered
only in the estate strip and the changes query. `/clarity/seams`, `/clarity/cross`, `/clarity/wants`
and the board query need the same filter (or an explicit `scope=all` opt-in), otherwise the
surface renders `xero_*` and `person_identity_map` seams under a header claiming ACT is excluded.

**B11 — Replace `238`.** It reconciles with nothing measured. Derive it from
`count(*) FILTER (WHERE act_business)`, and note that the scope table seeds **252 `act_private` +
47 `act_private_review`**.

### FIX BEFORE PRINTING

**B12 — `1,433` → `1,434`.** 410 functions, not 409.

**B13 — The wireframe numbers are not measured, and read as if they were.** `justice_funding` is
**391 MB**, not 1.2 GB (3× overstated); `gs_relationships` **3.18 GB**, not 2.1 GB;
`abr_registry` **6.43 GB**, not 6.9 GB. In a spec whose thesis is that a number must travel with
its provenance, the mock-ups should carry `[I]` or be regenerated from the sweep.

**B14 — Coverage figures have already drifted.** `justice_funding.gs_entity_id` is 93.64% with
**9,986** nulls (spec: 93.65% / 9,976); `recipient_abn` is **95.29%** (spec: 95.00%). Small, but
these are the numbers `[ COPY THE CLAIM ]` puts on a funder's clipboard. Compute at render, never
hardcode.

**B15 — Price the new nightly locks.** 43 of 98 matviews have no unique index. The new nightly
tier promotes several of them, and each takes an `ACCESS EXCLUSIVE` lock during refresh —
including `mv_funding_deserts` (17 app readers) and `mv_foundation_grantees` (5 app + 3 function +
2 view readers). Correct behaviour, unpriced. Either add unique indexes first or state the
expected blocking window.

---

## 5. What survived the attack

Worth recording, because the ratio matters: **25 numeric claims reproduced exactly** — the
`measure_kind` split to three decimal places, the `$123.00bn` Hays row with its supplier and
buyer, 653,261 of 2,549,483 donor ABNs, 80,500 GrantConnect awards losing, 605,135 category-node
edges, 4/2/39,757 board matviews, 1,419 snapshot rows over 25 tables, 94,088 rows of zero
`grants_total`, the single stray `acnc_ais` 2025 row, 785 of 785 zero-duration cron log rows.
Every architecture claim held. The `DROP FUNCTION` signature trap is real and correctly handled.
The dependency graph re-derived to 27 edges / 19 dependents on the nose. `service_role` really
does bypass RLS, so the policy-fix migration is safe to apply. And the phrasing discipline holds:
in 1,816 lines, the banned phrases appear only where they are being banned.

## 6. What I did not check

- The 209,172 isolate count, the bidder-fragility figures, and the watchhouse 2.7× / 14.2→38.8
  series (P30, P37, P38 partial).
- Which column a freshness probe would choose for `person_roles`, so its "57 days" is neither
  confirmed nor refuted.
- Whether the three anon-executable `SECURITY DEFINER` functions all write.
- Whether the 89 pure-ACT views' definitions are individually correct — I checked coverage of the
  set, not each definition.
- The 46 BORDERLINE verdicts. They are product-strategy calls and the plan says so.
- Whether the parallel session's five migrations apply cleanly in the stated order — untested by
  anyone, still.
- The `mv_clarity_flow` refresh duration. Its underlying aggregate is the only measured input.
- Anything rendered. Nothing in CLARITY-SPEC has ever been drawn on a screen.
