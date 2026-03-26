-- Universal Linkage Sweep Part 2: Fuzzy Name Matching + Aggregate Cleanup
-- 2026-03-27
--
-- Strategy: Build a name_aliases table for safe, auditable fuzzy matching.
-- Then use it to link justice_funding and contracts.

BEGIN;

-- ============================================================
-- Create name_aliases lookup table
-- ============================================================
CREATE TABLE IF NOT EXISTS name_aliases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alias_name text NOT NULL,
  canonical_entity_id uuid REFERENCES gs_entities(id),
  canonical_abn text,
  match_method text NOT NULL, -- 'exact', 'stripped_suffix', 'manual', 'ilike'
  confidence text DEFAULT 'high', -- 'high', 'medium', 'low'
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_name_aliases_lower ON name_aliases (LOWER(alias_name));

-- ============================================================
-- Populate with high-confidence manual matches for top unlinked
-- ============================================================

-- Blue Care: Head Office → Blue Care (ABN 96010643909)
INSERT INTO name_aliases (alias_name, canonical_entity_id, canonical_abn, match_method)
VALUES
  ('Blue Care: Head Office', 'c891ea45-3d5e-454e-a12b-806ba68bf742', '96010643909', 'manual'),
  ('Blue Care', 'c891ea45-3d5e-454e-a12b-806ba68bf742', '96010643909', 'manual');

-- ============================================================
-- Auto-populate: case-insensitive duplicates within justice_funding
-- ============================================================
-- "Cerebral Palsy League Of Queensland" vs "Cerebral Palsy League of Queensland"
-- These are the same org with different casing — match to whichever is already linked

INSERT INTO name_aliases (alias_name, canonical_entity_id, canonical_abn, match_method)
SELECT DISTINCT jf_unlinked.recipient_name, jf_linked.gs_entity_id, ge.abn, 'case_variant'
FROM justice_funding jf_unlinked
JOIN justice_funding jf_linked ON LOWER(jf_linked.recipient_name) = LOWER(jf_unlinked.recipient_name)
  AND jf_linked.gs_entity_id IS NOT NULL
JOIN gs_entities ge ON ge.id = jf_linked.gs_entity_id
WHERE jf_unlinked.gs_entity_id IS NULL
  AND NOT COALESCE(jf_unlinked.is_aggregate, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Auto-populate: strip branch/office suffixes and match
-- ============================================================
-- "Org Name: Head Office" → "Org Name"
-- "Org Name - Regional" → "Org Name"

INSERT INTO name_aliases (alias_name, canonical_entity_id, canonical_abn, match_method, confidence)
SELECT DISTINCT ON (jf.recipient_name)
  jf.recipient_name,
  ge.id,
  ge.abn,
  'stripped_suffix',
  'medium'
FROM justice_funding jf
CROSS JOIN LATERAL (
  SELECT REGEXP_REPLACE(
    REGEXP_REPLACE(jf.recipient_name, '\s*[:—-]\s*(Head Office|Branch|Regional|Local|Central|Office).*$', '', 'i'),
    '\s+(Inc\.?|Ltd\.?|Pty\.?|Limited|Incorporated|Association)\s*$', '', 'i'
  ) as stripped
) stripped_name
JOIN gs_entities ge ON LOWER(ge.canonical_name) = LOWER(stripped_name.stripped)
WHERE jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND ge.abn IS NOT NULL
  AND ge.entity_type != 'person'
  AND LENGTH(stripped_name.stripped) > 5
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(jf.recipient_name))
ORDER BY jf.recipient_name,
  CASE ge.entity_type WHEN 'charity' THEN 0 WHEN 'company' THEN 1 ELSE 2 END
ON CONFLICT DO NOTHING;

-- ============================================================
-- Apply aliases to justice_funding
-- ============================================================

UPDATE justice_funding jf
SET gs_entity_id = na.canonical_entity_id,
    recipient_abn = COALESCE(jf.recipient_abn, na.canonical_abn)
FROM name_aliases na
WHERE LOWER(jf.recipient_name) = LOWER(na.alias_name)
  AND jf.gs_entity_id IS NULL
  AND NOT COALESCE(jf.is_aggregate, false)
  AND na.canonical_entity_id IS NOT NULL;

-- ============================================================
-- Apply same logic to contracts
-- ============================================================

-- Case variants in contracts
INSERT INTO name_aliases (alias_name, canonical_entity_id, canonical_abn, match_method)
SELECT DISTINCT ac.supplier_name, ge.id, ge.abn, 'contract_case_variant'
FROM austender_contracts ac
JOIN gs_entities ge ON LOWER(ge.canonical_name) = LOWER(ac.supplier_name)
WHERE ac.supplier_abn IS NULL
  AND ge.abn IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM name_aliases na WHERE LOWER(na.alias_name) = LOWER(ac.supplier_name))
ON CONFLICT DO NOTHING;

-- Apply to contracts
UPDATE austender_contracts ac
SET supplier_abn = na.canonical_abn
FROM name_aliases na
WHERE LOWER(ac.supplier_name) = LOWER(na.alias_name)
  AND ac.supplier_abn IS NULL
  AND na.canonical_abn IS NOT NULL;

-- ============================================================
-- Flag remaining junk in justice_funding
-- ============================================================

-- Flag numeric-only names (e.g. "2") and "Multiple", "Accrual" etc.
UPDATE justice_funding
SET is_aggregate = true
WHERE gs_entity_id IS NULL
  AND NOT COALESCE(is_aggregate, false)
  AND (
    recipient_name ~ '^\d+$'
    OR recipient_name IN ('Multiple', 'Accrual', 'Other')
    OR recipient_name ILIKE 'institutions like%'
    OR recipient_name ILIKE 'Department of Health Qld -%'
  );

-- ============================================================
-- Refresh stats
-- ============================================================
ANALYZE justice_funding;
ANALYZE austender_contracts;
ANALYZE name_aliases;

COMMIT;
