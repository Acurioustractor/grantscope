import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const lga = req.nextUrl.searchParams.get('lga');
  const state = req.nextUrl.searchParams.get('state');
  if (!lga || !state) return NextResponse.json({ error: 'lga and state are required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('place_detail', { p_lga: lga, p_state: state });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that place' }, { status: 404 });
  return NextResponse.json(data);
}
