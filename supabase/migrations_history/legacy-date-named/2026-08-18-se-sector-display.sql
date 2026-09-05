-- Social enterprises: stop rendering a Postgres array literal at the user. 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-se-sector-display.sql
--
-- UX audit pass 2, F7. social_enterprises.sector is text[], se_browse declares that OUT column as
-- text, so Postgres cast the array to its literal form and the browser printed it verbatim:
--   {education,indigenous}
--   {"Community & Social Services","Training & Education Services","Venue Hire"}
-- Braces, quotes and all. array_to_string does the join the UI was trying to do with .split(',').
--
-- Everything else here is the existing body, reproduced verbatim including the five has_*/on_graph
-- booleans, so that CREATE OR REPLACE keeps the signature the app depends on. Only the sector
-- expression changed.

CREATE OR REPLACE FUNCTION se_browse(
  p_q text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_sort text DEFAULT 'known',
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  name text,
  abn text,
  sector text,
  state text,
  gs_id text,
  system_count int,
  visible_dollars numeric,
  known int,
  has_abn boolean,
  has_sector boolean,
  has_place boolean,
  has_web boolean,
  on_graph boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$

  SELECT s.id, s.name, s.abn,
         -- The whole point of this migration: a readable list, not an array literal.
         NULLIF(array_to_string(s.sector, ', '), '') AS sector,
         s.state,
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
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

GRANT EXECUTE ON FUNCTION se_browse(text, text, text, int) TO anon, authenticated, service_role;
