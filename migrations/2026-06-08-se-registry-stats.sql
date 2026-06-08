-- P2-7: live registry stats for the /suppliers landing (pre-search proof).
-- Slow-moving aggregate kept live so it never rots into a stale hardcoded figure.
CREATE OR REPLACE FUNCTION se_registry_stats()
RETURNS TABLE (total bigint, with_contracts bigint, total_value numeric, total_contracts bigint)
LANGUAGE sql STABLE
AS $$
  SELECT count(*),
         count(*) FILTER (WHERE contract_count > 0),
         coalesce(sum(contract_value), 0),
         coalesce(sum(contract_count), 0)
  FROM se_search_index;
$$;
