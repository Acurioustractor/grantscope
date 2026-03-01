import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();

  try {
    const [
      grantsResult,
      foundationsResult,
      profiledResult,
      embeddedResult,
      communityResult,
      sectorResult,
      geoResult,
      topFoundationsResult,
      closingSoonResult,
      sourceResult,
    ] = await Promise.all([
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }),
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
      supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
      supabase.rpc('dashboard_sector_distribution'),
      supabase.rpc('dashboard_geographic_distribution'),
      supabase
        .from('foundations')
        .select('name, total_giving_annual, type, profile_confidence')
        .not('total_giving_annual', 'is', null)
        .order('total_giving_annual', { ascending: false })
        .limit(15),
      supabase
        .from('grant_opportunities')
        .select('id, name, provider, closes_at, amount_max')
        .gt('closes_at', new Date().toISOString())
        .lt('closes_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('closes_at', { ascending: true })
        .limit(10),
      supabase.rpc('dashboard_source_coverage'),
    ]);

    return NextResponse.json({
      stats: {
        totalGrants: grantsResult.count || 0,
        totalFoundations: foundationsResult.count || 0,
        profiledFoundations: profiledResult.count || 0,
        embeddedGrants: embeddedResult.count || 0,
        communityOrgs: communityResult.count || 0,
      },
      sectors: sectorResult.data || [],
      geography: geoResult.data || [],
      topFoundations: topFoundationsResult.data || [],
      closingSoon: closingSoonResult.data || [],
      sources: sourceResult.data || [],
    });
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
