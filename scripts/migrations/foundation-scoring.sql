-- foundation-scoring.sql
-- Composite foundation scores: transparency, need alignment, evidence, concentration
-- Each score 0-100, combined into overall foundation_score

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_scores;
CREATE MATERIALIZED VIEW mv_foundation_scores AS
WITH foundation_base AS (
  SELECT
    f.id as foundation_id,
    f.name,
    f.acnc_abn,
    f.total_giving_annual,
    f.type,
    f.parent_company,
    f.thematic_focus,
    f.geographic_focus
  FROM foundations f
  WHERE f.acnc_abn IS NOT NULL
    AND f.total_giving_annual > 100000
),
-- Transparency: do they have visible grantee data?
transparency AS (
  SELECT
    fb.foundation_id,
    COUNT(DISTINCT fg.grantee_abn) as grantee_count,
    COUNT(DISTINCT fg.link_method) as link_methods,
    LEAST(100, COUNT(DISTINCT fg.grantee_abn) * 5) as transparency_score
  FROM foundation_base fb
  LEFT JOIN mv_foundation_grantees fg ON fg.foundation_abn = fb.acnc_abn
  GROUP BY fb.foundation_id
),
-- Need alignment: are they funding disadvantaged areas?
need_align AS (
  SELECT
    fb.foundation_id,
    COUNT(DISTINCT fna.lga_name) as lgas_funded,
    COALESCE(AVG(fna.desert_score), 0) as avg_desert_score,
    COALESCE(AVG(fna.avg_lga_disadvantage), 5) as avg_disadvantage,
    SUM(fna.community_controlled_count) as community_controlled_grantees,
    -- Higher desert score = funding goes to needier areas = better alignment
    LEAST(100, COALESCE(AVG(fna.desert_score), 0) * 1.2) as need_alignment_score
  FROM foundation_base fb
  LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb.acnc_abn
  GROUP BY fb.foundation_id
),
-- Evidence: what % of grantees have ALMA evidence?
evidence AS (
  SELECT
    fb.foundation_id,
    COUNT(DISTINCT ebf.grantee_abn) as evidence_backed_orgs,
    COUNT(DISTINCT ebf.intervention_name) as interventions,
    COALESCE(AVG(ebf.portfolio_score), 0) as avg_portfolio_score,
    -- Score based on evidence coverage
    CASE
      WHEN t.grantee_count = 0 THEN 0
      ELSE LEAST(100, (COUNT(DISTINCT ebf.grantee_abn)::float / GREATEST(t.grantee_count, 1) * 100 * 2))
    END as evidence_score
  FROM foundation_base fb
  LEFT JOIN mv_evidence_backed_funding ebf ON ebf.foundation_abn = fb.acnc_abn
  LEFT JOIN transparency t ON t.foundation_id = fb.foundation_id
  GROUP BY fb.foundation_id, t.grantee_count
),
-- Concentration: geographic and sector diversity
concentration AS (
  SELECT
    fb.foundation_id,
    COUNT(DISTINCT fna.state) as states_funded,
    COUNT(DISTINCT fna.remoteness) as remoteness_categories,
    COUNT(DISTINCT fna.lga_name) as unique_lgas,
    -- More diverse = higher score
    LEAST(100,
      COALESCE(COUNT(DISTINCT fna.state), 0) * 10 +
      COALESCE(COUNT(DISTINCT fna.remoteness), 0) * 10 +
      LEAST(50, COALESCE(COUNT(DISTINCT fna.lga_name), 0))
    ) as concentration_score
  FROM foundation_base fb
  LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb.acnc_abn
  GROUP BY fb.foundation_id
),
-- Revolving door: trustee overlap with grantee boards
governance AS (
  SELECT
    fb.foundation_id,
    COUNT(DISTINCT tgc.trustee_name) as total_trustees,
    COUNT(DISTINCT tgc.trustee_name) FILTER (WHERE tgc.trustee_on_grantee_board) as overlapping_trustees,
    COUNT(*) FILTER (WHERE tgc.trustee_on_grantee_board) as overlap_instances
  FROM foundation_base fb
  LEFT JOIN mv_trustee_grantee_chain tgc ON tgc.foundation_abn = fb.acnc_abn
  GROUP BY fb.foundation_id
)
SELECT
  fb.foundation_id,
  fb.name,
  fb.acnc_abn,
  fb.total_giving_annual,
  fb.type,
  fb.parent_company,
  -- Individual scores
  COALESCE(t.transparency_score, 0)::int as transparency_score,
  COALESCE(na.need_alignment_score, 0)::int as need_alignment_score,
  COALESCE(ev.evidence_score, 0)::int as evidence_score,
  COALESCE(co.concentration_score, 0)::int as concentration_score,
  -- Composite score (weighted average)
  (
    COALESCE(t.transparency_score, 0) * 0.25 +
    COALESCE(na.need_alignment_score, 0) * 0.30 +
    COALESCE(ev.evidence_score, 0) * 0.25 +
    COALESCE(co.concentration_score, 0) * 0.20
  )::int as foundation_score,
  -- Detail fields
  COALESCE(t.grantee_count, 0) as grantee_count,
  COALESCE(na.lgas_funded, 0) as lgas_funded,
  COALESCE(na.avg_desert_score, 0)::numeric(5,1) as avg_desert_score,
  COALESCE(na.community_controlled_grantees, 0) as community_controlled_grantees,
  COALESCE(ev.evidence_backed_orgs, 0) as evidence_backed_orgs,
  COALESCE(ev.interventions, 0) as interventions_funded,
  COALESCE(co.states_funded, 0) as states_funded,
  COALESCE(co.unique_lgas, 0) as unique_lgas,
  COALESCE(g.total_trustees, 0) as total_trustees,
  COALESCE(g.overlapping_trustees, 0) as overlapping_trustees,
  COALESCE(g.overlap_instances, 0) as overlap_instances
FROM foundation_base fb
LEFT JOIN transparency t ON t.foundation_id = fb.foundation_id
LEFT JOIN need_align na ON na.foundation_id = fb.foundation_id
LEFT JOIN evidence ev ON ev.foundation_id = fb.foundation_id
LEFT JOIN concentration co ON co.foundation_id = fb.foundation_id
LEFT JOIN governance g ON g.foundation_id = fb.foundation_id;

CREATE UNIQUE INDEX ON mv_foundation_scores (foundation_id);
CREATE INDEX ON mv_foundation_scores (foundation_score DESC);
CREATE INDEX ON mv_foundation_scores (acnc_abn);
