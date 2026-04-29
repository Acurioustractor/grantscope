import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Funding Deserts | CivicGraph Investigation',
  description: 'Where disadvantage is highest and investment is lowest. 568 Local Government Areas scored by SEIFA disadvantage, remoteness, entity coverage, and funding flows.',
  openGraph: {
    title: 'Funding Deserts',
    description: 'Geographic analysis of where disadvantage is highest and funding is lowest across Australian LGAs.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Funding Deserts',
    description: 'Where disadvantage is highest and investment is lowest. 568 LGAs scored.',
  },
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }

interface DesertLGA {
  lga_name: string;
  state: string;
  remoteness: string;
  avg_irsd_decile: number;
  avg_irsd_score: number;
  indexed_entities: number;
  community_controlled_entities: number;
  total_funding_all_sources: number;
  desert_score: number;
}

interface RemoteStat {
  remoteness: string;
  lga_count: number;
  avg_desert_score: number;
  avg_funding: number;
  total_entities: number;
  min_desert: number;
  max_desert: number;
}

interface StateStat {
  state: string;
  lga_count: number;
  avg_desert_score: number;
  total_funding: number;
  total_entities: number;
}

interface Summary {
  total_lgas: number;
  severe_deserts: number;
  avg_desert_score: number;
  max_funding: number;
  min_funding: number;
}

async function getData() {
  const supabase = getServiceSupabase();

  const [worstResult, bestResult, remotenessResult, stateResult, summaryResult] = await Promise.all([
    supabase.rpc('exec_sql', {
      query: `SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, avg_irsd_score, indexed_entities, community_controlled_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score DESC`,
    }),
    supabase.rpc('exec_sql', {
      query: `SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score ASC`,
    }),
    supabase.rpc('exec_sql', {
      query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL AND remoteness IS NOT NULL AND remoteness != '' ORDER BY lga_name, state, desert_score DESC) SELECT remoteness, COUNT(*) as lga_count, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(AVG(total_funding_all_sources)::numeric,0) as avg_funding, SUM(indexed_entities) as total_entities, ROUND(MIN(desert_score)::numeric,1) as min_desert, ROUND(MAX(desert_score)::numeric,1) as max_desert FROM deduped GROUP BY remoteness ORDER BY avg_desert_score DESC`,
    }),
    supabase.rpc('exec_sql', {
      query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL AND state IS NOT NULL AND state != '' ORDER BY lga_name, state, desert_score DESC) SELECT state, COUNT(*) as lga_count, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(SUM(total_funding_all_sources)::numeric,0) as total_funding, SUM(indexed_entities) as total_entities FROM deduped GROUP BY state ORDER BY avg_desert_score DESC`,
    }),
    supabase.rpc('exec_sql', {
      query: `WITH deduped AS (SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, avg_irsd_decile, indexed_entities, total_funding_all_sources, desert_score FROM mv_funding_deserts WHERE desert_score IS NOT NULL ORDER BY lga_name, state, desert_score DESC) SELECT COUNT(*) as total_lgas, COUNT(CASE WHEN desert_score > 100 THEN 1 END) as severe_deserts, ROUND(AVG(desert_score)::numeric,1) as avg_desert_score, ROUND(MAX(total_funding_all_sources)::numeric,0) as max_funding, ROUND(MIN(CASE WHEN total_funding_all_sources > 0 THEN total_funding_all_sources END)::numeric,0) as min_funding FROM deduped`,
    }),
  ]);

  const allDeserts = (worstResult.data as Record<string, unknown>[]) || [];
  const allBest = (bestResult.data as Record<string, unknown>[]) || [];

  const worst30 = [...allDeserts]
    .sort((a, b) => Number(b.desert_score) - Number(a.desert_score))
    .slice(0, 30) as unknown as DesertLGA[];

  const best10 = [...allBest]
    .sort((a, b) => Number(a.desert_score) - Number(b.desert_score))
    .slice(0, 10) as unknown as DesertLGA[];

  const worst10 = [...allDeserts]
    .sort((a, b) => Number(b.desert_score) - Number(a.desert_score))
    .slice(0, 10) as unknown as DesertLGA[];

  const byRemoteness = (remotenessResult.data || []) as unknown as RemoteStat[];
  const byState = (stateResult.data || []) as unknown as StateStat[];
  const summaryRaw = (summaryResult.data as Record<string, unknown>[])?.[0] || {};

  const summary: Summary = {
    total_lgas: Number(summaryRaw.total_lgas) || 0,
    severe_deserts: Number(summaryRaw.severe_deserts) || 0,
    avg_desert_score: Number(summaryRaw.avg_desert_score) || 0,
    max_funding: Number(summaryRaw.max_funding) || 0,
    min_funding: Number(summaryRaw.min_funding) || 0,
  };

  return { worst30, best10, worst10, byRemoteness, byState, summary };
}

const REMOTENESS_COLORS: Record<string, string> = {
  'Very Remote Australia': 'text-bauhaus-red font-black',
  'Remote Australia': 'text-orange-600 font-black',
  'Outer Regional Australia': 'text-amber-600 font-bold',
  'Inner Regional Australia': 'text-bauhaus-blue font-bold',
  'Major Cities of Australia': 'text-gray-600',
};

const REMOTENESS_SHORT: Record<string, string> = {
  'Very Remote Australia': 'Very Remote',
  'Remote Australia': 'Remote',
  'Outer Regional Australia': 'Outer Regional',
  'Inner Regional Australia': 'Inner Regional',
  'Major Cities of Australia': 'Major Cities',
};

const REMOTENESS_BAR_COLORS: Record<string, string> = {
  'Very Remote Australia': 'bg-bauhaus-red',
  'Remote Australia': 'bg-orange-500',
  'Outer Regional Australia': 'bg-amber-500',
  'Inner Regional Australia': 'bg-bauhaus-blue',
  'Major Cities of Australia': 'bg-gray-400',
};

export default async function FundingDesertsReport() {
  const d = await getData();
  const s = d.summary;

  const fundingGap = s.max_funding - s.min_funding;

  // Find remoteness stats for the bar chart
  const maxDesert = d.byRemoteness.length > 0
    ? Math.max(...d.byRemoteness.map(r => Number(r.avg_desert_score)))
    : 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Geographic Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Funding Deserts
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Where disadvantage is highest and investment is lowest &mdash; {fmt(s.total_lgas)} Local
          Government Areas scored by SEIFA disadvantage, remoteness, entity coverage, and funding
          flows. {fmt(s.severe_deserts)} LGAs score above 100, indicating severe geographic
          underinvestment relative to need.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">LGAs Analysed</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.total_lgas)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">scored by desert index</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Severe Deserts</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.severe_deserts)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">desert score &gt; 100</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Avg Desert Score</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{s.avg_desert_score}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">across all LGAs</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Funding Gap</div>
            <div className="text-3xl sm:text-4xl font-black">{money(fundingGap)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">most vs least funded</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: SEIFA 2021 (ABS) &times; Remoteness Areas (ABS) &times; CivicGraph Entity Graph &times; Justice Funding &times; AusTender Procurement.
          </p>
        </div>
      </section>

      {/* Section 1: Worst Funding Deserts */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Worst Funding Deserts
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 30 LGAs with the highest desert scores: most disadvantaged, most remote, fewest
          service providers, and least funded. Many have zero indexed entities and zero tracked
          funding — invisible to the systems designed to help them.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Remoteness</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">SEIFA Decile</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Entities</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Total Funding</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert Score</th>
              </tr>
            </thead>
            <tbody>
              {d.worst30.map((lga, i) => (
                <tr key={`${lga.lga_name}-${lga.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{lga.lga_name}</div>
                    <div className="text-xs text-bauhaus-muted">{lga.state || 'Unknown'}</div>
                  </td>
                  <td className={`p-3 text-xs hidden sm:table-cell ${REMOTENESS_COLORS[lga.remoteness] || ''}`}>
                    {REMOTENESS_SHORT[lga.remoteness] || lga.remoteness || '—'}
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">
                    <span className={Number(lga.avg_irsd_decile) <= 3 ? 'text-bauhaus-red font-black' : ''}>
                      {Number(lga.avg_irsd_decile).toFixed(1)}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">
                    {Number(lga.indexed_entities) === 0
                      ? <span className="text-bauhaus-red font-black">0</span>
                      : fmt(Number(lga.indexed_entities))}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {Number(lga.total_funding_all_sources) === 0
                      ? <span className="text-bauhaus-red font-black">$0</span>
                      : money(Number(lga.total_funding_all_sources))}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">
                    {Number(lga.desert_score).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right">
          <a href="/api/data/funding-deserts" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            Full Data (API) &rarr;
          </a>
        </div>
      </section>

      <ReportCTA reportSlug="funding-deserts" reportTitle="Funding Deserts Geographic Analysis" variant="inline" />

      {/* Section 2: By Remoteness */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Urban-Remote Divide
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The data is unambiguous: remoteness drives desert scores. Very Remote LGAs
          average {d.byRemoteness.find(r => r.remoteness === 'Very Remote Australia')
            ? Number(d.byRemoteness.find(r => r.remoteness === 'Very Remote Australia')!.avg_desert_score).toFixed(0)
            : '—'} on the desert index versus {d.byRemoteness.find(r => r.remoteness === 'Major Cities of Australia')
            ? Number(d.byRemoteness.find(r => r.remoteness === 'Major Cities of Australia')!.avg_desert_score).toFixed(0)
            : '—'} for Major Cities &mdash; a {(() => {
              const vr = d.byRemoteness.find(r => r.remoteness === 'Very Remote Australia');
              const mc = d.byRemoteness.find(r => r.remoteness === 'Major Cities of Australia');
              if (vr && mc && Number(mc.avg_desert_score) > 0) {
                return (Number(vr.avg_desert_score) / Number(mc.avg_desert_score)).toFixed(1);
              }
              return '—';
            })()}x disparity.
        </p>

        {/* Remoteness bar chart */}
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">Average Desert Score by Remoteness</h3>
          {d.byRemoteness.map(r => (
            <div key={r.remoteness} className="flex items-center gap-3 mb-3">
              <div className="w-32 text-xs font-bold text-bauhaus-black text-right shrink-0">
                {REMOTENESS_SHORT[r.remoteness] || r.remoteness}
              </div>
              <div className="flex-1 h-8 bg-gray-100 relative">
                <div
                  className={`h-full ${REMOTENESS_BAR_COLORS[r.remoteness] || 'bg-gray-400'} transition-all flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max((Number(r.avg_desert_score) / maxDesert) * 100, 2)}%` }}
                >
                  <span className="text-xs font-black text-white">{Number(r.avg_desert_score).toFixed(0)}</span>
                </div>
              </div>
              <div className="w-20 text-xs font-mono text-right shrink-0">
                {fmt(Number(r.lga_count))} LGAs
              </div>
            </div>
          ))}
        </div>

        {/* Remoteness stats table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">LGAs</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Desert Score</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Avg Funding</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Total Entities</th>
              </tr>
            </thead>
            <tbody>
              {d.byRemoteness.map((r, i) => (
                <tr key={r.remoteness} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className={`p-3 font-bold ${REMOTENESS_COLORS[r.remoteness] || ''}`}>
                    {REMOTENESS_SHORT[r.remoteness] || r.remoteness}
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(Number(r.lga_count))}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{Number(r.avg_desert_score).toFixed(1)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(Number(r.avg_funding))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(Number(r.total_entities))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: By State */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Desert Scores by State
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          State-level aggregates reveal structural differences in how funding reaches
          communities. States with large remote footprints carry higher average desert scores.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-blue text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">LGAs</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Desert Score</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Total Funding</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Total Entities</th>
              </tr>
            </thead>
            <tbody>
              {d.byState.map((st, i) => (
                <tr key={st.state} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                  <td className="p-3 font-black text-bauhaus-black">{st.state}</td>
                  <td className="p-3 text-right font-mono">{fmt(Number(st.lga_count))}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{Number(st.avg_desert_score).toFixed(1)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(Number(st.total_funding))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(Number(st.total_entities))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Best vs Worst */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Best Funded vs Worst Funded
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Side-by-side comparison of the 10 most underserved and 10 best-served LGAs.
          The contrast reveals the structural geography of Australian social investment.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Worst funded */}
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <div className="bg-bauhaus-red text-white p-3">
              <h3 className="text-xs font-black uppercase tracking-widest">Most Underserved (Worst Deserts)</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50">
                  <th className="text-left p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">#</th>
                  <th className="text-left p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">LGA</th>
                  <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">Score</th>
                </tr>
              </thead>
              <tbody>
                {d.worst10.map((lga, i) => (
                  <tr key={`worst-${lga.lga_name}-${lga.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                    <td className="p-2 font-black text-bauhaus-muted text-xs">{i + 1}</td>
                    <td className="p-2">
                      <div className="font-bold text-bauhaus-black text-xs">{lga.lga_name}</div>
                      <div className="text-[10px] text-bauhaus-muted">
                        {lga.state || '—'} &middot; {REMOTENESS_SHORT[lga.remoteness] || lga.remoteness || '—'}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono font-black text-bauhaus-red">{Number(lga.desert_score).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Best funded */}
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black bg-white overflow-x-auto">
            <div className="bg-green-700 text-white p-3">
              <h3 className="text-xs font-black uppercase tracking-widest">Best Served (Lowest Desert Scores)</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-50">
                  <th className="text-left p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">#</th>
                  <th className="text-left p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">LGA</th>
                  <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] text-bauhaus-muted">Score</th>
                </tr>
              </thead>
              <tbody>
                {d.best10.map((lga, i) => (
                  <tr key={`best-${lga.lga_name}-${lga.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
                    <td className="p-2 font-black text-bauhaus-muted text-xs">{i + 1}</td>
                    <td className="p-2">
                      <div className="font-bold text-bauhaus-black text-xs">{lga.lga_name}</div>
                      <div className="text-[10px] text-bauhaus-muted">
                        {lga.state || '—'} &middot; {REMOTENESS_SHORT[lga.remoteness] || lga.remoteness || '—'}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono font-black text-green-700">{Number(lga.desert_score).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>SEIFA IRSD (Socio-Economic Indexes for Areas):</strong> The Index of
              Relative Socio-Economic Disadvantage from the Australian Bureau of Statistics (2021
              Census). Each postcode is assigned a decile from 1 (most disadvantaged) to 10
              (least disadvantaged). LGA-level scores are averaged across constituent postcodes.
              A low SEIFA decile means the area has higher proportions of people with low
              incomes, lower educational attainment, and higher unemployment.
            </p>
            <p>
              <strong>Remoteness classification:</strong> Based on the ABS Remoteness Areas
              framework (ARIA+ 2021), which classifies geography into five categories: Major
              Cities, Inner Regional, Outer Regional, Remote, and Very Remote. Each category
              reflects distance from service centres and population density.
            </p>
            <p>
              <strong>Entity coverage:</strong> The count of CivicGraph-indexed entities
              (charities, service providers, community organisations) operating within each LGA.
              A low entity count signals sparse service infrastructure &mdash; fewer organisations
              competing for or delivering services.
            </p>
            <p>
              <strong>Desert score formula:</strong> A composite index combining four dimensions:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>SEIFA IRSD decile (inverted, scaled 0&ndash;100) &mdash; lower decile = higher disadvantage = higher score</li>
              <li>Remoteness category (0&ndash;40) &mdash; Very Remote = 40, Remote = 30, Outer Regional = 20, Inner Regional = 10, Major Cities = 0</li>
              <li>Entity coverage gap (0&ndash;30) &mdash; fewer entities per LGA = higher score</li>
              <li>Funding gap (0&ndash;20) &mdash; less tracked funding = higher score</li>
            </ul>
            <p>
              Maximum theoretical score: 190. A score above 100 indicates a severely
              underserved area where disadvantage, remoteness, and lack of service
              infrastructure compound.
            </p>
            <p>
              <strong>Data sources:</strong> AusTender procurement contracts, state justice
              funding programs, political donation records (AEC), ACNC charity registry,
              philanthropic foundation giving, and ATO tax transparency data. All cross-referenced
              by ABN and mapped to postcodes and LGAs via the CivicGraph entity graph.
            </p>
            <p>
              <strong>Limitations:</strong> The desert score measures tracked funding and entity
              presence within CivicGraph&apos;s indexed datasets. It does not capture all government
              programs (e.g., direct state service delivery, Medicare, Centrelink payments). LGAs
              with zero entities may have organisations not yet indexed. The score is most useful
              as a relative comparison between LGAs, not as an absolute measure of service access.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Data</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Dive deeper into funding deserts, explore place-level data, or see how power
            concentrates across the system.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/places"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Place Packs
            </a>
            <a
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Power Concentration
            </a>
            <a
              href="/api/data/funding-deserts"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Raw Data API
            </a>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="funding-deserts" reportTitle="Funding Deserts Geographic Analysis" />
    </div>
  );
}
