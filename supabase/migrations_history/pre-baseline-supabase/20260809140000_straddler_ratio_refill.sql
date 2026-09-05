-- Straddler ratio refill: the deliberate resolution Ben's null verdict pointed at.
--
-- APPLY (Ben, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809140000_straddler_ratio_refill.sql
-- REQUIRES: 20260809130000_abs_correspondence_ratios.sql applied first
--   (it is - applied 2026-08-09 as part of the explicitly-instructed ingest;
--   abs_sal_lga_ratio 16,372 rows, ratio closure exact).
-- AFTERWARDS: node --env-file=.env scripts/refresh-views-v2.mjs
--
-- WHY. 20260809120000 nulled 689 straddler postcode_geo rows (locality spans
-- two+ councils; the stored value was the ingest's first-seen coin flip, 227
-- of them provably wrong). Ben's verdict: null rather than keep, and refill
-- deliberately from ABS correspondence ratios - the population-weighted share
-- of each locality that falls in each council. This is that refill:
--   * winner ratio >= 0.9  -> the locality goes to its dominant council.
--   * anything less        -> stays NULL. A 60/40 locality is a genuine
--                             split; writing either side would be the same
--                             coin flip we just retired.
-- The ratio is per-SAL, so a small community sharing a postcode with a big
-- town keeps its own locality row - this cannot re-create the Ceduna /
-- Maralinga Tjarutja error class (the anti-Ceduna direction, own-name
-- precedent from 20260809100000).
--
-- DRY-RUN (measured live 2026-08-09 before writing this file):
--   693 target rows ->  365 refill (345 localities, >=90% dominant)
--                       323 stay null (majority 50-90%)
--                         5 stay null (genuine split <50%)
--                         0 without a unique SAL name match
--   82 postcodes become fully decided -> 7,435 unplaced entities placeable
--   (state-matched; top receivers: Wyndham 1,105 - Melbourne 568 -
--    Canterbury-Bankstown 465 - Barossa 396 - Moonee Valley 373 - Broome 335).
--
-- LGA edition note. Ratios are SAL 2021 -> LGA 2021; abs_locality_lga holds
-- the LGA 2025 scheme. Values written come from abs_locality_lga's candidate
-- rows (2025 names/codes), selected by the ratio winner via code-or-name
-- match. One rename bridges the editions: Moreland 25250 -> Merri-bek 24700
-- (ABS rename, 2022; carries Fawkner VIC at 98.1% dominance). Anything else
-- unmatched stays NULL and prints.
--
-- Run shape: autocommit, staging tables, batched entity updates (5000/batch,
-- the 070000 pattern). Idempotent: every phase targets lga_name IS NULL.
-- Reversible: postcode_geo rows in postcode_geo_lga_backup_20260809e;
-- entity placements carry lga_source = 'straddler_ratio_dominant', so the
-- reversal is UPDATE ... SET lga_name = NULL, lga_code = NULL,
-- lga_source = 'unresolved_multi_lga_postcode' WHERE lga_source =
-- 'straddler_ratio_dominant'.

-- Phase 0. Backup the rows this refill may touch.
CREATE TABLE IF NOT EXISTS postcode_geo_lga_backup_20260809e AS
SELECT postcode, locality, state, lga_name, lga_code
  FROM postcode_geo
 WHERE lga_name IS NULL;

-- Phase 1. Ratio winners, one per SAL name. The HAVING guard drops the
-- handful of names that are not nationally unique in SAL 2021 - a name that
-- could mean two places decides nothing.
DROP TABLE IF EXISTS stg_ratio_winners;
CREATE UNLOGGED TABLE stg_ratio_winners AS
SELECT upper(sal_name) AS loc,
       (array_agg(lga_code ORDER BY ratio DESC))[1] AS win_code,
       (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_name,
       max(ratio)                                   AS win_ratio
  FROM abs_sal_lga_ratio
 GROUP BY 1
HAVING count(DISTINCT sal_code) = 1;
CREATE INDEX ON stg_ratio_winners (loc);
ANALYZE stg_ratio_winners;

-- Phase 2. Resolve each null straddler row to its 2025-scheme value.
DROP TABLE IF EXISTS stg_straddler_refill;
CREATE UNLOGGED TABLE stg_straddler_refill AS
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
  -- ABS LGA renames between the 2021 ratio edition and the 2025 candidate
  -- scheme. One is known to matter here: Moreland -> Merri-bek (2022).
  VALUES ('25250', '24700')
)
SELECT p.postcode, p.locality, p.state,
       w.win_ratio,
       cand.lga_name AS new_lga_name,
       cand.lga_code AS new_lga_code
  FROM postcode_geo p
  JOIN stg_ratio_winners w ON w.loc = upper(p.locality)
  LEFT JOIN LATERAL (
    SELECT a.lga_name, a.lga_code
      FROM abs_locality_lga a
      JOIN sc s ON s.state_name = a.state_name
     WHERE a.locality = upper(p.locality)
       AND s.code = p.state
       AND (a.lga_code = w.win_code
            OR upper(a.lga_name) = upper(w.win_name)
            OR a.lga_code IN (SELECT new_code FROM lga_renames WHERE old_code = w.win_code))
     LIMIT 1
  ) cand ON true
 WHERE p.lga_name IS NULL
   AND EXISTS (SELECT 1 FROM abs_locality_lga a2
                 JOIN sc s2 ON s2.state_name = a2.state_name
                WHERE a2.locality = upper(p.locality)
                  AND s2.code = p.state
                  AND a2.lga_count >= 2);
ANALYZE stg_straddler_refill;

-- On the record before anything is written.
SELECT 'straddler refill decision' AS check,
       count(*)                                                          AS target_rows,
       count(*) FILTER (WHERE win_ratio >= 0.9 AND new_lga_code IS NOT NULL) AS refill,
       count(*) FILTER (WHERE win_ratio >= 0.9 AND new_lga_code IS NULL)     AS dominant_but_no_2025_candidate,
       count(*) FILTER (WHERE win_ratio >= 0.5 AND win_ratio < 0.9)          AS stay_null_majority,
       count(*) FILTER (WHERE win_ratio < 0.5)                               AS stay_null_split
  FROM stg_straddler_refill;

UPDATE postcode_geo p
   SET lga_name = r.new_lga_name,
       lga_code = r.new_lga_code
  FROM stg_straddler_refill r
 WHERE r.postcode = p.postcode
   AND r.locality = p.locality
   AND r.state IS NOT DISTINCT FROM p.state
   AND r.win_ratio >= 0.9
   AND r.new_lga_code IS NOT NULL
   AND p.lga_name IS NULL;

-- Phase 3. Place entities on postcodes the refill fully decided: every
-- locality of the postcode now carries a council and they all agree. This is
-- deliberately postcode_geo-based (the 070000 pass reads abs_locality_lga,
-- which this refill does not touch) and deliberately strict: one NULL
-- locality or one dissenting council keeps the postcode out.
DROP TABLE IF EXISTS stg_pc_ratio_decided;
CREATE UNLOGGED TABLE stg_pc_ratio_decided AS
SELECT p.postcode, p.state,
       min(p.lga_name) AS lga_name,
       min(p.lga_code) AS lga_code
  FROM postcode_geo p
 WHERE EXISTS (SELECT 1 FROM stg_straddler_refill r
                WHERE r.postcode = p.postcode
                  AND r.state IS NOT DISTINCT FROM p.state
                  AND r.win_ratio >= 0.9
                  AND r.new_lga_code IS NOT NULL)
 GROUP BY p.postcode, p.state
HAVING count(*) FILTER (WHERE p.lga_name IS NULL) = 0
   AND count(DISTINCT p.lga_code) = 1;
CREATE INDEX ON stg_pc_ratio_decided (postcode, state);
ANALYZE stg_pc_ratio_decided;

DO $$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    UPDATE gs_entities e
       SET lga_name = s.lga_name,
           lga_code = s.lga_code,
           lga_source = 'straddler_ratio_dominant'
      FROM stg_pc_ratio_decided s
     WHERE e.id IN (
       SELECT e2.id
         FROM gs_entities e2
         JOIN stg_pc_ratio_decided s2 ON s2.postcode = e2.postcode AND s2.state = e2.state
        WHERE e2.lga_name IS NULL
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
  RAISE NOTICE 'ratio placement complete: % rows', total;
END $$;

-- Phase 4. Refresh the open gap ledger (070000 pattern): re-count postcodes
-- still holding unresolved multi-council entities, close the ones this pass
-- emptied.
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
SELECT 'after refill' AS check,
       (SELECT count(*) FROM postcode_geo WHERE lga_name IS NULL)                          AS geo_rows_still_null,
       (SELECT count(*) FROM gs_entities WHERE lga_source = 'straddler_ratio_dominant')    AS entities_placed_by_ratio,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL)                           AS entities_still_unplaced,
       (SELECT count(*) FROM gs_entities WHERE lga_name IS NULL AND lga_source IS NULL)    AS entities_unstamped;
