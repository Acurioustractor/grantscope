'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatMoney, entityTypeLabel } from '../_lib/formatters';

interface NetworkNode {
  id: string;
  gs_id: string;
  name: string;
  entity_type: string;
  total_amount: number;
  relationship_types: string[];
}

interface NetworkEdge {
  source: string;
  target: string;
  amount: number;
  relationship_type: string;
}

interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  center: { id: string; gs_id: string; name: string; entity_type: string };
  entityTypes: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  charity: '#16a34a',
  foundation: '#2563eb',
  company: '#1a1a1a',
  government_body: '#ca8a04',
  indigenous_corp: '#dc2626',
  political_party: '#dc2626',
  social_enterprise: '#16a34a',
  person: '#6b7280',
  unknown: '#9ca3af',
};

const EDGE_COLORS: Record<string, string> = {
  contract: '#2563eb',
  donation: '#dc2626',
  grant: '#16a34a',
};

interface SimNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCenter: boolean;
}

export function NetworkTab({ gsId }: { gsId: string }) {
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetch(`/api/entities/${gsId}/network`)
      .then((r) => r.json())
      .then((d: NetworkResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gsId]);

  // Simple force simulation
  const runSimulation = useCallback(() => {
    if (!data) return;

    const width = 800;
    const height = 500;
    const maxAmount = Math.max(...data.nodes.map((n) => n.total_amount), 1);

    const nodes: SimNode[] = [
      {
        ...data.center,
        total_amount: 0,
        relationship_types: [],
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        radius: 24,
        isCenter: true,
      },
      ...data.nodes.map((n, i) => {
        const angle = (i / data.nodes.length) * Math.PI * 2;
        const dist = 150 + Math.random() * 100;
        return {
          ...n,
          x: width / 2 + Math.cos(angle) * dist,
          y: height / 2 + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          radius: Math.max(6, Math.min(18, 6 + (n.total_amount / maxAmount) * 12)),
          isCenter: false,
        };
      }),
    ];

    nodesRef.current = nodes;

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const centerNode = nodes[0];

    let iteration = 0;
    const maxIterations = 200;

    const tick = () => {
      if (iteration >= maxIterations) return;
      iteration++;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const minDist = a.radius + b.radius + 20;
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.5;
            dx *= force;
            dy *= force;
            if (!a.isCenter) { a.vx -= dx; a.vy -= dy; }
            if (!b.isCenter) { b.vx += dx; b.vy += dy; }
          }
        }
      }

      // Attraction to center for connected nodes
      for (const edge of data.edges) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const targetDist = 180;
        const force = (dist - targetDist) / dist * 0.02;
        if (!source.isCenter) { source.vx += dx * force; source.vy += dy * force; }
        if (!target.isCenter) { target.vx -= dx * force; target.vy -= dy * force; }
      }

      // Apply velocities with damping + boundary
      for (const node of nodes) {
        if (node.isCenter) continue;
        node.vx *= 0.8;
        node.vy *= 0.8;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
        node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
      }

      // Keep center fixed
      centerNode.x = width / 2;
      centerNode.y = height / 2;

      nodesRef.current = [...nodes];

      if (svgRef.current) {
        // Update SVG elements
        const svg = svgRef.current;

        // Update edges
        data.edges.forEach((edge, i) => {
          const line = svg.querySelector(`#edge-${i}`) as SVGLineElement;
          if (!line) return;
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return;
          line.setAttribute('x1', String(source.x));
          line.setAttribute('y1', String(source.y));
          line.setAttribute('x2', String(target.x));
          line.setAttribute('y2', String(target.y));
        });

        // Update nodes
        nodes.forEach((node, i) => {
          const g = svg.querySelector(`#node-${i}`) as SVGGElement;
          if (!g) return;
          g.setAttribute('transform', `translate(${node.x},${node.y})`);
        });
      }

      if (iteration < maxIterations) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [data]);

  useEffect(() => {
    const cleanup = runSimulation();
    return () => { cleanup?.(); cancelAnimationFrame(animRef.current); };
  }, [runSimulation]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-bauhaus-muted font-bold animate-pulse">Loading network graph...</div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-bauhaus-muted font-bold">No connected entities found</p>
      </div>
    );
  }

  const width = 800;
  const height = 500;
  const nodeById = new Map(nodesRef.current.map((n) => [n.id, n]));

  return (
    <div>
      {/* Entity type distribution */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(data.entityTypes)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-3 h-3 border-2 border-bauhaus-black"
                style={{ backgroundColor: TYPE_COLORS[type] || '#9ca3af' }}
              />
              <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                {entityTypeLabel(type)} ({count})
              </span>
            </div>
          ))}
      </div>

      {/* SVG graph */}
      <div className="border-4 border-bauhaus-black bg-white overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: '500px' }}
        >
          {/* Edges */}
          {data.edges.map((edge, i) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            return (
              <line
                key={i}
                id={`edge-${i}`}
                x1={source?.x ?? 0}
                y1={source?.y ?? 0}
                x2={target?.x ?? 0}
                y2={target?.y ?? 0}
                stroke={EDGE_COLORS[edge.relationship_type] || '#d1d5db'}
                strokeWidth={1.5}
                strokeOpacity={0.4}
              />
            );
          })}

          {/* Nodes */}
          {nodesRef.current.map((node, i) => (
            <g
              key={node.id}
              id={`node-${i}`}
              transform={`translate(${node.x},${node.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                if (node.gs_id) window.location.href = `/entities/${node.gs_id}`;
              }}
            >
              <circle
                r={node.radius}
                fill={TYPE_COLORS[node.entity_type] || '#9ca3af'}
                stroke="#1a1a1a"
                strokeWidth={node.isCenter ? 4 : 2}
              />
              {node.isCenter && (
                <text
                  y={node.radius + 16}
                  textAnchor="middle"
                  className="text-[11px] font-black fill-bauhaus-black"
                >
                  {node.name.length > 25 ? node.name.slice(0, 22) + '...' : node.name}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredNode && !hoveredNode.isCenter && (
          <div className="absolute top-4 right-4 bg-white border-4 border-bauhaus-black p-3 max-w-[250px] pointer-events-none">
            <div className="font-black text-bauhaus-black text-sm truncate">{hoveredNode.name}</div>
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">
              {entityTypeLabel(hoveredNode.entity_type)}
            </div>
            {hoveredNode.total_amount > 0 && (
              <div className="text-sm font-black text-bauhaus-black mt-1">
                {formatMoney(hoveredNode.total_amount)}
              </div>
            )}
            <div className="text-[10px] text-bauhaus-muted mt-1">
              {hoveredNode.relationship_types.join(', ')}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-bauhaus-muted mt-2">
        Top {data.nodes.length} connected entities by total relationship value. Click a node to navigate.
      </p>
    </div>
  );
}
