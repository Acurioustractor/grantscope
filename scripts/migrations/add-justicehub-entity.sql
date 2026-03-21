-- Migration: Create JusticeHub entity, link contacts, create partner relationships
-- Date: 2026-03-19

BEGIN;

-- 1. Create JusticeHub entity
INSERT INTO gs_entities (
  id, gs_id, canonical_name, entity_type, sector, website, state,
  is_community_controlled, tags, description, confidence, source_datasets,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'AU-JH-001',
  'JusticeHub',
  'social_enterprise',
  'justice',
  'https://justicehub.com.au',
  'QLD',
  true,
  ARRAY['youth-justice', 'advocacy', 'evidence-platform', 'contained-campaign', 'alma', 'empathy-ledger'],
  'Justice infrastructure platform. CONTAINED touring campaign, ALMA evidence engine (876 verified interventions), Empathy Ledger story platform.',
  'verified',
  ARRAY['manual'],
  NOW(),
  NOW()
)
ON CONFLICT (gs_id) DO NOTHING;

-- 2. Add 'partners_with' to relationship_type constraint
ALTER TABLE gs_relationships DROP CONSTRAINT gs_relationships_relationship_type_check;
ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_relationship_type_check
  CHECK (relationship_type = ANY (ARRAY[
    'donation', 'contract', 'grant', 'directorship', 'ownership',
    'charity_link', 'program_funding', 'tax_record', 'registered_as',
    'listed_as', 'subsidiary_of', 'member_of', 'lobbies_for', 'partners_with'
  ]));

-- 3. Create partner relationships
-- JusticeHub -> Palm Island Community Company Limited
INSERT INTO gs_relationships (id, source_entity_id, target_entity_id, relationship_type, dataset, confidence, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
       '18fc2705-463c-4b27-8dbd-0ca79c640582',
       'partners_with', 'manual', 'verified', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001')
    AND target_entity_id = '18fc2705-463c-4b27-8dbd-0ca79c640582'
    AND relationship_type = 'partners_with'
);

-- JusticeHub -> Minderoo Foundation Limited
INSERT INTO gs_relationships (id, source_entity_id, target_entity_id, relationship_type, dataset, confidence, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
       '93262c8c-6473-4b21-8352-89c18c0caec8',
       'partners_with', 'manual', 'verified', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001')
    AND target_entity_id = '93262c8c-6473-4b21-8352-89c18c0caec8'
    AND relationship_type = 'partners_with'
);

-- JusticeHub -> The National Justice Project
INSERT INTO gs_relationships (id, source_entity_id, target_entity_id, relationship_type, dataset, confidence, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
       '25cb99c2-da3e-4e58-84a6-02214836a19b',
       'partners_with', 'manual', 'verified', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001')
    AND target_entity_id = '25cb99c2-da3e-4e58-84a6-02214836a19b'
    AND relationship_type = 'partners_with'
);

-- JusticeHub -> Dusseldorp Forum Incorporated
INSERT INTO gs_relationships (id, source_entity_id, target_entity_id, relationship_type, dataset, confidence, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
       '0be9dfd1-5dbc-46b8-b952-1988714ced99',
       'partners_with', 'manual', 'verified', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001')
    AND target_entity_id = '0be9dfd1-5dbc-46b8-b952-1988714ced99'
    AND relationship_type = 'partners_with'
);

-- JusticeHub -> Tim Fairfax Family Foundation
INSERT INTO gs_relationships (id, source_entity_id, target_entity_id, relationship_type, dataset, confidence, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
       '0fc1b770-73f2-43de-9db3-10c3a202d38b',
       'partners_with', 'manual', 'verified', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001')
    AND target_entity_id = '0fc1b770-73f2-43de-9db3-10c3a202d38b'
    AND relationship_type = 'partners_with'
);

-- 4. Link all JusticeHub-tagged ghl_contacts to the JusticeHub entity
INSERT INTO contact_entity_links (id, contact_id, entity_id, confidence_score, link_method, created_at, updated_at)
SELECT
  gen_random_uuid(),
  c.id,
  (SELECT id FROM gs_entities WHERE gs_id = 'AU-JH-001'),
  0.80,
  'manual',
  NOW(),
  NOW()
FROM ghl_contacts c
WHERE c.tags::text ILIKE '%justicehub%'
ON CONFLICT (contact_id, entity_id) DO NOTHING;

COMMIT;
