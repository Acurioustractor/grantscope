CREATE TABLE IF NOT EXISTS public.validation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  review_date date NOT NULL,
  reviewer text,
  row_key text NOT NULL UNIQUE,
  record_type text NOT NULL CHECK (record_type IN ('grant', 'foundation')),
  surface text,
  source text,
  record_id text,
  record_name text,
  status text NOT NULL CHECK (status IN ('correct', 'usable_but_incomplete', 'wrong_noisy')),
  issue_type text,
  url_works boolean,
  open_now_correct boolean,
  deadline_correct boolean,
  amount_correct boolean,
  provider_correct boolean,
  match_relevance_score numeric,
  relationship_signal_score numeric,
  actionability_score numeric,
  notes text,
  recommended_fix text,
  owner text
);

CREATE INDEX IF NOT EXISTS validation_reviews_review_date_idx
  ON public.validation_reviews (review_date DESC);

CREATE INDEX IF NOT EXISTS validation_reviews_record_type_idx
  ON public.validation_reviews (record_type);

CREATE INDEX IF NOT EXISTS validation_reviews_status_idx
  ON public.validation_reviews (status);

CREATE INDEX IF NOT EXISTS validation_reviews_issue_type_idx
  ON public.validation_reviews (issue_type);

ALTER TABLE public.validation_reviews ENABLE ROW LEVEL SECURITY;
