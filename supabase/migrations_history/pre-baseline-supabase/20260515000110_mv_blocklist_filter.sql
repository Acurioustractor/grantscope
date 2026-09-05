-- Phase 7 — wire funder_blocklist into the recommendations MV
-- Excludes opportunities from blocklisted funders so passed-pattern grants disappear

DROP MATERIALIZED VIEW IF EXISTS act_grant_recommendations CASCADE;

CREATE MATERIALIZED VIEW act_grant_recommendations AS
WITH project_themes AS (
  SELECT
    arp.project_code,
    p.name AS project_name,
    arp.theme_keywords,
    arp.home_states,
    arp.secondary_states
  FROM act_grant_recommendation_projects arp
  JOIN projects p ON p.code = arp.project_code
  WHERE arp.in_scope = true
),
opps AS (
  SELECT a.*
  FROM alma_funding_opportunities a
  WHERE COALESCE(a.status, 'open') NOT IN ('archived','closed','cancelled','rejected')
    AND (a.deadline IS NULL OR a.deadline >= now())
    AND a.opportunity_type = 'open_grant'
    AND a.verification_status = 'verified'
    -- Phase 7: exclude blocklisted funders (learned from passed decisions)
    AND NOT EXISTS (
      SELECT 1 FROM funder_blocklist b
      WHERE b.active = true
        AND lower(b.funder_name) = lower(a.funder_name)
    )
),
scored AS (
  SELECT
    pt.project_code,
    pt.project_name,
    o.id AS opportunity_id,
    o.name AS opportunity_name,
    o.funder_name,
    o.deadline,
    o.opens_at,
    o.min_grant_amount,
    o.max_grant_amount,
    o.is_national,
    o.jurisdictions,
    o.eligible_org_types,
    o.focus_areas,
    o.keywords,
    o.source_url,
    o.application_url,
    o.opportunity_type,
    o.verification_status,
    o.verified_at,

    LEAST(50,
      (SELECT COUNT(DISTINCT pk) * 10
       FROM unnest(pt.theme_keywords) pk
       WHERE length(pk) >= 4
         AND EXISTS (
           SELECT 1
           FROM unnest(COALESCE(o.focus_areas, '{}'::text[]) || COALESCE(o.keywords, '{}'::text[])) okw
           WHERE length(okw) >= 4
             AND (lower(okw) LIKE '%' || lower(pk) || '%'
               OR lower(pk)  LIKE '%' || lower(okw) || '%')
         ))
    )::int AS theme_score,

    CASE
      WHEN o.is_national THEN 15
      WHEN o.jurisdictions && pt.home_states THEN 15
      WHEN o.jurisdictions && pt.secondary_states THEN 9
      ELSE 0
    END AS geography_score,

    CASE
      WHEN o.eligible_org_types && ARRAY['charity','company','community_organisation','social_enterprise','arts_organisation','collective']::text[] THEN 20
      WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org','community_org']::text[] THEN 10
      ELSE 5
    END AS eligibility_score,

    CASE
      WHEN o.deadline IS NULL THEN 8
      WHEN o.deadline >= now() + interval '30 days' THEN 15
      WHEN o.deadline >= now() + interval '7 days'  THEN 8
      WHEN o.deadline >= now()                       THEN 4
      ELSE 0
    END AS timing_score,

    ARRAY_REMOVE(ARRAY[
      CASE WHEN o.requires_deductible_gift_recipient THEN 'requires_dgr' END,
      CASE
        WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org']::text[]
         AND NOT (o.eligible_org_types && ARRAY['charity','company','community_organisation']::text[])
        THEN 'partner_required'
      END,
      CASE WHEN o.deadline IS NOT NULL AND o.deadline < now() + interval '14 days' THEN 'tight_deadline' END,
      CASE WHEN o.is_national THEN 'national' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount >= 500000 THEN 'large_grant' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount < 50000  THEN 'small_grant' END
    ], NULL) AS flags
  FROM project_themes pt
  CROSS JOIN opps o
)
SELECT
  project_code, project_name, opportunity_id, opportunity_name, funder_name,
  deadline, opens_at, min_grant_amount, max_grant_amount, is_national,
  jurisdictions, eligible_org_types, focus_areas, keywords,
  source_url, application_url, opportunity_type, verification_status, verified_at,
  theme_score, geography_score, eligibility_score, timing_score,
  (theme_score + geography_score + eligibility_score + timing_score) AS fit_score,
  (theme_score > 0 AND (theme_score + geography_score + eligibility_score + timing_score) >= 55) AS is_strong_fit,
  flags,
  now() AS computed_at
FROM scored;

CREATE UNIQUE INDEX idx_act_grant_rec_pk
  ON act_grant_recommendations (project_code, opportunity_id);
CREATE INDEX idx_act_grant_rec_score
  ON act_grant_recommendations (fit_score DESC);
CREATE INDEX idx_act_grant_rec_strong
  ON act_grant_recommendations (project_code, is_strong_fit, fit_score DESC);

COMMENT ON MATERIALIZED VIEW act_grant_recommendations IS
  'v5: data quality gate + funder_blocklist filter (Phase 7 closed-loop learning). Excludes opps from funders the user has consistently passed on.';
