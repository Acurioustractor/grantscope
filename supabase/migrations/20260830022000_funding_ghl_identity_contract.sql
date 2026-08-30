BEGIN;

ALTER TABLE public.funding_ghl_handoffs
  ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'grantscope',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'alma_funding_opportunities',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS canonical_opportunity_ref text,
  ADD COLUMN IF NOT EXISTS funder_name text,
  ADD COLUMN IF NOT EXISTS ghl_contact_id text REFERENCES public.ghl_contacts(ghl_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ghl_assigned_to text;

UPDATE public.funding_ghl_handoffs
SET
  source_id = opportunity_id::text,
  canonical_opportunity_ref = concat('grantscope:alma_funding_opportunities:', opportunity_id::text)
WHERE source_id IS NULL
   OR canonical_opportunity_ref IS NULL;

ALTER TABLE public.funding_ghl_handoffs
  ALTER COLUMN source_id SET NOT NULL,
  ALTER COLUMN canonical_opportunity_ref SET NOT NULL;

ALTER TABLE public.funding_ghl_handoffs
  DROP CONSTRAINT IF EXISTS funding_ghl_handoffs_source_system_check,
  DROP CONSTRAINT IF EXISTS funding_ghl_handoffs_source_type_check,
  ADD CONSTRAINT funding_ghl_handoffs_source_system_check
    CHECK (source_system = 'grantscope'),
  ADD CONSTRAINT funding_ghl_handoffs_source_type_check
    CHECK (source_type = 'alma_funding_opportunities');

CREATE UNIQUE INDEX IF NOT EXISTS funding_ghl_handoffs_canonical_ref_idx
  ON public.funding_ghl_handoffs (project_code, canonical_opportunity_ref);

CREATE INDEX IF NOT EXISTS funding_ghl_handoffs_contact_idx
  ON public.funding_ghl_handoffs (ghl_contact_id, updated_at DESC)
  WHERE ghl_contact_id IS NOT NULL;

COMMENT ON COLUMN public.funding_ghl_handoffs.canonical_opportunity_ref IS
  'Typed cross-system identity. Never replace this with a grant title or unqualified UUID.';
COMMENT ON COLUMN public.funding_ghl_handoffs.ghl_contact_id IS
  'The real funder or relationship contact attached to the operational GHL opportunity.';
COMMENT ON COLUMN public.funding_ghl_handoffs.ghl_assigned_to IS
  'Native GHL user ID responsible for the operational opportunity.';

COMMIT;
