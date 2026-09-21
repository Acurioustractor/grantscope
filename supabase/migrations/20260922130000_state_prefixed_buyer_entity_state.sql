-- Correct the state on 79 government sub-unit entities so their buyers link.
--
-- After 20260922100000, 90 se_buyer_prospects stayed unlinked. For 81 of them the
-- name minus its state prefix matches exactly one entity, but that entity's
-- state is blank (57) or different (24), and the prefix rung requires the SAME
-- state. Read row by row on 2026-09-22:
--   * 78 are Northern Territory sub-units ("Department of Housing - Service
--     Delivery North", "Department of the Chief Minister - Regional Network").
--     AU-GOV-<hash> nodes minted from NT disclosure buyer keys; the only
--     source for them is the NT-prefixed buyer. 22 had NSW/QLD/SA recorded and
--     56 had nothing.
--   * 1 is "QLD Department of Employment, Small Business and Training", blank
--     state. That department name existed only in Queensland.
--   * 2 are deliberately NOT touched: "DEPARTMENT OF EDUCATION" (AU-ABN-52705101522)
--     and "Department of Primary Industries" (AU-ABN-42579412233) are
--     ABN-keyed and recorded as VIC. The QLD and NSW buyers must not link to
--     them; that was the Queensland-to-Victoria error from 20260922100000's dry run.
--
-- Each UPDATE only fires if the row still holds the state measured here, so
-- a later correction is never overwritten. build-entity-graph upserts
-- government nodes with ignoreDuplicates, so a rebuild keeps these values.
-- Then re-runs link_se_buyer_prospects() so the buyers pick up the links.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922130000_state_prefixed_buyer_entity_state.sql

BEGIN;

UPDATE gs_entities e SET state = v.new_state
FROM (VALUES
  ('AU-GOV-8a835dd650cf162f618a20b8463fa023', 'NT', 'QLD'), -- Department of Agriculture and Fisheries - Agriculture
  ('AU-GOV-63b8cf7e027d7a6c5edc194c553e9333', 'NT', 'NSW'), -- Department of Children and Families - Corporate Services
  ('AU-GOV-9ceb741a94c2423a4e9830a9b386d5d5', 'NT', 'QLD'), -- Department of Children and Families - Northern Region
  ('AU-GOV-14346d0da561ca6c6d82e4ff6a2b08fd', 'NT', 'NSW'), -- Department of Corporate and Information Services - Across Government C
  ('AU-GOV-2725e8cd522a08bb49acee9024937f88', 'NT', 'NSW'), -- Department of Education - School Support Services
  ('AU-GOV-33d4a329f6ec4a412fc944ff07d4a8ff', 'NT', 'NSW'), -- Department of Education - Strategic Policy and Executive Services
  ('AU-GOV-1f57fa9fa6f95ee7526904ce5a7ab36e', 'NT', 'NSW'), -- Department of Housing - Contract Implementation
  ('AU-GOV-8211520164e58d1016630899ddad6d84', 'NT', 'QLD'), -- Department of Housing - Housing
  ('AU-GOV-72353129967c8acdc0342b82488c3d0c', 'NT', 'NSW'), -- Department of Housing - Service Delivery North
  ('AU-GOV-09b5b037a4526cfad69fa120ebab9df6', 'NT', 'SA'), -- Department of Housing - Service Delivery South
  ('AU-GOV-67a1908195fdd14315c8ca940d62ed39', 'NT', 'NSW'), -- Department of Housing - Tenancy Support and Compliance
  ('AU-GOV-7591221517ba0ab0768a4e2d64ec0e13', 'NT', 'NSW'), -- Department of Infrastructure - Business Services
  ('AU-GOV-d528040f219c010439521d51f61b86d8', 'NT', 'NSW'), -- Department of Infrastructure - Construction
  ('AU-GOV-3a39deca80c832b1fa76f09f05390df4', 'NT', 'WA'), -- Department of Logistics and Infrastructure - Built Infrastructure
  ('AU-GOV-9b015792653e58ae06427a30c103a6a6', 'NT', 'NSW'), -- Department of Logistics and Infrastructure - Housing and Land Services
  ('AU-GOV-6cc37b9dcbeff44ab4eb415df919d45b', 'NT', 'QLD'), -- Department of Mines and Energy - Minerals and Energy
  ('AU-GOV-91ca179f2dcd69f3c0ce05ce0b478d22', 'NT', 'QLD'), -- Department of Mines and Energy - Mines Directorate
  ('AU-GOV-5ead4b45a68663c93af9a36fcd5a4806', 'NT', 'QLD'), -- Department of Mining and Energy - Mines
  ('AU-GOV-1fb4733a3a508e0347faee91334872f0', 'NT', 'NSW'), -- Department of the Chief Minister - Economic and Environment Policy
  ('AU-GOV-d5c20bc26fb12d06b927dfa34f7b47b0', 'NT', 'ACT'), -- Department of the Chief Minister - Economic Development
  ('AU-GOV-99055df660bd9e75aa5a558e49078838', 'NT', 'ACT'), -- Department of the Chief Minister - Office of the Chief Minister
  ('AU-GOV-e999c285e37e7aa98cdc240e7044b139', 'NT', 'SA'), -- Land Development Corporation - Corporate Management
  ('AU-GOV-975dd981ec96b1a436e793b18e114922', 'NT', NULL), -- Department of Arts and Museums - Arts and Culture
  ('AU-GOV-a526e5739420dcaacdb6bdaedbc8fbb3', 'NT', NULL), -- Department of Corporate and Information Services - Digital Policy
  ('AU-GOV-d15700bd5ea8bc672bac5b4567dae1bd', 'NT', NULL), -- Department of Corporate and Information Services - Human Resource Serv
  ('AU-GOV-373c6ca3a8f0f378359d891c6686689f', 'NT', NULL), -- Department of Education - Strategic Services
  ('AU-GOV-a34c58bec242a3cbd59a9c3720747fd9', 'NT', NULL), -- Department of Environment, Parks and Water Security - Parks and Wildli
  ('AU-GOV-262c09c1666c221f48d50eff75bd30eb', 'NT', NULL), -- Department of Environment, Parks and Water Security - Water Resources
  ('AU-GOV-94acbc7d03647a0d49d646d37da01993', 'NT', NULL), -- Department of Health - Finance Support Services
  ('AU-GOV-b76d5d7e52add6e5ac736c81ab3307bf', 'NT', NULL), -- Department of Housing, Local Government and Community Development - As
  ('AU-GOV-913d9ccf84b0f1cdd896ad721bb2a98f', 'NT', NULL), -- Department of Industry, Tourism and Trade - Biosecurity & Animal Welfa
  ('AU-GOV-63e5bb8c46461315d9eab707a1d6bc26', 'NT', NULL), -- Department of Industry, Tourism and Trade - Energy
  ('AU-GOV-7ab0e58292cb9ca451845625f42fb10d', 'NT', NULL), -- Department of Industry, Tourism and Trade - Mines
  ('AU-GOV-089d44cd8dd5e933508825f197f41d6b', 'NT', NULL), -- Department of Industry, Tourism and Trade - NT Geological Survey
  ('AU-GOV-08dd423f668cad127a79bd000622e760', 'NT', NULL), -- Department of Industry, Tourism and Trade - Screen Territory
  ('AU-GOV-f2b42fae98dcbc765c39a754ea7153d1', 'NT', NULL), -- Department of Industry, Tourism and Trade - Tourism and Events
  ('AU-GOV-8a56f9aa3bd0bd744ff8cdb788a09c91', 'NT', NULL), -- Department of Industry, Tourism and Trade - Tourism NT
  ('AU-GOV-f6c1780ff2c1b789c1c88d986ee7b0e5', 'NT', NULL), -- Department of Infrastructure - Building Services
  ('AU-GOV-52252a7b9d4c9354e7e6b55577f57202', 'NT', NULL), -- Department of Infrastructure - Civil Services
  ('AU-GOV-3f81a612b7c1d32e6d2a372bd1499ca9', 'NT', NULL), -- Department of Infrastructure - Infrastructure Services
  ('AU-GOV-2b586e64a7d96de98c090763efb9990e', 'NT', NULL), -- Department of Infrastructure - Major Projects
  ('AU-GOV-3cec864904c547e94b60d3b90a618bc0', 'NT', NULL), -- Department of Infrastructure - Regional Services
  ('AU-GOV-d30a2a7d1b821e6050acdc54c11b978d', 'NT', NULL), -- Department of Infrastructure, Planning and Logistics - Housing Program
  ('AU-GOV-03a8658f9ea9cdcd917a728fe91d177a', 'NT', NULL), -- Department of Infrastructure, Planning and Logistics - Infrastructure 
  ('AU-GOV-7c1fb003fd7d0681570390f02bdc074c', 'NT', NULL), -- Department of Infrastructure, Planning and Logistics - Infrastructure,
  ('AU-GOV-b8d1f1fedc3ff3822dac67bf51f93c02', 'NT', NULL), -- Department of Infrastructure, Planning and Logistics - Lands and Plann
  ('AU-GOV-24f05ed7bb3c245245c5233e08854141', 'NT', NULL), -- Department of Infrastructure, Planning and Logistics - Transport and C
  ('AU-GOV-283cd4c1fa7a1dd199a1754121c694b6', 'NT', NULL), -- Department of Lands, Planning and Environment - Lands and Planning
  ('AU-GOV-2d415d0467aaeec672e557319d13e53f', 'NT', NULL), -- Department of Lands, Planning and Environment - Rangelands
  ('AU-GOV-5ed25040889cc587c719fe64b79512a9', 'NT', NULL), -- Department of Lands, Planning and the Environment - Land Development
  ('AU-GOV-ef343ea494d665ce8cdfa09fe9bac90d', 'NT', NULL), -- Department of Lands, Planning and the Environment - Land Services
  ('AU-GOV-44ea27aa16ad1aead2dbab312525b649', 'NT', NULL), -- Department of Local Government, Housing and Community Development - Co
  ('AU-GOV-7206d0989e45571c4f58c1cc1ecade94', 'NT', NULL), -- Department of Local Government, Housing and Community Development - Ho
  ('AU-GOV-f27e7193061a0aa552b190e1575e6365', 'NT', NULL), -- Department of Local Government, Housing and Community Development - Re
  ('AU-GOV-59207530eddfbc22d848bcd0f82c9e8d', 'NT', NULL), -- Department of Local Government, Housing and Community Development - Se
  ('AU-GOV-81bfb733da35c0df4b327beaf099b3bf', 'NT', NULL), -- Department of Logistics and Infrastructure - Housing Program Office
  ('AU-GOV-15686f6d9b7e5666c36ebe53c1a03b6e', 'NT', NULL), -- Department of Logistics and Infrastructure - Infrastructure, Investmen
  ('AU-GOV-35234fe2d2e493dffe607c1986151e1e', 'NT', NULL), -- Department of Logistics and Infrastructure - Transport and Civil Infra
  ('AU-GOV-22a00e919acb3f395987e5fa4a43cf18', 'NT', NULL), -- Department of Logistics and Infrastructure - Transport and Civil Servi
  ('AU-GOV-6e3848c57ab4ced6832422c62788f5c8', 'NT', NULL), -- Department of Sport, Recreation and Racing - Sports and Recreation
  ('AU-GOV-8a8f6eb7b5cbb7ba62047b0e25b95d60', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Community 
  ('AU-GOV-4209c2ea9101a5c6534a54fcff55f908', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Remote Ref
  ('AU-GOV-9e7d1686a92fcf6dc584cef44c140d8c', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Service De
  ('AU-GOV-71b50008eac9e1aa9d39691b1d908ac3', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Southern R
  ('AU-GOV-cecf6daa84be88c7791e6e4153e68a1b', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Workforce 
  ('AU-GOV-c487c0dcd7698bda35be5d9bcf2093cc', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Youth Just
  ('AU-GOV-0b8ce4b551dd18d3c422a2973c4321f6', 'NT', NULL), -- Department of Territory Families, Housing and Communities - Youth Just
  ('AU-GOV-dcef9975b284edfd20de5c315297e72d', 'NT', NULL), -- Department of the Chief Minister - Regional Network
  ('AU-GOV-fd8a1ad4568f99d0a79df881c2fb75e2', 'NT', NULL), -- Department of the Chief Minister and Cabinet - Social, Economic and En
  ('AU-GOV-dc0ee2f26454f9cd0a928a7c6e173876', 'NT', NULL), -- Department of Tourism, Sport and Culture - Parks, Wildlife and Heritag
  ('AU-GOV-2e49c1e4e1c3128ab6a2f81850c66b4a', 'NT', NULL), -- Department of Tourism, Sport and Culture - Tourism and Events
  ('AU-GOV-ac98cddb8c65296b1632822e641993d7', 'NT', NULL), -- Department of Trade, Business and Innovation - Business and Workforce
  ('AU-GOV-8c4730b944ae36d0669d2d4c06d5ff99', 'NT', NULL), -- Northern Territory Police, Fire and Emergency Services - Corporate Ser
  ('AU-GOV-4d3ae52aa05f7c3669615eb7bbf080ce', 'NT', NULL), -- Northern Territory Police, Fire and Emergency Services - Fire and Resc
  ('AU-GOV-105019a3fdcb03f92bbee13cca4d6780', 'NT', NULL), -- Northern Territory Police, Fire and Emergency Services - Northern Terr
  ('AU-GOV-67061257bfaefaebb3ebcccb6cca8a5f', 'NT', NULL), -- Northern Territory Police, Fire and Emergency Services - NT Police
  ('AU-GOV-021fb8ffd2b56d6d47c9f8b88eb6f0c2', 'NT', NULL), -- Power and Water Corporation - Customer, Strategy and Regulation
  ('AU-GOV-2f4d25ced73c874f43904536d0dae8e9', 'NT', NULL), -- Power and Water Corporation - People, Culture and Customer
  ('AU-GOV-f1f386728aa695a049a17bc622b818dd', 'QLD', NULL)  -- Department of Employment, Small Business and Training
) AS v(gs_id, new_state, old_state)
WHERE e.gs_id = v.gs_id
  AND NULLIF(e.state, '') IS NOT DISTINCT FROM v.old_state;

SELECT link_se_buyer_prospects();

COMMIT;
