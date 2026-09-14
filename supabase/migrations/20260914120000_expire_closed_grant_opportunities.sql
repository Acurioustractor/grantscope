-- 20260914120000_expire_closed_grant_opportunities.sql
-- Grants whose close date has passed kept status 'open'/'unknown' forever: nothing ever flipped them. Measured
-- 2026-09-14: 266 rows (146 open_opportunity 'open', 66 government 'open', 47 'unknown', 3 others). With the
-- SmartyGrants source adding ~600 dated rounds, the open count would drift wrong again within weeks.
-- A daily pg_cron job closes them. Excluded: ghl_sync rows (our own CRM opportunities, status guarded by
-- trigger) and status 'ongoing' (rolling programs whose date is a funding-period end, not a close).
-- Each flip is stamped metadata.expired_at so it can be undone:
--   UPDATE grant_opportunities SET status = 'open', metadata = metadata - 'expired_at' WHERE metadata ? 'expired_at';
BEGIN;

CREATE OR REPLACE FUNCTION public.expire_closed_grant_opportunities()
RETURNS integer
LANGUAGE sql
SET search_path TO 'public', 'pg_catalog'
AS $$
  WITH expired AS (
    UPDATE public.grant_opportunities
    SET status = 'closed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('expired_at', now())
    WHERE coalesce(closes_at, deadline) < current_date
      AND coalesce(status, '') NOT IN ('closed', 'duplicate', 'ongoing')
      AND source IS DISTINCT FROM 'ghl_sync'
    RETURNING 1
  )
  SELECT count(*)::integer FROM expired;
$$;

REVOKE ALL ON FUNCTION public.expire_closed_grant_opportunities() FROM PUBLIC, anon, authenticated;

-- 16:30 UTC = 02:30 Brisbane, before the 17:00 UTC matview refresh reads the table.
SELECT cron.schedule('expire-closed-grant-opportunities', '30 16 * * *',
  'SELECT public.expire_closed_grant_opportunities()');

SELECT public.expire_closed_grant_opportunities();

COMMIT;
