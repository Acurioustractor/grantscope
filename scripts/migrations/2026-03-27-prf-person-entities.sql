-- PRF Person Entity Creation + Linking
-- Creates person entities for 6 new staff, links all 18 person_roles to gs_entities

BEGIN;

-- ============================================================
-- 1. CREATE MISSING PERSON ENTITIES (6 new)
-- ============================================================

INSERT INTO gs_entities (gs_id, canonical_name, entity_type, sector, confidence, state)
VALUES
  ('GS-PERSON-chris-last', 'Chris Last', 'person', 'individual', 'verified', 'NSW'),
  ('GS-PERSON-alex-martin', 'Alex Martin', 'person', 'individual', 'verified', 'NSW'),
  ('GS-PERSON-ben-gales', 'Ben Gales', 'person', 'individual', 'verified', 'NSW'),
  ('GS-PERSON-liz-yeo', 'Liz Yeo', 'person', 'individual', 'verified', 'NSW'),
  ('GS-PERSON-brian-graetz', 'Brian Graetz', 'person', 'individual', 'verified', 'NSW'),
  ('GS-PERSON-suzie-warrick', 'Suzie Warrick', 'person', 'individual', 'verified', 'NSW')
ON CONFLICT (gs_id) DO NOTHING;

-- ============================================================
-- 2. CREATE DIRECTORSHIP EDGES for new person entities → PRF
-- ============================================================

INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, dataset, confidence)
SELECT ge.id, '92edb50b-b111-45a8-b697-0354410b2d2d', 'directorship', 'web_research', 'verified'
FROM gs_entities ge
WHERE ge.gs_id IN ('GS-PERSON-chris-last','GS-PERSON-alex-martin','GS-PERSON-ben-gales','GS-PERSON-liz-yeo','GS-PERSON-brian-graetz','GS-PERSON-suzie-warrick')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. LINK person_roles.person_entity_id to gs_entities
-- ============================================================

-- Board directors (already have person entities from mega-linker)
UPDATE person_roles SET person_entity_id = '75fc99a6-1a6a-47bc-ba9f-3fb9ab04c3eb'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'MICHAEL TRAILL';

UPDATE person_roles SET person_entity_id = '9c52d2ea-f37e-4c56-8485-6e0790455273'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'CHARLOTTE SIDDLE';

UPDATE person_roles SET person_entity_id = 'b0874cb7-4b7d-42e3-8831-4e8ad1e1d029'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'DAVID COHEN';

UPDATE person_roles SET person_entity_id = 'aaaba919-8da6-4031-8a9d-301fae892b15'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'ILANA ATLAS';

UPDATE person_roles SET person_entity_id = '55f5e64b-f540-4543-884a-2d8a92c6dc69'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'JULIA DAVISON';

UPDATE person_roles SET person_entity_id = '0efb4a0d-66df-4137-b46f-dba88c8f703e'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'KATHRYN GREINER';

UPDATE person_roles SET person_entity_id = '8a37bfcc-c170-4403-b38e-6330b379821b'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'NATALIE WALKER';

UPDATE person_roles SET person_entity_id = '0ab33615-e3a3-435f-b545-1ab8072d5ae2'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'PETER EVANS';

UPDATE person_roles SET person_entity_id = '5e4cecdd-79b9-47fe-bb71-45d8bd52e912'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'SIMON WILLIAM ENGLISH';

-- CEO
UPDATE person_roles SET person_entity_id = '45855810-c70e-4daf-8ce0-5c9dd5257123'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'KRISTY MUIR';

-- Executives + staff (new entities — use subquery to get their IDs)
UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-chris-last')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'CHRIS LAST';

UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-alex-martin')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'ALEX MARTIN';

UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-ben-gales')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'BEN GALES';

UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-liz-yeo')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'LIZ YEO';

UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-brian-graetz')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'BRIAN GRAETZ';

UPDATE person_roles SET person_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-PERSON-suzie-warrick')
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'SUZIE WARRICK';

-- Ben Smith + Ian Trust already exist
UPDATE person_roles SET person_entity_id = '5b96dea2-a15c-47da-839a-9415640cdbd7'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'BEN SMITH';

UPDATE person_roles SET person_entity_id = 'b268b56f-9751-4967-97ae-1809edb9bdfa'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' AND person_name_normalised = 'IAN TRUST';

COMMIT;
