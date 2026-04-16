-- Seed PICC org dashboard data
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/seed-picc-org-dashboard.sql

BEGIN;

-- Create org_profile for PICC (using existing user_id from A Curious Tractor — same admin)
INSERT INTO org_profiles (id, user_id, name, abn, slug, linked_gs_entity_id, description, team_size, annual_revenue, org_type, subscription_plan)
VALUES (
  'a1b2c3d4-0000-4000-8000-01cc0f11e001',
  '272f1ad1-a181-4e54-9bb3-82886e873147',
  'Palm Island Community Company',
  '14640793728',
  'picc',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  '100% Aboriginal & Torres Strait Islander community-controlled organisation on Palm Island. 18 years of service delivery across health, families, child protection, youth justice, DFV, and economic development.',
  208,
  29000000,
  'acco',
  'organisation'
)
ON CONFLICT (slug) DO UPDATE SET
  abn = EXCLUDED.abn,
  linked_gs_entity_id = EXCLUDED.linked_gs_entity_id,
  description = EXCLUDED.description,
  team_size = EXCLUDED.team_size,
  annual_revenue = EXCLUDED.annual_revenue,
  subscription_plan = EXCLUDED.subscription_plan;

-- Get the profile ID
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM org_profiles WHERE slug = 'picc';

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- BAU Programs
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DELETE FROM org_programs WHERE org_profile_id = v_org_id;

  INSERT INTO org_programs (org_profile_id, name, system, funding_source, annual_amount_display, reporting_cycle, status, funding_status, sort_order) VALUES
    (v_org_id, 'Bwgcolman Healing Service', 'Health', 'NIAA 1.3 Safety & Wellbeing', '$4.8M', 'Annual (Jun)', 'active', 'secured', 1),
    (v_org_id, 'Family Support Services', 'Families', 'QLD DCSSDS', '~$2.5M', 'Quarterly', 'active', 'secured', 2),
    (v_org_id, 'Child Protection Placement', 'Child Protection', 'QLD DCSSDS', '~$1.2M', 'Quarterly', 'active', 'secured', 3),
    (v_org_id, 'Making Decisions in Our Way', 'Child Protection', 'QLD DCSSDS', '$211K', 'Annual', 'active', 'secured', 4),
    (v_org_id, 'DFV Services', 'DFV', 'QLD DCSSDS', '~$1.0M', 'Quarterly', 'active', 'secured', 5),
    (v_org_id, 'Women''s Healing Service', 'Women', 'QLD DCSSDS', '~$500K', 'Quarterly', 'active', 'secured', 6),
    (v_org_id, 'Young Offender Support', 'Youth Justice', 'QLD DCYJMA', '$340K', 'Quarterly', 'active', 'secured', 7),
    (v_org_id, 'Integrated Community Services', 'Community Services', 'Queensland Government', '$18.5M tracked', 'Mixed', 'active', 'secured', 8),
    (v_org_id, 'Growing Deadly Families', 'Health', 'Queensland Government', '$428K seed', 'Annual', 'active', 'secured', 9),
    (v_org_id, 'Digital Service Centre', 'Economic Dev', 'Queensland Government + Telstra', '$150K seed + operations', 'Annual', 'active', 'secured', 10),
    (v_org_id, 'Movember Men''s Health', 'Health', 'Movember Foundation', '$1.9M (multi-yr)', 'Annual', 'active', 'secured', 11),
    (v_org_id, 'Social Enterprises (Bakery, Fuel, Mechanics)', 'Enterprise', 'Revenue', 'Self-sustaining', 'Annual', 'active', 'self-funded', 12),
    (v_org_id, 'Elders Program & Cultural Knowledge', 'Cultural', 'Cross-program', 'Integrated', 'Ongoing', 'active', 'applied', 13),
    (v_org_id, 'Station Precinct Employment Pathways', 'Youth Justice', 'REAL Innovation Fund', '$1.2M (proposed)', 'TBD', 'planned', 'applied', 14),
    (v_org_id, 'Housing & Homelessness Services', 'Housing', 'Queensland Government (legacy)', '$968K tracked', 'Historical', 'ended', 'gap', 15),
    (v_org_id, 'Disability & Community Mental Health Services', 'Disability', 'Queensland Government (legacy)', '$1.2M tracked', 'Historical', 'ended', 'gap', 16);

  INSERT INTO org_program_source_links (org_program_id, source_type, source_key, source_label, parent_funder_name, parent_funder_entity_id, funder_name, funder_entity_id, funder_abn, notes, sort_order)
  SELECT op.id, src.source_type, src.source_key, src.source_label, src.parent_funder_name, src.parent_funder_entity_id, src.funder_name, src.funder_entity_id, src.funder_abn, src.notes, src.sort_order
  FROM org_programs op
  JOIN (
    VALUES
      ('Bwgcolman Healing Service', 'justice_funding_program', 'NIAA 1.3 - Safety and Wellbeing', 'NIAA 1.3 - Safety and Wellbeing', 'National Indigenous Australians Agency', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-c778ae1a72bb46888a614711b6ed5f21' LIMIT 1), 'National Indigenous Australians Agency', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-c778ae1a72bb46888a614711b6ed5f21' LIMIT 1), NULL, 'Federal parent funder and awarding body resolved directly in CivicGraph.', 1),
      ('Bwgcolman Healing Service', 'alma_intervention', 'PICC Safety and Wellbeing Program (NIAA 1.3)', 'PICC Safety and Wellbeing Program (NIAA 1.3)', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('Bwgcolman Healing Service', 'contract_buyer', 'James Cook University', 'James Cook University', 'James Cook University', (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-46253211955' LIMIT 1), 'James Cook University', (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-46253211955' LIMIT 1), '46253211955', 'Contract buyer link for the health/training partnership.', 20),
      ('Family Support Services', 'justice_funding_program', 'Families', 'Families', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, 'Program stream currently requires manual department naming because CivicGraph does not hold the parent hierarchy.', 1),
      ('Child Protection Placement', 'justice_funding_program', 'Child Protection - Placement Services', 'Child Protection - Placement Services', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 1),
      ('Child Protection Placement', 'justice_funding_program', 'Child Safety', 'Child Safety', 'Queensland Government', NULL, 'Department of Child Safety, Youth and Women', (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-75563721098' LIMIT 1), '75563721098', 'Historic department naming retained where that is the entity available in CivicGraph.', 2),
      ('Child Protection Placement', 'justice_funding_program', 'Child Safety Services', 'Child Safety Services', 'Queensland Government', NULL, 'Department of Child Safety, Youth and Women', (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-75563721098' LIMIT 1), '75563721098', 'Historic department naming retained where that is the entity available in CivicGraph.', 3),
      ('Child Protection Placement', 'alma_intervention', 'PICC Child Protection Placement Services', 'PICC Child Protection Placement Services', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('Making Decisions in Our Way', 'justice_funding_program', 'Making Decisions in Our Way (Delegated Authority Support Services)', 'Making Decisions in Our Way (Delegated Authority Support Services)', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 1),
      ('Making Decisions in Our Way', 'alma_intervention', 'PICC Making Decisions in Our Way', 'PICC Making Decisions in Our Way', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('DFV Services', 'justice_funding_program', 'Domestic and Family Violence', 'Domestic and Family Violence', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 1),
      ('DFV Services', 'justice_funding_program', 'Keeping Women Safe from Violence Grants', 'Keeping Women Safe from Violence Grants', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 2),
      ('DFV Services', 'justice_funding_program', 'DFV Rent Assist Brokerage Grants', 'DFV Rent Assist Brokerage Grants', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 3),
      ('DFV Services', 'alma_intervention', 'PICC Domestic and Family Violence Services', 'PICC Domestic and Family Violence Services', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('Women''s Healing Service', 'justice_funding_program', 'Women', 'Women', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, NULL, 1),
      ('Young Offender Support', 'justice_funding_program', 'Young Offender Support Service', 'Young Offender Support Service', 'Queensland Government', NULL, 'Department of Justice and Attorney-General', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1), NULL, NULL, 1),
      ('Young Offender Support', 'justice_funding_program', 'Community and Youth Justice Services and Aboriginal and Torres Strait Islander Services', 'Community and Youth Justice Services and Aboriginal and Torres Strait Islander Services', 'Queensland Government', NULL, 'Department of Justice and Attorney-General', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1), NULL, NULL, 2),
      ('Young Offender Support', 'justice_funding_program', 'Community & Youth Justice Services & Aboriginal & Torres Strait Islander Services', 'Community & Youth Justice Services & Aboriginal & Torres Strait Islander Services', 'Queensland Government', NULL, 'Department of Justice and Attorney-General', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1), NULL, NULL, 3),
      ('Young Offender Support', 'justice_funding_program', 'Community, Youth Justice Services and Women', 'Community, Youth Justice Services and Women', 'Queensland Government', NULL, 'Department of Justice and Attorney-General', (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1), NULL, NULL, 4),
      ('Young Offender Support', 'alma_intervention', 'PICC Young Offender Support Service', 'PICC Young Offender Support Service', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('Integrated Community Services', 'justice_funding_program', 'Specialised Services and Supplies', 'Specialised Services and Supplies', 'Queensland Government', NULL, 'Department of Children, Youth Justice and Multicultural Affairs', NULL, NULL, 'Queensland contract-disclosure rows rolled into an explicit community-services program crosswalk.', 1),
      ('Integrated Community Services', 'justice_funding_program', 'Specialised Service and Support', 'Specialised Service and Support', 'Queensland Government', NULL, 'Department of Children, Youth Justice and Multicultural Affairs', NULL, NULL, 'Queensland contract-disclosure rows rolled into an explicit community-services program crosswalk.', 2),
      ('Integrated Community Services', 'justice_funding_program', 'Specialised Services and Support', 'Specialised Services and Support', 'Queensland Government', NULL, 'Department of Children, Youth Justice and Multicultural Affairs', NULL, NULL, 'Variant spelling preserved so 2022-23 rows resolve to the same program.', 3),
      ('Integrated Community Services', 'justice_funding_program', 'Social Inclusion', 'Social Inclusion', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic community-services grant retained under the same integrated operating program.', 10),
      ('Integrated Community Services', 'justice_funding_program', 'Service System Support & Development', 'Service System Support & Development', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, 'QGIP peak-capability support funding crosswalked into the community-services program.', 20),
      ('Growing Deadly Families', 'justice_funding_program', 'Primary Care — Growing Deadly Families', 'Primary Care — Growing Deadly Families', 'Queensland Government', NULL, 'Department of Families, Seniors, Disability Services and Child Safety', NULL, NULL, 'QGIP maternity-services row under the Growing Deadly Families strategy.', 1),
      ('Digital Service Centre', 'justice_funding_program', 'Palm Island Digital Service Centre — Digital Services', 'Palm Island Digital Service Centre — Digital Services', 'Queensland Government', NULL, NULL, NULL, NULL, 'QGIP establishment funding for the Palm Island Digital Service Centre.', 1),
      ('Housing & Homelessness Services', 'justice_funding_program', 'Homelessness Services', 'Homelessness Services', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic housing/homelessness grant folded into a legacy program card.', 1),
      ('Housing & Homelessness Services', 'justice_funding_program', 'Housing & Homelessness Services', 'Housing & Homelessness Services', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic housing/homelessness grant folded into a legacy program card.', 2),
      ('Housing & Homelessness Services', 'justice_funding_program', 'Housing and Homelessness Services', 'Housing and Homelessness Services', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic housing/homelessness grant folded into a legacy program card.', 3),
      ('Disability & Community Mental Health Services', 'justice_funding_program', 'Disability Services', 'Disability Services', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic disability and community-mental-health grant rolled into a single legacy program.', 1),
      ('Disability & Community Mental Health Services', 'justice_funding_program', 'Disability Services (including Community and Mental Health) (excluding Home and Community Care)', 'Disability Services (including Community and Mental Health) (excluding Home and Community Care)', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic disability and community-mental-health grant rolled into a single legacy program.', 2),
      ('Disability & Community Mental Health Services', 'justice_funding_program', 'Disability and Community Mental Health Services and Multicultural Affairs', 'Disability and Community Mental Health Services and Multicultural Affairs', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic disability and community-mental-health grant rolled into a single legacy program.', 3),
      ('Disability & Community Mental Health Services', 'justice_funding_program', 'Disability & Community Mental Health Services (includes MAQ)', 'Disability & Community Mental Health Services (includes MAQ)', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic disability and community-mental-health grant rolled into a single legacy program.', 4),
      ('Disability & Community Mental Health Services', 'justice_funding_program', 'Disability and Community Mental Health Services', 'Disability and Community Mental Health Services', 'Queensland Government', NULL, 'Queensland community services portfolio (legacy)', NULL, NULL, 'Historic disability and community-mental-health grant rolled into a single legacy program.', 5),
      ('Elders Program & Cultural Knowledge', 'alma_intervention', 'PICC Elders Program and Cultural Knowledge', 'PICC Elders Program and Cultural Knowledge', NULL, NULL, NULL, NULL, NULL, NULL, 10),
      ('Elders Program & Cultural Knowledge', 'pipeline_item', 'ILA "Voices on Country"', 'ILA "Voices on Country"', NULL, NULL, NULL, NULL, NULL, NULL, 20),
      ('Station Precinct Employment Pathways', 'pipeline_item', 'REAL Innovation Fund EOI', 'REAL Innovation Fund EOI', NULL, NULL, NULL, NULL, NULL, NULL, 20)
  ) AS src(program_name, source_type, source_key, source_label, parent_funder_name, parent_funder_entity_id, funder_name, funder_entity_id, funder_abn, notes, sort_order)
    ON op.org_profile_id = v_org_id
   AND op.name = src.program_name
  ON CONFLICT (org_program_id, source_type, source_key) DO UPDATE SET
    source_label = EXCLUDED.source_label,
    parent_funder_name = EXCLUDED.parent_funder_name,
    parent_funder_entity_id = EXCLUDED.parent_funder_entity_id,
    funder_name = EXCLUDED.funder_name,
    funder_entity_id = EXCLUDED.funder_entity_id,
    funder_abn = EXCLUDED.funder_abn,
    notes = EXCLUDED.notes,
    sort_order = EXCLUDED.sort_order;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Grant Pipeline
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DELETE FROM org_pipeline WHERE org_profile_id = v_org_id;

  INSERT INTO org_pipeline (org_profile_id, name, amount_display, amount_numeric, funder, deadline, status) VALUES
    (v_org_id, 'REAL Innovation Fund EOI', '$1.2M (4yr)', 1200000, 'DEWR (Federal)', '2 Mar 2026', 'submitted'),
    (v_org_id, 'ILA "Voices on Country"', 'Up to $600K (3yr)', 600000, 'DITRDCA (Federal)', '16 Mar 2026', 'submitted'),
    (v_org_id, 'NAIDOC Grants', '$5K', 5000, 'NIAA', '22 Mar 2026', 'upcoming'),
    (v_org_id, 'Ian Potter Environment', '$100K+', 100000, 'Ian Potter Foundation', '26 Mar 2026', 'upcoming'),
    (v_org_id, 'Ecosystem Services NQ', '$192K', 192000, 'Federal', '30 Mar 2026', 'upcoming'),
    (v_org_id, 'Environmental Research', '$350K', 350000, 'Federal', '30 Mar 2026', 'upcoming'),
    (v_org_id, 'Tim Fairfax Family Foundation', '$100K–$500K', 300000, 'TFFF', 'Relationship', 'prospect'),
    (v_org_id, 'Paul Ramsay Foundation', '$500K–$2M', 1000000, 'PRF', 'Prospect', 'prospect');

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Contacts / Partners
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DELETE FROM org_contacts WHERE org_profile_id = v_org_id;

  INSERT INTO org_contacts (org_profile_id, name, role, organisation, contact_type, notes) VALUES
    (v_org_id, 'SNAICC', 'Peak body — Rachel is Board Director', 'SNAICC', 'governance', NULL),
    (v_org_id, 'QLD First Children & Families Board', 'Rachel is Co-Chair', 'QLD Government', 'governance', NULL),
    (v_org_id, 'Family Matters QLD', 'Rachel is Co-Chair', 'Family Matters', 'advocacy', NULL),
    (v_org_id, 'Commissioner Natalie Lewis (QFCC)', 'Aligned DSS recommendations', 'QFCC', 'advocacy', NULL),
    (v_org_id, 'A Curious Tractor', 'Consortium partner — REAL EOI + Goods manufacturing', 'A Curious Tractor', 'partner', NULL),
    (v_org_id, 'Oonchiumpa', 'Cross-community exchange, shared services, Empathy Ledger', 'Oonchiumpa', 'community', NULL),
    (v_org_id, 'Brodie Germaine Fitness Aboriginal Corp', 'Mt Isa/Lower Gulf exchange partner', 'Brodie Germaine', 'community', NULL),
    (v_org_id, 'Diagrama', 'International youth justice partner', 'Diagrama Foundation', 'partner', NULL),
    (v_org_id, 'Tranby College', 'Mukurtu digital archive, community projects', 'Tranby College', 'partner', NULL),
    (v_org_id, 'NIAA', '$4.8M Safety & Wellbeing funder', 'NIAA', 'funder', NULL),
    (v_org_id, 'QLD DCSSDS', 'Child protection, families, DFV funding', 'QLD DCSSDS', 'funder', NULL),
    (v_org_id, 'QLD DCYJMA', 'Youth justice funding, referral pathways', 'QLD DCYJMA', 'funder', NULL);

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Leadership
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DELETE FROM org_leadership WHERE org_profile_id = v_org_id;

  INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order) VALUES
    (v_org_id, 'Rachel Atkinson', 'CEO', 'Yorta Yorta woman, descendant of William Cooper and Sir Douglas Nicholls. Led PICC from 1 employee to 208 staff over 18 years.',
     '[{"org": "SNAICC", "role": "Board Director"}, {"org": "QLD First Children & Families Board", "role": "Co-Chair"}, {"org": "Family Matters QLD", "role": "Co-Chair"}, {"org": "QLD Aboriginal & Islander Health Council", "role": "Deputy Chair"}]'::jsonb,
     1),
    (v_org_id, 'Allan Palm Island', 'Traditional Owner Director', 'Manbarra Traditional Owner', '[]'::jsonb, 2),
    (v_org_id, 'Harriet Hulthen', 'Board Director', '12+ years Official Visitor to QLD Corrections', '[]'::jsonb, 3),
    (v_org_id, 'Cassie Lang', 'Board Director', '14 years Native Title & Indigenous Heritage law', '[]'::jsonb, 4),
    (v_org_id, 'Narelle Gleeson-Henaway', 'Chief Financial Officer', NULL, '[]'::jsonb, 5);

END $$;

COMMIT;
