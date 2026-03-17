-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ACT Deep Sweep: Grants + Foundations across all 6 projects
--
-- Methodology: queried 4,877 open grants and 10,779 foundations.
-- Filtered for thematic alignment, geographic fit (QLD/national),
-- excluded academic research grants, and ranked by strategic value.
--
-- Principles:
--   - Procurement for Goods means: who BUYS from social enterprises?
--     Government procurement targets, corporate social procurement policies,
--     Indigenous procurement mandates (Commonwealth 3% target).
--   - Every grant should serve at minimum 2 projects (ecosystem thinking)
--   - Foundation relationships > one-off grants (cultivation pipeline)
--   - Place-based funders (QLD) get priority — they understand the geography
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PICC — community-controlled, sovereignty, place-based
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'IAS — Indigenous Advancement Strategy', '$10K–$500K', 250000, 'NIAA', 'prospect', '2026-06-30',
   'government', 'NIAA''s core Indigenous program funding. PICC already receives $4.8M under IAS 1.3 Safety & Wellbeing — this is for ADDITIONAL streams: culture/language, governance capacity, economic development. Aligns with Elders Room, Station Precinct, and digital service expansion.',
   '3c6f301f-ba2b-4b87-8093-74f80a5a7ebc'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Aboriginal Benefits Foundation', '$500–$5K', 2500, 'Aboriginal Benefits Foundation', 'upcoming', '2026-03-27',
   'foundation', 'Small community grants. Quick win for NAIDOC, cultural events, Elders program support. Apply alongside NAIDOC grant for combined $7.5K cultural program funding.',
   '2007c41f-3c5e-4a88-a02f-4cc1c1ecdb59'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Closing the Gap Partnership Grant', 'Up to $5M', 2000000, 'NSW Aboriginal Affairs', 'prospect', '2026-06-30',
   'government', 'MASSIVE opportunity. Partnership funding for Aboriginal community-controlled service delivery under Closing the Gap. PICC is the textbook case: 18 years of community control, 208 staff, 80%+ Indigenous workforce, delegated authority in child protection. This is the kind of grant PICC was built for.',
   'c91e3e47-e0a6-4c89-a67d-3f8b62deca28'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'ATSI Arts Development Fund', '$1K–$70K', 35000, 'Arts Queensland', 'prospect', '2026-06-30',
   'government', 'QLD arts funding for Aboriginal and Torres Strait Islander arts. Fund Elders Room cultural programs, Wulgurukaba language preservation, community storytelling archive. Cross-links: Contained (documentary), JusticeHub (digital archive).',
   'd8254260-2e05-40fe-a0a6-395a289bee2d'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Community Development Grants Program', '$10K–$75K', 50000, 'GrantConnect', 'prospect', '2026-09-30',
   'government', 'Federal community development. Infrastructure, services, economic development for Indigenous communities. Fund Station Precinct fit-out, Elders Room, or digital service centre expansion.',
   '438e1051-bd2e-4091-a828-d337223f732b');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GOODS — procurement, social enterprise, manufacturing, supply chain
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Social Enterprise Capability Building', 'Up to $120K', 120000, 'Dept of Social Services', 'prospect', '2026-06-30',
   'government', 'Federal social enterprise capability grants. Fund Goods platform development, procurement-readiness certification, buyer matching infrastructure. This is the BUILD grant — make Goods marketplace investment-ready.',
   '19765334-e457-4482-a1db-5553894b240d'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Social Enterprise Development (QLD)', '$20K–$75K', 50000, 'Queensland Government', 'prospect', '2026-06-30',
   'government', 'QLD-specific social enterprise grants. Fund PICC bakery/fuel/mechanics scaling through Goods platform. Product development, market access, supply chain optimisation. Geographic alignment: QLD government funding QLD social enterprise.',
   '49236577-9344-4fde-98fb-63c7cd9f2498'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Social Enterprise Innovation Grant', '$20K–$50K', 35000, 'GrantConnect', 'prospect', '2026-06-30',
   'government', 'Innovation in social enterprise models. Fund Goods'' CivicGraph-powered buyer matching — use procurement intelligence to connect Indigenous social enterprises with government buyers who have Indigenous procurement targets.',
   '6cda784c-cc79-4f8d-85ab-2d044dfc4b05'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Micro Business Enterprises (Nova Peris)', 'Up to $50K', 50000, 'Nova Peris Foundation', 'prospect', '2026-06-30',
   'foundation', 'Indigenous micro-enterprise development. Fund PICC social enterprises'' expansion through Goods marketplace. Nova Peris Foundation focuses on Indigenous economic empowerment — direct philosophical alignment.',
   '021474cc-d0b2-438f-85d4-280cda2cbd40'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'VIC Circular Economy Fund', '$50K–$500K', 250000, 'Sustainability Victoria', 'prospect', '2026-07-01',
   'government', 'Major circular economy funding. Fund recycled-plastic bed base manufacturing (Station Precinct) at scale. Goods as circular supply chain connector. VIC-based but could fund national supply chain infrastructure.',
   '018dcba3-863a-474b-b03f-a899022281d4'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Boosting Business Innovation', 'Up to $11M', 500000, 'NSW Premier''s Department', 'prospect', '2027-06-30',
   'government', 'MAJOR: innovation grants up to $11M. Goods as technology-enabled social enterprise marketplace. CivicGraph procurement intelligence + Goods buyer matching = tech innovation in social procurement. Long deadline — strategic application.',
   'd01c1f3d-4b84-4a24-9262-a650ac091718');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- JUSTICEHUB — data, evidence, policy, research
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Indigenous Capacity Building Fund', '$30K–$100K', 65000, 'Philanthropy Australia', 'prospect', '2026-09-30',
   'foundation', 'Build Indigenous community capacity in data sovereignty, evidence collection, and self-determined research. Fund ALMA community-led evidence methodology + CivicGraph data literacy for ACCOs.',
   'b8f9632b-4f17-4444-81c8-33a33cc0b2fe'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Cooperative Research Centres Round 27', 'TBD', NULL, 'Dept of Industry, Science & Resources', 'prospect', '2026-04-29',
   'government', 'CRC for justice data infrastructure? Multi-year, multi-institution research collaboration. CivicGraph + ALMA as national justice data commons. Partner with JCU, UQ, Legal Aid QLD. Long-shot but transformative if awarded.',
   '99f321ed-0521-4dc3-a95b-b582df0b3bc5');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FARM — environment, land care, carbon, biodiversity
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'First Nations Clean Energy Grants', 'TBD', NULL, 'DCCEEW', 'prospect', '2026-09-03',
   'government', 'First Nations clean energy. Farm as solar/renewable demonstration site. Indigenous energy sovereignty. Cross-links: PICC (remote community energy), Station Precinct (enterprise energy), Empathy Ledger (environmental impact tracking).',
   'ef5fe660-2e34-4101-bceb-5ead991bd4a8');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- EMPATHY LEDGER — impact, accountability, outcomes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Supporting Expecting & Parenting Teens', 'Up to $50K', 50000, 'Brave Foundation', 'prospect', '2026-06-30',
   'foundation', 'Health/education outcomes for young parents. Empathy Ledger as outcomes tracking tool for teen parent programs. Real-world pilot of community-defined outcomes methodology. Cross-links: PICC (health services), JusticeHub (evidence).',
   'd5fb4c67-b2fc-4d99-892b-f452a1050137');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ORG-LEVEL — strategic, ecosystem-wide
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes, grant_opportunity_id)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Minderoo Foundation', '$50K–$250K', 150000, 'Minderoo Foundation', 'prospect', NULL,
   'foundation', 'STRATEGIC: $268M/year giving. Focus: Indigenous, employment, early childhood, environment, modern slavery. ACT pitch: integrated Indigenous community enterprise model — employment pathways (Goods/Station Precinct), early childhood (PICC families), environment (Farm/Harvest). Andrew Forrest''s foundation — WA-based but national reach.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'BHP Foundation', '$50K–$500K', 250000, 'BHP Foundation', 'prospect', NULL,
   'foundation', 'STRATEGIC: $195M/year, AU-QLD geographic focus. Indigenous, community, human rights, environment, education, youth. Existing QLD presence. ACT pitch: whole-of-community transformation model. BHP''s Indigenous reconciliation commitments align with PICC + Goods.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Rio Tinto Foundation', '$50K–$500K', 250000, 'Rio Tinto Foundation', 'prospect', NULL,
   'foundation', 'STRATEGIC: $154M/year, AU-QLD geographic focus. Indigenous, cultural heritage, employment, economic development. Rio Tinto has deep QLD presence (Weipa, Gladstone). ACT pitch: Indigenous economic development through community-controlled enterprise.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Suncorp Foundation', '$25K–$100K', 50000, 'Suncorp Foundation', 'prospect', NULL,
   'foundation', 'QLD-headquartered, $9M/year. Environment, community, human rights, disability, youth, Indigenous. Natural QLD corporate partner. ACT pitch: community resilience through integrated services (PICC) + environmental stewardship (Farm).',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Australian Communities Foundation', '$20K–$100K', 50000, 'Australian Communities Foundation', 'prospect', NULL,
   'foundation', 'RARE: explicitly lists social-enterprise AND justice AND Indigenous in thematic focus ($40M/year). ACT is a direct thematic match across EVERY focus area. Pitch: the ecosystem model where justice, enterprise, and community reinforce each other.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'NQ Dry Tropics', '$10K–$50K', 25000, 'NQ Dry Tropics', 'prospect', NULL,
   'foundation', 'LOCAL: Townsville-based NRM body. Environment, community, research, Indigenous, rural/remote. $5.5M/year. Direct geographic overlap with PICC + Farm. Natural partner for environmental stewardship, cultural burning, and land management programs.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'North QLD Primary Health Network', '$20K–$100K', 50000, 'NQ PHN', 'prospect', NULL,
   'foundation', 'LOCAL: $68M/year, health + Indigenous focus, QLD geographic. PICC''s Bwgcolman Healing Service already operates in this network. Opportunity for Empathy Ledger health outcomes tracking pilot + Harvest food security/nutrition data.',
   NULL),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Transport Access Regional Partnerships', 'Up to $250K', 250000, 'Transport for NSW', 'prospect', '2026-06-30',
   'government', 'Regional transport access. Fund supply chain logistics for Goods (remote community delivery), Harvest (paddock to plate transport), and PICC (service access for Palm Island). Cross-links every project with physical infrastructure.',
   '4b8759e9-6fbb-434d-8bb0-ba2e98c9dc7d');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Foundation contacts (relationship cultivation targets)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_contacts (org_profile_id, name, role, organisation, contact_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Minderoo Foundation', '$268M/year — Indigenous, employment, environment', 'Minderoo Foundation', 'funder',
   'Andrew Forrest foundation. WA-based, national. Employment pathways + early childhood + environment. ACT alignment: Goods (employment), PICC (families), Farm (environment). Cultivation: 6-12 months. Approach via Indigenous employment angle.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'BHP Foundation', '$195M/year — Indigenous, community, QLD presence', 'BHP Foundation', 'funder',
   'QLD geographic focus. Indigenous + community + education + youth. Major funder with existing QLD relationships. Cultivation: attend BHP community events in QLD, build via JCU connection.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Rio Tinto Foundation', '$154M/year — Indigenous, cultural heritage, QLD', 'Rio Tinto Foundation', 'funder',
   'QLD operations (Weipa, Gladstone). Indigenous cultural heritage + economic development. Cultivation: approach via Indigenous enterprise and cultural preservation angles. Station Precinct + Elders Room.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Suncorp Foundation', '$9M/year — QLD HQ, community resilience', 'Suncorp Foundation', 'funder',
   'Queensland-headquartered corporate foundation. Environment + community + youth + Indigenous. Natural local partner. Cultivation: corporate partnership approach, not just grants.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Australian Communities Foundation', '$40M/year — social enterprise + justice + Indigenous', 'Australian Communities Foundation', 'funder',
   'RARE alignment: explicitly funds social enterprise AND justice AND Indigenous. ACT is their ideal grantee profile. Cultivation: direct approach with ecosystem model pitch.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'NQ Dry Tropics', '$5.5M/year — Townsville NRM, local partner', 'NQ Dry Tropics', 'partner',
   'Local Townsville NRM body. Direct geographic overlap. Environment + Indigenous + community. Natural partner for Farm environmental programs. Already in the region — relationship building should be straightforward.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'North QLD Primary Health Network', '$68M/year — health + Indigenous, local', 'NQ PHN', 'partner',
   'PICC already operates within this network (Bwgcolman Healing Service). Deepen relationship for Empathy Ledger health outcomes pilot and Harvest nutrition data.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Dept of Social Services', 'Social enterprise capability building', 'Dept of Social Services', 'funder',
   'Federal social enterprise grants up to $120K. Fund Goods platform + procurement readiness. DSS also runs broader community grants — multiple entry points.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Nova Peris Foundation', 'Indigenous micro-enterprise development', 'Nova Peris Foundation', 'funder',
   'Up to $50K for Indigenous business development. Natural fit for PICC social enterprises through Goods marketplace. Nova Peris — high-profile Indigenous champion.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Sustainability Victoria', 'Circular economy funding — $50K-$500K', 'Sustainability Victoria', 'funder',
   'Circular Economy Recycling Modernisation Fund. Fund recycled-plastic bed base manufacturing. VIC-based but national supply chain eligible. Deadline Jul 2026.');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Verify
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT
  COALESCE(
    (SELECT name FROM org_projects WHERE id = p.project_id),
    '── ACT org-level'
  ) as project,
  COUNT(*) as pipeline
FROM org_pipeline p
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
GROUP BY project_id
ORDER BY project;

SELECT 'TOTALS' as label,
  (SELECT COUNT(*) FROM org_programs WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as programs,
  (SELECT COUNT(*) FROM org_pipeline WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as pipeline,
  (SELECT COUNT(*) FROM org_contacts WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as contacts,
  (SELECT COUNT(*) FROM org_leadership WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as leadership;
