-- 20260905142000_function_search_path.sql
-- Phase 1 of the 2026-09-05 platform review. NOT applied by the review session; apply with scripts/db-apply.sh on Ben's verb.
--
-- Pins search_path on the 59 functions the Supabase advisor flags as function_search_path_mutable. A mutable search_path
-- lets a caller who can create objects in an earlier schema shadow a table or function the body calls unqualified.
-- `public, extensions, pg_temp` keeps every unqualified reference these functions make working: one uses similarity()
-- unqualified and 14 use the vector <=> operator, both of which live in the extensions schema in Supabase projects.
-- None of the 59 references auth., net., cron. or vault. objects unqualified (measured 2026-09-05).
-- One of the 59, refresh_civicgraph_mvs_run(text), is a PROCEDURE (pg_cron CALLs it); ALTER FUNCTION on it fails,
-- so the statements are generated from prokind. First apply attempt rolled back on exactly that line.

BEGIN;
ALTER FUNCTION public.act_auto_pass_stale_pipeline() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.act_parse_pipeline_deadline(d text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.award_theme_map(raw text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.bridge_civicscope_to_act_exact(p_rebuild boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.civic_meeting_tags_touch_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.civic_org_classifications_touch_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.civicscope_normalize_org_name(p_name text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.clarity_sync_house() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.closing_the_gap_state_summary() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.counterparty_count(mv_gs_entity_stats) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.dashboard_foundation_tiers() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.dashboard_foundation_total_giving() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.dashboard_geographic_distribution() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.dashboard_sector_distribution() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.dashboard_source_coverage() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.data_corrections_touch_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.entity_name_key(p_name text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.exhibition_search(q text, lim integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_contained_intel_summary() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_funding_operating_report() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_grant_award_history(p_grant_id uuid, p_winner_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_pipeline_stats() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_power_holder(p_abn text, p_gs_id text, p_name text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_yj_orgs_for_browser() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_yj_orgs_for_map() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_yj_programs_for_browser() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.goods_compute_warmth(p_stage text, p_last_touch timestamp with time zone, p_total_received numeric, p_alignment numeric, p_has_prior boolean, p_advocacy numeric) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.goods_relationships_touch_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.grant_award_themes(p_grant_id uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.jm_rate_check(p_key text, p_limit integer, p_window_seconds integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.jm_stage_discovery(p_row jsonb, p_cap integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_funding_parse_fy() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_hybrid_campaigns(query_text text, query_embedding vector, match_limit integer, p_cats text[], p_region text, p_country text, p_scope text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_hybrid_cases(query_text text, query_embedding vector, match_limit integer, p_cats text[], p_outcome text, p_strength text, p_region text, p_country text, p_scope text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_nearest_campaign(query_embedding vector, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_nearest_case(query_embedding vector, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_campaigns(campaign_id uuid, match_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_campaigns_for_case(case_id uuid, match_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_campaigns_for_evidence(evidence_id uuid, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_cases(case_id uuid, match_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_cases_for_campaign(campaign_id uuid, match_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_cases_for_evidence(evidence_id uuid, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_related_evidence_for_case(case_id uuid, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_search_campaigns(query_embedding vector, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_search_cases(query_embedding vector, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.justice_matrix_search_evidence(query_embedding vector, match_limit integer, max_distance double precision) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.parse_financial_year(fy text, OUT fy_start smallint, OUT fy_end smallint, OUT fy_open_ended boolean) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.profiles_block_privilege_self_edit() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.se_registry_stats() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_suppliers(p_q text, p_state text, p_limit integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.state_foundation_flows(state_code text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.system_org_funding_by_fy(org_ids uuid[], fys text[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.system_state_funding_by_fy(states text[], fys text[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.touch_organization_funding_summaries() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_funding_system0_filter_presets_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_funding_system0_policy_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions, pg_temp;
ALTER PROCEDURE public.refresh_civicgraph_mvs_run(IN p_tier text) SET search_path = public, extensions, pg_temp;

COMMIT;
