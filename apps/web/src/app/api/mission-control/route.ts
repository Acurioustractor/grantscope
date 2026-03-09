import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(p: PromiseLike<any>, ms = 12000): Promise<any> {
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
];

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceSupabase();

  try {
    // --- Inventory: counts + freshness for every table ---
    const countPromises = TABLES.map(t =>
      safe(db.from(t.table).select('*', { count: t.countMode, head: true }), 8000)
    );
    const freshnessPromises = TABLES.map(t => {
      if (!t.freshnessCol) return Promise.resolve({ data: null });
      return safe(
        db.from(t.table).select(t.freshnessCol).order(t.freshnessCol, { ascending: false }).limit(1),
        8000
      );
    });

    // --- Power concentration ---
    const powerPromises = [
      safe(db.from('mv_gs_donor_contractors')
        .select('entity_name, total_donated, total_contract_value, donation_count, contract_count')
        .order('total_contract_value', { ascending: false })
        .limit(20), 8000),
      safe(db.rpc('get_entity_type_breakdown'), 8000),
      safe(db.from('mv_gs_donor_contractors')
        .select('total_donated, total_contract_value')
        .order('total_donated', { ascending: false })
        .limit(1000), 8000),
    ];

    // --- Agent runs ---
    const agentPromises = [
      safe(db.from('agent_runs').select('*').order('completed_at', { ascending: false }).limit(20), 8000),
      safe(db.from('grant_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10), 8000),
    ];

    // Fire everything in parallel
    const [counts, freshness, power, agents] = await Promise.all([
      Promise.all(countPromises),
      Promise.all(freshnessPromises),
      Promise.all(powerPromises),
      Promise.all(agentPromises),
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
    const top20 = (power[0].data ?? []) as Array<{
      entity_name: string;
      total_donated: number;
      total_contract_value: number;
      donation_count: number;
      contract_count: number;
    }>;
    const entityTypes = (power[1].data ?? []) as Array<{ entity_type: string; count: number }>;
    const dcAll = (power[2].data ?? []) as Array<{ total_donated: number; total_contract_value: number }>;
    const dcTotalDonated = dcAll.reduce((s, r) => s + (r.total_donated || 0), 0);
    const dcTotalContracts = dcAll.reduce((s, r) => s + (r.total_contract_value || 0), 0);

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
        donorContractorCount: dcAll.length,
        totalDonated: dcTotalDonated,
        totalContractValue: dcTotalContracts,
      },
      agents: {
        recentRuns: agentRuns,
        discoveryRuns: agents[1].data ?? [],
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[mission-control]', err);
    return NextResponse.json({ error: 'Failed to load mission control data' }, { status: 500 });
  }
}
