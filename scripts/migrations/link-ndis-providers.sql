-- Link NDIS registered providers to gs_entities via ABN match
-- 1. Add gs_entity_id column to ndis_registered_providers
-- 2. Populate via ABN match
-- 3. Tag matched entities with 'ndis' in source_datasets
-- 4. (No gs_relationships created — NDIS is a registration, not a funding/contract relationship)

BEGIN;

-- Step 1: Add gs_entity_id column if not exists
ALTER TABLE ndis_registered_providers
  ADD COLUMN IF NOT EXISTS gs_entity_id UUID REFERENCES gs_entities(id);

-- Step 2: Populate gs_entity_id via ABN match
UPDATE ndis_registered_providers n
SET gs_entity_id = e.id
FROM gs_entities e
WHERE e.abn = n.abn
  AND n.gs_entity_id IS NULL;

-- Step 3: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ndis_reg_providers_gs_entity_id
  ON ndis_registered_providers(gs_entity_id)
  WHERE gs_entity_id IS NOT NULL;

-- Step 4: Tag matched gs_entities with 'ndis' in source_datasets
UPDATE gs_entities
SET source_datasets = array_append(source_datasets, 'ndis'),
    updated_at = NOW()
WHERE abn IN (SELECT DISTINCT abn FROM ndis_registered_providers WHERE abn IS NOT NULL)
  AND NOT ('ndis' = ANY(COALESCE(source_datasets, '{}')));

COMMIT;

-- Verify
SELECT 'ndis_registered_providers linked' as step,
       COUNT(*) FILTER (WHERE gs_entity_id IS NOT NULL) as linked,
       COUNT(*) as total
FROM ndis_registered_providers;

SELECT 'gs_entities tagged ndis' as step,
       COUNT(*) as tagged
FROM gs_entities
WHERE 'ndis' = ANY(source_datasets);
