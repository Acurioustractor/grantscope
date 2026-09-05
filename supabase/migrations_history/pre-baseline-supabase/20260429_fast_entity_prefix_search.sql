-- Fast homepage/global entity typeahead.
-- The older fuzzy search is useful for batch matching, but too slow for public
-- typeahead because it scores broad queries across the full entity table.

SET statement_timeout = 0;

CREATE INDEX IF NOT EXISTS idx_gs_entities_lower_canonical_prefix
  ON public.gs_entities (lower(canonical_name) text_pattern_ops);

CREATE OR REPLACE FUNCTION public.search_entities_prefix_fast(
  search_term text,
  max_results int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  gs_id text,
  canonical_name text,
  entity_type text,
  abn text,
  state text,
  source_count integer,
  latest_revenue numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  q text;
  capped int;
BEGIN
  q := lower(
    replace(
      replace(
        btrim(regexp_replace(coalesce(search_term, ''), '\s+', ' ', 'g')),
        '%',
        ''
      ),
      '_',
      ''
    )
  );
  capped := least(greatest(coalesce(max_results, 10), 1), 50);

  IF length(q) < 2 THEN
    RETURN;
  END IF;

  -- Dynamic SQL lets Postgres plan the LIKE prefix as a constant and use the
  -- lower(canonical_name) text_pattern_ops index.
  RETURN QUERY EXECUTE format(
    'SELECT e.id, e.gs_id, e.canonical_name, e.entity_type, e.abn, e.state, e.source_count, e.latest_revenue
     FROM public.gs_entities e
     WHERE lower(e.canonical_name) LIKE %L
     ORDER BY e.source_count DESC NULLS LAST, e.latest_revenue DESC NULLS LAST, e.canonical_name ASC
     LIMIT %s',
    q || '%',
    capped
  );
END;
$$;
