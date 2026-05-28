-- Wire up action surfaces on the Today page:
--   * funder_nudge_log: audit trail for outreach nudges
-- 2026-05-22

BEGIN;

CREATE TABLE IF NOT EXISTS funder_nudge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_name text NOT NULL,
  funder_name_lc text GENERATED ALWAYS AS (lower(funder_name)) STORED,
  project_code text,
  nudge_type text NOT NULL DEFAULT 'email',
  subject text,
  body text,
  outcome text,
  nudged_by text DEFAULT 'system',
  nudged_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_funder_nudge_log_funder_lc ON funder_nudge_log (funder_name_lc);
CREATE INDEX IF NOT EXISTS idx_funder_nudge_log_nudged_at ON funder_nudge_log (nudged_at DESC);
CREATE INDEX IF NOT EXISTS idx_funder_nudge_log_project ON funder_nudge_log (project_code) WHERE project_code IS NOT NULL;

COMMENT ON TABLE funder_nudge_log IS
  'Audit log of outreach nudges to foundation funders. Mailto/Slack/in-person/etc. Updates funder_context_snapshot.most_recent_contact_at via trigger.';

ALTER TABLE funder_nudge_log
  DROP CONSTRAINT IF EXISTS funder_nudge_log_type_check;
ALTER TABLE funder_nudge_log
  ADD CONSTRAINT funder_nudge_log_type_check
  CHECK (nudge_type IN ('email','slack','phone','in_person','linkedin','other'));

COMMIT;
