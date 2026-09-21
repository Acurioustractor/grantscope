-- Reviewed link: buyer "QLD Queensland Health" -> Department of Health (QLD).
--
-- Until 20260922150000 this buyer linked by prefix-stripped name to a node called
-- "Queensland Health", which the ABN register says is Queensland Women's Health
-- Network Incorporated (11700374032, cancelled). Renaming that node broke the
-- wrong link. The department is ABN 66329169412, registered DEPARTMENT OF HEALTH
-- QLD and trading as QUEENSLAND HEALTH. Ben approved 2026-09-22.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922170000_link_qld_queensland_health.sql

BEGIN;

INSERT INTO buyer_entity_links (buyer_key, gs_entity_id, note)
SELECT 'qld queensland health', e.id, 'registered DEPARTMENT OF HEALTH QLD, trades as QUEENSLAND HEALTH'
FROM gs_entities e WHERE e.gs_id = 'AU-ABN-66329169412'
ON CONFLICT (buyer_key) DO NOTHING;

SELECT link_se_buyer_prospects();

COMMIT;
