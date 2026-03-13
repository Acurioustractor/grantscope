import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/places/gaps?state=QLD&remoteness=remote&limit=20
 *
 * Returns postcodes ranked by funding gap score.
 * Gap score = f(funding_amount, external_provider_share, seifa_disadvantage, community_org_count)
 *
 * Higher score = bigger gap between community need and community-controlled funding share.
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const remoteness = searchParams.get('remoteness');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 500);

  const supabase = getServiceSupabase();

  // Use the materialized view if it exists, otherwise fall back to direct query
  const { data, error } = await supabase.rpc('get_funding_gaps', {
    p_state: state || null,
    p_remoteness: remoteness || null,
    p_limit: limit,
  });

  if (error) {
    // Fallback: query directly if RPC doesn't exist yet
    if (error.message.includes('function') || error.message.includes('does not exist')) {
      return await fallbackGapQuery(supabase, state, remoteness, limit);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with lat/lng from postcode_geo
  const postcodes = (data || []).map((d: Record<string, unknown>) => d.postcode as string);
  const geoLookup = new Map<string, { lat: number; lng: number; locality: string }>();

  for (let i = 0; i < postcodes.length; i += 100) {
    const chunk = postcodes.slice(i, i + 100);
    const { data: geoData } = await supabase
      .from('postcode_geo')
      .select('postcode, latitude, longitude, locality')
      .in('postcode', chunk)
      .not('latitude', 'is', null);
    for (const g of geoData || []) {
      geoLookup.set(g.postcode, { lat: g.latitude, lng: g.longitude, locality: g.locality || '' });
    }
  }

  const enriched = (data || []).map((d: Record<string, unknown>) => {
    const geo = geoLookup.get(d.postcode as string);
    return { ...d, lat: geo?.lat || null, lng: geo?.lng || null, locality: geo?.locality || null };
  });

  return NextResponse.json({ postcodes: enriched });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fallbackGapQuery(supabase: any, state: string | null, remoteness: string | null, limit: number) {
  // Get all postcodes with entities and their SEIFA data
  let query = supabase
    .from('gs_entities')
    .select('postcode, is_community_controlled, state')
    .not('postcode', 'is', null);

  if (state) query = query.eq('state', state);

  const { data: entities } = await query.limit(5000);
  if (!entities?.length) {
    return NextResponse.json({ postcodes: [] });
  }

  // Aggregate by postcode
  const byPostcode = new Map<string, { total: number; community: number; state: string }>();
  for (const e of entities) {
    const existing = byPostcode.get(e.postcode) || { total: 0, community: 0, state: e.state || '' };
    existing.total++;
    if (e.is_community_controlled) existing.community++;
    byPostcode.set(e.postcode, existing);
  }

  // Get SEIFA for these postcodes
  const postcodes = Array.from(byPostcode.keys());
  const seifaMap = new Map<string, number>();

  for (let i = 0; i < postcodes.length; i += 100) {
    const chunk = postcodes.slice(i, i + 100);
    const { data: seifaData } = await supabase
      .from('seifa_2021')
      .select('postcode, decile_national')
      .in('postcode', chunk)
      .eq('index_type', 'IRSD');
    for (const s of seifaData || []) {
      seifaMap.set(s.postcode, s.decile_national);
    }
  }

  // Get remoteness + lat/lng
  const remotenessMap = new Map<string, string>();
  const geoLookup = new Map<string, { lat: number; lng: number; locality: string }>();
  for (let i = 0; i < postcodes.length; i += 100) {
    const chunk = postcodes.slice(i, i + 100);
    const { data: geoData } = await supabase
      .from('postcode_geo')
      .select('postcode, remoteness_2021, latitude, longitude, locality')
      .in('postcode', chunk);
    for (const g of geoData || []) {
      remotenessMap.set(g.postcode, g.remoteness_2021);
      if (g.latitude != null && g.longitude != null) {
        geoLookup.set(g.postcode, { lat: g.latitude, lng: g.longitude, locality: g.locality || '' });
      }
    }
  }

  // Calculate gap score for each postcode
  const gaps = Array.from(byPostcode.entries())
    .map(([postcode, data]) => {
      const seifaDecile = seifaMap.get(postcode) || 5;
      const remote = remotenessMap.get(postcode) || '';
      const externalShare = data.total > 0 ? 1 - (data.community / data.total) : 1;
      const disadvantageFactor = (11 - seifaDecile) / 10; // Higher = more disadvantaged
      const remotenessFactor = remote.includes('Very Remote') ? 1.0 :
        remote.includes('Remote') ? 0.8 :
        remote.includes('Outer') ? 0.6 :
        remote.includes('Inner') ? 0.4 : 0.2;

      // Gap score: external dominance * disadvantage * remoteness
      const gapScore = externalShare * disadvantageFactor * remotenessFactor * 100;
      const geo = geoLookup.get(postcode);

      return {
        postcode,
        state: data.state,
        remoteness: remote,
        seifa_irsd_decile: seifaDecile,
        entity_count: data.total,
        community_controlled_count: data.community,
        external_share: externalShare,
        gap_score: Math.round(gapScore * 10) / 10,
        lat: geo?.lat || null,
        lng: geo?.lng || null,
        locality: geo?.locality || null,
      };
    })
    .filter(g => {
      if (remoteness) {
        const r = remoteness.toLowerCase();
        return g.remoteness.toLowerCase().includes(r);
      }
      return true;
    })
    .sort((a, b) => b.gap_score - a.gap_score)
    .slice(0, limit);

  return NextResponse.json({ postcodes: gaps });
}
