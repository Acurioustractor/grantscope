UPDATE agent_schedules
SET
  interval_hours = 168,
  enabled = true,
  auto_create_task = true,
  priority = 6,
  params = COALESCE(params, '{}'::jsonb),
  updated_at = NOW()
WHERE agent_id = 'discover-foundation-programs-full-sweep';

INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  last_run_at,
  freshness_threshold_hours,
  auto_create_task,
  priority,
  params,
  created_at,
  updated_at
)
SELECT
  'discover-foundation-programs-full-sweep',
  168,
  true,
  NULL,
  NULL,
  true,
  6,
  '{}'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM agent_schedules
  WHERE agent_id = 'discover-foundation-programs-full-sweep'
);
