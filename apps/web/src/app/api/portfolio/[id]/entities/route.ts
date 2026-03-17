import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/** POST /api/portfolio/[id]/entities — add entity to portfolio */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { gs_id, notes } = body;

  if (!gs_id) {
    return NextResponse.json({ error: 'gs_id required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Verify portfolio ownership
  const { data: portfolio } = await db
    .from('funder_portfolios')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (!portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
  }

  // Look up entity
  const { data: entity } = await db
    .from('gs_entities')
    .select('id, gs_id')
    .eq('gs_id', gs_id)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Insert (upsert to handle duplicates gracefully)
  const { data, error } = await db
    .from('funder_portfolio_entities')
    .upsert(
      { portfolio_id: id, entity_id: entity.id, gs_id: entity.gs_id, notes: notes || null },
      { onConflict: 'portfolio_id,entity_id' }
    )
    .select('id, gs_id, added_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to add entity' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/** DELETE /api/portfolio/[id]/entities — remove entity from portfolio */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const gsId = searchParams.get('gs_id');

  if (!gsId) {
    return NextResponse.json({ error: 'gs_id query param required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Verify ownership
  const { data: portfolio } = await db
    .from('funder_portfolios')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (!portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
  }

  const { error } = await db
    .from('funder_portfolio_entities')
    .delete()
    .eq('portfolio_id', id)
    .eq('gs_id', gsId);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove entity' }, { status: 500 });
  }

  return NextResponse.json({ status: 'removed' });
}
