-- Justice Funding Data Quality Fixes
-- 2026-03-20
--
-- Issues:
-- 1. Duplicate sector: 'youth-justice' (320 rows, ROGS aggregates) vs 'youth_justice' (11,280 rows)
-- 2. Non-justice records: 444 "Outside Australia" federal procurement contracts ($1.06B)
--    including missiles, ammunition, embassy leases, patent tools
-- 3. Sector naming inconsistency: some use hyphens, some underscores

BEGIN;

-- 1. Normalize sector: youth-justice → youth_justice (320 rows)
UPDATE justice_funding
SET sector = 'youth_justice'
WHERE sector = 'youth-justice';

-- 2. Delete non-justice federal records with state = 'Outside Australia'
-- These are federal procurement contracts that got imported by mistake
DELETE FROM justice_funding
WHERE state = 'Outside Australia' AND sector = 'federal';

-- 3. Normalize other hyphenated sectors to underscores for consistency
UPDATE justice_funding
SET sector = REPLACE(sector, '-', '_')
WHERE sector LIKE '%-%';

COMMIT;

-- Verify
SELECT sector, COUNT(*) as records, ROUND(SUM(amount_dollars)::numeric, 0) as total_dollars
FROM justice_funding
GROUP BY sector
ORDER BY total_dollars DESC NULLS LAST;

SELECT state, COUNT(*) as records
FROM justice_funding
GROUP BY state
ORDER BY records DESC;
