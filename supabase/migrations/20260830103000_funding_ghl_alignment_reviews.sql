BEGIN;

CREATE TABLE IF NOT EXISTS public.funding_ghl_alignment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  ghl_opportunity_id text NOT NULL REFERENCES public.ghl_opportunities(ghl_id) ON DELETE CASCADE,
  project_code text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
  suggestion_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notion_funding_page_id text,
  notion_funding_page_url text,
  reviewed_by uuid NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (batch_id, ghl_opportunity_id)
);

CREATE INDEX IF NOT EXISTS funding_ghl_alignment_reviews_opportunity_idx
  ON public.funding_ghl_alignment_reviews (ghl_opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS funding_ghl_alignment_reviews_batch_idx
  ON public.funding_ghl_alignment_reviews (batch_id, status);

ALTER TABLE public.funding_ghl_alignment_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.funding_ghl_alignment_reviews TO service_role;

COMMENT ON TABLE public.funding_ghl_alignment_reviews IS
  'Admin review receipts for bulk project assignments. Suggestions never write Notion or GHL until an approved receipt exists.';
COMMENT ON COLUMN public.funding_ghl_alignment_reviews.suggestion_snapshot IS
  'The ranked project evidence visible to the reviewer at decision time.';

COMMIT;
