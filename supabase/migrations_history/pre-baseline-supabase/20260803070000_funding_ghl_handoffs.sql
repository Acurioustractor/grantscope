CREATE TABLE IF NOT EXISTS public.funding_ghl_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_profile_id uuid NOT NULL REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  org_project_id uuid NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE, project_code text NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.alma_funding_opportunities(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.act_grant_recommendation_decisions(id) ON DELETE SET NULL,
  ghl_opportunity_id text, ghl_pipeline_id text, ghl_stage_id text, ghl_stage_name text,
  amount_sought numeric NOT NULL CHECK (amount_sought > 0), applicant_entity text NOT NULL,
  relationship_owner text NOT NULL, next_action text NOT NULL, next_action_due date NOT NULL,
  grantscope_decision_url text NOT NULL, notion_brief_url text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'succeeded', 'failed')),
  last_error text, callback_status text, callback_received_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_code, opportunity_id)
);
CREATE INDEX IF NOT EXISTS funding_ghl_handoffs_org_idx ON public.funding_ghl_handoffs (org_profile_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS funding_ghl_handoffs_ghl_idx ON public.funding_ghl_handoffs (ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.funding_ghl_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_event_id text NOT NULL UNIQUE, ghl_opportunity_id text NOT NULL,
  event_type text NOT NULL, stage_id text, stage_name text, status text, payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false, processing_error text, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
ALTER TABLE public.funding_ghl_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_ghl_callback_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read funding GHL handoffs" ON public.funding_ghl_handoffs;
CREATE POLICY "Org members read funding GHL handoffs" ON public.funding_ghl_handoffs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.org_members member WHERE member.org_profile_id = funding_ghl_handoffs.org_profile_id AND member.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role manages funding GHL handoffs" ON public.funding_ghl_handoffs;
CREATE POLICY "Service role manages funding GHL handoffs" ON public.funding_ghl_handoffs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role manages funding GHL callbacks" ON public.funding_ghl_callback_events;
CREATE POLICY "Service role manages funding GHL callbacks" ON public.funding_ghl_callback_events FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.funding_ghl_handoffs TO authenticated;
GRANT ALL ON public.funding_ghl_handoffs, public.funding_ghl_callback_events TO service_role;
COMMENT ON TABLE public.funding_ghl_handoffs IS 'One explicit GHL operational handoff per canonical project and funding round.';
COMMENT ON TABLE public.funding_ghl_callback_events IS 'Idempotent signed GHL callback inbox; callbacks cannot update funding evidence or fit.';
