INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  priority,
  params
)
VALUES (
  'discover-foundation-programs-long-tail',
  24,
  true,
  4,
  '{"focus":"long-tail-founders"}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE
SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params;
