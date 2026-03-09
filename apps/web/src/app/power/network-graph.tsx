'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  amount: number;
}

interface EntityRelationship {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number;
  source_entity?: { id: string; canonical_name: string; entity_type: string };
  target_entity?: { id: string; canonical_name: string; entity_type: string };
}

const TYPE_COLORS: Record<string, string> = {
  charity: '#1040C0',
  foundation: '#7c3aed',
  company: '#121212',
  government_body: '#059669',
  indigenous_corp: '#d97706',
  political_party: '#D02020',
  social_enterprise: '#0891b2',
  person: '#6b7280',
  trust: '#64748b',
  unknown: '#999',
};

const REL_COLORS: Record<string, string> = {
  donation: '#D02020',
  contract: '#1040C0',
  grant: '#059669',
  directorship: '#7c3aed',
  ownership: '#121212',
  default: '#999',
};

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value > 0) return `$${value.toFixed(0)}`;
  return '';
}

interface NetworkGraphProps {
  gsId: string | null;
  onClose: () => void;
}

export function NetworkGraph({ gsId, onClose }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityName, setEntityName] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);

  const WIDTH = 800;
  const HEIGHT = 500;
  const CENTER_X = WIDTH / 2;
  const CENTER_Y = HEIGHT / 2;

  useEffect(() => {
    if (!gsId) return;
    setLoading(true);

    fetch(`/api/power/network/${gsId}`)
      .then(r => r.json())
      .then(data => {
        const entity = data.entity;
        if (!entity) { setLoading(false); return; }

        setEntityName(entity.canonical_name);

        const relationships: EntityRelationship[] = data.relationships || [];
        const nodeMap = new Map<string, GraphNode>();

        // Center node
        nodeMap.set(entity.id, {
          id: entity.id,
          name: entity.canonical_name,
          type: entity.entity_type,
          x: CENTER_X,
          y: CENTER_Y,
          vx: 0,
          vy: 0,
          isCenter: true,
        });

        // Connected nodes (max 30)
        const rels = relationships.slice(0, 30);
        for (const rel of rels) {
          const otherId = rel.source_entity_id === entity.id
            ? rel.target_entity_id
            : rel.source_entity_id;
          const otherEntity = rel.source_entity_id === entity.id
            ? rel.target_entity
            : rel.source_entity;

          if (!nodeMap.has(otherId) && otherEntity) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 120 + Math.random() * 100;
            nodeMap.set(otherId, {
              id: otherId,
              name: otherEntity.canonical_name,
              type: otherEntity.entity_type,
              x: CENTER_X + Math.cos(angle) * radius,
              y: CENTER_Y + Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
              isCenter: false,
            });
          }
        }

        const graphEdges: GraphEdge[] = rels
          .filter(r => nodeMap.has(r.source_entity_id) && nodeMap.has(r.target_entity_id))
          .map(r => ({
            source: r.source_entity_id,
            target: r.target_entity_id,
            type: r.relationship_type,
            amount: Number(r.amount) || 0,
          }));

        setNodes(Array.from(nodeMap.values()));
        setEdges(graphEdges);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gsId]);

  // Simple force simulation
  const simulateForce = useCallback(() => {
    setNodes(prev => {
      const next = prev.map(n => ({ ...n }));

      for (let i = 0; i < next.length; i++) {
        if (next[i].isCenter) continue;

        // Repulsion between nodes
        for (let j = 0; j < next.length; j++) {
          if (i === j) continue;
          const dx = next[i].x - next[j].x;
          const dy = next[i].y - next[j].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = 500 / (dist * dist);
          next[i].vx += (dx / dist) * force;
          next[i].vy += (dy / dist) * force;
        }

        // Attraction to connected nodes (spring)
        for (const edge of edges) {
          const otherId = edge.source === next[i].id ? edge.target : edge.source;
          if (otherId !== edge.source && otherId !== edge.target) continue;

          const other = next.find(n => n.id === otherId);
          if (!other) continue;

          const dx = other.x - next[i].x;
          const dy = other.y - next[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const force = (dist - 150) * 0.01;
          next[i].vx += (dx / dist) * force;
          next[i].vy += (dy / dist) * force;
        }

        // Damping
        next[i].vx *= 0.8;
        next[i].vy *= 0.8;
        next[i].x += next[i].vx;
        next[i].y += next[i].vy;

        // Bounds
        next[i].x = Math.max(60, Math.min(WIDTH - 60, next[i].x));
        next[i].y = Math.max(40, Math.min(HEIGHT - 40, next[i].y));
      }

      return next;
    });
  }, [edges]);

  useEffect(() => {
    if (nodes.length === 0) return;
    let frame = 0;
    const maxFrames = 120;

    function tick() {
      if (frame >= maxFrames) return;
      simulateForce();
      frame++;
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length > 0, simulateForce]);

  const nodeLookup = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  if (!gsId) return null;

  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-bauhaus-black/20">
        <div>
          <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Power Network</span>
          {entityName && <span className="text-sm font-black text-bauhaus-black ml-2">{entityName}</span>}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-bauhaus-black hover:text-white transition-colors border-2 border-bauhaus-black"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="h-[500px] flex items-center justify-center">
          <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
            Loading network...
          </div>
        </div>
      ) : (
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block">
          {/* Edges */}
          {edges.map((edge, i) => {
            const source = nodeLookup.get(edge.source);
            const target = nodeLookup.get(edge.target);
            if (!source || !target) return null;
            const color = REL_COLORS[edge.type] || REL_COLORS.default;

            return (
              <g key={i}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={color}
                  strokeWidth={Math.max(1, Math.min(4, edge.amount / 1000000))}
                  opacity={0.4}
                />
                {edge.amount > 0 && (
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 4}
                    textAnchor="middle"
                    className="text-[8px] font-bold"
                    fill={color}
                  >
                    {formatDollars(edge.amount)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const color = TYPE_COLORS[node.type] || TYPE_COLORS.unknown;
            const radius = node.isCenter ? 24 : 14;

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  stroke="#121212"
                  strokeWidth={node.isCenter ? 3 : 1.5}
                  opacity={0.9}
                />
                <text
                  x={node.x}
                  y={node.y + radius + 12}
                  textAnchor="middle"
                  className={node.isCenter ? 'text-[11px] font-black' : 'text-[9px] font-bold'}
                  fill="#121212"
                >
                  {node.name.length > 25 ? node.name.slice(0, 22) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Legend */}
      <div className="px-4 py-2 border-t-2 border-bauhaus-black/20 flex flex-wrap gap-3">
        {Object.entries(REL_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-bold text-bauhaus-muted capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
