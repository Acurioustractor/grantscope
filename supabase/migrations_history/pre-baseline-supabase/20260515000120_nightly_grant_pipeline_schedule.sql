-- Phase E — register the nightly grant pipeline as a scheduled agent
-- Runs scrape → promote (x2) → classify → backfill → verify → context → MV → blocklist nightly

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, freshness_threshold_hours, auto_create_task, priority)
VALUES
  ('nightly-grant-pipeline', 24, true, 48, false, 2)
ON CONFLICT (agent_id) DO UPDATE SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  updated_at = NOW();

SELECT agent_id, interval_hours, enabled, priority FROM agent_schedules WHERE agent_id = 'nightly-grant-pipeline';
