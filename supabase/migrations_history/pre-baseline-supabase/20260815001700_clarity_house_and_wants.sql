-- /clarity slice 6 — THE WANT LIST AND THE HOUSE
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001700_clarity_house_and_wants.sql
--
-- Two things ship here.
--
-- 1. THE HOUSE SUBJECT. The 23 gap metrics stop being a private diagnostic table and become
--    questions about ourselves, on the same board, in the same shape, with targets. "71 of 98
--    matviews are in no refresh registry" becomes a contested card rather than a number nobody
--    is accountable for.
--
-- 2. THE WANT LIST. Every question that cannot be answered, priced and ranked by what fixing it
--    unlocks. Derived entirely from the question registry — nothing on the screen is hand-typed
--    that the registry did not already have to hold.
--
-- The one judgement call recorded here: cost_class on clarity_gap_metric is the cost of MEASURING
-- a metric, not the cost of FIXING what it measures. Deriving effort from it would have priced
-- every want wrong and looked authoritative doing it. fix_effort is a separate, hand-entered
-- column, and it is NULL wherever the fix is genuinely not priced yet. An unpriced want renders
-- "not priced", never "L".

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. What it would cost to close each gap
-- ---------------------------------------------------------------------------

ALTER TABLE clarity_gap_metric
  ADD COLUMN IF NOT EXISTS fix_effort   clarity_effort,
  ADD COLUMN IF NOT EXISTS fix_note     text,
  ADD COLUMN IF NOT EXISTS fix_dollars  numeric;

COMMENT ON COLUMN clarity_gap_metric.fix_effort IS
  'Effort to CLOSE this gap. NULL means unpriced, which is not the same as large. '
  'Distinct from cost_class, which is the cost of measuring the metric.';

UPDATE clarity_gap_metric SET fix_effort = 'S', fix_note = v.note
  FROM (VALUES
    ('matviews_unscheduled',
     'mv_refresh_registry and mv_refresh_plan() already exist from the 2026-08-14 migrations. '
     'Closing this is registering the matviews, not building the mechanism.'),
    ('matviews_stale',
     'Downstream of matviews_unscheduled. Registering them is what schedules them.'),
    ('estimated_row_counts',
     'A targeted count on the objects whose size is only an estimate. Bounded work.'),
    ('conflicting_metric_definitions',
     'Pick the canonical expression per concept in clarity_metric_definition and mark the rest. '
     'A decision, not an engineering job.')
  ) AS v(k, note)
 WHERE clarity_gap_metric.metric_key = v.k;

UPDATE clarity_gap_metric SET fix_effort = 'M', fix_note = v.note
  FROM (VALUES
    ('described_objects',
     '621 objects need a written purpose. Cheap per object, long in aggregate, and no tool writes '
     'it for you honestly.'),
    ('governed_objects',
     'Owner, licence and PII level per object. Blocked on decisions more than on typing.'),
    ('abn_attribution_donations',
     'Donor names resolved against abr_registry. The name-matching is the work; the join is not.'),
    ('abn_attribution_money',
     'Same lane as donations, larger surface.'),
    ('anon_readable_relations',
     'Revoking anon on relations nothing public reads. Each revoke needs checking against the app '
     'first, which is what makes it M rather than S.'),
    ('anon_executable_definers',
     'Same shape as anon_readable_relations, smaller and sharper.'),
    ('act_business_exposed',
     'ACT private-business objects should not be anon-readable at all. Bounded list, real care.'),
    ('bridge_columns_populated',
     'The 234 declared-but-never-populated seams found in slice 5. Each is its own backfill.'),
    ('interventions_with_evidence',
     'ALMA evidence linking through the junction tables. Judgement per intervention, no bulk path.')
  ) AS v(k, note)
 WHERE clarity_gap_metric.metric_key = v.k;

UPDATE clarity_gap_metric SET fix_effort = 'L', fix_note = v.note
  FROM (VALUES
    ('justice_edge_drillthrough',
     'gs_relationships.source_record_id is 0 of 49,426 — a dead key namespace, not a broken join. '
     'The edge builder has to be rebuilt to carry the source record through.'),
    ('dark_rows',
     'Not fixable by writing code. Either something starts reading these objects or they are '
     'retired, and both are decisions about the product.')
  ) AS v(k, note)
 WHERE clarity_gap_metric.metric_key = v.k;

-- Everything else stays NULL on purpose: entities_placed, postcodes_placeable, freshness_knowable,
-- countable_objects, stale_core_sources, views_unreferenced, matview_concurrent_fallback,
-- matviews_unregistered. Each is real work nobody has scoped, and a guessed effort on a ranked
-- list is worse than an empty cell, because the ranking would carry the guess.

-- ---------------------------------------------------------------------------
-- 2. The HOUSE subject — the gap metrics as questions about ourselves
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION clarity_sync_house()
RETURNS TABLE (questions_upserted int, answers_written int)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_q int := 0;
  v_a int := 0;
BEGIN
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
$fn$;

COMMENT ON FUNCTION clarity_sync_house() IS
  'Registers every enabled gap metric as a HOUSE question and mirrors its measurements into '
  'clarity_answer. Idempotent: re-running writes no duplicate answers. Called nightly by job 11.';

-- ---------------------------------------------------------------------------
-- 3. The want list
-- ---------------------------------------------------------------------------

-- Ranked by questions unlocked × dollars made legible ÷ effort, exactly as it says on the screen.
-- Unpriced wants (fix_effort NULL) rank at the L weight but carry effort_known = false, so the
-- screen can say "not priced" instead of implying somebody decided it was large.
DROP VIEW IF EXISTS v_clarity_wants;
CREATE VIEW v_clarity_wants AS
WITH blocked AS (
  SELECT q.*
    FROM clarity_question q
   WHERE q.state IN ('unanswerable', 'refused', 'contested')
),
blockers AS (
  SELECT b.slug,
         jsonb_agg(jsonb_build_object(
           'object_key', o.object_key,
           'object_name', o.object_name,
           'rows', o.row_count,
           'state', o.state
         ) ORDER BY o.object_name) AS blocker_objects
    FROM blocked b
    JOIN clarity_object o ON o.object_key = ANY (b.blocked_by)
   GROUP BY b.slug
)
SELECT
  b.slug,
  b.stub,
  b.question,
  b.subject,
  b.state,
  b.blocked_by,
  b.blocked_by_metric,
  b.unlock_effort,
  b.unlock_note,
  b.unlock_dollars,
  b.licence_note,
  coalesce(bl.blocker_objects, '[]'::jsonb)                     AS blocker_objects,
  -- Other questions stalled behind the same blockers. Itself included: a want that unlocks
  -- exactly one question still unlocks one question.
  (SELECT count(*)::int FROM clarity_question x
    WHERE x.slug <> b.slug
      AND (x.blocked_by && b.blocked_by
           OR (b.blocked_by_metric IS NOT NULL AND x.blocked_by_metric = b.blocked_by_metric)))
                                                                AS also_blocks,
  cardinality(b.unlocks_questions)                              AS unlocks_named,
  m.value                                                       AS metric_now,
  m.target                                                      AS metric_target,
  m.unit                                                        AS metric_unit,
  m.direction                                                   AS metric_direction,
  m.numerator                                                   AS metric_numerator,
  m.denominator                                                 AS metric_denominator,
  m.measured_at                                                 AS metric_measured_at,
  -- How far short, in the metric's own unit. Positive means the target is not met. Secondary
  -- sort on the screen, because with no dollar figures registered yet the rank collapses to
  -- three effort bands and would otherwise order arbitrarily inside each one.
  CASE
    WHEN m.value IS NULL OR m.target IS NULL THEN NULL
    WHEN m.direction = 'higher_better' THEN round(m.target - m.value, 2)
    ELSE round(m.value - m.target, 2)
  END                                                           AS metric_gap,
  bd.rate_per_week,
  bd.eta_weeks,
  bd.samples                                                    AS metric_samples,
  (b.unlock_effort IS NOT NULL)                                 AS effort_known,
  -- The ranking. Dollars are a floor and often absent, so the +1 keeps a want that unlocks three
  -- questions above one that unlocks none rather than zeroing them both out.
  round(
    (coalesce(b.unlock_dollars, 0) + 1)
    * (1 + (SELECT count(*) FROM clarity_question x
             WHERE x.slug <> b.slug
               AND (x.blocked_by && b.blocked_by
                    OR (b.blocked_by_metric IS NOT NULL
                        AND x.blocked_by_metric = b.blocked_by_metric))))
    / CASE b.unlock_effort WHEN 'S' THEN 1 WHEN 'M' THEN 3 ELSE 9 END
  , 2)                                                          AS rank_score
FROM blocked b
LEFT JOIN blockers bl                ON bl.slug = b.slug
LEFT JOIN v_clarity_metric_latest m  ON m.metric_key = b.blocked_by_metric
LEFT JOIN v_clarity_burndown bd      ON bd.metric_key = b.blocked_by_metric;

-- ---------------------------------------------------------------------------
-- 4. The nightly job learns the new step
-- ---------------------------------------------------------------------------
-- Order matters: gaps are measured first, then the HOUSE cards are synced off those fresh
-- measurements. Reversed, every HOUSE card would show yesterday's number all day.
SELECT cron.alter_job(
  11,
  command => $job$
    SELECT clarity_refresh();
    SELECT clarity_apply_act_flag();
    SELECT clarity_compute_deltas();
    SELECT clarity_measure_gaps('cheap');
    SELECT clarity_sync_house();
  $job$
);

COMMENT ON VIEW v_clarity_wants IS
  'Every question that cannot be answered, with what it would cost and what it unlocks. '
  'Derived entirely from clarity_question — nothing here is hand-maintained separately.';

COMMIT;
