-- Sortable-by-every-column (Ben, 2026-08-18): add the sort keys the browse RPCs were missing.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-sort-keys.sql

CREATE OR REPLACE FUNCTION person_browse(
  p_q text DEFAULT NULL,
  p_sort text DEFAULT 'influence',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  identity_key text,
  person_name text,
  person_name_normalised text,
  board_count bigint,
  acco_boards bigint,
  attributed_procurement numeric,
  attributed_justice numeric,
  attributed_donations numeric,
  financial_system_count int,
  influence_score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    v.identity_key, v.person_name, v.person_name_normalised, v.board_count, v.acco_boards,
    v.attributed_procurement, v.attributed_justice, v.attributed_donations,
    v.financial_system_count, v.influence_score_attributed
  FROM mv_person_identity_influence_v2 v
  WHERE v.is_nominee_block IS NOT TRUE
    AND v.board_count <= 10
    AND (p_q IS NULL OR v.person_name ILIKE '%' || p_q || '%')
  ORDER BY
    CASE WHEN p_sort = 'boards' THEN v.board_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'systems' THEN v.financial_system_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'procurement' THEN v.attributed_procurement END DESC NULLS LAST,
    CASE WHEN p_sort = 'justice' THEN v.attributed_justice END DESC NULLS LAST,
    CASE WHEN p_sort = 'donations' THEN v.attributed_donations END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN v.person_name END ASC NULLS LAST,
    v.influence_score_attributed DESC NULLS LAST,
    v.person_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

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
    CASE WHEN p_sort = 'acco' THEN l.community_controlled_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'disadvantage' THEN l.avg_seifa_decile END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN l.lga_name END ASC NULLS LAST,
    l.total_funding DESC NULLS LAST,
    l.lga_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION grant_recipient_browse(
  p_q text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_topic text DEFAULT NULL,
  p_sort text DEFAULT 'total',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  recipient_key text,
  recipient_name text,
  recipient_abn text,
  grant_count bigint,
  total_dollars numeric,
  states text[],
  first_year text,
  last_year text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    lower(btrim(j.recipient_name)) AS recipient_key,
    max(j.recipient_name) AS recipient_name,
    max(j.recipient_abn) AS recipient_abn,
    count(*) AS grant_count,
    sum(j.amount_dollars) AS total_dollars,
    array_agg(DISTINCT j.state) FILTER (WHERE j.state IS NOT NULL) AS states,
    min(j.financial_year) AS first_year,
    max(j.financial_year) AS last_year
  FROM justice_funding j
  WHERE j.measure_kind = 'grant'
    AND j.is_aggregate IS NOT TRUE
    AND j.recipient_name IS NOT NULL
    AND btrim(j.recipient_name) <> ''
    AND lower(btrim(j.recipient_name)) NOT IN
        ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')
    AND (p_q IS NULL OR j.recipient_name ILIKE '%' || p_q || '%')
    AND (p_state IS NULL OR j.state = p_state)
    AND (p_topic IS NULL OR j.topics @> ARRAY[p_topic])
  GROUP BY lower(btrim(j.recipient_name))
  ORDER BY
    CASE WHEN p_sort = 'grants' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recent' THEN max(j.financial_year) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(j.recipient_name) END ASC NULLS LAST,
    sum(j.amount_dollars) DESC NULLS LAST,
    max(j.recipient_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;
