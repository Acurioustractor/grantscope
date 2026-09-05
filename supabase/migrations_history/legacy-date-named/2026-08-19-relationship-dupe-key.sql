-- Issue #322 — dedupe gs_relationships and make ingests idempotent
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-19-relationship-dupe-key.sql
--
-- The cause. gs_relationships has no unique key on (dataset, source_record_id), so re-running an
-- ingest inserts every source record again. Verified: GrantConnect award GA318668 exists ONCE in
-- grantconnect_awards and TWICE in the graph, created 2026-08-14 12:32 and 2026-08-15 02:18,
-- $68,303,547.29 counted twice. Across that dataset: 552 rows created 14 Aug, 549 of them
-- re-created 15 Aug. One ingest, run twice, nothing to stop it.
--
-- This is the mechanism behind #299 ($37.8bn of duplicated ROGS rows) and #260 ($304M of
-- double-counted foundation grants). Both were found by accident, months late, by someone chasing
-- a different question. Both would have been impossible with the index below.
--
-- Two false starts, recorded so nobody repeats them:
--   * Grouping on (source, target, type, year, amount) is NOT a duplicate test. The source
--     genuinely holds 374 distinct Brisbane City Council -> ALP (Qld) receipts at $2,498, and
--     NHMRC's apparent duplicates were 1,151 NULL-amount grants collapsing into one group. That
--     key produced $31.2bn of phantom duplication.
--   * `source_record_id` is a real column and is 100% populated. Inspecting `properties` and
--     concluding no key existed was wrong. Read information_schema, not the data.
--
-- Keep the EARLIEST row per key: first_seen and created_at on the original are the true first
-- observation, and later copies carry a re-ingest timestamp that would misdate the edge.
--
-- statement_timeout is cleared because the dedupe scans 3.43M rows and the pooler default kills it.
-- The index is built CONCURRENTLY, outside the transaction, so writers are not blocked.

SET statement_timeout = 0;

BEGIN;

CREATE TABLE _backup_gs_rel_dupes_20260819 AS
SELECT * FROM (
  SELECT r.*, row_number() OVER (
           PARTITION BY r.dataset, r.source_record_id
           ORDER BY r.created_at ASC, r.id ASC
         ) AS rn
  FROM gs_relationships r
  WHERE r.source_record_id IS NOT NULL
) t
WHERE t.rn > 1;

DELETE FROM gs_relationships r
USING _backup_gs_rel_dupes_20260819 b
WHERE r.id = b.id;

-- Refuse to leave the transaction if any duplicate key survives.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM gs_relationships
    WHERE source_record_id IS NOT NULL
    GROUP BY dataset, source_record_id HAVING count(*) > 1
  ) t;
  IF n <> 0 THEN
    RAISE EXCEPTION 'dedupe incomplete: % duplicate keys remain', n;
  END IF;
END $$;

COMMIT;

-- Outside the transaction: CONCURRENTLY cannot run inside one. Partial, because rows without a
-- source_record_id are not identifiable and must not be constrained.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS gs_relationships_dataset_source_record_uniq
  ON gs_relationships (dataset, source_record_id)
  WHERE source_record_id IS NOT NULL;
