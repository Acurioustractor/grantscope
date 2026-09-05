-- Procurement evidence snapshots and decision-pack exports
-- Purpose: make shortlist review work defensible and persist printable
-- procurement packs tied to the exact shortlist evidence used.

ALTER TABLE procurement_shortlist_items
  ADD COLUMN IF NOT EXISTS review_checklist jsonb NOT NULL DEFAULT '{"fit": false, "risk_checked": false, "evidence_checked": false, "decision_made": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS procurement_pack_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid NOT NULL REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES procurement_workflow_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  export_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  pack_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_pack_exports_org
  ON procurement_pack_exports(org_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_pack_exports_shortlist
  ON procurement_pack_exports(shortlist_id, created_at DESC);

ALTER TABLE procurement_pack_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_pack_exports_manage" ON procurement_pack_exports;
CREATE POLICY "org_procurement_pack_exports_manage" ON procurement_pack_exports
  FOR ALL
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS procurement_pack_exports_updated_at ON procurement_pack_exports;
CREATE TRIGGER procurement_pack_exports_updated_at
  BEFORE UPDATE ON procurement_pack_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$
BEGIN
  ALTER TABLE procurement_shortlist_events
    DROP CONSTRAINT IF EXISTS procurement_shortlist_events_event_type_check;

  ALTER TABLE procurement_shortlist_events
    ADD CONSTRAINT procurement_shortlist_events_event_type_check
    CHECK (
      event_type IN (
        'shortlist_created',
        'shortlist_updated',
        'item_added',
        'item_removed',
        'note_updated',
        'decision_updated',
        'task_created',
        'task_updated',
        'task_completed',
        'checklist_updated',
        'pack_exported'
      )
    );
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;
