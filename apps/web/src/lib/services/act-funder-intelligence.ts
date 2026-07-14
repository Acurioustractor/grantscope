import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { isInternalActIdentity } from '@/lib/act-internal-identities';

export type ActFunderRelationshipState = 'active' | 'warm' | 'known' | 'cold';
export type ActFunderEvidenceStatus = 'strong' | 'partial' | 'missing' | 'stale';

export interface ActFunderPerson {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  organisation: string;
  source: 'foundation' | 'registry' | 'bridge' | 'contact' | 'ghl' | 'gmail' | 'portfolio';
  lastContactAt: string | null;
  evidence: string;
  confidence: string;
}

export interface ActFunderGrantee {
  id: string;
  name: string;
  amount: number | null;
  year: number | null;
  program: string | null;
  sourceUrl: string | null;
  confidence: string | null;
}

export interface ActFunderProgram {
  id: string;
  name: string;
  status: string | null;
  deadline: string | null;
  amountMin: number | null;
  amountMax: number | null;
  applicationProcess: string | null;
  applicationMode: string | null;
  url: string | null;
  sourceCount: number;
}

export interface ActFunderInteraction {
  id: string;
  type: string;
  summary: string;
  notes: string | null;
  happenedAt: string;
  status: string | null;
}

export interface ActFunderPath {
  id: string;
  kind: 'direct_contact' | 'board_bridge' | 'funded_act' | 'pipeline' | 'board' | 'grantee' | 'signal';
  label: string;
  detail: string;
  strength: number;
  sourceUrl: string | null;
  verified: boolean;
}

export interface ActFunderSourceAudit {
  key: string;
  label: string;
  count: number;
  covered: number;
  total: number;
  status: ActFunderEvidenceStatus;
  latestAt: string | null;
  detail: string;
}

export interface ActContactEntityCandidate {
  entityId: string;
  name: string;
  abn: string | null;
  entityType: string;
  website: string | null;
  nameScore: number;
}

export interface ActContactResolutionItem {
  contactId: string;
  name: string;
  organisation: string;
  email: string | null;
  status: 'suggested' | 'ambiguous' | 'research';
  candidates: ActContactEntityCandidate[];
}

export interface ActFunderDossier {
  foundationId: string;
  relationshipRecordId: string;
  projectId: string;
  entityId: string | null;
  name: string;
  abn: string | null;
  website: string | null;
  description: string | null;
  annualGiving: number | null;
  thematicFocus: string[];
  geographicFocus: string[];
  targetRecipients: string[];
  givingPhilosophy: string | null;
  applicationTips: string | null;
  sourceUrls: string[];
  enrichedAt: string | null;
  projects: string[];
  stages: string[];
  engagementStatuses: string[];
  fitScore: number;
  active: boolean;
  nextStep: string | null;
  nextTouchAt: string | null;
  lastInteractionAt: string | null;
  relationshipState: ActFunderRelationshipState;
  relationshipScore: number;
  evidenceScore: number;
  recommendedAction: string;
  whyNow: string;
  evidenceGaps: string[];
  granteeCount: number;
  granteeAmount: number;
  latestGrantYear: number | null;
  programCount: number;
  openProgramCount: number;
  applicationPathCount: number;
  annualReportYears: number;
  latestReportYear: number | null;
  boardRoleCount: number;
  pipelineCount: number;
  people: ActFunderPerson[];
  grantees: ActFunderGrantee[];
  programs: ActFunderProgram[];
  interactions: ActFunderInteraction[];
  paths: ActFunderPath[];
  sourceAudit: ActFunderSourceAudit[];
}

export interface ActFunderIntelligence {
  generatedAt: string;
  summary: {
    candidates: number;
    active: number;
    withContacts: number;
    withFundingHistory: number;
    withNamedPeople: number;
    withWarmPath: number;
    needingEnrichment: number;
  };
  globalCoverage: {
    foundations: number;
    websites: number;
    descriptions: number;
    focusAreas: number;
    scrapedSources: number;
    granteeRows: number;
    foundationPeople: number;
    boardRoles: number;
    ghlContacts: number;
    gmailMessages: number;
    notionOrganisations: number;
  };
  sourceAudit: ActFunderSourceAudit[];
  contactResolution: {
    total: number;
    suggested: number;
    ambiguous: number;
    research: number;
    items: ActContactResolutionItem[];
  };
  dossiers: ActFunderDossier[];
}

interface FoundationRow extends Record<string, unknown> {
  foundation_id: string;
  relationship_record_id: string;
  project_id: string;
  entity_id: string | null;
  name: string;
  acnc_abn: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | string | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  target_recipients: string[] | null;
  giving_philosophy: string | null;
  application_tips: string | null;
  scraped_urls: string[] | null;
  enriched_at: string | null;
  projects: string[] | null;
  stages: string[] | null;
  engagement_statuses: string[] | null;
  fit_score: number | string | null;
  next_step: string | null;
  next_touch_at: string | null;
  last_interaction_at: string | null;
  grantee_count: number | string | null;
  grantee_amount: number | string | null;
  latest_grant_year: number | string | null;
  people_count: number | string | null;
  linked_people_count: number | string | null;
  program_count: number | string | null;
  open_program_count: number | string | null;
  application_path_count: number | string | null;
  annual_report_years: number | string | null;
  latest_report_year: number | string | null;
  signal_count: number | string | null;
  snapshot_contacts: number | string | null;
  snapshot_emails: number | string | null;
  snapshot_score: number | string | null;
  board_role_count: number | string | null;
  pipeline_count: number | string | null;
}

interface RawPersonRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  person_name: string;
  role_title: string | null;
  role_type: string | null;
  source_url: string | null;
  source_document_url: string | null;
  confidence: string | null;
  extracted_at: string | null;
}

interface RawRoleRow extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  person_name: string;
  role_type: string | null;
  source: string | null;
  confidence: string | null;
  updated_at: string | null;
}

interface RawGhlContact extends Record<string, unknown> {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  last_contact_date: string | null;
  tags: string[] | null;
  graph_entity_id: string | null;
}

interface RawOrgContact extends Record<string, unknown> {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  organisation: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  linked_entity_id: string | null;
}

interface RawContactResolutionRow extends Record<string, unknown> {
  contact_id: string;
  contact_name: string;
  organisation: string;
  email: string | null;
  search_name: string;
  entity_id: string | null;
  entity_name: string | null;
  entity_abn: string | null;
  entity_type: string | null;
  entity_website: string | null;
  name_score: number | string | null;
}

interface RawOrganisationBridge extends Record<string, unknown> {
  foundation_id: string;
  connector_name: string;
  connector_role: string | null;
  bridge_org: string;
  act_contact: string;
  act_contact_email: string | null;
  last_contacted_at: string | null;
}

interface RawContextEvent extends Record<string, unknown> {
  id: string;
  source_system: string;
  actor_name: string | null;
  actor_email: string | null;
  organisation: string | null;
  title: string;
  summary: string;
  signal_kind: string;
  source_url: string | null;
  happened_at: string | null;
  confidence: number | string | null;
}

interface RawInteraction extends Record<string, unknown> {
  id: string;
  foundation_id: string;
  interaction_type: string;
  summary: string;
  notes: string | null;
  happened_at: string;
  status_snapshot: string | null;
}

interface RawSnapshot extends Record<string, unknown> {
  funder_name: string;
  foundation_id: string;
  contacts: Array<Record<string, unknown>> | null;
  contacts_count: number | string | null;
  email_count: number | string | null;
  email_last_date: string | null;
  email_summary: string | null;
  relationship_score: number | string | null;
  most_recent_contact_at: string | null;
  refreshed_at: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_NAME_TOKENS = new Set([
  'the', 'trustee', 'for', 'foundation', 'limited', 'ltd', 'trust', 'fund', 'australia',
  'australian', 'community', 'charitable', 'family', 'company', 'group', 'general',
]);

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];
}

export function normaliseFunderIdentity(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\bpty\.?\s*ltd\.?\b/g, ' ')
    .replace(/\blimited\b/g, ' ')
    .replace(/\bthe trustee for\b/g, ' ')
    .replace(/^\s*the\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctiveNameTokens(value: string): string[] {
  return normaliseFunderIdentity(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !GENERIC_NAME_TOKENS.has(token));
}

function websiteDomain(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function emailDomain(value: string | null): string | null {
  const match = value?.toLowerCase().match(/@([^\s>]+)/);
  return match?.[1]?.replace(/[>,;]+$/, '') ?? null;
}

export function contactMatchesFoundation(
  foundationName: string,
  foundationWebsite: string | null,
  contactOrganisation: string | null,
  contactEmail: string | null,
): boolean {
  const domain = websiteDomain(foundationWebsite);
  const contactDomain = emailDomain(contactEmail);
  if (domain && contactDomain && (contactDomain === domain || contactDomain.endsWith(`.${domain}`))) return true;

  const organisation = normaliseFunderIdentity(contactOrganisation);
  if (!organisation) return false;
  const tokens = distinctiveNameTokens(foundationName);
  if (tokens.length === 0) return false;
  const organisationTokens = distinctiveNameTokens(organisation);
  const required = tokens.slice(0, 3);
  if (!required.every((token) => organisationTokens.includes(token))) return false;
  return required.length > 1 || organisationTokens.length === 1;
}

function eventMatchesFoundation(foundation: FoundationRow, event: RawContextEvent): boolean {
  if (contactMatchesFoundation(foundation.name, foundation.website, event.organisation, event.actor_email)) return true;
  const haystack = normaliseFunderIdentity(`${event.organisation ?? ''} ${event.title ?? ''} ${event.summary ?? ''}`);
  const tokens = distinctiveNameTokens(foundation.name);
  return tokens.length > 0 && tokens.slice(0, 2).every((token) => haystack.includes(token));
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : Math.floor((Date.now() - timestamp) / 86_400_000);
}

function sourceStatus(covered: number, total: number, latestAt: string | null = null): ActFunderEvidenceStatus {
  if (covered <= 0 || total <= 0) return 'missing';
  const age = daysSince(latestAt);
  if (age !== null && age > 120) return 'stale';
  const ratio = covered / total;
  if (ratio >= 0.7) return 'strong';
  return 'partial';
}

function dedupePeople(people: ActFunderPerson[]): ActFunderPerson[] {
  const byKey = new Map<string, ActFunderPerson>();
  const sourceRank: Record<ActFunderPerson['source'], number> = { gmail: 7, contact: 6, ghl: 5, portfolio: 4, bridge: 3, foundation: 2, registry: 1 };
  const roleRank = (role: string | null) => {
    const key = normaliseFunderIdentity(role);
    if (key === 'ceo' || key === 'executive director') return 0;
    if (key === 'chair') return 1;
    if (key === 'secretary') return 2;
    if (key === 'director') return 3;
    if (key === 'board member') return 4;
    return 5;
  };
  for (const person of people) {
    const key = person.email?.toLowerCase() || normaliseFunderIdentity(person.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || sourceRank[person.source] > sourceRank[existing.source]) {
      byKey.set(key, person);
      continue;
    }
    if (!existing.lastContactAt && person.lastContactAt) existing.lastContactAt = person.lastContactAt;
    if (!existing.role && person.role) existing.role = person.role;
  }
  return [...byKey.values()].sort((left, right) => {
    const leftTime = left.lastContactAt ? new Date(left.lastContactAt).getTime() : 0;
    const rightTime = right.lastContactAt ? new Date(right.lastContactAt).getTime() : 0;
    return rightTime - leftTime
      || sourceRank[right.source] - sourceRank[left.source]
      || roleRank(left.role) - roleRank(right.role)
      || left.name.localeCompare(right.name);
  });
}

export function relationshipState(
  lastContactAt: string | null,
  peopleCount: number,
  signalCount: number,
  fundedAct: boolean,
): ActFunderRelationshipState {
  const age = daysSince(lastContactAt);
  if (age !== null && age <= 90) return 'active';
  if (peopleCount > 0 && age !== null && age <= 365) return 'warm';
  if (peopleCount > 0 || signalCount > 0 || fundedAct) return 'known';
  return 'cold';
}

export function recommendFunderAction(input: {
  state: ActFunderRelationshipState;
  nextStep: string | null;
  nextTouchAt: string | null;
  people: number;
  directContacts?: number;
  verifiedIntroductions?: number;
  introductionPerson?: string | null;
  introductionKind?: 'known_officeholder' | 'shared_organisation';
  grantees: number;
  programs: number;
  applicationPaths: number;
}): { action: string; why: string } {
  const touchAge = daysSince(input.nextTouchAt);
  if (input.nextStep && input.nextTouchAt && touchAge !== null && touchAge >= 0) {
    return { action: input.nextStep, why: `The recorded next touch is ${touchAge} day${touchAge === 1 ? '' : 's'} overdue.` };
  }
  if (input.nextStep && input.state === 'active') {
    return { action: input.nextStep, why: 'There is current relationship evidence and a recorded next move.' };
  }
  if (input.people === 0) {
    return { action: 'Identify the relevant program lead and a trusted introduction route.', why: 'No named funder person is connected to this dossier yet.' };
  }
  if (input.grantees === 0) {
    return { action: 'Extract recent grantees before shaping an approach.', why: 'The system cannot yet show what this funder actually backs.' };
  }
  if (input.programs === 0 || input.applicationPaths === 0) {
    return { action: 'Confirm the current program and application pathway.', why: 'Funding history exists, but the current route in is incomplete.' };
  }
  if ((input.directContacts ?? input.people) === 0 && (input.verifiedIntroductions ?? 0) > 0) {
    const person = input.introductionPerson ? ` through ${input.introductionPerson}` : '';
    if (input.introductionKind === 'shared_organisation') {
      return { action: `Test the source-backed introduction${person}.`, why: 'ACT has a named contact at an organisation connected to the funder through a current shared officeholder.' };
    }
    return { action: `Test the verified board introduction${person}.`, why: 'ACT knows this person, and a current registry role connects them to the funder.' };
  }
  if ((input.directContacts ?? input.people) === 0) {
    return { action: 'Map a credible introduction to the strongest named decision-maker.', why: 'Registry-backed people are known, but none is yet a verified ACT contact.' };
  }
  if (input.state === 'warm' || input.state === 'known') {
    return { action: 'Ask the strongest known person for a short working conversation.', why: 'The evidence supports relationship development before an application.' };
  }
  return { action: 'Research one credible warm path before outreach.', why: 'The fit may be useful, but there is no verified relationship route.' };
}

function evidenceScore(input: {
  foundation: FoundationRow;
  people: number;
  events: number;
  grantees: number;
  programs: number;
  applicationPaths: number;
  paths: number;
}): number {
  const checks = [
    Boolean(input.foundation.website),
    Boolean(input.foundation.description),
    stringArray(input.foundation.thematic_focus).length > 0,
    stringArray(input.foundation.geographic_focus).length > 0,
    stringArray(input.foundation.scraped_urls).length > 0,
    input.grantees > 0,
    input.programs > 0,
    input.applicationPaths > 0,
    input.people > 0,
    input.events > 0,
    numberValue(input.foundation.annual_report_years) > 0,
    input.paths > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const CONTACT_RESOLUTION_GENERIC_TOKENS = new Set([
  'and', 'australia', 'australian', 'company', 'corporation', 'department', 'foundation',
  'group', 'inc', 'incorporated', 'limited', 'ltd', 'organisation', 'organization', 'services',
  'the', 'trust', 'trustee',
]);

const CONTACT_RESOLUTION_GENERIC_IDENTITIES = new Set([
  'axt', 'independent', 'self employed', 'self employed youth justice',
]);

function contactResolutionTokens(value: string): string[] {
  return normaliseFunderIdentity(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !CONTACT_RESOLUTION_GENERIC_TOKENS.has(token));
}

export function buildContactResolutionItems(rows: RawContactResolutionRow[]): ActContactResolutionItem[] {
  const grouped = new Map<string, { row: RawContactResolutionRow; candidates: ActContactEntityCandidate[] }>();
  for (const row of rows) {
    const group = grouped.get(row.contact_id) ?? { row, candidates: [] };
    if (row.entity_id && row.entity_name && row.entity_type) {
      group.candidates.push({
        entityId: row.entity_id,
        name: row.entity_name,
        abn: row.entity_abn,
        entityType: row.entity_type,
        website: row.entity_website,
        nameScore: Math.round(numberValue(row.name_score) * 100),
      });
    }
    grouped.set(row.contact_id, group);
  }

  return [...grouped.values()].map(({ row, candidates }) => {
    const identity = normaliseFunderIdentity(row.search_name || row.organisation);
    const sourceTokens = contactResolutionTokens(row.search_name || row.organisation);
    const tokenAligned = candidates.filter((candidate) => {
      const candidateTokens = new Set(contactResolutionTokens(candidate.name));
      const overlap = sourceTokens.filter((token) => candidateTokens.has(token)).length;
      return sourceTokens.length > 0
        && overlap / sourceTokens.length >= 0.66;
    });
    const credible = !CONTACT_RESOLUTION_GENERIC_IDENTITIES.has(identity)
      && (tokenAligned[0]?.nameScore ?? 0) >= 65
      ? tokenAligned.filter((candidate) => candidate.nameScore >= 58)
      : [];
    const status: ActContactResolutionItem['status'] = credible.length === 0
      ? 'research'
      : credible.length > 1
        ? 'ambiguous'
        : 'suggested';
    return {
      contactId: row.contact_id,
      name: row.contact_name,
      organisation: row.organisation,
      email: row.email,
      status,
      candidates: credible.slice(0, 3),
    };
  }).sort((left, right) => {
    const rank = { suggested: 0, ambiguous: 1, research: 2 } as const;
    return rank[left.status] - rank[right.status] || left.organisation.localeCompare(right.organisation);
  });
}

function emptyIntelligence(): ActFunderIntelligence {
  return {
    generatedAt: new Date().toISOString(),
    summary: { candidates: 0, active: 0, withContacts: 0, withFundingHistory: 0, withNamedPeople: 0, withWarmPath: 0, needingEnrichment: 0 },
    globalCoverage: { foundations: 0, websites: 0, descriptions: 0, focusAreas: 0, scrapedSources: 0, granteeRows: 0, foundationPeople: 0, boardRoles: 0, ghlContacts: 0, gmailMessages: 0, notionOrganisations: 0 },
    sourceAudit: [],
    contactResolution: { total: 0, suggested: 0, ambiguous: 0, research: 0, items: [] },
    dossiers: [],
  };
}

export async function loadActFunderIntelligence(orgProfileId: string): Promise<ActFunderIntelligence> {
  if (!UUID_RE.test(orgProfileId)) return emptyIntelligence();
  const db = getServiceSupabase();

  const foundationRows = await safe(db.rpc('exec_sql', {
    query: `WITH portfolio AS (
        SELECT
          opf.foundation_id,
          (array_agg(opf.id::text ORDER BY COALESCE(opf.next_touch_at, opf.updated_at) DESC, opf.updated_at DESC))[1]
            AS relationship_record_id,
          (array_agg(opf.org_project_id::text ORDER BY COALESCE(opf.next_touch_at, opf.updated_at) DESC, opf.updated_at DESC))[1]
            AS project_id,
          array_agg(DISTINCT op.name ORDER BY op.name) AS projects,
          array_agg(DISTINCT opf.stage ORDER BY opf.stage) AS stages,
          array_agg(DISTINCT opf.engagement_status ORDER BY opf.engagement_status) AS engagement_statuses,
          MAX(opf.fit_score)::int AS fit_score,
          (array_agg(opf.next_step ORDER BY COALESCE(opf.next_touch_at, opf.updated_at) DESC)
            FILTER (WHERE opf.next_step IS NOT NULL AND opf.next_step <> ''))[1] AS next_step,
          MAX(opf.next_touch_at)::text AS next_touch_at,
          MAX(opf.last_interaction_at)::text AS last_interaction_at
        FROM org_project_foundations opf
        JOIN org_projects op ON op.id = opf.org_project_id
        WHERE opf.org_profile_id = '${orgProfileId}'
        GROUP BY opf.foundation_id
      ), grantees AS (
        SELECT foundation_id, COUNT(*)::int AS grantee_count,
          COALESCE(SUM(grant_amount), 0)::numeric AS grantee_amount,
          MAX(grant_year)::int AS latest_grant_year
        FROM foundation_grantees GROUP BY foundation_id
      ), people AS (
        SELECT foundation_id, COUNT(*)::int AS people_count,
          COUNT(*) FILTER (WHERE person_entity_id IS NOT NULL)::int AS linked_people_count
        FROM foundation_people GROUP BY foundation_id
      ), programs AS (
        SELECT foundation_id, COUNT(*)::int AS program_count,
          COUNT(*) FILTER (WHERE status IN ('open', 'ongoing'))::int AS open_program_count,
          COUNT(*) FILTER (WHERE COALESCE(application_process, '') <> ''
            OR COALESCE(application_mode, '') <> '' OR url IS NOT NULL
            OR COALESCE(cardinality(source_urls), 0) > 0)::int AS application_path_count
        FROM foundation_programs GROUP BY foundation_id
      ), years AS (
        SELECT foundation_id, COUNT(*)::int AS annual_report_years,
          MAX(report_year)::int AS latest_report_year
        FROM foundation_program_years GROUP BY foundation_id
      ), signals AS (
        SELECT foundation_id, COUNT(*)::int AS signal_count
        FROM foundation_relationship_signals GROUP BY foundation_id
      ), snapshots AS (
        SELECT foundation_id, MAX(contacts_count)::int AS snapshot_contacts,
          MAX(email_count)::int AS snapshot_emails,
          MAX(relationship_score)::int AS snapshot_score
        FROM funder_context_snapshot WHERE foundation_id IS NOT NULL GROUP BY foundation_id
      ), roles AS (
        SELECT f.id AS foundation_id, COUNT(pr.id)::int AS board_role_count
        FROM portfolio p JOIN foundations f ON f.id = p.foundation_id
        LEFT JOIN person_roles pr ON pr.entity_id = f.gs_entity_id AND pr.cessation_date IS NULL
        GROUP BY f.id
      ), pipeline AS (
        SELECT f.id AS foundation_id, COUNT(op.id)::int AS pipeline_count
        FROM portfolio p JOIN foundations f ON f.id = p.foundation_id
        LEFT JOIN org_pipeline op ON op.org_profile_id = '${orgProfileId}'
          AND (op.funder_entity_id = f.gs_entity_id OR lower(op.funder) = lower(f.name))
        GROUP BY f.id
      )
      SELECT f.id::text AS foundation_id, p.relationship_record_id, p.project_id,
        f.gs_entity_id::text AS entity_id, f.name, f.acnc_abn,
        f.website, f.description, f.total_giving_annual, f.thematic_focus, f.geographic_focus,
        f.target_recipients, f.giving_philosophy, f.application_tips, f.scraped_urls,
        f.enriched_at::text, p.projects, p.stages, p.engagement_statuses, p.fit_score,
        p.next_step, p.next_touch_at, p.last_interaction_at,
        COALESCE(g.grantee_count, 0)::int AS grantee_count,
        COALESCE(g.grantee_amount, 0)::numeric AS grantee_amount, g.latest_grant_year,
        COALESCE(pe.people_count, 0)::int AS people_count,
        COALESCE(pe.linked_people_count, 0)::int AS linked_people_count,
        COALESCE(pr.program_count, 0)::int AS program_count,
        COALESCE(pr.open_program_count, 0)::int AS open_program_count,
        COALESCE(pr.application_path_count, 0)::int AS application_path_count,
        COALESCE(y.annual_report_years, 0)::int AS annual_report_years, y.latest_report_year,
        COALESCE(s.signal_count, 0)::int AS signal_count,
        COALESCE(sn.snapshot_contacts, 0)::int AS snapshot_contacts,
        COALESCE(sn.snapshot_emails, 0)::int AS snapshot_emails,
        COALESCE(sn.snapshot_score, 0)::int AS snapshot_score,
        COALESCE(r.board_role_count, 0)::int AS board_role_count,
        COALESCE(pl.pipeline_count, 0)::int AS pipeline_count
      FROM portfolio p
      JOIN foundations f ON f.id = p.foundation_id
      LEFT JOIN grantees g ON g.foundation_id = f.id
      LEFT JOIN people pe ON pe.foundation_id = f.id
      LEFT JOIN programs pr ON pr.foundation_id = f.id
      LEFT JOIN years y ON y.foundation_id = f.id
      LEFT JOIN signals s ON s.foundation_id = f.id
      LEFT JOIN snapshots sn ON sn.foundation_id = f.id
      LEFT JOIN roles r ON r.foundation_id = f.id
      LEFT JOIN pipeline pl ON pl.foundation_id = f.id
      ORDER BY (NOT ('parked' = ANY(p.stages))) DESC, p.fit_score DESC NULLS LAST, f.name`,
  })) as FoundationRow[] | null;

  if (!foundationRows?.length) return emptyIntelligence();
  const ids = foundationRows.map((row) => `'${row.foundation_id}'`).join(',');

  const [
    granteeRows,
    personRows,
    roleRows,
    programRows,
    signalRows,
    snapshotRows,
    ghlRows,
    orgContactRows,
    contactResolutionRows,
    organisationBridgeRows,
    contextRows,
    interactionRows,
    globalRows,
    agentRows,
  ] = await Promise.all([
    safe(db.rpc('exec_sql', {
      query: `WITH ranked AS (
          SELECT id::text, foundation_id::text, grantee_name, grant_amount, grant_year,
            program_name, COALESCE(NULLIF(source_document_url, ''), NULLIF(source_url, '')) AS source_url,
            confidence,
            ROW_NUMBER() OVER (PARTITION BY foundation_id ORDER BY grant_year DESC NULLS LAST, grant_amount DESC NULLS LAST, updated_at DESC) AS rn
          FROM foundation_grantees WHERE foundation_id IN (${ids})
        ) SELECT * FROM ranked WHERE rn <= 12 ORDER BY foundation_id, rn`,
    })) as Promise<Array<Record<string, unknown>> | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT id::text, foundation_id::text, person_name, role_title, role_type,
        source_url, source_document_url, confidence, extracted_at::text
        FROM foundation_people WHERE foundation_id IN (${ids})
        ORDER BY foundation_id, extracted_at DESC`,
    })) as Promise<RawPersonRow[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT pr.id::text, f.id::text AS foundation_id, pr.person_name, pr.role_type,
          pr.source, pr.confidence, pr.updated_at::text
        FROM foundations f
        JOIN person_roles pr ON pr.entity_id = f.gs_entity_id
        WHERE f.id IN (${ids}) AND pr.cessation_date IS NULL
        ORDER BY f.id,
          CASE lower(COALESCE(pr.role_type, ''))
            WHEN 'ceo' THEN 0 WHEN 'executive_director' THEN 1 WHEN 'chair' THEN 2
            WHEN 'secretary' THEN 3 WHEN 'director' THEN 4 WHEN 'board_member' THEN 5 ELSE 6
          END,
          pr.person_name`,
    })) as Promise<RawRoleRow[] | null>,
    safe(db.rpc('exec_sql', {
      query: `WITH ranked AS (
          SELECT id::text, foundation_id::text, name, status, deadline::text, amount_min, amount_max,
            application_process, application_mode, url, COALESCE(cardinality(source_urls), 0)::int AS source_count,
            ROW_NUMBER() OVER (PARTITION BY foundation_id ORDER BY
              CASE status WHEN 'open' THEN 0 WHEN 'ongoing' THEN 1 ELSE 2 END,
              deadline ASC NULLS LAST, scraped_at DESC NULLS LAST) AS rn
          FROM foundation_programs WHERE foundation_id IN (${ids})
        ) SELECT * FROM ranked WHERE rn <= 6 ORDER BY foundation_id, rn`,
    })) as Promise<Array<Record<string, unknown>> | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT id::text, foundation_id::text, signal_type, related_name, person_name,
        evidence_text, strength, confidence, source_url
        FROM foundation_relationship_signals WHERE foundation_id IN (${ids})
        ORDER BY strength DESC NULLS LAST, created_at DESC LIMIT 800`,
    })) as Promise<Array<Record<string, unknown>> | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT funder_name, foundation_id::text, contacts, contacts_count, email_count,
        email_last_date::text, email_summary, relationship_score,
        most_recent_contact_at::text, refreshed_at::text
        FROM funder_context_snapshot WHERE foundation_id IN (${ids})
        ORDER BY relationship_score DESC, refreshed_at DESC`,
    })) as Promise<RawSnapshot[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT gc.id::text, gc.full_name, gc.email, gc.company_name,
          gc.last_contact_date::text, gc.tags, graph.entity_id::text AS graph_entity_id
        FROM ghl_contacts gc
        LEFT JOIN LATERAL (
          SELECT cel.entity_id
          FROM contact_entity_links cel
          WHERE cel.contact_id = gc.id AND cel.confidence_score >= 0.8
          ORDER BY cel.verified DESC, cel.confidence_score DESC, cel.updated_at DESC
          LIMIT 1
        ) graph ON true
        WHERE COALESCE(gc.company_name, '') <> '' OR graph.entity_id IS NOT NULL
          OR (COALESCE(gc.full_name, '') <> '' AND (gc.last_contact_date IS NOT NULL OR COALESCE(cardinality(gc.tags), 0) > 0))
        ORDER BY gc.last_contact_date DESC NULLS LAST, gc.ghl_updated_at DESC NULLS LAST LIMIT 5000`,
    })) as Promise<RawGhlContact[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT id::text, name, email, role, organisation, notes,
          last_contacted_at::text, linked_entity_id::text
        FROM org_contacts
        WHERE org_profile_id = '${orgProfileId}'
        ORDER BY last_contacted_at DESC NULLS LAST, updated_at DESC`,
    })) as Promise<RawOrgContact[] | null>,
    safe(db.rpc('exec_sql', {
      query: `WITH unresolved AS (
          SELECT id, name, COALESCE(NULLIF(organisation, ''), name) AS organisation, email,
            CASE
              WHEN email IS NULL AND name <> COALESCE(organisation, '') AND name NOT LIKE '%/%'
                THEN name
              ELSE COALESCE(NULLIF(organisation, ''), name)
            END AS search_name
          FROM org_contacts
          WHERE org_profile_id = '${orgProfileId}' AND linked_entity_id IS NULL
        )
        SELECT c.id::text AS contact_id, c.name AS contact_name, c.organisation, c.email,
          c.search_name, e.id::text AS entity_id, e.canonical_name AS entity_name,
          e.abn AS entity_abn, e.entity_type, e.website AS entity_website,
          similarity(lower(e.canonical_name), lower(c.search_name)) AS name_score
        FROM unresolved c
        LEFT JOIN LATERAL (
          SELECT id, canonical_name, abn, entity_type, website
          FROM gs_entities
          WHERE canonical_name % c.search_name
          ORDER BY similarity(lower(canonical_name), lower(c.search_name)) DESC
          LIMIT 5
        ) e ON true
        ORDER BY c.organisation, c.name,
          similarity(lower(e.canonical_name), lower(c.search_name)) DESC NULLS LAST`,
    })) as Promise<RawContactResolutionRow[] | null>,
    safe(db.rpc('exec_sql', {
      query: `WITH targets AS (
          SELECT DISTINCT f.id AS foundation_id, f.gs_entity_id AS target_entity_id
          FROM org_project_foundations opf
          JOIN foundations f ON f.id = opf.foundation_id
          WHERE opf.org_profile_id = '${orgProfileId}'
        ), role_counts AS (
          SELECT person_entity_id, COUNT(DISTINCT entity_id)::int AS board_count
          FROM person_roles
          WHERE cessation_date IS NULL AND person_entity_id IS NOT NULL
          GROUP BY person_entity_id
        ), target_people AS (
          SELECT DISTINCT t.foundation_id, t.target_entity_id, pr.person_entity_id,
            pr.person_name, pr.role_type
          FROM targets t
          JOIN person_roles pr ON pr.entity_id = t.target_entity_id AND pr.cessation_date IS NULL
          JOIN role_counts rc ON rc.person_entity_id = pr.person_entity_id
          WHERE rc.board_count BETWEEN 2 AND 15
        ), ranked AS (
          SELECT tp.foundation_id::text, tp.person_name AS connector_name,
            tp.role_type AS connector_role, other.company_name AS bridge_org,
            oc.name AS act_contact, oc.email AS act_contact_email,
            oc.last_contacted_at::text,
            ROW_NUMBER() OVER (PARTITION BY tp.foundation_id, tp.person_entity_id, oc.id
              ORDER BY oc.last_contacted_at DESC NULLS LAST, other.updated_at DESC) AS rn
          FROM target_people tp
          JOIN person_roles other ON other.person_entity_id = tp.person_entity_id
            AND other.cessation_date IS NULL AND other.entity_id <> tp.target_entity_id
          JOIN org_contacts oc ON oc.org_profile_id = '${orgProfileId}'
            AND oc.linked_entity_id = other.entity_id
          WHERE lower(COALESCE(oc.email, '')) NOT IN ('benjamin@act.place', 'nicholas@act.place')
            AND (COALESCE(oc.email, '') <> '' OR oc.last_contacted_at IS NOT NULL)
            AND regexp_replace(lower(oc.name), '[^a-z0-9]+', '', 'g') <>
              regexp_replace(lower(COALESCE(oc.organisation, '')), '[^a-z0-9]+', '', 'g')
        )
        SELECT foundation_id, connector_name, connector_role, bridge_org,
          act_contact, act_contact_email, last_contacted_at
        FROM ranked WHERE rn = 1
        ORDER BY last_contacted_at DESC NULLS LAST LIMIT 200`,
    })) as Promise<RawOrganisationBridge[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT id::text, source_system, actor_name, actor_email, organisation, title, summary,
        signal_kind, source_url, happened_at::text, confidence
        FROM opportunity_context_events WHERE org_profile_id = '${orgProfileId}'
        ORDER BY COALESCE(happened_at, created_at) DESC LIMIT 300`,
    })) as Promise<RawContextEvent[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT i.id::text, opf.foundation_id::text, i.interaction_type, i.summary,
          i.notes, i.happened_at::text, i.status_snapshot
        FROM org_project_foundation_interactions i
        JOIN org_project_foundations opf ON opf.id = i.org_project_foundation_id
        WHERE i.org_profile_id = '${orgProfileId}' AND opf.foundation_id IN (${ids})
        ORDER BY i.happened_at DESC, i.created_at DESC LIMIT 800`,
    })) as Promise<RawInteraction[] | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT
        (SELECT COUNT(*) FROM foundations)::int AS foundations,
        (SELECT COUNT(*) FROM foundations WHERE website IS NOT NULL)::int AS websites,
        (SELECT COUNT(*) FROM foundations WHERE description IS NOT NULL AND length(description) > 30)::int AS descriptions,
        (SELECT COUNT(*) FROM foundations WHERE COALESCE(cardinality(thematic_focus), 0) > 0)::int AS focus_areas,
        (SELECT COUNT(*) FROM foundations WHERE COALESCE(cardinality(scraped_urls), 0) > 0)::int AS scraped_sources,
        (SELECT COUNT(*) FROM foundation_grantees)::int AS grantee_rows,
        (SELECT COUNT(*) FROM foundation_people)::int AS foundation_people,
        (SELECT COUNT(*) FROM person_roles)::int AS board_roles,
        (SELECT COUNT(*) FROM ghl_contacts)::int AS ghl_contacts,
        ((SELECT COUNT(*) FROM gmail_messages) +
          (SELECT COUNT(*) FROM opportunity_context_events WHERE org_profile_id = '${orgProfileId}' AND source_system = 'gmail'))::int AS gmail_messages,
        ((SELECT COUNT(*) FROM notion_organizations) +
          (SELECT COUNT(*) FROM opportunity_context_events WHERE org_profile_id = '${orgProfileId}' AND source_system = 'notion'))::int AS notion_organisations,
        (SELECT MAX(COALESCE(last_synced_at, ghl_updated_at, updated_at))::text FROM ghl_contacts) AS ghl_latest,
        GREATEST(
          (SELECT MAX(COALESCE(sent_date, received_date, synced_at)) FROM gmail_messages),
          (SELECT MAX(happened_at) FROM opportunity_context_events WHERE org_profile_id = '${orgProfileId}' AND source_system = 'gmail')
        )::text AS gmail_latest,
        GREATEST(
          (SELECT MAX(last_synced) FROM notion_organizations),
          (SELECT MAX(happened_at) FROM opportunity_context_events WHERE org_profile_id = '${orgProfileId}' AND source_system = 'notion')
        )::text AS notion_latest,
        (SELECT MAX(refreshed_at)::text FROM funder_context_snapshot) AS snapshot_latest`,
    })) as Promise<Array<Record<string, unknown>> | null>,
    safe(db.rpc('exec_sql', {
      query: `SELECT agent_id, status, started_at::text, completed_at::text, errors
        FROM agent_runs WHERE agent_id IN ('sync-goods-ghl', 'match-foundations-for-projects',
          'refresh-funder-context', 'foundation-intelligence-refresh', 'discover-foundation-programs')
        ORDER BY started_at DESC LIMIT 30`,
    })) as Promise<Array<Record<string, unknown>> | null>,
  ]);

  const granteesByFoundation = new Map<string, ActFunderGrantee[]>();
  for (const row of granteeRows ?? []) {
    const foundationId = String(row.foundation_id);
    const entries = granteesByFoundation.get(foundationId) ?? [];
    entries.push({
      id: String(row.id),
      name: String(row.grantee_name ?? 'Unknown grantee'),
      amount: row.grant_amount == null ? null : numberValue(row.grant_amount),
      year: row.grant_year == null ? null : numberValue(row.grant_year),
      program: textValue(row.program_name),
      sourceUrl: textValue(row.source_url),
      confidence: textValue(row.confidence),
    });
    granteesByFoundation.set(foundationId, entries);
  }

  const peopleByFoundation = new Map<string, RawPersonRow[]>();
  for (const row of personRows ?? []) {
    peopleByFoundation.set(row.foundation_id, [...(peopleByFoundation.get(row.foundation_id) ?? []), row]);
  }

  const rolesByFoundation = new Map<string, RawRoleRow[]>();
  for (const row of roleRows ?? []) {
    rolesByFoundation.set(row.foundation_id, [...(rolesByFoundation.get(row.foundation_id) ?? []), row]);
  }

  const programsByFoundation = new Map<string, ActFunderProgram[]>();
  for (const row of programRows ?? []) {
    const foundationId = String(row.foundation_id);
    const entries = programsByFoundation.get(foundationId) ?? [];
    entries.push({
      id: String(row.id),
      name: String(row.name ?? 'Unnamed program'),
      status: textValue(row.status),
      deadline: textValue(row.deadline),
      amountMin: row.amount_min == null ? null : numberValue(row.amount_min),
      amountMax: row.amount_max == null ? null : numberValue(row.amount_max),
      applicationProcess: textValue(row.application_process),
      applicationMode: textValue(row.application_mode),
      url: textValue(row.url),
      sourceCount: numberValue(row.source_count),
    });
    programsByFoundation.set(foundationId, entries);
  }

  const signalsByFoundation = new Map<string, Array<Record<string, unknown>>>();
  for (const row of signalRows ?? []) {
    const foundationId = String(row.foundation_id);
    signalsByFoundation.set(foundationId, [...(signalsByFoundation.get(foundationId) ?? []), row]);
  }

  const organisationBridgesByFoundation = new Map<string, RawOrganisationBridge[]>();
  for (const row of organisationBridgeRows ?? []) {
    organisationBridgesByFoundation.set(row.foundation_id, [
      ...(organisationBridgesByFoundation.get(row.foundation_id) ?? []),
      row,
    ]);
  }

  const interactionsByFoundation = new Map<string, ActFunderInteraction[]>();
  for (const row of interactionRows ?? []) {
    const interaction: ActFunderInteraction = {
      id: row.id,
      type: row.interaction_type,
      summary: row.summary,
      notes: row.notes,
      happenedAt: row.happened_at,
      status: row.status_snapshot,
    };
    interactionsByFoundation.set(row.foundation_id, [...(interactionsByFoundation.get(row.foundation_id) ?? []), interaction]);
  }

  const snapshotsByFoundation = new Map<string, RawSnapshot[]>();
  for (const row of snapshotRows ?? []) {
    snapshotsByFoundation.set(row.foundation_id, [...(snapshotsByFoundation.get(row.foundation_id) ?? []), row]);
  }

  const dossiers = foundationRows.map((foundation): ActFunderDossier => {
    const snapshots = snapshotsByFoundation.get(foundation.foundation_id) ?? [];
    const officialPeople = (peopleByFoundation.get(foundation.foundation_id) ?? []).map((person): ActFunderPerson => ({
      id: `foundation:${person.id}`,
      name: person.person_name,
      email: null,
      role: person.role_title ?? person.role_type,
      organisation: foundation.name,
      source: 'foundation',
      lastContactAt: null,
      evidence: person.source_document_url || person.source_url || 'Official foundation source',
      confidence: person.confidence || 'source-backed',
    })).filter((person) => !isInternalActIdentity(person));
    const registryPeople = (rolesByFoundation.get(foundation.foundation_id) ?? []).map((person): ActFunderPerson => ({
      id: `registry:${person.id}`,
      name: person.person_name,
      email: null,
      role: person.role_type,
      organisation: foundation.name,
      source: 'registry',
      lastContactAt: null,
      evidence: `${person.source === 'foundation_board' ? 'Foundation-published' : 'Registry'} officeholder role; research lead, not relationship evidence.`,
      confidence: person.confidence || 'registry',
    })).filter((person) => !isInternalActIdentity(person));
    const registryPeopleByName = new Map(
      registryPeople.map((person) => [normaliseFunderIdentity(person.name), person]),
    );
    const orgPeople = (orgContactRows ?? [])
      .filter((contact) => contact.linked_entity_id === foundation.entity_id
        && (contact.email || contact.last_contacted_at)
        && normaliseFunderIdentity(contact.name) !== normaliseFunderIdentity(contact.organisation))
      .map((contact): ActFunderPerson => ({
        id: `contact:${contact.id}`,
        name: contact.name,
        email: contact.email,
        role: contact.role,
        organisation: contact.organisation || foundation.name,
        source: 'contact',
        lastContactAt: contact.last_contacted_at,
        evidence: contact.notes || 'Curated ACT contact linked to this CivicGraph entity.',
        confidence: 'entity-linked',
      }))
      .filter((person) => !isInternalActIdentity(person));
    const ghlPeople = (ghlRows ?? [])
      .flatMap((contact): ActFunderPerson[] => {
        const directMatch = contact.graph_entity_id === foundation.entity_id
          || contactMatchesFoundation(foundation.name, foundation.website, contact.company_name, contact.email);
        const registryPerson = contact.full_name
          ? registryPeopleByName.get(normaliseFunderIdentity(contact.full_name))
          : null;
        const bridgeMatch = !directMatch
          && Boolean(registryPerson)
          && (Boolean(contact.last_contact_date) || stringArray(contact.tags).length > 0);
        if (!directMatch && !bridgeMatch) return [];

        const source: ActFunderPerson['source'] = bridgeMatch ? 'bridge' : 'ghl';
        const evidence = bridgeMatch
          ? `ACT knows this person in GoHighLevel; the registry shows a current ${registryPerson?.role || 'officeholder'} role at ${foundation.name}.`
          : stringArray(contact.tags).slice(0, 4).join(' · ') || 'GoHighLevel contact';
        return [{
          id: `${source}:${contact.id}`,
          name: contact.full_name || contact.email || 'Unnamed CRM contact',
          email: contact.email,
          role: registryPerson?.role ?? null,
          organisation: foundation.name,
          source,
          lastContactAt: contact.last_contact_date,
          evidence,
          confidence: bridgeMatch
            ? 'verified current-role bridge'
            : contact.graph_entity_id === foundation.entity_id ? 'entity-linked' : 'name/domain match',
        }];
      }).filter((person) => !isInternalActIdentity(person));
    const eventRows = (contextRows ?? []).filter((event) => eventMatchesFoundation(foundation, event));
    const gmailEventRows = eventRows.filter((event) => event.source_system === 'gmail');
    const knowledgeEventRows = eventRows.filter((event) => event.source_system === 'notion');
    const gmailPeople = gmailEventRows
      .filter((event) => event.actor_name || event.actor_email)
      .map((event): ActFunderPerson => ({
        id: `gmail:${event.id}`,
        name: event.actor_name || event.actor_email || 'Unknown mailbox contact',
        email: event.actor_email,
        role: null,
        organisation: event.organisation || foundation.name,
        source: 'gmail',
        lastContactAt: event.happened_at,
        evidence: event.summary || event.title,
        confidence: numberValue(event.confidence) >= 0.8 ? 'high' : 'review',
      })).filter((person) => !isInternalActIdentity(person));
    const snapshotPeople = snapshots.flatMap((snapshot) => {
      const contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
      return contacts.map((contact, index): ActFunderPerson => ({
        id: `snapshot:${foundation.foundation_id}:${index}:${String(contact.email ?? contact.name ?? '')}`,
        name: String(contact.name ?? contact.email ?? 'Unnamed contact'),
        email: textValue(contact.email),
        role: null,
        organisation: foundation.name,
        source: 'portfolio',
        lastContactAt: textValue(contact.last_contact_date),
        evidence: `Funder context snapshot: ${snapshot.funder_name}`,
        confidence: 'fuzzy source match',
      })).filter((person) => !isInternalActIdentity(person));
    });
    const people = dedupePeople([...gmailPeople, ...orgPeople, ...ghlPeople, ...snapshotPeople, ...officialPeople, ...registryPeople]);
    const directPeople = people.filter((person) => ['gmail', 'contact', 'ghl', 'portfolio'].includes(person.source));
    const bridgePeople = people.filter((person) => person.source === 'bridge');
    const organisationBridges = organisationBridgesByFoundation.get(foundation.foundation_id) ?? [];
    const interactionHistory = interactionsByFoundation.get(foundation.foundation_id) ?? [];
    const lastContactAt = directPeople.map((person) => person.lastContactAt)
      .concat(interactionHistory.map((interaction) => interaction.happenedAt))
      .filter((value): value is string => Boolean(value)).sort().at(-1)
      ?? foundation.last_interaction_at;

    const rawSignals = signalsByFoundation.get(foundation.foundation_id) ?? [];
    const paths: ActFunderPath[] = rawSignals.slice(0, 10).map((signal) => {
      const kind = String(signal.signal_type ?? 'signal');
      return {
        id: String(signal.id),
        kind: kind === 'act_funded' ? 'funded_act' : kind === 'act_pipeline' ? 'pipeline' : kind === 'funder_grantee' ? 'grantee' : 'signal',
        label: kind.replaceAll('_', ' '),
        detail: textValue(signal.evidence_text)
          || [textValue(signal.person_name), textValue(signal.related_name)].filter(Boolean).join(' · ')
          || 'Relationship evidence is available for review.',
        strength: numberValue(signal.strength),
        sourceUrl: textValue(signal.source_url),
        verified: ['high', 'verified', 'manual'].includes(String(signal.confidence ?? '').toLowerCase()),
      };
    });
    for (const person of people.filter((entry) => ['gmail', 'contact', 'ghl'].includes(entry.source)).slice(0, 3)) {
      paths.unshift({
        id: `direct:${person.id}`,
        kind: 'direct_contact',
        label: `Direct: ${person.name}`,
        detail: `${person.source.toUpperCase()} evidence connects ${person.name} to ${foundation.name}.`,
        strength: person.source === 'gmail' ? 90 : person.source === 'contact' ? 85 : 70,
        sourceUrl: null,
        verified: person.confidence === 'entity-linked' || person.source === 'gmail' || person.source === 'contact',
      });
    }
    for (const person of bridgePeople.slice(0, 3)) {
      paths.unshift({
        id: `bridge:${person.id}`,
        kind: 'board_bridge',
        label: `Board bridge: ${person.name}`,
        detail: person.evidence,
        strength: person.lastContactAt && (daysSince(person.lastContactAt) ?? 999) <= 180 ? 85 : 75,
        sourceUrl: null,
        verified: true,
      });
    }
    for (const bridge of organisationBridges.slice(0, 3)) {
      paths.unshift({
        id: `organisation-bridge:${foundation.foundation_id}:${normaliseFunderIdentity(bridge.act_contact)}:${normaliseFunderIdentity(bridge.connector_name)}`,
        kind: 'board_bridge',
        label: `Test via ${bridge.act_contact}`,
        detail: `ACT knows ${bridge.act_contact} at ${bridge.bridge_org}; ${bridge.connector_name} holds a current role there and at ${foundation.name}. This is a source-backed introduction hypothesis, not proof of a personal tie.`,
        strength: bridge.last_contacted_at && (daysSince(bridge.last_contacted_at) ?? 999) <= 180 ? 80 : 70,
        sourceUrl: null,
        verified: false,
      });
    }

    const fundedAct = rawSignals.some((signal) => signal.signal_type === 'act_funded');
    const state = relationshipState(lastContactAt, directPeople.length, rawSignals.length + bridgePeople.length + organisationBridges.length, fundedAct);
    const introductionPerson = bridgePeople[0]?.name ?? organisationBridges[0]?.act_contact ?? null;
    const action = recommendFunderAction({
      state,
      nextStep: foundation.next_step,
      nextTouchAt: foundation.next_touch_at,
      people: people.length,
      directContacts: directPeople.length,
      verifiedIntroductions: bridgePeople.length + organisationBridges.length,
      introductionPerson,
      introductionKind: bridgePeople.length > 0 ? 'known_officeholder' : organisationBridges.length > 0 ? 'shared_organisation' : undefined,
      grantees: numberValue(foundation.grantee_count),
      programs: numberValue(foundation.program_count),
      applicationPaths: numberValue(foundation.application_path_count),
    });
    const score = evidenceScore({
      foundation,
      people: people.length,
      events: gmailEventRows.length + interactionHistory.length,
      grantees: numberValue(foundation.grantee_count),
      programs: numberValue(foundation.program_count),
      applicationPaths: numberValue(foundation.application_path_count),
      paths: paths.length,
    });
    const gaps = [
      !foundation.description ? 'useful foundation description' : null,
      stringArray(foundation.scraped_urls).length === 0 ? 'source-backed web evidence' : null,
      numberValue(foundation.grantee_count) === 0 ? 'recent grantees' : null,
      numberValue(foundation.program_count) === 0 ? 'current programs' : null,
      numberValue(foundation.application_path_count) === 0 ? 'application pathway' : null,
      people.length === 0 ? 'named decision-maker' : null,
      directPeople.length === 0 && bridgePeople.length === 0 && organisationBridges.length === 0 ? 'verified contact or introduction route' : null,
      gmailEventRows.length === 0 ? 'mailbox conversation context' : null,
      paths.length === 0 ? 'verified warm path' : null,
      numberValue(foundation.annual_report_years) === 0 ? 'annual-report history' : null,
    ].filter((value): value is string => Boolean(value));

    const sourceAudit: ActFunderSourceAudit[] = [
      { key: 'profile', label: 'Foundation profile', count: foundation.website ? 1 : 0, covered: foundation.website ? 1 : 0, total: 1, status: foundation.website && foundation.description ? 'strong' : foundation.website ? 'partial' : 'missing', latestAt: foundation.enriched_at, detail: foundation.enriched_at ? `Enriched ${foundation.enriched_at.slice(0, 10)}` : 'No enrichment timestamp' },
      { key: 'grantees', label: 'Funding history', count: numberValue(foundation.grantee_count), covered: numberValue(foundation.grantee_count) > 0 ? 1 : 0, total: 1, status: numberValue(foundation.grantee_count) > 0 ? 'strong' : 'missing', latestAt: null, detail: `${numberValue(foundation.grantee_count).toLocaleString()} source-backed grantee rows` },
      { key: 'programs', label: 'Programs and route', count: numberValue(foundation.program_count), covered: numberValue(foundation.application_path_count) > 0 ? 1 : 0, total: 1, status: numberValue(foundation.application_path_count) > 0 ? 'strong' : numberValue(foundation.program_count) > 0 ? 'partial' : 'missing', latestAt: null, detail: `${numberValue(foundation.program_count)} programs · ${numberValue(foundation.application_path_count)} with an application path` },
      { key: 'people', label: 'People', count: people.length, covered: people.length > 0 ? 1 : 0, total: 1, status: directPeople.length > 0 || bridgePeople.length > 0 ? 'strong' : people.length > 0 ? 'partial' : 'missing', latestAt: lastContactAt, detail: `${directPeople.length} relationship contact${directPeople.length === 1 ? '' : 's'} · ${bridgePeople.length} verified board bridge${bridgePeople.length === 1 ? '' : 's'} · ${registryPeople.length} registry officeholders` },
      { key: 'mail', label: 'Conversation evidence', count: gmailEventRows.length, covered: gmailEventRows.length > 0 ? 1 : 0, total: 1, status: gmailEventRows.length > 0 ? sourceStatus(1, 1, lastContactAt) : 'missing', latestAt: lastContactAt, detail: `${gmailEventRows.length} structured mailbox event${gmailEventRows.length === 1 ? '' : 's'}` },
      { key: 'knowledge', label: 'Internal knowledge', count: knowledgeEventRows.length, covered: knowledgeEventRows.length > 0 ? 1 : 0, total: 1, status: knowledgeEventRows.length > 0 ? 'strong' : 'missing', latestAt: knowledgeEventRows.map((event) => event.happened_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null, detail: `${knowledgeEventRows.length} linked Notion page${knowledgeEventRows.length === 1 ? '' : 's'}` },
      { key: 'outcomes', label: 'Recorded outcomes', count: interactionHistory.length, covered: interactionHistory.length > 0 ? 1 : 0, total: 1, status: interactionHistory.length > 0 ? 'strong' : 'missing', latestAt: interactionHistory[0]?.happenedAt ?? null, detail: `${interactionHistory.length} meeting, reply, proposal, or decision record${interactionHistory.length === 1 ? '' : 's'}` },
      { key: 'graph', label: 'CivicGraph path', count: numberValue(foundation.board_role_count), covered: paths.length > 0 ? 1 : 0, total: 1, status: bridgePeople.length > 0 ? 'strong' : paths.length > 0 ? 'partial' : 'missing', latestAt: null, detail: `${numberValue(foundation.board_role_count)} board/officeholder roles · ${bridgePeople.length} verified person bridge${bridgePeople.length === 1 ? '' : 's'} · ${organisationBridges.length} organisation path${organisationBridges.length === 1 ? '' : 's'} to test` },
    ];

    return {
      foundationId: foundation.foundation_id,
      relationshipRecordId: foundation.relationship_record_id,
      projectId: foundation.project_id,
      entityId: foundation.entity_id,
      name: foundation.name,
      abn: foundation.acnc_abn,
      website: foundation.website,
      description: foundation.description,
      annualGiving: foundation.total_giving_annual == null ? null : numberValue(foundation.total_giving_annual),
      thematicFocus: stringArray(foundation.thematic_focus),
      geographicFocus: stringArray(foundation.geographic_focus),
      targetRecipients: stringArray(foundation.target_recipients),
      givingPhilosophy: foundation.giving_philosophy,
      applicationTips: foundation.application_tips,
      sourceUrls: stringArray(foundation.scraped_urls),
      enrichedAt: foundation.enriched_at,
      projects: stringArray(foundation.projects),
      stages: stringArray(foundation.stages),
      engagementStatuses: stringArray(foundation.engagement_statuses),
      fitScore: numberValue(foundation.fit_score),
      active: !stringArray(foundation.stages).every((stage) => ['parked', 'saved'].includes(stage)),
      nextStep: foundation.next_step,
      nextTouchAt: foundation.next_touch_at,
      lastInteractionAt: foundation.last_interaction_at,
      relationshipState: state,
      relationshipScore: Math.min(100, Math.max(numberValue(foundation.snapshot_score), state === 'active' ? 75 : state === 'warm' ? 55 : state === 'known' ? 30 : 0)),
      evidenceScore: score,
      recommendedAction: action.action,
      whyNow: action.why,
      evidenceGaps: gaps,
      granteeCount: numberValue(foundation.grantee_count),
      granteeAmount: numberValue(foundation.grantee_amount),
      latestGrantYear: foundation.latest_grant_year == null ? null : numberValue(foundation.latest_grant_year),
      programCount: numberValue(foundation.program_count),
      openProgramCount: numberValue(foundation.open_program_count),
      applicationPathCount: numberValue(foundation.application_path_count),
      annualReportYears: numberValue(foundation.annual_report_years),
      latestReportYear: foundation.latest_report_year == null ? null : numberValue(foundation.latest_report_year),
      boardRoleCount: numberValue(foundation.board_role_count),
      pipelineCount: numberValue(foundation.pipeline_count),
      people,
      grantees: granteesByFoundation.get(foundation.foundation_id) ?? [],
      programs: programsByFoundation.get(foundation.foundation_id) ?? [],
      interactions: interactionHistory.slice(0, 10),
      paths: paths.slice(0, 10),
      sourceAudit,
    };
  }).sort((left, right) => {
    const stateRank: Record<ActFunderRelationshipState, number> = { active: 4, warm: 3, known: 2, cold: 1 };
    return Number(right.active) - Number(left.active)
      || stateRank[right.relationshipState] - stateRank[left.relationshipState]
      || right.fitScore - left.fitScore
      || right.evidenceScore - left.evidenceScore
      || left.name.localeCompare(right.name);
  });

  const global = globalRows?.[0] ?? {};
  const latestFailedAgents = (agentRows ?? []).filter((row) => ['failed', 'timed_out'].includes(String(row.status ?? '').toLowerCase()));
  const total = dossiers.length;
  const sourceAudit: ActFunderSourceAudit[] = [
    { key: 'profiles', label: 'Foundation profiles', count: total, covered: dossiers.filter((row) => row.website && row.thematicFocus.length > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.website && row.thematicFocus.length > 0).length, total), latestAt: dossiers.map((row) => row.enrichedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null, detail: 'Registry, giving, focus, geography and enriched web profiles.' },
    { key: 'scraping', label: 'Scraped sources', count: dossiers.reduce((sum, row) => sum + row.sourceUrls.length, 0), covered: dossiers.filter((row) => row.sourceUrls.length > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.sourceUrls.length > 0).length, total), latestAt: null, detail: 'Source URLs retained on each foundation profile.' },
    { key: 'grantees', label: 'Who they fund', count: dossiers.reduce((sum, row) => sum + row.granteeCount, 0), covered: dossiers.filter((row) => row.granteeCount > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.granteeCount > 0).length, total), latestAt: null, detail: 'Annual reports, official grants databases and verified grant surfaces.' },
    { key: 'people', label: 'Named people', count: dossiers.reduce((sum, row) => sum + row.people.length, 0), covered: dossiers.filter((row) => row.people.length > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.people.length > 0).length, total), latestAt: null, detail: 'Registry officeholders and foundation pages are research leads; GHL, Gmail, and portfolio records are relationship contacts.' },
    { key: 'programs', label: 'Programs and application paths', count: dossiers.reduce((sum, row) => sum + row.programCount, 0), covered: dossiers.filter((row) => row.applicationPathCount > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.applicationPathCount > 0).length, total), latestAt: null, detail: 'Current programs, deadlines and ways to engage.' },
    { key: 'gmail', label: 'Mailbox mirror', count: numberValue(global.gmail_messages), covered: dossiers.filter((row) => row.sourceAudit.find((source) => source.key === 'mail')?.count).length, total, status: sourceStatus(dossiers.filter((row) => row.sourceAudit.find((source) => source.key === 'mail')?.count).length, total, textValue(global.gmail_latest)), latestAt: textValue(global.gmail_latest), detail: 'Structured events are used; raw mailbox content is not displayed.' },
    { key: 'ghl', label: 'GoHighLevel', count: numberValue(global.ghl_contacts), covered: dossiers.filter((row) => row.people.some((person) => person.source === 'ghl')).length, total, status: sourceStatus(dossiers.filter((row) => row.people.some((person) => person.source === 'ghl')).length, total, textValue(global.ghl_latest)), latestAt: textValue(global.ghl_latest), detail: 'CRM identities, tags and last-contact evidence.' },
    { key: 'graph', label: 'CivicGraph people and paths', count: numberValue(global.board_roles), covered: dossiers.filter((row) => row.paths.length > 0).length, total, status: sourceStatus(dossiers.filter((row) => row.paths.length > 0).length, total), latestAt: null, detail: 'Board roles, funding signals and verified relationship paths.' },
    { key: 'notion', label: 'Notion organisations', count: numberValue(global.notion_organisations), covered: numberValue(global.notion_organisations), total: Math.max(numberValue(global.notion_organisations), 1), status: sourceStatus(numberValue(global.notion_organisations), Math.max(numberValue(global.notion_organisations), 1), textValue(global.notion_latest)), latestAt: textValue(global.notion_latest), detail: 'Internal organisation records remain supporting context, not the source of truth.' },
    { key: 'agents', label: 'Enrichment jobs', count: (agentRows ?? []).length, covered: Math.max(0, (agentRows ?? []).length - latestFailedAgents.length), total: Math.max((agentRows ?? []).length, 1), status: latestFailedAgents.length > 0 ? 'partial' : 'strong', latestAt: textValue(agentRows?.[0]?.started_at), detail: latestFailedAgents.length > 0 ? `${latestFailedAgents.length} recent failed or timed-out run${latestFailedAgents.length === 1 ? '' : 's'} need attention.` : 'Recent relationship jobs completed successfully.' },
  ];

  const withContacts = dossiers.filter((row) => row.people.some((person) => ['gmail', 'contact', 'ghl', 'portfolio'].includes(person.source))).length;
  const withWarmPath = dossiers.filter((row) => row.paths.some((path) => path.verified || path.kind === 'direct_contact')).length;
  const contactResolutionItems = buildContactResolutionItems(contactResolutionRows ?? []);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      candidates: total,
      active: dossiers.filter((row) => row.active).length,
      withContacts,
      withFundingHistory: dossiers.filter((row) => row.granteeCount > 0).length,
      withNamedPeople: dossiers.filter((row) => row.people.length > 0).length,
      withWarmPath,
      needingEnrichment: dossiers.filter((row) => row.evidenceScore < 60).length,
    },
    globalCoverage: {
      foundations: numberValue(global.foundations),
      websites: numberValue(global.websites),
      descriptions: numberValue(global.descriptions),
      focusAreas: numberValue(global.focus_areas),
      scrapedSources: numberValue(global.scraped_sources),
      granteeRows: numberValue(global.grantee_rows),
      foundationPeople: numberValue(global.foundation_people),
      boardRoles: numberValue(global.board_roles),
      ghlContacts: numberValue(global.ghl_contacts),
      gmailMessages: numberValue(global.gmail_messages),
      notionOrganisations: numberValue(global.notion_organisations),
    },
    sourceAudit,
    contactResolution: {
      total: contactResolutionItems.length,
      suggested: contactResolutionItems.filter((item) => item.status === 'suggested').length,
      ambiguous: contactResolutionItems.filter((item) => item.status === 'ambiguous').length,
      research: contactResolutionItems.filter((item) => item.status === 'research').length,
      items: contactResolutionItems,
    },
    dossiers,
  };
}

const getCachedActFunderIntelligence = unstable_cache(
  loadActFunderIntelligence,
  ['act-funder-intelligence-v5'],
  { revalidate: 300, tags: ['act-funder-intelligence'] },
);

export const getActFunderIntelligence = cache(getCachedActFunderIntelligence);
