import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { isInternalActIdentity } from '@/lib/act-internal-identities';

export type ActPeopleFilter = 'attention' | 'connected' | 'money' | 'unresolved' | 'all';
export type ActPersonIdentityStatus = 'canonical' | 'mapped' | 'unresolved';

export interface ActPersonDirectoryRow {
  id: string;
  ghlId: string | null;
  canonicalPersonId: string | null;
  unifiedContactId: string | null;
  name: string;
  email: string | null;
  organisation: string | null;
  role: string | null;
  category: string;
  engagementStatus: string | null;
  projects: string[];
  tags: string[];
  sources: string[];
  identityStatus: ActPersonIdentityStatus;
  identityConfidence: number | null;
  dataQualityScore: number | null;
  needsCleanup: boolean;
  lastVerifiedAt: string | null;
  canonicalOrganisationId: string | null;
  canonicalOrganisationGsId: string | null;
  canonicalOrganisationName: string | null;
  relationshipStrength: string | null;
  temperature: number | null;
  stage: string | null;
  sentiment: string | null;
  touchpoints: number;
  emailCount: number;
  inboundCount: number;
  outboundCount: number;
  firstContactAt: string | null;
  lastContactAt: string | null;
  daysSinceContact: number | null;
  receivedFromThem: number;
  paidToThem: number;
  paidInvoiceCount: number;
  opportunityCount: number;
  pipelineValue: number;
  wonValue: number;
  riskFlags: string[];
  recommendedMove: string;
  evidenceGaps: string[];
}

export interface ActPersonHistoryEvent {
  id: string;
  channel: string;
  direction: string | null;
  title: string;
  summary: string;
  sentiment: string | null;
  topics: string[];
  decisions: string[];
  happenedAt: string | null;
  sourceSystem: string;
  threadId: string | null;
  projectCodes: string[];
  waitingForResponse: boolean;
  followUpAt: string | null;
}

export interface ActPeopleDirectoryPage {
  generatedAt: string;
  summary: {
    people: number;
    canonical: number;
    withHistory: number;
    withMoney: number;
    withProjects: number;
    needsResolution: number;
  };
  query: string;
  filter: ActPeopleFilter;
  page: number;
  pageSize: number;
  total: number;
  people: ActPersonDirectoryRow[];
}

interface RawActPerson extends Record<string, unknown> {
  person_name: string;
  person_category: string | null;
  sources: string | null;
  paid_total: number | string | null;
  paid_invoice_count: number | string | null;
  last_paid_date: string | null;
  xero_project_codes: string[] | null;
  email: string | null;
  company_name: string | null;
  tags: string[] | null;
  last_contact_date: string | null;
  first_contact_date: string | null;
  engagement_status: string | null;
  is_storyteller: boolean | null;
  is_elder: boolean | null;
  gs_id: string | null;
}

interface RawContact360 extends Record<string, unknown> {
  id: string;
  ghl_id: string | null;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  tags: string[] | null;
  projects: string[] | null;
  engagement_status: string | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  opportunity_count: number | string | null;
  total_pipeline_value: number | string | null;
  won_value: number | string | null;
  email_count: number | string | null;
  last_email_date: string | null;
  first_email_date: string | null;
  total_revenue: number | string | null;
  total_payments: number | string | null;
}

interface RawPersonIdentity extends Record<string, unknown> {
  person_id: string;
  full_name: string | null;
  email: string | null;
  ghl_contact_id: string | null;
  current_position: string | null;
  current_company: string | null;
  data_quality_score: number | string | null;
  data_sources: string[] | null;
  needs_cleanup: boolean | null;
  last_verified_at: string | null;
  last_communication_at: string | null;
  unified_tags: string[] | null;
  updated_at: string | null;
}

interface RawUnifiedContact extends Record<string, unknown> {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  confidence: number | string | null;
  relationship_strength: string | null;
  primary_project_codes: string[] | null;
  sources: string[] | null;
  ghl_id: string | null;
  identifier_count: number | string | null;
  updated_at: string | null;
}

interface RawRelationshipHealth extends Record<string, unknown> {
  ghl_contact_id: string;
  temperature: number | string | null;
  lcaa_stage: string | null;
  total_touchpoints: number | string | null;
  inbound_count: number | string | null;
  outbound_count: number | string | null;
  last_contact_at: string | null;
  days_since_contact: number | string | null;
  overall_sentiment: string | null;
  suggested_actions: string[] | null;
  risk_flags: string[] | null;
}

interface RawOrgContact extends Record<string, unknown> {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  organisation: string | null;
  last_contacted_at: string | null;
  linked_entity_id: string | null;
  person_id: string | null;
  unified_tags: string[] | null;
}

interface RawEntityLink extends Record<string, unknown> {
  contact_id: string;
  entity_id: string;
  entity_gs_id: string | null;
  entity_name: string;
  confidence_score: number | string | null;
  verified: boolean | null;
}

interface RawContactEntityLink extends Record<string, unknown> {
  contact_id: string;
  entity_id: string;
  confidence_score: number | string | null;
  verified: boolean | null;
}

interface RawEntityName extends Record<string, unknown> {
  id: string;
  gs_id: string | null;
  canonical_name: string;
}

interface RawHistoryEvent extends Record<string, unknown> {
  id: string;
  channel: string;
  direction: string | null;
  subject: string | null;
  summary: string | null;
  sentiment: string | null;
  topics: string[] | null;
  key_decisions: string[] | null;
  waiting_for_response: boolean | null;
  follow_up_date: string | null;
  source_system: string | null;
  source_thread_id: string | null;
  occurred_at: string | null;
  project_codes: string[] | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_FILTERS = new Set<ActPeopleFilter>(['attention', 'connected', 'money', 'unresolved', 'all']);

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalise(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-AU').replace(/\s+/g, ' ');
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function newestDate(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value && !Number.isNaN(Date.parse(value))))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function oldestDate(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value && !Number.isNaN(Date.parse(value))))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
}

function projectCodes(values: unknown[]): string[] {
  const codes = values.flatMap((value) => stringArray(value));
  return [...new Set(codes.flatMap((value) => {
    const clean = value.replace(/^project:/i, '').trim();
    return /^(act[-_]|goods|justice|harvest|empathy|civicgraph|alma|palm)/i.test(clean) ? [clean.toUpperCase()] : [];
  }))].sort();
}

function safeSummary(value: string | null | undefined, fallback: string): string {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim() || fallback;
  return clean.length > 420 ? `${clean.slice(0, 417).trimEnd()}...` : clean;
}

function nextMove(input: {
  name: string;
  status: ActPersonIdentityStatus;
  suggestions: string[];
  risks: string[];
  temperature: number | null;
  daysSinceContact: number | null;
  touchpoints: number;
  paidToThem: number;
  receivedFromThem: number;
}): string {
  if (input.suggestions[0]) return input.suggestions[0];
  if (input.risks[0]) return `Resolve ${input.risks[0].replaceAll('_', ' ')} before the next approach.`;
  if (input.status === 'unresolved') return 'Confirm this person’s canonical identity and organisation before relying on inferred connections.';
  if ((input.temperature ?? 0) >= 55 && (input.daysSinceContact ?? 0) >= 30) return `Reconnect with ${input.name} using the strongest previous project or conversation.`;
  if (input.receivedFromThem > 0 || input.paidToThem > 0) return 'Review the previous paid work and ask what a useful next exchange would be.';
  if (input.touchpoints > 0) return 'Read the latest interaction, confirm what ACT tried, and set a specific next touch.';
  return 'Confirm why this person is in the ACT network and whether a next touch is warranted.';
}

function buildIndexMaps<T>(rows: T[], keys: (row: T) => Array<string | null | undefined>): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    for (const value of keys(row)) {
      const key = normalise(value);
      if (key && !map.has(key)) map.set(key, row);
    }
  }
  return map;
}

async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  context: string,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) {
      console.error(`[act-people-directory] ${context} failed:`, error.message || error);
      break;
    }
    const page = Array.isArray(data) ? data as T[] : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function loadEntityLinks(db: ReturnType<typeof getServiceSupabase>): Promise<RawEntityLink[]> {
  const links = await fetchAllRows<RawContactEntityLink>(
    async (from, to) => {
      const { data, error } = await db
        .from('contact_entity_links')
        .select('contact_id, entity_id, confidence_score, verified')
        .gte('confidence_score', 0.8)
        .order('contact_id')
        .order('verified', { ascending: false })
        .order('confidence_score', { ascending: false })
        .range(from, to);
      return { data, error };
    },
    'organisation links',
  );
  const entityIds = [...new Set(links.map((link) => link.entity_id).filter(Boolean))];
  const chunks = Array.from({ length: Math.ceil(entityIds.length / 400) }, (_, index) => entityIds.slice(index * 400, index * 400 + 400));
  const entityPages = await Promise.all(chunks.map(async (ids) => {
    const { data, error } = await db.from('gs_entities').select('id, gs_id, canonical_name').in('id', ids);
    if (error) {
      console.error('[act-people-directory] organisation names failed:', error.message || error);
      return [] as RawEntityName[];
    }
    return (data ?? []) as RawEntityName[];
  }));
  const entityMap = new Map(entityPages.flat().map((entity) => [entity.id, entity]));

  return links.flatMap((link): RawEntityLink[] => {
    const entity = entityMap.get(link.entity_id);
    return entity ? [{
      contact_id: link.contact_id,
      entity_id: link.entity_id,
      entity_gs_id: entity.gs_id,
      entity_name: entity.canonical_name,
      confidence_score: link.confidence_score,
      verified: link.verified,
    }] : [];
  });
}

export function buildActPersonDirectoryRows(input: {
  people: RawActPerson[];
  contacts: RawContact360[];
  identities: RawPersonIdentity[];
  unifiedContacts: RawUnifiedContact[];
  health: RawRelationshipHealth[];
  orgContacts: RawOrgContact[];
  entityLinks: RawEntityLink[];
}): ActPersonDirectoryRow[] {
  const contacts = [...input.contacts].sort((left, right) => String(right.last_contact_date ?? '').localeCompare(String(left.last_contact_date ?? '')));
  const identities = [...input.identities].sort((left, right) => String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')));
  const unifiedContacts = [...input.unifiedContacts].sort((left, right) => String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')));
  const contactMap = buildIndexMaps(contacts, (row) => [row.email ? `email:${row.email}` : null, row.full_name ? `name:${row.full_name}` : null]);
  const identityMap = buildIndexMaps(identities, (row) => [row.ghl_contact_id ? `ghl:${row.ghl_contact_id}` : null, row.email ? `email:${row.email}` : null]);
  const unifiedMap = buildIndexMaps(unifiedContacts, (row) => [row.ghl_id ? `ghl:${row.ghl_id}` : null, row.email ? `email:${row.email}` : null]);
  const healthMap = buildIndexMaps(input.health, (row) => [`ghl:${row.ghl_contact_id}`]);
  const orgMap = buildIndexMaps(input.orgContacts, (row) => [row.person_id ? `person:${row.person_id}` : null, row.email ? `email:${row.email}` : null, `name:${row.name}`]);
  const entityMap = buildIndexMaps(
    [...input.entityLinks].sort((left, right) => Number(Boolean(right.verified)) - Number(Boolean(left.verified)) || numberValue(right.confidence_score) - numberValue(left.confidence_score)),
    (row) => [`contact:${row.contact_id}`],
  );

  return input.people
    .map((person): ActPersonDirectoryRow => {
      const emailKey = person.email ? `email:${person.email}` : '';
      const contact = (emailKey ? contactMap.get(normalise(emailKey)) : null) ?? contactMap.get(normalise(`name:${person.person_name}`)) ?? null;
      const identity = (contact?.ghl_id ? identityMap.get(normalise(`ghl:${contact.ghl_id}`)) : null)
        ?? (emailKey ? identityMap.get(normalise(emailKey)) : null)
        ?? null;
      const unified = (contact?.ghl_id ? unifiedMap.get(normalise(`ghl:${contact.ghl_id}`)) : null)
        ?? (emailKey ? unifiedMap.get(normalise(emailKey)) : null)
        ?? null;
      const orgContact = (identity?.person_id ? orgMap.get(normalise(`person:${identity.person_id}`)) : null)
        ?? (emailKey ? orgMap.get(normalise(emailKey)) : null)
        ?? orgMap.get(normalise(`name:${person.person_name}`))
        ?? null;
      const health = contact?.ghl_id ? healthMap.get(normalise(`ghl:${contact.ghl_id}`)) ?? null : null;
      const entity = contact ? entityMap.get(normalise(`contact:${contact.id}`)) ?? null : null;
      const canonicalPersonId = identity?.person_id ?? null;
      const unifiedContactId = unified?.id ?? null;
      const identityStatus: ActPersonIdentityStatus = unifiedContactId
        ? 'canonical'
        : canonicalPersonId ? 'mapped' : 'unresolved';
      const tags = [...new Set([
        ...stringArray(person.tags),
        ...stringArray(contact?.tags),
        ...stringArray(identity?.unified_tags),
        ...stringArray(orgContact?.unified_tags),
      ])];
      const projects = projectCodes([
        person.xero_project_codes,
        contact?.projects,
        tags.filter((tag) => tag.toLowerCase().startsWith('project:')),
        unified?.primary_project_codes,
      ]);
      const sources = [...new Set([
        ...String(person.sources ?? '').split(',').map((source) => source.trim()).filter(Boolean),
        ...stringArray(identity?.data_sources),
        ...stringArray(unified?.sources),
        ...(orgContact ? ['civicgraph'] : []),
        ...(contact?.email_count && numberValue(contact.email_count) > 0 ? ['communications'] : []),
      ])].sort();
      const risks = stringArray(health?.risk_flags);
      const suggestions = stringArray(health?.suggested_actions);
      const temperature = health?.temperature == null ? null : numberValue(health.temperature);
      const daysSinceContact = health?.days_since_contact == null ? null : numberValue(health.days_since_contact);
      const touchpoints = Math.max(numberValue(health?.total_touchpoints), numberValue(contact?.email_count));
      const receivedFromThem = numberValue(contact?.total_revenue);
      const paidToThem = Math.max(numberValue(person.paid_total), numberValue(contact?.total_payments));
      const evidenceGaps = [
        identityStatus === 'unresolved' ? 'canonical person identity' : null,
        !entity && !orgContact?.linked_entity_id ? 'canonical organisation' : null,
        touchpoints === 0 ? 'dated contact history' : null,
        projects.length === 0 ? 'ACT project connection' : null,
      ].filter((value): value is string => Boolean(value));

      return {
        id: unifiedContactId ?? canonicalPersonId ?? contact?.id ?? `act-person:${normalise(person.email || person.person_name)}`,
        ghlId: contact?.ghl_id ?? null,
        canonicalPersonId,
        unifiedContactId,
        name: unified?.name || identity?.full_name || person.person_name,
        email: unified?.email || identity?.email || person.email,
        organisation: identity?.current_company || unified?.company || orgContact?.organisation || person.company_name || contact?.company_name || null,
        role: identity?.current_position || orgContact?.role || null,
        category: person.person_category || 'network',
        engagementStatus: contact?.engagement_status || person.engagement_status,
        projects,
        tags,
        sources,
        identityStatus,
        identityConfidence: unified?.confidence == null ? null : numberValue(unified.confidence),
        dataQualityScore: identity?.data_quality_score == null ? null : numberValue(identity.data_quality_score),
        needsCleanup: Boolean(identity?.needs_cleanup),
        lastVerifiedAt: identity?.last_verified_at ?? null,
        canonicalOrganisationId: entity?.entity_id ?? orgContact?.linked_entity_id ?? null,
        canonicalOrganisationGsId: entity?.entity_gs_id ?? null,
        canonicalOrganisationName: entity?.entity_name ?? null,
        relationshipStrength: unified?.relationship_strength ?? null,
        temperature,
        stage: health?.lcaa_stage ?? null,
        sentiment: health?.overall_sentiment ?? null,
        touchpoints,
        emailCount: numberValue(contact?.email_count),
        inboundCount: numberValue(health?.inbound_count),
        outboundCount: numberValue(health?.outbound_count),
        firstContactAt: oldestDate([person.first_contact_date, contact?.first_contact_date, contact?.first_email_date]),
        lastContactAt: newestDate([person.last_contact_date, contact?.last_contact_date, contact?.last_email_date, identity?.last_communication_at, orgContact?.last_contacted_at, health?.last_contact_at]),
        daysSinceContact,
        receivedFromThem,
        paidToThem,
        paidInvoiceCount: numberValue(person.paid_invoice_count),
        opportunityCount: numberValue(contact?.opportunity_count),
        pipelineValue: numberValue(contact?.total_pipeline_value),
        wonValue: numberValue(contact?.won_value),
        riskFlags: risks,
        recommendedMove: nextMove({
          name: person.person_name,
          status: identityStatus,
          suggestions,
          risks,
          temperature,
          daysSinceContact,
          touchpoints,
          paidToThem,
          receivedFromThem,
        }),
        evidenceGaps,
      };
    })
    .filter((person) => person.name && !isInternalActIdentity({ name: person.name, email: person.email }))
    .sort((left, right) => personAttentionScore(right) - personAttentionScore(left) || left.name.localeCompare(right.name));
}

function personAttentionScore(person: ActPersonDirectoryRow): number {
  return (person.temperature ?? 0)
    + Math.min(person.touchpoints, 25)
    + (person.pipelineValue > 0 ? 20 : 0)
    + (person.riskFlags.length > 0 ? 15 : 0)
    + ((person.daysSinceContact ?? 0) >= 30 ? 8 : 0)
    + (person.identityStatus === 'unresolved' ? 4 : 0);
}

export async function loadActPeopleIndex(orgProfileId: string): Promise<ActPersonDirectoryRow[]> {
  if (!UUID_RE.test(orgProfileId)) return [];
  const db = getServiceSupabase();
  const [people, contacts, identities, unifiedContacts, health, orgContacts, entityLinks] = await Promise.all([
    fetchAllRows<RawActPerson>(async (from, to) => {
      const { data, error } = await db.from('v_act_people').select('person_name, person_category, sources, paid_total, paid_invoice_count, last_paid_date, xero_project_codes, email, company_name, tags, last_contact_date, first_contact_date, engagement_status, is_storyteller, is_elder, gs_id').order('person_name').range(from, to);
      return { data, error };
    }, 'people'),
    fetchAllRows<RawContact360>(async (from, to) => {
      const { data, error } = await db.from('v_contact_360').select('id, ghl_id, full_name, email, company_name, tags, projects, engagement_status, first_contact_date, last_contact_date, opportunity_count, total_pipeline_value, won_value, email_count, last_email_date, first_email_date, total_revenue, total_payments').order('id').range(from, to);
      return { data, error };
    }, 'contact 360'),
    fetchAllRows<RawPersonIdentity>(async (from, to) => {
      const { data, error } = await db.from('person_identity_map').select('person_id, full_name, email, ghl_contact_id, current_position, current_company, data_quality_score, data_sources, needs_cleanup, last_verified_at, last_communication_at, unified_tags, updated_at').not('ghl_contact_id', 'is', null).order('updated_at', { ascending: false }).order('person_id').range(from, to);
      return { data, error };
    }, 'person identities'),
    fetchAllRows<RawUnifiedContact>(async (from, to) => {
      const { data, error } = await db.from('v_unified_contacts').select('id, name, email, company, confidence, relationship_strength, primary_project_codes, sources, ghl_id, identifier_count, updated_at').not('ghl_id', 'is', null).order('updated_at', { ascending: false }).order('id').range(from, to);
      return { data, error };
    }, 'unified contacts'),
    fetchAllRows<RawRelationshipHealth>(async (from, to) => {
      const { data, error } = await db.from('relationship_health').select('ghl_contact_id, temperature, lcaa_stage, total_touchpoints, inbound_count, outbound_count, last_contact_at, days_since_contact, overall_sentiment, suggested_actions, risk_flags').order('ghl_contact_id').range(from, to);
      return { data, error };
    }, 'relationship health'),
    fetchAllRows<RawOrgContact>(async (from, to) => {
      const { data, error } = await db.from('org_contacts').select('id, name, email, role, organisation, last_contacted_at, linked_entity_id, person_id, expertise').eq('org_profile_id', orgProfileId).order('updated_at', { ascending: false }).order('id').range(from, to);
      return {
        data: (data ?? []).map((contact) => ({ ...contact, unified_tags: contact.expertise })),
        error,
      };
    }, 'org contacts'),
    loadEntityLinks(db),
  ]);

  return buildActPersonDirectoryRows({
    people,
    contacts,
    identities,
    unifiedContacts,
    health,
    orgContacts,
    entityLinks,
  });
}

const getCachedActPeopleIndex = unstable_cache(
  loadActPeopleIndex,
  ['act-people-directory-v2'],
  { revalidate: 300, tags: ['act-people-directory'] },
);

const getActPeopleIndex = cache(getCachedActPeopleIndex);

export async function getActPeopleDirectory(
  orgProfileId: string,
  options: { query?: string; filter?: ActPeopleFilter; page?: number; pageSize?: number } = {},
): Promise<ActPeopleDirectoryPage> {
  const people = await getActPeopleIndex(orgProfileId);
  const query = String(options.query ?? '').trim();
  const filter = VALID_FILTERS.has(options.filter ?? 'attention') ? (options.filter ?? 'attention') : 'attention';
  const pageSize = Math.min(100, Math.max(20, Number(options.pageSize ?? 60)));
  const page = Math.max(1, Number(options.page ?? 1));
  const needle = normalise(query);
  const matches = people.filter((person) => {
    if (needle && !normalise([
      person.name,
      person.email,
      person.organisation,
      person.role,
      ...person.projects,
      ...person.tags,
    ].filter(Boolean).join(' ')).includes(needle)) return false;
    if (filter === 'connected') return person.identityStatus !== 'unresolved' && person.touchpoints > 0;
    if (filter === 'money') return person.receivedFromThem > 0 || person.paidToThem > 0 || person.pipelineValue > 0;
    if (filter === 'unresolved') return person.identityStatus === 'unresolved' || person.needsCleanup;
    if (filter === 'attention') {
      return person.riskFlags.length > 0
        || person.pipelineValue > 0
        || ((person.temperature ?? 0) >= 45 && (person.daysSinceContact ?? 0) >= 14)
        || (person.identityStatus === 'unresolved' && person.touchpoints > 0);
    }
    return true;
  });
  const start = (page - 1) * pageSize;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      people: people.length,
      canonical: people.filter((person) => person.identityStatus !== 'unresolved').length,
      withHistory: people.filter((person) => person.touchpoints > 0).length,
      withMoney: people.filter((person) => person.receivedFromThem > 0 || person.paidToThem > 0).length,
      withProjects: people.filter((person) => person.projects.length > 0).length,
      needsResolution: people.filter((person) => person.identityStatus === 'unresolved' || person.needsCleanup).length,
    },
    query,
    filter,
    page,
    pageSize,
    total: matches.length,
    people: matches.slice(start, start + pageSize),
  };
}

export async function getActPersonHistory(orgProfileId: string, ghlId: string): Promise<ActPersonHistoryEvent[]> {
  const id = ghlId.trim();
  if (!id || id.length > 160 || !UUID_RE.test(orgProfileId)) return [];
  const people = await getActPeopleIndex(orgProfileId);
  if (!people.some((person) => person.ghlId === id)) return [];
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('communications_history')
    .select('id, channel, direction, subject, summary, sentiment, topics, key_decisions, waiting_for_response, follow_up_date, source_system, source_thread_id, occurred_at, project_codes')
    .eq('ghl_contact_id', id)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .range(0, 99);
  if (error || !data) return [];

  return (data as RawHistoryEvent[]).map((event) => ({
    id: event.id,
    channel: event.channel,
    direction: event.direction,
    title: event.subject?.trim() || `${event.channel} interaction`,
    summary: safeSummary(event.summary, 'No interaction summary was generated.'),
    sentiment: event.sentiment,
    topics: stringArray(event.topics),
    decisions: stringArray(event.key_decisions),
    happenedAt: event.occurred_at,
    sourceSystem: event.source_system || event.channel,
    threadId: event.source_thread_id,
    projectCodes: stringArray(event.project_codes),
    waitingForResponse: Boolean(event.waiting_for_response),
    followUpAt: event.follow_up_date,
  }));
}
