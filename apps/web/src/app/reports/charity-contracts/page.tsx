import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Charity Executive Pay vs Government Contracts | CivicGraph Investigation',
  description:
    'Charities receiving large government contracts AND paying high executive compensation. The double dip story — ACNC AIS data cross-referenced with AusTender contracts.',
  openGraph: {
    title: 'The Charity-Government Contract Pipeline',
    description:
      'Charities receiving large government contracts AND paying high executive compensation. ACNC data cross-referenced with AusTender by ABN.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Charity-Government Contract Pipeline',
    description:
      'Charities receiving large government contracts AND paying high executive compensation.',
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
  total_paid_key_management: number;
  revenue_from_government: number;
}

interface ContractAgg {
  supplier_abn: string;
  total_contracts: number;
  contract_count: number;
}

interface JoinedRow {
  abn: string;
  charity_name: string;
  charity_size: string;
  total_revenue: number;
  total_expenses: number;
  exec_pay: number;
  revenue_from_government: number;
  total_contracts: number;
  contract_count: number;
  exec_to_contract_pct: number;
  isAcco: boolean;
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
        .select(
          'abn, charity_name, charity_size, total_revenue, total_expenses, total_paid_key_management, revenue_from_government'
        )
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

  // Query 2: Aggregated contracts by supplier ABN (using exec_sql RPC for pre-aggregation)
  const contractData = await safe(async () => {
    const { data, error } = await db.rpc('exec_sql', {
      query: `SELECT supplier_abn, SUM(contract_value) as total_contracts, COUNT(*) as contract_count FROM austender_contracts WHERE supplier_abn IS NOT NULL GROUP BY supplier_abn HAVING SUM(contract_value) > 1000000 ORDER BY total_contracts DESC`,
    });
    if (error) throw new Error(error.message);
    return (data as ContractAgg[]) || [];
  }, [] as ContractAgg[]);

  // Query 3: Community-controlled ABNs
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

  // Build contract lookup by ABN
  const contractMap = new Map<string, ContractAgg>();
  for (const c of contractData) {
    contractMap.set(c.supplier_abn, c);
  }

  // Build AIS lookup by ABN
  const aisMap = new Map<string, AisRecord>();
  for (const r of aisData) {
    if (r.abn) aisMap.set(r.abn, r);
  }

  // Join: charities that have BOTH exec pay AND contracts
  const joined: JoinedRow[] = [];
  for (const ais of aisData) {
    const contract = contractMap.get(ais.abn);
    if (!contract) continue;
    const execPay = Number(ais.total_paid_key_management) || 0;
    const totalContracts = Number(contract.total_contracts) || 0;
    joined.push({
      abn: ais.abn,
      charity_name: ais.charity_name,
      charity_size: ais.charity_size,
      total_revenue: Number(ais.total_revenue) || 0,
      total_expenses: Number(ais.total_expenses) || 0,
      exec_pay: execPay,
      revenue_from_government: Number(ais.revenue_from_government) || 0,
      total_contracts: totalContracts,
      contract_count: Number(contract.contract_count) || 0,
      exec_to_contract_pct: totalContracts > 0 ? (execPay / totalContracts) * 100 : 0,
      isAcco: accoAbns.has(ais.abn),
    });
  }

  /* ---- Key stats ---- */
  const totalWithBoth = joined.length;
  const totalContractValue = joined.reduce((s, r) => s + r.total_contracts, 0);
  const avgExecPay =
    totalWithBoth > 0 ? joined.reduce((s, r) => s + r.exec_pay, 0) / totalWithBoth : 0;
  const avgExecToContract =
    totalWithBoth > 0
      ? joined.reduce((s, r) => s + r.exec_to_contract_pct, 0) / totalWithBoth
      : 0;

  /* ---- Top 20 by contract value ---- */
  const top20ByContract = [...joined]
    .sort((a, b) => b.total_contracts - a.total_contracts)
    .slice(0, 20);

  /* ---- Top 20 by exec-to-contract ratio ---- */
  const top20ByRatio = joined
    .filter((r) => r.total_contracts > 5_000_000 && r.exec_pay > 500_000)
    .sort((a, b) => b.exec_to_contract_pct - a.exec_to_contract_pct)
    .slice(0, 20);

  /* ---- ACCO vs Mainstream ---- */
  const accoRows = joined.filter((r) => r.isAcco);
  const mainstreamRows = joined.filter((r) => !r.isAcco);

  function groupStats(group: JoinedRow[]) {
    if (group.length === 0)
      return { count: 0, avgContracts: 0, avgExecPay: 0, avgRatio: 0 };
    return {
      count: group.length,
      avgContracts: group.reduce((s, r) => s + r.total_contracts, 0) / group.length,
      avgExecPay: group.reduce((s, r) => s + r.exec_pay, 0) / group.length,
      avgRatio:
        group.reduce((s, r) => s + r.exec_to_contract_pct, 0) / group.length,
    };
  }

  const accoStats = groupStats(accoRows);
  const mainstreamStats = groupStats(mainstreamRows);

  /* ---- Big number: total exec pay across ALL charities with exec data ---- */
  const totalExecPayAllCharities = aisData.reduce(
    (s, r) => s + (Number(r.total_paid_key_management) || 0),
    0
  );
  const totalContractsToCharitySector = joined.reduce(
    (s, r) => s + r.total_contracts,
    0
  );
  const execAsPctOfContracts =
    totalContractsToCharitySector > 0
      ? (totalExecPayAllCharities / totalContractsToCharitySector) * 100
      : 0;

  return {
    totalWithBoth,
    totalContractValue,
    avgExecPay,
    avgExecToContract,
    top20ByContract,
    top20ByRatio,
    accoStats,
    mainstreamStats,
    totalExecPayAllCharities,
    execAsPctOfContracts,
  };
}

/* ---------- page ---------- */

export default async function CharityContractsReport() {
  const {
    totalWithBoth,
    totalContractValue,
    avgExecPay,
    avgExecToContract,
    top20ByContract,
    top20ByRatio,
    accoStats,
    mainstreamStats,
    totalExecPayAllCharities,
    execAsPctOfContracts,
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
          The Charity-Government Contract Pipeline
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Charities that receive large government contracts and pay high executive salaries. We
          cross-referenced ACNC Annual Information Statements (2023) with AusTender contract data by
          ABN to find the &ldquo;double dip&rdquo; &mdash; organisations drawing public money through
          procurement while paying significant executive compensation.
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

      {/* Section 1: Key Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Charities with Both
            </div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(totalWithBoth)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              exec pay + gov contracts
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">
              Total Contract Value
            </div>
            <div className="text-3xl sm:text-4xl font-black">{money(totalContractValue)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">
              to charities with exec pay
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Avg Exec Pay
            </div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">
              {money(avgExecPay)}
            </div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">
              at contracted charities
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">
              Exec Pay % of Contracts
            </div>
            <div className="text-3xl sm:text-4xl font-black">{pct(avgExecToContract)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">avg ratio</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ACNC AIS (2023) cross-referenced with AusTender contracts by ABN. Only charities
            with exec pay &gt; $0 and contracts &gt; $1M.
          </p>
        </div>
      </section>

      {/* Section 2: Top 20 by contract value */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 20: Largest Government Contracts
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 charities receiving the most in government contracts that also report executive
          remuneration data. How much public money flows to these organisations, and what do their
          executives earn?
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
                  Contracts
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                  Exec Pay
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                  Exec/Contract %
                </th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                  Gov Revenue
                </th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {top20ByContract.map((r, i) => (
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
                    {money(r.total_contracts)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap">
                    {money(r.exec_pay)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                    {pct(r.exec_to_contract_pct)}
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                    {money(r.revenue_from_government)}
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

      {/* Section 3: Top 20 by exec-to-contract ratio */}
      {top20ByRatio.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Top 20: Highest Exec-to-Contract Ratio
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Charities where executive pay is highest relative to their government contract value.
            Filtered to organisations with contracts &gt; $5M and exec pay &gt; $500K to exclude
            outliers.
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
                    Exec/Contract %
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                    Exec Pay
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">
                    Contracts
                  </th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">
                    Gov Revenue
                  </th>
                  <th className="text-center p-3 font-black uppercase tracking-widest text-xs">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {top20ByRatio.map((r, i) => (
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
                      {pct(r.exec_to_contract_pct)}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">
                      {money(r.exec_pay)}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">
                      {money(r.total_contracts)}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">
                      {money(r.revenue_from_government)}
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
      )}

      <ReportCTA
        reportSlug="charity-contracts"
        reportTitle="Charity-Government Contract Pipeline"
        variant="inline"
      />

      {/* Section 4: ACCO vs Mainstream */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Community-Controlled vs Mainstream
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          For charities with both government contracts and executive pay data &mdash; how do
          Aboriginal Community-Controlled Organisations (ACCOs) compare with mainstream charities?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ACCO side */}
          <div className="border-4 border-bauhaus-black p-6 bg-amber-50">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest">
                ACCO
              </span>
              <span className="text-xs text-bauhaus-muted font-bold">
                {fmt(accoStats.count)} organisations
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                  Avg Contract Value
                </div>
                <div className="text-2xl font-black text-bauhaus-black">
                  {money(accoStats.avgContracts)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Avg Exec Pay
                  </div>
                  <div className="text-sm font-black text-bauhaus-red">
                    {money(accoStats.avgExecPay)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Avg Exec/Contract %
                  </div>
                  <div className="text-sm font-black">{pct(accoStats.avgRatio)}</div>
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
                {fmt(mainstreamStats.count)} organisations
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-bauhaus-muted font-bold uppercase tracking-widest">
                  Avg Contract Value
                </div>
                <div className="text-2xl font-black text-bauhaus-black">
                  {money(mainstreamStats.avgContracts)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Avg Exec Pay
                  </div>
                  <div className="text-sm font-black text-bauhaus-red">
                    {money(mainstreamStats.avgExecPay)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-bauhaus-muted font-bold uppercase">
                    Avg Exec/Contract %
                  </div>
                  <div className="text-sm font-black">{pct(mainstreamStats.avgRatio)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: The Big Number */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 sm:p-12 bg-bauhaus-black text-white text-center">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-4">
            The Big Question
          </div>
          <div className="text-4xl sm:text-6xl font-black text-bauhaus-yellow mb-4">
            {money(totalExecPayAllCharities)}
          </div>
          <p className="text-lg sm:text-xl font-black text-white/90 max-w-2xl mx-auto mb-4">
            Australia&apos;s charities pay {money(totalExecPayAllCharities)} in executive
            compensation.
          </p>
          <p className="text-base text-white/70 max-w-2xl mx-auto leading-relaxed">
            That&apos;s{' '}
            <span className="font-black text-bauhaus-yellow">{pct(execAsPctOfContracts)}</span> of
            the total government contracts flowing to the charity sector. Every dollar paid to an
            executive is a dollar not reaching communities.
          </p>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">
            Methodology
          </h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Data sources:</strong> ACNC Annual Information Statements (AIS) for the 2023
              reporting year, cross-referenced with AusTender government contract data by ABN. Only
              charities that reported key management personnel remuneration greater than $0 and hold
              AusTender contracts totalling over $1M are included.
            </p>
            <p>
              <strong>Executive compensation:</strong> Total paid to key management personnel as
              reported in the ACNC AIS. This includes salary, superannuation, bonuses, and
              allowances for key management personnel as defined by ACNC reporting requirements.
            </p>
            <p>
              <strong>Contract values:</strong> Total AusTender contract value aggregated by supplier
              ABN across all years. This is cumulative &mdash; not limited to a single year &mdash;
              to show the full scale of the government-charity procurement relationship.
            </p>
            <p>
              <strong>Exec-to-contract ratio:</strong> Annual executive pay (2023) divided by total
              contract value (all years). A lower number means more contract revenue per dollar of
              executive pay. Note this compares a single year of pay against cumulative contracts,
              which may overstate the efficiency of long-running relationships.
            </p>
            <p>
              <strong>Community-controlled identification:</strong> Organisations classified as
              Aboriginal Community-Controlled Organisations (ACCOs) based on CivicGraph&apos;s entity
              classification, drawing on ORIC registration, ACNC purposes, self-identification, and
              governance structure data.
            </p>
            <p>
              <strong>Limitations:</strong> The AIS is self-reported. Not all charities report exec
              remuneration. AusTender data may not capture all government contracts (state/territory
              contracts are not included). Some charities operate under multiple ABNs.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Full Dataset</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Search charities by ABN, explore their governance, contracts, and executive remuneration
            across all CivicGraph datasets.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/entities"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Entity Search
            </Link>
            <Link
              href="/reports/exec-remuneration"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Exec Pay Report
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
        reportSlug="charity-contracts"
        reportTitle="Charity-Government Contract Pipeline"
      />
    </div>
  );
}
