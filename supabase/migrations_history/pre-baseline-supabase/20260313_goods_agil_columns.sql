-- Add AGIL-specific columns to goods_communities
ALTER TABLE goods_communities ADD COLUMN IF NOT EXISTS agil_code text;
ALTER TABLE goods_communities ADD COLUMN IF NOT EXISTS community_type text DEFAULT 'community';
ALTER TABLE goods_communities ADD COLUMN IF NOT EXISTS main_language text;
ALTER TABLE goods_communities ADD COLUMN IF NOT EXISTS local_government text;
ALTER TABLE goods_communities ADD COLUMN IF NOT EXISTS data_sources text[] DEFAULT '{}';

-- Index on agil_code for cross-referencing
CREATE INDEX IF NOT EXISTS idx_goods_communities_agil ON goods_communities(agil_code);
