-- Backfill postcode_geo.state from the authoritative ABS lga_code (first digit = state)
-- for rows where state is currently NULL/empty.
--
-- Why: the funding-deserts report showed 227 LGAs (39% of rows) as state "Unknown".
-- All 227 are zero-entity LGAs whose state comes only from postcode_geo, where state
-- was null for ~9% of postcodes. The ABS lga_code first digit encodes the state and is
-- 99.97% populated and reliable, so it is the correct source of truth.
--
-- Effect: fills the 227 "Unknown" desert rows and collapses the blank-state phantom
-- splits (e.g. a ghost "Barkly / blank / 0 entities / score 190" merges into the real
-- "Barkly / NT / 33 entities" row), correcting the worst-deserts ranking.
--
-- Scope: NULLs only, lga_codes 1-8 (NSW VIC QLD SA WA TAS NT ACT). Deliberately NOT
-- touching rows where state is already populated. Border-LGA contradiction corrections
-- (e.g. Laverton coded NT but lga_code 54970 = WA) are deferred: correcting them safely
-- also requires a coordinated gs_entities.state fix (~7K rows) + an mv_entity_power_index
-- refresh, or the FULL JOIN in mv_funding_deserts would create new phantom rows. Tracked
-- as a separate follow-up.

UPDATE postcode_geo
SET state = CASE LEFT(lga_code, 1)
    WHEN '1' THEN 'NSW'
    WHEN '2' THEN 'VIC'
    WHEN '3' THEN 'QLD'
    WHEN '4' THEN 'SA'
    WHEN '5' THEN 'WA'
    WHEN '6' THEN 'TAS'
    WHEN '7' THEN 'NT'
    WHEN '8' THEN 'ACT'
  END
WHERE (state IS NULL OR state = '')
  AND lga_code ~ '^[1-8]';

-- Refresh the two MVs that read postcode_geo (non-concurrent: mv_funding_deserts has
-- known duplicate-key constraints and must refresh non-concurrently).
REFRESH MATERIALIZED VIEW mv_funding_by_postcode;
REFRESH MATERIALIZED VIEW mv_funding_deserts;
