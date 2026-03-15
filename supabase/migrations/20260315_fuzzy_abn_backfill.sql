-- Fuzzy ABN Backfill
-- Match gs_entities missing ABN against abr_registry using trigram similarity
-- Run as a single batch operation (much faster than per-entity queries)

SET statement_timeout = '1800s';  -- 30 min
SET work_mem = '256MB';

-- Step 1: Create temp table with best fuzzy matches
-- Only considers active ABR records, filters to similarity >= 0.5
CREATE TEMP TABLE fuzzy_matches AS
SELECT DISTINCT ON (e.id)
  e.id AS entity_id,
  e.canonical_name,
  e.entity_type,
  a.abn,
  a.entity_name AS abr_name,
  a.state AS abr_state,
  a.postcode AS abr_postcode,
  similarity(e.canonical_name, a.entity_name) AS sim
FROM gs_entities e
JOIN abr_registry a ON a.entity_name % e.canonical_name
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND a.status = 'Active'
  AND similarity(e.canonical_name, a.entity_name) >= 0.45
ORDER BY e.id, similarity(e.canonical_name, a.entity_name) DESC;

-- Show what we found
SELECT entity_type, COUNT(*) AS matches, ROUND(AVG(sim), 2) AS avg_sim
FROM fuzzy_matches
GROUP BY entity_type
ORDER BY matches DESC;

-- Step 2: Apply matches (only where ABN not already used by another entity)
UPDATE gs_entities e
SET
  abn = fm.abn,
  state = COALESCE(NULLIF(e.state, ''), fm.abr_state),
  postcode = COALESCE(NULLIF(e.postcode, ''), fm.abr_postcode)
FROM fuzzy_matches fm
WHERE e.id = fm.entity_id
  AND fm.sim >= 0.5
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = fm.abn AND e2.id != e.id
  );

-- Show results
SELECT 'Entities updated' AS metric, COUNT(*) AS value
FROM gs_entities e
JOIN fuzzy_matches fm ON e.id = fm.entity_id
WHERE e.abn = fm.abn;

-- Remaining gaps
SELECT entity_type, COUNT(*) AS still_missing
FROM gs_entities
WHERE abn IS NULL AND entity_type != 'person'
GROUP BY entity_type
ORDER BY still_missing DESC;

DROP TABLE fuzzy_matches;
RESET statement_timeout;
RESET work_mem;
