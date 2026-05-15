import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Action = 'track' | 'review' | 'dismiss' | 'reset';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: Action; grant_ids?: string[] };
  if (!body.action || !['track', 'review', 'dismiss', 'reset'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be track | review | dismiss | reset' }, { status: 400 });
  }

  const db = getServiceSupabase();

  const { data: signal, error: sigErr } = await db
    .from('goods_procurement_signals')
    .select('id, status, matched_grant_ids, title')
    .eq('id', id)
    .maybeSingle();
  if (sigErr || !signal) {
    return NextResponse.json({ error: 'signal not found' }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (body.action === 'dismiss') {
    const { error } = await db
      .from('goods_procurement_signals')
      .update({ status: 'dismissed', actioned_at: now, assigned_to: user.email || user.id })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  if (body.action === 'reset') {
    const { error } = await db
      .from('goods_procurement_signals')
      .update({ status: 'new', actioned_at: null, assigned_to: null, action_notes: null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'new' });
  }

  if (body.action === 'review') {
    const { error } = await db
      .from('goods_procurement_signals')
      .update({ status: 'reviewing', assigned_to: user.email || user.id })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'reviewing' });
  }

  // action === 'track': add matched grants to saved_grants, mark signal actioned
  const grantIds = (body.grant_ids && body.grant_ids.length > 0) ? body.grant_ids : (signal.matched_grant_ids || []);
  if (grantIds.length === 0) {
    return NextResponse.json({ error: 'no grants to track on this signal' }, { status: 400 });
  }

  const { data: existing } = await db
    .from('saved_grants')
    .select('grant_id')
    .eq('user_id', user.id)
    .in('grant_id', grantIds);
  const alreadySaved = new Set((existing || []).map(r => r.grant_id));
  const newRows = grantIds
    .filter((gid: string) => !alreadySaved.has(gid))
    .map((gid: string) => ({
      user_id: user.id,
      grant_id: gid,
      stage: 'researching',
      notes: `Auto-tracked from Goods signal: ${signal.title}`,
      source_attribution_type: 'goods_signal',
      source_attributed_at: now,
    }));

  let inserted = 0;
  if (newRows.length > 0) {
    const { error: saveErr } = await db.from('saved_grants').insert(newRows);
    if (saveErr) {
      return NextResponse.json({ error: `saved_grants insert: ${saveErr.message}` }, { status: 500 });
    }
    inserted = newRows.length;
  }

  const { error: sigUpdateErr } = await db
    .from('goods_procurement_signals')
    .update({
      status: 'actioned',
      actioned_at: now,
      assigned_to: user.email || user.id,
      action_notes: `Tracked ${inserted} new grant(s) (${alreadySaved.size} already saved).`,
    })
    .eq('id', id);
  if (sigUpdateErr) {
    return NextResponse.json({ error: sigUpdateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: 'actioned',
    tracked_grants: inserted,
    already_saved: alreadySaved.size,
  });
}
