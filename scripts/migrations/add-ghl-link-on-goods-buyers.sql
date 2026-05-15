-- Persist GHL contact + opportunity IDs on goods_procurement_entities so the
-- app can show current pipeline state and re-pushes update rather than create.

ALTER TABLE goods_procurement_entities
  ADD COLUMN IF NOT EXISTS ghl_contact_id      TEXT,
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id  TEXT,
  ADD COLUMN IF NOT EXISTS ghl_pipeline_id     TEXT,
  ADD COLUMN IF NOT EXISTS ghl_stage_id        TEXT,
  ADD COLUMN IF NOT EXISTS ghl_stage_name      TEXT,
  ADD COLUMN IF NOT EXISTS ghl_last_pushed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ghl_last_synced_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_goods_proc_entities_ghl_opp
  ON goods_procurement_entities (ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goods_proc_entities_ghl_contact
  ON goods_procurement_entities (ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

COMMENT ON COLUMN goods_procurement_entities.ghl_contact_id IS
  'GHL contact handle, populated by /api/goods/buyer/push-ghl. Identifier for re-pushes.';
COMMENT ON COLUMN goods_procurement_entities.ghl_opportunity_id IS
  'GHL opportunity handle in the Goods — Buyer Pipeline.';
COMMENT ON COLUMN goods_procurement_entities.ghl_stage_name IS
  'Current pipeline stage name as of last pull-back sync (e.g., Outreach Queued).';
COMMENT ON COLUMN goods_procurement_entities.ghl_last_pushed_at IS
  'When we last pushed/updated this buyer to GHL.';
COMMENT ON COLUMN goods_procurement_entities.ghl_last_synced_at IS
  'When the pull-back agent last refreshed ghl_stage_name from GHL.';
