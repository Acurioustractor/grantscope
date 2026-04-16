CREATE TABLE IF NOT EXISTS agent_runtime_state (
  agent_id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

NOTIFY pgrst, 'reload schema';
