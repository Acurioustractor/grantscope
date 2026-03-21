import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { whitelist } from '@/lib/sql';

export const dynamic = 'force-dynamic';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

const schema = z.object({
  state: z.string().optional(),
  metric: z.string().max(50).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const safeState = whitelist(parsed.data.state?.toUpperCase() ?? null, STATES, null as unknown as typeof STATES[number]);
  const metric = parsed.data.metric || 'desert_score';

  try {
    const supabase = getServiceSupabase();

    const stateClause = safeState
      ? `AND UPPER(state) = '${safeState}'`
      : '';

    const { data, error } = await supabase.rpc('exec_sql', {
      query: `WITH lga_centroids AS (
        SELECT lga_name, lga_code, UPPER(state) as state,
               AVG(latitude::float) as lat,
               AVG(longitude::float) as lng
        FROM postcode_geo
        WHERE lga_name IS NOT NULL AND latitude IS NOT NULL
        GROUP BY lga_name, lga_code, UPPER(state)
      ),
      deduped_deserts AS (
        SELECT DISTINCT ON (lga_name, UPPER(state))
          lga_name, UPPER(state) as state, remoteness,
          avg_irsd_decile, avg_irsd_score,
          indexed_entities, community_controlled_entities,
          total_funding_all_sources, desert_score
        FROM mv_funding_deserts
        WHERE desert_score IS NOT NULL ${stateClause}
        ORDER BY lga_name, UPPER(state), desert_score DESC
      )
      SELECT dd.lga_name, dd.state, dd.remoteness,
             dd.avg_irsd_decile, dd.avg_irsd_score,
             dd.indexed_entities, dd.community_controlled_entities,
             dd.total_funding_all_sources, dd.desert_score,
             lc.lat, lc.lng, lc.lga_code
      FROM deduped_deserts dd
      LEFT JOIN lga_centroids lc ON dd.lga_name = lc.lga_name AND dd.state = lc.state
      WHERE lc.lat IS NOT NULL
      ORDER BY dd.desert_score DESC`,
    });

    if (error) throw error;

    // Compute summary stats
    const features = (data || []) as Array<{
      lga_name: string; state: string; remoteness: string;
      avg_irsd_decile: number; desert_score: number;
      indexed_entities: number; community_controlled_entities: number;
      total_funding_all_sources: number; lat: number; lng: number;
    }>;

    const summary = {
      total_lgas: features.length,
      severe_deserts: features.filter(f => Number(f.desert_score) > 100).length,
      avg_desert_score: features.length > 0
        ? (features.reduce((s, f) => s + Number(f.desert_score), 0) / features.length).toFixed(1)
        : '0',
      max_desert_score: features.length > 0
        ? Math.max(...features.map(f => Number(f.desert_score))).toFixed(1)
        : '0',
    };

    const response = NextResponse.json({ features, summary, metric });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('Map data error:', error);
    return NextResponse.json({ error: 'Failed to fetch map data' }, { status: 500 });
  }
}
