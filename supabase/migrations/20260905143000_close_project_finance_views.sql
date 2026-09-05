-- 20260905143000_close_project_finance_views.sql
-- Phase 1 security sweep, found 2026-09-05 while classifying the remaining definer views: two ACT-private finance
-- views were still readable with the public key. Probed with the publishable key, no login:
--   v_project_funding_position   12 rows: allocation_id, project_code, funder_org_name, grant_or_contract_ref, committed_amount, status
--   v_project_pipeline_totals    30 rows: project_code, pipelines_active, open_count, won_count, lost_count, open_value_aud
-- Base tables: project_funding_allocations, project_funding_drawdowns, project_pipelines. Not caught by the Phase 0
-- regex because none of those names start with xero_/ghl_. Readers: act-global command-center server routes
-- (api/finance/funders, api/finance/projects/[code]) on the service role; nothing reads them with anon or authenticated.
BEGIN;
ALTER VIEW public.v_project_funding_position SET (security_invoker = true);
ALTER VIEW public.v_project_pipeline_totals  SET (security_invoker = true);
REVOKE ALL ON public.v_project_funding_position FROM anon;
REVOKE ALL ON public.v_project_pipeline_totals  FROM anon;
COMMIT;
