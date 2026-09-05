-- Allow pending invitations (user_id NULL until invitee signs up)
ALTER TABLE org_members ALTER COLUMN user_id DROP NOT NULL;

-- Store the invited email for pending invitations
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- Prevent duplicate pending invitations to the same email within an org
CREATE UNIQUE INDEX IF NOT EXISTS org_members_pending_invite_unique
  ON org_members (org_profile_id, invited_email)
  WHERE invited_email IS NOT NULL AND user_id IS NULL;

-- Auto-accept pending invitations when a user signs up with a matching email
CREATE OR REPLACE FUNCTION accept_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE org_members
  SET user_id = NEW.id, accepted_at = NOW()
  WHERE invited_email = NEW.email AND user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow re-running
DROP TRIGGER IF EXISTS on_auth_user_created_accept_invites ON auth.users;

CREATE TRIGGER on_auth_user_created_accept_invites
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION accept_pending_invitations();

-- Update RLS: allow members to see pending invitations in their org
-- (Existing policies already filter by org_profile_id, so pending rows are included automatically)
