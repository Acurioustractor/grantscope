CREATE TABLE IF NOT EXISTS public.opportunity_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_ref text NOT NULL,
  project_code text NOT NULL,
  deterministic_key text NOT NULL,
  target_system text NOT NULL CHECK (target_system IN ('notion', 'ghl')),
  target_record_id text,
  target_url text,
  decision_id uuid REFERENCES public.opportunity_decisions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'promoted', 'linked', 'blocked', 'superseded', 'failed')),
  gate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  duplicate_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  promoted_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS opportunity_promotions_source_target_uidx
  ON public.opportunity_promotions (source_type, source_ref, project_code, target_system);

CREATE UNIQUE INDEX IF NOT EXISTS opportunity_promotions_target_record_uidx
  ON public.opportunity_promotions (target_system, target_record_id)
  WHERE target_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS opportunity_promotions_key_idx
  ON public.opportunity_promotions (deterministic_key);

ALTER TABLE public.opportunity_promotions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.opportunity_promotions TO service_role;
GRANT SELECT ON TABLE public.opportunity_promotions TO authenticated;

DROP POLICY IF EXISTS opportunity_promotions_service_role ON public.opportunity_promotions;
CREATE POLICY opportunity_promotions_service_role ON public.opportunity_promotions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.opportunity_promotions IS
  'Auditable, idempotent handoffs from GrantScope evidence into Notion working records and confirmed GHL execution records.';
