-- Alice Springs Youth Services — ALMA Interventions + Grant Opportunity
-- Source: 7 government documents (Mapping Report 2022, Implementation Plan, YAP 2023-27, NT Youth Strategy 2023-33, Grant Guidelines 2024-25)
-- Date: 2026-03-22

BEGIN;

-- ============================================================
-- ALMA INTERVENTIONS: Alice Springs Youth Programs
-- These are the key government-funded programs identified in
-- the Alice Springs Youth Services Mapping Project (2022)
-- ============================================================

-- 1. Bush Adventure Therapy Program (DOH → Bushmob)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'Bush Adventure Therapy Program',
  'Therapeutic',
  'Early intervention program combining adventure and outdoor environments to achieve therapeutic outcomes for disadvantaged and disengaged young people. Uses bush settings and outdoor activities to support young people showing signs of heading towards a crisis point. Funded by NT Department of Health, delivered by Bushmob Aboriginal Corporation in Alice Springs.',
  'Promising (community-endorsed, emerging evidence)',
  'Shared (Aboriginal org delivery, government funded)',
  ARRAY['youth-6-18', 'at-risk-youth', 'disengaged-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  '952935d0-727d-4983-9125-dfa2c8535d8f',
  ARRAY['youth-justice', 'prevention', 'indigenous', 'diversion']
);

-- 2. Community Night and Youth Patrol Service (NIAA + CM&C)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Community Night and Youth Patrol Service - Alice Springs',
  'Prevention',
  'Joint NIAA and CM&C funded service that transports young people on the streets at night to a safe place. Provides safety and protection but limited positive change in participants beyond immediate safety. Operates during high-risk nighttime hours when services are scarce. Key reactive/safety service in Alice Springs youth ecosystem.',
  'Promising (community-endorsed, emerging evidence)',
  'Community (locally operated)',
  ARRAY['youth-6-18', 'at-risk-youth', 'street-present-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  ARRAY['youth-justice', 'child-protection', 'prevention']
);

-- 3. Community Youth Diversion Program (TFHC)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Community Youth Diversion Program - Alice Springs',
  'Diversion',
  'TFHC-funded 12-week structured program for youth who have already experienced a crisis point (contact with justice system). Includes support for alcohol and drug problems, health checks, and community service hours. Aims to prevent future reoffending and keep young people out of prison. Part of the reactive/through-care intervention spectrum.',
  'Promising (community-endorsed, emerging evidence)',
  'Government (NT TFHC administered)',
  ARRAY['youth-10-18', 'justice-involved-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  ARRAY['youth-justice', 'diversion']
);

-- 4. Building Self-Reliance through Strong Culture (NIAA)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Building Self-Reliance through Strong Culture',
  'Cultural Connection',
  'NIAA-funded prevention program that strengthens Arrernte culture by supporting Arrernte people to organise cultural activities prioritised by the community. Does not aim to address issues directly but builds self-reliance and strengthens connection to culture as protective factors. A pure prevention approach — engaging young people before any sign of crisis.',
  'Indigenous-led (culturally grounded, community authority)',
  'Indigenous-led (Arrernte cultural authority)',
  ARRAY['youth-6-18', 'arrernte-youth', 'families'],
  ARRAY['Alice Springs', 'Arrernte Country', 'Central Australia', 'NT'],
  ARRAY['indigenous', 'prevention']
);

-- 5. Trauma Informed Care Services (DOH)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Trauma Informed Care Services - Alice Springs',
  'Early Intervention',
  'NT Department of Health funded early intervention service working with young people who have been affected by trauma and are showing signs of heading towards a crisis point. Aims to prevent young people from slipping further into crisis. Part of the broader trauma-informed approach being embedded across Alice Springs youth services per the Mparntwe Youth Action Plan.',
  'Effective (strong evaluation, positive outcomes)',
  'Shared (clinical + cultural)',
  ARRAY['youth-6-18', 'trauma-affected-youth', 'families'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  ARRAY['child-protection', 'prevention', 'wraparound']
);

-- 6. ASYASS Youth Accommodation & Crisis Support
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'Alice Springs Youth Accommodation and Support Services',
  'Wraparound Support',
  'Crisis accommodation and support for young people who are homeless or at risk of homelessness in Alice Springs. Provides safe supported accommodation and case management. NT has 8.2% youth homelessness rate (14x the national average of 0.6%). ASYASS addresses the material basics gap identified in the Mparntwe Youth Action Plan Domain 2.',
  'Promising (community-endorsed, emerging evidence)',
  'Community (locally governed)',
  ARRAY['youth-12-18', 'homeless-youth', 'at-risk-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  '0bb4feb8-ec73-4029-a2f6-85955be6cb9b',
  ARRAY['child-protection', 'wraparound', 'youth-justice']
);

-- 7. Tangentyere Town Camp Youth Hubs
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'Tangentyere Town Camp Youth Hubs',
  'Prevention',
  'Tangentyere Council operates youth hubs in Alice Springs town camps, providing after-hours and holiday activities, safe spaces, and connection to services for young people. Addresses the critical gap identified in the Youth Services Mapping Project: most services operate during school hours in town centre, missing town camp youth who need localised, after-hours support.',
  'Indigenous-led (culturally grounded, community authority)',
  'Indigenous-led (Tangentyere Council)',
  ARRAY['youth-6-18', 'town-camp-youth', 'aboriginal-youth'],
  ARRAY['Alice Springs', 'Town Camps', 'Central Australia', 'NT'],
  '093ec48b-7d33-4363-9c82-6bc820117992',
  ARRAY['indigenous', 'prevention', 'community-led']
);

-- 8. Gap Youth and Community Centre Programs
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'Gap Youth and Community Centre Drop-In Programs',
  'Prevention',
  'Aboriginal community-controlled drop-in centre providing safe space, activities, and connection to services for young people in The Gap area of Alice Springs. Operates as a universal/prevention service — keeping young people engaged and connected. End-users from Gap Youth Centre were invited to provide feedback in the Youth Services Mapping workshops.',
  'Indigenous-led (culturally grounded, community authority)',
  'Indigenous-led (Aboriginal corporation)',
  ARRAY['youth-6-18', 'aboriginal-youth'],
  ARRAY['Alice Springs', 'The Gap', 'Central Australia', 'NT'],
  'abb29d4e-87ea-4eb8-8a26-7bfdb8539ff6',
  ARRAY['indigenous', 'prevention', 'community-led']
);

-- 9. Children's Ground Early Years and Whole-of-Community
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'Children''s Ground - Whole of Community Early Years',
  'Early Intervention',
  'Long-term (25-year) whole-of-community approach starting from pre-birth, working with families and communities to create the conditions for children to thrive. Operating in Alice Springs and East Arnhem. Represents the upstream end of the intervention spectrum — addressing root causes through community-led, culturally grounded, place-based work. Aligns with the Heckman Curve evidence that earliest years investment has highest ROI.',
  'Indigenous-led (culturally grounded, community authority)',
  'Indigenous-led (community-driven, 25-year commitment)',
  ARRAY['children-0-8', 'families', 'whole-community'],
  ARRAY['Alice Springs', 'Central Australia', 'NT', 'East Arnhem'],
  '2e611ad0-09a7-4010-95fb-232d6d30647d',
  ARRAY['indigenous', 'prevention', 'child-protection', 'family-services']
);

-- 10. NAAJA Youth Justice Advocacy
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'NAAJA Youth Justice Advocacy and Legal Services',
  'Diversion',
  'North Australian Aboriginal Justice Agency provides legal representation and advocacy for young people in the justice system across Central Australia. NAAJA participates in diversion, court support, and systemic advocacy. Key stakeholder in the Youth Services Mapping workshops and the Mparntwe Youth Action Plan development. 98% of children in NT youth detention are Aboriginal.',
  'Effective (strong evaluation, positive outcomes)',
  'Indigenous-led (Aboriginal legal service)',
  ARRAY['youth-10-18', 'justice-involved-youth', 'aboriginal-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  'f329e7cf-808f-4aca-8792-b5a829a56dbc',
  ARRAY['youth-justice', 'legal-services', 'diversion', 'indigenous']
);

-- 11. CASSE Safe Supportive Environment Programs
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (
  'CASSE Creating a Safe Supportive Environment',
  'Early Intervention',
  'CASSE works to create safe supportive environments for children and young people in Alice Springs, with programs addressing family violence, child protection, and wellbeing. Participated in Youth Services Mapping workshops. Focuses on early intervention to prevent escalation to crisis.',
  'Promising (community-endorsed, emerging evidence)',
  'Shared (community org, evidence-based)',
  ARRAY['children-0-18', 'families', 'at-risk-youth'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  'c0c3bb5c-a2a5-4199-9e3f-803b84282e1c',
  ARRAY['child-protection', 'family-services', 'prevention']
);

-- 12. Mparntwe/Alice Springs Youth Action Plan (the plan itself as a policy intervention)
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Mparntwe/Alice Springs Youth Action Plan 2023-2027',
  'Community-Led',
  'Place-based youth action plan developed by the Mparntwe/Alice Springs Local Action Group (government agencies, NGOs, service providers, community). Organised around 7 wellbeing domains aligned to ARACY Nest Framework: Being loved and safe, Having material basics, Being healthy, Learning, Participating, Culture and identity, Environment. Key enablers: child-centred, trauma-informed, culturally safe, restorative practice, self-referral, monitoring and evaluation. 35+ specific actions across domains.',
  'Promising (community-endorsed, emerging evidence)',
  'Shared (multi-stakeholder, locally governed)',
  ARRAY['youth-0-24', 'families', 'whole-community'],
  ARRAY['Alice Springs', 'Mparntwe', 'Central Australia', 'NT'],
  ARRAY['youth-justice', 'child-protection', 'prevention', 'indigenous', 'family-services', 'community-led']
);

-- 13. Alice Springs Youth Services Mapping & Reform Agenda
INSERT INTO alma_interventions (name, type, description, evidence_level, cultural_authority, target_cohort, geography, topics)
VALUES (
  'Alice Springs Youth Services Reform Agenda (6 Priority Reforms)',
  'Community-Led',
  'Six priority reforms from the 2022 Youth Services Mapping Project (CM&C + NIAA): 1) Data & Evaluation (outcomes not outputs), 2) Relational Contracting (longer-term, flexible, capacity-building), 3) Collaborative & Coordinated Approach (journey mapping, co-location, communities of practice), 4) Funding Transition (shift reactive→prevention), 5) Opening Hours & Location (after-hours, town camps, suburbs), 6) Discourse & Narrative (strength-based, positive). Represents the system-level change needed to support person-centred models like Oonchiumpa.',
  'Promising (community-endorsed, emerging evidence)',
  'Government (CM&C + NIAA led, community co-designed)',
  ARRAY['system-level', 'service-providers', 'government-agencies'],
  ARRAY['Alice Springs', 'Central Australia', 'NT'],
  ARRAY['youth-justice', 'child-protection', 'prevention', 'community-led']
);

-- ============================================================
-- GRANT OPPORTUNITY: Alice Springs Youth Activities Grant
-- ============================================================

INSERT INTO grant_opportunities (
  name, description, amount_min, amount_max,
  provider, program, source,
  categories, focus_areas, target_recipients,
  geography, grant_type, status
)
VALUES (
  'Alice Springs Youth Activities Grant 2025-26',
  'Annual NT Government grant funding after-hours and school holiday activities for young people aged 10-17 in Alice Springs. Part of TFHC Regional Youth Services Program. Supports accessible, free group activities that bring young people together, make connections to existing support services, and are youth-informed and safe. Favours applications aligned to Mparntwe Youth Action Plan goals and NT Youth Strategy 2023-2033 outcomes. Collaborations with other service providers encouraged. Contact: Regional Youth Programs Coordinator via GrantsNT.',
  1000,
  50000,
  'Department of Territory Families, Housing and Communities',
  'Regional Youth Services Program - Alice Springs Youth Activities',
  'NT Government - TFHC',
  ARRAY['youth-services', 'community-development', 'indigenous'],
  ARRAY['after-hours-activities', 'school-holiday-programs', 'youth-engagement', 'early-intervention', 'cultural-connection'],
  ARRAY['community-groups', 'local-government', 'NGOs', 'businesses', 'sole-traders'],
  'Alice Springs, NT',
  'project',
  'upcoming'
);

COMMIT;
