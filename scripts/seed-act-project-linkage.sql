-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ACT Multi-Project Deep Linkage
--
-- Philosophy: ACT is an ecosystem, not a single entity. Each project is a node
-- in a web of mutual reinforcement. Justice work funds healing. Healing enables
-- enterprise. Enterprise generates revenue. Revenue funds justice work. The
-- circular economy is the organisation itself.
--
-- Thematic connections:
--
-- PICC ← justice funding, DFV, child protection, cultural programs
-- JusticeHub ← data infrastructure, evidence, policy translation
--   CivicGraph ← procurement intelligence, allocation tracking
--   ALMA ← intervention evidence, outcomes measurement
--   Contained ← narrative, documentary, community voice
-- Goods ← social enterprise, procurement, manufacturing, supply chain
-- Harvest ← regenerative ag, food systems, paddock-to-plate
-- Farm ← land management, demonstration site, environmental stewardship
-- Empathy Ledger ← impact measurement, accountability, cross-project evidence
--
-- Cross-cutting: every project feeds Empathy Ledger with outcomes data.
-- Every project can be tracked through CivicGraph. ALMA catalogues the
-- evidence. Goods sells the products. Harvest and Farm grow the food.
-- PICC is the place-based proof point where it all comes together.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ACT org_profile_id
-- '8b6160a1-7eea-4bd2-8404-71c196381de0'

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. PICC pipeline re-assignment (some items belong to other projects)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- REAL Innovation Fund is a CONSORTIUM grant — ACT + PICC + Diagrama
-- It belongs to BOTH PICC (place-based delivery) and JusticeHub (evidence)
-- Keep it under PICC since PICC is the delivery entity

-- Ecosystem Services NQ connects to Goods (social enterprise manufacturing)
-- AND Farm (land management) — keep under PICC for now but note cross-link

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. JUSTICEHUB — programs, pipeline, contacts
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_programs (org_profile_id, project_id, name, system, funding_source, status, sort_order)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'CivicGraph Platform', 'Technology', 'Revenue + Grants', 'active', 1),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'ALMA Evidence Database', 'Justice', 'Cross-program', 'active', 2),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Contained Documentary', 'Cultural', 'Grants + Revenue', 'active', 3),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Justice Policy Translation', 'Justice', 'In-kind', 'active', 4);

-- JusticeHub pipeline — grants that fund the data/evidence infrastructure
INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Research Impact Grant', '$20K', 20000, 'Fraser Education Foundation', 'upcoming', '2026-03-30',
   'foundation', 'Fund ALMA evidence synthesis and CivicGraph policy briefs. Links JusticeHub data to policy translation.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Justice Fellowships 2026', '$10K', 10000, 'Law and Justice Foundation NSW', 'upcoming', '2026-05-01',
   'government', 'Research fellowship for justice data analysis. Links CivicGraph procurement data to justice outcomes.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Arts and Social Impact Grant', '$20K–$75K', 50000, 'Philanthropy Australia', 'upcoming', '2026-06-30',
   'foundation', 'Fund Contained documentary + ALMA data visualisation. Art as evidence translation — stories that make data felt.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'ISIF Asia Grants', 'TBD', NULL, 'APNIC Foundation', 'prospect', NULL,
   'foundation', 'Digital inclusion + open data infrastructure. CivicGraph as public data commons for justice sector. Deadline 23 Mar.');

-- JusticeHub contacts — the evidence/policy network
INSERT INTO org_contacts (org_profile_id, project_id, name, role, organisation, contact_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Law and Justice Foundation NSW', 'Research partner — justice data', 'Law and Justice Foundation', 'partner',
   'Potential research partnership for CivicGraph justice procurement analysis. Justice Fellowships deadline May 2026.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Philanthropy Australia', 'Arts + social impact funder', 'Philanthropy Australia', 'funder',
   'Arts and Social Impact Grant — $20K-$75K. Contained documentary + data visualisation. Deadline June 2026.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Fraser Education Foundation', 'Research impact funder', 'Fraser Education Foundation', 'funder',
   'Research Impact Grant $20K. Fund ALMA evidence synthesis. Deadline 30 Mar 2026.');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. GOODS — social enterprise, procurement, supply chain
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_programs (org_profile_id, project_id, name, system, funding_source, status, sort_order)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Goods Marketplace Platform', 'Enterprise', 'Revenue', 'active', 1),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Social Enterprise Manufacturing', 'Enterprise', 'Revenue + Grants', 'active', 2),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Procurement Intelligence (Buyers)', 'Enterprise', 'CivicGraph data', 'active', 3),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'PICC Social Enterprises (Bakery, Fuel, Mechanics)', 'Enterprise', 'Revenue', 'active', 4);

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Transforming QLD Manufacturing', '$1.5M', 1500000, 'QLD DNRMMRRD', 'prospect', '2026-04-16',
   'government', 'QLD manufacturing grants — up to $1.5M. Social enterprise manufacturing at scale. Links PICC bakery/mechanics to Goods platform. Could fund production line for Indigenous product manufacturing.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Circular Markets Grants', '$50K', 50000, 'NSW EPA', 'upcoming', '2026-03-23',
   'government', 'Circular economy grants. Links Goods marketplace to circular supply chains. Could fund waste-to-product pathways for PICC social enterprises.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'ACCOs GROW Program', '$50K', 50000, 'NSW DCJ', 'upcoming', '2026-03-19',
   'government', 'Governance, Resilience, Opportunities, Workforce for ACCOs. Fund Goods procurement readiness + governance for community-controlled enterprise. Cross-links: PICC governance, Empathy Ledger accountability.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Community Improvement District Seed', '$350K', 350000, 'NSW Cities & Active Transport', 'prospect', '2026-04-30',
   'government', 'Place-based economic development. Could fund Goods hub infrastructure — physical marketplace + logistics in a community. Cross-links: Station Precinct (PICC), Farm (demonstration site).');

INSERT INTO org_contacts (org_profile_id, project_id, name, role, organisation, contact_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'NSW EPA (Circular Markets)', 'Circular economy funder', 'NSW EPA', 'funder',
   'Circular Markets Grants $50K. Deadline 23 Mar 2026. Waste-to-product, circular supply chains.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'goods' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'QLD DNRMMRRD (Manufacturing)', 'Manufacturing grants', 'QLD DNRMMRRD', 'funder',
   'Transforming QLD Manufacturing — up to $1.5M. Major opportunity for social enterprise production scale-up.');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. HARVEST — regenerative agriculture, food systems
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_programs (org_profile_id, project_id, name, system, funding_source, status, sort_order)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'harvest' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Paddock to Plate Supply Chain', 'Enterprise', 'Revenue', 'active', 1),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'harvest' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Regenerative Agriculture Training', 'Enterprise', 'Grants', 'planned', 2),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'harvest' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Food Security (Palm Island)', 'Health', 'Cross-program', 'active', 3);

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'harvest' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Sustainable Agriculture Small Grants', 'TBD', NULL, 'Clarence Valley Council', 'prospect', '2026-03-31',
   'government', 'Small grant for regenerative ag demonstration. Cross-links: Farm (site), Goods (products from harvest).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'harvest' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Ecosystem Services NQ (Harvest component)', '$192K', 192000, 'CDU / Federal', 'upcoming', '2026-03-30',
   'government', 'Developing Ecosystem Services Economies for northern Australia. Indigenous community economic development through culturally-appropriate environmental markets. Direct link: Farm land management, Goods marketplace, PICC place-based delivery.');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. FARM — land management, environmental stewardship
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_programs (org_profile_id, project_id, name, system, funding_source, status, sort_order)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Regenerative Demonstration Site', 'Enterprise', 'Revenue + Grants', 'active', 1),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Cultural Burning & Land Care', 'Cultural', 'Environmental grants', 'planned', 2),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Environmental Stewardship', 'Enterprise', 'Carbon credits + Grants', 'active', 3);

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Ian Potter Environment Program', '$100K+', 100000, 'Ian Potter Foundation', 'upcoming', '2026-03-26',
   'foundation', 'Environmental stewardship and land management. Aligns with cultural burning, regenerative practices, and Indigenous land care. Cross-links: Harvest (food production), PICC (cultural knowledge). The Ian Potter Foundation has TWO environment streams — check both.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Environmental Research 2026', '$350K', 350000, 'NSW Environmental Trust', 'upcoming', '2026-03-30',
   'government', 'Environmental research partnership. Could fund carbon measurement + biodiversity monitoring on the Farm. Cross-links: Empathy Ledger (environmental impact data), CivicGraph (environmental funding tracking).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Caring for Country Grants', '$27K', 27000, 'NSW DPHI', 'prospect', '2026-04-30',
   'government', 'Indigenous land management and caring for country. Cultural burning + environmental stewardship. Cross-links: PICC (cultural authority), Harvest (agricultural integration).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'farm' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Impact Grant Program 2026', '$50K', 50000, 'Intrepid Foundation', 'prospect', '2026-03-31',
   'foundation', 'Health + environment + community impact. Fund Farm as a therapeutic/regenerative landscape. Cross-links: Empathy Ledger (impact measurement), Harvest (production).');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. EMPATHY LEDGER — impact measurement, accountability
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_programs (org_profile_id, project_id, name, system, funding_source, status, sort_order)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Cross-Project Impact Dashboard', 'Technology', 'In-kind', 'active', 1),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Community-Defined Outcomes Framework', 'Justice', 'Grants', 'planned', 2),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'PICC Outcomes Tracking', 'Health', 'Cross-program', 'active', 3);

INSERT INTO org_pipeline (org_profile_id, project_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'STEM Equity & Access Program', '$10K', 10000, 'NSW Chief Scientist', 'prospect', '2026-04-06',
   'government', 'Fund data literacy and impact measurement training. Links Empathy Ledger methodology to community capacity building. Cross-links: CivicGraph (data infrastructure), PICC (community delivery).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Community Impact Program', 'TBD', NULL, 'Australian Rural Leadership Foundation', 'prospect', '2026-06-30',
   'foundation', 'Community leadership and impact measurement. Fund community-defined outcomes framework development. Cross-links: all projects feed outcomes into Empathy Ledger.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Impact Leadership Program', '$12K', 12000, 'Australian Rural Leadership Foundation', 'prospect', '2026-04-06',
   'foundation', 'Leadership development for impact measurement practitioners. Build internal capacity for Empathy Ledger methodology across ACT ecosystem.');

-- Empathy Ledger contacts — the accountability network
INSERT INTO org_contacts (org_profile_id, project_id, name, role, organisation, contact_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Oonchiumpa', 'Cross-community impact partner', 'Oonchiumpa', 'partner',
   'Shared services and Empathy Ledger pilot. Cross-community exchange for outcomes measurement. Already in PICC contact network — demonstrates ecosystem connection.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'empathy-ledger' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Australian Rural Leadership Foundation', 'Impact leadership funder', 'ARLF', 'funder',
   'Two programs: Impact Leadership ($12K) and Community Impact (TBD). Both deadline Apr-Jun 2026.');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. Cross-project contacts (org-level, not project-specific)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_contacts (org_profile_id, name, role, organisation, contact_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Paul Ramsay Foundation', 'Major funder prospect — systems change', 'Paul Ramsay Foundation', 'funder',
   '$500K-$2M range. Focus: breaking cycles of disadvantage, systems change, place-based. Connected via SNAICC. Relationship-stage: 6-12 month cultivation. Cross-links: PICC (place-based), JusticeHub (systems evidence), Empathy Ledger (impact proof).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Tim Fairfax Family Foundation', 'QLD foundation prospect', 'Tim Fairfax Family Foundation', 'funder',
   '$100K-$500K range. Focus: disadvantage, Indigenous, environment, arts. Strong QLD geographic alignment. Cross-links: PICC (Indigenous), Farm (environment), Contained (arts).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Ian Potter Foundation', 'Environment + community funder', 'Ian Potter Foundation', 'funder',
   'Two streams: Environment ($100K+, deadline 26 Mar) and Medical Research. Environment stream aligns Farm + Harvest. Cross-links: Farm (land management), Harvest (regen ag), PICC (cultural burning).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Intrepid Foundation', 'Health + environment + community', 'Intrepid Foundation', 'funder',
   'Impact Grant $50K. Health, environment, community, human rights. Deadline 31 Mar 2026. Cross-links: Farm (therapeutic landscape), Empathy Ledger (impact), PICC (health).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'NIAA', 'Federal Indigenous affairs — $4.8M current funding', 'NIAA', 'funder',
   'National Indigenous Australians Agency. Current $4.8M Safety & Wellbeing funding through PICC. Potential for JusticeHub and Empathy Ledger infrastructure funding.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Diagrama Foundation', 'International youth justice partner', 'Diagrama Foundation', 'partner',
   'Spanish youth justice social enterprise. REAL Innovation Fund consortium partner. Cross-links: PICC (delivery), JusticeHub (evidence), Goods (enterprise model).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'SNAICC', 'Peak body — board connection', 'SNAICC', 'governance',
   'Rachel is Board Director. Key advocacy and policy connection. Cross-links: PICC (child protection), JusticeHub (policy translation), Empathy Ledger (national outcomes).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'James Cook University', 'Research + training partner', 'James Cook University', 'partner',
   'Health training placements + research. $107K in contracts. Cross-links: PICC (clinical site), JusticeHub (research), Farm (environmental research).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Tranby College', 'Digital archive + community projects', 'Tranby College', 'partner',
   'Mukurtu digital archive partnership. Cross-links: PICC (ILA Voices on Country), JusticeHub (digital preservation), Contained (narrative).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'QLD First Children & Families Board', 'Government advisory — Rachel is Co-Chair', 'QLD Government', 'governance',
   'Policy influence channel. Cross-links: PICC (child protection data), JusticeHub (evidence for policy), Empathy Ledger (outcomes framework).');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. Link ACT entity to org_projects
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Link PICC project to its CivicGraph entity
UPDATE org_projects
SET linked_gs_entity_id = (SELECT id FROM gs_entities WHERE abn = '14640793728' LIMIT 1)
WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. Org-level pipeline items (cross-project, strategic)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_pipeline (org_profile_id, name, amount_display, amount_numeric, funder, status, deadline, funder_type, notes)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Paul Ramsay Foundation', '$500K–$2M', 1000000, 'Paul Ramsay Foundation', 'prospect', NULL,
   'foundation', 'STRATEGIC: Systems change at ecosystem level. Pitch: ACT as integrated proof-of-concept — justice data (JusticeHub) + place-based delivery (PICC) + enterprise pathway (Goods) + impact proof (Empathy Ledger). 6-12 month relationship cultivation.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Tim Fairfax Family Foundation', '$100K–$500K', 250000, 'Tim Fairfax Family Foundation', 'prospect', NULL,
   'foundation', 'STRATEGIC: QLD-aligned foundation. Pitch: Indigenous community enterprise + environmental stewardship + arts/cultural preservation. Cross-links every project. Need warm intro.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Telstra Connected Communities', '$10K', 10000, 'Telstra / FRRR', 'upcoming', '2026-03-26',
   'corporate', 'Digital inclusion for remote communities. Fund connectivity infrastructure. Cross-links: PICC (Digital Service Centre), CivicGraph (data access), Empathy Ledger (digital outcomes tracking).'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Community Heritage Grants', '$20K', 20000, 'National Library / Office for the Arts', 'prospect', '2026-05-07',
   'government', 'Heritage preservation. Cross-links: PICC (Station Precinct heritage), JusticeHub/Contained (documentary), Elders Room (cultural knowledge). Deadline May 2026.'),
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'LDM Implementation Funding', '$400K', 400000, 'NSW Aboriginal Affairs', 'prospect', '2026-04-30',
   'government', 'Local Decision Making — community governance and self-determination infrastructure. Cross-links: PICC (governance model), Empathy Ledger (accountability), CivicGraph (data sovereignty).');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Verify final state
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT
  COALESCE(p.name, '(org-level)') as project,
  (SELECT COUNT(*) FROM org_programs WHERE project_id = p.id) as programs,
  (SELECT COUNT(*) FROM org_pipeline WHERE project_id = p.id) as pipeline,
  (SELECT COUNT(*) FROM org_contacts WHERE project_id = p.id) as contacts
FROM org_projects p
WHERE p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND p.parent_project_id IS NULL
ORDER BY p.sort_order;

SELECT '--- ORG-LEVEL (no project) ---' as section,
  (SELECT COUNT(*) FROM org_pipeline WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0' AND project_id IS NULL) as pipeline,
  (SELECT COUNT(*) FROM org_contacts WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0' AND project_id IS NULL) as contacts;
