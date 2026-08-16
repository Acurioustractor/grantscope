-- mv_foundation_regranting lacked a service_role grant, so the rebuilt power-dynamics report's
-- regranting lane got permission denied (the Goods-chip lesson, again). Read-only grant.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-regranting-grant.sql
GRANT SELECT ON mv_foundation_regranting TO service_role;
