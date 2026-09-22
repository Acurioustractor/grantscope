-- Unpin search_path on refresh_civicgraph_mvs_run(text) so the nightly matview refresh runs again.
--
-- 20260905142000_function_search_path.sql attached `SET search_path` to this PROCEDURE along with
-- 58 functions. A procedure with a SET clause may not run transaction control, and this one COMMITs
-- after every matview (so a crash cannot erase the refresh log). Every pg_cron run since has died
-- on its first COMMIT with "invalid transaction termination": nightly and weekly, last success
-- 2026-09-04, 18+ consecutive failures to 2026-09-21. All 107 matviews froze on 2026-09-04.
--
-- The body's first statement is `SET search_path TO 'public', 'extensions', 'pg_catalog'`, a
-- plain command, which is allowed and gives the same resolution. Removing the attached clause
-- loses nothing the body relies on.
--
-- The Supabase advisor will list this procedure as function_search_path_mutable again. Do NOT
-- re-pin it; the COMMENT below says so where the next person will look.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922190000_mv_refresh_procedure_unpin_search_path.sql
-- Post-check: the next 17:00 UTC run shows 'succeeded' in cron.job_run_details, and
-- mv_refresh_log gains rows with triggered_by = 'pg_cron:nightly'.

BEGIN;

ALTER PROCEDURE public.refresh_civicgraph_mvs_run(IN p_tier text) RESET search_path;

COMMENT ON PROCEDURE public.refresh_civicgraph_mvs_run(IN p_tier text) IS
  'Nightly/weekly matview refresh, CALLed by pg_cron. Must NOT carry a SET clause (e.g. search_path): '
  'it COMMITs per matview, and a procedure with SET cannot. Pinning it on 2026-09-05 stopped every '
  'refresh until 2026-09-22. The body sets search_path itself. See 20260922190000.';

COMMIT;
