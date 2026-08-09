-- POA ratio placement: postcode-level dominance for the multi-council rest.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -v ON_ERROR_STOP=1 -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809150000_poa_ratio_placement.sql
-- REQUIRES: 20260809130000 (ratio ingest, applied 2026-08-09) and
--   20260809140000 (straddler refill, applied 2026-08-09) - this file works
--   the cohort the refill left behind.
-- AFTERWARDS: node --env-file=.env scripts/refresh-views-v2.mjs
--
-- WHY. After the locality-strict refill, 53,981 entities remain stamped
-- unresolved_multi_lga_postcode: their postcode's localities genuinely span
-- councils, so locality unanimity can never decide them. This rung uses the
-- ABS POA->LGA correspondence instead - the population-weighted share of the
-- POSTCODE in each council - and places an entity only where one council
-- holds >= 90% of the postcode's population. The odds any given organisation
-- sits in that council are at least the ratio; below the bar, nothing moves.
--
-- What this rule refuses is the point (measured 2026-08-09): the outstation
-- mega-postcodes stay split - 0872 MacDonnell 37.5%, 0822 East Arnhem 28%,
-- 4875 Torres Strait 54.8%. What clears is metro cores and real towns:
-- 3000 -> Melbourne at 100%, Broome 99.9%, Karratha 100%, Port Augusta 100%.
-- It cannot re-create the Ceduna error class because remote hub postcodes
-- are exactly the ones whose population splits across councils.
--
-- DRY-RUN (measured live 2026-08-09, post-refill):
--   cohort 53,981 -> 33,131 placeable across 275 postcodes; 0 entities on a
--   >=90% postcode fail the candidate guard. Top receivers: Melbourne 3,966 -
--   Darwin 1,114 - Liverpool 1,037 - Central Coast 1,034 - Stirling 832 -
--   Lismore 658 - Wagga Wagga 651 - Subiaco 618. Unplaced-with-postcode
--   72,678 -> ~39,500.
--
-- Guard rails:
--   * Candidate guard: the POA winner (LGA 2022 edition) must match, by code
--     or name, a council the postcode's own localities belong to in
--     abs_locality_lga (LGA 2025 scheme, state-qualified). Values written
--     come from abs_locality_lga, never the POA file, so the 2025 scheme
--     stays uniform. One rename bridges the editions (Moreland 25250 ->
--     Merri-bek 24700). No match, or an ambiguous match -> not placed.
--   * State guard: entities join on postcode AND state, as every pass here.
--   * Provenance: lga_source = 'poa_ratio_dominant', separable forever from
--     locality-derived placements. Reversal is exactly:
--       UPDATE gs_entities SET lga_name = NULL, lga_code = NULL,
--              lga_source = 'unresolved_multi_lga_postcode'
--        WHERE lga_source = 'poa_ratio_dominant';
--     (This pass touches gs_entities only; postcode_geo is not written.)
--
-- Run shape: autocommit, staging tables, batched updates (5000/batch, the
-- 070000 pattern - expect ~7 batches). Idempotent: targets lga_name IS NULL.

-- Phase 1. Postcode winners at the bar.
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

-- Phase 2. Resolve each (postcode, state) through the candidate guard to
-- 2025-scheme values.
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
  VALUES ('25250', '24700')  -- Moreland -> Merri-bek (ABS rename, 2022)
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
       min(c.lga_code) AS lga_code,
       min(w.win_ratio) AS win_ratio
  FROM cand c
  JOIN stg_poa_winners w ON w.poa_code = c.postcode
 WHERE c.lga_code = w.win_code
    OR upper(c.lga_name) = upper(w.win_name)
    OR c.lga_code IN (SELECT new_code FROM lga_renames WHERE old_code = w.win_code)
 GROUP BY 1, 2
HAVING count(DISTINCT c.lga_code) = 1;
CREATE INDEX ON stg_poa_resolved (postcode, state);
ANALYZE stg_poa_resolved;

-- On the record before anything is written.
SELECT 'poa placement decision' AS check,
       (SELECT count(*) FROM gs_entities
         WHERE lga_name IS NULL AND lga_source = 'unresolved_multi_lga_postcode') AS cohort,
       (SELECT count(*) FROM gs_entities e
         JOIN stg_poa_resolved r ON r.postcode = e.postcode AND r.state = e.state
        WHERE e.lga_name IS NULL
          AND e.lga_source = 'unresolved_multi_lga_postcode')                     AS will_place,
       (SELECT count(*) FROM gs_entities e
         JOIN stg_poa_winners w ON w.poa_code = e.postcode
        WHERE e.lga_name IS NULL
          AND e.lga_source = 'unresolved_multi_lga_postcode'
          AND NOT EXISTS (SELECT 1 FROM stg_poa_resolved r
                           WHERE r.postcode = e.postcode AND r.state = e.state)) AS ge90_but_guard_refused;

-- Phase 3. Place, in committed batches.
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
    RAISE NOTICE 'placed % this batch, % so far', batch, total;
  END LOOP;
  RAISE NOTICE 'poa placement complete: % rows', total;
END $$;

-- Phase 4. Refresh the open gap ledger: re-count postcodes still holding
-- unresolved multi-council entities, close the ones this pass emptied.
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

-- Phase 5. Say what happened.
SELECT 'after poa placement' AS check,
       (SELECT count(*) FROM gs_entities WHERE lga_source = 'poa_ratio_dominant')          AS placed_by_poa,
       (SELECT count(*) FROM gs_entities
         WHERE lga_name IS NULL AND lga_source = 'unresolved_multi_lga_postcode')          AS multi_lga_remaining,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL)  AS unplaced_with_postcode,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND lga_source IS NULL)    AS unstamped;

SELECT 'poa placements by state' AS check, state, count(*) AS placed
  FROM gs_entities
 WHERE lga_source = 'poa_ratio_dominant'
 GROUP BY 2
 ORDER BY 3 DESC;
