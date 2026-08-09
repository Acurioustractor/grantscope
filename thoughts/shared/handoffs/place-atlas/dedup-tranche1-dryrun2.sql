-- Dedup tranche 1 dry-run 2: persist the manifest + uuid-typed soft-reference hit counts.
DROP TABLE IF EXISTS dedup_tranche1_20260809;
CREATE TABLE dedup_tranche1_20260809 AS
SELECT p.* FROM stg_oric_dupe_pairs p
WHERE NOT (p.o_state IS NOT NULL AND p.a_state IS NOT NULL AND p.o_state <> p.a_state)
  AND p.oric_gs_id NOT IN (SELECT oric_gs_id FROM stg_oric_dupe_pairs GROUP BY 1 HAVING count(*)>1)
  AND p.abn_gs_id  NOT IN (SELECT abn_gs_id  FROM stg_oric_dupe_pairs GROUP BY 1 HAVING count(*)>1);
CREATE INDEX ON dedup_tranche1_20260809 (oric_id);
CREATE INDEX ON dedup_tranche1_20260809 (abn_id);
ANALYZE dedup_tranche1_20260809;

SELECT count(*) AS manifest_rows FROM dedup_tranche1_20260809;

SELECT s.tbl, s.n FROM (
  SELECT 'acnc_programs' AS tbl,(SELECT count(*) FROM acnc_programs x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id) AS n
  UNION ALL SELECT 'alma_consent_ledger',(SELECT count(*) FROM alma_consent_ledger x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'alma_entity_sources',(SELECT count(*) FROM alma_entity_sources x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'alma_research_findings',(SELECT count(*) FROM alma_research_findings x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'alma_unified_search',(SELECT count(*) FROM alma_unified_search x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'canonical_organizations',(SELECT count(*) FROM canonical_organizations x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'civic_consultancy_spending',(SELECT count(*) FROM civic_consultancy_spending x JOIN dedup_tranche1_20260809 t ON x.linked_entity_id=t.oric_id)
  UNION ALL SELECT 'civic_ministerial_diaries',(SELECT count(*) FROM civic_ministerial_diaries x JOIN dedup_tranche1_20260809 t ON x.linked_entity_id=t.oric_id)
  UNION ALL SELECT 'community_directory_orgs',(SELECT count(*) FROM community_directory_orgs x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'contact_project_links',(SELECT count(*) FROM contact_project_links x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'entity_identifiers',(SELECT count(*) FROM entity_identifiers x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'entity_xref',(SELECT count(*) FROM entity_xref x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'ghl_contacts',(SELECT count(*) FROM ghl_contacts x JOIN dedup_tranche1_20260809 t ON x.canonical_entity_id=t.oric_id)
  UNION ALL SELECT 'goods_procurement_entities',(SELECT count(*) FROM goods_procurement_entities x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'justice_funding',(SELECT count(*) FROM justice_funding x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'justice_funding_clean',(SELECT count(*) FROM justice_funding_clean x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'org_profiles',(SELECT count(*) FROM org_profiles x JOIN dedup_tranche1_20260809 t ON x.linked_gs_entity_id=t.oric_id)
  UNION ALL SELECT 'org_projects',(SELECT count(*) FROM org_projects x JOIN dedup_tranche1_20260809 t ON x.linked_gs_entity_id=t.oric_id)
  UNION ALL SELECT 'organizations',(SELECT count(*) FROM organizations x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'state_tenders',(SELECT count(*) FROM state_tenders x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
) s WHERE s.n > 0 ORDER BY s.n DESC;
