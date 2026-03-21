-- Discoveries table — autoresearch findings from watcher agents
-- Stores board changes, funding anomalies, new interlocks, gazette alerts

CREATE TABLE IF NOT EXISTS discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  discovery_type TEXT NOT NULL CHECK (discovery_type IN (
    'board_appointment', 'board_departure', 'new_interlock',
    'funding_anomaly', 'new_contract', 'entity_change',
    'gazette_alert', 'data_quality', 'pattern'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
    'info', 'notable', 'significant', 'critical'
  )),
  title TEXT NOT NULL,
  description TEXT,
  entity_ids UUID[],
  person_names TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_discoveries_agent ON discoveries (agent_id);
CREATE INDEX idx_discoveries_type ON discoveries (discovery_type);
CREATE INDEX idx_discoveries_severity ON discoveries (severity);
CREATE INDEX idx_discoveries_created ON discoveries (created_at DESC);
CREATE INDEX idx_discoveries_unreviewed ON discoveries (created_at DESC)
  WHERE reviewed_at IS NULL AND dismissed = FALSE;

-- RLS
ALTER TABLE discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY discoveries_read ON discoveries FOR SELECT USING (true);

-- Summary after creation
SELECT 'discoveries table created' AS status;
