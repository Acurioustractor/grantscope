-- GrantScope: Community Organizations table
-- Profiles grassroots/community organizations and their access to funding

CREATE TABLE IF NOT EXISTS community_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acnc_abn TEXT UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  domain TEXT[],                        -- ['youth_justice', 'indigenous', 'mental_health']
  geographic_focus TEXT[],
  annual_revenue DECIMAL(14,2),
  annual_funding_received DECIMAL(14,2),
  funding_sources JSONB,                -- [{source, amount, type}]
  programs JSONB,                       -- [{name, description, outcomes}]
  outcomes JSONB,                       -- [{metric, value, evidence_url}]
  admin_burden_hours DECIMAL(8,2),      -- Estimated hours/year on compliance
  admin_burden_cost DECIMAL(12,2),      -- Estimated $/year on admin
  profile_confidence TEXT DEFAULT 'low',
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_orgs_domain ON community_orgs USING GIN(domain);
CREATE INDEX IF NOT EXISTS idx_community_orgs_geo ON community_orgs USING GIN(geographic_focus);
CREATE INDEX IF NOT EXISTS idx_community_orgs_revenue ON community_orgs(annual_revenue);
CREATE INDEX IF NOT EXISTS idx_community_orgs_name ON community_orgs(name);

CREATE TRIGGER community_orgs_updated_at
  BEFORE UPDATE ON community_orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
