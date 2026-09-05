-- =============================================================================
-- ACT Grant Intelligence System — Tables + Seed Data
-- Creates: alert_preferences, user_grant_tracking, api_keys, saved_foundations
-- Seeds: ACT org profile upgrade, ACT entities, initial alerts
-- =============================================================================

-- 1. Alert Preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Alert',
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  categories text[] DEFAULT '{}',
  focus_areas text[] DEFAULT '{}',
  states text[] DEFAULT '{}',
  min_amount integer,
  max_amount integer,
  keywords text[] DEFAULT '{}',
  entity_types text[] DEFAULT '{}',
  enabled boolean DEFAULT true,
  last_matched_at timestamptz,
  match_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON alert_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alert_prefs_user ON alert_preferences(user_id);

-- 2. User Grant Tracking (Pipeline)
CREATE TABLE IF NOT EXISTS user_grant_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES grant_opportunities(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'discovered' CHECK (stage IN ('discovered', 'researching', 'drafting', 'submitted', 'awarded', 'declined')),
  notes text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  match_score integer,
  match_signals text[],
  added_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, grant_id)
);

ALTER TABLE user_grant_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pipeline" ON user_grant_tracking
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_user ON user_grant_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON user_grant_tracking(user_id, stage);

-- 3. API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  name text DEFAULT 'Default',
  permissions text[] DEFAULT '{read}',
  rate_limit_per_hour integer DEFAULT 100,
  enabled boolean DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);

-- 4. Saved Foundations (user bookmarks/tracks foundations)
CREATE TABLE IF NOT EXISTS saved_foundations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  relationship_stage text DEFAULT 'identified' CHECK (relationship_stage IN ('identified', 'researching', 'contacted', 'in_conversation', 'applied', 'funded', 'declined')),
  star_rating integer DEFAULT 0 CHECK (star_rating >= 0 AND star_rating <= 5),
  notes text,
  alignment_score integer,
  alignment_reasons text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, foundation_id)
);

ALTER TABLE saved_foundations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved foundations" ON saved_foundations
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_foundations_user ON saved_foundations(user_id);

-- =============================================================================
-- 5. Upgrade ACT org_profile
-- =============================================================================

UPDATE org_profiles SET
  mission = 'A Curious Tractor builds decision infrastructure for Australian civic and social sectors. Products include CivicGraph (procurement & allocation intelligence), JusticeHub (justice funding transparency), and Empathy Ledger (community-governed proof of outcomes). We design for First Nations data sovereignty, community ownership, and systemic transparency. Our thesis: communities should own their narratives, land, and economic futures.',
  website = 'https://act.place',
  domains = ARRAY['indigenous', 'justice', 'technology', 'data', 'procurement', 'community', 'youth', 'social_enterprise', 'transparency', 'first_nations'],
  geographic_focus = ARRAY['QLD', 'National', 'rural', 'remote', 'first_nations_communities'],
  org_type = 'social_enterprise',
  annual_revenue = 250000,
  team_size = 3,
  projects = '[
    {"name": "CivicGraph", "description": "Procurement & allocation intelligence platform. 99K entities, 672K contracts, 17K grants.", "status": "live", "url": "https://civicgraph.au"},
    {"name": "JusticeHub", "description": "Justice funding transparency. 53K justice funding records across all states.", "status": "live"},
    {"name": "Empathy Ledger", "description": "Community-governed proof of outcomes. Rights-governed evidence for renewal defence.", "status": "building"},
    {"name": "NAJP Procurement", "description": "National Agreement on Justice Policy — $3.9B procurement opportunity for Indigenous-led orgs.", "status": "targeting"}
  ]'::jsonb,
  subscription_plan = 'enterprise',
  subscription_status = 'active',
  notify_email = true,
  notify_threshold = 60,
  updated_at = now()
WHERE user_id = '079d5f62-4502-4129-bcda-0e61a914b26d';

-- =============================================================================
-- 6. Add ACT entities to gs_entities
-- =============================================================================

INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, sector, postcode, state, remoteness, lga_name, is_community_controlled)
VALUES
  ('AU-ABN-88671625498', 'A Curious Tractor Foundation CLG', '88671625498', 'charity', 'Technology & Innovation', '4552', 'QLD', 'Inner Regional Australia', 'Sunshine Coast', false),
  ('AU-ACT-VENTURES', 'A Curious Tractor Ventures Pty Ltd', NULL, 'social_enterprise', 'Technology & Innovation', '4552', 'QLD', 'Inner Regional Australia', 'Sunshine Coast', false)
ON CONFLICT (gs_id) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  sector = EXCLUDED.sector,
  postcode = EXCLUDED.postcode,
  state = EXCLUDED.state,
  remoteness = EXCLUDED.remoteness,
  lga_name = EXCLUDED.lga_name;

-- Link the two entities
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, dataset)
SELECT s.id, t.id, 'related_entity', 'manual'
FROM gs_entities s, gs_entities t
WHERE s.gs_id = 'AU-ABN-88671625498' AND t.gs_id = 'AU-ACT-VENTURES'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. Create initial alerts for ACT
-- =============================================================================

INSERT INTO alert_preferences (user_id, name, frequency, categories, focus_areas, states, keywords, enabled)
VALUES
  ('079d5f62-4502-4129-bcda-0e61a914b26d', 'Indigenous Procurement & Justice', 'daily',
   ARRAY['indigenous', 'justice', 'community'], ARRAY['first_nations', 'closing_the_gap', 'justice_reinvestment'],
   ARRAY['QLD', 'National'], ARRAY['indigenous', 'first nations', 'aboriginal', 'torres strait', 'justice', 'NAJP', 'closing the gap'], true),
  ('079d5f62-4502-4129-bcda-0e61a914b26d', 'Technology & Data Grants', 'weekly',
   ARRAY['technology', 'data', 'innovation'], ARRAY['digital', 'platform', 'open_data'],
   ARRAY['QLD', 'National'], ARRAY['technology', 'data', 'platform', 'digital', 'innovation', 'AI', 'analytics'], true),
  ('079d5f62-4502-4129-bcda-0e61a914b26d', 'Youth & Community', 'weekly',
   ARRAY['youth', 'community', 'education'], ARRAY['youth_justice', 'community_development'],
   ARRAY['QLD', 'National'], ARRAY['youth', 'community', 'education', 'social enterprise', 'empowerment'], true);
