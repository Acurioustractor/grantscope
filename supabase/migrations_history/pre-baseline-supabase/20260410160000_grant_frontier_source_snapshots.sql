CREATE TABLE IF NOT EXISTS grant_frontier_source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  source_group text NOT NULL,
  frontier_rows integer NOT NULL DEFAULT 0,
  due_now integer NOT NULL DEFAULT 0,
  ever_succeeded integer NOT NULL DEFAULT 0,
  never_succeeded integer NOT NULL DEFAULT 0,
  failing integer NOT NULL DEFAULT 0,
  changed_recent integer NOT NULL DEFAULT 0,
  grant_rows integer NOT NULL DEFAULT 0,
  future_deadline_rows integer NOT NULL DEFAULT 0,
  hot_score integer NOT NULL DEFAULT 0,
  hot_delta integer NOT NULL DEFAULT 0,
  due_delta integer NOT NULL DEFAULT 0,
  failure_delta integer NOT NULL DEFAULT 0,
  changed_delta integer NOT NULL DEFAULT 0,
  grant_delta integer NOT NULL DEFAULT 0,
  has_previous_snapshot boolean NOT NULL DEFAULT false,
  latest_success_at timestamptz,
  latest_change_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grant_frontier_source_snapshots_group_created
  ON grant_frontier_source_snapshots (source_group, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grant_frontier_source_snapshots_created
  ON grant_frontier_source_snapshots (created_at DESC);
