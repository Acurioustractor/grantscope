BEGIN;

CREATE TABLE IF NOT EXISTS public.funding_ghl_alignment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual', 'test')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  create_inbox boolean NOT NULL DEFAULT false,
  apply_safe boolean NOT NULL DEFAULT false,
  ghl_opportunities integer NOT NULL DEFAULT 0 CHECK (ghl_opportunities >= 0),
  notion_pages_scanned integer NOT NULL DEFAULT 0 CHECK (notion_pages_scanned >= 0),
  inbox_pages_created integer NOT NULL DEFAULT 0 CHECK (inbox_pages_created >= 0),
  notion_links_written integer NOT NULL DEFAULT 0 CHECK (notion_links_written >= 0),
  safe_mappings integer NOT NULL DEFAULT 0 CHECK (safe_mappings >= 0),
  mappings_applied integer NOT NULL DEFAULT 0 CHECK (mappings_applied >= 0),
  already_aligned integer NOT NULL DEFAULT 0 CHECK (already_aligned >= 0),
  blocked integer NOT NULL DEFAULT 0 CHECK (blocked >= 0),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS funding_ghl_alignment_runs_started_idx
  ON public.funding_ghl_alignment_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.funding_ghl_alignment_state (
  alignment_key text PRIMARY KEY,
  last_success_at timestamptz,
  last_run_id uuid REFERENCES public.funding_ghl_alignment_runs(id) ON DELETE SET NULL,
  last_error text,
  locked_until timestamptz,
  locked_by uuid REFERENCES public.funding_ghl_alignment_runs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.funding_ghl_alignment_candidates (
  ghl_opportunity_id text PRIMARY KEY REFERENCES public.ghl_opportunities(ghl_id) ON DELETE CASCADE,
  ghl_opportunity_name text NOT NULL,
  notion_funding_page_id text,
  notion_funding_page_url text,
  notion_project_page_ids text[] NOT NULL DEFAULT '{}'::text[],
  project_code text,
  current_project_code text,
  classification text NOT NULL CHECK (classification IN (
    'safe_exact',
    'already_aligned',
    'conflict',
    'missing_notion_page',
    'missing_project_relation',
    'project_missing_code',
    'invalid_project_code',
    'multiple_project_codes',
    'title_collision'
  )),
  status text NOT NULL CHECK (status IN ('pending', 'applied', 'blocked')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_ghl_alignment_candidates_queue_idx
  ON public.funding_ghl_alignment_candidates (status, classification, updated_at DESC);

ALTER TABLE public.funding_ghl_alignment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_ghl_alignment_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_ghl_alignment_candidates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acquire_funding_ghl_alignment_lock(
  p_alignment_key text,
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
  INSERT INTO public.funding_ghl_alignment_state (alignment_key)
  VALUES (p_alignment_key)
  ON CONFLICT (alignment_key) DO NOTHING;

  UPDATE public.funding_ghl_alignment_state
  SET locked_by = p_run_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 60)),
      updated_at = now()
  WHERE alignment_key = p_alignment_key
    AND (locked_until IS NULL OR locked_until < now() OR locked_by = p_run_id)
  RETURNING true INTO acquired;

  RETURN coalesce(acquired, false);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_funding_ghl_alignment_lock(text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_funding_ghl_alignment_lock(text, uuid, integer) TO service_role;
GRANT ALL ON public.funding_ghl_alignment_runs,
  public.funding_ghl_alignment_state,
  public.funding_ghl_alignment_candidates TO service_role;

COMMENT ON TABLE public.funding_ghl_alignment_runs IS
  'Auditable bulk reconciliations between GHL Grants opportunities and the ACT Notion funding workspace.';
COMMENT ON TABLE public.funding_ghl_alignment_candidates IS
  'One evidence classification per current GHL Grants opportunity. Only exact GHL ID plus an explicit canonical Notion project relation may be auto-applied.';
COMMENT ON COLUMN public.funding_ghl_alignment_candidates.classification IS
  'Title matches are collision evidence only and can never produce an automatic project mapping.';
COMMENT ON COLUMN public.funding_ghl_alignment_candidates.evidence IS
  'Machine-readable identity evidence, conflicts and related Notion page IDs used to reproduce the classification.';

COMMIT;
