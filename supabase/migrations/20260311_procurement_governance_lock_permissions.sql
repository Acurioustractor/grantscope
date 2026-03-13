-- Procurement approval locks, per-member permission overrides, and webhook channels.
-- Purpose: freeze approved shortlists until explicitly reopened, move beyond role-only
-- governance, and support outbound delivery beyond email.

ALTER TABLE procurement_shortlists
  ADD COLUMN IF NOT EXISTS approval_lock_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_locked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE procurement_shortlists
SET
  approval_lock_active = true,
  approval_locked_at = COALESCE(approval_locked_at, approved_at, updated_at),
  approval_locked_by = COALESCE(approval_locked_by, approved_by)
WHERE approval_status = 'approved'
  AND approved_pack_export_id IS NOT NULL
  AND approval_lock_active = false;

ALTER TABLE procurement_team_settings
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE procurement_pending_team_invites
  ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS procurement_notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'webhook',
  endpoint_url text NOT NULL,
  signing_secret text,
  enabled boolean NOT NULL DEFAULT true,
  event_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_notification_channels_type_check
    CHECK (channel_type IN ('webhook')),
  CONSTRAINT procurement_notification_channels_endpoint_check
    CHECK (endpoint_url ~* '^https?://'),
  UNIQUE (org_profile_id, channel_name)
);

CREATE INDEX IF NOT EXISTS idx_procurement_notification_channels_org
  ON procurement_notification_channels(org_profile_id, enabled, updated_at DESC);

ALTER TABLE procurement_notification_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_notification_channels_manage" ON procurement_notification_channels;
CREATE POLICY "org_procurement_notification_channels_manage" ON procurement_notification_channels
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

DROP TRIGGER IF EXISTS procurement_notification_channels_updated_at ON procurement_notification_channels;
CREATE TRIGGER procurement_notification_channels_updated_at
  BEFORE UPDATE ON procurement_notification_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE org_members
  SET
    user_id = NEW.id,
    accepted_at = COALESCE(accepted_at, NOW())
  WHERE LOWER(invited_email) = LOWER(NEW.email)
    AND user_id IS NULL;

  INSERT INTO procurement_team_settings (
    org_profile_id,
    user_id,
    procurement_role,
    notification_mode,
    permission_overrides,
    created_by,
    updated_by
  )
  SELECT
    pending.org_profile_id,
    NEW.id,
    pending.procurement_role,
    pending.notification_mode,
    pending.permission_overrides,
    pending.created_by,
    pending.updated_by
  FROM procurement_pending_team_invites pending
  JOIN org_members member
    ON member.org_profile_id = pending.org_profile_id
   AND LOWER(member.invited_email) = LOWER(pending.invited_email)
   AND member.user_id = NEW.id
  ON CONFLICT (org_profile_id, user_id)
  DO UPDATE SET
    procurement_role = EXCLUDED.procurement_role,
    notification_mode = EXCLUDED.notification_mode,
    permission_overrides = EXCLUDED.permission_overrides,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();

  DELETE FROM procurement_pending_team_invites pending
  USING org_members member
  WHERE pending.org_profile_id = member.org_profile_id
    AND LOWER(pending.invited_email) = LOWER(member.invited_email)
    AND member.user_id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
