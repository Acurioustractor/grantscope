import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('charity_claims')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { abn, contact_email, contact_name, organisation_name } = body;

  if (!abn) return NextResponse.json({ error: 'ABN is required' }, { status: 400 });

  const db = getServiceSupabase();

  // Check for existing claim by this user
  const { data: existing } = await db
    .from('charity_claims')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('abn', abn)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have a claim for this charity', claim: existing }, { status: 409 });
  }

  const { data, error } = await db
    .from('charity_claims')
    .insert({
      user_id: user.id,
      abn,
      contact_email: contact_email || user.email,
      contact_name: contact_name || null,
      organisation_name: organisation_name || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
