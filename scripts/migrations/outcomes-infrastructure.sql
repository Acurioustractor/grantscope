-- Outcomes Infrastructure: outcomes_metrics, policy_events, oversight_recommendations
-- These tables make report data live, queryable, and linkable to entities.

-- 1. Outcomes Metrics — state/national level outcome data (AIHW, ROGS, court stats, CtG)
CREATE TABLE IF NOT EXISTS outcomes_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,          -- 'QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'National'
  domain TEXT NOT NULL,                -- 'youth-justice', 'child-protection', 'ndis', etc.
  metric_name TEXT NOT NULL,           -- 'detention_rate_per_10k', 'avg_daily_detention', etc.
  metric_value NUMERIC,
  metric_unit TEXT,                    -- 'per_10k', 'count', 'dollars', 'percent', 'days', 'ratio'
  period TEXT NOT NULL,                -- '2023-24', 'Q2-2024', 'Jun-2024'
  cohort TEXT,                         -- 'all', 'indigenous', 'non_indigenous', 'male', 'female'
  source TEXT NOT NULL,                -- 'aihw-yj-2024', 'rogs-2026', 'qld-childrens-court-2024', etc.
  source_url TEXT,
  source_table TEXT,                   -- 'Table 6', 'Table 17A.1', etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(jurisdiction, domain, metric_name, period, cohort, source)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_jurisdiction ON outcomes_metrics(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_outcomes_domain ON outcomes_metrics(domain);
CREATE INDEX IF NOT EXISTS idx_outcomes_metric ON outcomes_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_outcomes_period ON outcomes_metrics(period);

-- 2. Policy Events — legislative changes, announcements, funding decisions
CREATE TABLE IF NOT EXISTS policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  domain TEXT NOT NULL,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'legislation', 'amendment', 'announcement', 'budget', 'framework',
    'facility', 'inquiry', 'report', 'human_rights_override', 'election'
  )),
  severity TEXT CHECK (severity IN ('critical', 'significant', 'moderate', 'info')),
  source TEXT,
  source_url TEXT,
  impact_summary TEXT,                 -- one-line impact assessment
  entity_ids UUID[],                   -- linked gs_entities
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_jurisdiction ON policy_events(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_policy_domain ON policy_events(domain);
CREATE INDEX IF NOT EXISTS idx_policy_date ON policy_events(event_date);
CREATE INDEX IF NOT EXISTS idx_policy_type ON policy_events(event_type);

-- 3. Oversight Recommendations — what oversight bodies said + whether anyone listened
CREATE TABLE IF NOT EXISTS oversight_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  domain TEXT NOT NULL,
  oversight_body TEXT NOT NULL,        -- 'qld-ombudsman', 'qld-audit-office', 'qsac', 'qhrc', etc.
  report_title TEXT NOT NULL,
  report_date DATE,
  report_url TEXT,
  recommendation_number TEXT,          -- 'Rec 1', 'Rec 7a', etc.
  recommendation_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN (
    'pending', 'accepted', 'partially_implemented', 'implemented', 'rejected', 'superseded', 'unknown'
  )),
  status_date DATE,                    -- when status last updated
  status_notes TEXT,
  target_entity_ids UUID[],            -- which entities are responsible
  target_department TEXT,              -- 'Department of Youth Justice', etc.
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oversight_jurisdiction ON oversight_recommendations(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_oversight_body ON oversight_recommendations(oversight_body);
CREATE INDEX IF NOT EXISTS idx_oversight_status ON oversight_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_oversight_domain ON oversight_recommendations(domain);
