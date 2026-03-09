-- Self-fill remoteness for postcodes where SA2 code exists in other rows with remoteness
-- This fills 133 postcodes / ~1,500 entities using existing postcode_geo data

-- Step 1: Fill postcode_geo rows that have SA2 but no remoteness,
-- using remoteness from other rows with the same SA2 code
UPDATE postcode_geo pg_null
SET remoteness_2021 = fill.remoteness_2021
FROM (
  SELECT DISTINCT ON (sa2_code) sa2_code, remoteness_2021
  FROM postcode_geo
  WHERE remoteness_2021 IS NOT NULL AND sa2_code IS NOT NULL
  ORDER BY sa2_code, remoteness_2021
) fill
WHERE pg_null.sa2_code = fill.sa2_code
  AND pg_null.remoteness_2021 IS NULL;

-- Step 2: Backfill gs_entities remoteness from the now-updated postcode_geo
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
