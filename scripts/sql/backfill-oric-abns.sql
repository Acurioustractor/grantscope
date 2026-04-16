-- Backfill ORIC ABNs from ABR registry
-- Strategy: create temp table of ORIC names, then do indexed lookups

SET statement_timeout = '600s';

-- Phase 1: Exact match using indexed lookup on abr_registry
-- The idx_abr_entity_name_upper index is on UPPER(entity_name) WHERE status = 'Active'
-- So we need to query one-by-one or use a lateral join to hit the index

CREATE TEMP TABLE oric_missing AS
SELECT icn, name, UPPER(name) AS upper_name
FROM oric_corporations
WHERE abn IS NULL;

CREATE INDEX ON oric_missing (upper_name);

-- Use lateral join to force index usage on abr_registry
UPDATE oric_corporations oc
SET abn = matched.abn
FROM (
  SELECT DISTINCT ON (om.icn) om.icn, ar.abn
  FROM oric_missing om
  JOIN LATERAL (
    SELECT abn
    FROM abr_registry ar
    WHERE UPPER(ar.entity_name) = om.upper_name
      AND ar.status = 'Active'
      AND ar.abn IS NOT NULL
    LIMIT 1
  ) ar ON true
  ORDER BY om.icn
) matched
WHERE oc.icn = matched.icn AND oc.abn IS NULL;

DO $$
BEGIN
  RAISE NOTICE 'Phase 1 (exact match): updated % rows', (SELECT COUNT(*) FROM oric_corporations WHERE abn IS NOT NULL) - 3288;
END $$;

-- Phase 2: Normalized match
-- Create normalized versions in the temp table
ALTER TABLE oric_missing ADD COLUMN norm_name TEXT;

UPDATE oric_missing SET norm_name = TRIM(LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(name, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc)\M', '', 'gi'),
  '[^a-zA-Z0-9 ]', '', 'g')));

-- Remove already-matched from temp table
DELETE FROM oric_missing om
USING oric_corporations oc
WHERE om.icn = oc.icn AND oc.abn IS NOT NULL;

CREATE INDEX ON oric_missing (norm_name);

-- For phase 2, create a smaller temp table of ABR candidates
-- Only ATSI-related entity types to narrow the 18.5M down
CREATE TEMP TABLE abr_candidates AS
SELECT abn, entity_name,
  TRIM(LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(entity_name, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc)\M', '', 'gi'),
    '[^a-zA-Z0-9 ]', '', 'g'))) AS norm_name
FROM abr_registry
WHERE status = 'Active'
  AND abn IS NOT NULL
  AND (
    entity_name ILIKE '%aboriginal%'
    OR entity_name ILIKE '%indigenous%'
    OR entity_name ILIKE '%torres strait%'
    OR entity_name ILIKE '%first nations%'
    OR entity_name ILIKE '%koori%'
    OR entity_name ILIKE '%murri%'
    OR entity_name ILIKE '%yolngu%'
    OR entity_name ILIKE '%noongar%'
  );

CREATE INDEX ON abr_candidates (norm_name);

-- Now join normalized names — both tables are small
UPDATE oric_corporations oc
SET abn = matched.abn
FROM (
  SELECT DISTINCT ON (om.icn) om.icn, ac.abn
  FROM oric_missing om
  JOIN abr_candidates ac ON om.norm_name = ac.norm_name
  WHERE LENGTH(om.norm_name) >= 3
  ORDER BY om.icn, ac.abn
) matched
WHERE oc.icn = matched.icn AND oc.abn IS NULL;

-- Final report
SELECT
  COUNT(*) AS total,
  COUNT(abn) AS has_abn,
  COUNT(*) - COUNT(abn) AS missing_abn,
  ROUND(100.0 * COUNT(abn) / COUNT(*), 1) AS coverage_pct
FROM oric_corporations;

DROP TABLE IF EXISTS oric_missing;
DROP TABLE IF EXISTS abr_candidates;
