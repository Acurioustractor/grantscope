ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS engagement_status TEXT
    CHECK (
      engagement_status IN (
        'researching',
        'ready_to_approach',
        'approached',
        'meeting',
        'proposal',
        'won',
        'lost',
        'parked'
      )
    );

ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS engagement_updated_at TIMESTAMPTZ;

UPDATE org_project_foundations
SET
  engagement_status = CASE
    WHEN stage = 'approach_now' THEN 'ready_to_approach'
    WHEN stage = 'in_conversation' THEN 'meeting'
    WHEN stage = 'parked' THEN 'parked'
    ELSE 'researching'
  END,
  engagement_updated_at = COALESCE(engagement_updated_at, updated_at, now())
WHERE engagement_status IS NULL;

ALTER TABLE org_project_foundations
  ALTER COLUMN engagement_status SET DEFAULT 'researching';

ALTER TABLE org_project_foundations
  ALTER COLUMN engagement_status SET NOT NULL;

ALTER TABLE org_project_foundations
  ALTER COLUMN engagement_updated_at SET DEFAULT now();

ALTER TABLE org_project_foundations
  ALTER COLUMN engagement_updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_project_foundations_engagement_status
  ON org_project_foundations(org_profile_id, engagement_status, engagement_updated_at DESC);
