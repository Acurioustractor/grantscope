-- Add org_profile_id to knowledge tables for org-scoped access
-- Enables each organisation to have their own knowledge base

-- 1. Add org_profile_id columns
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS org_profile_id UUID REFERENCES org_profiles(id);
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS org_profile_id UUID REFERENCES org_profiles(id);
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS org_profile_id UUID REFERENCES org_profiles(id);

-- Also add storage_path to knowledge_sources for file references
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON knowledge_sources(org_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks(org_profile_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_org ON wiki_pages(org_profile_id);

-- 3. RLS policies — org sees only their own
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

-- knowledge_sources: org members can read/write their org's sources
DROP POLICY IF EXISTS "org_sources_select" ON knowledge_sources;
CREATE POLICY "org_sources_select" ON knowledge_sources FOR SELECT
  USING (
    org_profile_id IS NULL
    OR org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_sources_insert" ON knowledge_sources;
CREATE POLICY "org_sources_insert" ON knowledge_sources FOR INSERT
  WITH CHECK (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_sources_delete" ON knowledge_sources;
CREATE POLICY "org_sources_delete" ON knowledge_sources FOR DELETE
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- knowledge_chunks: org members can read their org's chunks
DROP POLICY IF EXISTS "org_chunks_select" ON knowledge_chunks;
CREATE POLICY "org_chunks_select" ON knowledge_chunks FOR SELECT
  USING (
    org_profile_id IS NULL
    OR org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- wiki_pages: org members can read their org's pages
DROP POLICY IF EXISTS "org_wiki_select" ON wiki_pages;
CREATE POLICY "org_wiki_select" ON wiki_pages FOR SELECT
  USING (
    org_profile_id IS NULL
    OR org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- 4. search_org_knowledge() RPC — vector search scoped by org_profile_id
CREATE OR REPLACE FUNCTION search_org_knowledge(
  query_embedding vector(1536),
  p_org_profile_id UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  summary TEXT,
  topics TEXT[],
  source_type TEXT,
  source_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.summary,
    kc.topics,
    kc.source_type,
    kc.source_id,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.org_profile_id = p_org_profile_id
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Create storage bucket for org knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-knowledge', 'org-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload to their org folder
DROP POLICY IF EXISTS "org_knowledge_upload" ON storage.objects;
CREATE POLICY "org_knowledge_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-knowledge'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "org_knowledge_read" ON storage.objects;
CREATE POLICY "org_knowledge_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'org-knowledge'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "org_knowledge_delete" ON storage.objects;
CREATE POLICY "org_knowledge_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-knowledge'
    AND auth.role() = 'authenticated'
  );
