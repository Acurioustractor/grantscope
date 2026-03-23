-- Fix justice_funding self-loops in gs_relationships
-- These were created by the old bridge script which set source_entity_id = target_entity_id
-- After running this, re-run bridge-justice-to-graph.mjs to create proper program→recipient edges

BEGIN;

-- Count before
SELECT COUNT(*) as self_loop_count
FROM gs_relationships
WHERE source_entity_id = target_entity_id
  AND dataset = 'justice_funding';

-- Delete self-loops
DELETE FROM gs_relationships
WHERE source_entity_id = target_entity_id
  AND dataset = 'justice_funding';

COMMIT;
