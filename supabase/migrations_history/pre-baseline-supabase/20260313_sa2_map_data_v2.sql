-- V2: Rewrite get_sa2_map_data to aggregate directly from gs_entities by sa2_code
-- instead of going through postcode_geo → mv_funding_by_postcode.
-- This captures entities that have sa2_code but might not map through postcode_geo.

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
    -- Aggregate entities directly by sa2_code
    SELECT
      g.sa2_code,
      COUNT(*) as entity_count,
      COUNT(*) FILTER (WHERE g.is_community_controlled = true) as cc_count,
      COALESCE(SUM(f.total_in), 0) as total_funding,
      COALESCE(SUM(f.total_in) FILTER (WHERE g.is_community_controlled = true), 0) as cc_funding
    FROM gs_entities g
    LEFT JOIN (
      -- Sum inbound funding per entity
      SELECT target_entity_id as entity_id, SUM(amount) as total_in
      FROM gs_relationships
      WHERE amount IS NOT NULL AND amount > 0
      GROUP BY target_entity_id
    ) f ON f.entity_id = g.id
    WHERE g.sa2_code IS NOT NULL
    GROUP BY g.sa2_code
  ) e ON e.sa2_code = r.sa2_code
  LEFT JOIN (
    -- SEIFA averages by SA2 via postcode bridge
    SELECT
      p.sa2_code,
      AVG(s.decile_national) as avg_seifa
    FROM postcode_geo p
    JOIN seifa_2021 s ON s.postcode = p.postcode AND s.index_type = 'IRSD'
    WHERE p.sa2_code IS NOT NULL
    GROUP BY p.sa2_code
  ) sf ON sf.sa2_code = r.sa2_code
  ORDER BY total_funding DESC;
$$;
