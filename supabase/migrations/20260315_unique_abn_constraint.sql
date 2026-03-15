-- Deduplicate gs_entities by ABN (keep the one with more data / older created_at)
-- Then add unique partial index to enable upsert

-- Step 1: Delete duplicate ABN rows (keep the one created first)
DELETE FROM gs_entities a
USING gs_entities b
WHERE a.abn IS NOT NULL
  AND a.abn = b.abn
  AND a.id != b.id
  AND a.created_at > b.created_at;

-- Step 2: Create unique partial index on ABN (NULL ABNs are allowed to duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gs_entities_abn_unique
ON gs_entities (abn)
WHERE abn IS NOT NULL;
