-- Fix NDIS participant anomalies in lga_cross_system_stats
-- Problem: State-level defaults (33393 for WA, 34015 for SA) assigned to many small LGAs
-- Problem: ndis_budget is state-level everywhere — not useful at LGA level

BEGIN;

-- 1. NULL out WA state-level default (33,393 on 23 LGAs)
UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE state = 'WA' AND ndis_youth_participants = 33393;

-- 2. NULL out SA state-level default (34,015 on 3 LGAs)
UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE state = 'SA' AND ndis_youth_participants = 34015;

-- 3. Fix Croydon QLD (pop ~300, showing 86,767 — clearly wrong name match)
UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE lga_name = 'Croydon' AND state = 'QLD' AND ndis_youth_participants = 86767;

-- 4. Fix Bayside NSW (117,097 — suspicious, likely name collision with VIC)
-- Bayside (Vic.) also shows 109,532 which is suspiciously high for one LGA
UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE lga_name = 'Bayside (NSW)' AND ndis_youth_participants = 117097;

UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE lga_name = 'Bayside (Vic.)' AND ndis_youth_participants = 109532;

-- 5. Fix Unincorporated entries (not real LGAs)
UPDATE lga_cross_system_stats
SET ndis_youth_participants = NULL
WHERE lga_name LIKE 'Unincorporated%';

-- 6. NULL out ndis_budget everywhere — it's state-level, not LGA-level
UPDATE lga_cross_system_stats
SET ndis_budget = NULL;

-- 7. Verify
SELECT
  COUNT(*) AS total,
  COUNT(ndis_youth_participants) AS has_ndis,
  COUNT(ndis_budget) AS has_budget,
  MAX(ndis_youth_participants) AS max_ndis,
  MIN(ndis_youth_participants) FILTER (WHERE ndis_youth_participants > 0) AS min_ndis
FROM lga_cross_system_stats;

COMMIT;
