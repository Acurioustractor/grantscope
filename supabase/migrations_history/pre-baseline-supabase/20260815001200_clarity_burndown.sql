-- ===========================================================================
-- /clarity slice 3 — WHAT CHANGED, part 3: the burn-down clause (graft G8).
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001200_clarity_burndown.sql
--
-- "1,365 do not feed a question" is an inert number. "1,365 · +0/wk · never" is
-- a decision. The rate is measured from clarity_gap_measurement, which as of
-- this migration has ZERO rows — clarity_measure_gaps() has never been run. So
-- rate_per_week comes back NULL and the surface renders '?/wk · unknown'. That
-- is the honest day-one answer, and it is why this view returns the sample
-- count alongside the rate rather than a bare number.
-- ===========================================================================

CREATE OR REPLACE VIEW v_clarity_metric_latest WITH (security_invoker = true) AS
SELECT DISTINCT ON (g.metric_key)
       g.metric_key, g.title, g.question, g.family, g.unit, g.direction, g.target,
       g.enabled, g.note, m.measured_at, m.numerator, m.denominator, m.value,
       m.status, m.duration_ms,
       CASE WHEN g.target IS NULL THEN NULL
            WHEN g.direction = 'higher_better' THEN m.value < g.target
            ELSE m.value > g.target END AS breached
  FROM clarity_gap_metric g
  JOIN clarity_gap_measurement m USING (metric_key)
 ORDER BY g.metric_key, m.measured_at DESC;
REVOKE ALL ON v_clarity_metric_latest FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_clarity_metric_latest TO service_role;

-- ---------------------------------------------------------------------------
-- The burn-down: where a metric is now, how fast it is moving, and — if the
-- rate holds — when it reaches its target. `eta_weeks IS NULL` with a non-null
-- rate means the movement is flat or going the wrong way, which the surface
-- must render as the word "never", not as a blank.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_clarity_burndown WITH (security_invoker = true) AS
WITH win AS (
  SELECT metric_key, value, measured_at
    FROM clarity_gap_measurement
   WHERE status = 'ok' AND value IS NOT NULL
     AND measured_at > now() - interval '90 days'
),
ends AS (
  SELECT metric_key,
         count(*)                                              AS samples,
         min(measured_at)                                      AS first_at,
         max(measured_at)                                      AS last_at,
         (array_agg(value ORDER BY measured_at ASC ))[1]        AS first_value,
         (array_agg(value ORDER BY measured_at DESC))[1]        AS last_value
    FROM win GROUP BY metric_key
)
SELECT g.metric_key, g.title, g.question, g.family, g.unit, g.direction, g.target,
       e.samples, e.first_at, e.last_at, e.first_value, e.last_value,
       CASE WHEN e.samples < 2
              OR extract(epoch FROM e.last_at - e.first_at) < 86400 THEN NULL
            ELSE round((e.last_value - e.first_value)
                       / (extract(epoch FROM e.last_at - e.first_at) / 604800.0), 3)
       END AS rate_per_week,
       CASE WHEN g.target IS NULL OR e.samples < 2
              OR extract(epoch FROM e.last_at - e.first_at) < 86400 THEN NULL
            ELSE (
              SELECT CASE WHEN r = 0 THEN NULL
                          WHEN (g.target - e.last_value) / r <= 0 THEN NULL
                          ELSE ceil((g.target - e.last_value) / r) END
                FROM (SELECT (e.last_value - e.first_value)
                             / (extract(epoch FROM e.last_at - e.first_at) / 604800.0) AS r) q
            )
       END AS eta_weeks
  FROM clarity_gap_metric g
  LEFT JOIN ends e USING (metric_key)
 WHERE g.enabled;
REVOKE ALL ON v_clarity_burndown FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_clarity_burndown TO service_role;
