import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const [worstResult, bestResult, remotenessResult, stateResult, summaryResult] = await Promise.all([
      // Worst 30 funding deserts (deduplicated by LGA)
      supabase.rpc('exec_sql', {
        query: `SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, avg_irsd_score, indexed_entities, community_controlled_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score DESC`,
      }),
      // Best funded (lowest desert score)
      supabase.rpc('exec_sql', {
        query: `SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score ASC`,
      }),
      // By remoteness
      supabase.rpc('exec_sql', {
        query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL AND remoteness IS NOT NULL AND remoteness != '' ORDER BY lga_name, state, desert_score DESC) SELECT remoteness, COUNT(*) as lga_count, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(AVG(total_funding_all_sources)::numeric,0) as avg_funding, SUM(indexed_entities) as total_entities, ROUND(MIN(desert_score)::numeric,1) as min_desert, ROUND(MAX(desert_score)::numeric,1) as max_desert FROM deduped GROUP BY remoteness ORDER BY avg_desert_score DESC`,
      }),
      // By state
      supabase.rpc('exec_sql', {
        query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL AND state IS NOT NULL AND state != '' ORDER BY lga_name, state, desert_score DESC) SELECT state, COUNT(*) as lga_count, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(SUM(total_funding_all_sources)::numeric,0) as total_funding, SUM(indexed_entities) as total_entities FROM deduped GROUP BY state ORDER BY avg_desert_score DESC`,
      }),
      // Summary stats
      supabase.rpc('exec_sql', {
        query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score DESC) SELECT COUNT(*) as total_lgas, COUNT(CASE WHEN desert_score > 100 THEN 1 END) as severe_deserts, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(MAX(total_funding_all_sources)::numeric,0) as max_funding, ROUND(MIN(CASE WHEN total_funding_all_sources > 0 THEN total_funding_all_sources END)::numeric,0) as min_funding FROM deduped`,
      }),
    ]);

    // Sort worst/best after DISTINCT ON
    const allDeserts = (worstResult.data as Record<string, unknown>[]) || [];
    const allBest = (bestResult.data as Record<string, unknown>[]) || [];
    const worst30 = [...allDeserts].sort((a, b) => Number(b.desert_score) - Number(a.desert_score)).slice(0, 30);
    const best10 = [...allBest].sort((a, b) => Number(a.desert_score) - Number(b.desert_score)).slice(0, 10);
    const worst10 = [...allDeserts].sort((a, b) => Number(b.desert_score) - Number(a.desert_score)).slice(0, 10);

    return NextResponse.json({
      worst30,
      best10,
      worst10,
      byRemoteness: remotenessResult.data || [],
      byState: stateResult.data || [],
      summary: (summaryResult.data as Record<string, unknown>[])?.[0] || {},
    });
  } catch (error) {
    console.error('Funding deserts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch funding desert data' }, { status: 500 });
  }
}
