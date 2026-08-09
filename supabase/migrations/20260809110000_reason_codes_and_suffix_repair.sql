-- Reason codes for every unplaced entity + suffix-variant locality repair.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809110000_reason_codes_and_suffix_repair.sql
-- AFTERWARDS: MVs unaffected except via the ~8 placements; nightly refresh covers it.
--
-- WHY. Phase 1 of thoughts/shared/plans/place-data-truth.md: every unplaced
-- entity carries a reason, so the atlas caveat card can say WHY per slice
-- instead of only how many. Quantified 2026-08-09 (live):
--   * 58,884 already stamped unresolved_multi_lga_postcode (honest ambiguity)
--   * 21,975 carried NO reason: 12,069 in postcodes whose localities ABS
--     cannot map + 7,165 in postcodes we hold no geography for + 2,532 in
--     multi-council postcodes that were already NULL when the stamping pass
--     ran (it only stamped rows it nulled itself) + 203 state conflicts +
--     6 with no state
--   * ~275K entities with no postcode at all - the largest honest slice,
--     never before named
-- Also: 171 postcode_geo rows are postal suffix variants absent from ABS
-- (WARRNAMBOOL EAST class); where the stripped base names exactly one
-- council, the variant gets that council. Dry-run: repairing them newly maps
-- 10 postcodes and frees 8 entities.
--
-- The single-council placement pass was dry-run against today's ground
-- before writing this: ZERO additional entities are placeable under its
-- criteria. Placement is exhausted; what remains is recording why.
--
-- Reason values (lga_source on rows where lga_name IS NULL):
--   no_postcode | unknown_postcode | postcode_unmapped_in_abs |
--   no_state | state_conflict | unresolved_multi_lga_postcode
-- Placements from this file stamp single_lga_postcode (suffix-unlocked).
--
-- Run shape: autocommit, no wrapping transaction. The no_postcode stamp is
-- chunked into fixed batches (the 2026-08-08 lesson: one big UPDATE holds
-- pooler locks too long). Idempotent: every stamp targets lga_source IS NULL,
-- so a re-run touches only what a prior run missed.
-- Reversible: postcode_geo_lga_backup_20260809c, gs_entities_lga_backup_20260809c.

SET statement_timeout = '15min';

-- Phase 0. Backups.
CREATE TABLE IF NOT EXISTS postcode_geo_lga_backup_20260809c AS
SELECT postcode, locality, state, lga_name, lga_code
FROM postcode_geo;

CREATE TABLE IF NOT EXISTS gs_entities_lga_backup_20260809c AS
SELECT id, abn, postcode, state, lga_name, lga_code, lga_source
FROM gs_entities
WHERE lga_name IS NULL;

-- Phase 1. Staging.
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
SELECT DISTINCT a.locality, s.code AS state, a.lga_name, a.lga_code
  FROM abs_locality_lga a
  JOIN sc s ON s.state_name = a.state_name;
CREATE INDEX ON stg_abs_locs (locality, state);
ANALYZE stg_abs_locs;

-- Suffix variants whose stripped base names exactly one council, state-qualified.
DROP TABLE IF EXISTS stg_suffix_fix;
CREATE UNLOGGED TABLE stg_suffix_fix AS
SELECT sf.loc, sf.state,
       min(al.lga_name) AS lga_name,
       min(al.lga_code) AS lga_code
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

-- Phase 2. Repair postcode_geo suffix variants. Dry-run measured ~166 rows.
UPDATE postcode_geo p
   SET lga_name = f.lga_name,
       lga_code = f.lga_code
  FROM stg_suffix_fix f
 WHERE f.loc = upper(p.locality)
   AND f.state = p.state
   AND p.lga_name IS DISTINCT FROM f.lga_name;

-- Phase 3. Place entities on postcodes the repair made single-council.
-- Same authority chain and state guard as 20260809070000. Dry-run: ~8.
DROP TABLE IF EXISTS stg_pc_single;
CREATE UNLOGGED TABLE stg_pc_single AS
WITH mapped AS (
  SELECT pg.postcode, pg.state, al.lga_name, al.lga_code
    FROM postcode_geo pg
    JOIN stg_abs_locs al ON al.locality = upper(pg.locality) AND al.state = pg.state
  UNION
  SELECT pg.postcode, pg.state, f.lga_name, f.lga_code
    FROM postcode_geo pg
    JOIN stg_suffix_fix f ON f.loc = upper(pg.locality) AND f.state = pg.state
)
SELECT postcode, state, min(lga_name) AS lga_name, min(lga_code) AS lga_code
  FROM mapped
 GROUP BY 1, 2
HAVING count(DISTINCT lga_code) = 1;
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

-- Phase 4. Reason codes. Order matters; each stamp targets lga_source IS NULL.

-- 4a. No postcode at all (~275K) - chunked, four batches, autocommit each.
UPDATE gs_entities SET lga_source = 'no_postcode'
 WHERE id IN (SELECT id FROM gs_entities
               WHERE lga_name IS NULL AND lga_source IS NULL AND postcode IS NULL
               LIMIT 100000);
UPDATE gs_entities SET lga_source = 'no_postcode'
 WHERE id IN (SELECT id FROM gs_entities
               WHERE lga_name IS NULL AND lga_source IS NULL AND postcode IS NULL
               LIMIT 100000);
UPDATE gs_entities SET lga_source = 'no_postcode'
 WHERE id IN (SELECT id FROM gs_entities
               WHERE lga_name IS NULL AND lga_source IS NULL AND postcode IS NULL
               LIMIT 100000);
UPDATE gs_entities SET lga_source = 'no_postcode'
 WHERE id IN (SELECT id FROM gs_entities
               WHERE lga_name IS NULL AND lga_source IS NULL AND postcode IS NULL
               LIMIT 100000);

-- 4b. Postcode we hold no geography for (~7,165).
UPDATE gs_entities e SET lga_source = 'unknown_postcode'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg WHERE pg.postcode = e.postcode);

-- 4c. No state on the entity (6).
UPDATE gs_entities e SET lga_source = 'no_state'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND e.state IS NULL;

-- 4d. State contradicts the postcode's states (203).
UPDATE gs_entities e SET lga_source = 'state_conflict'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                    WHERE pg.postcode = e.postcode AND pg.state = e.state);

-- 4e. Postcode whose localities neither ABS nor the suffix repair can map
--     (~12,069 minus suffix unlocks).
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

-- 4f. Everything else with a postcode = genuine multi-council ambiguity
--     (the 2,532 pass-2 never stamped, plus stragglers).
UPDATE gs_entities e SET lga_source = 'unresolved_multi_lga_postcode'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL;

-- Phase 5. Verify, then clean up.
SELECT 'suffix rows repaired' AS check, count(*) AS rows
  FROM postcode_geo p
  JOIN stg_suffix_fix f ON f.loc = upper(p.locality) AND f.state = p.state
 WHERE p.lga_name = f.lga_name;

SELECT 'unplaced with postcode' AS check, count(*) AS rows
  FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL;

SELECT COALESCE(lga_source, '(STILL NULL - should be zero)') AS reason,
       count(*) AS entities
  FROM gs_entities
 WHERE lga_name IS NULL
 GROUP BY 1 ORDER BY 2 DESC;

DROP TABLE IF EXISTS stg_pc_single;
DROP TABLE IF EXISTS stg_suffix_fix;
DROP TABLE IF EXISTS stg_abs_locs;
