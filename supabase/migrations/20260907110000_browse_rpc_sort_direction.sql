-- 20260907110000_browse_rpc_sort_direction.sql
-- Two-way sort on the nine browse RPCs (issue #440). Each function gains `p_dir text DEFAULT NULL`; NULL keeps the
-- column's natural direction (what every page did before), 'asc' or 'desc' overrides it. The default sort key of
-- six functions ('total', 'influence', 'funding') lived in the ORDER BY fallback, not the CASE ladder, so each of
-- those gets an explicit ascending branch too. NULLS LAST is now on every branch: a bare DESC put NULLs first.
--
-- Signatures change (a new trailing parameter), so the old signature is dropped first. CREATE OR REPLACE with a
-- different argument list would leave two overloads and PostgREST cannot choose between them when p_dir is
-- omitted. Bodies are pg_get_functiondef output from 2026-09-07 with only the ORDER BY lines and signature
-- touched; SECURITY DEFINER and search_path preserved; grants re-issued as they were (foundation_browse was
-- service_role only, and stays so).
BEGIN;

DROP FUNCTION IF EXISTS public.charity_browse(p_q text, p_state text, p_size text, p_sort text, p_limit integer);
DROP FUNCTION IF EXISTS public.contract_buyer_browse(p_q text, p_from_year integer, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.contract_supplier_browse(p_q text, p_from_year integer, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.donation_donor_browse(p_q text, p_from_fy text, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.foundation_browse(p_q text, p_type text, p_sort text, p_limit integer);
DROP FUNCTION IF EXISTS public.grant_recipient_browse(p_q text, p_state text, p_topic text, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.person_browse(p_q text, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.place_browse(p_q text, p_state text, p_sort text, p_limit integer, p_offset integer);
DROP FUNCTION IF EXISTS public.se_browse(p_q text, p_state text, p_sort text, p_limit integer);

CREATE OR REPLACE FUNCTION public.charity_browse(p_q text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_size text DEFAULT NULL::text, p_sort text DEFAULT 'known'::text, p_limit integer DEFAULT 200, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(abn text, name text, charity_size text, state text, is_foundation boolean, gs_id text, system_count integer, visible_dollars numeric, ais_year integer, total_assets numeric, known integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- OUT names are the app's contract: visible_dollars and known, not the MV's column names.
  SELECT m.abn, m.name, m.charity_size, m.state, m.is_foundation,
         m.gs_id, m.system_count, m.total_dollar_flow AS visible_dollars,
         m.ais_year, m.total_assets, m.known_score AS known
    FROM mv_charity_browse m
   WHERE (p_q IS NULL OR m.name ILIKE '%' || p_q || '%')
     AND (p_state IS NULL OR m.state = p_state)
     AND (p_size IS NULL OR m.charity_size = p_size)
   ORDER BY
     CASE WHEN p_sort = 'known' AND coalesce(p_dir, 'desc') = 'desc' THEN m.known_score END DESC NULLS LAST,
     CASE WHEN p_sort = 'known' AND p_dir = 'asc' THEN m.known_score END ASC NULLS LAST,
     CASE WHEN p_sort = 'least' AND coalesce(p_dir, 'asc') = 'asc' THEN m.known_score END ASC NULLS LAST,
     CASE WHEN p_sort = 'least' AND p_dir = 'desc' THEN m.known_score END DESC NULLS LAST,
     CASE WHEN p_sort = 'assets' AND coalesce(p_dir, 'desc') = 'desc' THEN m.total_assets END DESC NULLS LAST,
     CASE WHEN p_sort = 'assets' AND p_dir = 'asc' THEN m.total_assets END ASC NULLS LAST,
     CASE WHEN p_sort = 'dollars' AND coalesce(p_dir, 'desc') = 'desc' THEN m.total_dollar_flow END DESC NULLS LAST,
     CASE WHEN p_sort = 'dollars' AND p_dir = 'asc' THEN m.total_dollar_flow END ASC NULLS LAST,
     m.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
$function$
;

CREATE OR REPLACE FUNCTION public.contract_buyer_browse(p_q text DEFAULT NULL::text, p_from_year integer DEFAULT 2020, p_sort text DEFAULT 'total'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(buyer_key text, buyer_name text, contract_count bigint, total_value numeric, supplier_count bigint, top_supplier text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE WHEN p_sort = 'contracts' AND coalesce(p_dir, 'desc') = 'desc' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'contracts' AND p_dir = 'asc' THEN count(*) END ASC NULLS LAST,
    CASE WHEN p_sort = 'suppliers' AND coalesce(p_dir, 'desc') = 'desc' THEN count(DISTINCT COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name)))) END DESC NULLS LAST,
    CASE WHEN p_sort = 'suppliers' AND p_dir = 'asc' THEN count(DISTINCT COALESCE(NULLIF(c.supplier_abn, ''), lower(btrim(c.supplier_name)))) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN max(c.buyer_name) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN max(c.buyer_name) END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'total') = 'total' AND p_dir = 'asc' THEN sum(c.contract_value) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    max(c.buyer_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.contract_supplier_browse(p_q text DEFAULT NULL::text, p_from_year integer DEFAULT 2020, p_sort text DEFAULT 'total'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(supplier_key text, supplier_name text, supplier_abn text, contract_count bigint, total_value numeric, buyer_count bigint, top_buyer text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE WHEN p_sort = 'contracts' AND coalesce(p_dir, 'desc') = 'desc' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'contracts' AND p_dir = 'asc' THEN count(*) END ASC NULLS LAST,
    CASE WHEN p_sort = 'buyers' AND coalesce(p_dir, 'desc') = 'desc' THEN count(DISTINCT c.buyer_name) END DESC NULLS LAST,
    CASE WHEN p_sort = 'buyers' AND p_dir = 'asc' THEN count(DISTINCT c.buyer_name) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN mode() WITHIN GROUP (ORDER BY c.supplier_name) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN mode() WITHIN GROUP (ORDER BY c.supplier_name) END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'total') = 'total' AND p_dir = 'asc' THEN sum(c.contract_value) END ASC NULLS LAST,
    sum(c.contract_value) DESC NULLS LAST,
    mode() WITHIN GROUP (ORDER BY c.supplier_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.donation_donor_browse(p_q text DEFAULT NULL::text, p_from_fy text DEFAULT '2014-15'::text, p_sort text DEFAULT 'total'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(donor_key text, donor_name text, donor_abn text, donation_count bigint, total_dollars numeric, recipient_count bigint, top_recipient text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE WHEN p_sort = 'donations' AND coalesce(p_dir, 'desc') = 'desc' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'donations' AND p_dir = 'asc' THEN count(*) END ASC NULLS LAST,
    CASE WHEN p_sort = 'recipients' AND coalesce(p_dir, 'desc') = 'desc' THEN count(DISTINCT d.donation_to) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recipients' AND p_dir = 'asc' THEN count(DISTINCT d.donation_to) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN mode() WITHIN GROUP (ORDER BY d.donor_name) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN mode() WITHIN GROUP (ORDER BY d.donor_name) END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'total') = 'total' AND p_dir = 'asc' THEN sum(d.amount) END ASC NULLS LAST,
    sum(d.amount) DESC NULLS LAST,
    mode() WITHIN GROUP (ORDER BY d.donor_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.foundation_browse(p_q text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_sort text DEFAULT 'giving'::text, p_limit integer DEFAULT 200, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, abn text, type text, giving numeric, grantees bigint, board_links bigint, ais_year integer, granted numeric, total_assets numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH g AS (
    SELECT foundation_id, count(*) AS n FROM mv_foundation_grantees GROUP BY 1
  ), b AS (
    SELECT foundation_id, count(*) AS n FROM funder_board_paths GROUP BY 1
  )
  SELECT f.id, f.name, f.acnc_abn, f.type,
         f.total_giving_annual,
         coalesce(g.n, 0), coalesce(b.n, 0),
         ais.ais_year::int, ais.grants_donations_au, ais.total_assets
    FROM foundations f
    LEFT JOIN g ON g.foundation_id = f.id
    LEFT JOIN b ON b.foundation_id = f.id
    -- LATERAL latest-AIS probe per foundation: the DISTINCT ON version deduplicated all 361K
    -- AIS rows on every call (74s); ~11K index probes via idx_acnc_ais_lookup run in ~1s.
    LEFT JOIN LATERAL (
      SELECT a.ais_year, a.grants_donations_au, a.total_assets
        FROM acnc_ais a
       WHERE a.abn = f.acnc_abn
       ORDER BY a.ais_year DESC
       LIMIT 1
    ) ais ON true
   WHERE (p_q IS NULL OR f.name ILIKE '%' || p_q || '%')
     AND (p_type IS NULL OR f.type = p_type)
   ORDER BY
     CASE WHEN p_sort = 'giving' AND coalesce(p_dir, 'desc') = 'desc' THEN f.total_giving_annual END DESC NULLS LAST,
     CASE WHEN p_sort = 'giving' AND p_dir = 'asc' THEN f.total_giving_annual END ASC NULLS LAST,
     CASE WHEN p_sort = 'assets' AND coalesce(p_dir, 'desc') = 'desc' THEN ais.total_assets END DESC NULLS LAST,
     CASE WHEN p_sort = 'assets' AND p_dir = 'asc' THEN ais.total_assets END ASC NULLS LAST,
     CASE WHEN p_sort = 'granted' AND coalesce(p_dir, 'desc') = 'desc' THEN ais.grants_donations_au END DESC NULLS LAST,
     CASE WHEN p_sort = 'granted' AND p_dir = 'asc' THEN ais.grants_donations_au END ASC NULLS LAST,
     CASE WHEN p_sort = 'grantees' AND coalesce(p_dir, 'desc') = 'desc' THEN coalesce(g.n, 0) END DESC NULLS LAST,
     CASE WHEN p_sort = 'grantees' AND p_dir = 'asc' THEN coalesce(g.n, 0) END ASC NULLS LAST,
     CASE WHEN p_sort = 'board' AND coalesce(p_dir, 'desc') = 'desc' THEN coalesce(b.n, 0) END DESC NULLS LAST,
     CASE WHEN p_sort = 'board' AND p_dir = 'asc' THEN coalesce(b.n, 0) END ASC NULLS LAST,
     f.name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500);
$function$
;

CREATE OR REPLACE FUNCTION public.grant_recipient_browse(p_q text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_topic text DEFAULT NULL::text, p_sort text DEFAULT 'total'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(recipient_key text, recipient_name text, recipient_abn text, grant_count bigint, total_dollars numeric, states text[], first_year text, last_year text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE WHEN p_sort = 'grants' AND coalesce(p_dir, 'desc') = 'desc' THEN count(*) END DESC NULLS LAST,
    CASE WHEN p_sort = 'grants' AND p_dir = 'asc' THEN count(*) END ASC NULLS LAST,
    CASE WHEN p_sort = 'recent' AND coalesce(p_dir, 'desc') = 'desc' THEN max(j.financial_year) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recent' AND p_dir = 'asc' THEN max(j.financial_year) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN max(j.recipient_name) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN max(j.recipient_name) END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'total') = 'total' AND p_dir = 'asc' THEN sum(j.amount_dollars) END ASC NULLS LAST,
    sum(j.amount_dollars) DESC NULLS LAST,
    max(j.recipient_name) ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.person_browse(p_q text DEFAULT NULL::text, p_sort text DEFAULT 'influence'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(identity_key text, person_name text, person_name_normalised text, board_count bigint, acco_boards bigint, attributed_procurement numeric, attributed_justice numeric, attributed_donations numeric, financial_system_count integer, influence_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    v.identity_key, v.person_name, v.person_name_normalised, v.board_count, v.acco_boards,
    v.attributed_procurement, v.attributed_justice, v.attributed_donations,
    v.financial_system_count, v.influence_score_attributed
  FROM mv_person_identity_influence_v2 v
  WHERE v.is_nominee_block IS NOT TRUE
    AND v.board_count <= 10
    AND (p_q IS NULL OR v.person_name ILIKE '%' || p_q || '%')
  ORDER BY
    CASE WHEN p_sort = 'boards' AND coalesce(p_dir, 'desc') = 'desc' THEN v.board_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'boards' AND p_dir = 'asc' THEN v.board_count END ASC NULLS LAST,
    CASE WHEN p_sort = 'systems' AND coalesce(p_dir, 'desc') = 'desc' THEN v.financial_system_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'systems' AND p_dir = 'asc' THEN v.financial_system_count END ASC NULLS LAST,
    CASE WHEN p_sort = 'procurement' AND coalesce(p_dir, 'desc') = 'desc' THEN v.attributed_procurement END DESC NULLS LAST,
    CASE WHEN p_sort = 'procurement' AND p_dir = 'asc' THEN v.attributed_procurement END ASC NULLS LAST,
    CASE WHEN p_sort = 'justice' AND coalesce(p_dir, 'desc') = 'desc' THEN v.attributed_justice END DESC NULLS LAST,
    CASE WHEN p_sort = 'justice' AND p_dir = 'asc' THEN v.attributed_justice END ASC NULLS LAST,
    CASE WHEN p_sort = 'donations' AND coalesce(p_dir, 'desc') = 'desc' THEN v.attributed_donations END DESC NULLS LAST,
    CASE WHEN p_sort = 'donations' AND p_dir = 'asc' THEN v.attributed_donations END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN v.person_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN v.person_name END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'influence') = 'influence' AND p_dir = 'asc' THEN v.influence_score_attributed END ASC NULLS LAST,
    v.influence_score_attributed DESC NULLS LAST,
    v.person_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.place_browse(p_q text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_sort text DEFAULT 'funding'::text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(lga_name text, state text, entity_count bigint, community_controlled_count bigint, total_funding numeric, avg_seifa_decile numeric, remoteness text, desert_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lga AS (
    SELECT f.lga_name, f.state,
           sum(f.entity_count) AS entity_count,
           sum(f.community_controlled_count) AS community_controlled_count,
           sum(f.total_funding) AS total_funding,
           avg(f.avg_seifa_decile) AS avg_seifa_decile
    FROM mv_funding_by_lga f
    WHERE f.lga_name IS NOT NULL
    GROUP BY f.lga_name, f.state
  ),
  deserts AS (
    SELECT d.lga_name, d.state,
           max(d.desert_score) AS desert_score,
           min(d.remoteness) AS remoteness
    FROM mv_funding_deserts d
    GROUP BY d.lga_name, d.state
  )
  SELECT
    l.lga_name, l.state, l.entity_count, l.community_controlled_count,
    l.total_funding, round(l.avg_seifa_decile, 1), d.remoteness, round(d.desert_score, 1)
  FROM lga l
  LEFT JOIN deserts d ON d.lga_name = l.lga_name AND d.state = l.state
  WHERE (p_q IS NULL OR l.lga_name ILIKE '%' || p_q || '%')
    AND (p_state IS NULL OR l.state = p_state)
  ORDER BY
    CASE WHEN p_sort = 'desert' AND coalesce(p_dir, 'desc') = 'desc' THEN d.desert_score END DESC NULLS LAST,
    CASE WHEN p_sort = 'desert' AND p_dir = 'asc' THEN d.desert_score END ASC NULLS LAST,
    CASE WHEN p_sort = 'entities' AND coalesce(p_dir, 'desc') = 'desc' THEN l.entity_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'entities' AND p_dir = 'asc' THEN l.entity_count END ASC NULLS LAST,
    CASE WHEN p_sort = 'acco' AND coalesce(p_dir, 'desc') = 'desc' THEN l.community_controlled_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'acco' AND p_dir = 'asc' THEN l.community_controlled_count END ASC NULLS LAST,
    CASE WHEN p_sort = 'disadvantage' AND coalesce(p_dir, 'asc') = 'asc' THEN l.avg_seifa_decile END ASC NULLS LAST,
    CASE WHEN p_sort = 'disadvantage' AND p_dir = 'desc' THEN l.avg_seifa_decile END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' AND coalesce(p_dir, 'asc') = 'asc' THEN l.lga_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'name' AND p_dir = 'desc' THEN l.lga_name END DESC NULLS LAST,
    CASE WHEN coalesce(p_sort, 'funding') = 'funding' AND p_dir = 'asc' THEN l.total_funding END ASC NULLS LAST,
    l.total_funding DESC NULLS LAST,
    l.lga_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.se_browse(p_q text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_sort text DEFAULT 'known'::text, p_limit integer DEFAULT 200, p_dir text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, abn text, sector text, state text, gs_id text, system_count integer, visible_dollars numeric, known integer, has_abn boolean, has_sector boolean, has_place boolean, has_web boolean, on_graph boolean, entries integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      s.id, s.name, s.abn, s.sector, s.state, s.postcode, s.website, s.description,
      p.gs_id, p.system_count, p.total_dollar_flow,
      (s.abn IS NOT NULL) AS has_abn,
      (s.sector IS NOT NULL) AS has_sector,
      (s.postcode IS NOT NULL OR s.state IS NOT NULL) AS has_place,
      (s.website IS NOT NULL OR s.description IS NOT NULL) AS has_web,
      (p.gs_id IS NOT NULL) AS on_graph,
      ((s.abn IS NOT NULL)::int + (s.sector IS NOT NULL)::int
       + (s.postcode IS NOT NULL OR s.state IS NOT NULL)::int
       + (s.website IS NOT NULL OR s.description IS NOT NULL)::int
       + (p.gs_id IS NOT NULL)::int) AS known_score,
      -- One group per ABN; ABN-less rows group only with themselves.
      COALESCE(s.abn, s.id::text) AS grp
    FROM social_enterprises s
    LEFT JOIN LATERAL (
      SELECT e.gs_id, e.system_count, e.total_dollar_flow
        FROM mv_entity_power_index e
       WHERE e.abn = s.abn
       LIMIT 1
    ) p ON s.abn IS NOT NULL
  ), named AS (
    SELECT b.abn, min(g.canonical_name) AS canonical_name
      FROM base b
      JOIN gs_entities g ON g.abn = b.abn
     WHERE b.abn IS NOT NULL
     GROUP BY 1
  ), sectors AS (
    -- Flattened separately: array_agg over text[] of differing lengths is an error, and the union
    -- of a group's sectors is what a reader wants to see.
    SELECT b.grp, string_agg(DISTINCT x, ', ') AS sector
      FROM base b, LATERAL unnest(COALESCE(b.sector, ARRAY[]::text[])) AS x
     GROUP BY 1
  ), grouped AS (
    SELECT
      (array_agg(b.id ORDER BY length(b.name), b.name))[1] AS id,
      COALESCE(n.canonical_name, (array_agg(b.name ORDER BY length(b.name), b.name))[1]) AS name,
      max(b.abn) AS abn,
      sec.sector,
      CASE WHEN count(DISTINCT b.state) = 1 THEN max(b.state) ELSE NULL END AS state,
      max(b.gs_id) AS gs_id,
      max(b.system_count)::int AS system_count,
      max(b.total_dollar_flow) AS visible_dollars,
      max(b.known_score) AS known,
      bool_or(b.has_abn) AS has_abn,
      bool_or(b.has_sector) AS has_sector,
      bool_or(b.has_place) AS has_place,
      bool_or(b.has_web) AS has_web,
      bool_or(b.on_graph) AS on_graph,
      count(*)::int AS entries,
      -- Kept out of the returned row; only the filters below need them.
      bool_or(p_q IS NULL OR b.name ILIKE '%' || p_q || '%') AS name_match,
      bool_or(p_state IS NULL OR b.state = p_state) AS state_match
    FROM base b
    LEFT JOIN named n ON n.abn = b.abn
    LEFT JOIN sectors sec ON sec.grp = b.grp
    GROUP BY b.grp, n.canonical_name, sec.sector
  )
  SELECT id, name, abn, sector, state, gs_id, system_count, visible_dollars, known,
         has_abn, has_sector, has_place, has_web, on_graph, entries
    FROM grouped
   -- Matching on ANY entry in the group: searching "Ballarat Red Cross" must still find the row,
   -- even though it now displays as Australian Red Cross Society.
   WHERE name_match AND state_match
   ORDER BY
     CASE WHEN p_sort = 'known' AND coalesce(p_dir, 'desc') = 'desc' THEN known END DESC NULLS LAST,
     CASE WHEN p_sort = 'known' AND p_dir = 'asc' THEN known END ASC NULLS LAST,
     CASE WHEN p_sort = 'least' AND coalesce(p_dir, 'asc') = 'asc' THEN known END ASC NULLS LAST,
     CASE WHEN p_sort = 'least' AND p_dir = 'desc' THEN known END DESC NULLS LAST,
     CASE WHEN p_sort = 'dollars' AND coalesce(p_dir, 'desc') = 'desc' THEN visible_dollars END DESC NULLS LAST,
     CASE WHEN p_sort = 'dollars' AND p_dir = 'asc' THEN visible_dollars END ASC NULLS LAST,
     CASE WHEN p_sort = 'systems' AND coalesce(p_dir, 'desc') = 'desc' THEN system_count END DESC NULLS LAST,
     CASE WHEN p_sort = 'systems' AND p_dir = 'asc' THEN system_count END ASC NULLS LAST,
     name ASC
   LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
$function$
;

REVOKE EXECUTE ON FUNCTION public.charity_browse(p_q text, p_state text, p_size text, p_sort text, p_limit integer, p_dir text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charity_browse(p_q text, p_state text, p_size text, p_sort text, p_limit integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contract_buyer_browse(p_q text, p_from_year integer, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contract_supplier_browse(p_q text, p_from_year integer, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.donation_donor_browse(p_q text, p_from_fy text, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.foundation_browse(p_q text, p_type text, p_sort text, p_limit integer, p_dir text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.foundation_browse(p_q text, p_type text, p_sort text, p_limit integer, p_dir text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_recipient_browse(p_q text, p_state text, p_topic text, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.person_browse(p_q text, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_browse(p_q text, p_state text, p_sort text, p_limit integer, p_offset integer, p_dir text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.se_browse(p_q text, p_state text, p_sort text, p_limit integer, p_dir text) TO anon, authenticated, service_role;

COMMIT;
