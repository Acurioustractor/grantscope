# Follow-up reader: the sibling repos' hands on the money tables

Reader: sibling-repos-money-tables. Date: 2026-09-24. Read-only. Repos read:
`/Users/benknight/Code/act-global-infrastructure` (main @ e5f9156, 2026-09-07),
`/Users/benknight/Code/justicehub` (branch feat/empathy-ledger-accountability-events @ 98c8f536, remote
`Acurioustractor/justicehub-platform`), `/Users/benknight/Code/grantscope` (feat/act-money-desk).
Every SQL below ran through `node --env-file=.env scripts/gsql.mjs` from grantscope today. Every `gh run`
call was read-only (`gh run list`, `gh run view --log`).

## 0. Verdict in one screen

The picture the ten readers and the critic carried into this brief is inverted on almost every point.

1. **act-global's GitHub Actions grant lane is dead, and hides it.** `sync-ghl.yml` has 0 successes in its
   last 100 runs (GHL answers `401 Invalid Private Integration token`). `scheduled-syncs.yml`'s `sync-ghl`
   job has failed every day since at least 2026-08-25. Its `run-alta` job (the "grantscope -> Notion daily
   sync") prints `Error fetching grants: Legacy API keys are disabled` on every run I opened (2026-09-01 and
   2026-09-23) and is wrapped in `continue-on-error: true`, so the workflow reports it as `success`. Its
   `grant-hygiene` job fails Notion with `API token is invalid`, also behind `continue-on-error`.
   `weekly-digest.yml` fails at `pnpm install` (unknown option). `master-automation.yml` fails at step 1.
   `alta-grant-scout.yml` succeeds weekly and prints `No grants in pipeline.` The critic's §2.4 ("From
   act-global, no [Notion is not dormant]") is wrong in effect: nothing from act-global has reached the
   Notion Grant Pipeline Tracker since legacy JWT keys were disabled.
2. **The live GHL mirror writer is PM2 on Ben's Mac, not GitHub Actions.** PM2 app `ghl-sync`
   (`cron_restart: 0 */6 * * *`, AEST) fires at 02:00/08:00/14:00/20:00 UTC, matching `ghl_sync_log`
   to the second. PM2 shows cron apps as `stopped` between ticks; the critic read that as "all stopped ->
   live automation is GitHub Actions", which is backwards. `ghl-sync` was `online` (mid-run) at 18:00 AEST
   while I wrote this.
3. **JusticeHub does not write ALMA.** `weekly-funding-scrape.yml` runs weekly on the self-hosted `jh`
   runner; `scripts/alma-funding-scrape.mjs` exits with `Missing required environment variables:` because it
   never loads the `.env.local` the workflow writes, and `| tee` swallows the exit code, so the job is
   `success`. Proof in the table: 0 rows carry the scraper's `scrape_source` values; 23,647 of 23,705
   (99.8%) rows are grantscope's promotion scripts; the 26 null-source rows are act-global's Xero "won"
   backfill. `alma-ingestion.yml` (Mon/Thu) runs `alma-scheduler.mjs`, which has 0 references to the table.
   JusticeHub owns the table by seed and by DDL; grantscope is the de-facto writer.
4. **JusticeHub's funding workspace holds no decisions grantscope lacks.** The 13,409-line
   `funding-operating-system.ts` and 20 `/admin/funding/**` pages sit on tables with 2, 2, 34, 3, 2 and 5
   rows, most last touched March 2026.
5. **`opportunities_unified` has no writer anywhere.** Its three writers exist and none is invoked by any
   workflow, `package.json` script, PM2 app, crontab or launchd plist. The command-center UI write route
   logged 4 stage changes, last 2026-03-17. Eight command-center routes plus the finance ledger still read
   it and show June-2026 numbers. Freeze changes nothing; drop breaks those tiles.
6. **`grant_opportunities.ghl_opportunity_id` is written by exactly one repo, act-global, by two unscheduled
   scripts, in two key shapes by design**: `sync-grants-ghl.mjs` stamps the *mirror UUID* when it links or
   creates from `ghl_opportunities` rows, and the *real GHL id* when it pushes a grant into GHL;
   `seed-ghl-grants.mjs` stamps the real id. grantscope and JusticeHub write nothing into that column.
   Every UUID-shaped value resolves to a mirror row (280/280, 7/7, 1/1, 2/2 per day-bucket).
7. **`ghl_opportunities.project_code` is act-global's, assigned by three manual scripts** against
   `config/project-codes.json` (78 codes), plus a literal `WATCH` (141 rows) for bot-scraped grants.
   grantscope's `act_grant_recommendation_projects` knows 12 codes; the GHL Grants + GOODS-Funding rows use
   22 distinct values, 13 of them unknown to grantscope. The 6-hourly sync never touches the column, so the
   tags persist.

## 1. Which schedulers actually run (verified)

### 1.1 GitHub Actions, act-global (`gh run list -R Acurioustractor/act-global-infrastructure -w <file> -L 5`)

| workflow | cron (UTC) | last 5 conclusions | what failed (from `gh run view --log`) |
|---|---|---|---|
| `scheduled-syncs.yml:10` `0 20 * * *` | daily 06:00 AEST | failure x5 (09-19..09-23); failure every day 08-25..09-23 (30-run window) | job `sync-ghl` step "Run GHL Sync": `GHL API Error (401) Invalid Private Integration token`. Job `run-alta` (`:273 node scripts/sync-grantscope-to-notion.mjs`, `:274 continue-on-error: true`): `Error fetching grants: Legacy API keys are disabled` (runs 35929474522 on 09-23 and 33565802260 on 09-01). Job `grant-hygiene` (`:303 auto-archive-expired-grants.mjs`, `:304 continue-on-error`): `@notionhq/client ... code: 'unauthorized', message: 'API token is invalid.'` |
| `sync-ghl.yml:6` `0 */6 * * *` | 4x daily | failure x5 (latest 2026-09-24T02:27Z); **0 successes in last 100 runs** | step "Run GHL -> Supabase sync" (`:38 npm run sync:ghl:supabase`): same 401. Step `:46 npm run sync:ghl` (GHL -> Notion) never reached (no `if: always()`); summary line shows `Notion ⚠️`. |
| `alta-grant-scout.yml:6` `0 20 * * 0` | weekly Mon 06:00 AEST | success x5 | `:50` default command `summary` -> `alta-grant-scout.mjs summary` prints `No grants in pipeline.` A no-op. |
| `daily-brief.yml:6` `0 22 * * *` | daily 08:00 AEST | success x5 | `generate-morning-brief.mjs` logs `[ProjectLoader] DB load failed, falling back to JSON config: Legacy API keys are disabled`, then `✅ Brief posted to Notion`. The one Notion write that works; it is a page, not a grant DB. Reads `communications_history, voice_notes, relationship_health, ghl_contacts, calendar_events` (no grant tables). |
| `relationship-alerts.yml:6` `30 22 * * *` | daily | success x5 | reads `ghl_contacts x8, pending_contacts, communications_history`; no grant tables. |
| `master-automation.yml:6` `0 5 * * *` | daily | failure x5 | fails at step 1 "Sync GitHub Issues to Notion". Touches no money table (issues, sprint metrics, knowledge). |
| `weekly-digest.yml` `0 10 * * 0` | weekly | failure (2026-09-20) | `pnpm install --frozen-lockfile --legacy-peer-deps` -> `ERROR Unknown option: 'legacy-peer-deps'`. Would read `grant_opportunities x6, grant_applications x2`. |

`package.json:19-20`: `"sync:ghl": "node scripts/sync-ghl-to-notion.mjs"`, `"sync:ghl:supabase": "node scripts/sync-ghl-to-supabase.mjs"`.

Why Actions fails and PM2 works: `scripts/lib/ghl-api-service.mjs:688` reads
`process.env.GHL_PRIVATE_TOKEN || process.env.GHL_API_KEY`; the local `.env.local` carries the working
`GHL_PRIVATE_TOKEN` (memory: `solution_ghl_token_source_of_truth`), the Actions secret `GHL_API_KEY`
(`sync-ghl.yml:34`) is the rotten one. Inferred from the 401 text plus the precedence line; I did not read the
secret.

### 1.2 PM2 on Ben's Mac (`pm2 jlist`, 46 apps) - the writers that are alive

| app | cron_restart | script | evidence it runs |
|---|---|---|---|
| `ghl-sync` | `0 */6 * * *` (AEST) | `act-global-infrastructure/scripts/sync-ghl-to-supabase.mjs` | `pm2 describe`: restarts 85, `created at 2026-09-24T02:00:00.000Z`; `/tmp/ghl-sync-out.log` 12:17 AEST: `Contacts: Updated 3728, Errors 1; Opportunities: Updated 760; Duration 1037.2s`; status `online` at 18:00 AEST. `ghl_sync_log` rows at `02:00:00.27`, `20:00:22`, `14:00:00.18`, ... (below). |
| `verify-ghl-mirror` | `5 7 * * *` | `scripts/verify-ghl-mirror.mjs` | created 2026-09-23T21:05Z, restarts 30 |
| `daily-briefing` | `0 7 * * *` | `scripts/daily-briefing.mjs` | created 2026-09-23T21:00Z, restarts 29; reads `ghl_opportunities x2, sprint_suggestions, project_knowledge, ghl_contacts, relationship_health` |
| `money-command-digest` | `15 8 * * *` | `scripts/money-command-digest.mjs` | reads `ghl_opportunities x2, xero_invoices, v_project_money_state` |
| `contact-signals`, `relationship-health`, `gmail-sync`, `calendar-sync`, `xero-sync` ... | various | | not grant tables |

Not in PM2, not in crontab, not in launchd, not in any workflow: `sync-grants-ghl.mjs` (header `:15` says
"Cron: Runs every 6 hours"), `build-project-pipelines.mjs` (header says "Cron: daily 06:10 AEST"),
`sync-grantscope-matches.mjs` (header says "Runs daily at 5am AEST"), `generate-daily-priorities.mjs`
("Runs daily at 6:30am AEST"), `discover-grants.mjs` ("Daily cron job"). Headers lie; the data agrees
(`project_pipelines` computed_at max 2026-06-15, `sprint_suggestions` max 2026-06-15,
`opportunities_unified` updated_at max 2026-06-15).

```
$ crontab -l
0 9 * * 1  ... ACT Farm .../weekly-knowledge-review.mjs
0 */6 * * * cd /Users/benknight/Code/grantscope && node --env-file=.env scripts/scheduler.mjs   # grantscope's own
$ ls ~/Library/LaunchAgents | grep -iE "act|ghl|grant|sync"
actions.runner.Acurioustractor-empathy-ledger-v2.*.plist (x2), actions.runner.Acurioustractor-justicehub-platform.Bens-MacBook-Pro-jh.plist, com.act.git-autopull.plist
```

```sql
SELECT jobid, jobname, schedule, active, left(command,160) FROM cron.job
WHERE command ILIKE '%ghl%' OR command ILIKE '%grant%' OR command ILIKE '%alma%' OR command ILIKE '%opportun%' OR command ILIKE '%notion%'
-- 14 | expire-closed-grant-opportunities | 30 16 * * * | true | SELECT public.expire_closed_grant_opportunities()   (the only pg_cron job in this area)
```

```sql
SELECT started_at::text, operation, triggered_by, status, records_processed, records_updated FROM ghl_sync_log WHERE operation='full_sync' ORDER BY started_at DESC LIMIT 6
-- 2026-09-24 02:00:00.27+00 | full_sync | cron | success | 4499 | 4499
-- 2026-09-23 20:00:22.724   | ...       | 4499
-- 2026-09-23 14:00:00.18    | ...       | 4500
-- 2026-09-23 02:00:00.259   | ...       | 4499
-- 2026-09-22 20:00:00.265   | ...       | 4496
-- 2026-09-22 14:00:00.998   | ...       | 4496
```
`sync-ghl-to-supabase.mjs:436-450` inserts that row with `triggered_by: 'cron'` regardless of host, which is
why the log cannot distinguish PM2 from Actions; the timestamps can (Actions runs land at :27, :31, :50).

### 1.3 JusticeHub (`gh run list -R Acurioustractor/justicehub-platform`)

| workflow | cron | runner | last 5 | what actually happens |
|---|---|---|---|---|
| `alma-ingestion.yml:11` `0 2 * * 1,4` | Mon/Thu | `[self-hosted, jh]` (`:40`) | success x5 (latest 2026-09-24T06:55Z) | `:70 node scripts/alma-scheduler.mjs auto` -> `grep -c alma_funding_opportunities scripts/alma-scheduler.mjs` = 0. Interventions/evidence corpus, not funding. |
| `weekly-funding-scrape.yml:6` `0 20 * * 0` | weekly | `[self-hosted, jh]` (`:28`) | success 09-20, 09-13, 09-06; failure 08-30, 08-23 | `:60 node scripts/alma-funding-scrape.mjs ... --verbose 2>&1 \| tee funding-scrape.log`. Job 106159249741 log after the run step: `Missing required environment variables:` then artifact upload (239 bytes). Script `:19-27` requires `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from `process.env`; `grep -c "dotenv\|load-env"` = 0; the workflow writes `.env.local` (`:49-55`) but Node never reads it. `tee` masks exit 1. |
| `vercel.json:161` `/api/cron/opportunities/discover?batch=3` `0 13 * * *` | daily | Vercel | (not a GH workflow) | `src/app/api/cron/opportunities/discover/route.ts:218-219` upserts **`youth_opportunities`** (`scrape_source: 'cron_discover'` at `:212`), not ALMA. `scripts/pipelines/run.mjs:73` labels this job `table: 'alma_funding_opportunities'`, which is wrong. `youth_opportunities`: 263 rows, max updated 2026-09-01. |
| `vercel.json:9` `/api/cron/funding/system-0` `0 15 * * *` | daily | Vercel | | no `.from(` in `route.ts`; `funding_system0_events` 309 rows, max 2026-09-23, `funding_weekly_cycles` 8 rows max 2026-09-21. It runs; it is the funding-OS "system 0" digest, not a writer of the pools in scope. Not read further. |

## 2. Deliverable: job -> schedule -> reads -> writes -> vocabulary -> keep / retire / re-point

Legend for "runs": **LIVE** = verified running and writing; **DEAD-QUIET** = scheduled, runs, writes nothing
(hidden by continue-on-error / tee); **DEAD-LOUD** = scheduled and failing visibly; **MANUAL** = no scheduler
found anywhere (workflows, package.json, PM2, crontab, launchd).

| # | job (file:line) | schedule | runs | reads | writes | vocabulary it uses / imposes | verdict for ONE place |
|---|---|---|---|---|---|---|---|
| A1 | act-global PM2 `ghl-sync` -> `scripts/sync-ghl-to-supabase.mjs` | `0 */6 * * *` AEST | LIVE | GHL API (pipelines, contacts, opportunities) | `ghl_pipelines` (`:153-161` upsert on `ghl_id`), `ghl_contacts` (`:215-217`), `ghl_opportunities` (`:362-391`: ghl_id, ghl_contact_id, ghl_pipeline_id, ghl_stage_id, name, pipeline_name, stage_name, status, monetary_value, custom_fields, assigned_to, ghl_created_at, ghl_updated_at, last_stage_change_at, last_status_change_at, last_synced_at, sync_status; **never project_code / pile / acquittal cols**), soft-delete `sync_status='deleted'` (`:112`), `ghl_sync_log` (`:436-450`, `triggered_by:'cron'`) | GHL's own: `pipeline_name` x 33 groups, `stage_name`, `status` open/won/lost/abandoned | **KEEP.** It is the only thing keeping the mirror true. Move it off Ben's laptop (the `sync-ghl.yml` job exists for that; it needs the working token in the Actions secret). Retire the duplicate `scheduled-syncs.yml:35-66 sync-ghl` job. |
| A2 | act-global `sync-ghl.yml:38` (same script) | `0 */6 * * *` UTC | DEAD-LOUD (0/100) | | | | **RE-POINT**: fix `GHL_API_KEY` secret or set `GHL_PRIVATE_TOKEN`; then retire A1 or A2, not both. |
| A3 | act-global `sync-ghl.yml:46` -> `scripts/sync-ghl-to-notion.mjs` | after A2 | never reached | `ghl_contacts` tagged Partner, GHL Grants pipeline | Notion `databaseIds.partners` (`:113,:129`) and `databaseIds.grantOpportunities` (`:257,:277`) - **the `grantOpportunities` key does not exist in `config/notion-database-ids.json`** (grep count 0) | status map `:336-340` open->Prospective, won->Awarded, lost/abandoned->Declined | **RETIRE.** Broken twice over. |
| A4 | act-global `scheduled-syncs.yml:246-274 run-alta` -> `scripts/sync-grantscope-to-notion.mjs` | `0 20 * * *` | DEAD-QUIET (`Legacy API keys are disabled`, `continue-on-error`) | `grant_opportunities` via `GRANTSCOPE_SUPABASE_URL/KEY` (`:63-70,:122-125`): `.in('pipeline_stage', ['researching','pursuing','drafting','submitted'])` (`:86`) -> 29 rows today | Notion Grant Pipeline Tracker `2784ae13-61ba-4bbf-bb62-10c42c0553ee` (`config/notion-database-ids.json:15`): create `:384` / update `:364`, dedup by `[gs:<grant_opportunities.id>]` in Notes (`:150-160,:250-253`); Actions DB `177ebcf9-81cf-8023-af6e-dff974284218` (`:10`): `[Grant]`-prefixed Type=Grant rows (`:624-746`); Planning Calendar `31eebcf9-...` (`:16`): Type=Deadline rows (`:759-812`); Project Link relation via `aligned_projects` -> actProjects `177ebcf9-81cf-80dd-...` (`:6`) | `STAGE_MAP :74-83`: discovered->Discovered, researching->Researching, pursuing->Pursuing, drafting->Drafting, submitted->Submitted, awarded->Awarded, declined->Declined, archived->Archived | **RETIRE or RE-POINT (Ben decision D2).** Same Notion DB as grantscope's retired `scripts/sync-pipeline-to-notion.mjs` (`NOTION_GRANT_PIPELINE_DB` in grantscope `.env` = `2784ae13...`), which deduped by `[CG:<saved_grants.id>]` (`:147-149`) with stage names Identified/Researching/Pursuing/Submitted/Negotiating/Approved/Lost/Expired (`:9-18`). Two tag families and two Stage vocabularies already coexist in that Notion DB. |
| A5 | act-global `scheduled-syncs.yml:279-304 grant-hygiene` -> `scripts/auto-archive-expired-grants.mjs` | daily after A4 | DEAD-QUIET (Notion `API token is invalid`, `continue-on-error`) | Notion Actions DB (`:31 ACTIONS_DB = dbIds.actions`) | Notion `pages.update` (`:124`) Status -> Done for past-deadline `[Grant]` actions | Notion Status: Not started / Done | **RETIRE** with A4. |
| A6 | act-global `alta-grant-scout.yml` -> `scripts/alta-grant-scout.mjs summary` | `0 20 * * 0` | runs, no-op (`No grants in pipeline.`) | `grant_opportunities` (`:312,:404,:558`) | `scout`/`match` subcommands (not scheduled) would `update` (`:377-378`) and `upsert onConflict 'source,name'` (`:531-532`) into `grant_opportunities` | its own `source` values | **RETIRE** the workflow; keep nothing. |
| A7 | act-global `scripts/sync-grants-ghl.mjs` | MANUAL (header `:15` claims 6h; no caller) | `ghl_opportunities` where `pipeline_name='Grants'` (`:109-112`), `grant_opportunities` (`:120-121`), `grant_applications` (`:400`) | `grant_opportunities.application_status` from GHL stage (`:147-148`); **`ghl_opportunity_id = ghl.id` (mirror UUID)** on name-similarity >0.5 link (`:162-180`); creates rows from GHL with `source:'ghl_sync'`, `aligned_projects:[project_code]`, `ghl_opportunity_id: ghl.id` (mirror UUID), upsert `onConflict:'source,name'` (`:185-204`) -> 260 rows today; pushes every unlinked grant with `fit_score>=50` OR non-empty `aligned_projects` into GHL Grants pipeline `scom3L0kNwA1W0zPIzMe` under contact `AXrbvQAQKR0TcTcZL71H` (`:35-36,:311-320,:366-372`) and stamps **`ghl_opportunity_id = created.id` (real GHL id)** (`:376-377`); `grant_applications.ghl_opportunity_id` (`:438-439`); mirror `stage_name` (`:544-546`) | GHL stages `:44-52` (3 mapped: Grant Opportunity Identified / Application In Progress / Grant Submitted; Awarded/Declined/Acquittal Due are TODO); `application_status` `:55-75`: not_applied, reviewing, will_apply, in_progress, applied, submitted, successful, unsuccessful, not_relevant, next_round | **RETIRE the push, keep the idea.** This is the script that filled GHL Grants with 239 open + 52 lost rows and mixed the key column. ONE place should mint into GHL on a human "pursue", not on `fit_score>=50`. |
| A8 | act-global `scripts/seed-ghl-grants.mjs` | MANUAL | `grant_opportunities` where `ghl_opportunity_id IS NULL` | GHL create (`:124`), then `grant_opportunities.update({ghl_opportunity_id: <real id>, pipeline_stage:'researching'})` (`:102,:136`) | sets `pipeline_stage` (the field A4 selects on) | **RETIRE** into the pursue action. |
| A9 | act-global `scripts/enrich-ghl-grants.mjs` | MANUAL | `grant_opportunities` where `ghl_opportunity_id NOT NULL` (`:269`), mirror map `ghl_opportunities.id -> ghl_id` (`:206-221`) | GHL opportunity custom fields + monetaryValue only; no DB writes. Resolves UUID-shaped ids via mirror (`:203,:229-231`); header `:23-25` documents the ~22% mirror-UUID share | GHL custom fields (8 created by name) | **KEEP as a library step** behind the pursue action. |
| A10 | act-global `scripts/align-ghl-opportunities.mjs` | MANUAL | `ghl_opportunities` (`:149`), `config/project-codes.json` via `project-loader.mjs` | `ghl_opportunities.project_code` (`:217-218`) when keyword score >= 0.7 (`:5-7,:168`) | project-codes.json (78 codes, v1.8.0, updated 2026-04-24) | **RE-POINT**: the tagger must write the same code list ONE place reads. See Q4. |
| A11 | act-global `scripts/backfill-grant-project-codes.mjs` | MANUAL | `ghl_opportunities` (`:63`), `ghl_contacts` (`:76`) | `ghl_opportunities.project_code = 'WATCH'` for bot-scraped contacts `benjamin+test.*` (`:6,:90,:133-134`) | introduces `WATCH` (141 Grants rows) | **RETIRE**; the watchlist is grantscope's `discovered` stage, not a project code. |
| A12 | act-global `scripts/backfill-pile-tags.mjs` | MANUAL | `config/pile-mapping.json` | `ghl_opportunities.pile`, `grant_opportunities.pile` (`:152`) | pile: Grants/Flow/Voice/Other/Uncoded/Ground | **DECIDE** (D5): `pile` is a fourth taxonomy on the same rows. |
| A13 | act-global `scripts/sync-grantscope-matches.mjs` | MANUAL (header claims daily 5am) | grantscope `org_profiles` (`:62`), `saved_grants` (`:82`), `grant_opportunities` (`:107`) via `GRANTSCOPE_SUPABASE_*` | `opportunities_unified` insert `stage:'identified'` (`:123,:153,:193-194`) -> the 684 `source_system='grantscope'` rows (max 2026-05-08) | its own stage words | **RETIRE.** |
| A14 | act-global `scripts/sync-opportunities-to-unified-pipeline.mjs` | MANUAL (header claims daily) | `grant_opportunities` (`:56`), `ghl_opportunities` (`:86`), `fundraising_pipeline` (`:115`), last 48h unless `--full` | `opportunities_unified` upsert `onConflict:'source_system,source_id'` (`:77,:106,:136`) | identified / researching / pursuing / submitted / lost / realized / expired | **RETIRE.** |
| A15 | act-global `scripts/populate-funding-pipeline.mjs` | MANUAL | hard-coded 21 rows | `opportunities_unified` (stages pursuing/researching/identified) | | **RETIRE.** |
| A16 | act-global `scripts/align-pipeline-projects.mjs` | MANUAL | `opportunities_unified` | `opportunities_unified.project_codes` (3 writes) | | **RETIRE.** |
| A17 | act-global `scripts/build-project-pipelines.mjs` | MANUAL (header claims 06:10 daily) | `ghl_opportunities` | `project_pipelines` (63 rows, computed_at max 2026-06-15) + `thoughts/shared/reports/project-pipelines-latest.json` | project_code x pipeline_name (OLD Goods pipeline names) | **RETIRE**; a view over the mirror replaces it. |
| A18 | act-global `scripts/generate-daily-priorities.mjs` | MANUAL (header claims 6:30 daily) | `xero_invoices`, `grant_opportunities` (`:116`), `ghl_opportunities` (`:171`), `ghl_contacts`, `communications_history`, `project_knowledge`, `opportunities_unified` (`:349`) | `sprint_suggestions` (`:470-471`, 573 rows max 2026-06-15) | | **RETIRE.** |
| A19 | act-global `scripts/discover-grants.mjs` | MANUAL (header claims daily) | `grant_opportunities` | `grant_opportunities` update (`:139-140,:367-368`), `grant_applications` insert (`:207-208`, 33 rows max 2026-05-27), `grant_application_requirements` (`:286-287`) | "26 ACT projects" scoring, Telegram >70% | **RETIRE**; grantscope's Goods/JEV scorers (#519, #520) are the live scorers. |
| A20 | act-global `scripts/enrich-grant-opportunities.mjs` | MANUAL | `grant_assets`, `goods_content_library`, `project_knowledge`, `grant_opportunities` (`:352`) | `grant_opportunities` update (`:486-487`), `application_status='reviewing'` (`:563-564`), `grant_applications` insert (`:540-541`), requirements (`:579-580`) | application_status | **RETIRE** or fold into the JEV read. |
| A21 | act-global `scripts/cleanup-stale-ghl-opps.mjs` | MANUAL, dry-run lists only | `grant_opportunities`, `ghl_opportunities` | none (lists) | | keep as a report, not a job. |
| A22 | act-global `scripts/backfill-won-decisions-from-xero.mjs` | MANUAL (run once, 2026-05-16) | `xero_invoices`, `alma_funding_opportunities`, `act_grant_recommendation_decisions` | `alma_funding_opportunities` insert `status:'closed'` (`:140-144`) x26 (scrape_source NULL), `act_grant_recommendation_decisions` decision `won`, `decision_origin 'xero_invoices'`, `decision_scope 'historical_evidence'` x26 | | **KEEP the 26 rows, retire the script**; ONE place should read won-from-Xero live. |
| A23 | act-global `scripts/grants-pipeline.mjs` | MANUAL | `ghl_opportunities` x7, `grant_financial_tracking` | `ghl_opportunities` x2, `grant_financial_tracking` x2 - **table does not exist** (`relation "grant_financial_tracking" does not exist`) | Research -> Submitted -> Approved -> Received -> Acquitted | **DEAD; delete.** |
| A24 | act-global `scripts/review-pipeline.mjs` | MANUAL interactive | `ghl_opportunities`, `ghl_contacts`, `ghl_pipelines`, `projects` | `ghl_opportunities` x5, `ghl_contacts` | | keep as a human tool. |
| A25 | act-global `scripts/sync-money-framework-to-notion.mjs` | MANUAL | `xero_*`, `grant_opportunities` x6, `ghl_opportunities` x4 | Notion page create (1) | | out of scope; Notion reporting. |
| A26 | act-global `packages/notion-workers/src/index.ts` (bundle `index.js` 18 refs) | unknown (worker) | `grant_opportunities`, `ghl_contacts`, `fundraising_pipeline` | not read | | **GAP** - not read; see §6. |
| A27 | act-global command-center (Vercel project `act-global-infrastructure`, last commit to app 2026-09-06) | on request | `opportunities_unified` in `api/intelligence/route.ts:221-222`, `api/briefing/morning/route.ts:200-201`, `api/finance/weekly-review/route.ts:585-586`, `api/finance/overview/route.ts:85-92`, `api/strategy/route.ts:64-65`, `lib/finance/ledger.ts:1051,1077-1078` (`WORKED_SOURCE_SYSTEMS = ['ghl_opportunities','manual','fundraising_pipeline','ghl','xero']`), `api/finance/pipeline-update/route.ts:17-18`; also `grant_opportunities` (`api/grantscope/intelligence/route.ts` x4, morning x2, weekly-review), `ghl_opportunities`, `fundraising_pipeline` (`api/opportunities/route.ts`, `update/route.ts`) | `opportunities_unified` stage via UI (`api/finance/pipeline-update/route.ts:64-65`) + `pipeline_changes` (4 rows, last 2026-03-17) | stage filters: `not in (lost,expired,identified,closed,won,abandoned,declined)`, `in ('pursuing','submitted','negotiating','approved')`, `eq 'realized'` | **RE-POINT** each read to a view over GHL mirror + grantscope decisions; then drop the table. |
| J1 | JusticeHub `weekly-funding-scrape.yml` -> `scripts/alma-funding-scrape.mjs` | `0 20 * * 0` | DEAD-QUIET (env, tee) | grants.gov.au, business.gov.au, paulramsayfoundation (`:448-450`) | would `alma_funding_opportunities` update/insert by `source_url` or `(scrape_source, source_id)` (`:501-524`), `alma_ingestion_jobs` (`:542`) - **0 rows ever** | `scrape_source`: grants.gov.au / business.gov.au / paulramsayfoundation | **RETIRE** (Ben decision D4): grantscope already ingests GrantConnect into `grant_opportunities`; a second scraper into ALMA is the duplication the promotion scripts then re-promote. |
| J2 | JusticeHub `alma-ingestion.yml` -> `alma-scheduler.mjs` | `0 2 * * 1,4` | LIVE | research corpus | `alma_interventions/evidence/...`; 0 refs to funding table | | out of scope; keep. |
| J3 | JusticeHub `vercel.json:161` `/api/cron/opportunities/discover` | `0 13 * * *` | LIVE | web search + LLM | `youth_opportunities` (`route.ts:218-219`) | category enum art_prize/music/grant/... | out of scope; fix the label in `scripts/pipelines/run.mjs:73`. |
| J4 | JusticeHub admin API `src/app/api/admin/funding/opportunities/route.ts` | on request | | `alma_funding_opportunities` insert (`:173-174`), update (`:217-218`), archive `status='archived'` (`:253-254`) | ALMA status: open 22,200 / closed 653 / closing_soon 622 / archived 225 / upcoming 3 / recurring 2 | **KEEP read, gate write**: the only human write path onto ALMA rows besides grantscope's promotion. |
| J5 | JusticeHub funding OS `src/lib/funding/funding-operating-system.ts` (13,409 lines) + 20 pages under `src/app/admin/funding/os/**` | on request | `agent_task_queue` x85, `organizations` x25, `funding_relationship_engagements` x23, `funding_match_recommendations` x14, `alma_funding_opportunities` x14 (read only), `funding_awards` x12, ... | writes 18 tables: `agent_task_queue` (35), `funding_relationship_engagements` (12), `funding_outcome_commitments` (4), `funding_match_recommendations` (3), `funding_application_draft_workspace` (2), `alma_funding_applications` (2), `funding_awards` (2), ... | `draft_status` draft/in_review/ready_to_submit/submitted/archived (migration `20260301000004:10-11`); `relationship_status 'active'`; `recommendation_status candidate/engaged` | **LEAVE ALONE, do not merge**: 2/2/34/3/5 rows. It is a JusticeHub-tenant product surface for *other* organisations, keyed on `organizations`, not ACT's money desk. |
| G1 | grantscope `scripts/promote-grant-opportunities-to-alma.mjs` (+ foundation-programs promoter) | nightly (grantscope's scheduler; not re-read here) | `grant_opportunities`, foundation programs | `alma_funding_opportunities` `scrape_source = 'promotion-from-grant_opportunities'` (11,525) / `'promotion-from-foundation-programs'` (12,122) | | the de-facto ALMA writer (99.8%). Owner label in the seed should say so. |
| G2 | grantscope `apps/web/src/app/api/tracker/[grantId]/route.ts:62-115` `syncToGHL` | on stage change in the tracker | `saved_grants` | GHL update/create in the "grant pipeline" found by `findGrantPipeline`, `saved_grants.ghl_opportunity_id` | STAGE_TO_GHL | **never fired or never persisted**: `saved_grants.ghl_opportunity_id` is NULL on 2,916/2,916. |
| G3 | grantscope `api/ops/funding/pursue/route.ts` -> `lib/services/funding-ghl.ts` / `funding-notion.ts` | on pursue | | `funding_ghl_handoffs` (0 rows), `act_ask_warmers` (0 rows) | | the intended mint path; unused so far. |

## 3. The six questions

### Q1. Who writes `grant_opportunities.ghl_opportunity_id`, in which key shape?

Only act-global, only manually, two shapes by design:

- `scripts/sync-grants-ghl.mjs:109-112` reads the **mirror** (`ghl_opportunities` where `pipeline_name='Grants'`);
  `:162-180` links a grant to a mirror row by name similarity > 0.5 and writes `ghl_opportunity_id: ghl.id`,
  which is the mirror row's Supabase `id` (UUID). `:185-204` creates `grant_opportunities` rows from unmatched
  mirror rows with `source:'ghl_sync'`, `discovered_by:'ghl_sync'`, `ghl_opportunity_id: ghl.id` (UUID),
  `aligned_projects: [ghl.project_code]`, upsert `onConflict:'source,name'`.
- `:311-320` selects every grant with `ghl_opportunity_id IS NULL AND (fit_score >= 50 OR aligned_projects
  non-empty)`, `:366-372` creates a GHL opportunity in pipeline `scom3L0kNwA1W0zPIzMe` on contact
  `AXrbvQAQKR0TcTcZL71H` (Ben), and `:376-377` writes `ghl_opportunity_id: created.id`, the **real GHL id**.
- `scripts/seed-ghl-grants.mjs:102,:124,:136` creates in GHL and writes the real id plus
  `pipeline_stage:'researching'`.
- `:254` and `:500` (and `enrich-ghl-grants.mjs:229-231`) resolve UUID -> real id through the mirror before
  calling GHL, so the mixed column is a known convention inside act-global, not a bug there.
- No caller: `grep` over `.github/workflows`, `package.json`, `scripts/*.sh`, PM2 (46 apps), crontab and
  launchd finds none for either script. The 657-row stamp on 2026-09-20 was a hand run.
- grantscope writes the column nowhere: `grep -rn ghl_opportunity_id scripts apps/web/src` with update/upsert
  context returns only `goods_relationships`, `act_ask_warmers`, `saved_grants`. JusticeHub: only
  `database.types.ts`.

```sql
SELECT pipeline_stage, count(*) n, count(ghl_opportunity_id) with_ghl,
  count(*) FILTER (WHERE ghl_opportunity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') ghl_uuid_shaped,
  count(*) FILTER (WHERE status IN ('open','ongoing','upcoming')) live
FROM grant_opportunities GROUP BY 1 ORDER BY n DESC
-- discovered  | 23756 | 641 | 277 | 3057
-- archived    |  3118 |  58 |  13 |  105
-- researching |    24 |  22 |   0 |    6
-- submitted   |     4 |   4 |   0 |    1
-- drafting    |     1 |   0 |   0 |    0
```
All 26 GHL-linked rows in active stages carry real ids; the 290 UUID-shaped ids are all in discovered/archived.

```sql
SELECT g.updated_at::date d, count(*) n,
  count(*) FILTER (WHERE g.ghl_opportunity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') uuid_shaped,
  count(o.id) matches_ghl_id, count(m.id) matches_mirror_uuid
FROM grant_opportunities g
LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id
LEFT JOIN ghl_opportunities m ON m.id::text = g.ghl_opportunity_id
WHERE g.ghl_opportunity_id IS NOT NULL GROUP BY 1 ORDER BY n DESC
-- 2026-09-20 | 657 | 280 | 219 | 280
-- 2026-09-24 |  31 |   7 |  14 |   7
-- 2026-09-21 |  20 |   1 |  16 |   1
-- 2026-09-23 |  13 |   0 |   1 |   0
-- 2026-09-22 |   4 |   2 |   1 |   2
```
Every UUID-shaped value resolves to a mirror row. The 40 "unresolvable" live rows the critic counted are real
GHL ids whose mirror row is gone (soft-deleted or in a pipeline the mirror no longer sees), not bad keys.
Rows updated 09-21..09-24 are grantscope's nightly scorers touching other columns, not new stamps (inferred:
no writer ran; `updated_at` moves on any update).

```sql
-- neither grantscope store carries a GHL id
SELECT 'decisions', count(*), count(ghl_opportunity_id) FROM act_grant_recommendation_decisions   -- 89 | 0
SELECT 'saved_grants', count(*), count(ghl_opportunity_id) FROM saved_grants                        -- 2916 | 0
SELECT count(*) FROM grant_opportunities WHERE source='ghl_sync'                                    -- 260
```

`application_status`, the vocabulary `sync-grants-ghl.mjs` maps to GHL stages, is a 14-value soup mixing
lifecycle with grant status:
```sql
SELECT coalesce(application_status,'<null>'), count(*) FROM grant_opportunities GROUP BY 1 ORDER BY 2 DESC
-- awarded 12367 | not_applied 10368 | open 3239 | closed 658 | ongoing 113 | unknown 103 | upcoming 23
-- reviewing 19 | in_progress 5 | submitted 3 | unsuccessful 2 | expired 1 | duplicate 1 | monitor 1
```

### Q2. `sync-grantscope-to-notion.mjs`: filter, Notion DB ids, same DB as the retired grantscope sync?

- Filter: `:122-125` `.from('grant_opportunities').select(...).in('pipeline_stage', ACTIVE_STAGES)` with
  `ACTIVE_STAGES = ['researching','pursuing','drafting','submitted']` (`:86`), ordered by `closes_at`. Today
  that is 24 + 0 + 1 + 4 = **29 rows**. Nothing filters on `status`, so closed/expired grants in those stages
  would go too.
- Client: `:63-70` uses `GRANTSCOPE_SUPABASE_URL` / `GRANTSCOPE_SUPABASE_KEY` (Actions secrets
  `scheduled-syncs.yml:270-271`). That key is a legacy JWT -> `Legacy API keys are disabled` on every run
  inspected (09-01, 09-23). The step is `continue-on-error: true` (`:274`).
- Notion targets (`config/notion-database-ids.json`): `grantPipeline` `2784ae13-61ba-4bbf-bb62-10c42c0553ee`
  (`:15`), `actions` `177ebcf9-81cf-8023-af6e-dff974284218` (`:10`), `planningCalendar`
  `31eebcf9-81cf-80f8-beaf-e7e9ef8bf637` (`:16`), `actProjects` `177ebcf9-81cf-80dd-9514-f1ec32f3314c` (`:6`).
  (`opportunitiesDb a28b97ba-...` `:22` and `grantTranchesDb f8204bd0-...` `:56` exist too; this script does not
  use them.)
- Same DB: grantscope `.env` `NOTION_GRANT_PIPELINE_DB` starts `2784ae13` = act-global's `grantPipeline`.
  The retired grantscope `scripts/sync-pipeline-to-notion.mjs:40` reads that var, `:124` selects
  `saved_grants` per user, `:147-149` dedups by `[CG:<saved_grants.id>]` in Notes, `:9-18` maps stages to
  Identified / Researching / Pursuing / Submitted / Negotiating / Approved / Lost / Expired. act-global
  dedups by `[gs:<grant_opportunities.id>]` (`:150-160,:250-253`) and maps to Discovered / Researching /
  Pursuing / Drafting / Submitted / Awarded / Declined / Archived (`:74-83`). Two id families and two Stage
  select vocabularies in one Notion database. Neither sync ever archives a Notion page (only `pages.create`
  `:384,:741,:795` and `pages.update` `:364` for existing `[gs:]` pages).
- grantscope's `NOTION_OPPORTUNITIES_DB_ID` (`361ebcf9...`) and `NOTION_FOUNDATION_TARGETS_DB` (`b7c98e32...`)
  are different DBs again; act-global's `opportunitiesDb` is `a28b97ba...`. Four Notion databases have held
  grant rows.

### Q3. Is anything still writing `opportunities_unified`? What breaks in the command-center?

Writers: `sync-grantscope-matches.mjs`, `sync-opportunities-to-unified-pipeline.mjs`,
`populate-funding-pipeline.mjs`, `align-pipeline-projects.mjs`, and the UI route
`apps/command-center/src/app/api/finance/pipeline-update/route.ts:64-65`. None of the scripts has a
scheduler (§1.2). The UI route's audit table:
```sql
SELECT count(*), max(created_at)::date FROM pipeline_changes   -- 4 | 2026-03-17
SELECT count(*), max(updated_at)::date FROM opportunities_unified -- 17790 | 2026-06-15
```
So: **nothing writes it.** It has been frozen since 2026-06-15 by neglect, not decision.

What reads it (all in `apps/command-center/src`): `api/intelligence/route.ts:221-222` (pipeline value, stage
not in lost/expired/identified/closed/won/abandoned/declined), `api/briefing/morning/route.ts:200-201`,
`api/finance/weekly-review/route.ts:585-586` (stage in pursuing/submitted/negotiating/approved),
`api/finance/overview/route.ts:85-92` (stage != identified; stage = realized), `api/strategy/route.ts:64-65`,
`lib/finance/ledger.ts:1077-1078` (`source_system in ['ghl_opportunities','manual','fundraising_pipeline','ghl','xero']`),
`api/finance/pipeline-update/route.ts:17-18`, plus `scripts/generate-daily-priorities.mjs:349` and
`scripts/populate-relationship-pipeline.mjs` (2 reads). `revenue-reality` and `pipeline-intelligence` routes
have no direct `.from('opportunities_unified')` (they were on the brief; they read through the ledger).

Freeze: no change, those tiles already show June-2026 pipeline numbers (871 "pursuing" deals worth
$202.9M mid, 15,986 "identified" grants). Drop: each of those routes throws on the missing relation instead
of showing zero; the CEO cockpit's "pipeline" panels go blank. Re-point: a `v_opportunities_unified` view
over `ghl_opportunities` (stage_name/status -> the same stage words) + `act_grant_recommendation_decisions`
keeps the routes alive with today's numbers; then drop the table and `project_pipelines` (63 rows,
computed_at 2026-06-15, read by `api/finance/projects/[code]/route.ts`, `app/finance/projects/[code]/page.tsx`,
`api/supporters/route.ts`) and `fundraising_pipeline` (14 rows, 2026-03-06, read by `api/opportunities/route.ts`,
`ledger.ts`, `packages/act-intel/.../revenue-scoreboard.ts`).

### Q4. Which job assigns `ghl_opportunities.project_code`, from which list, and does it agree with grantscope?

Three manual act-global scripts (§2 A10, A11, A7):
- `align-ghl-opportunities.mjs:5-7,:149,:168,:217-218`: keyword match of opportunity name against
  `config/project-codes.json` (`ghl_tags` + names) via `scripts/lib/project-loader.mjs`; auto-assign at score
  >= 0.7, 0.3-0.7 flagged.
- `backfill-grant-project-codes.mjs:6,:90,:133-134`: `WATCH` for opps whose contact email is `benjamin+test.*`
  (bot-scraped ARC/AHO/government grants), infer from pipeline+tags for Goods/EL/Mukurtu, leave Grants for
  humans.
- `sync-grants-ghl.mjs:190` copies `project_code` the other way into `grant_opportunities.aligned_projects`.
- The 6-hourly sync does not write the column (`sync-ghl-to-supabase.mjs:362-384` field list), so tags survive.
- grantscope's `funding_ghl_alignment_candidates` (32 rows, max 2026-09-05) is a separate, stalled proposal
  (`applied: already_aligned -> ACT-GD 6, ACT-HV 1; blocked: missing_project_relation 25`); no act-global file
  references it.

Lists: `config/project-codes.json` v1.8.0 (2026-04-24) has **78** codes. grantscope's
`act_grant_recommendation_projects` has **12** (`ACT-HV, ACT-GP, ACT-FM, ACT-CORE, ACT-JH, ACT-CN, ACT-MY,
ACT-CS, ACT-EL, ACT-GD, ACT-PI` in scope; `ACT-IN` out).

```sql
SELECT pipeline_name, coalesce(project_code,'<null>'), count(*) FROM ghl_opportunities
WHERE pipeline_name IN ('Grants','GOODS - Funding') GROUP BY 1,2 ORDER BY 1,3 DESC
-- Grants: WATCH 141 | ACT-HV 57 | <null> 50 | ACT-CORE 17 | ACT-GD 9 | ACT-JH 5 | ACT-RA 3 | ACT-DL, ACT-CA, ACT-UA, ACT-FA, ACT-PI, ACT-OO, ACT-CN, ACT-MR, ACT-RP 1 each
-- GOODS - Funding: ACT-GD 38 | <null> 23 | ACT-FP 2 | ACT-CORE, ACT-SE, ACT-SM, ACT-WE, ACT-SH, ACT-HV 1 each
```
22 distinct values across those two pipelines; 13 (`WATCH, ACT-RA, ACT-DL, ACT-CA, ACT-UA, ACT-FA, ACT-OO,
ACT-MR, ACT-RP, ACT-FP, ACT-SE, ACT-SM, ACT-WE, ACT-SH`) are not in grantscope's 12. `WATCH` alone is 141 of
291 Grants rows. So: **no, they do not agree**, and the disagreement is structural (78 vs 12), not drift.

A fourth taxonomy sits on the same rows: `pile` (`backfill-pile-tags.mjs:152`, `config/pile-mapping.json`):
```sql
-- ghl_opportunities.pile: <null> 839 | Grants 243 | Flow 160 | Voice 38 | Other 30 | Uncoded 10 | Ground 2
-- grant_opportunities.pile: Grants 24963 | <null> 1939 | apply_now 1
```

### Q5. Does JusticeHub write ALMA on a schedule? Does its workspace hold decisions grantscope lacks?

No and no.

```sql
SELECT coalesce(scrape_source,'<null>'), count(*), min(created_at)::date, max(created_at)::date, max(updated_at)::date, count(*) FILTER (WHERE status='open')
FROM alma_funding_opportunities GROUP BY 1 ORDER BY 2 DESC
-- promotion-from-foundation-programs | 12122 | 2026-05-15 | 2026-09-18 | 2026-09-23 | 11573
-- promotion-from-grant_opportunities | 11525 | 2026-05-15 | 2026-09-18 | 2026-09-23 | 10622
-- <null>                             |    26 | 2026-05-16 | 2026-05-16 | 2026-08-07 |     0
-- manual_seed_2026_05_04             |    21 | 2026-05-03 | 2026-05-03 | 2026-09-17 |     4
-- oracle-research-2026-05-15         |     9 | 2026-05-15 | 2026-05-15 | 2026-09-23 |     1
-- funding_smoke_seed                 |     2 | 2026-03-01 | 2026-03-01 | 2026-08-03 |     0
-- (no 'grants.gov.au', 'business.gov.au', 'paulramsayfoundation' rows: the JusticeHub scraper has never landed one)
SELECT count(*) FROM alma_funding_opportunities a JOIN act_grant_recommendation_decisions d ON d.opportunity_id=a.id WHERE a.scrape_source IS NULL AND d.decision='won'  -- 26 (= the null-source rows = backfill-won-decisions-from-xero.mjs:140-144)
SELECT source_type, status, count(*), max(created_at)::date FROM alma_ingestion_jobs WHERE created_at > now() - interval '14 days' GROUP BY 1,2  -- website | pending | 10 | 2026-09-23 (no funding jobs; the scraper's :542 insert never ran)
```
The weekly workflow's own log (run 35541264040, job 106159249741) ends the scraper step with
`Missing required environment variables:`; `scripts/alma-funding-scrape.mjs:19-27` exits 1 when
`NEXT_PUBLIC_SUPABASE_URL` is unset and has no dotenv/load-env import; `weekly-funding-scrape.yml:60` pipes
through `tee`, so the step succeeds. It has been "success" since 2026-09-06 and wrote nothing.

JusticeHub's workspace (`supabase/migrations/20260301000004_funding_application_draft_workspace.sql:1-15`
creates `funding_application_draft_workspace` FK'd to `organizations`, `alma_funding_opportunities`,
`alma_funding_applications`, `draft_status` in draft/in_review/ready_to_submit/submitted/archived):
```sql
-- funding_application_draft_workspace 2 (max updated 2026-03-02) | alma_funding_applications 2 (2026-03-01)
-- funding_relationship_engagements 34 (2026-03-02) | funding_match_recommendations 3 (2026-09-24)
-- funding_discovery_review_workspace 2 (2026-05-03) | funding_awards 5 (2026-06-28)
-- funding_system0_events 309 (2026-09-23) | funding_weekly_cycles 8 (2026-09-21) | agent_task_queue 356 (2026-08-24)
-- act_grant_recommendation_decisions 89 (2026-08-30): passed/legacy/operational 62, won/xero_invoices/historical_evidence 26, watching/legacy/operational 1
```
Nothing in JusticeHub's tables is a decision about an ALMA row that ACT's 89 decisions lack; the two live
things there (`funding_match_recommendations` 3 rows touched today, `system0` events) are JusticeHub-tenant
machinery keyed on `organizations`, not ACT. The human write path onto ALMA rows from JusticeHub is
`src/app/api/admin/funding/opportunities/route.ts:173-174` (insert), `:217-218` (update), `:253-254`
(`status='archived'`), and `applications/route.ts:143-144,:191-192`; the funding OS writes 18 other tables
(`agent_task_queue` 35 sites, `funding_relationship_engagements` 12, ...) but only reads
`alma_funding_opportunities` (14 reads, 0 writes).

### Q6. Which workflows actually run

See §1. In one line each: act-global Actions grant lane = dead-quiet (Supabase legacy key + Notion token +
GHL token all rotten, every failure masked); act-global PM2 = the live GHL mirror; JusticeHub Actions =
runs, funding scrape dead-quiet (env), ALMA ingestion live but not funding; JusticeHub Vercel = live, writes
`youth_opportunities` not ALMA; grantscope = the de-facto ALMA writer via promotion.

## 4. Corrections to the critic (critic.md §2.3, §2.4, §3.A)

- §2.4 "From act-global, no [Notion is not dormant]": the daily job runs and writes nothing (`Legacy API keys
  are disabled` since before 2026-09-01; Notion token invalid for the hygiene step). Notion IS dormant for
  grants from every repo. `docs/specs/grants-notion-handoff-spec.md:7-12` is right today, by accident.
- §3.A "PM2 ... all stopped ... so act-global's live automation is GitHub Actions, not PM2": inverted. PM2
  cron apps show `stopped` between ticks; `ghl-sync` ran at 02:00 UTC today and was `online` at 08:00 UTC.
  The Actions GHL sync has 0/100 successes.
- §3.A "`sync-ghl.yml:6` ... This is the `full_sync ghl_to_supabase cron` writer": the script is, the
  workflow is not; the rows come from the laptop.
- §2.3 "40 resolve to nothing": all 290 UUID-shaped ids resolve to mirror rows; the unresolvable ones are
  real ids missing from the mirror. The mixed shape is documented at `enrich-ghl-grants.mjs:23-25` and handled
  at `sync-grants-ghl.mjs:254,:500`.
- §3.A "JusticeHub owns and ingests the ALMA corpus that grantscope's P2 engine scores": owns by seed, does
  not ingest funding rows; grantscope's promoters wrote 99.8% of them.
- Brief file list: `apps/command-center/src/app/api/finance/{revenue-reality,pipeline-intelligence}/route.ts`
  do not read `opportunities_unified` directly; `finance/overview`, `strategy` and `lib/finance/ledger.ts` do
  and were not on the list.
- The desk path `act-one-desk.ts:223-224` does not exist; the desk's GHL-id read is
  `apps/web/src/lib/services/act-project-grants-triage.ts:41,:73`.

## 5. Ben decisions

1. **D1 - one GHL mirror writer, off the laptop.** Keep `sync-ghl-to-supabase.mjs`; run it from Actions with
   the working `GHL_PRIVATE_TOKEN` (Tier 3: secret rotation), then `pm2 delete ghl-sync` and delete the
   duplicate `scheduled-syncs.yml:35-66` job. Until then the mirror stops whenever the MacBook sleeps.
2. **D2 - Notion Grant Pipeline Tracker (`2784ae13...`): declare it dead or make ONE writer.** Today two
   retired syncs (`[CG:]` and `[gs:]`) targeted it with different Stage vocabularies and neither runs. If it
   stays, ONE place writes it from `act_grant_recommendation_decisions` on pursue (grantscope's
   `funding-notion.ts` path), and `sync-grantscope-to-notion.mjs`, `auto-archive-expired-grants.mjs`,
   `sync-ghl-to-notion.mjs` are deleted with their `scheduled-syncs.yml:246-304` jobs. If it goes, delete the
   same and unset `NOTION_GRANT_PIPELINE_DB` in grantscope.
3. **D3 - drop `opportunities_unified`, `project_pipelines`, `fundraising_pipeline`, `sprint_suggestions`,
   `pipeline_changes`** after the eight command-center reads (§3 Q3) are re-pointed to a view; delete
   `sync-grantscope-matches.mjs`, `sync-opportunities-to-unified-pipeline.mjs`, `populate-funding-pipeline.mjs`,
   `align-pipeline-projects.mjs`, `build-project-pipelines.mjs`, `generate-daily-priorities.mjs`.
4. **D4 - JusticeHub funding scrape: retire the workflow** (`weekly-funding-scrape.yml`) rather than fix its
   env; grantscope already ingests GrantConnect and promotes to ALMA. Also relabel `scripts/pipelines/run.mjs:73`
   (`youth_opportunities`). Re-seed ownership of `alma_funding_opportunities`: owner justicehub (DDL),
   writer grantscope (promotion), human-write JusticeHub admin API.
5. **D5 - one project vocabulary on GHL rows.** Pick: (a) grantscope's 12 `act_grant_recommendation_projects`
   codes become the only values ONE place writes to `ghl_opportunities.project_code`, and `WATCH` is replaced
   by not-being-in-GHL (the 141 bot rows get `status='abandoned'` or are deleted from GHL); or (b) the 78-code
   `project-codes.json` is the list and grantscope's table grows to match. `pile` is a fourth taxonomy on the
   same rows; keep or drop, but name it.
6. **D6 - `ghl_opportunity_id` key rule.** Either normalise the 290 mirror UUIDs to real ids now
   (`UPDATE grant_opportunities g SET ghl_opportunity_id = m.ghl_id FROM ghl_opportunities m WHERE m.id::text = g.ghl_opportunity_id`,
   290 rows, then a CHECK that rejects UUID shape), or accept the mixed shape and copy `resolveGhlId` from
   `enrich-ghl-grants.mjs:229-231` into grantscope. Then retire `sync-grants-ghl.mjs`'s `fit_score>=50` push;
   minting into GHL becomes the pursue action only.
7. **D7 - `application_status` on `grant_opportunities`.** 14 values, 12,367 `awarded` from historical
   ingests; act-global maps it to GHL stages. ONE place should stop reading and writing it (decisions live in
   `act_grant_recommendation_decisions`; grant status lives in `status`), and `enrich-grant-opportunities.mjs:563`
   / `discover-grants.mjs` / `sync-grants-ghl.mjs:147` stop.
8. **D8 - `grants-pipeline.mjs` writes a table that does not exist; `alta-grant-scout.yml` prints "No grants
   in pipeline" weekly; `weekly-digest.yml` fails at install; `master-automation.yml` fails at step 1.** Delete
   or fix; none of these is load-bearing for the money desk.

## 6. Gaps

- `packages/notion-workers/src/index.ts` (12 `grant_opportunities` refs, 6 `ghl_contacts`) not read; unknown
  whether a worker runs it.
- `scripts/relationship-alerts.mjs` and `daily-briefing.mjs` read `ghl_opportunities`/`ghl_contacts` via
  `SUPABASE_SERVICE_ROLE_KEY`; in Actions that key is legacy (daily-brief logs the fallback). Whether
  relationship-alerts silently returns empty was not checked (its log matched nothing).
- JusticeHub `/api/cron/funding/system-0` and the funding OS "system 0" (309 events, 8 weekly cycles) were not
  read beyond row counts.
- The 2026-09-20 hand run of `sync-grants-ghl.mjs` is inferred from the `updated_at` bucket and the absence of
  any scheduler; no shell history matched.
- The ownership seed line numbers (`20260905140000_schema_ownership_seed.sql:107,379-381,423,644`) are quoted
  from critic.md, not re-read.
- GH Actions logs older than ~90 days are gone; the earliest run inspected (2026-06-16) returned no step
  output, so "last successful grantscope->Notion sync" is bounded only as "before 2026-09-01".
- The GHL MCP was not used to cross-check the live Grants pipeline against the mirror.
