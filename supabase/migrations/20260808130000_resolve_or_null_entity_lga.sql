-- Place gs_entities in a council where we can, and admit we cannot where we can't.
--
-- gs_entities.lga_name was derived from postcode. Postcode 5690 spans four
-- councils, so all 97 Ceduna-region organisations were stamped Maralinga
-- Tjarutja, and mv_funding_by_lga credited a town's funding to a community of
-- a few hundred people. Rebuilding postcode_geo (20260808120000) fixed the
-- locality table but not this column, because entities carry a postcode and no
-- locality, so there is nothing here to rebuild from.
--
-- Two passes, in this order:
--
--   Pass 1, resolve. Where the entity is an ACNC-registered charity, its
--   town_city is a locality, and that locality maps to exactly one council in
--   ABS ASGS, use it. Stamped lga_source = 'acnc_town_city+abs_asgs'.
--
--   Pass 2, null. Everything else in a multi-council postcode loses its
--   lga_name. A postcode-derived council in a postcode that spans several is a
--   guess wearing the costume of a fact, and the Ceduna case shows the guess
--   lands on the smallest community in the postcode. Stamped lga_source =
--   'unresolved_multi_lga_postcode' so the nulls are legible rather than
--   looking like missing data, and recorded in geo_resolution_gaps the same way
--   postcode 0872 already is.
--
-- Entities in single-council postcodes are not touched by either pass.
--
-- ALTERNATIVE, if nulling proves too blunt: replace pass 2's null with a
-- lga_source stamp alone, keeping lga_name and letting consumers filter on
-- provenance. That preserves the rollups at the cost of leaving a wrong value
-- in place for anything that does not check lga_source. Nulling was chosen
-- because most consumers will not check.
--
-- Reversible: prior values in gs_entities_lga_backup_20260808.

BEGIN;

CREATE TABLE IF NOT EXISTS gs_entities_lga_backup_20260808 AS
SELECT id, abn, postcode, state, lga_name, lga_code, lga_source
FROM gs_entities;

-- Pre-materialised with indexes. The equivalent inline subqueries plan as a
-- nested loop over a Materialize node and do not finish.
CREATE TEMP TABLE _unamb ON COMMIT DROP AS
WITH state_codes(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
)
SELECT upper(a.locality) AS loc,
       s.code            AS state,
       min(a.lga_name)   AS lga_name,
       min(a.lga_code)   AS lga_code
  FROM abs_locality_lga a
  JOIN state_codes s ON s.state_name = a.state_name
 WHERE a.lga_count = 1
 GROUP BY 1, 2
HAVING count(*) = 1;
CREATE INDEX ON _unamb (loc, state);
ANALYZE _unamb;

CREATE TEMP TABLE _multi ON COMMIT DROP AS
SELECT p.postcode, p.state
  FROM postcode_geo p
  JOIN abs_locality_lga a ON upper(a.locality) = upper(p.locality)
 GROUP BY p.postcode, p.state
HAVING count(DISTINCT a.lga_name) > 1;
CREATE INDEX ON _multi (postcode, state);
ANALYZE _multi;

-- ACNC abn is unique among rows carrying a town_city, so this cannot fan out.
CREATE TEMP TABLE _resolved ON COMMIT DROP AS
SELECT e.id, u.lga_name, u.lga_code
  FROM gs_entities e
  JOIN _multi m ON m.postcode = e.postcode AND m.state = e.state
  JOIN acnc_charities c ON c.abn = e.abn AND c.town_city IS NOT NULL
  JOIN _unamb u ON u.loc = upper(c.town_city) AND u.state = e.state;
CREATE INDEX ON _resolved (id);
ANALYZE _resolved;

-- Pass 1
UPDATE gs_entities e
   SET lga_name = r.lga_name,
       lga_code = r.lga_code,
       lga_source = 'acnc_town_city+abs_asgs'
  FROM _resolved r
 WHERE r.id = e.id;

-- Pass 2
UPDATE gs_entities e
   SET lga_name = NULL,
       lga_code = NULL,
       lga_source = 'unresolved_multi_lga_postcode'
  FROM _multi m
 WHERE m.postcode = e.postcode
   AND m.state = e.state
   AND e.lga_name IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM _resolved r WHERE r.id = e.id);

INSERT INTO geo_resolution_gaps
  (postcode, issue, affected_entities, affected_community_controlled, required_source, detected_at)
SELECT e.postcode,
       'Postcode spans multiple council areas and the entity record carries no locality',
       count(*),
       count(*) FILTER (WHERE e.is_community_controlled),
       'A street address or locality per entity, from ABR or ORIC. Neither currently stores one: both hold postcode and state only.',
       now()
  FROM gs_entities e
 WHERE e.lga_source = 'unresolved_multi_lga_postcode'
 GROUP BY e.postcode
ON CONFLICT (postcode, issue) DO UPDATE
   SET affected_entities = EXCLUDED.affected_entities,
       affected_community_controlled = EXCLUDED.affected_community_controlled,
       detected_at = EXCLUDED.detected_at;

DO $$
DECLARE resolved_n int; nulled_n int; gaps_n int;
BEGIN
  SELECT count(*) INTO resolved_n FROM gs_entities WHERE lga_source = 'acnc_town_city+abs_asgs';
  SELECT count(*) INTO nulled_n   FROM gs_entities WHERE lga_source = 'unresolved_multi_lga_postcode';
  SELECT count(*) INTO gaps_n     FROM geo_resolution_gaps WHERE resolved_at IS NULL;
  RAISE NOTICE 'resolved by ACNC locality: %', resolved_n;
  RAISE NOTICE 'nulled as unplaceable:     %', nulled_n;
  RAISE NOTICE 'open geo_resolution_gaps:  %', gaps_n;
END $$;

COMMIT;
