-- Archival memory table for Claude Code persistent learnings
CREATE TABLE IF NOT EXISTS archival_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  embedding vector(384),
  metadata jsonb DEFAULT '{}',
  project_dir text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS idx_archival_memory_embedding
  ON archival_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Index for project filtering
CREATE INDEX IF NOT EXISTS idx_archival_memory_project
  ON archival_memory (project_dir);

-- RLS
ALTER TABLE archival_memory ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "service_role_full_access" ON archival_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);
