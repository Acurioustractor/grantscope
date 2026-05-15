-- Goods relevance scoring on grant_opportunities
-- Adds a 0-100 score column + index so /grants?pile=goods can rank
-- ACT-GD tag in aligned_projects remains the canonical "this is a Goods grant" marker;
-- the score is what lets us order by fit when many grants share the tag.

ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS goods_relevance_score INTEGER;

ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS goods_relevance_signals JSONB;

ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS goods_relevance_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_grant_opportunities_goods_relevance
  ON grant_opportunities (goods_relevance_score DESC NULLS LAST)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_grant_opportunities_aligned_projects
  ON grant_opportunities USING GIN (aligned_projects);

COMMENT ON COLUMN grant_opportunities.goods_relevance_score IS
  'Goods/ACT-GD relevance 0-100. >=50 triggers ACT-GD tag in aligned_projects. Set by scripts/lib/goods-relevance.mjs.';
COMMENT ON COLUMN grant_opportunities.goods_relevance_signals IS
  'Which signals contributed to the score: { keyword: [...], geography, amount_band, category: [...], embedding_similarity }.';
