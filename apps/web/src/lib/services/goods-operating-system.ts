export const goodsOperatingFacts = [
  { label: 'Tracked assets', value: '389', detail: '369 beds, 20 washing machines, QR register ready' },
  { label: 'Communities', value: '8', detail: 'Palm Island, Tennant Creek, Kalgoorlie, Maningrida and others' },
  { label: 'Demand proof', value: '200-350', detail: 'additional bed requests already documented' },
  { label: 'Scale target', value: '5,000+', detail: 'stretch beds plus 500+ washing machines in the 2026 plan' },
];

export const goodsMoneySnapshot = [
  {
    label: 'Money received',
    value: '$445,685',
    detail: 'Philanthropic funding received for Goods from Snow, FRRR, VFFF, AMP Spark, and The Funding Network.',
    source: 'Goods project wiki',
  },
  {
    label: 'Revenue recorded',
    value: '$537,595',
    detail: 'Total revenue recorded against the ACT-GD code in the Goods wiki.',
    source: 'ACT-GD finance code',
  },
  {
    label: 'Spend estimate',
    value: '$400 target',
    detail: 'Target delivered cost per bed. This is not safe for QBE/SEFA until replaced with actual last-50-bed cost.',
    source: 'Unit economics claim',
  },
  {
    label: 'Active asks',
    value: '$2.4M+',
    detail: 'REAL $1.2M, QBE ~$210K, Snow ~$200K, PFI $640K, Centrecorp ~$150K, plus SEFA working capital.',
    source: 'Goods funding stack',
  },
  {
    label: 'Cost proof needed',
    value: '50 beds',
    detail: 'Before QBE or SEFA, validate delivered cost on the last 50 beds and attach the budget/use-of-funds sheet.',
    source: 'Unit economics claim',
  },
];

export const goodsFundingPipelineRows = [
  {
    name: 'Snow Foundation',
    lane: 'Foundation',
    status: 'received + active partner',
    value: 'part of $445,685',
    timing: 'now',
    next: 'Confirm payment trail, relationship owner, and Pty migration note before the next ask.',
  },
  {
    name: 'FRRR',
    lane: 'Foundation/grant',
    status: 'received',
    value: 'part of $445,685',
    timing: 'historical',
    next: 'Keep as proof of rural/regional credibility and reporting discipline.',
  },
  {
    name: 'Vincent Fairfax Family Foundation',
    lane: 'Foundation',
    status: 'received',
    value: 'part of $445,685',
    timing: 'historical',
    next: 'Use as a warm proof point for values-aligned foundation asks.',
  },
  {
    name: 'AMP Spark',
    lane: 'Foundation/corporate',
    status: 'received',
    value: 'part of $445,685',
    timing: 'historical',
    next: 'Use as corporate-philanthropy evidence for QBE and other program partners.',
  },
  {
    name: 'The Funding Network',
    lane: 'Foundation/network',
    status: 'received',
    value: 'part of $445,685',
    timing: 'historical',
    next: 'Use as public supporter proof and update story with latest asset deployment.',
  },
  {
    name: 'QBE Catalysing Impact',
    lane: 'QBE program',
    status: 'shortlisted / term-sheet pending',
    value: '~$210K',
    timing: 'live',
    next: 'Finish delivered-cost sheet, budget/use of funds, and funder-ready proof pack.',
  },
  {
    name: 'Snow Foundation',
    lane: 'Grant + impact investment',
    status: 'proposal under review',
    value: '~$200K',
    timing: 'live',
    next: 'Use QBE outcome and unit economics to unlock the impact investment track.',
  },
  {
    name: 'REAL Innovation Fund (DEWR)',
    lane: 'Production facility',
    status: 'EOI submitted via Oonchiumpa consortium',
    value: '$1.2M over 4 years',
    timing: 'live',
    next: 'Treat as the primary production-facility pathway, not a generic grant.',
  },
  {
    name: 'QLD Partnering for Impact',
    lane: 'Repayable investment',
    status: 'EOI pathway',
    value: '$640K of $3.2M',
    timing: 'upcoming',
    next: 'Prepare repayment logic, governance vehicle, and community benefit model.',
  },
  {
    name: 'SEFA',
    lane: 'Impact loan',
    status: 'advanced discussion',
    value: 'working capital',
    timing: 'upcoming',
    next: 'Do not progress without unit economics, buyer pipeline, and repayment logic.',
  },
  {
    name: 'Centrecorp',
    lane: 'Beds / regional buyer',
    status: 'board pathway',
    value: '~$150K',
    timing: 'upcoming',
    next: 'Package Tennant Creek proof, delivery costs, and purchase pathway.',
  },
];

export const goodsJourneyStages = [
  {
    label: 'Proof live',
    status: 'done',
    measure: '389 assets / 8 communities',
    next: 'Keep asset and QR evidence clean.',
  },
  {
    label: 'QBE readiness',
    status: 'current blocker',
    measure: '~$210K ask',
    next: 'Cost sheet + entity option memo.',
  },
  {
    label: 'Funder pipeline',
    status: 'live',
    measure: '$445,685 received',
    next: 'Snow/QBE/FRRR proof and relationship owners.',
  },
  {
    label: 'Production route',
    status: 'submitted',
    measure: '$1.2M REAL EOI',
    next: 'Oonchiumpa consortium and facility logic.',
  },
  {
    label: 'Buyer offer',
    status: 'not packaged',
    measure: 'housing / ACCHO / hostel / mining',
    next: 'Product bundle, price, freight, support.',
  },
  {
    label: 'Scale capital',
    status: 'not ready',
    measure: 'PFI / SEFA / Centrecorp',
    next: 'Repayment logic and buyer pipeline.',
  },
];

export const goodsRelationshipMapRows = [
  {
    name: 'Benjamin Knight',
    role: 'ACT build / systems / evidence',
    status: 'owner needed now',
    next: 'Close cost sheet, proof pack, and source trail.',
  },
  {
    name: 'Nicholas Marchesi OAM',
    role: 'ACT co-founder / design direction',
    status: 'strategic lead',
    next: 'Confirm Goods story, offer shape, and relationship framing.',
  },
  {
    name: 'Snow Foundation',
    role: 'Sally Grimsley-Ballard / Alexandra Lagelee Kean',
    status: 'received + active partner',
    next: 'Confirm payment trail, relationship owner, and Pty migration note.',
  },
  {
    name: 'QBE Catalysing Impact',
    role: 'program partner / live ask',
    status: 'shortlisted',
    next: 'Send only after delivered-cost sheet and entity option memo are clear.',
  },
  {
    name: 'Oonchiumpa',
    role: 'Kristy Bloomfield + Tanya Turner',
    status: 'consortium pathway',
    next: 'Keep REAL production-facility logic aligned to community governance.',
  },
  {
    name: 'Centrecorp Foundation',
    role: 'regional buyer / board pathway',
    status: 'upcoming',
    next: 'Package Tennant Creek proof, delivery costs, and purchase route.',
  },
  {
    name: 'SEFA',
    role: 'impact loan / working capital',
    status: 'not ready',
    next: 'Do not progress before unit economics, buyer pipeline, and repayment logic.',
  },
  {
    name: 'HighLevel',
    role: 'CRM follow-up system',
    status: 'confirm-first',
    next: 'Only send named contact, owner, message angle, due date, and source link.',
  },
];

export const goodsMoneyPileRows = [
  { group: 'received', name: 'Goods philanthropic funding', amount: '$445,685', status: 'received', owner: 'Goods / ACT', next: 'Use as proof for QBE, Snow, foundations, and buyers.' },
  { group: 'recorded', name: 'ACT-GD revenue code', amount: '$537,595', status: 'recorded', owner: 'ACT finance', next: 'Reconcile to receipts, invoices, Dext, and Xero.' },
  { group: 'need proof', name: 'Delivered bed cost target', amount: '$400 target', status: 'unsafe claim', owner: 'Ben', next: 'Replace with last-50-bed delivered cost.' },
  { group: 'active ask', name: 'QBE Catalysing Impact', amount: '~$210K', status: 'shortlisted', owner: 'Ben / Nic', next: 'Finish QBE pack, cost sheet, and entity memo.' },
  { group: 'active ask', name: 'Snow Foundation', amount: '~$200K', status: 'under review', owner: 'Ben / Nic', next: 'Use QBE outcome and unit economics for the next ask.' },
  { group: 'active ask', name: 'REAL Innovation Fund (DEWR)', amount: '$1.2M over 4 years', status: 'submitted', owner: 'Oonchiumpa consortium', next: 'Keep production-facility pathway live.' },
  { group: 'upcoming', name: 'QLD Partnering for Impact', amount: '$640K of $3.2M', status: 'EOI pathway', owner: 'ACT / Goods', next: 'Prepare repayment, governance, and benefit model.' },
  { group: 'upcoming', name: 'SEFA', amount: 'working capital', status: 'not ready', owner: 'ACT / Goods', next: 'Wait for unit economics, buyer pipeline, and repayment logic.' },
  { group: 'upcoming', name: 'Centrecorp Goods route', amount: '~$150K', status: 'board pathway', owner: 'Ben', next: 'Package Tennant Creek proof and purchase route.' },
  { group: 'pitch', name: 'Minderoo Foundation Goods pitch', amount: '$900K', status: 'mid-May pitch', owner: 'Ben / Nic', next: 'Align to Goods, JusticeHub, and ACT shared service proof.' },
  { group: 'receivable', name: 'Snow Foundation INV-0321', amount: '$132,000', status: 'authorised', owner: 'Ben', next: 'Pty migration call with Sally/Alexandra.' },
  { group: 'receivable', name: 'Centrecorp Foundation INV-0314', amount: '$84,700', status: 'draft', owner: 'Ben', next: 'Send, void, or reissue decision.' },
  { group: 'receivable', name: 'Rotary eClub Outback Australia INV-0222', amount: '$82,500', status: 'authorised 380d', owner: 'Ben', next: 'Chase or write-off decision.' },
  { group: 'receivable', name: 'PICC INV-0317 / INV-0324', amount: '$113,300', status: 'authorised', owner: 'ACT / PICC', next: 'Partner receivables follow-up.' },
  { group: 'receivable', name: 'Regional Arts Australia INV-0301 / INV-0302', amount: '$33,000', status: 'authorised 129d', owner: 'Ben', next: 'Chase needed.' },
  { group: 'receivable', name: 'Just Reinvest INV-0295', amount: '$27,500', status: 'authorised', owner: 'JusticeHub', next: 'Confirm payment path.' },
  { group: 'receivable', name: 'Brodie Germaine Fitness INV-0325', amount: '$15,400', status: 'authorised', owner: 'BG Fit / ACT', next: 'Confirm payment path.' },
  { group: 'receivable', name: 'Aleisha J Keating retainers', amount: '$11,700', status: 'authorised', owner: 'ACT finance', next: 'Decide if retainer continues under Pty.' },
  { group: 'receivable', name: 'Homeland School INV-0303', amount: '$4,950', status: 'authorised', owner: 'JusticeHub', next: 'Confirm payment path.' },
  { group: 'receivable', name: 'SMART Recovery INV-0322', amount: '$2,200', status: 'authorised', owner: 'ACT finance', next: 'Confirm payment path.' },
  { group: 'Harvest', name: 'Harvest capital improvement fund', amount: '$250K', status: 'planned', owner: 'Harvest / ACT', next: 'Keep separate from Goods asks.' },
  { group: 'Farm', name: 'Farm lease base rent', amount: '$50K / year', status: 'planned cost', owner: 'Farm / ACT', next: 'Keep as cost exposure, not funder revenue.' },
];

export const goodsPeoplePileRows = [
  { group: 'founder', name: 'Benjamin Knight', org: 'ACT', role: 'build / systems / evidence', status: 'owner now', next: 'Cost sheet, proof pack, source trail.' },
  { group: 'founder', name: 'Nicholas Marchesi OAM', org: 'ACT', role: 'co-founder / design direction', status: 'strategic lead', next: 'Story, offer shape, relationship framing.' },
  { group: 'accounting', name: 'Standard Ledger', org: 'Service provider', role: 'accounting / ABN / GST / BAS / R&D coordination', status: 'engaged', next: 'Pty Xero, ABN, R&D, shareholder agreement referral.' },
  { group: 'bank', name: 'NAB', org: 'Bank', role: 'Pty bank account', status: 'application in flight', next: 'Confirm account readiness.' },
  { group: 'funder', name: 'QBE Catalysing Impact', org: 'QBE', role: 'live Goods ask', status: 'shortlisted', next: 'Do not send without cost sheet and entity memo.' },
  { group: 'funder', name: 'Lucy Stronach', org: 'Minderoo Foundation', role: 'mid-May pitch contact', status: 'active target', next: 'Package Goods + ACT shared service proof.' },
  { group: 'funder', name: 'Sally Grimsley-Ballard / Alexandra Lagelee Kean', org: 'Snow Foundation', role: 'multi-tranche partner', status: 'active partner', next: 'Payment trail and Pty migration call.' },
  { group: 'funder', name: 'William Frazer', org: 'Paul Ramsay Foundation', role: 'partner-tagged in GHL', status: 'relationship', next: 'Keep warm for JusticeHub / civic infrastructure.' },
  { group: 'funder', name: 'June Canavan Foundation', org: 'June Canavan Foundation', role: 'relationship unverified', status: 'possible', next: 'Verify relationship and fit.' },
  { group: 'funder', name: 'Rachel Fyfe / Jessica Duffy', org: 'Dusseldorp Forum', role: 'active partner', status: 'active', next: 'Keep in youth justice / systems-change path.' },
  { group: 'community', name: 'Kristy Bloomfield + Tanya Turner', org: 'Oonchiumpa', role: 'community governance / REAL consortium', status: 'active partner', next: 'Keep production-facility logic aligned.' },
  { group: 'community', name: 'Rachel Atkinson', org: 'PICC', role: 'Palm Island partner', status: 'active partner', next: 'Partner receivables and place-based work.' },
  { group: 'community', name: 'Daniel Daylight', org: 'Mounty Yarns', role: 'Mount Isa partner', status: 'active partner', next: 'Youth / community pathway.' },
  { group: 'community', name: 'Brodie Germaine', org: 'BG Fit', role: 'Mount Isa partner', status: 'active partner', next: 'Confirm payment path and justice pathway.' },
  { group: 'buyer', name: 'Centrecorp Foundation', org: 'Centrecorp', role: 'regional buyer / board path', status: 'upcoming', next: 'Tennant Creek proof and purchase route.' },
  { group: 'capital', name: 'SEFA', org: 'SEFA', role: 'impact loan / working capital', status: 'not ready', next: 'Needs unit economics, buyer pipeline, repayment logic.' },
  { group: 'system', name: 'HighLevel', org: 'CRM', role: 'contacts and follow-up', status: 'confirm-first', next: 'Only named contact, owner, message angle, due date, source link.' },
  { group: 'system', name: 'Supply Nation / IPP pathway', org: 'Procurement', role: 'Indigenous procurement readiness', status: 'possible', next: 'Needs entity and governance memo.' },
  { group: 'capital', name: 'IBA', org: 'First Nations enterprise finance', role: 'enterprise pathway finance', status: 'possible', next: 'Needs governance, ownership, and financial model.' },
  { group: 'buyer', name: 'Housing / hostels / ACCHOs', org: 'Buyer group', role: 'direct purchase / pre-purchase', status: 'possible', next: 'Package buyer offer.' },
  { group: 'buyer', name: 'Mining foundations', org: 'Buyer / foundation group', role: 'place-based pre-purchases', status: 'possible', next: 'Match regions, communities, and purchase offer.' },
  { group: 'buyer', name: 'ALPA / Outback Stores', org: 'Remote retail', role: 'remote distribution / buyer path', status: 'possible', next: 'Needs offer, pricing, logistics.' },
  { group: 'buyer', name: 'SDA / community housing', org: 'Housing market', role: 'fitout / accessible housing buyer', status: 'possible', next: 'Needs product bundle and contracting party.' },
];

export const goodsTargetPileRows = [
  { lane: 'grant', target: 'QBE / Catalysing Impact', money: '~$210K', status: 'live', firstMove: 'Finish cost sheet and entity memo.' },
  { lane: 'foundation', target: 'Snow / VFFF / FRRR / AMP / TFN proof path', money: '$445,685 received proof', status: 'warm proof', firstMove: 'Build relationship-led approach brief.' },
  { lane: 'capital', target: 'SEFA / IBA / PFI', money: 'working capital / $640K+', status: 'not ready', firstMove: 'Repayment, governance, buyer pipeline.' },
  { lane: 'production', target: 'REAL / Oonchiumpa consortium', money: '$1.2M over 4 years', status: 'submitted', firstMove: 'Keep facility logic current.' },
  { lane: 'buyer', target: 'Centrecorp / mining foundations', money: '~$150K+', status: 'upcoming', firstMove: 'Package Tennant Creek proof.' },
  { lane: 'buyer', target: 'ACCHOs / hostels / housing / SDA', money: 'purchase orders', status: 'possible', firstMove: 'Package product, price, freight, support.' },
  { lane: 'shared service', target: 'ACT / CivicGraph / HighLevel / wiki', money: 'retainer or support margin', status: 'needs pricing', firstMove: 'Set support menu and owner table.' },
];

export const goodsCoreWorkAreas = [
  {
    area: 'Delivered cost sheet',
    status: 'blocking',
    next: 'Calculate the last 50 beds delivered cost, margin band, freight, labour, and failure/repair assumptions.',
    proof: 'Actual delivered cost report',
  },
  {
    area: 'QBE pack',
    status: 'live',
    next: 'One clean pack: ask, budget, use of funds, deployment proof, risk, and next 90 days.',
    proof: 'Catalysing Impact application draft',
  },
  {
    area: 'Entity and governance',
    status: 'blocking major asks',
    next: 'Name applicant, contracting party, IP/licence logic, benefit share, and Supply Nation/IPP path.',
    proof: 'Entity option memo',
  },
  {
    area: 'Buyer offer',
    status: 'needs packaging',
    next: 'Define buyer product bundle, price, delivery shape, warranty/support, and reporting promise.',
    proof: 'Goods market intelligence',
  },
  {
    area: 'Evidence pack',
    status: 'ready but needs hygiene',
    next: 'Reconcile 389 canonical asset claim with 404 CSV rows and keep QR/source links clean.',
    proof: 'Asset register + QR manifest',
  },
  {
    area: 'CRM follow-up',
    status: 'needs routing',
    next: 'Move only qualified QBE, Snow, buyer, and foundation follow-ups into HighLevel with a named next touch.',
    proof: 'GHL Goods buyer/demand pipelines',
  },
];

export const goodsFocusedGrantRows = [
  {
    lane: 'QBE first',
    target: 'QBE Catalysing Impact',
    use: 'Catalytic capacity, proof, and operating support.',
    action: 'Finish cost sheet and QBE pack before opening generic grant search.',
    href: '/org/act/wiki/sources/catalysing-impact-application-draft-grant-application',
  },
  {
    lane: 'Production facility',
    target: 'REAL Innovation Fund / PFI',
    use: 'Containerised on-country production capacity and governance pathway.',
    action: 'Keep Oonchiumpa consortium route and repayment/governance logic current.',
    href: '/opportunities/ecosystem?project=goods&lane=capital',
  },
  {
    lane: 'Buyer money',
    target: 'Housing, ACCHO, hostel, mining foundation pre-purchases',
    use: 'Direct purchase or pre-purchase of beds, washing machines, fitouts, logistics, and support.',
    action: 'Package buyer offer before treating these as grants.',
    href: '/opportunities/ecosystem?project=goods&lane=procurement',
  },
  {
    lane: 'Foundation options',
    target: 'Health, dignity, housing, circular economy, First Nations enterprise',
    use: 'Relationship-led asks that fund evidence, community deployment, and scale readiness.',
    action: 'Use received-funder proof before cold foundation outreach.',
    href: '/foundations?project=goods',
  },
  {
    lane: 'Open grants',
    target: 'Manufacturing, circular economy, Indigenous business, regional health',
    use: 'Only grants that match Goods work areas, not broad community noise.',
    action: 'Show a short list after QBE/cost/gov gaps are visible.',
    href: '/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready',
  },
];

export const goodsOperatingOutputs = [
  {
    label: 'Strategic thesis',
    output:
      'Goods is an essential goods and circular materials initiative for remote communities, co-designed with and by First Nations community partners and driven by community needs, priorities, and governance pathways. ACT supplies the shared service spine: evidence, grant/foundation/procurement intelligence, CRM follow-up, finance tagging, application writing, and system reporting.',
    use: 'Use this as the opening paragraph for funders, procurement buyers, and capital partners.',
    source: 'ACT Operational Thesis',
  },
  {
    label: 'Funder roadmap',
    output:
      'The roadmap is proof, production, procurement, then scale: keep the QR asset register clean, prove demand across the first eight communities, secure production and governance capacity, then finance the 2026 target of 5,000+ stretch beds and 500+ washing machines.',
    use: 'Use this as the one-page ambition map instead of writing a new roadmap from scratch.',
    source: 'Goods Path to Thousands 2026',
  },
  {
    label: 'Impact model',
    output:
      'The impact claim joins housing, health, dignity, freight failure, landfill reduction, local repairs, and community benefit pathways. The evidence base is asset deployment, community requests, QR records, quotes, and partner validation.',
    use: 'Use this as the theory-of-change spine for grants and foundation briefs.',
    source: 'Catalysing Impact Application Draft',
  },
  {
    label: 'Operating model',
    output:
      'Goods has separate lanes for grants, foundations, procurement, direct sales, pre-purchase contracts, loans, R&D support, and shared service support from ACT. These lanes should sit beside each other rather than being collapsed into generic fundraising.',
    use: 'Use this as the business model explanation in applications and investor conversations.',
    source: 'Goods Market Intelligence 2026',
  },
];

export const goodsRoadmap = [
  {
    stage: '1. Evidence base',
    now: '389 tracked assets, QR register, expanded asset CSV, early community demand, and deployment records.',
    operatingUse: 'Prove that Goods is already operating, not just proposed.',
  },
  {
    stage: '2. Production readiness',
    now: 'Stretch bed and washing-machine supply logic, production roles, quality-at-scale risks, and support needs are named.',
    operatingUse: 'Show what capacity funding unlocks and what constraints it removes.',
  },
  {
    stage: '3. Procurement routes',
    now: 'Housing fitouts, hostels, ALPA/Outback Stores, ACCHOs, mining foundations, and SDA are active buyer lanes.',
    operatingUse: 'Frame Goods as a contractable offer, not only a grant-dependent project.',
  },
  {
    stage: '4. Capital stack',
    now: 'SEFA, Snow, IBA, Catalysing Impact, R&D tax, and mining foundation pre-purchases are the named finance paths.',
    operatingUse: 'Give each capital source a specific use of funds, proof need, and relationship path.',
  },
];

export const goodsSupportRoutes = [
  {
    lane: 'Grants',
    use: 'Subsidise evidence, production readiness, community deployment, and operating capacity.',
    nextSurface: '/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready',
  },
  {
    lane: 'Foundations',
    use: 'Position Goods as dignity, health, circular economy, First Nations-driven design, community benefit, and place-based systems change.',
    nextSurface: '#project-foundations',
  },
  {
    lane: 'Procurement',
    use: 'Package stretch beds, washing machines, fitouts, logistics, and service support for buyers.',
    nextSurface: '#project-procurement-routes',
  },
  {
    lane: 'Capital',
    use: 'Use loans, pre-purchases, R&D support, and blended capital to finance production and stock runway.',
    nextSurface: '#project-capital-routes',
  },
];

export const goodsImpactRows = [
  {
    signal: 'Housing and dignity',
    evidence: 'Bed deployment, community requests, QR records, and the Catalysing Impact draft.',
    metric: 'Products placed, communities served, requests fulfilled, repair/check-in records.',
  },
  {
    signal: 'Health and wellbeing',
    evidence: 'The draft links sleep, overcrowding, hygiene, and household goods access.',
    metric: 'Households supported, product category, partner validation, follow-up notes.',
  },
  {
    signal: 'Circular materials',
    evidence: 'Asset register, repair/reuse logic, and landfill reduction narrative.',
    metric: 'Items reused, repaired, diverted, replaced, and still active.',
  },
  {
    signal: 'First Nations-driven community benefit',
    evidence: 'First Nations ownership pathway framing, 40 percent community profit-share, community design input, and Supply Nation pathway.',
    metric: 'Governance pathway, community design input, community benefit allocation, and Indigenous procurement readiness.',
  },
];

export const goodsRiskRows = [
  {
    risk: 'First Nations governance and ownership pathway',
    response:
      'Keep ACT as the shared-service umbrella while documenting the right co-designed, partner-governed, or future First Nations-owned operating pathway, including governance rights, licensing, and benefit-share logic.',
    owner: 'Governance / legal',
  },
  {
    risk: 'Production capacity at scale',
    response: 'Tie funding to specific capacity: stock, tools, quality assurance, repair process, logistics, and delivery partners.',
    owner: 'Production / operations',
  },
  {
    risk: 'Application credibility',
    response: 'Use existing evidence first: QR register, asset CSV, community demand, market intelligence, and previous application language.',
    owner: 'ACT shared service',
  },
  {
    risk: 'Procurement readiness',
    response: 'Separate buyer offers from grant asks: product, price, delivery shape, proof, contracting party, and follow-up path.',
    owner: 'Commercial / partnerships',
  },
];

export const goodsGovernanceRows = [
  {
    area: 'ACT role',
    position: 'ACT remains the shared service, evidence, systems, CRM, finance-tagging, and application capability layer.',
    decision: 'Use ACT for infrastructure and support evidence.',
  },
  {
    area: 'Goods vehicle',
    position:
      'Goods needs a First Nations-driven operating pathway: a co-designed community-governed model, co-op, formal partner-governance model, or future First Nations-owned vehicle that is credible for procurement and benefit sharing.',
    decision: 'Use the entity memo to choose vehicle, applicant, contracting party, governance model, and licence model.',
  },
  {
    area: 'Community benefit',
    position: 'The 40 percent community profit-share narrative gives funders a clear accountability and redistribution story.',
    decision: 'Tie benefit-share to reporting cadence and project codes.',
  },
  {
    area: 'IP and licence',
    position: 'ACT/Goods should distinguish system IP, product design, community story, data, and operating brand permissions.',
    decision: 'Attach an IP/licence note to major funder and investor asks.',
  },
];

export const goodsPeopleRows = [
  {
    role: 'Community authority',
    who: 'Palm Island, Tennant Creek, Oonchiumpa, place partners, and community voices.',
    use: 'Validate demand, benefit, story, governance, and local delivery.',
  },
  {
    role: 'Production and logistics',
    who: 'Goods delivery team, repair/support roles, warehouse/fleet, and manufacturing partners.',
    use: 'Prove capacity, quality, timing, cost, and scale constraints.',
  },
  {
    role: 'Buyer and funder relationships',
    who: 'Foundations, mining partners, ACCHOs, hostels, government buyers, and social procurement networks.',
    use: 'Convert evidence into next touch, buyer offer, or funding ask.',
  },
  {
    role: 'ACT shared service',
    who: 'CivicGraph, GHL, finance/project codes, grant finder, wiki, application writing, and reporting.',
    use: 'Keep the operating rhythm and evidence pack current.',
  },
];

export const goodsSystemsRows = [
  {
    system: 'Goods Asset Register',
    owns: 'Assets, QR codes, products, deployment evidence, claim/check-in records.',
    mirror: 'Only summary signals and source links should appear in CivicGraph.',
  },
  {
    system: 'CivicGraph / GrantScope',
    owns: 'Grant, foundation, procurement, pipeline, relationship, and evidence-routing intelligence.',
    mirror: 'Route decisions, source-backed support actions, and application-ready evidence.',
  },
  {
    system: 'GHL CRM',
    owns: 'Contacts, follow-ups, relationship status, messages, and next touches.',
    mirror: 'Only qualified funder, buyer, partner, and governance follow-ups.',
  },
  {
    system: 'ACT global infrastructure',
    owns: 'Project codes, operational thesis, finance tags, repo map, Dext rules, knowledge ops.',
    mirror: 'Shared service proof and operating cadence.',
  },
];

export const goodsCapitalRows = [
  {
    source: 'Catalysing Impact / grant capital',
    ask: 'Evidence, capacity, community deployment, production readiness, and operating support.',
    proof: 'Application draft, asset register, demand proof, budget, and impact model.',
  },
  {
    source: 'Snow / philanthropic loan',
    ask: 'Patient capital for stock, production, and delivery capacity.',
    proof: 'Repayment logic, buyer routes, governance, risk register, and scale plan.',
  },
  {
    source: 'IBA / First Nations enterprise pathway finance',
    ask: 'Enterprise pathway, community governance, ownership options, capability, and asset-backed growth support.',
    proof: 'Entity option memo, Supply Nation pathway, community benefit, and financial model.',
  },
  {
    source: 'Mining foundation pre-purchases',
    ask: 'Place-based pre-purchase of essential goods for communities connected to regional operations.',
    proof: 'Community need, product cost, logistics, buyer offer, and reporting pack.',
  },
  {
    source: 'R&D tax and ACT support',
    ask: 'Recognise product, systems, materials, QR/process, and operating experimentation.',
    proof: 'Project codes, receipts, technical notes, Dext/Xero evidence, and activity logs.',
  },
];

export const goodsSourceDocuments = [
  {
    label: 'Goods Asset Register README',
    source: 'Goods Asset Register README',
    kind: 'Operating evidence',
    use: 'Explains what the Goods asset register is, why it exists, and how QR-linked product evidence works.',
    bestFor: 'Use when a grant, buyer, or partner asks whether Goods is already operating.',
    output: 'operating proof',
  },
  {
    label: 'Goods Expanded Asset CSV',
    source: 'Goods Expanded Asset CSV',
    kind: 'Asset data',
    use: 'Structured asset-level records for product count, deployment evidence, and claims about the register.',
    bestFor: 'Use when you need numbers, product counts, or evidence behind asset claims.',
    output: 'asset evidence',
  },
  {
    label: 'Catalysing Impact Application Draft',
    source: 'Catalysing Impact Application Draft',
    kind: 'Grant draft',
    use: 'Reusable application language for the problem, impact model, proposed work, budget logic, and funder ask.',
    bestFor: 'Use when writing a grant section instead of starting from a blank page.',
    output: 'grant text',
  },
  {
    label: 'Goods Path to Thousands 2026',
    source: 'Goods Path to Thousands 2026',
    kind: 'Scale plan',
    use: 'Roadmap for production, procurement, stock, delivery, and the 2026 scale story.',
    bestFor: 'Use when explaining what capacity funding or procurement demand unlocks.',
    output: 'roadmap',
  },
  {
    label: 'Goods Market Intelligence 2026',
    source: 'Goods Market Intelligence 2026',
    kind: 'Market strategy',
    use: 'Buyer lanes, revenue routes, procurement positioning, and market logic for Goods.',
    bestFor: 'Use when deciding whether an opportunity is grant, foundation, procurement, or capital work.',
    output: 'route strategy',
  },
  {
    label: 'Snow Submission Review February 2026',
    source: 'Snow Submission Review February 2026',
    kind: 'Review notes',
    use: 'Critique of the Snow submission, including proof gaps, framing issues, and investor/foundation readiness.',
    bestFor: 'Use before approaching patient capital or foundations so the ask is sharper.',
    output: 'proof gaps',
  },
  {
    label: 'ACT Operational Thesis',
    source: 'ACT Operational Thesis',
    kind: 'Shared service model',
    use: 'The ACT operating logic: shared systems, project lanes, evidence, CRM, finance, and knowledge infrastructure.',
    bestFor: 'Use when explaining what ACT contributes without making Goods sound generic.',
    output: 'operating model',
  },
  {
    label: 'ACT Project Codes',
    source: 'ACT Project Codes',
    kind: 'Finance map',
    use: 'Project-code structure for linking spend, receipts, Xero/Dext, R&D evidence, and reporting.',
    bestFor: 'Use when building budgets, use-of-funds tables, or financial evidence packs.',
    output: 'finance evidence',
  },
];

export const goodsWikiOutputs = [
  {
    label: 'Grant application pack',
    use: 'Use the strategy thesis, impact model, source docs, budget proof, and risk rows to assemble application sections quickly.',
    sections: ['summary', 'eligibility', 'budget', 'outcomes', 'evidence', 'attachments'],
  },
  {
    label: 'Procurement offer',
    use: 'Use the buyer lanes, production readiness, systems map, pricing proof, and contracting decision frame to brief buyers.',
    sections: ['buyer', 'need', 'offer', 'price', 'delivery', 'proof'],
  },
  {
    label: 'Foundation brief',
    use: 'Use the impact model, relationship map, community authority, source pack, and capital stack to shape relationship-led asks.',
    sections: ['fit', 'relationship path', 'ask', 'proof', 'vehicle', 'next touch'],
  },
  {
    label: 'Investor and capital pack',
    use: 'Use the roadmap, capital stack, governance map, risk register, and procurement routes to show credible use of funds.',
    sections: ['ask', 'use of funds', 'repayment logic', 'impact logic', 'proof', 'risk'],
  },
];
