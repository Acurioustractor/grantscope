# ghl-system-of-record — follow-up reader notes (2026-09-24)

Brief: critic.md §2.2, §2.3, §3.B, Brief B; actions-and-pipelines.md §A, §F. Read-only. GHL was read
through the `mcp__claude_ai_GHL_New` MCP (GET only: get-pipelines, search-opportunity, get-opportunity).
Nothing was created or updated in GHL, Supabase or the repo. All SQL ran through
`node --env-file=.env scripts/gsql.mjs`. Confidence marks: **verified** = I read the file or ran the
query today; **inferred** = derived from verified data; **unverified** = taken on faith.

## 0. Verdict in one screen

1. **The mirror is faithful, but only its `sync_status = 'synced'` subset is GHL.** 562 of the 1,322
   `ghl_opportunities` rows (42.5%) are soft-deleted (`sync_status='deleted'`), including **259 of the
   291 "Grants" rows**. Every reader in both repos that groups by `pipeline_name` without that filter
   (the critic's "239 open / 52 lost", actions §F3, act-global `sync-grants-ghl.mjs`,
   `enrich-ghl-grants.mjs`, `cleanup-stale-ghl-opps.mjs`) is counting ghosts. Live GHL Grants holds
   **32 opportunities: 16 open at "Grant Opportunity Identified", 16 lost at "Grant Declined"**
   (verified live via MCP and identical in the mirror: zero row-level drift on status, stage, contact,
   updatedAt across all five money pipelines, 213 rows compared).
2. **Of the 114 live grant rounds the desk labels "in GHL", zero are in GHL.** 64 point (by `ghl_id`)
   at soft-deleted mirror rows, 10 point (by mirror UUID) at soft-deleted mirror rows, 40 point at ids
   the mirror has never held; two of those 40 return `404 OPPORTUNITY_NOT_FOUND` live. The desk's rule
   `inGhl = Boolean(g.ghlOpportunityId)` (`apps/web/src/lib/services/act-one-desk.ts:223`) is wrong for
   114 of 114 rows. Its "Work the application" state has no working case today.
3. **Who stamped the 725 ids (A1, now resolved):** act-global `scripts/sync-grants-ghl.mjs`, a
   6-hourly pm2 job that (step 1, `:137-207`) name-matches mirror Grants rows to `grant_opportunities`
   and writes **the mirror's Supabase UUID** (`ghl.id`, `:177` and `:191`) as `ghl_opportunity_id`, and
   (step 2, `:297-389`) creates GHL opportunities on a **deleted test contact**
   (`DEFAULT_CONTACT_ID = 'AXrbvQAQKR0TcTcZL71H'` = `benjamin+test.1768173444591@act.place`,
   `ghl_contacts.sync_status='deleted'`) and writes back the real id (`:377`). 243 of the 259 deleted
   Grants rows sit on that contact. It reads the mirror with no `sync_status` filter (`:108-111`), so it
   keeps linking grants to dead rows. The 290 UUID-shaped ids all resolve to `deleted` rows; rewriting
   them to real ids is mechanical but yields 290 more dead links. The `discovered_by='ghl_sync'` rows
   stopped being created 2026-06-16; the job is not in the local pm2 list today (46 processes, only
   `ghl-sync` and `verify-ghl-mirror` are GHL jobs).
4. **`discovery_source` IS in the mirror.** `custom_fields` is a jsonb **array** of
   `{"id","type","fieldValueString"|"fieldValueNumber"|"fieldValueDate"}`; 127 Grants rows carry field
   `eZoHX9Y7dIZBhXM3i6Kx`, 15 of them with a `civicgraph-engine:<uuid>` stamp, and all 15 are among the
   16 live open Grants rows. The critic's "never contains it" was a wrong-shaped query. The idempotency
   key for a second pursue is `(pipeline_id, discovery_source = 'civicgraph-grant:<grant_id>')`, checked
   first against `ghl_opportunity_id -> synced mirror row`, then against the mirror's `custom_fields`,
   then live.
5. **Grants is frozen because nothing touches it.** All 32 live rows have `updatedAt 2026-08-30 09:58`
   (one bulk write), no stage change since 2026-08-10, and the four act-global writers
   (`sync-grants-ghl`, `enrich-grants-ghl`, `ghl-cleanup-auto`, `grant-seed-weekly`) are in
   `ecosystem.config.cjs` but not running. Goods grants are being worked in **GOODS - Funding**: the five
   grant programs marked "Grant Declined/lost" in Grants on 2026-07-02 (Sisters of Charity, SEDI, FRRR,
   First Nations Clean Energy, ANZ Seeds) are open in GOODS - Funding at Identified/Qualified/Ask made,
   alongside Rotary Global Grant, REAL Innovation Fund and QBE at "Ask made".
6. **GOODS - Funding's 59 open rows key to `goods_relationships` by `ghl_opportunity_id` (59/59),**
   not to `org_project_foundations` (10/59 by `ghl_contact_id`). `goods_relationships` has its own rot:
   45 rows in 20 groups share a `ghl_opportunity_id` (dedupe key is `type:lower(name)`, so a rename in
   GHL mints a second row), 24 rows point at deleted opps, and its feeder `sync-goods-ghl` has 401'd on
   every run since 2026-09-23 02:04 UTC with the same token bytes act-global's `ghl-sync` used
   successfully at 02:00 UTC today.
7. **The 115 old-name orphans are already `sync_status='deleted'`.** The prune is a filter, not a
   delete: every reader adds `sync_status='synced'`; `goods_relationships` retires its 24 dead-opp rows;
   `ghl_pipelines` drops the 8 of 19 pipelines that no longer exist live; the three old labels in
   `scripts/sync-goods-ghl.mjs:50-54` and `apps/web/src/lib/ghl.ts:25-29` become the live names.

## 1. What GHL holds today (live, read-only via MCP)

`get-pipelines` (locationId `agzsSZWgovjwgpcoASWG`) returned **11 pipelines**. The mirror
`ghl_pipelines` holds 19; the 8 extra (ACT Dinners, ACT Events, CONTAINED Adelaide 2026, EL — Sittings,
Empathy Ledger, Festivals, Mukurtu Node Activation, Supporters & Donors) no longer exist in GHL. The
sync upserts pipelines and never prunes (`act-global-infrastructure/scripts/sync-ghl-to-supabase.mjs:143-181`).

Renames, from live `dateUpdated`: GOODS - Buyers `2026-08-13T03:17`, GOODS - Demand `2026-08-13T03:19`,
GOODS - Funding `2026-08-13T03:19` (created `2026-05-27` as "Goods Supporter Journey"), GOODS - Community
created `2026-07-24`, updated `2026-08-13`. Stage ids are unchanged; the critic's §2.2 "same ids, same
stage ids, new names, one new pipeline" holds and the rename date is now known. **Verified.**

### Live opportunity counts vs mirror (`sync_status='synced'`), row-level diff

| pipeline | live (meta.total) | mirror synced | status/stage/contact/updatedAt drift | mirror synced not live |
|---|---|---|---|---|
| Grants | 32 (16 open @ Identified, 16 lost @ Declined) | 32 | 0 | 0 |
| GOODS - Funding | 69 (59 open, 5 won, 4 lost, 1 abandoned) | 69 | 0 | 0 |
| GOODS - Buyers | 21 (8 open, 2 won, 11 abandoned) | 21 | 0 | 0 |
| GOODS - Demand | 75 (75 open) | 75 | 0 | 0 |
| GOODS - Community | 16 (16 open) | 16 | 0 | 0 |

Method: the MCP `search-opportunity` results were parsed to `(id, status, stage, updatedAt, contactId)`
and joined to the mirror with a `VALUES` CTE (`scratchpad/drift.sql`, `scratchpad/live-buyers-demand.sql`):

```sql
WITH live(pipeline,id,status,stage8,updated_at,stage_changed_at,contact_id) AS (VALUES ...213 rows...)
SELECT l.pipeline, count(*) AS live_n, count(m.ghl_id) AS in_mirror_synced,
  count(*) FILTER (WHERE m.ghl_id IS NOT NULL AND m.status<>l.status) AS status_drift,
  count(*) FILTER (WHERE m.ghl_id IS NOT NULL AND left(m.ghl_stage_id,8)<>l.stage8) AS stage_drift,
  count(*) FILTER (WHERE m.ghl_id IS NOT NULL AND m.ghl_contact_id<>l.contact_id) AS contact_drift,
  count(*) FILTER (WHERE m.ghl_id IS NOT NULL AND abs(extract(epoch FROM (m.ghl_updated_at - l.updated_at::timestamptz)))>60) AS updated_at_drift,
  (SELECT count(*) FROM ghl_opportunities x WHERE x.pipeline_name=l.pipeline AND x.sync_status='synced'
     AND x.ghl_id NOT IN (SELECT id FROM live WHERE pipeline=l.pipeline)) AS mirror_synced_not_live
FROM live l LEFT JOIN ghl_opportunities m ON m.ghl_id=l.id AND m.sync_status='synced' GROUP BY l.pipeline
-- GOODS - Funding | 69 | 69 | 0 | 0 | 0 | 0 | 0
-- Grants          | 32 | 32 | 0 | 0 | 0 | 0 | 0
```
**Verified.** The mirror, filtered to `synced`, is GHL as of the last 6-hourly sync.

### Spot checks (`get-opportunity`)
- `krUbfjW8msPlNrgejOZx` "Women's Economic Empowerment Grant": live stage `8124c61a…` Identified, open,
  createdAt 2026-07-06, updatedAt 2026-08-30T09:58:48, contact `uAsIUWBHez3DzVex8rtm` (GrantScope Triage),
  customFields include `eZoHX9Y7dIZBhXM3i6Kx = civicgraph-engine:8825e35f-…` and a Notion URL in
  `8SOTqBVuOygiDThrwtC2`. Mirror row identical. **Verified.**
- `ZzPJCLAq3nkAo0bG7ot3` "Snow Foundation ask": live stage `a84114da…` Qualified, open, lastStageChangeAt
  2026-09-13T20:43, contact Sally Grimsley-Ballard (tags include `goods-hot`, `engagement:personal-vip`,
  `project:act-gd`). Mirror row identical. **Verified.**
- `CD1oRHtxHrY1k3W2yoIq` (John Moriarty Football) and `XxV91d56TEZAAmp8uapq` (Building Early Education
  Fund): both **404 `OPPORTUNITY_NOT_FOUND`** live. **Verified.**

## 2. How the mirror is written, and its one trap

- **Full sync**: `act-global-infrastructure/scripts/sync-ghl-to-supabase.mjs`, pm2 `ghl-sync`
  (`ecosystem.config.cjs:627-630`, `0 */6 * * *`), on this Mac (`pm2 jlist`: cwd
  `/Users/benknight/Code/act-global-infrastructure`, 85 restarts, last 2026-09-24 12:00 AEST). Pipelines
  `:143-181`, contacts `:187-253`, opportunities `:330-428` (upsert on `ghl_id`, `sync_status='synced'`
  `:383`), deletion reconciliation `:86-122` (soft-delete rows whose `ghl_id` is not live, guarded by an
  80% live/mirror ratio `:60,97`). Pagination is complete since 2026-07-12
  (`scripts/lib/ghl-api-service.mjs:307-341`, comment: before that "a single request capped at 100
  rows/pipeline"). Custom fields are stored raw as the GHL array (`:372`). **Verified.**
  ```sql
  SELECT started_at, completed_at, status, records_processed, records_failed FROM ghl_sync_log WHERE operation='full_sync' ORDER BY started_at DESC LIMIT 3
  -- 2026-09-24 02:00 -> 02:17 success 4499 (1 failed) | 2026-09-23 20:00 success 4499 (1) | 2026-09-23 14:00 success 4500 (0)
  ```
- **Webhook**: `supabase/functions/ghl-webhook/index.ts` upserts contacts (`:112-114`) and opportunities
  (`:147-149`) on `ghl_id`, logs to `ghl_sync_log` (`:171-180`). It has only ever received contact
  events: `SELECT entity_type, operation, count(*) FROM ghl_sync_log WHERE entity_type='opportunity'` →
  one row, `GoodsWorkspacePush`, 2026-04-09. Opportunity freshness is the 6-hour sync alone. **Verified.**
  The webhook's opportunity branch also omits `sync_status`, `last_stage_change_at`,
  `last_status_change_at` (`:131-146`), so a webhook-written opp would lack the staleness signals.
- **The trap**: readers that filter by `pipeline_name` alone.
  ```sql
  SELECT pipeline_name, sync_status, count(*) FROM ghl_opportunities GROUP BY 1,2 ORDER BY 1,2
  -- Grants deleted 259 (last seen 2026-02-27..2026-06-08) | Grants synced 32
  -- Goods — Buyer Pipeline deleted 30 | Goods — Demand Register deleted 84 | Goods Supporter Journey deleted 1
  -- GOODS - Buyers synced 21 + deleted 1 | GOODS - Demand synced 75 | GOODS - Funding synced 69 | GOODS - Community synced 16
  -- ... total synced 760, deleted 562 of 1,322
  ```
  **Verified.** `ghl_contacts`: 3,729 synced, 1,859 deleted.

## 3. Q1 — the 114 live grants marked "in GHL"

```sql
SELECT CASE WHEN o.ghl_id IS NOT NULL THEN 'ghl_id match' WHEN m.id IS NOT NULL THEN 'mirror uuid match' ELSE 'unresolved' END AS resolution,
       coalesce(o.sync_status, m.sync_status) AS mirror_sync_status, coalesce(o.stage_name, m.stage_name) AS stage, coalesce(o.status, m.status) AS mirror_status, count(*)
FROM grant_opportunities g
LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id
LEFT JOIN ghl_opportunities m ON m.id::text = g.ghl_opportunity_id
WHERE g.ghl_opportunity_id IS NOT NULL AND g.status IN ('open','ongoing','upcoming') GROUP BY 1,2,3,4
-- ghl_id match      | deleted | Grant Opportunity Identified | open | 59
-- ghl_id match      | deleted | Grant Opportunity Identified | lost |  3
-- ghl_id match      | deleted | Grant Declined               | lost |  1
-- ghl_id match      | deleted | Application In Progress      | open |  1
-- mirror uuid match | deleted | Grant Opportunity Identified | open |  5
-- mirror uuid match | deleted | Grant Opportunity Identified | lost |  4
-- mirror uuid match | deleted | Application In Progress      | open |  1
-- unresolved        |         |                              |      | 40
```
**Verified.** The critic's "60 open" were the `status='open'` values frozen on soft-deleted rows. None of
the 114 has a live GHL opportunity. Cross-check from the other side: of the 32 live Grants rows, the 16
open ones have `linked_grants = 0` (no `grant_opportunities` row points at them by either key); the only
links into live rows are 10 `lost` rows (Regional Business Gateways, Various Indigenous Grants, Qld Gives,
Dyslexia SPELD, NATSI Flexible, Indigenous Languages and Arts x2, Agricultural Traceability, WIRF, NAIDOC).

### The 40 unresolved ids
All 40 are GHL-shaped (`^[A-Za-z0-9]{20}$`), appear in no mirror row (not even deleted), and in no
`saved_grants` or `goods_relationships` row. Sources: 15 Lotterywest, 12 `foundation_program`,
11 `grant_engine` (grantconnect, NSW/ACT/DE/DTET), 2 QH. Two sampled → 404 live. `grant_opportunities.updated_at`
2026-09-20..24 is **not** the stamp time (bulk touches at identical microsecond timestamps, e.g.
`2026-09-23T14:05:04.150504` on three rows). **Inferred** origin: `sync-grants-ghl.mjs` step 2 creations
from Feb–May 2026, in a pipeline of >100 rows while the mirror fetch was capped at 100/pipeline
(pre-2026-07-12), then deleted with the test contact around 2026-06-08. Whole-column: 184 of 435
GHL-shaped ids are unresolved.

### The 290 UUID-shaped ids
```sql
SELECT id_shape, count(*), count(o.ghl_id) AS matches_ghl_id, count(m.id) AS matches_uuid,
       count(*) FILTER (WHERE m.id IS NOT NULL AND m.ghl_id IS NOT NULL) AS uuid_rewritable ...
-- ghl20 | 435 | 251 | 0   | 184 unresolved
-- uuid  | 290 | 0   | 290 | 290 rewritable (all pipeline_name='Grants', ALL sync_status='deleted')
```
**Verified.** Mechanical rewrite: `UPDATE grant_opportunities g SET ghl_opportunity_id = m.ghl_id FROM
ghl_opportunities m WHERE m.id::text = g.ghl_opportunity_id` (act-global already resolves this way at
`enrich-ghl-grants.mjs:203-233` and `sync-grants-ghl.mjs:237-254`). It would produce 290 correctly
shaped ids to opportunities that no longer exist. The honest state is "was in GHL, deleted": either NULL
the column and keep the old value in a `ghl_link_history`/notes column, or keep the rewritten id and let
the read-back rule (§10) classify it as not-in-GHL via `sync_status`. Recommend the second: no data loss,
and one rule covers the 64 + 10 + 40 + 290.

Fan-out: 20 GHL ids are shared by 42 `grant_opportunities` rows (max 3 per id), from step 1's
`similarity > 0.5` name matching (`sync-grants-ghl.mjs:158-182`). **Verified.**

## 4. Q2 — where `discovery_source` lives, and the idempotency key

Shape (verified from the mirror and from live `get-opportunity`):
```sql
SELECT left(f::text,200), count(*) FROM ghl_opportunities o, jsonb_array_elements(o.custom_fields) f
WHERE o.pipeline_name='Grants' AND f->>'id'='eZoHX9Y7dIZBhXM3i6Kx' GROUP BY 1 ORDER BY 2 DESC
-- {"id":"eZoHX9Y7dIZBhXM3i6Kx","type":"string","fieldValueString":"arc-grants"} 40
-- ... "qld-arts-data" 28 | "manual-research-2026-05-27" 10 | "ghl_sync" 8 | "Lotterywest" 6 | ...
-- {"id":"eZoHX9Y7dIZBhXM3i6Kx","type":"string","fieldValueString":"civicgraph-engine:2548f585-..."} 1 (x15 distinct)
```
Two writers use the same field with different meanings: grantscope's seeder/pusher writes the
idempotency stamp `civicgraph-engine:<opportunity_id>` / `civicgraph-grant:<grant_id>`
(`scripts/seed-goods-grants-ghl.mjs:192`, `apps/web/src/lib/services/goods-grant-ghl.ts:58`);
act-global's `enrich-ghl-grants.mjs:133` overwrites "Discovery source" with `grant_opportunities.source`
(`arc-grants`, `qld-arts-data`, …). 112 of the 127 stamped rows are the act-global meaning. Both meanings
survive only on rows the enrich job did not reach; the 15 engine stamps survive because their grants have
no `grant_opportunities` link. **Verified** (writers read, values counted).

The live 32 by discovery: 15 `civicgraph-engine:*` (all open, triage contact, created 2026-07-06 by
`seed-goods-grants-ghl.mjs`), 1 open with none (Tennant Creek Telegraph Station, 2026-08-06, triage
contact), 8 `ghl_sync`, 1 `grantconnect`, 1 `niaa`, 6 none (all lost).

**Idempotency key for a second pursue** (the contract the one place should implement):
1. Primary: `grant_opportunities.ghl_opportunity_id` resolves to `ghl_opportunities.ghl_id` with
   `sync_status='synced'` and `ghl_pipeline_id = <target>` → update, never create.
2. Secondary (id null, dead, or 404 live): search the mirror for the stamp,
   `custom_fields @> '[{"id":"eZoHX9Y7dIZBhXM3i6Kx","fieldValueString":"civicgraph-grant:<grant_id>"}]'`
   and `sync_status='synced'`, then live `GET /opportunities/{id}`; found → relink and update.
3. Otherwise create with the stamp, write the returned id back in the same transaction, and never let
   another writer overwrite `eZoHX9Y7dIZBhXM3i6Kx` (move act-global's "source" enrichment to a
   different field or stop it).
The GHL search endpoint does not hydrate customFields (memory, confirmed by `seed-goods-grants-ghl.mjs:137-145`
fetching each opp by id), so the mirror is the only cheap stamp index; it lags up to 6 h, which is why
step 1 must be the primary guard.

## 5. Q3 — why Grants is frozen; are grants worked in GOODS - Funding

- Live Grants: all 32 `updatedAt = 2026-08-30T09:58` (bulk write), `lastStageChangeAt max 2026-08-10`,
  `createdAt` max 2026-08-06. **Verified live.**
- Writers that could touch it and their state (pm2 on this Mac has 46 processes; GHL ones are `ghl-sync`
  and `verify-ghl-mirror` only — **verified** with `pm2 jlist`):
  | writer | schedule in `act-global-infrastructure/ecosystem.config.cjs` | running? | evidence |
  |---|---|---|---|
  | `scripts/sync-grants-ghl.mjs` | `:834-838`, `15 */6 * * *` | no | not in pm2 list; last `discovered_by='ghl_sync'` row created 2026-06-16 (`SELECT date_trunc('month',created_at), count(*) … WHERE discovered_by='ghl_sync'` → 2026-03: 9, 2026-05: 86, 2026-06: 165) |
  | `scripts/enrich-ghl-grants.mjs --apply` | `:840-843`, `45 */6 * * *` | no | not in pm2 list; if it ran, the ~10 linked lost rows would carry today's updatedAt |
  | `scripts/cleanup-stale-ghl-opps.mjs --apply` | `:537-541`, Mondays 06:00 | no | not in pm2 list |
  | `scripts/seed-ghl-grants.mjs --count 5` | `:543-547`, Mondays 06:30 | no | not in pm2 list; no Grants row created since 2026-08-06 |
  | grantscope `seed-goods-grants-ghl.mjs` | not scheduled (actions §A6) | ran once 2026-07-07 | the 15 engine rows |
  | grantscope push button / pursue form | user-triggered | never (actions §A1, §A3) | `funding_ghl_handoffs` 0 rows |
  | `funding-grants-pipeline` sync (`funding_ghl_sync_state`) | no source in either repo (grep: only baseline SQL + types) | stopped 2026-09-05 02:01 | `SELECT sync_key, last_success_at FROM funding_ghl_sync_state` → `funding-grants-pipeline | 2026-09-05T02:01:29` |
  `sync-grants-ghl.mjs` step 2 would also fail now: its `DEFAULT_CONTACT_ID` (`:36`) is a deleted test
  contact (**verified** in `ghl_contacts`); GHL requires a valid contactId on create (memory; 422).
- Are grants worked in GOODS - Funding? **Yes, inferred from data.** GOODS - Funding open rows at
  "Ask made" (8): Brian M Davis, QBE Foundation Stage 2, Rotary Global Grant (washers/beds), SEDI
  Capability Building Grants, SEFA, The Bryan Foundation, Ian Potter, Tim Fairfax. The same programs that
  are `lost` at "Grant Declined" in Grants (stage change 2026-07-02): Sisters of Charity, SEDI, FRRR SRC,
  First Nations Clean Energy Advice, ANZ Seeds of Renewal — all open in GOODS - Funding at
  Identified/Qualified. The 2026-07-07 memory said the *Supporter Journey* copies were abandoned; the
  data today says the *Grants* copies were declined and the Funding copies live on. GOODS - Funding's
  last stage change is 2026-09-20 (Goods Canary Test created, CRM UI); its `custom_fields` carry the
  post-award lifecycle (`QbfHdeNpz2JiMe5iRESS` capital_status, `LM1U3fVHJNB4KwvuK9ZF` Estimate/Quote/
  Invoiced/Xero-actual, `YFy6JM5tGjl4J4B5cHSV` INV-xxxx, `YaSYTXhXiqTXo18WfPDI` ruling notes,
  `nPFdTTIjb72O7MnTStii` Notion URL, `O6IQLBRJ6SZSjcYdBBvs` project code). The Grants board is an
  engine-seed dump plus declines; the funder relationship board is where money is worked.

## 6. Q4 — GOODS - Funding (59 open) ↔ CivicGraph tables, by which key

```sql
-- per open row: matches into org_project_foundations by contact, goods_relationships by opp / contact / name
SELECT o.ghl_id, o.name, o.stage_name, o.ghl_contact_id, o.project_code,
  (SELECT count(*) FROM org_project_foundations f WHERE f.ghl_contact_id = o.ghl_contact_id) AS opf_by_contact,
  (SELECT count(*) FROM goods_relationships r WHERE r.ghl_opportunity_id = o.ghl_id) AS rel_by_opp,
  (SELECT count(*) FROM goods_relationships r WHERE r.ghl_contact_id = o.ghl_contact_id) AS rel_by_contact,
  (SELECT count(*) FROM goods_relationships r WHERE lower(r.display_name)=lower(o.name) AND r.relationship_type='funder') AS rel_by_name
FROM ghl_opportunities o WHERE o.pipeline_name='GOODS - Funding' AND o.status='open' ORDER BY o.stage_name, o.name
-- 59 rows: rel_by_opp >= 1 on all 59 (2 on QBE, SEDI, SEFA, REAL, Minderoo, VFFF; 3 on Snow Foundation ask)
--          opf_by_contact >= 1 on 10 (ACF x2, Community Resources, Country Connect, Ian Potter, Minderoo, NAACT, Nova Peris, Sisters of Charity, Yeperenye)
```
```sql
SELECT count(*) AS opf_with_contact,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ghl_opportunities o WHERE o.ghl_contact_id=f.ghl_contact_id AND o.pipeline_name='GOODS - Funding' AND o.status='open')) AS has_open_funding_opp
FROM org_project_foundations f WHERE f.ghl_contact_id IS NOT NULL
-- 22 | 10      (the brief's "23 synced" is 23 with ghl_synced_at; 22 with a contact id)
```
```sql
SELECT relationship_type, count(*), count(ghl_opportunity_id) AS with_opp,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ghl_opportunities o WHERE o.ghl_id=goods_relationships.ghl_opportunity_id AND o.pipeline_name LIKE 'GOODS - %')) AS opp_in_new_pipeline,
  string_agg(DISTINCT source_refs->>'pipeline', ', ') FROM goods_relationships GROUP BY 1
-- funder 172 | 89 with_opp | 88 in new pipeline | source_refs.pipeline = 'Goods Supporter Journey' (old label from sync-goods-ghl.mjs:51)
-- buyer  131 | 124 | 101 | 'Goods — Buyer Pipeline, Goods — Demand Register'
```
**Verified.** Answer: **`goods_relationships.ghl_opportunity_id` = `ghl_opportunities.ghl_id`** is the key
that covers all 59; `org_project_foundations.ghl_contact_id` covers 10 and is a contact-level (funder org)
key written by name search (`scripts/reconcile-foundations-ghl.mjs:47-67,104-112`), not an opportunity key.
All 59 open rows sit on a live contact; 29 of those contacts carry a `goods-*` temperature tag, 59 carry a
`project:*` tag, 0 sit on the triage contact. The desk's funder warmth (`goods-funder-scan.ts:39-49`)
derives from `org_project_foundations.ghl_tags`, so 49 of the 59 funders being actively worked in GHL are
invisible to the funder scan's "in GHL" test (they are only in `goods_relationships`).

`goods-capital-workspace.ts:396,433,466,513` hard-codes four GOODS - Funding ids (SEFA
`hBRVkCMhT93215aqTRRr`, Snow `ZzPJCLAq3nkAo0bG7ot3`, Tim Fairfax `ihodM2eQqGW7UlS7WeKp`, White Box
`6qJmhAM3a01JJcI6Krg9`); all four are among the 59 open rows. **Verified.**

`goods_relationships` rot (all **verified**):
```sql
-- duplicates: dedupe_key is a GENERATED column  (relationship_type || ':' || lower(btrim(display_name)))
SELECT count(*) AS rows_in_dup_groups, count(DISTINCT ghl_opportunity_id) FROM goods_relationships WHERE ghl_opportunity_id IN (SELECT ghl_opportunity_id FROM goods_relationships GROUP BY 1 HAVING count(*)>1)   -- 45 | 20
SELECT count(*) FROM goods_relationships r WHERE EXISTS (SELECT 1 FROM ghl_opportunities o WHERE o.ghl_id=r.ghl_opportunity_id AND o.sync_status='deleted')  -- 24
```
Cause: `scripts/sync-goods-ghl.mjs:276-282,425-467` upserts on `dedupe_key` (name) and never retires
rows; a rename in GHL creates a sibling with the same `ghl_opportunity_id`. Its feeder has failed since
2026-09-23 02:04 UTC:
```sql
SELECT started_at, status, substr(errors::text,1,400) FROM agent_runs WHERE agent_id='sync-goods-ghl' ORDER BY started_at DESC LIMIT 1
-- 2026-09-24T02:19:47 failed … GHL API 401 on …/opportunities/pipelines?locationId=agzsSZWgovjwgpcoASWG {"statusCode":401,"message":"Invalid Private Integration token"}
-- last success 2026-09-22T14:00:12 (165 found / 164 updated); schedule row interval 12h, enabled, last_run_at 2026-09-22 14:00
```
Token fingerprints (md5 of the value, no values printed): `grantscope/.env GHL_API_KEY` = `0ad0d013`
(one definition, line 31, file mtime 22 Sep 08:25 AEST) = `act-global-infrastructure/.env.local
GHL_API_KEY` = `GHL_PRIVATE_TOKEN` = `0ad0d013`. The same bytes succeeded in `ghl-sync` at 2026-09-24
02:00 UTC and in my MCP reads. Why grantscope's orchestrator child gets 401 with them is **unverified**
(candidates: the orchestrator spawns from a different cwd/env than `pm2 jlist` shows, or the request
differs; F1's domain, not mine).

## 7. Q5 — prune plan for the 115 old-name orphans (and the rest of the ghost layer)

```sql
SELECT o.pipeline_name, o.status, o.sync_status, count(*),
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ghl_opportunities n WHERE n.pipeline_name LIKE 'GOODS - %' AND lower(n.name)=lower(o.name))) AS same_name_under_new,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ghl_opportunities n WHERE n.pipeline_name LIKE 'GOODS - %' AND n.ghl_contact_id = o.ghl_contact_id)) AS same_contact_under_new,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM goods_relationships r WHERE r.ghl_opportunity_id=o.ghl_id)) AS referenced_by_goods_rel
FROM ghl_opportunities o WHERE o.pipeline_name IN ('Goods — Buyer Pipeline','Goods — Demand Register','Goods Supporter Journey') GROUP BY 1,2,3
-- Goods — Buyer Pipeline  open deleted 19 | 0 | 4 | 0
-- Goods — Buyer Pipeline  won  deleted 11 | 0 | 7 | 0
-- Goods — Demand Register open deleted 84 | 0 | 0 | 22
-- Goods Supporter Journey open deleted  1 | 0 | 0 | 1
```
**Verified: all 115 are already `sync_status='deleted'`** (soft-deleted by the reconciliation on or before
2026-06-08 / 2026-08-07). The Demand board was emptied and refilled with new ids (84 old vs 75 new, no
shared names), the Buyers board partly (11 of 30 old rows share a contact with a new row). So "rebuilt" is
true of the *rows* in Demand/Buyers around 2026-06-08 and false of the *pipelines*, which kept ids and
were renamed 2026-08-13.

Plan (all Tier 1 to write, Tier 3 to apply; nothing done):
1. **No row deletion in `ghl_opportunities`.** The mirror's contract is soft-delete + resurrection
   (`sync-ghl-to-supabase.mjs:381-383`). Hard-deleting would erase the only record that a link once
   existed. Instead every reader adds `sync_status = 'synced'`. Readers that lack it today (verified by
   reading): act-global `sync-grants-ghl.mjs:108-111`, `:238-241`, `:472-475`; `enrich-ghl-grants.mjs:212-216`;
   `cleanup-stale-ghl-opps.mjs:53-57,78-83` (filters `status='open'` only); grantscope
   `opportunity-intelligence.ts` and `project_pipelines` per critic §2.2 (not re-read here).
2. **`goods_relationships`**: retire the 24 rows whose `ghl_opportunity_id` is a deleted mirror row
   (set `stage='dormant'` or add a `retired_at`), collapse the 20 duplicate groups keeping the row whose
   `display_name` equals the current mirror `name`, and change `sync-goods-ghl.mjs` to upsert on
   `ghl_opportunity_id` (unique per opp) instead of the name-derived `dedupe_key`.
3. **`goods_procurement_entities`**: 22 of 26 `ghl_opportunity_id` point at deleted "Goods — Demand
   Register" rows (`ghl_stage_name` cache "Buyer Matched", last pushed 2026-05-27); 3 at live GOODS -
   Demand, 1 at live GOODS - Buyers. Null the 22 or re-push; the re-push path is dead because
   `GHL_GOODS_BUYER_STAGE_ID` is unset in `grantscope/.env` (`goods-buyer-ghl.ts:117-123` skips the
   opportunity). **Verified.**
4. **`ghl_pipelines`**: drop or flag the 8 pipelines absent live; add `sync_status` to the pipelines
   sync (`sync-ghl-to-supabase.mjs:150-163`) the way opportunities have it.
5. **Labels**: `scripts/sync-goods-ghl.mjs:50-54` and `apps/web/src/lib/ghl.ts:25-29` still say "Goods
   Supporter Journey / Goods — Buyer Pipeline / Goods — Demand Register"; `goods_relationships.source_refs.pipeline`
   carries those labels on 213 rows. Rename to the live names; ids stay.
6. **`ghl_contacts`**: 1,859 deleted rows; same filter rule.

## 8. Q6 — read-only cross-check summary (drift report)

- Pipelines: mirror 19 vs live 11 → 8 stale pipeline rows (names above). Stage ids/names for the 5 money
  pipelines identical live vs mirror (compared by id prefix and name, 45 stages).
- Opportunities: 213 live rows across 5 pipelines, 213 in mirror `synced`, 0 field drift, 0 mirror-only
  synced rows. Mirror `updated_at`/`ghl_updated_at` equals live `updatedAt` within 60 s on every row.
- Contacts on the 59 open Funding rows: all present and `synced` in `ghl_contacts`.
- Deleted-id checks: 2 of 40 unresolved ids → 404; the 64 "ghl_id match / deleted" ids were last seen
  live 2026-05-13 or 2026-06-08 (`last_synced_at`), 243 of 259 deleted Grants rows on the deleted test
  contact `AXrbvQAQKR0TcTcZL71H`.
- Live pipeline `dateUpdated` gives the rename date (2026-08-13) the mirror cannot (it stores no
  pipeline `dateUpdated`).
- `verify-ghl-mirror.mjs` (pm2 daily 07:05) compares live counts to mirror *active* rows within 2%
  (`:1-40`); it would pass today, which is consistent with the zero drift measured.

## 9. A1 resolved, F3 corrected, memory corrections

- **A1 (who stamped 725 ids)**: act-global `scripts/sync-grants-ghl.mjs` (`ecosystem.config.cjs:834-838`).
  Step 1 (`:137-207`) writes mirror UUIDs (`ghl.id`) at `:177` (name-link) and `:191` (create with
  `source='ghl_sync', discovered_by='ghl_sync'`, upsert on `(source,name)` `:200-203`). Step 2
  (`:297-389`) creates in GHL for unlinked grants with `fit_score >= 50` or `aligned_projects` and writes
  `created.id` at `:377`. Step 4 (`:451-559`) advances GHL stages and patches the mirror by UUID `:543-546`.
  Also `scripts/seed-ghl-grants.mjs:136` (weekly, triage contact, writes real `ghl_id` plus
  `pipeline_stage='researching'`), and in grantscope `push-ghl/route.ts:45-48` and the 2026-07-07 seeder
  (which writes nothing back — its links come via the mirror's `discovery_source`). The 2026-09-20
  `updated_at` on all 725 is a grantscope-side bulk touch, not the stamp. **Verified** for the code paths;
  the attribution of any single row to a step is **inferred** from id shape + `discovered_by`.
- **F3 ("boards rebuilt under new names")**: pipelines kept ids and stage ids, renamed 2026-08-13; rows
  in Demand (84→75, disjoint ids) and Buyers (30 old deleted, 21 live) were rebuilt around 2026-06-08;
  GOODS - Community is new (2026-07-24) and no grantscope code knows it. **Verified.**
- Memory `project_ghl_goods_opportunity_tracking.md` is stale on names ("Goods Supporter Journey",
  "Goods — Buyer Pipeline", "Goods — Demand Register") and on "~10 won grants still status='open' in
  Supporter Journey" (today: Stewarding/Renewing rows Mala'la, QIC, Red Dust, John Villiers, Julalikari,
  Our Community Shed are still `open` in GOODS - Funding; the five won are elsewhere).
- Critic §2.3 "60 are genuinely open in GHL" → 0. Critic §3.B "custom_fields never carries the stamp" →
  it does, as an array.

## 10. Deliverable

### 10.1 Canonical stage vocabulary (live GHL 2026-09-24 = mirror `ghl_pipelines.stages`)
GHL status is separate from stage: `open | won | lost | abandoned`. "open" at "Declined / Parked" exists
(Minderoo), and every Grants `lost` row sits at "Grant Declined"; read both.

**Grants** `scom3L0kNwA1W0zPIzMe` (org-wide, engine-seed sink; contact = GrantScope Triage `uAsIUWBHez3DzVex8rtm`)
| pos | stage | id |
|---|---|---|
| 0 | Grant Opportunity Identified | `8124c61a-1175-461e-be5d-1fa64ef6dd65` |
| 1 | Application In Progress | `3eb617e6-5635-4091-bd04-acc72d2ae5b0` |
| 2 | Grant Submitted | `8b0818ce-3fe8-4aae-97ab-905366fdd5ee` |
| 3 | Grant Awarded | `438c68ab-5a83-49f1-a4f7-efd6d68f25af` |
| 4 | Grant Reporting Due | `c43bbabf-b259-4382-9940-7d8f1223a164` |
| 5 | Grant Report Submitted | `8b62f71c-17b9-4a69-9ff8-23b4262c2c38` |
| 6 | Grant Declined | `6c81a3e7-6382-4dcd-af63-03279045ef97` |

**GOODS - Funding** `JvBFYpVpyKsw899lkFgj` (funder relationships and asks: grants, philanthropy, repayable finance)
| pos | stage | id |
|---|---|---|
| 0 | Identified | `cf8d31d2-73be-4119-b56b-7b0334254197` |
| 1 | Qualified | `a84114da-8888-4357-a2df-01b29f37209d` |
| 2 | Cultivating | `524aca71-287d-4eeb-a53a-66ff3a7aede5` |
| 3 | Ask made | `a23b26b4-ace3-4199-8a14-b65ed888aa52` |
| 4 | Committed | `c6369cf9-80f6-4680-9249-acc1c861022d` |
| 5 | Delivering | `15b7b876-16e3-4c57-84e6-7c09d703888e` |
| 6 | Stewarding / Reporting | `3e38f65b-a515-4e32-9fc9-57ea1531edc6` |
| 7 | Renewing | `ff90ea45-2196-4a7a-a311-8f27c3c7cda6` |
| 8 | Lapsed | `0c86ee48-1ef2-4b85-a39f-9c467a61f5f8` |
| 9 | Declined / Parked | `fcf23a69-bae4-4465-b3f0-d933bc9d709c` |

**GOODS - Buyers** `FjMyJM3YzWQFmKqR9fur`: Outreach Queued `e5220eb2` · First Contact `1fd317ec` · In
Conversation `8da22920` · Qualified `c3e5e7c5` · Scoped `27085dfa` · Proposed `e23847c3` · Negotiating
`a5222f0c` · Committed `809f1a7a` · In Delivery `dc6cf017` · Delivered `80be941e` · Invoiced `835065e8` ·
Paid `0100d504`.
**GOODS - Demand** `UQsrmuqzxMSdCTklxEcG`: Signal `0c5ed787` · Buyer Matched `02502aa3` · Converted
`13958a71` · Dormant `a0cb12c7`.
**GOODS - Community** `0m9teeEQFiq6I7GB5xiP`: Invitation `8ac0d9af` · Listening `86457947` · Brief returned
`10923ca8` · Community confirmed `20173679` · Modules selected `d7762206` · Ready to cost `3ab04ced` ·
Funding pathway `59284de2` · Agreement `924fdc56` · Delivery `f5a07125` · Operating `a993916e` · Review and
adapt `8c436143` · Paused / closed `bc7543b3`.
(Full UUIDs for these three are in `ghl_pipelines.stages`; the prefixes above match `scripts/sync-goods-ghl.mjs:61-91`.)

Existing stage maps that disagree with this vocabulary: `apps/web/src/app/api/integrations/ghl/funding-callback/route.ts:2`
maps `scoping`, `eligibility confirmed`, `relationship / partner work`, `internal review`, `submitted`,
`awarded`, `declined / withdrawn / expired`, `reporting due`, `acquitted` — none of these stage names
exists in any live pipeline (only `application in progress` matches), so the callback could never have
produced a decision. `apps/web/src/lib/ghl.ts:8-23` and `scripts/sync-ghl-to-tracker.mjs:18-26` map the
Grants names correctly but feed `saved_grants.ghl_opportunity_id`, which has 0 rows. **Verified.**

### 10.2 Key contract
- **Column**: `<table>.ghl_opportunity_id text` holds **the GHL opportunity id** (`^[A-Za-z0-9]{20}$`),
  never `ghl_opportunities.id`. Applies to `grant_opportunities`, `goods_relationships`,
  `goods_procurement_entities`, `funding_ghl_handoffs`, `org_pipeline`, `act_ask_warmers`.
  Contacts: `ghl_contact_id text` = GHL contact id = `ghl_contacts.ghl_id` (note `ghl.ts:126-136,216-226`
  writes/reads `ghl_contacts.id` (uuid PK) with a GHL id — those calls cannot match; **verified** by
  reading, effect not run).
- **Pipeline/stage**: store `ghl_pipeline_id` + `ghl_stage_id`; render names by joining
  `ghl_pipelines.stages` on `ghl_id`, never by `pipeline_name` text.
- **Provenance stamp**: custom field `eZoHX9Y7dIZBhXM3i6Kx` = `civicgraph-grant:<grant_opportunities.id>`
  (rounds) or `civicgraph-engine:<act_grant_recommendations.opportunity_id>` (engine); one writer.
- **Contact anchor**: GrantScope Triage `uAsIUWBHez3DzVex8rtm` (live, tags `source:grantscope`,
  `role:funder`) until a real funder contact is attached; never `AXrbvQAQKR0TcTcZL71H`.
- **Write-back**: the returned id is written in the same request that created it; a create whose
  write-back fails must be found again by the stamp (§4).

### 10.3 Read-back rule for "in GHL / stage / last touch"
```sql
SELECT g.id,
  (o.ghl_id IS NOT NULL)                                            AS in_ghl,          -- synced row exists
  o.ghl_pipeline_id, o.ghl_stage_id, o.stage_name, o.status,                          -- stage + status, both
  greatest(o.last_stage_change_at, o.last_status_change_at, o.ghl_updated_at) AS last_touch,
  o.last_synced_at                                                  AS as_of,          -- 6-hourly; stale if > 12h
  d.ghl_id IS NOT NULL                                              AS was_in_ghl      -- linked once, since deleted
FROM grant_opportunities g
LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id AND o.sync_status = 'synced'
LEFT JOIN ghl_opportunities d ON (d.ghl_id = g.ghl_opportunity_id OR d.id::text = g.ghl_opportunity_id) AND d.sync_status = 'deleted'
```
Rules: `in_ghl` requires a `synced` mirror row (a non-null id proves nothing: 725/725 today);
"being worked" = `in_ghl AND status='open' AND stage not in (Declined…, Lapsed, Grant Declined)`;
"last touch" = the greatest of the three GHL timestamps, not `updated_at` (mirror write time) and not
`ghl_created_at`; contact warmth = `ghl_contacts.tags` for the row's `ghl_contact_id` (goods-hot/warm/
steady/cooling/cold, `goods-funder-scan.ts:39-49`), joined on `ghl_id` with `sync_status='synced'`;
a funder is "in GHL" if any `synced` opportunity on its contact exists in GOODS - Funding, which is what
`goods_relationships.ghl_opportunity_id` already encodes for 88 funders.

## 11. Other findings on the way (verified by reading unless marked)

- `apps/web/src/lib/ghl.ts:216-226` `upsertContact` upserts `ghl_contacts` with `id: contactId` (GHL id
  into a uuid PK) `onConflict:'id'`, error unchecked; `:126-136` and `:153-162` read `.eq('id', contactId)`.
  These can never match a mirror row keyed on `ghl_id`. Effect on A8 (`org_contacts` sync) not run.
- `scripts/sync-ghl-to-tracker.mjs` reads `saved_grants.ghl_opportunity_id` (0 rows) and fetches only
  the first 100 Grants opps (`:75-86`, no pagination): dead twice over.
- `apps/web/src/lib/services/funding-ghl.ts:27` needs `GHL_GRANTS_TRIAGE_CONTACT_ID`; unset in
  `grantscope/.env`; act-global `.env.local` has `GHL_TRIAGE_CONTACT_ID` instead. Vercel value unverified.
- `supabase/functions/ghl-webhook/index.ts:54-62` infers a contact event from `payload.id` alone, so an
  opportunity payload carrying `id` is also processed as a contact (`:71`); harmless today because no
  opportunity webhook is configured.
- `ghl_opportunities.custom_fields` is a jsonb array; readers doing `custom_fields->>'field'` or
  `custom_fields ? 'x'` get nulls. Use `jsonb_array_elements` or `@>` with the element shape.
- The `funding_ghl_sync_runs` writer (`funding-grants-pipeline`, 15-minute cadence, 556 runs,
  `opportunities_fetched` 32 on every recent run) has no source in either repo today (grep); it stopped
  2026-09-05. Critic §2.6 and periphery §1a were right that it is gone; the table is its fossil.

## 12. Gaps (not verified)
- Whether act-global's four Grants pm2 jobs run on another host; this Mac's pm2 has 46 apps and not those.
- Why grantscope's `sync-goods-ghl` gets 401 with the same token bytes that succeed elsewhere.
- Vercel's values of `GHL_GRANTS_TRIAGE_CONTACT_ID`, `GHL_GOODS_BUYER_STAGE_ID`, `GHL_FUNDING_CALLBACK_SECRET`.
- The exact event that deleted ~259 Grants and 115 Goods rows around 2026-05-13/2026-06-08 (deleted test
  contact is the strongest signal; act-global has `audit-*-2026-06-08.mjs` cleanup scripts I did not run).
- Who ran the 2026-08-30 09:58 bulk write on all 32 Grants rows (`internalSource: INTEGRATION/OAUTH`).
- `opportunity-intelligence.ts` and act-global `build-project-pipelines.mjs` reads of the mirror were not
  re-read for the `sync_status` filter.
