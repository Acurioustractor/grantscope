-- Take the double-counted and out-of-lane money edges off the graph.
--
-- scripts/check-lane-reconciliation.mjs compares the money on gs_relationships with the filtered
-- source it was built from. Measured 2026-09-24 (Brisbane):
--
--   dataset          on edges   filtered source   why the edges are higher
--   justice_funding   $76.31B        $33.98B       29,747 edges from rows outside the grant lane
--                                                  ($33.67B: whole-of-state budgets, grant-shaped
--                                                  aggregates, 'Total' rows), and 120 edges whose
--                                                  source row was deleted by the ROGS dedupe on
--                                                  2026-08-19 ($11.05B)
--   austender       $1300.81B      $1201.25B       25,899 edges from the 2026-03-15 build, keyed by
--                                                  the contract's uuid, for contracts that ALSO have
--                                                  the current edge keyed by ocid. 18,408 point at
--                                                  the same pair ($83.68B, an exact double); 7,491
--                                                  at an older entity pair ($16.88B, the contract
--                                                  counted against two suppliers or buyers)
--
-- The builder only ever adds (ON CONFLICT DO NOTHING), so nothing removed these when the recipes
-- changed. Every view that sums edges (mv_entity_total_funding, mv_gs_entity_stats,
-- mv_entity_power_index, mv_search_index money) carries the excess.
--
-- The recipe side is fixed in the same change: scripts/lib/graph-edge-datasets.mjs now applies the
-- grant lane to justice_funding, so the next build does not put them back.
--
-- What this does:
--   1. copies every edge it removes to gs_relationships_lane_cleanup_20260924, with the reason;
--   2. deletes them.
--
-- NOT touched: the source rows (justice_funding, austender_contracts); 1,165 old uuid-keyed
-- AusTender edges ($0.70B) whose contract has NO current edge (1,076 with a valid supplier ABN), since
-- removing those would drop real contracts from the graph; check-lane-reconciliation.mjs keeps
-- reporting them as orphans until the recipe covers them.
--
-- Asked for by Ben 2026-09-24 ("what else is broken ... how can we get better").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260923213010_remove_double_counted_and_out_of_lane_edges.sql
-- Then:
--   node --env-file=.env scripts/check-lane-reconciliation.mjs   -- expect justice leakage 0, austender orphans ~1,165
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_total_funding;  (or wait for the nightly run)
-- Undo: INSERT INTO gs_relationships SELECT <gs_relationships columns> FROM gs_relationships_lane_cleanup_20260924;

BEGIN;
SET LOCAL statement_timeout = 0;

CREATE TEMP TABLE jf_lane ON COMMIT DROP AS
SELECT s.id::text AS s_key,
       (s.measure_kind = 'grant' AND s.is_aggregate IS NOT TRUE
        AND lower(btrim(s.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal',
              'sub-total','various','n/a','na','unknown','tbc','other'])) AS lane_ok
  FROM justice_funding s;
CREATE INDEX ON jf_lane (s_key);
ANALYZE jf_lane;

CREATE TABLE gs_relationships_lane_cleanup_20260924 AS
SELECT r.*,
       CASE WHEN l.s_key IS NULL THEN 'justice_source_row_deleted'
            ELSE 'justice_outside_grant_lane' END AS delete_reason
  FROM gs_relationships r
  LEFT JOIN jf_lane l ON l.s_key = r.source_record_id
 WHERE r.dataset = 'justice_funding'
   AND (l.s_key IS NULL OR NOT l.lane_ok);

-- An old uuid-keyed AusTender edge is removed only when the same contract already has its current
-- ocid-keyed edge, so no contract leaves the graph.
INSERT INTO gs_relationships_lane_cleanup_20260924
SELECT r.*,
       CASE WHEN EXISTS (SELECT 1 FROM gs_relationships cur
                          WHERE cur.dataset = 'austender' AND cur.source_record_id = c.ocid
                            AND cur.source_entity_id = r.source_entity_id
                            AND cur.target_entity_id = r.target_entity_id)
            THEN 'austender_legacy_key_same_pair'
            ELSE 'austender_legacy_key_other_pair' END
  FROM gs_relationships r
  JOIN austender_contracts c ON c.id::text = r.source_record_id
 WHERE r.dataset = 'austender'
   AND NULLIF(c.ocid, '') IS NOT NULL
   AND r.source_record_id <> c.ocid
   AND EXISTS (SELECT 1 FROM gs_relationships cur
                WHERE cur.dataset = 'austender' AND cur.source_record_id = c.ocid);

ALTER TABLE gs_relationships_lane_cleanup_20260924 ADD PRIMARY KEY (id);
ALTER TABLE gs_relationships_lane_cleanup_20260924 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE n int; amt numeric;
BEGIN
  SELECT count(*), sum(amount) INTO n, amt FROM gs_relationships_lane_cleanup_20260924
   WHERE delete_reason LIKE 'justice%';
  IF n NOT BETWEEN 29000 AND 30500 THEN RAISE EXCEPTION 'expected ~29,867 justice edges, found %', n; END IF;
  IF amt NOT BETWEEN 43e9 AND 46e9 THEN RAISE EXCEPTION 'expected ~$44.7B of justice edges, found %', amt; END IF;
  SELECT count(*), sum(amount) INTO n, amt FROM gs_relationships_lane_cleanup_20260924
   WHERE delete_reason LIKE 'austender%';
  IF n NOT BETWEEN 25500 AND 26300 THEN RAISE EXCEPTION 'expected ~25,899 austender edges, found %', n; END IF;
  IF amt NOT BETWEEN 99e9 AND 102e9 THEN RAISE EXCEPTION 'expected ~$100.6B of austender edges, found %', amt; END IF;
END $$;

DELETE FROM gs_relationships r
 USING gs_relationships_lane_cleanup_20260924 d
 WHERE r.id = d.id;

INSERT INTO schema_ownership (object, owner, evidence, declared_on) VALUES
  ('gs_relationships_lane_cleanup_20260924', 'grantscope',
   'backup of the justice out-of-lane/orphan and austender legacy-key edges deleted by 20260923213010; restore source, no readers',
   '2026-09-24');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_relationships r
    JOIN jf_lane l ON l.s_key = r.source_record_id
   WHERE r.dataset = 'justice_funding' AND NOT l.lane_ok;
  IF n > 0 THEN RAISE EXCEPTION '% out-of-lane justice edges remain', n; END IF;
END $$;

COMMIT;
