-- ROGS youth justice expenditure: remove a duplicate ingest and a mislabelled
-- within-ingest duplicate, and flag the rollup rows as aggregates.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-19-rogs-expenditure-double-count.sql
--
-- WHY
-- `justice_funding.measure_kind='expenditure_aggregate'` held 848 rows summing to
-- $66.13bn. 483 of those rows were exact duplicates (same state, financial_year,
-- amount_dollars). Two faults, both from 2026-03-14:
--
--   1. The same Productivity Commission ROGS youth justice table was ingested twice,
--      two hours apart, under different source_urls and different program_name
--      conventions. Verified identical row by row: ACT 2022-23 detention appears as
--      $26,776,000 under both. All 320 rows of the later ingest are contained in the
--      earlier one.
--   2. Within the earlier ingest, the scraper flattened the ROGS row hierarchy such
--      that 160 "Cost per young person per day ..." rows carry the RECURRENT
--      EXPENDITURE amount of their parent lane, not a per-day cost.
--
-- TRAP: there are 176 "Cost per young person per day" rows, not 160. The other 16
-- carry genuine per-day figures and MUST survive. Step 2 therefore deletes only rows
-- that have an exact (state, financial_year, amount_dollars) twin among the
-- "Government real recurrent expenditure" rows. Do not simplify it to a LIKE match.
--
-- Also fixed: the 80 rollup rows ("Government expenditure" with no lane in the label)
-- are the SUM of the three lanes below them, but only 30 of the 80 were flagged
-- is_aggregate. Summing the lane rows together with the rollup double-counts.
--
-- NOT touched: the 24 AIHW rows ($0.9bn) are an independent source and are correct.

BEGIN;

-- Guard: refuse to run twice, or against an unexpected shape.
DO $$
DECLARE n_dupe_ingest int; n_costday int; n_rollup int;
BEGIN
  SELECT count(*) INTO n_dupe_ingest FROM justice_funding
   WHERE measure_kind='expenditure_aggregate'
     AND source_url LIKE '%pc.gov.au%' AND source_url NOT LIKE '%/2026/%';
  SELECT count(*) INTO n_costday FROM justice_funding
   WHERE measure_kind='expenditure_aggregate'
     AND program_name LIKE 'Cost per young person per day%';
  SELECT count(*) INTO n_rollup FROM justice_funding
   WHERE measure_kind='expenditure_aggregate'
     AND program_name='Government real recurrent expenditure - Government expenditure - Government real recurrent expenditure';

  IF n_dupe_ingest = 0 AND n_costday <= 16 THEN
    RAISE EXCEPTION 'Already applied (dupe ingest %, cost-per-day %). Aborting.', n_dupe_ingest, n_costday;
  END IF;
  IF n_dupe_ingest <> 320 OR n_costday <> 176 OR n_rollup <> 80 THEN
    RAISE EXCEPTION 'Unexpected shape: dupe_ingest=% (want 320), costday=% (want 176), rollup=% (want 80). Re-audit before applying.',
      n_dupe_ingest, n_costday, n_rollup;
  END IF;
END $$;

-- 1. The duplicate second ingest. All 320 rows verified contained in the earlier one.
DELETE FROM justice_funding
 WHERE measure_kind='expenditure_aggregate'
   AND source_url LIKE '%pc.gov.au%'
   AND source_url NOT LIKE '%/2026/%';

-- 2. Mislabelled per-day rows that actually carry the parent lane's recurrent total.
--    Only those with an exact twin among the recurrent rows. Expect 160 of 176.
DELETE FROM justice_funding a
 WHERE a.measure_kind='expenditure_aggregate'
   AND a.program_name LIKE 'Cost per young person per day%'
   AND EXISTS (
     SELECT 1 FROM justice_funding b
      WHERE b.measure_kind='expenditure_aggregate'
        AND b.program_name LIKE 'Government real recurrent%'
        AND b.state = a.state
        AND b.financial_year = a.financial_year
        AND b.amount_dollars = a.amount_dollars
        AND b.id <> a.id);

-- 3. The rollup rows are aggregates of the three lanes. Flag all 80 consistently.
UPDATE justice_funding
   SET is_aggregate = true
 WHERE measure_kind='expenditure_aggregate'
   AND program_name='Government real recurrent expenditure - Government expenditure - Government real recurrent expenditure'
   AND is_aggregate IS DISTINCT FROM true;

-- Post-check: no exact (state, year, amount) duplicates should remain.
DO $$
DECLARE n_rows int; n_dupes int;
BEGIN
  SELECT count(*), count(*) - count(DISTINCT (state||'|'||financial_year||'|'||amount_dollars::text))
    INTO n_rows, n_dupes
    FROM justice_funding WHERE measure_kind='expenditure_aggregate';
  RAISE NOTICE 'expenditure_aggregate now % rows, % residual same-value rows', n_rows, n_dupes;
  IF n_rows <> 368 THEN
    RAISE EXCEPTION 'Expected 368 rows after cleanup, got %. Rolling back.', n_rows;
  END IF;
END $$;

COMMIT;
