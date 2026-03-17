-- Founder Intake tables
-- AI-guided conversational intake for new founders/orgs

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. founder_intakes — main intake session
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS founder_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable until they create an account
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_profile_id UUID REFERENCES org_profiles(id) ON DELETE SET NULL,

  -- Intake data (extracted by AI)
  idea_summary TEXT,
  problem_statement TEXT,
  target_beneficiary JSONB,
  issue_areas TEXT[],
  geographic_focus JSONB,
  founder_motivation TEXT,

  -- Landscape
  existing_orgs_shown JSONB,
  differentiation TEXT,
  partnership_decision TEXT CHECK (partnership_decision IS NULL OR partnership_decision IN ('start_new', 'join_existing', 'hybrid')),

  -- Structure
  recommended_entity_type TEXT,
  entity_type_rationale TEXT,
  entity_type_scores JSONB,
  revenue_model TEXT[],

  -- Evidence
  matched_alma_interventions JSONB,
  evidence_gaps TEXT[],

  -- Funding
  matched_grants JSONB,
  matched_foundations JSONB,
  procurement_pathways JSONB,

  -- Plan
  action_plan JSONB,
  project_brief_md TEXT,
  draft_email TEXT,

  -- Meta
  phase TEXT DEFAULT 'idea' CHECK (phase IN ('idea', 'landscape', 'structure', 'evidence', 'funding', 'plan', 'complete')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'complete', 'abandoned')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_intakes_user ON founder_intakes(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_intakes_status ON founder_intakes(status);
CREATE INDEX IF NOT EXISTS idx_founder_intakes_created ON founder_intakes(created_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. founder_intake_messages — conversation history
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS founder_intake_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL REFERENCES founder_intakes(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  phase TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_messages_intake ON founder_intake_messages(intake_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. founder_intake_signals — aggregate intelligence
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS founder_intake_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_area TEXT NOT NULL,
  geographic_focus JSONB,
  entity_type_recommended TEXT,
  intake_count INT DEFAULT 1,
  month TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_signals_month ON founder_intake_signals(month);
CREATE INDEX IF NOT EXISTS idx_intake_signals_issue ON founder_intake_signals(issue_area);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS Policies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE founder_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_intake_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_intake_signals ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all" ON founder_intakes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON founder_intake_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON founder_intake_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anonymous read access to own intake (by ID — no auth required)
-- Intakes are anonymous sessions identified by UUID only
CREATE POLICY "anon_read_intakes" ON founder_intakes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_messages" ON founder_intake_messages FOR SELECT TO anon USING (true);

-- Signals are read-only aggregates
CREATE POLICY "anon_read_signals" ON founder_intake_signals FOR SELECT TO anon USING (true);

-- Authenticated users can read their own intakes
CREATE POLICY "user_read_own_intakes" ON founder_intakes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "user_read_own_messages" ON founder_intake_messages FOR SELECT TO authenticated
  USING (intake_id IN (SELECT id FROM founder_intakes WHERE user_id = auth.uid() OR user_id IS NULL));

COMMIT;
