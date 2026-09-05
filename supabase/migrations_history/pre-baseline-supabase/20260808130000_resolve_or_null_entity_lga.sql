-- Place gs_entities in a council where we can, and admit we cannot where we can't.
--
-- gs_entities.lga_name was derived from postcode. Postcode 5690 spans four
-- councils, so all 97 Ceduna-region organisations were stamped Maralinga
-- Tjarutja, and mv_funding_by_lga credited a town's funding to a community of
-- a few hundred people. Rebuilding postcode_geo (20260808120000) fixed the
-- locality table but not this column, because entities carry a postcode and no
-- locality, so there is nothing here to rebuild from.
--
--   Pass 1, resolve. Where the entity is an ACNC-registered charity, its
--   town_city is a locality, and that locality maps to exactly one council in
--   ABS ASGS, use it. Stamped lga_source = 'acnc_town_city+abs_asgs'.
--
--   Pass 2, null. Everything else in a multi-council postcode loses its
--   lga_name. A postcode-derived council in a postcode spanning several is a
--   guess wearing the costume of a fact, and the Ceduna case shows the guess
--   lands on the smallest community in the postcode. Stamped lga_source =
--   'unresolved_multi_lga_postcode' so the nulls read as recorded ignorance
--   rather than missing data, and logged in geo_resolution_gaps the same way
--   postcode 0872 already is.
--
-- Entities in single-council postcodes are untouched by both passes.
--
-- RUN SHAPE. The first version wrapped everything in one transaction. It got
-- through pass 1 and died in pass 2 after five minutes, rolling back all of it:
-- a ~68,000 row UPDATE holds its locks too long for the pooler. This version
-- runs in autocommit with real staging tables instead of temp ones, and chunks
-- pass 2 into batches that commit as they go. Safe to re-run: every phase is
-- idempotent and pass 2 resumes where it stopped, because a row it has already
-- nulled no longer matches its own WHERE clause.
--
-- Reversible: prior values in gs_entities_lga_backup_20260808.

SET statement_timeout = '15min';

-- Phase 0. Backup, committed on its own so a later failure cannot discard it.
CREATE TABLE IF NOT EXISTS gs_entities_lga_backup_20260808 AS
SELECT id, abn, postcode, state, lga_name, lga_code, lga_source
FROM gs_entities;

-- Phase 1. Staging. Real tables, not temp: they must outlive each batch commit.
-- Pre-materialised and indexed because the inline equivalents plan as a nested
-- loop over a Materialize node and do not finish.
DROP TABLE IF EXISTS stg_lga_unamb;
CREATE UNLOGGED TABLE stg_lga_unamb AS
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
CREATE INDEX ON stg_lga_unamb (loc, state);
ANALYZE stg_lga_unamb;

DROP TABLE IF EXISTS stg_lga_multi;
CREATE UNLOGGED TABLE stg_lga_multi AS
SELECT p.postcode, p.state
  FROM postcode_geo p
  JOIN abs_locality_lga a ON upper(a.locality) = upper(p.locality)
 GROUP BY p.postcode, p.state
HAVING count(DISTINCT a.lga_name) > 1;
CREATE INDEX ON stg_lga_multi (postcode, state);
ANALYZE stg_lga_multi;

-- ACNC abn is unique among rows carrying a town_city, so this cannot fan out.
DROP TABLE IF EXISTS stg_lga_resolved;
CREATE UNLOGGED TABLE stg_lga_resolved AS
SELECT e.id, u.lga_name, u.lga_code
  FROM gs_entities e
  JOIN stg_lga_multi m ON m.postcode = e.postcode AND m.state = e.state
  JOIN acnc_charities c ON c.abn = e.abn AND c.town_city IS NOT NULL
  JOIN stg_lga_unamb u ON u.loc = upper(c.town_city) AND u.state = e.state;
CREATE INDEX ON stg_lga_resolved (id);
ANALYZE stg_lga_resolved;

-- Phase 2. Resolve. Measured at 7,538 rows and seconds of work.
UPDATE gs_entities e
   SET lga_name = r.lga_name,
       lga_code = r.lga_code,
       lga_source = 'acnc_town_city+abs_asgs'
  FROM stg_lga_resolved r
 WHERE r.id = e.id
   AND e.lga_source IS DISTINCT FROM 'acnc_town_city+abs_asgs';

-- Phase 3. Null, in committed batches. The WHERE excludes rows already nulled,
-- so each pass shrinks the remaining set and a re-run picks up mid-way.
DO $$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    UPDATE gs_entities e
       SET lga_name = NULL,
           lga_code = NULL,
           lga_source = 'unresolved_multi_lga_postcode'
     WHERE e.id IN (
       SELECT e2.id
         FROM gs_entities e2
         JOIN stg_lga_multi m ON m.postcode = e2.postcode AND m.state = e2.state
         LEFT JOIN stg_lga_resolved r ON r.id = e2.id
        WHERE e2.lga_name IS NOT NULL
          AND r.id IS NULL
        LIMIT 5000
     );
    GET DIAGNOSTICS batch = ROW_COUNT;
    EXIT WHEN batch = 0;
    total := total + batch;
    COMMIT;
    RAISE NOTICE 'nulled % this batch, % so far', batch, total;
  END LOOP;
  RAISE NOTICE 'pass 2 complete: % rows nulled', total;
END $$;

-- Phase 4. Record what we could not place, so the gap is a task and not a shrug.
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

DROP TABLE IF EXISTS stg_lga_resolved;
DROP TABLE IF EXISTS stg_lga_multi;
DROP TABLE IF EXISTS stg_lga_unamb;
