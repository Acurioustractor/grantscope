-- ORIC (Office of the Registrar of Indigenous Corporations) register
-- Source: data.gov.au — ~7,300 records (includes deregistered)
-- Part of Wave 1: Entity Registry for Australia's Power Map

CREATE TABLE IF NOT EXISTS oric_corporations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  icn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  abn TEXT,
  status TEXT NOT NULL DEFAULT 'Registered',
  status_reason TEXT,

  -- Dates
  registered_on DATE,
  deregistered_on DATE,

  -- Classification
  corporation_size TEXT,
  industry_sectors TEXT[],
  industry_sectors_raw TEXT,
  registered_with_acnc BOOLEAN DEFAULT false,

  -- Location
  state TEXT,
  postcode TEXT,

  -- Financials (2 years)
  income_year1 TEXT,
  assets_year1 TEXT,
  employees_year1 TEXT,
  income_year2 TEXT,
  assets_year2 TEXT,
  employees_year2 TEXT,
  financial_year1 INTEGER DEFAULT 2023,
  financial_year2 INTEGER DEFAULT 2024,

  -- ORIC public register URL
  oric_url TEXT,

  -- Cross-references (populated during enrichment)
  acnc_abn_match BOOLEAN DEFAULT false,

  -- Enrichment (Minimax LLM)
  enriched_description TEXT,
  enriched_focus_areas TEXT[],
  enriched_community_served TEXT,
  enriched_at TIMESTAMPTZ,
  enrichment_provider TEXT,

  -- Metadata
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oric_abn ON oric_corporations(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oric_state ON oric_corporations(state);
CREATE INDEX IF NOT EXISTS idx_oric_status ON oric_corporations(status);
CREATE INDEX IF NOT EXISTS idx_oric_name_trgm ON oric_corporations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_oric_acnc ON oric_corporations(registered_with_acnc) WHERE registered_with_acnc = true;
CREATE INDEX IF NOT EXISTS idx_oric_industries ON oric_corporations USING gin (industry_sectors);

-- Flag on acnc_charities for cross-reference
ALTER TABLE acnc_charities ADD COLUMN IF NOT EXISTS is_oric_corporation BOOLEAN DEFAULT false;
ALTER TABLE acnc_charities ADD COLUMN IF NOT EXISTS oric_icn TEXT;

-- RLS
ALTER TABLE oric_corporations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON oric_corporations FOR SELECT USING (true);
CREATE POLICY "Service write" ON oric_corporations FOR ALL USING (auth.role() = 'service_role');

-- Update v_charity_detail to include ORIC cross-reference
CREATE OR REPLACE VIEW v_charity_detail AS
SELECT
  c.abn,
  c.name,
  c.other_names,
  c.charity_size,
  c.pbi,
  c.hpc,
  c.registration_date,
  c.date_established,
  c.town_city,
  c.state,
  c.postcode,
  c.website,
  c.purposes,
  c.beneficiaries,
  c.operating_states,
  c.is_foundation,
  c.is_social_enterprise,
  c.is_oric_corporation,
  c.oric_icn,

  -- Latest AIS financials
  a.total_revenue,
  a.total_expenses,
  a.total_assets,
  a.net_assets_liabilities,
  a.staff_fte,
  a.staff_volunteers,
  a.grants_donations_au,
  a.grants_donations_intl,
  COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0) AS total_grants_given,
  a.ais_year AS latest_financial_year,

  -- Community org enrichment (NULL if not enriched)
  co.id AS community_org_id,
  co.description AS enriched_description,
  co.domain AS enriched_domains,
  co.programs AS enriched_programs,
  co.outcomes AS enriched_outcomes,
  co.admin_burden_hours,
  co.admin_burden_cost,
  co.annual_funding_received,
  co.profile_confidence AS enrichment_confidence,
  co.enriched_at

FROM acnc_charities c
LEFT JOIN mv_acnc_latest a ON c.abn = a.abn
LEFT JOIN community_orgs co ON c.abn = co.acnc_abn;

GRANT SELECT ON v_charity_detail TO anon, authenticated, service_role;
GRANT SELECT ON oric_corporations TO anon, authenticated, service_role;
