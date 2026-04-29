import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import {
  getAlmaInterventions,
  getAlmaCount,
  getOutcomesMetrics,
  getPolicyTimeline,
  getOversightData,
  getCrossSystemOverlap,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

type Row = Record<string, unknown>;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Queensland has significant NDIS thin markets in remote and outer regional areas. Over 120,000 NDIS participants with widening gaps in provider supply across Far North and Western Queensland.' },
  nsw: { name: 'New South Wales', description: 'NSW has the largest NDIS participant base in Australia with over 200,000 participants. Provider concentration in metro Sydney with significant thin markets in Western NSW.' },
  vic: { name: 'Victoria', description: 'Victoria has over 170,000 NDIS participants with a mature disability services market. Thin markets emerge in rural Gippsland and North West regions.' },
  wa: { name: 'Western Australia', description: 'WA has around 55,000 NDIS participants. Extreme distance creates thin markets across the Kimberley, Pilbara, and Goldfields-Esperance regions.' },
  sa: { name: 'South Australia', description: 'South Australia has around 50,000 NDIS participants. Remote communities face critical provider shortages, particularly for specialist supports.' },
  nt: { name: 'Northern Territory', description: 'The NT has the most extreme NDIS thin markets in Australia. Over 7,000 participants with critical provider gaps in every remote community. First Nations participants represent a majority of the scheme.' },
  tas: { name: 'Tasmania', description: 'Tasmania has around 15,000 NDIS participants. Small market scale creates thin markets even in regional centres, with allied health shortages across the state.' },
  act: { name: 'Australian Capital Territory', description: 'The ACT has around 13,000 NDIS participants in a relatively well-served market. Provider competition exists but specialist supports can still face wait times.' },
};

const STATES = Object.keys(STATE_META);

export function generateStaticParams() {
  return STATES.map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} Disability — CivicGraph` };
  });
}

type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null; gs_id: string | null; org_name: string | null; org_abn: string | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };

const METRIC_LABELS: Record<string, string> = {
  rogs_dis_ndis_expenditure: 'NDIS contributions ($\'000)',
  rogs_dis_autism_pct: 'Participants — autism (%)',
  rogs_dis_intellectual_pct: 'Participants — intellectual disability (%)',
  rogs_dis_psychosocial_pct: 'Participants — psychosocial disability (%)',
  rogs_dis_utilisation_metro: 'Plan utilisation — metro (%)',
  rogs_dis_utilisation_regional: 'Plan utilisation — regional (%)',
  rogs_dis_utilisation_remote: 'Plan utilisation — remote (%)',
  rogs_dis_utilisation_indigenous: 'Plan utilisation — Indigenous (%)',
  rogs_dis_utilisation_nonindigenous: 'Plan utilisation — non-Indigenous (%)',
  rogs_dis_restrictive_seclusion: 'Unauthorised seclusion incidents',
  rogs_dis_restrictive_chemical: 'Unauthorised chemical restraint',
  rogs_dis_restrictive_physical: 'Unauthorised physical restraint',
  rogs_dis_total_expenditure: 'Total disability expenditure ($M)',
  rogs_dis_total_payments: 'Total NDIS payments ($M)',
  rogs_dis_participation_rate: 'NDIS participants per 1,000 (0-64)',
  rogs_dis_satisfaction_plan: 'Plan implementation satisfaction (%)',
  rogs_dis_avg_payment_metro: 'Average plan payment — metro ($K)',
  rogs_dis_avg_payment_remote: 'Average plan payment — remote ($K)',
  rogs_dis_avg_payment_indigenous: 'Average plan payment — Indigenous ($K)',
  rogs_dis_transport_difficulty_severe: 'Transport difficulty — severe disability (%)',
  rogs_dis_transport_difficulty_total: 'Transport difficulty — all disability (%)',
};

async function getStateReport(stateCode: string) {
  const supabase = getServiceSupabase();
  const q = (query: string) => safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;
  const sc = stateCode.toUpperCase();

  const [thinMarkets, providers, almaInterventions, almaCount, outcomes, policyNational, policyState, oversightNational, oversightState, crossSystemOrgs] = await Promise.all([
    q(`SELECT lga_name, remoteness, ndis_participants, disability_entities, participants_per_provider,
        thin_market_status, desert_score, fn_ndis_participants
      FROM mv_disability_landscape WHERE state = '${sc}' AND ndis_participants > 0
      ORDER BY desert_score DESC NULLS LAST LIMIT 20`),
    q(`SELECT ge.canonical_name, ge.gs_id, ge.abn, ge.remoteness,
        (SELECT COUNT(*) FROM gs_relationships r WHERE r.source_entity_id = ge.id OR r.target_entity_id = ge.id) as connections
      FROM gs_entities ge WHERE ge.state = '${sc}' AND ge.sector ILIKE '%disab%'
      ORDER BY connections DESC LIMIT 15`),
    getAlmaInterventions('ndis', 25, stateCode),
    getAlmaCount('ndis', stateCode),
    getOutcomesMetrics(sc, 'disability'),
    getPolicyTimeline('National', 'disability'),
    getPolicyTimeline(sc, 'disability'),
    getOversightData('National', 'disability'),
    getOversightData(sc, 'disability'),
    getCrossSystemOverlap('ndis', stateCode),
  ]);

  return {
    thinMarkets: (thinMarkets || []) as Row[],
    providers: (providers || []) as Row[],
    alma: (almaInterventions || []) as AlmaRow[],
    almaCount: almaCount ?? 0,
    outcomes: (outcomes || []) as MetricRow[],
    policyTimeline: [...(policyState || []), ...(policyNational || [])].sort((a, b) => b.event_date.localeCompare(a.event_date)),
    oversight: [...(oversightState || []), ...(oversightNational || [])],
    crossSystem: (crossSystemOrgs || []) as Array<{ gs_id: string; canonical_name: string; entity_type: string | null; topics: string[]; topic_count: number; total_funding: number }>,
  };
}

export default async function DisabilityStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateParam } = await params;
  const stateCode = stateParam.toLowerCase();
  const meta = STATE_META[stateCode];
  if (!meta) notFound();

  const report = await getStateReport(stateCode);

  return (
    <div>
      <div className="mb-8">
        <Link href="/reports/disability" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Disability
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">State Deep Dive</span>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-black text-white">{stateCode.toUpperCase()}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Disability & NDIS
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>

        {/* State nav pills */}
        <div className="mt-4 flex flex-wrap gap-1">
          {STATES.map(s => (
            <Link
              key={s}
              href={`/reports/disability/${s}`}
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

      {/* Hero stats — ROGS data */}
      {(() => {
        const om = (name: string) => report.outcomes.find(r => r.metric_name === name)?.metric_value ?? null;
        const expenditure = om('rogs_dis_total_payments');
        const participation = om('rogs_dis_participation_rate');
        const satisfaction = om('rogs_dis_satisfaction_plan');
        const criticalLgas = report.thinMarkets.filter(r => r.thin_market_status === 'CRITICAL').length;
        return (
          <section className="mb-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">NDIS Payments</div>
                <div className="text-3xl font-black">{expenditure != null ? money(expenditure * 1000000) : '—'}</div>
                <div className="text-white/60 text-xs font-bold mt-2">ROGS 2026</div>
              </div>
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Participation</div>
                <div className="text-3xl font-black">{participation != null ? `${Number(participation).toFixed(1)}` : '—'}</div>
                <div className="text-bauhaus-muted text-xs font-bold mt-2">per 1,000 population (0-64)</div>
              </div>
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Plan Satisfaction</div>
                <div className="text-3xl font-black">{satisfaction != null ? `${Number(satisfaction).toFixed(0)}%` : '—'}</div>
                <div className="text-bauhaus-muted text-xs font-bold mt-2">plan implementation</div>
              </div>
              {criticalLgas > 0 && (
                <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
                  <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Critical Thin Markets</div>
                  <div className="text-3xl font-black">{criticalLgas}</div>
                  <div className="text-white/70 text-xs font-bold mt-2">LGAs with no providers</div>
                </div>
              )}
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
                    <tr key={`${row.metric_name}-${row.period}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black">
                        {METRIC_LABELS[row.metric_name] || row.metric_name.replace(/^rogs_dis_/, '').replace(/_/g, ' ')}
                      </td>
                      <td className="p-3 text-right font-mono font-black">
                        {row.metric_unit === 'dollars_millions' ? money(row.metric_value * 1000) :
                         row.metric_unit === 'percent' || row.metric_unit === 'rate_per_1000' ? `${Number(row.metric_value).toFixed(1)}` :
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

      {/* Thin Markets */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Thin Market Analysis</p>
            <h2 className="text-xl font-black">NDIS thin markets in {meta.name}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert</th>
                </tr>
              </thead>
              <tbody>
                {report.thinMarkets.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-bauhaus-muted font-medium">No thin market data yet for {meta.name}. Data ingestion coming soon.</td></tr>
                )}
                {report.thinMarkets.map((row, i) => (
                  <tr key={`${row.lga_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.lga_name)}</td>
                    <td className="p-3 text-xs text-bauhaus-muted">{String(row.remoteness || '').replace(' Australia', '')}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.ndis_participants))}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{fmt(Number(row.disability_entities))}</td>
                    <td className="p-3 text-right">
                      <span className={`text-xs font-black uppercase ${
                        row.thin_market_status === 'CRITICAL' ? 'text-bauhaus-red' :
                        row.thin_market_status === 'SEVERE' ? 'text-orange-500' :
                        row.thin_market_status === 'MODERATE' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>{String(row.thin_market_status)}</span>
                    </td>
                    <td className="p-3 text-right font-mono font-black">{row.desert_score ? Number(row.desert_score).toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top Providers */}
      {report.providers.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
              <h2 className="text-xl font-black">Top Disability Providers</h2>
              <p className="text-sm text-white/80 font-medium mt-1">By cross-system connections</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Connections</th>
                  </tr>
                </thead>
                <tbody>
                  {report.providers.map((row, i) => (
                    <tr key={`${row.gs_id}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        {row.gs_id ? (
                          <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">{String(row.canonical_name)}</Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{String(row.canonical_name)}</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-bauhaus-muted">{String(row.remoteness || '—').replace(' Australia', '')}</td>
                      <td className="p-3 text-right font-mono font-black">{fmt(Number(row.connections))}</td>
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
            <h3 className="text-lg font-black text-bauhaus-black mb-3">What works in {meta.name} disability services</h3>
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
              <p className="text-sm text-white/60 font-medium mt-1">Entities receiving disability/NDIS funding that also appear in other domains</p>
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
                              t === 'ndis' ? 'bg-purple-100 text-purple-700' :
                              t === 'child-protection' ? 'bg-bauhaus-blue/20 text-bauhaus-blue' :
                              t === 'youth-justice' ? 'bg-bauhaus-red/20 text-bauhaus-red' :
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
          <Link href={`/reports/child-protection/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">
            {stateCode.toUpperCase()} Child Protection
          </Link>
          <Link href={`/reports/education/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            {stateCode.toUpperCase()} Education
          </Link>
        </div>
      </section>
    </div>
  );
}
