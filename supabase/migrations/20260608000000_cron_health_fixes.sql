-- System-health sweep 2026-06-08: two pg_cron jobs were silently failing nightly.
-- Both changes below were already applied live; this migration records them for
-- version control / DB rebuild and is idempotent (safe to re-run).

-- 1. refresh-civicgraph-mvs-nightly failed every night on a statement timeout while
--    refreshing mv_abr_name_lookup (~1.3 GB). The whole function runs in one
--    transaction, so the timeout rolled back EVERY mv refresh in the run — all MVs
--    went ~6 weeks stale (last good refresh 2026-04-30). Dropping the per-statement
--    cap inside the function lets the large REFRESH complete.
ALTER FUNCTION public.refresh_civicgraph_mvs() SET statement_timeout = 0;

-- 2. cleanup-rate-limits ('0 3 * * *') DELETEd from notification_rate_limits, a table
--    that exists in no schema (dropped/never created). It failed nightly with
--    "relation does not exist". Nothing to repoint it to, so unschedule the dead job.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limits') THEN
    PERFORM cron.unschedule('cleanup-rate-limits');
  END IF;
END $$;
