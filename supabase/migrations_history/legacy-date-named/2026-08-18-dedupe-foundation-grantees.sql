-- Remove the duplicated foundation_grantees grant rows. 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-dedupe-foundation-grantees.sql
--
-- Found while checking whether Ian Potter needed a scraper: it did not — it was already ingested,
-- and ingested TWICE. The same 1,716 rows / $240,021,945 sit under `ian_potter_grants_db` and under
-- the generic `foundation_grantees` key, 1,713 of them matching exactly on
-- (source, target, year, amount). The entity totalled $480.5M against a real $240.0M.
--
-- Measured across the whole `foundation_grantees` dataset:
--
--   dataset duplicated        rows    dollars
--   frrr_grants               3,105   $49.8M
--   ian_potter_grants_db      1,713   $240.0M
--   myer_annual_report_2024      27   $14.5M
--
--   foundation_grantees grant rows        5,577
--   of which duplicated                   5,481   (98%)
--   unique to foundation_grantees            96
--
-- On the duplicate count, because it moved during the work and the difference is instructive:
-- matching year and amount with plain `=` finds 4,819 rows. Matching with IS NOT DISTINCT FROM —
-- NULL counting as equal to NULL — finds 5,481. The extra 662 all have `amount IS NULL` and a
-- year that IS present, and each has a counterpart in a funder-specific dataset with the same
-- funder, grantee and year and also no amount. That is the same edge recorded twice, so it goes:
-- it carries $0, but it inflates edge and grantee COUNTS, which is what the funder dossiers read.
-- The first draft of this migration used the looser rule with a guard set to the stricter count,
-- and would have aborted rather than deleting the wrong set. That is what the guard is for.
--
-- KEEP the funder-specific datasets, DELETE the generic copies: the funder keys carry a source_url
-- and provenance, and each is individually reversible by its own dataset key. `foundation_grantees`
-- is a bucket with no such handle. The 758 rows unique to it are LEFT IN PLACE — they are not
-- duplicates and deleting them would lose data.
--
-- Non-grant rows in `foundation_grantees` are untouched; only relationship_type='grant' is matched.
--
-- REVERSIBLE: every deleted row is copied to `_backup_foundation_grantees_dupes_20260818` first,
-- with its original id. To restore:
--   INSERT INTO gs_relationships SELECT * FROM _backup_foundation_grantees_dupes_20260818;
-- A TSV copy is also written to data/ingest/ by the runner, for a record outside the database.

BEGIN;

-- 1. Backup, including the primary key, so a restore is a plain INSERT SELECT.
CREATE TABLE IF NOT EXISTS _backup_foundation_grantees_dupes_20260818 AS
SELECT fg.*
FROM gs_relationships fg
WHERE fg.dataset = 'foundation_grantees'
  AND fg.relationship_type = 'grant'
  AND EXISTS (
    SELECT 1 FROM gs_relationships o
    WHERE o.relationship_type = 'grant'
      AND o.dataset <> 'foundation_grantees'
      AND o.source_entity_id = fg.source_entity_id
      AND o.target_entity_id = fg.target_entity_id
      AND o.year IS NOT DISTINCT FROM fg.year
      AND o.amount IS NOT DISTINCT FROM fg.amount
  );

-- 2. Refuse to proceed if the backup did not capture what we measured. A silent mismatch here
--    would delete rows nobody has a copy of.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM _backup_foundation_grantees_dupes_20260818;
  IF n <> 5481 THEN
    RAISE EXCEPTION 'backup holds % rows, expected 5481 — aborting rather than deleting unbacked rows', n;
  END IF;
END $$;

-- 3. Delete exactly what was backed up, by id.
DELETE FROM gs_relationships
WHERE id IN (SELECT id FROM _backup_foundation_grantees_dupes_20260818);

COMMIT;
