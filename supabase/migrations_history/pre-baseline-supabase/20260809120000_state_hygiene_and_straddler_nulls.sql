-- State hygiene + straddler nulls: the mop-up the reason-code pass exposed.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809120000_state_hygiene_and_straddler_nulls.sql
-- AFTERWARDS: node --env-file=.env scripts/refresh-views-v2.mjs if placements land.
--
-- WHY. Sampling the state_conflict bucket after 20260809110000 exposed three
-- things (all quantified live 2026-08-09):
--   1. gs_entities.state has 264 case/junk variants ('Qld' 154, 'Vic' 64,
--      '' 27, 'nsw', 'Victoria', 'National', a literal postcode). Equality
--      joins are case-sensitive, so these entities silently failed EVERY
--      state-qualified pass - ~91 of them are unplaced and some are placeable
--      the moment their state reads 'QLD' instead of 'Qld'.
--   2. postcode_geo has 131 NULL-state rows across 32 postcodes (4007, 4655,
--      4670...). Nothing can ever state-match them.
--   3. 727 postcode_geo rows are ABS-straddlers (locality genuinely spans
--      two+ councils) still carrying the legacy first-seen council - a coin
--      flip from the original ingest, never chosen. BEN'S VERDICT 2026-08-09:
--      null them. Matches the entity precedent (null unplaceable rather than
--      keep a wrong value); the display layer already withholds ambiguous
--      attributions; the principled refill is an ABS correspondence-ratio
--      import that resolves each to its dominant council deliberately.
--      Namesake rows resolved by the own-name repair are excluded from the
--      null. The plausible-vs-provably-wrong split prints before the null.
--
-- Then the mislabeled reason stamps (state_conflict / postcode_unmapped_in_abs)
-- are reset and re-derived against the repaired ground, and the placement
-- passes re-run for whatever the normalization freed.
--
-- Run shape: autocommit, small statements, staging tables, idempotent
-- (guards on every UPDATE). Reversible: postcode_geo_lga_backup_20260809d,
-- gs_entities_state_backup_20260809, plus lga_source re-derivation is pure.

SET statement_timeout = '15min';

-- Phase 0. Backups.
CREATE TABLE IF NOT EXISTS postcode_geo_lga_backup_20260809d AS
SELECT postcode, locality, state, lga_name, lga_code
FROM postcode_geo;

CREATE TABLE IF NOT EXISTS gs_entities_state_backup_20260809 AS
SELECT id, abn, state, lga_source
FROM gs_entities
WHERE state IS NOT NULL
  AND state NOT IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA');

-- Phase 1. Normalize entity states. 264 rows measured.
UPDATE gs_entities
   SET state = CASE
     WHEN upper(btrim(state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
       THEN upper(btrim(state))
     WHEN upper(btrim(state)) = 'VICTORIA'                     THEN 'VIC'
     WHEN upper(btrim(state)) = 'NEW SOUTH WALES'              THEN 'NSW'
     WHEN upper(btrim(state)) = 'QUEENSLAND'                   THEN 'QLD'
     WHEN upper(btrim(state)) = 'SOUTH AUSTRALIA'              THEN 'SA'
     WHEN upper(btrim(state)) = 'WESTERN AUSTRALIA'            THEN 'WA'
     WHEN upper(btrim(state)) = 'TASMANIA'                     THEN 'TAS'
     WHEN upper(btrim(state)) = 'NORTHERN TERRITORY'           THEN 'NT'
     WHEN upper(btrim(state)) = 'AUSTRALIAN CAPITAL TERRITORY' THEN 'ACT'
     ELSE NULL  -- junk: '', 'National', 'VICTORIA & NSW', literal postcodes
   END
 WHERE state IS NOT NULL
   AND state NOT IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA');

-- Phase 2. Backfill postcode_geo NULL states. 131 rows / 32 postcodes measured.
-- 2a. From sibling rows of the same postcode where exactly one state exists.
UPDATE postcode_geo p
   SET state = s.state
  FROM (SELECT postcode, min(state) AS state
          FROM postcode_geo
         WHERE state IS NOT NULL
         GROUP BY postcode
        HAVING count(DISTINCT state) = 1) s
 WHERE p.state IS NULL
   AND s.postcode = p.postcode;

-- 2b. From the unambiguous first digit for whatever has no sibling.
--     3/8=VIC, 4/9=QLD, 5=SA, 6=WA, 7=TAS. 0 (NT/multi) and 1/2 (NSW/ACT
--     interleave) stay NULL - honest, and they no longer mislabel entities
--     because the reason re-derivation below treats NULL-state geography as
--     unmatchable-for-state rather than a conflict.
UPDATE postcode_geo
   SET state = CASE left(postcode, 1)
                 WHEN '3' THEN 'VIC' WHEN '8' THEN 'VIC'
                 WHEN '4' THEN 'QLD' WHEN '9' THEN 'QLD'
                 WHEN '5' THEN 'SA'  WHEN '6' THEN 'WA'
                 WHEN '7' THEN 'TAS'
               END
 WHERE state IS NULL
   AND left(postcode, 1) IN ('3','4','5','6','7','8','9');

-- Phase 3. Null the straddlers (Ben's verdict), keeping namesake resolutions.
DROP TABLE IF EXISTS stg_abs_locs;
CREATE UNLOGGED TABLE stg_abs_locs AS
WITH sc(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
)
SELECT a.locality, s.code AS state, a.lga_name, a.lga_code, a.lga_count
  FROM abs_locality_lga a
  JOIN sc s ON s.state_name = a.state_name;
CREATE INDEX ON stg_abs_locs (locality, state);
ANALYZE stg_abs_locs;

DROP TABLE IF EXISTS stg_straddler_rows;
CREATE UNLOGGED TABLE stg_straddler_rows AS
SELECT p.postcode, p.locality, p.state, p.lga_name, p.lga_code,
       EXISTS (SELECT 1 FROM stg_abs_locs a2
                WHERE a2.locality = upper(p.locality) AND a2.state = p.state
                  AND a2.lga_code = p.lga_code) AS value_is_a_candidate
  FROM postcode_geo p
 WHERE p.lga_name IS NOT NULL
   AND upper(p.locality) IS DISTINCT FROM upper(p.lga_name)  -- keep namesakes
   AND EXISTS (SELECT 1 FROM stg_abs_locs a
                WHERE a.locality = upper(p.locality) AND a.state = p.state
                  AND a.lga_count >= 2);
ANALYZE stg_straddler_rows;

-- The split, on the record before anything is nulled.
SELECT 'straddler rows to null' AS check,
       count(*) AS total,
       count(*) FILTER (WHERE value_is_a_candidate)     AS plausible_candidate,
       count(*) FILTER (WHERE NOT value_is_a_candidate) AS provably_wrong
  FROM stg_straddler_rows;

UPDATE postcode_geo p
   SET lga_name = NULL,
       lga_code = NULL
  FROM stg_straddler_rows s
 WHERE s.postcode = p.postcode
   AND s.locality = p.locality
   AND s.state IS NOT DISTINCT FROM p.state
   AND p.lga_name IS NOT NULL;

-- Phase 4. Re-derive the two reason stamps the defects corrupted.
UPDATE gs_entities
   SET lga_source = NULL
 WHERE lga_name IS NULL
   AND lga_source IN ('state_conflict','postcode_unmapped_in_abs');

-- 4c'. No state (junk normalization may have added a few).
UPDATE gs_entities e SET lga_source = 'no_state'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND e.state IS NULL;

-- 4d'. State conflict - only a REAL conflict counts now: the postcode has
--      at least one stated-state row and none of them match the entity.
UPDATE gs_entities e SET lga_source = 'state_conflict'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND EXISTS (SELECT 1 FROM postcode_geo pg
                WHERE pg.postcode = e.postcode AND pg.state IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                    WHERE pg.postcode = e.postcode AND pg.state = e.state);

-- 4e'. Postcode whose localities cannot be mapped: nothing ABS-mappable and
--      nothing the suffix repair resolved (same formulation as 20260809110000;
--      stg_suffix_fix is recomputed deterministically because legacy garbage
--      and suffix repairs are indistinguishable from stored values alone).
DROP TABLE IF EXISTS stg_suffix_fix;
CREATE UNLOGGED TABLE stg_suffix_fix AS
SELECT sf.loc, sf.state
  FROM (SELECT DISTINCT upper(p.locality) AS loc, p.state,
               regexp_replace(upper(p.locality),
                 ' (EAST|WEST|NORTH|SOUTH|CENTRAL|UPPER|LOWER|HEIGHTS|DC|BC|MC)$','') AS base
          FROM postcode_geo p
         WHERE upper(p.locality) ~ ' (EAST|WEST|NORTH|SOUTH|CENTRAL|UPPER|LOWER|HEIGHTS|DC|BC|MC)$'
           AND NOT EXISTS (SELECT 1 FROM stg_abs_locs al0
                            WHERE al0.locality = upper(p.locality) AND al0.state = p.state)) sf
  JOIN stg_abs_locs al ON al.locality = sf.base AND al.state = sf.state
 GROUP BY 1, 2
HAVING count(DISTINCT al.lga_code) = 1;
CREATE INDEX ON stg_suffix_fix (loc, state);
ANALYZE stg_suffix_fix;

UPDATE gs_entities e SET lga_source = 'postcode_unmapped_in_abs'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                    JOIN stg_abs_locs al ON al.locality = upper(pg.locality)
                                        AND al.state = pg.state
                    WHERE pg.postcode = e.postcode)
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg2
                    JOIN stg_suffix_fix f ON f.loc = upper(pg2.locality)
                                         AND f.state = pg2.state
                    WHERE pg2.postcode = e.postcode);

-- 4f'. Remainder with a postcode = genuine multi-council ambiguity.
UPDATE gs_entities e SET lga_source = 'unresolved_multi_lga_postcode'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL;

-- Phase 5. Re-run placement for what normalization freed.
-- 5a. Single-council postcodes, state-qualified (authority: ABS chain).
DROP TABLE IF EXISTS stg_pc_single;
CREATE UNLOGGED TABLE stg_pc_single AS
SELECT pg.postcode, pg.state,
       min(al.lga_name) AS lga_name,
       min(al.lga_code) AS lga_code
  FROM postcode_geo pg
  JOIN stg_abs_locs al ON al.locality = upper(pg.locality) AND al.state = pg.state
 GROUP BY 1, 2
HAVING count(DISTINCT al.lga_code) = 1;
CREATE INDEX ON stg_pc_single (postcode, state);
ANALYZE stg_pc_single;

UPDATE gs_entities e
   SET lga_name = pc.lga_name,
       lga_code = pc.lga_code,
       lga_source = 'single_lga_postcode'
  FROM stg_pc_single pc
 WHERE pc.postcode = e.postcode
   AND pc.state = e.state
   AND e.lga_name IS NULL;

-- 5b. ACNC town on unambiguous locality (the 20260808130000 pass, re-run for
--     normalized states). abn unique among town_city carriers.
DROP TABLE IF EXISTS stg_town_unamb;
CREATE UNLOGGED TABLE stg_town_unamb AS
SELECT al.locality AS loc, al.state,
       min(al.lga_name) AS lga_name,
       min(al.lga_code) AS lga_code
  FROM stg_abs_locs al
 WHERE al.lga_count = 1
 GROUP BY 1, 2
HAVING count(*) = 1;
CREATE INDEX ON stg_town_unamb (loc, state);
ANALYZE stg_town_unamb;

UPDATE gs_entities e
   SET lga_name = u.lga_name,
       lga_code = u.lga_code,
       lga_source = 'acnc_town_city+abs_asgs'
  FROM acnc_charities c
  JOIN stg_town_unamb u ON u.loc = upper(c.town_city)
 WHERE c.abn = e.abn
   AND c.town_city IS NOT NULL
   AND u.state = e.state
   AND e.lga_name IS NULL;

-- Phase 6. Verify, then clean up.
SELECT 'entity states now canonical' AS check, count(*) AS remaining_noncanonical
  FROM gs_entities
 WHERE state IS NOT NULL
   AND state NOT IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA');

SELECT 'postcode_geo NULL-state rows left' AS check, count(*) AS rows
  FROM postcode_geo WHERE state IS NULL;

SELECT 'unplaced with postcode' AS check, count(*) AS rows
  FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL;

SELECT COALESCE(lga_source, '(STILL NULL - should be zero)') AS reason,
       count(*) AS entities
  FROM gs_entities
 WHERE lga_name IS NULL
 GROUP BY 1 ORDER BY 2 DESC;

SELECT lga_source, count(*) AS placed_total
  FROM gs_entities
 WHERE lga_name IS NOT NULL AND lga_source IS NOT NULL
 GROUP BY 1 ORDER BY 2 DESC;

DROP TABLE IF EXISTS stg_town_unamb;
DROP TABLE IF EXISTS stg_pc_single;
DROP TABLE IF EXISTS stg_suffix_fix;
DROP TABLE IF EXISTS stg_straddler_rows;
DROP TABLE IF EXISTS stg_abs_locs;
