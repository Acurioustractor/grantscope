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
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_programs_org ON org_programs(org_profile_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. org_pipeline — Grant/funding pipeline
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
-- 4. org_contacts — Partners, funders, suppliers, political contacts
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
-- 5. org_leadership — Board and executive team
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
-- 6. RLS policies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable RLS
ALTER TABLE org_programs ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY org_pipeline_service ON org_pipeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_contacts_service ON org_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_leadership_service ON org_leadership FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
