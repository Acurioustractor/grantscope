import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || '';
  const focus = searchParams.get('focus') || '';
  const minGiving = searchParams.get('min_giving');
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = getServiceSupabase();
  let query = supabase
    .from('foundations')
    .select('*', { count: 'exact' });

  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (type) query = query.eq('type', type);
  if (focus) query = query.contains('thematic_focus', [focus]);
  if (minGiving) query = query.gte('total_giving_annual', parseInt(minGiving, 10));

  query = query
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count, limit, offset });
}
