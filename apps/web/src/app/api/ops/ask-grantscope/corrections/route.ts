import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import {
  recordCorrection,
  validateCorrection,
  type BenchmarkLabel,
  type CorrectionType,
} from '@/lib/services/ask-grantscope-corrections';

export const maxDuration = 30;

/**
 * Capture a human correction to an Ask GrantScope answer.
 *
 * Deliberately a separate endpoint from the answer itself: correcting is an
 * explicit act by a named reviewer, not a side effect of reading an answer.
 */
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = {
    question: typeof body.question === 'string' ? body.question : '',
    projectCode: typeof body.projectCode === 'string' ? body.projectCode : null,
    opportunityId: typeof body.opportunityId === 'string' ? body.opportunityId : null,
    correctionType: body.correctionType as CorrectionType,
    label: (body.label as BenchmarkLabel | undefined) ?? null,
    rationale: typeof body.rationale === 'string' ? body.rationale : '',
    answerSnapshot:
      body.answerSnapshot && typeof body.answerSnapshot === 'object' && !Array.isArray(body.answerSnapshot)
        ? (body.answerSnapshot as Record<string, unknown>)
        : {},
    reviewer: user
      ? { userId: user.id, email: user.email ?? null }
      : { userId: null, email: 'local-reviewer@act.place' },
  };

  const validation = validateCorrection(input);
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid correction', details: validation.errors }, { status: 400 });
  }

  try {
    const result = await recordCorrection(input);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/ops/ask-grantscope/corrections] failed:', message);
    return NextResponse.json({ error: 'Could not record correction', details: message }, { status: 500 });
  }
}
