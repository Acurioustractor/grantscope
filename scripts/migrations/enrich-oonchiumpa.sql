-- Enrich Oonchiumpa entity in CivicGraph
-- ABN: 53 658 668 627 | Active from 08 Apr 2022
-- Based in Alice Springs, NT

BEGIN;

-- 1. Update the main entity with proper details
UPDATE gs_entities
SET
  canonical_name = 'Oonchiumpa Consultancy & Services',
  entity_type = 'indigenous_corp',
  sector = 'community',
  sub_sector = 'youth-justice',
  description = 'Aboriginal-led youth services organisation in Alice Springs (Mparntwe), NT. Founded by Kristy Bloomfield and Tanya Turner. Delivers on-country programs, cultural camps, and youth justice diversion at At Napa station. Projects include on-country cultural programs for young people (including those in contact with youth justice system), screen printing and plastics recycling enterprise, and the Oonchiumpa House supportive accommodation concept. Partners with A Curious Tractor Foundation on goods/enterprise projects. Funded by NIAA and Snow Foundation.',
  tags = ARRAY['youth-justice', 'indigenous', 'on-country', 'social-enterprise', 'diversion', 'cultural-connection', 'community-led'],
  is_community_controlled = true,
  website = 'https://oonchiumpa.com.au',
  state = 'NT',
  postcode = '0870',
  remoteness = 'Remote Australia',
  lga_name = 'Alice Springs',
  updated_at = NOW()
WHERE abn = '53658668627';

-- 2. Merge the ALMA-created duplicate into the main entity
-- First, update any ALMA interventions pointing to the old entity
UPDATE alma_interventions
SET gs_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
WHERE gs_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-ALMA-1773796261790-bji4');

-- Move any relationships from the duplicate
UPDATE gs_relationships
SET source_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
WHERE source_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-ALMA-1773796261790-bji4');

UPDATE gs_relationships
SET target_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
WHERE target_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-ALMA-1773796261790-bji4');

-- Move any entity_identifiers from the duplicate
UPDATE entity_identifiers
SET entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
WHERE entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'GS-ALMA-1773796261790-bji4');

-- Delete the duplicate
DELETE FROM gs_entities WHERE gs_id = 'GS-ALMA-1773796261790-bji4';

-- 3. Add relationship: Snow Foundation → Oonchiumpa (funder, $100K committed)
INSERT INTO gs_relationships (
  id, source_entity_id, target_entity_id, relationship_type,
  amount, currency, year, dataset, confidence, first_seen, last_seen, created_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM gs_entities WHERE abn = '49411415493'), -- Snow Foundation
  (SELECT id FROM gs_entities WHERE abn = '53658668627'), -- Oonchiumpa
  'grant',
  100000, 'AUD', 2026,
  'manual', 'reported',
  NOW(), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE abn = '49411415493')
    AND target_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
    AND relationship_type = 'funder'
);

-- 4. Add relationship: A Curious Tractor Foundation → Oonchiumpa (partner)
INSERT INTO gs_relationships (
  id, source_entity_id, target_entity_id, relationship_type,
  dataset, confidence, first_seen, last_seen, created_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM gs_entities WHERE abn = '88671625498'), -- A Curious Tractor Foundation
  (SELECT id FROM gs_entities WHERE abn = '53658668627'), -- Oonchiumpa
  'partners_with',
  'manual', 'reported',
  NOW(), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM gs_relationships
  WHERE source_entity_id = (SELECT id FROM gs_entities WHERE abn = '88671625498')
    AND target_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
    AND relationship_type = 'partners_with'
);

-- 5. Add relationship: NIAA → Oonchiumpa (funder — salary positions)
INSERT INTO gs_relationships (
  id, source_entity_id, target_entity_id, relationship_type,
  dataset, confidence, first_seen, last_seen, created_at
)
SELECT
  gen_random_uuid(),
  niaa.id,
  (SELECT id FROM gs_entities WHERE abn = '53658668627'),
  'grant',
  'manual', 'reported',
  NOW(), NOW(), NOW()
FROM gs_entities niaa
WHERE niaa.canonical_name ILIKE '%National Indigenous Australians Agency%'
  AND NOT EXISTS (
    SELECT 1 FROM gs_relationships
    WHERE source_entity_id = niaa.id
      AND target_entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
      AND relationship_type = 'grant'
  )
LIMIT 1;

-- 6. Link contacts to entity via contact_entity_links
-- Kristy Bloomfield (GHL: 0kEs9BJmkmi7ZUc5haEX)
INSERT INTO contact_entity_links (id, contact_id, entity_id, confidence_score, link_method, link_evidence, created_at)
SELECT
  gen_random_uuid(),
  '36517c81-abfb-4875-ba79-2a6ffcdbb8ac'::uuid,
  (SELECT id FROM gs_entities WHERE abn = '53658668627'),
  0.95,
  'manual',
  '{"reason": "Co-founder, email domain match oonchiumpa.com.au"}'::jsonb,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM contact_entity_links
  WHERE contact_id = '36517c81-abfb-4875-ba79-2a6ffcdbb8ac'
    AND entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
);

-- Tanya Turner (GHL: lQ4ROlknfvUmlVbCJhVu)
INSERT INTO contact_entity_links (id, contact_id, entity_id, confidence_score, link_method, link_evidence, created_at)
SELECT
  gen_random_uuid(),
  'abb22481-a1fd-4e14-b564-3b2e57ed0adb'::uuid,
  (SELECT id FROM gs_entities WHERE abn = '53658668627'),
  0.95,
  'manual',
  '{"reason": "Co-founder, email domain match oonchiumpa.com.au"}'::jsonb,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM contact_entity_links
  WHERE contact_id = 'abb22481-a1fd-4e14-b564-3b2e57ed0adb'
    AND entity_id = (SELECT id FROM gs_entities WHERE abn = '53658668627')
);

-- 7. Update person records with proper details
UPDATE person_identity_map
SET
  indigenous_affiliation = true,
  engagement_priority = 'critical',
  sector = 'community',
  collaboration_potential = 8,
  youth_justice_relevance_score = 9,
  current_company = 'Oonchiumpa Consultancy & Services',
  updated_at = NOW()
WHERE full_name ILIKE '%kristy%bloomfield%'
  AND email ILIKE '%oonchiumpa%';

UPDATE person_identity_map
SET
  indigenous_affiliation = true,
  engagement_priority = 'critical',
  sector = 'community',
  collaboration_potential = 8,
  youth_justice_relevance_score = 9,
  current_position = 'Youth Justice Advocate',
  current_company = 'Oonchiumpa Consultancy & Services',
  updated_at = NOW()
WHERE full_name ILIKE '%tanya%turner%'
  AND email ILIKE '%oonchiumpa%';

COMMIT;
