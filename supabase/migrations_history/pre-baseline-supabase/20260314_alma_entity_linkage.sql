-- ALMA → gs_entities linkage
-- Adds a proper FK column and backfills exact name matches

-- 1. Add FK column
ALTER TABLE alma_interventions
  ADD COLUMN IF NOT EXISTS gs_entity_id UUID REFERENCES gs_entities(id);

CREATE INDEX IF NOT EXISTS idx_alma_interventions_gs_entity
  ON alma_interventions (gs_entity_id) WHERE gs_entity_id IS NOT NULL;

-- 2. Backfill exact name matches (case-insensitive)
UPDATE alma_interventions a
SET gs_entity_id = g.id
FROM gs_entities g
WHERE LOWER(a.operating_organization) = LOWER(g.canonical_name)
  AND a.operating_organization IS NOT NULL
  AND a.operating_organization NOT LIKE 'http%'
  AND a.gs_entity_id IS NULL;

-- 3. Also match via gs_entity_aliases (alias_value column)
UPDATE alma_interventions a
SET gs_entity_id = al.entity_id
FROM gs_entity_aliases al
WHERE LOWER(a.operating_organization) = LOWER(al.alias_value)
  AND a.operating_organization IS NOT NULL
  AND a.gs_entity_id IS NULL;

-- Note: alma_interventions_unified is a VIEW, not a table.
-- It reads gs_entity_id from alma_interventions automatically.
