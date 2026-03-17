-- Funder Portfolio tables
-- Allows funder-tier users to save collections of entities they monitor

CREATE TABLE IF NOT EXISTS funder_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Grantees',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funder_portfolio_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES funder_portfolios(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  gs_id TEXT NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_funder_portfolios_user ON funder_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_funder_portfolio_entities_portfolio ON funder_portfolio_entities(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_funder_portfolio_entities_entity ON funder_portfolio_entities(entity_id);

-- RLS
ALTER TABLE funder_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE funder_portfolio_entities ENABLE ROW LEVEL SECURITY;

-- Users can only see their own portfolios
CREATE POLICY funder_portfolios_user_policy ON funder_portfolios
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage entities in their own portfolios
CREATE POLICY funder_portfolio_entities_user_policy ON funder_portfolio_entities
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM funder_portfolios WHERE user_id = auth.uid())
  );

-- Service role bypass
CREATE POLICY funder_portfolios_service ON funder_portfolios
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY funder_portfolio_entities_service ON funder_portfolio_entities
  FOR ALL USING (true) WITH CHECK (true);
