import { getServiceSupabase } from '@/lib/supabase';
import type { ActPlaceFieldDefinition } from '@/lib/services/act-place-fields';

export type ActPlaceFieldInitiativeStatus = 'underway' | 'ongoing' | 'ready_for_closure' | 'complete';
export type ActPlaceFieldInitiativeCategory = 'economic_development' | 'social_development' | 'culture_and_place';
export type ActPlaceFieldLens = 'goods' | 'justice' | 'story' | 'relationships';

export interface ActPlaceFieldInitiative {
  number: number;
  title: string;
  summary: string;
  category: ActPlaceFieldInitiativeCategory;
  status: ActPlaceFieldInitiativeStatus;
  lead: string;
  lenses: ActPlaceFieldLens[];
  officialUrl: string;
  verifiedAt: string;
}

export interface ActPlaceFieldCommunity {
  id: string;
  name: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  population: number | null;
  need: number;
  assets: number;
  buyers: number;
  communityControlledOrganisations: number;
  dataQuality: number | null;
  sourceCount: number;
}

export interface ActPlaceFieldOrganisation {
  id: string;
  gsId: string;
  name: string;
  abn: string | null;
  entityType: string;
  sector: string | null;
  postcode: string | null;
  communityControlled: boolean;
  sourceCount: number;
}

export interface ActPlaceFieldRelationship {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  email: string | null;
  lastContactedAt: string | null;
  linkedEntityId: string | null;
  expertise: string[];
}

export interface ActPlaceFieldJusticeRecord {
  id: string;
  recipient: string;
  program: string;
  amount: number | null;
  location: string | null;
  announcementDate: string | null;
  source: string;
  sourceUrl: string | null;
}

export interface ActPlaceFieldContractRecord {
  id: string;
  title: string;
  supplier: string;
  buyer: string;
  value: number | null;
  publishedAt: string | null;
  sourceUrl: string | null;
}

export interface ActPlaceFieldEvidenceSource {
  id: string;
  title: string;
  kind: 'official_current' | 'historical_local' | 'live_civicgraph' | 'integration_gap';
  checkedAt: string | null;
  summary: string;
  url: string | null;
}

export interface ActPlaceFieldSummary {
  communityCount: number;
  organisationCount: number;
  communityControlledOrganisationCount: number;
  relationshipCount: number;
  recordedNeed: number;
  recordedAssets: number;
  justiceRecordCount: number;
  contractRecordCount: number;
  nextMove: {
    title: string;
    detail: string;
    whyNow: string;
  };
  evidenceGaps: string[];
}

export interface ActPlaceFieldData {
  generatedAt: string;
  officialProgressAt: string;
  communities: ActPlaceFieldCommunity[];
  organisations: ActPlaceFieldOrganisation[];
  relationships: ActPlaceFieldRelationship[];
  justiceRecords: ActPlaceFieldJusticeRecord[];
  contracts: ActPlaceFieldContractRecord[];
  initiatives: ActPlaceFieldInitiative[];
  evidenceSources: ActPlaceFieldEvidenceSource[];
  summary: ActPlaceFieldSummary;
  errors: string[];
}

export type BarklyInitiativeStatus = ActPlaceFieldInitiativeStatus;
export type BarklyInitiativeCategory = ActPlaceFieldInitiativeCategory;
export type BarklyLens = ActPlaceFieldLens;
export type BarklyInitiative = ActPlaceFieldInitiative;
export type BarklyCommunity = ActPlaceFieldCommunity;
export type BarklyOrganisation = ActPlaceFieldOrganisation;
export type BarklyRelationship = ActPlaceFieldRelationship;
export type BarklyJusticeRecord = ActPlaceFieldJusticeRecord;
export type BarklyContractRecord = ActPlaceFieldContractRecord;
export type BarklyEvidenceSource = ActPlaceFieldEvidenceSource;
export type BarklyFieldSummary = ActPlaceFieldSummary;
export type BarklyRegionalField = ActPlaceFieldData;

const OFFICIAL_INITIATIVES_URL = 'https://barklyregionaldeal.com.au/28-initiatives/';
const OFFICIAL_PROGRESS_URL = 'https://barklyregionaldeal.com.au/';
const BARKLY_OFFICIAL_PROGRESS_AT = '2026-05-01';
const PALM_ISLAND_OFFICIAL_URL = 'https://www.palmisland.qld.gov.au/';
const PALM_ISLAND_PROGRESS_AT = '2026-07-14';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_BY_NUMBER: Record<number, BarklyInitiativeStatus> = {
  1: 'ready_for_closure', 2: 'underway', 3: 'ready_for_closure', 4: 'complete',
  5: 'underway', 6: 'underway', 7: 'complete', 8: 'ready_for_closure',
  9: 'ongoing', 10: 'ongoing', 11: 'underway', 12: 'ongoing',
  13: 'underway', 14: 'underway', 15: 'underway', 16: 'underway',
  17: 'complete', 18: 'underway', 19: 'complete', 20: 'complete',
  21: 'complete', 22: 'complete', 23: 'ongoing', 24: 'ongoing',
  25: 'underway', 26: 'complete', 27: 'complete', 28: 'complete',
};

type InitiativeSeed = Omit<ActPlaceFieldInitiative, 'status' | 'officialUrl' | 'verifiedAt'>;

const INITIATIVE_SEEDS: InitiativeSeed[] = [
  { number: 1, title: 'Regional workforce strategy', summary: 'Align local training and capability with employment opportunities across the region.', category: 'economic_development', lead: 'Northern Territory Government', lenses: ['goods', 'relationships'] },
  { number: 2, title: 'Youth infrastructure', summary: 'Youth centres, active transport and recreation infrastructure in Tennant Creek and Ali Curung.', category: 'economic_development', lead: 'Australian Government and Barkly Regional Council', lenses: ['goods', 'justice', 'story'] },
  { number: 3, title: 'Barkly Business Hub', summary: 'Support local business creation, investment, mentoring and access to finance.', category: 'economic_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods', 'relationships'] },
  { number: 4, title: 'Youth Justice Facility', summary: 'Alternative-to-detention accommodation intended to keep young people closer to family and community.', category: 'economic_development', lead: 'Northern Territory Government', lenses: ['justice', 'story'] },
  { number: 5, title: 'New housing builds', summary: 'Government employee housing and the return of existing stock to public housing.', category: 'economic_development', lead: 'Northern Territory Government', lenses: ['goods'] },
  { number: 6, title: 'Justice infrastructure investments', summary: 'Watch-house upgrades, Elders at Court and remote videoconference facilities.', category: 'economic_development', lead: 'Northern Territory Government', lenses: ['justice', 'goods'] },
  { number: 7, title: 'Alpurrurulam aerodrome', summary: 'Improve year-round access, aeromedical evacuation and delivery of essential services and goods.', category: 'economic_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods'] },
  { number: 8, title: 'Economic growth strategy', summary: 'Build an investment pipeline and identify regional employment and supply-chain opportunities.', category: 'economic_development', lead: 'Australian Government', lenses: ['goods', 'relationships'] },
  { number: 9, title: 'Maximising Aboriginal employment', summary: 'Set Aboriginal employment and procurement targets across government and regional supply chains.', category: 'economic_development', lead: 'Australian, Northern Territory and Barkly Regional Council governments', lenses: ['goods', 'relationships'] },
  { number: 10, title: 'Barkly mining and energy services hub', summary: 'Help Barkly businesses participate in mining and energy development opportunities.', category: 'economic_development', lead: 'Northern Territory Government', lenses: ['goods', 'relationships'] },
  { number: 11, title: 'Weather radar', summary: 'Provide regional weather intelligence for safer travel, emergency response and industry.', category: 'economic_development', lead: 'Australian Government with Northern Territory Government funding', lenses: ['goods'] },
  { number: 12, title: 'Community Development Program delivery', summary: 'Align employment work programs with community priorities and local pathways.', category: 'economic_development', lead: 'Barkly Regional Council', lenses: ['relationships'] },
  { number: 13, title: 'Tennant Creek Visitor Park', summary: 'Co-design a safe, flexible accommodation option for regional and seasonal visitors.', category: 'social_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods', 'story', 'relationships'] },
  { number: 14, title: 'Government investment and service system reform', summary: 'Improve transparency, coordination, community involvement and accountability across funded services.', category: 'social_development', lead: 'Australian Government and Northern Territory Government', lenses: ['justice', 'story', 'relationships'] },
  { number: 15, title: 'Crisis youth support', summary: 'Co-design safe places and accommodation with Traditional Owners, language groups and community.', category: 'social_development', lead: 'Northern Territory Government', lenses: ['justice', 'goods', 'story', 'relationships'] },
  { number: 16, title: 'Trauma informed care', summary: 'Develop culturally appropriate, multidisciplinary support for children, young people and families.', category: 'social_development', lead: 'Northern Territory Government', lenses: ['justice', 'story', 'relationships'] },
  { number: 17, title: 'Multi-purpose accommodation facility', summary: 'Accommodation for people on low incomes, medical patients, visitors and people sleeping rough.', category: 'social_development', lead: 'Aboriginal Hostels Limited', lenses: ['goods', 'relationships'] },
  { number: 18, title: 'Student boarding accommodation', summary: 'A proposed 40-bed facility with wrap-around support for Tennant Creek and outlying communities.', category: 'social_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods', 'justice', 'story'] },
  { number: 19, title: 'Social and affordable housing partnership', summary: 'A public-private partnership for social, safe and affordable housing.', category: 'social_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods', 'relationships'] },
  { number: 20, title: 'Community sports', summary: 'Build participation, social competitions and community connection through sport.', category: 'social_development', lead: 'Australian Government', lenses: ['story', 'relationships'] },
  { number: 21, title: 'Aged care services', summary: 'Support culturally safe care close to home and community across the Barkly.', category: 'social_development', lead: 'Australian Government and Northern Territory Government', lenses: ['goods', 'relationships'] },
  { number: 22, title: 'Child care places', summary: 'Increase early learning and child-care participation in Tennant Creek and regional communities.', category: 'social_development', lead: 'Australian, Northern Territory and Barkly Regional Council governments', lenses: ['goods', 'justice', 'relationships'] },
  { number: 23, title: 'Barkly Local Community Projects Fund', summary: 'Fund locally determined projects and strengthen leadership outside Tennant Creek.', category: 'culture_and_place', lead: 'Australian, Northern Territory and Barkly Regional Council governments', lenses: ['goods', 'story', 'relationships'] },
  { number: 24, title: 'Local community governance', summary: 'Support the Governance Table and Backbone Team to guide regional priorities.', category: 'culture_and_place', lead: 'Australian Government and Northern Territory Government', lenses: ['story', 'relationships'] },
  { number: 25, title: 'Community mediation', summary: 'Co-design community-led mediation and peaceful conflict resolution across the region.', category: 'culture_and_place', lead: 'Australian Government and Northern Territory Government', lenses: ['justice', 'story', 'relationships'] },
  { number: 26, title: 'Arts Centre in Elliott', summary: 'Assess an arts centre as cultural and economic infrastructure in Elliott.', category: 'culture_and_place', lead: 'Northern Territory Government', lenses: ['goods', 'story'] },
  { number: 27, title: 'Aboriginal history on Council website', summary: 'Work with Traditional Owners and language groups to share authorised regional history.', category: 'culture_and_place', lead: 'Barkly Regional Council', lenses: ['story', 'relationships'] },
  { number: 28, title: 'Marketing and promotion', summary: 'Promote the region to support tourism, business growth and regional identity.', category: 'culture_and_place', lead: 'Barkly Regional Council', lenses: ['story'] },
];

export const BARKLY_INITIATIVES: BarklyInitiative[] = INITIATIVE_SEEDS.map((initiative) => ({
  ...initiative,
  status: STATUS_BY_NUMBER[initiative.number],
  officialUrl: OFFICIAL_INITIATIVES_URL,
  verifiedAt: BARKLY_OFFICIAL_PROGRESS_AT,
}));

const PALM_ISLAND_INITIATIVE_SEEDS: InitiativeSeed[] = [
  { number: 1, title: 'PICC relationship and authority path', summary: 'Confirm the current Palm Island relationship holder, decision pathway and community interpretation before shaping external asks.', category: 'culture_and_place', lead: 'ACT and Palm Island relationship holders', lenses: ['relationships', 'story'] },
  { number: 2, title: 'Goods delivery and local production', summary: 'Connect bed demand, assets deployed, freight, buyers and production options without treating delivery as consent or impact proof.', category: 'economic_development', lead: 'ACT Goods on Country and Palm Island partners', lenses: ['goods', 'relationships'] },
  { number: 3, title: 'Youth, families and justice evidence', summary: 'Keep public youth justice, family support, DFV and wellbeing funding visible while protecting individual-level context.', category: 'social_development', lead: 'Palm Island service providers and public funders', lenses: ['justice', 'relationships'] },
  { number: 4, title: 'Repository and story governance', summary: 'Use repository and Empathy Ledger links only where consent, audience, attribution and reuse limits can travel with the evidence.', category: 'culture_and_place', lead: 'Palm Island community custodians and ACT', lenses: ['story'] },
  { number: 5, title: 'Funding and procurement trail', summary: 'Separate philanthropy, procurement, grant, contract, receivable and partner evidence so the next ask is traceable.', category: 'economic_development', lead: 'ACT relationship and money systems', lenses: ['goods', 'justice', 'relationships'] },
];

export const PALM_ISLAND_INITIATIVES: ActPlaceFieldInitiative[] = PALM_ISLAND_INITIATIVE_SEEDS.map((initiative) => ({
  ...initiative,
  status: initiative.number <= 2 ? 'underway' : initiative.number === 5 ? 'ongoing' : 'ready_for_closure',
  officialUrl: PALM_ISLAND_OFFICIAL_URL,
  verifiedAt: PALM_ISLAND_PROGRESS_AT,
}));

const BARKLY_EVIDENCE_SOURCES: ActPlaceFieldEvidenceSource[] = [
  {
    id: 'brd-progress',
    title: 'Barkly Regional Deal progress and initiative status',
    kind: 'official_current',
    checkedAt: BARKLY_OFFICIAL_PROGRESS_AT,
    summary: 'Official source for the 28 initiatives and the May 2026 progress grouping used in this field.',
    url: OFFICIAL_PROGRESS_URL,
  },
  {
    id: 'brd-initiatives',
    title: 'The 28 Barkly Regional Deal initiatives',
    kind: 'official_current',
    checkedAt: '2026-07-14',
    summary: 'Official descriptions and lead responsibilities. Status still follows the May 2026 progress statement.',
    url: OFFICIAL_INITIATIVES_URL,
  },
  {
    id: 'umel-case-study',
    title: 'Barkly UMEL Youth Case Study — March 2025',
    kind: 'historical_local',
    checkedAt: '2026-07-14',
    summary: 'Local historical source describing youth-centred research, middle-space practice and priority themes. It is not current operational status.',
    url: null,
  },
  {
    id: 'youth-roundtable',
    title: 'Second Tennant Creek Youth Roundtable — April 2025',
    kind: 'historical_local',
    checkedAt: '2026-07-14',
    summary: 'Local historical source for participant priorities and service mapping. A voting-count discrepancy remains unresolved.',
    url: null,
  },
  {
    id: 'civicgraph-live',
    title: 'CivicGraph place, organisation, relationship, justice and procurement records',
    kind: 'live_civicgraph',
    checkedAt: null,
    summary: 'Loaded at request time. Adjacency and public funding are context; they do not prove authority, consent or impact.',
    url: null,
  },
  {
    id: 'empathy-ledger-gap',
    title: 'Empathy Ledger place-level consent feed',
    kind: 'integration_gap',
    checkedAt: null,
    summary: 'Entity-level story links exist, but region-, community- and initiative-level consent metadata is not yet available to CivicGraph.',
    url: null,
  },
];

const PALM_ISLAND_EVIDENCE_SOURCES: ActPlaceFieldEvidenceSource[] = [
  {
    id: 'palm-island-council',
    title: 'Palm Island Aboriginal Shire Council public site',
    kind: 'official_current',
    checkedAt: PALM_ISLAND_PROGRESS_AT,
    summary: 'Public local-government source for place context and official council pathways. It is not evidence of PICC or ACT authority.',
    url: PALM_ISLAND_OFFICIAL_URL,
  },
  {
    id: 'picc-public-records',
    title: 'Palm Island Community Company public and CivicGraph records',
    kind: 'live_civicgraph',
    checkedAt: null,
    summary: 'Loaded at request time from organisation, justice, Goods and procurement records. Public records are context, not consent.',
    url: null,
  },
  {
    id: 'goods-palm-island',
    title: 'Goods on Country Palm Island delivery evidence',
    kind: 'live_civicgraph',
    checkedAt: null,
    summary: 'Goods demand, assets, buyers and freight signals are loaded from CivicGraph and ACT operating records when available.',
    url: null,
  },
  {
    id: 'palm-island-repository-gap',
    title: 'Palm Island repository and Empathy Ledger consent metadata',
    kind: 'integration_gap',
    checkedAt: null,
    summary: 'Story and repository context should be linked only when purpose, audience, attribution and cultural review metadata are available.',
    url: null,
  },
];

type CommunityRow = {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  estimated_population: number | null;
  demand_beds: number | null;
  demand_washers: number | null;
  demand_fridges: number | null;
  demand_mattresses: number | null;
  assets_deployed: number | null;
  buyer_entity_count: number | null;
  community_controlled_org_count: number | null;
  data_quality_score: number | string | null;
  data_sources: string[] | null;
};

type EntityRow = {
  id: string;
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  sector: string | null;
  postcode: string | null;
  is_community_controlled: boolean | null;
  source_count: number | null;
};

type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  email: string | null;
  last_contacted_at: string | null;
  linked_entity_id: string | null;
  expertise: string[] | null;
};

type JusticeRow = {
  id: string;
  recipient_name: string;
  program_name: string;
  amount_dollars: number | string | null;
  location: string | null;
  announcement_date: string | null;
  source: string;
  source_url: string | null;
};

type ContractRow = {
  id: string;
  title: string | null;
  supplier_name: string | null;
  buyer_name: string | null;
  contract_value: number | string | null;
  date_published: string | null;
  source_url: string | null;
};

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function mapCommunity(row: CommunityRow): ActPlaceFieldCommunity {
  return {
    id: row.id,
    name: row.community_name,
    state: row.state,
    postcode: row.postcode,
    remoteness: row.remoteness,
    population: row.estimated_population,
    need: numberValue(row.demand_beds) + numberValue(row.demand_washers) + numberValue(row.demand_fridges) + numberValue(row.demand_mattresses),
    assets: numberValue(row.assets_deployed),
    buyers: numberValue(row.buyer_entity_count),
    communityControlledOrganisations: numberValue(row.community_controlled_org_count),
    dataQuality: row.data_quality_score == null ? null : numberValue(row.data_quality_score),
    sourceCount: row.data_sources?.length ?? 0,
  };
}

export function dedupeActPlaceFieldOrganisations(rows: EntityRow[]): ActPlaceFieldOrganisation[] {
  const byName = new Map<string, EntityRow>();
  for (const row of rows) {
    const key = row.canonical_name.toLocaleLowerCase('en-AU').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const current = byName.get(key);
    const rowScore = (row.gs_id.startsWith('AU-ABN-') ? 100 : 0) + numberValue(row.source_count);
    const currentScore = current ? (current.gs_id.startsWith('AU-ABN-') ? 100 : 0) + numberValue(current.source_count) : -1;
    if (!current || rowScore > currentScore) byName.set(key, row);
  }

  return [...byName.values()]
    .map((row) => ({
      id: row.id,
      gsId: row.gs_id,
      name: row.canonical_name.replaceAll('&amp;', '&'),
      abn: row.abn,
      entityType: row.entity_type,
      sector: row.sector,
      postcode: row.postcode,
      communityControlled: Boolean(row.is_community_controlled),
      sourceCount: numberValue(row.source_count),
    }))
    .sort((left, right) => Number(right.communityControlled) - Number(left.communityControlled) || right.sourceCount - left.sourceCount || left.name.localeCompare(right.name));
}

export function deriveActPlaceFieldSummary(place: ActPlaceFieldDefinition, input: {
  communities: ActPlaceFieldCommunity[];
  organisations: ActPlaceFieldOrganisation[];
  relationships: ActPlaceFieldRelationship[];
  justiceRecords: ActPlaceFieldJusticeRecord[];
  contracts: ActPlaceFieldContractRecord[];
}): ActPlaceFieldSummary {
  const recordedAssets = input.communities.reduce((sum, community) => sum + community.assets, 0);
  const recordedNeed = input.communities.reduce((sum, community) => sum + community.need, 0);
  const communityControlledOrganisationCount = input.organisations.filter((organisation) => organisation.communityControlled).length;
  const evidenceGaps = [
    `${place.name} authority, consent and decision rights are not recorded in CivicGraph`,
    input.relationships.length === 0 ? `no ACT relationship is linked to an indexed ${place.name} organisation` : null,
    'current service operating hours, reach and cultural accessibility have not been verified',
    `${place.officialProgressLabel} status needs community interpretation before it becomes an ACT recommendation`,
    'Empathy Ledger does not yet expose place- and initiative-level consent metadata to CivicGraph',
    `the indexed Goods communities are a starting set, not a complete representation of ${place.name} communities, families or homelands`,
  ].filter((gap): gap is string => Boolean(gap));

  return {
    communityCount: input.communities.length,
    organisationCount: input.organisations.length,
    communityControlledOrganisationCount,
    relationshipCount: input.relationships.length,
    recordedNeed,
    recordedAssets,
    justiceRecordCount: input.justiceRecords.length,
    contractRecordCount: input.contracts.length,
    nextMove: input.relationships.length > 0
      ? {
          title: `Review the field through an existing ${place.name} relationship`,
          detail: 'Take the official initiative status, ACT history and live CivicGraph evidence to a named local relationship holder. Ask what is accurate, useful and authorised before shaping an offer.',
          whyNow: `${place.name} already has place, organisation, justice, procurement and Goods signals that need local interpretation before ACT acts.`,
        }
      : {
          title: `Confirm a ${place.name} authority and relationship path`,
          detail: 'Identify who can interpret this regional evidence, which community decisions apply, and what ACT is authorised to do before proposing work.',
          whyNow: 'The evidence field is substantial, but no indexed ACT relationship currently provides a safe path from regional intelligence to action.',
        },
    evidenceGaps,
  };
}

export function dedupeBarklyOrganisations(rows: EntityRow[]): BarklyOrganisation[] {
  return dedupeActPlaceFieldOrganisations(rows);
}

export function deriveBarklyFieldSummary(input: {
  communities: BarklyCommunity[];
  organisations: BarklyOrganisation[];
  relationships: BarklyRelationship[];
  justiceRecords: BarklyJusticeRecord[];
  contracts: BarklyContractRecord[];
}): BarklyFieldSummary {
  const barklyPlace: ActPlaceFieldDefinition = {
    slug: 'barkly',
    name: 'Barkly',
    kind: 'region',
    state: 'NT',
    subtitle: '',
    description: '',
    loader: 'civicgraph-place-field',
    memberCommunities: [],
    lenses: [],
    tags: [],
    evidenceLabel: '',
    evidenceUrl: OFFICIAL_PROGRESS_URL,
    evidenceCheckedAt: BARKLY_OFFICIAL_PROGRESS_AT,
    initiativeCount: 28,
    initiativeRegisterLabel: 'Barkly Regional Deal',
    officialProgressLabel: 'May 2026',
    outcomesSourceNote: '',
    outcomes: [],
    supportPaths: [],
    queryTerms: ['Barkly', 'Tennant Creek'],
    primaryCommunityName: 'Tennant Creek',
  };
  return deriveActPlaceFieldSummary(barklyPlace, input);
}

function orIlike(columns: string[], terms: string[]): string {
  return terms.flatMap((term) => columns.map((column) => `${column}.ilike.%${term.replaceAll(',', ' ')}%`)).join(',');
}

function placeInitiatives(place: ActPlaceFieldDefinition): ActPlaceFieldInitiative[] {
  return place.slug === 'palm-island' ? PALM_ISLAND_INITIATIVES : BARKLY_INITIATIVES;
}

function placeEvidenceSources(place: ActPlaceFieldDefinition): ActPlaceFieldEvidenceSource[] {
  return place.slug === 'palm-island' ? PALM_ISLAND_EVIDENCE_SOURCES : BARKLY_EVIDENCE_SOURCES;
}

export async function loadActPlaceField(place: ActPlaceFieldDefinition, orgProfileId: string): Promise<ActPlaceFieldData> {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const terms = place.queryTerms.length > 0 ? place.queryTerms : [place.name];

  try {
    const db = getServiceSupabase();
    const [communitiesResult, entitiesResult, justiceResult] = await Promise.all([
      db
        .from('goods_communities')
        .select('id, community_name, state, postcode, remoteness, estimated_population, demand_beds, demand_washers, demand_fridges, demand_mattresses, assets_deployed, buyer_entity_count, community_controlled_org_count, data_quality_score, data_sources')
        .eq('state', place.state)
        .or(orIlike(['region_label', 'service_region', 'community_name'], terms))
        .order('community_name'),
      db
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn, entity_type, sector, postcode, is_community_controlled, source_count')
        .eq('state', place.state)
        .or(orIlike(['lga_name', 'canonical_name'], terms))
        .limit(500),
      db
        .from('justice_funding')
        .select('id, recipient_name, program_name, amount_dollars, location, announcement_date, source, source_url')
        .eq('state', place.state)
        .or(orIlike(['location', 'recipient_name', 'program_name', 'project_description'], terms))
        .order('announcement_date', { ascending: false, nullsFirst: false })
        .limit(24),
    ]);

    if (communitiesResult.error) errors.push(`Communities: ${communitiesResult.error.message}`);
    if (entitiesResult.error) errors.push(`Organisations: ${entitiesResult.error.message}`);
    if (justiceResult.error) errors.push(`Justice evidence: ${justiceResult.error.message}`);

    const communities = ((communitiesResult.data ?? []) as CommunityRow[]).map(mapCommunity);
    const entityRows = (entitiesResult.data ?? []) as EntityRow[];
    const organisations = dedupeActPlaceFieldOrganisations(entityRows);
    const entityIds = entityRows.map((entity) => entity.id);
    const supplierAbns = [...new Set(organisations.map((organisation) => organisation.abn).filter((abn): abn is string => Boolean(abn)))];

    const [contactsResult, contractsResult] = await Promise.all([
      entityIds.length > 0 && UUID_RE.test(orgProfileId)
        ? db
            .from('org_contacts')
            .select('id, name, role, organisation, email, last_contacted_at, linked_entity_id, expertise')
            .eq('org_profile_id', orgProfileId)
            .in('linked_entity_id', entityIds.slice(0, 180))
            .order('last_contacted_at', { ascending: false, nullsFirst: false })
            .limit(30)
        : Promise.resolve({ data: [], error: null }),
      supplierAbns.length > 0
        ? db
            .from('austender_contracts')
            .select('id, title, supplier_name, buyer_name, contract_value, date_published, source_url')
            .in('supplier_abn', supplierAbns.slice(0, 120))
            .order('date_published', { ascending: false, nullsFirst: false })
            .limit(24)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (contactsResult.error) errors.push(`ACT relationships: ${contactsResult.error.message}`);
    if (contractsResult.error) errors.push(`Procurement: ${contractsResult.error.message}`);

    const relationships = ((contactsResult.data ?? []) as ContactRow[]).map((row): ActPlaceFieldRelationship => ({
      id: row.id,
      name: row.name,
      role: row.role,
      organisation: row.organisation,
      email: row.email,
      lastContactedAt: row.last_contacted_at,
      linkedEntityId: row.linked_entity_id,
      expertise: row.expertise ?? [],
    }));
    const justiceRecords = ((justiceResult.data ?? []) as JusticeRow[]).map((row): ActPlaceFieldJusticeRecord => ({
      id: row.id,
      recipient: row.recipient_name,
      program: row.program_name,
      amount: row.amount_dollars == null ? null : numberValue(row.amount_dollars),
      location: row.location,
      announcementDate: row.announcement_date,
      source: row.source,
      sourceUrl: row.source_url,
    }));
    const contracts = ((contractsResult.data ?? []) as ContractRow[]).map((row): ActPlaceFieldContractRecord => ({
      id: row.id,
      title: row.title || 'Untitled contract',
      supplier: row.supplier_name || 'Supplier not recorded',
      buyer: row.buyer_name || 'Buyer not recorded',
      value: row.contract_value == null ? null : numberValue(row.contract_value),
      publishedAt: row.date_published,
      sourceUrl: row.source_url,
    }));
    const summary = deriveActPlaceFieldSummary(place, { communities, organisations, relationships, justiceRecords, contracts });

    return {
      generatedAt,
      officialProgressAt: place.evidenceCheckedAt,
      communities,
      organisations,
      relationships,
      justiceRecords,
      contracts,
      initiatives: placeInitiatives(place),
      evidenceSources: placeEvidenceSources(place),
      summary,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unknown ${place.name} field loading error`;
    errors.push(message);
    const fallback = { communities: [], organisations: [], relationships: [], justiceRecords: [], contracts: [] };
    return {
      generatedAt,
      officialProgressAt: place.evidenceCheckedAt,
      ...fallback,
      initiatives: placeInitiatives(place),
      evidenceSources: placeEvidenceSources(place),
      summary: deriveActPlaceFieldSummary(place, fallback),
      errors,
    };
  }
}

export async function loadBarklyRegionalField(orgProfileId: string): Promise<BarklyRegionalField> {
  const barklyPlace: ActPlaceFieldDefinition = {
    slug: 'barkly',
    name: 'Barkly',
    kind: 'region',
    state: 'NT',
    subtitle: '',
    description: '',
    loader: 'civicgraph-place-field',
    memberCommunities: [],
    lenses: [],
    tags: [],
    evidenceLabel: '',
    evidenceUrl: OFFICIAL_PROGRESS_URL,
    evidenceCheckedAt: BARKLY_OFFICIAL_PROGRESS_AT,
    initiativeCount: 28,
    initiativeRegisterLabel: 'Barkly Regional Deal',
    officialProgressLabel: 'May 2026',
    outcomesSourceNote: '',
    outcomes: [],
    supportPaths: [],
    queryTerms: ['Barkly', 'Tennant Creek'],
    primaryCommunityName: 'Tennant Creek',
  };
  return loadActPlaceField(barklyPlace, orgProfileId);
}
