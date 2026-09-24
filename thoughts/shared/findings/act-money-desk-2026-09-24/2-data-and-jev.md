# 2. Data model, and 3. The Jev loop

Basis: grant-data-model.md and jev-pipeline.md (read 2026-09-24, main `1b517ba0`). Counts are `count(*)` via `scripts/gsql.mjs` that day; nothing re-queried. GO = `grant_opportunities`, ALMA = `alma_funding_opportunities`, FP = `foundation_programs`.

## 2. Data model

### 2.1 Tables (count(*), 2026-09-24)

| object | kind | rows | role |
|---|---|---|---|
| GO | table | 26,903 | public corpus, desk source; 20,517 historical_award; 3,162 live |
| ALMA | table | 23,705 | nightly copy of open GO + FP; 58 native |
| FP | table | 4,662 | scraped programs; 1,772 promoted into GO |
| v_funding_opportunities | view | 29,563 | unified read: 26,903 GO + 2,602 FP + 58 ALMA |
| act_grant_recommendations | matview | 35,761 | fit per (project x ALMA open_grant); 3,251 opps; computed 09-23 |
| act_grant_recommendations_current | view | 6,157 | MV filtered and deduped; 697 opps |
| act_grant_recommendation_projects | table | 12 | projects the MV scores |
| act_private_grant_rounds | table | 665 | SmartyGrants rounds, ACT only; 624 live |
| saved_grants | table | 2,916 | /tracker Kanban, FK to GO |
| org_pipeline | table | 125 | ACT hand pipeline |
| act_grant_recommendation_decisions | table | 89 | per (project, ALMA opp) |
| opportunity_decisions | table | 7 | org decisions with reason |

### 2.2 Two pipelines; how a row in one relates to a row in the other

GO: 70 scripts write it, 8 through `scripts/lib/upsert-grant-opportunities.mjs` (resolve by url and (source,name), write by PK; three UNIQUE indexes). ALMA: `scripts/nightly-grant-pipeline.mjs:42-52` scrapes, promotes GO and FP into ALMA, LLM-classifies, verifies URLs, refreshes the MV. Three `agent_schedules` phases, 24h, last 2026-09-23.

| link | mechanism | measured |
|---|---|---|
| GO to ALMA | `raw_data->>'grant_opportunity_id'` (`promote-grant-opportunities-to-alma.mjs:266-268`) | 11,525 rows; 11,444 resolve; 81 orphans; 2,457 distinct GO ids |
| FP to ALMA | `raw_data->>'foundation_program_id'` | 1,541 distinct over 12,122 rows |
| ALMA.source_id | meant to be the link | NULL on 23,703 of 23,705; 0 match a GO id |
| name | `v_funding_opportunities` joins `lower(trim(name))` | 23,150 ALMA rows match a GO name; 2,960 GO rows match ALMA |
| mirror back | `decide/route.ts:66-104` inserts the ALMA row into GO, source `civicscope-act-recommendation` | 1 row |
| typed FK | `act_grant_recommendation_decisions.grant_opportunity_id` | set on 1 of 89 |

A pursued grant can exist three times (GO, ALMA copy, GO mirror) with no id chain from first to third. No app code reads `raw_data.grant_opportunity_id`.

ALMA is duplicating: `WITH k AS (SELECT lower(trim(name)), lower(trim(funder_name)), count(*) c FROM alma_funding_opportunities GROUP BY 1,2) SELECT count(*), count(*) FILTER (WHERE c>1), sum(c) FILTER (WHERE c>1), max(c) FROM k` = 3,300 pairs, 2,376 duplicated, 22,781 rows in duplicates, max 37 copies. Cause (inferred from code plus the documented 1,000-row client cap): `loadAlmaIndex()` at `promote-grant-opportunities-to-alma.mjs:152-161` selects with no `.range()`, so the dedupe index sees at most 1,000 keys; same at `promote-foundation-programs-to-alma.mjs:45`. Every ALMA-derived count is inflated.

### 2.3 aligned_projects contract

`GO.aligned_projects text[]`, GIN. `SELECT count(*) FROM grant_opportunities WHERE cardinality(aligned_projects)>0` = 559; empty 26,344; NULL 0.

| writer | rule | tags |
|---|---|---|
| `lib/goods-relevance.mjs` `applyGoodsTag` :295-314 (daily via `score-goods-relevance.mjs`) | keyword >= 50 OR Goods rubric qualifies; removes when both fail | ACT-GD + literal `goods` |
| `lib/project-relevance.mjs` `applyProjectTags` :266-315 (via `score-project-relevance.mjs`, unscheduled, and `score-project-rubric.mjs`) | keyword >= 30 OR (rubric qualifies AND not generic); removes when both fail | ACT-JH, ACT-EL, ACT-HV, ACT-FM, ACT-CN |
| `score-project-rubric.mjs:290-299` | Goods rubric qualifies; add only | ACT-GD + goods |
| `sync-austender-open-tenders.mjs:54,249`; `ingest-strategic-grants-wrap-2026-07.mjs:232`; seeds; `decide/route.ts:96` | own score, hand curated, mirror | assorted |

All time (`SELECT p, count(*) FROM grant_opportunities, unnest(aligned_projects) p GROUP BY p`): ACT-HV 213, WATCH 133, ACT-GD 67, goods 63, ACT-OO 24, ACT-CORE 19, ACT-JH 19, ACT-PI 16, ACT-FM 14, ACT-CN 11, harvest 9, ACT-EL 9, then about 30 codes with 2 to 8. Live (3,162): ACT-GD 46, ACT-JH 6, ACT-FM 6, ACT-CN 5, ACT-HV 3, ACT-EL 3. Open by date (`closes_at>=today OR deadline>=today`, 333): ACT-GD 8, ACT-JH 5, ACT-CN 4, harvest 4 (not ACT-HV, invisible). Triage reads six codes only (`act-project-grants-triage.ts:9-16,43`). Provenance exists since 2026-09-14 only: 42 of 46 live ACT-GD rows say nothing about why.

### 2.4 project_relevance JSON shape

`GO.project_relevance jsonb NOT NULL default {}` (migration `20260914200000`; rubric keys have no migration).

```
{ "<slug>": { "score": 0-100 keyword,
              "signals": { "geography", "tier1_hits": [], "tier2_hits": [], "tier3_hits": [], "disqualifier_hits": [] },
              "scored_at", "tagged_by": null | "keyword" | "rubric" | "both",
              "rubric"?: { "score": 0-3, "confidence": 0-1, "geography_excluded"?: true } },
  "rubric_meta": { "model": "jev-1.13.0", "scored_at", "organisation_fundable": 0-1 },
  "tag_changes": { "<slug>": { "change": "added" | "removed", "at", "previous_score", "score", "by"? } } }
```

Slugs: justicehub, empathy-ledger, harvest, farm, contained, goods. Slugs here, ACT codes in `aligned_projects`; mapping in three files (`project-relevance.mjs:203-209`, `act-project-grants-triage.ts:9`, `act-grant-eligibility.ts:22-36`). Coverage (`SELECT k, count(*) FROM grant_opportunities g, jsonb_object_keys(g.project_relevance) k GROUP BY k`): five keyword keys on 26,827 rows (one pass, 2026-09-20); rubric_meta 380; tag_changes 357; goods 0. Live rows with keyword >= 50 on any of the five: 0. `goods_relevance_score` 0-100 on all rows; live >= 50: 46; `goods_relevance_signals` carries the same hits shape plus `tagged_by` and `tag_change`.

### 2.5 Decisions and saved: four tables, four vocabularies

| table | rows | keyed by | vocabulary | measured | writers |
|---|---|---|---|---|---|
| saved_grants | 2,916 | (user_id, grant_id FK GO) | stage: discovered, researching, pursuing, submitted, negotiating, approved, realized, lost, expired | discovered 2,158; lost 648; expired 84; pursuing 10; scout_auto 814 | scout (`grant-scout.ts:335`), `api/tracker/*`, `decide/route.ts:139-149`, GHL sync |
| org_pipeline | 125 | org_profile_id, free text | status: 19 values | prospect 91; passed 31; owner and next_action NULL on all | `api/org/[id]/pipeline/route.ts`, `opportunity-intelligence.ts`, seeds |
| act_grant_recommendation_decisions | 89 | (project_code, ALMA opp) | discovered, pursuing, watching, passed, applied, submitted, won, lost | passed 62 (last 2026-07-28); won 26 (xero_invoices); watching 1 | `decide/route.ts:114-127`, `funding-ghl.ts:34`, Notion sync, GHL callback |
| opportunity_decisions | 7 | source_type + source_ref | no, later, research, partner, apply, send_to_ghl, won, lost, more_info, review | 4 research (2026-05-03); 3 no "Not relevant to Goods on Country" (2026-08-11) | `pipeline/route.ts:125`, `funder-intelligence/route.ts:163` |

Also `grant_feedback` 144 votes (last 2026-05-03); `v_project_decisions` 90 and `grant_funder_documents` 4 have no reader in this repo.

### 2.6 What the desk calls open

`act-grants-desk.ts:8` LIVE_STATUSES = open, ongoing, upcoming: 3,169 live; 3,162 not past close; 326 with a close date; 90 with any tag; 7 with dgr_required set; private rounds 618. Invisible though not closed: 2,286 `status IS NULL`, 416 `unknown`. `close-stale-grants.mjs` is unscheduled. Freshness: GO created 2026-09-24 02:37; goods scored 06:45; project_relevance 2026-09-20; MV 09-23 20:35.

## 3. The Jev loop

### 3.1 Sent per grant, what returns (`scripts/score-project-rubric.mjs`)

POST `https://api.typesafe.ai/v1/systemone`, plain fetch, `model: 'jev-latest'` (answers as `jev-1.13.0`). State (`:174-196`): `grant_name`, `funder`, `description` first 3,000 chars, `categories`, `focus_areas`. Questions (`:114-133`): one Noul `fundable_by_an_organisation` (false = scholarship, prize, university post, procurement) plus six Score `fit_<project>` for goods, justicehub, empathy-ledger, harvest, farm, contained: theme and purpose only, ignore geography, deadline, amount, legal form. Levels 0 none, 1 adjacent, 2 plausible, 3 strong; Jev returns a weighted 0 to 3 plus confidence. Prose `PROJECTS[*].what` `:78-105`, duplicated in `jev-pilot/4-missed-money.mjs:66-97`. `questionsFor` `:166-172`: all seven when `--rescore` or no `rubric_meta`, else only missing `fit_<p>`; the Noul is never re-asked. Concurrency 4, 60s timeout, 4 retries, `--limit=400`, open rows only unless `--all-time`.

Returns (`:248-268`): `rubric_meta.organisation_fundable` = the Noul; `project_relevance[p].rubric = { score, confidence, geography_excluded? }` (`geographyExcluded` `:148-159`: no AU marker excludes every project; state projects need a state substring or NATIONAL). The keyword scorer is re-run and tags written (`:272-309`). Tokens are summed for the cost line, never stored.

### 3.2 Thresholds and the combine rule (`project-relevance.mjs:239-265`)

| constant | value | basis |
|---|---|---|
| RUBRIC_FIT_AT | 2.5 | 380 open grants vs 7 hand-verified wins: 2.0 gives 46 tags 7/7; 2.25 gives 36, 6/7; 2.5 gives 21, 6/7; 2.75 gives 9, 4/7 (`:228-238`) |
| RUBRIC_CONFIDENCE_AT, RUBRIC_ORG_FUNDABLE_AT | 0.5 | missing meta passes |
| RUBRIC_GENERIC_PROJECT_COUNT | 3 | 3+ fits = generic programme, rubric ignored |
| PROJECT_TAG_THRESHOLD | 30 | keyword; tier1 +20, tier2 +8, tier3 +2, disqualifier -25 |
| GOODS_TAG_THRESHOLD | 50 | keyword Goods |

Five projects: tag = keyword >= 30 OR (rubric >= 2.5, confidence >= 0.5, fundable >= 0.5, not geography_excluded, not generic); removed when both fail (`:287-288`). Goods: keyword >= 50 OR (rubric qualifies AND at most one other fits); `applyGoodsTag` removes, the rubric script only adds. No human path adds or removes a tag.

### 3.3 Schedule, cost, runs

Registry `agent-registry.mjs:1229-1240` (`--apply`); `agent_schedules` 24h enabled (migration `20260924063140`); `score-goods-relevance` same; `score-project-relevance.mjs` has neither. Tonight's first run failed and will again: pm2 `orchestrator` started 2026-09-22 and imports the registry once at load (`agent-orchestrator.mjs:23`); log `06:46:02 Unknown agent: score-project-rubric`; `last_run_at` NULL; next try 2026-09-25 06:45 UTC, same result until `pm2 restart orchestrator` (Tier 2, not done).

Cost: ~1,600 input tokens per grant at $0.042/M: $0.03 per 400 grants, $1.80 for all 26,840 (header `:42-43`). Measured: 380 grants $0.026; 333 grants (Goods only) $0.0088.

`agent_runs` (`logStart` unconditional at `:202`, so dry runs log as success):

| agent | status | found | new | started UTC | reading |
|---|---|---|---|---|---|
| score-project-rubric | success x4 | 17, 333, 333, 4 | 1, 1, 1, 0 | 2026-09-24 06:30 to 06:48 | dry runs (inferred: DB unchanged) |
| score-project-rubric | success | 383 | 9 | 2026-09-20 23:48 | the one real `--apply` (inferred from stored `rubric_meta.scored_at`) |
| score-project-rubric | success | 383 | 10 | 2026-09-20 23:46 | dry run; 8, 9, 10 tags on identical inputs |
| score-goods-relevance | success | 132 | 4 | 2026-09-24 06:45 | scheduled |
| score-project-relevance | success | 26,840 | 5 | 2026-09-20 23:29 | last hand run |

DB: `SELECT count(*) FILTER (WHERE project_relevance ? 'rubric_meta'), count(*) FILTER (WHERE project_relevance->'goods'->'rubric' IS NOT NULL), count(*) FILTER (WHERE (closes_at>=current_date OR deadline>=current_date) AND project_relevance ? 'rubric_meta') FROM grant_opportunities` = 380 read ever, 0 Goods verdicts, 316 of 333 open read; 17 never read. `--rescore` is capped by `--limit`; nothing records which rubric wording produced a stored verdict.

### 3.4 Where the desk reads it

`act-project-grants-triage.ts:58-60` and `act-grants-desk.ts:76-82` read the keyword score only; `act-one-desk.ts:223-225` flags decision due at keyword >= 85 (Goods) or >= 40 or deadline <= 30 days. `rubric`, `tagged_by`, `rubric_meta` are read by no file under `apps/web/src`. `desk/page.tsx` has no pursue or pass handler. Triage uses `deadline` only; scorers use `closes_at || deadline`.

### 3.5 Human feedback loop: none

| artefact | rows | read by a scorer? |
|---|---|---|
| opportunity_decisions | 7 (3 x "no", ACT-GD, 2026-08-11) | no |
| act_grant_recommendation_decisions | 89, ALMA pipeline | only as `funder_blocklist` (`nightly-grant-pipeline.mjs:135-175`); never touches tags |
| grant_feedback | 144 votes, last 2026-05-03 | no |
| `source LIKE 'manual%'` | Goods score frozen (`score-goods-relevance.mjs:188-209`) | as a skip |
| jev-pilot adjudication sheet | never graded (`jev-pilot/README.md:63`) | no |

A tag Ben disagrees with changes only by editing keyword lists or rubric prose and rescoring, and the next nightly re-derives it.

### 3.6 Smallest honest feedback design

One table: `act_grant_tag_verdicts (grant_id FK GO cascade, project CHECK six slugs, verdict CHECK fit|not_fit, reason, decided_by, decided_at, keyword_score, rubric_score, rubric_confidence, tagged_by, rubric_prose_hash, PK (grant_id, project))`. Not a jsonb key: `applyProjectTags` replaces the per-project object and `--rescore` rewrites `rubric`. Both tag functions take the row's verdicts: `not_fit` forces the tag off (`tagged_by: 'human_no'`), `fit` forces it on; machine signals still stored so the disagreement stays measurable. The desk chip gets two verbs, fit and not a fit, on one route that writes the verdict and flips `aligned_projects` at once. A read-only `measure-rubric-vs-verdicts.mjs` prints per-project precision and recall of keyword, rubric and the OR at 2.0 to 2.75, so the threshold can go per project by measurement. Store `rubric_prose_hash` in `rubric_meta` so `--rescore` becomes selective. Left out on purpose: automatic keyword edits, threshold moves, re-asking Jev on a verdict.

### 3.7 Known disagreements (open rows)

| grant | geography | tags | keyword Goods | Jev | note |
|---|---|---|---|---|---|
| Alcohol and Other Drugs Youth Grants 2026/27 | AU-NT | ACT-GD | 73 | goods 0.58 (unverified: dry run, not stored) | keyword noise per the ledger |
| Aboriginal Community Initiatives Fund 2026-27 | VIC | ACT-GD | 55 | goods 0.81 (unverified) | outside Goods' NT/QLD/WA; `goods-relevance.mjs:211-224` has no state penalty |
| Barkly Regional Deal Local Community Project Funds | AU-NT | ACT-GD | 78 | goods 1.99 (unverified) | Ben ruling pending: widen Goods to enterprise money? |
| Visions of Australia Round 23 | national | ACT-CN | 7 | contained 2.85, stored | the rubric's proof case; keyword 10 missed it |
| SCC Major Grants | null | none | 7 | contained 2.36, stored | Sunshine Coast Council, Harvest and Farm's only LGA; no scorer models place |

Applicant geography (who may apply) is modelled nowhere; geography lives in four code paths with three vocabularies (`score-project-rubric.mjs:148-159`, `project-relevance.mjs:161-170`, `goods-relevance.mjs:56-58` with AU-SA that `ACT_PROJECTS` lacks, `act-grant-eligibility.ts:49-107`).
