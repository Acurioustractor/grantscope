-- ===========================================================================
-- /clarity slice 3 — WHAT CHANGED, part 4: put it on the nightly job.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001300_clarity_nightly_deltas.sql
--
-- Job 11 (refresh-clarity-catalog-nightly, 18:00 UTC) already runs
-- clarity_refresh() and clarity_apply_act_flag(). The order matters and is not
-- negotiable: clarity_refresh() writes tonight's history row LAST, so
-- clarity_compute_deltas() must run AFTER it or it compares tonight against
-- tonight and every delta is zero.
--
-- clarity_measure_gaps('cheap') joins the same job because the burn-down clause
-- ("+0/wk · never") is measured from clarity_gap_measurement, which has never
-- had a row written to it. 19 of the 23 metrics are cheap; the two expensive
-- and two medium ones stay off the nightly path deliberately.
-- ===========================================================================

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'refresh-clarity-catalog-nightly';

  IF v_jobid IS NULL THEN
    RAISE NOTICE 'refresh-clarity-catalog-nightly not found — nothing altered';
    RETURN;
  END IF;

  PERFORM cron.alter_job(
    job_id  => v_jobid,
    command => $cmd$
    SELECT clarity_refresh();
    SELECT clarity_apply_act_flag();
    SELECT clarity_compute_deltas();
    SELECT clarity_measure_gaps('cheap');
  $cmd$);
END $$;
