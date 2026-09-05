-- Backfill donor_abn on political_donations
-- Phase 1: Self-join (match unlinked names to already-linked name+abn pairs)
-- Phase 2: Entity match (match to gs_entities.canonical_name)

-- Phase 1: Self-join
WITH best_abn AS (
  SELECT DISTINCT ON (LOWER(TRIM(donor_name)))
    LOWER(TRIM(donor_name)) as name_key,
    donor_abn
  FROM political_donations
  WHERE donor_abn IS NOT NULL AND donor_abn != ''
  ORDER BY LOWER(TRIM(donor_name)), COUNT(*) OVER (PARTITION BY LOWER(TRIM(donor_name)), donor_abn) DESC
)
UPDATE political_donations p
SET donor_abn = b.donor_abn
FROM best_abn b
WHERE LOWER(TRIM(p.donor_name)) = b.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

-- Phase 2: Entity exact match
UPDATE political_donations p
SET donor_abn = g.abn
FROM gs_entities g
WHERE LOWER(TRIM(p.donor_name)) = LOWER(TRIM(g.canonical_name))
  AND g.abn IS NOT NULL
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

-- Phase 3: Match via gs_entity_aliases
UPDATE political_donations p
SET donor_abn = g.abn
FROM gs_entity_aliases a
JOIN gs_entities g ON g.id = a.entity_id
WHERE LOWER(TRIM(p.donor_name)) = LOWER(a.alias_value)
  AND g.abn IS NOT NULL
  AND (p.donor_abn IS NULL OR p.donor_abn = '');
