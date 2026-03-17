-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Lateral Revenue V2 — Missing commercial channels & cross-project synergies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Constraints verified:
--   org_pipeline.status: prospect|upcoming|drafting|submitted|awarded|rejected
--   org_contacts.contact_type: governance|funder|partner|supplier|political|community|advocacy
--   funder_type: no constraint (using commercial|corporate|foundation|government|partner)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. GOODS — Missing commercial/platform revenue streams
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Platform revenue models
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Marketplace Transaction Fees — Seller Listings',
   'Social enterprise sellers', 'commercial',
   '5-15% per transaction', NULL, 'prospect',
   'Core marketplace revenue: commission on each transaction. Social enterprises list products/services, buyers purchase through Goods. 5-15% transaction fee. At $1M GMV = $50-150K revenue. Scales with volume.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Procurement Compliance SaaS — Council & Agency Licences',
   'Local councils / state agencies', 'commercial',
   '$5-20K/yr per licence', NULL, 'prospect',
   'White-label procurement compliance tool for councils. Councils need to meet social procurement targets but have no way to find/verify social enterprises. Annual SaaS licence. 50 councils × $10K = $500K/yr. Pilot with Townsville City Council.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Impact Reporting Service — ESG Procurement Reports',
   'Corporate / government buyers', 'commercial',
   '$2-10K per report', NULL, 'prospect',
   'Buyers need to REPORT their social procurement spend for ESG/RAP/policy compliance. Goods generates verified impact reports: "You spent $X with Y social enterprises, creating Z jobs." Revenue = per-report or annual reporting subscription.'),

  -- Cross-project: Goods lists Farm + Harvest products
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Internal Supply Chain — Farm + Harvest Products on Goods',
   'ACT ecosystem', 'commercial',
   'Cross-project', NULL, 'prospect',
   'Farm gallery art, Harvest preserves/produce, PICC cultural products — all listed on Goods marketplace. Goods becomes the storefront for the entire ACT ecosystem. Each project is both a supplier AND a proof-of-concept for the platform.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. HARVEST — Missing channels: bush tucker, food hub, export
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Bush tucker / native foods (PICC cultural authority crossover)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Native Foods & Bush Tucker Product Line',
   'Harvest brand + PICC cultural authority', 'commercial',
   'Product line', NULL, 'prospect',
   'Native food products developed WITH PICC cultural authority — lemon myrtle, wattleseed, kakadu plum, Davidson plum, bush tomato. IP held by community. Revenue via premium native food products. Sold via Goods, markets, retail. $15-40/product.'),

  -- Food hub model
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'NQ Regenerative Food Hub — Aggregation & Distribution',
   'Multiple NQ farms', 'commercial',
   'Hub fees', NULL, 'prospect',
   'Aggregate produce from multiple regenerative farms across NQ — not just ACT''s farm. Harvest becomes the distribution hub: cold storage, logistics, orders. Revenue = aggregation margin (15-25%) + delivery fees. Like Open Food Network model.'),

  -- Hotel/tourism channel
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Hotel & Resort Supply — Reef Tourism Partners',
   'NQ hotels & resorts', 'commercial',
   'Wholesale contracts', NULL, 'prospect',
   'Supply hotels and resorts in Townsville, Magnetic Island, Mission Beach with regenerative produce. Reef tourism operators want "local + sustainable" story for guests. The Ville Resort, Peppers Blue on Blue, Rydges Esplanade. Revenue = wholesale supply at hotel markup.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. THE FARM — Missing: accredited courses, kids programs, CSA, WWOOF
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Accredited education (highest margin education product)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Permaculture Design Certificate (PDC) Courses',
   'Students', 'commercial',
   '$2000-3000 per student', NULL, 'prospect',
   'Internationally recognised 72-hour Permaculture Design Certificate. 2-week intensive or weekend series. $2-3K/student × 15 students × 4 courses/yr = $120-180K/yr. Partner with accredited PDC teachers. The farm IS the classroom.'),

  -- Kids / holiday programs
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Kids Nature Play & School Holiday Programs',
   'Families', 'commercial',
   '$40-80 per child/day', NULL, 'prospect',
   'School holiday farm programs: nature play, animal care, gardening, cooking with farm produce, art workshops. $40-80/child/day × 15 kids × 10 days/holidays × 4 holiday blocks = $24-48K/yr. Also: birthday parties ($500-800).'),

  -- Community Supported Agriculture
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Community Supported Agriculture (CSA) Shares',
   'Local community members', 'commercial',
   '$500-1500/season', NULL, 'prospect',
   'CSA model: community members buy a "share" of the farm''s season upfront ($500-1500). Receive weekly produce box. Farm gets cash flow security, community gets connection to their food. 30 shares × $1000 = $30K guaranteed revenue per season.'),

  -- WWOOF / volunteer program
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'WWOOF & Volunteer Hosting Program',
   'WWOOF Australia', 'partner',
   'Labour exchange', NULL, 'prospect',
   'Host WWOOF volunteers and travellers: 4-6 hours work/day in exchange for accommodation and meals. Free skilled labour for farm operations. 2-4 volunteers at a time, year-round. Revenue = labour value ($25/hr × 5hrs × 365 days × 3 avg = $137K equivalent labour).'),

  -- Photography / creative workshops
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Photography & Creative Workshops',
   'Workshop participants', 'commercial',
   '$150-400 per workshop', NULL, 'prospect',
   'Weekend workshops: landscape photography, botanical illustration, nature journaling, plein air painting, ceramic/pottery (farm clay). $150-400pp × 8-12 participants. Partner with local artists. Revenue = workshop fees. Participants also buy cafe + shop.'),

  -- Corporate sustainability retreats
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Corporate Sustainability Retreats',
   'Corporate clients', 'corporate',
   '$5K-15K per group', NULL, 'prospect',
   'Corporate teams doing ESG/sustainability strategy — spend 2 days on a regenerative farm. Hands-on: plant trees, build compost, see carbon sequestration. Facilitated strategy sessions. $5-15K per group × monthly = $60-180K/yr. BHP, Rio, CBA all have sustainability teams in NQ.'),

  -- Seed library / heritage seeds
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Heritage Seed Library & Nursery Sales',
   'Gardeners / farmers', 'commercial',
   'Product sales', NULL, 'prospect',
   'Heritage/heirloom seed bank + nursery. Sell seeds ($5-10/packet), seedlings ($3-8), fruit trees ($20-50), native plants. Online + at farm shop + at markets. Low overhead, high margin. Also: seed-saving workshops ($50pp).')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. CROSS-PROJECT SYNERGY items (at org level)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Ecosystem revenue model
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'ACT Ecosystem Membership — Annual Supporter Program',
   'Community supporters', 'commercial',
   '$50-500/yr per member', NULL, 'prospect',
   'Membership program across all ACT projects. Tiers: Friend ($50 — newsletter + farm day pass), Supporter ($150 — produce box + events), Partner ($500 — all access + name on wall). 200 members × $150 avg = $30K/yr recurring. Builds community ownership.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'CBA Foundation — Sustainability Partnership',
   'CBA Foundation', 'foundation',
   '$50K-200K', 200000, 'prospect',
   'CBA Foundation ($56.7M/yr) — community, sustainability, environment, education, indigenous. ACT ecosystem is a showcase: regenerative agriculture (Farm/Harvest), social enterprise (Goods), Indigenous community (PICC), tech for good (CivicGraph). Multi-project partnership.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'QBE Foundation — Community Resilience',
   'QBE Foundation', 'foundation',
   '$20K-100K', 100000, 'prospect',
   'QBE Foundation ($12.4M/yr) — community, indigenous. Focus on community resilience. ACT ecosystem = community resilience infrastructure. Less competitive than bigger foundations.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'Fortescue Foundation — Indigenous Economic Development',
   'Fortescue Foundation', 'foundation',
   '$50K-200K', 200000, 'prospect',
   'Fortescue Foundation ($54.9M/yr) — indigenous, community, education, environment, youth. WA-based but funds nationally. Indigenous economic development through PICC + Goods. Andrew Forrest''s focus on Indigenous employment aligns with Goods procurement model.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'Snow Foundation — Social Enterprise Systems Change',
   'Snow Foundation', 'foundation',
   '$20K-50K', 50000, 'prospect',
   'Snow Foundation ($4M/yr) — social-disadvantage, youth, indigenous, social-enterprise. Smaller but strategic: systems-change focus aligns with CivicGraph + Goods. Less competitive, more accessible.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 5. NEW CONTACTS — Commercial partners & missing foundations
-- ═══════════════════════════════════════════════════════════════════════
-- contact_type must be: governance|funder|partner|supplier|political|community|advocacy

INSERT INTO org_contacts (org_profile_id, project_id, name, role, organisation, contact_type, notes)
VALUES
  -- Farm commercial partners
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Tourism Tropical North Queensland', 'Marketing Partner', 'TTNQ', 'partner',
   'Regional tourism body. Farm listed as agritourism destination. Cross-promotion with reef/rainforest tourism.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Townsville Enterprise', 'Business Network', 'Townsville Enterprise', 'partner',
   'Local business network and economic development. Connect Farm restaurant/events with corporate clients.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'WWOOF Australia', 'Volunteer Network', 'WWOOF Australia', 'partner',
   'Willing Workers on Organic Farms network. Source volunteers for farm operations in exchange for accommodation.'),

  -- Harvest commercial partners
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Open Food Network', 'Platform Partner', 'Open Food Network', 'partner',
   'Open-source food distribution platform. Model for Harvest food hub. Potential tech partnership or adoption.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Regen Australia', 'Industry Network', 'Regen Australia', 'partner',
   'Regenerative agriculture network. Education partnership for courses. Connects to broader regen farming community.'),

  -- Goods commercial partners
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Townsville City Council — Procurement', 'Procurement Pilot', 'Townsville City Council', 'partner',
   'Pilot customer for Goods procurement compliance tool. TCC has social procurement targets. First council licence.'),

  -- Missing foundations at org level
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'CBA Foundation', 'Funder', 'CBA Foundation', 'funder',
   'CBA Foundation ($56.7M/yr) — community, sustainability, environment, education, indigenous. Multi-project ecosystem partnership.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'Fortescue Foundation', 'Funder', 'Fortescue Foundation', 'funder',
   'Fortescue ($54.9M/yr) — indigenous, community, education, environment, youth. Indigenous economic development via PICC + Goods.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'QBE Foundation', 'Funder', 'QBE Foundation', 'funder',
   'QBE ($12.4M/yr) — community, indigenous. Community resilience focus. Less competitive than bigger foundations.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   NULL,
   'Snow Foundation', 'Funder', 'Snow Foundation', 'funder',
   'Snow ($4M/yr) — social-disadvantage, youth, indigenous, social-enterprise. Systems-change focus, smaller but strategic.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 6. Verify
-- ═══════════════════════════════════════════════════════════════════════

SELECT
  COALESCE(p.name, '── ACT org-level') as project,
  COUNT(*) as pipeline
FROM org_pipeline pl
LEFT JOIN org_projects p ON p.id = pl.project_id
WHERE pl.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
GROUP BY p.name
ORDER BY p.name;

SELECT
  'TOTALS' as label,
  (SELECT COUNT(*) FROM org_programs WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as programs,
  (SELECT COUNT(*) FROM org_pipeline WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as pipeline,
  (SELECT COUNT(*) FROM org_contacts WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as contacts,
  (SELECT COUNT(*) FROM org_leadership WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0') as leadership;
