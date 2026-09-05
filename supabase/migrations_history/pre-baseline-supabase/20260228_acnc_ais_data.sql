-- ACNC Annual Information Statement (AIS) Raw Data
-- Source: data.gov.au CC BY 4.0 license
-- Updated weekly by ACNC, annual datasets by reporting year
-- This table stores the full AIS record for every charity per reporting year

CREATE TABLE IF NOT EXISTS acnc_ais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  abn TEXT NOT NULL,
  charity_name TEXT NOT NULL,
  ais_year INT NOT NULL,

  -- Registration & Status
  registration_status TEXT,
  charity_website TEXT,
  charity_size TEXT, -- small, medium, large
  basic_religious_charity BOOLEAN DEFAULT false,
  ais_due_date DATE,
  date_ais_received DATE,
  financial_report_date_received DATE,

  -- Activities
  conducted_activities BOOLEAN DEFAULT true,
  why_not_conducted TEXT,
  how_purposes_pursued TEXT,
  international_activities_details TEXT,

  -- Staff
  staff_full_time INT,
  staff_part_time INT,
  staff_casual INT,
  staff_fte NUMERIC(10,1),
  staff_volunteers INT,

  -- Financial Reporting
  cash_or_accrual TEXT,
  financial_statement_type TEXT,
  report_consolidated BOOLEAN DEFAULT false,
  report_has_modification BOOLEAN DEFAULT false,
  modification_type TEXT,
  has_related_party_transactions BOOLEAN DEFAULT false,
  fin_report_from DATE,
  fin_report_to DATE,

  -- Revenue (all in AUD, no cents)
  revenue_from_government NUMERIC(15,0),
  donations_and_bequests NUMERIC(15,0),
  revenue_from_goods_services NUMERIC(15,0),
  revenue_from_investments NUMERIC(15,0),
  all_other_revenue NUMERIC(15,0),
  total_revenue NUMERIC(15,0),
  other_income NUMERIC(15,0),
  total_gross_income NUMERIC(15,0),

  -- Expenses
  employee_expenses NUMERIC(15,0),
  interest_expenses NUMERIC(15,0),
  grants_donations_au NUMERIC(15,0),
  grants_donations_intl NUMERIC(15,0),
  all_other_expenses NUMERIC(15,0),
  total_expenses NUMERIC(15,0),

  -- Surplus/Deficit
  net_surplus_deficit NUMERIC(15,0),
  other_comprehensive_income NUMERIC(15,0),
  total_comprehensive_income NUMERIC(15,0),

  -- Assets & Liabilities
  total_current_assets NUMERIC(15,0),
  non_current_loans_receivable NUMERIC(15,0),
  other_non_current_assets NUMERIC(15,0),
  total_non_current_assets NUMERIC(15,0),
  total_assets NUMERIC(15,0),
  total_current_liabilities NUMERIC(15,0),
  non_current_loans_payable NUMERIC(15,0),
  other_non_current_liabilities NUMERIC(15,0),
  total_non_current_liabilities NUMERIC(15,0),
  total_liabilities NUMERIC(15,0),
  net_assets_liabilities NUMERIC(15,0),

  -- Key Management Personnel
  has_key_management_personnel BOOLEAN DEFAULT false,
  num_key_management_personnel INT,
  total_paid_key_management NUMERIC(15,0),

  -- Association & Fundraising numbers (state registrations)
  incorporated_association BOOLEAN DEFAULT false,
  association_numbers JSONB, -- {act: "...", nsw: "...", etc}
  fundraising_states JSONB,  -- {act: true, nsw: true, etc}
  fundraising_numbers JSONB, -- {act: "...", nsw: "...", etc}

  -- Metadata
  imported_at TIMESTAMPTZ DEFAULT now(),
  data_source TEXT DEFAULT 'data.gov.au',
  resource_id TEXT, -- CKAN resource ID for provenance

  -- Unique constraint: one record per charity per year
  UNIQUE(abn, ais_year)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_acnc_ais_abn ON acnc_ais(abn);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_year ON acnc_ais(ais_year);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_grants ON acnc_ais(grants_donations_au DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_revenue ON acnc_ais(total_revenue DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_acnc_ais_size ON acnc_ais(charity_size);

-- Link to foundations table
CREATE INDEX IF NOT EXISTS idx_acnc_ais_lookup ON acnc_ais(abn, ais_year DESC);

-- View: Latest AIS for each charity (most recent year)
CREATE OR REPLACE VIEW v_acnc_latest AS
SELECT DISTINCT ON (abn) *
FROM acnc_ais
ORDER BY abn, ais_year DESC;

-- View: Grant-making charities (those that give grants)
CREATE OR REPLACE VIEW v_acnc_grant_makers AS
SELECT
  abn,
  charity_name,
  ais_year,
  charity_size,
  total_revenue,
  grants_donations_au,
  grants_donations_intl,
  COALESCE(grants_donations_au, 0) + COALESCE(grants_donations_intl, 0) AS total_grants,
  CASE
    WHEN total_revenue > 0 THEN
      ROUND((COALESCE(grants_donations_au, 0) + COALESCE(grants_donations_intl, 0))::NUMERIC / total_revenue * 100, 1)
    ELSE NULL
  END AS giving_ratio_pct,
  total_assets,
  net_assets_liabilities,
  staff_fte,
  staff_volunteers,
  charity_website
FROM acnc_ais
WHERE COALESCE(grants_donations_au, 0) + COALESCE(grants_donations_intl, 0) > 0
ORDER BY COALESCE(grants_donations_au, 0) + COALESCE(grants_donations_intl, 0) DESC;

COMMENT ON TABLE acnc_ais IS 'Raw ACNC Annual Information Statement data from data.gov.au. One row per charity per reporting year. CC BY 4.0.';
