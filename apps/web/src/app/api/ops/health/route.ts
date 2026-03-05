import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Auth check
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceSupabase();

  try {
    const [
      grantsTotal,
      grantsWithDesc,
      grantsEnriched,
      grantsEmbedded,
      grantsOpen,
      foundationsTotal,
      foundationsProfiled,
      foundationsWithWebsite,
      foundationPrograms,
      communityOrgs,
      sourceBreakdownResult,
      confidenceBreakdownResult,
      recentRuns,
      recentDiscoveryRuns,
    ] = await Promise.all([
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('description', 'is', null).gt('description', ''),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()),
      db.from('foundations').select('*', { count: 'exact', head: true }),
      db.from('foundations').select('*', { count: 'exact', head: true })
        .not('description', 'is', null),
      db.from('foundations').select('*', { count: 'exact', head: true })
        .not('website', 'is', null),
      db.from('foundation_programs').select('*', { count: 'exact', head: true }),
      db.from('community_orgs').select('*', { count: 'exact', head: true }),
      // Source breakdown — raw SQL via RPC not available, do it with group query
      db.rpc('get_grant_source_breakdown'),
      db.rpc('get_foundation_confidence_breakdown'),
      db.from('agent_runs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(20),
      db.from('grant_discovery_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      stats: {
        grants: {
          total: grantsTotal.count ?? 0,
          withDescription: grantsWithDesc.count ?? 0,
          enriched: grantsEnriched.count ?? 0,
          embedded: grantsEmbedded.count ?? 0,
          open: grantsOpen.count ?? 0,
        },
        foundations: {
          total: foundationsTotal.count ?? 0,
          profiled: foundationsProfiled.count ?? 0,
          withWebsite: foundationsWithWebsite.count ?? 0,
          programs: foundationPrograms.count ?? 0,
        },
        community: {
          orgs: communityOrgs.count ?? 0,
        },
      },
      sourceBreakdown: sourceBreakdownResult.data ?? [],
      confidenceBreakdown: confidenceBreakdownResult.data ?? [],
      recentRuns: recentRuns.data ?? [],
      discoveryRuns: recentDiscoveryRuns.data ?? [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ops/health]', err);
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
  }
}
