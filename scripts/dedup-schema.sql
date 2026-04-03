-- dedup-schema.sql
-- Run this once to create the dedup_recommendations table
-- Usage: node --env-file=.env scripts/gsql.mjs < scripts/dedup-schema.sql
-- Or via psql: source .env && psql "$DATABASE_URL" -f scripts/dedup-schema.sql

CREATE TABLE IF NOT EXISTS dedup_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_id uuid REFERENCES discoveries(id) ON DELETE SET NULL,
  cluster_name text NOT NULL,
  entity_count int,
  recommendation text NOT NULL CHECK (recommendation IN ('merge', 'relate', 'ignore')),
  confidence float NOT NULL,
  reasoning text,
  suggested_relationship text,
  reviewed_by text,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dedup_rec_discovery_id ON dedup_recommendations(discovery_id);
CREATE INDEX IF NOT EXISTS dedup_rec_recommendation ON dedup_recommendations(recommendation);
CREATE INDEX IF NOT EXISTS dedup_rec_reviewed ON dedup_recommendations(reviewed_at) WHERE reviewed_at IS NULL;

COMMENT ON TABLE dedup_recommendations IS 'LLM-generated recommendations for resolving entity duplicate clusters';
COMMENT ON COLUMN dedup_recommendations.recommendation IS 'merge=true duplicates, relate=distinct related entities, ignore=unrelated coincidence';
COMMENT ON COLUMN dedup_recommendations.suggested_relationship IS 'For relate: which relationship type to create (subsidiary_of, member_of, affiliated_with)';
