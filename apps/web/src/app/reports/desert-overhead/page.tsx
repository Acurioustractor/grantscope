import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import { execSqlAll } from '@/lib/exec-sql-all';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Funding Deserts & Executive Overhead | CivicGraph Investigation',
  description:
    'Do disadvantaged areas get served by charities with higher executive overhead? Council-level funding deserts cross-referenced with ACNC executive remuneration data.',
  openGraph: {
    title: 'Funding Deserts & Executive Overhead',
    description:
      'Cross-referencing council-level disadvantage and funding with charity executive pay.',
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

interface CouncilRow {
  lga_name: string;
  state: string;
  remoteness: string;
  seifa_decile: number;
  total_funding: number;
  entity_count: number;
  funding_per_org: number | null;
  median_per_org: number;
  is_desert: boolean;
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
  lga_name: string;
  state: string;
  is_community_controlled: boolean;
}

interface EnrichedCharity extends AisRecord {
  councilKey: string;
  lga_name: string;
  seifa_decile: number;
  remoteness: string;
  isDesert: boolean;
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
  seifa_decile: number;
  funding_per_org: number | null;
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

const councilKey = (lga: string, state: string) => `${lga}|${state}`;

/**
 * One row per council, flagged as a funding desert under the definition Ben picked on 2026-09-24:
 * in the most disadvantaged 30% (average SEIFA IRSD decile 3 or lower) AND tracked funding per
 * indexed organisation at or below the national median (or no indexed organisations at all).
 *
 * Replaced `desert_score > 0.5`. The score now runs 16.7 to 190, so that flagged every scored council
 * (1,218 of 1,218 rows), and it tracks disadvantage (r = -0.86 with the IRSD decile) far more than
 * money (r = -0.12). mv_funding_deserts also has no lga_code, which the page joined on, so it
 * showed 0 councils and 0 charities. The view holds one row per council per remoteness class; the
 * row kept is the council's modal remoteness, the same pick /api/data/map makes.
 */
const COUNCILS_SQL = `WITH modal AS (
    SELECT DISTINCT ON (lga_name, upper(state)) lga_name, upper(state) AS state, remoteness_2021 AS remoteness
      FROM postcode_geo
     WHERE lga_name IS NOT NULL AND remoteness_2021 IS NOT NULL
     GROUP BY lga_name, upper(state), remoteness_2021
     ORDER BY lga_name, upper(state), count(*) DESC
  ),
  c AS (
    SELECT DISTINCT ON (d.lga_name, upper(d.state))
           d.lga_name, upper(d.state) AS state, d.avg_irsd_decile, d.total_funding_all_sources,
           d.indexed_entities, coalesce(m.remoteness, d.remoteness) AS remoteness
      FROM mv_funding_deserts d
      LEFT JOIN modal m ON m.lga_name = d.lga_name AND m.state = upper(d.state)
     WHERE d.desert_score IS NOT NULL
     ORDER BY d.lga_name, upper(d.state), (d.remoteness = m.remoteness) DESC NULLS LAST, d.desert_score DESC
  ),
  med AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY total_funding_all_sources / NULLIF(indexed_entities, 0)) AS per_org
      FROM c
  )
  SELECT c.lga_name, c.state, c.remoteness,
         c.avg_irsd_decile::float AS seifa_decile,
         c.total_funding_all_sources::float AS total_funding,
         c.indexed_entities::int AS entity_count,
         (c.total_funding_all_sources / NULLIF(c.indexed_entities, 0))::float AS funding_per_org,
         med.per_org::float AS median_per_org,
         coalesce(c.avg_irsd_decile <= 3
           AND (c.indexed_entities = 0 OR c.total_funding_all_sources / NULLIF(c.indexed_entities, 0) <= med.per_org), false) AS is_desert
    FROM c CROSS JOIN med
   ORDER BY c.lga_name, c.state`;

async function getData() {
  const db = getServiceSupabase();

  // 1. One row per scored council, with the desert flag.
  const councils = await safe(async () => {
    const rows = await execSqlAll<Record<string, unknown>>(db, COUNCILS_SQL);
    return rows.map((r): CouncilRow => ({
      lga_name: String(r.lga_name || ''),
      state: String(r.state || ''),
      remoteness: String(r.remoteness || ''),
      seifa_decile: Number(r.seifa_decile) || 0,
      total_funding: Number(r.total_funding) || 0,
      entity_count: Number(r.entity_count) || 0,
      funding_per_org: r.funding_per_org == null ? null : Number(r.funding_per_org),
      median_per_org: Number(r.median_per_org) || 0,
      is_desert: r.is_desert === true,
    }));
  }, [] as CouncilRow[]);

  // 2. Fetch acnc_ais for 2023 with exec pay (paginated). Ordered, so no page repeats or skips a
  //    row. Expenses must be positive: a charity with $0 expenses cannot have an overhead share,
  //    and counting it as 0% pulled every average down.
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
        .gt('total_expenses', 0)
        .order('abn')
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

  // 3. The council each of those charities sits in: only the ABNs the page joins, one row per ABN,
  //    ordered so execSqlAll's pages are stable.
  const entityLgas = await safe(async () => {
    const data = await execSqlAll<Record<string, unknown>>(db, `SELECT DISTINCT ON (abn) abn, lga_name,
             upper(state) AS state, coalesce(is_community_controlled, false) AS is_community_controlled
        FROM gs_entities
       WHERE lga_name IS NOT NULL
         AND abn IN (SELECT abn FROM acnc_ais
                      WHERE ais_year = 2023 AND total_paid_key_management > 0 AND total_expenses > 0)
       ORDER BY abn, is_community_controlled DESC NULLS LAST`);
    return data.map((r) => ({
      abn: String(r.abn),
      lga_name: String(r.lga_name),
      state: String(r.state),
      is_community_controlled: r.is_community_controlled === true,
    }));
  }, [] as EntityLga[]);

  const councilBy = new Map(councils.map((c) => [councilKey(c.lga_name, c.state), c]));
  const entityByAbn = new Map(entityLgas.map((e) => [e.abn, e]));

  // Join charities to councils, one row per ABN.
  const enriched: EnrichedCharity[] = [];
  const seen = new Set<string>();
  for (const ais of aisData) {
    if (seen.has(ais.abn)) continue;
    const entity = entityByAbn.get(ais.abn);
    if (!entity) continue;
    const key = councilKey(entity.lga_name, entity.state);
    const council = councilBy.get(key);
    if (!council) continue;
    seen.add(ais.abn);
    enriched.push({
      ...ais,
      councilKey: key,
      lga_name: council.lga_name,
      seifa_decile: council.seifa_decile,
      remoteness: council.remoteness,
      isDesert: council.is_desert,
      overheadPct: (ais.total_paid_key_management / ais.total_expenses) * 100,
      isAcco: entity.is_community_controlled,
    });
  }

  const desertCharities = enriched.filter((c) => c.isDesert);
  const nonDesertCharities = enriched.filter((c) => !c.isDesert);
  const desertCouncils = councils.filter((c) => c.is_desert);

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

  // Section 5: desert councils that have charities reporting exec pay, most disadvantaged first
  const lgaCharities = new Map<string, EnrichedCharity[]>();
  for (const c of desertCharities) {
    if (!lgaCharities.has(c.councilKey)) lgaCharities.set(c.councilKey, []);
    lgaCharities.get(c.councilKey)!.push(c);
  }
  const desertLgaStats: DesertLgaStat[] = desertCouncils
    .filter((d) => lgaCharities.has(councilKey(d.lga_name, d.state)))
    .map((d) => {
      const charities = lgaCharities.get(councilKey(d.lga_name, d.state))!;
      return {
        lga_name: d.lga_name,
        state: d.state,
        seifa_decile: d.seifa_decile,
        funding_per_org: d.funding_per_org,
        remoteness: d.remoteness,
        charityCount: charities.length,
        avgOverhead: charities.reduce((s, c) => s + c.overheadPct, 0) / charities.length,
        totalFunding: d.total_funding,
      };
    })
    .sort((a, b) => a.seifa_decile - b.seifa_decile || (a.funding_per_org ?? 0) - (b.funding_per_org ?? 0))
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
    totalDeserts: desertCouncils.length,
    totalCouncils: councils.length,
    medianPerOrg: councils[0]?.median_per_org ?? 0,
    totalEnriched: enriched.length,
    desertEnriched: desertCharities.length,
    avgOverheadDesert,
    avgOverheadNonDesert,
    avgPayRemote,
    avgPayMetro,
    byRemoteness,
    byDecile,
    desertLgaStats,
    accoDesertComparison,
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

/** Cost + pooler load: this page was force-dynamic with no caching, so every request ran
 *  its query. The report's underlying data changes nightly at most. */
const getDataCached = unstable_cache(getData, ['reports-desert-overhead-v4'], { revalidate: 3600 });

export default async function DesertOverheadReport() {
  const d = await getDataCached();
  const answer = d.avgOverheadDesert > d.avgOverheadNonDesert ? 'yes' : 'no';

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
          Do the most disadvantaged places get served by the most expensive charities? We matched
          {fmt(d.totalEnriched)} charities that report executive pay to their council.{' '}
          {fmt(d.totalDeserts)} of {fmt(d.totalCouncils)} councils count as funding deserts: among the
          most disadvantaged 30%, with tracked funding per organisation at or below the median.
        </p>
        {d.desertEnriched > 0 && (
          <p className="text-bauhaus-black text-base sm:text-lg max-w-3xl leading-relaxed font-bold mt-3">
            In this data the answer is {answer}. The {fmt(d.desertEnriched)} charities in desert councils
            spend {pct(d.avgOverheadDesert)} of their spending on executive pay, against{' '}
            {pct(d.avgOverheadNonDesert)} everywhere else.
          </p>
        )}
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
              Funding Desert Councils
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.totalDeserts)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">IRSD decile 1&ndash;3, funding per org at or below median</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Charities Matched
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(d.totalEnriched)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{fmt(d.desertEnriched)} of them in desert councils</div>
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
            Source: ACNC AIS 2023 &times; ABS SEIFA IRSD 2021 &times; CivicGraph tracked funding and
            entity graph.
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
          Funding Desert Councils
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Desert councils with at least one charity reporting executive pay, most disadvantaged first
          (up to 20). Most hold only a few such charities, so one charity can move a council&apos;s
          average a long way.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">
                  #
                </th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Council</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  IRSD Decile
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
                  Funding per Org
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
                    {lga.seifa_decile.toFixed(1)}
                  </td>
                  <td
                    className={`p-3 text-xs hidden sm:table-cell ${REMOTENESS_COLORS[lga.remoteness] || ''}`}
                  >
                    {REMOTENESS_SHORT[lga.remoteness] || lga.remoteness || '\u2014'}
                  </td>
                  <td className="p-3 text-right font-mono">{lga.charityCount}</td>
                  <td className="p-3 text-right font-mono font-bold">{pct(lga.avgOverhead)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {lga.funding_per_org == null ? 'no orgs indexed' : money(lga.funding_per_org)}
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
          In the desert councils, how do Aboriginal Community-Controlled Organisations compare with
          mainstream charities on executive pay as a share of spending?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ACCO side */}
          <div className="border-4 border-bauhaus-black p-6 bg-amber-50">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                ACCO
              </span>
              <span className="text-xs text-bauhaus-muted font-bold">
                {fmt(d.accoDesertComparison.acco.count)} organisations in desert councils
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
                {fmt(d.accoDesertComparison.mainstream.count)} organisations in desert councils
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
        {/* Below 10 ACCOs a gap is one organisation's books, not a comparison. On 2026-09-24 the
            desert councils held one ACCO reporting executive pay, against 127 mainstream charities. */}
        {d.accoDesertComparison.mainstream.count > 0 && (
          <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-amber-50/50 text-center">
            <p className="text-sm text-bauhaus-muted font-bold">
              {d.accoDesertComparison.acco.count < 10
                ? `${d.accoDesertComparison.acco.count === 1 ? 'Only one ACCO' : `Only ${fmt(d.accoDesertComparison.acco.count)} ACCOs`} in the desert councils ${d.accoDesertComparison.acco.count === 1 ? 'reports' : 'report'} executive pay, too few to compare with ${fmt(d.accoDesertComparison.mainstream.count)} mainstream charities.`
                : d.accoDesertComparison.acco.avgOverhead < d.accoDesertComparison.mainstream.avgOverhead
                  ? `ACCOs in desert councils spend ${(d.accoDesertComparison.mainstream.avgOverhead - d.accoDesertComparison.acco.avgOverhead).toFixed(1)} percentage points less of their spending on executive pay than mainstream charities there.`
                  : `Mainstream charities in desert councils spend ${(d.accoDesertComparison.acco.avgOverhead - d.accoDesertComparison.mainstream.avgOverhead).toFixed(1)} percentage points less of their spending on executive pay than ACCOs there.`}
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
              <strong>Funding deserts:</strong> A council counts as a funding desert when two things
              hold. It sits in the most disadvantaged 30% by average SEIFA IRSD decile (ABS 2021
              Census). And the funding CivicGraph tracks into it, divided by the organisations indexed
              there, is at or below the median across councils ({money(d.medianPerOrg)} per
              organisation). A council with no indexed organisations counts if it meets the
              disadvantage test. {fmt(d.totalDeserts)} of {fmt(d.totalCouncils)} councils qualify.
              Remoteness is the ARIA+ 2021 class covering most of the council&apos;s postcodes.
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
              <strong>Limitations:</strong> Not all charities operating in a council are captured,
              only those with matching ABNs in both ACNC and CivicGraph datasets. Tracked funding is
              what CivicGraph holds, so a council can read as a desert because its money is missing
              from the data. Executive
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
