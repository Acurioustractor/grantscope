# jev-pipeline: how Jev (typesafe.ai) scores ACT grant tags, and what keeps them right

Read-only census, 2026-09-24 (Brisbane evening). Repo `/Users/benknight/Code/grantscope` @ main `1b517ba0`.
Every file:line below was read; every number below has its SQL pasted. "Ledger" = `thoughts/shared/handoffs/act-grant-desk/current.md` (untracked, 2026-09-24T07:45Z).

## 0. Headline findings

1. **Tonight's first scheduled Jev run already failed and will fail again.** The pm2 `orchestrator` process was created `2026-09-22T02:57:42Z` (`pm2 describe orchestrator`, uptime 2D) and imports the agent registry once at module load (`scripts/agent-orchestrator.mjs:23`). PR #519 added the `score-project-rubric` registry entry at `2026-09-24 16:41:58 +1000`. At `06:46:02 UTC` the orchestrator logged `Unknown agent: score-project-rubric` (pm2 log), the `agent_tasks` row is `status=failed, error='Unknown agent: score-project-rubric'`, `agent_schedules.last_run_at` is NULL and `last_scheduled_at=2026-09-24T06:45:45Z`, so the scheduler will not retry before `2026-09-25 06:45 UTC` (`agent-orchestrator.mjs:347-352`), and it will fail again until the orchestrator is restarted (`pm2 restart orchestrator`, Tier 2, not done here). DB proof: 0 rows carry a Goods rubric verdict and 17 of 333 open grants have never been read by Jev (SQL in §7).
2. **There is no human feedback loop on grant tags.** No table or column records Ben's verdict per grant x project; none of the three scorers reads any human decision. The nearest artefacts are `opportunity_decisions` (7 rows, 3 of them "no / Not relevant to Goods on Country" from 2026-08-11), `act_grant_recommendation_decisions` (89 rows, other pipeline, last pass 2026-07-28, only honoured as a funder-level blocklist), and `grant_feedback` (144 tracker votes, last 2026-05-03). The pilot's blind adjudication sheet was never graded (`scripts/jev-pilot/README.md:63`, `thoughts/shared/findings/jev-calibration-2026-09-21.md:8`).
3. **The desk never shows Jev.** `act-project-grants-triage.ts:58-60` and `act-grants-desk.ts:76-82` read only the keyword score; `act-one-desk.ts:223-225` ranks "decision due" on the keyword score (Goods >= 85, others >= 40) or deadline <= 30 days. A rubric-only tag (Visions of Australia, keyword 10, Jev 2.85) reaches the desk only via the deadline clause.
4. **Removal is not human-gated and is not "add only" for the five non-Goods projects.** `applyProjectTags` (`scripts/lib/project-relevance.mjs:287-288`) deletes a tag when both signals fail; the rubric script calls it on every row it reads (`score-project-rubric.mjs:272-274`). Only for Goods is the rubric add-only (`score-project-rubric.mjs:276-299`); `applyGoodsTag` owns Goods removal (`goods-relevance.mjs:295-314`).

## 1. Inventory: every Jev caller

`grep -rIl -E "typesafe|JEV_API_KEY|jev-latest|systemone"` (excluding node_modules/.next/.git/data):

| file | role | writes DB? | scheduled? |
|---|---|---|---|
| `scripts/score-project-rubric.mjs` | production tagger (six projects) | YES: `grant_opportunities.project_relevance`, `aligned_projects`, `project_relevance_scored_at`, `goods_relevance_signals` (L305-309) | `agent_schedules` 24h, enabled (see §6); registry `agent-registry.mjs:1229-1240` |
| `scripts/jev-check-loop.mjs` | label audit (4 audits) | NO (L16: "writes NOTHING to the database"); output `data/jev-check/<audit>.jsonl` + `thoughts/shared/data-map/label-check-<audit>.md` (L413) | no registry entry (grep `jev` in registry: only the rubric scorer) |
| `scripts/jev-charity-classify.mjs` | ACNC charity sector/control/school | NO; `data/jev-check/charity-classify.jsonl` (6.9MB on disk, 24 Sep 14:18) | no |
| `scripts/jev-entity-match.mjs` | suggest entity for unlinked buyer/funder names | NO; `data/jev-check/entity-match.jsonl` | no |
| `scripts/jev-donor-plausibility.mjs` | donor->ABN match plausibility | NO; `data/jev-check/donor-plausibility.jsonl` (3.4MB) | no |
| `scripts/jev-purpose-sample.mjs` | calibration vs Commonwealth `grantconnect_awards.category` | NO; `data/jev-purpose/results.jsonl` | no |
| `scripts/jev-pilot/2-ask-jev.mjs` | eligibility pilot (Noul vs Choice) | NO; `data/jev-pilot/jev-verdicts*.jsonl` | no |
| `scripts/jev-pilot/4-missed-money.mjs` | the sweep that found the false negatives; prototype of the rubric | NO; `data/jev-pilot/missed-money.{jsonl,csv}` | no |
| `supabase/migrations/20260923060000_charity_classification.sql` | consumes charity-classify output | n/a | n/a |

No file under `apps/web/` calls Jev. No SDK is used anywhere: every caller is a plain `fetch` to `https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer ${JEV_API_KEY}` and `model: 'jev-latest'` (e.g. `score-project-rubric.mjs:64,183-188`). The API reports back `jev-1.13.0`, which is what gets stored (§3).

**Memory correction:** `reference_jev_typesafe.md:43` names `jev-adjudicate-grants.mjs`; it does not exist (`ls scripts/jev-adjudicate-grants.mjs` -> No such file). The four verified Jev scripts of 2026-09-23 are charity-classify, donor-plausibility, entity-match and the pilot; check-loop and purpose-sample predate them.

Non-Jev pieces of the same pipeline (read, all keyword):
- `scripts/lib/project-relevance.mjs` (5 projects, keyword tiers + rubric gates + `applyProjectTags`), tests `project-relevance.test.mjs` (33 tests).
- `scripts/lib/goods-relevance.mjs` (Goods keyword scorer + `applyGoodsTag` + `goodsRubricQualifies`), tests `goods-relevance.test.mjs`.
- `scripts/score-project-relevance.mjs` (keyword writer for 5 projects; **no registry entry, no schedule**; last ran by hand 2026-09-20T23:29Z per `agent_runs`).
- `scripts/score-goods-relevance.mjs` (keyword writer for Goods; registry `agent-registry.mjs:1221-1228`; scheduled 24h).
- `scripts/measure-project-relevance.mjs` (read-only histogram of the keyword scorer over live rows; no writes; `.in('status', ['open','ongoing','upcoming'])` L25).

## 2. What exactly is sent to Jev per grant

`scripts/score-project-rubric.mjs:174-196` (`askJev`):

```js
const state = {
  grant_name: grant.name,
  funder: grant.provider || 'unknown',
  description: String(grant.description || '').slice(0, 3000),
  categories: grant.categories || [],
  focus_areas: grant.focus_areas || [],
};
body: JSON.stringify({ model: MODEL /* 'jev-latest' */, state, questions })
```

`questions` (L114-133) is one **Noul** plus one **Score** per project:

- `fundable_by_an_organisation` (L116-123), `type: 'noul'`, instructions "Decide whether this is funding an incorporated organisation could apply for to deliver a project.", criteria true = "An organisation, charity, company or community group could apply...", false = "This is a scholarship, fellowship, bursary, prize or award for an individual person, a research grant tied to a university position, or a procurement contract rather than a grant."
- `fit_<project>` for `goods, justicehub, empathy-ledger, harvest, farm, contained` (L125-131), `type: 'score'`, instructions:
  `Rate how well this funding opportunity fits the following project.\n\nPROJECT: ${p.what}\n\nJudge the THEME AND PURPOSE only. Ignore geography, deadlines, dollar amounts and the applicant's legal structure — those are checked separately.`
  criteria = the four `LEVELS` (L107-112), which Jev returns as a probability-weighted score 0..3:
  0 "No connection. The grant funds something unrelated to this work."
  1 "Adjacent. Same broad sector, but the grant does not fund what this project actually does."
  2 "Plausible. This project could write a credible application without stretching the truth."
  3 "Strong. The grant's stated purpose directly matches what this project does."

The rubric prose per project (`PROJECTS[*].what`, L78-105; `area` is applied in code only):

| project | `what` (verbatim) | area (code) |
|---|---|---|
| goods | "Goods on Country supplies essential household goods — beds, bedding, mattresses, whitegoods, washing machines, furniture — into remote Aboriginal and Torres Strait Islander communities, alongside community stores, remote housing and community infrastructure. It is Aboriginal-community-controlled in its delivery and works on self-determination and Closing the Gap terms." | states NT, QLD, WA |
| justicehub | "JusticeHub works on youth justice: justice reinvestment, diversion and diversionary programs, restorative justice, bail support, throughcare, youth mentoring, and reducing youth detention, recidivism and reoffending. It does NOT mean environmental, climate or economic justice." | national |
| empathy-ledger | "Empathy Ledger is a consent-based storytelling platform: lived-experience and digital storytelling, oral history, narrative evidence, community voice and Indigenous data sovereignty, where the storyteller keeps control of their story. It has nothing to do with accounting or bookkeeping ledgers." | national |
| harvest | "The Harvest is community food work: food security, food relief and rescue, community gardens, community kitchens, urban agriculture and food sovereignty. It does not mean a wine or grape harvest, or a harvest festival." | QLD (state level; the LGA "Sunshine Coast" in `act-grant-eligibility.ts:34` is NOT used here) |
| farm | "The Farm is regenerative agriculture: regenerative and sustainable farming, agroforestry, landcare, soil health, revegetation, catchment work, farm biodiversity and natural capital. It does not mean a wind farm, solar farm, server farm or fish farm." | QLD (same note) |
| contained | "Contained is a shipping-container based touring exhibition: immersive installations and pop-up or mobile exhibitions that travel to communities. It does not mean a study tour, sports tour, concert tour, or tourism operation." | national |

The prose is sourced (comment L72-77) from `ACT_PROJECTS` in `apps/web/src/lib/act-grant-eligibility.ts` and the tier-1 keyword sets. The same prose lives a second time in `scripts/jev-pilot/4-missed-money.mjs:66-97` (prototype, with `lga: 'Sunshine Coast'` that the production script dropped). Two copies, no shared module: a rubric edit must be made twice or the pilot drifts.

**Which questions a row gets** (`questionsFor`, L166-172): all seven when `--rescore` or when the row has no `rubric_meta`; otherwise only `fit_<p>` for projects whose `rubric` is missing. Today that means the 316 open rows read on 2026-09-20/21 would be asked only `fit_goods`, and the 17 never-read rows all seven. Note the Noul is NOT re-asked on a partial read, so `rubric_meta.organisation_fundable` stays from the first read.

Concurrency 4 (`--concurrency`), 60s timeout, 429/529 retried 4 times with backoff (L189-193). Default `--limit=400`, open-only unless `--all-time` (L206-213).

**The eligibility pilot asks a different shape** (`scripts/jev-pilot/2-ask-jev.mjs:47-140`): five **Choice** questions with `required / not_required / not_stated` (Choice chosen over Noul because Noul folds "silent" into false; L12-22). That path was never productionised: `enrich-grant-eligibility.mjs` still uses the chat-model regex path (README L79-84 "If it wins"), and `dgr_required`/`accepts_pty_ltd` remain mostly NULL (`act-grant-eligibility.ts:1-4`).

## 3. What comes back and where it is stored

`score-project-rubric.mjs:248-268`:

```js
relevance.rubric_meta = { organisation_fundable: json.answers.fundable_by_an_organisation.noul ?? null, model: json.model || MODEL, scored_at: at };  // only when the Noul was asked
relevance[project] = { ...(relevance[project] || {}), rubric: { score: a?.score ?? null, confidence: a?.confidence ?? null, ...(geographyExcluded(project, g) ? { geography_excluded: true } : {}) } };
```

Storage: **`grant_opportunities.project_relevance` jsonb** (added by `supabase/migrations/20260914200000_project_relevance.sql`; no migration was written for the rubric keys, the comment on the column still says "Written by scripts/score-project-relevance.mjs"). Goods' verdict goes to `project_relevance.goods.rubric` too (there is no separate Goods column for it; `goods_relevance_score/_signals` stay keyword).

Real stored shape (SQL: `SELECT name, project_relevance::text FROM grant_opportunities WHERE name = 'Visions of Australia - Round 23'`):

```json
{"farm": {"score": 6, "rubric": {"score": 0.04, "confidence": 0.96}, "signals": {...}, "scored_at": "2026-09-20T23:48:04.189Z", "tagged_by": null},
 "harvest": {"score": 6, "rubric": {"score": 0.07, "confidence": 0.93}, ...},
 "contained": {"score": 10, "rubric": {"score": 2.85, "confidence": 0.85}, "signals": {"tier2_hits": ["exhibitions"], "tier3_hits": ["exhibition"], ...}, "scored_at": "...", "tagged_by": "rubric"},
 "justicehub": {"score": 0, "rubric": {"score": 0.02, "confidence": 0.98}, ...},
 "empathy-ledger": {"score": 0, "rubric": {"score": 1.05, "confidence": 0.64}, ...},
 "rubric_meta": {"model": "jev-1.13.0", "scored_at": "2026-09-20T23:48:04.189Z", "organisation_fundable": 0.88},
 "tag_changes": {"contained": {"at": "2026-09-20T23:48:04.189Z", "by": "rubric", "score": 10, "change": "added", "previous_score": 10}}}
```

Per project the object is `{score (keyword 0-100), signals (keyword hits), scored_at, rubric {score 0-3, confidence 0-1, geography_excluded?}, tagged_by: 'keyword'|'rubric'|'both'|null}`. `tag_changes` is the audit ledger (`project-relevance.mjs:312-313`). For Goods the parallel ledger is `goods_relevance_signals.tagged_by` and `.tag_change` (`goods-relevance.mjs:295-314`), e.g. Alcohol and Other Drugs Youth Grants: `"tagged_by": "keyword", "tag_change": {"at": "2026-09-24T06:45:53.178Z", "by": "keyword", "score": 73, "change": "added", "previous_score": null}`.

Also stored: `aligned_projects text[]` (the tags: `ACT-GD` + literal `goods`, `ACT-JH`, `ACT-EL`, `ACT-HV`, `ACT-FM`, `ACT-CN`), `project_relevance_scored_at`. `json.usage.input_tokens` is summed for the cost line only, never stored per row.

## 4. Thresholds and how the two signals combine

`scripts/lib/project-relevance.mjs:239-245`:

```js
export const RUBRIC_FIT_AT = 2.5;              // not the rubric's own "plausible" 2.0
export const RUBRIC_CONFIDENCE_AT = 0.5;
export const RUBRIC_ORG_FUNDABLE_AT = 0.5;
export const RUBRIC_GENERIC_PROJECT_COUNT = 3;
```

The 2.5 was measured (comment L228-238) on 380 open grants vs 7 hand-verified wins: 2.00 -> 46 tags 7/7; 2.25 -> 36, 6/7; **2.50 -> 21, 6/7** (only loss SCC Major Grants, a geography signal); 2.75 -> 9, 4/7. "Raise or lower this only with the same measurement re-run."

`rubricQualifies(rubric, meta)` L251-258: needs rubric present, not `geography_excluded`, `score >= 2.5`, `confidence >= 0.5`, `meta.organisation_fundable >= 0.5` (missing meta passes: `?? 1`).

`countRubricFits` L261-265 counts qualifying rubrics over the **five** `PROJECT_CODES` (Goods excluded). `applyProjectTags` L267-316:

```js
const isGenericProgramme = countRubricFits(relevance) >= 3;
const byKeyword = result.score >= PROJECT_TAG_THRESHOLD;   // 30
const byRubric = !isGenericProgramme && rubricQualifies(existingRubric, relevance.rubric_meta);
if (byKeyword || byRubric) tagged.add(code); else tagged.delete(code);
```

So for the five projects: **tag = keyword>=30 OR (rubric qualifies AND not generic)**, and **the tag is removed when both fail**. The rubric verdict used is whatever is *stored* on the row, carried across explicitly (L301-309, trap #1 test at `project-relevance.test.mjs:308-320`).

Goods (`goods-relevance.mjs:295-325`): `applyGoodsTag` = keyword>=50 OR `goodsRubricQualifies(row.project_relevance)`; removes when both fail; `goodsRubricQualifies` = `rubricQualifies(goods.rubric, meta) && countRubricFits(relevance) + 1 < 3` (Goods plus at most one other project). In `score-project-rubric.mjs:290-299` Goods is **add-only**: the rubric pushes `ACT-GD` + `goods` and writes `goods_relevance_signals.tagged_by='rubric'`, never deletes. `score-goods-relevance.mjs` also preserves hand-set rows: `source LIKE 'manual%'` gets `scored_at` stamped but score untouched (L188-209).

**Who can remove a tag** (verified from code): `score-project-relevance.mjs` and `score-project-rubric.mjs` (five projects, via `applyProjectTags`), `score-goods-relevance.mjs` (Goods, via `applyGoodsTag`). No human path. No page removes a tag.

Keyword side, for reference: `PROJECT_TAG_THRESHOLD = 30` (L22), tier1 +20 (+8 in name), tier2 +8, tier3 +2, disqualifier -25, state boost +6, closed -30, and a "shaped" gate that caps a tier1-less score at 29 (L181-188). Goods: `GOODS_TAG_THRESHOLD = 50`, `GOODS_HIGH_FIT_THRESHOLD = 70` (L285-286), identity-only cap at 49 (L270-278).

## 5. Rescoring and the once-per-grant rule

`score-project-rubric.mjs`:
- Default is incremental **in SQL** (L218 `if (!RESCORE) q = q.is('project_relevance->goods->rubric', null)`) and again in JS (L231). Since #520 the marker of "read" is the Goods rubric, so every pre-#520 row counts as unread and will be asked `fit_goods` only.
- `--rescore` (L62, L168, L231): every row in scope (open by `closes_at>=today OR deadline>=today`, or `--all-time`), all seven questions, **still capped by `--limit` (default 400)**. Comment L222-230: three dry runs over the same 383 rows produced 8, 9 and 10 tags, so "score each grant ONCE ... Use --rescore only deliberately, e.g. after changing the rubric wording or the threshold."
- The rubric script re-runs the keyword scorer on every row it reads (L272-274) and writes both, so a keyword change is only re-applied to rows Jev reads unless `score-project-relevance.mjs --rescore-all` is run by hand.

Keyword rescore flags: `score-project-relevance.mjs --rescore-all` (L32, L58), `score-goods-relevance.mjs --rescore-all` (L33, L68; `--source=` filter L36).

There is no marker of *which rubric wording* a stored verdict came from (`rubric_meta` has `model` and `scored_at` only). After editing `PROJECTS[*].what` nothing tells you which rows are stale except the date.

## 6. Cost and scheduling

Cost: header L42-43 "~1,600 input tokens per grant at $0.042/M => about $0.03 per 400 grants. Scoring all 26,840 rows would be roughly $1.80." Printed as `tokens*42/1e9` (L325). Measured runs: 380 grants x 6 Score + Noul = $0.026 (memory `project_jev_evaluation.md:54`); 2026-09-24 dry runs 17 grants $0.0010 and 333 grants (Goods question only for most) $0.0088 (migration `20260924063140` header; #520 commit body). Registry comment L1236: "~$0.001 a night".

Scheduling chain (all verified):
1. `scripts/lib/agent-registry.mjs:1229-1240`: `'score-project-rubric': { command: ['node','--env-file=.env','scripts/score-project-rubric.mjs','--apply'], category: 'goods', defaultPriority: 2, timeoutMs: 600_000 }`; `:1221-1228` the same for `score-goods-relevance` (no `--apply`, it writes by default).
2. `supabase/migrations/20260924063140_schedule_act_grant_scorers_nightly.sql:22-24`: `INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority) VALUES ('score-goods-relevance', 24, true, 2), ('score-project-rubric', 24, true, 2)`. Applied: `SELECT agent_id, interval_hours, enabled, priority, last_run_at, last_scheduled_at FROM agent_schedules WHERE agent_id IN (...)` -> both `24 | true | 2`; goods `last_run_at 2026-09-24T06:46:02Z`; rubric `last_run_at NULL`, `last_scheduled_at 2026-09-24T06:45:45Z`.
3. `scripts/agent-orchestrator.mjs:333-395` (`runScheduler`): selects `enabled AND auto_create_task`, creates an `agent_tasks` row when `now - last_scheduled_at >= interval`, stamps `last_scheduled_at`; `last_run_at` is written only on success (L274-278). Unknown agent -> task `failed` (L175-178).
4. `ecosystem.config.js:1-16` runs the orchestrator under pm2 (`node --env-file=.env scripts/agent-orchestrator.mjs`). Nothing in `apps/web/vercel.json` crons and nothing in pg_cron touches these.

`score-project-relevance.mjs` is **not** in the registry and has no schedule row (`SELECT agent_id FROM agent_schedules WHERE agent_id ILIKE '%relevance%' OR ... '%rubric%'` -> only the two above).

**Why tonight's run did not happen** (§0.1): pm2 log lines
```
[2026-09-24 06:45:45] Scheduler created task: score-goods-relevance
[2026-09-24 06:45:45] Scheduler created task: score-project-rubric
[2026-09-24 06:46:02] Unknown agent: score-project-rubric
```
`SELECT agent_id, status, created_by, started_at, error FROM agent_tasks WHERE agent_id IN ('score-goods-relevance','score-project-rubric') ORDER BY created_at DESC` ->
`score-project-rubric | failed | scheduler | 2026-09-24T06:46:02Z | Unknown agent: score-project-rubric` and `score-goods-relevance | completed | scheduler | 06:45:52Z`.
The same log shows `Unknown agent: check-lane-reconciliation` at 01:56, so this is a standing class of failure: any registry addition needs an orchestrator restart. (Also true of the Goods scorer's code: it ran at 06:45:52Z, sixteen minutes before #520 merged at 07:01Z, so the run that added 4 Goods tags was the pre-#520 `applyGoodsTag`; harmless because no rubric Goods verdict exists yet.)

## 7. What `agent_runs` says (last 10 per agent)

```sql
SELECT agent_id, status, items_found, items_new, items_updated, duration_ms, started_at, left(errors::text,120)
FROM (SELECT *, row_number() OVER (PARTITION BY agent_id ORDER BY started_at DESC) rn
      FROM agent_runs WHERE agent_id IN ('score-goods-relevance','score-project-rubric','score-project-relevance')) t
WHERE rn <= 10 ORDER BY agent_id, started_at DESC
```

| agent_id | status | found | new | updated | ms | started_at (UTC) |
|---|---|---|---|---|---|---|
| score-goods-relevance | success | 132 | 4 | 132 | 9621 | 2026-09-24 06:45:52 (the script's own row) |
| score-goods-relevance | success | 0 | 0 | 0 | 10166 | 2026-09-24 06:45:52 (the orchestrator wrapper's row, `agent-orchestrator.mjs:189`) |
| score-goods-relevance | success | 27380 | 52 | 27380 | 112881 | 2026-09-14 07:45:29 |
| score-goods-relevance | success | 595 | 4 | 595 | 2050 | 2026-09-14 06:46:50 |
| score-goods-relevance | success | 4 | 3 | 4 | 517 | 2026-05-28 19:09 |
| score-goods-relevance | success | 24987 | 108 | 24987 | 269910 | 2026-05-27 11:13 |
| score-goods-relevance | timed_out | 0 | 0 | 0 | 0 | 2026-05-27 11:06 |
| score-goods-relevance | success | 24977 | 109 | 24977 | 477973 | 2026-05-27 10:45 |
| score-goods-relevance | success | 10266 | 127 | 10266 | 66274 | 2026-05-13 10:26 |
| score-goods-relevance | success | 10500 | 139 | 10500 | 75379 | 2026-05-13 10:24 |
| score-project-relevance | success | 26840 | 5 | 26840 | 114870 | 2026-09-20 23:29 |
| score-project-relevance | success | 26785 | 249 | 26785 | 132905 | 2026-09-14 11:17 |
| score-project-rubric | success | 4 | 0 | 0 | 944 | 2026-09-24 06:48:04 |
| score-project-rubric | success | 333 | 1 | 0 | 24520 | 2026-09-24 06:47:07 |
| score-project-rubric | success | 333 | 1 | 0 | 25217 | 2026-09-24 06:46:24 |
| score-project-rubric | success | 17 | 1 | 0 | 2523 | 2026-09-24 06:30:56 |
| score-project-rubric | success | 383 | 9 | 0 | 37985 | 2026-09-20 23:48:02 |
| score-project-rubric | success | 383 | 10 | 0 | 32964 | 2026-09-20 23:46:51 |
| score-project-rubric | timed_out | 0 | 0 | 0 | 0 | 2026-09-20 23:46:07 |

Reading it honestly: `score-project-rubric.mjs:202` calls `logStart` **unconditionally, dry runs included**, so a "success" row is not evidence of a write. Stored `rubric_meta.scored_at` values are `2026-09-20T23:48:04Z`..`23:48:39Z`, matching the 23:48:02 run: that is the **one real `--apply` ever** (9 tags; the 23:46 run with 10 tags was a dry run: the "8, 9, 10" wobble). All four 2026-09-24 rows are consistent with the dry runs recorded in the migration header and #520 body; the DB confirms nothing was applied that day:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE closes_at >= current_date OR deadline >= current_date) AS open_by_date,
       count(*) FILTER (WHERE project_relevance ? 'rubric_meta') AS rubric_read,
       count(*) FILTER (WHERE project_relevance->'goods'->'rubric' IS NOT NULL) AS goods_rubric_read,
       count(*) FILTER (WHERE (closes_at >= current_date OR deadline >= current_date) AND project_relevance ? 'rubric_meta') AS open_rubric_read,
       count(*) FILTER (WHERE project_relevance_scored_at IS NOT NULL) AS keyword_scored,
       count(*) FILTER (WHERE goods_relevance_scored_at IS NOT NULL) AS goods_scored,
       count(*) FILTER (WHERE cardinality(aligned_projects) > 0) AS any_tag
FROM grant_opportunities
-- total 26903 | open_by_date 333 | rubric_read 380 | goods_rubric_read 0 | open_rubric_read 316 | keyword_scored 26827 | goods_scored 26903 | any_tag 559
```

So: 380 rows ever read by Jev (all on 2026-09-20/21), 316 of the 333 open ones, **17 open grants never read**, **0 Goods verdicts anywhere**.

Tag provenance on open rows:

```sql
SELECT p, project_relevance->p->>'tagged_by', count(*) FROM grant_opportunities, unnest(ARRAY['justicehub','empathy-ledger','harvest','farm','contained']) p
WHERE (closes_at >= current_date OR deadline >= current_date) AND project_relevance->p->>'tagged_by' IS NOT NULL GROUP BY 1,2
-- contained both 1 | contained rubric 3 | farm rubric 1 | justicehub both 5
SELECT goods_relevance_signals->>'tagged_by', count(*) FROM grant_opportunities WHERE (closes_at >= current_date OR deadline >= current_date) AND 'ACT-GD' = ANY(aligned_projects) GROUP BY 1
-- keyword 2 | NULL 6   (the 6 predate #455's tagged_by)
SELECT t, count(*) FROM grant_opportunities, unnest(aligned_projects) t WHERE (closes_at >= current_date OR deadline >= current_date) GROUP BY 1 ORDER BY 2 DESC
-- ACT-GD 8, goods 8, ACT-JH 5, ACT-CN 4, harvest 4, ACT-PI 3, ACT-GL 2, ACT-CORE 2, ACT-MD 2, ACT-AI/MR/TN/JP/SS/GCC/FN/UA/PS/SE/CE/FG/FM 1 each
```

Of 22 distinct tag codes on open rows only six are owned by these scorers; the rest come from other writers (`scripts/sync-act-private-grant-rounds.mts`, `ingest-strategic-grants-wrap-2026-07.mjs`, `scout-grants-for-profiles.mjs`, `promote-grant-opportunities-to-alma.mjs`, `sync-austender-open-tenders.mjs`, the decide route `apps/web/src/app/api/ops/grant-recommendations/decide/route.ts:96`). The triage reads only the six (`act-project-grants-triage.ts:9-16, 43`). Today's open desk contract is therefore 8 Goods + 5 JusticeHub + 4 Contained + 1 Farm + 0 Empathy Ledger + 0 Harvest (the literal `harvest` tag on 4 rows is not `ACT-HV` and is invisible to the desk).

## 8. Where the desk reads all this (and what it ignores)

- `apps/web/src/lib/services/act-project-grants-triage.ts:37-73`: `.in('status', ['open','ongoing','upcoming']).overlaps('aligned_projects', [six codes])`; `fitScore` = `goods_relevance_score` for Goods else `project_relevance[project].score` (**keyword only**); `daysToDeadline` from the `deadline` column only (the scorers use `closes_at || deadline`).
- `apps/web/src/lib/services/act-one-desk.ts:217-235`: `fitBar = goods ? 85 : 40; decisionDue = daysToDeadline <= 30 || fitScore >= fitBar`; row text "Decide: pursue (push to GHL) or pass".
- `apps/web/src/lib/services/act-grants-desk.ts:44-46, 76-82`: `fitScore` per project from keyword only (`project_relevance` typed as `{ score?: number }`); eligibility via `projectEligibility` L98.
- `apps/web/src/app/org/[slug]/desk/page.tsx`: renders a "decide" pill (L155); the only interactive elements are `<Link>`s and the GHL anchor (L102-220). **No pursue/pass handler exists on the desk.**
- `act-record-review.tsx:98-102, 441-448` has Pursue/Pass buttons mapped to `act`/`close` posting to `/api/opportunity-intelligence/actions`, whose kinds include `no`, `later`, `mark_no_go` (route L17-32). That surface is the opportunity-intelligence record review, not the grant desk; the write target is `createOpportunityIntelligenceAction` in `opportunity-intelligence.ts` (inferred: the table `opportunity_decisions` carries `source_type='grant', decision='no', reason='Not relevant to Goods on Country'`).

`rubric`, `tagged_by`, `rubric_meta` are read by **no** file under `apps/web/src` (grep `tagged_by|rubric` in the seven files that mention `project_relevance`: none).

## 9. Is there a human feedback loop? No. Here is everything adjacent.

| artefact | rows | what it is | read by any scorer? |
|---|---|---|---|
| `opportunity_decisions` | 7 (latest 2026-08-11) | `SELECT source_type, project_code, pathway, decision, left(reason,80), created_at FROM opportunity_decisions ORDER BY created_at DESC` -> 3 x `grant | ACT-GD | grant | no | Not relevant to Goods on Country` (2026-08-11), 4 x `goods | ACT-GD | capital | research` (2026-05-03). Columns include `judgment jsonb`, `supersedes_id`, `evidence_gaps`. | No (`grep -rl` over `scripts/` finds none of the three scorers) |
| `act_grant_recommendation_decisions` | 89 | `SELECT decision, decision_scope, decision_origin, count(*), max(decided_at) ... GROUP BY 1,2,3` -> `passed/operational/legacy 62 (latest 2026-07-28)`, `won/historical_evidence/xero_invoices 26`, `watching 1`. Keyed on `opportunity_id` = `alma_funding_opportunities` (the OTHER pipeline). | Only `scripts/nightly-grant-pipeline.mjs:135-175`: funders with >=2 passes and 0 watch/pursue and no paid Xero invoice go into `funder_blocklist` (read by `reports/grant-frontier` and the 2026-08-07 ranking SQL). That is the one honoured loop in the system: funder-level, alma pipeline, never touches `aligned_projects`. |
| `grant_feedback` | 144 (last 2026-05-03) | `vote -1/+1, source_context tracker_no_button 107, tracker 22, matches 10, tracker_quick_triage 4, +1 once`. Written by `api/grants/[grantId]/feedback/route.ts:65-73`. SaaS-tracker era. | No |
| `source LIKE 'manual%'` rows | n/a | `score-goods-relevance.mjs:188-209` never overwrites their `goods_relevance_score` (e.g. SEDI First Nations 88). A score freeze, not a verdict; only Goods. | Goods scorer, as a skip |
| `data/jev-pilot/adjudication-sheet-choice.csv` | 1 file | The blind sheet for the eligibility pilot. README L63: "Accuracy is still unmeasured"; `jev-calibration-2026-09-21.md:8`: "still ungraded". | No |
| `thoughts/shared/data-map/label-check-*.md` | reports | `jev-check-loop.mjs` output: "A disagreement is a suspect row for a human, not a correction" (L16-17). Nothing records what the human then decided. | No |
| `goods_procurement_signals` action route | n/a | `track/review/dismiss/reset` (`api/goods/signals/[id]/action/route.ts:16`), procurement signals not grants. | No |

Net: a tag Ben disagrees with today can only be changed by editing keyword lists or rubric prose in code and rescoring, and even then the next nightly run re-derives the tag from the same two machine signals. The ledger's open rulings ("may Jev challenge a keyword tag?", "widen the Goods description?") have nowhere to land except code.

## 10. Known disagreements (ledger + live rows)

```sql
SELECT left(name,60), geography, aligned_projects, goods_relevance_score AS kw_goods, goods_relevance_signals->>'tagged_by',
       (project_relevance->'goods'->'rubric'->>'score')::numeric AS jev_goods,
       (project_relevance->'contained'->'rubric'->>'score')::numeric AS jev_cn, project_relevance->'contained'->>'tagged_by',
       (project_relevance->'rubric_meta'->>'organisation_fundable')::numeric, project_relevance->'rubric_meta'->>'scored_at'
FROM grant_opportunities WHERE name ILIKE ANY (ARRAY['%Alcohol and Other Drugs Youth%','%Skills NT%','%Remote Australia Employment%','%Aboriginal Community Initiatives%','%SEDI%','%Barkly%','%Creative Western Sydney%','%Visions of Australia%','%SCC Major%']) ORDER BY name
```

| grant | geography | tags now | keyword Goods | Jev Goods (ledger dry run 2026-09-24; **not stored**) | note |
|---|---|---|---|---|---|
| Alcohol and Other Drugs Youth Grants 2026/27 | AU-NT | ACT-GD, goods | 73, tagged_by keyword (added 06:45:53Z today) | 0.58 | keyword hits `aboriginal`, `torres strait`, `community-led`, `wellbeing`; stored five-project rubric: farm 0.02, harvest 0.75, contained 1.55, justicehub 1.33, EL 1.37; org_fundable 0.96. Ledger already calls it "keyword noise". |
| Skills NT Grant | AU-NT | ACT-GD, goods | 52 | 0.49 | (a second "Skills NT grant" row, kw 10, untagged: duplicate) |
| Remote Australia Employment Service Closed Non-Competitive Grant | national | ACT-GD, goods | 50 (exactly the line) | 0.76 | contained rubric 0.22, org_fundable 0.69 |
| Aboriginal Community Initiatives Fund: 2026-27 (VIC) | VIC | ACT-GD, goods | 55 | 0.81 | **out of Goods' area** (NT/QLD/WA) yet keyword-tagged: `goods-relevance.mjs:211-224` gives no penalty for a non-Goods state, and `VIC` without the `AU-` prefix is not even recognised. |
| SEDI Capability Building Grant | (null) | ACT-PI, ACT-GL, ACT-SE, ACT-GD, goods | 82 | 2.42 | "adjacent"; a second SEDI Capability row (kw 36, no tags) is a duplicate |
| 2026/2027 Barkly Regional Deal Local Community Project Funds | AU-NT | ACT-GD, goods | 78, tagged_by keyword | 1.99 | Ben ruling pending: widen Goods `what` to enterprise/infrastructure money? |
| Creative Western Sydney Micro-Grants Program (two rows, one with zero-width chars in the name) | AU-NSW | **none** | 9 / 0 | n/a | Ledger: "Contained was tagged" for it; in the DB neither row has a rubric or a tag, so that tag existed in a dry run only. The gap is real regardless: `geographyExcluded('contained', ...)` returns false for any Australian geography because Contained is national (`score-project-rubric.mjs:155-156`), and `locationVerdict` returns `'unknown'` not `'no'` for a national project against a state-limited grant (`act-grant-eligibility.ts:77`). Neither layer models *applicant* geography (who may apply) as distinct from *delivery* area. |
| Visions of Australia - Round 23 | national | ACT-CN | 7 (keyword contained 10) | contained **2.85 / 0.85**, `tagged_by rubric` | the rubric's proof case; keyword blind spot pinned by `project-relevance.test.mjs:257-268` |
| SCC Major Grants | (null) | none | 7 | contained 2.36, org_fundable 0.94 | Sunshine Coast Council, Harvest/Farm's only LGA; Jev correctly does not see a theme; a geography signal no scorer models (test L270-279 records this on purpose) |

Ledger also says (2026-09-24 dry run): "No Goods money missed" and rubric tagged "3 Contained, 1 Farm on open grants" beyond keywords, which matches the `tagged_by` counts in §7.

## 11. Where geography / eligibility live in code (three vocabularies, not one)

1. `scripts/score-project-rubric.mjs:148-159` `geographyExcluded(project, grant)`: uppercases `grant.geography`; empty passes; if it never matches `/\bAU\b|\bAU-|AUSTRALIA|NATIONAL|ALL STATES/` -> excluded for every project (overseas rule, added after "Mazda Foundation (NZ)" got tagged for Contained); national projects then pass; state projects pass on `NATIONAL|AUSTRALIA[- ]WIDE|ALL STATES` or a substring hit on their states. Stored as `rubric.geography_excluded: true`, and `rubricQualifies` refuses on it (`project-relevance.mjs:253`). Real example: Alcohol and Other Drugs Youth Grants (AU-NT) has `geography_excluded` on farm and harvest (QLD projects).
2. `scripts/lib/project-relevance.mjs:161-170`: harvest/farm `states: ['QLD']` -> +6 when tokens (after stripping `AU-`) include the state or `NATIONAL`; no penalty otherwise ("fit, not a gate").
3. `scripts/lib/goods-relevance.mjs:56-58, 211-224`: `GOODS_GEOGRAPHIES = {AU-NT, AU-WA, AU-QLD, AU-SA}` (**SA is in the scorer, not in ACT_PROJECTS' NT/QLD/WA**) +10; exact `'AU'` or `''` +4; unknown +2; anything else recorded as `non-goods:<geo>` with no penalty. Exact-string compare, so the lowercase `national` seen on real rows (Visions of Australia) lands as `non-goods:national`.
4. `apps/web/src/lib/act-grant-eligibility.ts`: `ACT_PROJECTS` L30-37 (entities per project: goods pty+butterfly, justicehub pty+akt, others pty+butterfly; areas: goods NT/QLD/WA, harvest/farm LGA Sunshine Coast QLD, rest national); `grantPlace` L49-60 (prefers `metadata->place {national|state|lga_name}`, else `geography` tokens stripped of `AU-`, matched against the 8 STATES; unrecognised -> `known:false`); `locationVerdict` L65-78 (LGA match, then state match; a national project against a state/LGA-limited grant is `'unknown'`, a state project is `'no'`); `entityVerdict` L81-86 (`dgr_required` true -> only Butterfly yes; `accepts_pty_ltd` decides Pty; else unknown); `projectEligibility` L96-107 (overall no if location no or every entity no; yes only if location yes and some entity yes). Consumed only by `act-grants-desk.ts:98` (the `/org/act/grants` page), not by the One Desk pool or triage.

Consequence: a grant can be in-area for the rubric (`AU-NT` substring), unknown for eligibility (`metadata.place` missing and `geography='national'` lowercase is not in STATES... actually `NATIONAL` uppercase matches L56, but `VIC` and `national` are handled differently by each layer), and scored +10/+4/+2 or `non-goods` by the Goods scorer, from the same string.

## 12. The smallest honest feedback design

Goal: Ben's disagreement is recorded once, honoured on every later run, and measurable against both machine signals.

**Table** (one migration; not a jsonb key, because `applyProjectTags` replaces the per-project object and `--rescore` rewrites `rubric`):

```sql
create table act_grant_tag_verdicts (
  grant_id uuid not null references grant_opportunities(id) on delete cascade,
  project  text not null check (project in ('goods','justicehub','empathy-ledger','harvest','farm','contained')),
  verdict  text not null check (verdict in ('fit','not_fit')),
  reason   text,                       -- free text; the rubric-tuning signal ("Western Sydney applicants only", "enterprise money, not goods")
  decided_by uuid, decided_at timestamptz not null default now(),
  -- what the machines said at the moment of the verdict, so the disagreement is frozen even after a rescore
  keyword_score int, rubric_score numeric, rubric_confidence numeric, tagged_by text,
  rubric_prose_hash text,              -- sha of PROJECTS[project].what at the time
  primary key (grant_id, project)
);
```

**How the scorers read it:** `applyProjectTags(row, results, at, verdicts)` and `applyGoodsTag(row, score, signals, at, verdict)` take the row's verdicts (one select per batch, keyed by grant_id). `not_fit` forces the tag off and writes `tagged_by: 'human_no'`; `fit` forces it on with `tagged_by: 'human_yes'`; `tag_changes.by = 'human'`. Both scripts still compute and store the keyword and rubric signals unchanged (so the disagreement stays visible and measurable), they just no longer decide. Both existing test files get one fixture each. The Goods add-only path in `score-project-rubric.mjs:290-299` respects `not_fit` the same way.

**Where Ben records it:** the desk row (and `/org/act/grants`) gets two verbs per project chip, "fit" / "not a fit", posting to one route that inserts the verdict and flips `aligned_projects` + `tagged_by` in the same request, so the row moves immediately instead of at the next nightly. The route also writes `keyword_score/rubric_score/...` from the row as it stands.

**How it feeds rubric tuning:** a read-only `scripts/measure-rubric-vs-verdicts.mjs` joins verdicts to `project_relevance` and prints, per project: how many verdicts, the rubric score distribution of `fit` vs `not_fit`, precision/recall of keyword-only, rubric-only and the OR at 2.0/2.25/2.5/2.75, and the top disagreements with the grant text. That is the golden set the pilot README asked for and never got; it also lets the 2.5 become per-project instead of global, by measurement. Storing `rubric_prose_hash` in `rubric_meta` too (one line in `score-project-rubric.mjs:251-255`) makes `--rescore` selective (only rows whose stored hash differs) and lets the measurement compare old and new prose against the same verdicts. Each verdict with a `reason` is also a candidate regression test, the pattern the two test files already use for real grants.

Not in the smallest design, on purpose: no automatic keyword edits, no automatic threshold moves, no Jev re-ask on a verdict (Jev cannot learn from it; the prose can).

## 13. Other gaps found on the way

- `--rescore` is silently capped at `--limit` (default 400); a "rescore everything" needs `--all-time --limit=30000` and about $1.80.
- `rubric_meta.organisation_fundable` is asked once and never re-asked on a partial (Goods-only) read.
- The rubric prose is duplicated between `score-project-rubric.mjs:78-105` and `jev-pilot/4-missed-money.mjs:66-97`.
- `score-project-relevance.mjs` (keyword, five projects) has no registry entry, so keyword list edits only reach rows Jev happens to read; a `--rescore-all` is a hand job.
- Goods scorer area (`AU-SA` included) disagrees with `ACT_PROJECTS.goods` (NT/QLD/WA), and neither penalises a wrong state (the VIC ACT-GD tag above).
- Triage uses `deadline` only; scorers use `closes_at || deadline`; `act-grants-desk.ts` uses `closes_at ?? deadline`. The same grant can be "closed" for one and live for another.
- Duplicate rows for SEDI Capability, SEDI First Nations, Skills NT, Creative Western Sydney (one name with zero-width characters), SCC Major Grants, each scored and tagged independently.
- `logStart` on the rubric script is unconditional, so dry runs pollute `agent_runs` as successes; the orchestrator adds a second wrapper row per orchestrated run (`agent-orchestrator.mjs:189`).
- Any new registry entry needs `pm2 restart orchestrator` or it runs as "Unknown agent" (two examples in today's log).

## 14. Confidence key for the structured summary

verified = file read or query run in this session; inferred = derived from those (e.g. which run was the real apply, the actions-route write target); unverified = taken from memory/ledger without a second source (the 2026-09-24 dry-run Jev Goods numbers, which were never stored).
