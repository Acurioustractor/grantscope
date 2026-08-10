-- Goods Communities hub: SEIFA / serve-next column renders "—" for every row and
-- the "most disadvantaged (≤D3)" tile reads 0, despite v_goods_community_priority
-- holding deciles for 1,508 of 1,542 communities.
--
-- Cause: the view has SELECT granted only to agent_readonly and postgres. The app
-- reads as service_role, so the fetch errors; goods-communities-hub.ts calls it
-- with `optional = true`, which swallows the error and returns [] — an empty
-- column instead of a failure. Same class as the v_goods_relationship_power /
-- v_goods_relationship_funding grant trap.
--
-- Tier 3 (DDL) — Ben applies:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f scripts/sql/2026-08-10-grant-goods-community-priority-view.sql

GRANT SELECT ON v_goods_community_priority TO service_role, authenticated, anon;

-- Verify: expect service_role / authenticated / anon to appear alongside postgres.
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_name = 'v_goods_community_priority' ORDER BY grantee;
