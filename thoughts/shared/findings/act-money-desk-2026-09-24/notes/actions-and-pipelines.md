# actions-and-pipelines — reader notes

Repo: /Users/benknight/Code/grantscope · read 2026-09-24 · read-only. Every number below was
produced by `node --env-file=.env scripts/gsql.mjs "<sql>"` on the shared project; the SQL is
pasted next to each. Every code claim carries file:line and was read, not grepped.

## 0. The three-pipeline rule (memory: project_three_pipeline_architecture.md, decided 2026-08-04)

1. **CivicGraph (Supabase) = discovery.** Who *should* we talk to: foundation matching, grant
   scoring, `org_project_foundations`, `goods_relationships`.
2. **GoHighLevel = THE core pipeline, system of record for relationship state.** Stages, tags,
   owner, next touch, email history. "Are we in touch with X" is answered by GHL, never by
   discovery tables. Read-back columns (`ghl_contact_id/email/tags/synced_at`) are cached signals.
3. **Notion = production rooms** once an application or brand process is live.

Flow: discovered in CivicGraph → pushed to GHL → worked in GHL → production in Notion. The
make-the-ask skill restates it as "GHL owns the Ask's state, CivicGraph owns the evidence, Notion
owns the produced artefact" (.claude/skills/make-the-ask/SKILL.md:10-11). The Notion handoff
spec adds "nothing lands in Notion automatically on pursue" and "GHL wins silently"
(docs/specs/grants-notion-handoff-spec.md:7-15).

Supporting memory facts used below: GHL token rots between the two repos
(solution_ghl_token_source_of_truth.md, fixed 2026-09-06); `org_pipeline` owner/next_action are
100% empty (project_goods_next_action_data_gap.md, verified 2026-08-10 and re-verified here);
the Grants pipeline id `scom3L0kNwA1W0zPIzMe`, stage "Grant Opportunity Identified"
`8124c61a-1175-461e-be5d-1fa64ef6dd65`, triage contact `uAsIUWBHez3DzVex8rtm`
(project_ghl_goods_opportunity_tracking.md).

## 1. Table state at the start (verified)

```sql
SELECT 'opportunity_decisions' AS tbl, count(*) AS n, max(created_at) AS latest FROM opportunity_decisions
UNION ALL SELECT 'saved_grants', count(*), max(created_at) FROM saved_grants
UNION ALL SELECT 'saved_foundations', count(*), max(created_at) FROM saved_foundations
UNION ALL SELECT 'entity_watches', count(*), max(created_at) FROM entity_watches
UNION ALL SELECT 'org_pipeline', count(*), max(created_at) FROM org_pipeline
UNION ALL SELECT 'jm_watches', count(*), max(created_at) FROM jm_watches
UNION ALL SELECT 'org_project_foundations', count(*), max(created_at) FROM org_project_foundations
UNION ALL SELECT 'opportunity_promotions', count(*), max(created_at) FROM opportunity_promotions
UNION ALL SELECT 'opportunity_context_events', count(*), max(created_at) FROM opportunity_context_events
UNION ALL SELECT 'act_ask_artefacts', count(*), max(set_at) FROM act_ask_artefacts ORDER BY 1
```

| table | rows | latest row |
|---|---|---|
| act_ask_artefacts | 0 | — |
| entity_watches | 0 | — |
| jm_watches | 4 | 2026-09-23 |
| opportunity_context_events | 137 | 2026-07-13 |
| opportunity_decisions | 7 | 2026-08-11 |
| opportunity_promotions | 7 | 2026-08-11 |
| org_pipeline | 125 | 2026-03-19 (created); updated_at max 2026-08-01 |
| org_project_foundations | 1,553 | 2026-09-24 |
| saved_foundations | 182 | 2026-09-17 |
| saved_grants | 2,916 | 2026-09-24 |

Link/mirror tables (same session):

```sql
SELECT 'grant_opportunities.ghl_opportunity_id' AS what, count(*) AS n FROM grant_opportunities WHERE ghl_opportunity_id IS NOT NULL
UNION ALL SELECT 'goods_procurement_entities.ghl_contact_id', count(*) FROM goods_procurement_entities WHERE ghl_contact_id IS NOT NULL
UNION ALL SELECT 'ghl_task_bridge', count(*) FROM ghl_task_bridge
UNION ALL SELECT 'digest_log', count(*) FROM digest_log
UNION ALL SELECT 'ghl_sync_log', count(*) FROM ghl_sync_log
UNION ALL SELECT 'ghl_opportunities', count(*) FROM ghl_opportunities
UNION ALL SELECT 'ghl_contacts', count(*) FROM ghl_contacts
UNION ALL SELECT 'org_project_foundations.ghl_synced_at', count(*) FROM org_project_foundations WHERE ghl_synced_at IS NOT NULL
UNION ALL SELECT 'funding_ghl_handoffs', count(*) FROM funding_ghl_handoffs
UNION ALL SELECT 'funding_ghl_sync_runs', count(*) FROM funding_ghl_sync_runs
UNION ALL SELECT 'funding_ghl_callback_events', count(*) FROM funding_ghl_callback_events
UNION ALL SELECT 'funding_weekly_cycles', count(*) FROM funding_weekly_cycles
UNION ALL SELECT 'notion_opportunities', count(*) FROM notion_opportunities
UNION ALL SELECT 'act_grant_recommendations', count(*) FROM act_grant_recommendations
UNION ALL SELECT 'act_people', count(*) FROM act_people
UNION ALL SELECT 'goods_relationships', count(*) FROM goods_relationships
UNION ALL SELECT 'grant_notification_outbox', count(*) FROM grant_notification_outbox
UNION ALL SELECT 'alert_preferences', count(*) FROM alert_preferences
UNION ALL SELECT 'act_grant_recommendation_decisions', count(*) FROM act_grant_recommendation_decisions
```

grant_opportunities.ghl_opportunity_id 725 · goods_procurement_entities.ghl_contact_id 26 ·
ghl_task_bridge 8 · digest_log 3 · ghl_sync_log 12,521 · ghl_opportunities 1,322 · ghl_contacts
5,588 · org_project_foundations.ghl_synced_at 23 · **funding_ghl_handoffs 0** ·
funding_ghl_sync_runs 556 · **funding_ghl_callback_events 0** · funding_weekly_cycles 8 ·
notion_opportunities 43 · act_grant_recommendations 35,761 · **act_people 0** ·
goods_relationships 321 · grant_notification_outbox 771 · alert_preferences 3 ·
act_grant_recommendation_decisions 89.

## 2. Every action, with trigger → inputs → writes/sends → idempotency → works today

### A. "Pursue" = push to GHL (five separate implementations)

**A1. Goods grant round → GHL Grants pipeline (button).**
- Trigger: `Push to GHL` button on `/org/act/goods/grants`
  (apps/web/src/app/org/[slug]/goods/grants/page.tsx:240 renders `PushGrantGhlButton`;
  apps/web/src/app/org/[slug]/goods/grants/push-grant-ghl-button.tsx:18 POSTs).
- Route: apps/web/src/app/api/goods/grants/push-ghl/route.ts:8-51, auth `requireModule('tracker')`.
  Inputs: grantId, name, provider, fitScore, deadline, url, geography, amountMin/Max.
- Sends: `POST https://services.leadconnectorhq.com/opportunities/` with pipelineId
  `scom3L0kNwA1W0zPIzMe`, stage `8124c61a-…`, contactId triage `uAsIUWBHez3DzVex8rtm`, custom
  fields funder/fit/geography/link/date/amount_range and `discovery_source =
  civicgraph-grant:<grantId>` (apps/web/src/lib/services/goods-grant-ghl.ts:11-25, 52-79).
- Writes: `grant_opportunities.ghl_opportunity_id` (route.ts:45-48).
- Idempotency: route.ts:19-27 returns the existing id if the column is already set. Provenance
  stamp in GHL.
- Works today: code path complete. Whether the button has ever been pressed cannot be read from
  the column: 725 rows carry a ghl_opportunity_id, but they were stamped in one batch
  ```sql
  SELECT discovered_by, source, count(*) AS n, min(updated_at)::date AS first, max(updated_at)::date AS last
  FROM grant_opportunities WHERE ghl_opportunity_id IS NOT NULL GROUP BY 1,2 ORDER BY n DESC LIMIT 10
  ```
  → 260 `ghl_sync/ghl_sync`, 129 `grant_engine/arc-grants`, 90 `import-gov-grants/qld-arts-data`,
  all `updated_at` 2026-09-20. No writer of `discovered_by='ghl_sync'` exists in this repo
  (grep of scripts and apps/web/src for a `grant_opportunities` write with that value found
  none). **Inferred:** a 2026-09-20 backfill from the GHL mirror, run from another repo, is what
  makes the desk say "in GHL" for grants, not this button.

**A2. Buyer / community org → GHL contact (+ Buyer-pipeline opportunity).**
- Trigger: `Push to GHL` / `Re-sync` on `/org/act/goods/community/[communityId]`
  (apps/web/src/app/org/[slug]/goods/community/[communityId]/push-to-ghl-button.tsx:38).
- Route: apps/web/src/app/api/goods/buyer/push-ghl/route.ts:14-94, auth tracker module. Inputs:
  entityName, buyerRole, abn, website, communityName/State, isCommunityControlled,
  relationshipStatus, govtContractValue, communityId/entityId/buyerEntityRowId.
- Sends: `POST /contacts/upsert` keyed on a **synthetic email**
  `<entity-slug>-<community-slug>@goods.civicgraph.io` with tags CivicGraph/Goods/Goods-Community-…
  (apps/web/src/lib/services/goods-buyer-ghl.ts:34-72), then `POST /contacts/{id}/notes`
  (l.104-112), then an opportunity on `GHL_GOODS_PIPELINE_ID` / `GHL_GOODS_BUYER_STAGE_ID`
  (l.117-120, non-fatal if env missing).
- Writes: `goods_procurement_entities.ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id,
  ghl_stage_id, ghl_stage_name='Outreach Queued', ghl_last_pushed_at` (route.ts:43-84); promotes a
  local org to a mapped buyer row if none exists (l.73-81).
- Idempotency: the synthetic email makes the contact upsert idempotent; the opportunity create is
  not guarded (a re-sync creates a second opportunity — route.ts comment at l.39-40 claims
  otherwise but the service creates unconditionally at l.117+).
- Works today: 26 rows carry ghl_contact_id (query in §1). Token-dependent (see F1).

**A3. "Pursue → GHL" form (the designed pursue ritual).**
- Trigger: `Confirm pursue` in `PursueFundingForm` on `/org/act/<project>/funding`
  (apps/web/src/app/org/[slug]/funding/pursue-funding-form.tsx:15-24; requires the confirm
  checkbox l.47). Inputs: amountSought, applicantEntity, relationshipOwner, nextAction,
  nextActionDue, grantscopeDecisionUrl, `confirm:true`.
- Route: apps/web/src/app/api/ops/funding/pursue/route.ts:2 — `requireAdminApi`, rejects without
  `confirm===true`.
- Service: apps/web/src/lib/services/funding-ghl.ts:14-38. Requires the opportunity to be in
  `act_grant_recommendations_current` (l.18, "evidence-safe apply_now"), then:
  1. upsert `funding_ghl_handoffs` on (project_code, opportunity_id) with sync_status 'pending'
     (l.28-29);
  2. GHL create (name `[CODE] name`, contactId from env `GHL_GRANTS_TRIAGE_CONTACT_ID`, l.27,33)
     or update if the handoff already has a ghl_opportunity_id (l.32);
  3. upsert `act_grant_recommendation_decisions` decision='pursuing' (l.34);
  4. handoff → sync_status 'succeeded' + ghl_opportunity_id + decision_id (l.35); on any error
     sync_status 'failed' + last_error (l.37).
- Idempotent by the handoff unique key.
- Works today: **never has.** `funding_ghl_handoffs` = 0 rows; decisions has 0 'pursuing'
  ```sql
  SELECT decision, count(*) AS n, count(notion_page_id) AS notion, count(ghl_opportunity_id) AS ghl,
         count(grant_opportunity_id) AS mirrored, max(decided_at) AS latest
  FROM act_grant_recommendation_decisions GROUP BY decision
  ```
  → passed 62 (1 mirrored), won 26, watching 1; notion 0, ghl 0 in every group. l.27 throws
  unless `GHL_GRANTS_TRIAGE_CONTACT_ID` is set — an env var that is not used anywhere else
  (the other three pushers hardcode the triage id). Unverified whether it is set in Vercel.
- The return channel `POST /api/integrations/ghl/funding-callback`
  (apps/web/src/app/api/integrations/ghl/funding-callback/route.ts:3) maps GHL stage names →
  decisions (scoping→pursuing … acquitted→won), needs `GHL_FUNDING_CALLBACK_SECRET`, writes
  `funding_ghl_callback_events` then updates the handoff and the decision. 0 events ever.

**A4. Optional Notion brief (only after A3).**
- Trigger: `Create optional Notion brief` (pursue-funding-form.tsx:35) → POST
  `/api/ops/funding/notion-brief` (route.ts:2, admin, confirm:true).
- apps/web/src/lib/services/funding-notion.ts:33-54: requires a handoff with
  sync_status='succeeded' (l.37-38) and a pursue/applied/submitted/won decision (l.39-40);
  creates a page in `NOTION_OPPORTUNITIES_DB_ID` with Stage 'Scoping' and a checklist body
  (buildFundingBriefBlocks l.9-25); writes `act_grant_recommendation_decisions.notion_page_id`
  and `funding_ghl_handoffs.notion_brief_url` (l.52). Idempotent via notion_page_id (l.49).
- Works today: dead by construction because A3 has never succeeded. notion_page_id populated on
  0/89 decisions.

**A5. opportunity-intelligence `send_to_ghl` (the generic action endpoint).**
- Route: apps/web/src/app/api/opportunity-intelligence/actions/route.ts:47-76 (tracker module;
  org write access if orgProfileId given). GET at l.12-45 documents the 19 kinds and the safety
  rules ("No automatic GHL or Notion stage changes from ranking", "send_to_ghl requires
  confirmWrite=true and a route payload").
- apps/web/src/lib/opportunity-intelligence.ts:2616-2758 `sendRouteToGhl`: resolves the pipeline
  by `route.ghl.recommendedPipeline` / `GHL_DEFAULT_OPPORTUNITY_PIPELINE_NAME` / 'Grants'
  (l.2620-2625), creates or updates the opportunity, logs to `ghl_sync_log` (l.2702-2719), then
  upserts `org_pipeline` on (org_profile_id, source_type, source_ref) with
  `ghl_opportunity_id`, owner_name, next_action, last_synced_at (l.2720-2753).
- Idempotent on the org_pipeline key; the GHL side updates when `existingOpportunityId` is given.
- Works today: **no UI caller sends this kind.** The three callers all send
  `confirmWrite:false` and kinds `research|partner_path|later|record_review`
  (apps/web/src/app/org/[slug]/_components/act-relationship-action-buttons.tsx:82,124;
  act-record-review.tsx:636; resources/resource-desk.tsx:76-80). `org_pipeline` has 0 rows with
  `ghl_opportunity_id` or `source_type` (§3), so it has never written.

**A6. Engine → GHL seeder (CLI).** scripts/seed-goods-grants-ghl.mjs:1-70: reads
`act_grant_recommendations` for a project (default ACT-GD, fit ≥ 65), creates Grants-pipeline
opportunities with the same pipeline/stage/contact/custom fields as A1; idempotent by the
`discovery_source = civicgraph-engine:<opportunity_id>` stamp plus a fuzzy name dedupe. Ran
once 2026-07-07 (memory: 15 opps). Not in `agent_schedules` (query in §4). Dry-run by default.

**A7. Goods signals → GHL (CLI).** scripts/sync-goods-signals-to-ghl.mjs:1-30 pushes
`goods_procurement_signals` to the Demand Register / Buyer pipelines by name. 0 `agent_runs`
(`SELECT count(*) FROM agent_runs WHERE agent_id='sync-goods-signals-to-ghl'` → 0). Dormant.

**A8. Org contacts → GHL contacts.** POST `/api/org/[orgProfileId]/contacts/sync-ghl`
(apps/web/src/app/api/org/[orgProfileId]/contacts/sync-ghl/route.ts:7-90): every `org_contacts`
row with an email → `upsertContact` (apps/web/src/lib/ghl.ts:183-229, which also upserts
`ghl_contacts`) with tag `<slug>-<contact_type>` and the CivicGraph Profile custom field
`sGf7MWeuQTUuQIYp4VpS`; writes `person_identity_map.ghl_contact_id`. Idempotent by email.

**A9. GHL task bridge (write-only projection of the desk).**
apps/web/src/lib/services/act-ghl-task-bridge.ts:61-132, run from the desk-digest cron
(apps/web/src/app/api/cron/desk-digest/route.ts:25-27). One GHL task per due desk row, keyed by
`source_key` in `ghl_task_bridge`; title `[desk] <action>` (l.46-54); creates on
`/contacts/{id}/tasks` (triage contact when no ghlContactId, l.11,83), updates on title/date
change, deletes when the row leaves the due window (l.117-129). Never reads tasks back (comment
l.2-3). 8 bridge rows, all created 2026-09-14, all `ask:b-…` buyer rows with June due dates:
```sql
SELECT source_key, title, due_date, created_at::date FROM ghl_task_bridge ORDER BY created_at
```
(e.g. "[desk] Chase Tony Miles on the 9 Feb washer quote…", due 2026-06-18).

### B. "Decide" (pursue / pass / watch / later) — four parallel stores

**B1. Ops recommendations Apply / Watch / Pass, and the /org/act/pipeline kanban.**
- Triggers: apps/web/src/app/ops/grant-recommendations/grant-recommendations-client.tsx:317
  (`setDecision`) and apps/web/src/app/org/[slug]/pipeline/pipeline-kanban.tsx:195 (drag
  between columns; "Cannot move back to Discovered", l.187-194; Xero historical cards read-only
  l.175-178).
- Route: apps/web/src/app/api/ops/grant-recommendations/decide/route.ts:25-164 (`requireAdminApi`).
  Allowed: pursuing, watching, passed, applied, submitted, won, lost (l.5-13).
  Writes: upsert `act_grant_recommendation_decisions` on (project_code, opportunity_id) with
  decided_by/at, notes (l.114-130). For pursuing/applied/submitted it first **mirrors the
  `alma_funding_opportunities` row into `grant_opportunities`** (source
  'civicscope-act-recommendation', discovered_by 'act-grant-recommendations', l.65-111) and then
  upserts `saved_grants` (user_id, grant_id) at stage pursuing/submitted (l.138-157). Idempotent
  on both keys.
- Works today: code fine; data says it stopped being used two months ago. 89 rows: 62 passed
  (latest 2026-07-28), 26 won (all `decision_origin='xero_invoices'`, dated 2026-05-18: a Xero
  backfill, not clicks), 1 watching. 0 pursuing.
  ```sql
  SELECT decision_origin, count(*) FROM act_grant_recommendation_decisions GROUP BY 1
  ```
  → legacy 63, xero_invoices 26.

**B2. org_pipeline status / plan control.**
- Trigger: apps/web/src/app/org/[slug]/_components/act-pipeline-status-control.tsx:64-68 (status
  + outcome_reason) and l.91-99 (owner_name, next_action, next_action_at "plan").
- Route PATCH apps/web/src/app/api/org/[orgProfileId]/pipeline/route.ts:42-148 (org write
  access). Validates status via `isActPipelineStatus`, requires an outcome reason for closing
  statuses (l.71-73). Writes `org_pipeline.status/owner_name/next_action/next_action_at`
  (l.89-101) and, when `pipelineLearningDecision(status, pathway)` returns one, inserts an
  `opportunity_decisions` row keyed by `outcome = org_pipeline:<id>:<status>` (idempotent by a
  prior-row check l.113-140).
- Works today: route works; nobody has used the plan form: owner_name/next_action/next_action_at
  are 0/125 (§3) and `opportunity_decisions` has no `org_pipeline:` outcomes (all 7 rows listed
  in B4).

**B3. Funder outcome (foundation relationship).**
POST apps/web/src/app/api/org/[orgProfileId]/funder-intelligence/route.ts:127-210: inserts
`org_project_foundation_interactions`, updates `org_project_foundations.engagement_status,
next_step, next_touch_at, last_interaction_at`, inserts `opportunity_decisions`
(source_type 'funder_relationship') and upserts `opportunity_context_events`
(signal_kind 'funder_outcome'). 0 `funder_relationship` rows in opportunity_decisions → never
used. org_project_foundations engagement state today:
```sql
SELECT engagement_status, stage, count(*) AS n, count(next_step) AS with_next_step,
       count(next_touch_at) AS with_next_touch, count(ghl_contact_id) AS with_ghl
FROM org_project_foundations GROUP BY 1,2 ORDER BY n DESC
```
→ researching/saved 1,495 (495 with next_step, 0 next_touch, 15 ghl); researching/parked 44;
everything worked (approached/proposal/ready_to_approach/meeting) totals 11 rows.

**B4. opportunity-intelligence `research | partner_path | apply_path | later | no | record_review`.**
- Callers: desk record review "Make the call, record why"
  (apps/web/src/app/org/[slug]/_components/act-record-review.tsx:598-652), relationship action
  buttons Qualify/Record/Task/Park (act-relationship-action-buttons.tsx:141-162), resource desk
  `record_review` (resource-desk.tsx:62-108).
- apps/web/src/lib/opportunity-intelligence.ts:2491-2510 inserts `opportunity_decisions`
  (user_id, org_profile_id, source_type, source_ref, project_code, pathway, decision, reason,
  notes, evidence_gaps, outcome=receiptId). For research/partner_path/apply_path without a
  judgment it also calls `upsertRoutePipelineItem` → `org_pipeline` upsert on
  (org_profile_id, source_type, source_ref) with status researching/pursuing, owner_name,
  next_action (l.2580-2615, 2842-2853; failures become warnings, not errors).
  `promote_to_pipeline` inserts org_pipeline only with confirmWrite (l.2854-2882).
- All 7 opportunity_decisions rows:
  ```sql
  SELECT id, user_id, org_profile_id, source_type, source_ref, project_code, pathway, decision,
         left(reason,60) AS reason, outcome, created_at, supersedes_id FROM opportunity_decisions ORDER BY created_at
  ```
  → 4 × `goods / goods:Capital / ACT-GD / capital / research` on 2026-05-03 (org_profile_id NULL,
  outcome `op-action:research-goods-route-capital`), 3 × `grant / <uuid> / ACT-GD / grant / no`
  "Not relevant to Goods on Country" on 2026-08-11 (org 8b6160a1…). The 4 research rows have no
  org_profile_id, so the org_pipeline upsert cannot have run for them (it needs orgProfileId,
  l.2555+); consistent with org_pipeline having 0 `source_type` rows.

**B5. Desk marks (not decisions).** `Done → next / Waiting / Tomorrow`
(apps/web/src/app/org/[slug]/desk/desk-mark-buttons.tsx:18-34) → POST
`/api/org/[orgProfileId]/daily-actions` (route.ts:75-183) → upsert `opportunity_context_events`
signal_kind 'daily_action' keyed by Perth day + action id (l.109-128); with a `decision_id` and
status done it appends a `decision_outcome` event (l.137-180). Obligation rows: Done/Dropped →
PATCH `/api/org/[orgProfileId]/obligations` (desk-obligation-buttons.tsx:35-39). These are a
per-day "handled" memory; they do not record pursue/pass and do not touch GHL.

**B6. Goods signal track / review / dismiss / reset.** POST
`/api/goods/signals/[id]/action` (apps/web/src/app/api/goods/signals/[id]/action/route.ts:9-111):
updates `goods_procurement_signals.status/actioned_at/assigned_to/action_notes`; `track` inserts
`saved_grants` rows at stage 'researching' with `source_attribution_type='goods_signal'`
(l.72-89, dedupes against existing). 0 saved_grants rows carry that attribution (query in C1) →
never used.

**B7. The desk itself has no pursue and no pass.** The desk's decision rows say "Decide: pursue
(mint the Ask in GHL) or pass" for funders and "Decide: pursue (push to GHL) or pass" for grant
rounds (apps/web/src/lib/services/act-one-desk.ts:210,230); `isDecision = !inGhl` where inGhl is
`ghlWarmth !== 'not_in_ghl'` for funders (l.200, from `org_project_foundations.ghl_synced_at`
+ tags, goods-funder-scan.ts:106) and `Boolean(grant_opportunities.ghl_opportunity_id)` for
grants (l.223, goods-grants-triage.ts:63,96). The page apps/web/src/app/org/[slug]/desk/page.tsx
imports only DeskMarkButtons and DeskObligationButtons (l.9-10). Pursue for a grant means
leaving to `/org/act/goods/grants` and pressing A1; for a funder, `workHref` is
`/org/act/goods/foundations/scan` (l.213), which has **no push button** — only a
`view=unpushed` filter labelled "Push-next queue"
(apps/web/src/app/org/[slug]/goods/foundations/scan/page.tsx:126-130); no
`foundations/push-ghl` route exists under apps/web/src/app/api (directory listing taken). Pass
exists nowhere on the desk; the two writers of a pass decision (B1 'passed', B4 'no') are not
wired from it, and the desk does not read opportunity_decisions to exclude passed rows. Result:
the 2026-09-14 digest carried "177 new decisions" and the 2026-09-20 heartbeat "nothing new, 177
open decisions" (digest_log, §E1). The decision count cannot go down from the desk.

### C. "Save" / "Watch" — six tables for one verb

**C1. saved_grants (the /tracker kanban).**
- PUT `/api/tracker/[grantId]` (apps/web/src/app/api/tracker/[grantId]/route.ts:12-68): upsert on
  (user_id, grant_id) with stars, color, stage, notes, partner_contact_ids, org_profile_id
  (org edit role checked l.25-37). DELETE l.119-135. Callers (grep, non-API): /tracker
  kanban-board.tsx:88-132, home-client.tsx:624, watchlist-client.tsx:285, alerts/page.tsx:595,
  grant-notes.tsx:34, grant-card-actions.tsx:62, grant-actions.tsx:47, partner-picker.tsx:87,
  list-preview.tsx:379, profile matches/profile clients.
- GET `/api/tracker` (route.ts:6-245) silently mutates on read: auto-expires active stages past
  `closes_at` (l.28-50, 83-104) and auto-'lost's grants with `grant_feedback.vote=-1`
  (l.106-122, 215-231); merges org_pipeline rows in as pseudo-cards (l.136-210).
- GHL side effect: when stage ∈ {pursuing, submitted, approved, realized, lost, expired} and
  `GHL_API_KEY` is set, fire-and-forget `syncToGHL` (l.60-65, 70-117) creates a Grants-pipeline
  opportunity via apps/web/src/lib/ghl.ts:53-74 **without a contactId** (createOpportunity only
  adds it when passed; the tracker never passes one) — GHL returns 422 for that per memory
  (project_ghl_goods_opportunity_tracking.md: "Every opportunity requires a contactId"). Errors are
  only console.error'd. Evidence: 0 of 2,916 saved_grants rows have `ghl_opportunity_id`.
- Who actually writes saved_grants:
  ```sql
  SELECT stage, source_attribution_type, (ghl_opportunity_id IS NOT NULL) AS has_ghl, count(*) AS n,
         count(DISTINCT user_id) AS users, count(DISTINCT org_profile_id) AS orgs,
         min(created_at)::date AS first, max(created_at)::date AS last
  FROM saved_grants GROUP BY 1,2,3 ORDER BY n DESC
  ```
  | stage | attribution | n | users | first→last |
  |---|---|---|---|---|
  | discovered | (none) | 1,923 | 3 | 2026-04-27 → 2026-09-24 |
  | lost | scout_auto | 523 | 1 | 2026-04-14 → 04-22 |
  | discovered | scout_auto | 235 | 2 | 04-10 → 04-22 |
  | lost | (none) | 125 | 1 | 03-19 → 05-03 |
  | expired | scout_auto / none | 46 / 38 | 1 | |
  | pursuing | (none) | 10 | 1 | 03-10 → 05-15 |
  | researching | scout_auto / none | 10 / 5 | 1 | |
  | submitted | (none) | 1 | 1 | 2026-03-19 |
  The 1,923 unattributed 'discovered' rows are the nightly scout: scripts/scout-grants-for-profiles.mjs:178-188
  upserts `{user_id, grant_id, stage:'discovered', notes:'Auto-discovered by Grant Scout…'}`
  with no attribution columns (the TS twin apps/web/src/lib/grant-scout.ts:309-327 does set
  `scout_auto`, but the orchestrator runs the .mjs: scripts/lib/agent-registry.mjs:1071-1078,
  schedule every 24h, last 2026-09-24 02:12, 119 successes, items_new 9,596 lifetime). Human
  "pursuing" activity: 10 rows, last 2026-05-15. Monthly: Apr 985, May 864, Jun 566, Jul 37, Aug
  222, Sep 195 rows.
- Read back from GHL: scripts/sync-ghl-to-tracker.mjs:94-125 updates `saved_grants.stage` from the
  Grants pipeline for rows with ghl_opportunity_id — a no-op today (0 such rows). Registered
  (agent-registry.mjs:183-190) but not in agent_schedules.

**C2. saved_foundations.** PUT/DELETE `/api/foundations/saved/[foundationId]`
(apps/web/src/app/api/foundations/saved/[foundationId]/route.ts:7-71): upsert on
(user_id, foundation_id) with stars/stage/notes/last_contact_date/org_profile_id. Callers
foundation-card-actions.tsx:70-86, foundations/tracker/tracker-client.tsx:194-203.
```sql
SELECT stage, relationship_stage, count(*) AS n, count(DISTINCT user_id) AS users,
       count(DISTINCT org_profile_id) AS orgs, count(alignment_score) AS scored,
       min(created_at)::date AS first, max(created_at)::date AS last FROM saved_foundations GROUP BY 1,2
```
→ discovered 178 (161 with alignment_score, 2026-03-10 → 2026-09-17), active_relationship 2 and
researching 2 (both 2026-03-05). The 178 come from scripts/score-foundation-alignment.mjs
(writes at l.179-213); four rows are human, from March.

**C3. entity_watches.** POST `/api/watches` (apps/web/src/app/api/watches/route.ts:26-66)
upserts on (user_id, entity_id) from a gs_id with default watch_types
['contracts','grants','relationships']; DELETE `/api/watches/[watchId]`. Button on
`/entities/[gsId]` (watch-button.tsx:23-27; the "unwatch" branch is visual only, l.19-21).
0 rows. Weekly email `/api/watches/digest` (route.ts:151-163 sends via Gmail, updates
last_checked_at) and scripts/check-entity-watches.mjs (registry l.1107-1113, last agent_run
2026-03-18, no schedule row). Dead.

**C4. jm_watches.** Not a grantscope surface: schema-ownership seed marks it justicehub-owned
with 14 JusticeHub code refs and 0 here
(supabase/migrations/20260905140000_schema_ownership_seed.sql:468); definition
baseline_remote_schema.sql:31653-31663 (entity_kind case|campaign|issue|gap, email, surface,
ghl_synced). 4 rows (`SELECT * FROM jm_watches ORDER BY created_at`): 3 cases + 1 campaign,
3 with ghl_synced=true, emails ben@… plus two members of the public, latest 2026-09-23.

**C5. org_pipeline "Add to pipeline".** apps/web/src/app/org/_components/matched-grants.tsx:65-96
→ POST `/api/org/[orgProfileId]/pipeline` (route.ts:26-40, raw body insert, no unique key, not
idempotent) with status 'prospect', funder_type 'government', grant_opportunity_id. Never used:
all 125 rows were created 2026-03-16 → 03-19 by the seed SQL
(scripts/seed-act-lateral-revenue.sql:13,84,166; scripts/seed-act-deep-sweep.sql:21-119).

**C6. Foundation "+ Track" (Goods).** apps/web/src/app/org/[slug]/goods/foundations/track-button.tsx:30-44
→ server action `trackFoundationTarget` (goods/foundations/actions.ts:40 inserts
`goods_relationships`, revalidates l.63-64). goods_relationships is otherwise owned by the
GHL read-back (F1), so a Track row is a discovery row inside the relationship mirror.

**C7. act_ask_artefacts.** scripts/set-ask-artefact.mjs:35-42 upserts (ghl_opportunity_id,
org_profile_id, artefact_url, ask_name, set_by 'make-the-ask'); read by
apps/web/src/lib/services/act-ask-artefacts.ts:38-51 for the desk's "Open draft in Notion ↗".
0 rows: the skill's parking step (SKILL.md:71-81) has never been completed.

**C8. org_project_foundations** — 1,553 rows, stage 'saved' on 1,495 (query in B3); written by
the foundation matcher, the projects/[projectId]/foundations import route (candidates derived
from org_pipeline rows, apps/web/src/app/api/org/[orgProfileId]/projects/[projectId]/foundations/route.ts:159-198),
the funder-outcome route (B3) and the GHL reconcile (F2, ghl_* columns on 23 rows).

### D. Notion

**D1. scripts/sync-act-opportunities-to-notion.mjs** (1-256): `act_grant_recommendations`
strong fits that have a decision → Notion Opportunities DB (`NOTION_OPPORTUNITIES_DB_ID`);
STAGE_MAP discovered→"Grant Opportunity Identified", pursuing→Scoping, won→Paid, passed→Composting
(l.46-55); page body = fit callout + flags + bookmark (l.100-147); idempotent by
`act_grant_recommendation_decisions.notion_page_id` (l.152-158, 174-189). Not in the agent
registry or schedules; 0 notion_page_id populated → never completed a real run.

**D2. Admin button** POST `/api/ops/grant-recommendations/sync-notion`
(apps/web/src/app/api/ops/grant-recommendations/sync-notion/route.ts:4-6 says it duplicates D1
so the button needs no Node). Same evidence: never landed a page id.

**D3. scripts/sync-pipeline-to-notion.mjs** (1-319): for each `enterprise` org's user (l.263-268:
act, justicehub) pushes `saved_grants` → "Grant Pipeline Tracker" and `saved_foundations` →
"Foundation Targets" Notion DBs (`NOTION_GRANT_PIPELINE_DB`, `NOTION_FOUNDATION_TARGETS_DB`),
deduping by a 'CivicGraph ID' text property (l.208-226). Registered (agent-registry.mjs:1179-1186,
depends on scout + score-foundation-alignment) but **schedule disabled**
(`agent_schedules.enabled=false`, last 2026-04-22); agent_runs 15 failed / 2 success, last
success 2026-08-09 with items_new 3,281 — a manual run that would have pushed the scout's
auto-discovered rows into Notion.

**D4. Funding brief** — A4.

**D5. opportunity_promotions** — 7 rows dated 2026-08-11 22:39–23:32, target_system 'notion',
6 'linked' + 1 'promoted' (Minderoo Foundation Artist Fund, target_url app.notion.com/…):
```sql
SELECT id, source_type, source_ref, project_code, target_system, target_record_id, status, promoted_at FROM opportunity_promotions ORDER BY created_at
```
No writer of this table was found under apps/web/src or scripts (grep for the table name in
write context); the rows coincide with the 2026-08-11 'no' decisions in B4. Writer not located.

**D6. /make-the-ask (the "pursue" ritual as a skill).** .claude/skills/make-the-ask/SKILL.md:
eight steps — 1 pull CivicGraph evidence (gsql on foundations + org_project_foundations,
`/org/act/orgs/<slug>`), 2 WebFetch the funder's real requirements, 3 frame against the
capital plan (`GOODS_CAPITAL_BLOCK_SEED`, DGR via Butterfly only), 4 draft with /act-voice,
5 /ground, 6 park in Notion by duplicating "Ask template — Goods funding (duplicate me)" and
then `scripts/set-ask-artefact.mjs <ghl_opportunity_id> <notion_url>` (l.59-81), 7 set the GHL
next action (Tier 2 confirm; if still a Signal, "the pursue push (grants triage / funder scan
buttons) mints the card — that's Ben's click", l.83-87), 8 hand over. Boundaries l.94-97: never
submit, never move a GHL stage to Submitted/Won/Lost. Reality check: step 7's "funder scan
button" does not exist (B7); step 6's artefact link has 0 rows (C7). Reference run Balnaves
2026-08-05 lives only in thoughts/shared/drafts/.

### E. Digests

**E1. Desk digest (works).** vercel.json:44-45 cron `/api/cron/desk-digest` at 21:00 UTC
(07:00 Brisbane). Route apps/web/src/app/api/cron/desk-digest/route.ts:14-49 (Bearer
CRON_SECRET; `?dry=1`). Composition apps/web/src/lib/services/act-desk-digest.ts:48-130 reuses
`getOneDesk` verbatim (decisions = `isDecision` rows; due = asks with dueDays ≤ 0, obligations
≤ 7d, `act_people` review_by ≤ 7d — act_people has 0 rows). Delta against the last `digest_log`
row (l.198-213), Monday heartbeat (l.144-146, 209), Resend to `DESK_DIGEST_TO` (default
hi@act.place; comment l.177-180 explains the 403 history), log row l.219-225. Then the GHL task
bridge (A9).
```sql
SELECT sent_at, subject, counts, heartbeat, channel FROM digest_log ORDER BY sent_at
```
→ 2026-09-14 "Desk: 177 new decisions, 8 going due"; 2026-09-20 heartbeat "nothing new, 177
open decisions, 8 due"; 2026-09-21 "2 new decisions, 0 going due". Preview page
apps/web/src/app/org/[slug]/digest-preview/page.tsx:33-91 renders the same pool, never sends.
Spec: docs/specs/grants-digest-spec.md (delta-only + Monday heartbeat; originally GHL email API,
built on Resend instead).

**E2. Weekly grant-alert digest (runs, sends nothing).** scripts/send-grant-alert-digests.ts:17-38
→ `sendGrantAlertDigests` (apps/web/src/lib/grant-alert-digests.ts): per org profile, reads
`alert_preferences` (l.297), `alert_notifications`, `grant_notification_outbox` since period
start (l.365-371) and skips the profile when no outbox rows (l.378-380); sends through
`sendEmail` from `@/lib/gmail` (needs GOOGLE_SERVICE_ACCOUNT_KEY + GOOGLE_DELEGATED_USER,
gmail.ts:58-61); records `alert_notifications`. Registry agent-registry.mjs:1087-1094, schedule
168h, last 2026-09-22.
```sql
SELECT agent_id, status, count(*) AS n, max(started_at) AS last, sum(items_new) AS items_new
FROM agent_runs WHERE agent_id IN ('deliver-grant-notifications','send-grant-alert-digests') GROUP BY 1,2
```
→ send-grant-alert-digests success 25, items_new (= digestsSent) **0**; deliver-grant-notifications
has no runs at all.
```sql
SELECT status, count(*) AS n, min(created_at)::date, max(created_at)::date FROM grant_notification_outbox GROUP BY 1
```
→ cancelled 771, 2026-04-14 → 2026-05-15. Nothing has fed the outbox since 2026-05-15, so every
weekly run ends in `skippedNoChanges`. alert_preferences: 3 rows, all Ben's user
(Indigenous Procurement & Justice daily; Technology & Data weekly; Youth & Community weekly).
Manual trigger `/api/alerts/digest` exists (route.ts:6-30, Professional tier gate).

**E3. scripts/test-digest.mjs** is not a grants digest: it builds the CivicScope QLD youth-justice
weekly briefing from civic_* tables via Groq and inserts `civic_digests` (l.27-55, 138-189).
Its production twin is `/api/civicscope/digest` (vercel.json:28-29, daily 06:00 UTC).

**E4. Funding weekly cycle (in-app only).** vercel.json:48-49 Monday 00:00 UTC →
`/api/cron/funding-weekly-digest` (route.ts:3) → apps/web/src/lib/services/funding-weekly-digest.ts:17-50
upserts `funding_weekly_cycles` (8 rows, latest 2026-09-21) with delivery_status 'in_app'; no
send. Reads act_grant_recommendation_decisions for pursued/submitted/won counts (0/0/26).

### F. GHL → CivicGraph read-back (relationship state cache)

**F1. sync-goods-ghl** (registry l.69-76, schedule 12h) — scripts/sync-goods-ghl.mjs:1-90 pages
three hardcoded Goods pipelines (Supporter Journey `JvBFYpVpyKsw899lkFgj`, Buyer
`FjMyJM3YzWQFmKqR9fur`, Demand `UQsrmuqzxMSdCTklxEcG`), maps stage-id prefixes to the
engagement ladder and upserts `goods_relationships` on dedupe_key (l.466-467). **Failing again
with 401 "Invalid Private Integration token"** on every run since 2026-09-23 02:04; last success
2026-09-22 14:00; lifetime 122 failed / 91 success:
```sql
SELECT agent_id, status, started_at, errors::text FROM agent_runs WHERE agent_id='sync-goods-ghl' AND status='failed' ORDER BY started_at DESC LIMIT 1
```
→ `GHL API 401 on …/opportunities/pipelines?locationId=agzsSZWgovjwgpcoASWG … FATAL: GHL fetch
failed for pipeline Goods Supporter Journey`. This is the token-rot pattern from
solution_ghl_token_source_of_truth.md, back 18 days after the fix. Note the schedule row's
last_run_at (2026-09-22 14:00) only records successes.

**F2. reconcile-foundations-ghl** (registry l.81-88, 24h) — writes `org_project_foundations`
ghl_contact_id/email/tags/synced_at (scripts/reconcile-foundations-ghl.mjs:105-106). Success on
2026-09-22 and 2026-09-23 while F1 was failing (14 success / 3 failed / 1 timed_out). 23 rows
synced, max ghl_synced_at 2026-09-21. **Inferred:** the token still has contact scope but not
opportunity scope, or the two scripts read different env files; not verified.

**F3. ghl_opportunities mirror** (1,322 rows, last_synced 2026-09-24 02:17) is written by the
edge function supabase/functions/ghl-webhook/index.ts:147 and, inferred from
`ghl_sync_log` (full_sync ghl_to_supabase: 1,097 success, 214 error, last 2026-09-24), by a
full sync outside this repo. Pipeline names in the mirror, by status
(`SELECT pipeline_name, status, count(*), max(ghl_updated_at)::date FROM ghl_opportunities GROUP BY 1,2`):
"Grants" open 239 / lost 52 (last update 2026-08-30); "GOODS - Funding" open 59 / won 5 / lost 4
(2026-09-20); "GOODS - Buyers" open 8 / won 2 / abandoned 12; "GOODS - Demand" open 75;
"GOODS - Community" open 16 (2026-09-20); versus the names the code hardcodes — "Goods — Buyer
Pipeline" open 19 / won 11 (last 2026-05-31), "Goods — Demand Register" open 84 (2026-05-31),
"Goods Supporter Journey" open 1 (2026-07-06). **Inferred:** the Goods boards were rebuilt in GHL
around June–September under new names; every push and sync in this repo still targets the old
ids/names (goods-buyer-ghl.ts via env, sync-goods-ghl.mjs:50-54, ghl.ts:25-29,
sync-goods-signals-to-ghl.mjs:19-20). Needs Ben to confirm.

**F4. funding_ghl_sync_runs** (556 rows) and `funding_ghl_sync_state` have no writer in this repo
(grep); they belong to the sibling repo's sync. Unverified.

## 3. org_pipeline — what is actually in it (verified)

```sql
SELECT count(*) AS rows_total, count(name) AS name, count(amount_numeric) AS amount_numeric,
 count(amount_display) AS amount_display, count(funder) AS funder, count(deadline) AS deadline,
 count(status) AS status, count(grant_opportunity_id) AS grant_opportunity_id, count(notes) AS notes,
 count(funder_entity_id) AS funder_entity_id, count(funder_type) AS funder_type, count(project_id) AS project_id,
 count(ghl_opportunity_id) AS ghl_opportunity_id, count(source_type) AS source_type, count(source_ref) AS source_ref,
 count(pathway) AS pathway, count(recommended_role) AS recommended_role, count(project_code) AS project_code,
 count(last_synced_at) AS last_synced_at, count(qbe_stage) AS qbe_stage, count(qbe_qualified_at) AS qbe_qualified_at,
 count(qbe_bid_amount) AS qbe_bid_amount, count(qbe_submitted_at) AS qbe_submitted_at, count(qbe_evaluated_at) AS qbe_evaluated_at,
 count(qbe_outcome) AS qbe_outcome, count(opportunity_type) AS opportunity_type, count(owner_name) AS owner_name,
 count(next_action) AS next_action, count(next_action_at) AS next_action_at,
 min(created_at) AS first_created, max(created_at) AS last_created, max(updated_at) AS last_updated FROM org_pipeline
```

| column | populated / 125 |
|---|---|
| name, status, notes, project_code, opportunity_type | 125 |
| amount_display, funder, funder_type | 112 |
| project_id | 86 |
| amount_numeric | 65 |
| deadline | 39 |
| grant_opportunity_id | 31 |
| funder_entity_id | 16 |
| ghl_opportunity_id, source_type, source_ref, pathway, recommended_role, last_synced_at | **0** |
| qbe_stage, qbe_qualified_at, qbe_bid_amount, qbe_submitted_at, qbe_evaluated_at, qbe_outcome | **0** |
| owner_name, next_action, next_action_at | **0** |

created 2026-03-16 → 2026-03-19 (all 125), updated_at max 2026-08-01 04:00 (one bulk touch).

```sql
SELECT status, opportunity_type, funder_type, project_code, count(*) AS n, sum(amount_numeric) AS amt
FROM org_pipeline GROUP BY 1,2,3,4 ORDER BY n DESC
```
Status: prospect ≈ 91, passed ≈ 30, submitted 2, upcoming 1. Types: grant (majority),
revenue_stream 22 (ACT-CORE 17 commercial, no amounts), foundation 21, partnership 3,
certification 2, scholarship 1. Projects: ACT-CORE 33, ACT-IN 17, ACT-GP 13, ACT-EL 15, ACT-GD 10,
ACT-HV 7, ACT-MY 6, ACT-FM 6, ACT-CS 4, ACT-PI 4, ACT-JH 4, ACT-CN 2. Largest amounts: ACT-IN
partnership/government $2.0M, ACT-CORE foundation prospects $2.05M, ACT-GD passed government
$1.55M, ACT-GD submitted government $1.2M.

Reading: org_pipeline is a March-2026 seeded snapshot of the ACT revenue landscape (the two seed
SQL files), with 14 columns added later for GHL/QBE/next-action that nothing has ever filled. It
is read by the tracker (pseudo-cards), the org dashboard, act-atlas, act-cross-projects,
goods-funnel and the foundation import route; it is written by nothing since March except the
status PATCH (unused). It is not a pipeline; it is a table nobody edits.

## 4. Scheduling state of the action agents (verified)

```sql
SELECT agent_id, interval_hours, enabled, last_run_at, priority FROM agent_schedules
WHERE agent_id IN ('sync-goods-ghl','reconcile-foundations-ghl','sync-ghl-to-tracker','scout-grants-for-profiles',
 'send-grant-alert-digests','check-entity-watches','sync-pipeline-to-notion','deliver-grant-notifications',
 'seed-goods-grants-ghl','score-goods-relevance') ORDER BY 1
```
| agent | every | enabled | last run |
|---|---|---|---|
| reconcile-foundations-ghl | 24h | yes | 2026-09-23 |
| score-goods-relevance | 24h | yes | 2026-09-24 |
| scout-grants-for-profiles | 24h | yes | 2026-09-24 |
| send-grant-alert-digests | 168h | yes | 2026-09-22 |
| sync-goods-ghl | 12h | yes | 2026-09-22 (successes only) |
| sync-pipeline-to-notion | 24h | **no** | 2026-04-22 |
| sync-ghl-to-tracker, check-entity-watches, deliver-grant-notifications, seed-goods-grants-ghl | not scheduled | | |

Vercel crons (vercel.json:10-50): civicscope ×5, watchhouse ×2, desk-digest 21:00 UTC daily,
funding-weekly-digest Monday 00:00 UTC. pm2 runs only the orchestrator (ecosystem.config.js:3-4).

## 5. Judgement

### What is true today
1. There are **four pursue implementations** (A1 Goods grant button, A2 buyer button, A3 designed
   form, A5 generic action) and **four decision stores** (act_grant_recommendation_decisions 89
   rows, opportunity_decisions 7, saved_grants.stage as a shadow pipeline, funding_ghl_handoffs
   0). Only A1 and A2 can be reached from a screen; A3 has never succeeded; A5 has no caller.
2. There are **six save tables** (saved_grants, saved_foundations, org_project_foundations,
   goods_relationships, org_pipeline, entity_watches). Human saves are a rounding error: the
   scorers and scouts wrote 1,923 + 178 + 1,495 rows; humans wrote ~20 grant rows (last May) and
   4 foundation rows (last March).
3. **The desk asks for a decision it cannot take.** 177 rows say "Decide: pursue or pass"; the
   desk offers Done/Waiting/Tomorrow, which only write a per-day handled event
   (opportunity_context_events). Pass does not exist; funder pursue does not exist; grant pursue
   is a different page. That is why the digest reported 177 new decisions on 2026-09-14 and the
   same 177 open a week later.
4. **GHL read-back is half-broken**: sync-goods-ghl 401 since 2026-09-23 (token rot, second
   occurrence), and the Goods pipeline ids the code hardcodes look superseded in GHL (F3).
   Meanwhile "in GHL" for grants on the desk comes from an unlocated 2026-09-20 backfill of 725
   ghl_opportunity_ids, not from anything a person did.
5. **Notion is disconnected**: 0 notion_page_id, 0 act_ask_artefacts, sync disabled since April.
   The one working Notion path is the human one in /make-the-ask.
6. **Two of three digests do nothing**: the weekly grant-alert digest has run 25 times and sent 0
   (outbox starved since 2026-05-15); the funding weekly cycle is in-app only. The desk digest
   works and is the only channel that reflects the three-pipeline rule.
7. The GHL task bridge works but projected eight June-dated buyer asks on 2026-09-14 and nothing
   since; `act_people` (its people source) is empty.

### What a "save" in CivicGraph should write
A save is a discovery-layer annotation: "this thing is worth a look, for this project, because".
It must not create a relationship (no GHL contact/opportunity), must not carry a stage vocabulary
that mimics GHL's, and must not be filled by a scorer (a scorer's output is a recommendation,
not a save). Concretely: one row in one table keyed by (org_profile_id, source_type, source_ref)
with user_id, project_code, reason/tags, evidence_grade, saved_at and an optional revisit_at.
`opportunity_decisions` already has this shape (source_type, source_ref, project_code, pathway,
reason, evidence_gaps, supersedes_id) and its `decision` enum can hold 'save' / 'later'
alongside 'pursue' / 'pass'. The scout and scorers should stop writing saved_grants /
saved_foundations and write only their recommendation MVs; saved_grants (2,916 rows) becomes
the personal /tracker kanban for outside users only, or is retired with it.

### What a "decide" should write, to respect the rule
- **Pass**: append one `opportunity_decisions` row (decision 'pass', reason required,
  supersedes_id when overriding). No GHL write, no Notion write. The desk and the digest must read
  the latest decision per (source_type, source_ref) and drop passed rows — today neither does,
  which is why pass "does not exist".
- **Later**: same row with revisit_at; desk hides until then.
- **Pursue**: append the decision row, then mint the Ask in GHL exactly once (contact or triage
  fallback + pipeline + "Identified" stage + `discovery_source = civicgraph-<type>:<id>`), and
  write the returned id back onto the source row's single pointer
  (`grant_opportunities.ghl_opportunity_id`, `org_project_foundations.ghl_contact_id`,
  `goods_procurement_entities.ghl_opportunity_id`) so `inGhl` becomes true on the next read.
  Nothing else is written locally: owner, next action, due date and stage are GHL's, and
  CivicGraph only caches them via the reconcile (F2 pattern) into ghl_* columns. This is the
  spec's "pursue mints the Ask in GHL, full stop"
  (docs/specs/grants-notion-handoff-spec.md:9-10) and it is what A1 already does for grants; A3's
  extra local record (funding_ghl_handoffs with owner/next_action/amount) duplicates GHL state and
  should not survive, nor should org_pipeline's owner_name/next_action/qbe_* columns.
- **Notion**: written only by the human /make-the-ask ritual when production starts; the one
  automated write is `act_ask_artefacts` (URL ← GHL id), which should become a step the desk can
  perform ("attach draft") rather than a CLI.
- **Idempotency keys**: decisions are append-only (no key); GHL mint is guarded by the pointer
  column plus the discovery_source stamp; artefact link keyed by ghl_opportunity_id.

With that, the four decision stores collapse to one (fold act_grant_recommendation_decisions in
as source_type 'alma_opportunity', drop the 26 xero rows or keep them as 'won' with
decision_origin), the six save tables to one, and the desk gains the two buttons its copy
already promises.

## 6. Gaps (what I could not verify)
- Who wrote the 725 `grant_opportunities.ghl_opportunity_id` values on 2026-09-20 (no writer in
  this repo; probably the sibling repo's GHL sync).
- Whether `GHL_GRANTS_TRIAGE_CONTACT_ID`, `GHL_GOODS_PIPELINE_ID`, `GHL_GOODS_BUYER_STAGE_ID`,
  `NOTION_OPPORTUNITIES_DB_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY` are set in Vercel (`/config-truth`
  territory).
- Whether the "GOODS - Funding/Buyers/Demand/Community" boards replaced the hardcoded Goods
  pipeline ids (inferred from the mirror only).
- Why reconcile-foundations-ghl succeeds while sync-goods-ghl gets 401 (token scope vs env file).
- The writer of `opportunity_promotions` (7 rows, 2026-08-11) and of `funding_ghl_sync_runs`.
- Whether `/org/act/grants` (the non-Goods grant-round page the desk links to) has any push
  button; not read.
- Whether the three desk-digest emails to hi@act.place were read by anyone.
