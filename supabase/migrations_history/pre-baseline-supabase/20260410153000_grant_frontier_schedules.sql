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
VALUES
  (
    'sync-source-frontier',
    24,
    true,
    NULL,
    30,
    true,
    4,
    '{"scope":"grant-frontier","queue":"seed-and-maintain"}'::jsonb
  ),
  (
    'poll-source-frontier',
    6,
    true,
    NULL,
    8,
    true,
    4,
    '{"scope":"grant-frontier","queue":"grant-source-page"}'::jsonb
  ),
  (
    'poll-foundation-frontier',
    12,
    true,
    NULL,
    14,
    true,
    5,
    '{"scope":"grant-frontier","queue":"foundation-pages"}'::jsonb
  ),
  (
    'sync-foundation-programs',
    48,
    true,
    NULL,
    60,
    true,
    4,
    '{"scope":"grant-frontier","queue":"foundation-programs"}'::jsonb
  ),
  (
    'import-gov-grants',
    168,
    true,
    NULL,
    192,
    true,
    4,
    '{"scope":"grant-frontier","queue":"government-grants"}'::jsonb
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
