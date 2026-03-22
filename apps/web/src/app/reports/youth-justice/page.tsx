import Link from 'next/link';
import { YouthJusticeCharts, CrossSystemCharts } from './charts';
import { ReportCTA } from '../_components/report-cta';
import { FollowTheChild } from './follow-the-child';
import type { HeatmapRow } from './follow-the-child';
import { PowerMap } from './power-map';
import {
  getRogsTimeSeries,
  getAlmaInterventions,
  getAlmaCount,
  getAlmaByLga,
  getYouthJusticeContracts,
  getYouthJusticeGrants,
  getNdisYouthOverlay,
  getDssPaymentsByState,
  getYouthJusticeIndicators,
  getCrossSystemHeatmap,
  getAccoFundingGap,
  getFundingByRemoteness,
  getUnfundedEffectivePrograms,
  getYjRevolvingDoor,
  getYjFoundations,
  money,
} from '@/lib/services/report-service';

export const revalidate = 3600; // ISR: regenerate at most once per hour

const ALL_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type StateSpending = {
  state: string;
  financial_year: string;
  total: number;
  detention: number;
  community: number;
  conferencing: number;
};

type AlmaIntervention = {
  name: string;
  type: string;
  evidence_level: string;
  geography: string;
  portfolio_score: number;
};

type AustenderContract = {
  buyer_name: string;
  supplier_name: string;
  amount: number;
  year: number;
  title: string;
};

type GrantRecipient = {
  recipient_name: string;
  state: string | null;
  total: number;
  grants: number;
};

type NdisOverlay = {
  state: string;
  ndis_total: number;
  ndis_youth: number;
  psychosocial: number;
  intellectual: number;
  autism: number;
  ndis_budget: number;
};

type DssPayment = {
  state: string;
  payment_type: string;
  recipients: number;
};

type YjIndicator = {
  state: string;
  total_expenditure_m: number;
  cost_per_day: number;
  recidivism_pct: number | null;
  indigenous_rate_ratio: number | null;
  facility_count: number;
  total_beds: number;
  detention_indigenous_pct: number;
  ctg_detention_rate: number | null;
};

type StateTotal = {
  state: string;
  total_10yr: number;
  detention_10yr: number;
  community_10yr: number;
  latest_year: number;
  growth_pct: number;
};

type AccoGap = { org_type: string; orgs: number; total_funding: number; avg_grant: number };
type RemotenessRow = { remoteness: string; orgs: number; total: number; grants: number };
type UnfundedProgram = { name: string; type: string; evidence_level: string; cultural_authority: string; geography: string };
type RevolvingDoorRow = {
  canonical_name: string; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};
type FoundationRow = { name: string; total_giving_annual: number; thematic_focus: string; geographic_focus: string };

export type YouthJusticeReport = {
  stateTotals: StateTotal[];
  spendingTimeSeries: StateSpending[];
  almaInterventions: AlmaIntervention[];
  contracts: AustenderContract[];
  grants: GrantRecipient[];
  ndisOverlay: NdisOverlay[];
  dssPayments: DssPayment[];
  yjIndicators: YjIndicator[];
  heatmapRows: HeatmapRow[];
  nationalTotal: number;
  nationalDetention: number;
  nationalCommunity: number;
  almaCount: number;
  detentionCommunityRatio: number;
  accoGap: AccoGap[];
  remoteness: RemotenessRow[];
  unfundedPrograms: UnfundedProgram[];
  revolvingDoor: RevolvingDoorRow[];
  foundations: FoundationRow[];
};

async function getReport(): Promise<YouthJusticeReport> {
  const [rogsData, almaData, contractsData, grantsData, ndisData, dssData, yjIndicatorsData, heatmapData, almaCountVal, almaByLgaData, accoGapData, remotenessData, unfundedData, revolvingDoorData, foundationsData] = await Promise.all([
    getRogsTimeSeries('ROGS Youth Justice', ALL_STATES),
    getAlmaInterventions('youth-justice'),
    getYouthJusticeContracts(15),
    getYouthJusticeGrants(15),
    getNdisYouthOverlay(),
    getDssPaymentsByState(),
    getYouthJusticeIndicators(),
    getCrossSystemHeatmap(),
    getAlmaCount('youth-justice'),
    getAlmaByLga('youth-justice'),
    getAccoFundingGap('youth-justice'),
    getFundingByRemoteness('youth-justice'),
    getUnfundedEffectivePrograms('youth-justice'),
    getYjRevolvingDoor('youth-justice', 10),
    getYjFoundations(10),
  ]);

  // Process ROGS data into time series and state totals
  const rows = (rogsData as Array<{ state: string; financial_year: string; program_name: string; amount: number }> | null) || [];

  const spendingTimeSeries: StateSpending[] = [];
  const stateYearMap = new Map<string, StateSpending>();

  for (const row of rows) {
    const key = `${row.state}-${row.financial_year}`;
    if (!stateYearMap.has(key)) {
      stateYearMap.set(key, {
        state: row.state,
        financial_year: row.financial_year,
        total: 0,
        detention: 0,
        community: 0,
        conferencing: 0,
      });
    }
    const entry = stateYearMap.get(key)!;
    if (row.program_name === 'ROGS Youth Justice Total') entry.total = row.amount;
    if (row.program_name === 'ROGS Youth Justice Detention-based supervision') entry.detention = row.amount;
    if (row.program_name === 'ROGS Youth Justice Community-based supervision') entry.community = row.amount;
    if (row.program_name === 'ROGS Youth Justice Group conferencing') entry.conferencing = row.amount;
  }

  for (const entry of stateYearMap.values()) {
    spendingTimeSeries.push(entry);
  }
  spendingTimeSeries.sort((a, b) => a.state.localeCompare(b.state) || a.financial_year.localeCompare(b.financial_year));

  // Compute state totals
  const stateTotalMap = new Map<string, { total: number; detention: number; community: number; years: number[]; first: number; last: number }>();
  for (const entry of spendingTimeSeries) {
    if (!stateTotalMap.has(entry.state)) {
      stateTotalMap.set(entry.state, { total: 0, detention: 0, community: 0, years: [], first: 0, last: 0 });
    }
    const st = stateTotalMap.get(entry.state)!;
    st.total += entry.total;
    st.detention += entry.detention;
    st.community += entry.community;
    st.years.push(entry.total);
    if (st.years.length === 1) st.first = entry.total;
    st.last = entry.total;
  }

  const stateTotals: StateTotal[] = [];
  for (const [state, st] of stateTotalMap) {
    stateTotals.push({
      state,
      total_10yr: st.total,
      detention_10yr: st.detention,
      community_10yr: st.community,
      latest_year: st.last,
      growth_pct: st.first > 0 ? Math.round(((st.last - st.first) / st.first) * 100) : 0,
    });
  }
  stateTotals.sort((a, b) => b.total_10yr - a.total_10yr);

  const nationalTotal = stateTotals.reduce((s, st) => s + st.total_10yr, 0);
  const nationalDetention = stateTotals.reduce((s, st) => s + st.detention_10yr, 0);
  const nationalCommunity = stateTotals.reduce((s, st) => s + st.community_10yr, 0);

  // Merge ALMA intervention counts into heatmap rows
  const almaByLga = new Map<string, number>();
  for (const row of (almaByLgaData as Array<{ lga_name: string; alma_count: number }> | null) || []) {
    almaByLga.set(row.lga_name, row.alma_count);
  }
  const rawHeatmap = (heatmapData as Array<Omit<HeatmapRow, 'alma_count'>> | null) || [];
  const heatmapRows: HeatmapRow[] = rawHeatmap.map(r => ({
    ...r,
    alma_count: almaByLga.get(r.lga_name) || 0,
  }));

  return {
    stateTotals,
    spendingTimeSeries,
    almaInterventions: (almaData as AlmaIntervention[] | null) || [],
    contracts: (contractsData as AustenderContract[] | null) || [],
    grants: (grantsData as GrantRecipient[] | null) || [],
    ndisOverlay: (ndisData as NdisOverlay[] | null) || [],
    dssPayments: (dssData as DssPayment[] | null) || [],
    yjIndicators: (yjIndicatorsData as YjIndicator[] | null) || [],
    heatmapRows,
    nationalTotal,
    nationalDetention,
    nationalCommunity,
    almaCount: almaCountVal,
    detentionCommunityRatio: nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0,
    accoGap: (accoGapData as AccoGap[] | null) || [],
    remoteness: (remotenessData as RemotenessRow[] | null) || [],
    unfundedPrograms: (unfundedData as UnfundedProgram[] | null) || [],
    revolvingDoor: (revolvingDoorData as RevolvingDoorRow[] | null) || [],
    foundations: (foundationsData as FoundationRow[] | null) || [],
  };
}

const stateNames: Record<string, string> = {
  ACT: 'Australian Capital Territory',
  NSW: 'New South Wales',
  NT: 'Northern Territory',
  QLD: 'Queensland',
  SA: 'South Australia',
  TAS: 'Tasmania',
  VIC: 'Victoria',
  WA: 'Western Australia',
};

export default async function YouthJusticeReportPage() {
  const report = await getReport();

  // DSS uses full state names — map to abbreviations
  const dssStateMap: Record<string, string> = {
    'Australian Capital Territory': 'ACT',
    'New South Wales': 'NSW',
    'Northern Territory': 'NT',
    'Queensland': 'QLD',
    'South Australia': 'SA',
    'Tasmania': 'TAS',
    'Victoria': 'VIC',
    'Western Australia': 'WA',
  };

  // Pivot DSS data by state
  const dssByState = new Map<string, Record<string, number>>();
  for (const row of report.dssPayments) {
    const abbr = dssStateMap[row.state] || row.state;
    if (!dssByState.has(abbr)) dssByState.set(abbr, {});
    const entry = dssByState.get(abbr)!;
    if (row.payment_type === 'Disability Support Pension') entry.dsp = row.recipients;
    if (row.payment_type === 'Youth Allowance (other)') entry.youthAllowance = row.recipients;
    if (row.payment_type === 'JobSeeker Payment') entry.jobseeker = row.recipients;
  }


  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Cross-System Intelligence</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">All States</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Follow the Child
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          A child doesn&apos;t enter youth justice by accident. They are failed by schools, missed by disability services,
          raised in poverty, and known to child protection — long before they are locked up.
          This report traces the pipeline across {report.heatmapRows.length} communities.
        </p>
        <div className="flex gap-2 mt-4">
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">Contained Campaign</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">JusticeHub</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">ROGS 2015-2025</span>
        </div>
      </div>

      {/* ━━━━ Hero Stats ━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(report.nationalTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Total 10-Year Spend (All States)</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(report.nationalDetention)}</div>
          <div className="text-xs text-gray-500 mt-1">Detention Spending</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{money(report.nationalCommunity)}</div>
          <div className="text-xs text-gray-500 mt-1">Community Supervision</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{report.almaCount}</div>
          <div className="text-xs text-gray-500 mt-1">Evidence-Based Alternatives</div>
        </div>
      </div>

      {/* ━━━━ Five Structural Failures ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Five Structural Failures</h2>
        <p className="text-sm text-bauhaus-muted mb-6">The system doesn&apos;t fail randomly. These patterns are structural.</p>

        {/* 1. Incarceration Premium — big visual ratio */}
        <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-red)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #1</span>
            <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Incarceration Premium</span>
          </div>
          <p className="text-sm text-bauhaus-muted mb-4">
            For every $1 spent on community supervision, ${report.detentionCommunityRatio} is spent on detention.
            Evidence universally shows community-based approaches are cheaper AND more effective.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-stretch">
            <div className="flex-1 bg-red-50 border-2 border-red-200 rounded-sm p-4 text-center">
              <div className="text-3xl sm:text-4xl font-black text-red-600">{money(report.nationalDetention)}</div>
              <div className="text-xs text-red-400 font-bold uppercase tracking-wider mt-1">Detention</div>
              <div className="mt-3 h-4 bg-red-500 rounded-full" />
            </div>
            <div className="flex items-center justify-center text-2xl font-black text-bauhaus-muted">vs</div>
            <div className="flex-1 bg-emerald-50 border-2 border-emerald-200 rounded-sm p-4 text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600">{money(report.nationalCommunity)}</div>
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1">Community</div>
              <div className="mt-3 h-4 rounded-full overflow-hidden bg-gray-200">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((report.nationalCommunity / Math.max(report.nationalDetention, 1)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACCO Funding Gap */}
        {report.accoGap.length === 2 && (() => {
          const acco = report.accoGap.find(r => r.org_type === 'Community Controlled');
          const nonIndigenous = report.accoGap.find(r => r.org_type === 'Non-Indigenous');
          if (!acco || !nonIndigenous) return null;
          const gapPct = Math.round(((nonIndigenous.avg_grant - acco.avg_grant) / nonIndigenous.avg_grant) * 100);
          return (
            <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #2</span>
                <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Community-Controlled Gap</span>
              </div>
              <p className="text-sm text-bauhaus-muted mb-4">
                Community-controlled organisations receive <span className="font-black text-bauhaus-red">{gapPct}% smaller grants</span> on average
                than non-Indigenous providers — despite serving the populations most impacted by justice system contact.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-4">
                  <div className="text-xs font-black text-amber-600 uppercase tracking-wider mb-2">Community Controlled</div>
                  <div className="text-2xl font-black text-bauhaus-black">{acco.orgs} orgs</div>
                  <div className="text-sm font-mono text-bauhaus-muted">{money(acco.total_funding)} total</div>
                  <div className="text-sm font-mono font-bold text-amber-700">{money(acco.avg_grant)} avg grant</div>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-sm p-4">
                  <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Non-Indigenous</div>
                  <div className="text-2xl font-black text-bauhaus-black">{nonIndigenous.orgs} orgs</div>
                  <div className="text-sm font-mono text-bauhaus-muted">{money(nonIndigenous.total_funding)} total</div>
                  <div className="text-sm font-mono font-bold text-gray-700">{money(nonIndigenous.avg_grant)} avg grant</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. Geography Trap — remoteness bars */}
        {report.remoteness.length > 0 && (() => {
          const maxFunding = Math.max(...report.remoteness.map(r => r.total));
          const metro = report.remoteness.find(r => r.remoteness.includes('Major'));
          const remote = report.remoteness.filter(r => r.remoteness.includes('Remote'));
          const remoteTotalFunding = remote.reduce((s, r) => s + r.total, 0);
          const ratio = metro && remoteTotalFunding > 0 ? Math.round(metro.total / remoteTotalFunding) : 0;
          return (
            <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #3</span>
                <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Geography Trap</span>
              </div>
              <p className="text-sm text-bauhaus-muted mb-4">
                Major cities receive <span className="font-black text-bauhaus-red">{ratio}x more funding</span> than Remote + Very Remote combined —
                despite remote communities having the highest rates of youth justice contact.
              </p>
              <div className="space-y-3">
                {report.remoteness.map(r => (
                  <div key={r.remoteness} className="flex items-center gap-3">
                    <div className="w-44 text-xs font-bold text-right truncate shrink-0">{r.remoteness.replace(' Australia', '')}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm ${r.remoteness.includes('Remote') ? 'bg-red-500' : r.remoteness.includes('Outer') ? 'bg-amber-400' : r.remoteness.includes('Inner') ? 'bg-blue-400' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(2, (r.total / maxFunding) * 100)}%` }}
                      />
                    </div>
                    <div className="w-20 text-xs font-mono text-right shrink-0">{money(r.total)}</div>
                    <div className="w-16 text-[10px] text-bauhaus-muted text-right shrink-0">{r.orgs} orgs</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 4. Evidence-Funding Mismatch */}
        {report.unfundedPrograms.length > 0 && (
          <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #4</span>
              <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Evidence Without Funding</span>
            </div>
            <p className="text-sm text-bauhaus-muted mb-4">
              These <span className="font-black">{report.unfundedPrograms.length} programs</span> have proven effectiveness or Indigenous-led authority
              but <span className="font-black text-bauhaus-red">no matching justice funding</span> in our database.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.unfundedPrograms.map(p => (
                <div key={p.name} className="border-2 border-red-200 bg-red-50/50 rounded-sm p-3">
                  <h4 className="font-bold text-sm leading-tight mb-1">{p.name}</h4>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{p.type}</span>
                    {p.geography && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.geography}</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{p.evidence_level}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Revolving Door */}
        {report.revolvingDoor.length > 0 && (
          <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #5</span>
              <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Revolving Door</span>
            </div>
            <p className="text-sm text-bauhaus-muted mb-4">
              These entities receive youth justice funding while also holding government contracts and making political donations.
              Multiple influence vectors = structural power.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white text-left">
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px]">Entity</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-center">Vectors</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Donated</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Contracts</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Justice $</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.revolvingDoor.map((r, i) => (
                    <tr key={r.canonical_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs font-medium">
                        {r.canonical_name}
                        {r.is_community_controlled && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">ACCO</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-0.5">
                          {Array.from({ length: r.influence_vectors }, (_, j) => (
                            <div key={j} className="w-2.5 h-2.5 rounded-full bg-bauhaus-red" />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-600">{r.total_donated > 0 ? money(r.total_donated) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-purple-600">{money(r.total_contracts)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600">{money(r.total_funded)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold">{r.revolving_door_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ━━━━ Philanthropy Landscape ━━━━ */}
      {report.foundations.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Philanthropy Landscape</h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Foundations with youth, justice, or Indigenous focus areas. These are potential funding partners for evidence-based alternatives.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.foundations.map(f => {
              const focuses = f.thematic_focus.replace(/[{}"]/g, '').split(',').slice(0, 5);
              return (
                <div key={f.name} className="border-2 border-gray-200 rounded-sm p-4 hover:border-bauhaus-blue transition-colors">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-bold text-sm leading-tight">{f.name}</h4>
                    <span className="text-sm font-black text-bauhaus-blue shrink-0">{money(f.total_giving_annual)}/yr</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {focuses.map(tag => (
                      <span key={tag} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        tag.includes('justice') ? 'bg-red-100 text-red-700' :
                        tag.includes('indigenous') ? 'bg-amber-100 text-amber-700' :
                        tag.includes('youth') ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{tag.replace(/-/g, ' ')}</span>
                    ))}
                  </div>
                  {f.geographic_focus && <p className="text-[10px] text-gray-400">{f.geographic_focus}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ━━━━ Explore the Network ━━━━ */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-blue rounded-sm overflow-hidden">
          <div className="bg-bauhaus-blue text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Explore the Network</h2>
            <p className="text-sm text-white/70 mt-1">Interactive force-directed visualizations of youth justice funding flows and power structures.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
            <Link
              href="/graph?preset=2"
              className="p-5 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Youth Justice Graph</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Programs funding services — who funds whom and how much.</p>
            </Link>
            <Link
              href="/graph?preset=0"
              className="p-5 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Power Map</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Entities spanning 3+ systems — cross-system influence.</p>
            </Link>
            <Link
              href="/graph?preset=2"
              className="p-5 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Board Interlocks</h3>
              <p className="text-xs text-gray-500 leading-relaxed">People sitting on multiple charity boards — the hidden connectors.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━ Follow the Child: Pipeline + State Cards + Heatmap ━━━━ */}
      {report.heatmapRows.length > 0 && (
        <FollowTheChild rows={report.heatmapRows} />
      )}

      {/* ━━━━ State Comparison Table ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">State-by-State Spending</h2>
        <p className="text-sm text-bauhaus-muted mb-4">ROGS Youth Justice data, 2015-16 to 2024-25</p>
        <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">10-Year Total</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Detention</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Community</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Latest Year</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Growth</th>
              </tr>
            </thead>
            <tbody>
              {report.stateTotals.map((st, i) => (
                <tr key={st.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-bold">{stateNames[st.state] || st.state}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{money(st.total_10yr)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-red-600">{money(st.detention_10yr)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">{money(st.community_10yr)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{money(st.latest_year)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span className={st.growth_pct > 50 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                      +{st.growth_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━━ Charts (Client Component) ━━━━ */}
      <YouthJusticeCharts report={report} />

      {/* ━━━━ ALMA Interventions ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">What Works: Evidence from ALMA</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          From the Australian Living Map of Alternatives — {report.almaCount} youth justice interventions with documented evidence.
          Sorted by portfolio score (effectiveness x cultural authority x evidence quality).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.almaInterventions.map((intervention) => (
            <div key={intervention.name} className="border-2 border-gray-200 rounded-sm p-4 hover:border-bauhaus-black transition-colors">
              <div className="flex justify-between items-start gap-2 mb-2">
                <h4 className="font-bold text-sm leading-tight">{intervention.name}</h4>
                <span className="text-[10px] font-bold text-bauhaus-red bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                  {(intervention.portfolio_score * 100).toFixed(0)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded uppercase">{intervention.type}</span>
                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{intervention.geography}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{intervention.evidence_level}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━ PICC Power Map ━━━━ */}
      <PowerMap />

      <ReportCTA reportSlug="youth-justice" reportTitle="Youth Justice Report" variant="inline" />

      {/* ━━━━ Cross-System State Detail ━━━━ */}
      <section className="mb-10">
        <CrossSystemCharts report={report} lgaOverlap={[]} />

        <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mt-6 mb-3">State-by-State Detail</h3>

        {report.ndisOverlay.length > 0 && (
          <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">NDIS Youth</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Psychosocial</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Intellectual</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Autism</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">NDIS Budget</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">DSP Recipients</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Youth Allowance</th>
                </tr>
              </thead>
              <tbody>
                {report.ndisOverlay.map((row, i) => {
                  const dss = dssByState.get(row.state) || {};
                  return (
                    <tr key={row.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-bold">{stateNames[row.state] || row.state}</td>
                      <td className="px-4 py-3 text-right font-mono">{(row.ndis_youth ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">{(row.psychosocial ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-purple-600">{(row.intellectual ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600">{(row.autism ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(row.ndis_budget ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">{(dss.dsp || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{(dss.youthAllowance || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ━━━━ Contracts ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Youth Justice Contracts</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Federal procurement contracts from AusTender — who builds, operates, and services youth detention.
        </p>
        {report.contracts.length > 0 ? (
          <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Buyer</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Supplier</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Value</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Year</th>
                </tr>
              </thead>
              <tbody>
                {report.contracts.map((c, i) => (
                  <tr key={`contract-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-xs">{c.buyer_name}</td>
                    <td className="px-4 py-2 text-xs font-medium">{c.supplier_name}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm">{money(c.amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm">{c.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No contracts data available.</p>
        )}
      </section>

      {/* ━━━━ Grants ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Youth Justice Grants & Funding</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Where the money goes — state department allocations and the community organisations delivering services on the ground.
        </p>

        {report.grants.length > 0 && (() => {
          const deptKeywords = ['department of', 'directorate', 'total'];
          const isDept = (name: string) => deptKeywords.some(k => name.toLowerCase().startsWith(k));
          const depts = report.grants.filter(g => isDept(g.recipient_name));
          const orgs = report.grants.filter(g => !isDept(g.recipient_name));

          return (
            <>
              {depts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mb-3">State Department Allocations</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {depts.filter(d => d.recipient_name !== 'Total').map((d) => (
                      <div key={`dept-${d.recipient_name}-${d.state}`} className="bg-gray-50 border border-gray-200 rounded-sm p-3">
                        <div className="text-lg font-black text-bauhaus-black">{money(d.total)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{d.recipient_name}</div>
                        <div className="text-[10px] font-bold text-bauhaus-muted uppercase tracking-wider mt-1">{d.state}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orgs.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mb-3">Service Delivery Organisations</h3>
                  <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-bauhaus-black text-white text-left">
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Organisation</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Funding</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map((g, i) => (
                          <tr key={`grant-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-xs font-medium">{g.recipient_name}</td>
                            <td className="px-4 py-2 text-xs">{g.state || '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{money(g.total)}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{g.grants}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </section>

      {/* ━━━━ Campaign Links ━━━━ */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red rounded-sm overflow-hidden">
          <div className="bg-bauhaus-red text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Connected Campaigns</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <div className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200">
              <h3 className="font-black text-lg mb-2">Contained</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                Australia locks up children at extraordinary cost with extraordinary failure rates.
                This report provides the cross-system evidence for the Contained campaign —
                linking school disadvantage, family poverty, and the youth justice pipeline.
              </p>
              <p className="text-xs text-bauhaus-muted">
                Launching Monday. Data from this report feeds directly into Contained briefings.
              </p>
            </div>
            <div className="p-6">
              <h3 className="font-black text-lg mb-2">JusticeHub</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                The Australian Living Map of Alternatives (ALMA) catalogues {report.almaCount} youth justice
                interventions with documented evidence. This report surfaces ALMA data alongside
                government spending to show what works vs what gets funded.
              </p>
              <p className="text-xs text-bauhaus-muted">
                ALMA data powered by JusticeHub&apos;s community-sourced evidence database.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ Take Action ━━━━ */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black rounded-sm overflow-hidden">
          <div className="bg-bauhaus-black text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Use This Data</h2>
            <p className="text-sm text-gray-400 mt-1">Turn evidence into funding applications, partnership building, and strategic planning.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
            <Link
              href="/foundations?focus=youth-justice"
              className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-bauhaus-blue transition-colors">Find Funders</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Search 10,800+ foundations by thematic focus. Use this report&apos;s evidence to strengthen your case.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-bauhaus-blue uppercase tracking-wider">Browse Foundations &rarr;</span>
            </Link>
            <Link
              href="/grants"
              className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-green-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-green-700 transition-colors">Find Grants</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Search open grant opportunities. Youth justice, diversion, and family services programs available now.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-green-700 uppercase tracking-wider">Search Grants &rarr;</span>
            </Link>
            <Link
              href="/home"
              className="p-6 hover:bg-amber-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-amber-700 transition-colors">Your Dashboard</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Track your pipeline, match to opportunities, and build your org&apos;s evidence base.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Go to Dashboard &rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━ Data Sources ━━━━ */}
      <section className="mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Data Sources</h3>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
            <li>Productivity Commission Report on Government Services (ROGS) — Youth Justice tables, 2015-16 to 2024-25</li>
            <li>ACARA My School — School profiles including ICSEA, Indigenous enrolment, and school type</li>
            <li>Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database</li>
            <li>AusTender — Federal procurement contracts with youth justice entities</li>
            <li>State budget papers — all state/territory youth justice appropriations</li>
            <li>NDIS — Participant data by service district, disability type, and age</li>
            <li>Department of Social Services — Disability Support Pension, Youth Allowance, JobSeeker payment demographics</li>
            <li>ABS Estimated Resident Population 2023 — LGA-level population for per-capita normalization</li>
            <li>Crime statistics — BOCSAR (NSW), CSA (VIC), QPS (QLD), NTPFES (NT) at LGA level</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            This is a living report. All data is sourced from public datasets.
            Cross-system geographic linkage and per-capita normalization performed by CivicGraph.
          </p>
        </div>
      </section>

      <ReportCTA reportSlug="youth-justice" reportTitle="Youth Justice Report" />
    </div>
  );
}
