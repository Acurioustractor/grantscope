import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * GET /api/justice/closing-the-gap
 *
 * Closing the Gap Target 11 dashboard data.
 * Returns state-by-state breakdown of:
 * - Indigenous organisations receiving justice funding
 * - Community-controlled organisations
 * - ALMA interventions (total + JR-specific)
 * - Entity-intervention linkage rates
 */
export async function GET() {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const supabase = getServiceSupabase();

  const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'National'];

  const stateData = await Promise.all(STATES.map(async (state) => {
    // Indigenous entities in this state
    const entityFilter = state === 'National'
      ? supabase.from('gs_entities').select('id, abn', { count: 'exact' }).eq('entity_type', 'indigenous_corp')
      : supabase.from('gs_entities').select('id, abn', { count: 'exact' }).eq('entity_type', 'indigenous_corp').eq('state', state);

    const entityResult = await entityFilter.limit(5000);
    const indigenousEntities = entityResult.data || [];
    const indigenousAbns = indigenousEntities.map(e => e.abn).filter(Boolean) as string[];

    // Community controlled in this state
    const ccFilter = state === 'National'
      ? supabase.from('gs_entities').select('id', { count: 'exact' }).eq('is_community_controlled', true)
      : supabase.from('gs_entities').select('id', { count: 'exact' }).eq('is_community_controlled', true).eq('state', state);
    const ccResult = await ccFilter.limit(1);
    const communityControlled = ccResult.count || 0;

    // Justice funding total for this state
    const fundingFilter = state === 'National'
      ? supabase.from('justice_funding').select('amount_dollars')
      : supabase.from('justice_funding').select('amount_dollars').eq('state', state);
    const fundingResult = await fundingFilter.limit(10000);
    const totalFunding = (fundingResult.data || []).reduce((s, r) => s + ((r.amount_dollars as number) || 0), 0);

    // Justice funding to Indigenous orgs in this state
    let indigenousFunding = 0;
    if (indigenousAbns.length > 0) {
      const indFundFilter = state === 'National'
        ? supabase.from('justice_funding').select('amount_dollars').in('recipient_abn', indigenousAbns.slice(0, 500))
        : supabase.from('justice_funding').select('amount_dollars').eq('state', state).in('recipient_abn', indigenousAbns.slice(0, 500));
      const indFundResult = await indFundFilter.limit(10000);
      indigenousFunding = (indFundResult.data || []).reduce((s, r) => s + ((r.amount_dollars as number) || 0), 0);
    }

    // ALMA interventions with geography matching this state
    const almaFilter = state === 'National'
      ? supabase.from('alma_interventions').select('id, type, gs_entity_id', { count: 'exact' })
      : supabase.from('alma_interventions').select('id, type, gs_entity_id', { count: 'exact' }).contains('geography', [state]);

    const almaResult = await almaFilter.limit(2000);
    const almaInterventions = almaResult.data || [];
    const almaJR = almaInterventions.filter(a => a.type === 'Justice Reinvestment');
    const almaLinked = almaInterventions.filter(a => a.gs_entity_id);

    return {
      state,
      indigenous_entities: indigenousEntities.length,
      indigenous_corps: indigenousEntities.length,
      community_controlled: communityControlled,
      justice_funding_total: totalFunding,
      justice_funding_indigenous: indigenousFunding,
      alma_interventions: almaInterventions.length,
      alma_jr_interventions: almaJR.length,
      alma_linked: almaLinked.length,
      avg_seifa: null, // Would need additional query
    };
  }));

  return NextResponse.json({
    states: stateData,
    target_11: {
      baseline_rate: 31.9,
      target_rate: 22.33,
      target_year: 2031,
      reduction_required: 0.30,
      status: 'off_track',
      note: '15 of 19 Closing the Gap targets are currently off-track (Productivity Commission 2024)',
    },
    generated_at: new Date().toISOString(),
  });
}
