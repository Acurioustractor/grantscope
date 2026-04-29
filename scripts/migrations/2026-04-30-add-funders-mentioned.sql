-- Add top_funders_mentioned column to charity_impact_reports
-- Captures funders/agencies referenced in the annual report (e.g. DSS, NIAA)

ALTER TABLE public.charity_impact_reports
  ADD COLUMN IF NOT EXISTS top_funders_mentioned text[];

COMMENT ON COLUMN public.charity_impact_reports.top_funders_mentioned IS
  'Government agencies, departments or major funders mentioned in the annual report (LLM-extracted).';
