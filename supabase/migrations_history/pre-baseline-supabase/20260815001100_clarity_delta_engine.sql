-- ===========================================================================
-- /clarity slice 3 — WHAT CHANGED, part 2: the engine.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001100_clarity_delta_engine.sql
--
-- clarity_compute_deltas() runs after clarity_refresh() has written tonight's
-- history row, so clarity_object IS the current snapshot and history holds the
-- baselines. It fills all four baselines and then emits events off the 'last'
-- baseline only — an anomaly is a thing that happened once, not a thing that
-- gets re-reported from four angles.
-- ===========================================================================

CREATE OR REPLACE FUNCTION clarity_compute_deltas(p_emit boolean DEFAULT true)
RETURNS TABLE (out_baseline text, out_objects integer, out_events integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  b            text;
  cutoff       timestamptz;
  n_obj        integer;
  n_ev         integer;
  oldest_hist  timestamptz;
BEGIN
  SELECT min(snapshot_at) INTO oldest_hist FROM clarity_object_history;

  FOREACH b IN ARRAY ARRAY['last','7d','30d','90d'] LOOP
    -- 'last' means the previous run, whenever it was. The dated baselines mean
    -- the newest snapshot at or before that date; if none exists the object's
    -- baseline_at stays NULL and every delta for it renders '?'.
    cutoff := CASE b
                WHEN '7d'  THEN now() - interval '7 days'
                WHEN '30d' THEN now() - interval '30 days'
                WHEN '90d' THEN now() - interval '90 days'
                ELSE NULL END;

    WITH latest AS (
      SELECT object_key, max(snapshot_at) AS at FROM clarity_object_history GROUP BY object_key
    ),
    base AS (
      SELECT DISTINCT ON (h.object_key)
             h.object_key, h.snapshot_at, h.row_count, h.bytes, h.degree,
             h.importance, h.last_write_at
        FROM clarity_object_history h
        LEFT JOIN latest l ON l.object_key = h.object_key
       WHERE CASE WHEN b = 'last' THEN h.snapshot_at < l.at
                  ELSE h.snapshot_at <= cutoff END
       ORDER BY h.object_key, h.snapshot_at DESC
    ),
    firsts AS (
      SELECT object_key, min(snapshot_at) AS first_at
        FROM clarity_object_history GROUP BY object_key
    ),
    calc AS (
      SELECT o.object_key,
             base.snapshot_at                              AS baseline_at,
             base.row_count                                AS row_before,
             o.row_count - base.row_count                  AS row_delta,
             CASE WHEN base.row_count IS NULL OR base.row_count = 0 THEN NULL
                  ELSE round(100.0 * (o.row_count - base.row_count)::numeric
                             / base.row_count::numeric, 3) END AS row_delta_pct,
             o.bytes - base.bytes                          AS bytes_delta,
             o.degree - base.degree                        AS degree_delta,
             o.importance - base.importance                AS importance_delta,
             CASE WHEN o.last_write_at IS NULL OR base.last_write_at IS NULL THEN NULL
                  ELSE round(extract(epoch FROM o.last_write_at - base.last_write_at)
                             / 3600.0, 2) END              AS freshness_delta_hours,
             -- An object is NEW relative to a baseline only if we were already
             -- keeping a series back then and it was not in it. Otherwise it is
             -- simply older than our history, which is a different sentence.
             (base.snapshot_at IS NULL
              AND f.first_at > coalesce(cutoff, f.first_at)
              AND oldest_hist < coalesce(cutoff, oldest_hist))  AS is_new,
             (o.missing_since IS NOT NULL)                 AS is_missing
        FROM clarity_object o
        LEFT JOIN base    ON base.object_key = o.object_key
        LEFT JOIN firsts f ON f.object_key   = o.object_key
    )
    INSERT INTO clarity_delta AS d
      (object_key, baseline, row_before, row_delta, row_delta_pct, bytes_delta,
       degree_delta, importance_delta, freshness_delta_hours, is_new, is_missing,
       baseline_at, computed_at)
    SELECT object_key, b, row_before, row_delta, row_delta_pct, bytes_delta,
           degree_delta, importance_delta, freshness_delta_hours,
           coalesce(is_new, false), coalesce(is_missing, false),
           baseline_at, now()
      FROM calc
    ON CONFLICT (object_key, baseline) DO UPDATE SET
      row_before = EXCLUDED.row_before,
      row_delta = EXCLUDED.row_delta,
      row_delta_pct = EXCLUDED.row_delta_pct,
      bytes_delta = EXCLUDED.bytes_delta,
      degree_delta = EXCLUDED.degree_delta,
      importance_delta = EXCLUDED.importance_delta,
      freshness_delta_hours = EXCLUDED.freshness_delta_hours,
      is_new = EXCLUDED.is_new,
      is_missing = EXCLUDED.is_missing,
      baseline_at = EXCLUDED.baseline_at,
      computed_at = EXCLUDED.computed_at;

    GET DIAGNOSTICS n_obj = ROW_COUNT;

    -- state_before is not in clarity_object_history, so it is carried on the
    -- delta row from the previous computation of the same baseline rather than
    -- being invented. First run leaves it NULL, which fires nothing.
    UPDATE clarity_delta d SET state_change =
      CASE WHEN d.state_before IS NOT NULL AND d.state_before IS DISTINCT FROM o.state
           THEN d.state_before || ' -> ' || o.state END,
      state_before = o.state
      FROM clarity_object o
     WHERE o.object_key = d.object_key AND d.baseline = b;

    n_ev := 0;
    IF p_emit AND b = 'last' THEN
      -- ---------------------------------------------------------------- the anomaly rule
      -- |row_delta| / max(prev,1) > 10%, or a crossing of zero in either
      -- direction. Both are critical, both stay red until a human writes a
      -- reason. The dedup guard is the baseline timestamp: an event already
      -- recorded since the baseline snapshot is the same event.
      INSERT INTO clarity_event
        (at, event_type, object_key, before_value, after_value, delta_pct, severity, note)
      SELECT now(), 'row_moved', d.object_key, d.row_before, o.row_count, d.row_delta_pct,
             'critical',
             CASE WHEN coalesce(d.row_before,0) = 0 OR coalesce(o.row_count,0) = 0
                  THEN 'crossed zero' ELSE 'moved more than 10% since the previous run' END
        FROM clarity_delta d
        JOIN clarity_object o ON o.object_key = d.object_key
       WHERE d.baseline = 'last'
         AND d.baseline_at IS NOT NULL
         AND d.row_delta IS NOT NULL
         AND (abs(d.row_delta)::numeric / greatest(coalesce(d.row_before,0), 1) > 0.10
              OR (coalesce(d.row_before,0) = 0) <> (coalesce(o.row_count,0) = 0))
         AND NOT EXISTS (SELECT 1 FROM clarity_event e
                          WHERE e.object_key = d.object_key
                            AND e.event_type = 'row_moved'
                            AND e.at >= d.baseline_at);
      GET DIAGNOSTICS n_ev = ROW_COUNT;

      INSERT INTO clarity_event (at, event_type, object_key, after_value, severity, note)
      SELECT now(), 'object_new', d.object_key, o.row_count, 'info',
             'first seen in the catalog'
        FROM clarity_delta d
        JOIN clarity_object o ON o.object_key = d.object_key
       WHERE d.baseline = 'last' AND d.is_new
         AND NOT EXISTS (SELECT 1 FROM clarity_event e
                          WHERE e.object_key = d.object_key AND e.event_type = 'object_new');

      INSERT INTO clarity_event (at, event_type, object_key, before_value, severity, note)
      SELECT now(), 'object_missing', o.object_key, o.row_count, 'critical',
             'no longer present in the schema; the catalog row is retained, not deleted'
        FROM clarity_object o
       WHERE o.missing_since IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM clarity_event e
                          WHERE e.object_key = o.object_key AND e.event_type = 'object_missing');

      INSERT INTO clarity_event (at, event_type, object_key, severity, note)
      SELECT now(), 'state_change', d.object_key, 'warn', d.state_change
        FROM clarity_delta d
       WHERE d.baseline = 'last' AND d.state_change IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM clarity_event e
                          WHERE e.object_key = d.object_key
                            AND e.event_type = 'state_change'
                            AND e.at >= coalesce(d.baseline_at, now() - interval '1 day'));

      -- ------------------------------------------------------------- answer drift
      -- A headline that moves more than 10% while none of its ingredients moved
      -- a single row is the failure a question board adds over an inventory: the
      -- data held still and the claim did not.
      WITH ranked AS (
        SELECT question_slug, headline_num, headline, computed_at,
               row_number() OVER (PARTITION BY question_slug ORDER BY computed_at DESC) AS rn
          FROM clarity_answer
         WHERE ok AND headline_num IS NOT NULL
      ),
      pairs AS (
        SELECT c.question_slug, p.headline_num AS before_num, c.headline_num AS after_num,
               c.headline, c.computed_at
          FROM ranked c JOIN ranked p ON p.question_slug = c.question_slug AND p.rn = 2
         WHERE c.rn = 1
      )
      INSERT INTO clarity_event
        (at, event_type, question_slug, before_value, after_value, delta_pct, severity, note)
      SELECT now(), 'answer_drift', pairs.question_slug, pairs.before_num, pairs.after_num,
             round(100.0 * (pairs.after_num - pairs.before_num)
                   / nullif(abs(pairs.before_num), 0), 3),
             'critical',
             'headline moved >10% with no ingredient row-count change: ' || pairs.headline
        FROM pairs
       WHERE abs(pairs.after_num - pairs.before_num)
             / greatest(abs(pairs.before_num), 1) > 0.10
         AND NOT EXISTS (
           SELECT 1 FROM clarity_question_ingredient i
             JOIN clarity_delta d ON d.object_key = i.object_key AND d.baseline = 'last'
            WHERE i.question_slug = pairs.question_slug
              AND coalesce(abs(d.row_delta), 0) > 0)
         AND NOT EXISTS (
           SELECT 1 FROM clarity_event e
            WHERE e.question_slug = pairs.question_slug
              AND e.event_type = 'answer_drift'
              AND e.at >= pairs.computed_at);
    END IF;

    out_baseline := b; out_objects := n_obj; out_events := n_ev;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- The write path behind [ RECORD THE REASON -> ]. One column and a text box is
-- the entire mechanism, so it gets one function and no ceremony.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_record_reason(
  p_event_id bigint,
  p_reason   text,
  p_by       text
) RETURNS TABLE (out_id bigint, out_reason text, out_by text, out_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $fn$
BEGIN
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'clarity_record_reason: a reason cannot be blank';
  END IF;
  RETURN QUERY
  UPDATE clarity_event e
     SET reason = btrim(p_reason), reason_by = p_by, reason_at = now()
   WHERE e.id = p_event_id
  RETURNING e.id, e.reason, e.reason_by, e.reason_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clarity_record_reason: no event %', p_event_id;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION clarity_compute_deltas(boolean)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_record_reason(bigint,text,text)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION clarity_compute_deltas(boolean)          TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_record_reason(bigint,text,text)  TO service_role;
