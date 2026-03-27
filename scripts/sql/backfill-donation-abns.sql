-- Backfill donor_abn on political_donations
-- Four phases: self-join, gs_entities match, abr_registry match, trading names match
-- Run with: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/sql/backfill-donation-abns.sql

SET statement_timeout = '0';  -- No timeout — index creation on 18.5M rows can take a while

-- Baseline count
SELECT 'BASELINE' AS phase,
       COUNT(*) AS total,
       COUNT(donor_abn) AS has_abn,
       COUNT(*) - COUNT(donor_abn) AS missing_abn,
       ROUND(100.0 * COUNT(donor_abn) / COUNT(*), 1) AS pct_linked
FROM political_donations;

-- ============================================================================
-- PREP: Create functional index on abr_registry if missing (needed for Phase 3)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_abr_entity_name_upper
  ON abr_registry (UPPER(entity_name))
  WHERE status = 'Active';

-- ============================================================================
-- PHASE 1: Self-join — match donor names that already have ABN on other records
-- ============================================================================

-- Build lookup: for each uppercased donor_name, pick the ABN with highest frequency
CREATE TEMP TABLE donor_abn_selfmatch AS
SELECT DISTINCT ON (name_upper)
  name_upper,
  donor_abn
FROM (
  SELECT UPPER(donor_name) AS name_upper,
         donor_abn,
         COUNT(*) AS freq
  FROM political_donations
  WHERE donor_abn IS NOT NULL
    AND LENGTH(donor_name) >= 5
  GROUP BY UPPER(donor_name), donor_abn
) ranked
ORDER BY name_upper, freq DESC;

CREATE INDEX ON donor_abn_selfmatch (name_upper);

UPDATE political_donations pd
SET donor_abn = sm.donor_abn
FROM donor_abn_selfmatch sm
WHERE pd.donor_abn IS NULL
  AND UPPER(pd.donor_name) = sm.name_upper
  AND LENGTH(pd.donor_name) >= 5;

SELECT 'PHASE 1 (self-join)' AS phase,
       COUNT(*) - COUNT(donor_abn) AS still_missing
FROM political_donations;

DROP TABLE donor_abn_selfmatch;

-- ============================================================================
-- PHASE 2: Match against gs_entities (canonical_name -> abn)
-- ============================================================================

CREATE TEMP TABLE donor_abn_entities AS
SELECT DISTINCT ON (UPPER(ge.canonical_name))
  UPPER(ge.canonical_name) AS name_upper,
  ge.abn
FROM gs_entities ge
WHERE ge.abn IS NOT NULL
  AND ge.entity_type != 'person'
  AND LENGTH(ge.canonical_name) >= 5
ORDER BY UPPER(ge.canonical_name), ge.abn;

CREATE INDEX ON donor_abn_entities (name_upper);

UPDATE political_donations pd
SET donor_abn = em.abn
FROM donor_abn_entities em
WHERE pd.donor_abn IS NULL
  AND UPPER(pd.donor_name) = em.name_upper
  AND LENGTH(pd.donor_name) >= 5;

SELECT 'PHASE 2 (gs_entities)' AS phase,
       COUNT(*) - COUNT(donor_abn) AS still_missing
FROM political_donations;

DROP TABLE donor_abn_entities;

-- ============================================================================
-- PHASE 3: Match against abr_registry (entity_name -> abn, Active only)
-- Uses the functional index idx_abr_entity_name_upper created above
-- ============================================================================

-- Get distinct donor names still missing ABN
CREATE TEMP TABLE donors_still_missing AS
SELECT DISTINCT donor_name, UPPER(donor_name) AS name_upper
FROM political_donations
WHERE donor_abn IS NULL
  AND LENGTH(donor_name) >= 5;

CREATE INDEX ON donors_still_missing (name_upper);

SELECT 'PHASE 3 prep' AS phase,
       COUNT(*) AS unique_names_to_match
FROM donors_still_missing;

-- Match against ABR using the functional index
-- For names matching multiple ABNs, pick the one with most recent status_from_date
CREATE TEMP TABLE donor_abn_abr AS
SELECT DISTINCT ON (dm.name_upper)
  dm.name_upper,
  ar.abn
FROM donors_still_missing dm
JOIN abr_registry ar ON UPPER(ar.entity_name) = dm.name_upper
  AND ar.status = 'Active'
ORDER BY dm.name_upper, ar.status_from_date DESC NULLS LAST;

SELECT 'PHASE 3 matched' AS phase,
       COUNT(*) AS unique_names_matched
FROM donor_abn_abr;

CREATE INDEX ON donor_abn_abr (name_upper);

UPDATE political_donations pd
SET donor_abn = abr.abn
FROM donor_abn_abr abr
WHERE pd.donor_abn IS NULL
  AND UPPER(pd.donor_name) = abr.name_upper
  AND LENGTH(pd.donor_name) >= 5;

SELECT 'PHASE 3 (abr_registry)' AS phase,
       COUNT(*) - COUNT(donor_abn) AS still_missing
FROM political_donations;

DROP TABLE donors_still_missing;
DROP TABLE donor_abn_abr;

-- ============================================================================
-- PHASE 4: Match against abr_registry trading_names
-- Materializes the unnested trading names into a temp table first for efficiency
-- ============================================================================

-- Get remaining missing donor names
CREATE TEMP TABLE donors_missing_p4 AS
SELECT DISTINCT donor_name, UPPER(donor_name) AS name_upper
FROM political_donations
WHERE donor_abn IS NULL
  AND LENGTH(donor_name) >= 5;

CREATE INDEX ON donors_missing_p4 (name_upper);

SELECT 'PHASE 4 prep' AS phase,
       COUNT(*) AS unique_names_remaining
FROM donors_missing_p4;

-- Materialize trading names into a flat lookup table
-- Only for ABNs that have trading names and are Active
CREATE TEMP TABLE abr_trading_flat AS
SELECT ar.abn, UPPER(tn) AS trading_name_upper, ar.status_from_date
FROM abr_registry ar,
     unnest(ar.trading_names) AS tn
WHERE ar.status = 'Active'
  AND ar.trading_names IS NOT NULL
  AND array_length(ar.trading_names, 1) > 0;

CREATE INDEX ON abr_trading_flat (trading_name_upper);

-- Match remaining donor names against flattened trading names
CREATE TEMP TABLE donor_abn_trading AS
SELECT DISTINCT ON (dm.name_upper)
  dm.name_upper,
  atf.abn
FROM donors_missing_p4 dm
JOIN abr_trading_flat atf ON atf.trading_name_upper = dm.name_upper
ORDER BY dm.name_upper, atf.status_from_date DESC NULLS LAST;

SELECT 'PHASE 4 matched' AS phase,
       COUNT(*) AS unique_names_matched
FROM donor_abn_trading;

UPDATE political_donations pd
SET donor_abn = tn.abn
FROM donor_abn_trading tn
WHERE pd.donor_abn IS NULL
  AND UPPER(pd.donor_name) = tn.name_upper
  AND LENGTH(pd.donor_name) >= 5;

SELECT 'PHASE 4 (trading names)' AS phase,
       COUNT(*) - COUNT(donor_abn) AS still_missing
FROM political_donations;

DROP TABLE donors_missing_p4;
DROP TABLE donor_abn_trading;
DROP TABLE abr_trading_flat;

-- ============================================================================
-- FINAL: Summary
-- ============================================================================

SELECT 'FINAL' AS phase,
       COUNT(*) AS total,
       COUNT(donor_abn) AS has_abn,
       COUNT(*) - COUNT(donor_abn) AS missing_abn,
       ROUND(100.0 * COUNT(donor_abn) / COUNT(*), 1) AS pct_linked
FROM political_donations;
