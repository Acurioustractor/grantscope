-- Journey Builder tables
-- Guided persona journey mapping for org projects

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. org_journeys — top-level journey container
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id UUID NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES org_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_journeys_org ON org_journeys(org_profile_id);
CREATE INDEX IF NOT EXISTS idx_org_journeys_project ON org_journeys(project_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. org_journey_personas
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_journey_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES org_journeys(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  cohort TEXT,
  context TEXT,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_personas_journey ON org_journey_personas(journey_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. org_journey_steps
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_journey_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES org_journey_personas(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK (path IN ('current', 'alternative')),
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  system TEXT,
  emotion TEXT,
  duration TEXT,
  is_divergence_point BOOLEAN DEFAULT false,
  icon TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_steps_persona ON org_journey_steps(persona_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. org_journey_matches — data links from steps to CivicGraph data
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_journey_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES org_journey_steps(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('alma_intervention', 'alma_evidence', 'funding', 'outcome', 'entity')),
  match_id UUID,
  match_name TEXT NOT NULL,
  match_detail TEXT,
  confidence REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_matches_step ON org_journey_matches(step_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. org_journey_messages — conversation history
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS org_journey_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES org_journeys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  persona_id UUID REFERENCES org_journey_personas(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_messages_journey ON org_journey_messages(journey_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS Policies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE org_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_journey_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_journey_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_journey_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_journey_messages ENABLE ROW LEVEL SECURITY;

-- Service role bypass (all tables)
CREATE POLICY "service_role_all" ON org_journeys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON org_journey_personas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON org_journey_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON org_journey_matches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON org_journey_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User access via org_profile membership
CREATE POLICY "user_read_journeys" ON org_journeys FOR SELECT TO authenticated
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "user_write_journeys" ON org_journeys FOR ALL TO authenticated
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

-- Child tables: access through journey ownership
CREATE POLICY "user_access_personas" ON org_journey_personas FOR ALL TO authenticated
  USING (journey_id IN (SELECT id FROM org_journeys WHERE org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (journey_id IN (SELECT id FROM org_journeys WHERE org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )));

CREATE POLICY "user_access_steps" ON org_journey_steps FOR ALL TO authenticated
  USING (persona_id IN (SELECT p.id FROM org_journey_personas p JOIN org_journeys j ON j.id = p.journey_id WHERE j.org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (persona_id IN (SELECT p.id FROM org_journey_personas p JOIN org_journeys j ON j.id = p.journey_id WHERE j.org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )));

CREATE POLICY "user_access_matches" ON org_journey_matches FOR ALL TO authenticated
  USING (step_id IN (SELECT s.id FROM org_journey_steps s JOIN org_journey_personas p ON p.id = s.persona_id JOIN org_journeys j ON j.id = p.journey_id WHERE j.org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (step_id IN (SELECT s.id FROM org_journey_steps s JOIN org_journey_personas p ON p.id = s.persona_id JOIN org_journeys j ON j.id = p.journey_id WHERE j.org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )));

CREATE POLICY "user_access_messages" ON org_journey_messages FOR ALL TO authenticated
  USING (journey_id IN (SELECT id FROM org_journeys WHERE org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (journey_id IN (SELECT id FROM org_journeys WHERE org_profile_id IN (
    SELECT id FROM org_profiles WHERE user_id = auth.uid()
    UNION SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
  )));

COMMIT;
