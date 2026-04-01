import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { ReportCTA } from '../_components/report-cta';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The $29 Billion Question | CivicGraph Research Funding',
  description:
    'Australia\'s 46,000 ARC and NHMRC research grants worth $29.2 billion. Who gets funded, where, and by whom.',
  openGraph: {
    title: 'The $29 Billion Question',
    description:
      'Australia\'s research funding landscape: 34K ARC grants ($18.5B) + 12K NHMRC grants ($10.7B). Every dollar, every institution.',
    type: 'article',
    siteName: 'CivicGraph',
  },
};

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

type Institution = {
  admin_organisation: string;
  total: number;
  cnt: number;
  gs_id: string | null;
};

type SchemeRow = {
  scheme_name: string;
  source: string;
  cnt: number;
  total: number;
};

type HeroStats = {
  arc_total: number;
  arc_count: number;
  nhmrc_total: number;
  nhmrc_count: number;
};

type TopInvestigator = {
  lead_investigator: string;
  cnt: number;
  total: number;
};

async function getData() {
  const supabase = getServiceSupabase();

  function safe<T>(result: { data: T | null; error: unknown }): T | null {
    return result.error ? null : result.data;
  }

  const [heroResult, institutionsResult, schemesResult, investigatorsResult] =
    await Promise.all([
      supabase.rpc('exec_sql', {
        query: `SELECT
          SUM(CASE WHEN source = 'arc' THEN COALESCE(funding_amount, announced_amount) ELSE 0 END) AS arc_total,
          COUNT(CASE WHEN source = 'arc' THEN 1 END) AS arc_count,
          SUM(CASE WHEN source = 'nhmrc' THEN COALESCE(funding_amount, announced_amount) ELSE 0 END) AS nhmrc_total,
          COUNT(CASE WHEN source = 'nhmrc' THEN 1 END) AS nhmrc_count
        FROM research_grants`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT
          rg.admin_organisation,
          SUM(COALESCE(rg.funding_amount, rg.announced_amount)) AS total,
          COUNT(*) AS cnt,
          e.gs_id
        FROM research_grants rg
        LEFT JOIN gs_entities e ON e.id = rg.gs_entity_id
        WHERE rg.admin_organisation IS NOT NULL
          AND rg.admin_organisation != ''
        GROUP BY rg.admin_organisation, e.gs_id
        ORDER BY total DESC NULLS LAST
        LIMIT 30`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT
          scheme_name,
          source,
          COUNT(*) AS cnt,
          SUM(COALESCE(funding_amount, announced_amount)) AS total
        FROM research_grants
        WHERE scheme_name IS NOT NULL AND scheme_name != ''
        GROUP BY scheme_name, source
        ORDER BY total DESC NULLS LAST
        LIMIT 20`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT
          lead_investigator,
          COUNT(*) AS cnt,
          SUM(COALESCE(funding_amount, announced_amount)) AS total
        FROM research_grants
        WHERE lead_investigator IS NOT NULL AND lead_investigator != ''
        GROUP BY lead_investigator
        ORDER BY total DESC NULLS LAST
        LIMIT 15`,
      }),
    ]);

  const heroRows = safe(heroResult) as HeroStats[] | null;
  const hero = heroRows?.[0] ?? null;

  return {
    hero,
    institutions: (safe(institutionsResult) as Institution[] | null) ?? [],
    schemes: (safe(schemesResult) as SchemeRow[] | null) ?? [],
    investigators: (safe(investigatorsResult) as TopInvestigator[] | null) ?? [],
  };
}

export default async function ResearchFundingPage() {
  const { hero, institutions, schemes, investigators } = await getData();

  const arcTotal = Number(hero?.arc_total ?? 0);
  const nhmrcTotal = Number(hero?.nhmrc_total ?? 0);
  const grandTotal = arcTotal + nhmrcTotal;
  const arcCount = Number(hero?.arc_count ?? 0);
  const nhmrcCount = Number(hero?.nhmrc_count ?? 0);
  const totalCount = arcCount + nhmrcCount;

  const arcSchemes = schemes.filter((s) => s.source === 'arc');
  const nhmrcSchemes = schemes.filter((s) => s.source === 'nhmrc');

  // Max for bar scaling
  const maxInstitutionTotal = institutions.length > 0 ? Number(institutions[0].total) : 1;

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow border border-bauhaus-yellow px-2 py-1">
              Research Intelligence
            </span>
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tight mb-4 font-satoshi">
            The $29 Billion Question
          </h1>
          <p className="text-lg text-[#B0B0B0] max-w-2xl mb-12">
            Australia&apos;s national research grants: {fmt(totalCount)} funded projects across
            ARC and NHMRC. Every university, every scheme, every dollar — mapped.
          </p>

          {/* Hero stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-2 border-[#333333]">
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-white mb-1">
                {money(grandTotal)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Total Research Funding
              </div>
            </div>
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-blue mb-1">
                {money(arcTotal)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                ARC — {fmt(arcCount)} Grants
              </div>
            </div>
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-red mb-1">
                {money(nhmrcTotal)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                NHMRC — {fmt(nhmrcCount)} Grants
              </div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-yellow mb-1">
                {money(grandTotal / totalCount)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Avg Grant Size
              </div>
            </div>
          </div>

          {/* ARC vs NHMRC split bar */}
          <div className="mt-8">
            <div className="flex gap-4 mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">
                ARC {((arcTotal / grandTotal) * 100).toFixed(0)}%
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
                NHMRC {((nhmrcTotal / grandTotal) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex h-3 border-2 border-[#333333]">
              <div
                className="bg-bauhaus-blue"
                style={{ width: `${(arcTotal / grandTotal) * 100}%` }}
              />
              <div className="flex-1 bg-bauhaus-red" />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ── Top Institutions ───────────────────────────────── */}
        <section>
          <div className="border-b-4 border-bauhaus-black mb-8 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight font-satoshi">
              Top Institutions by Funding
            </h2>
            <p className="text-sm text-[#555555] mt-1">
              Ranked by total ARC + NHMRC funding received
            </p>
          </div>

          <div className="border-4 border-bauhaus-black" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="bg-bauhaus-black text-white grid grid-cols-12 px-4 py-2">
              <div className="col-span-5 text-xs font-black uppercase tracking-widest">Institution</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Grants</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Total Funding</div>
              <div className="col-span-3 text-xs font-black uppercase tracking-widest text-right">Share</div>
            </div>
            {institutions.slice(0, 20).map((inst, i) => {
              const total = Number(inst.total);
              const pct = maxInstitutionTotal > 0 ? (total / maxInstitutionTotal) * 100 : 0;
              return (
                <div
                  key={inst.admin_organisation}
                  className={`grid grid-cols-12 px-4 py-3 items-center border-b border-[#E8E8E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}`}
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <span className="text-xs font-black text-[#B0B0B0] w-5 shrink-0">{i + 1}</span>
                    {inst.gs_id ? (
                      <Link
                        href={`/entity/${inst.gs_id}`}
                        className="text-sm font-medium text-bauhaus-blue hover:underline leading-tight"
                      >
                        {inst.admin_organisation}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-bauhaus-black leading-tight">
                        {inst.admin_organisation}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-right tabular-nums text-[#555555]">
                    {fmt(Number(inst.cnt))}
                  </div>
                  <div className="col-span-2 text-sm font-bold text-right tabular-nums">
                    {money(total)}
                  </div>
                  <div className="col-span-3 flex items-center gap-2 justify-end">
                    <div className="w-20 h-2 bg-[#E8E8E8] border border-[#D0D0D0]">
                      <div
                        className="h-full bg-bauhaus-blue"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#777777] w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── By Scheme/Program ─────────────────────────────── */}
        <section>
          <div className="border-b-4 border-bauhaus-black mb-8 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight font-satoshi">
              By Funding Scheme
            </h2>
            <p className="text-sm text-[#555555] mt-1">
              ARC and NHMRC programs ranked by total awarded
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* ARC Schemes */}
            <div className="border-4 border-bauhaus-blue" style={{ boxShadow: '6px 6px 0px 0px #1040C0' }}>
              <div className="bg-bauhaus-blue text-white px-4 py-3">
                <span className="text-xs font-black uppercase tracking-widest">ARC — Australian Research Council</span>
              </div>
              <div className="divide-y divide-[#E8E8E8]">
                {arcSchemes.slice(0, 10).map((s) => (
                  <div key={s.scheme_name} className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-bauhaus-black truncate">{s.scheme_name}</div>
                      <div className="text-xs text-[#777777]">{fmt(Number(s.cnt))} grants</div>
                    </div>
                    <div className="text-sm font-black tabular-nums text-bauhaus-blue shrink-0">
                      {money(Number(s.total))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NHMRC Schemes */}
            <div className="border-4 border-bauhaus-red" style={{ boxShadow: '6px 6px 0px 0px #D02020' }}>
              <div className="bg-bauhaus-red text-white px-4 py-3">
                <span className="text-xs font-black uppercase tracking-widest">NHMRC — Health &amp; Medical Research</span>
              </div>
              <div className="divide-y divide-[#E8E8E8]">
                {nhmrcSchemes.slice(0, 10).map((s) => (
                  <div key={s.scheme_name} className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-bauhaus-black truncate">{s.scheme_name}</div>
                      <div className="text-xs text-[#777777]">{fmt(Number(s.cnt))} grants</div>
                    </div>
                    <div className="text-sm font-black tabular-nums text-bauhaus-red shrink-0">
                      {money(Number(s.total))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Top Investigators ─────────────────────────────── */}
        <section>
          <div className="border-b-4 border-bauhaus-black mb-8 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight font-satoshi">
              Top Lead Investigators
            </h2>
            <p className="text-sm text-[#555555] mt-1">
              Researchers with the highest cumulative awarded funding
            </p>
          </div>

          <div className="border-4 border-bauhaus-black" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="bg-bauhaus-black text-white grid grid-cols-12 px-4 py-2">
              <div className="col-span-6 text-xs font-black uppercase tracking-widest">Investigator</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Grants</div>
              <div className="col-span-4 text-xs font-black uppercase tracking-widest text-right">Total Funding</div>
            </div>
            {investigators.map((inv, i) => (
              <div
                key={inv.lead_investigator}
                className={`grid grid-cols-12 px-4 py-3 border-b border-[#E8E8E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}`}
              >
                <div className="col-span-6 flex items-center gap-3">
                  <span className="text-xs font-black text-[#B0B0B0] w-5 shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium">{inv.lead_investigator}</span>
                </div>
                <div className="col-span-2 text-sm text-right tabular-nums text-[#555555]">
                  {fmt(Number(inv.cnt))}
                </div>
                <div className="col-span-4 text-sm font-black text-right tabular-nums text-bauhaus-black">
                  {money(Number(inv.total))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Explore ───────────────────────────────────────── */}
        <section>
          <div className="border-4 border-bauhaus-yellow bg-[#FFF8E0] p-6" style={{ boxShadow: '6px 6px 0px 0px #F0C020' }}>
            <h3 className="text-lg font-black uppercase tracking-tight mb-3 font-satoshi">
              Explore Research Entities
            </h3>
            <p className="text-sm text-[#555555] mb-4">
              Every funded institution is cross-referenced with CivicGraph&apos;s entity database.
              Search for universities, research institutes, and hospitals to see their full funding footprint.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/charities?q=university"
                className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-[#333333] transition-colors"
              >
                Search Universities →
              </Link>
              <Link
                href="/charities?q=research"
                className="px-4 py-2 bg-white text-bauhaus-black text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-[#F0F0F0] transition-colors"
              >
                Search Research Institutes →
              </Link>
            </div>
          </div>
        </section>

        <ReportCTA reportSlug="research-funding" reportTitle="The $29 Billion Question" />
      </div>
    </div>
  );
}
