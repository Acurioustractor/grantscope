/**
 * Goods on Country — Master Outreach Target List
 *
 * Comprehensive list of ALL procurement, philanthropic, community,
 * government, and corporate targets for Goods growth.
 *
 * Sources:
 * - v2/src/lib/data/compendium.ts (verified partnerships/funding)
 * - goods-workspace-data.ts (scored intelligence)
 * - COMPENDIUM_MARCH_2026.md (full narrative)
 *
 * Last synced: March 16, 2026
 *
 * Each target has:
 * - category: what type of relationship
 * - status: where we are with them
 * - priority: how important for bed sales / growth
 * - nextAction: concrete next step
 * - grantRelevance: how this helps with grant applications
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TargetCategory =
  | 'philanthropy_active'      // Currently funding us
  | 'philanthropy_pipeline'    // In discussions or applied
  | 'philanthropy_prospect'    // Should approach
  | 'aboriginal_trust'         // Indigenous community trusts
  | 'government_grant'         // Federal/state/territory programs
  | 'impact_finance'           // Social enterprise loans, impact investment
  | 'corporate'                // Corporate partnerships/procurement
  | 'health_buyer'             // Health organisations that can procure
  | 'procurement_buyer'        // Organisations that buy goods for communities
  | 'distribution_partner'     // Organisations that can distribute
  | 'community_partner'        // Direct community relationships
  | 'manufacturing_partner'    // Production/technical partners
  ;

export type RelationshipStatus = 'active' | 'warm' | 'applied' | 'prospect' | 'research';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface OutreachTarget {
  id: string;
  name: string;
  category: TargetCategory;
  status: RelationshipStatus;
  priority: Priority;
  states?: string[];
  contactName?: string;
  contactEmail?: string;
  amountSignal?: string;
  instrument?: string;
  nextAction: string;
  grantRelevance: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHILANTHROPY — Active Funders (re-engage, deepen, renew)
// ─────────────────────────────────────────────────────────────────────────────

export const philanthropyActive: OutreachTarget[] = [
  {
    id: 'snow',
    name: 'Snow Foundation',
    category: 'philanthropy_active',
    status: 'active',
    priority: 'critical',
    contactName: 'Sally Grimsley-Ballard',
    contactEmail: 's.grimsley-ballard@snowfoundation.org.au',
    amountSignal: '$193K received + $200K Round 4 pending',
    instrument: 'grant',
    nextAction: 'Convert from anchor grantmaker into co-investment validator for production-scale capital. Follow up on Round 4 proposal.',
    grantRelevance: 'Anchor funder — reference in every application. Sally travelled to Tennant Creek. Deep trust.',
  },
  {
    id: 'frrr',
    name: 'FRRR (Foundation for Rural & Regional Renewal)',
    category: 'philanthropy_active',
    status: 'active',
    priority: 'high',
    amountSignal: '$50K received via Backing the Future',
    instrument: 'grant',
    nextAction: 'Position next ask around remote-community proof, not just product refinement. Explore other FRRR programs.',
    grantRelevance: 'Validates remote community focus. Strong reference for other rural/regional funders.',
  },
  {
    id: 'vfff',
    name: 'Vincent Fairfax Family Foundation',
    category: 'philanthropy_active',
    status: 'active',
    priority: 'high',
    amountSignal: '$50K received',
    instrument: 'grant',
    nextAction: 'Reconnect around youth jobs, community ownership, and governance maturity for production expansion.',
    grantRelevance: 'Youth + governance focus aligns with community-owned production narrative.',
  },
  {
    id: 'tfn',
    name: 'The Funding Network',
    category: 'philanthropy_active',
    status: 'active',
    priority: 'medium',
    amountSignal: '$130K raised (Sept 2025 pitch)',
    instrument: 'grant',
    nextAction: 'Maintain relationship. TFN is a one-off pitch event, not recurring — but network connections are valuable.',
    grantRelevance: 'Largest single raise. Demonstrates pitch capability and donor confidence.',
  },
  {
    id: 'amp',
    name: 'AMP Spark',
    category: 'philanthropy_active',
    status: 'active',
    priority: 'medium',
    amountSignal: '$21.9K received',
    instrument: 'program',
    nextAction: 'Check for renewal or alumni network opportunities.',
    grantRelevance: 'Social enterprise accelerator credential.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHILANTHROPY — Pipeline (applied or in discussions)
// ─────────────────────────────────────────────────────────────────────────────

export const philanthropyPipeline: OutreachTarget[] = [
  {
    id: 'snow-4',
    name: 'Snow Foundation Round 4',
    category: 'philanthropy_pipeline',
    status: 'applied',
    priority: 'critical',
    contactName: 'Sally Grimsley-Ballard',
    amountSignal: '$200K ($60K beds + $60K production facility)',
    instrument: 'grant',
    nextAction: 'Follow up on Q1 2026 proposal status.',
    grantRelevance: 'If approved, validates production-scale thesis for other funders.',
  },
  {
    id: 'qbe',
    name: 'QBE Foundation',
    category: 'philanthropy_pipeline',
    status: 'applied',
    priority: 'high',
    instrument: 'grant',
    nextAction: 'Await response. Prepare for interview/site visit if shortlisted.',
    grantRelevance: 'Corporate foundation — adds diversity to funder mix.',
  },
  {
    id: 'real',
    name: 'REAL Innovation Fund (DEWR)',
    category: 'government_grant',
    status: 'applied',
    priority: 'critical',
    amountSignal: 'TBD',
    instrument: 'federal grant',
    nextAction: 'EOI submitted Mar 2 via Oonchiumpa. DEWR confirmed receipt. Await invitation to full application.',
    grantRelevance: 'Federal recognition. Oonchiumpa as lead applicant strengthens Indigenous-led narrative.',
    notes: 'Submitted via Oonchiumpa as lead applicant',
  },
  {
    id: 'sedg',
    name: 'Social Enterprise Development Grants',
    category: 'government_grant',
    status: 'applied',
    priority: 'medium',
    amountSignal: '$75K',
    instrument: 'grant',
    nextAction: 'Draft at 82% fit. Complete and submit.',
    grantRelevance: 'Social enterprise capability building.',
  },
  {
    id: 'minderoo',
    name: 'Minderoo Foundation',
    category: 'philanthropy_pipeline',
    status: 'warm',
    priority: 'high',
    contactName: 'Lucy Stronach',
    instrument: 'catalytic',
    nextAction: 'Approach as scale and systems-change backer for remote production. 20 comms logged. Sally recommended.',
    grantRelevance: 'Systems-change funder. Would validate at-scale thesis.',
  },
  {
    id: 'tim-fairfax',
    name: 'Tim Fairfax Family Foundation',
    category: 'philanthropy_pipeline',
    status: 'warm',
    priority: 'high',
    contactName: 'Katie Norman',
    instrument: 'grant',
    nextAction: '33 comms logged. QLD focus — lead with Palm Island proof.',
    grantRelevance: 'QLD-focused. Palm Island is strongest QLD proof point.',
  },
  {
    id: 'dusseldorp',
    name: 'Dusseldorp Forum',
    category: 'philanthropy_pipeline',
    status: 'warm',
    priority: 'medium',
    instrument: 'grant',
    nextAction: 'Meeting held Oct 2025. Follow up with updated impact data.',
    grantRelevance: 'Justice reinvestment angle.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// IMPACT FINANCE — Loans and blended capital
// ─────────────────────────────────────────────────────────────────────────────

export const impactFinance: OutreachTarget[] = [
  {
    id: 'sefa',
    name: 'SEFA Partnerships Limited',
    category: 'impact_finance',
    status: 'warm',
    priority: 'critical',
    contactName: 'Joel Bird',
    amountSignal: '$500K social impact loan target',
    instrument: 'loan',
    nextAction: 'Package Snow-backed blended-capital ask so SEFA sees repeat orders, not grant dependence. 23 comms logged.',
    grantRelevance: 'Debt readiness validates commercial viability to other funders.',
  },
  {
    id: 'pfi',
    name: 'PFI (QLD Partnering for Impact Fund)',
    category: 'impact_finance',
    status: 'applied',
    priority: 'critical',
    amountSignal: '$640K repayable',
    instrument: 'repayable grant',
    contactEmail: 'PFIFund@treasury.qld.gov.au',
    nextAction: 'EOI was due Mar 15 — confirm submission status.',
    grantRelevance: 'QLD Treasury. Repayable = commercial signal. Massive if approved.',
  },
  {
    id: 'giant-leap',
    name: 'Giant Leap',
    category: 'impact_finance',
    status: 'prospect',
    priority: 'medium',
    instrument: 'impact VC',
    nextAction: 'Sally recommended. Approach when ready for equity conversation.',
    grantRelevance: 'Impact VC interest validates investable social enterprise thesis.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ABORIGINAL TRUSTS & FOUNDATIONS (new targets from workspace intelligence)
// ─────────────────────────────────────────────────────────────────────────────

export const aboriginalTrusts: OutreachTarget[] = [
  {
    id: 'centrecorp-foundation',
    name: 'Centrecorp Foundation',
    category: 'aboriginal_trust',
    status: 'warm',
    priority: 'critical',
    states: ['NT'],
    amountSignal: '$420K receivable (107 beds Utopia)',
    instrument: 'blended',
    nextAction: 'Turn buyer proof into blended capital conversation for Central Australian community production.',
    grantRelevance: 'Aboriginal investment arm. Already connected to Utopia/Centrebuild pathway.',
  },
  {
    id: 'groote-trust',
    name: 'Groote Eylandt Aboriginal Trust',
    category: 'aboriginal_trust',
    status: 'prospect',
    priority: 'critical',
    states: ['NT'],
    amountSignal: 'High annual giving',
    instrument: 'grant',
    nextAction: 'Use Groote demand signal (500 mattresses + 300 washers) and local trust alignment for place-based production ask.',
    grantRelevance: 'Direct community trust. Largest single demand signal in pipeline.',
  },
  {
    id: 'central-aus-trust',
    name: 'Central Australian Aboriginal Charitable Trust',
    category: 'aboriginal_trust',
    status: 'prospect',
    priority: 'high',
    states: ['NT'],
    instrument: 'grant',
    nextAction: 'Position as regional Aboriginal capital holder to underwrite community-owned production.',
    grantRelevance: 'NT/Central Australia focus. Community production alignment.',
  },
  {
    id: 'general-gumala',
    name: 'General Gumala Foundation Trust',
    category: 'aboriginal_trust',
    status: 'prospect',
    priority: 'medium',
    states: ['WA'],
    amountSignal: 'High annual giving',
    instrument: 'grant',
    nextAction: 'Test as WA-linked Indigenous production and community ownership partner. Kalgoorlie proof point.',
    grantRelevance: 'WA expansion. Indigenous community trust with substantial giving.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNMENT PROGRAMS (not yet in pipeline)
// ─────────────────────────────────────────────────────────────────────────────

export const governmentPrograms: OutreachTarget[] = [
  {
    id: 'sedi',
    name: 'Social Enterprise Development Initiative',
    category: 'government_grant',
    status: 'prospect',
    priority: 'high',
    instrument: 'grant',
    nextAction: 'Frame as capability-building complement to debt and philanthropy.',
    grantRelevance: 'Australian Government social enterprise program. Explicit fit.',
  },
  {
    id: 'nt-gov',
    name: 'NT Government',
    category: 'government_grant',
    status: 'warm',
    priority: 'medium',
    states: ['NT'],
    contactName: 'Anna Philip',
    contactEmail: 'anna.philip2@nt.gov.au',
    nextAction: 'Check-in meeting held Jan 2026. Follow up with updated deployment data and production facility plans.',
    grantRelevance: 'State government backing validates scale. Potential procurement pathway.',
  },
  {
    id: 'ntrai',
    name: 'NTRAI (NT Remote Aboriginal Investment)',
    category: 'government_grant',
    status: 'research',
    priority: 'medium',
    states: ['NT'],
    instrument: 'grant',
    nextAction: 'Research eligibility and application process.',
    grantRelevance: 'NT-specific remote Aboriginal investment. Natural fit.',
  },
  {
    id: 'fn-business-accel',
    name: 'First Nations Business Acceleration (QLD)',
    category: 'government_grant',
    status: 'research',
    priority: 'medium',
    states: ['QLD'],
    instrument: 'grant',
    nextAction: 'Research eligibility. Palm Island proof strengthens QLD case.',
    grantRelevance: 'QLD government. First Nations business development.',
  },
  {
    id: 'ndis-pathway',
    name: 'NDIS Assistive Technology / Home Modifications',
    category: 'government_grant',
    status: 'research',
    priority: 'medium',
    instrument: 'procurement',
    nextAction: 'Research whether Stretch Bed qualifies as assistive technology. Explore NDIS provider registration.',
    grantRelevance: 'Recurring procurement channel. Large market. Dignity + health alignment.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHILANTHROPY — New Prospects (not yet contacted)
// ─────────────────────────────────────────────────────────────────────────────

export const philanthropyProspects: OutreachTarget[] = [
  {
    id: 'rio-tinto',
    name: 'Rio Tinto Foundation',
    category: 'philanthropy_prospect',
    status: 'prospect',
    priority: 'high',
    instrument: 'co-investment',
    nextAction: 'Position Goods as remote manufacturing and jobs platform aligned to mining-adjacent communities.',
    grantRelevance: 'High annual giving. Indigenous + employment + economic development focus.',
  },
  {
    id: 'fortescue',
    name: 'Fortescue Foundation',
    category: 'philanthropy_prospect',
    status: 'prospect',
    priority: 'high',
    instrument: 'co-investment',
    nextAction: 'Lead with remote jobs, recycled material use, and durable community-owned production.',
    grantRelevance: 'Real Zero + community investment. Indigenous employment focus.',
  },
  {
    id: 'acf',
    name: 'Australian Communities Foundation',
    category: 'philanthropy_prospect',
    status: 'prospect',
    priority: 'medium',
    instrument: 'collective giving',
    nextAction: 'Explore collective giving model. Community-led solutions alignment.',
    grantRelevance: 'Collective giving = many small donors. Good for recurring support.',
  },
  {
    id: 'circular-future',
    name: 'Circular Future Fund / Planet Ark',
    category: 'philanthropy_prospect',
    status: 'research',
    priority: 'medium',
    instrument: 'grant',
    nextAction: 'Research eligibility. Strong circular economy fit with plastic diversion story.',
    grantRelevance: 'Environmental angle. 9,225kg+ plastic diverted. 125 tonnes/year at scale.',
  },
  {
    id: 'self-loan',
    name: 'SELF (Social Enterprise Loan Fund)',
    category: 'impact_finance',
    status: 'research',
    priority: 'medium',
    instrument: 'loan',
    nextAction: 'Complements SEFA. Research terms and eligibility.',
    grantRelevance: 'Additional debt pathway. Validates commercial readiness.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH BUYERS (organisations that procure health hardware)
// ─────────────────────────────────────────────────────────────────────────────

export const healthBuyers: OutreachTarget[] = [
  {
    id: 'anyinginyi',
    name: 'Anyinginyi Health Aboriginal Corporation',
    category: 'health_buyer',
    status: 'warm',
    priority: 'critical',
    states: ['NT'],
    contactName: 'Tony',
    nextAction: 'Build Anyinginyi-specific case linking beds, washers, and community-production employment outcomes.',
    grantRelevance: '5 washers deployed. Health outcomes tracking. Quote for 4 more sent Feb 2026.',
  },
  {
    id: 'miwatj',
    name: 'Miwatj Health Aboriginal Corporation',
    category: 'health_buyer',
    status: 'warm',
    priority: 'critical',
    states: ['NT'],
    contactName: 'Jessica Allardyce',
    nextAction: 'Package Goods as health-hardware procurement line for RHD prevention. Explore fleet deployment across 8 clinics.',
    grantRelevance: 'East Arnhem. RHD prevention angle. Fleet deployment = recurring orders.',
  },
  {
    id: 'purple-house',
    name: 'Purple House',
    category: 'health_buyer',
    status: 'warm',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Dialysis patients need quality beds. Explore procurement pathway.',
    grantRelevance: 'Chronic disease management. Bed quality → health outcomes.',
  },
  {
    id: 'red-dust',
    name: 'Red Dust',
    category: 'health_buyer',
    status: 'warm',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Health partner relationship. Explore co-funding or procurement.',
    grantRelevance: 'Darwin-based health org. NT credibility.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROCUREMENT BUYERS (organisations that buy goods for communities)
// ─────────────────────────────────────────────────────────────────────────────

export const procurementBuyers: OutreachTarget[] = [
  {
    id: 'centrebuild',
    name: 'Centrebuild Pty Ltd',
    category: 'procurement_buyer',
    status: 'active',
    priority: 'critical',
    states: ['NT'],
    amountSignal: '109 beds sold. 107-bed Utopia pathway active.',
    nextAction: 'Lock repeat-order conversation tied to Utopia. Use as proof in every buyer conversation.',
    grantRelevance: 'Strongest commercial signal. Proves market exists.',
  },
  {
    id: 'outback-stores',
    name: 'Outback Stores Pty Ltd',
    category: 'procurement_buyer',
    status: 'prospect',
    priority: 'high',
    states: ['NT', 'QLD', 'WA', 'SA'],
    nextAction: 'Prepare stock-and-service pitch for pilot in 2–3 remote stores with freight and repair logic.',
    grantRelevance: 'Remote retail network. National reach. If converted, proves distribution model.',
  },
  {
    id: 'alpa',
    name: 'Arnhem Land Progress Aboriginal Corporation',
    category: 'procurement_buyer',
    status: 'prospect',
    priority: 'high',
    states: ['NT'],
    nextAction: 'Test pilot pitch around replacement demand, washer serviceability, and local assembly.',
    grantRelevance: 'Aboriginal-owned stores. Deep Arnhem Land footprint. Community trust.',
  },
  {
    id: 'tangentyere',
    name: 'Tangentyere Council Aboriginal Corporation',
    category: 'procurement_buyer',
    status: 'prospect',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Lead with dignity, floor-sleeping reduction, and practical household durability for town camps.',
    grantRelevance: 'Housing/community services. Central Australian reach.',
  },
  {
    id: 'west-arnhem',
    name: 'West Arnhem Regional Council',
    category: 'procurement_buyer',
    status: 'prospect',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Approach via regional service and local jobs framing.',
    grantRelevance: 'Regional government. Multiple remote communities.',
  },
  {
    id: 'qic',
    name: 'QIC',
    category: 'corporate',
    status: 'warm',
    priority: 'medium',
    states: ['QLD'],
    amountSignal: '50-bed staff-build interest (NAIDOC)',
    nextAction: 'Convert 50-bed NAIDOC-style build into visible corporate procurement case study.',
    grantRelevance: 'Corporate engagement proof. Staff activation model.',
  },
  {
    id: 'whsac-groote',
    name: 'WHSAC (Groote Archipelago)',
    category: 'procurement_buyer',
    status: 'prospect',
    priority: 'critical',
    states: ['NT'],
    contactName: 'Simone Grimmond',
    amountSignal: '500 mattresses + 300 washing machines (~$1.7M)',
    nextAction: 'This is the single largest demand signal. Combine with Groote Eylandt Aboriginal Trust for place-based production ask.',
    grantRelevance: 'Flagship demand signal. Every grant should mention this.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY & MANUFACTURING PARTNERS
// ─────────────────────────────────────────────────────────────────────────────

export const communityPartners: OutreachTarget[] = [
  {
    id: 'oonchiumpa',
    name: 'Oonchiumpa Consultancy & Services',
    category: 'community_partner',
    status: 'active',
    priority: 'critical',
    states: ['NT'],
    contactName: 'Kristy Bloomfield',
    contactEmail: 'kristy.bloomfield@oonchiumpa.com.au',
    nextAction: 'Keep at centre of every facility and jobs pitch. REAL Innovation Fund co-applicant.',
    grantRelevance: '100% Aboriginal owned. Core co-design partner. Lead applicant on federal grants.',
  },
  {
    id: 'wilya-janta',
    name: 'Wilya Janta',
    category: 'community_partner',
    status: 'active',
    priority: 'critical',
    states: ['NT'],
    contactName: 'Norman Frank Jupurrurla / Dr Simon Quilty',
    nextAction: 'Housing advocacy + demonstration home. Active bed testing.',
    grantRelevance: 'Tennant Creek anchor. Housing advocacy. Norman Frank is powerful community voice.',
  },
  {
    id: 'picc',
    name: 'Palm Island Community Company',
    category: 'community_partner',
    status: 'active',
    priority: 'critical',
    states: ['QLD'],
    contactName: 'Narelle',
    amountSignal: '141 beds deployed + 40-bed order + "we\'ll buy the facility"',
    nextAction: 'Largest deployment. Explore production facility hosting on Palm Island.',
    grantRelevance: 'Flagship QLD proof point. Said they\'d buy the production facility itself.',
  },
  {
    id: 'npy',
    name: "NPY Women's Council",
    category: 'community_partner',
    status: 'active',
    priority: 'high',
    states: ['NT', 'SA', 'WA'],
    contactName: 'Angela Lynch',
    nextAction: '"Always looking for beds." Established network across 3 jurisdictions.',
    grantRelevance: 'Cross-border reach. Ongoing demand. Established Aboriginal organisation.',
  },
  {
    id: 'defy',
    name: 'Defy Design',
    category: 'manufacturing_partner',
    status: 'active',
    priority: 'high',
    states: ['NSW'],
    contactName: 'Sam Davies',
    contactEmail: 'sam@defydesign.org',
    nextAction: 'Key manufacturing partner. Training Ebony + Jahvan for on-country production.',
    grantRelevance: 'Manufacturing knowledge transfer. Skills pathway for community production.',
  },
  {
    id: 'envirobank',
    name: 'Envirobank',
    category: 'manufacturing_partner',
    status: 'warm',
    priority: 'high',
    contactName: 'Marty Taylor / Narelle Anderson',
    nextAction: 'Recycled HDPE supply partnership. Meeting held Feb 11. Indigenous-led supply chain.',
    grantRelevance: 'Circular economy supply chain. Strengthens environmental impact narrative.',
  },
  {
    id: 'orange-sky',
    name: 'Orange Sky Australia',
    category: 'community_partner',
    status: 'active',
    priority: 'medium',
    states: ['QLD', 'NT', 'WA'],
    contactName: 'Judith Meiklejohn',
    contactEmail: 'judith@orangesky.org.au',
    nextAction: 'Use as trust proof and national credibility signal. Not the main buyer pathway.',
    grantRelevance: 'National service network. Nic co-founded. Credibility multiplier.',
  },
  {
    id: 'bawinanga',
    name: 'Bawinanga Homelands Aboriginal Corporation',
    category: 'distribution_partner',
    status: 'prospect',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Test community-owned service and distribution model beyond store channel.',
    grantRelevance: 'Arnhem Land homelands. Remote service infrastructure.',
  },
  {
    id: 'red-dust-robotics',
    name: 'Red Dust Robotics',
    category: 'manufacturing_partner',
    status: 'warm',
    priority: 'medium',
    states: ['NT'],
    nextAction: 'Youth STEM education + manufacturing skills pathway.',
    grantRelevance: 'Youth jobs + STEM education angle for grant applications.',
  },
  {
    id: 'eb-jahvan',
    name: 'Ebony & Jahvan Oui',
    category: 'manufacturing_partner',
    status: 'active',
    priority: 'high',
    states: ['QLD'],
    nextAction: 'Training with Defy Design. Jahvan visited factory. Future-CEO pipeline.',
    grantRelevance: 'Indigenous youth-led manufacturing. The "who makes these? we do" story.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIC CAPITAL PATHWAYS (how to stack funding)
// ─────────────────────────────────────────────────────────────────────────────

export const capitalPathways = [
  {
    id: 'anchor-debt-capability',
    title: 'Anchor grant + debt + capability',
    summary: 'Snow validates → SEFA provides working capital/facility debt → SEDI builds capability.',
    targets: ['snow', 'sefa', 'sedi'],
    thesis: 'Use grants to de-risk, then layer debt + capability. Proves commercial readiness.',
  },
  {
    id: 'central-aus-buyer-stack',
    title: 'Central Australia buyer-to-capital stack',
    summary: 'Convert Centrebuild/Centrecorp buyer proof into blended capital for Utopia and Central Australian production.',
    targets: ['centrecorp-foundation', 'central-aus-trust', 'sefa'],
    thesis: 'Buyer orders prove demand. Aboriginal trusts fund production. Debt covers working capital.',
  },
  {
    id: 'regional-industrial',
    title: 'Regional jobs and circular manufacturing',
    summary: 'Rio Tinto + Fortescue + Minderoo for systems-change scale.',
    targets: ['rio-tinto', 'fortescue', 'minderoo'],
    thesis: 'Remote manufacturing, jobs, and circular economy at national scale.',
  },
  {
    id: 'groote-place-based',
    title: 'Groote Eylandt place-based production',
    summary: 'Groote Aboriginal Trust + WHSAC demand + Miwatj health = place-based production and supply.',
    targets: ['groote-trust', 'whsac-groote', 'miwatj'],
    thesis: 'Largest single demand signal. Local trust can fund. Health partner validates.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate all targets
// ─────────────────────────────────────────────────────────────────────────────

export const allTargets: OutreachTarget[] = [
  ...philanthropyActive,
  ...philanthropyPipeline,
  ...impactFinance,
  ...aboriginalTrusts,
  ...governmentPrograms,
  ...philanthropyProspects,
  ...healthBuyers,
  ...procurementBuyers,
  ...communityPartners,
];

export function getTargetsByPriority(priority: Priority) {
  return allTargets.filter(t => t.priority === priority);
}

export function getTargetsByCategory(category: TargetCategory) {
  return allTargets.filter(t => t.category === category);
}

export function getTargetsByStatus(status: RelationshipStatus) {
  return allTargets.filter(t => t.status === status);
}

export function getCriticalNextActions() {
  return allTargets
    .filter(t => t.priority === 'critical')
    .map(t => ({ name: t.name, action: t.nextAction, status: t.status }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────────────────────────────────────

export function getOutreachSummary() {
  return {
    totalTargets: allTargets.length,
    byPriority: {
      critical: allTargets.filter(t => t.priority === 'critical').length,
      high: allTargets.filter(t => t.priority === 'high').length,
      medium: allTargets.filter(t => t.priority === 'medium').length,
    },
    byStatus: {
      active: allTargets.filter(t => t.status === 'active').length,
      warm: allTargets.filter(t => t.status === 'warm').length,
      applied: allTargets.filter(t => t.status === 'applied').length,
      prospect: allTargets.filter(t => t.status === 'prospect').length,
      research: allTargets.filter(t => t.status === 'research').length,
    },
    criticalActions: getCriticalNextActions(),
  };
}
