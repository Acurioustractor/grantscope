/**
 * Correction capture for Ask GrantScope.
 *
 * The rule this module exists to hold: a correction updates benchmark memory,
 * and nothing else. It never edits `act_grant_recommendations_current`, never
 * touches profile embeddings, and never adjusts hybrid ranking weights. If a
 * correction could quietly change what production surfaces tomorrow, a reviewer
 * can no longer tell whether the system improved or simply learned to agree
 * with them.
 *
 * Benchmark labels are also never invented. A correction only produces a label
 * when the human's judgment implies one; `missing_opportunity` deliberately
 * produces none, because there is no case to relabel yet.
 */

import { getServiceSupabase } from '@/lib/supabase';

export const CORRECTION_TYPES = [
  'wrong_eligibility',
  'not_useful',
  'good_result',
  'missing_opportunity',
  'wrong_fact',
] as const;

export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export type BenchmarkLabel = 'relevant' | 'not_relevant';

export interface CorrectionInput {
  question: string;
  projectCode: string | null;
  opportunityId: string | null;
  correctionType: CorrectionType;
  /** Explicit reviewer label. Only honoured for types that carry one. */
  label?: BenchmarkLabel | null;
  rationale: string;
  answerSnapshot?: Record<string, unknown>;
  reviewer: { userId: string | null; email: string | null };
}

export interface CorrectionResult {
  correctionId: string;
  /** Benchmark case written or updated. Null when the correction implies no label. */
  benchmarkCaseId: string | null;
  impliedLabel: BenchmarkLabel | null;
  appliedToBenchmark: boolean;
  /** Always false. Stated explicitly so the contract is visible in the response. */
  productionRankingChanged: false;
  note: string;
}

/**
 * Map a correction to the benchmark label it implies.
 *
 * `wrong_eligibility` is the only type where the reviewer's explicit label is
 * required: being told "you got eligibility wrong" does not say in which
 * direction. Guessing would put a fabricated label into benchmark memory.
 */
export function impliedLabelFor(
  correctionType: CorrectionType,
  label: BenchmarkLabel | null | undefined,
): BenchmarkLabel | null {
  switch (correctionType) {
    case 'not_useful':
      return 'not_relevant';
    case 'good_result':
      return 'relevant';
    case 'wrong_eligibility':
      return label ?? null;
    case 'missing_opportunity':
    case 'wrong_fact':
      return null;
    default:
      return null;
  }
}

export interface CorrectionValidation {
  valid: boolean;
  errors: string[];
}

export function validateCorrection(input: Partial<CorrectionInput>): CorrectionValidation {
  const errors: string[] = [];

  if (!input.question || !input.question.trim()) {
    errors.push('question is required');
  }
  if (!input.correctionType || !CORRECTION_TYPES.includes(input.correctionType)) {
    errors.push(`correctionType must be one of: ${CORRECTION_TYPES.join(', ')}`);
  }
  if (!input.rationale || !input.rationale.trim()) {
    // A correction without a reason cannot teach anything later.
    errors.push('rationale is required');
  }
  if (input.label && !['relevant', 'not_relevant'].includes(input.label)) {
    errors.push('label must be relevant or not_relevant');
  }

  const needsOpportunity: CorrectionType[] = ['wrong_eligibility', 'not_useful', 'good_result', 'wrong_fact'];
  if (input.correctionType && needsOpportunity.includes(input.correctionType) && !input.opportunityId) {
    errors.push(`${input.correctionType} requires an opportunityId`);
  }
  if (input.correctionType === 'wrong_eligibility' && !input.label) {
    errors.push('wrong_eligibility requires an explicit label, since the direction cannot be inferred');
  }
  if (
    input.correctionType &&
    ['wrong_eligibility', 'not_useful', 'good_result'].includes(input.correctionType) &&
    !input.projectCode
  ) {
    // Relevance is only meaningful relative to a project.
    errors.push(`${input.correctionType} requires a projectCode`);
  }

  return { valid: errors.length === 0, errors };
}

/** Benchmark memory this service writes into, kept versioned alongside the seeded pool. */
export const CORRECTION_BENCHMARK_VERSION = 'v1';

interface OpportunityRow {
  id: string;
  name: string;
  funder_name: string | null;
  source_url: string | null;
  deadline: string | null;
}

/**
 * Record a correction and, where it implies one, fold a label into benchmark
 * memory. Writes are ordered so the correction survives even if the benchmark
 * upsert fails — losing the human's reasoning is worse than a missing label,
 * which can be reconciled later from `applied_to_benchmark = false`.
 */
export async function recordCorrection(input: CorrectionInput): Promise<CorrectionResult> {
  const validation = validateCorrection(input);
  if (!validation.valid) {
    throw new Error(`Invalid correction: ${validation.errors.join('; ')}`);
  }

  const db = getServiceSupabase();
  const impliedLabel = impliedLabelFor(input.correctionType, input.label);

  const insertResult = await db
    .from('ask_grantscope_corrections')
    .insert({
      question: input.question.trim(),
      project_code: input.projectCode,
      opportunity_id: input.opportunityId,
      correction_type: input.correctionType,
      implied_label: impliedLabel,
      rationale: input.rationale.trim(),
      answer_snapshot: input.answerSnapshot ?? {},
      corrected_by: input.reviewer.userId,
      corrected_by_email: input.reviewer.email,
      applied_to_benchmark: false,
    })
    .select('id')
    .single();

  if (insertResult.error) {
    throw new Error(`Could not record correction: ${insertResult.error.message}`);
  }
  const correctionId = (insertResult.data as { id: string }).id;

  if (!impliedLabel || !input.opportunityId || !input.projectCode) {
    return {
      correctionId,
      benchmarkCaseId: null,
      impliedLabel,
      appliedToBenchmark: false,
      productionRankingChanged: false,
      note: impliedLabel
        ? 'Correction recorded. No benchmark case written because the opportunity or project was not identified.'
        : 'Correction recorded. This correction type implies no benchmark label.',
    };
  }

  const opportunityResult = await db
    .from('alma_funding_opportunities')
    .select('id, name, funder_name, source_url, deadline')
    .eq('id', input.opportunityId)
    .maybeSingle();
  if (opportunityResult.error) {
    throw new Error(`Could not load the opportunity: ${opportunityResult.error.message}`);
  }
  const opportunity = opportunityResult.data as OpportunityRow | null;
  if (!opportunity) {
    return {
      correctionId,
      benchmarkCaseId: null,
      impliedLabel,
      appliedToBenchmark: false,
      productionRankingChanged: false,
      note: 'Correction recorded, but the opportunity no longer exists so no benchmark case was written.',
    };
  }

  const benchmarkResult = await db
    .from('act_opportunity_benchmark_cases')
    .upsert({
      benchmark_version: CORRECTION_BENCHMARK_VERSION,
      project_code: input.projectCode,
      opportunity_id: opportunity.id,
      name: opportunity.name,
      funder_name: opportunity.funder_name,
      source_url: opportunity.source_url,
      deadline: opportunity.deadline,
      expected_label: impliedLabel,
      label_source: 'human_benchmark_review',
      review_status: 'confirmed',
      rationale: input.rationale.trim(),
      evidence: { correctionId, correctionType: input.correctionType },
      reviewed_by: input.reviewer.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'benchmark_version,project_code,opportunity_id' })
    .select('id')
    .single();

  if (benchmarkResult.error) {
    // The correction is already durable; surface the shortfall rather than
    // failing the whole call and losing the reviewer's input.
    return {
      correctionId,
      benchmarkCaseId: null,
      impliedLabel,
      appliedToBenchmark: false,
      productionRankingChanged: false,
      note: `Correction recorded, but the benchmark case failed to write: ${benchmarkResult.error.message}`,
    };
  }

  const benchmarkCaseId = (benchmarkResult.data as { id: string }).id;

  await db
    .from('ask_grantscope_corrections')
    .update({ applied_to_benchmark: true, benchmark_case_id: benchmarkCaseId })
    .eq('id', correctionId);

  return {
    correctionId,
    benchmarkCaseId,
    impliedLabel,
    appliedToBenchmark: true,
    productionRankingChanged: false,
    note: `Benchmark memory updated to ${impliedLabel}. Production ranking is unchanged and will only move when the ranker is retuned deliberately.`,
  };
}
