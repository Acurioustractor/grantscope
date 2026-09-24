# Completeness critic — what the ten readers missed, and what to check before designing ONE place

Critic pass, 2026-09-24. Repo `/Users/benknight/Code/grantscope` @ main `1b517ba0`, read-only; nothing edited, no server started.
Read in full: all ten notes under `scratchpad/understand/` (actions-and-pipelines, buyers-and-procurement, communities-and-projects,
design-and-ui, desk-surfaces, grant-data-model, jev-pipeline, periphery, philanthropy-and-funders, shell-auth-actions; 4,021 lines).
Every number below that I produced was run today with `node --env-file=.env scripts/gsql.mjs "<sql>"`; the SQL is pasted. Column
names were checked with `information_schema.columns` before any table I had not seen. Confidence per claim is in §8.

Goal being designed against: one signed-in place where Ben finds money for six projects (grants, philanthropy, buyers), saves and
decides on items, ties them to the communities served, and keeps Jev's tags honest with a human feedback loop.

---

## 0. Verdict in one screen

1. **The ten readers covered grantscope exhaustively and the shared database as grantscope sees it. They did not look up.** The
   database is shared with act-global-infrastructure and JusticeHub, and both write and read the very tables the design is about.
   `supabase/migrations/20260905140000_schema_ownership_seed.sql` records **act: 135 code refs to `grant_opportunities`, 204 to
   `ghl_opportunities`, 421 to `ghl_contacts`, 62 to `opportunities_unified`** (seed lines 423, 380, 379, 644) and **JusticeHub: 56
   refs to `alma_funding_opportunities`, which it owns** (line 107). act-global runs six-hourly and daily GitHub Actions that write the
   GHL mirror and push tagged grants to Notion; JusticeHub has `weekly-funding-scrape.yml` and `alma-ingestion.yml`. None of this is
   in any notes file. A ONE place designed only from grantscope's side re-creates the four-decision-store problem one level up.
2. **GHL, the declared system of record, was read only through grantscope's mirrors and hard-coded ids.** Checked today: the Grants
   pipeline (`scom3L0kNwA1W0zPIzMe`) has 239 open / 52 lost opportunities and **nothing has changed in it since 2026-08-30**; the three
   Goods pipelines kept their ids and stage ids but were renamed and re-staged in GHL, and a fourth (`GOODS - Community`) exists that no
   grantscope code knows; **of the 114 live grants the desk calls "in GHL", 40 carry an id that resolves to nothing** (neither a GHL id
   nor a mirror UUID) and 290 of the 725 stamped ids are Supabase mirror UUIDs, which act-global's own script warns about.
3. **The sanctioned unified read path carries none of what the desk needs.** `v_funding_opportunities` (26 columns, checked) has no
   `project_relevance`, no `aligned_projects`, no `goods_relevance_score`, no `dgr_required`, and does not union
   `act_private_grant_rounds` (position 0 for every one of those strings in `pg_get_viewdef`). The grant-data-model and periphery
   readers both point the redesign at it without having opened it.
4. **Two readers disagree on whether Jev ran last night; the jev reader is right.** `agent_tasks` says
   `score-project-rubric | failed | scheduler | Unknown agent: score-project-rubric` (2026-09-24 06:46:02Z); periphery's "success
   06:48:04" is a dry-run `agent_runs` row (`logStart` is unconditional). The nightly Jev tag will not happen until `pm2 restart
   orchestrator` (Tier 2, Ben's machine).
5. **"Nothing lands in Notion automatically" is false at the ACT level.** act-global's `scheduled-syncs.yml` runs
   `scripts/sync-grantscope-to-notion.mjs` daily at 20:00 UTC, reading `grant_opportunities` (line 122) into Notion's Grant Pipeline
   Tracker, Actions DB and Planning Calendar. Three readers (actions, periphery, grant-data-model) reported Notion as dormant because
   they only looked at grantscope's writers.
6. **The "who to call" layer was not read by anyone**, and the funder row the philanthropy reader specified needs it. `act_people` is
   0 rows; `org_contacts` for ACT is 76 rows with `person_id` NULL on all; `person_identity_map` is 14,919 rows, last updated
   2026-03-19, `funding_capacity` NULL on all; `ghl_contacts` has 3,812 tagged contacts (project: 1,367; place: 252; goods-warm 52;
   philanthropic 39).
7. Smaller: `mv_search_index` does index grants (24,831 `grant_round`) and foundations (11,235) but not ALMA, foundation_programs or
   private rounds; the ALMA duplication cap is 10,000 not 1,000 (mechanism stands); the old-name Goods rows in the GHL mirror (115)
   are orphans; `funding_ghl_sync_runs` stopped 2026-09-05 (the removed 15-minute cron, now explained).

---

## 1. What the ten readers cover, and where they agree

| reader | subsystem | depth | key numbers it owns |
|---|---|---|---|
| desk-surfaces | every `/org/act/*` and `/ops` money page: fields, filters, writes | deep | desk pool ~360 rows / 80 rendered; 43 grant rows; 0 daily marks in 30d; `funding_ghl_handoffs` 0 |
| grant-data-model | `grant_opportunities`, `alma_funding_opportunities`, fit columns, save tables | deep | 26,903 / 23,705 rows; 3,162 live; 22,781 ALMA rows in duplicated pairs; four decision tables |
| jev-pipeline | every Jev caller, prompt, storage, thresholds, schedule failure | deep | 380 rows ever read; 0 Goods verdicts; 17 open never read; no human verdict table |
| shell-auth-actions | middleware, org membership, mutation patterns, caching, tests | deep | session gate only; `requireWriteAccess` bypass on NODE_ENV; 0 obligations/daily_action rows |
| actions-and-pipelines | every pursue/decide/save write, GHL/Notion/digest paths | deep | 4 pursue impls, 4 decision stores, 6 save tables; A3 never fired; sync-goods-ghl 401 |
| buyers-and-procurement | three buyer systems, tender feeds | deep | 131 buyers of which 59 are communities; open-tender feed 0 runs; `state_tenders` 0 NT/WA |
| communities-and-projects | 8 project registries, entities, geography, communities | deep | Butterfly absent from `org_applicant_entities`; `act_communities.geo = {}`; 236 NT rows lga Laverton |
| design-and-ui | Quiet Ledger tokens, primitives, screenshots, anti-patterns | deep | 14 ql files vs 83 bauhaus; 33 local money formatters; `$22039K` |
| periphery | crons, schedulers, registry, inbound links, tests, landing classifier | deep | two schedulers on one table; PM2 env shadows GHL key; SAFE/VISIBLE split |
| philanthropy-and-funders | foundations, three matchers, funder tables, `funders.json` | deep | giving placeholders reverted 2026-09-22 (8,196 rows); grade A ≠ observed giving |

They agree on the shape of the problem (four grant engines, four decision stores, six save tables, no pursue/pass on the desk, no
human feedback on tags) and the numbers cross-check (e.g. 43 desk grant rows in desk-surfaces §1 and design-and-ui §8; 725
`ghl_opportunity_id` in actions §1 and periphery §6; 89 decisions everywhere).

---

## 2. Disagreements between readers, resolved today

### 2.1 Did the Jev nightly run? (jev-pipeline §0.1 vs periphery §1c)

```sql
SELECT agent_id, status, created_by, created_at, started_at, left(error,80) AS error
FROM agent_tasks WHERE agent_id IN ('score-project-rubric','score-goods-relevance') ORDER BY created_at DESC LIMIT 6
-- score-project-rubric  | failed    | scheduler | 2026-09-24T06:45:45Z | 06:46:02Z | Unknown agent: score-project-rubric
-- score-goods-relevance | completed | scheduler | 2026-09-24T06:45:45Z | 06:45:52Z |
```
Resolved: **failed**. Periphery's table (§1c) reads `agent_runs` where the rubric script's unconditional `logStart`
(`scripts/score-project-rubric.mjs:202`, per jev-pipeline §7) wrote "success" rows for dry runs. Any dashboard that classifies the
scorer from `agent_runs` will say healthy while the tag never updates. This is load-bearing for "keep Jev honest": today there is no
Jev signal being refreshed at all.

### 2.2 Were the Goods GHL boards "rebuilt under new names"? (actions §F3, marked inferred)

```sql
SELECT ghl_id, name, jsonb_array_length(stages) AS n_stages, (SELECT string_agg(s->>'name',' > ' ORDER BY (s->>'position')::int) FROM jsonb_array_elements(stages) s) AS stage_names, last_synced_at::date FROM ghl_pipelines ORDER BY name
-- 19 rows. The ones the code names:
-- JvBFYpVpyKsw899lkFgj | GOODS - Funding  | 10 | Identified > Qualified > Cultivating > Ask made > Committed > Delivering > Stewarding / Reporting > Renewing > Lapsed > Declined / Parked | 2026-09-24
-- FjMyJM3YzWQFmKqR9fur | GOODS - Buyers   | 12 | Outreach Queued > First Contact > In Conversation > Qualified > Scoped > Proposed > Negotiating > Committed > In Delivery > Delivered > Invoiced > Paid | 2026-09-24
-- UQsrmuqzxMSdCTklxEcG | GOODS - Demand   |  4 | Signal > Buyer Matched > Converted > Dormant | 2026-09-24
-- 0m9teeEQFiq6I7GB5xiP | GOODS - Community| 12 | Invitation > Listening > Brief returned > Community confirmed > Modules selected > Ready to cost > Funding pathway > Agreement > Delivery > Operating > Review and adapt > Paused / closed | 2026-09-24
-- scom3L0kNwA1W0zPIzMe | Grants           |  7 | Grant Opportunity Identified > Application In Progress > Grant Submitted > Grant Awarded > Grant Reporting Due > Grant Report Submitted > Grant Declined | 2026-09-24
```
`scripts/sync-goods-ghl.mjs:50-54` hard-codes the same three ids under the OLD names (`Goods Supporter Journey`, `Goods — Buyer
Pipeline`, `Goods — Demand Register`), and its `STAGE_PREFIX_MAP` (`:60-75`) prefixes `cf8d31d2, a84114da, 524aca71, a23b26b4,
c6369cf9, 15b7b876, 3e38f65b, ff90ea45, 0c86ee48, fcf23a69, e5220eb2, 1fd317ec …` all match the current mirror stage ids (query
above, expanded with `jsonb_array_elements(stages)`, 26 rows). Resolved: **same ids, same stage ids, new names and one new
pipeline**. The stage mapping is not stale; the names in code are labels only. The 115 old-name rows in `ghl_opportunities`:
```sql
SELECT count(*) AS old_name_rows, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ghl_opportunities n WHERE n.ghl_id = o.ghl_id AND n.pipeline_name LIKE 'GOODS - %')) AS also_under_new_name
FROM ghl_opportunities o WHERE o.pipeline_name IN ('Goods — Buyer Pipeline','Goods — Demand Register','Goods Supporter Journey')
-- 115 | 0
```
are orphans (last synced 2026-06-08): opportunities deleted or moved in GHL that the mirror never pruned. Anything reading the mirror
by `pipeline_name` (act-global's `project_pipelines`, computed 2026-06-15 on the old names) is counting ghosts.

### 2.3 Who wrote the 725 `grant_opportunities.ghl_opportunity_id` values? (actions §A1, inferred "a 2026-09-20 backfill")

Not located by name, but the key shape is now measured and it matters more than the author:
```sql
SELECT count(*) AS stamped,
  count(*) FILTER (WHERE g.ghl_opportunity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') AS uuid_shaped,
  count(*) FILTER (WHERE g.status IN ('open','ongoing','upcoming')) AS live,
  count(*) FILTER (WHERE g.status IN ('open','ongoing','upcoming') AND o.ghl_id IS NOT NULL) AS live_in_mirror_by_ghl_id,
  count(*) FILTER (WHERE g.status IN ('open','ongoing','upcoming') AND o.status='open') AS live_mirror_open,
  count(*) FILTER (WHERE g.status IN ('open','ongoing','upcoming') AND m.id IS NOT NULL) AS live_matches_mirror_uuid,
  count(*) FILTER (WHERE g.status IN ('open','ongoing','upcoming') AND o.ghl_id IS NULL AND m.id IS NULL) AS live_unresolvable
FROM grant_opportunities g
LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id
LEFT JOIN ghl_opportunities m ON m.id::text = g.ghl_opportunity_id
WHERE g.ghl_opportunity_id IS NOT NULL
-- 725 | 290 | 114 | 64 | 60 | 10 | 40
```
So `ghl_opportunity_id` is a mixed-key column: 290 of 725 are Supabase mirror UUIDs (act-global's
`scripts/enrich-ghl-grants.mjs:23` says "~22% of stored ids are Supabase mirror UUIDs, not real GHL" and resolves them at `:200,310`),
and of the 114 live rows the desk labels "in GHL" (`act-one-desk.ts:223-224`), **60 are genuinely open in GHL, 10 point at a mirror
row, 40 resolve to nothing**. Whole-column join: only 251 of 725 match a mirror `ghl_id`, all in the `Grants` pipeline at stages
Identified / In Progress / Declined. The desk's "Work the application" state is right for about half its rows.

### 2.4 Is Notion disconnected? (actions §D, periphery §7.3, grant-data-model §1)

From grantscope, yes (0 `notion_page_id`, sync disabled). From act-global, no:
`/Users/benknight/Code/act-global-infrastructure/.github/workflows/scheduled-syncs.yml:10` `cron: '0 20 * * *'`; `:273` `run: node
scripts/sync-grantscope-to-notion.mjs`; `:303` `node scripts/auto-archive-expired-grants.mjs`. The first reads
`.from('grant_opportunities')` (`scripts/sync-grantscope-to-notion.mjs:122`) "tagged with pipeline_stage" into the Notion Grant
Pipeline Tracker, Actions DB (Playbook 6 gates) and Planning Calendar (header lines 1-14). The second marks expired grant actions
Done in Notion. `docs/specs/grants-notion-handoff-spec.md:7-12` ("nothing lands in Notion automatically on pursue") is contradicted by
the sibling repo's daily job. Which grants it selects (`pipeline_stage` is `discovered` on 23,756 rows, `archived` 3,118,
`researching` 24, `submitted` 4, `drafting` 1 per grant-data-model §2.2) was not read; brief A asks for it.

### 2.5 The ALMA duplication cap (grant-data-model §6.2: "1,000-row default cap")

`scripts/promote-grant-opportunities-to-alma.mjs:152-161` confirmed unpaged (`.select('id, name, funder_name')`, no `.range`). But:
```sql
SELECT agent_id, status, items_found, items_new, started_at FROM agent_runs WHERE agent_id ILIKE 'promote-%alma%' ORDER BY started_at DESC LIMIT 6
-- promote-grant-opportunities-to-alma | success | 10000 | 0   | 2026-09-23
-- promote-grant-opportunities-to-alma | success | 10000 | 0   | 2026-09-22
-- promote-grant-opportunities-to-alma | success | 10000 | 651 | 2026-09-18
```
`items_found 10000` says the client cap on this project is 10,000 rows, not 1,000. The mechanism (index holds a slice of 23,705 keys
and the rest re-insert) stands; the intermittency is because 10,000 rows usually cover the 3,300 distinct keys and sometimes do not.
Fix is the same (paginate), the memory note about a 1,000 cap is for RPCs.

### 2.6 The 15-minute `funding-ghl-sync` cron memory recorded (periphery §1a: "gone")

```sql
SELECT 'funding_ghl_sync_runs', count(*), max(started_at)::text, string_agg(DISTINCT trigger || ':' || status, ', ') FROM funding_ghl_sync_runs
-- 556 | 2026-09-05 02:01:28Z | cron:succeeded, test:succeeded
```
It ran until 2026-09-05 and stopped when the route was removed. Consistent; nothing to chase.

---

## 3. Gaps no reader covered

### 3.A The sibling repos' hands on the money tables (act-global-infrastructure, JusticeHub)

**Ownership seed** (`supabase/migrations/20260905140000_schema_ownership_seed.sql`), grep for the money tables:
```
56   act_grant_recommendation_decisions | owner act        | consumers act,grantscope           | refs grantscope:29 act:5
107  alma_funding_opportunities         | owner justicehub | consumers act,grantscope,justicehub| refs grantscope:51 justicehub:56 act:7 ; 37MB
349  funder_intelligence                | grantscope       | (none)                             | refs 0 everywhere
364  funding_ghl_sync_runs              | act              | (none)                             | created by none found
377  fundraising_pipeline               | act              | act                                | act:13
379  ghl_contacts                       | act              | act,grantscope,justicehub          | grantscope:78 justicehub:14 act:421
380  ghl_opportunities                  | act              | act,grantscope                     | grantscope:23 act:204
381  ghl_pipelines                      | act              | act,grantscope                     | grantscope:4 act:14
423  grant_opportunities                | grantscope       | act,grantscope,justicehub          | grantscope:268 justicehub:21 act:135 ; created by act ; 811MB
644  opportunities_unified              | act              | act,grantscope                     | grantscope:2 act:62 ; 19MB
646  opportunity_decisions              | grantscope       | grantscope                         | grantscope:11
647  opportunity_promotions             | grantscope       | (none)                             | created by none found
660  org_pipeline                       | grantscope       | grantscope                         | grantscope:45 ; created by none found
775  project_pipelines                  | act              | act,grantscope                     | act:10
832  saved_grants                       | grantscope       | act,grantscope                     | grantscope:54 act:3
```

**`opportunities_unified` (17,790 rows)**, columns checked
(`id, opportunity_type, source_system, source_id, title, description, contact_name, value_low/mid/high, value_type, stage, probability,
project_codes[], contact_ids[], effort_hours, expected_close, actual_close, url, notes, metadata, created_at, updated_at`):
```sql
SELECT opportunity_type, source_system, stage, count(*) AS n, count(*) FILTER (WHERE project_codes IS NOT NULL AND cardinality(project_codes)>0) AS with_project, round(sum(value_mid)/1e6,1) AS value_mid_m, max(updated_at)::date AS last_updated
FROM opportunities_unified GROUP BY 1,2,3 ORDER BY n DESC LIMIT 25
-- grant | grant_opportunities | identified  | 15986 | 824 | 5884.6 | 2026-06-15
-- deal  | ghl_opportunities   | pursuing    |   871 | 740 |  202.9 | 2026-06-15
-- grant | grantscope          | identified  |   684 |   2 | 3235.5 | 2026-05-08
-- deal  | ghl_opportunities   | lost        |    61 |  59 |   93.8 | 2026-06-10
-- grant | grant_opportunities | submitted   |    38 |  37 |    0.8 | 2026-06-08
-- grant | grant_opportunities | pursuing    |    33 |  32 |    3.5 | 2026-06-08
-- grant | grant_opportunities | lost        |    29 |   1 |   12.4 | 2026-06-08
-- deal  | ghl_opportunities   | realized    |    28 |  28 |    1.5 | 2026-06-15
-- grant | grant_opportunities | researching |    19 |  18 |    3.0 | 2026-06-15
-- donation | fundraising_pipeline | identified | 9 | 9 | 0.5 | 2026-03-08   … (24 groups)
```
It is a **fifth grant pool**: a June-2026 copy of `grant_opportunities` (15,986 rows) plus the GHL mirror (961) plus `saved_grants`
(684, via `scripts/sync-grantscope-matches.mjs`, header: "Pulls matched grants from GrantScope's saved_grants table … Runs daily at
5am AEST") plus manual rows. It has its own stage vocabulary (identified / researching / pursuing / submitted / lost / realized /
expired) and its own `project_codes`. **It is stale (max `updated_at` 2026-06-15) and still read** by the command-center app:
`apps/command-center/src/app/api/{intelligence,briefing/morning,finance/pipeline-update,finance/revenue-reality,finance/weekly-review,
finance/accountant-pack}/route.ts` and `scripts/generate-daily-priorities.mjs` (grep `opportunities_unified` in act-global, 20 hits
incl. archives). The writers `scripts/sync-opportunities-to-unified-pipeline.mjs` ("Daily sync from source systems …") and
`populate-funding-pipeline.mjs` ("21 opportunities across 4 tiers") exist; which scheduler runs them was not found in
`scheduled-syncs.yml` (only calendar, xero, receipts, project-health, grantscope→notion, auto-archive at lines 101-303).
`project_pipelines` (63 rows) is a per-project × pipeline_name rollup computed 2026-06-15 on the OLD Goods pipeline names;
`fundraising_pipeline` (14) last touched 2026-03-06.

**act-global schedulers found (all outside grantscope's view):**
- GitHub Actions: `.github/workflows/` has 35 workflows. `sync-ghl.yml:6` `cron: '0 */6 * * *'` → `scripts/sync-ghl-to-supabase.mjs`,
  which writes `ghl_pipelines` (`:153`), `ghl_contacts` (`:215`), `ghl_opportunities` (`:387`), `ghl_sync_log` (`:436`). This is the
  `full_sync ghl_to_supabase cron` writer:
  ```sql
  SELECT operation, direction, triggered_by, status, count(*) AS n, max(started_at)::date AS last FROM ghl_sync_log WHERE started_at > now() - interval '14 days' GROUP BY 1,2,3,4 ORDER BY last DESC, n DESC
  -- ContactUpdate | ghl_to_supabase   | webhook | success | 673 | 2026-09-24   (supabase/functions/ghl-webhook/index.ts:86-192)
  -- full_sync     | ghl_to_supabase   | cron    | success |  50 | 2026-09-24
  -- gmail_sync    | gmail_to_supabase | cron    | success |  12 | 2026-09-23
  ```
  `alta-grant-scout.yml:6` `cron: '0 20 * * 0'` (weekly) → `scripts/alta-grant-scout.mjs scout|match|upcoming|at-risk|summary`
  (`:57-81`); `daily-brief.yml` 22:00 UTC → `generate-morning-brief.mjs` + `post-brief-to-notion.mjs`; `relationship-alerts.yml` 22:30.
- PM2 (`pm2 jlist`): act-global has ~35 apps, **all `stopped`** except `act-frontend` and `wiki-build-viewer` (including `ghl-sync`,
  `relationship-health`, `contact-signals`, `gmail-sync`, `verify-ghl-mirror`, `daily-briefing`). So act-global's live automation is
  GitHub Actions, not PM2. empathy-ledger-v2 has one online app (`empathy-ledger`).
- act-global scripts that touch grants/GHL (`ls scripts | grep -iE "opportun|pipeline|grant|funder|ghl"`, 40+ files): `discover-grants.mjs`
  ("Discovers grants via GrantScope engine … Scores new grants against all 26 ACT projects … Upserts to database … Auto-creates
  applications for high-fit grants"), `enrich-grant-opportunities.mjs`, `enrich-ghl-grants.mjs` (pushes `grant_opportunities` fields
  into GHL custom fields; resolves mirror UUIDs), `align-ghl-opportunities.mjs` (assigns `ghl_opportunities.project_code` from
  project-codes.json keywords, auto-assign > 0.7), `backfill-grant-project-codes.mjs`, `auto-archive-expired-grants.mjs`,
  `sync-grantscope-matches.mjs`, `sync-opportunities-to-unified-pipeline.mjs`, `populate-funding-pipeline.mjs`, `alta-grant-scout.mjs`,
  `audit-goods-buyer-pipelines.mjs`, `cleanup-goods-buyer-pipeline.mjs`, `cleanup-stale-ghl-opps.mjs`, `backfill-funder-context-from-xero.mjs`.
  None read. `ghl_opportunities.project_code` (present on 200 of 239 open Grants rows, query in §2.2 of actions? no: my query below) is
  act-global's tagging, a sixth project vocabulary:
  ```sql
  SELECT pipeline_name, status, count(*) AS n, count(project_code) AS with_project, max(ghl_updated_at)::date AS last_ghl_update FROM ghl_opportunities GROUP BY 1,2 ORDER BY 1,2
  -- Grants | open | 239 | 200 | 2026-08-30 ;  Grants | lost | 52 | 41 | 2026-08-30
  -- GOODS - Funding | open | 59 | 37 | 2026-09-20 ; won 5 ; lost 4 ; abandoned 1
  -- GOODS - Buyers | open 8 | won 2 | abandoned 12 ;  GOODS - Demand | open 75 ;  GOODS - Community | open 16
  -- CONTAINED Engagement | open | 176 | 172 | 2026-09-13 ;  Harvest Membership Journey | open 316 ; Harvest Inbox won 70 ; The Shop pipeline open 36
  -- (33 groups; 115 rows under the three retired Goods names, last synced 2026-06-08)
  ```

**JusticeHub:** `grep -rl` over `/Users/benknight/Code/justicehub` (excl. node_modules/.next): `alma_funding_opportunities` 25 files,
`grant_opportunities` 12, `saved_grants` 1, `org_pipeline` 1, `opportunities_unified` 1, `act_grant_recommendations` 1. Scripts:
`scripts/alma-funding-scrape.mjs`, `scripts/alma-weekly-report.ts`, `scripts/pipelines/run.mjs`, four `scripts/audit/funding-*-smoke.mjs`;
migrations `20260120000001_alma_funding_opportunities.sql` (the table's creator, with triggers at `:107,128` and an UPDATE at `:297`),
`20260228000004_funding_relationship_engagements.sql`, `20260301000004_funding_application_draft_workspace.sql` (JusticeHub has its
own application-draft workspace FK'd to ALMA). Workflows with a cron: `alma-ingestion.yml`, `weekly-funding-scrape.yml` (plus three
unrelated). No `.from('alma…').insert/upsert` in TS found by my narrow grep; the scrape script is the likely writer. empathy-ledger-v2:
only archived 2025 code references grants (5 files under `archive/`), so it is out.

**Why it matters for the design:** the six projects include JusticeHub, and JusticeHub owns and ingests the ALMA corpus that grantscope's
P2 engine scores. act-global owns the GHL mirror, tags `ghl_opportunities.project_code` itself, pushes grants to Notion daily, and keeps a
17,790-row unified pipeline that the CEO cockpit reads. A one-place design that does not name which of these keep writing, and which
are retired, will be a sixth pool.

### 3.B GHL as the system of record (the mirror is the only thing readers looked at)

Beyond §2.2-2.3: `ghl_opportunities` columns include `project_code, xero_invoice_id, received_date, acquittal_due_date, acquittal_status,
pile, last_stage_change_at, last_status_change_at, sync_status` (checked), i.e. act-global has already put "grant lifecycle after award"
on the mirror row (acquittal, received). No grantscope surface reads those. The design's "decide → pursue mints in GHL → GHL owns state"
loop needs: the stage vocabulary of `Grants` (7 stages, above) and `GOODS - Funding` (10 stages) as the canonical state machine; a
read-back keyed on `ghl_id`, not `pipeline_name`; a rule for the 290 UUID-shaped ids; and pruning of the 115 orphans. Nobody read
`supabase/functions/ghl-webhook/index.ts` beyond its write lines, `apps/web/src/lib/ghl.ts`, or act-global's `sync-ghl-to-supabase.mjs`.
The GHL MCP (`mcp__claude_ai_GHL_New`) is available for a read-only cross-check of live pipelines against the mirror; not used by any reader.

### 3.C The one pool: `v_funding_opportunities`, `mv_search_index`, private rounds, the hybrid RPC

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='v_funding_opportunities' ORDER BY ordinal_position
-- origin, origin_id, opportunity_key, name, funder, description, amount_min, amount_max, closes_at, is_open, url, categories, focus_areas,
-- source, grant_type, foundation_id, verification_status, alma_opportunity_type, is_national, jurisdictions, eligible_org_types,
-- requires_dgr, in_alma, created_at, updated_at, href   (26)
SELECT position('act_private_grant_rounds' in pg_get_viewdef('v_funding_opportunities'::regclass)) AS pos_private,
       position('project_relevance' in …) AS pos_relevance, position('aligned_projects' in …) AS pos_aligned,
       position('goods_relevance' in …) AS pos_goods, position('dgr_required' in …) AS pos_dgr, length(pg_get_viewdef(…)) AS def_len
-- 0 | 0 | 0 | 0 | 0 | 6189
```
So the sanctioned read path (memory `solution_unified_funding_view`) has the ALMA-side `requires_dgr`/`jurisdictions`/`eligible_org_types`
but **none of the P1 fit signal, none of the per-entity eligibility flags (`dgr_required`, `accepts_pty_ltd`), and not the 619 live private
rounds**. A desk built on it today would show 29,563 rows with no project fit. Either the view grows those columns (a migration, SAFE) or
the desk keeps reading `grant_opportunities` + `act_private_grant_rounds` directly (what `act-grants-desk.ts:128-142` does).

```sql
SELECT kind, count(*) AS n FROM mv_search_index GROUP BY kind ORDER BY n DESC
-- company 272530 | charity 55752 | person 39757 | grant_round 24831 | social_enterprise 12204 | foundation 11235 | program 9584 | indigenous_corp 8498 | government_body 3943 | postcode 3246 | intervention 923 | place 662
SELECT position('act_private_grant_rounds' in pg_get_viewdef('mv_search_index'::regclass)) AS private_rounds, position('grant_opportunities' in …) AS grant_opps, position('alma_funding' in …) AS alma, position('foundation_programs' in …) AS fp
-- 0 | 4377 | 0 | 0
```
The search index can back the one place's search box for grants (`grant_round` from `grant_opportunities`; which 2,072 of 26,903 are
excluded was not checked), foundations, people, places and programs, but **not** ALMA rows, foundation_programs or private rounds.

Not read by anyone: `search_project_funding_hybrid` (the RPC behind `/funding`'s five-place queue; `pg_get_functiondef` not pulled),
`project_funding_profiles` columns (14 rows, all `partial`), `act_private_grant_rounds` columns and `scripts/sync-act-private-grant-rounds.mts`
beyond its header. If the redesign keeps one grant engine, these are the two it has not looked inside.

### 3.D The people / "who to call" layer

```sql
SELECT 'act_people', count(*) FROM act_people UNION ALL SELECT 'org_contacts', count(*) FROM org_contacts UNION ALL SELECT 'contact_entity_links', count(*) FROM contact_entity_links
UNION ALL SELECT 'person_identity_map', count(*) FROM person_identity_map UNION ALL SELECT 'ghl_contacts', count(*) FROM ghl_contacts
UNION ALL SELECT 'ghl_contacts_with_tags', count(*) FROM ghl_contacts WHERE tags IS NOT NULL AND cardinality(tags)>0 UNION ALL SELECT 'foundation_people', count(*) FROM foundation_people
-- 0 | 102 | 643 | 14919 | 5588 | 3812 | 33
SELECT count(*) AS n, count(ghl_contact_id) AS with_ghl, count(*) FILTER (WHERE funding_capacity IS NOT NULL) AS with_funding_capacity, count(*) FILTER (WHERE current_company IS NOT NULL) AS with_company, count(*) FILTER (WHERE last_communication_at > now() - interval '90 days') AS talked_90d, max(updated_at)::date FROM person_identity_map
-- 14919 | 643 | 0 | 13682 | 0 | 2026-03-19
SELECT contact_type, count(*) AS n, count(linked_entity_id) AS linked_entity, count(person_id) AS person, count(goods_relationship_id) AS goods_rel, count(project_id) AS project, max(last_contacted_at)::date FROM org_contacts WHERE org_profile_id='8b6160a1-7eea-4bd2-8404-71c196381de0' GROUP BY 1 ORDER BY n DESC
-- funder 37 (24 linked, 0 person, 2 goods_rel, 20 project, never contacted) | partner 19 | advisory 12 | governance 5 | advocacy 2 | community 1   (76)
SELECT split_part(t, ':', 1) AS fam, count(DISTINCT c.id) AS contacts FROM ghl_contacts c, unnest(c.tags) t WHERE t ~ '^(goods|funder|philanthrop|foundation|buyer|place|project|act-|warm|hot|cold)' GROUP BY 1 ORDER BY contacts DESC LIMIT 15
-- project 1367 | place 252 | goods-inquiry 65 | goods-newsletter 53 | goods-warm 52 | act-inquiry 48 | act-gd 40 | philanthropic 39 | goods 34 | project-goods 24 | goods-supporter 22 | goods-tier-aware 21 | goods-capital-target 17 | goods-cooling 14 | act-regenerative-studio 14
```
Columns checked: `act_people (org_profile_id, ghl_contact_id, name, warmth, warm_via, owner, next_action, review_by, ghl_task_id,
last_touch_at, last_synced_at, minted_by, project_codes…)`, `org_contacts (…linked_entity_id, project_id, person_id, goods_relationship_id,
engagement_ask…)`, `contact_entity_links (contact_id, entity_id, confidence_score, link_method, verified…)`, `person_identity_map`
(38 columns incl. `ghl_contact_id, funding_capacity, current_company, tags, unified_tags, last_communication_at`), `foundation_people`.
Reading: the person→entity crosswalk exists in three places (contact_entity_links 643, person_identity_map 643 GHL-linked, org_contacts
24 funder contacts linked to an entity) and none is fresh or ACT-scoped; the desk's `person` kind reads an empty table. The philanthropy
reader's funder-row spec (§8) lists "named people + warm path" as "thin"; nobody measured how thin, or which table a design should read.

### 3.E Smaller gaps

- **Production auth env** (shell-auth §11): whether prod middleware verifies sessions or trusts the cookie depends on `FAST_LOCAL_AUTH` /
  `NEXT_PUBLIC_FAST_LOCAL_AUTH` in Vercel. `/config-truth`. Not design-blocking; blocking for calling the place "signed-in".
- **`funders.json`** (25 entries, act-global) is the only pitch memory and is in another repo; the philanthropy reader found it, nobody
  asked whether act-global reads it in a job (`backfill-funders-json-from-xero.mjs`, `draft-funder-newsletter.mjs` exist in the listing).
- **`opportunity_promotions`** writer (7 rows, 2026-08-11): still not located; it is not in act-global's live scripts either (only
  `archive/scripts-retired-2026-03/`), so it may have been a hand run.
- **Consent** for tying money to communities (memory `project_place_data_day`: step 5 blocked on in-person consent) was not raised by the
  communities reader; the design's "ties them to the communities served" edge needs the consent rule stated.

---

## 4. Load-bearing claims marked inferred/unverified that should be checked

| claim | reader | status after today | what still to check |
|---|---|---|---|
| Jev nightly ran (success) | periphery §1c | **wrong**; failed (`agent_tasks`) | pm2 restart, then confirm `goods_rubric_read > 0` |
| Goods GHL boards rebuilt under new ids | actions §F3 (inferred) | **resolved**: same ids/stages, renamed, +1 new pipeline | prune 115 orphan mirror rows; `project_pipelines` stale |
| 725 ids from an unlocated 2026-09-20 backfill | actions §A1 (inferred) | author still unknown; **key shape measured**: 290 UUIDs, 40 of 114 live unresolvable | read act-global `enrich-ghl-grants.mjs` + `sync-grantscope-matches.mjs` for the writer |
| ALMA dupes from a 1,000-row cap | grant-data-model §6.2 | mechanism right, cap is 10,000 | none; paginate |
| Notion dormant | actions §D, periphery §7.3 | **wrong at ACT level**: act-global daily push | read `sync-grantscope-to-notion.mjs:100-160` for the filter and Notion DB ids |
| `v_funding_opportunities` is the read path for the collapse | periphery §8 F, grant-data-model §9.4 | **it lacks fit, eligibility and private rounds** | decide: widen the view or keep reading tables |
| `reconcile-foundations-ghl` succeeds while `sync-goods-ghl` 401s: token scope | actions §F2 (inferred) | periphery §7.2 verified the real cause (PM2 env shadowing) | none |
| prod middleware strict vs cookie | shell-auth §1.2 | unverified | `/config-truth` |
| `GHL_GRANTS_TRIAGE_CONTACT_ID` etc. set in Vercel | actions §6 | unverified | `/config-truth` |
| memory "$916M across 724 funders" | philanthropy §7 | not reproduced; inferred size floor | re-derive from `acnc_ais` with the filter written down |
| `goods-procurement-matcher.mjs` grant-matching method | communities §7.4 | unread | read `:91-142` (buyers reader did: `goods_relevance_score>=30` + geography + amount band) — covered, mark verified |
| `hydrate-goods-procurement.mjs` never orchestrated | buyers §9 | unverified | `agent_runs` by agent_id |

---

## 5. Which subsystems got a shallow read

1. **Everything outside grantscope** (act-global's 40+ grant/GHL scripts, 35 workflows, command-center routes; JusticeHub's ALMA ingest
   and funding workspace). Zero lines read by any reader. §3.A.
2. **GHL itself** (live pipelines, stage semantics, custom fields such as `discovery_source`, which the mirror does not carry:
   `with_discovery_source = 0` on every mirror group in my query, so the idempotency stamp A1/A6 write is invisible in Supabase).
3. **The hybrid engine** (`search_project_funding_hybrid`, `project_funding_profiles`, embeddings) and **private rounds**
   (`act_private_grant_rounds` columns, the `.mts` sync) — surfaces read, internals not.
4. **People** — §3.D.
5. **`/org/act/[projectSlug]`** (2,055 lines) and **`act-operating-desk.tsx`** (2,106 lines): both readers took imports/greps only; the
   Curiosity/Triage/Pipeline/Money views' writes were catalogued but their read logic (what "Best opportunities" is) was not.
6. **`act-funder-intelligence.ts`** (870-line dossier desk) — catalogued by three readers, read by none end to end.

---

## 6. Follow-up reader briefs (most valuable first)

### Brief A — The other hands on the money tables (act-global-infrastructure and JusticeHub)

Question: which jobs outside grantscope write or read `grant_opportunities`, `ghl_opportunities`/`ghl_contacts`/`ghl_pipelines`,
`opportunities_unified`, `saved_grants`, `alma_funding_opportunities`, and Notion, on what schedule, with what stage/project vocabulary,
and which of them must be retired, re-pointed or kept when ONE place exists.
Files: `/Users/benknight/Code/act-global-infrastructure/.github/workflows/{scheduled-syncs,sync-ghl,alta-grant-scout,daily-brief,relationship-alerts,master-automation}.yml`;
`scripts/{sync-ghl-to-supabase,sync-grantscope-to-notion,sync-grantscope-matches,sync-opportunities-to-unified-pipeline,populate-funding-pipeline,
discover-grants,enrich-grant-opportunities,enrich-ghl-grants,align-ghl-opportunities,backfill-grant-project-codes,auto-archive-expired-grants,
alta-grant-scout,cleanup-stale-ghl-opps,generate-daily-priorities}.mjs`; `apps/command-center/src/app/api/{intelligence,briefing/morning,finance/*}/route.ts`;
`wiki/narrative/funders.json` readers. JusticeHub: `.github/workflows/{alma-ingestion,weekly-funding-scrape}.yml`, `scripts/alma-funding-scrape.mjs`,
`scripts/pipelines/run.mjs`, `supabase/migrations/20260301000004_funding_application_draft_workspace.sql`, and any `/funding` pages.
Tables: `opportunities_unified` (17,790; stale 2026-06-15), `project_pipelines` (63), `fundraising_pipeline` (14), `ghl_opportunities.project_code`,
`ghl_sync_log`, `alma_funding_opportunities` (scrape_source by repo), `funding_application_drafts` (or whatever `20260301000004` created).
Questions: (1) Who writes the 725 `ghl_opportunity_id` values and in which key shape (real GHL id vs mirror UUID)? (2) What filter does
`sync-grantscope-to-notion.mjs` use and which Notion DBs does it write — is it the same "Grant Pipeline Tracker" the retired
`sync-pipeline-to-notion.mjs` targeted? (3) Is anything still writing `opportunities_unified`, and what breaks in the command-center if
it is frozen or dropped? (4) Which act-global job assigns `ghl_opportunities.project_code`, with which code list, and does it agree with
`aligned_projects`/`act_grant_recommendation_projects`? (5) Does JusticeHub write ALMA on a schedule, and does JusticeHub's funding
workspace hold decisions on ALMA rows that grantscope's `act_grant_recommendation_decisions` does not know? (6) Which of these jobs run
(GitHub Actions cron lines, last run via `gh run list -R <repo>` read-only) versus exist. Deliverable: a table job → schedule → reads →
writes → vocabulary → keep/retire/re-point.

### Brief B — GHL as the system of record: mirror truth, key shapes, the state machine

Question: what state does GHL actually hold for grants, funders and buyers today, how faithfully does the Supabase mirror carry it,
and what exact contract must "pursue → mint in GHL → read back" satisfy.
Files: `supabase/functions/ghl-webhook/index.ts`; `apps/web/src/lib/ghl.ts`; `apps/web/src/lib/services/{goods-grant-ghl,goods-buyer-ghl,
funding-ghl,act-ghl-task-bridge}.ts`; `scripts/{sync-goods-ghl,reconcile-foundations-ghl,sync-ghl-to-tracker,seed-goods-grants-ghl}.mjs`;
act-global `scripts/sync-ghl-to-supabase.mjs` and `enrich-ghl-grants.mjs:200-340` (mirror-UUID resolution); memory `project_ghl_goods_opportunity_tracking.md`.
Tables: `ghl_pipelines` (19; stages jsonb), `ghl_opportunities` (1,322; `custom_fields`, `project_code`, `acquittal_*`, `sync_status`),
`ghl_contacts` (5,588; tags), `ghl_sync_log`, `grant_opportunities.ghl_opportunity_id` (725), `org_project_foundations.ghl_*` (23),
`goods_procurement_entities.ghl_*` (26), `goods_relationships.ghl_opportunity_id`.
Questions: (1) For the 114 live grants marked in GHL: which 60 are open in the Grants pipeline and at which stage; what are the 40
unresolvable ids; can the 290 UUIDs be rewritten to real ids from the mirror (act-global has the resolver)? (2) Does the mirror carry
`discovery_source` (the idempotency stamp) anywhere — my query says `custom_fields` never contains it — and if not, what is the
idempotency key for a second pursue? (3) Why has the Grants pipeline not changed since 2026-08-30 while GOODS - Funding changed
2026-09-20: are grants being worked in GOODS - Funding now? (4) Do the 59 open GOODS - Funding rows correspond to `org_project_foundations`
(23 synced) or `goods_relationships` funder rows (172), and by which key? (5) Prune plan for the 115 orphan old-name rows. (6) Read-only
cross-check of live GHL against the mirror with the GHL MCP (`list pipelines`, a few opportunities), reporting drift. Deliverable: the
canonical stage vocabulary per pipeline, the key contract (which column, which id shape), and the read-back rule the one place should use
for "in GHL / stage / last touch".

### Brief C — The one pool: what a single grant row can carry today

Question: if the desk reads ONE source for "a fundable thing", which source, and which columns are missing for the row contract
(project · fit keyword+Jev+tagged_by · close date · amount · entity that can apply · place · source · in-GHL).
Files: `pg_get_viewdef('v_funding_opportunities')` (6,189 chars, not yet read), the migration that created it (grep `v_funding_opportunities`
in `supabase/migrations/`); `pg_get_functiondef('search_project_funding_hybrid'::regproc)`; `apps/web/src/lib/services/project-funding-service.ts:183-310`;
`scripts/sync-act-private-grant-rounds.mts` (whole file) and `scripts/lib/upsert-grant-opportunities.mjs`; `pg_get_viewdef('mv_search_index')`
around offset 4377 (the grant_round branch) and `search_index_query`; `apps/web/src/lib/services/act-grants-desk.ts:57-142`.
Tables: `v_funding_opportunities` (29,563), `act_private_grant_rounds` (665; columns via information_schema first), `project_funding_profiles`
(14), `mv_search_index` (`grant_round` 24,831 of 26,903 — which 2,072 are excluded and why), `grant_opportunities.metadata->'place'` (1 row).
Questions: (1) Exact definition of `v_funding_opportunities`: which GO statuses count as `is_open`, how ALMA enrichment is joined (by name),
what `opportunity_key` looks like, and whether adding `project_relevance`, `aligned_projects`, `goods_relevance_score`, `dgr_required`,
`accepts_pty_ltd`, `ghl_opportunity_id` and a UNION of private rounds is a view change or a model change. (2) What the hybrid RPC scores on
(embeddings of what, against which profile text) and whether it survives if P2/ALMA is retired. (3) Private rounds: columns, how "live" is
defined there, geography/eligibility coverage, and whether the ToU question (Our Community, unanswered since 2026-09-14) makes them a
separate lane by policy. (4) Measure the pool under each candidate definition: rows, dated, tagged, with fit ≥ threshold, per project,
with eligibility known. Deliverable: one SQL that returns the row contract for the desk from one source, with the missing columns named.

### Brief D — Who to call: the person and contact layer under funders and buyers

Question: when the one place says "pursue", which table gives the person, their warmth and the warm path, and how fresh is it.
Files: `apps/web/src/lib/services/{act-people-directory,act-desk-people,act-relationship-ledger,act-funder-intelligence}.ts` (the
contact-resolution and board-bridge parts: `act-funder-intelligence.ts:609-918`), `apps/web/src/app/org/[slug]/people/*`,
`apps/web/src/app/api/org/[orgProfileId]/{people,contacts/sync-ghl,contact-resolution}/route.ts`, `apps/web/src/lib/ghl.ts:183-229`;
act-global `scripts/{relationship-alerts,backfill-ghl-contact-projects,contact-signals?}.mjs` (headers) and the seed's owner of `person_identity_map`.
Tables (columns checked today, see §3.D): `act_people` (0), `org_contacts` (102; ACT 76), `contact_entity_links` (643), `person_identity_map`
(14,919; 643 GHL-linked; stale 2026-03-19), `ghl_contacts` (5,588; 3,812 tagged; tag families above), `foundation_people` (33),
`funder_board_paths` (2,651, all unverified), `mv_person_entity_network`, `person_roles` (340K, filtered by entity only).
Questions: (1) Why is `act_people` empty when the desk, the digest and the GHL task bridge all read it — was it never minted, or is there a
mint path that failed? (2) For the 37 ACT funder contacts and the 91 `funder_context_snapshot` rows with GHL contacts, which table links a
funder entity to a person with an email, and how many funders on the desk have at least one? (3) Which GHL tag families are the working
warmth signal (`goods-warm/cooling/hot`, `philanthropic`, `place:`), who writes them, and can the one place read warmth from `ghl_contacts.tags`
directly instead of the per-table `ghl_*` caches? (4) Is `person_identity_map` (act-global) the intended person spine or dead (no
communication since 2026-03)? (5) Board bridges: is `v_goods_foundation_targets.has_bridge` (75) or `funder_board_paths` (20 ACT-reachable)
the one to surface, and what does "verified" require? Deliverable: the person sub-row for a funder/buyer card (name, role, email present?,
warmth, last touch, via) with its source table and freshness, and the count of desk rows that would have one.

---

## 7. Not proposed (and why)

- `/config-truth` on prod auth and the GHL/Notion/Resend env vars: needed before shipping, not before designing; it is a checklist item
  the periphery reader already listed (Group B/D).
- Reading the 2,055-line project page and 2,106-line operating desk end to end: their writes are catalogued; the design intends to retire
  the `?view=` lenses (shell comment L85 "One Desk IS today"), so their read logic matters only for what to redirect.
- Jev feedback-loop design: the jev reader's §12 is a complete, specific proposal (table, scorer hook, measurement script); nothing to read
  further, only Ben's rulings (widen Goods prose? may Jev overturn a keyword tag?).

---

## 8. Facts (verified = I read the file or ran the query today; inferred = derived; unverified = taken from a notes file or memory without a second source)

- verified: all ten notes files read in full (4,021 lines).
- verified: `agent_tasks` `score-project-rubric` failed `Unknown agent` 2026-09-24 06:46:02Z; `score-goods-relevance` completed.
- verified: `ghl_pipelines` 19 rows; ids `JvBFYpVpyKsw899lkFgj`/`FjMyJM3YzWQFmKqR9fur`/`UQsrmuqzxMSdCTklxEcG` now named GOODS - Funding/Buyers/Demand; `0m9teeEQFiq6I7GB5xiP` GOODS - Community; `scom3L0kNwA1W0zPIzMe` Grants (7 stages); stage ids match `scripts/sync-goods-ghl.mjs:60-75` prefixes.
- verified: `ghl_opportunities` Grants open 239 / lost 52, max `ghl_updated_at` 2026-08-30; GOODS - Funding open 59; 115 rows under retired names, 0 also under new names.
- verified: `grant_opportunities.ghl_opportunity_id`: 725 set, 290 UUID-shaped, 114 live, 64 resolve by `ghl_id` (60 open), 10 by mirror UUID, 40 unresolvable; 251 of 725 match a mirror row overall.
- verified: `v_funding_opportunities` 26 columns as listed; view text contains none of `act_private_grant_rounds`, `project_relevance`, `aligned_projects`, `goods_relevance`, `dgr_required`.
- verified: `mv_search_index` kinds and counts as listed; definition references `grant_opportunities` (offset 4377) and not ALMA/foundation_programs/private rounds.
- verified: ownership seed lines 56, 107, 349, 364-365, 377, 379-381, 423, 644, 646-647, 660, 775, 832 as quoted.
- verified: `opportunities_unified` 17,790 rows, groups as listed, max `updated_at` 2026-06-15; `project_pipelines` 63 computed 2026-06-15 on old pipeline names; `fundraising_pipeline` 14 (2026-03-06); `funding_ghl_sync_runs` 556, last 2026-09-05.
- verified: act-global `scheduled-syncs.yml:10,101-303` (daily 20:00 UTC; `sync-grantscope-to-notion.mjs`, `auto-archive-expired-grants.mjs`), `sync-ghl.yml:6` (`0 */6 * * *`), `alta-grant-scout.yml:6,57-81` (weekly), `daily-brief.yml:6,48,56`, `relationship-alerts.yml:6,50`; `sync-grantscope-to-notion.mjs:122` reads `grant_opportunities`; `sync-ghl-to-supabase.mjs:153,215,387,436` writes the four GHL tables; `enrich-ghl-grants.mjs:23,200,310` mirror-UUID note and resolver; headers of `discover-grants`, `align-ghl-opportunities`, `sync-grantscope-matches`, `sync-opportunities-to-unified-pipeline`, `populate-funding-pipeline`, `auto-archive-expired-grants` as quoted.
- verified: `pm2 jlist`: act-global apps all stopped except `act-frontend`, `wiki-build-viewer`; grantscope `orchestrator` and `db-saturation-snapshot` online; `crontab -l` has two lines (ACT Farm weekly review; grantscope `scheduler.mjs` every 6h).
- verified: `ghl_sync_log` last 14 days: webhook ContactUpdate 673 (to 2026-09-24), cron full_sync 50 (to 2026-09-24), gmail_sync 12; `supabase/functions/ghl-webhook/index.ts:86-192` writes `ghl_contacts`, `ghl_opportunities`, `ghl_sync_log`.
- verified: JusticeHub file counts per table; scripts and migrations listed; workflows `alma-ingestion.yml`, `weekly-funding-scrape.yml` carry a cron; empathy-ledger-v2 references are archive-only.
- verified: `promote-grant-opportunities-to-alma.mjs:152-161` unpaged select; `agent_runs` `items_found 10000` on 09-18/22/23, `items_new` 651/0/0.
- verified: people-layer counts and column lists in §3.D; `person_identity_map` max `updated_at` 2026-03-19, 0 `funding_capacity`, 0 `last_communication_at` in 90d; ACT `org_contacts` 76 by type; `ghl_contacts` tag families.
- inferred: the writer of the daily mirror `full_sync` is act-global's `sync-ghl.yml` → `sync-ghl-to-supabase.mjs` (cron line + `triggered_by='cron'` + write lines; not traced through a run log).
- inferred: the 115 old-name mirror rows are deletions/moves in GHL not pruned (from `also_under_new_name = 0` and `last_synced_at` 2026-06-08).
- inferred: the client row cap on this project is 10,000 (from `items_found 10000` across three runs).
- unverified: which act-global job (if any) still writes `opportunities_unified`; which script wrote the 725 ids on 2026-09-20; JusticeHub's ALMA writer is `scripts/alma-funding-scrape.mjs` (name only); `alta-grant-scout.mjs` write targets; whether `gh run list` would show the act-global workflows actually succeeding.
