-- /clarity slice 7 part 2 — clarity_sync_house() must be able to demote a card that loses its price
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815002100_clarity_sync_house_demotion.sql
--
-- Found by running the full answer suite for the first time since slice 6. Two defects, one
-- migration:
--
-- 1. clarity_sync_house() aborted outright once justice_edge_drillthrough was corrected. The
--    correction cleared its fix_effort — the gap is not real, so there is nothing to price — but
--    the card was already in state 'unanswerable', and blocked_has_a_price forbids that
--    combination. Fixed by demoting price-less wants to draft before the upsert runs.
--
-- 2. The answer runner was picking up HOUSE questions, whose answer_sql is a numerator/denominator
--    measurement pair rather than an answer, and writing headline-less rows on top of good ones.
--    Fixed in scripts/run-clarity-answers.mjs, and the junk rows deleted.

BEGIN;

CREATE OR REPLACE FUNCTION public.clarity_sync_house()
 RETURNS TABLE(questions_upserted integer, answers_written integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_q int := 0;
  v_a int := 0;
BEGIN
  -- A card that LOSES its price must stop being a want before anything else touches it.
  -- blocked_has_a_price forbids an unanswerable question with no unlock_effort, and the upsert
  -- below writes the new (null) price while the old state is still 'unanswerable' — so without
  -- this step the whole function aborts. That is exactly what happened when
  -- justice_edge_drillthrough was corrected and its fix_effort cleared: the gap was no longer
  -- real, so it no longer had a price, so the card could no longer be a want.
  UPDATE clarity_question q
     SET state = 'draft', updated_at = now()
    FROM clarity_gap_metric g
   WHERE q.subject = 'HOUSE'
     AND q.state = 'unanswerable'
     AND q.blocked_by_metric = g.metric_key
     AND (g.fix_effort IS NULL OR g.fix_note IS NULL);

  -- One question per enabled metric. Disabled metrics (matviews_unregistered, which waits on a
  -- table that does not exist yet) get no card, because a card whose number can never arrive is
  -- the failure this whole surface exists to stop.
  WITH upserted AS (
    INSERT INTO clarity_question (
      slug, stub, question, subject, state, form, honest_at, publishable,
      caveat, exclusions, claim_phrasing, answer_sql, blocked_by, blocked_by_metric,
      unlock_effort, unlock_note, unlock_dollars, uniqueness, uniqueness_basis, surface
    )
    SELECT
      'house-' || replace(g.metric_key, '_', '-'),
      upper(g.title),
      g.question,
      'HOUSE',
      -- Provisional. Set for real below, off the latest measurement.
      'draft'::clarity_question_state,
      'scalar'::clarity_form_kind,
      'none'::clarity_honest_at,
      'internal'::clarity_publishable,
      'Measured about this database by clarity_measure_gaps(), on the schedule in job 11. '
        || coalesce(g.note, ''),
      '',
      -- HOUSE questions are internal. They get no publishable claim phrasing, and the empty
      -- string is the honest value rather than a sentence nobody may quote.
      '',
      format('SELECT (%s) AS numerator, (%s) AS denominator', g.numerator_sql, g.denominator_sql),
      -- The blocker is the metric itself, not an object in the catalog. Prefixed so it can never
      -- be mistaken for an object_key by anything that joins on blocked_by.
      ARRAY['metric:' || g.metric_key],
      g.metric_key,
      g.fix_effort,
      g.fix_note,
      g.fix_dollars,
      1.0,
      'Measured about this database and nowhere else.',
      '/clarity/wants'
    FROM clarity_gap_metric g
    WHERE g.enabled
    ON CONFLICT (slug) DO UPDATE SET
      stub          = excluded.stub,
      question      = excluded.question,
      caveat        = excluded.caveat,
      answer_sql    = excluded.answer_sql,
      blocked_by    = excluded.blocked_by,
      unlock_effort = excluded.unlock_effort,
      unlock_note   = excluded.unlock_note,
      unlock_dollars= excluded.unlock_dollars,
      updated_at    = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO v_q FROM upserted;

  -- State off the latest measurement. Four outcomes, never collapsed:
  --   answered     — measured, and inside target
  --   contested    — measured, and outside target. This is the adjudication CTA.
  --   unanswerable — never measured or the probe errored, AND somebody has priced the fix
  --   draft        — never measured and nobody has priced the fix. Registered, not yet a want.
  --
  -- That last split is forced by the blocked_has_a_price constraint slice 2 put on this table,
  -- and the constraint is right: an unanswerable question with no price is a complaint, not a
  -- want. It stays draft until someone fills in fix_effort.
  UPDATE clarity_question q
     SET state = CASE
           WHEN m.value IS NOT NULL AND m.status = 'ok' AND m.breached IS NOT TRUE THEN 'answered'
           WHEN m.value IS NOT NULL AND m.status = 'ok'                            THEN 'contested'
           WHEN g.fix_effort IS NOT NULL AND g.fix_note IS NOT NULL                THEN 'unanswerable'
           ELSE 'draft'
         END::clarity_question_state,
         updated_at = now()
    FROM clarity_gap_metric g
    LEFT JOIN v_clarity_metric_latest m ON m.metric_key = g.metric_key
   WHERE q.subject = 'HOUSE'
     AND q.blocked_by_metric = g.metric_key;

  -- A HOUSE card is a board card, so it needs an answer row like every other card. One answer per
  -- measurement, written once — re-running this function does not fabricate a new data point.
  WITH written AS (
    INSERT INTO clarity_answer (
      question_slug, computed_at, ok, headline, headline_sub, headline_num,
      coverage_num, coverage_den, coverage_label, row_count, duration_ms
    )
    SELECT
      q.slug,
      x.measured_at,
      x.status = 'ok',
      CASE
        WHEN x.value IS NULL THEN 'not measured'
        WHEN g.unit = 'pct'  THEN round(x.value, 1)::text || '%'
        ELSE round(x.value, 0)::text
      END,
      CASE
        WHEN g.target IS NULL THEN 'no target set'
        WHEN g.direction = 'higher_better' THEN 'target ≥ ' || g.target::text
        ELSE 'target ≤ ' || g.target::text
      END,
      x.value,
      x.numerator,
      x.denominator,
      g.unit,
      NULL,
      x.duration_ms
    FROM clarity_gap_measurement x
    JOIN clarity_gap_metric g   ON g.metric_key = x.metric_key
    JOIN clarity_question q     ON q.blocked_by_metric = x.metric_key AND q.subject = 'HOUSE'
    WHERE NOT EXISTS (
      SELECT 1 FROM clarity_answer a
       WHERE a.question_slug = q.slug AND a.computed_at = x.measured_at
    )
    RETURNING 1
  )
  SELECT count(*)::int INTO v_a FROM written;

  RETURN QUERY SELECT v_q, v_a;
END;
$function$;

COMMIT;
