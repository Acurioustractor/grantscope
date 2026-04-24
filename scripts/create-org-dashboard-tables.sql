-- Organisation Dashboard tables
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/create-org-dashboard-tables.sql

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. Extend org_profiles
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS linked_gs_entity_id UUID,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_org_profiles_slug ON org_profiles(slug);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. org_programs — BAU programs linked to funding sources
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system TEXT,
  funding_source TEXT,
  annual_amount_display TEXT,
  reporting_cycle TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'planned', 'ended')),
  funding_status TEXT NOT NULL DEFAULT 'gap',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_programs
  ADD COLUMN IF NOT EXISTS funding_status TEXT NOT NULL DEFAULT 'gap';

ALTER TABLE org_programs
  DROP CONSTRAINT IF EXISTS org_programs_funding_status_check;

ALTER TABLE org_programs
  ADD CONSTRAINT org_programs_funding_status_check
  CHECK (funding_status IN ('secured', 'applied', 'upcoming', 'prospect', 'gap', 'self-funded'));

CREATE INDEX IF NOT EXISTS idx_org_programs_org ON org_programs(org_profile_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. org_program_source_links — external linkage/crosswalks
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_program_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_program_id UUID NOT NULL REFERENCES org_programs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('justice_funding_program', 'alma_intervention', 'contract_buyer', 'pipeline_item')),
  source_key TEXT NOT NULL,
  source_label TEXT,
  parent_funder_name TEXT,
  parent_funder_entity_id UUID REFERENCES gs_entities(id) ON DELETE SET NULL,
  funder_name TEXT,
  funder_entity_id UUID REFERENCES gs_entities(id) ON DELETE SET NULL,
  funder_abn TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_program_source_links_unique UNIQUE (org_program_id, source_type, source_key)
);

CREATE INDEX IF NOT EXISTS idx_org_program_source_links_program
  ON org_program_source_links(org_program_id, source_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_org_program_source_links_type_key
  ON org_program_source_links(source_type, source_key);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. org_pipeline — Grant/funding pipeline
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_display TEXT,
  amount_numeric NUMERIC,
  funder TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'upcoming', 'drafting', 'submitted', 'awarded', 'rejected')),
  grant_opportunity_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_pipeline_org ON org_pipeline(org_profile_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. org_contacts — Partners, funders, suppliers, political contacts
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  organisation TEXT,
  contact_type TEXT NOT NULL DEFAULT 'partner' CHECK (contact_type IN ('governance', 'funder', 'partner', 'supplier', 'political', 'community', 'advocacy')),
  email TEXT,
  phone TEXT,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_contacts_org ON org_contacts(org_profile_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. org_leadership — Board and executive team
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_leadership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  external_roles JSONB DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_leadership_org ON org_leadership(org_profile_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. RLS policies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable RLS
ALTER TABLE org_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_program_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_leadership ENABLE ROW LEVEL SECURITY;

-- Helper: check if user owns or is member of the org
CREATE OR REPLACE FUNCTION user_can_access_org(p_org_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_profiles WHERE id = p_org_profile_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM org_members WHERE org_profile_id = p_org_profile_id AND user_id = auth.uid()
  )
$$;

-- org_programs
CREATE POLICY org_programs_select ON org_programs FOR SELECT USING (user_can_access_org(org_profile_id));
CREATE POLICY org_programs_insert ON org_programs FOR INSERT WITH CHECK (user_can_access_org(org_profile_id));
CREATE POLICY org_programs_update ON org_programs FOR UPDATE USING (user_can_access_org(org_profile_id));
CREATE POLICY org_programs_delete ON org_programs FOR DELETE USING (user_can_access_org(org_profile_id));

-- org_program_source_links
CREATE POLICY org_program_source_links_select ON org_program_source_links FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM org_programs
    WHERE org_programs.id = org_program_source_links.org_program_id
      AND user_can_access_org(org_programs.org_profile_id)
  )
);
CREATE POLICY org_program_source_links_insert ON org_program_source_links FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM org_programs
    WHERE org_programs.id = org_program_source_links.org_program_id
      AND user_can_access_org(org_programs.org_profile_id)
  )
);
CREATE POLICY org_program_source_links_update ON org_program_source_links FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM org_programs
    WHERE org_programs.id = org_program_source_links.org_program_id
      AND user_can_access_org(org_programs.org_profile_id)
  )
);
CREATE POLICY org_program_source_links_delete ON org_program_source_links FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM org_programs
    WHERE org_programs.id = org_program_source_links.org_program_id
      AND user_can_access_org(org_programs.org_profile_id)
  )
);

-- org_pipeline
CREATE POLICY org_pipeline_select ON org_pipeline FOR SELECT USING (user_can_access_org(org_profile_id));
CREATE POLICY org_pipeline_insert ON org_pipeline FOR INSERT WITH CHECK (user_can_access_org(org_profile_id));
CREATE POLICY org_pipeline_update ON org_pipeline FOR UPDATE USING (user_can_access_org(org_profile_id));
CREATE POLICY org_pipeline_delete ON org_pipeline FOR DELETE USING (user_can_access_org(org_profile_id));

-- org_contacts
CREATE POLICY org_contacts_select ON org_contacts FOR SELECT USING (user_can_access_org(org_profile_id));
CREATE POLICY org_contacts_insert ON org_contacts FOR INSERT WITH CHECK (user_can_access_org(org_profile_id));
CREATE POLICY org_contacts_update ON org_contacts FOR UPDATE USING (user_can_access_org(org_profile_id));
CREATE POLICY org_contacts_delete ON org_contacts FOR DELETE USING (user_can_access_org(org_profile_id));

-- org_leadership
CREATE POLICY org_leadership_select ON org_leadership FOR SELECT USING (user_can_access_org(org_profile_id));
CREATE POLICY org_leadership_insert ON org_leadership FOR INSERT WITH CHECK (user_can_access_org(org_profile_id));
CREATE POLICY org_leadership_update ON org_leadership FOR UPDATE USING (user_can_access_org(org_profile_id));
CREATE POLICY org_leadership_delete ON org_leadership FOR DELETE USING (user_can_access_org(org_profile_id));

-- Service role bypass (for server-side queries)
CREATE POLICY org_programs_service ON org_programs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_program_source_links_service ON org_program_source_links FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_pipeline_service ON org_pipeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_contacts_service ON org_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_leadership_service ON org_leadership FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
