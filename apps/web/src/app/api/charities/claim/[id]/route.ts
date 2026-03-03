import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();

  // Verify ownership and verified status
  const { data: claim } = await db
    .from('charity_claims')
    .select('id, user_id, status')
    .eq('id', id)
    .single();

  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  if (claim.user_id !== user.id) return NextResponse.json({ error: 'Not your claim' }, { status: 403 });
  if (claim.status !== 'verified') return NextResponse.json({ error: 'Claim not yet verified' }, { status: 403 });

  const body = await request.json();
  const { profile_description, profile_story, feature_narrative } = body;

  const { data, error } = await db
    .from('charity_claims')
    .update({
      profile_description: profile_description ?? null,
      profile_story: profile_story ?? null,
      feature_narrative: feature_narrative ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
