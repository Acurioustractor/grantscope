-- Retype the 947,776 aec_donations edges that were never donations
--
-- APPLY (runs several minutes; safe to re-run, safe to interrupt):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260820140000_retype_party_receipt_edges.sql
--
-- WHY THIS AND NOT A REBUILD
--
-- #348 taught the builder to emit 'party_receipt' for rows whose receipt_type is not
-- 'donation received'. That fixes FUTURE inserts. It does nothing to the 1.13M edges already in
-- the table, and re-running `build-entity-graph.mjs --phase=donations` would NOT fix them either:
--
--   * the builder is INSERT ... ON CONFLICT DO NOTHING; it never updates an existing row;
--   * its conflict target is idx_gs_rel_dedup, which INCLUDES relationship_type, so a retyped row
--     is a different key and would not be seen as a conflict;
--   * but gs_relationships_dataset_source_record_uniq is UNIQUE on (dataset, source_record_id),
--     so the insert would violate an index that ON CONFLICT does not name, and the phase would
--     abort with a unique violation.
--
-- One edge per source record is also what makes an in-place retype provably collision-free: there
-- cannot already be a 'party_receipt' row for the same source_record_id.
--
-- WHAT COUNTS AS NOT-A-DONATION
--
-- Everything except receipt_type = 'donation received', matching the CASE in
-- scripts/lib/graph-edge-datasets.mjs exactly. NULL receipt_type retypes too — 103,887 edges —
-- because an unlabelled AEC receipt is not evidence of a donation. COALESCE makes that explicit
-- rather than leaving NULLs to fall through a <> comparison silently.
--
--   other receipt        797,404 edges   108.62 bn
--   (null)               103,887 edges     6.85 bn
--   subscription          17,813 edges     1.20 bn
--   unspecified           27,237 edges     0.94 bn
--   public funding         1,435 edges     0.35 bn
--   ------------------------------------------------
--   to retype            947,776 edges   117.96 bn
--
--   donation received    184,078 edges    17.32 bn   <- untouched, stays 'donation'
--
-- CHUNKED, and not out of caution — a single UPDATE of 947,776 rows in one transaction is how the
-- 2-min shell timeout kills psql mid-statement and rolls the whole thing back. Per-batch COMMIT
-- means an interrupted run keeps its progress, and the WHERE is its own resume point: re-running
-- picks up exactly where it stopped, because retyped rows no longer match.

-- STEP 1: the allowed-values CHECK does not know about 'party_receipt'.
--
-- Found by running this migration, which failed with
--   new row for relation "gs_relationships" violates check constraint
--   "gs_relationships_relationship_type_check"
--
-- This is not only this migration's problem. #348 is ALREADY MERGED, so the builder now emits
-- 'party_receipt', and the next `build-entity-graph.mjs --phase=donations` would abort on the
-- same constraint. Widening it is a prerequisite for the code already on main, not just for the
-- backfill below.
--
-- Rewritten rather than dropped-and-recreated, so the other seventeen permitted values are
-- restated explicitly and a future reader can see the whole allowed set in one place.

ALTER TABLE gs_relationships DROP CONSTRAINT gs_relationships_relationship_type_check;

ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_relationship_type_check
  CHECK (relationship_type = ANY (ARRAY[
    'donation',            -- receipt_type = 'donation received' ONLY. See graph-edge-datasets.mjs.
    'party_receipt',       -- every other AEC receipt: fundraising, transfers, levies, subscriptions.
    'contract', 'grant', 'directorship', 'ownership', 'charity_link', 'program_funding',
    'tax_record', 'registered_as', 'listed_as', 'subsidiary_of', 'member_of', 'lobbies_for',
    'partners_with', 'shared_director', 'affiliated_with', 'trustee_of', 'offers_grant_program'
  ]::text[]));

-- STEP 2: retype the existing rows.

DO $$
DECLARE
  n integer;
  total integer := 0;
BEGIN
  LOOP
    UPDATE gs_relationships
       SET relationship_type = 'party_receipt'
     WHERE ctid IN (
       SELECT ctid FROM gs_relationships
        WHERE dataset = 'aec_donations'
          AND relationship_type = 'donation'
          AND COALESCE(properties ->> 'receipt_type', '') <> 'donation received'
        LIMIT 20000);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    RAISE NOTICE 'retyped % (running total %)', n, total;
    EXIT WHEN n = 0;
    COMMIT;
  END LOOP;
  RAISE NOTICE 'done: % edges retyped to party_receipt', total;
END $$;

-- Verify:
--   SELECT relationship_type, count(*), round(sum(amount)/1e9,2) bn
--     FROM gs_relationships WHERE dataset='aec_donations'
--    GROUP BY 1 ORDER BY 2 DESC;
-- Expect: donation 184,078 / 17.32 bn · party_receipt 947,776 / 117.96 bn
--
-- THEN refresh the dependent matviews — until they are refreshed, mv_revolving_door,
-- mv_entity_power_index, mv_entity_total_funding, mv_funding_by_lga, mv_funding_by_postcode and
-- mv_intervention_funding_chain still hold the inflated numbers they were built from.
