-- Rebuild postcode_geo.lga_name / lga_code from ABS ASGS.
--
-- postcode_geo stored one council per postcode and, where a postcode spanned
-- several, kept whichever was seen first. Postcode 5690 spans three, so every
-- locality in it, Ceduna township and Koonibba included, was recorded as
-- Maralinga Tjarutja. Anything keyed on that column inherited the error:
-- crime_stats_lga filed 905 offences and 336 assaults reported in Ceduna
-- against a community of a few hundred people, and mv_funding_by_lga credited
-- Ceduna's organisations to the wrong council.
--
-- abs_locality_lga (ABS ASGS Ed3 SAL_2021_AUST + LGA_2025_AUST) is the
-- authority and was already in the database. This aligns postcode_geo to it.
--
-- Scope and deliberate limits:
--   * Locality level, not postcode level. That is the whole point: CEDUNA and
--     OAK VALLEY share postcode 5690 and belong to different councils.
--   * Only where ABS is unambiguous (lga_count = 1 and one row per
--     locality+state). Localities that genuinely straddle councils are left
--     untouched rather than guessed at.
--   * Joined on locality AND state. Locality names repeat across states, and
--     matching on name alone fans out and misassigns.
--
-- Does NOT touch gs_entities.lga_name, which carries the same error but can
-- only be resolved by postcode and so cannot be fixed this way for any
-- multi-council postcode. Tracked separately.
--
-- Reversible: prior values are copied to postcode_geo_lga_backup_20260808.

BEGIN;

CREATE TABLE IF NOT EXISTS postcode_geo_lga_backup_20260808 AS
SELECT postcode, locality, state, lga_name, lga_code
FROM postcode_geo;

WITH state_codes(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
),
unambiguous AS (
  SELECT upper(a.locality) AS loc,
         s.code            AS state,
         min(a.lga_name)   AS lga_name,
         min(a.lga_code)   AS lga_code
    FROM abs_locality_lga a
    JOIN state_codes s ON s.state_name = a.state_name
   WHERE a.lga_count = 1
   GROUP BY 1, 2
  HAVING count(*) = 1
)
UPDATE postcode_geo p
   SET lga_name = u.lga_name,
       lga_code = u.lga_code
  FROM unambiguous u
 WHERE u.loc = upper(p.locality)
   AND u.state = p.state
   AND p.lga_name IS DISTINCT FROM u.lga_name;

COMMIT;
