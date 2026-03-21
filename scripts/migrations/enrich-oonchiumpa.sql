BEGIN;

-- 1. ALMA Interventions (4)

INSERT INTO alma_interventions (id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (gen_random_uuid(), 'True Justice: Deep Listening on Country', 'Cultural Connection',
'On-country cultural healing program partnered with ANU (since 2022). Brings judges, law students, and community together for deep listening circles, cultural authority recognition, trauma-informed justice support, and community healing sessions at Atnarpa Homestead.',
'Indigenous-led (culturally grounded, community authority)',
'Arrernte Traditional Owners - Bloomfield and Liddle families, native title holders of Mparntwe',
ARRAY['youth-10-17', 'justice-involved', 'legal-professionals'],
ARRAY['Alice Springs', 'Central Australia', 'NT'],
'16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
ARRAY['youth-justice', 'indigenous', 'diversion', 'community-led']);

INSERT INTO alma_interventions (id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (gen_random_uuid(), 'Oonchiumpa Youth Mentorship & Cultural Healing', 'Wraparound Support',
'Culturally grounded ASR for at-risk Aboriginal youth aged 10-17. 21 young people, 90% retention, 95% school re-engagement. Cultural mentorship, on-country experiences, basketball/sports, youth leadership. Funded by NIAA.',
'Promising (community-endorsed, emerging evidence)',
'Arrernte Traditional Owners - cultural authority and community governance',
ARRAY['youth-10-17', 'at-risk', 'justice-involved'],
ARRAY['Alice Springs', 'Central Australia', 'NT'],
'16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
ARRAY['youth-justice', 'indigenous', 'prevention', 'wraparound', 'community-led']);

INSERT INTO alma_interventions (id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (gen_random_uuid(), 'Oonchiumpa Cultural Brokerage & Service Navigation', 'Community-Led',
'Service navigation across 7 language groups within 150km of Alice Springs. 32+ partners. Cultural interpretation, community advocacy, partnership facilitation, system navigation.',
'Indigenous-led (culturally grounded, community authority)',
'Arrernte, Western Arrernte, Luritja, Warlpiri, Pitjantjatjara, Alyawarre, Anmatyerre',
ARRAY['all-ages', 'families', 'community'],
ARRAY['Alice Springs', 'Central Australia', 'NT'],
'16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
ARRAY['indigenous', 'community-led', 'wraparound', 'family-services']);

INSERT INTO alma_interventions (id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, gs_entity_id, topics)
VALUES (gen_random_uuid(), 'Atnarpa Homestead On-Country Cultural Programs', 'Cultural Connection',
'On-country camps at Atnarpa Station. Traditional knowledge transmission, bush tucker/medicine, intergenerational connection. Restored homestead as cultural tourism and community hub. Youth camps, corporate cultural inductions, justice programs.',
'Untested (theory/pilot stage)',
'Bloomfield family Traditional Owners - custodians of Atnarpa/Loves Creek country',
ARRAY['youth-10-17', 'families', 'corporate', 'legal-professionals'],
ARRAY['Alice Springs', 'Atnarpa Station', 'Central Australia', 'NT'],
'16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
ARRAY['indigenous', 'community-led', 'prevention']);

-- 2. Person Roles (2)

INSERT INTO person_roles (id, person_name, person_name_normalised, role_type, company_name, company_abn, entity_id, source, confidence)
VALUES (gen_random_uuid(), 'Kristy Bloomfield', 'kristy bloomfield', 'director', 'Oonchiumpa Consultancy & Services', '53658668627', '16cadc21-083d-4d5e-8b9f-7dc6dca33b38', 'manual', 'verified');

INSERT INTO person_roles (id, person_name, person_name_normalised, role_type, company_name, company_abn, entity_id, source, confidence)
VALUES (gen_random_uuid(), 'Tanya Turner', 'tanya turner', 'director', 'Oonchiumpa Consultancy & Services', '53658668627', '16cadc21-083d-4d5e-8b9f-7dc6dca33b38', 'manual', 'verified');

-- 3. Justice Funding (1)

INSERT INTO justice_funding (id, recipient_name, recipient_abn, gs_entity_id, program_name, amount_dollars, state, financial_year, sector, topics)
VALUES (gen_random_uuid(), 'Oonchiumpa Consultancy & Services', '53658668627', '16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
'Alternative Service Response - NIAA', 117150, 'NT', '2021-2025', 'youth-justice',
ARRAY['youth-justice', 'indigenous', 'diversion', 'community-led']);

COMMIT;
