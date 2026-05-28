-- Wave D: stale auto-pass — keep the kanban from rotting under abandoned prospects
-- 2026-05-22

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 0. Expand status CHECK to allow auto-pass terminal + decision states
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE org_pipeline DROP CONSTRAINT IF EXISTS org_pipeline_status_check;
ALTER TABLE org_pipeline ADD CONSTRAINT org_pipeline_status_check CHECK (
  status IN (
    'prospect','upcoming','drafting','submitted','awarded','rejected',
    'passed','expired','watching','pursuing','discovered','won','lost','applied'
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- Function: auto-pass stale grant prospects
-- Rule: opportunity_type='grant' AND status IN ('prospect','watching','upcoming')
--       AND (
--         (deadline IS NOT NULL AND deadline < CURRENT_DATE - INTERVAL '30 days')
--         OR
--         (deadline IS NULL AND updated_at < NOW() - INTERVAL '180 days')
--       )
-- Skips: foundations, revenue streams, partnerships, certifications, scholarships
--        (those don't time out the same way)
--        Already-decided rows (won/lost/passed/applied/submitted)
-- ─────────────────────────────────────────────────────────────────────
-- Helper: safe deadline parse for the text column (handles 'YYYY-MM-DD' + 'D Mon YYYY')
CREATE OR REPLACE FUNCTION act_parse_pipeline_deadline(d text)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $func$
BEGIN
  IF d IS NULL OR d = '' OR lower(d) IN ('rolling','tbc','tbd','none','n/a') THEN
    RETURN NULL;
  END IF;
  -- ISO first
  IF d ~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN to_date(left(d,10), 'YYYY-MM-DD');
  END IF;
  -- 'D Mon YYYY' or 'DD Mon YYYY'
  IF d ~ '^\d{1,2}\s+\w{3}\s+\d{4}' THEN
    BEGIN
      RETURN to_date(d, 'DD Mon YYYY');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$func$;

CREATE OR REPLACE FUNCTION act_auto_pass_stale_pipeline()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_deadline_stale int;
  v_rolling_stale int;
  v_total int;
BEGIN
  -- Deadline >30 days past, never actioned
  WITH s AS (
    UPDATE org_pipeline SET
      status = 'passed',
      notes = COALESCE(notes,'') || E'\n[auto-passed: deadline >30d past with no decision · ' || to_char(now(),'YYYY-MM-DD') || ']',
      updated_at = now()
    WHERE opportunity_type = 'grant'
      AND status IN ('prospect','watching','upcoming','discovered')
      AND act_parse_pipeline_deadline(deadline) IS NOT NULL
      AND act_parse_pipeline_deadline(deadline) < CURRENT_DATE - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deadline_stale FROM s;

  -- Rolling/no-deadline + no activity in 6 months
  WITH s AS (
    UPDATE org_pipeline SET
      status = 'passed',
      notes = COALESCE(notes,'') || E'\n[auto-passed: rolling/no-deadline, no activity 180d · ' || to_char(now(),'YYYY-MM-DD') || ']',
      updated_at = now()
    WHERE opportunity_type = 'grant'
      AND status IN ('prospect','watching','upcoming','discovered')
      AND act_parse_pipeline_deadline(deadline) IS NULL
      AND updated_at < NOW() - INTERVAL '180 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rolling_stale FROM s;

  v_total := v_deadline_stale + v_rolling_stale;

  RETURN jsonb_build_object(
    'deadline_stale_passed', v_deadline_stale,
    'rolling_stale_passed',  v_rolling_stale,
    'total_passed',          v_total,
    'ran_at',                now()
  );
END;
$$;

COMMENT ON FUNCTION act_auto_pass_stale_pipeline() IS
  'Auto-pass grant pipeline rows that have either (a) passed deadline >30d ago without decision or (b) rolling/no-deadline with no activity >180d. Excludes foundations/revenue_streams/etc.';

-- ─────────────────────────────────────────────────────────────────────
-- pg_cron schedule: daily at 04:00 UTC (after MV refresh at 17:00 UTC)
-- ─────────────────────────────────────────────────────────────────────
-- Remove any prior registration so this is idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'act-auto-pass-stale-pipeline') THEN
    PERFORM cron.unschedule('act-auto-pass-stale-pipeline');
  END IF;
END $$;

SELECT cron.schedule(
  'act-auto-pass-stale-pipeline',
  '0 4 * * *',
  $cron$ SELECT act_auto_pass_stale_pipeline(); $cron$
);

-- ─────────────────────────────────────────────────────────────────────
-- Initial run — show what would change today
-- ─────────────────────────────────────────────────────────────────────
SELECT act_auto_pass_stale_pipeline() AS first_run;

COMMIT;
