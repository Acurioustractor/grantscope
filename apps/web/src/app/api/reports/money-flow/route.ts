import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { buildSankeyData } from '@grantscope/engine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '2025', 10);
  const domain = searchParams.get('domain');

  try {
    const supabase = getServiceSupabase();

    // Get all domains
    const { data: allFlows } = await supabase
      .from('money_flows')
      .select('domain, amount, source_type, source_name, destination_type, destination_name')
      .eq('year', year);

    if (!allFlows?.length) {
      return NextResponse.json({ domains: [], sankeyByDomain: {}, totalTracked: 0 });
    }

    // Group by domain
    const domainMap = new Map<string, typeof allFlows>();
    for (const f of allFlows) {
      if (!domainMap.has(f.domain)) domainMap.set(f.domain, []);
      domainMap.get(f.domain)!.push(f);
    }

    const domains = [];
    const sankeyByDomain: Record<string, Awaited<ReturnType<typeof buildSankeyData>>> = {};

    for (const [d, flows] of domainMap) {
      if (domain && d !== domain) continue;

      const totalAmount = flows.reduce((s, f) => s + (Number(f.amount) || 0), 0);

      // Top sources
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
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount })),
        topDestinations: Array.from(destAmounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount })),
      });

      sankeyByDomain[d] = await buildSankeyData(supabase, d, year);
    }

    domains.sort((a, b) => b.totalAmount - a.totalAmount);
    const totalTracked = domains.reduce((s, d) => s + d.totalAmount, 0);

    return NextResponse.json({ domains, sankeyByDomain, totalTracked });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
