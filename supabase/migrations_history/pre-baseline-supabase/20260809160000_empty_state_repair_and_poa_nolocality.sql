-- Empty-string-state repair + locality-free POA placement for junk-locality postcodes.
--
-- APPLY (Ben, day-shift — approved live 2026-08-09, "fix now" + "wide + distinct stamp"):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -v ON_ERROR_STOP=1 -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809160000_empty_state_repair_and_poa_nolocality.sql
-- REQUIRES: 20260809120000 (state hygiene) and 20260809150000 (POA placement), both applied.
-- AFTERWARDS: node --env-file=.env scripts/refresh-views-v2.mjs
--
-- WHY. Preparing ORIC batch 4670 exposed two nested defects (all measured live 2026-08-09):
--   1. 161 postcode_geo rows across 157 postcodes carry EMPTY-STRING state. 20260809120000
--      repaired NULL states but '' passes `state IS NOT NULL`, so its 4d' stamped every
--      unplaced entity on those postcodes state_conflict against a blank: 2,591 of the
--      2,745 state_conflict stamps (94%) are this artifact. 4670 alone: 1,036 QLD
--      entities "conflicting" with QLD.
--   2. The affected rows' localities are junk — ABS SA2 names ("Bargara - Burnett
--      Heads") and literal postcodes ("4670") — and the junk-locality class is wider:
--      895 postcodes have ZERO ABS-mappable localities in postcode_geo. The 150000 POA
--      pass can never place them because its candidate guard validates the winner
--      through the postcode's own localities. This is where much of the 8,780
--      postcode_unmapped_in_abs bucket comes from.
--
-- WHAT IT DOES.
--   Phase 1  '' -> NULL, then the 120000 sibling/first-digit backfills (verbatim).
--            Dry-run: all 157 postcodes resolve (QLD 98, NSW 34, WA 11, ACT 7, SA 6, TAS 1).
--   Phase 2-3  Reason re-derivation, the 120000 4b'-4f' cascade verbatim.
--   Phase 4  Standard placement re-runs for freed rows: single-council postcode,
--            ACNC town, and the 150000 POA pass (all verbatim, all idempotent).
--   Phase 5  NEW: locality-free POA >=90% for the 895 no-mappable-locality postcodes.
--            Guard: state match + the POA winner must translate to EXACTLY ONE
--            2025-scheme council by code or name (state-qualified, Moreland->Merri-bek
--            bridged); 2,277 of 2,280 winners translate. No locality corroboration
--            exists on these postcodes by definition, so provenance stays separable:
--            lga_source = 'poa_ratio_nolocality' (NEVER 'poa_ratio_dominant').
--            Dry-run: 10,859 entities across 429 postcodes — Brisbane 2,001, Gold
--            Coast 1,343, Sunshine Coast 1,071, Bundaberg 1,059, Fraser Coast 730.
--            Remote splits keep refusing themselves at the 90% bar.
--
-- REVERSAL:
--   placements:  UPDATE gs_entities SET lga_name=NULL, lga_code=NULL,
--                lga_source='unresolved_multi_lga_postcode'
--                WHERE lga_source='poa_ratio_nolocality';  (then re-run 4b'-4f')
--   postcode_geo: restore state from postcode_geo_state_backup_20260809e.
--
-- Run shape: autocommit, small statements, UNLOGGED staging, batched placement
-- updates (5000/batch). Idempotent: every UPDATE guards on current values.

SET statement_timeout = '15min';

-- Phase 0. Backups.
CREATE TABLE IF NOT EXISTS postcode_geo_state_backup_20260809e AS
SELECT postcode, locality, state, lga_name, lga_code
FROM postcode_geo;

CREATE TABLE IF NOT EXISTS gs_entities_reason_backup_20260809b AS
SELECT id, abn, postcode, state, lga_source
FROM gs_entities
WHERE lga_name IS NULL AND postcode IS NOT NULL;

-- Phase 1. Empty-string states -> NULL, then the 120000 backfills verbatim.
UPDATE postcode_geo SET state = NULL WHERE state = '';

-- 1a. From sibling rows of the same postcode where exactly one state exists.
UPDATE postcode_geo p
   SET state = s.state
  FROM (SELECT postcode, min(state) AS state
          FROM postcode_geo
         WHERE state IS NOT NULL
         GROUP BY postcode
        HAVING count(DISTINCT state) = 1) s
 WHERE p.state IS NULL
   AND s.postcode = p.postcode;

-- 1b. From the unambiguous first digit for whatever has no sibling.
UPDATE postcode_geo
   SET state = CASE left(postcode, 1)
                 WHEN '3' THEN 'VIC' WHEN '8' THEN 'VIC'
                 WHEN '4' THEN 'QLD' WHEN '9' THEN 'QLD'
                 WHEN '5' THEN 'SA'  WHEN '6' THEN 'WA'
                 WHEN '7' THEN 'TAS'
               END
 WHERE state IS NULL
   AND left(postcode, 1) IN ('3','4','5','6','7','8','9');

SELECT 'after state repair' AS check,
       (SELECT count(*) FROM postcode_geo WHERE state = '')     AS empty_left,
       (SELECT count(*) FROM postcode_geo WHERE state IS NULL)  AS null_left;

-- Phase 2. ABS locality authority staging (120000 formulation).
DROP TABLE IF EXISTS stg_abs_locs;
CREATE UNLOGGED TABLE stg_abs_locs AS
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
SELECT a.locality, s.code AS state, a.lga_name, a.lga_code, a.lga_count
  FROM abs_locality_lga a
  JOIN sc s ON s.state_name = a.state_name;
CREATE INDEX ON stg_abs_locs (locality, state);
ANALYZE stg_abs_locs;

-- Phase 3. Reason re-derivation (120000 4b'-4f' verbatim).
UPDATE gs_entities
   SET lga_source = NULL
 WHERE lga_name IS NULL
   AND lga_source IN ('state_conflict','postcode_unmapped_in_abs');

UPDATE gs_entities e SET lga_source = 'no_state'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND e.state IS NULL;

-- Pre-materialized helper: correlated EXISTS against postcode_geo per entity row
-- ran >8min on the pooler; this hash-join form ran in seconds (same semantics).
DROP TABLE IF EXISTS stg_pc_state;
CREATE UNLOGGED TABLE stg_pc_state AS
SELECT DISTINCT postcode, state FROM postcode_geo WHERE state IS NOT NULL;
CREATE INDEX ON stg_pc_state (postcode, state);
ANALYZE stg_pc_state;

UPDATE gs_entities e SET lga_source = 'state_conflict'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND EXISTS (SELECT 1 FROM stg_pc_state ps WHERE ps.postcode = e.postcode)
   AND NOT EXISTS (SELECT 1 FROM stg_pc_state ps2
                    WHERE ps2.postcode = e.postcode AND ps2.state = e.state);

DROP TABLE IF EXISTS stg_suffix_fix;
CREATE UNLOGGED TABLE stg_suffix_fix AS
SELECT sf.loc, sf.state
  FROM (SELECT DISTINCT upper(p.locality) AS loc, p.state,
               regexp_replace(upper(p.locality),
                 ' (EAST|WEST|NORTH|SOUTH|CENTRAL|UPPER|LOWER|HEIGHTS|DC|BC|MC)$','') AS base
          FROM postcode_geo p
         WHERE upper(p.locality) ~ ' (EAST|WEST|NORTH|SOUTH|CENTRAL|UPPER|LOWER|HEIGHTS|DC|BC|MC)$'
           AND NOT EXISTS (SELECT 1 FROM stg_abs_locs al0
                            WHERE al0.locality = upper(p.locality) AND al0.state = p.state)) sf
  JOIN stg_abs_locs al ON al.locality = sf.base AND al.state = sf.state
 GROUP BY 1, 2
HAVING count(DISTINCT al.lga_code) = 1;
CREATE INDEX ON stg_suffix_fix (loc, state);
ANALYZE stg_suffix_fix;

-- Pre-materialized helper (same rationale as stg_pc_state above).
DROP TABLE IF EXISTS stg_pc_mappable;
CREATE UNLOGGED TABLE stg_pc_mappable AS
SELECT DISTINCT pg.postcode
  FROM postcode_geo pg
  JOIN stg_abs_locs al ON al.locality = upper(pg.locality) AND al.state = pg.state
UNION
SELECT DISTINCT pg2.postcode
  FROM postcode_geo pg2
  JOIN stg_suffix_fix f ON f.loc = upper(pg2.locality) AND f.state = pg2.state;
CREATE INDEX ON stg_pc_mappable (postcode);
ANALYZE stg_pc_mappable;

UPDATE gs_entities e SET lga_source = 'postcode_unmapped_in_abs'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM stg_pc_mappable m WHERE m.postcode = e.postcode);

UPDATE gs_entities e SET lga_source = 'unresolved_multi_lga_postcode'
 WHERE e.lga_name IS NULL AND e.lga_source IS NULL AND e.postcode IS NOT NULL;

-- Phase 4. Standard placement re-runs for freed rows (all verbatim, all idempotent).
-- 4a. Single-council postcodes, state-qualified.
DROP TABLE IF EXISTS stg_pc_single;
CREATE UNLOGGED TABLE stg_pc_single AS
SELECT pg.postcode, pg.state,
       min(al.lga_name) AS lga_name,
       min(al.lga_code) AS lga_code
  FROM postcode_geo pg
  JOIN stg_abs_locs al ON al.locality = upper(pg.locality) AND al.state = pg.state
 GROUP BY 1, 2
HAVING count(DISTINCT al.lga_code) = 1;
CREATE INDEX ON stg_pc_single (postcode, state);
ANALYZE stg_pc_single;

UPDATE gs_entities e
   SET lga_name = pc.lga_name,
       lga_code = pc.lga_code,
       lga_source = 'single_lga_postcode'
  FROM stg_pc_single pc
 WHERE pc.postcode = e.postcode
   AND pc.state = e.state
   AND e.lga_name IS NULL;

-- 4b. ACNC town on unambiguous locality.
DROP TABLE IF EXISTS stg_town_unamb;
CREATE UNLOGGED TABLE stg_town_unamb AS
SELECT al.locality AS loc, al.state,
       min(al.lga_name) AS lga_name,
       min(al.lga_code) AS lga_code
  FROM stg_abs_locs al
 WHERE al.lga_count = 1
 GROUP BY 1, 2
HAVING count(*) = 1;
CREATE INDEX ON stg_town_unamb (loc, state);
ANALYZE stg_town_unamb;

UPDATE gs_entities e
   SET lga_name = u.lga_name,
       lga_code = u.lga_code,
       lga_source = 'acnc_town_city+abs_asgs'
  FROM acnc_charities c
  JOIN stg_town_unamb u ON u.loc = upper(c.town_city)
 WHERE c.abn = e.abn
   AND c.town_city IS NOT NULL
   AND u.state = e.state
   AND e.lga_name IS NULL;

-- 4c. The 150000 POA pass, re-run (locality-corroborated; stamp poa_ratio_dominant).
DROP TABLE IF EXISTS stg_poa_winners;
CREATE UNLOGGED TABLE stg_poa_winners AS
SELECT poa_code,
       (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_name,
       (array_agg(lga_code ORDER BY ratio DESC))[1] AS win_code,
       max(ratio)                                   AS win_ratio
  FROM abs_poa_lga_ratio
 GROUP BY 1
HAVING max(ratio) >= 0.9;
CREATE INDEX ON stg_poa_winners (poa_code);
ANALYZE stg_poa_winners;

DROP TABLE IF EXISTS stg_poa_resolved;
CREATE UNLOGGED TABLE stg_poa_resolved AS
WITH sc(state_name, code) AS (
  VALUES ('Australian Capital Territory','ACT'),
         ('New South Wales','NSW'),
         ('Northern Territory','NT'),
         ('Queensland','QLD'),
         ('South Australia','SA'),
         ('Tasmania','TAS'),
         ('Victoria','VIC'),
         ('Western Australia','WA')
),
lga_renames(old_code, new_code) AS (
  VALUES ('25250', '24700')
),
cand AS (
  SELECT DISTINCT p.postcode, p.state, a.lga_name, a.lga_code
    FROM postcode_geo p
    JOIN sc s ON s.code = p.state
    JOIN abs_locality_lga a
      ON a.locality = upper(p.locality) AND a.state_name = s.state_name
   WHERE p.postcode IN (SELECT poa_code FROM stg_poa_winners)
)
SELECT c.postcode, c.state,
       min(c.lga_name) AS lga_name,
       min(c.lga_code) AS lga_code
  FROM cand c
  JOIN stg_poa_winners w ON w.poa_code = c.postcode
 WHERE c.lga_code = w.win_code
    OR upper(c.lga_name) = upper(w.win_name)
    OR c.lga_code IN (SELECT new_code FROM lga_renames WHERE old_code = w.win_code)
 GROUP BY 1, 2
HAVING count(DISTINCT c.lga_code) = 1;
CREATE INDEX ON stg_poa_resolved (postcode, state);
ANALYZE stg_poa_resolved;

DO $$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    UPDATE gs_entities e
       SET lga_name = s.lga_name,
           lga_code = s.lga_code,
           lga_source = 'poa_ratio_dominant'
      FROM stg_poa_resolved s
     WHERE e.id IN (
       SELECT e2.id
         FROM gs_entities e2
         JOIN stg_poa_resolved s2 ON s2.postcode = e2.postcode AND s2.state = e2.state
        WHERE e2.lga_name IS NULL
          AND e2.lga_source = 'unresolved_multi_lga_postcode'
          AND e2.postcode IS NOT NULL
        LIMIT 5000
     )
       AND s.postcode = e.postcode
       AND s.state = e.state;
    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
    RAISE NOTICE 'poa standard: placed % this batch, % so far', batch, total;
  END LOOP;
  RAISE NOTICE 'poa standard re-run complete: % rows', total;
END $$;

-- Phase 5. NEW: locality-free POA placement for no-mappable-locality postcodes.
-- 5a. Winner translation to the 2025 scheme WITHOUT locality corroboration:
--     state-qualified code/name match in abs_locality_lga, exactly one council.
DROP TABLE IF EXISTS stg_poa_translate;
CREATE UNLOGGED TABLE stg_poa_translate AS
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
SELECT w.poa_code, s.code AS state,
       min(a.lga_name) AS lga_name, min(a.lga_code) AS lga_code
  FROM stg_poa_winners w
  JOIN sc s ON true
  JOIN abs_locality_lga a
    ON a.state_name = s.state_name
   AND (a.lga_code = w.win_code
        OR upper(a.lga_name) = upper(w.win_name)
        OR a.lga_code = CASE w.win_code WHEN '25250' THEN '24700' END)
 GROUP BY 1, 2
HAVING count(DISTINCT a.lga_code) = 1;
CREATE INDEX ON stg_poa_translate (poa_code, state);
ANALYZE stg_poa_translate;

-- 5b. Postcodes with zero ABS-mappable localities (single stated state).
DROP TABLE IF EXISTS stg_nomap;
CREATE UNLOGGED TABLE stg_nomap AS
SELECT p.postcode, min(p.state) AS state
  FROM postcode_geo p
 WHERE p.state IS NOT NULL
 GROUP BY p.postcode
HAVING count(DISTINCT p.state) = 1
   AND bool_and(NOT EXISTS (
     SELECT 1 FROM stg_abs_locs al
      WHERE al.locality = upper(p.locality) AND al.state = p.state));
CREATE INDEX ON stg_nomap (postcode, state);
ANALYZE stg_nomap;

-- On the record before writing.
SELECT 'nolocality decision' AS check,
       (SELECT count(*) FROM stg_nomap) AS nomap_postcodes,
       (SELECT count(*) FROM gs_entities e
          JOIN stg_nomap n ON n.postcode = e.postcode AND n.state = e.state
          JOIN stg_poa_translate t ON t.poa_code = e.postcode AND t.state = e.state
         WHERE e.lga_name IS NULL
           AND e.lga_source IN ('state_conflict','postcode_unmapped_in_abs','unresolved_multi_lga_postcode')) AS will_place;

-- 5c. Place, in committed batches. Stamp is poa_ratio_nolocality — separable forever.
DO $$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    UPDATE gs_entities e
       SET lga_name = t.lga_name,
           lga_code = t.lga_code,
           lga_source = 'poa_ratio_nolocality'
      FROM stg_poa_translate t
     WHERE e.id IN (
       SELECT e2.id
         FROM gs_entities e2
         JOIN stg_nomap n2 ON n2.postcode = e2.postcode AND n2.state = e2.state
         JOIN stg_poa_translate t2 ON t2.poa_code = e2.postcode AND t2.state = e2.state
        WHERE e2.lga_name IS NULL
          AND e2.lga_source IN ('state_conflict','postcode_unmapped_in_abs','unresolved_multi_lga_postcode')
        LIMIT 5000
     )
       AND t.poa_code = e.postcode
       AND t.state = e.state;
    GET DIAGNOSTICS batch = ROW_COUNT;
    total := total + batch;
    EXIT WHEN batch = 0;
    RAISE NOTICE 'poa nolocality: placed % this batch, % so far', batch, total;
  END LOOP;
  RAISE NOTICE 'poa nolocality complete: % rows', total;
END $$;

-- Phase 6. Gap ledger refresh (150000 formulation).
UPDATE geo_resolution_gaps g
   SET affected_entities = c.n,
       affected_community_controlled = c.cc,
       detected_at = now()
  FROM (
    SELECT postcode,
           count(*) AS n,
           count(*) FILTER (WHERE is_community_controlled) AS cc
      FROM gs_entities
     WHERE lga_name IS NULL
       AND lga_source = 'unresolved_multi_lga_postcode'
     GROUP BY postcode
  ) c
 WHERE c.postcode = g.postcode
   AND g.issue = 'Postcode spans multiple council areas and the entity record carries no locality'
   AND g.resolved_at IS NULL;

UPDATE geo_resolution_gaps g
   SET resolved_at = now()
 WHERE g.issue = 'Postcode spans multiple council areas and the entity record carries no locality'
   AND g.resolved_at IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM gs_entities e
      WHERE e.postcode = g.postcode
        AND e.lga_name IS NULL
        AND e.lga_source = 'unresolved_multi_lga_postcode'
   );

-- Phase 7. Say what happened.
SELECT 'after repair+sweep' AS check,
       (SELECT count(*) FROM gs_entities WHERE lga_source = 'poa_ratio_nolocality')          AS placed_nolocality,
       (SELECT count(*) FROM gs_entities WHERE lga_source = 'poa_ratio_dominant')            AS placed_poa_std,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL)    AS unplaced_with_postcode,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND lga_source IS NULL
          AND postcode IS NOT NULL)                                                          AS unstamped;

SELECT COALESCE(lga_source,'(NULL)') AS reason, count(*) AS entities
  FROM gs_entities
 WHERE lga_name IS NULL AND postcode IS NOT NULL
 GROUP BY 1 ORDER BY 2 DESC;

SELECT 'nolocality by state' AS check, state, count(*) AS placed
  FROM gs_entities
 WHERE lga_source = 'poa_ratio_nolocality'
 GROUP BY 2 ORDER BY 3 DESC;

SELECT '4670 spot check' AS check, COALESCE(lga_name,'(unplaced)') AS lga,
       COALESCE(lga_source,'(none)') AS source, count(*)
  FROM gs_entities WHERE postcode = '4670'
 GROUP BY 2, 3 ORDER BY 4 DESC;

DROP TABLE IF EXISTS stg_nomap;
DROP TABLE IF EXISTS stg_poa_translate;
DROP TABLE IF EXISTS stg_poa_resolved;
DROP TABLE IF EXISTS stg_poa_winners;
DROP TABLE IF EXISTS stg_town_unamb;
DROP TABLE IF EXISTS stg_pc_single;
DROP TABLE IF EXISTS stg_suffix_fix;
DROP TABLE IF EXISTS stg_abs_locs;
DROP TABLE IF EXISTS stg_pc_state;
DROP TABLE IF EXISTS stg_pc_mappable;

-- APPLIED 2026-08-09 (Ben live, day-shift): first run hit the 10-min shell cap
-- mid-Phase-3 (autocommit — everything prior committed); resumed via staged
-- chunks with identical semantics. Outcome matched dry-run exactly: 10,859
-- placed poa_ratio_nolocality (QLD 9,710) · state_conflict 2,745 -> 170 ·
-- unmapped 11,355 -> 496 · unplaced-with-postcode 39,450 -> 28,591 · unstamped 0.
