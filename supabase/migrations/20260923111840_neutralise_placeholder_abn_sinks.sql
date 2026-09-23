-- Take real-looking names off six entities that hold other people's money under a placeholder ABN.
--
-- AusTender and the AEC write placeholders into the ABN field when a supplier or donor has none:
-- 'Exempt-NonAustralianEntity', 'Exempt-InsufficientTurnover', 'ABNNotKnown/Provided', '0'. Before
-- the 11-digit guard in build-entity-graph.mjs, each placeholder became ONE gs_entities row, named
-- after whichever supplier happened to come first. Every other supplier carrying the same
-- placeholder was then summed onto that name. Measured 2026-09-23:
--
--   gs_id                               shown as                        names behind it   money
--   AU-ABN-Exempt-NonAustralianEntity   Michael John Hayter             122 suppliers     $1,297.2m (288 contracts)
--   AU-ABN-ABNNotKnown/Provided         Novacare Solutions Pty Ltd        4 suppliers       $763.8m
--   AU-ABN-Exempt-InsufficientTurnover  Karen Mary Knight                44 suppliers        $59.9m
--   AU-ABN-Exempt-Other                 C & A Papandreas                 34 suppliers        $33.7m
--   AU-ABN-Notassigne                   SYNCFUSION INC                    2 suppliers         $0.1m
--   AU-ABN-0                            112 Trenerry Crescent Pty Ltd   749 donors (edges removed by 20260922230000)
--
-- The Hayter row was public at /entity/AU-ABN-Exempt-NonAustralianEntity and was the first search
-- hit for his name, credited with $1.3bn. Two of these names are private individuals.
--
-- What this does, for those six rows only:
--   1. copies each entity row to gs_entities_neutralised_20260923 and each of its 234 edges to
--      gs_relationships_deleted_20260923, so all of it can be restored;
--   2. deletes the 234 edges (181 + 45 + 3 austender, 5 lobbying_register_nsw);
--   3. sets abn = NULL, so mv_entity_total_funding and mv_entity_power_index (both join on
--      gs_entities.abn) stop summing placeholder contracts onto the row at their next refresh;
--   4. renames the row to what it is, 'Unidentified (ABN recorded as "<placeholder>")', and keeps the
--      former name and ABN in metadata;
--   5. corrects the same six rows in entity_xref now (refresh-entity-xref.mjs rebuilds it anyway).
--
-- NOT touched: the entity rows are kept (35 tables hold FKs to gs_entities); the austender_contracts
-- and political_donations rows are kept, since they are the source record. Also left alone: 18 other
-- entities with a malformed identifier (truncated numbers, joint-supplier lists, 'Notapplicable' on
-- Atlassian). Each is ONE organisation under its own name, so nobody is misnamed; check-graph-
-- attribution.mjs still reports them as SINKs.
--
-- Asked for by Ben 2026-09-23 ("fix the sinks").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260923111840_neutralise_placeholder_abn_sinks.sql
-- Then refresh, so the names and money leave search before the nightly run:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_total_funding;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_index;
-- Undo: restore edges from gs_relationships_deleted_20260923 (same columns plus delete_reason);
--   restore canonical_name, abn and metadata from gs_entities_neutralised_20260923 by id.

BEGIN;
SET LOCAL statement_timeout = 0;

CREATE TEMP TABLE sink_nodes ON COMMIT DROP AS
SELECT id FROM gs_entities
 WHERE gs_id IN ('AU-ABN-Exempt-NonAustralianEntity', 'AU-ABN-ABNNotKnown/Provided',
                 'AU-ABN-Exempt-InsufficientTurnover', 'AU-ABN-Exempt-Other',
                 'AU-ABN-Notassigne', 'AU-ABN-0')
   AND abn IS NOT NULL AND abn !~ '^[0-9]{11}$';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sink_nodes;
  IF n <> 6 THEN RAISE EXCEPTION 'expected 6 placeholder entities, found %', n; END IF;
END $$;

CREATE TABLE gs_entities_neutralised_20260923 AS
SELECT e.id, e.gs_id, e.canonical_name, e.abn, e.metadata, now() AS neutralised_at
  FROM gs_entities e
 WHERE e.id IN (SELECT id FROM sink_nodes);
ALTER TABLE gs_entities_neutralised_20260923 ADD PRIMARY KEY (id);
ALTER TABLE gs_entities_neutralised_20260923 ENABLE ROW LEVEL SECURITY;

CREATE TABLE gs_relationships_deleted_20260923 AS
SELECT r.*, 'placeholder_abn_sink'::text AS delete_reason
  FROM gs_relationships r
 WHERE r.source_entity_id IN (SELECT id FROM sink_nodes)
    OR r.target_entity_id IN (SELECT id FROM sink_nodes);
ALTER TABLE gs_relationships_deleted_20260923 ADD PRIMARY KEY (id);
ALTER TABLE gs_relationships_deleted_20260923 ENABLE ROW LEVEL SECURITY;

DELETE FROM gs_relationships r
 USING gs_relationships_deleted_20260923 d
 WHERE r.id = d.id;

-- SET expressions read the row's OLD values, so e.abn and e.canonical_name below are the originals.
UPDATE gs_entities e
   SET canonical_name = 'Unidentified (ABN recorded as "' || e.abn || '")',
       abn = NULL,
       metadata = coalesce(e.metadata, '{}'::jsonb)
                  || jsonb_build_object('placeholder_abn', e.abn,
                                        'former_name', e.canonical_name,
                                        'neutralised_on', '2026-09-23',
                                        'why', 'placeholder ABN shared by many suppliers or donors')
 WHERE e.id IN (SELECT id FROM sink_nodes);

DELETE FROM entity_xref
 WHERE entity_id IN (SELECT id FROM sink_nodes) AND identifier_type = 'ABN';
UPDATE entity_xref x
   SET canonical_name = e.canonical_name
  FROM gs_entities e
 WHERE e.id = x.entity_id AND x.entity_id IN (SELECT id FROM sink_nodes);

INSERT INTO schema_ownership (object, owner, evidence, declared_on) VALUES
  ('gs_entities_neutralised_20260923', 'grantscope',
   'backup of the 6 placeholder-ABN entity rows before 20260923111840; restore source, no readers', '2026-09-23'),
  ('gs_relationships_deleted_20260923', 'grantscope',
   'backup of the 234 edges deleted by 20260923111840; restore source, no readers', '2026-09-23');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_relationships_deleted_20260923;
  IF n NOT BETWEEN 225 AND 245 THEN RAISE EXCEPTION 'expected ~234 edges to delete, found %', n; END IF;
  SELECT count(*) INTO n FROM gs_relationships r
   WHERE r.source_entity_id IN (SELECT id FROM sink_nodes) OR r.target_entity_id IN (SELECT id FROM sink_nodes);
  IF n > 0 THEN RAISE EXCEPTION '% edges remain on placeholder entities', n; END IF;
  SELECT count(*) INTO n FROM gs_entities
   WHERE abn IN ('Exempt-NonAustralianEntity', 'ABNNotKnown/Provided', 'Exempt-InsufficientTurnover',
                 'Exempt-Other', 'Notassigne', '0');
  IF n > 0 THEN RAISE EXCEPTION '% entities still carry a placeholder ABN', n; END IF;
  SELECT count(*) INTO n FROM entity_xref
   WHERE entity_id IN (SELECT id FROM sink_nodes)
     AND (identifier_type = 'ABN' OR canonical_name NOT LIKE 'Unidentified (ABN recorded as %');
  IF n > 0 THEN RAISE EXCEPTION '% entity_xref rows still carry the old name or ABN', n; END IF;
END $$;

COMMIT;
