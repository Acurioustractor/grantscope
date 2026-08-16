-- mv_justice_proven_suppliers: close the legacy blanket grant (flagged 2026-08-16, Ben's verdict
-- 2026-08-17: revoke). anon and authenticated held ALL (write bits inert on a matview, but the
-- posture was blanket); both app consumers (supplier-search.ts, the SE profile page) read via the
-- service key. Grant-what's-used, same posture as every view touched this stream.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-proven-suppliers-grant-posture.sql
BEGIN;
REVOKE ALL ON mv_justice_proven_suppliers FROM anon, authenticated;
COMMIT;
