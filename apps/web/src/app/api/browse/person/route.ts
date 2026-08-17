import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const norm = req.nextUrl.searchParams.get('norm');
  if (!norm) return NextResponse.json({ error: 'norm is required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('person_detail', { p_norm: norm });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that person' }, { status: 404 });
  return NextResponse.json(data);
}
