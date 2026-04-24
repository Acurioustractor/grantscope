ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS next_touch_at TIMESTAMPTZ;

ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS next_touch_note TEXT;

ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_next_touch
  ON org_project_foundations(org_profile_id, next_touch_at);

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_last_interaction
  ON org_project_foundations(org_profile_id, last_interaction_at DESC);
