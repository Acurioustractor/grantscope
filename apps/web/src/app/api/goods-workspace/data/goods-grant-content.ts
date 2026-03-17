/**
 * Goods on Country — Reusable Grant Content Library
 *
 * Every grant application asks the same questions. This file contains
 * verified, source-linked content blocks that can be composed into
 * any grant, pitch deck, impact report, or partnership proposal.
 *
 * Source: v2/docs/COMPENDIUM_MARCH_2026.md + v2/src/lib/data/compendium.ts
 * Last synced: March 16, 2026
 *
 * RULES:
 * - Every claim must have a source
 * - Numbers come from compendium.ts (the single source of truth)
 * - Community quotes are verbatim from recorded interviews
 * - DO NOT USE anything in the corrections.doNotUse list
 */

// ─────────────────────────────────────────────────────────────────────────────
// Organisation Identity
// ─────────────────────────────────────────────────────────────────────────────

export const orgIdentity = {
  legalName: 'A Kind Tractor Ltd',
  abn: '50 001 350 152',
  acnc: true,
  dgr: true,
  tradingAs: 'Goods on Country',
  tradingEntity: 'A Curious Tractor Pty Ltd',
  tradingAbn: '21 591 780 066',
  website: 'www.goodsoncountry.com',
  tagline: 'Goods that heal.',
  alternateTaglines: [
    'Built with communities, not for them.',
    'Health hardware, community owned.',
  ],
  oneLiner: 'A good bed can prevent heart disease.',
  mission:
    'To transform essential household goods — beds, washing machines, refrigerators — into community-owned assets that improve lives in remote Australia, designed with communities and eventually manufactured by them.',
  philosophy: 'Our job is to become unnecessary.',
  founded: {
    ptyLtd: 'October 2022',
    incorporated: 'September 2023',
    projectKickoff: 'November 2022',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Founder Bios (grant-ready)
// ─────────────────────────────────────────────────────────────────────────────

export const founderBios = {
  nic: {
    name: 'Nicholas Marchesi OAM',
    role: 'Co-founder & Project Lead',
    shortBio:
      'Social entrepreneur with 15+ years founding and scaling community-led ventures. Co-founded Orange Sky (2014) — now 280+ shifts/week, 1.2M+ kg laundry, 1/3 of operations in remote communities.',
    credentials: [
      'Medal of the Order of Australia (OAM, 2020)',
      'Young Australian of the Year (2016, joint)',
      'Obama Foundation Leader: Asia-Pacific (2019)',
      'Stanford Executive Program in Social Entrepreneurship (2020)',
      'Graduate AICD (2019)',
      'Forbes 30 Under 30 (2019)',
      'Westpac Social Change Fellow (2023)',
      'Founding Partner, Global Wash Alliance (2025)',
      'Director, Stanford Australia Foundation (2023)',
    ],
    quote:
      'Orange Sky taught me that dignity lives in the details. Clean clothes aren\'t just practical — they restore something essential. Dr. Bo Remenyi showed me what\'s at stake. RHD doesn\'t exist because medicine failed — it exists because housing and "health hardware" failed.',
  },
  ben: {
    name: 'Benjamin Knight',
    role: 'Co-founder & Technology',
    shortBio:
      '20+ years in community-led innovation: youth refuges (2004–2006), QLD Corrective Services Gulf communities (2010–2014), QFCC Youth Advocate (2015–2016), Orange Sky (2016–2020), AIME (2020–2023).',
    credentials: [
      'Built Empathy Ledger ethical storytelling infrastructure',
      'Built Goods Asset Register (389 tracked assets, QR-coded lifecycle monitoring)',
      'JusticeHub Digital Platform (launching 2026)',
    ],
    quote:
      "From 20 years on the frontline: we don't need better programs delivered to communities; we need better infrastructure owned by communities.",
  },
  howTheyMet:
    'Ben joined Orange Sky in 2016 as Brand and Communication Manager. Four years together during remote community expansion. Co-founded A Curious Tractor October 2022.',
};

// ─────────────────────────────────────────────────────────────────────────────
// The Problem (with citations)
// ─────────────────────────────────────────────────────────────────────────────

export const problemStatement = {
  headline: 'The health cascade that starts with a missing washing machine',
  cascade: [
    'No washing machine → dirty bedding → scabies',
    'Scabies → skin infections → Strep A',
    'Strep A → rheumatic fever → Rheumatic Heart Disease',
    'RHD → death certificates for children',
  ],
  preventionPoint:
    'A washing machine interrupts the cascade. Clean bedding breaks the scabies cycle.',
  statistics: [
    { claim: 'Remote homes lacking washing machines', value: '59%', source: 'FRRR, 2022' },
    { claim: 'Can wash regularly (power/detergent)', value: 'Only 38%', source: 'FRRR, 2022' },
    { claim: 'Children with scabies at any time', value: '1 in 3', source: 'PLOS Neglected Tropical Diseases' },
    { claim: 'Children with skin sores (impetigo)', value: '1 in 2', source: 'Medical Journal of Australia' },
    { claim: 'Very remote First Nations homes overcrowded', value: '55%', source: 'AIHW, 2021 Census' },
    { claim: 'Very remote homes with structural problems', value: '54.6%', source: 'AIHW' },
    { claim: 'Mattress cost in remote', value: '$1,200+ (2x city)', source: 'AFSE research' },
    { claim: 'Washing machines sold → dumps, Alice Springs', value: '$3M/year', source: 'Alice Springs provider' },
    { claim: 'Remote laundries reduce scabies', value: '60% reduction', source: 'Sector research' },
    { claim: 'Healthcare savings per $1 washing investment', value: '$6 saved', source: 'Treatment cost analysis' },
    { claim: 'Washing machine lifespan in remote', value: '1–2 years (vs 10–15)', source: 'East Arnhem Spin Project' },
  ],
  whyPeopleSleepOnFloors: [
    'Overcrowding (55% of very remote homes)',
    'Cost ($1,200+ for mattress — 2x city price)',
    'Freight ("The freight is very, very dear" — Carmelita, Palm Island)',
    "Products don't survive (mould, dust, heavy use)",
    'Housing quality (54.6% with major structural problems)',
  ],
  importantNote:
    'This is not a cultural choice. Community voices are unambiguous.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Impact Numbers (verified, with date stamps)
// ─────────────────────────────────────────────────────────────────────────────

export const impactNumbers = {
  asOf: '2026-03-15',
  totalAssetsTracked: 389,
  bedsDeployed: 412, // sum of deployment table
  washersDeployed: 5,
  communitiesEngaged: 8,
  livesDirectlyImpacted: '1,000+', // est. 2.5–4 per household
  communityFeedbackMinutes: '500+',
  plasticDivertedKg: 9225,
  plasticPerBed: '20–25kg HDPE',
  atScale: { units: 5000, tonnesDiverted: 125, period: 'annually' },
  productLifespan: '10+ years (vs weeks for conventional)',
  verifiedStorytellers: '15+',
  videoTestimonials: 9,
  advisoryBoardMembers: 13,
  tradeRevenue: 50_000,
  outstandingReceivables: 490_086,

  deployments: [
    { community: 'Palm Island', traditionalName: 'Bwgcolman', state: 'QLD', beds: 141, washers: 0, status: 'active' },
    { community: 'Tennant Creek', traditionalName: 'Wumpurrarni', state: 'NT', beds: 139, washers: 5, status: 'active' },
    { community: 'Alice Homelands', state: 'NT', beds: 60, washers: 0, status: 'active' },
    { community: 'Maningrida', state: 'NT', beds: 24, washers: 0, status: 'active' },
    { community: 'Utopia Homelands', state: 'NT', beds: 24, washers: 0, status: 'active' },
    { community: 'Kalgoorlie', traditionalName: 'Ninga Mia', state: 'WA', beds: 20, washers: 0, status: 'active' },
    { community: 'Mt Isa', traditionalName: 'Kalkadoon', state: 'QLD', beds: 4, washers: 0, status: 'testing' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Funding History (for "previous funding" sections)
// ─────────────────────────────────────────────────────────────────────────────

export const fundingHistory = {
  totalConfirmedReceived: 445_685,
  productionFacilityInvestment: 100_000,
  received: [
    { source: 'Snow Foundation', amount: 193_785, program: 'Multiple grants', when: '2024–2026' },
    { source: 'The Funding Network', amount: 130_000, program: 'Pitch event', when: 'Sept 2025' },
    { source: 'FRRR', amount: 50_000, program: 'Backing the Future', when: '2025' },
    { source: 'Vincent Fairfax Family Foundation', amount: 50_000, program: 'Grant', when: '2025' },
    { source: 'AMP Spark', amount: 21_900, program: 'Program funding', when: '2025' },
  ],
  receivables: [
    { source: 'Centrecorp Foundation', amount: 420_000, notes: '107 beds for Utopia Homelands' },
    { source: 'PICC (Palm Island)', amount: 36_000, notes: '40-bed order' },
    { source: 'Homeland School Company', amount: 34_086, notes: 'INV-0303' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Specs (grant-ready summaries)
// ─────────────────────────────────────────────────────────────────────────────

export const productSpecs = {
  stretchBed: {
    name: 'The Stretch Bed',
    status: 'For sale',
    oneLiner: 'A flat-packable, washable bed made from recycled HDPE plastic, galvanised steel, and heavy-duty Australian canvas.',
    specs: {
      weight: '26kg',
      capacity: '200kg',
      dimensions: '188 × 92 × 25cm',
      assembly: '5 minutes, no tools',
      designLife: '10+ years',
      warranty: '5 years',
      plasticDiverted: '20kg HDPE per bed',
    },
    materials: [
      'Recycled HDPE plastic panels (legs) — community-collected waste',
      'Galvanised steel poles (26.9mm OD × 2.6mm wall) — DNA Steel Direct, Alice Springs',
      'Heavy-duty Australian canvas (sleeping surface) — Centre Canvas, Alice Springs',
    ],
    componentCosts: {
      steel: '$27/bed',
      canvas: '$93.50/bed',
      hdpe: '$0 (community waste)',
      productionCost: '$550–650 at 100 units',
      wholesale: '$600–850',
    },
    designEvolution:
      'V1–V3 Basket Beds → V4 Stretch Bed. Community feedback drove every change: lighter, higher off ground, no foam, washable.',
  },
  washingMachine: {
    name: 'Pakkimjalki Kari',
    status: 'Prototype',
    oneLiner: 'Commercial-grade Speed Queen in recycled plastic housing. Named in Warumungu language by Elder Dianne Stokes.',
    modifications: [
      'Wrapped in recycled plastic case (damage protection)',
      'Reduced to ONE button',
      'Glass top protected/removed',
      'Customisable language panel (swappable per community)',
      'Built-in telemetry (GPS, power monitoring)',
      'Simplified water cycle',
    ],
    deployed: '5 units in Tennant Creek',
    price: '~$4,000 including modifications',
    designLife: '10+ years (vs 1–2 years standard in remote)',
  },
  productionFacility: {
    type: 'Containerised mobile plastic re-production facility',
    investment: '~$100K (TFN $80K + ACT $20K)',
    capacity: '~30 beds/week when deployed for 2 months',
    containers: [
      'Container #1: Shredding & collection (stays in community)',
      'Container #2: Production — hydraulic press + CNC router (travels circuit)',
    ],
    circuitModel: 'Deploy to community ~2 months → produce → move to next',
    planned2026: 'Alice Springs → Tennant Creek → Katherine → Darwin',
    hostingCost: '$5,000/week',
    multiProduct: 'Same facility can produce washing machine/fridge components with different moulds',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Community Quotes (verified, for grant narratives)
// ─────────────────────────────────────────────────────────────────────────────

export const communityQuotes = {
  // Organized by theme for easy selection

  needForBeds: [
    { quote: 'Hardly anyone around the community has beds. When family comes to visit, people sleep on the floor.', person: 'Ivy', community: 'Palm Island' },
    { quote: "Having a bed is something you need; you feel more safe when you sleep in a bed. It's different than sleeping on the couch or the ground.", person: 'Alfred Johnson', community: 'Palm Island' },
    { quote: 'Hardly any people around the community have beds.', person: 'Dianne Stokes', role: 'Waramungu and Warlmanpa Elder', community: 'Tennant Creek' },
    { quote: "It's essential. The families right now... the beds were on the ground. It's a safety thing... a lot of snakes, so everyone wants to be off the ground.", person: 'Fred Campbell', role: 'Youth Case Worker, Oonchiumpa', community: 'Alice Springs' },
  ],

  freightAndAccess: [
    { quote: "You can't just go down to the store and buy beds. It's a big muck-around. You have to bring them on the barge, pay for freight, and still, not everyone gets one.", person: 'Alfred Johnson', community: 'Palm Island' },
    { quote: 'The freight is very, very dear.', person: 'Carmelita', community: 'Palm Island' },
    { quote: 'We are on an island — literally. Therefore anything we purchase is so much more expensive due to freight.', person: 'Simone Grimmond', community: 'Groote Archipelago' },
    { quote: 'Essential goods are difficult to get out as everything comes on a barge and they are expensive.', person: 'Jessica Allardyce', role: 'Miwatj Health', community: 'East Arnhem' },
  ],

  healthLink: [
    { quote: 'There is also a lot of scabies and this often leads to Rheumatic Heart Disease, so washing machines are essential.', person: 'Jessica Allardyce', role: 'Miwatj Health', community: 'East Arnhem' },
    { quote: 'You got to get health messages across.', person: 'Cliff Plummer', role: 'Health Practitioner', community: 'Tennant Creek' },
    { quote: "The new mattress design is not just about comfort — it's about dignity and health.", person: 'Tracy McCartney', role: 'Support Worker', community: 'Mt Isa' },
  ],

  productFeedback: [
    { quote: "It's more better than laying around on the floors... It was easy to make. Yeah, it's nice.", person: 'Ivy', community: 'Palm Island' },
    { quote: "From the waste, plastic. Perfect. That's really a perfect idea. Because it's very expensive buying bed. But with this here, it's so amazing. With just waste.", person: 'Jacqueline', role: 'Western Arrernte / Pertame woman', community: 'Alice Springs' },
    { quote: "In the shops when they go and buy, it's easily to break 'cause it's too soft. But this here, it's look like it's really gonna stand like that, not break.", person: 'Jacqueline', community: 'Alice Springs' },
  ],

  communityOwnership: [
    { quote: "We've never been asked at what sort of house we'd like to live in.", person: 'Linda Turner', community: 'Tennant Creek' },
    { quote: "We're setting this up for our kids and grandkids... independence, being in charge of your own destiny.", person: 'Linda Turner', community: 'Tennant Creek' },
    { quote: 'I want to see a better future for our kids and better housing for our people.', person: 'Norman Frank Jupurrurla', role: 'Warumungu Law Man', community: 'Tennant Creek' },
    { quote: "That's something Central Australia need — just something so simple, especially coming out of recycled, and is turning into something so unique for our mob in the bush or on the communities.", person: 'Fred Campbell', role: 'Youth Case Worker', community: 'Alice Springs' },
  ],

  youthAndJobs: [
    { quote: 'He just was so proud showing them that he can build it... his energy was a lot more higher.', person: 'Fred Campbell', role: 'on Xavier building beds', community: 'Alice Springs' },
    { quote: "In Aboriginal culture, we tend to move away from the places when there's a death in the family. They just chuck their swags on the ground. Now they know they can just chuck that in.", person: 'Fred Campbell', community: 'Alice Springs' },
  ],

  washingMachines: [
    { quote: "They truly wanna a washing machine to wash their blanket, to wash their clothes, and it's right there at home.", person: 'Patricia Frank', role: 'Aboriginal Corporation Worker', community: 'Tennant Creek' },
    { quote: 'Working both ways — cultural side in white society and Indigenous society.', person: 'Dianne Stokes', role: 'Named the washing machine Pakkimjalki Kari', community: 'Tennant Creek' },
  ],

  demandSignals: [
    { quote: 'Dianne Stokes received 1 bed → returned within 2 weeks requesting 20 more, offered to self-fund.', type: 'narrative', community: 'Tennant Creek' },
    { quote: 'Norman Frank called requesting 3 beds in maroon after his daughter tried one.', type: 'narrative', community: 'Tennant Creek' },
    { quote: 'PICC said "we\'ll buy the production facility itself."', type: 'narrative', community: 'Palm Island' },
    { quote: 'Groote Archipelago requested 500 mattresses + 300 washing machines from a single community.', type: 'narrative', community: 'Groote Eylandt' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Grant Question Templates (common questions → pre-written answers)
// ─────────────────────────────────────────────────────────────────────────────

export const grantAnswers = {
  whatDoYouDo: {
    short: 'We design and manufacture essential household goods — beds, washing machines, and refrigerators — with remote Indigenous communities in Australia, using recycled plastic and local production to create health outcomes, jobs, and community ownership.',
    medium: `Goods on Country transforms essential household goods into community-owned assets that improve lives in remote Australia. Our flagship product, the Stretch Bed, is a flat-packable, washable bed made from recycled HDPE plastic, galvanised steel, and heavy-duty canvas. Each bed diverts 20kg of plastic from landfill and is designed to last 10+ years. We've deployed 412 beds across 7 communities in 4 states and territories, with 5 prototype washing machines in Tennant Creek. Our containerised mobile production facility enables communities to manufacture their own goods from local waste plastic.`,
  },

  whatProblemDoYouSolve: {
    short: 'In remote Australia, 59% of homes lack washing machines, mattresses cost $1,200+ delivered, and $3M worth of washing machines end up in dumps every year in Alice Springs alone. This drives preventable diseases including Rheumatic Heart Disease in children.',
    medium: `The health cascade starts with a missing washing machine: dirty bedding leads to scabies, which leads to Strep A, Rheumatic Fever, and ultimately Rheumatic Heart Disease — entirely preventable. 59% of remote homes lack washing machines. One in three children has scabies at any given time. Standard washing machines last 1–2 years in remote conditions (vs 10–15 in cities). Mattresses cost $1,200+ delivered to remote communities. One Alice Springs provider sells $3M/year worth of washing machines into remote communities — most end up in dumps within months. This is a design problem, not a supply problem.`,
  },

  whatMakesYouDifferent: {
    short: "We don't deliver products to communities — we co-design them with communities, and our goal is to transfer full manufacturing capability so communities own the means of production. Our philosophy: become unnecessary.",
    medium: `Three things differentiate Goods: (1) Co-design — every product decision is shaped by community feedback. 500+ minutes of recorded community input drove the evolution from V1 Basket Beds to the V4 Stretch Bed. (2) Local production — our containerised mobile factory ($100K invested) turns community waste plastic into bed components on-country, creating jobs and circular economy. (3) Ownership transfer — we don't license. We transfer. Communities receive full training, capability, and documentation. They keep 100% of what they make and sell.`,
  },

  whoDoYouWorkWith: `We work with 8+ remote Indigenous communities across QLD, NT, WA, and SA. Core community partners include Oonchiumpa Consultancy (100% Aboriginal owned, Alice Springs), Wilya Janta (Tennant Creek), and Palm Island Community Company. Health partners include Anyinginyi Health, Miwatj Health, Purple House, and Red Dust. Our 13-member advisory board includes representatives from Snow Foundation, DeadlyScience, Orange Sky, Defy Design, and Zinus.`,

  howDoYouMeasureImpact: `We track impact through: (1) Asset Register — 389 assets with QR-coded lifecycle monitoring across 8 communities. (2) Telemetry — washing machines report cycle counts, energy usage, and operational status in real-time. (3) Community feedback — 500+ minutes recorded, 15+ verified storytellers via Empathy Ledger ethical storytelling platform. (4) Environmental metrics — 9,225kg+ plastic diverted from landfill to date. (5) Health outcomes — tracking scabies reduction, sleep quality, and RHD prevention indicators in partnership with health organisations.`,

  whatAreYourFinancials: `$445,685 in grant funding received to date from Snow Foundation ($193K), The Funding Network ($130K), FRRR ($50K), Vincent Fairfax Family Foundation ($50K), and AMP Spark ($22K). ~$50K in trade revenue. $490K in outstanding receivables (Centrecorp $420K, PICC $36K, Homeland Schools $34K). $100K invested in production facility. Demand exceeds production 3–5x with documented unfilled orders totalling $2M+.`,

  whatIsYourVision: `"In five years time, our dream is to have the best products in the world made by and with the communities themselves." By 2030: communities running production 3+ days/week without us, 30+ community members employed in manufacturing, measurable reductions in scabies and RHD, open-source designs adopted by others, 125 tonnes of plastic diverted annually. Ultimate success: when someone asks "Who makes these?" and the answer is "We do."`,

  howWillYouUseThisFunding: {
    beds: 'Each $600–850 funds one Stretch Bed deployed to a remote community, diverting 20kg of plastic and providing a 10+ year sleeping surface for a family.',
    production: '$100K funds a containerised production facility deployment to a community for ~2 months, producing ~30 beds/week and creating local manufacturing jobs.',
    washers: '$4,000 funds one Pakkimjalki Kari washing machine deployed to a remote community with built-in telemetry and 10+ year design life.',
    scale: '$500K funds working capital for 500+ bed production run, supply chain establishment, and community production training across 3+ communities.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Tags (for grant matching)
// ─────────────────────────────────────────────────────────────────────────────

export const grantKeywords = {
  primary: [
    'indigenous', 'first nations', 'aboriginal', 'torres strait islander',
    'remote communities', 'housing', 'health hardware', 'social enterprise',
    'community owned', 'circular economy', 'recycling', 'manufacturing',
  ],
  secondary: [
    'health', 'wellbeing', 'scabies', 'rheumatic heart disease',
    'overcrowding', 'homelessness', 'youth employment', 'skills training',
    'environmental', 'waste reduction', 'plastic', 'sustainability',
    'co-design', 'community development', 'economic development',
  ],
  sectors: [
    'health', 'housing', 'environment', 'education', 'employment',
    'social enterprise', 'community development', 'manufacturing',
  ],
  geography: ['NT', 'QLD', 'WA', 'SA', 'remote Australia', 'national'],
  eligibility: [
    'ACNC registered charity',
    'DGR status',
    'Company Limited by Guarantee',
    'ABN 50 001 350 152',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Corrections — DO NOT USE these claims
// ─────────────────────────────────────────────────────────────────────────────

export const doNotUse = [
  '"Linda Turner\'s 4-hour laundry trips" — cannot be verified',
  '"Founded 2019, first deliveries 2020" — project kicked off Nov 2022, entity Sep 2023',
  '"$850 single bed, $1,100 double" — Basket Bed ~$350/unit; those were aspirational retail',
  '"Pakkimjalki Kari is Warlpiri" — it\'s Warumungu (Tennant Creek)',
  '"40% community share" — placeholder concept, not committed. Say "community benefit model"',
  'Kristy Bloomfield quote in content.ts — marked PLACEHOLDER, not verified',
  'goodsoncountry.au — wrong domain. Use www.goodsoncountry.com',
  'act.place/goods — wrong URL. Use www.goodsoncountry.com',
];
