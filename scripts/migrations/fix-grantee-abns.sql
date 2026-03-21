-- fix-grantee-abns.sql
-- Backfill ABNs on foundation grantee relationships where exact entity matches exist

BEGIN;

-- Fix target_abn where we have an exact canonical_name match with ABN
UPDATE gs_relationships r
SET target_abn = e.abn
FROM gs_entities e
WHERE r.dataset = 'foundation_grantees'
  AND r.target_abn IS NULL
  AND r.target_name IS NOT NULL
  AND e.canonical_name = r.target_name
  AND e.abn IS NOT NULL;

-- Also try case-insensitive exact match
UPDATE gs_relationships r
SET target_abn = e.abn
FROM gs_entities e
WHERE r.dataset = 'foundation_grantees'
  AND r.target_abn IS NULL
  AND r.target_name IS NOT NULL
  AND LOWER(e.canonical_name) = LOWER(r.target_name)
  AND e.abn IS NOT NULL;

-- Fix specific known matches
-- University of Queensland
UPDATE gs_relationships SET target_abn = '63942912684'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'The University of Queensland';

-- University of Southern Queensland
UPDATE gs_relationships SET target_abn = '40234732081'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'University of Southern Queensland';

-- Batyr Australia
UPDATE gs_relationships SET target_abn = '51152952737'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Batyr Australia Limited';

-- Ovarian Cancer Research Foundation
UPDATE gs_relationships SET target_abn = '37130949834'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'OVARIAN CANCER RESEARCH FOUNDATION';

-- Sydney Children's Hospitals Foundation
UPDATE gs_relationships SET target_abn = '72003073185'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name ILIKE '%sydney children%hospital%foundation%';

-- Canberra Institute of Technology
UPDATE gs_relationships SET target_abn = '43273796990'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Canberra Institute of Technology';

-- Australian Museum (the actual museum, ABN 85407224698)
UPDATE gs_relationships SET target_abn = '85407224698'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Australian Museum';

-- Aboriginal corps with ABNs
UPDATE gs_relationships SET target_abn = '24241924820'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Friends of Bibbawarra Bore Aboriginal Corporation';

UPDATE gs_relationships SET target_abn = '53942973012'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Jeithi Jerilderie Aboriginal Corporation';

UPDATE gs_relationships SET target_abn = '20733551348'
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL
  AND target_name = 'Juunjuwarra Aboriginal Corporation';

-- Clean up junk grantee names (truncated/concatenated data)
DELETE FROM gs_relationships
WHERE dataset = 'foundation_grantees'
  AND (target_name = 'LIMITED'
    OR target_name = 'Melbourne'
    OR target_name = 'Victoria Crawford'
    OR target_name = 'Brenton Clarke'
    OR target_name LIKE 'ee for %'
    OR target_name LIKE 'SARAH COWARD%KYOWA KIRIN%'
    OR target_name LIKE 'PLAYGROUP NSW%GANDHI%');

-- Report
SELECT COUNT(*) as still_missing FROM gs_relationships
WHERE dataset = 'foundation_grantees' AND target_abn IS NULL;

COMMIT;
