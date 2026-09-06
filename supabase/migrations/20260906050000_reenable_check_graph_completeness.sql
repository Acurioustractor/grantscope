-- Apply: scripts/db-apply.sh supabase/migrations/20260906050000_reenable_check_graph_completeness.sql
-- Data-only. Re-enables the nightly graph completeness gate, disabled by 20260906020000 while it
-- reported two false alarms. Both were recipe drift and are fixed (#422, #423, #425); the check now
-- reads clean on every dataset, so its exit 1 means something again.
UPDATE agent_schedules SET enabled = true, updated_at = now()
WHERE agent_id = 'check-graph-completeness'
RETURNING agent_id, enabled;
