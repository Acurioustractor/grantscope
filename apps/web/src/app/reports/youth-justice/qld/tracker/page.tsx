import Link from 'next/link';
import {
  getBudgetCommitments,
  getBudgetTotals,
  getTopOrgs,
  getTrackerLeadership,
  getTrackerInterlocks,
  getTrackerDonations,
  getFundingByLga,
  getEvidenceCoverage,
  getAlmaInterventions,
  getAlmaCount,
  getHansardMentions,
  getYjLobbyingConnections,
  getYjRevolvingDoor,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'QLD Youth Justice Accountability Tracker — CivicGraph',
    description: 'Track Queensland youth justice budget commitments, recipients, leadership, evidence, and political context.',
  };
}

type BudgetRow = { program_name: string; amount: number | null; financial_year: string; source: string };
type BudgetTotal = { program_name: string; amount: number; financial_year: string };
type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
type LeaderRow = { recipient_name: string; recipient_abn: string | null; gs_id: string | null; is_community_controlled: boolean | null; total_funded: number; directors: string };
type InterlockRow = { person_name: string; board_count: number; organisations: string };
type DonationRow = { donor_name: string; donation_to: string; total: number; records: number; from_fy: string; to_fy: string };
type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
type CoverageRow = { total_interventions: number; with_evidence: number; without_evidence: number; coverage_pct: number };
type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null };
type HansardRow = { speaker_name: string; speaker_party: string | null; speaker_electorate: string | null; sitting_date: string; subject: string | null; excerpt: string };
type LobbyRow = { canonical_name: string; gs_id: string | null; lobbyist_name: string | null; client_name: string | null; relationship_type: string };
type RevolvingDoorRow = {
  canonical_name: string; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};

async function getTrackerData() {
  const [
    budgetCommitments,
    budgetTotals,
    topOrgs,
    leadership,
    interlocks,
    donations,
    lgaFunding,
    evidenceCoverage,
    almaInterventions,
    almaCount,
    hansard,
    lobbying,
    revolvingDoor,
  ] = await Promise.all([
    getBudgetCommitments('QLD'),
    getBudgetTotals('QLD'),
    getTopOrgs('youth-justice', 25, 'QLD'),
    getTrackerLeadership('QLD', 'youth-justice', 20),
    getTrackerInterlocks('QLD', 'youth-justice', 15),
    getTrackerDonations('QLD', 'youth-justice', 15),
    getFundingByLga('youth-justice', 20, 'QLD'),
    getEvidenceCoverage('youth-justice', 'QLD'),
    getAlmaInterventions('youth-justice', 15, 'QLD'),
    getAlmaCount('youth-justice', 'QLD'),
    getHansardMentions('QLD', 15),
    getYjLobbyingConnections('youth-justice', 'QLD'),
    getYjRevolvingDoor('youth-justice', 10, 'QLD'),
  ]);

  return {
    budgetCommitments: (budgetCommitments as BudgetRow[] | null) || [],
    budgetTotals: (budgetTotals as BudgetTotal[] | null) || [],
    topOrgs: (topOrgs as OrgRow[] | null) || [],
    leadership: (leadership as LeaderRow[] | null) || [],
    interlocks: (interlocks as InterlockRow[] | null) || [],
    donations: (donations as DonationRow[] | null) || [],
    lgaFunding: (lgaFunding as LgaRow[] | null) || [],
    coverage: ((evidenceCoverage as CoverageRow[] | null) || [])[0] || null,
    almaInterventions: (almaInterventions as AlmaRow[] | null) || [],
    almaCount,
    hansard: (hansard as HansardRow[] | null) || [],
    lobbying: (lobbying as LobbyRow[] | null) || [],
    revolvingDoor: (revolvingDoor as RevolvingDoorRow[] | null) || [],
  };
}

function parseDirectors(json: string): Array<{ name: string; role: string }> {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function parseOrgs(json: string): Array<{ canonical_name: string; abn: string }> {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default async function QldTrackerPage() {
  const data = await getTrackerData();

  const latestTotal = data.budgetTotals[0];
  const programItems = data.budgetCommitments.filter(b => b.amount);
  const totalOrgs = new Set(data.topOrgs.map(o => o.recipient_name)).size;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/youth-justice/qld" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; QLD Youth Justice
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Accountability Tracker</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">QLD</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          QLD Youth Justice Tracker
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          What did the QLD government promise, who got the money, who runs those organisations,
          what&rsquo;s their track record, and what&rsquo;s the political context?
        </p>
      </div>

      {/* Headline Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{latestTotal ? money(latestTotal.amount) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{latestTotal?.financial_year} Budget</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{fmt(programItems.length)}</div>
          <div className="text-xs text-gray-500 mt-1">Named Programs</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{fmt(totalOrgs)}</div>
          <div className="text-xs text-gray-500 mt-1">Funded Organisations</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{data.coverage?.coverage_pct ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">Evidence Coverage</div>
        </div>
      </div>

      {/* Section 0: Outcomes Reality Check */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          The Numbers That Matter
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Source: <a href="https://www.qfcc.qld.gov.au/kids-in-queensland/queensland-child-rights-report" className="text-bauhaus-blue underline" target="_blank" rel="noopener">Queensland Child Rights Report 2025</a> (OATSICC &amp; QFCC) — 2023-24 data.
        </p>

        {/* Key Outcome Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-red-600">292</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">Avg daily detention</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-red-600">71.9%</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">First Nations in detention</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-red-600">26.4x</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">Indigenous detention rate ratio</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-red-600">97%</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">Reoffend within 6 months</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-amber-600">71%</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">Have a disability</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-xl sm:text-2xl font-black text-amber-600">85%</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">Unsentenced (remand)</div>
          </div>
        </div>

        {/* Cost Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="border-2 border-red-300 rounded-xl p-5">
            <div className="text-xs font-black text-red-500 uppercase tracking-wider mb-1">Detention</div>
            <div className="text-3xl font-black text-red-600">$2,162<span className="text-sm font-bold text-gray-400">/day</span></div>
            <div className="text-xs text-gray-500 mt-1">$789,130 per child per year</div>
          </div>
          <div className="border-2 border-emerald-300 rounded-xl p-5">
            <div className="text-xs font-black text-emerald-500 uppercase tracking-wider mb-1">Community Supervision</div>
            <div className="text-3xl font-black text-emerald-600">$382<span className="text-sm font-bold text-gray-400">/day</span></div>
            <div className="text-xs text-gray-500 mt-1">5.7x cheaper — and better outcomes</div>
          </div>
        </div>

        {/* Watch-house Crisis */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Watch-house Crisis</h3>
          <p className="text-xs text-gray-500 mb-3">Children held in adult police watch-houses, 2023-24. These are not youth facilities.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-black text-gray-800">7,807</div>
              <div className="text-[10px] text-gray-500">Total stays</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-600">59.2%</div>
              <div className="text-[10px] text-gray-500">First Nations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-amber-600">440</div>
              <div className="text-[10px] text-gray-500">Held 8-14 days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-600">248</div>
              <div className="text-[10px] text-gray-500">Held 15+ days</div>
            </div>
          </div>
        </div>

        {/* Socioeconomic Profile */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Who&rsquo;s in Detention?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-gray-600 mb-2">By Socioeconomic Quintile</h4>
              {[
                { label: 'Most disadvantaged (Q1)', count: 141, pct: 48 },
                { label: 'Q2', count: 66, pct: 23 },
                { label: 'Q3', count: 42, pct: 14 },
                { label: 'Q4', count: 24, pct: 8 },
                { label: 'Least disadvantaged (Q5)', count: 10, pct: 3 },
              ].map((q, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-gray-600 w-40 shrink-0">{q.label}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div className="bg-red-400 rounded-full h-2.5" style={{ width: `${q.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 w-8 text-right">{q.count}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-600 mb-2">Key Facts</h4>
              <ul className="space-y-1.5 text-xs text-gray-700">
                <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>Avg 48 days on remand before resolution</li>
                <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>2,433 use-of-force incidents (63.4% on First Nations children)</li>
                <li className="flex gap-2"><span className="font-black text-red-500 shrink-0">&bull;</span>50 self-harm incidents in detention</li>
                <li className="flex gap-2"><span className="font-black text-amber-500 shrink-0">&bull;</span>On Country programs: only $2.8M/year (declining)</li>
                <li className="flex gap-2"><span className="font-black text-amber-500 shrink-0">&bull;</span>Closing the Gap Target 11: <span className="font-bold text-red-600">Worsening</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Policy Timeline */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Policy Timeline</h3>
          <div className="space-y-3">
            {[
              { date: 'Mar 2024', title: 'Making Queensland Safer Act 2024', desc: 'Abolished "detention as last resort" principle. Enabled adult sentences for children. Excluded restorative justice for 33 offence categories. 4th Human Rights Act override.', severity: 'critical' as const },
              { date: 'Nov 2025', title: 'Justice Reinvestment Framework', desc: '$5M competitive grants program for place-based justice reinvestment. First framework of its kind in QLD.', severity: 'positive' as const },
              { date: 'Mar 2025', title: 'Wacol Youth Remand Centre opens', desc: '76-bed facility built to adult correctional standards. Lacks dedicated youth-specific design features. Rapid expansion of detention capacity.', severity: 'warning' as const },
              { date: '2024-25', title: 'Government investment announcements', desc: '$225M Staying on Track, $115M Gold Standard Early Intervention, $80M Circuit Breaker, $50M Crime Prevention Schools, $40M Youth Justice Schools, $50M Regional Reset.', severity: 'info' as const },
            ].map((e, i) => (
              <div key={i} className="flex gap-3">
                <div className={`shrink-0 w-2 rounded-full ${
                  e.severity === 'critical' ? 'bg-red-500' :
                  e.severity === 'positive' ? 'bg-emerald-500' :
                  e.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{e.date}</span>
                    <span className="text-sm font-bold text-gray-800">{e.title}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-gray-400 italic">
            Source: QLD Child Rights Report 2025 (OATSICC &amp; QFCC). OATSICC notes: &ldquo;no evaluation frameworks, no equity analysis, and unclear whether new investment or redistribution of existing funds.&rdquo;
          </div>
        </div>
      </section>

      {/* Section: How QLD Compares */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          How QLD Compares
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Queensland vs other states — AIHW Youth Justice 2023-24 &amp; ROGS 2026.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">QLD</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">NSW</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">VIC</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">WA</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">NT</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">National</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 bg-red-50">
                <td className="py-2 font-medium">Detention rate (per 10K)</td>
                <td className="py-2 text-right font-black text-red-600">5.1</td>
                <td className="py-2 text-right">3.6</td>
                <td className="py-2 text-right text-emerald-600 font-bold">1.4</td>
                <td className="py-2 text-right">4.2</td>
                <td className="py-2 text-right text-red-600 font-bold">17.0</td>
                <td className="py-2 text-right font-bold">3.4</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 font-medium">Avg daily detention count</td>
                <td className="py-2 text-right font-black text-red-600">317</td>
                <td className="py-2 text-right">200</td>
                <td className="py-2 text-right">120</td>
                <td className="py-2 text-right">145</td>
                <td className="py-2 text-right">62</td>
                <td className="py-2 text-right font-bold">950</td>
              </tr>
              <tr className="border-b border-gray-200 bg-red-50">
                <td className="py-2 font-medium">Indigenous overrepresentation</td>
                <td className="py-2 text-right font-black text-red-600">26x</td>
                <td className="py-2 text-right">22x</td>
                <td className="py-2 text-right text-emerald-600 font-bold">14x</td>
                <td className="py-2 text-right">24x</td>
                <td className="py-2 text-right">5x</td>
                <td className="py-2 text-right font-bold">17x</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 font-medium">First Nations detention rate (per 10K)</td>
                <td className="py-2 text-right font-black text-red-600">42</td>
                <td className="py-2 text-right">32</td>
                <td className="py-2 text-right">18</td>
                <td className="py-2 text-right">38</td>
                <td className="py-2 text-right text-red-600 font-bold">25</td>
                <td className="py-2 text-right font-bold">26.1</td>
              </tr>
              <tr className="border-b border-gray-200 bg-red-50">
                <td className="py-2 font-medium">Avg days in detention</td>
                <td className="py-2 text-right font-black text-red-600">104</td>
                <td className="py-2 text-right">55</td>
                <td className="py-2 text-right text-emerald-600 font-bold">37</td>
                <td className="py-2 text-right">68</td>
                <td className="py-2 text-right">45</td>
                <td className="py-2 text-right font-bold">62</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 font-medium">Cost per day (detention)</td>
                <td className="py-2 text-right font-bold">$2,162</td>
                <td className="py-2 text-right">$3,200</td>
                <td className="py-2 text-right">$7,123</td>
                <td className="py-2 text-right">$2,573</td>
                <td className="py-2 text-right">$4,800</td>
                <td className="py-2 text-right font-bold">$3,635</td>
              </tr>
              <tr className="border-b border-gray-200 bg-red-50">
                <td className="py-2 font-medium">% unsentenced (remand)</td>
                <td className="py-2 text-right font-black text-red-600">86%</td>
                <td className="py-2 text-right">72%</td>
                <td className="py-2 text-right">65%</td>
                <td className="py-2 text-right">78%</td>
                <td className="py-2 text-right">80%</td>
                <td className="py-2 text-right font-bold">75%</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 font-medium">5-year trend (detention count)</td>
                <td className="py-2 text-right font-black text-red-600">+53%</td>
                <td className="py-2 text-right text-red-600">+86% (Indig.)</td>
                <td className="py-2 text-right text-red-600">+37%</td>
                <td className="py-2 text-right text-amber-600">Declining</td>
                <td className="py-2 text-right text-amber-600">Stable</td>
                <td className="py-2 text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-gray-400 italic">
          QLD has the highest absolute detention numbers in Australia (317), 2nd-highest rate (5.1 per 10K), highest Indigenous rate (42 per 10K), and longest average stays (104 days). Sources: AIHW Youth Justice in Australia 2023-24, ROGS 2026 Table 17A.
        </div>
      </section>

      {/* Section: Court Pipeline */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          Court Pipeline
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          What happens in QLD Childrens Court — <a href="https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5824t0283/5824t283.pdf" className="text-bauhaus-blue underline" target="_blank" rel="noopener">Annual Report 2023-24</a>.
        </p>

        {/* Court Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-gray-800">7,317</div>
            <div className="text-[10px] text-gray-500 mt-1">Finalised appearances</div>
            <div className="text-[10px] text-emerald-600 font-bold">+6.3%</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-gray-800">49,612</div>
            <div className="text-[10px] text-gray-500 mt-1">Finalised charges</div>
            <div className="text-[10px] text-red-600 font-bold">+15.3%</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-600">55.4%</div>
            <div className="text-[10px] text-gray-500 mt-1">Defendants are First Nations</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-600">6,697</div>
            <div className="text-[10px] text-gray-500 mt-1">Breach of bail convictions</div>
            <div className="text-[10px] text-red-600 font-bold">+614% from 938</div>
          </div>
        </div>

        {/* Sentencing Outcomes */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">Sentencing Outcomes</h3>
          <div className="space-y-2">
            {[
              { label: 'Reprimand / minor', pct: 33.9, count: '1,672', color: 'bg-emerald-400' },
              { label: 'Probation', pct: 30.6, count: '1,511', color: 'bg-blue-400' },
              { label: 'Community service', pct: 8.0, count: '397', color: 'bg-sky-400' },
              { label: 'Detention', pct: 7.8, count: '386', color: 'bg-red-500' },
              { label: 'Other', pct: 19.7, count: '1,351', color: 'bg-gray-300' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-36 shrink-0">{s.label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div className={`${s.color} rounded-full h-3`} style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-16 text-right">{s.pct}%</span>
                <span className="text-[10px] text-gray-400 w-12 text-right">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            92.2% receive non-custodial sentences. Yet 86% of those in detention are unsentenced — held on remand.
          </div>
        </div>

        {/* Diversion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Restorative Justice</h4>
            <div className="text-2xl font-black text-blue-600 mb-1">2,246</div>
            <div className="text-xs text-gray-500">Young people referred to RJ (+5%)</div>
            <div className="text-xs text-gray-500 mt-1">1,462 participated in conferences</div>
            <div className="text-xs text-gray-500">46% of participants are First Nations</div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Processing Time</h4>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Magistrates Court</span>
                <span className="font-bold">85 days avg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Childrens Court of QLD</span>
                <span className="font-bold text-amber-600">307 days avg</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          <span className="font-black">Key finding:</span> The 614% spike in breach-of-bail convictions (938 → 6,697) is driven by the
          Youth Justice and Other Legislation Amendment Act 2023, which created new bail breach offences. This single legislative change
          accounts for the entire increase in finalised charges. Children are being re-criminalised for administrative non-compliance.
        </div>
      </section>

      {/* Section: Closing the Gap Scorecard */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          Closing the Gap: Target 11
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Reduce rate of Aboriginal and Torres Strait Islander young people (10-17) in detention by 30% by 2031.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 text-center">
            <div className="text-xs font-black text-red-500 uppercase tracking-wider mb-1">QLD Status</div>
            <div className="text-2xl font-black text-red-600">WORSENING</div>
            <div className="text-xs text-gray-500 mt-1">42 per 10K (was 29 in 2020)</div>
          </div>
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 text-center">
            <div className="text-xs font-black text-amber-500 uppercase tracking-wider mb-1">National Status</div>
            <div className="text-2xl font-black text-amber-600">NO CHANGE</div>
            <div className="text-xs text-gray-500 mt-1">26.1 per 10K (baseline 31.9)</div>
          </div>
          <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-5 text-center">
            <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Target (2031)</div>
            <div className="text-2xl font-black text-gray-600">-30%</div>
            <div className="text-xs text-gray-500 mt-1">Need 22.3 per 10K nationally</div>
          </div>
        </div>

        {/* Trend */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider mb-3">QLD First Nations Detention Rate Trend</h3>
          <div className="space-y-2">
            {[
              { year: '2019-20', rate: 29, baseline: true },
              { year: '2020-21', rate: 24, note: 'COVID dip' },
              { year: '2021-22', rate: 32, note: '' },
              { year: '2022-23', rate: 38, note: '' },
              { year: '2023-24', rate: 42, note: 'Highest nationally' },
            ].map((y, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-16 shrink-0">{y.year}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div className={`rounded-full h-3 ${y.rate > 35 ? 'bg-red-500' : y.rate > 25 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${(y.rate / 50) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-8 text-right">{y.rate}</span>
                {y.note && <span className="text-[10px] text-gray-400 w-28">{y.note}</span>}
                {y.baseline && <span className="text-[10px] text-blue-500 w-28">Baseline</span>}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Rate per 10,000 First Nations young people aged 10-17 in detention on an average night. Source: AIHW, Productivity Commission Closing the Gap Dashboard.
          </div>
        </div>
      </section>

      {/* Section: Oversight & Accountability */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
          Oversight &amp; Accountability
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          What oversight bodies have found — and whether anyone listened.
        </p>

        {/* Human Rights Act Overrides */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-black text-red-600 uppercase tracking-wider mb-3">Human Rights Act Overrides</h3>
          <p className="text-xs text-gray-600 mb-3">The QLD Human Rights Act 2019 protects fundamental rights. The government can override it by declaring legislation incompatible. Youth justice has triggered more overrides than any other policy area — including COVID-19.</p>
          <div className="space-y-3">
            {[
              { date: 'Jun 2023', law: 'Youth Justice Amendment Act', desc: 'Bail breach offence — criminalised administrative non-compliance', duration: '5 years' },
              { date: 'Dec 2023', law: 'Youth Justice Amendment Act (No.2)', desc: 'Watch-house detention — authorised holding children in adult police facilities', duration: '5 years' },
              { date: 'Sep 2024', law: 'Making Queensland Safer Act', desc: 'Abolished "detention as last resort", adult sentences for children, excluded RJ for 33 offences', duration: '5 years (longest ever)' },
            ].map((o, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{o.date}</span>
                    <span className="text-xs font-bold text-gray-800">{o.law}</span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{o.duration}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{o.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-red-700 font-bold">
            Zero overrides were used during the COVID-19 pandemic. Youth justice is the only policy area where QLD has repeatedly overridden its own Human Rights Act.
          </div>
        </div>

        {/* Oversight Bodies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">QLD Ombudsman</h4>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>42-102 children in watch-houses daily (Jan-Apr 2024)</li>
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>Peak: 102 children on a single day (Feb 13, 2024)</li>
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>Youth detention centres at 99.6% capacity</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>No public compliance tracking for recommendations</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">QLD Audit Office</h4>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>&ldquo;Reducing Serious Youth Crime&rdquo; (Jun 2024)</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>12 recommendations issued</li>
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>&ldquo;Had not effectively implemented all recommendations&rdquo;</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>Cleveland YDC in lockdown 81% of time (294/365 days)</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Sentencing Advisory Council</h4>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">&bull;</span>74 recommendations for youth sentencing reform</li>
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>Government moved opposite direction: adult sentences for children</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>Same maximum penalties as adults for serious offences</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-wider mb-2">Human Rights Commissioner</h4>
            <ul className="space-y-1.5 text-xs text-gray-700">
              <li className="flex gap-2"><span className="text-red-500 font-bold shrink-0">&bull;</span>&ldquo;No justification for the override&rdquo; — QHRC on Making QLD Safer Act</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>Advisory power only — cannot block legislation</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">&bull;</span>Commissioner Natalie Lewis submitted detailed opposition</li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600">
          <span className="font-black text-gray-800">Accountability gap:</span> All four oversight bodies (Ombudsman, Audit Office, Sentencing Advisory Council, Human Rights Commissioner) have <span className="font-bold">advisory power only</span>. None can compel implementation of recommendations or block legislation. The government has received 100+ recommendations across these bodies and moved in the opposite direction on most.
        </div>
      </section>

      {/* Section 1: Budget Commitments */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          1. Budget Commitments
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Current-term programs from QLD Budget Service Delivery Statements.</p>

        {/* Budget totals */}
        {data.budgetTotals.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {data.budgetTotals.map((t, i) => (
              <div key={i} className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2">
                <span className="text-xs font-bold text-gray-500 uppercase">{t.financial_year}</span>
                <span className="ml-2 text-sm font-black">{money(t.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {programItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Program</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Amount</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">FY</th>
                </tr>
              </thead>
              <tbody>
                {programItems.map((b, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{b.program_name}</td>
                    <td className="py-2 text-right font-bold">{money(b.amount)}</td>
                    <td className="py-2 text-right text-gray-600">{b.financial_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Who Gets the Money */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          2. Who Gets the Money
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Top funded organisations across all QLD youth justice programs.</p>

        {data.topOrgs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topOrgs.map((o, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">
                      {o.gs_id ? (
                        <Link href={`/entity/${o.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">
                          {o.recipient_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{o.recipient_name}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-600">{fmt(o.grants)}</td>
                    <td className="py-2 text-right font-bold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3: Who Runs It */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          3. Who Runs It
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">Board and leadership for top funded QLD youth justice organisations.</p>

        {data.leadership.length > 0 && (
          <div className="space-y-4">
            {data.leadership.map((org, i) => {
              const directors = parseDirectors(org.directors);
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {org.gs_id ? (
                        <Link href={`/entity/${org.gs_id}`} className="font-bold text-bauhaus-blue hover:underline">
                          {org.recipient_name}
                        </Link>
                      ) : (
                        <span className="font-bold">{org.recipient_name}</span>
                      )}
                      {org.is_community_controlled && (
                        <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">ACCO</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-600">{money(org.total_funded)}</span>
                  </div>
                  {directors.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {directors.slice(0, 8).map((d, j) => (
                        <span key={j} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {d.name}{d.role ? ` (${d.role})` : ''}
                        </span>
                      ))}
                      {directors.length > 8 && (
                        <span className="text-[11px] text-gray-400">+{directors.length - 8} more</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No leadership data</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Board Interlocks */}
        {data.interlocks.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Board Interlocks</h3>
            <p className="text-xs text-gray-500 mb-3">People serving on boards of multiple QLD youth justice funded organisations.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Person</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Boards</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisations</th>
                  </tr>
                </thead>
                <tbody>
                  {data.interlocks.map((il, i) => {
                    const orgs = parseOrgs(il.organisations);
                    return (
                      <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 font-medium">{il.person_name}</td>
                        <td className="py-2 text-right font-bold">{il.board_count}</td>
                        <td className="py-2 text-gray-600 text-xs">
                          {orgs.length > 0
                            ? orgs.map(o => o.canonical_name).join(', ')
                            : il.organisations.substring(0, 200)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Where the Money Goes */}
      {data.lgaFunding.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            4. Where the Money Goes
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Funding by Local Government Area with SEIFA disadvantage overlay.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total Funding</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">SEIFA</th>
                </tr>
              </thead>
              <tbody>
                {data.lgaFunding.map((l, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{l.lga_name}</td>
                    <td className="py-2 text-right text-gray-600">{l.orgs}</td>
                    <td className="py-2 text-right font-bold">{money(l.total_funding)}</td>
                    <td className="py-2 text-right">
                      {l.seifa_decile != null ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          l.seifa_decile <= 3 ? 'bg-red-100 text-red-700' :
                          l.seifa_decile <= 6 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {l.seifa_decile}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 5: Evidence & Accountability */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          5. Evidence & Accountability
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Australian Living Map of Alternatives (ALMA) evidence for QLD youth justice programs.
        </p>

        {data.coverage && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-bold">{data.coverage.with_evidence} of {data.coverage.total_interventions} interventions have formal evidence</span>
              <span className="text-sm font-black text-emerald-600">{data.coverage.coverage_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-emerald-500 rounded-full h-3 transition-all"
                style={{ width: `${data.coverage.coverage_pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{data.coverage.with_evidence} with evidence</span>
              <span>{data.coverage.without_evidence} without evidence</span>
            </div>
          </div>
        )}

        {data.almaInterventions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.almaInterventions.map((a, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 hover:border-bauhaus-blue transition-colors">
                <div className="font-bold text-sm mb-1">{a.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {a.type && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{a.type}</span>
                  )}
                  {a.evidence_level && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">{a.evidence_level}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 6: Political Context */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          6. Political Context
        </h2>

        {/* Hansard */}
        {data.hansard.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">QLD Hansard Mentions</h3>
            <div className="space-y-3">
              {data.hansard.map((h, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{h.speaker_name}</span>
                    {h.speaker_party && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{h.speaker_party}</span>
                    )}
                    {h.speaker_electorate && (
                      <span className="text-[10px] text-gray-500">{h.speaker_electorate}</span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">{h.sitting_date}</span>
                  </div>
                  {h.subject && <div className="text-xs font-bold text-bauhaus-blue mb-1">{h.subject}</div>}
                  <div className="text-xs text-gray-600 leading-relaxed">{h.excerpt}...</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lobbying */}
        {data.lobbying.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Federal Lobbying Connections</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Entity</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Lobbyist</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lobbying.map((l, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2">
                        {l.gs_id ? (
                          <Link href={`/entity/${l.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">{l.canonical_name}</Link>
                        ) : (
                          <span className="font-medium">{l.canonical_name}</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-600">{l.lobbyist_name || '—'}</td>
                      <td className="py-2 text-gray-600">{l.client_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revolving Door */}
        {data.revolvingDoor.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Revolving Door</h3>
            <p className="text-xs text-gray-500 mb-3">Organisations with multiple influence vectors: donations, contracts, lobbying, funding.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Score</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Donated</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Contracts</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Funded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revolvingDoor.map((r, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-medium">
                        {r.canonical_name}
                        {r.is_community_controlled && (
                          <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-bold">{r.revolving_door_score}</td>
                      <td className="py-2 text-right text-gray-600">{money(r.total_donated)}</td>
                      <td className="py-2 text-right text-gray-600">{money(r.total_contracts)}</td>
                      <td className="py-2 text-right text-gray-600">{money(r.total_funded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Political Donations */}
        {data.donations.length > 0 && (
          <div>
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Political Donations by Funded Orgs</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Donor</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Recipient</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                    <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {data.donations.map((d, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-medium">{d.donor_name}</td>
                      <td className="py-2 text-gray-600">{d.donation_to}</td>
                      <td className="py-2 text-right font-bold">{money(d.total)}</td>
                      <td className="py-2 text-right text-gray-500 text-xs">{d.from_fy}&ndash;{d.to_fy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.hansard.length === 0 && data.lobbying.length === 0 && data.donations.length === 0 && (
          <p className="text-sm text-gray-500 italic">No political connection data available.</p>
        )}
      </section>

      {/* Graph Link */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Follow the Dollar: QLD Youth Justice</div>
            <p className="text-sm text-gray-400 mt-1">Trace funding flows from budget to recipients, contracts, and lobbying connections</p>
          </div>
          <Link
            href="/graph?preset=QLD%20Youth%20Justice"
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pb-8">
        Data sources: QLD Child Rights Report 2025 (OATSICC &amp; QFCC), AIHW Youth Justice 2023-24, ROGS 2026, QLD Childrens Court Annual Report 2023-24, Closing the Gap Dashboard, QLD Ombudsman, QLD Audit Office, QLD Budget SDS, QLD Historical Grants, QGIP, ACNC, AusTender, ALMA, QLD Hansard, Federal Lobbying Register, AEC Donations
      </div>
    </div>
  );
}
