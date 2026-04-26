-- Add unique indexes to MVs that currently fail CONCURRENTLY refresh.
-- After this runs, refresh-views-v2.mjs can use CONCURRENTLY for these MVs,
-- which means readers can still query the old snapshot during refresh
-- (no read locks, no ~30-second stalls during refresh).
--
-- Two MVs are intentionally NOT covered here:
--   - mv_foundation_grantees (UNION of two methods — no natural unique key)
--   - mv_donation_contract_timing (composite key with overlap; needs surrogate)
-- Those stay on non-concurrent refresh; v2 script handles automatically.

-- 1. mv_donor_contract_crossref — keyed by donor_abn (one row per donor)
CREATE UNIQUE INDEX IF NOT EXISTS mv_donor_contract_crossref_pk
  ON mv_donor_contract_crossref (donor_abn);

-- 2. mv_funding_by_lga — keyed by (lga_code, state)
-- The original migration declared this but the index may have been dropped.
-- IF NOT EXISTS makes this idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS mv_funding_by_lga_unique
  ON mv_funding_by_lga (lga_code, state);

-- 3. mv_funding_deserts — keyed by (lga_name, state)
-- (lga_code may be null in some derived rows; using name+state which is
-- always present per the GROUP BY clause)
CREATE UNIQUE INDEX IF NOT EXISTS mv_funding_deserts_pk
  ON mv_funding_deserts (lga_name, state);

-- 4. mv_revolving_door — keyed by (person_name_normalised, company_abn)
-- One row per person-company pair (with role context)
CREATE UNIQUE INDEX IF NOT EXISTS mv_revolving_door_pk
  ON mv_revolving_door (person_name_normalised, company_abn);

-- Verify
SELECT
  'mv_donor_contract_crossref' as mv,
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%') as unique_indexes,
  COUNT(*) as total_indexes
  FROM pg_indexes WHERE tablename = 'mv_donor_contract_crossref'
UNION ALL
SELECT 'mv_funding_by_lga',
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%'),
  COUNT(*)
  FROM pg_indexes WHERE tablename = 'mv_funding_by_lga'
UNION ALL
SELECT 'mv_funding_deserts',
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%'),
  COUNT(*)
  FROM pg_indexes WHERE tablename = 'mv_funding_deserts'
UNION ALL
SELECT 'mv_revolving_door',
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%'),
  COUNT(*)
  FROM pg_indexes WHERE tablename = 'mv_revolving_door';
