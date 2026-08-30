BEGIN;

CREATE TABLE IF NOT EXISTS public.funding_ghl_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual', 'test')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  pipeline_id text NOT NULL,
  cursor_before timestamptz,
  cursor_after timestamptz,
  pages_fetched integer NOT NULL DEFAULT 0 CHECK (pages_fetched >= 0),
  opportunities_fetched integer NOT NULL DEFAULT 0 CHECK (opportunities_fetched >= 0),
  opportunities_changed integer NOT NULL DEFAULT 0 CHECK (opportunities_changed >= 0),
  opportunities_upserted integer NOT NULL DEFAULT 0 CHECK (opportunities_upserted >= 0),
  contacts_created integer NOT NULL DEFAULT 0 CHECK (contacts_created >= 0),
  handoffs_updated integer NOT NULL DEFAULT 0 CHECK (handoffs_updated >= 0),
  decisions_updated integer NOT NULL DEFAULT 0 CHECK (decisions_updated >= 0),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS funding_ghl_sync_runs_started_idx
  ON public.funding_ghl_sync_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.funding_ghl_sync_state (
  sync_key text PRIMARY KEY,
  pipeline_id text NOT NULL,
  cursor_updated_at timestamptz,
  last_success_at timestamptz,
  last_run_id uuid REFERENCES public.funding_ghl_sync_runs(id) ON DELETE SET NULL,
  last_error text,
  locked_until timestamptz,
  locked_by uuid REFERENCES public.funding_ghl_sync_runs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_ghl_handoffs
  ADD COLUMN IF NOT EXISTS last_ghl_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS ghl_updated_at timestamptz;

ALTER TABLE public.funding_ghl_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_ghl_sync_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acquire_funding_ghl_sync_lock(
  p_sync_key text,
  p_pipeline_id text,
  p_run_id uuid,
  p_lease_seconds integer DEFAULT 600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean := false;
BEGIN
  INSERT INTO public.funding_ghl_sync_state (sync_key, pipeline_id)
  VALUES (p_sync_key, p_pipeline_id)
  ON CONFLICT (sync_key) DO NOTHING;

  UPDATE public.funding_ghl_sync_state
  SET pipeline_id = p_pipeline_id,
      locked_by = p_run_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
      updated_at = now()
  WHERE sync_key = p_sync_key
    AND (locked_until IS NULL OR locked_until < now() OR locked_by = p_run_id)
  RETURNING true INTO acquired;

  RETURN coalesce(acquired, false);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_funding_ghl_sync_lock(text, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_funding_ghl_sync_lock(text, text, uuid, integer) TO service_role;
GRANT ALL ON public.funding_ghl_sync_runs, public.funding_ghl_sync_state TO service_role;

COMMENT ON TABLE public.funding_ghl_sync_runs IS
  'Auditable executions of the scheduled GHL Grants pipeline pull. Service-role only.';
COMMENT ON TABLE public.funding_ghl_sync_state IS
  'Durable high-water mark and last-run state for the GHL Grants pipeline pull.';
COMMENT ON COLUMN public.funding_ghl_sync_state.cursor_updated_at IS
  'Highest GHL opportunity updatedAt observed. Pagination still scans the complete small pipeline because GHL exposes no updatedSince filter.';
COMMENT ON COLUMN public.funding_ghl_sync_state.locked_until IS
  'Short database lease preventing overlapping scheduled and manual reconciliation runs.';
COMMENT ON COLUMN public.funding_ghl_handoffs.last_ghl_sync_at IS
  'Last time scheduled reconciliation observed this governed handoff in GHL.';

COMMIT;
