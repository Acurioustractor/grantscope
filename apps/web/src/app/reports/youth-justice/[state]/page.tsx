import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getFundingByProgram,
  getProgramsWithPartners,
  getTopOrgs,
  getAlmaInterventions,
  getAlmaCount,
  getFundingByLga,
  getAccoFundingGap,
  getFundingByRemoteness,
  getEvidenceCoverage,
  getEvidenceGapDetail,
  getHansardMentions,
  getYjLobbyingConnections,
  getYjRevolvingDoor,
  getStateDataDepth,
  getOutcomesMetrics,
  getStateComparisonMetrics,
  getRogsExpenditure,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Queensland accounts for the majority of Australia\'s youth justice funding data. This report maps who gets funded, what evidence exists, where the gaps are, and who has political connections.' },
  nsw: { name: 'New South Wales', description: 'NSW youth justice funding, recipients, evidence coverage, and political connections.' },
  vic: { name: 'Victoria', description: 'Victorian youth justice funding, recipients, evidence coverage, and political connections.' },
  wa: { name: 'Western Australia', description: 'WA youth justice funding, recipients, evidence coverage, and political connections.' },
  sa: { name: 'South Australia', description: 'SA youth justice funding, recipients, evidence coverage, and political connections.' },
  nt: { name: 'Northern Territory', description: 'NT youth justice funding, recipients, evidence coverage, and political connections.' },
  tas: { name: 'Tasmania', description: 'Tasmanian youth justice funding, recipients, evidence coverage, and political connections.' },
  act: { name: 'Australian Capital Territory', description: 'ACT youth justice funding, recipients, evidence coverage, and political connections.' },
};

export function generateStaticParams() {
  return Object.keys(STATE_META).map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  // Note: can't await in generateMetadata synchronously, but Next.js handles it
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} Youth Justice — CivicGraph` };
  });
}

type ProgramRow = { program_name: string; grants: number; total: number; orgs: number };
type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null };
type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
type AccoGap = { org_type: string; orgs: number; total_funding: number; avg_grant: number };
type RemotenessRow = { remoteness: string; orgs: number; total: number; grants: number };
type CoverageRow = { total_interventions: number; with_evidence: number; without_evidence: number; coverage_pct: number };
type GapRow = { name: string; type: string | null; evidence_level: string | null; has_evidence: boolean; evidence_type: string | null; methodology: string | null };
type HansardRow = { speaker_name: string; speaker_party: string | null; speaker_electorate: string | null; sitting_date: string; subject: string | null; excerpt: string };
type LobbyRow = { canonical_name: string; gs_id: string | null; lobbyist_name: string | null; client_name: string | null; relationship_type: string };
type RevolvingDoorRow = {
  canonical_name: string; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};
type PartnerRow = { program_name: string; recipient_name: string; recipient_abn: string | null; total: number | null; grants: number; gs_id: string | null; is_community_controlled: boolean | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type RogsRow = { program_name: string; total: number; years: number };

async function getStateReport(stateCode: string) {
  const [
    programs,
    topOrgs,
    programPartners,
    almaInterventions,
    almaCount,
    lgaFunding,
    accoGap,
    remoteness,
    evidenceCoverage,
    evidenceGaps,
    hansard,
    lobbying,
    revolvingDoor,
    dataDepth,
    outcomes,
    comparison,
    rogsExpenditure,
  ] = await Promise.all([
    getFundingByProgram('youth-justice', stateCode),
    getTopOrgs('youth-justice', 50, stateCode),
    getProgramsWithPartners('youth-justice', stateCode),
    getAlmaInterventions('youth-justice', 25, stateCode),
    getAlmaCount('youth-justice', stateCode),
    getFundingByLga('youth-justice', 20, stateCode),
    getAccoFundingGap('youth-justice', stateCode),
    getFundingByRemoteness('youth-justice', stateCode),
    getEvidenceCoverage('youth-justice', stateCode),
    getEvidenceGapDetail('youth-justice', stateCode),
    getHansardMentions(stateCode, 20),
    getYjLobbyingConnections('youth-justice', stateCode),
    getYjRevolvingDoor('youth-justice', 10, stateCode),
    getStateDataDepth(stateCode),
    getOutcomesMetrics(stateCode),
    getStateComparisonMetrics([
      'detention_rate_per_10k', 'avg_daily_detention', 'indigenous_overrepresentation_ratio',
      'pct_unsentenced', 'detention_5yr_trend_pct', 'cost_per_day_detention',
    ]),
    getRogsExpenditure(stateCode),
  ]);

  const programRows = (programs as ProgramRow[] | null) || [];
  const totalFunding = programRows.reduce((s, p) => s + Number(p.total), 0);
  const totalOrgs = new Set(
    ((topOrgs as OrgRow[] | null) || []).map(o => o.recipient_name)
  ).size;

  const coverage = ((evidenceCoverage as CoverageRow[] | null) || [])[0] || null;

  // Group partners by program
  const partnersByProgram: Record<string, PartnerRow[]> = {};
  for (const p of ((programPartners as PartnerRow[] | null) || [])) {
    if (!partnersByProgram[p.program_name]) partnersByProgram[p.program_name] = [];
    partnersByProgram[p.program_name].push(p);
  }

  return {
    programs: programRows,
    topOrgs: (topOrgs as OrgRow[] | null) || [],
    partnersByProgram,
    almaInterventions: (almaInterventions as AlmaRow[] | null) || [],
    almaCount,
    lgaFunding: (lgaFunding as LgaRow[] | null) || [],
    accoGap: (accoGap as AccoGap[] | null) || [],
    remoteness: (remoteness as RemotenessRow[] | null) || [],
    coverage,
    evidenceGaps: (evidenceGaps as GapRow[] | null) || [],
    hansard: (hansard as HansardRow[] | null) || [],
    lobbying: (lobbying as LobbyRow[] | null) || [],
    revolvingDoor: (revolvingDoor as RevolvingDoorRow[] | null) || [],
    depth: ((dataDepth as Array<{ total_records: number; sources: number; programs: number; recipients: number; earliest_year: string; latest_year: string }> | null) || [])[0] || null,
    outcomes: (outcomes as MetricRow[] | null) || [],
    comparison: (comparison as ComparisonRow[] | null) || [],
    rogsExpenditure: (rogsExpenditure as RogsRow[] | null) || [],
    totalFunding,
    totalOrgs,
  };
}

export default async function StateYouthJusticePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const stateKey = state.toLowerCase();
  const meta = STATE_META[stateKey];
  if (!meta) notFound();

  const stateCode = stateKey.toUpperCase();
  const report = await getStateReport(stateCode);
  const cc = report.accoGap.find(r => r.org_type === 'Community Controlled');
  const nonCc = report.accoGap.find(r => r.org_type === 'Non-Indigenous');

  // Metric helpers
  const om = report.outcomes;
  const m = (name: string, cohort?: string): number | null => {
    const c = cohort ?? 'all';
    const row = om.find(r => r.metric_name === name && r.cohort === c);
    if (!row && !cohort) {
      const alt = om.find(r => r.metric_name === name && r.cohort === 'indigenous');
      return alt?.metric_value ?? null;
    }
    return row?.metric_value ?? null;
  };

  // Comparison lookup — prefer 'all' cohort
  const comp: Record<string, Record<string, number>> = {};
  for (const row of report.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  // ROGS total expenditure (10-year sum)
  const rogsTotal = report.rogsExpenditure.reduce((s, r) => s + Number(r.total), 0);
  const rogsDet = report.rogsExpenditure.find(r => r.program_name.includes('Detention'));
  const rogsCom = report.rogsExpenditure.find(r => r.program_name.includes('Community'));
  const rogsConf = report.rogsExpenditure.find(r => r.program_name.includes('conferencing'));
  const detPct = rogsTotal ? Math.round((Number(rogsDet?.total || 0) / rogsTotal) * 100) : 0;
  const comPct = rogsTotal ? Math.round((Number(rogsCom?.total || 0) / rogsTotal) * 100) : 0;

  // Use ROGS total if per-program funding is empty
  const headlineFunding = report.totalFunding || rogsTotal;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Youth Justice
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">State Deep Dive</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">{stateCode}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Youth Justice
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>
        <div className="flex gap-2 mt-4">
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">Justice Funding</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">ALMA</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">Hansard</span>
          {stateKey === 'qld' && (
            <Link href="/reports/youth-justice/qld/tracker" className="text-[10px] font-bold bg-bauhaus-red text-white px-2 py-1 rounded uppercase tracking-wider hover:bg-red-700 transition-colors">
              Accountability Tracker
            </Link>
          )}
        </div>
      </div>

      {/* Data Coverage Banner */}
      {report.depth && report.depth.total_records < 1000 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
          <div>
            <div className="text-sm font-bold text-amber-800">Limited data coverage</div>
            <p className="text-xs text-amber-700 mt-0.5">
              {stateCode} has {fmt(report.depth.total_records)} justice funding records across {report.depth.sources} sources
              ({report.depth.earliest_year}&ndash;{report.depth.latest_year}).
              Sections below may appear sparse. More data sources are being added.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(headlineFunding)}</div>
          <div className="text-xs text-gray-500 mt-1">{stateCode} Youth Justice {rogsTotal && !report.totalFunding ? '(ROGS 10yr)' : 'Funding'}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{m('avg_daily_detention')?.toLocaleString() ?? fmt(report.totalOrgs)}</div>
          <div className="text-xs text-gray-500 mt-1">{m('avg_daily_detention') ? 'Avg Daily Detention' : 'Funded Organisations'}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{m('indigenous_overrepresentation_ratio') ? `${m('indigenous_overrepresentation_ratio')}x` : report.almaCount}</div>
          <div className="text-xs text-gray-500 mt-1">{m('indigenous_overrepresentation_ratio') ? 'First Nations Overrepresentation' : 'ALMA Interventions'}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{report.coverage?.coverage_pct ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">Evidence Coverage</div>
        </div>
      </div>

      {/* Key Outcomes — from outcomes_metrics DB */}
      {om.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            Key Outcomes
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">AIHW Youth Justice 2023-24 &amp; ROGS 2026 data.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {m('detention_rate_per_10k') !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-gray-800">{m('detention_rate_per_10k')}</div>
                <div className="text-[10px] text-gray-500">Detention rate per 10K</div>
              </div>
            )}
            {m('avg_daily_detention') !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-gray-800">{m('avg_daily_detention')?.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500">Avg daily detention</div>
              </div>
            )}
            {m('pct_first_nations_detention') !== null && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-red-600">{m('pct_first_nations_detention')}%</div>
                <div className="text-[10px] text-gray-500">First Nations in detention</div>
              </div>
            )}
            {m('pct_unsentenced') !== null && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-amber-600">{m('pct_unsentenced')}%</div>
                <div className="text-[10px] text-gray-500">Unsentenced (remand)</div>
              </div>
            )}
          </div>

          {/* State comparison table */}
          {Object.keys(comp).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                    {['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'].map(j => (
                      <th key={j} className={`text-right py-2 font-black uppercase tracking-wider text-xs ${j === stateCode ? 'text-red-600' : ''}`}>{j}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Detention rate (per 10K)', metric: 'detention_rate_per_10k', highlight: true },
                    { label: 'Avg daily detention', metric: 'avg_daily_detention', highlight: false },
                    { label: 'Indigenous overrepresentation', metric: 'indigenous_overrepresentation_ratio', suffix: 'x' },
                    { label: '% unsentenced (remand)', metric: 'pct_unsentenced', suffix: '%' },
                    { label: 'Cost per day (detention)', metric: 'cost_per_day_detention', prefix: '$' },
                    { label: '5-year trend', metric: 'detention_5yr_trend_pct', suffix: '%', signed: true },
                  ].map((row) => {
                    const jurisdictions = ['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'];
                    const vals = jurisdictions.map(j => cv(row.metric, j));
                    if (vals.every(v => v === null)) return null;
                    return (
                      <tr key={row.metric} className={`border-b border-gray-200 ${row.highlight ? 'bg-red-50' : ''}`}>
                        <td className="py-2 font-medium">{row.label}</td>
                        {jurisdictions.map((j, ji) => {
                          const v = vals[ji];
                          const isThis = j === stateCode;
                          let cls = 'py-2 text-right';
                          if (isThis) cls += ' font-black text-red-600';
                          else if (j === 'National') cls += ' font-bold';
                          const display = v !== null
                            ? `${row.signed && v > 0 ? '+' : ''}${row.prefix || ''}${row.metric === 'cost_per_day_detention' ? v.toLocaleString() : v}${row.suffix || ''}`
                            : '—';
                          return <td key={j} className={cls}>{display}</td>;
                        })}
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
              <div className="text-[10px] text-gray-400 italic mt-2">
                Sources: AIHW Youth Justice in Australia 2023-24, ROGS 2026 Table 17A.
              </div>
            </div>
          )}
        </section>
      )}

      {/* ROGS Expenditure Breakdown */}
      {rogsTotal > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            Where the Money Goes (ROGS)
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Productivity Commission ROGS 2026 — 10-year expenditure breakdown.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {rogsDet && (
              <div className={`border-2 rounded-xl p-5 text-center ${detPct > 60 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-2xl font-black text-gray-800">{detPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Detention-based</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsDet.total)}</div>
              </div>
            )}
            {rogsCom && (
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-5 text-center">
                <div className="text-2xl font-black text-emerald-700">{comPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Community-based</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsCom.total)}</div>
              </div>
            )}
            {rogsConf && (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-5 text-center">
                <div className="text-2xl font-black text-blue-700">{100 - detPct - comPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Group conferencing</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsConf.total)}</div>
              </div>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
            <div className="bg-red-400 h-4" style={{ width: `${detPct}%` }} />
            <div className="bg-emerald-400 h-4" style={{ width: `${comPct}%` }} />
            <div className="bg-blue-400 h-4" style={{ width: `${100 - detPct - comPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>Detention</span>
            <span>Community</span>
            <span>Conferencing</span>
          </div>
        </section>
      )}

      {/* Funding by Program */}
      {report.programs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by Program
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Program / Delivery Partner</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                </tr>
              </thead>
              <tbody>
                {report.programs.map((p, i) => {
                  const partners = report.partnersByProgram[p.program_name] || [];
                  const shown = partners.slice(0, 10);
                  const remaining = partners.length - shown.length;
                  return (
                    <Fragment key={i}>
                      <tr className="border-b border-gray-200 bg-gray-50/80">
                        <td className="py-2 font-bold">{p.program_name}</td>
                        <td className="py-2 text-right text-gray-600">{fmt(p.grants)}</td>
                        <td className="py-2 text-right font-black">{money(p.total)}</td>
                        <td className="py-2 text-right text-gray-600">{p.orgs}</td>
                      </tr>
                      {shown.map((pt, j) => (
                        <tr key={`${i}-${j}`} className="border-b border-gray-100 hover:bg-blue-50/50">
                          <td className="py-1.5 pl-6">
                            <span className="text-gray-400 mr-1.5">&rarr;</span>
                            {pt.gs_id ? (
                              <Link href={`/entity/${pt.gs_id}`} className="text-bauhaus-blue hover:underline">
                                {pt.recipient_name}
                              </Link>
                            ) : (
                              <span className="text-gray-700">{pt.recipient_name}</span>
                            )}
                            {pt.is_community_controlled && (
                              <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right text-gray-500">{fmt(pt.grants)}</td>
                          <td className="py-1.5 text-right">{money(pt.total)}</td>
                          <td />
                        </tr>
                      ))}
                      {remaining > 0 && (
                        <tr className="border-b border-gray-200">
                          <td className="py-1.5 pl-6 text-xs text-gray-400 italic" colSpan={4}>
                            + {remaining} more delivery partners (see Top Funded Organisations below)
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Top Funded Organisations */}
      {report.topOrgs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Top Funded Organisations
          </h2>
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
                {report.topOrgs.map((o, i) => (
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
        </section>
      )}

      {/* ALMA Interventions */}
      {report.almaInterventions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            ALMA Interventions ({report.almaCount})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.almaInterventions.map((a, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-bauhaus-blue transition-colors">
                <div className="font-bold text-sm mb-1">{a.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {a.type && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{a.type}</span>
                  )}
                  {a.evidence_level && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">{a.evidence_level}</span>
                  )}
                  {a.geography && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{a.geography}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evidence Coverage */}
      {report.coverage && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Evidence Coverage
          </h2>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-bold">{report.coverage.with_evidence} of {report.coverage.total_interventions} interventions have formal evidence</span>
              <span className="text-sm font-black text-emerald-600">{report.coverage.coverage_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-emerald-500 rounded-full h-3 transition-all"
                style={{ width: `${report.coverage.coverage_pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{report.coverage.with_evidence} with evidence</span>
              <span>{report.coverage.without_evidence} without evidence</span>
            </div>
          </div>

          {report.evidenceGaps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Intervention</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Type</th>
                    <th className="text-center py-2 font-black uppercase tracking-wider text-xs">Evidence</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {report.evidenceGaps.map((g, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-medium">{g.name}</td>
                      <td className="py-2 text-gray-600">{g.type || '—'}</td>
                      <td className="py-2 text-center">
                        {g.has_evidence ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">Yes</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase">Gap</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-600 text-xs">{g.methodology || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* LGA Funding */}
      {report.lgaFunding.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by LGA
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total Funding</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">SEIFA Decile</th>
                </tr>
              </thead>
              <tbody>
                {report.lgaFunding.map((l, i) => (
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

      {/* ACCO Funding Gap */}
      {report.accoGap.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Community-Controlled Funding Gap
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cc && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Community Controlled</div>
                <div className="text-2xl font-black">{money(cc.total_funding)}</div>
                <div className="text-sm text-gray-600">{cc.orgs} orgs, avg grant {money(cc.avg_grant)}</div>
              </div>
            )}
            {nonCc && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="text-xs font-black text-gray-600 uppercase tracking-wider mb-2">Non-Indigenous</div>
                <div className="text-2xl font-black">{money(nonCc.total_funding)}</div>
                <div className="text-sm text-gray-600">{nonCc.orgs} orgs, avg grant {money(nonCc.avg_grant)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Funding by Remoteness */}
      {report.remoteness.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by Remoteness
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Remoteness</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                </tr>
              </thead>
              <tbody>
                {report.remoteness.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.remoteness}</td>
                    <td className="py-2 text-right text-gray-600">{r.orgs}</td>
                    <td className="py-2 text-right font-bold">{money(r.total)}</td>
                    <td className="py-2 text-right text-gray-600">{fmt(r.grants)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Revolving Door */}
      {report.revolvingDoor.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Revolving Door
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">{stateCode} youth justice organisations with multiple influence vectors (donations, contracts, lobbying, funding).</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Score</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Vectors</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Donated</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Contracts</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Funded</th>
                </tr>
              </thead>
              <tbody>
                {report.revolvingDoor.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">
                      {r.canonical_name}
                      {r.is_community_controlled && (
                        <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold">{r.revolving_door_score}</td>
                    <td className="py-2 text-right">{r.influence_vectors}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_donated)}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_contracts)}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_funded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Political Connections */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Political Connections
        </h2>

        {report.hansard.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">{stateCode} Hansard Mentions</h3>
            <div className="space-y-3">
              {report.hansard.map((h, i) => (
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

        {report.lobbying.length > 0 && (
          <div>
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
                  {report.lobbying.map((l, i) => (
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

        {report.hansard.length === 0 && report.lobbying.length === 0 && (
          <p className="text-sm text-gray-500 italic">No political connection data available for {stateCode} youth justice organisations.</p>
        )}
      </section>

      {/* Graph Link */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Explore {meta.name} Youth Justice funding flows</div>
            <p className="text-sm text-gray-400 mt-1">Interactive force-directed graph showing programs, recipients, and evidence links</p>
          </div>
          <Link
            href={`/graph?preset=${encodeURIComponent(stateCode + ' Youth Justice')}`}
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>
    </div>
  );
}
