UPDATE agent_schedules
SET
  enabled = true,
  interval_hours = 168,
  freshness_threshold_hours = 192,
  auto_create_task = true,
  priority = 3,
  updated_at = NOW()
WHERE agent_id = 'send-grant-alert-digests';

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
  'send-grant-alert-digests',
  168,
  true,
  192,
  true,
  3,
  '{}'::jsonb,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM agent_schedules
  WHERE agent_id = 'send-grant-alert-digests'
);
