-- OP7: register mv_triple_proof_suppliers in the nightly cron's refresh_order array.
-- Re-dumped via pg_get_functiondef with one array line inserted after mv_org_justice_signals.
-- The 2026-06-08 cron fix (SET statement_timeout='0', SET search_path) is preserved verbatim.

CREATE OR REPLACE FUNCTION public.refresh_civicgraph_mvs()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_catalog'
 SET statement_timeout TO '0'
AS $function$
DECLARE
  v_started TIMESTAMPTZ;
  v_finished TIMESTAMPTZ;
  v_error TEXT;
  v_mv TEXT;
  -- MVs that need non-concurrent refresh (no unique index OR surrogate key issue
  -- OR duplicate-key data quality issues in the MV definition).
  -- 2026-04-27: funding_by_lga and funding_deserts have duplicates that block
  -- a unique index until the underlying queries are deduped.
  needs_non_concurrent TEXT[] := ARRAY[
    'mv_funding_by_lga',
    'mv_funding_deserts',
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
    'mv_triple_proof_suppliers',
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
$function$

;
