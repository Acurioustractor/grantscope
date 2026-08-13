CREATE OR REPLACE FUNCTION public.get_funding_operating_report()
RETURNS jsonb
LANGUAGE sql
STABLE
SET statement_timeout = '8s'
AS $fn$
WITH latest_runs AS (
  SELECT DISTINCT ON (agent_id) agent_id, status, started_at
  FROM public.agent_runs
  WHERE agent_id ILIKE '%grant%'
  ORDER BY agent_id, started_at DESC
), reason_counts AS (
  SELECT replace(COALESCE(NULLIF(judgment->>'dismissalReason', ''), NULLIF(reason, ''), 'other'), '_', ' ') AS reason,
         count(*)::int AS count
  FROM public.opportunity_decisions
  WHERE source_type = 'grant' AND decision = 'no' AND created_at >= now() - interval '30 days'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 6
), deadlines AS (
  SELECT id, name, provider, deadline, goods_relevance_score
  FROM public.grant_opportunities
  WHERE status IN ('open', 'ongoing', 'upcoming')
    AND deadline BETWEEN current_date AND current_date + 60
  ORDER BY deadline LIMIT 12
), overdue AS (
  SELECT id, display_name, next_action, next_action_due
  FROM public.goods_relationships
  WHERE next_action_due < current_date AND stage NOT IN ('declined', 'dormant')
  ORDER BY next_action_due LIMIT 20
)
SELECT jsonb_build_object(
  'generatedAt', now(),
  'newOpportunities', (SELECT count(*) FROM public.grant_opportunities WHERE created_at >= date_trunc('week', now())),
  'promotedThisWeek', (SELECT count(*) FROM public.opportunity_promotions WHERE source_type = 'grant' AND status = 'promoted' AND promoted_at >= date_trunc('week', now())),
  'dismissedThisWeek', (SELECT count(*) FROM public.opportunity_decisions WHERE source_type = 'grant' AND decision = 'no' AND created_at >= date_trunc('week', now())),
  'deadlines', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'provider', provider, 'deadline', deadline, 'score', goods_relevance_score) ORDER BY deadline) FROM deadlines), '[]'::jsonb),
  'overdueRelationships', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'action', COALESCE(next_action, 'Set the next relationship action'), 'due', next_action_due) ORDER BY next_action_due) FROM overdue), '[]'::jsonb),
  'dismissalReasons', COALESCE((SELECT jsonb_agg(to_jsonb(reason_counts)) FROM reason_counts), '[]'::jsonb),
  'sourceHealth', jsonb_build_object(
    'enabled', (SELECT count(*) FROM public.agent_schedules WHERE agent_id ILIKE '%grant%' AND enabled),
    'stale', (SELECT count(*) FROM public.agent_schedules WHERE agent_id ILIKE '%grant%' AND enabled AND (last_run_at IS NULL OR last_run_at < now() - interval '3 days')),
    'failed', (SELECT count(*) FROM latest_runs WHERE status IN ('failed', 'timeout', 'partial'))
  )
);
$fn$;

REVOKE ALL ON FUNCTION public.get_funding_operating_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funding_operating_report() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_funding_operating_report() IS 'Bounded weekly funding, relationship, source-health and decision-learning report used by UI and delivery jobs.';
