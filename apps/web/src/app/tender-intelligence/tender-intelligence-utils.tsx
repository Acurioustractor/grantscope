import { decisionTagLabel } from '@/lib/procurement-shortlist';
import type { PackReadinessBlocker } from '@/lib/procurement-pack-readiness';
import type {
  TabKey,
  WorkflowStage,
  WorkspaceMode,
  SupplierResult,
  DiscoverResult,
  EnrichResult,
  PackResult,
  ReviewChecklist,
  ShortlistRecord,
  ShortlistSummary,
  WorkspaceEvent,
  WorkflowRun,
  ProcurementTask,
  ProcurementAlert,
  ProcurementNotification,
  ProcurementComment,
  NotificationChannel,
  DeliveryLogEntry,
  TeamMember,
  ProcurementPermissions,
  PackExportSummary,
  ChannelHealth,
} from './tender-intelligence-types';

export function humanJoin(values: string[]) {
  const filtered = values.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

export function looksPlaceholderCopy(value: string | null | undefined) {
  if (!value) return false;
  return /\b(test|testing|tesing|tbd|todo|placeholder|lorem|asdf|rad)\b/i.test(value);
}

export function nextDateInputValue(daysAhead = 7) {
  const next = new Date();
  next.setDate(next.getDate() + daysAhead);
  return next.toISOString().slice(0, 10);
}

export function shortlistBriefSummary(filters: Record<string, unknown>, items: ShortlistRecord[]) {
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

export function checklistMissingLabels(checklist: ReviewChecklist) {
  const labels: Array<{ key: keyof ReviewChecklist; label: string }> = [
    { key: 'fit', label: 'supplier fit' },
    { key: 'risk_checked', label: 'risk review' },
    { key: 'evidence_checked', label: 'evidence review' },
    { key: 'decision_made', label: 'decision capture' },
  ];
  return labels.filter((entry) => !checklist[entry.key]).map((entry) => entry.label);
}

export function buildSuggestedDecisionBrief(params: {
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

export function buildSuggestedSupplierNote(params: {
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

export function buildSuggestedSupplierComment(params: {
  item: ShortlistRecord;
  blockers: PackReadinessBlocker[];
}) {
  const checklist = normalizeChecklist(params.item.review_checklist);
  const missingChecks = checklistMissingLabels(checklist);
  const blockerHint = params.blockers.find((blocker) => blocker.code !== 'missing_note' && blocker.code !== 'placeholder_note');

  return `Review checkpoint: ${params.item.supplier_name} remains ${decisionTagLabel(params.item.decision_tag).toLowerCase()}. ${missingChecks.length > 0 ? `Still to confirm ${humanJoin(missingChecks)}.` : 'Checklist coverage is in place.'} ${blockerHint ? `Main gap: ${blockerHint.message.replace(`${params.item.supplier_name}: `, '')}` : `Latest evidence confidence is ${confidenceLabel(params.item.provenance?.confidence).toLowerCase()}.`}`;
}

export function buildSuggestedTaskDraft(params: {
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

export function buildSuggestedCompletionNote(params: {
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

export function buildSuggestedApprovalNote(params: {
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

export function buildSuggestedSignoffComment(params: {
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

export function isDiscoverResult(value: unknown): value is DiscoverResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DiscoverResult>;
  return Array.isArray(candidate.suppliers) && !!candidate.summary && typeof candidate.summary.total_found === 'number';
}

export function isEnrichResult(value: unknown): value is EnrichResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnrichResult>;
  return Array.isArray(candidate.enriched) && !!candidate.summary && typeof candidate.summary === 'object';
}

export function isPackResult(value: unknown): value is PackResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PackResult>;
  return !!candidate.pack && typeof candidate.pack.generated_at === 'string' && !!candidate.pack.sections;
}

export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
export const ENTITY_TYPES = [
  { value: 'indigenous_corp', label: 'Indigenous Business' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'charity', label: 'Charity / NFP' },
  { value: 'company', label: 'Company' },
];
export const REMOTENESS = [
  'Major Cities of Australia',
  'Inner Regional Australia',
  'Outer Regional Australia',
  'Remote Australia',
  'Very Remote Australia',
];

export const WORKFLOW_STAGES: Array<{
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

export const WORKSPACE_MODES: Array<{
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

export function fmtMoney(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function workflowLabel(run: WorkflowRun) {
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

export function entityTypeLabel(t: string) {
  return {
    indigenous_corp: 'Indigenous',
    social_enterprise: 'Social Enterprise',
    charity: 'Charity',
    company: 'Company',
    foundation: 'Foundation',
    government_body: 'Government',
  }[t] || t;
}

export function entityTypeBadgeColor(t: string) {
  return {
    indigenous_corp: 'bg-bauhaus-yellow text-bauhaus-black',
    social_enterprise: 'bg-money text-white',
    charity: 'bg-bauhaus-blue text-white',
    company: 'bg-bauhaus-black/60 text-white',
  }[t] || 'bg-bauhaus-muted text-white';
}

export function entityTypeFilterLabel(value: string) {
  return ENTITY_TYPES.find((option) => option.value === value)?.label || entityTypeLabel(value);
}

export function getSavedSearchPills(filters: Record<string, unknown>) {
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

export function confidenceBadgeColor(confidence: string | null | undefined) {
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

export function confidenceLabel(confidence: string | null | undefined) {
  if (!confidence) return 'Unscored';
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export function normalizeChecklist(value: Partial<ReviewChecklist> | Record<string, unknown> | null | undefined): ReviewChecklist {
  return {
    fit: value?.fit === true,
    risk_checked: value?.risk_checked === true,
    evidence_checked: value?.evidence_checked === true,
    decision_made: value?.decision_made === true,
  };
}

export function reviewChecklistCount(checklist: ReviewChecklist) {
  return Object.values(checklist).filter(Boolean).length;
}

export function decisionCountsLabel(value: unknown) {
  if (!value || typeof value !== 'object') return 'No decision counts';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .slice(0, 4)
    .map(([key, count]) => `${decisionTagLabel(key === 'untriaged' ? null : key)} ${count}`);
  return entries.length > 0 ? entries.join(' • ') : 'No decision counts';
}

export function eventTypeLabel(eventType: WorkspaceEvent['event_type']) {
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

export function isTabKey(value: string | null): value is TabKey {
  return value === 'discover' || value === 'enrich' || value === 'pack';
}

export function sortShortlistItems(items: ShortlistRecord[]) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.updated_at).getTime();
    const timeB = new Date(b.updated_at).getTime();
    return timeB - timeA;
  });
}

export function taskPriorityRank(priority: ProcurementTask['priority']) {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }[priority];
}

export function sortTasks(tasks: ProcurementTask[]) {
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

export function buildDecisionCounts(items: ShortlistRecord[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.decision_tag || 'untriaged';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function taskPriorityBadgeClass(priority: ProcurementTask['priority']) {
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

export function taskStatusBadgeClass(status: ProcurementTask['status']) {
  switch (status) {
    case 'done':
      return 'border-money bg-money-light text-money';
    case 'in_progress':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black';
  }
}

export function taskStatusLabel(status: ProcurementTask['status']) {
  return {
    open: 'Open',
    in_progress: 'In Progress',
    done: 'Done',
  }[status];
}

export function taskTypeLabel(taskType: ProcurementTask['task_type']) {
  return {
    review_alert: 'Review Alert',
    follow_up: 'Follow Up',
    evidence_check: 'Evidence Check',
    pack_refresh: 'Pack Refresh',
  }[taskType];
}

export function teamMemberLabel(member: TeamMember | null | undefined) {
  if (!member) return 'Unassigned';
  return member.display_name || member.full_name || member.email || 'Unknown user';
}

export function procurementRoleLabel(role: TeamMember['procurement_role'] | string | null | undefined) {
  return {
    lead: 'Lead',
    reviewer: 'Reviewer',
    approver: 'Approver',
    observer: 'Observer',
  }[role || ''] || 'Observer';
}

export function permissionLabel(permission: keyof ProcurementPermissions) {
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

export function notificationModeLabel(mode: TeamMember['notification_mode'] | ProcurementNotification['delivery_mode'] | string | null | undefined) {
  return {
    immediate: 'Immediate',
    daily_digest: 'Daily Digest',
    none: 'Muted',
  }[mode || ''] || 'Immediate';
}

export function approvalStatusLabel(status: ShortlistSummary['approval_status']) {
  return {
    draft: 'Draft',
    review_ready: 'Review Ready',
    submitted: 'Submitted',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
  }[status];
}

export function approvalStatusClass(status: ShortlistSummary['approval_status']) {
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

export function alertTypeLabel(alertType: ProcurementAlert['alert_type']) {
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

export function commentTypeLabel(commentType: ProcurementComment['comment_type']) {
  return {
    discussion: 'Discussion',
    submission: 'Submission',
    approval: 'Approval',
    changes_requested: 'Changes Requested',
    supplier_review: 'Supplier Review',
  }[commentType];
}

export function commentTypeClass(commentType: ProcurementComment['comment_type']) {
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

export function notificationTypeLabel(type: ProcurementNotification['notification_type'] | string) {
  return {
    task_due: 'Task Due',
    task_escalated: 'Task Escalated',
    signoff_submitted: 'Sign-Off Submitted',
    signoff_approved: 'Sign-Off Approved',
    signoff_changes_requested: 'Changes Requested',
  }[type] || String(type).replace(/_/g, ' ');
}

export function notificationTypeClass(type: ProcurementNotification['notification_type']) {
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

export function notificationStatusClass(status: ProcurementNotification['status']) {
  switch (status) {
    case 'sent':
      return 'border-money bg-money-light text-money';
    case 'cancelled':
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
    default:
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
  }
}

export function deliveryLogStatusClass(status: DeliveryLogEntry['status']) {
  return status === 'processed'
    ? 'border-money bg-money-light text-money'
    : 'border-bauhaus-red bg-error-light text-bauhaus-red';
}

export function channelVerificationClass(status: NotificationChannel['verification_status']) {
  switch (status) {
    case 'passed':
      return 'border-money bg-money-light text-money';
    case 'failed':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

export function channelVerificationLabel(status: NotificationChannel['verification_status']) {
  return {
    untested: 'Untested',
    passed: 'Verified',
    failed: 'Failed',
  }[status];
}

export function packVersionLabel(packExport: PackExportSummary | null | undefined) {
  if (!packExport?.version_number) return 'V1';
  return `V${packExport.version_number}`;
}

export function freshnessReferenceDate(item: ShortlistRecord) {
  return item.provenance?.entity_updated_at || item.provenance?.last_seen || item.last_reviewed_at || null;
}

export function freshnessTone(item: ShortlistRecord) {
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

export function freshnessLabel(item: ShortlistRecord) {
  const referenceDate = freshnessReferenceDate(item);
  if (!referenceDate) return 'Freshness unknown';
  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 'Fresh this month';
  if (ageDays <= 90) return 'Aging evidence';
  return 'Needs refresh';
}

export function taskOutcomeLabel(outcome: ProcurementTask['completion_outcome']) {
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

export function taskOutcomeClass(outcome: ProcurementTask['completion_outcome']) {
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

export const TASK_COMPLETION_OPTIONS: Array<{
  value: NonNullable<ProcurementTask['completion_outcome']>;
  label: string;
}> = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'approved_to_proceed', label: 'Approved To Proceed' },
  { value: 'follow_up_required', label: 'Needs Follow Up' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'excluded', label: 'Excluded' },
];

export function packGovernanceLabel(params: {
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

export function reminderSummary(task: ProcurementTask) {
  if (task.reminder_count <= 0) return null;
  const parts = [`Reminder ${task.reminder_count}`];
  if (task.last_reminded_at) {
    parts.push(`last sent ${fmtDateTime(task.last_reminded_at)}`);
  }
  return parts.join(' • ');
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function buildEvidenceSnapshot(item: ShortlistRecord) {
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

export function deriveEvidenceConfidence(item: ShortlistRecord) {
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

export function buildPreparedEvidenceSnapshot(item: ShortlistRecord) {
  const base = buildEvidenceSnapshot(item);
  return {
    ...base,
    confidence: deriveEvidenceConfidence(item) || base.confidence,
    last_verified_at: item.provenance?.entity_updated_at || item.provenance?.last_seen || null,
  };
}

export function buildPreparedReviewChecklist(item: ShortlistRecord): ReviewChecklist {
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

export function tabSectionId(tab: TabKey) {
  return {
    discover: 'discover-workbench',
    enrich: 'enrich-workbench',
    pack: 'pack-workbench',
  }[tab];
}

export function publicTabSectionId(tab: TabKey) {
  return {
    discover: 'discover',
    enrich: 'enrich',
    pack: 'pack',
  }[tab];
}

export function workspaceRoleLabel(role: string | null | undefined) {
  return {
    lead: 'Procurement Lead',
    reviewer: 'Reviewer',
    approver: 'Approver',
    observer: 'Observer',
  }[role || ''] || 'Observer';
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
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

export function ExportButton({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors"
    >
      {label}
    </button>
  );
}

