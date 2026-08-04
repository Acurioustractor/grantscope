-- GHL read-back columns on org_project_foundations.
-- GHL is the system of record for relationship state; discovery rows carry a
-- cached signal of it so dashboards stop claiming pipeline state from
-- discovery data alone.

ALTER TABLE org_project_foundations
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS ghl_contact_email text,
  ADD COLUMN IF NOT EXISTS ghl_tags text[],
  ADD COLUMN IF NOT EXISTS ghl_synced_at timestamptz;

COMMENT ON COLUMN org_project_foundations.ghl_tags IS
  'Cached GHL contact tags at last sync — GHL is authoritative, this is a signal.';
