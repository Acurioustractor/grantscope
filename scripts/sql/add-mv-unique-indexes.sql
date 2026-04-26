-- Add unique indexes to MVs that currently fail CONCURRENTLY refresh.
-- After this runs, refresh-views-v2.mjs can use CONCURRENTLY for these MVs,
-- which means readers can still query the old snapshot during refresh
-- (no read locks, no ~30-second stalls during refresh).
--
-- 2026-04-27 update: applied and verified against live state.
--   - mv_donor_contract_crossref → succeeded (donor_abn unique)
--   - mv_revolving_door → succeeded on id (uuid). The original migration
--     guessed `person_name_normalised` which doesn't exist on this MV;
--     the MV is keyed by entity uuid, not person.
--   - mv_funding_by_lga → BLOCKED. MV has 400+ rows with NULL lga_code and
--     duplicate (lga_code, state) pairs. MV definition needs deduping
--     before a unique index will hold. Stays on non-concurrent refresh.
--   - mv_funding_deserts → BLOCKED. Same class of issue (Adelaide/SA, Penrith/NSW,
--     Greater Geelong/VIC etc. appear multiple times). MV definition needs deduping.
--
-- Three MVs intentionally NOT covered:
--   - mv_foundation_grantees (UNION of two methods — no natural unique key)
--   - mv_donation_contract_timing (composite key with overlap; needs surrogate)
--   - mv_funding_by_lga / mv_funding_deserts (duplicate-key data quality issue)
-- Those stay on non-concurrent refresh; v2 script handles automatically.

-- 1. mv_donor_contract_crossref — keyed by donor_abn (one row per donor)
CREATE UNIQUE INDEX IF NOT EXISTS mv_donor_contract_crossref_pk
  ON mv_donor_contract_crossref (donor_abn);

-- 2. mv_revolving_door — keyed by id (entity uuid, always unique)
CREATE UNIQUE INDEX IF NOT EXISTS mv_revolving_door_pk
  ON mv_revolving_door (id);

-- TODO: After deduping the underlying MV queries, re-introduce:
--   CREATE UNIQUE INDEX IF NOT EXISTS mv_funding_by_lga_unique
--     ON mv_funding_by_lga (lga_code, state);
--   CREATE UNIQUE INDEX IF NOT EXISTS mv_funding_deserts_pk
--     ON mv_funding_deserts (lga_name, state);

-- Verify
SELECT
  'mv_donor_contract_crossref' as mv,
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%') as unique_indexes,
  COUNT(*) as total_indexes
  FROM pg_indexes WHERE tablename = 'mv_donor_contract_crossref'
UNION ALL
SELECT 'mv_revolving_door',
  COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%'),
  COUNT(*)
  FROM pg_indexes WHERE tablename = 'mv_revolving_door';
