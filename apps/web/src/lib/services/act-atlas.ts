import { getServiceSupabase } from '@/lib/supabase';
import * as EntityService from '@/lib/services/entity-service';
import * as FoundationService from '@/lib/services/foundation-service';
import * as GrantService from '@/lib/services/grant-service';
import { enrichActAtlasRecords } from '@/lib/services/act-atlas-context';
import { actPlaceFieldHref, searchActPlaceFields, type ActPlaceFieldDefinition } from '@/lib/services/act-place-fields';

export type ActAtlasRecordType = 'place' | 'community' | 'person' | 'organisation' | 'funder' | 'project' | 'opportunity';

export interface ActAtlasFact {
  label: string;
  value: string;
}

export type ActAtlasConnectionKind = 'activity' | 'place' | 'community' | 'person' | 'organisation' | 'funder' | 'opportunity' | 'project' | 'evidence';

export interface ActAtlasConnection {
  id: string;
  kind: ActAtlasConnectionKind;
  name: string;
  detail: string;
  meta: string | null;
  href: string | null;
  sourceLabel: string;
}

export interface ActAtlasConnectionSection {
  id: string;
  title: string;
  count: number;
  items: ActAtlasConnection[];
}

export interface ActAtlasContext {
  relationshipState: string | null;
  lastContactAt: string | null;
  nextMove: {
    title: string;
    detail: string;
    href: string;
  } | null;
  sections: ActAtlasConnectionSection[];
  unknowns: string[];
}

export interface ActAtlasRecord {
  id: string;
  entityId?: string | null;
  pipelineItemId?: string | null;
  type: ActAtlasRecordType;
  name: string;
  subtitle: string;
  description: string | null;
  href: string;
  state: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  facts: ActAtlasFact[];
  sourceLabel: string;
  context?: ActAtlasContext;
}

export interface ActAtlasSearchResult {
  generatedAt: string;
  query: string;
  records: ActAtlasRecord[];
  counts: Record<ActAtlasRecordType, number>;
}

interface CommunityRow extends Record<string, unknown> {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  region_label: string | null;
  service_region: string | null;
  land_council: string | null;
  remoteness: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  estimated_population: number | null;
  priority: string | null;
  demand_beds: number | null;
  demand_washers: number | null;
  assets_deployed: number | null;
  buyer_entity_count: number | null;
  community_controlled_org_count: number | null;
  total_govt_contract_value: number | string | null;
  total_justice_funding: number | string | null;
  total_foundation_grants: number | string | null;
  proof_line: string | null;
  story: string | null;
  data_sources: string[] | null;
}

interface ProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  tier: string;
  category: string | null;
  status: string;
}

interface PipelineOpportunityRow extends Record<string, unknown> {
  id: string;
  name: string;
  amount_display: string | null;
  amount_numeric: number | string | null;
  funder: string | null;
  deadline: string | null;
  status: string;
  grant_opportunity_id: string | null;
  notes: string | null;
  opportunity_type: string | null;
  project_code: string | null;
}

const ALL_TYPES: ActAtlasRecordType[] = ['place', 'community', 'person', 'organisation', 'funder', 'project', 'opportunity'];
const FUNDER_TYPES = new Set([
  'corporate_foundation',
  'trust',
  'grantmaker',
  'private_ancillary_fund',
  'public_ancillary_fund',
  'philanthropic_foundation',
  'community_foundation',
  'trustee',
  'giving_circle',
]);

export function isAtlasFunderType(value: string | null | undefined): boolean {
  return FUNDER_TYPES.has(value ?? '');
}

function cleanSearchQuery(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactMoney(value: unknown): string {
  const amount = numberValue(value);
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

function countLabel(value: unknown, singular: string, plural = `${singular}s`): string {
  const count = numberValue(value);
  return `${count.toLocaleString('en-AU')} ${count === 1 ? singular : plural}`;
}

function emptyCounts(): Record<ActAtlasRecordType, number> {
  return { place: 0, community: 0, person: 0, organisation: 0, funder: 0, project: 0, opportunity: 0 };
}

function mapPlaceField(field: ActPlaceFieldDefinition, slug: string): ActAtlasRecord {
  const href = actPlaceFieldHref(slug, field.slug);
  return {
    id: `place:${field.slug}`,
    type: 'place',
    name: field.name,
    subtitle: field.subtitle,
    description: field.description,
    href,
    state: field.state,
    postcode: null,
    latitude: null,
    longitude: null,
    tags: [field.kind, ...field.tags, ...field.lenses],
    facts: [
      { label: 'Scope', value: field.kind === 'region' ? 'Regional' : field.kind },
      { label: 'Communities', value: field.memberCommunities.length.toLocaleString('en-AU') },
      { label: 'Initiatives', value: field.initiativeCount.toLocaleString('en-AU') },
    ],
    sourceLabel: field.evidenceLabel,
    context: {
      relationshipState: 'authority path not recorded',
      lastContactAt: null,
      nextMove: {
        title: `Open the ${field.name} place field`,
        detail: 'Review communities, people, organisations, ACT work, money, evidence and consent together before deciding the next move.',
        href,
      },
      sections: [
        {
          id: 'communities',
          title: 'Communities',
          count: field.memberCommunities.length,
          items: field.memberCommunities.slice(0, 8).map((community) => ({
            id: community.toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, '-'),
            kind: 'community' as const,
            name: community,
            detail: `Investigate ${community} as a community within the wider ${field.name} field.`,
            meta: field.state,
            href: `/org/${slug}/explore?type=community&q=${encodeURIComponent(community)}`,
            sourceLabel: 'ACT place-field registry',
          })),
        },
        {
          id: 'lenses',
          title: 'ACT lenses',
          count: field.lenses.length,
          items: field.lenses.map((lens) => ({
            id: lens.toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, '-'),
            kind: 'project' as const,
            name: lens,
            detail: `${lens} evidence is interpreted as one lens over the same place, people and relationships.`,
            meta: null,
            href,
            sourceLabel: 'ACT place-field configuration',
          })),
        },
        {
          id: 'evidence',
          title: 'Evidence',
          count: 1,
          items: [{
            id: `${field.slug}-evidence`,
            kind: 'evidence' as const,
            name: field.evidenceLabel,
            detail: `Official progress checked ${field.evidenceCheckedAt}; live CivicGraph records load when the place field opens.`,
            meta: 'Authority and consent remain separate evidence questions.',
            href: field.evidenceUrl,
            sourceLabel: 'Official source',
          }],
        },
      ],
      unknowns: [
        'A community-controlled organisation is not automatically authorised to speak for a place.',
        'The ACT relationship owner and regional authority path still need confirmation.',
      ],
    },
  };
}

function comparableName(value: string): string {
  return value
    .toLocaleLowerCase('en-AU')
    .replace(/^the trustee for (the )?/, '')
    .replace(/^the /, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanisePipelineValue(value: string | null | undefined): string {
  return String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').trim();
}

export function countActAtlasRecords(records: ActAtlasRecord[]): Record<ActAtlasRecordType, number> {
  return records.reduce((counts, record) => {
    counts[record.type] += 1;
    return counts;
  }, emptyCounts());
}

function mapCommunity(row: CommunityRow, slug: string): ActAtlasRecord {
  const demand = numberValue(row.demand_beds) + numberValue(row.demand_washers);
  return {
    id: row.id,
    type: 'community',
    name: row.community_name,
    subtitle: [row.region_label || row.service_region, row.state, row.postcode].filter(Boolean).join(' · '),
    description: row.story || row.proof_line,
    href: `/org/${slug}/goods/community/${row.id}`,
    state: row.state,
    postcode: row.postcode,
    latitude: row.latitude === null ? null : numberValue(row.latitude),
    longitude: row.longitude === null ? null : numberValue(row.longitude),
    tags: [row.priority, row.remoteness, row.land_council].filter((value): value is string => Boolean(value)),
    facts: [
      { label: 'Goods need', value: countLabel(demand, 'item') },
      { label: 'Assets deployed', value: numberValue(row.assets_deployed).toLocaleString('en-AU') },
      { label: 'Mapped buyers', value: numberValue(row.buyer_entity_count).toLocaleString('en-AU') },
      { label: 'Community-controlled orgs', value: numberValue(row.community_controlled_org_count).toLocaleString('en-AU') },
      { label: 'Population', value: row.estimated_population?.toLocaleString('en-AU') || 'Unknown' },
      { label: 'Evidence sources', value: String(row.data_sources?.length ?? 0) },
    ],
    sourceLabel: `${row.data_sources?.length ?? 0} community sources`,
  };
}

function atlasFixtures(slug: string, query: string): ActAtlasSearchResult {
  const fixtureRecords: ActAtlasRecord[] = [
    {
      id: 'e2e-wadeye', type: 'community', name: 'Wadeye', subtitle: 'West Daly · NT · 0822',
      description: 'A remote community with recorded Goods demand, local organisations, procurement buyers, and ACT delivery context.',
      href: `/org/${slug}/goods/community/e2e-wadeye`, state: 'NT', postcode: '0822', latitude: -14.238, longitude: 129.522,
      tags: ['lead', 'Very Remote Australia', 'West Daly Regional Council'], sourceLabel: '6 community sources',
      facts: [
        { label: 'Goods need', value: '918 items' }, { label: 'Assets deployed', value: '24' },
        { label: 'Mapped buyers', value: '7' }, { label: 'Community-controlled orgs', value: '5' },
        { label: 'Population', value: '2,280' }, { label: 'Evidence sources', value: '6' },
      ],
      context: {
        relationshipState: 'lead', lastContactAt: '2026-06-18T00:00:00Z',
        nextMove: { title: 'Confirm the next delivery conversation', detail: 'Start with the two mapped buyers and recorded Goods need.', href: `/org/${slug}/goods/community/e2e-wadeye` },
        sections: [
          { id: 'buyers', title: 'Buyers and delivery partners', count: 2, items: [
            { id: 'e2e-buyer', kind: 'organisation', name: 'West Daly Regional Council', detail: 'Regional buyer · warm relationship', meta: 'Next: confirm the current procurement cycle', href: '/entities/e2e-west-daly', sourceLabel: 'Goods procurement map' },
          ] },
          { id: 'local', title: 'Community organisations', count: 1, items: [
            { id: 'e2e-local', kind: 'organisation', name: 'Thamarrurr Development Corporation', detail: 'Community-controlled organisation · 0822', meta: null, href: '/entities/e2e-thamarrurr', sourceLabel: 'CivicGraph entity index' },
          ] },
        ],
        unknowns: ['No deployed asset records are linked to this community record yet.'],
      },
    },
    {
      id: 'e2e-snow', type: 'funder', name: 'Snow Foundation', subtitle: 'Family foundation · ABN 13003263930',
      description: 'Community-led responses and long-term systems change.', href: '/foundations/e2e-snow', state: 'ACT', postcode: null,
      latitude: null, longitude: null, tags: ['First Nations', 'community development'], sourceLabel: 'CivicGraph foundation profile',
      facts: [{ label: 'Annual giving', value: '$10.0M' }, { label: 'Focus areas', value: '3' }, { label: 'Geographies', value: '2' }],
      context: {
        relationshipState: 'warm', lastContactAt: '2026-04-13T11:48:58Z',
        nextMove: { title: 'Follow up the Goods on Country conversation', detail: 'Use the existing contact and paid-work history before making another ask.', href: `/org/${slug}?view=relationships#relationships` },
        sections: [
          { id: 'history', title: 'ACT history', count: 2, items: [
            { id: 'e2e-email', kind: 'activity', name: '5 email messages', detail: 'Latest contact recorded 13 Apr 2026.', meta: 'Gmail and HighLevel context', href: null, sourceLabel: 'Funder context snapshot' },
          ] },
          { id: 'people', title: 'People', count: 1, items: [
            { id: 'e2e-alex', kind: 'person', name: 'Alex Snow', detail: 'Known ACT contact', meta: 'Last contact 13 Apr 2026', href: null, sourceLabel: 'ACT contact history' },
          ] },
        ],
        unknowns: [],
      },
    },
    {
      id: 'e2e-project-goods', type: 'project', name: 'Goods on Country', subtitle: 'ACT-GD · Active project',
      description: 'Essential goods, circular materials, procurement, community delivery, and capital.', href: `/org/${slug}/goods`,
      state: null, postcode: null, latitude: null, longitude: null, tags: ['major', 'goods'], sourceLabel: 'ACT project',
      facts: [{ label: 'Status', value: 'Active' }, { label: 'Project code', value: 'ACT-GD' }],
      context: {
        relationshipState: 'active', lastContactAt: '2026-07-10T09:00:00Z',
        nextMove: { title: 'Record the outcome and follow-up for REAL Innovation Fund EOI', detail: '$1,200,000 is marked submitted but has no owner or next action.', href: `/org/${slug}?view=opportunities#opportunities` },
        sections: [
          { id: 'pipeline', title: 'Pipeline', count: 2, items: [
            { id: 'e2e-goods-real', kind: 'opportunity', name: 'REAL Innovation Fund EOI', detail: 'Submitted · DEWR · $1,200,000', meta: 'No owner', href: '/grants/e2e-real-grant', sourceLabel: 'ACT opportunity pipeline' },
            { id: 'e2e-goods-circular', kind: 'opportunity', name: 'Regional Circular Economy Partnership', detail: 'Prospect · Snow Foundation · $1,000,000', meta: 'No owner', href: '/grants/e2e-circular-grant', sourceLabel: 'ACT opportunity pipeline' },
          ] },
          { id: 'funders', title: 'Funders', count: 1, items: [
            { id: 'e2e-goods-snow', kind: 'funder', name: 'Snow Foundation', detail: 'Warm · relationship · 92% fit', meta: 'Ask Alex for an evidence conversation', href: '/foundations/e2e-snow', sourceLabel: 'ACT project funder portfolio' },
          ] },
          { id: 'people', title: 'People', count: 1, items: [
            { id: 'e2e-goods-alex', kind: 'person', name: 'Alex Snow', detail: 'Philanthropy partner · Snow Foundation', meta: 'Last contact 8 July 2026', href: `/org/${slug}?view=relationships#relationships`, sourceLabel: 'ACT project contacts' },
          ] },
          { id: 'money', title: 'Money', count: 1, items: [
            { id: 'e2e-goods-money', kind: 'activity', name: '$55,884 income · $310,954 costs', detail: '$141,500 receivable · $2,483,561 weighted pipeline', meta: '$22,220,455 raw pipeline', href: `/org/${slug}?view=money#money`, sourceLabel: 'ACT project money state' },
          ] },
          { id: 'communities', title: 'Communities', count: 1, items: [
            { id: 'e2e-goods-wadeye', kind: 'organisation', name: 'Wadeye', detail: 'NT · lead · 918 recorded goods needed', meta: '24 assets deployed · 7 mapped buyers', href: `/org/${slug}/goods/community/e2e-wadeye`, sourceLabel: 'Goods community evidence' },
          ] },
        ],
        unknowns: ['At least one live opportunity has no owner.', 'At least one live opportunity has no next action.'],
      },
    },
    {
      id: 'e2e-real-grant', type: 'opportunity', name: 'REAL Innovation Fund EOI', subtitle: 'Grant · DEWR',
      description: 'Large-scale employment and community enterprise innovation funding aligned to Goods on Country.', href: '/grants/e2e-real-grant',
      state: null, postcode: null, latitude: null, longitude: null, tags: ['grant', 'employment'], sourceLabel: 'Grant opportunity index (deduplicated view)',
      facts: [{ label: 'Amount', value: 'Up to $1.2M' }, { label: 'Closes', value: '2 Mar 2026' }],
      context: {
        relationshipState: 'submitted', lastContactAt: '2026-07-10T09:00:00Z',
        nextMove: { title: 'Record the outcome for REAL Innovation Fund EOI', detail: 'ACT-GD is submitted, but the result and next relationship step are not recorded.', href: `/org/${slug}?view=opportunities#opportunities` },
        sections: [
          { id: 'act-pipeline', title: 'ACT pipeline', count: 1, items: [
            { id: 'e2e-real-pipeline', kind: 'project', name: 'ACT-GD', detail: 'Submitted · DEWR · $1,200,000', meta: 'No owner · Deadline 2 Mar 2026', href: `/org/${slug}?view=opportunities#opportunities`, sourceLabel: 'ACT opportunity pipeline' },
          ] },
          { id: 'project-fit', title: 'Project fit', count: 1, items: [
            { id: 'e2e-real-fit', kind: 'project', name: 'ACT-GD', detail: 'Linked to the ACT pipeline', meta: 'Community enterprise and regional delivery fit', href: `/org/${slug}/explore?q=ACT-GD&type=project`, sourceLabel: 'ACT project alignment' },
          ] },
          { id: 'decisions', title: 'Decision history', count: 1, items: [
            { id: 'e2e-real-decision', kind: 'activity', name: 'ACT-GD · apply', detail: 'Proceed through a Goods on Country partnership EOI.', meta: 'Evidence gap: named outcome owner', href: `/org/${slug}?view=opportunities#opportunities`, sourceLabel: 'ACT opportunity decision' },
          ] },
          { id: 'requirements', title: 'Requirements', count: 2, items: [
            { id: 'e2e-real-requirements', kind: 'activity', name: 'Application requirements', detail: 'Evidence of employment outcomes, delivery partnerships and scalable community benefit.', meta: null, href: '/grants/e2e-real-grant', sourceLabel: 'Grant opportunity evidence' },
            { id: 'e2e-real-eligibility', kind: 'activity', name: 'Eligibility', detail: 'Australian delivery entity with eligible project partners.', meta: 'Pty Ltd accepted', href: '/grants/e2e-real-grant', sourceLabel: 'Grant opportunity eligibility' },
          ] },
        ],
        unknowns: ['The active pipeline item has no owner.', 'The active pipeline item has no next action.'],
      },
    },
    {
      id: 'e2e-georgina', entityId: 'e2e-georgina-entity', type: 'person', name: 'Georgina Byron', subtitle: 'Person · ACT',
      description: null, href: '/entities/e2e-georgina', state: 'ACT', postcode: null, latitude: null, longitude: null,
      tags: ['person', 'ACT'], facts: [{ label: 'Source systems', value: '4' }, { label: 'Latest revenue', value: 'Unknown' }], sourceLabel: 'CivicGraph entity index',
      context: {
        relationshipState: 'warm', lastContactAt: '2026-06-26T01:31:07Z',
        nextMove: { title: 'Reconnect around the Snow Foundation strategy', detail: 'Start from the existing email history and board context.', href: `/org/${slug}?view=relationships#relationships` },
        sections: [
          { id: 'history', title: 'ACT history', count: 1, items: [{ id: 'e2e-georgina-email', kind: 'activity', name: 'Snow Foundation News', detail: 'Email context linked to Georgina Byron.', meta: '26 June 2026', href: `/org/${slug}?view=relationships#relationships`, sourceLabel: 'Gmail context' }] },
          { id: 'organisations', title: 'Connected organisations', count: 2, items: [
            { id: 'e2e-georgina-snow', kind: 'funder', name: 'Snow Foundation', detail: 'Directorship', meta: null, href: '/foundations/e2e-snow', sourceLabel: 'CivicGraph directorship evidence' },
            { id: 'e2e-georgina-pa', kind: 'organisation', name: 'Philanthropy Australia', detail: 'Member of', meta: null, href: '/entities/e2e-pa', sourceLabel: 'CivicGraph person roles' },
          ] },
        ], unknowns: [],
      },
    },
    {
      id: 'e2e-regional-arts', entityId: 'e2e-regional-arts-entity', type: 'organisation', name: 'Regional Arts Australia', subtitle: 'Charity · ACT · ABN 45000525182',
      description: null, href: '/entities/e2e-regional-arts', state: 'ACT', postcode: null, latitude: null, longitude: null,
      tags: ['charity', 'ACT'], facts: [{ label: 'Source systems', value: '6' }, { label: 'Latest revenue', value: '$3.2M' }], sourceLabel: 'CivicGraph entity index',
      context: {
        relationshipState: 'active', lastContactAt: '2026-07-08T00:00:00Z',
        nextMove: { title: 'Confirm the Artlands invitation and next paid scope', detail: 'Use the invoice, email and exchange history already linked to this organisation.', href: `/org/${slug}?view=relationships#relationships` },
        sections: [
          { id: 'history', title: 'ACT history', count: 2, items: [
            { id: 'e2e-raa-invoice', kind: 'activity', name: 'INV-0337 · paid', detail: '$16,500 invoiced and paid · ACT-HV', meta: '8 July 2026', href: `/org/${slug}?view=money#money`, sourceLabel: 'Xero invoice' },
            { id: 'e2e-raa-email', kind: 'activity', name: 'Artlands 2026 Witta meeting invitation', detail: 'Invitation and conversation context.', meta: '8 July 2026', href: `/org/${slug}?view=relationships#relationships`, sourceLabel: 'Gmail context' },
          ] },
          { id: 'people', title: 'People', count: 1, items: [{ id: 'e2e-skye', kind: 'person', name: 'Skye Parker', detail: 'Known ACT contact', meta: 'Last contact 8 July 2026', href: `/org/${slug}?view=relationships#relationships`, sourceLabel: 'ACT contacts' }] },
        ], unknowns: [],
      },
    },
  ];
  const records = fixtureRecords.filter((record) => !query || `${record.name} ${record.subtitle} ${record.description ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return { generatedAt: new Date().toISOString(), query, records, counts: countActAtlasRecords(records) };
}

export async function searchActAtlas({
  orgProfileId,
  slug,
  query = '',
  type,
  state,
  limit = 12,
}: {
  orgProfileId: string;
  slug: string;
  query?: string;
  type?: ActAtlasRecordType;
  state?: string;
  limit?: number;
}): Promise<ActAtlasSearchResult> {
  const cleanQuery = cleanSearchQuery(query);
  if (process.env.ACT_E2E_FIXTURES === '1') return atlasFixtures(slug, cleanQuery);

  const db = getServiceSupabase();
  const wanted = new Set(type ? [type] : ALL_TYPES);
  const cap = Math.min(Math.max(limit, 1), 20);
  const placeFields = wanted.has('place') ? searchActPlaceFields(cleanQuery, state) : [];

  const communitiesPromise = wanted.has('community')
    ? (() => {
        let request = db.from('goods_communities').select('id, community_name, state, postcode, region_label, service_region, land_council, remoteness, latitude, longitude, estimated_population, priority, demand_beds, demand_washers, assets_deployed, buyer_entity_count, community_controlled_org_count, total_govt_contract_value, total_justice_funding, total_foundation_grants, proof_line, story, data_sources');
        if (cleanQuery) {
          const postcodeFilter = /^\d{4}$/.test(cleanQuery) ? `,postcode.eq.${cleanQuery}` : '';
          request = request.or(`community_name.ilike.%${cleanQuery}%,region_label.ilike.%${cleanQuery}%,service_region.ilike.%${cleanQuery}%${postcodeFilter}`);
        }
        else request = request.in('priority', ['lead', 'active', 'warm']);
        if (state) request = request.eq('state', state);
        return request.order('assets_deployed', { ascending: false, nullsFirst: false }).limit(cap);
      })()
    : Promise.resolve({ data: [], error: null });

  const entitiesPromise = (wanted.has('person') || wanted.has('organisation')) && cleanQuery
    ? EntityService.search(db, cleanQuery, cap * 2)
    : Promise.resolve({ data: [], error: null });
  const foundationsPromise = wanted.has('funder') && cleanQuery && !state
    ? FoundationService.search(db, cleanQuery, cap)
    : Promise.resolve({ data: [], error: null });
  const opportunitiesPromise = wanted.has('opportunity') && cleanQuery && !state
    ? GrantService.search(db, cleanQuery, cap)
    : Promise.resolve({ data: [], error: null });
  const pipelineOpportunitiesPromise = wanted.has('opportunity') && cleanQuery && !state
    ? db.from('org_pipeline')
        .select('id, name, amount_display, amount_numeric, funder, deadline, status, grant_opportunity_id, notes, opportunity_type, project_code')
        .eq('org_profile_id', orgProfileId)
        .or(`name.ilike.%${cleanQuery}%,funder.ilike.%${cleanQuery}%,project_code.ilike.%${cleanQuery}%`)
        .order('updated_at', { ascending: false })
        .limit(cap)
    : Promise.resolve({ data: [], error: null });

  let projectsRequest = db
    .from('org_projects')
    .select('id, name, slug, code, description, tier, category, status')
    .eq('org_profile_id', orgProfileId)
    .eq('status', 'active');
  const projectSearchQuery = comparableName(cleanQuery) === 'goods on country' ? 'Goods' : cleanQuery;
  if (projectSearchQuery) projectsRequest = projectsRequest.or(`name.ilike.%${projectSearchQuery}%,code.ilike.%${projectSearchQuery}%,description.ilike.%${projectSearchQuery}%`);
  const projectsPromise = wanted.has('project') && !state
    ? projectsRequest.order('sort_order').limit(cap)
    : Promise.resolve({ data: [], error: null });

  const [communities, entities, foundations, opportunities, pipelineOpportunities, projects] = await Promise.all([
    communitiesPromise,
    entitiesPromise,
    foundationsPromise,
    opportunitiesPromise,
    pipelineOpportunitiesPromise,
    projectsPromise,
  ]);

  const entityRows = (entities.data || []).filter((row) => !state || row.state === state);
  const foundationRows = ((foundations.data || []) as FoundationService.FoundationSummary[])
    .filter((row) => isAtlasFunderType(row.type));
  const seenOpportunityNames = new Set<string>();
  const opportunityRows = ((opportunities.data || []) as GrantService.GrantSummary[]).filter((row) => {
    const key = comparableName(row.name);
    if (seenOpportunityNames.has(key)) return false;
    seenOpportunityNames.add(key);
    return true;
  });
  const pipelineOpportunityRows = ((pipelineOpportunities.data || []) as PipelineOpportunityRow[]).filter((row) => {
    const key = comparableName(row.name);
    if (seenOpportunityNames.has(key)) return false;
    seenOpportunityNames.add(key);
    return true;
  });
  const foundationAbns = new Set(foundationRows.map((row) => row.acnc_abn).filter(Boolean));
  const records: ActAtlasRecord[] = [
    ...placeFields.map((field) => mapPlaceField(field, slug)),
    ...((communities.data || []) as CommunityRow[]).map((row) => mapCommunity(row, slug)),
    ...entityRows
      .filter((row) => !row.abn || !foundationAbns.has(row.abn))
      .filter((row) => row.entity_type === 'person'
        ? wanted.has('person')
        : wanted.has('organisation'))
      .map((row): ActAtlasRecord => ({
        id: row.gs_id, entityId: row.id,
        type: row.entity_type === 'person' ? 'person' : 'organisation',
        name: row.canonical_name,
        subtitle: [row.entity_type?.replaceAll('_', ' '), row.state, row.abn ? `ABN ${row.abn}` : null].filter(Boolean).join(' · '),
        description: null,
        href: `/entities/${row.gs_id}`,
        state: row.state,
        postcode: null,
        latitude: null,
        longitude: null,
        tags: [row.entity_type, row.state].filter((value): value is string => Boolean(value)),
        facts: [
          { label: 'Source systems', value: numberValue(row.source_count).toLocaleString('en-AU') },
          { label: 'Latest revenue', value: row.latest_revenue ? compactMoney(row.latest_revenue) : 'Unknown' },
        ],
        sourceLabel: 'CivicGraph entity index',
      })),
    ...foundationRows
      .map((row): ActAtlasRecord => ({
        id: String(row.id), type: 'funder', name: row.name,
        subtitle: [row.type?.replaceAll('_', ' '), row.acnc_abn ? `ABN ${row.acnc_abn}` : null].filter(Boolean).join(' · '),
        description: null, href: `/foundations/${row.id}`, state: null, postcode: null, latitude: null, longitude: null,
        tags: [...(Array.isArray(row.thematic_focus) ? row.thematic_focus : []), ...(Array.isArray(row.geographic_focus) ? row.geographic_focus : [])].slice(0, 8),
        facts: [
          { label: 'Annual giving', value: row.total_giving_annual ? compactMoney(row.total_giving_annual) : 'Unknown' },
          { label: 'Focus areas', value: String(Array.isArray(row.thematic_focus) ? row.thematic_focus.length : 0) },
          { label: 'Geographies', value: String(Array.isArray(row.geographic_focus) ? row.geographic_focus.length : 0) },
        ],
        sourceLabel: 'CivicGraph foundation profile',
      })),
    ...((projects.data || []) as ProjectRow[]).map((row): ActAtlasRecord => ({
      id: row.id, type: 'project', name: row.code === 'ACT-GD' ? 'Goods on Country' : row.name,
      subtitle: [row.code, `${row.status} project`].filter(Boolean).join(' · '), description: row.description,
      href: `/org/${slug}/${row.slug}`, state: null, postcode: null, latitude: null, longitude: null,
      tags: [row.tier, row.category].filter((value): value is string => Boolean(value)),
      facts: [{ label: 'Status', value: row.status }, { label: 'Project code', value: row.code || 'None' }],
      sourceLabel: 'ACT project',
    })),
    ...opportunityRows.map((row): ActAtlasRecord => ({
      id: String(row.id), type: 'opportunity', name: row.name,
      subtitle: [row.program_type?.replaceAll('_', ' '), row.source].filter(Boolean).join(' · '), description: null,
      href: `/grants/${row.id}`, state: null, postcode: null, latitude: null, longitude: null,
      tags: [row.program_type, row.source].filter((value): value is string => Boolean(value)),
      facts: [
        { label: 'Amount', value: row.amount_max ? `Up to ${compactMoney(row.amount_max)}` : 'Not stated' },
        { label: 'Closes', value: row.closes_at ? new Date(row.closes_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown' },
      ],
      sourceLabel: 'Grant opportunity index (deduplicated view)',
    })),
    ...pipelineOpportunityRows.map((row): ActAtlasRecord => ({
      id: row.grant_opportunity_id || row.id,
      pipelineItemId: row.id,
      type: 'opportunity',
      name: row.name,
      subtitle: [humanisePipelineValue(row.opportunity_type) || 'ACT opportunity', row.funder, row.project_code].filter(Boolean).join(' · '),
      description: row.notes,
      href: row.grant_opportunity_id ? `/grants/${row.grant_opportunity_id}` : `/org/${slug}?view=opportunities#opportunities`,
      state: null,
      postcode: null,
      latitude: null,
      longitude: null,
      tags: [row.status, row.opportunity_type, row.project_code].filter((value): value is string => Boolean(value)),
      facts: [
        { label: 'Amount', value: Number(row.amount_numeric ?? 0) > 0 ? compactMoney(row.amount_numeric) : row.amount_display || 'Not stated' },
        { label: 'Stage', value: row.status },
      ],
      sourceLabel: 'ACT opportunity pipeline',
    })),
  ];

  if (cleanQuery) {
    const needle = comparableName(cleanQuery);
    records.sort((left, right) => {
      const rank = (record: ActAtlasRecord) => {
        const name = comparableName(record.name);
        if (name === needle) return 0;
        if (name.startsWith(needle)) return 1;
        if (record.type === 'place') return 1;
        if (name.includes(needle)) return 2;
        if (record.subtitle.toLocaleLowerCase('en-AU').includes(needle)) return 3;
        return 4;
      };
      return rank(left) - rank(right) || left.name.localeCompare(right.name, 'en-AU');
    });
  }

  const enrichedRecords = await enrichActAtlasRecords(db, records, { orgProfileId, slug });

  return {
    generatedAt: new Date().toISOString(),
    query: cleanQuery,
    records: enrichedRecords,
    counts: countActAtlasRecords(enrichedRecords),
  };
}
