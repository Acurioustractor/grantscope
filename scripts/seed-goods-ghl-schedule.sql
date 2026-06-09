-- Register the self-applying Goods GHL warmth sync on a 12-hour cadence so the
-- /org/act/goods/engagement warmth map self-refreshes from the live CRM.
-- Command is resolved from the agent registry (scripts/lib/agent-registry.mjs)
-- by agent_id, so no command is stored here. Idempotent: safe to re-run.
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority)
SELECT 'sync-goods-ghl', 12, true, 3
WHERE NOT EXISTS (
  SELECT 1 FROM agent_schedules WHERE agent_id = 'sync-goods-ghl'
);
