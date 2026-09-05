-- GrantScope: Government Programs & Money Flows tables
-- Tracks government spending programs and money movement between entities

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GOVERNMENT_PROGRAMS — Government spending programs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS government_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  department TEXT,
  jurisdiction TEXT NOT NULL,           -- 'federal', 'qld', 'nsw', etc.
  domain TEXT,                          -- 'youth_justice', 'health', 'education'
  budget_annual DECIMAL(14,2),
  spend_per_unit DECIMAL(12,2),         -- e.g., $/child/year
  unit_label TEXT,                      -- 'child', 'person', 'bed'
  outcomes JSONB,                       -- [{metric, value, trend}]
  budget_history JSONB,                 -- [{year, amount}]
  source_url TEXT,
  source_type TEXT,                     -- 'budget_paper', 'annual_report', 'ckan'
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_programs_jurisdiction ON government_programs(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_gov_programs_domain ON government_programs(domain);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MONEY_FLOWS — Tracks money movement between entities
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS money_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,                 -- 'youth_justice', 'indigenous_health', etc.
  source_type TEXT NOT NULL,            -- 'taxpayer', 'government', 'foundation', 'corporate'
  source_name TEXT NOT NULL,
  destination_type TEXT NOT NULL,       -- 'government_program', 'foundation', 'community_org'
  destination_name TEXT NOT NULL,
  amount DECIMAL(14,2),
  year INTEGER,
  flow_type TEXT,                       -- 'grant', 'contract', 'donation', 'budget_allocation'
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_money_flows_domain ON money_flows(domain);
CREATE INDEX IF NOT EXISTS idx_money_flows_year ON money_flows(year);
CREATE INDEX IF NOT EXISTS idx_money_flows_source ON money_flows(source_type, source_name);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REPORTS — Living report definitions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  report_data JSONB,                    -- Pre-computed visualization data
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug);
CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
