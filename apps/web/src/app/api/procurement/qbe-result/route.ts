import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * POST /api/procurement/qbe-result
 *
 * Write-back endpoint for external Qualify/Bid/Evaluate (QBE) outcomes.
 * Accepts evaluation results from the external QBE workflow and:
 *   1. Inserts a row in qbe_evaluations (audit log)
 *   2. Updates the linked org_pipeline card (qbe_stage, qbe_outcome, status)
 *
 * Body:
 *   {
 *     pipeline_id?: string,           // org_pipeline.id (preferred)
 *     opportunity_id?: string,        // grant_opportunities.id (fallback)
 *     project_code?: string,
 *     bid_amount?: number,
 *     bid_currency?: string,
 *     bid_summary?: string,
 *     evaluation_score?: number,
 *     evaluation_max?: number,
 *     won?: boolean,
 *     outcome_reason?: string,
 *     feedback_received?: string,
 *     lessons_learned?: string,
 *     evaluator_name?: string,
 *     evaluator_org?: string,
 *     raw_payload?: Record<string, unknown>
 *   }
 *
 * Returns: { evaluation_id, pipeline_id, pipeline_updated }
 */

interface QbePayload {
  pipeline_id?: string;
  opportunity_id?: string;
  project_code?: string;
  bid_amount?: number;
  bid_currency?: string;
  bid_summary?: string;
  evaluation_score?: number;
  evaluation_max?: number;
  won?: boolean;
  outcome_reason?: string;
  feedback_received?: string;
  lessons_learned?: string;
  evaluator_name?: string;
  evaluator_org?: string;
  raw_payload?: Record<string, unknown>;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  let body: QbePayload;
  try {
    body = (await request.json()) as QbePayload;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.pipeline_id && !body.opportunity_id) {
    return badRequest('pipeline_id or opportunity_id is required');
  }

  const db = getServiceSupabase();

  // Resolve pipeline_id if only opportunity_id was supplied
  let pipelineId = body.pipeline_id || null;
  let projectCode = body.project_code || null;

  if (!pipelineId && body.opportunity_id) {
    const { data: pipelineRow, error: pipelineErr } = await db
      .from('org_pipeline')
      .select('id, project_code')
      .eq('grant_opportunity_id', body.opportunity_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pipelineErr) {
      return NextResponse.json({ error: pipelineErr.message }, { status: 500 });
    }
    if (pipelineRow) {
      pipelineId = pipelineRow.id;
      projectCode = projectCode || pipelineRow.project_code;
    }
  }

  // Insert audit record
  const { data: evaluation, error: insertErr } = await db
    .from('qbe_evaluations')
    .insert({
      pipeline_id: pipelineId,
      opportunity_id: body.opportunity_id || null,
      project_code: projectCode,
      bid_amount: body.bid_amount ?? null,
      bid_currency: body.bid_currency || 'AUD',
      bid_summary: body.bid_summary || null,
      evaluation_score: body.evaluation_score ?? null,
      evaluation_max: body.evaluation_max ?? null,
      won: body.won ?? null,
      outcome_reason: body.outcome_reason || null,
      feedback_received: body.feedback_received || null,
      lessons_learned: body.lessons_learned || null,
      evaluator_name: body.evaluator_name || null,
      evaluator_org: body.evaluator_org || null,
      raw_payload: body.raw_payload || {},
    })
    .select('id')
    .single();

  if (insertErr || !evaluation) {
    return NextResponse.json(
      { error: insertErr?.message || 'qbe_evaluations insert failed' },
      { status: 500 }
    );
  }

  // Update linked pipeline card
  let pipelineUpdated = false;
  if (pipelineId) {
    const outcome =
      body.won === true ? 'won' : body.won === false ? 'lost' : 'no_decision';
    const newStatus =
      body.won === true ? 'won' : body.won === false ? 'lost' : undefined;

    const updatePayload: Record<string, unknown> = {
      qbe_stage: 'decided',
      qbe_outcome: outcome,
      qbe_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (typeof body.bid_amount === 'number') {
      updatePayload.qbe_bid_amount = body.bid_amount;
    }
    if (newStatus) {
      updatePayload.status = newStatus;
    }

    const { error: updateErr } = await db
      .from('org_pipeline')
      .update(updatePayload)
      .eq('id', pipelineId);

    if (updateErr) {
      // Log but don't fail — the audit record is the source of truth
      console.warn('[qbe-result] pipeline update failed:', updateErr.message);
    } else {
      pipelineUpdated = true;
    }
  }

  return NextResponse.json({
    evaluation_id: evaluation.id,
    pipeline_id: pipelineId,
    pipeline_updated: pipelineUpdated,
  });
}

/**
 * PATCH /api/procurement/qbe-result
 *
 * Update the QBE stage without supplying a full evaluation.
 * Body: { pipeline_id: string, qbe_stage: 'qualifying' | 'bid_drafting' | 'bid_submitted' | 'evaluating' }
 *
 * Used while a bid is in flight — the final result comes via POST.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  let body: { pipeline_id?: string; qbe_stage?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const validStages = ['not_started', 'qualifying', 'bid_drafting', 'bid_submitted', 'evaluating', 'decided'];
  if (!body.pipeline_id) return badRequest('pipeline_id required');
  if (!body.qbe_stage || !validStages.includes(body.qbe_stage)) {
    return badRequest(`qbe_stage must be one of ${validStages.join(', ')}`);
  }

  const db = getServiceSupabase();
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    qbe_stage: body.qbe_stage,
    updated_at: now,
  };
  if (body.qbe_stage === 'qualifying') updatePayload.qbe_qualified_at = now;
  if (body.qbe_stage === 'bid_submitted') updatePayload.qbe_submitted_at = now;

  const { error } = await db
    .from('org_pipeline')
    .update(updatePayload)
    .eq('id', body.pipeline_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pipeline_id: body.pipeline_id, qbe_stage: body.qbe_stage });
}

/**
 * GET /api/procurement/qbe-result?pipeline_id=...
 *
 * Read evaluation history for a pipeline card. Most recent first.
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const pipelineId = request.nextUrl.searchParams.get('pipeline_id');
  const opportunityId = request.nextUrl.searchParams.get('opportunity_id');
  if (!pipelineId && !opportunityId) return badRequest('pipeline_id or opportunity_id required');

  const db = getServiceSupabase();
  let query = db
    .from('qbe_evaluations')
    .select('*')
    .order('evaluated_at', { ascending: false })
    .limit(50);

  if (pipelineId) query = query.eq('pipeline_id', pipelineId);
  if (opportunityId) query = query.eq('opportunity_id', opportunityId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evaluations: data || [] });
}
