-- foundation-readiness.sql
-- Foundation readiness view: shows which foundations are "ready" for grantee scraping
-- Checks: has ABN, has gs_entity, has AIS data, has grantees, has score

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_readiness;
CREATE MATERIALIZED VIEW mv_foundation_readiness AS
WITH foundation_base AS (
  SELECT
    f.id,
    f.name,
    f.acnc_abn,
    f.type,
    f.total_giving_annual,
    f.acnc_data IS NOT NULL AS has_ais_data,
    f.enrichment_source,
    f.profile_confidence
  FROM foundations f
  WHERE f.type NOT IN ('university', 'legal_aid', 'primary_health_network',
                        'religious_organisation', 'education_body', 'hospital',
                        'service_delivery', 'unknown')
),
entity_match AS (
  SELECT DISTINCT ON (fb.id)
    fb.id AS foundation_id,
    e.gs_id,
    e.id AS entity_uuid
  FROM foundation_base fb
  JOIN gs_entities e ON e.abn = fb.acnc_abn
  WHERE fb.acnc_abn IS NOT NULL
),
grantee_counts AS (
  SELECT foundation_abn, COUNT(*) AS grantee_count
  FROM mv_foundation_grantees
  GROUP BY foundation_abn
),
score_lookup AS (
  SELECT DISTINCT ON (acnc_abn) acnc_abn AS score_abn, foundation_score,
    CASE
      WHEN foundation_score >= 50 THEN 'high'
      WHEN foundation_score >= 20 THEN 'medium'
      ELSE 'low'
    END AS score_tier
  FROM mv_foundation_scores
  WHERE acnc_abn IS NOT NULL
  ORDER BY acnc_abn, foundation_score DESC
)
SELECT
  fb.id,
  fb.name,
  fb.acnc_abn,
  fb.type,
  fb.total_giving_annual::bigint,
  -- Readiness flags
  fb.acnc_abn IS NOT NULL AS has_abn,
  em.gs_id IS NOT NULL AS has_entity,
  fb.has_ais_data,
  COALESCE(gc.grantee_count, 0)::int AS grantee_count,
  gc.grantee_count IS NOT NULL AS has_grantees,
  sl.foundation_score IS NOT NULL AS has_score,
  sl.foundation_score,
  sl.score_tier,
  -- Readiness score (0-5): each flag adds 1 point
  (CASE WHEN fb.acnc_abn IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN em.gs_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN fb.has_ais_data THEN 1 ELSE 0 END
   + CASE WHEN gc.grantee_count IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN sl.foundation_score IS NOT NULL THEN 1 ELSE 0 END
  )::int AS readiness_score,
  -- Summary
  em.gs_id,
  fb.enrichment_source,
  fb.profile_confidence
FROM foundation_base fb
LEFT JOIN entity_match em ON em.foundation_id = fb.id
LEFT JOIN grantee_counts gc ON gc.foundation_abn = fb.acnc_abn
LEFT JOIN score_lookup sl ON sl.score_abn = fb.acnc_abn
ORDER BY fb.total_giving_annual DESC NULLS LAST;

CREATE UNIQUE INDEX ON mv_foundation_readiness (id);
CREATE INDEX ON mv_foundation_readiness (readiness_score);
CREATE INDEX ON mv_foundation_readiness (type);
CREATE INDEX ON mv_foundation_readiness (acnc_abn);
