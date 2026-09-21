-- Remove two grant_opportunities rows whose "amount" was never a grant amount.
--
-- Apply: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/2026-09-21-delete-non-grant-rows.sql
--
--   Underworld Laser tag Menai (1 hour) 3 x missions   amount_max 20   a ticket price
--   KM4KIDS 2025                                       amount_max 88   not money at all
--
-- Both predate the amount guard in scripts/lib/grant-amounts.mjs, which now
-- refuses sub-$100 values and stops a bare amount proving grant-hood. Neither
-- has any dependent row (grant_feedback, saved_grants, org_deadlines,
-- org_milestones, org_sessions, org_grant_budget_lines, bgfit_*: all zero).
--
-- Deliberately NOT `sync-foundation-programs.mjs --cleanup-invalid`: that flag
-- would delete 90 rows, including real programmes that are merely closed or
-- paused (Annamila's three streams, the Wesfarmers Centre Seed & Partnership
-- Grant, the Macquarie Community Resilience Prize). A closed round that reopens
-- is worth keeping.

BEGIN;

DELETE FROM public.grant_opportunities
WHERE id IN (
  '36a7488b-1b77-43b0-9a0c-c43d2542745a',  -- Underworld Laser tag Menai
  '08bb0801-67d6-4b7b-8955-6a40a2a946e1'   -- KM4KIDS 2025
)
AND source = 'foundation_program';

COMMIT;

-- Post-check (expects 0):
--   SELECT count(*) FROM grant_opportunities
--   WHERE source = 'foundation_program' AND (amount_min < 100 OR amount_max < 100);
