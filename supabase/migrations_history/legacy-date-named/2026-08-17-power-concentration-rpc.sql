-- power_concentration(): the top-1% share computed in the database, because PostgREST caps row
-- pulls at 1,000 and the first cut of the rebuilt power page unknowingly computed "top 1%" over
-- the top thousand rows only (35% of $381bn instead of the true share of the full index).
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-power-concentration-rpc.sql
BEGIN;
CREATE OR REPLACE FUNCTION power_concentration()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ranked AS (
    SELECT total_dollar_flow, ntile(100) OVER (ORDER BY total_dollar_flow DESC) AS pct
      FROM mv_entity_power_index
     WHERE total_dollar_flow > 0
  )
  SELECT jsonb_build_object(
    'entities', count(*),
    'total', sum(total_dollar_flow),
    'top1', sum(total_dollar_flow) FILTER (WHERE pct = 1)
  ) FROM ranked;
$$;
REVOKE ALL ON FUNCTION power_concentration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION power_concentration() TO service_role;
COMMIT;
