BEGIN;

WITH invalid_active_opportunities AS (
  SELECT DISTINCT opportunity_id
  FROM public.act_grant_recommendation_decisions
  WHERE decision IN ('watching', 'pursuing', 'applied', 'submitted')
    AND opportunity_id <> '1749e276-30fd-42a5-900c-5985a578a3bb'::uuid
)
UPDATE public.alma_funding_opportunities opportunity
SET
  status = 'archived',
  verification_status = 'stale',
  verification_notes = CONCAT_WS(
    E'\n',
    NULLIF(opportunity.verification_notes, ''),
    'Archived 2026-07-28: legacy ACT watchlist reset. No current, project-specific application evidence.'
  ),
  updated_at = now()
FROM invalid_active_opportunities invalid
WHERE opportunity.id = invalid.opportunity_id;

UPDATE public.act_grant_recommendation_decisions
SET
  decision = 'passed',
  notes = CONCAT_WS(
    E'\n',
    NULLIF(notes, ''),
    'Pipeline reset 2026-07-28: archived because the round was expired, stale, restricted, unsupported, or lacked a current project-specific applicant path.'
  ),
  decided_at = now()
WHERE decision IN ('watching', 'pursuing', 'applied', 'submitted')
  AND opportunity_id <> '1749e276-30fd-42a5-900c-5985a578a3bb'::uuid;

DELETE FROM public.act_grant_recommendation_decisions
WHERE project_code = 'ACT-CORE'
  AND opportunity_id = '1749e276-30fd-42a5-900c-5985a578a3bb'::uuid;

COMMIT;

