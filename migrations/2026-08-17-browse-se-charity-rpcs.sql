-- Browse RPCs for social enterprises and charities, with ENRICHMENT made visible (Ben,
-- 2026-08-17: "how enriched it is vs what we can keep finding"). Each row carries a known-score
-- of measured facts; each corpus a stats line. Known is a count of facts we HOLD — a low score
-- is a finding queue, not a judgement of the organisation.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-browse-se-charity-rpcs.sql
BEGIN;

CREATE OR REPLACE FUNCTION se_browse(
  p_q text DEFAULT NULL, p_state text DEFAULT NULL, p_sort text DEFAULT 'known', p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid, name text, abn text, sector text, state text,
  gs_id text, system_count int, visible_dollars numeric,
  known int, has_abn boolean, has_sector boolean, has_place boolean, has_web boolean, on_graph boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.id, s.name, s.abn, s.sector, s.state,
         p.gs_id, p.system_count::int, p.total_dollar_flow,
         ((s.abn IS NOT NULL)::int + (s.sector IS NOT NULL)::int
          + (s.postcode IS NOT NULL OR s.state IS NOT NULL)::int
          + (s.website IS NOT NULL OR s.description IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int),
         s.abn IS NOT NULL, s.sector IS NOT NULL,
         (s.postcode IS NOT NULL OR s.state IS NOT NULL),
         (s.website IS NOT NULL OR s.description IS NOT NULL),
         p.gs_id IS NOT NULL
    FROM social_enterprises s
    LEFT JOIN LATERAL (
      SELECT e.gs_id, e.system_count, e.total_dollar_flow
        FROM mv_entity_power_index e
       WHERE e.abn = s.abn
       LIMIT 1
    ) p ON s.abn IS NOT NULL
   WHERE (p_q IS NULL OR s.name ILIKE '%' || p_q || '%')
     AND (p_state IS NULL OR s.state = p_state)
   ORDER BY
     CASE WHEN p_sort = 'known' THEN ((s.abn IS NOT NULL)::int + (s.sector IS NOT NULL)::int
          + (s.postcode IS NOT NULL OR s.state IS NOT NULL)::int
          + (s.website IS NOT NULL OR s.description IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int) END DESC,
     CASE WHEN p_sort = 'least' THEN ((s.abn IS NOT NULL)::int + (s.sector IS NOT NULL)::int
          + (s.postcode IS NOT NULL OR s.state IS NOT NULL)::int
          + (s.website IS NOT NULL OR s.description IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int) END ASC,
     CASE WHEN p_sort = 'dollars' THEN p.total_dollar_flow END DESC NULLS LAST,
     CASE WHEN p_sort = 'systems' THEN p.system_count END DESC NULLS LAST,
     s.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

CREATE OR REPLACE FUNCTION charity_browse(
  p_q text DEFAULT NULL, p_state text DEFAULT NULL, p_size text DEFAULT NULL,
  p_sort text DEFAULT 'known', p_limit int DEFAULT 200
)
RETURNS TABLE (
  abn text, name text, charity_size text, state text, is_foundation boolean,
  gs_id text, system_count int, visible_dollars numeric,
  ais_year int, total_assets numeric,
  known int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.abn, c.name, c.charity_size, c.state, c.is_foundation,
         p.gs_id, p.system_count::int, p.total_dollar_flow,
         a.ais_year::int, a.total_assets,
         ((c.charity_size IS NOT NULL)::int + (c.state IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int + (a.ais_year IS NOT NULL)::int
          + (p.total_dollar_flow > 0)::int)
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
    ) a ON true
   WHERE (p_q IS NULL OR c.name ILIKE '%' || p_q || '%')
     AND (p_state IS NULL OR c.state = p_state)
     AND (p_size IS NULL OR c.charity_size = p_size)
   ORDER BY
     CASE WHEN p_sort = 'known' THEN ((c.charity_size IS NOT NULL)::int + (c.state IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int + (a.ais_year IS NOT NULL)::int + (p.total_dollar_flow > 0)::int) END DESC,
     CASE WHEN p_sort = 'least' THEN ((c.charity_size IS NOT NULL)::int + (c.state IS NOT NULL)::int
          + (p.gs_id IS NOT NULL)::int + (a.ais_year IS NOT NULL)::int + (p.total_dollar_flow > 0)::int) END ASC,
     CASE WHEN p_sort = 'assets' THEN a.total_assets END DESC NULLS LAST,
     CASE WHEN p_sort = 'dollars' THEN p.total_dollar_flow END DESC NULLS LAST,
     c.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

-- Corpus enrichment stats: the "how much do we hold vs what can we keep finding" header line.
CREATE OR REPLACE FUNCTION browse_enrichment_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'se', (SELECT jsonb_build_object(
        'total', count(*),
        'with_abn', count(abn),
        'on_graph', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gs_entities e WHERE e.abn = s.abn)),
        'with_sector', count(sector))
      FROM social_enterprises s),
    'charity', (SELECT jsonb_build_object(
        'total', count(*),
        'on_graph', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gs_entities e WHERE e.abn = c.abn)),
        'with_ais', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM acnc_ais a WHERE a.abn = c.abn)))
      FROM acnc_charities c),
    'foundation', (SELECT jsonb_build_object(
        'total', count(*),
        'with_grantees', (SELECT count(DISTINCT foundation_id) FROM mv_foundation_grantees),
        'with_ais', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM acnc_ais a WHERE a.abn = f.acnc_abn)))
      FROM foundations f)
  );
$$;

REVOKE ALL ON FUNCTION se_browse(text, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION charity_browse(text, text, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION browse_enrichment_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION se_browse(text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION charity_browse(text, text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION browse_enrichment_stats() TO service_role;
COMMIT;
