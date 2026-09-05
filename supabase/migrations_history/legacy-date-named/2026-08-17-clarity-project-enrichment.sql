-- Project-code enrichment: public summary (from the studio's generated wiki content) + linked
-- repo with measured freshness. Lets the zero-evidence report distinguish "declaration gap on a
-- living project" from "genuinely dormant".
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-clarity-project-enrichment.sql
BEGIN;
ALTER TABLE clarity_project_code
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS repo text,
  ADD COLUMN IF NOT EXISTS repo_last_commit date;
COMMIT;
