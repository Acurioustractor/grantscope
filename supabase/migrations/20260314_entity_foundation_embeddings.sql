-- Entity & Foundation Embeddings
-- Adds vector(1536) embedding columns, ivfflat indexes, and semantic search RPCs

-- Ensure pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Entity Embeddings ──────────────────────────────────────────────────────

ALTER TABLE gs_entities
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gs_entities_embedding
  ON gs_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 300);

CREATE OR REPLACE FUNCTION search_entities_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  gs_id text,
  canonical_name text,
  entity_type text,
  abn text,
  state text,
  sector text,
  remoteness text,
  lga_name text,
  source_count int,
  latest_revenue numeric,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.gs_id,
    e.canonical_name,
    e.entity_type,
    e.abn,
    e.state,
    e.sector,
    e.remoteness,
    e.lga_name,
    e.source_count,
    e.latest_revenue,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM gs_entities e
  WHERE e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Foundation Embeddings ──────────────────────────────────────────────────

ALTER TABLE foundations
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_foundations_embedding
  ON foundations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION search_foundations_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  acnc_abn text,
  type text,
  total_giving_annual numeric,
  thematic_focus text[],
  geographic_focus text[],
  description text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f.id,
    f.name,
    f.acnc_abn,
    f.type,
    f.total_giving_annual,
    f.thematic_focus,
    f.geographic_focus,
    f.description,
    1 - (f.embedding <=> query_embedding) AS similarity
  FROM foundations f
  WHERE f.embedding IS NOT NULL
    AND 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
$$;
