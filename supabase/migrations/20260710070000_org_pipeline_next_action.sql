-- Give the shared ACT pipeline a lightweight operating contract: one owner,
-- one concrete next action, and one review/touch date.

ALTER TABLE public.org_pipeline
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_org_pipeline_next_action
  ON public.org_pipeline (org_profile_id, next_action_at)
  WHERE next_action_at IS NOT NULL;

COMMENT ON COLUMN public.org_pipeline.owner_name IS
  'Human-readable owner responsible for progressing this opportunity.';

COMMENT ON COLUMN public.org_pipeline.next_action IS
  'Single concrete next action for the opportunity.';

COMMENT ON COLUMN public.org_pipeline.next_action_at IS
  'Date or time when the next action should be completed or reviewed.';
