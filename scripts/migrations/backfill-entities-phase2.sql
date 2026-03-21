-- Phase 2: Backfill from justice_funding recipients and ACNC charities

-- Step 1: Justice funding recipients with ABNs not yet in gs_entities
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (recipient_abn)
  'AU-ABN-' || REPLACE(recipient_abn, ' ', ''),
  recipient_name,
  recipient_abn,
  'charity',
  'reported'
FROM justice_funding
WHERE recipient_abn IS NOT NULL
  AND LENGTH(recipient_abn) >= 9
  AND recipient_name IS NOT NULL
  AND LENGTH(TRIM(recipient_name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.abn = justice_funding.recipient_abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.gs_id = 'AU-ABN-' || REPLACE(justice_funding.recipient_abn, ' ', '')
  )
ORDER BY recipient_abn, amount_dollars DESC NULLS LAST
ON CONFLICT (gs_id) DO NOTHING;

-- Step 2: ACNC charities not yet in gs_entities
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, state, confidence)
SELECT DISTINCT ON (abn)
  'AU-ABN-' || REPLACE(abn, ' ', ''),
  name,
  abn,
  'charity',
  state,
  'registry'
FROM acnc_charities
WHERE abn IS NOT NULL
  AND LENGTH(abn) >= 9
  AND name IS NOT NULL
  AND LENGTH(TRIM(name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.abn = acnc_charities.abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.gs_id = 'AU-ABN-' || REPLACE(acnc_charities.abn, ' ', '')
  )
ORDER BY abn
ON CONFLICT (gs_id) DO NOTHING;

-- Step 3: Foundations not yet in gs_entities
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (acnc_abn)
  'AU-ABN-' || REPLACE(acnc_abn, ' ', ''),
  name,
  acnc_abn,
  'foundation',
  'registry'
FROM foundations
WHERE acnc_abn IS NOT NULL
  AND LENGTH(acnc_abn) >= 9
  AND name IS NOT NULL
  AND LENGTH(TRIM(name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.abn = foundations.acnc_abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.gs_id = 'AU-ABN-' || REPLACE(foundations.acnc_abn, ' ', '')
  )
ORDER BY acnc_abn
ON CONFLICT (gs_id) DO NOTHING;

-- Step 4: NDIS registered providers not yet in gs_entities
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (abn)
  'AU-ABN-' || REPLACE(abn, ' ', ''),
  COALESCE(legal_name, provider_name),
  abn,
  'company',
  'registry'
FROM ndis_registered_providers
WHERE abn IS NOT NULL
  AND LENGTH(abn) >= 9
  AND COALESCE(legal_name, provider_name) IS NOT NULL
  AND LENGTH(TRIM(COALESCE(legal_name, provider_name))) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.abn = ndis_registered_providers.abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.gs_id = 'AU-ABN-' || REPLACE(ndis_registered_providers.abn, ' ', '')
  )
ORDER BY abn
ON CONFLICT (gs_id) DO NOTHING;

-- Report
SELECT COUNT(*) as total_entities FROM gs_entities;
SELECT entity_type, COUNT(*) FROM gs_entities GROUP BY entity_type ORDER BY count DESC;
