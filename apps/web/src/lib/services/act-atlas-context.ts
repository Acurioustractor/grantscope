import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActAtlasConnection, ActAtlasConnectionSection, ActAtlasContext, ActAtlasRecord } from './act-atlas';

const IDENTITY_LEGAL_TOKENS = new Set(['the', 'trustee', 'for', 'pty', 'ltd', 'limited', 'inc', 'incorporated', 'company', 'corporation']);

interface BuyerRow extends Record<string, unknown> {
  id: string;
  community_id: string;
  gs_id: string | null;
  entity_name: string;
  buyer_role: string | null;
  relationship_status: string | null;
  next_action: string | null;
  last_contact_date: string | null;
  govt_contract_value: number | string | null;
  is_community_controlled: boolean | null;
  ghl_stage_name: string | null;
}

interface LocalEntityRow extends Record<string, unknown> {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  sector: string | null;
  postcode: string | null;
  is_community_controlled: boolean | null;
}

interface SignalRow extends Record<string, unknown> {
  id: string;
  community_id: string;
  title: string;
  priority: string;
  status: string;
  estimated_value: number | string | null;
  action_notes: string | null;
  created_at: string;
}

interface FoundationPersonRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  person_name: string;
  role_title: string | null;
  role_type: string | null;
  confidence: string | null;
  source_url: string | null;
  source_document_url: string | null;
}

interface GranteeRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  grantee_name: string;
  grant_amount: number | string | null;
  grant_year: number | null;
  program_name: string | null;
  source_url: string | null;
  source_document_url: string | null;
  confidence: string | null;
}

interface ProgramRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  name: string;
  status: string | null;
  deadline: string | null;
  amount_max: number | string | null;
  application_mode: string | null;
  url: string | null;
}

interface PortfolioRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  stage: string;
  engagement_status: string;
  next_step: string | null;
  next_touch_at: string | null;
  last_interaction_at: string | null;
  project: { id: string; name: string; slug: string; code: string | null } | Array<{ id: string; name: string; slug: string; code: string | null }> | null;
}

interface SnapshotContact {
  name?: string;
  email?: string;
  last_contact_date?: string | null;
}

interface SnapshotRow extends Record<string, unknown> {
  foundation_id: string;
  contacts_count: number | null;
  contacts: SnapshotContact[] | null;
  most_recent_contact_at: string | null;
  email_count: number | null;
  email_last_date: string | null;
  email_summary: string | null;
  xero_invoiced_total: number | string | null;
  xero_paid_total: number | string | null;
  xero_last_payment_date: string | null;
  refreshed_at: string;
}

interface RelationshipSignalRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  signal_type: string;
  related_name: string | null;
  person_name: string | null;
  evidence_text: string;
  confidence: string | null;
  source_url: string | null;
}

interface EntityRelationshipRow extends Record<string, unknown> {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number | string | null;
  currency: string | null;
  year: number | null;
  dataset: string;
  source_url: string | null;
  confidence: string | null;
}

interface CounterpartEntityRow extends Record<string, unknown> {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  state: string | null;
  is_community_controlled: boolean | null;
}

interface OrgContactRow extends Record<string, unknown> {
  id: string;
  linked_entity_id: string;
  name: string;
  email: string | null;
  role: string | null;
  organisation: string | null;
  last_contacted_at: string | null;
}

interface ContactEntityLinkRow extends Record<string, unknown> {
  contact_id: string;
  entity_id: string;
  confidence_score: number | string | null;
  verified: boolean | null;
}

interface GhlContactRow extends Record<string, unknown> {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  last_contact_date: string | null;
}

interface ContextEventRow extends Record<string, unknown> {
  id: string;
  source_system: string;
  organisation: string | null;
  actor_name: string | null;
  actor_email: string | null;
  title: string;
  summary: string;
  happened_at: string;
  signal_kind: string;
}

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  invoice_number: string | null;
  contact_name: string;
  type: string;
  status: string;
  date: string | null;
  due_date: string | null;
  fully_paid_date: string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  amount_due: number | string | null;
  project_code: string | null;
  reference: string | null;
}

interface ProjectPipelineRow extends Record<string, unknown> {
  id: string;
  project_id: string | null;
  project_code: string | null;
  name: string;
  amount_numeric: number | string | null;
  amount_display: string | null;
  funder: string | null;
  deadline: string | null;
  status: string;
  grant_opportunity_id: string | null;
  owner_name: string | null;
  next_action: string | null;
  next_action_at: string | null;
  updated_at: string;
}

interface ProjectFoundationRow extends Record<string, unknown> {
  id: string;
  org_project_id: string;
  foundation_id: string;
  stage: string;
  fit_score: number | null;
  fit_summary: string | null;
  engagement_status: string;
  next_step: string | null;
  next_touch_at: string | null;
  last_interaction_at: string | null;
  foundation: { id: string; name: string; total_giving_annual: number | string | null } | Array<{ id: string; name: string; total_giving_annual: number | string | null }> | null;
}

interface ProjectContactRow extends Record<string, unknown> {
  id: string;
  project_id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  email: string | null;
  engagement_ask: string | null;
  last_contacted_at: string | null;
}

interface ProjectMoneyRow extends Record<string, unknown> {
  project_code: string;
  income_fy: number | string | null;
  expenses_fy: number | string | null;
  net_fy: number | string | null;
  receivables: number | string | null;
  pipeline_weighted: number | string | null;
  pipeline_raw: number | string | null;
  grants_in_flight: number | string | null;
  grants_in_flight_count: number | string | null;
  last_transaction_at: string | null;
  last_opp_update_at: string | null;
}

interface ProjectRecommendationRow extends Record<string, unknown> {
  project_code: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  max_grant_amount: number | string | null;
  fit_score: number | null;
  flags: string[] | null;
  application_url: string | null;
  source_url: string | null;
  verification_status: string | null;
}

interface ProjectIntelligenceRow extends Record<string, unknown> {
  project_code: string;
  project_label: string;
  readiness: string | null;
  current_state: string | null;
  opportunity_alignment: string | null;
  next_question: string | null;
  evidence_we_have: unknown;
}

interface GoodsCommunityRow extends Record<string, unknown> {
  id: string;
  community_name: string;
  state: string | null;
  priority: string | null;
  demand_beds: number | null;
  demand_washers: number | null;
  assets_deployed: number | null;
  buyer_entity_count: number | null;
}

interface OpportunityDetailRow extends Record<string, unknown> {
  id: string;
  name: string;
  provider: string | null;
  foundation_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  closes_at: string | null;
  status: string | null;
  pipeline_stage: string | null;
  aligned_projects: string[] | null;
  requirements: string | null;
  requirements_summary: string | null;
  eligibility_criteria: unknown;
  assessment_criteria: unknown;
  dgr_required: boolean | null;
  accepts_sole_trader: boolean | null;
  accepts_pty_ltd: boolean | null;
  accepts_charity: boolean | null;
  url: string | null;
  last_verified_at: string | null;
  updated_at: string;
}

interface OpportunityDecisionRow extends Record<string, unknown> {
  id: string;
  source_ref: string;
  project_code: string;
  decision: string;
  reason: string | null;
  notes: string | null;
  evidence_gaps: string[] | null;
  outcome: string | null;
  created_at: string;
}

interface RecommendationDecisionRow extends Record<string, unknown> {
  id: string;
  project_code: string;
  grant_opportunity_id: string;
  decision: string;
  notes: string | null;
}

function money(value: unknown): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function humanise(value: string | null | undefined): string {
  return String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').trim();
}

function normaliseIdentity(value: string | null | undefined): string {
  return String(value ?? '')
    .toLocaleLowerCase('en-AU')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !IDENTITY_LEGAL_TOKENS.has(token))
    .join(' ')
    .trim();
}

function identityMatches(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftValue = normaliseIdentity(left);
  const rightValue = normaliseIdentity(right);
  if (!leftValue || !rightValue) return false;
  return leftValue === rightValue || leftValue.startsWith(`${rightValue} `) || rightValue.startsWith(`${leftValue} `);
}

function dateLabel(value: string | null | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function newestDate(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function followUpDetail(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Use the existing ACT history and named contact before approaching again.';
  const label = dateLabel(value);
  return Date.parse(value) < Date.now()
    ? `The follow-up due ${label} is overdue.`
    : `Next touch is recorded for ${label}.`;
}

function grouped<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = String(row[key] ?? '');
    if (!value) continue;
    const items = result.get(value) ?? [];
    items.push(row);
    result.set(value, items);
  }
  return result;
}

function connectionSection(id: string, title: string, allItems: ActAtlasConnection[], limit = 4): ActAtlasConnectionSection | null {
  if (allItems.length === 0) return null;
  return { id, title, count: allItems.length, items: allItems.slice(0, limit) };
}

function cleanSections(values: Array<ActAtlasConnectionSection | null>): ActAtlasConnectionSection[] {
  return values.filter((value): value is ActAtlasConnectionSection => Boolean(value));
}

function projectFromPortfolio(row: PortfolioRow): { id: string; name: string; slug: string; code: string | null } | null {
  if (Array.isArray(row.project)) return row.project[0] ?? null;
  return row.project;
}

function uniqueBy<T>(rows: T[], identity: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = identity(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function entityConnectionKind(entityType: string): ActAtlasConnection['kind'] {
  if (entityType === 'person') return 'person';
  if (entityType === 'foundation') return 'funder';
  return 'organisation';
}

function relationshipDetail(row: EntityRelationshipRow, selectedEntityId: string): string {
  const direction = row.source_entity_id === selectedEntityId ? 'outgoing' : 'incoming';
  return [humanise(row.relationship_type), direction, row.year ? String(row.year) : null, Number(row.amount ?? 0) > 0 ? money(row.amount) : null].filter(Boolean).join(' · ');
}

function buildEntityContext(
  record: ActAtlasRecord,
  slug: string,
  relationships: EntityRelationshipRow[],
  counterparts: Map<string, CounterpartEntityRow>,
  contacts: OrgContactRow[],
  contactEntityLinks: ContactEntityLinkRow[],
  ghlContacts: GhlContactRow[],
  events: ContextEventRow[],
  invoices: InvoiceRow[],
): ActAtlasContext {
  const entityId = record.entityId || '';
  const networkRows = uniqueBy(relationships, (row) => {
    const counterpartId = row.source_entity_id === entityId ? row.target_entity_id : row.source_entity_id;
    return `${counterpartId}:${row.relationship_type}:${row.amount ?? ''}:${row.year ?? ''}`;
  });
  const networkItems = networkRows.map((row): { row: EntityRelationshipRow; entity: CounterpartEntityRow; item: ActAtlasConnection } | null => {
    const counterpartId = row.source_entity_id === entityId ? row.target_entity_id : row.source_entity_id;
    const entity = counterparts.get(counterpartId);
    if (!entity || entity.id === entityId) return null;
    return {
      row,
      entity,
      item: {
        id: row.id,
        kind: entityConnectionKind(entity.entity_type),
        name: entity.canonical_name,
        detail: relationshipDetail(row, entityId),
        meta: [humanise(row.dataset), row.confidence ? `${humanise(row.confidence)} confidence` : null].filter(Boolean).join(' · ') || null,
        href: entity.entity_type === 'foundation' ? `/foundations?search=${encodeURIComponent(entity.canonical_name)}` : `/entities/${entity.gs_id}`,
        sourceLabel: 'CivicGraph relationship evidence',
      },
    };
  }).filter((value): value is { row: EntityRelationshipRow; entity: CounterpartEntityRow; item: ActAtlasConnection } => Boolean(value));

  const directContactItems: ActAtlasConnection[] = uniqueBy(contacts, (row) => (row.email || row.name).toLocaleLowerCase('en-AU')).map((row) => ({
    id: row.id,
    kind: 'person',
    name: row.name,
    detail: [row.role, row.email].filter(Boolean).join(' · ') || 'Known ACT contact',
    meta: row.last_contacted_at ? `Last contact ${dateLabel(row.last_contacted_at)}` : null,
    href: `/org/${slug}?view=relationships#relationships`,
    sourceLabel: 'ACT contacts',
  }));
  const linkByContactId = new Map(contactEntityLinks.map((row) => [row.contact_id, row]));
  const knownContactKeys = new Set(directContactItems.map((item) => item.name.toLocaleLowerCase('en-AU')));
  const ghlItems: ActAtlasConnection[] = uniqueBy(ghlContacts, (row) => (row.email || row.full_name || '').toLocaleLowerCase('en-AU'))
    .filter((row) => !knownContactKeys.has(String(row.full_name ?? '').toLocaleLowerCase('en-AU')))
    .map((row) => ({
      id: row.id,
      kind: 'person',
      name: row.full_name || row.email || 'HighLevel contact',
      detail: [row.company_name, row.email].filter(Boolean).join(' · ') || 'Known through HighLevel',
      meta: [
        row.last_contact_date ? `Last contact ${dateLabel(row.last_contact_date)}` : null,
        linkByContactId.has(row.id)
          ? `${linkByContactId.get(row.id)?.verified ? 'Verified' : 'Candidate'} entity link · ${Math.round(Number(linkByContactId.get(row.id)?.confidence_score ?? 0) * 100)}% confidence`
          : null,
      ].filter(Boolean).join(' · ') || null,
      href: `/org/${slug}?view=relationships#relationships`,
      sourceLabel: linkByContactId.has(row.id) ? 'ACT contact entity link' : 'HighLevel contacts',
    }));
  const eventItems: ActAtlasConnection[] = uniqueBy(events, (row) => `${row.source_system}:${row.id}`).map((row) => ({
    id: row.id,
    kind: 'activity',
    name: row.title,
    detail: row.summary,
    meta: [humanise(row.source_system), dateLabel(row.happened_at), row.actor_name || row.actor_email].filter(Boolean).join(' · ') || null,
    href: `/org/${slug}?view=relationships#relationships`,
    sourceLabel: `${humanise(row.source_system)} context`,
  }));
  const invoiceItems: ActAtlasConnection[] = invoices.map((row) => ({
    id: row.id,
    kind: 'activity',
    name: `${row.invoice_number || 'Invoice'} · ${humanise(row.status)}`,
    detail: [money(row.total), row.project_code, row.reference].filter(Boolean).join(' · '),
    meta: [row.date ? `Issued ${dateLabel(row.date)}` : null, Number(row.amount_due ?? 0) > 0 ? `${money(row.amount_due)} due` : Number(row.amount_paid ?? 0) > 0 ? `${money(row.amount_paid)} paid` : null].filter(Boolean).join(' · ') || null,
    href: `/org/${slug}?view=money#money`,
    sourceLabel: 'Xero invoice',
  }));
  const actHistory = [...invoiceItems, ...eventItems];
  const peopleItems = record.type === 'organisation'
    ? uniqueBy([...directContactItems, ...ghlItems, ...networkItems.filter((entry) => entry.entity.entity_type === 'person').map((entry) => entry.item)], (item) => item.name.toLocaleLowerCase('en-AU'))
    : [...directContactItems, ...ghlItems];
  const moneyItems = networkItems.filter((entry) => Number(entry.row.amount ?? 0) > 0 || ['grant', 'contract', 'donation', 'funding'].some((token) => entry.row.relationship_type.includes(token))).map((entry) => entry.item);
  const actOrganisationNames = [
    ...contacts.map((row) => row.organisation),
    ...ghlContacts.map((row) => row.company_name),
    ...events.map((row) => row.organisation),
  ].filter((value): value is string => Boolean(value));
  const organisationItems = networkItems
    .filter((entry) => entry.entity.entity_type !== 'person' && !moneyItems.some((item) => item.id === entry.item.id))
    .sort((left, right) => Number(actOrganisationNames.some((name) => identityMatches(name, right.entity.canonical_name))) - Number(actOrganisationNames.some((name) => identityMatches(name, left.entity.canonical_name))))
    .map((entry) => entry.item);

  const outstanding = invoices.find((row) => Number(row.amount_due ?? 0) > 0);
  const followUp = events.find((row) => row.signal_kind === 'relationship_follow_up');
  const latestActContact = newestDate([
    ...contacts.map((row) => row.last_contacted_at),
    ...ghlContacts.map((row) => row.last_contact_date),
    ...events.map((row) => row.happened_at),
    ...invoices.map((row) => row.fully_paid_date || row.date),
  ]);
  const hasActHistory = contacts.length > 0 || ghlContacts.length > 0 || events.length > 0 || invoices.length > 0;
  const nextMove = outstanding
    ? {
        title: `Confirm payment of ${money(outstanding.amount_due)}`,
        detail: `${outstanding.invoice_number || 'The invoice'} was due ${dateLabel(outstanding.due_date) || 'on an unknown date'}; pair the payment follow-up with the relationship next step.`,
        href: `/org/${slug}?view=money#money`,
      }
    : followUp
      ? {
          title: followUp.summary,
          detail: `This follow-up was recorded from ${humanise(followUp.source_system)} context on ${dateLabel(followUp.happened_at) || 'an unknown date'}.`,
          href: `/org/${slug}?view=relationships#relationships`,
        }
      : hasActHistory
        ? {
            title: `Reconnect with ${record.name} from the existing history`,
            detail: 'Start with what ACT and this relationship already exchanged, then record the useful next step.',
            href: `/org/${slug}?view=relationships#relationships`,
          }
        : {
            title: 'Find a credible warm path before outreach',
            detail: 'Use the connected people and organisations as research leads, then verify an actual ACT relationship.',
            href: record.href,
          };

  return {
    relationshipState: outstanding ? 'payment due' : hasActHistory ? (latestActContact && Date.now() - Date.parse(latestActContact) < 180 * 86_400_000 ? 'warm' : 'known') : null,
    lastContactAt: latestActContact,
    nextMove,
    sections: cleanSections([
      connectionSection('history', 'ACT history', actHistory),
      connectionSection('people', record.type === 'person' ? 'ACT contacts' : 'People', peopleItems),
      connectionSection('money-network', 'Funding and procurement', moneyItems),
      connectionSection('organisations', record.type === 'person' ? 'Connected organisations' : 'Wider network', organisationItems),
    ]),
    unknowns: [
      ...(!hasActHistory ? ['No direct ACT contact, conversation or invoice is linked to this record yet.'] : []),
      ...(networkItems.length === 0 ? ['No CivicGraph network relationship is linked to this entity yet.'] : []),
      ...(record.type === 'organisation' && peopleItems.length === 0 ? ['No named person is connected to this organisation.'] : []),
      ...(record.type === 'organisation' && peopleItems.length > 0 ? ['A named ACT contact is not evidence of authority, consent or permission to approach for this place.'] : []),
    ],
  };
}

function buildCommunityContext(
  record: ActAtlasRecord,
  slug: string,
  buyers: BuyerRow[],
  locals: LocalEntityRow[],
  signals: SignalRow[],
): ActAtlasContext {
  const buyerItems: ActAtlasConnection[] = buyers.map((row) => ({
    id: row.id,
    kind: 'organisation',
    name: row.entity_name,
    detail: [humanise(row.buyer_role), humanise(row.relationship_status), row.ghl_stage_name].filter(Boolean).join(' · ') || 'Mapped procurement organisation',
    meta: row.next_action || (Number(row.govt_contract_value ?? 0) > 0 ? `${money(row.govt_contract_value)} public contracts` : null),
    href: row.gs_id ? `/entities/${row.gs_id}` : null,
    sourceLabel: 'Goods procurement map',
  }));
  const localItems: ActAtlasConnection[] = locals
    .sort((left, right) => Number(right.is_community_controlled) - Number(left.is_community_controlled))
    .map((row) => ({
      id: row.id,
      kind: 'organisation',
      name: row.canonical_name,
      detail: [row.is_community_controlled ? 'Community controlled' : null, humanise(row.entity_type), row.sector].filter(Boolean).join(' · '),
      meta: row.postcode ? `Postcode ${row.postcode}` : null,
      href: `/entities/${row.gs_id}`,
      sourceLabel: 'CivicGraph entity index',
    }));
  const signalItems: ActAtlasConnection[] = signals.map((row) => ({
    id: row.id,
    kind: 'opportunity',
    name: row.title,
    detail: [humanise(row.priority), humanise(row.status), Number(row.estimated_value ?? 0) > 0 ? money(row.estimated_value) : null].filter(Boolean).join(' · '),
    meta: row.action_notes || `Recorded ${dateLabel(row.created_at) ?? 'date unknown'}`,
    href: `/org/${slug}/goods/signals`,
    sourceLabel: 'Goods signal registry',
  }));
  const firstBuyerAction = buyers.find((row) => row.next_action)?.next_action;
  const firstBuyer = buyers[0];
  const firstSignal = signals.find((row) => row.status !== 'closed');
  const nextTitle = firstBuyerAction || (firstBuyer ? `Reconnect with ${firstBuyer.entity_name}` : firstSignal?.title || 'Complete the community relationship map');
  const nextDetail = firstBuyerAction
    ? `Recorded against ${buyers.find((row) => row.next_action)?.entity_name}.`
    : firstBuyer
      ? 'Confirm the useful person, procurement timing and next Goods need.'
      : firstSignal
        ? 'Review the evidence and decide whether this belongs in the active Goods pipeline.'
        : 'Add the organisations and people ACT already knows before starting new outreach.';

  return {
    relationshipState: firstBuyer?.relationship_status ?? record.tags[0] ?? null,
    lastContactAt: buyers.map((row) => row.last_contact_date).filter((value): value is string => Boolean(value)).sort().reverse()[0] ?? null,
    nextMove: { title: nextTitle, detail: nextDetail, href: record.href },
    sections: cleanSections([
      connectionSection('buyers', 'Buyers and delivery partners', buyerItems),
      connectionSection('local', record.postcode ? `Organisations in postcode ${record.postcode}` : 'Nearby organisations', localItems),
      connectionSection('signals', 'Procurement and funding signals', signalItems),
    ]),
    unknowns: [
      ...(buyers.length === 0 ? ['No buyer or delivery-partner relationship is linked to this community yet.'] : []),
      ...(locals.length === 0 ? ['No local organisation is linked through the community postcode yet.'] : []),
      ...(signals.length === 0 ? ['No active procurement or funding signal is recorded for this community.'] : []),
    ],
  };
}

function buildFunderContext(
  record: ActAtlasRecord,
  slug: string,
  people: FoundationPersonRow[],
  grantees: GranteeRow[],
  programs: ProgramRow[],
  portfolio: PortfolioRow[],
  snapshots: SnapshotRow[],
  signals: RelationshipSignalRow[],
): ActAtlasContext {
  const snapshot = snapshots.sort((left, right) => String(right.refreshed_at).localeCompare(String(left.refreshed_at)))[0];
  const projectItems: ActAtlasConnection[] = portfolio.map((row) => {
    const project = projectFromPortfolio(row);
    return {
      id: row.id,
      kind: 'project',
      name: project?.name || 'ACT project',
      detail: [humanise(row.engagement_status), humanise(row.stage)].filter(Boolean).join(' · '),
      meta: row.next_step || (row.next_touch_at ? `Next touch ${dateLabel(row.next_touch_at)}` : null),
      href: project?.slug ? `/org/${slug}/${project.slug}` : `/org/${slug}?view=relationships#relationships`,
      sourceLabel: 'ACT funder portfolio',
    };
  });
  if (snapshot && Number(snapshot.email_count ?? 0) > 0) {
    projectItems.push({
      id: `email-${record.id}`,
      kind: 'activity',
      name: `${Number(snapshot.email_count).toLocaleString('en-AU')} email messages`,
      detail: snapshot.email_summary || 'Email context has been linked to this funder.',
      meta: snapshot.email_last_date ? `Latest ${dateLabel(snapshot.email_last_date)}` : null,
      href: `/org/${slug}?view=relationships#relationships`,
      sourceLabel: 'Gmail context snapshot',
    });
  }
  if (snapshot && Number(snapshot.xero_invoiced_total ?? 0) > 0) {
    projectItems.push({
      id: `xero-${record.id}`,
      kind: 'activity',
      name: `${money(snapshot.xero_paid_total)} paid to ACT`,
      detail: `${money(snapshot.xero_invoiced_total)} invoiced across linked Xero history.`,
      meta: snapshot.xero_last_payment_date ? `Last payment ${dateLabel(snapshot.xero_last_payment_date)}` : null,
      href: `/org/${slug}?view=money#money`,
      sourceLabel: 'Xero context snapshot',
    });
  }

  const seenContactIdentities = new Set<string>();
  const directContacts: ActAtlasConnection[] = (snapshot?.contacts ?? [])
    .filter((contact) => {
      const identity = (contact.email?.trim() || contact.name?.trim() || '').toLocaleLowerCase('en-AU');
      if (!identity || seenContactIdentities.has(identity)) return false;
      seenContactIdentities.add(identity);
      return true;
    })
    .map((contact, index) => ({
      id: `contact-${record.id}-${index}`,
      kind: 'person',
      name: contact.name?.trim() || contact.email || 'Known contact',
      detail: contact.email || 'Contact detail held in ACT context',
      meta: contact.last_contact_date ? `Last contact ${dateLabel(contact.last_contact_date)}` : null,
      href: `/org/${slug}?view=relationships#relationships`,
      sourceLabel: 'ACT contact context',
    }));
  const seenPeople = new Set(directContacts.map((contact) => contact.name.toLocaleLowerCase('en-AU')));
  const researchPeople: ActAtlasConnection[] = people
    .filter((row) => !seenPeople.has(row.person_name.toLocaleLowerCase('en-AU')))
    .map((row) => ({
      id: row.id,
      kind: 'person',
      name: row.person_name,
      detail: row.role_title || humanise(row.role_type) || 'Named in foundation evidence',
      meta: row.confidence ? `${humanise(row.confidence)} confidence` : null,
      href: row.source_document_url || row.source_url,
      sourceLabel: 'Foundation people evidence',
    }));
  const granteeItems: ActAtlasConnection[] = grantees.map((row) => ({
    id: row.id,
    kind: 'organisation',
    name: row.grantee_name,
    detail: [row.program_name, row.grant_year ? String(row.grant_year) : null, Number(row.grant_amount ?? 0) > 0 ? money(row.grant_amount) : null].filter(Boolean).join(' · '),
    meta: row.confidence ? `${humanise(row.confidence)} confidence` : null,
    href: row.source_document_url || row.source_url,
    sourceLabel: 'Foundation grant evidence',
  }));
  const programItems: ActAtlasConnection[] = programs.map((row) => ({
    id: row.id,
    kind: 'opportunity',
    name: row.name,
    detail: [humanise(row.status), row.amount_max ? `Up to ${money(row.amount_max)}` : null, row.deadline ? `Closes ${dateLabel(row.deadline)}` : null].filter(Boolean).join(' · '),
    meta: row.application_mode ? humanise(row.application_mode) : null,
    href: row.url,
    sourceLabel: 'Foundation program evidence',
  }));
  const pathItems: ActAtlasConnection[] = signals.map((row) => ({
    id: row.id,
    kind: row.person_name ? 'person' : 'organisation',
    name: row.person_name || row.related_name || humanise(row.signal_type),
    detail: row.evidence_text,
    meta: row.confidence ? `${humanise(row.confidence)} confidence` : null,
    href: row.source_url,
    sourceLabel: 'Foundation relationship signal',
  }));

  const activePortfolio = portfolio.find((row) => row.next_step) ?? portfolio[0];
  const firstContact = directContacts[0];
  const firstOpenProgram = programs.find((row) => ['open', 'ongoing'].includes(row.status ?? ''));
  const nextMove = activePortfolio
    ? {
        title: activePortfolio.next_step || `Review the ${projectFromPortfolio(activePortfolio)?.name || 'ACT'} relationship`,
        detail: followUpDetail(activePortfolio.next_touch_at),
        href: `/org/${slug}?view=relationships#relationships`,
      }
    : firstContact
      ? {
          title: `Reconnect with ${firstContact.name}`,
          detail: 'Start from the existing ACT contact and email history, then record the result.',
          href: `/org/${slug}?view=relationships#relationships`,
        }
      : firstOpenProgram
        ? {
            title: `Review ${firstOpenProgram.name}`,
            detail: 'Confirm ACT eligibility and identify a useful relationship path before applying.',
            href: firstOpenProgram.url || record.href,
          }
        : {
            title: 'Establish a useful relationship path',
            detail: 'Confirm a named person, recent grantees and a relevant ACT project before outreach.',
            href: record.href,
          };

  return {
    relationshipState: activePortfolio?.engagement_status ?? (firstContact ? 'known' : null),
    lastContactAt: newestDate([snapshot?.most_recent_contact_at, snapshot?.email_last_date, activePortfolio?.last_interaction_at]),
    nextMove,
    sections: cleanSections([
      connectionSection('history', 'ACT history', projectItems),
      connectionSection('people', 'People', [...directContacts, ...researchPeople]),
      connectionSection('grantees', 'Who they fund', granteeItems),
      connectionSection('programs', 'Programs and application paths', programItems),
      connectionSection('paths', 'Possible warm paths', pathItems),
    ]),
    unknowns: [
      ...(portfolio.length === 0 ? ['This funder is not linked to an ACT project portfolio yet.'] : []),
      ...(directContacts.length === 0 ? ['No direct ACT contact is verified for this funder.'] : []),
      ...(grantees.length === 0 ? ['No grantee history has been extracted for this funder.'] : []),
      ...(programs.length === 0 ? ['No current program or application path is recorded.'] : []),
    ],
  };
}

function projectFoundation(row: ProjectFoundationRow): { id: string; name: string; total_giving_annual: number | string | null } | null {
  if (Array.isArray(row.foundation)) return row.foundation[0] ?? null;
  return row.foundation;
}

function compactEvidence(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const items = value.map((item) => compactEvidence(item)).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(' · ').slice(0, 280) : null;
  }
  if (typeof value === 'object') {
    const items = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const detail = compactEvidence(item);
        return detail ? `${humanise(key)}: ${detail}` : null;
      })
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(' · ').slice(0, 280) : null;
  }
  return String(value);
}

function buildProjectContext(
  record: ActAtlasRecord,
  slug: string,
  pipeline: ProjectPipelineRow[],
  foundations: ProjectFoundationRow[],
  contacts: ProjectContactRow[],
  moneyState: ProjectMoneyRow | null,
  recommendations: ProjectRecommendationRow[],
  intelligence: ProjectIntelligenceRow | null,
  communities: GoodsCommunityRow[],
): ActAtlasContext {
  const pipelineItems: ActAtlasConnection[] = pipeline
    .sort((left, right) => {
      const rank = (status: string) => ({ submitted: 0, active: 1, applying: 1, prospect: 2, passed: 4, declined: 5 }[status] ?? 3);
      return rank(left.status) - rank(right.status) || String(left.deadline ?? '9999').localeCompare(String(right.deadline ?? '9999'));
    })
    .map((row) => ({
      id: row.id,
      kind: 'opportunity',
      name: row.name,
      detail: [humanise(row.status), row.funder, Number(row.amount_numeric ?? 0) > 0 ? money(row.amount_numeric) : row.amount_display].filter(Boolean).join(' · '),
      meta: row.next_action || [row.deadline ? `Deadline ${dateLabel(row.deadline) || row.deadline}` : null, row.owner_name ? `Owner ${row.owner_name}` : 'No owner'].filter(Boolean).join(' · '),
      href: row.grant_opportunity_id ? `/grants/${row.grant_opportunity_id}` : `/org/${slug}?view=opportunities#opportunities`,
      sourceLabel: 'ACT opportunity pipeline',
    }));
  const foundationItems: ActAtlasConnection[] = foundations.map((row) => {
    const foundation = projectFoundation(row);
    return {
      id: row.id,
      kind: 'funder',
      name: foundation?.name || 'Linked funder',
      detail: [humanise(row.engagement_status), humanise(row.stage), row.fit_score ? `${row.fit_score}% fit` : null].filter(Boolean).join(' · '),
      meta: row.next_step || (row.next_touch_at ? `Next touch ${dateLabel(row.next_touch_at)}` : row.fit_summary),
      href: foundation ? `/foundations/${foundation.id}` : `/org/${slug}?view=relationships#relationships`,
      sourceLabel: 'ACT project funder portfolio',
    };
  });
  const peopleItems: ActAtlasConnection[] = contacts.map((row) => ({
    id: row.id,
    kind: 'person',
    name: row.name,
    detail: [row.role, row.organisation, row.email].filter(Boolean).join(' · ') || 'Known project contact',
    meta: row.engagement_ask || (row.last_contacted_at ? `Last contact ${dateLabel(row.last_contacted_at)}` : null),
    href: `/org/${slug}?view=relationships#relationships`,
    sourceLabel: 'ACT project contacts',
  }));
  const moneyItems: ActAtlasConnection[] = moneyState ? [{
    id: `money-${record.id}`,
    kind: 'activity',
    name: `${money(moneyState.income_fy)} income · ${money(moneyState.expenses_fy)} costs`,
    detail: `${money(moneyState.receivables)} receivable · ${money(moneyState.pipeline_weighted)} weighted pipeline`,
    meta: `${money(moneyState.pipeline_raw)} raw pipeline${moneyState.last_transaction_at ? ` · latest transaction ${dateLabel(moneyState.last_transaction_at)}` : ''}`,
    href: `/org/${slug}?view=money#money`,
    sourceLabel: 'ACT project money state',
  }] : [];
  const recommendationItems: ActAtlasConnection[] = recommendations.map((row) => ({
    id: `${row.project_code}-${row.opportunity_id}`,
    kind: 'opportunity',
    name: row.opportunity_name,
    detail: [row.funder_name, row.fit_score ? `${row.fit_score}% fit` : null, Number(row.max_grant_amount ?? 0) > 0 ? `Up to ${money(row.max_grant_amount)}` : null].filter(Boolean).join(' · '),
    meta: [row.deadline ? `Closes ${dateLabel(row.deadline)}` : null, row.verification_status ? humanise(row.verification_status) : null].filter(Boolean).join(' · ') || compactEvidence(row.flags),
    href: row.application_url || row.source_url || `/grants/${row.opportunity_id}`,
    sourceLabel: 'ACT grant recommendation model',
  }));
  const communityItems: ActAtlasConnection[] = communities.map((row) => ({
    id: row.id,
    kind: 'organisation',
    name: row.community_name,
    detail: [row.state, humanise(row.priority), `${Number(row.demand_beds ?? 0) + Number(row.demand_washers ?? 0)} recorded goods needed`].filter(Boolean).join(' · '),
    meta: `${Number(row.assets_deployed ?? 0)} assets deployed · ${Number(row.buyer_entity_count ?? 0)} mapped buyers`,
    href: `/org/${slug}/goods/community/${row.id}`,
    sourceLabel: 'Goods community evidence',
  }));
  const intelligenceItems: ActAtlasConnection[] = intelligence ? [{
    id: `brief-${record.id}`,
    kind: 'activity',
    name: intelligence.current_state || 'Project intelligence brief',
    detail: intelligence.opportunity_alignment || compactEvidence(intelligence.evidence_we_have) || 'Project evidence is recorded.',
    meta: [humanise(intelligence.readiness), intelligence.next_question].filter(Boolean).join(' · ') || null,
    href: record.href,
    sourceLabel: 'ACT project recommendation brief',
  }] : [];

  const actionable = pipeline.find((row) => row.next_action);
  const submitted = pipeline.find((row) => row.status === 'submitted');
  const activeFoundation = foundations.find((row) => row.next_step);
  const recommended = recommendations[0];
  const nextMove = actionable
    ? { title: actionable.next_action as string, detail: actionable.next_action_at ? followUpDetail(actionable.next_action_at) : `${actionable.name} is already in the ACT pipeline.`, href: `/org/${slug}?view=opportunities#opportunities` }
    : submitted
      ? { title: `Record the outcome and follow-up for ${submitted.name}`, detail: `${money(submitted.amount_numeric)} is marked submitted but has no owner or next action.`, href: `/org/${slug}?view=opportunities#opportunities` }
      : activeFoundation
        ? { title: activeFoundation.next_step as string, detail: followUpDetail(activeFoundation.next_touch_at), href: `/org/${slug}?view=relationships#relationships` }
        : intelligence?.next_question
          ? { title: intelligence.next_question, detail: 'Resolve this project question before expanding the opportunity list.', href: record.href }
          : recommended
            ? { title: `Decide whether to pursue ${recommended.opportunity_name}`, detail: 'Confirm eligibility, owner and relationship path before moving it into the active pipeline.', href: recommended.application_url || recommended.source_url || `/grants/${recommended.opportunity_id}` }
            : { title: 'Choose one owned growth action', detail: 'Link one funder or buyer, one owner and one due date to this project.', href: `/org/${slug}?view=opportunities#opportunities` };

  return {
    relationshipState: humanise(record.facts.find((fact) => fact.label === 'Status')?.value || intelligence?.readiness || 'active'),
    lastContactAt: newestDate([
      ...contacts.map((row) => row.last_contacted_at),
      ...foundations.map((row) => row.last_interaction_at),
      ...pipeline.map((row) => row.updated_at),
      moneyState?.last_opp_update_at,
    ]),
    nextMove,
    sections: cleanSections([
      connectionSection('pipeline', 'Pipeline', pipelineItems),
      connectionSection('funders', 'Funders', foundationItems),
      connectionSection('people', 'People', peopleItems),
      connectionSection('money', 'Money', moneyItems),
      connectionSection('communities', 'Communities', communityItems),
      connectionSection('recommendations', 'Recommended opportunities', recommendationItems),
      connectionSection('brief', 'Project brief', intelligenceItems),
    ]),
    unknowns: [
      ...(pipeline.length === 0 ? ['No opportunity is linked to this project pipeline.'] : []),
      ...(pipeline.some((row) => !row.owner_name && !['passed', 'declined'].includes(row.status)) ? ['At least one live opportunity has no owner.'] : []),
      ...(pipeline.some((row) => !row.next_action && !['passed', 'declined'].includes(row.status)) ? ['At least one live opportunity has no next action.'] : []),
      ...(foundations.length === 0 ? ['No philanthropic relationship is linked to this project.'] : []),
      ...(contacts.length === 0 ? ['No named person is linked directly to this project.'] : []),
      ...(!moneyState ? ['No project-level money state is available.'] : []),
    ],
  };
}

function buildOpportunityContext(
  record: ActAtlasRecord,
  slug: string,
  detail: OpportunityDetailRow | null,
  pipeline: ProjectPipelineRow[],
  decisions: OpportunityDecisionRow[],
  recommendationDecisions: RecommendationDecisionRow[],
): ActAtlasContext {
  const pipelineItems: ActAtlasConnection[] = pipeline.map((row) => ({
    id: row.id,
    kind: 'project',
    name: row.project_code || 'ACT project',
    detail: [humanise(row.status), row.funder, Number(row.amount_numeric ?? 0) > 0 ? money(row.amount_numeric) : null].filter(Boolean).join(' · '),
    meta: row.next_action || [row.owner_name ? `Owner ${row.owner_name}` : 'No owner', row.deadline ? `Deadline ${dateLabel(row.deadline) || row.deadline}` : null].filter(Boolean).join(' · '),
    href: `/org/${slug}?view=opportunities#opportunities`,
    sourceLabel: 'ACT opportunity pipeline',
  }));
  const projectCodes = [...new Set([
    ...pipeline.map((row) => row.project_code),
    ...(detail?.aligned_projects ?? []),
    ...decisions.map((row) => row.project_code),
    ...recommendationDecisions.map((row) => row.project_code),
  ].filter((value): value is string => Boolean(value)))];
  const projectItems: ActAtlasConnection[] = projectCodes.map((projectCode) => ({
    id: `${record.id}-${projectCode}`,
    kind: 'project',
    name: projectCode,
    detail: pipeline.some((row) => row.project_code === projectCode) ? 'Linked to the ACT pipeline' : 'Matched by ACT project intelligence',
    meta: decisions.find((row) => row.project_code === projectCode)?.reason || null,
    href: `/org/${slug}/explore?q=${encodeURIComponent(projectCode)}&type=project`,
    sourceLabel: 'ACT project alignment',
  }));
  const decisionItems: ActAtlasConnection[] = [
    ...decisions.map((row): ActAtlasConnection => ({
      id: row.id,
      kind: 'activity',
      name: `${row.project_code} · ${humanise(row.decision)}`,
      detail: row.reason || row.notes || row.outcome || 'Decision recorded without a reason.',
      meta: [dateLabel(row.created_at), compactEvidence(row.evidence_gaps)].filter(Boolean).join(' · ') || null,
      href: `/org/${slug}?view=opportunities#opportunities`,
      sourceLabel: 'ACT opportunity decision',
    })),
    ...recommendationDecisions.map((row): ActAtlasConnection => ({
      id: row.id,
      kind: 'activity',
      name: `${row.project_code} · ${humanise(row.decision)}`,
      detail: row.notes || 'Recommendation decision recorded.',
      meta: null,
      href: `/org/${slug}?view=opportunities#opportunities`,
      sourceLabel: 'ACT recommendation decision',
    })),
  ];
  const requirementItems: ActAtlasConnection[] = [];
  if (detail?.requirements_summary || detail?.requirements) {
    requirementItems.push({ id: `requirements-${record.id}`, kind: 'activity', name: 'Application requirements', detail: detail.requirements_summary || detail.requirements || '', meta: null, href: detail.url || record.href, sourceLabel: 'Grant opportunity evidence' });
  }
  const eligibility = compactEvidence(detail?.eligibility_criteria);
  if (eligibility) {
    requirementItems.push({ id: `eligibility-${record.id}`, kind: 'activity', name: 'Eligibility', detail: eligibility, meta: [detail?.dgr_required ? 'DGR required' : null, detail?.accepts_sole_trader ? 'Sole trader accepted' : null, detail?.accepts_pty_ltd ? 'Pty Ltd accepted' : null, detail?.accepts_charity ? 'Charity accepted' : null].filter(Boolean).join(' · ') || null, href: detail?.url || record.href, sourceLabel: 'Grant opportunity eligibility' });
  }
  const assessment = compactEvidence(detail?.assessment_criteria);
  if (assessment) {
    requirementItems.push({ id: `assessment-${record.id}`, kind: 'activity', name: 'Assessment criteria', detail: assessment, meta: null, href: detail?.url || record.href, sourceLabel: 'Grant opportunity assessment' });
  }
  const funderItems: ActAtlasConnection[] = detail?.provider ? [{
    id: detail.foundation_id || `provider-${record.id}`,
    kind: 'funder',
    name: detail.provider,
    detail: [detail.foundation_id ? 'Linked foundation profile' : 'Opportunity provider', detail.last_verified_at ? `Verified ${dateLabel(detail.last_verified_at)}` : null].filter(Boolean).join(' · '),
    meta: null,
    href: detail.foundation_id ? `/foundations/${detail.foundation_id}` : detail.url || record.href,
    sourceLabel: 'Grant opportunity provider',
  }] : [];

  const active = pipeline.find((row) => !['passed', 'declined'].includes(row.status));
  const submitted = pipeline.find((row) => row.status === 'submitted');
  const explicitAction = pipeline.find((row) => row.next_action);
  const closingAt = detail?.closes_at || detail?.deadline;
  const closed = Boolean(closingAt && !Number.isNaN(Date.parse(closingAt)) && Date.parse(closingAt) < Date.now());
  const nextMove = explicitAction
    ? { title: explicitAction.next_action as string, detail: explicitAction.next_action_at ? followUpDetail(explicitAction.next_action_at) : 'This action is already recorded in the ACT pipeline.', href: `/org/${slug}?view=opportunities#opportunities` }
    : submitted
      ? { title: `Record the outcome for ${record.name}`, detail: `${submitted.project_code || 'The ACT project'} is submitted, but the result and next relationship step are not recorded.`, href: `/org/${slug}?view=opportunities#opportunities` }
      : active
        ? { title: `Assign an owner and next action for ${record.name}`, detail: `${active.project_code || 'The ACT project'} is in the ${humanise(active.status)} stage without a concrete owner-led action.`, href: `/org/${slug}?view=opportunities#opportunities` }
        : closed
          ? { title: 'Verify the result or close this opportunity', detail: `The recorded deadline was ${dateLabel(closingAt) || closingAt}; preserve any learning before removing it from attention.`, href: `/org/${slug}?view=opportunities#opportunities` }
          : { title: `Make a go, partner or pass decision`, detail: 'Confirm project fit, eligibility, owner and relationship path before investing application effort.', href: `/org/${slug}?view=opportunities#opportunities` };

  return {
    relationshipState: active?.status || detail?.pipeline_stage || detail?.status || (closed ? 'deadline passed' : null),
    lastContactAt: newestDate([
      ...pipeline.map((row) => row.updated_at),
      ...decisions.map((row) => row.created_at),
      detail?.last_verified_at,
    ]),
    nextMove,
    sections: cleanSections([
      connectionSection('act-pipeline', 'ACT pipeline', pipelineItems),
      connectionSection('project-fit', 'Project fit', projectItems),
      connectionSection('funder', 'Funder', funderItems),
      connectionSection('decisions', 'Decision history', decisionItems),
      connectionSection('requirements', 'Requirements', requirementItems),
    ]),
    unknowns: [
      ...(pipeline.length === 0 ? ['This opportunity is not in the ACT pipeline.'] : []),
      ...(active && !active.owner_name ? ['The active pipeline item has no owner.'] : []),
      ...(active && !active.next_action ? ['The active pipeline item has no next action.'] : []),
      ...(!detail?.requirements_summary && !detail?.requirements ? ['Application requirements have not been extracted.'] : []),
      ...(!detail?.eligibility_criteria ? ['Eligibility evidence has not been structured.'] : []),
      ...(!detail?.last_verified_at ? ['The source has no recent verification date.'] : []),
    ],
  };
}

export async function enrichActAtlasRecords(
  db: SupabaseClient,
  records: ActAtlasRecord[],
  { orgProfileId, slug }: { orgProfileId: string; slug: string },
): Promise<ActAtlasRecord[]> {
  const communities = records.filter((record) => record.type === 'community');
  const funders = records.filter((record) => record.type === 'funder');
  const entities = records.filter((record) => (record.type === 'person' || record.type === 'organisation') && record.entityId);
  const projects = records.filter((record) => record.type === 'project');
  const opportunities = records.filter((record) => record.type === 'opportunity');
  if (communities.length === 0 && funders.length === 0 && entities.length === 0 && projects.length === 0 && opportunities.length === 0) return records;

  const communityIds = communities.map((record) => record.id);
  const postcodes = [...new Set(communities.map((record) => record.postcode).filter((value): value is string => Boolean(value)))];
  const funderIds = funders.map((record) => record.id);
  const entityIds = entities.map((record) => record.entityId as string);
  const organisationNames = entities.filter((record) => record.type === 'organisation').map((record) => record.name);
  const personNames = entities.filter((record) => record.type === 'person').map((record) => record.name);
  const projectIds = projects.map((record) => record.id);
  const projectCodes = [...new Set(projects.map((record) => record.facts.find((fact) => fact.label === 'Project code')?.value).filter((value): value is string => Boolean(value && value !== 'None')))];
  const opportunityIds = opportunities.map((record) => record.id);
  const opportunityPipelineItemIds = opportunities.map((record) => record.pipelineItemId).filter((value): value is string => Boolean(value));
  const includesGoods = projectCodes.includes('ACT-GD');

  const [
    buyersResult,
    localResult,
    communitySignalsResult,
    peopleResult,
    granteesResult,
    programsResult,
    portfolioResult,
    snapshotsResult,
    relationshipSignalsResult,
    sourceRelationshipsResult,
    targetRelationshipsResult,
    orgContactsResult,
    contactEntityLinksResult,
    organisationEventsResult,
    personEventsResult,
    organisationGhlResult,
    personGhlResult,
    invoicesResult,
    projectPipelineResult,
    projectFoundationsResult,
    projectContactsResult,
    projectMoneyResult,
    projectRecommendationsResult,
    projectIntelligenceResult,
    goodsCommunitiesResult,
    opportunityDetailsResult,
    opportunityPipelineResult,
    opportunityPipelineItemsResult,
    opportunityDecisionsResult,
    recommendationDecisionsResult,
  ] = await Promise.all([
    communityIds.length > 0
      ? db.from('goods_procurement_entities').select('id, community_id, gs_id, entity_name, buyer_role, relationship_status, next_action, last_contact_date, govt_contract_value, is_community_controlled, ghl_stage_name').in('community_id', communityIds).order('govt_contract_value', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    postcodes.length > 0
      ? db.from('gs_entities').select('id, gs_id, canonical_name, entity_type, sector, postcode, is_community_controlled').in('postcode', postcodes).in('entity_type', ['indigenous_corp', 'charity', 'government_body', 'social_enterprise']).order('is_community_controlled', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    communityIds.length > 0
      ? db.from('goods_procurement_signals').select('id, community_id, title, priority, status, estimated_value, action_notes, created_at').in('community_id', communityIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('foundation_people').select('id, foundation_id, person_name, role_title, role_type, confidence, source_url, source_document_url').in('foundation_id', funderIds).order('extracted_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('foundation_grantees').select('id, foundation_id, grantee_name, grant_amount, grant_year, program_name, source_url, source_document_url, confidence').in('foundation_id', funderIds).order('grant_year', { ascending: false, nullsFirst: false }).order('grant_amount', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('foundation_programs').select('id, foundation_id, name, status, deadline, amount_max, application_mode, url').in('foundation_id', funderIds).order('deadline', { ascending: true, nullsFirst: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('org_project_foundations').select('id, foundation_id, stage, engagement_status, next_step, next_touch_at, last_interaction_at, project:org_projects(id, name, slug, code)').eq('org_profile_id', orgProfileId).in('foundation_id', funderIds).order('updated_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('funder_context_snapshot').select('foundation_id, contacts_count, contacts, most_recent_contact_at, email_count, email_last_date, email_summary, xero_invoiced_total, xero_paid_total, xero_last_payment_date, refreshed_at').in('foundation_id', funderIds).order('refreshed_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    funderIds.length > 0
      ? db.from('foundation_relationship_signals').select('id, foundation_id, signal_type, related_name, person_name, evidence_text, confidence, source_url').in('foundation_id', funderIds).order('strength', { ascending: false, nullsFirst: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0
      ? db.from('gs_relationships').select('id, source_entity_id, target_entity_id, relationship_type, amount, currency, year, dataset, source_url, confidence').in('source_entity_id', entityIds).order('amount', { ascending: false, nullsFirst: false }).limit(600)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0
      ? db.from('gs_relationships').select('id, source_entity_id, target_entity_id, relationship_type, amount, currency, year, dataset, source_url, confidence').in('target_entity_id', entityIds).order('amount', { ascending: false, nullsFirst: false }).limit(600)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0
      ? db.from('org_contacts').select('id, linked_entity_id, name, email, role, organisation, last_contacted_at').eq('org_profile_id', orgProfileId).in('linked_entity_id', entityIds).order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0
      ? db.from('contact_entity_links').select('contact_id, entity_id, confidence_score, verified').in('entity_id', entityIds).gte('confidence_score', 0.8).order('verified', { ascending: false }).order('confidence_score', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0
      ? db.from('opportunity_context_events').select('id, source_system, organisation, actor_name, actor_email, title, summary, happened_at, signal_kind').eq('org_profile_id', orgProfileId).order('happened_at', { ascending: false, nullsFirst: false }).limit(1_000)
      : Promise.resolve({ data: [], error: null }),
    Promise.resolve({ data: [], error: null }),
    organisationNames.length > 0
      ? db.from('ghl_contacts').select('id, full_name, email, company_name, last_contact_date').in('company_name', organisationNames).order('last_contact_date', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    personNames.length > 0
      ? db.from('ghl_contacts').select('id, full_name, email, company_name, last_contact_date').in('full_name', personNames).order('last_contact_date', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    organisationNames.length > 0
      ? db.from('xero_invoices').select('id, invoice_number, contact_name, type, status, date, due_date, fully_paid_date, total, amount_paid, amount_due, project_code, reference').eq('type', 'ACCREC').order('date', { ascending: false, nullsFirst: false }).limit(1_000)
      : Promise.resolve({ data: [], error: null }),
    projectCodes.length > 0
      ? db.from('org_pipeline').select('id, project_id, project_code, name, amount_numeric, amount_display, funder, deadline, status, grant_opportunity_id, owner_name, next_action, next_action_at, updated_at').eq('org_profile_id', orgProfileId).in('project_code', projectCodes).order('updated_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? db.from('org_project_foundations').select('id, org_project_id, foundation_id, stage, fit_score, fit_summary, engagement_status, next_step, next_touch_at, last_interaction_at, foundation:foundations(id, name, total_giving_annual)').eq('org_profile_id', orgProfileId).in('org_project_id', projectIds).order('updated_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? db.from('org_contacts').select('id, project_id, name, role, organisation, email, engagement_ask, last_contacted_at').eq('org_profile_id', orgProfileId).in('project_id', projectIds).order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    projectCodes.length > 0
      ? db.from('v_project_money_state').select('project_code, income_fy, expenses_fy, net_fy, receivables, pipeline_weighted, pipeline_raw, grants_in_flight, grants_in_flight_count, last_transaction_at, last_opp_update_at').in('project_code', projectCodes)
      : Promise.resolve({ data: [], error: null }),
    projectCodes.length > 0
      ? db.from('act_grant_recommendations').select('project_code, opportunity_id, opportunity_name, funder_name, deadline, max_grant_amount, fit_score, flags, application_url, source_url, verification_status').in('project_code', projectCodes).eq('is_strong_fit', true).order('fit_score', { ascending: false }).limit(120)
      : Promise.resolve({ data: [], error: null }),
    projectCodes.length > 0
      ? db.from('act_grant_recommendation_projects').select('project_code, project_label, readiness, current_state, opportunity_alignment, next_question, evidence_we_have').in('project_code', projectCodes)
      : Promise.resolve({ data: [], error: null }),
    includesGoods
      ? db.from('goods_communities').select('id, community_name, state, priority, demand_beds, demand_washers, assets_deployed, buyer_entity_count').in('priority', ['active', 'lead', 'warm']).order('assets_deployed', { ascending: false, nullsFirst: false }).limit(8)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length > 0
      ? db.from('grant_opportunities').select('id, name, provider, foundation_id, amount_min, amount_max, deadline, closes_at, status, pipeline_stage, aligned_projects, requirements, requirements_summary, eligibility_criteria, assessment_criteria, dgr_required, accepts_sole_trader, accepts_pty_ltd, accepts_charity, url, last_verified_at, updated_at').in('id', opportunityIds)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length > 0
      ? db.from('org_pipeline').select('id, project_id, project_code, name, amount_numeric, amount_display, funder, deadline, status, grant_opportunity_id, owner_name, next_action, next_action_at, updated_at').eq('org_profile_id', orgProfileId).in('grant_opportunity_id', opportunityIds).order('updated_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    opportunityPipelineItemIds.length > 0
      ? db.from('org_pipeline').select('id, project_id, project_code, name, amount_numeric, amount_display, funder, deadline, status, grant_opportunity_id, owner_name, next_action, next_action_at, updated_at').eq('org_profile_id', orgProfileId).in('id', opportunityPipelineItemIds).order('updated_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length > 0
      ? db.from('opportunity_decisions').select('id, source_ref, project_code, decision, reason, notes, evidence_gaps, outcome, created_at').eq('org_profile_id', orgProfileId).in('source_ref', opportunityIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    opportunityIds.length > 0
      ? db.from('act_grant_recommendation_decisions').select('id, project_code, grant_opportunity_id, decision, notes').in('grant_opportunity_id', opportunityIds).limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relationshipRows = uniqueBy([
    ...((sourceRelationshipsResult.data || []) as EntityRelationshipRow[]),
    ...((targetRelationshipsResult.data || []) as EntityRelationshipRow[]),
  ], (row) => row.id);
  const selectedEntityIds = new Set(entityIds);
  const counterpartIds = [...new Set(relationshipRows.flatMap((row) => [row.source_entity_id, row.target_entity_id]).filter((id) => !selectedEntityIds.has(id)))];
  const counterpartResults = await Promise.all(chunks(counterpartIds, 100).map((ids) => (
    db.from('gs_entities').select('id, gs_id, canonical_name, entity_type, state, is_community_controlled').in('id', ids)
  )));
  const counterpartRows = counterpartResults.flatMap((result) => (result.data || []) as CounterpartEntityRow[]);
  const contactEntityLinkRows = (contactEntityLinksResult.data || []) as ContactEntityLinkRow[];
  const linkedGhlContactIds = [...new Set(contactEntityLinkRows.map((row) => row.contact_id).filter(Boolean))];
  const linkedGhlResults = await Promise.all(chunks(linkedGhlContactIds, 100).map((ids) => (
    db.from('ghl_contacts').select('id, full_name, email, company_name, last_contact_date').in('id', ids)
  )));
  const linkedGhlRows = linkedGhlResults.flatMap((result) => (result.data || []) as GhlContactRow[]);

  const buyersByCommunity = grouped((buyersResult.data || []) as BuyerRow[], 'community_id');
  const localsByPostcode = grouped((localResult.data || []) as LocalEntityRow[], 'postcode');
  const signalsByCommunity = grouped((communitySignalsResult.data || []) as SignalRow[], 'community_id');
  const peopleByFunder = grouped((peopleResult.data || []) as FoundationPersonRow[], 'foundation_id');
  const granteesByFunder = grouped((granteesResult.data || []) as GranteeRow[], 'foundation_id');
  const programsByFunder = grouped((programsResult.data || []) as ProgramRow[], 'foundation_id');
  const portfolioByFunder = grouped((portfolioResult.data || []) as unknown as PortfolioRow[], 'foundation_id');
  const snapshotsByFunder = grouped((snapshotsResult.data || []) as SnapshotRow[], 'foundation_id');
  const relationshipSignalsByFunder = grouped((relationshipSignalsResult.data || []) as RelationshipSignalRow[], 'foundation_id');
  const relationshipsByEntity = new Map<string, EntityRelationshipRow[]>();
  for (const row of relationshipRows) {
    for (const entityId of [row.source_entity_id, row.target_entity_id]) {
      if (!selectedEntityIds.has(entityId)) continue;
      const values = relationshipsByEntity.get(entityId) ?? [];
      values.push(row);
      relationshipsByEntity.set(entityId, values);
    }
  }
  const counterparts = new Map(counterpartRows.map((row) => [row.id, row]));
  const contactsByEntity = grouped((orgContactsResult.data || []) as OrgContactRow[], 'linked_entity_id');
  const contactEntityLinksByEntity = grouped(contactEntityLinkRows, 'entity_id');
  const linkedGhlById = new Map(linkedGhlRows.map((row) => [row.id, row]));
  const contextEventRows = [
    ...((organisationEventsResult.data || []) as ContextEventRow[]),
    ...((personEventsResult.data || []) as ContextEventRow[]),
  ];
  const organisationGhlByName = grouped((organisationGhlResult.data || []) as GhlContactRow[], 'company_name');
  const personGhlByName = grouped((personGhlResult.data || []) as GhlContactRow[], 'full_name');
  const invoiceRows = (invoicesResult.data || []) as InvoiceRow[];
  const projectPipelineByCode = grouped((projectPipelineResult.data || []) as ProjectPipelineRow[], 'project_code');
  const projectFoundationsById = grouped((projectFoundationsResult.data || []) as unknown as ProjectFoundationRow[], 'org_project_id');
  const projectContactsById = grouped((projectContactsResult.data || []) as ProjectContactRow[], 'project_id');
  const projectMoneyByCode = new Map(((projectMoneyResult.data || []) as ProjectMoneyRow[]).map((row) => [row.project_code, row]));
  const projectRecommendationsByCode = grouped((projectRecommendationsResult.data || []) as ProjectRecommendationRow[], 'project_code');
  const projectIntelligenceByCode = new Map(((projectIntelligenceResult.data || []) as ProjectIntelligenceRow[]).map((row) => [row.project_code, row]));
  const goodsCommunityRows = (goodsCommunitiesResult.data || []) as GoodsCommunityRow[];
  const opportunityDetailsById = new Map(((opportunityDetailsResult.data || []) as OpportunityDetailRow[]).map((row) => [row.id, row]));
  const opportunityPipelineRows = uniqueBy([
    ...((opportunityPipelineResult.data || []) as ProjectPipelineRow[]),
    ...((opportunityPipelineItemsResult.data || []) as ProjectPipelineRow[]),
  ], (row) => row.id);
  const opportunityPipelineById = new Map<string, ProjectPipelineRow[]>();
  for (const row of opportunityPipelineRows) {
    for (const key of [row.grant_opportunity_id, row.id].filter((value): value is string => Boolean(value))) {
      const rows = opportunityPipelineById.get(key) ?? [];
      rows.push(row);
      opportunityPipelineById.set(key, rows);
    }
  }
  const opportunityDecisionsById = grouped((opportunityDecisionsResult.data || []) as OpportunityDecisionRow[], 'source_ref');
  const recommendationDecisionsById = grouped((recommendationDecisionsResult.data || []) as RecommendationDecisionRow[], 'grant_opportunity_id');

  return records.map((record) => {
    if (record.type === 'community') {
      return {
        ...record,
        context: buildCommunityContext(
          record,
          slug,
          buyersByCommunity.get(record.id) ?? [],
          record.postcode ? localsByPostcode.get(record.postcode) ?? [] : [],
          signalsByCommunity.get(record.id) ?? [],
        ),
      };
    }
    if (record.type === 'funder') {
      return {
        ...record,
        context: buildFunderContext(
          record,
          slug,
          peopleByFunder.get(record.id) ?? [],
          granteesByFunder.get(record.id) ?? [],
          programsByFunder.get(record.id) ?? [],
          portfolioByFunder.get(record.id) ?? [],
          snapshotsByFunder.get(record.id) ?? [],
          relationshipSignalsByFunder.get(record.id) ?? [],
        ),
      };
    }
    if ((record.type === 'person' || record.type === 'organisation') && record.entityId) {
      return {
        ...record,
        context: buildEntityContext(
          record,
          slug,
          relationshipsByEntity.get(record.entityId) ?? [],
          counterparts,
          contactsByEntity.get(record.entityId) ?? [],
          contactEntityLinksByEntity.get(record.entityId) ?? [],
          uniqueBy([
            ...(record.type === 'person' ? personGhlByName.get(record.name) ?? [] : organisationGhlByName.get(record.name) ?? []),
            ...(contactEntityLinksByEntity.get(record.entityId) ?? []).map((link) => linkedGhlById.get(link.contact_id)).filter((row): row is GhlContactRow => Boolean(row)),
          ], (row) => (row.email || row.full_name || row.id).toLocaleLowerCase('en-AU')),
          contextEventRows.filter((row) => identityMatches(record.type === 'person' ? row.actor_name : row.organisation, record.name)),
          record.type === 'organisation' ? invoiceRows.filter((row) => identityMatches(row.contact_name, record.name)) : [],
        ),
      };
    }
    if (record.type === 'project') {
      const projectCode = record.facts.find((fact) => fact.label === 'Project code')?.value || '';
      return {
        ...record,
        context: buildProjectContext(
          record,
          slug,
          projectPipelineByCode.get(projectCode) ?? [],
          projectFoundationsById.get(record.id) ?? [],
          projectContactsById.get(record.id) ?? [],
          projectMoneyByCode.get(projectCode) ?? null,
          projectRecommendationsByCode.get(projectCode) ?? [],
          projectIntelligenceByCode.get(projectCode) ?? null,
          projectCode === 'ACT-GD' ? goodsCommunityRows : [],
        ),
      };
    }
    if (record.type === 'opportunity') {
      const detail = opportunityDetailsById.get(record.id) ?? null;
      return {
        ...record,
        href: detail ? record.href : `/org/${slug}?view=opportunities#opportunities`,
        context: buildOpportunityContext(
          record,
          slug,
          detail,
          opportunityPipelineById.get(record.id) ?? (record.pipelineItemId ? opportunityPipelineById.get(record.pipelineItemId) ?? [] : []),
          opportunityDecisionsById.get(record.id) ?? [],
          recommendationDecisionsById.get(record.id) ?? [],
        ),
      };
    }
    return record;
  });
}
