'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { decisionTagBadgeClass, decisionTagLabel, SHORTLIST_DECISIONS } from '@/lib/procurement-shortlist';
import { getDecisionPackBlockers, type PackReadinessBlocker } from '@/lib/procurement-pack-readiness';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type TabKey = 'discover' | 'enrich' | 'pack';
type WorkflowStage = 'brief' | 'review' | 'signoff' | 'export';
type WorkspaceMode = 'work' | 'signoff' | 'admin';

interface SupplierResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  latest_revenue: number | null;
  contracts: { count: number; total_value: number };
}

interface DiscoverResult {
  suppliers: SupplierResult[];
  summary: {
    total_found: number;
    indigenous_businesses: number;
    social_enterprises: number;
    community_controlled: number;
    with_federal_contracts: number;
  };
}

interface ReviewChecklist {
  fit: boolean;
  risk_checked: boolean;
  evidence_checked: boolean;
  decision_made: boolean;
}

interface ProcurementPermissions {
  can_edit_shortlist: boolean;
  can_manage_tasks: boolean;
  can_submit_signoff: boolean;
  can_approve: boolean;
  can_manage_team: boolean;
  can_reopen_approval: boolean;
  can_send_notifications: boolean;
}

interface PackExportSummary {
  id: string;
  shortlist_id: string;
  title: string;
  version_number: number;
  export_summary: Record<string, unknown>;
  source_shortlist_updated_at: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PackResult = {
  pack: { generated_at: string; filters?: { state?: string; lga?: string }; sections: any };
  export?: { id: string; title: string; created_at: string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichResult = { enriched: any[]; summary: any };

interface WorkspaceOrgProfile {
  id: string;
  name: string;
  abn: string | null;
  subscription_plan: string | null;
}

interface ShortlistRecord {
  id: string;
  supplier_key: string;
  gs_id: string | null;
  supplier_abn: string | null;
  supplier_name: string;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  lga_name: string | null;
  seifa_irsd_decile: number | null;
  latest_revenue: number | null;
  is_community_controlled: boolean;
  contract_count: number;
  contract_total_value: number;
  note: string | null;
  decision_tag: string | null;
  review_checklist: ReviewChecklist;
  evidence_snapshot: Record<string, unknown>;
  last_reviewed_at: string | null;
  updated_at: string;
  provenance?: {
    source_datasets: string[];
    source_count: number;
    confidence: string | null;
    financial_year: string | null;
    last_seen: string | null;
    entity_updated_at: string | null;
    match_reason: string;
  };
}

interface ShortlistSummary {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  is_default: boolean;
  recommendation_summary: string | null;
  why_now: string | null;
  risk_summary: string | null;
  next_action: string | null;
  owner_name: string | null;
  owner_user_id: string | null;
  approver_user_id: string | null;
  decision_due_at: string | null;
  approval_status: 'draft' | 'review_ready' | 'submitted' | 'approved' | 'changes_requested';
  approval_notes: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  last_pack_export_id: string | null;
  approved_pack_export_id: string | null;
  approval_lock_active: boolean;
  approval_locked_at: string | null;
  approval_locked_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  item_count: number;
  decision_counts: Record<string, number>;
  updated_at: string;
}

interface WorkspaceEvent {
  id: string;
  shortlist_id: string | null;
  shortlist_item_id: string | null;
  event_type:
    | 'shortlist_created'
    | 'shortlist_updated'
    | 'item_added'
    | 'item_removed'
    | 'note_updated'
    | 'decision_updated'
    | 'task_created'
    | 'task_updated'
    | 'task_completed'
    | 'checklist_updated'
    | 'pack_exported'
    | 'approval_updated'
    | 'comment_added';
  event_summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface WorkflowRun {
  id: string;
  workflow_type: 'discover' | 'enrich' | 'pack' | 'compliance';
  workflow_status: 'completed' | 'failed' | 'blocked';
  output_summary: Record<string, unknown>;
  records_scanned: number;
  records_changed: number;
  error_count: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface ShortlistWatch {
  id: string;
  shortlist_id: string;
  enabled: boolean;
  interval_hours: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_summary: Record<string, unknown>;
  last_alert_count: number;
}

interface ProcurementAlert {
  id: string;
  shortlist_id: string | null;
  shortlist_item_id: string | null;
  alert_type: 'new_supplier' | 'removed_supplier' | 'contract_signal_changed' | 'brief_rerun' | 'task_due' | 'task_escalated';
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProcurementNotification {
  id: string;
  shortlist_id: string | null;
  pack_export_id: string | null;
  task_id: string | null;
  alert_id: string | null;
  recipient_user_id: string | null;
  recipient_label: string | null;
  notification_type: 'task_due' | 'task_escalated' | 'signoff_submitted' | 'signoff_approved' | 'signoff_changes_requested';
  delivery_mode: 'immediate' | 'daily_digest';
  status: 'queued' | 'sent' | 'cancelled';
  subject: string;
  body: string | null;
  payload: Record<string, unknown>;
  queued_at: string;
  sent_at: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  last_error: string | null;
  external_message_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PendingTeamInvite {
  id: string;
  invited_email: string | null;
  role: string;
  invited_at: string | null;
  procurement_role: 'lead' | 'reviewer' | 'approver' | 'observer';
  notification_mode: 'immediate' | 'daily_digest' | 'none';
  permission_overrides: Partial<Record<keyof ProcurementPermissions, boolean>>;
}

interface ProcurementTask {
  id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  alert_id: string | null;
  task_key: string | null;
  task_type: 'review_alert' | 'follow_up' | 'evidence_check' | 'pack_refresh';
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'done';
  due_at: string | null;
  assignee_label: string | null;
  assignee_user_id: string | null;
  last_reminded_at: string | null;
  reminder_count: number;
  completion_outcome: 'resolved' | 'follow_up_required' | 'escalated' | 'approved_to_proceed' | 'excluded' | null;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface InboxTask extends ProcurementTask {
  shortlist_name: string;
}

interface ApprovalInboxItem {
  id: string;
  name: string;
  owner_name: string | null;
  decision_due_at: string | null;
  approval_status: 'submitted';
  last_pack_export_id: string | null;
  updated_at: string;
}

interface TeamMember {
  user_id: string;
  role: string;
  procurement_role: 'lead' | 'reviewer' | 'approver' | 'observer';
  notification_mode: 'immediate' | 'daily_digest' | 'none';
  permission_overrides: Partial<Record<keyof ProcurementPermissions, boolean>>;
  permissions: ProcurementPermissions;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  is_owner: boolean;
}

interface NotificationChannel {
  id: string;
  channel_name: string;
  channel_type: 'webhook';
  endpoint_url: string;
  signing_secret: string | null;
  enabled: boolean;
  event_types: ProcurementNotification['notification_type'][];
  verification_token: string;
  verification_status: 'untested' | 'passed' | 'failed';
  last_tested_at: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

interface DeliveryLogEntry {
  id: string;
  source: string;
  webhook_id: string;
  channel_name: string;
  event_type: string;
  status: 'processed' | 'failed';
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  received_at: string | null;
}

interface ChannelHealth {
  id: string;
  channel_name: string;
  enabled: boolean;
  verification_status: 'untested' | 'passed' | 'failed';
  verification_token: string;
  last_tested_at: string | null;
  last_receipt_at: string | null;
  success_count: number;
  failure_count: number;
  last_processed_at: string | null;
  last_failed_at: string | null;
  last_error_message: string | null;
}

interface OutboundMetrics {
  queued: number;
  needsAttention: number;
  sentRecently: number;
  webhookFailures: number;
}

interface InspectorReceipt {
  id: string;
  channel_id: string;
  channel_name: string;
  source: string;
  event_type: string | null;
  signature_valid: boolean | null;
  received_at: string | null;
  created_at: string;
}

interface ProcurementComment {
  id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  pack_export_id: string | null;
  author_user_id: string | null;
  author_label: string | null;
  comment_type: 'discussion' | 'submission' | 'approval' | 'changes_requested' | 'supplier_review';
  body: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceResponse {
  canUseWorkspace: boolean;
  needsProfile: boolean;
  currentUserId: string;
  orgProfile: WorkspaceOrgProfile | null;
  currentUserRole: string | null;
  currentUserPermissions: ProcurementPermissions;
  shortlists: ShortlistSummary[];
  shortlist: ShortlistSummary | null;
  shortlistItems: ShortlistRecord[];
  workflowRuns: WorkflowRun[];
  recentEvents: WorkspaceEvent[];
  watch: ShortlistWatch | null;
  alerts: ProcurementAlert[];
  tasks: ProcurementTask[];
  myTasks: InboxTask[];
  myApprovals: ApprovalInboxItem[];
  myNotifications: ProcurementNotification[];
  packExports: PackExportSummary[];
  notifications: ProcurementNotification[];
  notificationChannels: NotificationChannel[];
  deliveryLogs: DeliveryLogEntry[];
  inspectorReceipts: InspectorReceipt[];
  channelHealth: ChannelHealth[];
  outboundMetrics: OutboundMetrics;
  pendingInvites: PendingTeamInvite[];
  comments: ProcurementComment[];
  teamMembers: TeamMember[];
}

function humanJoin(values: string[]) {
  const filtered = values.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

function looksPlaceholderCopy(value: string | null | undefined) {
  if (!value) return false;
  return /\b(test|testing|tesing|tbd|todo|placeholder|lorem|asdf|rad)\b/i.test(value);
}

function nextDateInputValue(daysAhead = 7) {
  const next = new Date();
  next.setDate(next.getDate() + daysAhead);
  return next.toISOString().slice(0, 10);
}

function shortlistBriefSummary(filters: Record<string, unknown>, items: ShortlistRecord[]) {
  const parts: string[] = [];
  if (typeof filters.state === 'string' && filters.state) parts.push(filters.state);
  if (typeof filters.lga === 'string' && filters.lga) parts.push(filters.lga);
  if (typeof filters.remoteness === 'string' && filters.remoteness) parts.push(filters.remoteness);
  if (Array.isArray(filters.entity_types)) {
    const labels = filters.entity_types
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => entityTypeFilterLabel(value));
    if (labels.length > 0) {
      parts.push(humanJoin(labels));
    }
  }
  if (filters.community_controlled === true) {
    parts.push('community-controlled suppliers');
  }
  if (parts.length > 0) {
    return parts.join(' / ');
  }
  const itemStates = Array.from(new Set(items.map((item) => item.state).filter((value): value is string => !!value))).slice(0, 2);
  if (itemStates.length > 0) {
    return `${humanJoin(itemStates)} supplier market`;
  }
  return 'the current supplier market';
}

function checklistMissingLabels(checklist: ReviewChecklist) {
  const labels: Array<{ key: keyof ReviewChecklist; label: string }> = [
    { key: 'fit', label: 'supplier fit' },
    { key: 'risk_checked', label: 'risk review' },
    { key: 'evidence_checked', label: 'evidence review' },
    { key: 'decision_made', label: 'decision capture' },
  ];
  return labels.filter((entry) => !checklist[entry.key]).map((entry) => entry.label);
}

function buildSuggestedDecisionBrief(params: {
  shortlist: ShortlistSummary;
  items: ShortlistRecord[];
  ownerUserId: string;
  approverUserId: string;
  decisionDueAt: string;
}) {
  const recommended = params.items.filter((item) => ['priority', 'engage'].includes(item.decision_tag || ''));
  const reviewing = params.items.filter((item) => item.decision_tag === 'reviewing');
  const shortlistContext = shortlistBriefSummary(params.shortlist.filters || {}, params.items);
  const recommendedNames = recommended.slice(0, 3).map((item) => item.supplier_name);
  const reviewingNames = reviewing.slice(0, 2).map((item) => item.supplier_name);
  const recommendationSummary = recommendedNames.length > 0
    ? `Carry ${humanJoin(recommendedNames)} forward for the next procurement step. ${reviewingNames.length > 0
      ? `${humanJoin(reviewingNames)} remain in review until shortlist notes, evidence, and checklist coverage are complete.`
      : 'The rest of the shortlist should only stay in play where there is a clear evidence-backed case to do so.'}`
    : `Use this shortlist to identify which suppliers in ${shortlistContext} should stay in play. Tag at least one supplier as Priority or Engage before the pack goes to sign-off.`;
  const whyNow = `This shortlist is shaping a market view for ${shortlistContext}. It gives the team a documented basis for supplier engagement, due diligence, and sign-off before the procurement process moves forward.`;
  const riskSummary = `Open risks still sit around evidence depth, shortlist completeness, and supplier-specific fit. Clear placeholder notes, missing checklist items, and confidence gaps before treating the memo as the governed decision record.`;
  const nextAction = recommendedNames.length > 0
    ? `Finish the remaining supplier review work, confirm owner and approver, then generate a fresh decision pack for sign-off.`
    : `Review the saved suppliers, tag the organisations that should stay in play, and then generate the first decision pack once the shortlist is ready.`;

  return {
    recommendationSummary,
    whyNow,
    riskSummary,
    nextAction,
    ownerUserId: params.ownerUserId,
    approverUserId: params.approverUserId,
    decisionDueAt: params.decisionDueAt,
  };
}

function buildSuggestedSupplierNote(params: {
  item: ShortlistRecord;
  shortlist: ShortlistSummary;
  blockers: PackReadinessBlocker[];
}) {
  const checklist = normalizeChecklist(params.item.review_checklist);
  const missingChecks = checklistMissingLabels(checklist);
  const briefContext = shortlistBriefSummary(params.shortlist.filters || {}, [params.item]);
  const contractSignal = params.item.contract_count > 0
    ? `Existing delivery signal: ${params.item.contract_count} contract${params.item.contract_count === 1 ? '' : 's'} worth ${fmtMoney(params.item.contract_total_value)}.`
    : 'No government contract history is surfaced in the current evidence snapshot.';
  const evidenceSignal = (params.item.provenance?.source_count || 0) > 0
    ? `Evidence currently comes from ${params.item.provenance?.source_count} dataset${params.item.provenance?.source_count === 1 ? '' : 's'} with ${confidenceLabel(params.item.provenance?.confidence).toLowerCase()} confidence.`
    : 'Evidence depth is still too thin and needs another cited source.';
  const nextStep = params.item.decision_tag === 'priority'
    ? 'Next step: confirm capacity, pricing assumptions, and engagement readiness.'
    : params.item.decision_tag === 'engage'
      ? 'Next step: move into supplier contact and partner-fit diligence.'
      : params.item.decision_tag === 'reviewing'
        ? 'Next step: finish the analyst review before deciding whether this supplier stays in play.'
        : 'Next step: decide whether this supplier should move to Priority, Engage, or drop out of the shortlist.';
  const blockerSignal = params.blockers.length > 0
    ? `Still missing: ${humanJoin(params.blockers.slice(0, 2).map((blocker) => blocker.code === 'placeholder_note' ? 'a real analyst note' : blocker.message.replace(`${params.item.supplier_name}: `, '').replace(' before exporting.', '')))}.`
    : '';

  return `${params.item.supplier_name} is currently tagged ${decisionTagLabel(params.item.decision_tag).toLowerCase()} against the ${briefContext} brief. ${contractSignal} ${evidenceSignal} ${missingChecks.length > 0 ? `Outstanding review checks: ${humanJoin(missingChecks)}.` : 'Core review checks are already underway.'} ${nextStep}${blockerSignal ? ` ${blockerSignal}` : ''}`;
}

function buildSuggestedSupplierComment(params: {
  item: ShortlistRecord;
  blockers: PackReadinessBlocker[];
}) {
  const checklist = normalizeChecklist(params.item.review_checklist);
  const missingChecks = checklistMissingLabels(checklist);
  const blockerHint = params.blockers.find((blocker) => blocker.code !== 'missing_note' && blocker.code !== 'placeholder_note');

  return `Review checkpoint: ${params.item.supplier_name} remains ${decisionTagLabel(params.item.decision_tag).toLowerCase()}. ${missingChecks.length > 0 ? `Still to confirm ${humanJoin(missingChecks)}.` : 'Checklist coverage is in place.'} ${blockerHint ? `Main gap: ${blockerHint.message.replace(`${params.item.supplier_name}: `, '')}` : `Latest evidence confidence is ${confidenceLabel(params.item.provenance?.confidence).toLowerCase()}.`}`;
}

function buildSuggestedTaskDraft(params: {
  shortlist: ShortlistSummary;
  selectedItem: ShortlistRecord | null;
  blocker: PackReadinessBlocker | null;
  currentUserId: string;
}) {
  if (params.selectedItem) {
    const checklist = normalizeChecklist(params.selectedItem.review_checklist);
    const missingChecks = checklistMissingLabels(checklist);
    return {
      title: `Review ${params.selectedItem.supplier_name}`,
      description: `${missingChecks.length > 0 ? `Complete ${humanJoin(missingChecks)}` : 'Refresh the shortlist note and recommendation'} for ${params.selectedItem.supplier_name}. Update the supplier note, evidence trail, and decision tag before the next pack run.`,
      assigneeUserId: params.currentUserId,
      dueAt: nextDateInputValue(2),
      shortlistItemId: params.selectedItem.id,
      priority: params.selectedItem.decision_tag === 'priority' ? 'high' as const : 'medium' as const,
    };
  }

  if (params.blocker) {
    return {
      title: `Resolve blockers for ${params.shortlist.name}`,
      description: `Start with: ${params.blocker.message} Work through the blocker list until the shortlist is ready for a fresh decision pack.`,
      assigneeUserId: params.currentUserId,
      dueAt: nextDateInputValue(2),
      shortlistItemId: params.blocker.shortlist_item_id || '',
      priority: 'high' as const,
    };
  }

  return {
    title: `Work the next shortlist review`,
    description: `Triage the remaining suppliers in ${params.shortlist.name}, update analyst notes and checklist items, and get the shortlist ready for sign-off.`,
    assigneeUserId: params.currentUserId,
    dueAt: nextDateInputValue(3),
    shortlistItemId: '',
    priority: 'medium' as const,
  };
}

function buildSuggestedCompletionNote(params: {
  task: ProcurementTask;
  item: ShortlistRecord | null;
  outcome: NonNullable<ProcurementTask['completion_outcome']>;
}) {
  const outcomeLabel = taskOutcomeLabel(params.outcome).toLowerCase();
  if (params.item) {
    const checklistCount = reviewChecklistCount(normalizeChecklist(params.item.review_checklist));
    const nextStep = params.item.decision_tag === 'engage'
      ? 'Move the supplier into direct engagement and due diligence.'
      : params.item.decision_tag === 'priority'
        ? 'Keep the supplier in the active recommendation set and close remaining evidence gaps.'
        : params.item.decision_tag === 'not_now'
          ? 'Remove the supplier from the active procurement path.'
          : 'Keep the supplier in review until the shortlist decision is clearer.';
    return `Reviewed ${params.item.supplier_name} and closed this task as ${outcomeLabel}. Current shortlist decision is ${decisionTagLabel(params.item.decision_tag).toLowerCase()} with ${checklistCount}/4 checklist items complete. ${nextStep}`;
  }

  return `Closed this shortlist task as ${outcomeLabel}. Updated the procurement workflow so the next owner can pick up the remaining work without re-tracing the shortlist.`;
}

function buildSuggestedApprovalNote(params: {
  shortlist: ShortlistSummary;
  items: ShortlistRecord[];
  latestPackExport: PackExportSummary | null;
  blockerCount: number;
}) {
  const recommendedNames = params.items
    .filter((item) => ['priority', 'engage'].includes(item.decision_tag || ''))
    .slice(0, 3)
    .map((item) => item.supplier_name);
  const packLabel = params.latestPackExport ? packVersionLabel(params.latestPackExport) : 'the next pack version';
  if (params.blockerCount > 0) {
    return `Sign-off is not ready yet. ${params.blockerCount} blocker${params.blockerCount === 1 ? '' : 's'} still need to be cleared before ${packLabel} can be treated as the governed decision record for ${params.shortlist.name}.`;
  }
  return `Submit ${packLabel} for sign-off as the current decision record for ${params.shortlist.name}. ${recommendedNames.length > 0 ? `The current recommendation carries ${humanJoin(recommendedNames)} into the next procurement step, subject to any conditions noted below.` : 'The shortlist is ready for approver review, but the recommendation set should still be confirmed in the submission note.'}`;
}

function buildSuggestedSignoffComment(params: {
  shortlist: ShortlistSummary;
  items: ShortlistRecord[];
}) {
  const shortlistContext = shortlistBriefSummary(params.shortlist.filters || {}, params.items);
  const recommendedNames = params.items
    .filter((item) => ['priority', 'engage'].includes(item.decision_tag || ''))
    .slice(0, 2)
    .map((item) => item.supplier_name);
  return `Governance note: this memo reflects the current shortlist for ${shortlistContext}. ${recommendedNames.length > 0 ? `${humanJoin(recommendedNames)} are the leading suppliers at this point.` : 'The shortlist still needs a clear leading supplier recommendation.'} Treat the pack as a controlled market view and refresh it if supplier decisions, evidence, or ownership materially change.`;
}

function isDiscoverResult(value: unknown): value is DiscoverResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DiscoverResult>;
  return Array.isArray(candidate.suppliers) && !!candidate.summary && typeof candidate.summary.total_found === 'number';
}

function isEnrichResult(value: unknown): value is EnrichResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnrichResult>;
  return Array.isArray(candidate.enriched) && !!candidate.summary && typeof candidate.summary === 'object';
}

function isPackResult(value: unknown): value is PackResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PackResult>;
  return !!candidate.pack && typeof candidate.pack.generated_at === 'string' && !!candidate.pack.sections;
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const ENTITY_TYPES = [
  { value: 'indigenous_corp', label: 'Indigenous Business' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'charity', label: 'Charity / NFP' },
  { value: 'company', label: 'Company' },
];
const REMOTENESS = [
  'Major Cities of Australia',
  'Inner Regional Australia',
  'Outer Regional Australia',
  'Remote Australia',
  'Very Remote Australia',
];

const WORKFLOW_STAGES: Array<{
  key: WorkflowStage;
  label: string;
  description: string;
}> = [
  {
    key: 'brief',
    label: '1. Set Brief',
    description: 'Define the decision ask, owner, approver, and due date.',
  },
  {
    key: 'review',
    label: '2. Review Suppliers',
    description: 'Work the shortlist, notes, evidence, and review tasks.',
  },
  {
    key: 'signoff',
    label: '3. Sign Off',
    description: 'Route the frozen pack for approval or request changes.',
  },
  {
    key: 'export',
    label: '4. Export / Share',
    description: 'Use the approved memo as the live decision record.',
  },
];

const WORKSPACE_MODES: Array<{
  key: WorkspaceMode;
  label: string;
  description: string;
}> = [
  {
    key: 'work',
    label: 'Work',
    description: 'Review suppliers, update tags, notes, and evidence.',
  },
  {
    key: 'signoff',
    label: 'Sign-Off',
    description: 'Write the decision brief, freeze the pack, and route approval.',
  },
  {
    key: 'admin',
    label: 'Admin',
    description: 'Manage shortlists, team permissions, and outbound delivery.',
  },
];
function fmtMoney(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function workflowLabel(run: WorkflowRun) {
  const summary = run.output_summary || {};
  switch (run.workflow_type) {
    case 'discover':
      return `${summary.total_found ?? 0} suppliers found`;
    case 'enrich':
      return `${summary.resolved ?? 0} suppliers resolved`;
    case 'pack':
      if (run.workflow_status === 'blocked') {
        return `${summary.blocker_count ?? 0} pack blocker${summary.blocker_count === 1 ? '' : 's'} found`;
      }
      return `${summary.shortlist_size ?? 0} shortlist candidates`;
    case 'compliance':
      return `${summary.compliance_score ?? '—'} compliance score`;
    default:
      return `${run.records_changed} changes`;
  }
}

function entityTypeLabel(t: string) {
  return {
    indigenous_corp: 'Indigenous',
    social_enterprise: 'Social Enterprise',
    charity: 'Charity',
    company: 'Company',
    foundation: 'Foundation',
    government_body: 'Government',
  }[t] || t;
}

function entityTypeBadgeColor(t: string) {
  return {
    indigenous_corp: 'bg-bauhaus-yellow text-bauhaus-black',
    social_enterprise: 'bg-money text-white',
    charity: 'bg-bauhaus-blue text-white',
    company: 'bg-bauhaus-black/60 text-white',
  }[t] || 'bg-bauhaus-muted text-white';
}

function entityTypeFilterLabel(value: string) {
  return ENTITY_TYPES.find((option) => option.value === value)?.label || entityTypeLabel(value);
}

function getSavedSearchPills(filters: Record<string, unknown>) {
  const pills: string[] = [];
  if (typeof filters.state === 'string' && filters.state) pills.push(`State: ${filters.state}`);
  if (typeof filters.lga === 'string' && filters.lga) pills.push(`Region: ${filters.lga}`);
  if (typeof filters.postcode === 'string' && filters.postcode) pills.push(`Postcode: ${filters.postcode}`);
  if (typeof filters.remoteness === 'string' && filters.remoteness) pills.push(`Remoteness: ${filters.remoteness}`);
  if (Array.isArray(filters.entity_types)) {
    for (const type of filters.entity_types) {
      if (typeof type === 'string' && type) {
        pills.push(`Supplier type: ${entityTypeFilterLabel(type)}`);
      }
    }
  }
  if (filters.community_controlled === true) pills.push('Community controlled only');
  return pills;
}

function confidenceBadgeColor(confidence: string | null | undefined) {
  switch (confidence) {
    case 'registry':
      return 'border-money bg-money-light text-money';
    case 'verified':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'reported':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

function confidenceLabel(confidence: string | null | undefined) {
  if (!confidence) return 'Unscored';
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function normalizeChecklist(value: Partial<ReviewChecklist> | Record<string, unknown> | null | undefined): ReviewChecklist {
  return {
    fit: value?.fit === true,
    risk_checked: value?.risk_checked === true,
    evidence_checked: value?.evidence_checked === true,
    decision_made: value?.decision_made === true,
  };
}

function reviewChecklistCount(checklist: ReviewChecklist) {
  return Object.values(checklist).filter(Boolean).length;
}

function decisionCountsLabel(value: unknown) {
  if (!value || typeof value !== 'object') return 'No decision counts';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .slice(0, 4)
    .map(([key, count]) => `${decisionTagLabel(key === 'untriaged' ? null : key)} ${count}`);
  return entries.length > 0 ? entries.join(' • ') : 'No decision counts';
}

function eventTypeLabel(eventType: WorkspaceEvent['event_type']) {
  return {
    shortlist_created: 'Shortlist Created',
    shortlist_updated: 'Search Updated',
    item_added: 'Organisation Added',
    item_removed: 'Organisation Removed',
    note_updated: 'Note Updated',
    decision_updated: 'Decision Changed',
    task_created: 'Task Created',
    task_updated: 'Task Updated',
    task_completed: 'Task Completed',
    checklist_updated: 'Checklist Updated',
    pack_exported: 'Decision Pack Exported',
    approval_updated: 'Approval Updated',
    comment_added: 'Comment Added',
  }[eventType];
}

function isTabKey(value: string | null): value is TabKey {
  return value === 'discover' || value === 'enrich' || value === 'pack';
}

function sortShortlistItems(items: ShortlistRecord[]) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.updated_at).getTime();
    const timeB = new Date(b.updated_at).getTime();
    return timeB - timeA;
  });
}

function taskPriorityRank(priority: ProcurementTask['priority']) {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }[priority];
}

function sortTasks(tasks: ProcurementTask[]) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'done') return 1;
      if (b.status === 'done') return -1;
    }
    const priorityDelta = taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function buildDecisionCounts(items: ShortlistRecord[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.decision_tag || 'untriaged';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function taskPriorityBadgeClass(priority: ProcurementTask['priority']) {
  switch (priority) {
    case 'critical':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'high':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'medium':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

function taskStatusBadgeClass(status: ProcurementTask['status']) {
  switch (status) {
    case 'done':
      return 'border-money bg-money-light text-money';
    case 'in_progress':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black';
  }
}

function taskStatusLabel(status: ProcurementTask['status']) {
  return {
    open: 'Open',
    in_progress: 'In Progress',
    done: 'Done',
  }[status];
}

function taskTypeLabel(taskType: ProcurementTask['task_type']) {
  return {
    review_alert: 'Review Alert',
    follow_up: 'Follow Up',
    evidence_check: 'Evidence Check',
    pack_refresh: 'Pack Refresh',
  }[taskType];
}

function teamMemberLabel(member: TeamMember | null | undefined) {
  if (!member) return 'Unassigned';
  return member.display_name || member.full_name || member.email || 'Unknown user';
}

function procurementRoleLabel(role: TeamMember['procurement_role'] | string | null | undefined) {
  return {
    lead: 'Lead',
    reviewer: 'Reviewer',
    approver: 'Approver',
    observer: 'Observer',
  }[role || ''] || 'Observer';
}

function permissionLabel(permission: keyof ProcurementPermissions) {
  return {
    can_edit_shortlist: 'Edit shortlist',
    can_manage_tasks: 'Manage tasks',
    can_submit_signoff: 'Submit sign-off',
    can_approve: 'Approve packs',
    can_manage_team: 'Manage team',
    can_reopen_approval: 'Reopen approval',
    can_send_notifications: 'Send outbound',
  }[permission];
}

function notificationModeLabel(mode: TeamMember['notification_mode'] | ProcurementNotification['delivery_mode'] | string | null | undefined) {
  return {
    immediate: 'Immediate',
    daily_digest: 'Daily Digest',
    none: 'Muted',
  }[mode || ''] || 'Immediate';
}

function approvalStatusLabel(status: ShortlistSummary['approval_status']) {
  return {
    draft: 'Draft',
    review_ready: 'Review Ready',
    submitted: 'Submitted',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
  }[status];
}

function approvalStatusClass(status: ShortlistSummary['approval_status']) {
  switch (status) {
    case 'approved':
      return 'border-money bg-money-light text-money';
    case 'submitted':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'changes_requested':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'review_ready':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    default:
      return 'border-bauhaus-black/20 bg-white text-bauhaus-black';
  }
}

function alertTypeLabel(alertType: ProcurementAlert['alert_type']) {
  switch (alertType) {
    case 'task_escalated':
      return 'Escalation';
    case 'task_due':
      return 'Due Reminder';
    case 'brief_rerun':
      return 'Brief Rerun';
    case 'contract_signal_changed':
      return 'Contract Change';
    case 'new_supplier':
      return 'New Supplier';
    case 'removed_supplier':
      return 'Removed Match';
    default:
      return String(alertType).replace(/_/g, ' ');
  }
}

function commentTypeLabel(commentType: ProcurementComment['comment_type']) {
  return {
    discussion: 'Discussion',
    submission: 'Submission',
    approval: 'Approval',
    changes_requested: 'Changes Requested',
    supplier_review: 'Supplier Review',
  }[commentType];
}

function commentTypeClass(commentType: ProcurementComment['comment_type']) {
  switch (commentType) {
    case 'supplier_review':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'approval':
      return 'border-money bg-money-light text-money';
    case 'changes_requested':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'submission':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-black/20 bg-white text-bauhaus-black';
  }
}

function notificationTypeLabel(type: ProcurementNotification['notification_type'] | string) {
  return {
    task_due: 'Task Due',
    task_escalated: 'Task Escalated',
    signoff_submitted: 'Sign-Off Submitted',
    signoff_approved: 'Sign-Off Approved',
    signoff_changes_requested: 'Changes Requested',
  }[type] || String(type).replace(/_/g, ' ');
}

function notificationTypeClass(type: ProcurementNotification['notification_type']) {
  switch (type) {
    case 'task_escalated':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'task_due':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'signoff_submitted':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'signoff_approved':
      return 'border-money bg-money-light text-money';
    default:
      return 'border-bauhaus-black/20 bg-white text-bauhaus-black';
  }
}

function notificationStatusClass(status: ProcurementNotification['status']) {
  switch (status) {
    case 'sent':
      return 'border-money bg-money-light text-money';
    case 'cancelled':
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
    default:
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
  }
}

function deliveryLogStatusClass(status: DeliveryLogEntry['status']) {
  return status === 'processed'
    ? 'border-money bg-money-light text-money'
    : 'border-bauhaus-red bg-error-light text-bauhaus-red';
}

function channelVerificationClass(status: NotificationChannel['verification_status']) {
  switch (status) {
    case 'passed':
      return 'border-money bg-money-light text-money';
    case 'failed':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

function channelVerificationLabel(status: NotificationChannel['verification_status']) {
  return {
    untested: 'Untested',
    passed: 'Verified',
    failed: 'Failed',
  }[status];
}

function packVersionLabel(packExport: PackExportSummary | null | undefined) {
  if (!packExport?.version_number) return 'V1';
  return `V${packExport.version_number}`;
}

function freshnessReferenceDate(item: ShortlistRecord) {
  return item.provenance?.entity_updated_at || item.provenance?.last_seen || item.last_reviewed_at || null;
}

function freshnessTone(item: ShortlistRecord) {
  const referenceDate = freshnessReferenceDate(item);
  if (!referenceDate) {
    return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }

  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 30) {
    return 'border-money bg-money-light text-money';
  }
  if (ageDays <= 90) {
    return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
  }
  return 'border-bauhaus-red bg-error-light text-bauhaus-red';
}

function freshnessLabel(item: ShortlistRecord) {
  const referenceDate = freshnessReferenceDate(item);
  if (!referenceDate) return 'Freshness unknown';
  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 'Fresh this month';
  if (ageDays <= 90) return 'Aging evidence';
  return 'Needs refresh';
}

function taskOutcomeLabel(outcome: ProcurementTask['completion_outcome']) {
  if (!outcome) {
    return 'Outcome pending';
  }

  const labels: Record<NonNullable<ProcurementTask['completion_outcome']>, string> = {
    resolved: 'Resolved',
    follow_up_required: 'Follow Up Required',
    escalated: 'Escalated',
    approved_to_proceed: 'Approved To Proceed',
    excluded: 'Excluded',
  };

  return labels[outcome];
}

function taskOutcomeClass(outcome: ProcurementTask['completion_outcome']) {
  switch (outcome) {
    case 'approved_to_proceed':
      return 'border-money bg-money-light text-money';
    case 'resolved':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'follow_up_required':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'escalated':
    case 'excluded':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

const TASK_COMPLETION_OPTIONS: Array<{
  value: NonNullable<ProcurementTask['completion_outcome']>;
  label: string;
}> = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'approved_to_proceed', label: 'Approved To Proceed' },
  { value: 'follow_up_required', label: 'Needs Follow Up' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'excluded', label: 'Excluded' },
];

function packGovernanceLabel(params: {
  packExport: PackExportSummary;
  shortlist: ShortlistSummary | null | undefined;
}) {
  if (params.shortlist?.approved_pack_export_id === params.packExport.id) {
    return 'Approved record';
  }
  if (params.shortlist?.last_pack_export_id === params.packExport.id) {
    return 'Latest draft';
  }
  if (params.packExport.superseded_at) {
    return 'Superseded';
  }
  return 'Historical version';
}

function reminderSummary(task: ProcurementTask) {
  if (task.reminder_count <= 0) return null;
  const parts = [`Reminder ${task.reminder_count}`];
  if (task.last_reminded_at) {
    parts.push(`last sent ${fmtDateTime(task.last_reminded_at)}`);
  }
  return parts.join(' • ');
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function buildEvidenceSnapshot(item: ShortlistRecord) {
  return {
    supplier_name: item.supplier_name,
    gs_id: item.gs_id,
    supplier_abn: item.supplier_abn,
    decision_tag: item.decision_tag,
    state: item.state,
    lga_name: item.lga_name,
    remoteness: item.remoteness,
    contract_count: item.contract_count,
    contract_total_value: item.contract_total_value,
    latest_revenue: item.latest_revenue,
    source_count: item.provenance?.source_count || 0,
    source_datasets: item.provenance?.source_datasets || [],
    confidence: item.provenance?.confidence || null,
    last_seen: item.provenance?.last_seen || null,
    financial_year: item.provenance?.financial_year || null,
    entity_updated_at: item.provenance?.entity_updated_at || null,
    match_reason: item.provenance?.match_reason || null,
  };
}

function deriveEvidenceConfidence(item: ShortlistRecord) {
  if (item.provenance?.confidence) {
    return item.provenance.confidence;
  }
  const datasets = item.provenance?.source_datasets || [];
  const sourceCount = item.provenance?.source_count || 0;
  if (datasets.some((dataset) => /acnc|oric|abr|abn|registry/i.test(dataset))) {
    return 'registry';
  }
  if (sourceCount >= 3) {
    return 'verified';
  }
  if (sourceCount >= 1) {
    return 'reported';
  }
  return null;
}

function buildPreparedEvidenceSnapshot(item: ShortlistRecord) {
  const base = buildEvidenceSnapshot(item);
  return {
    ...base,
    confidence: deriveEvidenceConfidence(item) || base.confidence,
    last_verified_at: item.provenance?.entity_updated_at || item.provenance?.last_seen || null,
  };
}

function buildPreparedReviewChecklist(item: ShortlistRecord): ReviewChecklist {
  const current = normalizeChecklist(item.review_checklist);
  const sourceCount = item.provenance?.source_count || 0;
  const hasCommercialSignal = (item.contract_count || 0) > 0 || (item.contract_total_value || 0) > 0 || (item.latest_revenue || 0) > 0;
  const isDecisionReady = item.decision_tag === 'priority' || item.decision_tag === 'engage' || item.decision_tag === 'monitor' || item.decision_tag === 'not_now';

  return {
    fit: current.fit || !!item.decision_tag,
    risk_checked: current.risk_checked || hasCommercialSignal,
    evidence_checked: current.evidence_checked || sourceCount > 0,
    decision_made: current.decision_made || isDecisionReady,
  };
}

function tabSectionId(tab: TabKey) {
  return {
    discover: 'discover-workbench',
    enrich: 'enrich-workbench',
    pack: 'pack-workbench',
  }[tab];
}

function publicTabSectionId(tab: TabKey) {
  return {
    discover: 'discover',
    enrich: 'enrich',
    pack: 'pack',
  }[tab];
}

function workspaceRoleLabel(role: string | null | undefined) {
  return {
    lead: 'Procurement Lead',
    reviewer: 'Reviewer',
    approver: 'Approver',
    observer: 'Observer',
  }[role || ''] || 'Observer';
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors"
    >
      {label}
    </button>
  );
}

export default function TenderIntelligencePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedShortlistId = searchParams.get('shortlistId');
  const [authResolved, setAuthResolved] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [shellAuthenticated, setShellAuthenticated] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [operationBlockers, setOperationBlockers] = useState<string[]>([]);
  const [operationNotice, setOperationNotice] = useState('');
  const [workspaceBusyId, setWorkspaceBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [supplierCommentDrafts, setSupplierCommentDrafts] = useState<Record<string, string>>({});
  const [taskCompletionDrafts, setTaskCompletionDrafts] = useState<Record<string, { outcome: NonNullable<ProcurementTask['completion_outcome']>; note: string }>>({});
  const [workspaceItemStatus, setWorkspaceItemStatus] = useState<Record<string, string>>({});
  const [showHistoryPanels, setShowHistoryPanels] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('work');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceDecisionFilter, setWorkspaceDecisionFilter] = useState('all');
  const [showCreateShortlist, setShowCreateShortlist] = useState(false);
  const [shortlistNameDraft, setShortlistNameDraft] = useState('');
  const [shortlistDescriptionDraft, setShortlistDescriptionDraft] = useState('');
  const [creatingShortlist, setCreatingShortlist] = useState(false);
  const [watchIntervalHours, setWatchIntervalHours] = useState(24);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusedShortlistItemId, setFocusedShortlistItemId] = useState<string | null>(null);
  const [activeReviewTaskId, setActiveReviewTaskId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{ shortlistId: string; sectionId: string } | null>(null);
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<'all' | ProcurementNotification['status'] | 'attention'>('all');
  const [notificationModeFilter, setNotificationModeFilter] = useState<'all' | ProcurementNotification['delivery_mode']>('all');
  const [browserOrigin, setBrowserOrigin] = useState('');
  const [summaryDraft, setSummaryDraft] = useState({
    recommendationSummary: '',
    whyNow: '',
    riskSummary: '',
    nextAction: '',
    ownerUserId: '',
    approverUserId: '',
    decisionDueAt: '',
  });
  const [approvalNotesDraft, setApprovalNotesDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [summaryStatus, setSummaryStatus] = useState('');
  const [taskDraft, setTaskDraft] = useState({
    title: '',
    description: '',
    assigneeUserId: '',
    dueAt: '',
    shortlistItemId: '',
    priority: 'medium' as ProcurementTask['priority'],
  });
  const [inviteDraft, setInviteDraft] = useState({
    email: '',
    procurementRole: 'reviewer' as TeamMember['procurement_role'],
    notificationMode: 'immediate' as TeamMember['notification_mode'],
  });
  const [channelDraft, setChannelDraft] = useState({
    channelName: '',
    endpointUrl: '',
    signingSecret: '',
    enabled: true,
    eventTypes: ['task_due', 'task_escalated', 'signoff_submitted', 'signoff_approved', 'signoff_changes_requested'] as ProcurementNotification['notification_type'][],
  });

  const readShellAuth = useCallback(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.body.dataset.authenticated === 'true' || !!document.body.dataset.userEmail;
  }, []);

  const loadWorkspace = useCallback(async (attemptedRecovery = false) => {
    setWorkspaceLoading(true);
    setWorkspaceError('');
    try {
      const params = new URLSearchParams();
      if (selectedShortlistId) {
        params.set('shortlistId', selectedShortlistId);
      }
      const res = await fetch(`/api/tender-intelligence/workspace${params.toString() ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
      });
      if (res.status === 401) {
        const shellAuthed = readShellAuth();
        setShellAuthenticated(shellAuthed);
        if (!attemptedRecovery && typeof window !== 'undefined') {
          const supabase = createSupabaseBrowser();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.auth.refreshSession();
            await loadWorkspace(true);
            return;
          }
          if (shellAuthed) {
            setAuthed(true);
            setAuthResolved(true);
            setWorkspace(null);
            setWorkspaceError('Your CivicGraph session is signed in, but Tender Intelligence is still syncing its workspace session. Retry the workspace or reload the page.');
            return;
          }
        }
        setAuthed(false);
        setWorkspace(null);
        setAuthResolved(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to load procurement workspace');
        setWorkspace(null);
        setAuthed(true);
        setAuthResolved(true);
        return;
      }
      setAuthed(true);
      setShellAuthenticated(true);
      setAuthResolved(true);
      setWorkspace(data);
      setWatchIntervalHours(data.watch?.interval_hours ?? 24);
      setSummaryDraft({
        recommendationSummary: data.shortlist?.recommendation_summary || '',
        whyNow: data.shortlist?.why_now || '',
        riskSummary: data.shortlist?.risk_summary || '',
        nextAction: data.shortlist?.next_action || '',
        ownerUserId: data.shortlist?.owner_user_id || '',
        approverUserId: data.shortlist?.approver_user_id || '',
        decisionDueAt: toDateInputValue(data.shortlist?.decision_due_at),
      });
      setApprovalNotesDraft(data.shortlist?.approval_notes || '');
      setCommentDraft('');
      setSummaryStatus(data.shortlist ? 'Decision brief saved' : '');
      setOperationBlockers([]);
      const nextDrafts: Record<string, string> = {};
      for (const item of data.shortlistItems || []) {
        nextDrafts[item.id] = item.note || '';
      }
      setNoteDrafts(nextDrafts);
      setSupplierCommentDrafts({});
      const nextTaskCompletionDrafts: Record<string, { outcome: NonNullable<ProcurementTask['completion_outcome']>; note: string }> = {};
      for (const task of data.tasks || []) {
        nextTaskCompletionDrafts[task.id] = {
          outcome: task.completion_outcome || 'resolved',
          note: task.completion_note || '',
        };
      }
      setTaskCompletionDrafts(nextTaskCompletionDrafts);
    } catch {
      setWorkspaceError('Unable to load procurement workspace');
      setWorkspace(null);
      setAuthed(readShellAuth());
      setShellAuthenticated(readShellAuth());
      setAuthResolved(true);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [readShellAuth, selectedShortlistId]);

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
    const shellAuthed = readShellAuth();
    setShellAuthenticated(shellAuthed);
    if (shellAuthed) {
      setAuthed(true);
    }
    void loadWorkspace();
  }, [loadWorkspace, readShellAuth]);

  useEffect(() => {
    const handleFocus = () => {
      void loadWorkspace();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadWorkspace]);

  const [tab, setTab] = useState<TabKey>('discover');
  const [publicTab, setPublicTab] = useState<TabKey>('discover');
  const [loading, setLoading] = useState(false);

  // Discover state
  const [discoverState, setDiscoverState] = useState('');
  const [discoverLga, setDiscoverLga] = useState('');
  const [discoverTypes, setDiscoverTypes] = useState<string[]>(['indigenous_corp', 'social_enterprise']);
  const [discoverRemoteness, setDiscoverRemoteness] = useState('');
  const [discoverCommunity, setDiscoverCommunity] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(null);

  // Enrich state
  const [enrichCsv, setEnrichCsv] = useState('');
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);

  // Pack state
  const [packState, setPackState] = useState('');
  const [packLga, setPackLga] = useState('');
  const [packSuppliersCsv, setPackSuppliersCsv] = useState('');
  const [packTotalValue, setPackTotalValue] = useState('');
  const [packResult, setPackResult] = useState<PackResult | null>(null);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const nextTab: TabKey = isTabKey(requestedTab) ? requestedTab : 'discover';
    if (nextTab !== tab) {
      setTab(nextTab);
    }
  }, [searchParams, tab]);

  const replaceWorkspaceQuery = useCallback((updates: { tab?: TabKey | null; shortlistId?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.tab !== undefined) {
      if (!updates.tab || updates.tab === 'discover') {
        params.delete('tab');
      } else {
        params.set('tab', updates.tab);
      }
    }
    if (updates.shortlistId !== undefined) {
      if (updates.shortlistId) {
        params.set('shortlistId', updates.shortlistId);
      } else {
        params.delete('shortlistId');
      }
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const setActiveTab = useCallback((nextTab: TabKey) => {
    setTab(nextTab);
    replaceWorkspaceQuery({ tab: nextTab });
    window.setTimeout(() => {
      document.getElementById(tabSectionId(nextTab))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [replaceWorkspaceQuery]);

  const setActivePublicTab = useCallback((nextTab: TabKey) => {
    setPublicTab(nextTab);
    window.setTimeout(() => {
      document.getElementById(publicTabSectionId(nextTab))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const setActiveShortlist = useCallback((shortlistId: string) => {
    replaceWorkspaceQuery({ shortlistId });
    setWorkspaceError('');
    setWorkspaceSearch('');
    setWorkspaceDecisionFilter('all');
  }, [replaceWorkspaceQuery]);

  const workspaceItemIds = new Set((workspace?.shortlistItems || []).map(item => item.gs_id || item.supplier_key));
  const normalizedWorkspaceSearch = workspaceSearch.trim().toLowerCase();
  const filteredWorkspaceItems = sortShortlistItems((workspace?.shortlistItems || []).filter((item) => {
    const itemDecision = item.decision_tag || 'untriaged';
    if (workspaceDecisionFilter !== 'all' && itemDecision !== workspaceDecisionFilter) {
      return false;
    }
    if (!normalizedWorkspaceSearch) {
      return true;
    }
    const haystack = [
      item.supplier_name,
      item.supplier_abn,
      item.state,
      item.lga_name,
      item.note,
      item.decision_tag,
      item.provenance?.match_reason,
      item.provenance?.source_datasets?.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedWorkspaceSearch);
  }));
  const savedSearchPills = workspace?.shortlist ? getSavedSearchPills(workspace.shortlist.filters) : [];
  const currentUserPermissions = workspace?.currentUserPermissions;
  const canEditWorkspace = currentUserPermissions?.can_edit_shortlist === true;
  const canModifyShortlist = canEditWorkspace && workspace?.shortlist?.approval_lock_active !== true;
  const canManageGovernance = currentUserPermissions?.can_manage_team === true;
  const canSubmitShortlist = currentUserPermissions?.can_submit_signoff === true;
  const canReopenShortlist = currentUserPermissions?.can_reopen_approval === true;
  const canSendNotifications = currentUserPermissions?.can_send_notifications === true;
  const canManageTasks = currentUserPermissions?.can_manage_tasks === true;
  const sortedTasks = sortTasks(workspace?.tasks || []);
  const openTasks = sortedTasks.filter((task) => task.status !== 'done');
  const urgentTasks = openTasks.filter((task) => task.priority === 'critical' || task.priority === 'high');
  const dueSoonTasks = openTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() <= Date.now() + 48 * 60 * 60 * 1000);
  const openEscalations = (workspace?.alerts || []).filter((alert) => alert.status === 'open' && alert.alert_type === 'task_escalated');
  const nextTask = openTasks[0] || null;
  const reviewedShortlistItems = (workspace?.shortlistItems || []).filter((item) => {
    const checklist = normalizeChecklist(item.review_checklist);
    return reviewChecklistCount(checklist) > 0 || !!item.decision_tag || !!item.note;
  });
  const activeReviewTask = sortedTasks.find((task) => task.id === activeReviewTaskId) || null;
  const activeReviewItem = activeReviewTask?.shortlist_item_id
    ? (workspace?.shortlistItems || []).find((item) => item.id === activeReviewTask.shortlist_item_id) || null
    : null;
  const latestWorkflowRun = workspace?.workflowRuns?.[0] || null;
  const latestEvent = workspace?.recentEvents?.[0] || null;
  const latestPackExport = workspace?.packExports?.[0] || null;
  const approvedPackExport = workspace?.packExports?.find((packExport) => packExport.id === workspace.shortlist?.approved_pack_export_id) || null;
  const signoffComments = (workspace?.comments || []).filter((comment) => !comment.shortlist_item_id);
  const supplierCommentsByItemId = (workspace?.comments || []).reduce<Record<string, ProcurementComment[]>>((acc, comment) => {
    if (comment.shortlist_item_id) {
      acc[comment.shortlist_item_id] = [...(acc[comment.shortlist_item_id] || []), comment];
    }
    return acc;
  }, {});
  const currentUserMember = workspace?.teamMembers.find((member) => member.user_id === workspace.currentUserId) || null;
  const ownerMember = workspace?.teamMembers.find((member) => member.user_id === (summaryDraft.ownerUserId || workspace.shortlist?.owner_user_id)) || null;
  const approverMember = workspace?.teamMembers.find((member) => member.user_id === (summaryDraft.approverUserId || workspace.shortlist?.approver_user_id)) || null;
  const requiresSeparateApprover = (workspace?.teamMembers.filter((member) => member.procurement_role !== 'observer' || member.is_owner).length || 0) > 1;
  const governanceMembers = workspace?.teamMembers || [];
  const notificationChannels = workspace?.notificationChannels || [];
  const ownerOptions = governanceMembers.filter((member) => member.is_owner || member.procurement_role === 'lead' || member.procurement_role === 'reviewer');
  const approverOptions = governanceMembers.filter((member) => member.is_owner || member.procurement_role === 'lead' || member.procurement_role === 'approver');
  const taskAssigneeOptions = governanceMembers.filter((member) => member.is_owner || member.procurement_role !== 'observer');
  const canApproveShortlist = !!workspace?.shortlist && currentUserPermissions?.can_approve === true && (
    workspace.currentUserId === workspace.shortlist.approver_user_id
    || currentUserMember?.permissions.can_manage_team
    || (!workspace.shortlist.approver_user_id && workspace.currentUserId === workspace.shortlist.owner_user_id)
  );
  const canParticipateInGovernance = canEditWorkspace || canApproveShortlist;
  const latestPackIsStale = !!workspace?.shortlist && !!latestPackExport
    && new Date(workspace.shortlist.updated_at).getTime() > new Date(latestPackExport.created_at).getTime();
  const decisionPackBlockers: PackReadinessBlocker[] = workspace?.shortlist
    ? getDecisionPackBlockers({
        shortlist: workspace.shortlist,
        items: workspace.shortlistItems.map((item) => ({
          id: item.id,
          supplier_name: item.supplier_name,
          decision_tag: item.decision_tag,
          note: item.note,
          review_checklist: item.review_checklist,
          evidence_snapshot: {
            ...(item.evidence_snapshot || {}),
            source_count: item.provenance?.source_count || 0,
            source_datasets: item.provenance?.source_datasets || [],
            confidence: item.provenance?.confidence || null,
            last_seen: item.provenance?.last_seen || null,
            entity_updated_at: item.provenance?.entity_updated_at || null,
          },
        })),
      })
    : [];
  const hasDecisionPackBlockers = decisionPackBlockers.length > 0;
  const firstDecisionPackBlocker = decisionPackBlockers[0] || null;
  const recommendedSupplierCount = (workspace?.shortlist?.decision_counts.priority || 0) + (workspace?.shortlist?.decision_counts.engage || 0);
  const shortlistHasItems = (workspace?.shortlistItems.length || 0) > 0;
  const activeDecisionItems = (workspace?.shortlistItems || []).filter((item) => ['priority', 'engage', 'reviewing'].includes(item.decision_tag || ''));
  const reviewedDecisionItemCount = activeDecisionItems.filter((item) => {
    const checklistCount = reviewChecklistCount(normalizeChecklist(item.review_checklist));
    return checklistCount > 0 && !!item.note && (item.provenance?.source_count || 0) > 0;
  }).length;
  const hasLockedApprovedPack = workspace?.shortlist?.approval_lock_active === true;
  const recentNotifications = (workspace?.notifications || []).slice(0, 8);
  const myTasks = workspace?.myTasks || [];
  const myApprovals = workspace?.myApprovals || [];
  const myNotifications = workspace?.myNotifications || [];
  const hasInboxItems = myTasks.length > 0 || myApprovals.length > 0 || myNotifications.length > 0;
  const showWorkQueue = sortedTasks.length > 0 || !!activeReviewTask;
  const recentDeliveryLogs = workspace?.deliveryLogs || [];
  const recentInspectorReceipts = workspace?.inspectorReceipts || [];
  const channelHealth = workspace?.channelHealth || [];
  const outboundMetrics = workspace?.outboundMetrics || {
    queued: 0,
    needsAttention: 0,
    sentRecently: 0,
    webhookFailures: 0,
  };
  const readinessChecklist = workspace?.shortlist ? [
    {
      label: 'Decision brief written',
      detail: workspace.shortlist.recommendation_summary ? 'Recommendation summary saved.' : 'Add the recommendation summary.',
      done: !!workspace.shortlist.recommendation_summary?.trim(),
    },
    {
      label: 'Owner assigned',
      detail: ownerMember ? `Owner: ${teamMemberLabel(ownerMember)}` : 'Assign the decision owner.',
      done: !!workspace.shortlist.owner_user_id,
    },
    {
      label: 'Approver assigned',
      detail: approverMember ? `Approver: ${teamMemberLabel(approverMember)}` : 'Assign the approver.',
      done: !!workspace.shortlist.approver_user_id,
    },
    {
      label: 'Decision due date set',
      detail: workspace.shortlist.decision_due_at ? `Due ${fmtDateTime(workspace.shortlist.decision_due_at)}` : 'Set the decision due date.',
      done: !!workspace.shortlist.decision_due_at,
    },
    {
      label: 'Recommended suppliers tagged',
      detail: recommendedSupplierCount > 0 ? `${recommendedSupplierCount} supplier${recommendedSupplierCount === 1 ? '' : 's'} tagged Priority or Engage.` : 'Tag at least one supplier as Priority or Engage.',
      done: recommendedSupplierCount > 0,
    },
    {
      label: 'Pack blockers cleared',
      detail: hasDecisionPackBlockers ? `${decisionPackBlockers.length} blocker${decisionPackBlockers.length === 1 ? '' : 's'} remain.` : 'Ready to generate a decision pack.',
      done: !hasDecisionPackBlockers,
    },
  ] : [];
  const briefStageDone = readinessChecklist.slice(0, 4).every((item) => item.done);
  const readinessCompletedCount = readinessChecklist.filter((item) => item.done).length;
  const currentWorkflowStage: WorkflowStage = !workspace?.shortlist
    ? 'brief'
    : workspace.shortlist.approval_lock_active && !!approvedPackExport
      ? 'export'
    : workspace.shortlist.approval_status === 'submitted'
      ? 'signoff'
      : !briefStageDone
        ? 'brief'
        : 'review';
  const workflowStageStatus: Record<WorkflowStage, 'done' | 'current' | 'upcoming'> = {
    brief: briefStageDone ? 'done' : currentWorkflowStage === 'brief' ? 'current' : 'upcoming',
    review: currentWorkflowStage === 'review' ? 'current' : currentWorkflowStage === 'signoff' || currentWorkflowStage === 'export' ? 'done' : 'upcoming',
    signoff: currentWorkflowStage === 'signoff' ? 'current' : currentWorkflowStage === 'export' ? 'done' : 'upcoming',
    export: currentWorkflowStage === 'export' ? 'current' : 'upcoming',
  };
  const currentRoleHeadline = !workspace?.shortlist
    ? 'Build the shortlist'
    : canApproveShortlist && workspace.shortlist.approval_status === 'submitted'
      ? 'You are the approver right now'
      : workspace.shortlist.approval_status === 'submitted'
        ? 'This shortlist is waiting on approval'
      : workspace.currentUserId === workspace.shortlist.owner_user_id
        ? 'You are the decision owner'
        : activeReviewTask && activeReviewTask.assignee_user_id === workspace.currentUserId
          ? 'You are the active reviewer'
          : myTasks.length > 0
            ? 'You have review work waiting'
            : myApprovals.length > 0
              ? 'You have sign-off waiting'
              : currentUserMember?.procurement_role === 'observer'
                ? 'You are observing this workflow'
                : 'You are supporting this shortlist';
  const currentRoleSupport = !workspace?.shortlist
    ? 'Start with discovery, then save organisations into a shortlist.'
    : canApproveShortlist && workspace.shortlist.approval_status === 'submitted'
      ? 'Open the latest pack, read the sign-off notes, and decide whether to approve or request changes.'
      : workspace.shortlist.approval_status === 'submitted'
        ? 'The shortlist has been submitted. Use the latest pack as the current record and wait for the approver outcome.'
      : workspace.currentUserId === workspace.shortlist.owner_user_id
        ? 'You are responsible for moving this shortlist to a clear recommendation and sign-off state.'
        : activeReviewTask && activeReviewTask.assignee_user_id === workspace.currentUserId
          ? 'Complete the active supplier review, update the shortlist, and close the task when the evidence is sufficient.'
          : myTasks.length > 0
            ? 'Start your next assigned review and bring the shortlist up to date.'
            : myApprovals.length > 0
              ? 'A shortlist is waiting on your sign-off.'
              : currentUserMember
                ? `Current notification mode: ${notificationModeLabel(currentUserMember.notification_mode)}.`
                : 'Your permissions are loaded from the current procurement workspace.';
  const currentActionTitle = !workspace?.shortlist
    ? 'Create the first decision-ready shortlist'
    : workspace.shortlist.approval_lock_active && approvedPackExport
      ? 'Decision approved. Use the locked memo.'
      : workspace.shortlist.approval_status === 'changes_requested'
        ? 'Changes were requested before sign-off.'
      : canApproveShortlist && workspace.shortlist.approval_status === 'submitted'
          ? 'This shortlist is waiting on your sign-off.'
        : workspace.shortlist.approval_status === 'submitted'
          ? 'Awaiting approver review'
          : activeReviewTask && activeReviewItem
            ? `Review ${activeReviewItem.supplier_name} now`
          : activeReviewTask
              ? `Link and work task "${activeReviewTask.title}"`
              : nextTask
                ? `Start the next review task: ${nextTask.title}`
                : hasDecisionPackBlockers
                  ? (firstDecisionPackBlocker?.action_label || 'Resolve pack blockers before export')
                    : latestPackIsStale && latestPackExport
                      ? `Refresh ${packVersionLabel(latestPackExport)}`
                    : shortlistHasItems
                      ? 'Finish the shortlist and freeze the decision'
                      : 'Build the shortlist from the saved market brief';
  const currentActionBody = !workspace?.shortlist
    ? 'Run discovery, save the organisations that matter, and then assign ownership and due date.'
    : workspace.shortlist.approval_lock_active && approvedPackExport
      ? 'The shortlist is locked to the approved pack. Treat that memo as the live decision record until a lead reopens the shortlist.'
      : workspace.shortlist.approval_status === 'changes_requested'
        ? 'Update the brief, shortlist, or supplier evidence in response to the comments, then generate a fresh pack and resubmit.'
      : canApproveShortlist && workspace.shortlist.approval_status === 'submitted'
          ? 'The team has already frozen the shortlist. Your next step is to read the pack and record an approval outcome.'
        : workspace.shortlist.approval_status === 'submitted'
          ? 'The shortlist is already in sign-off. Track comments, keep the shortlist stable, and wait for the approval outcome.'
          : activeReviewTask && activeReviewItem
            ? 'Update the supplier decision tag, note, and checklist so the shortlist reflects a real procurement judgement.'
            : activeReviewTask
              ? 'Pick the supplier this task refers to, then work the note, decision tag, and checklist in the shortlist.'
              : nextTask
                ? 'Work the next review item instead of browsing history or metrics first. The shortlist is ready for supplier-level review.'
                : hasDecisionPackBlockers
                  ? `${firstDecisionPackBlocker?.message || 'The system knows what is missing.'} The system will take you straight to the right field or supplier row.`
                  : latestPackIsStale && latestPackExport
                    ? 'The shortlist changed after the latest pack was generated. Refresh the memo so sign-off is tied to the current evidence state.'
                    : shortlistHasItems
                      ? 'The shortlist has enough substance to move from research into a governed procurement decision.'
                      : 'Apply the saved brief or run discovery to populate the shortlist before doing governance or export work.';
  const currentActionDoneWhen = !workspace?.shortlist
    ? 'Done when at least one supplier is saved into the shortlist.'
    : workspace.shortlist.approval_lock_active && approvedPackExport
      ? 'Done when the approved memo has been used or shared for the current procurement step.'
      : workspace.shortlist.approval_status === 'changes_requested'
        ? 'Done when a fresh pack is generated and the shortlist is resubmitted for sign-off.'
      : canApproveShortlist && workspace.shortlist.approval_status === 'submitted'
          ? 'Done when the shortlist is approved or changes are requested with a recorded note.'
        : workspace.shortlist.approval_status === 'submitted'
          ? 'Done when the approver records an outcome on the submitted pack.'
          : activeReviewTask
            ? 'Done when the supplier note, decision tag, and checklist are updated and the task is marked done.'
            : hasDecisionPackBlockers
              ? 'Done when the blocker list reaches zero.'
              : latestPackIsStale && latestPackExport
                ? 'Done when a fresh pack version replaces the stale one.'
                : shortlistHasItems
                  ? 'Done when the pack is generated and ready for sign-off.'
                  : 'Done when discovery has produced a shortlist the team can review.';
  const pendingInvites = workspace?.pendingInvites || [];
  const filteredNotifications = recentNotifications.filter((notification) => {
    if (notificationModeFilter !== 'all' && notification.delivery_mode !== notificationModeFilter) {
      return false;
    }
    if (notificationStatusFilter === 'all') {
      return true;
    }
    if (notificationStatusFilter === 'attention') {
      return notification.status === 'cancelled' || (notification.status === 'queued' && !!notification.last_error);
    }
    return notification.status === notificationStatusFilter;
  });
  const summaryIsDirty = !!workspace?.shortlist && (
    summaryDraft.recommendationSummary !== (workspace.shortlist.recommendation_summary || '')
    || summaryDraft.whyNow !== (workspace.shortlist.why_now || '')
    || summaryDraft.riskSummary !== (workspace.shortlist.risk_summary || '')
    || summaryDraft.nextAction !== (workspace.shortlist.next_action || '')
    || summaryDraft.ownerUserId !== (workspace.shortlist.owner_user_id || '')
    || summaryDraft.approverUserId !== (workspace.shortlist.approver_user_id || '')
    || summaryDraft.decisionDueAt !== toDateInputValue(workspace.shortlist.decision_due_at)
  );
  const suggestedOwnerUserId = summaryDraft.ownerUserId
    || workspace?.shortlist?.owner_user_id
    || workspace?.currentUserId
    || ownerOptions[0]?.user_id
    || '';
  const suggestedApproverUserId = summaryDraft.approverUserId
    || workspace?.shortlist?.approver_user_id
    || (requiresSeparateApprover
      ? approverOptions.find((member) => member.user_id !== suggestedOwnerUserId)?.user_id || ''
      : workspace?.currentUserId || approverOptions[0]?.user_id || '');
  const suggestedDecisionBrief = workspace?.shortlist
    ? buildSuggestedDecisionBrief({
        shortlist: workspace.shortlist,
        items: workspace.shortlistItems,
        ownerUserId: suggestedOwnerUserId,
        approverUserId: suggestedApproverUserId,
        decisionDueAt: summaryDraft.decisionDueAt || toDateInputValue(workspace.shortlist.decision_due_at) || nextDateInputValue(7),
      })
    : null;
  const selectedTaskItem = taskDraft.shortlistItemId
    ? (workspace?.shortlistItems || []).find((item) => item.id === taskDraft.shortlistItemId) || null
    : null;
  const suggestedTaskDraft = workspace?.shortlist
    ? buildSuggestedTaskDraft({
        shortlist: workspace.shortlist,
        selectedItem: selectedTaskItem,
        blocker: firstDecisionPackBlocker,
        currentUserId: taskDraft.assigneeUserId || workspace.currentUserId || '',
      })
    : null;
  const suggestedApprovalNote = workspace?.shortlist
    ? buildSuggestedApprovalNote({
        shortlist: workspace.shortlist,
        items: workspace.shortlistItems,
        latestPackExport,
        blockerCount: decisionPackBlockers.length,
      })
    : '';
  const suggestedSignoffComment = workspace?.shortlist
    ? buildSuggestedSignoffComment({
        shortlist: workspace.shortlist,
        items: workspace.shortlistItems,
      })
    : '';
  const supplierBlockers = decisionPackBlockers.filter((blocker) => !!blocker.shortlist_item_id);
  const governanceBlockers = decisionPackBlockers.filter((blocker) => !blocker.shortlist_item_id);
  const shortlistItemsNeedingRealCopy = (workspace?.shortlistItems || []).filter((item) => {
    const supplierComments = supplierCommentsByItemId[item.id] || [];
    return !item.note?.trim()
      || looksPlaceholderCopy(item.note)
      || supplierComments.length === 0;
  });
  const nextSupplierForReview = (() => {
    if (!workspace?.shortlistItems?.length) return null;
    const blockerItemId = supplierBlockers[0]?.shortlist_item_id;
    if (blockerItemId) {
      return workspace.shortlistItems.find((item) => item.id === blockerItemId) || null;
    }
    return activeDecisionItems.find((item) => {
      const checklistCount = reviewChecklistCount(normalizeChecklist(item.review_checklist));
      return !item.note?.trim() || looksPlaceholderCopy(item.note) || checklistCount < 2;
    }) || activeDecisionItems[0] || workspace.shortlistItems[0] || null;
  })();
  const nextSupplierBlockers = nextSupplierForReview
    ? decisionPackBlockers.filter((blocker) => blocker.shortlist_item_id === nextSupplierForReview.id)
    : [];
  const testingRunSummary = nextSupplierForReview
    ? `Start with ${nextSupplierForReview.supplier_name}. ${nextSupplierBlockers.length > 0
      ? `${nextSupplierBlockers.length} blocker${nextSupplierBlockers.length === 1 ? '' : 's'} are tied to this supplier.`
      : 'This supplier is the fastest place to make the shortlist more decision-ready.'}`
    : 'Load realistic drafts and work the shortlist row by row until the pack blockers clear.';
  const scenarioPrepared = !!workspace?.shortlist
    && !!workspace.shortlist.recommendation_summary?.trim()
    && workspace.shortlistItems.some((item) => !!item.note?.trim() && !looksPlaceholderCopy(item.note))
    && workspace.shortlistItems.some((item) => (supplierCommentsByItemId[item.id] || []).length > 0);
  const governanceReady = readinessChecklist.slice(0, 4).every((item) => item.done);
  const signoffRecorded = !!workspace?.shortlist
    && (workspace.shortlist.approval_status === 'submitted'
      || workspace.shortlist.approval_status === 'approved'
      || workspace.shortlist.approval_status === 'changes_requested');
  const humanTestChecklist = workspace?.shortlist ? [
    {
      key: 'scenario',
      label: 'Prepare a realistic test scenario',
      done: scenarioPrepared,
      detail: scenarioPrepared
        ? 'Brief, supplier notes, and supplier comments now carry real procurement context.'
        : 'Seed the shortlist with persisted real-context drafts before reviewing.',
      actionLabel: 'Prepare Scenario',
    },
    {
      key: 'review',
      label: 'Complete at least one supplier review',
      done: reviewedDecisionItemCount > 0,
      detail: reviewedDecisionItemCount > 0
        ? `${reviewedDecisionItemCount} supplier row${reviewedDecisionItemCount === 1 ? '' : 's'} now have note, checklist, and evidence coverage.`
        : 'Work one supplier row all the way through note, comment, checklist, and decision tag.',
      actionLabel: nextSupplierForReview ? `Review ${nextSupplierForReview.supplier_name}` : 'Open Shortlist',
    },
    {
      key: 'governance',
      label: 'Fill governance fields and clear blockers',
      done: governanceReady && !hasDecisionPackBlockers,
      detail: governanceReady && !hasDecisionPackBlockers
        ? 'Owner, approver, due date, and recommendation are all in place. No pack blockers remain.'
        : `${governanceBlockers.length} governance blocker${governanceBlockers.length === 1 ? '' : 's'} and ${supplierBlockers.length} supplier blocker${supplierBlockers.length === 1 ? '' : 's'} still need attention.`,
      actionLabel: governanceBlockers[0]?.action_label || 'Open Sign-Off',
    },
    {
      key: 'pack',
      label: 'Generate a fresh decision pack',
      done: !!latestPackExport && !latestPackIsStale,
      detail: latestPackExport
        ? `${packVersionLabel(latestPackExport)} saved ${fmtDateTime(latestPackExport.created_at)}${latestPackIsStale ? ' but it is stale against the current shortlist.' : ' and aligned to the current shortlist.'}`
        : 'Freeze the current shortlist, evidence, and recommendation into a saved decision artifact.',
      actionLabel: latestPackIsStale && latestPackExport ? `Refresh ${packVersionLabel(latestPackExport)}` : 'Generate Pack',
    },
    {
      key: 'signoff',
      label: 'Record a sign-off outcome',
      done: signoffRecorded,
      detail: signoffRecorded
        ? `Current sign-off state: ${approvalStatusLabel(workspace.shortlist.approval_status)}.`
        : 'Submit the fresh pack for sign-off or record an approval outcome.',
      actionLabel: canApproveShortlist ? 'Open Approval' : 'Open Sign-Off',
    },
    {
      key: 'memo',
      label: 'Open the saved memo and verify the output',
      done: !!latestPackExport,
      detail: latestPackExport
        ? 'Open the saved memo, check the board-style narrative, and download the PDF.'
        : 'A memo becomes available once the first decision pack is generated.',
      actionLabel: latestPackExport ? 'Open Memo' : 'Memo Not Ready',
    },
  ] : [];
  const humanTestCompletedCount = humanTestChecklist.filter((item) => item.done).length;

  useEffect(() => {
    const shortlist = workspace?.shortlist;
    if (!shortlist) return;
    setWorkspaceMode((previousMode) => {
      if (previousMode === 'admin') {
        return previousMode;
      }
      if (shortlist.approval_lock_active || shortlist.approval_status === 'submitted') {
        return 'signoff';
      }
      return 'work';
    });
  }, [
    workspace?.shortlist?.id,
    workspace?.shortlist?.approval_lock_active,
    workspace?.shortlist?.approval_status,
  ]);

  const syncWorkspaceItems = useCallback((items: ShortlistRecord[]) => {
    setWorkspace((prev) => {
      if (!prev || !prev.shortlist) {
        return prev;
      }
      const nextShortlists = prev.shortlists.map((shortlist) => shortlist.id === prev.shortlist?.id ? {
        ...shortlist,
        item_count: items.length,
        decision_counts: buildDecisionCounts(items),
      } : shortlist);
      const nextActiveShortlist = nextShortlists.find((shortlist) => shortlist.id === prev.shortlist?.id) || prev.shortlist;
      return {
        ...prev,
        shortlists: nextShortlists,
        shortlist: nextActiveShortlist,
        shortlistItems: sortShortlistItems(items),
      };
    });
  }, []);

  const syncActiveShortlist = useCallback((shortlist: ShortlistSummary) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shortlists: prev.shortlists.map((candidate) => candidate.id === shortlist.id ? {
          ...candidate,
          ...shortlist,
        } : candidate),
        shortlist: prev.shortlist?.id === shortlist.id ? {
          ...prev.shortlist,
          ...shortlist,
        } : prev.shortlist,
      };
    });
  }, []);

  function scrollToWorkspace() {
    document.getElementById('procurement-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToDiscover() {
    document.getElementById('discover-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusField(fieldId: string) {
    const element = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!element) return;
    element.focus();
    if ('select' in element) {
      element.select();
    }
  }

  function openWorkspaceMode(mode: WorkspaceMode, sectionId?: string) {
    setWorkspaceMode(mode);
    if (sectionId) {
      window.setTimeout(() => scrollToSection(sectionId), 50);
    }
  }

  function openHistoryPanelsView() {
    setWorkspaceMode('signoff');
    setShowHistoryPanels(true);
    window.setTimeout(() => scrollToSection('workflow-history'), 50);
  }

  function focusShortlistItem(
    params: {
      itemId: string;
      supplierName: string;
      fieldId?: string;
    },
  ) {
    setWorkspaceMode('work');
    setWorkspaceDecisionFilter('all');
    setWorkspaceSearch(params.supplierName);
    setFocusedShortlistItemId(params.itemId);
    window.setTimeout(() => {
      const row = document.getElementById(`shortlist-item-${params.itemId}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (params.fieldId) {
        window.setTimeout(() => focusField(params.fieldId || ''), 120);
      }
    }, 90);
  }

  function resolveDecisionPackBlocker(blocker: PackReadinessBlocker | null) {
    if (!blocker) return;

    if (blocker.target_mode === 'signoff') {
      openWorkspaceMode('signoff', blocker.target_section_id);
      window.setTimeout(() => focusField(blocker.target_field_id), 120);
      return;
    }

    if (blocker.shortlist_item_id && blocker.supplier_name) {
      focusShortlistItem({
        itemId: blocker.shortlist_item_id,
        supplierName: blocker.supplier_name,
        fieldId: blocker.target_field_id,
      });
      return;
    }

    openWorkspaceMode('work', blocker.target_section_id);
  }

  useEffect(() => {
    if (!pendingNavigation || workspace?.shortlist?.id !== pendingNavigation.shortlistId) {
      return;
    }
    if (pendingNavigation.sectionId === 'workflow-history') {
      setWorkspaceMode('signoff');
      setShowHistoryPanels(true);
    } else if (pendingNavigation.sectionId === 'decision-signoff') {
      setWorkspaceMode('signoff');
    } else if (pendingNavigation.sectionId === 'review-queue' || pendingNavigation.sectionId === 'procurement-workspace') {
      setWorkspaceMode('work');
    }
    const timeoutId = window.setTimeout(() => {
      scrollToSection(pendingNavigation.sectionId);
      setPendingNavigation(null);
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [pendingNavigation, workspace?.shortlist?.id]);

  async function startReviewTask(task: ProcurementTask) {
    setWorkspaceMode('work');
    setFocusedTaskId(task.id);
    setActiveReviewTaskId(task.id);
    setFocusedShortlistItemId(task.shortlist_item_id || null);
    if (task.status === 'open') {
      await updateTask(task.id, { status: 'in_progress' });
    }
    if (task.shortlist_item_id) {
      const linkedItem = (workspace?.shortlistItems || []).find((item) => item.id === task.shortlist_item_id);
      if (linkedItem) {
        setWorkspaceSearch(linkedItem.supplier_name);
      }
    }
    scrollToSection('procurement-workspace');
  }

  function clearReviewMode() {
    setActiveReviewTaskId(null);
    setFocusedTaskId(null);
    setFocusedShortlistItemId(null);
    setWorkspaceSearch('');
  }

  async function linkTaskToSupplier(task: ProcurementTask, item: ShortlistRecord) {
    const updatedTask = await updateTask(task.id, {
      shortlistItemId: item.id,
      metadata: {
        ...(task.metadata || {}),
        gs_id: item.gs_id,
        supplier_name: item.supplier_name,
      },
    });
    if (updatedTask) {
      setActiveReviewTaskId(updatedTask.id);
      setFocusedTaskId(updatedTask.id);
      setFocusedShortlistItemId(item.id);
      setWorkspaceSearch(item.supplier_name);
      window.setTimeout(() => scrollToSection('procurement-workspace'), 50);
    }
  }

  async function toggleReviewChecklist(item: ShortlistRecord, key: keyof ReviewChecklist) {
    const checklist = normalizeChecklist(item.review_checklist);
    await updateShortlistItem(item.id, {
      reviewChecklist: {
        ...checklist,
        [key]: !checklist[key],
      },
      evidenceSnapshot: buildEvidenceSnapshot(item),
    });
  }

  async function startNextTask() {
    if (nextTask) {
      await startReviewTask(nextTask);
      return;
    }
    setWorkspaceMode('work');
    scrollToSection('procurement-workspace');
  }

  function applySavedBrief() {
    if (!workspace?.shortlist) return;
    setWorkspaceMode('work');
    const filters = workspace.shortlist.filters || {};
    setDiscoverState(typeof filters.state === 'string' ? filters.state : '');
    setDiscoverLga(typeof filters.lga === 'string' ? filters.lga : '');
    setDiscoverRemoteness(typeof filters.remoteness === 'string' ? filters.remoteness : '');
    setDiscoverCommunity(filters.community_controlled === true);
    setDiscoverTypes(
      Array.isArray(filters.entity_types)
        ? filters.entity_types.filter((value): value is string => typeof value === 'string')
        : ['indigenous_corp', 'social_enterprise'],
    );
    setActiveTab('discover');
    setOperationError('');
    setOperationNotice(`Applied saved market brief from ${workspace.shortlist.name}.`);
    window.setTimeout(scrollToDiscover, 50);
  }

  function applySuggestedDecisionBrief() {
    if (!suggestedDecisionBrief) return;
    setSummaryDraft(suggestedDecisionBrief);
    setSummaryStatus('Unsaved decision changes');
    setOperationNotice('Loaded a suggested decision brief from the current shortlist context.');
    setOperationError('');
  }

  function applySuggestedSupplierNote(item: ShortlistRecord, blockers: PackReadinessBlocker[]) {
    if (!workspace?.shortlist) return;
    const suggestedNote = buildSuggestedSupplierNote({
      item,
      shortlist: workspace.shortlist,
      blockers,
    });
    setNoteDrafts((prev) => ({ ...prev, [item.id]: suggestedNote }));
    setWorkspaceItemStatus((prev) => ({ ...prev, [item.id]: 'Unsaved changes' }));
    setOperationNotice(`Loaded a suggested analyst note for ${item.supplier_name}.`);
    setOperationError('');
  }

  function applySuggestedSupplierComment(item: ShortlistRecord, blockers: PackReadinessBlocker[]) {
    const suggestedComment = buildSuggestedSupplierComment({ item, blockers });
    setSupplierCommentDrafts((prev) => ({ ...prev, [item.id]: suggestedComment }));
    setOperationNotice(`Loaded a suggested review comment for ${item.supplier_name}.`);
    setOperationError('');
  }

  function applySuggestedTaskDraft() {
    if (!suggestedTaskDraft) return;
    setTaskDraft((prev) => ({
      ...prev,
      ...suggestedTaskDraft,
    }));
    setOperationNotice('Loaded a suggested review task from the current shortlist context.');
    setOperationError('');
  }

  function applySuggestedCompletionNote(task: ProcurementTask) {
    const linkedItem = task.shortlist_item_id
      ? (workspace?.shortlistItems || []).find((item) => item.id === task.shortlist_item_id) || null
      : null;
    const draft = taskCompletionDrafts[task.id] || {
      outcome: task.completion_outcome || 'resolved',
      note: task.completion_note || '',
    };
    const nextNote = buildSuggestedCompletionNote({
      task,
      item: linkedItem,
      outcome: draft.outcome,
    });
    setTaskCompletionDrafts((prev) => ({
      ...prev,
      [task.id]: {
        ...draft,
        note: nextNote,
      },
    }));
    setOperationNotice(`Loaded a suggested completion note for ${task.title}.`);
    setOperationError('');
  }

  function applySuggestedApprovalNote() {
    if (!suggestedApprovalNote) return;
    setApprovalNotesDraft(suggestedApprovalNote);
    setOperationNotice('Loaded a suggested sign-off note for the current shortlist.');
    setOperationError('');
  }

  function applySuggestedSignoffComment() {
    if (!suggestedSignoffComment) return;
    setCommentDraft(suggestedSignoffComment);
    setOperationNotice('Loaded a suggested sign-off discussion comment.');
    setOperationError('');
  }

  function loadTestingDrafts() {
    if (!workspace?.shortlist) return;

    if (suggestedDecisionBrief && (
      !summaryDraft.recommendationSummary.trim()
      || !summaryDraft.whyNow.trim()
      || !summaryDraft.riskSummary.trim()
      || !summaryDraft.nextAction.trim()
      || !summaryDraft.ownerUserId
      || !summaryDraft.approverUserId
      || !summaryDraft.decisionDueAt
    )) {
      setSummaryDraft(suggestedDecisionBrief);
      setSummaryStatus('Unsaved decision changes');
    }

    const nextNoteDrafts = { ...noteDrafts };
    const nextStatuses = { ...workspaceItemStatus };
    const nextCommentDrafts = { ...supplierCommentDrafts };

    for (const item of workspace.shortlistItems) {
      const supplierComments = supplierCommentsByItemId[item.id] || [];
      const itemBlockers = decisionPackBlockers.filter((blocker) => blocker.shortlist_item_id === item.id);
      if (!nextNoteDrafts[item.id]?.trim() || looksPlaceholderCopy(nextNoteDrafts[item.id])) {
        nextNoteDrafts[item.id] = buildSuggestedSupplierNote({
          item,
          shortlist: workspace.shortlist,
          blockers: itemBlockers,
        });
        nextStatuses[item.id] = 'Unsaved changes';
      }
      if ((!nextCommentDrafts[item.id] || !nextCommentDrafts[item.id].trim()) && supplierComments.length === 0) {
        nextCommentDrafts[item.id] = buildSuggestedSupplierComment({
          item,
          blockers: itemBlockers,
        });
      }
    }

    setNoteDrafts(nextNoteDrafts);
    setWorkspaceItemStatus(nextStatuses);
    setSupplierCommentDrafts(nextCommentDrafts);

    if ((!taskDraft.title.trim() || looksPlaceholderCopy(taskDraft.title) || !taskDraft.description.trim()) && suggestedTaskDraft) {
      setTaskDraft((prev) => ({
        ...prev,
        ...suggestedTaskDraft,
      }));
    }

    setOperationNotice('Loaded realistic testing drafts into the current shortlist workflow.');
    setOperationError('');
  }

  function startSuggestedSupplierReview() {
    if (!nextSupplierForReview || !workspace?.shortlist) return;
    setWorkspaceMode('work');
    if (!noteDrafts[nextSupplierForReview.id]?.trim() || looksPlaceholderCopy(noteDrafts[nextSupplierForReview.id])) {
      applySuggestedSupplierNote(nextSupplierForReview, nextSupplierBlockers);
    }
    if (!supplierCommentDrafts[nextSupplierForReview.id]?.trim() && (supplierCommentsByItemId[nextSupplierForReview.id] || []).length === 0) {
      applySuggestedSupplierComment(nextSupplierForReview, nextSupplierBlockers);
    }
    focusShortlistItem({
      itemId: nextSupplierForReview.id,
      supplierName: nextSupplierForReview.supplier_name,
      fieldId: `supplier-note-${nextSupplierForReview.id}`,
    });
  }

  async function prepareScenarioForTesting() {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId('prepare-test-scenario');
    setOperationError('');
    setOperationNotice('');

    try {
      if (suggestedDecisionBrief) {
        const summaryRes = await fetch('/api/tender-intelligence/shortlists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shortlistId: workspace.shortlist.id,
            recommendationSummary: suggestedDecisionBrief.recommendationSummary,
            whyNow: suggestedDecisionBrief.whyNow,
            riskSummary: suggestedDecisionBrief.riskSummary,
            nextAction: suggestedDecisionBrief.nextAction,
            ownerUserId: suggestedDecisionBrief.ownerUserId || null,
            approverUserId: suggestedDecisionBrief.approverUserId || null,
            decisionDueAt: suggestedDecisionBrief.decisionDueAt
              ? new Date(`${suggestedDecisionBrief.decisionDueAt}T09:00:00`).toISOString()
              : null,
          }),
        });
        const summaryData = await summaryRes.json();
        if (!summaryRes.ok) {
          throw new Error(summaryData.error || 'Unable to save suggested decision brief');
        }
        setSummaryDraft({
          recommendationSummary: summaryData.shortlist.recommendation_summary || '',
          whyNow: summaryData.shortlist.why_now || '',
          riskSummary: summaryData.shortlist.risk_summary || '',
          nextAction: summaryData.shortlist.next_action || '',
          ownerUserId: summaryData.shortlist.owner_user_id || '',
          approverUserId: summaryData.shortlist.approver_user_id || '',
          decisionDueAt: toDateInputValue(summaryData.shortlist.decision_due_at),
        });
        setSummaryStatus('Decision brief saved');
      }

      for (const item of workspace.shortlistItems) {
        const itemBlockers = decisionPackBlockers.filter((blocker) => blocker.shortlist_item_id === item.id);
        const hasRealNote = !!item.note?.trim() && !looksPlaceholderCopy(item.note);
        const currentChecklist = normalizeChecklist(item.review_checklist);
        const checklistCount = reviewChecklistCount(currentChecklist);
        const preparedChecklist = buildPreparedReviewChecklist(item);
        const preparedEvidenceSnapshot = buildPreparedEvidenceSnapshot(item);
        const shouldSeedChecklist = checklistCount === 0 && reviewChecklistCount(preparedChecklist) > 0;
        const shouldSeedEvidence = !item.provenance?.confidence && !!preparedEvidenceSnapshot.confidence;

        if (!hasRealNote) {
          const nextNote = buildSuggestedSupplierNote({
            item,
            shortlist: workspace.shortlist,
            blockers: itemBlockers,
          });
          const itemRes = await fetch('/api/tender-intelligence/shortlist', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: item.id,
              shortlistId: workspace.shortlist.id,
              note: nextNote,
              reviewChecklist: shouldSeedChecklist ? preparedChecklist : undefined,
              evidenceSnapshot: shouldSeedEvidence ? preparedEvidenceSnapshot : buildEvidenceSnapshot(item),
            }),
          });
          const itemData = await itemRes.json();
          if (!itemRes.ok) {
            throw new Error(itemData.error || `Unable to save note for ${item.supplier_name}`);
          }
        } else if (shouldSeedChecklist || shouldSeedEvidence) {
          const itemRes = await fetch('/api/tender-intelligence/shortlist', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: item.id,
              shortlistId: workspace.shortlist.id,
              reviewChecklist: shouldSeedChecklist ? preparedChecklist : undefined,
              evidenceSnapshot: shouldSeedEvidence ? preparedEvidenceSnapshot : undefined,
            }),
          });
          const itemData = await itemRes.json();
          if (!itemRes.ok) {
            throw new Error(itemData.error || `Unable to seed evidence for ${item.supplier_name}`);
          }
        }

        if ((supplierCommentsByItemId[item.id] || []).length === 0) {
          const commentRes = await fetch('/api/tender-intelligence/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shortlistId: workspace.shortlist.id,
              shortlistItemId: item.id,
              commentType: 'supplier_review',
              body: buildSuggestedSupplierComment({
                item,
                blockers: itemBlockers,
              }),
            }),
          });
          const commentData = await commentRes.json();
          if (!commentRes.ok) {
            throw new Error(commentData.error || `Unable to add supplier comment for ${item.supplier_name}`);
          }
        }
      }

      if (openTasks.length === 0 && suggestedTaskDraft) {
        const linkedItem = suggestedTaskDraft.shortlistItemId
          ? workspace.shortlistItems.find((item) => item.id === suggestedTaskDraft.shortlistItemId) || null
          : null;
        const taskRes = await fetch('/api/tender-intelligence/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shortlistId: workspace.shortlist.id,
            shortlistItemId: linkedItem?.id || null,
            title: suggestedTaskDraft.title,
            description: suggestedTaskDraft.description,
            assigneeUserId: suggestedTaskDraft.assigneeUserId || workspace.currentUserId || null,
            dueAt: suggestedTaskDraft.dueAt ? new Date(`${suggestedTaskDraft.dueAt}T09:00:00`).toISOString() : null,
            priority: suggestedTaskDraft.priority,
            metadata: linkedItem ? {
              gs_id: linkedItem.gs_id,
              supplier_name: linkedItem.supplier_name,
            } : {},
          }),
        });
        const taskData = await taskRes.json();
        if (!taskRes.ok) {
          throw new Error(taskData.error || 'Unable to create suggested review task');
        }
      }

      setApprovalNotesDraft(suggestedApprovalNote);
      setCommentDraft(suggestedSignoffComment);
      setOperationNotice('Prepared a realistic test scenario: brief saved, supplier notes updated, checklist and evidence state seeded from live signals, supplier comments added, and the review flow seeded.');
      await loadWorkspace();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Unable to prepare the test scenario');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  function getDecisionPackDefaults() {
    const filters = workspace?.shortlist?.filters || {};
    const shortlistSuppliers = (workspace?.shortlistItems || []).map((item) => ({
      name: item.supplier_name,
      abn: item.supplier_abn || undefined,
      contract_value: item.contract_total_value || undefined,
    }));
    const derivedTotalContractValue = shortlistSuppliers.reduce((sum, supplier) => sum + (supplier.contract_value || 0), 0);

    return {
      state: packState || (typeof filters.state === 'string' ? filters.state : ''),
      postcode: typeof filters.postcode === 'string' ? filters.postcode : undefined,
      lga: packLga || (typeof filters.lga === 'string' ? filters.lga : ''),
      remoteness: typeof filters.remoteness === 'string' ? filters.remoteness : undefined,
      supplierTypes: Array.isArray(filters.entity_types)
        ? filters.entity_types.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : ['indigenous_corp', 'social_enterprise', 'charity', 'company'],
      existingSuppliers: shortlistSuppliers,
      totalContractValue: packTotalValue ? parseFloat(packTotalValue) : derivedTotalContractValue || undefined,
    };
  }

  async function saveDecisionSummary() {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId(`summary:${workspace.shortlist.id}`);
    setOperationError('');
    setOperationNotice('');
    setSummaryStatus('Saving decision brief...');
    try {
      const res = await fetch('/api/tender-intelligence/shortlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          recommendationSummary: summaryDraft.recommendationSummary,
          whyNow: summaryDraft.whyNow,
          riskSummary: summaryDraft.riskSummary,
          nextAction: summaryDraft.nextAction,
          ownerUserId: summaryDraft.ownerUserId || null,
          approverUserId: summaryDraft.approverUserId || null,
          decisionDueAt: summaryDraft.decisionDueAt ? new Date(`${summaryDraft.decisionDueAt}T09:00:00`).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryStatus('Unable to save decision brief');
        setOperationError(data.error || 'Unable to save decision brief');
        return;
      }
      syncActiveShortlist(data.shortlist as ShortlistSummary);
      setSummaryDraft({
        recommendationSummary: data.shortlist.recommendation_summary || '',
        whyNow: data.shortlist.why_now || '',
        riskSummary: data.shortlist.risk_summary || '',
        nextAction: data.shortlist.next_action || '',
        ownerUserId: data.shortlist.owner_user_id || '',
        approverUserId: data.shortlist.approver_user_id || '',
        decisionDueAt: toDateInputValue(data.shortlist.decision_due_at),
      });
      setSummaryStatus('Decision brief saved');
      setOperationNotice(`Decision brief saved for ${data.shortlist.name}.`);
      void loadWorkspace();
    } catch {
      setSummaryStatus('Unable to save decision brief');
      setOperationError('Unable to save decision brief');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function reopenShortlistForChanges() {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId(`reopen:${workspace.shortlist.id}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          reopenForChanges: true,
          approvalNotes: approvalNotesDraft || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to reopen shortlist');
        return;
      }
      syncActiveShortlist(data.shortlist as ShortlistSummary);
      setOperationNotice(`${data.shortlist.name} reopened for changes.`);
      void loadWorkspace();
    } catch {
      setOperationError('Unable to reopen shortlist');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function addShortlistComment(commentType: ProcurementComment['comment_type'] = 'discussion') {
    if (!workspace?.shortlist || !commentDraft.trim()) return;
    setWorkspaceBusyId(`comment:${workspace.shortlist.id}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          packExportId: latestPackExport?.id || workspace.shortlist.last_pack_export_id || null,
          commentType,
          body: commentDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to add sign-off comment');
        return;
      }
      setCommentDraft('');
      setOperationNotice('Sign-off comment added.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to add sign-off comment');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function addSupplierComment(item: ShortlistRecord) {
    const draft = supplierCommentDrafts[item.id]?.trim();
    if (!workspace?.shortlist || !draft) return;
    setWorkspaceBusyId(`supplier-comment:${item.id}`);
    setWorkspaceError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          shortlistItemId: item.id,
          commentType: 'supplier_review',
          body: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to add supplier review comment');
        return;
      }
      setSupplierCommentDrafts((prev) => ({ ...prev, [item.id]: '' }));
      setOperationNotice(`Added supplier review comment for ${item.supplier_name}.`);
      void loadWorkspace();
    } catch {
      setWorkspaceError('Unable to add supplier review comment');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  function entityHref(gsId: string, anchor?: string) {
    const params = new URLSearchParams();
    if (tab !== 'discover') {
      params.set('tab', tab);
    } else {
      params.delete('tab');
    }
    if (workspace?.shortlist?.id) {
      params.set('shortlistId', workspace.shortlist.id);
    }
    const returnTo = `/tender-intelligence${params.toString() ? `?${params.toString()}` : ''}${anchor ? `#${anchor}` : ''}`;
    return `/entities/${gsId}?from=${encodeURIComponent(returnTo)}`;
  }

  async function runDiscover() {
    setLoading(true);
    setOperationError('');
    setOperationBlockers([]);
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlist_id: workspace?.shortlist?.id || undefined,
          state: discoverState || undefined,
          lga: discoverLga || undefined,
          entity_types: discoverTypes,
          remoteness: discoverRemoteness || undefined,
          community_controlled: discoverCommunity || undefined,
          limit: 50,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setDiscoverResult(null);
        setOperationError(typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Unable to run supplier discovery');
        return;
      }
      if (!isDiscoverResult(data)) {
        setDiscoverResult(null);
        setOperationError('Discovery returned an unexpected response');
        return;
      }
      setDiscoverResult(data);
      void loadWorkspace();
    } catch (err) {
      console.error('Discover error:', err);
      setDiscoverResult(null);
      setOperationError('Unable to run supplier discovery');
    } finally {
      setLoading(false);
    }
  }

  async function runEnrich() {
    setLoading(true);
    setOperationError('');
    setOperationBlockers([]);
    setOperationNotice('');
    try {
      // Parse CSV: name,abn per line
      const lines = enrichCsv.trim().split('\n').filter(Boolean);
      const suppliers = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return { name: parts[0], abn: parts[1] || undefined };
      });

      const res = await fetch('/api/tender-intelligence/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suppliers,
          shortlist_id: workspace?.shortlist?.id || undefined,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setEnrichResult(null);
        setOperationError(typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Unable to enrich supplier list');
        return;
      }
      if (!isEnrichResult(data)) {
        setEnrichResult(null);
        setOperationError('Enrichment returned an unexpected response');
        return;
      }
      setEnrichResult(data);
      void loadWorkspace();
    } catch (err) {
      console.error('Enrich error:', err);
      setEnrichResult(null);
      setOperationError('Unable to enrich supplier list');
    } finally {
      setLoading(false);
    }
  }

  async function runPack(mode: 'form' | 'decision' = 'form') {
    setLoading(true);
    setOperationError('');
    setOperationBlockers([]);
    setOperationNotice('');
    try {
      const decisionDefaults = mode === 'decision' ? getDecisionPackDefaults() : null;
      const existingSuppliers = mode === 'decision'
        ? decisionDefaults?.existingSuppliers || []
        : packSuppliersCsv.trim()
            ? packSuppliersCsv.trim().split('\n').filter(Boolean).map(line => {
                const parts = line.split(',').map(s => s.trim());
                return { name: parts[0], abn: parts[1] || undefined, contract_value: parts[2] ? parseFloat(parts[2]) : undefined };
              })
            : [];

      if (mode === 'decision' && decisionDefaults) {
        setPackState(decisionDefaults.state || '');
        setPackLga(decisionDefaults.lga || '');
      }

      const res = await fetch('/api/tender-intelligence/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlist_id: workspace?.shortlist?.id || undefined,
          state: (decisionDefaults?.state || packState) || undefined,
          postcode: decisionDefaults?.postcode,
          lga: (decisionDefaults?.lga || packLga) || undefined,
          remoteness: decisionDefaults?.remoteness,
          supplier_types: decisionDefaults?.supplierTypes,
          existing_suppliers: existingSuppliers.length > 0 ? existingSuppliers : undefined,
          total_contract_value: decisionDefaults?.totalContractValue ?? (packTotalValue ? parseFloat(packTotalValue) : undefined),
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setPackResult(null);
        const blockers = typeof data === 'object' && data && 'blockers' in data && Array.isArray(data.blockers)
          ? data.blockers.filter((value): value is string => typeof value === 'string')
          : [];
        setOperationBlockers(blockers);
        setOperationError(typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Unable to generate intelligence pack');
        return;
      }
      if (!isPackResult(data)) {
        setPackResult(null);
        setOperationError('Pack generation returned an unexpected response');
        return;
      }
      setPackResult(data);
      setWorkspaceMode('signoff');
      if (data.export?.id) {
        setOperationNotice(`Decision pack saved for ${workspace?.shortlist?.name || 'this shortlist'}. Open the saved pack from the pack history or print it from the report view.`);
      }
      void loadWorkspace();
    } catch (err) {
      console.error('Pack error:', err);
      setPackResult(null);
      setOperationError('Unable to generate intelligence pack');
    } finally {
      setLoading(false);
    }
  }

  async function addSupplierToWorkspace(supplier: SupplierResult) {
    setWorkspaceBusyId(supplier.gs_id);
    setWorkspaceError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier,
          shortlistId: workspace?.shortlist?.id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to save supplier');
        return;
      }
      const nextItem = data.item as ShortlistRecord;
      const existingItems = workspace?.shortlistItems || [];
      const hasExisting = existingItems.some((item) => item.id === nextItem.id);
      syncWorkspaceItems(hasExisting ? existingItems.map((item) => item.id === nextItem.id ? { ...item, ...nextItem } : item) : [nextItem, ...existingItems]);
      setNoteDrafts((prev) => ({ ...prev, [nextItem.id]: nextItem.note || '' }));
      setWorkspaceItemStatus((prev) => ({ ...prev, [nextItem.id]: 'Saved to workspace' }));
      void loadWorkspace();
      scrollToWorkspace();
    } catch {
      setWorkspaceError('Unable to save supplier');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function updateWatchSettings(params: { enabled?: boolean; intervalHours?: number }) {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId(`watch:${workspace.shortlist.id}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/watch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          enabled: params.enabled,
          intervalHours: params.intervalHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to update saved brief watch');
        return;
      }
      setWorkspace((prev) => prev ? { ...prev, watch: data.watch } : prev);
      setWatchIntervalHours(data.watch.interval_hours);
      setOperationNotice(data.watch.enabled
        ? `Watching ${workspace.shortlist.name} every ${data.watch.interval_hours} hours.`
        : `Stopped watching ${workspace.shortlist.name}.`);
    } catch {
      setOperationError('Unable to update saved brief watch');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function rerunSavedBrief() {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId(`rerun:${workspace.shortlist.id}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortlistId: workspace.shortlist.id }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setOperationError(typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Unable to rerun saved brief');
        return;
      }
      if (!isDiscoverResult(data)) {
        setOperationError('Saved brief rerun returned an unexpected response');
        return;
      }
      setDiscoverResult(data);
      setActiveTab('discover');
      void loadWorkspace();
      const delta = typeof data === 'object' && data && 'delta' in data && data.delta && typeof data.delta === 'object'
        ? data.delta as Record<string, number>
        : null;
      const alertsCreated = delta?.alerts_created ?? 0;
      const newSuppliers = delta?.new_supplier_count ?? 0;
      const removedSuppliers = delta?.removed_supplier_count ?? 0;
      setOperationNotice(
        alertsCreated > 0
          ? `Saved brief rerun complete. ${alertsCreated} alerts created, including ${newSuppliers} new and ${removedSuppliers} removed suppliers.`
          : `Saved brief rerun complete for ${workspace.shortlist.name}. No new market alerts this run.`,
      );
      window.setTimeout(scrollToDiscover, 50);
    } catch {
      setOperationError('Unable to rerun saved brief');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function runDueWatches() {
    setWorkspaceBusyId('run-due-watches');
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/automation/run-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to run due watches');
        return;
      }
      void loadWorkspace();
      const escalationSuffix = data.escalationAlertsCreated > 0
        ? ` ${data.escalationAlertsCreated} escalation${data.escalationAlertsCreated === 1 ? '' : 's'} raised.`
        : '';
      setOperationNotice(
        data.completedCount > 0
          ? `Ran ${data.completedCount} due watch${data.completedCount === 1 ? '' : 'es'}. ${data.results?.reduce((sum: number, result: { tasksCreated?: number }) => sum + (result.tasksCreated || 0), 0) || 0} review task${data.results?.reduce((sum: number, result: { tasksCreated?: number }) => sum + (result.tasksCreated || 0), 0) === 1 ? '' : 's'} created and ${data.reminderAlertsCreated || 0} due reminder${data.reminderAlertsCreated === 1 ? '' : 's'} sent.${escalationSuffix}`
          : data.reminderAlertsCreated > 0
            ? `No due watches needed processing. ${data.reminderAlertsCreated} task reminder${data.reminderAlertsCreated === 1 ? '' : 's'} sent.${escalationSuffix}`
            : data.escalationAlertsCreated > 0
              ? `${data.escalationAlertsCreated} escalation${data.escalationAlertsCreated === 1 ? '' : 's'} raised from overdue tasks.`
              : 'No due watches or task reminders needed processing right now.',
      );
    } catch {
      setOperationError('Unable to run due watches');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function updateShortlistItem(itemId: string, updates: {
    note?: string;
    decisionTag?: string;
    reviewChecklist?: Partial<ReviewChecklist>;
    evidenceSnapshot?: Record<string, unknown>;
  }) {
    setWorkspaceBusyId(itemId);
    setWorkspaceError('');
    setWorkspaceItemStatus((prev) => ({
      ...prev,
      [itemId]: updates.note !== undefined
        ? 'Saving note...'
        : updates.decisionTag !== undefined
          ? 'Saving tag...'
          : 'Saving review...',
    }));
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          shortlistId: workspace?.shortlist?.id || undefined,
          ...updates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to update shortlist');
        setWorkspaceItemStatus((prev) => ({ ...prev, [itemId]: 'Unable to save' }));
        return;
      }
      const nextItem = data.item as ShortlistRecord;
      const existingItems = workspace?.shortlistItems || [];
      syncWorkspaceItems(existingItems.map((item) => item.id === nextItem.id ? {
        ...item,
        ...nextItem,
        review_checklist: normalizeChecklist((nextItem as Partial<ShortlistRecord>).review_checklist || item.review_checklist),
        evidence_snapshot: (nextItem as Partial<ShortlistRecord>).evidence_snapshot || item.evidence_snapshot,
        provenance: item.provenance,
      } : item));
      setNoteDrafts((prev) => ({ ...prev, [nextItem.id]: nextItem.note || '' }));
      setWorkspaceItemStatus((prev) => ({
        ...prev,
        [itemId]: updates.note !== undefined
          ? 'Note saved'
          : updates.decisionTag !== undefined
            ? 'Tag saved'
            : 'Review saved',
      }));
    } catch {
      setWorkspaceError('Unable to update shortlist');
      setWorkspaceItemStatus((prev) => ({ ...prev, [itemId]: 'Unable to save' }));
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function updateTask(taskId: string, updates: {
    status?: ProcurementTask['status'];
    priority?: ProcurementTask['priority'];
    dueAt?: string | null;
    assigneeLabel?: string | null;
    assigneeUserId?: string | null;
    completionOutcome?: ProcurementTask['completion_outcome'];
    completionNote?: string | null;
    shortlistItemId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!workspace?.shortlist) return;
    setWorkspaceBusyId(`task:${taskId}`);
    setWorkspaceError('');
    try {
      const res = await fetch('/api/tender-intelligence/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          shortlistId: workspace.shortlist.id,
          ...updates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to update review task');
        return;
      }
      const updatedTask = data.task as ProcurementTask;
      setWorkspace((prev) => prev ? {
        ...prev,
        tasks: sortTasks(prev.tasks.map((task) => task.id === updatedTask.id ? updatedTask : task)),
      } : prev);
      setTaskCompletionDrafts((prev) => ({
        ...prev,
        [updatedTask.id]: {
          outcome: updatedTask.completion_outcome || prev[updatedTask.id]?.outcome || 'resolved',
          note: updatedTask.completion_note || '',
        },
      }));
      void loadWorkspace();
      return updatedTask;
    } catch {
      setWorkspaceError('Unable to update review task');
      return null;
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function completeTask(task: ProcurementTask) {
    const draft = taskCompletionDrafts[task.id] || {
      outcome: task.completion_outcome || 'resolved',
      note: task.completion_note || '',
    };
    setActiveReviewTaskId(null);
    setFocusedShortlistItemId(task.shortlist_item_id || null);
    await updateTask(task.id, {
      status: 'done',
      completionOutcome: draft.outcome,
      completionNote: draft.note,
    });
  }

  async function createManualTask() {
    if (!workspace?.shortlist || !taskDraft.title.trim()) return;
    setWorkspaceBusyId('new-task');
    setWorkspaceError('');
    try {
      const linkedItem = taskDraft.shortlistItemId
        ? (workspace.shortlistItems || []).find((item) => item.id === taskDraft.shortlistItemId) || null
        : null;
      const res = await fetch('/api/tender-intelligence/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: workspace.shortlist.id,
          shortlistItemId: linkedItem?.id || null,
          title: taskDraft.title,
          description: taskDraft.description,
          assigneeUserId: taskDraft.assigneeUserId || null,
          dueAt: taskDraft.dueAt ? new Date(`${taskDraft.dueAt}T09:00:00`).toISOString() : null,
          priority: taskDraft.priority,
          metadata: linkedItem ? {
            gs_id: linkedItem.gs_id,
            supplier_name: linkedItem.supplier_name,
          } : {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to create review task');
        return;
      }
      const nextTask = data.task as ProcurementTask;
      setWorkspace((prev) => prev ? {
        ...prev,
        tasks: sortTasks([nextTask, ...prev.tasks]),
      } : prev);
      setTaskDraft({
        title: '',
        description: '',
        assigneeUserId: '',
        dueAt: '',
        shortlistItemId: '',
        priority: 'medium',
      });
      setOperationNotice(`Added review task to ${workspace.shortlist.name}.`);
      void loadWorkspace();
    } catch {
      setWorkspaceError('Unable to create review task');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function removeShortlistItem(itemId: string) {
    setWorkspaceBusyId(itemId);
    setWorkspaceError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          shortlistId: workspace?.shortlist?.id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to remove shortlist item');
        return;
      }
      const nextItems = (workspace?.shortlistItems || []).filter((item) => item.id !== itemId);
      syncWorkspaceItems(nextItems);
      setNoteDrafts((prev) => {
        const nextDrafts = { ...prev };
        delete nextDrafts[itemId];
        return nextDrafts;
      });
      setWorkspaceItemStatus((prev) => {
        const nextStatus = { ...prev };
        delete nextStatus[itemId];
        return nextStatus;
      });
    } catch {
      setWorkspaceError('Unable to remove shortlist item');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function createShortlist() {
    const name = shortlistNameDraft.trim();
    if (!name) {
      setWorkspaceError('Shortlist name is required');
      return;
    }

    setCreatingShortlist(true);
    setWorkspaceError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: shortlistDescriptionDraft.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Unable to create shortlist');
        return;
      }
      setShowCreateShortlist(false);
      setShortlistNameDraft('');
      setShortlistDescriptionDraft('');
      replaceWorkspaceQuery({ shortlistId: data.shortlist.id });
    } catch {
      setWorkspaceError('Unable to create shortlist');
    } finally {
      setCreatingShortlist(false);
    }
  }

  async function updateGovernanceMember(
    targetUserId: string,
    updates: {
      procurementRole?: TeamMember['procurement_role'];
      notificationMode?: TeamMember['notification_mode'];
      permissionOverrides?: Partial<Record<keyof ProcurementPermissions, boolean>>;
    },
  ) {
    setWorkspaceBusyId(`team:${targetUserId}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          procurementRole: updates.procurementRole,
          notificationMode: updates.notificationMode,
          permissionOverrides: updates.permissionOverrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to update procurement team settings');
        return;
      }
      setOperationNotice('Procurement governance settings updated.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to update procurement team settings');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function inviteGovernanceMember() {
    if (!inviteDraft.email.trim()) return;
    setWorkspaceBusyId('team-invite');
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteDraft.email.trim(),
          procurementRole: inviteDraft.procurementRole,
          notificationMode: inviteDraft.notificationMode,
          orgRole: 'viewer',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to invite procurement team member');
        return;
      }
      setInviteDraft({
        email: '',
        procurementRole: 'reviewer',
        notificationMode: 'immediate',
      });
      setOperationNotice(
        data.status === 'pending_created' || data.status === 'pending_updated'
          ? 'Invitation saved. Procurement role will apply automatically when they join.'
          : 'Team member added to the procurement workspace.',
      );
      void loadWorkspace();
    } catch {
      setOperationError('Unable to invite procurement team member');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function resendPendingInvite(inviteId: string) {
    setWorkspaceBusyId(`invite:${inviteId}:resend`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to resend invite');
        return;
      }
      setOperationNotice('Invitation resent.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to resend invite');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function cancelPendingInvite(inviteId: string) {
    setWorkspaceBusyId(`invite:${inviteId}:cancel`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to cancel invite');
        return;
      }
      setOperationNotice('Pending invite cancelled.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to cancel invite');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function saveNotificationChannel(channelId?: string) {
    if (!channelDraft.channelName.trim() || !channelDraft.endpointUrl.trim()) {
      setOperationError('Webhook name and URL are required.');
      return;
    }

    setWorkspaceBusyId(channelId ? `channel:${channelId}` : 'channel:new');
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team/channels', {
        method: channelId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          channelName: channelDraft.channelName.trim(),
          endpointUrl: channelDraft.endpointUrl.trim(),
          signingSecret: channelDraft.signingSecret.trim() || null,
          enabled: channelDraft.enabled,
          eventTypes: channelDraft.eventTypes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to save notification channel');
        return;
      }
      setOperationNotice(channelId ? 'Notification channel updated.' : 'Notification channel created.');
      setChannelDraft({
        channelName: '',
        endpointUrl: '',
        signingSecret: '',
        enabled: true,
        eventTypes: ['task_due', 'task_escalated', 'signoff_submitted', 'signoff_approved', 'signoff_changes_requested'],
      });
      void loadWorkspace();
    } catch {
      setOperationError('Unable to save notification channel');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function sendWebhookTest(channelId: string) {
    setWorkspaceBusyId(`channel:test:${channelId}`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/team/channels/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to send webhook test');
        return;
      }
      setOperationNotice(`Webhook test sent to ${data.channelName}.`);
    } catch {
      setOperationError('Unable to send webhook test');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function copyInspectorUrl(channel: NotificationChannel) {
    if (!browserOrigin) return;
    const inspectorUrl = `${browserOrigin}/api/tender-intelligence/automation/webhook-inspector/${channel.verification_token}`;
    try {
      await navigator.clipboard.writeText(inspectorUrl);
      setOperationNotice(`Inspector URL copied for ${channel.channel_name}.`);
      setOperationError('');
    } catch {
      setOperationError('Unable to copy inspector URL');
    }
  }

  async function retryNotification(notificationId: string) {
    setWorkspaceBusyId(`notification:${notificationId}:retry`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to retry notification');
        return;
      }
      setOperationNotice('Notification moved back into the outbound queue.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to retry notification');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function cancelNotification(notificationId: string) {
    setWorkspaceBusyId(`notification:${notificationId}:cancel`);
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to cancel notification');
        return;
      }
      setOperationNotice('Notification cancelled.');
      void loadWorkspace();
    } catch {
      setOperationError('Unable to cancel notification');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function deliverQueuedNotifications(mode: 'all' | 'immediate' | 'daily_digest' = 'all') {
    setWorkspaceBusyId('deliver-notifications');
    setOperationError('');
    setOperationNotice('');
    try {
      const res = await fetch('/api/tender-intelligence/automation/deliver-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperationError(data.error || 'Unable to deliver queued notifications');
        return;
      }
      setOperationNotice(
        data.sent > 0
          ? `Delivered ${data.sent} procurement notification${data.sent === 1 ? '' : 's'}.`
          : data.cancelled > 0
            ? `No notifications sent. ${data.cancelled} item${data.cancelled === 1 ? '' : 's'} cancelled from the queue.`
            : 'No queued procurement notifications were ready to send.',
      );
      void loadWorkspace();
    } catch {
      setOperationError('Unable to deliver queued notifications');
    } finally {
      setWorkspaceBusyId(null);
    }
  }

  async function openInboxTask(task: InboxTask, reviewMode = false) {
    setFocusedTaskId(task.id);
    setActiveReviewTaskId(task.id);
    if (workspace?.shortlist?.id !== task.shortlist_id) {
      setPendingNavigation({
        shortlistId: task.shortlist_id,
        sectionId: reviewMode ? 'procurement-workspace' : 'review-queue',
      });
      setWorkspaceMode('work');
      setActiveShortlist(task.shortlist_id);
      setOperationNotice(`Switched to ${task.shortlist_name}.`);
      return;
    }
    if (reviewMode) {
      await startReviewTask(task);
      return;
    }
    openWorkspaceMode('work', 'review-queue');
  }

  function openApprovalInboxItem(item: ApprovalInboxItem) {
    if (workspace?.shortlist?.id !== item.id) {
      setPendingNavigation({
        shortlistId: item.id,
        sectionId: 'decision-signoff',
      });
      setWorkspaceMode('signoff');
      setActiveShortlist(item.id);
      setOperationNotice(`Opened ${item.name} for sign-off.`);
      return;
    }
    openWorkspaceMode('signoff', 'decision-signoff');
  }

  function openNotificationContext(notification: ProcurementNotification) {
    if (!notification.shortlist_id) {
      openHistoryPanelsView();
      return;
    }
    if (workspace?.shortlist?.id !== notification.shortlist_id) {
      setPendingNavigation({
        shortlistId: notification.shortlist_id,
        sectionId: notification.task_id ? 'review-queue' : 'workflow-history',
      });
      setWorkspaceMode(notification.task_id ? 'work' : 'signoff');
      setActiveShortlist(notification.shortlist_id);
      setOperationNotice('Opened related shortlist context.');
      return;
    }
    if (notification.task_id) {
      openWorkspaceMode('work', 'review-queue');
      return;
    }
    openHistoryPanelsView();
  }

  if (!authResolved || (shellAuthenticated && workspaceLoading && !workspace)) {
    return (
      <div className="min-h-screen bg-bauhaus-canvas">
        <div className="mx-auto max-w-[1680px] px-6 py-16">
          <div className="border-4 border-bauhaus-black bg-white px-6 py-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue mb-3">
              Loading Workspace
            </p>
            <h1 className="text-3xl font-black text-bauhaus-black">Checking your Tender Intelligence session...</h1>
            <p className="mt-3 text-sm font-medium text-bauhaus-muted">
              We are validating your workspace access using the same server session as the rest of the app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!authed && !shellAuthenticated) {
    return (
      <div className="min-h-screen bg-bauhaus-canvas">
        <section className="bg-bauhaus-black text-white py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs text-bauhaus-yellow uppercase tracking-[0.4em] font-black mb-4">
              CivicGraph Procurement Intelligence
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
              TENDER INTELLIGENCE
            </h1>
            <p className="text-lg text-white/60 max-w-3xl mb-8">
              Supplier discovery, list enrichment, and intelligence packs for procurement teams
              that need a defensible market view before they go to market. Sign in for the full
              workflow, or try the public procurement analyser now.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/login"
                className="px-8 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-white hover:bg-bauhaus-yellow transition-colors"
              >
                Sign In For Full Tool
              </Link>
              <Link
                href="/procurement"
                className="px-8 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-blue hover:bg-white hover:text-bauhaus-black transition-colors"
              >
                Try Public Analyser
              </Link>
              <Link
                href="/reports/donor-contractors"
                className="px-8 py-3 bg-transparent text-white font-black text-xs uppercase tracking-widest border-4 border-white/30 hover:border-white transition-colors"
              >
                See Due Diligence Report
              </Link>
            </div>
          </div>
        </section>

        <div className="border-b-4 border-bauhaus-black bg-white">
          <div className="max-w-5xl mx-auto flex flex-wrap">
            {[
              { key: 'discover' as TabKey, label: 'Supplier Discovery' },
              { key: 'enrich' as TabKey, label: 'List Enrichment' },
              { key: 'pack' as TabKey, label: 'Intelligence Pack' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePublicTab(item.key)}
                className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-r-4 border-bauhaus-black transition-colors ${
                  publicTab === item.key
                    ? 'bg-bauhaus-black text-white'
                    : 'text-bauhaus-muted hover:bg-bauhaus-canvas hover:text-bauhaus-black'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-bauhaus-black bg-white">
            {[
              {
                title: 'Government Procurement',
                desc: 'Shortlist Indigenous, social enterprise, and community-controlled suppliers by state, LGA, and remoteness.',
              },
              {
                title: 'Due Diligence',
                desc: 'Pressure-test supplier lists against entity dossiers, contract history, and donor-contractor signals before engagement.',
              },
              {
                title: 'Market Intelligence',
                desc: 'Turn a raw supplier list into an intelligence pack with compliance context, coverage gaps, and next actions.',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className={`p-6 ${index > 0 ? 'border-t-4 md:border-t-0 md:border-l-4 border-bauhaus-black' : ''}`}
              >
                <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
                  Use Case
                </p>
                <h2 className="text-xl font-black text-bauhaus-black mb-2">{item.title}</h2>
                <p className="text-sm text-bauhaus-muted font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <section id="discover" className="border-4 border-bauhaus-black bg-white p-6 sm:p-8">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">Discover</p>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Find suppliers by capability and geography</h2>
            <p className="text-sm text-bauhaus-muted font-medium max-w-3xl leading-relaxed mb-4">
              Search for suppliers by state, LGA, remoteness, and organisation type before you
              start procurement. This is designed for analysts who need a defensible shortlist, not
              a directory dump.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
                <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">What you can filter</p>
                <ul className="space-y-2 text-sm font-medium text-bauhaus-black">
                  <li>State and LGA</li>
                  <li>Remoteness and regional coverage</li>
                  <li>Indigenous, social enterprise, charity, and company types</li>
                  <li>Community-controlled supplier signals</li>
                </ul>
              </div>
              <div className="border-2 border-bauhaus-black p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">Best for</p>
                <ul className="space-y-2 text-sm font-medium text-bauhaus-black">
                  <li>Building pre-market supplier lists</li>
                  <li>Meeting Indigenous procurement goals</li>
                  <li>Regional commissioning discovery</li>
                  <li>Checking who already has contract history</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="enrich" className="border-4 border-bauhaus-black bg-white p-6 sm:p-8">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">Enrich</p>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Upload a supplier list and get useful context back</h2>
            <p className="text-sm text-bauhaus-muted font-medium max-w-3xl leading-relaxed mb-4">
              Take a raw CSV or shortlist and enrich it with GrantScope entity context so your team
              can see which suppliers are Indigenous, social enterprise, community-controlled,
              regional, or already visible in government contract data.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {['ABN matching', 'Entity type and flags', 'Regional and disadvantage context'].map((item) => (
                <div key={item} className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
                  <p className="text-sm font-black text-bauhaus-black">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="pack" className="border-4 border-bauhaus-black bg-white p-6 sm:p-8">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">Pack</p>
            <h2 className="text-2xl font-black text-bauhaus-black mb-3">Generate an intelligence pack for a procurement decision</h2>
            <p className="text-sm text-bauhaus-muted font-medium max-w-3xl leading-relaxed mb-4">
              Convert discovery and enrichment into a working intelligence pack with compliance
              context, supplier coverage, and a clearer narrative for reviewers and procurement leads.
            </p>
            <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
              <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">Includes</p>
              <div className="grid md:grid-cols-2 gap-3 text-sm font-medium text-bauhaus-black">
                <p>Indigenous and social procurement coverage</p>
                <p>Known contract history and buyer signals</p>
                <p>Regional and remoteness context</p>
                <p>Shortfall and opportunity framing for decision-makers</p>
              </div>
            </div>
          </section>

          <div className="border-4 border-bauhaus-black bg-bauhaus-blue text-white p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60 mb-3">
              Public entry point
            </p>
            <h2 className="text-2xl font-black mb-3">Start with the public analyser. Sign in for the full workflow.</h2>
            <p className="text-sm text-white/80 font-medium max-w-3xl leading-relaxed mb-6">
              The public analyser is useful for testing supplier mix and coverage. Sign in when you
              need supplier discovery, list enrichment, intelligence packs, and saved procurement work.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/procurement"
                className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-white hover:bg-bauhaus-yellow transition-colors"
              >
                Open Public Analyser
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      {/* Hero */}
      <section className="bg-bauhaus-black text-white py-16 px-6 print:hidden">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-bauhaus-yellow uppercase tracking-[0.4em] font-black mb-4">
            CivicGraph Procurement Intelligence
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            TENDER INTELLIGENCE
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mb-6">
            Discover suppliers, check procurement compliance, and generate
            bid-ready intelligence packs. Powered by the national entity graph,
            government contract history, and place-based evidence.
          </p>
          <div className="flex gap-4 text-xs text-white/30 font-bold uppercase tracking-widest">
            <span>Layer 1: Money</span>
            <span>&middot;</span>
            <span>Layer 2: Market</span>
            <span>&middot;</span>
            <span>Layer 3: Proof</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b-4 border-bauhaus-black bg-white print:hidden">
        <div className="max-w-5xl mx-auto flex">
          {[
            { key: 'discover' as TabKey, label: 'Supplier Discovery' },
            { key: 'enrich' as TabKey, label: 'List Enrichment' },
            { key: 'pack' as TabKey, label: 'Intelligence Pack' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-r-4 border-bauhaus-black transition-colors ${
                tab === t.key
                  ? 'bg-bauhaus-black text-white'
                  : 'text-bauhaus-muted hover:bg-bauhaus-canvas'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1680px] px-6 py-10 flex flex-col gap-8">
        <section className="order-20 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue mb-2">
                Operating Layer
              </p>
              <h2 className="text-2xl font-black text-bauhaus-black">Procurement Workspace</h2>
              <p className="text-sm text-bauhaus-muted font-medium max-w-3xl mt-2">
                Save suppliers to a team shortlist, record triage decisions, and keep a visible run
                history for every discovery and intelligence workflow.
              </p>
            </div>
            {workspace?.orgProfile && (
              <div className="border-2 border-bauhaus-black bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Workspace Org</p>
                <p className="text-sm font-black text-bauhaus-black">{workspace.orgProfile.name}</p>
              </div>
            )}
          </div>

          {workspaceError && (
            <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 px-4 py-3 text-sm font-bold text-bauhaus-red">
              {workspaceError}
            </div>
          )}

          {workspaceLoading && !workspace && (
            <div className="border-4 border-bauhaus-black bg-white px-4 py-6 text-sm font-bold text-bauhaus-muted">
              Loading procurement workspace...
            </div>
          )}

          {authResolved && authed && !workspace && !workspaceLoading && (
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red mb-3">
                Session Recovery
              </p>
              <h3 className="text-xl font-black mb-2">Tender Intelligence is signed in, but the workspace session needs a refresh.</h3>
              <p className="text-sm text-bauhaus-muted font-medium max-w-3xl mb-4">
                The main CivicGraph shell still recognizes your account. Retry the workspace first. If this persists, reload the page or re-open Tender Intelligence from the main app nav.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void loadWorkspace()}
                  disabled={workspaceLoading}
                  className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-blue transition-colors disabled:opacity-40"
                >
                  {workspaceLoading ? 'Retrying...' : 'Retry Workspace'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                >
                  Reload Page
                </button>
                <Link
                  href="/home"
                  className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                >
                  Back To App Home
                </Link>
              </div>
            </div>
          )}

          {workspace?.needsProfile ? (
            <div className="border-4 border-bauhaus-black bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red mb-3">
                Setup Required
              </p>
              <h3 className="text-xl font-black mb-2">Create your organisation profile to save team procurement work.</h3>
              <p className="text-sm text-bauhaus-muted font-medium max-w-3xl mb-4">
                Discovery, enrichment, and pack generation will still run, but shortlist storage and
                shared workflow need a workspace organisation first.
              </p>
              <Link
                href="/profile"
                className="inline-flex px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-blue transition-colors"
              >
                Complete Organisation Profile
              </Link>
            </div>
          ) : workspace?.shortlist ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-4 border-bauhaus-black bg-white">
                {[
                  { label: 'Shortlist Items', value: workspace.shortlist.item_count },
                  { label: 'Priority', value: workspace.shortlist.decision_counts.priority || 0 },
                  { label: 'Reviewing', value: workspace.shortlist.decision_counts.reviewing || 0 },
                  { label: 'Workflow Runs', value: workspace.workflowRuns.length },
                ].map((stat, index) => (
                  <div
                    key={stat.label}
                    className={`p-4 ${index > 0 ? 'border-l-0 border-t-4 lg:border-t-0 lg:border-l-4' : ''} border-bauhaus-black`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</p>
                    <p className="text-3xl font-black text-bauhaus-black mt-2">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div id="current-action" className="order-10 border-4 border-bauhaus-black bg-white">
                <div className="bg-bauhaus-red px-4 py-4 text-white">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Current Action</p>
                      <h2 className="mt-2 text-2xl font-black text-white">{currentActionTitle}</h2>
                      <p className="mt-2 text-sm font-medium text-white/80">{currentActionBody}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
                      <button
                        onClick={() => {
                          if (workspace?.shortlist?.approval_lock_active && approvedPackExport) {
                            router.push(`/tender-intelligence/exports/${approvedPackExport.id}`);
                            return;
                          }
                          if (canApproveShortlist && workspace?.shortlist?.approval_status === 'submitted' && latestPackExport) {
                            setWorkspaceMode('signoff');
                            router.push(`/tender-intelligence/exports/${latestPackExport.id}`);
                            return;
                          }
                          if (workspace?.shortlist?.approval_status === 'submitted' && latestPackExport) {
                            setWorkspaceMode('signoff');
                            router.push(`/tender-intelligence/exports/${latestPackExport.id}`);
                            return;
                          }
                          if (hasDecisionPackBlockers) {
                            resolveDecisionPackBlocker(firstDecisionPackBlocker);
                            return;
                          }
                          if (nextTask) {
                            void startNextTask();
                            return;
                          }
                          if (latestPackIsStale && latestPackExport) {
                            setWorkspaceMode('signoff');
                            void runPack('decision');
                            return;
                          }
                          if (reviewedShortlistItems.length > 0) {
                            setWorkspaceMode('signoff');
                            void runPack('decision');
                            return;
                          }
                          if (shortlistHasItems) {
                            openWorkspaceMode('work', 'procurement-workspace');
                            return;
                          }
                          if (savedSearchPills.length > 0) {
                            applySavedBrief();
                            return;
                          }
                          setActiveTab('discover');
                          window.setTimeout(scrollToDiscover, 50);
                        }}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-red transition-colors"
                      >
                        {workspace?.shortlist?.approval_lock_active && approvedPackExport
                          ? 'Open Approved Memo'
                          : canApproveShortlist && workspace?.shortlist?.approval_status === 'submitted' && latestPackExport
                            ? 'Review For Sign-Off'
                            : workspace?.shortlist?.approval_status === 'submitted' && latestPackExport
                            ? 'Open Submitted Pack'
                            : hasDecisionPackBlockers
                              ? (firstDecisionPackBlocker?.action_label || 'Resolve Pack Blockers')
                              : nextTask
                                ? 'Start Next Review'
                                : latestPackIsStale && latestPackExport
                                  ? 'Refresh Decision Pack'
                                  : reviewedShortlistItems.length > 0
                                    ? 'Generate Decision Pack'
                                    : shortlistHasItems
                                      ? 'Open Shortlist'
                                    : savedSearchPills.length > 0
                                        ? 'Apply Saved Brief'
                                        : 'Start Discovery'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
                  <div className="border-b-4 border-bauhaus-black p-4 xl:border-b-0 xl:border-r-4">
                    <div className="mb-4 grid gap-2 md:grid-cols-3">
                      {WORKSPACE_MODES.map((mode) => (
                        <button
                          key={mode.key}
                          onClick={() => openWorkspaceMode(mode.key)}
                          className={`border-2 px-3 py-3 text-left transition-colors ${
                            workspaceMode === mode.key
                              ? 'border-bauhaus-black bg-bauhaus-black text-white'
                              : 'border-bauhaus-black/15 bg-white text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                          }`}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest">{mode.label}</p>
                          <p className="mt-2 text-xs font-medium">{mode.description}</p>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {WORKFLOW_STAGES.map((stage) => {
                        const stageStatus = workflowStageStatus[stage.key];
                        return (
                          <div
                            key={stage.key}
                            className={`border-2 px-3 py-3 ${
                              stageStatus === 'done'
                                ? 'border-money bg-money-light text-money'
                                : stageStatus === 'current'
                                  ? 'border-bauhaus-black bg-bauhaus-yellow/20 text-bauhaus-black'
                                  : 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-muted'
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest">{stage.label}</p>
                            <p className="mt-2 text-sm font-black">{stageStatus === 'done' ? 'Done' : stageStatus === 'current' ? 'Current Stage' : 'Up Next'}</p>
                            <p className="mt-2 text-xs font-medium">{stage.description}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="border-2 border-bauhaus-black bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">My Role Right Now</p>
                        <p className="mt-2 text-lg font-black text-bauhaus-black">{currentRoleHeadline}</p>
                        <p className="mt-2 text-sm font-medium text-bauhaus-muted">{currentRoleSupport}</p>
                      </div>
                      <div className="border-2 border-bauhaus-black bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Done When</p>
                        <p className="mt-2 text-lg font-black text-bauhaus-black">{currentActionDoneWhen}</p>
                        <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                          Keep your attention on the active shortlist until this outcome is true. Everything else is secondary.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-bauhaus-canvas p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decision Readiness</p>
                        <p className="mt-2 text-3xl font-black text-bauhaus-black">{readinessCompletedCount}/{readinessChecklist.length || 1}</p>
                      </div>
                      <span className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 ${
                        hasDecisionPackBlockers
                          ? 'border-bauhaus-red bg-error-light text-bauhaus-red'
                          : 'border-money bg-money-light text-money'
                      }`}>
                        {hasDecisionPackBlockers ? `${decisionPackBlockers.length} blocker${decisionPackBlockers.length === 1 ? '' : 's'}` : 'Ready to export'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {readinessChecklist.map((item) => (
                        <div
                          key={item.label}
                          className={`border-2 px-3 py-3 ${
                            item.done
                              ? 'border-money bg-white text-bauhaus-black'
                              : 'border-bauhaus-black/15 bg-white text-bauhaus-black'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black">{item.label}</p>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                              item.done ? 'text-money' : 'text-bauhaus-red'
                            }`}>
                              {item.done ? 'Done' : 'Needs Work'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-bauhaus-muted">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    {activeReviewTask && (
                      <div className="mt-4 border-2 border-bauhaus-black bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Active Review</p>
                        <p className="mt-2 text-sm font-black text-bauhaus-black">{activeReviewTask.title}</p>
                        <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                          {activeReviewItem
                            ? `Working on ${activeReviewItem.supplier_name}. Update the shortlist row, then mark the task done.`
                          : 'Link this task to a supplier in the shortlist so the review flow has a clear target.'}
                        </p>
                      </div>
                    )}
                    {workspaceMode === 'work' && (
                      <div className="mt-4 border-2 border-bauhaus-black bg-white px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Inbox Snapshot</p>
                            <p className="mt-2 text-lg font-black text-bauhaus-black">
                              {hasInboxItems ? `${myTasks.length + myApprovals.length + myNotifications.length} items need attention` : 'No inbox pressure right now'}
                            </p>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                            {hasInboxItems ? 'Active' : 'Clear'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                          {[
                            {
                              label: 'Tasks',
                              value: myTasks.length,
                              detail: myTasks[0]?.title || 'No assigned reviews',
                              action: myTasks[0]
                                ? () => void openInboxTask(myTasks[0], true)
                                : null,
                              actionLabel: 'Resume',
                            },
                            {
                              label: 'Approvals',
                              value: myApprovals.length,
                              detail: myApprovals[0]?.name || 'No sign-off waiting',
                              action: myApprovals[0]
                                ? () => openApprovalInboxItem(myApprovals[0])
                                : null,
                              actionLabel: 'Open',
                            },
                            {
                              label: 'Notifications',
                              value: myNotifications.length,
                              detail: myNotifications[0]?.subject || 'No recent outbound',
                              action: myNotifications[0]
                                ? () => openNotificationContext(myNotifications[0])
                                : null,
                              actionLabel: 'Context',
                            },
                          ].map((item) => (
                            <div key={item.label} className="border border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{item.label}</p>
                                  <p className="mt-1 text-2xl font-black text-bauhaus-black">{item.value}</p>
                                </div>
                                {item.action && (
                                  <button
                                    onClick={item.action}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                                  >
                                    {item.actionLabel}
                                  </button>
                                )}
                              </div>
                              <p className="mt-2 text-xs font-medium text-bauhaus-muted">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                id="guided-test-run"
                className={`${workspaceMode === 'work' ? 'order-15 border-4 border-bauhaus-black bg-white' : 'hidden'}`}
              >
                <div className="bg-bauhaus-blue px-4 py-4 text-white">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Guided Test Run</p>
                      <h3 className="mt-2 text-xl font-black text-white">Work the shortlist with real context, not empty fields</h3>
                      <p className="mt-2 text-sm font-medium text-white/80">{testingRunSummary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={loadTestingDrafts}
                        disabled={!canEditWorkspace}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-blue transition-colors disabled:opacity-40"
                      >
                        Load Realistic Test Drafts
                      </button>
                      <button
                        onClick={() => void prepareScenarioForTesting()}
                        disabled={!canEditWorkspace || workspaceBusyId === 'prepare-test-scenario'}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-white/60 text-white hover:border-white hover:bg-white hover:text-bauhaus-blue transition-colors disabled:opacity-40"
                      >
                        {workspaceBusyId === 'prepare-test-scenario' ? 'Preparing Scenario...' : 'Prepare Test Scenario'}
                      </button>
                      <button
                        onClick={startSuggestedSupplierReview}
                        disabled={!nextSupplierForReview}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-blue transition-colors disabled:opacity-40"
                      >
                        {nextSupplierForReview ? `Start With ${nextSupplierForReview.supplier_name}` : 'No Supplier To Review'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div className="border-b-4 border-bauhaus-black p-4 xl:border-b-0 xl:border-r-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          step: '1. Load realistic drafts',
                          detail: 'Seed the decision brief, supplier notes, supplier comments, and the manual task form with shortlist-specific writing.',
                        },
                        {
                          step: '2. Prepare a persisted test scenario',
                          detail: 'Save the suggested brief, replace placeholder supplier notes, add supplier comments, and seed the next review task so the flow is ready to test end to end.',
                        },
                        {
                          step: nextSupplierForReview ? `3. Review ${nextSupplierForReview.supplier_name}` : '3. Review the next supplier',
                          detail: nextSupplierForReview
                            ? `Open ${nextSupplierForReview.supplier_name}, save the suggested note, add the suggested review comment, and update checklist items.`
                            : 'Use the shortlist to work the next supplier row and replace placeholders with real analyst context.',
                        },
                        {
                          step: '4. Clear blocker groups',
                          detail: `${governanceBlockers.length} governance blocker${governanceBlockers.length === 1 ? '' : 's'} and ${supplierBlockers.length} supplier blocker${supplierBlockers.length === 1 ? '' : 's'} remain before export.`,
                        },
                        {
                          step: '5. Move to sign-off',
                          detail: 'Once the blocker count reaches zero, switch to Sign-Off, save the brief, generate the pack, and route approval.',
                        },
                      ].map((entry) => (
                        <div key={entry.step} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{entry.step}</p>
                          <p className="mt-2 text-sm font-medium text-bauhaus-black">{entry.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-bauhaus-canvas p-4">
                    <div className="space-y-3">
                      <div className="border-2 border-bauhaus-black bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Testing Readiness</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-3xl font-black text-bauhaus-black">{shortlistItemsNeedingRealCopy.length}</p>
                            <p className="mt-1 text-xs font-medium text-bauhaus-muted">supplier row{shortlistItemsNeedingRealCopy.length === 1 ? '' : 's'} still need real notes or comments</p>
                          </div>
                          <div>
                            <p className="text-3xl font-black text-bauhaus-black">{decisionPackBlockers.length}</p>
                            <p className="mt-1 text-xs font-medium text-bauhaus-muted">pack blocker{decisionPackBlockers.length === 1 ? '' : 's'} still in the flow</p>
                          </div>
                        </div>
                      </div>
                      <div className="border-2 border-bauhaus-black bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Next Supplier To Touch</p>
                        {nextSupplierForReview ? (
                          <>
                            <p className="mt-2 text-sm font-black text-bauhaus-black">{nextSupplierForReview.supplier_name}</p>
                            <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                              {nextSupplierBlockers.length > 0
                                ? nextSupplierBlockers[0].message
                                : 'This row is the best candidate for a real test review right now.'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={startSuggestedSupplierReview}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                              >
                                Open Supplier Review
                              </button>
                              <button
                                onClick={() => focusShortlistItem({
                                  itemId: nextSupplierForReview.id,
                                  supplierName: nextSupplierForReview.supplier_name,
                                  fieldId: `supplier-comment-${nextSupplierForReview.id}`,
                                })}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                              >
                                Jump To Row
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            No shortlist item needs immediate supplier review. Move to Sign-Off once the remaining blockers are cleared.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="human-test-checklist"
                className={`${workspaceMode !== 'admin' ? 'order-[17] border-4 border-bauhaus-black bg-white' : 'hidden'}`}
              >
                <div className="bg-bauhaus-black px-4 py-4 text-white">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Human Test Checklist</p>
                      <h3 className="mt-2 text-xl font-black text-white">Run one shortlist from seeded context to memo output</h3>
                      <p className="mt-2 text-sm font-medium text-white/80">
                        Use this checklist as the end-to-end test spine. The goal is not to browse every panel. It is to prove one complete procurement path.
                      </p>
                    </div>
                    <div className="border-2 border-white/30 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Run Progress</p>
                      <p className="mt-2 text-3xl font-black text-white">{humanTestCompletedCount}/{humanTestChecklist.length || 1}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div className="border-b-4 border-bauhaus-black p-4 xl:border-b-0 xl:border-r-4">
                    <div className="space-y-3">
                      {humanTestChecklist.map((step, index) => (
                        <div key={step.key} className={`border-2 px-4 py-4 ${
                          step.done
                            ? 'border-money bg-money-light'
                            : 'border-bauhaus-black bg-white'
                        }`}>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-3xl">
                              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                Step {index + 1}
                              </p>
                              <p className="mt-2 text-lg font-black text-bauhaus-black">{step.label}</p>
                              <p className="mt-2 text-sm font-medium text-bauhaus-muted">{step.detail}</p>
                            </div>
                            <div className="flex flex-col items-start gap-2">
                              <span className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 ${
                                step.done
                                  ? 'border-money bg-white text-money'
                                  : 'border-bauhaus-red bg-error-light text-bauhaus-red'
                              }`}>
                                {step.done ? 'Done' : 'Needs Work'}
                              </span>
                              <button
                                onClick={() => {
                                  if (step.key === 'scenario') {
                                    void prepareScenarioForTesting();
                                    return;
                                  }
                                  if (step.key === 'review') {
                                    if (nextSupplierForReview) {
                                      startSuggestedSupplierReview();
                                    } else {
                                      openWorkspaceMode('work', 'procurement-workspace');
                                    }
                                    return;
                                  }
                                  if (step.key === 'governance') {
                                    if (governanceBlockers[0]) {
                                      resolveDecisionPackBlocker(governanceBlockers[0]);
                                    } else {
                                      openWorkspaceMode('signoff', 'decision-signoff');
                                    }
                                    return;
                                  }
                                  if (step.key === 'pack') {
                                    setWorkspaceMode('signoff');
                                    void runPack('decision');
                                    return;
                                  }
                                  if (step.key === 'signoff') {
                                    openWorkspaceMode('signoff', 'decision-signoff');
                                    return;
                                  }
                                  if (step.key === 'memo' && latestPackExport) {
                                    router.push(`/tender-intelligence/exports/${latestPackExport.id}`);
                                  }
                                }}
                                disabled={
                                  (step.key === 'scenario' && (!canEditWorkspace || workspaceBusyId === 'prepare-test-scenario'))
                                  || (step.key === 'pack' && (!workspace?.shortlist || hasDecisionPackBlockers || reviewedShortlistItems.length === 0))
                                  || (step.key === 'memo' && !latestPackExport)
                                }
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                              >
                                {step.key === 'scenario' && workspaceBusyId === 'prepare-test-scenario'
                                  ? 'Preparing...'
                                  : step.actionLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-bauhaus-canvas p-4">
                    <div className="border-2 border-bauhaus-black bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Expected Outcomes</p>
                      <div className="mt-3 space-y-3 text-sm font-medium text-bauhaus-black">
                        <p>Work mode should end with at least one supplier row carrying a real note, a review comment, checklist progress, and a clear decision tag.</p>
                        <p>Sign-Off mode should end with no blocker ambiguity: the brief is filled, the pack is current, and the approval path is obvious.</p>
                        <p>The saved memo should read like a decision record, not a screen dump, and the PDF should be something you can critique as a real output.</p>
                      </div>
                    </div>
                    <div className="mt-3 border-2 border-bauhaus-black bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">What To Capture In Human Testing</p>
                      <div className="mt-3 space-y-3 text-sm font-medium text-bauhaus-muted">
                        <p>Where you still pause or second-guess the next action.</p>
                        <p>Any field label, button, or status that feels internally correct but externally unclear.</p>
                        <p>Whether the memo and PDF actually support a procurement decision without needing the app open beside them.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="my-inbox"
                className="hidden"
              >
                <div className="bg-bauhaus-blue px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">My Inbox</p>
                  <h3 className="text-lg font-black text-white">What is on me right now</h3>
                  <p className="mt-1 text-sm font-medium text-white/70">
                    Start here if you want the system to tell you what to review, what to approve, and what has already been sent to you.
                  </p>
                </div>
                <div className="grid gap-0 lg:grid-cols-3">
                  <div className="border-b-4 border-bauhaus-black lg:border-b-0 lg:border-r-4 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">My Tasks</p>
                        <p className="text-3xl font-black text-bauhaus-black mt-2">{myTasks.length}</p>
                      </div>
                      {myTasks[0] && (
                        <button
                          onClick={() => void openInboxTask(myTasks[0], true)}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          Start My Next Review
                        </button>
                      )}
                    </div>
                    {myTasks.length === 0 ? (
                      <p className="text-sm font-medium text-bauhaus-muted">No open tasks are assigned to you.</p>
                    ) : (
                      myTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskPriorityBadgeClass(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskStatusBadgeClass(task.status)}`}>
                              {taskStatusLabel(task.status)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-black text-bauhaus-black">{task.title}</p>
                          <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                            {task.shortlist_name} • {task.due_at ? `due ${fmtDateTime(task.due_at)}` : 'no due date'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => void openInboxTask(task, true)}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                            >
                              Resume Review
                            </button>
                            <button
                              onClick={() => void openInboxTask(task)}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                            >
                              Open Queue
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-b-4 border-bauhaus-black lg:border-b-0 lg:border-r-4 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Waiting For My Sign-Off</p>
                    <p className="text-3xl font-black text-bauhaus-black">{myApprovals.length}</p>
                    {myApprovals.length === 0 ? (
                      <p className="text-sm font-medium text-bauhaus-muted">No shortlists are waiting for your sign-off.</p>
                    ) : (
                      myApprovals.slice(0, 3).map((approval) => (
                        <div key={approval.id} className="border-2 border-bauhaus-black bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${approvalStatusClass(approval.approval_status)}`}>
                              {approvalStatusLabel(approval.approval_status)}
                            </span>
                            {approval.last_pack_export_id && (
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted">
                                Pack ready
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-sm font-black text-bauhaus-black">{approval.name}</p>
                          <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                            {approval.owner_name || 'No owner'} • updated {fmtDateTime(approval.updated_at)}
                            {approval.decision_due_at ? ` • due ${fmtDateTime(approval.decision_due_at)}` : ''}
                          </p>
                          <button
                            onClick={() => openApprovalInboxItem(approval)}
                            className="mt-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open For Sign-Off
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Recent Notifications To Me</p>
                    <p className="text-3xl font-black text-bauhaus-black">{myNotifications.length}</p>
                    {myNotifications.length === 0 ? (
                      <p className="text-sm font-medium text-bauhaus-muted">No outbound notifications have been queued or sent to you yet.</p>
                    ) : (
                      myNotifications.slice(0, 3).map((notification) => (
                        <div key={notification.id} className="border-2 border-bauhaus-black bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${notificationTypeClass(notification.notification_type)}`}>
                              {notificationTypeLabel(notification.notification_type)}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${notificationStatusClass(notification.status)}`}>
                              {notification.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-black text-bauhaus-black">{notification.subject}</p>
                          <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                            queued {fmtDateTime(notification.queued_at)}
                            {notification.sent_at ? ` • sent ${fmtDateTime(notification.sent_at)}` : ''}
                          </p>
                          <button
                            onClick={() => openNotificationContext(notification)}
                            className="mt-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open Context
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div
                id="decision-signoff"
                className={`${workspaceMode === 'signoff' ? 'order-20' : 'hidden'} border-4 border-bauhaus-black bg-white`}
              >
                <div className="bg-bauhaus-yellow px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/60">Decision Desk</p>
                    <h3 className="text-lg font-black text-bauhaus-black">Procurement recommendation and review queue</h3>
                    <p className="text-sm font-medium text-bauhaus-black/70 mt-1">
                      Capture the current recommendation, assign the next action, and keep the shortlist tied to actual review work.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/60">
                        Editing shortlist
                      </span>
                      <span className="inline-flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black">
                        {workspace.shortlist.name}
                      </span>
                      <span className="text-xs font-medium text-bauhaus-black/60">
                        Change the active shortlist here or in the shortlist switcher above.
                      </span>
                      {workspace.shortlist.approval_lock_active && (
                        <span className="inline-flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-red text-white">
                          Approval Locked
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    <select
                      value={workspace.shortlist.id}
                      onChange={(event) => setActiveShortlist(event.target.value)}
                      className="min-h-11 min-w-[240px] border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black"
                    >
                      {workspace.shortlists.map((shortlist) => (
                        <option key={shortlist.id} value={shortlist.id}>
                          {shortlist.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                    <button
                      onClick={runDueWatches}
                      disabled={workspaceBusyId === 'run-due-watches'}
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                    >
                      {workspaceBusyId === 'run-due-watches' ? 'Running Automation...' : 'Run Watches & Reminders'}
                    </button>
                    <button
                      onClick={saveDecisionSummary}
                      disabled={!canEditWorkspace || !summaryIsDirty || workspaceBusyId === `summary:${workspace.shortlist.id}` || workspace.shortlist.approval_lock_active}
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-40"
                    >
                      {workspaceBusyId === `summary:${workspace.shortlist.id}` ? 'Saving Brief...' : summaryIsDirty ? 'Save Decision Brief' : 'Decision Brief Saved'}
                    </button>
                    </div>
                  </div>
                </div>
                {suggestedDecisionBrief && (
                  <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Brief</p>
                        <p className="mt-2 text-sm font-black text-bauhaus-black">
                          Use real shortlist context instead of blank fields.
                        </p>
                        <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                          {suggestedDecisionBrief.recommendationSummary}
                        </p>
                        <p className="mt-2 text-xs font-bold text-bauhaus-muted">
                          Suggested owner: {suggestedOwnerUserId ? teamMemberLabel(ownerOptions.find((member) => member.user_id === suggestedOwnerUserId)) : 'Unassigned'} •
                          Suggested approver: {suggestedApproverUserId ? teamMemberLabel(approverOptions.find((member) => member.user_id === suggestedApproverUserId)) : 'Unassigned'} •
                          Suggested due date: {suggestedDecisionBrief.decisionDueAt || 'Not set'}
                        </p>
                      </div>
                      <button
                        onClick={applySuggestedDecisionBrief}
                        disabled={!canModifyShortlist}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                      >
                        Use Suggested Brief
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                  <div className="p-4 border-b-4 xl:border-b-0 xl:border-r-4 border-bauhaus-black">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Recommendation Summary
                        </label>
                        <textarea
                          id="brief-recommendation-summary"
                          value={summaryDraft.recommendationSummary}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, recommendationSummary: event.target.value }));
                            setSummaryStatus(event.target.value === (workspace.shortlist?.recommendation_summary || '') ? 'Decision brief saved' : 'Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          rows={3}
                          placeholder="Summarise the current procurement call: who stays in play, what the shortlist is telling you, and what should happen next."
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Why Now
                        </label>
                        <textarea
                          value={summaryDraft.whyNow}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, whyNow: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          rows={4}
                          placeholder="Why this shortlist matters now: procurement window, policy goal, market gap, or regional pressure."
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Risks To Review
                        </label>
                        <textarea
                          value={summaryDraft.riskSummary}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, riskSummary: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          rows={4}
                          placeholder="Record the probity, coverage, pricing, evidence, or capability risks still open."
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Next Action
                        </label>
                        <textarea
                          value={summaryDraft.nextAction}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, nextAction: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          rows={3}
                          placeholder="What should happen next: meet supplier, run diligence, refresh pack, hold, or exclude."
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Owner
                        </label>
                        <select
                          id="brief-owner-user-id"
                          value={summaryDraft.ownerUserId}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, ownerUserId: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        >
                          <option value="">Unassigned</option>
                          {ownerOptions.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {teamMemberLabel(member)}{member.is_owner ? ' (Owner)' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            setSummaryDraft((prev) => ({ ...prev, ownerUserId: workspace.currentUserId || '' }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist || !workspace.currentUserId || summaryDraft.ownerUserId === workspace.currentUserId}
                          className="mt-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          Assign To Me
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Approver
                        </label>
                        <select
                          id="brief-approver-user-id"
                          value={summaryDraft.approverUserId}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, approverUserId: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        >
                          <option value="">Unassigned</option>
                          {approverOptions.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {teamMemberLabel(member)}{member.is_owner ? ' (Owner)' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            setSummaryDraft((prev) => ({ ...prev, approverUserId: workspace.currentUserId || '' }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist || !workspace.currentUserId || summaryDraft.approverUserId === workspace.currentUserId}
                          className="mt-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          Assign To Me
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                          Decision Due
                        </label>
                        <input
                          id="brief-decision-due-at"
                          type="date"
                          value={summaryDraft.decisionDueAt}
                          onChange={(event) => {
                            setSummaryDraft((prev) => ({ ...prev, decisionDueAt: event.target.value }));
                            setSummaryStatus('Unsaved decision changes');
                          }}
                          disabled={!canModifyShortlist}
                          className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-bauhaus-muted">
                      <span>{summaryStatus || (summaryIsDirty ? 'Unsaved decision changes' : 'Decision brief saved')}</span>
                      {workspace.shortlist.decision_due_at && (
                        <span>Current due {fmtDateTime(workspace.shortlist.decision_due_at)}</span>
                      )}
                      {workspace.shortlist.owner_name && (
                        <span>Current owner {workspace.shortlist.owner_name}</span>
                      )}
                      {approverMember && (
                        <span>Approver {teamMemberLabel(approverMember)}</span>
                      )}
                      <span>Approval {approvalStatusLabel(workspace.shortlist.approval_status)}</span>
                      {workspace.shortlist.approval_lock_active && (
                        <span>Locked {workspace.shortlist.approval_locked_at ? fmtDateTime(workspace.shortlist.approval_locked_at) : 'now'}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-bauhaus-canvas">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Open Tasks', value: openTasks.length },
                        { label: 'Urgent Tasks', value: urgentTasks.length },
                        { label: 'Due In 48H', value: dueSoonTasks.length },
                        { label: 'Escalations', value: openEscalations.length },
                      ].map((metric) => (
                        <div key={metric.label} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                          <p className="text-2xl font-black text-bauhaus-black mt-2">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-2 border-bauhaus-black bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Queue Signal</p>
                      <p className="text-sm font-black text-bauhaus-black mt-2">
                        {openEscalations.length > 0
                          ? `${openEscalations.length} overdue task escalation${openEscalations.length === 1 ? '' : 's'} need workspace-level action.`
                          : urgentTasks.length > 0
                          ? `${urgentTasks.length} urgent review task${urgentTasks.length === 1 ? '' : 's'} need attention.`
                          : openTasks.length > 0
                            ? `${openTasks.length} active review task${openTasks.length === 1 ? '' : 's'} are holding the shortlist open.`
                            : 'No open review tasks right now. This shortlist is ready for the next decision step.'}
                      </p>
                      <p className="text-xs font-medium text-bauhaus-muted mt-2">
                        {workspace.watch?.enabled
                          ? `Market watch is active and due ${workspace.watch.next_run_at ? fmtDateTime(workspace.watch.next_run_at) : 'soon'}.`
                          : 'Market watch is off. Rerun manually or turn on automation to keep the shortlist fresh.'}
                      </p>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="border-2 border-bauhaus-black bg-white px-3 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Guided Sign-Off Run</p>
                            <p className="mt-2 text-sm font-black text-bauhaus-black">
                              Finish the governance side with concrete writing, not empty approval fields.
                            </p>
                            <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                              {hasDecisionPackBlockers
                                ? `${governanceBlockers.length} governance blocker${governanceBlockers.length === 1 ? '' : 's'} and ${supplierBlockers.length} supplier blocker${supplierBlockers.length === 1 ? '' : 's'} still sit between this shortlist and export.`
                                : latestPackExport
                                  ? `${packVersionLabel(latestPackExport)} is ready for submission or approver review.`
                                  : 'Generate the first decision pack once the shortlist is ready.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={applySuggestedApprovalNote}
                              disabled={!canParticipateInGovernance}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                            >
                              Use Suggested Sign-Off Note
                            </button>
                            <button
                              onClick={applySuggestedSignoffComment}
                              disabled={!canParticipateInGovernance}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                            >
                              Use Suggested Discussion Comment
                            </button>
                            {governanceBlockers[0] && (
                              <button
                                onClick={() => resolveDecisionPackBlocker(governanceBlockers[0])}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors"
                              >
                                Resolve First Governance Blocker
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decision Sign-Off</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${approvalStatusClass(workspace.shortlist.approval_status)}`}>
                            {approvalStatusLabel(workspace.shortlist.approval_status)}
                          </span>
                          {latestPackExport && (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                              {packVersionLabel(latestPackExport)}
                            </span>
                          )}
                          {workspace.shortlist.requested_at && (
                            <span className="text-xs font-bold text-bauhaus-muted">Requested {fmtDateTime(workspace.shortlist.requested_at)}</span>
                          )}
                          {workspace.shortlist.approved_at && (
                            <span className="text-xs font-bold text-bauhaus-muted">Approved {fmtDateTime(workspace.shortlist.approved_at)}</span>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Approver</p>
                            <p className="mt-2 text-sm font-black text-bauhaus-black">
                              {approverMember ? teamMemberLabel(approverMember) : 'No approver assigned yet'}
                            </p>
                            <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                              {requiresSeparateApprover
                                ? 'This shortlist needs a separate approver before it can be submitted.'
                                : 'Single-reviewer mode is allowed here, but assigning an approver still creates a clearer sign-off trail.'}
                            </p>
                          </div>
                          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Pack Lock</p>
                            <p className="mt-2 text-sm font-black text-bauhaus-black">
                              {workspace.shortlist.approval_lock_active
                                ? 'Approved shortlist is locked'
                                : !latestPackExport
                                ? 'No pack generated yet'
                                : latestPackIsStale
                                  ? 'Current pack is stale'
                                  : hasLockedApprovedPack && workspace.shortlist.approved_pack_export_id === latestPackExport.id
                                    ? 'Latest pack is the locked approval record'
                                    : 'Latest pack is ready for review'}
                            </p>
                            <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                              {workspace.shortlist.approval_lock_active
                                ? 'Reopen the shortlist before editing suppliers, filters, or the decision brief.'
                                : latestPackExport
                                ? `Latest ${packVersionLabel(latestPackExport)} saved ${fmtDateTime(latestPackExport.created_at)}.`
                                : 'Generate a decision pack to freeze the current shortlist and evidence snapshot.'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                          {workspace.shortlist.approval_lock_active
                            ? 'This shortlist is locked to the approved decision pack. Reopen it before making changes.'
                            : canApproveShortlist
                            ? 'You can record the approval outcome for this shortlist.'
                            : 'Only the assigned approver or workspace owner can approve or request changes.'}
                        </p>
                        <div className="mt-3 border border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Sign-Off Note</p>
                            <button
                              onClick={applySuggestedApprovalNote}
                              disabled={!canParticipateInGovernance}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                            >
                              {!approvalNotesDraft.trim() || looksPlaceholderCopy(approvalNotesDraft) ? 'Use Suggested Note' : 'Replace With Suggestion'}
                            </button>
                          </div>
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">{suggestedApprovalNote}</p>
                        </div>
                        <textarea
                          value={approvalNotesDraft}
                          onChange={(event) => setApprovalNotesDraft(event.target.value)}
                          disabled={!canParticipateInGovernance}
                          rows={3}
                          placeholder="Sign-off notes, conditions, or requested changes."
                          className="mt-3 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              if (!workspace?.shortlist) return;
                              setWorkspaceBusyId(`approval:${workspace.shortlist.id}`);
                              setOperationError('');
                              setOperationNotice('');
                              try {
                                const res = await fetch('/api/tender-intelligence/shortlists', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    shortlistId: workspace.shortlist.id,
                                    approverUserId: summaryDraft.approverUserId || null,
                                    ownerUserId: summaryDraft.ownerUserId || null,
                                    approvalStatus: 'submitted',
                                    approvalNotes: approvalNotesDraft,
                                    lastPackExportId: latestPackExport?.id || workspace.shortlist.last_pack_export_id || null,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setOperationError(data.error || 'Unable to submit shortlist for sign-off');
                                } else {
                                  syncActiveShortlist(data.shortlist as ShortlistSummary);
                                  setOperationNotice(`Submitted ${data.shortlist.name} for sign-off.`);
                                  void loadWorkspace();
                                }
                              } catch {
                                setOperationError('Unable to submit shortlist for sign-off');
                              } finally {
                                setWorkspaceBusyId(null);
                              }
                            }}
                            disabled={
                              !canSubmitShortlist
                              || workspaceBusyId === `approval:${workspace.shortlist.id}`
                              || !latestPackExport
                              || latestPackIsStale
                              || workspace.shortlist.approval_lock_active
                              || (requiresSeparateApprover && (!summaryDraft.approverUserId || summaryDraft.approverUserId === summaryDraft.ownerUserId))
                            }
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-40"
                          >
                            Submit For Sign-Off
                          </button>
                          <button
                            onClick={reopenShortlistForChanges}
                            disabled={!canReopenShortlist || workspaceBusyId === `reopen:${workspace.shortlist.id}` || !workspace.shortlist.approval_lock_active}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                          >
                            {workspaceBusyId === `reopen:${workspace.shortlist.id}` ? 'Reopening...' : 'Reopen For Changes'}
                          </button>
                          <button
                            onClick={async () => {
                              if (!workspace?.shortlist) return;
                              setWorkspaceBusyId(`approval:${workspace.shortlist.id}`);
                              setOperationError('');
                              setOperationNotice('');
                              try {
                                const res = await fetch('/api/tender-intelligence/shortlists', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    shortlistId: workspace.shortlist.id,
                                    approverUserId: summaryDraft.approverUserId || null,
                                    approvalStatus: 'approved',
                                    approvalNotes: approvalNotesDraft,
                                    lastPackExportId: latestPackExport?.id || workspace.shortlist.last_pack_export_id || null,
                                    approvedPackExportId: latestPackExport?.id || workspace.shortlist.last_pack_export_id || null,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setOperationError(data.error || 'Unable to approve shortlist');
                                } else {
                                  syncActiveShortlist(data.shortlist as ShortlistSummary);
                                  setOperationNotice(`Approved ${data.shortlist.name}.`);
                                  void loadWorkspace();
                                }
                              } catch {
                                setOperationError('Unable to approve shortlist');
                              } finally {
                                setWorkspaceBusyId(null);
                              }
                            }}
                            disabled={!canApproveShortlist || workspaceBusyId === `approval:${workspace.shortlist.id}` || !latestPackExport || workspace.shortlist.approval_status !== 'submitted' || workspace.shortlist.approval_lock_active}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money hover:bg-money hover:text-white transition-colors disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              if (!workspace?.shortlist) return;
                              setWorkspaceBusyId(`approval:${workspace.shortlist.id}`);
                              setOperationError('');
                              setOperationNotice('');
                              try {
                                const res = await fetch('/api/tender-intelligence/shortlists', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    shortlistId: workspace.shortlist.id,
                                    approverUserId: summaryDraft.approverUserId || null,
                                    approvalStatus: 'changes_requested',
                                    approvalNotes: approvalNotesDraft,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setOperationError(data.error || 'Unable to request changes');
                                } else {
                                  syncActiveShortlist(data.shortlist as ShortlistSummary);
                                  setOperationNotice(`Requested changes on ${data.shortlist.name}.`);
                                  void loadWorkspace();
                                }
                              } catch {
                                setOperationError('Unable to request changes');
                              } finally {
                                setWorkspaceBusyId(null);
                              }
                            }}
                            disabled={!canApproveShortlist || workspaceBusyId === `approval:${workspace.shortlist.id}` || workspace.shortlist.approval_status !== 'submitted' || workspace.shortlist.approval_lock_active}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
                          >
                            Request Changes
                          </button>
                        </div>
                        {workspace.shortlist.approval_lock_active && workspace.shortlist.approved_pack_export_id && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            Locked to the approved pack until a lead reopens it. The last approved pack remains in history even after you reopen.
                          </p>
                        )}
                        {!latestPackExport && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            Generate a decision pack before submitting for sign-off so the approval is tied to a frozen evidence snapshot.
                          </p>
                        )}
                        {requiresSeparateApprover && (!summaryDraft.approverUserId || summaryDraft.approverUserId === summaryDraft.ownerUserId) && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-red">
                            This shortlist needs a separate approver before it can be submitted.
                          </p>
                        )}
                        {latestPackIsStale && latestPackExport && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-red">
                            The shortlist changed after {packVersionLabel(latestPackExport)} was generated. Generate a fresh pack before treating it as the current decision artifact.
                          </p>
                        )}
                        <div className="mt-4 border-t border-bauhaus-black/10 pt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Sign-Off Discussion</p>
                          <div className="mt-3 border border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Discussion Comment</p>
                              <button
                                onClick={applySuggestedSignoffComment}
                                disabled={!canParticipateInGovernance}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                              >
                                {!commentDraft.trim() || looksPlaceholderCopy(commentDraft) ? 'Use Suggested Comment' : 'Replace With Suggestion'}
                              </button>
                            </div>
                            <p className="mt-2 text-xs font-medium text-bauhaus-muted">{suggestedSignoffComment}</p>
                          </div>
                          <textarea
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            disabled={!canParticipateInGovernance}
                            rows={3}
                            placeholder="Capture reviewer context, sign-off discussion, or board-facing caveats."
                            className="mt-3 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => addShortlistComment('discussion')}
                              disabled={!canParticipateInGovernance || !commentDraft.trim() || workspaceBusyId === `comment:${workspace.shortlist.id}`}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                            >
                              Add Comment
                            </button>
                          </div>
                          <div className="mt-3 space-y-3">
                            {signoffComments.length === 0 ? (
                              <p className="text-xs font-medium text-bauhaus-muted">
                                No sign-off discussion yet. Add comments here so pack exports freeze the reasoning trail, not just the status.
                              </p>
                            ) : (
                              signoffComments.slice(0, 4).map((comment) => (
                                <div key={comment.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${commentTypeClass(comment.comment_type)}`}>
                                      {commentTypeLabel(comment.comment_type)}
                                    </span>
                                    <span className="text-xs font-bold text-bauhaus-muted">
                                      {comment.author_label || 'Unknown reviewer'} • {fmtDateTime(comment.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-bauhaus-black whitespace-pre-wrap">
                                    {comment.body}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Your Role In This Flow</p>
                        <p className="text-sm font-black text-bauhaus-black mt-2">
                          {workspaceRoleLabel(workspace.currentUserRole)}
                        </p>
                        <p className="text-xs font-medium text-bauhaus-muted mt-1">
                          {ownerMember
                            ? `Current decision owner: ${teamMemberLabel(ownerMember)}.`
                            : 'Set the owner field if you want to assign the next move clearly.'}{' '}
                          {approverMember
                            ? `Approver: ${teamMemberLabel(approverMember)}.`
                            : requiresSeparateApprover
                              ? 'Pick an approver before submitting for sign-off.'
                              : ''}{' '}
                          {currentUserMember
                            ? `Notifications: ${notificationModeLabel(currentUserMember.notification_mode)}.`
                            : ''}
                        </p>
                      </div>
                      <div className="border-t border-bauhaus-black/10 pt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">What To Do Next</p>
                        <div className="mt-2 space-y-2">
                          {workspace.shortlist.approval_lock_active && approvedPackExport ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Open {packVersionLabel(approvedPackExport)}. This is the live approved decision record.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Share or use that approved pack for the current procurement action.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Only reopen the shortlist if scope, evidence, or supplier decisions have materially changed.
                              </p>
                            </>
                          ) : workspace.shortlist.approval_status === 'changes_requested' ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Address the requested changes in the shortlist and decision brief.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Generate a fresh pack version once the changes are complete.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Resubmit the shortlist for sign-off with the updated approval notes.
                              </p>
                            </>
                          ) : currentUserPermissions?.can_approve && workspace.shortlist.approval_status === 'submitted' ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Open the latest decision pack and review the frozen shortlist.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Add approval notes or sign-off discussion if anything needs to be recorded.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Approve or request changes from the sign-off block above.
                              </p>
                            </>
                          ) : workspace.shortlist.approval_status === 'submitted' ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Open the submitted decision pack. This is the current record under review.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Keep the shortlist stable while the approver reviews it.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Watch for approval comments or a changes requested outcome.
                              </p>
                            </>
                          ) : hasDecisionPackBlockers ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Resolve the pack blockers in the decision pack block below.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Fill missing governance fields and update supplier notes, checklist items, or evidence where flagged.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Generate the decision pack once the blocker list clears.
                              </p>
                            </>
                          ) : nextTask ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Start task "{nextTask.title}".
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Open the shortlist below and update the supplier&apos;s decision tag and notes.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Open the dossier if you need deeper evidence, then come back and mark the task done.
                              </p>
                            </>
                          ) : latestPackIsStale && latestPackExport ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Generate a fresh decision pack. {packVersionLabel(latestPackExport)} is now stale.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Review the new pack version and confirm the shortlist still matches the recommendation.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Submit that new pack for sign-off when you are ready.
                              </p>
                            </>
                          ) : shortlistHasItems ? (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Review the shortlist below and make sure the key supplier decisions are tagged.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Complete the checklist on the suppliers that matter for this decision.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                {reviewedShortlistItems.length > 0
                                  ? '3. Generate a decision pack to freeze the current shortlist, evidence, and recommendation.'
                                  : '3. Add a manual review task if you want that work tracked in the queue.'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-black text-bauhaus-black">
                                1. Run discovery or rerun the saved brief.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                2. Add suppliers into the shortlist.
                              </p>
                              <p className="text-sm font-medium text-bauhaus-muted">
                                3. Come back here to assign owner, due date, and review tasks.
                              </p>
                            </>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              if (workspace?.shortlist?.approval_lock_active && approvedPackExport) {
                                router.push(`/tender-intelligence/exports/${approvedPackExport.id}`);
                                return;
                              }
                              if (hasDecisionPackBlockers) {
                                scrollToSection('decision-pack-readiness');
                                return;
                              }
                              if (nextTask) {
                                void startNextTask();
                                return;
                              }
                              if (reviewedShortlistItems.length > 0) {
                                if (!workspace?.shortlist?.approval_lock_active) {
                                  void runPack('decision');
                                }
                                return;
                              }
                              openWorkspaceMode('work', 'review-queue');
                            }}
                            disabled={reviewedShortlistItems.length > 0 && workspace?.shortlist?.approval_lock_active === true && !approvedPackExport}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            {workspace?.shortlist?.approval_lock_active && approvedPackExport
                              ? 'Open Approved Pack'
                              : hasDecisionPackBlockers
                                ? 'Resolve Pack Blockers'
                              : nextTask
                                ? 'Start Review Task'
                                : reviewedShortlistItems.length > 0
                                  ? 'Generate Decision Pack'
                                  : 'Open Review Queue'}
                          </button>
                          <button
                            onClick={() => openWorkspaceMode('work', 'procurement-workspace')}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open Shortlist
                          </button>
                          <button
                            onClick={openHistoryPanelsView}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open History
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-bauhaus-black/10 pt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Latest History</p>
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-black text-bauhaus-black">
                            {latestWorkflowRun
                              ? `${workflowLabel(latestWorkflowRun)} • ${fmtDateTime(latestWorkflowRun.created_at)}`
                              : 'No workflow run recorded yet.'}
                          </p>
                          <p className="text-xs font-medium text-bauhaus-muted">
                            {latestEvent
                              ? `${eventTypeLabel(latestEvent.event_type)}: ${latestEvent.event_summary}`
                              : 'No shortlist history recorded yet.'}
                          </p>
                        </div>
                      </div>
                      <div id="decision-pack-readiness" className="border-t border-bauhaus-black/10 pt-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decision Pack</p>
                        <p className="mt-2 text-sm font-black text-bauhaus-black">
                          {workspace.shortlist.approval_lock_active && approvedPackExport
                            ? `The current decision is frozen in ${packVersionLabel(approvedPackExport)}.`
                            : hasDecisionPackBlockers
                            ? `Resolve ${decisionPackBlockers.length} pack blocker${decisionPackBlockers.length === 1 ? '' : 's'} before exporting.`
                            : openTasks.length > 0
                            ? 'Finish or pause the active review, then generate a decision pack.'
                            : 'Generate a shortlist-backed decision pack when you are ready to brief others.'}
                        </p>
                        <p className="text-xs font-medium text-bauhaus-muted mt-1">
                          The pack will freeze the current shortlist, decision brief, review checklist, and evidence snapshot into a saved report.
                        </p>
                        {!workspace.shortlist.approval_lock_active && (
                          hasDecisionPackBlockers ? (
                            <div className="mt-3 border-2 border-bauhaus-red bg-error-light px-3 py-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Pack Blockers</p>
                              <div className="mt-2 space-y-2">
                                {decisionPackBlockers.slice(0, 5).map((blocker) => (
                                  <button
                                    key={`${blocker.code}-${blocker.shortlist_item_id || blocker.target_field_id}`}
                                    onClick={() => resolveDecisionPackBlocker(blocker)}
                                    className="flex w-full items-start justify-between gap-3 border border-bauhaus-red/30 bg-white px-3 py-3 text-left hover:border-bauhaus-red"
                                  >
                                    <span className="text-sm font-medium text-bauhaus-black">• {blocker.message}</span>
                                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                                      {blocker.action_label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              {decisionPackBlockers.length > 5 && (
                                <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                  + {decisionPackBlockers.length - 5} more blocker{decisionPackBlockers.length - 5 === 1 ? '' : 's'} still need attention.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs font-bold text-money">
                              Ready for export. The shortlist has the minimum governance and evidence fields required for a decision pack.
                            </p>
                          )
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => runPack('decision')}
                            disabled={loading || !workspace.shortlist || workspace.shortlist.approval_lock_active || hasDecisionPackBlockers}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
                          >
                            {loading ? 'Generating Pack...' : hasDecisionPackBlockers ? (firstDecisionPackBlocker?.action_label || 'Resolve Pack Blockers') : 'Generate Decision Pack'}
                          </button>
                          {hasDecisionPackBlockers && (
                            <button
                              onClick={() => resolveDecisionPackBlocker(firstDecisionPackBlocker)}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                            >
                              {firstDecisionPackBlocker?.shortlist_item_id ? 'Resolve In Supplier Row' : 'Resolve In Workspace'}
                            </button>
                          )}
                          {latestPackExport && (
                            <Link
                              href={`/tender-intelligence/exports/${latestPackExport.id}`}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                            >
                              Open Latest Pack
                            </Link>
                          )}
                          {approvedPackExport && approvedPackExport.id !== latestPackExport?.id && (
                            <Link
                              href={`/tender-intelligence/exports/${approvedPackExport.id}`}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money hover:bg-money hover:text-white transition-colors"
                            >
                              Open Approved Pack
                            </Link>
                          )}
                          <button
                            onClick={() => setActiveTab('pack')}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open Pack Tab
                          </button>
                        </div>
                        {latestPackExport && (
                          <p className="mt-2 text-xs font-bold text-bauhaus-muted">
                            Latest pack {latestPackExport.title} {packVersionLabel(latestPackExport)} • {fmtDateTime(latestPackExport.created_at)} • {packGovernanceLabel({ packExport: latestPackExport, shortlist: workspace.shortlist })}{latestPackIsStale ? ' • stale against current shortlist' : ''}
                          </p>
                        )}
                        {workspace.shortlist.approval_lock_active && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-red">
                            This shortlist is approval-locked. Reopen it before generating a new pack version.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="hidden">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Add Manual Review Task</p>
                        <input
                          value={taskDraft.title}
                          onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                          disabled={!canEditWorkspace}
                          placeholder="What needs review?"
                          className="mt-2 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                        />
                      </div>
                      <select
                        value={taskDraft.shortlistItemId}
                        onChange={(event) => setTaskDraft((prev) => ({ ...prev, shortlistItemId: event.target.value }))}
                        disabled={!canManageTasks}
                        className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                      >
                        <option value="">General shortlist task (not linked to a supplier)</option>
                        {(workspace.shortlistItems || []).map((item) => (
                          <option key={item.id} value={item.id}>
                            Link to {item.supplier_name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={taskDraft.description}
                        onChange={(event) => setTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                        disabled={!canManageTasks}
                        rows={3}
                        placeholder="Add context, evidence gap, or follow-up needed."
                        className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                      />
                      <div className="grid gap-3 sm:grid-cols-4">
                        <select
                          value={taskDraft.assigneeUserId}
                          onChange={(event) => setTaskDraft((prev) => ({ ...prev, assigneeUserId: event.target.value }))}
                          disabled={!canManageTasks}
                          className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        >
                          <option value="">Assign owner</option>
                          {taskAssigneeOptions.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {teamMemberLabel(member)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setTaskDraft((prev) => ({ ...prev, assigneeUserId: workspace.currentUserId || '' }))}
                          disabled={!canManageTasks || !workspace.currentUserId || taskDraft.assigneeUserId === workspace.currentUserId}
                          className="border-2 border-bauhaus-black px-3 py-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          Assign To Me
                        </button>
                        <input
                          type="date"
                          value={taskDraft.dueAt}
                          onChange={(event) => setTaskDraft((prev) => ({ ...prev, dueAt: event.target.value }))}
                          disabled={!canManageTasks}
                          className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        />
                        <select
                          value={taskDraft.priority}
                          onChange={(event) => setTaskDraft((prev) => ({ ...prev, priority: event.target.value as ProcurementTask['priority'] }))}
                          disabled={!canManageTasks}
                          className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                        >
                          <option value="medium">Medium priority</option>
                          <option value="low">Low priority</option>
                          <option value="high">High priority</option>
                          <option value="critical">Critical priority</option>
                        </select>
                      </div>
                      <button
                        onClick={createManualTask}
                        disabled={!canManageTasks || !taskDraft.title.trim() || workspaceBusyId === 'new-task'}
                        className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                      >
                        {workspaceBusyId === 'new-task' ? 'Adding Task...' : 'Add Review Task'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${workspaceMode === 'admin' ? 'order-20' : 'hidden'} border-4 border-bauhaus-black bg-white`}>
                <div className="border-b-4 border-bauhaus-black px-4 py-3 bg-bauhaus-canvas flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Shortlists</p>
                    <h3 className="text-lg font-black text-bauhaus-black">Switch active procurement list</h3>
                    <p className="text-sm font-medium text-bauhaus-muted mt-1">
                      Each shortlist keeps its own saved search, organisations, and audit trail.
                    </p>
                  </div>
                  {canEditWorkspace && (
                    <button
                      onClick={() => setShowCreateShortlist((value) => !value)}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                    >
                      {showCreateShortlist ? 'Cancel' : 'New Shortlist'}
                    </button>
                  )}
                </div>
                {showCreateShortlist && (
                  <div className="border-b-4 border-bauhaus-black px-4 py-4 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                    <input
                      value={shortlistNameDraft}
                      onChange={(event) => setShortlistNameDraft(event.target.value)}
                      placeholder="Shortlist name"
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                    />
                    <input
                      value={shortlistDescriptionDraft}
                      onChange={(event) => setShortlistDescriptionDraft(event.target.value)}
                      placeholder="What is this shortlist for?"
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                    />
                    <button
                      onClick={createShortlist}
                      disabled={creatingShortlist}
                      className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-blue hover:text-white hover:border-bauhaus-blue transition-colors disabled:opacity-40"
                    >
                      {creatingShortlist ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                )}
                <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
                  {workspace.shortlists.map((shortlist, index) => (
                    <button
                      key={shortlist.id}
                      onClick={() => setActiveShortlist(shortlist.id)}
                      className={`text-left p-4 border-b-4 md:border-b-0 transition-colors ${
                        index % 3 !== 0 ? 'xl:border-l-4 border-bauhaus-black' : 'border-bauhaus-black'
                      } ${
                        workspace.shortlist?.id === shortlist.id
                          ? 'bg-bauhaus-black text-white'
                          : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black">{shortlist.name}</span>
                        {shortlist.is_default && (
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${workspace.shortlist?.id === shortlist.id ? 'border-white/30 text-white/70' : 'border-bauhaus-black/20 text-bauhaus-muted'}`}>
                            Default
                          </span>
                        )}
                      </div>
                      {shortlist.description && (
                        <p className={`text-xs font-medium mt-2 ${workspace.shortlist?.id === shortlist.id ? 'text-white/70' : 'text-bauhaus-muted'}`}>
                          {shortlist.description}
                        </p>
                      )}
                      <div className={`mt-3 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest ${workspace.shortlist?.id === shortlist.id ? 'text-white/70' : 'text-bauhaus-muted'}`}>
                        <span>{shortlist.item_count} items</span>
                        <span>{shortlist.decision_counts.priority || 0} priority</span>
                        <span>Updated {fmtDateTime(shortlist.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${workspaceMode === 'admin' ? 'order-30' : 'hidden'} grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`}>
                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-blue px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Governance Team</p>
                    <h3 className="text-sm font-black text-white">Procurement roles and notification preferences</h3>
                  </div>
                  {canManageGovernance && (
                    <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Invite Reviewer Or Approver</p>
                        <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                          Invite a team member into this procurement workspace. They join with base viewer access, and the procurement role below is applied automatically when they accept.
                        </p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]">
                        <input
                          value={inviteDraft.email}
                          onChange={(event) => setInviteDraft((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="name@organisation.com"
                          className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                        />
                        <select
                          value={inviteDraft.procurementRole}
                          onChange={(event) => setInviteDraft((prev) => ({ ...prev, procurementRole: event.target.value as TeamMember['procurement_role'] }))}
                          className="border-2 border-bauhaus-black px-3 py-3 text-xs font-black uppercase tracking-widest bg-white"
                        >
                          <option value="reviewer">Reviewer</option>
                          <option value="approver">Approver</option>
                          <option value="observer">Observer</option>
                          <option value="lead">Lead</option>
                        </select>
                        <select
                          value={inviteDraft.notificationMode}
                          onChange={(event) => setInviteDraft((prev) => ({ ...prev, notificationMode: event.target.value as TeamMember['notification_mode'] }))}
                          className="border-2 border-bauhaus-black px-3 py-3 text-xs font-black uppercase tracking-widest bg-white"
                        >
                          <option value="immediate">Immediate</option>
                          <option value="daily_digest">Daily Digest</option>
                          <option value="none">Muted</option>
                        </select>
                        <button
                          onClick={inviteGovernanceMember}
                          disabled={workspaceBusyId === 'team-invite' || !inviteDraft.email.trim()}
                          className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          {workspaceBusyId === 'team-invite' ? 'Inviting...' : 'Invite'}
                        </button>
                      </div>
                      {pendingInvites.length > 0 && (
                        <div className="space-y-2 border-t border-bauhaus-black/10 pt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Pending Invites</p>
                          {pendingInvites.map((invite) => (
                            <div key={invite.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black text-bauhaus-black">{invite.invited_email || 'Unknown email'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                                  {procurementRoleLabel(invite.procurement_role)}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted">
                                  {notificationModeLabel(invite.notification_mode)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                Workspace access {invite.role} • invited {invite.invited_at ? fmtDateTime(invite.invited_at) : 'recently'}
                                {Object.keys(invite.permission_overrides || {}).length > 0
                                  ? ` • ${Object.keys(invite.permission_overrides || {}).length} custom permission override${Object.keys(invite.permission_overrides || {}).length === 1 ? '' : 's'}`
                                  : ''}
                              </p>
                              {canManageGovernance && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void resendPendingInvite(invite.id)}
                                    disabled={workspaceBusyId === `invite:${invite.id}:resend`}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {workspaceBusyId === `invite:${invite.id}:resend` ? 'Resending...' : 'Resend'}
                                  </button>
                                  <button
                                    onClick={() => void cancelPendingInvite(invite.id)}
                                    disabled={workspaceBusyId === `invite:${invite.id}:cancel`}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {workspaceBusyId === `invite:${invite.id}:cancel` ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="divide-y divide-bauhaus-black/10">
                    {governanceMembers.map((member) => (
                      <div key={member.user_id} className="px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-bauhaus-black">{teamMemberLabel(member)}</p>
                              {member.is_owner && (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black">
                                  Workspace Owner
                                </span>
                              )}
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                                {procurementRoleLabel(member.procurement_role)}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted">
                                Org {member.role}
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                              {member.email || 'No email on file'} • Notification mode {notificationModeLabel(member.notification_mode)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(
                                [
                                  'can_edit_shortlist',
                                  'can_manage_tasks',
                                  'can_submit_signoff',
                                  'can_approve',
                                  'can_manage_team',
                                  'can_reopen_approval',
                                  'can_send_notifications',
                                ] as Array<keyof ProcurementPermissions>
                              ).map((permissionKey) => (
                                <span
                                  key={permissionKey}
                                  className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${
                                    member.permissions[permissionKey]
                                      ? 'border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black'
                                      : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                                  }`}
                                >
                                  {permissionLabel(permissionKey)}
                                </span>
                              ))}
                            </div>
                          </div>
                          {canManageGovernance ? (
                            <div className="grid gap-3 sm:min-w-[360px]">
                              <div className="grid gap-2 sm:grid-cols-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                <span className="block mb-1">Procurement Role</span>
                                <select
                                  value={member.procurement_role}
                                  onChange={(event) => {
                                    void updateGovernanceMember(member.user_id, {
                                      procurementRole: event.target.value as TeamMember['procurement_role'],
                                    });
                                  }}
                                  disabled={member.is_owner || workspaceBusyId === `team:${member.user_id}`}
                                  className="w-full border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest bg-white disabled:opacity-40"
                                >
                                  <option value="lead">Lead</option>
                                  <option value="reviewer">Reviewer</option>
                                  <option value="approver">Approver</option>
                                  <option value="observer">Observer</option>
                                </select>
                              </label>
                              <label className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                <span className="block mb-1">Notification Mode</span>
                                <select
                                  value={member.notification_mode}
                                  onChange={(event) => {
                                    void updateGovernanceMember(member.user_id, {
                                      notificationMode: event.target.value as TeamMember['notification_mode'],
                                    });
                                  }}
                                  disabled={workspaceBusyId === `team:${member.user_id}`}
                                  className="w-full border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest bg-white disabled:opacity-40"
                                >
                                  <option value="immediate">Immediate</option>
                                  <option value="daily_digest">Daily Digest</option>
                                  <option value="none">Muted</option>
                                </select>
                              </label>
                              </div>
                              {!member.is_owner && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {(
                                    [
                                      'can_edit_shortlist',
                                      'can_manage_tasks',
                                      'can_submit_signoff',
                                      'can_approve',
                                      'can_manage_team',
                                      'can_reopen_approval',
                                      'can_send_notifications',
                                    ] as Array<keyof ProcurementPermissions>
                                  ).map((permissionKey) => (
                                    <label key={permissionKey} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                      <input
                                        type="checkbox"
                                        checked={member.permissions[permissionKey]}
                                        onChange={() => {
                                          void updateGovernanceMember(member.user_id, {
                                            permissionOverrides: {
                                              ...member.permission_overrides,
                                              [permissionKey]: !member.permissions[permissionKey],
                                            },
                                          });
                                        }}
                                        disabled={workspaceBusyId === `team:${member.user_id}`}
                                        className="size-4 border-2 border-bauhaus-black"
                                      />
                                      <span>{permissionLabel(permissionKey)}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs font-medium text-bauhaus-muted">
                              Only procurement leads can change team governance settings.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-red px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Outbound Queue</p>
                    <h3 className="text-sm font-black text-white">Queued procurement notifications</h3>
                    </div>
                    {canSendNotifications && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => deliverQueuedNotifications('immediate')}
                          disabled={workspaceBusyId === 'deliver-notifications'}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors disabled:opacity-40"
                        >
                          {workspaceBusyId === 'deliver-notifications' ? 'Sending...' : 'Send Immediate'}
                        </button>
                        <button
                          onClick={() => deliverQueuedNotifications('daily_digest')}
                          disabled={workspaceBusyId === 'deliver-notifications'}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors disabled:opacity-40"
                        >
                          {workspaceBusyId === 'deliver-notifications' ? 'Sending...' : 'Send Digest'}
                        </button>
                        <button
                          onClick={() => deliverQueuedNotifications('all')}
                          disabled={workspaceBusyId === 'deliver-notifications'}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors disabled:opacity-40"
                        >
                          {workspaceBusyId === 'deliver-notifications' ? 'Sending...' : 'Send All'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b-4 border-bauhaus-black bg-white">
                    {[
                      { label: 'Queued Now', value: outboundMetrics.queued },
                      { label: 'Needs Attention', value: outboundMetrics.needsAttention },
                      { label: 'Sent 7 Days', value: outboundMetrics.sentRecently },
                      { label: 'Webhook Failures', value: outboundMetrics.webhookFailures },
                    ].map((stat, index) => (
                      <div
                        key={stat.label}
                        className={`p-4 ${index > 0 ? 'border-l-0 border-t-4 lg:border-t-0 lg:border-l-4' : ''} border-bauhaus-black`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</p>
                        <p className="mt-2 text-3xl font-black text-bauhaus-black">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="divide-y divide-bauhaus-black/10">
                    <div className="px-4 py-4 bg-bauhaus-canvas space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Outbound Channels</p>
                        <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                          Route procurement reminders and sign-off events beyond Gmail using webhook endpoints.
                        </p>
                      </div>
                      {notificationChannels.length > 0 && (
                        <div className="space-y-2">
                          {notificationChannels.map((channel) => (
                            <div key={channel.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black text-bauhaus-black">{channel.channel_name}</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${channel.enabled ? 'border-money bg-money-light text-money' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'}`}>
                                  {channel.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                                  Webhook
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${channelVerificationClass(channel.verification_status)}`}>
                                  {channelVerificationLabel(channel.verification_status)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-medium text-bauhaus-muted break-all">{channel.endpoint_url}</p>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                {(channel.event_types || []).length > 0 ? channel.event_types.join(' • ') : 'All procurement events'}
                              </p>
                              {channel.last_tested_at && (
                                <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                  Last verified {fmtDateTime(channel.last_tested_at)}
                                  {channel.last_test_error ? ` • ${channel.last_test_error}` : ''}
                                </p>
                              )}
                              {browserOrigin && (
                                <div className="mt-3 border border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Built-In Inspector URL</p>
                                  <p className="mt-1 text-xs font-medium text-bauhaus-black break-all">
                                    {browserOrigin}/api/tender-intelligence/automation/webhook-inspector/{channel.verification_token}
                                  </p>
                                </div>
                              )}
                              {canSendNotifications && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void sendWebhookTest(channel.id)}
                                    disabled={workspaceBusyId === `channel:test:${channel.id}`}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {workspaceBusyId === `channel:test:${channel.id}` ? 'Sending Test...' : 'Send Test'}
                                  </button>
                                  {browserOrigin && (
                                    <button
                                      onClick={() => void copyInspectorUrl(channel)}
                                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                                    >
                                      Copy Inspector URL
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {recentDeliveryLogs.length > 0 && (
                        <div className="space-y-2 border-t border-bauhaus-black/10 pt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Recent Webhook Delivery</p>
                          {recentDeliveryLogs.slice(0, 6).map((log) => (
                            <div key={log.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${deliveryLogStatusClass(log.status)}`}>
                                  {log.status}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                                  {notificationTypeLabel(log.event_type as ProcurementNotification['notification_type'])}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-black text-bauhaus-black">{log.channel_name}</p>
                              <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                                {log.processed_at ? `processed ${fmtDateTime(log.processed_at)}` : `received ${fmtDateTime(log.received_at)}`}
                              </p>
                              {log.error_message && (
                                <p className="mt-2 text-xs font-bold text-bauhaus-red">{log.error_message}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {recentInspectorReceipts.length > 0 && (
                        <div className="space-y-2 border-t border-bauhaus-black/10 pt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Inspector Receipts</p>
                          {recentInspectorReceipts.slice(0, 6).map((receipt) => (
                            <div key={receipt.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${
                                  receipt.signature_valid === false
                                    ? 'border-bauhaus-red bg-error-light text-bauhaus-red'
                                    : receipt.signature_valid === true
                                      ? 'border-money bg-money-light text-money'
                                      : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                                }`}>
                                  {receipt.signature_valid === false ? 'Bad signature' : receipt.signature_valid === true ? 'Signature ok' : 'No signature'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-black">
                                  {notificationTypeLabel(receipt.event_type || 'unknown')}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-black text-bauhaus-black">{receipt.channel_name}</p>
                              <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                                received {fmtDateTime(receipt.received_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {channelHealth.length > 0 && (
                        <div className="space-y-2 border-t border-bauhaus-black/10 pt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Channel Health</p>
                          <div className="grid gap-2 lg:grid-cols-2">
                            {channelHealth.map((channel) => (
                              <div key={channel.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-black text-bauhaus-black">{channel.channel_name}</span>
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${channel.enabled ? 'border-money bg-money-light text-money' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'}`}>
                                    {channel.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${channelVerificationClass(channel.verification_status)}`}>
                                    {channelVerificationLabel(channel.verification_status)}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                  {channel.success_count} success • {channel.failure_count} failure
                                </p>
                                <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                                  {channel.last_processed_at ? `last success ${fmtDateTime(channel.last_processed_at)}` : 'no successful deliveries yet'}
                                  {channel.last_receipt_at ? ` • last receipt ${fmtDateTime(channel.last_receipt_at)}` : ''}
                                </p>
                                {channel.last_failed_at && (
                                  <p className="mt-1 text-xs font-bold text-bauhaus-red">
                                    last failure {fmtDateTime(channel.last_failed_at)}
                                    {channel.last_error_message ? ` • ${channel.last_error_message}` : ''}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {canManageGovernance && (
                        <div className="grid gap-3 border-t border-bauhaus-black/10 pt-3">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
                            <input
                              value={channelDraft.channelName}
                              onChange={(event) => setChannelDraft((prev) => ({ ...prev, channelName: event.target.value }))}
                              placeholder="Webhook name"
                              className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                            />
                            <input
                              value={channelDraft.endpointUrl}
                              onChange={(event) => setChannelDraft((prev) => ({ ...prev, endpointUrl: event.target.value }))}
                              placeholder="https://example.com/procurement-webhook"
                              className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                            />
                          </div>
                          <input
                            value={channelDraft.signingSecret}
                            onChange={(event) => setChannelDraft((prev) => ({ ...prev, signingSecret: event.target.value }))}
                            placeholder="Optional signing secret"
                            className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                          />
                          <div className="flex flex-wrap gap-2">
                            {(['task_due', 'task_escalated', 'signoff_submitted', 'signoff_approved', 'signoff_changes_requested'] as ProcurementNotification['notification_type'][]).map((eventType) => (
                              <label key={eventType} className="flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                                <input
                                  type="checkbox"
                                  checked={channelDraft.eventTypes.includes(eventType)}
                                  onChange={(event) => {
                                    setChannelDraft((prev) => ({
                                      ...prev,
                                      eventTypes: event.target.checked
                                        ? [...prev.eventTypes, eventType]
                                        : prev.eventTypes.filter((value) => value !== eventType),
                                    }));
                                  }}
                                  className="size-4 border-2 border-bauhaus-black"
                                />
                                <span>{notificationTypeLabel(eventType)}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                              <input
                                type="checkbox"
                                checked={channelDraft.enabled}
                                onChange={(event) => setChannelDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                                className="size-4 border-2 border-bauhaus-black"
                              />
                              <span>Enabled</span>
                            </label>
                            <button
                              onClick={() => void saveNotificationChannel()}
                              disabled={workspaceBusyId === 'channel:new'}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                            >
                              {workspaceBusyId === 'channel:new' ? 'Saving...' : 'Add Webhook Channel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-4 bg-white space-y-3 border-t border-bauhaus-black/10">
                      <div className="flex flex-wrap items-center gap-2">
                        {(['all', 'attention', 'queued', 'sent', 'cancelled'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => setNotificationStatusFilter(status)}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                              notificationStatusFilter === status
                                ? 'border-bauhaus-black bg-bauhaus-black text-white'
                                : 'border-bauhaus-black/20 bg-white text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                            }`}
                          >
                            {status === 'attention' ? 'Needs Attention' : status}
                          </button>
                        ))}
                        {(['all', 'immediate', 'daily_digest'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setNotificationModeFilter(mode)}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                              notificationModeFilter === mode
                                ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                                : 'border-bauhaus-black/20 bg-white text-bauhaus-muted hover:border-bauhaus-blue hover:text-bauhaus-blue'
                            }`}
                          >
                            {mode === 'all' ? 'All Modes' : notificationModeLabel(mode)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs font-medium text-bauhaus-muted">
                        Showing {filteredNotifications.length} of {recentNotifications.length} recent notification records.
                      </p>
                    </div>
                    {filteredNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                        No outbound notifications match the current filter.
                      </div>
                    ) : (
                      filteredNotifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${notificationTypeClass(notification.notification_type)}`}>
                              {notificationTypeLabel(notification.notification_type)}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${notificationStatusClass(notification.status)}`}>
                              {notification.status}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted">
                              {notificationModeLabel(notification.delivery_mode)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-black text-bauhaus-black">{notification.subject}</p>
                          <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                            To {notification.recipient_label || 'Unknown recipient'} • queued {fmtDateTime(notification.queued_at)}
                            {notification.sent_at ? ` • sent ${fmtDateTime(notification.sent_at)}` : ''}
                            {notification.attempt_count > 0 ? ` • ${notification.attempt_count} attempt${notification.attempt_count === 1 ? '' : 's'}` : ''}
                            {notification.external_message_id ? ` • message ${notification.external_message_id}` : ''}
                          </p>
                          {notification.body && (
                            <p className="mt-2 text-sm font-medium text-bauhaus-muted">{notification.body}</p>
                          )}
                          {notification.last_error && (
                            <p className="mt-2 text-xs font-bold text-bauhaus-red">
                              Last delivery error: {notification.last_error}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => openNotificationContext(notification)}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                            >
                              Open Context
                            </button>
                            {canSendNotifications && notification.status !== 'sent' && (
                              <>
                                <button
                                  onClick={() => void retryNotification(notification.id)}
                                  disabled={workspaceBusyId === `notification:${notification.id}:retry`}
                                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                >
                                  {workspaceBusyId === `notification:${notification.id}:retry` ? 'Retrying...' : 'Retry'}
                                </button>
                                {notification.status === 'queued' && (
                                  <button
                                    onClick={() => void cancelNotification(notification.id)}
                                    disabled={workspaceBusyId === `notification:${notification.id}:cancel`}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {workspaceBusyId === `notification:${notification.id}:cancel` ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div
                id="procurement-workspace"
                className={`${workspaceMode === 'work' ? 'order-20' : 'hidden'} border-4 border-bauhaus-black bg-white`}
              >
                <div className="bg-bauhaus-black px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Team Shortlist</p>
                    <h3 className="text-lg font-black text-white">{workspace.shortlist.name}</h3>
                    <p className="text-sm font-medium text-white/70 mt-1">
                      Manage every tagged organisation, capture procurement notes, and keep the shortlist visible for the whole team.
                    </p>
                    {workspace.shortlist.description && (
                      <p className="text-xs font-medium text-white/60 mt-2">{workspace.shortlist.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!canEditWorkspace && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">View only</span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                      {filteredWorkspaceItems.length} shown
                    </span>
                  </div>
                </div>
                {activeReviewTask && (
                  <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow/20 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Current Review</p>
                        <h4 className="text-base font-black text-bauhaus-black mt-1">{activeReviewTask.title}</h4>
                        <div className="mt-2 space-y-1 text-sm">
                          {activeReviewItem ? (
                            <>
                              <p className="font-black text-bauhaus-black">1. Review supplier: {activeReviewItem.supplier_name}</p>
                              <p className="font-medium text-bauhaus-muted">2. Update the decision tag and procurement note on this supplier row below.</p>
                              <p className="font-medium text-bauhaus-muted">3. Open the dossier if you need more evidence, then come back and mark the task done.</p>
                            </>
                          ) : (
                            <>
                              <p className="font-black text-bauhaus-black">1. Pick the supplier row below that this task refers to.</p>
                              <p className="font-medium text-bauhaus-muted">2. Update its decision tag and note so the shortlist reflects your review.</p>
                              <p className="font-medium text-bauhaus-muted">3. Return to the review queue and mark the task done.</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeReviewItem?.gs_id && (
                          <Link
                            href={entityHref(activeReviewItem.gs_id, 'procurement-workspace')}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open Dossier
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            if (!activeReviewTask) return;
                            setActiveReviewTaskId(null);
                            updateTask(activeReviewTask.id, { status: 'done' });
                          }}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money hover:bg-money hover:text-white transition-colors"
                        >
                          Mark Task Done
                        </button>
                        <button
                          onClick={clearReviewMode}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          Exit Review Mode
                        </button>
                      </div>
                    </div>
                    {activeReviewItem ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <div className="border-2 border-bauhaus-black bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence Rail</p>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${confidenceBadgeColor(activeReviewItem.provenance?.confidence)}`}>
                              {confidenceLabel(activeReviewItem.provenance?.confidence)}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 ${decisionTagBadgeClass(activeReviewItem.decision_tag)}`}>
                              {decisionTagLabel(activeReviewItem.decision_tag)}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {[
                              { label: 'Why matched', value: activeReviewItem.provenance?.match_reason || 'Saved in shortlist' },
                              { label: 'Sources', value: `${activeReviewItem.provenance?.source_count || 0} datasets` },
                              { label: 'Contracts', value: activeReviewItem.contract_count > 0 ? `${activeReviewItem.contract_count} • ${fmtMoney(activeReviewItem.contract_total_value)}` : 'No contracts linked' },
                              { label: 'Last seen', value: activeReviewItem.provenance?.last_seen ? fmtDateTime(activeReviewItem.provenance.last_seen) : 'No freshness date' },
                              { label: 'Last reviewed', value: activeReviewItem.last_reviewed_at ? fmtDateTime(activeReviewItem.last_reviewed_at) : 'Not reviewed yet' },
                              { label: 'Region', value: [activeReviewItem.lga_name, activeReviewItem.state].filter(Boolean).join(', ') || activeReviewItem.remoteness || 'No region recorded' },
                            ].map((metric) => (
                              <div key={metric.label} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                                <p className="mt-2 text-sm font-black text-bauhaus-black">{metric.value}</p>
                              </div>
                            ))}
                          </div>
                          {activeReviewItem.provenance?.source_datasets?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {activeReviewItem.provenance.source_datasets.slice(0, 6).map((dataset) => (
                                <span
                                  key={`${activeReviewItem.id}-${dataset}`}
                                  className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted"
                                >
                                  {dataset.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="border-2 border-bauhaus-black bg-white p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Review Checklist</p>
                          <p className="mt-2 text-sm font-black text-bauhaus-black">
                            {reviewChecklistCount(normalizeChecklist(activeReviewItem.review_checklist))} of 4 checks complete
                          </p>
                          <div className="mt-3 space-y-2">
                            {[
                              { key: 'fit' as const, label: 'Supplier fit checked' },
                              { key: 'risk_checked' as const, label: 'Risk checked' },
                              { key: 'evidence_checked' as const, label: 'Evidence checked' },
                              { key: 'decision_made' as const, label: 'Decision recorded' },
                            ].map((step) => {
                              const checklist = normalizeChecklist(activeReviewItem.review_checklist);
                              const checked = checklist[step.key];
                              return (
                                <button
                                  key={step.key}
                                  onClick={() => toggleReviewChecklist(activeReviewItem, step.key)}
                                  disabled={!canEditWorkspace || workspaceBusyId === activeReviewItem.id}
                                  className={`w-full flex items-center justify-between gap-3 border-2 px-3 py-3 text-left transition-colors disabled:opacity-40 ${
                                    checked
                                      ? 'border-money bg-money-light text-money'
                                      : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black'
                                  }`}
                                >
                                  <span className="text-sm font-black">{step.label}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    {checked ? 'Done' : 'Mark Done'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-3 text-xs font-medium text-bauhaus-muted">
                            Complete these checks, update the supplier note and decision tag below, then mark the task done.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Link This Task</p>
                        <p className="mt-2 text-sm font-black text-bauhaus-black">
                          This task is not linked to a supplier yet.
                        </p>
                        <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                          Pick a supplier row below and use “Use For Current Review” so the checklist and evidence rail can lock onto the organisation you are reviewing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-4 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Saved Market Brief</p>
                      {savedSearchPills.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                          {savedSearchPills.length} filters
                        </span>
                      )}
                    </div>
                    {savedSearchPills.length > 0 ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {savedSearchPills.map((pill) => (
                            <span
                              key={pill}
                              className="inline-flex min-h-11 items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black"
                            >
                              {pill}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs font-medium text-bauhaus-muted mt-3">
                          This shortlist is carrying the filters from your last supplier discovery run.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={applySavedBrief}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Apply Brief
                          </button>
                          <button
                            onClick={rerunSavedBrief}
                            disabled={workspaceBusyId === `rerun:${workspace.shortlist.id}`}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-40"
                          >
                            {workspaceBusyId === `rerun:${workspace.shortlist.id}` ? 'Rerunning...' : 'Rerun Now'}
                          </button>
                          <select
                            value={watchIntervalHours}
                            onChange={(event) => {
                              const nextInterval = Number(event.target.value) || 24;
                              setWatchIntervalHours(nextInterval);
                              void updateWatchSettings({ intervalHours: nextInterval });
                            }}
                            disabled={workspaceBusyId === `watch:${workspace.shortlist.id}`}
                            className="min-h-11 border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-bauhaus-black disabled:opacity-40"
                          >
                            <option value={12}>Watch every 12h</option>
                            <option value={24}>Watch every 24h</option>
                            <option value={72}>Watch every 72h</option>
                            <option value={168}>Watch weekly</option>
                          </select>
                          <button
                            onClick={() => void updateWatchSettings({ enabled: !workspace.watch?.enabled, intervalHours: watchIntervalHours })}
                            disabled={workspaceBusyId === `watch:${workspace.shortlist.id}`}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors disabled:opacity-40 ${
                              workspace.watch?.enabled
                                ? 'border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white'
                                : 'border-money text-money hover:bg-money hover:text-white'
                            }`}
                          >
                            {workspaceBusyId === `watch:${workspace.shortlist.id}`
                              ? 'Saving Watch...'
                              : workspace.watch?.enabled
                                ? 'Watching Market'
                                : 'Watch This Market'}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-bauhaus-muted">
                          <span>
                            {workspace.watch?.enabled
                              ? `Watching every ${workspace.watch.interval_hours} hours`
                              : 'Manual reruns only'}
                          </span>
                          {workspace.watch?.last_run_at && (
                            <span>Last rerun {fmtDateTime(workspace.watch.last_run_at)}</span>
                          )}
                          {workspace.watch?.next_run_at && workspace.watch.enabled && (
                            <span>Next due {fmtDateTime(workspace.watch.next_run_at)}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-bauhaus-black mt-1">
                        Run supplier discovery to save the current market brief here.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={workspaceSearch}
                      onChange={(event) => setWorkspaceSearch(event.target.value)}
                      placeholder="Search saved organisations, notes, ABN, state, or LGA"
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setWorkspaceDecisionFilter('all')}
                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                          workspaceDecisionFilter === 'all'
                            ? 'border-bauhaus-black bg-bauhaus-black text-white'
                            : 'border-bauhaus-black text-bauhaus-black hover:bg-white'
                        }`}
                      >
                        All
                      </button>
                      {SHORTLIST_DECISIONS.map((option) => {
                        const key = option.value || 'untriaged';
                        return (
                          <button
                            key={key}
                            onClick={() => setWorkspaceDecisionFilter(key)}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                              workspaceDecisionFilter === key
                                ? `${decisionTagBadgeClass(option.value)}`
                                : 'border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-bauhaus-black/10">
                  {workspace.shortlistItems.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                      No suppliers saved yet. Run discovery and add suppliers you want the team to review.
                    </div>
                  ) : filteredWorkspaceItems.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                      No saved organisations match the current search or decision filter.
                    </div>
                  ) : (
                    filteredWorkspaceItems.map((item) => {
                      const noteDraft = noteDrafts[item.id] ?? '';
                      const supplierCommentDraft = supplierCommentDrafts[item.id] ?? '';
                      const supplierComments = supplierCommentsByItemId[item.id] || [];
                      const hasUnsavedNote = noteDraft !== (item.note || '');
                      const itemStatus = workspaceItemStatus[item.id];
                      const isActiveReviewItem = activeReviewItem?.id === item.id;
                      const isFocusedItem = focusedShortlistItemId === item.id;
                      const itemBlockers = decisionPackBlockers.filter((blocker) => blocker.shortlist_item_id === item.id);
                      return (
                        <div
                          key={item.id}
                          id={`shortlist-item-${item.id}`}
                          className={`px-4 py-5 scroll-mt-8 ${
                            isActiveReviewItem
                              ? 'bg-bauhaus-yellow/10'
                              : isFocusedItem
                                ? 'bg-link-light/30'
                                : ''
                          }`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                              {isActiveReviewItem && (
                                <div className="mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black">
                                    Reviewing This Supplier
                                  </span>
                                </div>
                              )}
                              {item.gs_id ? (
                                <Link href={entityHref(item.gs_id, 'procurement-workspace')} className="text-base font-black text-bauhaus-black hover:text-bauhaus-red">
                                  {item.supplier_name}
                                </Link>
                              ) : (
                                <p className="text-base font-black text-bauhaus-black">{item.supplier_name}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 ${decisionTagBadgeClass(item.decision_tag)}`}>
                                  {decisionTagLabel(item.decision_tag)}
                                </span>
                                {item.entity_type && (
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${entityTypeBadgeColor(item.entity_type)}`}>
                                    {entityTypeLabel(item.entity_type)}
                                  </span>
                                )}
                                {item.supplier_abn && (
                                  <span className="text-xs font-bold text-bauhaus-muted">ABN {item.supplier_abn}</span>
                                )}
                                {(item.lga_name || item.state) && (
                                  <span className="text-xs font-bold text-bauhaus-muted">{item.lga_name || item.state}</span>
                                )}
                                {item.contract_count > 0 && (
                                  <span className="text-xs font-bold text-money">
                                    {item.contract_count} contracts • {fmtMoney(item.contract_total_value)}
                                  </span>
                                )}
                                {item.provenance?.source_count ? (
                                  <span className="text-xs font-bold text-bauhaus-muted">
                                    {item.provenance.source_count} sources
                                  </span>
                                ) : null}
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${freshnessTone(item)}`}>
                                  {freshnessLabel(item)}
                                </span>
                                {item.provenance?.confidence && (
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${confidenceBadgeColor(item.provenance.confidence)}`}>
                                    {confidenceLabel(item.provenance.confidence)}
                                  </span>
                                )}
                                {item.provenance?.last_seen && (
                                  <span className="text-xs font-bold text-bauhaus-muted">
                                    Seen {fmtDateTime(item.provenance.last_seen)}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-bauhaus-muted">
                                  Checklist {reviewChecklistCount(normalizeChecklist(item.review_checklist))}/4
                                </span>
                                <span className="text-xs font-bold text-bauhaus-muted">
                                  Updated {fmtDateTime(item.updated_at)}
                                </span>
                              </div>
                              {item.provenance && (
                                <div id={`supplier-evidence-${item.id}`} className="mt-3 border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence & Freshness</p>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${freshnessTone(item)}`}>
                                      {freshnessLabel(item)}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                    {[
                                      { label: 'Why matched', value: item.provenance.match_reason },
                                      { label: 'Sources', value: `${item.provenance.source_count || 0} datasets` },
                                      { label: 'Last seen', value: item.provenance.last_seen ? fmtDateTime(item.provenance.last_seen) : 'No freshness date' },
                                      { label: 'Entity updated', value: item.provenance.entity_updated_at ? fmtDateTime(item.provenance.entity_updated_at) : 'No registry refresh' },
                                    ].map((entry) => (
                                      <div key={`${item.id}-${entry.label}`}>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{entry.label}</p>
                                        <p className="mt-1 text-xs font-bold text-bauhaus-black">{entry.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {item.provenance.financial_year && (
                                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-muted">
                                        FY {item.provenance.financial_year}
                                      </span>
                                    )}
                                    {item.provenance.source_datasets.slice(0, 6).map((dataset) => (
                                      <span key={`${item.id}-${dataset}`} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/10 bg-white text-bauhaus-muted">
                                        {dataset.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {item.gs_id ? (
                                      <Link
                                        href={entityHref(item.gs_id, 'procurement-workspace')}
                                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-white transition-colors"
                                      >
                                        Review Evidence In Dossier
                                      </Link>
                                    ) : (
                                      <span className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/20 text-bauhaus-muted">
                                        No Dossier Evidence Link
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {itemBlockers.length > 0 && (
                                <div className="mt-3 border-2 border-bauhaus-red bg-error-light px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Pack blockers on this supplier</p>
                                    <button
                                      onClick={() => resolveDecisionPackBlocker(itemBlockers[0] || null)}
                                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors"
                                    >
                                      {itemBlockers[0]?.action_label || 'Resolve'}
                                    </button>
                                  </div>
                                  <ul className="mt-2 space-y-1">
                                    {itemBlockers.slice(0, 3).map((blocker) => (
                                      <li key={`${item.id}-${blocker.code}-${blocker.target_field_id}`} className="text-xs font-medium text-bauhaus-black">
                                        • {blocker.message}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {activeReviewTask && !activeReviewItem && (
                                <button
                                  onClick={() => linkTaskToSupplier(activeReviewTask, item)}
                                  disabled={!canEditWorkspace || workspaceBusyId === `task:${activeReviewTask.id}`}
                                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-yellow transition-colors disabled:opacity-40"
                                >
                                  Use For Current Review
                                </button>
                              )}
                              {item.gs_id ? (
                                <Link
                                  href={entityHref(item.gs_id, 'procurement-workspace')}
                                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                                >
                                  Open Dossier
                                </Link>
                              ) : (
                                <span className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black/20 text-bauhaus-muted">
                                  No Dossier
                                </span>
                              )}
                              <button
                                onClick={() => removeShortlistItem(item.id)}
                                disabled={!canEditWorkspace || workspaceBusyId === item.id}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-4 mt-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Decision Tag</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {SHORTLIST_DECISIONS.map((option) => {
                                  const optionKey = option.value || 'untriaged';
                                  const isActive = (item.decision_tag || 'untriaged') === optionKey;
                                  return (
                                    <button
                                      key={optionKey}
                                      onClick={() => updateShortlistItem(item.id, {
                                        decisionTag: option.value,
                                        evidenceSnapshot: buildEvidenceSnapshot(item),
                                      })}
                                      disabled={!canEditWorkspace || workspaceBusyId === item.id}
                                      className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors disabled:opacity-40 ${
                                        isActive
                                          ? decisionTagBadgeClass(option.value)
                                          : 'border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black'
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div id={`supplier-checklist-${item.id}`} className="mt-4 border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Review Checklist</p>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                    {reviewChecklistCount(normalizeChecklist(item.review_checklist))}/4 complete
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {[
                                    { key: 'fit' as const, label: 'Fit' },
                                    { key: 'risk_checked' as const, label: 'Risk checked' },
                                    { key: 'evidence_checked' as const, label: 'Evidence checked' },
                                    { key: 'decision_made' as const, label: 'Decision made' },
                                  ].map((check) => {
                                    const checklist = normalizeChecklist(item.review_checklist);
                                    const isChecked = checklist[check.key];
                                    return (
                                      <button
                                        key={`${item.id}-${check.key}`}
                                        onClick={() => toggleReviewChecklist(item, check.key)}
                                        disabled={!canEditWorkspace || workspaceBusyId === item.id}
                                        className={`flex items-center justify-between gap-3 border-2 px-3 py-3 text-left transition-colors disabled:opacity-40 ${
                                          isChecked
                                            ? 'border-money bg-money-light text-money'
                                            : 'border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black'
                                        }`}
                                      >
                                        <span className="text-[10px] font-black uppercase tracking-widest">{check.label}</span>
                                        <span className="text-xs font-bold">{isChecked ? 'Done' : 'Needs work'}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Procurement Notes</p>
                                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                  {workspaceBusyId === item.id
                                    ? 'Saving...'
                                    : itemStatus
                                      ? itemStatus
                                      : hasUnsavedNote
                                        ? 'Unsaved changes'
                                      : 'Saved'}
                                </span>
                              </div>
                              <div className="mt-3 border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Analyst Note</p>
                                  <button
                                    onClick={() => applySuggestedSupplierNote(item, itemBlockers)}
                                    disabled={!canEditWorkspace}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {!noteDraft.trim() || looksPlaceholderCopy(noteDraft) ? 'Use Suggested Note' : 'Replace With Suggestion'}
                                  </button>
                                </div>
                                <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                  {buildSuggestedSupplierNote({
                                    item,
                                    shortlist: workspace.shortlist!,
                                    blockers: itemBlockers,
                                  })}
                                </p>
                              </div>
                              <textarea
                                id={`supplier-note-${item.id}`}
                                value={noteDraft}
                                onChange={(event) => {
                                  setNoteDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                                  setWorkspaceItemStatus((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.value === (item.note || '') ? 'Saved' : 'Unsaved changes',
                                  }));
                                }}
                                placeholder="Record the probity question, partner fit, pricing issue, next step, or who owns follow-up."
                                disabled={!canEditWorkspace}
                                rows={4}
                                className="mt-3 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                              />
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] font-medium text-bauhaus-muted">
                                  Use this field for internal assessment only. It stays attached to the organisation when you open the dossier.
                                </p>
                                <button
                                  onClick={() => updateShortlistItem(item.id, {
                                    note: noteDraft,
                                    evidenceSnapshot: buildEvidenceSnapshot(item),
                                  })}
                                  disabled={!canEditWorkspace || workspaceBusyId === item.id || !hasUnsavedNote}
                                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-blue hover:text-white hover:border-bauhaus-blue transition-colors disabled:opacity-40"
                                >
                                  {workspaceBusyId === item.id ? 'Saving...' : hasUnsavedNote ? 'Save Note' : 'Saved'}
                                </button>
                              </div>
                              <div className="mt-4 border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Supplier Review Comments</p>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                    {supplierComments.length} recorded
                                  </span>
                                </div>
                                <div className="mt-3 border border-bauhaus-black/10 bg-white px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Review Comment</p>
                                    <button
                                      onClick={() => applySuggestedSupplierComment(item, itemBlockers)}
                                      disabled={!canEditWorkspace}
                                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                    >
                                      {!supplierCommentDraft.trim() ? 'Use Suggested Comment' : 'Replace With Suggestion'}
                                    </button>
                                  </div>
                                  <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                                    {buildSuggestedSupplierComment({ item, blockers: itemBlockers })}
                                  </p>
                                </div>
                                <textarea
                                  id={`supplier-comment-${item.id}`}
                                  value={supplierCommentDraft}
                                  onChange={(event) => setSupplierCommentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                  placeholder="Capture review evidence, caveats, or why the current recommendation shifted."
                                  disabled={!canEditWorkspace}
                                  rows={3}
                                  className="mt-3 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                                />
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-medium text-bauhaus-muted">
                                    Use comments when the shortlist note is not enough to explain the review trail.
                                  </p>
                                  <button
                                    onClick={() => addSupplierComment(item)}
                                    disabled={!canEditWorkspace || !supplierCommentDraft.trim() || workspaceBusyId === `supplier-comment:${item.id}`}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                  >
                                    {workspaceBusyId === `supplier-comment:${item.id}` ? 'Saving Comment...' : 'Add Comment'}
                                  </button>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {supplierComments.length === 0 ? (
                                    <p className="text-xs font-medium text-bauhaus-muted">
                                      No supplier comments yet. Add one if you need a clearer evidence or review trail on this organisation.
                                    </p>
                                  ) : (
                                    supplierComments.slice(0, 3).map((comment) => (
                                      <div key={comment.id} className="border border-bauhaus-black/10 bg-white px-3 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${commentTypeClass(comment.comment_type)}`}>
                                            {commentTypeLabel(comment.comment_type)}
                                          </span>
                                          <span className="text-xs font-bold text-bauhaus-muted">
                                            {comment.author_label || 'Unknown reviewer'} • {fmtDateTime(comment.created_at)}
                                          </span>
                                        </div>
                                        <p className="mt-2 text-sm font-medium text-bauhaus-black whitespace-pre-wrap">
                                          {comment.body}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div
                id="work-queue-launcher"
                className={`${workspaceMode === 'work' ? 'order-25 border-4 border-bauhaus-black bg-white' : 'hidden'}`}
              >
                <div className="bg-bauhaus-yellow px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/60">Work Queue</p>
                    <h3 className="text-lg font-black text-bauhaus-black">Create review tasks and run market automation</h3>
                    <p className="mt-1 text-sm font-medium text-bauhaus-black/70">
                      Use this rail to create explicit work, assign it clearly, and keep the shortlist moving without leaving the working surface.
                    </p>
                  </div>
                  <button
                    onClick={runDueWatches}
                    disabled={workspaceBusyId === 'run-due-watches'}
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {workspaceBusyId === 'run-due-watches' ? 'Running Automation...' : 'Run Watches & Reminders'}
                  </button>
                </div>
                <div className="border-b-4 border-bauhaus-black grid grid-cols-2 gap-0 lg:grid-cols-4">
                  {[
                    { label: 'Open Tasks', value: openTasks.length },
                    { label: 'Urgent', value: urgentTasks.length },
                    { label: 'Due In 48H', value: dueSoonTasks.length },
                    { label: 'Escalations', value: openEscalations.length },
                  ].map((metric, index) => (
                    <div
                      key={metric.label}
                      className={`p-4 ${index > 0 ? 'border-l-0 border-t-4 lg:border-t-0 lg:border-l-4' : ''} border-bauhaus-black`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                      <p className="mt-2 text-2xl font-black text-bauhaus-black">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 space-y-3">
                  {workspace.shortlist && suggestedTaskDraft && (
                    <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Review Task</p>
                        <button
                          onClick={applySuggestedTaskDraft}
                          disabled={!canManageTasks}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          Use Suggested Task
                        </button>
                      </div>
                      <p className="mt-2 text-sm font-black text-bauhaus-black">{suggestedTaskDraft.title}</p>
                      <p className="mt-2 text-xs font-medium text-bauhaus-muted">{suggestedTaskDraft.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Add Manual Review Task</p>
                    <input
                      value={taskDraft.title}
                      onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                      disabled={!canEditWorkspace}
                      placeholder="What needs review?"
                      className="mt-2 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                    />
                  </div>
                  <select
                    value={taskDraft.shortlistItemId}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, shortlistItemId: event.target.value }))}
                    disabled={!canManageTasks}
                    className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                  >
                    <option value="">General shortlist task (not linked to a supplier)</option>
                    {(workspace.shortlistItems || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        Link to {item.supplier_name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={taskDraft.description}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                    disabled={!canManageTasks}
                    rows={3}
                    placeholder="Add context, evidence gap, or follow-up needed."
                    className="w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                  />
                  <div className="grid gap-3 sm:grid-cols-4">
                    <select
                      value={taskDraft.assigneeUserId}
                      onChange={(event) => setTaskDraft((prev) => ({ ...prev, assigneeUserId: event.target.value }))}
                      disabled={!canManageTasks}
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                    >
                      <option value="">Assign owner</option>
                      {taskAssigneeOptions.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {teamMemberLabel(member)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setTaskDraft((prev) => ({ ...prev, assigneeUserId: workspace.currentUserId || '' }))}
                      disabled={!canManageTasks || !workspace.currentUserId || taskDraft.assigneeUserId === workspace.currentUserId}
                      className="border-2 border-bauhaus-black px-3 py-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                    >
                      Assign To Me
                    </button>
                    <input
                      type="date"
                      value={taskDraft.dueAt}
                      onChange={(event) => setTaskDraft((prev) => ({ ...prev, dueAt: event.target.value }))}
                      disabled={!canManageTasks}
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                    />
                    <select
                      value={taskDraft.priority}
                      onChange={(event) => setTaskDraft((prev) => ({ ...prev, priority: event.target.value as ProcurementTask['priority'] }))}
                      disabled={!canManageTasks}
                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                    >
                      <option value="medium">Medium priority</option>
                      <option value="low">Low priority</option>
                      <option value="high">High priority</option>
                      <option value="critical">Critical priority</option>
                    </select>
                  </div>
                  <button
                    onClick={createManualTask}
                    disabled={!canManageTasks || !taskDraft.title.trim() || workspaceBusyId === 'new-task'}
                    className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {workspaceBusyId === 'new-task' ? 'Adding Task...' : 'Add Review Task'}
                  </button>
                </div>
              </div>

              <div
                id="review-queue"
                className={`${workspaceMode === 'work' && showWorkQueue ? 'order-30' : 'hidden'} border-4 border-bauhaus-black bg-white`}
              >
                <div className="bg-bauhaus-black px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Review Queue</p>
                  <h3 className="text-sm font-black text-white">Tasks created by alerts and analysts</h3>
                </div>
                <div className="divide-y divide-bauhaus-black/10">
                  {sortedTasks.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                      No review tasks yet. Automation reruns and manual follow-ups will appear here.
                    </div>
                  ) : (
                    sortedTasks.map((task) => {
                      const completionDraft = taskCompletionDrafts[task.id] || {
                        outcome: task.completion_outcome || 'resolved',
                        note: task.completion_note || '',
                      };
                      const showCompletionPanel = task.status === 'done' || task.status === 'in_progress' || focusedTaskId === task.id || nextTask?.id === task.id;
                      return (
                        <div
                          key={task.id}
                          id={`review-task-${task.id}`}
                          className={`px-4 py-4 scroll-mt-8 ${
                            focusedTaskId === task.id ? 'bg-bauhaus-yellow/20' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {nextTask?.id === task.id && (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black">
                                  Next Up
                                </span>
                              )}
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskPriorityBadgeClass(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskStatusBadgeClass(task.status)}`}>
                                {taskStatusLabel(task.status)}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/10 bg-bauhaus-canvas text-bauhaus-muted">
                                {taskTypeLabel(task.task_type)}
                              </span>
                              {task.status === 'done' && (
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskOutcomeClass(task.completion_outcome)}`}>
                                  {taskOutcomeLabel(task.completion_outcome)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-black text-bauhaus-black mt-2">{task.title}</p>
                            {task.description && (
                              <p className="text-sm font-medium text-bauhaus-muted mt-1">{task.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-bauhaus-muted">
                              {task.assignee_user_id && task.assignee_user_id === workspace.currentUserId && <span>Assigned to you</span>}
                              {task.assignee_label && <span>Owner {task.assignee_label}</span>}
                              {task.due_at && <span>Due {fmtDateTime(task.due_at)}</span>}
                              {reminderSummary(task) && <span>{reminderSummary(task)}</span>}
                              {task.completed_at && <span>Completed {fmtDateTime(task.completed_at)}</span>}
                              <span>Updated {fmtDateTime(task.updated_at)}</span>
                            </div>
                            {showCompletionPanel && (
                              <div className="mt-3 border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Task Outcome</p>
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${taskOutcomeClass(task.completion_outcome)}`}>
                                    {task.status === 'done' ? taskOutcomeLabel(task.completion_outcome) : 'Set before complete'}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                                  <select
                                    value={completionDraft.outcome}
                                    onChange={(event) => setTaskCompletionDrafts((prev) => ({
                                      ...prev,
                                      [task.id]: {
                                        ...completionDraft,
                                        outcome: event.target.value as NonNullable<ProcurementTask['completion_outcome']>,
                                      },
                                    }))}
                                    disabled={!canManageTasks || task.status === 'done'}
                                    className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white disabled:opacity-40"
                                  >
                                    {TASK_COMPLETION_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border border-bauhaus-black/10 bg-white px-3 py-2">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suggested Outcome Note</p>
                                      <button
                                        onClick={() => applySuggestedCompletionNote(task)}
                                        disabled={!canManageTasks || task.status === 'done'}
                                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                                      >
                                        {!completionDraft.note.trim() || looksPlaceholderCopy(completionDraft.note) ? 'Use Suggested Note' : 'Replace With Suggestion'}
                                      </button>
                                    </div>
                                    <textarea
                                      value={completionDraft.note}
                                      onChange={(event) => setTaskCompletionDrafts((prev) => ({
                                        ...prev,
                                        [task.id]: {
                                          ...completionDraft,
                                          note: event.target.value,
                                        },
                                      }))}
                                      disabled={!canManageTasks || task.status === 'done'}
                                      rows={2}
                                      placeholder="Record the outcome or handoff note for this task."
                                      className="border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                                    />
                                  </div>
                                  {task.status === 'done' ? (
                                    <span className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money bg-white">
                                      Complete
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => completeTask(task)}
                                      disabled={!canManageTasks || workspaceBusyId === `task:${task.id}`}
                                      className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money hover:bg-money hover:text-white transition-colors disabled:opacity-40"
                                    >
                                      Complete Task
                                    </button>
                                  )}
                                </div>
                                {task.status === 'done' && task.completion_note && (
                                  <p className="mt-2 text-xs font-medium text-bauhaus-muted whitespace-pre-wrap">
                                    {task.completion_note}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startReviewTask(task)}
                              disabled={!canEditWorkspace || workspaceBusyId === `task:${task.id}` || task.status === 'done'}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors disabled:opacity-40"
                            >
                              {task.status === 'in_progress' ? 'Resume Review' : task.status === 'done' ? 'Done' : 'Start Review'}
                            </button>
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => updateTask(task.id, { status: 'open' })}
                                disabled={!canEditWorkspace || workspaceBusyId === `task:${task.id}`}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
                              >
                                Pause Review
                              </button>
                            )}
                            {typeof task.metadata?.gs_id === 'string' && (
                              <Link
                                href={entityHref(String(task.metadata.gs_id), 'procurement-workspace')}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                              >
                                Open Dossier
                              </Link>
                            )}
                            {!task.metadata?.gs_id && task.shortlist_item_id && (
                              <button
                                onClick={() => startReviewTask(task)}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                              >
                                Go To Supplier
                              </button>
                            )}
                            {!task.shortlist_item_id && (
                              <button
                                onClick={() => startReviewTask(task)}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                              >
                                Review In Shortlist
                              </button>
                            )}
                            <button
                              onClick={() => updateTask(task.id, {
                                assigneeUserId: workspace.currentUserId || null,
                              })}
                              disabled={!canEditWorkspace || !workspace.currentUserId || workspaceBusyId === `task:${task.id}` || task.assignee_user_id === workspace.currentUserId}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors disabled:opacity-40"
                            >
                              Assign To Me
                            </button>
                            <button
                              onClick={() => completeTask(task)}
                              disabled={!canEditWorkspace || workspaceBusyId === `task:${task.id}` || task.status === 'done'}
                              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-money text-money hover:bg-money hover:text-white transition-colors disabled:opacity-40"
                            >
                              Complete Task
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>
              </div>

              <div
                id="workflow-history"
                className={`${workspaceMode === 'signoff' ? 'order-30' : 'hidden'} border-4 border-bauhaus-black bg-white`}
              >
                <div className="bg-bauhaus-black px-4 py-4 text-white">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">History & Signals</p>
                      <h3 className="mt-1 text-lg font-black text-white">Secondary operating trail</h3>
                      <p className="mt-1 text-sm font-medium text-white/70">
                        Workflow runs, shortlist audit history, and market-change alerts live here. Keep this collapsed while you work the active shortlist.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowHistoryPanels((prev) => !prev)}
                      className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors"
                    >
                      {showHistoryPanels ? 'Hide History & Signals' : 'Show History & Signals'}
                    </button>
                  </div>
                </div>
                {!showHistoryPanels ? (
                  <div className="px-4 py-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: 'Workflow Runs', value: workspace.workflowRuns.length, detail: latestWorkflowRun ? workflowLabel(latestWorkflowRun) : 'No runs yet' },
                        { label: 'Audit Events', value: workspace.recentEvents.length, detail: latestEvent ? eventTypeLabel(latestEvent.event_type) : 'No audit trail yet' },
                        { label: 'Open Alerts', value: workspace.alerts.filter((alert) => alert.status === 'open').length, detail: workspace.alerts.length > 0 ? 'Market watch and prompts available' : 'No active alerts' },
                      ].map((item) => (
                        <div key={item.label} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{item.label}</p>
                          <p className="mt-2 text-3xl font-black text-bauhaus-black">{item.value}</p>
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="border-4 border-bauhaus-black bg-white">
                        <div className="bg-bauhaus-blue px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Workflow Activity</p>
                          <h3 className="text-sm font-black text-white">Recent procurement runs</h3>
                        </div>
                        <div className="divide-y divide-bauhaus-black/10">
                          {workspace.workflowRuns.length === 0 ? (
                            <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                              No workflow history yet. Run discovery, enrichment, or a pack to seed your operating log.
                            </div>
                          ) : (
                            workspace.workflowRuns.map(run => (
                              <div key={run.id} className="px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">{run.workflow_type}</p>
                                    <p className="text-sm font-black text-bauhaus-black mt-1">{workflowLabel(run)}</p>
                                  </div>
                                  <span
                                    className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                                      run.workflow_status === 'completed'
                                        ? 'bg-money text-white'
                                        : run.workflow_status === 'blocked'
                                          ? 'bg-bauhaus-yellow text-bauhaus-black'
                                          : 'bg-bauhaus-red text-white'
                                    }`}
                                  >
                                    {run.workflow_status}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-bauhaus-muted">
                                  <span>{fmtDateTime(run.created_at)}</span>
                                  <span>{run.records_scanned} scanned</span>
                                  <span>{run.records_changed} changed</span>
                                  {run.error_count > 0 && <span>{run.error_count} errors</span>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div id="audit-history" className="border-4 border-bauhaus-black bg-white">
                        <div className="bg-bauhaus-red px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Audit Trail</p>
                          <h3 className="text-sm font-black text-white">Recent shortlist decisions</h3>
                        </div>
                        <div className="divide-y divide-bauhaus-black/10">
                          {workspace.recentEvents.length === 0 ? (
                            <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                              No shortlist history yet. Create a shortlist, add organisations, and change a note or decision to start the audit trail.
                            </div>
                          ) : (
                            workspace.recentEvents.map((event) => (
                              <div key={event.id} className="px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">{eventTypeLabel(event.event_type)}</p>
                                    <p className="text-sm font-black text-bauhaus-black mt-1">{event.event_summary}</p>
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                    {fmtDateTime(event.created_at)}
                                  </span>
                                </div>
                                {typeof event.payload?.supplier_name === 'string' && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/10 bg-bauhaus-canvas text-bauhaus-muted">
                                      {String(event.payload.supplier_name)}
                                    </span>
                                    {typeof event.payload?.next_decision_tag === 'string' && (
                                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${decisionTagBadgeClass(String(event.payload.next_decision_tag))}`}>
                                        {decisionTagLabel(String(event.payload.next_decision_tag))}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-4 border-bauhaus-black bg-white">
                      <div className="bg-money px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Market Alerts</p>
                        <h3 className="text-sm font-black text-white">Saved brief deltas and review prompts</h3>
                      </div>
                      <div className="divide-y divide-bauhaus-black/10">
                        {workspace.alerts.length === 0 ? (
                          <div className="px-4 py-6 text-sm font-medium text-bauhaus-muted">
                            No procurement alerts yet. Turn on a market watch or rerun the saved brief to generate change alerts here.
                          </div>
                        ) : (
                          workspace.alerts.map((alert) => (
                            <div key={alert.id} className="px-4 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${
                                      alert.severity === 'critical'
                                        ? 'border-bauhaus-red bg-error-light text-bauhaus-red'
                                        : alert.severity === 'warning'
                                          ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black'
                                          : 'border-money bg-money-light text-money'
                                    }`}>
                                      {alertTypeLabel(alert.alert_type)}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                                      {fmtDateTime(alert.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-black text-bauhaus-black mt-2">{alert.title}</p>
                                  {alert.body && (
                                    <p className="text-sm font-medium text-bauhaus-muted mt-1">{alert.body}</p>
                                  )}
                                </div>
                                {typeof alert.payload?.gs_id === 'string' && (
                                  <Link
                                    href={entityHref(String(alert.payload.gs_id))}
                                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
                                  >
                                    Open Dossier
                                  </Link>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {operationError && (
          <section className="order-15 border-4 border-bauhaus-red bg-red-50 px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Workflow Error</p>
            <p className="mt-2 text-sm font-bold text-bauhaus-black">{operationError}</p>
            {operationBlockers.length > 0 && (
              <ul className="mt-3 space-y-2">
                {operationBlockers.slice(0, 8).map((blocker) => (
                  <li key={blocker} className="text-sm font-medium text-bauhaus-black">
                    • {blocker}
                  </li>
                ))}
                {operationBlockers.length > 8 && (
                  <li className="text-sm font-medium text-bauhaus-black">
                    • {operationBlockers.length - 8} more blocker{operationBlockers.length - 8 === 1 ? '' : 's'} still need attention.
                  </li>
                )}
              </ul>
            )}
          </section>
        )}

        {operationNotice && (
          <section className="order-16 border-4 border-money bg-money-light px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-money">Workflow Update</p>
            <p className="mt-2 text-sm font-bold text-bauhaus-black">{operationNotice}</p>
          </section>
        )}

        {/* ═══ TAB: DISCOVER ═══ */}
        {tab === 'discover' && (
          <div id="discover-workbench" className="order-10">
            <h2 className="text-xl font-black mb-6">Find Suppliers by Capability & Geography</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* State */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">State</label>
                <select
                  value={discoverState}
                  onChange={e => setDiscoverState(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">All States</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* LGA */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">LGA / Region</label>
                <input
                  value={discoverLga}
                  onChange={e => setDiscoverLga(e.target.value)}
                  placeholder="e.g. Cairns, Torres"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>

              {/* Remoteness */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Remoteness</label>
                <select
                  value={discoverRemoteness}
                  onChange={e => setDiscoverRemoteness(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">Any</option>
                  {REMOTENESS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Entity types */}
            <div className="mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Supplier Types</label>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map(et => (
                  <button
                    key={et.value}
                    onClick={() => {
                      setDiscoverTypes(prev =>
                        prev.includes(et.value)
                          ? prev.filter(v => v !== et.value)
                          : [...prev, et.value]
                      );
                    }}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
                      discoverTypes.includes(et.value)
                        ? 'bg-bauhaus-black text-white'
                        : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
                    }`}
                  >
                    {et.label}
                  </button>
                ))}
                <button
                  onClick={() => setDiscoverCommunity(!discoverCommunity)}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
                    discoverCommunity
                      ? 'bg-bauhaus-red text-white'
                      : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
                  }`}
                >
                  Community Controlled Only
                </button>
              </div>
            </div>

            <button
              onClick={runDiscover}
              disabled={loading}
              className="px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search Suppliers'}
            </button>

            {/* Results */}
            {discoverResult?.summary && (
              <div className="mt-10">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-4 border-bauhaus-black mb-8">
                  {[
                    { val: discoverResult.summary.total_found, label: 'Suppliers Found' },
                    { val: discoverResult.summary.indigenous_businesses, label: 'Indigenous' },
                    { val: discoverResult.summary.social_enterprises, label: 'Social Enterprise' },
                    { val: discoverResult.summary.community_controlled, label: 'Community Controlled' },
                    { val: discoverResult.summary.with_federal_contracts, label: 'With Contracts' },
                  ].map((s, i) => (
                    <div key={s.label} className={`p-4 text-center ${i < 4 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                      <div className="text-2xl font-black">{s.val}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Supplier table */}
                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-black px-4 py-2 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Supplier Shortlist</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      discoverResult.suppliers.map(s => ({
                        name: s.canonical_name, abn: s.abn, entity_type: entityTypeLabel(s.entity_type),
                        state: s.state, postcode: s.postcode, lga: s.lga_name, remoteness: s.remoteness,
                        seifa_decile: s.seifa_irsd_decile, community_controlled: s.is_community_controlled,
                        revenue: s.latest_revenue, contracts: s.contracts.count, contract_value: s.contracts.total_value,
                      })), 'civicgraph-suppliers.csv'
                    )} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-4 border-bauhaus-black">
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Supplier</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Region</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Contracts</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">SEIFA</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Workspace</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discoverResult.suppliers.slice(0, 30).map((s: SupplierResult) => (
                          <tr key={s.gs_id} className="border-b border-bauhaus-black/10 hover:bg-bauhaus-canvas">
                            <td className="px-4 py-3">
                              <Link href={entityHref(s.gs_id)} className="font-bold text-bauhaus-black hover:text-bauhaus-red">
                                {s.canonical_name}
                              </Link>
                              {s.abn && <div className="text-xs text-bauhaus-muted">ABN {s.abn}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${entityTypeBadgeColor(s.entity_type)}`}>
                                {entityTypeLabel(s.entity_type)}
                              </span>
                              {s.is_community_controlled && (
                                <span className="ml-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-red text-white">CC</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-bauhaus-muted">
                              <div>{s.lga_name || s.state}</div>
                              {s.remoteness && s.remoteness !== 'Major Cities of Australia' && (
                                <div className="text-xs">{s.remoteness}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {s.contracts.count > 0 ? (
                                <div>
                                  <div className="font-black">{s.contracts.count}</div>
                                  <div className="text-xs text-bauhaus-muted">{fmtMoney(s.contracts.total_value)}</div>
                                </div>
                              ) : (
                                <span className="text-bauhaus-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {s.seifa_irsd_decile ? (
                                <span className={`font-black ${s.seifa_irsd_decile <= 3 ? 'text-bauhaus-red' : ''}`}>
                                  {s.seifa_irsd_decile}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => workspaceItemIds.has(s.gs_id) ? scrollToWorkspace() : addSupplierToWorkspace(s)}
                                disabled={workspaceItemIds.has(s.gs_id) ? false : !workspace?.canUseWorkspace || !canEditWorkspace || workspaceBusyId === s.gs_id}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-blue hover:text-white hover:border-bauhaus-blue transition-colors disabled:opacity-40"
                              >
                                {workspaceItemIds.has(s.gs_id)
                                  ? 'Open'
                                  : workspaceBusyId === s.gs_id
                                    ? 'Saving...'
                                    : 'Add'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: ENRICH ═══ */}
        {tab === 'enrich' && (
          <div id="enrich-workbench" className="order-10">
            <h2 className="text-xl font-black mb-2">Enrich Your Supplier List</h2>
            <p className="text-sm text-bauhaus-muted mb-6">
              Paste supplier names (one per line). Optionally add ABN after a comma.
              CivicGraph resolves each against the entity graph and returns ownership type,
              contract history, and compliance metadata.
            </p>

            <textarea
              value={enrichCsv}
              onChange={e => setEnrichCsv(e.target.value)}
              placeholder={'Supplier Name, ABN (optional)\nTorres Civil Group, 12345678901\nCape Infrastructure Services\nNorthern Community Works'}
              rows={8}
              className="w-full border-4 border-bauhaus-black p-4 text-sm font-mono bg-white placeholder:text-bauhaus-muted mb-4"
            />

            <button
              onClick={runEnrich}
              disabled={loading || !enrichCsv.trim()}
              className="px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {loading ? 'Enriching...' : 'Enrich Supplier List'}
            </button>

            {enrichResult?.summary && (
              <div className="mt-10">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-4 border-bauhaus-black mb-8">
                  {[
                    { val: enrichResult.summary.total_input, label: 'Input' },
                    { val: `${enrichResult.summary.resolution_rate}%`, label: 'Resolved' },
                    { val: enrichResult.summary.indigenous, label: 'Indigenous' },
                    { val: enrichResult.summary.with_contracts, label: 'With Contracts' },
                  ].map((s, i) => (
                    <div key={s.label} className={`p-4 text-center ${i < 3 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                      <div className="text-2xl font-black">{s.val}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Results table */}
                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-blue px-4 py-2 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Enriched Results</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      enrichResult.enriched.map((item: EnrichResult['enriched'][0]) => ({
                        input_name: item.input.name, input_abn: item.input.abn, resolved: item.resolved,
                        canonical_name: item.entity?.canonical_name, entity_type: item.entity ? entityTypeLabel(item.entity.entity_type) : '',
                        abn: item.entity?.abn, state: item.entity?.state, remoteness: item.entity?.remoteness,
                        community_controlled: item.entity?.is_community_controlled, contracts: item.contracts?.count,
                        contract_value: item.contracts?.total_value,
                      })), 'civicgraph-enriched.csv'
                    )} />
                  </div>
                  <div className="divide-y divide-bauhaus-black/10">
                    {enrichResult.enriched.map((item: EnrichResult['enriched'][0], i: number) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{item.input.name}</div>
                          {item.resolved && item.entity ? (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(item.entity.entity_type)}`}>
                                {entityTypeLabel(item.entity.entity_type)}
                              </span>
                              <span className="text-xs text-bauhaus-muted">{item.entity.state}</span>
                              {item.contracts.count > 0 && (
                                <span className="text-xs text-money font-bold">{item.contracts.count} contracts</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-bauhaus-red font-bold">Not found in entity graph</span>
                          )}
                        </div>
                        <div className={`w-3 h-3 rounded-full ${item.resolved ? 'bg-money' : 'bg-bauhaus-red'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: PACK ═══ */}
        {tab === 'pack' && (
          <div id="pack-workbench" className="order-10">
            <div className="print:hidden">
            <h2 className="text-xl font-black mb-2">Generate Intelligence Pack</h2>
            <p className="text-sm text-bauhaus-muted mb-6">
              Specify a region and optionally paste your existing supplier list.
              CivicGraph generates a full Tender Intelligence Pack with market overview,
              compliance analysis, shortlist, and recommended partners.
            </p>

            {workspace?.shortlist && (
              <div className="mb-6 border-4 border-bauhaus-black bg-white">
                <div className="bg-bauhaus-yellow px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/60">Decision Pack Flow</p>
                  <h3 className="text-sm font-black text-bauhaus-black">Use the active shortlist as your pack source</h3>
                </div>
                <div className="p-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div>
                    <p className="text-sm font-black text-bauhaus-black">
                      Active shortlist: {workspace.shortlist.name}
                    </p>
                    <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                      This will use the shortlist&apos;s saved market brief, the organisations currently in the shortlist, the decision brief above, and each supplier&apos;s review checklist and notes.
                    </p>
                    {workspace.shortlist.approval_lock_active ? (
                      <p className="mt-3 text-xs font-bold text-bauhaus-red">
                        This shortlist is approval-locked. Open the approved pack or reopen the shortlist before generating a new version.
                      </p>
                    ) : hasDecisionPackBlockers ? (
                      <div className="mt-3 border-2 border-bauhaus-red bg-error-light px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Pack Blockers</p>
                        <div className="mt-2 space-y-2">
                          {decisionPackBlockers.slice(0, 6).map((blocker) => (
                            <button
                              key={`${blocker.code}-${blocker.shortlist_item_id || blocker.target_field_id}`}
                              onClick={() => resolveDecisionPackBlocker(blocker)}
                              className="flex w-full items-start justify-between gap-3 border border-bauhaus-red/30 bg-white px-3 py-3 text-left hover:border-bauhaus-red"
                            >
                              <span className="text-sm font-medium text-bauhaus-black">• {blocker.message}</span>
                              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                                {blocker.action_label}
                              </span>
                            </button>
                          ))}
                        </div>
                        {decisionPackBlockers.length > 6 && (
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            + {decisionPackBlockers.length - 6} more blocker{decisionPackBlockers.length - 6 === 1 ? '' : 's'} still need attention.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-money">
                        Ready for export. The active shortlist has enough governance and evidence detail to generate a decision pack.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => runPack('decision')}
                        disabled={loading || hasDecisionPackBlockers || workspace.shortlist.approval_lock_active}
                        className="px-4 py-3 bg-bauhaus-red text-white font-black text-[10px] uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black transition-colors disabled:opacity-40"
                      >
                        {loading
                          ? 'Generating Pack...'
                          : workspace.shortlist.approval_lock_active
                            ? 'Approval Locked'
                            : hasDecisionPackBlockers
                              ? (firstDecisionPackBlocker?.action_label || 'Resolve Pack Blockers')
                              : 'Generate From Active Shortlist'}
                      </button>
                      {hasDecisionPackBlockers && (
                        <button
                          onClick={() => resolveDecisionPackBlocker(firstDecisionPackBlocker)}
                          className="px-4 py-3 bg-white text-bauhaus-black font-black text-[10px] uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          {firstDecisionPackBlocker?.shortlist_item_id ? 'Resolve In Supplier Row' : 'Resolve In Workspace'}
                        </button>
                      )}
                      {latestPackExport && (
                        <Link
                          href={`/tender-intelligence/exports/${latestPackExport.id}`}
                          className="px-4 py-3 bg-white text-bauhaus-black font-black text-[10px] uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          Open Latest Saved Pack
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Recent Pack History</p>
                    <div className="mt-3 space-y-3">
                      {workspace.packExports.length === 0 ? (
                        <p className="text-sm font-medium text-bauhaus-muted">
                          No saved decision packs yet. Generate one from the active shortlist to freeze the current recommendation and evidence state.
                        </p>
                      ) : (
                        workspace.packExports.slice(0, 3).map((packExport) => (
                          <div key={packExport.id} className="border-2 border-bauhaus-black bg-white px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-bauhaus-black">{packExport.title}</p>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                                {packVersionLabel(packExport)}
                              </span>
                              {workspace.shortlist?.approved_pack_export_id === packExport.id && (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-money bg-money-light text-money">
                                  Locked Approval
                                </span>
                              )}
                              {packExport.superseded_at && (
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-red/20 bg-error-light text-bauhaus-red">
                                  Superseded
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                              {fmtDateTime(packExport.created_at)} • {decisionCountsLabel(packExport.export_summary.decision_counts)} • {packGovernanceLabel({ packExport, shortlist: workspace.shortlist })}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                              <span>{String(packExport.export_summary.supplier_count || 0)} suppliers</span>
                              <span>{String(packExport.export_summary.reviewed_supplier_count || 0)} reviewed</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Link
                                href={`/tender-intelligence/exports/${packExport.id}`}
                                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                              >
                                Open Pack
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">State</label>
                <select
                  value={packState}
                  onChange={e => setPackState(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">All States</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">LGA / Region</label>
                <input
                  value={packLga}
                  onChange={e => setPackLga(e.target.value)}
                  placeholder="e.g. Cairns, Darwin"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Total Contract Value ($)</label>
                <input
                  value={packTotalValue}
                  onChange={e => setPackTotalValue(e.target.value)}
                  placeholder="e.g. 5000000"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                Existing Suppliers (optional — name, ABN, value per line)
              </label>
              <textarea
                value={packSuppliersCsv}
                onChange={e => setPackSuppliersCsv(e.target.value)}
                placeholder={'Supplier Name, ABN, Contract Value\nACME Corp, 12345678901, 500000\nLocal Services Pty Ltd, , 250000'}
                rows={5}
                className="w-full border-4 border-bauhaus-black p-4 text-sm font-mono bg-white placeholder:text-bauhaus-muted"
              />
            </div>

            <button
              onClick={() => runPack('form')}
              disabled={loading}
              className="px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating Pack...' : 'Generate Intelligence Pack'}
            </button>
            </div>

            {/* Pack Results */}
            {packResult?.pack?.sections && (
              <div id="pack-report" className="mt-10 space-y-8">
                <div className="hidden print:block mb-8">
                  <h1 className="text-3xl font-black uppercase tracking-widest mb-1">CivicGraph Tender Intelligence Pack</h1>
                  <p className="text-sm text-bauhaus-muted">
                    {[packResult.pack.filters?.state, packResult.pack.filters?.lga].filter(Boolean).join(' — ') || 'All Regions'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-bauhaus-muted font-bold">
                      Generated {new Date(packResult.pack.generated_at).toLocaleString('en-AU')}
                    </div>
                    {packResult.export?.id && (
                      <div className="text-xs font-bold text-bauhaus-muted">
                        Saved as a decision pack for the active shortlist.
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {packResult.export?.id && (
                      <Link
                        href={`/tender-intelligence/exports/${packResult.export.id}`}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
                      >
                        Open Saved Pack
                      </Link>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                    >
                      Save as PDF
                    </button>
                  </div>
                </div>

                {/* Section 1: Market Overview */}
                <div className="border-4 border-bauhaus-black">
                  <div className="bg-bauhaus-blue px-4 py-3">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">1. Market Capability Overview</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                    {[
                      { val: packResult.pack.sections.market_overview.suppliers_identified, label: 'Suppliers Found' },
                      { val: packResult.pack.sections.market_overview.indigenous_businesses, label: 'Indigenous' },
                      { val: packResult.pack.sections.market_overview.social_enterprises, label: 'Social Enterprise' },
                      { val: packResult.pack.sections.market_overview.with_federal_contracts, label: 'With Contracts' },
                    ].map((s, i) => (
                      <div key={s.label} className={`p-5 text-center ${i < 3 ? 'border-r-4 border-bauhaus-black' : ''} border-b-4 border-bauhaus-black`}>
                        <div className="text-3xl font-black">{s.val}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-black">{packResult.pack.sections.market_overview.community_controlled}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Community Controlled</div>
                    </div>
                    <div>
                      <div className="text-lg font-black">{packResult.pack.sections.market_overview.charities}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Charities</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-money">{fmtMoney(packResult.pack.sections.market_overview.total_contract_value)}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Total Contract Value</div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Compliance Analysis */}
                {packResult.pack.sections.compliance_analysis && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-bauhaus-red px-4 py-3">
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">2. Procurement Compliance</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="border-4 border-bauhaus-black p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-black uppercase tracking-widest">Indigenous</span>
                            <span className={`text-xs font-black px-2 py-0.5 ${
                              packResult.pack.sections.compliance_analysis.indigenous.meets_target
                                ? 'bg-money text-white' : 'bg-bauhaus-red text-white'
                            }`}>
                              {packResult.pack.sections.compliance_analysis.indigenous.meets_target ? 'MEETS TARGET' : 'BELOW TARGET'}
                            </span>
                          </div>
                          <div className="text-3xl font-black">{packResult.pack.sections.compliance_analysis.indigenous.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">Target: 3% | {packResult.pack.sections.compliance_analysis.indigenous.count} suppliers</div>
                          {packResult.pack.sections.compliance_analysis.indigenous.shortfall_value > 0 && (
                            <div className="text-xs text-bauhaus-red font-bold mt-1">
                              Shortfall: {fmtMoney(packResult.pack.sections.compliance_analysis.indigenous.shortfall_value)}
                            </div>
                          )}
                        </div>
                        <div className="border-4 border-bauhaus-black p-4">
                          <span className="text-xs font-black uppercase tracking-widest">Social Enterprise</span>
                          <div className="text-3xl font-black mt-2">{packResult.pack.sections.compliance_analysis.social_enterprise.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">{packResult.pack.sections.compliance_analysis.social_enterprise.count} suppliers</div>
                        </div>
                        <div className="border-4 border-bauhaus-black p-4">
                          <span className="text-xs font-black uppercase tracking-widest">Regional</span>
                          <div className="text-3xl font-black mt-2">{packResult.pack.sections.compliance_analysis.regional.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">{packResult.pack.sections.compliance_analysis.regional.count} suppliers</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Supplier Shortlist */}
                <div className="border-4 border-bauhaus-black">
                  <div className="bg-bauhaus-black px-4 py-3 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">3. Supplier Shortlist</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      packResult.pack.sections.supplier_shortlist.map((s: { name: string; abn: string | null; entity_type: string; state: string | null; lga: string | null; revenue: number | null; contracts: { count: number; total_value: number }; is_community_controlled: boolean }) => ({
                        name: s.name, abn: s.abn, entity_type: entityTypeLabel(s.entity_type),
                        state: s.state, lga: s.lga, community_controlled: s.is_community_controlled,
                        revenue: s.revenue, contracts: s.contracts.count, contract_value: s.contracts.total_value,
                      })), 'civicgraph-pack-shortlist.csv'
                    )} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Supplier</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Region</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Contracts</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packResult.pack.sections.supplier_shortlist.map((s: { gs_id: string; name: string; abn: string | null; entity_type: string; state: string | null; lga: string | null; revenue: number | null; contracts: { count: number; total_value: number }; is_community_controlled: boolean }) => (
                          <tr key={s.gs_id} className="border-b border-bauhaus-black/10 hover:bg-bauhaus-canvas">
                            <td className="px-4 py-3">
                              <Link href={entityHref(s.gs_id)} className="font-bold hover:text-bauhaus-red">{s.name}</Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(s.entity_type)}`}>
                                {entityTypeLabel(s.entity_type)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-bauhaus-muted">{s.lga || s.state}</td>
                            <td className="px-4 py-3 text-right font-black tabular-nums">{s.contracts.count || '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-bauhaus-muted">
                              {s.revenue ? fmtMoney(s.revenue) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Bid Strength */}
                {packResult.pack.sections.bid_strength.insights.length > 0 && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-bauhaus-yellow px-4 py-3">
                      <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-[0.2em]">4. Bid Strength Analysis</h3>
                    </div>
                    <div className="p-6 space-y-3">
                      {packResult.pack.sections.bid_strength.insights.map((insight: string, i: number) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-bauhaus-yellow font-black shrink-0">&#9654;</span>
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: Recommended Partners */}
                {packResult.pack.sections.recommended_partners.length > 0 && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-money px-4 py-3">
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">5. Recommended Partners</h3>
                    </div>
                    <div className="divide-y divide-bauhaus-black/10">
                      {packResult.pack.sections.recommended_partners.map((r: { gs_id: string; name: string; abn: string | null; entity_type: string; state: string | null; remoteness: string | null; is_community_controlled: boolean; contracts: { count: number; total_value: number }; revenue: number | null; gap_type?: string }, i: number) => (
                        <div key={r.gs_id || i} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <Link href={entityHref(r.gs_id)} className="font-bold text-sm hover:text-bauhaus-red">
                              {r.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(r.entity_type)}`}>
                                {entityTypeLabel(r.entity_type)}
                              </span>
                              <span className="text-xs text-bauhaus-muted">{r.state}</span>
                              {r.contracts.count > 0 && (
                                <span className="text-xs font-bold text-money">{r.contracts.count} contracts ({fmtMoney(r.contracts.total_value)})</span>
                              )}
                            </div>
                          </div>
                          {r.revenue && (
                            <span className="text-sm font-bold tabular-nums">{fmtMoney(r.revenue)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
