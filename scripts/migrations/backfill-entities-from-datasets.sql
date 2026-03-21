-- Backfill gs_entities from ABNs found in datasets but not yet in entity table
-- Creates new entities for AusTender suppliers, political donors, and ATO entities
-- that have ABNs but no corresponding gs_entities entry.
-- Each step runs independently so one failure doesn't block the rest.

-- Step 1: AusTender suppliers
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (supplier_abn)
  'AU-ABN-' || REPLACE(supplier_abn, ' ', ''),
  supplier_name,
  supplier_abn,
  'company',
  'registry'
FROM austender_contracts
WHERE supplier_abn IS NOT NULL
  AND LENGTH(supplier_abn) >= 9
  AND supplier_name IS NOT NULL
  AND LENGTH(TRIM(supplier_name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.abn = austender_contracts.supplier_abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.gs_id = 'AU-ABN-' || REPLACE(austender_contracts.supplier_abn, ' ', '')
  )
ORDER BY supplier_abn, contract_value DESC NULLS LAST
ON CONFLICT (gs_id) DO NOTHING;

-- Step 2: Political donors
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (donor_abn)
  'AU-ABN-' || REPLACE(donor_abn, ' ', ''),
  donor_name,
  donor_abn,
  'company',
  'reported'
FROM political_donations
WHERE donor_abn IS NOT NULL
  AND LENGTH(donor_abn) >= 9
  AND donor_name IS NOT NULL
  AND LENGTH(TRIM(donor_name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.abn = political_donations.donor_abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.gs_id = 'AU-ABN-' || REPLACE(political_donations.donor_abn, ' ', '')
  )
ORDER BY donor_abn, amount DESC NULLS LAST
ON CONFLICT (gs_id) DO NOTHING;

-- Step 3: ATO tax transparency entities
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (t.abn)
  'AU-ABN-' || REPLACE(t.abn, ' ', ''),
  t.entity_name,
  t.abn,
  'company',
  'registry'
FROM ato_tax_transparency t
WHERE t.abn IS NOT NULL
  AND LENGTH(t.abn) >= 9
  AND t.entity_name IS NOT NULL
  AND LENGTH(TRIM(t.entity_name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.abn = t.abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge
    WHERE ge.gs_id = 'AU-ABN-' || REPLACE(t.abn, ' ', '')
  )
ORDER BY t.abn, t.total_income DESC NULLS LAST
ON CONFLICT (gs_id) DO NOTHING;

-- Report new count
SELECT COUNT(*) as total_entities FROM gs_entities;
SELECT entity_type, COUNT(*) FROM gs_entities GROUP BY entity_type ORDER BY count DESC;
