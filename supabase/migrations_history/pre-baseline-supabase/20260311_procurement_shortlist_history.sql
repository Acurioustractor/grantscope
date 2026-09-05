-- Procurement shortlist history and multi-shortlist support
-- Purpose: add immutable audit events for shortlist actions so procurement
-- workflows are defensible and can support multiple shortlists per org.

CREATE TABLE IF NOT EXISTS procurement_shortlist_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  shortlist_item_id uuid REFERENCES procurement_shortlist_items(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'shortlist_created',
      'shortlist_updated',
      'item_added',
      'item_removed',
      'note_updated',
      'decision_updated',
      'task_created',
      'task_updated',
      'task_completed'
    )
  ),
  event_summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_events_org
  ON procurement_shortlist_events(org_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_events_shortlist
  ON procurement_shortlist_events(shortlist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_events_item
  ON procurement_shortlist_events(shortlist_item_id, created_at DESC);

ALTER TABLE procurement_shortlist_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_shortlist_events_select" ON procurement_shortlist_events;
CREATE POLICY "org_procurement_shortlist_events_select" ON procurement_shortlist_events
  FOR SELECT
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_procurement_shortlist_events_insert" ON procurement_shortlist_events;
CREATE POLICY "org_procurement_shortlist_events_insert" ON procurement_shortlist_events
  FOR INSERT
  WITH CHECK (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );
