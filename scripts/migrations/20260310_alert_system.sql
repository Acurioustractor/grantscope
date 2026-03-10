-- Alert preferences and notification queue

-- 1. User alert preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Alert',
  enabled BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  -- Filter criteria (any combination)
  categories TEXT[] DEFAULT '{}',
  focus_areas TEXT[] DEFAULT '{}',
  states TEXT[] DEFAULT '{}',
  min_amount INT,
  max_amount INT,
  keywords TEXT[] DEFAULT '{}',
  entity_types TEXT[] DEFAULT '{}',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  UNIQUE(user_id, name)
);

CREATE INDEX idx_alert_prefs_user ON alert_preferences(user_id);
CREATE INDEX idx_alert_prefs_enabled ON alert_preferences(enabled, frequency);

-- 2. Notification log (sent alerts)
CREATE TABLE IF NOT EXISTS alert_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_id BIGINT REFERENCES alert_preferences(id) ON DELETE SET NULL,
  grant_ids UUID[] DEFAULT '{}',
  match_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX idx_alert_notif_user ON alert_notifications(user_id, sent_at);

-- 3. Foundation relationship notes (CRM)
CREATE TABLE IF NOT EXISTS foundation_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  foundation_id UUID,  -- references foundations.id
  foundation_abn TEXT,
  note_type TEXT DEFAULT 'note' CHECK (note_type IN ('note', 'meeting', 'call', 'email', 'application', 'outcome')),
  title TEXT,
  content TEXT NOT NULL,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  next_action TEXT,
  next_action_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_foundation_notes_user ON foundation_notes(user_id);
CREATE INDEX idx_foundation_notes_foundation ON foundation_notes(foundation_abn);

-- 4. Grant pipeline stages (upgrade tracker)
ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'discovered'
    CHECK (pipeline_stage IN ('discovered', 'researching', 'drafting', 'submitted', 'awarded', 'declined', 'archived'));

-- Per-user grant tracking with pipeline
CREATE TABLE IF NOT EXISTS user_grant_tracking (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  grant_id UUID NOT NULL,
  stage TEXT DEFAULT 'discovered' CHECK (stage IN ('discovered', 'researching', 'drafting', 'submitted', 'awarded', 'declined', 'archived')),
  notes TEXT,
  amount_requested NUMERIC,
  amount_awarded NUMERIC,
  submitted_at DATE,
  outcome_at DATE,
  assignee TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, grant_id)
);

CREATE INDEX idx_user_grant_tracking_user ON user_grant_tracking(user_id, stage);

-- 5. API keys for data access
CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of the key
  key_prefix TEXT NOT NULL,       -- first 8 chars for identification
  name TEXT DEFAULT 'Default',
  permissions TEXT[] DEFAULT '{read}',
  rate_limit_per_hour INT DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- RLS policies
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE foundation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_grant_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alerts" ON alert_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own notifications" ON alert_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications" ON alert_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users manage own notes" ON foundation_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own tracking" ON user_grant_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
