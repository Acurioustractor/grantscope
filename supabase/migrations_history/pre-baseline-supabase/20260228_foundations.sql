-- GrantScope: Foundations & Foundation Programs tables
-- Stores Australian philanthropic entities from ACNC register + scraping

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FOUNDATIONS — Australian philanthropic entities
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS foundations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acnc_abn TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT,                          -- 'private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation'
  website TEXT,
  description TEXT,

  -- Giving profile (built from annual reports + ACNC data)
  total_giving_annual DECIMAL(14,2),
  giving_history JSONB,               -- [{year, amount}]
  avg_grant_size DECIMAL(12,2),
  grant_range_min DECIMAL(12,2),
  grant_range_max DECIMAL(12,2),

  -- Focus areas
  thematic_focus TEXT[],              -- ['arts', 'environment', 'indigenous', 'health']
  geographic_focus TEXT[],            -- ['AU-QLD', 'AU-NSW', 'AU-National']
  target_recipients TEXT[],           -- ['nfp', 'individual', 'research', 'community_org']

  -- Transparency data
  endowment_size DECIMAL(14,2),
  investment_returns DECIMAL(14,2),
  giving_ratio DECIMAL(5,2),          -- giving / (investment_returns + revenue)
  revenue_sources TEXT[],             -- ['mining', 'property', 'finance', 'retail']
  parent_company TEXT,                -- If corporate foundation
  asx_code TEXT,                      -- If ASX-listed parent

  -- Programs (denormalized summary)
  open_programs JSONB,                -- [{name, url, amount, deadline, description}]

  -- Metadata
  acnc_data JSONB,                    -- Raw ACNC register row
  last_scraped_at TIMESTAMPTZ,
  profile_confidence TEXT DEFAULT 'low', -- 'low', 'medium', 'high'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foundations_type ON foundations(type);
CREATE INDEX IF NOT EXISTS idx_foundations_focus ON foundations USING GIN(thematic_focus);
CREATE INDEX IF NOT EXISTS idx_foundations_geo ON foundations USING GIN(geographic_focus);
CREATE INDEX IF NOT EXISTS idx_foundations_giving ON foundations(total_giving_annual DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_foundations_name ON foundations(name);
CREATE INDEX IF NOT EXISTS idx_foundations_asx ON foundations(asx_code) WHERE asx_code IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FOUNDATION_PROGRAMS — Open funding programs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS foundation_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id UUID REFERENCES foundations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  amount_min DECIMAL(12,2),
  amount_max DECIMAL(12,2),
  deadline DATE,
  status TEXT DEFAULT 'open',         -- 'open', 'closed', 'ongoing', 'unknown'
  categories TEXT[],
  eligibility TEXT,
  application_process TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foundation_programs_foundation ON foundation_programs(foundation_id);
CREATE INDEX IF NOT EXISTS idx_foundation_programs_status ON foundation_programs(status);
CREATE INDEX IF NOT EXISTS idx_foundation_programs_deadline ON foundation_programs(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foundation_programs_categories ON foundation_programs USING GIN(categories);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Updated_at trigger
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER foundations_updated_at
  BEFORE UPDATE ON foundations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
