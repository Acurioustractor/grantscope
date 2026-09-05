-- Fuzzy match donation ABNs using pg_trgm (with extended timeout)
SET statement_timeout = '600s';

-- Temp table of distinct unlinked donor names
CREATE TEMP TABLE unlinked_donors AS
SELECT LOWER(TRIM(donor_name)) as name_key, COUNT(*) as record_count
FROM political_donations
WHERE (donor_abn IS NULL OR donor_abn = '')
  AND donor_name IS NOT NULL
  AND LENGTH(TRIM(donor_name)) > 5
GROUP BY LOWER(TRIM(donor_name));

CREATE INDEX idx_unlinked_donors_trgm ON unlinked_donors USING gin (name_key gin_trgm_ops);

-- Phase 4: Trigram similarity against gs_entities.canonical_name (threshold 0.5)
WITH fuzzy_matches AS (
  SELECT DISTINCT ON (u.name_key)
    u.name_key,
    g.abn,
    similarity(u.name_key, LOWER(g.canonical_name)) as sim_score
  FROM unlinked_donors u
  JOIN gs_entities g ON g.abn IS NOT NULL AND g.abn != ''
    AND u.name_key % LOWER(g.canonical_name)
  WHERE similarity(u.name_key, LOWER(g.canonical_name)) > 0.5
  ORDER BY u.name_key, similarity(u.name_key, LOWER(g.canonical_name)) DESC
)
UPDATE political_donations p
SET donor_abn = fm.abn
FROM fuzzy_matches fm
WHERE LOWER(TRIM(p.donor_name)) = fm.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

-- Phase 5: Trigram similarity against gs_entity_aliases (threshold 0.5)
WITH alias_fuzzy AS (
  SELECT DISTINCT ON (u.name_key)
    u.name_key,
    g.abn,
    similarity(u.name_key, LOWER(a.alias_value)) as sim_score
  FROM unlinked_donors u
  JOIN gs_entity_aliases a ON u.name_key % LOWER(a.alias_value)
  JOIN gs_entities g ON g.id = a.entity_id AND g.abn IS NOT NULL AND g.abn != ''
  WHERE similarity(u.name_key, LOWER(a.alias_value)) > 0.5
  ORDER BY u.name_key, similarity(u.name_key, LOWER(a.alias_value)) DESC
)
UPDATE political_donations p
SET donor_abn = af.abn
FROM alias_fuzzy af
WHERE LOWER(TRIM(p.donor_name)) = af.name_key
  AND (p.donor_abn IS NULL OR p.donor_abn = '');

DROP TABLE unlinked_donors;

RESET statement_timeout;
