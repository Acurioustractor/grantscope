export const ACT_PIPELINE_STATUSES = [
  'prospect',
  'upcoming',
  'researching',
  'pursuing',
  'applied',
  'submitted',
  'waiting',
  'won',
  'lost',
  'passed',
  'parked',
  'declined',
  'archived',
] as const;

export type ActPipelineStatus = (typeof ACT_PIPELINE_STATUSES)[number];
export type PipelineLearningDecision = 'no' | 'later' | 'research' | 'partner' | 'apply' | 'won' | 'lost';

export interface PipelineActionRecommendation {
  recommendedMove: string;
  relationshipName?: string | null;
  evidenceGaps?: string[];
}

const DISCOVERY_STATUSES = new Set<ActPipelineStatus>(['prospect', 'upcoming']);
const TERMINAL_STATUSES = new Set<ActPipelineStatus>(['won', 'lost', 'passed', 'parked', 'declined', 'archived']);
const OUTCOME_REASON_STATUSES = new Set<ActPipelineStatus>(['won', 'lost', 'passed', 'parked', 'declined']);
const PARTNER_PATHWAYS = new Set(['foundation', 'procurement', 'buyer', 'capital', 'relationship']);

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isActPipelineStatus(value: string): value is ActPipelineStatus {
  return ACT_PIPELINE_STATUSES.includes(value as ActPipelineStatus);
}

export function pipelineStatusRequiresReason(status: string): boolean {
  return isActPipelineStatus(status) && OUTCOME_REASON_STATUSES.has(status);
}

export function pipelineLearningDecision(
  status: string,
  pathway: string | null | undefined,
): PipelineLearningDecision | null {
  if (!isActPipelineStatus(status)) return null;
  if (status === 'won') return 'won';
  if (status === 'lost' || status === 'declined') return 'lost';
  if (status === 'passed') return 'no';
  if (status === 'parked' || status === 'archived') return 'later';
  if (status === 'researching' || status === 'prospect' || status === 'upcoming') return 'research';
  if (PARTNER_PATHWAYS.has(pathway ?? '')) return 'partner';
  return status === 'pursuing' || status === 'applied' || status === 'submitted' || status === 'waiting'
    ? 'apply'
    : null;
}

export function isWorkingPipelineItem(
  item: { status: string; created_at: string | null; deadline: string | null },
  now = new Date(),
): boolean {
  if (!isActPipelineStatus(item.status)) return true;
  if (TERMINAL_STATUSES.has(item.status)) return false;
  if (!DISCOVERY_STATUSES.has(item.status)) return true;

  const createdAt = timestamp(item.created_at);
  const deadline = timestamp(item.deadline);
  const recentEnough = createdAt !== null && now.getTime() - createdAt <= 30 * 86_400_000;
  const stillOpen = deadline === null || deadline >= now.getTime() - 86_400_000;
  return recentEnough && stillOpen;
}

export function pipelineWorkPriority(item: {
  status: string;
  source_type: string | null;
  deadline: string | null;
  updated_at: string | null;
}): number {
  if (item.source_type) return 0;
  if (item.status === 'submitted' || item.status === 'applied' || item.status === 'waiting') return 1;
  if (item.status === 'pursuing') return 2;
  if (item.status === 'researching') return 3;
  if (timestamp(item.deadline) !== null) return 4;
  return 5;
}

export function comparePipelineWork(
  left: { status: string; source_type: string | null; deadline: string | null; updated_at: string | null },
  right: { status: string; source_type: string | null; deadline: string | null; updated_at: string | null },
): number {
  const priority = pipelineWorkPriority(left) - pipelineWorkPriority(right);
  if (priority !== 0) return priority;

  const leftDeadline = timestamp(left.deadline) ?? Number.POSITIVE_INFINITY;
  const rightDeadline = timestamp(right.deadline) ?? Number.POSITIVE_INFINITY;
  if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;

  return (timestamp(right.updated_at) ?? 0) - (timestamp(left.updated_at) ?? 0);
}

export function pipelineNeedsPlan(item: {
  owner_name: string | null;
  next_action: string | null;
  next_action_at: string | null;
}): boolean {
  return !item.owner_name?.trim() || !item.next_action?.trim() || !item.next_action_at;
}

export function pipelineNeedsAttention(
  item: {
    status: string;
    deadline: string | null;
    next_action_at: string | null;
  },
  now = new Date(),
): boolean {
  if (['applied', 'submitted', 'waiting'].includes(item.status.toLowerCase())) return false;
  if (['pursuing', 'researching'].includes(item.status.toLowerCase())) return true;

  const attentionBy = now.getTime() + 30 * 86_400_000;
  const nextActionAt = timestamp(item.next_action_at);
  const deadline = timestamp(item.deadline);
  return (nextActionAt !== null && nextActionAt <= attentionBy)
    || (deadline !== null && deadline <= attentionBy && deadline >= now.getTime() - 7 * 86_400_000);
}

export function pipelineSuggestedNextAction(
  item: {
    name: string;
    next_action: string | null;
    funder: string | null;
    grant_provider: string | null;
  },
  recommendation?: PipelineActionRecommendation | null,
): string {
  if (item.next_action?.trim()) return item.next_action.trim();

  const target = recommendation?.relationshipName?.trim()
    || item.funder?.trim()
    || item.grant_provider?.trim()
    || 'the opportunity owner';

  if (recommendation?.recommendedMove === 'ask_for_intro') {
    return `Find a warm introduction to ${target}.`;
  }
  if (recommendation?.recommendedMove === 'approach_now') {
    return `Contact ${target} and confirm the best path forward.`;
  }
  if (recommendation?.recommendedMove === 'build_proof_pack') {
    const gap = recommendation.evidenceGaps?.find((value) => value.trim());
    return gap ? `Assemble the ${gap} needed for this opportunity.` : 'Confirm and assemble the missing evidence.';
  }
  if (recommendation?.recommendedMove === 'apply_now') {
    return 'Confirm the application owner, milestones, and submission date.';
  }
  return `Confirm the next decision with ${target}.`;
}
