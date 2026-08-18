-- =============================================================================
-- 2026-08-19-amount-unknown-policy.sql
--
-- Policy for dollar-less funder edges, decided in issue #285.
--
-- `foundation_grantees` holds 6,001 rows across 181 funders; 1,065 carry no amount.
-- Those 1,065 are NOT one thing, and one flat rule would have been wrong either way:
-- deleting them destroys facts a funder published deliberately, keeping them silently
-- inflates every grantee count.
--
-- The zero-rate tracks the SOURCE TYPE, not our extraction:
--     official_grants_database_backfill    0.2%   <- databases publish amounts
--     official_grantee_surface_backfill   16.2%
--     official_annual_report_backfill     48.1%
--     canonical_relationship_backfill      100%   <- never published amounts, by design
--     prf_annual_review_partner_list       100%   <- a PARTNER LIST, not a grant list
--     official_impact_report_backfill      100%   <- an impact report names partners
--
-- So: the three 100% classes (202 rows) are marked `amount_unknown` — the source told us
-- WHO, never HOW MUCH, and no backfill can fix that because there is nothing to fetch.
-- The middle band stays unmarked: a missing amount there is plausibly our miss, and it is
-- backfill work (issue #291 takes VFFF's 7 as the test case).
--
-- 234 of the 1,065 are self-loops from a broken backfill and are NOT handled here — they
-- are a money-integrity bug worth $98.69M, split out to issue #290.
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-19-amount-unknown-policy.sql
--
-- REVERSE:  ALTER TABLE foundation_grantees DROP COLUMN amount_unknown;
-- =============================================================================

BEGIN;

ALTER TABLE foundation_grantees
  ADD COLUMN IF NOT EXISTS amount_unknown boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN foundation_grantees.amount_unknown IS
  'TRUE where the SOURCE published a relationship without a sum (partner lists, impact reports, '
  'canonical relationship backfills). Distinct from a NULL grant_amount, which may equally mean our '
  'extraction missed a figure the source does publish. The distinction is the whole point: '
  'amount_unknown rows are not a backfill queue, they are facts with no dollar figure to find. '
  'Decided in github.com/Acurioustractor/grantscope/issues/285.';

-- The three classes whose sources never carried amounts. Self-loops are deliberately excluded:
-- they are a bug (#290), not a source that declined to publish a figure.
UPDATE foundation_grantees
SET    amount_unknown = true
WHERE  extraction_method IN (
         'canonical_relationship_backfill',
         'prf_annual_review_partner_list',
         'official_impact_report_backfill'
       )
  AND  (grant_amount IS NULL OR grant_amount = 0)
  AND  lower(trim(foundation_name)) <> lower(trim(grantee_name));

COMMIT;
