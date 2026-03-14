-- Temporal Analysis: Donation timing vs Contract awards
-- Correlates political donations with subsequent contract wins by the same entity

-- Add properties column to political_donations for state-level date storage
ALTER TABLE political_donations ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}';

-- Materialized view: donation-to-contract temporal correlation
-- For entities with exact donation dates, measure the time gap to subsequent contracts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_donation_contract_timing AS
WITH
-- Donations with exact dates (64K records)
dated_donations AS (
  SELECT
    donor_abn,
    donor_name,
    donation_to,
    donation_date,
    amount,
    financial_year
  FROM political_donations
  WHERE donor_abn IS NOT NULL
    AND donation_date IS NOT NULL
    AND amount > 0
),

-- Contracts with start dates
dated_contracts AS (
  SELECT
    id as contract_id,
    supplier_abn,
    supplier_name,
    buyer_name,
    title,
    contract_value,
    contract_start,
    contract_end
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL
    AND contract_start IS NOT NULL
    AND contract_value > 10000  -- filter noise
),

-- Join: find contracts awarded AFTER donations by the same entity
temporal_matches AS (
  SELECT
    d.donor_abn as abn,
    d.donor_name,
    d.donation_to as party,
    d.donation_date,
    d.amount as donation_amount,
    c.contract_id,
    c.buyer_name,
    c.title as contract_title,
    c.contract_value,
    c.contract_start,
    (c.contract_start - d.donation_date) as days_between,
    -- Flag suspicious timing: donation within 365 days before contract
    CASE
      WHEN c.contract_start - d.donation_date BETWEEN 0 AND 90 THEN 'immediate'
      WHEN c.contract_start - d.donation_date BETWEEN 91 AND 180 THEN 'short'
      WHEN c.contract_start - d.donation_date BETWEEN 181 AND 365 THEN 'medium'
      WHEN c.contract_start - d.donation_date BETWEEN 366 AND 730 THEN 'long'
      ELSE 'very_long'
    END as timing_window
  FROM dated_donations d
  JOIN dated_contracts c ON c.supplier_abn = d.donor_abn
  WHERE c.contract_start >= d.donation_date  -- contract AFTER donation
    AND c.contract_start <= d.donation_date + INTERVAL '2 years'  -- within 2 years
)
SELECT
  abn,
  donor_name,
  party,
  donation_date,
  donation_amount,
  contract_id,
  buyer_name,
  contract_title,
  contract_value,
  contract_start,
  days_between,
  timing_window,
  -- ROI metric: contract value / donation amount
  CASE WHEN donation_amount > 0 THEN
    ROUND(contract_value / donation_amount, 1)
  ELSE 0 END as roi_multiple
FROM temporal_matches
ORDER BY contract_value DESC;

-- Index for efficient queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_donation_contract_timing_pk
  ON mv_donation_contract_timing (abn, donation_date, contract_id);

CREATE INDEX IF NOT EXISTS idx_mv_donation_contract_timing_window
  ON mv_donation_contract_timing (timing_window);

CREATE INDEX IF NOT EXISTS idx_mv_donation_contract_timing_roi
  ON mv_donation_contract_timing (roi_multiple DESC);

-- Summary view: per-entity temporal analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_temporal_summary AS
SELECT
  abn,
  donor_name,
  COUNT(DISTINCT donation_date) as donation_count,
  COUNT(DISTINCT contract_id) as contracts_after_donation,
  SUM(DISTINCT donation_amount) as total_donated,
  SUM(contract_value) as total_contracts_after,
  ROUND(AVG(days_between)) as avg_days_to_contract,
  MIN(days_between) as min_days_to_contract,
  COUNT(*) FILTER (WHERE timing_window = 'immediate') as immediate_contracts,
  COUNT(*) FILTER (WHERE timing_window = 'short') as short_window_contracts,
  COUNT(*) FILTER (WHERE timing_window = 'medium') as medium_window_contracts,
  CASE WHEN SUM(DISTINCT donation_amount) > 0 THEN
    ROUND(SUM(contract_value) / SUM(DISTINCT donation_amount), 1)
  ELSE 0 END as overall_roi,
  -- Parties donated to
  ARRAY_AGG(DISTINCT party) as parties
FROM mv_donation_contract_timing
GROUP BY abn, donor_name
HAVING COUNT(DISTINCT contract_id) >= 1
ORDER BY total_contracts_after DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_temporal_summary_abn
  ON mv_temporal_summary (abn);

-- Financial year correlation (for the 248K donations without exact dates)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fy_donation_contracts AS
WITH
fy_donations AS (
  SELECT
    donor_abn,
    donor_name,
    donation_to,
    financial_year,
    SUM(amount) as total_donated,
    COUNT(*) as donation_count
  FROM political_donations
  WHERE donor_abn IS NOT NULL
    AND financial_year IS NOT NULL
    AND amount > 0
  GROUP BY donor_abn, donor_name, donation_to, financial_year
),
-- Parse financial year to get end year (e.g., "2022-23" -> 2023)
fy_contracts AS (
  SELECT
    supplier_abn,
    supplier_name,
    buyer_name,
    CASE
      WHEN EXTRACT(MONTH FROM contract_start) >= 7
      THEN EXTRACT(YEAR FROM contract_start)::int || '-' || (EXTRACT(YEAR FROM contract_start)::int + 1 - 2000)::text
      ELSE (EXTRACT(YEAR FROM contract_start)::int - 1) || '-' || (EXTRACT(YEAR FROM contract_start)::int - 2000)::text
    END as contract_fy,
    SUM(contract_value) as total_contract_value,
    COUNT(*) as contract_count
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL
    AND contract_start IS NOT NULL
    AND contract_value > 10000
  GROUP BY supplier_abn, supplier_name, buyer_name, contract_fy
)
SELECT
  d.donor_abn as abn,
  d.donor_name,
  d.donation_to as party,
  d.financial_year as donation_fy,
  d.total_donated as fy_donation_total,
  c.buyer_name,
  c.contract_fy,
  c.total_contract_value as fy_contract_total,
  c.contract_count,
  -- Did contracts come in the same or next FY after donation?
  CASE
    WHEN d.financial_year = c.contract_fy THEN 'same_fy'
    ELSE 'next_fy'
  END as fy_relationship,
  CASE WHEN d.total_donated > 0 THEN
    ROUND(c.total_contract_value / d.total_donated, 1)
  ELSE 0 END as fy_roi
FROM fy_donations d
JOIN fy_contracts c ON c.supplier_abn = d.donor_abn
WHERE c.contract_fy = d.financial_year  -- same FY
   OR c.contract_fy = (  -- or next FY
     (SPLIT_PART(d.financial_year, '-', 1)::int + 1) || '-' ||
     (SPLIT_PART(d.financial_year, '-', 2)::int + 1)::text
   )
ORDER BY fy_contract_total DESC;

CREATE INDEX IF NOT EXISTS idx_mv_fy_donation_contracts_abn
  ON mv_fy_donation_contracts (abn);
