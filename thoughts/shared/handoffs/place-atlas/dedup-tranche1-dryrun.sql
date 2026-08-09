-- Dedup tranche 1 DRY RUN (SELECT only): exact tranche, ladder outcomes, soft-reference hits.
DROP TABLE IF EXISTS stg_dedup_t1;
CREATE TEMP TABLE stg_dedup_t1 AS
SELECT p.* FROM stg_oric_dupe_pairs p
WHERE NOT (p.o_state IS NOT NULL AND p.a_state IS NOT NULL AND p.o_state <> p.a_state)
  AND p.oric_gs_id NOT IN (SELECT oric_gs_id FROM stg_oric_dupe_pairs GROUP BY 1 HAVING count(*)>1)
  AND p.abn_gs_id  NOT IN (SELECT abn_gs_id  FROM stg_oric_dupe_pairs GROUP BY 1 HAVING count(*)>1);

\echo '=== tranche size + ladder outcomes ==='
SELECT count(*) AS tranche,
  count(*) FILTER (WHERE a_lga IS NULL AND o_lga IS NOT NULL) AS survivor_gains_lga,
  count(*) FILTER (WHERE a_lga IS NOT NULL AND o_lga IS NOT NULL AND a_lga<>o_lga) AS ladder_conflicts
FROM stg_dedup_t1;

\echo '=== ladder: who wins the 46-ish conflicts (twin rank < survivor rank => twin wins) ==='
WITH ranked AS (
  SELECT t.*, o.lga_source AS o_src, a.lga_source AS a_src,
    CASE WHEN o.lga_source IN ('oric_register_address+abs_asgs','community_name+abs_asgs','own_name_town+abs_asgs','oric_register_address+gazetteer','own_name_town+gazetteer','oric_register_address+sal_ratio_dominant','own_name_town+sal_ratio_dominant') THEN 1
         WHEN o.lga_source IN ('acnc_town_city+abs_asgs','acnc_town_city+gazetteer') THEN 2
         WHEN o.lga_source IN ('single_lga_postcode','straddler_ratio_dominant','poa_ratio_dominant','poa_ratio_nolocality','council_serves_shire','inferred_from_org_name') THEN 3
         WHEN o.lga_source = 'registry_address' THEN 4 ELSE 9 END AS o_rank,
    CASE WHEN a.lga_source IN ('oric_register_address+abs_asgs','community_name+abs_asgs','own_name_town+abs_asgs','oric_register_address+gazetteer','own_name_town+gazetteer','oric_register_address+sal_ratio_dominant','own_name_town+sal_ratio_dominant') THEN 1
         WHEN a.lga_source IN ('acnc_town_city+abs_asgs','acnc_town_city+gazetteer') THEN 2
         WHEN a.lga_source IN ('single_lga_postcode','straddler_ratio_dominant','poa_ratio_dominant','poa_ratio_nolocality','council_serves_shire','inferred_from_org_name') THEN 3
         WHEN a.lga_source = 'registry_address' THEN 4 ELSE 9 END AS a_rank
  FROM stg_dedup_t1 t JOIN gs_entities o ON o.id=t.oric_id JOIN gs_entities a ON a.id=t.abn_id
  WHERE t.a_lga IS NOT NULL AND t.o_lga IS NOT NULL AND t.a_lga<>t.o_lga
)
SELECT CASE WHEN o_rank < a_rank THEN 'twin wins ('||o_src||' > '||a_src||')'
            WHEN o_rank > a_rank THEN 'survivor keeps ('||a_src||' > '||o_src||')'
            ELSE 'TIE same rank ('||coalesce(o_src,'null')||' vs '||coalesce(a_src,'null')||')' END AS outcome, count(*)
FROM ranked GROUP BY 1 ORDER BY 2 DESC;

\echo '=== soft-reference hit counts (only >0 get repoint statements) ==='
SELECT s.tbl, s.n FROM (
  SELECT 'acnc_programs' AS tbl,(SELECT count(*) FROM acnc_programs x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id) AS n
  UNION ALL SELECT 'alma_entity_sources',(SELECT count(*) FROM alma_entity_sources x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'alma_research_findings',(SELECT count(*) FROM alma_research_findings x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'alma_unified_search',(SELECT count(*) FROM alma_unified_search x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'canonical_organizations',(SELECT count(*) FROM canonical_organizations x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'civic_consultancy_spending',(SELECT count(*) FROM civic_consultancy_spending x JOIN stg_dedup_t1 t ON x.linked_entity_id=t.oric_id)
  UNION ALL SELECT 'civic_ministerial_diaries',(SELECT count(*) FROM civic_ministerial_diaries x JOIN stg_dedup_t1 t ON x.linked_entity_id=t.oric_id)
  UNION ALL SELECT 'community_directory_orgs',(SELECT count(*) FROM community_directory_orgs x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'contact_project_links',(SELECT count(*) FROM contact_project_links x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'entity_identifiers',(SELECT count(*) FROM entity_identifiers x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'entity_xref',(SELECT count(*) FROM entity_xref x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'ghl_contacts',(SELECT count(*) FROM ghl_contacts x JOIN stg_dedup_t1 t ON x.canonical_entity_id=t.oric_id)
  UNION ALL SELECT 'ghl_sync_log',(SELECT count(*) FROM ghl_sync_log x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'goods_procurement_entities',(SELECT count(*) FROM goods_procurement_entities x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'integration_events',(SELECT count(*) FROM integration_events x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'jm_watches',(SELECT count(*) FROM jm_watches x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'justice_funding',(SELECT count(*) FROM justice_funding x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'justice_funding_clean',(SELECT count(*) FROM justice_funding_clean x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'org_profiles',(SELECT count(*) FROM org_profiles x JOIN stg_dedup_t1 t ON x.linked_gs_entity_id=t.oric_id)
  UNION ALL SELECT 'org_projects',(SELECT count(*) FROM org_projects x JOIN stg_dedup_t1 t ON x.linked_gs_entity_id=t.oric_id)
  UNION ALL SELECT 'organizations',(SELECT count(*) FROM organizations x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'outcome_submissions',(SELECT count(*) FROM outcome_submissions x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'pulse_report_links',(SELECT count(*) FROM pulse_report_links x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'recommendation_outcomes',(SELECT count(*) FROM recommendation_outcomes x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'relationship_pipeline',(SELECT count(*) FROM relationship_pipeline x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'state_tenders',(SELECT count(*) FROM state_tenders x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'alma_consent_ledger',(SELECT count(*) FROM alma_consent_ledger x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
) s WHERE s.n > 0 ORDER BY s.n DESC;

\echo '=== FK-table hit counts (all get repoint statements regardless; informational) ==='
SELECT s.tbl, s.n FROM (
  SELECT 'gs_relationships_src' AS tbl,(SELECT count(*) FROM gs_relationships x JOIN stg_dedup_t1 t ON x.source_entity_id=t.oric_id) AS n
  UNION ALL SELECT 'gs_relationships_tgt',(SELECT count(*) FROM gs_relationships x JOIN stg_dedup_t1 t ON x.target_entity_id=t.oric_id)
  UNION ALL SELECT 'alma_interventions',(SELECT count(*) FROM alma_interventions x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'foundations',(SELECT count(*) FROM foundations x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'foundation_grantees',(SELECT count(*) FROM foundation_grantees x JOIN stg_dedup_t1 t ON x.grantee_entity_id=t.oric_id)
  UNION ALL SELECT 'grantconnect_awards',(SELECT count(*) FROM grantconnect_awards x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'name_aliases',(SELECT count(*) FROM name_aliases x JOIN stg_dedup_t1 t ON x.canonical_entity_id=t.oric_id)
  UNION ALL SELECT 'gs_entity_aliases',(SELECT count(*) FROM gs_entity_aliases x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'person_entity_links',(SELECT count(*) FROM person_entity_links x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'person_roles_entity',(SELECT count(*) FROM person_roles x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'person_roles_person',(SELECT count(*) FROM person_roles x JOIN stg_dedup_t1 t ON x.person_entity_id=t.oric_id)
  UNION ALL SELECT 'contact_entity_links',(SELECT count(*) FROM contact_entity_links x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'source_frontier',(SELECT count(*) FROM source_frontier x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'vic_grants_awarded',(SELECT count(*) FROM vic_grants_awarded x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'enrichment_candidates',(SELECT count(*) FROM enrichment_candidates x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'research_grants',(SELECT count(*) FROM research_grants x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'nz_charities',(SELECT count(*) FROM nz_charities x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'nz_gets_contracts',(SELECT count(*) FROM nz_gets_contracts x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'ndis_registered_providers',(SELECT count(*) FROM ndis_registered_providers x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'ndis_compliance_actions',(SELECT count(*) FROM ndis_compliance_actions x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'justice_reinvestment_sites',(SELECT count(*) FROM justice_reinvestment_sites x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'civicscope_act_entity_bridge',(SELECT count(*) FROM civicscope_act_entity_bridge x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'crm_contact_organization_affiliations',(SELECT count(*) FROM crm_contact_organization_affiliations x JOIN stg_dedup_t1 t ON x.gs_entity_id=t.oric_id)
  UNION ALL SELECT 'entity_watches',(SELECT count(*) FROM entity_watches x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'foundation_people',(SELECT count(*) FROM foundation_people x JOIN stg_dedup_t1 t ON x.person_entity_id=t.oric_id)
  UNION ALL SELECT 'foundation_relationship_signals',(SELECT count(*) FROM foundation_relationship_signals x JOIN stg_dedup_t1 t ON x.related_entity_id=t.oric_id)
  UNION ALL SELECT 'funder_portfolio_entities',(SELECT count(*) FROM funder_portfolio_entities x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'goods_funding_matters',(SELECT count(*) FROM goods_funding_matters x JOIN stg_dedup_t1 t ON x.counterparty_entity_id=t.oric_id)
  UNION ALL SELECT 'goods_relationships',(SELECT count(*) FROM goods_relationships x JOIN stg_dedup_t1 t ON x.entity_id=t.oric_id)
  UNION ALL SELECT 'org_applicant_entities',(SELECT count(*) FROM org_applicant_entities x JOIN stg_dedup_t1 t ON x.linked_gs_entity_id=t.oric_id)
  UNION ALL SELECT 'org_contacts',(SELECT count(*) FROM org_contacts x JOIN stg_dedup_t1 t ON x.linked_entity_id=t.oric_id)
  UNION ALL SELECT 'org_pipeline',(SELECT count(*) FROM org_pipeline x JOIN stg_dedup_t1 t ON x.funder_entity_id=t.oric_id)
  UNION ALL SELECT 'org_program_source_links_f',(SELECT count(*) FROM org_program_source_links x JOIN stg_dedup_t1 t ON x.funder_entity_id=t.oric_id)
  UNION ALL SELECT 'org_program_source_links_p',(SELECT count(*) FROM org_program_source_links x JOIN stg_dedup_t1 t ON x.parent_funder_entity_id=t.oric_id)
) s WHERE s.n > 0 ORDER BY s.n DESC;
