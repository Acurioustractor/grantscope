-- ATO Corporate Tax Transparency data
-- Source: data.gov.au XLSX, annual, entities with $100M+ income
-- Wave 5: Who pays tax and who doesn't

CREATE TABLE IF NOT EXISTS ato_tax_transparency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  entity_name TEXT NOT NULL,
  abn TEXT NOT NULL,

  -- Financials
  total_income NUMERIC,
  taxable_income NUMERIC,
  tax_payable NUMERIC,

  -- Classification
  industry TEXT,
  entity_type TEXT,

  -- Reporting year
  report_year TEXT NOT NULL,

  -- Derived
  effective_tax_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN taxable_income > 0 THEN ROUND((tax_payable / taxable_income) * 100, 2) ELSE 0 END
  ) STORED,

  -- Cross-references
  acnc_match BOOLEAN DEFAULT false,
  asic_match BOOLEAN DEFAULT false,
  asx_listed BOOLEAN DEFAULT false,

  -- Metadata
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(abn, report_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ato_abn ON ato_tax_transparency(abn);
CREATE INDEX IF NOT EXISTS idx_ato_year ON ato_tax_transparency(report_year);
CREATE INDEX IF NOT EXISTS idx_ato_income ON ato_tax_transparency(total_income DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ato_tax_rate ON ato_tax_transparency(effective_tax_rate);
CREATE INDEX IF NOT EXISTS idx_ato_entity_name_trgm ON ato_tax_transparency USING gin (entity_name gin_trgm_ops);

-- RLS
ALTER TABLE ato_tax_transparency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON ato_tax_transparency FOR SELECT USING (true);
CREATE POLICY "Service write" ON ato_tax_transparency FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON ato_tax_transparency TO anon, authenticated, service_role;
