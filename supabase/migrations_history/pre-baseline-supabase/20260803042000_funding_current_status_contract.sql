-- FUND-102: evidence-backed current-status contract.
-- A reachable page is not sufficient proof that a named funding round is open.

CREATE OR REPLACE VIEW public.act_funding_opportunity_current_status AS
WITH assessed AS (
  SELECT
    opportunity.id AS opportunity_id,
    opportunity.verification_status,
    opportunity.verified_at,
    opportunity.deadline,
    opportunity.source_url,
    opportunity.application_url,
    array_remove(ARRAY[
      CASE WHEN opportunity.verification_status IS DISTINCT FROM 'verified' THEN 'not_verified' END,
      CASE WHEN opportunity.verified_at IS NULL THEN 'missing_verification_timestamp' END,
      CASE WHEN opportunity.verified_at < now() - interval '7 days' THEN 'stale_verification' END,
      CASE WHEN NULLIF(trim(opportunity.source_url), '') IS NULL THEN 'missing_official_source' END,
      CASE WHEN NULLIF(trim(opportunity.application_url), '') IS NULL THEN 'missing_application_url' END,
      CASE WHEN opportunity.deadline IS NULL THEN 'missing_current_round_timing' END,
      CASE WHEN opportunity.deadline < now() THEN 'past_deadline' END
    ], NULL::text) AS failed_requirements
  FROM public.alma_funding_opportunities opportunity
  WHERE opportunity.opportunity_type = 'open_grant'
)
SELECT
  opportunity_id,
  CASE WHEN cardinality(failed_requirements) = 0 THEN 'apply_now' ELSE 'quarantined' END AS feed_status,
  failed_requirements,
  greatest(0, round(((7 - cardinality(failed_requirements))::numeric / 7) * 100))::integer AS evidence_completeness,
  verification_status,
  verified_at,
  deadline,
  source_url,
  application_url
FROM assessed;

COMMENT ON VIEW public.act_funding_opportunity_current_status IS
  'Evidence-backed current-status contract. Only apply_now rows may appear in current project funding feeds.';

CREATE OR REPLACE VIEW public.act_grant_recommendations_current AS
SELECT recommendation.*
FROM public.act_grant_recommendations recommendation
JOIN public.act_funding_opportunity_current_status current_status
  ON current_status.opportunity_id = recommendation.opportunity_id
WHERE current_status.feed_status = 'apply_now';

COMMENT ON VIEW public.act_grant_recommendations_current IS
  'Current project recommendations filtered through the FUND-102 evidence contract; unsupported rows remain preserved in the legacy materialized view.';

GRANT SELECT ON public.act_funding_opportunity_current_status TO anon, authenticated, service_role;
GRANT SELECT ON public.act_grant_recommendations_current TO anon, authenticated, service_role;
