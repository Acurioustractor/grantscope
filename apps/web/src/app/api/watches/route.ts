import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/watches — list user's entity watches
 * POST /api/watches — add entity watch
 */

export async function GET() {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('entity_watches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watches: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { gs_id, watch_types, notes } = body;

  if (!gs_id) {
    return NextResponse.json({ error: 'gs_id is required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Look up entity
  const { data: entity, error: entityErr } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name')
    .eq('gs_id', gs_id)
    .single();

  if (entityErr || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('entity_watches')
    .upsert({
      user_id: user.id,
      entity_id: entity.id,
      gs_id: entity.gs_id,
      canonical_name: entity.canonical_name,
      watch_types: watch_types || ['contracts', 'grants', 'relationships'],
      notes: notes || null,
    }, { onConflict: 'user_id,entity_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watch: data }, { status: 201 });
}
