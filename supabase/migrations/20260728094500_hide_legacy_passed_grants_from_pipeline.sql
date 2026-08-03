BEGIN;

WITH legacy_passed AS (
  SELECT DISTINCT opportunity_id
  FROM public.act_grant_recommendation_decisions
  WHERE decision = 'passed'
    AND opportunity_id <> '1749e276-30fd-42a5-900c-5985a578a3bb'::uuid
)
UPDATE public.alma_funding_opportunities opportunity
SET
  status = 'archived',
  verification_status = 'stale',
  verification_notes = CONCAT_WS(
    E'\n',
    NULLIF(opportunity.verification_notes, ''),
    'Hidden from operating pipeline 2026-07-28: retained only as historical recommendation feedback.'
  ),
  updated_at = now()
FROM legacy_passed legacy
WHERE opportunity.id = legacy.opportunity_id
  AND opportunity.status NOT IN ('archived', 'closed');

COMMIT;

