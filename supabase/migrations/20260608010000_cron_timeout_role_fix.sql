-- Fix: nightly MV refresh cron times out at exactly 120s on REFRESH MATERIALIZED VIEW mv_abr_name_lookup.
--
-- Why the earlier fix (20260608000000) did NOT work:
--   That migration set statement_timeout=0 on the function (ALTER FUNCTION refresh_civicgraph_mvs
--   SET statement_timeout=0). But pg_cron runs `SELECT refresh_civicgraph_mvs()` as a DIRECT
--   (non-pooler) connection as role `postgres`, which inherits the cluster default statement_timeout
--   of 120s. PostgreSQL arms the statement_timeout timer when the OUTER command starts — before the
--   function is entered — and a function-entry GUC change does NOT re-arm/cancel that already-scheduled
--   timer. So the 120s timer fired every night on the 1.3 GB mv_abr_name_lookup refresh.
--
-- The fix must land at the ROLE level, where the GUC is applied at session startup (before any command's
-- timer is armed). pg_cron opens a fresh session per run as `postgres`, so this takes effect for the
-- nightly refresh (and every other direct-connection cron). Pooler-routed sessions (gsql.mjs / psql
-- migrations) keep their own explicitly-set 8s timeout, so admin-query safety is unaffected.
--
-- Verified 2026-06-08: cron job 4 failed 3 nights running at exactly 120.000s; postgres role had no
-- statement_timeout override in pg_db_role_setting.

ALTER ROLE postgres SET statement_timeout = 0;
