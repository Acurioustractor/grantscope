-- ASX Listed Companies
-- Source: asx.com.au CSV, daily updates, ~2,200 companies
-- Part of Wave 3: Company structures

CREATE TABLE IF NOT EXISTS asx_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core
  company_name TEXT NOT NULL,
  asx_code TEXT NOT NULL UNIQUE,
  gics_industry_group TEXT,

  -- Cross-references (populated during cross-ref phase)
  abn TEXT,
  acn TEXT,
  asic_match BOOLEAN DEFAULT false,

  -- Metadata
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asx_abn ON asx_companies(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asx_name_trgm ON asx_companies USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asx_industry ON asx_companies(gics_industry_group);

-- RLS
ALTER TABLE asx_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON asx_companies FOR SELECT USING (true);
CREATE POLICY "Service write" ON asx_companies FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON asx_companies TO anon, authenticated, service_role;
