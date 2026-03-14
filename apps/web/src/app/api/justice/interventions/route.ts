import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * GET /api/justice/interventions
 *
 * ALMA evidence explorer + justice funding crosswalk.
 * Returns interventions with evidence ratings, linked entities, and funding flows.
 *
 * Query params:
 *   type       — intervention type filter (e.g. "Justice Reinvestment", "Diversion")
 *   evidence   — minimum evidence type (e.g. "RCT", "Quasi-experimental")
 *   state      — state filter for linked entities
 *   lga        — LGA filter for linked entities
 *   linked     — "true" to only show interventions linked to entities
 *   q          — text search across intervention names/descriptions
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const evidenceFilter = params.get('evidence');
  const state = params.get('state');
  const lga = params.get('lga');
  const linkedOnly = params.get('linked') === 'true';
  const q = params.get('q');

  const supabase = getServiceSupabase();

  // Build intervention query
  let query = supabase
    .from('alma_interventions')
    .select(`
      id, name, type, description, target_cohort, geography,
      evidence_level, cultural_authority, implementation_cost,
      cost_per_young_person, scalability, replication_readiness,
      operating_organization, years_operating, current_funding,
      portfolio_score, evidence_strength_signal, community_authority_signal,
      serves_youth_justice, service_role, estimated_annual_capacity,
      gs_entity_id, latitude, longitude, location_type
    `)
    .order('name');

  if (type) query = query.eq('type', type);
  if (linkedOnly) query = query.not('gs_entity_id', 'is', null);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

  const interventionResult = await query.limit(500);
  const interventions = interventionResult.data || [];
  const interventionIds = interventions.map(i => i.id);

  // Get evidence for these interventions
  const evidenceResult = await supabase
    .from('alma_evidence')
    .select('id, title, evidence_type, methodology, sample_size, timeframe, findings, effect_size, author, organization, publication_date, metadata')
    .in('id', interventionIds.slice(0, 200));

  // Evidence is linked via metadata or a join table — let's check both approaches
  // Actually alma_evidence likely has intervention_id
  const evidenceByIntervention = await supabase
    .from('alma_evidence')
    .select('*')
    .limit(1000);

  const allEvidence = evidenceByIntervention.data || [];

  // Get outcomes
  const outcomesResult = await supabase
    .from('alma_outcomes')
    .select('id, name, outcome_type, description, measurement_method, indicators, time_horizon, beneficiary')
    .limit(1000);

  const allOutcomes = outcomesResult.data || [];

  // Get linked entities
  const entityIds = interventions.map(i => i.gs_entity_id).filter(Boolean);
  let entityMap = new Map<string, Record<string, unknown>>();
  if (entityIds.length > 0) {
    const entityResult = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name')
      .in('id', entityIds);

    entityMap = new Map((entityResult.data || []).map(e => [e.id, e]));
  }

  // Get justice funding linked to these interventions
  const fundingResult = await supabase
    .from('justice_funding')
    .select('alma_intervention_id, recipient_name, recipient_abn, program_name, amount_dollars, state, financial_year')
    .in('alma_intervention_id', interventionIds.slice(0, 200))
    .not('alma_intervention_id', 'is', null);

  const fundingByIntervention = new Map<string, Array<Record<string, unknown>>>();
  for (const f of fundingResult.data || []) {
    const key = f.alma_intervention_id as string;
    if (!fundingByIntervention.has(key)) fundingByIntervention.set(key, []);
    fundingByIntervention.get(key)!.push(f);
  }

  // Filter by state/LGA if specified (post-query filter on linked entity)
  let filtered = interventions;
  if (state) {
    filtered = filtered.filter(i => {
      const entity = entityMap.get(i.gs_entity_id);
      return entity?.state === state;
    });
  }
  if (lga) {
    filtered = filtered.filter(i => {
      const entity = entityMap.get(i.gs_entity_id);
      return (entity?.lga_name as string)?.toLowerCase().includes(lga.toLowerCase());
    });
  }

  // Filter by evidence level
  const evidenceRanking = ['RCT (Randomized Control Trial)', 'Quasi-experimental', 'Program evaluation', 'Community-led research', 'Case study', 'Policy analysis'];
  if (evidenceFilter) {
    const minIdx = evidenceRanking.indexOf(evidenceFilter);
    if (minIdx >= 0) {
      filtered = filtered.filter(i => {
        const level = i.evidence_level;
        return level && evidenceRanking.indexOf(level) <= minIdx;
      });
    }
  }

  // Build response
  const enriched = filtered.map(i => {
    const entity = entityMap.get(i.gs_entity_id);
    const funding = fundingByIntervention.get(i.id) || [];
    const totalFunding = funding.reduce((s, f) => s + ((f.amount_dollars as number) || 0), 0);

    return {
      id: i.id,
      name: i.name,
      type: i.type,
      description: i.description,
      target_cohort: i.target_cohort,
      geography: i.geography,
      evidence_level: i.evidence_level,
      cultural_authority: i.cultural_authority,
      implementation_cost: i.implementation_cost,
      cost_per_young_person: i.cost_per_young_person,
      scalability: i.scalability,
      replication_readiness: i.replication_readiness,
      years_operating: i.years_operating,
      serves_youth_justice: i.serves_youth_justice,
      estimated_annual_capacity: i.estimated_annual_capacity,
      portfolio_score: i.portfolio_score,
      signals: {
        evidence_strength: i.evidence_strength_signal,
        community_authority: i.community_authority_signal,
      },
      location: i.latitude && i.longitude ? { lat: i.latitude, lng: i.longitude, type: i.location_type } : null,
      linked_entity: entity ? {
        gs_id: entity.gs_id,
        name: entity.canonical_name,
        abn: entity.abn,
        entity_type: entity.entity_type,
        state: entity.state,
        postcode: entity.postcode,
        remoteness: entity.remoteness,
        seifa_decile: entity.seifa_irsd_decile,
        is_community_controlled: entity.is_community_controlled,
        lga: entity.lga_name,
      } : null,
      justice_funding: {
        total: totalFunding,
        records: funding.length,
        programs: [...new Set(funding.map(f => f.program_name))].slice(0, 5),
        states: [...new Set(funding.map(f => f.state))],
      },
    };
  });

  // Summary stats
  const byType = enriched.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byEvidenceLevel = enriched.reduce((acc, i) => {
    const level = i.evidence_level || 'Unknown';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    interventions: enriched,
    summary: {
      total: enriched.length,
      with_entity: enriched.filter(i => i.linked_entity).length,
      with_funding: enriched.filter(i => i.justice_funding.total > 0).length,
      total_funding: enriched.reduce((s, i) => s + i.justice_funding.total, 0),
      by_type: byType,
      by_evidence_level: byEvidenceLevel,
    },
    evidence_records: allEvidence.length,
    outcome_records: allOutcomes.length,
    generated_at: new Date().toISOString(),
  });
}
