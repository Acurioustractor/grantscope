-- ORIC ABN backfill Phase 2: normalized name match via mv_abr_name_lookup
SET statement_timeout = '300s';

-- Count before
SELECT 'BEFORE' AS phase, COUNT(*) AS total, COUNT(abn) AS has_abn,
  ROUND(100.0 * COUNT(abn) / COUNT(*), 1) AS coverage_pct
FROM oric_corporations;

-- Find matches using normalized names
WITH oric_normed AS (
  SELECT icn, name,
    TRIM(LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(name, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of)\M', '', 'gi'),
      '[^a-zA-Z0-9 ]', '', 'g'
    ))) AS norm_name
  FROM oric_corporations WHERE abn IS NULL
),
unique_matches AS (
  SELECT o.icn, MIN(a.abn) AS abn
  FROM oric_normed o
  JOIN mv_abr_name_lookup a ON o.norm_name = a.norm_name
  WHERE LENGTH(o.norm_name) >= 3
  GROUP BY o.icn
  HAVING COUNT(DISTINCT a.abn) = 1  -- only unique matches (1 ABN per name)
)
UPDATE oric_corporations oc
SET abn = um.abn
FROM (SELECT DISTINCT ON (icn) icn, abn FROM unique_matches ORDER BY icn) um
WHERE oc.icn = um.icn AND oc.abn IS NULL;

-- Count after
SELECT 'AFTER' AS phase, COUNT(*) AS total, COUNT(abn) AS has_abn,
  ROUND(100.0 * COUNT(abn) / COUNT(*), 1) AS coverage_pct
FROM oric_corporations;
