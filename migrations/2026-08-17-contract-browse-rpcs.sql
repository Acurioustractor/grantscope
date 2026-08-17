-- Contracts + Government buyers browser RPCs (issues #248 + #249, "One shell, all data" S5+S6)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-contract-browse-rpcs.sql
--
-- Both sides of austender_contracts (824K rows, so every function REQUIRES a predicate:
-- a from-year floor is always applied, defaulting to 2020). Suppliers key on ABN when present,
-- else lowercased name; buyers key on lowercased buyer_name. contract_start carries junk years
-- (0140 and 3411 both occur) — the year guard doubles as data hygiene.

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
    COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name))) AS supplier_key,
    max(c.supplier_name) AS supplier_name,
    max(NULLIF(c.supplier_abn, '')) AS supplier_abn,
    count(*) AS contract_count,
    sum(c.contract_value) AS total_value,
    count(DISTINCT c.buyer_name) AS buyer_count,
    (array_agg(c.buyer_name ORDER BY c.contract_value DESC NULLS LAST))[1] AS top_buyer
  FROM austender_contracts c
  WHERE c.supplier_name IS NOT NULL AND btrim(c.supplier_name) <> ''
    AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
    AND c.contract_start < make_date(2031, 1, 1)
    AND (p_q IS NULL OR c.supplier_name ILIKE '%' || p_q || '%')
  GROUP BY COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name)))
  ORDER BY
    CASE WHEN p_sort = 'contracts' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'buyers' THEN count(DISTINCT c.buyer_name) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(c.supplier_name) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    max(c.supplier_name) ASC
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
    WHERE COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name))) = p_key
      AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
      AND c.contract_start < make_date(2031, 1, 1)
  )
  SELECT jsonb_build_object(
    'supplier_name', (SELECT max(supplier_name) FROM rows),
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

CREATE OR REPLACE FUNCTION contract_buyer_browse(
  p_q text DEFAULT NULL,
  p_from_year int DEFAULT 2020,
  p_sort text DEFAULT 'total',
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  buyer_key text,
  buyer_name text,
  contract_count bigint,
  total_value numeric,
  supplier_count bigint,
  top_supplier text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    lower(btrim(c.buyer_name)) AS buyer_key,
    max(c.buyer_name) AS buyer_name,
    count(*) AS contract_count,
    sum(c.contract_value) AS total_value,
    count(DISTINCT COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name)))) AS supplier_count,
    (array_agg(c.supplier_name ORDER BY c.contract_value DESC NULLS LAST))[1] AS top_supplier
  FROM austender_contracts c
  WHERE c.buyer_name IS NOT NULL AND btrim(c.buyer_name) <> ''
    AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
    AND c.contract_start < make_date(2031, 1, 1)
    AND (p_q IS NULL OR c.buyer_name ILIKE '%' || p_q || '%')
  GROUP BY lower(btrim(c.buyer_name))
  ORDER BY
    CASE WHEN p_sort = 'contracts' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'suppliers' THEN count(DISTINCT COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name)))) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN max(c.buyer_name) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    max(c.buyer_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

CREATE OR REPLACE FUNCTION contract_buyer_detail(p_key text, p_from_year int DEFAULT 2020)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH rows AS (
    SELECT c.title, c.supplier_name, c.contract_value, c.contract_start, c.contract_end, c.buyer_name
    FROM austender_contracts c
    WHERE lower(btrim(c.buyer_name)) = p_key
      AND c.contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
      AND c.contract_start < make_date(2031, 1, 1)
  )
  SELECT jsonb_build_object(
    'buyer_name', (SELECT max(buyer_name) FROM rows),
    'contract_count', (SELECT count(*) FROM rows),
    'total_value', (SELECT sum(contract_value) FROM rows),
    'suppliers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('supplier', s.supplier_name, 'value', s.v, 'contracts', s.n) ORDER BY s.v DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT supplier_name, sum(contract_value) AS v, count(*) AS n FROM rows GROUP BY supplier_name ORDER BY sum(contract_value) DESC NULLS LAST LIMIT 12) s
    ),
    'contracts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'title', g.title, 'supplier', g.supplier_name, 'value', g.contract_value,
        'start', g.contract_start, 'end', g.contract_end
      ) ORDER BY g.contract_value DESC NULLS LAST), '[]'::jsonb)
      FROM (SELECT * FROM rows ORDER BY contract_value DESC NULLS LAST LIMIT 50) g
    )
  )
$$;

CREATE OR REPLACE FUNCTION contract_browse_stats(p_from_year int DEFAULT 2020)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contracts', count(*),
    'total_value', sum(contract_value),
    'suppliers', count(DISTINCT COALESCE(NULLIF(supplier_abn, ''), lower(btrim(supplier_name)))),
    'buyers', count(DISTINCT lower(btrim(buyer_name)))
  )
  FROM austender_contracts
  WHERE contract_start >= make_date(GREATEST(COALESCE(p_from_year, 2020), 2000), 1, 1)
    AND contract_start < make_date(2031, 1, 1)
$$;

GRANT EXECUTE ON FUNCTION contract_supplier_browse(text, int, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_supplier_detail(text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_buyer_browse(text, int, text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_buyer_detail(text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_browse_stats(int) TO anon, authenticated, service_role;
