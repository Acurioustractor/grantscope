-- Procurement governance hardening
-- Purpose: add explicit approvers, versioned decision packs,
-- sign-off discussion, and overdue escalation state.

ALTER TABLE procurement_shortlists
  ADD COLUMN IF NOT EXISTS approver_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_pack_export_id uuid REFERENCES procurement_pack_exports(id) ON DELETE SET NULL;

ALTER TABLE procurement_pack_exports
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS source_shortlist_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

WITH ranked_exports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY shortlist_id
      ORDER BY created_at ASC, id ASC
    ) AS version_number
  FROM procurement_pack_exports
)
UPDATE procurement_pack_exports pack
SET
  version_number = ranked_exports.version_number,
  source_shortlist_updated_at = COALESCE(pack.source_shortlist_updated_at, pack.created_at)
FROM ranked_exports
WHERE pack.id = ranked_exports.id
  AND (
    pack.version_number IS DISTINCT FROM ranked_exports.version_number
    OR pack.source_shortlist_updated_at IS NULL
  );

UPDATE procurement_pack_exports
SET version_number = 1
WHERE version_number IS NULL;

ALTER TABLE procurement_pack_exports
  ALTER COLUMN version_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_pack_exports_shortlist_version
  ON procurement_pack_exports(shortlist_id, version_number);

UPDATE procurement_shortlists
SET approved_pack_export_id = last_pack_export_id
WHERE approval_status = 'approved'
  AND approved_pack_export_id IS NULL
  AND last_pack_export_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS procurement_shortlist_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid NOT NULL REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  pack_export_id uuid REFERENCES procurement_pack_exports(id) ON DELETE SET NULL,
  author_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  comment_type text NOT NULL DEFAULT 'discussion',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_shortlist_comments_type_check
    CHECK (comment_type IN ('discussion', 'submission', 'approval', 'changes_requested'))
);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_comments_shortlist
  ON procurement_shortlist_comments(shortlist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_comments_pack
  ON procurement_shortlist_comments(pack_export_id, created_at DESC);

ALTER TABLE procurement_shortlist_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_shortlist_comments_manage" ON procurement_shortlist_comments;
CREATE POLICY "org_procurement_shortlist_comments_manage" ON procurement_shortlist_comments
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

DROP TRIGGER IF EXISTS procurement_shortlist_comments_updated_at ON procurement_shortlist_comments;
CREATE TRIGGER procurement_shortlist_comments_updated_at
  BEFORE UPDATE ON procurement_shortlist_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$
BEGIN
  ALTER TABLE procurement_alerts
    DROP CONSTRAINT IF EXISTS procurement_alerts_alert_type_check;

  ALTER TABLE procurement_alerts
    ADD CONSTRAINT procurement_alerts_alert_type_check
    CHECK (
      alert_type IN (
        'new_supplier',
        'removed_supplier',
        'contract_signal_changed',
        'brief_rerun',
        'task_due',
        'task_escalated'
      )
    );
END $$;

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
        'pack_exported',
        'approval_updated',
        'comment_added'
      )
    );
END $$;
