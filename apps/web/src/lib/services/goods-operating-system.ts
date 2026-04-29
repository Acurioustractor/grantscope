export const goodsOperatingFacts = [
  { label: 'Tracked assets', value: '389', detail: '369 beds, 20 washing machines, QR register ready' },
  { label: 'Communities', value: '8', detail: 'Palm Island, Tennant Creek, Kalgoorlie, Maningrida and others' },
  { label: 'Demand proof', value: '200-350', detail: 'additional bed requests already documented' },
  { label: 'Scale target', value: '5,000+', detail: 'stretch beds plus 500+ washing machines in the 2026 plan' },
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
