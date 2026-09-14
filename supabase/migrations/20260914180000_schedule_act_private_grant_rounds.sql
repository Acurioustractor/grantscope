-- Apply: scripts/db-apply.sh supabase/migrations/20260914180000_schedule_act_private_grant_rounds.sql
-- Apply ONLY after 20260914170000 (the private table must exist).
-- Data-only. Weekly schedule for scripts/sync-act-private-grant-rounds.mts, which reads SmartyGrants round pages
-- into act_private_grant_rounds (service role only, never public). Ben's decision, 2026-09-14: run it for ACT's
-- own grant-seeking, not sold or shown to anyone, knowing Our Community's Terms of Use cl 2(i) says users "will
-- not use bots or web scraping tools to access, browse or extract data". A permission request to Our Community is
-- being drafted; if they refuse, set enabled = false.
BEGIN;

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, auto_create_task, priority, params)
SELECT 'sync-act-private-grant-rounds', 168, true, true, 4, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agent_schedules WHERE agent_id = 'sync-act-private-grant-rounds');

COMMIT;
