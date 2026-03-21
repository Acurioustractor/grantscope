-- Link justice_funding recipients to gs_entities
-- Creates new gs_entities for ABNs that don't exist yet.
--
-- Phase 1: Create missing entities from justice_funding ABNs
-- Phase 2: Reclassify entity_type for known charities/indigenous corps

BEGIN;

-- Phase 1: Create entities for unlinked ABNs
-- Pick the most common recipient_name per ABN as canonical_name
WITH ranked_names AS (
  SELECT
    recipient_abn,
    recipient_name,
    COUNT(*) as usage_count,
    ROW_NUMBER() OVER (PARTITION BY recipient_abn ORDER BY COUNT(*) DESC) as rn
  FROM justice_funding
  WHERE recipient_abn IS NOT NULL
    AND recipient_name IS NOT NULL
    AND recipient_name != ''
    AND recipient_name != '(blank)'
    AND LENGTH(recipient_abn) >= 9
    AND NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.abn = justice_funding.recipient_abn)
  GROUP BY recipient_abn, recipient_name
),
best_names AS (
  SELECT recipient_abn, recipient_name
  FROM ranked_names
  WHERE rn = 1
)
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, source_datasets, confidence, created_at, updated_at)
SELECT
  'AU-ABN-' || bn.recipient_abn,
  bn.recipient_name,
  bn.recipient_abn,
  'company',
  ARRAY['justice_funding'],
  'reported',
  NOW(),
  NOW()
FROM best_names bn
WHERE NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.gs_id = 'AU-ABN-' || bn.recipient_abn)
ON CONFLICT (gs_id) DO NOTHING;

-- Phase 2: Reclassify any that are actually ACNC charities
UPDATE gs_entities e
SET entity_type = 'charity'
FROM acnc_charities c
WHERE e.abn = c.abn
  AND e.entity_type = 'company'
  AND e.source_datasets = ARRAY['justice_funding'];

-- Phase 3: Reclassify any that are ORIC indigenous corporations
UPDATE gs_entities e
SET entity_type = 'indigenous_corp'
FROM gs_entities oric
WHERE e.abn = oric.abn
  AND oric.entity_type = 'indigenous_corp'
  AND e.entity_type = 'company'
  AND e.source_datasets = ARRAY['justice_funding']
  AND e.id != oric.id;

COMMIT;
