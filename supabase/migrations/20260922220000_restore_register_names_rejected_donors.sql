-- Restore the ABN register's name on 144 nodes that carry a wrongly matched donor's name.
--
-- Step 2 of the stale-edge cleanup (step 1: #503). build-entity-graph named a new ABN node after
-- the donor matched to it; when the match was wrong, the node took another organisation's name
-- and kept it. These are the nodes behind the 187 matches rejected in 20260922200000: FinClear's
-- ABN labelled "Pershing Securities Australia Limited", a car wash's labelled "CRS Australia",
-- Mucho Locos Pty Ltd's labelled "Rio Tinto Ltd". A node is renamed only when its current name
-- IS the rejected donor's name, so a node another source named correctly is left alone.
--
-- Name only. entity_type is not touched here (e.g. the car wash is typed government_body); that
-- needs the register's type mapped to ours and is a separate change.
--
-- The old names are kept in gs_entity_name_restores_20260922, so this is reversible row by row.
-- Approved by Ben 2026-09-22.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922220000_restore_register_names_rejected_donors.sql

BEGIN;

CREATE TABLE gs_entity_name_restores_20260922 AS
SELECT DISTINCT ON (e.id)
       e.id AS entity_id, e.gs_id, e.canonical_name AS old_name, a.entity_name AS new_name,
       'donor_entity_match_rejections'::text AS reason
  FROM donor_entity_match_rejections r
  JOIN gs_entities e ON e.gs_id = 'AU-ABN-' || r.rejected_abn
  JOIN abr_registry a ON a.abn = r.rejected_abn
 WHERE upper(trim(e.canonical_name)) = upper(trim(r.donor_name))
   AND a.entity_name IS NOT NULL
 ORDER BY e.id;
ALTER TABLE gs_entity_name_restores_20260922 ADD PRIMARY KEY (entity_id);
ALTER TABLE gs_entity_name_restores_20260922 ENABLE ROW LEVEL SECURITY;

UPDATE gs_entities e
   SET canonical_name = x.new_name
  FROM gs_entity_name_restores_20260922 x
 WHERE e.id = x.entity_id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entity_name_restores_20260922;
  IF n <> 144 THEN RAISE EXCEPTION 'expected 144 nodes to restore, found %', n; END IF;
  SELECT count(*) INTO n
    FROM donor_entity_match_rejections r JOIN gs_entities e ON e.gs_id = 'AU-ABN-' || r.rejected_abn
   WHERE upper(trim(e.canonical_name)) = upper(trim(r.donor_name));
  IF n > 0 THEN RAISE EXCEPTION '% nodes still carry a rejected donor name', n; END IF;
END $$;

COMMIT;
