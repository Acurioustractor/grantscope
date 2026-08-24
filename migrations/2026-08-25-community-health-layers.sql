-- Community health layers, two sources, both already held:
--  1. ABS Census 2021 IP DataPack table I12 (long-term health conditions, Indigenous
--     persons, ILOC grain) + I04 medians -> reference table abs_nt_iloc_health.
--     Joins to goods_communities via abs_iloc_code (set by the 2026-08-24 backfill).
--  2. DSS payment demographics (Dec 2025, postcode grain, already in
--     dss_payment_demographics) -> three convenience columns on goods_communities.
--     POSTCODE GRAIN: a remote NT postcode spans many communities (0822 covers ~232
--     rows), so the same value repeats across them BY DESIGN and the source column
--     says so. Never sum these across communities sharing a postcode.
--
-- Apply (CSV on stdin):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-25-community-health-layers.sql < nt_iloc_health.csv

CREATE TABLE IF NOT EXISTS abs_nt_iloc_health (
  iloc_code text PRIMARY KEY,
  iloc_name text NOT NULL,
  indigenous_persons_counted integer,
  kidney_disease integer,
  heart_disease integer,
  diabetes integer,
  asthma integer,
  mental_health integer,
  arthritis integer,
  no_long_term_condition integer,
  median_age integer,
  median_hh_income_wk integer,
  loaded_at timestamptz DEFAULT now()
);
COMMENT ON TABLE abs_nt_iloc_health IS
  'ABS Census 2021 IP DataPack I12 (type of long-term health condition, Aboriginal and/or Torres Strait Islander persons) + I04 medians, ILOC grain, NT. Self-reported Census conditions, small-cell randomised: use as burden signal, never as clinical prevalence. Join goods_communities.abs_iloc_code.';

TRUNCATE abs_nt_iloc_health;
\copy abs_nt_iloc_health (iloc_code, iloc_name, indigenous_persons_counted, kidney_disease, heart_disease, diabetes, asthma, mental_health, arthritis, no_long_term_condition, median_age, median_hh_income_wk) FROM pstdin WITH (FORMAT csv, HEADER true);
SELECT count(*) AS health_rows FROM abs_nt_iloc_health;

-- 2. DSS postcode-grain convenience columns.
ALTER TABLE goods_communities
  ADD COLUMN IF NOT EXISTS dss_health_care_cards integer,
  ADD COLUMN IF NOT EXISTS dss_disability_pension integer,
  ADD COLUMN IF NOT EXISTS dss_jobseeker integer,
  ADD COLUMN IF NOT EXISTS dss_source text;

COMMENT ON COLUMN goods_communities.dss_health_care_cards IS
  'POSTCODE-grain: recipients across the whole postcode, repeated on every community sharing it. Never sum across communities.';

UPDATE goods_communities gc
SET dss_health_care_cards = hcc.recipient_count,
    dss_disability_pension = dsp.recipient_count,
    dss_jobseeker = js.recipient_count,
    dss_source = 'DSS payment demographics Dec 2025, POSTCODE ' || gc.postcode ||
                 ' grain: values cover every community sharing the postcode; never sum across them'
FROM (SELECT geography_code, recipient_count FROM dss_payment_demographics
      WHERE geography_type='postcode' AND payment_type='Health Care Card' AND quarter='December 2025') hcc
LEFT JOIN (SELECT geography_code, recipient_count FROM dss_payment_demographics
      WHERE geography_type='postcode' AND payment_type='Disability Support Pension' AND quarter='December 2025') dsp
  ON dsp.geography_code = hcc.geography_code
LEFT JOIN (SELECT geography_code, recipient_count FROM dss_payment_demographics
      WHERE geography_type='postcode' AND payment_type='JobSeeker Payment' AND quarter='December 2025') js
  ON js.geography_code = hcc.geography_code
WHERE gc.postcode IS NOT NULL
  AND ltrim(gc.postcode, '0') = hcc.geography_code;

SELECT count(*) AS dss_backfilled FROM goods_communities WHERE dss_source IS NOT NULL;

-- 3. PHIDU Social Health Atlas, LGA grain (added same day, after the discovery pass).
-- Source: phidu.torrens.edu.au national LGA workbook (June 2026 edition), sheets
-- Admissions_prevent_diag_total (PPH, 2020/21), Median_age_death (2019-2023),
-- Census_condition_type_total (2021). Licence CC BY-NC-SA 3.0 AU © PHIDU Torrens
-- University — attribution required, non-commercial: fine for the open registry,
-- CHECK before use behind a paid tier. Suppressed cells load as NULL with the
-- suppression reason kept. Rates are indirectly age-standardised; SR is vs
-- Australia=100. Join: goods_communities.lga_code (2021 ASGS 5-digit).
CREATE TABLE IF NOT EXISTS phidu_lga_health (
  lga_code text NOT NULL,
  lga_name text NOT NULL,
  indicator text NOT NULL,
  year text NOT NULL,
  number numeric,
  rate numeric,
  rate_unit text,
  sr numeric,
  suppression text,
  loaded_at timestamptz DEFAULT now(),
  PRIMARY KEY (lga_code, indicator)
);
COMMENT ON TABLE phidu_lga_health IS
  'PHIDU Social Health Atlas June 2026, LGA grain: PPH admissions 2020/21, median age at death 2019-2023, Census 2021 long-term conditions. CC BY-NC-SA 3.0 AU (c) PHIDU Torrens University: attribute, non-commercial. SR = indirectly standardised ratio vs Australia=100.';
-- \copy phidu_lga_health (lga_code, lga_name, indicator, year, number, rate, rate_unit, sr, suppression) FROM 'phidu_lga_health.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- 4. LGA corrections found DURING the PHIDU join verification: goods_communities had
-- PALM ISLAND at lga_code 32810 (Douglas, QLD) — confidently wrong — and NULL for
-- Maningrida/Wadeye. Only hand-certain corrections applied here; the broad LGA
-- attribution problem stays with the reason-coded placement lanes, never guessed.
UPDATE goods_communities SET lga_code='35790', lga_name='Palm Island'
  WHERE upper(community_name)='PALM ISLAND' AND state='QLD' AND lga_code='32810';
UPDATE goods_communities SET lga_code='74660', lga_name='West Arnhem'
  WHERE upper(community_name)='MANINGRIDA' AND state='NT' AND lga_code IS NULL;
UPDATE goods_communities SET lga_code='74680', lga_name='West Daly'
  WHERE upper(community_name)='WADEYE' AND state='NT' AND lga_code IS NULL;
