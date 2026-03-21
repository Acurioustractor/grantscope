-- foundation-type-reclassify-v5.sql
-- Final cleanup pass on remaining ~426 grantmakers

BEGIN;

-- Health charities
UPDATE foundations SET type = 'health_charity'
WHERE type = 'grantmaker' AND (
  name ILIKE '%motor neurone%'
  OR name ILIKE '%curecell%'
  OR name ILIKE '%kids% cancer%'
  OR name ILIKE '%guide dogs%'
  OR name ILIKE '%bone marrow%'
  OR name ILIKE '%women%health%'
  OR name ILIKE '%royal life saving%'
);

-- Environmental
UPDATE foundations SET type = 'environmental'
WHERE type = 'grantmaker' AND (
  name ILIKE '%catchment council%'
  OR name ILIKE '%wilderness society%'
  OR name ILIKE '%world wide fund%'
  OR name ILIKE '%wwf%'
  OR name ILIKE '%clean up australia%'
  OR name ILIKE '%forest and wood%'
  OR name ILIKE '%peel-harvey%'
);

-- International aid
UPDATE foundations SET type = 'international_aid'
WHERE type = 'grantmaker' AND (
  name ILIKE '%adara development%'
  OR name ILIKE '%hunger project%'
  OR name ILIKE '%hasene%'
  OR name ILIKE '%women%fund asia%'
  OR name ILIKE '%host international%'
  OR name ILIKE '%acc international mission%'
  OR name ILIKE '%watoto%'
  OR name ILIKE '%global interaction%'
  OR name ILIKE '%unitingworld%'
  OR name ILIKE '%magen david adom%'
  OR name ILIKE '%archbishop%overseas relief%'
  OR name ILIKE '%archbishop%anglican aid%'
  OR name ILIKE '%anglican board of mission%'
  OR name ILIKE '%action on poverty%'
  OR name ILIKE '%technion australia%'
  OR name ILIKE '%hebrew u %'
  OR name ILIKE '%coptic orphans%'
);

-- Religious
UPDATE foundations SET type = 'religious_organisation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%bible league%'
  OR name ILIKE '%kingdomcity%'
  OR name ILIKE '%joyce meyer ministries%'
  OR name ILIKE '%institute of the sisters%'
  OR name ILIKE '%charitable works fund%roman catholic%'
  OR name ILIKE '%country uc %'
  OR name ILIKE '%uniting ethical%'
);

-- Service delivery
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND (
  name ILIKE '%apprenticeships group%'
  OR name ILIKE '%aussie helpers%'
  OR name ILIKE '%rainbow gateway%'
  OR name ILIKE '%raising children%'
  OR name ILIKE '%mas national%'
  OR name ILIKE '%doxa community%'
  OR name ILIKE '%warrina homes%'
  OR name ILIKE '%st vincent de paul%housing%'
  OR name ILIKE '%foodbank%'
  OR name ILIKE '%creating links%'
  OR name ILIKE '%roseberry community%'
  OR name ILIKE '%job pathways%'
  OR name ILIKE '%cca new south wales%'
);

-- Research
UPDATE foundations SET type = 'research_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%royal society%'
  OR name ILIKE '%women%safety%'
  OR name ILIKE '%judith neilson institute%'
);

-- Peak bodies / industry
UPDATE foundations SET type = 'peak_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%co-operative bulk handling%'
  OR name ILIKE '%queensland farmers%'
  OR name ILIKE '%victoria police legacy%'
  OR name ILIKE '%returned and services league%'
);

-- Animal welfare
UPDATE foundations SET type = 'animal_welfare'
WHERE type = 'grantmaker' AND (
  name ILIKE '%animals australia%'
);

-- Arts
UPDATE foundations SET type = 'arts_culture'
WHERE type = 'grantmaker' AND (
  name ILIKE '%adelaide fringe%'
);

-- Indigenous
UPDATE foundations SET type = 'indigenous_organisation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%aboriginal%torres strait%health%'
  OR name ILIKE '%northern aboriginal%'
);

-- Philanthropic foundations (genuine grantmakers)
UPDATE foundations SET type = 'philanthropic_foundation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%estate of the late%'
  OR name ILIKE '%westpac buckland%'
  OR name ILIKE '%geelong grammar%building fund%'
);

-- Education
UPDATE foundations SET type = 'education_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%geelong grammar%'
);

-- Sport
UPDATE foundations SET type = 'sport_recreation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%royal life saving%'
);

SELECT COUNT(*) as remaining_grantmakers FROM foundations WHERE type = 'grantmaker';

COMMIT;
