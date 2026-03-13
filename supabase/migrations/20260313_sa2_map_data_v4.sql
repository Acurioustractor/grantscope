-- V4: Combine BOTH concordance-based and direct sa2_code matching
-- This catches entities mapped via concordance AND entities with direct sa2_code assignment

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
  WITH entity_funding AS (
    -- Pre-compute per-entity inbound funding
    SELECT target_entity_id as entity_id, SUM(amount) as total_in
    FROM gs_relationships
    WHERE amount IS NOT NULL AND amount > 0
    GROUP BY target_entity_id
  ),
  -- Entities mapped via concordance (postcode → SA2)
  concordance_entities AS (
    SELECT c.sa2_code, g.id as entity_id, g.is_community_controlled, COALESCE(f.total_in, 0) as funding
    FROM postcode_sa2_concordance c
    JOIN gs_entities g ON g.postcode = c.postcode
    LEFT JOIN entity_funding f ON f.entity_id = g.id
  ),
  -- Entities mapped via direct sa2_code
  direct_entities AS (
    SELECT g.sa2_code, g.id as entity_id, g.is_community_controlled, COALESCE(f.total_in, 0) as funding
    FROM gs_entities g
    LEFT JOIN entity_funding f ON f.entity_id = g.id
    WHERE g.sa2_code IS NOT NULL
  ),
  -- Union both, dedup by (sa2_code, entity_id)
  all_entities AS (
    SELECT DISTINCT ON (sa2_code, entity_id) sa2_code, entity_id, is_community_controlled, funding
    FROM (
      SELECT * FROM concordance_entities
      UNION ALL
      SELECT * FROM direct_entities
    ) combined
  ),
  -- Aggregate by SA2
  sa2_agg AS (
    SELECT
      sa2_code,
      COUNT(DISTINCT entity_id) as entity_count,
      COUNT(DISTINCT entity_id) FILTER (WHERE is_community_controlled = true) as cc_count,
      COALESCE(SUM(funding), 0) as total_funding,
      COALESCE(SUM(funding) FILTER (WHERE is_community_controlled = true), 0) as cc_funding
    FROM all_entities
    GROUP BY sa2_code
  ),
  -- SEIFA via concordance
  seifa_agg AS (
    SELECT c.sa2_code, AVG(s.decile_national) as avg_seifa
    FROM postcode_sa2_concordance c
    JOIN seifa_2021 s ON s.postcode = c.postcode AND s.index_type = 'IRSD'
    GROUP BY c.sa2_code
  )
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
  LEFT JOIN sa2_agg e ON e.sa2_code = r.sa2_code
  LEFT JOIN seifa_agg sf ON sf.sa2_code = r.sa2_code
  ORDER BY total_funding DESC;
$$;
