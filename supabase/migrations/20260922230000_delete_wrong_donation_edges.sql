-- Delete graph edges attributed to the wrong entity: placeholder ABNs and rejected donor matches.
--
-- Step 3 of the stale-edge cleanup. The build only ever adds edges, so edges built under logic
-- that has since been fixed stay in the graph and keep being counted:
--
--   1. Placeholder nodes. Any edge on a node whose ABN is all zeros (AU-ABN-0 "112 Trenerry
--      Crescent Pty Ltd", AU-ABN-00000000000). 771 donor matches carried matched_abn '0' and
--      collapsed onto one company; the recipe was guarded 2026-08-14 but the edges were never
--      removed. 55,578 aec_donations edges ($4.59bn) and 228 justice_funding edges ($773M, the
--      justice recipe is guarded in the same PR so they are not rebuilt).
--   2. Rejected matches. aec_donations edges whose donor node is the ABN of a pair rejected in
--      20260922200000 AND whose donation names that rejected donor with no ABN of its own.
--      34,362 edges ($3.36bn). Total 90,168 edges, $8.72bn (rollback test 2026-09-22).
--
-- NOT deleted: 5 lobbying_register_nsw edges on the placeholders (written by
-- import-lobbying-register.mjs, which would re-create them; separate fix).
--
-- Every deleted edge is copied first to gs_relationships_deleted_20260922 (same columns plus a
-- reason), so this is reversible. Apply BEFORE 20260922220000 (restore register names): some
-- of those ABNs are sole traders, and their names must not appear on these edges.
-- Approved by Ben 2026-09-22.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922230000_delete_wrong_donation_edges.sql

BEGIN;
SET LOCAL statement_timeout = 0;

-- One pass, each edge at most once. Rejections list some donors under several spellings
-- ("Rio Tinto Ltd", "RIO TINTO LTD"), so the rejected set is keyed (node, upper(donor)) first.
CREATE TEMP TABLE rej_nodes ON COMMIT DROP AS
SELECT DISTINCT e.id AS node_id, upper(trim(x.donor_name)) AS donor_key
  FROM donor_entity_match_rejections x
  JOIN gs_entities e ON e.gs_id = 'AU-ABN-' || x.rejected_abn;
CREATE INDEX ON rej_nodes (node_id, donor_key);
CREATE TEMP TABLE placeholder_nodes ON COMMIT DROP AS
SELECT id FROM gs_entities WHERE abn ~ '^0+$';
ANALYZE rej_nodes; ANALYZE placeholder_nodes;

CREATE TABLE gs_relationships_deleted_20260922 AS
SELECT r.*,
       CASE WHEN r.source_entity_id IN (SELECT id FROM placeholder_nodes)
              OR r.target_entity_id IN (SELECT id FROM placeholder_nodes)
            THEN 'placeholder_abn' ELSE 'rejected_donor_match' END AS delete_reason
  FROM gs_relationships r
  LEFT JOIN political_donations pd
    ON r.dataset = 'aec_donations' AND pd.id::text = r.source_record_id
 WHERE r.dataset IN ('aec_donations', 'justice_funding')
   AND (   r.source_entity_id IN (SELECT id FROM placeholder_nodes)
        OR r.target_entity_id IN (SELECT id FROM placeholder_nodes)
        OR (    r.dataset = 'aec_donations'
            AND nullif(trim(pd.donor_abn), '') IS NULL
            AND EXISTS (SELECT 1 FROM rej_nodes k
                         WHERE k.node_id = r.source_entity_id
                           AND k.donor_key = upper(trim(pd.donor_name)))));

ALTER TABLE gs_relationships_deleted_20260922 ADD PRIMARY KEY (id);
ALTER TABLE gs_relationships_deleted_20260922 ENABLE ROW LEVEL SECURITY;

DELETE FROM gs_relationships r
 USING gs_relationships_deleted_20260922 d
 WHERE r.id = d.id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_relationships_deleted_20260922;
  IF n NOT BETWEEN 90000 AND 90500 THEN RAISE EXCEPTION 'expected ~90,168 edges to delete, found %', n; END IF;
  SELECT count(*) INTO n FROM gs_relationships r JOIN gs_entities e ON e.id IN (r.source_entity_id, r.target_entity_id)
   WHERE e.abn ~ '^0+$' AND r.dataset IN ('aec_donations', 'justice_funding');
  IF n > 0 THEN RAISE EXCEPTION '% placeholder edges remain', n; END IF;
END $$;

COMMIT;
