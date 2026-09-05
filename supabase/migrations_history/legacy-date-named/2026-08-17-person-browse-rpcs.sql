-- People browser RPCs (issue #245, "One shell, all data" S2)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-person-browse-rpcs.sql
--
-- Read-only SELECT functions over mv_person_identity_influence_v2 / mv_board_interlocks.
-- The nominee cap stays: is_nominee_block rows and >10-board identities are excluded from the
-- list and COUNTED in person_browse_stats so the UI can say so instead of silently capping.
-- Money columns are the de-collided attributed_* figures, never the naive affiliated totals.

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
    v.identity_key,
    v.person_name,
    v.person_name_normalised,
    v.board_count,
    v.acco_boards,
    v.attributed_procurement,
    v.attributed_justice,
    v.attributed_donations,
    v.financial_system_count,
    v.influence_score_attributed
  FROM mv_person_identity_influence_v2 v
  WHERE v.is_nominee_block IS NOT TRUE
    AND v.board_count <= 10
    AND (p_q IS NULL OR v.person_name ILIKE '%' || p_q || '%')
  ORDER BY
    CASE WHEN p_sort = 'boards' THEN v.board_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'procurement' THEN v.attributed_procurement END DESC NULLS LAST,
    CASE WHEN p_sort = 'justice' THEN v.attributed_justice END DESC NULLS LAST,
    CASE WHEN p_sort = 'donations' THEN v.attributed_donations END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN v.person_name END ASC NULLS LAST,
    v.influence_score_attributed DESC NULLS LAST,
    v.person_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION person_detail(p_norm text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'person_name', b.person_name_display,
    'person_name_normalised', b.person_name_normalised,
    'board_count', b.board_count,
    'organisations', to_jsonb(b.organisations),
    'organisation_abns', to_jsonb(b.organisation_abns),
    'role_types', to_jsonb(b.role_types),
    'connects_community_controlled', b.connects_community_controlled,
    'interlock_score', b.interlock_score,
    'attributed', (
      SELECT jsonb_build_object(
        'procurement', v.attributed_procurement,
        'justice', v.attributed_justice,
        'donations', v.attributed_donations,
        'systems', v.financial_system_count
      )
      FROM mv_person_identity_influence_v2 v
      WHERE v.person_name_normalised = b.person_name_normalised
        AND v.is_nominee_block IS NOT TRUE
      ORDER BY v.influence_score_attributed DESC NULLS LAST
      LIMIT 1
    )
  )
  FROM mv_board_interlocks b
  WHERE b.person_name_normalised = p_norm
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION person_browse_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'listable', count(*) FILTER (WHERE is_nominee_block IS NOT TRUE AND board_count <= 10),
    'nominee_blocked', count(*) FILTER (WHERE is_nominee_block),
    'over_cap', count(*) FILTER (WHERE is_nominee_block IS NOT TRUE AND board_count > 10)
  )
  FROM mv_person_identity_influence_v2
$$;

GRANT EXECUTE ON FUNCTION person_browse(text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION person_detail(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION person_browse_stats() TO anon, authenticated, service_role;
