-- Agent Task Queue: work queue + schedules for orchestrator
-- Depends on: agent_runs table (existing)

-- ─── Task Queue ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     text NOT NULL DEFAULT 'run_agent',
  agent_id      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority      int NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  params        jsonb DEFAULT '{}',
  depends_on    uuid[] DEFAULT '{}',
  scheduled_for timestamptz DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  retry_count   int NOT NULL DEFAULT 0,
  max_retries   int NOT NULL DEFAULT 2,
  created_by    text DEFAULT 'system',
  run_id        uuid REFERENCES agent_runs(id),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks (status, priority, scheduled_for);
CREATE INDEX idx_agent_tasks_agent ON agent_tasks (agent_id, status);

-- ─── Schedules ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_schedules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                  text UNIQUE NOT NULL,
  interval_hours            numeric NOT NULL DEFAULT 24,
  enabled                   boolean NOT NULL DEFAULT true,
  last_run_at               timestamptz,
  freshness_threshold_hours numeric DEFAULT NULL,
  auto_create_task          boolean NOT NULL DEFAULT true,
  priority                  int NOT NULL DEFAULT 5,
  params                    jsonb DEFAULT '{}',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- ─── Claim Next Task (atomic, skip-locked) ───────────────────────────────────

CREATE OR REPLACE FUNCTION claim_next_task(p_concurrency_limit int DEFAULT 2)
RETURNS TABLE (
  id uuid,
  task_type text,
  agent_id text,
  priority int,
  params jsonb,
  retry_count int,
  max_retries int
) LANGUAGE plpgsql AS $$
DECLARE
  running_count int;
  v_task record;
BEGIN
  -- Check concurrency
  SELECT count(*) INTO running_count
  FROM agent_tasks WHERE status = 'running';

  IF running_count >= p_concurrency_limit THEN
    RETURN;
  END IF;

  -- Claim one task: pending, past scheduled_for, dependencies all completed
  SELECT t.* INTO v_task
  FROM agent_tasks t
  WHERE t.status = 'pending'
    AND t.scheduled_for <= now()
    AND NOT EXISTS (
      SELECT 1 FROM unnest(t.depends_on) dep_id
      JOIN agent_tasks d ON d.id = dep_id
      WHERE d.status NOT IN ('completed')
    )
  ORDER BY t.priority ASC, t.scheduled_for ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task IS NULL THEN
    RETURN;
  END IF;

  UPDATE agent_tasks SET status = 'running', started_at = now()
  WHERE agent_tasks.id = v_task.id;

  id := v_task.id;
  task_type := v_task.task_type;
  agent_id := v_task.agent_id;
  priority := v_task.priority;
  params := v_task.params;
  retry_count := v_task.retry_count;
  max_retries := v_task.max_retries;
  RETURN NEXT;
END;
$$;

-- ─── Seed Schedules ──────────────────────────────────────────────────────────

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority, params) VALUES
  ('sync-acnc-charities',       168, true,  3, '{}'),
  ('sync-acnc-register',        168, true,  3, '{}'),
  ('sync-oric-corporations',    168, true,  3, '{}'),
  ('import-aec-donations',      168, true,  3, '{}'),
  ('sync-austender-contracts',   72, true,  3, '{}'),
  ('sync-ato-tax-transparency', 720, true,  5, '{}'),
  ('sync-asx-companies',        720, true,  5, '{}'),
  ('grantscope-discovery',       24, true,  2, '{}'),
  ('enrich-grants-free',         12, true,  4, '{"limit": 100}'),
  ('build-foundation-profiles',  48, true,  4, '{"limit": 25, "concurrency": 5}'),
  ('sync-foundation-programs',   48, true,  4, '{}'),
  ('backfill-embeddings',        24, true,  5, '{"batchSize": 100}'),
  ('build-entity-graph',         24, true,  3, '{}'),
  ('refresh-materialized-views',  6, true,  2, '{}'),
  ('resolve-donor-entities',     72, true,  4, '{}'),
  ('classify-community-controlled', 168, true, 5, '{}'),
  ('build-money-flow-data',      48, true,  4, '{}')
ON CONFLICT (agent_id) DO NOTHING;
