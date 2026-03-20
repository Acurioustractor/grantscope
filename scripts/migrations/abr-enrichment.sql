-- ABR Enrichment: backfill gs_entities location data from ABR registry
-- Run each step as separate transaction to avoid timeout

-- Step 1: Backfill postcode from ABR
UPDATE gs_entities ge
SET postcode = ar.postcode
FROM abr_registry ar
WHERE ge.abn = ar.abn
  AND ge.postcode IS NULL
  AND ge.abn IS NOT NULL
  AND ar.postcode IS NOT NULL
  AND ar.postcode != ''
  AND length(ar.postcode) = 4;

-- Step 2: Backfill state from ABR
UPDATE gs_entities ge
SET state = ar.state
FROM abr_registry ar
WHERE ge.abn = ar.abn
  AND ge.state IS NULL
  AND ge.abn IS NOT NULL
  AND ar.state IS NOT NULL
  AND ar.state != '';

-- Step 3: Cascade postcode → LGA, remoteness via postcode_geo
-- Only where LGA is missing
SET statement_timeout = '300s';

UPDATE gs_entities ge
SET
  lga_name = pg.lga_name,
  lga_code = pg.lga_code
FROM postcode_geo pg
WHERE ge.postcode = pg.postcode
  AND ge.postcode IS NOT NULL
  AND ge.lga_name IS NULL
  AND pg.lga_name IS NOT NULL;

-- Step 4: Cascade postcode → remoteness
UPDATE gs_entities ge
SET remoteness = pg.remoteness_2021
FROM postcode_geo pg
WHERE ge.postcode = pg.postcode
  AND ge.postcode IS NOT NULL
  AND ge.remoteness IS NULL
  AND pg.remoteness_2021 IS NOT NULL;

-- Step 5: Cascade postcode → SEIFA decile
UPDATE gs_entities ge
SET seifa_irsd_decile = s.decile_national
FROM seifa_2021 s
WHERE ge.postcode = s.postcode
  AND s.index_type = 'irsd'
  AND ge.seifa_irsd_decile IS NULL
  AND ge.postcode IS NOT NULL;

RESET statement_timeout;
