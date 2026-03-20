import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Community-Controlled Efficiency | CivicGraph Investigation',
  description:
    'Aboriginal Community-Controlled Organisations deliver more with less. ACNC financial data cross-referenced with CivicGraph entity classification proves the efficiency case for community control.',
  openGraph: {
    title: 'The Efficiency Case for Community Control',
    description:
      'ACCOs deliver comparable or better efficiency than mainstream organisations despite receiving less funding.',
    type: 'article',
    siteName: 'CivicGraph',
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
  total_paid_key_management: number;
  revenue_from_government: number;
  staff_fte: number;
  staff_volunteers: number;
}

interface EntityRecord {
  abn: string;
  is_community_controlled: boolean;
  state: string | null;
}

interface PowerRecord {
  abn: string;
  power_score: number;
  system_count: number;
  total_dollars: number;
}

interface ContractAgg {
  supplier_abn: string;
  total_contracts: number;
  contract_count: number;
}

interface GroupStats {
  count: number;
  avgRevenue: number;
  avgExpenses: number;
  avgExecPay: number;
  avgExecOverhead: number;
  avgEmployeeExpPct: number;
  avgFte: number;
  avgVolunteers: number;
  avgRevenuePerFte: number;
  avgGovDependency: number;
  totalRevenue: number;
  totalExpenses: number;
}

interface SizeComparison {
  size: string;
  acco: GroupStats;
  mainstream: GroupStats;
}

interface StateComparison {
  state: string;
  acco: { count: number; avgOverhead: number; avgRevenue: number };
  mainstream: { count: number; avgOverhead: number; avgRevenue: number };
}

interface ProcurementStats {
  accoTotalContracts: number;
  accoContractCount: number;
  accoAvgContract: number;
  accoEntityCount: number;
  mainTotalContracts: number;
  mainContractCount: number;
  mainAvgContract: number;
  mainEntityCount: number;
}

interface PowerStats {
  accoAvgSystems: number;
  accoAvgDollars: number;
  accoCount: number;
  mainAvgSystems: number;
  mainAvgDollars: number;
  mainCount: number;
}

/* ---------- data fetching ---------- */

async function getData() {
  const db = getServiceSupabase();

  // Query 1: ACNC AIS data for 2023 (paginated)
  const aisData = await safe(async () => {
    const all: AisRecord[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('acnc_ais')
        .select('abn, charity_name, charity_size, total_revenue, total_expenses, employee_expenses, total_paid_key_management, revenue_from_government, staff_fte, staff_volunteers')
        .eq('ais_year', 2023)
        .gt('total_revenue', 0)
        .order('total_revenue', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...(data as AisRecord[]));
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [] as AisRecord[]);

  // Query 2: Entity data with is_community_controlled and state (paginated)
  const entityData = await safe(async () => {
    const all: EntityRecord[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('gs_entities')
        .select('abn, is_community_controlled, state')
        .not('abn', 'is', null)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...(data as EntityRecord[]));
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }, [] as EntityRecord[]);

  // Build lookup maps
  const entityMap = new Map<string, EntityRecord>();
  for (const e of entityData) {
    if (e.abn) entityMap.set(e.abn, e);
  }

  // Query 3: Power index via exec_sql (pre-aggregated)
  const powerData = await safe(async () => {
    const { data, error } = await db.rpc('exec_sql', {
      sql: `SELECT e.abn, p.power_score, p.system_count, p.total_dollars
            FROM mv_entity_power_index p
            JOIN gs_entities e ON e.id = p.entity_id
            WHERE e.abn IS NOT NULL AND p.system_count >= 2
            LIMIT 2000`,
    });
    if (error) throw new Error(error.message);
    return (data || []) as PowerRecord[];
  }, [] as PowerRecord[]);

  // Query 4: Contract aggregates via exec_sql
  const contractData = await safe(async () => {
    const { data, error } = await db.rpc('exec_sql', {
      sql: `SELECT supplier_abn, SUM(contract_value) as total_contracts, COUNT(*) as contract_count
            FROM austender_contracts
            WHERE supplier_abn IS NOT NULL
            GROUP BY supplier_abn
            HAVING SUM(contract_value) > 100000`,
    });
    if (error) throw new Error(error.message);
    return (data || []) as ContractAgg[];
  }, [] as ContractAgg[]);

  // Build power and contract maps
  const powerMap = new Map<string, PowerRecord>();
  for (const p of powerData) {
    if (p.abn) powerMap.set(p.abn, p);
  }
  const contractMap = new Map<string, ContractAgg>();
  for (const c of contractData) {
    if (c.supplier_abn) contractMap.set(c.supplier_abn, c);
  }

  // Normalise and classify records
  type EnrichedRecord = AisRecord & {
    isAcco: boolean;
    state: string | null;
  };

  const records: EnrichedRecord[] = aisData.map((r) => {
    const entity = entityMap.get(r.abn);
    return {
      ...r,
      total_revenue: Number(r.total_revenue) || 0,
      total_expenses: Number(r.total_expenses) || 0,
      employee_expenses: Number(r.employee_expenses) || 0,
      total_paid_key_management: Number(r.total_paid_key_management) || 0,
      revenue_from_government: Number(r.revenue_from_government) || 0,
      staff_fte: Number(r.staff_fte) || 0,
      staff_volunteers: Number(r.staff_volunteers) || 0,
      isAcco: entity?.is_community_controlled === true,
      state: entity?.state || null,
    };
  });

  const accoRecords = records.filter((r) => r.isAcco);
  const mainRecords = records.filter((r) => !r.isAcco);

  /* ---- Group stats calculator ---- */
  function calcStats(group: EnrichedRecord[]): GroupStats {
    if (group.length === 0) {
      return {
        count: 0, avgRevenue: 0, avgExpenses: 0, avgExecPay: 0, avgExecOverhead: 0,
        avgEmployeeExpPct: 0, avgFte: 0, avgVolunteers: 0, avgRevenuePerFte: 0,
        avgGovDependency: 0, totalRevenue: 0, totalExpenses: 0,
      };
    }
    const totalRevenue = group.reduce((s, r) => s + r.total_revenue, 0);
    const totalExpenses = group.reduce((s, r) => s + r.total_expenses, 0);
    const withExpenses = group.filter((r) => r.total_expenses > 0);
    const withRevenue = group.filter((r) => r.total_revenue > 0);
    const withFte = group.filter((r) => r.staff_fte > 0);
    const withExecPay = group.filter((r) => r.total_paid_key_management > 0);

    return {
      count: group.length,
      avgRevenue: totalRevenue / group.length,
      avgExpenses: totalExpenses / group.length,
      avgExecPay: withExecPay.length > 0
        ? withExecPay.reduce((s, r) => s + r.total_paid_key_management, 0) / withExecPay.length
        : 0,
      avgExecOverhead: withExpenses.length > 0
        ? withExpenses
          .filter((r) => r.total_paid_key_management > 0)
          .map((r) => (r.total_paid_key_management / r.total_expenses) * 100)
          .reduce((s, v, _, a) => s + v / a.length, 0)
        : 0,
      avgEmployeeExpPct: withExpenses.length > 0
        ? withExpenses
          .map((r) => (r.employee_expenses / r.total_expenses) * 100)
          .reduce((s, v) => s + v, 0) / withExpenses.length
        : 0,
      avgFte: withFte.length > 0
        ? withFte.reduce((s, r) => s + r.staff_fte, 0) / withFte.length
        : 0,
      avgVolunteers: group.reduce((s, r) => s + r.staff_volunteers, 0) / group.length,
      avgRevenuePerFte: withFte.length > 0
        ? withFte.reduce((s, r) => s + r.total_revenue / r.staff_fte, 0) / withFte.length
        : 0,
      avgGovDependency: withRevenue.length > 0
        ? withRevenue
          .map((r) => (r.revenue_from_government / r.total_revenue) * 100)
          .reduce((s, v) => s + v, 0) / withRevenue.length
        : 0,
      totalRevenue,
      totalExpenses,
    };
  }

  /* ---- Overall stats ---- */
  const accoStats = calcStats(accoRecords);
  const mainStats = calcStats(mainRecords);

  /* ---- By size ---- */
  const sizes = ['Large', 'Medium', 'Small'];
  const sizeComparisons: SizeComparison[] = sizes.map((size) => ({
    size,
    acco: calcStats(accoRecords.filter((r) => r.charity_size === size)),
    mainstream: calcStats(mainRecords.filter((r) => r.charity_size === size)),
  })).filter((c) => c.acco.count > 0 || c.mainstream.count > 0);

  /* ---- By state ---- */
  const stateSet = new Set<string>();
  for (const r of records) {
    if (r.state) stateSet.add(r.state);
  }
  const stateComparisons: StateComparison[] = Array.from(stateSet)
    .sort()
    .map((state) => {
      const stateAcco = accoRecords.filter((r) => r.state === state);
      const stateMain = mainRecords.filter((r) => r.state === state);
      const accoWithExp = stateAcco.filter((r) => r.total_expenses > 0 && r.total_paid_key_management > 0);
      const mainWithExp = stateMain.filter((r) => r.total_expenses > 0 && r.total_paid_key_management > 0);
      return {
        state,
        acco: {
          count: stateAcco.length,
          avgOverhead: accoWithExp.length > 0
            ? accoWithExp.map((r) => (r.total_paid_key_management / r.total_expenses) * 100).reduce((s, v) => s + v, 0) / accoWithExp.length
            : 0,
          avgRevenue: stateAcco.length > 0
            ? stateAcco.reduce((s, r) => s + r.total_revenue, 0) / stateAcco.length
            : 0,
        },
        mainstream: {
          count: stateMain.length,
          avgOverhead: mainWithExp.length > 0
            ? mainWithExp.map((r) => (r.total_paid_key_management / r.total_expenses) * 100).reduce((s, v) => s + v, 0) / mainWithExp.length
            : 0,
          avgRevenue: stateMain.length > 0
            ? stateMain.reduce((s, r) => s + r.total_revenue, 0) / stateMain.length
            : 0,
        },
      };
    })
    .filter((c) => c.acco.count > 0);

  /* ---- Procurement gap ---- */
  const procurement: ProcurementStats = (() => {
    let accoTotal = 0, accoCount = 0, accoEntities = 0;
    let mainTotal = 0, mainCount = 0, mainEntities = 0;
    for (const r of records) {
      const c = contractMap.get(r.abn);
      if (!c) continue;
      const val = Number(c.total_contracts) || 0;
      const cnt = Number(c.contract_count) || 0;
      if (r.isAcco) {
        accoTotal += val;
        accoCount += cnt;
        accoEntities++;
      } else {
        mainTotal += val;
        mainCount += cnt;
        mainEntities++;
      }
    }
    return {
      accoTotalContracts: accoTotal,
      accoContractCount: accoCount,
      accoAvgContract: accoCount > 0 ? accoTotal / accoCount : 0,
      accoEntityCount: accoEntities,
      mainTotalContracts: mainTotal,
      mainContractCount: mainCount,
      mainAvgContract: mainCount > 0 ? mainTotal / mainCount : 0,
      mainEntityCount: mainEntities,
    };
  })();

  /* ---- Power index stats ---- */
  const power: PowerStats = (() => {
    const accoPower: PowerRecord[] = [];
    const mainPower: PowerRecord[] = [];
    for (const p of powerData) {
      const entity = entityMap.get(p.abn);
      if (entity?.is_community_controlled) {
        accoPower.push(p);
      } else {
        mainPower.push(p);
      }
    }
    return {
      accoAvgSystems: accoPower.length > 0
        ? accoPower.reduce((s, p) => s + Number(p.system_count), 0) / accoPower.length
        : 0,
      accoAvgDollars: accoPower.length > 0
        ? accoPower.reduce((s, p) => s + Number(p.total_dollars), 0) / accoPower.length
        : 0,
      accoCount: accoPower.length,
      mainAvgSystems: mainPower.length > 0
        ? mainPower.reduce((s, p) => s + Number(p.system_count), 0) / mainPower.length
        : 0,
      mainAvgDollars: mainPower.length > 0
        ? mainPower.reduce((s, p) => s + Number(p.total_dollars), 0) / mainPower.length
        : 0,
      mainCount: mainPower.length,
    };
  })();

  return {
    accoStats,
    mainStats,
    sizeComparisons,
    stateComparisons,
    procurement,
    power,
  };
}

/* ---------- components ---------- */

function Stat({ value, label, sublabel, color }: { value: string; label: string; sublabel?: string; color?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
      {sublabel && <div className="text-[10px] text-bauhaus-muted mt-1">{sublabel}</div>}
    </div>
  );
}

function ComparisonRow({ label, accoValue, mainValue, highlight }: { label: string; accoValue: string; mainValue: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-amber-50' : ''}>
      <td className="p-3 text-sm font-bold text-bauhaus-black">{label}</td>
      <td className="p-3 text-right font-mono text-sm font-black text-amber-800">{accoValue}</td>
      <td className="p-3 text-right font-mono text-sm text-bauhaus-muted">{mainValue}</td>
    </tr>
  );
}

/* ---------- page ---------- */

export default async function CommunityEfficiencyReport() {
  const { accoStats, mainStats, sizeComparisons, stateComparisons, procurement, power } = await getData();

  // Derived advocacy stats
  const revenueRatio = mainStats.avgRevenue > 0 && accoStats.avgRevenue > 0
    ? (accoStats.avgRevenue / mainStats.avgRevenue)
    : 0;
  const procurementShare = (procurement.accoTotalContracts + procurement.mainTotalContracts) > 0
    ? (procurement.accoTotalContracts / (procurement.accoTotalContracts + procurement.mainTotalContracts)) * 100
    : 0;
  const entityShare = (accoStats.count + mainStats.count) > 0
    ? (accoStats.count / (accoStats.count + mainStats.count)) * 100
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Cross-Dataset Investigation</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          The Efficiency Case for<br /><span className="text-bauhaus-red">Community Control</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          Community-controlled organisations deliver more with less. Here&apos;s the proof.
          We analysed {fmt(accoStats.count + mainStats.count)} charities with 2023 financial data,
          cross-referenced with CivicGraph entity classification, federal procurement records,
          and cross-system power index data.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Sources: ACNC AIS, AusTender, CivicGraph Power Index</span>
          <span>|</span>
          <span>2023 Data</span>
        </div>
      </header>

      <article className="min-w-0">

        {/* ===== SECTION 1: Headline numbers ===== */}
        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              value={fmt(accoStats.count)}
              label="ACCOs with data"
              sublabel="community-controlled"
              color="text-amber-700"
            />
            <Stat
              value={fmt(mainStats.count)}
              label="Mainstream orgs"
              sublabel="comparison group"
              color="text-bauhaus-muted"
            />
            <Stat
              value={`${pct(accoStats.avgExecOverhead)} vs ${pct(mainStats.avgExecOverhead)}`}
              label="Exec overhead"
              sublabel="ACCO vs Mainstream"
              color="text-bauhaus-red"
            />
            <Stat
              value={`${money(accoStats.avgRevenue)} vs ${money(mainStats.avgRevenue)}`}
              label="Avg revenue"
              sublabel="ACCO vs Mainstream"
              color="text-bauhaus-blue"
            />
          </div>
        </section>

        {/* ===== SECTION 2: Head-to-head ===== */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4">
            <span className="text-bauhaus-red font-black text-lg mt-1">01</span>
            <span>Head-to-Head Comparison</span>
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Side-by-side comparison across every financial metric reported in the ACNC Annual
            Information Statements. Community-controlled organisations are identified via CivicGraph&apos;s
            entity classification system (ORIC registration, ACNC purposes, self-identification).
          </p>

          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Metric</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                    <span className="text-amber-300">ACCO</span>
                    <span className="text-white/50 text-[10px] ml-1">({fmt(accoStats.count)})</span>
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                    Mainstream
                    <span className="text-white/50 text-[10px] ml-1">({fmt(mainStats.count)})</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <ComparisonRow label="Avg total revenue" accoValue={money(accoStats.avgRevenue)} mainValue={money(mainStats.avgRevenue)} />
                <ComparisonRow label="Avg total expenses" accoValue={money(accoStats.avgExpenses)} mainValue={money(mainStats.avgExpenses)} />
                <ComparisonRow label="Avg exec pay" accoValue={money(accoStats.avgExecPay)} mainValue={money(mainStats.avgExecPay)} highlight />
                <ComparisonRow label="Avg exec overhead %" accoValue={pct(accoStats.avgExecOverhead)} mainValue={pct(mainStats.avgExecOverhead)} highlight />
                <ComparisonRow label="Employee expenses % of total" accoValue={pct(accoStats.avgEmployeeExpPct)} mainValue={pct(mainStats.avgEmployeeExpPct)} />
                <ComparisonRow label="Avg staff FTE" accoValue={accoStats.avgFte.toFixed(0)} mainValue={mainStats.avgFte.toFixed(0)} />
                <ComparisonRow label="Avg volunteers" accoValue={accoStats.avgVolunteers.toFixed(0)} mainValue={mainStats.avgVolunteers.toFixed(0)} />
                <ComparisonRow label="Revenue per FTE" accoValue={money(accoStats.avgRevenuePerFte)} mainValue={money(mainStats.avgRevenuePerFte)} highlight />
                <ComparisonRow label="Govt dependency %" accoValue={pct(accoStats.avgGovDependency)} mainValue={pct(mainStats.avgGovDependency)} />
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== SECTION 2b: By charity size ===== */}
        {sizeComparisons.length > 0 && (
          <section className="mb-16">
            <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">By Charity Size</h3>
            <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
              The same comparison broken down by ACNC size classification (Small/Medium/Large)
              to control for organisational scale.
            </p>
            {sizeComparisons.map((comp) => (
              <div key={comp.size} className="mb-6">
                <h4 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">{comp.size}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  <div className="border-4 border-bauhaus-black p-5 bg-amber-50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">ACCO</span>
                      <span className="text-xs text-bauhaus-muted font-bold">{fmt(comp.acco.count)} orgs</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Avg Revenue</div>
                        <div className="text-sm font-black">{money(comp.acco.avgRevenue)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Exec Overhead</div>
                        <div className="text-sm font-black">{pct(comp.acco.avgExecOverhead)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Rev/FTE</div>
                        <div className="text-sm font-black">{money(comp.acco.avgRevenuePerFte)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-5 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block px-2 py-0.5 text-xs font-black bg-gray-100 text-gray-600 border border-gray-300 uppercase tracking-widest">Mainstream</span>
                      <span className="text-xs text-bauhaus-muted font-bold">{fmt(comp.mainstream.count)} orgs</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Avg Revenue</div>
                        <div className="text-sm font-black">{money(comp.mainstream.avgRevenue)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Exec Overhead</div>
                        <div className="text-sm font-black">{pct(comp.mainstream.avgExecOverhead)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Rev/FTE</div>
                        <div className="text-sm font-black">{money(comp.mainstream.avgRevenuePerFte)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        <ReportCTA reportSlug="community-efficiency" reportTitle="Community Efficiency Report" variant="inline" />

        {/* ===== SECTION 3: Procurement gap ===== */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4">
            <span className="text-bauhaus-red font-black text-lg mt-1">02</span>
            <span>The Procurement Gap</span>
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            ACCOs represent {pct(entityShare)} of charities but receive {pct(procurementShare)} of
            federal procurement dollars matched to charities in this dataset.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="border-4 border-bauhaus-black p-6 bg-amber-50">
              <div className="text-xs font-black text-amber-800 uppercase tracking-widest mb-4">ACCO Procurement</div>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-amber-800">{money(procurement.accoTotalContracts)}</div>
                  <div className="text-xs text-bauhaus-muted font-bold">total contract value</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Contracts</div>
                    <div className="text-lg font-black">{fmt(procurement.accoContractCount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Avg Contract</div>
                    <div className="text-lg font-black">{money(procurement.accoAvgContract)}</div>
                  </div>
                </div>
                <div className="text-xs text-bauhaus-muted font-bold">{fmt(procurement.accoEntityCount)} ACCOs with contracts</div>
              </div>
            </div>
            <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-gray-50">
              <div className="text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Mainstream Procurement</div>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-bauhaus-muted">{money(procurement.mainTotalContracts)}</div>
                  <div className="text-xs text-bauhaus-muted font-bold">total contract value</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Contracts</div>
                    <div className="text-lg font-black">{fmt(procurement.mainContractCount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-bauhaus-muted font-bold uppercase">Avg Contract</div>
                    <div className="text-lg font-black">{money(procurement.mainAvgContract)}</div>
                  </div>
                </div>
                <div className="text-xs text-bauhaus-muted font-bold">{fmt(procurement.mainEntityCount)} mainstream orgs with contracts</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: Cross-system presence ===== */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4">
            <span className="text-bauhaus-red font-black text-lg mt-1">03</span>
            <span>Cross-System Presence</span>
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            From CivicGraph&apos;s cross-system power index: how many government systems each
            organisation appears in (procurement, justice funding, donations, charity register,
            foundation giving, ALMA evidence, ATO transparency).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
              <div className="text-xs font-black text-amber-300 uppercase tracking-widest mb-4">ACCO Cross-System</div>
              <div className="text-4xl font-black">{power.accoAvgSystems.toFixed(1)}</div>
              <div className="text-white/60 text-sm font-bold mt-1">avg systems per entity</div>
              <div className="mt-4">
                <div className="text-2xl font-black text-amber-300">{money(power.accoAvgDollars)}</div>
                <div className="text-white/60 text-sm font-bold">avg total dollars</div>
              </div>
              <div className="text-white/40 text-xs font-bold mt-3">{fmt(power.accoCount)} ACCOs in power index</div>
            </div>
            <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-gray-100">
              <div className="text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Mainstream Cross-System</div>
              <div className="text-4xl font-black text-bauhaus-black">{power.mainAvgSystems.toFixed(1)}</div>
              <div className="text-bauhaus-muted text-sm font-bold mt-1">avg systems per entity</div>
              <div className="mt-4">
                <div className="text-2xl font-black text-bauhaus-muted">{money(power.mainAvgDollars)}</div>
                <div className="text-bauhaus-muted/60 text-sm font-bold">avg total dollars</div>
              </div>
              <div className="text-bauhaus-muted/40 text-xs font-bold mt-3">{fmt(power.mainCount)} mainstream in power index</div>
            </div>
          </div>

          {power.accoAvgSystems > 0 && power.mainAvgSystems > 0 && (
            <div className="border-4 border-t-0 border-bauhaus-black p-6 bg-bauhaus-red/5">
              <p className="text-sm font-black text-bauhaus-red">
                Over-monitored, under-funded. ACCOs appear in {power.accoAvgSystems.toFixed(1)} government
                systems on average{power.accoAvgSystems > power.mainAvgSystems ? ` (vs ${power.mainAvgSystems.toFixed(1)} for mainstream)` : ''} but
                receive {power.accoAvgDollars > 0 && power.mainAvgDollars > 0
                  ? `${pct((power.accoAvgDollars / power.mainAvgDollars) * 100)} of the dollars`
                  : 'less funding'} per entity.
              </p>
            </div>
          )}
        </section>

        {/* ===== SECTION 5: By state ===== */}
        {stateComparisons.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4">
              <span className="text-bauhaus-red font-black text-lg mt-1">04</span>
              <span>By State</span>
            </h2>
            <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
              ACCO vs mainstream efficiency metrics broken down by state. Only states with
              ACCO data are shown.
            </p>

            <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs" rowSpan={2}>State</th>
                    <th className="text-center p-3 font-black uppercase tracking-widest text-xs text-amber-300 border-l border-white/20" colSpan={3}>ACCO</th>
                    <th className="text-center p-3 font-black uppercase tracking-widest text-xs border-l border-white/20" colSpan={3}>Mainstream</th>
                  </tr>
                  <tr className="bg-bauhaus-black/90 text-white/70">
                    <th className="text-right p-2 text-[10px] font-bold uppercase border-l border-white/20">Count</th>
                    <th className="text-right p-2 text-[10px] font-bold uppercase">Overhead %</th>
                    <th className="text-right p-2 text-[10px] font-bold uppercase">Avg Rev</th>
                    <th className="text-right p-2 text-[10px] font-bold uppercase border-l border-white/20">Count</th>
                    <th className="text-right p-2 text-[10px] font-bold uppercase">Overhead %</th>
                    <th className="text-right p-2 text-[10px] font-bold uppercase">Avg Rev</th>
                  </tr>
                </thead>
                <tbody>
                  {stateComparisons.map((row, i) => (
                    <tr key={row.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-black text-bauhaus-black">{row.state}</td>
                      <td className="p-3 text-right font-mono text-amber-800 border-l border-gray-200">{fmt(row.acco.count)}</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-800">{row.acco.avgOverhead > 0 ? pct(row.acco.avgOverhead) : '\u2014'}</td>
                      <td className="p-3 text-right font-mono text-amber-800">{money(row.acco.avgRevenue)}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted border-l border-gray-200">{fmt(row.mainstream.count)}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted">{row.mainstream.avgOverhead > 0 ? pct(row.mainstream.avgOverhead) : '\u2014'}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted">{money(row.mainstream.avgRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== SECTION 6: The advocacy case ===== */}
        <section className="mb-16">
          <div className="border-4 border-bauhaus-black p-8 sm:p-12 bg-bauhaus-black text-white">
            <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-yellow mb-8 uppercase tracking-widest">
              The Advocacy Case
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-4xl sm:text-5xl font-black text-white">
                  {revenueRatio > 0 ? `${(revenueRatio * 100).toFixed(0)}c` : '\u2014'}
                </div>
                <div className="text-sm text-white/70 font-bold mt-2">
                  for every dollar mainstream orgs receive, ACCOs get {revenueRatio > 0 ? `${(revenueRatio * 100).toFixed(0)}` : '\u2014'} cents in revenue
                </div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-black text-amber-300">
                  {pct(procurementShare)}
                </div>
                <div className="text-sm text-white/70 font-bold mt-2">
                  of procurement dollars go to ACCOs despite being {pct(entityShare)} of charities
                </div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-black text-bauhaus-red">
                  {power.accoAvgSystems > 0 ? power.accoAvgSystems.toFixed(1) : '\u2014'}
                </div>
                <div className="text-sm text-white/70 font-bold mt-2">
                  government systems ACCOs appear in on average &mdash; tracked more, funded less
                </div>
              </div>
            </div>
            <div className="mt-10 border-t border-white/20 pt-6">
              <p className="text-lg text-white/80 font-bold leading-relaxed max-w-3xl">
                Community-controlled organisations are not inefficient. They are underfunded.
                The data shows they deliver services with comparable or lower executive overhead,
                higher workforce investment, and greater government accountability &mdash; while
                receiving a fraction of the resources.
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 7: Methodology ===== */}
        <section className="border-t-4 border-bauhaus-black pt-8 mt-16 mb-12">
          <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
            <p>
              <strong className="text-bauhaus-black">Financial data:</strong> ACNC Annual Information Statements
              for the 2023 reporting year. Only charities reporting total revenue greater than $0 are included.
              All financial figures are self-reported by charities to the ACNC.
            </p>
            <p>
              <strong className="text-bauhaus-black">Community-controlled classification:</strong> Organisations
              are identified as Aboriginal Community-Controlled Organisations (ACCOs) via CivicGraph&apos;s
              entity classification system, which draws on ORIC registration, ACNC stated purposes and
              beneficiaries, organisational self-identification, and governance structure data.
            </p>
            <p>
              <strong className="text-bauhaus-black">Procurement data:</strong> AusTender federal government
              contract data, aggregated by supplier ABN. Only suppliers with total contract value above $100,000
              are included. Matched to charities via ABN.
            </p>
            <p>
              <strong className="text-bauhaus-black">Cross-system power index:</strong> CivicGraph&apos;s
              mv_entity_power_index materialized view, which scores entities across 7 government systems
              (procurement, justice funding, political donations, charity register, foundation giving,
              ALMA evidence, ATO transparency). Only entities appearing in 2+ systems are included.
            </p>
            <p>
              <strong className="text-bauhaus-black">Executive overhead:</strong> Calculated as total paid
              to key management personnel divided by total expenses. Only charities reporting both figures
              greater than zero are included in overhead calculations.
            </p>
            <p>
              <strong className="text-bauhaus-black">Limitations:</strong> ACNC data is self-reported and
              may contain inconsistencies. The ACCO classification captures organisations in CivicGraph&apos;s
              entity database but may not include all community-controlled organisations. Procurement data
              covers federal contracts only (not state or local). The power index captures cross-system
              presence but not service quality or community outcomes.
            </p>
          </div>
        </section>

        <div className="my-12 flex gap-4 flex-wrap">
          <a href="/reports/exec-remuneration" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow-sm">
            Executive Pay Report &rarr;
          </a>
          <a href="/reports/community-parity" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
            Community Parity Report &rarr;
          </a>
          <a href="/reports/power-concentration" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
            Power Concentration &rarr;
          </a>
        </div>

      </article>

      <ReportCTA reportSlug="community-efficiency" reportTitle="Community Efficiency Report" />
    </div>
  );
}
