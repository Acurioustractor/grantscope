-- foundation_browse(): the Browse list in one DB call — search, type filter, sort, with link
-- counts and latest ACNC financials joined. Replaces client-side count joins that failed
-- SILENTLY on long IN() batches (the screenshot bug: PRF showed 0 grantees on the list and 79
-- on its profile). Counts computed here can never quietly zero.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-foundation-browse-rpc.sql
BEGIN;
CREATE OR REPLACE FUNCTION foundation_browse(
  p_q text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_sort text DEFAULT 'giving',
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid, name text, abn text, type text,
  giving numeric, grantees bigint, board_links bigint,
  ais_year int, granted numeric, total_assets numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH g AS (
    SELECT foundation_id, count(*) AS n FROM mv_foundation_grantees GROUP BY 1
  ), b AS (
    SELECT foundation_id, count(*) AS n FROM funder_board_paths GROUP BY 1
  )
  SELECT f.id, f.name, f.acnc_abn, f.type,
         f.total_giving_annual,
         coalesce(g.n, 0), coalesce(b.n, 0),
         ais.ais_year::int, ais.grants_donations_au, ais.total_assets
    FROM foundations f
    LEFT JOIN g ON g.foundation_id = f.id
    LEFT JOIN b ON b.foundation_id = f.id
    -- LATERAL latest-AIS probe per foundation: the DISTINCT ON version deduplicated all 361K
    -- AIS rows on every call (74s); ~11K index probes via idx_acnc_ais_lookup run in ~1s.
    LEFT JOIN LATERAL (
      SELECT a.ais_year, a.grants_donations_au, a.total_assets
        FROM acnc_ais a
       WHERE a.abn = f.acnc_abn
       ORDER BY a.ais_year DESC
       LIMIT 1
    ) ais ON true
   WHERE (p_q IS NULL OR f.name ILIKE '%' || p_q || '%')
     AND (p_type IS NULL OR f.type = p_type)
   ORDER BY
     CASE WHEN p_sort = 'giving'   THEN f.total_giving_annual END DESC NULLS LAST,
     CASE WHEN p_sort = 'assets'   THEN ais.total_assets END DESC NULLS LAST,
     CASE WHEN p_sort = 'granted'  THEN ais.grants_donations_au END DESC NULLS LAST,
     CASE WHEN p_sort = 'grantees' THEN coalesce(g.n, 0) END DESC,
     CASE WHEN p_sort = 'board'    THEN coalesce(b.n, 0) END DESC,
     f.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
REVOKE ALL ON FUNCTION foundation_browse(text, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION foundation_browse(text, text, text, int) TO service_role;
COMMIT;
