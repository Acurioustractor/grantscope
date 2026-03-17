-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Seed ACT org projects hierarchy
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Give ACT a slug
UPDATE org_profiles
SET slug = 'act',
    description = 'Social enterprise ecosystem — justice, regenerative agriculture, technology, and cultural healing across 60+ projects',
    org_type = 'Social Enterprise Ecosystem'
WHERE id = '8b6160a1-7eea-4bd2-8404-71c196381de0';

-- 2. Insert major projects under ACT
INSERT INTO org_projects (org_profile_id, name, slug, code, description, tier, category, sort_order, abn, metadata)
VALUES
  -- JusticeHub
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'JusticeHub', 'justicehub', 'ACT-JH',
   'Justice data infrastructure and evidence-based interventions — CivicGraph, ALMA, and Contained',
   'major', 'justice', 1, NULL,
   '{"pillar": "justice", "strategic_priority": "high"}'::jsonb),

  -- PICC
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Palm Island Community Company', 'picc', 'ACT-PI',
   '100% Aboriginal & Torres Strait Islander community-controlled organisation on Palm Island',
   'major', 'justice', 2, '14640793728',
   '{"pillar": "justice", "community_controlled": true}'::jsonb),

  -- Goods
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Goods', 'goods', 'ACT-GD',
   'Ethical marketplace connecting social enterprises with procurement-ready buyers',
   'major', 'enterprise', 3, NULL,
   '{"pillar": "enterprise"}'::jsonb),

  -- Harvest
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Harvest', 'harvest', 'ACT-HV',
   'Regenerative agriculture and food systems — paddock to plate supply chain',
   'major', 'regenerative', 4, NULL,
   '{"pillar": "regenerative"}'::jsonb),

  -- Farm
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'The Farm', 'farm', 'ACT-FM',
   'Working farm and demonstration site for regenerative practices',
   'major', 'regenerative', 5, NULL,
   '{"pillar": "regenerative"}'::jsonb),

  -- Empathy Ledger
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   'Empathy Ledger', 'empathy-ledger', 'ACT-EL',
   'Impact measurement and accountability infrastructure for social sector',
   'major', 'technology', 6, NULL,
   '{"pillar": "technology"}'::jsonb)
ON CONFLICT (org_profile_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  abn = EXCLUDED.abn,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 3. Insert sub-projects under JusticeHub
INSERT INTO org_projects (org_profile_id, parent_project_id, name, slug, code, description, tier, category, sort_order, metadata)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'CivicGraph', 'civicgraph', 'ACT-JH-CG',
   'Decision infrastructure for government and social sector — procurement intelligence, allocation intelligence, governed proof',
   'sub', 'technology', 1,
   '{"product": true}'::jsonb),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Australian Living Map of Alternatives', 'alma', 'ACT-JH-AL',
   'Evidence database of 1,155 interventions, 570 evidence records, 506 outcomes across Australia''s justice and social sectors',
   'sub', 'justice', 2,
   '{"product": true}'::jsonb),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'justicehub' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Contained', 'contained', 'ACT-JH-CT',
   'Documentary and narrative project exploring incarceration, community, and alternatives',
   'sub', 'cultural', 3,
   '{"creative": true}'::jsonb)
ON CONFLICT (org_profile_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_project_id = EXCLUDED.parent_project_id,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 4. Insert sub-projects under PICC
INSERT INTO org_projects (org_profile_id, parent_project_id, name, slug, code, description, tier, category, sort_order, metadata)
VALUES
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Station Precinct', 'station-precinct', 'ACT-PI-SP',
   'Adaptive reuse of heritage police station into community and enterprise hub',
   'sub', 'enterprise', 1,
   '{"heritage": true}'::jsonb),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'),
   'Elders Room', 'elders-room', 'ACT-PI-ER',
   'Cultural gathering and knowledge-sharing space for Palm Island Elders',
   'sub', 'cultural', 2,
   '{"cultural_authority": true}'::jsonb)
ON CONFLICT (org_profile_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_project_id = EXCLUDED.parent_project_id,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 5. Migrate PICC org data to sit under ACT with project_id
-- Link PICC programs to the PICC project under ACT
UPDATE org_programs
SET project_id = (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0')
WHERE org_profile_id = 'a1b2c3d4-0000-4000-8000-01cc0f11e001'
  AND project_id IS NULL;

-- Link PICC pipeline items
UPDATE org_pipeline
SET project_id = (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0')
WHERE org_profile_id = 'a1b2c3d4-0000-4000-8000-01cc0f11e001'
  AND project_id IS NULL;

-- Link PICC contacts
UPDATE org_contacts
SET project_id = (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0')
WHERE org_profile_id = 'a1b2c3d4-0000-4000-8000-01cc0f11e001'
  AND project_id IS NULL;

-- Link PICC leadership
UPDATE org_leadership
SET project_id = (SELECT id FROM org_projects WHERE slug = 'picc' AND org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0')
WHERE org_profile_id = 'a1b2c3d4-0000-4000-8000-01cc0f11e001'
  AND project_id IS NULL;

-- Verify
SELECT p.slug, p.name, p.tier, p.category,
       (SELECT slug FROM org_projects WHERE id = p.parent_project_id) as parent
FROM org_projects p
WHERE p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
ORDER BY p.sort_order, p.slug;
