-- Places browser RPCs (issue #246, "One shell, all data" S3)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-place-browse-rpcs.sql
--
-- LGA is the grain. Neither source MV is trustworthy on grain (mv_funding_by_lga: 1.7K rows over
-- ~492 LGAs; mv_funding_deserts: 1,997 rows over 1,130 distinct lga|state) so both are
-- re-aggregated to one row per (lga_name, state) here, in the DB, once.

CREATE OR REPLACE FUNCTION place_browse(
  p_q text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_sort text DEFAULT 'funding',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  lga_name text,
  state text,
  entity_count bigint,
  community_controlled_count bigint,
  total_funding numeric,
  avg_seifa_decile numeric,
  remoteness text,
  desert_score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH lga AS (
    SELECT f.lga_name, f.state,
           sum(f.entity_count) AS entity_count,
           sum(f.community_controlled_count) AS community_controlled_count,
           sum(f.total_funding) AS total_funding,
           avg(f.avg_seifa_decile) AS avg_seifa_decile
    FROM mv_funding_by_lga f
    WHERE f.lga_name IS NOT NULL
    GROUP BY f.lga_name, f.state
  ),
  deserts AS (
    SELECT d.lga_name, d.state,
           max(d.desert_score) AS desert_score,
           min(d.remoteness) AS remoteness
    FROM mv_funding_deserts d
    GROUP BY d.lga_name, d.state
  )
  SELECT
    l.lga_name, l.state, l.entity_count, l.community_controlled_count,
    l.total_funding, round(l.avg_seifa_decile, 1), d.remoteness, round(d.desert_score, 1)
  FROM lga l
  LEFT JOIN deserts d ON d.lga_name = l.lga_name AND d.state = l.state
  WHERE (p_q IS NULL OR l.lga_name ILIKE '%' || p_q || '%')
    AND (p_state IS NULL OR l.state = p_state)
  ORDER BY
    CASE WHEN p_sort = 'desert' THEN d.desert_score END DESC NULLS LAST,
    CASE WHEN p_sort = 'entities' THEN l.entity_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'disadvantage' THEN l.avg_seifa_decile END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN l.lga_name END ASC NULLS LAST,
    l.total_funding DESC NULLS LAST,
    l.lga_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION place_detail(p_lga text, p_state text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'lga_name', p_lga,
    'state', p_state,
    'funding', (
      SELECT jsonb_build_object(
        'entity_count', sum(f.entity_count),
        'community_controlled_count', sum(f.community_controlled_count),
        'total_funding', sum(f.total_funding),
        'avg_seifa_decile', round(avg(f.avg_seifa_decile), 1)
      )
      FROM mv_funding_by_lga f
      WHERE f.lga_name = p_lga AND f.state = p_state
    ),
    -- Deserts dollars are NOT exposed: the MV's grain is not unique per LGA and its dollar
    -- columns double-count catastrophically when aggregated (Brisbane summed to $2.5tn
    -- procurement). Score and remoteness are safe under max/min.
    'desert', (
      SELECT jsonb_build_object(
        'desert_score', round(max(d.desert_score), 1),
        'remoteness', min(d.remoteness)
      )
      FROM mv_funding_deserts d
      WHERE d.lga_name = p_lga AND d.state = p_state
    ),
    'postcodes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'postcode', p.postcode,
        'entity_count', p.entity_count,
        'total_funding', p.total_funding,
        'remoteness', p.remoteness
      ) ORDER BY p.total_funding DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (mp.postcode) mp.postcode, mp.entity_count, mp.total_funding, mp.remoteness
        FROM mv_funding_by_postcode mp
        WHERE mp.postcode IN (
          SELECT DISTINCT g.postcode FROM postcode_geo g
          WHERE g.lga_name = p_lga AND g.state = p_state
        )
        ORDER BY mp.postcode
      ) p
    ),
    'placement', (
      SELECT COALESCE(jsonb_object_agg(src.lga_source, src.n), '{}'::jsonb)
      FROM (
        SELECT e.lga_source, count(*) AS n
        FROM gs_entities e
        WHERE e.lga_name = p_lga AND e.state = p_state AND e.lga_source IS NOT NULL
        GROUP BY e.lga_source
        ORDER BY count(*) DESC
      ) src
    )
  )
$$;

CREATE OR REPLACE FUNCTION place_browse_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'lgas', (SELECT count(DISTINCT (lga_name, state)) FROM mv_funding_by_lga WHERE lga_name IS NOT NULL),
    'entities_placed', (SELECT count(*) FROM gs_entities WHERE lga_name IS NOT NULL),
    'unplaced_with_postcode', (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL),
    'no_postcode', (SELECT count(*) FROM gs_entities WHERE postcode IS NULL)
  )
$$;

GRANT EXECUTE ON FUNCTION place_browse(text, text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION place_detail(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION place_browse_stats() TO anon, authenticated, service_role;
