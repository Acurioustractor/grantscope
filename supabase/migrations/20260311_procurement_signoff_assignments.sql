-- Procurement sign-off, real assignees, and due-task reminders
-- Purpose: move Tender Intelligence from single-user workflow notes to
-- actual team assignment, approval, and reminder state.

ALTER TABLE procurement_shortlists
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pack_export_id uuid REFERENCES procurement_pack_exports(id) ON DELETE SET NULL;

ALTER TABLE procurement_tasks
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE procurement_shortlists
    DROP CONSTRAINT IF EXISTS procurement_shortlists_approval_status_check;

  ALTER TABLE procurement_shortlists
    ADD CONSTRAINT procurement_shortlists_approval_status_check
    CHECK (approval_status IN ('draft', 'review_ready', 'submitted', 'approved', 'changes_requested'));
END $$;

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
        'task_due'
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
        'approval_updated'
      )
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_assignee_status
  ON procurement_tasks(assignee_user_id, status, due_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlists_approval_status
  ON procurement_shortlists(org_profile_id, approval_status, updated_at DESC);
