-- Defence does not contract with itself for $823.59M. #315 class B, the last of the self-loops.
--
-- NOT YET APPLIED. Deletes production edges. Ben's call, and there is a real judgement in it --
-- read "THE OPTION NOT TAKEN" before applying.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-21-austender-supplier-abn-selfloops.sql
--
-- THE DEFECT. AusTender contract notices carry a `supplier_abn` equal to the BUYER'S OWN ABN.
-- ABN-based entity resolution then maps a genuine external supplier onto the buyer, and the graph
-- records the buyer contracting with itself. Measured 2026-08-21:
--
--   613 contract notices, $870.2M, 133 distinct supplier names, 7 buyers.
--   600 of the 613 and $800.8M of the $870.2M are the Department of Defence.
--   In gs_relationships this is 616 self-loop edges worth $823.59M.
--
-- WHAT IT DOES TO A PUBLISHED FIGURE. The Department of Defence shows $927.16M of inbound money,
-- of which $761.45M -- 82.1% -- is Defence paying itself. Removing these edges leaves $165.71M,
-- which is the honest number. This is the figure that has been quoted three times as "waiting on
-- #324"; it was never #324's to fix. The entity merge did not touch it and could not have.
--
-- THE OPTION NOT TAKEN, and why. The obvious repair is to recover the real supplier from
-- `supplier_name`, which IS recorded correctly, and re-point the edge. Measured, it does not work:
--
--   133 supplier names, of which 30 resolve to exactly one existing entity by name.
--   Those 30 cover 49 of the 613 contracts and $4.0M of the $870.2M -- 0.5% of the money.
--
-- The other 103 names are free text from what is evidently a manual purchasing lane, and are not
-- safe to mint entities from:
--
--   TRUNCATED at 20-22 characters (29 of the 133 names sit in that band):
--     'AUSTRALIAN BEDDING C'   'AUSTRALIAN INDIGENOU'   'BIDFOOD AUSTRALIA LIMI'
--     'BLACKTREE TECHNOLOGY P'  'BORAL CONSRTN MATRLS'
--   THE SAME COMPANY THREE WAYS:
--     'BAE SYSTEMS'  'BAE Systems Australia'  'BAE SYSTEMS AUSTRALIA PTY LTD'
--   NOT SUPPLIERS AT ALL:
--     'AIR7000 P8 POSEIDON' is a Defence project; '903 SQUADRON AAFC' is an Air Force cadet unit.
--
-- Minting entities from those would seed the graph with truncated junk and three BAE Systems, to
-- recover half a percent of the dollars. The standing rule applies -- unplaced beats confidently
-- wrong -- so this migration REMOVES THE FALSE ASSERTION rather than inventing a counterparty.
--
-- NOTHING IS LOST FROM THE RECORD. `austender_contracts` is untouched: all 613 notices, their
-- values, their buyers and their supplier names remain exactly as published. What is deleted is
-- only the GRAPH'S CLAIM that the counterparty was the buyer, which is false. The backup table
-- keeps the deleted edges so the decision is reversible.
--
-- The 30 resolvable names are deliberately NOT re-pointed here either. Doing that would fix 0.5%
-- of the money while leaving the other 99.5% asserting a falsehood, and would make the remaining
-- defect harder to see. If the free-text lane is ever cleaned up properly, all 613 should be
-- re-resolved together from `supplier_name`.

BEGIN;

CREATE TABLE IF NOT EXISTS gs_rel_austender_selfloop_backup_20260821 AS
SELECT * FROM gs_relationships WHERE false;

INSERT INTO gs_rel_austender_selfloop_backup_20260821
SELECT * FROM gs_relationships
 WHERE source_entity_id = target_entity_id AND dataset = 'austender';

DO $$
DECLARE n bigint; v numeric;
BEGIN
  SELECT count(*), COALESCE(sum(amount), 0) INTO n, v
    FROM gs_rel_austender_selfloop_backup_20260821;
  RAISE NOTICE 'backing up % austender self-loops worth %', n, round(v / 1e6, 2);
  IF n NOT BETWEEN 550 AND 700 THEN
    RAISE EXCEPTION 'expected ~616 austender self-loops, found %. Re-measure before deleting.', n;
  END IF;
END $$;

DELETE FROM gs_relationships
 WHERE source_entity_id = target_entity_id AND dataset = 'austender';

-- Extend the #315 constraint so the ingest cannot write them back. austender was deliberately
-- LEFT OUT of that constraint because the rows were a real relationship recorded wrongly and
-- nobody had judged them yet. They are judged now: a contract notice whose supplier_abn is the
-- buyer's own ABN does not describe a party contracting with itself, and the edge should not
-- exist. aec_donations and the four lobbying registers stay out, still unjudged.
ALTER TABLE gs_relationships DROP CONSTRAINT IF EXISTS gs_relationships_no_judged_selfloops;
ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_no_judged_selfloops
  CHECK (NOT (dataset IN ('foundation_grantees','grant_opportunities','grantconnect_awards',
                          'qld_arts_grants','foundations','foundation_charity_match','austender')
              AND source_entity_id = target_entity_id)) NOT VALID;

COMMIT;

-- After applying:
--   1. The Department of Defence entity page moves from $927.16M inbound to $165.71M. That is a
--      CORRECTION, not a regression, and anyone reading the page mid-week should be told so.
--   2. Self-loops fall from 1,090 to 474, all of them aec_donations or lobbying -- the two classes
--      that remain deliberately unjudged in #315.
--   3. The upstream defect is still upstream. The ingest will keep receiving notices with a wrong
--      supplier_abn; the constraint now stops them becoming self-loops, but the real supplier is
--      still not resolved. Recovering it needs the free-text supplier_name lane cleaned up, which
--      is its own piece of work.
