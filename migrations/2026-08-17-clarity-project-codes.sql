-- Slice 9: project codes — the wiki declares, CivicGraph mirrors, the zero-evidence report asks
-- the single most useful question in the design: of 74 project codes, how many can the data not
-- speak about at all?
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-clarity-project-codes.sql
--
-- Source of truth is act-global-infrastructure/config/project-evidence.json (declared from the
-- project side, versioned next to project-codes.json). scripts/sync-project-evidence.mjs mirrors
-- BOTH files here: the 74 codes with their metadata into clarity_project_code, and each
-- declaration onto clarity_object.project_codes. Nothing edits these tables by hand — edit the
-- wiki file and re-sync, or the two ends drift and the metric lies.

BEGIN;

ALTER TABLE clarity_object
  ADD COLUMN IF NOT EXISTS project_codes text[];

CREATE TABLE IF NOT EXISTS clarity_project_code (
  code text PRIMARY KEY,
  name text NOT NULL,
  category text,
  tier text,
  status text,
  evidence_object_keys text[] NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON clarity_project_code TO agent_readonly;
GRANT ALL ON clarity_project_code TO service_role;
GRANT UPDATE (project_codes) ON clarity_object TO service_role;

COMMIT;
