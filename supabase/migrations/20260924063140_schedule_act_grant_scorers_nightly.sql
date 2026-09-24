-- Run the ACT grant scorers every night. Neither had a schedule, so the grant desk went stale:
-- measured 2026-09-24, of 333 open grants, 45 had never been scored for Goods and 17 had never been
-- read by JEV against the five other ACT projects. The keyword scorers last ran 2026-09-14 and the
-- JEV rubric scorer once, by hand, on 2026-09-21.
--
--   score-goods-relevance  keyword scorer for Goods (ACT-GD). Incremental: unscored or stale rows.
--                          Dry run 2026-09-24: 132 rows, 4 tags added, 0 removed.
--   score-project-rubric   JEV reads each open grant not yet read against JusticeHub, Empathy
--                          Ledger, The Harvest, The Farm and Contained, re-runs the keyword scorer on
--                          the same row and tags aligned_projects (tagged_by keyword | rubric | both).
--                          Dry run 2026-09-24: 17 grants, 0 failures, $0.0010, 1 tag added.
--
-- Both write grant_opportunities.aligned_projects, which is what the One Desk pool reads
-- (apps/web/src/lib/services/act-project-grants-triage.ts). Nothing is sent anywhere.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh <this file>
-- Undo: UPDATE agent_schedules SET enabled = false WHERE agent_id IN ('score-goods-relevance', 'score-project-rubric');

BEGIN;

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority)
VALUES ('score-goods-relevance', 24, true, 2),
       ('score-project-rubric',  24, true, 2)
ON CONFLICT (agent_id) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM agent_schedules
   WHERE agent_id IN ('score-goods-relevance', 'score-project-rubric') AND enabled;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 enabled scorer schedules, found %', n; END IF;
END $$;

COMMIT;
