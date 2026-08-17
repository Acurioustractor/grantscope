-- Grants browser RPCs (issue #247, "One shell, all data" S4)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-grant-browse-rpcs.sql
--
-- Entity-shaped rollup of justice_funding: top recipients, transactions in the drawer.
-- The three mandatory filters live HERE, in SQL, once — the same predicate as
-- isRealRecipient()/applyGrantFilters in apps/web/src/lib/justice-money.ts:
--   measure_kind = 'grant'  ·  is_aggregate IS NOT TRUE  ·  name blocklist.
-- Recipients are grouped by lower(trim(name)): ABNs are missing on too many rows to key on.

CREATE OR REPLACE FUNCTION grant_recipient_browse(
  p_q text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_topic text DEFAULT NULL,
  p_sort text DEFAULT 'total',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  recipient_key text,
  recipient_name text,
  recipient_abn text,
  grant_count bigint,
  total_dollars numeric,
  states text[],
  first_year text,
  last_year text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    lower(btrim(j.recipient_name)) AS recipient_key,
    max(j.recipient_name) AS recipient_name,
    max(j.recipient_abn) AS recipient_abn,
    count(*) AS grant_count,
    sum(j.amount_dollars) AS total_dollars,
    array_agg(DISTINCT j.state) FILTER (WHERE j.state IS NOT NULL) AS states,
    min(j.financial_year) AS first_year,
    max(j.financial_year) AS last_year
  FROM justice_funding j
  WHERE j.measure_kind = 'grant'
    AND j.is_aggregate IS NOT TRUE
    AND j.recipient_name IS NOT NULL
    AND btrim(j.recipient_name) <> ''
    AND lower(btrim(j.recipient_name)) NOT IN
        ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')
    AND (p_q IS NULL OR j.recipient_name ILIKE '%' || p_q || '%')
    AND (p_state IS NULL OR j.state = p_state)
    AND (p_topic IS NULL OR j.topics @> ARRAY[p_topic])
  GROUP BY lower(btrim(j.recipient_name))
  ORDER BY
    CASE WHEN p_sort = 'grants' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(j.recipient_name) END ASC NULLS LAST,
    sum(j.amount_dollars) DESC NULLS LAST,
    max(j.recipient_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION grant_recipient_detail(p_key text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH rows AS (
    SELECT j.program_name, j.financial_year, j.amount_dollars, j.state, j.topics, j.recipient_abn, j.recipient_name
    FROM justice_funding j
    WHERE j.measure_kind = 'grant'
      AND j.is_aggregate IS NOT TRUE
      AND lower(btrim(j.recipient_name)) = p_key
  )
  SELECT jsonb_build_object(
    'recipient_name', (SELECT max(recipient_name) FROM rows),
    'recipient_abn', (SELECT max(recipient_abn) FROM rows),
    'grant_count', (SELECT count(*) FROM rows),
    'total_dollars', (SELECT sum(amount_dollars) FROM rows),
    'by_year', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('year', y.financial_year, 'dollars', y.dollars, 'grants', y.n) ORDER BY y.financial_year), '[]'::jsonb)
      FROM (SELECT financial_year, sum(amount_dollars) AS dollars, count(*) AS n FROM rows GROUP BY financial_year) y
    ),
    'grants', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'program', g.program_name, 'year', g.financial_year, 'amount', g.amount_dollars,
        'state', g.state, 'topics', to_jsonb(g.topics)
      ) ORDER BY g.amount_dollars DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT * FROM rows ORDER BY amount_dollars DESC NULLS LAST LIMIT 100) g
    )
  )
$$;

CREATE OR REPLACE FUNCTION grant_browse_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'kept_rows', count(*) FILTER (WHERE measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')),
    'kept_dollars', sum(amount_dollars) FILTER (WHERE measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')),
    'excluded_rows', count(*) FILTER (WHERE NOT (measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')))
  )
  FROM justice_funding
$$;

GRANT EXECUTE ON FUNCTION grant_recipient_browse(text, text, text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION grant_recipient_detail(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION grant_browse_stats() TO anon, authenticated, service_role;
