-- ===========================================================================
-- /clarity slice 5 — THE SEAMS.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001600_clarity_seams.sql
--
-- Spec: CLARITY-SPEC.md §3.6, §4.5 (graft G4).
--
-- Every connection in the database, ranked by how much data it is LOSING right
-- now. Not "is it connected" — with 638 declared foreign keys the answer is
-- almost always yes and almost never interesting. "Is the connection carrying
-- the data" is where the defects live, and not one of them is visible in a
-- force-directed graph.
--
-- 638 fk edges and 700 view_lineage edges are catalogued. ZERO have ever had a
-- match rate measured. Slice 4's join matrix renders '+' on every cell for
-- exactly this reason. This migration is what turns those into numbers.
-- ===========================================================================

ALTER TABLE clarity_edge
  ADD COLUMN IF NOT EXISTS rows_at_stake bigint,   -- fact-side rows this seam should carry
  ADD COLUMN IF NOT EXISTS grain         text;     -- '1:1' | 'n:1' | 'frayed 3.16 rows/key'

CREATE TABLE IF NOT EXISTS clarity_edge_history (
  id                bigserial PRIMARY KEY,
  edge_id           bigint NOT NULL REFERENCES clarity_edge(id) ON DELETE CASCADE,
  captured_at       timestamptz NOT NULL DEFAULT now(),
  match_rate        numeric(6,3),
  match_numerator   bigint,
  match_denominator bigint,
  rows_at_stake     bigint
);
CREATE INDEX IF NOT EXISTS clarity_edge_hist ON clarity_edge_history (edge_id, captured_at DESC);

ALTER TABLE clarity_edge_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clarity_edge_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON clarity_edge_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE clarity_edge_history_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- clarity_measure_edge() — measure ONE seam, bounded.
--
-- Bounded is the whole design. Some of these joins are 2.5M rows against 609K,
-- and an unbounded sweep over 638 of them on a shared pooler is how you take
-- the database down. Every probe runs under its own statement_timeout and a
-- timeout is RECORDED as a timeout — match_method tells you which numbers were
-- measured and which were refused, so a '?' can never be mistaken for a 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_measure_edge(
  p_edge_id     bigint,
  p_timeout_ms  integer DEFAULT 8000
) RETURNS TABLE (out_rate numeric, out_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $fn$
DECLARE
  e           record;
  n_total     bigint;
  n_present   bigint;
  n_matched   bigint;
  n_keys      bigint;
  n_tgt_rows  bigint;
  rate        numeric;
  method      text := 'count_join';
  grain_text  text;
BEGIN
  SELECT * INTO e FROM clarity_edge WHERE id = p_edge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clarity_measure_edge: no edge %', p_edge_id;
  END IF;

  -- A view_lineage edge is not a join and has no match rate to measure. Saying
  -- so is different from measuring it at 0.
  IF e.mechanism = 'view_lineage' THEN
    UPDATE clarity_edge SET match_method = 'not_a_join', match_measured_at = now()
     WHERE id = p_edge_id;
    RETURN QUERY SELECT NULL::numeric, 'not_a_join'::text;
    RETURN;
  END IF;

  PERFORM set_config('statement_timeout', p_timeout_ms::text, true);

  BEGIN
    EXECUTE format(
      'SELECT count(*), count(%I) FROM %I', e.src_column, e.src_object)
      INTO n_total, n_present;

    EXECUTE format(
      'SELECT count(*) FROM %I s WHERE s.%I IS NOT NULL AND EXISTS ' ||
      '(SELECT 1 FROM %I t WHERE t.%I = s.%I)',
      e.src_object, e.src_column, e.tgt_object, e.tgt_column, e.src_column)
      INTO n_matched;

    -- Grain: how many target rows a single key resolves to. A choropleth built
    -- on a frayed key silently multiplies its own numbers, which is the defect
    -- no match rate would ever reveal.
    EXECUTE format(
      'SELECT count(*), count(DISTINCT %I) FROM %I WHERE %I IS NOT NULL',
      e.tgt_column, e.tgt_object, e.tgt_column)
      INTO n_tgt_rows, n_keys;

    grain_text := CASE
      WHEN n_keys IS NULL OR n_keys = 0 THEN NULL
      WHEN n_tgt_rows = n_keys          THEN '1:1'
      WHEN n_tgt_rows::numeric / n_keys < 1.01 THEN 'n:1'
      ELSE 'frayed ' || round(n_tgt_rows::numeric / n_keys, 2) || ' rows/key'
    END;

    rate := CASE WHEN coalesce(n_present, 0) = 0 THEN NULL
                 ELSE round(n_matched::numeric / n_present::numeric, 3) END;
  EXCEPTION
    WHEN query_canceled THEN
      method := 'timeout';   rate := NULL;
    WHEN OTHERS THEN
      method := 'error: ' || left(SQLERRM, 80); rate := NULL;
  END;

  PERFORM set_config('statement_timeout', '0', true);

  -- History first, so a series exists even for the run that produced it.
  INSERT INTO clarity_edge_history
    (edge_id, match_rate, match_numerator, match_denominator, rows_at_stake)
  VALUES (p_edge_id, rate, n_matched, n_present, n_total);

  UPDATE clarity_edge SET
    match_rate        = rate,
    match_numerator   = n_matched,
    match_denominator = n_present,
    rows_at_stake     = n_total,
    grain             = coalesce(grain_text, grain),
    match_method      = method,
    match_measured_at = now()
   WHERE id = p_edge_id;

  RETURN QUERY SELECT rate, method;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- clarity_measure_seams() — a BATCH, never the whole set.
--
-- Deliberately takes a limit and defaults to 25. There is no "measure
-- everything" call, because the honest way to sweep 638 seams on a pooler that
-- has starved before is many small batches, not one heroic statement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_measure_seams(
  p_limit           integer DEFAULT 25,
  p_only_unmeasured boolean DEFAULT true,
  p_timeout_ms      integer DEFAULT 8000
) RETURNS TABLE (out_edge_id bigint, out_src text, out_tgt text, out_rate numeric, out_method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
SET statement_timeout = 0
AS $fn$
DECLARE
  r record;
  res record;
BEGIN
  FOR r IN
    SELECT id, src_object, src_column, tgt_object, tgt_column
      FROM clarity_edge
     WHERE mechanism <> 'view_lineage'
       AND (NOT p_only_unmeasured OR match_measured_at IS NULL)
     ORDER BY id
     LIMIT p_limit
  LOOP
    SELECT * INTO res FROM clarity_measure_edge(r.id, p_timeout_ms);
    out_edge_id := r.id;
    out_src := r.src_object || '.' || r.src_column;
    out_tgt := r.tgt_object || '.' || r.tgt_column;
    out_rate := res.out_rate;
    out_method := res.out_method;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- v_clarity_seams — the screen's one query.
--
-- rows_losing is the ranking, and the ranking IS the argument: broken sorts to
-- the top, unmeasured sorts to the bottom. A catalog that sorts by quality
-- descending buries its own worst finding on page two.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_clarity_seams WITH (security_invoker = true) AS
SELECT e.id, e.mechanism, e.src_object, e.src_column, e.tgt_object, e.tgt_column,
       e.declared, e.match_rate, e.match_numerator, e.match_denominator,
       e.match_method, e.match_measured_at, e.rows_at_stake, e.grain, e.note,
       round(coalesce(e.rows_at_stake, e.match_denominator, 0)
             * (1 - coalesce(e.match_rate, 0)))                  AS rows_losing,
       e.match_rate - h.match_rate                               AS match_delta,
       so.domain                                                 AS src_domain,
       tobj.domain                                               AS tgt_domain
  FROM clarity_edge e
  LEFT JOIN LATERAL (
        SELECT x.match_rate FROM clarity_edge_history x
         WHERE x.edge_id = e.id AND x.captured_at < e.match_measured_at
         ORDER BY x.captured_at DESC LIMIT 1) h ON true
  LEFT JOIN clarity_object so   ON so.object_key   = e.src_object
  LEFT JOIN clarity_object tobj ON tobj.object_key = e.tgt_object
 WHERE e.mechanism <> 'view_lineage';
REVOKE ALL ON v_clarity_seams FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_clarity_seams TO service_role;

REVOKE EXECUTE ON FUNCTION clarity_measure_edge(bigint,integer)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_measure_seams(integer,boolean,integer)      FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION clarity_measure_edge(bigint,integer)                TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_measure_seams(integer,boolean,integer)      TO service_role;
