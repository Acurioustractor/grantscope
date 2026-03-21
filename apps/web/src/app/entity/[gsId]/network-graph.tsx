'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { truncate } from '@/lib/format';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface NetNode {
  id: string;
  label: string;
  type: string;
  sector: string | null;
  cc: boolean;
  isCenter: boolean;
  x?: number;
  y?: number;
}

interface NetEdge {
  source: string | NetNode;
  target: string | NetNode;
  type: string;
  amount: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  organisation: '#2563eb',
  person: '#8b5cf6',
  government_entity: '#059669',
  company: '#0891b2',
  foundation: '#7c3aed',
  charity: '#16a34a',
  trust: '#d97706',
};

const EDGE_COLORS: Record<string, string> = {
  contract: '#2563eb',
  grant: '#16a34a',
  donation: '#dc2626',
  directorship: '#8b5cf6',
  board_member: '#8b5cf6',
  shared_director: '#d97706',
  lobbies_for: '#f59e0b',
  affiliated_with: '#6b7280',
  subsidiary_of: '#6b7280',
  member_of: '#6b7280',
};

export function EntityNetworkGraph({ entityId, entityName }: { entityId: string; entityName: string }) {
  const [data, setData] = useState<{ nodes: NetNode[]; edges: NetEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<NetNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ d3Force: (name: string) => unknown }>(null);

  useEffect(() => {
    fetch(`/api/data/entity/network?id=${entityId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [entityId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.min(450, Math.max(350, width * 0.6)) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Warm up force layout
  useEffect(() => {
    if (!graphRef.current || !data) return;
    const fg = graphRef.current as unknown as { d3Force: (name: string) => { strength: (n: number) => void; distance?: (n: number) => void } | null };
    const charge = fg.d3Force('charge');
    if (charge?.strength) charge.strength(-120);
    const link = fg.d3Force('link');
    if (link && 'distance' in link && typeof link.distance === 'function') link.distance(60);
  }, [data]);

  const nodeCanvasObject = useCallback((node: NetNode, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isHovered = hovered?.id === node.id;

    if (node.isCenter) {
      // Center entity — large red square (Bauhaus)
      const size = 10;
      ctx.fillStyle = '#D02020';
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      // Label
      ctx.font = 'bold 4px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(truncate(node.label, 30), x, y + size / 2 + 6);
    } else if (node.type === 'person') {
      // Person — small circle
      const r = isHovered ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? '#7c3aed' : '#a78bfa';
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (isHovered) {
        ctx.font = '3.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#374151';
        ctx.fillText(truncate(node.label, 25), x, y + r + 5);
      }
    } else {
      // Entity node
      const r = isHovered ? 6 : 4;
      const color = TYPE_COLORS[node.type] || '#6b7280';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? color : color + 'cc';
      ctx.fill();
      if (node.cc) {
        ctx.strokeStyle = '#D02020';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Label on hover or for high-degree
      if (isHovered) {
        ctx.font = '3.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#374151';
        ctx.fillText(truncate(node.label, 25), x, y + r + 5);
      }
    }
  }, [hovered]);

  const linkColor = useCallback((edge: NetEdge) => {
    const type = typeof edge.type === 'string' ? edge.type : '';
    return (EDGE_COLORS[type] || '#d1d5db') + '60';
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8 text-center">
        <div className="animate-pulse text-sm text-gray-400">Loading network...</div>
      </div>
    );
  }

  if (!data || data.nodes.length <= 1) {
    return null; // No network to show
  }

  // Collect unique relationship types for legend
  const edgeTypes = [...new Set(data.edges.map(e => typeof e.type === 'string' ? e.type : ''))].filter(Boolean);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">
          Network
          <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">
            {data.nodes.length} entities, {data.edges.length} connections
          </span>
        </h2>
        <Link
          href={`/graph?entity=${entityId}`}
          className="text-xs text-gray-400 hover:text-bauhaus-red transition-colors border border-gray-300 px-3 py-1"
        >
          Full Graph
        </Link>
      </div>
      <div ref={containerRef} className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden relative">
        <ForceGraph2D
          ref={graphRef as React.MutableRefObject<never>}
          width={dimensions.width}
          height={dimensions.height}
          graphData={{ nodes: data.nodes, links: data.edges }}
          nodeCanvasObject={nodeCanvasObject as never}
          nodePointerAreaPaint={((node: NetNode, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, 6, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }) as never}
          linkColor={linkColor as never}
          linkWidth={0.5}
          onNodeHover={((node: NetNode | null) => setHovered(node)) as never}
          onNodeClick={((node: NetNode) => {
            if (node.type === 'person') {
              window.location.href = `/person/${encodeURIComponent(node.label.replace(/\s+/g, '-'))}`;
            }
          }) as never}
          cooldownTicks={80}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          backgroundColor="transparent"
        />
        {/* Hovered tooltip */}
        {hovered && !hovered.isCenter && (
          <div className="absolute top-2 left-2 bg-white/95 border border-gray-200 shadow-sm px-3 py-2 text-xs max-w-64 pointer-events-none">
            <p className="font-bold truncate">{hovered.label}</p>
            <p className="text-gray-400">{hovered.type}{hovered.cc ? ' — Community Controlled' : ''}</p>
          </div>
        )}
        {/* Legend */}
        <div className="absolute bottom-2 right-2 bg-white/90 border border-gray-200 px-3 py-2 text-[10px] space-y-1">
          {edgeTypes.slice(0, 6).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: EDGE_COLORS[t] || '#d1d5db' }} />
              <span className="text-gray-500">{t.replace(/_/g, ' ')}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200">
            <span className="w-2 h-2 rounded-full bg-[#a78bfa] inline-block" />
            <span className="text-gray-500">person</span>
          </div>
        </div>
      </div>
    </section>
  );
}
