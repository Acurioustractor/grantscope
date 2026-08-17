-- Social enterprises: one ABN, one row. 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-se-collapse-by-abn.sql
--
-- UX audit pass 2, F13. Five register entries share ABN 50169561394 — Australian Red Cross,
-- Australian Red Cross Family Store, Ballarat Red Cross, Horsham Red Cross, Red Cross — and
-- se_browse joined the power index on ABN, so every one of them displayed the whole national
-- $7.64bn. The column was not additive and did not say so; "Ballarat Red Cross moves $7.6bn" is
-- wrong by orders of magnitude. Same shape for genU and SSI.
--
-- 527 of the 10,389 ABN-carrying rows are duplicates like this (9,862 distinct ABNs; one ABN has
-- 20 register entries). Rows with no ABN — 1,793 of them — cannot be grouped and stay as they are,
-- keyed on their own id.
--
-- Display name comes from gs_entities.canonical_name for the ABN when we have it, because that is
-- the registered entity ("Australian Red Cross Society") rather than whichever branch happened to
-- sort first. Falling back to the shortest register name keeps the pick deterministic.
--
-- The collapse is disclosed, not hidden: `entries` carries how many register rows the row stands
-- for, so a reader can see the register has five Red Cross entries even though the money is
-- counted once.
--
-- DROP + CREATE rather than CREATE OR REPLACE, because adding `entries` changes the return type.
-- Both run in one transaction so the endpoint is never missing.

BEGIN;

DROP FUNCTION IF EXISTS se_browse(text, text, text, int);

CREATE FUNCTION se_browse(
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
  on_graph boolean,
  entries int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      s.id, s.name, s.abn, s.sector, s.state, s.postcode, s.website, s.description,
      p.gs_id, p.system_count, p.total_dollar_flow,
      (s.abn IS NOT NULL) AS has_abn,
      (s.sector IS NOT NULL) AS has_sector,
      (s.postcode IS NOT NULL OR s.state IS NOT NULL) AS has_place,
      (s.website IS NOT NULL OR s.description IS NOT NULL) AS has_web,
      (p.gs_id IS NOT NULL) AS on_graph,
      ((s.abn IS NOT NULL)::int + (s.sector IS NOT NULL)::int
       + (s.postcode IS NOT NULL OR s.state IS NOT NULL)::int
       + (s.website IS NOT NULL OR s.description IS NOT NULL)::int
       + (p.gs_id IS NOT NULL)::int) AS known_score,
      -- One group per ABN; ABN-less rows group only with themselves.
      COALESCE(s.abn, s.id::text) AS grp
    FROM social_enterprises s
    LEFT JOIN LATERAL (
      SELECT e.gs_id, e.system_count, e.total_dollar_flow
        FROM mv_entity_power_index e
       WHERE e.abn = s.abn
       LIMIT 1
    ) p ON s.abn IS NOT NULL
  ), named AS (
    SELECT b.abn, min(g.canonical_name) AS canonical_name
      FROM base b
      JOIN gs_entities g ON g.abn = b.abn
     WHERE b.abn IS NOT NULL
     GROUP BY 1
  ), sectors AS (
    -- Flattened separately: array_agg over text[] of differing lengths is an error, and the union
    -- of a group's sectors is what a reader wants to see.
    SELECT b.grp, string_agg(DISTINCT x, ', ') AS sector
      FROM base b, LATERAL unnest(COALESCE(b.sector, ARRAY[]::text[])) AS x
     GROUP BY 1
  ), grouped AS (
    SELECT
      (array_agg(b.id ORDER BY length(b.name), b.name))[1] AS id,
      COALESCE(n.canonical_name, (array_agg(b.name ORDER BY length(b.name), b.name))[1]) AS name,
      max(b.abn) AS abn,
      sec.sector,
      CASE WHEN count(DISTINCT b.state) = 1 THEN max(b.state) ELSE NULL END AS state,
      max(b.gs_id) AS gs_id,
      max(b.system_count)::int AS system_count,
      max(b.total_dollar_flow) AS visible_dollars,
      max(b.known_score) AS known,
      bool_or(b.has_abn) AS has_abn,
      bool_or(b.has_sector) AS has_sector,
      bool_or(b.has_place) AS has_place,
      bool_or(b.has_web) AS has_web,
      bool_or(b.on_graph) AS on_graph,
      count(*)::int AS entries,
      -- Kept out of the returned row; only the filters below need them.
      bool_or(p_q IS NULL OR b.name ILIKE '%' || p_q || '%') AS name_match,
      bool_or(p_state IS NULL OR b.state = p_state) AS state_match
    FROM base b
    LEFT JOIN named n ON n.abn = b.abn
    LEFT JOIN sectors sec ON sec.grp = b.grp
    GROUP BY b.grp, n.canonical_name, sec.sector
  )
  SELECT id, name, abn, sector, state, gs_id, system_count, visible_dollars, known,
         has_abn, has_sector, has_place, has_web, on_graph, entries
    FROM grouped
   -- Matching on ANY entry in the group: searching "Ballarat Red Cross" must still find the row,
   -- even though it now displays as Australian Red Cross Society.
   WHERE name_match AND state_match
   ORDER BY
     CASE WHEN p_sort = 'known' THEN known END DESC,
     CASE WHEN p_sort = 'least' THEN known END ASC,
     CASE WHEN p_sort = 'dollars' THEN visible_dollars END DESC NULLS LAST,
     CASE WHEN p_sort = 'systems' THEN system_count END DESC NULLS LAST,
     name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

GRANT EXECUTE ON FUNCTION se_browse(text, text, text, int) TO anon, authenticated, service_role;

COMMIT;
