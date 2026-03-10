import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/data/health
 *
 * Public platform health & statistics endpoint. No auth required.
 * Returns comprehensive stats about data coverage, freshness, and quality.
 *
 * Response shape:
 * {
 *   platform: { total_records, datasets, last_updated },
 *   entities: { total, by_type, coverage: { postcode, remoteness, lga, seifa, abn, description, website }, community_controlled },
 *   relationships: { total, by_type },
 *   grants: { total, with_description, enriched, embedded, open },
 *   foundations: { total, profiled, with_website, programs },
 *   social_enterprises: { total, enriched },
 *   datasets: [ { name, table, records, last_updated, status } ],
 *   money_flows: { contracts: { records, total_value }, donations: { ... }, justice_funding: { ... } },
 *   donor_contractors: { count, total_donated, total_contract_value },
 *   source_breakdown: [ { source, total, has_description, enriched, embedded, has_url } ],
 *   agent_runs: [ recent runs ],
 * }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(p: PromiseLike<any>, ms = 12000): Promise<any> {
  const fallback = { count: null, data: null, error: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  const db = getServiceSupabase();

  try {
    const [
      tableCountsResult,
      freshnessResult,
      // Filtered counts
      grantsWithDesc, grantsEnriched, grantsEmbedded, grantsOpen,
      foundationsProfiled, foundationsWithWebsite,
      seEnriched,
      // Breakdowns
      sourceBreakdownResult,
      entityTypeBreakdown, relationshipTypeBreakdown,
      donorContractorStats,
      // Entity coverage
      entityCoverageResult,
      // Money totals
      contractTotals, donationTotals, justiceTotals,
      // Recent agent runs (public — just names + stats, no internal IDs)
      recentRuns,
    ] = await Promise.all([
      safe(db.rpc('get_table_counts'), 8000),
      safe(db.rpc('get_table_freshness'), 10000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('description', 'is', null).gt('description', ''), 8000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null), 8000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null), 8000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()), 8000),
      safe(db.from('foundations').select('*', { count: 'exact', head: true })
        .not('description', 'is', null), 8000),
      safe(db.from('foundations').select('*', { count: 'exact', head: true })
        .not('website', 'is', null), 8000),
      safe(db.from('social_enterprises').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null), 8000),
      safe(db.rpc('get_grant_source_breakdown'), 8000),
      safe(db.rpc('get_entity_type_breakdown'), 8000),
      safe(db.rpc('get_relationship_type_breakdown'), 8000),
      safe(db.from('mv_gs_donor_contractors').select('total_donated, total_contract_value')
        .order('total_donated', { ascending: false }).limit(1000), 8000),
      safe(db.rpc('exec_sql', { query: `
        SELECT
          COUNT(*) as total,
          COUNT(postcode) as with_postcode,
          COUNT(remoteness) as with_remoteness,
          COUNT(lga_name) as with_lga,
          COUNT(seifa_irsd_decile) as with_seifa,
          COUNT(abn) as with_abn,
          COUNT(website) as with_website,
          COUNT(description) as with_description,
          COUNT(CASE WHEN is_community_controlled THEN 1 END) as community_controlled
        FROM gs_entities
      ` }), 8000),
      safe(db.rpc('exec_sql', { query: `SELECT COUNT(*) as count, COALESCE(SUM(contract_value), 0) as total_value FROM austender_contracts` }), 8000),
      safe(db.rpc('exec_sql', { query: `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM political_donations` }), 8000),
      safe(db.rpc('exec_sql', { query: `SELECT COUNT(*) as count, COALESCE(SUM(amount_dollars), 0) as total_value FROM justice_funding` }), 8000),
      safe(db.from('agent_runs').select('agent_name, status, items_found, items_new, items_updated, duration_ms, completed_at')
        .order('completed_at', { ascending: false }).limit(20), 8000),
    ]);

    const tc: Record<string, number> = tableCountsResult.data ?? {};
    const tcount = (table: string) => tc[table] ?? 0;
    const tf: Record<string, string | null> = freshnessResult.data ?? {};
    const tfresh = (table: string): string | null => tf[table] ?? null;

    // Entity coverage
    const ecRows = entityCoverageResult.data ?? [];
    const ec = Array.isArray(ecRows) && ecRows.length > 0 ? ecRows[0] : {};
    const total = Number(ec.total ?? 0);
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

    // Donor-contractor aggregation
    const dcData = donorContractorStats.data ?? [];
    const dcTotalDonated = dcData.reduce((s: number, r: { total_donated: number }) => s + (r.total_donated || 0), 0);
    const dcTotalContracts = dcData.reduce((s: number, r: { total_contract_value: number }) => s + (r.total_contract_value || 0), 0);

    // Dataset freshness list
    const datasets = [
      { name: 'Entity Graph', table: 'gs_entities', records: tcount('gs_entities'), last_updated: tfresh('gs_entities') },
      { name: 'Relationships', table: 'gs_relationships', records: tcount('gs_relationships'), last_updated: tfresh('gs_relationships') },
      { name: 'AusTender Contracts', table: 'austender_contracts', records: tcount('austender_contracts'), last_updated: tfresh('austender_contracts') },
      { name: 'ACNC Charities', table: 'acnc_charities', records: tcount('acnc_charities'), last_updated: tfresh('acnc_charities') },
      { name: 'ACNC Annual Statements', table: 'acnc_ais', records: tcount('acnc_ais'), last_updated: tfresh('acnc_ais') },
      { name: 'Political Donations', table: 'political_donations', records: tcount('political_donations'), last_updated: tfresh('political_donations') },
      { name: 'Justice Funding', table: 'justice_funding', records: tcount('justice_funding'), last_updated: tfresh('justice_funding') },
      { name: 'ATO Tax Transparency', table: 'ato_tax_transparency', records: tcount('ato_tax_transparency'), last_updated: tfresh('ato_tax_transparency') },
      { name: 'Grant Opportunities', table: 'grant_opportunities', records: tcount('grant_opportunities'), last_updated: tfresh('grant_opportunities') },
      { name: 'Foundations', table: 'foundations', records: tcount('foundations'), last_updated: tfresh('foundations') },
      { name: 'Foundation Programs', table: 'foundation_programs', records: tcount('foundation_programs'), last_updated: tfresh('foundation_programs') },
      { name: 'Social Enterprises', table: 'social_enterprises', records: tcount('social_enterprises'), last_updated: tfresh('social_enterprises') },
      { name: 'ORIC Corporations', table: 'oric_corporations', records: tcount('oric_corporations'), last_updated: tfresh('oric_corporations') },
      { name: 'ASIC Companies', table: 'asic_companies', records: tcount('asic_companies'), last_updated: tfresh('asic_companies') },
      { name: 'ASX Companies', table: 'asx_companies', records: tcount('asx_companies'), last_updated: tfresh('asx_companies') },
      { name: 'SEIFA 2021', table: 'seifa_2021', records: tcount('seifa_2021'), last_updated: null, static: true },
      { name: 'Postcode Geography', table: 'postcode_geo', records: tcount('postcode_geo'), last_updated: null, static: true },
    ].map(d => ({
      ...d,
      status: d.static ? 'static' : !d.last_updated ? 'unknown' :
        (Date.now() - new Date(d.last_updated).getTime()) < 86400000 ? 'fresh' :
        (Date.now() - new Date(d.last_updated).getTime()) < 604800000 ? 'ok' :
        (Date.now() - new Date(d.last_updated).getTime()) < 2592000000 ? 'stale' : 'critical',
    }));

    const totalRecords = datasets.reduce((s, d) => s + d.records, 0);

    const response = NextResponse.json({
      platform: {
        name: 'GrantScope',
        description: "Australia's open funding intelligence platform",
        total_records: totalRecords,
        dataset_count: datasets.length,
        api_routes: 76,
        agents: 48,
        last_updated: new Date().toISOString(),
      },
      entities: {
        total,
        by_type: (entityTypeBreakdown as { data: Array<{ entity_type: string; count: number }> }).data ?? [],
        coverage: {
          postcode: { count: Number(ec.with_postcode ?? 0), pct: pct(Number(ec.with_postcode ?? 0)) },
          remoteness: { count: Number(ec.with_remoteness ?? 0), pct: pct(Number(ec.with_remoteness ?? 0)) },
          lga: { count: Number(ec.with_lga ?? 0), pct: pct(Number(ec.with_lga ?? 0)) },
          seifa: { count: Number(ec.with_seifa ?? 0), pct: pct(Number(ec.with_seifa ?? 0)) },
          abn: { count: Number(ec.with_abn ?? 0), pct: pct(Number(ec.with_abn ?? 0)) },
          website: { count: Number(ec.with_website ?? 0), pct: pct(Number(ec.with_website ?? 0)) },
          description: { count: Number(ec.with_description ?? 0), pct: pct(Number(ec.with_description ?? 0)) },
        },
        community_controlled: Number(ec.community_controlled ?? 0),
      },
      relationships: {
        total: tcount('gs_relationships'),
        by_type: (relationshipTypeBreakdown as { data: Array<{ relationship_type: string; count: number }> }).data ?? [],
      },
      grants: {
        total: tcount('grant_opportunities'),
        with_description: grantsWithDesc.count ?? 0,
        enriched: grantsEnriched.count ?? 0,
        embedded: grantsEmbedded.count ?? 0,
        open: grantsOpen.count ?? 0,
      },
      foundations: {
        total: tcount('foundations'),
        profiled: foundationsProfiled.count ?? 0,
        with_website: foundationsWithWebsite.count ?? 0,
        programs: tcount('foundation_programs'),
      },
      social_enterprises: {
        total: tcount('social_enterprises'),
        enriched: seEnriched.count ?? 0,
      },
      datasets,
      money_flows: {
        contracts: {
          records: Number(contractTotals.data?.[0]?.count ?? 0),
          total_value: Number(contractTotals.data?.[0]?.total_value ?? 0),
        },
        political_donations: {
          records: Number(donationTotals.data?.[0]?.count ?? 0),
          total_value: Number(donationTotals.data?.[0]?.total_value ?? 0),
        },
        justice_funding: {
          records: Number(justiceTotals.data?.[0]?.count ?? 0),
          total_value: Number(justiceTotals.data?.[0]?.total_value ?? 0),
        },
      },
      donor_contractors: {
        count: dcData.length,
        total_donated: dcTotalDonated,
        total_contract_value: dcTotalContracts,
      },
      source_breakdown: sourceBreakdownResult.data ?? [],
      recent_agent_runs: (recentRuns.data ?? []).map((r: { agent_name: string; status: string; items_found: number; items_new: number; items_updated: number; duration_ms: number; completed_at: string }) => ({
        agent: r.agent_name,
        status: r.status,
        found: r.items_found,
        new: r.items_new,
        updated: r.items_updated,
        duration_ms: r.duration_ms,
        completed_at: r.completed_at,
      })),
    });

    // Cache for 5 minutes, serve stale for 10 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (err) {
    console.error('[data/health]', err);
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
  }
}
