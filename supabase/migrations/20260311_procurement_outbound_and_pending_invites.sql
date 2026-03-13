-- Procurement outbound delivery metadata and pending invite governance defaults

ALTER TABLE procurement_notification_outbox
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE INDEX IF NOT EXISTS idx_procurement_notification_outbox_delivery
  ON procurement_notification_outbox(status, delivery_mode, queued_at ASC);

CREATE TABLE IF NOT EXISTS procurement_pending_team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  procurement_role text NOT NULL DEFAULT 'reviewer',
  notification_mode text NOT NULL DEFAULT 'immediate',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_pending_team_invites_role_check
    CHECK (procurement_role IN ('lead', 'reviewer', 'approver', 'observer')),
  CONSTRAINT procurement_pending_team_invites_notification_mode_check
    CHECK (notification_mode IN ('immediate', 'daily_digest', 'none')),
  UNIQUE (org_profile_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_procurement_pending_team_invites_org
  ON procurement_pending_team_invites(org_profile_id, invited_email);

ALTER TABLE procurement_pending_team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_pending_team_invites_manage" ON procurement_pending_team_invites;
CREATE POLICY "org_procurement_pending_team_invites_manage" ON procurement_pending_team_invites
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

DROP TRIGGER IF EXISTS procurement_pending_team_invites_updated_at ON procurement_pending_team_invites;
CREATE TRIGGER procurement_pending_team_invites_updated_at
  BEFORE UPDATE ON procurement_pending_team_invites
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
    created_by,
    updated_by
  )
  SELECT
    pending.org_profile_id,
    NEW.id,
    pending.procurement_role,
    pending.notification_mode,
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

DROP TRIGGER IF EXISTS on_auth_user_created_accept_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_invites
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invitations();
