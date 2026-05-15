-- Triage classification pass — 2026-05-15
-- Classify 52 unverified rows from /ops/grant-recommendations/triage
-- Sets opportunity_type + mirrors the API logic: open_grant → verified, others → placeholder

BEGIN;

-- ===== OPEN_GRANT (24 rows) =====
-- Snow Foundation (3) — score 63, $270K paid via Xero, allowlisted
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] open_grant: Snow Foundation active grant round, $270K paid history'
WHERE id IN (
  '9b9ad334-f860-4c18-bf47-30c7bbce6646', -- Grants for Organisations (Canberra)
  'a89d26d3-1ca9-45fb-8572-58f8c0f5b73a', -- Grants for Organisations (Sydney & NSW South Coast)
  'fa30d3f0-4501-4524-a3c8-ae8904023818'  -- Snow Entrepreneur Fellowships
);

-- Groote Eylandt Aboriginal Trust (5) — place-bound but open community trust
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] open_grant: GEAT community trust open applications, NT place-bound'
WHERE id IN (
  '2a501916-17d4-4cb4-a0af-4e5357a9f509', -- Culture Grants
  '422e60b6-391b-461f-bb66-71bf973392a7', -- Grants for Education Initiatives
  'c3fa3c5a-5567-4f30-bdb2-c241f8296ca0', -- Grants for Welfare Initiatives
  '8abdd818-7008-457c-b292-c6721c4f8635', -- Health Grants
  '2f8c189e-38bd-46f1-9e6a-2092113ef5f4'  -- Religion Grants
);

-- Government & council open rounds (5)
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] open_grant: govt/council open program with deadline or active round'
WHERE id IN (
  '4920c8a5-0254-44b2-8b26-dc9d2ab684cd', -- IAS Support for Community Sector Orgs (NIAA $190M)
  '3550625c-dc33-4370-8122-f79dcf44e9bc', -- Local Environmental Projects (Dept Climate Change)
  '87fb0909-583d-4062-af99-64485e6b415a', -- Transport Grant (NSW Dept Ed)
  'e3bc5f5f-e18c-4ac8-ba73-2a789c9113b1', -- Strategic Weeds Grant (Hunter region)
  '6da3ce9d-8e53-453d-a5cf-eac471ea0f02', -- Southern Tablelands Arts CASP 24/25
  'dedf9dfc-649c-491b-9c2f-c982e0af3ab2'  -- Environment Levy funding (Sunshine Coast)
);

-- Other org-eligible open rounds (10)
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] open_grant: open application for orgs'
WHERE id IN (
  '1ddf8b1a-1f14-4cf7-b565-ef5628f3486b', -- Strong Communities Grants (Ecstra)
  'a6969e8d-75db-46eb-b6de-6eb1ff3865eb', -- Stacks Australia (Digital Playhouse)
  '8e47da70-718c-4ec6-85e9-4295ce9b6c0f', -- Woolworths Junior Landcare
  '64b37bca-9dc9-4d0b-8ee7-fb7faed7f1fd', -- Fortescue Community Grants
  'ec7d9226-7abb-43b8-8342-1833a243227a', -- RAS Foundation Community Futures
  'a21fb603-c027-4e18-b0a1-bb2477eda93f', -- Grants4GoodHealth (Rural Doctors)
  '05bad5dc-987b-4508-80de-79ae6fb9603e', -- Church Activities (WCCT Cape York)
  'e1cf3e13-3eb0-49ff-a9ed-41d79b93c660', -- UBS Optimus Foundation Grants
  'e07a1a22-b5ac-4201-bca2-dbfa5015431c', -- Wedgetail Foundation (1 open round/year)
  '50242c33-296e-411a-9ff4-5aefb7e9e1c2'  -- PRF Fellowship Program 2026 (open round)
);

-- ===== INVITATION_ONLY (7 rows) =====
UPDATE alma_funding_opportunities SET
  opportunity_type = 'invitation_only',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] invitation_only: named-partnership or nomination-only'
WHERE id IN (
  '9862d048-2144-455d-ba3e-f0abad4b7e75', -- Money Mentor (Ecstra → CAP named partnership)
  '9bc492b4-f1b3-477a-a6c6-b038843c7efb', -- Super Consumers Capacity Funding (Ecstra named recipient)
  '025d4d8e-b573-4dae-91f2-e9125439f39c', -- SALHN Workforce Wellbeing (internal staff only)
  '12e8f751-8726-416a-8d34-a0cc6864a0f1', -- Cath Leary Award (nominations not generally accepted)
  '74b5ba01-be1d-4fc2-85e0-9a9f1dfba1d9', -- Crown Land managers (councils only, not orgs)
  'fb5477c5-e71c-431d-a2b0-d6d076a0abe3', -- PRF Fellows Program (the prior-recipients page, not active call)
  '261bd1b8-554b-47eb-969c-a73fbf08ce88'  -- PRF Program Related Investments (strategic/invited)
);

-- ===== AWARD (17 rows) — individual scholarships, fellowships, recognition =====
UPDATE alma_funding_opportunities SET
  opportunity_type = 'award',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] award: individual scholarship/fellowship/recognition, not org grant'
WHERE id IN (
  'a0e8eade-a472-4d4e-9120-d58419fb9b6f', -- Barpirdhila Grant (Adam Briggs — individual artists $4-7K)
  'c12e65ae-b76d-4d45-a1f3-cd59d9c1312f', -- Jiu-Hwa Lo Ngara Scholarship (Ascham)
  '3e123f5a-336d-4781-9b58-b9ba6aafcfd5', -- ACTF Development Funding (individual producers)
  'b2b78e74-dadb-4409-aa9d-97dd3d6adefe', -- Ballarat Indigenous Scholarships
  '090ccdf6-7d6f-4ab3-924b-f3307070cd9f', -- Caulfield W.S. Morcom Rural Boarding
  '9890dc8b-5c3f-4ea5-ab3c-7d2319db5452', -- Fulbright Future Postdoc (Kinghorn)
  '4d369e15-ea99-448d-91e9-5cd617c8a9fc', -- Minderoo Artist Fund (mid-career artists WA)
  'dcea1821-d082-42c8-bccc-8ad694bd4988', -- Moriarty Community Scholarships
  '4100b342-55c4-4e74-8982-37dbb0c5ebd9', -- RAS Foundation Rural Scholarships
  'e3cfef30-f68c-4891-a8d3-f83edb215eea', -- Selimiye Foundation Scholarship
  '1b7fc167-53fe-4628-a2b3-f635e96d1856', -- Arts Peace Award (Graham F. Smith)
  'ac1e7f57-db3c-429a-b76d-993f686309d9', -- Sidney Myer Creative Fellowships
  'a808d326-f199-483c-858b-46d2cf3cdc2c', -- Rio Tinto Thrive Scholarships (Pinnacle)
  'f918f587-6d19-4a5a-acfb-e8441ede240b', -- John Koowarta Reconciliation Law Scholarship
  'f9074dbd-b5ea-4984-880a-874837c1f5db', -- Emerging Artist Grants (Ian Potter)
  '93cd0891-b30f-4c6f-a390-93ccc1908c69', -- Domestic Violence Financial Grants (White Shadow → victims)
  '9b7d77bb-f5f9-41bd-be3a-d5c5ff1d6160'  -- Walkley Freelance Journalism Grants
);

-- ===== POLICY_FRAMEWORK (2 rows) =====
UPDATE alma_funding_opportunities SET
  opportunity_type = 'policy_framework',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] policy_framework: scheme/policy doc/dataset, not an applicable grant'
WHERE id IN (
  'de0b61fa-c4cf-46d7-9968-e39db7cd6d1b', -- ASIO Scheme (Attorney-General legal services scheme)
  '0c018209-6769-488c-bec8-0b595cfa42fb'  -- Temporary Work visa program (statistical dataset)
);

-- ===== PLACEHOLDER (2 rows) — test/seed data =====
UPDATE alma_funding_opportunities SET
  opportunity_type = 'placeholder',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = '[ben@benjamink.com.au triage 2026-05-15] placeholder: example.org test seed row'
WHERE id IN (
  '61d44ffc-26df-41b3-9b27-7e385e2f013c', -- Funding Smoke Promotion Opportunity
  '18625810-fb41-4647-a945-84df109ec839'  -- Funding Smoke Seed Opportunity
);

-- Verify the totals match before commit
SELECT opportunity_type, verification_status, COUNT(*)
FROM alma_funding_opportunities
GROUP BY opportunity_type, verification_status
ORDER BY 3 DESC;

COMMIT;
