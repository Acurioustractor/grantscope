import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Funding Deserts & Executive Overhead | CivicGraph Investigation',
  description:
    'Do disadvantaged areas get served by charities with higher executive overhead? LGA-level funding desert scores cross-referenced with ACNC executive remuneration data.',
  openGraph: {
    title: 'Funding Deserts & Executive Overhead',
    description:
      'Cross-referencing LGA-level disadvantage with charity executive pay across 1,582 Local Government Areas.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Funding Deserts & Executive Overhead',
    description:
      'Do the most disadvantaged areas get served by the most expensive charities?',
  },
};

/* ---------- helpers ---------- */

function money(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function fmt(n: number): string {
  return n.toLocaleString();
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/* ---------- types ---------- */

interface DesertRow {
  lga_name: string;
  lga_code: string;
  state: string;
  desert_score: number;
  seifa_decile: number;
  remoteness: string;
  total_funding: number;
  entity_count: number;
}

interface AisRecord {
  abn: string;
  charity_name: string;
  total_paid_key_management: number;
  total_expenses: number;
  total_revenue: number;
  revenue_from_government: number;
  staff_fte: number;
  charity_size: string;
}

interface EntityLga {
  abn: string;
  lga_code: string;
  is_community_controlled: boolean;
}

interface EnrichedCharity extends AisRecord {
  lga_code: string;
  lga_name: string;
  desert_score: number;
  seifa_decile: number;
  remoteness: string;
  overheadPct: number;
  isAcco: boolean;
}

interface RemoteStat {
  remoteness: string;
  count: number;
  avgExecPay: number;
  avgOverhead: number;
  avgRevenue: number;
}

interface DecileStat {
  decile: number;
  count: number;
  avgExecPay: number;
  avgOverhead: number;
}

interface DesertLgaStat {
  lga_name: string;
  state: string;
  desert_score: number;
  remoteness: string;
  charityCount: number;
  avgOverhead: number;
  totalFunding: number;
}

interface AccoDesertComparison {
  label: string;
  acco: { count: number; avgExecPay: number; avgOverhead: number; avgGovDep: number };
  mainstream: { count: number; avgExecPay: number; avgOverhead: number; avgGovDep: number };
}

/* ---------- data fetching ---------- */

async function getData() {
  const db = getServiceSupabase();

  // 1. Fetch mv_funding_deserts (paginated)
  const deserts = await safe(async () => {
    const all: DesertRow[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('mv_funding_deserts')
        .select('lga_name, lga_code, state, desert_score, avg_irsd_decile, remoteness, total_funding_all_sources, indexed_entities')
        .not('desert_score', 'is', null)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(
        ...data.map((r: Record<string, unknown>) => ({
          lga_name: String(r.lga_name || ''),
          lga_code: String(r.lga_code || ''),
          state: String(r.state || ''),
          desert_score: Number(r.desert_score) || 0,
          seifa_decile: Number(r.avg_irsd_decile) || 0,
          remoteness: String(r.remoteness || ''),
          total_funding: Number(r.total_funding_all_sources) || 0,
          entity_count: Number(r.indexed_entities) || 0,
        })),
      );
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [] as DesertRow[]);

  // 2. Fetch acnc_ais for 2023 with exec pay (paginated)
  const aisData = await safe(async () => {
    const all: AisRecord[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('acnc_ais')
        .select('abn, charity_name, total_paid_key_management, total_expenses, total_revenue, revenue_from_government, staff_fte, charity_size')
        .eq('ais_year', 2023)
        .gt('total_paid_key_management', 0)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(
        ...data.map((r: Record<string, unknown>) => ({
          abn: String(r.abn || ''),
          charity_name: String(r.charity_name || ''),
          total_paid_key_management: Number(r.total_paid_key_management) || 0,
          total_expenses: Number(r.total_expenses) || 0,
          total_revenue: Number(r.total_revenue) || 0,
          revenue_from_government: Number(r.revenue_from_government) || 0,
          staff_fte: Number(r.staff_fte) || 0,
          charity_size: String(r.charity_size || 'Unknown'),
        })),
      );
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [] as AisRecord[]);

  // 3. Fetch gs_entities with lga_code and abn via exec_sql
  const entityLgas = await safe(async () => {
    const { data, error } = await db.rpc('exec_sql', {
      query: `SELECT abn, lga_code, is_community_controlled FROM gs_entities WHERE abn IS NOT NULL AND lga_code IS NOT NULL`,
    });
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown>[]).map((r) => ({
      abn: String(r.abn),
      lga_code: String(r.lga_code),
      is_community_controlled: Boolean(r.is_community_controlled),
    }));
  }, [] as EntityLga[]);

  // Build lookup maps
  const desertByLga = new Map<string, DesertRow>();
  for (const d of deserts) {
    if (!desertByLga.has(d.lga_code) || d.desert_score > desertByLga.get(d.lga_code)!.desert_score) {
      desertByLga.set(d.lga_code, d);
    }
  }

  const entityByAbn = new Map<string, EntityLga>();
  const accoAbns = new Set<string>();
  for (const e of entityLgas) {
    if (!entityByAbn.has(e.abn)) entityByAbn.set(e.abn, e);
    if (e.is_community_controlled) accoAbns.add(e.abn);
  }

  // Join charities to LGAs
  const enriched: EnrichedCharity[] = [];
  for (const ais of aisData) {
    const entity = entityByAbn.get(ais.abn);
    if (!entity) continue;
    const desert = desertByLga.get(entity.lga_code);
    if (!desert) continue;
    enriched.push({
      ...ais,
      lga_code: entity.lga_code,
      lga_name: desert.lga_name,
      desert_score: desert.desert_score,
      seifa_decile: desert.seifa_decile,
      remoteness: desert.remoteness,
      overheadPct: ais.total_expenses > 0 ? (ais.total_paid_key_management / ais.total_expenses) * 100 : 0,
      isAcco: accoAbns.has(ais.abn),
    });
  }

  // Desert quartiles: Q1 = highest desert (most disadvantaged)
  const desertScores = enriched.map((c) => c.desert_score).sort((a, b) => a - b);
  const q25 = desertScores[Math.floor(desertScores.length * 0.25)] || 0;
  const q50 = desertScores[Math.floor(desertScores.length * 0.5)] || 0;
  const q75 = desertScores[Math.floor(desertScores.length * 0.75)] || 0;

  const desertCharities = enriched.filter((c) => c.desert_score > q50);
  const nonDesertCharities = enriched.filter((c) => c.desert_score <= q50);

  const desertLgaCount = deserts.filter((d) => d.desert_score > 0.5).length;

  // Key stats
  const avgOverheadDesert = desertCharities.length > 0
    ? desertCharities.reduce((s, c) => s + c.overheadPct, 0) / desertCharities.length
    : 0;
  const avgOverheadNonDesert = nonDesertCharities.length > 0
    ? nonDesertCharities.reduce((s, c) => s + c.overheadPct, 0) / nonDesertCharities.length
    : 0;

  // Remote vs metro exec pay
  const remoteCharities = enriched.filter((c) =>
    c.remoteness === 'Remote Australia' || c.remoteness === 'Very Remote Australia',
  );
  const metroCharities = enriched.filter((c) => c.remoteness === 'Major Cities of Australia');
  const avgPayRemote = remoteCharities.length > 0
    ? remoteCharities.reduce((s, c) => s + c.total_paid_key_management, 0) / remoteCharities.length
    : 0;
  const avgPayMetro = metroCharities.length > 0
    ? metroCharities.reduce((s, c) => s + c.total_paid_key_management, 0) / metroCharities.length
    : 0;

  // Section 3: By remoteness
  const remotenessGroups = new Map<string, EnrichedCharity[]>();
  for (const c of enriched) {
    const key = c.remoteness || 'Unknown';
    if (!remotenessGroups.has(key)) remotenessGroups.set(key, []);
    remotenessGroups.get(key)!.push(c);
  }
  const remotenessOrder = [
    'Very Remote Australia',
    'Remote Australia',
    'Outer Regional Australia',
    'Inner Regional Australia',
    'Major Cities of Australia',
  ];
  const byRemoteness: RemoteStat[] = remotenessOrder
    .filter((r) => remotenessGroups.has(r))
    .map((remoteness) => {
      const group = remotenessGroups.get(remoteness)!;
      return {
        remoteness,
        count: group.length,
        avgExecPay: group.reduce((s, c) => s + c.total_paid_key_management, 0) / group.length,
        avgOverhead: group.reduce((s, c) => s + c.overheadPct, 0) / group.length,
        avgRevenue: group.reduce((s, c) => s + c.total_revenue, 0) / group.length,
      };
    });

  // Section 4: By SEIFA decile
  const decileGroups = new Map<number, EnrichedCharity[]>();
  for (const c of enriched) {
    const d = Math.round(c.seifa_decile);
    if (d < 1 || d > 10) continue;
    if (!decileGroups.has(d)) decileGroups.set(d, []);
    decileGroups.get(d)!.push(c);
  }
  const byDecile: DecileStat[] = Array.from({ length: 10 }, (_, i) => i + 1)
    .filter((d) => decileGroups.has(d))
    .map((decile) => {
      const group = decileGroups.get(decile)!;
      return {
        decile,
        count: group.length,
        avgExecPay: group.reduce((s, c) => s + c.total_paid_key_management, 0) / group.length,
        avgOverhead: group.reduce((s, c) => s + c.overheadPct, 0) / group.length,
      };
    });

  // Section 5: Top desert LGAs with exec data
  const lgaCharities = new Map<string, EnrichedCharity[]>();
  for (const c of enriched) {
    if (!lgaCharities.has(c.lga_code)) lgaCharities.set(c.lga_code, []);
    lgaCharities.get(c.lga_code)!.push(c);
  }
  const desertLgaStats: DesertLgaStat[] = Array.from(desertByLga.values())
    .filter((d) => lgaCharities.has(d.lga_code))
    .map((d) => {
      const charities = lgaCharities.get(d.lga_code)!;
      return {
        lga_name: d.lga_name,
        state: d.state,
        desert_score: d.desert_score,
        remoteness: d.remoteness,
        charityCount: charities.length,
        avgOverhead: charities.reduce((s, c) => s + c.overheadPct, 0) / charities.length,
        totalFunding: d.total_funding,
      };
    })
    .sort((a, b) => b.desert_score - a.desert_score)
    .slice(0, 20);

  // Section 6: ACCO vs mainstream in deserts
  const desertAcco = desertCharities.filter((c) => c.isAcco);
  const desertMainstream = desertCharities.filter((c) => !c.isAcco);

  function groupStats(group: EnrichedCharity[]) {
    if (group.length === 0) return { count: 0, avgExecPay: 0, avgOverhead: 0, avgGovDep: 0 };
    const withRev = group.filter((c) => c.total_revenue > 0);
    return {
      count: group.length,
      avgExecPay: group.reduce((s, c) => s + c.total_paid_key_management, 0) / group.length,
      avgOverhead: group.reduce((s, c) => s + c.overheadPct, 0) / group.length,
      avgGovDep: withRev.length > 0
        ? withRev.map((c) => (c.revenue_from_government / c.total_revenue) * 100).reduce((s, v) => s + v, 0) / withRev.length
        : 0,
    };
  }

  const accoDesertComparison: AccoDesertComparison = {
    label: 'Funding Desert LGAs',
    acco: groupStats(desertAcco),
    mainstream: groupStats(desertMainstream),
  };

  return {
    totalDeserts: desertLgaCount,
    totalEnriched: enriched.length,
    avgOverheadDesert,
    avgOverheadNonDesert,
    avgPayRemote,
    avgPayMetro,
    byRemoteness,
    byDecile,
    desertLgaStats,
    accoDesertComparison,
    q50,
  };
}

/* ---------- constants ---------- */

const REMOTENESS_SHORT: Record<string, string> = {
  'Very Remote Australia': 'Very Remote',
  'Remote Australia': 'Remote',
  'Outer Regional Australia': 'Outer Regional',
  'Inner Regional Australia': 'Inner Regional',
  'Major Cities of Australia': 'Major Cities',
};

const REMOTENESS_COLORS: Record<string, string> = {
  'Very Remote Australia': 'text-bauhaus-red font-black',
  'Remote Australia': 'text-orange-600 font-black',
  'Outer Regional Australia': 'text-amber-600 font-bold',
  'Inner Regional Australia': 'text-bauhaus-blue font-bold',
  'Major Cities of Australia': 'text-gray-600',
};

const REMOTENESS_BAR_COLORS: Record<string, string> = {
  'Very Remote Australia': 'bg-bauhaus-red',
  'Remote Australia': 'bg-orange-500',
  'Outer Regional Australia': 'bg-amber-500',
  'Inner Regional Australia': 'bg-bauhaus-blue',
  'Major Cities of Australia': 'bg-gray-400',
};

/* ---------- page ---------- */

export default async function DesertOverheadReport() {
  const d = await getData();

  const maxOverhead = d.byRemoteness.length > 0
    ? Math.max(...d.byRemoteness.map((r) => r.avgOverhead))
    : 1;

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
          Where Executive Pay Meets Community Need
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Do the most disadvantaged areas get served by the most expensive charities? We
          cross-referenced {fmt(d.totalDeserts)} funding desert LGAs with ACNC executive
          remuneration data for {fmt(d.totalEnriched)} charities operating in scored Local Government
          Areas &mdash; mapping where executive overhead meets community need.
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
              Funding Desert LGAs
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.totalDeserts)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">desert score &gt; 0.5</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Charities Matched
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.totalEnriched)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">in desert LGAs with exec data</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Desert vs Non-Desert
            </div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">
              {pct(d.avgOverheadDesert)}
            </div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">
              vs {pct(d.avgOverheadNonDesert)} non-desert overhead
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">
              Remote vs Metro Pay
            </div>
            <div className="text-3xl sm:text-4xl font-black">{money(d.avgPayRemote)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              vs {money(d.avgPayMetro)} in cities
            </div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC AIS 2023 &times; CivicGraph Funding Deserts (SEIFA + Remoteness + Funding
            Flows) &times; CivicGraph Entity Graph.
          </p>
        </div>
      </section>

      {/* Section 2: Exec overhead by remoteness - bar chart */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Executive Overhead by Remoteness
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How does executive overhead change as you move further from the cities? Charities grouped
          by the remoteness classification of the LGA they operate in.
        </p>

        {/* Bar chart */}
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Average Executive Overhead % by Remoteness
          </h3>
          {d.byRemoteness.map((r) => (
            <div key={r.remoteness} className="flex items-center gap-3 mb-3">
              <div className="w-32 text-xs font-bold text-bauhaus-black text-right shrink-0">
                {REMOTENESS_SHORT[r.remoteness] || r.remoteness}
              </div>
              <div className="flex-1 h-8 bg-gray-100 relative">
                <div
                  className={`h-full ${REMOTENESS_BAR_COLORS[r.remoteness] || 'bg-gray-400'} transition-all flex items-center justify-end pr-2`}
                  style={{
                    width: `${Math.max((r.avgOverhead / maxOverhead) * 100, 5)}%`,
                  }}
                >
                  <span className="text-xs font-black text-white">{pct(r.avgOverhead)}</span>
                </div>
              </div>
              <div className="w-24 text-xs font-mono text-right shrink-0">
                {fmt(r.count)} charities
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                  Remoteness
                </th>
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
                  Avg Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {d.byRemoteness.map((r, i) => (
                <tr key={r.remoteness} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className={`p-3 font-bold ${REMOTENESS_COLORS[r.remoteness] || ''}`}>
                    {REMOTENESS_SHORT[r.remoteness] || r.remoteness}
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(r.count)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                    {money(r.avgExecPay)}
                  </td>
                  <td className="p-3 text-right font-mono">{pct(r.avgOverhead)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                    {money(r.avgRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: By SEIFA decile */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Executive Overhead by SEIFA Decile
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          SEIFA decile 1 = most disadvantaged, decile 10 = least disadvantaged. Does executive
          overhead track with community disadvantage?
        </p>

        {/* Decile bar chart */}
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Average Executive Overhead % by SEIFA Decile
          </h3>
          {d.byDecile.map((row) => {
            const maxDecileOverhead = Math.max(...d.byDecile.map((r) => r.avgOverhead), 1);
            return (
              <div key={row.decile} className="flex items-center gap-3 mb-2">
                <div className="w-20 text-xs font-bold text-bauhaus-black text-right shrink-0">
                  Decile {row.decile}
                </div>
                <div className="flex-1 h-7 bg-gray-100 relative">
                  <div
                    className={`h-full transition-all flex items-center justify-end pr-2 ${row.decile <= 3 ? 'bg-bauhaus-red' : row.decile <= 7 ? 'bg-amber-500' : 'bg-gray-400'}`}
                    style={{
                      width: `${Math.max((row.avgOverhead / maxDecileOverhead) * 100, 5)}%`,
                    }}
                  >
                    <span className="text-xs font-black text-white">{pct(row.avgOverhead)}</span>
                  </div>
                </div>
                <div className="w-24 text-xs font-mono text-right shrink-0">
                  {fmt(row.count)} charities
                </div>
              </div>
            );
          })}
        </div>

        {/* Decile table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">
                  SEIFA Decile
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Charities
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Avg Exec Pay
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Avg Overhead %
                </th>
              </tr>
            </thead>
            <tbody>
              {d.byDecile.map((row, i) => (
                <tr
                  key={row.decile}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="p-3">
                    <span className={`font-bold ${row.decile <= 3 ? 'text-bauhaus-red font-black' : 'text-bauhaus-black'}`}>
                      {row.decile}
                    </span>
                    <span className="text-xs text-bauhaus-muted ml-2">
                      {row.decile === 1
                        ? '(most disadvantaged)'
                        : row.decile === 10
                          ? '(least disadvantaged)'
                          : ''}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(row.count)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                    {money(row.avgExecPay)}
                  </td>
                  <td className="p-3 text-right font-mono">{pct(row.avgOverhead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportCTA
        reportSlug="desert-overhead"
        reportTitle="Funding Deserts & Executive Overhead"
        variant="inline"
      />

      {/* Section 4: Top desert LGAs with highest exec overhead */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Desert LGAs with Highest Exec Overhead
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 LGAs with the highest desert scores that also have charities reporting executive
          pay. These are the places where community need is greatest and where the overhead question
          matters most.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                  #
                </th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Desert Score
                </th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                  Remoteness
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Charities
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Avg Overhead
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                  Total Funding
                </th>
              </tr>
            </thead>
            <tbody>
              {d.desertLgaStats.map((lga, i) => (
                <tr
                  key={`${lga.lga_name}-${lga.state}-${i}`}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}
                >
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{lga.lga_name}</div>
                    <div className="text-xs text-bauhaus-muted">{lga.state || 'Unknown'}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">
                    {lga.desert_score.toFixed(0)}
                  </td>
                  <td
                    className={`p-3 text-xs hidden sm:table-cell ${REMOTENESS_COLORS[lga.remoteness] || ''}`}
                  >
                    {REMOTENESS_SHORT[lga.remoteness] || lga.remoteness || '\u2014'}
                  </td>
                  <td className="p-3 text-right font-mono">{lga.charityCount}</td>
                  <td className="p-3 text-right font-mono font-bold">{pct(lga.avgOverhead)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {lga.totalFunding > 0 ? money(lga.totalFunding) : '$0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: ACCO efficiency in deserts */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          ACCO Efficiency in Funding Deserts
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          In the LGAs that need it most &mdash; the funding deserts &mdash; how do Aboriginal
          Community-Controlled Organisations compare to mainstream charities on executive overhead?
          The story: ACCOs consistently deliver more efficiently where it matters most.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ACCO side */}
          <div className="border-4 border-bauhaus-black p-6 bg-amber-50">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                ACCO
              </span>
              <span className="text-xs text-bauhaus-muted font-bold">
                {fmt(d.accoDesertComparison.acco.count)} organisations in desert LGAs
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                  Avg Exec Pay
                </div>
                <div className="text-2xl font-black text-bauhaus-red">
                  {money(d.accoDesertComparison.acco.avgExecPay)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Overhead %
                  </div>
                  <div className="text-sm font-black">
                    {pct(d.accoDesertComparison.acco.avgOverhead)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Gov Dependency
                  </div>
                  <div className="text-sm font-black">
                    {pct(d.accoDesertComparison.acco.avgGovDep)}
                  </div>
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
                {fmt(d.accoDesertComparison.mainstream.count)} organisations in desert LGAs
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                  Avg Exec Pay
                </div>
                <div className="text-2xl font-black text-bauhaus-red">
                  {money(d.accoDesertComparison.mainstream.avgExecPay)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Overhead %
                  </div>
                  <div className="text-sm font-black">
                    {pct(d.accoDesertComparison.mainstream.avgOverhead)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Gov Dependency
                  </div>
                  <div className="text-sm font-black">
                    {pct(d.accoDesertComparison.mainstream.avgGovDep)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {d.accoDesertComparison.acco.count > 0 && d.accoDesertComparison.mainstream.count > 0 && (
          <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-amber-50/50 text-center">
            <p className="text-sm text-bauhaus-muted font-bold">
              {d.accoDesertComparison.acco.avgOverhead < d.accoDesertComparison.mainstream.avgOverhead
                ? `ACCOs operate at ${pct(d.accoDesertComparison.mainstream.avgOverhead - d.accoDesertComparison.acco.avgOverhead)} lower overhead in funding desert LGAs — delivering more per dollar where communities need it most.`
                : `Mainstream charities operate at ${pct(d.accoDesertComparison.acco.avgOverhead - d.accoDesertComparison.mainstream.avgOverhead)} lower overhead in funding desert LGAs.`}
            </p>
          </div>
        )}
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">
            Methodology
          </h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Funding desert scores:</strong> Each LGA is scored using CivicGraph&apos;s
              desert index, which combines SEIFA IRSD disadvantage (ABS 2021 Census), remoteness
              classification (ARIA+ 2021), entity coverage gaps, and tracked funding flows. Higher
              scores indicate greater underservice relative to need. LGAs with a desert score above
              the median ({d.q50.toFixed(1)}) are classified as &ldquo;desert LGAs&rdquo; for this
              analysis.
            </p>
            <p>
              <strong>Executive remuneration:</strong> Sourced from ACNC Annual Information
              Statements (2023). &ldquo;Total paid to key management personnel&rdquo; includes all
              forms of remuneration (salary, superannuation, bonuses, allowances) as reported to the
              ACNC. Only charities reporting key management remuneration greater than $0 are included.
            </p>
            <p>
              <strong>Executive overhead %:</strong> Calculated as total paid to key management
              personnel divided by total expenses. This measures the proportion of a charity&apos;s
              spending that goes to senior leadership compensation.
            </p>
            <p>
              <strong>Geographic matching:</strong> Charities are linked to LGAs via their ABN
              in CivicGraph&apos;s entity graph, which maps organisations to postcodes and LGA
              boundaries. Charities operating across multiple LGAs are attributed to their primary
              registered location.
            </p>
            <p>
              <strong>Community-controlled identification:</strong> ACCOs are identified via
              CivicGraph&apos;s entity classification system, drawing on ORIC registration, ACNC
              purposes, self-identification, and governance data.
            </p>
            <p>
              <strong>Limitations:</strong> Not all charities operating in an LGA are captured
              &mdash; only those with matching ABNs in both ACNC and CivicGraph datasets. Executive
              pay data is self-reported. Charities serving multiple LGAs are attributed to one
              location. The analysis does not account for differences in service complexity, scope,
              or regulatory burden that may justify higher executive compensation.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">
            Explore Related Investigations
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Dive deeper into funding deserts, executive remuneration, or power concentration across
            the Australian social sector.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/reports/funding-deserts"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Funding Deserts
            </a>
            <a
              href="/reports/exec-remuneration"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Exec Remuneration
            </a>
            <a
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Power Index
            </a>
          </div>
        </div>
      </section>

      <ReportCTA
        reportSlug="desert-overhead"
        reportTitle="Funding Deserts & Executive Overhead"
      />
    </div>
  );
}
