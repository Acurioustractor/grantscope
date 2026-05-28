import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export interface ActSurfaceCounts {
  today: number | null;
  pipeline: number | null;
  triage: number | null;
  foundations: number | null;
  procurement: number | null;
}

/**
 * Cheap count-only fetch for the ActSurfaceNav badges. One parallel batch,
 * cached per request via React.cache. Returns nulls for non-ACT slugs.
 */
export const getActSurfaceCounts = cache(async function getActSurfaceCounts(
  slug: string,
): Promise<ActSurfaceCounts> {
  if (!isActSlug(slug)) {
    return { today: null, pipeline: null, triage: null, foundations: null, procurement: null };
  }
  const supabase = getServiceSupabase();

  const today = new Date().toISOString().slice(0, 10);
  const fortnight = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const [
    pipelineRes,
    strongFitRes,
    decisionsRes,
    foundationsPipelineRes,
    foundationsIncomeRes,
    procurementRes,
    urgentRes,
  ] = await Promise.all([
    // 1. Pipeline = live grant rows (still active, not terminal)
    supabase
      .from('org_pipeline')
      .select('id', { count: 'exact', head: true })
      .eq('opportunity_type', 'grant')
      .in('status', [
        'prospect', 'upcoming', 'drafting', 'submitted', 'watching',
        'pursuing', 'discovered', 'applied',
      ]),
    // 2a. Strong-fit live-deadline rec opportunity_ids
    supabase
      .from('act_grant_recommendations')
      .select('opportunity_id')
      .eq('is_strong_fit', true)
      .or(`deadline.is.null,deadline.gte.${today}`)
      .range(0, 9999),
    // 2b. All decided opportunity_ids
    supabase
      .from('act_grant_recommendation_decisions')
      .select('opportunity_id')
      .range(0, 9999),
    // 3a. Foundation funders in pipeline
    supabase
      .from('org_pipeline')
      .select('funder')
      .eq('opportunity_type', 'foundation')
      .not('funder', 'is', null),
    // 3b. Paid lifetime funders
    supabase
      .from('v_act_income_by_funder')
      .select('funder_name')
      .gt('paid_total', 1000),
    // 4. Procurement buyer count
    supabase
      .from('v_act_procurement_buyers')
      .select('buyer_name', { count: 'exact', head: true }),
    // 5. Today = grants closing in <=14 days
    supabase
      .from('act_grant_recommendations')
      .select('opportunity_id')
      .gte('deadline', today)
      .lte('deadline', fortnight)
      .range(0, 999),
  ]);

  // Triage: strong-fit opp_ids minus decided opp_ids, then dedup
  const strongFitIds = new Set<string>();
  for (const row of strongFitRes.data ?? []) {
    if (row.opportunity_id) strongFitIds.add(row.opportunity_id);
  }
  for (const row of decisionsRes.data ?? []) {
    strongFitIds.delete(row.opportunity_id);
  }
  const triageCount = strongFitIds.size;

  // Foundations: union of pipeline + paid (case-insensitive)
  const foundationSet = new Set<string>();
  for (const row of foundationsPipelineRes.data ?? []) {
    if (row.funder) foundationSet.add(row.funder.toLowerCase());
  }
  for (const row of foundationsIncomeRes.data ?? []) {
    if (row.funder_name) foundationSet.add(row.funder_name.toLowerCase());
  }
  const foundationCount = foundationSet.size;

  // Today: count distinct closing-soon opportunity_ids
  const urgentSet = new Set<string>();
  for (const row of urgentRes.data ?? []) {
    if (row.opportunity_id) urgentSet.add(row.opportunity_id);
  }

  return {
    today: urgentSet.size,
    pipeline: pipelineRes.count ?? null,
    triage: triageCount,
    foundations: foundationCount,
    procurement: procurementRes.count ?? null,
  };
});
