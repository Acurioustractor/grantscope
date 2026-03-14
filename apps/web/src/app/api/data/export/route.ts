import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * Data Export API (requires research module)
 *
 * Bulk export in CSV or JSON format.
 *
 *   GET /api/data/export?type=foundations&format=csv
 *   GET /api/data/export?type=grants&format=json
 *   GET /api/data/export?type=money-flows&domain=youth_justice&format=csv
 */

const ALLOWED_TYPES = ['entities', 'relationships', 'foundations', 'grants', 'social-enterprises', 'money-flows', 'community-orgs', 'government-programs'] as const;

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

export async function GET(request: Request) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as typeof ALLOWED_TYPES[number] | null;
  const format = searchParams.get('format') || 'csv';
  const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 10000);

  if (!type || !ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({
      error: `type must be one of: ${ALLOWED_TYPES.join(', ')}`,
      formats: ['csv', 'json'],
    }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

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
    let query = supabase.from(table).select('*').limit(limit);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.length) {
      return NextResponse.json({ message: 'No data found' }, { status: 404 });
    }

    if (format === 'csv') {
      const csv = toCSV(data as Record<string, unknown>[]);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="civicgraph-${type}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      type,
      count: data.length,
      exported_at: new Date().toISOString(),
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
