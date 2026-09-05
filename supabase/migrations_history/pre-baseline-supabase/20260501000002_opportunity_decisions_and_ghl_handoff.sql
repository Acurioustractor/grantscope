-- ACT-wide opportunity routing, learning memory, and confirmed GHL handoff refs.

CREATE TABLE IF NOT EXISTS opportunity_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_profile_id uuid REFERENCES org_profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  project_code text,
  pathway text,
  decision text NOT NULL CHECK (
    decision IN ('no', 'later', 'research', 'partner', 'apply', 'send_to_ghl', 'won', 'lost', 'more_info')
  ),
  reason text,
  notes text,
  evidence_gaps text[] NOT NULL DEFAULT '{}',
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_decisions_source
  ON opportunity_decisions(source_type, source_ref);

CREATE INDEX IF NOT EXISTS idx_opportunity_decisions_project_pathway
  ON opportunity_decisions(project_code, pathway, decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_decisions_org_created
  ON opportunity_decisions(org_profile_id, created_at DESC);

ALTER TABLE opportunity_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunity decisions select own" ON opportunity_decisions;
CREATE POLICY "opportunity decisions select own"
  ON opportunity_decisions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_profile_id = opportunity_decisions.org_profile_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opportunity decisions insert own" ON opportunity_decisions;
CREATE POLICY "opportunity decisions insert own"
  ON opportunity_decisions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM org_members om
      WHERE om.org_profile_id = opportunity_decisions.org_profile_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'editor')
    )
  );

ALTER TABLE org_pipeline
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS pathway text,
  ADD COLUMN IF NOT EXISTS recommended_role text,
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_org_pipeline_source_ref
  ON org_pipeline(source_type, source_ref);

CREATE INDEX IF NOT EXISTS idx_org_pipeline_project_pathway
  ON org_pipeline(project_code, pathway, status);
