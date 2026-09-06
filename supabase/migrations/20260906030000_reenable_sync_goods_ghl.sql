-- Apply: scripts/db-apply.sh supabase/migrations/20260906030000_reenable_sync_goods_ghl.sql
-- Data-only. Re-enables the Goods GHL warmth sync, disabled by 20260906020000 because the GHL private-integration
-- token in grantscope/.env returned 401. The token was replaced 2026-09-06 with the one act-global-infrastructure
-- uses; a dry run then resolved 159 rows and 104 stage names with zero errors.
UPDATE agent_schedules SET enabled = true, updated_at = now()
WHERE agent_id = 'sync-goods-ghl'
RETURNING agent_id, enabled;
