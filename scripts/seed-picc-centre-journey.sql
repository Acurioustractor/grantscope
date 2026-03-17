-- Seed: PICC Centre Journey — Young Person's Journey on Palm Island
-- Org: A Curious Tractor (act), Project: PICC

BEGIN;

-- Create the journey
INSERT INTO org_journeys (id, org_profile_id, project_id, title, description, status)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '8b6160a1-7eea-4bd2-8404-71c196381de0',  -- A Curious Tractor
  'ca990dc1-2902-41f8-a408-2a3ee39c4126',  -- PICC project
  'Young Person''s Journey — Palm Island Centre',
  'Mapping the journey of young people on Palm Island through the current system vs what changes with the PICC Centre.',
  'active'
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Persona 1: Young Person
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_journey_personas (id, journey_id, label, description, cohort, context, sort_order)
VALUES (
  'p1000000-0000-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Young Person',
  'A 15-17 year old Aboriginal young person growing up on Palm Island, cycling through multiple government systems with no coordination between them.',
  '15-17 year old',
  'Palm Island, Far North Queensland. Remote community. High SEIFA disadvantage.',
  0
);

-- Current journey steps
INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, icon) VALUES
('s1000000-0000-0000-0000-000000000001', 'p1000000-0000-0000-0000-000000000001', 'current', 1,
 'School Exclusion',
 'Suspended from school for behavioural issues. Undiagnosed FASD and trauma history not recognised by the education system.',
 'education', 'confused', '3-6 months', '🏫'),

('s1000000-0000-0000-0000-000000000002', 'p1000000-0000-0000-0000-000000000001', 'current', 2,
 'Unsupervised on Country',
 'With no school to attend and limited services, the young person spends days without structured activity. Family is under pressure.',
 'community', 'isolated', '1-3 months', '🏠'),

('s1000000-0000-0000-0000-000000000003', 'p1000000-0000-0000-0000-000000000001', 'current', 3,
 'Police Contact',
 'Minor offence leads to police contact. On Palm Island, this escalates quickly. Charged and enters the youth justice system.',
 'justice', 'scared', '1 week', '🚔'),

('s1000000-0000-0000-0000-000000000004', 'p1000000-0000-0000-0000-000000000001', 'current', 4,
 'Youth Detention',
 'Remanded to Cleveland Youth Detention Centre in Townsville — 2.5 hours from family. No cultural support. Trauma compounds.',
 'justice', 'angry', '3-12 months', '🔒'),

('s1000000-0000-0000-0000-000000000005', 'p1000000-0000-0000-0000-000000000001', 'current', 5,
 'Child Protection Involvement',
 'Detention triggers child protection investigation. Family assessed as unable to provide safe environment. Multiple agencies now involved with no coordination.',
 'child-protection', 'resigned', 'ongoing', '📋'),

('s1000000-0000-0000-0000-000000000006', 'p1000000-0000-0000-0000-000000000001', 'current', 6,
 'Cycle Repeats',
 'Released back to community with no changed conditions. Same pressures, same gaps. Re-offending within 6 months. The system has failed but blames the young person.',
 'justice', 'resigned', '6-12 months', '🔄');

-- Alternative journey steps
INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, is_divergence_point, icon) VALUES
('s1000000-0000-0000-0000-000000000011', 'p1000000-0000-0000-0000-000000000001', 'alternative', 1,
 'Centre Arrival',
 'Instead of being left unsupervised after school exclusion, the young person is referred to the PICC Centre by family or community. A safe place to be.',
 'community', 'cautious hope', 'first week', true, '🏠'),

('s1000000-0000-0000-0000-000000000012', 'p1000000-0000-0000-0000-000000000001', 'alternative', 2,
 'Skills & Safety',
 'At the Centre: structured activities, skills development, sport, art. Trusted adults present. Behaviour is understood in context of trauma, not punished.',
 'community', 'safe', '1-3 months', '🛠️'),

('s1000000-0000-0000-0000-000000000013', 'p1000000-0000-0000-0000-000000000001', 'alternative', 3,
 'Cultural Connection',
 'Elders at the Centre guide cultural learning — language, ceremony, connection to Country. Identity strengthens. The young person starts to see themselves differently.',
 'community', 'connected', 'ongoing', '🌿'),

('s1000000-0000-0000-0000-000000000014', 'p1000000-0000-0000-0000-000000000001', 'alternative', 4,
 'NDIS & Health Support',
 'Centre staff identify FASD indicators, support family to access NDIS assessment and plan. Health needs are met through coordinated community-controlled services.',
 'disability', 'supported', '3-6 months', '💊'),

('s1000000-0000-0000-0000-000000000015', 'p1000000-0000-0000-0000-000000000001', 'alternative', 5,
 'Community Healing',
 'The young person is part of the community again — not a case number. Family relationships strengthen. Elders have authority. The Centre is a permanent safe place.',
 'community', 'healing', 'ongoing', '💚');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Persona 2: The Elder
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_journey_personas (id, journey_id, label, description, cohort, context, sort_order)
VALUES (
  'p1000000-0000-0000-0000-000000000002',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'The Elder',
  'A respected community authority figure on Palm Island who has watched generations cycle through government systems. Holds cultural knowledge and community trust.',
  'Senior Elder',
  'Palm Island. Lifelong community member. Carries authority and responsibility.',
  1
);

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, icon) VALUES
('s1000000-0000-0000-0000-000000000021', 'p1000000-0000-0000-0000-000000000002', 'current', 1,
 'Watching Kids Fall',
 'Sees the same pattern repeat: young people excluded, criminalised, removed from community. Has cultural solutions but no institutional authority.',
 'community', 'resigned', 'decades', '👀'),

('s1000000-0000-0000-0000-000000000022', 'p1000000-0000-0000-0000-000000000002', 'current', 2,
 'Consulted but Not Heard',
 'Government agencies "consult" with Elders but decisions are made in Townsville or Brisbane. Cultural authority is acknowledged in words but not in practice.',
 'community', 'angry', 'ongoing', '🗣️'),

('s1000000-0000-0000-0000-000000000023', 'p1000000-0000-0000-0000-000000000002', 'current', 3,
 'Carrying the Weight',
 'Bears the emotional and cultural weight of community trauma. No funded support for Elders themselves. Expected to fix what systems have broken.',
 'community', 'isolated', 'ongoing', '⚡');

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, is_divergence_point, icon) VALUES
('s1000000-0000-0000-0000-000000000031', 'p1000000-0000-0000-0000-000000000002', 'alternative', 1,
 'Cultural Authority at the Centre',
 'The Centre is designed around Elder authority. Governance, programs, and daily rhythms follow cultural protocols. The Elder has real decision-making power.',
 'community', 'empowered', 'from day one', true, '🌟'),

('s1000000-0000-0000-0000-000000000032', 'p1000000-0000-0000-0000-000000000002', 'alternative', 2,
 'Teaching & Healing',
 'Passes on language, ceremony, and connection to Country through the Centre''s programs. Sees young people strengthen. Cultural continuity is secured.',
 'community', 'proud', 'ongoing', '📖'),

('s1000000-0000-0000-0000-000000000033', 'p1000000-0000-0000-0000-000000000002', 'alternative', 3,
 'Community Recognised',
 'Elder authority is funded and resourced. The Centre creates a model other communities can learn from. Legacy.',
 'community', 'hopeful', 'long-term', '🏛️');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Persona 3: The Caseworker
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_journey_personas (id, journey_id, label, description, cohort, context, sort_order)
VALUES (
  'p1000000-0000-0000-0000-000000000003',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'The Caseworker',
  'A government child protection caseworker assigned to Palm Island families. Well-intentioned but working within a system designed for urban, non-Indigenous contexts.',
  'Mid-career professional',
  'Based in Townsville, flies to Palm Island periodically. High caseload.',
  2
);

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, icon) VALUES
('s1000000-0000-0000-0000-000000000041', 'p1000000-0000-0000-0000-000000000003', 'current', 1,
 'Risk Assessment',
 'Applies standardised risk framework that flags Palm Island families disproportionately. Cultural factors coded as risk. Limited local knowledge.',
 'child-protection', 'anxious', '2 weeks', '📊'),

('s1000000-0000-0000-0000-000000000042', 'p1000000-0000-0000-0000-000000000003', 'current', 2,
 'Removal Decision',
 'System pressure towards removal. No local alternatives to recommend. Flies in, makes decision, flies out. Community trust erodes further.',
 'child-protection', 'conflicted', '1-2 days', '✈️'),

('s1000000-0000-0000-0000-000000000043', 'p1000000-0000-0000-0000-000000000003', 'current', 3,
 'Burnout',
 'High moral injury from making decisions that feel wrong but are "policy". Leaves the role within 18 months. Replaced by someone even less experienced.',
 'child-protection', 'resigned', '12-18 months', '😔');

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, is_divergence_point, icon) VALUES
('s1000000-0000-0000-0000-000000000051', 'p1000000-0000-0000-0000-000000000003', 'alternative', 1,
 'Centre as Resource',
 'The PICC Centre exists as a credible local alternative. Caseworker can recommend community-based support rather than removal. Risk assessment includes strengths.',
 'child-protection', 'hopeful', 'immediate', true, '🏠'),

('s1000000-0000-0000-0000-000000000052', 'p1000000-0000-0000-0000-000000000003', 'alternative', 2,
 'Collaborative Practice',
 'Works alongside Centre staff and Elders rather than alone. Shared assessment, shared planning. Cultural authority informs decisions.',
 'community', 'supported', 'ongoing', '🤝'),

('s1000000-0000-0000-0000-000000000053', 'p1000000-0000-0000-0000-000000000003', 'alternative', 3,
 'Better Outcomes, Less Burnout',
 'Sees families actually improve. Stays in the role longer. Becomes an advocate for community-controlled alternatives within the department.',
 'child-protection', 'empowered', 'years', '💪');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Persona 4: The Funder
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSERT INTO org_journey_personas (id, journey_id, label, description, cohort, context, sort_order)
VALUES (
  'p1000000-0000-0000-0000-000000000004',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'The Funder',
  'A program manager at a government department or philanthropic foundation, deciding whether to fund community-controlled alternatives on Palm Island.',
  'Senior program manager',
  'Brisbane or Canberra based. Accountable for outcomes and compliance.',
  3
);

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, icon) VALUES
('s1000000-0000-0000-0000-000000000061', 'p1000000-0000-0000-0000-000000000004', 'current', 1,
 'Reading the Data',
 'Sees the recidivism rates, the cost per detention bed ($1,500/day), the child removal rates. Knows the system isn''t working.',
 'economic', 'concerned', '1 hour', '📈'),

('s1000000-0000-0000-0000-000000000062', 'p1000000-0000-0000-0000-000000000004', 'current', 2,
 'Risk Aversion',
 'Wants to fund alternatives but the compliance framework favours established, urban, non-Indigenous organisations. Community orgs are "too risky".',
 'economic', 'conflicted', 'months', '⚖️'),

('s1000000-0000-0000-0000-000000000063', 'p1000000-0000-0000-0000-000000000004', 'current', 3,
 'Funding the Status Quo',
 'Renews contracts with the same providers delivering the same programs with the same outcomes. Writes "closing the gap" in the annual report.',
 'economic', 'resigned', 'annual cycle', '📝');

INSERT INTO org_journey_steps (id, persona_id, path, step_number, title, description, system, emotion, duration, is_divergence_point, icon) VALUES
('s1000000-0000-0000-0000-000000000071', 'p1000000-0000-0000-0000-000000000004', 'alternative', 1,
 'Seeing the Journey Map',
 'Reads this journey map. Sees the human story behind the data. Understands why community-controlled matters — not as ideology but as evidence.',
 'economic', 'moved', '30 minutes', true, '🗺️'),

('s1000000-0000-0000-0000-000000000072', 'p1000000-0000-0000-0000-000000000004', 'alternative', 2,
 'Evidence-Based Decision',
 'CivicGraph data shows ALMA evidence for cultural connection programs, wraparound support, and community-led diversion. Real evidence, not just consultation.',
 'economic', 'confident', '2 weeks', '📊'),

('s1000000-0000-0000-0000-000000000073', 'p1000000-0000-0000-0000-000000000004', 'alternative', 3,
 'Funding the Alternative',
 'Approves funding for the PICC Centre. Structured reporting through CivicGraph. Outcomes are tracked. Money flows to community authority, not through intermediaries.',
 'economic', 'hopeful', 'multi-year', '💰');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Data matches — link steps to ALMA interventions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Cultural Connection step → ALMA Cultural Connection interventions
INSERT INTO org_journey_matches (step_id, match_type, match_name, match_detail, confidence) VALUES
('s1000000-0000-0000-0000-000000000013', 'alma_intervention', 'Cultural Connection Programs',
 'Strong evidence across 23 programs nationally. Cultural connection reduces reoffending by 35-60% for Indigenous youth (ALMA evidence level: High).',
 0.9),

-- Skills & Safety → Wraparound Support
('s1000000-0000-0000-0000-000000000012', 'alma_intervention', 'Wraparound Support Services',
 'Holistic, coordinated support addressing multiple needs simultaneously. 47 programs nationally with positive outcomes (ALMA evidence level: Moderate-High).',
 0.85),

-- Centre Arrival → Community-Led Diversion
('s1000000-0000-0000-0000-000000000011', 'alma_intervention', 'Community-Led Diversion',
 'Diversion from formal justice system into community-based alternatives. Evidence shows 40-50% reduction in recidivism when culturally appropriate (ALMA).',
 0.8),

-- NDIS step → Disability-informed practice
('s1000000-0000-0000-0000-000000000014', 'alma_intervention', 'Disability-Informed Justice Practice',
 'Recognition and response to disability (including FASD) in justice-involved young people. Emerging evidence for better outcomes through assessment and support.',
 0.7),

-- Youth Detention → cost data
('s1000000-0000-0000-0000-000000000004', 'funding', 'Youth Detention Cost',
 'QLD youth detention costs ~$1,500/day per young person ($547K/year). Community-based alternatives cost 10-20% of this. Current spend: $143M/year across QLD.',
 0.95),

-- Community Healing → Prevention evidence
('s1000000-0000-0000-0000-000000000015', 'alma_intervention', 'Community-Led Prevention',
 'Place-based prevention programs led by community. Strongest evidence when combined with cultural connection and Elder authority (ALMA evidence level: Moderate).',
 0.75);

COMMIT;
