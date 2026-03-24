import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import {
  getOutcomesMetrics,
  getAlmaCount,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'Education Intelligence — CivicGraph',
    description: 'Education funding, outcomes, and cross-system analysis across all Australian states and territories.',
  };
}

type Row = Record<string, unknown>;
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type SchoolRow = {
  state: string; total_schools: number; avg_icsea: number;
  total_enrolments: number; avg_indigenous_pct: number; low_icsea_schools: number;
};

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const;

async function getData() {
  const supabase = getServiceSupabase();
  const q = (query: string) => safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;

  const [
    schoolsByState,
    contractStats,
    nationalMetrics,
    ...stateMetrics
  ] = await Promise.all([
    q(`SELECT state, COUNT(*)::int as total_schools,
        ROUND(AVG(icsea_value))::int as avg_icsea,
        SUM(total_enrolments)::int as total_enrolments,
        ROUND(AVG(indigenous_pct)::numeric, 1)::float as avg_indigenous_pct,
        COUNT(*) FILTER (WHERE icsea_value < 900)::int as low_icsea_schools
      FROM acara_schools WHERE state IS NOT NULL
      GROUP BY state ORDER BY total_enrolments DESC`),
    q(`SELECT COUNT(*) as contracts, SUM(contract_value)::bigint as total_value
      FROM austender_contracts
      WHERE category ILIKE '%education%' OR category ILIKE '%training%'
        OR title ILIKE '%school%' OR title ILIKE '%education%'`),
    getOutcomesMetrics('National', 'education'),
    ...STATES.map(s => getOutcomesMetrics(s, 'education')),
  ]);

  // Build per-state metrics map
  const metricsByState: Record<string, MetricRow[]> = {};
  STATES.forEach((s, i) => {
    metricsByState[s] = ((stateMetrics[i] || []) as MetricRow[]);
  });

  return {
    schools: (schoolsByState || []) as SchoolRow[],
    contracts: ((contractStats || []) as Row[])[0] || {},
    national: (nationalMetrics || []) as MetricRow[],
    metricsByState,
  };
}

export default async function EducationReportPage() {
  const data = await getData();

  const totalSchools = data.schools.reduce((s, r) => s + r.total_schools, 0);
  const totalEnrolments = data.schools.reduce((s, r) => s + r.total_enrolments, 0);
  const totalLowIcsea = data.schools.reduce((s, r) => s + r.low_icsea_schools, 0);

  // National metric helper
  const nm = (name: string) => data.national.find(r => r.metric_name === name)?.metric_value ?? null;

  // State metric helper
  const sm = (state: string, name: string) => {
    const rows = data.metricsByState[state] || [];
    return rows.find(r => r.metric_name === name)?.metric_value ?? null;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Education Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Education Funding, Outcomes & Cross-System Analysis
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Attendance, retention, expenditure, and school disadvantage across all Australian states.
          ROGS 4A, ACARA school data, and cross-system connections to child protection, youth justice,
          and disability services.
        </p>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/reports/education/national" className="text-[10px] font-black uppercase tracking-widest px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            National Comparison
          </Link>
          {STATES.map(s => (
            <Link key={s} href={`/reports/education/${s.toLowerCase()}`}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* National Headlines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{fmt(totalSchools)}</div>
          <div className="text-xs text-gray-500 mt-1">Schools tracked (ACARA)</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{fmt(totalEnrolments)}</div>
          <div className="text-xs text-gray-500 mt-1">Total enrolments</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{nm('rogs_edu_attendance_all') ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">National attendance</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{fmt(totalLowIcsea)}</div>
          <div className="text-xs text-gray-500 mt-1">Schools below ICSEA 900</div>
        </div>
      </div>

      {/* State Comparison Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-emerald-600 pb-2">
          State Comparison
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          ROGS 4A (2023-24) and ACARA school data. Click a state to see its full report.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">State</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Attendance</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Yr 12 Retention</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Schools</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Avg ICSEA</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Low ICSEA</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Expenditure</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Enrolments</th>
              </tr>
            </thead>
            <tbody>
              {STATES.map((s) => {
                const school = data.schools.find(r => r.state === s);
                const att = sm(s, 'rogs_edu_attendance_all');
                const ret = sm(s, 'rogs_edu_retention_yr12');
                const exp = sm(s, 'rogs_edu_total_expenditure');
                return (
                  <tr key={s} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/reports/education/${s.toLowerCase()}`} className="font-black text-bauhaus-blue hover:underline">
                        {s}
                      </Link>
                    </td>
                    <td className={`py-2 text-right ${att !== null && att < 80 ? 'text-red-600 font-bold' : ''}`}>
                      {att !== null ? `${att}%` : '—'}
                    </td>
                    <td className={`py-2 text-right ${ret !== null && ret < 70 ? 'text-red-600 font-bold' : ''}`}>
                      {ret !== null ? `${ret}%` : '—'}
                    </td>
                    <td className="py-2 text-right">{school ? fmt(school.total_schools) : '—'}</td>
                    <td className={`py-2 text-right ${school && school.avg_icsea < 950 ? 'text-red-600 font-bold' : ''}`}>
                      {school?.avg_icsea ?? '—'}
                    </td>
                    <td className="py-2 text-right">{school ? fmt(school.low_icsea_schools) : '—'}</td>
                    <td className="py-2 text-right">{exp !== null ? money(exp * 1000) : '—'}</td>
                    <td className="py-2 text-right">{school ? fmt(school.total_enrolments) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ROGS Headline Metrics */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          National ROGS Metrics
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Key national metrics from the Report on Government Services 2026, Chapter 4A.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total expenditure', value: nm('rogs_edu_total_expenditure'), format: 'money' },
            { label: 'Attendance rate', value: nm('rogs_edu_attendance_all'), format: 'pct' },
            { label: 'Year 12 retention', value: nm('rogs_edu_retention_yr12'), format: 'pct' },
            { label: 'VET completion', value: nm('rogs_edu_vet_completion_pct'), format: 'pct' },
            { label: 'Primary enrolments', value: nm('rogs_edu_primary_enrolments'), format: 'num' },
            { label: 'Secondary enrolments', value: nm('rogs_edu_secondary_enrolments'), format: 'num' },
            { label: 'Student-teacher ratio', value: nm('rogs_edu_ratio_primary'), format: 'ratio' },
            { label: 'Participation (15yo)', value: nm('rogs_edu_participation_15yo'), format: 'pct' },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xl font-black text-gray-800">
                {m.value !== null
                  ? m.format === 'money' ? money(m.value * 1000)
                  : m.format === 'pct' ? `${m.value}%`
                  : m.format === 'ratio' ? `${m.value}:1`
                  : fmt(m.value)
                  : '—'}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* State Scorecards */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
          State Scorecards
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATES.map(s => {
            const school = data.schools.find(r => r.state === s);
            const att = sm(s, 'rogs_edu_attendance_all');
            const ret = sm(s, 'rogs_edu_retention_yr12');
            return (
              <Link key={s} href={`/reports/education/${s.toLowerCase()}`}
                className="border border-gray-200 rounded-xl p-4 hover:border-emerald-500 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-lg text-bauhaus-black">{s}</span>
                  {att !== null && att < 80 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">LOW</span>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Attendance</span>
                    <span className={`font-bold ${att !== null && att < 80 ? 'text-red-600' : ''}`}>{att !== null ? `${att}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Retention</span>
                    <span className="font-bold">{ret !== null ? `${ret}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg ICSEA</span>
                    <span className="font-bold">{school?.avg_icsea ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Schools</span>
                    <span className="font-bold">{school ? fmt(school.total_schools) : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Cross-system */}
      <section className="border-4 border-bauhaus-black bg-emerald-50/50 p-6 mb-12">
        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">Cross-System</p>
        <h2 className="text-2xl font-black text-bauhaus-black mb-3">Education is not a silo</h2>
        <p className="text-sm text-bauhaus-black/80 font-medium max-w-4xl leading-relaxed">
          Children in the child protection system have drastically worse educational outcomes. Youth justice
          detention disrupts schooling. NDIS participants need educational support. CivicGraph maps these
          cross-system connections — same organisations, same postcodes, different funding streams.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Link href="/reports/child-protection" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 group-hover:text-amber-300">Pipeline</p>
            <h3 className="mt-2 text-lg font-black">Child Protection</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Children in care have 3x school exclusion rates. See the overlap.
            </p>
          </Link>
          <Link href="/reports/youth-justice" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600 group-hover:text-red-300">Justice</p>
            <h3 className="mt-2 text-lg font-black">Youth Justice</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Detention disrupts education. See who funds both sides.
            </p>
          </Link>
          <Link href="/reports/disability" className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 group-hover:text-blue-300">NDIS</p>
            <h3 className="mt-2 text-lg font-black">Disability</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Education support is a core NDIS need. Map the provider landscape.
            </p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pb-8">
        Data from ROGS 2026 Chapter 4A, ACARA My School, and CivicGraph entity graph.
        Metrics for 2023-24 financial year unless noted.
      </div>
    </div>
  );
}
