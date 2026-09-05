-- ABR Registry: Full Australian Business Register (~2.8M active ABNs)
-- Source: data.gov.au ABR bulk extract (monthly XML dumps)

CREATE TABLE IF NOT EXISTS abr_registry (
  abn text PRIMARY KEY,
  entity_name text NOT NULL,
  entity_type text,            -- 'Australian Public Company', 'Charity', etc.
  entity_type_code text,       -- PUB, PRV, IND, TRT, etc.
  status text NOT NULL DEFAULT 'Active',  -- ACT, CAN
  status_from_date date,
  postcode text,
  state text,
  acn text,
  gst_status text,             -- ACT, CAN, null
  gst_from_date date,
  acnc_registered boolean DEFAULT false,
  charity_type text,
  trading_names text[] DEFAULT '{}',
  record_updated_date date,
  imported_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abr_entity_name ON abr_registry USING gin (entity_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_abr_postcode ON abr_registry(postcode);
CREATE INDEX IF NOT EXISTS idx_abr_state ON abr_registry(state);
CREATE INDEX IF NOT EXISTS idx_abr_status ON abr_registry(status);
CREATE INDEX IF NOT EXISTS idx_abr_acn ON abr_registry(acn) WHERE acn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abr_entity_type_code ON abr_registry(entity_type_code);

-- ASIC Company Register: All Australian companies (~3M)
-- Source: ASIC company register bulk download (CSV)

CREATE TABLE IF NOT EXISTS asic_companies (
  acn text PRIMARY KEY,
  company_name text NOT NULL,
  company_type text,           -- APTY (Australian Proprietary), APUB, etc.
  company_class text,          -- LMSH (Limited by Shares), etc.
  company_subclass text,       -- PROP (Proprietary), PSTC, etc.
  status text NOT NULL DEFAULT 'REGD',  -- REGD, DRGD, EXAD
  date_of_registration date,
  date_of_deregistration date,
  previous_state text,
  state_registration_number text,
  abn text,
  former_names text[] DEFAULT '{}',
  imported_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asic_name ON asic_companies USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asic_abn ON asic_companies(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asic_status ON asic_companies(status);
CREATE INDEX IF NOT EXISTS idx_asic_type ON asic_companies(company_type);
