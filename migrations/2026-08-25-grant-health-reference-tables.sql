-- API-role grants for the psql-created health reference tables. Same missing-
-- GRANT class as v_goods_relationship_* (2026-08): anything created via psql
-- has no grants to the Supabase API roles, so the app client reads silently
-- return nothing. All three are open reference data (ABS Census, PHIDU CC
-- BY-NC-SA) — read-only for every API role.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-25-grant-health-reference-tables.sql

GRANT SELECT ON abs_iloc_overcrowding, abs_iloc_health, phidu_lga_health
  TO anon, authenticated, service_role;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM information_schema.table_privileges
  WHERE table_name IN ('abs_iloc_health', 'abs_iloc_overcrowding', 'phidu_lga_health')
    AND grantee IN ('service_role', 'anon', 'authenticated')
    AND privilege_type = 'SELECT';
  IF n <> 9 THEN
    RAISE EXCEPTION 'expected 9 SELECT grants (3 tables x 3 roles), got %', n;
  END IF;
END $$;
