import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Public Data API
 *
 * RESTful API for querying GrantScope data.
 *
 * Endpoints (via `type` param):
 *   GET /api/data?type=foundations&focus=indigenous&state=qld&limit=50
 *   GET /api/data?type=grants&status=open&min_amount=10000
 *   GET /api/data?type=money-flows&domain=youth_justice&year=2025
 *   GET /api/data?type=community-orgs&domain=youth&limit=50
 *   GET /api/data?type=government-programs&jurisdiction=qld
 *   GET /api/data?type=reports
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!type) {
    return NextResponse.json({
      endpoints: {
        foundations: '/api/data?type=foundations&focus=indigenous&state=qld',
        grants: '/api/data?type=grants&status=open&min_amount=10000',
        'money-flows': '/api/data?type=money-flows&domain=youth_justice&year=2025',
        'community-orgs': '/api/data?type=community-orgs&domain=youth',
        'government-programs': '/api/data?type=government-programs&jurisdiction=qld',
        reports: '/api/data?type=reports',
      },
      export: '/api/data/export?type=foundations&format=csv',
      docs: 'All endpoints support limit, offset, and format (json/csv) params.',
    });
  }

  try {
    const supabase = getServiceSupabase();

    switch (type) {
      case 'foundations': {
        let query = supabase
          .from('foundations')
          .select('id, name, type, website, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, created_at')
          .order('total_giving_annual', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const focus = searchParams.get('focus');
        if (focus) query = query.contains('thematic_focus', [focus]);

        const state = searchParams.get('state');
        if (state) query = query.contains('geographic_focus', [`AU-${state.toUpperCase()}`]);

        const { data, count, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'foundations', data, total: count, limit, offset });
      }

      case 'grants': {
        let query = supabase
          .from('grant_opportunities')
          .select('id, name, provider, program, amount_min, amount_max, closes_at, url, categories, geography, discovery_method, created_at')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const minAmount = searchParams.get('min_amount');
        if (minAmount) query = query.gte('amount_max', parseInt(minAmount, 10));

        const maxAmount = searchParams.get('max_amount');
        if (maxAmount) query = query.lte('amount_max', parseInt(maxAmount, 10));

        const category = searchParams.get('category');
        if (category) query = query.contains('categories', [category]);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'grants', data, limit, offset });
      }

      case 'money-flows': {
        let query = supabase
          .from('money_flows')
          .select('*')
          .order('amount', { ascending: false })
          .range(offset, offset + limit - 1);

        const domain = searchParams.get('domain');
        if (domain) query = query.eq('domain', domain);

        const year = searchParams.get('year');
        if (year) query = query.eq('year', parseInt(year, 10));

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'money-flows', data, limit, offset });
      }

      case 'community-orgs': {
        let query = supabase
          .from('community_orgs')
          .select('id, name, website, domain, geographic_focus, annual_revenue, annual_funding_received, admin_burden_cost, profile_confidence')
          .order('annual_revenue', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const domain = searchParams.get('domain');
        if (domain) query = query.contains('domain', [domain]);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'community-orgs', data, limit, offset });
      }

      case 'government-programs': {
        let query = supabase
          .from('government_programs')
          .select('*')
          .order('budget_annual', { ascending: false })
          .range(offset, offset + limit - 1);

        const jurisdiction = searchParams.get('jurisdiction');
        if (jurisdiction) query = query.eq('jurisdiction', jurisdiction);

        const domain = searchParams.get('domain');
        if (domain) query = query.eq('domain', domain);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'government-programs', data, limit, offset });
      }

      case 'reports': {
        const { data, error } = await supabase
          .from('reports')
          .select('slug, title, description, domain, last_generated_at')
          .order('last_generated_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ type: 'reports', data });
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
