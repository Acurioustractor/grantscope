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

  INSERT INTO org_programs (org_profile_id, name, system, funding_source, annual_amount_display, reporting_cycle, status, sort_order) VALUES
    (v_org_id, 'Bwgcolman Healing Service', 'Health', 'NIAA 1.3 Safety & Wellbeing', '$4.8M', 'Annual (Jun)', 'active', 1),
    (v_org_id, 'Family Support Services', 'Families', 'QLD DCSSDS', '~$2.5M', 'Quarterly', 'active', 2),
    (v_org_id, 'Child Protection Placement', 'Child Protection', 'QLD DCSSDS', '~$1.2M', 'Quarterly', 'active', 3),
    (v_org_id, 'Making Decisions in Our Way', 'Child Protection', 'QLD DCSSDS', '$211K', 'Annual', 'active', 4),
    (v_org_id, 'DFV Services', 'DFV', 'QLD DCSSDS', '~$1.0M', 'Quarterly', 'active', 5),
    (v_org_id, 'Women''s Healing Service', 'Women', 'QLD DCSSDS', '~$500K', 'Quarterly', 'active', 6),
    (v_org_id, 'Young Offender Support', 'Youth Justice', 'QLD DCYJMA', '$340K', 'Quarterly', 'active', 7),
    (v_org_id, 'Digital Service Centre', 'Economic Dev', 'Telstra', 'Self-sustaining', 'Annual', 'active', 8),
    (v_org_id, 'Movember Men''s Health', 'Health', 'Movember Foundation', '$1.9M (multi-yr)', 'Annual', 'active', 9),
    (v_org_id, 'Social Enterprises (Bakery, Fuel, Mechanics)', 'Enterprise', 'Revenue', 'Self-sustaining', 'Annual', 'active', 10),
    (v_org_id, 'Elders Program & Cultural Knowledge', 'Cultural', 'Cross-program', 'Integrated', 'Ongoing', 'active', 11);

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
