import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tax Transparency | CivicGraph Investigation',
  description: 'Who gets government contracts -- and how much tax do they pay? ATO tax transparency data cross-referenced with $770B in AusTender contracts.',
  openGraph: {
    title: 'Tax Transparency: Contracts vs Tax',
    description: 'ATO tax transparency data cross-referenced with AusTender government contracts. Who gets the money and who pays the tax.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tax Transparency: Contracts vs Tax',
    description: 'ATO tax transparency data cross-referenced with AusTender government contracts.',
  },
};

function money(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function pct(n: number): string { return `${n.toFixed(1)}%`; }
function fmt(n: number): string { return n.toLocaleString(); }

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function taxRateColor(rate: number): string {
  if (rate < 5) return 'text-red-600 font-black';
  if (rate < 15) return 'text-orange-500 font-black';
  if (rate < 25) return 'text-yellow-600 font-bold';
  return 'text-green-600 font-bold';
}

function taxRateBg(rate: number): string {
  if (rate < 5) return 'bg-red-50';
  if (rate < 15) return 'bg-orange-50';
  if (rate < 25) return 'bg-yellow-50';
  return 'bg-green-50';
}

interface AtoRecord {
  abn: string;
  entity_name: string;
  total_income: number;
  taxable_income: number;
  tax_payable: number;
  effective_tax_rate: number;
  industry: string;
  report_year: string;
}

interface ContractAgg {
  supplier_abn: string;
  total_contracts: string;
  contract_count: string;
}

interface JoinedEntity {
  abn: string;
  entity_name: string;
  total_income: number;
  taxable_income: number;
  tax_payable: number;
  effective_tax_rate: number;
  industry: string;
  report_year: string;
  total_contracts: number;
  contract_count: number;
}

interface IndustryRow {
  industry: string;
  total_contracts: number;
  entity_count: number;
  avg_tax_rate: number;
}

interface Stats {
  totalEntitiesAnalyzed: number;
  lowTaxOver1MCount: number;
  totalContractsToLowTax: number;
  totalContractsToHighTax: number;
  avgTaxRateTopContractors: number;
  zeroTaxOver10MCount: number;
}

/** Paginate exec_sql using .range() to bypass PostgREST 1000-row cap */
async function paginatedRpc<T>(supabase: SupabaseClient, sql: string, maxRows = 10000): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data) all.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function getData(): Promise<{
  stats: Stats;
  topEntities: JoinedEntity[];
  lowTaxEntities: JoinedEntity[];
  zeroTaxSpotlight: JoinedEntity[];
  industries: IndustryRow[];
}> {
  const supabase = getServiceSupabase();

  // Step 1: Query ATO and contracts in parallel (paginated to bypass 1000-row cap)
  const [atoRecords, contractAggs] = await Promise.all([
    paginatedRpc<AtoRecord>(supabase, `
      SELECT DISTINCT ON (abn) abn, entity_name, total_income, taxable_income,
             tax_payable, effective_tax_rate, industry, report_year
      FROM ato_tax_transparency
      WHERE abn IS NOT NULL AND effective_tax_rate IS NOT NULL
      ORDER BY abn, report_year DESC
    `, 10000),
    paginatedRpc<ContractAgg>(supabase, `
      SELECT supplier_abn, SUM(contract_value)::text as total_contracts,
             COUNT(*)::text as contract_count
      FROM austender_contracts
      WHERE supplier_abn IS NOT NULL AND contract_value > 0
      GROUP BY supplier_abn
      HAVING SUM(contract_value) > 100000
    `, 50000),
  ]);

  // Build contract lookup
  const contractMap = new Map<string, { total: number; count: number }>();
  for (const c of contractAggs) {
    contractMap.set(c.supplier_abn, {
      total: Number(c.total_contracts),
      count: Number(c.contract_count),
    });
  }

  // Step 2: Initial join to find matched ABNs (ATO + contracts)
  const matchedAbns: string[] = [];
  const preJoined: { ato: AtoRecord; contract: { total: number; count: number } }[] = [];
  for (const ato of atoRecords) {
    const contract = contractMap.get(ato.abn);
    if (contract) {
      matchedAbns.push(ato.abn);
      preJoined.push({ ato, contract });
    }
  }

  // Step 3: Fetch entity types only for matched ABNs (small targeted query)
  const entityTypeMap = new Map<string, { entity_type: string; sector: string | null }>();
  if (matchedAbns.length > 0) {
    // Batch into chunks of 200 ABNs to avoid overly long SQL
    const BATCH = 200;
    const batches: Promise<{ abn: string; entity_type: string; sector: string | null }[]>[] = [];
    for (let i = 0; i < matchedAbns.length; i += BATCH) {
      const abnList = matchedAbns.slice(i, i + BATCH).map(a => `'${a}'`).join(',');
      batches.push(paginatedRpc<{ abn: string; entity_type: string; sector: string | null }>(supabase, `
        SELECT abn, entity_type, sector
        FROM gs_entities
        WHERE abn IN (${abnList}) AND entity_type IS NOT NULL
      `, 1000));
    }
    const results = await Promise.all(batches);
    for (const batch of results) {
      for (const e of batch) {
        entityTypeMap.set(e.abn, { entity_type: e.entity_type, sector: e.sector });
      }
    }
  }

  // Step 4: Final join with entity type enrichment
  const joined: JoinedEntity[] = [];
  for (const { ato, contract } of preJoined) {
    const gsEntity = entityTypeMap.get(ato.abn);
    const industry = ato.industry || gsEntity?.sector || gsEntity?.entity_type || 'Unknown';
    joined.push({
      abn: ato.abn,
      entity_name: ato.entity_name,
      total_income: Number(ato.total_income),
      taxable_income: Number(ato.taxable_income),
      tax_payable: Number(ato.tax_payable),
      effective_tax_rate: Number(ato.effective_tax_rate),
      industry,
      report_year: ato.report_year,
      total_contracts: contract.total,
      contract_count: contract.count,
    });
  }

  joined.sort((a, b) => b.total_contracts - a.total_contracts);

  // Stats
  const lowTaxThreshold = 5;
  const lowTaxEntities = joined.filter(e => e.effective_tax_rate < lowTaxThreshold);
  const lowTaxOver1M = lowTaxEntities.filter(e => e.total_contracts > 1_000_000);
  const highTaxEntities = joined.filter(e => e.effective_tax_rate >= 20);
  const zeroTaxOver10M = joined.filter(e => e.effective_tax_rate === 0 && e.total_contracts > 10_000_000);

  const totalContractsLowTax = lowTaxOver1M.reduce((s, e) => s + e.total_contracts, 0);
  const totalContractsHighTax = highTaxEntities.filter(e => e.total_contracts > 1_000_000)
    .reduce((s, e) => s + e.total_contracts, 0);
  const top50 = joined.slice(0, 50);
  const avgTaxRate = top50.length > 0
    ? top50.reduce((s, e) => s + e.effective_tax_rate, 0) / top50.length
    : 0;

  // Industry breakdown
  const industryMap = new Map<string, { contracts: number; count: number; totalTaxRate: number }>();
  for (const e of joined) {
    const ind = e.industry || 'Unknown';
    const existing = industryMap.get(ind) || { contracts: 0, count: 0, totalTaxRate: 0 };
    existing.contracts += e.total_contracts;
    existing.count += 1;
    existing.totalTaxRate += e.effective_tax_rate;
    industryMap.set(ind, existing);
  }
  const industries = Array.from(industryMap.entries())
    .map(([industry, data]) => ({
      industry,
      total_contracts: data.contracts,
      entity_count: data.count,
      avg_tax_rate: data.totalTaxRate / data.count,
    }))
    .sort((a, b) => b.total_contracts - a.total_contracts);

  return {
    stats: {
      totalEntitiesAnalyzed: joined.length,
      lowTaxOver1MCount: lowTaxOver1M.length,
      totalContractsToLowTax: totalContractsLowTax,
      totalContractsToHighTax: totalContractsHighTax,
      avgTaxRateTopContractors: Math.round(avgTaxRate * 10) / 10,
      zeroTaxOver10MCount: zeroTaxOver10M.length,
    },
    topEntities: joined.slice(0, 30),
    lowTaxEntities: lowTaxOver1M.slice(0, 60),
    zeroTaxSpotlight: zeroTaxOver10M.sort((a, b) => b.total_contracts - a.total_contracts),
    industries,
  };
}

export default async function TaxTransparencyReport() {
  const { stats: s, topEntities, lowTaxEntities, zeroTaxSpotlight, industries } = await getData();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-Dataset Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Tax Transparency
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Who gets government contracts &mdash; and how much tax do they pay?
          We cross-referenced {fmt(s.totalEntitiesAnalyzed)} entities from ATO tax transparency
          data against AusTender government contracts. {fmt(s.lowTaxOver1MCount)} entities hold
          over $1M in government contracts while paying less than 5% effective tax.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Entities Analyzed</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.totalEntitiesAnalyzed)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">ATO + AusTender matched</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Low Tax + Big Contracts</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.lowTaxOver1MCount)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">&gt;$1M contracts, &lt;5% tax</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Contracts to Low-Tax</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{money(s.totalContractsToLowTax)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">going to &lt;5% tax entities</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Avg Tax Rate</div>
            <div className="text-3xl sm:text-4xl font-black">{pct(s.avgTaxRateTopContractors)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">top 50 by contract value</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: ATO Tax Transparency Reports (2014&ndash;2024) &times; AusTender Contracts (770K+ records).
            Matched by ABN.
          </p>
        </div>
      </section>

      {/* Section 1: The Big Picture */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Big Picture
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Government contract dollars flowing to entities paying low effective tax rates
          versus those paying their fair share. The gap is stark.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-red-50">
            <div className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Under 5% Effective Tax</div>
            <div className="text-4xl sm:text-5xl font-black text-bauhaus-red mb-2">{money(s.totalContractsToLowTax)}</div>
            <div className="text-sm text-bauhaus-muted font-bold">
              in government contracts to {fmt(s.lowTaxOver1MCount)} entities
            </div>
            <div className="mt-4 text-xs text-red-600/60 font-bold">
              Entities with &gt;$1M in contracts and &lt;5% effective tax rate
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-green-50">
            <div className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">Over 20% Effective Tax</div>
            <div className="text-4xl sm:text-5xl font-black text-green-700 mb-2">{money(s.totalContractsToHighTax)}</div>
            <div className="text-sm text-bauhaus-muted font-bold">
              in government contracts to entities paying &gt;20% tax
            </div>
            <div className="mt-4 text-xs text-green-600/60 font-bold">
              Entities with &gt;$1M in contracts and &gt;20% effective tax rate
            </div>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="tax-transparency" reportTitle="Tax Transparency Report" variant="inline" />

      {/* Section 2: Top Contract Recipients by Tax Rate */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top Contract Recipients by Tax Rate
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 30 largest government contract holders, ranked by total contract value.
          Tax rate color coding: <span className="text-red-600 font-black">&lt;5%</span>,{' '}
          <span className="text-orange-500 font-black">5&ndash;15%</span>,{' '}
          <span className="text-yellow-600 font-bold">15&ndash;25%</span>,{' '}
          <span className="text-green-600 font-bold">&gt;25%</span>.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Income</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Tax Paid</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              {topEntities.map((e, i) => (
                <tr key={e.abn} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${taxRateBg(e.effective_tax_rate)}`}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/org/${slugify(e.entity_name)}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.entity_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {e.industry || 'Unknown'} &middot; {e.report_year}
                      </div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(e.total_contracts)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(e.total_income)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">{money(e.tax_payable)}</td>
                  <td className={`p-3 text-right font-mono whitespace-nowrap ${taxRateColor(e.effective_tax_rate)}`}>
                    {pct(e.effective_tax_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right">
          <Link href="/api/data/tax-transparency" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            Full Data (API) &rarr;
          </Link>
        </div>
      </section>

      {/* Section 3: Industry Breakdown */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Industry Breakdown
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Which industries get the most government contracts &mdash; and what do they actually pay in tax?
          Grouped by ATO industry classification.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-blue text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Industry</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Entities</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              {industries.slice(0, 20).map((ind, i) => (
                <tr key={ind.industry} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                  <td className="p-3 font-bold text-bauhaus-black text-xs">{ind.industry}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(ind.total_contracts)}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(ind.entity_count)}</td>
                  <td className={`p-3 text-right font-mono whitespace-nowrap ${taxRateColor(ind.avg_tax_rate)}`}>
                    {pct(ind.avg_tax_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Zero Tax Spotlight */}
      {zeroTaxSpotlight.length > 0 && (
        <section className="mb-12">
          <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
            <h2 className="text-lg font-black mb-2 text-bauhaus-yellow uppercase tracking-widest">
              Zero Tax, Maximum Contracts
            </h2>
            <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
              {fmt(s.zeroTaxOver10MCount)} entities report a 0% effective tax rate to the ATO while
              holding over $10M in government contracts. These are the most dramatic cases in
              the dataset &mdash; billions in public money flowing to entities that pay no
              income tax.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest w-8">#</th>
                    <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">Entity</th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Contracts</th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden sm:table-cell">Income</th>
                    <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden md:table-cell">Tax Paid</th>
                    <th className="text-right p-2 text-xs font-black text-bauhaus-red uppercase tracking-widest">Tax Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {zeroTaxSpotlight.map((e, i) => (
                    <tr key={e.abn} className="border-b border-white/10">
                      <td className="p-2 font-black text-white/40">{i + 1}</td>
                      <td className="p-2">
                        <Link href={`/org/${slugify(e.entity_name)}`} className="hover:text-bauhaus-yellow transition-colors">
                          <div className="font-bold text-white">{e.entity_name}</div>
                          <div className="text-xs text-white/50">{e.industry || 'Unknown'} &middot; {e.report_year}</div>
                        </Link>
                      </td>
                      <td className="p-2 text-right font-mono font-black text-bauhaus-yellow whitespace-nowrap">{money(e.total_contracts)}</td>
                      <td className="p-2 text-right font-mono text-white/70 whitespace-nowrap hidden sm:table-cell">{money(e.total_income)}</td>
                      <td className="p-2 text-right font-mono text-white/70 whitespace-nowrap hidden md:table-cell">{money(e.tax_payable)}</td>
                      <td className="p-2 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">0.0%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Low Tax Entities Full Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          All Low-Tax Contract Holders
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Entities with over $1M in government contracts and less than 5% effective tax rate,
          sorted by contract value. {fmt(s.lowTaxOver1MCount)} entities total.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Income</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Tax Paid</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Rate</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden lg:table-cell">Industry</th>
              </tr>
            </thead>
            <tbody>
              {lowTaxEntities.map((e, i) => (
                <tr key={e.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/org/${slugify(e.entity_name)}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.entity_name}</div>
                      <div className="text-xs text-bauhaus-muted">{e.report_year}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(e.total_contracts)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(e.total_income)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden md:table-cell">{money(e.tax_payable)}</td>
                  <td className={`p-3 text-right font-mono whitespace-nowrap ${taxRateColor(e.effective_tax_rate)}`}>
                    {pct(e.effective_tax_rate)}
                  </td>
                  <td className="p-3 text-xs text-bauhaus-muted hidden lg:table-cell">{e.industry || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Data sources:</strong> ATO corporate tax transparency reports (2014&ndash;2024,
              26,000+ records) cross-referenced with AusTender government contract data (770,000+
              contracts) by Australian Business Number (ABN).
            </p>
            <p>
              <strong>Effective tax rate:</strong> Calculated as tax payable divided by taxable income,
              as reported in the ATO transparency data. This rate reflects the entity&apos;s Australian
              corporate tax position and may differ from the statutory 30% rate due to deductions,
              offsets, losses carried forward, and other legitimate tax planning measures.
            </p>
            <p>
              <strong>Why low tax is not necessarily tax avoidance:</strong> Many entities with low
              effective tax rates have legitimate reasons. These include: carrying forward prior-year
              losses (common in cyclical industries and after acquisitions), research &amp; development
              tax incentives, franking credit offsets, consolidated group reporting where the parent
              pays tax on behalf of subsidiaries, and foreign-headquartered entities whose Australian
              subsidiaries may have different tax positions.
            </p>
            <p>
              <strong>ATO transparency threshold:</strong> The ATO only publishes tax data for
              Australian public and foreign-owned entities with total income above $100 million,
              and Australian-owned private entities with total income above $200 million. This means
              the dataset skews toward large entities.
            </p>
            <p>
              <strong>Contract aggregation:</strong> AusTender contract values are summed across all
              years and all government buyers. A single entity may hold contracts with multiple
              agencies spanning different time periods. Contract values represent the full estimated
              value, not necessarily the amount paid to date.
            </p>
            <p>
              <strong>Limitations:</strong> ABN matching may miss entities operating under multiple
              ABNs or trading names. Some multinational entities report Australian operations under
              different structures than those holding government contracts. Tax data is reported
              at the entity level, while contracts may be held by subsidiaries or related entities
              with different ABNs.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Full Dataset</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Search entities by ABN, explore their government contracts, political donations,
            and tax position across all CivicGraph datasets.
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
              href="/api/data/tax-transparency"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Raw Data API
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="tax-transparency" reportTitle="Tax Transparency Report" />
    </div>
  );
}
