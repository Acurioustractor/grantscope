-- ACNC Charities — Full Register (all ~63,500 charities)
-- Source: data.gov.au ACNC Register CSV (CC BY 4.0, updated weekly)
-- This stores identity/classification data for ALL charities, not just foundations.
-- Financial data lives in acnc_ais table; joined via v_charity_explorer view.

-- Enable pg_trgm for fuzzy name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS acnc_charities (
  abn TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  other_names TEXT,

  -- Classification
  charity_size TEXT,  -- Small, Medium, Large
  pbi BOOLEAN DEFAULT FALSE,  -- Public Benevolent Institution
  hpc BOOLEAN DEFAULT FALSE,  -- Health Promotion Charity
  registration_date DATE,
  date_established DATE,
  number_of_responsible_persons INT,
  financial_year_end TEXT,

  -- Address (first address row per ABN)
  address_line_1 TEXT,
  address_line_2 TEXT,
  address_line_3 TEXT,
  town_city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  website TEXT,

  -- Operating states (boolean flags)
  operates_in_act BOOLEAN DEFAULT FALSE,
  operates_in_nsw BOOLEAN DEFAULT FALSE,
  operates_in_nt BOOLEAN DEFAULT FALSE,
  operates_in_qld BOOLEAN DEFAULT FALSE,
  operates_in_sa BOOLEAN DEFAULT FALSE,
  operates_in_tas BOOLEAN DEFAULT FALSE,
  operates_in_vic BOOLEAN DEFAULT FALSE,
  operates_in_wa BOOLEAN DEFAULT FALSE,
  operating_countries TEXT,

  -- Purposes (12 columns from ACNC CSV)
  purpose_animal_welfare BOOLEAN DEFAULT FALSE,
  purpose_culture BOOLEAN DEFAULT FALSE,
  purpose_education BOOLEAN DEFAULT FALSE,
  purpose_health BOOLEAN DEFAULT FALSE,
  purpose_law_policy BOOLEAN DEFAULT FALSE,
  purpose_natural_environment BOOLEAN DEFAULT FALSE,
  purpose_human_rights BOOLEAN DEFAULT FALSE,
  purpose_general_public BOOLEAN DEFAULT FALSE,
  purpose_reconciliation BOOLEAN DEFAULT FALSE,
  purpose_religion BOOLEAN DEFAULT FALSE,
  purpose_social_welfare BOOLEAN DEFAULT FALSE,
  purpose_security BOOLEAN DEFAULT FALSE,

  -- Beneficiaries (28 columns from ACNC CSV)
  ben_aboriginal_tsi BOOLEAN DEFAULT FALSE,
  ben_adults BOOLEAN DEFAULT FALSE,
  ben_aged BOOLEAN DEFAULT FALSE,
  ben_children BOOLEAN DEFAULT FALSE,
  ben_communities_overseas BOOLEAN DEFAULT FALSE,
  ben_early_childhood BOOLEAN DEFAULT FALSE,
  ben_ethnic_groups BOOLEAN DEFAULT FALSE,
  ben_families BOOLEAN DEFAULT FALSE,
  ben_females BOOLEAN DEFAULT FALSE,
  ben_financially_disadvantaged BOOLEAN DEFAULT FALSE,
  ben_lgbtiqa BOOLEAN DEFAULT FALSE,
  ben_general_community BOOLEAN DEFAULT FALSE,
  ben_males BOOLEAN DEFAULT FALSE,
  ben_migrants_refugees BOOLEAN DEFAULT FALSE,
  ben_other BOOLEAN DEFAULT FALSE,
  ben_other_charities BOOLEAN DEFAULT FALSE,
  ben_people_at_risk_of_homelessness BOOLEAN DEFAULT FALSE,
  ben_people_with_chronic_illness BOOLEAN DEFAULT FALSE,
  ben_people_with_disabilities BOOLEAN DEFAULT FALSE,
  ben_pre_post_release BOOLEAN DEFAULT FALSE,
  ben_rural_regional_remote BOOLEAN DEFAULT FALSE,
  ben_unemployed BOOLEAN DEFAULT FALSE,
  ben_veterans BOOLEAN DEFAULT FALSE,
  ben_victims_of_crime BOOLEAN DEFAULT FALSE,
  ben_victims_of_disaster BOOLEAN DEFAULT FALSE,
  ben_youth BOOLEAN DEFAULT FALSE,
  ben_animals BOOLEAN DEFAULT FALSE,
  ben_environment BOOLEAN DEFAULT FALSE,
  ben_other_gender_identities BOOLEAN DEFAULT FALSE,

  -- Derived arrays for efficient filtering
  purposes TEXT[] DEFAULT '{}',
  beneficiaries TEXT[] DEFAULT '{}',
  operating_states TEXT[] DEFAULT '{}',

  -- Metadata
  is_foundation BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acnc_charities_name ON acnc_charities USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_size ON acnc_charities(charity_size);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_state ON acnc_charities(state);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_pbi ON acnc_charities(pbi) WHERE pbi = TRUE;
CREATE INDEX IF NOT EXISTS idx_acnc_charities_hpc ON acnc_charities(hpc) WHERE hpc = TRUE;
CREATE INDEX IF NOT EXISTS idx_acnc_charities_purposes ON acnc_charities USING gin(purposes);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_beneficiaries ON acnc_charities USING gin(beneficiaries);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_operating_states ON acnc_charities USING gin(operating_states);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_foundation ON acnc_charities(is_foundation) WHERE is_foundation = TRUE;

-- Materialized view for latest AIS per charity (fast join target)
-- Refresh after AIS imports: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_acnc_latest;
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_acnc_latest AS
SELECT DISTINCT ON (abn) *
FROM acnc_ais
ORDER BY abn, ais_year DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_acnc_latest_abn ON mv_acnc_latest(abn);

GRANT SELECT ON mv_acnc_latest TO anon, authenticated, service_role;

-- View: Charity Explorer — join register identity + latest AIS financials
CREATE OR REPLACE VIEW v_charity_explorer AS
SELECT
  c.*,
  a.total_revenue,
  a.total_expenses,
  a.total_assets,
  a.net_assets_liabilities,
  a.staff_fte,
  a.staff_volunteers,
  a.grants_donations_au,
  a.grants_donations_intl,
  COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0) AS total_grants_given,
  a.ais_year AS latest_financial_year
FROM acnc_charities c
LEFT JOIN mv_acnc_latest a ON c.abn = a.abn;

-- Grants for PostgREST access
GRANT SELECT ON acnc_charities TO anon, authenticated, service_role;
GRANT SELECT ON v_charity_explorer TO anon, authenticated, service_role;

COMMENT ON TABLE acnc_charities IS 'Full ACNC Charity Register — identity, classification, purposes, beneficiaries for all ~63,500 registered charities. CC BY 4.0.';
COMMENT ON VIEW v_charity_explorer IS 'Charity explorer view joining register identity data with latest AIS financials.';
