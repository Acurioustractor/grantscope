-- Backfill data linkage across the platform
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260313_backfill_data_linkage.sql

-- ============================================================
-- 1. AUSTENDER SUPPLIERS → GS_ENTITIES
-- Create entity records for 35K suppliers missing from graph
-- ============================================================
INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, source_datasets, source_count, confidence, tags)
SELECT
  'AU-ABN-' || t.supplier_abn,
  t.supplier_name,
  t.supplier_abn,
  CASE
    WHEN t.is_oric THEN 'indigenous_corp'
    WHEN t.is_acnc THEN 'charity'
    ELSE 'company'
  END,
  ARRAY['austender'],
  1,
  'medium',
  ARRAY['austender-supplier']
FROM (
  SELECT
    supplier_abn,
    MODE() WITHIN GROUP (ORDER BY supplier_name) as supplier_name,
    COALESCE(bool_or(supplier_oric_match), false) as is_oric,
    COALESCE(bool_or(supplier_acnc_match), false) as is_acnc
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL
    AND supplier_abn != ''
  GROUP BY supplier_abn
) t
WHERE NOT EXISTS (
  SELECT 1 FROM gs_entities e WHERE e.abn = t.supplier_abn
)
ON CONFLICT (gs_id) DO NOTHING;

-- Report
DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Austender entities created: %', cnt;
END $$;

-- ============================================================
-- 2. FOUNDATION → GRANT LINKAGE
-- Link grant_opportunities.foundation_id using foundation name match to provider
-- ============================================================
UPDATE grant_opportunities go
SET foundation_id = f.id
FROM foundations f
WHERE go.foundation_id IS NULL
  AND go.provider IS NOT NULL
  AND f.name IS NOT NULL
  AND (
    LOWER(TRIM(go.provider)) = LOWER(TRIM(f.name))
    OR LOWER(TRIM(go.provider)) = LOWER(TRIM(f.name)) || ' foundation'
    OR LOWER(TRIM(go.provider)) || ' foundation' = LOWER(TRIM(f.name))
  );

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Grants linked to foundations by exact name: %', cnt;
END $$;

-- Also link via foundation_programs name → grant name
UPDATE grant_opportunities go
SET foundation_id = fp.foundation_id
FROM foundation_programs fp
WHERE go.foundation_id IS NULL
  AND fp.foundation_id IS NOT NULL
  AND LOWER(TRIM(go.name)) = LOWER(TRIM(fp.name));

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Grants linked to foundations by program name: %', cnt;
END $$;

-- ============================================================
-- 3. GRANT GEOGRAPHY BACKFILL
-- Set geography from state keywords in name/description/provider
-- ============================================================
UPDATE grant_opportunities
SET geography = 'National'
WHERE geography IS NULL
  AND (
    LOWER(name) LIKE '%national%'
    OR LOWER(name) LIKE '%australia-wide%'
    OR LOWER(name) LIKE '%all states%'
  );

UPDATE grant_opportunities
SET geography = CASE
  WHEN LOWER(name) LIKE '%new south wales%' OR LOWER(name) LIKE '% nsw%' THEN 'NSW'
  WHEN LOWER(name) LIKE '%victoria%' OR LOWER(name) LIKE '% vic%' THEN 'VIC'
  WHEN LOWER(name) LIKE '%queensland%' OR LOWER(name) LIKE '% qld%' THEN 'QLD'
  WHEN LOWER(name) LIKE '%western australia%' OR LOWER(name) LIKE '% wa %' THEN 'WA'
  WHEN LOWER(name) LIKE '%south australia%' OR LOWER(name) LIKE '% sa %' THEN 'SA'
  WHEN LOWER(name) LIKE '%tasmania%' OR LOWER(name) LIKE '% tas%' THEN 'TAS'
  WHEN LOWER(name) LIKE '%northern territory%' OR LOWER(name) LIKE '% nt %' THEN 'NT'
  WHEN LOWER(name) LIKE '%australian capital%' OR LOWER(name) LIKE '% act %' THEN 'ACT'
END
WHERE geography IS NULL
  AND (
    LOWER(name) LIKE '%new south wales%' OR LOWER(name) LIKE '% nsw%'
    OR LOWER(name) LIKE '%victoria%' OR LOWER(name) LIKE '% vic%'
    OR LOWER(name) LIKE '%queensland%' OR LOWER(name) LIKE '% qld%'
    OR LOWER(name) LIKE '%western australia%' OR LOWER(name) LIKE '% wa %'
    OR LOWER(name) LIKE '%south australia%' OR LOWER(name) LIKE '% sa %'
    OR LOWER(name) LIKE '%tasmania%' OR LOWER(name) LIKE '% tas%'
    OR LOWER(name) LIKE '%northern territory%' OR LOWER(name) LIKE '% nt %'
    OR LOWER(name) LIKE '%australian capital%' OR LOWER(name) LIKE '% act %'
  );

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Grants with geography backfilled: %', cnt;
END $$;

-- ============================================================
-- 4. INDIGENOUS CORP POSTCODE BACKFILL FROM ORIC DATA
-- Try to fill postcodes from acnc_charities or social_enterprises
-- ============================================================
UPDATE gs_entities e
SET postcode = c.postcode
FROM acnc_charities c
WHERE e.postcode IS NULL
  AND e.entity_type = 'indigenous_corp'
  AND e.abn IS NOT NULL
  AND c.abn = e.abn
  AND c.postcode IS NOT NULL;

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Indigenous corps postcodes from ACNC: %', cnt;
END $$;

UPDATE gs_entities e
SET postcode = se.postcode
FROM social_enterprises se
WHERE e.postcode IS NULL
  AND e.entity_type = 'indigenous_corp'
  AND e.abn IS NOT NULL
  AND se.abn = e.abn
  AND se.postcode IS NOT NULL;

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Indigenous corps postcodes from social_enterprises: %', cnt;
END $$;

-- ============================================================
-- 5. ENTITY STATE BACKFILL FROM POSTCODE
-- Fill missing state from postcode_geo
-- ============================================================
UPDATE gs_entities e
SET state = pg.state
FROM postcode_geo pg
WHERE e.state IS NULL
  AND e.postcode IS NOT NULL
  AND pg.postcode = e.postcode
  AND pg.state IS NOT NULL;

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Entity states backfilled from postcode: %', cnt;
END $$;

-- ============================================================
-- 6. DEADLINE BACKFILL: copy closes_at → deadline where missing
-- ============================================================
UPDATE grant_opportunities
SET deadline = closes_at
WHERE deadline IS NULL
  AND closes_at IS NOT NULL;

DO $$
DECLARE
  cnt integer;
BEGIN
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Deadlines backfilled from closes_at: %', cnt;
END $$;

-- Final summary
SELECT 'entities' as table_name, COUNT(*) as total FROM gs_entities
UNION ALL
SELECT 'entities_with_postcode', COUNT(*) FROM gs_entities WHERE postcode IS NOT NULL
UNION ALL
SELECT 'entities_with_state', COUNT(*) FROM gs_entities WHERE state IS NOT NULL
UNION ALL
SELECT 'relationships', COUNT(*) FROM gs_relationships
UNION ALL
SELECT 'grants_with_foundation', COUNT(*) FROM grant_opportunities WHERE foundation_id IS NOT NULL
UNION ALL
SELECT 'grants_with_deadline', COUNT(*) FROM grant_opportunities WHERE deadline IS NOT NULL OR closes_at IS NOT NULL
UNION ALL
SELECT 'grants_with_geography', COUNT(*) FROM grant_opportunities WHERE geography IS NOT NULL
UNION ALL
SELECT 'indigenous_with_postcode', COUNT(*) FROM gs_entities WHERE entity_type = 'indigenous_corp' AND postcode IS NOT NULL;
