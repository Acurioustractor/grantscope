-- Run the two graph gates that have no schedule: check-lane-reconciliation (added in #511) and
-- check-graph-attribution. Both ran only by hand, so nothing noticed when the graph drifted.
--
-- Both exit 1 when they find something, and on 2026-09-24 both do:
--   lane reconciliation  1,165 old uuid-keyed AusTender edges ($0.69B) with no current edge, kept
--                        on purpose by 20260923213010 so no contract left the graph
--   attribution          19 entities with an invalid ABN carrying 35 edges; three are real sinks
--                        ('Notapplicable' -> ATLASSIAN 9 edges, 'N/A', '#VALUE!')
-- Until those are fixed the scheduler logs both as Failed each night and last_run_at does not
-- advance. That is intended: a gate that reads green over known defects is what these replace.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh <this file>
-- Undo: UPDATE agent_schedules SET enabled = false WHERE agent_id IN (...the two below...);

BEGIN;

INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority)
VALUES ('check-lane-reconciliation', 24, true, 4),
       ('check-graph-attribution',   24, true, 4)
ON CONFLICT (agent_id) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM agent_schedules
   WHERE agent_id IN ('check-lane-reconciliation', 'check-graph-attribution') AND enabled;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 enabled gate schedules, found %', n; END IF;
END $$;

COMMIT;
