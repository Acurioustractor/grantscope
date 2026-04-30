-- Add financial-extraction columns to charity_impact_reports.
-- The ACNC Dynamics API only returns revenue; full P&L lives in the audited
-- financial statements inside each charity's annual report PDF. The LLM
-- enricher (scripts/enrich-annual-reports-llm.mjs) reads the cached markdown
-- and now extracts these directly.

ALTER TABLE public.charity_impact_reports
  ADD COLUMN IF NOT EXISTS total_revenue numeric,
  ADD COLUMN IF NOT EXISTS revenue_from_government numeric,
  ADD COLUMN IF NOT EXISTS donations_and_bequests numeric,
  ADD COLUMN IF NOT EXISTS revenue_from_goods_services numeric,
  ADD COLUMN IF NOT EXISTS revenue_from_investments numeric,
  ADD COLUMN IF NOT EXISTS total_expenses numeric,
  ADD COLUMN IF NOT EXISTS employee_expenses numeric,
  ADD COLUMN IF NOT EXISTS grants_donations_paid numeric,
  ADD COLUMN IF NOT EXISTS net_surplus_deficit numeric,
  ADD COLUMN IF NOT EXISTS staff_full_time integer,
  ADD COLUMN IF NOT EXISTS staff_part_time integer,
  ADD COLUMN IF NOT EXISTS staff_casual integer,
  ADD COLUMN IF NOT EXISTS staff_fte numeric,
  ADD COLUMN IF NOT EXISTS staff_volunteers integer,
  ADD COLUMN IF NOT EXISTS num_kmp integer,
  ADD COLUMN IF NOT EXISTS total_paid_kmp numeric;

COMMENT ON COLUMN public.charity_impact_reports.total_revenue IS
  'Total revenue (AUD) from audited financial statements in the annual report. LLM-extracted.';
COMMENT ON COLUMN public.charity_impact_reports.revenue_from_government IS
  'Government grant + program revenue (AUD).';
COMMENT ON COLUMN public.charity_impact_reports.employee_expenses IS
  'Total employee/wages expense (AUD). For peak/policy bodies this is typically 65-85% of total_expenses.';
COMMENT ON COLUMN public.charity_impact_reports.total_paid_kmp IS
  'Aggregate compensation to Key Management Personnel (AUD).';
