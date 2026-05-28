-- Audit events table — local fallback for cross-product accountability logging.
-- Per FY27 Launch Operations Plan §7.3 task #4: every atlas view/download call
-- attempts to POST to empathy-ledger-v2 /api/v1/accountability/events. If that
-- endpoint is not live yet, we queue events here for later replay.

CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface       text NOT NULL,        -- e.g. 'atlas/funding-deserts', 'api/funding-deserts'
  event_type    text NOT NULL,        -- 'view', 'download', 'api_call'
  resource_id   text,                 -- LGA name, gs_id, ABN, etc.
  query         jsonb,                -- query params used
  actor_ip      text,                 -- hashed or raw IP (we store raw for now; rotate later)
  user_agent    text,
  forwarded     boolean DEFAULT false, -- has this been pushed to EL yet?
  forwarded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_unforwarded ON audit_events(created_at) WHERE forwarded = false;
CREATE INDEX IF NOT EXISTS idx_audit_events_surface ON audit_events(surface, created_at DESC);
