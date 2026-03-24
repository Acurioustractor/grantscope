import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getFundingByProgram,
  getTopOrgs,
  getAlmaInterventions,
  getAlmaCount,
  getFundingByLga,
  getOutcomesMetrics,
  getPolicyTimeline,
  getOversightData,
  getCrossSystemOverlap,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Queensland\'s child protection system manages over 11,000 children in out-of-home care. This report maps where funding goes, which organisations deliver services, and how child protection intersects with youth justice and disability.' },
  nsw: { name: 'New South Wales', description: 'NSW has the largest child protection system in Australia with over 16,000 children in out-of-home care. Significant reform including the transition to permanency-focused models.' },
  vic: { name: 'Victoria', description: 'Victoria\'s child protection system serves over 11,000 children in care, with a focus on family preservation and kinship care models.' },
  wa: { name: 'Western Australia', description: 'WA has around 5,500 children in out-of-home care with significant overrepresentation of Aboriginal children. Reform focus on Earlier Intervention and Family Support.' },
  sa: { name: 'South Australia', description: 'South Australia manages around 4,500 children in out-of-home care. The state underwent major reform following the Nyland Royal Commission.' },
  nt: { name: 'Northern Territory', description: 'The NT has the highest rate of children in out-of-home care per capita. Aboriginal children represent over 85% of children in care.' },
  tas: { name: 'Tasmania', description: 'Tasmania manages around 1,300 children in out-of-home care. Commission of Inquiry into Government Responses to Child Sexual Abuse in Institutional Settings drove recent reform.' },
  act: { name: 'Australian Capital Territory', description: 'The ACT has the smallest child protection system with around 900 children in care. Focus on therapeutic care and permanency.' },
};

const STATES = Object.keys(STATE_META);

export function generateStaticParams() {
  return STATES.map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} Child Protection — CivicGraph` };
  });
}

type ProgramRow = { program_name: string; grants: number; total: number; orgs: number };
type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null; gs_id: string | null; org_name: string | null; org_abn: string | null };
type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };

const METRIC_LABELS: Record<string, string> = {
  rogs_cp_notifications: 'Child protection notifications',
  rogs_cp_notifications_indigenous: 'Indigenous notifications',
  rogs_cp_substantiations: 'Substantiations',
  rogs_cp_substantiations_indigenous: 'Indigenous substantiations',
  rogs_cp_substantiated_detailed: 'Substantiated (detailed)',
  rogs_cp_investigated: 'Notifications investigated',
  rogs_cp_oohc_on_orders: 'Children in OOHC (on orders)',
  rogs_cp_oohc_no_order: 'Children in OOHC (no order)',
  rogs_cp_kinship_households: 'Kinship care households',
  rogs_cp_foster_households: 'Foster carer households',
  rogs_cp_kinship_placement_pct: 'Children placed with kin (%)',
  rogs_cp_protective_expenditure: 'Protective intervention expenditure ($\'000)',
  rogs_cp_care_expenditure: 'Care services expenditure ($\'000)',
  rogs_cp_expenditure_per_child: 'Intensive family support expenditure',
  rogs_cp_substantiation_rate: 'Substantiation rate (%)',
  rogs_cp_resubstantiation_12m: 'Re-substantiation within 12 months (%)',
};

async function getStateReport(stateCode: string) {
  const sc = stateCode.toUpperCase();
  const [programs, topOrgs, almaInterventions, almaCount, lgaFunding, outcomes, policyNational, policyState, oversightNational, oversightState, crossSystemOrgs] = await Promise.all([
    getFundingByProgram('child-protection', stateCode),
    getTopOrgs('child-protection', 25, stateCode),
    getAlmaInterventions('child-protection', 25, stateCode),
    getAlmaCount('child-protection', stateCode),
    getFundingByLga('child-protection', 20, stateCode),
    getOutcomesMetrics(sc, 'child-protection'),
    getPolicyTimeline('National', 'child-protection'),
    getPolicyTimeline(sc, 'child-protection'),
    getOversightData('National', 'child-protection'),
    getOversightData(sc, 'child-protection'),
    getCrossSystemOverlap('child-protection', stateCode),
  ]);

  return {
    programs: (programs || []) as ProgramRow[],
    topOrgs: (topOrgs || []) as OrgRow[],
    alma: (almaInterventions || []) as AlmaRow[],
    almaCount: almaCount ?? 0,
    lgas: (lgaFunding || []) as LgaRow[],
    outcomes: (outcomes || []) as MetricRow[],
    policyTimeline: [...(policyState || []), ...(policyNational || [])].sort((a, b) => b.event_date.localeCompare(a.event_date)),
    oversight: [...(oversightState || []), ...(oversightNational || [])],
    crossSystem: (crossSystemOrgs || []) as Array<{ gs_id: string; canonical_name: string; entity_type: string | null; topics: string[]; topic_count: number; total_funding: number }>,
  };
}

export default async function ChildProtectionStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateParam } = await params;
  const stateCode = stateParam.toLowerCase();
  const meta = STATE_META[stateCode];
  if (!meta) notFound();

  const report = await getStateReport(stateCode);
  const totalFunding = report.programs.reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <Link href="/reports/child-protection" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Child Protection
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">State Deep Dive</span>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-black text-white">{stateCode.toUpperCase()}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Child Protection
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>

        {/* State nav pills */}
        <div className="mt-4 flex flex-wrap gap-1">
          {STATES.map(s => (
            <Link
              key={s}
              href={`/reports/child-protection/${s}`}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                s === stateCode
                  ? 'border-bauhaus-black bg-bauhaus-black text-white'
                  : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
              }`}
            >
              {s.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* Hero stats — use ROGS data for reliable cross-state metrics */}
      {(() => {
        const om = (name: string) => report.outcomes.find(r => r.metric_name === name)?.metric_value ?? null;
        const careExp = om('rogs_cp_care_expenditure');
        const notifications = om('rogs_cp_notifications');
        const oohc = om('rogs_cp_oohc_on_orders');
        const substRate = om('rogs_cp_substantiation_rate');
        return (
          <section className="mb-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Care Expenditure</div>
                <div className="text-3xl font-black">{careExp != null ? money(careExp * 1000) : '—'}</div>
                <div className="text-white/60 text-xs font-bold mt-2">ROGS 2026</div>
              </div>
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Notifications</div>
                <div className="text-3xl font-black">{notifications != null ? fmt(notifications) : '—'}</div>
                <div className="text-white/70 text-xs font-bold mt-2">child protection reports</div>
              </div>
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Children in OOHC</div>
                <div className="text-3xl font-black text-bauhaus-black">{oohc != null ? fmt(oohc) : '—'}</div>
                <div className="text-bauhaus-muted text-xs font-bold mt-2">on care &amp; protection orders</div>
              </div>
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Substantiation Rate</div>
                <div className="text-3xl font-black">{substRate != null ? `${Number(substRate).toFixed(1)}%` : '—'}</div>
                <div className="text-bauhaus-muted text-xs font-bold mt-2">of investigated notifications</div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ROGS Outcomes */}
      {report.outcomes.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
              <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">ROGS 2026</p>
              <h2 className="text-xl font-black">System Outcomes — {meta.name}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Indicator</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Value</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {report.outcomes.map((row, i) => (
                    <tr key={`${row.metric_name}-${row.period}-${row.cohort}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black">
                        {METRIC_LABELS[row.metric_name] || row.metric_name.replace(/^rogs_cp_/, '').replace(/_/g, ' ')}
                        {row.cohort && row.cohort !== 'all' && (
                          <span className="ml-2 text-[9px] font-black text-bauhaus-muted uppercase">{row.cohort}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-black">
                        {row.metric_unit === 'dollars' ? money(row.metric_value) :
                         row.metric_unit === 'percent' ? `${Number(row.metric_value).toFixed(1)}` :
                         fmt(row.metric_value)}
                      </td>
                      <td className="p-3 text-right text-xs text-bauhaus-muted font-bold">{row.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 text-[10px] text-bauhaus-muted font-medium border-t border-bauhaus-black/10">
              Source: Productivity Commission, Report on Government Services 2026
            </div>
          </div>
        </section>
      )}

      {/* Programs + Top Orgs — only show when funding data exists */}
      {(report.programs.length > 0 || report.topOrgs.length > 0) && (
        <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Programs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Program</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
                  </tr>
                </thead>
                <tbody>
                  {report.programs.map((row, i) => (
                    <tr key={row.program_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black">{row.program_name}</td>
                      <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
                      <td className="p-3 text-right font-mono">{fmt(row.orgs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Top Funded Organisations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topOrgs.map((row, i) => (
                    <tr key={`${row.recipient_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        {row.gs_id ? (
                          <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">{row.recipient_name}</Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{row.recipient_name}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* LGA Funding */}
      {report.lgas.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-canvas border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black text-bauhaus-black">Funding by LGA</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">SEIFA decile 1 = most disadvantaged</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">SEIFA</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lgas.map((row, i) => (
                    <tr key={row.lga_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black">{row.lga_name}</td>
                      <td className="p-3 text-right font-mono">{fmt(row.orgs)}</td>
                      <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total_funding)}</td>
                      <td className="p-3 text-right">
                        {row.seifa_decile != null ? (
                          <span className={`font-mono font-black ${row.seifa_decile <= 3 ? 'text-bauhaus-red' : row.seifa_decile <= 5 ? 'text-bauhaus-muted' : 'text-money'}`}>
                            {row.seifa_decile}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ALMA Evidence */}
      {report.alma.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-3">Evidence Base (ALMA)</p>
            <h3 className="text-lg font-black text-bauhaus-black mb-3">What works in {meta.name} child protection</h3>
            <div className="space-y-2">
              {report.alma.map((row) => (
                <div key={row.name} className="flex items-start justify-between text-sm border-b border-bauhaus-black/10 pb-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-bauhaus-black">{row.name}</span>
                    {row.type && <span className="ml-2 text-[9px] font-black text-bauhaus-muted uppercase">{row.type}</span>}
                  </div>
                  {row.evidence_level && (
                    <span className={`ml-2 text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest shrink-0 ${
                      row.evidence_level === 'Strong' ? 'border-money text-money' :
                      row.evidence_level === 'Promising' ? 'border-bauhaus-blue text-bauhaus-blue' :
                      'border-bauhaus-muted text-bauhaus-muted'
                    }`}>{row.evidence_level}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Policy Timeline */}
      {report.policyTimeline.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Policy Timeline</h2>
              <p className="text-sm text-white/60 font-medium mt-1">Key legislation, inquiries, and reforms</p>
            </div>
            <div className="divide-y divide-bauhaus-black/10">
              {report.policyTimeline.map((e, i) => (
                <div key={`${e.event_date}-${i}`} className="p-4 flex gap-4">
                  <div className="text-xs font-mono font-black text-bauhaus-muted whitespace-nowrap pt-0.5">{e.event_date?.slice(0, 4)}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 ${
                        e.severity === 'critical' ? 'bg-bauhaus-red text-white' :
                        e.severity === 'significant' ? 'bg-bauhaus-blue text-white' :
                        'bg-bauhaus-canvas text-bauhaus-muted'
                      }`}>{e.event_type}</span>
                      <span className="font-black text-bauhaus-black text-sm">{e.title}</span>
                    </div>
                    <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Oversight Recommendations */}
      {report.oversight.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Oversight &amp; Accountability</h2>
              <p className="text-sm text-white/60 font-medium mt-1">Recommendations from inquiries, audits, and commissions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Body</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recommendation</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.oversight.map((r, i) => (
                    <tr key={`${r.recommendation_number}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 align-top">
                        <div className="font-bold text-bauhaus-black text-xs">{r.oversight_body}</div>
                        <div className="text-[10px] text-bauhaus-muted">{r.report_title}</div>
                      </td>
                      <td className="p-3 align-top">
                        <span className="text-[10px] font-mono text-bauhaus-muted mr-1">{r.recommendation_number}</span>
                        <span className="font-medium text-bauhaus-black">{r.recommendation_text}</span>
                      </td>
                      <td className="p-3 align-top whitespace-nowrap">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${
                          r.status === 'implemented' ? 'bg-money/20 text-money' :
                          r.status === 'partially_implemented' ? 'bg-bauhaus-blue/20 text-bauhaus-blue' :
                          r.status === 'pending' ? 'bg-bauhaus-red/10 text-bauhaus-red' :
                          r.status === 'rejected' ? 'bg-bauhaus-black/10 text-bauhaus-black line-through' :
                          'bg-gray-100 text-bauhaus-muted'
                        }`}>{r.status?.replace(/_/g, ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Cross-System Overlap */}
      {report.crossSystem.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Cross-System Organisations</h2>
              <p className="text-sm text-white/60 font-medium mt-1">Entities receiving child protection funding that also appear in other domains</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Systems</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {report.crossSystem.map((row, i) => (
                    <tr key={row.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">{row.canonical_name}</Link>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.topics.map(t => (
                            <span key={t} className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 ${
                              t === 'child-protection' ? 'bg-bauhaus-blue/20 text-bauhaus-blue' :
                              t === 'youth-justice' ? 'bg-bauhaus-red/20 text-bauhaus-red' :
                              t === 'ndis' ? 'bg-purple-100 text-purple-700' :
                              t === 'indigenous' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-bauhaus-muted'
                            }`}>{t.replace(/-/g, ' ')}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-black">{money(Number(row.total_funding))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Cross-links */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
        <h2 className="text-lg font-black text-bauhaus-black mb-4">Cross-System</h2>
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link href={`/reports/youth-justice/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors">
            {stateCode.toUpperCase()} Youth Justice
          </Link>
          <Link href={`/reports/disability/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">
            {stateCode.toUpperCase()} Disability
          </Link>
          <Link href={`/reports/education/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            {stateCode.toUpperCase()} Education
          </Link>
        </div>
      </section>
    </div>
  );
}
