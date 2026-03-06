import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') || '';
  const orgType = searchParams.get('org_type') || '';
  const state = searchParams.get('state') || '';
  const sector = searchParams.get('sector') || '';
  const certification = searchParams.get('certification') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const sort = searchParams.get('sort') || 'name';

  const supabase = getServiceSupabase();
  let query = supabase
    .from('social_enterprises')
    .select('*', { count: 'exact' });

  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (orgType) query = query.eq('org_type', orgType);
  if (state) query = query.eq('state', state);
  if (sector) query = query.contains('sector', [sector]);
  if (certification) query = query.contains('certifications', [{ body: certification }]);

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'state') {
    query = query.order('state', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('name', { ascending: true });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count, limit, offset });
}
