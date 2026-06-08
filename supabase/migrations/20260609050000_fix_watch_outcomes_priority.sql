-- Fix the agent_tasks_priority_check constraint violations spamming the orchestrator.
-- The CHECK is (priority BETWEEN 1 AND 10); the only offender is the schedule
-- 'watch-outcomes-changes' at priority 50, so every scheduler tick failed to create
-- its task ("violates check constraint agent_tasks_priority_check"). Clamp it to 10.
UPDATE agent_schedules SET priority = 10 WHERE agent_id = 'watch-outcomes-changes' AND priority > 10;
