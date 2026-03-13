import { getServiceSupabase } from '@/lib/supabase';
import type {
  GovernedProofBundle,
  GovernedProofBundleRecord,
  GovernedProofPromotionStatus,
  GovernedProofReviewStatus,
  GovernedProofRun,
  GovernedProofRunResult,
  GovernedProofSystem,
  GovernedProofTask,
} from './contracts';

type JsonObject = Record<string, unknown>;

export interface CreateGovernedProofTaskInput {
  taskType: GovernedProofTask['taskType'];
  queueLane?: GovernedProofTask['queueLane'];
  priority?: GovernedProofTask['priority'];
  ownerSystem?: GovernedProofSystem;
  systemScope?: GovernedProofSystem[];
  targetType: string;
  targetId: string;
  valueScore?: number;
  confidenceRequired?: number;
  inputPayload?: JsonObject;
  acceptanceChecks?: string[];
  reviewStatus?: GovernedProofReviewStatus;
  promotionStatus?: GovernedProofPromotionStatus;
}

export interface LogGovernedProofRunInput {
  taskId: string;
  agentRole: string;
  provider: string;
  model?: string;
  promptVersion?: string;
  strategyVersion?: string;
  inputHash: string;
  outputHash?: string;
  resultStatus?: GovernedProofRunResult;
  evalScore?: number;
  confidenceDelta?: number;
  costUsd?: number;
  durationMs?: number;
  notes?: string;
  runPayload?: JsonObject;
}

export interface UpsertGovernedProofBundleInput {
  bundleKey: string;
  subjectType: GovernedProofBundle['subjectType'];
  subjectId: string;
  ownerSystem?: GovernedProofSystem;
  lifecycleStatus?: GovernedProofBundle['lifecycleStatus'];
  reviewStatus?: GovernedProofReviewStatus;
  promotionStatus?: GovernedProofPromotionStatus;
  overallConfidence?: number;
  capitalConfidence?: number;
  evidenceConfidence?: number;
  voiceConfidence?: number;
  governanceConfidence?: number;
  capitalContext?: JsonObject;
  evidenceContext?: JsonObject;
  voiceContext?: JsonObject;
  governanceContext?: JsonObject;
  outputContext?: JsonObject;
  freshnessAt?: string;
  lastValidatedAt?: string;
  publishedAt?: string;
}

export interface AttachGovernedProofBundleRecordInput {
  bundleId: string;
  recordSystem: GovernedProofBundleRecord['recordSystem'];
  recordType: string;
  recordId: string;
  linkRole: string;
  confidenceScore?: number;
  provenancePayload?: JsonObject;
}

function getClient(): any {
  return getServiceSupabase() as any;
}

function mapTask(row: any): GovernedProofTask {
  return {
    id: row.id,
    taskType: row.task_type,
    status: row.status,
    queueLane: row.queue_lane,
    priority: row.priority,
    ownerSystem: row.owner_system,
    systemScope: row.system_scope ?? [],
    targetType: row.target_type,
    targetId: row.target_id,
    valueScore: Number(row.value_score ?? 0),
    confidenceRequired: Number(row.confidence_required ?? 0),
    inputPayload: row.input_payload ?? {},
    acceptanceChecks: row.acceptance_checks ?? [],
    reviewStatus: row.review_status,
    promotionStatus: row.promotion_status,
    attemptCount: row.attempt_count ?? 0,
    claimedBy: row.claimed_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any): GovernedProofRun {
  return {
    id: row.id,
    taskId: row.task_id,
    agentRole: row.agent_role,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    strategyVersion: row.strategy_version,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    resultStatus: row.result_status,
    evalScore: row.eval_score != null ? Number(row.eval_score) : null,
    confidenceDelta:
      row.confidence_delta != null ? Number(row.confidence_delta) : null,
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    notes: row.notes,
    runPayload: row.run_payload ?? {},
    createdAt: row.created_at,
  };
}

function mapBundle(row: any): GovernedProofBundle {
  return {
    id: row.id,
    bundleKey: row.bundle_key,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    ownerSystem: row.owner_system,
    lifecycleStatus: row.lifecycle_status,
    reviewStatus: row.review_status,
    promotionStatus: row.promotion_status,
    overallConfidence: Number(row.overall_confidence ?? 0),
    capitalConfidence:
      row.capital_confidence != null ? Number(row.capital_confidence) : null,
    evidenceConfidence:
      row.evidence_confidence != null ? Number(row.evidence_confidence) : null,
    voiceConfidence:
      row.voice_confidence != null ? Number(row.voice_confidence) : null,
    governanceConfidence:
      row.governance_confidence != null ? Number(row.governance_confidence) : null,
    capitalContext: row.capital_context ?? {},
    evidenceContext: row.evidence_context ?? {},
    voiceContext: row.voice_context ?? {},
    governanceContext: row.governance_context ?? {},
    outputContext: row.output_context ?? {},
    freshnessAt: row.freshness_at,
    lastValidatedAt: row.last_validated_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBundleRecord(row: any): GovernedProofBundleRecord {
  return {
    id: row.id,
    bundleId: row.bundle_id,
    recordSystem: row.record_system,
    recordType: row.record_type,
    recordId: row.record_id,
    linkRole: row.link_role,
    confidenceScore: Number(row.confidence_score ?? 0),
    provenancePayload: row.provenance_payload ?? {},
    createdAt: row.created_at,
  };
}

export class GovernedProofService {
  private readonly supabase = getClient();

  async getBundleByKey(bundleKey: string): Promise<GovernedProofBundle | null> {
    const { data, error } = await this.supabase
      .from('governed_proof_bundles')
      .select('*')
      .eq('bundle_key', bundleKey)
      .maybeSingle();

    if (error) throw error;
    return data ? mapBundle(data) : null;
  }

  async listBundleRecords(bundleId: string): Promise<GovernedProofBundleRecord[]> {
    const { data, error } = await this.supabase
      .from('governed_proof_bundle_records')
      .select('*')
      .eq('bundle_id', bundleId)
      .order('record_system', { ascending: true })
      .order('record_type', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapBundleRecord);
  }

  async createTask(input: CreateGovernedProofTaskInput): Promise<GovernedProofTask> {
    const { data, error } = await this.supabase
      .from('governed_proof_tasks')
      .insert({
        task_type: input.taskType,
        queue_lane: input.queueLane ?? 'core',
        priority: input.priority ?? 'medium',
        owner_system: input.ownerSystem ?? 'SHARED',
        system_scope: input.systemScope ?? ['SHARED'],
        target_type: input.targetType,
        target_id: input.targetId,
        value_score: input.valueScore ?? 0,
        confidence_required: input.confidenceRequired ?? 0.8,
        input_payload: input.inputPayload ?? {},
        acceptance_checks: input.acceptanceChecks ?? [],
        review_status: input.reviewStatus ?? 'not_required',
        promotion_status: input.promotionStatus ?? 'draft',
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapTask(data);
  }

  async logRun(input: LogGovernedProofRunInput): Promise<GovernedProofRun> {
    const { data, error } = await this.supabase
      .from('governed_proof_runs')
      .insert({
        task_id: input.taskId,
        agent_role: input.agentRole,
        provider: input.provider,
        model: input.model,
        prompt_version: input.promptVersion,
        strategy_version: input.strategyVersion,
        input_hash: input.inputHash,
        output_hash: input.outputHash,
        result_status: input.resultStatus ?? 'success',
        eval_score: input.evalScore,
        confidence_delta: input.confidenceDelta,
        cost_usd: input.costUsd,
        duration_ms: input.durationMs,
        notes: input.notes,
        run_payload: input.runPayload ?? {},
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapRun(data);
  }

  async upsertBundle(input: UpsertGovernedProofBundleInput): Promise<GovernedProofBundle> {
    const { data, error } = await this.supabase
      .from('governed_proof_bundles')
      .upsert(
        {
          bundle_key: input.bundleKey,
          subject_type: input.subjectType,
          subject_id: input.subjectId,
          owner_system: input.ownerSystem ?? 'SHARED',
          lifecycle_status: input.lifecycleStatus ?? 'raw',
          review_status: input.reviewStatus ?? 'not_required',
          promotion_status: input.promotionStatus ?? 'draft',
          overall_confidence: input.overallConfidence ?? 0,
          capital_confidence: input.capitalConfidence,
          evidence_confidence: input.evidenceConfidence,
          voice_confidence: input.voiceConfidence,
          governance_confidence: input.governanceConfidence,
          capital_context: input.capitalContext ?? {},
          evidence_context: input.evidenceContext ?? {},
          voice_context: input.voiceContext ?? {},
          governance_context: input.governanceContext ?? {},
          output_context: input.outputContext ?? {},
          freshness_at: input.freshnessAt,
          last_validated_at: input.lastValidatedAt,
          published_at: input.publishedAt,
        },
        { onConflict: 'bundle_key' }
      )
      .select('*')
      .single();

    if (error) throw error;
    return mapBundle(data);
  }

  async attachBundleRecords(
    inputs: AttachGovernedProofBundleRecordInput[]
  ): Promise<GovernedProofBundleRecord[]> {
    if (inputs.length === 0) return [];

    const { data, error } = await this.supabase
      .from('governed_proof_bundle_records')
      .upsert(
        inputs.map((input) => ({
          bundle_id: input.bundleId,
          record_system: input.recordSystem,
          record_type: input.recordType,
          record_id: input.recordId,
          link_role: input.linkRole,
          confidence_score: input.confidenceScore ?? 0.7,
          provenance_payload: input.provenancePayload ?? {},
        })),
        { onConflict: 'bundle_id,record_system,record_type,record_id,link_role' }
      )
      .select('*');

    if (error) throw error;
    return (data ?? []).map(mapBundleRecord);
  }
}

export function createGovernedProofService() {
  return new GovernedProofService();
}
