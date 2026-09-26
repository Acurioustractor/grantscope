-- Drop 36 views nothing uses (2026-09-26 register pass: no reader since 2026-08-12 is measurable for views, so the
-- test is references): no view, function, cron job or code in any repo under ~/Code names them, and nothing depends
-- on them (pg_depend). v_monthly_revenue and v_receipt_pipeline_funnel were on the list but are still named by
-- act-global code, so they stay.
--
-- Undo: every definition is saved in thoughts/shared/data-map/dropped-views-2026-09-26.sql (CREATE OR REPLACE VIEW,
-- with its reloptions). No CASCADE: anything depending on one rolls the whole file back.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260926180000_drop_unused_views.sql (Tier 3, Ben's verb)

BEGIN;
DROP VIEW public."v_justice_spending_summary";
DROP VIEW public."v_llm_spend_monthly";
DROP VIEW public."v_ndis_support_class_supply";
DROP VIEW public."v_newsletter_audience";
DROP VIEW public."v_newsletter_reprompt_candidates";
DROP VIEW public."v_nt_community_procurement_summary";
DROP VIEW public."v_org_grant_health";
DROP VIEW public."v_org_upcoming_deadlines";
DROP VIEW public."v_pending_receipts";
DROP VIEW public."v_pending_subscriptions_review";
DROP VIEW public."v_person_roles_typed";
DROP VIEW public."v_program_detail_deliverers";
DROP VIEW public."v_project_actions";
DROP VIEW public."v_project_decisions";
DROP VIEW public."v_project_lifetime_position";
DROP VIEW public."v_project_pipeline_totals";
DROP VIEW public."v_project_questions";
DROP VIEW public."v_rd_expenses";
DROP VIEW public."v_recent_agent_errors";
DROP VIEW public."v_recent_project_knowledge";
DROP VIEW public."v_relationship_health";
DROP VIEW public."v_state_ecosystem_summary";
DROP VIEW public."v_team_capacity";
DROP VIEW public."v_voice_notes_cultural_review";
DROP VIEW public."v_voice_notes_with_actions";
DROP VIEW public."v_youth_justice_cost_comparison";
DROP VIEW public."v_youth_justice_entities";
DROP VIEW public."v_youth_justice_recipient_stats";
DROP VIEW public."vw_alma_intervention_matches";
DROP VIEW public."vw_auto_mapped_contacts";
DROP VIEW public."vw_engagement_tier_stats";
DROP VIEW public."vw_exa_queue_summary";
DROP VIEW public."vw_exa_usage_summary";
DROP VIEW public."vw_goods_enrichment_candidates";
DROP VIEW public."vw_high_value_project_matches";
DROP VIEW public."vw_justice_enrichment_candidates";
DELETE FROM schema_ownership WHERE object IN ('v_justice_spending_summary','v_llm_spend_monthly','v_ndis_support_class_supply','v_newsletter_audience','v_newsletter_reprompt_candidates','v_nt_community_procurement_summary','v_org_grant_health','v_org_upcoming_deadlines','v_pending_receipts','v_pending_subscriptions_review','v_person_roles_typed','v_program_detail_deliverers','v_project_actions','v_project_decisions','v_project_lifetime_position','v_project_pipeline_totals','v_project_questions','v_rd_expenses','v_recent_agent_errors','v_recent_project_knowledge','v_relationship_health','v_state_ecosystem_summary','v_team_capacity','v_voice_notes_cultural_review','v_voice_notes_with_actions','v_youth_justice_cost_comparison','v_youth_justice_entities','v_youth_justice_recipient_stats','vw_alma_intervention_matches','vw_auto_mapped_contacts','vw_engagement_tier_stats','vw_exa_queue_summary','vw_exa_usage_summary','vw_goods_enrichment_candidates','vw_high_value_project_matches','vw_justice_enrichment_candidates');
COMMIT;
