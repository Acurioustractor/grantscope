CREATE TABLE IF NOT EXISTS public.act_opportunity_observatory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  provider text NOT NULL,
  provider_result_id text,
  search_query text NOT NULL,
  result_rank integer,
  name text,
  funder_name text,
  source_url text NOT NULL,
  application_url text,
  official_domains text[] NOT NULL DEFAULT '{}',
  official_source_confirmed boolean NOT NULL DEFAULT false,
  deadline timestamptz,
  intake_type text NOT NULL DEFAULT 'unknown'
    CHECK (intake_type IN ('fixed', 'rolling', 'unknown')),
  next_review_at timestamptz,
  eligible_org_types text[] NOT NULL DEFAULT '{}',
  eligibility_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  funding_amount_status text NOT NULL DEFAULT 'unknown'
    CHECK (funding_amount_status IN ('known', 'not_published', 'unknown')),
  amount_min numeric,
  amount_max numeric,
  project_codes text[] NOT NULL DEFAULT '{}',
  project_fit_reason text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_completeness integer NOT NULL DEFAULT 0
    CHECK (evidence_completeness BETWEEN 0 AND 100),
  gate_status text NOT NULL DEFAULT 'needs_evidence'
    CHECK (gate_status IN ('needs_evidence', 'eligible_for_review', 'approved', 'rejected', 'promoted')),
  failed_requirements text[] NOT NULL DEFAULT '{}',
  provider_cost_usd numeric,
  retrieved_at timestamptz NOT NULL,
  raw_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  promoted_opportunity_id uuid REFERENCES public.alma_funding_opportunities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_act_opportunity_observatory_gate
  ON public.act_opportunity_observatory (gate_status, evidence_completeness DESC, retrieved_at DESC);

CREATE INDEX IF NOT EXISTS idx_act_opportunity_observatory_projects
  ON public.act_opportunity_observatory USING gin (project_codes);

COMMENT ON TABLE public.act_opportunity_observatory IS
  'ACT research layer for grants, procurement, capital and relationship openings. A signal is not pipeline work: it must pass the evidence gate and receive human approval before promotion.';

ALTER TABLE public.act_opportunity_observatory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages ACT opportunity observatory"
  ON public.act_opportunity_observatory;
CREATE POLICY "Service role manages ACT opportunity observatory"
  ON public.act_opportunity_observatory
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
