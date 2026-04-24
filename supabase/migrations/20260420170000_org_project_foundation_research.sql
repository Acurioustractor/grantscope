CREATE TABLE IF NOT EXISTS org_project_foundation_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  org_project_id UUID NOT NULL REFERENCES org_projects(id) ON DELETE CASCADE,
  org_project_foundation_id UUID NOT NULL REFERENCES org_project_foundations(id) ON DELETE CASCADE,
  foundation_thesis TEXT,
  evidence_summary TEXT,
  relationship_path TEXT,
  ask_shape TEXT,
  fit_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (fit_status IN ('ready', 'partial', 'missing')),
  proof_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (proof_status IN ('ready', 'partial', 'missing')),
  applicant_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (applicant_status IN ('ready', 'partial', 'missing')),
  relationship_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (relationship_status IN ('ready', 'partial', 'missing')),
  ask_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (ask_status IN ('ready', 'partial', 'missing')),
  missing_items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_project_foundation_research_unique UNIQUE (org_project_foundation_id)
);

CREATE INDEX IF NOT EXISTS idx_org_project_foundation_research_org
  ON org_project_foundation_research(org_profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_project_foundation_research_project
  ON org_project_foundation_research(org_project_id, updated_at DESC);

ALTER TABLE org_project_foundation_research ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_project_foundation_research_select
  ON org_project_foundation_research
  FOR SELECT
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_research_insert
  ON org_project_foundation_research
  FOR INSERT
  WITH CHECK (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_research_update
  ON org_project_foundation_research
  FOR UPDATE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_research_delete
  ON org_project_foundation_research
  FOR DELETE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_project_foundation_research_service
  ON org_project_foundation_research
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
