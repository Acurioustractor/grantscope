-- 20260905141000_definer_views_security_invoker_flip_safe.sql
-- Phase 1 of the 2026-09-05 platform review. Applied 2026-09-05 on Ben's verb after the set was tightened.
--
-- Flips the 48 SECURITY DEFINER views whose every base table is, for BOTH anon and authenticated, either RLS-off with
-- the grant, a view/matview with the grant, or RLS-on with at least one PERMISSIVE read policy whose USING clause is
-- literally `true`. Permissive policies OR together, so one `true` policy makes the table fully open to that role and
-- security_invoker changes nothing observable. Measured by policy CONTENT on 2026-09-05; the first draft of this file
-- listed 63 views measured by policy EXISTENCE, which would have zeroed anon reads on 15 of them.
--
-- The 15 excluded views sit over a base whose only read policies filter rows (assertions, civic_org_classifications,
-- alma_interventions, outcome_submissions, social_posts, harvest_events, clarity_object, catalog_object_scope,
-- schema_ownership, api_pricing/llm_usage). They stay definer and join the decision list in the findings doc:
--   v_catalog_objects [catalog_object_scope]
--   v_claim_evidence_summary [civic_intelligence_claims]
--   v_clarity_wants [clarity_object]
--   v_entity_360 [civic_org_classifications]
--   v_entity_organisation_group [assertions]
--   v_funding_outcomes_chain [alma_interventions,outcome_submissions]
--   v_harvest_social_performance [social_posts]
--   v_harvest_upcoming_events [harvest_events]
--   v_index_cost_ranking [schema_ownership]
--   v_llm_spend_monthly [api_pricing,llm_usage]
--   v_program_deliverers [assertions]
--   v_program_detail_deliverers [assertions]
--   v_program_spine [assertions]
--   v_youth_justice_entities [alma_interventions]
--   v_youth_justice_recipients [assertions]

BEGIN;
ALTER VIEW public.act_funding_opportunity_current_status SET (security_invoker = true);
ALTER VIEW public.alma_media_articles_publishable SET (security_invoker = true);
ALTER VIEW public.canonical_organizations SET (security_invoker = true);
ALTER VIEW public.justice_funding_clean SET (security_invoker = true);
ALTER VIEW public.qld_bills SET (security_invoker = true);
ALTER VIEW public.qld_coroners_findings SET (security_invoker = true);
ALTER VIEW public.se_directory SET (security_invoker = true);
ALTER VIEW public.v_acco_yj_retention_qld SET (security_invoker = true);
ALTER VIEW public.v_acnc_grant_makers SET (security_invoker = true);
ALTER VIEW public.v_acnc_latest SET (security_invoker = true);
ALTER VIEW public.v_act_procurement_buyers SET (security_invoker = true);
ALTER VIEW public.v_alma_current_impact SET (security_invoker = true);
ALTER VIEW public.v_announced_money_by_kind SET (security_invoker = true);
ALTER VIEW public.v_award_rows SET (security_invoker = true);
ALTER VIEW public.v_ctg_youth_justice_progress SET (security_invoker = true);
ALTER VIEW public.v_data_sufficiency SET (security_invoker = true);
ALTER VIEW public.v_entity_abr SET (security_invoker = true);
ALTER VIEW public.v_entity_funding_mix SET (security_invoker = true);
ALTER VIEW public.v_entity_name_candidates SET (security_invoker = true);
ALTER VIEW public.v_funder_tag_density SET (security_invoker = true);
ALTER VIEW public.v_funders_summary SET (security_invoker = true);
ALTER VIEW public.v_funding_ingest_health SET (security_invoker = true);
ALTER VIEW public.v_funding_program_names SET (security_invoker = true);
ALTER VIEW public.v_indigenous_youth_overrepresentation SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_by_org SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_by_program SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_state_grants SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_summary SET (security_invoker = true);
ALTER VIEW public.v_justice_spending_summary SET (security_invoker = true);
ALTER VIEW public.v_ndis_market_concentration_hotspots SET (security_invoker = true);
ALTER VIEW public.v_ndis_provider_supply_summary SET (security_invoker = true);
ALTER VIEW public.v_ndis_registered_provider_graph_match SET (security_invoker = true);
ALTER VIEW public.v_ndis_registered_provider_state_supply SET (security_invoker = true);
ALTER VIEW public.v_ndis_registered_provider_status_summary SET (security_invoker = true);
ALTER VIEW public.v_ndis_support_class_supply SET (security_invoker = true);
ALTER VIEW public.v_ndis_youth_justice_overlay SET (security_invoker = true);
ALTER VIEW public.v_nt_community_buyer_crosswalk SET (security_invoker = true);
ALTER VIEW public.v_nt_community_entity_matches SET (security_invoker = true);
ALTER VIEW public.v_nt_community_procurement_summary SET (security_invoker = true);
ALTER VIEW public.v_person_360 SET (security_invoker = true);
ALTER VIEW public.v_project_lifetime_position SET (security_invoker = true);
ALTER VIEW public.v_qld_watchhouse_latest SET (security_invoker = true);
ALTER VIEW public.v_qld_yj_bills_active SET (security_invoker = true);
ALTER VIEW public.v_vocab_financial_years SET (security_invoker = true);
ALTER VIEW public.v_vocab_topics SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_cost_comparison SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_recipient_stats SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_state_dashboard SET (security_invoker = true);

COMMIT;

-- Post-check: SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
--   AND coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name='security_invoker'),'false')='false';
-- expect: 33 (decide set) + 15 (excluded here) = 48
