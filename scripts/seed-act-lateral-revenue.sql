-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Lateral Revenue Sweep — Goods, Harvest, The Farm
-- Thinking beyond grants: procurement, commercial revenue, experiences
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════════════════════════════════════════
-- 1. GOODS — Procurement & Marketplace Revenue
-- ═══════════════════════════════════════════════════════════════════════
-- Goods isn't just a marketplace — it's the COMPLIANCE LAYER that helps
-- government and corporates meet their social/Indigenous procurement
-- targets. The revenue is in making it EASY to buy ethically.

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Government procurement frameworks (BUYER-SIDE revenue)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'QLD Buy Queensland — Social Procurement Partner',
   'QLD Dept of Housing & Public Works', 'government',
   'Platform fee', NULL, 'prospect',
   'QLD Buy Queensland policy mandates social benefit in procurement. Goods can be the verification/discovery platform. Revenue = platform fee per verified transaction or annual SaaS license to procurement teams.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'VIC Social Procurement Framework — Compliance Tool',
   'VIC Dept of Jobs, Precincts & Regions', 'government',
   'SaaS license', NULL, 'prospect',
   'VIC has mandatory Social Procurement Framework (1% target). Goods can be the tool that helps VIC government buyers FIND and VERIFY social enterprises. Annual SaaS license model to procurement departments.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Federal Indigenous Procurement Policy (IPP) — Platform',
   'NIAA / Dept of Finance', 'government',
   '$500K+ market', NULL, 'prospect',
   'Federal IPP mandates 3% of contracts to Indigenous businesses. $3.5B+ market. Goods as the discovery and compliance platform. Revenue via transaction fees, verification services, or annual subscriptions for Commonwealth agencies.'),

  -- Corporate RAP procurement (B2B channel)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Corporate RAP Procurement — BHP/Rio Tinto/Woolworths',
   'Corporate RAP Partners', 'corporate',
   'Annual license', NULL, 'prospect',
   'Major corporates with RAPs have Indigenous procurement targets they struggle to meet. Goods as B2B procurement compliance tool. BHP alone spends $15B+ on procurement with 5% Indigenous target = $750M addressable market.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Supply Nation Certification & Partnership',
   'Supply Nation', 'partner',
   'Certification', NULL, 'prospect',
   'Supply Nation is the national directory of verified Indigenous businesses. Partnership/integration opportunity — Goods becomes the transactional layer on top of Supply Nation''s directory. Revenue sharing or co-branded procurement portal.'),

  -- Social enterprise ecosystem revenue
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Social Traders Marketplace Integration',
   'Social Traders', 'partner',
   'Revenue share', NULL, 'prospect',
   'Social Traders certifies social enterprises in Australia. Integration/partnership — Goods handles the marketplace and fulfilment, Social Traders handles certification. Revenue via transaction fees on verified social enterprise purchases.'),

  -- Foundation support for Goods platform development
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Paul Ramsay Foundation — Systems Change (Goods)',
   'Paul Ramsay Foundation', 'foundation',
   '$100K–$500K', 500000, 'prospect',
   'PRF ($320M/yr) funds systems-change and employment. Goods as procurement infrastructure IS systems change — shifting how government and corporates buy. Framing: "Goods rewires $3.5B+ of procurement to flow through social enterprise."'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Indigenous Business Australia — Platform Development',
   'Indigenous Business Australia', 'government',
   '$50K–$200K', 200000, 'prospect',
   'IBA ($16.3M/yr) funds Indigenous social enterprise and employment. Goods helps Indigenous businesses access procurement markets. Application for platform development grant or business development support.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. HARVEST — Commercial Revenue Channels
-- ═══════════════════════════════════════════════════════════════════════
-- Harvest is paddock-to-plate. The revenue isn't in grants — it's in
-- building commercial food distribution channels and value-add products.

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- Direct-to-consumer
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Regenerative Produce Box Subscription',
   'Direct-to-consumer', 'commercial',
   'Recurring revenue', NULL, 'prospect',
   'Weekly/fortnightly produce box subscription — regenerative, local, seasonal. Like CERES Fair Food (Melbourne) or Ooooby. Revenue = subscription fees. Start NQ, scale to Brisbane. $40-80/box × 50+ subscribers = $2K-4K/week recurring.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Farmers Market Direct Sales',
   'Market customers', 'commercial',
   'Weekly revenue', NULL, 'prospect',
   'Direct sales at local farmers markets — Townsville Cotters Markets, Strand Night Markets, Magnetic Island Markets. Highest margin channel. Revenue = direct sales of produce, preserves, value-add products.'),

  -- Wholesale/restaurant channel
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Restaurant Supply Partnerships',
   'NQ restaurants & cafes', 'commercial',
   'Wholesale contracts', NULL, 'prospect',
   'Direct supply agreements with NQ restaurants wanting ethical/regenerative sourcing. Target: A Touch of Salt, Jam Corner, The Ville, Longboard Bar. Revenue = wholesale produce supply at restaurant markup. Story-driven: menus say "produce from Harvest regenerative farm."'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Ethical Retail Supply — IGA/Food Co-ops',
   'Independent retailers', 'commercial',
   'Wholesale contracts', NULL, 'prospect',
   'Supply local IGAs, organic shops, and food co-ops with regenerative produce. "Harvest" branded section in store. Revenue = wholesale supply. Start with Perc Tucker IGA, Magnetic Island stores, local health food shops.'),

  -- Value-add products (higher margin)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Value-Add Products — Preserves, Ferments, Dried Goods',
   'Harvest brand', 'commercial',
   'Product line', NULL, 'prospect',
   'Transform surplus produce into high-margin products: jams, chutneys, fermented hot sauce, dried herbs, pickles, kimchi. Sell via markets, Goods platform, and retail. $15-25/jar × volume = significant margin. Also reduces waste.'),

  -- Events & experiences
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Paddock-to-Plate Dinners & Events',
   'Event attendees', 'commercial',
   '$120-200pp', NULL, 'prospect',
   'Ticketed long-table dinners on the farm. Seasonal, monthly. Chef cooks with farm produce, guests tour the farm, eat under the stars. $120-200pp × 40 seats = $5K-8K per event. Also corporate team dinners, weddings, private events.'),

  -- Catering
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Catering — Corporate & Government Events',
   'Corporate/government clients', 'commercial',
   'Per-event', NULL, 'prospect',
   'Regenerative catering for corporate events, conferences, government workshops. Story-driven: "catered by Harvest — paddock to plate, regenerative agriculture." Especially powerful for sustainability-focused events. Revenue = per-event catering fees.'),

  -- Carbon/environmental credits
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Soil Carbon Credits — ERF/ACCUs',
   'Carbon market', 'commercial',
   'Per-tonne credits', NULL, 'prospect',
   'Regenerative agriculture sequesters soil carbon. Australian Carbon Credit Units (ACCUs) via Emissions Reduction Fund. $30-50/tonne. Requires measurement and verification but is real recurring revenue for regenerative farms. Also: biodiversity credits emerging.'),

  -- Foundation support for commercial development
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Woolworths Group Foundation — Regenerative Supply Chain',
   'Woolworths Group Foundation', 'foundation',
   '$50K–$200K', 200000, 'prospect',
   'Woolworths Foundation ($146.5M/yr) funds food, community, Indigenous, environment. Harvest as a model regenerative supply chain partner. Woolworths has regenerative agriculture commitments — Harvest could be a demonstration supplier.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. THE FARM — Multi-Revenue Destination
-- ═══════════════════════════════════════════════════════════════════════
-- The Farm isn't just a demonstration site. It's a DESTINATION —
-- walks, accommodation, dining, art, education, events.
-- Think: The Agrarian Kitchen (TAS) × Bundanon (NSW) × MONA (ambition)

INSERT INTO org_pipeline (org_profile_id, project_id, name, funder, funder_type, amount_display, amount_numeric, status, notes)
VALUES
  -- WALKS & TRAILS
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Farm Walk Trail Development',
   'Self-funded / grants', 'commercial',
   'Infrastructure', NULL, 'prospect',
   'Develop marked walking trails across the farm — regenerative agriculture trail (see the paddocks, composting, water systems), bush trail (native vegetation, wildlife), creek walk. Interpretive signage. Revenue = guided tours ($25-50pp) or free trails that draw visitors to cafe/shop.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Guided Farm Experiences — School & Corporate',
   'Schools / corporates', 'commercial',
   '$15-50pp', NULL, 'prospect',
   'Guided farm tours: school excursions ($15pp × 30 kids = $450/visit, 2-3x/week in term), corporate team-building ($50pp × 20 = $1K/visit), tourist groups. Hands-on: feed animals, plant seeds, harvest produce, composting workshop. Revenue = tour fees.'),

  -- ACCOMMODATION & RETREATS
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Farmstay Accommodation — Cabins & Glamping',
   'Guests', 'commercial',
   '$150-350/night', NULL, 'prospect',
   'On-farm accommodation: 3-5 cabins or glamping tents. Regenerative farmstay experience — wake up on the farm, breakfast with farm eggs, explore trails. $150-350/night × 4 cabins × 60% occupancy = $130K-$300K/yr. List on Airbnb, Booking.com, and direct.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Wellness & Yoga Retreats',
   'Retreat guests', 'commercial',
   '$500-1500 per retreat', NULL, 'prospect',
   'Weekend wellness retreats on the farm — yoga, meditation, farm-to-plate meals, nature walks, digital detox. Partner with local yoga teachers/practitioners. $500-1500pp × 12-20 participants × monthly = $72K-$360K/yr. The farm IS the product.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Writers & Thinkers Retreat',
   'Retreat guests', 'commercial',
   '$800-2000/week', NULL, 'prospect',
   'Week-long writers retreats — private cabin, farm meals, walking trails, writing workshops. Partner with NQ literary festivals. Revenue = accommodation + program fee. Also: corporate strategy retreats, board retreats for NFPs wanting "time to think."'),

  -- RESTAURANT & CAFE
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Farm Restaurant — Paddock to Plate',
   'Diners', 'commercial',
   'Venue revenue', NULL, 'prospect',
   'On-farm restaurant: paddock-to-plate dining. Like The Agrarian Kitchen (TAS) or Pt. Leo Estate (VIC). Set menu using that day''s harvest. Lunch service Thu-Sun, dinner Fri-Sat. 40 seats × $80 avg × 5 services/week = $16K/week. THE anchor that drives all other Farm revenue.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Farm Cafe & Produce Shop',
   'Visitors', 'commercial',
   'Daily revenue', NULL, 'prospect',
   'Daytime cafe: coffee, pastries, light lunches using farm produce. Adjacent produce shop: eggs, vegetables, preserves, Harvest branded products, local artisan goods. Lower barrier to entry than restaurant. Revenue = daily sales. Also sells art residency work.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Cooking School — Farm to Table Classes',
   'Students', 'commercial',
   '$120-250pp', NULL, 'prospect',
   'Half-day cooking classes: harvest ingredients from the farm, then cook together. $120-250pp × 8-12 students × 2-3 classes/week. Revenue = class fees. Also: specialised workshops — fermentation, sourdough, preserving, bush tucker with Indigenous guides.'),

  -- ART RESIDENCIES & FELLOWSHIPS
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Artist-in-Residence Program',
   'Arts foundations', 'commercial',
   'Residency program', NULL, 'prospect',
   'On-farm artist residencies: 4-12 week stays. Studio space (converted shed), accommodation (cabin), farm meals included. Artists work with land, agriculture, community themes. Mix of funded residencies (foundation-supported) and self-funded ($300-500/week). 4-6 residents/year. Exhibited in farm gallery.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'First Nations Artist Fellowship',
   'Foundations + government', 'foundation',
   '$20K–$50K per fellow', 50000, 'prospect',
   'Dedicated fellowship for First Nations artists — funded residency (stipend + accommodation + materials + exhibition). 2-3 fellows/year. Fund via Tim Fairfax ($7.7M), Ian Potter ($35M), Australia Council, Arts QLD. The farm becomes a place where Indigenous art and land reconnect.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Farm Gallery & Exhibition Space',
   'Art sales + commissions', 'commercial',
   'Commission revenue', NULL, 'prospect',
   'Permanent gallery space on the farm — displays work by resident artists, local artists, First Nations artists. Revenue = 30-40% commission on sales + exhibition fees. Rotates quarterly. Combined with cafe = "have coffee, see art, walk the farm." Think: Bundanon Trust model.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Sculpture Trail & Land Art',
   'Arts grants + commissions', 'commercial',
   'Permanent installation', NULL, 'prospect',
   'Commission permanent outdoor sculptures/land art installations along farm walking trails. Becomes a destination in itself — like Sculpture by the Sea but permanent and on a regenerative farm. Revenue = trail entry ($10pp) or free with restaurant/cafe visit. Fund initial commissions via arts grants.'),

  -- EVENTS
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Event Venue — Weddings, Corporate, Festivals',
   'Event clients', 'commercial',
   '$3K-15K per event', NULL, 'prospect',
   'The farm as event venue: weddings ($8K-15K venue hire), corporate events ($3K-8K), small festivals, solstice dinners, harvest festivals. Beautiful setting + on-site catering (Harvest) + accommodation = all-in-one. Revenue = venue hire + catering + accommodation package.'),

  -- EDUCATION
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Regenerative Agriculture Courses & Workshops',
   'Students / professionals', 'commercial',
   '$200-2000 per course', NULL, 'prospect',
   'Structured courses: weekend permaculture intro ($200pp), 5-day regenerative agriculture intensive ($2000pp), monthly composting/soil workshops ($50pp). Partner with Regen Australia, Holistic Management International. Revenue = course fees. Also: WWOOF volunteer hosting.'),

  -- FOUNDATION SUPPORT (to build the infrastructure)
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Tim Fairfax Family Foundation — Farm Arts & Community',
   'Tim Fairfax Family Foundation', 'foundation',
   '$50K–$200K', 200000, 'prospect',
   'Tim Fairfax ($7.7M/yr) specifically funds QLD, rural/regional, arts, Indigenous, community, youth. PERFECT fit for The Farm''s art residency + community programming. Application for capital works (gallery, studio) + program funding (residencies, fellowships).'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Ian Potter Foundation — Arts Program (Farm Gallery)',
   'Ian Potter Foundation', 'foundation',
   '$20K–$150K', 150000, 'prospect',
   'Ian Potter ($35M/yr) Arts Program funds regional arts practice and innovation. The Farm as a new model — art residency embedded in a regenerative farm. Application for gallery fit-out + inaugural exhibition + first year of residencies. EOI-based, $20K-$150K.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Myer Foundation / Sidney Myer Fund — Arts + Environment',
   'Myer Foundation / Sidney Myer Fund', 'foundation',
   '$30K–$100K', 100000, 'prospect',
   'Both Myer Foundation ($12M/yr) and Sidney Myer Fund ($9.9M/yr) fund arts, environment, social enterprise, and community. The Farm sits at the intersection of ALL of these. Application for the art-environment-community nexus program. Sidney Myer Creative Fellowships also relevant.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Regional Arts Fund — Farm Arts Program',
   'Regional Arts Australia', 'government',
   '$5K–$30K', 30000, 'upcoming',
   'Regional Arts Fund Project Grants ($0-$30K) for regional/remote arts projects. Quick Response grants ($1K-$5K, monthly rolling). IMMEDIATE opportunity for first artist residency or exhibition. Low-barrier entry point while building toward larger foundation applications.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Lowy Foundation — Community Arts',
   'Lowy Foundation', 'foundation',
   '$50K–$200K', 200000, 'prospect',
   'Lowy Foundation ($50M/yr) funds arts and community. Less well-known for arts than Ian Potter/Myer but significant. Application for farm-as-cultural-venue programming.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Vincent Fairfax Family Foundation — Leadership & Arts',
   'Vincent Fairfax Family Foundation', 'foundation',
   '$30K–$100K', 100000, 'prospect',
   'Vincent Fairfax ($15M/yr) funds education, community, arts, social-justice, youth, leadership. The Farm as a place for emerging leader retreats combined with regenerative agriculture + arts. Application for leadership-through-land program.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. NEW CONTACTS — Procurement, Commercial, Arts
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO org_contacts (org_profile_id, project_id, name, role, organisation, contact_type, notes)
VALUES
  -- Goods procurement contacts
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Supply Nation', 'Partnership', 'Supply Nation',
   'partner',
   'National directory of verified Indigenous businesses. Key partnership for Goods — integration opportunity. They verify, Goods transacts.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Social Traders', 'Partnership', 'Social Traders',
   'partner',
   'Australia''s social enterprise certification body. Partnership: they certify, Goods provides the marketplace. Joint approach to government procurement teams.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Indigenous Business Australia', 'Funder / Partner', 'IBA',
   'government',
   'IBA ($16.3M/yr) funds Indigenous business development. Both a funder for Goods platform AND a distribution partner — IBA-supported businesses listed on Goods.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Paul Ramsay Foundation', 'Funder', 'Paul Ramsay Foundation',
   'foundation',
   'PRF ($320M/yr, largest private foundation in AU) funds systems-change, employment, Indigenous. Goods as procurement infrastructure = systems change at scale.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '01359765-a88c-4ac2-8e4d-c40beb01c299',
   'Ecstra Foundation', 'Funder', 'Ecstra Foundation',
   'foundation',
   'Ecstra ($6.4M/yr) funds financial wellbeing, economic security, Indigenous, women. Goods helps social enterprises access procurement revenue = economic security.'),

  -- Farm arts/residency contacts
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Tim Fairfax Family Foundation', 'Funder', 'Tim Fairfax Family Foundation',
   'foundation',
   'Tim Fairfax ($7.7M/yr) — QLD, rural, arts, Indigenous, community. PERFECT match for Farm arts program. Geographic and thematic alignment is exceptional.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Myer Foundation / Sidney Myer Fund', 'Funder', 'Myer Foundation',
   'foundation',
   'Myer ($12M) + Sidney Myer Fund ($9.9M). Arts + environment + social enterprise + community. Sidney Myer Creative Fellowships are nationally prestigious.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Lowy Foundation', 'Funder', 'Lowy Foundation',
   'foundation',
   'Lowy ($50M/yr) — arts and community. Less competitive than Ian Potter/Myer for arts funding. Worth cultivating.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Vincent Fairfax Family Foundation', 'Funder', 'Vincent Fairfax Family Foundation',
   'foundation',
   'Vincent Fairfax ($15M/yr) — arts, education, leadership, social justice, youth. Leadership retreats + arts program at the farm.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Gandel Foundation', 'Funder', 'Gandel Foundation',
   'foundation',
   'Gandel ($12M/yr) — education, arts, community, youth. Melbourne-based but funds nationally. Gallery and education programming.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Macquarie Group Foundation', 'Funder', 'Macquarie Group Foundation',
   'foundation',
   'Macquarie ($37.5M/yr) — community, youth, employment, arts, sports. Staff volunteering program could also engage with farm. Corporate retreat partner potential.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Regional Arts Australia', 'Funder / Partner', 'Regional Arts Australia',
   'government',
   'Administers Regional Arts Fund. Immediate grant opportunity for first residency. Also: network of regional arts organisations for promotion and artist sourcing.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '48a6964b-88cf-4a3b-bd74-1417a0c638e8',
   'Arts Queensland', 'Funder', 'Arts Queensland',
   'government',
   'State arts funding body. Multiple programs: Organisations Fund, Arts Ignite, Playing Queensland Fund. Key relationship for ongoing arts program funding.'),

  -- Harvest commercial contacts
  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Woolworths Group Foundation', 'Funder / Partner', 'Woolworths Group Foundation',
   'foundation',
   'Woolworths Foundation ($146.5M/yr) — food, community, Indigenous, environment. Regenerative supply chain partnership. Also: Woolworths has regenerative agriculture commitments for own supply chain.'),

  ('8b6160a1-7eea-4bd2-8404-71c196381de0',
   '75d2b50e-710f-4d80-996d-7feec567b392',
   'Burnett Mary Regional Group', 'Partner', 'Burnett Mary Regional Group',
   'government',
   'Burnett Mary ($15.2M/yr) — QLD environment, community, Indigenous, research, rural/remote. NRM group with regenerative agriculture interest. Potential research/demonstration partnership.')

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 5. Verify totals
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
