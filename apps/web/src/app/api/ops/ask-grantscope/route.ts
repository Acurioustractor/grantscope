import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { askGrantScope, MAX_RESULTS } from '@/lib/services/ask-grantscope';

export const maxDuration = 30;

const MAX_QUESTION_LENGTH = 500;

/**
 * Ask GrantScope v1 — ACT-internal only.
 *
 * This stays behind the admin gate deliberately. The evidence contract is built
 * and tested here first; opening it to external organisations is a governed
 * decision, not a config change.
 */
export async function POST(request: Request) {
  const authClient = await createSupabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  const requestOrigin = request.headers.get('origin');
  const localOrigin = requestOrigin
    ? ['localhost', '127.0.0.1'].includes(new URL(requestOrigin).hostname)
    : false;
  const localCaller = process.env.NODE_ENV !== 'production' && !user && localOrigin;

  if (user && !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user && !localCaller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { question?: unknown; limit?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `question too long (max ${MAX_QUESTION_LENGTH} chars)` },
      { status: 400 },
    );
  }

  const requestedLimit = Number(body.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), MAX_RESULTS))
    : MAX_RESULTS;

  try {
    const answer = await askGrantScope({ question, limit });
    return NextResponse.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/ops/ask-grantscope] failed:', message);
    return NextResponse.json({ error: 'Ask GrantScope failed', details: message }, { status: 500 });
  }
}
