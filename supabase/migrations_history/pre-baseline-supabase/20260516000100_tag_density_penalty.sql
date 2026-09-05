-- Tag-density penalty for act_grant_recommendations
--
-- Problem: some funders tag every program with 10-20+ generic categories
-- (Rio Tinto Foundation avg 23.3 tags/opp, Goodman 20, McCusker 19). This
-- means every project's theme keywords match — even ACT-EL "indigenous +
-- arts + culture" matches a Rio Tinto Community Giving program because
-- Rio Tinto lists "indigenous, arts, education, health, environment,
-- cultural_heritage, employment, human_rights, youth, sport" on every opp.
-- Result: ACT-EL strong fits include generic Rio Tinto grants that aren't
-- actually about storytelling/voice/empathy work.
--
-- Fix: per-funder avg-tag-count view. If avg ≥ 15, halve the theme_score.
-- Calibrated so PRF (14.2) and Minderoo (14.5) escape — those are warm
-- funders we actually pitch — while Rio Tinto, Goodman, McCusker get pulled
-- down to a more honest score.
--
-- Adds `tag_density_penalised boolean` column to the MV so the UI can
-- show a "noisy tagger" flag if needed.

CREATE OR REPLACE VIEW v_funder_tag_density AS
SELECT
  funder_name,
  COUNT(*) AS opp_count,
  ROUND(AVG(array_length(COALESCE(focus_areas, '{}'::text[]) || COALESCE(keywords, '{}'::text[]), 1)), 1)::numeric AS avg_tag_count,
  CASE
    WHEN AVG(array_length(COALESCE(focus_areas, '{}'::text[]) || COALESCE(keywords, '{}'::text[]), 1)) >= 15 THEN 0.5
    ELSE 1.0
  END::numeric AS theme_multiplier
FROM alma_funding_opportunities
WHERE opportunity_type = 'open_grant'
  AND verification_status = 'verified'
  AND funder_name IS NOT NULL
GROUP BY funder_name;

COMMENT ON VIEW v_funder_tag_density IS
  'Per-funder avg tag count. theme_multiplier=0.5 when avg_tag_count>=15 (tag-stuffers).';

-- Now recreate the MV with the penalty applied + new tag_density_penalised flag.
DROP MATERIALIZED VIEW IF EXISTS act_grant_recommendations CASCADE;

CREATE MATERIALIZED VIEW act_grant_recommendations AS
WITH project_themes AS (
  SELECT arp.project_code,
    p.name AS project_name,
    arp.theme_keywords,
    arp.home_states,
    arp.secondary_states
  FROM act_grant_recommendation_projects arp
  JOIN projects p ON p.code = arp.project_code
  WHERE arp.in_scope = true
),
opps AS (
  SELECT
    a.id,
    a.name,
    a.funder_name,
    a.min_grant_amount,
    a.max_grant_amount,
    a.opens_at,
    a.deadline,
    a.jurisdictions,
    a.is_national,
    a.eligible_org_types,
    a.requires_deductible_gift_recipient,
    a.focus_areas,
    a.keywords,
    a.source_url,
    a.application_url,
    a.opportunity_type,
    a.verification_status,
    a.verified_at
  FROM alma_funding_opportunities a
  WHERE COALESCE(a.status, 'open') NOT IN ('archived', 'closed', 'cancelled', 'rejected')
    AND (a.deadline IS NULL OR a.deadline >= now())
    AND a.opportunity_type = 'open_grant'
    AND a.verification_status = 'verified'
    AND NOT EXISTS (
      SELECT 1 FROM funder_blocklist b
      WHERE b.active = true AND lower(b.funder_name) = lower(a.funder_name)
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
    -- Raw theme score (capped 50)
    LEAST(50, (
      SELECT COUNT(DISTINCT pk.pk) * 10
      FROM unnest(pt.theme_keywords) pk(pk)
      WHERE length(pk.pk) >= 4
        AND EXISTS (
          SELECT 1
          FROM unnest(COALESCE(o.focus_areas, '{}'::text[]) || COALESCE(o.keywords, '{}'::text[])) okw(okw)
          WHERE length(okw.okw) >= 4
            AND (lower(okw.okw) LIKE '%' || lower(pk.pk) || '%' OR lower(pk.pk) LIKE '%' || lower(okw.okw) || '%')
        )
    ))::numeric AS theme_score_raw,
    COALESCE(tdp.theme_multiplier, 1.0) AS theme_multiplier,
    COALESCE(tdp.avg_tag_count, 0)::numeric AS funder_avg_tags,
    CASE
      WHEN o.is_national THEN 15
      WHEN o.jurisdictions && pt.home_states THEN 15
      WHEN o.jurisdictions && pt.secondary_states THEN 9
      ELSE 0
    END AS geography_score,
    CASE
      WHEN o.eligible_org_types && ARRAY['charity', 'company', 'community_organisation', 'social_enterprise', 'arts_organisation', 'collective'] THEN 20
      WHEN o.eligible_org_types && ARRAY['aboriginal_corporation', 'indigenous_charity', 'indigenous_org', 'community_org'] THEN 10
      ELSE 5
    END AS eligibility_score,
    CASE
      WHEN o.deadline IS NULL THEN 8
      WHEN o.deadline >= now() + INTERVAL '30 days' THEN 15
      WHEN o.deadline >= now() + INTERVAL '7 days' THEN 8
      WHEN o.deadline >= now() THEN 4
      ELSE 0
    END AS timing_score,
    array_remove(ARRAY[
      CASE WHEN o.requires_deductible_gift_recipient THEN 'requires_dgr' ELSE NULL END,
      CASE WHEN o.eligible_org_types && ARRAY['aboriginal_corporation', 'indigenous_charity', 'indigenous_org']
              AND NOT (o.eligible_org_types && ARRAY['charity', 'company', 'community_organisation'])
           THEN 'partner_required' ELSE NULL END,
      CASE WHEN o.deadline IS NOT NULL AND o.deadline < now() + INTERVAL '14 days' THEN 'tight_deadline' ELSE NULL END,
      CASE WHEN o.is_national THEN 'national' ELSE NULL END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount >= 500000 THEN 'large_grant' ELSE NULL END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount < 50000 THEN 'small_grant' ELSE NULL END,
      CASE WHEN COALESCE(tdp.theme_multiplier, 1.0) < 1.0 THEN 'tag_stuffed' ELSE NULL END
    ], NULL::text) AS flags
  FROM project_themes pt
  CROSS JOIN opps o
  LEFT JOIN v_funder_tag_density tdp ON tdp.funder_name = o.funder_name
)
SELECT
  project_code,
  project_name,
  opportunity_id,
  opportunity_name,
  funder_name,
  deadline,
  opens_at,
  min_grant_amount,
  max_grant_amount,
  is_national,
  jurisdictions,
  eligible_org_types,
  focus_areas,
  keywords,
  source_url,
  application_url,
  opportunity_type,
  verification_status,
  verified_at,
  -- Apply tag-density penalty to the final theme_score
  ROUND(theme_score_raw * theme_multiplier)::integer AS theme_score,
  geography_score,
  eligibility_score,
  timing_score,
  ROUND(theme_score_raw * theme_multiplier)::integer + geography_score + eligibility_score + timing_score AS fit_score,
  (ROUND(theme_score_raw * theme_multiplier)::integer > 0
    AND (ROUND(theme_score_raw * theme_multiplier)::integer + geography_score + eligibility_score + timing_score) >= 55) AS is_strong_fit,
  (theme_multiplier < 1.0) AS tag_density_penalised,
  funder_avg_tags,
  flags,
  now() AS computed_at
FROM scored;

-- Recreate the unique index needed for CONCURRENTLY refresh
CREATE UNIQUE INDEX act_grant_recommendations_pk_idx
  ON act_grant_recommendations (project_code, opportunity_id);

CREATE INDEX act_grant_recommendations_strong_idx
  ON act_grant_recommendations (is_strong_fit) WHERE is_strong_fit;

COMMENT ON MATERIALIZED VIEW act_grant_recommendations IS
  'Fit-scored grant opportunities x ACT projects. Theme score halved for funders that stuff 15+ tags per opp (tag_density_penalised=true).';
