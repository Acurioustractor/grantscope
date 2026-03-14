import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OrgProfileContext } from '@/lib/org-profile';
import type {
  GoodsAssetRow,
  GoodsCommunitySeed,
  GoodsBuyerSeed,
  GoodsCapitalSeed,
  GoodsPartnerSeed,
  PlaceFundingRow,
  CommunityControlRow,
  NdisSupplyRow,
  NdisCaptureRow,
  EntityMatchRow,
  NtCommunityProcurementSummaryRow,
  NtCommunityBuyerCrosswalkRow,
  FoundationRow,
  FoundationPowerRow,
  GrantRow,
  SavedFoundationRow,
  SavedGrantRow,
  GoodsTrackedIdentitySource,
  GoodsIdentityCandidate,
  GoodsWorkflowStep,
  GoodsCommunityProof,
  GoodsNtCoverageGap,
  GoodsNtBuyerReach,
  GoodsNtCommunitySweep,
  GoodsLifecycleProductStat,
  GoodsLifecycleEvidencePoint,
  GoodsLifecycleData,
  GoodsLifecycleTicketRow,
  GoodsLifecycleCheckinRow,
  GoodsLifecycleAlertRow,
  GoodsLifecycleMetadata,
  GoodsLifecycleSignals,
  GoodsBuyerTarget,
  GoodsCapitalTarget,
  GoodsPartnerTarget,
  GoodsCapitalPathway,
  GoodsTrackedIdentity,
  GoodsOutboundIdentityRecommendation,
  GoodsWorkspaceData,
  GoodsExportRow,
  GoodsCrmTargetPayload,
  GoodsWorkspaceMode,
  GoodsTargetType,
  GoodsTrackedIdentityRole,
} from './goods-workspace-types';

// Re-export public types
export type {
  GoodsWorkspaceMode,
  GoodsTargetType,
  GoodsTrackedIdentityRole,
  GoodsWorkflowStep,
  GoodsCommunityProof,
  GoodsNtCoverageGap,
  GoodsNtBuyerReach,
  GoodsNtCommunitySweep,
  GoodsLifecycleProductStat,
  GoodsLifecycleEvidencePoint,
  GoodsLifecycleData,
  GoodsBuyerTarget,
  GoodsCapitalTarget,
  GoodsPartnerTarget,
  GoodsCapitalPathway,
  GoodsTrackedIdentity,
  GoodsOutboundIdentityRecommendation,
  GoodsWorkspaceData,
  GoodsExportRow,
  GoodsCrmTargetPayload,
} from './goods-workspace-types';

type ServiceDb = ReturnType<typeof import('@/lib/supabase').getServiceSupabase>;

const GOODS_REPO_ROOT = process.env.GOODS_REPO_PATH || '/Users/benknight/Code/Goods Asset Register';
const GOODS_V2_ROOT = join(GOODS_REPO_ROOT, 'v2');
const GOODS_ASSET_PATH = join(GOODS_REPO_ROOT, 'data', 'expanded_assets_final.csv');
const GOODS_COMPENDIUM_PATH = join(GOODS_V2_ROOT, 'docs', 'COMPENDIUM_MARCH_2026.md');
const GOODS_V2_ENV_PATH = join(GOODS_V2_ROOT, '.env.local');
const GOODS_TRACKED_ABNS = splitList(process.env.GOODS_TRACKED_ABNS);
const GOODS_TRACKED_ENTITY_NAMES = splitList(process.env.GOODS_TRACKED_ENTITY_NAMES);


const WORKFLOW: GoodsWorkflowStep[] = [
  { id: 'need', label: 'Need signal', description: 'Start from communities where beds, washers, and delivery pathways are under pressure.' },
  { id: 'buyer', label: 'Buyer pipeline', description: 'Rank the buyers and channels most likely to move 100+ beds into community.' },
  { id: 'capital', label: 'Capital stack', description: 'Blend grants, philanthropy, loans, and catalytic capital into a fundable scale-up plan.' },
  { id: 'outreach', label: 'Outreach exports', description: 'Turn ranked targets into Notion-ready lists, CSVs, and Goods CRM pushes.' },
];

const COMMUNITY_SEEDS: GoodsCommunitySeed[] = [
  {
    name: 'Palm Island',
    state: 'QLD',
    postcode: '4816',
    regionLabel: 'Townsville / Palm Island',
    priorityNeed: 'high',
    demandBeds: 35,
    demandWashers: 12,
    knownBuyer: null,
    keyPartnerNames: ['Palm Island community', 'Orange Sky Australia Limited'],
    proofLine: '141 assets already deployed; freight and replacement burden remains high.',
    story: 'Palm Island is the strongest direct-to-community proof point for beds supporting dignity, better sleep, and reduced floor-sleeping.',
    youthJobs: 'Palm Island remains the clearest proving ground for youth-led production and local resale pathways.',
  },
  {
    name: 'Tennant Creek',
    state: 'NT',
    postcode: '0860',
    regionLabel: 'Barkly / Tennant Creek',
    priorityNeed: 'critical',
    demandBeds: 40,
    demandWashers: 20,
    knownBuyer: 'Anyinginyi Health Aboriginal Corporation',
    keyPartnerNames: ['Anyinginyi Health Aboriginal Corporation', 'OONCHIUMPA CONSULTANCY & SERVICES PTY LTD'],
    proofLine: '146 tracked assets and repeat demand prove the bed line has a real NT service market.',
    story: 'Tennant Creek is the best case study for tying beds, washing machines, health hardware, and youth jobs into one community manufacturing story.',
    youthJobs: 'Oonchiumpa-linked production and local assembly can turn Tennant Creek from a service destination into a production base.',
  },
  {
    name: 'Utopia Homelands',
    state: 'NT',
    postcode: '0872',
    regionLabel: 'Central Australia / Utopia',
    priorityNeed: 'critical',
    demandBeds: 107,
    demandWashers: 0,
    knownBuyer: 'CENTREBUILD PTY LTD',
    keyPartnerNames: ['OONCHIUMPA CONSULTANCY & SERVICES PTY LTD', 'Centrecorp Foundation'],
    proofLine: 'A 107-bed order pathway already exists via Centrebuild/Centrecorp for Utopia Homelands.',
    story: 'Utopia is the strongest direct commercial signal that Goods can move from prototypes to repeated bulk bed orders in Central Australia.',
    youthJobs: 'A community production facility tied to Oonchiumpa could service Utopia demand while creating owned income for other programs.',
  },
  {
    name: 'Maningrida',
    state: 'NT',
    postcode: '0822',
    regionLabel: 'West Arnhem / Maningrida',
    priorityNeed: 'high',
    demandBeds: 30,
    demandWashers: 15,
    knownBuyer: 'The Arnhem Land Progress Aboriginal Corporation',
    keyPartnerNames: ['Bawinanga Homelands Aboriginal Corporation', 'The Arnhem Land Progress Aboriginal Corporation', 'West Arnhem Regional Council'],
    proofLine: '24 assets deployed already; the market around homelands, stores, and councils is broader than current output.',
    story: 'Maningrida is the test case for linking homelands delivery, store networks, councils, and Aboriginal corporations into a repeatable NT buyer channel.',
    youthJobs: 'A Maningrida expansion strengthens the case for community-owned production supporting regional logistics and maintenance jobs.',
  },
  {
    name: 'Kalgoorlie',
    state: 'WA',
    postcode: '6430',
    regionLabel: 'Goldfields / Kalgoorlie',
    priorityNeed: 'emerging',
    demandBeds: 15,
    demandWashers: 8,
    knownBuyer: null,
    keyPartnerNames: ['Support workers and service agencies in Kalgoorlie'],
    proofLine: '20 assets already in use and support-worker proof confirms the bed line has value outside the NT.',
    story: 'Kalgoorlie shows Goods can travel beyond one state and still solve practical health-hardware problems.',
    youthJobs: 'WA demand strengthens the case for a replicable community production blueprint, not a one-site story.',
  },
  {
    name: 'Groote Eylandt',
    state: 'NT',
    postcode: '0883',
    regionLabel: 'East Arnhem / Groote Eylandt',
    priorityNeed: 'critical',
    demandBeds: 500,
    demandWashers: 300,
    knownBuyer: 'THE TRUSTEE FOR GROOTE EYLANDT ABORIGINAL TRUST',
    keyPartnerNames: ['THE TRUSTEE FOR GROOTE EYLANDT ABORIGINAL TRUST', 'Miwatj Health Aboriginal Corporation'],
    proofLine: 'Documented request for 500 mattresses and 300 washing machines makes Groote a flagship demand signal.',
    story: 'Groote Eylandt is the clearest case for combining philanthropic capital, remote service delivery, and community manufacturing scale.',
    youthJobs: 'A Groote-scale pathway would justify plant, training, and maintenance roles owned in community rather than imported from outside.',
  },
];

const BUYER_SEEDS: GoodsBuyerSeed[] = [
  {
    key: 'centrebuild',
    matchPattern: 'CENTREBUILD',
    name: 'CENTREBUILD PTY LTD',
    role: 'Procurement intermediary / housing supplier',
    states: ['NT'],
    route: 'Bulk remote procurement',
    relationshipStatus: 'active',
    contactSurface: 'Existing buyer relationship via Centrebuild / Centrecorp',
    knownOrderSignal: '109 beds sold already; 107-bed Utopia pathway still active.',
    remoteFootprint: 'Central Australia and remote NT community servicing pathway.',
    productFit: 'Beds, household essentials, housing hardware.',
    procurementPath: 'Convert existing order proof into a standing buyer and repeat procurement lane.',
    nextAction: 'Lock a repeat-order conversation tied to Utopia, then use it as proof in every other buyer conversation.',
  },
  {
    key: 'centrecorp-foundation',
    matchPattern: 'CENTRECORP FOUNDATION',
    name: 'Centrecorp Foundation',
    role: 'Buyer-aligned Aboriginal investment arm',
    states: ['NT'],
    route: 'Strategic Aboriginal distribution and capital partner',
    relationshipStatus: 'warm',
    contactSurface: 'Foundation + network entry point in Central Australia',
    knownOrderSignal: 'Centrecorp-linked pathway already moved substantial bed volume.',
    remoteFootprint: 'Central Australia, Aboriginal enterprise and community distribution.',
    productFit: 'Beds and facility scale-up for homelands.',
    procurementPath: 'Use Centrecorp as both buyer-introducer and blended-capital bridge.',
    nextAction: 'Package the Utopia order story into a repeat-purchase + production-scale conversation.',
  },
  {
    key: 'outback-stores',
    matchPattern: 'OUTBACK STORES',
    name: 'Outback Stores Pty Ltd',
    role: 'Remote retail / logistics network',
    states: ['NT', 'QLD', 'WA', 'SA'],
    route: 'Store network / retail distribution',
    relationshipStatus: 'prospect',
    contactSurface: 'Public website and procurement-facing corporate surface',
    knownOrderSignal: null,
    remoteFootprint: 'Serves remote communities across multiple jurisdictions.',
    productFit: 'Household essentials, beds, whitegoods, replacement parts.',
    procurementPath: 'Frame Goods as remote-ready stock that avoids freight-tax failure and service churn.',
    nextAction: 'Prepare a stock-and-service pitch for a pilot in 2-3 remote stores with freight and repair logic included.',
  },
  {
    key: 'alpa',
    matchPattern: 'ARNHEM LAND PROGRESS',
    name: 'The Arnhem Land Progress Aboriginal Corporation',
    role: 'Aboriginal-owned store and logistics network',
    states: ['NT'],
    route: 'Community-owned remote retail',
    relationshipStatus: 'prospect',
    contactSurface: 'ALPA corporate and procurement channels',
    knownOrderSignal: null,
    remoteFootprint: 'Deep Arnhem Land footprint with community trust and logistics infrastructure.',
    productFit: 'Beds, washers, health hardware, replacement parts.',
    procurementPath: 'Lead with community-owned distribution and remote servicing fit rather than generic retail.',
    nextAction: 'Test an ALPA pilot pitch around replacement demand, washer serviceability, and local assembly opportunities.',
  },
  {
    key: 'miwatj',
    matchPattern: 'MIWATJ HEALTH',
    name: 'Miwatj Health Aboriginal Corporation',
    role: 'Aboriginal health buyer / deployment partner',
    states: ['NT'],
    route: 'Health-led distribution',
    relationshipStatus: 'warm',
    contactSurface: 'Health relationships and remote program pathways',
    knownOrderSignal: 'Health hardware story is already validated through RHD and bedding logic.',
    remoteFootprint: 'East Arnhem and remote NT health footprint.',
    productFit: 'Beds, washers, health-prevention hardware.',
    procurementPath: 'Tie bed and washer deployment to RHD prevention, home hygiene, and repeat community use.',
    nextAction: 'Package Goods as a health-hardware procurement line, not a furniture purchase.',
  },
  {
    key: 'anyinginyi',
    matchPattern: 'ANYINGINYI',
    name: 'Anyinginyi Health Aboriginal Corporation',
    role: 'Aboriginal health buyer / community delivery partner',
    states: ['NT'],
    route: 'Health-led procurement',
    relationshipStatus: 'warm',
    contactSurface: 'Existing Tennant Creek relationships',
    knownOrderSignal: 'Tennant Creek demand and delivery proof align tightly with Anyinginyi.',
    remoteFootprint: 'Barkly and Tennant Creek service footprint.',
    productFit: 'Beds, washers, youth-jobs linked community manufacturing.',
    procurementPath: 'Move from pilot/community proof to a service-backed recurrent purchase line.',
    nextAction: 'Build an Anyinginyi-specific case linking beds, washers, and community-production employment outcomes.',
  },
  {
    key: 'tangentyere',
    matchPattern: 'TANGENTYERE COUNCIL',
    name: 'Tangentyere Council Aboriginal Corporation',
    role: 'Housing / community service buyer',
    states: ['NT'],
    route: 'Community housing and support procurement',
    relationshipStatus: 'prospect',
    contactSurface: 'Housing and service program procurement teams',
    knownOrderSignal: null,
    remoteFootprint: 'Town camps and Central Australian housing/community service reach.',
    productFit: 'Beds and household essentials for housing pathways.',
    procurementPath: 'Lead with dignity, floor-sleeping reduction, and practical household durability.',
    nextAction: 'Test a housing-use-case pitch tied to bed replacement, maintenance, and local production benefit.',
  },
  {
    key: 'west-arnhem',
    matchPattern: 'WEST ARNHEM REGIONAL COUNCIL',
    name: 'West Arnhem Regional Council',
    role: 'Regional authority / civic procurement',
    states: ['NT'],
    route: 'Regional government / community asset procurement',
    relationshipStatus: 'prospect',
    contactSurface: 'Council procurement and remote-community service teams',
    knownOrderSignal: null,
    remoteFootprint: 'Remote NT civic footprint across multiple communities.',
    productFit: 'Beds, household fit-out, local facility support.',
    procurementPath: 'Position Goods as local economic development plus practical remote supply.',
    nextAction: 'Approach via regional service and local jobs framing, not just product sales.',
  },
  {
    key: 'qic',
    matchPattern: 'QIC',
    name: 'QIC',
    role: 'Corporate activation / staff-build buyer',
    states: ['QLD'],
    route: 'Corporate social procurement / activation',
    relationshipStatus: 'warm',
    contactSurface: 'Existing staff-build interest noted in Goods strategy',
    knownOrderSignal: 'QIC expressed interest in building 50 beds with staff.',
    remoteFootprint: 'Corporate rather than remote distribution footprint.',
    productFit: 'Beds for staff build, donor engagement, and corporate procurement storytelling.',
    procurementPath: 'Use QIC as a corporate proof case and staff-build entry point, not as the main remote channel.',
    nextAction: 'Convert the 50-bed NAIDOC-style build interest into a visible corporate procurement and storytelling case study.',
  },
];

const CAPITAL_SEEDS: GoodsCapitalSeed[] = [
  {
    key: 'snow',
    foundationPattern: 'SNOW FOUNDATION',
    name: 'The Trustee For The Snow Foundation',
    instrumentType: 'grant',
    relationshipStatus: 'active',
    stageFit: ['prototype', 'working capital', 'facility'],
    contactSurface: 'Sally Grimsley-Ballard — strategic partner and funder',
    knownSignal: 'Approx. $193,785 confirmed to date with a further $200,000 proposal pending.',
    nextAction: 'Convert Snow from anchor grantmaker into the first co-investment validator for production-scale capital.',
  },
  {
    key: 'frrr',
    foundationPattern: 'FRRR',
    name: 'FRRR',
    instrumentType: 'grant',
    relationshipStatus: 'active',
    stageFit: ['prototype', 'community expansion'],
    contactSurface: 'Backing the Future relationship already active',
    knownSignal: '$50,000 already landed through Backing the Future.',
    nextAction: 'Position the next ask around remote-community proof, not just product refinement.',
  },
  {
    key: 'vfff',
    foundationPattern: 'VINCENT FAIRFAX',
    name: 'The Trustee For The Vincent Fairfax Family Trust',
    instrumentType: 'grant',
    relationshipStatus: 'active',
    stageFit: ['working capital', 'facility'],
    contactSurface: 'Existing grant relationship through Goods fundraising stack',
    knownSignal: '$50,000 already received.',
    nextAction: 'Reconnect around youth jobs, community ownership, and governance maturity for production expansion.',
  },
  {
    key: 'sefa',
    foundationPattern: 'SEFA',
    name: 'SEFA Partnerships Limited',
    instrumentType: 'loan',
    relationshipStatus: 'warm',
    stageFit: ['working capital', 'facility', 'scale'],
    contactSurface: 'Joel Bird pathway noted in Goods strategy',
    knownSignal: 'Approx. 23 communications already logged; target loan pathway around $500,000.',
    nextAction: 'Package a Snow-backed blended-capital ask so SEFA sees repeat orders, not grant dependence.',
  },
  {
    key: 'sedi',
    grantPattern: 'SEDI',
    name: 'Social Enterprise Development Initiative (SEDI)',
    instrumentType: 'grant',
    relationshipStatus: 'warm',
    stageFit: ['working capital', 'facility', 'scale'],
    contactSurface: 'Australian Government social enterprise capability and growth pathway',
    knownSignal: 'Explicitly flagged in Goods strategy as a strong fit for social enterprise development.',
    nextAction: 'Frame SEDI as the capability-building and scale-readiness complement to debt and philanthropy.',
  },
  {
    key: 'minderoo',
    foundationPattern: 'MINDEROO',
    name: 'Minderoo Foundation',
    instrumentType: 'catalytic',
    relationshipStatus: 'warm',
    stageFit: ['facility', 'scale'],
    contactSurface: 'Minderoo pathway noted via Lucy Stronach',
    knownSignal: 'Strategy docs reference approximately 20 communications and a systems-change fit.',
    nextAction: 'Approach Minderoo as a scale and systems-change backer for remote production, not a single-site grantmaker.',
  },
  {
    key: 'rio',
    foundationPattern: 'RIO TINTO FOUNDATION',
    name: 'Rio Tinto Foundation',
    instrumentType: 'co-investment',
    relationshipStatus: 'prospect',
    stageFit: ['facility', 'regional scale'],
    contactSurface: 'Public foundation profile and regional community investment pathway',
    knownSignal: 'High annual giving and strong Indigenous / employment / economic development focus.',
    nextAction: 'Position Goods as a remote manufacturing and jobs platform aligned to mining-adjacent regional communities.',
  },
  {
    key: 'fortescue',
    foundationPattern: 'FORTESCUE FOUNDATION',
    name: 'Fortescue Foundation',
    instrumentType: 'co-investment',
    relationshipStatus: 'prospect',
    stageFit: ['facility', 'regional scale'],
    contactSurface: 'Public foundation and Real Zero community investment surface',
    knownSignal: 'Strong Indigenous, employment, and community focus with major annual giving.',
    nextAction: 'Lead with remote jobs, recycled material use, and durable community-owned production infrastructure.',
  },
  {
    key: 'centrecorp-foundation',
    foundationPattern: 'CENTRECORP FOUNDATION',
    name: 'Centrecorp Foundation',
    instrumentType: 'blended',
    relationshipStatus: 'warm',
    stageFit: ['working capital', 'facility'],
    contactSurface: 'Central Australian Aboriginal capital and community network',
    knownSignal: 'Already connected to the Utopia/Centrebuild bed pathway.',
    nextAction: 'Turn buyer proof into a blended capital conversation anchored in Central Australian community production.',
  },
  {
    key: 'general-gumala',
    foundationPattern: 'GENERAL GUMALA FOUNDATION',
    name: 'The General Gumala Foundation_Trust',
    instrumentType: 'grant',
    relationshipStatus: 'prospect',
    stageFit: ['facility', 'regional scale'],
    contactSurface: 'Public Indigenous community trust profile',
    knownSignal: 'High annual giving with strong Indigenous community orientation.',
    nextAction: 'Test as a WA-linked Indigenous production and community ownership partner rather than a generic grantmaker.',
  },
  {
    key: 'central-australian',
    foundationPattern: 'CENTRAL AUSTRALIAN ABORIGINAL CHARITABLE TRUST',
    name: 'The Trustee For Central Australian Aboriginal Charitable Trust',
    instrumentType: 'grant',
    relationshipStatus: 'prospect',
    stageFit: ['working capital', 'facility'],
    contactSurface: 'Central Australia-focused Aboriginal charitable trust',
    knownSignal: 'Explicit NT / Central Australia and Indigenous welfare focus.',
    nextAction: 'Position as a regional Aboriginal capital holder able to underwrite community-owned production.',
  },
  {
    key: 'groote',
    foundationPattern: 'GROOTE EYLANDT ABORIGINAL TRUST',
    name: 'THE TRUSTEE FOR GROOTE EYLANDT ABORIGINAL TRUST',
    instrumentType: 'grant',
    relationshipStatus: 'prospect',
    stageFit: ['working capital', 'facility', 'scale'],
    contactSurface: 'Groote community trust and local demand proof',
    knownSignal: 'Strong fit with the documented 500 mattress / 300 washer request from Groote.',
    nextAction: 'Use Groote demand and local trust alignment to frame a place-based production and supply ask.',
  },
];

const PARTNER_SEEDS: GoodsPartnerSeed[] = [
  {
    key: 'oonchiumpa',
    matchPattern: 'OONCHIUMPA',
    name: 'OONCHIUMPA CONSULTANCY & SERVICES PTY LTD',
    role: 'Community-owned production and design partner',
    states: ['NT'],
    relationshipStatus: 'active',
    knownSignal: 'Core co-design and community manufacturing partner for Central Australian expansion.',
    nextAction: 'Keep Oonchiumpa at the centre of every facility and jobs pitch.',
  },
  {
    key: 'orange-sky',
    matchPattern: 'ORANGE SKY',
    name: 'Orange Sky Australia Limited',
    role: 'National service and credibility partner',
    states: ['QLD', 'NT', 'WA'],
    relationshipStatus: 'active',
    knownSignal: 'Origin network and distribution credibility across remote communities.',
    nextAction: 'Use Orange Sky as trust proof, not as the main buyer pathway.',
  },
  {
    key: 'miwatj',
    matchPattern: 'MIWATJ HEALTH',
    name: 'Miwatj Health Aboriginal Corporation',
    role: 'Health implementation partner',
    states: ['NT'],
    relationshipStatus: 'warm',
    knownSignal: 'Strong alignment between RHD prevention, washing, and health hardware.',
    nextAction: 'Keep Miwatj in the delivery proof layer for any health-linked capital ask.',
  },
  {
    key: 'anyinginyi',
    matchPattern: 'ANYINGINYI',
    name: 'Anyinginyi Health Aboriginal Corporation',
    role: 'Health and community delivery partner',
    states: ['NT'],
    relationshipStatus: 'warm',
    knownSignal: 'Tennant Creek health and delivery pathway.',
    nextAction: 'Tie Anyinginyi to the Tennant Creek production and demand story.',
  },
  {
    key: 'bawinanga',
    matchPattern: 'BAWINANGA',
    name: 'Bawinanga Homelands Aboriginal Corporation',
    role: 'Homelands service and distribution partner',
    states: ['NT'],
    relationshipStatus: 'prospect',
    knownSignal: 'Strong Arnhem/homelands fit for remote supply and maintenance.',
    nextAction: 'Use Bawinanga to test a community-owned service and distribution model beyond the store channel.',
  },
  {
    key: 'tangentyere',
    matchPattern: 'TANGENTYERE COUNCIL',
    name: 'Tangentyere Council Aboriginal Corporation',
    role: 'Housing and community implementation partner',
    states: ['NT'],
    relationshipStatus: 'prospect',
    knownSignal: 'Central Australian housing/community service pathway.',
    nextAction: 'Build a partner case around housing fit-out and dignity outcomes.',
  },
  {
    key: 'west-arnhem',
    matchPattern: 'WEST ARNHEM REGIONAL COUNCIL',
    name: 'West Arnhem Regional Council',
    role: 'Regional service partner',
    states: ['NT'],
    relationshipStatus: 'prospect',
    knownSignal: 'Council footprint across remote communities and civic service infrastructure.',
    nextAction: 'Use as a council-and-community operating partner, not only a buyer.',
  },
  {
    key: 'alpa',
    matchPattern: 'ARNHEM LAND PROGRESS',
    name: 'The Arnhem Land Progress Aboriginal Corporation',
    role: 'Aboriginal-owned distribution partner',
    states: ['NT'],
    relationshipStatus: 'prospect',
    knownSignal: 'Aboriginal-owned remote store network with logistics credibility.',
    nextAction: 'Pitch ALPA as a channel partner and a community-owned distribution precedent.',
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function normalizeArray(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean) : [];
}

function splitList(value: string | undefined) {
  return String(value || '')
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function compactUnique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const value of values) {
    const entry = String(value || '').trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(entry);
  }
  return results;
}

function isBedProduct(product: string) {
  return /bed/i.test(product);
}

function isWasherProduct(product: string) {
  return /wash/i.test(product);
}

function formatCurrency(amount: number | null | undefined) {
  if (!amount) return 'Unknown';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'No recent check-in';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function extractEmail(value: string | null | undefined) {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || undefined;
}

function extractPhone(value: string | null | undefined) {
  const match = String(value || '').match(/(?:\+?61|0)[0-9][0-9\s()-]{7,}/);
  return match?.[0]?.replace(/\s+/g, ' ').trim() || undefined;
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const then = Date.parse(value);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function buildCsvRows(text: string) {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function readGoodsAssetRows() {
  const text = await readFile(GOODS_ASSET_PATH, 'utf8');
  const rows = buildCsvRows(text);
  const [headers, ...dataRows] = rows;
  return dataRows.map((row) =>
    headers.reduce((acc, header, index) => {
      acc[header as keyof GoodsAssetRow] = row[index] ?? '';
      return acc;
    }, {} as GoodsAssetRow),
  );
}

async function readGoodsCompendium() {
  try {
    return await readFile(GOODS_COMPENDIUM_PATH, 'utf8');
  } catch {
    return '';
  }
}

async function readGoodsV2Env() {
  try {
    const text = await readFile(GOODS_V2_ENV_PATH, 'utf8');
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .reduce<Record<string, string>>((acc, line) => {
        const separator = line.indexOf('=');
        if (separator <= 0) return acc;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        value = value.replace(/^['"]|['"]$/g, '');
        acc[key] = value;
        return acc;
      }, {});
  } catch {
    return {};
  }
}

async function createGoodsServiceClient() {
  const env = await readGoodsV2Env();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extractCurrency(text: string, label: string, fallback: number) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}[^\\n$]*\\$([\\d,]+)`, 'i'));
  if (!match) return fallback;
  return Number(match[1].replace(/,/g, '')) || fallback;
}

function extractContact(text: string, label: string, fallback: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}[^\\n|]*\\|\\s*([^|\\n]+@[^|\\n]+)`));
  return match?.[1]?.trim() || fallback;
}

async function loadGoodsNarrativeSignals() {
  const text = await readGoodsCompendium();
  return {
    snowConfirmed: extractCurrency(text, 'Snow Foundation', 193_785),
    snowPending: extractCurrency(text, 'Snow Foundation (Round 4)', 200_000),
    frrrConfirmed: extractCurrency(text, 'FRRR', 50_000),
    vfffConfirmed: extractCurrency(text, 'Vincent Fairfax Family Foundation', 50_000),
    tfnRaised: extractCurrency(text, 'The Funding Network', 130_000),
    sefaTarget: extractCurrency(text, 'SEFA', 500_000),
    snowContact: extractContact(text, 'Sally Grimsley-Ballard', 's.grimsley-ballard@snowfoundation.org.au'),
    washerDumpAnnualSpend: extractCurrency(text, 'Washing machines sold → dumps, Alice Springs', 3_000_000),
    remoteHomesWithoutWashingMachinePct: 59,
    grooteMattressRequest: 500,
    grooteWasherRequest: 300,
  };
}

function parseGoodsDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

function parseGoodsLifecycleMetadata(text: string | null | undefined): GoodsLifecycleMetadata {
  if (!text) return {};

  const readValue = (label: string) => {
    const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'));
    return match?.[1]?.trim();
  };

  const safetyRisk = readValue('Safety Risk');

  return {
    conditionStatus: readValue('Condition'),
    serviceability: readValue('Serviceability'),
    failureCause: readValue('Failure Cause'),
    outcomeWanted: readValue('Outcome Wanted'),
    oldItemDisposition: readValue('Old Item Disposition'),
    safetyRisk:
      typeof safetyRisk === 'string'
        ? ['yes', 'true', 'urgent', 'critical'].includes(safetyRisk.toLowerCase())
        : undefined,
    observedAt: readValue('Observed At'),
  };
}

async function loadGoodsLifecycleSignals(): Promise<GoodsLifecycleSignals> {
  const goodsDb = await createGoodsServiceClient();
  if (!goodsDb) {
    return { tickets: [], checkins: [], alerts: [] };
  }

  try {
    const [{ data: tickets }, { data: checkins }, { data: alerts }] = await Promise.all([
      goodsDb
        .from('tickets')
        .select('asset_id,category,priority,status,issue_description,submit_date')
        .order('submit_date', { ascending: false }),
      goodsDb
        .from('checkins')
        .select('asset_id,status,comments,checkin_date')
        .order('checkin_date', { ascending: false }),
      goodsDb
        .from('alerts')
        .select('asset_id,type,severity,details,alert_date,resolved')
        .order('alert_date', { ascending: false }),
    ]);

    return {
      tickets: tickets || [],
      checkins: checkins || [],
      alerts: alerts || [],
    };
  } catch {
    return { tickets: [], checkins: [], alerts: [] };
  }
}

function productFamilyForLifecycle(product: string | null | undefined): 'beds' | 'washers' | null {
  const normalized = normalizeText(product);
  if (normalized.includes('bed')) return 'beds';
  if (normalized.includes('wash') || normalized.includes('machine')) return 'washers';
  return null;
}

function buildLifecycleData(
  assetRows: GoodsAssetRow[],
  narrativeSignals: Awaited<ReturnType<typeof loadGoodsNarrativeSignals>>,
  lifecycleSignals: GoodsLifecycleSignals,
): GoodsLifecycleData {
  const buckets: Record<'beds' | 'washers', GoodsLifecycleProductStat> = {
    beds: {
      productFamily: 'beds',
      label: 'Beds + mattress system',
      assetCount: 0,
      medianObservedAgeDays: null,
      p90ObservedAgeDays: null,
      staleOver365Count: 0,
      staleOver730Count: 0,
      supportSignalCount: 0,
      failureSignalCount: 0,
      affectedAssetCount: 0,
      repairRequestCount: 0,
      replacementRequestCount: 0,
      dumpRiskCount: 0,
      safetyRiskCount: 0,
      topFailureCause: null,
      embodiedPlasticKg: 0,
      insight: '',
    },
    washers: {
      productFamily: 'washers',
      label: 'Washing machines',
      assetCount: 0,
      medianObservedAgeDays: null,
      p90ObservedAgeDays: null,
      staleOver365Count: 0,
      staleOver730Count: 0,
      supportSignalCount: 0,
      failureSignalCount: 0,
      affectedAssetCount: 0,
      repairRequestCount: 0,
      replacementRequestCount: 0,
      dumpRiskCount: 0,
      safetyRiskCount: 0,
      topFailureCause: null,
      embodiedPlasticKg: null,
      insight: '',
    },
  };

  const ageBuckets: Record<'beds' | 'washers', number[]> = { beds: [], washers: [] };
  const supportPattern = /(support|maintenance|service|check)/i;
  const failurePattern = /(broken|repair|replace|issue|fault|mould|mold|rust|damage|damaged|dump|tip|scrap|junk|not work|stolen|missing|collapsed|sag|torn)/i;
  const now = Date.now();
  const assetFamilyMap = new Map(
    assetRows
      .map((row) => [row.unique_id, productFamilyForLifecycle(row.product)] as const)
      .filter((entry): entry is readonly [string, 'beds' | 'washers'] => Boolean(entry[0] && entry[1])),
  );
  const affectedAssets = {
    beds: new Set<string>(),
    washers: new Set<string>(),
  };
  const failureCauseCounts: Record<'beds' | 'washers', Map<string, number>> = {
    beds: new Map(),
    washers: new Map(),
  };

  for (const row of assetRows) {
    const family = productFamilyForLifecycle(row.product);
    if (!family) continue;
    const bucket = buckets[family];
    bucket.assetCount += 1;
    if (family === 'beds') {
      bucket.embodiedPlasticKg = (bucket.embodiedPlasticKg || 0) + 15;
    }

    const notes = row.notes || '';
    if (supportPattern.test(notes)) bucket.supportSignalCount += 1;
    if (failurePattern.test(notes)) bucket.failureSignalCount += 1;

    const referenceDate =
      parseGoodsDate(row.last_checkin_date) ||
      parseGoodsDate(row.supply_date) ||
      parseGoodsDate(row.created_time);

    if (!referenceDate) continue;
    const ageDays = Math.floor((now - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    ageBuckets[family].push(ageDays);
    if (ageDays > 365) bucket.staleOver365Count += 1;
    if (ageDays > 730) bucket.staleOver730Count += 1;
  }

  for (const ticket of lifecycleSignals.tickets) {
    const family = assetFamilyMap.get(ticket.asset_id);
    if (!family) continue;
    const bucket = buckets[family];
    const metadata = parseGoodsLifecycleMetadata(ticket.issue_description);
    const category = normalizeText(ticket.category);
    const issueText = normalizeText(ticket.issue_description);

    bucket.supportSignalCount += 1;
    affectedAssets[family].add(ticket.asset_id);

    const isFailureIncident =
      category === 'damage' ||
      category === 'repair' ||
      category === 'replacement' ||
      Boolean(metadata.failureCause) ||
      Boolean(metadata.conditionStatus && metadata.conditionStatus.toLowerCase() !== 'good') ||
      failurePattern.test(issueText);

    if (isFailureIncident) {
      bucket.failureSignalCount += 1;
    }

    if (metadata.outcomeWanted?.toLowerCase().includes('repair') || category === 'repair') {
      bucket.repairRequestCount += 1;
    }

    if (
      metadata.outcomeWanted?.toLowerCase().includes('replace') ||
      category === 'replacement' ||
      metadata.conditionStatus?.toLowerCase() === 'replaced'
    ) {
      bucket.replacementRequestCount += 1;
    }

    if (
      metadata.oldItemDisposition?.toLowerCase().includes('dump') ||
      metadata.oldItemDisposition?.toLowerCase().includes('pickup') ||
      metadata.outcomeWanted?.toLowerCase().includes('dispose') ||
      metadata.outcomeWanted?.toLowerCase().includes('pickup')
    ) {
      bucket.dumpRiskCount += 1;
    }

    if (metadata.safetyRisk || metadata.serviceability?.toLowerCase().includes('unsafe')) {
      bucket.safetyRiskCount += 1;
    }

    if (metadata.failureCause) {
      const normalizedCause = metadata.failureCause.toLowerCase();
      failureCauseCounts[family].set(normalizedCause, (failureCauseCounts[family].get(normalizedCause) || 0) + 1);
    }
  }

  for (const checkin of lifecycleSignals.checkins) {
    const family = assetFamilyMap.get(checkin.asset_id);
    if (!family) continue;
    const status = normalizeText(checkin.status);
    const metadata = parseGoodsLifecycleMetadata(checkin.comments);
    if (status && status !== 'good') {
      affectedAssets[family].add(checkin.asset_id);
      if (status === 'needs repair') buckets[family].repairRequestCount += 1;
      if (status === 'replaced') buckets[family].replacementRequestCount += 1;
      if (status === 'damaged' || status === 'missing' || status === 'replaced') {
        buckets[family].failureSignalCount += 1;
      }
      if (metadata.failureCause) {
        const normalizedCause = metadata.failureCause.toLowerCase();
        failureCauseCounts[family].set(normalizedCause, (failureCauseCounts[family].get(normalizedCause) || 0) + 1);
      }
    }
  }

  for (const alert of lifecycleSignals.alerts) {
    const family = assetFamilyMap.get(alert.asset_id);
    if (!family) continue;
    const alertType = normalizeText(alert.type);
    const metadata = parseGoodsLifecycleMetadata(alert.details);
    if (alertType.includes('unsafe')) {
      buckets[family].safetyRiskCount += 1;
      affectedAssets[family].add(alert.asset_id);
    }
    if (alertType.includes('dump') || alertType.includes('end of life')) {
      buckets[family].dumpRiskCount += 1;
      affectedAssets[family].add(alert.asset_id);
    }
    if (metadata.failureCause) {
      const normalizedCause = metadata.failureCause.toLowerCase();
      failureCauseCounts[family].set(normalizedCause, (failureCauseCounts[family].get(normalizedCause) || 0) + 1);
    }
  }

  for (const family of Object.keys(buckets) as Array<'beds' | 'washers'>) {
    const ages = ageBuckets[family].sort((left, right) => left - right);
    const bucket = buckets[family];
    if (ages.length) {
      bucket.medianObservedAgeDays = ages[Math.floor(ages.length / 2)] || null;
      bucket.p90ObservedAgeDays = ages[Math.min(ages.length - 1, Math.floor(ages.length * 0.9))] || null;
    }
    bucket.affectedAssetCount = affectedAssets[family].size;
    const leadingCause = Array.from(failureCauseCounts[family].entries()).sort((left, right) => right[1] - left[1])[0];
    bucket.topFailureCause = leadingCause ? leadingCause[0] : null;
    bucket.insight =
      family === 'beds'
        ? `${bucket.affectedAssetCount} bed assets already have structured support or failure signals, while ${bucket.staleOver365Count} more have gone over 12 months without a fresh check-in. That is enough to argue for active replacement planning before low-life-cycle foam and imported frames cycle back in.`
        : `${bucket.supportSignalCount} washer incidents are now being captured structurally, with ${bucket.dumpRiskCount} already showing removal or dump pressure. That is the beginning of a real lifecycle evidence base instead of anecdote.`;
  }

  const productStats = [buckets.beds, buckets.washers];
  const totalDumpRisk = productStats.reduce((sum, stat) => sum + stat.dumpRiskCount, 0);
  const totalSafetyRisk = productStats.reduce((sum, stat) => sum + stat.safetyRiskCount, 0);
  const totalStructuredIncidents = productStats.reduce((sum, stat) => sum + stat.supportSignalCount, 0);

  return {
    productStats,
    evidencePoints: [
      {
        title: 'Observed bed fleet age',
        value: `${buckets.beds.medianObservedAgeDays || '—'} days`,
        detail: `The current Goods register shows a median observed bed age of ${buckets.beds.medianObservedAgeDays || 'unknown'} days and ${buckets.beds.staleOver365Count} beds with no fresh check-in for over 12 months.`,
      },
      {
        title: 'Structured support incidents',
        value: `${totalStructuredIncidents}`,
        detail: 'These are live support requests now captured with structured condition, failure, and outcome fields rather than loose notes alone.',
      },
      {
        title: 'Dump / pickup risk flagged',
        value: `${totalDumpRisk}`,
        detail: 'These incidents already indicate assets awaiting pickup, disposal, or dumping, which starts to make end-of-life visible instead of hidden.',
      },
      {
        title: 'Safety-critical assets',
        value: `${totalSafetyRisk}`,
        detail: 'Unsafe assets are now tagged explicitly, so Goods can separate urgent safety response from ordinary maintenance or replacement pressure.',
      },
      {
        title: 'Remote washer market waste',
        value: formatCurrency(narrativeSignals.washerDumpAnnualSpend),
        detail: 'Goods strategy docs cite one Alice Springs provider selling roughly this volume of washing machines into remote communities, with many ending up in dumps within months. That is the waste-and-margin gap Goods can attack.',
      },
      {
        title: 'Homes lacking washers',
        value: `${narrativeSignals.remoteHomesWithoutWashingMachinePct}%`,
        detail: 'This is the current headline signal in Goods materials for the unmet hygiene and health hardware gap in remote communities.',
      },
      {
        title: 'Groote replacement pressure',
        value: `${narrativeSignals.grooteMattressRequest} mattresses / ${narrativeSignals.grooteWasherRequest} washers`,
        detail: 'A single place-based demand signal at this size shows why lifecycle failure and replacement waste must become part of procurement strategy, not just community stories.',
      },
      {
        title: 'Recycled plastic already embodied',
        value: `${Math.round((buckets.beds.embodiedPlasticKg || 0) / 100) / 10}t`,
        detail: 'Using the current facility assumption of roughly 15kg recycled plastic per bed, the tracked bed fleet already represents multiple tonnes of plastic diverted into longer-life household infrastructure.',
      },
    ],
    researchNeeds: [
      'Keep driving structured support capture so every repair, replacement, and dump-risk event lands in the register with a clear cause and outcome.',
      'Collect replacement-order data from remote buyers so we can estimate how often cheap beds, mattresses, and washers are being repurchased into the same community.',
      'Scrape or negotiate transfer-station, dump, and council waste audit data for mattresses, whitegoods, and household goods in NT and QLD remote service regions.',
      'Add washer telemetry / cycle counts and maintenance logs so observed life can be measured from use, not just last check-in.',
      'Track reverse-logistics and removal costs so the total waste burden includes freight-out and dumping, not just purchase price.',
    ],
    landfillPressureSummary:
      `The register now shows ${totalStructuredIncidents} structured incidents, ${totalDumpRisk} dump-or-pickup risk signals, and ${totalSafetyRisk} safety-critical assets across the tracked bed and washer fleet. That is enough to start measuring lifecycle failure instead of only telling stories, but we still need council waste, replacement-order, and reverse-logistics data to quantify how much money is literally being dumped out of community each year.`,
  };
}

async function fetchPlaceFundingMap(serviceDb: ServiceDb, postcodes: string[]) {
  const uniquePostcodes = compactUnique(postcodes);
  if (!uniquePostcodes.length) return new Map<string, PlaceFundingRow>();

  const [{ data: fundingRows }, { data: geoRows }] = await Promise.all([
    serviceDb
      .from('mv_funding_by_postcode')
      .select('postcode,state,remoteness,entity_count,total_funding')
      .in('postcode', uniquePostcodes),
    serviceDb
      .from('postcode_geo')
      .select('postcode,locality,lga_name')
      .in('postcode', uniquePostcodes),
  ]);

  const geoMap = new Map((geoRows || []).map((row) => [row.postcode, row]));
  return new Map(
    (fundingRows || []).map((row) => [
      row.postcode,
      {
        ...row,
        locality: geoMap.get(row.postcode)?.locality || null,
        lga_name: geoMap.get(row.postcode)?.lga_name || null,
      } satisfies PlaceFundingRow,
    ]),
  );
}

async function fetchCommunityControlMap(serviceDb: ServiceDb, postcodes: string[]) {
  const uniquePostcodes = compactUnique(postcodes);
  if (!uniquePostcodes.length) return new Map<string, number>();
  const { data } = await serviceDb
    .from('gs_entities')
    .select('postcode')
    .eq('is_community_controlled', true)
    .in('postcode', uniquePostcodes);
  const counts = new Map<string, number>();
  for (const row of data || []) {
    const postcode = row.postcode || '';
    counts.set(postcode, (counts.get(postcode) || 0) + 1);
  }
  return counts;
}

async function fetchNdisMaps(serviceDb: ServiceDb, states: string[]) {
  const uniqueStates = compactUnique(states);
  const [{ data: supplyRows }, { data: captureRows }] = await Promise.all([
    serviceDb
      .from('ndis_active_providers')
      .select('state_code,service_district_name,provider_count')
      .in('state_code', uniqueStates),
    serviceDb
      .from('ndis_market_concentration')
      .select('state_code,service_district_name,payment_share_top10_pct')
      .in('state_code', uniqueStates),
  ]);

  const thinMap = new Map<string, number>();
  const capturedMap = new Map<string, number>();

  for (const row of (supplyRows || []) as NdisSupplyRow[]) {
    if (row.provider_count <= 20) {
      thinMap.set(row.state_code, (thinMap.get(row.state_code) || 0) + 1);
    }
  }

  for (const row of (captureRows || []) as NdisCaptureRow[]) {
    if ((row.payment_share_top10_pct || 0) >= 80) {
      capturedMap.set(row.state_code, (capturedMap.get(row.state_code) || 0) + 1);
    }
  }

  return { thinMap, capturedMap };
}

async function fetchNtCommunitySweep(serviceDb: ServiceDb): Promise<GoodsNtCommunitySweep> {
  const [{ data: summaryRows }, { data: crosswalkRows }] = await Promise.all([
    serviceDb
      .from('v_nt_community_procurement_summary')
      .select('community_id,community_name,region_label,service_region,land_council,postcode,is_official_remote_community,goods_focus_priority,goods_signal_name,goods_signal_type,known_buyer_name,entity_match_count,buyer_match_count,store_count,health_count,housing_count,council_count,other_service_count,community_controlled_match_count,top_buyer_names,needs_postcode_enrichment,has_goods_signal')
      .order('community_name', { ascending: true }),
    serviceDb
      .from('v_nt_community_buyer_crosswalk')
      .select('community_name,buyer_name,buyer_type,gs_id,abn,website,is_official_remote_community'),
  ]);

  const summaries = (summaryRows || []) as NtCommunityProcurementSummaryRow[];
  const crosswalk = (crosswalkRows || []) as NtCommunityBuyerCrosswalkRow[];
  const officialRows = summaries.filter((row) => row.is_official_remote_community);
  const officialCoveredCount = officialRows.filter((row) => (row.buyer_match_count || 0) > 0).length;

  const weakCoverage = officialRows
    .map((row) => ({
      community: row.community_name,
      regionLabel: row.region_label,
      serviceRegion: row.service_region,
      landCouncil: row.land_council,
      postcode: row.postcode,
      buyerMatchCount: row.buyer_match_count || 0,
      communityControlledMatchCount: row.community_controlled_match_count || 0,
      storeCount: row.store_count || 0,
      healthCount: row.health_count || 0,
      housingCount: row.housing_count || 0,
      councilCount: row.council_count || 0,
      otherServiceCount: row.other_service_count || 0,
      topBuyerNames: normalizeArray(row.top_buyer_names),
      knownBuyerName: row.known_buyer_name,
      hasGoodsSignal: Boolean(row.has_goods_signal),
      goodsSignalName: row.goods_signal_name,
      needsPostcodeEnrichment: Boolean(row.needs_postcode_enrichment),
    } satisfies GoodsNtCoverageGap))
    .sort((left, right) => {
      if (left.buyerMatchCount !== right.buyerMatchCount) return left.buyerMatchCount - right.buyerMatchCount;
      if (left.communityControlledMatchCount !== right.communityControlledMatchCount) return left.communityControlledMatchCount - right.communityControlledMatchCount;
      if (left.hasGoodsSignal !== right.hasGoodsSignal) return Number(right.hasGoodsSignal) - Number(left.hasGoodsSignal);
      if (left.needsPostcodeEnrichment !== right.needsPostcodeEnrichment) return Number(right.needsPostcodeEnrichment) - Number(left.needsPostcodeEnrichment);
      return left.community.localeCompare(right.community);
    })
    .slice(0, 12);

  const buyerReachMap = new Map<string, GoodsNtBuyerReach>();
  for (const row of crosswalk) {
    const key = `${row.buyer_name}::${row.buyer_type}`;
    const current = buyerReachMap.get(key);
    if (!current) {
      buyerReachMap.set(key, {
        buyerName: row.buyer_name,
        buyerType: row.buyer_type,
        coverageCount: 1,
        officialCommunityCount: row.is_official_remote_community ? 1 : 0,
        sampleCommunities: [row.community_name],
        gsId: row.gs_id,
        abn: row.abn,
        website: row.website,
      });
      continue;
    }

    current.coverageCount += 1;
    if (row.is_official_remote_community) current.officialCommunityCount += 1;
    current.sampleCommunities = compactUnique([...current.sampleCommunities, row.community_name]).slice(0, 4);
  }

  const topBuyerReach = Array.from(buyerReachMap.values())
    .sort((left, right) => {
      if (left.coverageCount !== right.coverageCount) return right.coverageCount - left.coverageCount;
      if (left.officialCommunityCount !== right.officialCommunityCount) return right.officialCommunityCount - left.officialCommunityCount;
      return left.buyerName.localeCompare(right.buyerName);
    })
    .slice(0, 10);

  return {
    officialCommunityCount: officialRows.length,
    officialCoveredCount,
    officialUncoveredCount: officialRows.length - officialCoveredCount,
    officialMissingPostcodeCount: officialRows.filter((row) => Boolean(row.needs_postcode_enrichment)).length,
    goodsSignalCount: summaries.filter((row) => Boolean(row.has_goods_signal)).length,
    weakCoverage,
    topBuyerReach,
    dataNeeds: compactUnique([
      officialRows.some((row) => Boolean(row.needs_postcode_enrichment))
        ? 'Add an official NT community-to-postcode crosswalk so place-level funding and service signals stop dropping out.'
        : '',
      officialRows.some((row) => (row.buyer_match_count || 0) === 0)
        ? 'Map which store, health, housing, and council service actually procures into each remote community.'
        : '',
      topBuyerReach.length < 10
        ? 'Scrape regional buyer and distributor data for ALPA, Outback Stores, CentreCorp/Centrebuild, councils, housing providers, and Aboriginal medical services.'
        : '',
      'Add NT tender, council procurement, housing maintenance, and community-store supplier data for beds, washing machines, refrigerators, and freight.',
    ]),
  };
}

function buildCommunityProofRows(
  assetRows: GoodsAssetRow[],
  placeFundingMap: Map<string, PlaceFundingRow>,
  communityControlMap: Map<string, number>,
  thinMap: Map<string, number>,
  capturedMap: Map<string, number>,
) {
  const assetMap = new Map<string, GoodsAssetRow[]>();
  for (const row of assetRows) {
    const community = row.community?.trim() || row.place?.trim() || 'Unknown';
    if (!assetMap.has(community)) assetMap.set(community, []);
    assetMap.get(community)!.push(row);
  }

  const rows: GoodsCommunityProof[] = [];

  for (const seed of COMMUNITY_SEEDS) {
    const communityAssets = assetMap.get(seed.name) || [];
    const bedsDelivered = communityAssets.filter((row) => isBedProduct(row.product)).length;
    const washersDelivered = communityAssets.filter((row) => isWasherProduct(row.product)).length;
    const supportSignals = communityAssets.filter((row) => /repair|broken|replace|support|issue/i.test(row.notes || '')).length;
    const staleAssets = communityAssets.filter((row) => {
      const age = daysSince(row.last_checkin_date || row.supply_date || row.created_time);
      return age == null || age > 365;
    }).length;
    const latestCheckin = communityAssets
      .map((row) => row.last_checkin_date || row.supply_date || row.created_time)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

    const funding = placeFundingMap.get(seed.postcode);
    const communityControlled = communityControlMap.get(seed.postcode) || 0;
    const stateThinDistricts = thinMap.get(seed.state) || 0;
    const stateCapturedDistricts = capturedMap.get(seed.state) || 0;

    let score = 0;
    const reasons: string[] = [];
    if (seed.priorityNeed === 'critical') {
      score += 28;
      reasons.push('Documented demand is already at a scale that justifies production expansion.');
    } else if (seed.priorityNeed === 'high') {
      score += 20;
      reasons.push('Existing delivery proof and unmet household demand both remain strong.');
    } else {
      score += 12;
      reasons.push('This location expands the model beyond one region and proves replicability.');
    }
    score += Math.min(seed.demandBeds / 10, 18);
    if (seed.demandWashers > 0) score += Math.min(seed.demandWashers / 15, 10);
    if (bedsDelivered > 0) {
      score += Math.min(bedsDelivered / 15, 12);
      reasons.push(`${bedsDelivered} tracked bed assets already prove the product lands in community.`);
    }
    if ((funding?.entity_count || 0) <= 50) {
      score += 8;
      reasons.push('Local institutional density is thin, so each partner pathway has outsized leverage.');
    }
    if ((funding?.total_funding || 0) < 5_000_000) {
      score += 8;
      reasons.push('Funding volume looks low relative to the level of practical household need.');
    }
    if (communityControlled > 0) {
      score += 10;
      reasons.push(`${communityControlled} local community-controlled organisations increase the odds of community-owned delivery and production.`);
    }
    if (stateThinDistricts > 0) {
      score += 6;
      reasons.push(`${stateThinDistricts} thin NDIS market districts in ${seed.state} reinforce the case for durable locally serviceable goods.`);
    }
    if (stateCapturedDistricts > 0) {
      score += 5;
      reasons.push(`${stateCapturedDistricts} captured disability-service districts show why local alternatives matter.`);
    }
    if (staleAssets > 0) {
      score += 3;
      reasons.push(`${staleAssets} assets need ongoing support or fresh engagement, which strengthens the service-case for local production.`);
    }

    rows.push({
      id: slugify(seed.name),
      community: seed.name,
      state: seed.state,
      postcode: seed.postcode,
      regionLabel: seed.regionLabel,
      remoteness: funding?.remoteness || null,
      lgaName: funding?.lga_name || null,
      totalAssets: communityAssets.length,
      bedsDelivered,
      washersDelivered,
      supportSignals,
      staleAssets,
      demandBeds: seed.demandBeds,
      demandWashers: seed.demandWashers,
      latestCheckin,
      totalFunding: funding?.total_funding || null,
      localEntityCount: funding?.entity_count || null,
      localCommunityControlledCount: communityControlled,
      localNdisProviders: null,
      stateThinDistricts,
      stateCapturedDistricts,
      needLeverageScore: Math.round(Math.min(score, 100)),
      needReasons: reasons,
      proofLine: seed.proofLine,
      story: seed.story,
      youthJobs: seed.youthJobs,
      keyPartnerNames: seed.keyPartnerNames,
      knownBuyer: seed.knownBuyer,
    });
  }

  return rows.sort((a, b) => b.needLeverageScore - a.needLeverageScore || a.community.localeCompare(b.community));
}

function buildOrClause(column: string, patterns: string[]) {
  return patterns
    .map((pattern) => `${column}.ilike.%${pattern.replace(/[%,'"]/g, ' ').trim().replace(/\s+/g, '%')}%`)
    .join(',');
}

async function fetchEntityMatches(serviceDb: ServiceDb, patterns: string[]) {
  const { data } = await serviceDb
    .from('gs_entities')
    .select('id,gs_id,canonical_name,abn,website,state,entity_type,sector,sub_sector,description,source_count,source_datasets,is_community_controlled,remoteness,lga_name,latest_revenue,latest_assets')
    .or(buildOrClause('canonical_name', patterns))
    .limit(120);
  return (data || []) as EntityMatchRow[];
}

async function fetchTrackedIdentityMatches(serviceDb: ServiceDb, candidates: GoodsIdentityCandidate[]) {
  const abns = compactUnique(candidates.map((candidate) => candidate.abn));
  const names = compactUnique(candidates.map((candidate) => candidate.name));
  const [abnResponse, nameResponse] = await Promise.all([
    abns.length
      ? serviceDb
          .from('gs_entities')
          .select('id,gs_id,canonical_name,abn,website,state,entity_type,sector,sub_sector,description,source_count,source_datasets,is_community_controlled,remoteness,lga_name,latest_revenue,latest_assets')
          .in('abn', abns)
          .limit(60)
      : Promise.resolve({ data: [] as EntityMatchRow[] }),
    names.length
      ? serviceDb
          .from('gs_entities')
          .select('id,gs_id,canonical_name,abn,website,state,entity_type,sector,sub_sector,description,source_count,source_datasets,is_community_controlled,remoteness,lga_name,latest_revenue,latest_assets')
          .or(buildOrClause('canonical_name', names))
          .limit(80)
      : Promise.resolve({ data: [] as EntityMatchRow[] }),
  ]);

  const deduped = new Map<string, EntityMatchRow>();

  for (const response of [abnResponse, nameResponse]) {
    for (const row of response.data || []) {
      deduped.set(row.id, row);
    }
  }

  return Array.from(deduped.values());
}

async function fetchFoundations(serviceDb: ServiceDb, patterns: string[]) {
  const { data } = await serviceDb
    .from('foundations')
    .select('id,name,website,profile_confidence,total_giving_annual,thematic_focus,geographic_focus,giving_philosophy,avg_grant_size,grant_range_min,grant_range_max,application_tips,open_programs')
    .or(buildOrClause('name', patterns))
    .limit(60);
  return (data || []) as FoundationRow[];
}

async function fetchFoundationPowerProfiles(serviceDb: ServiceDb, foundationIds: string[]) {
  if (!foundationIds.length) return new Map<string, FoundationPowerRow>();
  const { data } = await serviceDb
    .from('foundation_power_profiles')
    .select('foundation_id,capital_holder_class,capital_source_class,reportable_in_power_map,openness_score,gatekeeping_score')
    .in('foundation_id', foundationIds);
  return new Map((data || []).map((row) => [row.foundation_id, row as FoundationPowerRow]));
}

async function fetchSavedFoundationMap(serviceDb: ServiceDb, orgProfileId: string | null) {
  if (!orgProfileId) return new Map<string, SavedFoundationRow>();
  const { data } = await serviceDb
    .from('saved_foundations')
    .select('foundation_id,relationship_stage,notes,last_contact_date,alignment_score,alignment_reasons')
    .eq('org_profile_id', orgProfileId);
  return new Map((data || []).map((row) => [row.foundation_id, row as SavedFoundationRow]));
}

async function fetchSavedGrantMap(serviceDb: ServiceDb, orgProfileId: string | null) {
  if (!orgProfileId) return new Map<string, SavedGrantRow>();
  const { data } = await serviceDb
    .from('saved_grants')
    .select('grant_id,stage,notes')
    .eq('org_profile_id', orgProfileId);
  return new Map((data || []).map((row) => [row.grant_id, row as SavedGrantRow]));
}

async function fetchCapitalGrants(serviceDb: ServiceDb) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await serviceDb
    .from('grant_opportunities')
    .select('id,name,provider,amount_min,amount_max,closes_at,categories,focus_areas,source,url,geography,grant_type,application_status,last_verified_at')
    .or([
      buildOrClause('name', ['social enterprise', 'manufacturing', 'indigenous', 'community enterprise', 'remote', 'catalysing impact', 'housing', 'youth jobs']),
      buildOrClause('provider', ['social enterprise', 'manufacturing', 'indigenous', 'community enterprise']),
    ].join(','))
    .gte('closes_at', today)
    .order('closes_at', { ascending: true })
    .limit(80);
  return (data || []) as GrantRow[];
}

function scoreBuyerTarget(seed: GoodsBuyerSeed, entity: EntityMatchRow | null, communities: GoodsCommunityProof[]) {
  let score = 30;
  const reasons = compactUnique([
    seed.remoteFootprint,
    seed.productFit,
    seed.procurementPath,
  ]);

  if (seed.relationshipStatus === 'active') {
    score += 22;
    reasons.push('There is already a live Goods relationship or order proof to build on.');
  } else if (seed.relationshipStatus === 'warm') {
    score += 14;
    reasons.push('There is already enough context or warm contact to make an informed approach plausible.');
  } else {
    score += 6;
  }

  if (seed.knownOrderSignal) {
    score += 14;
    reasons.push(seed.knownOrderSignal);
  }

  if (entity?.website || seed.contactSurface) score += 8;
  if (entity?.is_community_controlled || entity?.entity_type === 'indigenous_corp') {
    score += 10;
    reasons.push('This pathway already sits inside or alongside community-controlled structures.');
  }
  if (entity?.state && seed.states.includes(entity.state)) score += 8;
  if (entity?.source_count && entity.source_count > 1) score += 5;
  if (/(housing|health|council|regional|retail|store|foundation)/i.test(`${seed.role} ${entity?.sub_sector || ''}`)) score += 7;
  if (seed.route.includes('Bulk') || seed.route.includes('distribution') || seed.route.includes('retail')) score += 8;

  let needLeverageScore = 0;
  for (const community of communities) {
    if (!community.knownBuyer) continue;
    if (normalizeText(community.knownBuyer).includes(normalizeText(seed.name)) || normalizeText(seed.name).includes(normalizeText(community.knownBuyer))) {
      needLeverageScore = Math.max(needLeverageScore, community.needLeverageScore);
    }
  }
  if (!needLeverageScore && seed.states.includes('NT')) {
    needLeverageScore = Math.round(averageNumber(communities.filter((community) => community.state === 'NT').map((community) => community.needLeverageScore)));
  }

  return {
    buyerPlausibilityScore: Math.min(100, Math.round(score)),
    needLeverageScore: Math.min(100, Math.round(needLeverageScore || 45)),
    reasons: reasons.slice(0, 4),
  };
}

function averageNumber(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildBuyerTargets(
  entityMatches: EntityMatchRow[],
  communities: GoodsCommunityProof[],
  ntSweep: GoodsNtCommunitySweep,
) {
  const ntReachMap = new Map(
    ntSweep.topBuyerReach.map((row) => [normalizeText(row.buyerName), row]),
  );

  return BUYER_SEEDS.map((seed) => {
    const entity = entityMatches.find((row) => normalizeText(row.canonical_name).includes(normalizeText(seed.matchPattern)));
    const scored = scoreBuyerTarget(seed, entity || null, communities);
    const ntReach =
      ntReachMap.get(normalizeText(entity?.canonical_name || '')) ||
      ntReachMap.get(normalizeText(seed.name)) ||
      null;
    const reasons = [...scored.reasons];
    let buyerPlausibilityScore = scored.buyerPlausibilityScore;
    if (ntReach) {
      buyerPlausibilityScore = Math.min(100, buyerPlausibilityScore + Math.min(10, ntReach.officialCommunityCount * 2));
      reasons.unshift(
        `${ntReach.buyerName} already appears against ${ntReach.officialCommunityCount} official NT communities in the current service crosswalk.`,
      );
    }
    return {
      id: seed.key,
      name: entity?.canonical_name || seed.name,
      gsId: entity?.gs_id || null,
      state: entity?.state || seed.states[0] || null,
      role: seed.role,
      relationshipStatus: seed.relationshipStatus,
      remoteFootprint: seed.remoteFootprint,
      productFit: seed.productFit,
      procurementPath: seed.procurementPath,
      contactSurface: seed.contactSurface,
      nextAction: seed.nextAction,
      orderSignal: seed.knownOrderSignal,
      buyerPlausibilityScore,
      needLeverageScore: scored.needLeverageScore,
      reasons: reasons.slice(0, 5),
      relationshipNote: seed.knownOrderSignal || seed.remoteFootprint,
      website: entity?.website || null,
      matchedEntityType: entity?.entity_type || null,
      matchedCommunityControl: Boolean(entity?.is_community_controlled),
      matchedSourceCount: entity?.source_count || null,
      ntCommunityReach: ntReach?.coverageCount || 0,
      ntOfficialCommunityReach: ntReach?.officialCommunityCount || 0,
    } satisfies GoodsBuyerTarget;
  }).sort((a, b) => b.buyerPlausibilityScore - a.buyerPlausibilityScore || b.needLeverageScore - a.needLeverageScore);
}

function scoreCapitalTarget(
  seed: GoodsCapitalSeed,
  foundation: FoundationRow | null,
  powerProfile: FoundationPowerRow | null,
  grant: GrantRow | null,
  savedFoundation: SavedFoundationRow | null,
  savedGrant: SavedGrantRow | null,
) {
  let score = seed.instrumentType === 'loan' ? 55 : 48;
  const reasons = compactUnique([seed.knownSignal, seed.nextAction]);

  if (seed.relationshipStatus === 'active') {
    score += 22;
    reasons.push('There is already active relationship equity to build on.');
  } else if (seed.relationshipStatus === 'warm') {
    score += 15;
    reasons.push('The relationship is warm enough to make a targeted ask realistic.');
  } else {
    score += 6;
  }

  const thematicFocus = compactUnique([
    ...normalizeArray(foundation?.thematic_focus),
    ...normalizeArray(grant?.categories),
    ...normalizeArray(grant?.focus_areas),
  ]);
  const geography = compactUnique([
    ...normalizeArray(foundation?.geographic_focus),
    ...(grant?.geography ? [grant.geography] : []),
  ]);

  const themeText = normalizeText(thematicFocus.join(' '));
  if (/(indigenous|community|housing|health|social-enterprise|social enterprise|employment|economic development)/.test(themeText)) {
    score += 15;
    reasons.push('Theme fit includes Indigenous/community, health, housing, or social enterprise signals.');
  }
  if (/(nt|qld|central australia|national)/i.test(geography.join(' '))) {
    score += 10;
    reasons.push('Geography fit includes NT, QLD, or national coverage that can carry remote-community work.');
  }

  if (powerProfile?.openness_score != null) {
    score += Math.round(powerProfile.openness_score * 10);
  }
  if (powerProfile?.gatekeeping_score != null) {
    score -= Math.round(powerProfile.gatekeeping_score * 5);
  }

  if (foundation?.total_giving_annual && foundation.total_giving_annual >= 500_000) score += 10;
  if (grant?.amount_max && grant.amount_max >= 100_000) score += 8;
  if (savedFoundation?.relationship_stage || savedGrant?.stage) score += 6;
  if (foundation?.application_tips || foundation?.open_programs?.length || grant?.url) score += 5;

  return {
    capitalFitScore: Math.min(100, Math.max(0, Math.round(score))),
    reasons: reasons.slice(0, 4),
    thematicFocus,
    geography,
  };
}

function buildTrackedIdentityCandidates(orgContext: OrgProfileContext) {
  const candidates: GoodsIdentityCandidate[] = [];
  if (orgContext.profile?.abn) {
    candidates.push({
      name: orgContext.profile?.name || null,
      abn: orgContext.profile.abn,
      trackedFrom: 'org_profile_abn',
    });
  }
  if (orgContext.profile?.name) {
    candidates.push({
      name: orgContext.profile.name,
      abn: orgContext.profile.abn || null,
      trackedFrom: 'org_profile_name',
    });
  }
  for (const abn of GOODS_TRACKED_ABNS) {
    candidates.push({ name: null, abn, trackedFrom: 'env_abn' });
  }
  for (const name of GOODS_TRACKED_ENTITY_NAMES) {
    candidates.push({ name, abn: null, trackedFrom: 'env_name' });
  }
  return candidates;
}

function trackedIdentityPriority(source: GoodsTrackedIdentitySource) {
  switch (source) {
    case 'org_profile_abn':
      return 0;
    case 'org_profile_name':
      return 1;
    case 'env_abn':
      return 2;
    case 'env_name':
      return 3;
  }
}

function resolveTrackedIdentities(candidates: GoodsIdentityCandidate[], matches: EntityMatchRow[]) {
  const ordered = [...candidates].sort(
    (left, right) => trackedIdentityPriority(left.trackedFrom) - trackedIdentityPriority(right.trackedFrom),
  );
  const deduped = new Map<string, GoodsTrackedIdentity>();

  for (const candidate of ordered) {
    const nameKey = normalizeText(candidate.name);
    const match =
      (candidate.abn
        ? matches.find((row) => row.abn === candidate.abn) || null
        : null) ||
      (nameKey
        ? matches.find((row) => {
            const entityName = normalizeText(row.canonical_name);
            return entityName.includes(nameKey) || nameKey.includes(entityName);
          }) || null
        : null);

    const identity: GoodsTrackedIdentity = {
      id: match?.id || slugify(`${candidate.trackedFrom}-${candidate.abn || candidate.name || 'identity'}`),
      name: match?.canonical_name || candidate.name || `ABN ${candidate.abn}`,
      abn: match?.abn || candidate.abn,
      gsId: match?.gs_id || null,
      entityId: match?.id || null,
      entityType: match?.entity_type || null,
      state: match?.state || null,
      website: match?.website || null,
      matchStatus: match ? 'matched' : 'pending',
      trackedFrom: candidate.trackedFrom,
      identityRole: inferTrackedIdentityRole(
        match?.entity_type || null,
        match?.canonical_name || candidate.name || null,
      ),
    };

    const dedupeKey = match?.id || `abn:${identity.abn || ''}` || `name:${normalizeText(identity.name)}`;
    if (!dedupeKey) continue;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, identity);
    }
  }

  return Array.from(deduped.values());
}

function inferTrackedIdentityRole(
  entityType: string | null,
  name: string | null,
): GoodsTrackedIdentityRole {
  const normalizedName = normalizeText(name);
  const normalizedType = normalizeText(entityType);

  if (
    normalizedType.includes('charity') ||
    normalizedType.includes('foundation') ||
    normalizedName.includes('foundation') ||
    normalizedName.includes('charitable') ||
    normalizedName.includes('clg') ||
    normalizedName.includes('trust')
  ) {
    return 'philanthropic';
  }

  if (
    normalizedType.includes('indigenous') ||
    normalizedType.includes('aboriginal') ||
    normalizedType.includes('community') ||
    normalizedName.includes('aboriginal corporation') ||
    normalizedName.includes('community')
  ) {
    return 'community';
  }

  if (
    normalizedType.includes('social_enterprise') ||
    normalizedType.includes('company') ||
    normalizedType.includes('business') ||
    normalizedName.includes('pty') ||
    normalizedName.includes('ventures') ||
    normalizedName.includes('ltd') ||
    normalizedName.includes('limited')
  ) {
    return 'commercial';
  }

  return 'general';
}

function getPrimaryTrackedIdentity(
  trackedIdentities: GoodsTrackedIdentity[],
  orgContext: OrgProfileContext,
) {
  return (
    trackedIdentities.find((identity) => identity.trackedFrom === 'org_profile_abn' && identity.matchStatus === 'matched') ||
    trackedIdentities.find((identity) => identity.trackedFrom === 'org_profile_name' && identity.matchStatus === 'matched') ||
    trackedIdentities.find((identity) => identity.matchStatus === 'matched') ||
    trackedIdentities.find((identity) => identity.abn && identity.abn === orgContext.profile?.abn) ||
    trackedIdentities[0] ||
    null
  );
}

function rankIdentityForTargetType(
  identity: GoodsTrackedIdentity,
  targetType: GoodsTargetType,
) {
  let score = identity.matchStatus === 'matched' ? 60 : 30;

  if (targetType === 'buyer') {
    if (identity.identityRole === 'commercial') score += 40;
    if (identity.identityRole === 'community') score += 18;
    if (identity.identityRole === 'philanthropic') score -= 20;
  } else if (targetType === 'capital') {
    if (identity.identityRole === 'philanthropic') score += 40;
    if (identity.identityRole === 'community') score += 10;
    if (identity.identityRole === 'commercial') score -= 15;
  } else {
    if (identity.identityRole === 'community') score += 35;
    if (identity.identityRole === 'commercial') score += 20;
    if (identity.identityRole === 'philanthropic') score -= 10;
  }

  if (identity.trackedFrom === 'org_profile_abn') score += 6;
  if (identity.trackedFrom === 'org_profile_name') score += 4;

  return score;
}

function recommendationLabel(targetType: GoodsTargetType, identity: GoodsTrackedIdentity | null) {
  const fallback =
    targetType === 'buyer'
      ? 'Sales and procurement source'
      : targetType === 'capital'
        ? 'Capital and philanthropy source'
        : 'Partnership and community source';
  if (!identity) return fallback;
  if (identity.identityRole === 'commercial') return 'Commercial outreach source';
  if (identity.identityRole === 'philanthropic') return 'Philanthropy and grant source';
  if (identity.identityRole === 'community') return 'Community partnership source';
  return fallback;
}

function recommendationRationale(targetType: GoodsTargetType, identity: GoodsTrackedIdentity | null) {
  if (!identity) {
    return 'No claimed identity is matched yet. Add your ABN or entity name so outreach is stamped with the right source.';
  }

  if (targetType === 'buyer') {
    if (identity.identityRole === 'commercial') {
      return 'Use the commercial/PTy identity for buyers so beds, procurement, repeat orders, and distribution conversations feel like real trade, not grant-seeking.';
    }
    return 'This is the strongest available matched identity right now, but a commercial PTY will be a better default for buyer and procurement outreach once it is added.';
  }

  if (targetType === 'capital') {
    if (identity.identityRole === 'philanthropic') {
      return 'Use the charity/foundation-facing identity for grants, philanthropy, and catalytic capital so the ask reads as mission-led and community-accountable.';
    }
    return 'This is the best available current identity, but a charity or foundation-facing entity will usually work better for philanthropy and grants.';
  }

  if (identity.identityRole === 'community') {
    return 'Use the community-facing identity when the goal is local production, Aboriginal partnership, and place-based legitimacy.';
  }

  if (identity.identityRole === 'commercial') {
    return 'This identity is strongest when partnerships need to see a delivery and trading vehicle behind the offer.';
  }

  return 'This identity is the best available source for partnership outreach right now.';
}

function buildOutboundIdentityRecommendations(
  trackedIdentities: GoodsTrackedIdentity[],
  primaryTrackedIdentity: GoodsTrackedIdentity | null,
): Record<GoodsTargetType, GoodsOutboundIdentityRecommendation> {
  const pick = (targetType: GoodsTargetType) =>
    [...trackedIdentities].sort((left, right) => rankIdentityForTargetType(right, targetType) - rankIdentityForTargetType(left, targetType))[0] ||
    primaryTrackedIdentity ||
    null;

  const buyerIdentity = pick('buyer');
  const capitalIdentity = pick('capital');
  const partnerIdentity = pick('partner');

  return {
    buyer: {
      targetType: 'buyer',
      identityId: buyerIdentity?.id || null,
      strategyLabel: recommendationLabel('buyer', buyerIdentity),
      rationale: recommendationRationale('buyer', buyerIdentity),
    },
    capital: {
      targetType: 'capital',
      identityId: capitalIdentity?.id || null,
      strategyLabel: recommendationLabel('capital', capitalIdentity),
      rationale: recommendationRationale('capital', capitalIdentity),
    },
    partner: {
      targetType: 'partner',
      identityId: partnerIdentity?.id || null,
      strategyLabel: recommendationLabel('partner', partnerIdentity),
      rationale: recommendationRationale('partner', partnerIdentity),
    },
  };
}

function buildCapitalTargets(
  foundations: FoundationRow[],
  powerProfiles: Map<string, FoundationPowerRow>,
  grants: GrantRow[],
  savedFoundations: Map<string, SavedFoundationRow>,
  savedGrants: Map<string, SavedGrantRow>,
) {
  const targets: GoodsCapitalTarget[] = [];

  for (const seed of CAPITAL_SEEDS) {
    const foundation = seed.foundationPattern
      ? foundations.find((row) => normalizeText(row.name).includes(normalizeText(seed.foundationPattern))) ?? null
      : null;
    const grant = seed.grantPattern
      ? grants.find((row) => normalizeText(row.name).includes(normalizeText(seed.grantPattern)) || normalizeText(row.provider).includes(normalizeText(seed.grantPattern))) ?? null
      : null;

    if (!foundation && !grant) continue;

    const scored = scoreCapitalTarget(
      seed,
      foundation,
      foundation ? powerProfiles.get(foundation.id) || null : null,
      grant,
      foundation ? savedFoundations.get(foundation.id) || null : null,
      grant ? savedGrants.get(grant.id) || null : null,
    );

    targets.push({
      id: seed.key,
      name: foundation?.name || grant?.name || seed.name,
      foundationId: foundation?.id || null,
      grantId: grant?.id || null,
      sourceKind: foundation ? 'foundation' : 'grant',
      instrumentType: seed.instrumentType,
      relationshipStatus: foundation && savedFoundations.get(foundation.id)?.relationship_stage
        ? 'active'
        : grant && savedGrants.get(grant.id)?.stage
          ? 'warm'
          : seed.relationshipStatus,
      stageFit: seed.stageFit,
      contactSurface: seed.contactSurface,
      nextAction: seed.nextAction,
      capitalFitScore: scored.capitalFitScore,
      opennessScore: foundation ? powerProfiles.get(foundation.id)?.openness_score ?? null : null,
      gatekeepingScore: foundation ? powerProfiles.get(foundation.id)?.gatekeeping_score ?? null : null,
      amountSignal: foundation
        ? formatCurrency(foundation.total_giving_annual)
        : formatCurrency(grant?.amount_max || grant?.amount_min),
      reasons: scored.reasons,
      thematicFocus: scored.thematicFocus,
      geographicFocus: scored.geography,
      deadline: grant?.closes_at || null,
      relationshipNote: foundation ? (savedFoundations.get(foundation.id)?.notes || seed.knownSignal) : (savedGrants.get(grant!.id)?.notes || seed.knownSignal),
      url: foundation?.website || grant?.url || null,
    });
  }

  return targets.sort((a, b) => b.capitalFitScore - a.capitalFitScore || a.name.localeCompare(b.name));
}

function buildPartnerTargets(entityMatches: EntityMatchRow[]) {
  return PARTNER_SEEDS.map((seed) => {
    const entity = seed.matchPattern
      ? entityMatches.find((row) => normalizeText(row.canonical_name).includes(normalizeText(seed.matchPattern)))
      : null;

    let score = 40;
    const reasons = [seed.knownSignal];
    if (seed.relationshipStatus === 'active') score += 25;
    else if (seed.relationshipStatus === 'warm') score += 15;
    else score += 8;
    if (entity?.is_community_controlled || entity?.entity_type === 'indigenous_corp') {
      score += 15;
      reasons.push('Community-controlled governance makes local ownership and implementation more credible.');
    }
    if (entity?.website) score += 5;
    if (entity?.state && seed.states.includes(entity.state)) score += 8;
    if (/health|housing|regional|distribution|community/i.test(seed.role)) score += 7;

    return {
      id: seed.key,
      name: entity?.canonical_name || seed.name,
      gsId: entity?.gs_id || null,
      role: seed.role,
      state: entity?.state || seed.states[0] || null,
      relationshipStatus: seed.relationshipStatus,
      contactSurface: entity?.website || 'Relationship-led outreach',
      nextAction: seed.nextAction,
      communityControlled: Boolean(entity?.is_community_controlled || entity?.entity_type === 'indigenous_corp'),
      partnerScore: Math.min(100, score),
      reasons: reasons.slice(0, 3),
      website: entity?.website || null,
      relationshipNote: seed.knownSignal,
    } satisfies GoodsPartnerTarget;
  }).sort((a, b) => b.partnerScore - a.partnerScore || a.name.localeCompare(b.name));
}

function buildCapitalPathways(capitalTargets: GoodsCapitalTarget[]) {
  const byId = new Set(capitalTargets.map((row) => row.id));
  return [
    {
      id: 'snow-sefa-sedi',
      title: 'Anchor grant + debt + capability',
      summary: 'Use Snow to validate the community-production thesis, SEFA for working capital/facility finance, and SEDI for capability-building and scale support.',
      targetIds: ['snow', 'sefa', 'sedi'].filter((id) => byId.has(id)),
    },
    {
      id: 'centrecorp-central-aus',
      title: 'Central Australia buyer-to-capital stack',
      summary: 'Convert the existing Centrebuild/Centrecorp buyer proof into blended capital for Utopia and Central Australian production expansion.',
      targetIds: ['centrecorp-foundation', 'central-australian', 'sefa'].filter((id) => byId.has(id)),
    },
    {
      id: 'regional-industrial',
      title: 'Regional jobs and circular manufacturing',
      summary: 'Use Rio Tinto, Fortescue, and Minderoo to frame Goods as community manufacturing, remote jobs, and circular-economy infrastructure.',
      targetIds: ['rio', 'fortescue', 'minderoo'].filter((id) => byId.has(id)),
    },
  ].filter((pathway) => pathway.targetIds.length > 0);
}

function buildTopMoves(
  communities: GoodsCommunityProof[],
  buyers: GoodsBuyerTarget[],
  capitals: GoodsCapitalTarget[],
  partners: GoodsPartnerTarget[],
  ntSweep: GoodsNtCommunitySweep,
) {
  const topCommunity = communities[0];
  const topBuyer = buyers[0];
  const topCapital = capitals[0];
  const topPartner = partners[0];
  const topGap = ntSweep.weakCoverage[0];

  return [
    {
      title: `Move first on ${topBuyer?.name || 'the top buyer pathway'}`,
      detail: topBuyer
        ? `${topBuyer.name} is the strongest immediate buyer pathway because ${topBuyer.reasons[0]?.toLowerCase() || 'it already has credible Goods fit'}.`
        : 'No buyer target was scored high enough yet.',
    },
    {
      title: `Use ${topCapital?.name || 'capital'} to unlock scale`,
      detail: topCapital
        ? `${topCapital.name} is the strongest capital move because ${topCapital.reasons[0]?.toLowerCase() || 'it matches stage and theme fit'}.`
        : 'No capital target was scored high enough yet.',
    },
    {
      title: `Lead every pitch with ${topCommunity?.community || 'community proof'}`,
      detail: topCommunity
        ? `${topCommunity.community} currently carries the strongest need-and-proof signal: ${topCommunity.proofLine}`
        : 'Community proof needs more structured signal before outreach.',
    },
    {
      title: `Close the NT blind spot in ${topGap?.community || 'remote community coverage'}`,
      detail: topGap
        ? `${topGap.community} still has ${topGap.buyerMatchCount} buyer/service matches and ${topGap.communityControlledMatchCount} community-controlled matches. This is where the next procurement and buyer crosswalk should go.`
        : topPartner
          ? `${topPartner.name} should stay visible in the story because ${topPartner.reasons[0]?.toLowerCase() || 'it grounds the work in delivery credibility'}.`
          : 'Partner graph needs more structured coverage.',
    },
  ];
}

export async function getGoodsWorkspaceData(
  serviceDb: ServiceDb,
  orgContext: OrgProfileContext,
): Promise<GoodsWorkspaceData> {
  const [assetRows, narrativeSignals, lifecycleSignals] = await Promise.all([
    readGoodsAssetRows(),
    loadGoodsNarrativeSignals(),
    loadGoodsLifecycleSignals(),
  ]);

  const communities = COMMUNITY_SEEDS;
  const postcodes = communities.map((community) => community.postcode);
  const states = compactUnique(communities.map((community) => community.state));
  const identityCandidates = buildTrackedIdentityCandidates(orgContext);

  const [placeFundingMap, communityControlMap, ndisMaps, entityMatches, trackedIdentityMatches, foundations, grants, savedFoundations, savedGrants, ntSweep] = await Promise.all([
    fetchPlaceFundingMap(serviceDb, postcodes),
    fetchCommunityControlMap(serviceDb, postcodes),
    fetchNdisMaps(serviceDb, states),
    fetchEntityMatches(serviceDb, compactUnique([...BUYER_SEEDS.map((seed) => seed.matchPattern), ...PARTNER_SEEDS.map((seed) => seed.matchPattern || '')])),
    fetchTrackedIdentityMatches(serviceDb, identityCandidates),
    fetchFoundations(serviceDb, CAPITAL_SEEDS.map((seed) => seed.foundationPattern).filter(Boolean) as string[]),
    fetchCapitalGrants(serviceDb),
    fetchSavedFoundationMap(serviceDb, orgContext.orgProfileId),
    fetchSavedGrantMap(serviceDb, orgContext.orgProfileId),
    fetchNtCommunitySweep(serviceDb),
  ]);

  const communityRows = buildCommunityProofRows(assetRows, placeFundingMap, communityControlMap, ndisMaps.thinMap, ndisMaps.capturedMap);
  const lifecycle = buildLifecycleData(assetRows, narrativeSignals, lifecycleSignals);
  const buyerTargets = buildBuyerTargets(entityMatches, communityRows, ntSweep);
  const powerProfiles = await fetchFoundationPowerProfiles(serviceDb, foundations.map((row) => row.id));
  const capitalTargets = buildCapitalTargets(foundations, powerProfiles, grants, savedFoundations, savedGrants);
  const partnerTargets = buildPartnerTargets(entityMatches);
  const capitalPathways = buildCapitalPathways(capitalTargets);
  const trackedIdentities = resolveTrackedIdentities(identityCandidates, trackedIdentityMatches);
  const primaryTrackedIdentity = getPrimaryTrackedIdentity(trackedIdentities, orgContext);
  const outboundIdentityRecommendations = buildOutboundIdentityRecommendations(
    trackedIdentities,
    primaryTrackedIdentity,
  );
  const totalAssets = assetRows.length;
  const totalBeds = assetRows.filter((row) => isBedProduct(row.product)).length;
  const totalWashers = assetRows.filter((row) => isWasherProduct(row.product)).length;
  const totalRequests = COMMUNITY_SEEDS.reduce((sum, row) => sum + row.demandBeds + row.demandWashers, 0);
  const goodsGhlLocationId =
    process.env.GOODS_GHL_LOCATION_ID ||
    process.env.GHL_LOCATION_ID ||
    null;
  const goodsGhlOpportunitiesListUrl = goodsGhlLocationId
    ? `https://app.gohighlevel.com/v2/location/${goodsGhlLocationId}/opportunities/list`
    : null;

  return {
    orgName: orgContext.profile?.name || 'A Curious Tractor',
    orgAbn: orgContext.profile?.abn || null,
    ghl: {
      locationId: goodsGhlLocationId,
      opportunitiesListUrl: goodsGhlOpportunitiesListUrl,
    },
    primaryTrackedIdentity,
    trackedIdentities,
    outboundIdentityRecommendations,
    workspaceTitle: 'Goods Buyer + Capital Workspace',
    defaultMode: 'buyer',
    workflow: WORKFLOW,
    thesis: {
      headline: 'Remote beds first, community-owned production next.',
      summary:
        'Use Goods proof to win repeat bed buyers in remote Australia, then stack philanthropy, grants, and catalytic capital behind community-owned production with Oonchiumpa and other local partners.',
      pillars: [
        { title: 'Remote beds and household goods', detail: 'Lead with beds, then carry washers and replacement parts as health hardware, not charity goods.' },
        { title: 'Community-owned production', detail: 'Use Oonchiumpa and place-based partners to move from product delivery into local manufacturing and jobs.' },
        { title: 'Youth jobs and circular materials', detail: 'Tie recycled plastic, training, and paid work into every capital conversation.' },
        { title: 'Buyer-first growth', detail: 'Use Centrebuild/Centrecorp proof and remote distributors to create repeat-order pathways before scaling capital asks.' },
      ],
      currentStats: [
        { label: 'Tracked assets', value: String(totalAssets), detail: `${totalBeds} bed assets and ${totalWashers} washing machines already in the register.` },
        { label: 'Communities reached', value: String(communityRows.filter((row) => row.totalAssets > 0).length), detail: 'Live proof now spans NT, QLD, and WA communities.' },
        { label: 'NT official communities', value: `${ntSweep.officialCoveredCount}/${ntSweep.officialCommunityCount}`, detail: `${ntSweep.officialUncoveredCount} official NT communities still need buyer/service coverage and ${ntSweep.officialMissingPostcodeCount} still need postcode enrichment.` },
        { label: 'Known demand', value: `${totalRequests}+`, detail: 'Documented requests combine pending beds, washers, and expansion asks from communities and partners.' },
        { label: 'Confirmed catalytic backing', value: formatCurrency(narrativeSignals.snowConfirmed + narrativeSignals.frrrConfirmed + narrativeSignals.vfffConfirmed + narrativeSignals.tfnRaised), detail: 'Documented philanthropy and event-raised capital already behind the Goods model.' },
      ],
    },
    buyerTargets,
    capitalTargets,
    partnerTargets,
    communities: communityRows,
    ntSweep,
    lifecycle,
    capitalPathways,
    topMoves: buildTopMoves(communityRows, buyerTargets, capitalTargets, partnerTargets, ntSweep),
    sourcePaths: [GOODS_ASSET_PATH, GOODS_COMPENDIUM_PATH],
  };
}

function buildReasonText(reasons: string[]) {
  return reasons.filter(Boolean).join(' ');
}

function resolveFocusCommunity(data: GoodsWorkspaceData, focusCommunityId?: string | null) {
  if (!focusCommunityId) return data.communities[0] || null;
  return data.communities.find((community) => community.id === focusCommunityId) || data.communities[0] || null;
}

function recommendedPipelineLabel(targetType: GoodsTargetType) {
  switch (targetType) {
    case 'buyer':
      return 'Goods Sales';
    case 'capital':
      return 'Capital / Philanthropy';
    case 'partner':
      return 'Community Partnerships';
  }
}

function recommendedStageLabel(targetType: GoodsTargetType) {
  switch (targetType) {
    case 'buyer':
      return 'New buyer lead';
    case 'capital':
      return 'Research and warm intro';
    case 'partner':
      return 'Community partner discovery';
  }
}

function toExportRows(
  targets: Array<GoodsBuyerTarget | GoodsCapitalTarget | GoodsPartnerTarget>,
  targetType: GoodsTargetType,
  focusCommunity: GoodsCommunityProof | null,
  sourceIdentity: GoodsTrackedIdentity | null,
  orgName: string,
  orgAbn: string | null,
): GoodsExportRow[] {
  return targets.map((target) => {
    if (targetType === 'buyer') {
      const buyer = target as GoodsBuyerTarget;
      return {
        target_type: 'buyer',
        target_name: buyer.name,
        score: buyer.buyerPlausibilityScore,
        relationship_status: buyer.relationshipStatus,
        next_action: buyer.nextAction,
        contact_surface: buyer.contactSurface,
        why_plausible: buildReasonText(buyer.reasons),
        region_focus: compactUnique([buyer.state, buyer.remoteFootprint]).join(' • '),
        community_focus: focusCommunity?.community || '',
        community_postcode: focusCommunity?.postcode || '',
        community_state: focusCommunity?.state || '',
        recommended_pipeline: recommendedPipelineLabel(targetType),
        recommended_stage: recommendedStageLabel(targetType),
        source_url: buyer.website || '',
        source_org_name: sourceIdentity?.name || orgName,
        source_org_abn: sourceIdentity?.abn || orgAbn || '',
        source_entity_gs_id: sourceIdentity?.gsId || '',
      };
    }

    if (targetType === 'capital') {
      const capital = target as GoodsCapitalTarget;
      return {
        target_type: 'capital',
        target_name: capital.name,
        score: capital.capitalFitScore,
        relationship_status: capital.relationshipStatus,
        next_action: capital.nextAction,
        contact_surface: capital.contactSurface,
        why_plausible: buildReasonText(capital.reasons),
        region_focus: capital.geographicFocus.join(' • '),
        community_focus: focusCommunity?.community || '',
        community_postcode: focusCommunity?.postcode || '',
        community_state: focusCommunity?.state || '',
        recommended_pipeline: recommendedPipelineLabel(targetType),
        recommended_stage: recommendedStageLabel(targetType),
        source_url: capital.url || '',
        source_org_name: sourceIdentity?.name || orgName,
        source_org_abn: sourceIdentity?.abn || orgAbn || '',
        source_entity_gs_id: sourceIdentity?.gsId || '',
      };
    }

    const partner = target as GoodsPartnerTarget;
    return {
      target_type: 'partner',
      target_name: partner.name,
      score: partner.partnerScore,
      relationship_status: partner.relationshipStatus,
      next_action: partner.nextAction,
      contact_surface: partner.contactSurface,
      why_plausible: buildReasonText(partner.reasons),
      region_focus: partner.state || '',
      community_focus: focusCommunity?.community || '',
      community_postcode: focusCommunity?.postcode || '',
      community_state: focusCommunity?.state || '',
      recommended_pipeline: recommendedPipelineLabel(targetType),
      recommended_stage: recommendedStageLabel(targetType),
      source_url: partner.website || '',
      source_org_name: sourceIdentity?.name || orgName,
      source_org_abn: sourceIdentity?.abn || orgAbn || '',
      source_entity_gs_id: sourceIdentity?.gsId || '',
    };
  });
}

export function getSelectedGoodsTargets(
  data: GoodsWorkspaceData,
  targetType: GoodsTargetType,
  ids: string[] | null | undefined,
) {
  const targetIds = ids?.length ? new Set(ids) : null;
  if (targetType === 'buyer') {
    return data.buyerTargets.filter((target) => !targetIds || targetIds.has(target.id));
  }
  if (targetType === 'capital') {
    return data.capitalTargets.filter((target) => !targetIds || targetIds.has(target.id));
  }
  return data.partnerTargets.filter((target) => !targetIds || targetIds.has(target.id));
}

export function buildGoodsExportRows(
  data: GoodsWorkspaceData,
  targetType: GoodsTargetType,
  ids: string[] | null | undefined,
  sourceIdentityId?: string | null,
  focusCommunityId?: string | null,
) {
  const focusCommunity = resolveFocusCommunity(data, focusCommunityId);
  const sourceIdentity =
    (sourceIdentityId
      ? data.trackedIdentities.find((identity) => identity.id === sourceIdentityId) || null
      : null) ||
    (data.outboundIdentityRecommendations[targetType].identityId
      ? data.trackedIdentities.find((identity) => identity.id === data.outboundIdentityRecommendations[targetType].identityId) || null
      : null) ||
    data.primaryTrackedIdentity;
  return toExportRows(
    getSelectedGoodsTargets(data, targetType, ids),
    targetType,
    focusCommunity,
    sourceIdentity,
    data.orgName,
    data.orgAbn,
  );
}

export function buildGoodsCrmPayload(
  data: GoodsWorkspaceData,
  targetType: GoodsTargetType,
  ids: string[] | null | undefined,
  sourceIdentityId?: string | null,
  focusCommunityId?: string | null,
): GoodsCrmTargetPayload[] {
  const focusCommunity = resolveFocusCommunity(data, focusCommunityId);
  const sourceIdentity =
    (sourceIdentityId
      ? data.trackedIdentities.find((identity) => identity.id === sourceIdentityId) || null
      : null) ||
    (data.outboundIdentityRecommendations[targetType].identityId
      ? data.trackedIdentities.find((identity) => identity.id === data.outboundIdentityRecommendations[targetType].identityId) || null
      : null) ||
    data.primaryTrackedIdentity;
  return getSelectedGoodsTargets(data, targetType, ids).map((target) => {
    if (targetType === 'buyer') {
      const buyer = target as GoodsBuyerTarget;
      return {
        targetType,
        targetId: buyer.id,
        organizationName: buyer.name,
        contactEmail: extractEmail(buyer.contactSurface),
        contactPhone: extractPhone(buyer.contactSurface),
        regionFocus: compactUnique([buyer.state, buyer.remoteFootprint]).join(' • '),
        relationshipStatus: buyer.relationshipStatus,
        nextAction: buyer.nextAction,
        contactSurface: buyer.contactSurface,
        whyPlausible: buildReasonText(buyer.reasons),
        tags: ['goods', 'goods-buyer-target', buyer.relationshipStatus],
        sourceUrl: buyer.website || undefined,
        communityFocusName: focusCommunity?.community || undefined,
        communityFocusPostcode: focusCommunity?.postcode || undefined,
        communityFocusState: focusCommunity?.state || undefined,
        suggestedPipelineLabel: recommendedPipelineLabel(targetType),
        suggestedStageLabel: recommendedStageLabel(targetType),
        sourceOrgName: sourceIdentity?.name || data.orgName,
        sourceOrgAbn: sourceIdentity?.abn || data.orgAbn || undefined,
        sourceEntityGsId: sourceIdentity?.gsId || undefined,
        sourceIdentityName: sourceIdentity?.name || data.orgName,
      };
    }

    if (targetType === 'capital') {
      const capital = target as GoodsCapitalTarget;
      return {
        targetType,
        targetId: capital.id,
        organizationName: capital.name,
        contactEmail: extractEmail(capital.contactSurface),
        contactPhone: extractPhone(capital.contactSurface),
        regionFocus: capital.geographicFocus.join(' • '),
        relationshipStatus: capital.relationshipStatus,
        nextAction: capital.nextAction,
        contactSurface: capital.contactSurface,
        whyPlausible: buildReasonText(capital.reasons),
        tags: ['goods', 'goods-capital-target', capital.instrumentType, capital.relationshipStatus],
        sourceUrl: capital.url || undefined,
        communityFocusName: focusCommunity?.community || undefined,
        communityFocusPostcode: focusCommunity?.postcode || undefined,
        communityFocusState: focusCommunity?.state || undefined,
        suggestedPipelineLabel: recommendedPipelineLabel(targetType),
        suggestedStageLabel: recommendedStageLabel(targetType),
        sourceOrgName: sourceIdentity?.name || data.orgName,
        sourceOrgAbn: sourceIdentity?.abn || data.orgAbn || undefined,
        sourceEntityGsId: sourceIdentity?.gsId || undefined,
        sourceIdentityName: sourceIdentity?.name || data.orgName,
      };
    }

    const partner = target as GoodsPartnerTarget;
    return {
      targetType,
      targetId: partner.id,
      organizationName: partner.name,
      contactEmail: extractEmail(partner.contactSurface),
      contactPhone: extractPhone(partner.contactSurface),
      regionFocus: partner.state || '',
      relationshipStatus: partner.relationshipStatus,
      nextAction: partner.nextAction,
      contactSurface: partner.contactSurface,
      whyPlausible: buildReasonText(partner.reasons),
      tags: ['goods', 'goods-partner-target', partner.relationshipStatus],
      sourceUrl: partner.website || undefined,
      communityFocusName: focusCommunity?.community || undefined,
      communityFocusPostcode: focusCommunity?.postcode || undefined,
      communityFocusState: focusCommunity?.state || undefined,
      suggestedPipelineLabel: recommendedPipelineLabel(targetType),
      suggestedStageLabel: recommendedStageLabel(targetType),
      sourceOrgName: sourceIdentity?.name || data.orgName,
      sourceOrgAbn: sourceIdentity?.abn || data.orgAbn || undefined,
      sourceEntityGsId: sourceIdentity?.gsId || undefined,
      sourceIdentityName: sourceIdentity?.name || data.orgName,
    };
  });
}

export function toCsv(data: Record<string, unknown>[]) {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value == null) return '';
      if (typeof value === 'object') {
        const json = JSON.stringify(value);
        return `"${json.replace(/"/g, '""')}"`;
      }
      const text = String(value);
      if (/[,"\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    }).join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}
