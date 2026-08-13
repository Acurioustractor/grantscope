-- Refresh the Closing the Gap dashboard snapshot after the established nightly
-- civic-data materialized-view job. Logging feeds the shared operations health
-- checks used across GrantScope, GivingScope/Place and JusticeHub.
CREATE OR REPLACE FUNCTION public.refresh_closing_the_gap_state_summary()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_catalog'
SET statement_timeout TO '0'
AS $function$
DECLARE
  v_started timestamptz := now();
  v_finished timestamptz;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_closing_the_gap_state_summary;
  v_finished := now();

  INSERT INTO public.mv_refresh_log (
    mv_name, started_at, finished_at, duration_ms, status, used_concurrent, triggered_by
  ) VALUES (
    'mv_closing_the_gap_state_summary', v_started, v_finished,
    extract(epoch FROM (v_finished - v_started)) * 1000, 'success', true, 'pg_cron'
  );
EXCEPTION WHEN OTHERS THEN
  v_finished := now();

  INSERT INTO public.mv_refresh_log (
    mv_name, started_at, finished_at, duration_ms, status, used_concurrent,
    error_message, triggered_by
  ) VALUES (
    'mv_closing_the_gap_state_summary', v_started, v_finished,
    extract(epoch FROM (v_finished - v_started)) * 1000, 'failed', true, SQLERRM, 'pg_cron'
  );

  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_closing_the_gap_state_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_closing_the_gap_state_summary() TO service_role;

SELECT cron.schedule(
  'refresh-closing-the-gap-state-summary',
  '30 17 * * *',
  'SELECT public.refresh_closing_the_gap_state_summary()'
);
