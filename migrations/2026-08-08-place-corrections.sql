-- Corrections to place pages, accumulated instead of lost to a mailbox.
-- Service-role writes only: RLS is enabled with no public policies, so the
-- only way in is the API route, and the only way out is a person reading it.
-- Nothing publishes automatically.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-08-place-corrections.sql

CREATE TABLE IF NOT EXISTS place_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  page_route text NOT NULL CHECK (char_length(page_route) <= 200),
  lga_name text CHECK (char_length(lga_name) <= 120),
  message text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 4000),
  contact text CHECK (char_length(contact) <= 320),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'applied', 'rejected')),
  reviewed_at timestamptz,
  review_notes text
);

ALTER TABLE place_corrections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_place_corrections_status
  ON place_corrections (status, created_at DESC);

COMMENT ON TABLE place_corrections IS
  'Community corrections to place pages. Service-role writes only (RLS enabled, no public policies). Reviewed by a person; nothing publishes automatically.';
