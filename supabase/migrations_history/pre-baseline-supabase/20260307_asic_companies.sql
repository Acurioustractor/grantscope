-- ASIC Companies Register
-- Source: data.gov.au CSV (tab-delimited), updated weekly (Tuesdays)
-- Wave 3: Company structures

CREATE TABLE IF NOT EXISTS asic_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  acn TEXT NOT NULL UNIQUE,
  abn TEXT,
  company_name TEXT NOT NULL,
  current_name TEXT,
  current_name_start_date DATE,

  -- Classification
  company_type TEXT,
  company_class TEXT,
  company_subclass TEXT,
  status TEXT,

  -- Dates
  date_of_registration DATE,
  date_of_deregistration DATE,

  -- State registration
  previous_state_of_registration TEXT,
  state_registration_number TEXT,

  -- Flags
  modified_flag TEXT,
  current_name_indicator TEXT,

  -- Cross-references
  acnc_match BOOLEAN DEFAULT false,
  oric_match BOOLEAN DEFAULT false,
  asx_listed BOOLEAN DEFAULT false,

  -- Metadata
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asic_abn ON asic_companies(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asic_status ON asic_companies(status);
CREATE INDEX IF NOT EXISTS idx_asic_type ON asic_companies(company_type);
CREATE INDEX IF NOT EXISTS idx_asic_name_trgm ON asic_companies USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asic_current_name_trgm ON asic_companies USING gin (current_name gin_trgm_ops);

-- RLS
ALTER TABLE asic_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON asic_companies FOR SELECT USING (true);
CREATE POLICY "Service write" ON asic_companies FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON asic_companies TO anon, authenticated, service_role;
