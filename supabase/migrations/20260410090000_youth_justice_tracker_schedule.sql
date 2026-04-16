INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  last_run_at,
  freshness_threshold_hours,
  auto_create_task,
  priority,
  params
)
VALUES (
  'refresh-youth-justice-trackers',
  24,
  true,
  NULL,
  26,
  true,
  4,
  '{"scope":"portfolio","domain":"youth-justice","jurisdictions":["QLD","NSW","NT"]}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE
SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  auto_create_task = EXCLUDED.auto_create_task,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params,
  updated_at = NOW();
