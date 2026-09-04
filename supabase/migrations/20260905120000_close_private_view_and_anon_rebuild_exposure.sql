-- 20260905120000_close_private_view_and_anon_rebuild_exposure.sql
-- Closes the exposure measured on 2026-09-05. Findings and provenance:
--   thoughts/shared/findings/supabase-platform-review-2026-09-05.md
--
-- APPLY (Tier 3: needs Ben's explicit verb). From the repo root:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260905120000_close_private_view_and_anon_rebuild_exposure.sql
--
-- VERIFY afterwards with ONLY the publishable key (no login). Every line must return 0 rows or a
-- permission error; on 2026-09-05 they returned 262 / 2,064 / 5,509 / 315 rows:
--   for v in v_act_payables_triage v_act_expense_history v_canonical_contacts v_newsletter_reprompt_candidates; do
--     curl -s -H "apikey: $PUB" -H "Authorization: Bearer $PUB" "$URL/rest/v1/$v?select=*&limit=1"; echo; done
--
-- WHAT THIS CHANGES AND WHY
--  A. Fifteen SECURITY DEFINER views over ACT-private tables become security_invoker, and anon loses every
--     grant on them. The base tables already deny anon (direct reads of xero_invoices and ghl_contacts return
--     0 rows); the views ran as postgres and bypassed that. Every ACT reader uses the service role and keeps
--     working: grantscope getServiceSupabase (349 files), act-global command-center server routes (231 routes
--     on SUPABASE_SERVICE_ROLE_KEY, 0 through the browser client), act-global sync scripts.
--  B. Forty-eight auto-updatable views lose INSERT/UPDATE/DELETE for anon. Supabase default privileges hand
--     ALL on new relations to anon; a view has no RLS, so an updatable definer view is an open write path.
--     The ACT-private subset also loses those grants for authenticated.
--  C. Three SECURITY DEFINER functions that DELETE and re-INSERT whole tables lose EXECUTE for anon,
--     authenticated and PUBLIC. Anyone holding the public key could wipe and rebuild them at will.
--  D. Five USING (true) policies that let ANY signup (JusticeHub /signup, CivicGraph /register) read or
--     write ACT's CRM and accounts mirror are dropped. With RLS on and no policy, only the service role reads.
--
-- NOT IN THIS FILE (Phase 1 of the review): the other 97 definer views over public civic data, the 59
-- functions with mutable search_path, and ALTER DEFAULT PRIVILEGES so future views stop inheriting writes.
-- Those need a decision on which anon/authenticated consumers (JusticeHub, Empathy Ledger, Harvest) rely on them.

BEGIN;

-- ---------------------------------------------------------------------------------------------------
-- A. Private definer views: run as the caller, and never for anon.
-- ---------------------------------------------------------------------------------------------------
ALTER VIEW public.act_grant_recommendations_current SET (security_invoker = true);
ALTER VIEW public.v_act_expense_history            SET (security_invoker = true);
ALTER VIEW public.v_act_financial_pulse            SET (security_invoker = true);
ALTER VIEW public.v_act_income_history             SET (security_invoker = true);
ALTER VIEW public.v_act_organisations              SET (security_invoker = true);
ALTER VIEW public.v_act_payables_triage            SET (security_invoker = true);
ALTER VIEW public.v_act_people                     SET (security_invoker = true);
ALTER VIEW public.v_act_pipeline_unified           SET (security_invoker = true);
ALTER VIEW public.v_canonical_contacts             SET (security_invoker = true);
ALTER VIEW public.v_data_quality_scores            SET (security_invoker = true);
ALTER VIEW public.v_entity_resolution_stats        SET (security_invoker = true);
ALTER VIEW public.v_funder_summary                 SET (security_invoker = true);
ALTER VIEW public.v_newsletter_audience            SET (security_invoker = true);
ALTER VIEW public.v_newsletter_reprompt_candidates SET (security_invoker = true);
ALTER VIEW public.v_project_money_state            SET (security_invoker = true);

REVOKE ALL ON public.act_grant_recommendations_current FROM anon;
REVOKE ALL ON public.v_act_expense_history            FROM anon;
REVOKE ALL ON public.v_act_financial_pulse            FROM anon;
REVOKE ALL ON public.v_act_income_history             FROM anon;
REVOKE ALL ON public.v_act_organisations              FROM anon;
REVOKE ALL ON public.v_act_payables_triage            FROM anon;
REVOKE ALL ON public.v_act_people                     FROM anon;
REVOKE ALL ON public.v_act_pipeline_unified           FROM anon;
REVOKE ALL ON public.v_canonical_contacts             FROM anon;
REVOKE ALL ON public.v_data_quality_scores            FROM anon;
REVOKE ALL ON public.v_entity_resolution_stats        FROM anon;
REVOKE ALL ON public.v_funder_summary                 FROM anon;
REVOKE ALL ON public.v_newsletter_audience            FROM anon;
REVOKE ALL ON public.v_newsletter_reprompt_candidates FROM anon;
REVOKE ALL ON public.v_project_money_state            FROM anon;

-- ---------------------------------------------------------------------------------------------------
-- B. No writes through views for anon (all 48 auto-updatable views that carried the grant).
-- ---------------------------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON
  public.agent_health_dashboard, public.alma_cost_analysis, public.auto_approval_quality,
  public.coe_key_people_v, public.community_programs_profiles_v, public.coordinating_tasks,
  public.current_knowledge, public.enrichment_ready_contacts, public.justice_funding_clean,
  public.knowledge_review_schedule, public.knowledge_source_health, public.missing_receipts,
  public.partner_storytellers_v, public.pending_extractions, public.qld_bills, public.qld_coroners_findings,
  public.subscription_payment_calendar, public.subscription_renewal_alerts,
  public.unreconciled_financial_documents, public.v_acnc_grant_makers, public.v_act_expense_history,
  public.v_act_payables_triage, public.v_calendar_events_with_projects, public.v_canonical_contacts,
  public.v_cashflow_summary, public.v_cultural_data_access, public.v_funding_pipeline,
  public.v_governed_proof_hot_lane, public.v_indigenous_youth_overrepresentation,
  public.v_justice_spending_summary, public.v_ndis_market_concentration_hotspots,
  public.v_ndis_provider_supply_summary, public.v_ndis_support_class_supply,
  public.v_newsletter_reprompt_candidates, public.v_outstanding_invoices, public.v_pending_receipts,
  public.v_pending_subscriptions_review, public.v_project_actions, public.v_project_decisions,
  public.v_project_questions, public.v_projects_needing_attention, public.v_recent_agent_errors,
  public.v_recent_project_knowledge, public.v_subscription_alerts, public.v_youth_justice_cost_comparison,
  public.vw_exa_usage_summary, public.xero_overdue_receivables, public.xero_upcoming_payables
FROM anon;

-- The ACT-private subset: no writes through views for authenticated either.
REVOKE INSERT, UPDATE, DELETE ON
  public.agent_health_dashboard, public.coordinating_tasks, public.current_knowledge,
  public.enrichment_ready_contacts, public.knowledge_review_schedule, public.knowledge_source_health,
  public.missing_receipts, public.pending_extractions, public.subscription_payment_calendar,
  public.subscription_renewal_alerts, public.unreconciled_financial_documents, public.v_act_expense_history,
  public.v_act_payables_triage, public.v_calendar_events_with_projects, public.v_canonical_contacts,
  public.v_cashflow_summary, public.v_cultural_data_access, public.v_newsletter_reprompt_candidates,
  public.v_outstanding_invoices, public.v_pending_receipts, public.v_pending_subscriptions_review,
  public.v_project_actions, public.v_project_decisions, public.v_project_questions,
  public.v_projects_needing_attention, public.v_recent_agent_errors, public.v_recent_project_knowledge,
  public.v_subscription_alerts, public.vw_exa_usage_summary, public.xero_overdue_receivables,
  public.xero_upcoming_payables
FROM authenticated;

-- ---------------------------------------------------------------------------------------------------
-- C. Whole-table rebuilds are service-role only.
-- ---------------------------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.rebuild_funder_board_paths()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_funder_intelligence()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_place_funding_snapshot() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rebuild_funder_board_paths()     TO service_role;
GRANT  EXECUTE ON FUNCTION public.rebuild_funder_intelligence()    TO service_role;
GRANT  EXECUTE ON FUNCTION public.rebuild_place_funding_snapshot() TO service_role;

-- ---------------------------------------------------------------------------------------------------
-- D. Any-signup policies on the CRM and accounts mirror.
-- ---------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS communications_history_team                 ON public.communications_history;
DROP POLICY IF EXISTS ghl_contacts_team                           ON public.ghl_contacts;
DROP POLICY IF EXISTS ghl_opportunities_team                      ON public.ghl_opportunities;
DROP POLICY IF EXISTS "Authenticated read access on xero_invoices" ON public.xero_invoices;
DROP POLICY IF EXISTS "Public read"                               ON public.grant_applications;

COMMIT;

-- Post-check (run as postgres). Expect: definer_private = 0, anon_writable_views = 0, anon_rebuild = 0.
-- SELECT
--   (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
--      AND c.relname IN ('v_act_payables_triage','v_act_expense_history','v_canonical_contacts','v_newsletter_reprompt_candidates')
--      AND has_table_privilege('anon',c.oid,'SELECT')) AS definer_private,
--   (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
--      AND pg_relation_is_updatable(c.oid,false)>0 AND has_table_privilege('anon',c.oid,'INSERT')) AS anon_writable_views,
--   (SELECT count(*) FROM pg_proc WHERE proname LIKE 'rebuild_%' AND has_function_privilege('anon',oid,'EXECUTE')) AS anon_rebuild;
