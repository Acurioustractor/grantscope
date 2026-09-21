-- justice_funding.funding_type: fold one duplicate label, and leave the rest alone.
--
-- The check loop (scripts/jev-check-loop.mjs) flagged this column's vocabulary
-- as drifting. On inspection it mostly is not, and the difference matters,
-- because collapsing a meaningful value would destroy information that a money
-- surface depends on.
--
-- Measured 2026-09-21:
--
--   value                    n      measure_kind         aggregate  source
--   grant                50,434    grant                        0   many
--   contract             29,519    grant                        0   many
--   capital              15,668    grant                        0   many
--   appropriation           369    grant                        0   many
--   grant-variation         300    grant                        0   niaa-senate-order-16
--   philanthropic           170    grant                        0   5 partner networks
--   philanthropic-grant      20    grant                        0   dusseldorp-yir-2025
--   total_budget              2    budget_announcement          2   qld-budget-sds
--   budget_program_net_cost   1    budget_announcement          1   sa-budget-2025-26
--   grants_program            1    budget_announcement          1   qld-budget-sds
--   (null)               60,142
--
-- What is NOT drift, and is deliberately untouched:
--
--   grant-variation is a real distinction, a variation to an existing grant,
--   consistently applied across 300 rows from one source. Folding it into
--   `grant` would lose the only marker that separates a variation from an
--   original award.
--
--   total_budget, budget_program_net_cost and grants_program are all
--   is_aggregate = true and measure_kind = 'budget_announcement'. They are the
--   whole-of-state budget rows the mandatory filters already exclude. Renaming
--   them would make three provenances look like one and would not change a
--   single published figure, because nothing that sums money reads past
--   is_aggregate.
--
-- What IS drift: `philanthropic-grant` (20 rows, dusseldorp-yir-2025) and
-- `philanthropic` (170 rows, five other partner networks) are the same concept
-- labelled by two ingests. Verified row by row: both are philanthropic
-- foundation grants to named organisations, measure_kind 'grant', none
-- aggregates.
--
-- This matters beyond tidiness. funding_type is named in the column list given
-- to the model behind /api/ask and /api/query, which writes SQL against it. Two
-- spellings of one concept means a filter on either misses the other.
--
-- No CHECK constraint. Ingests legitimately introduce new types, and a
-- constraint here would fail a nightly job rather than surface a naming choice.
-- Drift is now detectable instead:
--   node --env-file=.env scripts/jev-check-loop.mjs --audit justice_funding_type
--
-- No writer in THIS repo emits 'philanthropic-grant', so nothing scheduled here
-- will undo this. The dusseldorp ingest lives elsewhere; if it runs again it may
-- reintroduce the label, which the audit above will show.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260921230000_fold_philanthropic_grant_into_philanthropic.sql

-- Impact, measured before applying:
--   philanthropic        170 rows  $71,062,634
--   philanthropic-grant   20 rows   $1,749,000   <- becomes philanthropic
--   after:               190 rows  $72,811,634
--
-- No published total moves. Both labels are measure_kind = 'grant' and neither
-- is an aggregate, so every figure that sums the grant lane is already counting
-- all 190. Only a breakdown BY funding_type changes.
--
-- EXACTLY REVERSIBLE. All 20 rows carry source = 'dusseldorp-yir-2025' and none
-- of the existing 170 do, so the change undoes cleanly:
--
--   UPDATE public.justice_funding SET funding_type = 'philanthropic-grant'
--    WHERE funding_type = 'philanthropic' AND source = 'dusseldorp-yir-2025';

BEGIN;

UPDATE public.justice_funding
   SET funding_type = 'philanthropic'
 WHERE funding_type = 'philanthropic-grant';

COMMENT ON COLUMN public.justice_funding.funding_type IS
  'How the money was given. Canonical values: grant, contract, capital, appropriation, philanthropic, grant-variation. Rows with measure_kind = ''budget_announcement'' carry source-specific labels (total_budget, grants_program, budget_program_net_cost) and are is_aggregate = true, so the mandatory money filters already exclude them. NOT the money-lane filter: that is measure_kind plus is_aggregate, see CLAUDE.md. ''philanthropic-grant'' was folded into ''philanthropic'' on 2026-09-21; the two were one concept labelled by two ingests.';

COMMIT;

-- Post-check:
--   SELECT funding_type, count(*) FROM justice_funding
--    WHERE funding_type LIKE 'philanthropic%' GROUP BY 1;
--   -- expect: philanthropic 190, and no philanthropic-grant row
