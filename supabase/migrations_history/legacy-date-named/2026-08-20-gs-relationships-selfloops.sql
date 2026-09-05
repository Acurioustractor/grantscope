-- Self-loops in gs_relationships: delete the false ones, constrain what has been judged.
--
-- APPLIED 2026-08-20 to tednluwflfhxyucgwigh, on Ben's explicit authorization.
--   INSERT 6242 (backup) / DELETE 6242 / constraint added.
--   Verified after: the only self-loops left are the 614 austender, 132 aec_donations and 342
--   lobbying rows this migration deliberately does not touch. The constraint was tested in both
--   directions — it rejects a grant_opportunities self-loop and still admits an austender one.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-20-gs-relationships-selfloops.sql
--
-- Context: #315, split out of #290. #290 removed self-loops from ONE dataset and shipped a
-- dataset-scoped constraint because the rest of the graph could not be measured — the scan timed
-- out against the pooler. It completes in about a second through a direct psql session with a
-- raised statement_timeout, which is how the table below was produced (2026-08-20).
--
-- 7,330 self-loops across 12 (dataset, relationship_type) pairs, $4,382.14M nominal. They are NOT
-- one defect. Three classes, and only the first is deletable:
--
--   A. THE EDGE ASSERTS A FALSEHOOD AND NOTHING REAL IS LOST. An opportunity node collapsed into
--      its own provider, so the graph says an organisation offers a grant program to itself.
--      6,242 rows, $3,498.53M. Deleted below.
--        grant_opportunities/offers_grant_program   6,229   $3,494.29M
--        grant_opportunities/grant                      3         none
--        grantconnect_awards/offers_grant_program       3       $4.21M
--        qld_arts_grants/offers_grant_program           2       $0.03M
--        foundations/subsidiary_of                      4         none   (own subsidiary)
--        foundation_charity_match/affiliated_with       1         none   (self-match)
--
--   B. A REAL RELATIONSHIP BETWEEN TWO DISTINCT ORGANISATIONS, COLLAPSED BY IDENTITY. NOT deleted:
--      deleting would erase something that happened. The fix is entity resolution — see #324.
--        austender/contract      614   $823.04M
--          Traced: of 626 self-loop rows re-joined to their contract notice, 624 carry a
--          supplier_abn EQUAL TO THE BUYER'S OWN ABN, across 138 distinct and entirely real
--          supplier names — ADM Systems, Adagold Aviation, Airnsea Safety. AusTender's supplier_abn
--          is wrong on these notices and ABN-based resolution then maps a genuine external supplier
--          onto the buyer. Deleting the edges would lose 138 suppliers' Defence contracts; the
--          repair is to re-resolve on supplier_name where the ABN matches the buyer.
--        aec_donations/party_receipt   132   $60.57M
--          Transfers BETWEEN party branches that our graph merged into one entity: ALP federal to
--          ALP Northern Territory, Greens national to Greens South Australia. Real money between
--          real distinct organisations. 98 of the 132 are receipt_type 'other receipt' and so are
--          not donations at all (CLAUDE.md filter 3); only 28 rows / $3.92M are 'donation received'.
--
--   C. UNDECIDED, POSSIBLY LEGITIMATE. NOT deleted and NOT constrained, deliberately:
--        lobbying_register_federal/lobbies_for   217
--        lobbying_register_wa/lobbies_for         72
--        lobbying_register_sa/lobbies_for         49
--        lobbying_register_nsw/lobbies_for         4
--      342 rows, no dollars. Each carries properties.note = 'Client of registered lobbyist firm'.
--      An entity that is its own client is either in-house lobbying, which is real and common, or
--      a name collapse. Nobody has judged which, so nothing here is deleted and no constraint is
--      added. Left out FOR A STATED REASON, the way foundation_grantees was the only dataset
--      covered in #290.
--
-- WHAT MOVES. The class A deletion changes figures on entity pages that read gs_relationships.
-- The class B rows, left in place, are the ones distorting the worst: Department of Defence shows
-- $927.16M of inbound money on its entity page, of which $761.45M — 82% — is Defence paying
-- itself. That number does not move until #324 does.

BEGIN;

-- Backup first, inside the transaction, following #290.
CREATE TABLE IF NOT EXISTS gs_relationships_selfloop_backup_20260820 AS
SELECT * FROM gs_relationships WHERE false;

INSERT INTO gs_relationships_selfloop_backup_20260820
SELECT * FROM gs_relationships
WHERE source_entity_id = target_entity_id
  AND dataset IN ('grant_opportunities','grantconnect_awards','qld_arts_grants',
                  'foundations','foundation_charity_match');

-- Abort on an unexpected count rather than deleting a number nobody measured.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM gs_relationships_selfloop_backup_20260820;
  IF n NOT BETWEEN 6000 AND 6500 THEN
    RAISE EXCEPTION 'expected ~6,242 class A self-loops, found %. Re-measure before deleting.', n;
  END IF;
END $$;

DELETE FROM gs_relationships
WHERE source_entity_id = target_entity_id
  AND dataset IN ('grant_opportunities','grantconnect_awards','qld_arts_grants',
                  'foundations','foundation_charity_match');

-- Enforcement on write, for the datasets that have been JUDGED. NOT VALID on purpose: the point
-- is to stop new bad rows, and a validation scan of 3.43M rows will not finish inside the
-- statement timeout. austender, aec_donations and the four lobbying registers are absent by
-- decision, not by oversight — see the class B and C notes above.
ALTER TABLE gs_relationships DROP CONSTRAINT IF EXISTS gs_relationships_no_judged_selfloops;
ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_no_judged_selfloops
  CHECK (NOT (dataset IN ('foundation_grantees','grant_opportunities','grantconnect_awards',
                          'qld_arts_grants','foundations','foundation_charity_match')
              AND source_entity_id = target_entity_id)) NOT VALID;

COMMIT;

-- After applying, the eight matviews over these datasets need a DELIBERATE refresh before any
-- figure delta means anything — #314 showed a manual refresh folds in unrelated backlog at the
-- same moment, which is why #290 could not report a per-surface delta.
