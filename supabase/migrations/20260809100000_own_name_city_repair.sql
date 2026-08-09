-- Own-name city repair: give 14 councils back their namesake towns.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809100000_own_name_city_repair.sql
-- AFTERWARDS: node --env-file=.env scripts/refresh-views-v2.mjs (or wait for the
--   nightly pg_cron 17:00 UTC refresh).
--
-- WHY. The 20260808120000 postcode_geo rebuild only aligned localities where
-- ABS is unambiguous (lga_count = 1) and left straddlers "untouched rather
-- than guessed at". Untouched meant: still carrying the legacy first-seen
-- council. So WARRNAMBOOL locality sits recorded as Moyne, SUBIACO as
-- Cambridge, HOPE VALE as Douglas, LOCKHART RIVER as Napranum - fourteen
-- councils whose namesake town is credited to a neighbour, most of them the
-- remote-community councils this map exists for. On /atlas they render 100%
-- unplaced off postcodes recorded as someone else's, which reads as honest
-- ambiguity and is actually an artifact.
--
-- THE RULE. A locality that carries a council's own name belongs to that
-- council, even where the ABS suburb boundary spills a sliver into a
-- neighbour. This is the inverse of the Ceduna failure: the resolve-or-null
-- pass was built because postcode-derived guesses land on the SMALLEST
-- community in a postcode (Maralinga Tjarutja swallowing Ceduna); own-name
-- lands on the namesake - the largest. Guarded three ways:
--   * only localities where exactly one council carries the name in that
--     state (COUNT(DISTINCT lga_code) = 1);
--   * entity placement additionally requires the namesake council to be a
--     candidate council of the entity's own postcode (an org whose town says
--     MELBOURNE but whose postcode is pure Port Phillip does not move);
--   * every placement stamped lga_source = 'own_name_town+abs_asgs', so the
--     whole class is auditable and reversible.
--
-- RESIDUAL RISK, stated. Inside a straddling postcode the sliver remains:
-- a St Kilda Road org writing town MELBOURNE from the Port Phillip side will
-- be placed into Melbourne. Bounded by the candidate-set guard, carried by
-- the source stamp.
--
-- DRY-RUN (2026-08-09, live):
--   postcode_geo rows corrected: 28 (26 postcodes, 14 councils)
--   entities placed: 2,550 -> unplaced 83,409 -> ~80,859
--   per council: Melbourne 2,014 · Warrnambool 108 · Nedlands 102 ·
--   Subiaco 93 · Orange 92 · Broken Hill 58 · Port Lincoln 45 ·
--   Coober Pedy 11 · Tumby Bay 8 · Hope Vale 6 · Lockhart 5 ·
--   Lockhart River 4 · West Arnhem 2 · East Arnhem 2
--
-- Does NOT close geo_resolution_gaps rows: own-name resolves entities and
-- locality rows, not whole postcodes (3280 still spans two councils; that is
-- true and stays true).
--
-- Run shape: autocommit, no wrapping transaction (2026-08-08 lesson). Small
-- statements; staging tables so nothing plans as a nested loop. Idempotent:
-- every UPDATE excludes rows already carrying its target value.
-- Reversible: postcode_geo_lga_backup_20260809b, gs_entities_lga_backup_20260809b.

SET statement_timeout = '15min';

-- Phase 0. Backups, committed on their own.
CREATE TABLE IF NOT EXISTS postcode_geo_lga_backup_20260809b AS
SELECT postcode, locality, state, lga_name, lga_code
FROM postcode_geo;

CREATE TABLE IF NOT EXISTS gs_entities_lga_backup_20260809b AS
SELECT id, abn, postcode, state, lga_name, lga_code, lga_source
FROM gs_entities
WHERE lga_name IS NULL;

-- Phase 1. Staging.
DROP TABLE IF EXISTS stg_own_name;
CREATE UNLOGGED TABLE stg_own_name AS
WITH sc(state_name, code) AS (
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
  JOIN sc s ON s.state_name = a.state_name
 WHERE upper(a.lga_name) = upper(a.locality)
   AND a.lga_count >= 2
 GROUP BY 1, 2
HAVING count(DISTINCT a.lga_code) = 1;
CREATE INDEX ON stg_own_name (loc, state);
ANALYZE stg_own_name;

-- Candidate councils per postcode, from the postcode's own localities.
DROP TABLE IF EXISTS stg_pc_candidates;
CREATE UNLOGGED TABLE stg_pc_candidates AS
WITH sc(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
)
SELECT DISTINCT pg.postcode, pg.state, a.lga_code
  FROM postcode_geo pg
  JOIN sc s ON s.code = pg.state
  JOIN abs_locality_lga a
    ON a.locality = upper(pg.locality) AND a.state_name = s.state_name;
CREATE INDEX ON stg_pc_candidates (postcode, state, lga_code);
ANALYZE stg_pc_candidates;

-- Phase 2. Repair postcode_geo: namesake localities get their council back.
-- Dry-run measured 28 rows.
UPDATE postcode_geo p
   SET lga_name = o.lga_name,
       lga_code = o.lga_code
  FROM stg_own_name o
 WHERE o.loc = upper(p.locality)
   AND o.state = p.state
   AND p.lga_name IS DISTINCT FROM o.lga_name;

-- Phase 3. Place unplaced entities whose ACNC town names the council.
-- ACNC abn is unique among rows carrying a town_city (established 20260808130000).
-- Dry-run measured 2,550 rows.
DROP TABLE IF EXISTS stg_own_name_resolved;
CREATE UNLOGGED TABLE stg_own_name_resolved AS
SELECT e.id, o.lga_name, o.lga_code
  FROM gs_entities e
  JOIN acnc_charities c ON c.abn = e.abn AND c.town_city IS NOT NULL
  JOIN stg_own_name o ON o.loc = upper(c.town_city) AND o.state = e.state
 WHERE e.lga_name IS NULL
   AND (e.postcode IS NULL OR EXISTS (
         SELECT 1 FROM stg_pc_candidates pc
          WHERE pc.postcode = e.postcode
            AND pc.state = e.state
            AND pc.lga_code = o.lga_code));
CREATE INDEX ON stg_own_name_resolved (id);
ANALYZE stg_own_name_resolved;

UPDATE gs_entities e
   SET lga_name = r.lga_name,
       lga_code = r.lga_code,
       lga_source = 'own_name_town+abs_asgs'
  FROM stg_own_name_resolved r
 WHERE r.id = e.id
   AND e.lga_name IS NULL;

-- Phase 4. Verify, then clean up staging.
SELECT 'postcode_geo namesake rows now correct' AS check,
       count(*) AS rows
  FROM postcode_geo p
  JOIN stg_own_name o ON o.loc = upper(p.locality) AND o.state = p.state
 WHERE p.lga_name = o.lga_name;

SELECT 'entities placed by own_name_town' AS check,
       count(*) AS rows
  FROM gs_entities
 WHERE lga_source = 'own_name_town+abs_asgs';

SELECT 'unplaced remaining' AS check,
       count(*) AS rows
  FROM gs_entities
 WHERE lga_name IS NULL AND postcode IS NOT NULL;

DROP TABLE IF EXISTS stg_own_name_resolved;
DROP TABLE IF EXISTS stg_pc_candidates;
DROP TABLE IF EXISTS stg_own_name;
