-- PRF Foundation Record Enrichment (Part 2 fix)
BEGIN;

UPDATE foundations SET
  endowment_size = 4000000000,
  investment_returns = 16.4,
  giving_ratio = 8.0,
  description = 'Australia''s largest private foundation. Purpose: break cycles of disadvantage. Founded by Paul Ramsay AO (1936-2014), who built Ramsay Health Care. Grant-making since 2016. $1.476B cumulative grants. 175+ partners across 356 funded organisations. Three outcomes: positive life paths for children/youth, connected communities, First Nations self-determination.',
  giving_history = '[{"year":"FY25","amount":320000000},{"year":"FY24","amount":149900000,"grants":153},{"year":"FY23","amount":180000000,"grants":246},{"year":"FY22","amount":124300000,"grants":116}]'::jsonb,
  giving_philosophy = 'Five strategic principles: Connect (bridge collaboration), Centre (prioritise lived experience), Partner (build trust, share power), Adapt (tailor support), Intersect (work across impact areas). >50% of FY25 distributions support First Nations-led organisations. Local funding increased from 12% to 24% since July 2024.',
  wealth_source = 'Paul Ramsay AO estate. Ramsay Health Care (global private hospital group). ~$3B bequest at time of death (2014).',
  target_recipients = ARRAY['Justice-involved youth and adults','First Nations communities','Families experiencing DFV','Early childhood (prenatal to school)','People with disabilities','Communities in remote/disadvantaged areas'],
  website = 'https://www.paulramsayfoundation.org.au',
  open_programs = '[{"name":"Just Futures","via":"Australian Communities Foundation","focus":"Justice-involved youth, parents in/post custody, First Nations"},{"name":"Strengthening Early Years","via":"Australian Communities Foundation","focus":"Families with children prenatal to school entry"},{"name":"PRF Fellowship","amount":"$250,000 over 18 months","cycle":"Annual, Oct-Nov applications"},{"name":"Specialist DFV Programs","amount":"$13.6M to 58 orgs","focus":"Domestic and family violence"}]'::jsonb,
  enrichment_source = 'oracle_web_research',
  enriched_at = NOW()
WHERE acnc_abn = '32623132472';

COMMIT;
