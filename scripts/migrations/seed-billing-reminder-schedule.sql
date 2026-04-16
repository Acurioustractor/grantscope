UPDATE agent_schedules
SET
  enabled = true,
  interval_hours = 24,
  freshness_threshold_hours = 30,
  auto_create_task = true,
  priority = 3,
  updated_at = NOW()
WHERE agent_id = 'send-billing-reminders';

INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  freshness_threshold_hours,
  auto_create_task,
  priority,
  params,
  created_at,
  updated_at
)
SELECT
  'send-billing-reminders',
  24,
  true,
  30,
  true,
  3,
  '{}'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM agent_schedules
  WHERE agent_id = 'send-billing-reminders'
);
