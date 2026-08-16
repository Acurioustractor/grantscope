import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const NOUNS = ['money', 'organisations', 'people', 'places', 'evidence', 'machine'] as const;

/**
 * POST /api/clarity/nouns — a human files (or unfiles) an object.
 *
 * { object_key, noun: one of the six | null, reason? }
 *
 * The only writer of noun_source='human'. A rule's proposal never files an object; this route is
 * the confirmation the plan requires, recorded through the verdict columns that existed unused
 * since the catalogue was built ("first use of verdict in anger"). noun: null un-files — human
 * judgement that the rule filing was wrong is also a verdict worth recording.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { object_key?: unknown; noun?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (typeof body.object_key !== 'string' || !body.object_key) {
    return NextResponse.json({ error: 'object_key required' }, { status: 400 });
  }
  const noun = body.noun === null ? null : (body.noun as string);
  if (noun !== null && !NOUNS.includes(noun as (typeof NOUNS)[number])) {
    return NextResponse.json({ error: `noun must be null or one of ${NOUNS.join(', ')}` }, { status: 400 });
  }
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('clarity_object')
    .update({
      noun,
      noun_source: noun === null ? null : 'human',
      // clarity_object.verdict is the enum {keep, suspect, cruft} — lifecycle adjudication, not
      // a confirmation vocabulary (found by slice 2's HTTP verification; 'confirmed' 500s).
      // Filing a noun IS a human looking at the object and keeping it, so it records 'keep',
      // and the noun action itself lives in verdict_reason.
      verdict: 'keep',
      verdict_by: auth.user.email ?? 'admin',
      verdict_at: new Date().toISOString(),
      verdict_reason: reason ?? (noun === null ? 'unfiled by human' : `filed as ${noun}`),
    })
    .eq('object_key', body.object_key)
    .select('object_key')
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'no such object' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
