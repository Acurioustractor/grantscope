-- clarity_graph_row_total(): the rail chip's number, summed from the catalogue instead of
-- hardcoded (no chrome without a data source). Tables and matviews only; snapshot counts.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-graph-row-total-rpc.sql
BEGIN;
CREATE OR REPLACE FUNCTION clarity_graph_row_total()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(sum(row_count), 0)::bigint FROM clarity_object WHERE object_kind IN ('table','matview');
$$;
REVOKE ALL ON FUNCTION clarity_graph_row_total() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION clarity_graph_row_total() TO service_role;
COMMIT;
