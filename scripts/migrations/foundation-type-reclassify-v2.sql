-- foundation-type-reclassify-v2.sql
-- Second pass: reclassify remaining grantmakers that are clearly not foundations

BEGIN;

-- More PHNs (didn't match 'primary health' pattern)
UPDATE foundations SET type = 'primary_health_network'
WHERE type = 'grantmaker' AND acnc_abn IN (
  '55150102257', -- Partners 4 Health (Brisbane North PHN)
  '93153323436', -- Melbourne Primary Care Network (NWMPHN)
  '18154252132', -- Healthy North Coast
  '80099255106', -- Wentwest (Western Sydney PHN)
  '68603815818', -- EIS Health (Central & Eastern Sydney PHN)
  '27152430914'  -- SA Rural Health Network
);

-- Universities that didn't match (RMIT)
UPDATE foundations SET type = 'university'
WHERE type = 'grantmaker' AND acnc_abn = '49781030034'; -- RMIT

-- International aid / service delivery
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND acnc_abn IN (
  '28004778081', -- World Vision
  '50169561394', -- Australian Red Cross
  '49004875807', -- Plan International
  '46003380890', -- CARE Australia
  '79002885761', -- ChildFund Australia
  '35060581437', -- UNICEF Australia
  '35092843322', -- UNHCR Australia
  '50748098845', -- St Vincent de Paul Society
  '28000030179', -- The Smith Family
  '87093865840', -- Beyond Blue
  '74068758654', -- Medecins Sans Frontieres
  '67001692566', -- Compassion Australia
  '74438059643', -- Royal Flying Doctor Service
  '18068557906', -- Barnardos
  '13080037538', -- Job Futures
  '75071207094', -- United Israel Appeal
  '30423091789', -- Human Appeal International
  '81618261859', -- Older Persons Advocacy Network
  '35451745525', -- Alice Springs Youth Accommodation
  '69200106557', -- Ryde Family Support
  '82653149752'  -- Cloudless Sunrise Health
);

-- RSL / veteran services
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND name ILIKE '%returned & services league%';

-- Research infrastructure (not foundations)
UPDATE foundations SET type = 'research_body'
WHERE type = 'grantmaker' AND acnc_abn IN (
  '40125905599', -- Bioplatforms Australia
  '53608571277'  -- MTPConnect
);

SELECT type, COUNT(*) FROM foundations WHERE type IN ('grantmaker','service_delivery','primary_health_network','university','research_body') GROUP BY type ORDER BY count DESC;

COMMIT;
