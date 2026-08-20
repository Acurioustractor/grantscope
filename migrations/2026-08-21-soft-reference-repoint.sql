-- Repair 4 rows my own merge broke, and record why it broke them. #324 follow-up.
--
-- NOT YET APPLIED.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-21-soft-reference-repoint.sql
--
-- THE MISTAKE, AND IT WAS MINE.
--
-- 2026-08-21-gov-entity-merge.sql re-pointed every foreign key by GENERATING the update list from
-- pg_constraint at run time, specifically so a hand-written list could not miss one. Its header
-- says so, approvingly. That was the right instinct against the wrong failure mode.
--
-- **A catalogue-driven sweep sees declared foreign keys. It does not see SOFT REFERENCES** --
-- columns that hold a gs_entities.id without any FK constraint declared. This database has plenty:
-- `organizations.gs_entity_id` (104,139 rows, the GrantScope <-> JusticeHub bridge),
-- `justice_funding.gs_entity_id`, `state_tenders.gs_entity_id`, `community_directory_orgs`,
-- `acnc_programs` and more. None of them were re-pointed, because none of them are foreign keys.
--
-- Found by accident while measuring product coupling for #306: `organizations` reported 104,139
-- rows carrying a gs_entity_id but only 104,136 resolving. Two of those three were already
-- dangling before today. One was not.
--
-- MEASURED BLAST RADIUS: 4 rows, in 3 tables.
--
--     community_directory_orgs.gs_entity_id    2
--     acnc_programs.gs_entity_id               1
--     organizations.gs_entity_id               1
--
-- Small, and only small by luck -- justice_funding.gs_entity_id is a soft reference over 157K rows
-- and simply happened to hold none of the 151 merged-away ids. The same merge against a different
-- 151 entities could have silently orphaned money rows.
--
-- WHY IT IS REPAIRABLE AT ALL: gs_entity_merge_map_20260821 was written as a PERMANENT TABLE
-- rather than a CTE, on the reasoning that it is "the only record of what merged into what, and
-- the thing anyone reversing this would need". That decision is what makes this fix possible
-- rather than a forensic exercise.
--
-- THE RULE FOR NEXT TIME. When merging or deleting entities, sweep BOTH:
--   1. declared foreign keys, from pg_constraint  (what the merge did)
--   2. soft references -- uuid columns named gs_entity_id / entity_id / canonical_entity_id with
--      no FK to the target, from information_schema  (what it missed)
-- Neither list is a superset of the other, which is the same shape as the measure_kind /
-- is_aggregate trap already documented in CLAUDE.md.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_soft_reference_repoint_20260821 (
  tbl text, col text, row_id text, old_entity_id uuid, new_entity_id uuid
);

INSERT INTO _backup_soft_reference_repoint_20260821
SELECT 'organizations', 'gs_entity_id', o.id::text, o.gs_entity_id, m.winner_id
  FROM organizations o JOIN gs_entity_merge_map_20260821 m ON m.loser_id = o.gs_entity_id;

INSERT INTO _backup_soft_reference_repoint_20260821
SELECT 'community_directory_orgs', 'gs_entity_id', c.id::text, c.gs_entity_id, m.winner_id
  FROM community_directory_orgs c JOIN gs_entity_merge_map_20260821 m ON m.loser_id = c.gs_entity_id;

INSERT INTO _backup_soft_reference_repoint_20260821
SELECT 'acnc_programs', 'gs_entity_id', a.id::text, a.gs_entity_id, m.winner_id
  FROM acnc_programs a JOIN gs_entity_merge_map_20260821 m ON m.loser_id = a.gs_entity_id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _backup_soft_reference_repoint_20260821;
  RAISE NOTICE 're-pointing % soft references broken by the merge', n;
  IF n NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'expected ~4 broken soft references, found % -- re-measure before repairing', n;
  END IF;
END $$;

UPDATE organizations o SET gs_entity_id = m.winner_id
  FROM gs_entity_merge_map_20260821 m WHERE m.loser_id = o.gs_entity_id;

UPDATE community_directory_orgs c SET gs_entity_id = m.winner_id
  FROM gs_entity_merge_map_20260821 m WHERE m.loser_id = c.gs_entity_id;

UPDATE acnc_programs a SET gs_entity_id = m.winner_id
  FROM gs_entity_merge_map_20260821 m WHERE m.loser_id = a.gs_entity_id;

-- Nothing may still point at a merged-away entity through these three columns.
DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM organizations o JOIN gs_entity_merge_map_20260821 m ON m.loser_id = o.gs_entity_id)
       + (SELECT count(*) FROM community_directory_orgs c JOIN gs_entity_merge_map_20260821 m ON m.loser_id = c.gs_entity_id)
       + (SELECT count(*) FROM acnc_programs a JOIN gs_entity_merge_map_20260821 m ON m.loser_id = a.gs_entity_id)
    INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION '% soft references still point at merged-away entities', n;
  END IF;
END $$;

COMMIT;

-- NOT repaired here, because it predates today and is a different question: 2 rows in
-- community_directory_orgs, 2 in organizations and 313 in acnc_programs were ALREADY dangling
-- before the merge, along with 88 in state_tenders. Those are older breakage and deserve their own
-- measurement rather than being swept into a repair of my own mistake.
--
-- Also NOT dangling despite appearing so to a naive heuristic: entity_identifiers.entity_id
-- (31,509) and ghl_contacts.canonical_entity_id (1,822) point at `canonical_entities`, a different
-- table entirely -- see the CLAUDE.md note that entity_identifiers is a CRM store and NOT the
-- graph crosswalk.
