import Link from 'next/link';
import { YouthJusticeCharts } from './charts';
import {
  getRogsTimeSeries,
  getSchoolProfiles,
  getAlmaInterventions,
  getAlmaCount,
  getProviderContracts,
  money,
} from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

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

type CityProfile = {
  lga_name: string;
  state: string;
  schools: number;
  avg_icsea: number;
  low_icsea: number;
  avg_indig_pct: number;
  total_students: number;
};

type AlmaIntervention = {
  name: string;
  type: string;
  evidence_level: string;
  geography: string;
  portfolio_score: number;
};

type ProviderContract = {
  source: string;
  target: string;
  amount: number;
  year: number;
  dataset: string;
  relationship_type: string;
};

type StateTotal = {
  state: string;
  total_10yr: number;
  detention_10yr: number;
  community_10yr: number;
  latest_year: number;
  growth_pct: number;
};

export type YouthJusticeReport = {
  stateTotals: StateTotal[];
  spendingTimeSeries: StateSpending[];
  cityProfiles: CityProfile[];
  almaInterventions: AlmaIntervention[];
  providerContracts: ProviderContract[];
  nationalTotal: number;
  nationalDetention: number;
  nationalCommunity: number;
  almaCount: number;
  detentionCommunityRatio: number;
};

const YOUTH_JUSTICE_ENTITY_IDS = [
  '9bcaf78d-8336-4027-9f1a-9f4b1cd2d2a9',
  '480c807d-c368-4c27-a2a5-9f17c2788518',
  '1216ec52-7b4b-4621-b621-74a9a2a05498',
  '327b8eb9-28a1-4939-a355-4a0cf6e1e62f',
  'a88307dc-d781-4b38-a972-a0212cbff409',
  'e26309da-b12c-46c7-8683-6572a4725006',
];

const CITY_LGAS = [
  'Brisbane','Logan','Ipswich','Alice Springs',
  'Sydney','Canterbury-Bankstown','Blacktown',
  'Adelaide','Playford','Port Adelaide Enfield','Salisbury',
  'Perth','Armadale','Wanneroo',
];

async function getReport(): Promise<YouthJusticeReport> {
  const [rogsData, cityData, almaData, contractData, almaCountVal] = await Promise.all([
    getRogsTimeSeries('ROGS Youth Justice', ['QLD', 'NT', 'NSW', 'SA', 'WA']),
    getSchoolProfiles(CITY_LGAS),
    getAlmaInterventions('youth-justice'),
    getProviderContracts(YOUTH_JUSTICE_ENTITY_IDS),
    getAlmaCount('youth-justice'),
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

  return {
    stateTotals,
    spendingTimeSeries,
    cityProfiles: (cityData as CityProfile[] | null) || [],
    almaInterventions: (almaData as AlmaIntervention[] | null) || [],
    providerContracts: (contractData as ProviderContract[] | null) || [],
    nationalTotal,
    nationalDetention,
    nationalCommunity,
    almaCount: almaCountVal,
    detentionCommunityRatio: nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0,
  };
}

export default async function YouthJusticeReportPage() {
  const report = await getReport();

  const stateNames: Record<string, string> = {
    QLD: 'Queensland',
    NSW: 'New South Wales',
    NT: 'Northern Territory',
    SA: 'South Australia',
    WA: 'Western Australia',
  };

  const cityGroups: { metro: string; state: string; lgas: string[] }[] = [
    { metro: 'Brisbane', state: 'QLD', lgas: ['Brisbane', 'Logan', 'Ipswich'] },
    { metro: 'Alice Springs', state: 'NT', lgas: ['Alice Springs'] },
    { metro: 'Sydney', state: 'NSW', lgas: ['Sydney', 'Canterbury-Bankstown', 'Blacktown'] },
    { metro: 'Adelaide', state: 'SA', lgas: ['Adelaide', 'Playford', 'Port Adelaide Enfield', 'Salisbury'] },
    { metro: 'Perth', state: 'WA', lgas: ['Perth', 'Armadale', 'Wanneroo'] },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Cross-System Intelligence</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">5 Cities</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Youth Justice: Follow the Money
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Five states have spent {money(report.nationalTotal)} on youth justice over the past decade.
          {' '}{money(report.nationalDetention)} went to detention — {report.detentionCommunityRatio}x more than
          the {money(report.nationalCommunity)} spent on community supervision.
          Meanwhile, {report.almaCount} evidence-based alternatives exist.
        </p>
        <div className="flex gap-2 mt-4">
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">Contained Campaign</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">JusticeHub</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">ROGS 2015–2025</span>
        </div>
      </div>

      {/* ━━━━ Hero Stats ━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(report.nationalTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">Total 10-Year Spend (5 States)</div>
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

      {/* ━━━━ City Profiles ━━━━ */}
      <section className="mb-10 mt-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">City Profiles: School Disadvantage</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Cross-system view linking school ICSEA disadvantage to youth justice catchment areas.
          Low-ICSEA schools (&lt;900) indicate concentrated educational disadvantage.
        </p>

        {cityGroups.map((group) => {
          const lgas = report.cityProfiles.filter((p) => group.lgas.includes(p.lga_name));
          if (lgas.length === 0) return null;
          const totalStudents = lgas.reduce((s, l) => s + (l.total_students || 0), 0);
          const totalLowIcsea = lgas.reduce((s, l) => s + (l.low_icsea || 0), 0);

          return (
            <div key={group.metro} className="mb-6 border-4 border-bauhaus-black rounded-sm overflow-hidden">
              <div className="bg-bauhaus-black text-white px-4 py-3 flex justify-between items-center">
                <h3 className="font-black uppercase tracking-wider text-sm">{group.metro} Metro ({group.state})</h3>
                <div className="flex gap-4 text-xs">
                  <span>{totalStudents.toLocaleString()} students</span>
                  <span className="text-red-300">{totalLowIcsea} low-ICSEA schools</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider">LGA</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-right">Schools</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-right">Avg ICSEA</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-right">Low ICSEA (&lt;900)</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-right">Indigenous %</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-right">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {lgas.map((lga, i) => (
                    <tr key={lga.lga_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium">{lga.lga_name}</td>
                      <td className="px-4 py-2 text-right font-mono">{lga.schools}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        <span className={lga.avg_icsea < 950 ? 'text-red-600 font-bold' : lga.avg_icsea < 1000 ? 'text-amber-600' : 'text-gray-600'}>
                          {lga.avg_icsea}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {lga.low_icsea > 0 ? (
                          <span className="text-red-600 font-bold">{lga.low_icsea}</span>
                        ) : '0'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        <span className={lga.avg_indig_pct > 20 ? 'text-red-600 font-bold' : ''}>
                          {lga.avg_indig_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{(lga.total_students || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      {/* ━━━━ ALMA Interventions ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">What Works: Evidence from ALMA</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          From the Australian Living Map of Alternatives — {report.almaCount} youth justice interventions with documented evidence.
          Sorted by portfolio score (effectiveness × cultural authority × evidence quality).
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

      {/* ━━━━ Provider Contracts ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Youth Justice Contracts & Grants</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Who gets paid to run youth justice? Top contracts and grants from AusTender and state budgets.
        </p>
        <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">From</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">To</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Amount</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Year</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Type</th>
              </tr>
            </thead>
            <tbody>
              {report.providerContracts.slice(0, 15).map((c, i) => (
                <tr key={`${c.source}-${c.target}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-xs">{c.source}</td>
                  <td className="px-4 py-2 text-xs font-medium">{c.target}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm">{money(c.amount)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm">{c.year}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      c.relationship_type === 'contract' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {c.relationship_type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* ━━━━ Data Sources ━━━━ */}
      <section className="mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Data Sources</h3>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
            <li>Productivity Commission Report on Government Services (ROGS) — Youth Justice tables, 2015-16 to 2024-25</li>
            <li>ACARA My School — School profiles including ICSEA, Indigenous enrolment, and school type</li>
            <li>Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database</li>
            <li>AusTender — Federal procurement contracts with youth justice entities</li>
            <li>State budget papers — QLD, NSW, NT, SA, WA youth justice appropriations</li>
            <li>Department of Social Services — Payment demographics by postcode and state</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            This is a living report. All data is sourced from public datasets.
            Cross-system geographic linkage is performed by CivicGraph.
          </p>
        </div>
      </section>
    </div>
  );
}
