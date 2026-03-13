-- V3: Use postcode_sa2_concordance (many-to-many) to aggregate entities to SA2s
-- This ensures every SA2 gets entity/funding data from ALL postcodes that overlap it,
-- not just the one postcode that happened to have its centroid in that SA2.
--
-- Key change: JOIN entities via concordance instead of direct sa2_code match.
-- An entity at postcode 2617 will now contribute to BOTH Belconnen AND Bruce SA2s.

CREATE OR REPLACE FUNCTION public.get_sa2_map_data()
RETURNS TABLE(
  sa2_code text,
  sa2_name text,
  total_funding numeric,
  entity_count bigint,
  community_controlled_count bigint,
  community_controlled_pct integer,
  external_provider_pct integer,
  need_gap integer,
  seifa_decile integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.sa2_code,
    r.sa2_name,
    COALESCE(e.total_funding, 0) as total_funding,
    COALESCE(e.entity_count, 0) as entity_count,
    COALESCE(e.cc_count, 0) as community_controlled_count,
    CASE WHEN COALESCE(e.total_funding, 0) > 0
      THEN ROUND(100.0 * COALESCE(e.cc_funding, 0) / e.total_funding)::integer
      ELSE 0
    END as community_controlled_pct,
    CASE WHEN COALESCE(e.total_funding, 0) > 0
      THEN ROUND(100.0 * (1 - COALESCE(e.cc_funding, 0) / e.total_funding))::integer
      ELSE 100
    END as external_provider_pct,
    ROUND(((10 - COALESCE(sf.avg_seifa, 5)) / 10.0) * 100)::integer as need_gap,
    ROUND(COALESCE(sf.avg_seifa, 5))::integer as seifa_decile
  FROM sa2_reference r
  LEFT JOIN (
    -- Aggregate entities to SA2 via many-to-many concordance
    SELECT
      c.sa2_code,
      COUNT(DISTINCT g.id) as entity_count,
      COUNT(DISTINCT g.id) FILTER (WHERE g.is_community_controlled = true) as cc_count,
      COALESCE(SUM(f.total_in), 0) as total_funding,
      COALESCE(SUM(f.total_in) FILTER (WHERE g.is_community_controlled = true), 0) as cc_funding
    FROM postcode_sa2_concordance c
    JOIN gs_entities g ON g.postcode = c.postcode
    LEFT JOIN (
      SELECT target_entity_id as entity_id, SUM(amount) as total_in
      FROM gs_relationships
      WHERE amount IS NOT NULL AND amount > 0
      GROUP BY target_entity_id
    ) f ON f.entity_id = g.id
    GROUP BY c.sa2_code
  ) e ON e.sa2_code = r.sa2_code
  LEFT JOIN (
    -- SEIFA by SA2 via concordance
    SELECT
      c.sa2_code,
      AVG(s.decile_national) as avg_seifa
    FROM postcode_sa2_concordance c
    JOIN seifa_2021 s ON s.postcode = c.postcode AND s.index_type = 'IRSD'
    GROUP BY c.sa2_code
  ) sf ON sf.sa2_code = r.sa2_code
  ORDER BY total_funding DESC;
$$;
