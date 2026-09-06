-- Apply: scripts/db-apply.sh supabase/migrations/20260906020000_disable_noisy_orchestrator_schedules.sql
-- Data-only. Flips enabled=false on four agent_schedules rows the orchestrator kept retrying every night.
-- Reversible: UPDATE agent_schedules SET enabled = true WHERE agent_id IN (...).
UPDATE agent_schedules SET enabled = false, updated_at = now()
WHERE agent_id IN (
  'sync-goods-ghl',            -- GHL private-integration token in grantscope/.env returns 401; 14/17 failures in 30 days
  'check-graph-completeness',  -- exits 1 by design while grant_opportunities edges are 97% missing; nothing reads it
  'grantscope-discovery',      -- data widening (paused 2026-06-08); 3/8 runs hit the 30-minute timeout
  'poll-source-frontier'       -- data widening; polled grant source pages every 6h
)
RETURNING agent_id, enabled;
