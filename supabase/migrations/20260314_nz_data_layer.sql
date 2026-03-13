-- New Zealand data layer scaffolding
-- Mirrors the Australian gs_entities pattern but with NZ identifiers

-- NZ Charities Register (equivalent of ACNC)
CREATE TABLE IF NOT EXISTS nz_charities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  charity_type TEXT,
  sector TEXT,
  purposes TEXT[],
  beneficiaries TEXT[],
  activities TEXT,
  address_city TEXT,
  address_region TEXT,
  postal_code TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  registration_date DATE,
  annual_return_date DATE,
  total_income_nzd NUMERIC,
  total_expenditure_nzd NUMERIC,
  total_assets_nzd NUMERIC,
  officer_names TEXT[],
  is_deregistered BOOLEAN DEFAULT false,
  deregistration_date DATE,
  gs_entity_id UUID REFERENCES gs_entities(id),
  source_url TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nz_charities_name ON nz_charities USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_nz_charities_reg ON nz_charities (registration_number);
CREATE INDEX IF NOT EXISTS idx_nz_charities_gs ON nz_charities (gs_entity_id) WHERE gs_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nz_charities_region ON nz_charities (address_region);

-- NZ Government contracts (equivalent of AusTender)
CREATE TABLE IF NOT EXISTS nz_gets_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  buyer_name TEXT,
  buyer_org_id TEXT,
  supplier_name TEXT,
  supplier_nzbn TEXT,
  contract_value_nzd NUMERIC,
  currency TEXT DEFAULT 'NZD',
  contract_start DATE,
  contract_end DATE,
  category TEXT,
  unspsc_code TEXT,
  procurement_method TEXT,
  tender_type TEXT,
  region TEXT,
  status TEXT,
  award_date DATE,
  source_url TEXT,
  gs_entity_id UUID REFERENCES gs_entities(id),
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nz_gets_supplier ON nz_gets_contracts (supplier_nzbn);
CREATE INDEX IF NOT EXISTS idx_nz_gets_buyer ON nz_gets_contracts (buyer_name);
CREATE INDEX IF NOT EXISTS idx_nz_gets_value ON nz_gets_contracts (contract_value_nzd DESC);
CREATE INDEX IF NOT EXISTS idx_nz_gets_gs ON nz_gets_contracts (gs_entity_id) WHERE gs_entity_id IS NOT NULL;

-- NZ entity identifiers (NZBN — NZ Business Number, equivalent of ABN)
-- These link into gs_entities via the entity_identifiers pattern
-- identifier_type = 'NZBN' for New Zealand Business Number

ALTER TABLE nz_charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE nz_gets_contracts ENABLE ROW LEVEL SECURITY;
