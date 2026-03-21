-- Fix ACT entity data in CivicGraph
-- Issues:
--   1. Phantom entity "A Curious Tractor Foundation CLG" (AU-ABN-88671625498) has wrong ABN
--   2. Real charity is "A KIND TRACTOR LTD" (AU-ABN-73669029341)
--   3. org_profiles.abn set to PICC's ABN instead of AKT's
--   4. org_profiles.linked_gs_entity_id is null
--   5. "A Curious Tractor Ventures Pty Ltd" entity needs ABN when registered

BEGIN;

-- Step 1: Move relationships from phantom entity to real AKT entity
-- Source: A Curious Tractor Foundation CLG (16ce2876-f6e6-4592-ab88-38077193c335)
-- Target: A KIND TRACTOR LTD (0f4a9330-4147-4540-b710-a8fb110e2a13)

UPDATE gs_relationships
SET source_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13'
WHERE source_entity_id = '16ce2876-f6e6-4592-ab88-38077193c335';

UPDATE gs_relationships
SET target_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13'
WHERE target_entity_id = '16ce2876-f6e6-4592-ab88-38077193c335';

-- Step 2: Delete phantom entity
DELETE FROM gs_entities WHERE id = '16ce2876-f6e6-4592-ab88-38077193c335';

-- Step 3: Update AKT entity with correct details
UPDATE gs_entities SET
  canonical_name = 'A Kind Tractor LTD',
  entity_type = 'charity',
  sector = 'Technology & Innovation',
  website = 'https://akindtractor.org',
  postcode = '4552',
  state = 'QLD'
WHERE id = '0f4a9330-4147-4540-b710-a8fb110e2a13';

-- Step 4: Update ACT Ventures entity
UPDATE gs_entities SET
  canonical_name = 'A Curious Tractor Ventures Pty Ltd',
  entity_type = 'social_enterprise',
  sector = 'Technology & Innovation',
  website = 'https://act.place',
  postcode = '4552',
  state = 'QLD'
WHERE id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7';

-- Step 5: Fix org_profiles — correct ABN and link entity
UPDATE org_profiles SET
  abn = '73669029341',
  linked_gs_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13',
  annual_revenue = 350000,
  updated_at = NOW()
WHERE slug = 'act';

-- Step 6: Add subsidiary relationship: AKT <- ACT Ventures (if not exists)
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, dataset)
SELECT '7ff9f2e8-f6b7-46a4-851b-6e25483790f7', '0f4a9330-4147-4540-b710-a8fb110e2a13', 'subsidiary_of', 'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7'
    AND target_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13'
    AND relationship_type = 'subsidiary_of'
);

COMMIT;
