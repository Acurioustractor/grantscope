import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

const VALID_SOURCES = ['detention', 'procurement'] as const;
const VALID_TARGETS = ['community', 'evidence-backed', 'community-controlled'] as const;
const VALID_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

type Source = typeof VALID_SOURCES[number];
type Target = typeof VALID_TARGETS[number];

export async function POST(request: NextRequest) {
  let body: { source?: string; target?: string; redirect_pct?: number; state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { source, target, redirect_pct, state } = body;

  if (!source || !VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
    return NextResponse.json({ error: `Invalid source. Valid: ${VALID_SOURCES.join(', ')}` }, { status: 400 });
  }
  if (!target || !VALID_TARGETS.includes(target as typeof VALID_TARGETS[number])) {
    return NextResponse.json({ error: `Invalid target. Valid: ${VALID_TARGETS.join(', ')}` }, { status: 400 });
  }

  const pct = Number(redirect_pct);
  if (!pct || pct < 5 || pct > 50) {
    return NextResponse.json({ error: 'redirect_pct must be between 5 and 50' }, { status: 400 });
  }
  if (state && !VALID_STATES.includes(state)) {
    return NextResponse.json({ error: `Invalid state. Valid: ${VALID_STATES.join(', ')}` }, { status: 400 });
  }

  console.log(`[/api/scenarios] source=${source} target=${target} pct=${pct} state=${state || 'all'}`);

  const supabase = getServiceSupabase();
  // SAFETY: state is validated against VALID_STATES allowlist above.
  // source/target are validated against VALID_SOURCES/VALID_TARGETS.
  // Do NOT add new interpolated params without adding allowlist validation first.
  const stateWhere = state ? `AND state = '${state}'` : '';
  const stateWhereJf = state ? `AND jf.state = '${state}'` : '';

  // Get source funding total
  const sourceQuery = getSourceQuery(source as Source, stateWhere);
  const sourceData = await safe(supabase.rpc('exec_sql', { query: sourceQuery }));
  const sourceTotal = Number((sourceData as Array<{ total: number }> | null)?.[0]?.total) || 0;

  // Get current target funding total
  const targetQuery = getTargetQuery(target as Target, stateWhere, stateWhereJf);
  const targetData = await safe(supabase.rpc('exec_sql', { query: targetQuery }));
  const targetTotal = Number((targetData as Array<{ total: number; orgs: number }> | null)?.[0]?.total) || 0;
  const targetOrgs = Number((targetData as Array<{ total: number; orgs: number }> | null)?.[0]?.orgs) || 0;

  // Get funding deserts
  const desertQuery = `
    SELECT lga_name, state, remoteness, desert_score::float,
           indexed_entities::int as entity_count,
           total_funding_all_sources::bigint as total_funding,
           CASE WHEN indexed_entities > 0
             THEN (total_funding_all_sources / indexed_entities)::bigint
             ELSE 0 END as funding_per_entity
    FROM mv_funding_deserts
    WHERE desert_score > 0
    ${state ? `AND state = '${state}'` : ''}
    ORDER BY desert_score DESC
    LIMIT 20`;
  const deserts = await safe(supabase.rpc('exec_sql', { query: desertQuery })) as Array<{
    lga_name: string; state: string; remoteness: string; desert_score: number;
    entity_count: number; total_funding: number; funding_per_entity: number;
  }> | null;

  // Calculate scenario
  const redirectedAmount = Math.round(sourceTotal * pct / 100);
  const newTargetTotal = targetTotal + redirectedAmount;
  const pctIncrease = targetTotal > 0 ? Math.round((redirectedAmount / targetTotal) * 100) : 0;

  // Distribute to worst deserts (weighted by desert_score)
  const desertList = deserts || [];
  const totalDesertScore = desertList.reduce((sum, d) => sum + d.desert_score, 0);

  const topImpactLgas = desertList.map(d => {
    const weight = totalDesertScore > 0 ? d.desert_score / totalDesertScore : 0;
    const allocated = Math.round(redirectedAmount * weight);
    const currentPerEntity = d.funding_per_entity || 0;
    const newPerEntity = d.entity_count > 0
      ? currentPerEntity + (allocated / d.entity_count)
      : currentPerEntity;

    return {
      lga_name: d.lga_name,
      state: d.state,
      remoteness: d.remoteness,
      desert_score: d.desert_score,
      current_funding: d.total_funding,
      allocated,
      current_per_entity: Math.round(currentPerEntity),
      new_per_entity: Math.round(newPerEntity),
    };
  });

  // Get entities in top desert LGAs that would benefit
  const topLgas = topImpactLgas.slice(0, 10).map(d => `'${d.lga_name.replace(/'/g, "''")}'`).join(',');
  let benefitingEntities: Array<{
    canonical_name: string; entity_type: string;
    is_community_controlled: boolean; lga_name: string; state: string;
  }> = [];

  if (topLgas) {
    const entityFilter = getEntityFilter(target as Target);
    const entityData = await safe(supabase.rpc('exec_sql', {
      query: `SELECT canonical_name, entity_type, is_community_controlled, lga_name, state
         FROM gs_entities
         WHERE lga_name IN (${topLgas})
         AND ${entityFilter}
         ORDER BY lga_name, canonical_name
         LIMIT 30`,
    }));
    benefitingEntities = (entityData as typeof benefitingEntities) || [];
  }

  // Count deserts that would improve
  const desertCount = desertList.length;
  const avgDesertScore = desertList.length > 0
    ? Math.round(desertList.reduce((s, d) => s + d.desert_score, 0) / desertList.length * 10) / 10
    : 0;

  console.log(`[/api/scenarios] source=$${(sourceTotal / 1e9).toFixed(1)}B target=$${(targetTotal / 1e9).toFixed(1)}B redirect=$${(redirectedAmount / 1e9).toFixed(1)}B deserts=${desertCount}`);

  return NextResponse.json({
    current: {
      source_total: sourceTotal,
      source_label: getSourceLabel(source as Source),
      target_total: targetTotal,
      target_label: getTargetLabel(target as Target),
      target_orgs: targetOrgs,
      desert_count: desertCount,
      avg_desert_score: avgDesertScore,
    },
    scenario: {
      redirect_pct: pct,
      redirected_amount: redirectedAmount,
      new_target_total: newTargetTotal,
      pct_increase: pctIncrease,
    },
    top_impact_lgas: topImpactLgas,
    benefiting_entities: benefitingEntities,
  });
}

function getSourceQuery(source: Source, stateWhere: string): string {
  switch (source) {
    case 'detention':
      return `SELECT COALESCE(SUM(amount_dollars), 0)::bigint as total
        FROM justice_funding
        WHERE (sector = 'corrections'
          OR program_name ILIKE '%detention%'
          OR program_name ILIKE '%custod%'
          OR program_name ILIKE '%correctiv%')
        ${stateWhere}`;
    case 'procurement':
      return `SELECT COALESCE(SUM(contract_value), 0)::bigint as total
        FROM austender_contracts
        WHERE (title ILIKE '%detention%'
          OR title ILIKE '%corrections%'
          OR title ILIKE '%custod%'
          OR title ILIKE '%prison%'
          OR title ILIKE '%correctional%')
        ${stateWhere.replace('state', 'buyer_name')}`;
  }
}

function getTargetQuery(target: Target, stateWhere: string, stateWhereJf: string): string {
  switch (target) {
    case 'community':
      return `SELECT COALESCE(SUM(amount_dollars), 0)::bigint as total,
                COUNT(DISTINCT recipient_name)::int as orgs
        FROM justice_funding
        WHERE sector IN ('community_services', 'community_safety', 'family_violence', 'indigenous_services')
        ${stateWhere}`;
    case 'evidence-backed':
      return `SELECT COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                COUNT(DISTINCT jf.recipient_name)::int as orgs
        FROM justice_funding jf
        WHERE jf.gs_entity_id IN (
          SELECT gs_entity_id FROM alma_interventions WHERE gs_entity_id IS NOT NULL
        )
        ${stateWhereJf}`;
    case 'community-controlled':
      return `SELECT COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                COUNT(DISTINCT jf.recipient_name)::int as orgs
        FROM justice_funding jf
        JOIN gs_entities ge ON ge.id = jf.gs_entity_id
        WHERE ge.is_community_controlled = true
        ${stateWhereJf}`;
  }
}

function getEntityFilter(target: Target): string {
  switch (target) {
    case 'community':
      return `entity_type IN ('charity', 'indigenous_corp', 'social_enterprise')`;
    case 'evidence-backed':
      return `id IN (SELECT gs_entity_id FROM alma_interventions WHERE gs_entity_id IS NOT NULL)`;
    case 'community-controlled':
      return `is_community_controlled = true`;
  }
}

function getSourceLabel(source: Source): string {
  switch (source) {
    case 'detention': return 'Detention & Corrective Services';
    case 'procurement': return 'Detention Procurement';
  }
}

function getTargetLabel(target: Target): string {
  switch (target) {
    case 'community': return 'Community & Diversion Programs';
    case 'evidence-backed': return 'Evidence-Backed Programs (ALMA)';
    case 'community-controlled': return 'Community-Controlled Organisations';
  }
}
