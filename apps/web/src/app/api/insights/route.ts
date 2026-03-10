import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/insights
 *
 * Live system-wide statistics for the GrantScope data platform.
 * Powers the /insights page with real-time numbers.
 */
export async function GET() {
  const supabase = getServiceSupabase();

  // Run all queries in parallel
  const [
    entityCount,
    relationshipCount,
    seCount,
    seBySource,
    seBySector,
    entityByType,
    contractStats,
    justiceStats,
    donationStats,
    grantCount,
    foundationCount,
    foundationEnriched,
    communityControlled,
    remoteEntities,
    disadvantagedEntities,
    topLgasBySE,
    topGaps,
  ] = await Promise.all([
    supabase.from('gs_entities').select('*', { count: 'exact', head: true }),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.rpc('exec_sql', { query: `
      SELECT source_primary, COUNT(*) as count, COUNT(abn) as with_abn
      FROM social_enterprises GROUP BY source_primary ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT unnest(sector) as sector, COUNT(*) as count
      FROM social_enterprises WHERE sector IS NOT NULL
      GROUP BY sector ORDER BY count DESC LIMIT 15
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT entity_type, COUNT(*) as count FROM gs_entities GROUP BY entity_type ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count, COALESCE(SUM(contract_value), 0) as total_value FROM austender_contracts
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count, COALESCE(SUM(amount_dollars), 0) as total_value FROM justice_funding
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM political_donations
    `}),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count FROM foundations WHERE description IS NOT NULL
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count FROM gs_entities WHERE is_community_controlled = true
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT remoteness, COUNT(*) as count FROM gs_entities
      WHERE remoteness IN ('Remote Australia', 'Very Remote Australia')
      GROUP BY remoteness ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*) as count FROM gs_entities WHERE seifa_irsd_decile <= 3
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT e.lga_name, COUNT(DISTINCT se.id) as se_count, COUNT(DISTINCT e.id) as entity_count
      FROM gs_entities e
      JOIN social_enterprises se ON se.abn = e.abn
      WHERE e.lga_name IS NOT NULL AND se.abn IS NOT NULL
      GROUP BY e.lga_name
      ORDER BY se_count DESC LIMIT 15
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT postcode, state, remoteness, seifa_irsd_decile, entity_count, total_funding, gap_score
      FROM get_funding_gaps(NULL, NULL, 10)
    `}).then(res => res, () => ({ data: [] })),
  ]);

  const insights = {
    entities: {
      total: entityCount.count || 0,
      by_type: entityByType.data || [],
      community_controlled: communityControlled.data?.[0]?.count || 0,
      remote: remoteEntities.data || [],
      most_disadvantaged: disadvantagedEntities.data?.[0]?.count || 0,
    },
    relationships: {
      total: relationshipCount.count || 0,
    },
    social_enterprises: {
      total: seCount.count || 0,
      by_source: seBySource.data || [],
      by_sector: seBySector.data || [],
      top_lgas: topLgasBySE.data || [],
    },
    money_flows: {
      contracts: {
        records: contractStats.data?.[0]?.count || 0,
        total_value: contractStats.data?.[0]?.total_value || 0,
      },
      justice_funding: {
        records: justiceStats.data?.[0]?.count || 0,
        total_value: justiceStats.data?.[0]?.total_value || 0,
      },
      political_donations: {
        records: donationStats.data?.[0]?.count || 0,
        total_value: donationStats.data?.[0]?.total_value || 0,
      },
      grant_opportunities: grantCount.count || 0,
    },
    foundations: {
      total: foundationCount.count || 0,
      enriched: foundationEnriched.data?.[0]?.count || 0,
    },
    funding_gaps: {
      top_underserved: topGaps.data || [],
    },
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json(insights, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
