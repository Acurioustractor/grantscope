-- =============================================================================
-- 2026-08-18-disarm-periphery.sql
--
-- The periphery sweep (thoughts/shared/plans/periphery-sweep-2026-08-18.md) found
-- four scheduled things outliving the 2026-04-24 scope cut, and all four reported
-- success while doing it. This disarms them and fixes the column that lied.
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-18-disarm-periphery.sql
--
-- REVERSE (every step, in one block — nothing here is destructive):
--   UPDATE agent_schedules SET enabled = true WHERE agent_id IN (
--     'send-billing-reminders','bridge-community-directories','scrape-community-directories',
--     'ingest-open-community-directories','ingest-infoxchange-services');
--   SELECT cron.schedule('retry-missed-reactions','*/15 * * * *','SELECT retry_missed_reactions()');
--   -- last_scheduled_at can simply be dropped; nothing outside the orchestrator reads it.
-- =============================================================================

BEGIN;

-- ── 1. Split the scheduling stamp from the run stamp ─────────────────────────
-- agent_schedules.last_run_at was written when the orchestrator CREATED a task, not
-- when work succeeded. Four schedules therefore read "ran within the last two weeks"
-- while agent_runs said 2026-06-06 — or, for ingest-infoxchange-services, never.
-- The interval gate genuinely needs a "when did we last schedule" value, so this adds
-- one rather than moving the meaning of an existing column.
ALTER TABLE agent_schedules ADD COLUMN IF NOT EXISTS last_scheduled_at timestamptz;

COMMENT ON COLUMN agent_schedules.last_scheduled_at IS
  'When the orchestrator last created a task for this agent. Drives the interval gate. Written on task creation.';
COMMENT ON COLUMN agent_schedules.last_run_at IS
  'When work for this agent last SUCCEEDED. Written only on task completion — never on task creation. Compare with agent_runs; they must agree.';

-- Seed the new column from the old one: the existing values were scheduling stamps
-- all along, so this is a rename-in-place, not a guess.
UPDATE agent_schedules SET last_scheduled_at = last_run_at WHERE last_scheduled_at IS NULL;

-- Now make last_run_at tell the truth for the four that were lying: their real last
-- run comes from agent_runs, and NULL is correct for one that has never run.
UPDATE agent_schedules s
SET    last_run_at = (SELECT max(r.started_at) FROM agent_runs r WHERE r.agent_id = s.agent_id)
WHERE  s.agent_id IN ('bridge-community-directories','scrape-community-directories',
                      'ingest-open-community-directories','ingest-infoxchange-services');

-- ── 2. Disarm the billing reminders ──────────────────────────────────────────
-- Enabled, auto-creating, 24h, 33 runs, last 2026-08-18 05:31, and its registry command
-- carried no --dry-run: it calls sendEmail() as "CivicGraph Billing" for a subscription
-- product cut in April. It has mailed nobody because org_profiles happens to hold nobody
-- in a billing window — not because anything stopped it. The registry now also carries
-- --dry-run, so this is the first of two latches.
UPDATE agent_schedules SET enabled = false, updated_at = now()
WHERE  agent_id = 'send-billing-reminders';

-- ── 3. Disable the four schedules whose agents no longer exist ───────────────
-- None is present in scripts/lib/agent-registry.mjs (185 agents) and none has a script
-- on disk, so every task minted for them fails "Unknown agent" in executeTask.
UPDATE agent_schedules SET enabled = false, auto_create_task = false, updated_at = now()
WHERE  agent_id IN ('bridge-community-directories','scrape-community-directories',
                    'ingest-open-community-directories','ingest-infoxchange-services');

COMMIT;

-- ── 4. Unschedule the reactor ────────────────────────────────────────────────
-- pg_cron job 1, every 15 minutes = ~2,880 runs/month, and the top source of cron
-- failures in this database. event_reactions holds ONE row, written 2026-02-27;
-- integration_events went 8,860 (Mar) -> 543 (Apr) -> 0 (May) -> 61 (Aug). The flow it
-- retries died with the April cut. The function itself is left in place — this removes
-- only the schedule.
-- Outside the transaction: cron.unschedule() is not transactional.
SELECT cron.unschedule('retry-missed-reactions');
