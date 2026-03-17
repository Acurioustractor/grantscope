-- Update PICC leadership with full board from Palm Island Repository
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/update-picc-leadership.sql

BEGIN;

DO $$
DECLARE
  v_org_id UUID := 'a1b2c3d4-0000-4000-8000-01cc0f11e001';
BEGIN
  -- Re-sort existing entries and add missing board members
  -- Full board from annual report / Palm Island Repository:
  -- 1. Rachel Atkinson (CEO) - exists
  -- 2. Luella Bligh (Chairperson) - NEW
  -- 3. Allan Palm Island (Traditional Owner Director) - exists
  -- 4. Rhonda Phillips (Board Director) - NEW
  -- 5. Harriet Hulthen (Board Director) - exists
  -- 6. Cassie Lang (Board Director) - exists
  -- 7. Raymond W. Palmer Snr (Board Director) - NEW
  -- 8. Matthew Lindsay (Company Secretary) - NEW
  -- 9. Narelle Gleeson-Henaway (CFO) - exists

  -- Update sort orders for existing members
  UPDATE org_leadership SET sort_order = 1 WHERE org_profile_id = v_org_id AND name = 'Rachel Atkinson';
  UPDATE org_leadership SET sort_order = 3 WHERE org_profile_id = v_org_id AND name = 'Allan Palm Island';
  UPDATE org_leadership SET sort_order = 5, bio = 'Born and raised on Palm Island. 12+ years as Official Visitor to QLD Corrections. Former Field Officer to Manager of Field Operations at Townsville Aboriginal and Islander Legal Service.' WHERE org_profile_id = v_org_id AND name = 'Harriet Hulthen';
  UPDATE org_leadership SET sort_order = 6 WHERE org_profile_id = v_org_id AND name = 'Cassie Lang';
  UPDATE org_leadership SET sort_order = 9 WHERE org_profile_id = v_org_id AND name = 'Narelle Gleeson-Henaway';

  -- Add Luella Bligh - Chairperson
  INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order)
  VALUES (
    v_org_id,
    'Luella Bligh',
    'Chairperson',
    'Led PICC through its historic transition to full community control in 2021. Emphasised that the transition succeeded because PICC was already operating with a majority local board and up to 90% local workforce.',
    '[]'::jsonb,
    2
  );

  -- Add Rhonda Phillips - Board Director
  INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order)
  VALUES (
    v_org_id,
    'Rhonda Phillips',
    'Board Director',
    'With PICC since its 2007 establishment. Over 40 years of experience across community, public, and academic sectors. Expertise in Indigenous governance and service integration. Chairs both the Governance Committee and Finance and Risk Committee.',
    '[]'::jsonb,
    4
  );

  -- Add Raymond W. Palmer Snr - Board Director
  INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order)
  VALUES (
    v_org_id,
    'Raymond W. Palmer Snr',
    'Board Director',
    'Proud Bwgcolman man and lifelong Palm Island resident. Appointed 2023. Works as a Teachers Aide at Bwgcolman Community School. Father to nine children.',
    '[]'::jsonb,
    7
  );

  -- Add Matthew Lindsay - Company Secretary
  INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order)
  VALUES (
    v_org_id,
    'Matthew Lindsay',
    'Company Secretary',
    'Certified Practicing Accountant–Fellow (FCPA) and Graduate of the Australian Institute of Company Directors (GAICD). Provides strategic financial advice and governance oversight.',
    '[]'::jsonb,
    8
  );

END $$;

COMMIT;
