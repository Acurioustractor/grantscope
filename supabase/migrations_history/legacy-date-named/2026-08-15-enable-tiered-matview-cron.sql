-- =============================================================================
-- 2026-08-15-enable-tiered-matview-cron.sql
--
-- Switch the nightly matview job onto the tiered registry plan, and add the
-- weekly tier. This is the Tier 3 step deliberately left commented out in
-- migrations/2026-08-14-mv-refresh-cron.sql.
--
-- WHAT CHANGES, AND WHAT DOES NOT
--
-- Job 4 today runs `SELECT refresh_civicgraph_mvs()`. After the 14 Aug rewrite
-- that function ALREADY reads mv_refresh_registry, so the tiered membership and
-- dependency ordering are live regardless of this file. What this buys is the
-- procedure's **COMMIT per matview**: a crash or disconnect partway through a
-- 15-minute run keeps every matview refreshed so far, and keeps their
-- mv_refresh_log rows. Under the old single-transaction shape, a mid-run failure
-- discarded the whole run INCLUDING the log rows that would have explained it.
--
-- cron.schedule() upserts by jobname, so scheduling the existing name UPDATES
-- job 4 rather than creating a second job. That matters — two jobs refreshing the
-- same 50 matviews concurrently would take ACCESS EXCLUSIVE locks against each
-- other on the 43 views that lack a unique index.
--
-- TIMING
--   17:00 daily   nightly tier, 50 matviews, measured median 15.6 min
--   15:00 Sunday  weekly tier, 15 matviews, measured 2.1 min
-- The weekly sits two hours clear of Sunday's nightly run. Both are well away
-- from job 11 (clarity catalog, 18:00), which reads row counts and should see a
-- settled state.
--
-- WHY THIS IS SAFE TO RUN NOW: the procedure was executed for real on the
-- `retire` tier (9 views, 15 MB) on 15 Aug. All 9 succeeded, COMMIT worked, and
-- durations came back non-zero — proving the clock_timestamp() fix — and
-- mv_foundation_landscape_geo correctly fell back to non-concurrent because its
-- only unique index is an expression index. The mechanism is verified by
-- execution, not by reading the docs.
--
-- APPLY WITH:
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-15-enable-tiered-matview-cron.sql
--
-- VERIFY AFTER APPLY:
--   SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobid;
--   -- job 4's command must now be CALL ...('nightly'); a NEW jobid for weekly.
--
-- VERIFY AFTER THE FIRST 17:00 RUN — this is the real test:
--   SELECT mv_name, started_at, duration_ms, status, used_concurrent
--     FROM mv_refresh_log WHERE triggered_by = 'pg_cron:nightly'
--     ORDER BY started_at DESC LIMIT 60;
--   -- durations MUST be non-zero and started_at MUST differ per row. Every
--   -- pg_cron row written before 15 Aug had duration_ms = 0 and an identical
--   -- timestamp, because now() is frozen for a whole transaction. If those
--   -- symptoms return, the per-matview COMMIT is not happening.
--
-- ROLLBACK:
--   SELECT cron.schedule('refresh-civicgraph-mvs-nightly', '0 17 * * *',
--                        $$SELECT refresh_civicgraph_mvs()$$);
--   SELECT cron.unschedule('refresh-civicgraph-mvs-weekly');
-- =============================================================================

-- Nightly: 50 matviews, dependency-ordered from pg_depend, one COMMIT each.
-- Upserts job 4 by name.
SELECT cron.schedule(
  'refresh-civicgraph-mvs-nightly',
  '0 17 * * *',
  $$CALL refresh_civicgraph_mvs_run('nightly')$$
);

-- Weekly: the foundation-scores chain and the 1.3GB mv_abr_name_lookup, which has
-- zero readers of any kind and does not need 124 seconds every night.
SELECT cron.schedule(
  'refresh-civicgraph-mvs-weekly',
  '0 15 * * 0',
  $$CALL refresh_civicgraph_mvs_run('weekly')$$
);
