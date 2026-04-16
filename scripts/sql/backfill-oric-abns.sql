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

-- Phase 2: Normalized match using mv_abr_name_lookup (pre-materialized)
-- Remove already-matched from temp table
DELETE FROM oric_missing om
USING oric_corporations oc
WHERE om.icn = oc.icn AND oc.abn IS NOT NULL;

ALTER TABLE oric_missing ADD COLUMN norm_name TEXT;
UPDATE oric_missing SET norm_name = TRIM(LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(name, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of)\M', '', 'gi'),
  '[^a-zA-Z0-9 ]', '', 'g')));
CREATE INDEX ON oric_missing (norm_name);

-- Join against mv_abr_name_lookup (9M rows, indexed on norm_name)
UPDATE oric_corporations oc
SET abn = matched.abn
FROM (
  SELECT om.icn, MIN(a.abn) AS abn
  FROM oric_missing om
  JOIN mv_abr_name_lookup a ON om.norm_name = a.norm_name
  WHERE LENGTH(om.norm_name) >= 3
  GROUP BY om.icn
  HAVING COUNT(DISTINCT a.abn) = 1  -- only unique matches
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
