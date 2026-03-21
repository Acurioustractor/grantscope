-- Add grant opportunities for Oonchiumpa and link to entity
-- These are the active/upcoming grants identified from the meeting + web research

BEGIN;

-- 1. Community Impact and Innovation Grant (Aboriginal Investment NT) — THE BIG ONE
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max, deadline, closes_at,
  provider, program, url, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Community Impact and Innovation Grant — Aboriginal Investment NT',
  'Medium-scale Aboriginal community-led projects in the NT. $300K–$1M for place-based employment, training, enterprise and community infrastructure. Two-step application: eligibility check (6 weeks) then full application (12 weeks). Outcomes notified by 31 July 2026. Oonchiumpa strategy: plastics recycling + screen printing enterprise + on-country programs at At Napa station.',
  300000, 1000000,
  '2026-04-30', '2026-04-30',
  'Aboriginal Investment NT', 'Community Impact and Innovation Grants',
  'https://www.aboriginalinvestment.org.au/community-impact-and-innovation-grants',
  'web_research', 'manual', 'web_search',
  ARRAY['indigenous', 'community', 'enterprise', 'youth'],
  ARRAY['first-nations', 'social-enterprise', 'place-based', 'employment-training'],
  ARRAY['indigenous_corp', 'aboriginal_org'],
  'NT',
  'researching', 'open', 9, 9,
  ARRAY['at-napa-enterprise', 'plastics-recycling', 'screen-printing', 'on-country-programs'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "Go for this one over Real Funding — less onerous reporting, less competitive than national programs. Could include goods project + screen printing. Need: project team details, governance section.", "pool_total": "$7.5M per FY"}'::jsonb,
  NOW(), NOW()
);

-- 2. Business Start-Up Grant (Aboriginal Investment NT) — for Oonchiumpa
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max,
  provider, program, url, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Business Start-Up Grant — Aboriginal Investment NT (Oonchiumpa)',
  'Up to $100K for Aboriginal businesses in start-up phase. Round 3 open, rolling until funds allocated. Oonchiumpa (ABN active since Apr 2022) eligible. Strategy: shipping container infrastructure, enterprise setup on Tanya block. Note: Njuka entity also separately eligible for this grant.',
  0, 100000,
  'Aboriginal Investment NT', 'Business Start-Up Grants Round 3',
  'https://www.aboriginalinvestment.org.au/business-start-up-grants',
  'web_research', 'manual', 'web_search',
  ARRAY['indigenous', 'enterprise'],
  ARRAY['first-nations', 'business-startup'],
  ARRAY['indigenous_corp', 'aboriginal_org'],
  'NT',
  'researching', 'open', 8, 8,
  ARRAY['shipping-container', 'enterprise-setup'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "Rolling — apply when ready. Could fund container purchase, land prep on Tanya block. Tanya separate entity (Njuka) also eligible for own $100K."}'::jsonb,
  NOW(), NOW()
);

-- 3. NIAA Youth Funding Round — April 2026
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max,
  provider, program, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'NIAA Youth Funding Round — April 2026',
  'NIAA youth funding round opening April 2026. Oonchiumpa told to "go big" by NIAA. Focus on youth justice diversion, on-country programs, cultural connection for young people in contact with justice system. Exact amount TBD — expected to be substantial.',
  0, 0,
  'NIAA', 'Indigenous Advancement Strategy — Youth',
  'meeting_notes', 'manual', 'meeting',
  ARRAY['indigenous', 'youth', 'justice', 'community'],
  ARRAY['youth-justice', 'diversion', 'on-country', 'cultural-connection'],
  ARRAY['indigenous_corp', 'aboriginal_org'],
  'NT',
  'discovered', 'upcoming', 9, 9,
  ARRAY['on-country-programs', 'youth-justice-diversion', 'oonchiumpa-house'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "NIAA told them to go big. Could cover expanded on-country youth justice programs, potentially Oonchiumpa House concept. Watch for opening date in April."}'::jsonb,
  NOW(), NOW()
);

-- 4. Snow Foundation — $100K committed (track as awarded)
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max,
  provider, program, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Snow Foundation — Oonchiumpa Operational Funding Year 1',
  'Snow Foundation committed $100K for Year 1 operational costs. Proposal rewritten in 24hrs to exclude infrastructure — covers program coordinator, engagement officer, casual facilitators, employment & training, vehicle/fuel, catering, insurance, marketing, evaluation. Board wants to see viable business with revenue projections. Submitted to CEO Georgiana. Year 2 could include infrastructure if Year 1 proves viability.',
  100000, 100000,
  'The Snow Foundation', 'Trust-based Philanthropy',
  'meeting_notes', 'manual', 'meeting',
  ARRAY['indigenous', 'community', 'enterprise'],
  ARRAY['capacity-building', 'operational', 'youth-programs'],
  ARRAY['indigenous_corp'],
  'NT',
  'submitted', 'pending', 10, 10,
  ARRAY['at-napa-operations', 'on-country-programs'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "KEY INSIGHT: Use $100K for salaries already funded by NIAA → frees up equivalent for infrastructure. Snow is trust-based — wont reconcile invoices closely. Year 2 pitch for infrastructure once viability proven.", "funder_abn": "49411415493", "submitted_to": "Georgiana (CEO)"}'::jsonb,
  NOW(), NOW()
);

-- 5. Real Funding — $200K application for goods project
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max,
  provider, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Real Funding — Goods/Recycling Project',
  'Approximately $200K application pending for goods project (plastics recycling). Separate from innovation grant but linked — if unsuccessful, innovation grant application should include goods component as fallback. National program so more competitive.',
  200000, 200000,
  'Real Funding',
  'meeting_notes', 'manual', 'meeting',
  ARRAY['indigenous', 'enterprise', 'community'],
  ARRAY['social-enterprise', 'recycling', 'goods'],
  ARRAY['indigenous_corp'],
  'National',
  'submitted', 'pending', 7, 7,
  ARRAY['plastics-recycling', 'goods-project'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "National = competitive. Innovation grant from Aboriginal Investment NT is better bet for same project. Keep as backup."}'::jsonb,
  NOW(), NOW()
);

-- 6. RJED Remote Jobs Program — closes 7 April 2026
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max, deadline, closes_at,
  provider, program, url, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  aligned_projects,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Remote Jobs and Economic Development (RJED) Round 3',
  'Grants for employers in Remote Australia Employment Service (RAES) regions to create jobs — part-time, full-time or casual, flexible around personal, family and community obligations. Alice Springs is in RAES region.',
  0, 0,
  '2026-04-07', '2026-04-07',
  'NIAA', 'Remote Jobs and Economic Development',
  'https://www.niaa.gov.au/news-and-media/grants-remote-jobs-program-are-now-open',
  'web_research', 'manual', 'web_search',
  ARRAY['indigenous', 'enterprise', 'community'],
  ARRAY['employment', 'remote-australia', 'job-creation'],
  ARRAY['indigenous_corp', 'aboriginal_org'],
  'NT',
  'discovered', 'open', 7, 7,
  ARRAY['employment-training', 'enterprise-setup'],
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "Could fund employment positions linked to enterprise — recycling, screen printing, on-country camp facilitation. Closes soon — 7 April."}'::jsonb,
  NOW(), NOW()
);

-- 7. Business Growth Grant (future — after start-up phase)
INSERT INTO grant_opportunities (
  id, name, description, amount_min, amount_max,
  provider, program, url, source, discovered_by, discovery_method,
  categories, focus_areas, target_recipients, geography,
  pipeline_stage, status, relevance_score, fit_score,
  metadata, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Business Growth Grant — Aboriginal Investment NT',
  'Up to $150K for established Aboriginal businesses ready to scale. Next phase after start-up grant. Could fund expansion of enterprise operations — additional containers, equipment, staffing.',
  0, 150000,
  'Aboriginal Investment NT', 'Business Growth Grants',
  'https://www.aboriginalinvestment.org.au/business-growth-grants',
  'web_research', 'manual', 'web_search',
  ARRAY['indigenous', 'enterprise'],
  ARRAY['first-nations', 'business-growth'],
  ARRAY['indigenous_corp'],
  'NT',
  'discovered', 'open', 6, 5,
  '{"entity_abn": "53658668627", "entity_name": "Oonchiumpa Consultancy & Services", "strategy_notes": "Phase 2 — apply after start-up grant and initial enterprise setup proves viable."}'::jsonb,
  NOW(), NOW()
);

COMMIT;
