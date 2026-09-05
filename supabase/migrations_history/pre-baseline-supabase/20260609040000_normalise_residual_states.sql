-- C5 tail: normalise the residual non-canonical gs_entities.state values that the C5
-- lga_code fix (20260609030000) could not reach because these rows have no usable lga_code.
--
-- Scope (tiny): case-variants → canonical; junk placeholders → NULL; and for the few
-- blank/non-canonical rows that DO have a resolvable postcode, derive state from the
-- postcode_geo crosswalk (only 64 — the rest of the no-lga_code pool has no usable postcode
-- either, so it is genuinely the B3 geo-enrichment backlog item, out of scope here).
-- Left untouched on purpose: 'Bali' (overseas), 'Australia Indian Ocean Territories' (OT),
-- and the multi-state national-org string — none map to a single AU state.

BEGIN;

-- Case-variants → canonical abbreviation
UPDATE gs_entities SET state = 'QLD' WHERE state = 'Qld';
UPDATE gs_entities SET state = 'VIC' WHERE state = 'Vic';

-- Junk placeholder values → NULL (not real states)
UPDATE gs_entities SET state = NULL WHERE state IN ('state', 'state-level');

-- Derive state from postcode for blank/non-canonical rows that have a resolvable postcode
UPDATE gs_entities g
SET state = pg.state
FROM postcode_geo pg
WHERE g.postcode = pg.postcode
  AND pg.state IN ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT')
  AND (g.state IS NULL OR g.state = ''
       OR g.state NOT IN ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT'));

COMMIT;
