INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  priority,
  params
)
VALUES (
  'snapshot-grant-frontier',
  24,
  true,
  4,
  '{"domain":"grants"}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE
SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params;
