-- Slice 7: the findings stream — a place to put a finding, and the first two detectors.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-clarity-finding.sql
--
-- Design (thoughts/shared/plans/clarity-console.md, "The findings stream"):
--   * clarity_event is a log of numbers that moved; it cannot hold "these two tables share a key
--     and have never been joined". This table is where a finding lives.
--   * The system proposes; a human adjudicates. Machine findings start unconfirmed and NEVER
--     count as true. Verdict columns mirror clarity_object's mechanism.
--   * Grain choice for the join detector: per (object, column), not per pair — `abn` alone lives
--     in 77 objects and pair-grain would emit ~3,000 findings for that one column. 235 findings
--     at object-grain; 70 orphans. Adjudicable, not a flood.
--   * Re-runs upsert on (detector, subject_object_key, column_name) and bump last_seen_at.
--     Age-out is a READ-side rule on proposed_at (default 30 days, chosen not decreed — the plan
--     left N open; move it in the page constant), so nothing is deleted and a confirmed verdict
--     never expires.
--   * column_name is '' (not NULL) for detectors without one: the upsert key must be plain
--     columns — PostgREST onConflict cannot target expression/partial unique indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS clarity_finding (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  detector text NOT NULL CHECK (detector IN ('undiscovered_join', 'orphan')),
  subject_object_key text NOT NULL REFERENCES clarity_object(object_key) ON DELETE CASCADE,
  column_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  proposed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  verdict text CHECK (verdict IN ('confirmed', 'dismissed')),
  verdict_by text,
  verdict_at timestamptz,
  verdict_reason text,
  UNIQUE (detector, subject_object_key, column_name)
);

CREATE INDEX IF NOT EXISTS idx_clarity_finding_open
  ON clarity_finding (proposed_at DESC) WHERE verdict IS NULL;

-- The two detectors, one pass. SECURITY DEFINER + service_role-only, same posture as
-- clarity_rows: detectors read the whole catalogue and must not be browser-callable.
CREATE OR REPLACE FUNCTION clarity_run_detectors()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n_join int;
  n_orphan int;
BEGIN
  -- Detector 1: undiscovered join. An identifier-shaped column that is a PROVEN join key
  -- elsewhere (some edge somewhere joins on this column name), on a populated object that has
  -- no edge on it at all. Identifier shape, not every shared name: 16,124 columns share
  -- created_at and that is not a join.
  WITH idcols AS (
    SELECT cc.object_key, cc.column_name
      FROM clarity_column cc
     WHERE cc.column_name ~ '(_id|_abn|_key|_code|_slug)$'
        OR cc.column_name IN ('abn', 'acn', 'gs_id', 'postcode', 'icn')
  ), proven AS (
    SELECT DISTINCT c FROM (
      SELECT src_column AS c FROM clarity_edge
      UNION SELECT tgt_column FROM clarity_edge
    ) t WHERE c IS NOT NULL
  ), edged AS (
    SELECT src_object AS o, src_column AS c FROM clarity_edge
    UNION SELECT tgt_object, tgt_column FROM clarity_edge
  ), found AS (
    SELECT ic.object_key,
           ic.column_name,
           (SELECT count(DISTINCT ic2.object_key) FROM idcols ic2
             WHERE ic2.column_name = ic.column_name AND ic2.object_key <> ic.object_key) AS peers
      FROM idcols ic
      JOIN clarity_object o ON o.object_key = ic.object_key
     WHERE coalesce(o.row_count, 0) > 0
       AND ic.column_name IN (SELECT c FROM proven)
       AND NOT EXISTS (SELECT 1 FROM edged e
                        WHERE e.o = ic.object_key AND e.c = ic.column_name)
  ), upserted AS (
    INSERT INTO clarity_finding (detector, subject_object_key, column_name, title, evidence)
    SELECT 'undiscovered_join',
           f.object_key,
           f.column_name,
           format('%s.%s is a proven join key elsewhere but this object has no edge on it', f.object_key, f.column_name),
           jsonb_build_object('peer_objects_with_column', f.peers)
      FROM found f
    ON CONFLICT (detector, subject_object_key, column_name)
    DO UPDATE SET last_seen_at = now(), evidence = excluded.evidence
    RETURNING 1
  )
  SELECT count(*) INTO n_join FROM upserted;

  -- Detector 2: orphan. A populated table/matview that nothing references: no app file, no
  -- script, no migration (all three MEASURED by the slice 6b scanner — 0 means scanned-unused),
  -- no db function, nothing derived from it, and no question built on it. Views are excluded:
  -- their row_count is not populated, and an unreferenced view is dead weight of a different
  -- kind. Every clause is a measurement; absence of any one of them keeps the object out.
  WITH orphans AS (
    SELECT o.object_key, o.row_count, o.bytes, o.last_write_at
      FROM clarity_object o
     WHERE o.object_kind IN ('table', 'matview')
       AND coalesce(o.row_count, 0) > 0
       AND coalesce(o.refs_app, 0) = 0
       AND coalesce(o.refs_script, 0) = 0
       AND coalesce(o.refs_migration, 0) = 0
       AND coalesce(o.refs_db_function, 0) = 0
       AND coalesce(o.lineage_out, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM clarity_question_ingredient qi
                        WHERE qi.object_key = 'public.' || o.object_key)
  ), upserted AS (
    INSERT INTO clarity_finding (detector, subject_object_key, title, evidence)
    SELECT 'orphan',
           x.object_key,
           format('%s holds %s rows and nothing references it', x.object_key, coalesce(x.row_count::text, '?')),
           jsonb_build_object('row_count', x.row_count, 'bytes', x.bytes, 'last_write_at', x.last_write_at)
      FROM orphans x
    ON CONFLICT (detector, subject_object_key, column_name)
    DO UPDATE SET last_seen_at = now(), evidence = excluded.evidence
    RETURNING 1
  )
  SELECT count(*) INTO n_orphan FROM upserted;

  RETURN jsonb_build_object('undiscovered_join', n_join, 'orphan', n_orphan);
END;
$$;

REVOKE ALL ON FUNCTION clarity_run_detectors() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION clarity_run_detectors() TO service_role;

REVOKE ALL ON clarity_finding FROM anon, authenticated;
GRANT ALL ON clarity_finding TO service_role;

COMMIT;
