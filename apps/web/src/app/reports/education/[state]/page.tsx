import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { getOutcomesMetrics, getPolicyTimeline, getOversightData, money, fmt } from '@/lib/services/report-service';

export const revalidate = 3600;

type Row = Record<string, unknown>;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Queensland\'s education sector includes 1,250+ state schools, 500+ non-state schools, universities, and TAFE Queensland. Significant regional disparity in educational outcomes and access to specialist services.' },
  nsw: { name: 'New South Wales', description: 'NSW has Australia\'s largest education system with 2,200+ public schools. Major funding flows through federal Schools Resourcing and Gonski agreements.' },
  vic: { name: 'Victoria', description: 'Victoria\'s education system serves 1 million+ students across 1,500+ government schools. Strong TAFE and vocational training sector with significant federal funding.' },
  wa: { name: 'Western Australia', description: 'WA has significant education access challenges across remote and very remote communities. Aboriginal education outcomes remain a critical focus area.' },
  sa: { name: 'South Australia', description: 'South Australia\'s education system includes 500+ public schools with a focus on early childhood development and STEM. Royal Commission into Early Childhood Education and Care underway.' },
  nt: { name: 'Northern Territory', description: 'The NT has Australia\'s most challenging education landscape with remote community access, high teacher turnover, and significant gaps in Indigenous education outcomes.' },
  tas: { name: 'Tasmania', description: 'Tasmania\'s education system serves around 85,000 students with a focus on literacy and numeracy outcomes. Significant investment in school infrastructure and TAFE expansion.' },
  act: { name: 'Australian Capital Territory', description: 'The ACT has the highest education outcomes nationally but still faces equity gaps. Strong university presence with ANU and University of Canberra.' },
};

const STATES = Object.keys(STATE_META);

export function generateStaticParams() {
  return STATES.map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} Education — CivicGraph` };
  });
}

type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };

const METRIC_LABELS: Record<string, string> = {
  rogs_edu_total_enrolments: 'Total school enrolments',
  rogs_edu_primary_enrolments: 'Primary school enrolments',
  rogs_edu_secondary_enrolments: 'Secondary school enrolments',
  rogs_edu_participation_15yo: 'Participation rate — 15 year olds (%)',
  rogs_edu_participation_16yo: 'Participation rate — 16 year olds (%)',
  rogs_edu_participation_17yo: 'Participation rate — 17 year olds (%)',
  rogs_edu_ratio_primary: 'Student-teacher ratio (primary)',
  rogs_edu_vet_completion_pct: 'VET completion — 15-19 year olds (%)',
  rogs_edu_attendance_all: 'Attendance rate — Yr 1-10 (%)',
  rogs_edu_retention_yr12: 'Apparent retention — Year 10 to Year 12 (%)',
  rogs_edu_total_expenditure: 'Total government education expenditure ($\'000)',
  rogs_edu_expenditure_per_student: 'Government expenditure per FTE student ($)',
  rogs_edu_disability_supplementary: 'Disability adjustment — supplementary (%)',
  rogs_edu_disability_substantial: 'Disability adjustment — substantial (%)',
  rogs_edu_disability_extensive: 'Disability adjustment — extensive (%)',
};

async function getStateReport(stateCode: string) {
  const supabase = getServiceSupabase();
  const q = (query: string) => safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;
  const sc = stateCode.toUpperCase();

  const [entities, contracts, topProviders, outcomes, schoolSummary, schoolsBySector, policyNational, policyState, oversightNational, oversightState] = await Promise.all([
    q(`SELECT entity_type, COUNT(*) as count
      FROM gs_entities WHERE state = '${sc}' AND sector ILIKE '%education%'
      GROUP BY entity_type ORDER BY count DESC`),
    q(`SELECT COUNT(*) as contracts, SUM(contract_value)::bigint as total_value
      FROM austender_contracts
      WHERE (category ILIKE '%education%' OR category ILIKE '%training%'
        OR title ILIKE '%school%' OR title ILIKE '%education%')
        AND (supplier_state = '${sc}' OR buyer_state = '${sc}')`),
    q(`SELECT ge.canonical_name, ge.gs_id, ge.entity_type,
        COUNT(DISTINCT r.id) as connections
      FROM gs_entities ge
      LEFT JOIN gs_relationships r ON r.source_entity_id = ge.id OR r.target_entity_id = ge.id
      WHERE ge.state = '${sc}' AND ge.sector ILIKE '%education%'
      GROUP BY ge.id, ge.canonical_name, ge.gs_id, ge.entity_type
      ORDER BY connections DESC LIMIT 15`),
    getOutcomesMetrics(sc, 'education'),
    q(`SELECT COUNT(*) as total_schools,
        ROUND(AVG(icsea_value)) as avg_icsea,
        SUM(total_enrolments) as total_enrolments,
        ROUND(AVG(indigenous_pct)::numeric, 1) as avg_indigenous_pct,
        COUNT(*) FILTER (WHERE icsea_value < 900) as low_icsea_schools,
        ROUND(AVG(icsea_value) FILTER (WHERE indigenous_pct > 50)) as high_indigenous_avg_icsea
      FROM acara_schools WHERE state = '${sc}'`),
    q(`SELECT school_sector, COUNT(*) as count, SUM(total_enrolments) as enrolments,
        ROUND(AVG(icsea_value)) as avg_icsea
      FROM acara_schools WHERE state = '${sc}'
      GROUP BY school_sector ORDER BY count DESC`),
    getPolicyTimeline('National', 'education'),
    getPolicyTimeline(sc, 'education'),
    getOversightData('National', 'education'),
    getOversightData(sc, 'education'),
  ]);

  const school = ((schoolSummary || []) as Row[])[0] || {};

  return {
    entities: (entities || []) as Row[],
    contracts: ((contracts || []) as Row[])[0] || {},
    topProviders: (topProviders || []) as Row[],
    outcomes: (outcomes || []) as MetricRow[],
    school,
    schoolsBySector: (schoolsBySector || []) as Row[],
    policyTimeline: [...(policyState || []), ...(policyNational || [])].sort((a, b) => b.event_date.localeCompare(a.event_date)),
    oversight: [...(oversightState || []), ...(oversightNational || [])],
  };
}

export default async function EducationStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateParam } = await params;
  const stateCode = stateParam.toLowerCase();
  const meta = STATE_META[stateCode];
  if (!meta) notFound();

  const report = await getStateReport(stateCode);
  const totalEntities = report.entities.reduce((s, r) => s + Number(r.count), 0);

  return (
    <div>
      <div className="mb-8">
        <Link href="/reports/education" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Education
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">State Deep Dive</span>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-black text-white">{stateCode.toUpperCase()}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Education
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>

        {/* State nav pills */}
        <div className="mt-4 flex flex-wrap gap-1">
          {STATES.map(s => (
            <Link
              key={s}
              href={`/reports/education/${s}`}
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

      {/* Hero stats */}
      <section className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Education Entities</div>
            <div className="text-4xl font-black">{fmt(totalEntities)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">{meta.name} education sector</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Federal Contracts</div>
            <div className="text-4xl font-black text-bauhaus-red">{money(Number(report.contracts.total_value) || 0)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">{fmt(Number(report.contracts.contracts) || 0)} contracts</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Entity Types</div>
            <div className="text-4xl font-black text-bauhaus-blue">{report.entities.length}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">distinct categories</div>
          </div>
        </div>
      </section>

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
                        {METRIC_LABELS[row.metric_name] || row.metric_name.replace(/^rogs_edu_/, '').replace(/_/g, ' ')}
                      </td>
                      <td className="p-3 text-right font-mono font-black">
                        {row.metric_unit === 'percent' || row.metric_unit === 'ratio' ? `${Number(row.metric_value).toFixed(1)}` : fmt(row.metric_value)}
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

      {/* School Landscape */}
      {Number(report.school.total_schools) > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
              <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-2">ACARA MySchool</p>
              <h2 className="text-xl font-black">School Landscape — {meta.name}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b-4 border-bauhaus-black">
              <div className="p-5 border-r-2 border-bauhaus-black/10">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Schools</div>
                <div className="text-3xl font-black text-bauhaus-black">{fmt(Number(report.school.total_schools))}</div>
              </div>
              <div className="p-5 border-r-2 border-bauhaus-black/10">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Enrolments</div>
                <div className="text-3xl font-black text-bauhaus-black">{fmt(Number(report.school.total_enrolments))}</div>
              </div>
              <div className="p-5 border-r-2 border-bauhaus-black/10">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Avg ICSEA</div>
                <div className="text-3xl font-black text-bauhaus-black">{String(report.school.avg_icsea ?? '—')}</div>
                <div className="text-[10px] text-bauhaus-muted font-bold mt-1">National avg: 1,000</div>
              </div>
              <div className="p-5">
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Avg Indigenous %</div>
                <div className="text-3xl font-black text-bauhaus-red">{String(report.school.avg_indigenous_pct ?? '—')}%</div>
              </div>
            </div>
            {Number(report.school.low_icsea_schools) > 0 && (
              <div className="p-4 bg-bauhaus-canvas flex items-center gap-3 border-b border-bauhaus-black/10">
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Disadvantage Signal</span>
                <span className="text-sm font-bold text-bauhaus-black">
                  {fmt(Number(report.school.low_icsea_schools))} schools below ICSEA 900
                  ({Math.round(Number(report.school.low_icsea_schools) / Number(report.school.total_schools) * 100)}% of state)
                  {report.school.high_indigenous_avg_icsea ? (
                    <> — majority-Indigenous schools avg ICSEA: {String(report.school.high_indigenous_avg_icsea)}</>
                  ) : null}
                </span>
              </div>
            )}
            {report.schoolsBySector.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-canvas">
                      <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Sector</th>
                      <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Schools</th>
                      <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Enrolments</th>
                      <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg ICSEA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.schoolsBySector.map((row, i) => (
                      <tr key={String(row.school_sector)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-3 font-bold text-bauhaus-black">{String(row.school_sector)}</td>
                        <td className="p-3 text-right font-mono font-black">{fmt(Number(row.count))}</td>
                        <td className="p-3 text-right font-mono font-black">{fmt(Number(row.enrolments))}</td>
                        <td className="p-3 text-right font-mono font-black">{String(row.avg_icsea ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-3 text-[10px] text-bauhaus-muted font-medium border-t border-bauhaus-black/10">
              Source: ACARA MySchool 2023. ICSEA = Index of Community Socio-Educational Advantage (1,000 = national average).
            </div>
          </div>
        </section>
      )}

      {/* Entity breakdown + Top Providers */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <h2 className="text-xl font-black">Entity Type Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Type</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Count</th>
                </tr>
              </thead>
              <tbody>
                {report.entities.length === 0 && (
                  <tr><td colSpan={2} className="p-6 text-center text-bauhaus-muted font-medium">No education entity data yet for {meta.name}.</td></tr>
                )}
                {report.entities.map((row, i) => (
                  <tr key={String(row.entity_type)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.entity_type || 'Unknown')}</td>
                    <td className="p-3 text-right font-mono font-black">{fmt(Number(row.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <h2 className="text-xl font-black">Most Connected Providers</h2>
            <p className="text-sm text-white/80 font-medium mt-1">By cross-system relationships</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Links</th>
                </tr>
              </thead>
              <tbody>
                {report.topProviders.length === 0 && (
                  <tr><td colSpan={2} className="p-6 text-center text-bauhaus-muted font-medium">No provider data yet for {meta.name}.</td></tr>
                )}
                {report.topProviders.map((row, i) => (
                  <tr key={`${row.gs_id}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      {row.gs_id ? (
                        <Link href={`/entity/${row.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">{String(row.canonical_name)}</Link>
                      ) : (
                        <span className="font-bold text-bauhaus-black">{String(row.canonical_name)}</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-black">{fmt(Number(row.connections))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
          <Link href={`/reports/disability/${stateCode}`} className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            {stateCode.toUpperCase()} Disability
          </Link>
        </div>
      </section>
    </div>
  );
}
