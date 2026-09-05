-- SA2 reference table: all 2,473 SA2 regions from ABS 2021
-- Source: apps/web/public/geo/sa2-2021.json (ABS ASGS Edition 3)
-- Purpose: Ensure power map has 100% SA2 coverage

CREATE TABLE IF NOT EXISTS sa2_reference (
  sa2_code   text PRIMARY KEY,
  sa2_name   text NOT NULL,
  sa3_code   text,
  sa3_name   text,
  sa4_code   text,
  sa4_name   text,
  state_code text,
  state_name text,
  area_sqkm  numeric
);

-- Replace the get_sa2_map_data function to use sa2_reference instead of postcode_geo
-- This ensures ALL 2,473 SA2s appear on the map, even those without postcodes
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
    COALESCE(agg.total_funding, 0) as total_funding,
    COALESCE(agg.entity_count, 0) as entity_count,
    COALESCE(agg.community_controlled_count, 0) as community_controlled_count,
    CASE WHEN COALESCE(agg.total_funding, 0) > 0
      THEN ROUND(100.0 * COALESCE(agg.cc_funding, 0) / agg.total_funding)::integer
      ELSE 0
    END as community_controlled_pct,
    CASE WHEN COALESCE(agg.total_funding, 0) > 0
      THEN ROUND(100.0 * (1 - COALESCE(agg.cc_funding, 0) / agg.total_funding))::integer
      ELSE 100
    END as external_provider_pct,
    ROUND(((10 - COALESCE(agg.avg_seifa, 5)) / 10.0) * 100)::integer as need_gap,
    ROUND(COALESCE(agg.avg_seifa, 5))::integer as seifa_decile
  FROM sa2_reference r
  LEFT JOIN (
    -- Aggregate postcode-level data up to SA2 via postcode_geo bridge
    SELECT
      p.sa2_code,
      SUM(m.total_funding) as total_funding,
      SUM(m.entity_count) as entity_count,
      SUM(m.community_controlled_count) as community_controlled_count,
      SUM(m.community_controlled_funding) as cc_funding,
      AVG(s.decile_national) as avg_seifa
    FROM postcode_geo p
    LEFT JOIN mv_funding_by_postcode m ON m.postcode = p.postcode
    LEFT JOIN seifa_2021 s ON s.postcode = p.postcode AND s.index_type = 'IRSD'
    WHERE p.sa2_code IS NOT NULL
    GROUP BY p.sa2_code
  ) agg ON agg.sa2_code = r.sa2_code
  ORDER BY total_funding DESC;
$$;
