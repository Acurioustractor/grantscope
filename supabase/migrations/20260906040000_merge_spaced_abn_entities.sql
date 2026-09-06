-- Merge the five gs_entities whose gs_id carries a space-broken ABN into their correctly keyed twin.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260906040000_merge_spaced_abn_entities.sql   (Tier 3: Ben's verb)
--
-- Found 2026-09-06 while linking AusTender buyers by name: Griffith University resolved to three
-- entities, one of them `AU-ABN-78 106 094 461`. makeGsId strips whitespace today, so these five are
-- legacy rows from before that normalisation; nothing can mint another. Measured before writing:
--
--   loser gs_id             type     name                                       winner gs_id         winner type       edges
--   AU-ABN-66 673 126 160   company  n/a                                        AU-ABN-66673126160   charity           1
--   AU-ABN-78 106 094 461   company  Griffith University                        AU-ABN-78106094461   foundation        301
--   AU-ABN-72 110 028 825   company  Auscript Pty Ltd                           AU-ABN-72110028825   company           0
--   AU-ABN-26 297 449 486   company  Ngyangabarra Traditional Aboriginal Corp   AU-ABN-26297449486   indigenous_corp   1
--   AU-ABN-21 066 875 107   company  ACRO Australian Community Safety and Res   AU-ABN-21066875107   charity           15
--
-- Exactly ONE loser edge collides on idx_gs_rel_dedup with an edge the winner already holds; it is
-- backed up and deleted before the re-point rather than letting the UPDATE abort.
--
-- Same shape as 2026-08-21-gov-entity-merge.sql: a permanent map table, backups, every FK re-pointed
-- from the catalogue (never a hand-written list), a refusal if anything still references a loser,
-- then the delete. Reverse with the _backup_* tables and the map.

BEGIN;

DROP TABLE IF EXISTS gs_entity_merge_map_20260906;
CREATE TABLE gs_entity_merge_map_20260906 (
  loser_id     uuid PRIMARY KEY,
  winner_id    uuid NOT NULL,
  merge_class  text NOT NULL,
  loser_gs_id  text,
  winner_gs_id text,
  name         text
);

INSERT INTO gs_entity_merge_map_20260906 (loser_id, winner_id, merge_class, loser_gs_id, winner_gs_id, name)
SELECT d.id, w.id, 'spaced_abn_gs_id', d.gs_id, w.gs_id, d.canonical_name
  FROM gs_entities d
  JOIN gs_entities w ON w.gs_id = 'AU-ABN-' || replace(substr(d.gs_id, 8), ' ', '')
 WHERE d.gs_id LIKE 'AU-ABN-% %'
   AND d.id <> w.id;

DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM gs_entity_merge_map_20260906;
  IF n <> 5 THEN
    RAISE EXCEPTION 'expected 5 spaced-ABN losers, found % -- the table changed since this was measured, re-measure', n;
  END IF;
  IF EXISTS (SELECT 1 FROM gs_entity_merge_map_20260906 m WHERE EXISTS (SELECT 1 FROM gs_entity_merge_map_20260906 t WHERE t.loser_id = m.winner_id)) THEN
    RAISE EXCEPTION 'merge map chains -- refusing';
  END IF;
END $$;

-- ── Backups ──────────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS _backup_gs_entities_merge_20260906;
CREATE TABLE _backup_gs_entities_merge_20260906 AS
SELECT e.* FROM gs_entities e
 WHERE e.id IN (SELECT loser_id FROM gs_entity_merge_map_20260906)
    OR e.id IN (SELECT winner_id FROM gs_entity_merge_map_20260906);

DROP TABLE IF EXISTS _backup_gs_rel_merge_20260906;
CREATE TABLE _backup_gs_rel_merge_20260906 AS
SELECT r.* FROM gs_relationships r
 WHERE r.source_entity_id IN (SELECT loser_id FROM gs_entity_merge_map_20260906)
    OR r.target_entity_id IN (SELECT loser_id FROM gs_entity_merge_map_20260906);

-- ── Drop the loser edges the winner already holds (dedup collisions) ─────────────────────────
-- idx_gs_rel_dedup is (source, target, type, dataset, coalesce(source_record_id,'')). An edge that
-- would land on an identical winner edge is the same fact recorded twice; the winner's copy stays.
DELETE FROM gs_relationships r
 USING gs_entity_merge_map_20260906 m
 WHERE (r.source_entity_id = m.loser_id OR r.target_entity_id = m.loser_id)
   AND EXISTS (
     SELECT 1 FROM gs_relationships t
      WHERE t.source_entity_id = CASE WHEN r.source_entity_id = m.loser_id THEN m.winner_id ELSE r.source_entity_id END
        AND t.target_entity_id = CASE WHEN r.target_entity_id = m.loser_id THEN m.winner_id ELSE r.target_entity_id END
        AND t.relationship_type = r.relationship_type
        AND t.dataset = r.dataset
        AND coalesce(t.source_record_id, '') = coalesce(r.source_record_id, '')
        AND t.id <> r.id);

-- ── Re-point every foreign key, generated from the catalogue ─────────────────────────────────
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
      'UPDATE %s t SET %I = m.winner_id FROM gs_entity_merge_map_20260906 m WHERE m.loser_id = t.%I',
      r.tbl, r.col, r.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 're-pointed % rows in %.%', n, r.tbl, r.col;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'total rows re-pointed: %', total;
END $$;

-- Nothing may still reference a loser.
DO $$
DECLARE r record; n bigint; remaining bigint := 0;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'gs_entities'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s t JOIN gs_entity_merge_map_20260906 m ON m.loser_id = t.%I', r.tbl, r.col) INTO n;
    remaining := remaining + n;
  END LOOP;
  IF remaining <> 0 THEN
    RAISE EXCEPTION '% references to merged-away entities remain -- refusing to delete', remaining;
  END IF;
END $$;

DELETE FROM gs_entities e
 WHERE e.id IN (SELECT loser_id FROM gs_entity_merge_map_20260906);

COMMIT;

-- Verify after:
--   SELECT count(*) FROM gs_entities WHERE gs_id LIKE 'AU-ABN-% %';      -- 0
--   SELECT count(*) FROM gs_relationships r JOIN gs_entities e ON e.id = r.source_entity_id
--    WHERE e.gs_id = 'AU-ABN-78106094461';                               -- Griffith holds its 301 edges
