-- ROGS (Report on Government Services) Justice Spending Data
-- Source: Productivity Commission ROGS 2026
-- Covers: Corrections, Youth Justice, Courts, Police — all states, multi-year

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROGS_JUSTICE_SPENDING — Normalized state-by-state justice spending
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS rogs_justice_spending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  rogs_table TEXT NOT NULL,              -- e.g., '8A.1', '17A.10', '6A.1', '7A.1'
  rogs_section TEXT NOT NULL,            -- 'corrections', 'youth_justice', 'police', 'courts'
  financial_year TEXT NOT NULL,          -- e.g., '2024-25'

  -- Dimensions
  measure TEXT NOT NULL,                 -- e.g., 'Real recurrent expenditure', 'Government expenditure'
  service_type TEXT,                     -- e.g., 'Prison', 'Community correction', 'Detention-based supervision'
  indigenous_status TEXT DEFAULT 'All people',
  age_group TEXT,                        -- e.g., 'Adults', '10-17 years old'

  -- Description chain (from ROGS CSV columns)
  description1 TEXT,
  description2 TEXT,
  description3 TEXT,
  description4 TEXT,

  -- Unit and values
  unit TEXT NOT NULL,                    -- '$''000', '$m', '$', 'no.', 'rate', 'ratio'

  -- State-by-state values
  nsw DECIMAL(14,2),
  vic DECIMAL(14,2),
  qld DECIMAL(14,2),
  wa DECIMAL(14,2),
  sa DECIMAL(14,2),
  tas DECIMAL(14,2),
  act DECIMAL(14,2),
  nt DECIMAL(14,2),
  aust DECIMAL(14,2),

  -- Metadata
  data_source TEXT,
  year_dollars TEXT,                     -- e.g., '2024-25 dollars' (inflation adjustment base)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(rogs_table, financial_year, measure, service_type, description1, description2, description3, description4, unit)
);

CREATE INDEX IF NOT EXISTS idx_rogs_section ON rogs_justice_spending(rogs_section);
CREATE INDEX IF NOT EXISTS idx_rogs_year ON rogs_justice_spending(financial_year);
CREATE INDEX IF NOT EXISTS idx_rogs_service_type ON rogs_justice_spending(service_type);
CREATE INDEX IF NOT EXISTS idx_rogs_measure ON rogs_justice_spending(measure);
CREATE INDEX IF NOT EXISTS idx_rogs_unit ON rogs_justice_spending(unit);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Summary views for quick access
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Justice spending summary: latest year, key metrics by state
CREATE OR REPLACE VIEW v_justice_spending_summary AS
SELECT
  rogs_section,
  financial_year,
  service_type,
  unit,
  description2 as category,
  nsw, vic, qld, wa, sa, tas, act, nt, aust
FROM rogs_justice_spending
WHERE unit IN ('$''000', '$m')
  AND description2 IN (
    'Total net operating expenditure and capital costs',
    'Net operating expenditure',
    'Total expenditure',
    'Recurrent expenditure'
  )
  AND (description3 IS NULL OR description3 = '' OR description3 = 'Total')
ORDER BY rogs_section, financial_year DESC, service_type;

-- Youth justice: detention vs community cost comparison
CREATE OR REPLACE VIEW v_youth_justice_cost_comparison AS
SELECT
  financial_year,
  service_type,
  unit,
  description2 as metric,
  nsw, vic, qld, wa, sa, tas, act, nt, aust
FROM rogs_justice_spending
WHERE rogs_section = 'youth_justice'
  AND rogs_table = '17A.10'
ORDER BY financial_year DESC, service_type;

-- Indigenous overrepresentation in youth detention
CREATE OR REPLACE VIEW v_indigenous_youth_overrepresentation AS
SELECT
  financial_year,
  indigenous_status,
  service_type,
  description2 as metric,
  unit,
  nsw, vic, qld, wa, sa, tas, act, nt, aust
FROM rogs_justice_spending
WHERE rogs_section = 'youth_justice'
  AND rogs_table IN ('17A.5', '17A.7')
  AND indigenous_status != 'All people'
ORDER BY financial_year DESC, indigenous_status, service_type;

-- Enable RLS
ALTER TABLE rogs_justice_spending ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "rogs_public_read" ON rogs_justice_spending
  FOR SELECT USING (true);

-- Authenticated insert/update
CREATE POLICY "rogs_auth_write" ON rogs_justice_spending
  FOR ALL USING (auth.role() = 'authenticated');
