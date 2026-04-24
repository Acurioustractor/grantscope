CREATE TABLE IF NOT EXISTS org_project_foundations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  org_project_id UUID NOT NULL REFERENCES org_projects(id) ON DELETE CASCADE,
  foundation_id UUID NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'saved'
    CHECK (stage IN ('saved', 'priority', 'approach_now', 'in_conversation', 'parked')),
  fit_score INTEGER
    CHECK (fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)),
  fit_summary TEXT,
  message_alignment TEXT,
  next_step TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_project_foundations_unique UNIQUE (org_project_id, foundation_id)
);

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_project
  ON org_project_foundations(org_project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_org
  ON org_project_foundations(org_profile_id, updated_at DESC);

ALTER TABLE org_project_foundations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_project_foundations_select
  ON org_project_foundations
  FOR SELECT
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundations_insert
  ON org_project_foundations
  FOR INSERT
  WITH CHECK (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundations_update
  ON org_project_foundations
  FOR UPDATE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundations_delete
  ON org_project_foundations
  FOR DELETE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundations_service
  ON org_project_foundations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
