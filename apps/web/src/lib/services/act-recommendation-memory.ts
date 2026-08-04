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

export interface RecommendationPriorCase {
  id: string;
  decision: OrgOpportunityDecision['decision'];
  label: string;
  decidedAt: string;
  summary: string;
}

export interface RecommendationDecisionOutcome {
  decisionId: string | null;
  happenedAt?: string | null;
  metadata: unknown;
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
  return matchingDecisionsFor(record, decisions)[0] ?? null;
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
  const kind = String(decision.decision);
  if (kind === 'review') return 'Prior review';
  if (kind === 'no' || kind === 'lost') return 'Past no';
  if (kind === 'later') return 'Parked before';
  if (kind === 'more_info') return 'Proof requested';
  if (kind === 'apply') return 'Application accepted';
  if (kind === 'partner') return 'Relationship accepted';
  if (kind === 'research') return 'Research accepted';
  if (kind === 'send_to_ghl') return 'GHL planned';
  return 'Won before';
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function judgmentFor(decision: OrgOpportunityDecision): Record<string, unknown> {
  const withJudgment = decision as OrgOpportunityDecision & { judgment?: unknown };
  return objectValue(withJudgment.judgment) ?? {};
}

function promiseOrReturnFor(judgment: Record<string, unknown>): string | null {
  const action = objectValue(judgment.commitment);
  if (!action) return null;
  const kind = textValue(action.kind) === 'return' ? 'Return' : 'Commitment';
  const owner = textValue(action.owner);
  const detail = textValue(action.action);
  if (!detail) return null;
  return owner ? `${kind} — ${owner}: ${detail}` : `${kind} — ${detail}`;
}

function linkedOutcomeFor(
  decisionId: string,
  outcomes: RecommendationDecisionOutcome[],
): string | null {
  const latest = outcomes
    .filter((outcome) => outcome.decisionId === decisionId)
    .sort((left, right) => String(right.happenedAt ?? '').localeCompare(String(left.happenedAt ?? '')))[0];
  return textValue(objectValue(latest?.metadata)?.what_happened);
}

function priorCaseSummary(
  decision: OrgOpportunityDecision,
  outcomes: RecommendationDecisionOutcome[],
): string {
  const judgment = judgmentFor(decision);
  const whatChanged = textValue(judgment.whatChanged) ?? decision.reason ?? decisionMemoryLabel(decision);
  const promiseOrReturn = promiseOrReturnFor(judgment);
  const whatHappened = linkedOutcomeFor(decision.id, outcomes);
  const nextQuestion = textValue(judgment.nextLearningQuestion) ?? decision.evidence_gaps[0] ?? null;
  const facts = [
    `What changed: ${compact(whatChanged)}`,
    promiseOrReturn ? `Promise / return: ${compact(promiseOrReturn)}` : null,
    `What happened: ${whatHappened ? compact(whatHappened) : 'Not recorded yet'}`,
    nextQuestion ? `Next question: ${compact(nextQuestion)}` : null,
  ].filter((fact): fact is string => Boolean(fact));
  return facts.join(' · ');
}

export function matchingDecisionsFor<T extends RecommendationMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
): OrgOpportunityDecision[] {
  return (decisions ?? [])
    .filter((decision) => decisionMatchesRecord(decision, record))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function priorCasesFor<T extends RecommendationMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
  outcomes: RecommendationDecisionOutcome[] = [],
): RecommendationPriorCase[] {
  return matchingDecisionsFor(record, decisions).map((decision) => ({
    id: decision.id,
    decision: decision.decision,
    label: decisionMemoryLabel(decision),
    decidedAt: decision.created_at,
    summary: priorCaseSummary(decision, outcomes),
  }));
}

export function applyDecisionMemory<T extends RecommendationMemoryRecord>(
  record: T,
  decisions: OrgOpportunityDecision[] | undefined,
  outcomes: RecommendationDecisionOutcome[] = [],
): T & { priorCases: RecommendationPriorCase[] } {
  return {
    ...record,
    priorCases: priorCasesFor(record, decisions, outcomes),
  };
}
