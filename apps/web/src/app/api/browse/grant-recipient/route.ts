import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('grant_recipient_detail', { p_key: key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that recipient' }, { status: 404 });
  return NextResponse.json(data);
}
