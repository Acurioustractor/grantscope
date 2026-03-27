-- Backfill supplier_abn on state_tenders records missing it.
-- Three strategies in priority order:
--   1. Self-join: match against other state_tenders rows that have the same supplier_name + ABN
--   2. gs_entities: exact match on canonical_name
--   3. abr_registry: exact match on entity_name (Active only)
--
-- For ambiguous names (multiple ABNs), we pick the most frequent ABN (mode).
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/sql/backfill-state-tenders-abn.sql

BEGIN;

-- ============================================================
-- Before counts
-- ============================================================
\echo '--- BEFORE ---'
SELECT COUNT(*) AS total,
       COUNT(supplier_abn) AS has_abn,
       COUNT(*) - COUNT(supplier_abn) AS missing_abn
  FROM state_tenders;

-- ============================================================
-- Phase 1: Self-join — match supplier_name against rows that already have ABN
-- Pick the most-used ABN per UPPER(supplier_name) to avoid ambiguity
-- ============================================================
\echo '--- Phase 1: Self-join ---'
WITH abn_mode AS (
  SELECT DISTINCT ON (UPPER(supplier_name))
    UPPER(supplier_name) AS uname,
    supplier_abn
  FROM state_tenders
  WHERE supplier_abn IS NOT NULL
    AND supplier_name IS NOT NULL
  GROUP BY UPPER(supplier_name), supplier_abn
  ORDER BY UPPER(supplier_name), COUNT(*) DESC
)
UPDATE state_tenders t
SET supplier_abn = m.supplier_abn,
    updated_at = NOW()
FROM abn_mode m
WHERE t.supplier_abn IS NULL
  AND t.supplier_name IS NOT NULL
  AND UPPER(t.supplier_name) = m.uname;

-- Snapshot after phase 1
SELECT COUNT(*) - COUNT(supplier_abn) AS still_missing FROM state_tenders;

-- ============================================================
-- Phase 2: gs_entities — exact name match on canonical_name
-- Deterministic: pick first ABN alphabetically per name
-- ============================================================
\echo '--- Phase 2: gs_entities ---'
WITH gs_match AS (
  SELECT DISTINCT ON (UPPER(g.canonical_name))
    UPPER(g.canonical_name) AS uname,
    g.abn
  FROM gs_entities g
  WHERE g.abn IS NOT NULL
    AND g.canonical_name IS NOT NULL
  ORDER BY UPPER(g.canonical_name), g.abn
)
UPDATE state_tenders t
SET supplier_abn = gm.abn,
    updated_at = NOW()
FROM gs_match gm
WHERE t.supplier_abn IS NULL
  AND t.supplier_name IS NOT NULL
  AND UPPER(t.supplier_name) = gm.uname;

-- Snapshot after phase 2
SELECT COUNT(*) - COUNT(supplier_abn) AS still_missing FROM state_tenders;

-- ============================================================
-- Phase 3: abr_registry — exact name match on entity_name (Active only)
-- Deterministic: pick first ABN alphabetically per name
-- ============================================================
\echo '--- Phase 3: abr_registry ---'
WITH abr_match AS (
  SELECT DISTINCT ON (UPPER(entity_name))
    UPPER(entity_name) AS uname,
    abn
  FROM abr_registry
  WHERE status = 'Active'
    AND entity_name IS NOT NULL
    AND abn IS NOT NULL
  ORDER BY UPPER(entity_name), abn
)
UPDATE state_tenders t
SET supplier_abn = am.abn,
    updated_at = NOW()
FROM abr_match am
WHERE t.supplier_abn IS NULL
  AND t.supplier_name IS NOT NULL
  AND UPPER(t.supplier_name) = am.uname;

-- ============================================================
-- After counts
-- ============================================================
\echo '--- AFTER ---'
SELECT COUNT(*) AS total,
       COUNT(supplier_abn) AS has_abn,
       COUNT(*) - COUNT(supplier_abn) AS missing_abn
  FROM state_tenders;

COMMIT;
