-- NDIS Public Data Tables
-- Source: dataresearch.ndis.gov.au (quarterly CSV downloads)
-- Purpose: Disability market transparency for Google.org application

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. NDIS Participants by LGA
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_participants_lga (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lga_code text,
  lga_name text,
  state text,
  service_district text,
  participant_count int,
  rollout_extent text,          -- full/partial
  reporting_period text,        -- e.g. '2025-Q2'
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_part_lga_state ON ndis_participants_lga(state);
CREATE INDEX IF NOT EXISTS idx_ndis_part_lga_code ON ndis_participants_lga(lga_code);
CREATE INDEX IF NOT EXISTS idx_ndis_part_lga_quarter ON ndis_participants_lga(quarter_date);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. NDIS Active Providers
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_providers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state text,
  support_class text,           -- e.g. 'Therapeutic Supports', 'Daily Activities'
  support_category text,
  disability_type text,         -- e.g. 'Intellectual', 'Psychosocial', 'Autism'
  age_group text,               -- e.g. '0-6', '7-14', '15-24', '25-64', '65+'
  provider_count int,
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_prov_state ON ndis_providers(state);
CREATE INDEX IF NOT EXISTS idx_ndis_prov_quarter ON ndis_providers(quarter_date);
CREATE INDEX IF NOT EXISTS idx_ndis_prov_disability ON ndis_providers(disability_type);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. NDIS Plan Budgets by service district
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_plan_budgets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_district text,
  state text,
  age_group text,
  disability_type text,
  support_class text,
  participant_count int,
  avg_annualised_budget numeric(12,2),  -- average annualised plan budget
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_budget_state ON ndis_plan_budgets(state);
CREATE INDEX IF NOT EXISTS idx_ndis_budget_quarter ON ndis_plan_budgets(quarter_date);
CREATE INDEX IF NOT EXISTS idx_ndis_budget_district ON ndis_plan_budgets(service_district);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. NDIS Plan Utilisation
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_utilisation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_district text,
  state text,
  age_group text,
  disability_type text,
  support_class text,
  utilisation_rate numeric(5,2),  -- percentage 0-100
  participant_count int,
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_util_state ON ndis_utilisation(state);
CREATE INDEX IF NOT EXISTS idx_ndis_util_quarter ON ndis_utilisation(quarter_date);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. NDIS Market Concentration
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_market_concentration (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state text,
  service_district text,
  support_class text,
  top10_payment_share numeric(5,2),  -- % of payments to top 10 providers
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_conc_state ON ndis_market_concentration(state);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. NDIS First Nations Participants
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_first_nations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state text,
  remoteness text,
  participant_count int,
  avg_annualised_support numeric(12,2),
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_fn_state ON ndis_first_nations(state);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. NDIS SDA (Specialist Disability Accommodation)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ndis_sda (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_district text,
  state text,
  sda_participants int,
  sil_participants int,
  enrolled_dwellings int,
  reporting_period text,
  quarter_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_sda_state ON ndis_sda(state);
