-- Rolling funding lane (Ben's call, 2026-08-07)
--
-- The ACT feed disqualified any opportunity without a deadline. That gate was
-- the binding constraint: 518 of 662 quarantined open_grant rows failed on
-- `missing_current_round_timing` alone, and rolling philanthropic programs —
-- QBE Foundation Local Grants, BHP Community Grants, IBA Start-Up Finance —
-- have no deadline by nature. The gate excluded ongoing philanthropy by design.
--
-- "No deadline" is not the same as "we don't know the timing". A row that is
-- verified live right now, with both URLs present, and no deadline, is an open
-- rolling program. The verification requirements already carry that proof, so
-- timing becomes a routing signal rather than a hard failure:
--
--   apply_now   — dated, verified, deadline in future   (rank by urgency)
--   rolling     — verified, no deadline                 (rank by fit)
--   quarantined — unverified / stale / past / no source (excluded)
--
-- Rollback: restore the seventh CASE arm to `failed_requirements`, change the
-- divisor back to 7, and drop 'rolling' from the WHERE in the second view.

BEGIN;

CREATE OR REPLACE VIEW act_funding_opportunity_current_status AS
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
      CASE WHEN opportunity.verified_at < (now() - '7 days'::interval) THEN 'stale_verification' END,
      CASE WHEN NULLIF(TRIM(BOTH FROM opportunity.source_url), '') IS NULL THEN 'missing_official_source' END,
      CASE WHEN NULLIF(TRIM(BOTH FROM opportunity.application_url), '') IS NULL THEN 'missing_application_url' END,
      -- `missing_current_round_timing` deliberately removed: a null deadline now
      -- routes to the rolling lane instead of failing the row.
      CASE WHEN opportunity.deadline < now() THEN 'past_deadline' END
    ], NULL::text) AS failed_requirements
  FROM alma_funding_opportunities opportunity
  WHERE opportunity.opportunity_type = 'open_grant'
)
SELECT
  opportunity_id,
  CASE
    WHEN cardinality(failed_requirements) > 0 THEN 'quarantined'
    WHEN deadline IS NULL THEN 'rolling'
    ELSE 'apply_now'
  END AS feed_status,
  failed_requirements,
  GREATEST(0::numeric, round((6 - cardinality(failed_requirements))::numeric / 6::numeric * 100::numeric))::integer AS evidence_completeness,
  verification_status,
  verified_at,
  deadline,
  source_url,
  application_url
FROM assessed;

-- Recommendations follow the feed. `feed_status` is exposed so the UI can rank
-- dated rounds by urgency and rolling programs by fit without a second query.
CREATE OR REPLACE VIEW act_grant_recommendations_current AS
SELECT
  recommendation.project_code,
  recommendation.project_name,
  recommendation.opportunity_id,
  recommendation.opportunity_name,
  recommendation.funder_name,
  recommendation.deadline,
  recommendation.opens_at,
  recommendation.min_grant_amount,
  recommendation.max_grant_amount,
  recommendation.is_national,
  recommendation.jurisdictions,
  recommendation.eligible_org_types,
  recommendation.focus_areas,
  recommendation.keywords,
  recommendation.source_url,
  recommendation.application_url,
  recommendation.opportunity_type,
  recommendation.verification_status,
  recommendation.verified_at,
  recommendation.theme_score,
  recommendation.geography_score,
  recommendation.eligibility_score,
  recommendation.timing_score,
  recommendation.track_record_score,
  recommendation.won_funder,
  recommendation.fit_score,
  recommendation.is_strong_fit,
  recommendation.tag_density_penalised,
  recommendation.funder_avg_tags,
  recommendation.flags,
  recommendation.computed_at,
  current_status.feed_status
FROM act_grant_recommendations recommendation
JOIN act_funding_opportunity_current_status current_status
  ON current_status.opportunity_id = recommendation.opportunity_id
WHERE current_status.feed_status IN ('apply_now', 'rolling');

COMMIT;
