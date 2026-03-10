-- Grant Learning System: feedback loop + answer bank
-- Phase 1 of the Grant Learning System

-- Grant feedback — thumbs up/down with context
CREATE TABLE IF NOT EXISTS grant_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_profile_id UUID REFERENCES org_profiles(id),
  grant_id UUID NOT NULL REFERENCES grant_opportunities(id),
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  reason TEXT,
  source_context TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, grant_id)
);
CREATE INDEX IF NOT EXISTS idx_grant_feedback_user ON grant_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_feedback_grant ON grant_feedback(grant_id);

-- Answer bank — reusable Q&A pairs from grant applications
CREATE TABLE IF NOT EXISTS grant_answer_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  source_grant_id UUID REFERENCES grant_opportunities(id),
  source_application TEXT,
  use_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answer_bank_org ON grant_answer_bank(org_profile_id);
CREATE INDEX IF NOT EXISTS idx_answer_bank_category ON grant_answer_bank(category);
CREATE INDEX IF NOT EXISTS idx_answer_bank_embedding ON grant_answer_bank USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- Function: adjust match scores based on feedback patterns
CREATE OR REPLACE FUNCTION get_feedback_adjusted_score(
  p_user_id UUID,
  p_grant_id UUID,
  p_base_score FLOAT
) RETURNS FLOAT AS $$
DECLARE
  v_boost FLOAT := 0;
  v_grant RECORD;
  v_up_count INT;
  v_down_count INT;
BEGIN
  SELECT provider, categories INTO v_grant
  FROM grant_opportunities WHERE id = p_grant_id;

  SELECT
    COALESCE(SUM(CASE WHEN f.vote = 1 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN f.vote = -1 THEN 1 ELSE 0 END), 0)
  INTO v_up_count, v_down_count
  FROM grant_feedback f
  JOIN grant_opportunities g ON g.id = f.grant_id
  WHERE f.user_id = p_user_id
    AND (g.provider = v_grant.provider OR g.categories && v_grant.categories);

  v_boost := LEAST(v_up_count * 1.0, 5.0) - LEAST(v_down_count * 2.0, 10.0);

  RETURN LEAST(100, GREATEST(0, p_base_score + v_boost));
END;
$$ LANGUAGE plpgsql;

-- Function: vector similarity search for answer bank
CREATE OR REPLACE FUNCTION match_answer_bank(
  p_org_profile_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.5
) RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  category TEXT,
  tags TEXT[],
  use_count INT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ab.id,
    ab.question,
    ab.answer,
    ab.category,
    ab.tags,
    ab.use_count,
    (1 - (ab.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM grant_answer_bank ab
  WHERE ab.org_profile_id = p_org_profile_id
    AND ab.embedding IS NOT NULL
    AND (1 - (ab.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY ab.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE grant_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_answer_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback"
  ON grant_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their org answer bank"
  ON grant_answer_bank FOR ALL
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );
