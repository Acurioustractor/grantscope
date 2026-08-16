-- Slice 2: curated-field edit provenance.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-clarity-curated-provenance.sql
--
-- clarity_object_history is a METRICS snapshot table (row_count, bytes, degree), not an edit
-- audit, and clarity_object has no triggers — so the write path stamps who last curated the
-- prose fields (purpose, caveat, grain, join_keys) and when. One stamp, not a log: the curated
-- fields are documentation, and "who wrote this and how stale is it" is the question a reader
-- actually asks of documentation.
BEGIN;
ALTER TABLE clarity_object
  ADD COLUMN IF NOT EXISTS curated_at timestamptz,
  ADD COLUMN IF NOT EXISTS curated_by text;

-- service_role held SELECT-only on clarity_object, found by slice 2's HTTP verification — which
-- means the slice 4 nouns route shipped broken too (its UPDATE would 500). The grant is
-- COLUMN-SCOPED on purpose: the app's write path can touch exactly the adjudication and curation
-- columns, and the measured columns (row_count, refs_*, freshness, access) stay un-writable at
-- the database even if a route bug tried. Documentation must never overwrite measurement.
GRANT UPDATE (purpose, caveat, grain, join_keys, curated_at, curated_by,
              noun, noun_source, verdict, verdict_by, verdict_at, verdict_reason)
  ON clarity_object TO service_role;
COMMIT;
