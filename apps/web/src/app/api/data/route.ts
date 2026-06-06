import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { validateApiKey, logUsage, InvalidApiKeyError } from '@/lib/api-key';
import { rateLimit } from '@/lib/rate-limit';
import {
  GIVING_SCHEMA_VERSION,
  PUBLIC_DATASET_KEYS,
  PUBLIC_DATASETS,
  PUBLIC_SNAPSHOT_DATE,
  correctionUrl,
  getPublicDataset,
  withCorsHeaders,
} from '@/lib/giving-commons';

const publicLimiter = rateLimit({ windowMs: 60_000, max: 30 });
const authenticatedLimiter = rateLimit({ windowMs: 60_000, max: 120 });

// Module-level vars set by GET handler for usage logging
let _apiKeyId: string | null = null;
let _startMs = 0;
let _ip = 'unknown';
let _rateLimitVal = 30;

/** Add rate-limit and cache headers + fire usage log */
function withPublicHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.headers.set('X-RateLimit-Limit', String(_rateLimitVal));
  response.headers.set('X-RateLimit-Window', '60');
  response.headers.set('X-CivicGraph-Schema-Version', GIVING_SCHEMA_VERSION);
  withCorsHeaders(response.headers);
  // Fire-and-forget usage log
  if (_apiKeyId) {
    logUsage(_apiKeyId, 'data-api', Date.now() - _startMs, response.status, _ip);
  }
  return response;
}

function apiEnvelope(request: Request, type: string | null, payload: Record<string, unknown>) {
  const dataset = getPublicDataset(type);
  return {
    schema_version: GIVING_SCHEMA_VERSION,
    source: dataset?.source ?? 'CivicGraph public data API',
    generated_at: new Date().toISOString(),
    snapshot_date: PUBLIC_SNAPSHOT_DATE,
    licence: dataset?.licence ?? 'Mixed public-source licences. Check the source record before reuse.',
    caveats: dataset?.caveats ?? ['Read source-specific caveats before relying on a record.'],
    correction_url: correctionUrl(new URL(request.url).origin),
    ...payload,
  };
}

function dataResponse(request: Request, type: string, payload: Record<string, unknown>, init?: ResponseInit) {
  return withPublicHeaders(NextResponse.json(apiEnvelope(request, type, payload), init));
}

function errorResponse(body: Record<string, unknown>, init: ResponseInit) {
  const response = NextResponse.json(body, init);
  withCorsHeaders(response.headers);
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
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: withCorsHeaders() });
}

export async function GET(request: Request) {
  const startMs = Date.now();

  // API key validation (optional — anonymous allowed with lower limits)
  let apiKey: Awaited<ReturnType<typeof validateApiKey>> = null;
  try {
    apiKey = await validateApiKey(request);
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      return errorResponse({ error: 'Invalid or revoked API key' }, { status: 401 });
    }
  }

  // Rate limiting — authenticated keys get 120/min, anonymous gets 30/min
  const limited = apiKey
    ? authenticatedLimiter(request)
    : publicLimiter(request);
  if (limited) {
    withCorsHeaders(limited.headers);
    return limited;
  }

  _apiKeyId = apiKey?.id ?? null;
  _startMs = startMs;
  _rateLimitVal = apiKey ? apiKey.rateLimitPerMin || 120 : 30;
  _ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip') ?? 'unknown';

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), apiKey ? 1000 : 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!type) {
    return withPublicHeaders(NextResponse.json({
      schema_version: GIVING_SCHEMA_VERSION,
      source: 'CivicGraph public data API',
      generated_at: new Date().toISOString(),
      snapshot_date: PUBLIC_SNAPSHOT_DATE,
      endpoints: {
        entities: '/api/data?type=entities&entity_type=charity&state=QLD',
        relationships: '/api/data?type=relationships&relationship_type=donated_to&min_amount=10000',
        foundations: '/api/data?type=foundations&focus=indigenous&state=qld',
        'foundation-programs': '/api/data?type=foundation-programs&status=open',
        grants: '/api/data?type=grants&status=open&min_amount=10000',
        places: '/api/data?type=places&state=QLD',
        'political-donations': '/api/data?type=political-donations&year=2024-25',
        contracts: '/api/data?type=contracts&min_value=1000000',
        'data-catalog': '/api/data?type=data-catalog',
        'social-enterprises': '/api/data?type=social-enterprises&source=supply_nation',
        'money-flows': '/api/data?type=money-flows&domain=youth_justice&year=2025',
        'community-orgs': '/api/data?type=community-orgs&domain=youth',
        'government-programs': '/api/data?type=government-programs&jurisdiction=qld',
        outcomes: '/api/data?type=outcomes&jurisdiction=QLD&domain=youth-justice',
        reports: '/api/data?type=reports',
      },
      health: '/api/data/health',
      export: '/api/data/export?type=foundations&format=csv',
      catalog: '/api/data/catalog',
      standard: '/api/data/standard',
      sources: '/api/data/sources',
      corrections: '/api/data/corrections',
      docs: 'All endpoints support limit, offset, and format (json/csv) params.',
      public_export_types: PUBLIC_DATASET_KEYS,
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'entities', { type: 'entities', data, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'relationships', { type: 'relationships', data, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'social-enterprises', { type: 'social-enterprises', data, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'foundations', { type: 'foundations', data, total: count, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'grants', { type: 'grants', data, limit, offset });
      }

      case 'foundation-programs': {
        let query = supabase
          .from('foundation_programs')
          .select('id, foundation_id, name, url, description, amount_min, amount_max, deadline, status, categories, eligibility, application_process, scraped_at, created_at')
          .order('deadline', { ascending: true, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const status = searchParams.get('status');
        if (status) query = query.eq('status', status);

        const q = searchParams.get('q');
        if (q) query = query.ilike('name', `%${q}%`);

        const category = searchParams.get('category');
        if (category) query = query.contains('categories', [category]);

        const { data, error } = await query;
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'foundation-programs', { type: 'foundation-programs', data, limit, offset });
      }

      case 'places': {
        let query = supabase
          .from('mv_funding_by_postcode')
          .select('postcode, state, remoteness, seifa_irsd_decile, locality, entity_count, community_controlled_count, total_funding, community_controlled_funding, relationship_count')
          .order('total_funding', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const state = searchParams.get('state');
        if (state) query = query.eq('state', state.toUpperCase());

        const postcode = searchParams.get('postcode');
        if (postcode) query = query.eq('postcode', postcode);

        const remoteness = searchParams.get('remoteness');
        if (remoteness) query = query.ilike('remoteness', `%${remoteness}%`);

        const { data, error } = await query;
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'places', { type: 'places', data, limit, offset });
      }

      case 'political-donations': {
        let query = supabase
          .from('political_donations')
          .select('id, financial_year, donor_name, donor_abn, donation_to, donation_date, amount, return_type, receipt_type, created_at')
          .order('amount', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const year = searchParams.get('year') || searchParams.get('financial_year');
        if (year) query = query.eq('financial_year', year);

        const donor = searchParams.get('donor');
        if (donor) query = query.ilike('donor_name', `%${donor}%`);

        const recipient = searchParams.get('recipient');
        if (recipient) query = query.ilike('donation_to', `%${recipient}%`);

        const minAmount = searchParams.get('min_amount');
        if (minAmount) query = query.gte('amount', parseInt(minAmount, 10));

        const { data, error } = await query;
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'political-donations', { type: 'political-donations', data, limit, offset });
      }

      case 'contracts': {
        let query = supabase
          .from('austender_contracts')
          .select('id, ocid, release_id, title, description, contract_value, currency, procurement_method, category, contract_start, contract_end, date_published, date_modified, buyer_name, buyer_id, supplier_name, supplier_abn, supplier_id, supplier_acnc_match, supplier_oric_match, supplier_entity_type, source_url, created_at, updated_at')
          .order('contract_value', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);

        const buyer = searchParams.get('buyer');
        if (buyer) query = query.ilike('buyer_name', `%${buyer}%`);

        const supplier = searchParams.get('supplier');
        if (supplier) query = query.ilike('supplier_name', `%${supplier}%`);

        const category = searchParams.get('category');
        if (category) query = query.ilike('category', `%${category}%`);

        const minValue = searchParams.get('min_value') || searchParams.get('min_amount');
        if (minValue) query = query.gte('contract_value', parseInt(minValue, 10));

        const q = searchParams.get('q');
        if (q) query = query.or(`title.ilike.%${q}%,buyer_name.ilike.%${q}%,supplier_name.ilike.%${q}%`);

        const { data, error } = await query;
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'contracts', { type: 'contracts', data, limit, offset });
      }

      case 'data-catalog': {
        const rows = PUBLIC_DATASET_KEYS.map((key) => {
          const dataset = PUBLIC_DATASETS[key];
          return {
            dataset_key: key,
            table_name: dataset.table,
            label: dataset.label,
            domain: dataset.domain,
            description: dataset.description,
            public_export: true,
            pii_level: dataset.piiLevel,
            licence: dataset.licence,
            source: dataset.source,
            source_url: dataset.sourceUrl,
            source_owner: dataset.sourceOwner,
            collection_method: dataset.collectionMethod,
            update_cadence: dataset.updateCadence,
            public_caveat: dataset.caveats.join(' '),
          };
        });

        return dataResponse(request, 'data-catalog', {
          type: 'data-catalog',
          data: rows.slice(offset, offset + limit),
          total: rows.length,
          limit,
          offset,
        });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'money-flows', { type: 'money-flows', data, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'community-orgs', { type: 'community-orgs', data, limit, offset });
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
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'government-programs', { type: 'government-programs', data, limit, offset });
      }

      case 'outcomes': {
        // Query outcomes metrics, optionally filtered by jurisdiction and domain
        const jurisdiction = searchParams.get('jurisdiction') || searchParams.get('state');
        const domain = searchParams.get('domain') || 'youth-justice';
        const metricName = searchParams.get('metric');

        let sql = `SELECT jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, notes
          FROM outcomes_metrics WHERE domain = '${domain.replace(/'/g, "''")}'`;
        if (jurisdiction) sql += ` AND jurisdiction = '${jurisdiction.toUpperCase().replace(/'/g, "''")}'`;
        if (metricName) sql += ` AND metric_name = '${metricName.replace(/'/g, "''")}'`;
        sql += ` ORDER BY jurisdiction, metric_name, period LIMIT ${limit} OFFSET ${offset}`;

        const { data, error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'outcomes', { type: 'outcomes', data, limit, offset });
      }

      case 'reports': {
        const { data, error } = await supabase
          .from('reports')
          .select('slug, title, description, domain, last_generated_at')
          .order('last_generated_at', { ascending: false });

        if (error) return errorResponse({ error: error.message }, { status: 500 });
        return dataResponse(request, 'reports', { type: 'reports', data });
      }

      default:
        return errorResponse({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse({ error: message }, { status: 500 });
  }
}
