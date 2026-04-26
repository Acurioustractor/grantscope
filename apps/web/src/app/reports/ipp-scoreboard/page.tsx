import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { ReportEmailCapture } from '@/components/report-email-capture';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Indigenous Procurement Policy Scoreboard — CivicGraph',
  description:
    'Federal and state government agencies ranked by Indigenous Procurement Policy performance. Many spend hundreds of millions in contracts with zero Indigenous suppliers. The 3% IPP target was set in 2015 — most agencies still miss it.',
  openGraph: {
    title: 'Federal Agencies Failing IPP Targets',
    description:
      'Agencies ranked by Indigenous Procurement Policy performance. Many at 0% Indigenous spend with hundreds of millions in contract value.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: { card: 'summary_large_image', title: 'IPP Scoreboard — agencies failing the 3% target' },
};

function money(n: number | null | undefined): string {
  if (n == null || n === 0) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type AgencyRow = {
  agency: string;
  year: number;
  total_contracts: number;
  total_value: number;
  indigenous_contracts: number;
  indigenous_value: number;
  indigenous_share_pct: number;
  ipp_status: string;
};

type YearSummary = {
  year: number;
  agencies: number;
  meeting_target: number;
  total_spend: number;
  indigenous_spend: number;
  share_pct: number;
};

const TARGET_YEAR = 2025;

async function getData() {
  const db = getServiceSupabase();

  const [{ data: latestData }, { data: yearData }, { data: bestData }] = await Promise.all([
    db.from('mv_indigenous_procurement_score')
      .select('agency, year, total_contracts, total_value, indigenous_contracts, indigenous_value, indigenous_share_pct, ipp_status')
      .eq('year', TARGET_YEAR)
      .gte('total_value', 50_000_000)
      .order('total_value', { ascending: false })
      .limit(50),
    db.rpc('exec_sql', {
      query: `
        SELECT year, COUNT(*) as agencies,
               COUNT(*) FILTER (WHERE ipp_status = 'meets_ipp_target') as meeting_target,
               SUM(total_value)::bigint as total_spend,
               SUM(indigenous_value)::bigint as indigenous_spend,
               CASE WHEN SUM(total_value) > 0
                 THEN ROUND((SUM(indigenous_value)::numeric / SUM(total_value)::numeric) * 100, 2)
                 ELSE 0 END as share_pct
          FROM mv_indigenous_procurement_score
         WHERE year BETWEEN 2019 AND 2025
         GROUP BY year ORDER BY year DESC`,
    }),
    db.from('mv_indigenous_procurement_score')
      .select('agency, year, total_value, indigenous_value, indigenous_share_pct')
      .eq('year', TARGET_YEAR)
      .gte('total_value', 10_000_000)
      .order('indigenous_share_pct', { ascending: false })
      .limit(15),
  ]);

  const latest = (latestData ?? []) as AgencyRow[];
  const years = (yearData ?? []) as YearSummary[];
  const best = (bestData ?? []) as AgencyRow[];

  // Worst-offender ranking — agencies with $50M+ at 0% Indigenous spend
  const zeroIndigenous = latest.filter((a) => a.indigenous_value === 0);
  const lowIndigenous = latest.filter((a) => a.indigenous_value > 0 && a.indigenous_share_pct < 3);
  const meetingTarget = latest.filter((a) => a.indigenous_share_pct >= 3);

  return {
    latest,
    years,
    best,
    zeroIndigenous,
    lowIndigenous,
    meetingTarget,
    targetYear: TARGET_YEAR,
  };
}

export default async function IppScoreboardPage() {
  const data = await getData();
  const currentYear = data.years[0];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; All Reports
      </Link>

      {/* Hero */}
      <div className="mt-6 mb-8">
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-[0.25em] mb-1">
          Procurement Investigation
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The IPP Scoreboard: Agencies Failing the 3% Target
        </h1>
        <p className="text-lg text-bauhaus-muted leading-relaxed max-w-3xl">
          The Indigenous Procurement Policy was set in 2015 with a 3% target for
          contracts to Indigenous-led businesses. <strong className="text-bauhaus-red">
            In {data.targetYear}, only {currentYear?.meeting_target} of {currentYear?.agencies} federal+state agencies met that target
          </strong>. National share: {currentYear?.share_pct}%. Many agencies sit on hundreds of millions in
          contracts at 0% Indigenous spend.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10 border-4 border-bauhaus-black">
        <div className="p-5 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(currentYear?.total_spend)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Total {data.targetYear} contracts</div>
        </div>
        <div className="p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-red">{currentYear?.share_pct}%</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Indigenous share (target: 3%)</div>
        </div>
        <div className="p-5 border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{currentYear?.meeting_target}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Agencies meeting 3% target</div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-black text-bauhaus-red">{data.zeroIndigenous.length}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">$50M+ agencies at 0% Indigenous</div>
        </div>
      </div>

      {/* Year-over-year trend */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Year-Over-Year Trend
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Year</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Indigenous</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Share</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Meeting Target</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Agencies</th>
              </tr>
            </thead>
            <tbody>
              {data.years.map((y, i) => (
                <tr key={y.year} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                  <td className="px-4 py-3 font-mono font-bold">{y.year}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{money(y.total_spend)}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(y.indigenous_spend)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={Number(y.share_pct) >= 3 ? 'text-emerald-700 font-bold' : 'text-bauhaus-red'}>{y.share_pct}%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{y.meeting_target} / {y.agencies}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{y.agencies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Worst offenders — 0% indigenous */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red p-6 bg-red-50 mb-6">
          <h2 className="text-xl font-black uppercase tracking-widest mb-2">
            $50M+ agencies with 0% Indigenous spend ({data.targetYear})
          </h2>
          <p className="text-sm text-bauhaus-black">
            These agencies awarded $50M or more in contracts in {data.targetYear} but zero of those
            contracts went to Indigenous-led suppliers. Each name + dollar figure is one investigative
            story.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Agency</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Value</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Indigenous</th>
              </tr>
            </thead>
            <tbody>
              {data.zeroIndigenous.slice(0, 20).map((r, i) => (
                <tr key={r.agency} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                  <td className="px-4 py-3 font-medium text-bauhaus-black max-w-md">{r.agency}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.total_contracts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{money(r.total_value)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">$0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Below 3% but non-zero */}
      {data.lowIndigenous.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Agencies with some Indigenous spend, still below 3%
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Agency</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Indigenous</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.lowIndigenous.slice(0, 20).map((r, i) => (
                  <tr key={r.agency} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                    <td className="px-4 py-3 font-medium text-bauhaus-black max-w-md">{r.agency}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{money(r.total_value)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-red">{money(r.indigenous_value)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">{r.indigenous_share_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Best performers */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Best performers (≥3% Indigenous share)
        </h2>
        {data.best.filter(b => b.indigenous_share_pct >= 3).length === 0 ? (
          <p className="text-sm text-bauhaus-muted">No agencies hitting 3% in the &gt;$10M tier this year.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Agency</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Indigenous</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.best.filter(b => b.indigenous_share_pct >= 3).slice(0, 15).map((r, i) => (
                  <tr key={r.agency} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                    <td className="px-4 py-3 font-medium text-bauhaus-black max-w-md">{r.agency}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(r.total_value)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">{money(r.indigenous_value)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{r.indigenous_share_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Email capture */}
      <ReportEmailCapture
        reportSlug="ipp-scoreboard"
        source="report-ipp-scoreboard"
        headline="Get the next investigation when it drops"
        description="The IPP Scoreboard is one of several cross-system investigations. Subscribe — Consulting Class follow-ups, board interlocks, and where philanthropic money actually flows."
      />

      {/* Methodology */}
      <section className="mb-8">
        <div className="bg-bauhaus-canvas p-4">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Methodology</h3>
          <ul className="text-xs text-bauhaus-muted space-y-1">
            <li><strong>Source:</strong> AusTender contracts (federal + state, 770K records) joined to <code>gs_entities</code> by supplier ABN.</li>
            <li><strong>Indigenous supplier:</strong> any of: <code>is_community_controlled</code>, <code>is_supply_nation_certified</code>, <code>entity_type=indigenous_corp</code>, or tagged <code>bbf-listed</code>. Combined coverage ~13,300 entities.</li>
            <li><strong>Target:</strong> The IPP target is 3% of contract value to Indigenous-led suppliers (federal Commonwealth Procurement Policy 2015; state targets vary).</li>
            <li><strong>Excluded:</strong> agencies with under $100K total spend per year (signal-to-noise).</li>
            <li><strong>Limitations:</strong> some Indigenous-led suppliers may not yet carry the flag in our graph; this UNDER-reports Indigenous share. The opposite direction (over-reporting) requires false certification, which is rare. The 3% target is a federal Commonwealth-level metric; individual agency targets may differ. State agencies appear here because most state procurement policies mirror or exceed the federal target.</li>
            <li><strong>Source MV:</strong> <code>mv_indigenous_procurement_score</code> (2,168 agency-year rows, 2019-2025).</li>
          </ul>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            This is a living investigation. All data is sourced from public AusTender records. Last updated: April 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
