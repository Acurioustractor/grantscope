import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(p: PromiseLike<any>, ms = 15000): Promise<any> {
  const fallback = { count: null, data: null, error: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getTs(result: { data: Record<string, string>[] | null }): string | null {
  const row = result?.data?.[0];
  if (!row) return null;
  return Object.values(row)[0] ?? null;
}

interface TableMeta {
  key: string;
  label: string;
  table: string;
  category: 'entity' | 'funding' | 'registry' | 'government' | 'corporate' | 'geographic' | 'analytics';
  countMode: 'exact' | 'estimated';
  freshnessCol: string | null; // null = static
}

const TABLES: TableMeta[] = [
  { key: 'gs_entities', label: 'Entities', table: 'gs_entities', category: 'entity', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'gs_relationships', label: 'Relationships', table: 'gs_relationships', category: 'entity', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'grant_opportunities', label: 'Grants', table: 'grant_opportunities', category: 'funding', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'foundations', label: 'Foundations', table: 'foundations', category: 'funding', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'foundation_programs', label: 'Foundation Programs', table: 'foundation_programs', category: 'funding', countMode: 'exact', freshnessCol: 'scraped_at' },
  { key: 'acnc_charities', label: 'ACNC Charities', table: 'acnc_charities', category: 'registry', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'community_orgs', label: 'Community Orgs', table: 'community_orgs', category: 'registry', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'social_enterprises', label: 'Social Enterprises', table: 'social_enterprises', category: 'registry', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'oric_corporations', label: 'ORIC Corporations', table: 'oric_corporations', category: 'registry', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'austender_contracts', label: 'AusTender Contracts', table: 'austender_contracts', category: 'government', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'political_donations', label: 'Political Donations', table: 'political_donations', category: 'government', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'justice_funding', label: 'Justice Funding', table: 'justice_funding', category: 'government', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'rogs_justice_spending', label: 'ROGS Justice Spending', table: 'rogs_justice_spending', category: 'government', countMode: 'exact', freshnessCol: 'created_at' },
  { key: 'asic_companies', label: 'ASIC Companies', table: 'asic_companies', category: 'corporate', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'ato_tax_transparency', label: 'ATO Tax Transparency', table: 'ato_tax_transparency', category: 'corporate', countMode: 'exact', freshnessCol: 'created_at' },
  { key: 'asx_companies', label: 'ASX Companies', table: 'asx_companies', category: 'corporate', countMode: 'exact', freshnessCol: 'created_at' },
  { key: 'money_flows', label: 'Money Flows', table: 'money_flows', category: 'analytics', countMode: 'exact', freshnessCol: null },
  { key: 'seifa_2021', label: 'SEIFA Postcodes', table: 'seifa_2021', category: 'geographic', countMode: 'exact', freshnessCol: null },
  { key: 'alma_interventions', label: 'ALMA Interventions', table: 'alma_interventions', category: 'analytics', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'alma_outcomes', label: 'ALMA Outcomes', table: 'alma_outcomes', category: 'analytics', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'alma_evidence', label: 'ALMA Evidence', table: 'alma_evidence', category: 'analytics', countMode: 'exact', freshnessCol: 'updated_at' },
  
  // High-Volume Hidden Datasets
  { key: 'abr_registry', label: 'ABR Registry', table: 'abr_registry', category: 'registry', countMode: 'estimated', freshnessCol: null },
  { key: 'asic_name_lookup', label: 'ASIC Names', table: 'asic_name_lookup', category: 'corporate', countMode: 'estimated', freshnessCol: null },
  { key: 'entity_identifiers', label: 'Entity Identifiers', table: 'entity_identifiers', category: 'entity', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'person_roles', label: 'Person Roles', table: 'person_roles', category: 'entity', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'acnc_programs', label: 'ACNC Programs', table: 'acnc_programs', category: 'registry', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'nz_charities', label: 'NZ Charities', table: 'nz_charities', category: 'registry', countMode: 'estimated', freshnessCol: 'updated_at' },

  // Government Context
  { key: 'state_tenders', label: 'State Tenders', table: 'state_tenders', category: 'government', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'dss_payment_demographics', label: 'DSS Payments', table: 'dss_payment_demographics', category: 'government', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'crime_stats_lga', label: 'LGA Crime Stats', table: 'crime_stats_lga', category: 'government', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'ndis_utilisation', label: 'NDIS Utilisation', table: 'ndis_utilisation', category: 'government', countMode: 'estimated', freshnessCol: 'created_at' },
  { key: 'ndis_active_providers', label: 'NDIS Providers', table: 'ndis_active_providers', category: 'government', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'research_grants', label: 'Research Grants', table: 'research_grants', category: 'funding', countMode: 'estimated', freshnessCol: 'updated_at' },
];

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const db = getServiceSupabase();

  try {
    // --- Get estimated counts from system tables to save DB connections ---
    const allTables = TABLES.map(t => t.table);
    const estResult = await safe(db.rpc('exec_sql', {
      query: `SELECT relname as table_name, reltuples as row_count FROM pg_class WHERE relname = ANY(ARRAY[${allTables.map(t => `'${t}'`).join(',')}])`
    }));
    const estCounts = new Map<string, number>();
    if (estResult.data) {
      for (const r of (estResult.data as Array<{table_name: string, row_count: number}>)) {
        estCounts.set(r.table_name, Number(r.row_count));
      }
    }

    // --- Inventory: exact counts + freshness for every table ---
    const countPromises = TABLES.map(t => {
      if (t.countMode === 'estimated' && estCounts.has(t.table)) {
         return Promise.resolve({ count: estCounts.get(t.table), data: null });
      }
      return safe(db.from(t.table).select('*', { count: t.countMode, head: true }));
    });
    const freshnessPromises = TABLES.map(t => {
      if (!t.freshnessCol) return Promise.resolve({ data: null });
      return safe(
        db.from(t.table).select(t.freshnessCol).order(t.freshnessCol, { ascending: false }).limit(1)
      );
    });

    // --- Power concentration ---
    const powerPromises = [
      safe(db.from('mv_gs_donor_contractors')
        .select('canonical_name, total_donated, total_contract_value, donation_count, contract_count')
        .order('total_contract_value', { ascending: false })
        .limit(20)),
      safe(db.from('mv_gs_donor_contractors')
        .select('entity_type')
        .not('entity_type', 'is', null)),
      safe(db.rpc('exec_sql', {
        query: `SELECT COUNT(*)::int as count, SUM(total_donated)::bigint as total_donated, SUM(total_contract_value)::bigint as total_contract_value FROM mv_gs_donor_contractors`,
      })),
    ];

    // --- Agent runs ---
    const agentPromises = [
      safe(db.from('agent_runs').select('*').order('completed_at', { ascending: false }).limit(20)),
      safe(db.from('grant_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10)),
      safe(db.from('v_agent_runtime_sweeps').select('*').order('agent_id', { ascending: true })),
    ];

    const frontierPromise = safe(
      db.from('source_frontier')
        .select('id, source_key, source_name, source_kind, foundation_id, target_url, failure_count, last_http_status, next_check_at, updated_at, metadata')
        .eq('enabled', false)
        .eq('source_kind', 'foundation_candidate_page')
        .contains('metadata', { auto_disabled_reason: 'repeated_404_candidate_page' })
        .order('updated_at', { ascending: false })
        .limit(50)
    );

    // --- Discoveries (autoresearch findings) ---
    const discoveriesPromise = safe(
      db.from('discoveries')
        .select('*')
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50)
    );

    // Fire everything in parallel
    const [counts, freshness, power, agents, discoveriesResult, frontierResult] = await Promise.all([
      Promise.all(countPromises),
      Promise.all(freshnessPromises),
      Promise.all(powerPromises),
      Promise.all(agentPromises),
      discoveriesPromise,
      frontierPromise,
    ]);

    // --- Build inventory ---
    const inventory = TABLES.map((t, i) => ({
      key: t.key,
      label: t.label,
      table: t.table,
      category: t.category,
      count: counts[i].count ?? 0,
      lastUpdated: t.freshnessCol ? getTs(freshness[i]) : null,
      static: !t.freshnessCol,
    }));

    const totalRecords = inventory.reduce((s, d) => s + d.count, 0);

    // --- Hero metrics ---
    const freshTables = inventory.filter(t => t.lastUpdated !== null);
    const freshCount = freshTables.filter(t => {
      const days = (Date.now() - new Date(t.lastUpdated!).getTime()) / 86_400_000;
      return days < 7;
    }).length;
    const freshnessPct = freshTables.length > 0 ? Math.round((freshCount / freshTables.length) * 100) : 0;

    const agentRuns = agents[0].data ?? [];
    const recentSuccesses = agentRuns.filter((r: { status: string; completed_at: string }) => {
      const hoursAgo = (Date.now() - new Date(r.completed_at).getTime()) / 3_600_000;
      return hoursAgo < 168 && r.status === 'success';
    }).length;
    const recentTotal = agentRuns.filter((r: { completed_at: string }) => {
      const hoursAgo = (Date.now() - new Date(r.completed_at).getTime()) / 3_600_000;
      return hoursAgo < 168;
    }).length;
    const healthScore = recentTotal > 0 ? Math.round((recentSuccesses / recentTotal) * 100) : 100;

    const allUpdates = inventory
      .filter(t => t.lastUpdated)
      .map(t => new Date(t.lastUpdated!).getTime());
    const lastSync = allUpdates.length > 0 ? new Date(Math.max(...allUpdates)).toISOString() : null;

    // --- Power concentration ---
    const top20 = ((power[0].data ?? []) as Array<{
      canonical_name: string;
      total_donated: number;
      total_contract_value: number;
      donation_count: number;
      contract_count: number;
    }>).map(r => ({ ...r, entity_name: r.canonical_name }));

    // Aggregate entity types client-side since RPC doesn't exist
    const entityTypeRaw = (power[1].data ?? []) as Array<{ entity_type: string }>;
    const etMap = new Map<string, number>();
    for (const r of entityTypeRaw) {
      if (r.entity_type) etMap.set(r.entity_type, (etMap.get(r.entity_type) || 0) + 1);
    }
    const entityTypes = Array.from(etMap.entries())
      .map(([entity_type, count]) => ({ entity_type, count }))
      .sort((a, b) => b.count - a.count);
    const dcAgg = ((power[2].data ?? []) as Array<{ count: number; total_donated: number; total_contract_value: number }>)[0]
      ?? { count: 0, total_donated: 0, total_contract_value: 0 };

    return NextResponse.json({
      hero: {
        totalRecords,
        freshnessPct,
        activePipelines: agentRuns.filter((r: { status: string }) => r.status === 'running').length,
        healthScore,
        tableCount: TABLES.length,
        lastSync,
      },
      inventory,
      power: {
        top20,
        entityTypes,
        donorContractorCount: dcAgg.count,
        totalDonated: Number(dcAgg.total_donated),
        totalContractValue: Number(dcAgg.total_contract_value),
      },
      agents: {
        recentRuns: agentRuns,
        discoveryRuns: agents[1].data ?? [],
        runtimeSweeps: agents[2].data ?? [],
      },
      frontier: {
        autoDisabled: ((frontierResult.data ?? []) as Array<{
          id: string;
          source_key: string;
          source_name: string | null;
          source_kind: string;
          foundation_id: string | null;
          target_url: string;
          failure_count: number | null;
          last_http_status: number | null;
          next_check_at: string | null;
          updated_at: string;
          metadata: Record<string, unknown> | null;
        }>).map((row) => ({
          id: row.id,
          sourceKey: row.source_key,
          sourceName: row.source_name,
          sourceKind: row.source_kind,
          foundationId: row.foundation_id,
          foundationName: typeof row.metadata?.foundation_name === 'string' ? row.metadata.foundation_name : null,
          targetUrl: row.target_url,
          failureCount: row.failure_count ?? 0,
          lastHttpStatus: row.last_http_status,
          nextCheckAt: row.next_check_at,
          updatedAt: row.updated_at,
          autoDisabledReason: typeof row.metadata?.auto_disabled_reason === 'string' ? row.metadata.auto_disabled_reason : null,
          autoDisabledAt: typeof row.metadata?.auto_disabled_at === 'string' ? row.metadata.auto_disabled_at : null,
          autoDisabledFailureCount: typeof row.metadata?.auto_disabled_failure_count === 'number'
            ? row.metadata.auto_disabled_failure_count
            : Number(row.metadata?.auto_disabled_failure_count ?? 0),
          lastEffectiveCadenceReason: typeof row.metadata?.last_effective_cadence_reason === 'string'
            ? row.metadata.last_effective_cadence_reason
            : null,
        })),
      },
      discoveries: discoveriesResult.data ?? [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[mission-control]', err);
    return NextResponse.json({ error: 'Failed to load mission control data' }, { status: 500 });
  }
}
