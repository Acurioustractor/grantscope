-- 20260905150000_act_finance_aggregate_views_anon_revoke.sql
-- Drafted 2026-09-05; NOT applied. Apply with /db-apply on Ben's verb.
--
-- Five ACT finance aggregate views (Xero income and expense by payee, project and funder, and the funder next-move
-- view) are still SECURITY DEFINER with anon and authenticated SELECT grants. Since Phase 0 they return 0 rows to
-- anon, because they sit on the now security_invoker private views and the base RLS holds, but the grants and the
-- definer flag are the wrong shape and one careless rewrite of an inner view would reopen them. Readers, verified
-- 2026-09-05: grantscope lib/services/org-income-service.ts and org-pipeline-service.ts (service role), act-global
-- command-center api/finance routes (service role), scripts/sync-funder-reporting-to-notion.mjs (service role).
BEGIN;
ALTER VIEW public.v_act_expense_by_payee   SET (security_invoker = true);
ALTER VIEW public.v_act_expense_by_project SET (security_invoker = true);
ALTER VIEW public.v_act_income_by_funder   SET (security_invoker = true);
ALTER VIEW public.v_act_income_by_project  SET (security_invoker = true);
ALTER VIEW public.v_funder_next_move       SET (security_invoker = true);
REVOKE ALL ON public.v_act_expense_by_payee, public.v_act_expense_by_project, public.v_act_income_by_funder,
  public.v_act_income_by_project, public.v_funder_next_move FROM anon, authenticated;
GRANT SELECT ON public.v_act_expense_by_payee, public.v_act_expense_by_project, public.v_act_income_by_funder,
  public.v_act_income_by_project, public.v_funder_next_move TO service_role;
COMMIT;
-- Post-check with the publishable key: each view must return 401. Service role: SELECT count(*) FROM v_act_income_by_funder;
