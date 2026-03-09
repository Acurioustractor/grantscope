-- Backfill remoteness and SEIFA for gs_entities that have postcodes
-- but were missed by the original enrichment migration

-- 1. Backfill remoteness from postcode_geo (using first match per postcode)
UPDATE gs_entities e
SET remoteness = pg.remoteness_2021
FROM (
  SELECT DISTINCT ON (postcode) postcode, remoteness_2021
  FROM postcode_geo
  WHERE remoteness_2021 IS NOT NULL
  ORDER BY postcode, remoteness_2021
) pg
WHERE e.postcode = pg.postcode
  AND e.remoteness IS NULL;

-- 2. Backfill SEIFA IRSD decile from seifa_2021
UPDATE gs_entities e
SET seifa_irsd_decile = s.decile_national
FROM seifa_2021 s
WHERE e.postcode = s.postcode
  AND s.index_type = 'IRSD'
  AND e.seifa_irsd_decile IS NULL;

-- 3. Backfill sa2_code from postcode_geo
UPDATE gs_entities e
SET sa2_code = pg.sa2_code
FROM (
  SELECT DISTINCT ON (postcode) postcode, sa2_code
  FROM postcode_geo
  WHERE sa2_code IS NOT NULL
  ORDER BY postcode, sa2_code
) pg
WHERE e.postcode = pg.postcode
  AND e.sa2_code IS NULL;
