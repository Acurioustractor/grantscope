import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/data/data-health
 *
 * Comprehensive data health metrics: entity coverage, linkage rates,
 * relationship network, agent status, and data gaps.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T = any>(p: PromiseLike<T>, ms = 12000): Promise<T | { data: null; error: string }> {
  const fallback = { data: null, error: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise<{ data: null; error: string }>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  const db = getServiceSupabase();

  try {
    const [
      // 1. Entity coverage
      entityStatsResult,
      entityByTypeResult,
      entityByStateResult,
      // 2. Relationship coverage
      relTotalResult,
      relByTypeResult,
      relByDatasetResult,
      // 3. Justice funding linkage
      justiceLinkageResult,
      // 4. ALMA coverage
      almaStatsResult,
      almaByTypeResult,
      almaEvidenceCount,
      almaOutcomesCount,
      // 5. Foundation coverage
      foundationStatsResult,
      grantOpCount,
      // 6. Contract coverage
      contractStatsResult,
      // 7. Grant semantics health
      grantSemanticsResult,
      // 8. Grant source identity health
      sourceIdentityResult,
      // 9. Agent health
      agentHealthResult,
    ] = await Promise.all([
      // Entity stats
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total,
          COUNT(abn) as with_abn,
          COUNT(*) - COUNT(abn) as without_abn,
          COUNT(CASE WHEN is_community_controlled THEN 1 END) as community_controlled,
          ROUND(COUNT(abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
        FROM gs_entities`,
      })),
      // Entity by type
      safe(db.rpc('exec_sql', {
        query: `SELECT entity_type, COUNT(*) as count FROM gs_entities GROUP BY entity_type ORDER BY count DESC`,
      })),
      // Entity by state
      safe(db.rpc('exec_sql', {
        query: `SELECT COALESCE(state, 'Unknown') as state, COUNT(*) as count FROM gs_entities GROUP BY state ORDER BY count DESC`,
      })),
      // Relationship total
      safe(db.rpc('exec_sql', {
        query: `SELECT COUNT(*) as total FROM gs_relationships`,
      })),
      // Relationship by type
      safe(db.rpc('exec_sql', {
        query: `SELECT relationship_type, COUNT(*) as count FROM gs_relationships GROUP BY relationship_type ORDER BY count DESC`,
      })),
      // Relationship by dataset
      safe(db.rpc('exec_sql', {
        query: `SELECT dataset, COUNT(*) as count FROM gs_relationships GROUP BY dataset ORDER BY count DESC`,
      })),
      // Justice linkage
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total,
          COUNT(gs_entity_id) as linked,
          COUNT(*) - COUNT(gs_entity_id) as unlinked,
          ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_linked
        FROM justice_funding`,
      })),
      // ALMA stats
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total,
          COUNT(gs_entity_id) as linked,
          COUNT(*) - COUNT(gs_entity_id) as unlinked,
          ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct_linked
        FROM alma_interventions`,
      })),
      // ALMA by type
      safe(db.rpc('exec_sql', {
        query: `SELECT type, COUNT(*) as count FROM alma_interventions GROUP BY type ORDER BY count DESC`,
      })),
      // ALMA evidence count
      safe(db.rpc('exec_sql', {
        query: `SELECT COUNT(*) as total FROM alma_evidence`,
      })),
      // ALMA outcomes count
      safe(db.rpc('exec_sql', {
        query: `SELECT COUNT(*) as total FROM alma_outcomes`,
      })),
      // Foundation stats
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total,
          COUNT(acnc_abn) as with_abn,
          ROUND(COUNT(acnc_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
        FROM foundations`,
      })),
      // Grant opportunities count
      safe(db.rpc('exec_sql', {
        query: `SELECT COUNT(*) as total FROM grant_opportunities`,
      })),
      // Contract stats
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total,
          COUNT(supplier_abn) as with_abn,
          ROUND(COUNT(supplier_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as abn_pct
        FROM austender_contracts`,
      })),
      // Grant semantics health
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) FILTER (WHERE status IS NULL) as status_null,
          COUNT(*) FILTER (WHERE application_status IS NULL) as application_status_null,
          COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE) as open_past_deadline,
          COUNT(*) FILTER (WHERE source = 'ghl_sync' AND status = 'unknown') as ghl_unknown
        FROM grant_opportunities`,
      })),
      // Grant source identity health
      safe(db.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND COALESCE(discovery_method, '') <> ''
              AND COALESCE(source_id, '') = ''
          ) as blank_source_id,
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND COALESCE(discovery_method, '') <> ''
              AND COALESCE(source_id, '') <> ''
              AND source_id NOT LIKE '%::duplicate::%'
              AND source_id <> discovery_method
          ) as canonical_mismatch,
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND source_id LIKE '%::duplicate::%'
              AND status = 'duplicate'
          ) as duplicate_shadows
        FROM grant_opportunities`,
      })),
      // Agent health: latest run per agent
      safe(db.rpc('exec_sql', {
        query: `SELECT DISTINCT ON (agent_name)
          agent_name, status, started_at, items_found, items_new, duration_ms
        FROM agent_runs
        ORDER BY agent_name, started_at DESC`,
      })),
    ]);

    // Parse results with safe fallbacks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parse = (r: any) => r?.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFirst = (r: any) => (r?.data ?? [])[0] ?? {};

    const entityStats = parseFirst(entityStatsResult);
    const entityByType = parse(entityByTypeResult);
    const entityByState = parse(entityByStateResult);
    const relTotal = parseFirst(relTotalResult);
    const relByType = parse(relByTypeResult);
    const relByDataset = parse(relByDatasetResult);
    const justiceLinkage = parseFirst(justiceLinkageResult);
    const almaStats = parseFirst(almaStatsResult);
    const almaByType = parse(almaByTypeResult);
    const almaEvidence = parseFirst(almaEvidenceCount);
    const almaOutcomes = parseFirst(almaOutcomesCount);
    const foundationStats = parseFirst(foundationStatsResult);
    const grantOps = parseFirst(grantOpCount);
    const contractStats = parseFirst(contractStatsResult);
    const grantSemantics = parseFirst(grantSemanticsResult);
    const sourceIdentity = parseFirst(sourceIdentityResult);
    const agentHealth = parse(agentHealthResult);

    const response = NextResponse.json({
      entities: {
        total: Number(entityStats.total ?? 0),
        with_abn: Number(entityStats.with_abn ?? 0),
        without_abn: Number(entityStats.without_abn ?? 0),
        abn_pct: Number(entityStats.abn_pct ?? 0),
        community_controlled: Number(entityStats.community_controlled ?? 0),
        by_type: entityByType,
        by_state: entityByState,
      },
      relationships: {
        total: Number(relTotal.total ?? 0),
        by_type: relByType,
        by_dataset: relByDataset,
      },
      justice_funding: {
        total: Number(justiceLinkage.total ?? 0),
        linked: Number(justiceLinkage.linked ?? 0),
        unlinked: Number(justiceLinkage.unlinked ?? 0),
        pct_linked: Number(justiceLinkage.pct_linked ?? 0),
      },
      alma: {
        total: Number(almaStats.total ?? 0),
        linked: Number(almaStats.linked ?? 0),
        unlinked: Number(almaStats.unlinked ?? 0),
        pct_linked: Number(almaStats.pct_linked ?? 0),
        by_type: almaByType,
        evidence_records: Number(almaEvidence.total ?? 0),
        outcome_records: Number(almaOutcomes.total ?? 0),
      },
      foundations: {
        total: Number(foundationStats.total ?? 0),
        with_abn: Number(foundationStats.with_abn ?? 0),
        abn_pct: Number(foundationStats.abn_pct ?? 0),
        grant_opportunities: Number(grantOps.total ?? 0),
      },
      contracts: {
        total: Number(contractStats.total ?? 0),
        with_abn: Number(contractStats.with_abn ?? 0),
        abn_pct: Number(contractStats.abn_pct ?? 0),
      },
      grant_semantics: {
        status_null: Number(grantSemantics.status_null ?? 0),
        application_status_null: Number(grantSemantics.application_status_null ?? 0),
        open_past_deadline: Number(grantSemantics.open_past_deadline ?? 0),
        ghl_unknown: Number(grantSemantics.ghl_unknown ?? 0),
      },
      source_identity: {
        blank_source_id: Number(sourceIdentity.blank_source_id ?? 0),
        canonical_mismatch: Number(sourceIdentity.canonical_mismatch ?? 0),
        duplicate_shadows: Number(sourceIdentity.duplicate_shadows ?? 0),
      },
      agents: agentHealth,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (err) {
    console.error('[data/data-health]', err);
    return NextResponse.json({ error: 'Failed to load data health metrics' }, { status: 500 });
  }
}
