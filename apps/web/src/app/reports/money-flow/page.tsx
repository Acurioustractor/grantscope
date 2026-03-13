import { getServiceSupabase } from '@/lib/supabase';
import { buildSankeyData } from '@grant-engine/reports/money-flow';
import { MoneyFlowCharts } from './charts';

export const dynamic = 'force-dynamic';

async function getReport() {
  try {
    const supabase = getServiceSupabase();

    const { data: allFlows } = await supabase
      .from('money_flows')
      .select('domain, amount, source_type, source_name, destination_type, destination_name, year')
      .eq('year', 2025);

    if (!allFlows?.length) {
      return { domains: [], sankeyByDomain: {}, totalTracked: 0 };
    }

    const domainMap = new Map<string, typeof allFlows>();
    for (const f of allFlows) {
      if (!domainMap.has(f.domain)) domainMap.set(f.domain, []);
      domainMap.get(f.domain)!.push(f);
    }

    const domains = [];
    const sankeyByDomain: Record<string, Awaited<ReturnType<typeof buildSankeyData>>> = {};

    for (const [d, flows] of domainMap) {
      const totalAmount = flows.reduce((s, f) => s + (Number(f.amount) || 0), 0);

      const sourceAmounts = new Map<string, number>();
      const destAmounts = new Map<string, number>();
      for (const f of flows) {
        sourceAmounts.set(f.source_name, (sourceAmounts.get(f.source_name) || 0) + (Number(f.amount) || 0));
        destAmounts.set(f.destination_name, (destAmounts.get(f.destination_name) || 0) + (Number(f.amount) || 0));
      }

      domains.push({
        domain: d,
        totalAmount,
        flowCount: flows.length,
        topSources: Array.from(sourceAmounts.entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, amount]) => ({ name, amount })),
        topDestinations: Array.from(destAmounts.entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, amount]) => ({ name, amount })),
      });

      sankeyByDomain[d] = await buildSankeyData(supabase, d, 2025);
    }

    domains.sort((a, b) => b.totalAmount - a.totalAmount);
    const totalTracked = domains.reduce((s, d) => s + d.totalAmount, 0);

    return { domains, sankeyByDomain, totalTracked };
  } catch {
    return { domains: [], sankeyByDomain: {}, totalTracked: 0 };
  }
}

export default async function MoneyFlowPage() {
  const report = await getReport();

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Follow the Dollar
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
          Trace funding flows from source to outcome. See where public money goes,
          which foundations give to whom, and what results.
        </p>
      </div>

      <MoneyFlowCharts report={report} />
    </div>
  );
}
