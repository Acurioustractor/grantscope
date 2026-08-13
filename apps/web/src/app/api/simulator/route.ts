import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const getCachedSimulatorData = unstable_cache(async () => {
  const supabase = getServiceSupabase();

  const [sectorResult, geoResult, tierResult, sourceResult] = await Promise.all([
    supabase.rpc('dashboard_sector_distribution'),
    supabase.rpc('dashboard_geographic_distribution'),
    supabase.rpc('dashboard_foundation_tiers'),
    supabase.rpc('dashboard_source_coverage'),
  ]);

  const sectors = ((sectorResult.data || []) as Array<{ sector: string; count: number | string; total_giving: number | string }>)
    .map((row) => ({
      sector: row.sector,
      count: Number(row.count),
      avgGiving: Number(row.count) > 0 ? Math.round(Number(row.total_giving) / Number(row.count)) : 0,
      totalGiving: Math.round(Number(row.total_giving)),
    }));
  const geography = ((geoResult.data || []) as Array<{ geo: string; count: number | string; total_giving: number | string }>)
    .map((row) => ({
      region: row.geo,
      code: row.geo,
      count: Number(row.count),
      totalGiving: Math.round(Number(row.total_giving)),
    }));
  const tiers = ((tierResult.data || []) as Array<{ tier: string; count: number | string; avg_giving: number | string; total_giving: number | string; color: string }>)
    .map((row) => ({
      tier: row.tier,
      count: Number(row.count),
      avgGiving: Math.round(Number(row.avg_giving)),
      totalGiving: Math.round(Number(row.total_giving)),
      color: row.color,
    }));
  const sources = ((sourceResult.data || []) as Array<{ source: string; count: number | string; total_funding: number | string; type: string }>)
    .map((row) => ({
      source: row.source,
      count: Number(row.count),
      totalFunding: Math.round(Number(row.total_funding)),
      type: row.type,
    }));

  return { sectors, geography, tiers, sources };
}, ['simulator-api-data-v1'], { revalidate: 900 });

export async function GET() {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  try {
    const response = NextResponse.json(await getCachedSimulatorData());
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    console.error('[simulator]', err);
    return NextResponse.json({ error: 'Failed to load simulator data' }, { status: 500 });
  }
}
