import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/** Add rate-limit and cache headers to public data responses */
function withPublicHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.headers.set('X-RateLimit-Limit', '60');
  response.headers.set('X-RateLimit-Window', '60');
  return response;
}

/**
 * Public Data API
 *
 * RESTful API for querying CivicGraph data.
 * Rate-limited: 60 requests/minute per IP (enforced at edge).
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
    return withPublicHeaders(NextResponse.json({
      endpoints: {
        entities: '/api/data?type=entities&entity_type=charity&state=QLD',
        relationships: '/api/data?type=relationships&relationship_type=donated_to&min_amount=10000',
        foundations: '/api/data?type=foundations&focus=indigenous&state=qld',
        grants: '/api/data?type=grants&status=open&min_amount=10000',
        'social-enterprises': '/api/data?type=social-enterprises&source=supply_nation',
        'money-flows': '/api/data?type=money-flows&domain=youth_justice&year=2025',
        'community-orgs': '/api/data?type=community-orgs&domain=youth',
        'government-programs': '/api/data?type=government-programs&jurisdiction=qld',
        reports: '/api/data?type=reports',
      },
      health: '/api/data/health',
      export: '/api/data/export?type=foundations&format=csv',
      docs: 'All endpoints support limit, offset, and format (json/csv) params.',
    }));
  }

  try {
    const supabase = getServiceSupabase();

    switch (type) {
      case 'entities': {
        let query = supabase
          .from('gs_entities')
          .select('gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, lga_name, is_community_controlled, website, description, created_at')
          .order('canonical_name', { ascending: true })
          .range(offset, offset + limit - 1);

        const entityType = searchParams.get('entity_type');
        if (entityType) query = query.eq('entity_type', entityType);

        const state = searchParams.get('state');
        if (state) query = query.eq('state', state.toUpperCase());

        const postcode = searchParams.get('postcode');
        if (postcode) query = query.eq('postcode', postcode);

        const abn = searchParams.get('abn');
        if (abn) query = query.eq('abn', abn);

        const search = searchParams.get('q');
        if (search) query = query.ilike('canonical_name', `%${search}%`);

        const communityControlled = searchParams.get('community_controlled');
        if (communityControlled === 'true') query = query.eq('is_community_controlled', true);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return withPublicHeaders(NextResponse.json({ type: 'entities', data, limit, offset }));
      }

      case 'relationships': {
        let query = supabase
          .from('gs_relationships')
          .select('id, source_entity_id, target_entity_id, relationship_type, amount, year, dataset, created_at')
          .order('amount', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const relType = searchParams.get('relationship_type');
        if (relType) query = query.eq('relationship_type', relType);

        const dataset = searchParams.get('dataset');
        if (dataset) query = query.eq('dataset', dataset);

        const minAmount = searchParams.get('min_amount');
        if (minAmount) query = query.gte('amount', parseInt(minAmount, 10));

        const year = searchParams.get('year');
        if (year) query = query.eq('year', parseInt(year, 10));

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return withPublicHeaders(NextResponse.json({ type: 'relationships', data, limit, offset }));
      }

      case 'social-enterprises': {
        let query = supabase
          .from('social_enterprises')
          .select('id, name, abn, source_primary, sector, state, postcode, website, description, is_indigenous, created_at')
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);

        const source = searchParams.get('source');
        if (source) query = query.eq('source_primary', source);

        const seState = searchParams.get('state');
        if (seState) query = query.eq('state', seState.toUpperCase());

        const indigenous = searchParams.get('indigenous');
        if (indigenous === 'true') query = query.eq('is_indigenous', true);

        const seSearch = searchParams.get('q');
        if (seSearch) query = query.ilike('name', `%${seSearch}%`);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return withPublicHeaders(NextResponse.json({ type: 'social-enterprises', data, limit, offset }));
      }

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
        return withPublicHeaders(NextResponse.json({ type: 'foundations', data, total: count, limit, offset }));
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
        return withPublicHeaders(NextResponse.json({ type: 'grants', data, limit, offset }));
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
        return withPublicHeaders(NextResponse.json({ type: 'money-flows', data, limit, offset }));
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
        return withPublicHeaders(NextResponse.json({ type: 'community-orgs', data, limit, offset }));
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
        return withPublicHeaders(NextResponse.json({ type: 'government-programs', data, limit, offset }));
      }

      case 'reports': {
        const { data, error } = await supabase
          .from('reports')
          .select('slug, title, description, domain, last_generated_at')
          .order('last_generated_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return withPublicHeaders(NextResponse.json({ type: 'reports', data }));
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
