-- 20260914100000_arc_grants_not_open_opportunities.sql
-- The 5,598 source='arc-grants' rows in grant_opportunities are funded ARC research projects (named projects at named
-- universities, each linking to its dataportal.arc.gov.au grant record), not rounds anyone can apply to. The grant-engine
-- ARC plugin wrote the project's anticipated-end-date into deadline/closes_at and the column default typed every row
-- open_opportunity, so 3,988 of them read as "open, closing 2026-2035" and made up 91% of all future-dated grants.
-- Found 2026-09-14 comparing our live count to Grant'd. The plugin no longer emits a deadline (same branch).
-- The end date moves to metadata.arc_anticipated_end_date, so nothing is lost. Restore: copy it back and reset grant_type.
BEGIN;

UPDATE grant_opportunities
SET metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('arc_anticipated_end_date', coalesce(closes_at, deadline)),
    deadline = NULL,
    closes_at = NULL,
    grant_type = 'historical_award',
    status = 'closed',
    updated_at = now()
WHERE source = 'arc-grants'
  AND grant_type = 'open_opportunity';

COMMIT;
