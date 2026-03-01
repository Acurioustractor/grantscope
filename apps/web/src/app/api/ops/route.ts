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
      grantsEmbedded,
      grantsEnriched,
      grantsOpen,
      foundationsTotal,
      foundationsProfiled,
      foundationsWithWebsite,
      communityOrgs,
      acncDistinctAbns,
      foundationPrograms,
      recentRuns,
    ] = await Promise.all([
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()),
      db.from('foundations').select('*', { count: 'exact', head: true }),
      db.from('foundations').select('*', { count: 'exact', head: true }).not('last_scraped_at', 'is', null),
      db.from('foundations').select('*', { count: 'exact', head: true }).not('website', 'is', null),
      db.from('community_orgs').select('*', { count: 'exact', head: true }),
      db.from('acnc_ais').select('abn', { count: 'exact', head: true }),
      db.from('foundation_programs').select('*', { count: 'exact', head: true }),
      db.from('agent_runs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(20),
    ]);

    return NextResponse.json({
      health: {
        grants: {
          total: grantsTotal.count ?? 0,
          embedded: grantsEmbedded.count ?? 0,
          enriched: grantsEnriched.count ?? 0,
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
          acncRecords: acncDistinctAbns.count ?? 0,
        },
      },
      recentRuns: recentRuns.data ?? [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ops]', err);
    return NextResponse.json({ error: 'Failed to load ops data' }, { status: 500 });
  }
}
