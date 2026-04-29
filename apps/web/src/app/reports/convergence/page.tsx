import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import { money, fmt } from '@/lib/format';
import { ReportCTA } from '../_components/report-cta';

export const revalidate = 3600;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type DesertRow = {
  lga_name: string;
  state: string;
  remoteness: string;
  desert_score: number;
  avg_irsd_decile: number;
  community_controlled_entities: number;
  justice_entities: number;
  ndis_entities: number;
  ndis_participants: number;
  justice_dollars: number;
  procurement_dollars: number;
  total_dollar_flow: number;
  indexed_entities: number;
  multi_system_entities: number;
};

type MoneySplit = {
  is_community_controlled: boolean;
  org_count: number;
  total_funding: number;
  grant_count: number;
};

type ContractSplit = {
  is_community_controlled: boolean;
  supplier_count: number;
  total_value: number;
  contract_count: number;
};

type AlmaFundingGap = {
  type: string;
  intervention_count: number;
  avg_portfolio_score: number;
  funded_count: number;
  total_funded: number;
};

type PipelineCost = {
  service_type: string;
  cost_per_day: number;
  financial_year: string;
};

type ChildProtectionStat = {
  metric_name: string;
  total_value: number;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data fetching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getData() {
  const supabase = getServiceSupabase();

  const [
    desertRows,
    totalJusticeFunding,
    totalNdisParticipants,
    childProtectionNotifications,
    communityControlledPct,
    avgDesertScoreRemote,
    moneySplit,
    contractSplit,
    almaFundingGap,
    pipelineCosts,
    communityControlledCount,
    totalEntitiesInJustice,
  ] = await Promise.all([
    // Top 20 convergence LGAs from funding deserts
    safe(supabase.rpc('exec_sql', {
      query: `SELECT lga_name, state, remoteness, desert_score::float,
                avg_irsd_decile::float, community_controlled_entities::int,
                justice_entities::int, ndis_entities::int,
                ndis_participants::int, justice_dollars::float,
                procurement_dollars::float, total_dollar_flow::float,
                indexed_entities::int, multi_system_entities::int
         FROM mv_funding_deserts
         WHERE desert_score IS NOT NULL
           AND justice_entities > 0
           AND ndis_participants > 0
         ORDER BY desert_score DESC
         LIMIT 20`,
    }), 'convergence-deserts') as Promise<DesertRow[] | null>,

    // Total justice funding
    safe(supabase.rpc('exec_sql', {
      query: `SELECT SUM(amount_dollars)::bigint as total FROM justice_funding`,
    }), 'total-justice') as Promise<Array<{ total: number }> | null>,

    // Total NDIS participants (latest quarter)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT SUM(participant_count)::int as total
         FROM ndis_participants_lga
         WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)`,
    }), 'total-ndis') as Promise<Array<{ total: number }> | null>,

    // Child protection notifications
    safe(supabase.rpc('exec_sql', {
      query: `SELECT metric_name, SUM(value)::bigint as total_value
         FROM aihw_child_protection
         WHERE metric_name = 'T1 - Children in notifications(a)'
           AND state = 'AUS'
         GROUP BY metric_name`,
    }), 'cp-notifications') as Promise<ChildProtectionStat[] | null>,

    // Community-controlled org percentage (use power index MV — pre-aggregated, fast)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
         ROUND(100.0 * COUNT(*) FILTER (WHERE is_community_controlled = true) / NULLIF(COUNT(*), 0), 1)::float as pct
         FROM mv_entity_power_index
         WHERE system_count >= 1`,
    }), 'cc-pct') as Promise<Array<{ pct: number }> | null>,

    // Average desert score in remote areas
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ROUND(AVG(desert_score), 1)::float as avg_score
         FROM mv_funding_deserts
         WHERE remoteness IN ('Remote Australia', 'Very Remote Australia')
           AND desert_score IS NOT NULL`,
    }), 'desert-remote') as Promise<Array<{ avg_score: number }> | null>,

    // Money split: community-controlled vs mainstream (use power index MV — pre-aggregated)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
         is_community_controlled,
         COUNT(*)::int as org_count,
         SUM(justice_dollars)::bigint as total_funding,
         0 as grant_count
       FROM mv_entity_power_index
       WHERE in_justice_funding = 1 AND justice_dollars > 0
       GROUP BY is_community_controlled`,
    }), 'money-split') as Promise<MoneySplit[] | null>,

    // Contract split: community-controlled vs mainstream (use power index MV — pre-aggregated)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
         is_community_controlled,
         COUNT(*)::int as supplier_count,
         SUM(procurement_dollars)::bigint as total_value,
         SUM(contract_count)::int as contract_count
       FROM mv_entity_power_index
       WHERE in_procurement = 1 AND procurement_dollars > 0
       GROUP BY is_community_controlled`,
    }), 'contract-split') as Promise<ContractSplit[] | null>,

    // ALMA evidence gap: intervention types with evidence vs funding
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
         ai.type,
         COUNT(*)::int as intervention_count,
         ROUND(AVG(ai.portfolio_score), 3)::float as avg_portfolio_score,
         COUNT(DISTINCT jf.recipient_abn)::int as funded_count,
         COALESCE(SUM(jf.amount_dollars), 0)::bigint as total_funded
       FROM alma_interventions ai
       LEFT JOIN gs_entities e ON e.id = ai.gs_entity_id
       LEFT JOIN justice_funding jf ON jf.recipient_abn = e.abn AND jf.recipient_abn IS NOT NULL
       GROUP BY ai.type
       ORDER BY intervention_count DESC`,
    }), 'alma-gap') as Promise<AlmaFundingGap[] | null>,

    // Pipeline costs from ROGS
    safe(supabase.rpc('exec_sql', {
      query: `SELECT service_type, aust::float as cost_per_day, financial_year
       FROM rogs_justice_spending
       WHERE measure ILIKE '%cost%'
         AND unit = '$'
         AND financial_year = '2024-25'
         AND aust IS NOT NULL
       ORDER BY aust DESC`,
    }), 'pipeline-costs') as Promise<PipelineCost[] | null>,

    // Count of community-controlled orgs (use power index MV)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int as count FROM mv_entity_power_index WHERE is_community_controlled = true`,
    }), 'cc-count') as Promise<Array<{ count: number }> | null>,

    // Count entities in justice funding
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(DISTINCT recipient_abn)::int as count FROM justice_funding WHERE recipient_abn IS NOT NULL`,
    }), 'justice-entities') as Promise<Array<{ count: number }> | null>,
  ]);

  return {
    desertRows: desertRows || [],
    totalJusticeFunding: (totalJusticeFunding || [])[0]?.total || 0,
    totalNdisParticipants: (totalNdisParticipants || [])[0]?.total || 0,
    childProtectionNotifications: (childProtectionNotifications || [])[0]?.total_value || 0,
    communityControlledPct: (communityControlledPct || [])[0]?.pct || 0,
    avgDesertScoreRemote: (avgDesertScoreRemote || [])[0]?.avg_score || 0,
    moneySplit: moneySplit || [],
    contractSplit: contractSplit || [],
    almaFundingGap: almaFundingGap || [],
    pipelineCosts: pipelineCosts || [],
    communityControlledCount: (communityControlledCount || [])[0]?.count || 0,
    totalEntitiesInJustice: (totalEntitiesInJustice || [])[0]?.count || 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function ConvergenceReportPage() {
  const data = await getData();

  // Compute money split values
  const ccFunding = data.moneySplit.find(r => r.is_community_controlled === true);
  const mainFunding = data.moneySplit.find(r => r.is_community_controlled === false);
  const ccContracts = data.contractSplit.find(r => r.is_community_controlled === true);
  const mainContracts = data.contractSplit.find(r => r.is_community_controlled === false);

  const ccFundingTotal = ccFunding?.total_funding || 0;
  const mainFundingTotal = mainFunding?.total_funding || 0;
  const totalFundingSplit = ccFundingTotal + mainFundingTotal;
  const ccFundingPct = totalFundingSplit > 0 ? ((ccFundingTotal / totalFundingSplit) * 100).toFixed(1) : '0';

  const ccContractTotal = ccContracts?.total_value || 0;
  const mainContractTotal = mainContracts?.total_value || 0;
  const totalContractSplit = ccContractTotal + mainContractTotal;
  const ccContractPct = totalContractSplit > 0 ? ((ccContractTotal / totalContractSplit) * 100).toFixed(1) : '0';

  // Pipeline: compute ratio
  const detentionCost = data.pipelineCosts.find(r => r.service_type === 'Detention-based supervision');
  const communityCost = data.pipelineCosts.find(r => r.service_type === 'Community-based supervision');
  const conferencingCost = data.pipelineCosts.find(r => r.service_type === 'Group conferencing');
  const costRatio = (detentionCost && communityCost && communityCost.cost_per_day > 0)
    ? Math.round(detentionCost.cost_per_day / communityCost.cost_per_day)
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* ━━━━ HERO ━━━━ */}
      <div className="mb-10">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em]">Flagship Investigation</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-bauhaus-black mb-4 leading-tight">
          One Child. Five Systems.<br />Zero Coordination.
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          The same communities appear in every government system &mdash; child protection, youth justice,
          disability, education, welfare. CivicGraph connects the data these systems refuse to share.
          The picture it reveals: money flows to maintain systems, not to help people.
          Community-controlled organisations have the evidence. They get the crumbs.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 uppercase tracking-wider">Cross-System</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 uppercase tracking-wider">ROGS + AIHW + NDIS + ALMA</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 uppercase tracking-wider">{fmt(data.desertRows.length)} LGAs Profiled</span>
        </div>
      </div>

      {/* ━━━━ THE NUMBERS BAR ━━━━ */}
      <section className="mb-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white border-4 border-bauhaus-black p-5 text-center" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
            <div className="text-2xl sm:text-3xl font-black text-bauhaus-red">{money(data.totalJusticeFunding)}</div>
            <div className="text-xs text-bauhaus-muted mt-1 font-bold uppercase tracking-wider">Justice Funding Tracked</div>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-5 text-center" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
            <div className="text-2xl sm:text-3xl font-black text-bauhaus-blue">{fmt(data.totalNdisParticipants)}</div>
            <div className="text-xs text-bauhaus-muted mt-1 font-bold uppercase tracking-wider">NDIS Participants</div>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-5 text-center" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
            <div className="text-2xl sm:text-3xl font-black text-bauhaus-red">{fmt(data.childProtectionNotifications)}</div>
            <div className="text-xs text-bauhaus-muted mt-1 font-bold uppercase tracking-wider">Child Protection Notifications</div>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-5 text-center" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
            <div className="text-2xl sm:text-3xl font-black text-bauhaus-black">{data.communityControlledPct}%</div>
            <div className="text-xs text-bauhaus-muted mt-1 font-bold uppercase tracking-wider">Community-Controlled Orgs</div>
          </div>
          <div className="bg-white border-4 border-bauhaus-black p-5 text-center" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
            <div className="text-2xl sm:text-3xl font-black text-bauhaus-red">{data.avgDesertScoreRemote}</div>
            <div className="text-xs text-bauhaus-muted mt-1 font-bold uppercase tracking-wider">Avg Desert Score (Remote)</div>
          </div>
        </div>
      </section>

      {/* ━━━━ THE CONVERGENCE TABLE ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">The Convergence Map</h2>
        <p className="text-sm text-bauhaus-muted mb-4 max-w-3xl">
          These LGAs appear in every system at once: high disadvantage, high justice contact,
          high disability need, minimal community-controlled service delivery.
          The desert score measures how badly disadvantage outpaces funding.
        </p>
        {data.desertRows.length > 0 ? (
          <div className="overflow-x-auto border-4 border-bauhaus-black">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Desert Score</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">IRSD Decile</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Justice Orgs</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">NDIS</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">CC Orgs</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Multi-System</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Justice $</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Total Flow</th>
                </tr>
              </thead>
              <tbody>
                {data.desertRows.map((row, i) => (
                  <tr key={`${row.lga_name}-${row.state}-${i}`} className={`border-t border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-3 py-2 font-bold">
                      <Link href={`/places?lga=${encodeURIComponent(row.lga_name)}`} className="text-bauhaus-blue hover:text-bauhaus-red">
                        {row.lga_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-bauhaus-muted">{row.state}</td>
                    <td className="px-3 py-2 text-right font-black text-bauhaus-red">{row.desert_score.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{row.avg_irsd_decile.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{fmt(row.justice_entities)}</td>
                    <td className="px-3 py-2 text-right">{fmt(row.ndis_participants)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(row.community_controlled_entities)}</td>
                    <td className="px-3 py-2 text-right">{fmt(row.multi_system_entities)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.justice_dollars)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(row.total_dollar_flow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black p-8 bg-gray-50 text-center text-bauhaus-muted">
            No convergence data available.
          </div>
        )}
        <p className="text-[10px] text-bauhaus-muted mt-2">
          Source: CivicGraph mv_funding_deserts &mdash; cross-referencing SEIFA disadvantage, justice funding,
          NDIS participation, procurement, and entity registration data.
        </p>
      </section>

      {/* ━━━━ THE MONEY SPLIT ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">The Money Split</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-3xl">
          Community-controlled organisations are designed by and for the communities they serve.
          They have the relationships, the cultural authority, and increasingly the evidence.
          Here is what they actually receive.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Justice Funding Split */}
          <div className="border-4 border-bauhaus-black p-6 bg-white" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-4">Justice Funding Allocation</div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold">Community-Controlled</span>
                  <span className="text-sm font-black text-bauhaus-red">{ccFundingPct}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 border-2 border-bauhaus-black">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${ccFundingPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-bauhaus-muted">
                  <span>{money(ccFundingTotal)} across {fmt(ccFunding?.org_count || 0)} orgs</span>
                  <span>{fmt(ccFunding?.grant_count || 0)} grants</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold">Mainstream</span>
                  <span className="text-sm font-black">{(100 - parseFloat(ccFundingPct)).toFixed(1)}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 border-2 border-bauhaus-black">
                  <div
                    className="h-full bg-gray-500"
                    style={{ width: `${100 - parseFloat(ccFundingPct)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-bauhaus-muted">
                  <span>{money(mainFundingTotal)} across {fmt(mainFunding?.org_count || 0)} orgs</span>
                  <span>{fmt(mainFunding?.grant_count || 0)} grants</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contracts Split */}
          <div className="border-4 border-bauhaus-black p-6 bg-white" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-4">Government Contracts</div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold">Community-Controlled</span>
                  <span className="text-sm font-black text-bauhaus-red">{ccContractPct}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 border-2 border-bauhaus-black">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${Math.max(parseFloat(ccContractPct), 0.5)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-bauhaus-muted">
                  <span>{money(ccContractTotal)} across {fmt(ccContracts?.supplier_count || 0)} suppliers</span>
                  <span>{fmt(ccContracts?.contract_count || 0)} contracts</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold">Mainstream</span>
                  <span className="text-sm font-black">{(100 - parseFloat(ccContractPct)).toFixed(1)}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 border-2 border-bauhaus-black">
                  <div
                    className="h-full bg-gray-500"
                    style={{ width: `${100 - parseFloat(ccContractPct)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-bauhaus-muted">
                  <span>{money(mainContractTotal)} across {fmt(mainContracts?.supplier_count || 0)} suppliers</span>
                  <span>{fmt(mainContracts?.contract_count || 0)} contracts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Callout */}
        <div className="mt-6 border-4 border-bauhaus-red bg-red-50 p-5">
          <p className="text-sm font-bold text-bauhaus-black">
            Community-controlled organisations receive <span className="text-bauhaus-red font-black">{ccFundingPct}%</span> of
            justice funding and <span className="text-bauhaus-red font-black">{ccContractPct}%</span> of government
            contracts &mdash; despite representing the communities with the highest need and the strongest evidence base.
          </p>
        </div>
      </section>

      {/* ━━━━ THE EVIDENCE GAP ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">The Evidence Gap</h2>
        <p className="text-sm text-bauhaus-muted mb-4 max-w-3xl">
          The Australian Living Map of Alternatives (ALMA) catalogues {fmt(data.almaFundingGap.reduce((s, r) => s + r.intervention_count, 0))} interventions
          with evidence of what works. Here is how that evidence maps to funding.
        </p>
        {data.almaFundingGap.length > 0 ? (
          <div className="overflow-x-auto border-4 border-bauhaus-black">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-xs">Intervention Type</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Interventions</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Avg Evidence Score</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Funded Orgs</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Total Funded</th>
                  <th className="text-right px-3 py-2 font-black uppercase tracking-wider text-xs">Gap Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.almaFundingGap.map((row, i) => {
                  const gapSignal = row.intervention_count > 0 && row.funded_count === 0
                    ? 'UNFUNDED'
                    : row.avg_portfolio_score > 0.3 && row.total_funded < 1_000_000
                      ? 'UNDERFUNDED'
                      : 'FUNDED';
                  return (
                    <tr key={row.type} className={`border-t border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                      <td className="px-3 py-2 font-bold">{row.type}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.intervention_count)}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.avg_portfolio_score?.toFixed(3) || '—'}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.funded_count)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{money(row.total_funded)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${
                          gapSignal === 'UNFUNDED' ? 'bg-red-100 text-red-700 border border-red-300' :
                          gapSignal === 'UNDERFUNDED' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                          'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        }`}>
                          {gapSignal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black p-8 bg-gray-50 text-center text-bauhaus-muted">
            No ALMA evidence data available.
          </div>
        )}
        <p className="text-[10px] text-bauhaus-muted mt-2">
          Source: ALMA intervention database cross-referenced with justice_funding by entity ABN.
          Evidence score is the ALMA portfolio_score (0-1) averaging methodology rigour, cultural authority, and outcome evidence.
        </p>
      </section>

      {/* ━━━━ THE PIPELINE COST ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">The Pipeline Cost</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-3xl">
          The justice system spends orders of magnitude more on locking children up than on keeping them out.
          ROGS 2024-25 data on the cost per young person per day across the pipeline.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {detentionCost && (
            <div className="border-4 border-bauhaus-red bg-red-50 p-6 text-center" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red, #D02020)' }}>
              <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Detention</div>
              <div className="text-3xl sm:text-4xl font-black text-bauhaus-black">${fmt(Math.round(detentionCost.cost_per_day))}</div>
              <div className="text-xs text-bauhaus-muted mt-1">per young person per day</div>
            </div>
          )}
          {communityCost && (
            <div className="border-4 border-bauhaus-black bg-white p-6 text-center" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
              <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">Community Supervision</div>
              <div className="text-3xl sm:text-4xl font-black text-bauhaus-black">${fmt(Math.round(communityCost.cost_per_day))}</div>
              <div className="text-xs text-bauhaus-muted mt-1">per young person per day</div>
            </div>
          )}
          {conferencingCost && (
            <div className="border-4 border-bauhaus-black bg-emerald-50 p-6 text-center" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
              <div className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Group Conferencing</div>
              <div className="text-3xl sm:text-4xl font-black text-bauhaus-black">${fmt(Math.round(conferencingCost.cost_per_day))}</div>
              <div className="text-xs text-bauhaus-muted mt-1">per conference</div>
            </div>
          )}
        </div>

        {costRatio > 0 && (
          <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-center">
            <div className="text-4xl sm:text-5xl font-black text-bauhaus-yellow">{costRatio}:1</div>
            <p className="text-white/80 text-sm mt-2 max-w-lg mx-auto">
              Detention costs <span className="text-bauhaus-yellow font-black">{costRatio}x more</span> per
              young person per day than community supervision. Every dollar spent on prevention
              saves multiples in incarceration costs &mdash; and that is before counting the human cost.
            </p>
          </div>
        )}

        <p className="text-[10px] text-bauhaus-muted mt-2">
          Source: Productivity Commission Report on Government Services (ROGS) Table 17A, 2024-25.
          National averages. State-level variation is significant.
        </p>
      </section>

      {/* ━━━━ THE THESIS ━━━━ */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red, #D02020)' }}>
          <h2 className="text-xl font-black text-bauhaus-yellow uppercase tracking-wider mb-4">The Pattern</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-bauhaus-yellow text-xs font-black uppercase tracking-widest mb-2">1. Known Early</div>
              <p className="text-white/80 text-sm leading-relaxed">
                Children are known to child protection years before they enter youth justice.
                {data.childProtectionNotifications > 0 && (
                  <> {fmt(data.childProtectionNotifications)} notifications recorded nationally.</>
                )}
              </p>
            </div>
            <div>
              <div className="text-bauhaus-yellow text-xs font-black uppercase tracking-widest mb-2">2. Seen Everywhere</div>
              <p className="text-white/80 text-sm leading-relaxed">
                The same communities appear in NDIS, welfare, education, and justice data.
                {data.totalNdisParticipants > 0 && (
                  <> {fmt(data.totalNdisParticipants)} NDIS participants in the same LGAs.</>
                )}
              </p>
            </div>
            <div>
              <div className="text-bauhaus-yellow text-xs font-black uppercase tracking-widest mb-2">3. Funded to Fail</div>
              <p className="text-white/80 text-sm leading-relaxed">
                Money flows to maintain the systems that process people, not to the community organisations
                that could intervene early. Community-controlled orgs get {ccFundingPct}%.
              </p>
            </div>
            <div>
              <div className="text-bauhaus-yellow text-xs font-black uppercase tracking-widest mb-2">4. Evidence Ignored</div>
              <p className="text-white/80 text-sm leading-relaxed">
                ALMA catalogues what works &mdash; prevention, diversion, cultural connection.
                The funding goes to detention at {costRatio > 0 ? `${costRatio}x` : 'multiples of'} the cost.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ CALL TO ACTION ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4">Go Deeper</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/reports/youth-justice" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-red-50 transition-colors group">
            <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-1">Youth Justice</div>
            <div className="font-black text-bauhaus-black group-hover:text-bauhaus-red transition-colors">Follow the Child</div>
            <p className="text-xs text-bauhaus-muted mt-1">State-by-state spending, outcomes, and evidence</p>
          </Link>
          <Link href="/map" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-blue-50 transition-colors group">
            <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-1">Funding Deserts</div>
            <div className="font-black text-bauhaus-black group-hover:text-bauhaus-blue transition-colors">See the Map</div>
            <p className="text-xs text-bauhaus-muted mt-1">Where disadvantage outpaces funding</p>
          </Link>
          <Link href="/graph?mode=justice" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-amber-50 transition-colors group">
            <div className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Network Graph</div>
            <div className="font-black text-bauhaus-black group-hover:text-amber-600 transition-colors">See the Connections</div>
            <p className="text-xs text-bauhaus-muted mt-1">Who funds whom in the justice system</p>
          </Link>
          <Link href="/reports/child-protection" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-amber-50 transition-colors group">
            <div className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Child Protection</div>
            <div className="font-black text-bauhaus-black group-hover:text-amber-600 transition-colors">The First System</div>
            <p className="text-xs text-bauhaus-muted mt-1">Notifications, out-of-home care, and the pipeline</p>
          </Link>
          <Link href="/reports/disability" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-blue-50 transition-colors group">
            <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-1">Disability</div>
            <div className="font-black text-bauhaus-black group-hover:text-bauhaus-blue transition-colors">NDIS Markets</div>
            <p className="text-xs text-bauhaus-muted mt-1">Thin supply, who delivers, and who misses out</p>
          </Link>
          <Link href="/places" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-emerald-50 transition-colors group">
            <div className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-1">Place Intelligence</div>
            <div className="font-black text-bauhaus-black group-hover:text-emerald-700 transition-colors">Search by Place</div>
            <p className="text-xs text-bauhaus-muted mt-1">LGA-level data across all systems</p>
          </Link>
        </div>
      </section>

      {/* ━━━━ CTA ━━━━ */}
      <ReportCTA
        reportSlug="convergence"
        reportTitle="One Child. Five Systems. Zero Coordination."
        pdfDescription="The complete convergence analysis as a formatted PDF — cross-system data, funding splits, evidence gaps, and pipeline costs. Ready for board papers, submissions, or media."
      />
    </div>
  );
}
