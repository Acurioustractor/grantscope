ALTER TABLE procurement_shortlist_comments
  ADD COLUMN IF NOT EXISTS shortlist_item_id uuid REFERENCES procurement_shortlist_items(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_procurement_shortlist_comments_item;
CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_comments_item
  ON procurement_shortlist_comments(shortlist_item_id, created_at DESC);

ALTER TABLE procurement_shortlist_comments
  DROP CONSTRAINT IF EXISTS procurement_shortlist_comments_type_check;

ALTER TABLE procurement_shortlist_comments
  ADD CONSTRAINT procurement_shortlist_comments_type_check
    CHECK (comment_type IN ('discussion', 'submission', 'approval', 'changes_requested', 'supplier_review'));

ALTER TABLE procurement_tasks
  ADD COLUMN IF NOT EXISTS completion_outcome text,
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE procurement_tasks
  DROP CONSTRAINT IF EXISTS procurement_tasks_completion_outcome_check;

ALTER TABLE procurement_tasks
  ADD CONSTRAINT procurement_tasks_completion_outcome_check
    CHECK (
      completion_outcome IS NULL
      OR completion_outcome IN ('resolved', 'follow_up_required', 'escalated', 'approved_to_proceed', 'excluded')
    );

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_completed
  ON procurement_tasks(shortlist_id, status, completed_at DESC);
