-- Own-name rung — postcodes 5680 + 5661 tranche (dry-run + verdicts 2026-08-10).
--
-- APPLY (Ben's verb, from repo root):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260810090000_own_name_town_5680_5661.sql
--
-- Verdicts (Ben, 2026-08-10): both classes approved — 29 → Streaky Bay 47490
-- (24 @5680 incl. DISTRICT COUNCIL OF STREAKY BAY → `council_serves_shire`;
-- 5 Wirrulla @5661, emptying that postcode) and 3 Smoky Bay-named → Ceduna
-- 41010 (SAL Smoky Bay is Ceduna council at 1.000). 18 rows @5680 keep no
-- name evidence and stay honest-null. PENONG remains hold-class (Ben's
-- standing hold); MARYVALE / PINJARRA STATION have no SAL; PUREBA is a
-- genuine 0.5/0.5 split. Sheet: thoughts/shared/handoffs/place-atlas/
-- own-name-5680-5661-dryrun.md (one-SAL-per-name guard: 0 collisions; the
-- surname-risk candidates HASLAM/INKSTER/WESTALL matched nothing).
--
-- Same set-based re-derivation + strict-assert shape as 20260810080000: if
-- the world moved since the dry-run, this aborts rather than guesses.

BEGIN;

CREATE TEMP TABLE stg_own5680 ON COMMIT DROP AS
WITH cands(loc, lga_code, lga_name, cls) AS (
  VALUES
    -- Ceduna council localities (SAL ratio 1.000 each)
    ('CEDUNA WATERS','41010','Ceduna','A'),
    ('CEDUNA','41010','Ceduna','A'),
    ('CHARRA','41010','Ceduna','A'),
    ('DENIAL BAY','41010','Ceduna','A'),
    ('KALANBI','41010','Ceduna','A'),
    ('KOONIBBA','41010','Ceduna','A'),
    ('MALTEE','41010','Ceduna','A'),
    ('MERGHINY','41010','Ceduna','A'),
    ('NADIA','41010','Ceduna','A'),
    ('THEVENARD','41010','Ceduna','A'),
    ('UWORRA','41010','Ceduna','A'),
    ('WATRABA','41010','Ceduna','A'),
    ('WHITE WELL CORNER','41010','Ceduna','A'),
    ('CARAWA','41010','Ceduna','A'),
    ('CHINBINGINA','41010','Ceduna','A'),
    ('LAURA BAY','41010','Ceduna','A'),
    ('MUDAMUCKLA','41010','Ceduna','A'),
    ('NUNJIKOMPITA','41010','Ceduna','A'),
    ('PUNTABIE','41010','Ceduna','A'),
    ('SMOKY BAY','41010','Ceduna','A'),
    ('PIMBAACLA','41010','Ceduna','A'),
    -- Streaky Bay council localities (SAL ratio 1.000 each)
    ('CHANDADA','47490','Streaky Bay','S'),
    ('EBA ANCHORAGE','47490','Streaky Bay','S'),
    ('HASLAM','47490','Streaky Bay','S'),
    ('INKSTER','47490','Streaky Bay','S'),
    ('PERLUBIE','47490','Streaky Bay','S'),
    ('PETINA','47490','Streaky Bay','S'),
    ('PIEDNIPPIE','47490','Streaky Bay','S'),
    ('SCEALE BAY','47490','Streaky Bay','S'),
    ('STREAKY BAY','47490','Streaky Bay','S'),
    ('WESTALL','47490','Streaky Bay','S'),
    ('YANERBIE','47490','Streaky Bay','S'),
    ('KOOLGERA','47490','Streaky Bay','S'),
    ('WALLALA','47490','Streaky Bay','S'),
    ('WIRRULLA','47490','Streaky Bay','S'),
    ('YANTANABIE','47490','Streaky Bay','S'),
    -- Unincorporated SA (approved 5690 class; kept so a match resolves
    -- rather than falling through as no-evidence)
    ('COORABIE','49399','Unincorporated SA','B'),
    ('NULLARBOR','49399','Unincorporated SA','B'),
    ('YALATA','49399','Unincorporated SA','B'),
    ('YELLABINNA','49399','Unincorporated SA','B'),
    ('YUMBARRA','49399','Unincorporated SA','B'),
    -- Hold-class: matching one of these disqualifies the row.
    ('PENONG',NULL,NULL,'C'),
    ('MARYVALE',NULL,NULL,'C'),
    ('PINJARRA STATION',NULL,NULL,'C'),
    ('PUREBA',NULL,NULL,'C'),
    ('BOOKABIE',NULL,NULL,'C'),
    ('OAK VALLEY',NULL,NULL,'C'),
    ('FOWLERS BAY',NULL,NULL,'C'),
    ('NUNDROO',NULL,NULL,'C'),
    ('CHUNDARIA',NULL,NULL,'C'),
    ('MITCHIDY MOOLA',NULL,NULL,'C'),
    ('NANBONA',NULL,NULL,'C'),
    ('WANDANA',NULL,NULL,'C')
),
m AS (
  SELECT e.gs_id, e.postcode, e.canonical_name, c.loc, c.lga_code, c.lga_name, c.cls
  FROM gs_entities e
  JOIN cands c ON e.canonical_name ~* ('\m' || c.loc || '\M')
  WHERE e.lga_name IS NULL AND e.postcode IN ('5680','5661')
)
SELECT gs_id,
       MIN(postcode) AS postcode,
       MIN(canonical_name) AS canonical_name,
       MAX(lga_code) FILTER (WHERE cls IN ('A','S','B')) AS win_code,
       MAX(lga_name) FILTER (WHERE cls IN ('A','S','B')) AS win_name
FROM m
GROUP BY gs_id
HAVING COUNT(DISTINCT lga_code) FILTER (WHERE cls IN ('A','S','B')) = 1
   AND NOT BOOL_OR(cls = 'C');

DO $$
DECLARE
  pool_5680 int;
  pool_5661 int;
  sb_n int;
  ced_n int;
  bad_state int;
BEGIN
  SELECT COUNT(*) FILTER (WHERE postcode = '5680'),
         COUNT(*) FILTER (WHERE postcode = '5661')
    INTO pool_5680, pool_5661
  FROM gs_entities WHERE lga_name IS NULL AND postcode IN ('5680','5661');
  IF pool_5680 <> 45 OR pool_5661 <> 5 THEN
    RAISE EXCEPTION 'pools are 5680=% (expected 45), 5661=% (expected 5) — world moved; re-run the dry-run', pool_5680, pool_5661;
  END IF;

  SELECT COUNT(*) FILTER (WHERE win_code = '47490'),
         COUNT(*) FILTER (WHERE win_code = '41010')
    INTO sb_n, ced_n
  FROM stg_own5680;
  IF sb_n <> 29 OR ced_n <> 3 THEN
    RAISE EXCEPTION 'verdict set drifted: StreakyBay=% (expected 29), Ceduna=% (expected 3) — re-run the dry-run', sb_n, ced_n;
  END IF;

  SELECT COUNT(*) INTO bad_state
  FROM stg_own5680 s
  JOIN gs_entities e ON e.gs_id = s.gs_id
  WHERE e.state IS NOT NULL AND UPPER(e.state) <> 'SA';
  IF bad_state > 0 THEN
    RAISE EXCEPTION '% target rows carry a non-SA state — abort', bad_state;
  END IF;
END $$;

UPDATE gs_entities e
SET lga_code = s.win_code,
    lga_name = s.win_name,
    lga_source = CASE
      WHEN e.canonical_name = 'District Council of Streaky Bay' THEN 'council_serves_shire'
      ELSE 'own_name_town+abs_asgs'
    END
FROM stg_own5680 s
WHERE e.gs_id = s.gs_id
  AND e.lga_name IS NULL;

DO $$
DECLARE
  rem_5680 int;
  rem_5661 int;
  ceduna_placed int;
  sb_placed int;
BEGIN
  SELECT COUNT(*) FILTER (WHERE postcode = '5680'),
         COUNT(*) FILTER (WHERE postcode = '5661')
    INTO rem_5680, rem_5661
  FROM gs_entities WHERE lga_name IS NULL AND postcode IN ('5680','5661');
  IF rem_5680 <> 18 OR rem_5661 <> 0 THEN
    RAISE EXCEPTION 'post pools are 5680=% (expected 18), 5661=% (expected 0)', rem_5680, rem_5661;
  END IF;
  SELECT COUNT(*) INTO ceduna_placed FROM gs_entities WHERE lga_code = '41010' AND lga_name IS NOT NULL;
  SELECT COUNT(*) INTO sb_placed FROM gs_entities WHERE lga_code = '47490' AND lga_name IS NOT NULL;
  RAISE NOTICE 'own-name 5680/5661 applied: 29 -> Streaky Bay 47490, 3 -> Ceduna 41010; Ceduna placed %, Streaky Bay placed %, 5680 pool %, 5661 pool %', ceduna_placed, sb_placed, rem_5680, rem_5661;
END $$;

COMMIT;
