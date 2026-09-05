-- =============================================================================
-- 2026-08-15-schedule-clarity-refresh.sql
--
-- Put the catalog refresh on a schedule. Without this, /clarity is a snapshot of
-- 15 Aug 2026 that ages silently — which is precisely the failure mode the whole
-- data-map exercise exists to end. A catalog that looks authoritative while going
-- stale is worse than no catalog.
--
-- TIMING. 18:00 UTC, chosen to sit after the two existing evening jobs so the
-- catalog reflects freshly-refreshed matviews rather than yesterday's:
--
--   17:00  job 4   refresh-civicgraph-mvs-nightly
--   17:30  job 10  refresh-closing-the-gap-state-summary
--   18:00  THIS    clarity_refresh()
--
-- COST. Measured at 36,509 ms on the first real execution — 817 exact count(*),
-- 6 estimates, 634 freshness probes, 1 deferred, zero timeouts, no pooler drop.
-- Roughly 7x cheaper than the 4.5-minute estimate the spec projected from
-- separately-measured parts. At that cost it could run hourly; nightly is chosen
-- because the underlying catalogue does not change faster than that, not because
-- of cost.
--
-- WHY pg_cron AND NOT A VERCEL CRON. vercel.json crons are HTTP requests, and the
-- app path caps a statement at 8s (anon 3s). A 36s in-database function cannot go
-- through it. This runs in the database, where the work is.
--
-- CURATION SURVIVES. clarity_refresh()'s ON CONFLICT clause updates only derived
-- columns — row counts, bytes, freshness, RLS, degree. The curated columns
-- (domain, lifecycle, grain, purpose, join_keys) written by
-- scripts/seed-clarity-curation.mjs are untouched, so a nightly run cannot wipe
-- the 812 descriptions. Verified against the function body, not assumed.
--
-- APPLY WITH:
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-15-schedule-clarity-refresh.sql
--
-- VERIFY AFTER APPLY:
--   SELECT jobid, schedule, active, jobname FROM cron.job ORDER BY jobid;
--   -- and after 18:00 UTC:
--   SELECT max(refreshed_at) FROM clarity_object;
-- =============================================================================

-- Idempotent: unschedule first so re-running this file does not create a duplicate job.
SELECT cron.unschedule('refresh-clarity-catalog-nightly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-clarity-catalog-nightly');

SELECT cron.schedule(
  'refresh-clarity-catalog-nightly',
  '0 18 * * *',
  $job$
    SELECT clarity_refresh();
    SELECT clarity_apply_act_flag();
  $job$
);

-- clarity_apply_act_flag() runs immediately after, because clarity_refresh() still
-- contains the superseded section G that sets act_business from a name-shape regex.
-- Until that section is replaced by a call to this function, the scope-table join has
-- to run after it to correct the result. Noted as follow-up in
-- migrations/2026-08-15-act-flag-from-scope-table.sql — two mechanisms, one correcting
-- the other, which is exactly the shape of defect that produced the original drift.
