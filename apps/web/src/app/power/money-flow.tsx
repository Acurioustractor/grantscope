'use client';

import { useState, useEffect, useMemo } from 'react';

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

interface FlowData {
  nodes: FlowNode[];
  links: FlowLink[];
  totalAmount: number;
  domains: string[];
  year: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  source: '#D02020',       // bauhaus-red
  funder: '#1040C0',       // bauhaus-blue
  recipient_type: '#F0C020', // bauhaus-yellow
  recipient: '#059669',    // green
};

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const COLUMN_LABELS: Record<string, string> = {
  source: 'Source Type',
  funder: 'Funder / Agency',
  recipient_type: 'Recipient Type',
  recipient: 'Recipient',
};

export function MoneyFlow() {
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('all');
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/power/flows?domain=${domain}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [domain]);

  // Group nodes by category (column)
  const columns = useMemo(() => {
    if (!data) return [];
    const categories = ['source', 'funder', 'recipient_type', 'recipient'];
    return categories.map(cat => ({
      category: cat,
      label: COLUMN_LABELS[cat],
      nodes: data.nodes
        .map((n, i) => ({ ...n, index: i }))
        .filter(n => n.category === cat),
    }));
  }, [data]);

  // Find connected nodes when hovering
  const connectedNodes = useMemo(() => {
    if (hoveredNode === null || !data) return new Set<number>();
    const connected = new Set<number>();
    connected.add(hoveredNode);
    // Walk forward and backward through links
    const queue = [hoveredNode];
    const visited = new Set<number>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      connected.add(current);
      for (const link of data.links) {
        if (link.source === current && !visited.has(link.target)) {
          queue.push(link.target);
        }
        if (link.target === current && !visited.has(link.source)) {
          queue.push(link.source);
        }
      }
    }
    return connected;
  }, [hoveredNode, data]);

  // Calculate node values (sum of connected links)
  const nodeValues = useMemo(() => {
    if (!data) return new Map<number, number>();
    const values = new Map<number, number>();
    for (const link of data.links) {
      values.set(link.target, (values.get(link.target) || 0) + link.value);
      // For source nodes, use outbound
      if (!values.has(link.source)) {
        values.set(link.source, link.value);
      }
    }
    return values;
  }, [data]);

  if (loading) {
    return (
      <div className="border-4 border-bauhaus-black p-8 bg-white">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse text-center">
          Loading flow data...
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="border-4 border-bauhaus-black p-8 bg-white text-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest">
          No flow data available
        </div>
        <p className="text-bauhaus-muted text-sm mt-2">
          Run the money flow builder to populate data.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero stat */}
      <div className="border-4 border-bauhaus-blue bg-white p-4 mb-4 text-center">
        <div className="text-3xl font-black text-bauhaus-blue">{formatDollars(data.totalAmount)}</div>
        <div className="text-sm text-bauhaus-muted font-bold">
          Total funding tracked across {data.domains.length} domains
        </div>
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => setDomain('all')}
          className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 transition-colors ${
            domain === 'all'
              ? 'bg-bauhaus-black text-white border-bauhaus-black'
              : 'bg-white text-bauhaus-black border-bauhaus-black/20 hover:border-bauhaus-black'
          }`}
        >
          All Domains
        </button>
        {data.domains.map(d => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 transition-colors ${
              domain === d
                ? 'bg-bauhaus-black text-white border-bauhaus-black'
                : 'bg-white text-bauhaus-black border-bauhaus-black/20 hover:border-bauhaus-black'
            }`}
          >
            {d.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Flow columns */}
      <div className="border-4 border-bauhaus-black bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          {columns.map(col => (
            <div key={col.category}>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-[0.2em] text-center mb-2 pb-1 border-b-2" style={{ borderColor: CATEGORY_COLORS[col.category] }}>
                {col.label}
              </div>
              <div className="space-y-1">
                {col.nodes
                  .sort((a, b) => (nodeValues.get(b.index) || 0) - (nodeValues.get(a.index) || 0))
                  .slice(0, 12)
                  .map(node => {
                    const value = nodeValues.get(node.index) || 0;
                    const isHighlighted = hoveredNode === null || connectedNodes.has(node.index);
                    const color = CATEGORY_COLORS[node.category];

                    return (
                      <div
                        key={node.index}
                        onMouseEnter={() => setHoveredNode(node.index)}
                        onMouseLeave={() => setHoveredNode(null)}
                        className="transition-all cursor-pointer"
                        style={{
                          opacity: isHighlighted ? 1 : 0.2,
                          background: `${color}10`,
                          border: `2px solid ${color}${isHighlighted ? '60' : '20'}`,
                          padding: '6px 8px',
                        }}
                      >
                        <div className="text-[11px] font-bold leading-tight truncate" title={node.name}>
                          {node.name}
                        </div>
                        {value > 0 && (
                          <div className="text-xs font-black mt-0.5" style={{ color }}>
                            {formatDollars(value)}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
