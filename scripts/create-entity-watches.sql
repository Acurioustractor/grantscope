-- Entity watches: track specific entities for new contracts/grants/relationships
CREATE TABLE IF NOT EXISTS entity_watches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  gs_id text NOT NULL,
  canonical_name text,
  watch_types text[] DEFAULT '{contracts,grants,relationships}',
  notes text,
  last_checked_at timestamptz,
  last_change_at timestamptz,
  change_summary jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

-- RLS
ALTER TABLE entity_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watches"
  ON entity_watches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for lookups
CREATE INDEX idx_entity_watches_user ON entity_watches(user_id);
CREATE INDEX idx_entity_watches_entity ON entity_watches(entity_id);
