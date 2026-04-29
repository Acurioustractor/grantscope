import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Executive Remuneration vs Service Delivery | CivicGraph Investigation',
  description:
    'How much do charities pay their executives vs how much they deliver in services? ACNC annual information statements cross-referenced with CivicGraph entity data.',
  openGraph: {
    title: 'Executive Pay vs Service Delivery',
    description:
      'ACNC executive remuneration data analysed across charity sizes and community-controlled organisations.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Executive Pay vs Service Delivery',
    description:
      'ACNC executive remuneration data analysed across charity sizes and community-controlled organisations.',
  },
};

/* ---------- helpers ---------- */

function money(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function fmt(n: number): string {
  return n.toLocaleString();
}
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/* ---------- types ---------- */

interface AisRecord {
  abn: string;
  charity_name: string;
  charity_size: string;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  staff_fte: number;
  staff_volunteers: number;
  total_paid_key_management: number;
  num_key_management_personnel: number;
  revenue_from_government: number;
}

interface SizeRow {
  size: string;
  count: number;
  avgExecPay: number;
  avgOverhead: number;
  avgFte: number;
}

interface AccoComparison {
  label: string;
  acco: {
    count: number;
    avgExecPay: number;
    avgOverhead: number;
    avgGovDependency: number;
    avgFte: number;
  };
  mainstream: {
    count: number;
    avgExecPay: number;
    avgOverhead: number;
    avgGovDependency: number;
    avgFte: number;
  };
}

interface TopRow extends AisRecord {
  overheadPct: number;
  isAcco: boolean;
}

interface GovFundedRow extends TopRow {
  govGrants: number;
}

/* ---------- data fetching ---------- */

async function getData() {
  const db = getServiceSupabase();

  // Query 1: ACNC AIS data for 2023 with exec pay (paginated)
  const aisData = await safe(async () => {
    const all: AisRecord[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('acnc_ais')
        .select('abn, charity_name, charity_size, total_revenue, total_expenses, employee_expenses, staff_fte, staff_volunteers, total_paid_key_management, num_key_management_personnel, revenue_from_government')
        .eq('ais_year', 2023)
        .eq('has_key_management_personnel', true)
        .gt('total_paid_key_management', 0)
        .order('total_paid_key_management', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...(data as AisRecord[]));
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [] as AisRecord[]);

  // Query 2: Community-controlled ABNs
  const accoAbns = await safe(async () => {
    const all: { abn: string }[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('gs_entities')
        .select('abn')
        .eq('is_community_controlled', true)
        .not('abn', 'is', null)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...(data as { abn: string }[]));
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return new Set(all.map((r) => r.abn));
  }, new Set<string>());

  // Normalise numbers
  const records: (AisRecord & { isAcco: boolean })[] = aisData.map((r) => ({
    ...r,
    total_revenue: Number(r.total_revenue) || 0,
    total_expenses: Number(r.total_expenses) || 0,
    employee_expenses: Number(r.employee_expenses) || 0,
    staff_fte: Number(r.staff_fte) || 0,
    staff_volunteers: Number(r.staff_volunteers) || 0,
    total_paid_key_management: Number(r.total_paid_key_management) || 0,
    num_key_management_personnel: Number(r.num_key_management_personnel) || 0,
    revenue_from_government: Number(r.revenue_from_government) || 0,
    isAcco: accoAbns.has(r.abn),
  }));

  /* ---- Key stats ---- */
  const totalCharities = records.length;
  const totalExecPay = records.reduce((s, r) => s + r.total_paid_key_management, 0);
  const avgExecPay = totalCharities > 0 ? totalExecPay / totalCharities : 0;
  const overheads = records
    .filter((r) => r.total_expenses > 0)
    .map((r) => (r.total_paid_key_management / r.total_expenses) * 100);
  const avgOverhead = overheads.length > 0 ? overheads.reduce((s, v) => s + v, 0) / overheads.length : 0;

  /* ---- Size breakdown ---- */
  const sizeGroups = new Map<string, AisRecord[]>();
  for (const r of records) {
    const size = r.charity_size || 'Unknown';
    if (!sizeGroups.has(size)) sizeGroups.set(size, []);
    sizeGroups.get(size)!.push(r);
  }
  const sizeOrder = ['Large', 'Medium', 'Small', 'Unknown'];
  const sizeRows: SizeRow[] = sizeOrder
    .filter((s) => sizeGroups.has(s))
    .map((size) => {
      const group = sizeGroups.get(size)!;
      const withExpenses = group.filter((r) => r.total_expenses > 0);
      return {
        size,
        count: group.length,
        avgExecPay: group.reduce((s, r) => s + r.total_paid_key_management, 0) / group.length,
        avgOverhead:
          withExpenses.length > 0
            ? withExpenses
                .map((r) => (r.total_paid_key_management / r.total_expenses) * 100)
                .reduce((s, v) => s + v, 0) / withExpenses.length
            : 0,
        avgFte: group.reduce((s, r) => s + r.staff_fte, 0) / group.length,
      };
    });

  /* ---- ACCO vs Mainstream comparison ---- */
  function buildComparison(label: string, subset: (AisRecord & { isAcco: boolean })[]) {
    const acco = subset.filter((r) => r.isAcco);
    const mainstream = subset.filter((r) => !r.isAcco);

    function stats(group: (AisRecord & { isAcco: boolean })[]) {
      if (group.length === 0)
        return { count: 0, avgExecPay: 0, avgOverhead: 0, avgGovDependency: 0, avgFte: 0 };
      const withExpenses = group.filter((r) => r.total_expenses > 0);
      const withRevenue = group.filter((r) => r.total_revenue > 0);
      return {
        count: group.length,
        avgExecPay: group.reduce((s, r) => s + r.total_paid_key_management, 0) / group.length,
        avgOverhead:
          withExpenses.length > 0
            ? withExpenses
                .map((r) => (r.total_paid_key_management / r.total_expenses) * 100)
                .reduce((s, v) => s + v, 0) / withExpenses.length
            : 0,
        avgGovDependency:
          withRevenue.length > 0
            ? withRevenue
                .map((r) => (r.revenue_from_government / r.total_revenue) * 100)
                .reduce((s, v) => s + v, 0) / withRevenue.length
            : 0,
        avgFte: group.reduce((s, r) => s + r.staff_fte, 0) / group.length,
      };
    }

    return { label, acco: stats(acco), mainstream: stats(mainstream) };
  }

  const accoComparisons: AccoComparison[] = [
    buildComparison('All sizes', records),
    ...sizeOrder
      .filter((s) => s !== 'Unknown' && sizeGroups.has(s))
      .map((size) => {
        const group = records.filter((r) => (r.charity_size || 'Unknown') === size);
        return buildComparison(size, group);
      }),
  ];

  /* ---- Top 20 by exec pay ---- */
  const top20Pay: TopRow[] = records.slice(0, 20).map((r) => ({
    ...r,
    overheadPct: r.total_expenses > 0 ? (r.total_paid_key_management / r.total_expenses) * 100 : 0,
    isAcco: r.isAcco,
  }));

  /* ---- Top 20 by overhead % ---- */
  const top20Overhead: TopRow[] = records
    .filter((r) => r.total_expenses > 1_000_000)
    .map((r) => ({
      ...r,
      overheadPct: r.total_expenses > 0 ? (r.total_paid_key_management / r.total_expenses) * 100 : 0,
      isAcco: r.isAcco,
    }))
    .sort((a, b) => b.overheadPct - a.overheadPct)
    .slice(0, 20);

  /* ---- Government-funded with highest exec pay ---- */
  const govFunded: GovFundedRow[] = records
    .filter((r) => r.revenue_from_government > 5_000_000)
    .map((r) => ({
      ...r,
      overheadPct: r.total_expenses > 0 ? (r.total_paid_key_management / r.total_expenses) * 100 : 0,
      isAcco: r.isAcco,
      govGrants: r.revenue_from_government,
    }))
    .sort((a, b) => b.total_paid_key_management - a.total_paid_key_management)
    .slice(0, 20);

  return {
    totalCharities,
    avgExecPay,
    totalExecPay,
    avgOverhead,
    sizeRows,
    accoComparisons,
    top20Pay,
    top20Overhead,
    govFunded,
  };
}

/* ---------- page ---------- */

export default async function ExecRemunerationReport() {
  const {
    totalCharities,
    avgExecPay,
    totalExecPay,
    avgOverhead,
    sizeRows,
    accoComparisons,
    top20Pay,
    top20Overhead,
    govFunded,
  } = await getData();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a
          href="/reports"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">
          Cross-Dataset Investigation
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Executive Pay vs Service Delivery
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How much do Australian charities pay their executives &mdash; and how does that compare
          to what they deliver? We analysed {fmt(totalCharities)} charities reporting executive
          remuneration in their 2023 ACNC Annual Information Statements, cross-referenced with
          CivicGraph entity data to compare community-controlled organisations against mainstream
          charities.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated{' '}
          {new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Section 1: Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Charities Reporting
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(totalCharities)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">with exec pay data (2023)</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Avg Exec Pay
            </div>
            <div className="text-3xl sm:text-4xl font-black">{money(avgExecPay)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">per charity</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Total Exec Compensation
            </div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">
              {money(totalExecPay)}
            </div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">across the sector</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">
              Avg Exec Overhead
            </div>
            <div className="text-3xl sm:text-4xl font-black">{pct(avgOverhead)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">of total expenses</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC Annual Information Statements (2023). Charities reporting key management
            personnel remuneration &gt; $0.
          </p>
        </div>
      </section>

      {/* Section 2: Size comparison */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          By Charity Size
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Executive remuneration broken down by ACNC charity size classification. Larger charities
          pay significantly more in executive compensation, but their overhead percentage tells a
          different story.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Size</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Charities
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Avg Exec Pay
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Avg Overhead %
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                  Avg Staff FTE
                </th>
              </tr>
            </thead>
            <tbody>
              {sizeRows.map((row, i) => (
                <tr key={row.size} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">{row.size}</td>
                  <td className="p-3 text-right font-mono">{fmt(row.count)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">
                    {money(row.avgExecPay)}
                  </td>
                  <td className="p-3 text-right font-mono">{pct(row.avgOverhead)}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">
                    {row.avgFte.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: ACCO vs Mainstream */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Community-Controlled vs Mainstream
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Aboriginal Community-Controlled Organisations (ACCOs) compared with mainstream charities.
          How does executive pay, overhead, and government dependency differ between
          community-controlled and mainstream organisations?
        </p>
        {accoComparisons.map((comp) => (
          <div key={comp.label} className="mb-6">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">
              {comp.label}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* ACCO side */}
              <div className="border-4 border-bauhaus-black p-6 bg-amber-50">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                    ACCO
                  </span>
                  <span className="text-xs text-bauhaus-muted font-bold">
                    {fmt(comp.acco.count)} organisations
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                      Avg Exec Pay
                    </div>
                    <div className="text-2xl font-black text-bauhaus-red">
                      {money(comp.acco.avgExecPay)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Overhead
                      </div>
                      <div className="text-sm font-black">{pct(comp.acco.avgOverhead)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Gov Dependency
                      </div>
                      <div className="text-sm font-black">{pct(comp.acco.avgGovDependency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Avg FTE
                      </div>
                      <div className="text-sm font-black">{comp.acco.avgFte.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Mainstream side */}
              <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-gray-50">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block px-2 py-0.5 text-xs font-black bg-gray-100 text-gray-600 border border-gray-300 uppercase tracking-widest">
                    Mainstream
                  </span>
                  <span className="text-xs text-bauhaus-muted font-bold">
                    {fmt(comp.mainstream.count)} organisations
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                      Avg Exec Pay
                    </div>
                    <div className="text-2xl font-black text-bauhaus-red">
                      {money(comp.mainstream.avgExecPay)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Overhead
                      </div>
                      <div className="text-sm font-black">{pct(comp.mainstream.avgOverhead)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Gov Dependency
                      </div>
                      <div className="text-sm font-black">
                        {pct(comp.mainstream.avgGovDependency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                        Avg FTE
                      </div>
                      <div className="text-sm font-black">
                        {comp.mainstream.avgFte.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <ReportCTA
        reportSlug="exec-remuneration"
        reportTitle="Executive Remuneration Report"
        variant="inline"
      />

      {/* Section 4: Top 20 highest exec pay */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 20: Highest Executive Pay
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 charities reporting the highest total key management personnel remuneration in
          2023.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                  #
                </th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                  Charity
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Exec Pay
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                  Revenue
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                  Overhead %
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden lg:table-cell">
                  Staff FTE
                </th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {top20Pay.map((r, i) => (
                <tr key={r.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link
                      href={`/org/${slugify(r.charity_name)}`}
                      className="hover:text-bauhaus-red transition-colors"
                    >
                      <div className="font-bold text-bauhaus-black">{r.charity_name}</div>
                      <div className="text-xs text-bauhaus-muted">{r.charity_size}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                    {money(r.total_paid_key_management)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                    {money(r.total_revenue)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {pct(r.overheadPct)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden lg:table-cell">
                    {r.staff_fte > 0 ? fmt(Math.round(r.staff_fte)) : '\u2014'}
                  </td>
                  <td className="p-3 text-center">
                    {r.isAcco ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                        ACCO
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest">
                        Mainstream
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Top 20 highest overhead % */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 20: Highest Executive Overhead
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Charities where executive pay represents the largest share of total expenses. Filtered to
          organisations with over $1M in total expenses to exclude outliers.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                  #
                </th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                  Charity
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Overhead %
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                  Exec Pay
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                  Revenue
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden lg:table-cell">
                  Staff FTE
                </th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {top20Overhead.map((r, i) => (
                <tr key={r.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link
                      href={`/org/${slugify(r.charity_name)}`}
                      className="hover:text-bauhaus-red transition-colors"
                    >
                      <div className="font-bold text-bauhaus-black">{r.charity_name}</div>
                      <div className="text-xs text-bauhaus-muted">{r.charity_size}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                    {pct(r.overheadPct)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                    {money(r.total_paid_key_management)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {money(r.total_revenue)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden lg:table-cell">
                    {r.staff_fte > 0 ? fmt(Math.round(r.staff_fte)) : '\u2014'}
                  </td>
                  <td className="p-3 text-center">
                    {r.isAcco ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                        ACCO
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest">
                        Mainstream
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 6: Government-funded with highest exec pay */}
      {govFunded.length > 0 && (
        <section className="mb-12">
          <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
            <h2 className="text-lg font-black mb-2 text-bauhaus-yellow uppercase tracking-widest">
              Government-Funded: Highest Exec Pay
            </h2>
            <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
              Charities receiving over $5M in government grants that also report the highest
              executive remuneration. These organisations are substantially taxpayer-funded &mdash;
              how much goes to the top?
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest w-8">
                      #
                    </th>
                    <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">
                      Charity
                    </th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">
                      Exec Pay
                    </th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden sm:table-cell">
                      Gov Grants
                    </th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden md:table-cell">
                      Revenue
                    </th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden lg:table-cell">
                      Overhead %
                    </th>
                    <th className="text-center p-2 text-xs font-black text-white/50 uppercase tracking-widest">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {govFunded.map((r, i) => (
                    <tr key={r.abn} className="border-b border-white/10">
                      <td className="p-2 font-black text-white/40">{i + 1}</td>
                      <td className="p-2">
                        <Link
                          href={`/org/${slugify(r.charity_name)}`}
                          className="hover:text-bauhaus-yellow transition-colors"
                        >
                          <div className="font-bold text-white">{r.charity_name}</div>
                          <div className="text-xs text-white/50">{r.charity_size}</div>
                        </Link>
                      </td>
                      <td className="p-2 text-right font-mono font-black text-bauhaus-yellow whitespace-nowrap">
                        {money(r.total_paid_key_management)}
                      </td>
                      <td className="p-2 text-right font-mono text-white/70 whitespace-nowrap hidden sm:table-cell">
                        {money(r.govGrants)}
                      </td>
                      <td className="p-2 text-right font-mono text-white/70 whitespace-nowrap hidden md:table-cell">
                        {money(r.total_revenue)}
                      </td>
                      <td className="p-2 text-right font-mono text-white/70 whitespace-nowrap hidden lg:table-cell">
                        {pct(r.overheadPct)}
                      </td>
                      <td className="p-2 text-center">
                        {r.isAcco ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                            ACCO
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-gray-800 text-gray-400 uppercase tracking-widest">
                            Mainstream
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">
            Methodology
          </h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Data source:</strong> ACNC Annual Information Statements (AIS) for the 2023
              reporting year. Only charities that reported having key management personnel and
              disclosed remuneration greater than $0 are included.
            </p>
            <p>
              <strong>Executive overhead:</strong> Calculated as total paid to key management
              personnel divided by total expenses. This includes all forms of remuneration
              (salary, superannuation, bonuses, allowances) for key management personnel as
              defined by ACNC reporting requirements.
            </p>
            <p>
              <strong>Community-controlled identification:</strong> Organisations are classified
              as Aboriginal Community-Controlled Organisations (ACCOs) based on CivicGraph&apos;s
              entity classification system, which draws on ORIC registration, ACNC purposes,
              self-identification, and governance structure data.
            </p>
            <p>
              <strong>Government dependency:</strong> Calculated as government grants (Australian)
              as a proportion of total revenue. This only captures grants reported in the AIS and
              may not include all government funding sources (e.g., fee-for-service contracts).
            </p>
            <p>
              <strong>Limitations:</strong> The AIS is self-reported and may contain
              inconsistencies. Not all charities report key management personnel remuneration.
              Charity size classifications (Small/Medium/Large) are determined by the ACNC based
              on revenue thresholds. Some charities may operate under multiple ABNs, and
              related-party transactions between entities are not captured in this analysis.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">
            Explore the Full Dataset
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Search charities by ABN, explore their governance, funding sources, and executive
            remuneration across all CivicGraph datasets.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/entities"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Entity Search
            </Link>
            <Link
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Power Index
            </Link>
            <Link
              href="/reports/tax-transparency"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Tax Transparency
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA
        reportSlug="exec-remuneration"
        reportTitle="Executive Remuneration Report"
      />
    </div>
  );
}
