# Periphery map: the ACT money system (grants, philanthropy, buyers, Jev, saving)

Reader: periphery. Repo: /Users/benknight/Code/grantscope @ main (1b517ba0). Date: 2026-09-24. Read-only.
Every number below has its SQL; every code claim has file:line. Confidence marked in the summary.

## 0. What the periphery is attached to

The ten surfaces and two pipelines are defined in `thoughts/shared/handoffs/act-grant-desk/current.md`
(Context section, updated 2026-09-24T07:45Z). Route -> page file -> what it reads:

| # | Route | Page file | Reads (service -> tables) |
|---|---|---|---|
| 1 | `/org/act/desk` | `apps/web/src/app/org/[slug]/desk/page.tsx` (234 lines) | `lib/services/act-one-desk.ts:9` -> `act-project-grants-triage.ts:40` (`grant_opportunities`, `aligned_projects`, `project_relevance`) + `goods-funder-scan.ts:78` (`org_project_foundations`) + obligations/people/buyers/capital |
| 2 | `/org/act/grants` | `apps/web/src/app/org/[slug]/grants/page.tsx` (206) | `lib/services/act-grants-desk.ts` (+ `lib/act-grant-eligibility.ts`) -> `grant_opportunities`, `project_relevance` |
| 3 | `/org/act/funding` | `apps/web/src/app/org/[slug]/funding/page.tsx` (123) | `project-funding-service.ts:250-257` (`org_projects`, `project_funding_profiles`, `act_grant_recommendations_current`, `act_grant_recommendation_decisions`, rpc `search_project_funding_hybrid`) + `funding-weekly-digest.ts:52` (`funding_weekly_cycles`) |
| 4 | `/org/act/pipeline` | `apps/web/src/app/org/[slug]/pipeline/page.tsx` (117) | `org-pipeline-service.ts:152-166` (`act_grant_recommendations_current`, `_decisions`, `_projects`, `funder_context_snapshot`, `v_act_income_by_funder`) |
| 5 | `/org/act/intelligence` | `apps/web/src/app/org/[slug]/intelligence/page.tsx` (497) | six `exec_sql` RPCs (lines 103-156); no grant service |
| 6 | `/org/act/digest-preview` | `apps/web/src/app/org/[slug]/digest-preview/page.tsx` (91) | `act-one-desk.ts` `getOneDeskPool` |
| 7 | `/org/act/[projectSlug]` (+ `/funding`) | `apps/web/src/app/org/[slug]/[projectSlug]/page.tsx` (2055; NO grant imports, grep `^import .*(grant|fund|opportun|triage|apply-now|recommend)` = 0) and `.../[projectSlug]/funding/page.tsx` | `project-funding-service.ts` + `act-project-apply-now.ts:123-158` (`org_projects`, `act_grant_recommendation_projects`, `act_grant_recommendations_current`) |
| 8 | `/org/act/goods/grants` | `apps/web/src/app/org/[slug]/goods/grants/page.tsx` (244) | `goods-grants-triage.ts:60-75` (`grant_opportunities` ordered by `goods_relevance_score`, **plus `agent_schedules ilike '%grant%'` and `agent_runs ilike '%grant%'`** as a freshness tile) |
| 9 | `/org/act/goods/foundations` (+ `/scan`) | `.../goods/foundations/page.tsx` (195), `.../scan/page.tsx` | `goods-foundation-targets.ts:115-141` (`v_goods_foundation_targets`, `foundations`); scan: `goods-funder-scan.ts:78` (`org_project_foundations`) |
| 10 | `/ops/grant-recommendations` (+ `/triage`) | `apps/web/src/app/ops/grant-recommendations/page.tsx` (64), `triage/page.tsx` (32) | `act_grant_recommendations_current`, `_decisions`, `_projects`, `funder_context_snapshot`; triage: `alma_funding_opportunities` |
| + | `/home` | `apps/web/src/app/home/page.tsx` (882) | `home/page.tsx:452,458` `act_grant_recommendations_current` + `_decisions`; `:368` `grant_notification_outbox`; `:232-384` `saved_grants`, `grant_opportunities` |

Two pipelines:
- **P1 (tags):** `grant_opportunities` -> `scripts/score-goods-relevance.mjs` (keyword, Goods) + `scripts/score-project-rubric.mjs --apply` (Jev + keyword, six projects) -> `aligned_projects[]`, `project_relevance` jsonb, `goods_relevance_score` -> One Desk / `/org/act/grants`.
- **P2 (MV):** `alma_funding_opportunities` -> `scripts/nightly-grant-pipeline.mjs` (9 steps at lines 41-51: scrape, promote x2, classify, backfill, verify, funder-context, `REFRESH MATERIALIZED VIEW act_grant_recommendations`, blocklist) -> `act_grant_recommendations` MV / `act_grant_recommendations_current` -> `/ops/grant-recommendations`, `/org/act/pipeline`, `/org/act/funding`, `/home`, Notion sync.

## 1. Crons

### 1a. Vercel crons — `vercel.json` at the REPO ROOT (there is no `apps/web/vercel.json`; `find . -name vercel.json` = `./vercel.json` only)

`vercel.json:10-51`, ten entries. The two that belong to this system:

| Path | Schedule | Route file | What it does |
|---|---|---|---|
| `/api/cron/desk-digest` | `0 21 * * *` (07:00 Brisbane) | `apps/web/src/app/api/cron/desk-digest/route.ts` | `composeDeskDigest('act')` (`act-desk-digest.ts:48`, built on `getOneDesk`) -> Resend email (`:181-191`, to `DESK_DIGEST_TO` default `hi@act.place`, `:184`) -> `digest_log` insert (`:219`); then `syncGhlTaskBridge` (`act-ghl-task-bridge.ts`, writes `ghl_task_bridge`, creates GHL tasks on triage contact `uAsIUWBHez3DzVex8rtm`, `:11`). Delta-only: `act-desk-digest.ts:210-212` returns `no delta (and not Monday)` without a row. Email hard-codes `${SITE}/org/act/desk` (`:173`) and `/org/${slug}/desk?rec=` (`:50`). |
| `/api/cron/funding-weekly-digest` | `0 0 * * 1` | `apps/web/src/app/api/cron/funding-weekly-digest/route.ts` | `generateFundingWeeklyDigest('act')` (`funding-weekly-digest.ts:19-48`) reads `act_funding_opportunity_current_status`, `act_grant_recommendation_decisions`, `act_grant_recommendations_current`, `project_funding_profiles`, `agent_runs`, `act_opportunity_benchmark_cases`, `org_projects`; upserts `funding_weekly_cycles` with `delivery_status: 'in_app'` (`:48`). **Never sends anything.** Read only by `/org/act/funding` (`funding/page.tsx:4` `getLatestFundingWeeklyDigest`). |

The other eight crons are civicscope and the QLD watchhouse refresh; not this system.
The 15-minute `/api/cron/funding-ghl-sync` cron that memory `project_act_funding_radar` recorded on 2026-08-30 is gone: `ls apps/web/src/app/api/cron/` = `desk-digest`, `funding-weekly-digest` only.

Guard: `apps/web/src/lib/vercel-config.test.ts:21-39` fails vitest if any `vercel.json` cron path has no `route.ts`. So deleting a cron route without editing `vercel.json` is caught; the reverse (a cron left pointing at a route that still exists but is now meaningless) is not.

### 1b. pg_cron — live `cron.job` rows

```sql
SELECT jobid, jobname, schedule, active, left(command, 140) AS command FROM cron.job ORDER BY jobname
```
7 rows. The three that touch this system:

| jobname | schedule (UTC) | command | touches |
|---|---|---|---|
| `act-auto-pass-stale-pipeline` (jobid 9) | `0 4 * * *` | `SELECT act_auto_pass_stale_pipeline();` | UPDATEs `org_pipeline` grant rows to `status='passed'` when deadline >30d past, or rolling and untouched 180d (prosrc via `SELECT prosrc FROM pg_proc WHERE proname='act_auto_pass_stale_pipeline'`). Feeds `/org/act/pipeline`. **No migration in `supabase/migrations/` creates it** (grep `cron.schedule` in the live folder finds only `expire-closed-grant-opportunities`), so it lives only in the database. |
| `expire-closed-grant-opportunities` (14) | `30 16 * * *` | `SELECT public.expire_closed_grant_opportunities()` | `supabase/migrations/20260914120000_expire_closed_grant_opportunities.sql:31`. Sets `grant_opportunities.status='closed'` where `coalesce(closes_at, deadline) < current_date` (prosrc). Runs before the 17:00 MV refresh. Directly gates what P1 shows as open. |
| `refresh-civicgraph-mvs-nightly` (4) / `-weekly` (13) | `0 17 * * *` / `0 15 * * 0` | `CALL refresh_civicgraph_mvs_run('nightly'|'weekly')` | `mv_refresh_registry` row: `act_grant_recommendations` tier `nightly`, enabled, `max_age_hours 36`, note "promoted from on_demand 2026-08-19 (#314)". So the P2 MV is refreshed TWICE: by pg_cron at 17:00 UTC and by `nightly-grant-pipeline-finalize` step 8. |

```sql
SELECT to_jsonb(t)::text FROM mv_refresh_registry t WHERE t::text ~ 'act_grant|goods|funding_opportun|grant_rec|search_index'
-- act_grant_recommendations: tier nightly, enabled true, max_age_hours 36
```

`scripts/sql/setup-pg-cron-mv-refresh.sql` is the historical setup; `refresh-clarity-catalog-nightly` (11) and `refresh-closing-the-gap-state-summary` (10) are other systems.

### 1c. PM2 orchestrator + `agent_schedules` (the main scheduler)

`ecosystem.config.js:1-17`: one PM2 app, `orchestrator` = `scripts/agent-orchestrator.mjs` with `--env-file=.env`. `pm2 jlist` confirms it is `online`, cwd `/Users/benknight/Code/grantscope`, restarted `2026-09-22T02:57:44Z`. It creates `agent_tasks` from `agent_schedules` rows where `enabled=true AND auto_create_task=true` (`scripts/agent-orchestrator.mjs:336-339`) and appends `params` as CLI args (`:59-62`, `:183-186`, so `{"phase":"ingest"}` becomes `--phase=ingest`).

`agent_schedules` columns (information_schema): `id, agent_id, interval_hours, enabled, last_run_at, freshness_threshold_hours, auto_create_task, priority, params, created_at, updated_at, last_scheduled_at`.

```sql
SELECT s.agent_id, s.interval_hours, s.enabled, s.priority, s.auto_create_task, s.params::text, s.last_run_at, s.last_scheduled_at,
       r.status, r.started_at, r.items_found, r.items_new
FROM agent_schedules s
LEFT JOIN LATERAL (SELECT status, started_at, items_found, items_new FROM agent_runs WHERE agent_id = s.agent_id ORDER BY started_at DESC LIMIT 1) r ON true
WHERE s.agent_id ~ '(grant|jev|goods|digest|notion|ghl|desk|relevance|rubric|foundation|funding|alma|opportunit|nightly|classify-llm|smarty|private|promote|verify)'
ORDER BY s.enabled DESC, s.agent_id
```
40 rows. The ones that matter to the ten surfaces (interval h / enabled / last run status / last started UTC / found / new):

| agent_id | h | on | last status | last started | found/new | feeds |
|---|---|---|---|---|---|---|
| `score-goods-relevance` | 24 | yes | success | 2026-09-24 06:45:52 | 132/4 | P1 Goods tag (`goods_relevance_score`, `aligned_projects` ACT-GD) |
| `score-project-rubric` | 24 | yes | success | 2026-09-24 06:48:04 | 4/0 (prior 333/1) | P1 Jev rubric + keyword for six projects (`project_relevance`, `aligned_projects`) |
| `nightly-grant-pipeline-ingest` | 24 | yes | success | 2026-09-23 14:04:38 | 3/3 | P2 steps 1-3 (`params {"phase":"ingest"}`) |
| `nightly-grant-pipeline-enrich` | 24 | yes | success | 2026-09-23 14:05:18 | 3/3 | P2 steps 4-6 |
| `nightly-grant-pipeline-finalize` | 24 | yes | success | 2026-09-23 20:31:56 | 3/3 | P2 steps 7-9 incl. MV refresh |
| `nightly-grant-pipeline` (monolith) | 24 | **no** | **timed_out** | 2026-09-22 14:00:06 | 0/0 | see 1d: still being launched daily by the crontab scheduler |
| `match-foundations-for-projects` | 24 | yes | success | 2026-09-24 02:26:58 | 12/12 | `org_project_foundations` -> surface 9 scan + One Desk funders |
| `reconcile-foundations-ghl` | 24 | yes | success | 2026-09-23 20:30:36 | 0/0 | GHL -> `org_project_foundations.ghl_*` -> surface 9 scan |
| `sync-goods-ghl` | 12 | yes | **failed** | 2026-09-24 02:19:47 | 0/0 | `goods_relationships.ghl_signal` -> Goods insight/engagement; see 7.2 |
| `sync-act-private-grant-rounds` | 168 | yes | success | 2026-09-22 03:09:56 | 627/17 | `act_private_grant_rounds` (SmartyGrants) -> `/org/act/grants` UNION; see 7.4 |
| `scout-grants-for-profiles` | 24 | yes | success | 2026-09-24 02:12:13 | 1030/3 | `grant_notification_outbox` (SaaS alert lane, 0 ever sent) |
| `send-grant-alert-digests` | 168 | yes | success | 2026-09-22 02:19:04 | 0/0 | `alert_preferences` emails; sends nothing (0 found every run) |
| `sync-pipeline-to-notion` | 24 | **no** | success | 2026-08-09 22:42 | 1801/1801 | Notion (disabled) |
| `grantscope-discovery` / `-smartygrants` | 24/168 | **no** | | | | disabled discovery |
| `enrich-grants-free`, `scrape-grant-deadlines`, `scrape-qgip-grants`, `ingest-vic-grants-open`, `ingest-grantconnect-go`, `scrape-state-grants` (partial), `import-gov-grants`, `snapshot-grant-frontier`, `sync-foundation-programs*`, `discover-foundation-programs*`, `enrich-foundations`, `foundation-intelligence-refresh`, `score-foundation-alignment`, `watch-funding-anomalies`, `goods-*` | various | yes | mostly success | | | upstream ingest/enrichment of `grant_opportunities` / `foundations`; not surface-specific |

**Not scheduled at all** (absent from `agent_schedules`): `deliver-grant-notifications` (0 rows in `agent_runs` ever), `sync-ghl-to-tracker`, `seed-goods-grants-ghl.mjs` (not even registered), `sync-act-opportunities-to-notion.mjs` (not registered), `score-project-relevance.mjs` (not registered; `grep -n "score-project-relevance|rescore" scripts/lib/agent-registry.mjs` = 0).

`agent_tasks` for the monolith:
```sql
SELECT agent_id, status, created_at, started_at, params, error FROM agent_tasks WHERE agent_id = 'nightly-grant-pipeline' ORDER BY created_at DESC LIMIT 4
-- (0 rows)  -> the orchestrator never launches the monolith; something else does (1d).
```

### 1d. A SECOND scheduler: user crontab -> `scripts/scheduler.mjs` (finding)

`crontab -l`:
```
0 */6 * * * cd /Users/benknight/Code/grantscope && /usr/local/bin/node --env-file=.env scripts/scheduler.mjs >> logs/scheduler.log 2>&1
```
`scripts/scheduler.mjs` (249 lines) reads the SAME `agent_schedules` (`:98-100`, `enabled=true`), resolves the registry command, and appends only `splitArgs(schedule.params?.args)` (`:75-82`). It ignores `params.phase`. So for the three phase rows it runs `scripts/nightly-grant-pipeline.mjs` with no `--phase`, which the script treats as `PHASE='all'` and logs under `AGENT_ID='nightly-grant-pipeline'` (`scripts/nightly-grant-pipeline.mjs:33-35`). `logs/scheduler.log:75514-75517`:
```
[2026-09-22 14:00:06]   Running: nightly-grant-pipeline-ingest via registry
[2026-09-22 14:00:06]     /usr/local/bin/node --env-file=.env scripts/nightly-grant-pipeline.mjs
[2026-09-22 14:00:07]   Failed: nightly-grant-pipeline-ingest (0.7s) — node:events:486  throw er; // Unhandled 'error' event
```
`grep -c "scripts/nightly-grant-pipeline.mjs$" logs/scheduler.log` = **93** such launches. Each leaves an orphan `agent_runs` row under the monolith id that the 4-hour janitor marks `timed_out` (memory `solution_agent_runs_status_vocabulary`), which is exactly the daily `timed_out` rows at 14:00 UTC above. It also bumps `last_scheduled_at` on the phase rows (`scheduler.mjs:183-186`), competing with the orchestrator's gate.

In the last two days the crontab scheduler launched 22 agents (`grep -E "^\[2026-09-2[34]" logs/scheduler.log | grep -c "Running:"`), so everything in `agent_schedules` has two launchers with different environments. See 7.2 for why that matters.

### 1e. Stale clones also hold the pipeline
`/Users/benknight/Code/grantscope-atlas`, `grantscope-scraping`, `grantscope-sinks` each contain `scripts/nightly-grant-pipeline.mjs` and a registry (grep across `~/Code/*/scripts`). No PM2 app or crontab points at them (`pm2 jlist` shows only `orchestrator`, `reap-dev-servers`, `db-saturation-snapshot` for grantscope), so they are inert; memory `project_stale_grantscope_clones` already says atlas is deletable and scraping holds 8 unmerged files.

## 2. Agent registry entries (`scripts/lib/agent-registry.mjs`)

Registry entries carry `command`, `displayName`, `category`, `defaultPriority`, `timeoutMs`, `dependencies`; schedule lives ONLY in `agent_schedules` (1c). Relevant entries (line -> command):

| line | id | command | notes |
|---|---|---|---|
| 69 | `sync-goods-ghl` | `node --env-file=.env scripts/sync-goods-ghl.mjs --apply` | reads 3 Goods GHL pipelines, writes `goods_relationships` |
| 81 | `reconcile-foundations-ghl` | `scripts/reconcile-foundations-ghl.mjs` | GHL -> `org_project_foundations.ghl_*` |
| 183 | `sync-ghl-to-tracker` | `scripts/sync-ghl-to-tracker.mjs` | unscheduled |
| 440 | `sync-act-private-grant-rounds` | `npx tsx --env-file=.env scripts/sync-act-private-grant-rounds.mts` | SmartyGrants -> `act_private_grant_rounds` |
| 476-501 | `nightly-grant-pipeline`, `-ingest`, `-enrich`, `-finalize` | all four: `scripts/nightly-grant-pipeline.mjs` (phase comes from `agent_schedules.params`) | P2 |
| 515 | `match-foundations-for-projects` | `... --apply` | philanthropy find agent |
| 1079 | `deliver-grant-notifications` | `scripts/deliver-grant-notifications.mjs` | never scheduled, never run |
| 1087 | `send-grant-alert-digests` | `npx tsx --tsconfig apps/web/tsconfig.json scripts/send-grant-alert-digests.ts` | SaaS alert lane |
| 1179 | `sync-pipeline-to-notion` | `scripts/sync-pipeline-to-notion.mjs` | schedule disabled |
| 1221 | `score-goods-relevance` | `scripts/score-goods-relevance.mjs` | P1 Goods |
| 1229 | `score-project-rubric` | `scripts/score-project-rubric.mjs --apply` | P1 Jev; comment at `:1233-1236` records it was unscheduled until 2026-09-24 |
| 1273 | `sync-ghl-goods-buyers` | `node --env-file=.env --env-file=apps/web/.env.local scripts/sync-ghl-goods-buyers.mjs` | note the SECOND env file; last run 2026-05-13 |
| 523/531/539 | `auto-classify-llm`, `backfill-alma-fields`, `promote-foundation-programs-to-alma` | | P2 sub-steps, also registered standalone |

No registry entry contains "jev" other than `score-project-rubric` (`grep -n -i jev` = lines 1231, 1233). The other Jev scripts (`jev-charity-classify.mjs`, `jev-adjudicate-grants.mjs`, `jev-entity-match.mjs`, `scripts/jev-pilot/`) are hand-run.

The web app mirrors the registry in TypeScript: `apps/web/src/lib/agent-registry.ts:2` ("TypeScript mirror of scripts/lib/agent-registry.mjs"), read by `apps/web/src/app/api/mission-control/registry/route.ts` and `tasks/route.ts`. Two files to keep in step when agents are renamed or retired.

App files that name specific agent ids (must change if agents are renamed/retired):
- `apps/web/src/app/api/ops/health/route.ts:205-216` and `apps/web/src/app/ops/health/health-client.tsx:939` — the pipeline-health tile reads `nightly-grant-pipeline-ingest/enrich/finalize` from `agent_schedules`, `agent_tasks`, `agent_runs`, classified by `packages/grant-engine/src/pipeline-health.ts`.
- `apps/web/src/lib/services/act-funder-intelligence.ts:914` — freshness SQL over `agent_runs WHERE agent_id IN ('sync-goods-ghl', 'match-foundations-for-projects', ...)`.
- `apps/web/src/app/org/[slug]/goods/insight/page.tsx:285` and `lib/services/goods-funder-insight.ts:11` — prose naming `sync-goods-ghl`.
- `lib/services/goods-grants-triage.ts:68-74` — surface 8 shows every `agent_id ilike '%grant%'` schedule and run.

## 3. Inbound links to each surface (apps/web/src, tests and api excluded)

Method: `grep -rn -F "<pattern>" apps/web/src` filtered to `href|redirect(|push(|<Link|to=|url:`; raw dump in `scratchpad/route-links.txt`.

| Surface | Inbound sites |
|---|---|
| `/org/act/desk` | rail: `org/[slug]/_components/act-workspace-shell.tsx:86,147,359`; org root redirect `org/[slug]/page.tsx:706` (bare `/org/act` -> desk); `digest-preview/page.tsx:20,85`; digest email `lib/services/act-desk-digest.ts:50,173` (absolute URL, hard-coded `act`) |
| `/org/act/grants` | rail `act-workspace-shell.tsx:98`; One Desk `workHref` `lib/services/act-one-desk.ts:233` |
| `/org/act/funding` | rail `act-workspace-shell.tsx:97`; `[projectSlug]/funding/page.tsx:108`; `org/[slug]/projects/page.tsx:48` |
| `/org/act/pipeline` | NOT on the rail; `_components/act-operating-desk.tsx:1627`, `financial-pulse-tile.tsx:75`, `income-history-section.tsx:56`, `funding/page.tsx:30`, `org/[slug]/page.tsx:343,681`, `payables/page.tsx:75`, `projects/page.tsx:51` |
| `/org/act/intelligence` | one button `org/[slug]/page.tsx:830` |
| `/org/act/digest-preview` | **zero inbound links** (`grep -rn digest-preview` finds only the page itself) |
| `/org/act/[projectSlug]` | rail project tabs `act-workspace-shell.tsx:162,424` |
| `/org/act/goods/grants` | Goods rail `GOODS_RAIL_SECTIONS` `act-workspace-shell.tsx:335` ("Money in"); One Desk `act-one-desk.ts:233`; self `goods/grants/page.tsx:59` |
| `/org/act/goods/foundations` (+scan) | Goods rail `:335`; One Desk `act-one-desk.ts:213` (`/goods/foundations/scan`); `goods/foundations/actions.ts:63`, `page.tsx:89-102`, `scan/page.tsx:59,77` |
| `/ops/grant-recommendations` | global nav `app/components/nav.tsx:585` ("Grant Recommendations"); `/home` `home/home-client.tsx:1030,1058,1165,1207`; **public report** `reports/grant-frontier/page.tsx:579,590` (links to `/ops/...` and `/triage`); `org/[slug]/pipeline/pipeline-kanban.tsx:7-8` IMPORTS `FunderDossier`/`FunderTimeline` from `@/app/ops/grant-recommendations/*` and `:198` POSTs `/api/ops/grant-recommendations/decide`; `ops/grant-recommendations/grant-recommendations-client.tsx:369` |
| `/home` | logo `nav.tsx:242`; `home/watchlist/page.tsx:116`; `org/_components/org-sections.tsx:1275`; `org/[slug]/page.tsx:843`; `reports/youth-justice/page.tsx:1631` |

Write actions wired from the surfaces:
- GHL push button: `org/[slug]/goods/grants/push-grant-ghl-button.tsx:18` -> `POST /api/goods/grants/push-ghl` (`route.ts:29` `pushGoodsGrantToGHL` from `lib/services/goods-grant-ghl.ts`, writes `grant_opportunities.ghl_opportunity_id`, `route.ts:46-47`).
- Pursue -> GHL: `org/[slug]/funding/pursue-funding-form.tsx:15` -> `POST /api/ops/funding/pursue` -> `funding-ghl.ts:17-37` (`org_projects`, `act_grant_recommendations_current`, `funding_ghl_handoffs`, `act_grant_recommendation_decisions`).
- Notion brief: `pursue-funding-form.tsx:35` -> `POST /api/ops/funding/notion-brief` -> `funding-notion.ts:34-52` (env `NOTION_TOKEN`, `NOTION_OPPORTUNITIES_DB_ID`; needs a succeeded handoff).
- Notion sync: `ops/grant-recommendations/grant-recommendations-client.tsx` -> `POST /api/ops/grant-recommendations/sync-notion` (`route.ts:161-215`, `act_grant_recommendations` + `_decisions.notion_page_id`).
- Decide: `grant-recommendations-client.tsx` and `pipeline-kanban.tsx:198` -> `POST /api/ops/grant-recommendations/decide` (`route.ts:55-140`: `_decisions`, `alma_funding_opportunities`, `grant_opportunities` incl. `aligned_projects: [projectCode]` at `:96`, `saved_grants`).

Redirect precedents already in the tree: `org/[slug]/page.tsx:706` (`/org/act` -> `/desk` unless a legacy `?view=` param), `org/[slug]/contacts/page.tsx:27` (`contacts` -> `people` for ACT), `org/[slug]/barkly/page.tsx:22`. `apps/web/next.config.*` has no `redirects()` (grep = 0). `middleware.ts:57-66` gates `/home`, `/ops`, `/org` etc. behind auth.

## 4. Tests

CI (`.github/workflows/ci.yml`): `typecheck` (`cd apps/web && npx tsc --noEmit`), `Unit & Integration Tests` (`cd apps/web && pnpm test` = `vitest run`, `apps/web/package.json:11`), `E2E Tests` (`pnpm test:e2e` = Playwright), `Migration Parity` (`check-migration-parity.mjs`, `check-private-exposure.mjs`, `check-data-contradictions.mjs`). **CI does not run `node --test scripts/lib/*.test.mjs` nor `packages/grant-engine/tests`** (no such `run:` line).

Vitest files that cover this system (`vitest.config` include: `tests/**/*.test.{ts,tsx}`, `src/**/*.test.{ts,tsx}`):
- `apps/web/src/lib/act-grant-eligibility.test.ts` (surface 2 eligibility)
- `apps/web/src/lib/services/act-grants-desk.test.ts` (surface 2)
- `apps/web/tests/unit/lib/services/funding-ghl.test.ts`, `funding-notion.test.ts`, `funding-weekly-digest.test.ts` (surface 3 writes + weekly cron)
- `apps/web/tests/unit/lib/services/project-funding-service.test.ts` (surfaces 3, 7)
- `apps/web/tests/unit/lib/opportunity-intelligence.test.ts`, `tests/unit/api/opportunity-intelligence/actions-route.test.ts`
- `apps/web/src/lib/vercel-config.test.ts` (cron path guard)
- `apps/web/src/lib/table-readers.test.ts:7-15` — committed `table-readers.generated.json` must equal what `collectTableReaders` finds; removing or adding a reader file requires `UPDATE_TABLE_READERS=1 npx vitest run src/lib/table-readers.test.ts`
- Goods: `goods-warmth-lockstep.test.ts`, `goods-funder-insight.test.ts`, `goods-proof.test.ts`, `goods-capital-workspace.test.ts` etc. (surfaces 8-9 adjacent)
- **No vitest covers** `act-one-desk.ts`, `act-project-grants-triage.ts`, `goods-grants-triage.ts`, `act-desk-digest.ts`, `act-ghl-task-bridge.ts`, `goods-grant-ghl.ts` (grep of test imports = 0 for each).

E2E: `apps/web/tests/e2e/act-field-desk.spec.ts` visits `/org/act`, `?walkthrough=1`, `?view=today`, `?view=pipeline&commitment=...#pipeline`, `?view=relationships#relationships` (lines 5-256) — the LEGACY org-root views kept alive by the `?view=` escape at `org/[slug]/page.tsx:705`. `public-smoke.spec.ts` covers public routes. Fixtures: `lib/services/act-e2e-fixtures.ts` (`/grants/e2e-goods-grant` at `:111,180`).

Scripts tests (node --test, hand-run): `scripts/lib/goods-relevance.test.mjs`, `project-relevance.test.mjs` (P1 scorers, 25/25 per handoff), `grant-eligibility-verdict.test.mjs`, `project-funding-fit.test.mjs`, `grant-deadline-update.test.mjs`, `grant-amounts.test.mjs`; `packages/grant-engine/tests/pipeline-health.test.ts` (asserts on `nightly-grant-pipeline-ingest` health classification used by `/ops/health`), `smartygrants.contract.test.ts` (fixture-based, no network).

## 5. Landing path: classify-changes.sh, precheck.sh, one-pr

`scripts/classify-changes.sh:38`:
```
SAFE_RE='^(data/(linkage-baseline|contradiction-baselines|completion-receipts)\.json$|data/jev-check/|scripts/|migrations/|docs/|thoughts/|supabase/|\.github/|\.claude/|[^/]*\.md$|apps/web/src/lib/|apps/web/src/app/api/|apps/web/src/app/ops/|apps/web/src/app/admin/|apps/web/tests/|.*\.test\.(ts|tsx)$|apps/web/package\.json$|package\.json$)'
```
Precisely: **`apps/web/src/lib/services/...` is SAFE** (prefix `apps/web/src/lib/`); **`apps/web/src/app/org/[slug]/...` is VISIBLE** (no `org/` prefix in the regex; the script fails toward VISIBLE, `:11-12`). Also SAFE: `apps/web/src/app/ops/` (so surface 10 and its Notion sync route are SAFE), `apps/web/src/app/api/` (every cron and write route), any `*.test.ts(x)` anywhere, `apps/web/tests/`, `scripts/`, `supabase/`, `.claude/`, `docs/`, `thoughts/`, root `*.md`, `vercel.json` is NOT listed (a `vercel.json` change classifies VISIBLE). It counts untracked files (`:24-30`), so a stray file makes the sitting VISIBLE. Note the file's own header still says `/ship-merge` (`:2`).

`scripts/precheck.sh`: tsc (`:29`) then `vitest run` (`:38`); a `next build` only when the diff touches `package.json`, lockfile, `next.config.*`, `app/layout.tsx` or `middleware.ts` (`:47-53`); refuses to build while a dev server holds :3003 or :3013 (`:70-77`). `--fast` = typecheck only, never for a push (`:6`).

`.claude/skills/one-pr/SKILL.md`: one branch per sitting off `origin/main` (step 1), commit per fix locally with no attribution (step 2), gate once with precheck (step 3), `git push -u origin HEAD` + `gh pr create` + classify (step 4): SAFE -> `node scripts/ship-watch.mjs --pr <n> --merge` in the background; VISIBLE -> verify routes on the local dev server, watcher without `--merge`, one preview link, Ben's "good"/"land" then `gh pr merge --squash --delete-branch`. Step 5: Playwright on civicgraph.app (curl gets 429). Still Ben's words: `/db-apply`, force-push, branch deletes, anything reaching an external system or inbox; `/money-audit` before step 3 on money surfaces. `scripts/ship-watch.mjs:1-36` documents the stale-check guard (two green polls, `--match-head-commit`). Repo has no branch protection; auto-merge disabled (jev handoff note).

Consequence for a collapse: the page moves under `apps/web/src/app/org/[slug]/` are VISIBLE and wait for Ben's preview; the service, API, ops, cron-route, script, migration and test changes are SAFE and self-merge. One PR that mixes both is VISIBLE as a whole. `vercel.json` and `crontab` changes are outside the classifier's SAFE list (and crontab is outside git entirely).

## 6. Periphery state right now

```sql
SELECT 'digest_log' AS tbl, count(*) AS n, max(sent_at)::text AS latest FROM digest_log
UNION ALL SELECT 'funding_weekly_cycles', count(*), max(generated_at)::text FROM funding_weekly_cycles
UNION ALL SELECT 'ghl_task_bridge', count(*), max(created_at)::text FROM ghl_task_bridge
UNION ALL SELECT 'funding_ghl_handoffs', count(*), max(updated_at)::text FROM funding_ghl_handoffs
UNION ALL SELECT 'act_grant_recommendation_decisions', count(*), max(decided_at)::text FROM act_grant_recommendation_decisions
UNION ALL SELECT 'decisions.notion_page_id set', count(notion_page_id), NULL FROM act_grant_recommendation_decisions
UNION ALL SELECT 'decisions.ghl_opportunity_id set', count(ghl_opportunity_id), NULL FROM act_grant_recommendation_decisions
UNION ALL SELECT 'grant_notification_outbox', count(*), max(created_at)::text FROM grant_notification_outbox
UNION ALL SELECT 'grant_notification_outbox.sent', count(*) FILTER (WHERE sent_at IS NOT NULL), NULL FROM grant_notification_outbox
UNION ALL SELECT 'grant_opportunities.ghl_opportunity_id set', count(ghl_opportunity_id), NULL FROM grant_opportunities
UNION ALL SELECT 'grant_opportunities.aligned_projects nonempty', count(*) FILTER (WHERE cardinality(aligned_projects) > 0), NULL FROM grant_opportunities
UNION ALL SELECT 'grant_opportunities open+tagged', count(*) FILTER (WHERE cardinality(aligned_projects) > 0 AND status='open'), NULL FROM grant_opportunities
UNION ALL SELECT 'act_private_grant_rounds', count(*), max(updated_at)::text FROM act_private_grant_rounds
UNION ALL SELECT 'act_grant_recommendations (MV)', count(*), NULL FROM act_grant_recommendations
UNION ALL SELECT 'act_grant_recommendations_current', count(*), max(computed_at)::text FROM act_grant_recommendations_current
UNION ALL SELECT 'org_pipeline grant rows', count(*) FILTER (WHERE opportunity_type='grant'), max(updated_at)::text FROM org_pipeline
```
(the column alias must not be `t`: gsql.mjs wraps the query in `row_to_json(t)`; an alias `t` throws `function row_to_json(text) does not exist`.)

| table | rows | latest |
|---|---|---|
| `digest_log` | 3 | 2026-09-21 21:00:43Z (desk digest sends only on delta or Monday) |
| `funding_weekly_cycles` | 8 | 2026-09-21 00:00:33Z (weekly cron is running; nothing reads it but `/org/act/funding`) |
| `ghl_task_bridge` | 8 | 2026-09-14 21:01Z |
| `funding_ghl_handoffs` | **0** | the `/org/act/funding` pursue -> GHL path has never been used |
| `act_grant_recommendation_decisions` | 89 | last decision 2026-07-28 (surface 10 / kanban decisions stopped two months ago) |
| `_decisions.notion_page_id` set | **0** | Notion sync route has never written a page id |
| `_decisions.ghl_opportunity_id` set | 0 | |
| `grant_notification_outbox` | 771 | 2026-05-15; `sent_at` set on **0** |
| `grant_opportunities.ghl_opportunity_id` set | 725 | Goods push-GHL (and older seeders) have linked 725 rounds |
| `grant_opportunities.aligned_projects` non-empty | 559 | P1 tags; **78 open+tagged** |
| `act_private_grant_rounds` | 665 | 2026-09-22 (weekly SmartyGrants sync live) |
| `act_grant_recommendations` MV | 35,761 | |
| `act_grant_recommendations_current` | 6,157 | computed 2026-09-23 20:35Z (finalize phase ran) |
| `org_pipeline` grant rows | 75 | 2026-08-01 (auto-pass cron keeps touching these) |

## 7. Findings (what is broken or double-wired today)

7.1 **Two schedulers run one schedule table.** PM2 `orchestrator` (`agent-orchestrator.mjs`) and the 6-hourly crontab `scheduler.mjs` both read `agent_schedules`. The crontab one ignores `params.phase` (`scheduler.mjs:76`), so it launches the P2 monolith 93 times to date, each dying in <1s (`logs/scheduler.log:75514-75517`) and leaving a `timed_out` row under `nightly-grant-pipeline`, whose schedule row is `enabled=false`. The `/ops/health` tile reads only the three phase ids, so the failure is invisible there.

7.2 **`sync-goods-ghl` has failed every orchestrator run since 2026-09-05** (42 failed / 24 success since 09-01: `SELECT status, count(*), min(started_at), max(started_at) FROM agent_runs WHERE agent_id='sync-goods-ghl' AND started_at > '2026-09-01' GROUP BY status`). Error: `GHL API 401 ... {"statusCode":401,"message":"Invalid Private Integration token"}` on `/opportunities/pipelines` and `/opportunities/search`. Cause, verified: the PM2 process env carries a GHL_API_KEY whose md5 prefix is `84fb314c`, while `.env` holds `7203f47d` (identical to act-global `.env.local` GHL_PRIVATE_TOKEN) and `apps/web/.env.local` holds a third key `98b715e4`. Node's `--env-file` does not override a variable already in the environment, so orchestrator children inherit the dead key; the crontab scheduler starts from a fresh shell and succeeds (`logs/scheduler.log` "Done: sync-goods-ghl" at 02:00 and 14:00 UTC = the `0 */6` ticks; agent_runs successes at exactly 2026-09-22 02:00:05 and 14:00:12). Both `.env` keys answer 200 on `GET /locations/{id}` and `GET /opportunities/pipelines` right now (read-only curl, status only). Fix is a PM2 restart with a clean env (or `pm2 restart orchestrator --update-env` after unsetting), not a code change. The same PM2 env shadowing will hit every agent that needs a rotated secret (Notion, Resend, JEV).

7.3 **The Notion side is dormant and the GHL-from-funding side has never fired.** `funding_ghl_handoffs` = 0, `notion_page_id` set on 0 decisions, `sync-pipeline-to-notion` disabled since 2026-08-09, `sync-act-opportunities-to-notion.mjs` unregistered. `docs/specs/grants-notion-handoff-spec.md:7-12` rules "nothing lands in Notion automatically" and Notion pages come from `/make-the-ask`. The only live Notion writer is the manual button on surface 10.

7.4 **SmartyGrants sync is live weekly** (`sync-act-private-grant-rounds`, 168h, enabled, 627 found / 17 new on 2026-09-22) despite Our Community's ToU cl 2(i); the script header (`scripts/sync-act-private-grant-rounds.mts:5-8`) records Ben's 2026-09-14 choice and says to stop it by disabling the schedule if they say no. Memory `project_act_grant_system` says the permission email was sent 2026-09-14 and is unanswered.

7.5 **The SaaS alert lane still runs and still sends nothing**: `scout-grants-for-profiles` daily (1030 found/3 new), `send-grant-alert-digests` weekly (0 items), `grant_notification_outbox` 771/0 sent, `deliver-grant-notifications` never scheduled. This is the "sixth channel" memory `project_act_funding_radar` warns against; it is debris from the 2026-04-24 scope cut. `/home/page.tsx:368` reads the outbox.

7.6 **Surface 10 is reachable from a public report**: `apps/web/src/app/reports/grant-frontier/page.tsx:579,590` links a visitor to `/ops/grant-recommendations` and `/triage` (middleware bounces them to login, but the link is public-facing).

7.7 **Surface 6 (`/org/act/digest-preview`) has zero inbound links**; surface 4 (`/org/act/pipeline`) is not on the rail but has eight inbound links from the org root and finance tiles; surface 5 (`/org/act/intelligence`) has one button from the legacy org root.

7.8 The desk digest email hard-codes `https://civicgraph.au` fallback and `/org/act/desk` (`act-desk-digest.ts:12,173`): a route rename breaks every emailed link.

7.9 `act_grant_recommendations` is refreshed by two independent jobs (pg_cron 17:00 UTC via `mv_refresh_registry`, and `nightly-grant-pipeline-finalize` step 8 ~20:30 UTC). Harmless today; if P2 is retired the registry row (tier nightly) keeps refreshing a view nothing reads, silently.

7.10 `act-auto-pass-stale-pipeline` (pg_cron, 04:00 UTC) mutates `org_pipeline` daily and exists only in the database (no migration file in `supabase/migrations/`), so a redesign that drops `org_pipeline` grant rows must unschedule it by hand: `SELECT cron.unschedule('act-auto-pass-stale-pipeline')` via `/db-apply`.

## 8. Checklist: every place that must change or be checked if the ten surfaces collapse into one

Group A: routes, redirects, nav (VISIBLE per classify-changes.sh)
- [ ] Decide the kept route. Add `redirect()` stubs (precedent `org/[slug]/contacts/page.tsx:27`) for retired ones: `desk`, `grants`, `funding`, `pipeline`, `intelligence`, `digest-preview`, `goods/grants`, `goods/foundations` (+`/scan`), and `ops/grant-recommendations` (+`/triage`), or delete the directories and let `notFound` answer. `next.config` has no `redirects()`; `middleware.ts` needs no change (prefix gate).
- [ ] Org-root redirect `org/[slug]/page.tsx:706` (`/org/act` -> `/desk`) and its `?view=` escape (`:705`) that the E2E spec depends on.
- [ ] ACT rail `act-workspace-shell.tsx:86,97,98` (One Desk / Funding / Grants) and `GOODS_RAIL_SECTIONS` `:335` ("Money in": foundations, foundations/scan, grants, money); mobile rail `:232-250`.
- [ ] Global nav `app/components/nav.tsx:585` "Grant Recommendations"; `/home` cards `home/home-client.tsx:1030,1058,1165,1207`.
- [ ] Cross-surface links: `act-one-desk.ts:213,233` (`workHref` to goods/foundations/scan, goods/grants, grants); `[projectSlug]/funding/page.tsx:108`; `projects/page.tsx:48,51`; `funding/page.tsx:30`; `act-operating-desk.tsx:1627`; `financial-pulse-tile.tsx:75`; `income-history-section.tsx:56`; `payables/page.tsx:75`; `org/[slug]/page.tsx:343,681,830`; `digest-preview/page.tsx:20,85`.
- [ ] Public report `reports/grant-frontier/page.tsx:579,590` links to `/ops/grant-recommendations[/triage]`.
- [ ] `pipeline-kanban.tsx:7-8` imports components from `@/app/ops/grant-recommendations/` and `:198` posts to its decide route: moving surface 10 breaks surface 4 at compile time (tsc catches it).

Group B: digests and email (SAFE)
- [ ] `vercel.json:43-50` crons `desk-digest` (21:00 UTC) and `funding-weekly-digest` (Monday 00:00); `vercel-config.test.ts` fails if a route disappears but not if a cron becomes pointless.
- [ ] `act-desk-digest.ts:12,50,173` hard-coded desk URLs in the email; `act-ghl-task-bridge.ts` task titles/keys derived from desk rows (`ghl_task_bridge` 8 rows).
- [ ] `funding-weekly-digest.ts` writes `funding_weekly_cycles` that only `/org/act/funding` reads; retire the cron with the page or re-point the reader.
- [ ] `digest_log` (3 rows), `funding_weekly_cycles` (8): keep or drop with their writers.
- [ ] `docs/specs/grants-digest-spec.md` ("nothing in the digest that is not on the desk") must still be true of the new surface.
- [ ] Env on Vercel: `RESEND_API_KEY`, `DESK_DIGEST_TO`, `DESK_DIGEST_FROM`, `CRON_SECRET`, `GHL_TRIAGE_CONTACT_ID` (`/config-truth`).

Group C: Notion (SAFE)
- [ ] `POST /api/ops/grant-recommendations/sync-notion` (`route.ts`, 238 lines) + its button in `grant-recommendations-client.tsx`; `funding-notion.ts` + `POST /api/ops/funding/notion-brief` + `pursue-funding-form.tsx:35`; `scripts/sync-act-opportunities-to-notion.mjs` (unregistered), `scripts/sync-pipeline-to-notion.mjs` (registry `:1179`, schedule disabled). `_decisions.notion_page_id` is 0 everywhere, so nothing is lost by retiring these; `docs/specs/grants-notion-handoff-spec.md` says Notion pages come from `/make-the-ask` (`.claude/skills/make-the-ask/SKILL.md`).
- [ ] Env: `NOTION_TOKEN`, `NOTION_OPPORTUNITIES_DB_ID`.

Group D: GHL (SAFE code, Tier 3 for any live write)
- [ ] `POST /api/goods/grants/push-ghl` + `push-grant-ghl-button.tsx` + `goods-grant-ghl.ts` (725 rounds already carry `ghl_opportunity_id`; One Desk uses it as the "in GHL" signal at `act-one-desk.ts:224`). The new surface needs the same pursue -> GHL path or the desk loses its Ask state.
- [ ] `POST /api/ops/funding/pursue` + `funding-ghl.ts` + `funding_ghl_handoffs` (0 rows, never used): retire.
- [ ] `act-ghl-task-bridge.ts` (desk-digest cron) and `GHL_TRIAGE_CONTACT_ID`.
- [ ] Agents: `sync-goods-ghl` (12h, failing under PM2, 7.2), `reconcile-foundations-ghl` (24h), `sync-ghl-to-tracker` (unscheduled), `seed-goods-grants-ghl.mjs` (unregistered; reads `act_grant_recommendations`, so it dies with P2), `sync-ghl-goods-buyers` (loads `apps/web/.env.local` too).
- [ ] Fix the PM2 env before trusting any GHL-fed tile: restart `orchestrator` with a clean environment; `.env`, `apps/web/.env.local` and act-global `.env.local` hold three different keys (two verified live).
- [ ] `.claude/skills/make-the-ask/SKILL.md:19` and memory `three_pipeline_architecture`: GHL stays the system of record for Ask state.

Group E: crons and schedulers (Tier 2/3, partly outside git)
- [ ] `agent_schedules`: decide per row (`score-goods-relevance`, `score-project-rubric`, the three `nightly-grant-pipeline-*` phases, the disabled monolith, `match-foundations-for-projects`, `reconcile-foundations-ghl`, `sync-goods-ghl`, `sync-act-private-grant-rounds`, `scout-grants-for-profiles`, `send-grant-alert-digests`, `sync-pipeline-to-notion`). Changes are `UPDATE agent_schedules` via `/db-apply` or a migration; the orchestrator reads them live.
- [ ] Remove or fix the crontab `scheduler.mjs` line (`crontab -l`), or make `scheduler.mjs:76` honour `params.phase`; otherwise every retained schedule keeps double-running with a different env.
- [ ] pg_cron: `expire-closed-grant-opportunities` (keep if `grant_opportunities.status` still gates the surface), `act-auto-pass-stale-pipeline` (unschedule with `org_pipeline` grant rows; no migration owns it), `mv_refresh_registry` row for `act_grant_recommendations` (disable if P2 is retired: `UPDATE mv_refresh_registry SET enabled=false WHERE mv_name='act_grant_recommendations'`).
- [ ] `ecosystem.config.js` unchanged unless the orchestrator itself changes; PM2 apps `reap-dev-servers`, `db-saturation-snapshot` are unrelated.
- [ ] Registry: `scripts/lib/agent-registry.mjs` entries listed in section 2 plus the TS mirror `apps/web/src/lib/agent-registry.ts`; mission-control routes read the mirror.

Group F: pipelines and data
- [ ] P1 writers of `aligned_projects` (14 script files: `scripts/score-goods-relevance.mjs`, `score-project-rubric.mjs`, `score-project-relevance.mjs`, `lib/goods-relevance.mjs`, `lib/project-relevance.mjs`, `promote-grant-opportunities-to-alma.mjs`, `scout-grants-for-profiles.mjs`, `sync-act-private-grant-rounds.mts`, `sync-austender-open-tenders.mjs`, plus two one-off seeds) and one app writer (`decide/route.ts:96`). If P2 is retired, `decide/route.ts` still writes `aligned_projects` from a P2 decision.
- [ ] P2 readers of `act_grant_recommendations*` in the app (13 files: `home/page.tsx`, `home-client.tsx`, `ops/grant-recommendations/page.tsx`, `org/[slug]/pipeline/page.tsx`, `reports/grant-frontier/page.tsx`, `act-atlas-context.ts`, `act-project-apply-now.ts`, `ask-grantscope-corrections.ts`, `funding-ghl.ts`, `funding-weekly-digest.ts`, `org-pipeline-service.ts`, `project-funding-service.ts`, `sync-notion/route.ts`) and the plugin skill `~/Code/act-claude-plugins/plugins/act-money-brain/skills/act-grant-triage.md:11-41` (`/find-grants` reads the MV directly).
- [ ] `v_funding_opportunities` (memory `solution_unified_funding_view`) is the sanctioned read of a fundable thing; the collapsed surface should read it or `grant_opportunities` + `act_private_grant_rounds`, not both pipelines.
- [ ] `act_private_grant_rounds` (665 rows, RLS, service-role only): keep the UNION in `act-grants-desk.ts` or drop the SmartyGrants agent per Our Community's answer.
- [ ] Tables with no remaining reader after the collapse: `funding_ghl_handoffs`, `funding_weekly_cycles`, `grant_notification_outbox`, `ghl_task_bridge` (if the bridge goes), `org_pipeline` grant rows.

Group G: tests and guards (SAFE)
- [ ] `apps/web/src/lib/table-readers.generated.json` must be regenerated (`UPDATE_TABLE_READERS=1 npx vitest run src/lib/table-readers.test.ts`) whenever a reader file is added or removed, or CI fails.
- [ ] `vercel-config.test.ts` when crons change; `act-grants-desk.test.ts`, `act-grant-eligibility.test.ts`, `funding-ghl.test.ts`, `funding-notion.test.ts`, `funding-weekly-digest.test.ts`, `project-funding-service.test.ts` follow their services.
- [ ] E2E `tests/e2e/act-field-desk.spec.ts` drives `/org/act?view=...` legacy views; retiring the `?view=` escape at `org/[slug]/page.tsx:705` breaks it.
- [ ] `packages/grant-engine/tests/pipeline-health.test.ts` and `/ops/health` (`api/ops/health/route.ts:205-216`, `health-client.tsx:939`) assume the three phase agent ids exist.
- [ ] `scripts/lib/goods-relevance.test.mjs`, `project-relevance.test.mjs` are node --test and not in CI; run them by hand after any scorer change (handoff test line).
- [ ] Add a vitest for the surviving desk/triage service: today `act-one-desk.ts`, `act-project-grants-triage.ts`, `goods-grants-triage.ts`, `act-desk-digest.ts` have none.

Group H: docs, skills, memory
- [ ] `CONTEXT.md:118` ("One Desk (`/org/act/desk`)" screen ownership) and the "Money surfaces (`/org/act/goods/*`)" section below it.
- [ ] `docs/specs/one-desk-widened-ux-spec.md`, `grants-digest-spec.md`, `grants-notion-handoff-spec.md`, `delivery-surfaces-ux-spec.md`, `people-surface-ux-spec.md`; `docs/strategy/act-money-surface-audit-2026-08-07.md:156-375`; `docs/ux-audit/admin-ux-findings.md:3-42`; `docs/strategy/goods-relationship-led-funding-intelligence.md`.
- [ ] Skills: `.claude/skills/make-the-ask/SKILL.md`, `.claude/skills/polish/SKILL.md:44`; plugin `act-money-brain` (`commands/find-grants.md`, `skills/act-grant-triage.md`).
- [ ] Handoffs naming the surfaces (7 files under `thoughts/`, incl. `act-grant-desk/current.md`, `act-money-surface/current.md`, `goods-opportunities/current.md`); memory files `project_act_grant_system`, `project_act_funding_radar`, `project_act_money_surface`, `project_act_opportunity_engine`, `project_goods_command_center`.

Group I: what needs Ben's words
- [ ] Crontab edit and PM2 restart (his machine, outside git).
- [ ] Any `agent_schedules` / `cron.unschedule` / `mv_refresh_registry` change (`/db-apply`).
- [ ] Disabling `sync-act-private-grant-rounds` (his 2026-09-14 choice) once Our Community replies.
- [ ] Merging the VISIBLE PR that moves the `/org/act/*` pages.
