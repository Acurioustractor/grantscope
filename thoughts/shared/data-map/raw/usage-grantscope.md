# GrantScope / CivicGraph — database usage map

Generated 2026-08-14 by static analysis of `/Users/benknight/Code/grantscope`.
Object universe = 812 tables+matviews (from `census.csv`) + 212 regular views (queried live
from `information_schema.views`) = **1,024 named objects**.

Method: three ripgrep passes over the whole repo (node_modules/.next excluded) —
(1) `.from('X')` call targets, (2) `.rpc('X')`, (3) SQL-context matches
(`FROM|JOIN|INSERT INTO|UPDATE|CREATE TABLE/VIEW/MATERIALIZED VIEW|REFERENCES|TRUNCATE|ALTER TABLE|REFRESH MATERIALIZED VIEW`),
plus (4) a loose whole-word pass over every object name as a fallback 'mentioned' signal.
Route→table attribution follows the TypeScript import graph from each `apps/web/src/app/**`
file up to 5 hops, so a page that calls `report-service.ts` inherits that service's tables.

## 0. Headline counts

| Classification | objects | populated | empty | (of which regular views) |
|---|---|---|---|---|
| **Read by the web app** (hard `.from`/SQL ref in `apps/web`) | 289 | 228 | 24 | 37 |
| Named in web files but not as a query target | 44 | 40 | 2 | 2 |
| **Pipeline-only** (hard ref in `scripts/`, `mcp-server/`, `packages/`; never in web) | 59 | 46 | 10 | 3 |
| Named in pipeline files only, not as a query target | 126 | 123 | 2 | 1 |
| Only appears in migration DDL — created, never queried by app code | 71 | 36 | 9 | 26 |
| Only in docs / `thoughts/` / `_archive/` | 35 | 26 | 7 | 2 |
| **Referenced nowhere in this repo** | 400 | 225 | 34 | 141 |

Caveat: `WEB_MENTION_ONLY` and `PIPELINE_MENTION` are mostly noise — generic English words that
happen to be table names (`users`, `events`, `projects`, `stories`, `metrics`, `reports`, `grants`).
A hand pass over all 44 `WEB_MENTION_ONLY` rows is in section 7.

## 1. Where the app centralises database access

| File | Role |
|---|---|
| `apps/web/src/lib/supabase.ts` (175 lines) | The single factory. `getSupabase()` = anon/RLS client; `getServiceSupabase()` / `getDirectServiceSupabase()` = service-role. Both are wrapped in a **Proxy that intercepts `.rpc`**: `exec`, `execute_sql`, `exec_agent_sql` are hard-blocked (`SQL_RPC_DISABLED`), and `exec_sql` is admitted only if the SQL parses as a single top-level `SELECT`/`WITH` with no stacked statements and no data-modifying CTE (`SQL_RPC_READONLY` otherwise). |
| `apps/web/src/lib/supabase-env.ts` | Env resolution only (`NEXT_PUBLIC_SUPABASE_URL`, publishable/anon key, `SUPABASE_SECRET_KEY`/service-role). |
| `apps/web/src/lib/supabase-server.ts`, `supabase-browser.ts` | SSR-cookie and browser variants. |
| `apps/web/src/lib/supabase-fetch.ts` | `runtimeSupabaseFetch` — the fetch used by the service client (timeouts/retry). |
| `apps/web/src/lib/report-supabase.ts` | **Report gate.** Returns a stub client that resolves every query to `{data:null,count:0}` unless `CIVICGRAPH_LIVE_REPORTS=true` (and, at build time, `CIVICGRAPH_BUILD_LIVE_REPORTS=true`). |
| `apps/web/src/lib/sql.ts` | `esc()` and SQL-string helpers used to build `exec_sql` payloads. |
| `apps/web/src/lib/sql-validation.ts` | Validation for user/LLM-authored SQL (the `/api/ask` and `/api/query` paths). |
| `apps/web/src/lib/services/*.ts` (≈140 files) | The real data layer. Nearly every route delegates here. Biggest: `report-service.ts`, `org-dashboard-service.ts`, `entity-service.ts`, `place-data-service.ts`, `goods-*.ts` (≈40 files), `act-*.ts` (≈45 files). |
| `scripts/lib/psql.mjs`, `scripts/gsql.mjs` | Pipeline side. `gsql.mjs` = read path via `exec_sql` RPC (8s statement timeout); `psql.mjs` = direct pooler connection for DDL/bulk. |

**The dominant access pattern is raw SQL, not the PostgREST query builder.** `exec_sql` appears in
**209 files** — 100 under `apps/web/src/app`, 20 under `apps/web/src/lib`, 99 under `scripts/`.
By contrast there are 1,594 distinct `(table, file)` pairs from `.from('…')` and only 273 `.rpc(…)` sites,
209 of which are `exec_sql` itself. Named RPCs actually in use:

`claim_next_task`, `closing_the_gap_state_summary`, `dashboard_foundation_tiers`, `dashboard_foundation_total_giving`, `dashboard_geographic_distribution`, `dashboard_sector_distribution`, `dashboard_source_coverage`, `exec_sql_readonly`, `find_third_degree_paths`, `get_abn_coverage_summary`, `get_dangling_relationship_entities`, `get_entity_type_breakdown`, `get_foundation_acnc_summary`, `get_foundation_confidence_breakdown`, `get_foundation_program_counts`, `get_funding_gaps`, `get_funding_operating_report`, `get_grant_award_history`, `get_grant_source_breakdown`, `get_pipeline_stats`, `get_relationship_type_breakdown`, `get_table_counts`, `get_table_freshness`, `get_timing_windows`, `get_unenriched_charities`, `get_unlinked_abns`, `get_user_by_email`, `get_user_feedback_signals`, `match_answer_bank`, `match_grants_for_org`, `record_opportunity_review`, `refresh_mv`, `run_sql`, `se_registry_stats`, `search_entities_fuzzy`, `search_entities_semantic`, `search_foundations_semantic`, `search_grants_semantic`, `search_org_knowledge`, `search_project_funding_hybrid`, `search_suppliers`, `snapshot_data_catalog`

## 2. Route families → data behind them

`apps/web/src/app` has 68 top-level entries. Table counts below are the union of hard DB references
reachable from each family through the import graph (≤5 hops), so services are attributed to their callers.

| Route family | objects reached | anchor tables (illustrative) |
|---|---|---|
| `/reports` | 124 | `gs_relationships`, `political_donations`, `asic_companies`, `austender_contracts`, `gs_entities`, `acnc_ais`, `person_roles`, `mv_person_network` |
| `/org` | 117 | `gs_relationships`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_person_entity_network`, `mv_person_entity_crosswalk`, `mv_person_influence`, `mv_entity_power_index` |
| `/api/cron` | 62 | `gs_relationships`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_person_entity_crosswalk`, `mv_entity_power_index`, `justice_funding`, `grant_opportunities` |
| `/api/data` | 60 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `mv_gs_entity_stats`, `acnc_ais`, `person_roles`, `mv_person_entity_network` |
| `/api/org` | 60 | `gs_relationships`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_person_entity_crosswalk`, `mv_person_influence`, `mv_entity_power_index`, `justice_funding` |
| `/api/ops` | 45 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `acnc_ais`, `justice_funding`, `acnc_charities`, `money_flows` |
| `/api/goods` | 44 | `gs_relationships`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_person_entity_crosswalk`, `mv_entity_power_index`, `justice_funding`, `grant_opportunities` |
| `/social-enterprises` | 41 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `justice_funding`, `dss_payment_demographics`, `acnc_charities` |
| `/api/reports` | 40 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `justice_funding`, `dss_payment_demographics`, `crime_stats_lga` |
| `/suppliers` | 39 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `justice_funding`, `dss_payment_demographics`, `crime_stats_lga` |
| `/api/report-builder` | 36 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `justice_funding`, `dss_payment_demographics`, `crime_stats_lga` |
| `/share` | 35 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `acnc_ais`, `mv_person_influence`, `mv_entity_power_index`, `justice_funding` |
| `/api/opportunity-system-sweep` | 30 | `gs_relationships`, `austender_contracts`, `gs_entities`, `justice_funding`, `grant_opportunities`, `postcode_geo`, `social_enterprises`, `foundations` |
| `/opportunities` | 30 | `gs_relationships`, `austender_contracts`, `gs_entities`, `justice_funding`, `grant_opportunities`, `postcode_geo`, `social_enterprises`, `foundations` |
| `/places` | 29 | `gs_relationships`, `austender_contracts`, `gs_entities`, `grantconnect_awards`, `justice_funding`, `dss_payment_demographics`, `ndis_participants`, `crime_stats_lga` |
| `/api/mission-control` | 28 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `justice_funding`, `acnc_charities`, `source_frontier` |
| `/entities` | 26 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `mv_gs_entity_stats`, `acnc_ais`, `person_roles`, `justice_funding` |
| `/ops` | 26 | `gs_relationships`, `political_donations`, `asic_companies`, `austender_contracts`, `gs_entities`, `justice_funding`, `acnc_charities`, `money_flows` |
| `/api/opportunity-intelligence` | 24 | `gs_relationships`, `austender_contracts`, `gs_entities`, `justice_funding`, `grant_opportunities`, `postcode_geo`, `social_enterprises`, `foundations` |
| `/home` | 23 | `gs_entities`, `justice_funding`, `source_frontier`, `grant_opportunities`, `act_grant_recommendations`, `foundations`, `agent_runs`, `saved_grants` |
| `/api/entities` | 21 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `mv_gs_entity_stats`, `acnc_ais`, `person_roles`, `justice_funding` |
| `/api/ask` | 19 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_entity_power_index`, `justice_funding`, `organizations` |
| `/entity` | 19 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `person_roles`, `mv_entity_power_index`, `justice_funding`, `acnc_charities` |
| `/api/power` | 17 | `gs_relationships`, `gs_entities`, `person_roles`, `mv_person_identity_network`, `mv_person_identity_influence_v2`, `mv_entity_power_index`, `justice_funding`, `organizations` |
| `/foundations` | 16 | `gs_relationships`, `gs_entities`, `acnc_ais`, `person_roles`, `justice_funding`, `organizations`, `grant_opportunities`, `foundations` |
| `/api/dd-packs` | 15 | `political_donations`, `austender_contracts`, `gs_entities`, `mv_gs_entity_stats`, `acnc_ais`, `justice_funding`, `acnc_charities`, `postcode_geo` |
| `/api/opportunity-alignment` | 15 | `gs_relationships`, `austender_contracts`, `gs_entities`, `mv_gs_entity_stats`, `justice_funding`, `grant_opportunities`, `postcode_geo`, `social_enterprises` |
| `/place` | 15 | `gs_relationships`, `austender_contracts`, `gs_entities`, `grantconnect_awards`, `crime_stats_lga`, `abs_locality_lga`, `postcode_geo`, `social_enterprises` |
| `/api/contacts` | 12 | `gs_relationships`, `austender_contracts`, `gs_entities`, `person_identity_map`, `linkedin_contacts`, `foundations`, `ghl_contacts`, `saved_grants` |
| `/api/query` | 12 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `justice_funding`, `acnc_charities`, `grant_opportunities`, `postcode_geo` |
| `/api/start` | 12 | `gs_entities`, `grant_opportunities`, `postcode_geo`, `foundations`, `seifa_2021`, `mv_funding_by_postcode`, `saved_grants`, `alma_interventions` |
| `/changes` | 12 | `austender_contracts`, `gs_entities`, `justice_funding`, `acnc_charities`, `foundations`, `agent_runs`, `vic_grants_awarded`, `alma_interventions` |
| `/giving` | 12 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `grant_opportunities`, `social_enterprises`, `foundations`, `mv_funding_by_postcode` |
| `/api/alerts` | 11 | `grant_opportunities`, `saved_grants`, `grant_notification_outbox`, `alert_events`, `profiles`, `alert_preferences`, `org_profiles`, `messages` |
| `/api/goods-readiness-snapshot` | 11 | `foundations`, `goods_procurement_entities`, `goods_communities`, `goods_procurement_signals`, `ghl_opportunities`, `goods_asset_lifecycle`, `ghl_pipelines`, `profiles` |
| `/api/insights` | 11 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `justice_funding`, `money_flows`, `grant_opportunities`, `social_enterprises` |
| `/api/procurement` | 11 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `postcode_geo`, `social_enterprises`, `seifa_2021`, `mv_funding_by_lga` |
| `/api/agent` | 10 | `gs_entities`, `person_roles`, `mv_entity_power_index`, `justice_funding`, `foundations`, `mv_revolving_door`, `mv_funding_deserts`, `api_usage` |
| `/api/civicscope` | 10 | `justice_funding`, `alma_interventions`, `civic_ministerial_diaries`, `civic_ministerial_statements`, `civic_hansard`, `civic_alerts`, `civic_charter_commitments`, `civic_consultancy_spending` |
| `/api/tracker` | 10 | `grant_opportunities`, `ghl_contacts`, `saved_grants`, `grant_notification_outbox`, `grant_feedback`, `org_pipeline`, `org_members`, `org_profiles` |
| `/architecture` | 10 | `acnc_ais`, `money_flows`, `grant_opportunities`, `social_enterprises`, `foundations`, `foundation_programs`, `saved_grants`, `community_orgs` |
| `/briefing` | 10 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `justice_funding`, `grant_opportunities`, `postcode_geo`, `foundations` |
| `/api/justice` | 9 | `political_donations`, `austender_contracts`, `gs_entities`, `justice_funding`, `alma_outcomes`, `alma_interventions`, `alma_evidence`, `org_profiles` |
| `/api/outcomes` | 9 | `gs_entities`, `justice_funding`, `mv_funding_outcomes_summary`, `governed_proof_bundle_records`, `governed_proof_tasks`, `governed_proof_bundles`, `governed_proof_runs`, `outcome_submissions` |
| `/atlas` | 9 | `gs_entities`, `crime_stats_lga`, `abs_locality_lga`, `postcode_geo`, `social_enterprises`, `seifa_2021`, `goods_communities`, `mv_lga_place_profile` |
| `/how-it-works` | 9 | `acnc_ais`, `organizations`, `money_flows`, `grant_opportunities`, `social_enterprises`, `foundations`, `agent_runs`, `foundation_programs` |
| `/api/foundations` | 8 | `gs_entities`, `foundations`, `saved_foundations`, `org_pipeline`, `org_members`, `org_profiles`, `api_keys`, `foundation_notes` |
| `/api/grants` | 8 | `grant_opportunities`, `ghl_contacts`, `grant_feedback`, `project_profiles`, `org_members`, `org_profiles`, `messages`, `api_keys` |
| `/api/places` | 8 | `gs_relationships`, `gs_entities`, `postcode_geo`, `seifa_2021`, `alma_interventions`, `el_transcripts`, `org_profiles`, `api_keys` |
| `/api/v1` | 8 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `ato_tax_transparency`, `alma_interventions`, `org_profiles`, `api_keys` |
| `/api/watches` | 8 | `gs_entities`, `discoveries`, `civic_alerts`, `profiles`, `org_profiles`, `messages`, `api_keys`, `entity_watches` |
| `/insights` | 8 | `gs_relationships`, `political_donations`, `austender_contracts`, `gs_entities`, `justice_funding`, `grant_opportunities`, `social_enterprises`, `foundations` |
| `/snow-foundation` | 8 | `person_roles`, `foundations`, `foundation_power_profiles`, `foundation_grantees`, `foundation_programs`, `foundation_program_years`, `people`, `foundation_people` |
| `/charities` | 7 | `acnc_ais`, `foundations`, `people`, `org_profiles`, `charity_claims`, `v_charity_detail`, `v_charity_explorer` |
| `/foundation` | 7 | `mv_foundation_regranting`, `mv_trustee_grantee_chain`, `mv_foundation_trends`, `mv_foundation_grantees`, `foundations`, `mv_foundation_scores`, `mv_evidence_backed_funding` |
| `/mission-control` | 7 | `gs_entities`, `grant_opportunities`, `foundations`, `agent_runs`, `discoveries`, `mv_gs_donor_contractors`, `people` |
| `/api/board-report` | 6 | `gs_relationships`, `gs_entities`, `justice_funding`, `alma_interventions`, `org_profiles`, `api_keys` |
| `/api/charities` | 6 | `acnc_charities`, `ghl_contacts`, `saved_grants`, `org_profiles`, `charity_claims`, `messages` |
| `/api/dashboard` | 6 | `grant_opportunities`, `social_enterprises`, `foundations`, `community_orgs`, `org_profiles`, `api_keys` |
| `/api/evidence` | 6 | `gs_entities`, `alma_intervention_outcomes`, `alma_outcomes`, `alma_interventions`, `alma_intervention_evidence`, `alma_evidence` |
| `/person` | 6 | `gs_entities`, `person_roles`, `mv_person_entity_network`, `mv_person_identity_network`, `mv_person_identity_influence`, `people` |
| `/process` | 6 | `acnc_ais`, `grant_opportunities`, `social_enterprises`, `foundations`, `foundation_programs`, `community_orgs` |
| `/api/billing` | 5 | `foundations`, `profiles`, `org_members`, `org_profiles`, `product_events` |
| `/api/chat` | 5 | `foundations`, `org_members`, `org_profiles`, `messages`, `api_keys` |
| `/api/scenarios` | 5 | `austender_contracts`, `gs_entities`, `justice_funding`, `alma_interventions`, `mv_funding_deserts` |
| `/api/search` | 5 | `grant_opportunities`, `foundations`, `foundation_programs`, `org_profiles`, `api_keys` |
| `/api/social-enterprises` | 5 | `gs_entities`, `postcode_geo`, `social_enterprises`, `org_profiles`, `api_keys` |
| `/grants` | 5 | `grant_opportunities`, `foundations`, `org_pipeline`, `org_members`, `org_profiles` |
| `/graph` | 5 | `ndis_utilisation`, `organizations`, `ndis_participants`, `foundations`, `alma_evidence` |
| `/profile` | 5 | `foundations`, `people`, `profiles`, `org_profiles`, `product_events` |
| `/alerts` | 4 | `foundations`, `profiles`, `org_profiles`, `product_events` |
| `/api/answers` | 4 | `grant_answer_bank`, `org_members`, `org_profiles`, `api_keys` |
| `/api/profile` | 4 | `knowledge_chunks`, `project_profiles`, `org_members`, `org_profiles` |
| `/dashboard` | 4 | `grant_opportunities`, `social_enterprises`, `foundations`, `community_orgs` |
| `/feedback` | 4 | `foundations`, `people`, `messages`, `report_feedback` |
| `/pricing` | 4 | `foundations`, `people`, `messages`, `report_feedback` |
| `/(root)` | 3 | `mv_entity_power_index`, `foundations`, `org_profiles` |
| `/api/admin` | 3 | `api_usage`, `org_profiles`, `api_keys` |
| `/api/global-search` | 3 | `gs_entities`, `grant_opportunities`, `foundations` |
| `/api/home` | 3 | `source_frontier`, `grant_opportunities`, `saved_grants` |
| `/api/integrations` | 3 | `act_grant_recommendation_decisions`, `funding_ghl_callback_events`, `funding_ghl_handoffs` |
| `/api/place` | 3 | `postcode_geo`, `place_corrections`, `v_org_funding_profile` |
| `/continue` | 3 | `saved_grants`, `saved_foundations`, `org_profiles` |
| `/evidence-packs` | 3 | `political_donations`, `justice_funding`, `alma_interventions` |
| `/start` | 3 | `foundations`, `founder_intake_messages`, `founder_intakes` |
| `/about` | 2 | `foundations`, `people` |
| `/account` | 2 | `report_feedback`, `report_submissions` |
| `/api/discover` | 2 | `org_profiles`, `api_keys` |
| `/api/keys` | 2 | `org_profiles`, `api_keys` |
| `/api/partnership-inquiries` | 2 | `partnership_inquiries`, `messages` |
| `/api/simulator` | 2 | `org_profiles`, `api_keys` |
| `/api/team` | 2 | `org_members`, `org_profiles` |
| `/closing-the-gap` | 2 | `alma_interventions`, `people` |
| `/components` | 2 | `foundations`, `org_profiles` |
| `/discover` | 2 | `foundations`, `people` |
| `/get-a-report` | 2 | `foundations`, `report_submissions` |
| `/pipeline` | 2 | `gs_entities`, `mv_entity_power_index` |
| `/power` | 2 | `foundations`, `people` |

Families reaching exactly one object, or none, are omitted: `/agent`, `/api/pipeline`,
`/api/chat`, `/api/global-search`, `/goods-on-country`, `/justice-reinvestment`, `/outcomes`,
`/procurement`, `/profile`, `/support`, plus the pure-static families
(`/how-it-works` content pages, `/mission-control` shell, `/login`, `/register`, `/settings`,
`/embed`, `/map`, `/rankings`, `/sector`, `/tracker`, `/closing-the-gap` sub-pages).

## 3. DARK DATA — populated objects referenced nowhere in the GrantScope repo

**225 populated objects** (plus
141 regular views and
34 empty ones) have **zero** occurrences of their name
anywhere in `/Users/benknight/Code/grantscope` — not in code, not in migrations, not in docs, not in `_archive/`.
Spot-checked with an unanchored `rg` for the nine largest: all returned nothing.

**Important framing:** the Supabase project is shared. Many of these belong to *other* apps on the
same database (JusticeHub, the ACT infrastructure/bookkeeping stack, Empathy Ledger, Harvest,
Contained). "Dark to GrantScope" is verified; "dark absolutely" is not — that needs the JusticeHub
and act-global-infrastructure repos checked too. The `likely owner` column below is **inferred** from
name prefix and foreign-key target, not verified.

**A second, sneakier class of dark data is NOT in this section**: objects whose only occurrence in the
repo is their own name inside a *refresh list* or a *health watch list* — the pipeline spends money
keeping them fresh every night and no user ever sees them. The three biggest are
`mv_abr_name_lookup` (9,038,737 rows / 1.37 GB), `mv_charity_network` (351,455 — charity-to-charity
network via shared directors) and `privacy_audit_log` (1,278,440). See section 10.

### 3a. Dark AND anchored to CivicGraph's own core tables (the highest-value finds)

These have declared foreign keys into tables GrantScope itself owns and reads. They are enrichment
layers that were built, populated, and then never surfaced.

| Object | rows | FK target | What it holds |
|---|---|---|---|
| `foundation_category_assignments` | 42,599 | `foundations`, `foundation_categories` | LLM/classifier thematic category per foundation, with `confidence`, `evidence_text`, `evidence_url`, `classifier_version` |
| `foundation_geo_focus` | 16,942 | `foundations` | Geographic focus per foundation (`geo_type`, `geo_code`, `geo_name`) with the same evidence + confidence provenance |
| `mv_foundation_landscape_top_foundations` | 10,129 | (matview over foundations) | Pre-computed foundation landscape ranking |
| `mv_foundation_landscape_geo` | 23 | (matview) | Foundation landscape by geography |
| `mv_foundation_landscape_category` | 16 | (matview) | Foundation landscape by category |
| `mv_foundation_landscape_access` | 6 | (matview) | Foundation landscape by access |
| `civic_funding_yj_classifications` | 308 | `justice_funding` | Human-confirmed + LLM-proposed youth-justice relevance per funding row (`llm_confidence`, `llm_evidence_snippet`, `confirmed_at`) |
| `exa_media_mentions` | 162 | `person_identity_map` | Media articles about tracked people — title, url, source_domain, excerpt, full_text, sentiment, topics |
| `exa_linkedin_profiles` | 17 | `person_identity_map` | LinkedIn enrichment per person |
| `exa_enrichment_queue` | 17 | `person_identity_map` | Queue driving the above |
| `project_contact_matches` | 143 | `person_identity_map`, `linkedin_contacts` | Person↔contact resolution |
| `data_catalogue` | 261 | — | An open-data portal catalogue: jurisdiction, title, publisher, licence, landing_page, formats, `indigenous_breakdown`, `youth_focused` |
| `data_sources_inventory` | 63 | — | Inventory of data sources |
| `data_gap_questions` | 126 | — | Recorded data gaps |
| `data_agent_findings` | 161 | — | Agent-discovered findings |
| `aihw_youth_justice_stats` | 13 | — | AIHW youth justice statistics |
| `auditor_general_audits` | 8 | — | Auditor-General audit records |
| `children_commissioner_reports` | 11 | — | Children's Commissioner reports |
| `scag_communiques` | 10 | — | Standing Council of Attorneys-General communiques |
| `international_programs` | 67 | — | International program comparators |
| `clearinghouse_documents` | 5 | — | Clearinghouse documents |
| `llm_usage` | 4,452 | — | LLM call/cost telemetry (nobody in this repo reads it) |
| `api_pricing` | 11 | — | Model price table |

### 3b. Full dark list (populated), largest first

| Object | kind | rows | likely owner (inferred) |
|---|---|---|---|
| `foundation_category_assignments` | table | 42,599 | CivicGraph domain |
| `foundation_geo_focus` | table | 16,942 | CivicGraph domain |
| `_backup_entity_contacts_20260606` | table | 16,664 | other tenant / unclear |
| `mv_foundation_landscape_top_foundations` | matview | 10,129 | CivicGraph domain |
| `finance_receipt_documents` | table | 7,172 | ACT finance/bookkeeping |
| `llm_usage` | table | 4,452 | other tenant / unclear |
| `finance_receipt_bank_line_links` | table | 4,292 | ACT finance/bookkeeping |
| `contact_intelligence_insights` | table | 2,197 | other tenant / unclear |
| `receipt_pipeline_status` | table | 2,195 | ACT finance/bookkeeping |
| `alma_org_enrichment_candidates` | table | 1,825 | other tenant / unclear |
| `bank_statement_lines` | table | 1,618 | ACT finance/bookkeeping |
| `xero_contacts` | table | 1,416 | ACT finance/bookkeeping |
| `supporter_comms_summary` | table | 1,101 | other tenant / unclear |
| `organization_funding_summaries` | table | 1,059 | other tenant / unclear |
| `contact_enrichments` | table | 812 | other tenant / unclear |
| `newsletter_candidates` | table | 800 | other tenant / unclear |
| `funding_agent_workflows` | table | 741 | other tenant / unclear |
| `jr_site_research_items` | table | 690 | JusticeHub |
| `dext_forwarded_emails` | table | 632 | ACT finance/bookkeeping |
| `receipt_status` | table | 592 | ACT finance/bookkeeping |
| `finance_ai_routing_suggestions` | table | 390 | ACT finance/bookkeeping |
| `justice_matrix_cases` | table | 367 | JusticeHub |
| `wiki_search_index` | table | 363 | ACT ops / project mgmt |
| `justice_matrix_discovered` | table | 319 | JusticeHub |
| `civic_funding_yj_classifications` | table | 308 | CivicGraph domain |
| `pulse_events` | table | 284 | ACT ops / project mgmt |
| `transcript_analysis` | table | 271 | Empathy Ledger / storytelling |
| `data_catalogue` | table | 261 | CivicGraph domain |
| `civic_claim_evidence` | table | 250 | CivicGraph domain |
| `community_outcome_validations` | table | 200 | other tenant / unclear |
| `community_events` | table | 192 | other tenant / unclear |
| `revenue_stream_projections` | table | 180 | ACT finance/bookkeeping |
| `supporters_intelligence` | table | 179 | other tenant / unclear |
| `exa_media_mentions` | table | 162 | CivicGraph domain |
| `data_agent_findings` | table | 161 | CivicGraph domain |
| `civic_meeting_tags` | table | 160 | CivicGraph domain |
| `project_contact_matches` | table | 143 | ACT ops / project mgmt |
| `jr_site_metrics` | table | 133 | JusticeHub |
| `jr_site_impact_figures` | table | 132 | JusticeHub |
| `data_gap_questions` | table | 126 | CivicGraph domain |
| `mv_project_quarter_position` | matview | 125 | other tenant / unclear |
| `social_posts` | table | 104 | other tenant / unclear |
| `grant_application_requirements` | table | 98 | other tenant / unclear |
| `profile_sync_log` | table | 92 | other tenant / unclear |
| `civic_intelligence_claims` | table | 88 | CivicGraph domain |
| `story_attribution_events` | table | 85 | Empathy Ledger / storytelling |
| `media_processing_jobs` | table | 82 | Empathy Ledger / storytelling |
| `idea_board` | table | 73 | ACT ops / project mgmt |
| `location_project_rules` | table | 73 | other tenant / unclear |
| `notion_projects_cache` | table | 70 | ACT ops / project mgmt |
| `international_programs` | table | 67 | CivicGraph domain |
| `justice_matrix_campaigns` | table | 67 | JusticeHub |
| `project_intelligence` | table | 67 | ACT ops / project mgmt |
| `data_sources_inventory` | table | 63 | CivicGraph domain |
| `project_pipelines` | table | 63 | ACT ops / project mgmt |
| `goal_updates` | table | 61 | ACT ops / project mgmt |
| `enrichment_reviews` | table | 57 | other tenant / unclear |
| `campaign_outreach` | table | 53 | other tenant / unclear |
| `contact_support_recommendations` | table | 52 | other tenant / unclear |
| `jm_external_cache` | table | 48 | JusticeHub |
| `justice_matrix_queries` | table | 48 | JusticeHub |
| `justice_matrix_sources` | table | 48 | JusticeHub |
| `project_funding_drawdowns` | table | 48 | ACT ops / project mgmt |
| `subscription_patterns` | table | 48 | ACT finance/bookkeeping |
| `goals_2026` | table | 47 | ACT ops / project mgmt |
| `invoice_project_overrides` | table | 46 | ACT finance/bookkeeping |
| `jr_sites` | table | 46 | JusticeHub |
| `financial_summary` | table | 45 | ACT finance/bookkeeping |
| `funding_ingest_sources` | table | 44 | other tenant / unclear |
| `jr_site_links` | table | 44 | JusticeHub |
| `jr_site_research` | table | 44 | JusticeHub |
| `image_overrides` | table | 43 | other tenant / unclear |
| `partner_photos` | table | 43 | Empathy Ledger / storytelling |
| `finance_receipt_ingestion_runs` | table | 42 | ACT finance/bookkeeping |
| `bookkeeping_rules` | table | 41 | ACT finance/bookkeeping |
| `profile_appearances` | table | 41 | other tenant / unclear |
| `jm_rate_limits` | table | 38 | JusticeHub |
| `review_media_links` | table | 38 | Empathy Ledger / storytelling |
| `sprint_items` | table | 36 | ACT ops / project mgmt |
| `role_taxonomy` | table | 33 | other tenant / unclear |
| `review_projects` | table | 31 | Empathy Ledger / storytelling |
| `event_registrations` | table | 30 | other tenant / unclear |
| `ignored_email_patterns` | table | 30 | other tenant / unclear |
| `partner_stories` | table | 29 | Empathy Ledger / storytelling |
| `facility_partnerships` | table | 27 | other tenant / unclear |
| `research_items` | table | 27 | unclear |
| `signal_content` | table | 27 | ACT ops / project mgmt |
| `community_submissions` | table | 26 | other tenant / unclear |
| `grant_assets` | table | 26 | other tenant / unclear |
| `org_action_items` | table | 24 | other tenant / unclear |
| `review_curated_entries` | table | 24 | Empathy Ledger / storytelling |
| `mv_foundation_landscape_geo` | matview | 23 | CivicGraph domain |
| `project_media_links` | table | 23 | ACT ops / project mgmt |
| `project_support_graph` | table | 22 | ACT ops / project mgmt |
| `pulse_reports` | table | 22 | ACT ops / project mgmt |
| `org_participants` | table | 21 | other tenant / unclear |
| `editable_content` | table | 19 | other tenant / unclear |
| `repo_project_links` | table | 19 | ACT ops / project mgmt |
| `justice_matrix_issues` | table | 18 | JusticeHub |
| `exa_enrichment_queue` | table | 17 | CivicGraph domain |
| `exa_linkedin_profiles` | table | 17 | CivicGraph domain |
| `financial_snapshots` | table | 17 | ACT finance/bookkeeping |
| `org_compliance_docs` | table | 17 | other tenant / unclear |
| `tag_inference_rules` | table | 17 | other tenant / unclear |
| `civic_metric_snapshots` | table | 16 | CivicGraph domain |
| `mv_foundation_landscape_category` | matview | 16 | CivicGraph domain |
| `newsletter_subscriptions` | table | 16 | other tenant / unclear |
| `ce_metrics` | table | 15 | other tenant / unclear |
| `media_item` | table | 15 | Empathy Ledger / storytelling |
| `partner_impact_metrics` | table | 14 | Empathy Ledger / storytelling |
| `partner_storytellers` | table | 14 | Empathy Ledger / storytelling |
| `aihw_youth_justice_stats` | table | 13 | CivicGraph domain |
| `justice_matrix_gaps` | table | 13 | JusticeHub |
| `subscription_history` | table | 13 | ACT finance/bookkeeping |
| `exa_company_intelligence` | table | 12 | CivicGraph domain |
| `member_actions` | table | 12 | other tenant / unclear |
| `project_focus_areas` | table | 12 | ACT ops / project mgmt |
| `project_funding_allocations` | table | 12 | ACT ops / project mgmt |
| `tagging_sweep_runs` | table | 12 | other tenant / unclear |
| `api_pricing` | table | 11 | other tenant / unclear |
| `children_commissioner_reports` | table | 11 | CivicGraph domain |
| `organization_members` | table | 11 | other tenant / unclear |
| `partner_external_links` | table | 11 | Empathy Ledger / storytelling |
| `enrollment_codes` | table | 10 | other tenant / unclear |
| `partner_goals` | table | 10 | Empathy Ledger / storytelling |
| `scag_communiques` | table | 10 | CivicGraph domain |
| `compliance_tracking` | table | 9 | other tenant / unclear |
| `jr_evaluations` | table | 9 | JusticeHub |
| `resource_allocations` | table | 9 | other tenant / unclear |
| `review_videos` | table | 9 | Empathy Ledger / storytelling |
| `signal_events` | table | 9 | ACT ops / project mgmt |
| `auditor_general_audits` | table | 8 | CivicGraph domain |
| `funding_outcome_commitments` | table | 8 | other tenant / unclear |
| `org_grants` | table | 8 | other tenant / unclear |
| `org_referrals` | table | 8 | other tenant / unclear |
| `campaign_nomination_upvotes` | table | 7 | other tenant / unclear |
| `campaign_nominations` | table | 7 | other tenant / unclear |
| `cms_pages` | table | 7 | other tenant / unclear |
| `contained_capture_log` | table | 7 | Contained |
| `ecosystem_projects` | table | 7 | unclear |
| `ecosystem_sites` | table | 7 | unclear |
| `gmail_contacts` | table | 7 | other tenant / unclear |
| `organization_capability_profiles` | table | 7 | other tenant / unclear |
| `community_outcome_definitions` | table | 6 | other tenant / unclear |
| `daily_reflections` | table | 6 | ACT ops / project mgmt |
| `learned_thresholds` | table | 6 | other tenant / unclear |
| `mv_foundation_landscape_access` | matview | 6 | CivicGraph domain |
| `partner_videos` | table | 6 | Empathy Ledger / storytelling |
| `photo_album_photos` | table | 6 | Empathy Ledger / storytelling |
| `platform_media_items` | table | 6 | Empathy Ledger / storytelling |
| `platform_media_processing_jobs` | table | 6 | Empathy Ledger / storytelling |
| `program_summaries` | table | 6 | unclear |
| `revenue_streams` | table | 6 | ACT finance/bookkeeping |
| `scraped_services` | table | 6 | other tenant / unclear |
| `clearinghouse_documents` | table | 5 | CivicGraph domain |
| `funding_awards` | table | 5 | other tenant / unclear |
| `partner_contacts` | table | 5 | Empathy Ledger / storytelling |
| `sync_events` | table | 5 | ACT ops / project mgmt |
| `user_profiles` | table | 5 | other tenant / unclear |
| `audit_events` | table | 4 | other tenant / unclear |
| `australian_frameworks` | table | 4 | other tenant / unclear |
| `business_alerts` | table | 4 | other tenant / unclear |
| `email_response_templates` | table | 4 | other tenant / unclear |
| `jm_external_ids` | table | 4 | JusticeHub |
| `project_commentary` | table | 4 | ACT ops / project mgmt |
| `witta_contributions` | table | 4 | Harvest / farm |
| `campaign_alignment_runs` | table | 3 | other tenant / unclear |
| `funding_match_recommendations` | table | 3 | other tenant / unclear |
| `funding_outcome_updates` | table | 3 | other tenant / unclear |
| `harvest_events` | table | 3 | Harvest / farm |
| `jm_subscribers` | table | 3 | JusticeHub |
| `justice_matrix_case_campaigns` | table | 3 | JusticeHub |
| `pmpp_knowledge` | table | 3 | other tenant / unclear |
| `revenue_scenarios` | table | 3 | ACT finance/bookkeeping |
| `story_reactions` | table | 3 | Empathy Ledger / storytelling |
| `storyteller_media` | table | 3 | Empathy Ledger / storytelling |
| `storyteller_videos` | table | 3 | Empathy Ledger / storytelling |
| `sync_state` | table | 3 | ACT ops / project mgmt |
| `app_config` | table | 2 | other tenant / unclear |
| `cashflow_scenarios` | table | 2 | ACT finance/bookkeeping |
| `ce_users` | table | 2 | other tenant / unclear |
| `event_feedback` | table | 2 | other tenant / unclear |
| `funding_application_draft_workspace` | table | 2 | other tenant / unclear |
| `funding_discovery_review_workspace` | table | 2 | other tenant / unclear |
| `harvest_businesses` | table | 2 | Harvest / farm |
| `intelligence_briefings` | table | 2 | other tenant / unclear |
| `jm_result_events` | table | 2 | JusticeHub |
| `mentor_profiles` | table | 2 | other tenant / unclear |
| `organization_claims` | table | 2 | other tenant / unclear |
| `pending_form_submissions` | table | 2 | unclear |
| `photo_album_shares` | table | 2 | Empathy Ledger / storytelling |
| `photo_albums` | table | 2 | Empathy Ledger / storytelling |
| `photo_storyteller_tags` | table | 2 | Empathy Ledger / storytelling |
| `pulse_responses` | table | 2 | ACT ops / project mgmt |
| `receipt_match_history` | table | 2 | ACT finance/bookkeeping |
| `services_profiles` | table | 2 | other tenant / unclear |
| `story_comments` | table | 2 | Empathy Ledger / storytelling |
| `studio_projects` | table | 2 | ACT ops / project mgmt |
| `telegram_conversations` | table | 2 | other tenant / unclear |
| `app_users` | table | 1 | other tenant / unclear |
| `bookkeeping_sync_state` | table | 1 | ACT finance/bookkeeping |
| `event_reactions` | table | 1 | other tenant / unclear |
| `exa_api_usage` | table | 1 | CivicGraph domain |
| `gmail_auth_tokens` | table | 1 | other tenant / unclear |
| `integration_outbox` | table | 1 | other tenant / unclear |
| `intelligence_geo_alerts` | table | 1 | other tenant / unclear |
| `intelligence_refusals` | table | 1 | other tenant / unclear |
| `jm_answers` | table | 1 | JusticeHub |
| `jr_site_authorities` | table | 1 | JusticeHub |
| `knowledge_versions` | table | 1 | other tenant / unclear |
| `migration_email_templates` | table | 1 | other tenant / unclear |
| `newsletter_drafts` | table | 1 | other tenant / unclear |
| `page_gallery` | table | 1 | other tenant / unclear |
| `platform_organizations` | table | 1 | unclear |
| `privacy_settings` | table | 1 | other tenant / unclear |
| `processing_jobs` | table | 1 | other tenant / unclear |
| `project_pairings` | table | 1 | ACT ops / project mgmt |
| `project_research` | table | 1 | ACT ops / project mgmt |
| `public_spending_transactions` | table | 1 | CivicGraph domain |
| `ralph_prds` | table | 1 | ACT ops / project mgmt |
| `ralph_tasks` | table | 1 | ACT ops / project mgmt |
| `review_year_settings` | table | 1 | Empathy Ledger / storytelling |
| `user_gamification_stats` | table | 1 | other tenant / unclear |
| `xero_bas_tracking` | table | 1 | ACT finance/bookkeeping |
| `xero_sync_status` | table | 1 | ACT finance/bookkeeping |

### 3c. Dark regular views (141)

Regular views are not in `census.csv` so they carry no row count, but 141 of the 212 views in
`public` are referenced nowhere in this repo:

`accounting_summary`, `agent_health_dashboard`, `agent_status`, `agentic_project_dashboard`, `alma_cost_analysis`, `alma_media_articles_publishable`,
`auto_approval_quality`, `coe_key_people_v`, `community_engagement_overview`, `community_programs_profiles_v`, `consolidation_progress`, `coordinating_tasks`,
`current_knowledge`, `delegated_tasks`, `discrimination_aggregations_v`, `discrimination_sa3_totals_v`, `enrichment_ready_contacts`, `financial_by_account`,
`financial_monthly_summary`, `jr_site_front_door`, `knowledge_review_schedule`, `knowledge_source_health`, `migration_progress`, `missing_receipts`,
`missing_subscriptions`, `org_governance`, `partner_storytellers_v`, `pending_extractions`, `pending_proposals`, `programs_catalog_v`,
`public_media_with_collections`, `receipt_weekly_summary`, `site_latest_health`, `subscription_cost_anomalies`, `subscription_cost_by_account`, `subscription_cost_by_category`,
`subscription_payment_calendar`, `subscription_renewal_alerts`, `sync_event_statistics`, `task_queue_dashboard`, `unreconciled_financial_documents`, `unused_subscriptions`,
`v_act_procurement_buyers`, `v_activity_stream`, `v_agent_activity_summary`, `v_agentic_funding_queue`, `v_alma_current_impact`, `v_announced_money_by_kind`,
`v_awaiting_response`, `v_bgfit_budget_vs_actual`, `v_bgfit_grant_health`, `v_bgfit_pnl`, `v_bgfit_upcoming_deadlines`, `v_calendar_events_with_projects`,
`v_canonical_contacts`, `v_cashflow_summary`, `v_claim_evidence_summary`, `v_contact_communication_summary`, `v_contained_crm_organizations`, `v_contained_crm_people`,
`v_cultural_data_access`, `v_data_quality_scores`, `v_data_sufficiency`, `v_discovery_summary`, `v_duplicate_review_queue`, `v_enriched_opportunities`,
`v_entity_360`, `v_entity_name_candidates`, `v_entity_organisation_group`, `v_entity_resolution_stats`, `v_facilities_with_partnerships`, `v_finance_bank_line_evidence`,
`v_funder_next_move`, `v_funder_summary`, `v_funders_summary`, `v_funding_award_community_accountability`, `v_funding_ingest_health`, `v_funding_pipeline`,
`v_funding_program_names`, `v_grant_readiness`, `v_harvest_public_social_posts`, `v_harvest_public_stories`, `v_harvest_social_performance`, `v_harvest_upcoming_events`,
`v_justice_funding_by_org`, `v_justice_funding_by_program`, `v_justice_funding_summary`, `v_monthly_revenue`, `v_need_to_respond`, `v_newsletter_audience`,
`v_newsletter_reprompt_candidates`, `v_org_grant_health`, `v_org_upcoming_deadlines`, `v_outstanding_invoices`, `v_pending_receipts`, `v_pending_subscriptions_review`,
`v_program_deliverers`, `v_program_detail_deliverers`, `v_program_spine`, `v_project_actions`, `v_project_activity_stream`, `v_project_alignment`,
`v_project_decisions`, `v_project_financials`, `v_project_funding_position`, `v_project_health_summary`, `v_project_lifetime_position`, `v_project_pipeline_totals`,
`v_project_questions`, `v_project_relationships`, `v_project_strategic_summary`, `v_project_summary`, `v_projects_needing_attention`, `v_rd_expenses`,
`v_receipt_pipeline_funnel`, `v_recent_agent_errors`, `v_recent_communications`, `v_recent_project_knowledge`, `v_state_ecosystem_summary`, `v_subscription_alerts`,
`v_team_capacity`, `v_team_voice_notes`, `v_top_untagged`, `v_unmapped_transactions`, `v_voice_notes_cultural_review`, `v_voice_notes_with_actions`,
`v_youth_justice_recipient_stats`, `v_youth_justice_recipients`, `vw_alma_intervention_matches`, `vw_auto_mapped_contacts`, `vw_engagement_tier_stats`, `vw_exa_queue_summary`,
`vw_exa_usage_summary`, `vw_goods_enrichment_candidates`, `vw_high_value_project_matches`, `vw_justice_enrichment_candidates`, `vw_newsletter_segments`, `wiki_hierarchy`,
`xero_financial_health`, `xero_overdue_receivables`, `xero_upcoming_payables`,

### 3d. Dark empty objects (34)

`abs_raw_responses`, `bocsar_source_files`, `bocsar_youth_offending`, `community_reflections`, `compliance_ack`, `device_sessions`, `dext_supplier_setup_status`, `dream_journal`, `exhibition_service_submissions`, `idea_ack`, `idea_snoozes`, `integration_webhook_events`, `jm_answer_feedback`, `jm_eval_cases`, `jr_evidence_drafts`, `jr_outcome_evidence_links`, `jr_outcomes`, `jr_publication_snapshots`, `jr_review_decisions`, `kiosk_control_signals`, `member_wall_entries`, `network_memberships`, `organization_outreach_log`, `organization_sync_log`, `peer_validations`, `project_backers`, `qbe_evaluations`, `registered_services_profiles`, `story_related_programs`, `story_related_sites`, `telegram_mutes`, `vendor_contact_log`, `whats_new_subscribers`, `youth_survey_results`

## 4. BROKEN — referenced in code but EMPTY in the database

### 4a. Read by the web app, zero rows (24)

Every one of these is a live `.from()` or `exec_sql` target on a table with `count(*) = 0`.
Some are legitimately write-first (`report_feedback`, `data_corrections`, `entity_watches` —
empty because nobody has submitted yet); others are features whose backing pipeline never ran.

| Object | first web references |
|---|---|
| `act_ask_artefacts` | `apps/web/src/lib/services/act-ask-artefacts.ts` |
| `act_ask_warmers` | `apps/web/src/app/org/[slug]/people/people-actions.tsx`; `apps/web/src/app/api/org/[orgProfileId]/people/route.ts`; `apps/web/src/app/api/org/[orgProfileId]/people/search/route.ts` |
| `act_community_links` | `apps/web/src/lib/services/act-communities.ts` |
| `act_obligations` | `apps/web/src/app/api/org/[orgProfileId]/obligations/route.ts`; `apps/web/src/lib/services/act-communities.ts`; `apps/web/src/lib/services/act-obligations.ts` |
| `act_people` | `apps/web/src/app/org/[slug]/people/page.tsx`; `apps/web/src/app/api/org/[orgProfileId]/people/route.ts`; `apps/web/src/app/api/org/[orgProfileId]/people/search/route.ts` |
| `act_person_roles` | `apps/web/src/app/api/org/[orgProfileId]/people/route.ts`; `apps/web/src/lib/services/act-people.ts` |
| `alert_notifications` | `apps/web/src/lib/grant-alert-digests.ts` |
| `api_keys` | `apps/web/src/app/api/admin/api-usage/route.ts`; `apps/web/src/app/api/agent/keys/route.ts`; `apps/web/src/app/api/agent/usage/route.ts` |
| `ask_grantscope_corrections` | `apps/web/src/lib/services/ask-grantscope-corrections.ts` |
| `data_corrections` | `apps/web/src/app/api/data/corrections/route.ts` |
| `digest_log` | `apps/web/src/app/org/[slug]/digest-preview/page.tsx`; `apps/web/src/lib/services/act-desk-digest.ts` |
| `entity_watches` | `apps/web/src/app/home/watchlist/page.tsx`; `apps/web/src/app/api/watches/[watchId]/route.ts`; `apps/web/src/app/api/watches/digest/route.ts` |
| `foundation_notes` | `apps/web/src/app/api/foundations/notes/route.ts` |
| `funding_ghl_callback_events` | `apps/web/src/app/api/integrations/ghl/funding-callback/route.ts` |
| `funding_ghl_handoffs` | `apps/web/src/app/api/integrations/ghl/funding-callback/route.ts`; `apps/web/src/lib/services/funding-ghl.ts`; `apps/web/src/lib/services/funding-notion.ts` |
| `ghl_task_bridge` | `apps/web/src/lib/services/act-ghl-task-bridge.ts` |
| `goods_cost_allocation_decisions` | `apps/web/src/lib/services/goods-cost-evidence.ts` |
| `goods_deployment_batches` | `apps/web/src/app/api/goods/community/[id]/deploy/route.ts`; `apps/web/src/lib/services/goods-community-detail.ts`; `apps/web/src/lib/services/goods-living-data-adapter.ts` |
| `goods_route_allocations` | `apps/web/src/app/org/[slug]/goods/capital/actions.ts`; `apps/web/src/lib/services/goods-capital-workspace.ts`; `apps/web/src/lib/services/goods-grant-notion.ts` |
| `mv_indigenous_funding_by_disadvantage` | `apps/web/src/app/reports/funding-equity/page.tsx` |
| `pilot_participants` | `apps/web/src/app/api/ops/pilots/[pilotId]/route.ts`; `apps/web/src/app/api/ops/pilots/route.ts`; `apps/web/src/app/api/ops/route.ts` |
| `report_feedback` | `apps/web/src/app/account/page.tsx`; `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/feedback/actions.ts` |
| `report_submissions` | `apps/web/src/app/account/page.tsx`; `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/get-a-report/actions.ts` |
| `validation_reviews` | `apps/web/src/app/api/ops/route.ts`; `apps/web/src/app/api/ops/validation-reviews/import/route.ts` |

### 4b. Written/created by pipeline or migrations, zero rows (14)

| Object | where |
|---|---|
| `archival_memory` | `scripts/create-archival-memory.sql` |
| `enrichment_candidates` | `scripts/enrich-from-sn13.mjs`; `thoughts/plans/bittensor-integration-spec.md` |
| `founder_intake_signals` | `scripts/create-founder-intakes.sql` |
| `funder_portfolio_entities` | `scripts/create-funder-portfolios.sql`; `scripts/dedup-entities.mjs` |
| `funder_portfolios` | `scripts/create-funder-portfolios.sql`; `thoughts/shared/handoffs/p0-revenue-features/current.md` |
| `mv_api_usage_daily` | `scripts/migrations/create-api-keys.sql`; `thoughts/shared/handoffs/qld-accountability-tracker/current.md` |
| `ndis_plan_budgets` | `scripts/migrations/create-ndis-tables.sql`; `thoughts/shared/handoffs/frontend-data-audit/db-inventory.md` |
| `ndis_sda` | `scripts/migrations/create-ndis-tables.sql`; `thoughts/shared/handoffs/frontend-data-audit/db-inventory.md` |
| `nz_gets_contracts` | `scripts/dedup-entities.mjs`; `scripts/sql/dedup-null-abn-pairs.sql` |
| `procurement_notification_outbox` | `scripts/check-contract-alerts.mjs`; `supabase/migrations/20260311_procurement_outbound_and_pending_invites.sql` |
| `bgfit_financial_periods` | `scripts/watch-schema-health.mjs` |
| `record_grants` | `scripts/scrape-vic-dept-annual-reports.mjs` |
| `abs_indigenous_population_by_lga` | `apps/web/src/lib/services/school-need-signal.ts` |
| `ndis_providers` | `scripts/migrations/create-ndis-tables.sql`; `apps/web/src/app/reports/ndis/page.tsx` |

### 4c. Queried in code but the object DOES NOT EXIST in `public` at all (11)

These are `.from('…')` targets that are absent from the 812-object census *and* from the 212-view list.

| Target | called from |
|---|---|
| `acnc_responsible_persons` | `scripts/scrape-acnc-persons.mjs` |
| `community_feedback` | `apps/web/src/app/api/feedback/route.ts` (line 91, `.insert`) |
| `dedup_recommendations` | `scripts/dedup-entities-local.mjs` |
| `grants` | `apps/web/src/app/api/grants/send/route.ts:20`, `apps/web/src/app/reports/power-map/page.tsx:26` |
| `opensanctions_matches` | `scripts/match-opensanctions.mjs` |
| `org_journeys` | `apps/web/src/lib/services/journey-service.ts` |
| `org_journey_personas` | `apps/web/src/lib/services/journey-service.ts` |
| `org_journey_steps` | `apps/web/src/lib/services/journey-service.ts` |
| `org_journey_matches` | `apps/web/src/lib/services/journey-service.ts` |
| `org_journey_messages` | `apps/web/src/lib/services/journey-service.ts` |
| `reports` | `apps/web/src/app/giving/page.tsx:83`, `apps/web/src/app/api/data/route.ts:597` |

## 5. Table → where used (the objects that matter)

Top 80 populated objects by row count, with classification and the files that touch them.

| Object | rows | class | representative call sites |
|---|---|---|---|
| `abr_registry` | 20,006,350 | WEB_MENTION_ONLY | `scripts/backfill-oric-abns.mjs`; `scripts/backfill-qgip-abns.mjs`; `scripts/backfill-se-abns-fuzzy.mjs` |
| `mv_abr_name_lookup` | 9,038,737 | PIPELINE_ONLY | `scripts/refresh-views-v2.mjs`; `scripts/refresh-views.mjs`; `scripts/sql/backfill-oric-abns.sql` |
| `gs_relationships` | 3,429,184 | WEB_READ | `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/entities/page.tsx` |
| `political_donations` | 2,549,483 | WEB_READ | `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/entity/[gsId]/page.tsx` |
| `asic_companies` | 2,167,533 | WEB_READ | `apps/web/src/app/ops/health/[dataset]/page.tsx`; `apps/web/src/app/reports/cross-reference/page.tsx`; `apps/web/src/app/reports/power-map/page.tsx` |
| `asic_name_lookup` | 2,149,868 | WEB_MENTION_ONLY | `supabase/migrations/20260308_donor_entity_matching.sql` |
| `privacy_audit_log` | 1,278,440 | PIPELINE_MENTION | `—` |
| `entity_xref` | 1,211,744 | WEB_MENTION_ONLY | `scripts/migrations/entity-xref-v2.sql`; `scripts/migrations/fix-act-company-entity-20260427.sql`; `scripts/refresh-entity-xref.mjs` |
| `austender_contracts` | 823,620 | WEB_READ | `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx` |
| `gs_entities` | 609,448 | WEB_READ | `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx` |
| `gs_entities_lga_backup_20260808` | 609,416 | DDL_ONLY | `supabase/migrations/20260808130000_resolve_or_null_entity_lga.sql` |
| `mv_gs_entity_stats` | 400,276 | WEB_READ | `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/api/data/schema-graph/route.ts`; `apps/web/src/app/api/entities/[gsId]/money/route.ts` |
| `acnc_ais` | 360,488 | WEB_READ | `apps/web/src/app/architecture/page.tsx`; `apps/web/src/app/charities/[abn]/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx` |
| `gs_entities_lga_backup_20260809b` | 358,347 | DDL_ONLY | `supabase/migrations/20260809100000_own_name_city_repair.sql` |
| `gs_entities_lga_backup_20260809c` | 355,797 | DDL_ONLY | `supabase/migrations/20260809110000_reason_codes_and_suffix_repair.sql` |
| `mv_charity_network` | 351,455 | PIPELINE_MENTION | `supabase/migrations/20260331_charity_rankings.sql` |
| `person_roles` | 339,698 | WEB_READ | `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/entity/[gsId]/investigate/page.tsx`; `apps/web/src/app/entity/[gsId]/page.tsx` |
| `mv_person_entity_network` | 336,444 | WEB_READ | `apps/web/src/app/org/[slug]/goods/intros/page.tsx`; `apps/web/src/app/person/[name]/page.tsx`; `apps/web/src/app/api/data/person/route.ts` |
| `mv_person_entity_crosswalk` | 331,239 | WEB_READ | `apps/web/src/lib/services/org-dashboard-service.ts`; `scripts/migrations/foundation-intelligence-expansion.sql`; `scripts/migrations/person-enrichment.sql` |
| `mv_person_identity_network` | 328,939 | WEB_READ | `apps/web/src/app/person/[name]/page.tsx`; `apps/web/src/app/api/power/holders/route.ts`; `supabase/migrations/20260619130000_person_identity_mvs.sql` |
| `grantconnect_awards` | 291,264 | WEB_READ | `apps/web/src/app/api/data/map/route.ts`; `apps/web/src/app/api/data/place/[code]/route.ts`; `apps/web/src/lib/atlas/story.test.ts` |
| `mv_person_identity_influence` | 241,269 | WEB_READ | `apps/web/src/app/person/[name]/page.tsx`; `apps/web/src/app/api/data/person/route.ts`; `supabase/migrations/20260619130000_person_identity_mvs.sql` |
| `mv_person_identity_influence_v2` | 241,260 | WEB_READ | `apps/web/src/app/api/power/holders/route.ts` |
| `mv_person_network` | 237,990 | WEB_READ | `apps/web/src/app/reports/power-network/page.tsx`; `apps/web/src/app/reports/reallocation-atlas/page.tsx`; `scripts/migrations/create-person-network.sql` |
| `mv_person_influence` | 237,340 | WEB_READ | `apps/web/src/app/reports/multicultural-sector/fecca-eccv/page.tsx`; `apps/web/src/app/reports/multicultural-sector/page.tsx`; `apps/web/src/app/reports/youth-justice/qld/sector/long-read/page.tsx` |
| `mv_donation_contract_timing` | 232,474 | WEB_READ | `apps/web/src/app/reports/double-dippers/page.tsx`; `apps/web/src/app/reports/timing/page.tsx`; `supabase/migrations/20260314_temporal_donation_contracts.sql` |
| `person_identities` | 230,434 | PIPELINE_ONLY | `scripts/build-person-identities.mjs`; `scripts/refresh-views-v2.mjs`; `supabase/migrations/20260619120000_person_identities.sql` |
| `state_tenders` | 199,719 | WEB_READ | `apps/web/src/app/reports/state-procurement/page.tsx`; `apps/web/src/app/reports/youth-justice/qld/crime-prevention-schools/page.tsx`; `apps/web/src/app/reports/youth-justice/qld/tracker/page.tsx` |
| `mv_entity_power_index` | 188,139 | WEB_READ | `apps/web/src/app/entity/[gsId]/investigate/page.tsx`; `apps/web/src/app/entity/[gsId]/page.tsx`; `apps/web/src/app/entity/[gsId]/print/page.tsx` |
| `justice_funding` | 157,116 | WEB_READ | `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx` |
| `ndis_utilisation` | 143,987 | WEB_READ | `apps/web/src/app/graph/page.tsx`; `apps/web/src/app/reports/disability/page.tsx`; `apps/web/src/app/reports/ndis/page.tsx` |
| `ndis_active_providers` | 134,572 | WEB_READ | `apps/web/src/app/reports/ndis/page.tsx`; `scripts/import-ndis-provider-market.mjs`; `scripts/migrations/ingest-ndis-providers.sql` |
| `dss_payment_demographics` | 105,529 | WEB_READ | `apps/web/src/app/reports/youth-justice/qld/sector/page.tsx`; `apps/web/src/lib/services/place-data-service.ts`; `apps/web/src/lib/services/report-service.ts` |
| `organizations` | 104,427 | WEB_READ | `apps/web/src/app/entities/[gsId]/_components/evidence-tab.tsx`; `apps/web/src/app/entities/[gsId]/_components/overview-tab.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx` |
| `gs_entities_lga_backup_20260809` | 98,660 | DDL_ONLY | `supabase/migrations/20260809070000_place_single_council_postcodes.sql` |
| `acnc_programs` | 98,381 | WEB_MENTION_ONLY | `scripts/export-to-kb.mjs`; `scripts/ingest-acnc-ais.mjs`; `scripts/migrations/create-acnc-ais.sql` |
| `mv_entity_total_funding` | 94,088 | PIPELINE_ONLY | `scripts/refresh-total-funding-mv.mjs`; `migrations/mv_entity_total_funding.sql` |
| `mv_foundation_regranting` | 85,401 | WEB_READ | `apps/web/src/app/foundation/[abn]/page.tsx`; `apps/web/src/app/api/data/graph/route.ts`; `apps/web/src/app/api/data/schema-graph/route.ts` |
| `mv_trustee_grantee_chain` | 79,535 | WEB_READ | `apps/web/src/app/foundation/[abn]/page.tsx`; `apps/web/src/app/reports/philanthropy/page.tsx`; `scripts/migrations/foundation-intelligence-expansion.sql` |
| `community_directory_orgs` | 76,151 | PIPELINE_ONLY | `scripts/classify-directory-se-candidates.mjs`; `supabase/migrations/20260809200000_oric_abn_dedup_tranche1.sql` |
| `ndis_participants` | 67,353 | WEB_READ | `apps/web/src/app/graph/page.tsx`; `apps/web/src/app/places/[postcode]/page.tsx`; `apps/web/src/app/reports/convergence/page.tsx` |
| `acnc_charities` | 66,023 | WEB_READ | `apps/web/src/app/changes/page.tsx`; `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/entity/[gsId]/page.tsx` |
| `mv_org_justice_signals` | 66,023 | WEB_MENTION_ONLY | `—` |
| `mv_acnc_latest` | 63,555 | PIPELINE_MENTION | `supabase/migrations/20260303_acnc_charities.sql`; `supabase/migrations/20260303_charity_sector_snapshot.sql`; `supabase/migrations/20260304_charity_detail_view.sql` |
| `assertions` | 59,300 | WEB_MENTION_ONLY | `—` |
| `crime_stats_lga` | 58,125 | WEB_READ | `apps/web/src/app/place/far-west-coast/page.tsx`; `apps/web/src/lib/services/council-place-report.ts`; `apps/web/src/lib/services/place-data-service.ts` |
| `source_frontier` | 56,081 | WEB_READ | `apps/web/src/app/home/page.tsx`; `apps/web/src/app/reports/grant-frontier/page.tsx`; `apps/web/src/app/api/home/pre-sweep/route.ts` |
| `mv_foundation_trends` | 53,985 | WEB_READ | `apps/web/src/app/foundation/[abn]/page.tsx`; `scripts/migrations/foundation-trends.sql`; `scripts/refresh-views-v2.mjs` |
| `procurement_alerts` | 53,223 | PIPELINE_ONLY | `scripts/check-contract-alerts.mjs`; `scripts/check-donor-contract-crossover.mjs`; `scripts/watch-schema-health.mjs` |
| `mv_fy_donation_contracts` | 50,685 | DDL_ONLY | `supabase/migrations/20260314_temporal_donation_contracts.sql` |
| `ndis_registered_providers` | 48,510 | WEB_READ | `apps/web/src/app/reports/ndis/page.tsx`; `scripts/dedup-entities.mjs`; `scripts/import-ndis-provider-register.mjs` |
| `research_grants` | 46,378 | WEB_READ | `apps/web/src/app/reports/research-funding/page.tsx`; `scripts/dedup-entities.mjs`; `scripts/import-arc-grants.mjs` |
| `nz_charities` | 45,192 | WEB_MENTION_ONLY | `scripts/dedup-entities.mjs`; `scripts/import-nz-charities.mjs`; `scripts/sql/dedup-null-abn-pairs.sql` |
| `foundation_category_assignments` | 42,599 | UNREFERENCED | `—` |
| `mv_charity_rankings` | 42,503 | WEB_READ | `apps/web/src/app/entity/[gsId]/page.tsx`; `apps/web/src/app/api/data/rankings/route.ts`; `supabase/migrations/20260331_charity_rankings.sql` |
| `money_flows` | 42,468 | WEB_READ | `apps/web/src/app/architecture/page.tsx`; `apps/web/src/app/how-it-works/diagram.tsx`; `apps/web/src/app/how-it-works/page.tsx` |
| `mv_board_interlocks` | 39,757 | WEB_READ | `apps/web/src/app/org/[slug]/goods/intros/page.tsx`; `apps/web/src/app/reports/reallocation-atlas/page.tsx`; `apps/web/src/app/reports/who-runs-australia/page.tsx` |
| `gs_entities_reason_backup_20260809b` | 39,450 | DDL_ONLY | `supabase/migrations/20260809160000_empty_state_repair_and_poa_nolocality.sql` |
| `mv_funding_outcomes_summary` | 39,432 | WEB_READ | `apps/web/src/app/api/outcomes/portfolio/route.ts`; `scripts/migrations/sprint4-outcomes-linkage.sql`; `scripts/refresh-views.mjs` |
| `mv_board_power` | 38,199 | WEB_READ | `apps/web/src/app/api/data/board-power/route.ts`; `supabase/migrations/20260331_charity_rankings.sql` |
| `page_views` | 38,115 | PIPELINE_MENTION | `—` |
| `communications_history` | 31,961 | WEB_READ | `apps/web/src/lib/services/act-people-directory.ts` |
| `entity_identifiers` | 31,451 | WEB_MENTION_ONLY | `scripts/dedup-entities.mjs`; `scripts/enrich-entity-identifiers.mjs`; `scripts/enrich-from-oric.mjs` |
| `ato_tax_transparency` | 26,241 | WEB_READ | `apps/web/src/app/entity/[gsId]/page.tsx`; `apps/web/src/app/ops/health/[dataset]/page.tsx`; `apps/web/src/app/reports/cross-reference/page.tsx` |
| `grant_opportunities` | 25,897 | WEB_READ | `apps/web/src/app/architecture/page.tsx`; `apps/web/src/app/briefing/page.tsx`; `apps/web/src/app/dashboard/page.tsx` |
| `webhook_delivery_log` | 25,792 | PIPELINE_MENTION | `—` |
| `goods_supply_routes` | 23,873 | PIPELINE_ONLY | `scripts/goods-supply-chain-analyst.mjs`; `scripts/import-agil-communities.mjs`; `supabase/migrations/20260313_goods_intelligence_layer.sql` |
| `rogs_justice_spending` | 22,364 | WEB_READ | `apps/web/src/app/ops/health/[dataset]/page.tsx`; `apps/web/src/app/reports/convergence/page.tsx`; `scripts/import-ctg-youth-justice.mjs` |
| `act_grant_recommendations` | 22,252 | WEB_READ | `apps/web/src/app/home/home-client.tsx`; `apps/web/src/app/org/[slug]/pipeline/page.tsx`; `apps/web/src/app/reports/grant-frontier/page.tsx` |
| `knowledge_chunks` | 19,413 | WEB_READ | `apps/web/src/app/api/profile/enrich/route.ts`; `scripts/process-justicehub-knowledge.mjs`; `scripts/watch-schema-health.mjs` |
| `opportunities_unified` | 17,790 | WEB_MENTION_ONLY | `—` |
| `foundation_geo_focus` | 16,942 | UNREFERENCED | `—` |
| `_backup_entity_contacts_20260606` | 16,664 | UNREFERENCED | `—` |
| `gs_entity_aliases` | 16,646 | WEB_MENTION_ONLY | `scripts/benchmark/evaluate.mjs`; `scripts/benchmark/tasks/entity-resolution/program.md`; `scripts/dedup-entities.mjs` |
| `abs_locality_lga` | 16,637 | WEB_READ | `apps/web/src/lib/services/council-place-report.ts`; `apps/web/src/lib/services/place-data-service.ts`; `scripts/fetch-oric-addresses.mjs` |
| `abs_sal_lga_ratio` | 16,372 | DDL_ONLY | `supabase/migrations/20260809130000_abs_correspondence_ratios.sql`; `supabase/migrations/20260809140000_straddler_ratio_refill.sql`; `supabase/migrations/20260809190000_gazetteer_round_one_b.sql` |
| `canonical_entities` | 15,324 | PIPELINE_ONLY | `scripts/dedup-entities.mjs`; `scripts/enrich-justicehub.mjs`; `scripts/run-bridge-fuzzy.mjs` |
| `mv_foundation_grantees` | 15,003 | WEB_READ | `apps/web/src/app/foundation/[abn]/page.tsx`; `apps/web/src/app/api/data/graph/route.ts`; `apps/web/src/app/api/data/schema-graph/route.ts` |
| `person_identity_map` | 14,919 | WEB_READ | `apps/web/src/app/api/contacts/analyze/route.ts`; `apps/web/src/app/api/data/schema-graph/route.ts`; `apps/web/src/app/api/org/[orgProfileId]/contacts/link-notion/route.ts` |
| `ndis_market_concentration` | 14,915 | WEB_READ | `apps/web/src/app/entities/[gsId]/page.tsx`; `apps/web/src/app/places/[postcode]/page.tsx`; `apps/web/src/app/reports/ndis-market/page.tsx` |

## 6. Pipeline-only objects (written by `scripts/`, never surfaced to a user)

| Object | kind | rows | pipeline owner |
|---|---|---|---|
| `mv_abr_name_lookup` | matview | 9,038,737 | `scripts/refresh-views-v2.mjs`; `scripts/refresh-views.mjs` |
| `person_identities` | table | 230,434 | `scripts/build-person-identities.mjs`; `scripts/refresh-views-v2.mjs` |
| `mv_entity_total_funding` | matview | 94,088 | `scripts/refresh-total-funding-mv.mjs` |
| `community_directory_orgs` | table | 76,151 | `scripts/classify-directory-se-candidates.mjs` |
| `procurement_alerts` | table | 53,223 | `scripts/check-contract-alerts.mjs`; `scripts/check-donor-contract-crossover.mjs` |
| `goods_supply_routes` | table | 23,873 | `scripts/goods-supply-chain-analyst.mjs`; `scripts/import-agil-communities.mjs` |
| `canonical_entities` | table | 15,324 | `scripts/dedup-entities.mjs`; `scripts/enrich-justicehub.mjs` |
| `mv_foundation_readiness` | matview | 10,464 | `scripts/discover-foundation-grantees.mjs`; `scripts/migrations/foundation-readiness.sql` |
| `name_aliases` | table | 8,046 | `scripts/link-act-crm-entities.mjs`; `scripts/migrations/universal-linkage-sweep-2-fuzzy.sql` |
| `postcode_sa2_concordance` | table | 7,261 | `scripts/build-sa2-postcode-concordance.py`; `scripts/fix-empty-sa2-concordance.py` |
| `sa2_reference` | table | 2,473 | `scripts/build-sa2-postcode-concordance.py`; `scripts/fix-empty-sa2-concordance.py` |
| `mv_yj_report_state_program_partners` | matview | 2,352 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `ndis_compliance_actions` | table | 2,322 | `scripts/ingest-ndis-compliance.mjs`; `scripts/sql/create-ndis-compliance-actions.sql` |
| `mv_refresh_log` | table | 2,260 | `scripts/health-check.mjs`; `scripts/refresh-views-v2.mjs` |
| `mv_yj_report_recipients` | matview | 1,548 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `agil_locations` | table | 1,546 | `scripts/import-agil-communities.mjs`; `scripts/ingest-agil.mjs` |
| `mv_individual_donors` | matview | 1,041 | `scripts/migrations/create-person-cross-system.sql`; `scripts/refresh-views.mjs` |
| `mv_yj_report_alma_interventions` | matview | 581 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `contact_intelligence` | table | 509 | `scripts/enrich-entity-contacts.mjs` |
| `se_buyer_prospects` | table | 438 | `scripts/scout-se-buyers.mjs` |
| `wiki_pages` | table | 413 | `scripts/process-justicehub-knowledge.mjs`; `scripts/watch-schema-health.mjs` |
| `mv_yj_report_heatmap` | matview | 361 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `user_grant_tracking` | table | 234 | `scripts/migrations/20260310_alert_system.sql` |
| `mv_yj_report_foundations` | matview | 196 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `gs_graph_completeness_log` | table | 169 | `scripts/check-graph-completeness.mjs` |
| `person_role_holdings` | table | 126 | `scripts/build-orbit-soil.mjs` |
| `mv_yj_report_contracts` | matview | 99 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `nt_communities` | table | 75 | `scripts/seed-goods-communities.mjs`; `scripts/watch-schema-health.mjs` |
| `mv_yj_report_state_programs` | matview | 52 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `act_opportunity_observatory` | table | 47 | `scripts/discover-act-opportunities.mjs`; `scripts/research-project-funding.mjs` |
| `coroners_findings` | table | 39 | `scripts/migrations/2026-05-01-bills-coroners-jurisdiction.sql` |
| `grant_source_plugins` | table | 32 | `packages/grant-engine/src/storage/repository.ts` |
| `data_catalog` | table | 25 | `scripts/snapshot-data-catalog.mjs` |
| `mv_yj_report_dss_payments` | matview | 24 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `mmr_unspsc_categories` | table | 19 | `scripts/migrations/anao-indigenous-procurement.sql`; `scripts/watch-schema-health.mjs` |
| `knowledge_extraction_queue` | table | 14 | `scripts/upload-justicehub-knowledge.mjs`; `scripts/watch-schema-health.mjs` |
| `justice_reinvestment_sites` | table | 13 | `scripts/dedup-entities.mjs`; `scripts/seed-jr-sites.mjs` |
| `knowledge_sources` | table | 12 | `scripts/process-justicehub-knowledge.mjs`; `scripts/upload-justicehub-knowledge.mjs` |
| `mv_yj_report_ndis_overlay` | matview | 10 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `ti_usage_log` | table | 10 | `scripts/migrations/20260310_ti_usage_log.sql` |
| `story_analysis` | table | 9 | `scripts/health-check.mjs` |
| `tour_stops` | table | 9 | `scripts/health-check.mjs` |
| `mv_yj_report_remoteness` | matview | 5 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `procurement_shortlist_items` | table | 5 | `scripts/check-contract-alerts.mjs`; `scripts/watch-schema-health.mjs` |
| `mv_yj_report_coverage` | matview | 1 | `scripts/build-youth-justice-report-snapshot.mjs`; `scripts/refresh-youth-justice-report-cache.mjs` |
| `procurement_shortlist_watches` | table | 1 | `scripts/check-contract-alerts.mjs` |
| `v_entity_funding_mix` | view | view | `scripts/migrations/2026-04-29-funding-tracking.sql` |
| `v_funding_outcomes_chain` | view | view | `scripts/migrations/sprint4-outcomes-linkage.sql` |
| `v_ndis_market_concentration_hotspots` | view | view | `scripts/power-coverage-brief.mjs` |

## 7. `WEB_MENTION_ONLY` — hand adjudication of all 44

| Object | rows | verdict |
|---|---|---|
| `abr_registry` | 20,006,350 | REAL READ — dataset registry entry in `api/mission-control/route.ts:56` (`table:'abr_registry'`, dynamic `.from(table)`) and domain map in `api/data/schema-graph/route.ts:35` |
| `asic_name_lookup` | 2,149,868 | REAL READ — same two registries |
| `entity_xref` | 1,211,744 | REAL — `api/data/schema-graph` domain map only (graph node, not queried) |
| `acnc_programs` | 98,381 | REAL READ — mission-control dataset registry |
| `mv_org_justice_signals` | 66,023 | REAL — schema-graph node |
| `assertions` | 59,300 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `nz_charities` | 45,192 | REAL READ — mission-control dataset registry (`countMode:'estimated'`) |
| `entity_identifiers` | 31,451 | REAL READ — schema-graph node + `briefing/page.tsx` |
| `opportunities_unified` | 17,790 | REAL — schema-graph node |
| `gs_entity_aliases` | 16,646 | REAL — schema-graph node |
| `se_search_index` | 12,180 | REAL — comment in `supplier-search.ts`; the actual read is the `search_suppliers` RPC over it |
| `donor_entity_matches` | 10,264 | REAL — schema-graph node |
| `campaign_alignment_entities` | 4,141 | REAL — schema-graph node |
| `asx_companies` | 2,036 | REAL READ — `ops/health/[dataset]` + `api/data/health` |
| `alma_research_findings` | 979 | REAL — schema-graph node |
| `transcripts` | 208 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `alma_government_programs` | 207 | REAL — schema-graph node |
| `alma_program_interventions` | 192 | REAL — schema-graph node |
| `touchpoints` | 170 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `projects` | 81 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `notion_projects` | 80 | REAL READ — `opportunity-intelligence.ts` |
| `ghl_tags` | 72 | REAL READ — `goods-funder-scan.ts` |
| `subscriptions` | 68 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `articles` | 49 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `notion_grants` | 37 | REAL READ — `opportunity-intelligence.ts` |
| `quotes` | 37 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `reminders` | 27 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `sync_status` | 25 | REAL READ — `act-opportunity-context.ts`, `funding-ghl.ts` |
| `portraits` | 21 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `users` | 17 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `sessions` | 14 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `agents` | 13 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `events` | 13 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `stories` | 9 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `photos` | 7 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `act_research_experiments` | 5 | REAL READ — `act-research.ts` |
| `data_sources` | 5 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `place_funding_snapshot` | 5 | REAL READ — via helper in `place-intelligence.ts` |
| `authors` | 1 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `metrics` | 1 | FALSE POSITIVE — generic English word matching a table name; the code hits are variables/props, not DB reads. Treat as **dark**. |
| `abs_indigenous_population_by_lga` | 0 | BROKEN — empty table, named in `school-need-signal.ts` |
| `ndis_providers` | 0 | BROKEN — empty table, named in `reports/ndis/page.tsx` |
| `v_acco_yj_retention_qld` | view | REAL — cited as a source label in the QLD sector report; the query lives in the snapshot builder |
| `v_goods_community_priority` | view | REAL READ — `fetchChunked(db,'v_goods_community_priority',…)` in `goods-communities-hub.ts:120` (helper takes the table name as an argument, so `.from(` never appears) |


## 8. Data maps that already exist in this repo

Four partial "map of the data" artefacts already exist. All four are stale, and none of them
covers more than ~5% of the 1,024 objects.

| Artefact | What it is | Coverage | Staleness |
|---|---|---|---|
| `apps/web/src/app/api/data/schema-graph/route.ts` (280 lines) | **The closest thing to what Ben is asking for.** Returns the data model as a graph — tables as nodes (with live record counts and a `domain` classification), edges from foreign keys plus inferred ABN / entity_id / postcode joins. Its own header comment says it "powers the interactive Obsidian-style schema visualization on **/clarity**". | 36 tables hand-classified into 9 domains (Entity Graph, Registries, Procurement, Funding, Influence, People, Evidence, Social, Quality) | **Orphaned — there is no `/clarity` route in `apps/web/src/app`, and no file anywhere in the repo fetches `/api/data/schema-graph`.** One of its nodes, `mv_person_directory`, does not exist in the database. |
| `apps/web/src/app/api/mission-control/route.ts` (277 lines) | A dataset registry: 33 entries of `{key, label, table, category, countMode, freshnessCol}` driving live row counts + freshness per dataset. Backs `/mission-control`. | 33 tables | Live and working, but 33 of 724 populated objects = **4.6% coverage** |
| `apps/web/src/app/api/ask/route.ts` (756 lines) | The schema prompt handed to the LLM for natural-language querying. Hand-written column lists per table. | ~15 tables + 5 MVs | **Row counts are badly stale**: says `justice_funding ~71K` (actual 157,116), `political_donations ~312K` (actual 2,549,483), `person_roles ~5.4K` (actual 339,698), `alma_interventions ~1,155`. The LLM is being told the database is ~10× smaller than it is. |
| `thoughts/shared/handoffs/frontend-data-audit/db-inventory.md` + `frontend-inventory.md` (2026-04-02) | A written inventory: "491 public tables, ~48 matviews, ~32M rows, 587K entities, 1.53M relationships". | ~60 tables described in prose | 4.5 months stale — the database has since grown to 812 tables+matviews, 98 matviews, 52.3M rows, 609K entities, 3.43M relationships |
| `COMPENDIUM.md` (2026-03-10), `CLAUDE.md` "Key Tables Reference" | Prose architecture references | ~20 tables | Both materially wrong on row counts (see `GROUND_TRUTH.md`) |

Also present but unread: the DB has its own catalogue tables — `data_catalogue` (261 rows: jurisdiction,
title, publisher, licence, landing_page, formats, `indigenous_breakdown`, `youth_focused`),
`data_sources_inventory` (63), `data_catalog` (25, written by `scripts/snapshot-data-catalog.mjs`),
`v_data_catalog_latest` (read by `/api/data/catalog` and `/giving/quality`), plus `data_gap_questions`
(126) and `data_agent_findings` (161). Three of those six are read by nothing.

## 9. The `/reports` gate — 124 objects behind an off-by-default flag

`/reports` is the largest route family by data surface (124 objects reachable). It is also the one
whose reads are **switched off by default**.

`apps/web/src/lib/supabase.ts:153-158` — `getServiceSupabase()` inspects the JavaScript call stack
and, if the caller's stack contains `/app/reports/`, returns `reportSnapshotSupabase`: a Proxy whose
`.from()` and `.rpc()` resolve to `{data: null, error: null, count: 0}`. The only escape is
`process.env.CIVICGRAPH_LIVE_REPORTS === 'true'`.

`apps/web/src/lib/report-supabase.ts` layers a second gate for build time
(`CIVICGRAPH_BUILD_LIVE_REPORTS`).

Consequences, in order of confidence:
- **Verified:** 12 report pages opt out by calling `getLiveReportSupabase()` explicitly —
  `reports/youth-justice/qld/{sector,sector/long-read,tracker,watchhouse-data}`,
  `reports/youth-justice/[state]/sector`, `reports/multicultural-sector{,/fecca-eccv,/fecca-eccv/long-read}`,
  `reports/grant-frontier`, `reports/civicgraph-thesis` path via `qld-yj-recipient.ts`,
  `share/fecca-eccv/people/[slug]`, `changes`.
- **Verified:** several report pages branch on `LIVE_REPORTS` and fall back to hardcoded literals —
  `reports/power-dynamics`, `reports/social-enterprise`, `reports/philanthropy`,
  `reports/funding-equity`, `reports/youth-justice/page.tsx:525`.
- **Verified:** the only snapshot file on disk is `data/report-snapshots/youth-justice.json`
  (1.1 MB, **last written 30 April 2026**), produced by `scripts/build-youth-justice-report-snapshot.mjs`.
- **Inferred, not verified:** the remaining `/reports/*` pages therefore render from constants or
  from a stale April snapshot rather than the live database. I did not check the Vercel production
  environment, so I cannot say whether `CIVICGRAPH_LIVE_REPORTS=true` is set there. It is not in
  the local `.env`, `vercel.json`, or any committed config.

The 8 `mv_yj_report_*` matviews (`_recipients` 1,548, `_state_program_partners` 2,352, `_heatmap` 361,
`_foundations` 196, `_contracts` 99, `_state_programs` 52, `_dss_payments` 24, `_ndis_overlay` 10,
`_remoteness` 5, `_coverage` 1) are classified **pipeline-only**: `build-youth-justice-report-snapshot.mjs`
and `refresh-youth-justice-report-cache.mjs` read them into the JSON snapshot; the web app names only
`mv_yj_report_acco_gap`, `mv_yj_report_unfunded_programs`, `mv_yj_report_alma_type_counts` and
`mv_yj_report_state_top_orgs` (as source citations in the QLD sector report).

## 10. Duplication and cruft worth deleting

**Person-graph matview sprawl — 7 near-identical objects, all read by the web app:**

| Object | rows | class |
|---|---|---|
| `mv_person_entity_network` | 336,444 | WEB_READ |
| `mv_person_entity_crosswalk` | 331,239 | WEB_READ |
| `mv_person_identity_network` | 328,939 | WEB_READ |
| `mv_person_identity_influence` | 241,269 | WEB_READ |
| `mv_person_identity_influence_v2` | 241,260 | WEB_READ |
| `mv_person_network` | 237,990 | WEB_READ |
| `mv_person_influence` | 237,340 | WEB_READ |

`mv_person_identity_influence` and `_v2` differ by 9 rows. Memory says the `_v2` de-collide was applied
2026-06-21, which implies the non-`_v2` original should have been dropped — it was not, and both are
still queried from the app. I did not diff their definitions; **which one is authoritative is unverified.**

**Backup tables still carrying 1.3M rows** (all `DDL_ONLY` — created by a migration, queried by nothing):
`gs_entities_lga_backup_20260808` (609,416), `gs_entities_lga_backup_20260809b` (358,347),
`gs_entities_lga_backup_20260809c` (355,797), plus `_backup_entity_contacts_20260606` (16,664, fully
unreferenced). That is ~1.34M rows of snapshot from the August LGA attribution rebuild.

**`mv_abr_name_lookup` — 9,038,737 rows, 1.37 GB, pipeline-only.** Refreshed by
`scripts/refresh-views-v2.mjs` and `refresh-views.mjs`. Nothing in the web app reads it. It is the
second-largest object in the database.

**`privacy_audit_log` — 1,278,440 rows.** Its only occurrence in the entire repo is as a string in a
watch-list array in `scripts/watch-schema-health.mjs:73`. Never written or read by this codebase.

**`mv_charity_network` — 351,455 rows** ("charity-to-charity network via shared directors", per the
April inventory). Created by `supabase/migrations/20260331_charity_rankings.sql`, refreshed nightly by
`scripts/refresh-views.mjs` and `refresh-views-v2.mjs`, and **read by nothing**. This is precisely the
"director links" surface Ben says he wants.

## 11. Confidence

**Verified by direct inspection:**
- The `.from()` / `.rpc()` / SQL-context extraction and its aggregation (scripts in the scratchpad:
  `agg.py`, `routes.py`, `gen.py`; raw hits in `from_hits.tsv`, `rpc_hits.tsv`, `sql_hits.tsv`, `hits_raw.tsv`).
- The nine largest "dark" objects return **zero** hits from an unanchored `rg` over the whole repo
  (`foundation_category_assignments`, `foundation_geo_focus`, `mv_foundation_landscape_top_foundations`,
  `organization_funding_summaries`, `alma_org_enrichment_candidates`, `civic_funding_yj_classifications`,
  `data_catalogue`, `llm_usage`, `contact_intelligence_insights`).
- The `supabase.ts` RPC proxy, the exec_sql read-only guard, and the report snapshot gate — read line by line.
- The 11 nonexistent `.from()` targets — cross-checked against the 812-object census and the 212-view list.
- The 212 regular-view names — one live `information_schema.views` query.
- Foreign-key anchoring of dark tables — from `foreign_keys.csv`.
- Spot-checked actual source lines for `mv_entity_power_index`, `mv_revolving_door`, `mv_board_interlocks`,
  `gs_entities`, `se_search_index`, `v_goods_community_priority`, `v_acco_yj_retention_qld`.

**Inferred, not verified:**
- The "likely owner" column in section 3b — pure name/FK heuristic. The Supabase project is shared with
  JusticeHub, act-global-infrastructure, Empathy Ledger, Harvest and Contained; an object dark to
  GrantScope may be hot in another repo. **Only a matching pass over those repos can confirm true dark data.**
- Whether `/reports` runs live in production (Vercel env not checked).
- Which of the seven person matviews is authoritative (definitions not diffed).
- Route→table attribution beyond one import hop can over-attribute: a route that imports a barrel
  (`services/index.ts`) inherits everything that barrel re-exports. `/reports` (124) and `/org` (117)
  are the two most likely to be inflated this way.

**Not checked at all:**
- Runtime behaviour. Everything here is static analysis; a table referenced in code may still never be
  hit at runtime (dead branches, feature flags, unrouted API endpoints).
- Dynamic table names built by string concatenation would be missed entirely. I found one helper pattern
  that takes a table name as a parameter (`fetchChunked(db, 'table', …)`) and caught it via the loose
  word pass, but a `` `${prefix}_${suffix}` `` construction would be invisible.
- `apps/video/` was included in the grep but produced no DB references.
