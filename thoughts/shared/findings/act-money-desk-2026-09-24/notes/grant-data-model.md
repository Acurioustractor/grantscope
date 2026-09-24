# Grant data model, end to end (read 2026-09-24)

Repo: /Users/benknight/Code/grantscope, main at 1b517ba0. All row counts are `count(*)` run today through
`node --env-file=.env scripts/gsql.mjs`. All code claims cite file:line as read today. Nothing was edited.

## 0. The one-paragraph picture

There are two grant corpora and they are fed from the same sources. **`grant_opportunities`** (26,903 rows) is the
public corpus: 70 scripts write it, 20,517 of its rows are historical awards, 3,162 are live-and-not-closed, and it
carries the six-project fit machinery (`aligned_projects`, `project_relevance`, `goods_relevance_*`) that the ACT
grants desk reads. **`alma_funding_opportunities`** (23,705 rows) is a copy of the open subset plus foundation
programs, promoted nightly, classified by LLMs, URL-verified, and ranked per project by the
`act_grant_recommendations` matview into `/ops/grant-recommendations`, `/home` and the weekly digest. The two are
linked by **name** (the unified view), by **`raw_data->>'grant_opportunity_id'`** (the promotion job), and by a
**mirror insert** back into `grant_opportunities` when an ALMA recommendation is pursued. `source_id` links nothing:
it is NULL on 23,703 of 23,705 ALMA rows. Saving lives in three places with three vocabularies: `saved_grants`
(the /tracker Kanban, FK to `grant_opportunities`), `act_grant_recommendation_decisions` (FK to ALMA), and
`org_pipeline` (free text, 125 rows, ACT's own pipeline). `opportunity_decisions` has 7 rows and is a fourth.

The biggest defect found: ALMA is being re-inserted. 22,781 of its 23,705 rows sit in duplicated (name, funder)
pairs, one round has 37 copies, and ~1,500 rows a day landed on six days this month. The promotion job's dedupe
index reads the table with no pagination (`promote-grant-opportunities-to-alma.mjs:152-161`), so under the 1,000-row
default cap it cannot see what is already there.

## 1. Inventory: every grants-shaped object

```sql
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public'
AND (table_name ILIKE '%grant%' OR table_name ILIKE '%opportun%' OR table_name ILIKE '%saved%'
  OR table_name ILIKE '%pipeline%' OR table_name ILIKE '%decision%' OR table_name ILIKE '%funder%') ORDER BY 1
-- 83 rows (63 tables, 20 views). Matviews are not in information_schema.tables:
SELECT matviewname, ispopulated FROM pg_matviews WHERE schemaname='public' AND (matviewname ILIKE '%grant%'
  OR matviewname ILIKE '%opportun%' OR matviewname ILIKE '%funder%' OR matviewname ILIKE '%act_%')
-- act_grant_recommendations (MV, populated) + mv_foundation_grantees, mv_grant_contract_overlap, v_grant_stats, v_grant_focus_areas, v_grant_provider_summary ...
```

Row counts (one UNION ALL query, 2026-09-24):

| object | kind | rows | role |
|---|---|---|---|
| grant_opportunities | table | 26,903 | public corpus, desk source |
| alma_funding_opportunities | table | 23,705 | ALMA/recommendation corpus |
| v_funding_opportunities | view | 29,563 | unified read path (26,903 GO + 2,602 FP + 58 ALMA-native) |
| act_grant_recommendations | matview | 35,761 | fit score per (in-scope project × ALMA open_grant) |
| act_grant_recommendations_current | view | 6,157 | MV filtered to feed_status + geography + deduped, ranked |
| act_funding_opportunity_current_status | view | 4,451 | feed_status per ALMA open_grant |
| act_grant_recommendation_decisions | table | 89 | pursue/pass/won per (project, ALMA opp) |
| act_grant_recommendation_projects | table | 12 | the projects the MV scores |
| act_private_grant_rounds | table | 665 | SmartyGrants rounds, ACT-only, RLS no policies |
| saved_grants | table | 2,916 | /tracker Kanban, FK to grant_opportunities |
| org_pipeline | table | 125 | ACT's hand pipeline (goods, revenue, foundations) |
| opportunity_decisions | table | 7 | org-level decisions with reason/judgment |
| opportunity_promotions | table | 7 | decision → Notion/GHL promotion log (no writer in this repo) |
| v_project_decisions | view | 90 | project_knowledge WHERE knowledge_type='decision' (no reader in this repo) |
| grant_funder_documents | table | 4 | docs per grant (no reader or writer in this repo) |
| foundation_programs | table | 4,662 | scraped foundation programs; 1,772 promoted into GO |
| opportunities_unified | table | 17,790 | act-global's unified pipeline (no writer in this repo) |
| funder_intelligence | table | 11,159 | foundation grades (no writer in this repo) |
| funder_allowlist / funder_blocklist | table | 40 / 12 | promotion gate / MV exclusion |
| user_grant_tracking | table | 234 | older tracker (stage, amount_requested, match_score) |
| grant_applications | table | 33 | application records (opportunity_id, milestones, ghl id) |
| grant_feedback | table | 144 | thumbs on grants |
| grant_notification_outbox | table | 771 | alert emails |
| grant_discovery_runs / grant_source_plugins | table | 159 / 33 | engine run log / plugin registry |
| grant_frontier_source_snapshots | table | 5,129 | source health snapshots |
| act_opportunity_observatory / _benchmark_cases | table | 47 / 275 | Octen discovery + JEV benchmark |
| opportunity_context_events | table | 137 | email/meeting context per opportunity |
| notion_grants / notion_opportunities | table | 37 / 43 | Notion mirrors |
| fundraising_pipeline / project_pipelines | table | 14 / 63 | act-global pipeline rollups |
| saved_foundations / org_grants | table | 182 / 8 | foundation shortlist / org grants |
| ghl_opportunities / ghl_pipelines | table | 1,322 / 19 | GHL mirrors |
| v_act_pipeline_unified, v_funding_pipeline, v_enriched_opportunities, v_grant_readiness, v_funder_next_move | views | 125 / 23,480 / 1,322 / 25 / 47 | |

## 2. grant_opportunities (public corpus)

### 2.1 Columns (68; information_schema)

```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='grant_opportunities' ORDER BY ordinal_position
```
id uuid PK (uuid_generate_v4) · name text NOT NULL · description · amount_min int default 0 · amount_max int default 0 ·
deadline date · source text NOT NULL · relevance_score int default 50 · application_status text default 'not_applied' ·
url · requirements · metadata jsonb default {} · created_at · updated_at · provider · program · **aligned_projects text[]** ·
categories text[] · focus_areas text[] · fit_score int · discovered_by · closes_at date · feedback jsonb [] ·
eligibility_criteria jsonb · assessment_criteria jsonb · timeline_stages jsonb · funder_info jsonb · grant_structure jsonb ·
ghl_opportunity_id text · requirements_summary · act_readiness jsonb · enriched_at · enrichment_source · sources jsonb [] ·
discovery_method · last_verified_at · grant_type text default 'open_opportunity' · embedding vector · embedding_model
default 'text-embedding-3-small' · embedded_at · target_recipients text[] · foundation_id uuid FK foundations ·
program_type default 'grant' · last_deadline_alert_at · geography text · source_id text · **status text** ·
pipeline_stage default 'discovered' · pile · provider_org_id uuid · **goods_relevance_score int** ·
**goods_relevance_signals jsonb** · goods_relevance_scored_at · dgr_required bool · accepts_sole_trader · accepts_pty_ltd ·
accepts_charity · accepts_unincorporated · eligibility_signals_at · classie_subjects text[] · classie_populations text[] ·
sdg_codes text[] · classie_method · classie_classified_at · **project_relevance jsonb NOT NULL default {}** ·
project_relevance_scored_at · eligibility_confidence numeric (CHECK 0..1, NOT VALID) · eligibility_summary · eligibility_provider

Indexes (pg_indexes): PK; **three UNIQUE**: `grant_opportunities_url_idx (url)`, `grant_opportunities_source_name_full_uniq (source, name)`,
`idx_grant_opp_name_source_id (name, source_id)`; GIN on aligned_projects, classie_*, sdg_codes, name trgm; btree on deadline,
closes_at, (grant_type, closes_at), amount_max, application_status, relevance_score, updated_at, ghl_opportunity_id, foundation_id,
provider_org_id, pile, program_type, dgr_required, accepts_*; partial `idx_grant_opportunities_goods_relevance (goods_relevance_score DESC) WHERE status='open'`;
two embedding indexes (hnsw, ivfflat WHERE grant_type <> 'historical_award').

Triggers: `grant_opportunities_ghl_sync_status_guard` BEFORE INSERT/UPDATE → `grant_opportunities_apply_ghl_sync_status()`;
`grant_stage_change_webhook` AFTER UPDATE → `notify_grant_stage_change()`; `update_grant_opportunities_updated_at` BEFORE UPDATE.
CHECK: `pipeline_stage IN (discovered, researching, drafting, submitted, awarded, declined, archived)`. **No CHECK on `status`.**

### 2.2 Vocabularies (measured)

```sql
SELECT coalesce(status,'<null>'), count(*) FROM grant_opportunities GROUP BY 1 ORDER BY 2 DESC
```
status: closed 20,965 · open 2,954 · NULL 2,287 · unknown 416 · ongoing 210 · duplicate 63 · upcoming 5 · pending 2 · archived 1
application_status: awarded 12,367 · not_applied 10,368 · open 3,239 · closed 658 · ongoing 113 · unknown 103 · upcoming 23 · reviewing 19 · in_progress 5 · submitted 3 · unsuccessful 2 · monitor/expired/duplicate 1 each
grant_type: historical_award 20,517 · open_opportunity 6,090 · government 286 · foundation_grant 5 · others 1 each
program_type: grant 26,581 · scholarship 195 · program 48 · fellowship 38 · award 37 · fund 3 · community grant 1
pipeline_stage: discovered 23,756 · archived 3,118 · researching 24 · submitted 4 · drafting 1
pile: Grants 24,963 · NULL 1,939 · apply_now 1
classie_method: category_map 20,377 · NULL 6,526 · eligibility_provider: NULL on all 26,903 · enrichment_source: NULL 26,843, auto-url-fetch 59, manual_pdf_review 1
discovery_method: open-data-api 12,271 · arc-grants 5,598 · data.gov.au 2,648 · NULL 2,179 · nsw-grants 1,806 · wa-grants 977 · qld-grants 246 · grantconnect-go-scrape 218 · nt-grants 143 · act-grants 104 · tas-grants 103 · grantconnect 82 · sa-grants 77 · vic-tide-es-api 57 · ... (66 values, 14 of them one-off `GOxxxx` ids)

```sql
SELECT source, count(*) n, count(source_id) with_source_id, count(url) with_url,
  sum(CASE WHEN status IN ('open','ongoing','upcoming') THEN 1 ELSE 0 END) live
FROM grant_opportunities GROUP BY source ORDER BY n DESC LIMIT 40
```
brisbane-grants 12,271 (80 live) · arc-grants 5,598 (0) · qld-arts-data 2,648 (0) · foundation_program 1,772 (1,279 live) · Lotterywest 770 (721 live; url on 9) ·
grantconnect 309 (135) · ghl_sync 260 (0 live; 255 status unknown, url on 6) · NSW Government — Create NSW 181 (9) · NSW — Dept of Education 149 (26) ·
WA — DLGSC 134 (118) · NSW Health 111 (39) · ACT Government 104 (101) · Tasmanian Government 103 (0) · Northern Territory Government 81 (0) ·
vic-grants-gateway 57 (33) · data-gov-au 51 (27) · WA Community Grants 54 (49) · Healthway 38 (37) · DTMR 33 (28) · public-discovered-grant-page 35 (6) · civicscope-act-recommendation 1 (the mirror, see §6.3)

### 2.3 Who writes it

`grep -rl grant_opportunities scripts --include='*.mjs' --include='*.mts' --include='*.sql' ...` → 70 files. The ones that INSERT/UPSERT rounds:
`scripts/scrape-state-grants.mjs` (nightly step 1; sets status 'unknown' at :97), `ingest-grantconnect-go.mjs` (:143 status 'open'), `ingest-vic-grants-open.mjs` (:133),
`sync-foundation-programs.mjs`, `import-gov-grants.mjs`, `import-public-discovered-grant-pages.mjs`, `sync-austender-open-tenders.mjs` (:220, tenders into the grants table, tags ACT-GD at :54/:249),
`ingest-strategic-grants-wrap-2026-07.mjs`, `grantscope-discovery.mjs` (:241), `massive-import-run.mjs`, `scout-grants-for-profiles.mjs` (:153), `build-foundation-profiles.mjs` (:307),
`profile-vip-foundations.mjs` (:227), `reprofile-*.mjs`, `push-ghl-targets.mjs` (:278), `create-sefa-ghl-opp.mjs`, `seed-goods-source-vector-programs-2026-05-27.mjs`,
`scripts/migrations/add-oonchiumpa-grants.sql`, `add-goods-relevance-score.sql`; plus the app: `apps/web/src/app/api/ops/grant-recommendations/decide/route.ts:78-98` (mirror insert).

**Write contract** (`scripts/lib/upsert-grant-opportunities.mjs:1-30` header, `:117-146` batch, `:154-180` single): dedupe in batch by url then (source,name);
resolve existing ids by url and (source,name) in bulk; write by primary key so no unique index is crossed; a row resolving to two different ids is reported
as an ambiguous pair, never merged. Importers today (`grep -rl upsert-grant-opportunities scripts`): sync-foundation-programs, scrape-state-grants,
ingest-vic-grants-open, import-public-discovered-grant-pages, ingest-grantconnect-go, import-gov-grants, sync-austender-open-tenders,
ingest-strategic-grants-wrap-2026-07 (8). The memory note's "still to convert: ingest-grantconnect-go, sync-foundation-programs" is stale: both import it now.

Status decay: `scripts/close-stale-grants.mjs:1-16` closes rows whose `closes_at`/`deadline` passed or whose `last_verified_at` is >14 days old (`:90 .update({status:'closed'})`).
It has **no row in `agent_schedules`** (query in §8) so it only runs by hand; 7 status-live rows are past their close date today. `dedup-grants.mjs:95` sets 'duplicate'.

### 2.4 Who reads it (apps/web/src, 69 files)

Desk: `lib/services/act-grants-desk.ts`; triage: `lib/services/act-project-grants-triage.ts`, `goods-grants-triage.ts`, `goods-signals-workbench.ts`;
routes: `api/tracker/*`, `api/grants/[grantId]`, `api/alerts/*`, `api/data/*`, `api/search`, `api/query`, `api/insights`, `api/dashboard`, `api/mission-control`,
`api/opportunity-alignment`, `api/goods/grants/push-ghl`, `api/org/[orgProfileId]/pipeline/export`; pages: `/grants/[id]`, `/home`, `/home/watchlist`, `/briefing`,
`/giving`, `/foundations/[id]`, `/opportunities/ecosystem`, `/places/[postcode]`, `/reports/grant-frontier`, `/reports/picc`, `/ops/health`; libs: `grant-scout.ts`,
`grant-notifications.ts`, `grant-alert-digests.ts`, `opportunity-intelligence.ts`, `opportunity-system-sweep.ts`, `giving-commons.ts`, `funding/opportunities.ts`,
`services/grant-service.ts`, `grant-opportunity-cache.ts`, `se-grant-match.ts`, `report-service.ts`, `org-dashboard-service.ts`, `act-atlas-context.ts`, `act-opportunity-context.ts`, `act-saved-queries.ts`, `goods-community-detail.ts`, `goods-grant-ghl.ts`.

## 3. The fit machinery on grant_opportunities

### 3.1 aligned_projects: who sets it, with what codes

Column is `text[]`, GIN-indexed (`scripts/migrations/add-goods-relevance-score.sql:19-23`: "ACT-GD tag remains the canonical 'this is a Goods grant' marker; >=50 triggers it").

```sql
SELECT 'rows_with_any_tag', count(*) FROM grant_opportunities WHERE cardinality(aligned_projects) > 0   -- 559
UNION ALL SELECT 'empty_array', count(*) FROM grant_opportunities WHERE aligned_projects = '{}'          -- 26,344
UNION ALL SELECT 'null', count(*) FROM grant_opportunities WHERE aligned_projects IS NULL                -- 0
```

Writers, in order of how much they move:

1. **`scripts/lib/goods-relevance.mjs` `applyGoodsTag` (:295-314)** adds **both** `'ACT-GD'` and `'goods'` when keyword `score >= GOODS_TAG_THRESHOLD` (50, `:285`) **or** `goodsRubricQualifies(row.project_relevance)` (`:322-325`, JEV verdict); removes both otherwise; records `goods_relevance_signals.tag_change` and `tagged_by`. Called from `scripts/score-goods-relevance.mjs` (`:109-112` bulk SQL, `:144` `aligned_projects: u.tagged`), scheduled daily (`agent_schedules.score-goods-relevance`, 24h, created 2026-09-24, last run 06:46 today), and from `scripts/sync-act-private-grant-rounds.mts:43-49` for the private table.
2. **`scripts/lib/project-relevance.mjs` `applyProjectTags` (:266-315)** for `PROJECT_CODES` (`:203-209`): `justicehub→ACT-JH`, `empathy-ledger→ACT-EL`, `harvest→ACT-HV`, `farm→ACT-FM`, `contained→ACT-CN`. Tag when keyword `score >= PROJECT_TAG_THRESHOLD` (30, `:22`) **or** `rubricQualifies` (`:245-252`: rubric.score >= `RUBRIC_FIT_AT` 2.5, confidence >= 0.5, `rubric_meta.organisation_fundable` >= 0.5, not `geography_excluded`) and not a generic programme (rubric fits >= `RUBRIC_GENERIC_PROJECT_COUNT` 3, `:236`). Records `tag_changes` and `tagged_by: keyword|rubric|both`. Called from `scripts/score-project-relevance.mjs:114` (**not registered, not scheduled**; the 2026-09-20 23:29-23:48 all-row pass came from it) and from `scripts/score-project-rubric.mjs:288-307`, which re-runs the keyword scorer, asks JEV, ORs both, and also **adds** ACT-GD on the Goods rubric (`:294-301`, never removes). Registered `agent-registry.mjs:1229-1239` (`--apply`), scheduled daily from 2026-09-24 06:42 with `last_run_at` NULL.
3. `scripts/sync-austender-open-tenders.mjs:54,249` sets `['ACT-GD','goods']` when its own goods score >= 50.
4. `scripts/ingest-strategic-grants-wrap-2026-07.mjs:232,298-303` hand-curated tags, merged with existing on update.
5. `scripts/seed-goods-source-vector-programs-2026-05-27.mjs:180,193`; `scripts/migrations/add-oonchiumpa-grants.sql` (the 24 `ACT-OO` rows).
6. `apps/web/src/app/api/ops/grant-recommendations/decide/route.ts:96` writes `aligned_projects: [projectCode]` on the mirror insert.
7. `scripts/promote-grant-opportunities-to-alma.mjs:117` reads it as a gate (`ACT_PROJECT_CODES = ['ACT-HV','ACT-EL','ACT-JH','ACT-GD','ACT-CORE','ACT-FM']`, `:39`) and `:248` checks for a literal `'National'` in it.

Vocabulary drift, all-time (`SELECT p, count(*) FROM grant_opportunities, unnest(aligned_projects) p GROUP BY p`):
ACT-HV 213 (3 live) · **WATCH 133** (0 live) · ACT-GD 67 (46) · **goods 63** (44) · ACT-OO 24 (12) · ACT-CORE 19 (0) · ACT-JH 19 (6) · ACT-PI 16 (3) · ACT-FM 14 (6) · ACT-CN 11 (5) · ACT-AI 10 · **harvest 9** (6) · ACT-EL 9 (3) · then 30 more ACT-xx codes with 2-8 rows each.
Three non-code tags (`goods`, `harvest`, `WATCH`) and `National` are expected by code paths; the app's triage filters with `.overlaps('aligned_projects', Object.values(PROJECT_CODES))` (`act-project-grants-triage.ts:43`) so `goods`/`harvest` are harmless but noisy.

### 3.2 project_relevance: exact shape

```sql
SELECT k, count(*) FROM grant_opportunities g, jsonb_object_keys(g.project_relevance) k WHERE g.project_relevance <> '{}' GROUP BY k
-- contained 26,827 · empathy-ledger 26,827 · farm 26,827 · harvest 26,827 · justicehub 26,827 · rubric_meta 380 · tag_changes 357
SELECT count(*), min(project_relevance_scored_at), max(project_relevance_scored_at) FROM grant_opportunities WHERE project_relevance <> '{}'
-- 26,827 rows, 2026-09-20T23:29:49Z .. 2026-09-20T23:48:40Z   (one all-row keyword pass)
SELECT count(*) FROM grant_opportunities WHERE project_relevance ? 'goods'   -- 0 (Goods rubric added in PR #520 today, nothing written yet)
```

Two rows with a rubric (`jsonb_pretty(project_relevance)`; abbreviated but every key kept):

```jsonc
// 8da81910-9072-4680-843c-a878fcf1f1c4  "Black Spot Program - 2027/2028 Funding Round"  (NSW Transport)
{
  "farm":           { "score": 0, "rubric": { "score": 0.01, "confidence": 0.99, "geography_excluded": true },
                      "signals": { "geography": null, "tier1_hits": [], "tier2_hits": [], "tier3_hits": [], "disqualifier_hits": [] },
                      "scored_at": "2026-09-20T23:48:40.165Z", "tagged_by": null },
  "harvest":        { "score": 0, "rubric": { "score": 0, "confidence": 1, "geography_excluded": true }, "signals": {...}, "scored_at": "...", "tagged_by": null },
  "contained":      { "score": 0, "rubric": { "score": 0, "confidence": 1 }, "signals": {...}, "scored_at": "...", "tagged_by": null },
  "justicehub":     { "score": 0, "rubric": { "score": 0, "confidence": 1 }, "signals": {...}, "scored_at": "...", "tagged_by": null },
  "empathy-ledger": { "score": 0, "rubric": { "score": 0, "confidence": 1 }, "signals": {...}, "scored_at": "...", "tagged_by": null },
  "rubric_meta":    { "model": "jev-1.13.0", "scored_at": "2026-09-20T23:48:40.165Z", "organisation_fundable": 0.54 }
}
// 8ccca60d-98a1-43fe-b64d-5aac85ba9551  "Building Early Education Fund – Supplemental Operational Funding Grant Opportunity"  (grantconnect)
{
  "farm":           { "score": 6, "rubric": { "score": 0.01, "confidence": 0.99 }, "signals": { "geography": "national", ... }, "scored_at": "2026-09-20T23:48:39.856Z", "tagged_by": null },
  "harvest":        { "score": 6, "rubric": { "score": 0.11, "confidence": 0.89 }, "signals": { "geography": "national", ... }, ... },
  "contained":      { "score": 0, "rubric": { "score": 0.35, "confidence": 0.65 }, ... },
  "justicehub":     { "score": 0, "rubric": { "score": 0.26, "confidence": 0.74 }, ... },
  "empathy-ledger": { "score": 0, "rubric": { "score": 0.33, "confidence": 0.67 }, ... },
  "rubric_meta":    { "model": "jev-1.13.0", "scored_at": "2026-09-20T23:48:39.856Z", "organisation_fundable": 0.88 }
}
// tag_changes (5e52c7ef… "SEDI Capability Building Grant"):
"tag_changes": { "contained": { "at": "2026-09-14T11:17:54.366Z", "score": 0, "change": "removed", "previous_score": null } }   // newer entries also carry "by": keyword|rubric|both
```

So: `project_relevance.<project> = { score int 0-100 (keyword), signals {geography, tier1_hits[], tier2_hits[], tier3_hits[], disqualifier_hits[]}, scored_at, tagged_by null|'keyword'|'rubric'|'both', rubric? {score numeric 0-4, confidence 0-1, geography_excluded? true} }`;
`rubric_meta = { model, scored_at, organisation_fundable 0-1 }`; `tag_changes = { <project>: { change, at, previous_score, score, by? } }`.
Keys are project **slugs** (`justicehub`, `empathy-ledger`, …), not ACT codes; the desk maps them through `ACT_PROJECTS` (`apps/web/src/lib/act-grant-eligibility.ts:22-36`).

Provenance counts: `rubric_meta` model `jev-1.13.0` on all 380; per-project rubric on 380 rows each; `tagged_by`: rubric 9, both 7, null 1,884 (rows carrying the key);
rows with any project rubric >= 2.5: 18. The rubric scorer's three `agent_runs` today (06:30 17 items, 06:46 333, 06:47 333, 06:48 4; all `success`) wrote nothing:
`project_relevance_scored_at` max is still 2026-09-20 and no row has `goods`. `logStart` runs even on `--dry-run` (`score-project-rubric.mjs:202`), so these read as dry runs from the PR #520 session (inferred); the scheduled `--apply` run has `last_run_at` NULL.

### 3.3 goods_relevance_score / goods_relevance_signals

`goods_relevance_score` int 0-100 (`goods-relevance.mjs:97-283`, keyword + category + geography, no LLM). Live coverage: 3,169 of 3,169 status-live rows scored today 06:45; 46 live rows >= 50.
Shape (`jsonb_pretty(goods_relevance_signals)`, two rows scored 2026-09-24T06:45:53Z):
```jsonc
{ "geography": "non-goods:AU-VIC" | "non-goods:national" | "AU-NT" ..., "tagged_by": null | "keyword" | "rubric" | "both",
  "tier1_hits": [], "tier2_hits": ["remote"], "tier3_hits": ["organisation"], "amount_band": null, "category_hits": [], "disqualifier_hits": ["scholarship"],
  "tag_change"?: { "change": "added"|"removed", "at", "previous_score", "score", "by" } }
```
`tagged_by` is 'keyword' on only 4 rows and null on 26,888: the ledger was added 2026-09-14, and rows tagged before it (austender tags, seeds, ACT-OO) carry no provenance.

### 3.4 The desk's definition of "open" and today's numbers

`apps/web/src/lib/services/act-grants-desk.ts`: `LIVE_STATUSES = ['open','ongoing','upcoming']` (`:8`); `fetchLive()` pages `grant_opportunities` and `act_private_grant_rounds` with `.in('status', LIVE_STATUSES)` (`:128-142`);
`buildDesk()` drops rows whose `closes_at ?? deadline` is before today (`:70-71`), dedupes by normalised URL with public winning (`:51-54, :72-76`), fit per project from `goods_relevance_score` and `project_relevance[project].score` (`:77-84`), eligibility from `dgr_required`/`accepts_pty_ltd`/`geography`/`metadata.place` (`:97-104`), soonest close first, undated last (`:112-117`). The page is `/org/[slug]/grants` (admin gate).

```sql
WITH live AS (SELECT * FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming'))
SELECT ... -- results:
-- live_by_status: open 2,954 · ongoing 210 · upcoming 5   (3,169)
-- live_not_past_close 3,162 · live_past_close_but_status_live 7
-- live_with_close_date 326 (deadline col 322, closes_at col 325) · no date 2,836
-- live_with_amount (min>0 or max>0) 1,641 · amount_max>0 1,620
-- live_with_aligned_projects 90 · live_with_project_relevance 3,110 · live_with_goods_score 3,169 · goods>=50 46
-- live_with_dgr_required_set 7 · with_geography 2,981 · with_url 2,335 · with_description 3,119
-- public_live_distinct_norm_url_or_id 3,156   (what the desk shows from the public side after URL dedupe)
-- act_private_grant_rounds: 665 total · status open 597, upcoming 27, closed 41 · 624 live · 619 not past close · 1 URL shared with a public live row · all 665 goods-scored · 1 tagged ACT-GD
```
So the desk today is about **3,156 public + 618 private ≈ 3,774 rows**, of which only **326 + private dated** have a close date.

Per project code among the 3,162 live public rows (`SELECT p, count(*) FROM live, unnest(aligned_projects) p GROUP BY p`):
**ACT-GD 46 · ACT-JH 6 · ACT-FM 6 · ACT-CN 5 · ACT-HV 3 · ACT-EL 3** (plus goods 44, ACT-OO 12, harvest 6, ACT-AI 4, ACT-CM 4, and ~20 other ACT-xx codes with 1-3).
Every live row carries the five keyword keys (3,104); rubric_meta on 356; score >= 50 under `project_relevance`: 0 rows for any project; >= 70: 0 rows (the keyword scorer tops out low; tags fire at 30).

Deadline distribution (live, `coalesce(closes_at, deadline)`):
0-7d 44 · 7-14d 19 · 14-30d 24 · 30-60d 52 · 60-90d 21 · 90-180d 29 · 180d+ 130 · no date 2,843.
By week over the next 90 days: w/c 2026-09-21: 2 · 09-28: 48 · 10-05: 21 · 10-12: 12 · 10-19: 4 · 10-26: 23 · 11-02: 18 · 11-09: 9 · 11-16: 2 · 11-23: 5 · 11-30: 12 · 12-07: 1 · 12-14: 1 · 12-21: 2 (160 total).

Rows the desk cannot see although they are not closed: 2,286 with `status IS NULL` (all `application_status='not_applied'`, no close date; ingested before `status` existed), 13 rows with `status` closed/unknown/NULL but a **future** close date, and 416 `unknown`. `scrape-state-grants.mjs:97` still writes `status: 'unknown'` on insert.

## 4. alma_funding_opportunities (ALMA / recommendations corpus)

### 4.1 Columns (49) and constraints

id uuid PK · name NOT NULL · description · funder_name NOT NULL · source_type NOT NULL (CHECK government|philanthropy|corporate|community) · category (CHECK 11 values) ·
total_pool_amount · min_grant_amount · max_grant_amount (CHECK min<=max) · funding_duration · opens_at · deadline timestamptz (CHECK opens<=deadline) · decision_date ·
status NOT NULL default 'open' (CHECK upcoming|open|closing_soon|closed|recurring|archived) · jurisdictions text[] · regions text[] · is_national · eligibility_criteria jsonb ·
eligible_org_types text[] · requires_deductible_gift_recipient · requires_abn default true · focus_areas text[] · keywords text[] · source_url · application_url · guidelines_url ·
**source_id text** · scraped_at · scrape_source · raw_data jsonb · relevance_score default 0 · created_at · updated_at · opportunity_type default 'unverified'
(CHECK open_grant|invitation_only|award|policy_framework|partnership|tender|placeholder|unverified) · verification_status default 'unverified' (CHECK verified|placeholder|stale|unverified) ·
verified_at · verification_notes · auto_classify_confidence/reason/model/at · fields_backfilled_at/by/reason · search_text · embedding · embedding_model · embedded_at · funder_entity_id uuid.
Indexes: btree deadline, funder_name, status, source_type, (scrape_source, source_id), (opportunity_type, verification_status) partial; GIN focus_areas, jurisdictions, FTS ×2; hnsw embedding.
Triggers: `set_alma_funding_search_text` (BEFORE I/U), `set_funder_entity_id` (BEFORE I/U; funder_entity_id set on 19,921), `update_funding_opportunities_timestamp` (BEFORE U), `update_funding_opportunity_status` (BEFORE I/U; the bulk-update trap in memory).

### 4.2 Vocabularies
opportunity_type: unverified 14,516 · open_grant 4,451 · award 2,705 · invitation_only 839 · policy_framework 811 · partnership 310 · placeholder 73
verification_status: unverified 14,516 · placeholder 3,963 · verified 3,675 · stale 1,551
status: open 22,200 · closed 653 · closing_soon 622 · archived 225 · upcoming 3 · recurring 2
source_type: philanthropy 23,674 · corporate 14 · government 10 · community 7 (the promotion job labels everything philanthropy)
scrape_source: promotion-from-foundation-programs 12,122 · promotion-from-grant_opportunities 11,525 · NULL 26 · manual_seed_2026_05_04 21 · oracle-research-2026-05-15 9 · funding_smoke_seed 2 → only 58 rows are ALMA-native
auto_classify_model: NULL 14,775 · gemini-2.5-flash 6,320 · claude-haiku-4-5 1,283 · gpt-oss-120b 879 · gpt-oss:20b 350 · llama-3.1-8b 73 · llama-3.3-70b 25 · fields_backfilled_by: llm:claude-haiku-4-5 501

### 4.3 Writers (this repo) and the nightly chain
`scripts/nightly-grant-pipeline.mjs:42-52` STEPS: 1 scrape-state-grants → 2 promote-grant-opportunities-to-alma → 3 promote-foundation-programs-to-alma → 4 auto-classify-llm (limit 300) → 5 backfill-alma-fields (limit 300) → 6 verify-alma-opportunities → 7 refresh-funder-context → 8 `REFRESH MATERIALIZED VIEW act_grant_recommendations` → 9 re-evaluate funder_blocklist.
Scheduled as three phases in `agent_schedules` (ingest priority 2, enrich 3, finalize 4; 24h; all ran 2026-09-23). The all-in-one `nightly-grant-pipeline` schedule is disabled since 2026-05-21.
Other writers: `apps/web/src/app/api/ops/grant-recommendations/triage/route.ts`, `lib/services/funding-ghl.ts`, `scripts/auto-classify-*.sql`, `triage-classify-2026-05-15.sql`, `jev-entity-match.mjs`, plus JusticeHub and act-global (memory: eleven writers across three repos).

### 4.4 Readers
`act_grant_recommendations` MV (§5), `v_funding_opportunities`, `api/data/funding-opportunities`, `api/ops/funders/timeline`, `api/ops/grant-recommendations/{decide,triage}`, `/ops/grant-recommendations/triage`, `/org/[slug]/goods/money` (+ scrape-more-button), `/reports/grant-frontier`, `lib/services/{act-research, ask-grantscope, ask-grantscope-corrections, funding-notion, goods-money}.ts`.

## 5. The recommendation stack (ALMA side)

### 5.1 act_grant_recommendation_projects (12 rows)
ACT-CN Contained (surface, pitch-ready, QLD/NSW/VIC + National) · ACT-CORE (memory, needs-cleanup, route overhead) · ACT-CS CivicGraph (ledger, route buyers) · ACT-EL Empathy Ledger (signal, live-proof) · ACT-FM Farm (enterprise, decision-needed, pty_ltd) · ACT-GD Goods (edge, active, QLD/NT, route mixed) · ACT-GP Gold.Phone · ACT-HV Harvest (enterprise, decision-needed, pty_ltd) · **ACT-IN (in_scope false)** · ACT-JH JusticeHub (ledger, live-proof, QLD/NT) · ACT-MY Mounty Yarns · ACT-PI PICC. All `dgr_required=false`. Columns also carry theme_keywords (7-23 each), evidence_we_have jsonb, act_context jsonb, org_project_id → org_projects.

### 5.2 act_grant_recommendations (MV, 35,761 rows, 3,251 distinct opps)
`pg_get_viewdef`: `project_themes` = in-scope projects JOIN `projects` (81 codes) · `opps` = ALMA rows with `status NOT IN (archived, closed, cancelled, rejected)`, `deadline IS NULL OR >= now()`, `opportunity_type='open_grant'`, `verification_status='verified'`, funder not in active `funder_blocklist` (3,514 rows qualify today; 530 with a future deadline; 1,957 with max amount) · CROSS JOIN · `theme_score` = distinct theme-keyword substring hits ×10 capped 50 × `v_funder_tag_density.theme_multiplier` · `geography_score` 15 national / 15 home state / 9 secondary / 0 · `eligibility_score` 20 / 10 / 5 by eligible_org_types · `timing_score` 8 no deadline, 15 >30d, 8 >7d, 4 future, 0 · `track_record_score` +15 funder previously `won` (any project), −10 funder `passed` ≥2 times for this project · `fit_score` = sum · `is_strong_fit` = theme>0 AND fit>=55 · `flags[]` requires_dgr, partner_required, tight_deadline, national, large_grant, small_grant, tag_stuffed, won_funder, repeatedly_passed · excludes (project, opp) already decided won/passed/pursuing. `computed_at` = 2026-09-23 20:35 (nightly finalize).

### 5.3 act_funding_opportunity_current_status (view, 4,451)
Over ALMA `open_grant`: hard_failures ∈ {not_verified, missing_verification_timestamp, missing_official_source, missing_application_url, past_deadline}; stale >7d, very stale >21d since `verified_at`. `feed_status`: quarantined (any hard failure or very stale) 1,658 · stale_warning 90 · rolling (no deadline) 2,294 · apply_now 409. `evidence_completeness` = (6 − failures)/6 ×100.

### 5.4 act_grant_recommendations_current (view, 6,157 rows, 697 distinct opps)
MV JOIN status WHERE feed_status IN (apply_now, rolling, stale_warning) AND (max amount NULL or >= 5,000); geography gate: national, or a jurisdiction (with `AU-` stripped) in the project's home+secondary states, or a state parsed from the funder name; dedupe per (project, funder, stemmed name) keeping best fit; `is_strong_fit` further requires geography>0 or max>=50k or won_funder; `project_rank` per project by fit, amount, deadline.
Per project: ~528-596 rows each; apply_now 68-83; closing in 90 days 30-32; strong_fit ACT-PI 16, ACT-GD 8, ACT-FM 3, ACT-MY 3, ACT-HV 2, ACT-JH 2, others 0; max fit 43-78.
Readers: `/home` (home/page.tsx, home-client.tsx), `/ops/grant-recommendations`, `/org/[slug]/pipeline`, `/reports/grant-frontier`, `api/ops/grant-recommendations/sync-notion`, `lib/services/{act-atlas-context, act-project-apply-now, ask-grantscope-corrections, funding-ghl, funding-weekly-digest, org-pipeline-service, project-funding-service}.ts`, scripts `match-foundations-for-projects`, `seed-goods-grants-ghl`, `sync-act-opportunities-to-notion`, `draft-funders-json-from-wins`.

### 5.5 act_grant_recommendation_decisions (89 rows)
UNIQUE (project_code, opportunity_id); `opportunity_id` FK → ALMA ON DELETE CASCADE; `grant_opportunity_id` FK → grant_opportunities SET NULL (set on 1 row).
CHECK decision ∈ {discovered, pursuing, watching, passed, applied, submitted, won, lost}; actual: passed 62, won 26, watching 1. `decision_origin` legacy 63 / xero_invoices 26 (CHECK also allows grantscope_pursue, manual_admin, notion_sync, ghl_callback); `decision_scope` operational 63 / historical_evidence 26. Projects: ACT-CORE 49, ACT-GD 11, ACT-HV 10, ACT-FM 6, ACT-JH 5, ACT-EL 2, seven others 1. notion_page_id and ghl_opportunity_id: none set.
Writers: `api/ops/grant-recommendations/decide/route.ts:114-127` upsert (also mirrors, §6.3, and upserts `saved_grants` `:139-149` when decision ∈ pursuing/applied/submitted); `lib/services/funding-ghl.ts:34` upsert 'pursuing'; `funding-notion.ts:52` sets notion_page_id; `api/ops/grant-recommendations/sync-notion/route.ts:207`; `api/integrations/ghl/funding-callback/route.ts` maps GHL stage → decision; `scripts/sync-act-opportunities-to-notion.mjs:176`.

## 6. How the two corpora relate (measured)

```sql
SELECT 'alma_total', count(*) FROM alma_funding_opportunities                                            -- 23,705
UNION ALL SELECT 'alma_source_id_null', count(*) ... WHERE source_id IS NULL                              -- 23,703 (the 2 non-null are funding_smoke_seed rows)
UNION ALL SELECT 'alma_source_id_matches_go_id', count(*) FROM alma a JOIN grant_opportunities g ON g.id::text = a.source_id   -- 0
UNION ALL SELECT 'alma_raw_data_has_grant_opportunity_id', count(*) ... WHERE raw_data ? 'grant_opportunity_id'                -- 11,525 (= every promotion-from-grant_opportunities row)
UNION ALL SELECT 'alma_raw_go_id_resolves', count(*) FROM alma a JOIN go g ON g.id::text = a.raw_data->>'grant_opportunity_id' -- 11,444 ; orphaned 81
UNION ALL SELECT 'distinct_raw_grant_opportunity_id', count(DISTINCT raw_data->>'grant_opportunity_id')                        -- 2,457
UNION ALL SELECT 'distinct_raw_foundation_program_id', count(DISTINCT raw_data->>'foundation_program_id')                       -- 1,541 (of 12,122 promotion-from-foundation-programs rows)
UNION ALL SELECT 'alma_name_matches_go', count(DISTINCT a.id) ... ON lower(trim(g.name)) = lower(trim(a.name))                 -- 23,150
UNION ALL SELECT 'go_name_matches_alma', count(DISTINCT g.id) ...                                                               -- 2,960
UNION ALL SELECT 'alma_url_matches_go', ... (g.url = a.source_url OR g.url = a.application_url)                                 -- 12,414
UNION ALL SELECT 'alma_distinct_names', count(DISTINCT lower(trim(name)))                                                        -- 3,087   vs grant_opportunities 26,540
```

### 6.1 The links that exist
1. **`raw_data->>'grant_opportunity_id'`** (`promote-grant-opportunities-to-alma.mjs:266-268`) on every GO-promoted row; `raw_data.foundation_program_id` + `foundation_id` on every FP-promoted row. This is the real lineage; nothing in the app reads it.
2. **Name**: `v_funding_opportunities` joins ALMA enrichment by `lower(trim(name))` (DISTINCT ON latest) and suppresses FP/ALMA rows whose name exists in GO; `grant_opportunities.source='foundation_program' AND source_id = foundation_programs.id` links the 1,772 promoted programs.
3. **Mirror back**: `decide/route.ts:66-104` inserts an ALMA row into `grant_opportunities` (`source: 'civicscope-act-recommendation'`, `metadata.alma_opportunity_id`, `aligned_projects: [projectCode]`) when a decision needs a /tracker card, and stores the new id on the decision. 1 such row exists. A pursued grant therefore exists three times (GO original → ALMA copy → GO mirror) with no id chain between the first and third.
4. `act_grant_recommendation_decisions.grant_opportunity_id` (1 row) and `saved_grants.grant_id` (FK to GO) are the only typed cross-links.

### 6.2 The duplication defect (found today)
```sql
SELECT coalesce(scrape_source,'<null>'), created_at::date, count(*) FROM alma_funding_opportunities WHERE created_at > now() - interval '21 days' GROUP BY 1,2 ORDER BY 2 DESC
-- 09-18: FP 822 + GO 651 · 09-17: 842 + 628 · 09-09: 832 + 689 · 09-07: 804 + 711 · 09-06: 824 + 700 · 09-05: 1,596 + 1,504   (10,603 rows since 2026-09-05; memory had the table at 13,102 that day)
WITH k AS (SELECT lower(trim(name)) nk, lower(trim(funder_name)) fk, count(*) c FROM alma_funding_opportunities GROUP BY 1,2)
SELECT count(*) FROM k;                       -- 3,300 distinct (name, funder) pairs
SELECT count(*) FROM k WHERE c > 1;           -- 2,376 pairs duplicated
SELECT sum(c) FROM k WHERE c > 1;             -- 22,781 rows in duplicated pairs
SELECT max(c) FROM k;                         -- 37 copies ("Rio Tinto Community Giving Program (Western Australia)", first 2026-05-15, last 2026-09-18)
```
Cause: `loadAlmaIndex()` at `scripts/promote-grant-opportunities-to-alma.mjs:152-161` does `.from('alma_funding_opportunities').select('id, name, funder_name')` with no `.range()`; the Supabase client caps an unpaged select at 1,000 rows (the project's own memory note on `paginatedRpc()` documents the cap), so the dedupe map holds at most 1,000 of 23,705 keys and the rest re-insert. `promote-foundation-programs-to-alma.mjs:45` has the same unpaged index read. The 2026-09-23 runs logged "10000 found, 0 new" and "1278 found, 0 new", so it is intermittent (inferred: depends on which 1,000 rows the cap returns). Consequences: every ALMA count above is inflated, `act_grant_recommendations` scores the same round up to 37 times per project (the `_current` view's stem dedupe hides most of it), `v_funding_opportunities` is protected by DISTINCT ON, and the URL verifier re-verifies 9,189 rows a night (agent_runs 09-23).

## 7. Saving: the four places a decision lives

### 7.1 saved_grants (2,916) — the /tracker Kanban
Columns: id, user_id NOT NULL, grant_id NOT NULL FK → grant_opportunities CASCADE, stars 0-3, color (CHECK red|blue|green|yellow|orange|purple|none), stage NOT NULL default 'discovered'
(CHECK discovered|researching|pursuing|submitted|negotiating|approved|realized|lost|expired), notes, ghl_opportunity_id, partner_contact_ids uuid[], org_profile_id FK org_profiles SET NULL,
source_alert_preference_id, source_notification_id, source_attribution_type (CHECK notification_clicked|digest_clicked|scout_auto|manual), source_attributed_at. UNIQUE (user_id, grant_id).
Measured: stage discovered 2,158 · lost 648 · expired 84 · researching 15 · pursuing 10 · submitted 1; stars 0 on 2,897; color NULL 2,897; `scout_auto` 814 / NULL 2,102; users 079d… 1,857, 4d45… 1,014, 272f… 45; org NULL 2,096, 8b6160a1 (ACT) 585, f3783794 222, a1b2c3d4 13; ghl_opportunity_id never set; 1,465 point at a live GO row; 0 orphans.
Writers: `scripts/scout-grants-for-profiles.mjs:193` and `lib/grant-scout.ts:335` upsert (scout_auto, daily 'Grant Scout' schedule, 1,030 found / 3 new today); `api/tracker/[grantId]/route.ts:41` upsert, `:112` ghl id, `:129` delete; `api/tracker/route.ts:47,101` → expired, `:118,227` → lost; `api/tracker/auto-review/route.ts:318`; `api/goods/signals/[id]/action/route.ts:85` insert; `decide/route.ts:139-149` upsert; `scripts/sync-ghl-to-tracker.mjs:120`; `home/page.tsx:250` and `api/home/pre-sweep/route.ts:44` → expired.
Readers: `/home`, `/home/watchlist`, `/continue`, `/architecture`, `api/alerts`, `api/pipeline/*`, `lib/ghl.ts`, `grant-alert-digests.ts`, `scripts/sync-pipeline-to-notion.mjs`.

### 7.2 org_pipeline (125) — ACT's own pipeline
Columns: org_profile_id FK org_profiles CASCADE, name, amount_display, amount_numeric, funder, deadline **text**, status NOT NULL default 'prospect'
(CHECK prospect|upcoming|researching|pursuing|applied|submitted|waiting|won|lost|passed|parked|declined|archived|drafting|awarded|rejected|expired|watching|discovered),
grant_opportunity_id (no FK; 31 set, 29 resolve), notes, funder_entity_id FK gs_entities (16), funder_type, project_id FK org_projects (86), ghl_opportunity_id (0), source_type/source_ref/pathway/recommended_role (all NULL),
project_code, last_synced_at, qbe_stage (CHECK not_started|qualifying|bid_drafting|bid_submitted|evaluating|decided; all NULL), qbe_* , opportunity_type default 'grant' (CHECK grant|foundation|procurement|partnership|capital|revenue_stream|certification|scholarship), owner_name/next_action/next_action_at (all NULL, as memory says).
Measured: status prospect 91 · passed 31 · submitted 2 · upcoming 1; opportunity_type grant 75 · revenue_stream 23 · foundation 21 · partnership 3 · certification 2 · scholarship 1; funder_type government 36 · foundation 36 · commercial 34 · NULL 13 · partner 3 · corporate 3; project_code ACT-CORE 36 · ACT-EL 16 · ACT-IN 16 · ACT-GP 13 · ACT-GD 11 · ACT-HV 7 · ACT-FM 6 · ACT-MY 6 · ACT-PI 4 · ACT-JH 4 · ACT-CS 4 · ACT-CN 2; orgs 8b6160a1 112, f3783794 13.
Writers: `api/org/[orgProfileId]/pipeline/route.ts:34` insert, `:97` update, `:160` delete; `lib/opportunity-intelligence.ts:2605,2613,2751,2753,2862`; `api/org/[orgProfileId]/projects/[projectId]/foundations/route.ts:176`; `api/tracker/route.ts:139`; `scripts/enrich-justicehub.mjs:364`; seed SQL under scripts/ (seed-act-*, seed-picc-org-dashboard, link-pipeline-*).
Readers: `/grants/[id]`, `/org/[slug]/goods/engagement`, `/reports/picc`, `api/foundations/[foundationId]/pipeline-context`, `lib/services/{act-atlas, act-atlas-context, act-cross-projects, act-funder-intelligence, goods-funnel, org-dashboard-service, report-service}.ts`, `opportunity-system-sweep.ts`.

### 7.3 opportunity_decisions (7)
Columns: user_id, org_profile_id FK CASCADE, source_type NOT NULL, source_ref NOT NULL, project_code, pathway, decision NOT NULL (CHECK no|later|research|partner|apply|send_to_ghl|won|lost|more_info|review), reason, notes, evidence_gaps text[] NOT NULL, outcome, created_at, judgment jsonb NOT NULL (CHECK object), supersedes_id self-FK.
All 7 rows dumped: 4 × `research` (source_type goods, source_ref 'goods:Capital', pathway capital, ACT-GD, outcome 'op-action:research-goods-route-capital', evidence_gaps {'Budget or ask size'}, 2026-05-03, user 079d…) and 3 × `no` (source_type grant, source_ref = a grant_opportunities id, pathway grant, ACT-GD, reason 'Not relevant to Goods on Country', org 8b6160a1, 2026-08-11). judgment is `{}` on all.
Writers: `api/org/[orgProfileId]/pipeline/route.ts:125` insert, `api/org/[orgProfileId]/funder-intelligence/route.ts:163`, `lib/opportunity-intelligence.ts:2505`. Readers: `api/org/[orgProfileId]/daily-actions`, `lib/services/{org-dashboard-service:688, goods-capital-workspace:1172, act-atlas-context:1195, act-opportunity-context}.ts`.
`opportunity_promotions` (7 rows: linked 6, promoted 1, all target notion, source_type grant, `decision_id` FK → opportunity_decisions) has no writer in grantscope; act-global's `scripts/sync-opportunities-to-unified-pipeline.mjs`, `populate-funding-pipeline.mjs`, `sync-grantscope-matches.mjs` reference it and `opportunities_unified`.

### 7.4 v_project_decisions (90) and grant_funder_documents (4)
`v_project_decisions` = `SELECT project_code, project_name, title, content, decision_status, decision_rationale, recorded_at, participants FROM project_knowledge WHERE knowledge_type='decision' ORDER BY project_code, recorded_at DESC`. decision_status decided 64 / NULL 23 / proposed 3; project_code ACT-MISC 40, ACT-GD 20, ACT-EL 7, ACT-JH 6, ACT-HV 4, ACT-DG 3, ACT-PI/HQ/CORE/SH 2, ACT-SM/CN 1. **No reader in apps/web/src or scripts** (grep 0 hits); `project_knowledge` is written outside this repo.
`grant_funder_documents`: opportunity_id FK → grant_opportunities CASCADE; doc_type default 'other'; 4 rows (guidelines, mou_template, budget_template, faq); content_summary jsonb. Referenced only by the baseline migration, the ownership seed and generated types: **no reader or writer**.

## 8. Schedules and freshness (agent_schedules / agent_runs, today)

Enabled, 24h unless noted: scrape-state-grants (last 2026-08-17 as its own id; runs inside the pipeline), nightly-grant-pipeline-{ingest,enrich,finalize} (09-23), ingest-grantconnect-go (09-23; 131 new), ingest-vic-grants-open (09-24; 32), scrape-qgip-grants, scrape-grant-deadlines (09-24; 90 found / 1 new, 407s), scout-grants-for-profiles (09-24), enrich-grants-free (12h), sync-foundation-programs (48h, 09-24), sync-foundation-programs-full-sweep (168h), discover-foundation-programs (+long-tail; qld disabled), import-gov-grants (168h), send-grant-alert-digests (168h), snapshot-grant-frontier, **sync-act-private-grant-rounds (168h, last 09-22)**, **score-goods-relevance (24h, created 09-24, ran 06:46)**, **score-project-rubric (24h, created 09-24, never run)**. Disabled: nightly-grant-pipeline (single), grantscope-discovery, grantscope-discovery-smartygrants. **Absent: close-stale-grants, score-project-relevance.**
Freshness: grant_opportunities max created 2026-09-24 02:37 (109 rows in 7 days), max updated 06:45; goods scored 06:45 today; project_relevance scored 2026-09-20; eligibility_signals_at last 2026-08-03 (2,317 rows ever); ALMA max updated 09-23 14:22; MV computed 09-23 20:35.

## 9. Judgement

1. **One corpus, two vocabularies for the same six projects.** `aligned_projects` uses ACT codes (`ACT-GD`…), `project_relevance` uses slugs (`goods`, `justicehub`…), `act_grant_recommendation_projects` uses ACT codes but a different set of 12 (adds CS, GP, MY, PI, CORE; JH/EL/HV/FM/CN/GD overlap), `org_pipeline.project_code` uses 12 codes including ACT-IN which the MV excludes, and `projects` has 81. Any single desk needs one code table and a mapping row per project; today the mapping lives in three code files (`project-relevance.mjs:203`, `act-project-grants-triage.ts:9`, `act-grant-eligibility.ts:22-36`).
2. **The ALMA copy is the wrong place to score from, and it is duplicating.** It exists so the MV can rank verified `open_grant` rows, but only 58 of 23,705 rows are native; the rest are copies of `grant_opportunities` and `foundation_programs` with no typed link back (only `raw_data`). Fixing `loadAlmaIndex()` pagination and deleting the 20k duplicate copies is a prerequisite for any redesign that shows ALMA-derived numbers.
3. **The desk's "open" is honest but thin.** 3,162 live public rows, 326 with a close date, 90 with any project tag, 46 Goods-fit, 7 with `dgr_required` known. The keyword scorers put every live row below 50 on the five non-Goods projects; the JEV rubric is the only signal that has found fits the keywords missed (18 rows ≥ 2.5) and its nightly run has not yet happened. The 2,286 `status IS NULL` rows and 416 `unknown` are invisible to the desk and never re-evaluated.
4. **Saving is four tables with four stage vocabularies** (`saved_grants.stage` 9 values, `org_pipeline.status` 19, `act_grant_recommendation_decisions.decision` 8, `opportunity_decisions.decision` 10) and the decide route bridges two of them by inserting a third copy of the grant. A redesign should pick one decision table keyed by `opportunity_key` (`v_funding_opportunities` already mints `origin:origin_id`) and derive the rest.
5. **Provenance for tags is new and partial.** `tagged_by`/`tag_change` exist only on rows rescored since 2026-09-14; 42 of the 46 live ACT-GD rows say nothing about why they are tagged.

## 10. Questions for Ben
- Should ALMA remain a separate table at all once `v_funding_opportunities` carries `verification_status`/`in_alma`? If yes, is deleting the ~20,400 duplicate copies (keeping the earliest per name+funder) a Tier 3 you will verb?
- Which project list is canonical for the desk: the 6 in `ACT_PROJECTS` (goods, justicehub, empathy-ledger, harvest, farm, contained), the 12 in `act_grant_recommendation_projects`, or the 81 in `projects`?
- Is `org_pipeline` (125 rows, 91 prospect, no owner/next action) still the pipeline of record, or has GHL taken that role (ghl_opportunities 1,322 rows)?
- Should `close-stale-grants` be scheduled, and should `status IS NULL`/`unknown` rows with `application_status='open'` count as live?
- `v_project_decisions` and `grant_funder_documents` have no readers here; keep, or drop from the redesign scope?
