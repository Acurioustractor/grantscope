-- Procurement team roles and outbound notification queue
-- Purpose: separate procurement permissions from generic org roles
-- and persist outbound-ready notifications for reminders and sign-off.

CREATE TABLE IF NOT EXISTS procurement_team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  procurement_role text NOT NULL DEFAULT 'reviewer',
  notification_mode text NOT NULL DEFAULT 'immediate',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_team_settings_role_check
    CHECK (procurement_role IN ('lead', 'reviewer', 'approver', 'observer')),
  CONSTRAINT procurement_team_settings_notification_mode_check
    CHECK (notification_mode IN ('immediate', 'daily_digest', 'none')),
  UNIQUE (org_profile_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_team_settings_org
  ON procurement_team_settings(org_profile_id, procurement_role, updated_at DESC);

ALTER TABLE procurement_team_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_team_settings_manage" ON procurement_team_settings;
CREATE POLICY "org_procurement_team_settings_manage" ON procurement_team_settings
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

DROP TRIGGER IF EXISTS procurement_team_settings_updated_at ON procurement_team_settings;
CREATE TRIGGER procurement_team_settings_updated_at
  BEFORE UPDATE ON procurement_team_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS procurement_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  shortlist_id uuid REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  pack_export_id uuid REFERENCES procurement_pack_exports(id) ON DELETE SET NULL,
  task_id uuid REFERENCES procurement_tasks(id) ON DELETE SET NULL,
  alert_id uuid REFERENCES procurement_alerts(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_label text,
  notification_type text NOT NULL,
  delivery_mode text NOT NULL DEFAULT 'immediate',
  status text NOT NULL DEFAULT 'queued',
  subject text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_notification_outbox_type_check
    CHECK (notification_type IN ('task_due', 'task_escalated', 'signoff_submitted', 'signoff_approved', 'signoff_changes_requested')),
  CONSTRAINT procurement_notification_outbox_delivery_mode_check
    CHECK (delivery_mode IN ('immediate', 'daily_digest')),
  CONSTRAINT procurement_notification_outbox_status_check
    CHECK (status IN ('queued', 'sent', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_procurement_notification_outbox_org
  ON procurement_notification_outbox(org_profile_id, status, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_notification_outbox_recipient
  ON procurement_notification_outbox(recipient_user_id, status, queued_at DESC);

ALTER TABLE procurement_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_notification_outbox_manage" ON procurement_notification_outbox;
CREATE POLICY "org_procurement_notification_outbox_manage" ON procurement_notification_outbox
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

DROP TRIGGER IF EXISTS procurement_notification_outbox_updated_at ON procurement_notification_outbox;
CREATE TRIGGER procurement_notification_outbox_updated_at
  BEFORE UPDATE ON procurement_notification_outbox
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
