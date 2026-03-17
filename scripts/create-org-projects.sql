-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- org_projects — hierarchical project structure for orgs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  parent_project_id UUID REFERENCES org_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  code TEXT,
  description TEXT,
  tier TEXT DEFAULT 'major' CHECK (tier IN ('major', 'sub', 'micro')),
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'planned', 'archived')),
  sort_order INT DEFAULT 0,
  abn TEXT,
  linked_gs_entity_id UUID,
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_profile_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_projects_org ON org_projects(org_profile_id);
CREATE INDEX IF NOT EXISTS idx_org_projects_parent ON org_projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_org_projects_slug ON org_projects(org_profile_id, slug);

-- RLS
ALTER TABLE org_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_projects_select" ON org_projects
  FOR SELECT USING (user_can_access_org(org_profile_id));

CREATE POLICY "org_projects_insert" ON org_projects
  FOR INSERT WITH CHECK (user_can_access_org(org_profile_id));

CREATE POLICY "org_projects_update" ON org_projects
  FOR UPDATE USING (user_can_access_org(org_profile_id));

CREATE POLICY "org_projects_delete" ON org_projects
  FOR DELETE USING (user_can_access_org(org_profile_id));

-- Service role bypass
CREATE POLICY "org_projects_service" ON org_projects
  FOR ALL USING (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Add project_id to existing org tables
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_programs' AND column_name = 'project_id') THEN
    ALTER TABLE org_programs ADD COLUMN project_id UUID REFERENCES org_projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_pipeline' AND column_name = 'project_id') THEN
    ALTER TABLE org_pipeline ADD COLUMN project_id UUID REFERENCES org_projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_contacts' AND column_name = 'project_id') THEN
    ALTER TABLE org_contacts ADD COLUMN project_id UUID REFERENCES org_projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_leadership' AND column_name = 'project_id') THEN
    ALTER TABLE org_leadership ADD COLUMN project_id UUID REFERENCES org_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes on project_id
CREATE INDEX IF NOT EXISTS idx_org_programs_project ON org_programs(project_id);
CREATE INDEX IF NOT EXISTS idx_org_pipeline_project ON org_pipeline(project_id);
CREATE INDEX IF NOT EXISTS idx_org_contacts_project ON org_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_org_leadership_project ON org_leadership(project_id);
