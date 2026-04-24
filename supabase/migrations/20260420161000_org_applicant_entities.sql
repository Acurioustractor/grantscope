CREATE TABLE IF NOT EXISTS org_applicant_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'other'
    CHECK (entity_type IN ('charity', 'company', 'pending_company', 'auspice', 'other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'archived')),
  abn TEXT,
  linked_gs_entity_id UUID REFERENCES gs_entities(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_applicant_entities_name_unique UNIQUE (org_profile_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_applicant_entities_org
  ON org_applicant_entities(org_profile_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_applicant_entities_single_default
  ON org_applicant_entities(org_profile_id)
  WHERE is_default = true;

ALTER TABLE org_applicant_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_applicant_entities_select
  ON org_applicant_entities
  FOR SELECT
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_applicant_entities_insert
  ON org_applicant_entities
  FOR INSERT
  WITH CHECK (user_can_access_org(org_profile_id));

CREATE POLICY org_applicant_entities_update
  ON org_applicant_entities
  FOR UPDATE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_applicant_entities_delete
  ON org_applicant_entities
  FOR DELETE
  USING (user_can_access_org(org_profile_id));

CREATE POLICY org_applicant_entities_service
  ON org_applicant_entities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS applicant_entity_id UUID REFERENCES org_applicant_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_applicant
  ON org_project_foundations(applicant_entity_id);
