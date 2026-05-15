-- Seed 9 food-system / regenerative / rural Australian opportunities for ACT-HV.
-- Sourced 2026-05-15 by oracle research agent from FRRR, Sustainable Table,
-- Coca-Cola Australia Foundation, ACF/WELA Giving Circle, LMCF. Each row's
-- source_url is the verified funder page. Notes:
--   - Past-deadline rows (Rebuilding Futures R6, WELA, LMCF 2026) included so
--     they're discoverable by future re-opens. MV filters by deadline >= now()
--     so they won't surface as fits today.
--   - LMCF Greater Melbourne Foundation is geographically VIC-only — flagged
--     in description as out-of-geo for Witta but kept for completeness.
--   - Some amount / deadline fields left NULL where funder didn't publish.
--   - source_type = 'philanthropic' for foundations, 'foundation' otherwise.

INSERT INTO alma_funding_opportunities (
  funder_name, name, deadline, min_grant_amount, max_grant_amount,
  is_national, jurisdictions, eligible_org_types,
  requires_deductible_gift_recipient, focus_areas, keywords,
  source_url, application_url, description, status, source_type, scrape_source
) VALUES
(
  'Foundation for Rural & Regional Renewal (FRRR)',
  'Strengthening Rural Communities — Small & Vital (Round 30)',
  '2026-09-17',
  NULL, 10000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity','community_organisation','community_org','aboriginal_corporation','indigenous_charity'],
  false,
  ARRAY['rural community','community resilience','place-based','social infrastructure'],
  ARRAY['rural','regional','grassroots','community-led','small population','SRC'],
  'https://frrr.org.au/funding/src-small-vital/',
  'https://frrr.org.au/funding/src-small-vital/',
  'Small grants up to $10,000 for grassroots, community-led initiatives in remote, rural and regional communities (preference for populations under 15,000). Round 30 opens 25 June 2026, closes 17 September 2026.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Foundation for Rural & Regional Renewal (FRRR)',
  'Tackling Tough Times Together — Multi-year drought support',
  NULL,
  NULL, 150000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity','community_organisation','community_org','aboriginal_corporation'],
  false,
  ARRAY['drought resilience','rural community','climate adaptation','sustainable agriculture'],
  ARRAY['drought','rural','multi-year','EOI','community-led'],
  'https://frrr.org.au/funding/tackling-tough-times-together/',
  'https://frrr.org.au/funding/tackling-tough-times-together/',
  'Grants up to $150,000 over three years for drought-affected rural communities. Always-open Expression of Interest process, assessed quarterly. Applicants must speak with the TTTT team before applying.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Foundation for Rural & Regional Renewal (FRRR)',
  'Future Drought Fund Communities Program — Small Network Grants (Round 2)',
  '2026-06-30',
  NULL, 50000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT'],
  ARRAY['charity','community_organisation','community_org','aboriginal_corporation','collective','social_enterprise'],
  false,
  ARRAY['drought resilience','rural community','sustainable agriculture','climate adaptation','farming networks'],
  ARRAY['drought','networks','agriculture','farmers','FDF'],
  'https://frrr.org.au/funding/fdf-communities/small-network-grants',
  'https://frrr.org.au/funding/fdf-communities/small-network-grants',
  'Up to $50,000 per grant for agriculture-dependent communities to build, expand or diversify community-based networks supporting drought resilience. Round 2 opens 26 May 2026 and closes June 2026.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Foundation for Rural & Regional Renewal (FRRR)',
  'Disaster Resilient: Future Ready — Burnett Inland (QLD)',
  '2026-05-31',
  NULL, NULL,
  false,
  ARRAY['QLD'],
  ARRAY['charity','community_organisation','community_org','aboriginal_corporation'],
  false,
  ARRAY['climate adaptation','rural community','disaster resilience','community wellbeing'],
  ARRAY['Queensland','Burnett','resilience','place-based','rolling'],
  'https://frrr.org.au/funding/disaster-resilience-and-climate-solutions/disaster-resilient-future-ready/drfr-qld/',
  'https://frrr.org.au/funding/disaster-resilience-and-climate-solutions/disaster-resilient-future-ready/drfr-qld/',
  'Place-based grants for remote, rural and regional QLD communities in the Burnett region leading initiatives that improve wellbeing, preparedness and resilience. Rolling assessment, current round closes end of May 2026. NEEDS HUMAN VERIFICATION on grant amount cap and Sunshine Coast hinterland eligibility — Witta sits south of the Burnett region.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Foundation for Rural & Regional Renewal (FRRR)',
  'Rebuilding Futures (Suncorp partnership) — Round 6',
  '2026-04-16',
  NULL, 25000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity','community_organisation','community_org','aboriginal_corporation'],
  false,
  ARRAY['disaster recovery','climate adaptation','rural community','community resilience'],
  ARRAY['Suncorp','disaster','Cyclone Alfred','Queensland','recovery'],
  'https://frrr.org.au/funding/rebuilding-futures/',
  'https://frrr.org.au/funding/rebuilding-futures/',
  'Up to $25,000 for rural NFPs across two streams: Disaster Resilient Communities (national) and Disaster Recovery Support for QLD communities affected by Tropical Cyclone Alfred / Western QLD Trough. R6 closed 16 April 2026 — kept for forward-tracking Round 7 reopen.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Sustainable Table',
  'Sustainable Table Fund — Regenerative Food & Farming Map pipeline',
  NULL,
  NULL, NULL,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity','community_organisation','community_org','social_enterprise','collective','aboriginal_corporation','company'],
  false,
  ARRAY['regenerative agriculture','food systems','sustainable farming','biodiversity','First Nations land'],
  ARRAY['regenerative','food map','Sustainable Table','philanthropic capital'],
  'https://www.sustainabletable.org.au/fund',
  'https://regenerative.org.au/sustainable-table/',
  'Sustainable Table directs philanthropic capital to regenerators of Australia''s food and farming systems. Entry point is applying to the Australian Regenerative Food and Farming Map; funding decisions flow from map data. Rolling — no fixed deadline. NEEDS HUMAN VERIFICATION on grant size (publishes total pool $330K invested since 2018, not per-grant ceiling).',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Coca-Cola Australia Foundation',
  'Employee Connected Grants',
  NULL,
  5000, 25000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity'],
  true,
  ARRAY['community wellbeing','food security','community resilience'],
  ARRAY['DGR1','employee-endorsed','annual','community'],
  'https://www.coca-cola.com/au/en/social/coca-cola-australia-foundation',
  'https://www.coca-cola.com/au/en/sustainability/coca-cola-australia-foundation-faq',
  'One-off grants $5,000–$25,000 to DGR1 charities, nominated by a Coca-Cola Europacific Partners / Coca-Cola South Pacific employee with a deep volunteer/board connection. NEEDS HUMAN VERIFICATION — 2026 round dates not published; programme is annual and requires employee co-applicant.',
  'open', 'corporate', 'oracle-research-2026-05-15'
),
(
  'Australian Communities Foundation (WELA Giving Circle)',
  'WELA Giving Circle Grant Round',
  '2026-04-20',
  5000, 10000,
  true,
  ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'],
  ARRAY['charity','community_organisation','community_org','social_enterprise','collective'],
  false,
  ARRAY['climate action','environment','biodiversity','women-led','gender-diverse leadership'],
  ARRAY['WELA','giving circle','environment','women','gender-diverse'],
  'https://communityfoundation.org.au/grant-rounds/wela-grants-2025/',
  'https://givingcircle.wela.org.au/apply',
  'Grants of $5,000–$10,000 supporting women and/or gender-diverse people leading environment and climate action. Most recent round 8–20 April 2026. NEEDS HUMAN VERIFICATION on next round opening — fit only if a woman/gender-diverse lead drives The Harvest Witta project.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
),
(
  'Lord Mayor''s Charitable Foundation',
  'Greater Melbourne Foundation Funding Round 2027 (anticipated)',
  NULL,
  20000, 100000,
  false,
  ARRAY['VIC'],
  ARRAY['charity','community_organisation','community_org','social_enterprise'],
  true,
  ARRAY['sustainable food systems','climate resilience','environment'],
  ARRAY['Melbourne','foodbowl','sustainable food','climate'],
  'https://www.greatermelbournefoundation.org.au/apply-grant/grant-opportunities/2026-greater-melbourne-foundation-funding-round',
  'https://www.greatermelbournefoundation.org.au/apply-grant',
  'LMCF Greater Melbourne Foundation round funds $20K–$100K for sustainable food systems (Foodbowl), climate resilience, environment. NEEDS HUMAN VERIFICATION — 2026 EOI window closed; 2027 round opens early 2027. Geographic scope = Greater Melbourne, so The Harvest Witta (QLD Sunshine Coast hinterland) is OUT OF GEOGRAPHY — flag for exclusion unless project has explicit Melbourne foodbowl link.',
  'open', 'philanthropy', 'oracle-research-2026-05-15'
);

REFRESH MATERIALIZED VIEW act_grant_recommendations;
