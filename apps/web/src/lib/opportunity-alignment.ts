export type ActRole = 'lead' | 'partner' | 'contractor' | 'monitor';
export type AlignmentTheme = 'civicgraph' | 'goods' | 'justicehub' | 'empathy-ledger' | 'act-studio';
export type ActProjectLayer = 'memory' | 'signal' | 'ledger' | 'surface' | 'edge' | 'enterprise';
export type ActProjectReadiness = 'active' | 'live-proof' | 'pitch-ready' | 'needs-cleanup' | 'decision-needed';
export type ActOperatingRole = 'ic' | 'dri' | 'player-coach' | 'intelligence-layer';

export interface EcosystemOpportunity {
  id: string;
  name: string;
  source: string;
  amount: string;
  geography: string;
  deadline?: string;
  theme: AlignmentTheme;
  actRole: ActRole;
  fitScore: number;
  why: string;
  evidenceNeed: string;
  nextMove: string;
  query: string;
}

export interface EcosystemPerson {
  name: string;
  org: string;
  role: string;
  relevance: string;
  relationshipMove: string;
}

export interface EcosystemSignal {
  title: string;
  organisations: string[];
  relevance: string;
  actPosition: string;
}

export type CivicGraphPresence = 'matched' | 'partial' | 'not-found';

export interface EcosystemOrganisation {
  name: string;
  civicGraphName?: string;
  presence: CivicGraphPresence;
  entityType: string;
  geography: string;
  relationship: string;
  actRelevance: string;
}

export type EcosystemActionType = 'outreach' | 'ingest' | 'brief' | 'product';

export interface EcosystemAction {
  id: string;
  type: EcosystemActionType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  owner: string;
  relatedTo: string[];
  whyNow: string;
  nextStep: string;
  query?: string;
}

export interface EcosystemQueryPack {
  id: string;
  title: string;
  purpose: string;
  prompts: string[];
  tables: string[];
}

export interface ActOperatingLayer {
  id: string;
  title: string;
  layer: ActProjectLayer;
  role: string;
  currentState: string;
  opportunityUse: string;
  source: string;
}

export interface ActProjectState {
  code: string;
  name: string;
  layer: ActProjectLayer;
  readiness: ActProjectReadiness;
  currentState: string;
  intelligenceRole: string;
  opportunityAlignment: string;
  nextQuestion: string;
  source: string;
}

export interface ActRolePattern {
  role: ActOperatingRole;
  label: string;
  useInAct: string;
  opportunityQuestion: string;
}

export interface ActKnowledgeLoopStep {
  step: string;
  job: string;
  system: string;
  opportunityUse: string;
}

export interface ActReviewFinding {
  title: string;
  status: 'verified' | 'inferred' | 'unknown';
  evidence: string;
  implication: string;
}

export const ACT_POSITION = {
  summary:
    'A Curious Tractor sits as civic infrastructure, evidence, and deal-flow intelligence inside the social impact ecosystem: rarely the only applicant, often the mapmaker, evaluator, governance layer, partner finder, and public-interest data contractor that makes stronger applications possible.',
  leadWhen:
    'Lead when the opportunity funds public-interest data infrastructure, civic technology, storytelling infrastructure, or a specific ACT portfolio asset with a clear budget and delivery site.',
  partnerWhen:
    'Partner when the fund requires a precinct, university, council, community-controlled organisation, accelerator cohort, regional intermediary, or capital infrastructure lead.',
  contractWhen:
    'Contract when a lead applicant needs ecosystem mapping, grant intelligence, due diligence, social procurement evidence, impact measurement, governance dashboards, or a public accountability layer.',
  deepReview:
    'The stronger ACT pattern is not a grants directory. It is decentralised civic intelligence: Tractorpedia holds durable memory, Empathy Ledger holds live story and consent signals, CivicGraph/Supabase holds the operational ledger, and public/project surfaces compose the evidence into action.',
};

export const ACT_OPERATING_LAYERS: ActOperatingLayer[] = [
  {
    id: 'tractorpedia',
    title: 'Tractorpedia / ACT wiki',
    layer: 'memory',
    role: 'Durable memory, project truth, concepts, decisions, and synthesis.',
    currentState: 'Acts as the canonical graph for project identity, operating principles, and cross-system source provenance.',
    opportunityUse: 'Every opportunity brief should link to project codes, source pages, and current-state synthesis before drafting claims.',
    source: 'act-global-infrastructure/wiki/technical/act-knowledge-ops-loop.md',
  },
  {
    id: 'empathy-ledger',
    title: 'Empathy Ledger',
    layer: 'signal',
    role: 'Live stories, storytellers, media, consent, and narrative sovereignty.',
    currentState: 'The live field layer and consent-aware proof surface for ACT projects and communities.',
    opportunityUse: 'Supplies story proof, consent boundaries, lived-experience evidence, and editorial selections for proposals and acquittals.',
    source: 'act-global-infrastructure/wiki/concepts/third-reality.md',
  },
  {
    id: 'civicgraph',
    title: 'CivicGraph / GrantScope',
    layer: 'ledger',
    role: 'Entity, funding, place, procurement, opportunity, and relationship intelligence.',
    currentState: 'Operational graph for ACT and the broader civic economy, including live GrantScope opportunity alignment.',
    opportunityUse: 'Finds partners, eligibility blockers, funding gaps, capital flows, ABN footing, and evidence risk quickly.',
    source: 'act-global-infrastructure/wiki/concepts/civic-world-model.md',
  },
  {
    id: 'public-surfaces',
    title: 'Websites and project surfaces',
    layer: 'surface',
    role: 'Public composition, navigation, invitation, and syndication.',
    currentState: 'Downstream of wiki memory and live Empathy Ledger proof; should not invent parallel truth.',
    opportunityUse: 'Turns the same source graph into partner briefs, public cases, funder proof pages, and project front doors.',
    source: 'act-global-infrastructure/wiki/concepts/living-website-operating-system.md',
  },
  {
    id: 'edge-projects',
    title: 'Edge projects and communities',
    layer: 'edge',
    role: 'Human judgment, community trust, design, delivery, listening, and ethical calls.',
    currentState: 'JusticeHub, Goods, Gold.Phone, Harvest, Farm, PICC, Contained, and related works hold applied proof.',
    opportunityUse: 'Decides which opportunities are real work, which need partners, and which should be ignored.',
    source: 'act-global-infrastructure/wiki/decisions/roadmap-2026.md',
  },
  {
    id: 'enterprise-loop',
    title: 'Enterprise and financial loop',
    layer: 'enterprise',
    role: 'Project codes, receipts, R&D evidence, receivables, grants, and revenue pathways.',
    currentState: 'Seven financial buckets and project-code edges make money, time, stories, and grants traceable.',
    opportunityUse: 'Connects applications to budgets, co-contributions, acquittal evidence, and project sustainability.',
    source: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
  },
];

export const ACT_PROJECT_STATES: ActProjectState[] = [
  {
    code: 'ACT-IN',
    name: 'Infrastructure / ALMA / Wiki / AI systems',
    layer: 'memory',
    readiness: 'active',
    currentState: '$194K and 992 transactions in the operational thesis; core R&D bucket and shared intelligence substrate.',
    intelligenceRole: 'Keeps the centre coherent: project codes, wiki, agent workflows, AI context, and system memory.',
    opportunityAlignment: 'Best framed as platform R&D, knowledge infrastructure, governance, and evidence automation.',
    nextQuestion: 'Which opportunity surfaces can pay for the substrate without making it look like generic SaaS?',
    source: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
  },
  {
    code: 'ACT-CS',
    name: 'CivicGraph / GrantScope',
    layer: 'ledger',
    readiness: 'pitch-ready',
    currentState: 'Recognised in the project truth state as active/pitchable but needing tighter code and public-surface alignment.',
    intelligenceRole: 'The civic world model: entity, funding, place, procurement, and opportunity routing.',
    opportunityAlignment: 'The primary wedge for funder evidence, SEQ partner discovery, social procurement, and opportunity matching.',
    nextQuestion: 'Which query mode becomes the first repeatable paid product: opportunity fit, partner map, place evidence, or acquittal proof?',
    source: 'act-global-infrastructure/wiki/concepts/civic-world-model.md',
  },
  {
    code: 'ACT-EL',
    name: 'Empathy Ledger',
    layer: 'signal',
    readiness: 'live-proof',
    currentState: 'v2 storyteller portal live, verbal consent active, OCAP governance in play, and cross-org photo manager shipped.',
    intelligenceRole: 'Turns sovereign human narrative into governed signal rather than extractive story capture.',
    opportunityAlignment: 'Makes applications credible where lived experience, storytelling, consent, and cultural protocol matter.',
    nextQuestion: 'Which funders need Third Reality proof instead of conventional impact reporting?',
    source: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
  },
  {
    code: 'ACT-JH',
    name: 'JusticeHub',
    layer: 'ledger',
    readiness: 'live-proof',
    currentState: 'Ecosystem-tier project with judges-on-country commitment and most development time historically flowing through ACT-IN.',
    intelligenceRole: 'Evidence layer for youth justice alternatives, programs, legal context, and community-led solutions.',
    opportunityAlignment: 'Strong fit for justice, accountability, policy, and community diversion opportunities.',
    nextQuestion: 'Which JusticeHub proof lines can be reused in grant scans without overclaiming or flattening community authority?',
    source: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
  },
  {
    code: 'ACT-GD',
    name: 'Goods on Country',
    layer: 'edge',
    readiness: 'active',
    currentState: '$55K and 197 transactions; Minderoo $900K pitch mid-May, Centrecorp tranche pending, Snow tranche outstanding.',
    intelligenceRole: 'Physical proof that community narrative, procurement, design, and delivery data can converge.',
    opportunityAlignment: 'High fit for rural assets, social procurement, Indigenous enterprise, manufacturing, and place-based resilience.',
    nextQuestion: 'Which partner leads can carry capital or infrastructure eligibility while ACT provides design and evidence intelligence?',
    source: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
  },
  {
    code: 'ACT-HV',
    name: 'Harvest',
    layer: 'enterprise',
    readiness: 'decision-needed',
    currentState: '$97K and 119 transactions; lease signing pending and capital improvement fund at $250K.',
    intelligenceRole: 'Grounded enterprise pathway and practical revenue loop for the broader ecosystem.',
    opportunityAlignment: 'Relevant for regional enterprise, food systems, place activation, and practical community infrastructure.',
    nextQuestion: 'Which opportunities need the lease/entity decision resolved before ACT can credibly apply?',
    source: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
  },
  {
    code: 'ACT-FM',
    name: 'Farm / BCV',
    layer: 'enterprise',
    readiness: 'decision-needed',
    currentState: '$55K and 163 transactions; new lease to Pty and farm entity still to be decided.',
    intelligenceRole: 'Land, stewardship, enterprise, and grounded experimentation site.',
    opportunityAlignment: 'Fit for land stewardship, regenerative practice, and capital works only after entity/risk structure is clear.',
    nextQuestion: 'What is the right legal and operational wrapper before grants or capital improvements attach?',
    source: 'act-global-infrastructure/wiki/decisions/roadmap-2026.md',
  },
  {
    code: 'ACT-PI',
    name: 'PICC / Palm Island Community Company work',
    layer: 'edge',
    readiness: 'active',
    currentState: '$66K and 8 transactions; ecosystem-tier project tied to Indigenous partners and place-based delivery.',
    intelligenceRole: 'Community authority and place-based proof line for work that must stay consent- and protocol-led.',
    opportunityAlignment: 'Relevant where Palm Island, cultural authority, youth, community infrastructure, or partner-led delivery is central.',
    nextQuestion: 'Which opportunities should be partner-led by community organisations rather than ACT-led?',
    source: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
  },
  {
    code: 'ACT-MY',
    name: 'Mounty Yarns',
    layer: 'edge',
    readiness: 'active',
    currentState: '$26K and 42 transactions; active place and partner line in the operational thesis.',
    intelligenceRole: 'Regional storytelling and relationship proof, especially around Mount Isa and connected youth/community work.',
    opportunityAlignment: 'Useful for rural, regional, youth, arts, and place-based grant narratives.',
    nextQuestion: 'What reusable evidence pack should GrantScope generate for Mount Isa and related partners?',
    source: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
  },
  {
    code: 'ACT-GP',
    name: 'Gold.Phone',
    layer: 'signal',
    readiness: 'live-proof',
    currentState: 'Load-bearing work in the project truth state and Third Reality stack.',
    intelligenceRole: 'Captures emotional truth and routes it into governed synthesis without turning voice into extractive data.',
    opportunityAlignment: 'Strong for arts, storytelling infrastructure, civic listening, public engagement, and research partnerships.',
    nextQuestion: 'Which opportunities value civic listening as infrastructure rather than as an engagement activity?',
    source: 'act-global-infrastructure/wiki/concepts/third-reality.md',
  },
  {
    code: 'ACT-CN',
    name: 'Contained',
    layer: 'surface',
    readiness: 'pitch-ready',
    currentState: 'Public tour/readiness thread in the broader ACT project universe.',
    intelligenceRole: 'Immersive public surface where story, evidence, and invitation can travel to partners and communities.',
    opportunityAlignment: 'Relevant to touring, public art, youth justice storytelling, events, and partner activation.',
    nextQuestion: 'Which funder brief needs Contained as the experience layer and CivicGraph as the evidence layer?',
    source: 'act-global-infrastructure/wiki/decisions/roadmap-2026.md',
  },
  {
    code: 'ACT-CORE',
    name: 'ACT Core / studio operating model',
    layer: 'memory',
    readiness: 'needs-cleanup',
    currentState: 'Core facts note a 30 June 2026 cutover, new Pty from 1 July, and roughly $507K outstanding receivables.',
    intelligenceRole: 'Governance, operating rhythm, player-coach pattern, project code discipline, and founder context transfer.',
    opportunityAlignment: 'Every opportunity needs entity, bank, insurance, IP, and co-contribution readiness checked against this layer.',
    nextQuestion: 'Which blockers must be resolved before large funds such as SEQ IEF or CRC-P are pursued?',
    source: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
  },
];

export const ACT_ROLE_PATTERNS: ActRolePattern[] = [
  {
    role: 'intelligence-layer',
    label: 'System as centre',
    useInAct: 'Tractorpedia, CivicGraph, Empathy Ledger, Supabase, and generated surfaces hold shared context.',
    opportunityQuestion: 'Can the system answer who, where, why, evidence, budget, risk, and next action without a human routing everything?',
  },
  {
    role: 'ic',
    label: 'IC / maker mode',
    useInAct: 'People build pages, prototypes, evidence packs, comms drafts, data fixes, and partner materials.',
    opportunityQuestion: 'What concrete artifact can one person ship this week to improve the fit or evidence base?',
  },
  {
    role: 'dri',
    label: 'DRI / outcome owner',
    useInAct: 'One person owns the outcome for a seed, application, partner brief, or delivery sprint.',
    opportunityQuestion: 'Who owns the yes/no decision, partner path, deadline, budget, and final submission quality?',
  },
  {
    role: 'player-coach',
    label: 'Player-coach',
    useInAct: 'Founders and senior operators lift capability, protect values, mentor, unblock, and do substantive work.',
    opportunityQuestion: 'Who protects cultural protocol, narrative sovereignty, quality, and strategic focus while the work moves fast?',
  },
];

export const ACT_KNOWLEDGE_LOOP: ActKnowledgeLoopStep[] = [
  {
    step: 'Capture',
    job: 'Drop raw opportunities, emails, screenshots, transcripts, and source links into the memory layer.',
    system: 'wiki/raw, wiki/sources, Empathy Ledger, Supabase',
    opportunityUse: 'No opportunity brief should start from vibes; it starts with source objects.',
  },
  {
    step: 'Compress',
    job: 'Summarise what matters, who it touches, eligibility, deadline, capital requirements, and evidence needs.',
    system: 'Tractorpedia synthesis and API summaries',
    opportunityUse: 'Makes a messy newsletter or PDF legible in minutes.',
  },
  {
    step: 'Attach',
    job: 'Link the source to project codes, people, places, entities, and live proof.',
    system: 'project codes, gs_entities, grant_opportunities, EL keys',
    opportunityUse: 'Prevents generic grant chasing by forcing every opportunity to land somewhere real.',
  },
  {
    step: 'Steward',
    job: 'Assign DRI, owner, next action, and review date without creating a coordination layer.',
    system: 'ACT operating model and GrantScope actions',
    opportunityUse: 'Turns discovery into accountable movement.',
  },
  {
    step: 'Use',
    job: 'Generate partner briefs, evidence packs, applications, outreach notes, or no-go decisions.',
    system: 'CivicGraph/GrantScope and public surfaces',
    opportunityUse: 'The system outputs work, not just knowledge.',
  },
  {
    step: 'Improve',
    job: 'Backfill aliases, canonical slugs, source pages, entity records, and query modes when gaps appear.',
    system: 'wiki lint, data health, materialized views, ingestion queues',
    opportunityUse: 'Every scan improves the next scan.',
  },
];

export const ACT_DEEP_REVIEW_FINDINGS: ActReviewFinding[] = [
  {
    title: 'The opportunity system needs ACT-wide project state, not just newsletter extraction.',
    status: 'verified',
    evidence: 'The project truth-state review covers 74 project codes across wiki, database, codebase references, and Xero.',
    implication: 'Opportunity alignment should always include project code, readiness, entity footing, evidence source, and next action.',
  },
  {
    title: 'The main automation blocker is identity hygiene, not lack of ideas.',
    status: 'verified',
    evidence: 'The truth-state review flags 40+ project codes missing canonical_slug values and ACT-PS as the real authoring gap.',
    implication: 'GrantScope should include an identity-resolution queue before drafting high-stakes applications.',
  },
  {
    title: 'Large opportunities will hit governance and co-contribution readiness quickly.',
    status: 'verified',
    evidence: 'ACT core facts list the 30 June 2026 cutover, new Pty operations from 1 July 2026, pending bank/insurance/IP work, and roughly $507K receivables.',
    implication: 'SEQ IEF and CRC-P briefs need a readiness check before ACT is positioned as lead or co-contributor.',
  },
  {
    title: 'ACT is best described as decentralised civic intelligence, not a conventional social enterprise.',
    status: 'inferred',
    evidence: 'The wiki model separates memory, live signal, ledger, surface, edge projects, and enterprise loops.',
    implication: 'The strongest pitch is small core, big edge: system holds context, humans hold judgment and relationships.',
  },
  {
    title: 'BFGN supporters are a useful test set for CivicGraph ingestion quality.',
    status: 'verified',
    evidence: 'The scan found many matched organisations and several missing or ambiguous supporter names.',
    implication: 'Every visible ecosystem node should become matched, partial, or queued, with ABN/legal-name provenance.',
  },
];

export const BFGN_MAY_2026_OPPORTUNITIES: EcosystemOpportunity[] = [
  {
    id: 'social-justice-fund-ejf',
    name: 'Social Justice Fund EJF',
    source: 'BFGN May 2026',
    amount: '$10,000',
    geography: 'Australia',
    theme: 'justicehub',
    actRole: 'lead',
    fitScore: 72,
    why: 'Small, fast, grassroots organising money. Useful for a tightly scoped civic education, accountability, or community organising sprint linked to JusticeHub or CivicGraph.',
    evidenceNeed: 'A named community, a short organising arc, and a clear public-interest output.',
    nextMove: 'Shape a narrow campaign: local power map, community briefing, and follow-up action pack.',
    query: 'social justice grassroots organising accountability community justice',
  },
  {
    id: 'crc-p-round-19',
    name: 'CRC-P Round 19',
    source: 'BFGN May 2026',
    amount: '$3M',
    geography: 'Australia',
    theme: 'civicgraph',
    actRole: 'partner',
    fitScore: 82,
    why: 'Strong strategic fit if CivicGraph is positioned as applied research infrastructure with industry partners, universities, and public-interest use cases.',
    evidenceNeed: 'Industry-led consortium, research partner, commercialisation plan, matched cash/in-kind, and a defined technical work program.',
    nextMove: 'Build a CRC-P concept around civic data infrastructure for social procurement, impact investing, or government accountability.',
    query: 'CRC-P industry research collaboration civic data social procurement impact investing',
  },
  {
    id: 'unsw-founders-10x',
    name: 'UNSW Founders 10x Accelerator',
    source: 'BFGN May 2026',
    amount: '$100,000',
    geography: 'NSW / national startup pathway',
    theme: 'civicgraph',
    actRole: 'lead',
    fitScore: 76,
    why: 'Good venture pathway if CivicGraph is framed as a scalable intelligence product for funders, intermediaries, and social procurement teams.',
    evidenceNeed: 'Startup thesis, customer proof, product wedge, and clear revenue model.',
    nextMove: 'Package CivicGraph as the operating system for opportunity, entity, and funding intelligence.',
    query: 'startup accelerator civic technology data intelligence social impact',
  },
  {
    id: '26ten-workplace-grants',
    name: '26Ten Workplace Grants',
    source: 'BFGN May 2026',
    amount: '$65,000',
    geography: 'Tasmania',
    theme: 'goods',
    actRole: 'monitor',
    fitScore: 38,
    why: 'Low direct fit unless ACT is supporting a Tasmanian partner with workforce literacy, numeracy, or training infrastructure.',
    evidenceNeed: 'Tasmanian workplace partner and workforce learning plan.',
    nextMove: 'Monitor for partner-led workforce capability work; do not spend lead-applicant time now.',
    query: 'Tasmania workplace literacy numeracy social enterprise training',
  },
  {
    id: 'collier-charitable-fund',
    name: 'Collier Charitable Fund Grants',
    source: 'BFGN May 2026',
    amount: 'Not specified',
    geography: 'Australia',
    theme: 'act-studio',
    actRole: 'partner',
    fitScore: 61,
    why: 'Broad charitable causes can support community-facing work, but the ask needs a clear beneficiary group rather than platform infrastructure alone.',
    evidenceNeed: 'Charitable purpose, named beneficiary group, delivery partner, and practical output.',
    nextMove: 'Use only when a portfolio project has a community partner and defined charitable delivery.',
    query: 'charitable fund community causes Australia grants',
  },
  {
    id: 'protostars-blackbird',
    name: 'Protostars (Blackbird Foundation)',
    source: 'BFGN May 2026',
    amount: '$1,000',
    geography: 'Australia',
    theme: 'empathy-ledger',
    actRole: 'partner',
    fitScore: 54,
    why: 'Small youth passion-project money. Useful if ACT backs young creators or builders using Empathy Ledger or CivicGraph material.',
    evidenceNeed: 'Young person as applicant/lead and a bounded build/storytelling project.',
    nextMove: 'Keep as youth collaborator pathway, not core ACT funding.',
    query: 'young people passion projects Blackbird Foundation storytelling tech',
  },
  {
    id: 'westpac-social-change-fellowship',
    name: 'Westpac Social Change Fellowship',
    source: 'BFGN May 2026',
    amount: '$50,000',
    geography: 'Australia',
    theme: 'act-studio',
    actRole: 'lead',
    fitScore: 79,
    why: "High fit for founder leadership, ecosystem learning, and scaling ACT's role as civic infrastructure for social change.",
    evidenceNeed: 'Personal leadership arc, systems-change agenda, learning plan, and network benefit.',
    nextMove: "Frame the fellowship around building Australia's public-interest opportunity intelligence layer.",
    query: 'social change fellowship leadership civic infrastructure systems change',
  },
  {
    id: 'frrr-strengthening-rural-communities',
    name: 'FRRR Strengthening Rural Communities',
    source: 'BFGN May 2026',
    amount: '$50,000',
    geography: 'Regional / rural Australia',
    theme: 'goods',
    actRole: 'partner',
    fitScore: 74,
    why: 'Strong partner fit for regional communities, community-owned assets, Goods, local procurement, and place-based evidence packs.',
    evidenceNeed: 'Rural community partner, local need, local governance, and clear community benefit.',
    nextMove: 'Use CivicGraph to identify rural partner places and build evidence for a community-led applicant.',
    query: 'rural community grant social enterprise procurement community owned assets',
  },
  {
    id: 'seq-innovation-economy-fund',
    name: 'SEQ Innovation Economy Fund',
    source: 'BFGN May 2026',
    amount: '$500,000 to $5,212,840',
    geography: 'South East Queensland',
    deadline: '2026-06-25',
    theme: 'civicgraph',
    actRole: 'partner',
    fitScore: 86,
    why: 'Very strong strategic fit if ACT is the CivicGraph, governance, impact, and ecosystem intelligence layer inside a precinct-led capital project.',
    evidenceNeed: 'Eligible SEQ precinct lead, site, capital budget, 50% cash co-contribution, jobs case, and partner commitments.',
    nextMove: 'Build a partner pitch to universities, councils, innovation hubs, and social enterprise infrastructure leads in Brisbane/Sunshine Coast.',
    query: 'SEQ innovation economy fund infrastructure precinct civic data governance jobs Queensland',
  },
  {
    id: 'vic-trees-on-farms',
    name: 'VIC Trees on Farms Program',
    source: 'BFGN May 2026',
    amount: '$80,000',
    geography: 'Victoria',
    theme: 'goods',
    actRole: 'monitor',
    fitScore: 42,
    why: 'Indirect fit through Harvest/regenerative work only if there is a Victorian farm partner.',
    evidenceNeed: 'Victorian landholder or farm partner and planting plan.',
    nextMove: 'Hold as a Harvest partner lead, not an ACT core pursuit.',
    query: 'Victoria trees farms regenerative agriculture community grant',
  },
];

export const BFGN_MAY_2026_PEOPLE: EcosystemPerson[] = [
  {
    name: 'Javier Casanova',
    org: 'BFGN',
    role: 'COO',
    relevance: 'Curates the opportunity/news/event stream for business-for-good operators.',
    relationshipMove: 'Treat as a channel and ecosystem intelligence node; ask about member needs for opportunity matching and readiness.',
  },
  {
    name: 'Kristie Ivone',
    org: 'Boas Language Academy',
    role: 'Founder',
    relevance: 'Rural women, language, education, and social enterprise signal.',
    relationshipMove: 'Potential case study or partner for CivicGraph place/entity story infrastructure.',
  },
  {
    name: 'Tanya Egerton',
    org: 'The Circular Thread',
    role: 'Founder',
    relevance: 'Remote Australia, circular economy, and opportunity weaving maps directly to Goods and CivicGraph.',
    relationshipMove: 'High-priority partner conversation for remote procurement, supply chains, and evidence packs.',
  },
  {
    name: 'Andrea Comastri',
    org: 'Hospitality with Heart',
    role: 'Founder',
    relevance: 'Disability employment and social enterprise operations.',
    relationshipMove: 'Possible Goods/social procurement example if CivicGraph adds verified social enterprise pathways.',
  },
  {
    name: 'Hugh Jackman',
    org: 'Humanitix',
    role: 'Head of Impact',
    relevance: 'High-visibility impact distribution and charity funding story.',
    relationshipMove: 'Watch for partnership narratives around event revenue, impact distribution, and public trust.',
  },
];

export const BFGN_MAY_2026_SIGNALS: EcosystemSignal[] = [
  {
    title: 'Social Change Central has ceased operations',
    organisations: ['Social Change Central'],
    relevance: 'A discovery and opportunity gap has opened in the Australian social impact ecosystem.',
    actPosition: 'CivicGraph can occupy part of this gap if it becomes faster, more evidence-rich, and more connected to entities than a simple grants directory.',
  },
  {
    title: 'Community Owned Australia launched',
    organisations: ['ACRE', 'AMP Foundation', 'Paul Ramsay Foundation', 'Bendigo Bank Community Enterprise Foundation'],
    relevance: 'Community asset ownership is moving from idea to capital stack.',
    actPosition: 'Goods and CivicGraph can support due diligence, local asset maps, partner discovery, and public benefit evidence.',
  },
  {
    title: 'Social enterprise infrastructure is professionalising',
    organisations: ['The Mill House Ventures', 'B Lab', 'GoodWolf Partners', 'Westpac Foundation', 'Social Traders'],
    relevance: 'Capability, certification, procurement, and learning infrastructure are becoming central.',
    actPosition: 'ACT should sit beside these actors as the data and accountability layer, not as another generic accelerator.',
  },
  {
    title: 'Impact investing capacity is expanding',
    organisations: ['Minderoo Foundation', 'Social Impact Hub', 'Philanthropy Australia'],
    relevance: 'Funders are building market infrastructure and asking harder questions about ecosystem enablement.',
    actPosition: 'CivicGraph can become the evidence layer for who is funded, who is missing, what works, and where capital should move next.',
  },
];

export const BFGN_PARTNER_ORGANISATIONS: EcosystemOrganisation[] = [
  {
    name: 'Impact Boom',
    presence: 'matched',
    entityType: 'social enterprise',
    geography: 'QLD / Brisbane',
    relationship: 'Business-for-good media, education, and ecosystem storytelling.',
    actRelevance: 'Peer channel for ACT narrative, case studies, and social enterprise visibility.',
  },
  {
    name: 'AMP Foundation',
    civicGraphName: 'AMP Foundation Limited / The Trustee For AMP Foundation Charitable Trust',
    presence: 'matched',
    entityType: 'foundation / company',
    geography: 'NSW / national giving',
    relationship: 'Philanthropic funder connected to community and Indigenous giving.',
    actRelevance: 'Potential funder/partner in community asset and ecosystem infrastructure work.',
  },
  {
    name: 'Taronga Conservation Society Australia',
    presence: 'matched',
    entityType: 'government body',
    geography: 'NSW',
    relationship: 'Public conservation institution and procurement buyer in NSW records.',
    actRelevance: 'Useful CivicGraph example of a public-purpose institution with procurement, capital works, and partner networks.',
  },
  {
    name: 'SASEC',
    civicGraphName: 'South Australian Social Enterprise Council',
    presence: 'matched',
    entityType: 'government body / network record',
    geography: 'SA / Adelaide',
    relationship: 'State social enterprise council.',
    actRelevance: 'Network node for social enterprise coverage, certification pathways, and interstate Goods partnerships.',
  },
  {
    name: 'Collab4Good',
    civicGraphName: 'COLLAB4GOOD LTD',
    presence: 'matched',
    entityType: 'company',
    geography: 'SA / Adelaide Hills',
    relationship: 'Collaboration and for-purpose ecosystem organisation.',
    actRelevance: 'Possible partner node for collective action, capability building, and opportunity distribution.',
  },
  {
    name: 'Social Traders',
    civicGraphName: 'Social Traders Ltd',
    presence: 'matched',
    entityType: 'charity / certification body',
    geography: 'VIC / national',
    relationship: 'National social enterprise certification and procurement infrastructure.',
    actRelevance: 'High-priority Goods/CivicGraph relationship: certification, social procurement, verified supplier graph.',
  },
  {
    name: 'Goulburn Murray Community Leadership',
    civicGraphName: 'Goulburn Murray Community Leadership Program Inc.',
    presence: 'matched',
    entityType: 'charity',
    geography: 'VIC / Greater Shepparton',
    relationship: 'Regional leadership and community capability organisation.',
    actRelevance: 'Potential regional partner for place-based CivicGraph briefs and leadership/evidence programs.',
  },
  {
    name: 'The For-Purpose Alliance',
    presence: 'not-found',
    entityType: 'network / alliance',
    geography: 'Australia',
    relationship: 'For-purpose sector alliance shown as a BFGN supporter.',
    actRelevance: 'Needs ingestion or alias resolution before CivicGraph can map contracts, grants, or relationships.',
  },
  {
    name: 'Social Impact Hub',
    civicGraphName: 'Social Impact Hub Pty Ltd / Social Impact Hub Foundation',
    presence: 'matched',
    entityType: 'company / foundation',
    geography: 'NSW / national',
    relationship: 'Impact investing, philanthropy, capability building, and social enterprise support.',
    actRelevance: 'Strategic adjacent actor for investment readiness, impact capital, and CivicGraph as evidence layer.',
  },
  {
    name: 'ACRE',
    civicGraphName: 'Australian Centre for Rural Entrepreneurship Limited',
    presence: 'matched',
    entityType: 'charity',
    geography: 'VIC / Wangaratta',
    relationship: 'Rural entrepreneurship and community-owned asset infrastructure.',
    actRelevance: 'High-fit partner for Goods, community asset due diligence, rural place maps, and Community Owned Australia.',
  },
  {
    name: 'Social Impact',
    presence: 'partial',
    entityType: 'ambiguous brand',
    geography: 'Unknown',
    relationship: 'Logo text is too generic to resolve safely from the screenshot alone.',
    actRelevance: 'Needs exact legal or trading name before adding a confident CivicGraph relationship.',
  },
  {
    name: 'Indigenous Innovation Ventures',
    civicGraphName: 'Indigenous Innovation Ventures Pty Ltd',
    presence: 'matched',
    entityType: 'social enterprise',
    geography: 'ACT / national service footprint',
    relationship: 'Supply Nation certified Indigenous business focused on capability, governance, and software/services.',
    actRelevance: 'High-fit partner/peer for Indigenous enterprise, governance tooling, and CivicGraph supplier intelligence.',
  },
  {
    name: 'Good North',
    presence: 'not-found',
    entityType: 'unknown',
    geography: 'Unknown',
    relationship: 'BFGN supporter shown in the image, not matched in current entity search.',
    actRelevance: 'Ingestion candidate; needs ABN/site to map properly.',
  },
  {
    name: 'INCO Entrepreneurs',
    presence: 'not-found',
    entityType: 'accelerator / enterprise support',
    geography: 'International / Australia unknown',
    relationship: 'Entrepreneurship and inclusive economy support brand.',
    actRelevance: 'Potential accelerator/capability network; needs local entity resolution.',
  },
  {
    name: 'Turning Ground',
    presence: 'not-found',
    entityType: 'unknown',
    geography: 'Unknown',
    relationship: 'BFGN supporter shown in the image, not matched in current entity search.',
    actRelevance: 'Ingestion candidate; needs ABN/site to map properly.',
  },
  {
    name: 'The Mill House Ventures',
    civicGraphName: 'THE MILL HOUSE VENTURES LIMITED',
    presence: 'matched',
    entityType: 'company',
    geography: 'ACT',
    relationship: 'Canberra social enterprise accelerator and ecosystem builder.',
    actRelevance: 'Peer/partner for accelerator pathways, social enterprise capability, and ACT-region opportunity intelligence.',
  },
  {
    name: 'Newkind',
    presence: 'not-found',
    entityType: 'community / event / design network',
    geography: 'Unknown',
    relationship: 'BFGN supporter shown in the image, not matched in current entity search.',
    actRelevance: 'Potential values-aligned community/design network; needs entity resolution.',
  },
];

export const ECOSYSTEM_NEXT_ACTIONS: EcosystemAction[] = [
  {
    id: 'seq-partner-brief',
    type: 'brief',
    priority: 'high',
    title: 'Build the SEQ Innovation Economy partner brief',
    owner: 'ACT / CivicGraph',
    relatedTo: ['SEQ Innovation Economy Fund', 'Social Impact Hub', 'Impact Boom', 'Social Traders', 'A Kind Tractor LTD'],
    whyNow: 'The fund closes on 25 June 2026 and needs a precinct-led capital project, not a generic platform pitch.',
    nextStep: 'Produce a two-page partner brief positioning CivicGraph as the governance, impact, procurement, and ecosystem intelligence layer.',
    query: 'SEQ innovation precinct university council social enterprise infrastructure Brisbane Sunshine Coast',
  },
  {
    id: 'resolve-missing-supporters',
    type: 'ingest',
    priority: 'high',
    title: 'Resolve missing BFGN supporter entities',
    owner: 'CivicGraph data pipeline',
    relatedTo: ['The For-Purpose Alliance', 'Good North', 'INCO Entrepreneurs', 'Turning Ground', 'Newkind'],
    whyNow: 'These names are visible ecosystem nodes but cannot yet be joined to ABNs, grants, contracts, people, or places.',
    nextStep: 'Find ABN, website, legal name, location, and sector for each missing or ambiguous supporter, then add aliases.',
    query: 'for purpose alliance good north inco entrepreneurs turning ground newkind ABN Australia',
  },
  {
    id: 'social-procurement-wedge',
    type: 'product',
    priority: 'high',
    title: 'Turn Social Traders into a verified supplier wedge',
    owner: 'Goods / CivicGraph',
    relatedTo: ['Social Traders', 'Indigenous Innovation Ventures', 'SASEC', 'Collab4Good'],
    whyNow: 'The newsletter highlights social enterprise procurement momentum, and CivicGraph already has Social Traders ingestion paths.',
    nextStep: 'Create a supplier-readiness view that joins certification, ABN, place, contracts, and grant opportunity fit.',
    query: 'social traders certified social enterprise procurement supplier readiness government contracts',
  },
  {
    id: 'rural-assets-stack',
    type: 'outreach',
    priority: 'medium',
    title: 'Map the rural community asset stack',
    owner: 'ACT / Goods',
    relatedTo: ['ACRE', 'FRRR Strengthening Rural Communities', 'AMP Foundation', 'Paul Ramsay Foundation'],
    whyNow: 'Community Owned Australia and FRRR point to a clear rural asset ownership and local resilience stack.',
    nextStep: 'Ask ACRE what evidence, due diligence, and local partner maps would make community asset applications stronger.',
    query: 'community owned assets rural entrepreneurship FRRR ACRE philanthropy local ownership',
  },
  {
    id: 'impact-capital-evidence',
    type: 'outreach',
    priority: 'medium',
    title: 'Position CivicGraph as impact capital evidence infrastructure',
    owner: 'ACT / CivicGraph',
    relatedTo: ['Social Impact Hub', 'Minderoo Foundation', 'Philanthropy Australia', 'Westpac Social Change Fellowship'],
    whyNow: 'Impact investing capacity building is moving from values language to infrastructure needs.',
    nextStep: 'Draft a use case showing how CivicGraph identifies funding gaps, investable organisations, and evidence risk.',
    query: 'impact investing social enterprise evidence infrastructure funding gaps Australia',
  },
  {
    id: 'bfgn-channel-test',
    type: 'outreach',
    priority: 'medium',
    title: 'Use BFGN as a channel test for opportunity intelligence',
    owner: 'ACT / CivicGraph',
    relatedTo: ['BFGN', 'Javier Casanova', 'Impact Boom'],
    whyNow: 'Social Change Central has closed, creating a discovery gap for social impact operators.',
    nextStep: 'Send a small example: BFGN May opportunities scored by lead/partner/contractor/monitor with live CivicGraph joins.',
    query: 'business for good opportunity intelligence grants social enterprise Australia',
  },
];

export const ECOSYSTEM_QUERY_PACKS: EcosystemQueryPack[] = [
  {
    id: 'act-current-state',
    title: 'ACT Current State',
    purpose: 'Ask how an opportunity fits the whole ACT project graph before deciding lead, partner, contractor, or monitor.',
    prompts: [
      'Which ACT project code does this opportunity touch?',
      'Is that project active, live-proof, pitch-ready, cleanup-needed, or decision-blocked?',
      'What source page, entity record, or live proof backs the claim?',
      'What DRI decision is needed this week?',
    ],
    tables: ['gs_entities', 'grant_opportunities', 'org_profiles', 'agent_runs', 'gs_relationships'],
  },
  {
    id: 'opportunity-fit',
    title: 'Opportunity Fit',
    purpose: 'Turn a grant or program into lead/partner/contractor/monitor decisions.',
    prompts: [
      'What are the eligibility blockers?',
      'Which ACT portfolio project is the best fit?',
      'Who should lead if ACT should not?',
      'What evidence would make this credible?',
    ],
    tables: ['grant_opportunities', 'org_profiles', 'gs_entities', 'foundations'],
  },
  {
    id: 'partner-map',
    title: 'Partner Map',
    purpose: 'Find likely partners around a fund, theme, place, or sector.',
    prompts: [
      'Which organisations already sit in this geography or sector?',
      'Which are funders, certifiers, accelerators, intermediaries, or delivery partners?',
      'Which have procurement or grant history?',
      'Which names need ABN/legal-name resolution?',
    ],
    tables: ['gs_entities', 'entity_identifiers', 'austender_contracts', 'justice_funding', 'social_enterprises'],
  },
  {
    id: 'place-evidence',
    title: 'Place Evidence',
    purpose: 'Build place-based evidence packs for applications and partner pitches.',
    prompts: [
      'What does CivicGraph know about this LGA or postcode?',
      'Where are funding gaps, social enterprises, community-controlled orgs, and contractors?',
      'Which funders or government buyers already operate here?',
      'What local proof should go into the application?',
    ],
    tables: ['mv_funding_by_lga', 'mv_funding_by_postcode', 'postcode_geo', 'seifa_2021', 'gs_entities'],
  },
  {
    id: 'governance-readiness',
    title: 'Governance Readiness',
    purpose: 'Check whether entity footing, co-contribution, insurance, IP, and cutover state are ready for a major application.',
    prompts: [
      'Which legal entity should apply or contract?',
      'Are bank, insurance, ABN, GST, ACNC, DGR, IP, and partner authority clear?',
      'What cash or in-kind contribution is required?',
      'What blocker should be resolved before outreach?',
    ],
    tables: ['gs_entities', 'org_profiles', 'entity_identifiers', 'foundations', 'grant_opportunities'],
  },
  {
    id: 'third-reality-proof',
    title: 'Third Reality Proof',
    purpose: 'Join systemic data, evidence, and sovereign story proof for funder briefs and impact reports.',
    prompts: [
      'What systemic data proves the need or gap?',
      'What consented story, media, or field signal can be used?',
      'What evidence source supports the intervention?',
      'What should remain internal or community-controlled?',
    ],
    tables: ['gs_entities', 'justice_funding', 'grant_opportunities', 'mv_funding_by_lga', 'entity_identifiers'],
  },
  {
    id: 'ecosystem-gap',
    title: 'Ecosystem Gap',
    purpose: 'Find missing records and alias problems before a brief becomes misleading.',
    prompts: [
      'Which visible organisations are missing from CivicGraph?',
      'Which names are ambiguous or aliases?',
      'What ABN, website, state, and entity type should be added?',
      'Which source should own the correction?',
    ],
    tables: ['gs_entities', 'entity_identifiers', 'social_enterprises', 'foundations'],
  },
];

export function opportunityRoleLabel(role: ActRole): string {
  if (role === 'lead') return 'Lead';
  if (role === 'partner') return 'Partner';
  if (role === 'contractor') return 'Contractor';
  return 'Monitor';
}

export function actionTypeLabel(type: EcosystemActionType): string {
  if (type === 'outreach') return 'Outreach';
  if (type === 'ingest') return 'Ingest';
  if (type === 'brief') return 'Brief';
  return 'Product';
}

export function actionPriorityRank(priority: EcosystemAction['priority']): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

export function rankedEcosystemActions() {
  return [...ECOSYSTEM_NEXT_ACTIONS].sort((a, b) => {
    const priorityDelta = actionPriorityRank(b.priority) - actionPriorityRank(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return a.title.localeCompare(b.title);
  });
}

export function presenceLabel(presence: CivicGraphPresence): string {
  if (presence === 'matched') return 'In CivicGraph';
  if (presence === 'partial') return 'Needs disambiguation';
  return 'Not found yet';
}

export function opportunityThemeLabel(theme: AlignmentTheme): string {
  if (theme === 'civicgraph') return 'CivicGraph';
  if (theme === 'goods') return 'Goods';
  if (theme === 'justicehub') return 'JusticeHub';
  if (theme === 'empathy-ledger') return 'Empathy Ledger';
  return 'ACT Studio';
}

export function projectLayerLabel(layer: ActProjectLayer): string {
  if (layer === 'memory') return 'Memory';
  if (layer === 'signal') return 'Signal';
  if (layer === 'ledger') return 'Ledger';
  if (layer === 'surface') return 'Surface';
  if (layer === 'edge') return 'Edge';
  return 'Enterprise';
}

export function projectReadinessLabel(readiness: ActProjectReadiness): string {
  if (readiness === 'active') return 'Active';
  if (readiness === 'live-proof') return 'Live proof';
  if (readiness === 'pitch-ready') return 'Pitch ready';
  if (readiness === 'needs-cleanup') return 'Needs cleanup';
  return 'Decision needed';
}

export function reviewStatusLabel(status: ActReviewFinding['status']): string {
  if (status === 'verified') return 'Verified';
  if (status === 'inferred') return 'Inferred';
  return 'Unknown';
}

export function rolePriority(role: ActRole): number {
  if (role === 'lead') return 4;
  if (role === 'partner') return 3;
  if (role === 'contractor') return 2;
  return 1;
}

export function rankedEcosystemOpportunities() {
  return [...BFGN_MAY_2026_OPPORTUNITIES].sort((a, b) => {
    const scoreDelta = b.fitScore - a.fitScore;
    if (scoreDelta !== 0) return scoreDelta;
    return rolePriority(b.actRole) - rolePriority(a.actRole);
  });
}

export function filterEcosystemOpportunities(query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  if (terms.length === 0) return rankedEcosystemOpportunities();

  return rankedEcosystemOpportunities().filter((opportunity) => {
    const haystack = [
      opportunity.name,
      opportunity.amount,
      opportunity.geography,
      opportunity.theme,
      opportunity.actRole,
      opportunity.why,
      opportunity.evidenceNeed,
      opportunity.nextMove,
      opportunity.query,
    ].join(' ').toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}
