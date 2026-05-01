-- Backfill youth_population (10–17) for QLD LGAs in lga_cross_system_stats
-- using ABS ERP-published QLD state-share (10.4%) as a per-LGA estimate.
--
-- Why this is not a guess:
--   ABS ERP June 2024 (cat. 3101.0) reports the QLD 10–17 cohort at 10.4%
--   of total resident population. Per-LGA cohort shares vary ±2–3pp
--   around the state mean, so this estimate is materially correct but
--   coarse — flagged in `sources` so it can be replaced with per-LGA
--   ABS data when ingested.
--
-- Only updates rows where youth_population IS NULL — never overwrites
-- a real per-LGA figure if one has already been ingested.

UPDATE public.lga_cross_system_stats
SET
  youth_population = GREATEST(ROUND(population * 0.104)::int, 0),
  sources = COALESCE(sources, '{}'::jsonb) || jsonb_build_object(
    'youth_population_method', 'qld_state_share_estimate_abs_erp_2024_jun',
    'youth_population_share', 0.104,
    'youth_population_caveat', 'estimated from QLD state 10-17 share; replace with per-LGA ABS ERP when ingested'
  )
WHERE state = 'QLD'
  AND population IS NOT NULL
  AND population > 0
  AND youth_population IS NULL;
