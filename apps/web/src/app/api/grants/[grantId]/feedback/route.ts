import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { grantId } = await params;
  const db = getServiceSupabase();

  const { data, error } = await db
    .from('grant_feedback')
    .select('vote, reason, source_context, created_at')
    .eq('user_id', user.id)
    .eq('grant_id', grantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { grantId } = await params;
  const body = await request.json();
  const { vote, reason, source_context } = body;

  if (vote !== 1 && vote !== -1) {
    return NextResponse.json({ error: 'vote must be 1 or -1' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Get user's org profile if they have one
  const { data: profile } = await db
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data, error } = await db
    .from('grant_feedback')
    .upsert({
      user_id: user.id,
      org_profile_id: profile?.id || null,
      grant_id: grantId,
      vote,
      reason: reason || null,
      source_context: source_context || null,
    }, { onConflict: 'user_id,grant_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}
