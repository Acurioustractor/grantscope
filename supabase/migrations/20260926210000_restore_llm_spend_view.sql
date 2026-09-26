-- Put back v_llm_spend_monthly, which 20260926180000_drop_unused_views.sql dropped as unused. It is not unused:
-- JusticeHub's /api/admin/running-costs reads it (src/app/api/admin/running-costs/route.ts, since JusticeHub #463 on
-- 2026-08-30) for this month's model calls and how many of them cannot be priced. The drop's reference scan read the
-- JusticeHub folder while it was checked out on a branch older than that route, so it found no reader. The route does
-- not check the read's error, so since the drop it has reported zero model calls instead of failing.
--
-- Same definition as before (thoughts/shared/data-map/dropped-views-2026-09-26.sql), with one change: it was a
-- SECURITY DEFINER view and comes back WITH (security_invoker = true), the platform rule for new views. The reader
-- that matters is service_role, which bypasses RLS, so it sees what it saw before. Grants are the two it had before,
-- service_role and agent_readonly; nothing to anon or authenticated. agent_readonly does not bypass RLS, so under
-- security_invoker it sees only what the llm_usage and api_pricing policies let it see.
--
-- Registered to justicehub, so the next unused-object pass finds a named reader.
--
-- Undo: DROP VIEW public.v_llm_spend_monthly; DELETE FROM schema_ownership WHERE object = 'v_llm_spend_monthly';
-- Apply: scripts/db-apply.sh supabase/migrations/20260926210000_restore_llm_spend_view.sql (Tier 3, Ben's verb)

BEGIN;

CREATE VIEW public.v_llm_spend_monthly WITH (security_invoker = true) AS
 SELECT date_trunc('month'::text, u.created_at) AS month,
    u.provider,
    u.model,
    count(*) AS calls,
    count(*) FILTER (WHERE p.input_price_per_1m IS NULL) AS unpriced_calls,
    sum(u.input_tokens) AS input_tokens,
    sum(u.output_tokens) AS output_tokens,
    round(sum(u.input_tokens::numeric / 1000000.0 * p.input_price_per_1m + u.output_tokens::numeric / 1000000.0 * p.output_price_per_1m), 4) AS priced_cost_usd
   FROM llm_usage u
     LEFT JOIN api_pricing p ON p.provider = u.provider AND p.model = u.model AND p.endpoint = COALESCE(u.endpoint, 'chat'::text) AND p.effective_from <= u.created_at::date AND (p.effective_until IS NULL OR p.effective_until > u.created_at::date)
  GROUP BY (date_trunc('month'::text, u.created_at)), u.provider, u.model;

COMMENT ON VIEW public.v_llm_spend_monthly IS 'Monthly model spend per provider/model. priced_cost_usd is NULL or partial when unpriced_calls > 0: check that column before quoting the cost. GH #450. Read by JusticeHub /api/admin/running-costs.';

REVOKE ALL ON public.v_llm_spend_monthly FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_llm_spend_monthly TO service_role, agent_readonly;

INSERT INTO schema_ownership (object, owner, consumers, evidence, declared_on) VALUES
  ('v_llm_spend_monthly', 'justicehub', ARRAY['justicehub']::text[], 'restored 2026-09-26 after 20260926180000 dropped it: read by justicehub src/app/api/admin/running-costs/route.ts (JusticeHub #463)', '2026-09-26')
ON CONFLICT (object) DO UPDATE SET owner = EXCLUDED.owner, consumers = EXCLUDED.consumers, evidence = EXCLUDED.evidence, declared_on = EXCLUDED.declared_on;

COMMIT;
