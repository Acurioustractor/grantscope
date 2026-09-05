-- Merge duplicate government entities. #324 step 2.
--
-- APPLIED 2026-08-21 to tednluwflfhxyucgwigh, on Ben's explicit authorization.
--   Identical to the dry run: 131,699 rows re-pointed across 11 FK columns, DELETE 151,
--   no constraint violations. Verified after: 0 duplicate government names remain, the
--   Department of Defence is a single entity, self-loops 1,088 -> 1,090 as predicted.
--
--   FOLLOW-UP FOUND IMMEDIATELY AFTER, see migrations/2026-08-21-gov-winner-entity-type.sql:
--   112 of the 119 class A WINNERS are typed 'company' because they arrived through ABN
--   registers. The resolver fix looks up existing government identities by name within
--   `government_body OR AU-GOV-*`, so those 112 fall outside it and a graph build would
--   RE-CREATE class A in full. DO NOT RUN A GRAPH BUILD until that migration is applied.
--
-- DRY-RUN 2026-08-21 against production, identical file with COMMIT swapped for ROLLBACK, so every
-- statement ran and nothing was kept:
--
--   merge map: 119 class A, 32 class B          (151 entities merged away)
--   re-pointed 129,325 rows  gs_relationships.source_entity_id
--   re-pointed   2,044 rows  gs_relationships.target_entity_id
--   re-pointed     275 rows  grantconnect_awards.gs_entity_id
--   re-pointed      21 rows  civicscope_act_entity_bridge.gs_entity_id
--   re-pointed      13 rows  person_entity_links.entity_id
--   re-pointed       7 rows  foundation_grantees.grantee_entity_id
--   re-pointed       6 rows  research_grants.gs_entity_id
--   re-pointed       3 rows  alma_interventions.gs_entity_id
--   re-pointed       2 rows  name_aliases.canonical_entity_id
--   re-pointed       2 rows  ndis_registered_providers.gs_entity_id
--   re-pointed       1 row   vic_grants_awarded.gs_entity_id
--   total 131,699 rows re-pointed, DELETE 151, no constraint violations, ROLLBACK.
--
-- Class B is 32 rather than the 37 the design predicted: 5 of those losers are ALSO class A
-- losers, and class A wins (it sends them to a real ABN identity rather than another buyer_id
-- hash). The map is PRIMARY KEY'd on loser_id, so without that exclusion the insert would abort
-- rather than silently pick one -- which is why the exclusion is explicit and not incidental.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-21-gov-entity-merge.sql
--
-- Design and the simulation behind every number here:
--   thoughts/shared/plans/2026-08-21-gov-entity-merge-design.md
--
-- WHAT IS BEING MERGED. Two classes, and the second is the larger:
--
--   CLASS A -- AU-GOV <-> AU-ABN, the same body under two identifier schemes.
--     122 pairs, 119 of them with exactly one ABN candidate. 130,963 edges on the AU-GOV side.
--     Survivor: the ABN entity. An ABN is a real identifier; a buyer_id hash is an artefact of
--     one source system. This is #324 step 1 and is not in doubt.
--     The 3 AMBIGUOUS pairs (more than one ABN entity shares the name) are REFUSED, not guessed.
--
--   CLASS B -- AU-GOV <-> AU-GOV, the same body minted twice under different buyer_id hashes.
--     36 duplicate names, 73 entities, 37 losers. This class contains the DEPARTMENT OF DEFENCE
--     (two rows, one carrying ABN 68706814312 and one carrying none, with no AU-ABN row existing
--     at all) and with it 271,521 edges -- more than twice the whole of class A.
--     Survivor, in order: the copy with a valid ABN if exactly one has it; else the copy with the
--     most edges; else the lowest id, purely for determinism.
--     33 of the 36 names carry NO ABN on any copy, which is why "the ABN wins" cannot be the
--     whole rule here.
--
-- THREE THINGS THAT WERE FEARED AND MEASURED FALSE (simulated 2026-08-21):
--
--   1. No dedupe collisions. idx_gs_rel_dedup includes source_record_id and the two identities'
--      edges come from different source records: zero duplicate keys in either class. The merge
--      needs no dedupe logic. The unique index is still left to enforce it -- if this assumption
--      is ever wrong the transaction aborts, which is the correct outcome.
--   2. No collision with gs_relationships_no_judged_selfloops (added in #315 the day before).
--      Merging identities turns edges between them into self-loops: class A creates 2, class B
--      creates 0, and both are in `austender`, which that constraint deliberately does not cover.
--      Self-loops go 1,088 -> 1,090.
--   3. The blast radius is small outside gs_relationships. 34 FK columns reference gs_entities.id;
--      11 across 10 tables actually hold affected rows, and the entire tail outside
--      gs_relationships is 326 rows.
--
-- The FK updates below are GENERATED FROM pg_constraint AT RUN TIME rather than hard-coded, so a
-- foreign key added between the writing of this file and its application cannot be silently
-- skipped. That is the failure mode a hand-written list has.
--
-- WHAT THIS DOES NOT FIX. The austender self-loops (614 rows, $823.04M) are a different defect --
-- AusTender notices carrying a supplier_abn equal to the buyer's own ABN across 138 real supplier
-- names (#315 class B). Defence showing 82% of its inbound money as itself does NOT clear here.
-- It waits on the supplier-ABN repair, which #324 was masking.

BEGIN;

-- ── The map, as a permanent auditable table ──────────────────────────────────────────────────
-- A real table, not a CTE: after this runs it is the only record of what was merged into what,
-- and the thing anyone reversing this would need.
DROP TABLE IF EXISTS gs_entity_merge_map_20260821;
CREATE TABLE gs_entity_merge_map_20260821 (
  loser_id     uuid PRIMARY KEY,
  winner_id    uuid NOT NULL,
  merge_class  text NOT NULL,
  loser_gs_id  text,
  winner_gs_id text,
  name         text
);

-- Class A: AU-GOV loser, AU-ABN winner, unambiguous only.
INSERT INTO gs_entity_merge_map_20260821 (loser_id, winner_id, merge_class, loser_gs_id, winner_gs_id, name)
WITH gov AS (
  SELECT id, gs_id, canonical_name, lower(btrim(canonical_name)) k
    FROM gs_entities WHERE gs_id LIKE 'AU-GOV-%'
),
abn AS (
  SELECT id, gs_id, canonical_name, lower(btrim(canonical_name)) k
    FROM gs_entities WHERE gs_id LIKE 'AU-ABN-%'
),
candidates AS (SELECT k, count(*) AS n FROM abn GROUP BY k)
SELECT g.id, a.id, 'A_gov_to_abn', g.gs_id, a.gs_id, g.canonical_name
  FROM gov g
  JOIN abn a ON a.k = g.k
  JOIN candidates c ON c.k = g.k
 WHERE c.n = 1;   -- the 3 ambiguous names are refused here, deliberately

-- Class B: within AU-GOV, same name. Survivor = has-ABN, then most edges, then lowest id.
INSERT INTO gs_entity_merge_map_20260821 (loser_id, winner_id, merge_class, loser_gs_id, winner_gs_id, name)
WITH g AS (
  SELECT id, gs_id, canonical_name, abn, lower(btrim(canonical_name)) k
    FROM gs_entities WHERE gs_id LIKE 'AU-GOV-%'
),
dup AS (SELECT k FROM g GROUP BY k HAVING count(*) > 1),
scored AS (
  SELECT g.*, (SELECT count(*) FROM gs_relationships r
                WHERE r.source_entity_id = g.id OR r.target_entity_id = g.id) AS edges
    FROM g JOIN dup ON dup.k = g.k
),
winner AS (
  SELECT DISTINCT ON (k) k, id, gs_id
    FROM scored
   ORDER BY k, (abn IS NOT NULL) DESC, edges DESC, id
)
SELECT s.id, w.id, 'B_gov_to_gov', s.gs_id, w.gs_id, s.canonical_name
  FROM scored s JOIN winner w ON w.k = s.k
 WHERE s.id <> w.id
   -- A class A loser must not also be a class B loser: class A already sends it to an ABN entity,
   -- and two rows in a PRIMARY KEY'd map would abort. Class A wins.
   AND NOT EXISTS (SELECT 1 FROM gs_entity_merge_map_20260821 m WHERE m.loser_id = s.id);

-- A winner must never itself be a loser, or the merge chains and the order decides the answer.
-- Re-point any such winner to its own ultimate destination before touching data.
UPDATE gs_entity_merge_map_20260821 m
   SET winner_id = t.winner_id
  FROM gs_entity_merge_map_20260821 t
 WHERE t.loser_id = m.winner_id;

DO $$
DECLARE n_a int; n_b int; n_chain int;
BEGIN
  SELECT count(*) INTO n_a FROM gs_entity_merge_map_20260821 WHERE merge_class = 'A_gov_to_abn';
  SELECT count(*) INTO n_b FROM gs_entity_merge_map_20260821 WHERE merge_class = 'B_gov_to_gov';
  SELECT count(*) INTO n_chain FROM gs_entity_merge_map_20260821 m
    WHERE EXISTS (SELECT 1 FROM gs_entity_merge_map_20260821 t WHERE t.loser_id = m.winner_id);
  RAISE NOTICE 'merge map: % class A, % class B', n_a, n_b;
  IF n_a NOT BETWEEN 110 AND 130 THEN
    RAISE EXCEPTION 'expected ~119 class A merges, found %. Re-measure before merging.', n_a;
  END IF;
  IF n_b NOT BETWEEN 30 AND 45 THEN
    RAISE EXCEPTION 'expected ~37 class B merges, found %. Re-measure before merging.', n_b;
  END IF;
  IF n_chain <> 0 THEN
    RAISE EXCEPTION 'merge map still chains after flattening (% rows) -- refusing to guess order', n_chain;
  END IF;
END $$;

-- ── Backups ──────────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS _backup_gs_entities_merge_20260821;
CREATE TABLE _backup_gs_entities_merge_20260821 AS
SELECT e.* FROM gs_entities e
 WHERE e.id IN (SELECT loser_id FROM gs_entity_merge_map_20260821)
    OR e.id IN (SELECT winner_id FROM gs_entity_merge_map_20260821);

DROP TABLE IF EXISTS _backup_gs_rel_merge_20260821;
CREATE TABLE _backup_gs_rel_merge_20260821 AS
SELECT r.* FROM gs_relationships r
 WHERE r.source_entity_id IN (SELECT loser_id FROM gs_entity_merge_map_20260821)
    OR r.target_entity_id IN (SELECT loser_id FROM gs_entity_merge_map_20260821);

-- ── Re-point every foreign key, generated from the catalogue ─────────────────────────────────
-- Not a hand-written list: a FK added since this file was written would be missed by one, and the
-- rows would then block the delete or cascade unnoticed.
DO $$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'gs_entities'::regclass
     ORDER BY 1, 2
  LOOP
    EXECUTE format(
      'UPDATE %s t SET %I = m.winner_id FROM gs_entity_merge_map_20260821 m WHERE m.loser_id = t.%I',
      r.tbl, r.col, r.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 're-pointed % rows in %.%', n, r.tbl, r.col;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'total rows re-pointed: %', total;
END $$;

-- Nothing may still reference a loser. If anything does, a FK was added without a catalogue entry
-- (or the loop failed silently) and deleting would cascade or abort -- either way, stop here.
DO $$
DECLARE r record; n bigint; remaining bigint := 0;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'gs_entities'::regclass
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN gs_entity_merge_map_20260821 m ON m.loser_id = t.%I',
      r.tbl, r.col) INTO n;
    IF n > 0 THEN
      RAISE WARNING '%.% still references % losers', r.tbl, r.col, n;
      remaining := remaining + n;
    END IF;
  END LOOP;
  IF remaining > 0 THEN
    RAISE EXCEPTION '% references to merged-away entities remain -- refusing to delete', remaining;
  END IF;
END $$;

DELETE FROM gs_entities e
 WHERE e.id IN (SELECT loser_id FROM gs_entity_merge_map_20260821);

COMMIT;

-- ── After this, in order ─────────────────────────────────────────────────────────────────────
--
-- 1. THE RESOLVER FIX, and not before. scripts/build-entity-graph.mjs:351 mints government bodies
--    as makeGsId({ buyer_id }) with no ABN looked up, which is what created class A. Until it is
--    fixed the next graph build re-creates the duplicates this migration just removed. Build a
--    buyer_id -> ABN map and pass the ABN; makeGsId already prefers a valid ABN, so gs-id.mjs
--    itself needs no change.
--
-- 2. REFRESH mv_entity_power_index AND mv_revolving_door DELIBERATELY. Both are keyed on entity
--    identity and currently split these organisations across two rows, understating both. Per
--    #314 a refresh folds in unrelated backlog at the same moment, so do it as its own step and
--    say so when reporting any figure delta.
--
-- 3. The 3 refused ambiguous class A pairs stay unmerged, on the record, in #324.
