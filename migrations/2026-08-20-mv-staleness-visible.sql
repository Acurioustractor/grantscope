-- Make matview staleness visible rather than inferable. #314 steps 3 and 4.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-20-mv-staleness-visible.sql
--
-- WHAT #314 ASSUMED, AND WHAT IS ACTUALLY TRUE (measured 2026-08-20):
--
--   The ticket reported that "nothing ran on the night of 18->19 August". It ran.
--   cron.job_run_details for the nightly job (jobid 4) shows succeeded on 16, 17, 18, 19 and 20
--   August, 11-13 minutes each. The only failure in the window is 2026-08-11, 'server restarted'.
--
--   The "15-16 August" cluster the ticket read as staleness is TIER BEHAVIOUR. Four of its five
--   matviews are tier 'weekly' (cron '0 15 * * 0' -- last Sunday was the 16th) and the fifth,
--   mv_foundation_landscape_top_foundations, is tier 'retire'. They were exactly as fresh as
--   configured. Nothing was wrong with them.
--
--   Of the 23 never-logged entries, 19 are tier 'on_demand' and 16 have no success row. Every one
--   of those 16 carries a `notes` value naming its owner -- refresh_alma_dashboards(),
--   refresh_sentiment_analytics(), scripts/refresh-youth-justice-report-*. They are
--   REFRESHED-BUT-UNLOGGED, which is the second of the ticket's "two very different problems".
--
-- THE DEFECT THAT SURVIVES, and what this migration fixes:
--
--   1. The log could not express any of the above. A reader could not tell "fresh for its tier"
--      from "overdue", or "refreshed by another path" from "never refreshed at all". Both
--      distinctions were reconstructible only by knowing the cron schedules by heart, which is
--      how a weekly matview got mistaken for a four-day-stale one.
--
--   2. v_mv_refresh_drift computed last_refresh_at from the LAST LOG ROW OF ANY STATUS. A failed
--      refresh therefore read as a refresh, and staleness reset itself on failure. It is now
--      computed from successful rows only, with the last attempt reported separately so a
--      failing matview is visible as failing rather than as fresh.

ALTER TABLE mv_refresh_registry ADD COLUMN IF NOT EXISTS max_age_hours integer;

COMMENT ON COLUMN mv_refresh_registry.max_age_hours IS
  'Hours after which this matview is overdue. NULL means no schedule owns it, so it cannot be '
  'overdue -- only unknown. Set from the tier''s cron cadence plus slack, not from taste.';

-- Cadence plus slack, so a normal late run is not an alert:
--   nightly  cron '0 17 * * *'  -> 24h + 12h
--   weekly   cron '0 15 * * 0'  -> 168h + 24h
--   on_demand / retire          -> NULL, nothing schedules them
UPDATE mv_refresh_registry SET max_age_hours = 36  WHERE tier = 'nightly'   AND max_age_hours IS NULL;
UPDATE mv_refresh_registry SET max_age_hours = 192 WHERE tier = 'weekly'    AND max_age_hours IS NULL;
UPDATE mv_refresh_registry SET max_age_hours = NULL WHERE tier IN ('on_demand','retire');

-- DROP, not CREATE OR REPLACE: replace cannot insert columns into the middle of the column list
-- ("cannot change name of view column bytes to max_age_hours"). Nothing in the application reads
-- this view -- checked 2026-08-20, zero references under apps/web/src -- so dropping it is safe.
DROP VIEW IF EXISTS v_mv_refresh_drift;

CREATE VIEW v_mv_refresh_drift AS
WITH cat AS (
  SELECT c.relname AS mv_name,
         pg_total_relation_size(c.oid::regclass) AS bytes,
         EXISTS (SELECT 1 FROM pg_index i
                  WHERE i.indrelid = c.oid AND i.indisunique
                    AND i.indpred IS NULL AND i.indexprs IS NULL) AS has_unique_idx
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'm'
),
-- SUCCESS ONLY. The previous definition took the last row of any status, so a failed refresh
-- reset the clock and a matview that had been failing for a week read as fresh.
last_success AS (
  SELECT DISTINCT ON (mv_name) mv_name, finished_at, started_at
    FROM mv_refresh_log
   WHERE status IN ('success','success-fallback')
   ORDER BY mv_name, finished_at DESC
),
-- The last attempt regardless of outcome, so failure is visible AS failure.
last_attempt AS (
  SELECT DISTINCT ON (mv_name) mv_name, started_at, status
    FROM mv_refresh_log ORDER BY mv_name, started_at DESC
)
SELECT COALESCE(cat.mv_name, r.mv_name::name) AS mv_name,
       CASE
         WHEN r.mv_name IS NULL   THEN 'UNREGISTERED'
         WHEN cat.mv_name IS NULL THEN 'ORPHAN_ROW'
         ELSE 'ok'
       END AS drift,
       r.tier, r.enabled, r.health, r.max_age_hours, r.notes,
       cat.bytes, cat.has_unique_idx,
       ls.finished_at AS last_success_at,
       la.started_at  AS last_attempt_at,
       la.status      AS last_attempt_status,
       now() - ls.finished_at AS staleness,
       ROUND(EXTRACT(epoch FROM now() - ls.finished_at) / 3600.0, 1) AS age_hours,
       -- One word a human or a surface can act on. Ordered so the structural problems win.
       CASE
         WHEN r.mv_name IS NULL   THEN 'unregistered'   -- exists in the DB, nothing owns it
         WHEN cat.mv_name IS NULL THEN 'orphan'         -- registry row for a matview that is gone
         WHEN r.tier = 'retire'   THEN 'retired'        -- deliberately not refreshed
         WHEN r.enabled IS NOT TRUE THEN 'disabled'
         WHEN ls.finished_at IS NULL AND r.max_age_hours IS NULL THEN 'unlogged'
             -- owned by a path that does not write to mv_refresh_log; see notes. NOT "never
             -- refreshed" -- the log simply cannot tell you, and saying so is the honest answer.
         WHEN ls.finished_at IS NULL THEN 'never'       -- scheduled, and has never succeeded
         WHEN r.max_age_hours IS NULL THEN 'unmanaged'  -- has run, but nothing schedules it
         WHEN now() - ls.finished_at > make_interval(hours => r.max_age_hours) THEN 'stale'
         ELSE 'fresh'
       END AS freshness
  FROM cat
  FULL JOIN mv_refresh_registry r ON r.mv_name = cat.mv_name
  LEFT JOIN last_success ls ON ls.mv_name = COALESCE(cat.mv_name, r.mv_name::name)
  LEFT JOIN last_attempt la ON la.mv_name = COALESCE(cat.mv_name, r.mv_name::name);

COMMENT ON VIEW v_mv_refresh_drift IS
  'Every matview with the freshness verdict a surface should disclose. last_success_at counts '
  'SUCCESSFUL refreshes only -- the earlier definition used the last row of any status, so a '
  'failed refresh read as a refresh. freshness ''unlogged'' means an on_demand matview owned by a '
  'path that does not write to mv_refresh_log (see notes); it is an honest unknown, not a zero. '
  'See migrations/2026-08-20-mv-staleness-visible.sql and #314.';

GRANT SELECT ON v_mv_refresh_drift TO anon, authenticated, service_role;
