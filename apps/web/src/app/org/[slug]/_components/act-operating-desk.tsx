import Link from 'next/link';
import type { ReactNode } from 'react';
import type { OrgFinancialPulse } from '@/lib/services/org-income-service';
import type { OutstandingReceivablesData, ReceivablePayer } from '@/lib/services/org-receivables-service';
import type { OrgVerificationStatus } from '@/lib/services/org-verification-service';
import type {
  ActOpportunityContextEvent,
  ActOpportunityContextSource,
  ActOpportunityContextSourceStatus,
  ActOpportunityContextStatus,
  ActOpportunityContextStep,
} from '@/lib/services/act-opportunity-context';
import type {
  MatchedGrant,
  OrgContactWithEntity,
  OrgOpportunityDecision,
  OrgPipelineItemWithEntity,
  OrgProfile,
  OrgProjectFoundationPortfolioRow,
  OrgProjectSummary,
} from '@/lib/services/org-dashboard-service';
import type { WikiSupportAction, WikiSupportIndex, WikiSupportRouteType } from '@/lib/services/wiki-support-index';
import type { WikiSupportFrontierQueue } from '@/lib/services/wiki-support-frontier';
import type { ActDailyActionMemory, ActDailyActionStates } from '@/lib/services/act-daily-actions';
import {
  comparePipelineWork,
  isWorkingPipelineItem,
  pipelineNeedsPlan,
  pipelineSuggestedNextAction,
} from '@/lib/services/act-pipeline-learning';
import {
  applyDecisionMemory,
  movePriority,
  relationshipActionHandled,
} from '@/lib/services/act-recommendation-memory';
import { ActRecordReview, type ActReviewRecord } from './act-record-review';
import { ActRelationshipActionButtons } from './act-relationship-action-buttons';
import { ActActionQueue, type ActActionConnectionContext } from './act-action-queue';
import { ActTodayFocus, type ActTodayFocusItem } from './act-today-focus';

const CLOSED_PIPELINE_STATUSES = new Set(['won', 'lost', 'declined', 'archived', 'no-go', 'passed']);

type WorkLane =
  | 'grant'
  | 'foundation'
  | 'procurement'
  | 'capital'
  | 'relationship'
  | 'evidence'
  | 'systems'
  | 'pipeline';

type SourceKind = 'supabase' | 'wiki' | 'grant' | 'foundation' | 'highlevel' | 'notion' | 'gmail' | 'xero' | 'goods';
type HealthStatus = ActOpportunityContextSourceStatus | 'configured' | 'mirror-only' | 'verified';
export type ActDeskView = 'today' | 'opportunities' | 'triage' | 'relationships' | 'pipeline' | 'money' | 'evidence';

type HomeOpportunityRow = ActReviewRecord;
type RelationshipState = HomeOpportunityRow['relationshipState'];
type Readiness = HomeOpportunityRow['readiness'];
type RecommendedMove = HomeOpportunityRow['recommendedMove'];
type RelationshipActionState = 'new_signal' | 'ready_to_reply' | 'meeting_needed' | 'proposal_path' | 'waiting' | 'parked';

interface ContactContextRow {
  id: string;
  signalAt: string | null;
  name: string;
  organisation: string | null;
  system: 'HighLevel' | 'Notion' | 'CivicGraph' | 'Gmail';
  warmth: 'hot' | 'warm' | 'unknown';
  tags: string[];
  lastTouch: string;
  nextTouch: string;
  score: number;
  state: RelationshipActionState;
  whyNow: string;
  recommendedAsk: string;
  lane: string;
  sourceEvidence: string;
}

interface SourceStackRow {
  label: string;
  status: HealthStatus;
  count: number;
  detail: string;
  href: string;
}

interface FocusWorkItem extends ActTodayFocusItem {
  priority: number;
}

export function normalizeActDeskView(value: string | string[] | undefined): ActDeskView {
  const view = Array.isArray(value) ? value[0] : value;
  if (
    view === 'opportunities'
    || view === 'triage'
    || view === 'relationships'
    || view === 'pipeline'
    || view === 'money'
    || view === 'evidence'
  ) {
    return view;
  }
  return 'today';
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ACT';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

function compact(text: string | null | undefined, fallback = 'Not set'): string {
  const value = text?.trim();
  if (!value) return fallback;
  return value.length > 150 ? `${value.slice(0, 147)}...` : value;
}

function tagText(tags: string[]): string {
  return tags.join(' ').toLowerCase();
}

function hasAnyTag(tags: string[], patterns: RegExp[]): boolean {
  const value = tagText(tags);
  return patterns.some((pattern) => pattern.test(value));
}

function sentence(text: string | null | undefined, fallback: string): string {
  const value = compact(text, fallback);
  return value.endsWith('.') ? value : `${value}.`;
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function dueLabel(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return 'No date';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `${days}d`;
}

function recommendedMoveLabel(move: RecommendedMove): string {
  if (move === 'apply_now') return 'Apply now';
  if (move === 'approach_now') return 'Approach now';
  if (move === 'ask_for_intro') return 'Ask for intro';
  if (move === 'build_proof_pack') return 'Build proof pack';
  if (move === 'park') return 'Park';
  return 'Watch';
}

function payerStatus(payer: ReceivablePayer): string {
  if (payer.oldest_days_overdue >= 365) return 'Recovery';
  if (payer.oldest_days_overdue >= 60) return 'Chase now';
  if (payer.oldest_days_overdue > 0) return 'Overdue';
  return 'Not due';
}

function laneLabel(lane: WorkLane): string {
  if (lane === 'procurement') return 'Procurement';
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

function routeTypeToLane(type: WikiSupportRouteType | 'unknown'): WorkLane {
  if (type === 'foundation') return 'foundation';
  if (type === 'procurement') return 'procurement';
  if (type === 'capital') return 'capital';
  if (type === 'evidence') return 'evidence';
  if (type === 'systems') return 'systems';
  return 'grant';
}

function laneClass(lane: WorkLane): string {
  if (lane === 'grant') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (lane === 'foundation' || lane === 'capital') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (lane === 'procurement') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (lane === 'relationship') return 'border-purple-200 bg-purple-50 text-purple-700';
  return 'border-stone-200 bg-stone-50 text-stone-700';
}

function sourceClass(source: SourceKind): string {
  if (source === 'grant' || source === 'supabase') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (source === 'foundation') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (source === 'highlevel') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (source === 'gmail') return 'border-purple-200 bg-purple-50 text-purple-700';
  if (source === 'xero') return 'border-teal-200 bg-teal-50 text-teal-700';
  if (source === 'notion') return 'border-stone-300 bg-white text-stone-700';
  if (source === 'goods') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-stone-200 bg-stone-50 text-stone-700';
}

function healthClass(status: HealthStatus): string {
  if (status === 'ok' || status === 'verified') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'configured' || status === 'mirror-only' || status === 'partial') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (status === 'stale') return 'border-orange-200 bg-orange-50 text-orange-800';
  if (status === 'empty') return 'border-stone-200 bg-stone-50 text-stone-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function relationshipStageLabel(row: OrgProjectFoundationPortfolioRow): string {
  if (row.engagement_status === 'proposal') return 'Proposal';
  if (row.engagement_status === 'meeting') return 'Meeting';
  if (row.stage === 'in_conversation') return 'In conversation';
  if (row.stage === 'approach_now') return 'Approach now';
  if (row.stage === 'priority') return 'Priority';
  if (row.stage === 'parked') return 'Parked';
  return 'Researching';
}

function relationshipAction(row: OrgProjectFoundationPortfolioRow): string {
  return (
    row.next_step
    || row.next_touch_note
    || row.message_alignment
    || row.fit_summary
    || 'Confirm fit, owner, warm path, and next ask.'
  );
}

function flattenProjects(projects: OrgProjectSummary[]): OrgProjectSummary[] {
  return projects.flatMap((project) => [project, ...flattenProjects(project.children)]);
}

function projectFieldRank(project: OrgProjectSummary): number {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/goods/.test(value)) return 0;
  if (/justice/.test(value)) return 1;
  if (/harvest|witta/.test(value)) return 2;
  if (/empathy/.test(value)) return 3;
  if (/civicgraph|civic graph/.test(value)) return 4;
  if (/palm island|picc/.test(value)) return 5;
  return 20;
}

function projectFieldLabel(project: OrgProjectSummary): string {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/australian living map|\balma\b/.test(value)) return 'ALMA';
  if (/palm island|picc/.test(value)) return 'Palm Island';
  if (/empathy/.test(value)) return 'Empathy Ledger';
  if (/civicgraph|civic graph/.test(value)) return 'CivicGraph';
  if (/justice/.test(value)) return 'JusticeHub';
  if (/harvest|witta/.test(value)) return 'Harvest';
  if (/goods/.test(value)) return 'Goods';
  return project.name;
}

function grantDeadline(grant: MatchedGrant): string | null {
  return grant.deadline ?? grant.closes_at ?? null;
}

function grantAmount(grant: MatchedGrant): string {
  if (grant.amount_min && grant.amount_max) return `${fmtMoney(grant.amount_min)}-${fmtMoney(grant.amount_max)}`;
  if (grant.amount_max) return `Up to ${fmtMoney(grant.amount_max)}`;
  if (grant.amount_min) return `From ${fmtMoney(grant.amount_min)}`;
  return 'Amount unknown';
}

function pipelineAmount(item: OrgPipelineItemWithEntity): string {
  return item.amount_display || fmtMoney(item.amount_numeric ?? 0);
}

function isPipelineActive(item: OrgPipelineItemWithEntity): boolean {
  return !CLOSED_PIPELINE_STATUSES.has(item.status.toLowerCase()) && isWorkingPipelineItem(item);
}

function projectCodeFromSlug(slug: string | null | undefined): string {
  const normalized = (slug ?? '').toLowerCase();
  if (normalized.includes('goods')) return 'ACT-GD';
  if (normalized.includes('harvest') || normalized.includes('farm')) return 'ACT-HV';
  if (normalized.includes('justice')) return 'ACT-JH';
  if (normalized.includes('empathy')) return 'ACT-EL';
  if (normalized.includes('civicgraph')) return 'ACT-CG';
  if (normalized.includes('palm')) return 'ACT-PI';
  return 'ACT';
}

function pathwayForLane(lane: WorkLane): ActReviewRecord['pathway'] {
  if (lane === 'foundation') return 'foundation';
  if (lane === 'procurement') return 'procurement';
  if (lane === 'capital') return 'capital';
  if (lane === 'relationship') return 'relationship';
  if (lane === 'grant') return 'grant';
  return 'monitor';
}

function roleForLane(lane: WorkLane): ActReviewRecord['recommendedRole'] {
  if (lane === 'procurement') return 'contractor';
  if (lane === 'foundation' || lane === 'relationship') return 'partner';
  if (lane === 'systems' || lane === 'evidence' || lane === 'pipeline') return 'monitor';
  return 'lead';
}

function sourceTypeFor(source: SourceKind, lane: WorkLane): ActReviewRecord['sourceType'] {
  if (source === 'highlevel') return 'crm';
  if (source === 'supabase') return lane === 'procurement' ? 'procurement' : 'grant';
  if (source === 'xero' || source === 'gmail') return 'wiki';
  if (source === 'grant' || source === 'foundation' || source === 'notion' || source === 'goods' || source === 'wiki') {
    return source;
  }
  return 'wiki';
}

function normalizedTokens(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !['foundation', 'limited', 'australia', 'australian', 'company', 'trust', 'fund', 'incorporated'].includes(token));
}

function contactForOrganisation(contacts: OrgContactWithEntity[], organisation: string | null | undefined): OrgContactWithEntity | null {
  const targetTokens = normalizedTokens(organisation);
  if (targetTokens.length === 0) return null;
  let best: { contact: OrgContactWithEntity; score: number } | null = null;

  for (const contact of contacts) {
    const source = [
      contact.organisation,
      contact.linked_entity_name,
      contact.name,
      contact.email,
      ...(contact.unified_tags ?? []),
    ].filter(Boolean).join(' ');
    const sourceTokens = new Set(normalizedTokens(source));
    const score = targetTokens.reduce((total, token) => total + (sourceTokens.has(token) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { contact, score };
  }

  return best?.contact ?? null;
}

function relationshipFromContact(contact: OrgContactWithEntity | null): RelationshipState {
  if (!contact) return 'cold';
  const engagement = (contact.ghl_engagement_status ?? '').toLowerCase();
  const lastTouch = daysSince(contact.last_contacted_at ?? contact.ghl_last_contact_date);
  if (['hot', 'active', 'meeting', 'proposal'].some((term) => engagement.includes(term))) return 'active';
  if (lastTouch !== null && lastTouch <= 45) return 'active';
  if (lastTouch !== null && lastTouch <= 180) return 'warm';
  if (lastTouch !== null && lastTouch > 180) return 'stale';
  return 'known';
}

function relationshipFromFoundation(row: OrgProjectFoundationPortfolioRow, contacts: OrgContactWithEntity[]): RelationshipState {
  if (['proposal', 'meeting'].includes(row.engagement_status) || row.stage === 'in_conversation') return 'active';
  if (['approached', 'ready_to_approach'].includes(row.engagement_status) || row.stage === 'approach_now') return 'warm';
  const touched = daysSince(row.last_interaction_at ?? row.engagement_updated_at);
  if (touched !== null && touched > 180) return 'stale';
  const contactState = relationshipFromContact(contactForOrganisation(contacts, row.foundation.name));
  if (contactState !== 'cold') return contactState;
  if (row.stage === 'priority' || row.stage === 'saved') return 'known';
  return 'cold';
}

function contactDateScore(value: string | null | undefined): number {
  const days = daysSince(value);
  if (days === null) return 0;
  if (days <= 14) return 22;
  if (days <= 60) return 16;
  if (days <= 180) return 10;
  return 4;
}

function contactTypeScore(contactType: string): number {
  if (contactType === 'advisory') return 46;
  if (contactType === 'governance') return 44;
  if (contactType === 'funder') return 42;
  if (contactType === 'partner') return 38;
  if (contactType === 'advocacy') return 30;
  if (contactType === 'community') return 22;
  return 8;
}

function contactImportanceScore(contact: OrgContactWithEntity, importantOrgs: Set<string>): number {
  const tags = contact.unified_tags ?? [];
  const orgKey = (contact.organisation || contact.linked_entity_name || '').toLowerCase();
  const name = contact.name.trim().toLowerCase();
  const email = contact.email?.toLowerCase() ?? '';
  const role = contact.role?.toLowerCase() ?? '';
  const notes = contact.notes?.toLowerCase() ?? '';
  const engagement = contact.ghl_engagement_status?.toLowerCase() ?? '';
  const newsletterOnly = hasAnyTag(tags, [/newsletter/, /harvest-website/, /interest:membership/, /interest:events/])
    && !hasAnyTag(tags, [/role:(funder|partner|buyer|advisor|supporter)/, /pathway:/, /source:gmail/, /project:act-gd/, /project:act-jh/, /project:act-cg/]);

  if (
    email.endsWith('@act.place')
    || name === 'benjamin knight'
    || name.includes('nicholas marchesi')
    || orgKey === 'axt'
    || orgKey === 'act'
    || orgKey.includes('a curious tractor')
  ) {
    return -100;
  }

  let score = contactTypeScore(contact.contact_type);
  if (importantOrgs.has(orgKey)) score += 40;
  if (contact.organisation || contact.linked_entity_name) score += 14;
  if (role) score += 10;
  if (notes) score += 8;
  score += contactDateScore(contact.last_contacted_at ?? contact.ghl_last_contact_date);

  if (['hot', 'personal-vip'].includes(engagement)) score += 34;
  else if (['warm', 'nurture'].includes(engagement)) score += 18;

  if (/(funder|foundation|philanthropy|philanthropic|grant)/.test(role) || hasAnyTag(tags, [/role:funder/, /funder/, /foundation/])) score += 26;
  if (/(partner|advisor|advisory|governance|director|board)/.test(role) || hasAnyTag(tags, [/role:partner/, /role:advisor/, /governance/])) score += 22;
  if (/(buyer|procurement|supplier)/.test(role) || hasAnyTag(tags, [/role:buyer/, /procurement/, /supplier/, /goods-buyer/])) score += 20;
  if (hasAnyTag(tags, [/source:gmail/, /pathway:gmail/, /warm/, /personal-vip/, /ring:vip/])) score += 20;
  if (hasAnyTag(tags, [/project:act-gd/, /project:act-jh/, /project:act-cg/, /project:act-el/, /project:act-hv/])) score += 10;

  if (!contact.organisation && !contact.email && !contact.phone) score -= 24;
  if (!contact.role && !notes && !contact.last_contacted_at && !contact.ghl_last_contact_date) score -= 14;
  if (newsletterOnly) score -= 34;
  if (name === 'formsweep test' || name === 'unnamed crm contact' || !name) score -= 80;

  return score;
}

function contactWarmth(contact: OrgContactWithEntity, score: number): ContactContextRow['warmth'] {
  const engagement = contact.ghl_engagement_status?.toLowerCase() ?? '';
  if (['hot', 'personal-vip'].includes(engagement) || score >= 86) return 'hot';
  if (['warm', 'nurture'].includes(engagement) || score >= 54 || contact.last_contacted_at || contact.ghl_last_contact_date) return 'warm';
  return 'unknown';
}

function eventWarmth(event: ActOpportunityContextEvent): ContactContextRow['warmth'] {
  if (['warm_intro', 'relationship', 'invitation'].includes(event.signalKind) || event.confidence >= 0.88) return 'hot';
  return 'warm';
}

function eventNextTouch(event: ActOpportunityContextEvent): string {
  const nextTouch = event.metadata.next_touch;
  if (typeof nextTouch === 'string' && nextTouch.trim()) return nextTouch;
  return event.summary;
}

function eventActionState(event: ActOpportunityContextEvent): RelationshipActionState {
  if (event.signalKind === 'warm_intro' || event.signalKind === 'relationship' || event.signalKind === 'reporting') return 'ready_to_reply';
  if (event.signalKind === 'invitation' || event.signalKind === 'event') return 'meeting_needed';
  if (event.signalKind === 'funding_lead') return 'new_signal';
  return 'new_signal';
}

function eventScore(event: ActOpportunityContextEvent): number {
  const kind = event.signalKind === 'warm_intro'
    ? 30
    : event.signalKind === 'relationship' || event.signalKind === 'invitation'
      ? 24
      : event.signalKind === 'funding_lead' || event.signalKind === 'reporting'
        ? 18
        : 8;
  const lane = event.lane === 'foundation' || event.lane === 'procurement' || event.lane === 'arts' ? 14 : 8;
  return 90 + kind + lane + Math.round(event.confidence * 20) + contactDateScore(event.happenedAt);
}

const OPPORTUNITY_EVENT_KINDS = new Set([
  'open_opportunity',
  'procurement_opportunity',
  'capital_opportunity',
  'forecast_opportunity',
]);

function eventMetadataString(event: ActOpportunityContextEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function eventMetadataList(event: ActOpportunityContextEvent, key: string): string[] {
  const value = event.metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function opportunityEventLane(event: ActOpportunityContextEvent): WorkLane {
  if (event.lane === 'grant' || event.lane === 'foundation' || event.lane === 'procurement' || event.lane === 'capital') {
    return event.lane;
  }
  return 'relationship';
}

function opportunityEventRelationship(event: ActOpportunityContextEvent): RelationshipState {
  const value = eventMetadataString(event, 'relationship_state');
  if (value === 'cold' || value === 'known' || value === 'warm' || value === 'active' || value === 'stale') return value;
  if (event.sourceSystem === 'gmail') return 'warm';
  return event.organisation ? 'known' : 'cold';
}

function opportunityEventReadiness(event: ActOpportunityContextEvent): Readiness {
  const value = eventMetadataString(event, 'readiness');
  if (value === 'ready' || value === 'needs_proof' || value === 'needs_applicant' || value === 'needs_relationship' || value === 'park') {
    return value;
  }
  return event.signalKind === 'forecast_opportunity' ? 'needs_relationship' : 'needs_proof';
}

function opportunityEventMove(event: ActOpportunityContextEvent, readiness: Readiness): RecommendedMove {
  const value = eventMetadataString(event, 'recommended_move');
  if (
    value === 'apply_now'
    || value === 'approach_now'
    || value === 'ask_for_intro'
    || value === 'build_proof_pack'
    || value === 'watch'
    || value === 'park'
  ) {
    return value;
  }
  return chooseMove(readiness, opportunityEventLane(event), null, opportunityEventRelationship(event));
}

function opportunityEventSourceType(event: ActOpportunityContextEvent, lane: WorkLane): ActReviewRecord['sourceType'] {
  const value = eventMetadataString(event, 'review_source');
  if (value === 'wiki' || value === 'grant' || value === 'foundation' || value === 'procurement' || value === 'crm' || value === 'notion' || value === 'goods') {
    return value;
  }
  if (lane === 'grant') return 'grant';
  if (lane === 'foundation') return 'foundation';
  if (lane === 'procurement') return 'procurement';
  return event.sourceSystem === 'gmail' ? 'crm' : 'wiki';
}

function buildContextOpportunityRows(
  events: ActOpportunityContextEvent[],
  contacts: OrgContactWithEntity[],
): HomeOpportunityRow[] {
  return events
    .filter((event) => OPPORTUNITY_EVENT_KINDS.has(event.signalKind))
    .map((event) => {
      const lane = opportunityEventLane(event);
      const relationshipState = opportunityEventRelationship(event);
      const readiness = opportunityEventReadiness(event);
      const recommendedMove = opportunityEventMove(event, readiness);
      const confidence = Math.max(50, Math.min(98, Math.round(event.confidence * 100)));
      const score = Math.max(50, Math.min(98, Number(event.metadata.score ?? confidence)));
      const project = eventMetadataString(event, 'project') ?? 'A Curious Tractor';
      const projectCode = eventMetadataString(event, 'project_code') ?? projectCodeFromSlug(project);
      const nextAction = eventMetadataString(event, 'next_touch') ?? eventMetadataString(event, 'next_action') ?? event.summary;
      const evidenceGaps = eventMetadataList(event, 'evidence_gaps');
      const tags = eventMetadataList(event, 'tags');
      const relationshipContact = contactForOrganisation(contacts, event.organisation ?? event.actorName);

      return {
        id: `context:${event.id}`,
        title: event.title,
        summary: event.summary,
        lane,
        sourceLabel: event.organisation ?? event.sourceSystem,
        sourceType: opportunityEventSourceType(event, lane),
        sourceRef: event.sourceRef,
        sourceUrl: event.sourceUrl,
        score,
        project,
        projectCode,
        role: eventMetadataString(event, 'role') ?? event.signalKind.replaceAll('_', ' '),
        recommendedRole: roleForLane(lane),
        pathway: pathwayForLane(lane),
        amount: eventMetadataString(event, 'amount') ?? 'Value to confirm',
        date: fmtDate(eventMetadataString(event, 'deadline')),
        nextAction,
        relationshipState,
        readiness,
        recommendedMove,
        reason: `${confidence}% source confidence. ${eventMetadataString(event, 'why_now') ?? event.summary}`,
        confidence,
        evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : ['final eligibility check'],
        tags: Array.from(new Set([event.signalKind, event.sourceSystem, ...tags])),
        relationshipId: relationshipContact?.id ?? null,
        relationshipName: relationshipContact?.name ?? event.actorName ?? event.organisation,
      } satisfies HomeOpportunityRow;
    });
}

function dedupeOpportunityRows(rows: HomeOpportunityRow[]): HomeOpportunityRow[] {
  const byTitle = new Map<string, HomeOpportunityRow>();
  const sourceWeight = (row: HomeOpportunityRow) => {
    if (row.id.startsWith('pipeline:')) return 3;
    if (row.id.startsWith('context:')) return 2;
    return 1;
  };

  for (const row of rows) {
    const key = row.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const current = byTitle.get(key);
    if (!current) {
      byTitle.set(key, row);
      continue;
    }
    const rowWeight = sourceWeight(row);
    const currentWeight = sourceWeight(current);
    if (
      rowWeight > currentWeight
      || (rowWeight === currentWeight && row.confidence > current.confidence)
      || (rowWeight === currentWeight && row.confidence === current.confidence && row.score > current.score)
    ) {
      byTitle.set(key, row);
    }
  }
  return [...byTitle.values()];
}

function opportunityQueueSourcePriority(row: HomeOpportunityRow): number {
  if (row.id.startsWith('context:')) return 0;
  if (row.id.startsWith('pipeline:')) return 2;
  return 1;
}

function contactLane(contact: OrgContactWithEntity): string {
  const tags = contact.unified_tags ?? [];
  const role = contact.role?.toLowerCase() ?? '';
  if (/(funder|foundation|grant|philanthropy)/.test(role) || hasAnyTag(tags, [/role:funder/, /funder/, /foundation/])) return 'foundation';
  if (/(buyer|procurement|supplier|goods)/.test(role) || hasAnyTag(tags, [/role:buyer/, /procurement/, /supplier/, /goods-buyer/, /project:act-gd/])) return 'procurement';
  if (/(artist|arts|festival|creative|culture)/.test(role) || hasAnyTag(tags, [/arts/, /festival/, /creative/])) return 'arts';
  if (/(governance|director|board|advisor|advisory)/.test(role) || contact.contact_type === 'advisory' || contact.contact_type === 'governance') return 'governance';
  if (hasAnyTag(tags, [/project:act-jh/, /justice/])) return 'justice';
  return contact.contact_type === 'partner' ? 'relationship' : contact.contact_type;
}

function informativeContactNote(contact: OrgContactWithEntity): string | null {
  const note = contact.notes?.trim();
  if (!note) return null;
  if (/^source:\s*ghl$/i.test(note)) return null;
  return note;
}

function contactActionState(contact: OrgContactWithEntity, score: number): RelationshipActionState {
  const tags = contact.unified_tags ?? [];
  const lane = contactLane(contact);
  if (hasAnyTag(tags, [/source:gmail/, /pathway:gmail/, /warm_intro/, /personal-vip/])) return 'ready_to_reply';
  if (lane === 'foundation' && score >= 70) return 'proposal_path';
  if (lane === 'procurement' && score >= 62) return 'ready_to_reply';
  if (lane === 'governance' || contact.contact_type === 'advisory') return 'meeting_needed';
  if (contact.last_contacted_at || contact.ghl_last_contact_date) return 'waiting';
  return 'new_signal';
}

function contactRecommendedAsk(contact: OrgContactWithEntity, lane: string, state: RelationshipActionState): string {
  const note = informativeContactNote(contact);
  if (note) return note;
  if (state === 'proposal_path') return 'Confirm the funder fit, warm path, and next ask.';
  if (state === 'ready_to_reply' && lane === 'procurement') return 'Confirm the buyer need, price/options, and next decision point.';
  if (state === 'ready_to_reply' && lane === 'foundation') return 'Clarify the warm path, right project, and next funding conversation.';
  if (state === 'meeting_needed') return 'Book a short check-in and clarify the useful next contribution.';
  if (contact.role) return contact.role;
  return 'Confirm relationship context and next touch.';
}

function contactWhyNow(contact: OrgContactWithEntity, lane: string): string {
  const note = informativeContactNote(contact);
  if (note) return note;
  if (contact.role) return contact.role;
  if (lane === 'foundation') return 'HighLevel tags identify this as a funder or foundation relationship.';
  if (lane === 'procurement') return 'HighLevel tags identify this as a buyer, supplier, or Goods relationship.';
  if (lane === 'arts') return 'HighLevel tags identify this as an arts, festival, or creative relationship.';
  return contact.source_label || `${contact.contact_type} relationship signal`;
}

function dedupeContactRows(rows: ContactContextRow[]): ContactContextRow[] {
  const byKey = new Map<string, ContactContextRow>();
  for (const row of rows) {
    const key = [row.name.toLowerCase().trim(), row.organisation?.toLowerCase().trim() ?? ''].join('|');
    const current = byKey.get(key);
    if (!current || row.score > current.score) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function grantReadiness(grant: MatchedGrant, relationship: RelationshipState): Readiness {
  const fit = Number(grant.fit_score ?? 0);
  const days = daysUntil(grantDeadline(grant));
  if (fit < 55) return 'park';
  if (relationship === 'cold' && fit < 75) return 'needs_relationship';
  if ((days !== null && days <= 21) || !grant.description) return 'needs_proof';
  return 'ready';
}

function foundationReadiness(row: OrgProjectFoundationPortfolioRow, relationship: RelationshipState): Readiness {
  if (row.stage === 'parked' && !row.next_step && !row.next_touch_note) return 'park';
  const research = row.research;
  if (!research) return relationship === 'cold' ? 'needs_relationship' : 'needs_proof';
  if (research.relationship_status === 'missing' || relationship === 'cold') return 'needs_relationship';
  if (research.applicant_status === 'missing') return 'needs_applicant';
  if (research.proof_status !== 'ready' || research.ask_status !== 'ready') return 'needs_proof';
  return 'ready';
}

function pipelineReadiness(item: OrgPipelineItemWithEntity, relationship: RelationshipState): Readiness {
  if (item.status.toLowerCase() === 'passed') return 'park';
  if (relationship === 'cold' && item.funder) return 'needs_relationship';
  if (!item.notes || !item.deadline) return 'needs_proof';
  return 'ready';
}

function chooseMove(readiness: Readiness, lane: WorkLane, days: number | null, relationship: RelationshipState): RecommendedMove {
  if (readiness === 'park') return 'park';
  if (readiness === 'needs_relationship') return relationship === 'known' || relationship === 'warm' ? 'approach_now' : 'ask_for_intro';
  if (readiness === 'needs_proof' || readiness === 'needs_applicant') return 'build_proof_pack';
  if (lane === 'foundation' || lane === 'relationship' || lane === 'procurement') return 'approach_now';
  if (days !== null && days <= 60) return 'apply_now';
  return 'watch';
}

function confidenceFrom(score: number, readiness: Readiness, relationship: RelationshipState): number {
  let confidence = Math.round(score);
  if (readiness === 'ready') confidence += 6;
  if (readiness === 'park') confidence -= 18;
  if (relationship === 'active') confidence += 8;
  if (relationship === 'warm') confidence += 4;
  if (relationship === 'cold') confidence -= 10;
  return Math.max(20, Math.min(95, confidence));
}

function relationshipText(state: RelationshipState): string {
  if (state === 'active') return 'active relationship';
  if (state === 'warm') return 'warm relationship';
  if (state === 'known') return 'known contact path';
  if (state === 'stale') return 'stale relationship';
  return 'cold relationship';
}

function readinessText(readiness: Readiness): string {
  if (readiness === 'ready') return 'ready to act';
  if (readiness === 'needs_proof') return 'needs proof pack';
  if (readiness === 'needs_applicant') return 'needs applicant entity';
  if (readiness === 'needs_relationship') return 'needs relationship path';
  return 'park unless strategy changes';
}

function deskViewHref(slug: string, view: ActDeskView, hash?: string): string {
  const anchor = hash ? `#${hash}` : '';
  return `/org/${slug}${view === 'today' ? '' : `?view=${view}`}${anchor}`;
}

function deskRelationshipHref(slug: string, relationshipId: string): string {
  return `/org/${slug}?view=relationships&relationship=${encodeURIComponent(relationshipId)}#relationships`;
}

function buildOpportunityRows({
  matchedGrants,
  foundationPortfolio,
  pipeline,
  contacts,
  decisions,
  contextEvents,
  projects,
}: {
  matchedGrants: MatchedGrant[];
  foundationPortfolio: OrgProjectFoundationPortfolioRow[];
  pipeline: OrgPipelineItemWithEntity[];
  contacts: OrgContactWithEntity[];
  decisions?: OrgOpportunityDecision[];
  contextEvents: ActOpportunityContextEvent[];
  projects: OrgProjectSummary[];
}): HomeOpportunityRow[] {
  const contextRows = buildContextOpportunityRows(contextEvents, contacts);
  const grantRows: HomeOpportunityRow[] = matchedGrants.slice(0, 8).map((grant) => {
    const relationshipContact = contactForOrganisation(contacts, grant.provider);
    const relationshipState = relationshipFromContact(relationshipContact);
    const readiness = grantReadiness(grant, relationshipState);
    const deadlineDays = daysUntil(grantDeadline(grant));
    const score = Math.max(40, Math.min(95, Number(grant.fit_score ?? 70)));
    const recommendedMove = chooseMove(readiness, 'grant', deadlineDays, relationshipState);
    const evidenceGaps = [
      readiness === 'needs_relationship' ? 'relationship path' : null,
      readiness === 'needs_proof' ? 'eligibility proof' : null,
      !grant.description ? 'program detail' : null,
      grant.amount_min == null && grant.amount_max == null ? 'ask size' : null,
    ].filter(Boolean) as string[];

    return {
      id: `grant:${grant.id}`,
      title: grant.name,
      summary: grant.description || grant.focus_areas?.slice(0, 4).join(', ') || 'Grant opportunity match',
      lane: 'grant',
      sourceLabel: grant.provider || 'Grant index',
      sourceType: 'grant',
      sourceRef: grant.id,
      sourceUrl: grant.url || `/grants/${grant.id}`,
      score,
      project: grant.categories?.[0] || 'ACT',
      projectCode: 'ACT',
      role: 'lead or partner',
      recommendedRole: 'lead',
      pathway: 'grant',
      amount: grantAmount(grant),
      date: fmtDate(grantDeadline(grant)),
      nextAction: readiness === 'ready'
        ? 'Confirm eligibility and move into the application pipeline.'
        : 'Clear relationship, eligibility, and proof gaps before spending application time.',
      relationshipState,
      readiness,
      recommendedMove,
      reason: [
        `${score}% grant fit.`,
        deadlineDays === null ? 'No close date loaded.' : `${deadlineDays < 0 ? Math.abs(deadlineDays) : deadlineDays}d ${deadlineDays < 0 ? 'past close' : 'to close'}.`,
        sentence(relationshipText(relationshipState), 'Relationship unknown'),
        sentence(readinessText(readiness), 'Readiness unknown'),
      ].join(' '),
      confidence: confidenceFrom(score, readiness, relationshipState),
      evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : ['final eligibility check'],
      tags: ['grant', ...(grant.categories ?? []).slice(0, 3)],
      relationshipId: relationshipContact?.id ?? null,
      relationshipName: relationshipContact?.name ?? grant.provider,
    };
  });

  const foundationRows: HomeOpportunityRow[] = foundationPortfolio
    .filter((row) => row.stage !== 'parked' || row.next_step || row.next_touch_note)
    .slice(0, 8)
    .map((row) => {
      const relationshipContact = contactForOrganisation(contacts, row.foundation.name);
      const relationshipState = relationshipFromFoundation(row, contacts);
      const readiness = foundationReadiness(row, relationshipState);
      const score = Math.max(45, Math.min(98, Number(row.fit_score ?? 65)));
      const recommendedMove = chooseMove(readiness, 'foundation', daysUntil(row.next_touch_at), relationshipState);
      const missingItems = row.research?.missing_items?.slice(0, 4) ?? [];
      const evidenceGaps = missingItems.length > 0
        ? missingItems
        : readiness === 'ready'
          ? []
          : ['warm path', 'ask size', 'proof pack'];

      return {
        id: `foundation:${row.id}`,
        title: row.foundation.name,
        summary: compact(row.fit_summary || row.message_alignment, 'Philanthropic relationship row'),
        lane: 'foundation',
        sourceLabel: 'Foundation tracker',
        sourceType: 'foundation',
        sourceRef: row.id,
        sourceUrl: '?view=relationships#relationships',
        score,
        project: row.project.name,
        projectCode: projects.find((project) => project.slug === row.project.slug)?.code ?? projectCodeFromSlug(row.project.slug),
        role: relationshipStageLabel(row),
        recommendedRole: 'partner',
        pathway: 'foundation',
        amount: row.foundation.total_giving_annual ? `${fmtMoney(row.foundation.total_giving_annual)} giving` : 'Ask unknown',
        date: fmtDate(row.next_touch_at),
        nextAction: relationshipAction(row),
        relationshipState,
        readiness,
        recommendedMove,
        reason: [
          `${score}% foundation fit.`,
          sentence(relationshipStageLabel(row), 'Relationship stage unknown'),
          sentence(relationshipText(relationshipState), 'Relationship unknown'),
          sentence(readinessText(readiness), 'Readiness unknown'),
        ].join(' '),
        confidence: confidenceFrom(score, readiness, relationshipState),
        evidenceGaps,
        tags: ['foundation', row.stage, row.engagement_status],
        relationshipId: relationshipContact?.id ?? null,
        relationshipName: relationshipContact?.name ?? row.foundation.name,
      };
    });

  const pipelineRows: HomeOpportunityRow[] = pipeline
    .filter((item) => {
      if (!isPipelineActive(item)) return false;
      const days = daysUntil(item.deadline);
      return days === null || days >= 0;
    })
    .slice(0, 8)
    .map((item) => {
      const lane: WorkLane = item.funder_type === 'foundation' ? 'foundation' : 'pipeline';
      const source: SourceKind = item.grant_url ? 'grant' : 'notion';
      const relationshipContact = contactForOrganisation(contacts, item.funder || item.grant_provider);
      const relationshipState = relationshipFromContact(relationshipContact);
      const linkedProject = projects.find((project) => project.id === item.project_id || project.code === item.project_code);
      const readiness = pipelineReadiness(item, relationshipState);
      const deadlineDays = daysUntil(item.deadline);
      const score = item.deadline ? 74 : 58;
      const recommendedMove = chooseMove(readiness, lane, deadlineDays, relationshipState);
      const evidenceGaps = [
        !item.notes ? 'next-step note' : null,
        !item.owner_name ? 'owner' : null,
        !item.next_action ? 'next action' : null,
        !item.next_action_at ? 'next action date' : null,
        !item.deadline ? 'deadline' : null,
        relationshipState === 'cold' && item.funder ? 'relationship path' : null,
      ].filter(Boolean) as string[];
      return {
        id: `pipeline:${item.id}`,
        title: item.name,
        summary: compact(item.notes || item.grant_name || item.funder, 'Tracked pipeline item'),
        lane,
        sourceLabel: item.grant_url ? 'Pipeline + grant source' : 'ACT pipeline',
        sourceType: sourceTypeFor(source, lane),
        sourceRef: item.grant_opportunity_id ?? item.id,
        sourceUrl: item.grant_url || '?view=pipeline#pipeline',
        score,
        project: linkedProject?.name ?? item.project_code ?? 'ACT',
        projectCode: linkedProject?.code ?? item.project_code ?? 'ACT',
        role: item.status,
        recommendedRole: roleForLane(lane),
        pathway: pathwayForLane(lane),
        amount: pipelineAmount(item),
        date: fmtDate(item.deadline),
        nextAction: item.next_action || 'Move status, confirm owner, or close if stale.',
        relationshipState,
        readiness,
        recommendedMove,
        reason: [
          `Tracked ${item.status} row.`,
          deadlineDays === null ? 'No deadline loaded.' : `${deadlineDays < 0 ? Math.abs(deadlineDays) : deadlineDays}d ${deadlineDays < 0 ? 'overdue' : 'to deadline'}.`,
          sentence(relationshipText(relationshipState), 'Relationship unknown'),
          sentence(readinessText(readiness), 'Readiness unknown'),
        ].join(' '),
        confidence: confidenceFrom(score, readiness, relationshipState),
        evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : ['status decision'],
        tags: ['pipeline', item.status, item.funder_type ?? 'unknown'],
        relationshipId: relationshipContact?.id ?? null,
        relationshipName: relationshipContact?.name ?? item.funder ?? item.grant_provider,
      };
    });

  return dedupeOpportunityRows(
    [...contextRows, ...grantRows, ...foundationRows, ...pipelineRows]
      .map((row) => applyDecisionMemory(row, decisions)),
  )
    .sort((left, right) =>
      opportunityQueueSourcePriority(left) - opportunityQueueSourcePriority(right)
      || movePriority(left.recommendedMove) - movePriority(right.recommendedMove)
      || right.confidence - left.confidence
      || right.score - left.score
      || left.title.localeCompare(right.title),
    )
    .slice(0, 12);
}

function buildContactContext(
  contacts: OrgContactWithEntity[],
  foundationPortfolio: OrgProjectFoundationPortfolioRow[],
  contextEvents: ActOpportunityContextEvent[],
  decisions: OrgOpportunityDecision[],
): ContactContextRow[] {
  const importantOrgs = new Set(
    foundationPortfolio
      .filter((row) => row.stage !== 'parked' || row.next_step || row.next_touch_note)
      .flatMap((row) => [row.foundation.name, row.applicant_entity?.name])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );

  const eventRows = contextEvents
    .filter((event) => event.signalKind !== 'source_feed' && (event.actorName || event.organisation))
    .map((event): ContactContextRow => {
      const nextTouch = eventNextTouch(event);
      return {
        id: `context:${event.id}`,
        signalAt: event.happenedAt,
        name: event.actorName || event.organisation || event.title,
        organisation: event.organisation,
        system: 'Gmail',
        warmth: eventWarmth(event),
        tags: [event.lane, event.signalKind, event.sourceSystem].filter(Boolean).slice(0, 4),
        lastTouch: fmtDate(event.happenedAt),
        nextTouch,
        score: eventScore(event),
        state: eventActionState(event),
        whyNow: event.summary,
        recommendedAsk: nextTouch,
        lane: event.lane,
        sourceEvidence: `${event.sourceSystem} ${event.signalKind} · ${Math.round(event.confidence * 100)}% confidence`,
      };
    });

  const contactRows = contacts
    .filter((contact) => contact.ghl_contact_id || contact.notion_id || contact.last_contacted_at || contact.contact_type !== 'crm')
    .map((contact): ContactContextRow | null => {
      const score = contactImportanceScore(contact, importantOrgs);
      if (score < 34) return null;
      const lane = contactLane(contact);
      const state = contactActionState(contact, score);
      const recommendedAsk = contactRecommendedAsk(contact, lane, state);
      const system: ContactContextRow['system'] = contact.ghl_contact_id
        ? 'HighLevel'
        : contact.notion_id
          ? 'Notion'
          : 'CivicGraph';

      return {
        id: contact.id,
        signalAt: contact.last_contacted_at ?? contact.ghl_last_contact_date,
        name: contact.name,
        organisation: contact.organisation || contact.linked_entity_name,
        system,
        warmth: contactWarmth(contact, score),
        tags: contact.unified_tags.slice(0, 4),
        lastTouch: fmtDate(contact.last_contacted_at ?? contact.ghl_last_contact_date),
        nextTouch: recommendedAsk,
        score,
        state,
        whyNow: contactWhyNow(contact, lane),
        recommendedAsk,
        lane,
        sourceEvidence: `${system} · ${contact.source_label || contact.contact_type}`,
      };
    })
    .filter((row): row is ContactContextRow => Boolean(row));

  return dedupeContactRows([...eventRows, ...contactRows].filter((row) => !relationshipActionHandled(row, decisions)))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 12);
}

export function ActOperatingDesk({
  profile,
  orgProfileId,
  slug,
  pulse,
  receivables,
  verification,
  foundationPortfolio,
  wikiSupportIndex,
  frontierQueue,
  projects,
  pipeline,
  contacts,
  matchedGrants,
  opportunityDecisions = [],
  opportunityContext,
  view,
  selectedRelationshipId,
  selectedCommitmentId,
  dailyActionStates,
  dailyActionMemory,
}: {
  profile: OrgProfile;
  orgProfileId: string;
  slug: string;
  pulse: OrgFinancialPulse | null;
  receivables: OutstandingReceivablesData | null;
  verification: OrgVerificationStatus | null;
  foundationPortfolio: OrgProjectFoundationPortfolioRow[];
  wikiSupportIndex: WikiSupportIndex;
  frontierQueue: WikiSupportFrontierQueue;
  projects: OrgProjectSummary[];
  pipeline: OrgPipelineItemWithEntity[];
  contacts: OrgContactWithEntity[];
  matchedGrants: MatchedGrant[];
  opportunityDecisions?: OrgOpportunityDecision[];
  opportunityContext?: ActOpportunityContextStatus | null;
  view: ActDeskView;
  selectedRelationshipId?: string;
  selectedCommitmentId?: string;
  dailyActionStates: ActDailyActionStates;
  dailyActionMemory: ActDailyActionMemory;
}) {
  const payerRows = receivables?.payers.slice(0, 8) ?? [];
  const topPayer = [...(receivables?.payers ?? [])]
    .filter((payer) => payer.oldest_days_overdue > 0)
    .sort((left, right) => {
      const actionRank = (days: number) => days >= 60 && days < 365 ? 0 : days >= 365 ? 1 : 2;
      return actionRank(left.oldest_days_overdue) - actionRank(right.oldest_days_overdue)
        || right.total_due - left.total_due
        || right.oldest_days_overdue - left.oldest_days_overdue;
    })[0] ?? null;
  const overdueAmount = pulse?.ar_overdue_60d ?? receivables?.totals.overdue_90d ?? 0;
  const payableGap = verification?.payables.unresolvedTotal ?? pulse?.ap_total ?? 0;
  const paymentProofCount = verification?.payables.exactBankRecMatchCount ?? 0;

  const activeRelationships = foundationPortfolio
    .filter((row) => row.stage !== 'parked' || row.next_step || row.next_touch_note)
    .sort((left, right) => {
      const leftAction = left.next_step || left.next_touch_note ? 1 : 0;
      const rightAction = right.next_step || right.next_touch_note ? 1 : 0;
      return rightAction - leftAction || Number(right.fit_score ?? 0) - Number(left.fit_score ?? 0);
    });
  const relationshipRows = activeRelationships.slice(0, 8);
  const nextRelationship = relationshipRows[0] ?? null;

  const activePipeline = pipeline.filter(isPipelineActive).sort(comparePipelineWork);
  const actionConnectionContexts: ActActionConnectionContext[] = activePipeline.map((item) => {
    const relationshipContact = contactForOrganisation(contacts, item.funder || item.grant_provider);
    const relationshipState = relationshipFromContact(relationshipContact);
    const lane: WorkLane = item.funder_type === 'foundation' ? 'foundation' : 'pipeline';
    const readiness = pipelineReadiness(item, relationshipState);
    return {
      pipelineItemId: item.id,
      relationshipId: relationshipContact?.id ?? null,
      relationshipName: relationshipContact?.name ?? item.funder ?? item.grant_provider,
      relationshipState,
      recommendedMove: chooseMove(readiness, lane, daysUntil(item.deadline), relationshipState),
      evidenceGaps: [
        !item.notes ? 'next-step note' : null,
        !item.owner_name ? 'owner' : null,
        !item.next_action ? 'next action' : null,
        !item.next_action_at ? 'next action date' : null,
        relationshipState === 'cold' && item.funder ? 'relationship path' : null,
      ].filter((value): value is string => Boolean(value)),
    };
  });
  const unplannedCommitment = activePipeline.find((item) => pipelineNeedsPlan(item)) ?? null;
  const pipelineDueSoon = activePipeline
    .filter((item) => {
      const days = daysUntil(item.deadline);
      return days !== null && days >= -7 && days <= 30;
    })
    .sort((left, right) => (left.deadline ?? '9999-12-31').localeCompare(right.deadline ?? '9999-12-31'));

  const grantDueSoon = matchedGrants
    .filter((grant) => {
      const days = daysUntil(grantDeadline(grant));
      return days !== null && days >= 0 && days <= 90;
    })
    .sort((left, right) => (grantDeadline(left) ?? '9999-12-31').localeCompare(grantDeadline(right) ?? '9999-12-31'))
    .slice(0, 8);

  const allProjectRows = flattenProjects(projects).filter((project) => project.status === 'active');
  const projectRows = allProjectRows.slice(0, 10);
  const opportunityRows = buildOpportunityRows({
    matchedGrants,
    foundationPortfolio,
    pipeline,
    contacts,
    decisions: opportunityDecisions,
    contextEvents: opportunityContext?.recentEvents ?? [],
    projects: allProjectRows,
  });
  const sourceActions = wikiSupportIndex.support_actions.slice(0, 8);
  const fieldProjects = [...projectRows].sort((left, right) => {
    return projectFieldRank(left) - projectFieldRank(right) || left.name.localeCompare(right.name);
  });
  const artProject = fieldProjects.find((project) => /harvest|witta|art/.test(`${project.slug} ${project.name}`.toLowerCase()));
  const contactRows = buildContactContext(
    contacts,
    foundationPortfolio,
    opportunityContext?.recentEvents ?? [],
    opportunityDecisions,
  );
  const selectedContact = contactRows.find((contact) => contact.id === selectedRelationshipId) ?? contactRows[0] ?? null;
  const selectedRelationshipEvents = selectedContact
    ? (opportunityContext?.recentEvents ?? [])
      .filter((event) => {
        const values = [event.actorName, event.organisation].filter(Boolean).join(' ').toLowerCase();
        const contactValues = [selectedContact.name, selectedContact.organisation].filter(Boolean).join(' ').toLowerCase();
        return values.length > 0 && contactValues.length > 0 && (
          values.includes(selectedContact.name.toLowerCase())
          || (selectedContact.organisation ? values.includes(selectedContact.organisation.toLowerCase()) : false)
          || contactValues.includes(values)
        );
      })
      .slice(0, 6)
    : [];
  const connectedOpportunityRows = selectedContact
    ? opportunityRows.filter((opportunity) => {
      const haystack = [opportunity.title, opportunity.summary, opportunity.reason, opportunity.project, ...opportunity.tags].join(' ').toLowerCase();
      const organisation = selectedContact.organisation?.toLowerCase();
      return Boolean(
        (organisation && organisation.length > 4 && haystack.includes(organisation))
        || (selectedContact.name.length > 4 && haystack.includes(selectedContact.name.toLowerCase())),
      );
    })
    : [];
  const relationshipOpportunities = (connectedOpportunityRows.length > 0 ? connectedOpportunityRows : opportunityRows).slice(0, 2);
  const notionRows = contacts.filter((contact) => contact.notion_id).length;
  const highLevelRows = contacts.filter((contact) => contact.ghl_contact_id).length;
  const contextByKey = new Map((opportunityContext?.sources ?? []).map((source) => [source.key, source]));
  const contextSource = (key: ActOpportunityContextSource['key']) => contextByKey.get(key);
  const sourceStatus = (key: ActOpportunityContextSource['key'], fallback: HealthStatus): HealthStatus => {
    return contextSource(key)?.status ?? fallback;
  };
  const sourceCount = (key: ActOpportunityContextSource['key'], fallback: number): number => {
    return contextSource(key)?.count ?? fallback;
  };
  const sourceDetail = (key: ActOpportunityContextSource['key'], fallback: string): string => {
    return contextSource(key)?.detail ?? fallback;
  };
  const sourceStackRows: SourceStackRow[] = [
    {
      label: 'Supabase / CivicGraph',
      status: sourceStatus('grants', 'ok'),
      count: sourceCount('grants', matchedGrants.length + foundationPortfolio.length + pipeline.length + frontierQueue.total),
      detail: sourceDetail('grants', 'Grants, funders, procurement routes, pipeline rows, source frontier.'),
      href: deskViewHref(slug, 'opportunities'),
    },
    {
      label: 'Decision memory',
      status: sourceStatus('decisions', opportunityDecisions.length > 0 ? 'ok' : 'empty'),
      count: sourceCount('decisions', opportunityDecisions.length),
      detail: sourceDetail(
        'decisions',
        opportunityDecisions.length > 0
          ? 'Accept, park, bad-match, and proof-gap choices are feeding recommendation order.'
          : 'No ACT opportunity decisions recorded yet. Use Accept, Park, or Bad match to train the queue.',
      ),
      href: deskViewHref(slug, 'opportunities', 'opportunities'),
    },
    {
      label: 'GoHighLevel',
      status: sourceStatus('ghl', highLevelRows > 0 ? 'mirror-only' : 'empty'),
      count: sourceCount('ghl', highLevelRows),
      detail: sourceDetail('ghl', 'Local CRM mirror for contacts and relationship context.'),
      href: deskViewHref(slug, 'relationships', 'relationships'),
    },
    {
      label: 'Notion',
      status: 'configured',
      count: notionRows,
      detail: 'Project, grant, and people coordination references; not copied as the source of truth.',
      href: deskViewHref(slug, 'evidence', 'systems'),
    },
    {
      label: 'Gmail',
      status: sourceStatus('gmail', verification?.mailbox.status ?? 'blocked'),
      count: sourceCount('gmail', verification ? verification.mailbox.funderOrgsReviewed + verification.mailbox.buyerInvestorOrgsReviewed : 0),
      detail: sourceDetail('gmail', verification?.mailbox.currentSignalSummary ?? 'Mailbox harvest not loaded.'),
      href: deskViewHref(slug, 'relationships', 'relationships'),
    },
    {
      label: 'Xero',
      status: verification?.xero.status ?? 'blocked',
      count: verification?.xero.latestRecordsSynced ?? 0,
      detail: verification?.xero.note ?? 'Xero mirror unavailable.',
      href: deskViewHref(slug, 'money', 'money'),
    },
  ];
  const firstOpportunity = opportunityRows[0] ?? null;
  const nextDeadline = pipelineDueSoon[0]
    ? {
      title: pipelineDueSoon[0].name,
      detail: pipelineDueSoon[0].funder || pipelineDueSoon[0].grant_provider || 'Pipeline item',
      meta: `${pipelineAmount(pipelineDueSoon[0])} · ${dueLabel(pipelineDueSoon[0].deadline)}`,
      href: `/org/${slug}?view=pipeline&commitment=${encodeURIComponent(pipelineDueSoon[0].id)}#pipeline`,
    }
    : grantDueSoon[0]
      ? {
        title: grantDueSoon[0].name,
        detail: grantDueSoon[0].provider || 'Matched grant',
        meta: `${grantAmount(grantDueSoon[0])} · ${dueLabel(grantDeadline(grantDueSoon[0]))}`,
        href: deskViewHref(slug, 'opportunities', 'opportunities'),
      }
      : null;
  const learningStep = opportunityContext?.nextSteps[0] ?? null;
  const focusItems = [
    firstOpportunity
      ? {
        id: `opportunity-${firstOpportunity.id}`,
        label: 'Decide',
        title: firstOpportunity.title,
        detail: firstOpportunity.nextAction,
        meta: `${recommendedMoveLabel(firstOpportunity.recommendedMove)} · ${firstOpportunity.project} · ${firstOpportunity.score}`,
        href: deskViewHref(slug, 'opportunities', 'opportunities'),
        actionLabel: 'Decide',
        priority: firstOpportunity.recommendedMove === 'apply_now' || firstOpportunity.recommendedMove === 'approach_now' ? 18 : 32,
        tone: 'blue',
      }
      : null,
    topPayer && overdueAmount > 0
      ? {
        id: `collect-${topPayer.payer_name}`,
        label: 'Collect',
        title: topPayer.payer_name,
        detail: `${topPayer.invoice_count} invoice${topPayer.invoice_count === 1 ? '' : 's'} need follow-up.`,
        meta: `${fmtMoney(topPayer.total_due)} · ${payerStatus(topPayer)}`,
        href: deskViewHref(slug, 'money', 'money'),
        actionLabel: topPayer.oldest_days_overdue >= 60 ? 'Chase' : 'Review',
        priority: topPayer.oldest_days_overdue >= 60 ? 2 : 24,
        tone: topPayer.oldest_days_overdue >= 60 ? 'red' : 'amber',
      }
      : null,
    nextRelationship
      ? {
        id: `relationship-${nextRelationship.id}`,
        label: 'Relationship',
        title: nextRelationship.foundation.name,
        detail: relationshipAction(nextRelationship),
        meta: `${relationshipStageLabel(nextRelationship)} · ${nextRelationship.project.name}`,
        href: deskViewHref(slug, 'relationships', 'relationships'),
        actionLabel: 'Prepare',
        priority: 14,
        tone: 'purple',
      }
      : null,
    unplannedCommitment
      ? {
        id: `plan-${unplannedCommitment.id}`,
        label: 'Plan',
        title: unplannedCommitment.name,
        detail: pipelineSuggestedNextAction(
          unplannedCommitment,
          actionConnectionContexts.find((context) => context.pipelineItemId === unplannedCommitment.id),
        ),
        meta: `${unplannedCommitment.status} · ${unplannedCommitment.funder || unplannedCommitment.grant_provider || 'No funder set'}`,
        href: `/org/${slug}?view=pipeline&commitment=${encodeURIComponent(unplannedCommitment.id)}#pipeline`,
        actionLabel: 'Set owner',
        priority: 10,
        tone: 'amber',
      }
      : null,
    nextDeadline
      ? {
        id: `deadline-${nextDeadline.title}`,
        label: 'Deadline',
        title: nextDeadline.title,
        detail: nextDeadline.detail,
        meta: nextDeadline.meta,
        href: nextDeadline.href,
        actionLabel: 'Open',
        priority: 8,
        tone: 'amber',
      }
      : null,
    learningStep
      ? {
        id: `learning-${learningStep.sourceKey}-${learningStep.label}`,
        label: 'Learning',
        title: learningStep.label,
        detail: learningStep.detail,
        meta: `${learningStep.priority} priority`,
        href: deskViewHref(slug, learningStep.sourceKey === 'decisions' ? 'opportunities' : 'evidence', learningStep.sourceKey),
        actionLabel: 'Train',
        priority: learningStep.priority === 'high' ? 20 : learningStep.priority === 'medium' ? 36 : 48,
        tone: learningStep.priority === 'high' ? 'red' : learningStep.priority === 'medium' ? 'amber' : 'stone',
      }
      : null,
  ]
    .filter((item): item is FocusWorkItem => Boolean(item))
    .map((item) => {
      const deferredDays = dailyActionMemory[item.id]?.deferredDays ?? 0;
      return {
        ...item,
        carryDays: deferredDays,
        priority: item.priority - Math.min(6, deferredDays * 2),
      };
    })
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 3);

  const workModes = [
    { label: 'Today', href: deskViewHref(slug, 'today'), active: view === 'today' },
    { label: 'Listen', href: deskViewHref(slug, 'relationships', 'relationships'), active: view === 'relationships' },
    { label: 'Curiosity', href: deskViewHref(slug, 'opportunities', 'opportunities'), active: view === 'opportunities' || view === 'triage' },
    { label: 'Action', href: deskViewHref(slug, 'pipeline', 'pipeline'), active: view === 'pipeline' },
    { label: 'Art', href: artProject ? `/org/${slug}/${artProject.slug}` : deskViewHref(slug, 'triage', 'triage'), active: false },
  ];
  const currentSources = sourceStackRows.filter((source) => ['ok', 'verified', 'configured'].includes(source.status)).length;
  const viewHeading = view === 'today'
    ? 'What needs moving today'
    : view === 'relationships'
      ? 'Listen to the relationship field'
      : view === 'opportunities' || view === 'triage'
        ? 'Follow the strongest openings'
        : view === 'pipeline'
          ? 'Move committed work forward'
          : view === 'money'
            ? 'Keep money honest and moving'
            : 'Check the evidence behind the work';
  const showToday = view === 'today';
  const showOpportunityWorkbench = view === 'opportunities';
  const showTriage = view === 'triage';
  const showRelationships = view === 'relationships';
  const showPipeline = view === 'pipeline';
  const showMoney = view === 'money';
  const showSystems = view === 'evidence';

  return (
    <main className="ws act-desk min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen bg-[#183426] text-white lg:block">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto px-4 py-5">
            <Link href={deskViewHref(slug, 'today')} className="flex min-h-12 items-center gap-3 px-2">
              <span className="grid h-8 w-8 place-items-center rounded bg-[#e7ef65] text-sm font-black text-[#183426]">A</span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide">A Curious Tractor</span>
            </Link>

            <div className="mt-8 px-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8fa196]">Work modes</div>
            <nav className="mt-2 space-y-1" aria-label="ACT work modes">
              {workModes.map((mode, index) => (
                <DeskModeLink key={mode.label} {...mode} index={index + 1} />
              ))}
            </nav>

            <div className="mt-8 px-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8fa196]">Project fields</div>
            <nav className="mt-2" aria-label="ACT project fields">
              {fieldProjects.slice(0, 6).map((project, index) => (
                <DeskProjectLink key={project.id} project={project} slug={slug} index={index} />
              ))}
              {projectRows.length === 0 ? <div className="px-2 py-3 text-xs text-[#aebcb2]">No project fields loaded.</div> : null}
            </nav>

            <div className="mt-auto border-t border-white/10 pt-4">
              <DeskUtilityLink href={deskViewHref(slug, 'money', 'money')} label="Money" detail={`${fmtMoney(overdueAmount)} overdue 60d+`} active={view === 'money'} />
              <DeskUtilityLink href={deskViewHref(slug, 'evidence', 'systems')} label="Sources" detail={`${currentSources}/${sourceStackRows.length} current`} active={view === 'evidence'} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--ws-border)] bg-[var(--ws-surface-0)]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">
                  {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} / ACT field desk
                </div>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal text-[var(--ws-text)] sm:text-[28px]">
                  {viewHeading}
                </h1>
              </div>
              <Link
                href={deskViewHref(slug, 'opportunities', 'opportunities')}
                className="hidden min-h-10 shrink-0 items-center rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)] px-3 text-xs font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] sm:inline-flex"
              >
                Review {opportunityRows.length} openings
              </Link>
            </div>
            <nav className="mt-4 flex gap-1 overflow-x-auto lg:hidden" aria-label="ACT work modes">
              {workModes.map((mode) => <NavPill key={mode.label} href={mode.href} label={mode.label} active={mode.active} />)}
            </nav>
          </header>

          <div className="px-4 pb-8 sm:px-6 lg:px-8">
            {showToday ? (
              <section id="today" className="py-6">
                <div className="min-w-0 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
                  <div className="border-b border-[var(--ws-border)] px-5 py-5">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Today</div>
                    <h2 className="mt-2 text-xl font-semibold tracking-normal">Do these in order</h2>
                    <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">Finish the first move before opening another queue.</p>
                  </div>
                  <ActTodayFocus
                    items={focusItems}
                    orgProfileId={orgProfileId}
                    initialStates={dailyActionStates}
                    curiosityHref={deskViewHref(slug, 'opportunities', 'opportunities')}
                  />
                </div>
              </section>
            ) : null}

        {showOpportunityWorkbench ? (
          <section id="opportunities" className="min-w-0 scroll-mt-20 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
            <SectionTitle
              eyebrow="Curiosity"
              title="Choose the next opening"
              action={<LinkButton href="/opportunities/ecosystem" label="Deep view" />}
            />
            <ActRecordReview
              records={opportunityRows}
              orgProfileId={orgProfileId}
              orgSlug={slug}
              projects={allProjectRows
                .filter((project): project is OrgProjectSummary & { code: string } => Boolean(project.code))
                .sort((left, right) => projectFieldRank(left) - projectFieldRank(right) || left.name.localeCompare(right.name))
                .map((project) => ({ code: project.code, name: projectFieldLabel(project), slug: project.slug }))}
            />
          </section>
        ) : null}

        {showTriage ? (
          <section id="triage" className="mt-4 min-w-0 scroll-mt-20 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
          <SectionTitle
            eyebrow="Triage inbox"
            title="Incoming leads before they enter the real pipeline"
            action={<LinkButton href="/opportunities/ecosystem#opportunity-cockpit" label="Deep triage" />}
          />
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-[var(--ws-border)] lg:border-b-0 lg:border-r">
              <MiniTableHeader label="Source frontier" value={`${frontierQueue.total} rows`} />
              <div className="divide-y divide-[var(--ws-border)]">
                {frontierQueue.rows.slice(0, 8).map((row) => (
                  <div key={row.id} className="px-3 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{row.project_name}</div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(row.query)}</div>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${laneClass(routeTypeToLane(row.route_type))}`}>
                        {row.route_type}
                      </span>
                    </div>
                    {row.grant_finder_href ? (
                      <Link href={row.grant_finder_href} className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:underline">
                        Open search
                      </Link>
                    ) : null}
                  </div>
                ))}
                {frontierQueue.rows.length === 0 ? <EmptyBlock label="No source frontier rows loaded." /> : null}
              </div>
            </div>

            <div>
              <MiniTableHeader label="Support routes to accept, snooze, or research" value={`${sourceActions.length} shown`} />
              <div className="divide-y divide-[var(--ws-border)]">
                {sourceActions.map((action) => <SupportActionRow key={action.id} action={action} />)}
                {sourceActions.length === 0 ? <EmptyBlock label="No support routes loaded." /> : null}
              </div>
            </div>
          </div>
          </section>
        ) : null}

        {showRelationships ? (
          <section id="relationships" className="my-6 min-w-0 scroll-mt-24 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
            <div className="grid min-w-0 lg:grid-cols-[260px_minmax(0,1fr)] min-[1360px]:grid-cols-[280px_minmax(0,1fr)_300px]">
              <aside className="order-2 min-w-0 border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] lg:order-1 lg:border-b-0 lg:border-r">
                <div className="border-b border-[var(--ws-border)] px-5 py-5">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Relationship studio</div>
                  <h2 className="mt-2 text-xl font-semibold">People to know</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">Warm people first. Unknown CRM contacts stay out until they carry a useful signal.</p>
                </div>
                <div className="divide-y divide-[var(--ws-border)]">
                  {contactRows.slice(0, 8).map((contact, index) => (
                    <RelationshipStudioContactRow
                      key={`${contact.system}-${contact.id}`}
                      contact={contact}
                      index={index}
                      selected={selectedContact?.id === contact.id}
                      slug={slug}
                    />
                  ))}
                  {contactRows.length === 0 ? <EmptyBlock label="No warm people are ready for review." /> : null}
                </div>
              </aside>

              <div className="order-1 min-w-0 border-b border-[var(--ws-border)] lg:order-2 min-[1360px]:border-b-0 min-[1360px]:border-r">
                {selectedContact ? (
                  <>
                    <header className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#c99a2e] font-mono text-base font-semibold text-white">
                          {initials(selectedContact.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-2xl font-semibold tracking-normal">{selectedContact.name}</h2>
                          <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">{selectedContact.organisation || 'Organisation not yet connected'}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded border px-2 py-1 font-mono text-[9px] font-semibold uppercase ${actionStateClass(selectedContact.state)}`}>{actionStateLabel(selectedContact.state)}</span>
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-semibold uppercase text-emerald-700">{selectedContact.warmth}</span>
                            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[9px] font-semibold uppercase text-blue-700">{selectedContact.lane}</span>
                          </div>
                        </div>
                      </div>
                      <ActRelationshipActionButtons
                        orgProfileId={orgProfileId}
                        record={{
                          id: selectedContact.id,
                          name: selectedContact.name,
                          organisation: selectedContact.organisation,
                          state: selectedContact.state,
                          lane: selectedContact.lane,
                          recommendedAsk: selectedContact.recommendedAsk,
                          whyNow: selectedContact.whyNow,
                          sourceEvidence: selectedContact.sourceEvidence,
                          tags: selectedContact.tags,
                        }}
                      />
                    </header>

                    <div className="grid border-b border-[var(--ws-border)] bg-[#fbfcfa] sm:grid-cols-3">
                      <RelationshipFact label="What matters now" value={selectedContact.whyNow} />
                      <RelationshipFact label="What connects us" value={selectedContact.tags.slice(0, 3).join(' · ') || selectedContact.lane} />
                      <RelationshipFact label="State of relationship" value={`${actionStateLabel(selectedContact.state)} · ${selectedContact.lastTouch}`} last />
                    </div>

                    <section className="px-5 py-6 sm:px-7">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold">Relationship history</h3>
                        <span className="font-mono text-[9px] uppercase text-[var(--ws-text-secondary)]">{selectedContact.sourceEvidence}</span>
                      </div>
                      <div className="mt-4 divide-y divide-[var(--ws-border)]">
                        {selectedRelationshipEvents.map((event) => <RelationshipEventRow key={event.id} event={event} />)}
                        {selectedRelationshipEvents.length === 0 ? (
                          <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-5">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f1ea] font-mono text-[9px] font-semibold text-[#2f6b4a]">{selectedContact.system[0]}</span>
                            <div>
                              <div className="text-sm font-semibold">Latest known signal</div>
                              <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{selectedContact.whyNow}</p>
                              <div className="mt-2 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{selectedContact.lastTouch} / {selectedContact.system}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : <EmptyBlock label="Choose a person to open their relationship context." />}
              </div>

              <aside className="order-3 min-w-0 border-t border-[var(--ws-border)] bg-[#f8f9f5] px-5 py-6 lg:col-span-2 min-[1360px]:col-span-1 min-[1360px]:border-t-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Relationship intelligence</div>
                <h2 className="mt-2 text-xl font-semibold">What to do next</h2>
                {selectedContact ? (
                  <div className="mt-5 bg-[#183426] p-5 text-white">
                    <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#9fb0a4]">Recommended next touch</div>
                    <p className="mt-3 text-base font-semibold leading-relaxed">{selectedContact.recommendedAsk}</p>
                    <p className="mt-3 text-xs leading-relaxed text-[#c7d3cb]">{selectedContact.whyNow}</p>
                  </div>
                ) : null}

                <div className="mt-6 border-t border-[var(--ws-border)] pt-5">
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Connected openings</div>
                  <div className="mt-2 divide-y divide-[var(--ws-border)]">
                    {relationshipOpportunities.map((opportunity) => (
                      <Link key={opportunity.id} href={deskViewHref(slug, 'opportunities', 'opportunities')} className="block py-4 hover:text-[#2f6b4a]">
                        <span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${laneClass(opportunity.lane)}`}>{laneLabel(opportunity.lane)}</span>
                        <h3 className="mt-3 text-sm font-semibold leading-snug">{opportunity.title}</h3>
                        <p className="mt-2 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{compact(opportunity.reason)}</p>
                      </Link>
                    ))}
                    {relationshipOpportunities.length === 0 ? <p className="py-4 text-xs text-[var(--ws-text-secondary)]">No connected openings loaded.</p> : null}
                  </div>
                </div>

                <div className="mt-6 border-t border-[var(--ws-border)] pt-5">
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Organisations in the field</div>
                  <div className="mt-2 divide-y divide-[var(--ws-border)]">
                    {relationshipRows.slice(0, 3).map((row) => (
                      <div key={row.id} className="py-3">
                        <div className="text-xs font-semibold">{row.foundation.name}</div>
                        <div className="mt-1 font-mono text-[9px] uppercase text-[var(--ws-text-secondary)]">{relationshipStageLabel(row)} / {row.project.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-[var(--ws-border)] pt-5">
                  <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Evidence behind this view</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <EvidenceSource label="Gmail" status={sourceStatus('gmail', 'blocked')} />
                    <EvidenceSource label="HighLevel" status={sourceStatus('ghl', 'empty')} />
                    <EvidenceSource label="Decisions" status={sourceStatus('decisions', 'empty')} />
                    <EvidenceSource label="CivicGraph" status={sourceStatus('grants', 'ok')} />
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {showPipeline ? (
          <section id="pipeline" className="mt-4 min-w-0 scroll-mt-20 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
          <SectionTitle
            eyebrow="Action"
            title="Commit the next move"
            action={<LinkButton href={`/org/${slug}/pipeline`} label="Open board" />}
          />
          <ActActionQueue
            items={activePipeline}
            orgProfileId={orgProfileId}
            orgSlug={slug}
            contexts={actionConnectionContexts}
            selectedItemId={selectedCommitmentId}
            projects={allProjectRows
              .filter((project): project is OrgProjectSummary & { code: string } => Boolean(project.code))
              .map((project) => ({ code: project.code, name: projectFieldLabel(project), slug: project.slug }))}
          />
          </section>
        ) : null}

        {showMoney ? (
          <section id="money" className="mt-4 min-w-0 scroll-mt-20 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
          <SectionTitle
            eyebrow="Money queue"
            title="Receivables and proof gaps"
            action={<LinkButton href={`/org/${slug}/payables`} label="Payables" />}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[var(--ws-surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Organisation</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 text-right">Oldest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ws-border)]">
                {payerRows.map((payer) => (
                  <tr key={payer.payer_name} className="hover:bg-[var(--ws-surface-2)]">
                    <td className="px-3 py-3 font-semibold">{payer.payer_name}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${payer.oldest_days_overdue >= 60 ? 'border-red-200 bg-red-50 text-red-700' : 'border-stone-200 bg-stone-50 text-stone-700'}`}>
                        {payerStatus(payer)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums">{fmtMoney(payer.total_due)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-[var(--ws-text-secondary)]">{payer.invoice_count}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-[var(--ws-text-secondary)]">
                      {payer.oldest_days_overdue > 0 ? `${payer.oldest_days_overdue}d overdue` : `due in ${Math.abs(payer.oldest_days_overdue)}d`}
                    </td>
                  </tr>
                ))}
                {payerRows.length === 0 ? <EmptyRow colSpan={5} label="No receivables loaded." /> : null}
              </tbody>
            </table>
          </div>
          </section>
        ) : null}

        {showSystems ? (
          <section id="systems" className="mt-4 min-w-0 scroll-mt-20 overflow-hidden rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
          <SectionTitle eyebrow="Systems and evidence" title="Where the app gets truth from" />
          <div className="grid gap-0 lg:grid-cols-3">
            <SystemPanel
              label="Xero"
              status={verification?.xero.status ?? 'blocked'}
              value={fmtDateTime(verification?.xero.latestSyncCompletedAt)}
              detail={`Invoices ${fmtDateTime(verification?.xero.invoiceSyncedAt)}. ${verification?.xero.latestRecordsFailed ?? 0} failed.`}
            />
            <SystemPanel
              label="A/P proof"
              status={verification?.payables.status ?? 'blocked'}
              value={`${verification?.payables.exactBankRecMatchCount ?? 0} proved`}
              detail={`${fmtMoney(verification?.payables.unresolvedTotal ?? 0)} lacks linked reconciled payment proof.`}
            />
            <SystemPanel
              label="Mailbox"
              status={verification?.mailbox.status ?? 'blocked'}
              value={`${verification ? verification.mailbox.funderOrgsReviewed + verification.mailbox.buyerInvestorOrgsReviewed : 0} orgs reviewed`}
              detail={verification?.mailbox.limitation ?? 'No mailbox harvest loaded.'}
            />
          </div>
          {opportunityContext ? (
            <div className="border-t border-[var(--ws-border)]">
              <MiniTableHeader label="Learning source health" value={opportunityContext.summary} />
              <div className="grid divide-y divide-[var(--ws-border)]">
                {opportunityContext.sources.map((source) => <ContextSourceRow key={source.key} source={source} />)}
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto border-t border-[var(--ws-border)]">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[var(--ws-surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Rows/signals</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ws-border)]">
                {sourceStackRows.map((source) => (
                  <tr key={source.label}>
                    <td className="px-3 py-3 font-semibold">{source.label}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${healthClass(source.status)}`}>
                        {source.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums">{source.count.toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(source.detail, 'No detail')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--ws-border)]">
            <MiniTableHeader label="Project lanes" value={`${projectRows.length} shown`} />
            <div className="grid divide-y divide-[var(--ws-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
              {projectRows.map((project) => (
                <div key={project.id} className="flex items-center justify-between gap-3 border-b border-[var(--ws-border)] px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{project.name}</div>
                    <div className="text-xs text-[var(--ws-text-secondary)]">{project.code ?? project.slug}</div>
                  </div>
                  <div className="text-right font-mono text-xs text-[var(--ws-text-secondary)]">
                    {project.pipeline_count} pipe
                  </div>
                </div>
              ))}
              {projectRows.length === 0 ? <EmptyBlock label="No project rows loaded." /> : null}
            </div>
          </div>
          </section>
        ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function DeskModeLink({
  href,
  label,
  active,
  index,
}: {
  href: string;
  label: string;
  active: boolean;
  index: number;
}) {
  return (
    <Link
      href={href}
      className={`grid min-h-10 grid-cols-[26px_minmax(0,1fr)] items-center gap-2 rounded-md px-3 py-2 transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-[#c7d1ca] hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className={`font-mono text-[10px] font-semibold ${active ? 'text-[#e7ef65]' : 'text-[#8fa196]'}`}>
        {String(index).padStart(2, '0')}
      </span>
      <span className="truncate text-sm font-semibold">{label}</span>
    </Link>
  );
}

function DeskProjectLink({
  project,
  slug,
  index,
}: {
  project: OrgProjectSummary;
  slug: string;
  index: number;
}) {
  const colours = ['#c99a2e', '#6b78b8', '#4f8b63', '#a06b8b', '#44899b', '#8b6f56'];
  return (
    <Link href={`/org/${slug}/${project.slug}`} className="grid min-h-9 grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 px-2 text-[#d7ded9] hover:bg-white/5 hover:text-white">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colours[index % colours.length] }} />
      <span className="truncate text-xs">{projectFieldLabel(project)}</span>
      <span className="font-mono text-[10px] text-[#8fa196]">{project.pipeline_count}</span>
    </Link>
  );
}

function DeskUtilityLink({
  href,
  label,
  detail,
  active,
}: {
  href: string;
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`block rounded-md px-2 py-2.5 ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}>
      <span className="block text-xs font-semibold text-white">{label}</span>
      <span className="mt-1 block text-[10px] text-[#9fb0a4]">{detail}</span>
    </Link>
  );
}

function RelationshipStudioContactRow({
  contact,
  index,
  selected,
  slug,
}: {
  contact: ContactContextRow;
  index: number;
  selected: boolean;
  slug: string;
}) {
  const colours = ['#c99a2e', '#6b78b8', '#4f8b63', '#a06b8b', '#44899b', '#65766b'];
  return (
    <Link
      href={deskRelationshipHref(slug, contact.id)}
      className={`flex min-h-[82px] items-center gap-3 border-l-4 px-4 py-3 transition-colors ${
        selected ? 'border-l-[#2f6b4a] bg-white' : 'border-l-transparent hover:bg-white'
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-white" style={{ backgroundColor: colours[index % colours.length] }}>
        {initials(contact.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{contact.name}</span>
        <span className="mt-1 block truncate text-[10px] text-[var(--ws-text-secondary)]">{contact.organisation || contact.lane}</span>
      </span>
      <span className="shrink-0 font-mono text-[8px] font-semibold uppercase text-[#2f6b4a]">{contact.warmth}</span>
    </Link>
  );
}

function RelationshipFact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`min-w-0 px-5 py-4 ${last ? '' : 'border-b border-[var(--ws-border)] sm:border-b-0 sm:border-r'}`}>
      <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">{label}</div>
      <div className="mt-2 text-xs font-semibold leading-relaxed">{compact(value)}</div>
    </div>
  );
}

function RelationshipEventRow({ event }: { event: ActOpportunityContextEvent }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 py-5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f1ea] font-mono text-[9px] font-semibold uppercase text-[#2f6b4a]">
        {event.sourceSystem.slice(0, 1)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-sm font-semibold">{event.title}</div>
          <div className="shrink-0 font-mono text-[9px] uppercase text-[var(--ws-text-secondary)]">{fmtDate(event.happenedAt)}</div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(event.summary)}</p>
      </div>
    </div>
  );
}

function EvidenceSource({ label, status }: { label: string; status: HealthStatus }) {
  return (
    <div className="border border-[var(--ws-border)] bg-white px-3 py-2.5">
      <div className="text-[11px] font-semibold">{label}</div>
      <div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-secondary)]">{status}</div>
    </div>
  );
}

function NavPill({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-md border px-3 text-xs font-semibold ${
        active
          ? 'border-stone-900 bg-stone-900 text-white'
          : 'border-[var(--ws-border)] bg-[var(--ws-surface-1)] text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)]'
      }`}
    >
      {label}
    </Link>
  );
}

function ActionTile({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: 'red' | 'green' | 'blue' | 'purple' | 'amber';
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <Link href={href} className={`block rounded-md border p-3 transition hover:bg-white ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-snug opacity-90">{detail}</div>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--ws-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{eyebrow}</div>
        <h2 className="mt-1 text-lg font-semibold tracking-normal text-[var(--ws-text)]">{title}</h2>
      </div>
      {action ? <div className="self-start sm:self-auto">{action}</div> : null}
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)] px-3 text-xs font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)]"
    >
      {label}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--ws-surface-1)] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-[var(--ws-text)]">{value}</div>
    </div>
  );
}

function SideLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="block px-3 py-3 hover:bg-[var(--ws-surface-2)]">
      <div className="font-semibold text-[var(--ws-text)]">{label}</div>
      <div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{detail}</div>
    </Link>
  );
}

function SourceRow({ row }: { row: SourceStackRow }) {
  return (
    <Link href={row.href} className="block px-3 py-3 hover:bg-[var(--ws-surface-2)]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{row.label}</div>
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${healthClass(row.status)}`}>{row.status}</span>
      </div>
      <div className="mt-1 font-mono text-xs text-[var(--ws-text-secondary)]">{row.count.toLocaleString()} rows/signals</div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(row.detail)}</div>
    </Link>
  );
}

function ContextMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-2 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--ws-text)]">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ContextSourceRow({ source }: { source: ActOpportunityContextSource }) {
  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 font-semibold">{source.label}</div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${healthClass(source.status)}`}>
          {source.status}
        </span>
      </div>
      <div className="mt-1 font-mono text-xs text-[var(--ws-text-secondary)]">
        {source.count.toLocaleString()} rows/signals · {fmtDateTime(source.latestAt)}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(source.detail)}</div>
    </div>
  );
}

function priorityClass(priority: ActOpportunityContextStep['priority']): string {
  if (priority === 'high') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-stone-200 bg-stone-50 text-stone-700';
}

function ContextStepRow({ step }: { step: ActOpportunityContextStep }) {
  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{step.label}</div>
          <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(step.detail)}</div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(step.priority)}`}>
          {step.priority}
        </span>
      </div>
    </div>
  );
}

function MiniTableHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-3 py-2">
      <div className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</div>
      <div className="min-w-0 truncate font-mono text-xs text-[var(--ws-text-secondary)]">{value}</div>
    </div>
  );
}

function SupportActionRow({ action }: { action: WikiSupportAction }) {
  const lane = routeTypeToLane(action.route_type);
  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{action.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(action.summary)}</div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${laneClass(lane)}`}>
          {action.route_type}
        </span>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(action.next_step)}</div>
    </div>
  );
}

function actionStateLabel(state: RelationshipActionState): string {
  if (state === 'ready_to_reply') return 'Ready to reply';
  if (state === 'meeting_needed') return 'Meeting needed';
  if (state === 'proposal_path') return 'Proposal path';
  if (state === 'waiting') return 'Waiting';
  if (state === 'parked') return 'Parked';
  return 'New signal';
}

function actionStateClass(state: RelationshipActionState): string {
  if (state === 'ready_to_reply' || state === 'proposal_path') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'meeting_needed') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (state === 'waiting') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (state === 'parked') return 'border-stone-300 bg-stone-100 text-stone-600';
  return 'border-purple-200 bg-purple-50 text-purple-700';
}

function ContactRow({ contact, orgProfileId }: { contact: ContactContextRow; orgProfileId: string }) {
  const warmth = contact.warmth === 'hot'
    ? 'border-red-200 bg-red-50 text-red-700'
    : contact.warmth === 'warm'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-stone-200 bg-stone-50 text-stone-700';

  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{contact.name}</div>
          <div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{contact.organisation || 'Organisation not set'}</div>
          <div className="mt-1 font-mono text-[11px] text-[var(--ws-text-tertiary)]">
            {contact.system} · {contact.lastTouch}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${actionStateClass(contact.state)}`}>{actionStateLabel(contact.state)}</span>
          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${warmth}`}>{contact.warmth}</span>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-2 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Recommended ask</div>
        <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text)]">{compact(contact.recommendedAsk, 'Confirm the next ask.')}</div>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">
        <span className="font-semibold text-[var(--ws-text)]">Why now: </span>{compact(contact.whyNow)}
      </div>
      <div className="mt-1 font-mono text-[11px] text-[var(--ws-text-tertiary)]">
        {contact.lane} · {contact.sourceEvidence}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {contact.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-md border border-[var(--ws-border)] px-2 py-0.5 text-[11px] text-[var(--ws-text-secondary)]">
            {tag}
          </span>
        ))}
      </div>
      <ActRelationshipActionButtons
        orgProfileId={orgProfileId}
        record={{
          id: contact.id,
          name: contact.name,
          organisation: contact.organisation,
          state: contact.state,
          lane: contact.lane,
          recommendedAsk: contact.recommendedAsk,
          whyNow: contact.whyNow,
          sourceEvidence: contact.sourceEvidence,
          tags: contact.tags,
        }}
      />
    </div>
  );
}

function SystemPanel({
  label,
  status,
  value,
  detail,
}: {
  label: string;
  status: 'verified' | 'partial' | 'blocked';
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-[var(--ws-border)] px-3 py-3 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</div>
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${healthClass(status)}`}>{status}</span>
      </div>
      <div className="mt-2 font-semibold">{value}</div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{detail}</div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return <div className="px-3 py-4 text-sm text-[var(--ws-text-secondary)]">{label}</div>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-4 text-sm text-[var(--ws-text-secondary)]">
        {label}
      </td>
    </tr>
  );
}
