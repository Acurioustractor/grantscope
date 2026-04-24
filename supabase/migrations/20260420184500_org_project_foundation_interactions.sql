CREATE TABLE IF NOT EXISTS org_project_foundation_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  org_project_id UUID NOT NULL REFERENCES org_projects(id) ON DELETE CASCADE,
  org_project_foundation_id UUID NOT NULL REFERENCES org_project_foundations(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('note', 'email', 'call', 'meeting', 'proposal', 'decision')),
  summary TEXT NOT NULL,
  notes TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_snapshot TEXT
    CHECK (
      status_snapshot IS NULL OR status_snapshot IN (
        'researching',
        'ready_to_approach',
        'approached',
        'meeting',
        'proposal',
        'won',
        'lost',
        'parked'
      )
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_project_foundation_interactions_foundation
  ON org_project_foundation_interactions(org_project_foundation_id, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_project_foundation_interactions_org
  ON org_project_foundation_interactions(org_profile_id, happened_at DESC);

ALTER TABLE org_project_foundation_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_project_foundation_interactions_select
  ON org_project_foundation_interactions
  FOR SELECT
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_interactions_insert
  ON org_project_foundation_interactions
  FOR INSERT
  WITH CHECK (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_interactions_update
  ON org_project_foundation_interactions
  FOR UPDATE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_interactions_delete
  ON org_project_foundation_interactions
  FOR DELETE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_interactions_service
  ON org_project_foundation_interactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
