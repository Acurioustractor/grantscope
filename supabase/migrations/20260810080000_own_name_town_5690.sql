-- Own-name rung — postcode 5690 tranche (dry-run + verdicts 2026-08-10).
--
-- APPLY (Ben's verb, from repo root):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260810080000_own_name_town_5690.sql
--
-- Verdicts (Ben, 2026-08-10 morning, in Ceduna): class A approved (31 →
-- Ceduna 41010); class B approved as Coorabie + Border Village Nullarbor
-- only (2 → Unincorporated SA 49399); the 3 PENONG rows HELD for Ben's
-- local read (ABS SAL 1.000 and postcode_geo both say Unincorporated SA,
-- but he is on that road this week — flip block at the bottom). Holds
-- untouched: Oak Valley + Fowlers Bay (no SAL authority — gazetteer rung),
-- 35 rows with no name evidence (geocode/correction rung).
--
-- Method: word-boundary match of 5690 locality names in canonical_name →
-- abs_sal_lga_ratio authority (every candidate name is a nationally unique
-- SAL at ratio 1.000; guard query in own-name-5690-dryrun.md beside the
-- place-atlas handoff). Set-based re-derivation at apply time: a row placed
-- by another lane in the meantime drops out of scope and the strict count
-- assertions abort rather than guess.
--
-- Stamps: own_name_town+abs_asgs (reuse, Ben's standing decision) except
-- DISTRICT COUNCIL OF CEDUNA itself → council_serves_shire.

BEGIN;

-- The deterministic verdict set. PENONG is deliberately absent from the
-- candidate list; BOOKABIE/OAK VALLEY/FOWLERS BAY/NUNDROO/CHUNDARIA/
-- MITCHIDY MOOLA/NANBONA/WANDANA are hold-class: matching one of them
-- disqualifies a row (no SAL authority; postcode_geo is not authority).
CREATE TEMP TABLE stg_own5690 ON COMMIT DROP AS
WITH cands(loc, lga_code, lga_name, cls) AS (
  VALUES
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
    ('COORABIE','49399','Unincorporated SA','B'),
    ('NULLARBOR','49399','Unincorporated SA','B'),
    ('YALATA','49399','Unincorporated SA','B'),
    ('YELLABINNA','49399','Unincorporated SA','B'),
    ('YUMBARRA','49399','Unincorporated SA','B'),
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
  SELECT e.gs_id, e.canonical_name, e.state, c.loc, c.lga_code, c.lga_name, c.cls
  FROM gs_entities e
  JOIN cands c ON e.canonical_name ~* ('\m' || c.loc || '\M')
  WHERE e.lga_name IS NULL AND e.postcode = '5690'
)
SELECT gs_id,
       MIN(canonical_name) AS canonical_name,
       MAX(lga_code) FILTER (WHERE cls IN ('A','B')) AS win_code,
       MAX(lga_name) FILTER (WHERE cls IN ('A','B')) AS win_name
FROM m
GROUP BY gs_id
HAVING COUNT(DISTINCT lga_code) FILTER (WHERE cls IN ('A','B')) = 1
   AND NOT BOOL_OR(cls = 'C');

DO $$
DECLARE
  scope_n int;
  a_n int;
  b_n int;
  bad_state int;
BEGIN
  SELECT COUNT(*) INTO scope_n FROM gs_entities WHERE lga_name IS NULL AND postcode = '5690';
  IF scope_n <> 73 THEN
    RAISE EXCEPTION '5690 null pool is % (expected 73) — world moved since the dry-run; re-run it', scope_n;
  END IF;

  SELECT COUNT(*) FILTER (WHERE win_code = '41010'),
         COUNT(*) FILTER (WHERE win_code = '49399')
    INTO a_n, b_n
  FROM stg_own5690;
  IF a_n <> 31 OR b_n <> 2 THEN
    RAISE EXCEPTION 'verdict set drifted: A=% (expected 31), B=% (expected 2) — re-run the dry-run', a_n, b_n;
  END IF;

  -- State coherence: every target row must be SA (or state-less); a 4-prefix
  -- win against a non-SA entity would be the Laverton-wipe class.
  SELECT COUNT(*) INTO bad_state
  FROM stg_own5690 s
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
      WHEN e.canonical_name = 'DISTRICT COUNCIL OF CEDUNA' THEN 'council_serves_shire'
      ELSE 'own_name_town+abs_asgs'
    END
FROM stg_own5690 s
WHERE e.gs_id = s.gs_id
  AND e.lga_name IS NULL;

DO $$
DECLARE
  remaining int;
  placed_ceduna int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM gs_entities WHERE lga_name IS NULL AND postcode = '5690';
  IF remaining <> 40 THEN
    RAISE EXCEPTION '5690 null pool after apply is % (expected 40 = 35 no-evidence + 2 no-authority holds + 3 Penong holds)', remaining;
  END IF;
  SELECT COUNT(*) INTO placed_ceduna FROM gs_entities WHERE lga_code = '41010' AND lga_name IS NOT NULL;
  RAISE NOTICE 'own-name 5690 applied: 31 -> Ceduna 41010, 2 -> Unincorporated SA 49399; Ceduna placed now %, 5690 null pool %', placed_ceduna, remaining;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- PENONG FLIP (run ONLY after Ben's on-the-ground read confirms Penong sits
-- in Unincorporated SA as ABS says; uncomment and apply the block whole):
--
-- BEGIN;
-- DO $$
-- DECLARE n int;
-- BEGIN
--   SELECT COUNT(*) INTO n FROM gs_entities
--   WHERE lga_name IS NULL AND postcode = '5690' AND canonical_name ~* '\mPENONG\M';
--   IF n <> 3 THEN RAISE EXCEPTION 'expected the 3 held Penong rows, found %', n; END IF;
-- END $$;
-- UPDATE gs_entities
-- SET lga_code = '49399', lga_name = 'Unincorporated SA', lga_source = 'own_name_town+abs_asgs'
-- WHERE lga_name IS NULL AND postcode = '5690' AND canonical_name ~* '\mPENONG\M';
-- COMMIT;
