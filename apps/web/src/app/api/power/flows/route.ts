import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

interface FlowNode {
  id: string;
  name: string;
  category: string;
}

interface FlowLink {
  source: number;
  target: number;
  value: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain') || 'all';
  const year = parseInt(searchParams.get('year') || '2025', 10);

  try {
    const supabase = getServiceSupabase();

    let query = supabase
      .from('money_flows')
      .select('source_type, source_name, destination_type, destination_name, amount, flow_type')
      .eq('year', year);

    if (domain !== 'all') {
      query = query.eq('domain', domain);
    }

    const { data: flows, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!flows?.length) {
      return NextResponse.json({ nodes: [], links: [], totalAmount: 0 });
    }

    // Build Sankey nodes and links
    // Layers: source_type → source_name → destination_type → destination_name
    const nodeMap = new Map<string, { id: string; name: string; category: string }>();
    const linkMap = new Map<string, number>();

    for (const flow of flows) {
      const amount = Number(flow.amount) || 0;
      if (amount <= 0) continue;

      const sourceKey = `src:${flow.source_type}`;
      const funderKey = `funder:${flow.source_name}`;
      const destTypeKey = `dtype:${flow.destination_type}`;
      const destKey = `dest:${flow.destination_name}`;

      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, {
          id: sourceKey,
          name: formatLabel(flow.source_type),
          category: 'source',
        });
      }
      if (!nodeMap.has(funderKey)) {
        nodeMap.set(funderKey, {
          id: funderKey,
          name: flow.source_name,
          category: 'funder',
        });
      }
      if (!nodeMap.has(destTypeKey)) {
        nodeMap.set(destTypeKey, {
          id: destTypeKey,
          name: formatLabel(flow.destination_type),
          category: 'recipient_type',
        });
      }
      if (!nodeMap.has(destKey)) {
        nodeMap.set(destKey, {
          id: destKey,
          name: flow.destination_name,
          category: 'recipient',
        });
      }

      // Links: source_type → source_name
      const link1 = `${sourceKey}→${funderKey}`;
      linkMap.set(link1, (linkMap.get(link1) || 0) + amount);

      // Links: source_name → destination_type
      const link2 = `${funderKey}→${destTypeKey}`;
      linkMap.set(link2, (linkMap.get(link2) || 0) + amount);

      // Links: destination_type → destination_name
      const link3 = `${destTypeKey}→${destKey}`;
      linkMap.set(link3, (linkMap.get(link3) || 0) + amount);
    }

    // Convert to indexed arrays for Sankey
    const nodes: FlowNode[] = Array.from(nodeMap.values());
    const nodeIndex = new Map<string, number>();
    nodes.forEach((n, i) => nodeIndex.set(n.id, i));

    // Limit to top links by value to keep viz manageable
    const sortedLinks = Array.from(linkMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    const links: FlowLink[] = sortedLinks.map(([key, value]) => {
      const [src, tgt] = key.split('→');
      return {
        source: nodeIndex.get(src) ?? 0,
        target: nodeIndex.get(tgt) ?? 0,
        value,
      };
    });

    const totalAmount = flows.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    // Get available domains for filter
    const { data: domainRows } = await supabase
      .from('money_flows')
      .select('domain')
      .eq('year', year);

    const domains = [...new Set((domainRows || []).map(d => d.domain))].sort();

    return NextResponse.json({ nodes, links, totalAmount, domains, year });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
