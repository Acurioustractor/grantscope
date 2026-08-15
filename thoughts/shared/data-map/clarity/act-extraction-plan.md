# ACT private-business extraction — verified plan + stopgap

Prepared 2026-08-14 against Supabase project `tednluwflfhxyucgwigh`.
All counts below are measured, not inferred, unless a line says otherwise.
**Nothing in this plan has been applied.** Three migration files are deliverables,
left unapplied, in `/Users/benknight/Code/grantscope/migrations/`.

---

## 0. The one-paragraph answer

The D14 classification is roughly right and materially wrong at the edges: of the
237 objects the map assigns to ACT private business, **162 are confirmed, 29 are
not ACT at all, and 46 are genuinely ambiguous**. The cluster is small — 336 MB
and 243,018 rows, **1.3% of the 26 GB / 0.5% of the 52.3M rows** — so the data
does not make extraction expensive. The entanglement does: **16 civic tables hold
foreign keys pointing INTO ACT tables, 16 views join both sides, 67 database
functions read ACT tables, 18 ACT tables are written from live HTTP request
paths, and the map missed ~89 regular views that are pure ACT business logic and
were never inventoried at all.** Extraction is a two-to-three week job dominated
by code changes, not by data movement. The stopgap is separable and should ship
first: **43 anon-readable policies sit on ACT-private objects right now**,
including 1,536 Xero payment records and 19,413 knowledge chunks containing
verbatim personal iMessage content.

---

## 1. Object list — verified, not inherited

Method: for every one of the 237 candidates I read its full column list from
`columns.csv`, ran a cheap targeted sample against the live database for the
ambiguous ones, resolved uncertain FK targets by probing which table the ids
actually exist in, and grepped both `apps/web/src` and `JusticeHub/src` for
`from('<name>')` with generated types and tests excluded.

| Verdict | Objects | Rows | Size |
|---|---:|---:|---:|
| **IN** — confirmed ACT private business | 162 | 126,992 | 178 MB |
| **BORDERLINE** — ACT-ish but entangled or misfiled | 46 | 125,045 | 158 MB |
| **OUT** — not ACT private business | 29 | 4,218 | 4.3 MB |
| *(total candidates)* | 237 | 256,255 | 340 MB |

Plus, **missed entirely by the 812-object census**: 89 regular views whose every
base relation is an ACT table, 16 views that straddle, and 67 database functions.
The census counted tables and matviews only; `GROUND_TRUTH_SUPPLEMENT.md` flagged
the 212 uninventoried views and this is where they land.

### 1.1 Confirmed IN (162)
| Object | Rows | GS refs | JH refs |
|---|---:|---:|---:|
| `communications_history` | 31,961 | 1 | 0 |
| `ghl_sync_log` | 10,665 | 1 | 1 |
| `site_health_checks` | 9,608 | 0 | 0 |
| `finance_receipt_documents` | 7,172 | 0 | 0 |
| `xero_bank_transactions` | 5,661 | 1 | 0 |
| `xero_transactions` | 5,100 | 2 | 0 |
| `memory_episodes` | 4,587 | 0 | 0 |
| `finance_receipt_bank_line_links` | 4,292 | 0 | 0 |
| `calendar_events` | 3,585 | 0 | 0 |
| `receipt_matches` | 2,972 | 0 | 0 |
| `relationship_health` | 2,791 | 8 | 0 |
| `receipt_emails` | 2,582 | 0 | 0 |
| `xero_invoices` | 2,332 | 24 | 0 |
| `project_intelligence_snapshots` | 2,254 | 0 | 0 |
| `contact_intelligence_insights` | 2,197 | 0 | 0 |
| `receipt_pipeline_status` | 2,195 | 0 | 0 |
| `project_health_history` | 1,982 | 0 | 0 |
| `bank_statement_lines` | 1,618 | 0 | 0 |
| `xero_payments` | 1,536 | 5 | 0 |
| `xero_contacts` | 1,416 | 0 | 0 |
| `health_alerts` | 1,394 | 0 | 0 |
| `knowledge_edges` | 1,252 | 0 | 0 |
| `ghl_opportunities` | 1,116 | 18 | 0 |
| `supporter_comms_summary` | 1,101 | 0 | 0 |
| `imessage_attachments` | 1,090 | 0 | 0 |
| `project_knowledge` | 995 | 0 | 0 |
| `notion_actions` | 957 | 0 | 0 |
| `communication_project_links` | 855 | 0 | 0 |
| `contact_enrichments` | 812 | 0 | 0 |
| `newsletter_candidates` | 800 | 0 | 0 |
| `dext_forwarded_emails` | 632 | 0 | 0 |
| `receipt_status` | 592 | 0 | 0 |
| `sprint_suggestions` | 573 | 0 | 0 |
| `contact_intelligence` | 509 | 0 | 0 |
| `vendor_project_rules` | 507 | 0 | 0 |
| `contact_project_links` | 487 | 1 | 0 |
| `xero_sync_log` | 469 | 1 | 1 |
| `finance_ai_routing_suggestions` | 390 | 0 | 0 |
| `dext_receipts` | 383 | 1 | 0 |
| `sprint_snapshots` | 370 | 0 | 0 |

Remaining 122 confirmed-IN objects (all under 363 rows), by family:

`wiki_search_index`, `act_payable_decisions`, `email_financial_documents`, `project_summaries`, `knowledge_links`, `project_monthly_financials`, `project_health_analysis`, `revenue_stream_projections`, `supporters_intelligence`, `project_contact_alignment`, `touchpoints`, `subscription_discovery_events`, `pm2_cron_status`, `project_contact_matches`, `mv_project_quarter_position`, `notion_calendar`, `notion_projects`, `location_project_rules`, `idea_board`, `ghl_tags`, `notion_projects_cache`, `subscriptions`, `project_intelligence`, `discovered_subscriptions`, `project_pipelines`, `goal_updates`, `contact_cadence_metrics`, `collections_actions`, `contact_support_recommendations`, `subscription_patterns`, `goals_2026`, `invoice_project_overrides`, `pending_subscriptions`, `project_health`, `financial_summary`, `finance_receipt_ingestion_runs`, `bookkeeping_rules`, `notion_meetings`, `notion_grants`, `sprint_items`, `ignored_email_patterns`, `notion_decisions`, `reminders`, `gmail_messages`, `project_support_graph`, `repo_project_links`, `ghl_pipelines`, `act_ask_none_owed`, `invoice_project_map`, `goods_tranches`, `exa_enrichment_queue`, `exa_linkedin_profiles`, `financial_snapshots`, `fundraising_pipeline`, `knowledge_extraction_queue`, `project_salary_allocations`, `communication_user_actions`, `project_budgets`, `contact_votes`, `strategic_objectives`, `subscription_history`, `project_focus_areas`, `knowledge_sources`, `compliance_tracking`, `resource_allocations`, `project_strategic_profile`, `goods_funding_routes`, `gmail_contacts`, `ecosystem_sites`, `ecosystem_projects`, `revenue_streams`, `daily_reflections`, `goods_governance_readiness`, `xero_bank_accounts`, `knowledge_source_sync`, `act_research_experiments`, `business_alerts`, `team_members`, `project_commentary`, `email_response_templates`, `revenue_scenarios`, `pmpp_knowledge`, `wiki_articles`, `receipt_match_history`, `cashflow_scenarios`, `studio_projects`, `telegram_conversations`, `user_identities`, `xero_tokens`, `act_entities`, `bookkeeping_sync_state`, `knowledge_versions`, `migration_email_templates`, `project_pairings`, `user_gamification_stats`, `project_research`, `xero_bas_tracking`, `exa_api_usage`, `newsletter_drafts`, `ralph_tasks`, `ralph_prds`, `xero_sync_status`, `act_research_initiatives`, `gmail_sync_status`, `financial_overview_cache`, `gmail_auth_tokens`, `vendor_contact_log`, `act_ask_artefacts`, `act_ask_warmers`, `act_person_roles`, `ghl_task_bridge`, `wiki_page_versions`, `dext_supplier_setup_status`, `goods_cost_allocation_decisions`, `dream_journal`, `compliance_ack`, `act_people`, `goods_route_allocations`, `idea_ack`, `idea_snoozes`, `telegram_mutes`, `voice_notes`

Families confirmed by column shape and sample: Xero (13 tables incl. `xero_tokens`
holding a plaintext refresh + access token), GHL (6), Gmail (4 incl.
`gmail_auth_tokens`), Notion mirrors (9), Dext/receipts/bank reconciliation (17),
subscriptions and vendor spend (11), ACT project ops (`project_*` 24, `sprint_*` 3,
`ralph_*` 2, goals, idea board, strategic objectives), personal corpora
(`communications_history` 31,961 emails and iMessages with `content_preview`,
`imessage_attachments`, `voice_notes`, `daily_reflections`, `dream_journal`,
`telegram_conversations`), knowledge/memory (`knowledge_chunks`, `memory_episodes`,
`project_knowledge`, `wiki_*`), ACT infra monitoring (`site_health_checks`,
`ecosystem_*`, `pm2_cron_status`), salary and capacity (`project_salary_allocations`,
`team_members` with `annual_salary` and `hourly_rate`, `resource_allocations`).

### 1.2 Confirmed OUT (29) — these are NOT ACT private business

| Object | Rows | GS/JH refs | Evidence it is NOT ACT private business |
|---|---:|---|---|
| `saved_grants` | 2,620 | 35/0 | CivicGraph SaaS: 2,620 rows across 3 org_profiles + 3 users; FK->grant_opportunities, org_profiles, users, alert_preferences. 35 GS app refs. A product feature, not ACT books. |
| `dedup_tranche1_20260809` | 822 | 0/0 | CIVIC: gs_entities ORIC/ABN dedup staging (oric_gs_id, abn_gs_id, o_lga, a_lga). Belongs to the LGA attribution lane. |
| `pulse_events` | 284 | 0/0 | JusticeHub CONTAINED portrait analytics (hover/click); FK->portraits. |
| `saved_foundations` | 157 | 9/0 | CivicGraph SaaS: FK->foundations, org_profiles, users. 9 GS app refs (watchlist UI). |
| `org_pipeline` | 125 | 32/0 | CivicGraph SaaS: 125 rows / 2 org_profiles; FK->org_profiles, org_projects, gs_entities. 32 GS refs. qbe_evaluations FKs into it. |
| `founder_intake_messages` | 23 | 2/0 | Child of founder_intakes. Product feature, user-submitted. (Still an exposure - see stopgap.) |
| `project_media_links` | 23 | 0/0 | FK->media_items (civic). link_type=project_page. Serves get_hero_image / get_project_media. |
| `pulse_reports` | 22 | 0/14 | JusticeHub Pulse weekly reports; FK->users. 14 JH refs incl. public /pulse. |
| `project_storytellers` | 16 | 0/2 | FK->storytellers (civic/EL). JusticeHub enrollment + EL push-sync. |
| `newsletter_subscriptions` | 16 | 0/21 | JusticeHub: sources are contained_tour / justicehub_pulse_test / event_registration. 21 JH refs, 0 GS. |
| `ce_metrics` | 15 | 0/0 | Custodian Economy app metrics. Same as ce_users. |
| `member_actions` | 12 | 0/15 | JusticeHub: action_type in {org_claim, event_registration, nurture_email}. 15 JH refs. |
| `project_funding_profiles` | 11 | 4/0 | CivicGraph SaaS: FK->org_profiles + org_projects; embedding-backed matching. RPC search_project_funding_hybrid. |
| `enrollment_codes` | 10 | 0/10 | JusticeHub CONTAINED tour enrollment (CONT-ADEL...CONT-HOB); device_sessions FKs into it. 10 JH refs. |
| `project_profiles` | 7 | 4/0 | CivicGraph SaaS: FK->org_profiles; grant_feedback FKs into it. Org project profile for grant matching. |
| `campaign_nominations` | 7 | 0/23 | JusticeHub CONTAINED campaign nominations (politicians). 23 JH refs. |
| `cms_pages` | 7 | 0/0 | JusticeHub/Empathy Ledger CMS: about, privacy, storytellers, organizations, stories, impact. |
| `sector_map_cache` | 7 | 0/2 | CIVIC data cache: entity_breakdown, funding_total 97.9bn, top_funded_orgs, relationship_types. Written by JH /api/cron/sector-cache. |
| `campaign_nomination_upvotes` | 7 | 0/3 | Child of campaign_nominations. JusticeHub. |
| `pulse_report_links` | 6 | 0/8 | Child of pulse_reports. JusticeHub. |
| `campaign_content` | 6 | 0/5 | JusticeHub CONTAINED campaign content (LinkedIn/op-ed drafts). 5 JH refs incl. anon-key admin page. |
| `founder_intakes` | 6 | 4/0 | CivicGraph product (founder intake wizard); FK->org_profiles, users. 4 GS refs. |
| `campaign_tracked_posts` | 3 | 0/3 | JusticeHub campaign LinkedIn monitor cron. |
| `ce_users` | 2 | 0/0 | Custodian Economy app (admin@custodianeconomy.org, staff@...). Separate product, holds password_hash. Not ACT books, not civic. |
| `site_config` | 2 | 0/4 | JusticeHub: keys are contained-photo-overrides + judges-on-country-main-photo-overrides, values point at the Empathy Ledger storage bucket. |
| `page_gallery` | 1 | 0/2 | JusticeHub: single row page_slug=contained; FK->users. |
| `contact_submissions` | 1 | 0/11 | JusticeHub contact form; FK->organizations. 11 JH refs. |
| `founder_intake_signals` | 0 | 0/0 | Aggregate of founder_intakes. Product feature. |
| `member_wall_entries` | 0 | 0/0 | Empty. Community member wall - Harvest/JusticeHub public surface, not ACT books. |

The pattern across the 29: the map's `platform_ops_auth` catch-all pulled in
**two other products**. JusticeHub's whole CONTAINED tour surface (enrollment
codes, campaign nominations, pulse reports, newsletter subscriptions, contact
submissions, member actions, site config, page gallery) landed in D14 because it
is app-operational rather than civic reference data. So did CivicGraph's own
multi-tenant SaaS layer (`saved_grants` 2,620 rows across 3 org profiles,
`saved_foundations`, `org_pipeline`, `founder_intakes`, `project_profiles`). And
one third product entirely — `ce_users` / `ce_metrics`, the Custodian Economy app,
complete with its own `password_hash` column.

Two of these would have caused real damage if moved:
- **`sector_map_cache`** is a *civic* data cache (`funding_total` = $97.9bn,
  `top_funded_orgs`, `entity_breakdown`) written by a JusticeHub cron. Named like
  ops plumbing, is actually the civic aggregate.
- **`dedup_tranche1_20260809`** is gs_entities ORIC/ABN dedup staging
  (`oric_gs_id`, `abn_gs_id`, `o_lga`, `a_lga`) belonging to the LGA attribution
  lane. Moving it would strand an in-flight civic data project.

### 1.3 BORDERLINE (46) — the valuable output

These are the calls that could reasonably go either way. Each row says what makes
it hard, not just which way I leaned.

| Object | Rows | GS/JH refs | What makes it hard to call |
|---|---:|---|---|
| `entity_identifiers` | 31,451 | 7/0 | Zero ABNs, FK->canonical_entities (V33 CONFIRMED) so CRM-side. BUT CLAUDE.md documents it as a Key Table with 31K rows, resolve_entity() reads it, and 7 GS refs. High risk of someone assuming it is the civic identifier crosswalk (that is entity_xref, 1.2M rows). |
| `knowledge_chunks` | 19,413 | 1/0 | 19,367 of 19,413 rows have NULL org_profile_id (ACT knowledge, incl. verbatim iMessage content); 46 rows belong to one CivicGraph org_profile. FK->org_profiles. Multi-tenant tail on an otherwise private table. |
| `opportunities_unified` | 17,790 | 0/0 | 17,790 rows: 16,106 re-projected FROM civic grant_opportunities, 961 from ghl_opportunities, 685 grantscope, 9 fundraising_pipeline. Moving it exports a stale copy of 16K civic grants; leaving it strands ACT deal rows. pipeline_changes (civic) FKs to it. |
| `canonical_entities` | 15,324 | 0/1 | ACT CRM org spine (15,324). Read by civic-named views v_act_organisations, v_unified_contacts, v_entity_resolution_stats, enrichment_ready_contacts and 3 DB functions incl. resolve_entity. No ABNs (V33) so it is a contact book, but it is the left side of civicscope_act_entity_bridge. |
| `person_identity_map` | 14,919 | 16/4 | ACT CRM person spine (14,919) BUT 4 civic tables FK to it (person_entity_links 2,571, org_contacts, campaign_alignment_entities, exa_media_mentions) and 4 civic views read it. 16 GS + 4 JH refs. Moving it severs the ONLY people bridge from the CRM into gs_entities. |
| `linkedin_contacts` | 13,810 | 1/0 | 13,810 LinkedIn connections. CRM PII. But vw_alma_intervention_matches / vw_high_value_project_matches / vw_auto_mapped_contacts read it, and CANONICAL-DATA-MAP flags real unrealised join value against person_roles (civic). |
| `ghl_contacts` | 5,169 | 44/0 | ACT CRM contacts BUT contact_entity_links + crm_contact_organization_affiliations (both civic) FK to it, v_contained_crm_people (JusticeHub) reads it, and it carries empathy_ledger_id + is_storyteller flags. |
| `civicscope_act_entity_bridge` | 3,074 | 0/0 | THE seam object. FK->gs_entities. 3,074 rows mapping ACT records to civic entities. It is by definition half-civic; it cannot live wholly in either database. |
| `relationship_pipeline` | 1,000 | 0/0 | Generic name, notion_page_id + love/money/strategic scores = ACT CRM. Entity_type/entity_id are untyped - could point anywhere. |
| `entity_potential_matches` | 620 | 0/0 | Probe CONFIRMED: entity_a_id resolves in canonical_entities, 0 in gs_entities. CRM dedup queue. Ambiguous only by name - reads as civic entity resolution. |
| `wiki_pages` | 413 | 0/0 | 401 of 413 NULL org_profile_id, 12 org-scoped. Same shape as knowledge_chunks. 4 triggers, 5 DB functions. |
| `goods_asset_lifecycle` | 404 | 18/0 | FK->goods_communities (NOT in D14); goods_procurement_signals (NOT in D14) FKs to it. The goods_* family is split 12 in / 4 out. |
| `goods_content_library` | 369 | 0/0 | Empathy Ledger content (el_id) curated for Goods newsletters. Straddles EL consent domain. |
| `goods_relationships` | 306 | 22/0 | Goods commercial arm. FK->gs_entities; org_contacts (civic) FKs to it; v_goods_relationship_funding/_power/_life_events join austender_contracts, justice_funding, political_donations, mv_entity_power_index, mv_revolving_door. 22 GS refs. Goods is a 14-tab product surface inside the CivicGraph app. |
| `act_opportunity_benchmark_cases` | 275 | 6/0 | ask_grantscope_corrections (civic) FKs INTO it; FK->alma_funding_opportunities. An evaluation harness spanning both sides. |
| `act_grant_recommendation_decisions` | 89 | 19/0 | ACT decisions BUT FK->grant_opportunities AND alma_funding_opportunities (both civic), feeds matview act_grant_recommendations (22,252 rows, classified D5 civic), and funding_ghl_handoffs (civic) FKs to it. 19 GS refs. |
| `projects` | 81 | 7/13 | 81 rows, ALL ACT project codes (ACT-10..ACT-WI), single organization_id. ACT project registry. BUT 13 JH refs + 7 GS refs, social_posts (civic) FKs to it, act_grant_recommendations (civic-domain matview) joins it, and 4 DB functions read it. Generic name, heavy reuse. |
| `notion_organizations` | 74 | 2/0 | ACT Notion org mirror (74 rows) but classified into the charities_ngo shard and 2 GS refs; overlaps civic organization data conceptually. |
| `project_funding_drawdowns` | 48 | 0/0 | Child of project_funding_allocations; references xero_invoice_id. |
| `contact_intelligence_scores` | 47 | 0/0 | FK-less person_id -> person_identity_map. Feeds 3 vw_* views (goods/justice enrichment candidates, newsletter segments) that are named as if civic. |
| `act_opportunity_observatory` | 47 | 0/0 | FK->alma_funding_opportunities. Discovery staging that promotes rows into the civic opportunity table. |
| `bgfit_budget_items` | 46 | 0/1 | Same cluster as bgfit_grants. |
| `notion_opportunities` | 43 | 0/7 | ACT Notion funder pipeline BUT 7 JH refs (lib/funding/notion-worker-queue.ts, grant-matching.ts) - JusticeHub reads ACT Notion data. |
| `image_overrides` | 43 | 0/0 | The Harvest website image overrides. Same as editable_content. |
| `bgfit_deadlines` | 27 | 0/0 | Same cluster. |
| `bgfit_transactions` | 22 | 0/0 | Same cluster. |
| `entity_merge_log` | 21 | 0/0 | Probe CONFIRMED: surviving_entity_id resolves in canonical_entities, 0 in gs_entities. Same naming trap. |
| `editable_content` | 19 | 0/0 | The Harvest website CMS (milk-crate-pavilion, the-garden). ACT project, public site. |
| `bgfit_suppliers` | 15 | 0/0 | Same cluster; FK->organizations (civic). |
| `sessions` | 14 | 1/11 | public.sessions = dev session heartbeat for act-regenerative-studio. Name collides with auth.sessions; 11 JH refs are to a DIFFERENT sessions concept (org hub SessionsTab) - verify before moving. |
| `act_grant_recommendation_projects` | 12 | 5/0 | Same cluster; FK->org_projects (civic). Feeds act_grant_recommendations + v_act_pipeline_unified. |
| `exa_company_intelligence` | 12 | 0/0 | Exa enrichment of companies - content is about civic/commercial orgs, ownership is ACT CRM. |
| `project_funding_allocations` | 12 | 0/0 | project_code-keyed ACT allocations, but pile_tag/funder_org_name overlaps CivicGraph funding concepts. |
| `goods_funding_matters` | 9 | 1/0 | FK->gs_entities + org_profiles. |
| `goods_capital_blocks` | 5 | 1/0 | FK->org_profiles. |
| `witta_contributions` | 4 | 0/0 | Witta community memory wall - public submissions. |
| `goods_products` | 4 | 3/0 | goods_procurement_signals (civic, D3) FKs to it. |
| `bgfit_grants` | 4 | 0/2 | BG Fit grant acquittal tracker. FK->organizations (civic). BG Fit is an ACT receivable AND a JusticeHub org tenant; 2 JH refs via lib/bgfit/queries.ts. |
| `harvest_events` | 3 | 0/0 | The Harvest / Witta community website - a THIRD public app, not GrantScope or JusticeHub. Public anon-INSERT submissions. ACT-owned but public-facing, so "private business" is the wrong label. |
| `app_config` | 2 | 0/0 | 2 rows: reactor_webhook_url -> command-center-five-xi.vercel.app + a PLAINTEXT shared secret. Read by notify_event_reactor() and the retry-missed-reactions pg_cron job. If that reactor fires on civic tables the config is shared infrastructure, not ACT-only. |
| `pulse_responses` | 2 | 0/0 | Harvest community pulse survey (heard_of_harvest). NOTE: shares the pulse_ prefix with the JusticeHub Pulse tables but is a different product. |
| `harvest_businesses` | 2 | 0/0 | Same as harvest_events. |
| `app_users` | 1 | 0/0 | 1 row (knighttss@gmail.com), openId/loginMethod shape matches the Harvest app auth, not GrantScope auth (which uses public.users). |
| `act_obligations` | 0 | 7/0 | FK->act_communities (NOT in D14, domain D10) and org_profiles. The act_* cluster is already split across the boundary. |
| `goods_deployment_batches` | 0 | 9/0 | FK->goods_communities (NOT in D14). |
| `bgfit_financial_periods` | 0 | 0/0 | Same cluster; FK->organizations (civic). |

**The five borderline clusters that decide the shape of this project:**

1. **The CRM identity island** (`person_identity_map`, `canonical_entities`,
   `entity_identifiers`, `entity_potential_matches`, `entity_merge_log`,
   `contact_intelligence_scores`, `linkedin_contacts`) — 91,000 rows. The map is
   right that it is ACT's contact book (V33: zero ABNs, FK'd to
   `canonical_entities` not `gs_entities`; I re-probed `entity_potential_matches`
   and `entity_merge_log` and their ids resolve in `canonical_entities`, 0 in
   `gs_entities`). But four *civic* tables FK into `person_identity_map` and nine
   civic-named views read the island. Moving it is the single largest code change.

2. **Goods** — the boundary is already broken. 12 `goods_*` tables are in D14 and
   4 are outside it (`goods_communities` 1,542, `goods_supply_routes` 23,873,
   `goods_procurement_entities` 4,562, `goods_procurement_signals` 1,251). Two of
   the outside ones hold FKs *into* the inside ones. And `v_goods_relationship_power`
   / `_funding` / `_life_events` / `_warm_intros` join `austender_contracts`,
   `justice_funding`, `political_donations`, `mv_entity_power_index`,
   `mv_revolving_door` and `mv_board_interlocks`. Goods is not a private business
   record set — it is a CivicGraph product surface (14 tabs at `/org/act/goods/*`)
   whose value is precisely that it sits on the civic graph. **Recommendation:
   Goods stays.** Extract Goods' *money* rows (`goods_tranches` invoice numbers,
   `goods_cost_allocation_decisions`) and keep the relationship/asset layer.

3. **ACT grant recommendation** (`act_grant_recommendation_decisions` /
   `_projects`, `act_opportunity_benchmark_cases`, `act_opportunity_observatory`).
   These FK to `grant_opportunities` and `alma_funding_opportunities`, feed the
   22,252-row matview `act_grant_recommendations` (which the map itself classifies
   as **civic, D5**), and `ask_grantscope_corrections` — a civic table — holds an
   FK *into* `act_opportunity_benchmark_cases`. This cluster is ACT's decisions
   about civic opportunities. It cannot be lifted without either breaking the
   matview or exporting a copy of the civic opportunity table.

4. **`projects`** — 81 rows, every one an ACT project code, single
   `organization_id`. Unambiguously ACT's registry. Also referenced 13 times by
   JusticeHub and 7 by GrantScope, FK'd from `social_posts`, joined by
   `act_grant_recommendations`, and read by 4 database functions including
   `calculate_project_sovereignty_score` and `create_empathy_project`. The generic
   name has made it a shared vocabulary across three apps.

5. **The Harvest / Witta cluster** (`harvest_events`, `harvest_businesses`,
   `witta_contributions`, `pulse_responses`, `app_users`, `editable_content`,
   `image_overrides`, `member_wall_entries`) — an ACT project, but a **public
   community website**, not private business. Calling it "private" is a category
   error; it needs its own destination decision (its own Supabase, or the ACT one,
   but not silently bundled as "books"). Note `pulse_responses` (Harvest survey)
   vs `pulse_reports`/`pulse_events` (JusticeHub) share a prefix and are different
   products — a live example of why prefix rules fail here.

Also worth Ben's eye: **`app_config`** holds `reactor_webhook_url` pointing at
`command-center-five-xi.vercel.app` **and a plaintext shared secret**. It is read
by `retry_missed_reactions()`, which runs on pg_cron every 15 minutes and
processes `integration_events` — a platform table that is *not* in D14. So
`app_config` is shared infrastructure wearing an ACT label.

---

## 2. Entanglement — the actual cost

### 2.1 Foreign keys: 60 cross-boundary constraints

**16 civic tables hold an FK pointing INTO an ACT table.** These are the hard
seams: the referencing side stays, the referenced side leaves, and the constraint
cannot survive.

| Civic table (stays) | → ACT table (leaves) |
|---|---|
| `ask_grantscope_corrections` | `act_opportunity_benchmark_cases` |
| `campaign_alignment_entities` | `person_identity_map` |
| `contact_entity_links` | `ghl_contacts` |
| `crm_contact_organization_affiliations` | `ghl_contacts` |
| `device_sessions` | `enrollment_codes` * |
| `exa_media_mentions` | `person_identity_map` |
| `funding_ghl_handoffs` | `act_grant_recommendation_decisions` |
| `goods_procurement_signals` | `goods_asset_lifecycle`, `goods_products` |
| `grant_feedback` | `project_profiles` * |
| `org_contacts` | `goods_relationships`, `person_identity_map` |
| `person_entity_links` | `person_identity_map` |
| `pipeline_changes` | `opportunities_unified` |
| `qbe_evaluations` | `org_pipeline` * |
| `social_posts` | `projects` |

\* three of these resolve for free once the OUT list is applied — `enrollment_codes`,
`project_profiles` and `org_pipeline` are not ACT private business and should
never have been in scope.

**44 ACT tables hold an FK pointing OUT to a civic table** — `org_profiles` (11),
`users` (11), `gs_entities` (4), `organizations` (4), `org_projects` (3),
`alma_funding_opportunities` (3), `goods_communities` (2), `grant_opportunities`,
`foundations`, `storytellers`, `media_items`, `portraits`, `art_innovation`,
`act_communities`, `alert_preferences`, `grant_notification_outbox`. Each becomes
an unenforced text/uuid column in the new database. `org_profiles` and `users` in
particular mean **the ACT database inherits a copy of the tenancy and identity
model**, or those columns become dangling.

### 2.2 Views: 106 read ACT tables — and 89 of them were never inventoried

`pg_depend` says 106 views/matviews in `public` read at least one D14 table.
**90 are pure-ACT** (every base relation is D14): the whole `v_project_*` family,
`v_act_*`, `xero_*`, `subscription_*`, `v_bgfit_*`, `v_contact_360`,
`v_activity_stream`, `v_finance_bank_line_evidence`, `vw_exa_*`, `wiki_hierarchy`,
`accounting_summary`, `missing_receipts`, and so on. Only one of them
(`mv_project_quarter_position`) appears in the 812-object census at all — the
other 89 are regular views, which the census excluded by construction. **The real
D14 object count is therefore ~251 IN + ~46 borderline, not 237.**

**16 views straddle the boundary.** These are the seams that need a decision
each, not a mechanical move:

| View | ACT bases | Civic bases it joins |
|---|---:|---|
| `v_goods_relationship_funding` | 1 | austender_contracts, foundations, gs_entities, justice_funding, political_donations |
| `v_goods_life_events` | 1 | austender_contracts, gs_entities, justice_funding, mv_acnc_latest |
| `act_grant_recommendations` (matview, 22,252 rows) | 3 | alma_funding_opportunities, funder_blocklist, v_funder_tag_density |
| `v_contained_crm_people` | 1 | crm_contact_organization_affiliations, gs_entities, organizations |
| `v_goods_foundation_targets` | 1 | foundations, mv_person_entity_network |
| `v_goods_relationship_power` | 1 | mv_entity_power_index, mv_revolving_door |
| `v_goods_warm_intros` | 1 | mv_board_interlocks, mv_person_entity_network |
| `v_act_organisations` | 2 | gs_entities |
| `v_act_people` | 2 | gs_entities |
| `v_act_pipeline_unified` | 3 | act_grant_recommendations |
| `v_act_income_history` | 1 | funder_context_snapshot |
| `v_goods_central_channels` | 1 | v_org_funding_profile |
| `act_grant_recommendations_current` | 1 | act_funding_opportunity_current_status |
| `v_project_summary` / `v_project_financials` / `v_project_money_state` | 6/5/4 | grant_applications |

### 2.3 Database functions: 67 distinct functions read ACT tables

Not caught by any code grep — `VERIFICATION.md §3` warned about exactly this
(386 KB of `pg_proc.prosrc` never scanned). Notable:

- **`act_auto_pass_stale_pipeline()`** — a live pg_cron job (jobid 9, `0 4 * * *`)
  operating on `org_pipeline`, which is on the OUT list. ACT business logic running
  on a CivicGraph SaaS table on a schedule.
- **`bridge_civicscope_to_act_exact()` / `_fuzzy()`** — the explicit civic↔ACT
  bridge, writing `civicscope_act_entity_bridge` from `canonical_entities`.
- **`resolve_entity()`** — reads `canonical_entities` + `entity_identifiers`.
- **`retry_missed_reactions()`** — pg_cron every 15 min; reads `app_config`
  (secret) and drives `integration_events` (not D14).
- Memory/knowledge RPCs (`hybrid_memory_search`, `match_knowledge_chunks`,
  `search_knowledge`, `search_org_knowledge`, `run_memory_decay`,
  `record_memory_access`, `get_decay_stats`) — 7 functions over `knowledge_chunks`
  and `project_knowledge`.
- **~40 non-internal triggers** on ACT tables, including 4 on `wiki_pages`,
  3 on `xero_invoices` (`auto_tag_invoice_income_type` reads `vendor_project_rules`),
  `update_relationship_health` firing off `communications_history`,
  `auto_create_person_identity` firing off `linkedin_contacts`, and
  `create_health_alert` chaining `site_health_checks` → `ecosystem_sites` →
  `health_alerts`.

### 2.4 Application code: 75 objects with real usage, 18 written from live requests

Excluding generated `database.types.ts` and tests: **104 GrantScope files** and
**~45 JusticeHub files** touch D14 candidates.

The dual-write risk sits in these **18 objects written from a live HTTP path**:

| Object | Write sites |
|---|---|
| `act_grant_recommendation_decisions` | `api/ops/grant-recommendations/decide`, `.../sync-notion`, `api/integrations/ghl/funding-callback`, `lib/services/funding-ghl.ts` |
| `act_people`, `act_person_roles`, `act_ask_warmers` | `api/org/[orgProfileId]/people/route.ts` (insert/update/upsert/delete) |
| `act_obligations` | `api/org/[orgProfileId]/obligations/route.ts` |
| `act_opportunity_benchmark_cases` | `api/ops/act-research/benchmark/review`, `lib/services/ask-grantscope-corrections.ts` |
| `act_payable_decisions` | `api/ops/payables/decide`, `.../decide-bulk` |
| `ghl_contacts`, `ghl_sync_log`, `ghl_task_bridge` | `lib/ghl.ts`, `lib/opportunity-intelligence.ts`, `lib/services/act-ghl-task-bridge.ts` |
| `goods_asset_lifecycle`, `goods_deployment_batches` | `api/goods/community/[id]/deploy/route.ts` |
| `goods_relationships`, `goods_funding_routes`, `goods_route_allocations`, `goods_cost_allocation_decisions` | `app/org/[slug]/goods/*/actions.ts` (Server Actions) |
| `notion_opportunities` | **JusticeHub** `lib/funding/grant-matching.ts`, `lib/funding/notion-worker-queue.ts` |
| `person_identity_map` | GS `api/org/[orgProfileId]/contacts/link-notion`, `.../sync-ghl`, `lib/services/tag-sync-service.ts`; **JH** `api/admin/campaign-alignment/enrich` |

Two of those cross the app boundary — JusticeHub writes ACT's Notion opportunity
mirror and ACT's person spine. Any cutover has to coordinate **two deploys**, not
one.

---

## 3. Size — how much actually leaves

Measured with `pg_total_relation_size` (heap + indexes + TOAST), not estimates.

| | Objects | Rows | Bytes |
|---|---:|---:|---:|
| Whole `public` schema (tables + matviews) | 812 | 52,279,236 | 26 GB |
| Whole database | — | — | 28 GB |
| **IN + BORDERLINE (extraction scope)** | **208** | **243,018** | **336 MB** |
| — confirmed IN only | 162 | 126,992 | 178 MB |
| — borderline | 46 | 125,045 | 158 MB |
| OUT (stays) | 29 | 4,218 | 4.3 MB |

**The cluster is 25.6% of the objects and 1.26% of the bytes.** Largest single
item is `knowledge_chunks` at 84 MB (pgvector embeddings), then
`communications_history` 32 MB, `opportunities_unified` 20 MB,
`entity_identifiers` 19 MB, `memory_episodes` 17 MB, `wiki_search_index` 15 MB.

A `pg_dump` of the whole scope is a few hundred megabytes and restores in
minutes. **Nothing about this is a data-volume problem.** The cost is entirely
in §2.

Two consequences worth stating plainly:
- Extraction will **not** meaningfully shrink the 28 GB bill. If cost is the
  motive, this is the wrong lever (the 13 `*_backup_*` tables at 1.46M rows and
  `abr_registry` at 6.7 GB are).
- The motive that does hold up is **blast radius**: 43 anon-open policies on
  ACT-private objects, plaintext OAuth tokens, salary rows and 31,961 personal
  messages sitting in the same database as two public-facing apps.

---

## 4. Extraction plan

### Phase 0 — decide the 46 borderlines (blocking, ~half a day with Ben)

Nothing else can start. The five clusters in §1.3 are the whole decision. My
recommendations, to argue with:

| Cluster | Recommendation |
|---|---|
| CRM identity island | **Move**, but leave a narrow `act_person_bridge(person_id, gs_entity_id, confidence)` table behind in CivicGraph so `person_entity_links` and `org_contacts` keep a target. |
| Goods relationship/asset layer | **Stay.** It is a product surface on the civic graph, not books. |
| Goods money rows (`goods_tranches`, `goods_cost_allocation_decisions`, `goods_capital_blocks`) | **Move.** |
| ACT grant recommendation cluster | **Stay for now.** Moving it breaks a civic matview and would export a copy of `grant_opportunities`. Revisit after /clarity. |
| `projects` | **Stay**, renamed `act_projects`, with the 81 rows treated as reference data both databases may read. Three apps already depend on the name. |
| Harvest / Witta | **Separate destination.** Not the ACT books database. Own decision. |
| `app_config` | **Stay** (platform), and rotate `reactor_webhook_secret` — it is plaintext in a table with 2 rows. |

### Phase 1 — stopgap (independent, ship first)

`migrations/2026-08-14-revoke-anon-private-reads.sql` +
`migrations/2026-08-14-fix-misdeclared-service-role-policies.sql`. See §6.
This is worth doing **whether or not extraction ever happens**.

### Phase 2 — freeze the boundary

Apply `migrations/2026-08-14-catalog-object-scope.sql` (§5). From that point,
every new table gets a scope decision before it can be considered civic. Without
this the boundary re-blurs faster than the migration can be executed — the map
was only assembled today and already three prefix families straddle it.

### Phase 3 — stand up the ACT project and move schema-first

1. **New Supabase project** `act-business-<region>`. Same region
   (`ap-southeast-2`) — cross-region latency on a CRM is not worth it.
2. **Schema only, no data:**
   ```
   pg_dump --schema-only --no-owner --no-privileges \
     $(printf -- '-t public.%s ' $(cat act_in_list.txt)) \
     "$SOURCE_URL" > act_schema.sql
   ```
   Then **hand-edit**: strip the 44 outbound FK constraints to civic tables
   (they cannot be satisfied), keep everything else. Do not let `pg_dump` decide
   this — it will silently emit constraints referencing tables that will not exist,
   and the restore will fail halfway through with the load already partly applied.
3. **Views and functions separately.** `pg_dump -t` does **not** pull the 89
   pure-ACT views, the 67 functions, or the ~40 triggers. Extract them with
   `pg_get_viewdef` / `pg_get_functiondef` into their own file, ordered by
   dependency. This is the step most likely to be forgotten — the object list you
   were given does not contain them.
4. **Data:** `pg_dump --data-only --disable-triggers` per table, restore in FK
   order. 336 MB; expect minutes.
5. **RLS:** do **not** port the policies. Every one of the 43 anon-open policies
   is wrong in the new database too. Start from deny-all + service-role, and add
   `authenticated` policies only where a screen needs one.
6. **Verify:** row-count parity per object, plus a checksum on the ten largest
   (`SELECT count(*), md5(string_agg(id::text,',' ORDER BY id)) FROM x`). Store
   the before/after pair in the plan file. Do not accept "the restore said OK".

### Phase 4 — the code, which is the real work

Order matters. Read paths first, writes last.

1. **Add a second client.** `lib/supabase-act.ts` in GrantScope exposing
   `getActSupabase()`, pointed at the new project by env var, defaulting to the
   *old* project until cutover. One switch, one place.
2. **Route the read paths.** ~104 GrantScope files and ~45 JusticeHub files.
   The concentrations: `lib/services/act-*.ts` (11 files), `lib/services/goods-*.ts`
   (8), `lib/opportunity-intelligence.ts`, `lib/services/org-*.ts`. Change the
   client, not the query.
3. **Replace the 16 straddling views.** Each becomes either (a) an ACT-side view
   over a *replicated slice* of the civic data it needs, or (b) an application-level
   join across two clients. For `v_goods_relationship_power` — which reads
   `mv_entity_power_index` and `mv_revolving_door` — (b) is the only honest answer;
   replicating those matviews into the ACT database would fossilise them.
4. **Dual-write the 18 live-write objects.** For each: write to both databases,
   read from old, for one full week. Then flip reads. Then stop writing to old.
   Sequence them by risk, and note that `person_identity_map` and
   `notion_opportunities` need **JusticeHub deployed in lockstep** — a GrantScope-only
   flip leaves JusticeHub writing to the abandoned copy silently.
5. **Move the pg_cron jobs.** `act-auto-pass-stale-pipeline` (jobid 9) goes with
   ACT; `retry-missed-reactions` (jobid 1) stays but its `app_config` dependency
   must be re-homed first.
6. **Drop from source, last.** Only after a full week of green. Take a dump first
   — `VERIFICATION.md` already records one case where the documented rollback path
   was about to be deleted along with the backups.

### Phase 5 — verification that would actually catch a loss

- Row-count + checksum parity per object (Phase 3.6), re-run after the drop.
- `SELECT count(*) FROM v_catalog_objects WHERE needs_triage` — any ACT-prefixed
  object still unclassified is a miss.
- Grep both `src` trees for `from('<moved table>')` against the **old** client:
  must be zero.
- `pg_proc.prosrc` scan on the source database for the moved names: must be zero.
  (This is the check the original dark-object scan skipped, at a measured 23%
  false-positive rate.)
- One week of `agent_runs` / error logs with no new 500s on the 149 touched files.

### What running both databases costs during transition

Two Supabase projects, two connection pools, one shared pooler already under
strain (`memory/solution_supabase_pooler_saturation.md` records the Small→Medium
bump). Every screen that today does one query across the boundary becomes two
round trips plus an application join. Budget for `/org/act/goods/*` and the ACT
desk pages getting measurably slower during the dual-read window, and do not
start this in the same week as anything else that touches the pooler.

---

## 5. Catalog exclusion — the machine-checkable rule

**Recommendation: an explicit object list in a typed table, resolved by LEFT
JOIN, defaulting to visible.**

Deliverable: `migrations/2026-08-14-catalog-object-scope.sql` — creates
`public.catalog_object_scope(object_name PK, scope, reason, decided_by, decided_at)`
seeded with **326 rows** (the 237 census candidates plus the 89 pure-ACT regular
views the census never saw), and `public.v_catalog_objects`, which is what
/clarity queries:

```sql
LEFT JOIN catalog_object_scope s ON s.object_name = c.relname
...
COALESCE(s.scope,'unclassified')                               AS scope,
COALESCE(s.scope,'unclassified') IN ('civic','unclassified')   AS show_by_default,
(s.object_name IS NULL)                                        AS needs_triage
```

**Why not name patterns.** I tested them against the schema. Every plausible
prefix is split:

| Prefix | ACT-private | Civic |
|---|---:|---|
| `goods_%` | 12 | 4 — incl. `goods_supply_routes` 23,873 rows |
| `act_%` | 14 | 3 — incl. `act_grant_recommendations` matview, 22,252 rows |
| `project_%` | 25 | 1 |
| `campaign_%` | 4 | 3 — incl. `campaign_alignment_entities` 4,141 |
| `person_%` | 1 | 4 — incl. `person_roles` 339,698 |
| `entity_%` | 3 | 2 — incl. `entity_xref` 1,211,744 |
| `org_%` | 1 | 20 |
| `pulse_%` | 1 (Harvest survey) | 3 (JusticeHub) |

A `goods_%` or `project_%` rule would swallow civic tables **today**, before any
future ones exist. Only `xero_%`, `ghl_%`, `gmail_%`, `notion_%`, `dext_%`,
`bookkeeping_%`, `bgfit_%`, `imessage_%`, `telegram_%`, `receipt_%` are clean —
34 of 208 objects. Useful as a *guard*, useless as *the rule*.

**Why not a column on `data_catalog`.** It holds 25 rows against 1,024 relations,
and it is an existing product surface with its own semantics (`pii_level`,
`public_export`, `licence`, `source_url`). Overloading it conflates "is this
publishable open data" with "does this belong to ACT" — two different questions
that will diverge.

**How it cannot silently swallow a future civic table.** Scope is looked up,
never inferred. An unlisted relation resolves to `unclassified`, and
`unclassified` is **visible and flagged**, not hidden. A forgotten new table shows
up and nags; it never disappears. Hiding requires a human decision with a written
reason. The CI assertion in the migration's footer is deliberately *not* "zero
unclassified" — it is "zero unclassified objects matching a known-private prefix",
which catches the one real failure (a new Xero table entering the civic map)
without ever hiding anything on a guess.

---

## 6. The stopgap — prepared, NOT applied

Two files in `/Users/benknight/Code/grantscope/migrations/`, each with the apply
command in its header, a HOLD list, and a full ROLLBACK block.

### 6.1 Survey result

The population is **240 permissive policies** in `public` with
`cmd IN ('SELECT','ALL')`, `USING (true)`, and `anon` or `public` in the role
list: 148 `{anon,authenticated}` SELECT + 72 `{public}` SELECT + 7 `{anon}` SELECT
(= the 227 in the brief) + 13 `{public}` ALL.

**43 of the 240 sit on D14 objects.** Two have a policy but no anon table grant
(`act_research_experiments`, `act_research_initiatives`) so they are not actually
exposed. The confirmed starting points check out: `xero_payments` "Public read"
`{anon,authenticated}` USING true with the grant present (1,536 rows,
$2,459,275, 2025-06-03..2026-07-17, carrying `bank_account_name` and
`raw_payload`), and `founder_intake_messages` "anon_read_messages" `{anon}`.

### 6.2 `2026-08-14-revoke-anon-private-reads.sql` — 48 drops

**Tier 1 (33) — ACT private business.** Named object, named policy, evidence:

| Object | Policy | Why not public-civic |
|---|---|---|
| `xero_payments` | Public read | 1,536 payments, $2.46M, bank account names + raw payloads |
| `knowledge_chunks` | Anon read access on knowledge_chunks | 19,413 chunks; map records verbatim personal iMessage content found by sampling |
| `project_knowledge` | pk_read_all | 995 meeting transcripts, decisions, rationale, action items |
| `linkedin_contacts` | Allow authenticated read | 13,810 contacts w/ email, employer, location — policy is misnamed, roles are `{public}` |
| `person_identity_map` | Allow authenticated read | 14,919 people w/ email, indigenous_affiliation, government_influence, funding_capacity |
| `canonical_entities` | Public read | 15,324 CRM records w/ email, phone, cultural_affiliation |
| `entity_identifiers` | Public read | 31,451 rows: linkedin_id 13,807 · email 1,720 · phone 31 · **zero ABNs** (V33) |
| `entity_merge_log`, `entity_potential_matches` | Public read | CRM dedup; ids probe-resolved to `canonical_entities`, 0 in `gs_entities` |
| `contact_intelligence_scores` | Users can view all scores | per-person influence/accessibility scoring |
| `supporters_intelligence` | Public read | 179 funders w/ total_paid, outstanding_aud, outstanding_age_days, primary_email, framing notes |
| `supporter_comms_summary` | Public read | 1,101 rows of last_touch_subject + snippet — message content |
| `vendor_project_rules` | vendor_rules_read_all | 507 supplier rules w/ xero_account_code, tax_type, tenant_id |
| `finance_ai_routing_suggestions` | Public read | 390 rows w/ vendor, amount, bank_account |
| `act_payable_decisions` | Public read | 359 approve/decline calls on ACT invoices |
| `goods_relationships` | Public read | 306 funder rows w/ ask_amount_aud, warmth, warm_intro_path, total_received |
| `goods_tranches` | Public read | funder ↔ xero invoice number ↔ amount |
| `goods_deployment_batches` | Public read | funded_by / funded_amount per community; write-first |
| `project_pipelines` | Public read | open/won/lost value per ACT project |
| `civicscope_act_entity_bridge` | Public read | 3,074 rows — discloses who ACT tracks |
| `act_grant_recommendation_decisions` / `_projects` | Public read | internal pursue/pass calls, `next_question`, `act_context` |
| `newsletter_candidates`, `newsletter_drafts` | Public read | unsent drafts, consent_warnings, voice_grade_details |
| `knowledge_sources` | Sources are viewable by everyone | 0 rows but write-first; source_url, limitations, storage_path |
| `ignored_email_patterns`, `telegram_mutes`, `idea_ack`, `idea_snoozes`, `compliance_ack` | Public read / … | ACT operational scaffolding, zero client reads |
| `founder_intakes`, `founder_intake_messages`, `founder_intake_signals` | anon_read_* | not ACT, but user-submitted private content (idea_summary, founder_motivation, draft_email) |

**Tier 2 (15) — not ACT, not public-civic either:**
`_backup_entity_contacts_20260606` (16,664 contact emails/phones, zero code refs),
`partnership_inquiries`, `exhibition_service_submissions`, `report_submissions`,
`report_feedback`, `whats_new_subscribers`, `partner_contacts`, `partner_goals`,
`discrimination_reports` (47 first-person accounts — the **read** is dropped, the
public **submit** policy is kept), `youth_survey_results`, `audit_events`,
`funder_briefs`, `funder_nudge_log`, `qbe_evaluations`, `kiosk_control_signals`.

**Safety method for every drop, not an assertion:** I walked every `.ts`/`.tsx`
in both `src` trees, matched `from('<table>')`, and tested whether the containing
file imports an anon-key client (`supabase-browser` in GrantScope;
`@/lib/supabase/client` / `client-lite` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
JusticeHub). **Exactly two objects came back positive — `campaign_content` and
`campaign_outreach` — and neither is in the revoke list.** Everything else is read
by the service role, which bypasses RLS, or by nothing at all. GrantScope has only
two anon-key modules and eleven consuming pages, none of which touch this list.

**HOLD list (recorded in the file so it is not re-litigated):**
`campaign_content` / `campaign_outreach` (verified anon-client read+insert);
`project_media_links`, `pulse_events` (plausibly serve a public page, not
sensitive enough to risk); `act_research_*` (policy exists, no grant, already
safe); `sector_map_cache` (genuinely public civic aggregate).

### 6.3 `2026-08-14-fix-misdeclared-service-role-policies.sql` — the finding nobody was looking for

**All thirteen `FOR ALL` policies in `public` that grant role `public` with
`USING (true)` are named for a privileged role but were created without a `TO`
clause**, which defaults to `public` — including `anon`. Combined with
`FOR ALL USING (true) WITH CHECK (true)`, anonymous callers can SELECT, INSERT,
UPDATE and DELETE. Names include *"Service role full access review_media_links"*,
*"Service role has full access to storytellers"*, *"Service manages alert events"*,
*"Allow all access for service role"*, *"Admin write campaign_content"*.

On **six** of these tables a correctly scoped policy already exists and is
silently defeated, because RLS policies are OR-ed:

| Table | Policy being defeated |
|---|---|
| `storytellers` | `USING (consent_given AND privacy_preferences->>'public_display' = 'true')` |
| `review_projects` | `USING (is_published = true)` |
| `alert_events` | `USING (auth.uid() = user_id)` |
| `funder_portfolios` | `USING (auth.uid() = user_id)` |
| `funder_portfolio_entities` | `USING (portfolio_id IN (own portfolios))` |
| `review_curated_entries` / `_year_settings` / `_media_links` / `review_videos` / `campaign_content` / `campaign_outreach` | a plain public SELECT policy — so dropping the ALL costs no reads |

`storytellers` is the sharpest: **226 rows carrying `date_of_birth`,
`phone_number`, `contact_email`, `cultural_background`, `transcript`, and an
explicit `consent_given` / `privacy_preferences` / `narrative_ownership_level`
consent model — all readable and writable by anon, consent flag ignored.**

Because the correct policies already exist, dropping the broad ones **restores
the intended access model rather than inventing one**. That is why this file is
safe to apply despite touching public surfaces. The one exception is preserved
explicitly: JusticeHub `app/judges-on-country/page.tsx` is a `'use client'`
component using the anon browser key and calling
`.from('campaign_outreach').insert(...)` at line 473, so the ALL policy there is
replaced with an explicit anon INSERT policy rather than removed.

The migration drops all 13, plus 4 further anon-write policies of the same shape
that are not `FOR ALL` (`portraits` "Allow all updates"/"Allow all deletes",
`project_knowledge` "pk_insert_all"/"pk_update_all") — 17 statements.

Legitimate public submit paths are untouched: `harvest_businesses`,
`harvest_events`, `discrimination_reports`, `story_comments`, `story_reactions`,
`story_attribution_events`, `event_feedback`, `page_views`, `pulse_events`,
`messages`, `signal_content`, `signal_events`, `alma_research_*`, and
`portraits` "Allow all inserts".

---

## 7. What I did not verify

- **I did not read the contents** of `communications_history`, `knowledge_chunks`,
  `xero_tokens` or `gmail_auth_tokens`. Sensitivity claims about them are inherited
  from `CANONICAL-DATA-MAP.md`'s sampling, or derived from column names —
  `xero_tokens(refresh_token, access_token)` and `gmail_auth_tokens(access_token,
  refresh_token)` are unambiguous from the schema alone. `app_config`'s plaintext
  secret I did see, because it was in the two-row sample I needed for the
  classification.
- **The 46 borderline verdicts are recommendations, not decisions.** Several
  (Goods, `projects`, the grant-recommendation cluster) are product-strategy calls.
- **I did not trace routes.** `project_media_links` and `pulse_events` were held
  back on a grep result, not a rendered page. A real route trace might clear them.
- **I did not test the migrations.** They are unapplied by instruction; the SQL
  was lint-checked for shape and quoting, not parsed by Postgres.
- **`reltuples` is approximate** in the size table (`n_live_tup` is broken on this
  instance per V6, and `reltuples` shares its staleness). Row counts in the object
  tables come from the census `count(*)`; byte figures are exact
  `pg_total_relation_size`.
- **JusticeHub's read paths I sampled rather than exhausted.** I enumerated files
  and counts, not every call site's semantics.

---

## Appendix — machine-readable companions

In the same scratchpad directory, generated by the analysis above:

| File | Contents |
|---|---|
| `act_in_list.txt` | 162 confirmed-IN object names, one per line — the `pg_dump -t` seed |
| `act_borderline_list.txt` | 46 names needing a Phase 0 decision |
| `act_out_list.txt` | 29 names to strike from D14 |
| `act_pure_views_list.txt` | 89 regular views the 812-object census never inventoried |
| `d14_verdicts.json` | every candidate with verdict, reason, row/byte counts, GS/JH ref counts |
| `fk_seams.txt` | all 60 cross-boundary foreign keys |
| `view_mix.txt` | per-view ACT/civic base-relation split |
| `func_refs.txt` | 86 function→table references across 67 distinct functions |
| `anon_open.txt` | all 240 anon-open SELECT/ALL policies with grant + row counts |
| `anon_write.txt` | the 38 anon-writable policies |
| `d14_code_hits_real.json` | per-object GrantScope/JusticeHub file lists, generated types and tests excluded |

Migration deliverables (unapplied) in `/Users/benknight/Code/grantscope/migrations/`:

- `2026-08-14-revoke-anon-private-reads.sql`
- `2026-08-14-fix-misdeclared-service-role-policies.sql`
- `2026-08-14-catalog-object-scope.sql`
