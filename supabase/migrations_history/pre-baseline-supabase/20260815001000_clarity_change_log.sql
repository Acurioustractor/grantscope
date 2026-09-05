-- ===========================================================================
-- /clarity slice 3 — WHAT CHANGED, part 1: the change log itself.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001000_clarity_change_log.sql
--
-- Spec: thoughts/shared/data-map/clarity/CLARITY-SPEC.md §3.8, §4.4 (graft G2).
--
-- The failure this exists to make impossible: justice_funding went 218,022 ->
-- 157,116 rows, minus 28%, and nothing anywhere fired. A catalog that only
-- reports the present tense cannot catch that. clarity_delta is the derivative;
-- clarity_event is the alarm; `reason IS NULL` on a critical event is the alarm
-- still ringing.
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clarity_event_kind') THEN
    CREATE TYPE clarity_event_kind AS ENUM
      ('row_moved','object_new','object_missing','state_change','scope_change',
       'refresh_skipped','sentinel_fired','metric_crossed','probe_degraded','answer_drift');
  END IF;
END $$;

-- --------------------------------------------------------------- clarity_delta
-- Written nightly for all four baselines so every delta on every screen is one
-- indexed read rather than a join back through history. baseline_at IS NULL is
-- the signal to render '?' — never 0, never a flat line. A baseline we do not
-- have is not a baseline of zero.
CREATE TABLE IF NOT EXISTS clarity_delta (
  object_key    text NOT NULL,
  baseline      text NOT NULL CHECK (baseline IN ('last','7d','30d','90d')),
  row_before    bigint,
  row_delta     bigint,
  row_delta_pct numeric(12,3),
  bytes_delta   bigint,
  degree_delta  integer,
  importance_delta numeric(8,4),
  freshness_delta_hours numeric,
  state_before  text,
  state_change  text,
  is_new        boolean NOT NULL DEFAULT false,
  is_missing    boolean NOT NULL DEFAULT false,
  baseline_at   timestamptz,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (object_key, baseline)
);
CREATE INDEX IF NOT EXISTS clarity_delta_baseline_move
  ON clarity_delta (baseline, abs(row_delta_pct) DESC);

-- --------------------------------------------------------------- clarity_event
-- note   = machine-written provenance. Always populated.
-- reason = human-written. NULL on a critical event IS the alarm, and the whole
--          mechanism is that one column plus a text box.
CREATE TABLE IF NOT EXISTS clarity_event (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  event_type    clarity_event_kind NOT NULL,
  object_key    text,
  question_slug text,
  metric_key    text,
  before_value  numeric,
  after_value   numeric,
  delta_pct     numeric(12,3),
  severity      text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  note          text,
  reason        text,
  reason_by     text,
  reason_at     timestamptz
);
CREATE INDEX IF NOT EXISTS clarity_event_at        ON clarity_event (at DESC);
CREATE INDEX IF NOT EXISTS clarity_event_object    ON clarity_event (object_key, at DESC);
CREATE INDEX IF NOT EXISTS clarity_event_unexplain ON clarity_event (at DESC)
  WHERE severity = 'critical' AND reason IS NULL;

ALTER TABLE clarity_delta ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clarity_delta, clarity_event FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clarity_delta, clarity_event TO service_role;
GRANT USAGE, SELECT ON SEQUENCE clarity_event_id_seq TO service_role;

-- --------------------------------------------------- v_clarity_changes (read)
-- The screen's one query. Unexplained criticals sort to the top and stay there
-- until somebody writes a reason.
CREATE OR REPLACE VIEW v_clarity_changes WITH (security_invoker = true) AS
SELECT e.id, e.at, e.event_type::text AS event_type, e.object_key, e.question_slug,
       e.metric_key, e.before_value, e.after_value, e.delta_pct, e.severity,
       e.note, e.reason, e.reason_by, e.reason_at,
       (e.severity = 'critical' AND e.reason IS NULL) AS unexplained,
       o.domain, o.row_count, o.object_kind::text AS object_kind,
       coalesce(o.act_business, false) AS act_business
  FROM clarity_event e
  LEFT JOIN clarity_object o ON o.object_key = e.object_key;
REVOKE ALL ON v_clarity_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_clarity_changes TO service_role;

-- ===========================================================================
-- COLD START (graft G11) — real history where real history exists.
--
-- clarity_object_history begins 2026-08-15, the night the catalog first ran.
-- data_catalog_snapshots holds a genuine four-month series for 25 spine tables.
-- Lifting it in gives those 25 a real 90-day baseline on night one; the other
-- ~1,431 objects render '?' until the job has run enough nights, which is the
-- honest answer and not a zero.
--
-- Idempotent: notes = 'backfill:data_catalog_snapshots' marks what we inserted,
-- and rows carrying that marker are skipped on a re-run.
-- ===========================================================================
INSERT INTO clarity_object_history
  (snapshot_at, object_key, object_kind, row_count, row_count_is_estimate,
   bytes, last_write_at, degree, importance)
SELECT s.snapshot_at, o.object_key, o.object_kind, s.row_count, false,
       NULL, CASE WHEN s.freshness_hours IS NULL THEN NULL
                  ELSE s.snapshot_at - make_interval(hours => s.freshness_hours::int) END,
       NULL, NULL
  FROM data_catalog_snapshots s
  JOIN clarity_object o ON o.object_key = s.table_name
 WHERE s.notes IS DISTINCT FROM 'clarity_refresh'
   AND s.row_count IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM clarity_object_history h
      WHERE h.object_key = o.object_key AND h.snapshot_at = s.snapshot_at);

-- ---------------------------------------------------------------------------
-- The three documented 2026-04-02 row-moves. They were real, nothing fired at
-- the time, and no series in this database contains them. They go in as
-- critical with reason IS NULL, which is exactly what they are: unexplained.
-- ---------------------------------------------------------------------------
-- Only justice_funding's two endpoints were recorded. The other two moves were
-- recorded as percentages alone, so before/after stay NULL rather than being
-- back-computed into numbers that would read as measurements.
INSERT INTO clarity_event
  (at, event_type, object_key, before_value, after_value, delta_pct, severity, note)
SELECT v.at, 'row_moved'::clarity_event_kind, v.object_key,
       v.before_value, v.after_value, v.delta_pct, 'critical',
       'reconstructed from thoughts/shared/handoffs/frontend-data-audit/db-inventory.md, 2026-04-02'
  FROM (VALUES
    (timestamptz '2026-04-02 00:00:00+00', 'justice_funding',    218022::numeric, 157116::numeric, -27.936::numeric),
    (timestamptz '2026-04-02 00:00:00+00', 'gs_relationships',      NULL::numeric,   NULL::numeric, 124.000::numeric),
    (timestamptz '2026-04-02 00:00:00+00', 'political_donations',   NULL::numeric,   NULL::numeric, 744.000::numeric)
  ) AS v(at, object_key, before_value, after_value, delta_pct)
 WHERE NOT EXISTS (
   SELECT 1 FROM clarity_event e
    WHERE e.object_key = v.object_key AND e.at = v.at AND e.event_type = 'row_moved');
