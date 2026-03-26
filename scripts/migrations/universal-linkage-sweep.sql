-- Universal Linkage Sweep
-- 2026-03-27
--
-- Tier 1: Instant fixes (SQL only)
--   1a. justice_funding: backfill gs_entity_id where ABN exists (3,186 records, $330M)
--   1b. justice_funding: name-match to gs_entities (675 records, $1.3B)
--   1c. austender_contracts: backfill supplier_abn from name match (19,544 records, $11.5B)
--
-- Tier 3: Flag aggregate/jurisdiction-level records
--   ROGS, AIHW, budget-sds records are not org-level — flag them

BEGIN;

-- ============================================================
-- TIER 1a: Backfill gs_entity_id where ABN already exists
-- ============================================================
-- 3,186 justice_funding records have recipient_abn that matches gs_entities
-- but gs_entity_id was never stamped.

UPDATE justice_funding jf
SET gs_entity_id = ge.id
FROM gs_entities ge
WHERE ge.abn = jf.recipient_abn
  AND jf.gs_entity_id IS NULL
  AND jf.recipient_abn IS NOT NULL;

-- ============================================================
-- TIER 1b: Name-match justice_funding to gs_entities
-- ============================================================
-- 675 records with org names that exactly match gs_entities.canonical_name
-- For ambiguous matches (3 names match multiple entities), pick the one with an ABN.

UPDATE justice_funding jf
SET gs_entity_id = matched.entity_id,
    recipient_abn = matched.abn
FROM (
  SELECT DISTINCT ON (LOWER(jf2.recipient_name))
    LOWER(jf2.recipient_name) as lower_name,
    ge.id as entity_id,
    ge.abn
  FROM justice_funding jf2
  JOIN gs_entities ge ON LOWER(ge.canonical_name) = LOWER(jf2.recipient_name)
  WHERE jf2.gs_entity_id IS NULL AND jf2.recipient_abn IS NULL
  ORDER BY LOWER(jf2.recipient_name),
    -- prefer entities with ABN, then by entity_type priority
    CASE WHEN ge.abn IS NOT NULL THEN 0 ELSE 1 END,
    CASE ge.entity_type
      WHEN 'charity' THEN 0
      WHEN 'government_body' THEN 1
      WHEN 'company' THEN 2
      ELSE 3
    END
) matched
WHERE LOWER(jf.recipient_name) = matched.lower_name
  AND jf.gs_entity_id IS NULL
  AND jf.recipient_abn IS NULL;

-- ============================================================
-- TIER 1c: Backfill supplier_abn on contracts from name match
-- ============================================================
-- 19,544 contracts with supplier names that exactly match gs_entities.canonical_name
-- This enables cross-referencing contracts to entities via ABN.

UPDATE austender_contracts ac
SET supplier_abn = matched.abn
FROM (
  SELECT DISTINCT ON (LOWER(ac2.supplier_name))
    LOWER(ac2.supplier_name) as lower_name,
    ge.abn
  FROM austender_contracts ac2
  JOIN gs_entities ge ON LOWER(ge.canonical_name) = LOWER(ac2.supplier_name)
  WHERE ac2.supplier_abn IS NULL
    AND ge.abn IS NOT NULL
  ORDER BY LOWER(ac2.supplier_name),
    CASE ge.entity_type
      WHEN 'company' THEN 0
      WHEN 'charity' THEN 1
      WHEN 'government_body' THEN 2
      ELSE 3
    END
) matched
WHERE LOWER(ac.supplier_name) = matched.lower_name
  AND ac.supplier_abn IS NULL;

-- ============================================================
-- TIER 3: Flag aggregate/jurisdiction-level records
-- ============================================================
-- Add is_aggregate column to justice_funding to separate org-level from aggregate

ALTER TABLE justice_funding ADD COLUMN IF NOT EXISTS is_aggregate boolean DEFAULT false;

-- Flag ROGS expenditure totals (these are state-wide totals, not org grants)
UPDATE justice_funding
SET is_aggregate = true
WHERE source IN ('rogs-2026', 'rogs-yj-expenditure', 'aihw-yj')
  AND gs_entity_id IS NULL;

-- Flag budget SDS records (department-level budget allocations)
UPDATE justice_funding
SET is_aggregate = true
WHERE source IN ('qld-budget-sds', 'nsw-budget-2024', 'nt-budget-2024', 'act-budget-2024')
  AND gs_entity_id IS NULL;

-- Flag "Total" aggregates from QLD historical grants
UPDATE justice_funding
SET is_aggregate = true
WHERE recipient_name = 'Total'
  AND source = 'qld-historical-grants';

-- Flag "Various - Confidential" records
UPDATE justice_funding
SET is_aggregate = true
WHERE recipient_name ILIKE '%Various - Confidential%'
  OR recipient_name ILIKE '%unspecified recipient%';

-- ============================================================
-- Refresh stats
-- ============================================================
ANALYZE justice_funding;
ANALYZE austender_contracts;

COMMIT;
