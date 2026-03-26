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

interface PersonBoard {
  org_name: string;
  org_gs_id: string | null;
  org_type: string | null;
  org_revenue: number | null;
  my_role: string;
  co_directors: Array<{
    name: string;
    role: string;
    title: string | null;
    gs_id: string | null;
    shared_boards: number;
  }>;
}

interface PersonNetworkResponse {
  type: 'person';
  person: { id: string; gs_id: string; name: string };
  boards: PersonBoard[];
}

function PersonBoardNetwork({ data }: { data: PersonNetworkResponse }) {
  const totalCoDirectors = new Set(data.boards.flatMap((b) => b.co_directors.map((c) => c.name))).size;
  const interlocked = data.boards.flatMap((b) => b.co_directors).filter((c) => c.shared_boards > 1);
  const uniqueInterlocked = new Set(interlocked.map((c) => c.name));

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6 text-xs">
        <div className="border-2 border-bauhaus-black px-3 py-2">
          <span className="font-black text-lg">{data.boards.length}</span>
          <span className="ml-1 text-bauhaus-muted uppercase tracking-wider">boards</span>
        </div>
        <div className="border-2 border-bauhaus-black px-3 py-2">
          <span className="font-black text-lg">{totalCoDirectors}</span>
          <span className="ml-1 text-bauhaus-muted uppercase tracking-wider">co-directors</span>
        </div>
        {uniqueInterlocked.size > 0 && (
          <div className="border-2 border-bauhaus-red px-3 py-2">
            <span className="font-black text-lg text-bauhaus-red">{uniqueInterlocked.size}</span>
            <span className="ml-1 text-bauhaus-muted uppercase tracking-wider">shared across boards</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {data.boards.map((board, i) => (
          <div key={i} className="border-2 border-bauhaus-black">
            <div className="flex items-center justify-between bg-bauhaus-black text-white px-4 py-2">
              <div className="flex items-center gap-3">
                {board.org_gs_id ? (
                  <Link href={`/entities/${board.org_gs_id}`} className="font-black hover:text-bauhaus-yellow">
                    {board.org_name}
                  </Link>
                ) : (
                  <span className="font-black">{board.org_name}</span>
                )}
                {board.org_type && (
                  <span className="text-[10px] uppercase tracking-wider text-white/60">
                    {board.org_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {board.org_revenue ? (
                  <span className="font-mono text-sm">{formatMoney(board.org_revenue)}</span>
                ) : null}
                <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5">
                  {board.my_role.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            {board.co_directors.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
                {board.co_directors.map((cd, j) => (
                  <div
                    key={j}
                    className={`px-3 py-2 border-b border-r border-gray-200 ${cd.shared_boards > 1 ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {cd.gs_id ? (
                        <Link href={`/entities/${cd.gs_id}`} className="text-sm font-medium hover:text-bauhaus-red">
                          {cd.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{cd.name}</span>
                      )}
                      {cd.shared_boards > 1 && (
                        <span className="text-[9px] bg-bauhaus-red text-white px-1 py-0.5 font-mono">
                          {cd.shared_boards}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-bauhaus-muted uppercase tracking-wider">
                      {cd.title || cd.role.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-bauhaus-muted">
                Sole director
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NetworkTab({ gsId }: { gsId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetch(`/api/entities/${gsId}/network`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gsId]);

  // Simple force simulation
  const runSimulation = useCallback(() => {
    if (!data || data.type === 'person') return;
    const netData = data as NetworkResponse;

    const width = 800;
    const height = 500;
    const maxAmount = Math.max(...netData.nodes.map((n: NetworkNode) => n.total_amount), 1);

    const nodes: SimNode[] = [
      {
        ...netData.center,
        total_amount: 0,
        relationship_types: [],
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        radius: 24,
        isCenter: true,
      },
      ...netData.nodes.map((n: NetworkNode, i: number) => {
        const angle = (i / netData.nodes.length) * Math.PI * 2;
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
      for (const edge of netData.edges) {
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
        netData.edges.forEach((edge: NetworkEdge, i: number) => {
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

  // Person entity: render board network
  if (data?.type === 'person') {
    return <PersonBoardNetwork data={data as PersonNetworkResponse} />;
  }

  if (!data || !data.nodes || data.nodes.length === 0) {
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
        {Object.entries(data.entityTypes as Record<string, number>)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-3 h-3 border-2 border-bauhaus-black"
                style={{ backgroundColor: TYPE_COLORS[type] || '#9ca3af' }}
              />
              <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                {entityTypeLabel(type)} ({count as number})
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
          {(data.edges as NetworkEdge[]).map((edge: NetworkEdge, i: number) => {
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
