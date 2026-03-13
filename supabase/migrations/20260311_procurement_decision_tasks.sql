-- Procurement decision layer and review tasks
-- Purpose: let each shortlist carry an explicit recommendation and turn
-- automation deltas into a review queue that procurement teams can work.

ALTER TABLE procurement_shortlists
  ADD COLUMN IF NOT EXISTS recommendation_summary text,
  ADD COLUMN IF NOT EXISTS why_now text,
  ADD COLUMN IF NOT EXISTS risk_summary text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS decision_due_at timestamptz;

CREATE TABLE IF NOT EXISTS procurement_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid NOT NULL REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  shortlist_item_id uuid REFERENCES procurement_shortlist_items(id) ON DELETE SET NULL,
  alert_id uuid REFERENCES procurement_alerts(id) ON DELETE SET NULL,
  task_key text,
  task_type text NOT NULL CHECK (task_type IN ('review_alert', 'follow_up', 'evidence_check', 'pack_refresh')),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  due_at timestamptz,
  assignee_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_org_status
  ON procurement_tasks(org_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_shortlist_status
  ON procurement_tasks(shortlist_id, status, due_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_item
  ON procurement_tasks(shortlist_item_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_tasks_task_key
  ON procurement_tasks(org_profile_id, task_key, status);

ALTER TABLE procurement_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_tasks_manage" ON procurement_tasks;
CREATE POLICY "org_procurement_tasks_manage" ON procurement_tasks
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

DROP TRIGGER IF EXISTS procurement_tasks_updated_at ON procurement_tasks;
CREATE TRIGGER procurement_tasks_updated_at
  BEFORE UPDATE ON procurement_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
