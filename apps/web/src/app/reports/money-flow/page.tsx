import { getServiceSupabase } from '@/lib/supabase';
import { buildSankeyData } from '@grantscope/engine';
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
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb', marginBottom: '4px' }}>
          LIVING REPORT
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 8px' }}>
          Follow the Dollar
        </h1>
        <p style={{ color: '#666', fontSize: '16px', margin: 0, maxWidth: '700px' }}>
          Trace funding flows from source to outcome. See where public money goes,
          which foundations give to whom, and what results.
        </p>
      </div>

      <MoneyFlowCharts report={report} />
    </div>
  );
}
