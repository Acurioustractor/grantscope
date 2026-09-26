-- Let the nightly scorers score act_private_grant_rounds the way they score grant_opportunities, so tagged
-- private SmartyGrants rounds can reach the One Desk (Ben, 2026-09-25: "do A").
--
-- Only 1 of 624 live private rounds carried a project tag: the scorers never read this table, and the
-- weekly sync rebuilt aligned_projects from Goods keywords on every run. The sync now leaves tags and
-- scores to the scorers (scripts/sync-act-private-grant-rounds.mts), and these columns hold what they write.
-- Same shapes as grant_opportunities. RLS stays on with no policies: service role only, never anon.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260926160000_private_rounds_project_scores.sql (Tier 3)

BEGIN;
ALTER TABLE public.act_private_grant_rounds
  ADD COLUMN IF NOT EXISTS project_relevance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_relevance_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS goods_relevance_scored_at timestamptz;
ALTER TABLE public.act_private_grant_rounds ALTER COLUMN aligned_projects SET DEFAULT '{}'::text[];
UPDATE public.act_private_grant_rounds SET aligned_projects = '{}'::text[] WHERE aligned_projects IS NULL;

-- Score the private rounds nightly with the same three scorers (agent-registry.mjs, --table flag).
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority)
VALUES ('score-private-rounds-goods', 24, true, 2),
       ('score-private-rounds-projects', 24, true, 2),
       ('score-private-rounds-rubric', 24, true, 2)
ON CONFLICT (agent_id) DO NOTHING;
COMMIT;
