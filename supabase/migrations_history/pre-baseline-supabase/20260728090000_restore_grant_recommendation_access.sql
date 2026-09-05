BEGIN;

GRANT SELECT ON TABLE public.act_grant_recommendations
  TO anon, authenticated, service_role;

UPDATE public.act_grant_recommendation_projects
SET
  in_scope = false,
  notes = 'Merged into ACT-CORE on 2026-05-15; excluded from grant recommendations.'
WHERE project_code = 'ACT-IN';

UPDATE public.act_grant_recommendation_projects arp
SET notes = p.name
FROM public.projects p
WHERE p.code = arp.project_code
  AND NULLIF(BTRIM(arp.notes), '') IS NULL;

COMMIT;
