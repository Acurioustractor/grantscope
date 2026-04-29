import { getServiceSupabase } from '@/lib/report-supabase';
import { money, fmt } from '@/lib/format';

export const dynamic = 'force-dynamic';

function pct(n: number, d: number) { return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%'; }

interface EntitySummary { entity_type: string; contracts: number; total_value: number; }
interface ProcRow { entity_type: string; procurement_method: string; contracts: number; total_value: number; }
interface CharityRow { name: string; abn: string; contracts: number; total_value: number; }
interface OricRow { name: string; abn: string; state: string | null; contracts: number; total_value: number; }
interface TaxRow { supplier_name: string; supplier_abn: string; contracts: number; govt_value: number; entity_name: string; total_income: number; taxable_income: number | null; tax_payable: number | null; report_year: string; effective_rate: number; }
interface LargeEntity { entity_name: string; total_income: number; taxable_income: number | null; tax_payable: number | null; report_year: string; effective_rate: number; }
interface Stats { total_contracts: number; total_value: number; unique_suppliers: number; contracts_with_abn: number; }
interface GrantProvider { provider: string; grant_count: number; total_funding: number; avg_funding: number; foundation_name: string | null; foundation_giving: number | null; }
interface GrantFocus { focus_area: string; grant_count: number; total_funding: number; avg_funding: number; }
interface GrantStats { total_grants: number; unique_providers: number; unique_sources: number; still_open: number; avg_max_amount: number; total_max_funding: number; }

async function getData() {
  const supabase = getServiceSupabase();

  const [
    { data: entitySummary },
    { data: procByType },
    { data: topCharities },
    { data: topOric },
    { data: supplierTax },
    { data: largeEntities },
    { data: statsArr },
    { count: charityCount },
    { count: oricCount },
    { count: asicCount },
    { count: atoCount },
    { count: foundationCount },
  ] = await Promise.all([
    supabase.from('v_austender_entity_summary').select('*'),
    supabase.from('v_austender_procurement_by_type').select('*'),
    supabase.from('v_austender_top_charities').select('*'),
    supabase.from('v_austender_top_oric').select('*'),
    supabase.from('v_austender_supplier_tax').select('*'),
    supabase.from('v_ato_largest_entities').select('*'),
    supabase.from('v_austender_stats').select('*'),
    supabase.from('acnc_charities').select('*', { count: 'exact', head: true }),
    supabase.from('oric_corporations').select('*', { count: 'exact', head: true }),
    supabase.from('asic_companies').select('*', { count: 'exact', head: true }),
    supabase.from('ato_tax_transparency').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
  ]);

  // Grant data
  const [
    { data: grantProviders },
    { data: grantFocusAreas },
    { data: grantStatsArr },
  ] = await Promise.all([
    supabase.from('v_grant_provider_summary').select('*'),
    supabase.from('v_grant_focus_areas').select('*'),
    supabase.from('v_grant_stats').select('*'),
  ]);

  const stats = (statsArr as Stats[] || [])[0] || { total_contracts: 0, total_value: 0, unique_suppliers: 0, contracts_with_abn: 0 };
  const grantStats = (grantStatsArr as GrantStats[] || [])[0] || { total_grants: 0, unique_providers: 0, unique_sources: 0, still_open: 0, avg_max_amount: 0, total_max_funding: 0 };

  return {
    entitySummary: (entitySummary || []) as EntitySummary[],
    procByType: (procByType || []) as ProcRow[],
    topCharities: (topCharities || []) as CharityRow[],
    topOric: (topOric || []) as OricRow[],
    supplierTax: (supplierTax || []) as TaxRow[],
    largeEntities: (largeEntities || []) as LargeEntity[],
    grantProviders: (grantProviders || []) as GrantProvider[],
    grantFocusAreas: (grantFocusAreas || []) as GrantFocus[],
    grantStats,
    stats,
    charityCount: charityCount || 0,
    oricCount: oricCount || 0,
    asicCount: asicCount || 0,
    atoCount: atoCount || 0,
    foundationCount: foundationCount || 0,
  };
}

export default async function CrossReferencePage() {
  const d = await getData();

  const totalValue = Number(d.stats.total_value) || 0;
  const totalContracts = Number(d.stats.total_contracts) || 0;

  const entityTotals: Record<string, { contracts: number; value: number }> = {};
  for (const row of d.entitySummary) {
    entityTotals[row.entity_type] = { contracts: Number(row.contracts), value: Number(row.total_value) };
  }
  const corpValue = entityTotals['Corporate/Other']?.value || 0;
  const charityValue = entityTotals['Charity']?.value || 0;
  const oricValue = entityTotals['Indigenous Corp']?.value || 0;

  // Group procurement by entity type
  const procByEntity: Record<string, Array<{ method: string; contracts: number; value: number }>> = {};
  for (const row of d.procByType) {
    if (!procByEntity[row.entity_type]) procByEntity[row.entity_type] = [];
    procByEntity[row.entity_type].push({
      method: row.procurement_method,
      contracts: Number(row.contracts),
      value: Number(row.total_value),
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Live Cross-Reference Analysis</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The $74 Billion Question
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Who receives Australia&apos;s government contracts? What tax do they pay? How much reaches
          charities and Indigenous organisations? For the first time, we connected the datasets to find out.
        </p>
      </div>

      {/* Hero stat: the disparity */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Corporate &amp; Other</div>
            <div className="text-4xl sm:text-5xl font-black">{money(corpValue)}</div>
            <div className="text-white/60 text-sm font-bold mt-2">{fmt(entityTotals['Corporate/Other']?.contracts || 0)} contracts</div>
            <div className="text-white/40 text-xs font-bold mt-1">{pct(corpValue, totalValue)} of all procurement</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Charities</div>
            <div className="text-4xl sm:text-5xl font-black">{money(charityValue)}</div>
            <div className="text-white/60 text-sm font-bold mt-2">{fmt(entityTotals['Charity']?.contracts || 0)} contracts</div>
            <div className="text-white/40 text-xs font-bold mt-1">{pct(charityValue, totalValue)} of all procurement</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Indigenous Corporations</div>
            <div className="text-4xl sm:text-5xl font-black">{money(oricValue)}</div>
            <div className="text-white/60 text-sm font-bold mt-2">{fmt(entityTotals['Indigenous Corp']?.contracts || 0)} contracts</div>
            <div className="text-white/40 text-xs font-bold mt-1">{pct(oricValue, totalValue)} of all procurement</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: {fmt(totalContracts)} AusTender contracts worth {money(totalValue)} cross-referenced against{' '}
            {fmt(d.charityCount)} ACNC charities and {fmt(d.oricCount)} ORIC Indigenous corporations by ABN.
          </p>
        </div>
      </section>

      {/* The Open Tender Illusion */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">The Open Tender Illusion</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          &ldquo;Open&rdquo; procurement should mean equal access. The data shows otherwise.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity Type</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Method</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Value</th>
              </tr>
            </thead>
            <tbody>
              {(['Corporate/Other', 'Charity', 'Indigenous Corp'] as const).map((type) =>
                (procByEntity[type] || []).map((row, i) => (
                  <tr key={`${type}-${row.method}`} className={i === 0 ? 'border-t-2 border-bauhaus-black/20' : ''}>
                    {i === 0 && (
                      <td className="p-3 font-black text-bauhaus-black align-top" rowSpan={(procByEntity[type] || []).length}>
                        <span className={
                          type === 'Indigenous Corp' ? 'text-bauhaus-red' :
                          type === 'Charity' ? 'text-bauhaus-blue' : ''
                        }>{type}</span>
                      </td>
                    )}
                    <td className="p-3 text-bauhaus-muted capitalize">{row.method}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.contracts)}</td>
                    <td className="p-3 text-right font-mono font-bold">{money(row.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {oricValue > 0 && (
          <div className="border-4 border-t-0 border-bauhaus-red p-6 bg-bauhaus-red/5">
            <p className="text-sm font-black text-bauhaus-red">
              Indigenous corporations received zero open tenders. Every contract was &ldquo;limited&rdquo; —
              meaning they were specifically invited, not competing on a level playing field.
              The total value of all Indigenous procurement ({money(oricValue)}) is{' '}
              {corpValue > 0 ? `${(corpValue / Math.max(oricValue, 1)).toFixed(0)}x` : '—'} less
              than corporate procurement.
            </p>
          </div>
        )}
      </section>

      {/* Charities in Government */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Charities Winning Government Contracts</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The top charities by federal procurement value. Employment services and
          disability providers dominate — effectively government programs outsourced to the
          not-for-profit sector.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-blue text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Charity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {d.topCharities.map((row, i) => (
                <tr key={row.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{row.name}</div>
                    <div className="text-xs text-bauhaus-muted font-mono">ABN {row.abn}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(Number(row.contracts))}</td>
                  <td className="p-3 text-right font-mono font-black">{money(Number(row.total_value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Indigenous Corporations */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Indigenous Corporations in Federal Procurement</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Of {fmt(d.oricCount)} Indigenous corporations registered with ORIC,
          only a handful appear in federal procurement data. Their combined total is a fraction
          of what a single large charity receives.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Corporation</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {d.topOric.map((row, i) => (
                <tr key={row.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{row.name}</div>
                    <div className="text-xs text-bauhaus-muted font-mono">ABN {row.abn}</div>
                  </td>
                  <td className="p-3 font-bold text-bauhaus-muted">{row.state || '—'}</td>
                  <td className="p-3 text-right font-mono">{fmt(Number(row.contracts))}</td>
                  <td className="p-3 text-right font-mono font-black">{money(Number(row.total_value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.topOric.length > 0 && d.topCharities.length > 0 && (
          <div className="border-4 border-t-0 border-bauhaus-black p-6 bg-bauhaus-canvas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">All Indigenous Corps Combined</div>
                <div className="text-2xl font-black text-bauhaus-red">{money(oricValue)}</div>
              </div>
              <div>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Single Largest Charity Contract</div>
                <div className="text-2xl font-black text-bauhaus-blue">{money(Number(d.topCharities[0]?.total_value || 0))}</div>
                <div className="text-xs text-bauhaus-muted">{d.topCharities[0]?.name || ''}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tax vs Contracts */}
      {d.supplierTax.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Tax vs. Government Contracts</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Cross-referencing AusTender suppliers with ATO Corporate Tax Transparency data.
            How much tax do the biggest recipients of government money actually pay?
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Supplier</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Govt Contracts</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Income</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Paid</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Eff. Rate</th>
                </tr>
              </thead>
              <tbody>
                {d.supplierTax.map((row, i) => {
                  const income = Number(row.total_income) || 0;
                  const tax = Number(row.tax_payable) || 0;
                  const effRate = Number(row.effective_rate) || 0;
                  const isLow = income > 0 && effRate > 0 && effRate < 5;
                  const isZero = income > 0 && tax === 0;
                  return (
                    <tr key={`${row.supplier_abn}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        <div className="font-bold text-bauhaus-black">{row.supplier_name}</div>
                        <div className="text-xs text-bauhaus-muted">{row.report_year}</div>
                      </td>
                      <td className="p-3 text-right font-mono">{money(Number(row.govt_value))}</td>
                      <td className="p-3 text-right font-mono">{money(income)}</td>
                      <td className={`p-3 text-right font-mono font-black ${isZero ? 'text-bauhaus-red' : isLow ? 'text-orange-600' : ''}`}>
                        {tax > 0 ? money(tax) : '$0'}
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${isZero ? 'text-bauhaus-red' : isLow ? 'text-orange-600' : ''}`}>
                        {effRate > 0 ? `${effRate}%` : '0%'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas">
            <p className="text-xs text-bauhaus-muted">
              Effective tax rate = tax payable ÷ total income. The Australian corporate tax rate is 30%.
              Only suppliers whose ABN matched ATO Corporate Tax Transparency records are shown.
            </p>
          </div>
        </section>
      )}

      {/* Biggest Entities by Income */}
      {d.largeEntities.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Australia&apos;s Largest Entities by Income</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Every entity reporting over $1 billion in income. The statutory corporate rate is 30%.
            The gap between statutory and effective tells the story.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Income</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Paid</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Eff. Rate</th>
                </tr>
              </thead>
              <tbody>
                {d.largeEntities.map((row, i) => {
                  const rate = Number(row.effective_rate) || 0;
                  const isLow = rate > 0 && rate < 5;
                  const isZero = rate === 0;
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-bold text-bauhaus-black text-xs">{row.entity_name}</td>
                      <td className="p-3 text-right font-mono">{money(Number(row.total_income))}</td>
                      <td className={`p-3 text-right font-mono font-black ${isZero ? 'text-bauhaus-red' : isLow ? 'text-orange-600' : ''}`}>
                        {Number(row.tax_payable) > 0 ? money(Number(row.tax_payable)) : '$0'}
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${isZero ? 'text-bauhaus-red' : isLow ? 'text-orange-600' : ''}`}>
                        {rate > 0 ? `${rate}%` : '0%'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Grant Funding Landscape */}
      {d.grantProviders.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">The Grant Funding Landscape</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            {fmt(Number(d.grantStats.total_grants))} grant opportunities from{' '}
            {fmt(Number(d.grantStats.unique_providers))} providers, worth up to{' '}
            {money(Number(d.grantStats.total_max_funding))} in total funding.
            Where foundations also appear as grant providers, we can trace money from source to opportunity.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-0">
            {/* Top providers */}
            <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
              <div className="bg-bauhaus-yellow p-3">
                <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-widest">Top Grant Providers</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 font-black text-xs text-bauhaus-muted">Provider</th>
                    <th className="text-right p-2 font-black text-xs text-bauhaus-muted">Grants</th>
                    <th className="text-right p-2 font-black text-xs text-bauhaus-muted">Max Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {d.grantProviders.slice(0, 15).map((row, i) => (
                    <tr key={row.provider} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2">
                        <div className="font-bold text-bauhaus-black text-xs truncate max-w-[200px]">{row.provider}</div>
                        {row.foundation_name && (
                          <div className="text-[10px] text-bauhaus-blue font-bold">Foundation match: {money(Number(row.foundation_giving || 0))}/yr</div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono text-xs">{fmt(Number(row.grant_count))}</td>
                      <td className="p-2 text-right font-mono text-xs font-bold">{money(Number(row.total_funding))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Focus areas */}
            <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black bg-white overflow-x-auto">
              <div className="bg-bauhaus-blue p-3">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Funding by Focus Area</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 font-black text-xs text-bauhaus-muted">Focus Area</th>
                    <th className="text-right p-2 font-black text-xs text-bauhaus-muted">Grants</th>
                    <th className="text-right p-2 font-black text-xs text-bauhaus-muted">Max Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {d.grantFocusAreas.slice(0, 15).map((row, i) => (
                    <tr key={row.focus_area} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 font-bold text-bauhaus-black text-xs">{row.focus_area}</td>
                      <td className="p-2 text-right font-mono text-xs">{fmt(Number(row.grant_count))}</td>
                      <td className="p-2 text-right font-mono text-xs font-bold">{money(Number(row.total_funding))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* The Connected Dataset */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">The Connected Dataset</h2>
          <p className="text-white/90 leading-relaxed mb-6">
            This page is generated from live cross-references between {fmt(Number(d.stats.total_contracts))} government contracts,
            {' '}{fmt(d.charityCount)} charities, {fmt(d.oricCount)} Indigenous corporations,
            {' '}{fmt(d.asicCount)} ASIC-registered companies, and {fmt(d.atoCount)} corporate tax records.
            Every number updates in real time as new data is ingested.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'AusTender', value: fmt(Number(d.stats.total_contracts)), unit: 'contracts' },
              { label: 'ACNC', value: fmt(d.charityCount), unit: 'charities' },
              { label: 'ORIC', value: fmt(d.oricCount), unit: 'Indigenous corps' },
              { label: 'ASIC', value: fmt(d.asicCount), unit: 'companies' },
              { label: 'ATO', value: fmt(d.atoCount), unit: 'tax records' },
              { label: 'Foundations', value: fmt(d.foundationCount), unit: 'giving foundations' },
              { label: 'Grants', value: fmt(Number(d.grantStats.total_grants)), unit: 'opportunities' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-1">{s.label}</div>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-white/40 text-xs">{s.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-6 bg-white">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted space-y-2">
            <p>
              <span className="font-black text-bauhaus-black">Cross-reference key:</span>{' '}
              Australian Business Number (ABN). Every entity registered in Australia has a unique ABN.
              We match supplier ABNs from AusTender contracts against ACNC charity registrations,
              ORIC Indigenous corporation registrations, and ATO tax transparency disclosures.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Data sources:</span>{' '}
              AusTender (data.gov.au OCDS API), ACNC Charity Register (bulk CSV), ORIC Public Register,
              ATO Corporate Tax Transparency (data.gov.au), ASIC Company Register (data.gov.au).
              All datasets are publicly licensed under CC-BY 3.0 AU.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Limitations:</span>{' '}
              AusTender covers federal procurement only (not state/territory). ATO transparency data
              only includes entities with total income &ge;$100M (or &ge;$200M before 2023-24).
              Some entities operate through subsidiaries with different ABNs, which may not be linked.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
