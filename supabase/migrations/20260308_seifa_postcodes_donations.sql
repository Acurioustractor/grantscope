-- SEIFA disadvantage index by postcode (ABS 2021 Census)
CREATE TABLE IF NOT EXISTS seifa_2021 (
  postcode TEXT NOT NULL,
  index_type TEXT NOT NULL, -- IRSD, IRSAD, IER, IEO
  score INTEGER,
  rank_national INTEGER,
  decile_national INTEGER,
  percentile_national NUMERIC(5,1),
  rank_state INTEGER,
  decile_state INTEGER,
  PRIMARY KEY (postcode, index_type)
);

CREATE INDEX idx_seifa_postcode ON seifa_2021(postcode);
CREATE INDEX idx_seifa_irsd_decile ON seifa_2021(decile_national) WHERE index_type = 'IRSD';

-- Australian postcode centroids (lat/long) from Matthew Proctor
CREATE TABLE IF NOT EXISTS postcode_geo (
  postcode TEXT NOT NULL,
  locality TEXT,
  state TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  sa2_code TEXT,
  sa2_name TEXT,
  sa3_code TEXT,
  sa3_name TEXT,
  sa4_code TEXT,
  sa4_name TEXT,
  remoteness_2021 TEXT,
  PRIMARY KEY (postcode, locality)
);

CREATE INDEX idx_postcodes_geo ON postcode_geo(postcode);
CREATE INDEX idx_postcodes_state ON postcode_geo(state);

-- AEC political donations
CREATE TABLE IF NOT EXISTS political_donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_year TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_abn TEXT,
  donation_to TEXT NOT NULL,
  donation_date DATE,
  amount NUMERIC(14,2),
  return_type TEXT, -- 'donor', 'party', 'third_party', 'associated_entity'
  receipt_type TEXT, -- 'donation', 'subscription', 'other'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_donor ON political_donations(donor_name);
CREATE INDEX idx_donations_abn ON political_donations(donor_abn) WHERE donor_abn IS NOT NULL;
CREATE INDEX idx_donations_to ON political_donations(donation_to);
CREATE INDEX idx_donations_year ON political_donations(financial_year);
CREATE UNIQUE INDEX idx_donations_dedup ON political_donations(financial_year, donor_name, donation_to, amount, donation_date);

-- QLD government expenditure (QGIP)
CREATE TABLE IF NOT EXISTS qld_govt_expenditure (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_year TEXT NOT NULL,
  department TEXT,
  program TEXT,
  recipient TEXT,
  amount NUMERIC(14,2),
  category TEXT, -- 'grant', 'procurement'
  region TEXT,
  service_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qld_exp_dept ON qld_govt_expenditure(department);
CREATE INDEX idx_qld_exp_year ON qld_govt_expenditure(financial_year);
CREATE INDEX idx_qld_exp_recipient ON qld_govt_expenditure(recipient);

-- Materialized view: charity funding by SEIFA decile
-- (to be created after data import)
