-- Batch remoteness backfill for gs_entities
-- Uses DO block with batched updates to avoid timeout

SET statement_timeout = '600s';

-- First ensure we have an index on postcode for the join
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_entities_postcode ON gs_entities(postcode);

-- Batch update 2000 rows at a time
DO $$
DECLARE
  batch_size INT := 2000;
  updated INT;
  total INT := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT e.id, pg.remoteness_2021
      FROM gs_entities e
      JOIN (
        SELECT DISTINCT ON (postcode) postcode, remoteness_2021
        FROM postcode_geo
        WHERE remoteness_2021 IS NOT NULL
        ORDER BY postcode, remoteness_2021
      ) pg ON e.postcode = pg.postcode
      WHERE e.remoteness IS NULL
      LIMIT batch_size
    )
    UPDATE gs_entities
    SET remoteness = batch.remoteness_2021
    FROM batch
    WHERE gs_entities.id = batch.id;

    GET DIAGNOSTICS updated = ROW_COUNT;
    total := total + updated;
    RAISE NOTICE 'Updated % rows (total: %)', updated, total;

    EXIT WHEN updated = 0;
  END LOOP;
  RAISE NOTICE 'Done. Total rows updated: %', total;
END $$;
