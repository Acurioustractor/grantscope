CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS source_frontier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_kind text NOT NULL,
  source_name text,
  target_url text NOT NULL,
  domain text,
  parser_hint text,
  owning_agent_id text,
  discovery_source text,
  foundation_id uuid REFERENCES foundations(id) ON DELETE CASCADE,
  gs_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  cadence_hours integer NOT NULL DEFAULT 24 CHECK (cadence_hours > 0),
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 10),
  enabled boolean NOT NULL DEFAULT true,
  change_detection text NOT NULL DEFAULT 'html',
  confidence text NOT NULL DEFAULT 'seeded',
  last_checked_at timestamp with time zone,
  last_changed_at timestamp with time zone,
  last_success_at timestamp with time zone,
  next_check_at timestamp with time zone DEFAULT now(),
  last_http_status integer,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  etag text,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_frontier_due
  ON source_frontier (enabled, next_check_at, priority DESC);

CREATE INDEX IF NOT EXISTS idx_source_frontier_foundation
  ON source_frontier (foundation_id, enabled, next_check_at);

CREATE INDEX IF NOT EXISTS idx_source_frontier_domain
  ON source_frontier (domain);

CREATE INDEX IF NOT EXISTS idx_source_frontier_discovery_source
  ON source_frontier (discovery_source);

CREATE INDEX IF NOT EXISTS idx_source_frontier_metadata
  ON source_frontier USING gin (metadata);
