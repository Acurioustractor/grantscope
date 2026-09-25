-- Drop 35 one-off backup tables from August and early September clean-ups (214 MB).
--
-- Evidence (scripts/supabase-liveness.mjs, thoughts/shared/data-map/liveness-2026-09-25.json): every table
-- is dated 2026-09-11 or earlier; no index scan since 2026-08-12 (only backup/census full scans); no view,
-- function, cron job, refresh registry entry or code in grantscope, JusticeHub, empathy-ledger-v2,
-- act-global-infrastructure or the Goods app names it. Recent backups (2026-09-20 onwards) are kept as the
-- undo copies for recent clean-ups.
--
-- Undo: all 35 exported 2026-09-26 as CSV with column definitions to
-- ~/grantscope-backups/drop-group1-2026-09-26/ on Ben's Mac (243 MB).
-- No CASCADE: a table something still depends on makes the whole file roll back.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260926090000_drop_old_backup_tables.sql (Tier 3, Ben's verb)

BEGIN;
DROP TABLE public."gs_entities_lga_backup_20260808";
DROP TABLE public."gs_entities_lga_backup_20260809b";
DROP TABLE public."gs_entities_lga_backup_20260809c";
DROP TABLE public."gs_entities_lga_backup_20260809";
DROP TABLE public."gs_entities_dedup_backup_20260809";
DROP TABLE public."gs_entities_reason_backup_20260809b";
DROP TABLE public."_backup_entity_contacts_20260606";
DROP TABLE public."postcode_geo_lga_backup_20260808";
DROP TABLE public."postcode_geo_lga_backup_20260809b";
DROP TABLE public."postcode_geo_lga_backup_20260809c";
DROP TABLE public."postcode_geo_lga_backup_20260809d";
DROP TABLE public."postcode_geo_state_backup_20260809e";
DROP TABLE public."dedup_tranche1_20260809";
DROP TABLE public."postcode_geo_lga_backup_20260809e";
DROP TABLE public."gs_entities_state_backup_20260809";
DROP TABLE public."_backup_gs_rel_dupes_20260819";
DROP TABLE public."_backup_gs_rel_merge_20260821";
DROP TABLE public."_backup_gs_entities_sa3_20260819";
DROP TABLE public."_backup_foundation_grantees_dupes_20260818";
DROP TABLE public."gs_relationships_selfloop_backup_20260820";
DROP TABLE public."_backup_gs_entities_merge_20260821";
DROP TABLE public."_backup_foundation_selfloops_20260819";
DROP TABLE public."_backup_gs_rel_merge_20260906";
DROP TABLE public."gs_rel_austender_selfloop_backup_20260821";
DROP TABLE public."_backup_gs_rel_foundation_selfloops_20260819";
DROP TABLE public."_backup_postcode_geo_sa3_20260819";
DROP TABLE public."_backup_curated_amount_unknown_20260821";
DROP TABLE public."_backup_gs_entities_merge_20260906";
DROP TABLE public."_backup_articles_310_20260820";
DROP TABLE public."_backup_gs_entities_4816_20260819";
DROP TABLE public."_backup_gov_winner_type_20260821";
DROP TABLE public."_backup_goods_palm_island_20260911";
DROP TABLE public."_backup_pc2052_20260825";
DROP TABLE public."_backup_pc4072_20260820";
DROP TABLE public."_backup_soft_reference_repoint_20260821";
DELETE FROM schema_ownership WHERE object IN ('gs_entities_lga_backup_20260808','gs_entities_lga_backup_20260809b','gs_entities_lga_backup_20260809c','gs_entities_lga_backup_20260809','gs_entities_dedup_backup_20260809','gs_entities_reason_backup_20260809b','_backup_entity_contacts_20260606','postcode_geo_lga_backup_20260808','postcode_geo_lga_backup_20260809b','postcode_geo_lga_backup_20260809c','postcode_geo_lga_backup_20260809d','postcode_geo_state_backup_20260809e','dedup_tranche1_20260809','postcode_geo_lga_backup_20260809e','gs_entities_state_backup_20260809','_backup_gs_rel_dupes_20260819','_backup_gs_rel_merge_20260821','_backup_gs_entities_sa3_20260819','_backup_foundation_grantees_dupes_20260818','gs_relationships_selfloop_backup_20260820','_backup_gs_entities_merge_20260821','_backup_foundation_selfloops_20260819','_backup_gs_rel_merge_20260906','gs_rel_austender_selfloop_backup_20260821','_backup_gs_rel_foundation_selfloops_20260819','_backup_postcode_geo_sa3_20260819','_backup_curated_amount_unknown_20260821','_backup_gs_entities_merge_20260906','_backup_articles_310_20260820','_backup_gs_entities_4816_20260819','_backup_gov_winner_type_20260821','_backup_goods_palm_island_20260911','_backup_pc2052_20260825','_backup_pc4072_20260820','_backup_soft_reference_repoint_20260821');
COMMIT;
