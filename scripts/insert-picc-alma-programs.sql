-- Insert PICC programs into ALMA (Australian Living Map of Alternatives)
-- Palm Island Community Company Limited — ABN 14640793728
-- gs_entity_id: 18fc2705-463c-4b27-8dbd-0ca79c640582

-- 1. Young Offender Support Service (youth justice diversion + reintegration)
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Young Offender Support Service',
  'Diversion',
  'Community-controlled youth justice support service on Palm Island. Provides culturally grounded diversion, reintegration support, and wraparound case management for young people in or at risk of entering the justice system. Grown from $113K (2021-22) to $340K (2024-25) — 3x growth reflecting demand and effectiveness. Delivered by 80%+ Indigenous staff with Elder mentorship.',
  ARRAY['Indigenous youth', '10-25 years', 'Palm Island'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  true, 4, 'Established',
  ARRAY['youth-justice', 'indigenous', 'diversion', 'community-led'],
  'CivicGraph justice_funding data + PICC REAL Innovation Fund EOI 2026'
);

-- 2. Making Decisions in Our Way (delegated authority / self-determination)
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Making Decisions in Our Way',
  'Community-Led',
  'Delegated authority program enabling Palm Island community to make its own decisions about child protection, family support, and youth justice pathways. Community members and Elders participate in case conferencing and decision-making traditionally held by government. Funded at $211K/year. A practical expression of self-determination in child and family services.',
  ARRAY['Aboriginal families', 'Children and young people', 'Palm Island community'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  true, 5, 'Established',
  ARRAY['child-protection', 'indigenous', 'community-led', 'family-services'],
  'CivicGraph justice_funding data + PICC program documentation'
);

-- 3. Child Protection Placement Services (kinship care)
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Child Protection Placement Services',
  'Family Strengthening',
  'Community-controlled child protection placement service managing kinship and foster care placements on Palm Island. Over $1M/year in funding. Keeps Aboriginal children connected to family, culture, and Country through community-managed placements rather than state-directed removal. CEO Rachel Atkinson''s leadership has reduced the number of children removed from families on Palm Island.',
  ARRAY['Aboriginal children', 'Kinship carers', 'Palm Island families'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  false, 10, 'Established',
  ARRAY['child-protection', 'indigenous', 'family-services', 'community-led'],
  'CivicGraph justice_funding data + PICC annual reports'
);

-- 4. DFV (Domestic and Family Violence) Services
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Domestic and Family Violence Services',
  'Wraparound Support',
  'Integrated DFV response on Palm Island including crisis support, case management, court support, and culturally grounded healing. $900K+/year across 20 grants in legal services/DFV sector. DVO breach rate on Palm Island is 7.5x Townsville''s (1,980 vs 262 per 100K) — demonstrating critical need. Services delivered by local Indigenous staff with deep community relationships.',
  ARRAY['Women and children', 'DFV survivors', 'Palm Island community'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  false, 12, 'Established',
  ARRAY['indigenous', 'family-services', 'wraparound', 'prevention'],
  'CivicGraph justice_funding data + QLD crime statistics'
);

-- 5. Elders Program & Cultural Knowledge Preservation
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Elders Program and Cultural Knowledge',
  'Cultural Connection',
  'Intergenerational knowledge transfer program connecting Elders with young people through storytelling, Manbarra language preservation, photography, film, and cultural activities. 18 years of community storytelling archived — 34 recorded interviews with 2,000+ segments, photo collections, Elder knowledge projects. Integrated into Palm Island Community Repository with Indigenous Data Sovereignty protocols. Elders mentor young people through purposeful work, not clinical intervention.',
  ARRAY['Indigenous youth', 'Elders', 'Palm Island community'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021, Manbarra Traditional Owners)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  true, 18, 'Established',
  ARRAY['indigenous', 'community-led', 'prevention', 'youth-justice'],
  'Palm Island Community Repository + PICC program documentation'
);

-- 6. Station Precinct Employment Pathways (new — REAL Innovation Fund)
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Station Precinct Employment Pathways',
  'Education/Employment',
  'Community-owned employment pathways precinct in Townsville (30-year lease) with four streams: (1) Goods manufacturing — recycled-plastic bed bases and washing machine refurbishment, (2) Hospitality & cultural enterprise via commercial kitchen, (3) On-Country construction — modular tiny homes and infrastructure, (4) Cross-community exchange with Oonchiumpa (Central Australia) and Brodie Germaine Fitness Aboriginal Corporation (Mt Isa/Lower Gulf). Target: 60-80 participants over 4 years through justice reintegration into manufacturing, hospitality, and construction careers. REAL Innovation Fund EOI submitted March 2026 for $1.2M.',
  ARRAY['First Nations people 16+', 'Justice-involved youth', 'Palm Island and Townsville'],
  ARRAY['QLD', 'Townsville', 'Palm Island', 'Very Remote', 'Regional'],
  'Untested (theory/pilot stage)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021, consortium with A Curious Tractor)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  true, 0, 'Pilot/seed',
  ARRAY['youth-justice', 'indigenous', 'diversion', 'community-led', 'prevention'],
  'PICC REAL Innovation Fund EOI March 2026 + PICC Station Site Plan'
);

-- 7. NIAA Safety and Wellbeing (health + community safety)
INSERT INTO alma_interventions (
  name, type, description, target_cohort, geography, evidence_level,
  cultural_authority, operating_organization, gs_entity_id,
  serves_youth_justice, years_operating, current_funding,
  topics, data_provenance
) VALUES (
  'PICC Safety and Wellbeing Program (NIAA 1.3)',
  'Wraparound Support',
  'PICC''s largest single program — $4.8M NIAA 1.3 Safety and Wellbeing contract (2024-25). Integrated primary health, community safety, and wellbeing services through Palm Island Aboriginal Medical Service. 2,283 health clients, 17,488 service episodes per year. Combines health service delivery with community safety initiatives addressing Palm Island''s assault rate (7.2x Townsville). 197 staff (80%+ Indigenous) delivering holistic community wellbeing.',
  ARRAY['Palm Island community', 'All ages', 'Aboriginal and Torres Strait Islander'],
  ARRAY['QLD', 'Palm Island', 'Very Remote'],
  'Promising (community-endorsed, emerging evidence)',
  'Palm Island Community Company - Aboriginal Community Controlled Organisation (100% community-controlled since 2021)',
  'Palm Island Community Company Limited',
  '18fc2705-463c-4b27-8dbd-0ca79c640582',
  false, 18, 'Established',
  ARRAY['indigenous', 'wraparound', 'community-led', 'prevention'],
  'CivicGraph justice_funding + austender_contracts data'
);
