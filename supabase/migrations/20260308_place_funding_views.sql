-- Materialized views for place-based funding analysis
-- Sprint B5: Performance optimization for community funding gap packs

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funding_by_postcode AS
SELECT
  e.postcode,
  e.state,
  pg.remoteness_2021 AS remoteness,
  s.decile_national AS seifa_irsd_decile,
  pg.locality,
  COUNT(DISTINCT e.id) AS entity_count,
  COUNT(DISTINCT e.id) FILTER (WHERE e.is_community_controlled) AS community_controlled_count,
  COALESCE(SUM(r.amount), 0) AS total_funding,
  COALESCE(SUM(r.amount) FILTER (WHERE e.is_community_controlled), 0) AS community_controlled_funding,
  COUNT(DISTINCT r.id) AS relationship_count
FROM gs_entities e
LEFT JOIN gs_relationships r ON r.target_entity_id = e.id
  AND r.relationship_type IN ('grant', 'contract', 'donation')
LEFT JOIN (SELECT DISTINCT ON (postcode) postcode, remoteness_2021, locality FROM postcode_geo) pg
  ON pg.postcode = e.postcode
LEFT JOIN seifa_2021 s ON s.postcode = e.postcode AND s.index_type = 'IRSD'
WHERE e.postcode IS NOT NULL
GROUP BY e.postcode, e.state, pg.remoteness_2021, s.decile_national, pg.locality;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funding_postcode ON mv_funding_by_postcode(postcode, state);
CREATE INDEX IF NOT EXISTS idx_mv_funding_state ON mv_funding_by_postcode(state);
CREATE INDEX IF NOT EXISTS idx_mv_funding_remoteness ON mv_funding_by_postcode(remoteness);
CREATE INDEX IF NOT EXISTS idx_mv_funding_seifa ON mv_funding_by_postcode(seifa_irsd_decile);

-- RPC function for gap analysis
CREATE OR REPLACE FUNCTION get_funding_gaps(
  p_state text DEFAULT NULL,
  p_remoteness text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  postcode text,
  state text,
  remoteness text,
  locality text,
  seifa_irsd_decile smallint,
  entity_count bigint,
  community_controlled_count bigint,
  total_funding numeric,
  community_controlled_funding numeric,
  external_share numeric,
  gap_score numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.postcode,
    m.state,
    m.remoteness,
    m.locality,
    m.seifa_irsd_decile::smallint,
    m.entity_count,
    m.community_controlled_count,
    m.total_funding,
    m.community_controlled_funding,
    CASE WHEN m.entity_count > 0
      THEN 1.0 - (m.community_controlled_count::numeric / m.entity_count)
      ELSE 1.0
    END AS external_share,
    -- Gap score: external dominance * disadvantage * remoteness
    ROUND((
      CASE WHEN m.entity_count > 0
        THEN 1.0 - (m.community_controlled_count::numeric / m.entity_count)
        ELSE 1.0
      END
      * (11.0 - COALESCE(m.seifa_irsd_decile, 5)) / 10.0
      * CASE
          WHEN m.remoteness ILIKE '%very remote%' THEN 1.0
          WHEN m.remoteness ILIKE '%remote%' THEN 0.8
          WHEN m.remoteness ILIKE '%outer%' THEN 0.6
          WHEN m.remoteness ILIKE '%inner%' THEN 0.4
          ELSE 0.2
        END
      * 100
    ), 1) AS gap_score
  FROM mv_funding_by_postcode m
  WHERE m.entity_count > 0
    AND (p_state IS NULL OR m.state = p_state)
    AND (p_remoteness IS NULL OR m.remoteness ILIKE '%' || p_remoteness || '%')
  ORDER BY gap_score DESC
  LIMIT p_limit;
$$;

-- To refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funding_by_postcode;
