-- Reviewed link: buyer "NSW Department of Primary Industries" -> NSW Department of Industry.
--
-- The old DPI ABN (51734124190) was cancelled on 2012-02-29; DPI then ran as part of
-- the Department of Industry (72189919072, cancelled 2021-10-01). 60 of the buyer's
-- 62 contracts (2007-2024) postdate 2012, so the department that held the function
-- for most of them is the honest link. After 20260922150000 renamed 72189919072 the
-- buyer matched the old DPI node by name; this reviewed link overrides that.
-- Contracts after October 2021 belong to a later department whose ABN is not yet
-- established; the renamed_to edge DPI -> Industry keeps the lineage. Ben approved 2026-09-22.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922180000_link_nsw_dpi_to_industry.sql

BEGIN;

INSERT INTO buyer_entity_links (buyer_key, gs_entity_id, note)
SELECT 'nsw department of primary industries', e.id,
       'DPI ABN cancelled 2012; 60 of 62 contracts fall in the Department of Industry period'
FROM gs_entities e WHERE e.gs_id = 'AU-ABN-72189919072'
ON CONFLICT (buyer_key) DO NOTHING;

SELECT link_se_buyer_prospects();

COMMIT;
