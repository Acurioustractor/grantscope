# JusticeHub — database usage trace

Traced 2026-08-14 against `/Users/benknight/Code/JusticeHub` (branch `living-atlas`),
cross-referenced with `/Users/benknight/Code/grantscope` and the verified census in `GROUND_TRUTH.md`.

---

## 0. Headline

**JusticeHub is not a consumer of the GrantScope database — it is a co-owner of it.**
Both apps share Supabase project `tednluwflfhxyucgwigh`. JusticeHub touches **218 of the 724
populated objects**; GrantScope touches 275; **59 populated objects are touched by both**, and
**19 objects are WRITTEN by both apps**, including `gs_entities` (609,448 rows),
`justice_funding` (157,116) and `organizations` (104,427). There is no schema, prefix, or RLS
boundary separating them — only convention.

The most acute hazard: `src/app/api/cron/alma/enrich-websites/route.ts` performs a
**read-modify-write on `gs_entities.source_datasets` and `gs_entities.metadata` (JSONB)** on a
cron, while GrantScope's own pipelines update the same columns. That is a textbook lost-update
race on GrantScope's core entity table, driven from the other repo.

---

## 1. Method + confidence

Two passes over both repos (build artefacts, `node_modules`, `_archive`, `__tests__`,
`.disabled` excluded):

1. **Client pass** — every `.from('<name>')` and `.rpc('<name>')`, capturing the receiver
   expression (to separate the Empathy Ledger client from the main client), the first chained
   operation (`select` vs `insert|update|upsert|delete`), and file:line.
   JusticeHub: 3,375 files, 6,031 hits. GrantScope: 1,752 files, 3,474 hits.
2. **Raw-SQL pass** — `FROM|JOIN|INTO|UPDATE|TABLE <ident>` inside code and `.sql` files,
   filtered to identifiers that actually exist in the DB catalogue.
   JusticeHub: 3,751 hits. GrantScope: 14,241 hits.
   This pass was necessary: `state_tenders` (199,719 rows) is invisible to the client pass in
   GrantScope but appears in three of its live report pages via raw SQL.

Catalogue resolution used one targeted query for `pg_class relkind='v'` + `pg_proc` in `public`
(622 rows), so referenced names could be split into table / matview / view / function / does-not-exist.

**Verified** (read the code): the `gs_entities` cron write, the `governed_proof/service.ts` fork,
`src/lib/grantscope/*` as a read-only adapter, `state_tenders` scraper ownership, Empathy Ledger
client wiring and its bidirectional writes, the storage-bucket false positives.
**Inferred** (counted, not individually read): the per-route-family tallies below, and the
read/write split on the long tail.
**Not checked**: runtime frequency (a cron that writes once a week and a hot path both count as
"1 write site"); RLS policies; whether any of these routes are actually deployed.

Known method limits: dynamic table names (template literals) are invisible; `exec_sql` bodies are
only caught by the SQL pass; a table named in a comment inside a scanned file counts as a hit.

---

## 2. What JusticeHub reads, and from where

Route families ranked by number of distinct DB objects touched (live code only):

| Family | Objects | Character |
|---|---|---|
| `scripts/` + `src/scripts/` | 188 | ingestion, backfills, audits — the widest surface |
| `src/app/api/admin` | 92 | admin console over nearly everything |
| `src/app/admin` | 79 | admin pages (server components hitting the DB directly) |
| `src/app/api/cron` | 49 | **the write engine** — see §3 |
| `src/app/intelligence` (pages) | 46 | the analytical front end |
| `src/app/api/intelligence` | 43 | ALMA + funding + power-map APIs |
| `src/lib/funding` | 38 | funding discovery / matching |
| `src/app/hub` | 36 | org hub pages |
| `src/app/api/contained` | 24 | CONTAINED exhibition |
| `src/lib/org-hub` | 24 | org-hub services |

### Data-heavy families in detail

**`api/intelligence` + `page/intelligence` (43 + 46 objects)** — the analytical core.
Reads `alma_interventions`, `alma_evidence`, `alma_outcomes`, `alma_intervention_evidence`,
`alma_intervention_outcomes`, `alma_community_contexts`, `alma_discovered_links`,
`alma_research_findings`, `alma_media_articles`, `alma_government_programs`, `organizations`,
`justice_funding`, **`gs_entities`**, **`gs_relationships`**, `civic_hansard`,
`civic_ministerial_statements`, `civic_ministerial_diaries`, `civic_org_classifications`,
`civic_intelligence_claims`, `civic_claim_evidence`, `oversight_recommendations`,
`lga_cross_system_stats`, `rogs_justice_spending`, `acnc_charities`, `postcode_geo`,
`grant_opportunities`, `foundation_grantees`, `aihw_child_protection`, **`person_roles`**,
`person_role_holdings`, `people`, `data_gap_questions`, `data_sources_inventory`, `synced_stories`.
Matviews: `mv_funding_deserts`, `mv_funding_by_lga`.
Views: `v_claim_evidence_summary`, `v_entity_360`, `v_person_360`, `view_intervention_alpha`,
`alma_intervention_profiles`, `alma_media_articles_publishable`.
Functions: `get_power_map_top_orgs`, `get_power_map_stats`, `get_power_map_board_connectors`,
`get_power_map_control_breakdown`, `get_yj_orgs_for_browser`, `get_yj_orgs_for_map`,
`get_yj_programs_for_browser`, `get_yj_funding_facets`, `get_featured_network_entities`,
`state_foundation_flows`, `search_alma_interventions`, `get_intervention_comprehensive`,
`find_evidence_gaps`, `create_research_session`, `update_research_session`,
`record_research_finding`, `log_research_tool`, `get_contained_intel_summary`.
Plus raw `exec_sql`.

**`api/justice-funding` (17 objects)** — almost entirely function-driven:
`justice_funding_overview`, `_by_sector`, `_by_year`, `_map_locations`, `_organizations`,
`_top_recipients`, `_power_concentration`, `justice_funding_org_profile`,
`community_voices_for_org`; views `v_justice_funding_summary`, `v_justice_funding_by_program`;
tables `justice_funding`, `austender_contracts`, `acnc_charities`, `acnc_ais`;
writes `community_voices`.

**`api/analysis` (20 objects)** — `justice_funding`, `organizations`, `rogs_justice_spending`,
`alma_*`, `justice_matrix_*`, `youth_detention_facilities`, `gs_relationships`,
`political_donations`; functions `get_case_for_change`, `get_funding_by_org_summary`,
`get_top_justice_funding`.

**`api/power-page` (8 objects)** — pure RPC surface: `power_page_sankey`, `power_page_network`,
`power_page_top_orgs`, `power_page_donations`, plus the `justice_funding_*` functions and
`alma_interventions`.

**`api/justice-matrix` + `page/justice-matrix` (21 + 18)** — self-contained `justice_matrix_*`
and `jm_*` family, plus `alma_evidence`. Heavy writes.

**`api/spending` / `api/justice-spending`** — `rogs_justice_spending`, `justice_funding`,
`alma_government_programs`, `alma_program_interventions`, `youth_detention_facilities`.

**`api/communities` (21)** — the `jr_*` justice-reinvestment family, `organizations`,
`organization_claims`, `agent_task_queue`, plus four `jr_*` RPCs (approve outcome, promote
evidence draft, publish/withdraw snapshot).

**`api/org-hub` (21)** — `organizations`, `organizations_profiles`, `public_profiles`,
`org_grants`, `org_grant_budget_lines`, `org_deadlines`, `org_milestones`, `org_action_items`,
`org_compliance_docs`, `partner_*`, `media_items`, `registered_services`.

**`src/lib/grantscope/` — the explicit cross-app adapter.**
`entity-enrichment.ts` and `org-dossier.ts` read `gs_entities`, `gs_relationships`,
`justice_funding`, `austender_contracts`, `person_roles`, `alma_interventions`,
`registered_services`, `services`, `facility_partnerships`, `youth_detention_facilities`.
Read-only. Its own comment states the situation plainly:
`// All data lives in the same Supabase DB — just different tables.`

### GrantScope-owned reference data that JusticeHub reads (read-only, healthy)

| Object | Rows | Read from |
|---|---|---|
| `gs_relationships` | 3,429,184 | `api/analysis/power-map`, `api/intelligence/network`, `api/org/[slug]/funding-profile`, `app/directory`, `lib/ai/alma-tools`, `lib/grantscope/entity-enrichment` |
| `political_donations` | 2,549,483 | `api/analysis/report`, `scripts/discover-opposition-entities.mjs` |
| `austender_contracts` | 823,620 | `api/justice-funding`, `lib/grantscope/org-dossier` |
| `acnc_ais` | 360,488 | `api/admin/data-health`, `api/justice-funding`, `lib/funding/funder-intelligence` |
| `person_roles` | 339,698 | `api/org/[slug]/funding-profile`, `app/intelligence/national`, `.../qld-justice`, `.../regional/[region]`, `.../qld-dyjvs/org/[slug]` |
| `grantconnect_awards` | 291,264 | `lib/funding/source-registry` (1 site only) |
| `acnc_charities` | 66,023 | ~48 sites, mostly scripts + directory |
| `grant_opportunities` | 25,897 | `api/grants/discover`, `app/directory`, `lib/funding/opportunity-search`, `lib/directory/org-dossier` |
| `foundations` | 11,159 | `api/foundations/youth-justice`, `app/funders`, `lib/funding/funder-intelligence` |
| `abr_registry` | 20,006,350 | **scripts only** (`scripts/civic/backfill-abns-*`, `scripts/lab/exp-008-*`); the app itself only names it in `database.types.ts` and a cron row-count |
| `mv_funding_by_postcode` / `mv_funding_by_lga` / `mv_funding_deserts` | 7.2K / 1.7K / 2.0K | `api/intelligence`, `app/intelligence` |

---

## 3. What JusticeHub writes

**242 distinct write targets.** The engine is `src/app/api/cron/*` — 48 objects, nearly all
written, including `gs_entities`, `justice_funding`, `state_tenders`, `organizations`,
`alma_*` (11 tables), `civic_*` (5), `justice_matrix_*` (4), `public_profiles`,
`foundation_grantees`, `data_sources_inventory`, `services`.

### JusticeHub-owned tables >1,000 rows that GrantScope does NOT write

| Object | Rows | Note |
|---|---|---|
| `state_tenders` | 199,719 | scraped by `scripts/scrape-state-tenders.mjs`, `scrape-qld-contracts.mjs`, `scrape-education-contracts.mjs`; **GrantScope reads it in 3 report pages** |
| `assertions` | 59,300 | `api/funding`, `lib/*` |
| `page_views` | 38,115 | analytics |
| `campaign_alignment_entities` | 4,141 | 28 writes |
| `alma_intervention_outcomes` | 3,109 | ALMA junction |
| `alma_outcomes` | 2,869 | |
| `alma_discovered_links` | 2,544 | |
| `alma_intervention_evidence` | 2,065 | |
| `alma_org_enrichment_candidates` | 1,825 | |
| `organization_funding_summaries` | 1,059 | |
| `civic_intelligence_chunks` | 7,022 | embedding chunks |

### Schema ownership (DDL)

`CREATE TABLE` statements across `.sql` files:
GrantScope declares **200** census tables, JusticeHub declares **185**, and the only name declared
in *both* repos is `government_programs`. So the *schemas* are almost cleanly split — it is the
*data access* that is entangled.

**330 of the 714 tables have no `CREATE TABLE` in either repo** — created ad hoc via psql, the
Supabase MCP, or the dashboard. Those have no code-visible owner at all.

---

## 4. SHARED SURFACE — objects both apps touch

**63 objects touched by both apps** (59 of them populated tables/matviews, plus `exec_sql`,
`match_grants_for_org`, and the two `information_schema` reflections).

`!!` = **both apps write it.**

| | Object | Rows | JusticeHub | GrantScope |
|---|---|---|---|---|
| | `abr_registry` | 20,006,350 | r12 | r22 w4 |
| | `gs_relationships` | 3,429,184 | r19 | r161 w78 |
| | `political_donations` | 2,549,483 | r3 | r58 w9 |
| | `austender_contracts` | 823,620 | r4 | r106 w24 |
| **!!** | **`gs_entities`** | **609,448** | **r60 w3** | **r661 w87** |
| | `acnc_ais` | 360,488 | r7 | r26 w6 |
| | `person_roles` | 339,698 | r16 | r65 w28 |
| | `grantconnect_awards` | 291,264 | r1 | r10 w2 |
| | `state_tenders` | 199,719 | r19 **w9** | r20 (read-only) |
| **!!** | **`justice_funding`** | **157,116** | **r231 w25** | **r189 w25** |
| **!!** | **`organizations`** | **104,427** | **r525 w114** | **r13 w3** |
| | `acnc_charities` | 66,023 | r48 | r46 w6 |
| | `crime_stats_lga` | 58,125 | r1 | r5 w18 |
| | `grant_opportunities` | 25,897 | r10 | r140 w47 |
| **!!** | `rogs_justice_spending` | 22,364 | r62 w4 | r5 w3 |
| **!!** | `person_identity_map` | 14,919 | r7 w4 | r15 w6 |
| **!!** | `postcode_geo` | 12,299 | r13 w3 | r50 w5 |
| | `foundations` | 11,159 | r8 | r171 w28 |
| | `seifa_2021` | 10,572 | r1 | r23 w1 |
| | `outcomes_metrics` | 9,193 | r2 | r22 w25 |
| **!!** | `alma_funding_opportunities` | 8,538 | r39 w6 | r20 w8 |
| | `qld_watchhouse_snapshot_rows` | 8,488 | r2 | r1 w4 |
| **!!** | `oric_corporations` | 7,369 | r13 w2 | r15 w6 |
| | `mv_funding_by_postcode` | 7,224 | r3 | r13 |
| **!!** | `foundation_grantees` | 6,001 | r27 w5 | r20 w5 |
| **!!** | `vic_grants_awarded` | 5,202 | w2 | r13 w8 |
| | `ghl_contacts` | 5,169 | r4 | r41 w3 |
| | `alma_intervention_outcomes` | 3,109 | r16 w12 | r4 |
| | `aihw_child_protection` | 2,981 | r1 | r3 w2 |
| | `alma_outcomes` | 2,869 | r21 w15 | r9 |
| **!!** | **`alma_interventions`** | **2,136** | **r492 w102** | **r93 w17** |
| | `alma_intervention_evidence` | 2,065 | r31 w14 | r8 |
| | `mv_funding_deserts` | 1,997 | r2 | r28 |
| | `mv_funding_by_lga` | 1,729 | r2 | r4 |
| | `civic_ministerial_diaries` | 1,728 | r8 | r5 w2 |
| | `alma_media_articles` | 872 | r60 w14 | r1 |
| | `civic_ministerial_statements` | 649 | r15 | r16 w5 |
| **!!** | `civic_hansard` | 647 | r24 w12 | r14 w3 |
| | `alma_evidence` | 631 | r108 w43 | r12 |
| **!!** | `lga_cross_system_stats` | 361 | r6 w1 | r8 w6 |
| | `civic_alerts` | 293 | r4 | r7 w3 |
| | `storytellers` | 227 | r36 w5 | r2 |
| **!!** | `oversight_recommendations` | 139 | r17 w5 | r3 w1 |
| | `person_role_holdings` | 126 | r2 | r1 |
| **!!** | `governed_proof_bundle_records` | 120 | r1 w2 | r1 w1 |
| | `people` | 84 | r9 | r2 w1 |
| | `civic_charter_commitments` | 75 | r10 | r5 w5 |
| | `el_transcripts` | 52 | **w1** | **r3** |
| **!!** | `governed_proof_tasks` | 37 | r3 w6 | r2 w3 |
| | `youth_detention_facilities` | 21 | r23 w6 | r1 |
| | `locations` | 21 | r2 w1 | r1 |
| | `civic_consultancy_spending` | 18 | r3 | r3 w2 |
| | `civic_rti_disclosures` | 17 | r2 | r1 |
| **!!** | `governed_proof_bundles` | 16 | r2 w3 | r5 w2 |
| | `profiles` | 14 | r99 w15 | r2 |
| | `tour_stops` | 9 | r5 | r1 |
| **!!** | `governed_proof_runs` | 7 | w2 | w1 |
| **!!** | `alert_preferences` | 3 | r2 w2 | r10 w9 |
| | `civic_digests` | 1 | r1 | r2 w2 |
| | `exec_sql` (fn) | — | 105 calls | 745 calls |
| | `match_grants_for_org` (fn) | — | 1 | 3 |

### The ownership hazards, ranked

1. **`gs_entities` (609,448 rows).** GrantScope's spine. JusticeHub writes it from
   `src/app/api/cron/alma/enrich-websites/route.ts:324` — a read-modify-write that appends to
   `source_datasets` (array) and spreads into `metadata` (JSONB), plus fills `sector`,
   `sub_sector`, `description` when null. **Verified by reading the file.** GrantScope's own
   backfill scripts update the same columns. Concurrent runs will silently drop each other's
   array/JSONB additions. There is no advisory lock, no `updated_by`, no optimistic-concurrency
   column in the write path.
   Also written from `scripts/backfill-yj-org-data.mjs` and `scripts/enrich-orgs-from-websites-v2.mjs`.

2. **`justice_funding` (157,116 rows), split by column, not by row.** GrantScope ingests
   (`import-rogs-youth-justice.mjs`, `ingest-niaa-grants.mjs`, `ingest-prf-portfolio.mjs`,
   `bridge-justice-funding.mjs`, `link-justice-abns.mjs`). JusticeHub backfills the
   *JusticeHub-owned columns on a GrantScope-owned table* — `alma_organization_id`,
   `alma_intervention_id` — from `src/app/api/cron/alma/data-sprint/route.ts:230` and ~8 scripts.
   Works today; breaks the moment GrantScope re-imports rows and clears them.

3. **`organizations` (104,427 rows).** Effectively JusticeHub's table (525 reads, 114 writes,
   189 files) but GrantScope writes it from `scripts/build-entity-graph.mjs` and
   `scripts/link-alma-entities.mjs` to maintain `organizations.gs_entity_id`. The bridge is
   maintained from the far side of the wall.

4. **`governed_proof_*` (4 tables) — a forked service module.**
   `JusticeHub/src/lib/governed-proof/service.ts` (515 lines) and
   `grantscope/apps/web/src/lib/governed-proof/service.ts` (323 lines) are two divergent copies
   of the same service writing the same four tables. JusticeHub's is a superset; they differ
   from line 1 (`createServiceClient` vs `getServiceSupabase`). **Verified by diff.** This is the
   clearest "two owners, one table, no contract" case in the whole surface, and it is small
   enough (7–120 rows) to fix cheaply.

5. **`alert_preferences` (3 rows).** Both apps write it from **live request paths**, not scripts:
   JusticeHub `api/system/subscribe` + `api/system/alerts/deliver`; GrantScope `api/alerts`,
   `api/alerts/[id]`, `lib/grant-scout`, `lib/grant-notifications`, `lib/grant-alert-digests`.
   Two products' users are writing the same 3-row preference table.

6. **`civic_hansard` (647 rows) — duplicated scrapers.** `scripts/scrape-qld-hansard.mjs` exists
   in **both** repos, and both apps run cron writers (`JH src/app/api/cron/civic/*-hansard`,
   `GS apps/web/src/app/api/civicscope/cron`).

7. **`alma_interventions` (2,136 rows).** JusticeHub is the clear owner (492 reads, 102 writes);
   GrantScope writes it from 5 linkage scripts (`link-alma-entities.mjs`, `link-alma-v4.mjs`,
   `link-alma-via-registry.mjs`, `overnight-linkage-sweep.mjs`, `enrich-alma-orgs.mjs`) to set
   `gs_entity_id`. Same pattern as `organizations`, inverted.

8. **`person_identity_map`, `postcode_geo`, `oric_corporations`, `foundation_grantees`,
   `vic_grants_awarded`, `lga_cross_system_stats`, `alma_funding_opportunities`,
   `rogs_justice_spending`, `oversight_recommendations`** — nine more dual-write tables, mostly
   script-level backfills racing each other's enrichment columns.

### The reverse dependency nobody has written down

`state_tenders` (199,719 rows) is scraped and maintained **only by JusticeHub**, and read by
**GrantScope's** `apps/web/src/app/reports/state-procurement/page.tsx` and two youth-justice
tracker pages. Likewise `el_transcripts` (52 rows) is written only by JusticeHub's
`scripts/sync-el-storytellers.mjs` and read by **GrantScope's**
`apps/web/src/lib/services/place-brief-service.ts`. If JusticeHub's crons stop, GrantScope pages
go stale with no signal.

### Schema-level welding

The FK graph makes the entanglement permanent, not incidental:
`alma_interventions.gs_entity_id → gs_entities.id`,
`organizations.gs_entity_id`, `justice_funding.gs_entity_id`,
`vic_grants_awarded.gs_entity_id`, `crm_contact_organization_affiliations.gs_entity_id`,
`person_roles.entity_id / person_entity_id → gs_entities.id`,
and `alma_interventions.operating_organization_id → organizations.id`.
JusticeHub's tables hang off GrantScope's spine by declared foreign key.

---

## 5. Referenced but empty

**28 objects with 0 rows are referenced by live JusticeHub code** (of 89 empty objects in the DB).
None are referenced by GrantScope.

Highest-traffic dead references:

| Object | JH refs | Where |
|---|---|---|
| `community_reflections` | r20 w13 | `api/admin`, `api/authority`, `api/contained`, `api/cron`, `api/justice-matrix` |
| `story_related_sites` | r15 w2 | `api/communities`, `app/hub`, `lib/communities`, `lib/data-observatory` |
| `jr_outcomes` | r10 w3 | `api/communities`, `app/hub`, `lib/communities` |
| `tour_reactions` | r9 w1 | `api/admin`, `api/projects`, `app/admin` |
| `device_sessions` | r7 w3 | `api/contained`, `api/enrollment`, `app/admin` |
| `tour_stories` | r7 w3 | `api/admin`, `api/contained`, `api/projects` |
| `jr_evidence_drafts` | r6 w3 | `api/communities`, `app/hub` |
| `organization_outreach_log` | r6 w2 | `api/admin`, `app/admin` |
| `network_memberships` | r6 w1 | `api/network`, `app/network` |
| `peer_validations` | r5 w1 | `api/network`, `app/network` |
| `project_backers` | r5 w1 | `api/admin`, `api/projects` |
| `registered_services_profiles` | r3 w5 | `api/claims`, `app/admin` |
| `alma_conversations` | r4 w3 | `lib/orchestrator` |
| `jm_answer_feedback`, `jm_eval_cases` | r5 w5 | `api/justice-matrix`, `api/admin` |
| `record_grants`, `whats_new_subscribers`, `youth_survey_results`, `jr_publication_snapshots`, `kiosk_control_signals`, `jr_review_decisions`, `organization_sync_log`, `bocsar_source_files`, `exhibition_service_submissions`, `abs_raw_responses`, `abs_indigenous_population_by_lga`, `bocsar_youth_offending`, `jr_outcome_evidence_links` | 1–4 each | scattered |

Reading path: the whole `/network` route family (memberships + peer validations) and most of the
justice-reinvestment `jr_*` publication workflow are wired to empty tables — built, never fed.

## 5b. Referenced but NON-EXISTENT

**96 names JusticeHub references do not exist as a table, view, or function in
`tednluwflfhxyucgwigh`.** Split three ways:

1. **Empathy Ledger tables** (correct — they live in the *other* project): `storyteller_channels`,
   `storyteller_organizations`, `galleries`, `gallery_media`, `syndication_channels`,
   `story_themes`, `engagement_events`, `project_analyses`, `cross_project_metrics`,
   `story_interactions`, `consent_records`, `increment_story_counter`.
2. **Supabase Storage buckets, not tables** — `media` (8 sites), `images` (2), `documents` (2),
   one `media_items` site. Verified by reading; excluded from all counts above.
3. **Genuinely broken references.** The notable ones:
   - **`community_programs`** — 22 reads / 9 writes across `api/org-hub` and 12 scripts. Does not
     exist in any schema (checked with a catalogue query returning 0 rows). The closest live
     table is `registered_services`, whose FK is still named `community_programs_organization_id_fkey`
     — so the table was **renamed and the calling code was never updated**.
   - **`community_programs_profiles`** — 9 reads, incl. `src/app/hub/[org-slug]/dashboard/page.tsx:155`
     and `src/lib/org-hub/practice-reflex.ts:492`. Same rename casualty; every sibling
     (`organizations_profiles`, `services_profiles`, `blog_posts_profiles`, `art_innovation_profiles`)
     exists.
   - `services_complete` (5 reads: `api/services/search`, `api/signal-engine/scan`,
     `api/signal-engine/widget`, `lib/services/service-detail`), `alma_extraction_history`,
     `alma_weekly_reports` (`app/intelligence`), `alma_intervention_contexts` (`api/intelligence`),
     `alma_source_registry`, `alma_learning_patterns`, `alma_quality_metrics`, `alma_usage_log`,
     `funding_system0_filter_presets` / `_policy` / `_events`, `organization_capability_signals`,
     `funding_discovery_shared_shortlist`, `knowledge_record_links`, `jr_site_support_requests`,
     `media_library`, `sync_metadata`, `campaign_alignment`, `campaign_donations`,
     `campaign_metrics`, `community_voices`, `service_locations`, `service_contacts`,
     `org_grant_transactions`, `asic_directors`, `activity_feed`, `signal_widget_alerts`,
     `visitor_recommendations`, plus ~25 RPCs (`get_state_funding_summary`, `get_yj_funding_facets`,
     `get_featured_network_entities`, `count_distinct_intervention_*`, `review_knowledge_record_link`,
     `jm_stage_discovery`, …) that are called but not defined in `public`.

Caveat: functions may exist under a non-`public` schema, or be defined in a migration that was
never applied. I checked existence in `pg_proc`/`pg_class` across all schemas for a 20-name sample
(0 hits); I did not check every one of the 96 individually.

---

## 6. CROSS-DB — the Empathy Ledger seam

**Second project: `yvnuayzslukamizrlhwb`.** Confirmed from `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL=https://tednluwflfhxyucgwigh.supabase.co` (shared DB) and
`EMPATHY_LEDGER_URL=https://yvnuayzslukamizrlhwb.supabase.co`.
(Note: `.env.local` also defines an unused `EMPATHY_LEDGER_SUPABASE_URL`; the code reads
`EMPATHY_LEDGER_URL`. Two names for one thing is a trap waiting to spring.)

**GrantScope never connects to the Empathy Ledger database** — but it does read the same env var
name for something else entirely, and that is a live foot-gun:

`grantscope/apps/web/src/components/empathy-ledger-stories.tsx:39` reads `EMPATHY_LEDGER_URL` and
treats it as a **public web app base URL**, fetching `{EL_URL}/api/stories/by-entity/{abn|gs_id}`.
Its own docblock says `EMPATHY_LEDGER_URL=https://empathyledger.com`.
JusticeHub reads the **same variable name** and passes it to `createClient()` as a
**Supabase project URL** (`https://yvnuayzslukamizrlhwb.supabase.co`).

One name, two incompatible meanings, in two apps that already share a database. If the values are
ever unified (shared `.env`, shared Vercel project, copy-paste), GrantScope's component fetches a
Supabase host, gets a 404, and returns `[]` — it swallows `!res.ok` silently, so the block simply
renders empty forever with no error. **Rename one of them.**

Apart from that variable, the DB-level seam is JusticeHub-only.

### Three transports, layered

| Transport | Module | Direction | Auth |
|---|---|---|---|
| **v2 REST API** (preferred) | `src/lib/empathy-ledger/v2-client.ts` | read only | `EMPATHY_LEDGER_V2_URL` + org key `EMPATHY_LEDGER_V2_KEY` (`el_org_...`) |
| **Direct Supabase anon client** (fallback) | `src/lib/supabase/empathy-ledger-lite.ts` → `empathyLedgerClient` | read | `EMPATHY_LEDGER_API_KEY` |
| **Direct Supabase service client** | same module → `empathyLedgerServiceClient` | **read + WRITE** | `EMPATHY_LEDGER_SERVICE_KEY` |

`src/lib/supabase/empathy-ledger.ts` branches on `isV2Configured`: when the v2 API is configured
it uses REST; otherwise it silently falls back to raw Supabase queries. So the same function
returns different shapes depending on env — `v2StoryToLegacy()` exists purely to paper over that.
Consent is enforced *server-side by the v2 API*; in the fallback path it is enforced *client-side*
by `.eq('is_public', true).eq('privacy_level','public')` and `canDisplayOnJusticeHub()`. **The
consent guarantee is weaker on the fallback path** — if `EMPATHY_LEDGER_V2_*` is unset in an
environment, elder-approval filtering depends on every call site remembering the predicate.

### What crosses, and which way

**EL → JusticeHub (read).** Tables read on the EL project: `stories`, `storytellers`, `profiles`,
`organizations`, `projects`, `project_storytellers`, `storyteller_organizations`,
`storyteller_channels`, `syndication_channels`, `articles`, `media_assets`, `galleries`,
`gallery_media`, `transcripts`, `organization_members`, `public_profiles`, `story_themes`.
Entry points: `src/lib/supabase/empathy-ledger.ts`, `src/lib/empathy-ledger-content-hub.ts`,
`src/app/api/empathy-ledger/*`, `src/app/api/admin/empathy-ledger/*`,
`src/app/api/admin/storytellers/*`, `src/app/api/contained/voices`,
`src/app/api/org-hub/[orgId]/analysis`.

**JusticeHub → EL (WRITE).** `src/lib/empathy-ledger/push-sync.ts` holds `elService` and
`jhService` in the same file and inserts into EL's `storytellers` (line 327),
`storyteller_organizations` (283), `profiles`, `syndication_channels`, `storyteller_channels`.
Also `src/app/api/empathy-ledger/engagement/route.ts` writes EL `engagement_events`, and
`src/lib/enrollment/el-sync.ts` writes `storyteller_organizations` / `project_storytellers`.
**This is a bidirectional cross-project write path with a service key, from a Next.js route.**

**EL → shared DB (mirrored).** `scripts/sync-el-storytellers.mjs` copies EL data into local
mirror tables on the shared DB: `el_storytellers` (55 rows), `el_transcripts` (52 rows).
`src/app/api/empathy-ledger/sync/route.ts` and `scripts/sync-empathy-ledger-stories.mjs` maintain
`synced_stories` (190 rows). `scripts/el-purge-unservable-copies.mjs` prunes them.

**Then GrantScope reads the mirror.** `grantscope/apps/web/src/lib/services/place-brief-service.ts`
and `scripts/seed-prf-place-bundles.mjs` read `el_transcripts`. So the full path is:

```
Empathy Ledger (yvnuayzslukamizrlhwb)
   → JusticeHub sync script (service key)
      → shared DB el_transcripts / el_storytellers / synced_stories
         → GrantScope place-brief-service
```

**GrantScope consumes consented Empathy Ledger narrative material through a pipe it neither owns
nor can see.** Nothing in GrantScope's code mentions Empathy Ledger, so the consent lineage on
those transcripts is invisible from the reading side.

### Bridge columns on the shared DB (schema-verified)

`organizations.empathy_ledger_org_id`, `organizations.synced_from_empathy_ledger`,
`public_profiles.empathy_ledger_profile_id` + `.synced_from_empathy_ledger`,
`profile_appearances.empathy_ledger_profile_id` (NOT NULL),
`partner_storytellers.empathy_ledger_profile_id`, `partner_stories.empathy_ledger_story_id`,
`blog_posts.empathy_ledger_story_id` / `_transcript_id` / `synced_from_empathy_ledger`,
`platform_media_items.empathy_ledger_media_id`, `ghl_contacts.empathy_ledger_id`,
`device_sessions.el_profile_id` / `.el_storyteller_id`,
plus the sync logs `profile_sync_log` (92 rows), `organization_sync_log` (0 rows — dead),
`empathy_ledger_sync_log` (does not exist; referenced only from `lib/empathy-ledger.disabled`).

These are **UUIDs pointing into another Postgres instance with no FK and no referential
integrity**. Nothing detects an EL-side delete.

---

## 7. Coverage arithmetic

| | Count |
|---|---|
| Populated objects in DB | 724 |
| Touched by JusticeHub | 218 |
| Touched by GrantScope | 275 |
| Touched by **both** | **59** |
| Touched by **neither** | **290** |
| JusticeHub distinct objects referenced (incl. views, fns, nonexistent) | 427 |
| JusticeHub write targets | 242 |
| Dual-write objects | 19 |

**290 populated objects — 40% of the live data — are referenced by neither app.** The largest:
`mv_abr_name_lookup` (9,038,737), `asic_name_lookup` (2,149,868), `privacy_audit_log` (1,278,440),
`mv_charity_network` (351,455), `mv_entity_total_funding` (94,088), `mv_org_justice_signals` (66,023),
`mv_acnc_latest` (63,555), `mv_fy_donation_contracts` (50,685), `foundation_category_assignments` (42,599),
`opportunities_unified` (17,790), `foundation_geo_focus` (16,942), `abs_sal_lga_ratio` (16,372),
`integration_events` (14,594), `funder_intelligence` (11,159), `site_health_checks` (9,608),
`postcode_sa2_concordance` (7,261).

Plus pure cruft: `gs_entities_lga_backup_20260808` (609,416), `_20260809b` (358,347),
`_20260809c` (355,797), `_20260809` (98,660), `gs_entities_reason_backup_20260809b` (39,450),
five `postcode_geo_*_backup_*` tables at 12,299 each, `_backup_entity_contacts_20260606` (16,664).
Roughly **1.5M rows of dated backup tables** nobody reads.

---

## 8. What I would fix first

1. **Stop JusticeHub's cron writing `gs_entities` JSONB in place.** Either give it a
   JusticeHub-owned side table keyed on `gs_entity_id`, or make the merge atomic
   (`jsonb_set` / array append in SQL, not read-modify-write in JS).
2. **De-fork `governed_proof/service.ts`.** One copy in a shared package, or one owner.
3. **Fix `community_programs` / `community_programs_profiles`.** ~31 call sites, including a live
   dashboard page, pointing at a table that was renamed to `registered_services`.
4. **Name the ownership rule per shared table** and put it somewhere both repos read. Nineteen
   dual-write tables with no documented lane is the actual root cause of everything above.
5. **Document the reverse dependencies** (`state_tenders`, `el_transcripts`) so a JusticeHub cron
   failure is visible from GrantScope.
6. **Drop the ~1.5M rows of dated backup tables** and decide, per unreferenced matview, whether it
   is dead or just not wired up yet.
7. **Rename `EMPATHY_LEDGER_URL` in one of the two repos** — it means "Supabase project URL" in
   JusticeHub and "public website base URL" in GrantScope.
