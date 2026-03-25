'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface GraphNode {
  id: string;
  label: string;
  records: number;
  domain: string;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'fk' | 'abn' | 'entity_id' | 'postcode';
  column: string;
}

interface SchemaGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  domains: Record<string, string>;
  stats: { tables: number; edges: number; total_records: number };
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

function fmt(n: number): string { return n.toLocaleString(); }

const EDGE_COLORS: Record<string, string> = {
  abn: '#10B981',
  entity_id: '#3B82F6',
  fk: '#D1D5DB',
  postcode: '#F97316',
};

// Domain ordering for radial layout (clockwise from top)
const DOMAIN_ORDER = [
  'Entity Graph', 'Registries', 'Procurement', 'Funding',
  'Influence', 'People', 'Evidence', 'Social', 'Geography', 'Analysis',
];

function computeLayout(data: SchemaGraphData, width: number, height: number): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = width / 2;
  const cy = height / 2;

  // gs_entities goes in the center
  positions.set('gs_entities', { x: cx, y: cy });
  // gs_relationships just below center
  positions.set('gs_relationships', { x: cx, y: cy + 40 });
  // entity_xref just above center
  positions.set('entity_xref', { x: cx - 35, y: cy - 30 });
  positions.set('gs_entity_aliases', { x: cx + 35, y: cy - 30 });
  positions.set('entity_identifiers', { x: cx, y: cy - 50 });

  // Group nodes by domain (excluding Entity Graph which is centered)
  const domainGroups = new Map<string, GraphNode[]>();
  for (const node of data.nodes) {
    if (node.domain === 'Entity Graph') continue;
    const group = domainGroups.get(node.domain) || [];
    group.push(node);
    domainGroups.set(node.domain, group);
  }

  // Place domains in a radial layout
  const activeDomains = DOMAIN_ORDER.filter(d => domainGroups.has(d));
  const angleStep = (2 * Math.PI) / activeDomains.length;
  const innerRadius = Math.min(width, height) * 0.25;
  const outerRadius = Math.min(width, height) * 0.4;

  activeDomains.forEach((domain, di) => {
    const angle = -Math.PI / 2 + di * angleStep; // start from top
    const nodes = domainGroups.get(domain) || [];

    // Sort by records desc so biggest nodes are closest to center
    nodes.sort((a, b) => b.records - a.records);

    nodes.forEach((node, ni) => {
      if (positions.has(node.id)) return;

      const r = innerRadius + (ni / Math.max(nodes.length - 1, 1)) * (outerRadius - innerRadius);
      // Spread nodes within their domain's angular sector
      const spread = angleStep * 0.7;
      const nodeAngle = angle + (ni % 2 === 0 ? -1 : 1) * (Math.floor(ni / 2) + 1) * spread / (nodes.length + 1);
      const finalAngle = nodes.length === 1 ? angle : nodeAngle;

      positions.set(node.id, {
        x: cx + Math.cos(finalAngle) * r,
        y: cy + Math.sin(finalAngle) * r,
      });
    });
  });

  return positions;
}

export default function SchemaGraph() {
  const [data, setData] = useState<SchemaGraphData | null>(null);
  const [hovered, setHovered] = useState<PositionedNode | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodesRef = useRef<PositionedNode[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 600 });

  useEffect(() => {
    fetch('/api/data/schema-graph')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  // Compute layout when data arrives
  useEffect(() => {
    if (!data) return;
    const w = Math.min(typeof window !== 'undefined' ? window.innerWidth - 64 : 1200, 1280);
    const h = 600;
    setCanvasSize({ w, h });

    const positions = computeLayout(data, w, h);
    positionsRef.current = positions;

    nodesRef.current = data.nodes.map(n => ({
      ...n,
      x: positions.get(n.id)?.x ?? w / 2,
      y: positions.get(n.id)?.y ?? h / 2,
    }));
  }, [data]);

  // Draw
  const draw = useCallback(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    const positions = positionsRef.current;
    const nodes = nodesRef.current;

    // Draw edges
    for (const edge of data.edges) {
      const from = positions.get(edge.source);
      const to = positions.get(edge.target);
      if (!from || !to) continue;

      const fromNode = nodes.find(n => n.id === edge.source);
      const toNode = nodes.find(n => n.id === edge.target);

      let alpha = 0.3;
      if (selectedDomain) {
        if (fromNode?.domain !== selectedDomain && toNode?.domain !== selectedDomain) {
          alpha = 0.05;
        } else {
          alpha = 0.6;
        }
      }
      if (hovered && (edge.source === hovered.id || edge.target === hovered.id)) {
        alpha = 1;
      }

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = EDGE_COLORS[edge.type] || '#ddd';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = edge.type === 'abn' ? 2 : edge.type === 'entity_id' ? 1.5 : 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (const node of nodes) {
      const isFiltered = selectedDomain && node.domain !== selectedDomain;
      const isHovered = hovered?.id === node.id;
      const isConnectedToHover = hovered && data.edges.some(
        e => (e.source === hovered.id && e.target === node.id) || (e.target === hovered.id && e.source === node.id)
      );
      const color = data.domains[node.domain] || '#666';
      const radius = Math.max(3, node.size * 0.8);

      ctx.globalAlpha = isFiltered ? 0.15 : 1;

      // Glow for connected nodes
      if (isConnectedToHover && !isFiltered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.id === 'gs_entities' ? '#1a1a1a' : color;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Label
      const showLabel = !isFiltered && (radius > 5 || isHovered || isConnectedToHover);
      if (showLabel) {
        const fontSize = node.id === 'gs_entities' ? 11 : isHovered ? 10 : 8;
        ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isFiltered ? '#99999944' : '#1a1a1a';

        const label = node.label.length > 22 ? node.label.slice(0, 20) + '...' : node.label;
        ctx.fillText(label, node.x, node.y + radius + 3);

        if (isHovered || node.id === 'gs_entities') {
          ctx.font = `${fontSize - 1}px ui-monospace, monospace`;
          ctx.fillStyle = '#888';
          ctx.fillText(fmt(node.records), node.x, node.y + radius + 3 + fontSize + 1);
        }
      }

      ctx.globalAlpha = 1;
    }

    // Draw domain labels at the perimeter
    if (!selectedDomain) {
      const cx = canvasSize.w / 2;
      const cy = canvasSize.h / 2;
      const activeDomains = DOMAIN_ORDER.filter(d => data.nodes.some(n => n.domain === d && d !== 'Entity Graph'));
      const angleStep = (2 * Math.PI) / activeDomains.length;
      const labelR = Math.min(canvasSize.w, canvasSize.h) * 0.46;

      activeDomains.forEach((domain, di) => {
        const angle = -Math.PI / 2 + di * angleStep;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;

        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = data.domains[domain] || '#666';
        ctx.fillText(domain.toUpperCase(), lx, ly);
      });
    }
  }, [data, hovered, selectedDomain, canvasSize]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !nodesRef.current.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest: PositionedNode | null = null;
    let minDist = 20; // hit radius

    for (const node of nodesRef.current) {
      const dx = node.x - mx;
      const dy = node.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = node;
      }
    }

    if (closest !== hovered) {
      setHovered(closest);
    }
  }, [hovered]);

  if (!data) {
    return (
      <div className="border-4 border-bauhaus-black bg-white p-12 text-center">
        <div className="text-bauhaus-muted font-mono text-sm">Loading schema graph...</div>
      </div>
    );
  }

  const domains = Object.entries(data.domains);

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-4 text-xs font-mono text-bauhaus-muted">
        <span><strong className="text-bauhaus-black">{data.stats.tables}</strong> tables</span>
        <span><strong className="text-bauhaus-black">{data.stats.edges}</strong> connections</span>
        <span><strong className="text-bauhaus-black">{fmt(data.stats.total_records)}</strong> total records</span>
      </div>

      {/* Domain filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedDomain(null)}
          className={`px-3 py-1 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black
            ${!selectedDomain ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-gray-100'}`}
        >
          All
        </button>
        {domains.map(([domain, color]) => (
          <button
            key={domain}
            onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
            className="px-3 py-1 text-xs font-black uppercase tracking-widest border-2"
            style={{
              borderColor: color,
              backgroundColor: selectedDomain === domain ? color : undefined,
              color: selectedDomain === domain ? '#fff' : color,
            }}
          >
            {domain}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="border-4 border-bauhaus-black bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: canvasSize.w, height: canvasSize.h, cursor: hovered ? 'pointer' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="mt-2 p-3 border-2 border-bauhaus-black bg-white text-xs font-mono flex items-center gap-3">
          <span className="font-black text-bauhaus-black">{hovered.label}</span>
          <span className="text-bauhaus-muted">{fmt(hovered.records)} records</span>
          <span className="px-1.5 py-0.5 text-white text-[10px] font-black"
            style={{ backgroundColor: data.domains[hovered.domain] || '#666' }}>
            {hovered.domain}
          </span>
          {data.edges.filter(e => e.source === hovered.id || e.target === hovered.id).length > 0 && (
            <span className="text-bauhaus-muted">
              {data.edges.filter(e => e.source === hovered.id || e.target === hovered.id).length} connections
            </span>
          )}
        </div>
      )}

      {/* Edge legend */}
      <div className="mt-3 flex gap-4 text-xs text-bauhaus-muted">
        <span><span className="inline-block w-4 h-0.5 bg-green-500 mr-1 align-middle" /> ABN join</span>
        <span><span className="inline-block w-4 h-0.5 bg-bauhaus-blue mr-1 align-middle" /> Entity ID</span>
        <span><span className="inline-block w-4 h-0.5 bg-gray-300 mr-1 align-middle" /> FK</span>
        <span><span className="inline-block w-4 h-0.5 bg-orange-500 mr-1 align-middle" /> Postcode</span>
      </div>
    </div>
  );
}
