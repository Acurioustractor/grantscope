-- Fix ACT company identity after ASIC registration.
--
-- The old "A Curious Tractor Ventures Pty Ltd" placeholder was created before
-- the company existed and was linked both directions as subsidiary_of A KIND
-- TRACTOR LTD. ACT is now A CURIOUS TRACTOR PTY LTD, ACN 697 347 676.

BEGIN;

-- Replace the stale Ventures placeholder with the registered company record.
UPDATE gs_entities
SET
  canonical_name = 'A CURIOUS TRACTOR PTY LTD',
  entity_type = 'company',
  acn = '697347676',
  abn = NULL,
  gs_id = 'AU-ACN-697347676',
  sector = 'Civic Infrastructure',
  website = 'https://act.place',
  postcode = '4552',
  state = 'QLD',
  updated_at = NOW()
WHERE id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7';

-- ACT's organisation workspace should point at the operating company, not the
-- charity/foundation entity.
UPDATE org_profiles
SET
  abn = NULL,
  linked_gs_entity_id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7',
  updated_at = NOW()
WHERE slug = 'act';

-- Remove the duplicate/wrong subsidiary links between ACT and A KIND TRACTOR.
DELETE FROM gs_relationships
WHERE relationship_type = 'subsidiary_of'
  AND dataset = 'manual'
  AND (
    (source_entity_id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7' AND target_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13')
    OR
    (source_entity_id = '0f4a9330-4147-4540-b710-a8fb110e2a13' AND target_entity_id = '7ff9f2e8-f6b7-46a4-851b-6e25483790f7')
  );

-- Keep identifier lookup current for the company.
INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source)
VALUES (
  '7ff9f2e8-f6b7-46a4-851b-6e25483790f7',
  'AU-ACN-697347676',
  'A CURIOUS TRACTOR PTY LTD',
  'ACN',
  '697347676',
  'asic'
)
ON CONFLICT DO NOTHING;

COMMIT;
