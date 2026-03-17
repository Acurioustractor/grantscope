-- Enrich gs_entities with geographic data
-- Simple cursor-based batching

SET statement_timeout = '90s';

-- Build fast lookup tables
CREATE TEMP TABLE pc_lookup AS
SELECT DISTINCT ON (postcode) postcode, lga_name, lga_code, remoteness_2021
FROM postcode_geo WHERE lga_name IS NOT NULL
ORDER BY postcode, lga_name;
CREATE INDEX ON pc_lookup (postcode);

CREATE TEMP TABLE seifa_lookup AS
SELECT DISTINCT ON (postcode) postcode, decile_national
FROM seifa_2021 WHERE index_type = 'irsd' AND decile_national IS NOT NULL
ORDER BY postcode;
CREATE INDEX ON seifa_lookup (postcode);

-- LGA + remoteness backfill using simple loop
DO $$
DECLARE
  total_updated int := 0;
  batch_count int;
  rec record;
  cur CURSOR FOR
    SELECT e.id, pc.lga_name, pc.lga_code, pc.remoteness_2021
    FROM gs_entities e
    JOIN pc_lookup pc ON pc.postcode = e.postcode
    WHERE e.postcode IS NOT NULL
      AND (e.lga_name IS NULL OR e.lga_code IS NULL OR e.remoteness IS NULL);
  batch_limit int := 500;
  i int := 0;
BEGIN
  RAISE NOTICE 'Starting LGA + remoteness backfill...';

  OPEN cur;
  LOOP
    FETCH cur INTO rec;
    EXIT WHEN NOT FOUND;

    UPDATE gs_entities SET
      lga_name = COALESCE(lga_name, rec.lga_name),
      lga_code = COALESCE(lga_code, rec.lga_code),
      remoteness = COALESCE(remoteness, rec.remoteness_2021)
    WHERE id = rec.id;

    total_updated := total_updated + 1;
    i := i + 1;

    IF i % 5000 = 0 THEN
      RAISE NOTICE '  LGA progress: % updated', total_updated;
    END IF;
  END LOOP;
  CLOSE cur;

  RAISE NOTICE 'LGA done: % entities updated', total_updated;
END $$;

-- SEIFA backfill
DO $$
DECLARE
  total_updated int := 0;
  rec record;
  cur CURSOR FOR
    SELECT e.id, sl.decile_national
    FROM gs_entities e
    JOIN seifa_lookup sl ON sl.postcode = e.postcode
    WHERE e.postcode IS NOT NULL AND e.seifa_irsd_decile IS NULL;
  i int := 0;
BEGIN
  RAISE NOTICE 'Starting SEIFA backfill...';

  OPEN cur;
  LOOP
    FETCH cur INTO rec;
    EXIT WHEN NOT FOUND;

    UPDATE gs_entities SET seifa_irsd_decile = rec.decile_national
    WHERE id = rec.id;

    total_updated := total_updated + 1;
    i := i + 1;

    IF i % 5000 = 0 THEN
      RAISE NOTICE '  SEIFA progress: % updated', total_updated;
    END IF;
  END LOOP;
  CLOSE cur;

  RAISE NOTICE 'SEIFA done: % entities updated', total_updated;
END $$;

ANALYZE gs_entities (lga_name, lga_code, remoteness, seifa_irsd_decile);

SELECT attname as field,
  ROUND(((1.0 - null_frac) * 100)::numeric, 1) as pct_filled
FROM pg_stats
WHERE tablename = 'gs_entities'
AND attname IN ('lga_name','lga_code','remoteness','seifa_irsd_decile','postcode','state','abn')
ORDER BY pct_filled;
