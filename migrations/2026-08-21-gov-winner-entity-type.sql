-- The merged-into government entities are typed 'company'. #324, follow-up to the merge.
--
-- APPLIED 2026-08-21 to tednluwflfhxyucgwigh, on Ben's explicit authorization.
--   UPDATE 112 (115 map rows matched; 3 winners are shared by two losers each).
--   Verified after: 0 mistyped winners remain, and the resolver simulation against the 487 real
--   AusTender buyers goes 486 reuse / 96 of them an ABN identity / 0 ambiguous / 1 mint new,
--   against 393 / 4 / 0 / 94 before. A scheduled graph build is now safe.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-21-gov-winner-entity-type.sql
--
-- FOUND BY SIMULATING THE RESOLVER FIX RATHER THAN TRUSTING IT.
--
-- The merge (2026-08-21-gov-entity-merge.sql) sent 119 AU-GOV entities into their ABN-keyed twins.
-- 112 of those 119 WINNERS are typed 'company', 3 'charity', 1 'foundation' — only 4 are
-- 'government_body'. They arrived through ABN registers, which type everything as a company.
--
-- They are not companies. A sample of the 112:
--
--   Administrative Appeals Tribunal          Australian Bureau of Statistics
--   Australian Competition and Consumer      Australian Communications and Media Authority
--   Ambulance Service of NSW                 Ambulance Victoria
--   Australian Centre for the Moving Image   Australian Commission for Law Enforcement Integrity
--
-- WHY IT MATTERS BEYOND TIDINESS. The resolver fix in build-entity-graph.mjs looks an existing
-- government identity up by name before minting a new one, and its candidate set is
-- `entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%'`. With these 112 typed 'company' they
-- fall outside it, so the next graph build would mint fresh AU-GOV entities for them and
-- RE-CREATE CLASS A ALMOST IN FULL — undoing the merge that ran an hour earlier.
--
-- Simulated against the 487 AusTender buyers before this fix: 393 reuse an existing identity but
-- only 4 reuse an ABN identity, against 119 that should. That gap is the defect.
--
-- Fixing the type is the honest fix rather than widening the resolver's filter to "any entity with
-- this name", which would let an unrelated company with a colliding name capture a government
-- buyer. The type was simply wrong.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_gov_winner_type_20260821 AS
SELECT id, gs_id, canonical_name, entity_type
  FROM gs_entities
 WHERE id IN (SELECT winner_id FROM gs_entity_merge_map_20260821 WHERE merge_class = 'A_gov_to_abn');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM gs_entities e
    JOIN gs_entity_merge_map_20260821 m ON m.winner_id = e.id
   WHERE m.merge_class = 'A_gov_to_abn' AND e.entity_type <> 'government_body';
  IF n NOT BETWEEN 100 AND 125 THEN
    RAISE EXCEPTION 'expected ~115 mistyped merge winners, found %. Re-measure first.', n;
  END IF;
  RAISE NOTICE 'retyping % merge winners to government_body', n;
END $$;

UPDATE gs_entities e
   SET entity_type = 'government_body'
  FROM gs_entity_merge_map_20260821 m
 WHERE m.winner_id = e.id
   AND m.merge_class = 'A_gov_to_abn'
   AND e.entity_type <> 'government_body';

COMMIT;

-- After this, the resolver's lookup sees all 119 and reuses them instead of minting. Verify with
-- the buyer simulation in the PR before running a graph build.
