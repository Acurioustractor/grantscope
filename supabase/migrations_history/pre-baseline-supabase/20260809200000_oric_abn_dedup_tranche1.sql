-- AU-ORIC/AU-ABN dedup, tranche 1 (Ben's verdict 2026-08-09: "Full mechanical tranche ~822")
-- Manifest: dedup_tranche1_20260809 (822 name-bridged 1:1 pairs; excludes 7 state-conflict pairs
--   + 18 fan-out rows — those stay in stg_oric_dupe_pairs as parked suspects).
-- Survivor = AU-ABN row. Twin's LGA carries onto the survivor when the twin's evidence outranks
--   (ladder: register/community/own-name > acnc town > postcode/ratio > registry_address > unplaced);
--   ties keep the survivor. 270 unplaced survivors gain an LGA + 7 conflict wins (dry-run:
--   thoughts/shared/handoffs/place-atlas/dedup-tranche1-dryrun.txt).
-- References repointed JOIN-form (per-pair mapping): all FK tables + uuid-typed soft tables
--   (entity_xref 1,453 · justice_funding 5 · justice_funding_clean 5 · goods_procurement_entities 2).
--   TEXT-typed entity_id columns (ghl_sync_log etc.) reference other ID spaces — untouched.
-- ICN preserved: entity_identifiers (oric_icn) per pair. AU-ORIC rows backed up then deleted.
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260809200000_oric_abn_dedup_tranche1.sql

BEGIN;

-- 1. Backup the doomed rows -----------------------------------------------------
DROP TABLE IF EXISTS gs_entities_dedup_backup_20260809;
CREATE TABLE gs_entities_dedup_backup_20260809 AS
SELECT g.* FROM gs_entities g JOIN dedup_tranche1_20260809 t ON g.id = t.oric_id;

-- 2. LGA ladder: twin's placement carries when it outranks the survivor's --------
--    (also carries postcode/state onto the survivor where NULL — coherent with the carried evidence)
UPDATE gs_entities a
SET lga_name = o.lga_name, lga_code = o.lga_code, lga_source = o.lga_source,
    postcode = COALESCE(a.postcode, o.postcode),
    state    = COALESCE(a.state, o.state)
FROM dedup_tranche1_20260809 t
JOIN gs_entities o ON o.id = t.oric_id
WHERE a.id = t.abn_id
  AND o.lga_code IS NOT NULL
  AND (CASE WHEN o.lga_source IN ('oric_register_address+abs_asgs','community_name+abs_asgs','own_name_town+abs_asgs','oric_register_address+gazetteer','own_name_town+gazetteer','oric_register_address+sal_ratio_dominant','own_name_town+sal_ratio_dominant') THEN 1
            WHEN o.lga_source IN ('acnc_town_city+abs_asgs','acnc_town_city+gazetteer') THEN 2
            WHEN o.lga_source IN ('single_lga_postcode','straddler_ratio_dominant','poa_ratio_dominant','poa_ratio_nolocality','council_serves_shire','inferred_from_org_name') THEN 3
            WHEN o.lga_source = 'registry_address' THEN 4 ELSE 9 END)
    < (CASE WHEN a.lga_code IS NULL THEN 9
            WHEN a.lga_source IN ('oric_register_address+abs_asgs','community_name+abs_asgs','own_name_town+abs_asgs','oric_register_address+gazetteer','own_name_town+gazetteer','oric_register_address+sal_ratio_dominant','own_name_town+sal_ratio_dominant') THEN 1
            WHEN a.lga_source IN ('acnc_town_city+abs_asgs','acnc_town_city+gazetteer') THEN 2
            WHEN a.lga_source IN ('single_lga_postcode','straddler_ratio_dominant','poa_ratio_dominant','poa_ratio_nolocality','council_serves_shire','inferred_from_org_name') THEN 3
            WHEN a.lga_source = 'registry_address' THEN 4 ELSE 9 END);

-- oric_status enrichment where survivor lacks it
UPDATE gs_entities a SET oric_status = o.oric_status
FROM dedup_tranche1_20260809 t JOIN gs_entities o ON o.id = t.oric_id
WHERE a.id = t.abn_id AND a.oric_status IS NULL AND o.oric_status IS NOT NULL;

-- 3. Repoint references (JOIN-form, per-pair) -----------------------------------
-- gs_relationships: repoint unless it would self-loop; then drop would-be self-loops
UPDATE gs_relationships r SET source_entity_id = t.abn_id FROM dedup_tranche1_20260809 t
WHERE r.source_entity_id = t.oric_id AND r.target_entity_id <> t.abn_id;
UPDATE gs_relationships r SET target_entity_id = t.abn_id FROM dedup_tranche1_20260809 t
WHERE r.target_entity_id = t.oric_id AND r.source_entity_id <> t.abn_id;
DELETE FROM gs_relationships r USING dedup_tranche1_20260809 t
WHERE r.source_entity_id = t.oric_id OR r.target_entity_id = t.oric_id;

-- soft uuid tables with hits
-- (justice_funding_clean, canonical_organizations, alma_unified_search are VIEWS — base tables covered below)
UPDATE entity_xref x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE justice_funding x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE goods_procurement_entities x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;

-- FK tables (hit + zero-hit safety no-ops)
UPDATE alma_interventions x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE foundation_grantees x SET grantee_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.grantee_entity_id = t.oric_id;
UPDATE goods_relationships x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE civicscope_act_entity_bridge x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE contact_entity_links x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE crm_contact_organization_affiliations x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE enrichment_candidates x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE entity_watches x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE foundation_people x SET person_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.person_entity_id = t.oric_id;
UPDATE foundation_relationship_signals x SET related_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.related_entity_id = t.oric_id;
UPDATE foundations x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE funder_portfolio_entities x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE goods_funding_matters x SET counterparty_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.counterparty_entity_id = t.oric_id;
UPDATE grantconnect_awards x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE gs_entity_aliases x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE justice_reinvestment_sites x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE name_aliases x SET canonical_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.canonical_entity_id = t.oric_id;
UPDATE ndis_compliance_actions x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE ndis_registered_providers x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE nz_charities x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE nz_gets_contracts x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE org_applicant_entities x SET linked_gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_gs_entity_id = t.oric_id;
UPDATE org_contacts x SET linked_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_entity_id = t.oric_id;
UPDATE org_pipeline x SET funder_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.funder_entity_id = t.oric_id;
UPDATE org_program_source_links x SET funder_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.funder_entity_id = t.oric_id;
UPDATE org_program_source_links x SET parent_funder_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.parent_funder_entity_id = t.oric_id;
UPDATE person_entity_links x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE person_roles x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE person_roles x SET person_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.person_entity_id = t.oric_id;
UPDATE research_grants x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE source_frontier x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE vic_grants_awarded x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;

-- remaining uuid-typed soft tables (zero hits at dry-run; safety no-ops)
UPDATE acnc_programs x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE alma_consent_ledger x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE alma_entity_sources x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE alma_research_findings x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE civic_consultancy_spending x SET linked_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_entity_id = t.oric_id;
UPDATE civic_ministerial_diaries x SET linked_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_entity_id = t.oric_id;
UPDATE community_directory_orgs x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE contact_project_links x SET entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.entity_id = t.oric_id;
UPDATE ghl_contacts x SET canonical_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.canonical_entity_id = t.oric_id;
UPDATE org_profiles x SET linked_gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_gs_entity_id = t.oric_id;
UPDATE org_projects x SET linked_gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.linked_gs_entity_id = t.oric_id;
UPDATE organizations x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;
UPDATE state_tenders x SET gs_entity_id = t.abn_id FROM dedup_tranche1_20260809 t WHERE x.gs_entity_id = t.oric_id;

-- 4. ICN preservation: entity_identifiers FKs to canonical_entities (NOT gs_entities),
--    so the durable ICN<->survivor mapping is the manifest table dedup_tranche1_20260809
--    itself (kept permanently; oric_gs_id encodes the ICN) plus gs_entities_dedup_backup_20260809.

-- 5. Delete the AU-ORIC twin rows ------------------------------------------------
DELETE FROM gs_entities g USING dedup_tranche1_20260809 t WHERE g.id = t.oric_id;

-- 6. Assertions (any failure rolls back everything) ------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entities_dedup_backup_20260809;
  IF n <> 822 THEN RAISE EXCEPTION 'backup: expected 822, got %', n; END IF;

  SELECT count(*) INTO n FROM gs_entities g JOIN dedup_tranche1_20260809 t ON g.id = t.oric_id;
  IF n <> 0 THEN RAISE EXCEPTION 'twins not fully deleted: % remain', n; END IF;

  -- every survivor whose twin was placed must now be placed
  SELECT count(*) INTO n FROM dedup_tranche1_20260809 t JOIN gs_entities a ON a.id = t.abn_id
  WHERE a.lga_code IS NULL AND t.o_lga IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'placement carry incomplete: % survivors still unplaced', n; END IF;

  -- zero dangling references among the tables that had hits
  SELECT (SELECT count(*) FROM gs_relationships r JOIN dedup_tranche1_20260809 t ON r.source_entity_id=t.oric_id OR r.target_entity_id=t.oric_id)
       + (SELECT count(*) FROM entity_xref x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
       + (SELECT count(*) FROM justice_funding x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
       + (SELECT count(*) FROM justice_funding_clean x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
       + (SELECT count(*) FROM goods_procurement_entities x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
       + (SELECT count(*) FROM foundation_grantees x JOIN dedup_tranche1_20260809 t ON x.grantee_entity_id=t.oric_id)
       + (SELECT count(*) FROM goods_relationships x JOIN dedup_tranche1_20260809 t ON x.entity_id=t.oric_id)
       + (SELECT count(*) FROM alma_interventions x JOIN dedup_tranche1_20260809 t ON x.gs_entity_id=t.oric_id)
  INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'dangling references remain: %', n; END IF;
END $$;

COMMIT;

-- Informational
SELECT (SELECT count(*) FROM gs_entities WHERE gs_id LIKE 'AU-ORIC-%') AS remaining_au_oric,
       (SELECT count(*) FROM gs_entities_dedup_backup_20260809) AS backup_rows,
       (SELECT count(*) FROM dedup_tranche1_20260809 t JOIN gs_entities a ON a.id=t.abn_id WHERE a.lga_code IS NOT NULL) AS survivors_placed;
