import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

const DECISIONS = new Set(['relevant', 'not_relevant', 'unsure']);
const ACTION_TIMINGS = new Set(['apply_now', 'build_relationship', 'do_not_pursue']);
const RELATIONSHIP_KNOWLEDGE = new Set(['known_person', 'no_known_person', 'needs_matching']);
const CHECK_KEYS = ['official_source', 'current_timing', 'applicant_eligibility', 'funding_amount', 'project_fit'] as const;

export async function POST(request: Request) {
  const authClient = await createSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const requestOrigin = request.headers.get('origin');
  const localOrigin = requestOrigin
    ? ['localhost', '127.0.0.1'].includes(new URL(requestOrigin).hostname)
    : false;
  const localReviewer = process.env.NODE_ENV !== 'production' && !user && localOrigin;

  if (user && !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user && !localReviewer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reviewer = user
    ? {
        userId: user.id,
        email: user.email ?? null,
        name: typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : null,
        mode: 'authenticated',
      }
    : {
        userId: null,
        email: 'local-reviewer@act.place',
        name: 'A Curious Tractor local reviewer',
        mode: 'local-development',
      };

  let body: {
    case_id?: unknown;
    decision?: unknown;
    judgments?: unknown;
    selected_project_codes?: unknown;
    action_timing?: unknown;
    relationship_knowledge?: unknown;
    relationship_note?: unknown;
    comment?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const caseId = typeof body.case_id === 'string' ? body.case_id : null;
  const decision = typeof body.decision === 'string' ? body.decision : null;
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const selectedProjectCodes = Array.isArray(body.selected_project_codes)
    ? [...new Set(body.selected_project_codes.filter((value): value is string => typeof value === 'string' && /^ACT-[A-Z]+$/.test(value)))]
    : [];
  const actionTiming = typeof body.action_timing === 'string' && ACTION_TIMINGS.has(body.action_timing)
    ? body.action_timing
    : null;
  const relationshipKnowledge = typeof body.relationship_knowledge === 'string' && RELATIONSHIP_KNOWLEDGE.has(body.relationship_knowledge)
    ? body.relationship_knowledge
    : 'needs_matching';
  const relationshipNote = typeof body.relationship_note === 'string' ? body.relationship_note.trim() : '';
  const rawJudgments = body.judgments && typeof body.judgments === 'object'
    ? body.judgments as Record<string, unknown>
    : {};
  const judgments = Object.fromEntries(CHECK_KEYS.map((key) => {
    const value = rawJudgments[key];
    return [key, value === 'yes' || value === 'no' || value === 'unknown' ? value : 'unknown'];
  })) as Record<typeof CHECK_KEYS[number], 'yes' | 'no' | 'unknown'>;
  const failedChecks = CHECK_KEYS.filter((key) => judgments[key] === 'no');
  const unknownChecks = CHECK_KEYS.filter((key) => judgments[key] === 'unknown');

  if (!caseId || !decision || !DECISIONS.has(decision)) {
    return NextResponse.json({ error: 'case_id and valid decision required' }, { status: 400 });
  }
  if (!actionTiming) {
    return NextResponse.json({ error: 'Choose whether ACT would apply now, build the relationship, or not pursue' }, { status: 400 });
  }
  if (decision === 'relevant' && selectedProjectCodes.length === 0) {
    return NextResponse.json({ error: 'Select at least one ACT project for a relevant opportunity' }, { status: 400 });
  }
  if (decision === 'relevant' && CHECK_KEYS.some((key) => judgments[key] !== 'yes')) {
    return NextResponse.json({ error: 'Relevant requires Yes for all five requirements' }, { status: 400 });
  }
  if (decision === 'not_relevant' && failedChecks.length === 0) {
    return NextResponse.json({ error: 'Not relevant requires at least one No judgment' }, { status: 400 });
  }
  if (decision === 'unsure' && (failedChecks.length > 0 || unknownChecks.length === 0)) {
    return NextResponse.json({ error: 'Not sure requires at least one Unknown and no failed requirement' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const today = new Date();
  const weekStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() === 0 ? 6 : weekStart.getUTCDay() - 1));
  const { count: reviewedThisWeek, error: weeklyCountError } = await db
    .from('act_opportunity_benchmark_cases')
    .select('id', { count: 'exact', head: true })
    .eq('benchmark_version', 'act-opportunity-v1')
    .eq('label_source', 'human_benchmark_review')
    .gte('reviewed_at', weekStart.toISOString());
  if (weeklyCountError) return NextResponse.json({ error: weeklyCountError.message }, { status: 500 });
  if ((reviewedThisWeek || 0) >= 12) {
    return NextResponse.json({ error: 'This week’s 12-case benchmark review is complete. The next bounded batch opens Monday.' }, { status: 409 });
  }
  const { data: existing, error: lookupError } = await db
    .from('act_opportunity_benchmark_cases')
    .select('id, evidence, review_status')
    .eq('id', caseId)
    .eq('benchmark_version', 'act-opportunity-v1')
    .single();
  if (lookupError || !existing) {
    return NextResponse.json({ error: 'Benchmark case not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const reviewStatus = decision === 'unsure' ? 'disputed' : 'confirmed';
  const expectedLabel = decision === 'unsure' ? null : decision;
  const generatedReason = decision === 'not_relevant'
    ? `Failed requirements: ${failedChecks.map((key) => key.replaceAll('_', ' ')).join(', ')}.`
    : decision === 'unsure'
      ? `Evidence still unknown: ${unknownChecks.map((key) => key.replaceAll('_', ' ')).join(', ')}.`
      : 'All five required conditions passed.';
  const rationale = comment || generatedReason;
  const { data, error } = await db
    .from('act_opportunity_benchmark_cases')
    .update({
      expected_label: expectedLabel,
      label_source: 'human_benchmark_review',
      review_status: reviewStatus,
      rationale,
      evidence: {
        ...(existing.evidence ?? {}),
        human_review: {
          judgments,
          selected_project_codes: selectedProjectCodes,
          action_timing: actionTiming,
          relationship_knowledge: relationshipKnowledge,
          relationship_note: relationshipNote || null,
          decision,
          comment: comment || null,
          generated_reason: generatedReason,
          reviewed_at: now,
          reviewer_profile: {
            user_id: reviewer.userId,
            email: reviewer.email,
            name: reviewer.name,
            mode: reviewer.mode,
          },
        },
      },
      reviewed_by: reviewer.userId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', caseId)
    .select('id, expected_label, review_status, reviewed_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
