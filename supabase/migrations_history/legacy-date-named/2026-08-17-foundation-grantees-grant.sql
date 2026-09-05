-- mv_foundation_grantees was the ONLY browse relation with no service_role grant — PostgREST
-- silently returned empty, so the drawer and profile said "0 linked" about a foundation with
-- 7,126 grantee links. Fourth occurrence of this trap class; the ACL sweep found no others.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-foundation-grantees-grant.sql
GRANT SELECT ON mv_foundation_grantees TO service_role;
