-- 20260905163000_search_index_query_rank_postcode.sql
-- Ranking only (same return type, so CREATE OR REPLACE is fine): a four-digit query puts the postcode row itself first,
-- then the organisations in it; an eleven-digit query puts the ABN owner first. Measured 2026-09-05: '0870' ranked three
-- social enterprises in 0870 above "0870 Alice Springs".
BEGIN;
CREATE OR REPLACE FUNCTION public.search_index_query(q text, kinds text[] DEFAULT NULL, p_state text DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id text, name text, abn text, state text, place text, sector text, money_in numeric, money_out numeric, tier text, meta text, href text,
               source_count integer, closes_at date, amount_min numeric, postcode text, score real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH p AS (
    SELECT trim(q) AS raw, lower(trim(q)) AS lq, regexp_replace(q, '\s', '', 'g') AS digits,
           websearch_to_tsquery('simple', q) AS tsq
  )
  SELECT s.kind, s.id, s.name, s.abn, s.state, s.place, s.sector, s.money_in, s.money_out, s.tier, s.meta, s.href,
         s.source_count, s.closes_at, s.amount_min, s.postcode,
         (CASE WHEN lower(s.name) = p.lq THEN 3.0 WHEN lower(s.name) LIKE p.lq || '%' THEN 2.0
               WHEN s.abn = p.digits THEN 3.0
               WHEN s.postcode = p.digits AND s.kind = 'postcode' THEN 3.5
               WHEN s.postcode = p.digits THEN 2.5 ELSE 0.0 END
          + similarity(s.name, p.raw) + ts_rank(s.tsv, p.tsq))::real AS score
  FROM public.mv_search_index s, p
  WHERE length(p.raw) >= 2
    AND (kinds IS NULL OR s.kind = ANY (kinds))
    AND (p_state IS NULL OR s.state = p_state OR s.state IS NULL)
    AND (s.name % p.raw OR s.tsv @@ p.tsq OR (p.digits ~ '^\d{11}$' AND s.abn = p.digits) OR (p.digits ~ '^\d{4}$' AND s.postcode = p.digits))
  ORDER BY score DESC, s.money_in DESC NULLS LAST, s.name
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;
COMMIT;
