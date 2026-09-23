-- Remove the 26 extra copies of the AEC dataset from political_donations, and stop the import making more.
--
-- Every run of import-aec-donations upserted the whole AEC file with
--   onConflict (financial_year, donor_name, donation_to, amount, donation_date), ignoreDuplicates.
-- The party and third-party receipts file has no date column, and NULLs are distinct in a unique
-- index, so the conflict never fired and every run inserted all ~124,300 undated rows again.
-- agent_runs logged items_new = 0 each time. Measured 2026-09-23:
--
--                                   before        after
--   rows                         3,440,772      189,007
--   'donation received' dollars    31.23bn       1.150bn   (25,374 rows, 13,137 donors)
--   Mineralogy -> UAP 2018-19      27 rows       1 row, 83,361,643
--   aec_donations graph edges    1,277,798      125,027
--
-- CLAUDE.md's "506,739 rows, 23.0bn" for filter 3 was itself a count of the copies.
--
-- WHAT IS KEPT. A row's key is all seven fields that describe it (year, donor, recipient, amount, date,
-- return type, receipt type). One AEC file legitimately repeats some keys (5,716 keys, 12,689 rows in the
-- 2026-09-22 run: the same donor giving the same amount to the same party twice in a year, with no
-- date). So "one row per key" would delete real gifts; the rule keeps as many as ONE import holds:
--   - undated rows: the count of that key in the 2026-09-22 02:36 run, the latest complete import;
--   - dated rows (the donor-returns file): all of them. The old index did block dated copies, and no
--     dated key has more than one row.
-- Among identical copies, the one carrying donor_abn is kept first (the 2026-06-21 ABN backfill only
-- reached the copies that existed then: 71% of the March copy has an ABN, 0.4% of the latest), then
-- the oldest, which is also the copy the graph edges were built on.
-- Dropped with the copies: 1,667 undated keys (6,801 rows) that are not in the latest AEC file, i.e.
-- earlier versions of rows the AEC has since amended or the importer now normalises differently.
--
-- HOW. Heavy work first, under a SHARE lock (readers carry on, writers wait):
--   1. full copy to political_donations_pre_dedup_20260923 (the undo);
--   2. back up and delete the 1,152,771 aec_donations edges whose source row is not kept;
-- then, under an ACCESS EXCLUSIVE lock held only for the swap:
--   3. TRUNCATE, add copy_no and a generated key_hash, re-insert the 189,007 kept rows with their
--      original ids (so the kept edges still resolve), replace idx_donations_dedup with a unique index
--      on (key_hash, copy_no).
-- The importer numbers identical rows in each file 1..n as copy_no, so importing the same file twice
-- now conflicts on (key_hash, copy_no) and inserts nothing, while real repeats in a file still land.
-- (A NULLS NOT DISTINCT version of the old index would have rejected those real repeats.)
--
-- Asked for by Ben 2026-09-23 ("dedupe donations"). The import was paused the same day
-- (agent_schedules.enabled = false); resume it only after this is applied AND the importer change in
-- the same PR is on main.
--
-- Apply AFTER this file is on main, off-peak (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260923115925_dedupe_political_donations.sql
-- Then: refresh the donation-dependent matviews (nightly does it), regenerate
-- supabase/types/database.types.ts (two new columns), re-run check-graph-completeness.mjs.
-- Undo: TRUNCATE political_donations and re-insert from political_donations_pre_dedup_20260923 (the
--   two new columns take their defaults); re-insert edges from gs_relationships_deleted_20260923_aec.

BEGIN;
SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = '60s';

LOCK TABLE political_donations IN SHARE MODE;

-- Key of every row. The same expression is the generated key_hash column below; keep them identical.
CREATE TEMP TABLE pd_k ON COMMIT DROP AS
SELECT id, created_at, donor_abn, donation_date,
       md5(coalesce(financial_year, '<null>') || '|' || coalesce(donor_name, '<null>') || '|' ||
           coalesce(donation_to, '<null>') || '|' || coalesce(round(amount, 2)::text, '<null>') || '|' ||
           coalesce((donation_date - DATE '2000-01-01')::text, '<null>') || '|' ||
           coalesce(return_type, '<null>') || '|' || coalesce(receipt_type, '<null>')) AS k
  FROM political_donations;
CREATE INDEX ON pd_k (k);
ANALYZE pd_k;

CREATE TEMP TABLE target ON COMMIT DROP AS
SELECT k, count(*) AS m FROM pd_k
 WHERE donation_date IS NULL
   AND created_at >= '2026-09-22 02:30+00' AND created_at < '2026-09-22 03:00+00'
 GROUP BY k
UNION ALL
SELECT k, count(*) FROM pd_k WHERE donation_date IS NOT NULL GROUP BY k;

CREATE TEMP TABLE keep ON COMMIT DROP AS
SELECT id, id::text AS id_text, rn::smallint AS copy_no
  FROM (SELECT p.id, t.m,
               row_number() OVER (PARTITION BY p.k
                                  ORDER BY (p.donor_abn IS NOT NULL) DESC, p.created_at, p.id) AS rn
          FROM pd_k p JOIN target t USING (k)) x
 WHERE rn <= m;
CREATE UNIQUE INDEX ON keep (id);
CREATE INDEX ON keep (id_text);
ANALYZE keep;

DO $$
DECLARE want bigint; got bigint;
BEGIN
  SELECT sum(m) INTO want FROM target;
  SELECT count(*) INTO got FROM keep;
  IF got <> want THEN RAISE EXCEPTION 'keep set has % rows, target says %', got, want; END IF;
  IF got NOT BETWEEN 185000 AND 193000 THEN RAISE EXCEPTION 'expected ~189,007 rows to keep, found %', got; END IF;
  SELECT count(*) INTO got FROM (SELECT k FROM pd_k WHERE donation_date IS NOT NULL GROUP BY k HAVING count(*) > 1) z;
  IF got > 0 THEN RAISE EXCEPTION '% dated keys have copies; the rule assumes none', got; END IF;
END $$;

-- 1. The undo: every row as it is now.
CREATE TABLE political_donations_pre_dedup_20260923 AS SELECT * FROM political_donations;
ALTER TABLE political_donations_pre_dedup_20260923 ADD PRIMARY KEY (id);
ALTER TABLE political_donations_pre_dedup_20260923 ENABLE ROW LEVEL SECURITY;

-- 2. Edges built on rows that are not kept.
CREATE TABLE gs_relationships_deleted_20260923_aec AS
SELECT r.*, 'political_donations_copy_removed'::text AS delete_reason
  FROM gs_relationships r
 WHERE r.dataset = 'aec_donations'
   AND NOT EXISTS (SELECT 1 FROM keep k WHERE k.id_text = r.source_record_id);
ALTER TABLE gs_relationships_deleted_20260923_aec ADD PRIMARY KEY (id);
ALTER TABLE gs_relationships_deleted_20260923_aec ENABLE ROW LEVEL SECURITY;

DELETE FROM gs_relationships r
 USING gs_relationships_deleted_20260923_aec d
 WHERE r.id = d.id;

-- 3. The swap. TRUNCATE takes the ACCESS EXCLUSIVE lock; everything after it is ~190K rows.
TRUNCATE political_donations;

ALTER TABLE political_donations ADD COLUMN copy_no smallint NOT NULL DEFAULT 1;
ALTER TABLE political_donations ADD COLUMN key_hash text GENERATED ALWAYS AS (
  md5(coalesce(financial_year, '<null>') || '|' || coalesce(donor_name, '<null>') || '|' ||
      coalesce(donation_to, '<null>') || '|' || coalesce(round(amount, 2)::text, '<null>') || '|' ||
      coalesce((donation_date - DATE '2000-01-01')::text, '<null>') || '|' ||
      coalesce(return_type, '<null>') || '|' || coalesce(receipt_type, '<null>'))
) STORED;
COMMENT ON COLUMN political_donations.copy_no IS
  'Which of n identical rows in one AEC file this is (1..n). With key_hash it is the dedupe key; see 20260923115925.';
COMMENT ON COLUMN political_donations.key_hash IS
  'md5 of the seven fields that describe the row. Unique with copy_no, so re-importing a file inserts nothing.';

INSERT INTO political_donations (id, financial_year, donor_name, donor_abn, donation_to, donation_date, amount,
                                 return_type, receipt_type, created_at, source_state, properties, copy_no)
SELECT b.id, b.financial_year, b.donor_name, b.donor_abn, b.donation_to, b.donation_date, b.amount,
       b.return_type, b.receipt_type, b.created_at, b.source_state, b.properties, k.copy_no
  FROM political_donations_pre_dedup_20260923 b
  JOIN keep k ON k.id = b.id;

DROP INDEX idx_donations_dedup;
CREATE UNIQUE INDEX idx_donations_key_copy ON political_donations (key_hash, copy_no);

INSERT INTO schema_ownership (object, owner, evidence, declared_on) VALUES
  ('political_donations_pre_dedup_20260923', 'grantscope',
   'full copy of political_donations before 20260923115925 removed the import copies; restore source, no readers', '2026-09-23'),
  ('gs_relationships_deleted_20260923_aec', 'grantscope',
   'backup of the aec_donations edges deleted by 20260923115925; restore source, no readers', '2026-09-23');

DO $$
DECLARE n bigint; bn numeric;
BEGIN
  SELECT count(*) INTO n FROM political_donations;
  IF n NOT BETWEEN 185000 AND 193000 THEN RAISE EXCEPTION 'political_donations has % rows after the swap', n; END IF;
  SELECT sum(amount) / 1e9 INTO bn FROM political_donations WHERE receipt_type = 'donation received';
  IF bn NOT BETWEEN 1.10 AND 1.20 THEN RAISE EXCEPTION 'donation received totals %bn, expected ~1.150', round(bn, 3); END IF;
  SELECT count(*) INTO n FROM political_donations
   WHERE donor_name = 'Mineralogy Pty Ltd' AND financial_year = '2018-19' AND donation_to = 'United Australia Party';
  IF n <> 1 THEN RAISE EXCEPTION 'Mineralogy 2018-19 has % rows, expected 1', n; END IF;
  SELECT count(*) INTO n FROM gs_relationships r
   WHERE r.dataset = 'aec_donations'
     AND NOT EXISTS (SELECT 1 FROM political_donations p WHERE p.id::text = r.source_record_id);
  IF n > 0 THEN RAISE EXCEPTION '% aec_donations edges point at rows that no longer exist', n; END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
