-- =============================================================================
-- 2026-08-14-catalog-object-scope.sql
--
-- The machine-checkable rule that keeps ACT private-business objects out of the
-- civic data map and out of /clarity's default view — WITHOUT ever silently
-- hiding a future civic table.
--
-- APPLY WITH (NOT APPLIED — this file is a deliverable):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-14-catalog-object-scope.sql
--
-- -----------------------------------------------------------------------------
-- WHY AN EXPLICIT OBJECT LIST AND NOT A NAME PATTERN
--
-- Name patterns were tested against the actual schema and REJECTED. Every
-- candidate prefix is split across the civic/ACT boundary:
--
--   goods_*     12 ACT-private  vs  4 civic (goods_communities 1,542 rows,
--               goods_supply_routes 23,873, goods_procurement_entities 4,562,
--               goods_procurement_signals 1,251)
--   act_*       14 ACT-private  vs  3 civic (act_communities, act_community_links,
--               act_grant_recommendations — a 22,252-row matview in domain D5)
--   project_*   25 ACT-private  vs  1 civic
--   campaign_*   4 ACT-private  vs  3 civic (campaign_alignment_entities 4,141)
--   pulse_*      1 ACT (pulse_responses = The Harvest community survey) vs
--                3 JusticeHub (pulse_reports / _report_links / _events)
--   person_*     1 ACT (person_identity_map) vs 4 civic (person_roles 339,698)
--   entity_*     3 ACT vs 2 civic (entity_xref 1,211,744)
--   org_*        1 ACT vs 20 civic
--
-- A `goods_%` or `project_%` rule would swallow civic tables today. A
-- `xero_%`/`ghl_%`/`notion_%` rule is safe but covers only 34 of 208 objects,
-- so it does not do the job on its own.
--
-- A column on `data_catalog` was also rejected: that table holds 25 rows against
-- 1,024 relations, and it is an existing product surface with its own semantics
-- (pii_level, public_export, licence, source_url).
--
-- -----------------------------------------------------------------------------
-- THE FAIL-OPEN GUARANTEE
--
-- Scope is looked up, never inferred. Anything not in this table resolves to
-- 'unclassified', and 'unclassified' is VISIBLE in /clarity, flagged for triage.
-- The failure mode of a forgotten new table is therefore "shows up and nags",
-- never "silently disappears". A new ACT table is briefly over-exposed in an
-- internal catalog; a new civic table is never lost. That asymmetry is the
-- point — the opposite default would quietly shrink the civic map over time.
--
-- Hiding requires a human decision, recorded with a reason.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.catalog_object_scope (
  object_name  text PRIMARY KEY,
  scope        text NOT NULL
               CHECK (scope IN ('civic','act_private','act_private_review','platform')),
  reason       text NOT NULL,
  decided_by   text NOT NULL DEFAULT 'data-map-2026-08-14',
  decided_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_object_scope IS
  'Authoritative civic/ACT-private classification for catalog + /clarity. '
  'Absence means unclassified, which is VISIBLE and flagged — never hidden.';
COMMENT ON COLUMN public.catalog_object_scope.scope IS
  'civic = belongs in the civic data map. act_private = extract to the ACT '
  'Supabase, hide from /clarity by default. act_private_review = classified '
  'ACT but entangled with civic objects; must be resolved before extraction. '
  'platform = infrastructure, shown in /clarity ops view only.';

ALTER TABLE public.catalog_object_scope ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_object_scope_read ON public.catalog_object_scope;
CREATE POLICY catalog_object_scope_read
  ON public.catalog_object_scope FOR SELECT TO authenticated USING (true);
-- deliberately no anon policy: this table names ACT-private objects.

INSERT INTO public.catalog_object_scope (object_name, scope, reason) VALUES
  ('act_grant_recommendation_decisions','act_private_review','ACT decisions BUT FK->grant_opportunities AND alma_funding_opportunities (both civic), feeds matview act_grant_recommendations (22,252 rows, classified D5 civic), and funding_ghl_handoffs (civic) FKs to it. 19 GS refs.'),
  ('act_grant_recommendation_projects','act_private_review','Same cluster; FK->org_projects (civic). Feeds act_grant_recommendations + v_act_pipeline_unified.'),
  ('act_obligations','act_private_review','FK->act_communities (NOT in D14, domain D10) and org_profiles. The act_* cluster is already split across the boundary.'),
  ('act_opportunity_benchmark_cases','act_private_review','ask_grantscope_corrections (civic) FKs INTO it; FK->alma_funding_opportunities. An evaluation harness spanning both sides.'),
  ('act_opportunity_observatory','act_private_review','FK->alma_funding_opportunities. Discovery staging that promotes rows into the civic opportunity table.'),
  ('app_config','act_private_review','2 rows: reactor_webhook_url -> command-center-five-xi.vercel.app + a PLAINTEXT shared secret. Read by notify_event_reactor() and the retry-missed-reactions pg_cron job. If that reactor fires on civic tables the config is shared infrastructure, not ACT-only.'),
  ('app_users','act_private_review','1 row (knighttss@gmail.com), openId/loginMethod shape matches the Harvest app auth, not GrantScope auth (which uses public.users).'),
  ('bgfit_budget_items','act_private_review','Same cluster as bgfit_grants.'),
  ('bgfit_deadlines','act_private_review','Same cluster.'),
  ('bgfit_financial_periods','act_private_review','Same cluster; FK->organizations (civic).'),
  ('bgfit_grants','act_private_review','BG Fit grant acquittal tracker. FK->organizations (civic). BG Fit is an ACT receivable AND a JusticeHub org tenant; 2 JH refs via lib/bgfit/queries.ts.'),
  ('bgfit_suppliers','act_private_review','Same cluster; FK->organizations (civic).'),
  ('bgfit_transactions','act_private_review','Same cluster.'),
  ('canonical_entities','act_private_review','ACT CRM org spine (15,324). Read by civic-named views v_act_organisations, v_unified_contacts, v_entity_resolution_stats, enrichment_ready_contacts and 3 DB functions incl. resolve_entity. No ABNs (V33) so it is a contact book, but it is the left side of civicscope_act_entity_bridge.'),
  ('civicscope_act_entity_bridge','act_private_review','THE seam object. FK->gs_entities. 3,074 rows mapping ACT records to civic entities. It is by definition half-civic; it cannot live wholly in either database.'),
  ('contact_intelligence_scores','act_private_review','FK-less person_id -> person_identity_map. Feeds 3 vw_* views (goods/justice enrichment candidates, newsletter segments) that are named as if civic.'),
  ('editable_content','act_private_review','The Harvest website CMS (milk-crate-pavilion, the-garden). ACT project, public site.'),
  ('entity_identifiers','act_private_review','Zero ABNs, FK->canonical_entities (V33 CONFIRMED) so CRM-side. BUT CLAUDE.md documents it as a Key Table with 31K rows, resolve_entity() reads it, and 7 GS refs. High risk of someone assuming it is the civic identifier crosswalk (that is entity_xref, 1.2M rows).'),
  ('entity_merge_log','act_private_review','Probe CONFIRMED: surviving_entity_id resolves in canonical_entities, 0 in gs_entities. Same naming trap.'),
  ('entity_potential_matches','act_private_review','Probe CONFIRMED: entity_a_id resolves in canonical_entities, 0 in gs_entities. CRM dedup queue. Ambiguous only by name - reads as civic entity resolution.'),
  ('exa_company_intelligence','act_private_review','Exa enrichment of companies - content is about civic/commercial orgs, ownership is ACT CRM.'),
  ('ghl_contacts','act_private_review','ACT CRM contacts BUT contact_entity_links + crm_contact_organization_affiliations (both civic) FK to it, v_contained_crm_people (JusticeHub) reads it, and it carries empathy_ledger_id + is_storyteller flags.'),
  ('goods_asset_lifecycle','act_private_review','FK->goods_communities (NOT in D14); goods_procurement_signals (NOT in D14) FKs to it. The goods_* family is split 12 in / 4 out.'),
  ('goods_capital_blocks','act_private_review','FK->org_profiles.'),
  ('goods_content_library','act_private_review','Empathy Ledger content (el_id) curated for Goods newsletters. Straddles EL consent domain.'),
  ('goods_deployment_batches','act_private_review','FK->goods_communities (NOT in D14).'),
  ('goods_funding_matters','act_private_review','FK->gs_entities + org_profiles.'),
  ('goods_products','act_private_review','goods_procurement_signals (civic, D3) FKs to it.'),
  ('goods_relationships','act_private_review','Goods commercial arm. FK->gs_entities; org_contacts (civic) FKs to it; v_goods_relationship_funding/_power/_life_events join austender_contracts, justice_funding, political_donations, mv_entity_power_index, mv_revolving_door. 22 GS refs. Goods is a 14-tab product surface inside the CivicGraph app.'),
  ('harvest_businesses','act_private_review','Same as harvest_events.'),
  ('harvest_events','act_private_review','The Harvest / Witta community website - a THIRD public app, not GrantScope or JusticeHub. Public anon-INSERT submissions. ACT-owned but public-facing, so "private business" is the wrong label.'),
  ('image_overrides','act_private_review','The Harvest website image overrides. Same as editable_content.'),
  ('knowledge_chunks','act_private_review','19,367 of 19,413 rows have NULL org_profile_id (ACT knowledge, incl. verbatim iMessage content); 46 rows belong to one CivicGraph org_profile. FK->org_profiles. Multi-tenant tail on an otherwise private table.'),
  ('linkedin_contacts','act_private_review','13,810 LinkedIn connections. CRM PII. But vw_alma_intervention_matches / vw_high_value_project_matches / vw_auto_mapped_contacts read it, and CANONICAL-DATA-MAP flags real unrealised join value against person_roles (civic).'),
  ('notion_opportunities','act_private_review','ACT Notion funder pipeline BUT 7 JH refs (lib/funding/notion-worker-queue.ts, grant-matching.ts) - JusticeHub reads ACT Notion data.'),
  ('notion_organizations','act_private_review','ACT Notion org mirror (74 rows) but classified into the charities_ngo shard and 2 GS refs; overlaps civic organization data conceptually.'),
  ('opportunities_unified','act_private_review','17,790 rows: 16,106 re-projected FROM civic grant_opportunities, 961 from ghl_opportunities, 685 grantscope, 9 fundraising_pipeline. Moving it exports a stale copy of 16K civic grants; leaving it strands ACT deal rows. pipeline_changes (civic) FKs to it.'),
  ('person_identity_map','act_private_review','ACT CRM person spine (14,919) BUT 4 civic tables FK to it (person_entity_links 2,571, org_contacts, campaign_alignment_entities, exa_media_mentions) and 4 civic views read it. 16 GS + 4 JH refs. Moving it severs the ONLY people bridge from the CRM into gs_entities.'),
  ('project_funding_allocations','act_private_review','project_code-keyed ACT allocations, but pile_tag/funder_org_name overlaps CivicGraph funding concepts.'),
  ('project_funding_drawdowns','act_private_review','Child of project_funding_allocations; references xero_invoice_id.'),
  ('projects','act_private_review','81 rows, ALL ACT project codes (ACT-10..ACT-WI), single organization_id. ACT project registry. BUT 13 JH refs + 7 GS refs, social_posts (civic) FKs to it, act_grant_recommendations (civic-domain matview) joins it, and 4 DB functions read it. Generic name, heavy reuse.'),
  ('pulse_responses','act_private_review','Harvest community pulse survey (heard_of_harvest). NOTE: shares the pulse_ prefix with the JusticeHub Pulse tables but is a different product.'),
  ('relationship_pipeline','act_private_review','Generic name, notion_page_id + love/money/strategic scores = ACT CRM. Entity_type/entity_id are untyped - could point anywhere.'),
  ('sessions','act_private_review','public.sessions = dev session heartbeat for act-regenerative-studio. Name collides with auth.sessions; 11 JH refs are to a DIFFERENT sessions concept (org hub SessionsTab) - verify before moving.'),
  ('wiki_pages','act_private_review','401 of 413 NULL org_profile_id, 12 org-scoped. Same shape as knowledge_chunks. 4 triggers, 5 DB functions.'),
  ('witta_contributions','act_private_review','Witta community memory wall - public submissions.'),
  ('act_ask_artefacts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_ask_none_owed','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_ask_warmers','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_entities','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_payable_decisions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_people','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_person_roles','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_research_experiments','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('act_research_initiatives','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('bank_statement_lines','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('bookkeeping_rules','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('bookkeeping_sync_state','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('business_alerts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('calendar_events','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('cashflow_scenarios','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('collections_actions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('communication_project_links','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('communication_user_actions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('communications_history','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('compliance_ack','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('compliance_tracking','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_cadence_metrics','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_enrichments','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_intelligence','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_intelligence_insights','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_project_links','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_support_recommendations','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('contact_votes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('daily_reflections','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('dext_forwarded_emails','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('dext_receipts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('dext_supplier_setup_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('discovered_subscriptions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('dream_journal','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ecosystem_projects','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ecosystem_sites','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('email_financial_documents','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('email_response_templates','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('exa_api_usage','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('exa_enrichment_queue','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('exa_linkedin_profiles','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('finance_ai_routing_suggestions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('finance_receipt_bank_line_links','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('finance_receipt_documents','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('finance_receipt_ingestion_runs','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('financial_overview_cache','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('financial_snapshots','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('financial_summary','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('fundraising_pipeline','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ghl_opportunities','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ghl_pipelines','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ghl_sync_log','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ghl_tags','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ghl_task_bridge','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('gmail_auth_tokens','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('gmail_contacts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('gmail_messages','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('gmail_sync_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goal_updates','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goals_2026','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goods_cost_allocation_decisions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goods_funding_routes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goods_governance_readiness','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goods_route_allocations','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('goods_tranches','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('health_alerts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('idea_ack','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('idea_board','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('idea_snoozes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ignored_email_patterns','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('imessage_attachments','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('invoice_project_map','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('invoice_project_overrides','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_edges','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_extraction_queue','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_links','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_source_sync','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_sources','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('knowledge_versions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('location_project_rules','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('memory_episodes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('migration_email_templates','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('mv_project_quarter_position','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('newsletter_candidates','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('newsletter_drafts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_actions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_calendar','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_decisions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_grants','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_meetings','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_projects','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('notion_projects_cache','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('pending_subscriptions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('pm2_cron_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('pmpp_knowledge','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_budgets','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_commentary','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_contact_alignment','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_contact_matches','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_focus_areas','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_health','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_health_analysis','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_health_history','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_intelligence','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_intelligence_snapshots','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_knowledge','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_monthly_financials','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_pairings','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_pipelines','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_research','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_salary_allocations','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_strategic_profile','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_summaries','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('project_support_graph','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ralph_prds','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('ralph_tasks','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('receipt_emails','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('receipt_match_history','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('receipt_matches','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('receipt_pipeline_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('receipt_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('relationship_health','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('reminders','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('repo_project_links','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('resource_allocations','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('revenue_scenarios','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('revenue_stream_projections','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('revenue_streams','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('site_health_checks','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('sprint_items','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('sprint_snapshots','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('sprint_suggestions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('strategic_objectives','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('studio_projects','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('subscription_discovery_events','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('subscription_history','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('subscription_patterns','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('subscriptions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('supporter_comms_summary','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('supporters_intelligence','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('team_members','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('telegram_conversations','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('telegram_mutes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('touchpoints','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('user_gamification_stats','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('user_identities','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('vendor_contact_log','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('vendor_project_rules','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('voice_notes','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('wiki_articles','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('wiki_page_versions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('wiki_search_index','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_bank_accounts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_bank_transactions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_bas_tracking','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_contacts','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_invoices','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_payments','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_sync_log','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_sync_status','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_tokens','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('xero_transactions','act_private','Confirmed ACT private business by column shape + sample (see act-extraction-plan.md).'),
  ('campaign_content','civic','JusticeHub CONTAINED campaign content (LinkedIn/op-ed drafts). 5 JH refs incl. anon-key admin page.'),
  ('campaign_nomination_upvotes','civic','Child of campaign_nominations. JusticeHub.'),
  ('campaign_nominations','civic','JusticeHub CONTAINED campaign nominations (politicians). 23 JH refs.'),
  ('campaign_tracked_posts','civic','JusticeHub campaign LinkedIn monitor cron.'),
  ('ce_metrics','civic','Custodian Economy app metrics. Same as ce_users.'),
  ('ce_users','civic','Custodian Economy app (admin@custodianeconomy.org, staff@...). Separate product, holds password_hash. Not ACT books, not civic.'),
  ('cms_pages','civic','JusticeHub/Empathy Ledger CMS: about, privacy, storytellers, organizations, stories, impact.'),
  ('contact_submissions','civic','JusticeHub contact form; FK->organizations. 11 JH refs.'),
  ('dedup_tranche1_20260809','civic','CIVIC: gs_entities ORIC/ABN dedup staging (oric_gs_id, abn_gs_id, o_lga, a_lga). Belongs to the LGA attribution lane.'),
  ('enrollment_codes','civic','JusticeHub CONTAINED tour enrollment (CONT-ADEL...CONT-HOB); device_sessions FKs into it. 10 JH refs.'),
  ('founder_intake_messages','civic','Child of founder_intakes. Product feature, user-submitted. (Still an exposure - see stopgap.)'),
  ('founder_intake_signals','civic','Aggregate of founder_intakes. Product feature.'),
  ('founder_intakes','civic','CivicGraph product (founder intake wizard); FK->org_profiles, users. 4 GS refs.'),
  ('member_actions','civic','JusticeHub: action_type in {org_claim, event_registration, nurture_email}. 15 JH refs.'),
  ('member_wall_entries','civic','Empty. Community member wall - Harvest/JusticeHub public surface, not ACT books.'),
  ('newsletter_subscriptions','civic','JusticeHub: sources are contained_tour / justicehub_pulse_test / event_registration. 21 JH refs, 0 GS.'),
  ('org_pipeline','civic','CivicGraph SaaS: 125 rows / 2 org_profiles; FK->org_profiles, org_projects, gs_entities. 32 GS refs. qbe_evaluations FKs into it.'),
  ('page_gallery','civic','JusticeHub: single row page_slug=contained; FK->users.'),
  ('project_funding_profiles','civic','CivicGraph SaaS: FK->org_profiles + org_projects; embedding-backed matching. RPC search_project_funding_hybrid.'),
  ('project_media_links','civic','FK->media_items (civic). link_type=project_page. Serves get_hero_image / get_project_media.'),
  ('project_profiles','civic','CivicGraph SaaS: FK->org_profiles; grant_feedback FKs into it. Org project profile for grant matching.'),
  ('project_storytellers','civic','FK->storytellers (civic/EL). JusticeHub enrollment + EL push-sync.'),
  ('pulse_events','civic','JusticeHub CONTAINED portrait analytics (hover/click); FK->portraits.'),
  ('pulse_report_links','civic','Child of pulse_reports. JusticeHub.'),
  ('pulse_reports','civic','JusticeHub Pulse weekly reports; FK->users. 14 JH refs incl. public /pulse.'),
  ('saved_foundations','civic','CivicGraph SaaS: FK->foundations, org_profiles, users. 9 GS app refs (watchlist UI).'),
  ('saved_grants','civic','CivicGraph SaaS: 2,620 rows across 3 org_profiles + 3 users; FK->grant_opportunities, org_profiles, users, alert_preferences. 35 GS app refs. A product feature, not ACT books.'),
  ('sector_map_cache','civic','CIVIC data cache: entity_breakdown, funding_total 97.9bn, top_funded_orgs, relationship_types. Written by JH /api/cron/sector-cache.'),
  ('site_config','civic','JusticeHub: keys are contained-photo-overrides + judges-on-country-main-photo-overrides, values point at the Empathy Ledger storage bucket.'),
  ('accounting_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('auto_approval_quality','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('consolidation_progress','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('current_knowledge','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('enrichment_ready_contacts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('financial_by_account','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('financial_monthly_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('knowledge_review_schedule','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('knowledge_source_health','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('migration_progress','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('missing_receipts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('missing_subscriptions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('pending_extractions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('receipt_weekly_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('site_latest_health','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('subscription_cost_anomalies','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('subscription_cost_by_account','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('subscription_cost_by_category','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('subscription_payment_calendar','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('subscription_renewal_alerts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('unreconciled_financial_documents','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('unused_subscriptions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_act_expense_history','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_act_financial_pulse','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_act_payables_triage','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_activity_stream','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_awaiting_response','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_bgfit_budget_vs_actual','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_bgfit_grant_health','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_bgfit_pnl','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_bgfit_upcoming_deadlines','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_calendar_events_with_projects','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_canonical_contacts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_cashflow_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_contact_360','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_contact_communication_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_data_quality_scores','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_discovery_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_duplicate_review_queue','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_enriched_opportunities','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_entity_resolution_stats','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_finance_bank_line_evidence','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_funder_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_harvest_upcoming_events','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_monthly_revenue','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_need_to_respond','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_newsletter_audience','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_newsletter_reprompt_candidates','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_outstanding_invoices','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_pending_receipts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_pending_subscriptions_review','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_pipeline_value','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_actions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_activity_stream','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_alignment','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_decisions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_funding_position','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_health_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_lifetime_position','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_pipeline_totals','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_questions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_relationships','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_project_strategic_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_projects_needing_attention','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_rd_expenses','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_receipt_pipeline_funnel','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_recent_communications','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_recent_project_knowledge','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_subscription_alerts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_team_capacity','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_team_voice_notes','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_top_untagged','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_unified_contacts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_unmapped_transactions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_voice_notes_cultural_review','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('v_voice_notes_with_actions','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_alma_intervention_matches','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_auto_mapped_contacts','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_engagement_tier_stats','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_exa_queue_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_exa_usage_summary','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_goods_enrichment_candidates','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_high_value_project_matches','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_justice_enrichment_candidates','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('vw_newsletter_segments','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('wiki_hierarchy','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('xero_financial_health','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('xero_overdue_receivables','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.'),
  ('xero_upcoming_payables','act_private','Regular view whose every base relation is an ACT private-business table (pg_depend). Never inventoried by the 812-object census.')
ON CONFLICT (object_name) DO UPDATE
  SET scope = EXCLUDED.scope, reason = EXCLUDED.reason, decided_at = now();

-- -----------------------------------------------------------------------------
-- THE LOOKUP. This is what /clarity and any catalog job must call.
-- Left join, coalesce to 'unclassified' — the fail-open guarantee in one line.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_catalog_objects AS
SELECT
  c.relname                                        AS object_name,
  c.relkind::text                                  AS kind,
  n.nspname                                        AS schema_name,
  COALESCE(s.scope, 'unclassified')                AS scope,
  s.reason,
  s.decided_by,
  s.decided_at,
  (COALESCE(s.scope,'unclassified') IN ('civic','unclassified')) AS show_by_default,
  (s.object_name IS NULL)                          AS needs_triage,
  c.reltuples::bigint                              AS approx_rows,
  pg_total_relation_size(c.oid)                    AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN public.catalog_object_scope s ON s.object_name = c.relname
WHERE n.nspname = 'public' AND c.relkind IN ('r','m','v');

COMMENT ON VIEW public.v_catalog_objects IS
  'Every public relation with its civic/ACT scope. show_by_default is the '
  '/clarity filter. needs_triage lists relations nobody has classified yet.';

COMMIT;

-- =============================================================================
-- THE GUARD — run in CI. Fails when unclassified relations accumulate.
--
--   SELECT object_name, kind, approx_rows
--   FROM public.v_catalog_objects
--   WHERE needs_triage
--   ORDER BY approx_rows DESC;
--
-- Baseline at authoring time: 1,024 relations in public; 326 classified here
-- (237 census objects + 89 previously-uninventoried regular views); so ~698
-- start unclassified. That is correct — they are the civic map and they show.
-- The CI assertion to add is NOT "zero unclassified" but:
--
--   -- no relation may be BOTH unclassified AND matching a known-private prefix
--   SELECT count(*) FROM public.v_catalog_objects
--   WHERE needs_triage
--     AND object_name ~ '^(xero_|ghl_|gmail_|notion_|dext_|receipt_|imessage_|telegram_|bookkeeping_|bgfit_)';
--   -- must be 0
--
-- That catches the real risk (a new Xero/GHL table silently entering the civic
-- map) without ever hiding something on a guess.
-- =============================================================================

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- BEGIN;
-- DROP VIEW IF EXISTS public.v_catalog_objects;
-- DROP TABLE IF EXISTS public.catalog_object_scope;
-- COMMIT;
