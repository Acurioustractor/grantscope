-- Issue #290 — delete the 306 foundation self-loops and their $98.69M
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-19-foundation-selfloops.sql
--
-- What this is. All 306 rows written by extraction_method='grant_opportunity_surface_backfill'
-- are self-loops: a foundation recorded as its own grantee. No other extraction method has a
-- single one (measured 2026-08-19), so this is one broken backfill, not a pattern. 72 of the 306
-- carry money -- $98,694,338, largest single row $50M -- so they passed every filter this repo
-- has. 157 of them reached gs_relationships as edges worth $34,636,088.
--
-- The producer. scripts/run-reviewability-backlog-batch.mjs, deleted in the 2026-04-24 scope cut
-- (last seen at f187e12a). getGenericGrantOpportunityPipeline() fired when a foundation had
-- grant_opportunities edges and a website, and treated the foundation's own opportunity rows as
-- grantee rows -- the opportunity describes the funder, so the "grantee" came back as the funder.
-- That script is gone and cannot recur. Five LIVE writers can still produce the same shape and
-- none of them check: map-foundation-grantees, scrape-foundation-grantees-all,
-- extract-foundation-relationships, discover-foundation-grantees,
-- import-snow-foundation-annual-report-2024. Hence the constraints below rather than five patches.
--
-- Trap: mv_foundation_grantees ALREADY excludes self-loops (source_entity_id <> target_entity_id),
-- so the surface at org-dashboard-service.ts:1571 never showed this money and will not move. The
-- other eight matviews over foundation_grantees have no such guard. Refresh them, not that one.

BEGIN;

CREATE TABLE _backup_foundation_selfloops_20260819 AS
SELECT * FROM foundation_grantees
WHERE lower(btrim(foundation_name)) = lower(btrim(grantee_name));

CREATE TABLE _backup_gs_rel_foundation_selfloops_20260819 AS
SELECT * FROM gs_relationships
WHERE dataset = 'foundation_grantees'
  AND source_entity_id = target_entity_id;

-- Refuse to proceed if the backups did not capture what we measured.
DO $$
DECLARE n_rows int; n_edges int;
BEGIN
  SELECT count(*) INTO n_rows  FROM _backup_foundation_selfloops_20260819;
  SELECT count(*) INTO n_edges FROM _backup_gs_rel_foundation_selfloops_20260819;
  IF n_rows <> 306 THEN
    RAISE EXCEPTION 'expected 306 self-loop rows, backed up %', n_rows;
  END IF;
  IF n_edges <> 157 THEN
    RAISE EXCEPTION 'expected 157 self-loop edges, backed up %', n_edges;
  END IF;
END $$;

DELETE FROM gs_relationships
WHERE dataset = 'foundation_grantees'
  AND source_entity_id = target_entity_id;

DELETE FROM foundation_grantees
WHERE lower(btrim(foundation_name)) = lower(btrim(grantee_name));

-- Guard 1: the source table. Small, so validate immediately.
ALTER TABLE foundation_grantees
  ADD CONSTRAINT foundation_grantees_no_selfloop
  CHECK (lower(btrim(foundation_name)) IS DISTINCT FROM lower(btrim(grantee_name)));

-- Guard 2: the derived edges. gs_relationships is 3.43M rows and a full validation scan exceeds
-- the pooler statement timeout, so this lands NOT VALID: it is enforced on every future INSERT and
-- UPDATE, which is the whole point, and simply does not re-scan history. Scoped to this dataset --
-- self-loops in other datasets have not been audited and are not this ticket's business.
ALTER TABLE gs_relationships
  ADD CONSTRAINT gs_relationships_foundation_grantees_no_selfloop
  CHECK (NOT (dataset = 'foundation_grantees' AND source_entity_id = target_entity_id))
  NOT VALID;

COMMIT;
