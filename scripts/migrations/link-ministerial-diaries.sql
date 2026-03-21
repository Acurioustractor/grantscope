-- Link ministerial diary meetings to gs_entities
-- Run phases independently (no wrapping transaction to avoid timeout cascade)

-- Set longer timeout for this session
SET statement_timeout = '120s';

-- Phase 1: Exact match on organisation name
UPDATE civic_ministerial_diaries d
SET linked_entity_id = e.id
FROM gs_entities e
WHERE d.linked_entity_id IS NULL
  AND d.organisation IS NOT NULL
  AND UPPER(TRIM(d.organisation)) = UPPER(e.canonical_name);

-- Phase 2: ABN match
UPDATE civic_ministerial_diaries d
SET linked_entity_id = e.id
FROM gs_entities e
WHERE d.linked_entity_id IS NULL
  AND d.organisation_abn IS NOT NULL
  AND d.organisation_abn != ''
  AND e.abn = REPLACE(d.organisation_abn, ' ', '');

-- Phase 3: Match via a temp table of distinct unlinked orgs → entity lookup
-- This avoids N*560K ILIKE by doing one pass per distinct org name
CREATE TEMP TABLE _unlinked_orgs AS
SELECT DISTINCT UPPER(TRIM(organisation)) AS org_upper
FROM civic_ministerial_diaries
WHERE linked_entity_id IS NULL
  AND organisation IS NOT NULL
  AND LENGTH(TRIM(organisation)) >= 8;

-- For each unlinked org, find best matching entity (shortest canonical_name containing it)
CREATE TEMP TABLE _org_matches AS
SELECT DISTINCT ON (u.org_upper)
  u.org_upper,
  e.id AS entity_id
FROM _unlinked_orgs u
JOIN gs_entities e ON UPPER(e.canonical_name) LIKE '%' || u.org_upper || '%'
ORDER BY u.org_upper, LENGTH(e.canonical_name) ASC;

-- Apply matches
UPDATE civic_ministerial_diaries d
SET linked_entity_id = m.entity_id
FROM _org_matches m
WHERE d.linked_entity_id IS NULL
  AND UPPER(TRIM(d.organisation)) = m.org_upper;

DROP TABLE IF EXISTS _unlinked_orgs;
DROP TABLE IF EXISTS _org_matches;

-- Report results
SELECT
  COUNT(*) AS total_meetings,
  COUNT(linked_entity_id) AS linked_entities,
  COUNT(linked_lobbyist_id) AS linked_lobbyists,
  ROUND(COUNT(linked_entity_id)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 1) AS entity_link_pct
FROM civic_ministerial_diaries;
