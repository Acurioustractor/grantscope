import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * GET /api/procurement/gap-map?state=NSW
 *
 * Returns supply chain gap analysis by LGA for a given state.
 * Identifies LGAs with no Indigenous businesses, low social enterprise presence,
 * and correlates with SEIFA disadvantage to highlight priority areas.
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const state = request.nextUrl.searchParams.get('state') || 'NSW';

  const supabase = getServiceSupabase();

  // Get entity counts by LGA
  const entityResult = await supabase
    .from('gs_entities')
    .select('lga_name, entity_type, is_community_controlled, remoteness, seifa_irsd_decile')
    .eq('state', state)
    .not('lga_name', 'is', null);

  const entities = entityResult.data || [];

  // Get contract data by LGA (via supplier postcode -> LGA)
  const lgaFundingResult = await supabase
    .from('mv_funding_by_lga')
    .select('lga_name, entity_count, total_funding')
    .eq('state', state);

  const lgaFunding = new Map(
    (lgaFundingResult.data || []).map(r => [r.lga_name, r])
  );

  // Aggregate by LGA
  const lgaMap = new Map<string, {
    total: number;
    indigenous: number;
    social_enterprise: number;
    charity: number;
    community_controlled: number;
    remoteness: string | null;
    seifa_sum: number;
    seifa_count: number;
  }>();

  for (const e of entities) {
    const lga = e.lga_name as string;
    if (!lgaMap.has(lga)) {
      lgaMap.set(lga, {
        total: 0,
        indigenous: 0,
        social_enterprise: 0,
        charity: 0,
        community_controlled: 0,
        remoteness: null,
        seifa_sum: 0,
        seifa_count: 0,
      });
    }
    const m = lgaMap.get(lga)!;
    m.total++;
    if (e.entity_type === 'indigenous_corp') m.indigenous++;
    if (e.entity_type === 'social_enterprise') m.social_enterprise++;
    if (e.entity_type === 'charity') m.charity++;
    if (e.is_community_controlled) m.community_controlled++;
    if (e.remoteness) m.remoteness = e.remoteness as string;
    if (e.seifa_irsd_decile) {
      m.seifa_sum += e.seifa_irsd_decile as number;
      m.seifa_count++;
    }
  }

  // Build gap analysis
  const gaps = Array.from(lgaMap.entries()).map(([lga_name, data]) => {
    const funding = lgaFunding.get(lga_name);
    const totalContractValue = (funding?.total_funding as number) || 0;
    const avgSeifa = data.seifa_count > 0 ? data.seifa_sum / data.seifa_count : null;

    // Calculate gap score (0-100, higher = bigger gap)
    let gapScore = 0;

    // No Indigenous businesses = high gap
    if (data.indigenous === 0) gapScore += 40;
    else if (data.indigenous < 3) gapScore += 20;
    else if (data.indigenous < 5) gapScore += 10;

    // No social enterprises
    if (data.social_enterprise === 0 && data.charity === 0) gapScore += 15;

    // High disadvantage area with few suppliers = critical
    if (avgSeifa !== null && avgSeifa <= 3) gapScore += 20;
    else if (avgSeifa !== null && avgSeifa <= 5) gapScore += 10;

    // Remote area bonus to gap score
    if (data.remoteness && data.remoteness.includes('Remote')) gapScore += 15;
    else if (data.remoteness && data.remoteness.includes('Outer Regional')) gapScore += 10;

    // Low total entities
    if (data.total < 5) gapScore += 10;

    gapScore = Math.min(gapScore, 100);

    // Classify gap type
    let gapType: string;
    if (data.indigenous === 0) gapType = 'no_indigenous';
    else if (data.indigenous < 3 && gapScore >= 40) gapType = 'low_indigenous';
    else if (data.total < 3) gapType = 'underserved';
    else if (totalContractValue === 0) gapType = 'no_contracts';
    else gapType = 'adequate';

    return {
      lga_name,
      state,
      total_entities: data.total,
      indigenous_entities: data.indigenous,
      social_enterprises: data.social_enterprise,
      community_controlled: data.community_controlled,
      total_contracts: (funding?.entity_count as number) || 0,
      total_contract_value: totalContractValue,
      remoteness: data.remoteness,
      avg_seifa: avgSeifa,
      gap_score: gapScore,
      gap_type: gapType,
    };
  }).sort((a, b) => b.gap_score - a.gap_score);

  return NextResponse.json({
    gaps,
    summary: {
      state,
      total_lgas: gaps.length,
      no_indigenous: gaps.filter(g => g.gap_type === 'no_indigenous').length,
      low_indigenous: gaps.filter(g => g.gap_type === 'low_indigenous').length,
      adequate: gaps.filter(g => g.gap_type === 'adequate').length,
      critical_gaps: gaps.filter(g => g.gap_score >= 60).length,
    },
    generated_at: new Date().toISOString(),
  });
}
