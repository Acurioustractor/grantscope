import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type CatalogRow = {
  table_name: string;
  domain: string;
  owner_team: string;
  description: string | null;
  source_of_truth: boolean;
  pii_level: string;
  sla_hours: number;
  freshness_key: string | null;
  provenance_field: string | null;
  confidence_field: string | null;
  active: boolean;
  snapshot_at: string | null;
  row_count: number | null;
  freshness_hours: number | null;
  provenance_coverage_pct: number | null;
  confidence_coverage_pct: number | null;
};

function computeStatus(row: CatalogRow): 'fresh' | 'warning' | 'stale' | 'unknown' | 'no_snapshot' {
  if (!row.snapshot_at) return 'no_snapshot';
  if (row.freshness_hours === null || Number.isNaN(Number(row.freshness_hours))) return 'unknown';
  if (row.freshness_hours <= row.sla_hours) return 'fresh';
  if (row.freshness_hours <= row.sla_hours * 1.5) return 'warning';
  return 'stale';
}

export async function GET(request: Request) {
  try {
    const db = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const domain = searchParams.get('domain');
    const ownerTeam = searchParams.get('owner_team');
    const active = searchParams.get('active');
    const staleOnly = searchParams.get('stale') === 'true';

    let query = db
      .from('v_data_catalog_latest')
      .select('*')
      .order('domain', { ascending: true })
      .order('table_name', { ascending: true });

    if (domain) query = query.eq('domain', domain);
    if (ownerTeam) query = query.eq('owner_team', ownerTeam);
    if (active === 'true') query = query.eq('active', true);
    if (active === 'false') query = query.eq('active', false);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to load data catalog',
          detail: error.message,
        },
        { status: 500 },
      );
    }

    const rows = ((data ?? []) as CatalogRow[]).map((row) => ({
      ...row,
      status: computeStatus(row),
    }));

    const filtered = staleOnly ? rows.filter((row) => row.status === 'stale') : rows;
    const summary = {
      total: filtered.length,
      fresh: filtered.filter((row) => row.status === 'fresh').length,
      warning: filtered.filter((row) => row.status === 'warning').length,
      stale: filtered.filter((row) => row.status === 'stale').length,
      unknown: filtered.filter((row) => row.status === 'unknown').length,
      no_snapshot: filtered.filter((row) => row.status === 'no_snapshot').length,
      by_domain: filtered.reduce<Record<string, number>>((acc, row) => {
        acc[row.domain] = (acc[row.domain] ?? 0) + 1;
        return acc;
      }, {}),
    };

    const response = NextResponse.json({
      captured_at: new Date().toISOString(),
      summary,
      rows: filtered,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Unexpected catalog error',
        detail: message,
      },
      { status: 500 },
    );
  }
}
