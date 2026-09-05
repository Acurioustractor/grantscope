-- Grant the API's service role access to the place_corrections review queue.
--
-- APPLY (Ben's verb, from repo root):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260810100000_grant_place_corrections_api.sql
--
-- Found 2026-08-10 when Ben's first in-room advice tap 503'd (code 42501):
-- the table was created as postgres via psql and only postgres +
-- agent_readonly ever got grants, so /api/place/corrections' service-role
-- insert has failed since the correction form shipped — this tap was the
-- first real submission the queue ever received. Same missing-GRANT class as
-- the v_goods_relationship_* views (2026-08 memory).
--
-- service_role only: the route inserts with the service client after its own
-- validation + honeypot + rate limit; anon/authenticated get no direct path.

GRANT SELECT, INSERT ON TABLE public.place_corrections TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name = 'place_corrections'
      AND grantee = 'service_role'
      AND privilege_type = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'service_role INSERT grant did not take';
  END IF;
END $$;
