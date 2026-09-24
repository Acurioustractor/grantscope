-- Take placeholder text out of the abn column of three foreign suppliers.
--
-- check-graph-attribution reads any abn that is not 11 digits as a SINK: a node where every source
-- row with the same junk value lands. Measured 2026-09-24, these three are not misattributed:
--
--   gs_id                  name                      abn              edges
--   AU-ABN-Notapplicable   ATLASSIAN                 'Notapplicable'  8 AusTender contracts ($227,680),
--                                                                     supplier 'Atlassian' on all 8;
--                                                                     1 subsidiary_of Atlassian Foundation
--   AU-ABN-N/A             MULTI-HEALTH SYSTEMS INC  'N/A'            1 contract ($31,000), 'Multi-Health Systems Inc'
--   AU-ABN-#VALUE!         OKTA INC                  '#VALUE!'        1 contract ($12,481), 'Okta Inc'
--
-- They have no ABN, so abn becomes NULL. Nothing else changes: gs_id stays (profile URLs keep
-- working), the name stays, every edge stays. The AusTender recipe already requires an 11-digit
-- supplier ABN, so no new contract can land on these nodes.
--
-- The other 16 invalid-ABN entities the gate reports (short numeric values on single clubs and
-- associations) are left for a separate decision.
--
-- Apply AFTER this file is on main: scripts/db-apply.sh <this file>
-- Undo: UPDATE gs_entities SET abn = 'Notapplicable' WHERE gs_id = 'AU-ABN-Notapplicable';
--       UPDATE gs_entities SET abn = 'N/A'           WHERE gs_id = 'AU-ABN-N/A';
--       UPDATE gs_entities SET abn = '#VALUE!'       WHERE gs_id = 'AU-ABN-#VALUE!';

BEGIN;

DO $$
DECLARE n int;
BEGIN
  UPDATE gs_entities SET abn = NULL
   WHERE (gs_id, abn) IN (('AU-ABN-Notapplicable', 'Notapplicable'),
                          ('AU-ABN-N/A', 'N/A'),
                          ('AU-ABN-#VALUE!', '#VALUE!'));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 entities, updated %', n; END IF;
END $$;

COMMIT;
