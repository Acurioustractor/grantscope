import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Wrap a promise with a timeout — returns fallback instead of hanging forever
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(p: PromiseLike<any>, ms = 15000): Promise<any> {
  const fallback = { count: null, data: null, error: 'timeout', status: 0, statusText: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Helper: get first timestamp value from a freshness query result
function getTs(result: { data: Record<string, string>[] | null }): string | null {
  const row = result?.data?.[0];
  if (!row) return null;
  return Object.values(row)[0] ?? null;
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceSupabase();

  try {
    // Batch 1: Core grants + foundations (these all worked before — no timeout needed)
    const [
      grantsTotal, grantsWithDesc, grantsEnriched, grantsEmbedded, grantsOpen,
      foundationsTotal, foundationsProfiled, foundationsWithWebsite,
      foundationPrograms, communityOrgs, seTotal, seEnriched,
      sourceBreakdownResult, confidenceBreakdownResult,
      recentRuns, recentDiscoveryRuns,
    ] = await Promise.all([
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('description', 'is', null).gt('description', ''),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()),
      db.from('foundations').select('*', { count: 'exact', head: true }),
      db.from('foundations').select('*', { count: 'exact', head: true })
        .not('description', 'is', null),
      db.from('foundations').select('*', { count: 'exact', head: true })
        .not('website', 'is', null),
      db.from('foundation_programs').select('*', { count: 'exact', head: true }),
      db.from('community_orgs').select('*', { count: 'exact', head: true }),
      db.from('social_enterprises').select('*', { count: 'exact', head: true }),
      db.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      db.rpc('get_grant_source_breakdown'),
      db.rpc('get_foundation_confidence_breakdown'),
      db.from('agent_runs').select('*').order('completed_at', { ascending: false }).limit(20),
      db.from('grant_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);

    // Batch 2: Entity graph + table counts + freshness — all in ONE parallel batch
    const [
      entitiesTotal, relationshipsTotal,
      entityTypeBreakdown, relationshipTypeBreakdown,
      acncCount, politicalDonationsCount, austenderCount, oricCount,
      seifaCount, asicCount, atoCount, rogsCount, asxCount, moneyFlowsCount,
      justiceFundingCount, almaInterventionsCount, almaOutcomesCount, almaEvidenceCount,
      donorContractorStats,
      // Freshness queries (ORDER BY + LIMIT 1 — fast)
      fGrants, fFoundations, fPrograms, fAcnc, fCommunity, fSE, fOric,
      fAustender, fDonations, fEntities, fRelationships, fAsic, fAto, fRogs, fAsx,
      fJusticeFunding, fAlmaInterventions, fAlmaOutcomes, fAlmaEvidence,
    ] = await Promise.all([
      safe(db.from('gs_entities').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('gs_relationships').select('*', { count: 'estimated', head: true }), 8000),
      Promise.resolve(db.rpc('get_entity_type_breakdown')).catch(() => ({ data: [] })),
      Promise.resolve(db.rpc('get_relationship_type_breakdown')).catch(() => ({ data: [] })),
      safe(db.from('acnc_charities').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('political_donations').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('austender_contracts').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('oric_corporations').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('seifa_2021').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('asic_companies').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('ato_tax_transparency').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('rogs_justice_spending').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('asx_companies').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('money_flows').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('justice_funding').select('*', { count: 'estimated', head: true }), 8000),
      safe(db.from('alma_interventions').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('alma_outcomes').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('alma_evidence').select('*', { count: 'exact', head: true }), 8000),
      safe(db.from('mv_gs_donor_contractors').select('total_donated, total_contract_value').order('total_donated', { ascending: false }).limit(1000), 8000),
      // Freshness
      safe(db.from('grant_opportunities').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('foundations').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('foundation_programs').select('scraped_at').order('scraped_at', { ascending: false }).limit(1), 10000),
      safe(db.from('acnc_charities').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('community_orgs').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('social_enterprises').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('oric_corporations').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('austender_contracts').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('political_donations').select('created_at').order('created_at', { ascending: false }).limit(1), 10000),
      safe(db.from('gs_entities').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('gs_relationships').select('created_at').order('created_at', { ascending: false }).limit(1), 10000),
      safe(db.from('asic_companies').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('ato_tax_transparency').select('created_at').order('created_at', { ascending: false }).limit(1), 10000),
      safe(db.from('rogs_justice_spending').select('created_at').order('created_at', { ascending: false }).limit(1), 10000),
      safe(db.from('asx_companies').select('created_at').order('created_at', { ascending: false }).limit(1), 10000),
      safe(db.from('justice_funding').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('alma_interventions').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('alma_outcomes').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
      safe(db.from('alma_evidence').select('updated_at').order('updated_at', { ascending: false }).limit(1), 10000),
    ]);

    // Aggregate donor-contractor stats
    const dcData = donorContractorStats.data ?? [];
    const dcTotalDonated = dcData.reduce((s: number, r: { total_donated: number }) => s + (r.total_donated || 0), 0);
    const dcTotalContracts = dcData.reduce((s: number, r: { total_contract_value: number }) => s + (r.total_contract_value || 0), 0);

    const dataFreshness = [
      { dataset: 'Grants', table: 'grant_opportunities', count: grantsTotal.count ?? 0, lastUpdated: getTs(fGrants) },
      { dataset: 'Foundations', table: 'foundations', count: foundationsTotal.count ?? 0, lastUpdated: getTs(fFoundations) },
      { dataset: 'Foundation Programs', table: 'foundation_programs', count: foundationPrograms.count ?? 0, lastUpdated: getTs(fPrograms) },
      { dataset: 'ACNC Charities', table: 'acnc_charities', count: acncCount.count ?? 0, lastUpdated: getTs(fAcnc) },
      { dataset: 'Community Orgs', table: 'community_orgs', count: communityOrgs.count ?? 0, lastUpdated: getTs(fCommunity) },
      { dataset: 'Social Enterprises', table: 'social_enterprises', count: seTotal.count ?? 0, lastUpdated: getTs(fSE) },
      { dataset: 'ORIC Corporations', table: 'oric_corporations', count: oricCount.count ?? 0, lastUpdated: getTs(fOric) },
      { dataset: 'AusTender Contracts', table: 'austender_contracts', count: austenderCount.count ?? 0, lastUpdated: getTs(fAustender) },
      { dataset: 'Political Donations (AEC)', table: 'political_donations', count: politicalDonationsCount.count ?? 0, lastUpdated: getTs(fDonations) },
      { dataset: 'Entities', table: 'gs_entities', count: entitiesTotal.count ?? 0, lastUpdated: getTs(fEntities) },
      { dataset: 'Relationships', table: 'gs_relationships', count: relationshipsTotal.count ?? 0, lastUpdated: getTs(fRelationships) },
      { dataset: 'ASIC Companies', table: 'asic_companies', count: asicCount.count ?? 0, lastUpdated: getTs(fAsic) },
      { dataset: 'ATO Tax Transparency', table: 'ato_tax_transparency', count: atoCount.count ?? 0, lastUpdated: getTs(fAto) },
      { dataset: 'ROGS Justice Spending', table: 'rogs_justice_spending', count: rogsCount.count ?? 0, lastUpdated: getTs(fRogs) },
      { dataset: 'ASX Companies', table: 'asx_companies', count: asxCount.count ?? 0, lastUpdated: getTs(fAsx) },
      { dataset: 'Money Flows', table: 'money_flows', count: moneyFlowsCount.count ?? 0, lastUpdated: null },
      { dataset: 'SEIFA Postcodes', table: 'seifa_2021', count: seifaCount.count ?? 0, lastUpdated: null, static: true },
      { dataset: 'Justice Funding', table: 'justice_funding', count: justiceFundingCount.count ?? 0, lastUpdated: getTs(fJusticeFunding) },
      { dataset: 'ALMA Interventions', table: 'alma_interventions', count: almaInterventionsCount.count ?? 0, lastUpdated: getTs(fAlmaInterventions) },
      { dataset: 'ALMA Outcomes', table: 'alma_outcomes', count: almaOutcomesCount.count ?? 0, lastUpdated: getTs(fAlmaOutcomes) },
      { dataset: 'ALMA Evidence', table: 'alma_evidence', count: almaEvidenceCount.count ?? 0, lastUpdated: getTs(fAlmaEvidence) },
    ];

    const entityTypes = (entityTypeBreakdown as { data: Array<{ entity_type: string; count: number }> }).data ?? [];
    const relTypes = (relationshipTypeBreakdown as { data: Array<{ relationship_type: string; count: number }> }).data ?? [];
    const totalRecords = dataFreshness.reduce((s, d) => s + d.count, 0);

    return NextResponse.json({
      stats: {
        grants: {
          total: grantsTotal.count ?? 0,
          withDescription: grantsWithDesc.count ?? 0,
          enriched: grantsEnriched.count ?? 0,
          embedded: grantsEmbedded.count ?? 0,
          open: grantsOpen.count ?? 0,
        },
        foundations: {
          total: foundationsTotal.count ?? 0,
          profiled: foundationsProfiled.count ?? 0,
          withWebsite: foundationsWithWebsite.count ?? 0,
          programs: foundationPrograms.count ?? 0,
        },
        community: { orgs: communityOrgs.count ?? 0 },
        socialEnterprises: {
          total: seTotal.count ?? 0,
          enriched: seEnriched.count ?? 0,
        },
      },
      entityGraph: {
        totalEntities: entitiesTotal.count ?? 0,
        totalRelationships: relationshipsTotal.count ?? 0,
        entityTypes,
        relationshipTypes: relTypes,
        donorContractors: {
          count: dcData.length,
          totalDonated: dcTotalDonated,
          totalContractValue: dcTotalContracts,
        },
      },
      tableCounts: {
        acncCharities: acncCount.count ?? 0,
        politicalDonations: politicalDonationsCount.count ?? 0,
        austenderContracts: austenderCount.count ?? 0,
        oricCorporations: oricCount.count ?? 0,
        seifaPostcodes: seifaCount.count ?? 0,
        asicCompanies: asicCount.count ?? 0,
        atoTaxTransparency: atoCount.count ?? 0,
        rogsJusticeSpending: rogsCount.count ?? 0,
        asxCompanies: asxCount.count ?? 0,
        moneyFlows: moneyFlowsCount.count ?? 0,
        justiceFunding: justiceFundingCount.count ?? 0,
        almaInterventions: almaInterventionsCount.count ?? 0,
        almaOutcomes: almaOutcomesCount.count ?? 0,
        almaEvidence: almaEvidenceCount.count ?? 0,
      },
      totalRecords,
      dataFreshness,
      sourceBreakdown: sourceBreakdownResult.data ?? [],
      confidenceBreakdown: confidenceBreakdownResult.data ?? [],
      recentRuns: recentRuns.data ?? [],
      discoveryRuns: recentDiscoveryRuns.data ?? [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ops/health]', err);
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
  }
}
