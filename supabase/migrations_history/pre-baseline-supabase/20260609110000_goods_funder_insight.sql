-- Goods Command Center — Funder Insight (the "what are they saying & why" layer).
--
-- GHL holds no message-thread prose for funders (every "conversation" is an
-- activity stub: opportunity-created, stage-change, no-show). What GHL DOES hold
-- is rich STRUCTURED signal on each contact: temperature tags (goods-hot /
-- goods-cooling / goods-cold / goods-warm / goods-steady / goods-inquiry),
-- engagement ring (ring:vip), campaign stage, the newsletter streams they
-- subscribe to (= what they care about), comms drips, roles and place.
--
-- This migration adds a single jsonb column to capture that signal off the live
-- GHL sync. The DECODING into temperature / interests / attention flags / next
-- move is deterministic and lives in TypeScript (goods-funder-insight-shared.ts)
-- so it can be iterated without re-syncing. No LLM, no Gmail — structured only.
--
-- Populated by scripts/sync-goods-ghl.mjs (replaces the snapshot each run).

ALTER TABLE goods_relationships
  ADD COLUMN IF NOT EXISTS ghl_signal jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN goods_relationships.ghl_signal IS
  'Structured GHL contact signal captured by sync-goods-ghl.mjs: '
  '{ tags[], opportunity_status, opportunity_stage_name, last_stage_change_at, synced_at }. '
  'Decoded into funder insight by goods-funder-insight-shared.ts.';

-- Lets us filter/aggregate by a specific tag cheaply if ever needed
-- (e.g. ghl_signal->''tags'' @> ''["goods-cooling"]'').
CREATE INDEX IF NOT EXISTS idx_goods_relationships_ghl_signal
  ON goods_relationships USING gin (ghl_signal jsonb_path_ops);
