-- AusTender federal procurement contracts
-- Source: OCDS API at api.tenders.gov.au (~800K+ contracts from 2013)
-- Wave 2: Where Government Money Flows

CREATE TABLE IF NOT EXISTS austender_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OCDS identifiers
  ocid TEXT NOT NULL UNIQUE,
  release_id TEXT,

  -- Contract details
  title TEXT,
  description TEXT,
  contract_value NUMERIC,
  currency TEXT DEFAULT 'AUD',
  procurement_method TEXT,
  category TEXT,

  -- Dates
  contract_start DATE,
  contract_end DATE,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,

  -- Buyer (government agency)
  buyer_name TEXT,
  buyer_id TEXT,

  -- Supplier
  supplier_name TEXT,
  supplier_abn TEXT,
  supplier_id TEXT,

  -- Cross-references
  supplier_acnc_match BOOLEAN DEFAULT false,
  supplier_oric_match BOOLEAN DEFAULT false,
  supplier_entity_type TEXT,

  -- Metadata
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_austender_supplier_abn ON austender_contracts(supplier_abn) WHERE supplier_abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_austender_buyer ON austender_contracts(buyer_name);
CREATE INDEX IF NOT EXISTS idx_austender_value ON austender_contracts(contract_value DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_austender_category ON austender_contracts(category);
CREATE INDEX IF NOT EXISTS idx_austender_published ON austender_contracts(date_published);
CREATE INDEX IF NOT EXISTS idx_austender_supplier_name_trgm ON austender_contracts USING gin (supplier_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_austender_title_trgm ON austender_contracts USING gin (title gin_trgm_ops);

-- RLS
ALTER TABLE austender_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON austender_contracts FOR SELECT USING (true);
CREATE POLICY "Service write" ON austender_contracts FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON austender_contracts TO anon, authenticated, service_role;
