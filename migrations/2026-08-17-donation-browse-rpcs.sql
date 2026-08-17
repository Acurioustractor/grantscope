-- Donations browser RPCs (issue #250, "One shell, all data" S7)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-donation-browse-rpcs.sql
--
-- Top donors rollup of political_donations. The mandatory filter is HERE, in SQL:
-- receipt_type = 'donation received' — 'other receipt' is 72% of rows / 85% of dollars and
-- is NOT donations. Donors key on ABN when present, else lowercased name. 2.55M-row base
-- table, so a from-financial-year floor is always applied (default 2014-15).

CREATE OR REPLACE FUNCTION donation_donor_browse(
  p_q text DEFAULT NULL,
  p_from_fy text DEFAULT '2014-15',
  p_sort text DEFAULT 'total',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  donor_key text,
  donor_name text,
  donor_abn text,
  donation_count bigint,
  total_dollars numeric,
  recipient_count bigint,
  top_recipient text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(d.donor_abn, ''), lower(btrim(d.donor_name))) AS donor_key,
    max(d.donor_name) AS donor_name,
    max(NULLIF(d.donor_abn, '')) AS donor_abn,
    count(*) AS donation_count,
    sum(d.amount) AS total_dollars,
    count(DISTINCT d.donation_to) AS recipient_count,
    (array_agg(d.donation_to ORDER BY d.amount DESC NULLS LAST))[1] AS top_recipient
  FROM political_donations d
  WHERE d.receipt_type = 'donation received'
    AND d.donor_name IS NOT NULL AND btrim(d.donor_name) <> ''
    AND d.financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')
    AND (p_q IS NULL OR d.donor_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(d.donor_abn, ''), lower(btrim(d.donor_name)))
  ORDER BY
    CASE WHEN p_sort = 'donations' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recipients' THEN count(DISTINCT d.donation_to) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(d.donor_name) END ASC NULLS LAST,
    sum(d.amount) DESC NULLS LAST,
    max(d.donor_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION donation_donor_detail(p_key text, p_from_fy text DEFAULT '2014-15')
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH rows AS (
    SELECT d.donor_name, d.donor_abn, d.donation_to, d.amount, d.financial_year
    FROM political_donations d
    WHERE d.receipt_type = 'donation received'
      AND COALESCE(NULLIF(d.donor_abn, ''), lower(btrim(d.donor_name))) = p_key
      AND d.financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')
  )
  SELECT jsonb_build_object(
    'donor_name', (SELECT max(donor_name) FROM rows),
    'donor_abn', (SELECT max(NULLIF(donor_abn, '')) FROM rows),
    'donation_count', (SELECT count(*) FROM rows),
    'total_dollars', (SELECT sum(amount) FROM rows),
    'recipients', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('recipient', r.donation_to, 'dollars', r.v, 'donations', r.n) ORDER BY r.v DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT donation_to, sum(amount) AS v, count(*) AS n FROM rows GROUP BY donation_to ORDER BY sum(amount) DESC NULLS LAST LIMIT 15) r
    ),
    'by_year', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('year', y.financial_year, 'dollars', y.v, 'donations', y.n) ORDER BY y.financial_year), '[]'::jsonb)
      FROM (SELECT financial_year, sum(amount) AS v, count(*) AS n FROM rows GROUP BY financial_year) y
    ),
    'donations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'recipient', g.donation_to, 'amount', g.amount, 'year', g.financial_year
      ) ORDER BY g.amount DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT * FROM rows ORDER BY amount DESC NULLS LAST LIMIT 50) g
    )
  )
$$;

CREATE OR REPLACE FUNCTION donation_browse_stats(p_from_fy text DEFAULT '2014-15')
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'donations', count(*) FILTER (WHERE receipt_type = 'donation received' AND financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')),
    'total_dollars', sum(amount) FILTER (WHERE receipt_type = 'donation received' AND financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')),
    'other_receipt_dollars', sum(amount) FILTER (WHERE receipt_type <> 'donation received' AND financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15'))
  )
  FROM political_donations
$$;

GRANT EXECUTE ON FUNCTION donation_donor_browse(text, text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION donation_donor_detail(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION donation_browse_stats(text) TO anon, authenticated, service_role;
