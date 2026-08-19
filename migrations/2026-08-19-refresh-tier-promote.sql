-- Issue #314 — promote the five on_demand matviews that live app code actually reads
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-19-refresh-tier-promote.sql
--
-- Context, and a correction. #314 was opened claiming the nightly refresh had stopped running.
-- It has not. Measured 2026-08-19 against cron.job_run_details: job 4
-- (refresh-civicgraph-mvs-nightly, 0 17 * * *) succeeded on 18 Aug in 11m48s, and every one of
-- the 56 nightly-tier matviews carries a success timestamp from that run. The weekly job (13,
-- Sundays 15:00 UTC) last ran 16 Aug, on cadence. There is no cron fault.
--
-- Two measurement errors produced the false alarm, both worth remembering:
--   1. The eight matviews that "went up" after a manual refresh were weekly- and retire-tier.
--      They were exactly as fresh as their tier says they should be.
--   2. The first staleness query filtered status='success' and missed 264 'success-fallback'
--      rows -- the non-concurrent retry path inside refresh_civicgraph_mvs_run(). Filtering for
--      literal 'success' understates freshness across the whole registry.
--
-- What IS real: refresh_civicgraph_mvs_run() drives off mv_refresh_plan(p_tier), so tier decides
-- whether a matview is ever refreshed by anything. 23 of the 24 on_demand matviews have never
-- logged a refresh at all. Five of them are read by live application code:
--
--   act_grant_recommendations        13 files
--   mv_yj_report_acco_gap             2 files
--   mv_yj_report_unfunded_programs    2 files
--   mv_yj_report_alma_type_counts     1 file
--   mv_yj_report_state_top_orgs       1 file
--
-- A matview that nothing refreshes, read by a live surface, serves a number with no as-of date.
-- That is not a confident zero -- it is a confident stale non-zero, which is harder to notice.
-- The youth-justice report ones are public.
--
-- Tier choice: nightly rather than weekly. These sit behind report surfaces where a week of drift
-- is a week of wrong, and the nightly window has headroom -- 56 matviews finish in under 12
-- minutes, so five more is minutes, not hours. Measured before promoting, all five refresh
-- cleanly: act_grant_recommendations 20.3s, the four mv_yj_report_* under 1s each -- ~22s total
-- added to a 12-minute window.
--
-- Deliberately NOT in this migration: the 9 retire-tier matviews. They are read by zero
-- application code and should be dropped, but dropping is destructive and gets its own ticket.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM mv_refresh_registry
  WHERE mv_name IN ('act_grant_recommendations','mv_yj_report_acco_gap',
                    'mv_yj_report_alma_type_counts','mv_yj_report_state_top_orgs',
                    'mv_yj_report_unfunded_programs')
    AND tier = 'on_demand';
  IF n <> 5 THEN
    RAISE EXCEPTION 'expected 5 on_demand rows to promote, found %', n;
  END IF;
END $$;

UPDATE mv_refresh_registry
SET tier = 'nightly',
    notes = concat_ws(' | ', nullif(notes,''),
            'promoted from on_demand 2026-08-19 (#314): read by live app code, never refreshed'),
    updated_at = now()
WHERE mv_name IN ('act_grant_recommendations','mv_yj_report_acco_gap',
                  'mv_yj_report_alma_type_counts','mv_yj_report_state_top_orgs',
                  'mv_yj_report_unfunded_programs');

COMMIT;
