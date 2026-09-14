-- Apply: scripts/db-apply.sh supabase/migrations/20260914140000_schedule_smartygrants_discovery.sql
-- Data-only. Weekly schedule for the SmartyGrants source (agent grantscope-discovery-smartygrants in
-- scripts/lib/agent-registry.mjs). First run 2026-09-14 by hand: 609 rounds, 595 new, 0 errors, ~25 min.
-- Note: this is data widening, which has been paused since 2026-06-08; grantscope-discovery itself is disabled
-- (20260906020000). Ben chose to schedule this one lane anyway. Undo: set enabled = false.
BEGIN;

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, auto_create_task, priority, params)
SELECT 'grantscope-discovery-smartygrants', 168, true, true, 4, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agent_schedules WHERE agent_id = 'grantscope-discovery-smartygrants');

COMMIT;
