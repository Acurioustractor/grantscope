import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  GIVING_SCHEMA_VERSION,
  PUBLIC_DATASET_KEYS,
  PUBLIC_SNAPSHOT_DATE,
  correctionUrl,
  getPublicDataset,
  withCorsHeaders,
} from '@/lib/giving-commons';

/**
 * Data Export API
 *
 * Public bulk export is allowed only for the Australian Giving Data Commons
 * allowlist. Any other dataset still requires the research module.
 *
 *   GET /api/data/export?type=foundations&format=csv
 *   GET /api/data/export?type=grants&format=json
 *   GET /api/data/export?type=money-flows&domain=youth_justice&format=csv (auth)
 */

const ALLOWED_TYPES = ['entities', 'relationships', 'foundations', 'grants', 'social-enterprises', 'money-flows', 'community-orgs', 'government-programs'] as const;
const FORMATS = ['csv', 'json'] as const;
const publicExportLimiter = rateLimit({ windowMs: 60_000, max: 20 });
const DEFAULT_EXPORT_LIMIT = 1000;
const MAX_PUBLIC_EXPORT_LIMIT = 1000;
const MAX_AUTHENTICATED_EXPORT_LIMIT = 10000;
const MAX_EXPORT_OFFSET = 5000;

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function corsJson(body: unknown, init: ResponseInit = {}) {
  const headers = withCorsHeaders(new Headers(init.headers));
  return NextResponse.json(body, { ...init, headers });
}

function safeSearchTerm(value: string) {
  return value.replace(/[,%]/g, ' ').trim().slice(0, 120);
}

function withExportHeaders(response: NextResponse, type: string, format: string, origin: string) {
  withCorsHeaders(response.headers);
  response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  response.headers.set('X-CivicGraph-Schema-Version', GIVING_SCHEMA_VERSION);
  response.headers.set('X-CivicGraph-Snapshot-Date', PUBLIC_SNAPSHOT_DATE);
  response.headers.set('X-CivicGraph-Correction-Url', correctionUrl(origin));
  response.headers.set('Content-Disposition', `attachment; filename="civicgraph-${type}-${PUBLIC_SNAPSHOT_DATE}.${format}"`);
  return response;
}

// Supabase's fluent builder type changes after select/range/filter calls. Keep
// this helper typed loosely so the allowlist logic stays readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPublicFilters(query: any, type: string, searchParams: URLSearchParams) {
  let filtered = query;

  const state = searchParams.get('state');
  if (state) {
    if (type === 'entities' || type === 'places' || type === 'social-enterprises') filtered = filtered.eq('state', state.toUpperCase());
    if (type === 'foundations') filtered = filtered.contains('geographic_focus', [`AU-${state.toUpperCase()}`]);
  }

  const source = searchParams.get('source');
  if (source && type === 'social-enterprises') filtered = filtered.eq('source_primary', source);

  const postcode = searchParams.get('postcode');
  if (postcode && (type === 'entities' || type === 'places')) {
    filtered = filtered.eq('postcode', postcode);
  }

  const year = searchParams.get('year');
  if (year && type === 'relationships') filtered = filtered.eq('year', parseInt(year, 10));
  if (year && type === 'political-donations') filtered = filtered.eq('financial_year', year);

  const relationshipType = searchParams.get('relationship_type');
  if (relationshipType && type === 'relationships') filtered = filtered.eq('relationship_type', relationshipType);

  const entityType = searchParams.get('entity_type');
  if (entityType && type === 'entities') filtered = filtered.eq('entity_type', entityType);

  const status = searchParams.get('status');
  if (status && type === 'foundation-programs') filtered = filtered.eq('status', status);

  const domain = searchParams.get('domain');
  if (domain && type === 'data-catalog') filtered = filtered.eq('domain', domain);

  const q = safeSearchTerm(searchParams.get('q') || searchParams.get('search') || '');
  if (!q) return filtered;

  if (type === 'entities') return filtered.ilike('canonical_name', `%${q}%`);
  if (type === 'foundations') return filtered.ilike('name', `%${q}%`);
  if (type === 'foundation-programs') return filtered.ilike('name', `%${q}%`);
  if (type === 'social-enterprises') return filtered.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (type === 'grants') return filtered.or(`name.ilike.%${q}%,provider.ilike.%${q}%,program.ilike.%${q}%`);
  if (type === 'contracts') return filtered.or(`title.ilike.%${q}%,buyer_name.ilike.%${q}%,supplier_name.ilike.%${q}%`);
  if (type === 'political-donations') return filtered.or(`donor_name.ilike.%${q}%,donation_to.ilike.%${q}%`);
  if (type === 'data-catalog') return filtered.or(`table_name.ilike.%${q}%,description.ilike.%${q}%`);

  return filtered;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: withCorsHeaders() });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = new URL(request.url).origin;
  const type = searchParams.get('type');
  const format = searchParams.get('format') || 'csv';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || String(DEFAULT_EXPORT_LIMIT), 10);
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);

  if (!type) {
    return corsJson({
      error: `type must be one of public datasets: ${PUBLIC_DATASET_KEYS.join(', ')}`,
      formats: FORMATS,
    }, { status: 400 });
  }

  if (!FORMATS.includes(format as typeof FORMATS[number])) {
    return corsJson({ error: 'format must be csv or json' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const publicDataset = getPublicDataset(type);

    if (publicDataset) {
      const limited = publicExportLimiter(request);
      if (limited) {
        withCorsHeaders(limited.headers);
        return limited;
      }

      const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_EXPORT_LIMIT, 1), MAX_PUBLIC_EXPORT_LIMIT);
      const offset = Math.min(Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0), MAX_EXPORT_OFFSET);

      if (type === 'data-catalog') {
        const rows = PUBLIC_DATASET_KEYS.map((key) => {
          const dataset = getPublicDataset(key)!;
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

        if (format === 'csv') {
          return withExportHeaders(
            new NextResponse(toCSV(rows), {
              headers: { 'Content-Type': 'text/csv; charset=utf-8' },
            }),
            type,
            format,
            origin,
          );
        }

        const response = NextResponse.json({
          schema_version: GIVING_SCHEMA_VERSION,
          type,
          source: publicDataset.source,
          generated_at: new Date().toISOString(),
          snapshot_date: PUBLIC_SNAPSHOT_DATE,
          licence: publicDataset.licence,
          caveats: publicDataset.caveats,
          correction_url: correctionUrl(origin),
          count: rows.length,
          total: rows.length,
          limit,
          offset,
          data: rows.slice(offset, offset + limit),
        });
        return withExportHeaders(response, type, format, origin);
      }

      let query = supabase
        .from(publicDataset.table)
        .select(publicDataset.select, { count: 'exact' })
        .range(offset, offset + limit - 1);

      query = applyPublicFilters(query, type, searchParams);

      if (publicDataset.orderBy) {
        query = query.order(publicDataset.orderBy, {
          ascending: publicDataset.orderAscending ?? true,
          nullsFirst: false,
        });
      }

      const { data, count, error } = await query;

      if (error) {
        return corsJson({ error: error.message }, { status: 500 });
      }

      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (format === 'csv') {
        return withExportHeaders(
          new NextResponse(toCSV(rows), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
          }),
          type,
          format,
          origin,
        );
      }

      const response = NextResponse.json({
        schema_version: GIVING_SCHEMA_VERSION,
        type,
        source: publicDataset.source,
        generated_at: new Date().toISOString(),
        snapshot_date: PUBLIC_SNAPSHOT_DATE,
        licence: publicDataset.licence,
        caveats: publicDataset.caveats,
        correction_url: correctionUrl(origin),
        count: rows.length,
        total: count,
        limit,
        offset,
        data: rows,
      });
      return withExportHeaders(response, type, format, origin);
    }

    const auth = await requireModule('research');
    if (auth.error) {
      withCorsHeaders(auth.error.headers);
      return auth.error;
    }

    if (!ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
      return corsJson({
        error: `Authenticated export type must be one of: ${ALLOWED_TYPES.join(', ')}`,
        public_types: PUBLIC_DATASET_KEYS,
        formats: FORMATS,
      }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_EXPORT_LIMIT, 1), MAX_AUTHENTICATED_EXPORT_LIMIT);
    const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);

    const tableMap: Record<string, string> = {
      entities: 'gs_entities',
      relationships: 'gs_relationships',
      foundations: 'foundations',
      grants: 'grant_opportunities',
      'social-enterprises': 'social_enterprises',
      'money-flows': 'money_flows',
      'community-orgs': 'community_orgs',
      'government-programs': 'government_programs',
    };

    const table = tableMap[type];
    let query = supabase.from(table).select('*').range(offset, offset + limit - 1);

    // Apply filters
    const domain = searchParams.get('domain');
    if (domain) {
      if (type === 'money-flows' || type === 'government-programs') {
        query = query.eq('domain', domain);
      } else if (type === 'community-orgs') {
        query = query.contains('domain', [domain]);
      }
    }

    const jurisdiction = searchParams.get('jurisdiction');
    if (jurisdiction && type === 'government-programs') {
      query = query.eq('jurisdiction', jurisdiction);
    }

    const { data, error } = await query;

    if (error) {
      return corsJson({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    if (format === 'csv') {
      return withExportHeaders(new NextResponse(toCSV(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
        },
      }), type, format, origin);
    }

    // JSON format
    const response = NextResponse.json({
      type,
      count: rows.length,
      exported_at: new Date().toISOString(),
      limit,
      offset,
      data: rows,
    });
    return withExportHeaders(response, type, format, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return corsJson({ error: message }, { status: 500 });
  }
}
