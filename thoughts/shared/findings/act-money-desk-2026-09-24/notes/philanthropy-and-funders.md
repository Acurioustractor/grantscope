# Philanthropy and funders: what exists for FINDING PHILANTHROPY for ACT projects

Read-only survey, 2026-09-24, repo `/Users/benknight/Code/grantscope` at `1b517ba0`. Every number below was run
today with `node --env-file=.env scripts/gsql.mjs "<sql>"` unless marked inferred/unverified. File claims cite
`path:line` from files read in full or in the quoted range.

---

## 0. Judgement first (read this if nothing else)

1. **The giving figures are back on placeholders, and the column now lies about it.** Migration
   `supabase/migrations/20260907130000_foundations_giving_placeholders.sql` replaced the guessed $25k/$100k/$500k
   with each charity's latest ACNC AIS `grants_donations_au` and is tracked as applied. On **2026-09-22 02:35:54Z**
   `sync-acnc-register` (agent_runs, 42.9s) upserted whole rows and 10,101 `foundations` rows were rewritten
   between 02:35:58 and 02:36:36 with the size-derived guess again. Today 8,196 of 8,307 rows whose
   `enrichment_source` says `acnc_ais_<year>` hold the placeholder, not the AIS figure ($630m shown vs $1.70bn in the
   AIS). The code fix (`sync-acnc-register.mjs:83-96`, PR #506, 2026-09-23) stops the next overwrite, but nobody
   re-ran the repair. Worse: `enrichment_source` still reads `acnc_ais_2024`, so every guard written as
   "`enrichment_source NOT ILIKE 'acnc%'` means placeholder" now treats guesses as verified. The truth is
   recoverable: `metadata->>'giving_source'` and `metadata->>'placeholder_giving'` survived (9,242 rows).
2. **`grant_range_min` / `grant_range_max` are the same size-derived guess** (`packages/grant-engine/src/foundations/acnc-importer.ts:188-195`:
   Large 10k-5M, Medium 5k-500k, Small 1k-100k). The Goods Foundation Targets page prints them as "grants $X-$Y".
3. **Three disconnected "find me a foundation" engines write three different tables with three scorers**:
   `org_project_foundations` (1,553 rows, `match-foundations-for-projects.mjs`, nightly),
   `v_goods_foundation_targets` (2,098 rows, a view, Goods-only theme list hard-coded),
   `saved_foundations` (182 rows, `score-foundation-alignment.mjs`, weekly, keyed to a *user*, not a project).
   None reads the others. None reads `funder_intelligence` (11,159 rows, computed 2026-08-03, **zero app consumers**).
4. **Observed giving is the only evidence and it is tiny**: 5,695 `foundation_grantees` rows from 24 publishers;
   FRRR (3,531) and Ian Potter (1,707) are 92% of it. 20 of 24 publishers have no amounts at all.
   `admin/philanthropy` already says this ("500 to 1" stated vs observed).
5. **Board paths exist but are all unverified and mostly not ACT-reachable**: 2,651 `funder_board_paths`,
   100% `path_grade='unverified'`, 100% `identity_confidence='medium'`, 72% `collision_risk='high'`. Only **20 paths
   (15 foundations)** land on an entity ACT already has a relationship with; 8 of those 20 are the same two Rotary
   directors.
6. **ACT's real relationship truth is spread over five stores that do not agree on names**: `funder_context_snapshot`
   (1,196 names, nightly, name-ILIKE matched, has "The Snow Foundation" and "The Trustee For The Snow Foundation"
   as two rows scoring 75 and 70), `v_funder_next_move` (47 Xero counterparties, half are customers not funders),
   `wiki/narrative/funders.json` (25 entries, hand-curated, last edited 2026-07-07, 9 are DATA-ONLY STUBs),
   `funder_briefs` (2 rows, stale since 2026-05-23, no app reader), GHL tags (98 `goods-*` warmth-tagged contacts,
   7 tagged funder/philanthropy/foundation).
7. **Dead weight**: `funder_portfolios` 0 rows, `funder_portfolio_entities` 0, `funder_nudge_log` 0,
   `funder_profiles` 3 rows with no app reader (it is funders-as-*viewers* of CivicGraph, a different concept),
   `funder_briefs` 2 rows with no app reader, `v_funder_next_move` / `v_funders_summary` / `v_funder_tag_density`
   have no app reader.
8. **JEV touches charities, not foundations.** `gs_charity_classification` (66,404 rows, 4,317 `grantmaking`,
   2,994 at conf >= 0.9, refreshed 2026-09-22) feeds `/charities/[abn]/funders` only. Nothing JEV-judged exists
   for a foundation's theme, geography or "does it fund orgs like ACT's". Foundation `thematic_focus` is
   scrape+LLM (`build-foundation-profiles.mjs:258-262`).

---

## 1. Inventory: the 19 named objects (columns, counts, provenance, consumers)

Existence query:
```sql
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' AND table_name IN (...19 names...)
```
All 19 exist: 14 base tables, 5 views.

Count query (one UNION ALL; note gsql wraps the query, so a column alias of `t` collides; use `tbl`):
```sql
SELECT 'foundations' AS tbl, count(*) AS n FROM foundations UNION ALL ... UNION ALL SELECT 'v_act_income_by_funder', count(*) FROM v_act_income_by_funder
```

| object | kind | rows | what it is | written by | read by (app) |
|---|---|---|---|---|---|
| `foundations` | table | **11,235** | the foundation register: `id, acnc_abn, name, type, website, description, total_giving_annual, giving_history, avg_grant_size, grant_range_min/max, thematic_focus[], geographic_focus[], target_recipients[], endowment_size, ..., has_dgr, gs_entity_id, enrichment_source, enriched_at, embedding, metadata` | `sync-acnc-register.mjs` (weekly, 168h), `build-foundation-profiles.mjs`, `refresh-acnc-ais.mjs` (its UPDATE goes via exec_sql which is SELECT-only, so it never wrote), 20 scripts total touch `total_giving_annual` | 347 files reference the word; the real readers below |
| `acnc_charities.is_foundation` | flag | **10,269** true of 66,459 | ACNC register flag; 2,312 of those also `ben_other_charities=true` | ACNC sync | `/charities/[abn]/funders` (indirect) |
| `funder_profiles` | table | 3 | funder-tier *viewer* accounts: dusseldorp, minderoo, prf (`role='viewer'`, `source_tags`, never logged in) | manual | **none** (grep of apps/web/src: 0 files) |
| `funder_briefs` | table | 2 | per-funder x project brief: snow-foundation/ACT-GD ($120k ask, in-review, WARN), qbe-catalysing-impact/ACT-GD (submitted, PASS); both `updated_at=2026-05-23`, next_move_due 2026-03-15 / 2026-04-30 (both overdue) | manual | **none** |
| `funder_intelligence` | table | **11,159** | per-foundation grades: giving_grade, reach_grade, theme_grade, board_grade, type_grade, evidence_tier (1/2/3), rank_score, derived_thematics; `computed_at` max **2026-08-03** | `foundation-intelligence-refresh.mjs` (168h schedule, last run 2026-09-18, but computed_at did not move: the script now only seeds `source_frontier` crawl targets; its header says so) | **none** |
| `funder_context_snapshot` | table | **1,196** | per funder-name dossier: foundation match, GHL contacts, grantees, Xero totals, Notion org, Gmail summary, decisions, `relationship_score` | `refresh-funder-context.mjs` nightly (not in agent-registry; ran 2026-09-23 20:35, 642 upserted) | `act-funder-intelligence.ts:658-662,772-778`, `act-opportunity-context.ts`, `/ops/grant-recommendations`, `/reports/grant-frontier`, `/home` |
| `funder_allowlist` | table | 40 | curated funders with themes, jurisdictions, typical grant band, `requires_dgr`, `application_channel`; only 4 have `verified_at` | manual 2026-05-15 | `/reports/grant-frontier`; `refresh-funder-context.mjs:280` seeds names |
| `funder_blocklist` | table | 12 | 8 auto-blocked by nightly "N passes, 0 watches" rule, 4 values exclusions (Santos, BHP, Fortescue, Rio Tinto) | `act-auto-pass-stale-pipeline` + audit 2026-08-07 | `/reports/grant-frontier` |
| `funder_portfolios` | table | **0** | funder-tier user saved collections (`scripts/create-funder-portfolios.sql`) | nobody | 1 file |
| `funder_portfolio_entities` | table | **0** | children of the above | nobody | 1 file |
| `funder_entity_links` | table | 695 | `funder_key -> gs_entity_id`, `link_method` unique_name 667 / reviewed 28, last 2026-09-21 | a linker (not in the brief's script list) | 1 file |
| `funder_board_paths` | table | **2,651** | foundation person -> connected entity, with `path_grade`, `collision_risk`, `identity_confidence`, `cluster_size`; `computed_at` 2026-08-03 | same refresh as `funder_intelligence` | `dashboard/browse/foundations/[id]/page.tsx:35`, `api/browse/foundation/route.ts:48`, `foundation_browse()` RPC (board count sort) |
| `funder_nudge_log` | table | **0** | outreach nudges per funder x project | nobody | **none** |
| `saved_foundations` | table | 182 | user x foundation with `stage`, `alignment_score`, `alignment_reasons`, `org_profile_id` | `score-foundation-alignment.mjs` weekly (178 rows `stage='discovered'`, all `notes` = "Auto-discovered by Foundation Alignment Agent") + `/api/foundations/saved` | `/home`, `/home/watchlist`, `/continue`, `/org/[slug]/goods/engagement` |
| `v_funder_next_move` | view | 47 | `v_funder_summary` + a CASE next-move string | Xero | **none** |
| `v_funder_summary` | view | 47 | Xero ACCREC invoices grouped by `contact_name`: revenue, outstanding, days_since_last, `warmth_score` (log-revenue + recency + count + years + span + authorised bonus), `warmth_band` HOT/WARM/STEADY/COOLING/COLD | Xero | 1 file |
| `v_funders_summary` | view | 164 | `alma_funding_opportunities` grouped by `funder_name, source_type`: counts, `total_available` (NULL on the top 12), jurisdictions | alma | **none** |
| `v_funder_tag_density` | view | 367 | avg tag count per funder on verified open grants; `theme_multiplier` 0.5 when >= 15 tags | alma | **none** |
| `v_act_income_by_funder` | view | 47 | `v_act_income_history` grouped: paid/auth/draft totals, project_codes, `funder_category`, `relationship_score` | Xero | `org-income-service.ts`, `org-pipeline-service.ts` |

Adjacent objects found by the `LIKE '%foundation%'` sweep (36 relations, 11 matviews): `foundation_grantees` 5,695,
`foundation_category_assignments` 42,599 (10,945 foundations themed), `foundation_geo_focus` 16,942,
`foundation_people` 33, `foundation_programs` 4,662, `foundation_relationship_signals` 55, `foundation_notes` 0,
`org_project_foundations` 1,553, `org_project_foundation_interactions` 6, `org_project_foundation_research` 16,
`grant_funder_documents` 4, `v_goods_foundation_targets` (view, 2,098), `mv_foundation_scores` 1,761 ($11.32bn
"giving", 43 with grantees), `mv_foundation_grantees` 12,709, `mv_foundation_readiness` 10,537,
`mv_foundation_need_alignment` 9,506, `mv_foundation_regranting` 47,022, `mv_foundation_trends` 63,113.

---

## 2. The giving-figure reversion, with the proof

### 2a. The column today
```sql
SELECT enrichment_source, count(*) n, count(DISTINCT total_giving_annual) distinct_giving, round(sum(total_giving_annual)) sum_giving
FROM foundations GROUP BY 1 ORDER BY 2 DESC
```
`acnc_ais_2024` 7,984 rows, **28 distinct values**, median 25,000. `no_ais_return` 840 rows, 3 distinct, sum $65.5m
(the migration set these to NULL; they hold money again). Placeholder values present now: 25000 x6,884,
100000 x1,469, 500000 x808 = **9,161 rows (81.5%)**.

### 2b. The migration did run
`supabase_migrations.schema_migrations` has `20260907130000 foundations_giving_placeholders`. Rows carry
`metadata->>'giving_replaced_on' = '2026-09-06'`, `metadata->>'giving_source' = 'acnc_ais_2024'`.

### 2c. The values are gone
```sql
SELECT count(*) n, count(*) FILTER (WHERE f.total_giving_annual = a.grants_donations_au) equals_ais,
       count(*) FILTER (WHERE f.total_giving_annual <> a.grants_donations_au) differs_from_ais,
       round(sum(a.grants_donations_au)) ais_sum, round(sum(f.total_giving_annual)) current_sum
FROM foundations f LEFT JOIN LATERAL (SELECT grants_donations_au FROM acnc_ais a WHERE a.abn=f.acnc_abn ORDER BY ais_year DESC LIMIT 1) a ON true
WHERE f.enrichment_source LIKE 'acnc_ais_%'
```
n 8,307 | equals_ais **111** | differs **8,196** | ais_sum **$1,698,957,167** | current_sum **$630,031,669**.

Named examples (all `current=500000`, `giving_source=acnc_ais_2024`, `upd=2026-09-22`): Nyiyaparli Charitable Trust
AIS $39.9m, Puutu Kunti Kurrama and Pinikura $26.6m, Perpetual Foundation $15.1m, Fox Family Foundation $13.4m,
Equity Trustees Charitable Foundation $13.0m, Snow Medical Research Foundation $9.8m.

`metadata ? 'placeholder_giving'`: 9,242 rows; **9,129 still equal their placeholder**, 106 differ, 7 now NULL.

### 2d. Who did it
```sql
SELECT agent_id, status, started_at, duration_ms FROM agent_runs WHERE started_at BETWEEN '2026-09-22T00:00:00Z' AND '2026-09-22T05:00:00Z'
```
`sync-acnc-register | Sync ACNC Register | success | 2026-09-22T02:35:54.053Z | 42,891ms`.
```sql
SELECT enrichment_source, count(*), min(updated_at), max(updated_at), count(*) FILTER (WHERE total_giving_annual IN (25000,100000,500000)) on_placeholder
FROM foundations WHERE updated_at BETWEEN '2026-09-22T01:30:00Z' AND '2026-09-22T03:00:00Z' GROUP BY 1
```
10,101 rows, all between **02:35:58.86** and **02:36:36.73**; `acnc_ais_2024` 7,903/7,903 on placeholder.

Source of the guess: `packages/grant-engine/src/foundations/acnc-importer.ts:188-195` `estimateGivingFromSize`:
Large -> avg 500000 (min 10000, max 5000000); Medium -> 100000 (5000, 500000); Small -> 25000 (1000, 100000);
written at `:215-219` into `total_giving_annual`, `grant_range_min`, `grant_range_max`.

Fix on main: `scripts/sync-acnc-register.mjs:83-96` (commit `1b1c9d33`, 2026-09-23, PR #506): existing rows now
get only `acnc_abn, name, acnc_data`. The comment says "10,166 profiles on 2026-09-22 alone". `agent_schedules`
has it at 168h, enabled, last 2026-09-22, so the next run is ~2026-09-29 and will be safe. **The data repair has
not been re-run.** The migration's WHERE clause (`enrichment_source NOT ILIKE 'acnc%'`) would now skip every
damaged row; a re-repair must key on `metadata ? 'giving_source'` instead.

### 2e. What the reversion did to downstream
- `match-foundations-for-projects.mjs:117,130` grades evidence with `total_giving_annual NOT IN (25000,100000,500000)`;
  still correct by accident (the values are placeholders again).
- `goods-funder-scan.ts:94-105` nulls out the same three values; still correct by accident.
- `v_goods_foundation_targets` `priority_score` adds `LEAST(50, giving/1e6*10)`; `summary.totalAddressableGiving`
  on `/org/act/goods/foundations` = **$2.74bn** across 2,098 targets (view count query today), a sum of guesses.
- `funder_intelligence.total_giving_annual` (computed 2026-08-03) shows FRRR, Ian Potter, PRF at 500000.
- `funder_context_snapshot.annual_giving` copies `foundations.total_giving_annual` (`refresh-funder-context.mjs:475`).
- `foundation_browse()` RPC (public `/foundations`) default sort `p_sort='giving'` = `f.total_giving_annual`; it does
  also expose `ais.grants_donations_au` as `granted`, so the honest column is one sort key away.
- `/reports/philanthropy` (`mv_foundation_scores`) headline "$11.32B annual giving" sums the same column; top 8 by
  giving are World Vision, Sydney Uni, Endeavour Foundation, Catholic Education Centre (service deliverers).

---

## 3. The scorers and where they diverge

### 3a. `match-foundations-for-projects.mjs` -> `org_project_foundations` (the ACT "find" agent)
Header `:1-27`: scorer 0..100 = theme overlap 55 + target-recipient 15 + geography 20 + giving-scale 10; must share
>= 1 theme; faith excluded; `EXCLUDE_FUNDERS` `:81` (extractive). CROSSWALK `:50-57` maps 6 codes
(ACT-JH, ACT-PI, ACT-GD, ACT-HV, ACT-FM, ACT-EL) to coarse `thematic_focus` tokens and `AU-<STATE>` geo tokens.
Evidence grade `:130-132`: A = notable grants on file, B = DGR or non-placeholder giving, C = theme only.
Inserts `stage='saved'`, `engagement_status='researching'`. Runs nightly (`agent_schedules` 24h, priority 3,
last 2026-09-24), registry line 515 with `--apply`.

State today:
```sql
SELECT p.slug, count(*) n, count(*) FILTER (WHERE fit_score>=85) fit85, count(*) FILTER (WHERE evidence_grade='A') a, ... FROM org_project_foundations opf JOIN org_projects p ON p.id=opf.org_project_id GROUP BY 1
```
| project | rows | fit>=85 | A | B | C | no grade | GHL synced | worked (not saved/parked) |
|---|---|---|---|---|---|---|---|---|
| empathy-ledger | 295 | 102 | 31 | 16 | 139 | 109 | 1 | 2 |
| picc | 283 | 92 | 23 | 25 | 132 | 103 | 0 | 0 |
| justicehub | 275 | 56 | 41 | 88 | 50 | 96 | 0 | 3 |
| farm | 265 | 46 | 33 | 31 | 114 | 87 | 0 | 2 |
| goods | 247 | 10 | 20 | 19 | 149 | 59 | 22 | 5 |
| harvest | 188 | 7 | 31 | 69 | 52 | 36 | 0 | 1 |

Stages: saved 1,495, parked 45, priority 8, in_conversation 3, approach_now 2. `fit_summary`: 1,044 of 1,553 begin
`[auto-matched]`, 285 still reprint "gives ~$" (the placeholder as its own justification), 721 distinct strings.
Only 8 of 14 `org_projects` (ACT Core, ALMA, CivicGraph, Contained, Elders Room, Gold.Phone, Mounty Yarns,
Station Precinct are missing) have a crosswalk entry, so those 8 projects get zero foundation matches by design.

**Grade A is not what it says.** Of Goods' 12 top grade-A rows, only Snow (44 grantees) and Origin (8) have any
`foundation_grantees`; Balnaves, KARI, Yumpla Nerkep, COSCA ONE, NAB Foundation, Good Things, Neilson, Zahra,
Reichstein have 0. Grade A comes from `notable_grants` (an LLM-scraped text array on `foundations`), not from
observed rows. Same for JusticeHub: 11 of 12 grade-A rows have 0 grantees; the exception is Ian Potter (1,707).
JusticeHub's grade-A list includes MINDEROO PICTURES LIMITED, Surf Life Saving Queensland, Central Queensland
University, Copticare Relief Fund, Mary MacKillop Today: theme-token matches on `youth/community/education`.

### 3b. `v_goods_foundation_targets` -> `/org/[slug]/goods/foundations`
View def (pg_get_viewdef): hard-coded theme array `['indigenous','aboriginal','rural_remote','social-enterprise',
'housing','employment','economic_development','regenerative','agriculture']`; candidates = foundations with
`thematic_focus && themes AND gs_entity_id IS NOT NULL AND gs_entity_id NOT IN goods_relationships.entity_id`;
bridge = a person on `mv_person_entity_network` with 2..15 boards who sits on both the candidate and a
`goods_relationships` entity; `priority_score = 1000*has_bridge + 100*theme_hits + 50*has_dgr + LEAST(50, giving/1e6*10)`.
Today: 2,098 targets, 75 bridged, 129 DGR, "addressable" $2.74bn.
Top 10 by priority today: Australian Catholic University (bridge Virginia Bourke via Caritas), Uniting Church
Frontier Services, Karrkad-Kanjdji (bridge Teya Dusseldorp via Dusseldorp Forum), RFDS Foundation, FRRR
(bridge Georgina Somerset via RFDS), Western Sydney University, Uniting Church Property Trust (Vic), St Andrew's
Cathedral School Foundation, Xavier College Foundation, Judith Neilson Institute. Universities and school
foundations outrank grantmakers because a 1,000-point bridge dwarfs everything and the theme list has no
"is actually a grantmaker" gate (no `ben_other_charities`, no `acnc_ais.grants_donations_au > 0`).
`page.tsx:188-190` footer says "same 2-15 board collision gate as Warm Intros". `actions.ts:15-51` `Track` inserts
a `goods_relationships` funder row at `stage='identified'` keyed on `gs_entity_id`, which removes it from the view.
The `scan/page.tsx` sibling reads `goods-funder-scan.ts` (`org_project_foundations` for slug goods) and derives
`ghlWarmth` from cached `ghl_tags` (`goods-hot/warm/steady/cooling/cold`); 22 of 247 Goods rows are GHL-synced.

### 3c. `score-foundation-alignment.mjs` -> `saved_foundations`
`:29-90`: thematic (up to 40) + geographic (20) + recipient + "Major giver" bonus keyed on `total_giving_annual >=
10M/1M/100K` (`:80-89`, reads the placeholder). Auto-saves top `LIMIT=30` per `org_profile` with score >= 50 at
`stage='discovered'` (`:190`), upsert on `(user_id, foundation_id)` (`:198`). Weekly (168h, priority 2, last
2026-09-22, "1000 found, 4 updated"). 182 rows: 178 discovered, 2 active_relationship, 2 researching; owned by
2 user ids; 20 rows carry `org_profile_id` = justicehub, 162 carry none. Sample rows all list the same geography
string ("queensland, australia, palm island, sunshine coast, northern territory, witta, jinibara country...")
and `alignment_reasons` include "Major giver ($19M/yr)" for Amnesty and Rotary Australia Benevolent Society.
Several `notes` say "Score: 70%" or "Score: 60%" while `alignment_score=86` (the score column was updated on a
later run, the note was not).

### 3d. `funder_intelligence` (nobody reads it)
```sql
SELECT giving_grade, count(*) FROM funder_intelligence GROUP BY 1
```
inferred 10,188 / missing 971 (nothing verified). `evidence_tier`: 1 = 26 rows (avg rank 99.8), 2 = 10,692, 3 = 441.
Grade combinations: 6,363 rows are reach missing / theme inferred / board verified / type unverified / derived
missing. Coverage: 26 with grantees, 9 with board paths, 23 with derived thematics. Top 15 by `rank_score`: FRRR
1381, Ian Potter 553, Helen Macpherson Smith 142, PRF 72, NACCHO 66 (typed `indigenous_organisation`, not a funder),
Westpac Community Trust 48, Snow 30, Buckland 30, Myer 30, Tim Fairfax 27, ACF 22, Minderoo 19, CommBank 18,
World Vision 17 (typed service_delivery), University of Sydney 17.

### 3e. `funder_context_snapshot` + `refresh-funder-context.mjs`
`:265-343` collects names from `alma_funding_opportunities.funder_name`, `funder_allowlist`, ACT's
`org_project_foundations`, and every Xero ACCREC payer. `:345-359` matches to `foundations` by distinctive-token
ILIKE, best by `total_giving_annual DESC` (so the placeholder decides which duplicate row wins). `:450-468`
`relationship_score` = Xero points (min(40, floor((paid+auth)/10000)*2)) + GHL recency (0..20) + decisions (min 20,
5 each) + grantees (min 20, count/5) + email recency (0..12). Upsert `onConflict: 'funder_name'` (`:530`), so
name variants are separate rows.
Coverage today: 1,196 rows; foundation match 1,084; GHL contacts 91; grantees 80; Xero 66; decisions 55; email
257; Notion 21; `relationship_score` 0 on **879 rows**, 8 on 109, 12 on 105; max 75 (The Snow Foundation), 70
(The Trustee For The Snow Foundation, the same funder), then PICC 53 (a customer), FRRR 52 (12 decisions, $0 Xero),
Origin Foundation 49, PRF 47 and 42 (two rows), Sonas Properties 45 (Harvest customer), SMART Recovery 43.

### 3f. `v_funder_summary` / `v_funder_next_move` / `v_act_income_by_funder` (Xero-derived)
`warmth_band`: HOT >= $100k and <= 90d; WARM >= $50k and <= 180d; STEADY <= 90d; COOLING <= 365d; else COLD.
Today (47 rows): The Snow Foundation WARM 67 ($402,930 paid, 125d, ACT-GD); Sonas Properties WARM 63 ($44k
outstanding, ACT-HV, a customer); ALIVE/UoM HOT 61 ($66k outstanding); SMART Recovery COOLING 61; Dusseldorp
COOLING 49 ($33k, ACT-JH); PICC COOLING 40 ($436,700, ACT-PI); Rotary Eclub Outback COLD 32 ($82,500 unpaid
532d); Centrecorp COOLING 30 ($123,332); Vincent Fairfax COLD 20 ($50k, 427d); PRF COLD 13 ($7,469, 446d).
`v_act_income_by_funder.funder_category` labels: philanthropic (Snow, Centrecorp, VFFF, Dusseldorp), community_controlled
(PICC, Ingkerreke, Homeland, Julalikari), commercial (Sonas, Green Fox), civil_society (SMART, Just Reinvest,
StreetSmart), government, other.

---

## 4. Surfaces

| route | file | reads | what it says | money source |
|---|---|---|---|---|
| `/org/[slug]/goods/foundations` | `apps/web/src/app/org/[slug]/goods/foundations/page.tsx` (195 lines) via `lib/services/goods-foundation-targets.ts:98-201` | `v_goods_foundation_targets` + `foundations(type,last_scraped_at,enriched_at)` | "Foundation Targets": 4 stats (addressable giving/yr, fit targets, warm bridges, DGR), filter Top fit / Warm bridge only, list with DGR chip, "Ancillary fund route via Butterfly DGR" chip (`deriveRequiresDgr` on `foundations.type` `:85-90`), matched themes, warm-bridge line, geo, giving/yr, grants min-max, data vintage, Track button | placeholder giving + placeholder grant range |
| `/org/[slug]/goods/foundations/scan` | `.../scan/page.tsx` (200) via `goods-funder-scan.ts` | `org_project_foundations` (goods) joined to `foundations`, `org_projects` | six GHL warmth cells as filters, "Warm but unworked" and "Push-next queue" (now grade A with no GHL contact `:126`), table Foundation / GHL warmth / stage / fit / giving / next step; footer tells you to run `reconcile-foundations-ghl.mjs` | nulls placeholder giving `:94-105` |
| `/org/[slug]` operating desk, funder tab | `org/[slug]/page.tsx:171` -> `act-funder-intelligence.ts:609-918` -> `_components/act-funder-intelligence-desk.tsx` (870) | one mega exec_sql over `org_project_foundations` + `foundation_grantees`, `foundation_people`, `foundation_programs`, `foundation_program_years`, `foundation_relationship_signals`, `funder_context_snapshot`, `person_roles`, `org_pipeline`; then GHL contacts, org_contacts, trigram contact resolution, board bridges, `opportunity_context_events`, interactions, global coverage, agent runs | per dossier: name, relationship pill (active/warm/known/cold, `:449-460`), follow-up date, grantee count, open routes, next step or `recommendedAction` (`:462-505`); detail: ABN, projects, links to `/foundations/{id}` and website, "What they fund" (Annual giving, Mapped grants, Latest grant year, Annual-report years, up to 8 grantee rows), "Focus and ways to engage" (description, theme+geo chips, programs), "Where these facts came from" (source audit), evidence score `:507-531` = 12 boolean checks | `annualGiving` = `foundations.total_giving_annual` raw (`:215`), placeholder |
| `/admin/philanthropy` | `admin/philanthropy/page.tsx` (287) via `lib/philanthropy-admin.ts` | `foundations`, `foundation_category_assignments`, `foundation_geo_focus`, `foundation_grantees` (name-joined, `:65`) | the honest page: stated vs observed ratio, placeholder census (three round numbers), themes by count, geo by grain, the 24 publishers, a GET search | shows the placeholder counts on purpose |
| `/reports/philanthropy` | `reports/philanthropy/page.tsx` (615) | `mv_foundation_scores`, `mv_trustee_grantee_chain`, `mv_evidence_backed_funding`, `mv_foundation_need_alignment` | "Foundation Intelligence" scorecard (transparency 25 / need 30 / evidence 25 / reach 20), "Largest Foundations With Zero Transparency", revolving door, evidence-backed funding; renders `ReportUnavailable` when `liveReportsEnabled()` is false; the fabricated snapshot constants are still in the file, unused, `:118-162` | `mv_foundation_scores.total_giving_annual` (placeholder-derived, $11.32bn) |
| `/reports/big-philanthropy` | `reports/big-philanthropy/page.tsx` (644) | **nothing at render time**; every figure is a literal in JSX ($222B, $11.3B, 90.3%, PRF $184M, Minderoo $156M, Lowy $0 ...) | the $222 Billion essay with an 8-foundation scorecard graded A+ to F, links to `/foundations/{uuid}` via `FOUNDATIONS` map `:5-14` | hand-typed from ACNC AIS 2017-2023; cannot drift, cannot update |
| `/reports/philanthropy-power` | `reports/philanthropy-power/page.tsx` (257) via `packages/grant-engine/src/reports/philanthropy-power.ts` | `foundations` where `total_giving_annual > 0` (`:130-131`) + `foundation_power_profiles` (openness_score, capital_holder_class) | Tracked annual giving, open vs opaque capital share, gatekeepers (giving high, openness < 0.35), relationship-ready (openness >= 0.6), theme and geography clusters | `total_giving_annual`, placeholder |
| `/charities/[abn]/funders` | `charities/[abn]/funders/page.tsx` (197) via `lib/community-funders.ts` | `acnc_charities`, `gs_charity_classification` (JEV, conf >= 0.9), `grantconnect_awards` since FY2021, `justice_funding` grant lane through `applyGrantFilters`/`isRealRecipient` | "Who funds organisations like mine": peers (same JEV sector, state, size), programs ranked by peers funded, "Who holds the money for your region"; footer: "Foundation grants are not yet included" | GrantConnect + justice_funding; **no foundation money at all** |

Public foundation pages found alongside: `/foundations` (`foundation_browse` RPC, default sort giving),
`/foundations/[id]`, `/foundation/[abn]` (mv_foundation_scores etc.), `/foundations/{prf,minderoo,ian-potter,
ecstra,rio-tinto}` review pages, `/dashboard/browse/foundations/[id]` (board paths with method + confidence).

---

## 5. Scripts

| script | lines | writes | reads | schedule | judgement |
|---|---|---|---|---|---|
| `scripts/refresh-funder-context.mjs` | 561 | `funder_context_snapshot` upsert by `funder_name` | alma, allowlist, opf, Xero, GHL, grantees, Notion, Gmail mirror, decisions | not in `agent-registry.mjs`; runs nightly anyway (agent_runs 2026-09-23 20:35, 642 rows; 2026-09-22 timed_out then success 641) | the only place ACT's five relationship sources meet; name-keyed so duplicates; `annual_giving` copies the placeholder |
| `scripts/build-funder-discernment.mjs` | 143 | two CSVs into `act-global-infrastructure/thoughts/shared/` | `political_donations` x `austender_contracts` x `gs_entities` | manual | "halo-wash" (donor AND contractor) and "community backers" screens; not about foundations; no DB writes |
| `scripts/draft-funders-json-from-wins.mjs` | 215 | a proposal markdown, never `funders.json` (`:11-14`) | `act_grant_recommendation_decisions` won x alma funder_name | manual | 26 `won` decisions today (list in section 7); classifies customers vs funders by name regex `:57-67` |
| `scripts/stub-funders-from-xero.mjs` | 170 | `funders.json` with `--apply` (adds `needs-writeup` stubs, refreshes `xero_summary`) | `xero_invoices` ACCREC PAID/AUTHORISED | manual | this is how the 9 DATA-ONLY / needs-writeup stubs got into the ledger |
| `scripts/create-funder-portfolios.sql` | 47 | DDL for `funder_portfolios` + `_entities` with RLS | | applied once | tables exist, 0 rows, a funder-tier feature that never launched |
| `scripts/link-pipeline-funders.sql` | 30 | `org_pipeline.funder_entity_id/funder_type` for PICC rows (NIAA, Ian Potter, PRF, Tim Fairfax by literal uuid) | | one-off | PICC-specific hand links |
| `scripts/match-foundations-for-projects.mjs` | | `org_project_foundations` | `foundations` | 24h | section 3a |
| `scripts/score-foundation-alignment.mjs` | | `saved_foundations` | `foundations`, `org_profiles` | 168h | section 3c |
| `scripts/sync-acnc-register.mjs` | | `foundations` | ACNC CSV | 168h | section 2 |
| `scripts/reconcile-foundations-ghl.mjs` | | `org_project_foundations.ghl_*` (Goods only, header `:7`) | GHL API | 24h, last 2026-09-23 "0 items" | needs `GHL_API_KEY` (which rots per memory) |
| `scripts/foundation-intelligence-refresh.mjs` | | `source_frontier` targets (header `:6-8`), not `funder_intelligence` | | 168h | `funder_intelligence.computed_at` frozen 2026-08-03 |
| `scripts/refresh-acnc-ais.mjs` | | claims to write `total_giving_annual` (`:349-356`) via exec_sql | | registry line 943 | never wrote (exec_sql is SELECT-only, per the migration header) |

Registry check: `grep -n "'<id>'" scripts/lib/agent-registry.mjs` finds sync-acnc-register (line 19),
match-foundations-for-projects (515), score-foundation-alignment (1171), foundation-intelligence-refresh (123),
reconcile-foundations-ghl (81), refresh-acnc-ais (943), sync-goods-ghl (69); **refresh-funder-context is absent**.
`vercel.json` has no funder/foundation cron (only `/api/cron/desk-digest`).

---

## 6. The funder ledger: `act-global-infrastructure/wiki/narrative/funders.json`

Shape: `{ $schema, description, version: 2, updated: "2026-07-07", funders: {slug -> entry}, stages: {8},
themes_glossary: [19] }`. File mtime 2026-07-12. **25 entries**: minderoo, qbe-catalysing-impact, dusseldorp-forum,
paul-ramsay-foundation, tim-fairfax, smith-family, amnesty-australia, niaa, jcf, atlassian-foundation,
snow-foundation, patagonia, allbirds, who-gives-a-crap, centrecorp, vincent-fairfax, social-impact-hub,
state-qld-dfsdscs, streetsmart-australia, westpac-scholars-trust, rotary-eclub-outback-australia-9560,
brisbane-powerhouse-foundation, the-john-villiers-trust, state-of-queensland-acting-through-the-department-of-familie,
mrff-uom-palmer.

Entry fields: `name, stage, ask_amount_aud, deadline, primary_contact, themes[], tone, canonical_pitch_doc,
claims_to_lead_with[] (claim ids like "justicehub:claim-..."), claims_to_avoid[], framing_notes, primary_email,
cc_email, last_communicated_at, projects_funded[] (ACT-GD, ACT-JH, ACT-CN, ACT-EL, ACT-CP, ACT-CF), pause_note,
xero_summary {paid_total_aud, outstanding_ar_aud, last_invoice_date}, needs_writeup`.

Stages used: active-partner (9), cold (6), warm (2), paused (1), lapsed (3), procurement-prospect (1),
needs-writeup (1); the schema's `stages` block does not list `paused` or `needs-writeup`.
9 entries are explicitly "DATA-ONLY STUB" / "Auto-stubbed" with empty themes and claims (vincent-fairfax,
social-impact-hub, state-qld-dfsdscs, westpac-scholars-trust, brisbane-powerhouse-foundation,
the-john-villiers-trust, state-of-queensland..., plus streetsmart and rotary carry stub notes).
Last `last_communicated_at` anywhere: 2026-05-21. Minderoo `pause_note`: "Lucy paused justice conversations
2026-05-14, re-engage Q3 FY27". Snow: "$402,930 received + $132,000 AUTHORISED ... INV-0321 outstanding" (Xero today
shows $402,930 paid, $0 outstanding, so INV-0321 has since been paid; the ledger is stale on it).
This is the only place with **claims to lead with, tone, and contacts per funder**. Nothing in the DB reads it;
`draft-funders-json-from-wins.mjs` and `stub-funders-from-xero.mjs` propose edits to it.

---

## 7. What the system can say TODAY for one ACT project

### Goods on Country (ACT-GD)
- **Who has funded it (real)**: Xero `v_act_income_by_funder` project_codes ACT-GD: Snow $402,930 (7 invoices, last
  2026-05-22), Centrecorp $123,332, Ingkerreke $103,100 (community org, not a funder), VFFF $50,000, Homeland
  School $44,000, Julalikari $34,800, Our Community Shed $20,265, Red Dust $15,950, QIC $12,000, Mala'la $5,434,
  John Villiers Trust $1,200, Rotary Eclub $82,500 unpaid 532d. `won` decisions: 11 of 26 are ACT-GD.
- **Warmth**: `goods_relationships` funder rows 172 (identified 107, proposal 19, repeat 17, researching 13,
  contacted 12, committed 3, declined 1); 98 GHL contacts carry `goods-*` warmth tags; 22 opf rows GHL-synced.
- **Recommended next targets (stated-side, theme tokens)**: the top of `v_goods_foundation_targets` is a
  university, two Uniting Church bodies, a school foundation and a journalism institute (section 3b);
  `org_project_foundations` for goods has 10 rows >= 85 and 20 grade-A, of which only Snow and Origin have any
  observed grant. Worked rows: Snow (in_conversation, next touch 2026-04-29 overdue), QBE Foundation
  (in_conversation, 2026-04-24 overdue), Balnaves (approach_now, "Submit EOI ... DGR required: route via
  Butterfly"), PRF, Minderoo (priority, 2026-05-01 overdue).
- **Why (giving history)**: only for Snow (44 grantee rows, $4.82m published) and Origin (8, no amounts).
  Everyone else's "giving" is a size guess. The AIS `grants_donations_au` is on file for most (e.g. Snow Medical
  $9.76m) but not surfaced anywhere in the Goods pages.
- **Board paths**: 20 of 2,651 paths reach an ACT-known entity; the Goods view finds 75 bridges via
  `mv_person_entity_network` (a different mechanism); none are verified.
- **DGR routing**: `page.tsx:133-143` flags ancillary funds and links Butterfly's ABR page; correct and useful.

### JusticeHub (ACT-JH)
- **Real**: Dusseldorp $33,000 (COOLING, 91d), Just Reinvest $27,500, Green Fox $27,000, StreetSmart $9,400 +
  $18,800, Homeland School (won 2026-05-18), Minjerribah Moorgumpin $1,155. Ledger: Minderoo $2.9m ask paused;
  PRF active-partner on paper, Xero COLD ($7,469, 446d); Tim Fairfax warm; Dusseldorp active.
- **Recommended**: 275 opf rows, 56 >= 85, 41 grade-A; grade-A top list is Colonial Foundation, Minderoo Pictures,
  Butterfly Foundation, Community Broadcasting Foundation (also on the blocklist), Hand Heart Pocket, Copticare,
  Surf Life Saving Qld, CQU, Mary MacKillop Today, James Frizelle, Ian Potter (priority, 1,707 grantees), KARI.
  Worked: PRF (approach_now + priority), Minderoo (priority x2), Ian Potter (priority, last interaction 2026-03-05).
- **`saved_foundations` for org justicehub**: 20 rows, all `discovered`, alignment 60-95, geography string copied
  from the ACT profile.
- The JusticeHub project is not in `v_goods_foundation_targets` at all (Goods-only view).

### What is addressable at all (ACNC, the honest denominator)
```sql
WITH latest AS (SELECT c.abn, c.ben_other_charities, (SELECT grants_donations_au FROM acnc_ais a WHERE a.abn=c.abn ORDER BY ais_year DESC LIMIT 1) g FROM acnc_charities c WHERE c.is_foundation)
SELECT ben_other_charities, count(*) grantmakers, count(*) FILTER (WHERE g>0) giving_positive, round(sum(g)/1e6) giving_m FROM latest GROUP BY 1
```
`ben_other_charities=true`: 2,312 grantmakers, 1,435 with positive giving, **$952m**; `false`: 7,957 / 2,851 /
$2,381m. Memory's "$916M across 724 funders" is the same lane with a stricter filter I could not reproduce
exactly (inferred: it used a size floor). Top of the addressable lane: PRF $154.4m, Minderoo $91.2m, Stan Perron
$45.4m, PayPal Giving Fund $29.7m, Judith Neilson $22.0m, TarraWarra $20.6m, Australian Philanthropic Services
$19.8m, ACF Extension Fund $19.0m, ACF $15.6m, Perpetual $15.1m.

---

## 8. What a funder row needs to show, and which of it is real today

| field | needed because | real source today | status |
|---|---|---|---|
| name + ABN + canonical entity | dedupe (Snow appears twice in snapshot, PRF twice) | `foundations.acnc_abn` (11,214 of 11,235), `gs_entity_id` (10,836) | real |
| grants made last year | "can they write this cheque" | `acnc_ais.grants_donations_au` latest year (on file for 8,307 of the AIS-linked rows, $1.70bn) | real but **not shown**; `total_giving_annual` shown instead = size guess on 9,161 rows |
| typical grant size | ask sizing | `funder_allowlist.min/max_typical_grant` (18 of 40 filled); `foundation_grantees.grant_amount` median (24 publishers) | real for ~25 funders; `grant_range_min/max` on foundations is the size guess |
| funds other charities? | 78% of ACNC grantmakers fund only people | `acnc_charities.ben_other_charities` | real, unused by every matcher |
| requires DGR / ancillary fund | Butterfly routing | `foundations.type` contains ancillary/PAF/PuAF; `funder_allowlist.requires_dgr` | real, partial |
| stated theme + geography | first filter | `thematic_focus[]` (6,731), `foundation_category_assignments` (10,945 with evidence text), `foundation_geo_focus` (state/national grain) | real but self-described; place-grain almost absent |
| observed grantees (who they actually fund, where) | the only evidence | `foundation_grantees` 5,695 rows / 24 funders, 4,086 distinct grantees, LGA via `gs_entities` | real for 24 funders, nothing for 11,211 |
| open program / round / deadline | timing | `foundation_programs` 4,662, `alma_funding_opportunities` via `v_funders_summary` | real where scraped |
| relationship state | who to call | `funder_context_snapshot` (GHL 91, Xero 66, email 257), `goods_relationships` stage, GHL tags, `v_funder_summary.warmth_band` | real but name-keyed, 879 of 1,196 score 0 |
| money to ACT to date + outstanding | renewal vs new | `v_act_income_by_funder`, `v_funder_next_move.outstanding` | real (Xero) |
| named people + warm path | the ask | `foundation_people` (33 rows), `person_roles` via `gs_entity_id`, `funder_board_paths` (unverified), `org_contacts` linked entities, GHL | thin; 20 verified-adjacent paths |
| what to say to them | pitch | `funders.json` claims_to_lead_with / tone / framing_notes (16 of 25 filled) | real, hand-written, stale since July, not in DB |
| fit score | ranking | `opf.fit_score`, `v_goods_foundation_targets.priority_score`, `saved_foundations.alignment_score`, `funder_intelligence.rank_score` | four scores, all partly built on the placeholder; none reads observed giving except `funder_intelligence` |
| evidence grade | trust | `opf.evidence_grade` A/B/C | A means LLM-scraped `notable_grants`, not observed rows |
| decisions history | avoid re-asking | `act_grant_recommendation_decisions` (won 26, passed 62), `funder_blocklist` | real; blocklist auto-blocks after passes and once blocked Community Broadcasting Foundation which is also grade-A for JusticeHub |

---

## 9. Data traps, each with the query that shows it

1. Placeholder giving, section 2. Rank on `acnc_ais.grants_donations_au`, never on `foundations.total_giving_annual`.
2. `enrichment_source LIKE 'acnc_ais_%'` no longer means "AIS value present". 8,196 counter-examples.
3. `grant_range_min/max` are size guesses (`acnc-importer.ts:188-195`).
4. fit_score >= 85 is not a ranking: 471 rows (14+1+31+34+1+1+24+2+58+147+... from the distribution), 1,044 of 1,553
   summaries are `[auto-matched]` templates, 285 still reprint "gives ~$".
5. Evidence grade A is not observed giving: Goods 18 of 20 grade-A rows have 0 `foundation_grantees`.
6. `funder_context_snapshot` is keyed on name: Snow twice (75, 70), PRF twice (47, 42); ILIKE matching picks the
   highest placeholder giving as the canonical foundation (`refresh-funder-context.mjs:357`).
7. `v_funder_summary` counts customers as funders (Sonas Properties, Bigmeats, Berry Obsession, Blue Gum Station).
8. `v_goods_foundation_targets` has no grantmaker gate: universities and school foundations top the list.
9. `saved_foundations` is per *user* not per project; 162 of 182 rows have no `org_profile_id`.
10. `funder_blocklist` auto-blocks after 2+ passes; Sustainable Table and Community Broadcasting Foundation are
    both on the allowlist and the blocklist.
11. `funder_board_paths` are 100% unverified; `cluster_size` up to 8 means a common name.
12. `foundation_grantees` has no `foundation_id` for name-joined readers (`philanthropy-admin.ts:65`); the ACT desk
    joins on `foundation_id` (`act-funder-intelligence.ts:639`) so the two pages disagree on counts.
13. `mv_foundation_scores` "giving" is dominated by service deliverers (World Vision $514m etc.).
14. `/reports/big-philanthropy` numbers are literals in JSX.

---

## 10. Gaps and questions for Ben

- Re-run the giving repair keyed on `metadata ? 'giving_source'` (SAFE, a migration file). Should `no_ais_return`
  rows go back to NULL?
- Which of the three matchers is the one to keep? They cannot all be right; `org_project_foundations` is the only
  one with per-project stage, next step and GHL cache.
- Should the funder row show AIS grants-made (real) and drop `total_giving_annual` entirely from UI?
- `funders.json` (claims, tone, contacts) is the only pitch memory and lives in another repo; does it move into
  the DB (a `funder_briefs`-shaped table that something actually reads) or stay hand-curated?
- `funder_portfolios`, `funder_nudge_log`, `funder_profiles`: delete, or is the funder-tier product coming back?
- JEV: there is no judgement of "does this foundation fund organisations like ACT's projects"; the charity
  classifier gives `grantmaking` for 2,994 charities at >= 0.9. Is a JEV pass over the 2,312 `ben_other_charities`
  grantmakers (theme, place, org-type they fund, from their own AIS text) the right next use?
- The Goods-only view (`v_goods_foundation_targets`) has a hard-coded theme list; generalise per project or retire
  in favour of `org_project_foundations`?
