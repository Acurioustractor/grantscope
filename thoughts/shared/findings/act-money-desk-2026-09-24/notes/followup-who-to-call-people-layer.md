# Follow-up reader: who-to-call-people-layer

Date 2026-09-24. Repo `/Users/benknight/Code/grantscope` (branch feat/act-money-desk, read-only) plus
`/Users/benknight/Code/act-global-infrastructure` (read-only). ACT org_profile_id `8b6160a1-7eea-4bd2-8404-71c196381de0`.
Every number below was run today via `node --env-file=.env scripts/gsql.mjs "<sql>"` from the grantscope root unless
marked otherwise. Confidence tags: [verified] = I read the file or ran the query; [inferred] = derived; [unverified] = taken on faith.

Question: when the one place says pursue on a funder or buyer, which table gives the person, their warmth and the warm
path, and how fresh is it.

---

## 0. Judgement first

1. **`act_people` is empty because nobody ever minted a Person, not because a mint failed.** The mint path is a modal on
   `/org/[slug]/people` → `POST /api/org/[orgProfileId]/people` → GHL contact create (tag `record:person`, source
   `civicgraph-people-mint`) → `setWarmthTag` → task → mirror insert. `ghl_contacts` holds **0** rows with
   `source = 'civicgraph-people-mint'` (the 454 `record:person` tags come from act-global's taxonomy migration, all `source='ghl'`),
   `act_person_roles` and `act_ask_warmers` are 0, and no `agent_runs` row exists for `reconcile-act-people-ghl`. Three consumers
   (`act-desk-people.ts`, `act-desk-digest.ts:106`, `act-people.ts:71`) read a table whose only writer is a button Ben never pressed. [verified]

2. **Today the only table that puts a person with an email next to a funder the desk shows is `funder_context_snapshot.contacts`**
   (jsonb array of `{name,email,last_contact_date}` built nightly from `ghl_contacts` by company-name ILIKE + email-domain match,
   `scripts/refresh-funder-context.mjs:361-377`). It reaches **39 of the desk's 192 funder rows** (46 of ACT's 710 matched foundations).
   `contact_entity_links` → `ghl_contacts` adds nothing beyond that set (24 rows, all inside the 39). `org_contacts` funder rows
   have **0 emails** on all 37. `foundation_people` covers 3 foundations. **148 of 192 desk rows have no person of any kind**
   (no email, no scraped officeholder, no board path). [verified]

3. **Warmth has two vocabularies that do not meet.** (a) The `goods-*` tag on `ghl_contacts.tags` (98 contacts total; mirror refreshed
   every 6h from GHL by act-global `sync-ghl-to-supabase.mjs`; written by grantscope's `setWarmthTag`, which has never fired, and otherwise
   hand-set in GHL or by the archived 2026-05-27 Goods seed scripts). (b) `relationship_health.temperature` 0-100 + `lcaa_stage`
   (3,401 rows, recomputed daily 3am by act-global `compute-contact-signals.mjs` from email/calendar/Xero/pipeline/knowledge signals).
   For the 153 snapshot contacts attached to desk funders: 21 carry a goods-* tag, 126 have a temperature. A third, per-org score
   (`goods_relationships.warmth_display`, computed from stage+recency+money in `sync-goods-ghl.mjs:212-231`) ignores the tags entirely.
   The one place can read `ghl_contacts.tags` directly: the 22 `org_project_foundations.ghl_tags` cache rows agree 22/22 with the mirror
   and the mirror is 3 days fresher. [verified]

4. **`person_identity_map` is dead.** 14,919 rows, `max(updated_at)` 2026-03-19, no scheduled writer in either repo (grantscope
   `link-contacts-to-people.mjs` / `sync-contact-tags.mjs` are not in the agent registry; act-global `consolidate-contacts.mjs` is not in
   `ecosystem.config.cjs`). It is 9,342 + 4,358 LinkedIn exports from Nic and Ben plus Gmail discovery, `funding_capacity` NULL on all.
   Its only live use is `act-people-directory.ts:512-515` (identity status badge). `canonical_entities` (15,384 `entity_type='person'`,
   32 rows touched in the last 30 days, `v_unified_contacts` on top) is a **fourth** person spine that the directory treats as "canonical". [verified]

5. **Board bridges: 2,651 `funder_board_paths` are 100% `path_grade='unverified'` by construction** (`rebuild_funder_board_paths()`
   in the baseline hard-codes the literal `'unverified'`; there is no code path that sets any other grade). They touch 32 of ACT's 710
   foundations (13 desk rows); 20 land on a `goods_relationships` entity and only 3 on an entity an ACT `org_contacts` row is linked to.
   `v_goods_foundation_targets.has_bridge` (75 of 2,098) is a different computation (`mv_person_entity_network` name match to a Goods
   org, no identity clustering, no collision risk). The dossier's own organisation-bridge query (`act-funder-intelligence.ts:832-871`)
   finds **7 foundations, 4 connectors, 2 ACT contacts** for the whole ACT portfolio. "Verified" would need a human to confirm the
   identity cluster is one person AND that ACT's contact actually knows them; nothing stores that today. [verified]

**Design consequence.** A pursue verb on a funder card can show a person sub-row on ~20% of desk rows today, sourced from
`funder_context_snapshot.contacts` deduped by email and joined to `ghl_contacts` (tags, ghl_id) and `relationship_health`
(temperature, lcaa_stage, last_contact_at). `warm_via` exists nowhere populated; "via" can only be derived (shared-organisation
bridge, 7 foundations) and must be labelled a hypothesis. The rest of the rows need either a mint (act_people) or a research
lead (registry officeholders: 95 of the 100 desk foundations have `person_roles`, name + role, no email).

---

## 1. Q1: why `act_people` is empty when three consumers read it

### 1.1 The table and its intended writer [verified]

- Created by `supabase/migrations_history/pre-baseline-supabase/20260806120000_act_people.sql:1-35`: header says "GHL owns existence
  + relationship state ... this table is the READ MIRROR ... Synced by scripts/reconcile-act-people-ghl.mjs". `ghl_contact_id text not null unique`.
- Columns today (information_schema): `id, org_profile_id, ghl_contact_id, name, warmth, warm_via, owner, next_action, review_by,
  ghl_task_id, last_touch_at, last_synced_at, minted_by, minted_at, created_at, updated_at, project_codes`.
- Ownership seed `supabase/migrations/20260905140000_schema_ownership_seed.sql:65`: `('act_people', 'act', 'grantscope', ... code refs grantscope:18 ... act:0 ...)`
  so act-global has zero references; the only code that touches it is grantscope.

### 1.2 The three consumers [verified]

| consumer | read | behaviour on empty |
|---|---|---|
| `apps/web/src/lib/services/act-desk-people.ts:35-62` | `act_people` where `org_profile_id`, keeps rows with `review_by` ≤ 7 days | returns `[]`; comment `:5-7` "Until it exists this feed returns []" |
| `apps/web/src/lib/services/act-desk-digest.ts:102-125` | same table, same ≤7d rule, pushes `source:'person'` rows into the digest | zero person lines |
| `apps/web/src/lib/services/act-people.ts:67-118` (`getActPeople`, the `/org/[slug]/people` page) | `act_people` + `act_person_roles` + `act_ask_warmers` | page shows "No People yet" (`people/page.tsx:192`) |

`act-one-desk.ts:139` wires `getDeskPeople` into the pool as `kind:'person'` (`:165-180`). The brief's "GHL task bridge" (`act-ghl-task-bridge.ts`)
does **not** read `act_people` (grep for `people|person|act_people` returns nothing in that file); the digest is the third reader.

### 1.3 The only mint path [verified]

`apps/web/src/app/api/org/[orgProfileId]/people/route.ts`:
- `:32-47` POST requires `name, warmth, next_action, review_by` ("no inert People").
- `:52-56` if no `ghl_contact_id` supplied → `createPersonContact()` (`act-people-ghl.ts:37-54`: POST `/contacts/` with `tags:['record:person'], source:'civicgraph-people-mint'`),
  then `setWarmthTag()` (`:57-67`, replaces the single `goods-*` tag), then `upsertNextActionTask()` (`:74-97`, a GHL contact task).
- `:58-74` only then `insert` into `act_people`; `:75-80` 23505 → 409 "already a Person"; `:95-97` any GHL error → 502, nothing mirrored.
- Client: `apps/web/src/app/org/[slug]/people/people-actions.tsx:337-410` `MintPersonButton` → `:377-385 fetch('/api/org/${orgProfileId}/people', POST)`.
  Mounted at `people/page.tsx:125` (header button) and `:210` (per-candidate "mint" in the candidates rail).

### 1.4 Proof it never ran, in any form [verified]

```sql
SELECT count(*) FROM act_people                                     -- 0
SELECT count(*) FROM act_person_roles                               -- 0
SELECT count(*) FROM act_ask_warmers                                -- 0
SELECT source, count(*) AS n, count(*) FILTER (WHERE 'record:person' = ANY(tags)) AS record_person, max(created_at)::date
FROM ghl_contacts GROUP BY source ORDER BY n DESC
-- ghl | 4760 | 454 | 2026-09-23
-- gmail_auto | 828 | 0 | 2026-09-07
--   → zero rows with source='civicgraph-people-mint'; the 454 record:person tags are act-global's taxonomy migration
--     (act-global scripts/ghl-taxonomy-migrate.mjs, migrate-ghl-buckets-3to6-2026-06-08.mjs), newest 2026-07-24
SELECT agent_id, status, started_at::date FROM agent_runs WHERE agent_id ILIKE '%people%' OR agent_id ILIKE '%person%' ...
-- only bridge-person-roles / build-person-network / scrape-acnc-people; no reconcile-act-people-ghl run ever
```
`scripts/reconcile-act-people-ghl.mjs` (header `:1-24`) is the intended daily reconcile; it is not in `scripts/lib/agent-registry.mjs`
(grep `reconcile-act-people` → no hit) and has no `agent_runs` row.

**Answer:** never minted. The GHL-first mint path is complete and would work (the GHL client code mirrors `act-people-ghl.ts`), but the
button has not been pressed since the surface shipped on 2026-08-06, and the reconcile that would keep it fresh was never scheduled.
Not a failed write: a failed GHL write returns 502 before any mirror insert (`route.ts:95-97`), and a mirror-insert failure after a
successful GHL create would leave a `civicgraph-people-mint` contact in GHL, of which there are none in the 6-hourly mirror.

### 1.5 Why the people page still looks populated [verified]

`getMintCandidates` (`act-people.ts:132-193`) lists 25 unminted `ghl_contacts` + `org_contacts` names as "Not yet people"; and the
separate people directory (`act-people-directory.ts`, served by `/api/org/[id]/people-directory` and mounted from
`_components/act-people-directory.tsx` + `act-funder-intelligence-desk.tsx`) reads `v_act_people` (2,010 rows: Xero payees ∪ GHL contacts
tagged act/justicehub/goods/harvest/empathy ∪ Marchesi family entities, per `pg_get_viewdef('v_act_people')`) and stitches five more
sources by email/name. That directory is read-only and never writes `act_people`.

---

## 2. Q2: which table links a funder entity to a person with an email, and how many desk rows get one

### 2.1 Column check (information_schema, all [verified])

- `org_contacts`: `id, org_profile_id, name, role, organisation, contact_type, email, phone, notes, last_contacted_at, created_at, updated_at,
  linked_entity_id, project_id, person_id, linkedin_url, appointed_at, term_ends_at, identifies_indigenous, expertise, engagement_ask, goods_relationship_id`
- `contact_entity_links`: `id, contact_id, entity_id, confidence_score, link_method, link_evidence, verified, verified_at, verified_by, created_at, updated_at`;
  FKs `contact_id → ghl_contacts(id)`, `entity_id → gs_entities(id)` (pg_constraint).
- `ghl_contacts`: `id (uuid), ghl_id (text), ..., email, company_name, tags, projects, engagement_status, first_contact_date, last_contact_date,
  ghl_updated_at, last_synced_at, ..., canonical_entity_id (FK → canonical_entities, NOT gs_entities), canonical_contact_id, ...`
- `funder_context_snapshot`: `funder_name, funder_aliases, foundation_id, abn, ..., contacts_count, contacts (jsonb), most_recent_contact_at, ...,
  email_count, email_last_date, relationship_score, refreshed_at`
- `foundation_people`: `foundation_id, foundation_abn, foundation_name, person_name, role_title, role_type, person_entity_id, source_url, ..., extracted_at`
- `funder_board_paths`: `foundation_id, person_name, identity_key, identity_confidence, cluster_size, role_at_funder, connected_entity_id,
  connected_entity_name, connected_entity_type, connected_state, connected_community_controlled, role_at_connected, path_grade, collision_risk, computed_at`
- `relationship_health`: `ghl_contact_id (text = ghl_contacts.ghl_id), temperature, temperature_trend, lcaa_stage, total_touchpoints, inbound_count,
  outbound_count, last_contact_at, days_since_contact, overall_sentiment, suggested_actions, risk_flags, calculated_at, email_score, calendar_score,
  financial_score, pipeline_score, knowledge_score, next_meeting_date, open_invoice_amount, snoozed_until`

### 2.2 The 37 ACT funder `org_contacts` rows [verified]

```sql
SELECT contact_type, count(*) AS n, count(email) AS with_email, count(linked_entity_id) AS linked,
  count(*) FILTER (WHERE email IS NOT NULL AND linked_entity_id IS NOT NULL) AS email_and_linked,
  count(last_contacted_at) AS ever_contacted, count(goods_relationship_id) AS goods_rel, max(updated_at)::date
FROM org_contacts WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0' GROUP BY 1 ORDER BY n DESC
-- funder     | 37 | 0  | 24 | 0 | 0 | 2 | 2026-08-01
-- partner    | 19 | 0  | 5  | 0 | 1 | 1 | 2026-08-01
-- advisory   | 12 | 12 | 5  | 5 | 0 | 0 | 2026-06-10
-- governance |  5 | 0  | 3  | 0 | 0 | 0 | 2026-06-09
-- advocacy   |  2 | 0  | 1  | 0 | 0 | 0 | 2026-03-16
-- community  |  1 | 0  | 1  | 0 | 0 | 0 | 2026-03-16
SELECT count(*) FROM org_contacts WHERE org_profile_id='8b61…' AND contact_type='funder'
  AND (name = organisation OR name ILIKE '%foundation%' OR name ILIKE '%dept%' OR name ILIKE '%trust%')   -- 33
```
33 of the 37 "funder contacts" are organisation placeholders (name = organisation: "Tim Fairfax Family Foundation", "NIAA",
"Dept of Social Services", created 2026-03-17). Only ~4 are humans (e.g. Gavin Reid / The Wyatt Trust, Tania Carlos / Origin Energy
Foundation, created 2026-08-01 with `engagement_ask`), and none of the 37 has an email. **`org_contacts` cannot give the desk a person
with an email for any funder.** The only emails in ACT's `org_contacts` are the 12 advisory rows.

### 2.3 The 91 `funder_context_snapshot` rows with GHL contacts [verified]

```sql
SELECT count(*) AS rows_with_contacts, count(*) FILTER (WHERE foundation_id IS NOT NULL) AS with_foundation,
  jsonb_typeof(contacts) AS shape, max(refreshed_at)::date FROM funder_context_snapshot WHERE contacts_count > 0 GROUP BY 3
-- 91 | 83 | array | 2026-09-23
-- contacts element shape: {"name": "...", "email": "...", "last_contact_date": "2026-04-13T11:48:58+00:00"}
```
Built by `scripts/refresh-funder-context.mjs:361-377`: `ghl_contacts` where `company_name ILIKE <name patterns>` OR
`email ILIKE %@<foundation website domain>`, filtered by `contactMatchesFunder`, top 20 by `last_contact_date`, first 10 stored (`:479-481`).
Nightly: `agent_runs` shows `refresh-funder-context` success 2026-09-23, timed_out 2026-09-22, success 2026-09-22.
`refreshed_at` max 2026-09-23. It is **name-keyed** (`onConflict: 'funder_name'`), so The Snow Foundation and The Trustee For The Snow
Foundation are two rows pointing at the same `foundation_id`, and their contacts duplicate.

### 2.4 Coverage per source over ACT's whole matched portfolio (710 foundations) [verified]

```sql
WITH desk AS (SELECT DISTINCT opf.foundation_id, f.gs_entity_id FROM org_project_foundations opf
  JOIN foundations f ON f.id = opf.foundation_id WHERE opf.org_profile_id='8b61…')
SELECT count(*) AS desk_funders,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM org_contacts oc WHERE oc.org_profile_id='8b61…' AND oc.linked_entity_id = desk.gs_entity_id)) AS with_org_contact,
  count(*) FILTER (WHERE EXISTS (... same ... AND oc.email IS NOT NULL)) AS with_org_contact_email,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM funder_context_snapshot s WHERE s.foundation_id = desk.foundation_id AND s.contacts_count > 0)) AS with_snapshot_ghl_contact,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM foundation_people fp WHERE fp.foundation_id = desk.foundation_id)) AS with_foundation_people,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM contact_entity_links cel JOIN ghl_contacts gc ON gc.id = cel.contact_id
      WHERE cel.entity_id = desk.gs_entity_id AND cel.confidence_score >= 0.8 AND gc.email IS NOT NULL)) AS with_cel_ghl_email,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM funder_board_paths bp WHERE bp.foundation_id = desk.foundation_id)) AS with_board_path
FROM desk
-- 710 | 15 | 2 | 61 | 2 | 23 | 32
```
With email specifically, and the union:
```sql
-- same desk CTE; per-foundation EXISTS flags
-- ghl_contacts.canonical_entity_id = gs_entity_id AND email     → 0   (canonical_entity_id points at canonical_entities, never gs_entities)
-- snapshot contact with email                                    → 46
-- contact_entity_links(conf≥0.8) → ghl_contacts with email       → 23
-- org_contacts linked with email                                 → 2
-- ANY of the above                                               → 48
-- ghl_contacts by canonical_entity_id with a goods-* warmth tag  → 0
```

### 2.5 The desk's funder rows (the brief's "~181") reproduced and scored [verified]

`act-one-desk.ts:196-215`: from `getFunderScan()` (`goods-funder-scan.ts:78-79`, all ACT `org_project_foundations` rows, limit 500),
keep `stage` not null and not in (parked, declined); `inGhl = ghlWarmth !== 'not_in_ghl'` where `warmthFromTags(ghl_synced_at ? tags : null)`
(`goods-funder-scan.ts:39-48`) returns `not_in_ghl` only when synced tags are empty (any non-empty tag set → at least `steady`);
rows not in GHL survive only with `evidence_grade = 'A'` (`:202`). Desk rows are `org_project_foundations` rows (project × foundation), not foundations.

```sql
WITH rows_ AS (SELECT opf.id, opf.foundation_id, f.gs_entity_id, opf.stage, opf.evidence_grade, opf.ghl_contact_id, opf.ghl_contact_email,
    opf.ghl_tags, opf.ghl_synced_at,
    (opf.ghl_synced_at IS NOT NULL AND COALESCE(cardinality(opf.ghl_tags),0) > 0) AS in_ghl
  FROM org_project_foundations opf JOIN foundations f ON f.id = opf.foundation_id
  WHERE opf.org_profile_id = '8b61…' AND opf.stage IS NOT NULL AND opf.stage NOT IN ('parked','declined')),
desk AS (SELECT * FROM rows_ WHERE in_ghl OR evidence_grade = 'A'),
p AS (SELECT d.*,
  EXISTS (SELECT 1 FROM funder_context_snapshot s, jsonb_array_elements(s.contacts) c WHERE s.foundation_id = d.foundation_id AND c->>'email' IS NOT NULL) AS snap_email,
  EXISTS (SELECT 1 FROM contact_entity_links cel JOIN ghl_contacts gc ON gc.id = cel.contact_id WHERE cel.entity_id = d.gs_entity_id AND cel.confidence_score >= 0.8 AND gc.email IS NOT NULL) AS cel_email,
  EXISTS (SELECT 1 FROM org_contacts oc WHERE oc.org_profile_id='8b61…' AND oc.linked_entity_id = d.gs_entity_id AND oc.email IS NOT NULL) AS oc_email,
  EXISTS (SELECT 1 FROM foundation_people fp WHERE fp.foundation_id = d.foundation_id) AS fp_named,
  EXISTS (SELECT 1 FROM funder_board_paths bp WHERE bp.foundation_id = d.foundation_id) AS board_path,
  EXISTS (SELECT 1 FROM funder_context_snapshot s, jsonb_array_elements(s.contacts) c JOIN ghl_contacts gc ON lower(gc.email) = lower(c->>'email')
          JOIN relationship_health rh ON rh.ghl_contact_id = gc.ghl_id WHERE s.foundation_id = d.foundation_id) AS snap_with_temperature,
  EXISTS (SELECT 1 FROM funder_context_snapshot s, jsonb_array_elements(s.contacts) c WHERE s.foundation_id = d.foundation_id
          AND (c->>'last_contact_date')::timestamptz > now() - interval '180 days') AS snap_touched_180d
  FROM desk d)
SELECT count(*) AS desk_rows, count(DISTINCT foundation_id) AS desk_foundations, count(*) FILTER (WHERE in_ghl) AS in_ghl,
  count(*) FILTER (WHERE NOT in_ghl AND evidence_grade='A') AS decision_due,
  count(*) FILTER (WHERE ghl_contact_email IS NOT NULL) AS opf_cached_email, count(*) FILTER (WHERE snap_email) AS snapshot_email,
  count(*) FILTER (WHERE cel_email) AS cel_email, count(*) FILTER (WHERE oc_email) AS org_contact_email,
  count(*) FILTER (WHERE ghl_contact_email IS NOT NULL OR snap_email OR cel_email OR oc_email) AS any_person_email,
  count(*) FILTER (WHERE snap_with_temperature) AS with_temperature, count(*) FILTER (WHERE snap_touched_180d) AS touched_180d,
  count(*) FILTER (WHERE fp_named) AS foundation_people, count(*) FILTER (WHERE board_path) AS board_path,
  count(*) FILTER (WHERE NOT (ghl_contact_email IS NOT NULL OR snap_email OR cel_email OR oc_email OR fp_named OR board_path)) AS no_person_at_all
FROM p
-- desk_rows 192 | desk_foundations 100 | in_ghl 19 | decision_due 173
-- opf_cached_email 11 | snapshot_email 39 | cel_email 24 | org_contact_email 2 | any_person_email 39
-- with_temperature 38 | touched_180d 14 | foundation_people 3 | board_path 13 | no_person_at_all 148
```
(192 today vs the desk reader's 181 on 2026-09-24 morning: `ghl_synced_at`/`evidence_grade` move nightly; the stricter
"warmth tag present" variant gives 184. The order of magnitude is the point.)

Registry officeholders (name + role, no email) exist for almost every desk foundation:
```sql
-- desk foundations (100) with a current person_roles row on f.gs_entity_id → 95; present in mv_person_entity_network → 95
```

**Answer to Q2.** The table is `funder_context_snapshot.contacts` (from `ghl_contacts`), refreshed nightly, name-keyed, 39 of 192 desk
rows (100 foundations → 46 of them). `contact_entity_links` is a strict subset of that reach. `org_contacts` gives 2. Nothing else gives
an email. 148 desk rows carry no person at all; 95 of 100 desk foundations could show a registry officeholder as a research lead.

### 2.6 Dedupe traps in the winning source [verified]

```sql
-- raw snapshot contact rows for the 710 matched foundations vs deduped (foundation_id, lower(email)):  153 raw → 103 pairs (46 funders)
-- ghl_contacts email duplication overall:  3,544 rows with email, 3,249 distinct → 295 duplicate rows (ghl_id is unique 5,588/5,588)
```
Sample for the Trustee For The Snow Foundation (score 75 and 70 rows): "sally grimsley-ballard" appears three times (three GHL contacts,
one email), once with an empty name. A sub-row must dedupe on `lower(email)` and prefer the row with a name and the newest `last_contact_date`.

---

## 3. Q3: GHL tag families as the warmth signal; who writes them; can the one place read `ghl_contacts.tags` directly

### 3.1 The vocabulary [verified]

`scripts/lib/ghl-tag-registry.mjs:19-25` `WARMTH_TAGS = ['goods-hot','goods-warm','goods-steady','goods-cooling','goods-cold']`
("Exactly one warmth tag per contact. Sync scripts REPLACE, never append"); `:28-38` `ROLE_TAGS = role:funder, role:buyer, ...`;
`:41-49` `project:*`; `:52` `RECORD_TAGS = record:person, record:org`; `:55-59` markers; `:64-` deprecated `engagement:*`, `ring:*`, ....
Neither `philanthropic` nor `place:*` is in the registry.

### 3.2 What is actually on the mirror today [verified]

```sql
SELECT t AS tag, count(*) FROM ghl_contacts c, unnest(c.tags) t
WHERE t ~ '^(goods-(hot|warm|steady|cooling|cold)|philanthropic|funder|record:|place:|warm|hot|cold)' GROUP BY 1 ORDER BY 2 DESC LIMIT 30
-- record:person 454 | place:qld 119 | record:place-signal 101 | place:nt 53 | goods-warm 52 | place:sunshine-coast 48 | philanthropic 39
-- place:brisbane 37 | place:sa 32 | place:moreton-bay 31 | place:sc-hinterland 25 | place:caboolture 20 | goods-hot 14 | goods-cooling 14
-- goods-cold 12 | ... | funder 7 | goods-steady 6 | ... | record:organisation-placeholder 5 | warm 3
SELECT count(*) AS n, count(email) AS with_email, count(company_name) AS with_company, count(canonical_entity_id), count(canonical_contact_id),
  count(last_contact_date), count(*) FILTER (WHERE last_contact_date > now() - interval '90 days') AS touched_90d,
  max(last_synced_at)::date, max(ghl_updated_at)::date, max(updated_at)::date,
  count(*) FILTER (WHERE tags && ARRAY['goods-hot','goods-warm','goods-steady','goods-cooling','goods-cold']) AS with_warmth_tag FROM ghl_contacts
-- 5588 | 3544 | 710 | 1855 | 0 | 838 | 0 | 2026-09-24 | 2026-09-24 | 2026-09-24 | 98
SELECT count(*), min(ghl_updated_at)::date, max(ghl_updated_at)::date, count(*) FILTER (WHERE ghl_updated_at > '2026-08-01'), count(email), count(company_name)
FROM ghl_contacts WHERE tags && ARRAY['goods-hot','goods-warm','goods-steady','goods-cooling','goods-cold']
-- 98 | 2026-05-13 | 2026-09-13 | 21 | 82 | 85
SELECT count(*), min(ghl_updated_at)::date, max(ghl_updated_at)::date, count(email), count(company_name) FROM ghl_contacts WHERE 'philanthropic' = ANY(tags)
-- 39 | 2026-07-27 | 2026-08-27 | 15 | 35
```
Note `touched_90d = 0` while `last_synced_at` is today: `ghl_contacts.last_contact_date` is not being carried by the sync
(`sync-ghl-to-supabase.mjs:308-318` writes `ghl_created_at, ghl_updated_at, last_synced_at` but no `last_contact_date`), so it is a
stale column (max value dates from the earlier sync generation). Last touch must come from `relationship_health.last_contact_at`
or `communications_history.occurred_at`, not from `ghl_contacts`.

### 3.3 Who writes each family [verified]

| family | writer | schedule | notes |
|---|---|---|---|
| `goods-hot..cold` | grantscope `act-people-ghl.ts:57-67 setWarmthTag` (REPLACE) | only from the people mint/PATCH route | never fired (§1.4) |
| `goods-hot..cold` | act-global `scripts/_archive/2026-06-09-goods-seeds/{seed-goods-foundation-pipeline,enrich-goods-foundation-contacts}-2026-05-27.mjs` | archived, one-off | matches `min(ghl_updated_at)` 2026-05-13 on the tagged set |
| `goods-hot..cold` | hand-set in GHL | n/a | 21 of the 98 changed in GHL since 2026-08-01; no live script in either repo writes these literals (grep non-archive, non-migration: none) |
| `record:person`, `place:*` | act-global `scripts/ghl-taxonomy-migrate.mjs`, `migrate-ghl-buckets-3to6-2026-06-08.mjs`, `contained-260-tag-migration.mjs` | one-off migrations (June 2026) | `place:*` is a place signal, not warmth |
| `philanthropic` | no writer found in grantscope `scripts/` or `apps/`, nor in act-global `scripts/` (incl. `_archive`), nor `apps/command-center` | n/a | hand-applied in GHL between 2026-07-27 and 2026-08-27 [inferred from `ghl_updated_at` range] |
| `role:funder` etc. | registry only | none | the bare `funder` tag (7 contacts) is what act-global `relationship-alerts.mjs:36-45` keys dormancy thresholds on |
| `project:*` → `ghl_contacts.projects[]` | act-global `sync-ghl-to-supabase.mjs:289-292 deriveProjectCodes` + `backfill-ghl-contact-projects.mjs` (prefix rules `:43-55`) | 6-hourly / manual | project, not warmth |

The mirror itself: act-global `scripts/sync-ghl-to-supabase.mjs` (`transformContactForSupabase` `:288-323` writes `tags`, `projects`,
`engagement_status`, `ghl_updated_at`, `last_synced_at`), scheduled `ecosystem.config.cjs:627-629` (`ghl-sync`, `0 */6 * * *`) and
`.github/workflows/sync-ghl.yml:6` (`0 */6 * * *`). Freshness today: `max(last_synced_at)` 2026-09-24.

grantscope's own GHL client (`apps/web/src/lib/ghl.ts:113-163 addTagToContact/removeTagFromContact`, `:183-229 upsertContact`) writes
the tag to GHL then patches `ghl_contacts.tags` locally in the same call, so app writes are visible before the next 6h sync.

### 3.4 The per-table `ghl_*` caches vs the mirror [verified]

| cache | columns | writer | rows (ACT) | agreement with mirror |
|---|---|---|---|---|
| `org_project_foundations.ghl_contact_id / ghl_contact_email / ghl_tags / ghl_synced_at` | 4 | `scripts/reconcile-foundations-ghl.mjs:95-110` (GHL search by foundation core name, `bestMatch :58-68` on company/email/tags) | 22 of 1,553 rows (22 foundations, 10 with a warmth tag), `ghl_synced_at` max 2026-09-21; scheduled `agent_schedules` every 24h, last success 2026-09-23 | warmth tag agrees 22/22 (`ghl_contacts.ghl_id = opf.ghl_contact_id`); mirror synced 2026-09-24 vs cache 2026-09-21 |
| `goods_relationships.ghl_contact_id / ghl_opportunity_id / warmth_computed / warmth_override / warmth_display / ghl_signal` | 6 | `scripts/sync-goods-ghl.mjs:349-385` upsert; `computeWarmth :212-231` = 0.4·stage + 0.2·recency(e^-days/60) + 0.2·history(money) | 321 rows, 188 with `ghl_contact_id` (all found in mirror), 62 of those carry a goods-* tag; `warmth_display` has 30 distinct numeric values | **different vocabulary**: numeric score from stage/recency/money, never reads the tag. `sync-goods-ghl` has failed on every run since 2026-09-23 (7 failures in `agent_runs`; periphery reader: PM2 env shadowing) |
| `goods_procurement_entities.ghl_contact_id / ghl_opportunity_id / ghl_pipeline_id / ghl_stage_id / ghl_stage_name / ghl_last_pushed_at / ghl_last_synced_at` | 7 | buyers reader's domain | not re-measured here | stage cache, not warmth |

`goods-funder-insight-shared.ts:114-118` maps the tags `goods-hot → hot`, `goods-warm → warm`, `goods-cooling → cooling` for display;
`goods-funder-scan.ts:39-48` does the same but returns `steady` for any synced contact without a temperature tag, so "in GHL" on the desk
means "reconcile found a contact", not "someone set a warmth".

### 3.5 The second warmth: `relationship_health` [verified]

act-global `scripts/compute-contact-signals.mjs` (header `:1-24`: email 25%, calendar 20%, financial 20%, pipeline 20%, knowledge 15%;
reads `communications_history, calendar_events, xero_invoices, ghl_opportunities, project_knowledge`; writes `relationship_health`,
`intelligence_insights`), `ecosystem.config.cjs:22-26` `contact-signals` daily `0 3 * * *`.
```sql
SELECT max(calculated_at)::date, count(*) FILTER (WHERE calculated_at > now() - interval '7 days') FROM relationship_health   -- 2026-09-23 | 820
SELECT count(*) FROM relationship_health rh WHERE EXISTS (SELECT 1 FROM ghl_contacts g WHERE g.ghl_id = rh.ghl_contact_id)   -- 3401 (joins on ghl_id, 0 on uuid)
SELECT max(occurred_at)::date, count(*) FILTER (WHERE occurred_at > now() - interval '30 days'),
  count(DISTINCT ghl_contact_id) FILTER (WHERE occurred_at > now() - interval '90 days') FROM communications_history         -- 2026-09-07 | 708 | 407
```
For the 153 snapshot contacts on ACT's matched funders: 21 have a goods-* tag, 8 `philanthropic`, 64 a `role:` tag, **126 a temperature**,
97 a comms row, 15 touched in 90d, 82 in 365d (query in §6.2). Temperature is the broader, fresher signal; the goods tag is the
human-set one and is nearly absent on funder people.

### 3.6 Answer to Q3

The working warmth signals are (a) the `goods-*` tag family on `ghl_contacts.tags`, human-set, 98 contacts, refreshed to the mirror
every 6h, and (b) `relationship_health.temperature/lcaa_stage`, machine-computed daily. `philanthropic` (39) and `place:*` (252) are
role/place classifiers, not warmth, and have no live writer. grantscope's `setWarmthTag` is the only code that enforces
"exactly one warmth tag" and has never run; act-global writes no warmth tags in live code. **The one place can read
`ghl_contacts.tags` directly** (join on `ghl_id`; the caches agree with it and are staler), and should treat
`org_project_foundations.ghl_*` as a derived index of "which contact belongs to this foundation", which is the part that is expensive
(GHL search + name match). `goods_relationships.warmth_display` is a per-organisation score with its own formula and must not be
presented as the same thing as a contact's tag.

---

## 4. Q4: is `person_identity_map` the intended person spine or dead

```sql
SELECT data_source, count(*) AS n, count(ghl_contact_id) AS ghl, count(email), count(current_company), max(updated_at)::date, max(last_verified_at)::date
FROM person_identity_map GROUP BY 1 ORDER BY n DESC
-- linkedin_nic 9342 | 169 | 169 | 9250 | 2026-03-19 |
-- linkedin_ben 4358 | 65 | 65 | 4277 | 2026-03-19 |
-- gmail_5000_discovery 656 | 188 | 656 | 0 | 2026-03-19 |
-- gmail_fast_discovery 356 | 149 | 356 | 0 | 2026-03-19 |
-- (null) 97 | 0 | 0 | 96 | 2026-03-09 |
-- gmail 47 | 29 | 47 | 2 | 2026-03-19 |
-- exa_enrichment 43 | 43 | 43 | 38 | 2025-12-31 |
-- website_scrape 19 | 0 | 0 | 19 | 2026-03-09 |
-- linkedin_None 1
```
(critic §3.D already had: 14,919 rows, 643 `ghl_contact_id`, 0 `funding_capacity`, 0 `last_communication_at` in 90d.)

Writers [verified by grep, none scheduled]:
- grantscope `scripts/link-contacts-to-people.mjs`, `link-people-to-entities.mjs`, `sync-contact-tags.mjs`, `backfill-ghl-civicgraph-links.mjs`
  (header `:5-8`: reads pim → org_contacts → gs_entities to write a GHL custom field), `build-orbit-soil.mjs`; none in `scripts/lib/agent-registry.mjs`.
- grantscope app: `api/org/[id]/contacts/sync-ghl/route.ts:78-84` updates `ghl_contact_id` when an `org_contacts.person_id` exists (0 of 76 ACT rows have one);
  `contacts/link-notion/route.ts`, `api/contacts/analyze/route.ts`, `tag-sync-service.ts`.
- act-global `scripts/consolidate-contacts.mjs` (not in `ecosystem.config.cjs`, not in `.github/workflows`).
Ownership seed `:703`: owner grantscope, consumers act,grantscope,justicehub, "created by none found".

Live reader: `act-people-directory.ts:512-515` (rows with `ghl_contact_id`, for `identityStatus: 'mapped'` `:397-399` and `role/organisation` fallbacks `:440-441`).

**Answer:** dead as a spine. It is a March LinkedIn/Gmail export with 4.3% GHL linkage, no refresh, no writer on a schedule, and no
funder-facing column populated. Two other spines compete: `canonical_entities` (`entity_type='person'` 15,384, `v_unified_contacts`,
`ghl_contacts.canonical_entity_id` 1,855 FK'd to it; writers act-global `entity-resolution.mjs` (unscheduled), `sync-notion-meetings.mjs`
and `knowledge-pipeline.mjs` (scheduled, `ecosystem.config.cjs:262,576`); 32 rows updated in 30d, max 2026-09-07) and `ghl_contacts`
itself (5,588, 6-hourly, unique `ghl_id`). For a person→funder read the only spine with both an id GHL knows and a live refresh is
`ghl_contacts`; `person_identity_map` should be treated as an archive.

---

## 5. Q5: board bridges

### 5.1 `funder_board_paths` [verified]

```sql
SELECT path_grade, collision_risk, identity_confidence, count(*), count(*) FILTER (WHERE connected_community_controlled), max(computed_at)::date
FROM funder_board_paths GROUP BY 1,2,3 ORDER BY 4 DESC
-- unverified | high   | medium | 1917 | 12 | 2026-08-03
-- unverified | medium | medium |  588 | 25 | 2026-08-03
-- unverified | low    | medium |  146 |  4 | 2026-08-03
SELECT count(*), count(*) FILTER (WHERE connected_entity_id IN (SELECT linked_entity_id FROM org_contacts WHERE org_profile_id='8b61…' AND linked_entity_id IS NOT NULL)) AS to_act_org_contact_entity,
  count(*) FILTER (WHERE connected_entity_id IN (SELECT entity_id FROM goods_relationships WHERE entity_id IS NOT NULL)) AS to_goods_rel_entity,
  count(DISTINCT foundation_id), count(DISTINCT foundation_id) FILTER (WHERE foundation_id IN (SELECT foundation_id FROM org_project_foundations WHERE org_profile_id='8b61…')),
  count(*) FILTER (WHERE cluster_size = 1), count(*) FILTER (WHERE cluster_size > 1) FROM funder_board_paths
-- 2651 | 3 | 20 | 437 | 32 | 0 | 2651
```
Generator: `rebuild_funder_board_paths()` (baseline `supabase/migrations/20260905130000_baseline_remote_schema.sql:14549-14600`, origin
`migrations_history/pre-baseline-supabase/20260803230000_funder_board_paths.sql`): foundation officeholder (`person_roles` on
`foundations.gs_entity_id`) → `person_identities.identity_key` → any other `person_roles` with the same key → that entity;
`path_grade` is the literal `'unverified'` (`:14574`), `collision_risk` from `cluster_size` (≤2 low, ≤5 medium, else high `:14575-14577`),
filters `is_nominee_block = false`, confidence in (high, medium), `cluster_size <= 10`. Full replace on each run; last run 2026-08-03;
no scheduled caller found (it is a SQL function, not in the agent registry). `cluster_size` is never 1 on any surviving row, i.e. every path
is a name shared by at least two identity records. Readers: `dashboard/browse/foundations/[id]/page.tsx:35`, `api/browse/foundation/route.ts:48`.
The philanthropy reader's "20 ACT-reachable" = the 20 paths landing on a `goods_relationships` entity (my `to_goods_rel_entity`).

### 5.2 `v_goods_foundation_targets.has_bridge` [verified]

`pg_get_viewdef`: `goods_people` = `mv_person_entity_network` rows whose `entity_id` is a `goods_relationships.entity_id` with
`board_count BETWEEN 2 AND 15`; `bridge` = any other `mv_person_entity_network` row with the same `person_name_normalised`;
`has_bridge = b.connector IS NOT NULL`; `priority_score = 1000·has_bridge + 100·theme_hits + 50·has_dgr + LEAST(50, giving/1e6·10)`.
```sql
SELECT count(*), count(*) FILTER (WHERE has_bridge), count(DISTINCT connector) FROM v_goods_foundation_targets   -- 2098 | 75 | 58
```
`mv_person_entity_network` (338,999 rows; columns `person_name_normalised, person_name_display, entity_id, entity_name, entity_abn,
entity_type, is_community_controlled, role_type, source, appointment_date, board_count, procurement_dollars, ..., influence_score`)
is a plain name-normalised join: no `identity_key`, no nominee block, no collision risk. It is refreshed by `scripts/refresh-views.mjs:83,141`
(nightly per the MV tier memory). So `has_bridge` (75) and `funder_board_paths` (2,651) are two different bridge definitions: the view
is looser (name match only) and lands 1,000 points on a match that `funder_board_paths` would grade high-collision.

### 5.3 What the dossier calls a warm path today [verified]

`act-funder-intelligence.ts:832-871` `organisationBridgeRows`: foundation officeholders with `board_count BETWEEN 2 AND 15` → their other
current roles → an ACT `org_contacts` row `linked_entity_id = that entity` with an email or `last_contacted_at`, excluding Ben/Nic and
org-placeholder rows. Emitted as `kind:'board_bridge'`, `label: Test via <act_contact>`, `verified: false`, strength 70/80 (`:1150-1158`).
`withWarmPath` (`:1287`) counts only `path.verified || path.kind === 'direct_contact'`, so board bridges never count as warm paths.
Reproduced for the whole ACT portfolio:
```sql
-- same CTEs as :833-866 with the ACT org id
-- funders_with_bridge 7 | connectors 4 | act_contacts 2
```
Two ACT contacts and four connectors produce every organisation bridge the dossier can show, for 7 of 710 foundations.

### 5.4 What "verified" would require [inferred from the schema; nothing implements it]

- Identity: a human confirms the `identity_key` cluster is one person (`person_identities.confidence` high + `cluster_size` 1, or a
  `verified_at/verified_by` stamp the table does not have; `contact_entity_links` has `verified, verified_at, verified_by` but 0 of 643 are verified).
- Reachability: the connected entity must map to a person ACT can email (`org_contacts.linked_entity_id` + email, or a `ghl_contacts` row
  via `contact_entity_links`), and that person must have been touched (comms row) recently.
- Consent/tie: a human says "yes, X knows Y" — `act_ask_warmers` (Ask ↔ Person, human-minted) and `act_people.warm_via` are the designed
  homes and are both empty.
Until then, every bridge is a hypothesis; the dossier already labels it so (`:1153` "not proof of a personal tie").

---

## 6. Deliverable: the person sub-row for a funder/buyer card

### 6.1 Spec

| field | source (table.column) | join key | freshness today | coverage on desk funder rows (192) |
|---|---|---|---|---|
| name | `funder_context_snapshot.contacts[].name`, fallback `ghl_contacts.full_name` | `foundation_id` = foundation; then `lower(email)` → `ghl_contacts.email` | nightly (`refreshed_at` 2026-09-23) | 39 rows |
| role | none with an email; `person_roles.role_type` via `foundations.gs_entity_id` for registry officeholders (name + role only); `foundation_people.role_title` for 3 foundations | `entity_id` | `person_roles` bridge 2026-06-18; `foundation_people` extracted 2026-04-17 | 95 of 100 desk foundations have a registry officeholder |
| email present? | `funder_context_snapshot.contacts[].email` (dedupe on `lower(email)`) | as above | nightly | 39 rows (46 of 710 foundations) |
| warmth | human: single `goods-*` tag in `ghl_contacts.tags`; machine: `relationship_health.temperature` + `lcaa_stage` | `ghl_contacts.ghl_id = relationship_health.ghl_contact_id` | tags 6-hourly (2026-09-24); temperature daily 3am (2026-09-23) | tag on 21 of 153 contacts; temperature on 126 of 153; 38 desk rows have a contact with a temperature |
| last touch | `GREATEST(relationship_health.last_contact_at, snapshot last_contact_date, max(communications_history.occurred_at))` | `ghl_id` | comms latest 2026-09-07 (708 rows in 30d) | 14 desk rows touched in 180d |
| via | `act_people.warm_via` (designed, 0 rows) → fallback dossier organisation bridge (`Test via <act_contact>`, unverified) | `act_ask_warmers` / `org_contacts.linked_entity_id` | n/a | 7 foundations in the whole portfolio |
| GHL link | `ghl_contacts.ghl_id` → `ghlContactUrl()` | | 6-hourly | every matched contact |

Do not read: `ghl_contacts.last_contact_date` (not carried by the sync, 0 rows in 90d), `person_identity_map` (March), `org_contacts`
funder rows (no emails, 33 of 37 are org placeholders), `goods_relationships.warmth_display` as if it were a person's warmth.

### 6.2 The query that produces it (run today) [verified]

```sql
WITH desk AS (SELECT DISTINCT opf.foundation_id, f.name FROM org_project_foundations opf JOIN foundations f ON f.id = opf.foundation_id
  WHERE opf.org_profile_id = '8b61…' AND opf.stage NOT IN ('parked','declined')),
sc AS (SELECT d.name AS funder, c->>'name' AS person, c->>'email' AS email, (c->>'last_contact_date')::timestamptz AS snap_last, s.relationship_score
  FROM funder_context_snapshot s JOIN desk d ON d.foundation_id = s.foundation_id, jsonb_array_elements(s.contacts) c WHERE c->>'email' IS NOT NULL)
SELECT sc.funder, sc.person, sc.email,
  (SELECT t FROM unnest(gc.tags) t WHERE t LIKE 'goods-%' AND t ~ '(hot|warm|steady|cooling|cold)$' LIMIT 1) AS warmth_tag,
  rh.temperature, rh.lcaa_stage, GREATEST(sc.snap_last, rh.last_contact_at)::date AS last_touch, sc.relationship_score
FROM sc
LEFT JOIN LATERAL (SELECT ghl_id, tags FROM ghl_contacts g WHERE lower(g.email)=lower(sc.email) ORDER BY last_contact_date DESC NULLS LAST LIMIT 1) gc ON true
LEFT JOIN relationship_health rh ON rh.ghl_contact_id = gc.ghl_id
ORDER BY sc.relationship_score DESC, last_touch DESC NULLS LAST LIMIT 12
-- The Trustee For The Snow Foundation | sally grimsley-ballard | s.grimsley-ballard@snowfoundation.org.au |           | 20 | listen    | 2026-06-11 | 75
-- The Trustee For The Snow Foundation | alexandra lagelee kean | a.lageleekean@snowfoundation.org.au      |           | 50 | awareness | 2026-04-13 | 75
-- The Trustee For The Snow Foundation | Georgina Byron         | g.byron@snowfoundation.org.au            |           | 25 | connect   | 2026-04-08 | 75
-- The Trustee For The Snow Foundation | carolyn ludovici       | c.ludovici@snowfoundation.org.au         | goods-hot |    |           |            | 75
-- The Trustee For The Snow Foundation | ashley machuca         | a.machuca@snowfoundation.org.au          | goods-hot |    |           |            | 75
-- (sally grimsley-ballard repeats 3× within one snapshot row; the Snow funder appears under two snapshot names, scores 75 and 70)
```
Aggregate over the 153 snapshot contacts on ACT's matched foundations (same join): matched_ghl 153, with_warmth_tag 21, with_philanthropic 8,
with_role_tag 64, with_rh_temperature 126, with_comms 97, touched_90d 15, touched_365d 82.

The row above already shows the two warmth systems disagreeing on the same funder: the two `goods-hot` people have no temperature and no
touch date; the people with a temperature have no tag.

### 6.3 Count of desk rows that would carry a sub-row

- With a named person and an email: **39 of 192** (20%), all from `funder_context_snapshot` (the other sources add 0 rows outside that set).
- With a warmth of either kind on that person: 38 (temperature) / ≤11 (goods tag via the `org_project_foundations` cache; 10 foundations).
- With a last touch inside 180 days: 14.
- With a warm path a human has asserted: **0** (`act_people.warm_via`, `act_ask_warmers` empty). With a derived organisation bridge: 7 foundations portfolio-wide.
- With a research lead only (registry officeholder, no email): 95 of the 100 desk foundations.
- With nothing: 148 of 192.

For buyers the same shape applies through `goods_procurement_entities.ghl_contact_id` / `goods_relationships.ghl_contact_id` (188 rows,
all resolvable in the mirror, 62 with a goods tag); I did not re-measure the buyer pool (buyers reader's domain).

---

## 7. Freshness table (everything the sub-row could read)

| object | rows | last write | cadence | writer | status |
|---|---|---|---|---|---|
| `act_people` / `act_person_roles` / `act_ask_warmers` | 0 / 0 / 0 | never | on mint; reconcile never scheduled | people route; `reconcile-act-people-ghl.mjs` | designed, unused |
| `ghl_contacts` | 5,588 | 2026-09-24 | 6h (act-global PM2 `ghl-sync` + GH workflow) | `sync-ghl-to-supabase.mjs` | live; `last_contact_date` not carried |
| `relationship_health` | 3,401 (820 in 7d) | 2026-09-23 | daily 03:00 (act-global PM2 `contact-signals`) | `compute-contact-signals.mjs` | live |
| `communications_history` | 33,391 | 2026-09-07 | act-global email/Notion pipelines | (outside brief) | 17 days stale |
| `funder_context_snapshot` | 1,196 (91 with contacts) | 2026-09-23 | nightly (`refresh-funder-context`, 1 timeout in last 3 runs) | `scripts/refresh-funder-context.mjs` | live, name-keyed |
| `org_project_foundations.ghl_*` | 22 of 1,553 | 2026-09-21 | 24h (`agent_schedules`, last success 2026-09-23) | `reconcile-foundations-ghl.mjs` | live, thin |
| `goods_relationships.warmth_*` | 321 | 2026-09-22 | 12h (`agent_schedules`), **failing since 2026-09-23** | `sync-goods-ghl.mjs` | broken |
| `contact_entity_links` | 643 (0 verified) | 2026-07-13 | none scheduled | `link-contacts-to-entities.mjs` (email_domain 320, manual 267, fuzzy 56) | stale |
| `org_contacts` (ACT) | 76 | 2026-08-01 | manual | UI + `contact-resolution` route | placeholders |
| `person_identity_map` | 14,919 | 2026-03-19 | none | unscheduled scripts in both repos | dead |
| `canonical_entities` (person) | 15,384 | 2026-09-07 (32 in 30d) | act-global Notion/knowledge pipelines | `sync-notion-meetings.mjs`, `knowledge-pipeline.mjs` | trickle |
| `foundation_people` | 33 (3 foundations, 9 linked) | 2026-04-17 | none | (created by none found) | stale |
| `funder_board_paths` | 2,651 | 2026-08-03 | none (SQL function, no caller in registry) | `rebuild_funder_board_paths()` | stale, all unverified |
| `mv_person_entity_network` | 338,999 | nightly MV refresh | `refresh-views.mjs` | grantscope | live |
| `person_roles` (foundation officeholders) | 340K | bridge 2026-06-18 | ACNC/ASIC ingests | `bridge-person-roles` | ok as research lead |

---

## 8. Other readers of people, for the redesign to retire or keep

- `act-relationship-ledger.ts:586-596` (the `/org/[slug]` home): people per Xero counterparty = `org_contacts` by organisation name +
  `ghl_contacts` by `company_name IN (counterparties)` + Gmail actor names; dedupe on email/name; `lastContactAt` from those. Name-matched, no ids.
- `act-people-directory.ts:500-543`: 7 sources (`v_act_people`, `v_contact_360`, `person_identity_map`, `v_unified_contacts`, `relationship_health`,
  `org_contacts`, `contact_entity_links`) stitched by email/name/ghl_id, cached 300s under key `act-people-directory-v2`. It is the only reader that
  already computes the sub-row shape (name, email, organisation, role, temperature, stage, daysSinceContact, recommendedMove) but per person, not per funder.
- act-global `relationship-alerts.mjs` (GH Actions daily 22:30 UTC): dormancy by bare tag (`funder` 45d etc., `:36-45`), reads `ghl_contacts`
  (8 calls), `communications_history`, `pending_contacts`; console output only inside the workflow (no Slack/Telegram call in the script).
- act-global `backfill-ghl-contact-projects.mjs`: tags → `ghl_contacts.projects[]` canonical ACT-XX codes (prefix rules `:43-55`), optional push-back to GHL.

---

## 9. Gaps and questions for Ben

1. Should the one place mint People (act_people, GHL-first) as the pursue side-effect, or read `funder_context_snapshot` + `ghl_contacts`
   and drop the mirror? Both paths exist; only one has data.
2. Which warmth is canonical for a person: the human `goods-*` tag (21 of 153 funder contacts) or the computed `relationship_health.temperature`
   (126 of 153)? They disagree on the Snow Foundation today.
3. `philanthropic` (39 contacts) has no writer in either repo and is not in the tag registry; keep as a smart-list input or fold into `role:funder`?
4. `sync-goods-ghl` has failed on every run since 2026-09-23; `goods_relationships.warmth_display` is frozen at 2026-09-22 (periphery reader named the cause).
5. `funder_board_paths` last rebuilt 2026-08-03 and nothing calls `rebuild_funder_board_paths()`; keep, schedule, or drop in favour of the dossier's organisation bridge?
6. `ghl_contacts.last_contact_date` is not populated by the 6-hourly sync; every "last touch" in grantscope that reads it (`act-relationship-ledger.ts:591`,
   `act-people.ts:146`, `refresh-funder-context.mjs:369`) is reading a stale column. Should the sync carry it, or should readers switch to `relationship_health.last_contact_at`?

Not measured: buyer-side person coverage (`goods_procurement_entities`), `communications_history` writer cadence, whether the GHL live
contact tasks created by a mint would appear in the mirror (no `ghl_tasks` table seen), `v_contact_360` definition.
