-- Browse RPC polish from the shell UX audit (SH-1, SH-5), 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-browse-rpc-polish.sql
--
-- SH-1: '(blank)' joins the non-recipient blocklist — source spreadsheets export empty cells
--   as that literal, and 286 rows/$265M ranked #9 on the grants browser. Kept in parity with
--   NON_RECIPIENT_NAMES in apps/web/src/lib/justice-money.ts.
-- SH-5: donor and supplier rollups collapse name-keyed rows onto ABN-keyed rows when the same
--   normalised name has an ABN elsewhere in the data — the donations top-15 showed three
--   duplicate pairs (Labor Holdings, Pratt Holdings, Cormack Foundation) split by rows with
--   and without a declared ABN.

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
        ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')
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

CREATE OR REPLACE FUNCTION grant_browse_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'kept_rows', count(*) FILTER (WHERE measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')),
    'kept_dollars', sum(amount_dollars) FILTER (WHERE measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')),
    'excluded_rows', count(*) FILTER (WHERE NOT (measure_kind = 'grant' AND is_aggregate IS NOT TRUE
      AND recipient_name IS NOT NULL AND btrim(recipient_name) <> ''
      AND lower(btrim(recipient_name)) NOT IN
          ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other','(blank)')))
  )
  FROM justice_funding
$$;

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
  WITH name_abn AS (
    SELECT lower(btrim(donor_name)) AS n, min(NULLIF(donor_abn, '')) AS abn
    FROM political_donations
    WHERE receipt_type = 'donation received' AND NULLIF(donor_abn, '') IS NOT NULL
    GROUP BY 1
  )
  SELECT
    COALESCE(NULLIF(d.donor_abn, ''), m.abn, lower(btrim(d.donor_name))) AS donor_key,
    max(d.donor_name) AS donor_name,
    max(COALESCE(NULLIF(d.donor_abn, ''), m.abn)) AS donor_abn,
    count(*) AS donation_count,
    sum(d.amount) AS total_dollars,
    count(DISTINCT d.donation_to) AS recipient_count,
    (array_agg(d.donation_to ORDER BY d.amount DESC NULLS LAST))[1] AS top_recipient
  FROM political_donations d
  LEFT JOIN name_abn m ON m.n = lower(btrim(d.donor_name))
  WHERE d.receipt_type = 'donation received'
    AND d.donor_name IS NOT NULL AND btrim(d.donor_name) <> ''
    AND d.financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')
    AND (p_q IS NULL OR d.donor_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(d.donor_abn, ''), m.abn, lower(btrim(d.donor_name)))
  ORDER BY
    CASE WHEN p_sort = 'donations' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recipients' THEN count(DISTINCT d.donation_to) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(d.donor_name) END ASC NULLS LAST,
    sum(d.amount) DESC NULLS LAST,
    max(d.donor_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION contract_supplier_browse(
  p_q text DEFAULT NULL,
  p_from_year int DEFAULT 2020,
  p_sort text DEFAULT 'total',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  supplier_key text,
  supplier_name text,
  supplier_abn text,
  contract_count bigint,
  total_value numeric,
  buyer_count bigint,
  top_buyer text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH name_abn AS (
    SELECT lower(btrim(supplier_name)) AS n, min(NULLIF(supplier_abn, '')) AS abn
    FROM austender_contracts
    WHERE NULLIF(supplier_abn, '') IS NOT NULL
      AND contract_start >= make_date(2000, 1, 1) AND contract_start < make_date(2031, 1, 1)
    GROUP BY 1
  )
  SELECT
    COALESCE(NULLIF(c.supplier_abn, ''), m.abn, lower(btrim(c.supplier_name))) AS supplier_key,
    max(c.supplier_name) AS supplier_name,
    max(COALESCE(NULLIF(c.supplier_abn, ''), m.abn)) AS supplier_abn,
    count(*) AS contract_count,
    sum(c.contract_value) AS total_value,
    count(DISTINCT c.buyer_name) AS buyer_count,
    (array_agg(c.buyer_name ORDER BY c.contract_value DESC NULLS LAST))[1] AS top_buyer
  FROM austender_contracts c
  LEFT JOIN name_abn m ON m.n = lower(btrim(c.supplier_name))
  WHERE c.supplier_name IS NOT NULL AND btrim(c.supplier_name) <> ''
    AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
    AND c.contract_start < make_date(2031, 1, 1)
    AND (p_q IS NULL OR c.supplier_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(c.supplier_abn, ''), m.abn, lower(btrim(c.supplier_name)))
  ORDER BY
    CASE WHEN p_sort = 'contracts' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'buyers' THEN count(DISTINCT c.buyer_name) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(c.supplier_name) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    max(c.supplier_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;
