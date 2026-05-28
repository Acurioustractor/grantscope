-- Seed current Queensland/community grant opportunities from a manually supplied list.
-- Idempotent by name/provider checks, with source_frontier rows for continued monitoring.

BEGIN;

WITH foundation_seed AS (
  SELECT *
  FROM (VALUES
    ('QCoal Foundation', 'corporate_foundation', 'https://qcoalfoundation.org/our-initiatives/community-grant-program/', 'Community grantmaker supporting liveability, health and education in regional and remote Queensland.', ARRAY['community','health','education','regional-liveability']::text[], ARRAY['AU-QLD','regional-qld','remote-qld']::text[], ARRAY['nfp','community_org']::text[], 'manual_qld_grants_seed_2026'),
    ('Women and Change', 'giving_circle', 'https://www.womenandchange.com.au/', 'Queensland giving circle funding charitable projects that help Queenslanders in need.', ARRAY['women','social-disadvantage','community','queensland']::text[], ARRAY['AU-QLD']::text[], ARRAY['dgr1','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('The John Villiers Trust', 'public_ancillary_fund', 'https://jvtrust.org.au/grants/', 'Queensland public ancillary fund supporting children and youth in rural, regional and remote Queensland.', ARRAY['children','youth','regional-development','first-nations','capacity-building']::text[], ARRAY['AU-QLD','rural-qld','regional-qld','remote-qld']::text[], ARRAY['dgr1','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('Lady Bowen Trust', 'trust', 'https://ladybowentrust.org.au/', 'Queensland trust providing flexible grants through eligible organisations for people experiencing or at risk of homelessness.', ARRAY['homelessness','housing','emergency-relief','queensland']::text[], ARRAY['AU-QLD']::text[], ARRAY['charity','community_org']::text[], 'manual_qld_grants_seed_2026'),
    ('Perpetual Philanthropic Services', 'trustee', 'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/', 'Trustee and philanthropic services provider running the IMPACT Philanthropy Application Program for not-for-profit organisations.', ARRAY['health','education','environment','social-wellbeing','arts','animal-welfare','capacity-building']::text[], ARRAY['AU-National']::text[], ARRAY['nfp','dgr1','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('Tim Fairfax Family Foundation', 'private_ancillary_fund', 'https://www.tfff.org.au/funding-strategy/', 'Family foundation supporting connected, resilient and futureproof rural, regional and remote communities in Queensland and the Northern Territory.', ARRAY['regional-development','resilience','leadership','arts','community']::text[], ARRAY['AU-QLD','AU-NT','regional-qld','remote-qld']::text[], ARRAY['dgr1','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('StreetSmart Australia', 'public_benevolent_institution', 'https://streetsmartaustralia.org/', 'National grassroots homelessness funder supporting small frontline organisations and local projects.', ARRAY['homelessness','housing','grassroots','emergency-relief','social-inclusion']::text[], ARRAY['AU-National']::text[], ARRAY['grassroots_org','charity','community_org']::text[], 'manual_qld_grants_seed_2026'),
    ('James Frizelle Charitable Foundation', 'private_foundation', 'https://jamesfrizelle.org.au/funding-enquiry/', 'Gold Coast connected charitable foundation accepting funding enquiries through open SmartyGrants rounds when available.', ARRAY['gold-coast','community','charity']::text[], ARRAY['Gold Coast','AU-QLD']::text[], ARRAY['charity','community_org']::text[], 'manual_qld_grants_seed_2026'),
    ('Gold Coast Community Fund', 'community_foundation', 'https://www.gccommunityfund.org/assistance/', 'Gold Coast community fund providing practical assistance to organisations, groups, individuals and families in hardship.', ARRAY['financial-hardship','emergency-relief','health','education','community']::text[], ARRAY['Gold Coast','AU-QLD']::text[], ARRAY['individual','family','community_org','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('Noosa Community Foundation', 'community_foundation', 'https://noosa.foundation/grants/', 'Noosa community foundation connecting donors with eligible DGR1 charities serving the Noosa region.', ARRAY['community','local-giving','dgr1','regional-philanthropy']::text[], ARRAY['Noosa','Sunshine Coast','AU-QLD']::text[], ARRAY['dgr1','charity']::text[], 'manual_qld_grants_seed_2026'),
    ('Buderim Foundation', 'community_foundation', 'https://www.buderimfoundation.org.au/grants-programs/', 'Sunshine Coast community foundation offering community grants and Thompson Charitable Fund grants.', ARRAY['community','youth','environment','arts','heritage','sport','financial-hardship']::text[], ARRAY['Buderim','Sunshine Coast','AU-QLD']::text[], ARRAY['nfp','dgr1','community_org']::text[], 'manual_qld_grants_seed_2026')
  ) AS f(name, type, website, description, thematic_focus, geographic_focus, target_recipients, enrichment_source)
),
inserted_foundations AS (
  INSERT INTO foundations (
    name, type, website, description, thematic_focus, geographic_focus, target_recipients,
    profile_confidence, enrichment_source, enriched_at, last_scraped_at, scraped_urls,
    metadata, created_at, updated_at
  )
  SELECT
    f.name, f.type, f.website, f.description, f.thematic_focus, f.geographic_focus, f.target_recipients,
    'medium', f.enrichment_source, now(), now(), ARRAY[f.website],
    jsonb_build_object('seeded_by', 'seed-qld-community-grant-opportunities-2026', 'source', 'manual verified public pages'),
    now(), now()
  FROM foundation_seed f
  WHERE NOT EXISTS (
    SELECT 1 FROM foundations existing WHERE lower(existing.name) = lower(f.name)
  )
  RETURNING id, name
),
foundation_lookup AS (
  SELECT id, name FROM inserted_foundations
  UNION
  SELECT id, name FROM foundations WHERE lower(name) IN (SELECT lower(name) FROM foundation_seed)
),
program_seed AS (
  SELECT *
  FROM (VALUES
    ('QCoal Foundation', 'QCoal Foundation Community Grant Program', 'https://qcoalfoundation.org/our-initiatives/community-grant-program/', 'Community Spirit Grants up to $2,000 and Community Growth Grants up to $15,000 for regional and remote Queensland community-led initiatives.', 0::numeric, 15000::numeric, '2026-08-31'::date, 'open', ARRAY['community','regional','health','education']::text[], 'Preference for not-for-profit organisations with DGR status; individuals are not funded.', 'Apply through the QCoal Foundation application link. Community Spirit closes 15 Jan, 30 Apr and 31 Aug; Community Growth closes 15 Jan annually.', 'grant', ARRAY['community','health','education','regional-liveability']::text[], ARRAY['regional-qld','remote-qld']::text[], ARRAY['https://qcoalfoundation.org/our-initiatives/community-grant-program/']::text[], 'online_application'),
    ('Women and Change', 'Women and Change 2026 Giving Circle Grant', 'https://www.womenandchange.com.au/', 'Queensland giving circle grant of up to $50,000 for eligible charitable organisations helping Queenslanders in need.', 50000::numeric, 50000::numeric, NULL::date, 'upcoming', ARRAY['giving-circle','queensland','social-disadvantage']::text[], 'Eligible charitable organisations with DGR status and projects focused on Queensland communities.', '2026 EOI opens 1 June 2026.', 'grant', ARRAY['women','social-disadvantage','community']::text[], ARRAY['AU-QLD']::text[], ARRAY['https://www.womenandchange.com.au/','https://www.womenandchange.com.au/grants/grant-faqs/']::text[], 'eoi'),
    ('The John Villiers Trust', 'The John Villiers Trust Funding', 'https://jvtrust.org.au/grants/apply-for-a-grant/', 'Single or multi-year grants for eligible charities creating long-term change for children and youth in rural, regional and remote Queensland.', NULL::numeric, NULL::numeric, NULL::date, 'open', ARRAY['children','youth','regional-qld','capacity-building']::text[], 'ACNC registered charity with DGR Item 1 status; Queensland rural, regional or remote benefit required.', 'Read guidelines and email an application request to the Trust.', 'grant', ARRAY['children','youth','regional-development','first-nations']::text[], ARRAY['rural-qld','regional-qld','remote-qld']::text[], ARRAY['https://jvtrust.org.au/grants/','https://jvtrust.org.au/grants/apply-for-a-grant/']::text[], 'eoi'),
    ('Lady Bowen Trust', 'Lady Bowen Trust Annual Grant Round', 'https://ladybowentrust.org.au/', 'Annual grants to eligible Queensland organisations assisting people experiencing or at risk of homelessness.', NULL::numeric, NULL::numeric, '2026-04-02'::date, 'closed', ARRAY['homelessness','housing','queensland']::text[], 'Eligible Queensland organisations supporting people experiencing or at risk of homelessness.', '2026 EOI deadline was 5pm 2 April 2026. Monitor for the next annual round.', 'grant', ARRAY['homelessness','housing','emergency-relief']::text[], ARRAY['AU-QLD']::text[], ARRAY['https://ladybowentrust.org.au/']::text[], 'eoi'),
    ('Perpetual Philanthropic Services', 'Perpetual IMPACT Philanthropy Application Program', 'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/', 'National IPAP program matching not-for-profit applications with philanthropic trusts and endowments managed by Perpetual.', 10000::numeric, 120000::numeric, '2025-12-05'::date, 'closed', ARRAY['philanthropy','capacity-building','national']::text[], 'Not-for-profit organisations with charitable purpose and required charity/DGR compliance for relevant trusts.', 'Annual IPAP applications generally run October to December. 2026 applications are closed; register for updates.', 'grant', ARRAY['health','education','environment','social-wellbeing','arts','animal-welfare']::text[], ARRAY['AU-National']::text[], ARRAY['https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/']::text[], 'online_application'),
    ('Tim Fairfax Family Foundation', 'Tim Fairfax Family Foundation Grants', 'https://www.tfff.org.au/funding-strategy/', 'Invitation-only funding for rural, regional and remote communities in Queensland and the Northern Territory across connectedness, resilience, futureproofing and leadership streams.', NULL::numeric, NULL::numeric, NULL::date, 'invitation_only', ARRAY['regional-development','resilience','leadership','qld','nt']::text[], 'ACNC registered and DGR Item 1 entities; unsolicited funding requests are not accepted.', 'Relationship-led. Introduce the organisation by email only where strategically aligned; applications are invitation only.', 'grant', ARRAY['regional-development','resilience','leadership','community']::text[], ARRAY['AU-QLD','AU-NT','regional-qld','remote-qld']::text[], ARRAY['https://www.tfff.org.au/funding-strategy/','https://www.tfff.org.au/contact/']::text[], 'invitation_only'),
    ('StreetSmart Australia', 'StreetSmart Australia Grassroots Homelessness Grants', 'https://streetsmartaustralia.org/', 'Responsive grassroots homelessness grants and campaign-funded support for small frontline organisations.', NULL::numeric, NULL::numeric, NULL::date, 'monitor', ARRAY['homelessness','grassroots','emergency-relief']::text[], 'Small grassroots organisations and projects supporting people experiencing or at risk of homelessness.', 'Monitor StreetSmart campaigns and ACF project listings for EOI/project submission routes.', 'grant', ARRAY['homelessness','housing','grassroots','emergency-relief']::text[], ARRAY['AU-National']::text[], ARRAY['https://streetsmartaustralia.org/','https://communityfoundation.org.au/organisation/streetsmart-australia/']::text[], 'monitor'),
    ('James Frizelle Charitable Foundation', 'James Frizelle Charitable Foundation Funding Enquiry', 'https://jamesfrizelle.org.au/funding-enquiry/', 'Funding enquiries for open James Frizelle Charitable Foundation SmartyGrants rounds.', NULL::numeric, NULL::numeric, NULL::date, 'monitor', ARRAY['gold-coast','community','charity']::text[], 'Applicants must fit the foundation funding criteria for open programs.', 'Use the foundation funding enquiry page and SmartyGrants portal when rounds are open.', 'grant', ARRAY['gold-coast','community','charity']::text[], ARRAY['Gold Coast','AU-QLD']::text[], ARRAY['https://jamesfrizelle.org.au/funding-enquiry/','https://jamesfrizelle.smartygrants.com.au/']::text[], 'online_application'),
    ('Gold Coast Community Fund', 'Gold Coast Community Fund Assistance', 'https://www.gccommunityfund.org/assistance/', 'Practical assistance and grants for Gold Coast organisations, groups, individuals and families experiencing genuine financial hardship.', NULL::numeric, NULL::numeric, NULL::date, 'open', ARRAY['gold-coast','financial-hardship','community']::text[], 'Gold Coast individuals, families, organisations and groups seeking assistance; group applicants should contact the manager before submitting.', 'Use the online forms or contact the manager for group applications.', 'grant', ARRAY['financial-hardship','emergency-relief','health','education']::text[], ARRAY['Gold Coast','AU-QLD']::text[], ARRAY['https://www.gccommunityfund.org/assistance/']::text[], 'online_application'),
    ('Noosa Community Foundation', 'Noosa Community Foundation Grants', 'https://noosa.foundation/grants/', 'Donor-guided and panel-based grants to DGR1 charities serving the Noosa region.', NULL::numeric, NULL::numeric, NULL::date, 'monitor', ARRAY['noosa','local-giving','dgr1']::text[], 'DGR1 charities serving the Noosa region.', 'NCF uses charity panels and invitation-style donor matching; email to be added to relevant panels.', 'grant', ARRAY['community','local-giving','dgr1']::text[], ARRAY['Noosa','Sunshine Coast','AU-QLD']::text[], ARRAY['https://noosa.foundation/grants/','https://noosa.foundation/grant-rules/']::text[], 'relationship_based'),
    ('Buderim Foundation', 'Buderim Foundation Community Grants', 'https://www.buderimfoundation.org.au/community-fund-grants/', 'Community grants up to $15,000 for not-for-profit organisations with projects benefitting residents in the Buderim Region.', 0::numeric, 15000::numeric, NULL::date, 'upcoming', ARRAY['buderim','sunshine-coast','community']::text[], 'Not-for-profit community organisations with projects directly benefiting residents in the Buderim Region.', '2026 Community Grant applications open 20 May. Thompson Charitable Fund grants are always open for eligible DGR organisations supporting people in necessitous circumstances across the Sunshine Coast.', 'grant', ARRAY['community','youth','environment','arts','heritage','sport']::text[], ARRAY['Buderim','Sunshine Coast','AU-QLD']::text[], ARRAY['https://www.buderimfoundation.org.au/grants-programs/','https://www.buderimfoundation.org.au/community-fund-grants/']::text[], 'online_application')
  ) AS p(foundation_name, name, url, description, amount_min, amount_max, deadline, status, categories, eligibility, application_process, program_type, thematic_focus, place_focus, source_urls, application_mode)
),
inserted_programs AS (
  INSERT INTO foundation_programs (
    foundation_id, name, url, description, amount_min, amount_max, deadline, status,
    categories, eligibility, application_process, program_type, metadata, thematic_focus,
    place_focus, source_urls, application_mode, scraped_at, created_at
  )
  SELECT
    fl.id, p.name, p.url, p.description, p.amount_min, p.amount_max, p.deadline, p.status,
    p.categories, p.eligibility, p.application_process, p.program_type,
    jsonb_build_object('seeded_by', 'seed-qld-community-grant-opportunities-2026', 'manual_status', p.status),
    p.thematic_focus, p.place_focus, p.source_urls, p.application_mode, now(), now()
  FROM program_seed p
  JOIN foundation_lookup fl ON lower(fl.name) = lower(p.foundation_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM foundation_programs existing
    WHERE existing.foundation_id = fl.id
      AND lower(existing.name) = lower(p.name)
  )
  RETURNING id, foundation_id, name
),
program_lookup AS (
  SELECT ip.id, ip.foundation_id, ip.name FROM inserted_programs ip
  UNION
  SELECT fp.id, fp.foundation_id, fp.name
  FROM foundation_programs fp
  JOIN foundation_lookup fl ON fl.id = fp.foundation_id
  WHERE lower(fp.name) IN (SELECT lower(name) FROM program_seed)
),
grant_seed AS (
  SELECT *
  FROM (VALUES
    ('Gambling Community Benefit Fund', 'Queensland Department of Justice', 'Gambling Community Benefit Fund', 'Queensland''s largest one-off community grants program for not-for-profit community groups. Round 126 is closed; the next round is expected early in the second half of 2026 after a new online grants system is live.', 0, 35000, NULL::date, NULL::date, 'upcoming', 'upcoming', 'discovered', 'https://www.justice.qld.gov.au/initiatives/community-grants', ARRAY['community','qld','government']::text[], ARRAY['community-services','facilities','equipment','training','events']::text[], ARRAY['nfp','community_org']::text[], 'Queensland', 'government_grant', 8, 7, NULL),
    ('Lord Mayor''s Better Suburbs Grants - Community Support Category', 'Brisbane City Council', 'Lord Mayor''s Better Suburbs Grants', 'Funds projects responding to local community needs, improving community facilities and building organisational capacity for incorporated not-for-profit organisations in Brisbane.', 0, 10000, '2026-05-11'::date, '2026-05-11'::date, 'open', 'open', 'researching', 'https://www.brisbane.qld.gov.au/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/community-grants', ARRAY['community','brisbane','council']::text[], ARRAY['community-facilities','capacity-building','equipment','local-needs']::text[], ARRAY['nfp','auspiced_group']::text[], 'Brisbane, QLD', 'council_grant', 8, 7, NULL),
    ('Qantas Regional Grants 2026', 'Qantas Group', 'Qantas Regional Grants', 'National regional grants program providing a share of $2 million in cash, flights and marketing support to Australian-based regional communities, organisations, projects and individuals.', 0, NULL, '2026-05-10'::date, '2026-05-10'::date, 'open', 'open', 'researching', 'https://www.qantas.com/gb/en/about-us/our-company/in-the-community/qantas-regional-grants.html', ARRAY['regional','corporate','community']::text[], ARRAY['regional-communities','socioeconomic-impact','marketing-support','travel-support']::text[], ARRAY['nfp','community_org','individual','project']::text[], 'Regional Australia', 'corporate_grant', 8, 7, NULL),
    ('City of Gold Coast 2025/26 Community Projects Program', 'City of Gold Coast', 'Community Projects Program', 'Rolling non-competitive program supporting community projects that deliver benefit to the Gold Coast community.', 0, 25000, '2026-05-30'::date, '2026-05-30'::date, 'open', 'open', 'researching', 'https://goldcoast.smartygrants.com.au/2526communityprojectsprogram', ARRAY['gold-coast','community','council']::text[], ARRAY['community-services','community-activation','equipment','minor-capital-works']::text[], ARRAY['community_org','nfp']::text[], 'Gold Coast, QLD', 'council_grant', 8, 7, NULL)
  ) AS g(name, provider, program, description, amount_min, amount_max, deadline, closes_at, application_status, status, pipeline_stage, url, categories, focus_areas, target_recipients, geography, grant_type, relevance_score, fit_score, foundation_name)
),
foundation_grants AS (
  SELECT
    ps.name,
    fs.name AS provider,
    ps.name AS program,
    ps.description,
    ps.amount_min::integer AS amount_min,
    ps.amount_max::integer AS amount_max,
    ps.deadline,
    ps.deadline AS closes_at,
    CASE WHEN ps.status = 'invitation_only' THEN 'invitation_only' ELSE ps.status END AS application_status,
    ps.status,
    CASE
      WHEN ps.status = 'open' THEN 'researching'
      WHEN ps.status = 'upcoming' THEN 'discovered'
      WHEN ps.status = 'closed' THEN 'archived'
      WHEN ps.status = 'invitation_only' THEN 'researching'
      ELSE 'discovered'
    END AS pipeline_stage,
    ps.url,
    ps.categories,
    ps.thematic_focus AS focus_areas,
    fs.target_recipients,
    array_to_string(ps.place_focus, ', ') AS geography,
    'foundation_grant' AS grant_type,
    8 AS relevance_score,
    7 AS fit_score,
    fs.name AS foundation_name
  FROM program_seed ps
  JOIN foundation_seed fs ON fs.name = ps.foundation_name
),
all_grants AS (
  SELECT * FROM grant_seed
  UNION ALL
  SELECT * FROM foundation_grants
),
inserted_grants AS (
  INSERT INTO grant_opportunities (
    id, name, description, amount_min, amount_max, deadline, closes_at,
    source, provider, program, relevance_score, application_status, status, pipeline_stage,
    url, requirements, metadata, categories, focus_areas, fit_score, discovered_by,
    discovery_method, last_verified_at, grant_type, target_recipients, program_type,
    geography, foundation_id, sources, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), g.name, g.description, g.amount_min, g.amount_max, g.deadline, g.closes_at,
    'manual_qld_grants_seed_2026', g.provider, g.program, g.relevance_score, g.application_status, g.status, g.pipeline_stage,
    g.url, 'Verify eligibility and round status on the source page before applying.',
    jsonb_build_object(
      'seeded_by', 'seed-qld-community-grant-opportunities-2026',
      'manual_user_supplied', true,
      'verified_on', current_date,
      'monitoring_note', 'Seeded from current public source pages and user supplied funder list.'
    ),
    g.categories, g.focus_areas, g.fit_score, 'manual', 'manual_verified_public_pages',
    now(), g.grant_type, g.target_recipients, 'grant', g.geography, fl.id,
    jsonb_build_array(jsonb_build_object('url', g.url, 'label', g.provider, 'verified_on', current_date)),
    now(), now()
  FROM all_grants g
  LEFT JOIN foundation_lookup fl ON lower(fl.name) = lower(g.foundation_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM grant_opportunities existing
    WHERE (
      lower(existing.name) = lower(g.name)
      AND lower(coalesce(existing.provider, '')) = lower(coalesce(g.provider, ''))
    )
    OR existing.url = g.url
  )
  RETURNING id, name
),
frontier_seed AS (
  SELECT *
  FROM (VALUES
    ('grant-source:qld:gcbf', 'Gambling Community Benefit Fund', 'https://www.justice.qld.gov.au/initiatives/community-grants', 'justice.qld.gov.au', 'qld-gcbf-round-monitor', 'manual-qld-grant-list', 9, 24, ARRAY['qld','government','community','round-monitor']::text[]),
    ('grant-source:qld:gcbf-how-to-apply', 'GCBF how to apply', 'https://www.justice.qld.gov.au/initiatives/community-grants/how-to-apply', 'justice.qld.gov.au', 'qld-gcbf-application-monitor', 'manual-qld-grant-list', 8, 24, ARRAY['qld','government','application-system']::text[]),
    ('grant-source:bcc:community-grants', 'Brisbane City Council community grants', 'https://www.brisbane.qld.gov.au/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/community-grants', 'brisbane.qld.gov.au', 'council-community-grants-monitor', 'manual-qld-grant-list', 8, 48, ARRAY['brisbane','council','community']::text[]),
    ('grant-source:qcoal:community-grants', 'QCoal Foundation Community Grant Program', 'https://qcoalfoundation.org/our-initiatives/community-grant-program/', 'qcoalfoundation.org', 'foundation-program-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['foundation','qld','regional']::text[]),
    ('grant-source:qantas:regional-grants', 'Qantas Regional Grants', 'https://www.qantas.com/gb/en/about-us/our-company/in-the-community/qantas-regional-grants.html', 'qantas.com', 'corporate-regional-grants-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['corporate','regional','national']::text[]),
    ('grant-source:women-and-change', 'Women and Change grants', 'https://www.womenandchange.com.au/', 'womenandchange.com.au', 'giving-circle-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['foundation','giving-circle','qld']::text[]),
    ('grant-source:jvt:grants', 'The John Villiers Trust grants', 'https://jvtrust.org.au/grants/', 'jvtrust.org.au', 'foundation-program-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['foundation','regional-qld','children-youth']::text[]),
    ('grant-source:lady-bowen-trust', 'Lady Bowen Trust grants', 'https://ladybowentrust.org.au/', 'ladybowentrust.org.au', 'foundation-program-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['foundation','homelessness','qld']::text[]),
    ('grant-source:perpetual:impact-funding', 'Perpetual IMPACT philanthropy funding', 'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/', 'perpetual.com.au', 'foundation-program-monitor', 'manual-qld-grant-list', 7, 168, ARRAY['philanthropy','national','annual']::text[]),
    ('grant-source:tfff:funding-strategy', 'Tim Fairfax Family Foundation funding strategy', 'https://www.tfff.org.au/funding-strategy/', 'tfff.org.au', 'relationship-funder-monitor', 'manual-qld-grant-list', 7, 168, ARRAY['foundation','invitation-only','regional-qld']::text[]),
    ('grant-source:streetsmart:home', 'StreetSmart Australia', 'https://streetsmartaustralia.org/', 'streetsmartaustralia.org', 'grassroots-homelessness-monitor', 'manual-qld-grant-list', 7, 168, ARRAY['homelessness','grassroots','national']::text[]),
    ('grant-source:james-frizelle:funding', 'James Frizelle Charitable Foundation funding enquiry', 'https://jamesfrizelle.org.au/funding-enquiry/', 'jamesfrizelle.org.au', 'foundation-program-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['foundation','gold-coast']::text[]),
    ('grant-source:james-frizelle:smartygrants', 'James Frizelle SmartyGrants portal', 'https://jamesfrizelle.smartygrants.com.au/', 'jamesfrizelle.smartygrants.com.au', 'smartygrants-portal-monitor', 'manual-qld-grant-list', 8, 24, ARRAY['foundation','gold-coast','smartygrants']::text[]),
    ('grant-source:gold-coast:smartygrants', 'City of Gold Coast SmartyGrants portal', 'https://goldcoast.smartygrants.com.au/', 'goldcoast.smartygrants.com.au', 'smartygrants-portal-monitor', 'manual-qld-grant-list', 9, 24, ARRAY['gold-coast','council','smartygrants']::text[]),
    ('grant-source:gold-coast:community-projects-2025-26', 'City of Gold Coast Community Projects Program', 'https://goldcoast.smartygrants.com.au/2526communityprojectsprogram', 'goldcoast.smartygrants.com.au', 'smartygrants-round-monitor', 'manual-qld-grant-list', 9, 24, ARRAY['gold-coast','council','community']::text[]),
    ('grant-source:gold-coast-community-fund:assistance', 'Gold Coast Community Fund assistance', 'https://www.gccommunityfund.org/assistance/', 'gccommunityfund.org', 'community-foundation-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['community-foundation','gold-coast','hardship']::text[]),
    ('grant-source:noosa-foundation:grants', 'Noosa Community Foundation grants', 'https://noosa.foundation/grants/', 'noosa.foundation', 'community-foundation-monitor', 'manual-qld-grant-list', 7, 168, ARRAY['community-foundation','noosa']::text[]),
    ('grant-source:noosa-council:community-grants', 'Noosa Council Community Grants', 'https://www.noosa.qld.gov.au/Community/Grants/Community-Grants', 'noosa.qld.gov.au', 'council-community-grants-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['noosa','council','sunshine-coast']::text[]),
    ('grant-source:buderim-foundation:grants', 'Buderim Foundation grants', 'https://www.buderimfoundation.org.au/grants-programs/', 'buderimfoundation.org.au', 'community-foundation-monitor', 'manual-qld-grant-list', 8, 72, ARRAY['community-foundation','buderim','sunshine-coast']::text[]),
    ('grant-source:community-grants-hub:open', 'Australian Community Grants Hub open grants', 'https://www.communitygrants.gov.au/', 'communitygrants.gov.au', 'national-grant-index-monitor', 'expansion-strategy', 8, 24, ARRAY['national','government','grant-index']::text[]),
    ('grant-source:funding-centre:smartysearch', 'Funding Centre SmartySearch public page', 'https://explore.fundingcentre.com.au/smartysearch', 'explore.fundingcentre.com.au', 'public-funding-finder-landing', 'expansion-strategy', 7, 168, ARRAY['grant-index','smartysearch','council-portals']::text[])
  ) AS s(source_key, source_name, target_url, domain, parser_hint, discovery_source, priority, cadence_hours, tags)
)
INSERT INTO source_frontier (
  source_key, source_kind, source_name, target_url, domain, parser_hint,
  owning_agent_id, discovery_source, cadence_hours, priority, enabled,
  change_detection, confidence, next_check_at, failure_count, metadata, updated_at
)
SELECT
  s.source_key, 'grant_source_page', s.source_name, s.target_url, s.domain, s.parser_hint,
  'grantscope-discovery', s.discovery_source, s.cadence_hours, s.priority, true,
  'html', 'seeded', now(), 0,
  jsonb_build_object(
    'seeded_by', 'seed-qld-community-grant-opportunities-2026',
    'seeded_at', now(),
    'source_policy', 'public pages only; no subscriber or login-gated scraping',
    'tags', s.tags
  ),
  now()
FROM frontier_seed s
ON CONFLICT (source_key) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  target_url = EXCLUDED.target_url,
  domain = EXCLUDED.domain,
  parser_hint = EXCLUDED.parser_hint,
  owning_agent_id = EXCLUDED.owning_agent_id,
  discovery_source = EXCLUDED.discovery_source,
  cadence_hours = EXCLUDED.cadence_hours,
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled,
  metadata = source_frontier.metadata || EXCLUDED.metadata,
  updated_at = now();

COMMIT;
