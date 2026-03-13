import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type') || ''; // 'grant', 'foundation', 'program'
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = getServiceSupabase();
  const results: unknown[] = [];

  // Search grants
  if (!type || type === 'grant') {
    let grantQuery = supabase
      .from('grant_opportunities')
      .select('id, name, provider, amount_min, amount_max, closes_at, categories, url');

    if (q) grantQuery = grantQuery.or(`name.ilike.%${q}%,provider.ilike.%${q}%`);
    if (category) grantQuery = grantQuery.contains('categories', [category]);

    grantQuery = grantQuery.order('closes_at', { ascending: true, nullsFirst: false }).limit(limit);

    const { data: grants } = await grantQuery;
    for (const g of grants || []) {
      results.push({ ...g, _type: 'grant' });
    }
  }

  // Search foundations
  if (!type || type === 'foundation') {
    let foundationQuery = supabase
      .from('foundations')
      .select('id, name, type, total_giving_annual, thematic_focus, geographic_focus, website');

    if (q) foundationQuery = foundationQuery.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

    foundationQuery = foundationQuery.order('total_giving_annual', { ascending: false, nullsFirst: false }).limit(limit);

    const { data: foundations } = await foundationQuery;
    for (const f of foundations || []) {
      results.push({ ...f, _type: 'foundation' });
    }
  }

  // Search foundation programs
  if (!type || type === 'program') {
    let programQuery = supabase
      .from('foundation_programs')
      .select('id, name, foundation_id, amount_min, amount_max, deadline, status, url');

    if (q) programQuery = programQuery.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    programQuery = programQuery.eq('status', 'open').order('deadline', { ascending: true, nullsFirst: false }).limit(limit);

    const { data: programs } = await programQuery;
    for (const p of programs || []) {
      results.push({ ...p, _type: 'program' });
    }
  }

  return NextResponse.json({ results, count: results.length });
}
