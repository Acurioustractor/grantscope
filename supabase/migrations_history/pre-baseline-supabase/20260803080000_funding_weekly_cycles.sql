CREATE TABLE IF NOT EXISTS public.funding_weekly_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_profile_id uuid NOT NULL REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(), metrics jsonb NOT NULL,
  queue_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb, priority_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  digest_markdown text NOT NULL, delivery_status text NOT NULL DEFAULT 'in_app' CHECK (delivery_status IN ('in_app', 'queued', 'sent', 'failed')),
  delivery_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_profile_id, week_start)
);
CREATE INDEX IF NOT EXISTS funding_weekly_cycles_org_idx ON public.funding_weekly_cycles (org_profile_id, week_start DESC);
ALTER TABLE public.funding_weekly_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read funding weekly cycles" ON public.funding_weekly_cycles;
CREATE POLICY "Org members read funding weekly cycles" ON public.funding_weekly_cycles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.org_members member WHERE member.org_profile_id = funding_weekly_cycles.org_profile_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role manages funding weekly cycles" ON public.funding_weekly_cycles;
CREATE POLICY "Service role manages funding weekly cycles" ON public.funding_weekly_cycles FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.funding_weekly_cycles TO authenticated;
GRANT ALL ON public.funding_weekly_cycles TO service_role;
COMMENT ON TABLE public.funding_weekly_cycles IS 'Persisted weekly ACT funding operating-cycle snapshot and action digest.';
