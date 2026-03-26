-- Universal Linkage Sweep Part 3: ABR Trading Name Resolution
-- 2026-03-27
--
-- Match unlinked justice_funding and contracts against:
-- 1. abr_registry.entity_name (exact, case-insensitive)
-- 2. abr_registry.trading_names array (exact, case-insensitive)
-- 3. Then stamp gs_entity_id via ABN→gs_entities join
--
-- Only active ABNs (status = 'Active') to avoid matching cancelled entities.

BEGIN;

-- ============================================================
-- STEP 1: Match justice_funding recipient_name → ABR entity_name
-- ============================================================

-- 1a. Direct entity_name match
INSERT INTO name_aliases (alias_name, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (jf.recipient_name)
  jf.recipient_name,
  abr.abn,
  'abr_entity_name',
  'high'
FROM justice_funding jf
JOIN abr_registry abr ON UPPER(abr.entity_name) = UPPER(jf.recipient_name)
WHERE jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND abr.status = 'Active'
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(jf.recipient_name))
ORDER BY jf.recipient_name, abr.record_updated_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- 1b. Trading name match
INSERT INTO name_aliases (alias_name, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (jf.recipient_name)
  jf.recipient_name,
  abr.abn,
  'abr_trading_name',
  'high'
FROM justice_funding jf
CROSS JOIN abr_registry abr
CROSS JOIN LATERAL unnest(abr.trading_names) AS tn
WHERE jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND UPPER(tn) = UPPER(jf.recipient_name)
  AND abr.status = 'Active'
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(jf.recipient_name))
ORDER BY jf.recipient_name, abr.record_updated_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- 1c. Stripped suffix match against ABR
-- "Org Name Inc" → match "ORG NAME" in ABR, or "Org Name: Head Office" → "ORG NAME"
INSERT INTO name_aliases (alias_name, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (jf.recipient_name)
  jf.recipient_name,
  abr.abn,
  'abr_stripped_match',
  'medium'
FROM justice_funding jf
CROSS JOIN LATERAL (
  SELECT UPPER(REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(jf.recipient_name, '\s*[:—-]\s*(Head Office|Branch|Regional|Local|Central|Office).*$', '', 'i'),
      '\s+(Inc\.?|Ltd\.?|Pty\.?|Limited|Incorporated|Association|Corp\.?|Corporation)\s*$', '', 'i'
    ),
    '\s+(of|the|for|and|&)\s+', ' ', 'gi'
  )) as stripped
) s
JOIN abr_registry abr ON (
  UPPER(REGEXP_REPLACE(abr.entity_name, '\s+(OF|THE|FOR|AND|&)\s+', ' ', 'gi')) = s.stripped
)
WHERE jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND abr.status = 'Active'
  AND LENGTH(s.stripped) > 8
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(jf.recipient_name))
ORDER BY jf.recipient_name, abr.record_updated_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 2: Same for contracts
-- ============================================================

-- 2a. Direct entity_name match
INSERT INTO name_aliases (alias_name, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (ac.supplier_name)
  ac.supplier_name,
  abr.abn,
  'abr_entity_name',
  'high'
FROM austender_contracts ac
JOIN abr_registry abr ON UPPER(abr.entity_name) = UPPER(ac.supplier_name)
WHERE ac.supplier_abn IS NULL
  AND abr.status = 'Active'
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(ac.supplier_name))
ORDER BY ac.supplier_name, abr.record_updated_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- 2b. Trading name match for contracts
INSERT INTO name_aliases (alias_name, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (ac.supplier_name)
  ac.supplier_name,
  abr.abn,
  'abr_trading_name',
  'high'
FROM austender_contracts ac
CROSS JOIN abr_registry abr
CROSS JOIN LATERAL unnest(abr.trading_names) AS tn
WHERE ac.supplier_abn IS NULL
  AND UPPER(tn) = UPPER(ac.supplier_name)
  AND abr.status = 'Active'
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(ac.supplier_name))
ORDER BY ac.supplier_name, abr.record_updated_date DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 3: Resolve ABN → gs_entity_id in name_aliases
-- ============================================================

UPDATE name_aliases na
SET canonical_entity_id = ge.id
FROM gs_entities ge
WHERE ge.abn = na.canonical_abn
  AND na.canonical_entity_id IS NULL
  AND na.canonical_abn IS NOT NULL;

-- ============================================================
-- STEP 4: Apply aliases to justice_funding
-- ============================================================

-- Apply ABN + gs_entity_id
UPDATE justice_funding jf
SET
  gs_entity_id = COALESCE(jf.gs_entity_id, na.canonical_entity_id),
  recipient_abn = COALESCE(jf.recipient_abn, na.canonical_abn)
FROM name_aliases na
WHERE LOWER(jf.recipient_name) = LOWER(na.alias_name)
  AND jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND na.canonical_abn IS NOT NULL;

-- ============================================================
-- STEP 5: Apply aliases to contracts
-- ============================================================

UPDATE austender_contracts ac
SET supplier_abn = na.canonical_abn
FROM name_aliases na
WHERE LOWER(ac.supplier_name) = LOWER(na.alias_name)
  AND ac.supplier_abn IS NULL
  AND na.canonical_abn IS NOT NULL;

-- ============================================================
-- STEP 6: Create gs_entities for ABR matches that don't exist yet
-- ============================================================
-- Some ABNs resolved from ABR may not have gs_entities rows yet.
-- Create them so the linkage chain is complete.

INSERT INTO gs_entities (id, gs_id, canonical_name, abn, entity_type, state, postcode, confidence, created_at)
SELECT
  gen_random_uuid(),
  'AU-ABN-' || na.canonical_abn,
  abr.entity_name,
  na.canonical_abn,
  CASE abr.entity_type_code
    WHEN 'IND' THEN 'person'
    WHEN 'PRV' THEN 'company'
    WHEN 'PUB' THEN 'company'
    WHEN 'OTH' THEN 'charity'
    ELSE 'company'
  END,
  abr.state,
  abr.postcode,
  'registry',
  NOW()
FROM name_aliases na
JOIN abr_registry abr ON abr.abn = na.canonical_abn
WHERE na.canonical_entity_id IS NULL
  AND na.canonical_abn IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gs_entities ge WHERE ge.abn = na.canonical_abn)
  AND abr.status = 'Active'
ON CONFLICT DO NOTHING;

-- Re-resolve entity IDs for newly created entities
UPDATE name_aliases na
SET canonical_entity_id = ge.id
FROM gs_entities ge
WHERE ge.abn = na.canonical_abn
  AND na.canonical_entity_id IS NULL
  AND na.canonical_abn IS NOT NULL;

-- Re-apply to justice_funding for newly created entities
UPDATE justice_funding jf
SET gs_entity_id = na.canonical_entity_id
FROM name_aliases na
WHERE LOWER(jf.recipient_name) = LOWER(na.alias_name)
  AND jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND na.canonical_entity_id IS NOT NULL;

-- ============================================================
-- Refresh
-- ============================================================
ANALYZE name_aliases;
ANALYZE justice_funding;
ANALYZE austender_contracts;
ANALYZE gs_entities;

COMMIT;
