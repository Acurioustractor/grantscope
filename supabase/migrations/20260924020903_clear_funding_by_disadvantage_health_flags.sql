-- Clear the broken_upstream flag on the two funding-by-disadvantage views.
--
-- mv_refresh_registry marked both broken_upstream because they read max(acnc_ais.ais_year), a year
-- holding one stray filing (1 row and 0 rows). 20260923214525 made them read the latest year with
-- 10,000+ filings; after it, they cover 36,783 and 9,869 charities. The flag is a label (the
-- refresh does not read it), so this only stops the register calling working views broken.
--
-- Apply AFTER this file is on main: scripts/db-apply.sh <this file>
-- Undo: set health = 'broken_upstream' on the two rows.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  UPDATE mv_refresh_registry
     SET health = NULL,
         notes = 'Reads the latest acnc_ais year with 10,000+ filings (20260923214525). Was max(ais_year), which picked a year holding one stray filing.',
         updated_at = now()
   WHERE mv_name IN ('mv_funding_by_disadvantage', 'mv_indigenous_funding_by_disadvantage')
     AND health = 'broken_upstream';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 registry rows, updated %', n; END IF;
END $$;

COMMIT;
