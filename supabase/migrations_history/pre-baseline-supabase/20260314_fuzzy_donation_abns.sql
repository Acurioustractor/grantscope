-- Fuzzy match donation ABNs using pg_trgm
-- Phase 4: Trigram similarity matching against gs_entities
-- Phase 5: Trigram similarity matching via gs_entity_aliases

-- First, create a temp table of distinct unlinked donor names for efficiency
CREATE TEMP TABLE unlinked_donors AS
SELECT LOWER(TRIM(donor_name)) as name_key, COUNT(*) as record_count
FROM political_donations
WHERE (donor_abn IS NULL OR donor_abn = '')
  AND donor_name IS NOT NULL
  AND LENGTH(TRIM(donor_name)) > 5
GROUP BY LOWER(TRIM(donor_name));

CREATE INDEX idx_unlinked_donors_trgm ON unlinked_donors USING gin (name_key gin_trgm_ops);

-- Phase 4: Fuzzy match against gs_entities.canonical_name
-- Use similarity threshold of 0.5 (conservative) and pick the best match
WITH fuzzy_matches AS (
  SELECT DISTINCT ON (u.name_key)
    u.name_key,
    g.abn,
    g.canonical_name as matched_name,
    similarity(u.name_key, LOWER(g.canonical_name)) as sim_score
  FROM unlinked_donors u
  JOIN gs_entities g ON g.abn IS NOT NULL AND g.abn != ''
    AND similarity(u.name_key, LOWER(g.canonical_name)) > 0.5
  ORDER BY u.name_key, similarity(u.name_key, LOWER(g.canonical_name)) DESC
)
UPDATE political_donations p
SET donor_abn = fm.abn
FROM fuzzy_matches fm
WHERE LOWER(TRIM(p.donor_name)) = fm.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

-- Phase 5: Fuzzy match against gs_entity_aliases
WITH alias_fuzzy AS (
  SELECT DISTINCT ON (u.name_key)
    u.name_key,
    g.abn,
    a.alias_value as matched_alias,
    similarity(u.name_key, LOWER(a.alias_value)) as sim_score
  FROM unlinked_donors u
  JOIN gs_entity_aliases a ON similarity(u.name_key, LOWER(a.alias_value)) > 0.5
  JOIN gs_entities g ON g.id = a.entity_id AND g.abn IS NOT NULL AND g.abn != ''
  ORDER BY u.name_key, similarity(u.name_key, LOWER(a.alias_value)) DESC
)
UPDATE political_donations p
SET donor_abn = af.abn
FROM alias_fuzzy af
WHERE LOWER(TRIM(p.donor_name)) = af.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

-- Phase 6: Normalized name matching (strip Pty Ltd, Limited, Inc, etc.)
WITH normalized AS (
  SELECT DISTINCT ON (name_key)
    u.name_key,
    g.abn
  FROM unlinked_donors u
  JOIN gs_entities g ON g.abn IS NOT NULL AND g.abn != ''
    AND LOWER(REGEXP_REPLACE(g.canonical_name, '\s*(Pty|Ltd|Limited|Inc|Incorporated|Corporation|Corp|The|trading as|t/a|ABN\s*\d+)\s*\.?\s*', '', 'gi'))
      = LOWER(REGEXP_REPLACE(u.name_key, '\s*(pty|ltd|limited|inc|incorporated|corporation|corp|the|trading as|t/a|abn\s*\d+)\s*\.?\s*', '', 'gi'))
  WHERE LENGTH(REGEXP_REPLACE(u.name_key, '\s*(pty|ltd|limited|inc|incorporated|corporation|corp|the|trading as|t/a|abn\s*\d+)\s*\.?\s*', '', 'gi')) > 3
  ORDER BY u.name_key, LENGTH(g.canonical_name)
)
UPDATE political_donations p
SET donor_abn = n.abn
FROM normalized n
WHERE LOWER(TRIM(p.donor_name)) = n.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

DROP TABLE unlinked_donors;
