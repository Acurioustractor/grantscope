-- Need-first supplier search (buyer-wedge move 2)
--
-- se_search_index: one row per registry enterprise, denormalised for search.
-- capability_text holds the enterprise's AusTender contract titles — what
-- government ACTUALLY bought from them. "I need beds" matches a manufacturer
-- whose contracts say beds even if its name/description never does. Rebuilt
-- by scripts/build-se-search-index.mjs.
--
-- Rank weights: A = revealed capability (contract titles), B = name + sectors,
-- C = description. Tier + evidence volume added as boosts in the RPC.

CREATE TABLE IF NOT EXISTS se_search_index (
  se_id uuid PRIMARY KEY,
  name text NOT NULL,
  abn text,
  state text,
  city text,
  postcode text,
  sectors text[],
  sectors_text text,  -- pre-joined by the build script (array_to_string is not IMMUTABLE, so it can't live in the generated column)
  description text,
  source_primary text,
  verification_tier text,
  verification_basis text,
  capability_text text,
  contract_count int NOT NULL DEFAULT 0,
  contract_value numeric NOT NULL DEFAULT 0,
  last_contract_end date,
  buyer_count int NOT NULL DEFAULT 0,
  built_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(capability_text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(sectors_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_se_search_tsv ON se_search_index USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_se_search_state ON se_search_index (state);

-- Ranked need-first search. Empty query = browse by evidence.
CREATE OR REPLACE FUNCTION search_suppliers(p_q text DEFAULT '', p_state text DEFAULT '', p_limit int DEFAULT 30)
RETURNS TABLE (
  se_id uuid, name text, abn text, state text, city text,
  sectors text[], description text, source_primary text,
  verification_tier text, contract_count int, contract_value numeric,
  last_contract_end date, buyer_count int, rank real
)
LANGUAGE sql STABLE
AS $$
  WITH q AS (
    SELECT CASE WHEN trim(coalesce(p_q, '')) = '' THEN NULL
                ELSE websearch_to_tsquery('english', p_q) END AS tsq
  )
  SELECT
    s.se_id, s.name, s.abn, s.state, s.city,
    s.sectors, s.description, s.source_primary,
    s.verification_tier, s.contract_count, s.contract_value,
    s.last_contract_end, s.buyer_count,
    (
      coalesce(ts_rank_cd(s.search_tsv, q.tsq), 0)
      + CASE s.verification_tier WHEN 'certified' THEN 0.10 WHEN 'verified' THEN 0.05 ELSE 0 END
      + least(s.contract_count, 50)::real / 50.0 * 0.15
    )::real AS rank
  FROM se_search_index s, q
  WHERE (q.tsq IS NULL OR s.search_tsv @@ q.tsq)
    AND (trim(coalesce(p_state, '')) = '' OR s.state = upper(p_state))
  ORDER BY rank DESC, s.contract_value DESC, s.name
  LIMIT greatest(1, least(p_limit, 100));
$$;
