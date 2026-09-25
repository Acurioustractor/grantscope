-- One row per kept scheduled job per day: did it run, and did its output land.
--
-- On 2026-09-25 Ben reviewed JusticeHub's scheduled AI jobs and kept 19. Nothing watched them: GitHub
-- showed "success" for workflows that crashed inside, and the cron run log (agent_runs) records 0 new
-- and 0 updated for every cron because the ledger cannot see a handler's counts. JusticeHub's nightly
-- health check (scripts/jobs/health-check.ts, run by .github/workflows/job-health.yml) measures each
-- job the way that review did: its last run, and rows it produced in the last 1, 7 and 30 days,
-- counted from the table it writes (src/config/scheduled-jobs.ts says how). /admin/jobs reads this.
--
-- status: healthy (ran on time, and produced when it should), quiet (ran, but produced nothing for
-- longer than it should), broken (failed, or did not run on time), unknown (could not be measured;
-- never shown as green). One row per job per day; a rerun the same day replaces it.
--
-- Service role only.
--
-- Asked for by Ben 2026-09-25 ("build the health tracker").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260925043052_job_health.sql
-- Undo: DROP TABLE public.job_health;

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_health (
  job_id       text        NOT NULL,
  checked_on   date        NOT NULL,
  status       text        NOT NULL CHECK (status IN ('healthy', 'quiet', 'broken', 'unknown')),
  reason       text,
  last_run_at  timestamptz,
  last_run_ok  boolean,
  output_1d    integer,
  output_7d    integer,
  output_30d   integer,
  checked_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, checked_on)
);

CREATE INDEX IF NOT EXISTS job_health_checked_on_idx ON public.job_health (checked_on DESC);

ALTER TABLE public.job_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_health FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_health TO service_role;

COMMENT ON TABLE public.job_health IS
  'One row per kept JusticeHub scheduled job per day, written by scripts/jobs/health-check.ts. Service role only.';

COMMIT;
