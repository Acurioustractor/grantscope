-- =============================================================================
-- 2026-08-14-mv-refresh-cron.sql
--
-- Rewrites refresh_civicgraph_mvs() to read mv_refresh_plan() instead of a
-- hardcoded array, fixes duration logging, and makes a mid-run failure survivable.
--
-- REQUIRES migrations/2026-08-14-mv-refresh-registry.sql to be applied first.
--
-- APPLY WITH (NOT APPLIED — this file is a deliverable):
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-14-mv-refresh-cron.sql
--
-- The cron.schedule() calls at the bottom are TIER 3 (they change a live
-- scheduled job). They are commented out. Ben applies them deliberately.
--
-- -----------------------------------------------------------------------------
-- WHAT WAS WRONG WITH THE OLD FUNCTION
--
-- 1. HARDCODED LIST. 27 names in a refresh_order array, a second copy of the 43
--    in scripts/refresh-views-v2.mjs. The cron list was a strict subset: 16
--    matviews the script refreshed never ran on the schedule at all.
--
-- 2. DURATIONS WERE ALL ZERO. It used now(), which in PL/pgSQL is
--    transaction_timestamp() — constant for the entire function. Verified on the
--    2026-08-13 17:00 run: all 27 rows stamped 17:00:00.10131+00, every
--    duration_ms = 0. The nightly job produced no usable cost data at all; every
--    real duration in mv_refresh_log came from the Node script.
--    Fixed here with clock_timestamp().
--
-- 3. ONE TRANSACTION FOR THE WHOLE RUN. Log rows only became visible when the
--    entire ~18-minute run committed, and a mid-run crash discarded every log row
--    including the failure that caused it. Fixed here by moving the loop into a
--    PROCEDURE that COMMITs after each matview.
--
-- 4. WASTED WORK ON 4 MATVIEWS. mv_abr_name_lookup, mv_grant_contract_overlap,
--    mv_indigenous_procurement_score and mv_lga_indigenous_proxy_score have no
--    unique index, so every night they attempted CONCURRENTLY, failed, and then
--    refreshed again non-concurrently — logged as 'success-fallback'. The plan now
--    derives CONCURRENTLY from pg_index, so they go straight to the right path.
--    (mv_abr_name_lookup alone was ~124s of that, twice.)
--
-- WHAT WAS ALREADY RIGHT: per-matview exception handling. One failure did not
-- stop the rest, and the failure was recorded. That behaviour is preserved.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Resilient refresh. PROCEDURE, not FUNCTION, so it can COMMIT between matviews.
--
-- Structure note: the COMMIT sits in the loop body OUTSIDE the BEGIN..EXCEPTION
-- block. PL/pgSQL forbids transaction control *inside* a block that has an
-- exception handler, but permits it in the enclosing body. Each matview
-- therefore gets its own subtransaction for error trapping and its own commit
-- for durability.
-- -----------------------------------------------------------------------------
-- CORRECTED 2026-08-14 (adversarial review, blocker B1). The SET clauses were
-- ATTACHED to the procedure. PostgreSQL 17: "If a SET clause is attached to a
-- procedure, then that procedure cannot execute transaction control statements
-- (for example, COMMIT and ROLLBACK...)". plpgsql does not validate that at
-- definition time, so the procedure CREATEd cleanly and would have raised on the
-- first COMMIT — aborting the transaction, discarding the mv_refresh_log insert,
-- and refreshing ZERO matviews every night, visible only in the pg_cron log.
-- The same two settings are issued as body statements below: a plain SET inside
-- plpgsql is session-scoped and survives COMMIT (SET LOCAL would not).
CREATE OR REPLACE PROCEDURE refresh_civicgraph_mvs_run(p_tier text DEFAULT 'nightly')
LANGUAGE plpgsql
AS $procedure$
DECLARE
  r          record;
  v_started  timestamptz;
  v_finished timestamptz;
  v_status   text;
  v_conc     boolean;
  v_error    text;
BEGIN
  SET search_path TO 'public', 'extensions', 'pg_catalog';
  SET statement_timeout TO '0';

  FOR r IN SELECT * FROM mv_refresh_plan(p_tier) ORDER BY seq LOOP
    v_started := clock_timestamp();   -- NOT now(): now() is frozen per transaction
    v_error   := NULL;
    v_status  := 'success';
    v_conc    := r.use_concurrent;

    BEGIN
      IF r.use_concurrent THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', r.mv_name);
      ELSE
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', r.mv_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error  := SQLERRM;
      v_status := 'failed';
    END;

    -- A CONCURRENTLY attempt can still fail on a matview whose unique index
    -- exists but is not usable (e.g. duplicate rows appeared). Retry once,
    -- non-concurrently, rather than losing the night's data for that object.
    IF v_status = 'failed' AND v_conc THEN
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', r.mv_name);
        v_status := 'success-fallback';
        v_conc   := false;
      EXCEPTION WHEN OTHERS THEN
        v_error := COALESCE(v_error, '') || ' | non-concurrent retry: ' || SQLERRM;
      END;
    END IF;

    v_finished := clock_timestamp();

    INSERT INTO mv_refresh_log
      (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message, triggered_by)
    VALUES
      (r.mv_name, v_started, v_finished,
       (EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000)::int,
       v_status, v_conc, left(v_error, 1000), 'pg_cron:' || p_tier);

    COMMIT;   -- durable per matview: a later crash cannot erase this row
  END LOOP;
END;
$procedure$;

COMMENT ON PROCEDURE refresh_civicgraph_mvs_run(text) IS
  'Refreshes every enabled matview in one tier, in dependency order from mv_refresh_plan(). '
  'One subtransaction per matview so a single failure does not stop the run, and one COMMIT '
  'per matview so the log survives a mid-run crash. Uses clock_timestamp() for real durations.';

-- -----------------------------------------------------------------------------
-- Backward-compatible wrapper. Anything still calling SELECT refresh_civicgraph_mvs()
-- keeps working; it just does the nightly tier from the registry now.
--
-- A FUNCTION cannot COMMIT, so this path keeps the old single-transaction
-- behaviour. Prefer CALL refresh_civicgraph_mvs_run('nightly').
--
-- MUST DROP FIRST. The existing function has signature refresh_civicgraph_mvs()
-- with zero arguments; the new one takes p_tier with a default. CREATE OR REPLACE
-- cannot change a signature — it would create a second, OVERLOADED function and
-- leave the old hardcoded 27-name body in place. Postgres resolves a zero-argument
-- call to the exact-arity match, so pg_cron's `SELECT refresh_civicgraph_mvs()`
-- would keep running the OLD body and this whole migration would silently do
-- nothing. Drop the old signature explicitly.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS refresh_civicgraph_mvs();

CREATE OR REPLACE FUNCTION refresh_civicgraph_mvs(p_tier text DEFAULT 'nightly')
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
SET statement_timeout TO '0'
AS $function$
DECLARE
  r          record;
  v_started  timestamptz;
  v_finished timestamptz;
  v_status   text;
  v_conc     boolean;
  v_error    text;
BEGIN
  FOR r IN SELECT * FROM mv_refresh_plan(p_tier) ORDER BY seq LOOP
    v_started := clock_timestamp();
    v_error   := NULL;
    v_status  := 'success';
    v_conc    := r.use_concurrent;

    BEGIN
      IF r.use_concurrent THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', r.mv_name);
      ELSE
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', r.mv_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error  := SQLERRM;
      v_status := 'failed';
    END;

    IF v_status = 'failed' AND v_conc THEN
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', r.mv_name);
        v_status := 'success-fallback';
        v_conc   := false;
      EXCEPTION WHEN OTHERS THEN
        v_error := COALESCE(v_error, '') || ' | non-concurrent retry: ' || SQLERRM;
      END;
    END IF;

    v_finished := clock_timestamp();

    INSERT INTO mv_refresh_log
      (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message, triggered_by)
    VALUES
      (r.mv_name, v_started, v_finished,
       (EXTRACT(EPOCH FROM (v_finished - v_started)) * 1000)::int,
       v_status, v_conc, left(v_error, 1000), 'pg_cron:' || p_tier);
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION refresh_civicgraph_mvs(text) IS
  'Backward-compatible wrapper. Reads mv_refresh_plan() — no hardcoded list. '
  'Cannot COMMIT per matview (functions cannot); prefer CALL refresh_civicgraph_mvs_run(tier).';

COMMIT;

-- =============================================================================
-- TIER 3 — schedule changes. Review, then run deliberately. NOT part of the
-- transaction above.
--
-- Job 4 currently runs `SELECT refresh_civicgraph_mvs()` at 0 17 * * *.
-- After the rewrite that call still works (it now reads the registry), so
-- rescheduling is optional. Switching to CALL buys the per-matview COMMIT.
--
--   SELECT cron.schedule('refresh-civicgraph-mvs-nightly', '0 17 * * *',
--                        $$CALL refresh_civicgraph_mvs_run('nightly')$$);
--
-- New weekly tier — Sunday, well clear of the nightly window:
--
--   SELECT cron.schedule('refresh-civicgraph-mvs-weekly', '0 15 * * 0',
--                        $$CALL refresh_civicgraph_mvs_run('weekly')$$);
--
-- Verify afterwards:
--   SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobid;
--   SELECT mv_name, started_at, duration_ms, status, triggered_by
--     FROM mv_refresh_log WHERE triggered_by LIKE 'pg_cron:%'
--     ORDER BY started_at DESC LIMIT 60;
--     -- durations must now be non-zero and started_at must differ per row.
-- =============================================================================
