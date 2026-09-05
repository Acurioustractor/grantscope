-- Stamp the remaining unplaced organisation-like rows that arrived without an
-- lga_source reason after the August placement passes.
--
-- This deliberately does not place any entity. It only moves null lga_source
-- rows into the same reason buckets the Atlas already explains.

BEGIN;

WITH target AS (
  SELECT e.id,
         CASE
           WHEN e.postcode IS NULL THEN 'no_postcode'
           WHEN NOT EXISTS (
             SELECT 1
             FROM postcode_geo pg
             WHERE pg.postcode = e.postcode
           ) THEN 'unknown_postcode'
           WHEN e.state IS NULL THEN 'no_state'
           WHEN NOT EXISTS (
             SELECT 1
             FROM postcode_geo pg
             WHERE pg.postcode = e.postcode
               AND upper(pg.state) = upper(e.state)
           ) THEN 'state_conflict'
           WHEN NOT EXISTS (
             SELECT 1
             FROM postcode_geo pg
             WHERE pg.postcode = e.postcode
               AND pg.lga_name IS NOT NULL
           ) THEN 'postcode_unmapped_in_abs'
           ELSE 'unresolved_multi_lga_postcode'
         END AS reason
  FROM gs_entities e
  WHERE e.lga_name IS NULL
    AND e.lga_source IS NULL
    AND e.entity_type NOT IN ('person', 'program')
)
UPDATE gs_entities e
   SET lga_source = target.reason,
       updated_at = now()
  FROM target
 WHERE e.id = target.id;

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM gs_entities
  WHERE lga_name IS NULL
    AND lga_source IS NULL
    AND entity_type NOT IN ('person', 'program');

  IF remaining <> 0 THEN
    RAISE EXCEPTION 'unplaced organisation-like rows still unstamped: %', remaining;
  END IF;
END $$;

COMMIT;
