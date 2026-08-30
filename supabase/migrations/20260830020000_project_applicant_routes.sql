-- Canonical applicant registry and project route contracts.
-- One org-level entity can serve many projects; each project explicitly routes
-- through a governed applicant record before a GHL handoff can be created.

ALTER TABLE public.org_applicant_entities
  ADD COLUMN IF NOT EXISTS acn text,
  ADD COLUMN IF NOT EXISTS dgr_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS ghl_company_id text,
  ADD COLUMN IF NOT EXISTS notion_page_id text;

ALTER TABLE public.org_applicant_entities
  DROP CONSTRAINT IF EXISTS org_applicant_entities_dgr_status_check,
  DROP CONSTRAINT IF EXISTS org_applicant_entities_verification_status_check;

ALTER TABLE public.org_applicant_entities
  ADD CONSTRAINT org_applicant_entities_dgr_status_check
    CHECK (dgr_status IN ('endorsed', 'not_endorsed', 'unknown')),
  ADD CONSTRAINT org_applicant_entities_verification_status_check
    CHECK (verification_status IN ('verified', 'needs_review'));

CREATE UNIQUE INDEX IF NOT EXISTS org_applicant_entities_one_default_idx
  ON public.org_applicant_entities (org_profile_id)
  WHERE is_default AND status <> 'archived';

-- The old default was created while ACT's Pty registration was pending. The
-- canonical org record now holds the incorporated entity, ABN, ACN and graph id.
UPDATE public.org_applicant_entities applicant
SET
  name = org.name,
  entity_type = 'company',
  status = 'active',
  abn = org.abn,
  acn = org.acn,
  linked_gs_entity_id = org.linked_gs_entity_id,
  verification_status = CASE
    WHEN org.abn IS NOT NULL AND org.linked_gs_entity_id IS NOT NULL THEN 'verified'
    ELSE 'needs_review'
  END,
  verified_at = CASE
    WHEN org.abn IS NOT NULL AND org.linked_gs_entity_id IS NOT NULL THEN now()
    ELSE NULL
  END,
  verification_source = 'org_profiles',
  notes = concat_ws(E'\n', nullif(applicant.notes, ''), 'Reconciled from the canonical incorporated ACT organisation record.'),
  updated_at = now()
FROM public.org_profiles org
WHERE org.slug = 'act'
  AND applicant.org_profile_id = org.id
  AND applicant.is_default
  AND applicant.entity_type = 'pending_company'
  AND applicant.status = 'pending'
  AND org.org_status = 'incorporated'
  AND org.abn IS NOT NULL;

-- ACNC + graph identity verify the charity entity itself. They do not prove DGR
-- endorsement, so dgr_status deliberately remains unknown.
UPDATE public.org_applicant_entities applicant
SET
  verification_status = 'verified',
  verified_at = now(),
  verification_source = 'gs_entities+acnc_charities',
  updated_at = now()
FROM public.org_profiles org
WHERE org.slug = 'act'
  AND applicant.org_profile_id = org.id
  AND applicant.status = 'active'
  AND applicant.abn IS NOT NULL
  AND applicant.linked_gs_entity_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.acnc_charities charity
    WHERE regexp_replace(charity.abn, '[^0-9]', '', 'g') = regexp_replace(applicant.abn, '[^0-9]', '', 'g')
  );

CREATE TABLE IF NOT EXISTS public.project_applicant_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  org_project_id uuid NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE,
  applicant_entity_id uuid NOT NULL REFERENCES public.org_applicant_entities(id) ON DELETE RESTRICT,
  route_type text NOT NULL DEFAULT 'direct'
    CHECK (route_type IN ('direct', 'charity', 'auspice', 'dgr', 'partner', 'commercial')),
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('ready', 'needs_review', 'blocked')),
  is_default boolean NOT NULL DEFAULT false,
  eligible_instruments text[] NOT NULL DEFAULT '{}',
  constraints text[] NOT NULL DEFAULT '{}',
  rationale text,
  provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_project_id, applicant_entity_id, route_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_applicant_routes_one_default_idx
  ON public.project_applicant_routes (org_project_id)
  WHERE is_default;
CREATE INDEX IF NOT EXISTS project_applicant_routes_org_idx
  ON public.project_applicant_routes (org_profile_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_applicant_routes_entity_idx
  ON public.project_applicant_routes (applicant_entity_id, org_project_id);

ALTER TABLE public.project_applicant_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_applicant_routes_select ON public.project_applicant_routes;
CREATE POLICY project_applicant_routes_select
  ON public.project_applicant_routes FOR SELECT
  USING (user_can_access_org(org_profile_id));
DROP POLICY IF EXISTS project_applicant_routes_insert ON public.project_applicant_routes;
CREATE POLICY project_applicant_routes_insert
  ON public.project_applicant_routes FOR INSERT
  WITH CHECK (user_can_access_org(org_profile_id));
DROP POLICY IF EXISTS project_applicant_routes_update ON public.project_applicant_routes;
CREATE POLICY project_applicant_routes_update
  ON public.project_applicant_routes FOR UPDATE
  USING (user_can_access_org(org_profile_id));
DROP POLICY IF EXISTS project_applicant_routes_delete ON public.project_applicant_routes;
CREATE POLICY project_applicant_routes_delete
  ON public.project_applicant_routes FOR DELETE
  USING (user_can_access_org(org_profile_id));
DROP POLICY IF EXISTS project_applicant_routes_service ON public.project_applicant_routes;
CREATE POLICY project_applicant_routes_service
  ON public.project_applicant_routes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.project_applicant_routes TO authenticated;
GRANT ALL ON public.project_applicant_routes TO service_role;

-- One rule creates the initial route contract for every active project. It is
-- conservative: a direct company route never claims DGR or charity eligibility.
INSERT INTO public.project_applicant_routes (
  org_profile_id,
  org_project_id,
  applicant_entity_id,
  route_type,
  status,
  is_default,
  eligible_instruments,
  constraints,
  rationale,
  provenance,
  created_by
)
SELECT
  project.org_profile_id,
  project.id,
  applicant.id,
  'direct',
  CASE
    WHEN applicant.status = 'active'
      AND applicant.abn IS NOT NULL
      AND applicant.verification_status = 'verified' THEN 'ready'
    ELSE 'blocked'
  END,
  true,
  CASE applicant.entity_type
    WHEN 'company' THEN ARRAY['contract', 'commercial', 'grant_non_dgr']::text[]
    WHEN 'charity' THEN ARRAY['grant', 'philanthropy', 'contract']::text[]
    ELSE ARRAY[]::text[]
  END,
  CASE applicant.entity_type
    WHEN 'company' THEN ARRAY[
      'DGR-required opportunities need a separately verified endorsed route.',
      'Charity-only opportunities need an eligible charity or auspice route.'
    ]::text[]
    WHEN 'charity' THEN ARRAY[
      'DGR eligibility remains blocked until endorsement evidence is attached.'
    ]::text[]
    ELSE ARRAY['Confirm the legal applicant route before pursuing funding.']::text[]
  END,
  'Portfolio default inherited from the canonical ACT applicant entity; opportunity-specific eligibility is enforced at Pursue.',
  jsonb_build_array(
    jsonb_build_object('type', 'table', 'table', 'org_projects', 'id', project.id),
    jsonb_build_object('type', 'table', 'table', 'org_applicant_entities', 'id', applicant.id)
  ),
  'applicant-route-backfill'
FROM public.org_projects project
JOIN public.org_profiles org ON org.id = project.org_profile_id
JOIN public.org_applicant_entities applicant
  ON applicant.org_profile_id = project.org_profile_id
 AND applicant.is_default
 AND applicant.status <> 'archived'
WHERE org.slug = 'act'
  AND project.status = 'active'
ON CONFLICT (org_project_id, applicant_entity_id, route_type) DO NOTHING;

ALTER TABLE public.funding_ghl_handoffs
  ADD COLUMN IF NOT EXISTS applicant_entity_id uuid REFERENCES public.org_applicant_entities(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS applicant_route_id uuid REFERENCES public.project_applicant_routes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS funding_ghl_handoffs_applicant_idx
  ON public.funding_ghl_handoffs (applicant_entity_id, updated_at DESC);

UPDATE public.funding_ghl_handoffs handoff
SET
  applicant_entity_id = applicant.id,
  applicant_route_id = (
    SELECT route.id
    FROM public.project_applicant_routes route
    WHERE route.org_project_id = handoff.org_project_id
      AND route.applicant_entity_id = applicant.id
    ORDER BY route.is_default DESC, route.created_at
    LIMIT 1
  ),
  updated_at = now()
FROM public.org_applicant_entities applicant
WHERE handoff.org_profile_id = applicant.org_profile_id
  AND lower(trim(handoff.applicant_entity)) = lower(trim(applicant.name))
  AND handoff.applicant_entity_id IS NULL;

COMMENT ON TABLE public.project_applicant_routes IS
  'Governed project-to-applicant contracts. GHL handoffs must select a ready route instead of accepting free-text applicant names.';
COMMENT ON COLUMN public.org_applicant_entities.dgr_status IS
  'DGR endorsement state. Charity registration alone must not set this to endorsed.';
COMMENT ON COLUMN public.org_applicant_entities.verification_status IS
  'Whether the entity identity and legal identifiers are backed by canonical evidence.';
COMMENT ON COLUMN public.funding_ghl_handoffs.applicant_route_id IS
  'Canonical applicant route selected when the Pursue decision was confirmed.';
