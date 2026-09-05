-- 20260905141000_definer_views_security_invoker_flip_safe.sql
-- Phase 1 of the 2026-09-05 platform review. NOT applied by the review session; apply with scripts/db-apply.sh on Ben's verb.
--
-- Flips the 63 SECURITY DEFINER views whose every base table already grants anon and authenticated SELECT AND has a
-- matching RLS read policy (or has RLS off, or is itself a view/matview with the grant). For these, security_invoker
-- changes nothing observable for anon or authenticated readers today, and removes the class of bug that leaked ACT's
-- Xero and GHL rows: a future policy tightening on a base table will now be honoured by the view instead of bypassed.
-- Measured with the catalog query in thoughts/shared/findings/supabase-platform-review-2026-09-05.md (Phase 1 section).
-- CAVEAT before applying: 'preserves' was measured as grant + policy EXISTENCE on every base table, not policy
-- CONTENT. A base policy with a filtering USING clause (e.g. published = true) is bypassed by the definer view today and
-- honoured after the flip, so anon may see FEWER rows on JusticeHub or Harvest pages that read these views with the anon
-- client. Run scripts/scan-clarity-code-refs.mjs or grep the sibling repos for each view name before applying, and apply
-- outside JusticeHub's publishing hours.
-- The remaining 33 definer views need a decision and are listed in that section, not touched here.

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
ALTER VIEW public.v_catalog_objects SET (security_invoker = true);
ALTER VIEW public.v_claim_evidence_summary SET (security_invoker = true);
ALTER VIEW public.v_clarity_wants SET (security_invoker = true);
ALTER VIEW public.v_ctg_youth_justice_progress SET (security_invoker = true);
ALTER VIEW public.v_data_sufficiency SET (security_invoker = true);
ALTER VIEW public.v_entity_360 SET (security_invoker = true);
ALTER VIEW public.v_entity_abr SET (security_invoker = true);
ALTER VIEW public.v_entity_funding_mix SET (security_invoker = true);
ALTER VIEW public.v_entity_name_candidates SET (security_invoker = true);
ALTER VIEW public.v_entity_organisation_group SET (security_invoker = true);
ALTER VIEW public.v_funder_tag_density SET (security_invoker = true);
ALTER VIEW public.v_funders_summary SET (security_invoker = true);
ALTER VIEW public.v_funding_ingest_health SET (security_invoker = true);
ALTER VIEW public.v_funding_outcomes_chain SET (security_invoker = true);
ALTER VIEW public.v_funding_program_names SET (security_invoker = true);
ALTER VIEW public.v_harvest_social_performance SET (security_invoker = true);
ALTER VIEW public.v_harvest_upcoming_events SET (security_invoker = true);
ALTER VIEW public.v_index_cost_ranking SET (security_invoker = true);
ALTER VIEW public.v_indigenous_youth_overrepresentation SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_by_org SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_by_program SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_state_grants SET (security_invoker = true);
ALTER VIEW public.v_justice_funding_summary SET (security_invoker = true);
ALTER VIEW public.v_justice_spending_summary SET (security_invoker = true);
ALTER VIEW public.v_llm_spend_monthly SET (security_invoker = true);
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
ALTER VIEW public.v_program_deliverers SET (security_invoker = true);
ALTER VIEW public.v_program_detail_deliverers SET (security_invoker = true);
ALTER VIEW public.v_program_spine SET (security_invoker = true);
ALTER VIEW public.v_project_lifetime_position SET (security_invoker = true);
ALTER VIEW public.v_qld_watchhouse_latest SET (security_invoker = true);
ALTER VIEW public.v_qld_yj_bills_active SET (security_invoker = true);
ALTER VIEW public.v_vocab_financial_years SET (security_invoker = true);
ALTER VIEW public.v_vocab_topics SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_cost_comparison SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_entities SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_recipient_stats SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_recipients SET (security_invoker = true);
ALTER VIEW public.v_youth_justice_state_dashboard SET (security_invoker = true);

COMMIT;

-- Post-check: every listed view now reports security_invoker=true
-- SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
--   AND coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name='security_invoker'),'false')='false';
-- expect: 33 (the DECIDE set)
