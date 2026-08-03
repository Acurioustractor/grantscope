-- Ask GrantScope correction capture.
--
-- A correction is a human saying the assistant got something wrong. It is
-- recorded as its own durable fact, separate from the benchmark label it may
-- imply, so that:
--   1. the reason a label changed is never lost, and
--   2. production ranking is never retrained as a side effect of a correction.
-- Only the benchmark path consumes these; act_grant_recommendations_current and
-- search_project_funding_hybrid do not read this table.

CREATE TABLE IF NOT EXISTS public.ask_grantscope_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  project_code text,
  opportunity_id uuid REFERENCES public.alma_funding_opportunities(id) ON DELETE CASCADE,
  correction_type text NOT NULL CHECK (correction_type IN (
    'wrong_eligibility',   -- we said/implied eligible when it is not, or vice versa
    'not_useful',          -- eligible but a waste of this project's time
    'good_result',         -- confirms the assistant got it right
    'missing_opportunity', -- something real was not surfaced
    'wrong_fact'           -- a stated verified_fact is inaccurate
  )),
  -- The benchmark label this correction implies. Null for corrections that
  -- carry no label (a missing opportunity has nothing to relabel yet).
  implied_label text CHECK (implied_label IN ('relevant', 'not_relevant')),
  rationale text NOT NULL,
  -- The graded answer as it was shown. Without this we cannot tell later
  -- whether the assistant improved or the question simply changed.
  answer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Set once the correction has been folded into benchmark memory.
  applied_to_benchmark boolean NOT NULL DEFAULT false,
  benchmark_case_id uuid REFERENCES public.act_opportunity_benchmark_cases(id) ON DELETE SET NULL,
  corrected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrected_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ask_grantscope_corrections_opportunity_idx
  ON public.ask_grantscope_corrections (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ask_grantscope_corrections_project_idx
  ON public.ask_grantscope_corrections (project_code, created_at DESC);
CREATE INDEX IF NOT EXISTS ask_grantscope_corrections_unapplied_idx
  ON public.ask_grantscope_corrections (created_at DESC) WHERE NOT applied_to_benchmark;

ALTER TABLE public.ask_grantscope_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read ask corrections" ON public.ask_grantscope_corrections;
CREATE POLICY "Authenticated read ask corrections"
  ON public.ask_grantscope_corrections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages ask corrections" ON public.ask_grantscope_corrections;
CREATE POLICY "Service role manages ask corrections"
  ON public.ask_grantscope_corrections FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.ask_grantscope_corrections TO authenticated;
GRANT ALL ON public.ask_grantscope_corrections TO service_role;

COMMENT ON TABLE public.ask_grantscope_corrections IS
  'Human corrections to Ask GrantScope answers. Feeds benchmark memory only; production ranking never reads this table.';
COMMENT ON COLUMN public.ask_grantscope_corrections.answer_snapshot IS
  'The graded evidence packet as shown to the reviewer, so later comparisons are like-for-like.';
