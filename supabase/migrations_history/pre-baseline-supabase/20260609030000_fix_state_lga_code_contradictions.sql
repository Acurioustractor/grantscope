-- C5: correct `state` where it contradicts the authoritative ABS lga_code, in LOCKSTEP
-- across gs_entities and postcode_geo.
--
-- Why lockstep: mv_funding_deserts FULL JOINs the disadvantage side (postcode_geo) to the
-- power side (mv_entity_power_index <- gs_entities.state) on (lga_name, state). Correcting
-- one side alone creates phantom split rows (a "Laverton WA / 0 entities" ghost beside the
-- real "Laverton NT / 85"). Fixing both from the same source (lga_code) keeps them aligned.
--
-- Source of truth: ABS lga_code first digit = state (1 NSW .. 8 ACT), 99.97% populated.
-- Scope: codes 1-8 only; rows without a usable lga_code are left untouched. Also normalises
-- case variants ("Qld" -> "QLD") for code-bearing rows. Follows the 2026-06-09 postcode_geo
-- NULL backfill (20260609020000); this adds the contradiction corrections + the gs_entities
-- side (2,393 null + 4,556 wrong in gs_entities; 130 wrong in postcode_geo).

BEGIN;

UPDATE gs_entities g
SET state = m.st
FROM (VALUES ('1','NSW'),('2','VIC'),('3','QLD'),('4','SA'),
             ('5','WA'),('6','TAS'),('7','NT'),('8','ACT')) AS m(d, st)
WHERE LEFT(g.lga_code, 1) = m.d
  AND (g.state IS NULL OR g.state = '' OR g.state <> m.st);

UPDATE postcode_geo p
SET state = m.st
FROM (VALUES ('1','NSW'),('2','VIC'),('3','QLD'),('4','SA'),
             ('5','WA'),('6','TAS'),('7','NT'),('8','ACT')) AS m(d, st)
WHERE LEFT(p.lga_code, 1) = m.d
  AND (p.state IS NULL OR p.state = '' OR p.state <> m.st);

COMMIT;
