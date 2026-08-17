-- Company-suffix name normalisation for the donor and supplier rollups (UX pass 2), 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-entity-name-key.sql
--
-- SH-15 (UX pass 2): the donations browser showed Pratt Holdings eight times. The SH-5 fix in
--   2026-08-18-browse-rpc-polish.sql folded name-keyed rows onto ABN-keyed rows, but did nothing
--   about the spellings of the name itself: 'Pratt Holdings Pty Ltd', 'Pty Limited', 'P/L',
--   'PROPRIETARY LIMITED' and two trailing-comma variants are one declarer under six keys.
--   entity_name_key() canonicalises case, punctuation, whitespace and the company suffix.
--
--   A suffixed name with no ABN also borrows the ABN of its own unsuffixed root ('Pratt Holdings
--   Pty Ltd' -> the ABN declared under 'Pratt Holdings'), but ONLY in that direction: the
--   borrowing key must itself carry a company suffix. A bare personal name never merges into a
--   namesake company, and the borrow is always ABN-backed, never a blind name match.
--
-- Shape note: these RPCs join the precomputed key lookups from
--   2026-08-18-entity-name-key-views.sql (donor_name_keys / donor_key_abn and the supplier pair)
--   and never call entity_name_key() at query time. Computing it inline cost three regexes per
--   row, and inside a parameterised function the planner takes a generic plan that pushed the
--   donor rollup past a minute — the identical SQL ad-hoc with literals ran in 2.8s. Apply the
--   views migration FIRST; do not inline the key back into these functions.
--
-- Also fixed here: the drawer/row mismatch SH-5 introduced. Browse keys a name-only row onto an
--   ABN borrowed from elsewhere in the data, but the detail RPCs still matched on the row's OWN
--   abn-or-name — so the drawer's totals were lower than the row the user clicked. Detail now
--   resolves membership through the same name_abn mapping the browse uses.

CREATE OR REPLACE FUNCTION entity_name_key(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(p_name)), '[.,''`]', '', 'g'),
        '\s+', ' ', 'g'),
      '\s*\m(proprietary|pty|p/l)(\s+(limited|ltd))?\s*$', ' pty ltd')
  )
$$;

COMMENT ON FUNCTION entity_name_key(text) IS
  'Canonical grouping key for org names: lowercased, punctuation and repeated whitespace stripped, trailing company suffix folded to "pty ltd". Grouping only — never display this value.';

-- ---------------------------------------------------------------- donations

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
    COALESCE(NULLIF(d.donor_abn, ''), m.abn, root.abn, n.nk) AS donor_key,
    mode() WITHIN GROUP (ORDER BY d.donor_name) AS donor_name,
    max(COALESCE(NULLIF(d.donor_abn, ''), m.abn, root.abn)) AS donor_abn,
    count(*) AS donation_count,
    sum(d.amount) AS total_dollars,
    count(DISTINCT d.donation_to) AS recipient_count,
    (array_agg(d.donation_to ORDER BY d.amount DESC NULLS LAST))[1] AS top_recipient
  FROM political_donations d
  JOIN donor_name_keys n ON n.donor_name = d.donor_name
  LEFT JOIN donor_key_abn m ON m.n = n.nk
  LEFT JOIN donor_key_abn root ON n.nk LIKE '% pty ltd'
        AND root.n = regexp_replace(n.nk, ' pty ltd$', '')
  WHERE d.receipt_type = 'donation received'
    AND d.financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')
    AND (p_q IS NULL OR d.donor_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(d.donor_abn, ''), m.abn, root.abn, n.nk)
  ORDER BY
    CASE WHEN p_sort = 'donations' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recipients' THEN count(DISTINCT d.donation_to) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN mode() WITHIN GROUP (ORDER BY d.donor_name) END ASC NULLS LAST,
    sum(d.amount) DESC NULLS LAST,
    mode() WITHIN GROUP (ORDER BY d.donor_name) ASC
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
    JOIN donor_name_keys n ON n.donor_name = d.donor_name
    LEFT JOIN donor_key_abn m ON m.n = n.nk
    LEFT JOIN donor_key_abn root ON n.nk LIKE '% pty ltd'
          AND root.n = regexp_replace(n.nk, ' pty ltd$', '')
    WHERE d.receipt_type = 'donation received'
      AND COALESCE(NULLIF(d.donor_abn, ''), m.abn, root.abn, n.nk) = p_key
      AND d.financial_year >= COALESCE(NULLIF(p_from_fy, ''), '2014-15')
  )
  SELECT jsonb_build_object(
    'donor_name', (SELECT mode() WITHIN GROUP (ORDER BY donor_name) FROM rows),
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

-- ---------------------------------------------------------------- contracts

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
  SELECT
    COALESCE(NULLIF(c.supplier_abn, ''), m.abn, root.abn, n.nk) AS supplier_key,
    mode() WITHIN GROUP (ORDER BY c.supplier_name) AS supplier_name,
    max(COALESCE(NULLIF(c.supplier_abn, ''), m.abn, root.abn)) AS supplier_abn,
    count(*) AS contract_count,
    sum(c.contract_value) AS total_value,
    count(DISTINCT c.buyer_name) AS buyer_count,
    (array_agg(c.buyer_name ORDER BY c.contract_value DESC NULLS LAST))[1] AS top_buyer
  FROM austender_contracts c
  JOIN supplier_name_keys n ON n.supplier_name = c.supplier_name
  LEFT JOIN donor_key_abn m ON m.n = n.nk
  LEFT JOIN donor_key_abn root ON n.nk LIKE '% pty ltd'
        AND root.n = regexp_replace(n.nk, ' pty ltd$', '')
  WHERE c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
    AND c.contract_start < make_date(2031, 1, 1)
    AND (p_q IS NULL OR c.supplier_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(c.supplier_abn, ''), m.abn, root.abn, n.nk)
  ORDER BY
    CASE WHEN p_sort = 'contracts' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'buyers' THEN count(DISTINCT c.buyer_name) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN mode() WITHIN GROUP (ORDER BY c.supplier_name) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    mode() WITHIN GROUP (ORDER BY c.supplier_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION contract_supplier_detail(p_key text, p_from_year int DEFAULT 2020)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH rows AS (
    SELECT c.title, c.buyer_name, c.contract_value, c.contract_start, c.contract_end, c.supplier_name, c.supplier_abn
    FROM austender_contracts c
    JOIN supplier_name_keys n ON n.supplier_name = c.supplier_name
    LEFT JOIN donor_key_abn m ON m.n = n.nk
    LEFT JOIN donor_key_abn root ON n.nk LIKE '% pty ltd'
          AND root.n = regexp_replace(n.nk, ' pty ltd$', '')
    WHERE COALESCE(NULLIF(c.supplier_abn, ''), m.abn, root.abn, n.nk) = p_key
      AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
      AND c.contract_start < make_date(2031, 1, 1)
  )
  SELECT jsonb_build_object(
    'supplier_name', (SELECT mode() WITHIN GROUP (ORDER BY supplier_name) FROM rows),
    'supplier_abn', (SELECT max(NULLIF(supplier_abn, '')) FROM rows),
    'contract_count', (SELECT count(*) FROM rows),
    'total_value', (SELECT sum(contract_value) FROM rows),
    'buyers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('buyer', b.buyer_name, 'value', b.v, 'contracts', b.n) ORDER BY b.v DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT buyer_name, sum(contract_value) AS v, count(*) AS n FROM rows GROUP BY buyer_name ORDER BY sum(contract_value) DESC NULLS LAST LIMIT 12) b
    ),
    'contracts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'title', g.title, 'buyer', g.buyer_name, 'value', g.contract_value,
        'start', g.contract_start, 'end', g.contract_end
      ) ORDER BY g.contract_value DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT * FROM rows ORDER BY contract_value DESC NULLS LAST LIMIT 50) g
    )
  )
$$;

GRANT EXECUTE ON FUNCTION entity_name_key(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION donation_donor_browse(text, text, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION donation_donor_detail(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_supplier_browse(text, int, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_supplier_detail(text, int) TO anon, authenticated, service_role;
