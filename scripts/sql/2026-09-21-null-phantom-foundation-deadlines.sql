-- 2026-09-21 — clear LLM-invented deadlines on foundation_program rows.
--
-- WHY. grant_opportunities.closes_at/deadline for source='foundation_program' come
-- from foundation_programs.deadline, which is populated by an LLM in
-- scripts/discover-foundation-programs.mjs:913 — "Next deadline as YYYY-MM-DD (or
-- null if ongoing/unknown)" — and copied verbatim by
-- scripts/sync-foundation-programs.mjs:194-195. The model was told it could answer
-- null and instead returned plausible month-end dates.
--
-- The tell is many DISTINCT funders sharing one month-end date. Two such clusters
-- are currently on the open desk and are the only ones this file touches:
--   2026-09-30   9 rows /  5 funders
--   2026-12-31  13 rows / 12 funders
--
-- Verified by hand for the strongest case: Annamila First Nations Foundation's
-- three streams all carry 2026-09-30 though the rows were created a month apart
-- (1 Mar and 9 Apr), while annamila.com states "grant rounds are currently closed
-- until further notice". The published Annamila deadlines are 20 January and
-- 30 May; 30 September appears nowhere.
--
-- WHAT THIS DOES. Sets closes_at and deadline to NULL. Nothing is deleted, and the
-- source value survives in foundation_programs.deadline, so this is reversible.
-- NULL is the honest state: we do not know when these close. It also stops the ACT
-- grants desk rendering invented urgency.
--
-- NOT FIXED HERE, and worth its own pass: most of these rows are not grants at all.
-- The 22 include a church mission trip to Malaysia, "Lions Biggest BBQ", and six
-- individual scholarships — plus "Family Scholarship Donation" and "Corporate
-- Scholarship Partnership", which are ways to GIVE money to the foundation rather
-- than apply for it. The discovery step is turning foundation programme pages into
-- opportunity rows without asking whether an organisation could apply.
--
-- Apply: psql -f scripts/sql/2026-09-21-null-phantom-foundation-deadlines.sql

BEGIN;

-- Guard: fail loudly if the shape is not what was measured, rather than nulling
-- something unexpected.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM grant_opportunities
  WHERE source = 'foundation_program'
    AND closes_at::date IN (DATE '2026-09-30', DATE '2026-12-31');
  IF n <> 22 THEN
    RAISE EXCEPTION 'expected 22 rows, found %, aborting', n;
  END IF;
END $$;

UPDATE grant_opportunities
SET closes_at = NULL,
    deadline  = NULL
WHERE source = 'foundation_program'
  AND closes_at::date IN (DATE '2026-09-30', DATE '2026-12-31');

COMMIT;
