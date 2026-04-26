-- Set up pg_cron for nightly automatic MV refresh.
--
-- Supabase enables pg_cron + pg_net by default on most plans. The extension
-- runs scheduled jobs inside the database itself — no external runner needed.
--
-- This script:
--   1. Ensures the pg_cron extension is enabled
--   2. Creates a refresh_civicgraph_mvs() function that orchestrates the
--      refresh in dependency order with auto-fallback for the 2 MVs that
--      lack unique indexes (handled the same way refresh-views-v2.mjs does)
--   3. Schedules it nightly at 3am AEST (17:00 UTC the previous day)
--
-- Run via:
--   PGPASSWORD=$DATABASE_PASSWORD psql -h aws-0-ap-southeast-2.pooler... \
--     -f scripts/sql/setup-pg-cron-mv-refresh.sql

-- Enable the extension if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the orchestration function. Uses non-concurrent for known offenders
-- (matches refresh-views-v2.mjs behaviour). Logs to mv_refresh_log.
CREATE OR REPLACE FUNCTION refresh_civicgraph_mvs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_started TIMESTAMPTZ;
  v_finished TIMESTAMPTZ;
  v_error TEXT;
  v_mv TEXT;
  -- MVs that need non-concurrent refresh (no unique index OR surrogate key issue)
  needs_non_concurrent TEXT[] := ARRAY[
    'mv_foundation_grantees',
    'mv_donation_contract_timing'
  ];
  -- Refresh order — same as refresh-views-v2.mjs VIEW_LIST
  refresh_order TEXT[] := ARRAY[
    -- Tier 1
    'mv_acnc_latest',
    'mv_acnc_ais_yearly',
    'v_grant_stats',
    'v_grant_focus_areas',
    'v_grant_provider_summary',
    'mv_abr_name_lookup',
    -- Tier 2
    'mv_gs_entity_stats',
    'mv_gs_donor_contractors',
    'mv_donor_contract_crossref',
    'mv_org_justice_signals',
    'mv_funding_by_postcode',
    'mv_funding_by_lga',
    'mv_funding_by_disadvantage',
    'mv_indigenous_funding_by_disadvantage',
    -- Tier 3
    'mv_entity_power_index',
    'mv_funding_deserts',
    'mv_revolving_door',
    'mv_board_interlocks',
    'mv_foundation_grantees',
    'mv_donation_contract_timing',
    -- Compounds (built today)
    'mv_indigenous_procurement_score',
    'mv_grant_contract_overlap',
    'mv_lga_indigenous_proxy_score'
  ];
BEGIN
  -- Ensure log table exists (refresh-views-v2.mjs also creates it)
  CREATE TABLE IF NOT EXISTS mv_refresh_log (
    id BIGSERIAL PRIMARY KEY,
    mv_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    used_concurrent BOOLEAN,
    error_message TEXT,
    triggered_by TEXT DEFAULT 'pg_cron'
  );

  -- Refresh each MV in order
  FOREACH v_mv IN ARRAY refresh_order LOOP
    v_started := now();
    v_error := NULL;

    BEGIN
      IF v_mv = ANY(needs_non_concurrent) THEN
        -- Non-concurrent path
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', v_mv);
        v_finished := now();
        INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, triggered_by)
          VALUES (v_mv, v_started, v_finished,
                  EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000, 'success', false, 'pg_cron');
      ELSE
        -- CONCURRENTLY path — try first
        BEGIN
          EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_mv);
          v_finished := now();
          INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, triggered_by)
            VALUES (v_mv, v_started, v_finished,
                    EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000, 'success', true, 'pg_cron');
        EXCEPTION WHEN OTHERS THEN
          -- Fallback to non-concurrent if CONCURRENTLY fails (no unique index, etc.)
          v_started := now();  -- reset timer for non-concurrent attempt
          BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW %I', v_mv);
            v_finished := now();
            INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message, triggered_by)
              VALUES (v_mv, v_started, v_finished,
                      EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000, 'success-fallback', false,
                      'CONCURRENTLY failed, used non-concurrent', 'pg_cron');
          EXCEPTION WHEN OTHERS THEN
            v_finished := now();
            v_error := SQLERRM;
            INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message, triggered_by)
              VALUES (v_mv, v_started, v_finished,
                      EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000, 'failed', false, v_error, 'pg_cron');
          END;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_finished := now();
      v_error := SQLERRM;
      INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message, triggered_by)
        VALUES (v_mv, v_started, v_finished,
                EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000, 'failed', NULL, v_error, 'pg_cron');
    END;
  END LOOP;
END;
$$;

-- Schedule nightly at 17:00 UTC = 3am AEST (Sydney standard time, +10)
-- Note: AEDT (daylight saving) is +11 so this becomes 4am DST.
-- That's fine — overnight in either case.
-- Cron format: minute hour day month dow
SELECT cron.schedule(
  'refresh-civicgraph-mvs-nightly',
  '0 17 * * *',
  $$SELECT refresh_civicgraph_mvs()$$
);

-- Show scheduled jobs
SELECT jobname, schedule, command, active FROM cron.job
 WHERE jobname = 'refresh-civicgraph-mvs-nightly';
