import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tag = request.nextUrl.searchParams.get('tag')?.trim();
  const q = request.nextUrl.searchParams.get('q')?.trim();

  // Tag-only search (no q required)
  if (tag && !q) {
    const serviceDb = getServiceSupabase();
    const { data, error } = await serviceDb
      .from('ghl_contacts')
      .select('id, first_name, last_name, email, company_name, tags')
      .contains('tags', [tag])
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!q || q.length < 2) return NextResponse.json([]);

  const serviceDb = getServiceSupabase();
  const pattern = `%${q}%`;

  let query = serviceDb
    .from('ghl_contacts')
    .select('id, first_name, last_name, email, company_name, tags')
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
    .limit(10);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
