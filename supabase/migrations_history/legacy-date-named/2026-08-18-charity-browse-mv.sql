-- Charity browser: precompute the enrichment instead of doing it per request. 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-charity-browse-mv.sql
--
-- UX audit pass 2, F3. charity_browse() ran two LATERAL lookups per charity — latest AIS year and
-- the power-index row — across all 66,023 charities on every request, then sorted the lot. That is
-- 10.4s unfiltered, over the statement timeout, so the DEFAULT landing page rendered
-- "The list could not be read: canceling statement due to statement timeout". Adding any state
-- filter cut it under the limit, which is why this survived review: every filtered view worked and
-- only the first screen a new visitor sees was broken.
--
-- Both laterals were already indexed. The problem was never a missing index, it was doing 132,000
-- index lookups per page view for data that only changes when the nightly refresh runs.
--
-- mv_charity_browse holds the joined row. The RPC becomes filter + order + limit over 66K rows.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_charity_browse AS
  SELECT
    c.abn,
    c.name,
    c.charity_size,
    c.state,
    c.is_foundation,
    p.gs_id,
    p.system_count::int AS system_count,
    p.total_dollar_flow,
    a.ais_year::int AS ais_year,
    a.total_assets,
    ((c.charity_size IS NOT NULL)::int + (c.state IS NOT NULL)::int
     + (p.gs_id IS NOT NULL)::int + (a.ais_year IS NOT NULL)::int
     + (p.total_dollar_flow > 0)::int) AS known_score
  FROM acnc_charities c
  LEFT JOIN LATERAL (
    SELECT e.gs_id, e.system_count, e.total_dollar_flow
      FROM mv_entity_power_index e
     WHERE e.abn = c.abn
     LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT x.ais_year, x.total_assets
      FROM acnc_ais x
     WHERE x.abn = c.abn
     ORDER BY x.ais_year DESC
     LIMIT 1
  ) a ON true;

-- abn is not unique on acnc_charities, so the unique index CONCURRENTLY needs goes on a synthetic
-- key. ctid is not stable across refreshes; row_number over a stable sort is.
CREATE UNIQUE INDEX IF NOT EXISTS mv_charity_browse_uidx
  ON mv_charity_browse (name, abn, ais_year, charity_size, state);
CREATE INDEX IF NOT EXISTS mv_charity_browse_state_idx ON mv_charity_browse (state);
CREATE INDEX IF NOT EXISTS mv_charity_browse_size_idx ON mv_charity_browse (charity_size);
CREATE INDEX IF NOT EXISTS mv_charity_browse_known_idx ON mv_charity_browse (known_score DESC);
CREATE INDEX IF NOT EXISTS mv_charity_browse_assets_idx ON mv_charity_browse (total_assets DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS mv_charity_browse_flow_idx ON mv_charity_browse (total_dollar_flow DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS mv_charity_browse_name_trgm ON mv_charity_browse USING gin (name gin_trgm_ops);

GRANT SELECT ON mv_charity_browse TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION charity_browse(
  p_q text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_sort text DEFAULT 'known',
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  abn text,
  name text,
  charity_size text,
  state text,
  is_foundation boolean,
  gs_id text,
  system_count int,
  visible_dollars numeric,
  ais_year int,
  total_assets numeric,
  known int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- OUT names are the app's contract: visible_dollars and known, not the MV's column names.
  SELECT m.abn, m.name, m.charity_size, m.state, m.is_foundation,
         m.gs_id, m.system_count, m.total_dollar_flow AS visible_dollars,
         m.ais_year, m.total_assets, m.known_score AS known
    FROM mv_charity_browse m
   WHERE (p_q IS NULL OR m.name ILIKE '%' || p_q || '%')
     AND (p_state IS NULL OR m.state = p_state)
     AND (p_size IS NULL OR m.charity_size = p_size)
   ORDER BY
     CASE WHEN p_sort = 'known' THEN m.known_score END DESC,
     CASE WHEN p_sort = 'least' THEN m.known_score END ASC,
     CASE WHEN p_sort = 'assets' THEN m.total_assets END DESC NULLS LAST,
     CASE WHEN p_sort = 'dollars' THEN m.total_dollar_flow END DESC NULLS LAST,
     m.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

GRANT EXECUTE ON FUNCTION charity_browse(text, text, text, text, int) TO anon, authenticated, service_role;

INSERT INTO mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES ('mv_charity_browse', 'nightly', true, false,
        'precomputed charity browser rows; depends on mv_entity_power_index + acnc_ais')
ON CONFLICT (mv_name) DO UPDATE SET tier = EXCLUDED.tier, enabled = EXCLUDED.enabled, notes = EXCLUDED.notes;
