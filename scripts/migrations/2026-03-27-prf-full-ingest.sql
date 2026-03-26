-- PRF Full Data Ingest — Executive Team, FNAC, Foundation Enrichment
-- Source: Oracle agent web research (2026-03-27)
-- PRF entity: 92edb50b-b111-45a8-b697-0354410b2d2d, ABN 32623132472

-- ============================================================
-- PART 1: EXECUTIVE TEAM + FNAC → person_roles
-- ============================================================
BEGIN;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, appointment_date, source, confidence)
VALUES ('Kristy Muir', 'ceo', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', '2022-08-01', 'web_research', 'verified')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence)
VALUES ('Chris Last', 'cfo', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Ben Gales', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "Chief Impact Officer"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Liz Yeo', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "Chief Alliances Officer"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Alex Martin', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "Chief of Staff"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Brian Graetz', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "General Manager, Health"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Ben Smith', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "Head of Impact Investing"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Suzie Warrick', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "Manager, National Communications"}')
ON CONFLICT DO NOTHING;

INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, source, confidence, properties)
VALUES ('Ian Trust', 'other', '623132472', 'Paul Ramsay Foundation Limited', '32623132472', '92edb50b-b111-45a8-b697-0354410b2d2d', 'web_research', 'verified', '{"title": "First Nations Advisory Council Member", "honours": "AO"}')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- PART 2: ENRICH FOUNDATIONS RECORD
-- ============================================================
BEGIN;

UPDATE foundations SET
  endowment_size = 4000000000,
  description = 'Australia''s largest private foundation. Purpose: break cycles of disadvantage. Founded by Paul Ramsay AO (1936-2014), who built Ramsay Health Care. Grant-making since 2016. $1.476B cumulative grants. 175+ partners across 356 funded organisations. Three outcomes: positive life paths for children/youth, connected communities, First Nations self-determination.',
  giving_history = '[{"year":"FY25","amount":320000000},{"year":"FY24","amount":149900000,"grants":153},{"year":"FY23","amount":180000000,"grants":246},{"year":"FY22","amount":124300000,"grants":116}]'::jsonb,
  giving_philosophy = 'Five strategic principles: Connect (bridge collaboration), Centre (prioritise lived experience), Partner (build trust, share power), Adapt (tailor support), Intersect (work across impact areas). >50% of FY25 distributions support First Nations-led organisations. Local funding increased from 12% to 24% since July 2024.',
  wealth_source = 'Paul Ramsay AO estate. Ramsay Health Care (global private hospital group). ~$3B bequest at time of death (2014).',
  target_recipients = ARRAY['Justice-involved youth and adults','First Nations communities','Families experiencing DFV','Early childhood (prenatal to school)','People with disabilities','Communities in remote/disadvantaged areas'],
  website = 'https://www.paulramsayfoundation.org.au',
  investment_returns = '16.4% of endowment in Endowment Impact Fund (ESG, negative screens, impact risk analysis)',
  open_programs = '[{"name":"Just Futures","via":"Australian Communities Foundation","focus":"Justice-involved youth, parents in/post custody, First Nations"},{"name":"Strengthening Early Years","via":"Australian Communities Foundation","focus":"Families with children prenatal to school entry"},{"name":"PRF Fellowship","amount":"$250,000 over 18 months","cycle":"Annual, Oct-Nov applications"},{"name":"Specialist DFV Programs","amount":"$13.6M to 58 orgs","focus":"Domestic and family violence"}]'::jsonb,
  enrichment_source = 'oracle_web_research',
  enriched_at = NOW()
WHERE acnc_abn = '32623132472';

COMMIT;

-- ============================================================
-- PART 3: BOARD MEMBER ENRICHMENT (update properties)
-- ============================================================
BEGIN;

UPDATE person_roles SET
  properties = '{"honours": "AM", "background": "Co-founder of Social Ventures Australia", "title": "Board Chair"}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'MICHAEL TRAILL';

UPDATE person_roles SET
  properties = '{"background": "Joined Ramsay Health Care 1969. Non-Exec Director 24 years, Deputy Chairman 2014-2021. Also Director at Ramsay Centre for Western Civilisation."}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'PETER EVANS'
  AND role_type = 'director';

UPDATE person_roles SET
  properties = '{"honours": "AM", "background": "Former CEO Goodstart Early Learning (2011-2023). Led transformation of Australia''s largest early learning provider."}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'JULIA DAVISON';

UPDATE person_roles SET
  properties = '{"background": "CEO of Siddle Family Office. Worked at PRF 2015-2021 leading portfolios in place-based initiatives and early childhood education. Replaced father Michael Siddle as founding Director."}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'CHARLOTTE SIDDLE';

UPDATE person_roles SET
  properties = '{"honours": "KNZM", "title": "Sir", "background": "Former Prime Minister of New Zealand (2016-2017). Former NZ Minister of Finance."}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'SIMON WILLIAM ENGLISH';

UPDATE person_roles SET
  properties = '{"background": "Former Deputy CEO Commonwealth Bank of Australia. Chair of TAL Life Limited, NED of Westpac.", "appointment_year": 2025}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'DAVID COHEN';

UPDATE person_roles SET
  properties = '{"background": "Kuku Yalanji woman from the Daintree Rainforest. CEO of Cape York Partnership. Degrees in Psychology and Law.", "additional_role": "Chair, First Nations Advisory Council"}'
WHERE entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
  AND person_name_normalised = 'NATALIE WALKER'
  AND role_type = 'director';

COMMIT;
