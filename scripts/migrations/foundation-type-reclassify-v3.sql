-- foundation-type-reclassify-v3.sql
-- Deep clean: pattern-based reclassification of remaining 689 grantmakers
-- No LLM needed — name patterns are highly predictive

BEGIN;

-- ═══════════════════════════════════════════════
-- 1. INTERNATIONAL AID (overseas development, humanitarian)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'international_aid'
WHERE type = 'grantmaker' AND (
  name ILIKE '%international%aid%'
  OR name ILIKE '%overseas aid%'
  OR name ILIKE '%islamic relief%'
  OR name ILIKE '%muslim aid%'
  OR name ILIKE '%tear australia%'
  OR name ILIKE '%act for peace%'
  OR name ILIKE '%actionaid%'
  OR name ILIKE '%wateraid%'
  OR name ILIKE '%room to read%'
  OR name ILIKE '%mercy ships%'
  OR name ILIKE '%cbm australia%'
  OR name ILIKE '%opportunity international%'
  OR name ILIKE '%global development group%'
  OR name ILIKE '%cambodian children%'
  OR name ILIKE '%childfund%'
  OR name ILIKE '%transform aid%'
  OR name ILIKE '%samaritan%purse%'
  OR name ILIKE '%barnabas fund%'
  OR name ILIKE '%open doors%'
  OR name ILIKE '%ijm australia%'
  OR name ILIKE '%international women%development%'
  OR name ILIKE '%action on poverty%'
  OR name ILIKE '%jesuit mission%'
  OR name ILIKE '%catholic mission%'
  OR name ILIKE '%caritas%'
  OR name ILIKE '%matw %'
  OR name ILIKE '%maa international%'
  OR name ILIKE '%sadaqa%'
  OR name ILIKE '%human appeal%'
  OR name ILIKE '%copticare%'
  OR name ILIKE '%global evergreening%'
  OR name ILIKE '%boundless earth%'
  OR name ILIKE '%amnesty international%'
  OR name ILIKE '%greenpeace%'
  OR name ILIKE '%oxfam%'
  OR name ILIKE '%habitat for humanity%'
  OR name ILIKE '%famine relief%'
  OR name ILIKE '%disaster relief%' AND name NOT ILIKE '%fire%'
  OR name ILIKE '%hadassah%'
  OR name ILIKE '%jewish national fund%'
);

-- ═══════════════════════════════════════════════
-- 2. HEALTH CHARITIES (disease-specific)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'health_charity'
WHERE type = 'grantmaker' AND (
  name ILIKE '%cancer council%'
  OR name ILIKE '%cancer institute%'
  OR name ILIKE '%leukaemia%'
  OR name ILIKE '%leukemia%'
  OR name ILIKE '%diabetes%'
  OR name ILIKE '%multiple sclerosis%'
  OR name ILIKE '%alzheimer%'
  OR name ILIKE '%dementia%'
  OR name ILIKE '%parkinson%'
  OR name ILIKE '%autism%'
  OR name ILIKE '%bone marrow%'
  OR name ILIKE '%kidney%'
  OR name ILIKE '%heart foundation%'
  OR name ILIKE '%asthma%'
  OR name ILIKE '%arthritis%'
  OR name ILIKE '%cystic fibrosis%'
  OR name ILIKE '%cerebral palsy%'
  OR name ILIKE '%muscular dystrophy%'
  OR name ILIKE '%stem cell%'
  OR name ILIKE '%breakthrough t1d%'
  OR name ILIKE '%redkite%'
  OR name ILIKE '%beyond blue%'
  OR name ILIKE '%lifeline%'
  OR name ILIKE '%headspace%'
  OR name ILIKE '%acon health%'
  OR name ILIKE '%mental health%'
  OR name ILIKE '%palliative care%'
  OR name ILIKE '%eye research%'
);

-- ═══════════════════════════════════════════════
-- 3. SERVICE DELIVERY (direct services to people)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND (
  name ILIKE '%anglicare%'
  OR name ILIKE '%catholiccare%'
  OR name ILIKE '%centacare%'
  OR name ILIKE '%uniting%care%'
  OR name ILIKE '%unitingcare%'
  OR name ILIKE '%mission australia%'
  OR name ILIKE '%salvation army%'
  OR name ILIKE '%sisters of st john%'
  OR name ILIKE '%daughters of charity%'
  OR name ILIKE '%homes for the aged%'
  OR name ILIKE '%retirement%'
  OR name ILIKE '%aged care%'
  OR name ILIKE '%disability%'
  OR name ILIKE '%living my way%'
  OR name ILIKE '%myhorizon%'
  OR name ILIKE '%integrated disability%'
  OR name ILIKE '%caspa services%'
  OR name ILIKE '%community health%' AND name NOT ILIKE '%aboriginal%'
  OR name ILIKE '%rural doctors%'
  OR name ILIKE '%rural workforce%'
  OR name ILIKE '%rural health%' AND name NOT ILIKE '%network%'
  OR name ILIKE '%carers australia%'
  OR name ILIKE '%relationships australia%'
  OR name ILIKE '%nextsense%'
  OR name ILIKE '%youturn%'
  OR name ILIKE '%playgroup%'
  OR name ILIKE '%it takes a village%'
  OR name ILIKE '%bfs children%'
  OR name ILIKE '%group training%'
  OR name ILIKE '%sgch sustainability%'
  OR name ILIKE '%serving our people%'
  OR name ILIKE '%wintringham%'
  OR name ILIKE '%north richmond community%'
  OR name ILIKE '%each limited%'
  OR name ILIKE '%social policy group%'
  OR name ILIKE '%police-citizens youth%'
  OR name ILIKE '%ssjg ministries%'
  OR name ILIKE '%givit%'
  OR name ILIKE '%indigo australasia%'
  OR name ILIKE '%national assistance fund%'
);

-- ═══════════════════════════════════════════════
-- 4. INDIGENOUS ORGANISATIONS
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'indigenous_organisation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%aboriginal land council%'
  OR name ILIKE '%aboriginal health council%'
  OR name ILIKE '%aboriginal community controlled%'
  OR name ILIKE '%indigenous business%'
  OR name ILIKE '%naccho%'
  OR name ILIKE '%gumala%'
  OR name ILIKE '%awabakal%'
  OR name ILIKE '%alfa (nt)%'
);

-- ═══════════════════════════════════════════════
-- 5. RESEARCH BODIES (CRCs, research infrastructure)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'research_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%crc %'
  OR name ILIKE '%crc for%'
  OR name ILIKE '%fabrication facility%'
  OR name ILIKE '%astronomy australia%'
  OR name ILIKE '%therapeutic innovation%'
  OR name ILIKE '%sax institute%'
  OR name ILIKE '%paediatrio%'
  OR name ILIKE '%national ict%'
  OR name ILIKE '%screenwest%'
  OR name ILIKE '%ramsay centre%'
);

-- ═══════════════════════════════════════════════
-- 6. ENVIRONMENTAL
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'environmental'
WHERE type = 'grantmaker' AND (
  name ILIKE '%landcare%'
  OR name ILIKE '%sea shepherd%'
  OR name ILIKE '%natural resource%'
  OR name ILIKE '%world animal protection%'
  OR name ILIKE '%reef and rainforest%'
  OR name ILIKE '%burnett mary%'
  OR name ILIKE '%conservation%'
  OR name ILIKE '%wildlife%'
  OR name ILIKE '%wetland%'
  OR name ILIKE '%bushland%'
);

-- ═══════════════════════════════════════════════
-- 7. EMERGENCY RELIEF
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'emergency_relief'
WHERE type = 'grantmaker' AND (
  name ILIKE '%fire service%' OR name ILIKE '%fire authority%'
  OR name ILIKE '%distress relief%'
  OR name ILIKE '%emergency relief%'
  OR name ILIKE '%emergency action%'
  OR name ILIKE '%gippsland emergency%'
  OR name ILIKE '%volunteer marine rescue%'
);

-- ═══════════════════════════════════════════════
-- 8. SPORT & RECREATION
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'sport_recreation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%surf life saving%'
  OR name ILIKE '%returned & services league%'
  OR name ILIKE '%rsl %'
  OR name ILIKE '%afl %'
  OR name ILIKE '%cricket%'
  OR name ILIKE '%football%' AND name NOT ILIKE '%foundation%'
  OR name ILIKE '%sport%' AND name NOT ILIKE '%foundation%'
);

-- ═══════════════════════════════════════════════
-- 9. ARTS & CULTURE
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'arts_culture'
WHERE type = 'grantmaker' AND (
  name ILIKE '%documentary%'
  OR name ILIKE '%arts %' AND name NOT ILIKE '%martial%'
  OR name ILIKE '%regional arts%'
  OR name ILIKE '%mcclelland arts%'
  OR name ILIKE '%slim dusty%'
  OR name ILIKE '%museum%'
  OR name ILIKE '%national australia day%'
);

-- ═══════════════════════════════════════════════
-- 10. PEAK BODIES
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'peak_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%queensland farmers%'
  OR name ILIKE '%rotary%'
  OR name ILIKE '%lions %' AND name NOT ILIKE '%foundation%'
  OR name ILIKE '%country women%'
  OR name ILIKE '%scouts%' OR name ILIKE '%scout association%'
  OR name ILIKE '%construction industry training%'
  OR name ILIKE '%older persons advocacy%'
  OR name ILIKE '%volunteers international%'
  OR name ILIKE '%partners for equity%'
  OR name ILIKE '%support act%'
);

-- ═══════════════════════════════════════════════
-- 11. RELIGIOUS (remaining faith-based non-service)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'religious_organisation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%watchtower%'
  OR name ILIKE '%iglesia ni cristo%'
  OR name ILIKE '%l.d.s.%'
  OR name ILIKE '%uca %fund%'
  OR name ILIKE '%diocesan%'
  OR name ILIKE '%cultural diversity network%'
  OR name ILIKE '%victory life%'
);

-- ═══════════════════════════════════════════════
-- 12. ANIMAL WELFARE
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'animal_welfare'
WHERE type = 'grantmaker' AND (
  name ILIKE '%rspca%'
  OR name ILIKE '%animal welfare%'
  OR name ILIKE '%animal rescue%'
);

-- ═══════════════════════════════════════════════
-- 13. PHNs missed earlier
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'primary_health_network'
WHERE type = 'grantmaker' AND (
  name ILIKE '%snphn%'
  OR name ILIKE '%primary care collaborative%'
  OR name ILIKE '%primary care network%'
);

-- ═══════════════════════════════════════════════
-- 14. EDUCATION (scholarship funds, training)
-- ═══════════════════════════════════════════════
UPDATE foundations SET type = 'education_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%piers k fowler scholarship%'
  OR name ILIKE '%training board%'
  OR name ILIKE '%training fund%'
  OR name ILIKE '%american australian association%'
);

-- Report final state
SELECT type, COUNT(*) FROM foundations GROUP BY type ORDER BY count DESC;

COMMIT;
