-- Procurement shortlist watches and alerts
-- Purpose: let saved procurement briefs rerun on a schedule and persist
-- delta alerts when the market view changes.

CREATE TABLE IF NOT EXISTS procurement_shortlist_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid NOT NULL UNIQUE REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  interval_hours integer NOT NULL DEFAULT 24 CHECK (interval_hours IN (12, 24, 72, 168)),
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_alert_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  shortlist_item_id uuid REFERENCES procurement_shortlist_items(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (
    alert_type IN ('new_supplier', 'removed_supplier', 'contract_signal_changed', 'brief_rerun')
  ),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_watches_org
  ON procurement_shortlist_watches(org_profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_watches_next_run
  ON procurement_shortlist_watches(enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_procurement_alerts_org
  ON procurement_alerts(org_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_alerts_shortlist
  ON procurement_alerts(shortlist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_alerts_status
  ON procurement_alerts(org_profile_id, status, created_at DESC);

ALTER TABLE procurement_shortlist_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_shortlist_watches_manage" ON procurement_shortlist_watches;
CREATE POLICY "org_procurement_shortlist_watches_manage" ON procurement_shortlist_watches
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

DROP POLICY IF EXISTS "org_procurement_alerts_manage" ON procurement_alerts;
CREATE POLICY "org_procurement_alerts_manage" ON procurement_alerts
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

DROP TRIGGER IF EXISTS procurement_shortlist_watches_updated_at ON procurement_shortlist_watches;
CREATE TRIGGER procurement_shortlist_watches_updated_at
  BEFORE UPDATE ON procurement_shortlist_watches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS procurement_alerts_updated_at ON procurement_alerts;
CREATE TRIGGER procurement_alerts_updated_at
  BEFORE UPDATE ON procurement_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
