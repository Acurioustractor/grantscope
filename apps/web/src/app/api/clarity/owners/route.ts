import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const OWNERS = ['civicgraph', 'justicehub', 'both', 'neither'] as const;
const PROPOSALS = ['civicgraph', 'justicehub', 'both'] as const;

/**
 * POST /api/clarity/owners — a human confirms ownership, singly or en masse.
 *
 * { action: 'set', object_key, owner: civicgraph|justicehub|both|neither }
 * { action: 'confirm_all', proposal: civicgraph|justicehub|both }
 *
 * confirm_all is still human confirmation — of the code-refs rule, en masse, recorded as such.
 * It only touches objects whose owner is still 'neither', so a single-object override is never
 * bulldozed by a later batch.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { action?: unknown; object_key?: unknown; owner?: unknown; proposal?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();
  const stamp = {
    owner_source: 'human' as const,
    owner_set_by: auth.user.email ?? 'admin',
    owner_set_at: new Date().toISOString(),
  };

  if (body.action === 'set') {
    if (typeof body.object_key !== 'string' || !body.object_key) {
      return NextResponse.json({ error: 'object_key required' }, { status: 400 });
    }
    if (!OWNERS.includes(body.owner as (typeof OWNERS)[number])) {
      return NextResponse.json({ error: `owner must be one of ${OWNERS.join(', ')}` }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('clarity_object')
      .update({ owner_app: body.owner, ...stamp })
      .eq('object_key', body.object_key)
      .select('object_key')
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'no such object' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'confirm_all') {
    if (!PROPOSALS.includes(body.proposal as (typeof PROPOSALS)[number])) {
      return NextResponse.json(
        { error: `proposal must be one of ${PROPOSALS.join(', ')}` },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from('clarity_object')
      .update({ owner_app: body.proposal, ...stamp })
      .eq('owner_app_proposed', body.proposal)
      .eq('owner_app', 'neither')
      .select('object_key');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, confirmed: data?.length ?? 0 });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
