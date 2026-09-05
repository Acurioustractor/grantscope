-- Grant browser coverage disclosure (UX audit pass 2, F1 + F2), 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-grant-coverage-stats.sql
--
-- F1: the browser reads as national and is 92% Queensland by rows, 81% by dollars. Victoria — 6.8m
--   people — shows $0.18bn. That is a fact about which registers we hold, not about Victoria, and a
--   reader comparing states on that screen would conclude the exact opposite of the truth.
-- F2: 55% of the $34.0bn ($18.68bn over 100,391 rows) carries no topic tag at all. The top
--   recipient is Queensland Rail at $4.1bn of 'Transport Service Contracts' — a real grant to a real
--   organisation that is simply not justice funding.
--
-- Neither is fixed by hiding rows. Both are fixed by the page saying what it is showing, so the
-- numbers are computed here rather than written into copy where they would rot.

CREATE OR REPLACE FUNCTION grant_browse_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH kept AS (
    SELECT state, topics, amount_dollars
    FROM justice_funding
    WHERE measure_kind = 'grant'
      AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')
  ), excluded AS (
    SELECT count(*) AS n FROM justice_funding
    WHERE NOT (measure_kind = 'grant'
      AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)'))
  ), by_state AS (
    SELECT COALESCE(NULLIF(btrim(state), ''), '(unstated)') AS state,
           count(*) AS rows, sum(amount_dollars) AS dollars
    FROM kept GROUP BY 1
  )
  SELECT jsonb_build_object(
    'kept_rows', (SELECT count(*) FROM kept),
    'kept_dollars', (SELECT sum(amount_dollars) FROM kept),
    'excluded_rows', (SELECT n FROM excluded),
    -- F2: how much of the kept money is not tagged with any topic.
    'untagged_rows', (SELECT count(*) FROM kept WHERE topics IS NULL OR cardinality(topics) = 0),
    'untagged_dollars', (SELECT COALESCE(sum(amount_dollars), 0) FROM kept WHERE topics IS NULL OR cardinality(topics) = 0),
    -- F1: the coverage skew, top states by dollars.
    'states', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('state', s.state, 'rows', s.rows, 'dollars', s.dollars)
                                ORDER BY s.dollars DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT * FROM by_state ORDER BY dollars DESC NULLS LAST LIMIT 6) s
    )
  )
$$;

GRANT EXECUTE ON FUNCTION grant_browse_stats() TO anon, authenticated, service_role;
