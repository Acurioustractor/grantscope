CREATE TABLE IF NOT EXISTS public.act_opportunity_benchmark_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_version text NOT NULL DEFAULT 'act-opportunity-v1',
  project_code text NOT NULL,
  opportunity_id uuid REFERENCES public.alma_funding_opportunities(id) ON DELETE CASCADE,
  name text NOT NULL,
  funder_name text,
  source_url text,
  deadline timestamptz,
  expected_label text CHECK (expected_label IN ('relevant', 'not_relevant')),
  label_source text NOT NULL
    CHECK (label_source IN ('human_decision', 'curated_verification', 'human_benchmark_review')),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'confirmed', 'disputed')),
  rationale text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (benchmark_version, project_code, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_act_opportunity_benchmark_review
  ON public.act_opportunity_benchmark_cases (benchmark_version, review_status, created_at);

ALTER TABLE public.act_opportunity_benchmark_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ACT opportunity benchmark"
  ON public.act_opportunity_benchmark_cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.act_opportunity_benchmark_cases
  TO service_role;

COMMENT ON TABLE public.act_opportunity_benchmark_cases IS
  'Versioned, provenance-bearing evaluation set for ACT opportunity discovery. Pending cases require human review; labels are never inferred from model output.';

