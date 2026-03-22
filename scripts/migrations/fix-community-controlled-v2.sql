-- Fix community-controlled v2: Re-flag name-matched non-ORIC entities
-- The v1 migration had a SQL bug (NOT ILIKE ANY vs NOT (ILIKE ANY))
-- which unflagged legitimate Aboriginal/Indigenous charities.
-- This re-flags entities with Indigenous-related names.

UPDATE gs_entities
SET is_community_controlled = TRUE, updated_at = NOW()
WHERE is_community_controlled = FALSE
  AND entity_type != 'indigenous_corp'
  AND (
    canonical_name ILIKE '%aboriginal%'
    OR canonical_name ILIKE '%torres strait%'
    OR canonical_name ILIKE '%indigenous%'
    OR canonical_name ILIKE '%first nations%'
    OR canonical_name ILIKE '%koori%'
    OR canonical_name ILIKE '%murri%'
    OR canonical_name ILIKE '%yolngu%'
    OR canonical_name ILIKE '%noongar%'
    OR canonical_name ILIKE '%palawa%'
    OR canonical_name ILIKE '%nyungar%'
    OR canonical_name ILIKE '%anangu%'
    OR canonical_name ILIKE '%arrernte%'
    OR canonical_name ILIKE '%warlpiri%'
    OR canonical_name ILIKE '%pitjantjatjara%'
    OR canonical_name ILIKE '%community controlled%'
    OR canonical_name ILIKE '%land council%'
    OR canonical_name ILIKE '%native title%'
  );

-- Final counts
DO $$
DECLARE
  total_cc INTEGER;
  oric_count INTEGER;
  name_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_cc FROM gs_entities WHERE is_community_controlled = TRUE;
  SELECT COUNT(*) INTO oric_count FROM gs_entities WHERE is_community_controlled = TRUE AND entity_type = 'indigenous_corp';
  SELECT COUNT(*) INTO name_count FROM gs_entities WHERE is_community_controlled = TRUE AND entity_type != 'indigenous_corp';
  RAISE NOTICE 'Final: % community-controlled (% ORIC + % name-matched)', total_cc, oric_count, name_count;
END $$;
