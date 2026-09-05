-- Place the unplaced entities whose postcode now names exactly one council.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809070000_place_single_council_postcodes.sql
-- AFTERWARDS: mv_funding_deserts and friends go stale until the nightly
--   refresh (pg_cron 17:00 UTC); to see it on /atlas sooner:
--   node --env-file=.env scripts/refresh-views-v2.mjs
--
-- WHY. The 2026-08-08 resolve-or-null pass (20260808130000) nulled entities in
-- multi-council postcodes, and the same day's postcode_geo rebuild and geocode
-- backfill improved the geography underneath it. The verdicts went stale:
-- 98,660 entities now sit unplaced, and for 15,251 of them (dry-run,
-- 2026-08-09) today's ABS locality->LGA table names exactly one council for
-- their postcode and state. This pass places those and only those.
--
-- WHAT IT DELIBERATELY DOES NOT DO. The naive "postcode_geo says one council"
-- test matches ~41K entities, but most fail honesty checks: their state is
-- NULL or contradicts the postcode's, or the postcode only looks single-
-- council because its other localities are unmapped. Authority here is the
-- same chain the original pass used - abs_locality_lga joined through
-- postcode_geo - tightened with state qualification (the original matched
-- locality names across states; RICHMOND exists in three).
--
-- RUN SHAPE. Same as the proven 20260808130000: autocommit, UNLOGGED indexed
-- staging (inline joins plan as nested-loop-over-Materialize and never
-- finish), batched UPDATE committing every 5,000 rows so pooler locks stay
-- short. Idempotent and resumable: a placed row no longer matches
-- lga_name IS NULL. Reversible: prior values of every touched row are in
-- gs_entities_lga_backup_20260809.

SET statement_timeout = '15min';

-- Phase 0. Backup the rows this migration may touch, committed on its own.
CREATE TABLE IF NOT EXISTS gs_entities_lga_backup_20260809 AS
SELECT id, abn, postcode, state, lga_name, lga_code, lga_source
  FROM gs_entities
 WHERE lga_name IS NULL
   AND postcode IS NOT NULL;

-- Phase 1. Staging: postcodes whose localities map to exactly one council in
-- ABS ASGS, state-qualified end to end.
DROP TABLE IF EXISTS stg_pc_single;
CREATE UNLOGGED TABLE stg_pc_single AS
WITH state_codes(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
)
SELECT p.postcode,
       p.state,
       min(a.lga_name) AS lga_name,
       min(a.lga_code) AS lga_code
  FROM postcode_geo p
  JOIN state_codes s ON s.code = p.state
  JOIN abs_locality_lga a
    ON upper(a.locality) = upper(p.locality)
   AND a.state_name = s.state_name
 GROUP BY p.postcode, p.state
HAVING count(DISTINCT a.lga_name) = 1;
CREATE INDEX ON stg_pc_single (postcode, state);
ANALYZE stg_pc_single;

-- Phase 2. Place, in committed batches. Only rows that are unplaced today;
-- entities with no state or a state contradicting the postcode never match.
DO $$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    UPDATE gs_entities e
       SET lga_name = s.lga_name,
           lga_code = s.lga_code,
           lga_source = 'single_lga_postcode'
      FROM stg_pc_single s
     WHERE e.id IN (
       SELECT e2.id
         FROM gs_entities e2
         JOIN stg_pc_single s2 ON s2.postcode = e2.postcode AND s2.state = e2.state
        WHERE e2.lga_name IS NULL
          AND e2.postcode IS NOT NULL
        LIMIT 5000
     )
       AND s.postcode = e.postcode
       AND s.state = e.state;
    GET DIAGNOSTICS batch = ROW_COUNT;
    EXIT WHEN batch = 0;
    total := total + batch;
    COMMIT;
    RAISE NOTICE 'placed % this batch, % so far', batch, total;
  END LOOP;
  RAISE NOTICE 'placement complete: % rows', total;
END $$;

-- Phase 3. Refresh the open gap ledger. Postcodes that still hold unplaced
-- multi-council entities get fresh counts; postcodes this pass emptied are
-- closed rather than deleted, so the history of the gap survives.
UPDATE geo_resolution_gaps g
   SET affected_entities = c.n,
       affected_community_controlled = c.cc,
       detected_at = now()
  FROM (
    SELECT postcode,
           count(*) AS n,
           count(*) FILTER (WHERE is_community_controlled) AS cc
      FROM gs_entities
     WHERE lga_name IS NULL
       AND lga_source = 'unresolved_multi_lga_postcode'
     GROUP BY postcode
  ) c
 WHERE c.postcode = g.postcode
   AND g.issue = 'Postcode spans multiple council areas and the entity record carries no locality'
   AND g.resolved_at IS NULL;

UPDATE geo_resolution_gaps g
   SET resolved_at = now()
 WHERE g.issue = 'Postcode spans multiple council areas and the entity record carries no locality'
   AND g.resolved_at IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM gs_entities e
      WHERE e.postcode = g.postcode
        AND e.lga_name IS NULL
        AND e.lga_source = 'unresolved_multi_lga_postcode'
   );

-- Phase 4. Say what happened.
DO $$
DECLARE placed_n int; still_null int; gaps_open int; gaps_closed int;
BEGIN
  SELECT count(*) INTO placed_n   FROM gs_entities WHERE lga_source = 'single_lga_postcode';
  SELECT count(*) INTO still_null FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL;
  SELECT count(*) INTO gaps_open   FROM geo_resolution_gaps WHERE resolved_at IS NULL;
  SELECT count(*) INTO gaps_closed FROM geo_resolution_gaps WHERE resolved_at IS NOT NULL;
  RAISE NOTICE 'placed via single-council postcode: % (dry-run predicted 15,251)', placed_n;
  RAISE NOTICE 'still unplaced with a postcode:     %', still_null;
  RAISE NOTICE 'geo_resolution_gaps open: %, closed: %', gaps_open, gaps_closed;
END $$;

DROP TABLE IF EXISTS stg_pc_single;
