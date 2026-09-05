-- Fuzzy entity search using pg_trgm similarity
-- Used by the contact→entity linkage engine

CREATE OR REPLACE FUNCTION search_entities_fuzzy(
  search_name text,
  min_similarity float DEFAULT 0.3,
  max_results int DEFAULT 5
)
RETURNS TABLE(id uuid, canonical_name text, abn text, entity_type text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    e.id,
    e.canonical_name,
    e.abn,
    e.entity_type,
    similarity(e.canonical_name, search_name)::float AS similarity
  FROM gs_entities e
  WHERE similarity(e.canonical_name, search_name) >= min_similarity
  ORDER BY similarity(e.canonical_name, search_name) DESC
  LIMIT max_results;
$$;

-- Ensure GIN index exists for trigram lookups
CREATE INDEX IF NOT EXISTS idx_gs_entities_canonical_trgm
  ON gs_entities USING gin (canonical_name gin_trgm_ops);
