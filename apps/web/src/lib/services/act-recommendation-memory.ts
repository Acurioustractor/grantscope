import type { OrgOpportunityDecision } from '@/lib/services/org-dashboard-service';

export type RecommendationReadiness = 'ready' | 'needs_proof' | 'needs_applicant' | 'needs_relationship' | 'park';
export type RecommendationMove = 'apply_now' | 'approach_now' | 'ask_for_intro' | 'build_proof_pack' | 'watch' | 'park';

export interface RecommendationMemoryRecord {
  sourceType: string;
  sourceRef: string;
  projectCode: string;
  pathway: string;
  readiness: RecommendationReadiness;
  recommendedMove: RecommendationMove;
  confidence: number;
  reason: string;
  evidenceGaps: string[];
  tags: string[];
}

export interface RelationshipMemoryRecord {
  id: string;
  signalAt: string | null;
}

function compact(text: string | null | undefined, fallback = 'Not set'): string {
  const value = text?.trim();
  if (!value) return fallback;
  return value.length > 150 ? `${value.slice(0, 147)}...` : value;
}

export function movePriority(move: RecommendationMove): number {
  if (move === 'apply_now') return 0;
  if (move === 'approach_now') return 1;
  if (move === 'ask_for_intro') return 2;
  if (move === 'build_proof_pack') return 3;
  if (move === 'watch') return 4;
  return 5;
}

export function decisionMatchesRecord(decision: OrgOpportunityDecision, record: RecommendationMemoryRecord): boolean {
  if (decision.source_type !== record.sourceType) return false;
  if (decision.source_ref !== record.sourceRef) return false;
  if (decision.project_code && decision.project_code !== record.projectCode) return false;
  if (decision.pathway && decision.pathway !== record.pathway) return false;
  return true;
}

export function latestDecisionFor<T extends RecommendationMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
): OrgOpportunityDecision | null {
  return (decisions ?? []).find((decision) => decisionMatchesRecord(decision, record)) ?? null;
}

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function latestRelationshipDecisionFor<T extends RelationshipMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
): OrgOpportunityDecision | null {
  const sourceRef = record.id.replace(/^context:/, '');
  const signalAt = validTimestamp(record.signalAt);

  return (decisions ?? []).find((decision) => {
    if (decision.source_type !== 'crm' || decision.source_ref !== sourceRef) return false;
    const decidedAt = validTimestamp(decision.created_at);
    return signalAt === null || decidedAt === null || decidedAt >= signalAt;
  }) ?? null;
}

export function relationshipActionHandled<T extends RelationshipMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
): boolean {
  const decision = latestRelationshipDecisionFor(record, decisions);
  return decision !== null && decision.decision !== 'more_info';
}

export function decisionMemoryLabel(decision: OrgOpportunityDecision): string {
  if (decision.decision === 'no' || decision.decision === 'lost') return 'Past no';
  if (decision.decision === 'later') return 'Parked before';
  if (decision.decision === 'more_info') return 'Proof requested';
  if (decision.decision === 'apply') return 'Application accepted';
  if (decision.decision === 'partner') return 'Relationship accepted';
  if (decision.decision === 'research') return 'Research accepted';
  if (decision.decision === 'send_to_ghl') return 'GHL planned';
  return 'Won before';
}

export function applyDecisionMemory<T extends RecommendationMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
): T {
  const latest = latestDecisionFor(record, decisions);
  if (!latest) return record;

  const baseReason = `${record.reason} Learning memory: ${decisionMemoryLabel(latest).toLowerCase()}${
    latest.reason ? ` (${compact(latest.reason, 'decision reason')})` : ''
  }.`;
  const baseTags = [...record.tags, `memory:${latest.decision}`];
  const decisionGaps = latest.evidence_gaps?.length ? latest.evidence_gaps : [];

  if (latest.decision === 'no' || latest.decision === 'lost') {
    return {
      ...record,
      readiness: 'park',
      recommendedMove: 'park',
      confidence: Math.max(20, record.confidence - 35),
      reason: baseReason,
      evidenceGaps: decisionGaps.length ? decisionGaps : record.evidenceGaps,
      tags: baseTags,
    };
  }

  if (latest.decision === 'later') {
    return {
      ...record,
      recommendedMove: 'watch',
      confidence: Math.max(20, record.confidence - 18),
      reason: baseReason,
      tags: baseTags,
    };
  }

  if (latest.decision === 'more_info') {
    return {
      ...record,
      readiness: 'needs_proof',
      recommendedMove: 'build_proof_pack',
      confidence: Math.max(20, record.confidence - 8),
      reason: baseReason,
      evidenceGaps: Array.from(new Set([...record.evidenceGaps, ...decisionGaps])),
      tags: baseTags,
    };
  }

  if (latest.decision === 'apply') {
    return {
      ...record,
      readiness: 'ready',
      recommendedMove: 'apply_now',
      confidence: Math.min(95, record.confidence + 12),
      reason: baseReason,
      tags: baseTags,
    };
  }

  if (latest.decision === 'partner' || latest.decision === 'send_to_ghl') {
    return {
      ...record,
      readiness: record.readiness === 'park' ? 'needs_relationship' : record.readiness,
      recommendedMove: 'approach_now',
      confidence: Math.min(95, record.confidence + 10),
      reason: baseReason,
      tags: baseTags,
    };
  }

  if (latest.decision === 'research' || latest.decision === 'won') {
    return {
      ...record,
      confidence: Math.min(95, record.confidence + 8),
      reason: baseReason,
      tags: baseTags,
    };
  }

  return record;
}
