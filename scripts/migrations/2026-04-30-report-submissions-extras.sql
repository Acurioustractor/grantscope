-- Richer report-generation context fields on /get-a-report submissions.
-- The original 2026-04-30-report-submissions.sql had the basics. These extras
-- capture what the analyst actually needs to scope and produce a report:
-- ABNs (so we can pre-load entities), geography, timeframe, sources the user
-- already has on their radar, the data layers they care most about, and prior
-- knowledge that saves us repeating work.

ALTER TABLE public.report_submissions
  ADD COLUMN IF NOT EXISTS target_abn text,
  ADD COLUMN IF NOT EXISTS target_geography text,
  ADD COLUMN IF NOT EXISTS target_timeframe text,
  ADD COLUMN IF NOT EXISTS target_topic text,
  ADD COLUMN IF NOT EXISTS target_sources text,
  ADD COLUMN IF NOT EXISTS data_priorities text[],
  ADD COLUMN IF NOT EXISTS prior_work text;

COMMENT ON COLUMN public.report_submissions.target_abn IS 'Comma-separated ABNs of orgs to focus on. Used to pre-link entities.';
COMMENT ON COLUMN public.report_submissions.data_priorities IS 'Which CivicGraph data layers matter most for this report (tick-box multi-select).';
