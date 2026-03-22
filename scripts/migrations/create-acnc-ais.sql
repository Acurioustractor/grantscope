-- ACNC Annual Information Statement (AIS) 2023 data
-- Source: data.gov.au/data/dataset/acnc-2023-annual-information-statement-ais-data

CREATE TABLE IF NOT EXISTS acnc_ais (
  id SERIAL PRIMARY KEY,
  abn TEXT NOT NULL,
  charity_name TEXT,
  registration_status TEXT,
  charity_website TEXT,
  charity_size TEXT,
  basic_religious_charity BOOLEAN,
  ais_due_date DATE,
  date_ais_received DATE,
  conducted_activities BOOLEAN,
  how_purposes_pursued TEXT,
  staff_full_time INT,
  staff_part_time INT,
  staff_casual INT,
  total_fte_staff NUMERIC,
  staff_volunteers INT,
  revenue_from_government NUMERIC,
  donations_and_bequests NUMERIC,
  revenue_goods_services NUMERIC,
  revenue_investments NUMERIC,
  all_other_revenue NUMERIC,
  total_revenue NUMERIC,
  other_income NUMERIC,
  total_gross_income NUMERIC,
  employee_expenses NUMERIC,
  grants_donations_australia NUMERIC,
  grants_donations_overseas NUMERIC,
  all_other_expenses NUMERIC,
  total_expenses NUMERIC,
  net_surplus_deficit NUMERIC,
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  net_assets NUMERIC,
  kmp_count INT,
  kmp_total_paid NUMERIC,
  report_year INT DEFAULT 2023,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acnc_ais_abn ON acnc_ais(abn);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_size ON acnc_ais(charity_size);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_gov_revenue ON acnc_ais(revenue_from_government DESC NULLS LAST);

-- Programs table with beneficiary targeting
CREATE TABLE IF NOT EXISTS acnc_programs (
  id SERIAL PRIMARY KEY,
  abn TEXT NOT NULL,
  charity_name TEXT,
  program_name TEXT,
  classification TEXT,
  -- Beneficiary flags
  targets_children BOOLEAN DEFAULT FALSE,
  targets_environment BOOLEAN DEFAULT FALSE,
  targets_families BOOLEAN DEFAULT FALSE,
  targets_general_community BOOLEAN DEFAULT FALSE,
  targets_migrants_refugees BOOLEAN DEFAULT FALSE,
  targets_overseas BOOLEAN DEFAULT FALSE,
  targets_atsi BOOLEAN DEFAULT FALSE,
  targets_elderly BOOLEAN DEFAULT FALSE,
  targets_early_childhood BOOLEAN DEFAULT FALSE,
  targets_females BOOLEAN DEFAULT FALSE,
  targets_lgbtiq BOOLEAN DEFAULT FALSE,
  targets_males BOOLEAN DEFAULT FALSE,
  targets_homeless BOOLEAN DEFAULT FALSE,
  targets_disability BOOLEAN DEFAULT FALSE,
  targets_crime_victims BOOLEAN DEFAULT FALSE,
  targets_animals BOOLEAN DEFAULT FALSE,
  targets_financially_disadvantaged BOOLEAN DEFAULT FALSE,
  targets_rural_remote BOOLEAN DEFAULT FALSE,
  targets_chronic_illness BOOLEAN DEFAULT FALSE,
  targets_offenders BOOLEAN DEFAULT FALSE,
  targets_veterans BOOLEAN DEFAULT FALSE,
  targets_youth BOOLEAN DEFAULT FALSE,
  targets_adults BOOLEAN DEFAULT FALSE,
  targets_other_charities BOOLEAN DEFAULT FALSE,
  targets_cald BOOLEAN DEFAULT FALSE,
  targets_unemployed BOOLEAN DEFAULT FALSE,
  targets_disaster_victims BOOLEAN DEFAULT FALSE,
  other_description TEXT,
  operating_locations TEXT[], -- array of location names
  operating_locations_coords TEXT[], -- array of lat/long
  charity_weblink TEXT,
  report_year INT DEFAULT 2023,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acnc_programs_abn ON acnc_programs(abn);
CREATE INDEX IF NOT EXISTS idx_acnc_programs_youth ON acnc_programs(targets_youth) WHERE targets_youth = TRUE;
CREATE INDEX IF NOT EXISTS idx_acnc_programs_atsi ON acnc_programs(targets_atsi) WHERE targets_atsi = TRUE;
CREATE INDEX IF NOT EXISTS idx_acnc_programs_offenders ON acnc_programs(targets_offenders) WHERE targets_offenders = TRUE;
CREATE INDEX IF NOT EXISTS idx_acnc_programs_crime ON acnc_programs(targets_crime_victims) WHERE targets_crime_victims = TRUE;
