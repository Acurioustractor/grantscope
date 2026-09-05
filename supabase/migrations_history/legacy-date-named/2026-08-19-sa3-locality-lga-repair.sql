-- Issue #301 — repair the SA3-shaped locality rows using ABS data already in this database
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-19-sa3-locality-lga-repair.sql
--
-- THE HANDOFF NOTE WAS WRONG, AND IT COST FOUR MONTHS OF "BLOCKED".
-- #301 was recorded as needing the ABS SA3-to-LGA correspondence file, an external download.
-- It does not. `abs_poa_lga_ratio` is already loaded -- 3,968 rows over 2,641 postcodes -- and it
-- is a BETTER instrument than the SA3 file, because it maps postcode directly to LGA with a
-- population ratio, skipping the SA3 hop entirely. It covers 435 of the 451 defective postcodes.
-- Before declaring a data task blocked on an external file, check whether the correspondence is
-- already in the warehouse under a different name.
--
-- The defect. 451 postcode_geo rows carry ABS statistical-area names in `locality`
-- ('Townsville - South', 'Nerang - Mount Nathan', 'Chatswood - East') rather than gazetted
-- localities, and the LGA attached to those rows is frequently wrong. Entities inherit it.
--
-- Measured against ABS dominance, 2026-08-19. The earlier "at least 6 of a random 12 are wrong"
-- read high -- the true rate is 133 of 451, about 29%:
--
--   dominant (>=90% one LGA), stamp AGREES     298   <- already correct, untouched
--   dominant, stamp DISAGREES                   87   <- fixed below, 9,101 entities
--   genuinely split (<90%), stamp DISAGREES     46   <- unplaced below, 6,110 entities
--   no ABS ratio data                           16   <- untouched, still open
--   dominant, currently unstamped                2   <- filled below
--
-- Every one of the 46 split postcodes disagrees with the ABS majority and NOT ONE agrees. That is
-- systematic, not noise, so the stamps on split postcodes are not trustworthy either. They cannot
-- be corrected (no LGA reaches 90%), so they are unplaced and reason-coded rather than guessed --
-- the standing rule from the LGA rebuild: deliberately unplaced beats confidently wrong.
--
-- Sample of what is being corrected, all ratios 0.93 to 1.00:
--   4211 Nerang           Scenic Rim      -> Gold Coast     711 entities
--   2067 Chatswood-East   Ryde            -> Willoughby     635
--   2830 Dubbo-South      Warrumbungle    -> Dubbo          601
--   4817 Kirwan-West      Charters Towers -> Townsville     298
--   0830 Durack           Litchfield      -> Palmerston     276
--
-- Not in scope: the 16 postcodes with no ABS ratio row, and the 298 that were already right.

BEGIN;

CREATE TABLE _backup_postcode_geo_sa3_20260819 AS
SELECT * FROM postcode_geo WHERE locality LIKE '% - %';

CREATE TABLE _backup_gs_entities_sa3_20260819 AS
SELECT id, gs_id, canonical_name, postcode, lga_name, lga_code, lga_source
FROM gs_entities
WHERE postcode IN (SELECT postcode FROM postcode_geo WHERE locality LIKE '% - %');

CREATE TEMP TABLE _dom ON COMMIT DROP AS
SELECT DISTINCT ON (poa_code) poa_code, lga_name, lga_code, ratio
FROM abs_poa_lga_ratio ORDER BY poa_code, ratio DESC;

-- The 87 correctable postcodes, plus the 2 that carry no stamp at all.
CREATE TEMP TABLE _fix ON COMMIT DROP AS
SELECT g.postcode, g.lga_name AS old_lga, d.lga_name AS new_lga, d.lga_code AS new_code
FROM postcode_geo g JOIN _dom d ON d.poa_code = g.postcode
WHERE g.locality LIKE '% - %'
  AND d.ratio >= 0.90
  AND (g.lga_name IS NULL OR lower(g.lga_name) <> lower(d.lga_name));

-- The 46 genuinely-split postcodes whose stamp disagrees with the ABS majority.
CREATE TEMP TABLE _unplace ON COMMIT DROP AS
SELECT g.postcode, g.lga_name AS old_lga
FROM postcode_geo g JOIN _dom d ON d.poa_code = g.postcode
WHERE g.locality LIKE '% - %'
  AND d.ratio < 0.90
  AND g.lga_name IS NOT NULL
  AND lower(g.lga_name) <> lower(d.lga_name);

DO $$
DECLARE n_fix int; n_un int;
BEGIN
  SELECT count(*) INTO n_fix FROM _fix;
  SELECT count(*) INTO n_un  FROM _unplace;
  IF n_fix <> 89 THEN RAISE EXCEPTION 'expected 89 correctable postcodes (87 wrong + 2 unstamped), found %', n_fix; END IF;
  IF n_un  <> 46 THEN RAISE EXCEPTION 'expected 46 split-and-disagreeing postcodes, found %', n_un; END IF;
END $$;

-- 1. Correct the source rows.
UPDATE postcode_geo g SET lga_name = f.new_lga, lga_code = f.new_code
FROM _fix f WHERE f.postcode = g.postcode AND g.locality LIKE '% - %';

-- 2. Re-stamp entities that inherited the wrong LGA. Only rows still carrying the OLD value are
--    touched; anything placed by street address, ORIC register or own-name evidence keeps its
--    better provenance.
UPDATE gs_entities e
SET lga_name = f.new_lga, lga_code = f.new_code,
    lga_source = 'poa_ratio_dominant+sa3_defect_repair'
FROM _fix f
WHERE e.postcode = f.postcode
  AND f.old_lga IS NOT NULL
  AND lower(e.lga_name) = lower(f.old_lga);

-- 3. Unplace the split postcodes at source.
UPDATE postcode_geo g SET lga_name = NULL, lga_code = NULL
FROM _unplace u WHERE u.postcode = g.postcode AND g.locality LIKE '% - %';

-- 4. And unplace the entities that inherited those stamps.
UPDATE gs_entities e
SET lga_name = NULL, lga_code = NULL,
    lga_source = 'unresolved_multi_lga_postcode'
FROM _unplace u
WHERE e.postcode = u.postcode
  AND lower(e.lga_name) = lower(u.old_lga);

COMMIT;
